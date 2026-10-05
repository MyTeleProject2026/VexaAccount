const express=require('express');
const crypto=require('crypto');
const {pool}=require('../config/database');
const {authUser}=require('../middleware/auth');
const {subscribe,emit,broadcast}=require('../services/vexachatRealtime.service');

const router=express.Router();
router.use(authUser);
const uid=req=>Number(req.user.id||req.user.sub);
const clean=v=>String(v??'').trim();
async function members(conversationId){
 const [rows]=await pool.query('SELECT user_id FROM vexachat_participants WHERE conversation_id=?',[conversationId]);
 return rows.map(x=>Number(x.user_id));
}
async function isMember(conversationId,userId){
 const [rows]=await pool.query('SELECT 1 FROM vexachat_participants WHERE conversation_id=? AND user_id=? LIMIT 1',[conversationId,userId]);
 return rows.length>0;
}
async function blockedEither(a,b){
 const [rows]=await pool.query('SELECT 1 FROM vexachat_blocks WHERE (user_id=? AND blocked_user_id=?) OR (user_id=? AND blocked_user_id=?) LIMIT 1',[a,b,b,a]);
 return rows.length>0;
}
async function privacyFor(viewerId,targetId){const [p]=await pool.query("SELECT read_receipts,last_seen,profile_photo FROM vexachat_privacy_settings WHERE user_id=? LIMIT 1",[targetId]);const x=p[0]||{};const [c]=await pool.query("SELECT 1 FROM vexachat_contacts WHERE user_id=? AND contact_user_id=? LIMIT 1",[targetId,viewerId]);return {read_receipts:x.read_receipts!==0,last_seen:x.last_seen||'everyone',profile_photo:x.profile_photo||'everyone',isContact:!!c.length}}

router.get('/events',async(req,res)=>{
 const userId=uid(req);
 res.status(200);
 res.setHeader('Content-Type','text/event-stream; charset=utf-8');
 res.setHeader('Cache-Control','no-cache, no-transform');
 res.setHeader('Connection','keep-alive');
 res.setHeader('X-Accel-Buffering','no');
 res.flushHeaders?.();
 if(req.socket)req.socket.setTimeout(0);
 const unsubscribe=subscribe(userId,res);
 let closed=false;
 const close=()=>{if(closed)return;closed=true;clearInterval(heartbeat);unsubscribe()};
 const heartbeat=setInterval(()=>{
  if(res.writableEnded||res.destroyed)return close();
  try{res.write(': heartbeat '+Date.now()+'\\n\\n')}catch{close()}
 },15000);
 req.on('close',close);
 res.on('close',close);
 res.write(': connected\\n\\n');
 res.write('event: ready\\ndata: '+JSON.stringify({ok:true,ts:Date.now()})+'\\n\\n');
});

router.get('/me',async(req,res,next)=>{try{
 const [rows]=await pool.query('SELECT u.id,u.email,u.name,u.avatar_url,u.first_name,u.last_name,u.phone,u.bio,u.country,p.status,p.last_seen_at FROM store_users u LEFT JOIN vexachat_presence p ON p.user_id=u.id WHERE u.id=? LIMIT 1',[uid(req)]);
 res.json({success:true,user:rows[0]||null});
}catch(e){next(e)}});

router.get('/users',async(req,res,next)=>{try{
 const userId=uid(req),q=clean(req.query.q).toLowerCase();
 const params=[userId]; let where='u.is_active=1 AND u.id<>?';
 if(q){where+=' AND (LOWER(u.email) LIKE ? OR LOWER(COALESCE(u.name,\'\')) LIKE ?)';const x='%'+q+'%';params.push(x,x)}
 const [rows]=await pool.query(`SELECT u.id,u.email,u.name,u.avatar_url,COALESCE(p.status,'offline') status,p.last_seen_at
 FROM store_users u LEFT JOIN vexachat_presence p ON p.user_id=u.id WHERE ${where} ORDER BY u.name,u.email LIMIT 50`,params);
 const viewer=userId;
 for(const u of rows){const v=await privacyFor(viewer,Number(u.id));if(v.profile_photo==='nobody'||(v.profile_photo==='contacts'&&!v.isContact))u.avatar_url=null;if(v.last_seen==='nobody'||(v.last_seen==='contacts'&&!v.isContact)){u.status='offline';u.last_seen_at=null}}
 res.json({success:true,users:rows});
}catch(e){next(e)}});

