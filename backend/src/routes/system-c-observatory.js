const express=require('express');
const {pool}=require('../config/database');
const {requireSuperAdmin}=require('../middleware/superAdminAuth');
const router=express.Router();
const INTERVAL=Math.max(1500,Number(process.env.VEXA_SYSTEM_C_INTERVAL_MS||3000));
const WINDOW=Math.min(60,Math.max(1,Number(process.env.VEXA_SYSTEM_C_WINDOW_MINUTES||5)));
async function optional(sql,args=[]){try{const [rows]=await pool.query(sql,args);return rows}catch{return []}}
async function snapshot(){
  const started=Date.now();
  const [database]=await pool.query('SELECT 1 AS ok');
  const [applications]=await pool.query(`SELECT r.client_id,r.display_name,r.application_key,r.environment,r.status,r.updated_at,c.is_active,c.last_used_at,
    (SELECT COUNT(*) FROM sso_sessions s WHERE s.client_id=r.client_id AND s.revoked_at IS NULL AND s.expires_at>NOW()) AS active_sessions
    FROM sso_client_registry r LEFT JOIN sso_clients c ON c.client_id=r.client_id ORDER BY r.display_name ASC`);
  const security=await optional('SELECT id,event_type,client_id,user_id,created_at FROM sso_security_events ORDER BY created_at DESC LIMIT 200');
  const audit=await optional('SELECT id,action,resource_type,resource_id,created_at FROM vexa_admin_audit_log ORDER BY created_at DESC LIMIT 100');
  const telemetry=await optional('SELECT id,event_type,route,method,status_code,latency_ms,client_id,user_id,created_at FROM vexa_observability_events ORDER BY created_at DESC LIMIT 250');
  const [totals]=await pool.query(`SELECT
    (SELECT COUNT(*) FROM sso_sessions WHERE revoked_at IS NULL AND expires_at>NOW()) AS activeSessions,
    (SELECT COUNT(*) FROM sso_consents WHERE revoked_at IS NULL) AS activeConsents,
    (SELECT COUNT(*) FROM sso_security_events WHERE created_at>=DATE_SUB(NOW(),INTERVAL ${WINDOW} MINUTE)) AS securityEventsWindow,
    (SELECT COUNT(*) FROM vexa_observability_events WHERE created_at>=DATE_SUB(NOW(),INTERVAL ${WINDOW} MINUTE) AND status_code>=400) AS failuresWindow,
    (SELECT COUNT(*) FROM vexa_observability_events WHERE created_at>=DATE_SUB(NOW(),INTERVAL 1 MINUTE)) AS apiEventsMinute,
    (SELECT COALESCE(AVG(latency_ms),0) FROM vexa_observability_events WHERE created_at>=DATE_SUB(NOW(),INTERVAL 1 MINUTE)) AS apiLatencyMs,
    (SELECT COUNT(*) FROM vexa_observability_events WHERE created_at>=DATE_SUB(NOW(),INTERVAL 1 MINUTE) AND status_code BETWEEN 200 AND 399) AS apiSuccessMinute,
    (SELECT COUNT(*) FROM vexa_observability_events WHERE created_at>=DATE_SUB(NOW(),INTERVAL 1 MINUTE) AND status_code>=400) AS apiFailureMinute`);
  const dbStatus=await optional(`SHOW STATUS WHERE Variable_name IN ('Threads_connected','Threads_running','Questions','Com_commit','Com_rollback')`);
  const db=Object.fromEntries(dbStatus.map(x=>[String(x.Variable_name).toLowerCase(),Number(x.Value)||0]));
  const apiTotal=Number(totals?.apiEventsMinute||0),apiFailures=Number(totals?.apiFailureMinute||0);
  return {success:true,generatedAt:new Date().toISOString(),latencyMs:Date.now()-started,database:Boolean(database?.ok),
    metrics:{...totals,activeSessions:Number(totals?.activeSessions||0),activeConsents:Number(totals?.activeConsents||0),apiEventsMinute:apiTotal,apiLatencyMs:Math.round(Number(totals?.apiLatencyMs||0)),apiSuccessRate:apiTotal?Math.round(((apiTotal-apiFailures)/apiTotal)*10000)/100:100,dbConnections:db.threads_connected||0,dbRunning:db.threads_running||0,dbQuestions:db.questions||0,dbCommits:db.com_commit||0,dbRollbacks:db.com_rollback||0,windowMinutes:WINDOW},
    applications:applications.map(a=>({...a,active:Boolean(a.is_active),activeSessions:Number(a.active_sessions||0)})),
    events:[...telemetry.map(e=>({id:`api-${e.id}`,source:'api-runtime',...e})),...security.map(e=>({id:`sso-${e.id}`,source:'sso-security',...e})),...audit.map(e=>({id:`audit-${e.id}`,source:'owner-audit',event_type:e.action,client_id:e.resource_id,created_at:e.created_at,resource_type:e.resource_type}))].sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,350)};
}
router.use(requireSuperAdmin);
router.get('/health',async(req,res)=>{try{const d=await snapshot();res.json({success:true,service:'VexaAccount System C Observatory',database:d.database,timestamp:d.generatedAt})}catch{res.status(503).json({success:false,service:'VexaAccount System C Observatory',database:false,message:'Runtime health check failed'})}});
router.get('/snapshot',async(req,res,next)=>{try{res.json(await snapshot())}catch(error){next(error)}});
router.get('/stream',async(req,res)=>{
  res.status(200).set({'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.flushHeaders?.();
  let timer=null,heartbeatTimer=null,closed=false,busy=false;
  const write=(event,data)=>{if(!closed)res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)};
  const send=async()=>{if(closed||busy)return;busy=true;try{write('snapshot',await snapshot())}catch{write('observatory-error',{success:false,message:'Observatory snapshot failed'})}finally{busy=false}};
  const close=()=>{if(closed)return;closed=true;if(timer)clearInterval(timer);if(heartbeatTimer)clearInterval(heartbeatTimer)};
  req.on('close',close);req.on('aborted',close);heartbeatTimer=setInterval(()=>{if(!closed)res.write(': heartbeat\n\n')},15000);await send();if(!closed)timer=setInterval(send,INTERVAL);
});
module.exports=router;
