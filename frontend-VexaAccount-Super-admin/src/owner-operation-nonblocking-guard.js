(()=>{
'use strict';
if(window.__VEXA_OWNER_OPERATION_NONBLOCKING_GUARD__)return;
window.__VEXA_OWNER_OPERATION_NONBLOCKING_GUARD__=true;
const ROOT_ID='vexa-owner-live-operation';
const MOBILE_QUERY='(max-width:700px)';
const set=(el,p,v)=>{if(el.style.getPropertyValue(p)!==v)el.style.setProperty(p,v,'important')};
const apply=()=>{
 const root=document.getElementById(ROOT_ID);
 if(!root)return false;
 set(root,'pointer-events','none');
 const shell=root.querySelector('.vo-shell');
 if(!shell)return false;
 set(shell,'pointer-events','auto');
 if(window.matchMedia(MOBILE_QUERY).matches){
  set(shell,'inset','auto 8px 8px auto');
  set(shell,'width','min(340px, calc(100vw - 16px))');
  set(shell,'height','min(300px, 48vh)');
  set(shell,'max-height','48vh');
  set(shell,'border-radius','14px');
 }else{
  set(shell,'inset','auto 18px 18px auto');
  set(shell,'width','min(680px, calc(100vw - 36px))');
  set(shell,'height','min(430px, calc(100vh - 36px))');
  set(shell,'max-height','calc(100vh - 36px)');
 }
 return true;
};
let raf=0;
const schedule=()=>{
 if(raf)return;
 raf=requestAnimationFrame(()=>{raf=0;apply()});
};
const attach=()=>{
 const root=document.getElementById(ROOT_ID);
 if(!root)return false;
 apply();
 new MutationObserver(schedule).observe(root,{subtree:true,childList:true});
 return true;
};
if(!attach()){
 const bootstrapObserver=new MutationObserver(()=>{
  if(attach())bootstrapObserver.disconnect();
 });
 bootstrapObserver.observe(document.body||document.documentElement,{childList:true,subtree:true});
}
window.addEventListener('resize',schedule,{passive:true});
window.addEventListener('orientationchange',schedule,{passive:true});
})();
