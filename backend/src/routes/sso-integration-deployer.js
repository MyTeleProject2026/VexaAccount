const express = require('express');
const { requireSuperAdmin } = require('../middleware/superAdminAuth');
const { auditAdminAction } = require('../middleware/adminAudit');
const { deploy, status } = require('../services/ssoIntegrationDeployer.service');

const router = express.Router();
router.use(requireSuperAdmin);

router.get('/status', auditAdminAction('sso.integration.github.status','sso_integration'), async (req, res, next) => {
  try { res.json({ success: true, configured: Boolean(process.env.GITHUB_SSO_DEPLOY_TOKEN), allowlistEnabled: Boolean(String(process.env.GITHUB_SSO_ALLOWED_REPOSITORIES || '').trim()) }); }
  catch (e) { next(e); }
});

router.post('/preflight', auditAdminAction('sso.integration.github.preflight','sso_integration'), async (req, res, next) => {
  try {
    const repository = String(req.body.repository || '').trim();
    const branch = String(req.body.branch || 'main').trim() || 'main';
    const result = await status(repository, branch);
    res.json({ success: true, repository: result });
  }
  catch (e) { next(e); }
});

router.post('/deploy', auditAdminAction('sso.integration.github.deploy','sso_integration'), async (req, res, next) => {
  try {
    const result = await deploy({
      repository: req.body.repository,
      branch: req.body.branch,
      files: req.body.files,
      commitMessage: req.body.commitMessage,
      pathPrefix: req.body.pathPrefix,
      expectedHeadSha: req.body.expectedHeadSha,
      reviewedFiles: req.body.reviewedFiles,
      planToken: req.body.planToken,
      generatedManifestToken: req.body.generatedManifestToken
    });
    res.status(201).json({ success: true, message: 'SSO integration committed to target repository', deployment: result });
  } catch (e) { next(e); }
});

module.exports = router;
