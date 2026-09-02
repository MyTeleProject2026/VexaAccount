(()=>{
'use strict';
if(window.__VEXA_ACCOUNT_CENTER_UI_STABILITY__)return;
window.__VEXA_ACCOUNT_CENTER_UI_STABILITY__=true;
function install(){
  const side=document.querySelector('.vx-side');
  const topLeft=document.querySelector('.vx-top-left');
  if(side&&topLeft&&!topLeft.querySelector('[data-vexa-stability="back"]')){
    const b=document.createElement('button');
    b.type='button';b.dataset.vexaStability='back';b.setAttribute('aria-label','Back');b.textContent='←';
    b.className='vx-icon';
    b.style.cssText='display:grid;place-items:center;font-weight:800;flex:none;';
    b.onclick=()=>{
      if(side.classList.contains('open')){side.classList.remove('open');return;}
      if(location.hash&&location.hash!=='#/')history.length>1?history.back():location.hash='#/';
    };
    topLeft.insertBefore(b,topLeft.firstChild);
  }
  if(side&&!side.querySelector('[data-vexa-stability="close"]')){
    const close=document.createElement('button');
    close.type='button';close.dataset.vexaStability='close';close.textContent='×';close.setAttribute('aria-label','Close menu');
    close.style.cssText='display:none;position:absolute;right:10px;top:20px;width:34px;height:34px;border:1px solid #e6eaf0;border-radius:10px;background:rgba(255,255,255,.92);font:700 20px Inter,system-ui,sans-serif;z-index:1000;';
    close.onclick=()=>side.classList.remove('open');side.appendChild(close);
    const style=document.createElement('style');style.textContent='@media(max-width:900px){.vx-side.open [data-vexa-stability="close"]{display:grid;place-items:center}.vx-side.open .vx-brand{padding-right:54px}.vx-top-left [data-vexa-stability="back"]{display:grid}}';document.head.appendChild(style);
  }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
new MutationObserver(install).observe(document.body,{childList:true,subtree:true});
})();
