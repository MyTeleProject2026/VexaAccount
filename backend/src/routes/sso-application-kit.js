const express = require('express');
const { requireSuperAdmin } = require('../middleware/superAdminAuth');
const { auditAdminAction } = require('../middleware/adminAudit');
const { generate, validateInput } = require('../services/ssoApplicationKit.service');
const { generateTarget } = require('../services/ssoApplicationReplacement.service');
const { verify: verifyPlanToken, create: createPlanToken } = require('../services/ssoIntegrationPlanToken.service');

const router = express.Router();
router.use(requireSuperAdmin);
router.get('/catalog', auditAdminAction('sso.application_kit.catalog','sso_application_kit'), (req,res) => res.json({
  success:true,
  generatorVersion:'1.4.0',
  targets:['backend','frontend-user','frontend-admin'],
  topologies:[
    {key:'backend-user-admin',backend:true,frontendUser:true,frontendAdmin:true},
    {key:'backend-user-only',backend:true,frontendUser:true,frontendAdmin:false}
  ],
  security:['Authorization Code','S256 PKCE','encrypted stateless PKCE transaction','server-side client secret','application-owned JWT session','no third-party cookie/token copying','signed expiring source-review plan','signed generated-file manifest','exact reviewed-blob SHA replacement guard'],
  workflow:['read-only source analysis','cryptographically signed precise source plan','target-specific source reconstruction','target-specific replacement candidates','generated additive kit','cryptographically signed generated-file manifest','explicit Owner review before replacement','exact-blob preflight','explicit deployment action'],
  replacementPolicy:'Target-specific replacement candidates are generated only from the exact source revision that was reviewed. Deterministic anchors are required; files without a safe anchor are preserved unchanged rather than guessed.'
}));
router.post('/generate', auditAdminAction('sso.application_kit.generate','sso_application_kit'), (req,res,next) => {
  try {
    const input=validateInput(req.body||{});
    const token=verifyPlanToken(req.body?.planToken);
    if (token.repository?.toLowerCase() !== String(req.body?.repository || token.repository || '').trim().toLowerCase()) throw Object.assign(new Error('Source-plan repository does not match the generation request'),{status:409});
    if (token.stack?.backend !== input.framework) throw Object.assign(new Error('Detected backend stack does not match the signed source-review plan'),{status:409});
    const signedHasAdmin = token.topology?.frontendAdmin === undefined ? true : Boolean(token.topology.frontendAdmin);
    if (signedHasAdmin !== input.hasAdminFrontend) throw Object.assign(new Error('Selected Admin Frontend topology does not match the signed source-review plan. Rebuild the precise source plan after changing the topology.'),{status:409});
    const generated=generate(input);
    const generatedManifestToken=createPlanToken({
      kind:'generated-manifest',
      repository:token.repository,
      branch:token.branch,
      sourcePlanIssuedAt:token.iat,
      sourcePlanExpiresAt:token.exp,
      reviewedFiles:token.reviewedFiles,
      applicationKey:input.appKey,
      topology:generated.manifest.topology,
      generatedFiles:generated.manifest.generatedFiles
    });
    res.status(200).json({success:true,sourcePlan:{repository:token.repository,branch:token.branch,expiresAt:token.exp,reviewedFiles:token.reviewedFiles},generatedManifestToken,...generated});
  } catch(e){next(e);}
});
router.post('/generate-target-replacements', auditAdminAction('sso.application_kit.generate_target_replacements','sso_application_kit'), async (req,res,next) => {
  try {
    const token=verifyPlanToken(req.body?.planToken);
    if (!token?.repository || !token?.branch || !Array.isArray(token.reviewedFiles) || !token.reviewedFiles.length) throw Object.assign(new Error('A valid signed source-review plan is required'),{status:400});
    const requestedRepo=String(req.body?.repository||token.repository).trim().toLowerCase();
    if(requestedRepo!==String(token.repository).trim().toLowerCase()) throw Object.assign(new Error('Source-plan repository does not match the replacement request'),{status:409});
    const result=await generateTarget({repository:token.repository,branch:token.branch,reviewedFiles:token.reviewedFiles,stack:token.stack||{}});
    const replacementManifestToken=createPlanToken({kind:'target-replacement-manifest',repository:token.repository,branch:token.branch,sourcePlanIssuedAt:token.iat,sourcePlanExpiresAt:token.exp,reviewedFiles:token.reviewedFiles,replacements:result.files.map(f=>({path:f.path,originalBlobSha:f.originalBlobSha,originalSha256:f.originalSha256,replacementSha256:f.replacementSha256,changed:f.changed}))});
    res.json({...result,replacementManifestToken});
  }catch(e){next(e);}
});
module.exports = router;
