(()=>{
'use strict';
if(!window.React||!window.ReactDOM||!window.VexaNotificationCore||!window.VexaToastNotification||window.__VEXA_NOTIFICATION_RUNTIME_V2__)return;
window.__VEXA_NOTIFICATION_RUNTIME_V2__=true;
let root=document.getElementById('vexa-notification-root');
if(!root){root=document.createElement('div');root.id='vexa-notification-root';document.body.appendChild(root)}
root.style.position='fixed';
root.style.inset='0';
root.style.pointerEvents='none';
root.style.zIndex='2000';
function Host(){const C=window.VexaNotificationCore;return window.React.createElement(C.NotificationProvider,null,window.React.createElement(window.VexaToastNotification,null))}
try{window.ReactDOM.createRoot(root).render(window.React.createElement(Host));window.vexaReactNotificationsReady=true}catch(e){window.vexaReactNotificationsReady=false;console.error('VexaAccount notification runtime failed:',e)}
})();
