const express=require('express');
const crypto=require('crypto');
const {pool}=require('../config/database');
const {authUser}=require('../middleware/auth');
const {sendEmail}=require('../services/emailService');
const router=express.Router();
router.use(authUser);

const uid=req=>req.user.id||req.user.sub;
const clean=v=>String(v??'').trim();
const esc=v=>clean(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const splitAddresses=v=>[...new Set(String(v??'').split(/[;,\n]+/).map(x=>x.trim().toLowerCase()).filter(Boolean))];
const parseRecipientList=v=>splitAddresses(v).map(email=>({email,type:'to'}));
const allRecipients=(to,cc,bcc)=>[
 ...splitAddresses(to).map(email=>({email,type:'to'})),
 ...splitAddresses(cc).map(email=>({email,type:'cc'})),
 ...splitAddresses(bcc).map(email=>({email,type:'bcc'}))
];
const folderWhere=folder=>({
 inbox:'folder="inbox" AND is_trashed=0 AND is_spam=0',
 sent:'folder="sent" AND is_trashed=0 AND is_spam=0',
 drafts:'folder="drafts" AND is_trashed=0 AND is_spam=0',
 starred:'starred=1 AND is_trashed=0 AND is_spam=0',
 trash:'is_trashed=1',
 spam:'is_spam=1 AND is_trashed=0'
})[folder];

async function currentUser(userId,connection=pool){
 const [rows]=await connection.query('SELECT id,email,name FROM store_users WHERE id=? AND is_active=1 LIMIT 1',[userId]);
 return rows[0]||null;
}
async function writeRecipients(connection,messageId,recipients){
 for(const r of recipients){
  const [users]=await connection.query('SELECT id,name FROM store_users WHERE email=? AND is_active=1 LIMIT 1',[r.email]);
  await connection.query('INSERT INTO vexamail_recipients(message_id,user_id,email,display_name,recipient_type,delivery_status) VALUES(?,?,?,?,?,"pending")',[messageId,users[0]?.id||null,r.email,users[0]?.name||'',r.type]);
 }
}

router.get('/messages',async(req,res,next)=>{try{
 const folder=clean(req.query.folder||'inbox').toLowerCase(),userId=uid(req);
 if(!folderWhere(folder))return res.status(400).json({success:false,message:'Invalid mailbox folder'});
 const q=clean(req.query.q||'').toLowerCase();
 const limit=Math.min(Math.max(Number(req.query.limit||100),1),200);
 let where='m.user_id=? AND m.deleted_at IS NULL AND '+folderWhere(folder),params=[userId];
 if(q){where+=' AND (LOWER(m.subject) LIKE ? OR LOWER(m.from_address) LIKE ? OR LOWER(m.to_address) LIKE ? OR LOWER(m.cc_address) LIKE ? OR LOWER(m.body) LIKE ?)';const x='%'+q+'%';params.push(x,x,x,x,x)}
 const [rows]=await pool.query(`SELECT m.id,m.thread_id,m.from_address AS \`from\`,m.to_address AS \`to\`,m.cc_address AS cc,m.bcc_address AS bcc,m.subject,m.body,m.body_html,m.folder,m.is_read AS \`read\`,m.starred,m.is_trashed,m.is_spam,m.delivery_status,m.provider,m.provider_message_id,m.message_id AS rfc_message_id,m.in_reply_to,m.references_header,DATE_FORMAT(m.created_at,'%Y-%m-%d %H:%i') AS date,
 (SELECT COUNT(*) FROM vexamail_attachments a WHERE a.message_id=m.id) AS attachment_count
 FROM vexamail_messages m WHERE ${where} ORDER BY m.created_at DESC LIMIT ${limit}`,params);
 res.json({success:true,messages:rows.map(m=>({...m,unread:!m.read,preview:clean(m.body).slice(0,180)}))});
}catch(e){next(e)}});

router.get('/threads',async(req,res,next)=>{try{
 const userId=uid(req),q=clean(req.query.q||'').toLowerCase(),limit=Math.min(Math.max(Number(req.query.limit||100),1),200);
 let where='m.user_id=? AND m.deleted_at IS NULL AND m.is_trashed=0 AND m.is_spam=0',params=[userId];
 if(q){where+=' AND (LOWER(m.subject) LIKE ? OR LOWER(m.from_address) LIKE ? OR LOWER(m.to_address) LIKE ? OR LOWER(m.body) LIKE ?)';const x='%'+q+'%';params.push(x,x,x,x)}
 const [rows]=await pool.query(`SELECT m.thread_id,MAX(m.created_at) latest,MAX(m.id) latest_id,MAX(m.subject) subject,COUNT(*) message_count,SUM(m.is_read=0) unread_count
 FROM vexamail_messages m WHERE ${where} GROUP BY m.thread_id ORDER BY latest DESC LIMIT ${limit}`,params);
 res.json({success:true,threads:rows});
}catch(e){next(e)}});

router.get('/threads/:threadId',async(req,res,next)=>{try{
 const [rows]=await pool.query(`SELECT m.id,m.thread_id,m.from_address AS \`from\`,m.to_address AS \`to\`,m.cc_address AS cc,m.bcc_address AS bcc,m.subject,m.body,m.body_html,m.folder,m.is_read AS \`read\`,m.starred,m.delivery_status,m.created_at,m.message_id AS rfc_message_id,m.in_reply_to,m.references_header
 FROM vexamail_messages m WHERE m.user_id=? AND m.thread_id=? AND m.deleted_at IS NULL ORDER BY m.created_at ASC`,[uid(req),req.params.threadId]);
 if(!rows.length)return res.status(404).json({success:false,message:'Conversation not found'});
 res.json({success:true,thread_id:req.params.threadId,messages:rows});
}catch(e){next(e)}});

router.post('/send',async(req,res,next)=>{const c=await pool.getConnection();let tx=false;try{
 const userId=uid(req),user=await currentUser(userId,c);if(!user)return res.status(401).json({success:false,message:'Active VexaAccount session required'});
 const to=clean(req.body.to),cc=clean(req.body.cc),bcc=clean(req.body.bcc),subject=clean(req.body.subject),body=clean(req.body.body),html=clean(req.body.html);
 const recipients=allRecipients(to,cc,bcc);
 if(!recipients.length||!body)return res.status(400).json({success:false,message:'At least one recipient and a message body are required'});
 const threadId=clean(req.body.thread_id)||crypto.randomUUID(),rfcMessageId='<'+crypto.randomUUID()+'@vexamail>';
 const toText=splitAddresses(to).join(', '),ccText=splitAddresses(cc).join(', '),bccText=splitAddresses(bcc).join(', ');
 const [result]=await c.query('INSERT INTO vexamail_messages(user_id,thread_id,message_id,from_address,to_address,cc_address,bcc_address,reply_to,subject,body,body_html,folder,is_read,starred,is_trashed,is_spam,delivery_status,provider) VALUES(?,?,?,?,?,?,?,?,?,?,?,"sent",1,0,0,0,"queued","brevo")',[userId,threadId,rfcMessageId,user.email,toText,ccText,bccText,clean(req.body.reply_to),subject,body,html||null]);
 const messageId=result.insertId;
 await writeRecipients(c,messageId,recipients);
 let sent=0,failed=0;
 for(const r of recipients){try{await sendEmail({to:r.email,subject:subject||'(no subject)',html:html||'<div style="font-family:Arial,sans-serif;line-height:1.6">'+esc(body).replace(/\n/g,'<br>')+'</div>'});await c.query('UPDATE vexamail_recipients SET delivery_status="sent" WHERE message_id=? AND email=?',[messageId,r.email]);sent++;await c.query('INSERT INTO vexamail_delivery_events(message_id,provider,event_type,recipient,payload) VALUES(?,"brevo","sent",?,?)',[messageId,r.email,JSON.stringify({message_id:rfcMessageId})]);}catch(error){failed++;await c.query('UPDATE vexamail_recipients SET delivery_status="failed" WHERE message_id=? AND email=?',[messageId,r.email]);await c.query('INSERT INTO vexamail_delivery_events(message_id,provider,event_type,recipient,payload) VALUES(?,"brevo","failed",?,?)',[messageId,r.email,JSON.stringify({error:String(error.message||error)})]);}}
 await c.beginTransaction();tx=true;
 const status=failed===0?'sent':sent?'delivered':'failed';
 await c.query('UPDATE vexamail_messages SET delivery_status=? WHERE id=?',[status,messageId]);
 for(const r of recipients){const [users]=await c.query('SELECT id FROM store_users WHERE email=? AND is_active=1 LIMIT 1',[r.email]);if(users.length&&Number(users[0].id)!==Number(userId)&&r.type!=='bcc'){await c.query('INSERT INTO vexamail_messages(user_id,thread_id,message_id,from_address,to_address,cc_address,subject,body,body_html,folder,is_read,starred,is_trashed,is_spam,delivery_status,provider,created_at) VALUES(?,?,?,?,?,?,?,?,?,"inbox",0,0,0,0,"delivered","internal",NOW())',[users[0].id,threadId,crypto.randomUUID()+'@internal',user.email,toText,ccText,subject,body,html||null]);}}
 await c.commit();tx=false;
 res.status(failed&&sent===0?502:201).json({success:failed===0||sent>0,message:failed?'Message partially sent':'Message sent',id:messageId,thread_id:threadId,delivery_status:status,sent,failed});
}catch(e){if(tx)try{await c.rollback()}catch{}next(e)}finally{c.release()}});

router.post('/drafts',async(req,res,next)=>{try{
 const user=await currentUser(uid(req));if(!user)return res.status(401).json({success:false,message:'Active VexaAccount session required'});
 const threadId=clean(req.body.thread_id)||crypto.randomUUID(),messageId='<'+crypto.randomUUID()+'@vexamail>';
 const [r]=await pool.query('INSERT INTO vexamail_messages(user_id,thread_id,message_id,from_address,to_address,cc_address,bcc_address,subject,body,body_html,folder,is_read,starred,is_trashed,is_spam,delivery_status) VALUES(?,?,?,?,?,?,?,?,?,?, "drafts",1,0,0,0,"draft")',[user.id,threadId,messageId,user.email,clean(req.body.to),clean(req.body.cc),clean(req.body.bcc),clean(req.body.subject),clean(req.body.body),clean(req.body.html)||null]);
 await writeRecipients(pool,r.insertId,allRecipients(req.body.to,req.body.cc,req.body.bcc));
 res.status(201).json({success:true,id:r.insertId,thread_id:threadId});
}catch(e){next(e)}});

router.patch('/drafts/:id',async(req,res,next)=>{try{
 const fields=['to_address','cc_address','bcc_address','subject','body','body_html'];const map={to_address:clean(req.body.to),cc_address:clean(req.body.cc),bcc_address:clean(req.body.bcc),subject:clean(req.body.subject),body:clean(req.body.body),body_html:clean(req.body.html)||null};
 const sets=[],params=[];for(const f of fields)if(req.body[f.replace('_address','')]!==undefined||f==='body_html'&&req.body.html!==undefined){sets.push(f+'=?');params.push(map[f])}if(!sets.length)return res.status(400).json({success:false,message:'No draft changes supplied'});
 params.push(req.params.id,uid(req));const [r]=await pool.query('UPDATE vexamail_messages SET '+sets.join(',')+' WHERE id=? AND user_id=? AND folder="drafts" AND is_trashed=0',[...params]);if(!r.affectedRows)return res.status(404).json({success:false,message:'Draft not found'});res.json({success:true,id:req.params.id});
}catch(e){next(e)}});

router.patch('/messages/:id/read',async(req,res,next)=>{try{const read=req.body?.read===undefined?true:Boolean(req.body.read);const [r]=await pool.query('UPDATE vexamail_messages SET is_read=? WHERE id=? AND user_id=?',[read?1:0,req.params.id,uid(req)]);if(!r.affectedRows)return res.status(404).json({success:false,message:'Message not found'});res.json({success:true,read})}catch(e){next(e)}});

router.patch('/messages/:id/star',async(req,res,next)=>{try{const starred=req.body?.starred===undefined?true:Boolean(req.body.starred);const [r]=await pool.query('UPDATE vexamail_messages SET starred=? WHERE id=? AND user_id=?',[starred?1:0,req.params.id,uid(req)]);if(!r.affectedRows)return res.status(404).json({success:false,message:'Message not found'});res.json({success:true,starred})}catch(e){next(e)}});

router.patch('/messages/:id/spam',async(req,res,next)=>{try{const spam=req.body?.spam===undefined?true:Boolean(req.body.spam);const [r]=await pool.query('UPDATE vexamail_messages SET is_spam=?,is_trashed=0,deleted_at=NULL WHERE id=? AND user_id=?',[spam?1:0,req.params.id,uid(req)]);if(!r.affectedRows)return res.status(404).json({success:false,message:'Message not found'});res.json({success:true,spam})}catch(e){next(e)}});

router.patch('/messages/:id/trash',async(req,res,next)=>{try{const trash=req.body?.trash===undefined?true:Boolean(req.body.trash);const [r]=await pool.query('UPDATE vexamail_messages SET is_trashed=?,deleted_at=CASE WHEN ?=1 THEN NOW() ELSE NULL END WHERE id=? AND user_id=?',[trash?1:0,trash?1:0,req.params.id,uid(req)]);if(!r.affectedRows)return res.status(404).json({success:false,message:'Message not found'});res.json({success:true,trash})}catch(e){next(e)}});

router.patch('/messages/:id/restore',async(req,res,next)=>{try{const [r]=await pool.query('UPDATE vexamail_messages SET is_trashed=0,is_spam=0,deleted_at=NULL WHERE id=? AND user_id=?',[req.params.id,uid(req)]);if(!r.affectedRows)return res.status(404).json({success:false,message:'Message not found'});res.json({success:true,restored:true})}catch(e){next(e)}});

router.delete('/messages/:id',async(req,res,next)=>{try{const [r]=await pool.query('DELETE FROM vexamail_messages WHERE id=? AND user_id=?',[req.params.id,uid(req)]);if(!r.affectedRows)return res.status(404).json({success:false,message:'Message not found'});res.json({success:true,permanently_deleted:true})}catch(e){next(e)}});

module.exports=router;