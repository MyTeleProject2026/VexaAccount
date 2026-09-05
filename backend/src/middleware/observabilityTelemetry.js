const jwt=require('jsonwebtoken');
const {pool}=require('../config/database');
const JWT_SECRET=process.env.JWT_SECRET;
const enabled=String(process.env.VEXA_OBSERVABILITY_TELEMETRY||'true').toLowerCase()!=='false';
function getToken(req){const h=String(req.get('authorization')||'');if(/^Bearer\s+/i.test(h))return h.replace(/^Bearer\s+/i,'').trim();return req.cookies?.vexaccount_session||null}
function safeUserId(req){if(!JWT_SECRET)return null;const token=getToken(req);if(!token)return null;try{const c=jwt.verify(token,JWT_SECRET);return Number(c.sub||c.id)||null}catch{return null}}
function classify(req,status){const p=String(req.path||'');const ok=status<400;if(p.startsWith('/api/sso/'))return ok?'sso.completed':'sso.failed';if(p.startsWith('/api/auth/'))return ok?'authentication.completed':'authentication.failed';if(p.startsWith('/api/sso-registry/'))return ok?'integration.completed':'integration.failed';if(p.startsWith('/api/owner/'))return ok?'owner.completed':'owner.failed';return ok?'api.completed':'api.failed'}
function observabilityTelemetry(req,res,next){
 if(!enabled||!req.path.startsWith('/api/')||req.path.startsWith('/api/system-c/'))return next();
 const started=process.hrtime.bigint();
 res.on('finish',()=>{const latencyMs=Number(process.hrtime.bigint()-started)/1e6;const route=req.route?.path?String(req.baseUrl||'')+String(req.route.path):String(req.path||'');const clientId=String(req.body?.client_id||req.query?.client_id||req.get('x-vexa-sso-client')||'').slice(0,128)||null;const metadata={statusCode:res.statusCode,contentType:String(res.get('content-type')||'').split(';')[0]||null};pool.query('INSERT INTO vexa_observability_events (event_type,route,method,status_code,latency_ms,client_id,user_id,ip_address,metadata) VALUES (?,?,?,?,?,?,?,?,?)',[classify(req,res.statusCode),route,req.method,res.statusCode,Math.round(latencyMs),clientId,safeUserId(req),req.ip||null,JSON.stringify(metadata)]).catch(()=>{})});next();
}
module.exports={observabilityTelemetry};
