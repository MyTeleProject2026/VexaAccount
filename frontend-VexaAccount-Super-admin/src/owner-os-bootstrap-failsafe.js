(()=>{'use strict';
const app=()=>document.getElementById('app');
const loading=()=>/Loading Owner OS|Verifying secure Owner session/i.test(app()?.textContent||'');
let shown=false;
let recoveryAttempted=false;
function safe(v){return String(v||'').replace(/[&<>]/g,'')}
function clearRuntimeOverlay(){const el=document.querySelector('#vexa-owner-process');if(el){el.classList.remove('show');el.setAttribute('aria-hidden','true')}document.body?.classList.remove('owner-processing','is-loading','loading')}
function show(message){if(shown)return;shown=true;clearRuntimeOverlay();const root=app();if(!root)return;root.innerHTML=`<main class="os-login"><section class="os-login-card"><span class="os-mark">V</span><p class="os-eyebrow">VEXAACCOUNT ECOSYSTEM</p><h1>Owner OS needs recovery</h1><p class="os-muted">${safe(message||'The secure Owner session completed, but the Owner interface did not finish rendering.')}</p><div class="os-actions" style="justify-content:center;margin-top:18px"><button type="button" class="os-btn os-primary" id="owner-os-retry">Retry Owner OS</button><button type="button" class="os-btn" id="owner-os-signin">Return to sign in</button></div></section></main>`;document.getElementById('owner-os-retry').onclick=()=>{shown=false;recoveryAttempted=false;window.__VEXA_OWNER_BOOTING__=false;window.__VEXA_OWNER_BOOT_STATE__='retrying';window.vexaOwnerOS?.reload?.()};document.getElementById('owner-os-signin').onclick=()=>{window.__VEXA_OWNER_BOOTING__=false;location.replace(location.pathname+'?owner_session_reset='+Date.now())}}
async function recover(reason){
  if(!loading()||recoveryAttempted)return;
  recoveryAttempted=true;
  const state=window.__VEXA_OWNER_BOOT_STATE__||'starting';
  if(state==='rendered-gateway'||state==='ready')return;
  clearRuntimeOverlay();
  try{
    const base=(window.VEXA_ACCOUNT_ADMIN_API_BASE||'https://api-vexaaccount.onrender.com').replace(/\/$/,'');
    const r=await fetch(base+'/api/auth/super-admin/session',{credentials:'include',cache:'no-store',headers:{'Cache-Control':'no-cache'}});
    const d=await r.json().catch(()=>({}));
    if(r.ok&&d.success&&window.vexaOwnerOS?.reload){
      window.__VEXA_OWNER_BOOTING__=false;
      window.__VEXA_OWNER_BOOT_STATE__='failsafe-recovery';
      await window.vexaOwnerOS.reload();
      setTimeout(()=>{if(loading())show('Owner authentication is valid, but the Owner UI renderer did not complete. '+(reason||'Bootstrap watchdog detected the stalled screen.'))},4000);
      return;
    }
    show(d?.message||'Owner session verification did not complete successfully.');
  }catch(e){show('Owner bootstrap recovery failed: '+(e?.message||'network error'))}
}
function watchdog(){if(!loading())return;void recover('The bootstrap watchdog detected that the loading screen remained active.')}
window.addEventListener('error',event=>{if(loading())show('Owner OS frontend error: '+(event?.error?.message||event?.message||'runtime error'))});
window.addEventListener('unhandledrejection',event=>{if(loading())show('Owner OS bootstrap error: '+(event?.reason?.message||event?.reason||'unhandled promise rejection'))});
setTimeout(watchdog,8000);
window.addEventListener('pageshow',()=>setTimeout(watchdog,8000),{once:true});
})();
