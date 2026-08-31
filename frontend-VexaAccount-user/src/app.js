const API_BASE = window.VEXA_ACCOUNT_API_BASE || 'https://api-vexaaccount.onrender.com';

const api = (path, options = {}) => fetch(API_BASE + path, {
  credentials: 'include',
  ...options,
  headers: {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  }
});

async function json(path, options) {
  const response = await api(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || data.error || `Request failed: ${response.status}`);
  }
  return data;
}

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[char]));

const appRoot = () => document.getElementById('app');

let state = {
  session: null,
  profile: null,
  security: {},
  prefs: {},
  credits: {},
  apps: [],
  sessions: [],
  events: [],
  storage: [],
  view: 'overview'
};

async function load() {
  const session = await json('/api/auth/session');
  if (!session || !session.success) {
    renderLogin();
    return;
  }

  state.session = session;
  const results = await Promise.allSettled([
    json('/api/account/profile'),
    json('/api/account/security'),
    json('/api/account/preferences'),
    json('/api/account/credits'),
    json('/api/account/storage'),
    json('/api/account/apps'),
    json('/api/account/sessions'),
    json('/api/account/security/events')
  ]);

  const values = results.map((result) => result.status === 'fulfilled' ? result.value : {});
  const [profile, security, prefs, credits, storage, apps, sessions, events] = values;

  state.profile = profile.user || session.user || {};
  state.security = security.security || {};
  state.prefs = prefs.preferences || {};
  state.credits = credits.balance || {};
  state.storage = storage.records || [];
  state.apps = apps.applications || [];
  state.sessions = sessions.sessions || [];
  state.events = events.events || [];
  render();
}

function renderLogin() {
  appRoot().innerHTML = `
    <main class="shell loading-shell">
      <section class="card glass loading-card">
        <div class="brand-mark">V</div>
        <p class="eyebrow">VEXA ACCOUNT</p>
        <h1>Your account, everywhere.</h1>
        <p class="muted">Sign in to manage your profile, security, connected applications, sessions, storage and preferences.</p>
        <a class="primary" href="${esc(API_BASE)}/auth/login-page">Sign in</a>
      </section>
    </main>`;
}

function nav() {
  const items = [
    ['overview', 'Overview'],
    ['profile', 'Profile'],
    ['security', 'Security'],
    ['apps', 'Applications'],
    ['sessions', 'Sessions'],
    ['storage', 'Cloud storage'],
    ['credits', 'Credits & coins'],
    ['preferences', 'Preferences']
  ];
  return items.map(([id, label]) => `
    <button class="nav ${state.view === id ? 'active' : ''}" data-view="${id}">${label}</button>
  `).join('');
}

function shell(content) {
  const user = state.profile || state.session.user || {};
  appRoot().innerHTML = `
    <div class="console">
      <aside class="sidebar">
        <div class="brand">
          <span class="brand-mark">V</span>
          <div><b>VexaAccount</b><small>ACCOUNT CENTER</small></div>
        </div>
        <nav>${nav()}</nav>
        <div class="side-footer">
          <span class="owner-dot"></span>
          <div><b>${esc(user.name || 'Account')}</b><small>${esc(user.email || '')}</small></div>
        </div>
      </aside>
      <section class="workspace">
        <header class="topbar">
          <div>
            <p class="eyebrow">VEXA ACCOUNT</p>
            <h1>Account Center</h1>
          </div>
          <div class="top-actions">
            <span class="live"><i></i> System online</span>
            <button id="logout" class="secondary">Sign out</button>
          </div>
        </header>
        <main class="content">${content}</main>
        <nav class="bottom-nav">${nav()}</nav>
      </section>
    </div>`;

  document.querySelectorAll('[data-view]').forEach((button) => {
    button.onclick = () => {
      state.view = button.dataset.view;
      render();
    };
  });

  document.getElementById('logout').onclick = async () => {
    await api('/api/auth/logout', { method: 'POST' });
    location.reload();
  };
}

function card(title, body) {
  return `<section class="panel glass"><h2>${title}</h2>${body}</section>`;
}

