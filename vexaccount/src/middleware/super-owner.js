const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const JWT_SECRET = process.env.JWT_SECRET || (IS_PRODUCTION ? null : 'vexastore_jwt_secret_key');
if (IS_PRODUCTION && (!JWT_SECRET || JWT_SECRET.length < 32)) throw new Error('JWT_SECRET must be configured in production');

const PERMISSIONS = {
  super_owner: ['*'],
  sso_admin: ['sso.clients.read','sso.clients.write','sso.events.read','sso.sessions.read','sso.sessions.revoke','sso.consents.read','sso.consents.revoke'],
  security_admin: ['sso.events.read','sso.sessions.read','sso.sessions.revoke','sso.consents.read','sso.consents.revoke'],
  auditor: ['sso.events.read','sso.sessions.read','sso.consents.read']
};
function hasPermission(role, permission) { const permissions = PERMISSIONS[role] || []; return permissions.includes('*') || permissions.includes(permission); }
async function resolveAdmin(header) {
  const claims=jwt.verify(header.slice(7),JWT_SECRET); const userId=claims.sub||claims.id;
  if(!userId) throw Object.assign(new Error('Invalid administrator identity'),{status:401});
  const [rows]=await pool.query('SELECT role FROM vexa_super_admins WHERE user_id=? AND is_active=1 LIMIT 1',[userId]);
  if(!rows.length) throw Object.assign(new Error('Insufficient administrative permission'),{status:403});
  return {...claims,userId,role:rows[0].role};
}
function requireSuperOwner(permission) { return async (req,res,next)=>{try{const header=req.get('authorization')||'';if(!header.startsWith('Bearer '))return res.status(401).json({success:false,message:'Authentication required'});req.admin=await resolveAdmin(header);if(permission&&!hasPermission(req.admin.role,permission))return res.status(403).json({success:false,message:'Insufficient administrative permission'});next();}catch(error){res.status(error.status||401).json({success:false,message:error.status===403?error.message:'Invalid or expired session'});}}; }
module.exports={requireSuperOwner,hasPermission,PERMISSIONS,resolveAdmin};