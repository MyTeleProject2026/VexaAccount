/* VexaAccount canonical authentication/session bootstrap. */
(()=>{
'use strict';
if(window.__VEXA_ACCOUNT_RUNTIME_LOADING__)return;
window.__VEXA_ACCOUNT_RUNTIME_LOADING__=true;
const PRIMARY_KEY='vexaaccount_access_token';
const LEGACY_KEYS=['vexa_access_token','access_token','token','userToken','accessToken'];
const read=(store,key)=>{try{const value=store.getItem(key);return value&&String(value).trim()?String(value).trim():null}catch{return null}};
const getToken=()=>read(localStorage,PRIMARY_KEY)||read(sessionStorage,PRIMARY_KEY)||LEGACY_KEYS.map(k=>read(localStorage,k)||read(sessionStorage,k)).find(Boolean)||null;
const saveToken=token=>{if(!token||typeof token!=='string'||!token.trim())return;try{localStorage.setItem(PRIMARY_KEY,token.trim())}catch{try{sessionStorage.setItem(PRIMARY_KEY,token.trim())}catch{}}};
const clearToken=()=>{for(const store of [localStorage,sessionStorage])for(const key of [PRIMARY_KEY,...LEGACY_KEYS]){try{store.removeItem(key)}catch{}}};
const pickToken=data=>data?.token||data?.accessToken||data?.access_token||data?.data?.token||data?.data?.accessToken||data?.data?.access_token||data?.session?.token||null;
const previousFetch=window.fetch.bind(window);
window.fetch=async(input,init={})=>{
  const url=typeof input==='string'?input:(input&&input.url)||'';
  const headers=new Headers(init.headers||{});
  const token=getToken();
  if(token&&/\/api\//.test(url)&&!headers.has('Authorization'))headers.set('Authorization','Bearer '+token);
  const response=await previousFetch(input,{...init,headers});
  if(/\/api\//.test(url)){
    try{const data=await response.clone().json();const fresh=pickToken(data);if(fresh)saveToken(String(fresh))}catch{}
  }
  if(/\/api\/auth\/logout(?:\?|$)/.test(url)&&response.ok)clearToken();
  return response;
};
window.vexaAccountAuth={getToken,saveToken,clearToken};
try{
  const hash=location.hash||'';
  const authRoute=/^#\/(login|signin|register|forgot-password|verify-email|reset-password|login-2fa)(?:[/?]|$)/i;
  if(!getToken()&&!authRoute.test(hash)&&!hash.startsWith('#/sso/authorize'))location.hash='#/login';
}catch{}
})();