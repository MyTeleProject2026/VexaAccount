const express=require('express');
const {pool}=require('../config/database');
const {requireSuperAdmin}=require('../middleware/superAdminAuth');

const router=express.Router();
const INTERVAL=Math.max(1000,Number(process.env.VEXA_SYSTEM_C_INTERVAL_MS||3000));

async function snapshot(){
  const started=Date.now();
  const [database]=await pool.query('SELECT 1 AS ok');
  const [applications]=await pool.query(`SELECT r.client_id,r.display_name,r.application_key,r.environment,r.status,r.updated_at,c.is_active,c.last_used_at,
    (SELECT COUNT(*) FROM sso_sessions s WHERE s.client_id=r.client_id AND s.revoked_at IS NULL AND s.expires_at>NOW()) AS active_sessions
    FROM sso_client_registry r LEFT JOIN sso_clients c ON c.client_id=r.client_id ORDER BY r.display_name ASC`);
  const [securityEvents]=await pool.query('SELECT event_type,client_id,created_at FROM sso_security_events ORDER BY created_at DESC LIMIT 200').catch(()=>[[]]);
  const [audit]=await pool.query('SELECT action,resource_type,resource_id,created_at FROM vexa_admin_audit_log ORDER BY created_at DESC LIMIT 100').catch(()=>[[]]);
  const [totals]=await pool.query(`SELECT
    (SELECT COUNT(*) FROM sso_sessions WHERE revoked_at IS NULL AND expires_at>NOW()) AS activeSessions,
    (SELECT COUNT(*) FROM sso_consents WHERE revoked_at IS NULL) AS activeConsents,
    (SELECT COUNT(*) FROM sso_security_events WHERE created_at>=DATE_SUB(NOW(),INTERVAL 5 MINUTE)) AS securityEvents5m,
    (SELECT COUNT(*) FROM sso_security_events WHERE created_at>=DATE_SUB(NOW(),INTERVAL 5 MINUTE) AND event_type LIKE '%failed%') AS failures5m`).catch(()=>[{}]);
  return {
    success:true,
    generatedAt:new Date().toISOString(),
    latencyMs:Date.now()-started,
    database:Boolean(database?.ok),
    metrics:totals||{},
    applications:applications.map(a=>({...a,active:Boolean(a.is_active),activeSessions:Number(a.active_sessions||0)})),
    events:[
      ...securityEvents.map(e=>({source:'sso',...e})),
      ...audit.map(e=>({source:'owner-audit',event_type:e.action,client_id:e.resource_id,created_at:e.created_at,resource_type:e.resource_type}))
    ].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,250)
  };
}

router.use(requireSuperAdmin);

router.get('/health',(req,res)=>res.json({success:true,service:'VexaAccount System C Observatory',timestamp:new Date().toISOString()}));

router.get('/snapshot',async(req,res,next)=>{
  try{res.json(await snapshot())}catch(error){next(error)}
});

router.get('/stream',async(req,res)=>{
  res.status(200);
  res.setHeader('Content-Type','text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control','no-cache, no-transform');
  res.setHeader('Connection','keep-alive');
  res.setHeader('X-Accel-Buffering','no');
  res.flushHeaders?.();

  let timer;
  let closed=false;
  const send=async()=>{
    if(closed)return;
    try{
      res.write('event: snapshot\\n');
      res.write('data: '+JSON.stringify(await snapshot())+'\\n\\n');
    }catch(error){
      if(!closed){
        res.write('event: observatory-error\\n');
        res.write('data: '+JSON.stringify({success:false,message:'Observatory snapshot failed'})+'\\n\\n');
      }
    }
  };

  const close=()=>{closed=true;if(timer)clearInterval(timer)};
  req.on('close',close);
  req.on('aborted',close);

  await send();
  timer=setInterval(send,INTERVAL);
});

module.exports=router;
