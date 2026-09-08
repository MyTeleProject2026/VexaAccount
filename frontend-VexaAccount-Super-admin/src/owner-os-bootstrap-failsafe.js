(()=>{'use strict';
const app=()=>document.getElementById('app');
const loading=()=>/Loading Owner OS|Verifying secure Owner session/i.test(app()?.textContent||'');
let shown=false;
function safe(v){return String(v||'').replace(/[&<>]/g,'')}
function show(message){if(shown)return;shown=true;const root=app();if(!root)return;root.innerHTML=`<main class="os-login"><section class="os-login-card"><span class="os-mark">V</span><p class="os-eyebrow">VEXAACCOUNT ECOSYSTEM</p><h1>Owner OS did not finish loading</h1><p class="os-muted">${safe(message||'The page did not leave its bootstrap state.')}</p><div class="os-actions" style="justify-content:center;margin-top:18px"><button type="button" class="os-btn os-primary" id="owner-os-retry">Retry Owner OS</button><button type="button" class="os-btn" id="owner-os-signin">Return to sign in</button></div></section></main>`;document.getElementById('owner-os-retry').onclick=()=>{shown=false;window.__VEXA_OWNER_BOOTING__=false;window.vexaOwnerOS?.reload?.()};document.getElementById('owner-os-signin').onclick=()=>{window.__VEXA_OWNER_BOOTING__=false;location.replace(location.pathname+'?owner_session_reset='+Date.now())}}
function watchdog(){if(!loading())return;const state=window.__VEXA_OWNER_BOOT_STATE__||'starting';show('Bootstrap state: '+state+'. The authenticated Owner screen did not render, so automatic reload has been disabled to prevent a refresh loop.')}
setTimeout(watchdog,9000);
window.addEventListener('pageshow',()=>setTimeout(watchdog,9000),{once:true});
})();
