const express=require('express');
const crypto=require('crypto');
const {pool}=require('../config/database');
const router=express.Router();

function timingSafe(expected,received){
 const a=Buffer.from(String(expected||''));const b=Buffer.from(String(received||''));
 return a.length===b.length&&crypto.timingSafeEqual(a,b);
}
function verify(req){
 const secret=String(process.env.VEXAMAIL_INBOUND_WEBHOOK_SECRET||'');
 if(!secret)return false;
 const raw=JSON.stringify(req.body||{});
 const digest=crypto.createHmac('sha256',secret).update(raw).digest('hex');
 return timingSafe(digest,req.get('x-vexamail-signature')||'');
}
const clean=v=>String(v??'').trim();
function mailboxAddress(v){return clean(v?.Address||v?.address||v).toLowerCase()}
function webhookAllowed(req){
 const expected=String(process.env.VEXAMAIL_BREVO_WEBHOOK_TOKEN||process.env.VEXAMAIL_INBOUND_WEBHOOK_SECRET||'');
 if(!expected)return false;
 return timingSafe(expected,req.get('x-vexamail-brevo-token')||req.get('x-vexamail-webhook-token')||'');
}


router.post('/inbound/brevo',async(req,res,next)=>{
 if(!webhookAllowed(req))return res.status(401).json({success:false,message:'Invalid Brevo inbound webhook token'});
 const items=Array.isArray(req.body?.items)?req.body.items:[];
 if(!items.length)return res.status(202).json({success:true,accepted:0});
 const c=await pool.getConnection();
 try{
  await c.beginTransaction();
  let accepted=0,skipped=0;
  for(const item of items.slice(0,50)){
   const from=mailboxAddress(item.From);
   const tos=[...(Array.isArray(item.Recipients)?item.Recipients:[]),...(Array.isArray(item.To)?item.To:[]),...(Array.isArray(item.Cc)?item.Cc:[])].map(mailboxAddress).filter(Boolean);
   const uniqueTos=[...new Set(tos)];
   const messageId=clean(item.MessageId).slice(0,255)||null;
   if(!from||!uniqueTos.length){skipped++;continue}
   for(const to of uniqueTos){
    const [users]=await c.query('SELECT id FROM store_users WHERE email=? AND is_active=1 LIMIT 1',[to]);
    if(!users.length){skipped++;continue}
    if(messageId){
      const [dupe]=await c.query('SELECT id FROM vexamail_messages WHERE message_id=? AND user_id=? LIMIT 1',[messageId,users[0].id]);
      if(dupe.length){skipped++;continue}
    }
    let threadId=crypto.randomUUID();
    const inReplyTo=clean(item.InReplyTo)||null;
    if(inReplyTo){
      const [thread]=await c.query('SELECT thread_id FROM vexamail_messages WHERE user_id=? AND message_id=? LIMIT 1',[users[0].id,inReplyTo]);
      if(thread.length)threadId=thread[0].thread_id;
    }
    const refs=clean(item.Headers?.References||item.Headers?.references||'')||inReplyTo||null;
    const body=String(item.RawTextBody||item.ExtractedMarkdownMessage||'');
    const html=String(item.RawHtmlBody||'');
    const [result]=await c.query('INSERT INTO vexamail_messages(user_id,thread_id,message_id,from_address,to_address,cc_address,reply_to,subject,body,body_html,folder,is_read,starred,is_trashed,is_spam,delivery_status,provider,provider_message_id,in_reply_to,references_header) VALUES(?,?,?,?,?,?,?,?,?,?,"inbox",0,0,0,0,"delivered","brevo",?,?,?)',[users[0].id,threadId,messageId||('<'+crypto.randomUUID()+'@brevo-inbound>'),from,uniqueTos.join(', '),(Array.isArray(item.Cc)?item.Cc.map(mailboxAddress).filter(Boolean).join(', '):''),mailboxAddress(item.ReplyTo),clean(item.Subject),body,html||null,messageId,inReplyTo,refs]);
    await c.query('INSERT INTO vexamail_delivery_events(message_id,provider,provider_message_id,event_type,recipient,payload) VALUES(?,"brevo",?,"inbound",?,?)',[result.insertId,messageId,to,JSON.stringify({uuid:item.Uuid||null,spam_score:item.SpamScore??null})]);
    for(const a of (Array.isArray(item.Attachments)?item.Attachments:[]).slice(0,25)){
      const token=clean(a.DownloadToken);
      if(!token)continue;
      await c.query('INSERT INTO vexamail_attachments(message_id,filename,content_type,size_bytes,storage_key,content_id,is_inline) VALUES(?,?,?,?,?,?,?)',[result.insertId,clean(a.Name)||'attachment',clean(a.ContentType)||'application/octet-stream',Math.max(0,Number(a.ContentLength)||0),'brevo://'+token,clean(a.ContentID)||null,Boolean(a.ContentID)?1:0]);
    }
    accepted++;
   }
  }
  await c.commit();
  res.status(202).json({success:true,accepted,skipped});
 }catch(e){try{await c.rollback()}catch{}next(e)}finally{c.release()}
});

router.post('/inbound',async(req,res,next)=>{
 if(!verify(req))return res.status(401).json({success:false,message:'Invalid inbound webhook signature'});
 const c=await pool.getConnection();
 try{
  const to=clean(req.body.to).toLowerCase();
  const from=clean(req.body.from).toLowerCase();
  const subject=clean(req.body.subject);
  const body=String(req.body.text||req.body.body||'');
  const html=String(req.body.html||'');
  const provider=clean(req.body.provider||'generic').slice(0,64);
  const providerMessageId=clean(req.body.message_id||req.body.messageId).slice(0,255)||null;
  if(!to||!from)return res.status(400).json({success:false,message:'to and from are required'});
  const [users]=await c.query('SELECT id FROM store_users WHERE email=? AND is_active=1 LIMIT 1',[to]);
  if(!users.length)return res.status(202).json({success:true,accepted:false,reason:'mailbox_not_found'});
  const userId=users[0].id;
  const threadId=clean(req.body.thread_id||req.body.threadId)||crypto.randomUUID();
  await c.beginTransaction();
  const [result]=await c.query('INSERT INTO vexamail_messages(user_id,thread_id,from_address,to_address,subject,body,folder,is_read,starred,is_trashed,is_spam,created_at) VALUES(?,?, ?,?,?,?, "inbox",0,0,0,0,NOW())',[userId,threadId,from,to,subject,body||html]);
  await c.query('INSERT INTO vexamail_delivery_events(message_id,provider,provider_message_id,event_type,recipient,payload) VALUES(?,?,?,?,?,?)',[result.insertId,provider,providerMessageId,'inbound',to,JSON.stringify({subject,has_html:Boolean(html),headers:req.body.headers||null})]);
  if(Array.isArray(req.body.attachments)){
   for(const a of req.body.attachments.slice(0,25)){
    const storageKey=clean(a.storage_key||a.storageKey);
    if(!storageKey)continue;
    await c.query('INSERT INTO vexamail_attachments(message_id,filename,content_type,size_bytes,storage_key,content_id,is_inline) VALUES(?,?,?,?,?,?,?)',[result.insertId,clean(a.filename)||'attachment',clean(a.content_type||a.contentType)||'application/octet-stream',Math.max(0,Number(a.size_bytes||a.sizeBytes)||0),storageKey,clean(a.content_id||a.contentId)||null,a.inline?1:0]);
   }
  }
  await c.commit();
  res.status(201).json({success:true,accepted:true,message_id:result.insertId});
 }catch(e){try{await c.rollback()}catch{}next(e)}finally{c.release()}
});
module.exports=router;