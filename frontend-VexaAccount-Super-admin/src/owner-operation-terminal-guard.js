(()=>{
'use strict';
if(window.__VEXA_OWNER_OPERATION_TERMINAL_GUARD__)return;
window.__VEXA_OWNER_OPERATION_TERMINAL_GUARD__=true;
const TERMINAL=new Set(['completed','failed','cancelled','stalled']);
let handledId='';
let hideTimer=null;
function releaseIfTerminal(){
 const panel=document.getElementById('vexa-owner-live-operation');
 if(!panel)return;
 const status=String(panel.querySelector('[data-status]')?.textContent||'').trim().toLowerCase();
 const id=String(panel.querySelector('[data-id]')?.textContent||'').trim();
 if(!id||id==='—'||!TERMINAL.has(status)||handledId===id)return;
 handledId=id;
 panel.classList.add('min');
 panel.style.pointerEvents='none';
 const shell=panel.querySelector('.vo-shell');
 if(shell)shell.style.pointerEvents='auto';
 if(hideTimer)clearTimeout(hideTimer);
 hideTimer=setTimeout(()=>{
   if(document.getElementById('vexa-owner-live-operation')===panel && TERMINAL.has(String(panel.querySelector('[data-status]')?.textContent||'').trim().toLowerCase())){
     panel.classList.remove('visible','min');
     panel.style.pointerEvents='none';
     if(window.vexaOwnerProcess?.hide)try{window.vexaOwnerProcess.hide();}catch(_){ }
   }
 },8000);
}
const observer=new MutationObserver(releaseIfTerminal);
function start(){
 observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']});
 releaseIfTerminal();
}
if(document.body)start();else document.addEventListener('DOMContentLoaded',start,{once:true});
window.addEventListener('pagehide',()=>{if(hideTimer)clearTimeout(hideTimer);},{passive:true});
})();
