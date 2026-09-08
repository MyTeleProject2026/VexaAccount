(()=>{'use strict';
if(window.__VEXA_OWNER_AUTH_NATIVE_BOUNDARY__)return;
window.__VEXA_OWNER_AUTH_NATIVE_BOUNDARY__=true;
const native=window.__VEXA_OWNER_NATIVE_FETCH__||window.fetch.bind(window);
const API=(window.VEXA_ACCOUNT_ADMIN_API_BASE||'https://api-vexaaccount.onrender.com').replace(/\/$/,'');
const authPaths=new Set(['/api/auth/super-admin/login','/api/auth/super-admin/session']);
const urlOf=input=>{try{return new URL(typeof input==='string'?input:input.url,location.href)}catch{return null}};
const previous=window.fetch.bind(window);
window.fetch=function(input,init={}){
 const u=urlOf(input);
 if(u&&u.origin===API&&authPaths.has(u.pathname)){
   const headers=new Headers(init.headers||{});
   headers.delete('Authorization');
   return native(input,{...init,credentials:'include',cache:'no-store',headers});
 }
 return previous(input,init);
};
})();
