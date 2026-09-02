(()=>{'use strict';
if(window.__VEXA_NOTIFY_BRIDGE_V3__)return;
window.__VEXA_NOTIFY_BRIDGE_V3__=true;
const call=(method,message,type,duration)=>{
  const api=window.vexaReactNotify;
  if(api&&typeof api[method]==='function')return api[method](message,duration);
  if(api&&typeof api.showToast==='function')return api.showToast(message,type,duration);
  return null;
};
window.vexaNotify=(message,type='info',duration)=>{
  const map={success:'showSuccess',error:'showError',warning:'showWarning',info:'showInfo'};
  return call(map[type]||'showInfo',message,type,duration);
};
})();