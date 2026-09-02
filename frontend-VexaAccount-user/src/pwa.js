/* VexaAccount PWA bootstrap: install UX, service worker registration, and standalone-mode hooks. */
(()=>{
'use strict';
const app=document.getElementById('app');
let deferredPrompt=null;
const isStandalone=()=>window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true;
const ensureInstallButton=()=>{
  if(isStandalone()||document.getElementById('vexa-install-app'))return;
  const button=document.createElement('button');
  button.id='vexa-install-app';
  button.type='button';
  button.textContent='Install VexaAccount';
  button.setAttribute('aria-label','Install VexaAccount app');
  button.style.cssText='position:fixed;z-index:9998;right:16px;bottom:max(16px,env(safe-area-inset-bottom));min-height:46px;padding:0 16px;border:1px solid rgba(255,255,255,.16);border-radius:14px;background:rgba(8,13,24,.94);color:#fff;font:700 13px system-ui,sans-serif;box-shadow:0 16px 44px rgba(0,0,0,.35);backdrop-filter:blur(18px);cursor:pointer';
  button.addEventListener('click',async()=>{if(!deferredPrompt){window.dispatchEvent(new CustomEvent('vexa-pwa-install-unavailable'));return}deferredPrompt.prompt();try{await deferredPrompt.userChoice}catch{}deferredPrompt=null;button.remove()});
  (app||document.body).appendChild(button);
};
window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredPrompt=event;ensureInstallButton()});
window.addEventListener('appinstalled',()=>{deferredPrompt=null;document.getElementById('vexa-install-app')?.remove();window.dispatchEvent(new CustomEvent('vexa-pwa-installed'))});
window.addEventListener('load',async()=>{
  if('serviceWorker' in navigator){
    try{await navigator.serviceWorker.register('./public/sw.js',{scope:'./'});window.dispatchEvent(new CustomEvent('vexa-pwa-ready'))}catch(error){console.warn('[VexaAccount] service worker registration failed',error)}}
  if(!isStandalone())ensureInstallButton();
});
window.vexaPWA={isStandalone,install:async()=>{const button=document.getElementById('vexa-install-app');if(button)button.click()}};
})();
