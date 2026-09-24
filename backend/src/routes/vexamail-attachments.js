const express=require('express');const {pool}=require('../config/database');const {authUser}=require('../middleware/auth');const router=express.Router();router.use(authUser);const uid=req=>req.user.id||req.user.sub;
router.get('/messages/:id/attachments',async(req,res,next)=>{try{
 const [rows]=await pool.query('SELECT id,filename,content_type,size_bytes,storage_key,content_id,is_inline,created_at FROM vexamail_attachments a JOIN vexamail_messages m ON m.id=a.message_id WHERE a.message_id=? AND m.user_id=? ORDER BY a.id ASC',[req.params.id,uid(req)]);
 res.json({success:true,attachments:rows});
}catch(e){next(e)}});
module.exports=router;