(()=>{
'use strict';
if(window.__VEXA_OWNER_OPERATION_WORKSPACE_UI__)return;
window.__VEXA_OWNER_OPERATION_WORKSPACE_UI__=true;
const ROOT='#vexa-owner-live-operation';
const add=()=>{
 const root=document.querySelector(ROOT),head=root?.querySelector('.vo-actions');
 if(!root||!head||head.querySelector('[data-open-workspace]'))return;
 const b=document.createElement('button');
 b.type='button';b.className='vo-btn';b.dataset.openWorkspace='1';b.textContent='Open workspace';
 b.onclick=()=>{root.classList.add('owner-operation-full');document.documentElement.classList.add('owner-operation-full-open');b.textContent='Floating view'};
 const close=root.querySelector('[data-close]');head.insertBefore(b,close||null);
};
const closeFull=()=>{
 const root=document.querySelector(ROOT);if(!root)return;
 root.classList.remove('owner-operation-full');document.documentElement.classList.remove('owner-operation-full-open');
 const b=root.querySelector('[data-open-workspace]');if(b)b.textContent='Open workspace';
};
new MutationObserver(add).observe(document.documentElement,{childList:true,subtree:true});
window.addEventListener('keydown',e=>{if(e.key==='Escape')closeFull()});
window.addEventListener('resize',add,{passive:true});
add();
})();
