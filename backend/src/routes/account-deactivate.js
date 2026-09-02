const express=require('express');
const jwt=require('jsonwebtoken');
const {pool}=require('../config/database');
const router=express.Router();
const JWT_SECRET=process.env.JWT_SECRET;
function uid(req){const h=req.get('authorization')||'';const t=h.startsWith('Bearer ')?h.slice(7).trim():req.cookies?.vexaccount_session;if(!t)throw Object.assign(new Error('Authentication required'),{status:401});const d=jwt.verify(t,JWT_SECRET);if(d.role!=='user')throw Object.assign(new Error('User access required'),{status:403});return d.id||d.sub;}
router.post('/deactivate',async(req,res,next)=>{try{const id=uid(req);const [r]=await pool.query('UPDATE store_users SET is_active=0 WHERE id=? AND is_active=1',[id]);if(!r.affectedRows)return res.status(404).json({success:false,message:'Active account not found'});await pool.query('UPDATE sso_sessions SET revoked_at=NOW() WHERE user_id=? AND revoked_at IS NULL',[id]);await pool.query('UPDATE sso_consents SET revoked_at=NOW() WHERE user_id=? AND revoked_at IS NULL',[id]);res.clearCookie('vexaccount_session',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:process.env.COOKIE_SAME_SITE||'lax',path:'/'});res.json({success:true,message:'Account deactivated'});}catch(e){next(e)}});
module.exports=router;
