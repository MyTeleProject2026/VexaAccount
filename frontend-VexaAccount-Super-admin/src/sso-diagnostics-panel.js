(()=>{
  'use strict';
  if(window.__VEXA_SSO_DIAGNOSTICS_PANEL__) return;
  window.__VEXA_SSO_DIAGNOSTICS_PANEL__ = true;

  const API = (window.VEXA_ACCOUNT_ADMIN_API_BASE || 'https://api-vexaaccount.onrender.com').replace(/\/$/, '');
  const esc = function(value){
    return String(value == null ? '' : value).replace(/[&<>\"']/g, function(char){
      if(char === '&') return '&amp;';
      if(char === '<') return '&lt;';
      if(char === '>') return '&gt;';
      if(char === '\"') return '&quot;';
      return '&#39;';
    });
  };

  function getToken(){
    return localStorage.getItem('vexa_super_admin_token') ||
      sessionStorage.getItem('vexa_super_admin_token') ||
      localStorage.getItem('vexa_access_token') || '';
  }

  async function api(path, options){
    const opt = options || {};
    const headers = Object.assign({'Content-Type':'application/json'}, opt.headers || {});
    const token = getToken();
    if(token) headers.Authorization = 'Bearer ' + token;
    const response = await fetch(API + path, Object.assign({}, opt, {credentials:'include', headers:headers}));
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if(!response.ok || data.success === false){
      throw new Error(data.message || data.error || ('Request failed (' + response.status + ')'));
    }
    return data;
  }

  function host(){ return document.querySelector('#owner-control-center'); }

  function closeExisting(){
    const root = host();
    if(root){
      const old = root.querySelector('.vexa-sso-diagnostics');
      if(old) old.remove();
    }
  }

  async function show(clientId){
    closeExisting();
    const root = host();
    if(!root) return;
    const modal = document.createElement('div');
    modal.className = 'vexa-sso-diagnostics';
    modal.innerHTML = '<div class="occ-backdrop"><section class="occ-panel">' +
      '<header><div><span>SSO INTEGRATION</span><h2>Integration Diagnostics</h2><p>Loading application health…</p></div><button type="button" data-diagnostic-close>Close</button></header>' +
      '<main><div class="occ-loading">Running secure diagnostics…</div></main></section></div>';
    root.appendChild(modal);
    modal.querySelector('[data-diagnostic-close]').onclick = function(){ modal.remove(); };

    try{
      const data = await api('/api/sso-registry/applications/' + encodeURIComponent(clientId) + '/diagnostics');
      const app = data.application || {};
      const diagnosis = data.diagnosis || {};
      const metrics = data.metrics || {};
      const endpoints = data.endpoints || {};
      const checks = diagnosis.checks || {};
      const checkHtml = Object.keys(checks).map(function(key){
        const ok = Boolean(checks[key]);
        return '<div class="occ-row"><b>' + esc(key) + '</b><span class="badge ' + (ok ? 'active' : 'danger') + '">' + (ok ? 'OK' : 'FAILED') + '</span></div>';
      }).join('') || '<div class="occ-row">No diagnostic checks returned.</div>';
      const failureHtml = (metrics.recentFailures || []).map(function(item){
        return '<div class="occ-row"><b>' + esc(item.eventType) + '</b> · ' + esc(item.count) + ' · ' + esc(item.lastAt) + '</div>';
      }).join('') || '<div class="occ-row">No recorded recent SSO failures.</div>';
      const redirectHtml = (app.redirectUris || []).map(function(uri){
        return '<div class="occ-row">' + esc(uri) + '</div>';
      }).join('') || '<div class="occ-row">No redirect URI configured.</div>';
      const scopeHtml = esc((app.allowedScopes || []).join(', '));

      modal.querySelector('header p').textContent = (app.displayName || clientId) + ' · ' + clientId;
      modal.querySelector('main').innerHTML =
        '<section class="occ-detail">' +
          '<div class="occ-grid">' +
            '<div class="occ-card"><b>Overall status</b><h3>' + (diagnosis.healthy ? 'Healthy' : 'Needs attention') + '</h3>' +
              '<small>Registry: ' + esc(app.status || 'unknown') + '</small>' +
              '<small>Client active: ' + (app.active ? 'Yes' : 'No') + '</small>' +
              '<small>Active SSO sessions: ' + esc(metrics.activeSessions == null ? 0 : metrics.activeSessions) + '</small>' +
              '<small>Active consents: ' + esc(metrics.activeConsents == null ? 0 : metrics.activeConsents) + '</small>' +
            '</div>' +
            '<div class="occ-card"><b>Provider endpoints</b>' +
              '<small>Issuer: ' + esc(endpoints.issuer || '') + '</small>' +
              '<small>Authorize: ' + esc(endpoints.authorization || '') + '</small>' +
              '<small>Token: ' + esc(endpoints.token || '') + '</small>' +
              '<small>Userinfo: ' + esc(endpoints.userinfo || '') + '</small>' +
            '</div>' +
          '</div>' +
          '<h3>Configuration checks</h3>' + checkHtml +
          '<h3>Redirect URIs</h3>' + redirectHtml +
          '<h3>Allowed scopes</h3><div class="occ-row">' + scopeHtml + '</div>' +
          '<h3>Recent SSO failures</h3>' + failureHtml +
          '<div class="occ-actions"><button type="button" data-diagnostic-repair>Synchronize client status</button></div>' +
        '</section>';

      modal.querySelector('[data-diagnostic-repair]').onclick = async function(){
        try{
          const result = await api('/api/sso-registry/applications/' + encodeURIComponent(clientId) + '/repair-status', {method:'POST', body:'{}'});
          window.alert(result.message || 'SSO client status synchronized.');
          modal.remove();
          show(clientId);
        }catch(error){ window.alert(error.message); }
      };
    }catch(error){
      modal.querySelector('main').innerHTML = '<div class="occ-error">' + esc(error.message) + '</div>';
    }
  }

  function install(){
    const root = host();
    if(!root || root.dataset.ssoDiagnosticsInstalled === '1') return;
    root.dataset.ssoDiagnosticsInstalled = '1';
    const observer = new MutationObserver(function(){
      root.querySelectorAll('[data-app-status]').forEach(function(statusNode){
        const card = statusNode.closest('.occ-card');
        if(!card || card.querySelector('[data-sso-diagnostic]')) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'Diagnostics';
        button.dataset.ssoDiagnostic = '1';
        button.onclick = function(){ show(statusNode.dataset.appStatus); };
        const actions = card.querySelector('.occ-actions') || card;
        actions.appendChild(button);
      });
    });
    observer.observe(root, {childList:true, subtree:true});
    observer.takeRecords();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', install, {once:true});
  }else{
    install();
  }
  window.vexaSsoDiagnostics = {show:show, install:install};
})();
