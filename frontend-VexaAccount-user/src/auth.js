const API_BASE = window.VEXA_ACCOUNT_API_BASE || 'https://api-vexaaccount.onrender.com';
const root = () => document.getElementById('app');
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function authPage(mode) {
  const register = mode === 'register';
  root().innerHTML = `
    <main class="auth-shell">
      <section class="auth-card glass">
        <div class="auth-brand"><img src="./public/brand.svg" alt="VexaAccount"></div>
        <p class="eyebrow">VEXA ACCOUNT</p>
        <h1>${register ? 'Create your VexaAccount' : 'Welcome back'}</h1>
        <p class="muted">${register ? 'Create one central identity for your Vexa ecosystem.' : 'Sign in to your central VexaAccount.'}</p>
        <form id="authForm" class="auth-form">
          ${register ? '<label>Name<input name="name" autocomplete="name" required></label>' : ''}
          <label>Email<input name="email" type="email" autocomplete="email" inputmode="email" required></label>
          <label>Password<input name="password" type="password" autocomplete="current-password" minlength="8" required></label>
          ${register ? '<label>Confirm password<input name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required></label>' : ''}
          <button class="primary auth-submit" type="submit">${register ? 'Create account' : 'Sign in'}</button>
          <p id="authMessage" class="auth-message" role="alert"></p>
        </form>
        <div class="auth-links">
          ${register ? 'Already have an account? <a href="#/login">Sign in</a>' : 'New to VexaAccount? <a href="#/register">Create an account</a>'}
        </div>
      </section>
    </main>`;

  document.getElementById('authForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const message = document.getElementById('authMessage');
    const button = event.currentTarget.querySelector('button');
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');
    if (register && password !== String(form.get('confirmPassword') || '')) {
      message.textContent = 'Passwords do not match.';
      return;
    }
    button.disabled = true;
    message.textContent = 'Connecting securely…';
    try {
      const payload = register
        ? {name: String(form.get('name') || '').trim(), email, password}
        : {email, password};
      const response = await fetch(`${API_BASE}/api/auth/${register ? 'register' : 'login'}`, {
        method: 'POST', credentials: 'include',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success === false) throw new Error(data.message || data.error || 'Authentication failed.');
      message.textContent = data.message || (register ? 'Account created. Redirecting…' : 'Signed in. Redirecting…');
      window.location.hash = '#/';
      window.location.reload();
    } catch (error) {
      message.textContent = error.message || 'Unable to connect to VexaAccount.';
      button.disabled = false;
    }
  });
}

function routeAuth() {
  const hash = window.location.hash.toLowerCase();
  if (hash === '#/login' || hash === '#login') authPage('login');
  else if (hash === '#/register' || hash === '#register') authPage('register');
}

function repairDefaultLoginLink() {
  document.querySelectorAll('a[href*="/auth/login-page"]').forEach((link) => {
    link.href = '#/login';
  });
  if (!document.querySelector('.register-entry') && document.querySelector('.loading-card')) {
    const card = document.querySelector('.loading-card');
    const link = document.createElement('a');
    link.className = 'secondary register-entry';
    link.href = '#/register';
    link.textContent = 'Create an account';
    link.style.marginTop = '10px';
    card.appendChild(link);
  }
}

window.addEventListener('hashchange', routeAuth);
routeAuth();
repairDefaultLoginLink();
new MutationObserver(repairDefaultLoginLink).observe(document.body, {subtree: true, childList: true});
