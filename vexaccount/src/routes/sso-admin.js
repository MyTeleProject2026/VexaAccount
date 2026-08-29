const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'vexastore_jwt_secret_key';
const hash = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const parse = value => { try { const x = typeof value === 'string' ? JSON.parse(value) : value; return Array.isArray(x) ? x : []; } catch { return []; } };

function requireSuperAdmin(req,res,next){
  try{
    const h=req.get('authorization')||'';
    if(!h.startsWith('Bearer ')) return res.status(401).json({success:false,message:'Authentication required'});
    const claims=jwt.verify(h.slice(7),JWT_SECRET);
    const adminUserId=claims.sub||claims.id;
    if(!adminUserId) return res.status(401).json({success:false,message:'Invalid administrator identity'});
    pool.query('SELECT role FROM vexa_super_admins WHERE user_id=? AND is_active=1 LIMIT 1',[adminUserId]).then(([rows])=>{
      if(!rows.length) return res.status(403).json({success:false,message:'Super Owner access required'});
      req.admin={...claims,userId:adminUserId,role:rows[0].role}; next();
    }).catch(next);
  }catch{return res.status(401).json({success:false,message:'Invalid or expired session'});}
}
router.use(requireSuperAdmin);

async function audit(req, action, targetType, targetId, metadata={}){
  await pool.query('INSERT INTO vexa_admin_audit_log (admin_user_id,action,target_type,target_id,ip_address,user_agent,metadata) VALUES (?,?,?,?,?,?,?)',[req.admin.userId,action,targetType,targetId||null,req.ip||null,String(req.get('user-agent')||'').slice(0,512),JSON.stringify(metadata)]);
}

router.get('/clients',async(req,res,next)=>{try{
  const [rows]=await pool.query('SELECT id,client_id,name,redirect_uris,allowed_scopes,is_active,last_used_at,created_at,updated_at FROM sso_clients ORDER BY created_at DESC');
  res.json({success:true,clients:rows.map(r=>({...r,redirect_uris:parse(r.redirect_uris),allowed_scopes:parse(r.allowed_scopes)}))});
}catch(e){next(e);}});

router.post('/clients',async(req,res,next)=>{try{
  const {client_id,name,redirect_uris,allowed_scopes=['openid','profile','email']}=req.body;
  if(!/^[a-zA-Z0-9._-]{3,128}$/.test(String(client_id||''))) return res.status(400).json({success:false,message:'Invalid client_id'});
  if(!String(name||'').trim()||!Array.isArray(redirect_uris)||!redirect_uris.length) return res.status(400).json({success:false,message:'name and at least one redirect URI are required'});
  for(const uri of redirect_uris){try{const u=new URL(uri);if(u.protocol!=='https:'&&u.hostname!=='localhost')throw new Error();}catch{return res.status(400).json({success:false,message:'Every redirect URI must be HTTPS or localhost'});}}
  const secret=crypto.randomBytes(48).toString('base64url');
  await pool.query('INSERT INTO sso_clients (client_id,client_secret_hash,name,redirect_uris,allowed_scopes,is_active) VALUES (?,?,?,?,?,1)',[client_id,hash(secret),name.trim(),JSON.stringify([...new Set(redirect_uris)]),JSON.stringify([...new Set(allowed_scopes)])]);
  await audit(req,'sso_client_created','sso_client',client_id,{name:name.trim(),redirect_uris,allowed_scopes});
  res.status(201).json({success:true,message:'SSO client created. Save the secret now; it cannot be retrieved again.',client:{client_id,name:name.trim(),redirect_uris,allowed_scopes},client_secret:secret});
}catch(e){if(e.code==='ER_DUP_ENTRY')return res.status(409).json({success:false,message:'client_id already exists'});next(e);}});

router.patch('/clients/:clientId',async(req,res,next)=>{try{
  const fields=[],values=[]; const body=req.body||{};
  if(body.name!==undefined){fields.push('name=?');values.push(String(body.name).trim());}
  if(body.redirect_uris!==undefined){if(!Array.isArray(body.redirect_uris)||!body.redirect_uris.length)return res.status(400).json({success:false,message:'At least one redirect URI is required'});fields.push('redirect_uris=?');values.push(JSON.stringify([...new Set(body.redirect_uris)]));}
  if(body.allowed_scopes!==undefined){if(!Array.isArray(body.allowed_scopes)||!body.allowed_scopes.length)return res.status(400).json({success:false,message:'At least one scope is required'});fields.push('allowed_scopes=?');values.push(JSON.stringify([...new Set(body.allowed_scopes)]));}
  if(typeof body.is_active==='boolean'){fields.push('is_active=?');values.push(body.is_active?1:0);}
  if(!fields.length)return res.status(400).json({success:false,message:'No supported changes supplied'});
  values.push(req.params.clientId);
  const [r]=await pool.query(`UPDATE sso_clients SET ${fields.join(', ')} WHERE client_id=?`,values);
  if(!r.affectedRows)return res.status(404).json({success:false,message:'SSO client not found'});
  await audit(req,'sso_client_updated','sso_client',req.params.clientId,{fields:fields.map(x=>x.split('=')[0])});
  res.json({success:true,message:'SSO client updated'});
}catch(e){next(e);}});

router.post('/clients/:clientId/rotate-secret',async(req,res,next)=>{try{
  const secret=crypto.randomBytes(48).toString('base64url');
  const [r]=await pool.query('UPDATE sso_clients SET client_secret_hash=? WHERE client_id=?',[hash(secret),req.params.clientId]);
  if(!r.affectedRows)return res.status(404).json({success:false,message:'SSO client not found'});
  await audit(req,'sso_client_secret_rotated','sso_client',req.params.clientId);
  res.json({success:true,message:'Client secret rotated. Save the new secret now.',client_secret:secret});
}catch(e){next(e);}});

router.get('/events',async(req,res,next)=>{try{
  const limit=Math.min(Math.max(Number(req.query.limit)||100,1),500);
  const [rows]=await pool.query('SELECT user_id,client_id,event_type,ip_address,user_agent,metadata,created_at FROM sso_security_events ORDER BY created_at DESC LIMIT ?',[limit]);
  res.json({success:true,events:rows});
}catch(e){next(e);}});

module.exports=router;