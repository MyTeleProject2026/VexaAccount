(()=>{
  'use strict';
  if(window.__VEXA_OWNER_RUNTIME_COMPAT__)return;
  window.__VEXA_OWNER_RUNTIME_COMPAT__=true;
  function load(){
    if(!document.querySelector('#app')){setTimeout(load,100);return;}
    if(document.querySelector('script[data-vexa-owner-os]'))return;
    const script=document.createElement('script');
    script.src='/src/owner-os.js?v=20260904-01';
    script.dataset.vexaOwnerOs='1';
    document.body.appendChild(script);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();
