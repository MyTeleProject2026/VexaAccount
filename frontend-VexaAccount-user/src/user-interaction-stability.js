(()=>{
'use strict';
if(window.__VEXA_USER_INTERACTION_STABILITY_V1__)return;
window.__VEXA_USER_INTERACTION_STABILITY_V1__=true;
const API=(window.VEXA_ACCOUNT_API_BASE||'https://api-vexaaccount.onrender.com').replace(/\/$/,'');
const TOKEN_KEYS=['vexaaccount_access_token','vexa_access_token','access_token','token','userToken','accessToken'];
const token=()=>{try{const t=window.vexaAccountAuth?.getToken?.();if(t)return t}catch{}for(const s of [localStorage,sessionStorage])for(const k of TOKEN_KEYS){try{const v=s.getItem(k);if(v)return v}catch{}}return null};
const clear=()=>{try{window.vexaAccountAuth?.clearToken?.()}catch{}for(const s of [localStorage,sessionStorage])for(const k of TOKEN_KEYS)try{s.removeItem(k)}catch{}};
const busy=new WeakSet();
document.addEventListener('click',event=>{
 const target=event.target?.closest?.('[data-action="logout"]');
 if(!target)return;
 event.preventDefault();
 event.stopImmediatePropagation();
 if(busy.has(target))return;
 busy.add(target);target.disabled=true;
 const headers={Accept:'application/json'};const t=token();if(t)headers.Authorization='Bearer '+t;
 fetch(API+'/api/auth/logout',{method:'POST',credentials:'include',headers}).catch(()=>{}).finally(()=>{
   clear();
   window.dispatchEvent(new Event('vexa-auth-cleared'));
   location.hash='#/login';
   busy.delete(target);
 });
},true);
document.addEventListener('click',event=>{
 const target=event.target?.closest?.('[data-action],[data-page]');
 if(!target||target.dataset.action==='logout')return;
 if(target.dataset.busyClick==='1'){event.preventDefault();event.stopImmediatePropagation();return}
 target.dataset.busyClick='1';
 setTimeout(()=>{try{delete target.dataset.busyClick}catch{}},700);
},true);
})();
