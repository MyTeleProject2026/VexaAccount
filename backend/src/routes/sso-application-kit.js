const express = require('express');
const { requireSuperAdmin } = require('../middleware/superAdminAuth');
const { auditAdminAction } = require('../middleware/adminAudit');
const { generate, validateInput } = require('../services/ssoApplicationKit.service');

const router = express.Router();
router.use(requireSuperAdmin);
router.get('/catalog', auditAdminAction('sso.application_kit.catalog','sso_application_kit'), (req,res) => res.json({
  success:true,
  generatorVersion:'1.2.0',
  targets:['backend','frontend-user','frontend-admin'],
  security:['Authorization Code','S256 PKCE','encrypted stateless PKCE transaction','server-side client secret','application-owned JWT session','no third-party cookie/token copying'],
  workflow:['read-only source analysis','integration planning','generated additive kit','explicit Owner review before replacement','explicit deployment action'],
  replacementPolicy:'No automatic whole-file replacement. Existing authentication/session files require Owner review and explicit approval before replacement.'
}));
router.post('/generate', auditAdminAction('sso.application_kit.generate','sso_application_kit'), (req,res,next) => {
  try {
    const input=validateInput(req.body||{});
    res.status(200).json({success:true,...generate(input)});
  } catch(e){next(e);}
});
module.exports = router;
