(()=>{
  'use strict';
  if(window.__VEXA_OWNER_CONTROL_LOADER__)return;
  window.__VEXA_OWNER_CONTROL_LOADER__=true;
  function loadScript(src,key){
    if(document.querySelector(`script[data-${key}]`))return;
    const script=document.createElement('script');
    script.src=src;
    script.dataset[key]='1';
    document.body.appendChild(script);
  }
  function load(){
    if(!document.querySelector('#app')){setTimeout(load,100);return;}
    loadScript('/src/owner-os.js?v=20260904-01','vexa-owner-os');
    loadScript('/src/owner-source-repair.js?v=20260910-01','vexa-owner-source-repair');
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();
