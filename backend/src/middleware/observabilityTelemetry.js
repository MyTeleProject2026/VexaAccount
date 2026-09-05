const jwt=require('jsonwebtoken');
const {pool}=require('../config/database');

const JWT_SECRET=process.env.JWT_SECRET;
const enabled=String(process.env.VEXA_OBSERVABILITY_TELEMETRY||'true').toLowerCase()!=='false';

function getBearer(req){const h=String(req.get('authorization')||'');return /^Bearer\s+/i.test(h)?h.replace(/^Bearer\s+/i,'').trim():null}
function safeUserId(req){
  if(!JWT_SECRET)return null;
  const token=getBearer(req);
  if(!token)return null;
  try{const c=jwt.verify(token,JWT_SECRET);return Number(c.sub||c.id)||null}catch{return null}
}

function observabilityTelemetry(req,res,next){
  if(!enabled||!req.path.startsWith('/api/')||req.path.startsWith('/api/system-c/'))return next();
  const started=process.hrtime.bigint();
  res.on('finish',()=>{
    const latencyMs=Number(process.hrtime.bigint()-started)/1e6;
    const route=req.route?.path?String(req.baseUrl||'')+String(req.route.path):String(req.path||'');
    const clientId=String(req.body?.client_id||req.query?.client_id||req.get('x-vexa-sso-client')||'').slice(0,128)||null;
    const metadata={statusCode:res.statusCode,contentType:String(res.get('content-type')||'').split(';')[0]||null};
    pool.query('INSERT INTO vexa_observability_events (event_type,route,method,status_code,latency_ms,client_id,user_id,ip_address,metadata) VALUES (?,?,?,?,?,?,?,?,?)',[
      res.statusCode>=500?'api.error':res.statusCode>=400?'api.failure':'api.request',route,req.method,res.statusCode,Math.round(latencyMs),clientId,safeUserId(req),req.ip||null,JSON.stringify(metadata)
    ]).catch(()=>{});
  });
  next();
}
module.exports={observabilityTelemetry};
