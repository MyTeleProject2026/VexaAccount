(()=>{
  'use strict';
  if(window.__VEXA_ACCOUNT_CENTER_LIVE_METRICS__) return;
  window.__VEXA_ACCOUNT_CENTER_LIVE_METRICS__=true;
  const API=window.VEXA_ACCOUNT_API_BASE||'https://api-vexaaccount.onrender.com';
  const keys=['vexaaccount_access_token','vexa_access_token','access_token','token','userToken','accessToken'];
  const token=()=>{
    try{const t=window.vexaAccountAuth?.getToken?.();if(t)return t}catch{}
    for(const store of [localStorage,sessionStorage]) for(const key of keys){try{const v=store.getItem(key);if(v)return v}catch{}}
    return null;
  };
  let done=false;
  function updateScore(score){
    const value=`${Math.max(0,Math.min(100,Number(score)||0))}%`;
    const candidates=[...document.querySelectorAll('.vx-stat strong,[data-stat-value]')];
    const labelNodes=[...document.querySelectorAll('.vx-stat small,.vx-info-label')];
    for(const label of labelNodes){
      if(/security strength/i.test(label.textContent||'')){
        const strong=label.parentElement?.querySelector('strong,[data-stat-value]');
        if(strong) strong.textContent=value;
      }
    }
    candidates.forEach(n=>{
      const parent=n.closest('.vx-stat');
      if(parent&&/security strength/i.test(parent.textContent||'')) n.textContent=value;
    });
  }
  async function load(){
    if(done||!token()||!document.querySelector('.vx-content')) return;
    done=true;
    try{
      const r=await fetch(`${API}/api/account/security-score`,{credentials:'include',headers:{Authorization:`Bearer ${token()}`}});
      const d=await r.json().catch(()=>null);
      if(r.ok&&d?.success&&Number.isFinite(Number(d.score))) updateScore(Number(d.score));
    }catch(e){console.debug('[VexaAccount] live security score:',e.message)}
  }
  const observer=new MutationObserver(()=>{if(document.querySelector('.vx-content')){load();observer.disconnect()}});
  observer.observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',load,{once:true}); else load();
})();