function overview() {
  const user = state.profile || {};
  return `
    <section class="hero glass">
      <div>
        <p class="eyebrow">CENTRAL IDENTITY PLATFORM</p>
        <h2>Your VexaAccount, connected everywhere.</h2>
        <p>Manage your identity, security, applications, sessions, storage and account preferences from one place.</p>
      </div>
    </section>
    <section class="metrics">
      <article class="metric glass"><small>Connected applications</small><strong>${state.apps.length}</strong><span>Registered connections</span></article>
      <article class="metric glass"><small>Active sessions</small><strong>${state.sessions.length}</strong><span>Current account sessions</span></article>
      <article class="metric glass"><small>Credit score</small><strong>${esc(state.credits.credit_score ?? 0)}</strong><span>Account balance score</span></article>
      <article class="metric glass"><small>Coins</small><strong>${esc(state.credits.coins ?? 0)}</strong><span>Available coins</span></article>
    </section>
    <section class="grid">
      ${card('Account status', `<p><b>${esc(user.email || '')}</b></p><p class="muted">Status: ${user.is_active ? 'Active' : 'Disabled'} · Verified: ${user.is_verified ? 'Yes' : 'No'}</p>`)}
      ${card('Recent security activity', state.events.slice(0, 6).map((event) => `
        <article class="row"><div><b>${esc(event.event_type || 'Security event')}</b><small>${esc(event.created_at || '')} · ${esc(event.ip_address || '')}</small></div></article>
      `).join('') || '<p class="muted">No recent security activity.</p>')}
    </section>`;
}

function profile() {
  const user = state.profile || {};
  return card('Profile', `
    <form id="profileForm" class="form-grid">
      <label>Name<input name="name" value="${esc(user.name)}"></label>
      <label>First name<input name="first_name" value="${esc(user.first_name)}"></label>
      <label>Last name<input name="last_name" value="${esc(user.last_name)}"></label>
      <label>Country<input name="country" value="${esc(user.country)}"></label>
      <label>Gender<input name="gender" value="${esc(user.gender)}"></label>
      <label>Date of birth<input name="dob" type="date" value="${esc(user.dob ? String(user.dob).slice(0, 10) : '')}"></label>
      <button class="primary" type="submit">Save profile</button>
    </form>
    <hr>
    <h3>Change email</h3>
    <form id="emailForm" class="form-grid">
      <input name="email" type="email" value="${esc(user.email)}" required>
      <input name="password" type="password" placeholder="Current password" required>
      <button class="primary" type="submit">Change email</button>
    </form>
    <hr>
    <h3>Change password</h3>
    <form id="passwordForm" class="form-grid">
      <input name="currentPassword" type="password" placeholder="Current password" required>
      <input name="newPassword" type="password" placeholder="New password (8+ characters)" required>
      <button class="primary" type="submit">Change password</button>
    </form>`);

  document.getElementById('profileForm').onsubmit = async (event) => {
    event.preventDefault();
    await json('/api/account/profile', { method: 'PATCH', body: JSON.stringify(Object.fromEntries(new FormData(event.target))) });
    await load();
  };
  document.getElementById('emailForm').onsubmit = async (event) => {
    event.preventDefault();
    const data = await json('/api/account/email', { method: 'PATCH', body: JSON.stringify(Object.fromEntries(new FormData(event.target))) });
    alert(data.message || 'Email updated');
    await load();
  };
  document.getElementById('passwordForm').onsubmit = async (event) => {
    event.preventDefault();
    const data = await json('/api/account/password', { method: 'PATCH', body: JSON.stringify(Object.fromEntries(new FormData(event.target))) });
    alert(data.message || 'Password updated');
    await load();
  };
}

function security() {
  return card('Security', `
    <p>Authenticator 2FA: <strong>${state.security.twofa_enabled ? 'Enabled' : 'Disabled'}</strong></p>
    <p>Email 2FA: <strong>${state.security.email_2fa_enabled ? 'Enabled' : 'Disabled'}</strong></p>
    <p>Security notifications: <strong>${state.security.security_notifications_enabled ? 'Enabled' : 'Disabled'}</strong></p>
    <button id="disable2fa" class="secondary">Disable 2FA</button>
    <button id="disablePasscode" class="secondary">Disable passcode</button>
    <hr><h3>Security events</h3>
    ${state.events.map((event) => `<article class="row"><div><b>${esc(event.event_type || 'Event')}</b><small>${esc(event.created_at || '')} · ${esc(event.ip_address || '')}</small></div></article>`).join('') || '<p class="muted">No events.</p>'}`);

  document.getElementById('disable2fa').onclick = async () => {
    const password = prompt('Enter your password to disable 2FA');
    if (!password) return;
    const data = await json('/api/account/security/disable-2fa', { method: 'POST', body: JSON.stringify({ password }) });
    alert(data.message || '2FA disabled');
    await load();
  };
  document.getElementById('disablePasscode').onclick = async () => {
    if (!confirm('Disable your account passcode?')) return;
    const data = await json('/api/account/security/disable-passcode', { method: 'POST' });
    alert(data.message || 'Passcode disabled');
    await load();
  };
}

