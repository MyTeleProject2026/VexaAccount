const axios = require('axios');

const API = String(process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/$/, '');
const TOKEN = String(process.env.GITHUB_SSO_ANALYZE_TOKEN || process.env.GITHUB_SSO_DEPLOY_TOKEN || '').trim();
const ALLOWED = String(process.env.GITHUB_SSO_ALLOWED_REPOSITORIES || '')
  .split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
const MAX_FILES = 120;
const MAX_FILE_BYTES = 400_000;
const SECRET_FILE = /(^|\/)(\.env(?:\..*)?|.*\.pem|.*\.key|.*credentials.*|.*secret.*)$/i;
const SOURCE_EXT = /\.(js|jsx|ts|tsx|mjs|cjs|json|py|rb|php|go|java|kt|cs|rs|vue|svelte|html|css|yml|yaml)$/i;
const REQUEST_TIMEOUT_MS = 15_000;
const REQUEST_HEARTBEAT_MS = 4_000;
const TREE_MAX_BYTES = 20_000_000;

function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
function repoName(value) {
  let repo = String(value || '').trim();
  repo = repo
    .replace(/^git\+https?:\/\/github\.com\//i, '')
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/^git@github\.com:/i, '')
    .replace(/^ssh:\/\/git@github\.com\//i, '')
    .replace(/^github\.com\//i, '')
    .replace(/^www\.github\.com\//i, '')
    .replace(/\/$/, '')
    .replace(/\.git$/i, '');
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) fail('repository must use owner/repository format');
  if (ALLOWED.length && !ALLOWED.includes(repo.toLowerCase())) fail('Target repository is not allowlisted for Owner SSO analysis', 403);
  return repo;
}
function headers() {
  if (!TOKEN) fail('GitHub source analysis is not configured. Set GITHUB_SSO_ANALYZE_TOKEN on the VexaAccount backend.', 503);
  return { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'VexaAccount-Owner-SSO-Analyzer' };
}

async function request(method, path, ctx, detail = 'Waiting for GitHub…', maxContentLength = 2_000_000) {
  let ticker;
  try {
    ctx?.heartbeat?.(`GitHub request active: ${detail}`);
    ticker = setInterval(() => {
      try { ctx?.heartbeat?.(`GitHub request active: ${detail}`); } catch (_) {}
    }, REQUEST_HEARTBEAT_MS);
    ticker.unref?.();
    const r = await axios({
      method,
      url: API + path,
      headers: headers(),
      timeout: REQUEST_TIMEOUT_MS,
      maxContentLength,
      maxBodyLength: maxContentLength,
      signal: ctx?.signal
    });
    ctx?.heartbeat?.(`GitHub request completed: ${detail}`);
    return r.data;
  } catch (e) {
    if (e?.code === 'ERR_CANCELED' || ctx?.isCancelled?.()) {
      throw Object.assign(new Error('Owner operation cancelled'), { code: 'OWNER_OPERATION_CANCELLED' });
    }
    if (e?.code === 'ECONNABORTED' || e?.code === 'ETIMEDOUT') {
      throw Object.assign(new Error(`GitHub source analysis: request timed out after ${REQUEST_TIMEOUT_MS / 1000}s while ${detail}`), { status: 504, code: 'GITHUB_REQUEST_TIMEOUT' });
    }
    if (e?.code === 'ERR_FR_MAX_BODY_LENGTH_EXCEEDED') {
      throw Object.assign(new Error(`GitHub source analysis: response exceeded the ${Math.round(maxContentLength / 1_000_000)}MB safety limit while ${detail}`), { status: 502, code: 'GITHUB_RESPONSE_TOO_LARGE' });
    }
    const status = e.response?.status || 502;
    const message = e.response?.data?.message || e.message || 'GitHub API request failed';
    throw Object.assign(new Error(`GitHub source analysis: ${message}`), { status });
  } finally {
    if (ticker) clearInterval(ticker);
  }
}

function decode(content) { return Buffer.from(String(content || ''), 'base64').toString('utf8'); }
function classify(path, text) {
  const p = path.toLowerCase();
  const findings = [];
  if (/(auth|login|session|jwt|oauth|sso|passport|security|middleware|guard|protected)/i.test(p)) findings.push('authentication/security candidate');
  if (/(route|router|server|app|index|main)/i.test(p)) findings.push('server/routing candidate');
  if (/(\.env|secret|credential|\.pem|\.key)/i.test(p)) findings.push('secret/config candidate');
  if (/jsonwebtoken|jwt\.sign|jwt\.verify|bearer\s+/i.test(text)) findings.push('JWT/bearer authentication');
  if (/passport|oauth|openid|authorization[_ -]?code|pkce|code_challenge/i.test(text)) findings.push('OAuth/OIDC integration');
  if (/express\s*\(|fastapi|flask|django|nestjs|@nestjs|springboot|gin\.|fiber\./i.test(text)) findings.push('backend framework/runtime');
  if (/react|createRoot|next\//i.test(text)) findings.push('React/Next frontend');
  if (/vue|svelte/i.test(text)) findings.push('Vue/Svelte frontend');
  return [...new Set(findings)];
}
function frameworkFrom(manifest, paths, texts) {
  const all = [JSON.stringify(manifest || {}), ...paths, ...texts].join('\n').toLowerCase();
  let frontend = 'unknown', backend = 'unknown', language = 'javascript';
  if (/next(\.js|\/)|"next"/.test(all)) frontend = 'Next.js';
  else if (/react|create-react-app|vite/.test(all)) frontend = 'React/Vite';
  else if (/vue/.test(all)) frontend = 'Vue';
  else if (/svelte/.test(all)) frontend = 'Svelte';
  if (/express/.test(all)) backend = 'Node.js/Express';
  else if (/fastapi|flask|django|pyproject\.toml|requirements\.txt/.test(all)) { backend = 'Python'; language = 'python'; }
  else if (/nestjs|@nestjs/.test(all)) backend = 'Node.js/NestJS';
  else if (/spring-boot|springframework/.test(all)) { backend = 'Java/Spring'; language = 'java'; }
  else if (/go\.mod|gin-gonic|fiber\.go/.test(all)) { backend = 'Go'; language = 'go'; }
  return { frontend, backend, language };
}
function buildPlan(files, detected) {
  const auth = files.filter(f => f.findings.some(x => x.includes('authentication') || x.includes('OAuth') || x.includes('JWT'))).map(f => f.path);
  const routes = files.filter(f => f.findings.some(x => x.includes('routing'))).map(f => f.path);
  const config = files.filter(f => f.findings.some(x => x.includes('secret/config'))).map(f => f.path);
  const add = ['backend/src/integrations/vexaaccount-sso.js','backend/src/routes/vexaaccount-auth.js','frontend-user/src/integrations/vexaaccount.js','frontend-admin/src/integrations/vexaaccount.js','backend/.env.vexaaccount.example','VEXAACCOUNT_SSO_INTEGRATION.md'];
  const review = auth.slice(0, 20);
  const operations = review.map(path => ({ path, action: 'review-and-patch-only', reason: 'Existing authentication/session ownership must be preserved; integration should be mounted through the application\'s existing middleware.' }));
  if (detected.backend === 'Node.js/Express' || detected.backend === 'Node.js/NestJS') operations.push({ path: 'backend entry/router', action: 'mount-generated-vexaaccount-router', reason: 'Additive route registration; do not replace existing auth middleware.' });
  if (['React/Vite','Next.js','Vue','Svelte'].includes(detected.frontend)) operations.push({ path: 'frontend auth/login entry', action: 'wire-generated-login-adapter', reason: 'Use backend redirect; never expose client secret or application JWT secret.' });
  return { strategy: 'additive-first', detected, authenticationCandidates: auth.slice(0,30), routeCandidates: routes.slice(0,30), configurationCandidates: config.slice(0,20), filesToAdd: add, filesToReviewBeforeReplacement: review, operations, replacementPolicy: 'No automatic whole-file replacement. A target file may be replaced only after its current contents, hash, and integration anchors are reviewed and the Owner explicitly approves installation.', warnings: ['Analysis is read-only; no target repository files are changed by this endpoint.','Existing authentication files should be patched only after Owner review because the target application owns its session/JWT model.','Client secrets must remain server-side and the target application JWT secret must never be sent to VexaAccount.','Third-party browser cookies or raw third-party access tokens are never copied.'] };
}

async function analyze(input = {}, ctx) {
  const repository = repoName(input.repository);
  ctx?.progress?.('REPOSITORY', `Loading repository metadata for ${repository}…`, 5);
  const meta = await request('GET', `/repos/${repository}`, ctx, `loading repository metadata for ${repository}`);
  if (ctx?.isCancelled?.()) throw Object.assign(new Error('Owner operation cancelled'), { code: 'OWNER_OPERATION_CANCELLED' });

  const branch = String(input.branch || meta.default_branch || 'main').trim();
  ctx?.progress?.('BRANCH', `Resolving target branch ${branch}…`, 10);
  if (!/^[A-Za-z0-9._\/-]{1,100}$/.test(branch) || branch.includes('..')) fail('Invalid target branch');
  const ref = await request('GET', `/repos/${repository}/git/ref/heads/${encodeURIComponent(branch)}`, ctx, `resolving branch ${branch}`);
  const treeSha = ref?.object?.sha;
  if (!treeSha) fail(`GitHub did not return a tree revision for ${repository}@${branch}`, 502);

  ctx?.progress?.('TREE', `Reading ${repository}@${branch} repository tree…`, 15);
  const tree = await request('GET', `/repos/${repository}/git/trees/${encodeURIComponent(treeSha)}?recursive=1`, ctx, `reading ${repository}@${branch} repository tree`, TREE_MAX_BYTES);
  if (!Array.isArray(tree.tree)) fail('GitHub repository tree could not be read', 502);
  if (tree.truncated) ctx?.event?.('TREE WARNING', 'GitHub returned a truncated repository tree; analysis will continue within the configured safety limit.', 18);

  const candidates = tree.tree.filter(x => x.type === 'blob' && SOURCE_EXT.test(x.path) && !SECRET_FILE.test(x.path)).slice(0, MAX_FILES);
  const eligible = candidates.filter(item => Number(item.size || 0) <= MAX_FILE_BYTES);
  const skippedLarge = candidates.length - eligible.length;
  ctx?.progress?.('FILES', `Selected ${eligible.length} eligible source files${skippedLarge ? `; skipped ${skippedLarge} oversized files` : ''}.`, 20);

  const files = [];
  let completed = 0;
  for (const item of eligible) {
    if (ctx?.isCancelled?.()) throw Object.assign(new Error('Owner operation cancelled'), { code: 'OWNER_OPERATION_CANCELLED' });
    const filePercent = 20 + Math.round((completed / Math.max(1, eligible.length)) * 60);
    ctx?.progress?.('SOURCE', `Reading ${completed + 1}/${eligible.length}: ${item.path}`, filePercent);
    try {
      const data = await request('GET', `/repos/${repository}/contents/${item.path}?ref=${encodeURIComponent(branch)}`, ctx, `reading source file ${item.path}`);
      const text = decode(data.content);
      const findings = classify(item.path, text);
      files.push({ path: item.path, size: Number(item.size || text.length), findings });
      completed += 1;
      const progress = 20 + Math.round((completed / Math.max(1, eligible.length)) * 60);
      ctx?.progress?.('SOURCE', `Inspected ${completed}/${eligible.length}: ${item.path}`, Math.min(80, progress));
    } catch (error) {
      if (error?.code === 'OWNER_OPERATION_CANCELLED') throw error;
      completed += 1;
      ctx?.event?.('SOURCE SKIP', `Could not read ${item.path}: ${error?.message || 'unknown error'}; continuing.`, Math.min(80, 20 + Math.round((completed / Math.max(1, eligible.length)) * 60)));
    }
  }

  ctx?.progress?.('DEPENDENCIES', 'Inspecting package/manifests and detected application stack…', 85);
  const packagePaths = files.map(x => x.path).filter(x => /(^|\/)(package\.json|requirements\.txt|pyproject\.toml|go\.mod|pom\.xml|build\.gradle|Cargo\.toml)$/i.test(x));
  const manifestTexts = [];
  for (const p of packagePaths.slice(0, 6)) {
    if (ctx?.isCancelled?.()) throw Object.assign(new Error('Owner operation cancelled'), { code: 'OWNER_OPERATION_CANCELLED' });
    try {
      const d = await request('GET', `/repos/${repository}/contents/${p}?ref=${encodeURIComponent(branch)}`, ctx, `reading dependency manifest ${p}`);
      manifestTexts.push(decode(d.content));
      ctx?.event?.('DEPENDENCY', `Read manifest ${p}`, 87);
    } catch (error) {
      if (error?.code === 'OWNER_OPERATION_CANCELLED') throw error;
      ctx?.event?.('DEPENDENCY SKIP', `Manifest ${p} could not be read; continuing.`, 87);
    }
  }

  const detected = frameworkFrom(null, files.map(x => x.path), manifestTexts);
  ctx?.progress?.('ANALYSIS', `Classifying authentication, routing and runtime findings for ${files.length} inspected files…`, 92);
  const result = {
    success: true,
    repository: { name: repository, private: Boolean(meta.private), defaultBranch: meta.default_branch, analyzedBranch: branch, revision: treeSha, url: meta.html_url },
    limits: { maxFiles: MAX_FILES, maxFileBytes: MAX_FILE_BYTES },
    summary: { sourceFilesInspected: files.length, treeEntries: tree.tree.length, treeTruncated: Boolean(tree.truncated) },
    detected,
    files: files.map(f => ({ path: f.path, size: f.size, findings: f.findings })),
    plan: buildPlan(files, detected)
  };
  ctx?.progress?.('FINDINGS', `Analysis findings assembled: ${files.length} source files inspected; stack ${detected.backend}/${detected.frontend}.`, 97);
  return result;
}
module.exports = { analyze, repoName };