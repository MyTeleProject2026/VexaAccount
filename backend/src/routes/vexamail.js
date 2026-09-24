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
const folderWhere=(folder)=>{
 const map={
  inbox:'folder="inbox" AND is_trashed=0 AND is_spam=0',
  sent:'folder="sent" AND is_trashed=0',
  drafts:'folder="drafts" AND is_trashed=0',
  starred:'starred=1 AND is_trashed=0 AND is_spam=0',
  trash:'is_trashed=1',
  spam:'is_spam=1'
 };
 return map[folder];
};
router.get('/messages',async(req,res,next)=>{try{
 const folder=clean(req.query.folder||'inbox').toLowerCase(),userId=uid(req);
 if(!folderWhere(folder))return res.status(400).json({success:false,message:'Invalid mailbox folder'});
 const q=clean(req.query.q||'').toLowerCase();
 let where='user_id=? AND deleted_at IS NULL AND '+folderWhere(folder),params=[userId];
 if(q){where+=' AND (LOWER(subject) LIKE ? OR LOWER(from_address) LIKE ? OR LOWER(to_address) LIKE ? OR LOWER(body) LIKE ?)';const x='%'+q+'%';params.push(x,x,x,x)}
 const [rows]=await pool.query(`SELECT id,thread_id,from_address AS \`from\`,to_address AS \`to\`,subject,body,folder,is_read AS \`read\`,starred,is_trashed,is_spam,DATE_FORMAT(created_at,'%Y-%m-%d %H:%i') AS date FROM vexamail_messages WHERE ${where} ORDER BY created_at DESC LIMIT 200`,params);
 res.json({success:true,messages:rows.map(m=>({...m,unread:!m.read,preview:clean(m.body).slice(0,180)}))});
}catch(e){next(e)}});

router.post('/send',async(req,res,next)=>{const c=await pool.getConnection();try{
 const userId=uid(req),to=clean(req.body.to).toLowerCase(),subject=clean(req.body.subject),body=clean(req.body.body);
 if(!to||!body)return res.status(400).json({success:false,message:'Recipient and message are required'});
 const [u]=await c.query('SELECT email,name FROM store_users WHERE id=? AND is_active=1 LIMIT 1',[userId]);
 if(!u.length)return res.status(401).json({success:false,message:'Active VexaAccount session required'});
 const from=clean(u[0].email).toLowerCase(),threadId=crypto.randomUUID();
 const [recipient]=await c.query('SELECT id,email,name FROM store_users WHERE email=? AND is_active=1 LIMIT 1',[to]);
 await sendEmail({to,subject:subject||'(no subject)',html:'<div style="font-family:Arial,sans-serif;line-height:1.6">'+esc(body).replace(/\n/g,'<br>')+'</div>'});
 await c.beginTransaction();
 await c.query('INSERT INTO vexamail_messages(user_id,thread_id,from_address,to_address,subject,body,folder,is_read,starred,is_trashed,is_spam,created_at) VALUES(?,?, ?,?,?,?, "sent",1,0,0,0,NOW())',[userId,threadId,from,to,subject,body]);
 if(recipient.length && Number(recipient[0].id)!==Number(userId)){
  await c.query('INSERT INTO vexamail_messages(user_id,thread_id,from_address,to_address,subject,body,folder,is_read,starred,is_trashed,is_spam,created_at) VALUES(?,?, ?,?,?,?, "inbox",0,0,0,0,NOW())',[recipient[0].id,threadId,from,to,subject,body]);
 }
 await c.commit();
 res.json({success:true,message:'Message sent',thread_id:threadId,delivered_internally:Boolean(recipient.length && Number(recipient[0].id)!==Number(userId))});
}catch(e){try{await c.rollback()}catch{}next(e)}finally{c.release()}});

router.post('/drafts',async(req,res,next)=>{try{
 const to=clean(req.body.to),subject=clean(req.body.subject),body=clean(req.body.body),userId=uid(req);
 const [u]=await pool.query('SELECT email FROM store_users WHERE id=? AND is_active=1 LIMIT 1',[userId]);
 if(!u.length)return res.status(401).json({success:false,message:'Active VexaAccount session required'});
 const [r]=await pool.query('INSERT INTO vexamail_messages(user_id,thread_id,from_address,to_address,subject,body,folder,is_read,starred,is_trashed,is_spam) VALUES(?,?,?, ?,?,?, "drafts",1,0,0,0)',[userId,crypto.randomUUID(),u[0].email,to,subject,body]);
 res.status(201).json({success:true,id:r.insertId});
}catch(e){next(e)}});

router.patch('/messages/:id/read',async(req,res,next)=>{try{const read=req.body?.read===undefined?true:Boolean(req.body.read);const [r]=await pool.query('UPDATE vexamail_messages SET is_read=? WHERE id=? AND user_id=?',[read?1:0,req.params.id,uid(req)]);if(!r.affectedRows)return res.status(404).json({success:false,message:'Message not found'});res.json({success:true,read})}catch(e){next(e)}});

router.patch('/messages/:id/star',async(req,res,next)=>{try{const starred=req.body?.starred===undefined?true:Boolean(req.body.starred);const [r]=await pool.query('UPDATE vexamail_messages SET starred=? WHERE id=? AND user_id=?',[starred?1:0,req.params.id,uid(req)]);if(!r.affectedRows)return res.status(404).json({success:false,message:'Message not found'});res.json({success:true,starred})}catch(e){next(e)}});

router.patch('/messages/:id/spam',async(req,res,next)=>{try{const spam=req.body?.spam===undefined?true:Boolean(req.body.spam);const [r]=await pool.query('UPDATE vexamail_messages SET is_spam=?,is_trashed=0 WHERE id=? AND user_id=?',[spam?1:0,req.params.id,uid(req)]);if(!r.affectedRows)return res.status(404).json({success:false,message:'Message not found'});res.json({success:true,spam})}catch(e){next(e)}});

router.patch('/messages/:id/trash',async(req,res,next)=>{try{const trash=req.body?.trash===undefined?true:Boolean(req.body.trash);const [r]=await pool.query('UPDATE vexamail_messages SET is_trashed=?,deleted_at=CASE WHEN ?=1 THEN NOW() ELSE NULL END WHERE id=? AND user_id=?',[trash?1:0,trash?1:0,req.params.id,uid(req)]);if(!r.affectedRows)return res.status(404).json({success:false,message:'Message not found'});res.json({success:true,trash})}catch(e){next(e)}});

router.delete('/messages/:id',async(req,res,next)=>{try{const [r]=await pool.query('DELETE FROM vexamail_messages WHERE id=? AND user_id=?',[req.params.id,uid(req)]);if(!r.affectedRows)return res.status(404).json({success:false,message:'Message not found'});res.json({success:true,permanently_deleted:true})}catch(e){next(e)}});

router.post('/logout',async(req,res,next)=>{try{res.json({success:true})}catch(e){next(e)}});
module.exports=router;