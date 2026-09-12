const express = require('express');
const { requireSuperAdmin } = require('../middleware/superAdminAuth');
const { auditAdminAction } = require('../middleware/adminAudit');
const { analyze } = require('../services/ssoApplicationAnalyzer.service');
const { plan } = require('../services/ssoApplicationIntegrationPlanner.service');
const ownerOperation = require('../services/ownerOperation.service');

const router = express.Router();
router.use(requireSuperAdmin);
router.get('/catalog', auditAdminAction('sso.application_analyzer.catalog','sso_application_analyzer'), (req,res) => res.json({ success:true, mode:'read-only', maxFiles:120, maxFileBytes:400000, credentialEnv:'GITHUB_SSO_ANALYZE_TOKEN', fallbackCredentialEnv:'GITHUB_SSO_DEPLOY_TOKEN', supports:['private-repositories-via-server-side-GitHub-token','framework-detection','authentication-file-detection','route-detection','integration-plan','precise-source-review','blob-sha-installation-guard','explicit-replacement-review-policy','background-owner-operation-jobs','server-sent-operation-events','operation-heartbeats','operation-watchdog','abortable-cancellation'] }));
router.post('/analyze', auditAdminAction('sso.application_analyzer.analyze','sso_application_analyzer'), async (req,res,next)=>{try{res.json(await analyze(req.body||{}));}catch(e){next(e);}});
router.post('/plan', auditAdminAction('sso.application_analyzer.plan','sso_application_analyzer'), async (req,res,next)=>{try{res.json(await plan(req.body||{}));}catch(e){next(e);}});
router.post('/analyze/async', auditAdminAction('sso.application_analyzer.analyze_async','sso_application_analyzer'), (req,res,next)=>{try{const body=req.body||{};const operation=ownerOperation.create({type:'repository-analysis',label:'Repository analysis',run:async ctx=>{const result=await analyze(body,ctx);ctx.progress('ANALYSIS COMPLETE',`Inspected ${result.summary?.sourceFilesInspected??result.files?.length??0} source files and detected the target stack.`,100);return result;}});res.status(202).json({success:true,operation});}catch(e){next(e);}});
router.post('/plan/async', auditAdminAction('sso.application_analyzer.plan_async','sso_application_analyzer'), (req,res,next)=>{try{const body=req.body||{};const operation=ownerOperation.create({type:'source-review-plan',label:'Source review plan',run:async ctx=>{ctx.progress('SOURCE REVIEW',`Preparing SHA-bound review plan for ${Array.isArray(body.files)?body.files.length:0} reviewed candidates…`,10);const result=await plan(body);ctx.progress('PLAN READY',`Signed review plan created for ${result.reviewedFiles?.length||0} files.`,100);return result;}});res.status(202).json({success:true,operation});}catch(e){next(e);}});

router.get('/operations/:operationId', (req,res)=>{
  const operation=ownerOperation.get(req.params.operationId);
  if(!operation)return res.status(404).json({success:false,message:'Owner operation not found or expired'});
  res.set('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');
  res.json({success:true,operation});
});

router.get('/operations/:operationId/stream', (req,res)=>{
  const operationId=String(req.params.operationId||'');
  const operation=ownerOperation.get(operationId);
  if(!operation)return res.status(404).json({success:false,message:'Owner operation not found or expired'});
  res.status(200);
  res.set({'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
  if(typeof res.flushHeaders==='function')res.flushHeaders();
  let closed=false;
  let keepAlive=null;
  let unsubscribe=()=>{};
  const close=()=>{if(closed)return;closed=true;if(keepAlive)clearInterval(keepAlive);unsubscribe();try{res.end();}catch(_) {}};
  const send=(snapshot,event)=>{if(closed)return;try{res.write(`event: ${event?.kind||'state'}\ndata: ${JSON.stringify({operation:snapshot,event:event||null})}\n\n`);}catch(_){close();}};
  unsubscribe=ownerOperation.subscribe(operationId,(snapshot,event)=>{send(snapshot,event);if(['completed','failed','cancelled','stalled'].includes(String(snapshot.status||'').toLowerCase()))close();});
  keepAlive=setInterval(()=>{if(closed)return;try{res.write(': heartbeat\n\n');}catch(_){close();}},15000);
  req.on('close',close);
});

router.post('/operations/:operationId/cancel', auditAdminAction('sso.owner.operation.cancel','sso_owner_operation'), (req,res)=>{const operation=ownerOperation.cancel(req.params.operationId);if(!operation)return res.status(404).json({success:false,message:'Owner operation not found or expired'});res.json({success:true,operation});});
module.exports = router;
