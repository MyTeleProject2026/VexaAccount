(()=>{
  'use strict';
  if(window.__VEXA_ACCOUNT_CENTER_FETCH_GUARD_V2__) return;
  window.__VEXA_ACCOUNT_CENTER_FETCH_GUARD_V2__=true;

  const nativeFetch=window.fetch.bind(window);
  const inflight=new Map();
  const cache=new Map();
  const ACCOUNT=/^https?:\/\/[^/]+\/api\/account\//i;
  const SETTINGS=/\/api\/account\/settings(?:\?|$)/i;
  const allowedSettings=new Set([
    'username','recovery_email','push_notifications_enabled','product_updates_enabled',
    'location_sharing_enabled','personalization_enabled','activity_history_enabled',
    'service_activity_enabled','communication_enabled'
  ]);
  const CACHE_MS=5000;

  const urlOf=input=>typeof input==='string'?input:(input?.url||'');
  const methodOf=(input,init)=>String(init?.method||(typeof input!=='string'?input?.method:'')||'GET').toUpperCase();
  const keyOf=(method,url)=>`${method} ${url}`;

  async function snapshot(response){
    return {
      status:response.status,
      statusText:response.statusText,
      headers:[...response.headers.entries()],
      body:await response.clone().text()
    };
  }
  function responseFrom(s){
    return new Response(s.body,{status:s.status,statusText:s.statusText,headers:s.headers});
  }
  function malformedSettings(input,init,method,url){
    if(method!=='PATCH'||!SETTINGS.test(url)) return false;
    try{
      const raw=init?.body;
      if(typeof raw!=='string') return false;
      const body=JSON.parse(raw);
      const keys=Object.keys(body||{});
      return keys.length>0 && keys.every(k=>!allowedSettings.has(k));
    }catch{return false}
  }

  window.fetch=async(input,init={})=>{
    const url=urlOf(input);
    const method=methodOf(input,init);

    // Navigation clicks must never become account-settings writes.
    if(malformedSettings(input,init,method,url)){
      return new Response(JSON.stringify({success:true,ignored:true,message:'Navigation action did not change account settings.'}),{
        status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}
      });
    }

    if(!ACCOUNT.test(url)||method!=='GET'){
      if(ACCOUNT.test(url)&&method!=='GET'){
        // Any successful mutation invalidates cached account reads so the next render sees fresh state.
        for(const key of cache.keys()) cache.delete(key);
      }
      return nativeFetch(input,init);
    }

    const key=keyOf(method,url);
    const now=Date.now();
    const cached=cache.get(key);
    if(cached && now-cached.at<CACHE_MS) return responseFrom(cached);

    if(inflight.has(key)) return responseFrom(await inflight.get(key));

    const promise=(async()=>{
      // Do not retry account reads automatically. A retry storm is what turns a temporary
      // browser/network problem into ERR_INSUFFICIENT_RESOURCES and 429 responses.
      const response=await nativeFetch(input,init);
      const snap=await snapshot(response);
      if(response.ok) cache.set(key,{...snap,at:Date.now()});
      return snap;
    })();

    inflight.set(key,promise);
    try{return responseFrom(await promise)}
    finally{inflight.delete(key)}
  };
})();