function apps() {
  return card('Connected applications', state.apps.map((app) => `
    <article class="app-card">
      <div class="app-main"><div class="app-icon">${esc((app.display_name || app.name || app.client_id || 'A').slice(0, 1).toUpperCase())}</div><div><h3>${esc(app.display_name || app.name || app.client_id)}</h3><small>${esc(app.client_id)} · ${esc(app.status || 'active')}</small></div></div>
      <button data-revoke="${esc(app.client_id)}" class="danger">Revoke access</button>
    </article>`).join('') || '<p class="muted">No connected applications.</p>');
}

function sessions() {
  return card('Active sessions', state.sessions.map((session) => `
    <article class="row"><div><b>${esc(session.device || session.user_agent || 'Browser session')}</b><small>${esc(session.ip_address || '')} · ${esc(session.last_seen_at || session.created_at || '')}</small></div><button data-session="${esc(session.id)}" class="secondary">Revoke</button></article>`).join('') || '<p class="muted">No active sessions.</p>');
}

function storage() {
  return card('Cloud storage', `<p class="muted">VexaAccount-managed storage records linked to your account.</p>${state.storage.map((record) => `
    <article class="row"><div><b>${esc(record.display_name || record.storage_key)}</b><small>${esc(record.provider || '')} · ${esc(record.content_type || '')} · ${esc(record.size_bytes || 0)} bytes · ${esc(record.status || '')}</small></div><button data-storage="${esc(record.id)}" class="danger">Remove record</button></article>`).join('') || '<p class="muted">No storage records.</p>'}`);
}

function credits() {
  return `<section class="metrics"><article class="metric glass"><small>Credit score</small><strong>${esc(state.credits.credit_score ?? 0)}</strong><span>Current score</span></article><article class="metric glass"><small>Coins</small><strong>${esc(state.credits.coins ?? 0)}</strong><span>Available coins</span></article></section>`;
}

function preferences() {
  const prefs = state.prefs || {};
  return card('Preferences', `
    <form id="prefsForm" class="form-grid">
      <label>Language<input name="locale" value="${esc(prefs.locale || 'en')}"></label>
      <label>Timezone<input name="timezone" value="${esc(prefs.timezone || 'UTC')}"></label>
      <label><input name="marketing_email_enabled" type="checkbox" ${prefs.marketing_email_enabled ? 'checked' : ''}> Marketing emails</label>
      <label><input name="security_email_enabled" type="checkbox" ${prefs.security_email_enabled !== 0 ? 'checked' : ''}> Security emails</label>
      <button class="primary" type="submit">Save preferences</button>
    </form>
    <hr><h3>Delete account</h3><p class="muted">This permanently removes your VexaAccount data and revokes active sessions.</p>
    <button id="deleteAccount" class="danger">Delete my account</button>`);

  document.getElementById('prefsForm').onsubmit = async (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    await json('/api/account/preferences', { method: 'PATCH', body: JSON.stringify({
      locale: form.get('locale'),
      timezone: form.get('timezone'),
      marketing_email_enabled: form.has('marketing_email_enabled'),
      security_email_enabled: form.has('security_email_enabled')
    }) });
    alert('Preferences saved');
    await load();
  };

  document.getElementById('deleteAccount').onclick = async () => {
    const password = prompt('Enter your password to permanently delete your account');
    if (!password || !confirm('This cannot be undone. Continue?')) return;
    await json('/api/account/account', { method: 'DELETE', body: JSON.stringify({ password }) });
    location.reload();
  };
}

function render() {
  const views = { overview, profile, security, apps, sessions, storage, credits, preferences };
  shell(views[state.view]());

  document.querySelectorAll('[data-revoke]').forEach((button) => {
    button.onclick = async () => {
      if (!confirm('Revoke this application?')) return;
      await json(`/api/account/apps/${encodeURIComponent(button.dataset.revoke)}/consent`, { method: 'DELETE' });
      await load();
    };
  });

  document.querySelectorAll('[data-session]').forEach((button) => {
    button.onclick = async () => {
      await json(`/api/account/sessions/${encodeURIComponent(button.dataset.session)}`, { method: 'DELETE' });
      await load();
    };
  });

  document.querySelectorAll('[data-storage]').forEach((button) => {
    button.onclick = async () => {
      if (!confirm('Remove this storage record?')) return;
      await json(`/api/account/storage/${encodeURIComponent(button.dataset.storage)}`, { method: 'DELETE' });
      await load();
    };
  });
}

load().catch((error) => {
  appRoot().innerHTML = `<main class="shell loading-shell"><section class="card glass loading-card"><div class="brand-mark">V</div><p class="eyebrow">VEXA ACCOUNT</p><h1>Unable to load Account Center</h1><p class="muted">${esc(error.message)}</p><button class="primary" onclick="location.reload()">Retry</button></section></main>`;
});
