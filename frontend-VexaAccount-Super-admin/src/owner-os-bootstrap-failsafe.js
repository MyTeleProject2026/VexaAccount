(()=>{'use strict';
const app=()=>document.getElementById('app');
const loading=()=>/Loading Owner OS|Verifying secure Owner session/i.test(app()?.textContent||'');
let shown=false;
let recoveryAttempted=false;
function safe(v){return String(v||'').replace(/[&<>]/g,'')}
function show(message){if(shown)return;shown=true;const root=app();if(!root)return;root.innerHTML=`<main class="os-login"><section class="os-login-card"><span class="os-mark">V</span><p class="os-eyebrow">VEXAACCOUNT ECOSYSTEM</p><h1>Owner OS did not finish loading</h1><p class="os-muted">${safe(message||'The page did not leave its bootstrap state.')}</p><div class="os-actions" style="justify-content:center;margin-top:18px"><button type="button" class="os-btn os-primary" id="owner-os-retry">Retry Owner OS</button><button type="button" class="os-btn" id="owner-os-signin">Return to sign in</button></div></section></main>`;document.getElementById('owner-os-retry').onclick=()=>{shown=false;recoveryAttempted=false;window.__VEXA_OWNER_BOOTING__=false;window.vexaOwnerOS?.reload?.()};document.getElementById('owner-os-signin').onclick=()=>{window.__VEXA_OWNER_BOOTING__=false;location.replace(location.pathname+'?owner_session_reset='+Date.now())}}
async function recover(){
  if(!loading()||recoveryAttempted)return;
  recoveryAttempted=true;
  const state=window.__VEXA_OWNER_BOOT_STATE__||'starting';
  if(state==='rendered-gateway'||state==='ready')return;
  try{
    const base=(window.VEXA_ACCOUNT_ADMIN_API_BASE||'https://api-vexaaccount.onrender.com').replace(/\/$/,'');
    const r=await fetch(base+'/api/auth/super-admin/session',{credentials:'include',cache:'no-store',headers:{'Cache-Control':'no-cache'}});
    const d=await r.json().catch(()=>({}));
    if(r.ok&&d.success&&window.vexaOwnerOS?.reload){
      window.__VEXA_OWNER_BOOTING__=false;
      window.__VEXA_OWNER_BOOT_STATE__='failsafe-recovery';
      await window.vexaOwnerOS.reload();
      setTimeout(()=>{if(loading())show('Bootstrap recovery completed without rendering the authenticated Owner screen.')},5000);
      return;
    }
    show('Owner session verification did not complete successfully.');
  }catch(e){show('Owner bootstrap recovery failed: '+(e?.message||'network error'))}
}
function watchdog(){if(!loading())return;void recover()}
setTimeout(watchdog,9000);
window.addEventListener('pageshow',()=>setTimeout(watchdog,9000),{once:true});
})();
