const express=require('express');
const crypto=require('crypto');
const axios=require('axios');
const {pool}=require('../config/database');
const {authUser}=require('../middleware/auth');
const router=express.Router();
router.use(authUser);
const uid=req=>req.user.id||req.user.sub;
const clean=v=>String(v??'').trim();
function cloudinary(){const cloud=clean(process.env.CLOUDINARY_CLOUD_NAME),key=clean(process.env.CLOUDINARY_API_KEY),secret=clean(process.env.CLOUDINARY_API_SECRET);if(!cloud||!key||!secret)throw Error('Cloudinary is not configured');return{cloud,key,secret}}
function sign(params,secret){return crypto.createHash('sha1').update(Object.keys(params).filter(k=>params[k]!==undefined&&params[k]!==null&&params[k]!==''&&k!=='file'&&k!=='api_key').sort().map(k=>`${k}=${params[k]}`).join('&')+secret).digest('hex')}
function dataUrlParts(value){const m=String(value||'').match(/^data:([^;]+);base64,(.+)$/s);return m?{contentType:m[1],data:m[2]}:null}

router.get('/messages/:id/attachments',async(req,res,next)=>{try{
 const [rows]=await pool.query('SELECT a.id,a.filename,a.content_type,a.size_bytes,a.storage_key,a.content_id,a.is_inline,a.created_at FROM vexamail_attachments a JOIN vexamail_messages m ON m.id=a.message_id WHERE a.message_id=? AND m.user_id=? ORDER BY a.id ASC',[req.params.id,uid(req)]);
 res.json({success:true,attachments:rows});
}catch(e){next(e)}});

router.post('/attachments/upload',async(req,res,next)=>{try{
 const messageId=Number(req.body?.message_id||req.body?.messageId),filename=clean(req.body?.filename).slice(0,255),contentId=clean(req.body?.content_id||req.body?.contentId).slice(0,255)||null,inline=Boolean(req.body?.inline),input=dataUrlParts(req.body?.dataUrl);
 if(!messageId||!filename||!input)return res.status(400).json({success:false,message:'message_id, filename and a base64 dataUrl are required'});
 const [owned]=await pool.query('SELECT id FROM vexamail_messages WHERE id=? AND user_id=? LIMIT 1',[messageId,uid(req)]);if(!owned.length)return res.status(404).json({success:false,message:'Message not found'});
 if(!/^((image|video|audio|text|application)\/[a-z0-9.+-]+)$/i.test(input.contentType))return res.status(400).json({success:false,message:'Unsupported attachment content type'});
 const raw=Buffer.from(input.data,'base64');if(!raw.length)return res.status(400).json({success:false,message:'Attachment is empty'});if(raw.length>10*1024*1024)return res.status(413).json({success:false,message:'Attachment exceeds 10 MB'});
 const {cloud,key,secret}=cloudinary(),timestamp=Math.floor(Date.now()/1000),folder=`vexamail/users/${uid(req)}/messages/${messageId}`,params={folder,timestamp},signature=sign(params,secret);
 const endpoint=`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/auto/upload`;
 const body=new URLSearchParams({file:`data:${input.contentType};base64,${input.data}`,folder,timestamp:String(timestamp),api_key:key,signature});
 const {data}=await axios.post(endpoint,body.toString(),{headers:{'Content-Type':'application/x-www-form-urlencoded'},maxContentLength:12*1024*1024,maxBodyLength:12*1024*1024,timeout:30000});
 const storageKey=clean(data.secure_url||data.url||data.public_id);if(!storageKey)throw Error('Storage provider did not return a file URL');
 const [r]=await pool.query('INSERT INTO vexamail_attachments(message_id,filename,content_type,size_bytes,storage_key,content_id,is_inline) VALUES(?,?,?,?,?,?,?)',[messageId,filename,input.contentType,raw.length,storageKey,contentId,inline?1:0]);
 res.status(201).json({success:true,attachment:{id:r.insertId,filename,content_type:input.contentType,size_bytes:raw.length,url:storageKey,content_id:contentId,is_inline:inline}});
}catch(e){next(e)}});

router.get('/attachments/:id',async(req,res,next)=>{try{
 const [rows]=await pool.query('SELECT a.storage_key,a.filename,a.content_type FROM vexamail_attachments a JOIN vexamail_messages m ON m.id=a.message_id WHERE a.id=? AND m.user_id=? LIMIT 1',[req.params.id,uid(req)]);
 if(!rows.length)return res.status(404).json({success:false,message:'Attachment not found'});
 const a=rows[0];
 if(a.storage_key.startsWith('brevo://')){
   const token=a.storage_key.slice('brevo://'.length);
   const apiKey=clean(process.env.BREVO_API_KEY);
   if(!apiKey)return res.status(503).json({success:false,message:'Brevo API key is not configured'});
   const response=await axios.get('https://api.brevo.com/v3/inbound/attachments/'+encodeURIComponent(token),{headers:{'api-key':apiKey},responseType:'stream',timeout:30000});
   res.setHeader('Content-Type',a.content_type||response.headers['content-type']||'application/octet-stream');
   res.setHeader('Content-Disposition','attachment; filename="'+a.filename.replace(/["\\\r\n]/g,'_')+'"');
   if(response.headers['content-length'])res.setHeader('Content-Length',response.headers['content-length']);
   return response.data.pipe(res);
 }
 res.json({success:true,attachment:{url:a.storage_key,filename:a.filename,content_type:a.content_type}});
}catch(e){next(e)}});

router.delete('/attachments/:id',async(req,res,next)=>{try{
 const [r]=await pool.query('DELETE a FROM vexamail_attachments a JOIN vexamail_messages m ON m.id=a.message_id WHERE a.id=? AND m.user_id=?',[req.params.id,uid(req)]);
 if(!r.affectedRows)return res.status(404).json({success:false,message:'Attachment not found'});
 res.json({success:true,deleted:true});
}catch(e){next(e)}});

module.exports=router;