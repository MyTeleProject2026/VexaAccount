const express = require('express');
const { requireSuperAdmin } = require('../middleware/superAdminAuth');
const { auditAdminAction } = require('../middleware/adminAudit');
const { analyze } = require('../services/ssoApplicationAnalyzer.service');
const { plan } = require('../services/ssoApplicationIntegrationPlanner.service');
const ownerOperation = require('../services/ownerOperation.service');

const router = express.Router();
router.use(requireSuperAdmin);

ownerOperation.registerRunner('repository-analysis', async (payload, ctx) => {
  const result = await analyze(payload || {}, ctx);
  ctx.progress('ANALYSIS COMPLETE', `Inspected ${result.summary?.sourceFilesInspected ?? result.files?.length ?? 0} source files and detected the target stack.`, 100);
  return result;
});
ownerOperation.registerRunner('source-review-plan', async (payload, ctx) => plan(payload || {}, ctx));

router.get('/catalog', auditAdminAction('sso.application_analyzer.catalog','sso_application_analyzer'), (req,res) => res.json({ success:true, mode:'read-only', maxFiles:120, maxFileBytes:400000, credentialEnv:'GITHUB_SSO_ANALYZE_TOKEN', fallbackCredentialEnv:'GITHUB_SSO_DEPLOY_TOKEN', supports:['private-repositories-via-server-side-GitHub-token','framework-detection','authentication-file-detection','route-detection','integration-plan','precise-source-review','blob-sha-installation-guard','explicit-replacement-review-policy','background-owner-operation-jobs','durable-owner-operation-store','server-sent-operation-events','operation-heartbeats','operation-watchdog','abortable-cancellation','worker-recovery-after-restart'] }));
router.post('/analyze', auditAdminAction('sso.application_analyzer.analyze','sso_application_analyzer'), async (req,res,next)=>{try{res.json(await analyze(req.body||{}));}catch(e){next(e);}});
router.post('/plan', auditAdminAction('sso.application_analyzer.plan','sso_application_analyzer'), async (req,res,next)=>{try{res.json(await plan(req.body||{}));}catch(e){next(e);}});
router.post('/analyze/async', auditAdminAction('sso.application_analyzer.analyze_async','sso_application_analyzer'), (req,res,next)=>{try{const operation=ownerOperation.create({type:'repository-analysis',label:'Repository analysis',payload:req.body||{}});res.status(202).json({success:true,operation});}catch(e){next(e);}});
router.post('/plan/async', auditAdminAction('sso.application_analyzer.plan_async','sso_application_analyzer'), (req,res,next)=>{try{const operation=ownerOperation.create({type:'source-review-plan',label:'Source review plan',payload:req.body||{}});res.status(202).json({success:true,operation});}catch(e){next(e);}});

router.get('/operations', async (req,res,next)=>{try{const includeTerminal=String(req.query.includeTerminal ?? 'true').toLowerCase() !== 'false';const limit=Math.max(1,Math.min(100,Number(req.query.limit)||50));res.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');res.json({success:true,operations:await ownerOperation.listPersistent({includeTerminal,limit})});}catch(e){next(e);}});
router.get('/operations/:operationId', async (req,res,next)=>{try{const operation=await ownerOperation.getPersistent(req.params.operationId);if(!operation)return res.status(404).json({success:false,message:'Owner operation not found or expired'});res.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');res.json({success:true,operation});}catch(e){next(e);}});

router.get('/operations/:operationId/stream', (req,res)=>{
  const operationId=String(req.params.operationId||''); const operation=ownerOperation.get(operationId);
  if(!operation)return res.status(404).json({success:false,message:'Owner operation not found or expired'});
  res.status(200);res.set({'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no-cache'});if(typeof res.flushHeaders==='function')res.flushHeaders();
  let closed=false,keepAlive=null,unsubscribe=()=>{};const terminalStatus=status=>['completed','failed','cancelled','stalled'].includes(String(status||'').toLowerCase());const close=()=>{if(closed)return;closed=true;if(keepAlive)clearInterval(keepAlive);unsubscribe();try{res.end();}catch(_){}};const flush=()=>{try{if(typeof res.flush==='function')res.flush();}catch(_){}};const send=(snapshot,event)=>{if(closed)return;try{res.write(`event: ${event?.kind||'state'}\ndata: ${JSON.stringify({operation:snapshot,event:event||null})}\n\n`);flush();}catch(_){close();}};
  unsubscribe=ownerOperation.subscribe(operationId,(snapshot,event)=>{send(snapshot,event);if(terminalStatus(snapshot.status))close();});if(closed)return;keepAlive=setInterval(()=>{if(closed)return;try{res.write(': heartbeat\n\n');flush();}catch(_){close();}},15000);keepAlive.unref?.();req.on('close',close);res.on('close',close);
});

router.post('/operations/:operationId/cancel', auditAdminAction('sso.owner.operation.cancel','sso_owner_operation'), async (req,res,next)=>{try{const operation=await ownerOperation.cancelPersistent(req.params.operationId);if(!operation)return res.status(404).json({success:false,message:'Owner operation not found or expired'});res.json({success:true,operation});}catch(e){next(e);}});
module.exports = router;