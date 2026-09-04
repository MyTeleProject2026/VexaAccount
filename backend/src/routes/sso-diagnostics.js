const express=require('express');
const {pool}=require('../config/database');
const {requireSuperAdmin}=require('../middleware/superAdminAuth');
const {auditAdminAction}=require('../middleware/adminAudit');
const {normalizeJsonArray}=require('../services/ssoClient.service');

const router=express.Router();
const SUPPORTED_SCOPES=['openid','profile','email','account','session','applications','notifications'];
const VALID_STATUSES=['pending','active','disabled','maintenance','rejected','revoked'];
router.use(requireSuperAdmin);

function bool(v){return Number(v)===1;}
function cleanList(v){return normalizeJsonArray(v).map(x=>String(x).trim()).filter(Boolean);}
function diagnosticStatus(a){
  const redirectUris=cleanList(a.redirect_uris);
  const scopes=cleanList(a.allowed_scopes);
  const registryActive=a.status==='active';
  const clientActive=bool(a.is_active);
  const checks={
    registryRecord:true,
    clientRecord:Boolean(a.client_row),
    registryActive,
    clientActive,
    statusActiveConsistent:registryActive===clientActive,
    hasRedirectUri:redirectUris.length>0,
    redirectsHttps:redirectUris.length>0&&redirectUris.every(uri=>{try{const u=new URL(uri);return u.protocol==='https:'||u.hostname==='localhost'}catch{return false}}),
    hasAllowedScopes:scopes.length>0,
    scopesSupported:scopes.every(s=>SUPPORTED_SCOPES.includes(s)),
    clientSecretConfigured:Boolean(a.client_secret_hash)
  };
  const failed=Object.entries(checks).filter(([,ok])=>!ok).map(([key])=>key);
  return {healthy:failed.length===0,checks,failed};
}

router.get('/applications/:clientId/diagnostics',auditAdminAction('sso.application.diagnostics','sso_application'),async(req,res,next)=>{
  try{
    const [rows]=await pool.query(`SELECT r.client_id,r.display_name,r.application_key,r.environment,r.status,r.owner_label,r.description,r.created_at,r.updated_at,c.id AS client_row,c.is_active,c.redirect_uris,c.allowed_scopes,c.last_used_at,c.secret_rotated_at,c.client_secret_hash FROM sso_client_registry r LEFT JOIN sso_clients c ON c.client_id=r.client_id WHERE r.client_id=? LIMIT 1`,[req.params.clientId]);
    if(!rows.length)return res.status(404).json({success:false,message:'SSO application not found'});
    const a=rows[0];
    const diagnosis=diagnosticStatus(a);
    const [sessionRows]=await pool.query(`SELECT COUNT(*) AS active FROM sso_sessions WHERE client_id=? AND revoked_at IS NULL AND expires_at>NOW()`,[a.client_id]);
    const [consentRows]=await pool.query(`SELECT COUNT(*) AS active FROM sso_consents WHERE client_id=? AND revoked_at IS NULL`,[a.client_id]);
    const [failureRows]=await pool.query(`SELECT event_type,COUNT(*) AS count,MAX(created_at) AS last_at FROM sso_security_events WHERE client_id=? AND event_type IN ('sso.authorization_failed','sso.token_failed','sso.authorization_rejected','sso.token_rejected') GROUP BY event_type ORDER BY last_at DESC LIMIT 20`,[a.client_id]);
    const redirectUris=cleanList(a.redirect_uris);
    const allowedScopes=cleanList(a.allowed_scopes);
    res.json({success:true,application:{clientId:a.client_id,displayName:a.display_name,applicationKey:a.application_key,environment:a.environment,status:a.status,active:bool(a.is_active),redirectUris,allowedScopes,lastUsedAt:a.last_used_at,secretRotatedAt:a.secret_rotated_at,createdAt:a.created_at,updatedAt:a.updated_at},endpoints:{issuer:String(process.env.VEXA_ACCOUNT_ISSUER||'https://api-vexaaccount.onrender.com').replace(/\/$/,''),authorization:'/api/sso/authorize',token:'/api/sso/token',userinfo:'/api/sso/userinfo'},metrics:{activeSessions:Number(sessionRows[0]?.active||0),activeConsents:Number(consentRows[0]?.active||0),recentFailures:failureRows.map(x=>({eventType:x.event_type,count:Number(x.count),lastAt:x.last_at}))},diagnosis});
  }catch(error){next(error);}
});

router.post('/applications/:clientId/repair-status',auditAdminAction('sso.application.status.repair','sso_application'),async(req,res,next)=>{
  const connection=await pool.getConnection();
  try{
    const [rows]=await connection.query(`SELECT r.client_id,r.status,c.id AS client_row,c.is_active,c.redirect_uris,c.allowed_scopes FROM sso_client_registry r LEFT JOIN sso_clients c ON c.client_id=r.client_id WHERE r.client_id=? LIMIT 1`,[req.params.clientId]);
    if(!rows.length)return res.status(404).json({success:false,message:'SSO application not found'});
    const a=rows[0];
    if(!a.client_row)return res.status(409).json({success:false,message:'Cannot repair: SSO client record is missing'});
    if(!VALID_STATUSES.includes(a.status))return res.status(409).json({success:false,message:'Cannot repair: registry status is invalid'});
    const redirects=cleanList(a.redirect_uris),scopes=cleanList(a.allowed_scopes);
    if(!redirects.length||!scopes.length||scopes.some(s=>!SUPPORTED_SCOPES.includes(s)))return res.status(409).json({success:false,message:'Cannot repair: redirect URI or scope configuration is invalid'});
    const desiredActive=a.status==='active'?1:0;
    if(Number(a.is_active)!==desiredActive)await connection.query('UPDATE sso_clients SET is_active=?,updated_at=CURRENT_TIMESTAMP WHERE client_id=?',[desiredActive,a.client_id]);
    res.json({success:true,message:Number(a.is_active)===desiredActive?'SSO status is already synchronized':'SSO client activation synchronized with registry status',clientId:a.client_id,status:a.status,isActive:Boolean(desiredActive),changed:Number(a.is_active)!==desiredActive});
  }catch(error){next(error);}finally{connection.release();}
});

module.exports=router;
