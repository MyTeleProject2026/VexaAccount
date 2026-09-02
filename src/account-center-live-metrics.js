(()=>{
  'use strict';
  if(window.__VEXA_ACCOUNT_CENTER_LIVE_METRICS_V2__) return;
  window.__VEXA_ACCOUNT_CENTER_LIVE_METRICS_V2__=true;

  // Security score is already represented by the authenticated /security snapshot
  // loaded by account-center-runtime-v2. Do not make a second network request just
  // to calculate/display the same value. This avoids an unnecessary request and
  // prevents the standalone /security-score endpoint from producing noisy
  // "Failed to fetch" console errors when that endpoint is unavailable.
  function syncFromRenderedSecurity(){
    const stats=[...document.querySelectorAll('.vx-stat')];
    for(const stat of stats){
      if(!/security strength/i.test(stat.textContent||'')) continue;
      const strong=stat.querySelector('strong');
      if(strong && /^\d+%$/.test((strong.textContent||'').trim())) return;
    }
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',syncFromRenderedSecurity,{once:true});
  }else{
    syncFromRenderedSecurity();
  }

  const observer=new MutationObserver(()=>{
    if(document.querySelector('.vx-content')){
      syncFromRenderedSecurity();
      observer.disconnect();
    }
  });
  if(document.documentElement) observer.observe(document.documentElement,{childList:true,subtree:true});
})();
