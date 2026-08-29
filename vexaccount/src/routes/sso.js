const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const { authUser } = require('../middleware/auth');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'vexastore_jwt_secret_key';
const ISSUER = process.env.VEXA_ACCOUNT_ISSUER || process.env.API_BASE_URL || 'https://api-vexaaccount.onrender.com';
const CODE_TTL_SECONDS = 300;
const ACCESS_TTL_SECONDS = 3600;
const REFRESH_TTL_DAYS = 30;
const sha256 = value => crypto.createHash('sha256').update(String(value)).digest('base64url');
const randomToken = bytes => crypto.randomBytes(bytes).toString('base64url');
const parseArray = value => { try { const x = typeof value === 'string' ? JSON.parse(value) : value; return Array.isArray(x) ? x : []; } catch { return []; } };
const equal = (a,b) => { const x=Buffer.from(String(a)),y=Buffer.from(String(b)); return x.length===y.length && crypto.timingSafeEqual(x,y); };
async function client(clientId){const[r]=await pool.query('SELECT * FROM sso_clients WHERE client_id=? LIMIT 1',[clientId]);return r[0]||null;}

router.get('/.well-known/openid-configuration',(req,res)=>res.json({
  issuer:ISSUER, authorization_endpoint:`${ISSUER}/api/sso/authorize`,
  token_endpoint:`${ISSUER}/api/sso/token`, userinfo_endpoint:`${ISSUER}/api/sso/userinfo`,
  response_types_supported:['code'], grant_types_supported:['authorization_code','refresh_token'],
  code_challenge_methods_supported:['S256'], scopes_supported:['openid','profile','email']
}));

router.get('/authorize',authUser,async(req,res,next)=>{
  try{
    const {client_id,redirect_uri,response_type,scope='openid profile email',state,code_challenge,code_challenge_method}=req.query;
    if(response_type!=='code'||!client_id||!redirect_uri||!state||!code_challenge||code_challenge_method!=='S256') return res.status(400).json({success:false,message:'Invalid OAuth authorization request'});
    const c=await client(client_id);
    if(!c||!c.is_active||!parseArray(c.redirect_uris).includes(redirect_uri)) return res.status(400).json({success:false,message:'Invalid client or redirect URI'});
    const scopes=String(scope).split(/\s+/).filter(Boolean), allowed=new Set(parseArray(c.allowed_scopes));
    if(scopes.some(s=>!allowed.has(s))) return res.status(400).json({success:false,message:'Requested scope is not allowed'});
    const code=randomToken(32);
    await pool.query('INSERT INTO sso_authorization_codes (code_hash,client_id,user_id,redirect_uri,scope,code_challenge,expires_at) VALUES (?,?,?,?,?,?,DATE_ADD(NOW(),INTERVAL 5 MINUTE))',[sha256(code),client_id,req.user.id,redirect_uri,scopes.join(' '),code_challenge]);
    await pool.query('INSERT INTO sso_consents (client_id,user_id,scopes,granted_at,revoked_at) VALUES (?,?,?,NOW(),NULL) ON DUPLICATE KEY UPDATE scopes=VALUES(scopes),granted_at=NOW(),revoked_at=NULL',[client_id,req.user.id,scopes.join(' ')]);
    await pool.query('INSERT INTO sso_security_events (user_id,client_id,event_type,ip_address,user_agent,metadata) VALUES (?,?,?,?,?,?)',[req.user.id,client_id,'authorization_issued',req.ip||null,String(req.get('user-agent')||'').slice(0,512),JSON.stringify({scopes})]);
    const sep=redirect_uri.includes('?')?'&':'?';
    res.redirect(`${redirect_uri}${sep}code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`);
  }catch(e){next(e);}
});

