const express=require('express');
const {authUser}=require('../middleware/auth');
const push=require('../services/webPush.service');
const router=express.Router();
router.use(authUser);
router.get('/vapid-public-key',(req,res)=>res.json({success:true,enabled:push.available(),publicKey:push.publicKey()}));
router.post('/subscription',async(req,res,next)=>{try{await push.saveSubscription('user',req.user.id||req.user.sub,req.body?.subscription,{userAgent:req.get('user-agent'),platform:req.body?.platform});res.json({success:true,message:'Device notification subscription registered'});}catch(e){next(e)}});
router.delete('/subscription',async(req,res,next)=>{try{const ok=await push.removeSubscription('user',req.user.id||req.user.sub,req.body?.endpoint);res.json({success:true,removed:ok});}catch(e){next(e)}});
module.exports=router;
