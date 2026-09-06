(()=>{
'use strict';
if(window.__VEXA_ACCOUNT_FUNCTIONAL_BRIDGE__)return;
window.__VEXA_ACCOUNT_FUNCTIONAL_BRIDGE__=true;
const API=window.VEXA_ACCOUNT_API_BASE||'https://api-vexaaccount.onrender.com';
const token=()=>{try{return window.vexaAccountAuth?.getToken?.()||null}catch{return null}};
const emit=(name,detail)=>{try{window.dispatchEvent(new CustomEvent(name,{detail}))}catch{window.dispatchEvent(new Event(name))}};
async function request(path,options={}){
 const method=String(options.method||'GET').toUpperCase();
 const headers=new Headers(options.headers||{});
 if(options.body!==undefined&&!headers.has('Content-Type')&&!(options.body instanceof FormData))headers.set('Content-Type','application/json');
 const t=token();if(t&&!headers.has('Authorization'))headers.set('Authorization','Bearer '+t);
 const response=await fetch(API+path,{...options,method,credentials:'include',headers});
 const type=response.headers.get('content-type')||'';
 const data=type.includes('json')?await response.json().catch(()=>({})) : await response.text();
 if(response.status===401){emit('vexa:auth-expired',{path,status:401});throw Object.assign(new Error(data?.message||'Your VexaAccount session has expired.'),{status:401,auth:true,data})}
 if(!response.ok||data?.success===false){throw Object.assign(new Error(data?.message||`Request failed (${response.status})`),{status:response.status,data})}
 const fresh=data?.token||data?.accessToken||data?.access_token||data?.data?.token||data?.data?.accessToken||null;
 if(fresh&&window.vexaAccountAuth?.saveToken)window.vexaAccountAuth.saveToken(String(fresh));
 emit('vexa:api-success',{path,method,status:response.status,data});
 return data;
}
function get(path,options={}){return request(path,{...options,method:'GET'})}
function post(path,body,options={}){return request(path,{...options,method:'POST',body:body===undefined?undefined:(body instanceof FormData?body:JSON.stringify(body))})}
function put(path,body,options={}){return request(path,{...options,method:'PUT',body:body===undefined?undefined:(body instanceof FormData?body:JSON.stringify(body))})}
function patch(path,body,options={}){return request(path,{...options,method:'PATCH',body:body===undefined?undefined:(body instanceof FormData?body:JSON.stringify(body))})}
function del(path,options={}){return request(path,{...options,method:'DELETE'})}
window.vexaAccountClient={API,request,get,post,put,patch,delete:del,getToken:token,emit};
window.vexaAccountClient.refreshSession=async()=>{
 try{const d=await get('/api/auth/session');emit('vexa:session-refreshed',d);return d}catch(e){if(e?.status===401){try{window.vexaAccountAuth?.clearToken?.()}catch{}emit('vexa:auth-expired',e)}throw e}
};
window.addEventListener('vexa-auth-ready',()=>emit('vexa:auth-changed',{authenticated:true}));
window.addEventListener('vexa-auth-cleared',()=>emit('vexa:auth-changed',{authenticated:false}));
})();
