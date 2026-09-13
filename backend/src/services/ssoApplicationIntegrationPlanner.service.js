const axios = require('axios');
const crypto = require('crypto');
const { create: createPlanToken } = require('./ssoIntegrationPlanToken.service');
const { getSnapshot, getLatestSnapshot } = require('./ssoApplicationAnalyzer.service');
const API = String(process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/$/, '');
const TOKEN = String(process.env.GITHUB_SSO_ANALYZE_TOKEN || process.env.GITHUB_SSO_DEPLOY_TOKEN || '').trim();
const ALLOWED = String(process.env.GITHUB_SSO_ALLOWED_REPOSITORIES || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
const MAX_FILE_BYTES = 400000;
const MAX_FILES = 30;
const MAX_CONCURRENCY = 6;
const SECRET_FILE = /(^|\/)(\.env(?:\..*)?|.*\.pem|.*\.key|.*credentials.*|.*secret.*)$/i;
function fail(message,status=400){throw Object.assign(new Error(message),{status});}
function repoName(value){const repo=String(value||'').trim().replace(/^https?:\/\/github\.com\//i,'').replace(/\/$/,'').replace(/\.git$/i,'');if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo))fail('repository must use owner/repository format');if(ALLOWED.length&&!ALLOWED.includes(repo.toLowerCase()))fail('Target repository is not allowlisted for Owner SSO planning',403);return repo;}
function headers(){if(!TOKEN)fail('GitHub source analysis is not configured. Set GITHUB_SSO_ANALYZE_TOKEN on the VexaAccount backend.',503);return{Authorization:`Bearer ${TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'VexaAccount-Owner-SSO-Planner'};}
async function request(path,ctx){try{ctx?.heartbeat?.('github-request');return(await axios.get(API+path,{headers:headers(),timeout:10000,maxContentLength:2000000,signal:ctx?.signal})).data;}catch(e){if(ctx?.isCancelled?.())throw e;throw Object.assign(new Error(`GitHub source planning: ${e.response?.data?.message||e.message}`),{status:e.response?.status||502});}}
function decode(content){return Buffer.from(String(content||''),'base64').toString('utf8');}
function sha256(text){return crypto.createHash('sha256').update(text,'utf8').digest('hex');}
function anchors(path,text){const lines=text.split(/\r?\n/);const tests=[['auth-import',/jsonwebtoken|passport|openid|oauth|auth0|firebase-admin|clerk/i],['session-cookie',/res\.cookie|set-cookie|session\(|express-session|cookie-session/i],['bearer-middleware',/authorization.*bearer|bearer.*token|req\.headers\.authorization/i],['login-route',/router\.(get|post)\([^\n]*(login|signin|sign-in)/i],['callback-route',/router\.(get|post)\([^\n]*(callback|oauth|sso)/i],['frontend-login',/login|signIn|sign-in|authenticate|auth\./i]];return tests.filter(([,re])=>re.test(text)).map(([name])=>{const line=lines.findIndex(l=>tests.find(([n])=>n===name)[1].test(l));return{name,line:line>=0?line+1:null};});}
function actionFor(path,text,stack){const p=path.toLowerCase();const isAuth=/(auth|login|session|jwt|oauth|sso|passport|security|middleware|guard)/i.test(p)||/jsonwebtoken|passport|oauth|openid|authorization.*bearer/i.test(text);const isEntry=/(^|\/)(server|app|index|main|bootstrap)\.(js|jsx|ts|tsx|mjs|cjs|py)$/i.test(path);if(isAuth)return{action:'patch-candidate',confidence:'high',reason:'Authentication/session ownership is application-specific; preserve existing behavior and add VexaAccount SSO as an additive path.'};if(isEntry&&/Node\.js\/(Express|NestJS)/i.test(stack.backend||''))return{action:'mount-candidate',confidence:'high',reason:'Existing backend entry point may register the generated VexaAccount integration without replacing application authentication.'};if(/(^|\/)(app|main|index)\.(jsx?|tsx?)$/i.test(path)&&/(React|Next\.js|Vue|Svelte)/i.test(stack.frontend||''))return{action:'wire-candidate',confidence:'medium',reason:'Frontend entry/auth surface can call the backend SSO redirect without exposing secrets.'};return{action:'review',confidence:'low',reason:'File was selected by the Owner/analyzer but no safe automatic integration anchor was established.'};}
async function mapConcurrent(items,limit,worker){const out=new Array(items.length);let cursor=0;async function run(){while(true){const i=cursor++;if(i>=items.length)return;out[i]=await worker(items[i],i);}}await Promise.all(Array.from({length:Math.min(limit,items.length)},run));return out;}
async function plan(input={},ctx={}){
  const repository=repoName(input.repository);ctx.progress?.('REPOSITORY',`Opening ${repository}`,2);
  const meta=await request(`/repos/${repository}`,ctx);
  const branch=String(input.branch||meta.default_branch||'main').trim();
  if(!/^[A-Za-z0-9._\/-]{1,100}$/.test(branch)||branch.includes('..'))fail('Invalid target branch');
  const selected=Array.isArray(input.files)?input.files.map(v=>String(v).trim()).filter(Boolean).slice(0,MAX_FILES):[];
  if(!selected.length)fail('At least one source file must be selected for precise planning');
  const stack={frontend:String(input.detected?.frontend||'unknown'),backend:String(input.detected?.backend||'unknown'),language:String(input.detected?.language||'unknown')};
  const hasAdminFrontend=input.hasAdminFrontend===undefined?true:(input.hasAdminFrontend===true||String(input.hasAdminFrontend).toLowerCase()==='true');
  const topology={backend:true,frontendUser:true,frontendAdmin:hasAdminFrontend};
  const revision=String(input.revision||input.analyzedRevision||'').trim();
  const cached=(revision?getSnapshot(repository,branch,revision):null)||getLatestSnapshot(repository,branch);
  let acquisition='github-contents-api';
  let effectiveRevision=revision;
  let reviewed;
  const eligible=selected.filter(path=>!SECRET_FILE.test(path));
  if(!eligible.length)fail('No eligible source files remain after security filtering');
  if(cached){
    acquisition='analyzer-snapshot-cache'; effectiveRevision=cached.revision;
    ctx.progress?.('SOURCE REVIEW',`Reviewing ${eligible.length} selected files from analyzed revision ${cached.revision.slice(0,12)}.`,10);
    reviewed=eligible.map((path,i)=>{if(ctx.isCancelled?.())throw new Error('Operation cancelled');const item=cached.entries.get(path);if(!item)return null;const text=item.text;if(Buffer.byteLength(text,'utf8')>MAX_FILE_BYTES)return null;ctx.heartbeat?.('snapshot-source-review');ctx.progress?.('SOURCE REVIEW',`Inspected ${i+1}/${eligible.length}: ${path}`,10+Math.round(((i+1)/eligible.length)*75));return{path,blobSha:item.sha,sourceSha256:sha256(text),size:text.length,anchors:anchors(path,text),...actionFor(path,text,stack)};});
    const missing=reviewed.reduce((count,item)=>count+(item?0:1),0);
    if(missing){
      ctx.progress?.('SOURCE REVIEW',`${missing} selected file${missing===1?'':'s'} not present in the analyzed snapshot; fetching only those files from GitHub.`,85);
      const missingPaths=eligible.filter((_,i)=>!reviewed[i]);
      const fetched=await mapConcurrent(missingPaths,MAX_CONCURRENCY,async(path)=>{ctx.heartbeat?.('github-source-fallback');const data=await request(`/repos/${repository}/contents/${path}?ref=${encodeURIComponent(branch)}`,ctx);if(Number(data.size||0)>MAX_FILE_BYTES)return null;const text=decode(data.content);return{path,blobSha:data.sha,sourceSha256:sha256(text),size:text.length,anchors:anchors(path,text),...actionFor(path,text,stack)};});
      const byPath=new Map(fetched.filter(Boolean).map(item=>[item.path,item])); reviewed=reviewed.map(item=>item||byPath.get(eligible.find(path=>!item&&missingPaths.includes(path)))||null);
      const stillMissing=reviewed.filter(Boolean).length<eligible.length;if(stillMissing) reviewed=eligible.map((path,i)=>reviewed[i]||byPath.get(path)||null);
    }
  } else {
    ctx.progress?.('SOURCE REVIEW',`Reviewing ${eligible.length} selected source files with bounded parallel GitHub reads.`,10);
    reviewed=await mapConcurrent(eligible,MAX_CONCURRENCY,async(path,i)=>{ctx.heartbeat?.('source-review');if(ctx.isCancelled?.())throw new Error('Operation cancelled');const data=await request(`/repos/${repository}/contents/${path}?ref=${encodeURIComponent(branch)}`,ctx);if(Number(data.size||0)>MAX_FILE_BYTES)return null;const text=decode(data.content);ctx.progress?.('SOURCE REVIEW',`Inspected ${i+1}/${eligible.length}: ${path}`,10+Math.round(((i+1)/eligible.length)*75));return{path,blobSha:data.sha,sourceSha256:sha256(text),size:text.length,anchors:anchors(path,text),...actionFor(path,text,stack)};});
  }
  const valid=reviewed.filter(Boolean);if(!valid.length)fail('No eligible source files remain after security filtering');
  ctx.progress?.('PLAN BUILD',`Building SHA-bound integration plan for ${valid.length} files.`,90);
  const planToken=createPlanToken({repository,branch,revision:effectiveRevision||null,stack,topology,reviewedFiles:valid.map(f=>({path:f.path,blobSha:f.blobSha,sourceSha256:f.sourceSha256}))});
  ctx.progress?.('PLAN READY',`Signed review plan created for ${valid.length} files using ${acquisition}.`,100);
  return{success:true,mode:'read-only',repository:{name:repository,branch,url:meta.html_url,revision:effectiveRevision||null},stack,topology,reviewedFiles:valid,planToken,acquisition,generatedFiles:['backend/src/integrations/vexaaccount-sso.js','backend/src/routes/vexaaccount-auth.js','frontend-user/src/integrations/vexaaccount.js',...(hasAdminFrontend?['frontend-admin/src/integrations/vexaaccount.js']:[]),'backend/.env.vexaaccount.example','VEXAACCOUNT_SSO_INTEGRATION.md'],installationGuard:'Before any replacement or patch is applied, the current target blob SHA must exactly match this plan. A mismatch requires a new read-only plan.',replacementPolicy:'No automatic whole-file replacement. Owner approval is required after source, SHA, anchors, and generated replacement are reviewed.',warnings:['No target repository files were modified.','Secrets and credential files are excluded.','The application remains the owner of its existing authentication/session behavior.','No third-party browser cookies or raw third-party tokens are copied.','This source plan is cryptographically signed and expires after 15 minutes.','Admin frontend integration is optional; when disabled, no admin frontend source is generated or installed.']};}
module.exports={plan,repoName};
