(()=>{
'use strict';
if(window.__VEXA_ACCOUNT_TOAST_GUARD_V1__)return;
window.__VEXA_ACCOUNT_TOAST_GUARD_V1__=true;
const MAX=4, DEDUPE_MS=1800, TTL=3600;
const recent=new Map();
let stack=null;
function getStack(){
  if(stack&&stack.isConnected)return stack;
  stack=document.getElementById('vx-toast-stack');
  if(!stack){stack=document.createElement('div');stack.id='vx-toast-stack';stack.className='vx-toast-stack';document.body.appendChild(stack)}
  return stack;
}
function show(message,type='info',duration=3200){
  const text=String(message??'').trim();if(!text)return null;
  const key=`${type}:${text}`,now=Date.now(),last=recent.get(key)||0;
  if(now-last<DEDUPE_MS)return null;
  recent.set(key,now);
  for(const [k,t] of recent)if(now-t>TTL)recent.delete(k);
  const host=getStack();
  const node=document.createElement('div');
  node.className=`vx-toast ${type}`;
  node.textContent=text;
  host.appendChild(node);
  while(host.children.length>MAX)host.firstElementChild?.remove();
  const timer=setTimeout(()=>{node.remove()},Math.max(500,duration));
  node.dataset.vexaToastTimer=String(timer);
  return node;
}
window.vexaReactNotify={
  showToast:(m,t='info',d=4000)=>show(m,t,d),
  showSuccess:(m,d=4000)=>show(m,'success',d),
  showError:(m,d=5000)=>show(m,'error',d),
  showWarning:(m,d=4000)=>show(m,'warning',d),
  showInfo:(m,d=3000)=>show(m,'info',d)
};
})();
