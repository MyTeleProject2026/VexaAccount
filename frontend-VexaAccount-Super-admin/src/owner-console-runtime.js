(()=>{
  'use strict';
  if(window.__VEXA_OWNER_RUNTIME_COMPAT__)return;
  window.__VEXA_OWNER_RUNTIME_COMPAT__=true;
  function loadScript(src,attr,onload){
    const existing=document.querySelector(`script[${attr}]`);
    if(existing){onload?.();return existing;}
    const script=document.createElement('script');
    script.src=src;
    script.setAttribute(attr,'1');
    script.onload=()=>onload?.();
    document.body.appendChild(script);
    return script;
  }
  function load(){
    if(!document.querySelector('#app')){setTimeout(load,100);return;}
    loadScript('/src/owner-os.js?v=20260904-01','data-vexa-owner-os',()=>{
      // The operation runtime is deliberately loaded after Owner OS so it becomes
      // the authoritative non-blocking execution bridge used by SSO actions.
      loadScript('/src/owner-operation-runtime.js?v=20260912-02','data-vexa-owner-operation-runtime');
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();