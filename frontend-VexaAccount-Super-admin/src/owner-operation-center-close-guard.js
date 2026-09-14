(()=>{
'use strict';
if(window.__VEXA_OWNER_OPERATION_CENTER_CLOSE_GUARD_V1__)return;
window.__VEXA_OWNER_OPERATION_CENTER_CLOSE_GUARD_V1__=true;
const hide=()=>{
 const root=document.querySelector('#vexa-owner-operation-center');
 if(root){root.classList.remove('visible');root.setAttribute('aria-hidden','true');}
 document.documentElement.classList.remove('voc-open');
};
const close=event=>{
 const target=event?.target;
 if(!target?.closest)return;
 if(target.closest('#vexa-owner-operation-center [data-close]')){
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();hide();
 }
};
document.addEventListener('click',close,true);
document.addEventListener('pointerup',close,true);
window.addEventListener('vexa-owner-operation-close',hide);
window.vexaOwnerOperationClose=hide;
window.addEventListener('load',()=>setTimeout(()=>{
 const root=document.querySelector('#vexa-owner-operation-center');
 if(root&&!root.classList.contains('visible'))hide();
},0),{once:true});
})();
