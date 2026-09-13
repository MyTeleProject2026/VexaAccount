(()=>{'use strict';
const app=()=>document.getElementById('app');
const loading=()=>/Loading Owner OS|Verifying secure Owner session/i.test(app()?.textContent||'');
let shown=false;
let recoveryAttempted=false;
let watchdogTimer=null;
function safe(v){return String(v||'').replace(/[&<>]/g,'')}
function clearRuntimeOverlay(){
 const el=document.querySelector('#vexa-owner-process');
 if(el){el.classList.remove('show');el.setAttribute('aria-hidden','true');el.style.pointerEvents='none'}
 const op=document.querySelector('#vexa-owner-live-operation');
 if(op){op.classList.remove('visible','owner-operation-full-open','min');op.setAttribute('aria-hidden','true');op.style.pointerEvents='none';op.querySelector('.vo-shell')?.style.setProperty('pointer-events','auto','important')}
 const center=document.querySelector('#vexa-owner-operation-center');
 if(center){center.classList.remove('visible');center.setAttribute('aria-hidden','true');center.style.pointerEvents='none'}
 document.documentElement?.classList.remove('voc-open');
 document.body?.classList.remove('owner-processing','is-loading','loading','voc-open');
}
function dispatchSessionState(state){
 try{window.dispatchEvent(new CustomEvent(state==='authenticated'?'vexa-owner-auth-ready':'vexa-owner-session-lost',{detail:{source:'owner-bootstrap-failsafe',state}}))}catch{}
}
function showLogin(message){
 shown=false;
 window.__VEXA_OWNER_BOOTING__=false;
 window.__VEXA_OWNER_BOOT_STATE__='unauthenticated';
 clearRuntimeOverlay();
 dispatchSessionState('unauthenticated');
 if(window.vexaOwnerOS?.showLogin)window.vexaOwnerOS.showLogin(message||'Your Owner session is not active on this device. Sign in to continue.');
 else window.location.replace(location.pathname+'?owner_session_reset='+Date.now());
}
function showRecovery(message){
 if(shown)return;
 shown=true;
 clearRuntimeOverlay();
 const root=app();
 if(!root)return;
 root.innerHTML=`<main class="os-login" data-owner-recovery="true"><section class="os-login-card"><span class="os-mark">V</span><p class="os-eyebrow">VEXAACCOUNT ECOSYSTEM</p><h1>Owner OS needs recovery</h1><p class="os-muted">${safe(message||'The Owner session could not be verified yet.')}</p><div class="os-actions" style="justify-content:center;margin-top:18px"><button type="button" class="os-btn os-primary" id="owner-os-retry">Retry Owner OS</button><button type="button" class="os-btn" id="owner-os-signin">Return to sign in</button></div></section></main>`;
 const retry=document.getElementById('owner-os-retry');
 const signin=document.getElementById('owner-os-signin');
 if(retry)retry.onclick=()=>{shown=false;recoveryAttempted=false;window.__VEXA_OWNER_BOOTING__=false;window.__VEXA_OWNER_BOOT_STATE__='retrying';clearRuntimeOverlay();window.vexaOwnerOS?.reload?.()};
 if(signin)signin.onclick=()=>{showLogin('Sign in to continue to Owner OS.')};
}
async function recover(reason){
 if(!loading()||recoveryAttempted)return;
 recoveryAttempted=true;
 const state=window.__VEXA_OWNER_BOOT_STATE__||'starting';
 if(state==='rendered-gateway'||state==='ready'||state==='authenticated')return;
 clearRuntimeOverlay();
 try{
  const base=(window.VEXA_ACCOUNT_ADMIN_API_BASE||'https://api-vexaaccount.onrender.com').replace(/\/$/,'');
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(new DOMException('Owner session recovery timeout','TimeoutError')),20000);
  let r;
  try{r=await fetch(base+'/api/auth/super-admin/session',{credentials:'include',cache:'no-store',headers:{'Cache-Control':'no-cache'},signal:controller.signal})}finally{clearTimeout(timer)}
  const d=await r.json().catch(()=>({}));
  if(r.ok&&d.success){
   window.__VEXA_OWNER_BOOTING__=false;
   window.__VEXA_OWNER_BOOT_STATE__='failsafe-recovery';
   dispatchSessionState('authenticated');
   if(window.vexaOwnerOS?.reload){
    await window.vexaOwnerOS.reload();
    setTimeout(()=>{if(loading())showRecovery('Owner authentication is valid, but the Owner interface did not finish rendering.')},6000);
   }
   return;
  }
  if(r.ok&&d.success===false){
   showLogin(d?.message||'Your Owner session is not active on this device. Sign in to continue.');
   return;
  }
  if(r.status===401||r.status===403){
   showLogin('Your Owner session is not active on this device. Sign in to continue.');
   return;
  }
  showRecovery(d?.message||`Owner session verification failed (${r.status}).`);
 }catch(e){
  showRecovery('Owner bootstrap recovery failed: '+(e?.message||'network error'));
 }
}
function watchdog(){
 if(watchdogTimer)clearTimeout(watchdogTimer);
 if(loading())watchdogTimer=setTimeout(()=>void recover('The Owner session check is taking longer than expected.'),12000);
}
window.addEventListener('error',event=>{if(loading()&&!shown)showRecovery('Owner OS frontend error: '+(event?.error?.message||event?.message||'runtime error'))});
window.addEventListener('unhandledrejection',event=>{if(loading()&&!shown)showRecovery('Owner OS bootstrap error: '+(event?.reason?.message||event?.reason||'unhandled promise rejection'))});
setTimeout(watchdog,2000);
window.addEventListener('pageshow',()=>setTimeout(watchdog,2000),{once:true});
})();