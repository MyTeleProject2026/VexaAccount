(()=>{
  'use strict';
  if(window.__VEXA_ACCOUNT_CENTER_FETCH_GUARD_V4__) return;
  window.__VEXA_ACCOUNT_CENTER_FETCH_GUARD_V4__=true;

  const nativeFetch=window.fetch.bind(window);
  const inflight=new Map();
  const cache=new Map();
  const cooldown=new Map();
  const ACCOUNT=/^https?:\/\/[^/]+\/api\/account\//i;
  const SETTINGS=/\/api\/account\/settings(?:\?|$)/i;
  const allowedSettings=new Set([
    'username','recovery_email','push_notifications_enabled','product_updates_enabled',
    'location_sharing_enabled','personalization_enabled','activity_history_enabled',
    'service_activity_enabled','communication_enabled'
  ]);

  // Account Center uses one authenticated snapshot across navigation. Keep successful
  // GET responses locally for two minutes and coalesce concurrent reads. This prevents
  // route/runtime re-entry from turning normal tab navigation into an API burst.
  const CACHE_MS=120000;
  const STALE_MS=600000;
  const RATE_LIMIT_COOLDOWN_MS=30000;

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
  function responseFrom(s){return new Response(s.body,{status:s.status,statusText:s.statusText,headers:s.headers});}
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
  function cachedResponse(key,allowStale=false){
    const item=cache.get(key);
    if(!item) return null;
    const age=Date.now()-item.at;
    if(age<=CACHE_MS || (allowStale&&age<=STALE_MS)) return responseFrom(item);
    return null;
  }

  window.fetch=async(input,init={})=>{
    const url=urlOf(input);
    const method=methodOf(input,init);

    // A navigation action must never be interpreted as an account-settings write.
    if(malformedSettings(input,init,method,url)){
      return new Response(JSON.stringify({success:true,ignored:true,message:'Navigation action did not change account settings.'}),{
        status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}
      });
    }

    if(!ACCOUNT.test(url)||method!=='GET'){
      if(ACCOUNT.test(url)&&method!=='GET') cache.clear();
      return nativeFetch(input,init);
    }

    const key=keyOf(method,url);
    const now=Date.now();

    // Recent successful account reads are safe to reuse while navigating between pages.
    const fresh=cachedResponse(key);
    if(fresh) return fresh;

    // Never allow two identical account reads to hit the server at the same time.
    if(inflight.has(key)) return responseFrom(await inflight.get(key));

    // If the API has rate-limited this endpoint, use the last good snapshot for a
    // longer quiet period instead of immediately generating another request burst.
    const quietUntil=cooldown.get(key)||0;
    if(now<quietUntil){
      const stale=cachedResponse(key,true);
      if(stale) return stale;
      return new Response(JSON.stringify({success:false,message:'Account data is temporarily rate-limited. Please wait a moment.'}),{
        status:429,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Retry-After':String(Math.ceil((quietUntil-now)/1000))}
      });
    }

    const promise=(async()=>{
      try{
        const response=await nativeFetch(input,init);
        const snap=await snapshot(response);
        if(response.ok){
          cache.set(key,{...snap,at:Date.now()});
          cooldown.delete(key);
        }else if(response.status===429){
          cooldown.set(key,Date.now()+RATE_LIMIT_COOLDOWN_MS);
        }
        return snap;
      }catch(error){
        const stale=cache.get(key);
        if(stale&&Date.now()-stale.at<=STALE_MS) return stale;
        throw error;
      }
    })();

    inflight.set(key,promise);
    try{return responseFrom(await promise)}
    finally{inflight.delete(key)}
  };
})();
