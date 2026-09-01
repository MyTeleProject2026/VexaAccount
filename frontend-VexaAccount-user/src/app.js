/* VexaAccount User canonical runtime loader. */
(()=>{if(window.__VEXA_ACCOUNT_RUNTIME_LOADING__)return;window.__VEXA_ACCOUNT_RUNTIME_LOADING__=true;
const TOKEN_KEYS=['vexaaccount_access_token','vexa_access_token','access_token','token','userToken','accessToken'];
const getToken=()=>{for(const store of [localStorage,sessionStorage])for(const k of TOKEN_KEYS){try{const v=store.getItem(k);if(v&&String(v).trim())return String(v).trim()}catch{}}return null};
const saveToken=t=>{if(!t||typeof t!=='string')return;for(const store of [localStorage,sessionStorage])for(const k of TOKEN_KEYS){try{store.setItem(k,t)}catch{}}};
const clearToken=()=>{for(const store of [localStorage,sessionStorage])for(const k of TOKEN_KEYS){try{store.removeItem(k)}catch{}}};
const pickToken=d=>d?.token||d?.accessToken||d?.access_token||d?.data?.token||d?.data?.accessToken||d?.data?.access_token||d?.session?.token||null;
const originalFetch=window.fetch.bind(window);
window.fetch=async(input,init={})=>{const url=typeof input==='string'?input:(input&&input.url)||'';const headers=new Headers(init.headers||{});const token=getToken();if(token&&/\/api\//.test(url)&&!headers.has('Authorization'))headers.set('Authorization','Bearer '+token);const response=await originalFetch(input,{...init,headers});
if(/\/api\//.test(url)){try{const d=await response.clone().json();const fresh=pickToken(d);if(fresh)saveToken(String(fresh));}catch{}}
if(/\/api\/auth\/logout$/.test(url)&&response.ok)clearToken();return response};
window.vexaAccountAuth={getToken,saveToken,clearToken};
try{const h=location.hash||'';if(!getToken()&&!/^#\/(login|signin|register|forgot-password|verify-email|reset-password|login-2fa)/.test(h))location.hash='#/login'}catch{}
})();
