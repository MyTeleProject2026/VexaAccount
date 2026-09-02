const express=require('express');const jwt=require('jsonwebtoken');const {pool}=require('../config/database');const router=express.Router();const JWT_SECRET=process.env.JWT_SECRET;
function auth(req,res,next){try{const h=req.get('authorization')||'';const t=h.startsWith('Bearer ')?h.slice(7).trim():req.cookies?.vexaccount_session;if(!t)return res.status(401).json({success:false,message:'Authentication required'});const c=jwt.verify(t,JWT_SECRET),id=c.sub||c.id;if(c.role!=='user'||!id)return res.status(401).json({success:false,message:'User authentication required'});req.userId=id;next()}catch{return res.status(401).json({success:false,message:'Invalid or expired session'})}}
router.use(auth);
router.get('/',async(req,res,next)=>{try{const [[u],[s],[a]] = await Promise.all([
 pool.query('SELECT is_verified,twofa_enabled,email_2fa_enabled,passcode_enabled,phone FROM store_users WHERE id=? LIMIT 1',[req.userId]),
 pool.query('SELECT two_factor_enabled,security_notifications_enabled FROM vexa_account_security_settings WHERE user_id=? LIMIT 1',[req.userId]),
 pool.query('SELECT recovery_email FROM vexa_account_center_settings WHERE user_id=? LIMIT 1',[req.userId])
 ]);const user=u[0]||{};const sec=s[0]||{};const acc=a[0]||{};const checks=[
 ['email',Number(user.is_verified)===1,20],
 ['password',true,20],
 ['two_factor',Number(user.twofa_enabled)===1||Number(user.email_2fa_enabled)===1||Number(sec.two_factor_enabled)===1,25],
 ['passcode',Number(user.passcode_enabled)===1,10],
 ['recovery_email',Boolean(acc.recovery_email),15],
 ['phone',Boolean(user.phone),10]
 ];const score=checks.reduce((n,x)=>n+(x[1]?x[2]:0),0);res.json({success:true,score,checks:Object.fromEntries(checks.map(x=>[x[0],x[1]])),security:{two_factor_enabled:Boolean(checks[2][1]),passcode_enabled:Number(user.passcode_enabled)===1,recovery_email_configured:Boolean(acc.recovery_email),phone_configured:Boolean(user.phone),verified:Boolean(user.is_verified)}})}catch(e){next(e)}});
module.exports=router;
