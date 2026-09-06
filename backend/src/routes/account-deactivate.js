const express=require('express');
const jwt=require('jsonwebtoken');
const bcrypt=require('bcryptjs');
const {pool}=require('../config/database');
const router=express.Router();
const JWT_SECRET=process.env.JWT_SECRET;
function uid(req){const h=req.get('authorization')||'';const t=h.startsWith('Bearer ')?h.slice(7).trim():req.cookies?.vexaccount_session;if(!t)throw Object.assign(new Error('Authentication required'),{status:401});const d=jwt.verify(t,JWT_SECRET);if(d.role!=='user')throw Object.assign(new Error('User access required'),{status:403});return d.id||d.sub;}
router.post('/deactivate',async(req,res,next)=>{try{
 const id=uid(req),password=String(req.body?.password||'');
 if(!password)return res.status(400).json({success:false,message:'Current password is required to deactivate your account'});
 const [u]=await pool.query('SELECT password FROM store_users WHERE id=? AND is_active=1 LIMIT 1',[id]);
 if(!u.length)return res.status(404).json({success:false,message:'Active account not found'});
 if(!await bcrypt.compare(password,u[0].password))return res.status(401).json({success:false,message:'Current password is incorrect'});
 const conn=await pool.getConnection();
 try{await conn.beginTransaction();const [r]=await conn.query('UPDATE store_users SET is_active=0, session_version=COALESCE(session_version,1)+1 WHERE id=? AND is_active=1',[id]);if(!r.affectedRows)throw Object.assign(new Error('Active account not found'),{status:404});await conn.query('UPDATE sso_sessions SET revoked_at=NOW() WHERE user_id=? AND revoked_at IS NULL',[id]);await conn.query('UPDATE sso_consents SET revoked_at=NOW() WHERE user_id=? AND revoked_at IS NULL',[id]);await conn.query('INSERT INTO sso_security_events (user_id,event_type,metadata) VALUES (?,?,?)',[id,'account.deactivated',JSON.stringify({source:'account_center'})]);await conn.commit();}catch(e){await conn.rollback().catch(()=>{});throw e}finally{conn.release()}
 res.clearCookie('vexaccount_session',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:process.env.COOKIE_SAME_SITE||'lax',path:'/'});
 res.json({success:true,message:'Account deactivated'});
}catch(e){next(e)}});
module.exports=router;
