(()=>{'use strict';
if(window.__VEXA_OWNER_LOGIN_RESILIENCE__)return;window.__VEXA_OWNER_LOGIN_RESILIENCE__=true;
const originalFetch=window.fetch.bind(window);
const API=(window.VEXA_ACCOUNT_ADMIN_API_BASE||'https://api-vexaaccount.onrender.com').replace(/\/$/,'');
let bootstrapUsersHandled=false;
const isBootstrapUsersRequest=input=>{try{const u=typeof input==='string'?new URL(input,location.href):new URL(input.url);return u.origin===API&&u.pathname==='/api/owner/users'&&u.searchParams.get('limit')==='200'&&!bootstrapUsersHandled}catch{return false}};
window.fetch=async function(input,init={}){
 if(!isBootstrapUsersRequest(input))return originalFetch(input,init);
 bootstrapUsersHandled=true;
 const controller=new AbortController();
 const externalSignal=init?.signal;
 const abort=()=>controller.abort(externalSignal?.reason||new DOMException('Request cancelled','AbortError'));
 if(externalSignal?.aborted)abort();else externalSignal?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(()=>controller.abort(new DOMException('Owner user bootstrap timeout','TimeoutError')),5000);
 try{
   const response=await originalFetch(input,{...init,signal:controller.signal});
   clearTimeout(timer);return response;
 }catch(error){
   clearTimeout(timer);
   if(error?.name!=='AbortError'&&error?.name!=='TimeoutError')throw error;
   // Retry against the same authenticated production endpoint with a smaller real page.
   // This returns real database rows; it never fabricates user data.
   const u=typeof input==='string'?new URL(input,location.href):new URL(input.url);
   u.searchParams.set('limit','50');u.searchParams.set('offset','0');
   return originalFetch(u.toString(),{...init,signal:externalSignal});
 }finally{externalSignal?.removeEventListener('abort',abort)}
};
})();
