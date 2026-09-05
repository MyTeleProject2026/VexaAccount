const axios = require('axios');

const API = String(process.env.GITHUB_API_URL || 'https://api.github.com').replace(/\/$/, '');
const TOKEN = String(process.env.GITHUB_SSO_DEPLOY_TOKEN || '').trim();
const ALLOWED = String(process.env.GITHUB_SSO_ALLOWED_REPOSITORIES || '')
  .split(',').map(v => v.trim().toLowerCase()).filter(Boolean);

function assertConfigured(repository) {
  if (!TOKEN) throw Object.assign(new Error('GitHub SSO deployment is not configured. Set GITHUB_SSO_DEPLOY_TOKEN on the VexaAccount backend.'), { status: 503 });
  const repo = String(repository || '').trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) throw Object.assign(new Error('repository must use owner/repository format'), { status: 400 });
  if (ALLOWED.length && !ALLOWED.includes(repo.toLowerCase())) throw Object.assign(new Error('Target repository is not allowlisted for Owner SSO deployment'), { status: 403 });
  return repo;
}

function headers() {
  return { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'VexaAccount-Owner-SSO' };
}

async function request(method, path, data) {
  try {
    const r = await axios({ method, url: API + path, headers: headers(), data, timeout: 15000 });
    return r.data;
  } catch (e) {
    const status = e.response?.status || 502;
    const message = e.response?.data?.message || e.message || 'GitHub API request failed';
    throw Object.assign(new Error(`GitHub deployment: ${message}`), { status });
  }
}

async function getBranch(repository, branch) {
  return request('GET', `/repos/${repository}/git/ref/heads/${encodeURIComponent(branch)}`);
}

async function deploy({ repository, branch = 'main', files, commitMessage = 'feat(auth): install VexaAccount SSO integration', pathPrefix = '' }) {
  const repo = assertConfigured(repository);
  const targetBranch = String(branch || 'main').trim();
  if (!/^[A-Za-z0-9._\/-]{1,100}$/.test(targetBranch) || targetBranch.includes('..')) throw Object.assign(new Error('Invalid target branch'), { status: 400 });
  if (!Array.isArray(files) || !files.length || files.length > 100) throw Object.assign(new Error('files must contain between 1 and 100 generated files'), { status: 400 });
  const prefix = String(pathPrefix || '').trim().replace(/^\/+|\/+$/g, '');
  if (prefix && !/^[A-Za-z0-9._\/-]{1,180}$/.test(prefix)) throw Object.assign(new Error('Invalid path prefix'), { status: 400 });
  const normalized = files.map(f => ({ path: String(f.path || '').replace(/^\/+/, ''), content: String(f.code ?? f.content ?? '') }))
    .filter(f => f.path && f.content.length <= 2_000_000 && !f.path.includes('..'));
  if (!normalized.length) throw Object.assign(new Error('No valid generated files supplied'), { status: 400 });

  const ref = await getBranch(repo, targetBranch);
  const parentSha = ref.object?.sha;
  if (!parentSha) throw Object.assign(new Error('Target branch does not resolve to a commit'), { status: 409 });
  const parent = await request('GET', `/repos/${repo}/git/commits/${parentSha}`);
  const baseTree = parent.tree?.sha;
  if (!baseTree) throw Object.assign(new Error('Target branch has no readable base tree'), { status: 409 });

  const treeElements = [];
  for (const f of normalized) {
    const blob = await request('POST', `/repos/${repo}/git/blobs`, { content: f.content, encoding: 'utf-8' });
    treeElements.push({ path: prefix ? `${prefix}/${f.path}` : f.path, mode: '100644', type: 'blob', sha: blob.sha });
  }
  const tree = await request('POST', `/repos/${repo}/git/trees`, { base_tree: baseTree, tree: treeElements });
  const message = String(commitMessage || '').trim().slice(0, 200) || 'feat(auth): install VexaAccount SSO integration';
  const commit = await request('POST', `/repos/${repo}/git/commits`, { message, tree: tree.sha, parents: [parentSha] });
  await request('PATCH', `/repos/${repo}/git/refs/heads/${encodeURIComponent(targetBranch)}`, { sha: commit.sha, force: false });
  return { repository: repo, branch: targetBranch, commitSha: commit.sha, commitUrl: `https://github.com/${repo}/commit/${commit.sha}`, files: treeElements.map(x => x.path) };
}

async function status(repository) {
  const repo = assertConfigured(repository);
  const data = await request('GET', `/repos/${repo}`);
  return { repository: repo, private: Boolean(data.private), defaultBranch: data.default_branch, permissions: data.permissions || {} };
}

module.exports = { deploy, status };
