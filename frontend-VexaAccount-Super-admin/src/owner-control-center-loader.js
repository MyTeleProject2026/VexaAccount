(()=>{
  'use strict';
  if(window.__VEXA_OWNER_CONTROL_LOADER__) return;
  window.__VEXA_OWNER_CONTROL_LOADER__ = true;
  function load(){
    if(document.querySelector('script[data-vexa-owner-control]')) return;
    if(!document.querySelector('#app')){ setTimeout(load,100); return; }
    const script=document.createElement('script');
    script.src='/src/owner-control-center.js?v=20260904-02';
    script.dataset.vexaOwnerControl='1';
    document.body.appendChild(script);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',load,{once:true});
  else load();
})();
