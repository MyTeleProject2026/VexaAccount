const express = require('express');
const { requireSuperAdmin } = require('../middleware/superAdminAuth');
const { auditAdminAction } = require('../middleware/adminAudit');
const { analyze } = require('../services/ssoApplicationAnalyzer.service');
const { plan } = require('../services/ssoApplicationIntegrationPlanner.service');
const ownerOperation = require('../services/ownerOperation.service');

const router = express.Router();
router.use(requireSuperAdmin);
router.get('/catalog', auditAdminAction('sso.application_analyzer.catalog','sso_application_analyzer'), (req,res) => res.json({ success:true, mode:'read-only', maxFiles:120, maxFileBytes:400000, credentialEnv:'GITHUB_SSO_ANALYZE_TOKEN', fallbackCredentialEnv:'GITHUB_SSO_DEPLOY_TOKEN', supports:['private-repositories-via-server-side-GitHub-token','framework-detection','authentication-file-detection','route-detection','integration-plan','precise-source-review','blob-sha-installation-guard','explicit-replacement-review-policy','background-owner-operation-jobs'] }));
router.post('/analyze', auditAdminAction('sso.application_analyzer.analyze','sso_application_analyzer'), async (req,res,next)=>{try{res.json(await analyze(req.body||{}));}catch(e){next(e);}});
router.post('/plan', auditAdminAction('sso.application_analyzer.plan','sso_application_analyzer'), async (req,res,next)=>{try{res.json(await plan(req.body||{}));}catch(e){next(e);}});
router.post('/analyze/async', auditAdminAction('sso.application_analyzer.analyze_async','sso_application_analyzer'), (req,res,next)=>{try{const body=req.body||{};const operation=ownerOperation.create({type:'repository-analysis',label:'Repository analysis',run:async ctx=>{ctx.progress('REPOSITORY',`Reading ${body.repository||'target repository'}@${body.branch||'default branch'}…`,5);const result=await analyze(body);ctx.progress('ANALYSIS COMPLETE',`Inspected ${result.summary?.sourceFilesInspected??result.files?.length??0} source files and detected the target stack.`,100);return result;}});res.status(202).json({success:true,operation});}catch(e){next(e);}});
router.post('/plan/async', auditAdminAction('sso.application_analyzer.plan_async','sso_application_analyzer'), (req,res,next)=>{try{const body=req.body||{};const operation=ownerOperation.create({type:'source-review-plan',label:'Source review plan',run:async ctx=>{ctx.progress('SOURCE REVIEW',`Preparing SHA-bound review plan for ${Array.isArray(body.files)?body.files.length:0} reviewed candidates…`,10);const result=await plan(body);ctx.progress('PLAN READY',`Signed review plan created for ${result.reviewedFiles?.length||0} files.`,100);return result;}});res.status(202).json({success:true,operation});}catch(e){next(e);}});
router.get('/operations/:operationId', auditAdminAction('sso.owner.operation.status','sso_owner_operation'), (req,res)=>{const operation=ownerOperation.get(req.params.operationId);if(!operation)return res.status(404).json({success:false,message:'Owner operation not found or expired'});res.json({success:true,operation});});
router.post('/operations/:operationId/cancel', auditAdminAction('sso.owner.operation.cancel','sso_owner_operation'), (req,res)=>{const operation=ownerOperation.cancel(req.params.operationId);if(!operation)return res.status(404).json({success:false,message:'Owner operation not found or expired'});res.json({success:true,operation});});
module.exports = router;
