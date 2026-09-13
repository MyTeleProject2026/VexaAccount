(()=>{
'use strict';
if(window.__VEXA_OWNER_OPERATION_TERMINAL_GUARD__)return;
window.__VEXA_OWNER_OPERATION_TERMINAL_GUARD__=true;
const TERMINAL=new Set(['completed','failed','cancelled','stalled']);
let handledId='';
let hideTimer=null;
let pollTimer=null;
let stopped=false;
function releaseIfTerminal(){
 if(stopped)return true;
 const panel=document.getElementById('vexa-owner-live-operation');
 if(!panel)return false;
 const status=String(panel.querySelector('[data-status]')?.textContent||'').trim().toLowerCase();
 const id=String(panel.querySelector('[data-id]')?.textContent||'').trim();
 if(!id||id==='—'||!TERMINAL.has(status)||handledId===id)return false;
 handledId=id;
 panel.classList.add('min');
 panel.style.pointerEvents='none';
 const shell=panel.querySelector('.vo-shell');
 if(shell)shell.style.pointerEvents='auto';
 if(hideTimer)clearTimeout(hideTimer);
 hideTimer=setTimeout(()=>{
   const current=document.getElementById('vexa-owner-live-operation');
   if(current===panel && TERMINAL.has(String(panel.querySelector('[data-status]')?.textContent||'').trim().toLowerCase())){
     panel.classList.remove('visible','min');
     panel.style.pointerEvents='none';
     if(window.vexaOwnerProcess?.hide)try{window.vexaOwnerProcess.hide();}catch(_){ }
   }
   if(pollTimer)clearTimeout(pollTimer);
   pollTimer=null;
   stopped=true;
 },2000);
 return true;
}
function tick(){
 if(releaseIfTerminal())return;
 pollTimer=setTimeout(tick,1000);
}
function start(){
 if(document.body)tick();
 else document.addEventListener('DOMContentLoaded',tick,{once:true});
}
start();
window.addEventListener('pagehide',()=>{
 stopped=true;
 if(hideTimer)clearTimeout(hideTimer);
 if(pollTimer)clearTimeout(pollTimer);
},{passive:true});
})();
