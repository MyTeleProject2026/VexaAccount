(()=>{
'use strict';
if(window.__VEXA_ACCOUNT_RUNTIME_BRIDGE__) return;
window.__VEXA_ACCOUNT_RUNTIME_BRIDGE__=true;
const API=window.VEXA_ACCOUNT_API_BASE||'https://api-vexaaccount.onrender.com';
const token=()=>window.vexaAccountAuth?.getToken?.()||localStorage.getItem('vexaaccount_access_token')||sessionStorage.getItem('vexaaccount_access_token')||null;
const notify=(m,t='info')=>window.vexaNotify?window.vexaNotify(m,t):window.toast?window.toast(m,t):console.log(m);
async function api(path,opt={}){
  const h=new Headers(opt.headers||{});
  if(opt.body&&!h.has('Content-Type')) h.set('Content-Type','application/json');
  const t=token(); if(t) h.set('Authorization','Bearer '+t);
  const r=await fetch(API+path,{credentials:'include',...opt,headers:h});
  const d=await r.json().catch(()=>({success:false,message:'Invalid server response'}));
  if(!r.ok||d.success===false) throw new Error(d.message||`Request failed (${r.status})`);
  return d;
}
const clear=()=>{window.vexaAccountAuth?.clearToken?.();for(const s of [localStorage,sessionStorage])for(const k of ['vexaaccount_access_token','vexa_access_token','access_token','token','userToken','accessToken']){try{s.removeItem(k)}catch{}}};
window.vexaAccountCenterApi=api;
window.logout=async()=>{try{await api('/api/auth/logout',{method:'POST'})}catch{}clear();location.hash='#/login';location.reload()};
window.vexaAccountBack=()=>{const h=location.hash||'';if(/^#\/(login|register|forgot-password|reset-password|verify-email|login-2fa)/.test(h))return location.hash='#/login';if(history.length>1)return history.back();window.go?.('home')};
function safeGo(original){return function(page){const root=document.querySelector('#vx-content');if(!root){window.__VEXA_PENDING_ACCOUNT_VIEW__=page;return false}try{return original.call(this,page)}catch(err){if(/null|undefined/.test(String(err?.message||''))){window.__VEXA_PENDING_ACCOUNT_VIEW__=page;return false}throw err}}}
function patchGo(){if(typeof window.go!=='function'||window.go.__vexaSafe)return false;const original=window.go;const wrapped=safeGo(original);wrapped.__vexaSafe=true;wrapped.__vexaOriginal=original;window.go=wrapped;return true}
function bindPassword(){const form=document.querySelector('#password-form');if(!form||form.__vexaBound)return;form.__vexaBound=true;form.onsubmit=async e=>{e.preventDefault();const f=new FormData(form),currentPassword=String(f.get('currentPassword')||''),newPassword=String(f.get('newPassword')||''),confirmPassword=String(f.get('confirmPassword')||'');if(newPassword!==confirmPassword)return notify('New passwords do not match','error');try{const start=await api('/api/account/change/password/start',{method:'POST',body:JSON.stringify({currentPassword,newPassword,confirmPassword})});notify(start.message||'Verification code sent','success');const otp=prompt('Enter the 6-digit verification code sent to your account email:');if(otp===null)return;await api('/api/account/change/password/verify',{method:'POST',body:JSON.stringify({otp:otp.trim()})});notify('Password changed successfully. Please sign in again.','success');clear();location.hash='#/login';location.reload()}catch(err){notify(err.message,'error')}}}
function bindShell(){const top=document.querySelector('.vx-top');if(!top||top.__vexaBridgeBound)return;top.__vexaBridgeBound=true;const left=top.querySelector('.vx-top-left');if(left&&!left.querySelector('.vx-bridge-back')){const b=document.createElement('button');b.className='vx-icon vx-bridge-back';b.type='button';b.textContent='‹';b.title='Back';b.setAttribute('aria-label','Back');b.onclick=window.vexaAccountBack;left.prepend(b)}const foot=document.querySelector('.vx-foot');if(foot&&!foot.querySelector('.vx-bridge-logout')){const b=document.createElement('button');b.className='vx-btn danger vx-bridge-logout';b.type='button';b.textContent='Sign out';b.style.cssText='width:100%;margin-top:10px';b.onclick=window.logout;foot.appendChild(b)}const account=document.querySelector('#vx-account');if(account&&!account.__vexaLogoutBound){account.__vexaLogoutBound=true;account.title='Account menu — click to open Personal info';}bindPassword();}
function routeGuard(){const hash=location.hash||'';const protectedRoute=!/^#\/(login|signin|register|forgot-password|verify-email|reset-password|login-2fa)/.test(hash);if(!token()&&protectedRoute){location.hash='#/login';return false}return true}
function run(){patchGo();if(!routeGuard())return;bindShell();const pending=window.__VEXA_PENDING_ACCOUNT_VIEW__;if(pending&&document.querySelector('#vx-content')&&typeof window.go==='function'){delete window.__VEXA_PENDING_ACCOUNT_VIEW__;window.go(pending)}else bindPassword();}
new MutationObserver(run).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>{setTimeout(run,0)});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
})();
