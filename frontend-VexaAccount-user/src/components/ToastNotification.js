(function(global,React){
  'use strict';
  function ToastNotification(){
    const core=global.VexaNotificationCore;if(!core||!React)return null;
    const {toasts,removeToast}=core.useNotification();
    const icon={success:'✓',error:'!',warning:'⚠',info:'i'};
    return React.createElement('div',{className:'vexa-react-toast-stack','aria-live':'polite','aria-atomic':'true'},toasts.map(t=>React.createElement('div',{key:t.id,className:'vexa-react-toast vexa-toast-'+t.type,role:t.type==='error'?'alert':'status'},React.createElement('div',{className:'vexa-react-toast-icon'},icon[t.type]||'i'),React.createElement('div',{className:'vexa-react-toast-message'},t.message),React.createElement('button',{className:'vexa-react-toast-close',onClick:()=>removeToast(t.id),'aria-label':'Close notification'},'×'))));
  }
  global.VexaToastNotification=ToastNotification;
})(window,window.React);
