(()=>{'use strict';
if(window.__VEXA_SECURITY_SCORE_BRIDGE_V1__)return;
window.__VEXA_SECURITY_SCORE_BRIDGE_V1__=true;
const API=(window.VEXA_ACCOUNT_API_BASE||'https://api-vexaaccount.onrender.com').replace(/\\/$/,'');
const keys=['vexaaccount_access_token','vexa_access_token','access_token','token','userToken','accessToken'];
const token=()=>{try{const t=window.vexaAccountAuth?.getToken?.();if(t)return t}catch{}for(const s of [localStorage,sessionStorage])for(const k of keys){try{const v=s.getItem(k);if(v)return v}catch{}}return null};
async function refresh(){
 const t=token();if(!t)return;
 try{
  const r=await fetch(API+'/api/account/security-score',{credentials:'include',headers:{Authorization:'Bearer '+t,Accept:'application/json'}});
  if(!r.ok)return;
  const d=await r.json();if(!d?.success)return;
  const score=Math.max(0,Math.min(100,Number(d.score)||0));
  document.querySelectorAll('.vx-page[data-page="home"] .vx-stat strong').forEach((el,i)=>{if(i===0)el.textContent=score+'%'});
  window.__VEXA_ACCOUNT_SECURITY_SCORE__=d;
 }catch{}
}
const boot=()=>{refresh();new MutationObserver(()=>refresh()).observe(document.body,{childList:true,subtree:true})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();