router.get('/conversations',async(req,res,next)=>{try{
 const userId=uid(req);
 const [rows]=await pool.query(`SELECT c.id,c.conversation_type,c.title,c.avatar_url,c.created_by,c.updated_at,
 COALESCE((SELECT s.archived FROM vexachat_conversation_settings s WHERE s.conversation_id=c.id AND s.user_id=? LIMIT 1),p.archived) archived,
 COALESCE((SELECT s.pinned FROM vexachat_conversation_settings s WHERE s.conversation_id=c.id AND s.user_id=? LIMIT 1),0) pinned,
 COALESCE((SELECT s.muted_until FROM vexachat_conversation_settings s WHERE s.conversation_id=c.id AND s.user_id=? LIMIT 1),NULL) muted_until,
 COALESCE(NULLIF(c.title,''),GROUP_CONCAT(CASE WHEN u.id<>? THEN COALESCE(NULLIF(u.name,''),u.email) END ORDER BY u.id SEPARATOR ', ')) display_name,
 (SELECT m.body FROM vexachat_messages m WHERE m.conversation_id=c.id AND m.deleted_at IS NULL ORDER BY m.id DESC LIMIT 1) last_message,
 (SELECT m.created_at FROM vexachat_messages m WHERE m.conversation_id=c.id AND m.deleted_at IS NULL ORDER BY m.id DESC LIMIT 1) last_message_at,
 (SELECT COUNT(*) FROM vexachat_messages m WHERE m.conversation_id=c.id AND m.deleted_at IS NULL AND m.id>COALESCE(p.last_read_message_id,0) AND m.sender_id<>?) unread_count
 FROM vexachat_conversations c JOIN vexachat_participants p ON p.conversation_id=c.id AND p.user_id=?
 LEFT JOIN vexachat_participants p2 ON p2.conversation_id=c.id LEFT JOIN store_users u ON u.id=p2.user_id
 GROUP BY c.id,c.conversation_type,c.title,c.avatar_url,c.created_by,c.updated_at,p.archived,p.last_read_message_id ORDER BY last_message_at DESC,c.updated_at DESC`,[userId,userId,userId,userId,userId,userId]);
 res.json({success:true,conversations:rows});
}catch(e){next(e)}});

router.post('/conversations/direct',async(req,res,next)=>{try{
 const userId=uid(req),other=Number(req.body?.user_id);
 if(!other||other===userId)return res.status(400).json({success:false,message:'A different user is required'});
 const [u]=await pool.query('SELECT id FROM store_users WHERE id=? AND is_active=1 LIMIT 1',[other]);
 if(!u.length)return res.status(404).json({success:false,message:'User not found'});
 if(await blockedEither(userId,other))return res.status(403).json({success:false,message:'This conversation is blocked'});
 const [existing]=await pool.query(`SELECT c.id FROM vexachat_conversations c
 JOIN vexachat_participants a ON a.conversation_id=c.id AND a.user_id=?
 JOIN vexachat_participants b ON b.conversation_id=c.id AND b.user_id=?
 WHERE c.conversation_type='direct' LIMIT 1`,[userId,other]);
 if(existing.length)return res.json({success:true,conversation_id:existing[0].id,existing:true});
 const [c]=await pool.query('INSERT INTO vexachat_conversations(conversation_type,created_by) VALUES(?,?)',['direct',userId]);
 await pool.query('INSERT INTO vexachat_participants(conversation_id,user_id,role) VALUES(?,?,?),(?,?,?)',[c.insertId,userId,'owner',c.insertId,other,'member']);
 await pool.query('INSERT INTO vexachat_presence(user_id,status) VALUES(?,"offline") ON DUPLICATE KEY UPDATE user_id=user_id',[userId]);
 res.status(201).json({success:true,conversation_id:c.insertId,existing:false});
}catch(e){next(e)}});

