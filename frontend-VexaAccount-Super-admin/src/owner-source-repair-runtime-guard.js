(()=>{
'use strict';
if(window.__VEXA_OWNER_SOURCE_REPAIR_RUNTIME_GUARD__)return;
window.__VEXA_OWNER_SOURCE_REPAIR_RUNTIME_GUARD__=true;
const timers=new Set();
const nativeSetInterval=window.setInterval.bind(window);
const nativeClearInterval=window.clearInterval.bind(window);
let trackedOpen=false;
window.setInterval=(fn,ms,...args)=>{
 const text=typeof fn==='function'?Function.prototype.toString.call(fn):String(fn);
 const id=nativeSetInterval(fn,ms,...args);
 if(ms===1000&&/\belapsed\b/.test(text))timers.add(id);
 return id;
};
window.clearInterval=(id)=>{timers.delete(id);return nativeClearInterval(id)};
const stop=()=>{if(!trackedOpen)return;for(const id of [...timers])nativeClearInterval(id);timers.clear()};
const watch=()=>{
 const root=document.getElementById('owner-source-repair-overlay');if(!root)return false;
 const sync=()=>{const open=root.classList.contains('open');if(open)trackedOpen=true;else stop()};
 sync();new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['class']});return true;
};
if(!watch())new MutationObserver((_,obs)=>{if(watch())obs.disconnect()}).observe(document.body||document.documentElement,{childList:true,subtree:true});
window.addEventListener('pagehide',stop,{passive:true});
})();
