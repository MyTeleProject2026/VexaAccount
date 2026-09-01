(()=>{
'use strict';
if(!window.React||!window.ReactDOM||!window.VexaNotificationCore||!window.VexaToastNotification)return;
const root=document.getElementById('vexa-react-root');
if(!root)return;
root.style.display='block';
root.style.position='fixed';
root.style.inset='0';
root.style.pointerEvents='none';
root.style.zIndex='2000';
function Host(){const C=window.VexaNotificationCore;return window.React.createElement(C.NotificationProvider,null,window.React.createElement(window.VexaToastNotification,null))}
try{window.ReactDOM.createRoot(root).render(window.React.createElement(Host));window.vexaReactNotificationsReady=true}catch(e){window.vexaReactNotificationsReady=false;console.error('VexaAccount notification runtime failed:',e)}
})();