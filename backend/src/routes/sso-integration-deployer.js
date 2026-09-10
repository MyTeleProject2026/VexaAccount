const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const { requireSuperAdmin } = require('../middleware/superAdminAuth');
const { auditAdminAction } = require('../middleware/adminAudit');
const { deploy, status } = require('../services/ssoIntegrationDeployer.service');
const { create: createPlanToken } = require('../services/ssoIntegrationPlanToken.service');

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
  } catch (e) { next(e); }
});

function configuredRepo(value) {
  if (!String(process.env.GITHUB_SSO_DEPLOY_TOKEN || '').trim()) throw Object.assign(new Error('GitHub SSO deployment is not configured.'), { status: 503 });
  const repo = String(value || '').trim().replace(/^https?:\/\/github\.com\//i, '').replace(/\/$/,'').replace(/\.git$/i,'');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) throw Object.assign(new Error('repository must use owner/repository format'), { status: 400 });
  const allowed = String(process.env.GITHUB_SSO_ALLOWED_REPOSITORIES || '').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  if (allowed.length && !allowed.includes(repo.toLowerCase())) throw Object.assign(new Error('Target repository is not allowlisted for Owner source repair'), { status: 403 });
  return repo;
}
function branchName(value) {
  const branch=String(value||'main').trim()||'main';
  if (!/^[A-Za-z0-9._\/-]{1,100}$/.test(branch)||branch.includes('..')) throw Object.assign(new Error('Invalid target branch'),{status:400});
  return branch;
}
function sourcePath(value) {
  const p=String(value||'').trim().replace(/^\/+/, '');
  if (!p||p.includes('..')||p.startsWith('.git/')||p.length>240||!/^[A-Za-z0-9._\/-]+$/.test(p)) throw Object.assign(new Error('Invalid source file path'),{status:400});
  if (/(^|\/)(\.env(?:\..*)?|.*\.pem|.*\.key|.*credentials.*|.*secret.*)$/i.test(p)) throw Object.assign(new Error('Secret/config credential files cannot be edited through the generic Owner repair control'),{status:403});
  return p;
}
function githubHeaders(){return {Authorization:`Bearer ${String(process.env.GITHUB_SSO_DEPLOY_TOKEN).trim()}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'VexaAccount-Owner-Source-Repair'};}
async function githubGet(path){try{const r=await axios.get(String(process.env.GITHUB_API_URL||'https://api.github.com').replace(/\/$/,'')+path,{headers:githubHeaders(),timeout:15000,maxContentLength:3000000});return r.data;}catch(e){throw Object.assign(new Error(`GitHub source repair: ${e.response?.data?.message||e.message||'GitHub API request failed'}`),{status:e.response?.status||502});}}

router.post('/patch/prepare', auditAdminAction('sso.integration.github.patch.prepare','sso_source_repair'), async (req,res,next)=>{
  try {
    const repository=configuredRepo(req.body.repository), branch=branchName(req.body.branch), path=sourcePath(req.body.path);
    const current=await githubGet(`/repos/${repository}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`);
    if(!current?.sha||!current?.content) throw Object.assign(new Error('Target source file could not be read'),{status:502});
    const original=Buffer.from(String(current.content).replace(/\s/g,''),'base64').toString('utf8');
    if(req.body.content===undefined){
      return res.json({success:true,repository:{repository,branch},file:{path,blobSha:String(current.sha),size:Buffer.byteLength(original,'utf8')},content:original,policy:{mode:'read-only-source-inspection',secretsBlocked:true}});
    }
    const reason=String(req.body.reason||'Owner-reviewed source repair').trim().slice(0,500)||'Owner-reviewed source repair';
    const replacement=String(req.body.content??'');
    if(!replacement||Buffer.byteLength(replacement,'utf8')>2000000) throw Object.assign(new Error('Replacement source must be 1 byte to 2 MB'),{status:400});
    const replacementSha256=crypto.createHash('sha256').update(replacement,'utf8').digest('hex');
    const originalSha256=crypto.createHash('sha256').update(original,'utf8').digest('hex');
    if(original===replacement) throw Object.assign(new Error('Replacement is identical to the current source'),{status:409});
    const reviewedFiles=[{path,blobSha:String(current.sha)}];
    const planToken=createPlanToken({kind:'source-repair-plan',repository,branch,reviewedFiles,reason});
    const generatedManifestToken=createPlanToken({kind:'generated-manifest',repository,branch,generatedFiles:[{path,sha256:replacementSha256,size:Buffer.byteLength(replacement,'utf8')}]});
    res.json({success:true,repository:{repository,branch,headSha:null},file:{path,blobSha:String(current.sha),originalSha256,replacementSha256,size:Buffer.byteLength(replacement,'utf8')},reviewedFiles,planToken,generatedManifestToken,files:[{path,content:replacement}],policy:{mode:'explicit-owner-review',secretsBlocked:true,recheckBeforeCommit:true,noForcePush:true},reason});
  }catch(e){next(e);}
});

router.post('/deploy', auditAdminAction('sso.integration.github.deploy','sso_integration'), async (req, res, next) => {
  try {
    const result = await deploy({
      repository: req.body.repository,
      branch: req.body.branch,
      files: req.body.files,
      replacements: req.body.replacements,
      commitMessage: req.body.commitMessage,
      pathPrefix: req.body.pathPrefix,
      expectedHeadSha: req.body.expectedHeadSha,
      reviewedFiles: req.body.reviewedFiles,
      planToken: req.body.planToken,
      generatedManifestToken: req.body.generatedManifestToken,
      replacementManifestToken: req.body.replacementManifestToken
    });
    res.status(201).json({ success: true, message: 'SSO integration committed to target repository', deployment: result });
  } catch (e) { next(e); }
});

module.exports = router;
