(function(){
  'use strict';
  var root=document.getElementById('vexa-react-root');
  var app=document.getElementById('app');
  if(root){root.style.display='block';root.style.position='fixed';root.style.inset='0';root.style.pointerEvents='none';root.style.zIndex='1000';}
  if(app){app.style.display='block';}
  function loadBridge(){
    if(window.__VEXA_REACT_NOTIFICATION_BRIDGE__) return;
    window.__VEXA_REACT_NOTIFICATION_BRIDGE__=true;
    var s=document.createElement('script');
    s.src='./src/react-account-center.js?v=20260902-19';
    s.defer=false;
    document.body.appendChild(s);
  }
  function boot(){
    if(window.React && window.ReactDOM && window.VexaNotificationCore) loadBridge();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
