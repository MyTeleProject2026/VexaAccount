(()=>{
  'use strict';
  if(window.__VEXA_SSO_DIAGNOSTICS_PANEL__)return;
  window.__VEXA_SSO_DIAGNOSTICS_PANEL__=true;

  const API=(window.VEXA_ACCOUNT_ADMIN_API_BASE||'https://api-vexaaccount.onrender.com').replace(/\/$/,'');
  const esc=(s)=>String(s??'').replace(/[&<>\"']/g,(c)=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'
  }[c]));
  const token=()=>localStorage.getItem('vexa_super_admin_token')||sessionStorage.getItem('vexa_super_admin_token')||localStorage.getItem('vexa_access_token')||'';

  async function api(path,opt={}){
    const headers={'Content-Type':'application/json',...(opt.headers||{})};
    const t=token();
    if(t)headers.Authorization=`Bearer ${t}`;
    const response=await fetch(API+path,{credentials:'include',...opt,headers});
    let data={};
    try{data=await response.json()}catch{}
    if(!response.ok||data.success===false)throw new Error(data.message||`Request failed (${response.status})`);
    return data;
  }

  function install(){
    const body=document.querySelector('#occ-body');
    if(!body||body.dataset.ssoDiagObserver)return;
    body.dataset.ssoDiagObserver='1';

    const observer=new MutationObserver(()=>{
      const cards=[...body.querySelectorAll('.occ-card')].filter((card)=>card.querySelector('[data-app-status]'));
      if(!cards.length)return;
      cards.forEach((card)=>{
        const rotate=card.querySelector('[data-app-rotate]');
        const client=rotate?.dataset.appRotate;
        if(!client||card.querySelector('[data-sso-diagnostic]'))return;

        const row=document.createElement('div');
        row.className='occ-actions';
        row.dataset.ssoDiagnostic='1';
        row.innerHTML=`<button data-sso-check="${esc(client)}">Check health</button><button data-sso-repair="${esc(client)}">Sync status</button>`;
        card.appendChild(row);

        row.querySelector('[data-sso-check]').onclick=()=>show(client);
        row.querySelector('[data-sso-repair]').onclick=async()=>{
          if(!confirm('Synchronize the SSO client active flag with the registry status? This will not change redirect URIs, scopes, or secrets.'))return;
          try{
            const data=await api(`/api/sso-registry/applications/${encodeURIComponent(client)}/repair-status`,{method:'POST',body:'{}'});
            alert(data.message||'SSO status synchronized.');
            show(client);
          }catch(error){alert(error.message)}
        };
      });
    });

    observer.observe(body,{childList:true,subtree:true});
  }

  async function show(client){
    try{
      const data=await api(`/api/sso-registry/applications/${encodeURIComponent(client)}/diagnostics`);
      const application=data.application||{};
      const diagnosis=data.diagnosis||{};
      const metrics=data.metrics||{};
      const endpoints=data.endpoints||{};
      const checks=Object.entries(diagnosis.checks||{}).map(([key,value])=>`<div class="occ-row"><b>${esc(key)}</b> · ${value?'OK':'FAILED'}</div>`).join('')||'<div class="occ-row">No diagnostic checks returned.</div>';
      const failures=(metrics.recentFailures||[]).map((item)=>`<div class="occ-row">${esc(item.eventType)} · ${esc(item.count)} · ${esc(item.lastAt)}</div>`).join('')||'<div class="occ-row">No recorded recent SSO failure events.</div>';
      const host=document.querySelector('#owner-control-center');
      if(!host)return;
      host.querySelector('.occ-sso-diagnostic-modal')?.remove();

      const modal=document.createElement('div');
      modal.className='occ-sso-diagnostic-modal';
      modal.innerHTML=`
        <div class="occ-backdrop">
          <section class="occ-panel">
            <header>
              <div>
                <span>SSO INTEGRATION</span>
                <h2>Integration Diagnostics</h2>
                <p>${esc(application.displayName)} · ${esc(application.clientId)}</p>
              </div>
              <button data-diag-close>Close</button>
            </header>
            <main>
              <section class="occ-detail">
                <div class="occ-grid">
                  <div class="occ-card">
                    <b>Overall status</b>
                    <h3>${diagnosis.healthy?'Healthy':'Needs attention'}</h3>
                    <small>Registry: ${esc(application.status||'unknown')} · Client active: ${application.active?'Yes':'No'}</small>
                    <small>Active SSO sessions: ${esc(metrics.activeSessions??0)}</small>
                    <small>Active consents: ${esc(metrics.activeConsents??0)}</small>
                  </div>
                  <div class="occ-card">
                    <b>Provider endpoints</b>
                    <small>Issuer: ${esc(endpoints.issuer||'')}</small>
                    <small>Authorize: ${esc(endpoints.authorization||'')}</small>
                    <small>Token: ${esc(endpoints.token||'')}</small>
                    <small>Userinfo: ${esc(endpoints.userinfo||'')}</small>
                  </div>
                </div>
                <h3>Configuration checks</h3>
                ${checks}
                <h3>Redirect URIs</h3>
                ${(application.redirectUris||[]).map((uri)=>`<div class="occ-row">${esc(uri)}</div>`).join('')||'<div class="occ-row">None</div>'}
                <h3>Allowed scopes</h3>
                <div class="occ-row">${esc((application.allowedScopes||[]).join(', '))}</div>
                <h3>Recent SSO failures</h3>
                ${failures}
                <div class="occ-actions"><button data-diag-repair>Sync status</button></div>
              </section>
            </main>
          </section>
        </div>`;

      host.appendChild(modal);
      modal.querySelector('[data-diag-close]').onclick=()=>modal.remove();
      modal.querySelector('[data-diag-repair]').onclick=async()=>{
        try{
          const result=await api(`/api/sso-registry/applications/${encodeURIComponent(client)}/repair-status`,{method:'POST',body:'{}'});
          alert(result.message||'SSO status synchronized.');
          modal.remove();
          show(client);
        }catch(error){alert(error.message)}
      };
    }catch(error){alert(error.message)}
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
})();
