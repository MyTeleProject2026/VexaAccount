(()=>{
  'use strict';
  if(window.__VEXA_OWNER_RUNTIME_COMPAT__)return;
  window.__VEXA_OWNER_RUNTIME_COMPAT__=true;
  function loadScript(src,attr,onload,onerror){
    const existing=document.querySelector(`script[${attr}]`);
    if(existing){onload?.();return existing;}
    const script=document.createElement('script');
    script.src=src;
    script.setAttribute(attr,'1');
    script.onload=()=>onload?.();
    script.onerror=()=>onerror?.(new Error(`Failed to load ${src}`));
    document.body.appendChild(script);
    return script;
  }
  function load(){
    if(!document.querySelector('#app')){setTimeout(load,100);return;}
    loadScript('/src/owner-os.js?v=20260904-01','data-vexa-owner-os',()=>{
      loadScript('/src/owner-operation-runtime.js?v=20260913-01','data-vexa-owner-operation-runtime',null,error=>console.error('[VexaAccount Owner OS] operation runtime failed to load',error));
    },error=>console.error('[VexaAccount Owner OS] Owner OS failed to load',error));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();
