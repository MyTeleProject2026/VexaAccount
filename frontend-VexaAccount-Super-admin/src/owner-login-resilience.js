(()=>{'use strict';
if(window.__VEXA_OWNER_LOGIN_RESILIENCE__)return;window.__VEXA_OWNER_LOGIN_RESILIENCE__=true;
const originalFetch=window.fetch.bind(window);
const API=(window.VEXA_ACCOUNT_ADMIN_API_BASE||'https://api-vexaaccount.onrender.com').replace(/\/$/,'');
const AUTH_PATHS=new Set(['/api/auth/super-admin/login','/api/auth/super-admin/session']);
const TOKEN_KEY='vexa_owner_session_token';
function urlOf(input){try{return new URL(typeof input==='string'?input:input.url,location.href)}catch{return null}}
function apiRequest(input){const u=urlOf(input);return !!u&&u.origin===API&&u.pathname.startsWith('/api/')}
function headersWithToken(init){const headers=new Headers(init?.headers||{});let token=null;try{token=sessionStorage.getItem(TOKEN_KEY)}catch{}if(token&&!headers.has('Authorization'))headers.set('Authorization','Bearer '+token);return headers}
window.fetch=async function(input,init={}){
 const u=urlOf(input);
 if(!u||u.origin!==API)return originalFetch(input,init);
 const auth=AUTH_PATHS.has(u.pathname);
 const next={...init,credentials:'include',cache:auth?'no-store':init.cache,headers:headersWithToken(init)};
 if(!apiRequest(input))return originalFetch(input,next);
 const response=await originalFetch(input,next);
 if(u.pathname==='/api/auth/super-admin/login'&&response.ok){try{const copy=response.clone();const data=await copy.json();if(data?.token)sessionStorage.setItem(TOKEN_KEY,String(data.token))}catch{}}
 if(u.pathname==='/api/auth/logout'){try{sessionStorage.removeItem(TOKEN_KEY)}catch{}}
 return response;
};
})();
