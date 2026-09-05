require('dotenv').config();
const express=require('express');
const cors=require('cors');
const cookieParser=require('cookie-parser');
const {pool}=require('../config/database');
const {requireSuperAdmin}=require('../middleware/superAdminAuth');

const app=express();
const PORT=Number(process.env.VEXA_SYSTEM_C_PORT||5051);
const INTERVAL=Math.max(1000,Number(process.env.VEXA_SYSTEM_C_INTERVAL_MS||3000));
const origins=String(process.env.VEXA_SYSTEM_C_ALLOWED_ORIGINS||process.env.FRONTEND_ADMIN_URL||'').split(',').map(v=>v.trim()).filter(Boolean);

app.use(cookieParser());
app.use(cors({origin:(origin,cb)=>!origin||!origins.length||origins.includes(origin)?cb(null,true):cb(new Error('Origin not allowed')),credentials:true}));
app.use(requireSuperAdmin);

async function q(sql,params=[]){const [rows]=await pool.query(sql,params);return rows;}
async function snapshot(){
  const started=Date.now();
  const database=await q('SELECT 1 AS ok');
  const applications=await q(`SELECT r.client_id,r.display_name,r.application_key,r.environment,r.status,r.updated_at,c.is_active,c.last_used_at,
    (SELECT COUNT(*) FROM sso_sessions s WHERE s.client_id=r.client_id AND s.revoked_at IS NULL AND s.expires_at>NOW()) AS active_sessions
    FROM sso_client_registry r LEFT JOIN sso_clients c ON c.client_id=r.client_id ORDER BY r.display_name ASC`);
  const securityEvents=await q(`SELECT event_type,client_id,created_at FROM sso_security_events ORDER BY created_at DESC LIMIT 200`).catch(()=>[]);
  const audit=await q(`SELECT action,resource_type,resource_id,created_at FROM vexa_admin_audit_log ORDER BY created_at DESC LIMIT 100`).catch(()=>[]);
  const totals=await q(`SELECT
    (SELECT COUNT(*) FROM sso_sessions WHERE revoked_at IS NULL AND expires_at>NOW()) AS activeSessions,
    (SELECT COUNT(*) FROM sso_consents WHERE revoked_at IS NULL) AS activeConsents,
    (SELECT COUNT(*) FROM sso_security_events WHERE created_at>=DATE_SUB(NOW(),INTERVAL 5 MINUTE)) AS securityEvents5m,
    (SELECT COUNT(*) FROM sso_security_events WHERE created_at>=DATE_SUB(NOW(),INTERVAL 5 MINUTE) AND event_type LIKE '%failed%') AS failures5m`).catch(()=>[{}]);
  return {success:true,generatedAt:new Date().toISOString(),latencyMs:Date.now()-started,database:Boolean(database[0]?.ok),metrics:totals[0]||{},applications:applications.map(a=>({...a,active:Boolean(a.is_active),activeSessions:Number(a.active_sessions||0)})),events:[...securityEvents.map(e=>({source:'sso',...e})),...audit.map(e=>({source:'owner-audit',event_type:e.action,client_id:e.resource_id,created_at:e.created_at,resource_type:e.resource_type}))].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,250)};
}

app.get('/health',(req,res)=>res.json({success:true,service:'VexaAccount System C Observatory',timestamp:new Date().toISOString()}));
app.get('/api/system-c/snapshot',async(req,res,next)=>{try{res.json(await snapshot())}catch(e){next(e)}});
app.get('/api/system-c/stream',async(req,res,next)=>{
  res.set({'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive'});
  res.flushHeaders?.();
  let closed=false;
  req.on('close',()=>{closed=true;clearInterval(timer)});
  const push=async()=>{if(closed)return;try{res.write('event: snapshot\n');res.write('data: '+JSON.stringify(await snapshot())+'\n\n')}catch(e){res.write('event: error\n');res.write('data: '+JSON.stringify({message:e.message})+'\n\n')}};
  await push();
  const timer=setInterval(push,INTERVAL);
});
app.use((err,req,res,next)=>res.status(500).json({success:false,message:err.message||'Observatory error'}));
app.listen(PORT,()=>console.log('📡 VexaAccount System C Observatory listening on '+PORT));
