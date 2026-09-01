/* VexaAccount User canonical runtime loader. */
(()=>{if(window.__VEXA_ACCOUNT_RUNTIME_LOADING__)return;window.__VEXA_ACCOUNT_RUNTIME_LOADING__=true;
const TOKEN_KEYS=['vexaaccount_access_token','vexa_access_token','access_token','token','userToken','accessToken'];
const read=s=>{try{return s.getItem?.bind(s)}catch{return null}};
const getToken=()=>{for(const store of [localStorage,sessionStorage]){for(const k of TOKEN_KEYS){try{const v=store.getItem(k);if(v&&String(v).trim())return String(v).trim()}catch{}}}return null};
const saveToken=t=>{if(!t||typeof t!=='string')return;for(const store of [localStorage,sessionStorage]){for(const k of TOKEN_KEYS){try{store.setItem(k,t)}catch{}}}};
const clearToken=()=>{for(const store of [localStorage,sessionStorage]){for(const k of TOKEN_KEYS){try{store.removeItem(k)}catch{}}}};
const pickToken=d=>d?.token||d?.accessToken||d?.access_token||d?.data?.token||d?.data?.accessToken||d?.data?.access_token||d?.session?.token||null;
const originalFetch=window.fetch.bind(window);
window.fetch=async(input,init={})=>{const url=typeof input==='string'?input:(input&&input.url)||'';const headers=new Headers(init.headers||{});const token=getToken();if(token&&/\/api\//.test(url)&&!headers.has('Authorization'))headers.set('Authorization','Bearer '+token);const response=await originalFetch(input,{...init,headers});
if(/\/api\//.test(url)){try{const d=await response.clone().json();const fresh=pickToken(d);if(fresh)saveToken(String(fresh));if(response.status===401)clearToken()}catch{if(response.status===401)clearToken()}}
if(/\/api\/auth\/logout$/.test(url)&&response.ok)clearToken();return response};
try{const h=location.hash||'';if(!getToken()&&!/^#\/(login|signin|register|forgot-password|verify-email|reset-password)/.test(h))location.hash='#/login'}catch{}
const version='20260902-3';const add=src=>{const s=document.createElement('script');s.src=src+'?v='+version;s.defer=true;document.head.appendChild(s)};const css=document.createElement('link');css.rel='stylesheet';css.href='./src/vexatrade-notifications.css?v='+version;document.head.appendChild(css);add('./src/vexatrade-toast-runtime.js');add('./src/vexatrade-toast-compat.js');add('./src/app-v3.js');})();