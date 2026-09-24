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

async function messageAttachments(messageId,userId){
 const [rows]=await pool.query(
  'SELECT a.filename,a.content_type,a.storage_key,a.content_id,a.is_inline FROM vexamail_attachments a JOIN vexamail_messages m ON m.id=a.message_id WHERE a.message_id=? AND m.user_id=? ORDER BY a.id ASC',
  [messageId,userId]
 );
 return rows.map(a=>({
   filename:a.filename,
   href:a.storage_key,
   contentType:a.content_type,
   cid:a.content_id||undefined,
   contentDisposition:a.is_inline?'inline':'attachment'
 }));
}

async function nextReferences(connection,threadId,userId,inReplyTo){
 const [rows]=await connection.query(
  'SELECT message_id,references_header FROM vexamail_messages WHERE user_id=? AND thread_id=? AND deleted_at IS NULL ORDER BY created_at ASC',
  [userId,threadId]
 );
 const refs=[];
 for(const r of rows){
   if(r.message_id) refs.push(r.message_id);
   if(r.references_header) refs.push(...String(r.references_header).split(/\s+/).filter(Boolean));
 }
 if(inReplyTo) refs.push(inReplyTo);
 return [...new Set(refs)].join(' ');
}

async function createInternalCopy(connection,{recipientUserId,threadId,from,to,cc,subject,body,html,inReplyTo,references}){
 const internalId='<'+crypto.randomUUID()+'@internal.vexamail>';
 const [r]=await connection.query(
  'INSERT INTO vexamail_messages(user_id,thread_id,message_id,from_address,to_address,cc_address,subject,body,body_html,folder,is_read,starred,is_trashed,is_spam,delivery_status,provider,in_reply_to,references_header,created_at) VALUES(?,?,?,?,?,?,?,?,?,"inbox",0,0,0,0,"delivered","internal",?,?,NOW())',
  [recipientUserId,threadId,internalId,from,to,cc,subject,body,html||null,inReplyTo||null,references||null]
 );
 return r.insertId;
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

router.post('/send',async(req,res,next)=>{const c=await pool.getConnection();try{
 const userId=uid(req),user=await currentUser(userId,c);if(!user)return res.status(401).json({success:false,message:'Active VexaAccount session required'});
 const to=clean(req.body.to),cc=clean(req.body.cc),bcc=clean(req.body.bcc),subject=clean(req.body.subject),body=clean(req.body.body),html=clean(req.body.html);
 const recipients=allRecipients(to,cc,bcc);
 if(!recipients.length||!body)return res.status(400).json({success:false,message:'At least one recipient and a message body are required'});
 const threadId=clean(req.body.thread_id)||crypto.randomUUID();
 const rfcMessageId=clean(req.body.message_id)||'<'+crypto.randomUUID()+'@vexamail>';
 const inReplyTo=clean(req.body.in_reply_to)||null;
 const references=clean(req.body.references_header)||await nextReferences(c,threadId,userId,inReplyTo);
 const [result]=await c.query('INSERT INTO vexamail_messages(user_id,thread_id,message_id,from_address,to_address,cc_address,bcc_address,reply_to,subject,body,body_html,folder,is_read,starred,is_trashed,is_spam,delivery_status,provider,in_reply_to,references_header) VALUES(?,?,?,?,?,?,?,?,?,?,?,"sent",1,0,0,0,"queued","brevo",?,?)',[userId,threadId,rfcMessageId,user.email,splitAddresses(to).join(', '),splitAddresses(cc).join(', '),splitAddresses(bcc).join(', '),clean(req.body.reply_to),subject,body,html||null,inReplyTo,references||null]);
 const messageId=result.insertId;
 await writeRecipients(c,messageId,recipients);
 const attachments=await messageAttachments(messageId,userId);
 let sent=0,failed=0,providerMessageId=null;
 const externalTo=splitAddresses(to),externalCc=splitAddresses(cc),externalBcc=splitAddresses(bcc);
 try{
   const info=await sendEmail({to:externalTo,cc:externalCc,bcc:externalBcc,subject:subject||'(no subject)',text:body,html:html||'<div style="font-family:Arial,sans-serif;line-height:1.6">'+esc(body).replace(/\n/g,'<br>')+'</div>',replyTo:clean(req.body.reply_to)||user.email,messageId:rfcMessageId,inReplyTo,references,attachments});
   providerMessageId=info.messageId||null;
   sent=recipients.length;
 }catch(error){failed=recipients.length;console.error('VexaMail outbound send failed:',error.message||error)}
 const status=failed===0?'sent':'failed';
 await c.beginTransaction();
 await c.query('UPDATE vexamail_messages SET delivery_status=?,provider_message_id=? WHERE id=?',[status,providerMessageId,messageId]);
 for(const r of recipients){
   await c.query('UPDATE vexamail_recipients SET delivery_status=? WHERE message_id=? AND email=?',[failed?'failed':'sent',messageId,r.email]);
   await c.query('INSERT INTO vexamail_delivery_events(message_id,provider,provider_message_id,event_type,recipient,payload) VALUES(?,"brevo",?,?,?,?)',[messageId,providerMessageId,failed?'failed':'sent',r.email,JSON.stringify({message_id:rfcMessageId})]);
 }
 if(sent>0){
   for(const r of recipients.filter(x=>x.type!=='bcc')){
     const [users]=await c.query('SELECT id FROM store_users WHERE email=? AND is_active=1 LIMIT 1',[r.email]);
     if(users.length&&Number(users[0].id)!==Number(userId)){
       await createInternalCopy(c,{recipientUserId:users[0].id,threadId,from:user.email,to:splitAddresses(to).join(', '),cc:splitAddresses(cc).join(', '),subject,body,html,inReplyTo:rfcMessageId,references:[references,rfcMessageId].filter(Boolean).join(' ')});
     }
   }
 }
 await c.commit();
 res.status(failed?502:201).json({success:!failed,message:failed?'Message delivery failed':'Message sent',id:messageId,thread_id:threadId,delivery_status:status,sent,failed,provider_message_id:providerMessageId});
}catch(e){try{await c.rollback()}catch{}next(e)}finally{c.release()}});


router.post('/drafts',async(req,res,next)=>{try{
 const user=await currentUser(uid(req));if(!user)return res.status(401).json({success:false,message:'Active VexaAccount session required'});
 const threadId=clean(req.body.thread_id)||crypto.randomUUID(),messageId='<'+crypto.randomUUID()+'@vexamail>';
 const [r]=await pool.query('INSERT INTO vexamail_messages(user_id,thread_id,message_id,from_address,to_address,cc_address,bcc_address,subject,body,body_html,folder,is_read,starred,is_trashed,is_spam,delivery_status) VALUES(?,?,?,?,?,?,?,?,?,?, "drafts",1,0,0,0,"draft")',[user.id,threadId,messageId,user.email,clean(req.body.to),clean(req.body.cc),clean(req.body.bcc),clean(req.body.subject),clean(req.body.body),clean(req.body.html)||null]);
 await writeRecipients(pool,r.insertId,allRecipients(req.body.to,req.body.cc,req.body.bcc));
 res.status(201).json({success:true,id:r.insertId,thread_id:threadId});
}catch(e){next(e)}});

router.post('/drafts/:id/send',async(req,res,next)=>{try{
 const userId=uid(req),user=await currentUser(userId);if(!user)return res.status(401).json({success:false,message:'Active VexaAccount session required'});
 const [rows]=await pool.query('SELECT * FROM vexamail_messages WHERE id=? AND user_id=? AND folder="drafts" AND is_trashed=0 LIMIT 1',[req.params.id,userId]);
 if(!rows.length)return res.status(404).json({success:false,message:'Draft not found'});
 const d=rows[0];
 const attachments=await messageAttachments(d.id,userId);
 const recipients=allRecipients(d.to_address,d.cc_address,d.bcc_address);
 if(!recipients.length||!clean(d.body))return res.status(400).json({success:false,message:'Draft needs at least one recipient and a message body'});
 const inReplyTo=clean(d.in_reply_to)||null,references=clean(d.references_header)||null;
 let info;
 try{
   info=await sendEmail({to:splitAddresses(d.to_address),cc:splitAddresses(d.cc_address),bcc:splitAddresses(d.bcc_address),subject:d.subject||'(no subject)',text:d.body,html:d.body_html||'<div style="font-family:Arial,sans-serif;line-height:1.6">'+esc(d.body).replace(/\n/g,'<br>')+'</div>',replyTo:clean(d.reply_to)||user.email,messageId:d.message_id,inReplyTo,references,attachments});
 }catch(error){
   await pool.query('UPDATE vexamail_messages SET delivery_status="failed" WHERE id=? AND user_id=?',[d.id,userId]);
   return res.status(502).json({success:false,message:'Draft delivery failed',error:String(error.message||error)});
 }
 await pool.query('UPDATE vexamail_messages SET folder="sent",delivery_status="sent",provider="brevo",provider_message_id=? WHERE id=? AND user_id=?',[info.messageId||null,d.id,userId]);
 await pool.query('UPDATE vexamail_recipients SET delivery_status="sent" WHERE message_id=?',[d.id]);
 res.json({success:true,message:'Draft sent',id:d.id,thread_id:d.thread_id,provider_message_id:info.messageId||null});
}catch(e){next(e)}});

router.patch('/drafts/:id',async(req,res,next)=>{try{
 const fields=['to_address','cc_address','bcc_address','subject','body','body_html'];const map={to_address:clean(req.body.to),cc_address:clean(req.body.cc),bcc_address:clean(req.body.bcc),subject:clean(req.body.subject),body:clean(req.body.body),body_html:clean(req.body.html)||null};
 const sets=[],params=[];for(const f of fields)if(req.body[f.replace('_address','')]!==undefined||f==='body_html'&&req.body.html!==undefined){sets.push(f+'=?');params.push(map[f])}if(!sets.length)return res.status(400).json({success:false,message:'No draft changes supplied'});
 params.push(req.params.id,uid(req));const [r]=await pool.query('UPDATE vexamail_messages SET '+sets.join(',')+' WHERE id=? AND user_id=? AND folder="drafts" AND is_trashed=0',[...params]);if(!r.affectedRows)return res.status(404).json({success:false,message:'Draft not found'});res.json({success:true,id:req.params.id});
}catch(e){next(e)}});

router.post('/messages/:id/reply',async(req,res,next)=>{try{
 const userId=uid(req),user=await currentUser(userId);if(!user)return res.status(401).json({success:false,message:'Active VexaAccount session required'});
 const [rows]=await pool.query('SELECT * FROM vexamail_messages WHERE id=? AND user_id=? AND deleted_at IS NULL LIMIT 1',[req.params.id,userId]);
 if(!rows.length)return res.status(404).json({success:false,message:'Message not found'});
 const m=rows[0],to=clean(req.body.to)||clean(m.from_address),subject=clean(req.body.subject)||(/^re:/i.test(m.subject)?m.subject:'Re: '+m.subject),body=clean(req.body.body),threadId=m.thread_id;
 if(!body)return res.status(400).json({success:false,message:'Reply body is required'});
 req.body={...req.body,to,cc:'',bcc:'',subject,body,html:clean(req.body.html),thread_id:threadId,in_reply_to:m.message_id,references_header:[m.references_header,m.message_id].filter(Boolean).join(' '),reply_to:user.email};
 return router.handle(req,res,next);
}catch(e){next(e)}});

router.post('/messages/:id/reply-all',async(req,res,next)=>{try{
 const userId=uid(req),user=await currentUser(userId);if(!user)return res.status(401).json({success:false,message:'Active VexaAccount session required'});
 const [rows]=await pool.query('SELECT * FROM vexamail_messages WHERE id=? AND user_id=? AND deleted_at IS NULL LIMIT 1',[req.params.id,userId]);
 if(!rows.length)return res.status(404).json({success:false,message:'Message not found'});
 const m=rows[0],to=[m.from_address,m.to_address].filter(Boolean).join(', '),cc=clean(m.cc_address),subject=clean(req.body.subject)||(/^re:/i.test(m.subject)?m.subject:'Re: '+m.subject),body=clean(req.body.body);
 if(!body)return res.status(400).json({success:false,message:'Reply body is required'});
 const uniqueTo=[...new Set(splitAddresses(to).filter(x=>x!==user.email))].join(', ');
 const uniqueCc=[...new Set(splitAddresses(cc).filter(x=>x!==user.email&&!splitAddresses(uniqueTo).includes(x)))].join(', ');
 req.body={...req.body,to:uniqueTo,cc:uniqueCc,bcc:'',subject,body,html:clean(req.body.html),thread_id:m.thread_id,in_reply_to:m.message_id,references_header:[m.references_header,m.message_id].filter(Boolean).join(' '),reply_to:user.email};
 return router.handle(req,res,next);
}catch(e){next(e)}});

router.post('/messages/:id/forward',async(req,res,next)=>{try{
 const userId=uid(req),user=await currentUser(userId);if(!user)return res.status(401).json({success:false,message:'Active VexaAccount session required'});
 const [rows]=await pool.query('SELECT * FROM vexamail_messages WHERE id=? AND user_id=? AND deleted_at IS NULL LIMIT 1',[req.params.id,userId]);
 if(!rows.length)return res.status(404).json({success:false,message:'Message not found'});
 const m=rows[0],to=clean(req.body.to),subject=clean(req.body.subject)||(/^fwd:/i.test(m.subject)?m.subject:'Fwd: '+m.subject),body=clean(req.body.body)+'\n\n---------- Forwarded message ----------\nFrom: '+m.from_address+'\nDate: '+m.created_at+'\nSubject: '+m.subject+'\nTo: '+m.to_address+'\n\n'+m.body;
 if(!splitAddresses(to).length)return res.status(400).json({success:false,message:'Forward recipient is required'});
 req.body={...req.body,to,cc:clean(req.body.cc),bcc:clean(req.body.bcc),subject,body,html:clean(req.body.html),thread_id:crypto.randomUUID(),reply_to:user.email};
 return router.handle(req,res,next);
}catch(e){next(e)}});

router.patch('/messages/:id/read',async(req,res,next)=>{try{const read=req.body?.read===undefined?true:Boolean(req.body.read);const [r]=await pool.query('UPDATE vexamail_messages SET is_read=? WHERE id=? AND user_id=?',[read?1:0,req.params.id,uid(req)]);if(!r.affectedRows)return res.status(404).json({success:false,message:'Message not found'});res.json({success:true,read})}catch(e){next(e)}});

router.patch('/messages/:id/star',async(req,res,next)=>{try{const starred=req.body?.starred===undefined?true:Boolean(req.body.starred);const [r]=await pool.query('UPDATE vexamail_messages SET starred=? WHERE id=? AND user_id=?',[starred?1:0,req.params.id,uid(req)]);if(!r.affectedRows)return res.status(404).json({success:false,message:'Message not found'});res.json({success:true,starred})}catch(e){next(e)}});

router.patch('/messages/:id/spam',async(req,res,next)=>{try{const spam=req.body?.spam===undefined?true:Boolean(req.body.spam);const [r]=await pool.query('UPDATE vexamail_messages SET is_spam=?,is_trashed=0,deleted_at=NULL WHERE id=? AND user_id=?',[spam?1:0,req.params.id,uid(req)]);if(!r.affectedRows)return res.status(404).json({success:false,message:'Message not found'});res.json({success:true,spam})}catch(e){next(e)}});

router.patch('/messages/:id/trash',async(req,res,next)=>{try{const trash=req.body?.trash===undefined?true:Boolean(req.body.trash);const [r]=await pool.query('UPDATE vexamail_messages SET is_trashed=?,deleted_at=CASE WHEN ?=1 THEN NOW() ELSE NULL END WHERE id=? AND user_id=?',[trash?1:0,trash?1:0,req.params.id,uid(req)]);if(!r.affectedRows)return res.status(404).json({success:false,message:'Message not found'});res.json({success:true,trash})}catch(e){next(e)}});

router.patch('/messages/:id/restore',async(req,res,next)=>{try{const [r]=await pool.query('UPDATE vexamail_messages SET is_trashed=0,is_spam=0,deleted_at=NULL WHERE id=? AND user_id=?',[req.params.id,uid(req)]);if(!r.affectedRows)return res.status(404).json({success:false,message:'Message not found'});res.json({success:true,restored:true})}catch(e){next(e)}});

router.delete('/messages/:id',async(req,res,next)=>{try{const [r]=await pool.query('DELETE FROM vexamail_messages WHERE id=? AND user_id=?',[req.params.id,uid(req)]);if(!r.affectedRows)return res.status(404).json({success:false,message:'Message not found'});res.json({success:true,permanently_deleted:true})}catch(e){next(e)}});

module.exports=router;