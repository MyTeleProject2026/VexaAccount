const express = require('express');
const { requireSuperAdmin } = require('../middleware/superAdminAuth');
const { auditAdminAction } = require('../middleware/adminAudit');
const { analyze } = require('../services/ssoApplicationAnalyzer.service');
const { plan } = require('../services/ssoApplicationIntegrationPlanner.service');

const router = express.Router();
router.use(requireSuperAdmin);
router.get('/catalog', auditAdminAction('sso.application_analyzer.catalog','sso_application_analyzer'), (req,res) => res.json({ success:true, mode:'read-only', maxFiles:120, maxFileBytes:400000, credentialEnv:'GITHUB_SSO_ANALYZE_TOKEN', fallbackCredentialEnv:'GITHUB_SSO_DEPLOY_TOKEN', supports:['private-repositories-via-server-side-GitHub-token','framework-detection','authentication-file-detection','route-detection','integration-plan','precise-source-review','blob-sha-installation-guard','explicit-replacement-review-policy'] }));
router.post('/analyze', auditAdminAction('sso.application_analyzer.analyze','sso_application_analyzer'), async (req,res,next) => { try { res.json(await analyze(req.body || {})); } catch (e) { next(e); } });
router.post('/plan', auditAdminAction('sso.application_analyzer.plan','sso_application_analyzer'), async (req,res,next) => { try { res.json(await plan(req.body || {})); } catch (e) { next(e); } });
module.exports = router;
