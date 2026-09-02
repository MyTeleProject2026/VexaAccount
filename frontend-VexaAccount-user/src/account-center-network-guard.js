(()=>{
'use strict';
if(window.__VEXA_ACCOUNT_CENTER_NETWORK_GUARD__)return;
window.__VEXA_ACCOUNT_CENTER_NETWORK_GUARD__=true;
const API=window.VEXA_ACCOUNT_API_BASE||'https://api-vexaaccount.onrender.com';
const nativeFetch=window.fetch.bind(window);
const inflight=new Map();
const cache=new Map();
const ACCOUNT=/^https?:\/\/[^/]+\/api\/account\//;
const SETTINGS=/\/api\/account\/settings(?:\?|$)/;
const keyOf=(url,method)=>method+' '+url;
const makeResponse=(x)=>new Response(x.body,{status:x.status,statusText:x.statusText,headers:x.headers});
const readResponse=async(response)=>({status:response.status,statusText:response.statusText,headers:[...response.headers.entries()],body:await response.clone().text()});
window.fetch=async(input,init={})=>{
  const url=typeof input==='string'?input:(input?.url||'');
  const method=String(init?.method||(typeof input!=='string'?input?.method:'')||'GET').toUpperCase();
  if(SETTINGS.test(url)&&method==='PATCH'){
    let body=null;
    try{body=typeof init.body==='string'?JSON.parse(init.body):null}catch{}
    const allowed=new Set(['username','recovery_email','push_notifications_enabled','product_updates_enabled','location_sharing_enabled','personalization_enabled','activity_history_enabled','service_activity_enabled','communication_enabled']);
    const keys=Object.keys(body||{});
    if(keys.length&&keys.every(k=>!allowed.has(k)))return new Response(JSON.stringify({success:true,ignored:true,message:'Navigation action did not change account settings.'}),{status:200,headers:{'Content-Type':'application/json'}});
  }
  if(!ACCOUNT.test(url)||method!=='GET')return nativeFetch(input,init);
  const key=keyOf(url,method);
  const now=Date.now();
  const cached=cache.get(key);
  if(cached&&now-cached.at<1200)return makeResponse(cached);
  if(inflight.has(key))return makeResponse(await inflight.get(key));
  const promise=(async()=>{
    let lastError;
    for(let attempt=0;attempt<2;attempt++){
      try{
        const response=await nativeFetch(input,init);
        const data=await readResponse(response);
        cache.set(key,{...data,at:Date.now()});
        return data;
      }catch(error){lastError=error;if(attempt===0)await new Promise(r=>setTimeout(r,250));}
    }
    throw lastError;
  })();
  inflight.set(key,promise);
  try{return makeResponse(await promise)}finally{inflight.delete(key)}
};
})();