router.post('/conversations/group',async(req,res,next)=>{const c=await pool.getConnection();try{
 const userId=uid(req),title=clean(req.body?.title).slice(0,255),ids=[...new Set((Array.isArray(req.body?.user_ids)?req.body.user_ids:[]).map(Number).filter(Boolean))].filter(x=>x!==userId);
 if(!title||!ids.length)return res.status(400).json({success:false,message:'Group title and at least one member are required'});
 const all=[userId,...ids],place=all.map(()=>'?').join(',');
 const [valid]=await c.query(`SELECT id FROM store_users WHERE id IN (${place}) AND is_active=1`,all);
 if(valid.length!==all.length)return res.status(400).json({success:false,message:'One or more members are unavailable'});
 await c.beginTransaction();
 const [r]=await c.query('INSERT INTO vexachat_conversations(conversation_type,title,created_by) VALUES("group",?,?)',[title,userId]);
 for(const id of all)await c.query('INSERT INTO vexachat_participants(conversation_id,user_id,role) VALUES(?,?,?)',[r.insertId,id,id===userId?'owner':'member']);
 await c.commit();res.status(201).json({success:true,conversation_id:r.insertId});
}catch(e){try{await c.rollback()}catch{}next(e)}finally{c.release()}});

router.get('/conversations/:id/messages',async(req,res,next)=>{try{
 const conversationId=Number(req.params.id),userId=uid(req);
 if(!(await isMember(conversationId,userId)))return res.status(403).json({success:false,message:'Conversation access denied'});
 const before=Number(req.query.before||0),limit=Math.min(Math.max(Number(req.query.limit||60),1),100);
 const [rows]=await pool.query(`SELECT m.id,m.conversation_id,m.sender_id,m.client_message_id,m.message_type,m.body,m.reply_to_id,m.metadata,m.created_at,m.edited_at,m.deleted_at,u.name sender_name,u.email sender_email,u.avatar_url sender_avatar,CASE WHEN EXISTS(SELECT 1 FROM vexachat_participants rp JOIN vexachat_privacy_settings rps ON rps.user_id=rp.user_id WHERE rp.conversation_id=m.conversation_id AND rp.user_id<>m.sender_id AND rp.last_read_message_id>=m.id AND rps.read_receipts<>0) THEN m.created_at ELSE NULL END AS read_at
 FROM vexachat_messages m JOIN store_users u ON u.id=m.sender_id WHERE m.conversation_id=? AND m.id<COALESCE(NULLIF(?,0),18446744073709551615)
 ORDER BY m.id DESC LIMIT ${limit}`,[conversationId,before]);
 rows.reverse();res.json({success:true,messages:rows});
}catch(e){next(e)}});

router.post('/conversations/:id/messages',async(req,res,next)=>{try{
 const conversationId=Number(req.params.id),userId=uid(req);
 if(!(await isMember(conversationId,userId)))return res.status(403).json({success:false,message:'Conversation access denied'});
 const body=clean(req.body?.body),type=clean(req.body?.message_type||'text'),clientId=clean(req.body?.client_message_id)||crypto.randomUUID();
 if(!body)return res.status(400).json({success:false,message:'Message body is required'});
 if(!['text','image','file','audio','video','system'].includes(type))return res.status(400).json({success:false,message:'Unsupported message type'});
 const [membersRows]=await pool.query('SELECT user_id FROM vexachat_participants WHERE conversation_id=?',[conversationId]);
 const otherIds=membersRows.map(x=>Number(x.user_id)).filter(id=>id!==userId);
 if(otherIds.length){const placeholders=otherIds.map(()=>'?').join(',');const [blocked]=await pool.query(`SELECT 1 FROM vexachat_blocks WHERE (user_id=? AND blocked_user_id IN (${placeholders})) OR (blocked_user_id=? AND user_id IN (${placeholders})) LIMIT 1`,[userId,...otherIds,userId,...otherIds]);if(blocked.length)return res.status(403).json({success:false,message:'Message blocked'});}
 const [dup]=await pool.query('SELECT id,created_at FROM vexachat_messages WHERE client_message_id=? LIMIT 1',[clientId]);
 if(dup.length){const [existing]=await pool.query(`SELECT m.id,m.conversation_id,m.sender_id,m.client_message_id,m.message_type,m.body,m.reply_to_id,m.metadata,m.created_at,m.edited_at,m.deleted_at,u.name sender_name,u.email sender_email,u.avatar_url sender_avatar FROM vexachat_messages m JOIN store_users u ON u.id=m.sender_id WHERE m.id=?`,[dup[0].id]);return res.json({success:true,message:existing[0],message_id:dup[0].id,duplicate:true});}
 const [r]=await pool.query('INSERT INTO vexachat_messages(conversation_id,sender_id,client_message_id,message_type,body,reply_to_id,metadata) VALUES(?,?,?,?,?,?,?)',[conversationId,userId,clientId,type,body,Number(req.body?.reply_to_id)||null,req.body?.metadata?JSON.stringify(req.body.metadata):null]);
 await pool.query('UPDATE vexachat_conversations SET updated_at=NOW() WHERE id=?',[conversationId]);
 if(Number(req.body?.attachment_id)){await pool.query('UPDATE vexachat_attachments SET message_id=? WHERE id=? AND uploader_id=? AND message_id IS NULL',[r.insertId,Number(req.body.attachment_id),userId]);}
 const [rows]=await pool.query(`SELECT m.id,m.conversation_id,m.sender_id,m.client_message_id,m.message_type,m.body,m.reply_to_id,m.metadata,m.created_at,u.name sender_name,u.email sender_email,u.avatar_url sender_avatar
 FROM vexachat_messages m JOIN store_users u ON u.id=m.sender_id WHERE m.id=?`,[r.insertId]);
 await broadcast(conversationId,'message',rows[0]);
 res.status(201).json({success:true,message:rows[0]});
}catch(e){next(e)}});

