/* VexaAccount PWA bootstrap: single worker, stable install UX, update UX and iOS guidance. */
(()=>{
'use strict';
if(window.__VEXA_PWA_BOOTSTRAPPED__)return;window.__VEXA_PWA_BOOTSTRAPPED__=true;
let deferredPrompt=null,registration=null;
const standalone=()=>window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true;
const ios=()=>/iphone|ipad|ipod/i.test(navigator.userAgent);
const el=id=>document.getElementById(id);
function banner(id,text,buttonText,action){if(el(id))return;const b=document.createElement('div');b.id=id;b.setAttribute('role','status');b.style.cssText='position:fixed;left:12px;right:12px;bottom:max(12px,env(safe-area-inset-bottom));z-index:9999;display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid rgba(148,163,184,.28);border-radius:16px;background:rgba(8,13,24,.96);color:#fff;font:600 13px system-ui,sans-serif;box-shadow:0 18px 50px rgba(0,0,0,.3);backdrop-filter:blur(18px)';b.innerHTML='<span style="flex:1">'+text+'</span><button type="button" style="border:0;border-radius:10px;padding:9px 12px;background:#2563eb;color:#fff;font-weight:800">'+buttonText+'</button>';b.querySelector('button').onclick=()=>{if(action)action();b.remove()};document.body.appendChild(b)}
function showInstall(){if(standalone()||!deferredPrompt)return;banner('vexa-install-app','Install VexaAccount for a faster app-like experience.','Install',async()=>{const p=deferredPrompt;deferredPrompt=null;try{await p.prompt();await p.userChoice}catch{}})}
function showIOS(){if(standalone()||!ios())return;banner('vexa-ios-install','On iPhone/iPad: tap Share, then “Add to Home Screen”.','Got it')}
function showUpdate(){banner('vexa-pwa-update','A new VexaAccount version is ready.','Update',()=>registration?.waiting?.postMessage({type:'SKIP_WAITING'}))}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;showInstall()});
window.addEventListener('appinstalled',()=>{deferredPrompt=null;el('vexa-install-app')?.remove();window.dispatchEvent(new CustomEvent('vexa-pwa-installed'))});
window.addEventListener('load',async()=>{
 if(!('serviceWorker'in navigator))return;
 try{
  const regs=await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.filter(r=>new URL(r.scope).origin===location.origin).map(r=>r.unregister()));
  registration=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
  registration.addEventListener('updatefound',()=>{const w=registration.installing;if(!w)return;w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)showUpdate()})});
  await registration.update().catch(()=>{});
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(!window.__VEXA_PWA_RELOADED__){window.__VEXA_PWA_RELOADED__=true;location.reload()}});
  window.dispatchEvent(new CustomEvent('vexa-pwa-ready'));
  if(ios())setTimeout(showIOS,1200);
 }catch(error){console.warn('[VexaAccount] service worker registration failed',error)}
});
window.vexaPWA={isStandalone:standalone,install:showInstall,showIOS,update:showUpdate};
})();
