(()=>{'use strict';
if(window.__VEXA_OWNER_LOGIN_RESILIENCE__)return;window.__VEXA_OWNER_LOGIN_RESILIENCE__=true;
const originalFetch=window.fetch.bind(window);
const API=(window.VEXA_ACCOUNT_ADMIN_API_BASE||'https://api-vexaaccount.onrender.com').replace(/\/$/,'');
const isBootstrapUsersRequest=input=>{try{const u=typeof input==='string'?new URL(input,location.href):new URL(input.url);return u.origin===API&&u.pathname==='/api/owner/users'&&u.searchParams.get('limit')==='200'}catch{return false}};
window.fetch=async function(input,init={}){
 if(!isBootstrapUsersRequest(input))return originalFetch(input,init);
 const u=typeof input==='string'?new URL(input,location.href):new URL(input.url);
 // The initial Owner gateway does not need 200 records. Use the same authenticated,
 // real production endpoint with a bounded page so login is never serialized behind
 // a large user listing. Subsequent user-management searches retain their normal API.
 u.searchParams.set('limit','50');
 u.searchParams.set('offset','0');
 const controller=new AbortController();
 const externalSignal=init?.signal;
 const abort=()=>controller.abort(externalSignal?.reason||new DOMException('Request cancelled','AbortError'));
 if(externalSignal?.aborted)abort();else externalSignal?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(()=>controller.abort(new DOMException('Owner user bootstrap timeout','TimeoutError')),10000);
 try{return await originalFetch(u.toString(),{...init,signal:controller.signal});}
 finally{clearTimeout(timer);externalSignal?.removeEventListener('abort',abort)}
};
})();