router.post('/conversations/:id/read',async(req,res,next)=>{try{
 const conversationId=Number(req.params.id),userId=uid(req),messageId=Number(req.body?.message_id||0);
 if(!(await isMember(conversationId,userId)))return res.status(403).json({success:false,message:'Conversation access denied'});
 const [privacy]=await pool.query('SELECT read_receipts FROM vexachat_privacy_settings WHERE user_id=? LIMIT 1',[userId]);
 if(privacy[0]&&privacy[0].read_receipts===0)return res.json({success:true,read_receipts:false});
 if(messageId){
  const [target]=await pool.query('SELECT id FROM vexachat_messages WHERE id=? AND conversation_id=? LIMIT 1',[messageId,conversationId]);
  if(!target.length)return res.status(400).json({success:false,message:'Message does not belong to this conversation'});
 }else{
  const [latest]=await pool.query('SELECT id FROM vexachat_messages WHERE conversation_id=? AND deleted_at IS NULL ORDER BY id DESC LIMIT 1',[conversationId]);
  if(!latest.length)return res.json({success:true,message_id:null});
  messageId=Number(latest[0].id);
 }
 const [current]=await pool.query('SELECT last_read_message_id FROM vexachat_participants WHERE conversation_id=? AND user_id=? LIMIT 1',[conversationId,userId]);
 const previous=Number(current[0]?.last_read_message_id||0);
 if(messageId<=previous)return res.json({success:true,read_receipts:true,message_id:previous});
 await pool.query('UPDATE vexachat_participants SET last_read_message_id=? WHERE conversation_id=? AND user_id=?',[messageId,conversationId,userId]);
 await broadcast(conversationId,'read',{conversation_id:conversationId,user_id:userId,message_id:messageId});
 res.json({success:true,read_receipts:true});
}catch(e){next(e)}});

router.post('/conversations/:id/typing',async(req,res,next)=>{try{
 const conversationId=Number(req.params.id),userId=uid(req),typing=req.body?.typing!==false;
 if(!(await isMember(conversationId,userId)))return res.status(403).json({success:false,message:'Conversation access denied'});
 if(typing)await pool.query('INSERT INTO vexachat_typing(conversation_id,user_id,expires_at) VALUES(?,?,DATE_ADD(NOW(),INTERVAL 5 SECOND)) ON DUPLICATE KEY UPDATE expires_at=DATE_ADD(NOW(),INTERVAL 5 SECOND)',[conversationId,userId]);
 else await pool.query('DELETE FROM vexachat_typing WHERE conversation_id=? AND user_id=?',[conversationId,userId]);
 await broadcast(conversationId,'typing',{conversation_id:conversationId,user_id:userId,typing});
 res.json({success:true});
}catch(e){next(e)}});

