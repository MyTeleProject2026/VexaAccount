(()=>{
'use strict';
if(window.__VEXA_ACCOUNT_CENTER_FETCH_GUARD_V4__)return;
window.__VEXA_ACCOUNT_CENTER_FETCH_GUARD_V4__=true;
const nativeFetch=window.fetch.bind(window),inflight=new Map(),cache=new Map(),cooldown=new Map();
const ACCOUNT=/^https?:\/\/[^/]+\/api\/account(?:\/|$)/i,SETTINGS=/\/api\/account\/settings(?:\?|$)/i;
const allowedSettings=new Set(['username','recovery_email','push_notifications_enabled','product_updates_enabled','location_sharing_enabled','personalization_enabled','activity_history_enabled','service_activity_enabled','communication_enabled']);
const CACHE_MS=120000,STALE_MS=600000,RATE_LIMIT_COOLDOWN_MS=30000;
const urlOf=input=>typeof input==='string'?input:(input?.url||'');
const methodOf=(input,init)=>String(init?.method||(typeof input!=='string'?input?.method:'')||'GET').toUpperCase();
const normalizeUrl=url=>{try{const u=new URL(url,location.href);u.hash='';return u.toString()}catch{return url}};
const keyOf=(method,url)=>`${method} ${normalizeUrl(url)}`;
async function snapshot(response){return{status:response.status,statusText:response.statusText,headers:[...response.headers.entries()],body:await response.clone().text()}}
const responseFrom=s=>new Response(s.body,{status:s.status,statusText:s.statusText,headers:s.headers});
function malformedSettings(init,method,url){if(method!=='PATCH'||!SETTINGS.test(url))return false;try{const raw=init?.body;if(typeof raw!=='string')return false;const keys=Object.keys(JSON.parse(raw)||{});return keys.length>0&&keys.every(k=>!allowedSettings.has(k))}catch{return false}}
function cachedResponse(key,allowStale=false){const item=cache.get(key);if(!item)return null;const age=Date.now()-item.at;if(age<=CACHE_MS||(allowStale&&age<=STALE_MS))return responseFrom(item);cache.delete(key);return null}
window.fetch=async(input,init={})=>{const url=urlOf(input),method=methodOf(input,init);if(malformedSettings(init,method,url))return new Response(JSON.stringify({success:true,ignored:true,message:'Navigation action did not change account settings.'}),{status:200,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});if(!ACCOUNT.test(url)||method!=='GET'){if(ACCOUNT.test(url)&&method!=='GET')cache.clear();return nativeFetch(input,init)}const key=keyOf(method,url),now=Date.now(),fresh=cachedResponse(key);if(fresh)return fresh;if(inflight.has(key))return responseFrom(await inflight.get(key));const quietUntil=cooldown.get(key)||0;if(now<quietUntil){const stale=cachedResponse(key,true);if(stale)return stale;return new Response(JSON.stringify({success:false,message:'Account data is temporarily rate-limited. Please wait a moment.'}),{status:429,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Retry-After':String(Math.ceil((quietUntil-now)/1000))}})}const promise=(async()=>{try{const response=await nativeFetch(input,init),snap=await snapshot(response);if(response.ok){cache.set(key,{...snap,at:Date.now()});cooldown.delete(key)}else if(response.status===429)cooldown.set(key,Date.now()+RATE_LIMIT_COOLDOWN_MS);return snap}catch(error){const stale=cache.get(key);if(stale&&Date.now()-stale.at<=STALE_MS)return stale;throw error}})();inflight.set(key,promise);try{return responseFrom(await promise)}finally{inflight.delete(key)}};
})();
