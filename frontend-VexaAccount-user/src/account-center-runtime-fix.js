(() => {
  'use strict';
  if (window.__VEXA_ACCOUNT_CENTER_RUNTIME_FIX__) return;
  window.__VEXA_ACCOUNT_CENTER_RUNTIME_FIX__ = true;

  const API = window.VEXA_ACCOUNT_API_BASE || 'https://api-vexaaccount.onrender.com';
  const TOKEN_KEYS = ['vexaaccount_access_token', 'vexa_access_token', 'access_token', 'token', 'userToken', 'accessToken'];
  const token = () => {
    try {
      const t = window.vexaAccountAuth?.getToken?.();
      if (t) return t;
    } catch (_) {}
    for (const store of [localStorage, sessionStorage]) {
      for (const key of TOKEN_KEYS) {
        try {
          const value = store.getItem(key);
          if (value) return value;
        } catch (_) {}
      }
    }
    return null;
  };

  const json = async (path, options = {}) => {
    const headers = new Headers(options.headers || {});
    const t = token();
    if (t) headers.set('Authorization', `Bearer ${t}`);
    if (options.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    const response = await fetch(API + path, { credentials: 'include', ...options, headers });
    const data = await response.json().catch(() => ({ success: false, message: 'Invalid server response' }));
    if (!response.ok || data.success === false) throw new Error(data.message || `Request failed (${response.status})`);
    return data;
  };

  // The account-center prototype has navigation controls that are not settings controls.
  // Older runtime handlers could accidentally serialize a nav icon such as 👥 as a setting
  // key, producing PATCH /api/account/settings -> 400. Preserve real settings updates and
  // safely turn malformed navigation writes into a no-op response.
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    try {
      const url = typeof input === 'string' ? input : input?.url || '';
      const method = String(init?.method || (typeof input !== 'string' ? input?.method : '') || 'GET').toUpperCase();
      if (method === 'PATCH' && /\/api\/account\/settings(?:\?|$)/.test(url)) {
        const raw = init.body;
        if (typeof raw === 'string') {
          try {
            const body = JSON.parse(raw);
            const allowed = new Set([
              'username', 'recovery_email', 'push_notifications_enabled',
              'product_updates_enabled', 'location_sharing_enabled',
              'personalization_enabled', 'activity_history_enabled',
              'service_activity_enabled', 'communication_enabled'
            ]);
            const keys = Object.keys(body || {});
            if (keys.length && keys.every(k => !allowed.has(k))) {
              return new Response(JSON.stringify({ success: true, message: 'Navigation action did not change account settings.' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
              });
            }
          } catch (_) {}
        }
      }
    } catch (_) {}
    return nativeFetch(input, init);
  };

  function notify(message, type = 'info') {
    const api = window.vexaReactNotify;
    const fn = api?.[type === 'success' ? 'showSuccess' : type === 'error' ? 'showError' : type === 'warning' ? 'showWarning' : 'showInfo'];
    if (typeof fn === 'function') return fn(message);
    let stack = document.getElementById('vx-runtime-fix-toast');
    if (!stack) {
      stack = document.createElement('div');
      stack.id = 'vx-runtime-fix-toast';
      stack.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:9999;display:grid;gap:8px;width:min(420px,calc(100vw - 28px));';
      document.body.appendChild(stack);
    }
    const item = document.createElement('div');
    item.textContent = message;
    item.style.cssText = 'padding:12px 16px;border-radius:12px;background:#111827;color:#fff;box-shadow:0 16px 45px rgba(15,23,42,.25);font-size:13px;text-align:center;';
    stack.appendChild(item);
    setTimeout(() => item.remove(), 3000);
  }

  function addBackButton() {
    const side = document.querySelector('.vx-side');
    if (!side || side.querySelector('[data-runtime-fix="back"]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.runtimeFix = 'back';
    button.setAttribute('aria-label', 'Back');
    button.textContent = '←  Back';
    button.style.cssText = 'display:flex;align-items:center;gap:8px;width:calc(100% - 24px);margin:10px 12px 2px;padding:10px 12px;border:1px solid #e6eaf0;border-radius:11px;background:rgba(255,255,255,.8);color:#344054;font:700 12px Inter,system-ui,sans-serif;cursor:pointer;position:relative;z-index:200;box-shadow:0 4px 14px rgba(15,23,42,.05);';
    button.addEventListener('click', () => {
      if (side.classList.contains('open')) {
        side.classList.remove('open');
        return;
      }
      if (location.hash && location.hash !== '#/' && history.length > 1) history.back();
      else if (typeof window.go === 'function') window.go('home');
    });
    const brand = side.querySelector('.vx-brand');
    if (brand?.nextSibling) side.insertBefore(button, brand.nextSibling);
    else side.prepend(button);
  }

  function addLogoutButton() {
    const foot = document.querySelector('.vx-foot');
    if (!foot || foot.querySelector('[data-runtime-fix="logout"]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.runtimeFix = 'logout';
    button.textContent = 'Sign out';
    button.style.cssText = 'width:100%;margin-top:8px;padding:9px 12px;border:1px solid #fecaca;border-radius:10px;background:#fff;color:#b91c1c;font:700 12px Inter,system-ui,sans-serif;cursor:pointer;';
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await json('/api/auth/logout', { method: 'POST' });
      } catch (_) {}
      for (const store of [localStorage, sessionStorage]) {
        for (const key of TOKEN_KEYS) {
          try { store.removeItem(key); } catch (_) {}
        }
      }
      try { window.vexaAccountAuth?.clear?.(); } catch (_) {}
      window.dispatchEvent(new Event('vexa:auth-changed'));
      location.hash = '#/login';
      location.reload();
    });
    foot.appendChild(button);
  }

  function replaceStat(label, value) {
    const nodes = [...document.querySelectorAll('.vx-stat, .vx-card, .vx-row')];
    const target = nodes.find(node => (node.textContent || '').toLowerCase().includes(label.toLowerCase()));
    if (!target) return;
    const small = [...target.querySelectorAll('small, .vx-info-label, .vx-desc')].find(n => (n.textContent || '').toLowerCase().includes(label.toLowerCase()));
    const strong = target.querySelector('strong, .stat-number, [data-stat-value]');
    if (strong) strong.textContent = value;
    else if (small?.previousElementSibling) small.previousElementSibling.textContent = value;
  }

  async function refreshLiveAccountData() {
    const t = token();
    if (!t) return;
    try {
      const [profile, security, sessions, events] = await Promise.all([
        json('/api/account/profile'),
        json('/api/account/security-score'),
        json('/api/account/sessions'),
        json('/api/account/security/events?limit=50')
      ]);

      const user = profile.user || profile.profile || {};
      const name = user.name || user.email || 'Account';
      const first = name.split(/\s+/)[0];
      const sideName = document.getElementById('vx-side-name');
      const sideEmail = document.getElementById('vx-side-email');
      const heroName = document.getElementById('vx-hero-name');
      const sideAvatar = document.getElementById('vx-side-avatar');
      const heroAvatar = document.getElementById('vx-hero-avatar');
      if (sideName) sideName.textContent = name;
      if (sideEmail) sideEmail.textContent = user.email || '—';
      if (heroName) heroName.textContent = first;
      const initials = String(name).split(/\s+/).filter(Boolean).slice(0, 2).map(v => v[0]).join('').toUpperCase();
      if (sideAvatar && !sideAvatar.querySelector('img')) sideAvatar.textContent = initials || 'VA';
      if (heroAvatar && !heroAvatar.querySelector('img')) heroAvatar.textContent = initials || 'VA';

      const score = Number(security.score);
      if (Number.isFinite(score)) replaceStat('Security strength', `${Math.max(0, Math.min(100, score))}%`);
      const activeCount = Array.isArray(sessions.sessions) ? sessions.sessions.length : 0;
      replaceStat('Active devices', String(activeCount));

      const activityCount = Array.isArray(events.events) ? events.events.length : 0;
      const activityPage = [...document.querySelectorAll('.vx-page')].find(p => (p.textContent || '').includes('Account activity'));
      if (activityPage && activityCount) {
        const empty = [...activityPage.querySelectorAll('.empty')].find(n => /no activity/i.test(n.textContent || ''));
        if (empty) empty.textContent = `${activityCount} recent security event${activityCount === 1 ? '' : 's'}.`;
      }
    } catch (error) {
      console.debug('[VexaAccount] live Account Center refresh:', error.message);
    }
  }

  function install() {
    addBackButton();
    addLogoutButton();
    refreshLiveAccountData();
    const observer = new MutationObserver(() => {
      addBackButton();
      addLogoutButton();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('hashchange', () => setTimeout(refreshLiveAccountData, 120));
    setInterval(refreshLiveAccountData, 30000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();
