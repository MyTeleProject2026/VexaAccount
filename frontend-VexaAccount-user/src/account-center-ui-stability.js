(()=>{
'use strict';
if(window.__VEXA_ACCOUNT_CENTER_UI_STABILITY_V2__)return;
window.__VEXA_ACCOUNT_CENTER_UI_STABILITY_V2__=true;
function install(){
  const side=document.querySelector('.vx-side');
  const topLeft=document.querySelector('.vx-top-left');
  if(side&&!side.querySelector('[data-vexa-stability="sidebar-back"]')){
    const b=document.createElement('button');
    b.type='button';
    b.dataset.vexaStability='sidebar-back';
    b.setAttribute('aria-label','Back');
    b.textContent='←  Back';
    b.style.cssText='display:flex;align-items:center;gap:8px;width:calc(100% - 24px);margin:10px 12px 2px;padding:10px 12px;border:1px solid #e6eaf0;border-radius:11px;background:rgba(255,255,255,.86);color:#344054;font:700 12px Inter,system-ui,sans-serif;cursor:pointer;position:relative;z-index:1001;box-shadow:0 4px 14px rgba(15,23,42,.05);';
    b.onclick=()=>{
      if(side.classList.contains('open')){side.classList.remove('open');return;}
      if(location.hash&&location.hash!=='#/') history.length>1?history.back():location.hash='#/';
    };
    const brand=side.querySelector('.vx-brand');
    if(brand?.nextSibling) side.insertBefore(b,brand.nextSibling); else side.prepend(b);
  }
  if(side&&!side.querySelector('[data-vexa-stability="close"]')){
    const close=document.createElement('button');
    close.type='button';
    close.dataset.vexaStability='close';
    close.textContent='×';
    close.setAttribute('aria-label','Close menu');
    close.style.cssText='display:none;position:absolute;right:10px;top:20px;width:34px;height:34px;border:1px solid #e6eaf0;border-radius:10px;background:rgba(255,255,255,.94);font:700 20px Inter,system-ui,sans-serif;z-index:1002;';
    close.onclick=()=>side.classList.remove('open');
    side.appendChild(close);
  }
  if(!document.getElementById('vexa-account-ui-stability-style')){
    const style=document.createElement('style');
    style.id='vexa-account-ui-stability-style';
    style.textContent=`
      [data-vexa-stability="sidebar-back"]{transition:.16s}
      [data-vexa-stability="sidebar-back"]:hover{transform:translateY(-1px);box-shadow:0 7px 18px rgba(15,23,42,.08)}
      @media(max-width:900px){
        .vx-side.open [data-vexa-stability="close"]{display:grid;place-items:center}
        .vx-side.open .vx-brand{padding-right:54px}
        .vx-side.open{z-index:1000;box-shadow:18px 0 45px rgba(15,23,42,.18)}
        .vx-side.open ~ .vx-main .vx-top-left [data-action="back"]{visibility:hidden;pointer-events:none}
        [data-vexa-stability="sidebar-back"]{display:flex}
      }
    `;
    document.head.appendChild(style);
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
new MutationObserver(install).observe(document.body,{childList:true,subtree:true});
})();
