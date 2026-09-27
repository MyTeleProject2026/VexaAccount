(()=>{'use strict';
if(window.__VEXA_NOTIFICATION_LIVE_V2__)return;window.__VEXA_NOTIFICATION_LIVE_V2__=true;
const API=(window.VEXA_ACCOUNT_API_BASE||'https://api-vexaaccount.onrender.com').replace(/\/$/,'');
let timer=null,running=false,last=-1,authenticated=false;
const token=()=>{try{const t=window.vexaAccountAuth?.getToken?.();if(t)return t}catch{}return null};
const authRoute=()=>/^#\/(login|signin|register|forgot-password|verify-email|reset-password|login-2fa)(?:[/?]|$)/i.test(location.hash||'');
const api=async()=>{const h={'Accept':'application/json'},t=token();if(t)h.Authorization='Bearer '+t;const r=await fetch(API+'/api/account/notifications',{credentials:'include',headers:h,cache:'no-store'});const d=await r.json().catch(()=>({success:false,message:'Invalid notification response'}));if(r.status===401){/* Notification authorization can be temporarily unavailable without invalidating the main login session. */authenticated=false;stop();return null}if(!r.ok||d.success===false)throw Error(d.message||'Notification request failed ('+r.status+')');return d};
async function poll(){if(running||document.visibilityState==='hidden'||authRoute()||!authenticated)return;running=true;try{const d=await api();if(!d)return;const rows=Array.isArray(d.notifications)?d.notifications:[],unread=rows.filter(n=>!n.is_read);if(last>=0&&unread.length>last){const n=unread[0];if(window.vexaNotify)window.vexaNotify(n.title+': '+n.message,'info');else if(window.vexaReactNotify?.showInfo)window.vexaReactNotify.showInfo(n.title+': '+n.message)}last=unread.length;window.dispatchEvent(new CustomEvent('vexa:notifications-updated',{detail:{notifications:rows,unreadCount:unread.length}}))}catch(error){console.debug('[VexaAccount] notification poll skipped',error?.message||error)}finally{running=false}}
function stop(){if(timer){clearInterval(timer);timer=null}}
function start(){if(authRoute()||!token()){authenticated=false;stop();return}authenticated=true;if(!timer){poll();timer=setInterval(poll,15000)}}
window.addEventListener('vexa-auth-ready',()=>{authenticated=true;last=-1;start()});
window.addEventListener('vexa:auth-changed',()=>{authenticated=true;last=-1;start()});
window.addEventListener('vexa-auth-expired',()=>{authenticated=false;stop();last=-1});
window.addEventListener('vexa-auth-cleared',()=>{authenticated=false;stop();last=-1});
window.addEventListener('hashchange',()=>{if(authRoute()){stop();authenticated=false}else if(token())start()});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')start()});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();