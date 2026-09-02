(()=>{
'use strict';
if(window.__VEXA_ACCOUNT_CENTER_LOADER__)return;
window.__VEXA_ACCOUNT_CENTER_LOADER__=true;
const AUTH=/^#\/(login|signin|register|forgot-password|verify-email|reset-password|login-2fa)(?:[/?]|$)/i;
const TOKEN_KEYS=['vexaaccount_access_token','vexa_access_token','access_token','token','userToken','accessToken'];
const token=()=>{try{const t=window.vexaAccountAuth?.getToken?.();if(t)return t}catch{}for(const s of [localStorage,sessionStorage])for(const k of TOKEN_KEYS){try{const v=s.getItem(k);if(v)return v}catch{}}return null};
const loadScript=(src,marker)=>new Promise((resolve,reject)=>{if(document.querySelector(`script[data-vexa-account-runtime="${marker}"]`))return resolve();const s=document.createElement('script');s.src=src;s.dataset.vexaAccountRuntime=marker;s.onload=resolve;s.onerror=reject;document.body.appendChild(s)});
let loading=false;
function exposeRoot(){const r=document.getElementById('vexa-react-root'),a=document.getElementById('app');if(r)r.style.display='block';if(a)a.style.display='none'}
async function load(){if(loading||window.__VEXA_ACCOUNT_CENTER_READY__||AUTH.test(location.hash||'')||!token())return;loading=true;exposeRoot();try{
  // Install the bounded notification bridge first. The canonical runtime can then
  // never fall back to an unbounded DOM toast stack during early bootstrap.
  await loadScript('./src/account-center-toast-guard.js?v=20260903-01','account-center-toast-guard.js');
  // One canonical Account Center runtime. Legacy workflow runtimes are deliberately
  // excluded because their observers/intervals can re-route an already-rendered page.
  await loadScript('./src/account-center-runtime-v2.js?v=20260903-01','account-center-runtime-v2.js');
  await loadScript('./src/account-center-v2-compat.js?v=20260903-01','account-center-v2-compat.js');
  window.__VEXA_ACCOUNT_CENTER_READY__=true;
}catch(e){console.error('[VexaAccount] Account Center canonical runtime failed to load',e)}finally{loading=false}}
function schedule(){clearTimeout(window.__VEXA_ACCOUNT_RUNTIME_TIMER__);window.__VEXA_ACCOUNT_RUNTIME_TIMER__=setTimeout(load,0)}
window.addEventListener('hashchange',schedule);window.addEventListener('storage',schedule);window.addEventListener('vexa:auth-changed',schedule);window.addEventListener('vexaAccountAuthChanged',schedule);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();
