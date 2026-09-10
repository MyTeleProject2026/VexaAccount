const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const JWT_SECRET = process.env.JWT_SECRET;
const USER_FRONTEND=()=>String(process.env.FRONTEND_USER_URL||'https://vexaaccount-management.onrender.com').replace(/\/$/,'');
function getToken(req){const header=req.get('authorization')||'';if(header.startsWith('Bearer '))return header.slice(7).trim();return req.cookies?.vexaccount_session||null;}
function redirectToSsoLogin(req,res){
 const query=new URLSearchParams(req.query||{}).toString();
 const target=`${USER_FRONTEND()}/#/sso/authorize${query?`?${query}`:''}`;
 return res.redirect(302,target);
}
async function requireSsoUser(req,res,next){
 if(!JWT_SECRET)return res.status(503).json({success:false,message:'Authentication is not configured'});
 const token=getToken(req);
 if(!token){
  if(req.method==='GET'&&req.path==='/authorize')return redirectToSsoLogin(req,res);
  return res.status(401).json({success:false,message:'Authentication required'});
 }
 try{
  const claims=jwt.verify(token,JWT_SECRET),userId=claims.sub||claims.id;
  if(!userId)return res.status(401).json({success:false,message:'Invalid identity'});
  if(claims.role&&claims.role!=='user'&&claims.role!=='super_admin'&&claims.role!=='owner')return res.status(403).json({success:false,message:'User access required'});
  if(claims.role==='user'||!claims.role){const [rows]=await pool.query('SELECT id,is_active,session_version FROM store_users WHERE id=? AND is_active=1 LIMIT 1',[userId]);if(!rows.length||Number(claims.sv||1)!==Number(rows[0].session_version||1)){
    if(req.method==='GET'&&req.path==='/authorize')return redirectToSsoLogin(req,res);
    return res.status(401).json({success:false,message:'Invalid, inactive, or revoked session'});
  }}
  req.user={...claims,id:userId};next();
 }catch{
  if(req.method==='GET'&&req.path==='/authorize')return redirectToSsoLogin(req,res);
  return res.status(401).json({success:false,message:'Invalid or expired session'});
 }
}
module.exports={requireSsoUser};
