(()=>{'use strict';
if(window.__VEXA_OWNER_RUNTIME_GUARD__)return;window.__VEXA_OWNER_RUNTIME_GUARD__=true;
const originalFetch=window.fetch.bind(window);
const API=(window.VEXA_ACCOUNT_ADMIN_API_BASE||'https://api-vexaaccount.onrender.com').replace(/\/$/,'');
const BOOT_PATHS=new Set(['/api/sso-registry/applications','/api/sso-registry/audit','/api/owner/users']);
const MAX_BOOT_RETRIES=3;
let retries=0;
let recoveryInFlight=false;
let recoveryTimer=null;
function isBootRequest(input){try{const u=typeof input==='string'?new URL(input,location.href):new URL(input.url);return u.origin===API&&BOOT_PATHS.has(u.pathname)}catch{return false}}
window.fetch=async function(input,init={}){
 if(!isBootRequest(input))return originalFetch(input,init);
 const controller=new AbortController();
 const externalSignal=init?.signal;
 const forwardAbort=()=>controller.abort(externalSignal?.reason||new DOMException('Request cancelled','AbortError'));
 if(externalSignal?.aborted)forwardAbort();else externalSignal?.addEventListener('abort',forwardAbort,{once:true});
 const timer=setTimeout(()=>controller.abort(new DOMException('Owner bootstrap request timeout','TimeoutError')),12000);
 try{return await originalFetch(input,{...init,signal:controller.signal});}
 finally{clearTimeout(timer);externalSignal?.removeEventListener('abort',forwardAbort)}
};
async function sessionIsStillValid(){try{const r=await originalFetch(API+'/api/auth/super-admin/session',{credentials:'include',headers:{Accept:'application/json'}});return r.ok&&((await r.json().catch(()=>({}))).success===true)}catch{return false}}
function showRestoring(){const card=document.querySelector('.os-login-card');if(!card)return;const p=card.querySelector('.os-runtime-status')||document.createElement('p');p.className='os-runtime-status os-muted';p.textContent='Owner session is still authenticated. Restoring control systems…';if(!p.parentNode)card.appendChild(p)}
async function recover(){if(recoveryInFlight||retries>=MAX_BOOT_RETRIES||!window.vexaOwnerOS?.reload)return;recoveryInFlight=true;try{if(!(await sessionIsStillValid())){recoveryInFlight=false;return}retries+=1;showRestoring();setTimeout(()=>{try{window.vexaOwnerOS.reload()}catch{}},Math.min(1500*retries,4500))}catch{recoveryInFlight=false}}
function scheduleRecovery(delay=1800){if(recoveryInFlight||recoveryTimer)return;recoveryTimer=setTimeout(()=>{recoveryTimer=null;if(document.querySelector('.os-login-card'))recover()},delay)}
const observer=new MutationObserver(()=>{if(document.querySelector('.os-login-card')&&window.vexaOwnerOS?.reload)scheduleRecovery(300)});
function start(){observer.observe(document.documentElement,{subtree:true,childList:true});scheduleRecovery(1800)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
