const express = require('express');
const { requireSuperAdmin } = require('../middleware/superAdminAuth');
const { auditAdminAction } = require('../middleware/adminAudit');
const { generate, validateInput } = require('../services/ssoApplicationKit.service');
const { verify: verifyPlanToken, create: createPlanToken } = require('../services/ssoIntegrationPlanToken.service');

const router = express.Router();
router.use(requireSuperAdmin);
router.get('/catalog', auditAdminAction('sso.application_kit.catalog','sso_application_kit'), (req,res) => res.json({
  success:true,
  generatorVersion:'1.3.0',
  targets:['backend','frontend-user','frontend-admin'],
  security:['Authorization Code','S256 PKCE','encrypted stateless PKCE transaction','server-side client secret','application-owned JWT session','no third-party cookie/token copying','signed expiring source-review plan','signed generated-file manifest'],
  workflow:['read-only source analysis','cryptographically signed precise source plan','generated additive kit','cryptographically signed generated-file manifest','explicit Owner review before replacement','explicit deployment action'],
  replacementPolicy:'No automatic whole-file replacement. Existing authentication/session files require Owner review and explicit approval before replacement.'
}));
router.post('/generate', auditAdminAction('sso.application_kit.generate','sso_application_kit'), (req,res,next) => {
  try {
    const input=validateInput(req.body||{});
    const token=verifyPlanToken(req.body?.planToken);
    if (token.repository?.toLowerCase() !== String(req.body?.repository || token.repository || '').trim().toLowerCase()) throw Object.assign(new Error('Source-plan repository does not match the generation request'),{status:409});
    if (token.stack?.backend !== input.framework) throw Object.assign(new Error('Detected backend stack does not match the signed source-review plan'),{status:409});
    const generated=generate(input);
    const generatedManifestToken=createPlanToken({
      kind:'generated-manifest',
      repository:token.repository,
      branch:token.branch,
      sourcePlanIssuedAt:token.iat,
      sourcePlanExpiresAt:token.exp,
      reviewedFiles:token.reviewedFiles,
      applicationKey:input.appKey,
      generatedFiles:generated.manifest.generatedFiles
    });
    res.status(200).json({success:true,sourcePlan:{repository:token.repository,branch:token.branch,expiresAt:token.exp,reviewedFiles:token.reviewedFiles},generatedManifestToken,...generated});
  } catch(e){next(e);}
});
module.exports = router;
