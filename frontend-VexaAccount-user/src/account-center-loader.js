(()=>{
'use strict';
if(window.__VEXA_ACCOUNT_CENTER_LOADER__) return;
window.__VEXA_ACCOUNT_CENTER_LOADER__=true;
const API=window.VEXA_ACCOUNT_API_BASE||'https://api-vexaaccount.onrender.com';
const AUTH=/^#\/(login|signin|register|forgot-password|verify-email|reset-password|login-2fa)(?:[/?]|$)/i;
const TOKEN_KEYS=['vexaaccount_access_token','vexa_access_token','access_token','token','userToken','accessToken'];
const token=()=>{try{if(window.vexaAccountAuth?.getToken?.())return window.vexaAccountAuth.getToken()}catch{}for(const s of [localStorage,sessionStorage])for(const k of TOKEN_KEYS){try{const v=s.getItem(k);if(v)return v}catch{}}return null};
const loaded=new Set();
function load(src){return new Promise((resolve,reject)=>{if(loaded.has(src)||document.querySelector(`script[data-vexa-account-runtime="${src}"]`)){loaded.add(src);return resolve()}const s=document.createElement('script');s.src=`./src/${src}?v=20260902-26`;s.dataset.vexaAccountRuntime=src;s.onload=()=>{loaded.add(src);resolve()};s.onerror=()=>reject(new Error(`Failed to load ${src}`));document.body.appendChild(s)})}
async function loadRuntime(){if(AUTH.test(location.hash||''))return;if(!token())return;if(window.__VEXA_ACCOUNT_RUNTIME_READY__)return;try{await load('account-center-runtime.js');window.__VEXA_ACCOUNT_RUNTIME_READY__=true;for(const src of ['account-center-runtime-bridge.js','account-center-enhancements.js','account-center-hotfix.js']){try{await load(src)}catch(e){console.error('[VexaAccount] optional runtime module failed:',src,e)}}}catch(e){console.error('[VexaAccount] account center runtime failed to load:',e)}}
function schedule(){clearTimeout(window.__VEXA_ACCOUNT_RUNTIME_TIMER__);window.__VEXA_ACCOUNT_RUNTIME_TIMER__=setTimeout(loadRuntime,0)}
window.addEventListener('hashchange',schedule);window.addEventListener('storage',schedule);window.addEventListener('vexa:auth-changed',schedule);window.addEventListener('vexaAccountAuthChanged',schedule);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();
