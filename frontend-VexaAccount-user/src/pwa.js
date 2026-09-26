/* VexaAccount PWA bootstrap — stable single-registration lifecycle. */
(()=>{'use strict';
if(window.__VEXA_PWA_BOOTSTRAPPED__)return;window.__VEXA_PWA_BOOTSTRAPPED__=true;
let deferredPrompt=null,registration=null,refreshing=false,expectControllerChange=false;
const standalone=()=>window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true;
const ios=()=>/iphone|ipad|ipod/i.test(navigator.userAgent);
const el=id=>document.getElementById(id);
function banner(id,text,buttonText,action){if(el(id))return;const b=document.createElement('div');b.id=id;b.setAttribute('role','status');b.style.cssText='position:fixed;left:12px;right:12px;bottom:max(12px,env(safe-area-inset-bottom));z-index:9999;display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid rgba(148,163,184,.28);border-radius:16px;background:rgba(8,13,24,.96);color:#fff;font:600 13px system-ui,sans-serif;box-shadow:0 18px 50px rgba(0,0,0,.3);backdrop-filter:blur(18px)';const span=document.createElement('span');span.style.flex='1';span.textContent=text;const btn=document.createElement('button');btn.type='button';btn.textContent=buttonText;btn.style.cssText='border:0;border-radius:10px;padding:9px 12px;background:#2563eb;color:#fff;font-weight:800';btn.onclick=()=>{try{action?.()}finally{b.remove()}};b.append(span,btn);document.body.appendChild(b)}
function showInstall(){if(standalone()||!deferredPrompt)return;banner('vexa-install-app','Install VexaAccount for a faster app-like experience.','Install',async()=>{const p=deferredPrompt;deferredPrompt=null;try{await p.prompt();await p.userChoice}catch{}})}
function showIOS(){if(standalone()||!ios())return;banner('vexa-ios-install','On iPhone/iPad: tap Share, then “Add to Home Screen”.','Got it')}
function showUpdate(){if(!registration?.waiting)return;banner('vexa-pwa-update','A new VexaAccount version is ready.','Update',()=>{expectControllerChange=true;registration.waiting?.postMessage({type:'SKIP_WAITING'})})}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredPrompt=e;showInstall()});
window.addEventListener('appinstalled',()=>{deferredPrompt=null;el('vexa-install-app')?.remove();window.dispatchEvent(new CustomEvent('vexa-pwa-installed'))});
window.addEventListener('load',async()=>{
 if(!('serviceWorker'in navigator))return;
 try{
  const regs=await navigator.serviceWorker.getRegistrations();
  registration=regs.find(r=>new URL(r.scope).origin===location.origin)||null;
  if(!registration) registration=await navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'});
  registration.addEventListener('updatefound',()=>{const w=registration.installing;if(!w)return;w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)showUpdate()})});
  await registration.update().catch(()=>{});
  navigator.serviceWorker.addEventListener('controllerchange',()=>{if(refreshing||!expectControllerChange)return;expectControllerChange=false;refreshing=true;window.location.reload()});
  window.dispatchEvent(new CustomEvent('vexa-pwa-ready'));
  if(ios())setTimeout(showIOS,1200);
 }catch(error){console.warn('[VexaAccount] service worker registration failed',error)}
});
async function enableNotifications(){
 if(!('Notification'in window)||!('PushManager'in window.navigator)||!registration)return {success:false,message:'This browser does not support Web Push.'};
 if(Notification.permission==='denied')return {success:false,message:'Notifications are blocked. Enable notifications for VexaAccount in the browser/device app settings.'};
 const permission=Notification.permission==='granted'?'granted':await Notification.requestPermission();
 if(permission!=='granted')return {success:false,message:'Notification permission was not granted.'};
 try{
  const keyResponse=await fetch((window.VEXA_ACCOUNT_API_BASE||'https://api-vexaaccount.onrender.com')+'/api/account/push/vapid-public-key',{credentials:'include'});
  const keyData=await keyResponse.json();
  if(!keyData.enabled||!keyData.publicKey)throw Error('Web Push is not configured on the VexaAccount server yet.');
  let sub=await registration.pushManager.getSubscription();
  if(!sub)sub=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:base64UrlToUint8Array(keyData.publicKey)});
  const r=await fetch((window.VEXA_ACCOUNT_API_BASE||'https://api-vexaaccount.onrender.com')+'/api/account/push/subscription',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({subscription:sub.toJSON(),platform:ios()?'ios':/android/i.test(navigator.userAgent)?'android':'web'})});
  const d=await r.json();if(!r.ok||d.success===false)throw Error(d.message||'Unable to register device notifications');
  window.dispatchEvent(new CustomEvent('vexa:push-enabled'));return {success:true};
 }catch(e){return {success:false,message:e.message||'Unable to enable notifications.'}}
}
function base64UrlToUint8Array(value){const pad='='.repeat((4-value.length%4)%4),raw=atob((value+pad).replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from([...raw].map(c=>c.charCodeAt(0)))}
window.vexaPWA={isStandalone:standalone,install:showInstall,showIOS,update:showUpdate,enableNotifications};
})();