/* VexaAccount session bridge — one request per bootstrap, no polling/reload loops. */
(()=>{'use strict';
if(window.__VEXA_SESSION_BRIDGE_V3__)return;
window.__VEXA_SESSION_BRIDGE_V3__=true;
const API=(window.VEXA_ACCOUNT_API_BASE||'https://api-vexaaccount.onrender.com').replace(/\/$/,'');
const getToken=()=>window.vexaAccountAuth?.getToken?.()||null;
let bootstrapPromise=null;
async function request(path){
 const headers={'Accept':'application/json'};
 const token=getToken();if(token)headers.Authorization='Bearer '+token;
 return fetch(API+path,{credentials:'include',headers,cache:'no-store'});
}
window.vexaSessionFetch=async()=>{
 if(bootstrapPromise)return bootstrapPromise;
 bootstrapPromise=(async()=>{
  const r=await request('/api/auth/session');
  const d=await r.json().catch(()=>({success:false,message:'Invalid session response'}));
  if(d?.success===true&&d.user)return d;
  const token=getToken();
  if(!token)return d;
  const p=await request('/api/auth/profile');
  const pd=await p.json().catch(()=>({success:false}));
  if(p.ok&&pd.success&&pd.user)return{success:true,user:pd.user,recoveredFromProfile:true};
  return d;
 })();
 try{return await bootstrapPromise}finally{bootstrapPromise=null}
};
async function bootstrapCookieSession(){
 if(getToken()||/^#\/(login|signin|register|forgot-password|verify-email|reset-password|login-2fa)/i.test(location.hash||'')||/^#\/sso\/authorize/i.test(location.hash||''))return;
 try{
  const d=await window.vexaSessionFetch();
  if(d?.success!==true||!d.user)return;
  if(/^#\/$|^#$/.test(location.hash||''))window.dispatchEvent(new CustomEvent('vexa:auth-changed',{detail:{user:d.user,source:'cookie-session'}}));
  window.dispatchEvent(new Event('vexa-auth-ready'));
 }catch(error){console.debug('[VexaAccount] cookie session bootstrap skipped',error?.message||error)}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bootstrapCookieSession,{once:true});else bootstrapCookieSession();
})();