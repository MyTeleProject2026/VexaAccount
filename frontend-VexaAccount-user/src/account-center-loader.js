/* VexaAccount Account Center loader — single-flight, no startup flash, no polling. */
(()=>{'use strict';
if(window.__VEXA_ACCOUNT_CENTER_LOADER_V6__)return;window.__VEXA_ACCOUNT_CENTER_LOADER_V5__=true;
const AUTH=/^#\/(login|signin|register|forgot-password|verify-email|reset-password|login-2fa)(?:[/?]|$)/i;
const SWITCHER=/^#\/account-switcher(?:[/?]|$)/i,SSO=/^#\/sso-manager(?:[/?]|$)/i;
const isSpecial=()=>AUTH.test(location.hash||'')||SWITCHER.test(location.hash||'')||SSO.test(location.hash||'')||location.hash.startsWith('#/sso/authorize')||window.__VEXA_SSO_FLOW_ACTIVE__===true;
const root=()=>document.getElementById('vexa-react-root'),app=()=>document.getElementById('app');
const token=()=>{try{return window.vexaAccountAuth?.getToken?.()||null}catch{return null}};
const showError=(title,message)=>{const a=app();if(!a)return;a.style.display='block';a.replaceChildren();const main=document.createElement('main');main.className='shell loading-shell';const card=document.createElement('section');card.className='card glass loading-card';card.innerHTML='<img class="loading-logo" src="./public/brand.svg" alt="VexaAccount"><p class="eyebrow">VEXA ACCOUNT</p>';const h=document.createElement('h1');h.textContent=title;const p=document.createElement('p');p.className='muted';p.textContent=message;const retry=document.createElement('button');retry.id='vx-runtime-retry';retry.className='btn primary';retry.type='button';retry.textContent='Retry';retry.onclick=()=>{retry.disabled=true;load(true)};const login=document.createElement('button');login.className='btn';login.type='button';login.textContent='Sign in again';login.onclick=()=>{location.hash='#/login'};card.append(h,p,retry,login);main.append(card);a.append(main)};
const loadScript=(src,marker)=>new Promise((resolve,reject)=>{const old=document.querySelector('script[data-vexa-account-runtime="'+marker+'"]');if(old?.dataset.loaded==='1')return resolve();const s=old||document.createElement('script');let done=false;const finish=e=>{if(done)return;done=true;e?reject(e):(s.dataset.loaded='1',resolve())};const timer=setTimeout(()=>finish(new Error(marker+' timed out')),15000);s.addEventListener('load',()=>{clearTimeout(timer);finish()},{once:true});s.addEventListener('error',()=>{clearTimeout(timer);finish(new Error('Failed to load '+marker))},{once:true});if(!old){s.src=src;s.dataset.vexaAccountRuntime=marker;document.body.appendChild(s)}});
let loading=false;
async function ensureSession(){if(typeof window.vexaSessionFetch!=='function')return !!token();try{const d=await window.vexaSessionFetch();return d?.success===true&&!!d.user}catch{return false}}
async function load(force=false){
 if(loading||window.__VEXA_ACCOUNT_CENTER_READY__||isSpecial())return;
 loading=true;
 try{
  if(!(await ensureSession())){showError('Sign in required','Your secure session was not found. Please sign in to continue.');return}
  const v='20260926-05';
  await loadScript('./src/account-center-toast-guard.js?'+v,'account-center-toast-guard.js');
  await loadScript('./src/account-center-fetch-guard.js?'+v,'account-center-fetch-guard.js');
  await loadScript('./src/account-center-runtime-v2.js?'+v,'account-center-runtime-v2.js');
  await loadScript('./src/account-center-premium-theme.js?'+v,'account-center-premium-theme.js');
  const started=Date.now();
  while(Date.now()-started<12000){if(root()?.querySelector('#vx-content'))break;await new Promise(r=>setTimeout(r,50))}
  if(!root()?.querySelector('#vx-content'))throw new Error('Account Center did not finish initialization');
  window.__VEXA_ACCOUNT_CENTER_READY__=true;
  root().style.display='block';
  const a=app();if(a){a.style.display='none';a.replaceChildren()}
 }catch(e){console.error('[VexaAccount] Account Center startup failed',e);showError('Unable to start Account Center',e?.message||'The secure account workspace could not be started.')}
 finally{loading=false}
}
function schedule(){clearTimeout(window.__VEXA_ACCOUNT_RUNTIME_TIMER__);window.__VEXA_ACCOUNT_RUNTIME_TIMER__=setTimeout(()=>load(false),0)}
window.addEventListener('hashchange',schedule);
window.addEventListener('vexa:auth-changed',schedule);
window.addEventListener('vexaAccountAuthChanged',schedule);
window.addEventListener('vexa-auth-ready',schedule);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();