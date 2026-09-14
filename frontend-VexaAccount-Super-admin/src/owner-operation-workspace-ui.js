(()=>{
'use strict';
if(window.__VEXA_OWNER_OPERATION_WORKSPACE_UI_V3__)return;
window.__VEXA_OWNER_OPERATION_WORKSPACE_UI_V3__=true;
const ROOT='#vexa-owner-live-operation';
const add=()=>{const root=document.querySelector(ROOT),head=root?.querySelector('.vo-actions');if(!root||!head||head.querySelector('[data-open-workspace]'))return !!root;const b=document.createElement('button');b.type='button';b.className='vo-btn';b.dataset.openWorkspace='1';b.textContent='Open workspace';b.onclick=()=>{delete root.dataset.closedOperation;delete root.dataset.startupSuppressed;if(typeof window.vexaOwnerOperationOpenWorkspace==='function')window.vexaOwnerOperationOpenWorkspace();else root.classList.add('visible');root.classList.add('owner-operation-full');document.documentElement.classList.add('owner-operation-full-open');b.textContent='Floating view'};const close=root.querySelector('[data-close]');head.insertBefore(b,close||null);return true};
const closeFull=()=>{const root=document.querySelector(ROOT);if(!root)return;root.classList.remove('owner-operation-full');document.documentElement.classList.remove('owner-operation-full-open');const b=root.querySelector('[data-open-workspace]');if(b)b.textContent='Open workspace'};
let attempts=0;const timer=setInterval(()=>{if(add()||++attempts>=60)clearInterval(timer)},250);
window.addEventListener('keydown',e=>{if(e.key==='Escape')closeFull()},{passive:true});window.addEventListener('resize',add,{passive:true});
})();
