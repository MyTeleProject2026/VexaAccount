const axios = require('axios');

const API = String(process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/$/, '');
// Keep analysis credentials separate from deployment credentials. The analyzer is read-only.
const TOKEN = String(process.env.GITHUB_SSO_ANALYZE_TOKEN || process.env.GITHUB_SSO_DEPLOY_TOKEN || '').trim();
const ALLOWED = String(process.env.GITHUB_SSO_ALLOWED_REPOSITORIES || '')
  .split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
const MAX_FILES = 120;
const MAX_FILE_BYTES = 400_000;
const SECRET_FILE = /(^|\/)(\.env(?:\..*)?|.*\.pem|.*\.key|.*credentials.*|.*secret.*)$/i;
const SOURCE_EXT = /\.(js|jsx|ts|tsx|mjs|cjs|json|py|rb|php|go|java|kt|cs|rs|vue|svelte|html|css|yml|yaml)$/i;

function fail(message, status = 400) { throw Object.assign(new Error(message), { status }); }
function repoName(value) {
  let repo = String(value || '').trim();
  // Accept the repository forms users naturally paste into Owner SSO Control:
  // owner/repository, github.com/owner/repository, and full HTTPS GitHub URLs.
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
async function request(method, path) {
  try {
    const r = await axios({ method, url: API + path, headers: headers(), timeout: 15000, maxContentLength: 2_000_000, maxBodyLength: 2_000_000 });
    return r.data;
  } catch (e) {
    const status = e.response?.status || 502;
    const message = e.response?.data?.message || e.message || 'GitHub API request failed';
    throw Object.assign(new Error(`GitHub source analysis: ${message}`), { status });
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
  if (detected.frontend === 'React/Vite' || detected.frontend === 'Next.js' || detected.frontend === 'Vue' || detected.frontend === 'Svelte') operations.push({ path: 'frontend auth/login entry', action: 'wire-generated-login-adapter', reason: 'Use backend redirect; never expose client secret or application JWT secret.' });
  return {
    strategy: 'additive-first',
    detected,
    authenticationCandidates: auth.slice(0,30),
    routeCandidates: routes.slice(0,30),
    configurationCandidates: config.slice(0,20),
    filesToAdd: add,
    filesToReviewBeforeReplacement: review,
    operations,
    replacementPolicy: 'No automatic whole-file replacement. A target file may be replaced only after its current contents, hash, and integration anchors are reviewed and the Owner explicitly approves installation.',
    warnings: [
      'Analysis is read-only; no target repository files are changed by this endpoint.',
      'Existing authentication files should be patched only after Owner review because the target application owns its session/JWT model.',
      'Client secrets must remain server-side and the target application JWT secret must never be sent to VexaAccount.',
      'Third-party browser cookies or raw third-party access tokens are never copied.'
    ]
  };
}
async function analyze(input = {}) {
  const repository = repoName(input.repository);
  const meta = await request('GET', `/repos/${repository}`);
  const branch = String(input.branch || meta.default_branch || 'main').trim();
  if (!/^[A-Za-z0-9._\/-]{1,100}$/.test(branch) || branch.includes('..')) fail('Invalid target branch');
  const tree = await request('GET', `/repos/${repository}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
  if (!Array.isArray(tree.tree)) fail('GitHub repository tree could not be read', 502);
  const candidates = tree.tree.filter(x => x.type === 'blob' && SOURCE_EXT.test(x.path) && !SECRET_FILE.test(x.path)).slice(0, MAX_FILES);
  const files = [];
  for (const item of candidates) {
    if (Number(item.size || 0) > MAX_FILE_BYTES) continue;
    try {
      const data = await request('GET', `/repos/${repository}/contents/${item.path}?ref=${encodeURIComponent(branch)}`);
      const text = decode(data.content);
      files.push({ path: item.path, size: Number(item.size || text.length), findings: classify(item.path, text) });
    } catch (_) { /* one unreadable source file must not abort the read-only analysis */ }
  }
  const packagePaths = files.map(x => x.path).filter(x => /(^|\/)(package\.json|requirements\.txt|pyproject\.toml|go\.mod|pom\.xml|build\.gradle|Cargo\.toml)$/i.test(x));
  const manifestTexts = [];
  for (const p of packagePaths.slice(0, 6)) {
    try { const d = await request('GET', `/repos/${repository}/contents/${p}?ref=${encodeURIComponent(branch)}`); manifestTexts.push(decode(d.content)); } catch (_) {}
  }
  const detected = frameworkFrom(null, files.map(x => x.path), manifestTexts);
  return {
    success: true,
    repository: { name: repository, private: Boolean(meta.private), defaultBranch: meta.default_branch, analyzedBranch: branch, url: meta.html_url },
    limits: { maxFiles: MAX_FILES, maxFileBytes: MAX_FILE_BYTES },
    summary: { sourceFilesInspected: files.length, treeEntries: tree.tree.length },
    detected,
    files: files.map(f => ({ path: f.path, size: f.size, findings: f.findings })),
    plan: buildPlan(files, detected)
  };
}
module.exports = { analyze, repoName };
