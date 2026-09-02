/* VexaAccount PWA bootstrap: app-wide service worker, stale-worker cleanup, and stable install UX. */
(()=>{
'use strict';
let deferredPrompt=null;
const isStandalone=()=>window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true;
const installButton=()=>document.getElementById('vexa-install-app');
const showInstallButton=()=>{
  if(isStandalone()||installButton()||!deferredPrompt)return;
  const button=document.createElement('button');
  button.id='vexa-install-app';button.type='button';button.textContent='Install VexaAccount';button.setAttribute('aria-label','Install VexaAccount app');
  button.style.cssText='position:fixed;z-index:9998;right:16px;bottom:max(16px,env(safe-area-inset-bottom));min-height:46px;padding:0 16px;border:1px solid rgba(255,255,255,.16);border-radius:14px;background:rgba(8,13,24,.94);color:#fff;font:700 13px system-ui,sans-serif;box-shadow:0 16px 44px rgba(0,0,0,.35);backdrop-filter:blur(18px);cursor:pointer';
  button.addEventListener('click',async()=>{if(!deferredPrompt)return;const prompt=deferredPrompt;deferredPrompt=null;try{await prompt.prompt();await prompt.userChoice}catch{}button.remove()});
  document.body.appendChild(button);
};
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredPrompt=event;showInstallButton()});
window.addEventListener('appinstalled',()=>{deferredPrompt=null;installButton()?.remove();window.dispatchEvent(new CustomEvent('vexa-pwa-installed'))});
window.addEventListener('load',async()=>{
  if(!('serviceWorker' in navigator))return;
  try{
    const registrations=await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.filter(r=>new URL(r.scope).pathname.startsWith('/public/')).map(r=>r.unregister()));
    const registration=await navigator.serviceWorker.register('./sw.js',{scope:'./'});
    registration.update().catch(()=>{});
    window.dispatchEvent(new CustomEvent('vexa-pwa-ready'));
  }catch(error){console.warn('[VexaAccount] service worker registration failed',error)}
});
window.vexaPWA={isStandalone,install:async()=>{if(deferredPrompt)showInstallButton();else window.dispatchEvent(new CustomEvent('vexa-pwa-install-unavailable'))}};
})();
