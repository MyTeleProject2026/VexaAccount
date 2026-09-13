(()=>{
'use strict';
if(window.__VEXA_OWNER_OPERATION_NONBLOCKING_GUARD_V3__)return;
window.__VEXA_OWNER_OPERATION_NONBLOCKING_GUARD_V3__=true;
const ROOT_ID='vexa-owner-live-operation';
const apply=()=>{
 const root=document.getElementById(ROOT_ID); if(!root)return false;
 root.style.setProperty('pointer-events','none','important');
 root.style.setProperty('background','transparent','important');
 root.style.setProperty('display',root.classList.contains('visible')?'block':'none','important');
 const backdrop=root.querySelector(':scope > :before');
 const shell=root.querySelector('.vo-shell'); if(!shell)return false;
 shell.style.setProperty('pointer-events','auto','important');
 shell.style.setProperty('inset','auto 18px 18px auto','important');
 shell.style.setProperty('width','min(680px,calc(100vw - 36px))','important');
 shell.style.setProperty('height','min(430px,calc(100vh - 36px))','important');
 shell.style.setProperty('max-height','calc(100vh - 36px)','important');
 shell.style.setProperty('border-radius','14px','important');
 if(window.matchMedia('(max-width:700px)').matches){
  shell.style.setProperty('inset','auto 8px 8px auto','important');
  shell.style.setProperty('width','min(340px,calc(100vw - 16px))','important');
  shell.style.setProperty('height','min(300px,48vh)','important');
  shell.style.setProperty('max-height','48vh','important');
 }
 return true;
};
let raf=0;
const schedule=()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;apply()})};
let attached=null;
const attach=()=>{
 const root=document.getElementById(ROOT_ID); if(!root||attached===root)return false;
 attached=root;apply();
 new MutationObserver(schedule).observe(root,{subtree:true,childList:true});
 return true;
};
if(!attach()){
 const bootstrap=new MutationObserver(()=>{if(attach())bootstrap.disconnect()});
 bootstrap.observe(document.body||document.documentElement,{childList:true,subtree:true});
}
window.addEventListener('resize',schedule,{passive:true});
window.addEventListener('orientationchange',schedule,{passive:true});
})();
