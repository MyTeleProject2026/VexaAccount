(()=>{
'use strict';
if(window.__VEXA_ACCOUNT_CENTER_LOADER__)return;
window.__VEXA_ACCOUNT_CENTER_LOADER__=true;
const AUTH=/^#\/(login|signin|register|forgot-password|verify-email|reset-password|login-2fa)(?:[/?]|$)/i;
const TOKEN_KEYS=['vexaaccount_access_token','vexa_access_token','access_token','token','userToken','accessToken'];
const token=()=>{try{const t=window.vexaAccountAuth?.getToken?.();if(t)return t}catch{}for(const s of [localStorage,sessionStorage])for(const k of TOKEN_KEYS){try{const v=s.getItem(k);if(v)return v}catch{}}return null};
let loading=false;
function exposeRoot(){const r=document.getElementById('vexa-react-root'),a=document.getElementById('app');if(r)r.style.display='block';if(a)a.style.display='none'}
function loadCompat(){if(document.querySelector('script[data-vexa-account-runtime="account-center-v2-compat.js"]'))return;const s=document.createElement('script');s.src='./src/account-center-v2-compat.js?v=20260902-28';s.dataset.vexaAccountRuntime='account-center-v2-compat.js';document.body.appendChild(s)}
function load(){if(loading||window.__VEXA_ACCOUNT_CENTER_READY__||AUTH.test(location.hash||'')||!token())return;loading=true;exposeRoot();const s=document.createElement('script');s.src='./src/account-center-runtime-v2.js?v=20260902-28';s.dataset.vexaAccountRuntime='account-center-runtime-v2.js';s.onload=()=>{loading=false;loadCompat()};s.onerror=()=>{loading=false;console.error('[VexaAccount] Account Center runtime failed to load')};document.body.appendChild(s)}
function schedule(){clearTimeout(window.__VEXA_ACCOUNT_RUNTIME_TIMER__);window.__VEXA_ACCOUNT_RUNTIME_TIMER__=setTimeout(load,0)}
window.addEventListener('hashchange',schedule);window.addEventListener('storage',schedule);window.addEventListener('vexa:auth-changed',schedule);window.addEventListener('vexaAccountAuthChanged',schedule);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();