router.post('/token',async(req,res,next)=>{
  const conn=await pool.getConnection();
  try{
    const {grant_type,code,redirect_uri,client_id,client_secret,code_verifier,refresh_token}=req.body;
    const c=await client(client_id);
    if(!c||!c.is_active||!client_secret||!equal(sha256(client_secret),c.client_secret_hash)) return res.status(401).json({success:false,message:'Client authentication failed'});
    if(grant_type==='refresh_token'){
      if(!refresh_token)return res.status(400).json({success:false,message:'refresh_token required'});
      await conn.beginTransaction();
      const[r]=await conn.query('SELECT * FROM sso_refresh_tokens WHERE token_hash=? AND client_id=? AND revoked_at IS NULL AND expires_at>NOW() LIMIT 1 FOR UPDATE',[sha256(refresh_token),client_id]);
      if(!r.length){await conn.rollback();return res.status(401).json({success:false,message:'Invalid refresh token'});}
      await conn.query('UPDATE sso_refresh_tokens SET revoked_at=NOW() WHERE id=?',[r[0].id]);
      const nextToken=randomToken(48);
      await conn.query('INSERT INTO sso_refresh_tokens (token_hash,client_id,user_id,scope,expires_at) VALUES (?,?,?,?,DATE_ADD(NOW(),INTERVAL 30 DAY))',[sha256(nextToken),client_id,r[0].user_id,r[0].scope]);
      await conn.commit();
      const access_token=jwt.sign({sub:r[0].user_id,client_id,scope:r[0].scope,iss:ISSUER,token_type:'access'},JWT_SECRET,{expiresIn:ACCESS_TTL_SECONDS});
      return res.json({access_token,token_type:'Bearer',expires_in:ACCESS_TTL_SECONDS,refresh_token:nextToken,scope:r[0].scope});
    }
    if(grant_type!=='authorization_code'||!code||!redirect_uri||!code_verifier)return res.status(400).json({success:false,message:'Invalid authorization code request'});
    if(!parseArray(c.redirect_uris).includes(redirect_uri))return res.status(400).json({success:false,message:'Invalid redirect URI'});
    await conn.beginTransaction();
    const[r]=await conn.query('SELECT * FROM sso_authorization_codes WHERE code_hash=? AND client_id=? AND redirect_uri=? AND consumed_at IS NULL AND expires_at>NOW() LIMIT 1 FOR UPDATE',[sha256(code),client_id,redirect_uri]);
    if(!r.length){await conn.rollback();return res.status(400).json({success:false,message:'Invalid or expired authorization code'});}
    if(!equal(sha256(code_verifier),r[0].code_challenge)){await conn.rollback();return res.status(400).json({success:false,message:'PKCE verification failed'});}
    await conn.query('UPDATE sso_authorization_codes SET consumed_at=NOW() WHERE id=?',[r[0].id]);
    const refresh=randomToken(48);
    await conn.query('INSERT INTO sso_refresh_tokens (token_hash,client_id,user_id,scope,expires_at) VALUES (?,?,?,?,DATE_ADD(NOW(),INTERVAL 30 DAY))',[sha256(refresh),client_id,r[0].user_id,r[0].scope]);
    await conn.query('INSERT INTO sso_sessions (session_hash,client_id,user_id,scope,expires_at) VALUES (?,?,?,?,DATE_ADD(NOW(),INTERVAL 30 DAY))',[sha256(randomToken(32)),client_id,r[0].user_id,r[0].scope]);
    await conn.query('UPDATE sso_clients SET last_used_at=NOW() WHERE client_id=?',[client_id]);
    await conn.commit();
    const access_token=jwt.sign({sub:r[0].user_id,client_id,scope:r[0].scope,iss:ISSUER,token_type:'access'},JWT_SECRET,{expiresIn:ACCESS_TTL_SECONDS});
    res.json({access_token,token_type:'Bearer',expires_in:ACCESS_TTL_SECONDS,refresh_token:refresh,scope:r[0].scope});
  }catch(e){try{await conn.rollback();}catch{}next(e);}finally{conn.release();}
});

router.get('/userinfo',async(req,res)=>{
  try{
    const h=req.get('authorization')||'';if(!h.startsWith('Bearer '))return res.status(401).json({success:false,message:'Bearer token required'});
    const t=jwt.verify(h.slice(7),JWT_SECRET);if(t.iss!==ISSUER||t.token_type!=='access')return res.status(401).json({success:false,message:'Invalid SSO token'});
    const[r]=await pool.query('SELECT id,email,name,first_name,last_name,avatar_url,is_verified FROM store_users WHERE id=? AND is_active=1 LIMIT 1',[t.sub]);if(!r.length)return res.status(404).json({success:false,message:'User not found'});
    const s=new Set(String(t.scope||'').split(/\s+/)),u=r[0],out={sub:String(u.id)};
    if(s.has('email'))Object.assign(out,{email:u.email,email_verified:Boolean(u.is_verified)});
    if(s.has('profile'))Object.assign(out,{name:u.name,given_name:u.first_name,family_name:u.last_name,picture:u.avatar_url});
    res.json(out);
  }catch{return res.status(401).json({success:false,message:'Invalid or expired token'});}
});
module.exports=router;