router.post('/presence',async(req,res,next)=>{try{
 const userId=uid(req),status=['online','offline','away'].includes(clean(req.body?.status))?clean(req.body.status):'online';
 await pool.query('INSERT INTO vexachat_presence(user_id,status,last_seen_at) VALUES(?,?,NOW()) ON DUPLICATE KEY UPDATE status=?,last_seen_at=NOW()',[userId,status,status]);
 const [rows]=await pool.query('SELECT conversation_id FROM vexachat_participants WHERE user_id=?',[userId]);
 for(const r of rows)await broadcast(r.conversation_id,'presence',{user_id:userId,status});
 res.json({success:true,status});
}catch(e){next(e)}});

router.post('/reactions',async(req,res,next)=>{try{
 const userId=uid(req),messageId=Number(req.body?.message_id),emoji=clean(req.body?.emoji).slice(0,32);
 if(!messageId||!emoji)return res.status(400).json({success:false,message:'message_id and emoji are required'});
 const [m]=await pool.query('SELECT conversation_id FROM vexachat_messages WHERE id=? LIMIT 1',[messageId]);if(!m.length)return res.status(404).json({success:false,message:'Message not found'});
 if(!(await isMember(m[0].conversation_id,userId)))return res.status(403).json({success:false,message:'Conversation access denied'});
 await pool.query('INSERT IGNORE INTO vexachat_reactions(message_id,user_id,emoji) VALUES(?,?,?)',[messageId,userId,emoji]);
 await broadcast(m[0].conversation_id,'reaction',{message_id:messageId,user_id:userId,emoji,active:true});
 res.json({success:true});
}catch(e){next(e)}});

router.delete('/reactions',async(req,res,next)=>{try{
 const userId=uid(req),messageId=Number(req.body?.message_id),emoji=clean(req.body?.emoji);
 if(!messageId||!emoji)return res.status(400).json({success:false,message:'message_id and emoji are required'});
 const [m]=await pool.query('SELECT conversation_id FROM vexachat_messages WHERE id=? LIMIT 1',[messageId]);if(!m.length)return res.status(404).json({success:false,message:'Message not found'});
 if(!(await isMember(m[0].conversation_id,userId)))return res.status(403).json({success:false,message:'Conversation access denied'});
 await pool.query('DELETE FROM vexachat_reactions WHERE message_id=? AND user_id=? AND emoji=?',[messageId,userId,emoji]);
 await broadcast(m[0].conversation_id,'reaction',{message_id:messageId,user_id:userId,emoji,active:false});
 res.json({success:true});
}catch(e){next(e)}});

router.post('/blocks',async(req,res,next)=>{try{
 const userId=uid(req),blocked=Number(req.body?.user_id);if(!blocked||blocked===userId)return res.status(400).json({success:false,message:'Invalid user'});
 await pool.query('INSERT IGNORE INTO vexachat_blocks(user_id,blocked_user_id) VALUES(?,?)',[userId,blocked]);res.json({success:true,blocked:true});
}catch(e){next(e)}});

router.get('/blocks/:userId/status',async(req,res,next)=>{try{
 const userId=uid(req),other=Number(req.params.userId);
 if(!other||other===userId)return res.status(400).json({success:false,message:'Invalid user'});
 const [mine]=await pool.query('SELECT 1 FROM vexachat_blocks WHERE user_id=? AND blocked_user_id=? LIMIT 1',[userId,other]);
 const [theirs]=await pool.query('SELECT 1 FROM vexachat_blocks WHERE user_id=? AND blocked_user_id=? LIMIT 1',[other,userId]);
 res.json({success:true,blocked_by_me:!!mine.length,blocked_by_other:!!theirs.length,blocked:!!mine.length||!!theirs.length});
}catch(e){next(e)}});

router.delete('/blocks/:userId',async(req,res,next)=>{try{
 await pool.query('DELETE FROM vexachat_blocks WHERE user_id=? AND blocked_user_id=?',[uid(req),Number(req.params.userId)]);res.json({success:true,blocked:false});
}catch(e){next(e)}});

module.exports=router;