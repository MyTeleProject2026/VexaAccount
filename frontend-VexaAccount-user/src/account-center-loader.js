/* VexaAccount Account Center — deterministic single-start loader. */
(()=>{'use strict';
if(window.__VEXA_ACCOUNT_CENTER_LOADER_V9__)return;
window.__VEXA_ACCOUNT_CENTER_LOADER_V9__=true;
const VERSION='20260926-09';
const AUTH=/^#\/(login|signin|register|forgot-password|verify-email|reset-password|login-2fa)(?:[/?]|$)/i;
const SWITCHER=/^#\/account-switcher(?:[/?]|$)/i;
const SSO=/^#\/sso-manager(?:[/?]|$)/i;
const root=()=>document.getElementById('vexa-react-root');
const app=()=>document.getElementById('app');
const special=()=>AUTH.test(location.hash||'')||SWITCHER.test(location.hash||'')||SSO.test(location.hash||'')||/^#\/sso\/authorize/i.test(location.hash||'')||window.__VEXA_SSO_FLOW_ACTIVE__===true;
const token=()=>{try{return window.vexaAccountAuth?.getToken?.()||null}catch{return null}};
const showError=(title,message)=>{
 const a=app(); if(!a)return;
 a.style.display='block'; a.replaceChildren();
 const main=document.createElement('main'); main.className='shell loading-shell';
 const card=document.createElement('section'); card.className='card glass loading-card';
 card.innerHTML='<img class="loading-logo" src="./public/brand.svg" alt="VexaAccount"><p class="eyebrow">VEXA ACCOUNT</p>';
 const h=document.createElement('h1');h.textContent=title;
 const p=document.createElement('p');p.className='muted';p.textContent=message;
 const retry=document.createElement('button');retry.className='btn primary';retry.type='button';retry.textContent='Retry';
 retry.onclick=()=>{retry.disabled=true;start(true)};
 const login=document.createElement('button');login.className='btn';login.type='button';login.textContent='Sign in again';
 login.onclick=()=>{location.hash='#/login'};
 card.append(h,p,retry,login);main.append(card);a.append(main);
};
const loadScript=(src,marker)=>new Promise((resolve,reject)=>{
 const selector='script[data-vexa-account-runtime="'+marker+'"]';
 const old=document.querySelector(selector);
 if(old?.dataset.loaded==='1')return resolve();
 const s=old||document.createElement('script'); let settled=false;
 const finish=err=>{if(settled)return;settled=true;clearTimeout(timer);if(err)reject(err);else{s.dataset.loaded='1';resolve()}};
 const timer=setTimeout(()=>finish(new Error(marker+' timed out')),15000);
 s.addEventListener('load',()=>finish(),{once:true});
 s.addEventListener('error',()=>finish(new Error('Failed to load '+marker)),{once:true});
 if(!old){s.src=src;s.dataset.vexaAccountRuntime=marker;document.body.appendChild(s)}
});
let loading=false, started=false;
async function ensureSession(){
 if(typeof window.vexaSessionFetch!=='function')return !!token();
 try{const d=await window.vexaSessionFetch();return d?.success===true&&!!d.user}catch{return false}
}
async function start(force=false){
 if(loading||started||special())return;
 if(!force&&window.__VEXA_ACCOUNT_CENTER_READY__)return;
 loading=true;
 try{
  if(!(await ensureSession())){showError('Sign in required','Your secure VexaAccount session was not found. Please sign in to continue.');return}
  await loadScript('./src/account-center-toast-guard.js?v='+VERSION,'account-center-toast-guard.js');
  await loadScript('./src/account-center-fetch-guard.js?v='+VERSION,'account-center-fetch-guard.js');
  await loadScript('./src/account-center-premium-theme.js?v='+VERSION,'account-center-premium-theme.js');
  await loadScript('./src/account-center-runtime-v2.js?v='+VERSION,'account-center-runtime-v2.js');
  // Runtime injects its base CSS dynamically; re-assert the final visual contract after
  // that injection so startup cannot repaint from the premium dark theme into the base theme.
  const stabilityId='vexa-account-final-stability-v1';
  if(!document.getElementById(stabilityId)){
   const st=document.createElement('style');
   st.id=stabilityId;
   st.textContent='html,body{background:#050811!important;color:#f7f9ff!important}body{min-width:320px;overflow-x:hidden}.vx-content,.vx-page{animation:none!important;transform:none!important}.vx-side,.vx-icon,.vx-nav button,.vx-action,.vx-btn,.vx-card,.vx-input,.vx-select,.vx-textarea{transition:none!important}.vx-head h1{font-size:clamp(22px,4vw,30px)!important;line-height:1.12}.vx-head p,.vx-desc,.vx-row small,.vx-info-label{font-size:clamp(12px,1.7vw,14px)!important;line-height:1.5}.vx-card-title{font-size:clamp(15px,2vw,17px)!important;line-height:1.3}.vx-btn,.vx-icon{min-height:44px}.vx-input,.vx-select,.vx-textarea{min-height:48px;font-size:16px}@media(max-width:720px){.vx-content{padding:16px 12px calc(82px + env(safe-area-inset-bottom))!important}.vx-head h1{font-size:23px!important}.vx-head p{font-size:13px!important}.vx-card{border-radius:18px;padding:16px}.vx-card-title{font-size:15px!important}.vx-desc,.vx-row small,.vx-info-label{font-size:12px!important}.vx-btn{min-height:46px;padding:10px 14px}.vx-input,.vx-select,.vx-textarea{min-height:50px}.vx-hero{border-radius:18px}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}';
   document.head.appendChild(st);
  }
  const deadline=Date.now()+12000;
  while(Date.now()<deadline){
   if(root()?.querySelector('#vx-content'))break;
   await new Promise(r=>setTimeout(r,80));
  }
  if(!root()?.querySelector('#vx-content'))throw new Error('Account Center did not finish initialization');
  started=true;window.__VEXA_ACCOUNT_CENTER_READY__=true;
  root().style.display='block';
  const a=app();if(a){a.style.display='none';a.replaceChildren()}
 }catch(e){
  console.error('[VexaAccount] startup failed',e);
  showError('Unable to start Account Center',e?.message||'The secure account workspace could not be started.');
 }finally{loading=false}
}
function schedule(){if(special())return;clearTimeout(window.__VEXA_ACCOUNT_RUNTIME_TIMER__);window.__VEXA_ACCOUNT_RUNTIME_TIMER__=setTimeout(()=>start(false),0)}
window.addEventListener('hashchange',schedule,{passive:true});
window.addEventListener('vexa:auth-changed',schedule,{passive:true});
window.addEventListener('vexaAccountAuthChanged',schedule,{passive:true});
window.addEventListener('vexa-auth-ready',schedule,{passive:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
})();