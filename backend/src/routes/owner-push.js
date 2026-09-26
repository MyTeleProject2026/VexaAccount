const express=require('express');
const {requireSuperAdmin}=require('../middleware/superAdminAuth');
const push=require('../services/webPush.service');
const router=express.Router();
router.use(requireSuperAdmin);
router.get('/vapid-public-key',(req,res)=>res.json({success:true,enabled:push.available(),publicKey:push.publicKey()}));
router.post('/subscription',async(req,res,next)=>{try{await push.saveSubscription('admin',req.superAdmin.userId,{...req.body?.subscription},{userAgent:req.get('user-agent'),platform:req.body?.platform});res.json({success:true,message:'Owner device notification subscription registered'});}catch(e){next(e)}});
router.delete('/subscription',async(req,res,next)=>{try{const ok=await push.removeSubscription('admin',req.superAdmin.userId,req.body?.endpoint);res.json({success:true,removed:ok});}catch(e){next(e)}});
module.exports=router;
