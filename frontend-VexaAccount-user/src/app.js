const API_BASE = window.VEXA_ACCOUNT_API_BASE || '';
const api = (path, options = {}) => fetch(`${API_BASE}${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });

async function loadSession() {
  const r = await api('/api/auth/session');
  if (!r.ok) return null;
  return r.json();
}

async function load(path) {
  const r = await api(path);
  if (!r.ok) throw new Error((await r.text()) || `Request failed: ${r.status}`);
  return r.json();
}

function esc(v) { return String(v ?? '').replace(/[&<>\"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

async function boot() {
  const root = document.getElementById('app');
  const session = await loadSession();
  if (!session?.authenticated) {
    root.innerHTML = `<main class="shell"><section class="card"><p class="eyebrow">VEXA ACCOUNT</p><h1>Your account, everywhere.</h1><p>Sign in to manage connected applications, sessions, and security.</p><a class="button" href="${API_BASE}/auth/login-page">Sign in</a></section></main>`;
    return;
  }
  const [apps, sessions, events] = await Promise.all([
    load('/api/account/apps'), load('/api/account/sessions'), load('/api/account/security/events')
  ]);
  root.innerHTML = `<header><div><span class="eyebrow">VEXA ACCOUNT</span><h1>Account Center</h1><p>Welcome back, ${esc(session.user?.email || session.user?.username || 'User')}.</p></div><button id="logout" class="button secondary">Sign out</button></header><main class="grid"><section class="card"><h2>Connected applications</h2><div>${(apps.applications || []).map(a => `<article class="row"><div><strong>${esc(a.name || a.client_id)}</strong><small>${esc(a.client_id)} · ${esc(a.status || 'active')}</small></div><button data-revoke="${esc(a.client_id)}" class="danger">Revoke</button></article>`).join('') || '<p class="muted">No connected applications.</p>'}</div></section><section class="card"><h2>Active sessions</h2><div>${(sessions.sessions || []).map(s => `<article class="row"><div><strong>${esc(s.device || s.user_agent || 'Browser session')}</strong><small>${esc(s.ip_address || '')} · ${esc(s.last_seen_at || s.created_at || '')}</small></div><button data-session="${esc(s.id)}" class="danger">Revoke</button></article>`).join('') || '<p class="muted">No active sessions.</p>'}</div></section><section class="card"><h2>Security activity</h2><div>${(events.events || []).slice(0,10).map(e => `<article class="event"><strong>${esc(e.event_type || e.action || 'Security event')}</strong><small>${esc(e.created_at || '')}</small></article>`).join('') || '<p class="muted">No recent events.</p>'}</div></section></main>`;
  document.getElementById('logout').onclick = async () => { await api('/api/auth/logout', { method:'POST' }); location.reload(); };
  root.querySelectorAll('[data-revoke]').forEach(b => b.onclick = async () => { await api(`/api/account/apps/${encodeURIComponent(b.dataset.revoke)}/consent`, { method:'DELETE' }); location.reload(); });
  root.querySelectorAll('[data-session]').forEach(b => b.onclick = async () => { await api(`/api/account/sessions/${encodeURIComponent(b.dataset.session)}`, { method:'DELETE' }); location.reload(); });
}
boot().catch(e => { document.getElementById('app').innerHTML = `<main class="shell"><section class="card"><h1>Account Center</h1><p>${esc(e.message)}</p></section></main>`; });
