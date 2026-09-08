(()=>{'use strict';
const app=()=>document.getElementById('app');
const stillLoading=()=>/Loading Owner OS|Verifying secure Owner session/i.test(app()?.textContent||'');
let shown=false;
function safe(v){return String(v||'').replace(/[&<>]/g,'')}
function show(message){
 if(shown)return;shown=true;
 const root=app();if(!root)return;
 root.innerHTML=`<main class="os-login"><section class="os-login-card"><span class="os-mark">V</span><p class="os-eyebrow">VEXAACCOUNT ECOSYSTEM</p><h1>Owner OS did not finish loading</h1><p class="os-muted">${safe(message||'The page is still in its loading state. No automatic reload will be started.')}</p><div class="os-actions" style="justify-content:center;margin-top:18px"><button type="button" class="os-btn os-primary" id="owner-os-retry">Retry Owner OS</button><button type="button" class="os-btn" id="owner-os-reload">Reload once</button></div></section></main>`;
 document.getElementById('owner-os-retry').onclick=()=>{shown=false;window.vexaOwnerOS?.reload?.()};
 document.getElementById('owner-os-reload').onclick=()=>location.reload();
}
setTimeout(()=>{if(stillLoading())show('Authentication requests may have completed, but the Owner OS renderer did not replace the loading screen.');},20000);
window.addEventListener('pageshow',()=>setTimeout(()=>{if(stillLoading())show('The restored page remained in the loading state.');},20000),{once:true});
})();
