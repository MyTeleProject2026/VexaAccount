(()=>{'use strict';
if(window.__VEXA_OWNER_LOGIN_RESILIENCE__)return;window.__VEXA_OWNER_LOGIN_RESILIENCE__=true;
const originalFetch=window.fetch.bind(window);
const API=(window.VEXA_ACCOUNT_ADMIN_API_BASE||'https://api-vexaaccount.onrender.com').replace(/\/$/,'');
const AUTH_PATHS=new Set(['/api/auth/super-admin/login','/api/auth/super-admin/session']);
function isAuthRequest(input){try{const u=typeof input==='string'?new URL(input,location.href):new URL(input.url);return u.origin===API&&AUTH_PATHS.has(u.pathname)}catch{return false}}
// Keep authentication requests uncached, but do not intercept Owner data requests.
// Owner OS has its own request-level timeout. Avoid stacking fetch wrappers around
// /api/owner/users because stacked AbortControllers can leave DevTools showing a
// cancelled request (Status 0 / Duration -) while the page is being restored.
window.fetch=async function(input,init={}){
 if(!isAuthRequest(input))return originalFetch(input,init);
 return originalFetch(input,{...init,credentials:'include',cache:'no-store'});
};
})();
