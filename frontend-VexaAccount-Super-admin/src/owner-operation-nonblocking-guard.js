(()=>{
'use strict';
if(window.__VEXA_OWNER_OPERATION_NONBLOCKING_GUARD__)return;
window.__VEXA_OWNER_OPERATION_NONBLOCKING_GUARD__=true;
const ROOT_ID='vexa-owner-live-operation';
const MOBILE_QUERY='(max-width:700px)';
const apply=()=>{
  const root=document.getElementById(ROOT_ID);
  if(!root)return;
  root.style.setProperty('pointer-events','none','important');
  const shell=root.querySelector('.vo-shell');
  if(shell){
    shell.style.setProperty('pointer-events','auto','important');
    if(window.matchMedia(MOBILE_QUERY).matches){
      shell.style.setProperty('inset','auto 8px 8px auto','important');
      shell.style.setProperty('width','min(340px, calc(100vw - 16px))','important');
      shell.style.setProperty('height','min(300px, 48vh)','important');
      shell.style.setProperty('max-height','48vh','important');
      shell.style.setProperty('border-radius','14px','important');
    }else{
      shell.style.setProperty('inset','auto 18px 18px auto','important');
      shell.style.setProperty('width','min(680px, calc(100vw - 36px))','important');
      shell.style.setProperty('height','min(430px, calc(100vh - 36px))','important');
      shell.style.setProperty('max-height','calc(100vh - 36px)','important');
    }
  }
};
let raf=0;
const schedule=()=>{
  if(raf)return;
  raf=window.requestAnimationFrame(()=>{raf=0;apply()});
};
new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','style']});
window.addEventListener('resize',schedule,{passive:true});
window.addEventListener('orientationchange',schedule,{passive:true});
apply();
})();
