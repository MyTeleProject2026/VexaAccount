(()=>{
'use strict';
if(window.__VEXA_OWNER_OPERATION_RUNTIME_V3__||window.__VEXA_OWNER_PROCESS_CONSOLE__)return;
window.__VEXA_OWNER_PROCESS_CONSOLE__=true;
const API=()=>String(window.VEXA_ACCOUNT_ADMIN_API_BASE||'https://api-vexaaccount.onrender.com').replace(/\/$/,'');
const TERMINAL=new Set(['completed','failed','cancelled','stalled']);
const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const $=s=>document.querySelector(s);
let state={active:false,phase:'READY',detail:'Standing by',startedAt:0,phaseStartedAt:0,progress:0,completed:0,total:0,events:[],operationId:null,operationStatus:null,canCancel:false,result:null,error:null,lastServerUpdate:0};
let timer=null,pollTimer=null,stream=null,pollInFlight=false;
function ensure(){
  if($('#vexa-process-console'))return;
  document.body.insertAdjacentHTML('beforeend','<div id="vexa-process-console" class="vexa-process-console" aria-live="polite"><div class="vpc-shell"><div class="vpc-scanline"></div><header><div><span class="vpc-kicker">OWNER OS // LIVE EXECUTION</span><h1>Secure Integration Processing Workspace</h1><p class="vpc-subtitle">Real server-side repository processing · live operation state · Owner-controlled actions</p></div><div class="vpc-head-actions"><span class="vpc-status" data-vpc-status>READY</span><button type="button" class="vpc-min" data-vpc-min>Minimize</button><button type="button" class="vpc-close" data-vpc-close>×</button></div></header><div class="vpc-progress"><i data-vpc-progress></i></div><div class="vpc-metrics"><div><small>OPERATION</small><b data-vpc-operation>—</b></div><div><small>PHASE</small><b data-vpc-phase>READY</b></div><div><small>ELAPSED</small><b data-vpc-elapsed>00:00.0</b></div><div><small>PROGRESS</small><b data-vpc-percent>0%</b></div></div><div class="vpc-main"><section class="vpc-terminal"><div class="vpc-terminal-head"><span>LIVE SERVER EVENTS</span><span data-vpc-event-count>0 events</span></div><div class="vpc-terminal-log" data-vpc-terminal></div></section><aside class="vpc-side"><div class="vpc-current"><span class="vpc-dot"></span><div><b data-vpc-detail>Standing by</b><small data-vpc-subdetail>Waiting for an Owner operation</small></div></div><div class="vpc-actions" data-vpc-actions><button type="button" data-vpc-cancel class="vpc-danger" hidden>Cancel operation</button><button type="button" data-vpc-return>Return to Owner OS</button></div><div class="vpc-result" data-vpc-result></div></aside></div></div></div>');
  $('#vexa-process-console [data-vpc-close]').onclick=()=>hide();
  $('#vexa-process-console [data-vpc-min]').onclick=()=>minimize();
  $('#vexa-process-console [data-vpc-return]').onclick=()=>minimize();
  $('#vexa-process-console [data-vpc-cancel]').onclick=()=>cancel();
}
function fmt(ms){const s=Math.max(0,ms)/1000,m=Math.floor(s/60),sec=s-m*60;return String(m).padStart(2,'0')+':'+sec.toFixed(1).padStart(4,'0');}
function serverStart(o){const value=Date.parse(o?.startedAt||o?.createdAt||'');return Number.isFinite(value)&&value>0?value:Date.now();}
function render(){
  const root=$('#vexa-process-console');if(!root)return;
  root.classList.toggle('is-active',state.active);
  root.classList.toggle('is-minimized',!state.active&&Boolean(state.operationId));
  root.classList.toggle('is-error',state.phase==='ERROR'||state.phase==='STALLED'||state.operationStatus==='STALLED');
  root.classList.toggle('is-done',state.phase==='COMPLETE');
  root.querySelector('[data-vpc-status]').textContent=state.operationStatus||state.phase;
  root.querySelector('[data-vpc-operation]').textContent=state.operationId?String(state.operationId).slice(0,12):'LOCAL';
  root.querySelector('[data-vpc-phase]').textContent=state.phase;
  root.querySelector('[data-vpc-elapsed]').textContent=state.startedAt?fmt(Date.now()-state.startedAt):'00:00.0';
  root.querySelector('[data-vpc-percent]').textContent=`${Math.round(Math.max(0,Math.min(100,state.progress||0)))}%`;
  root.querySelector('[data-vpc-progress]').style.width=`${Math.min(100,Math.max(0,state.progress||0))}%`;
  root.querySelector('[data-vpc-detail]').textContent=state.detail;
  const age=state.lastServerUpdate?Math.max(0,Math.round((Date.now()-state.lastServerUpdate)/1000)):null;
  root.querySelector('[data-vpc-subdetail]').textContent=state.operationId?(age!==null?`Server stream live · last update ${age}s ago`:'Connecting to server operation stream…'):'Owner operation in progress';
  root.querySelector('[data-vpc-event-count]').textContent=`${state.events.length} events`;
  root.querySelector('[data-vpc-cancel]').hidden=!state.canCancel;
  const t=root.querySelector('[data-vpc-terminal]');
  t.innerHTML=state.events.slice(-120).map(e=>`<div class="vpc-event"><time>${esc(e.at?new Date(e.at).toLocaleTimeString([], {hour12:false}):e.time||'')}</time><span class="vpc-prompt">›</span><b>${esc(e.phase)}</b><em>${esc(e.detail)}</em><small>${Number.isFinite(Number(e.progress))?Math.round(e.progress)+'%':''}</small></div>`).join('');
  t.scrollTop=t.scrollHeight;
  const result=root.querySelector('[data-vpc-result]');
  if(state.result){result.innerHTML=`<b>Operation result ready</b><pre>${esc(JSON.stringify(state.result,null,2))}</pre>`;}
  else if(state.error){result.innerHTML=`<b>Operation error</b><pre>${esc(JSON.stringify(state.error,null,2))}</pre>`;}
  else result.innerHTML='';
}
function startTimer(){if(timer)clearInterval(timer);timer=setInterval(render,250);render();}
function stopTimer(){if(timer){clearInterval(timer);timer=null;}render();}
function resetLocal(phase,detail){
  state={active:true,phase:String(phase||'RUNNING'),detail:String(detail||'Working…'),startedAt:Date.now(),phaseStartedAt:Date.now(),progress:0,completed:0,total:0,events:[],operationId:null,operationStatus:'RUNNING',canCancel:false,result:null,error:null,lastServerUpdate:0};
  push(state.phase,state.detail,0);
}
function begin(phase,detail,total=0){ensure();closeStream();if(pollTimer){clearInterval(pollTimer);pollTimer=null;}resetLocal(phase,detail);state.total=Number(total)||0;startTimer();}
function push(phase,detail,progress){state.events.push({at:new Date().toISOString(),phase:String(phase||state.phase),detail:String(detail||''),progress:Number(progress??state.progress??0)});state.phase=String(phase||state.phase);state.detail=String(detail||state.detail);state.progress=Number(progress??state.progress??0);state.phaseStartedAt=Date.now();render();}
function setPhase(phase,detail,total){if(!state.active)begin(phase,detail,total);else{if(Number(total)>0)state.total=Number(total);push(phase,detail,state.progress);}}
function step(detail,progress){if(!state.active)return;state.completed+=1;const p=Number.isFinite(Number(progress))?Number(progress):(state.total?Math.min(99,state.completed/state.total*100):state.progress);push(state.phase,detail,p);}
function complete(detail,result){state.active=true;state.phase='COMPLETE';state.operationStatus='COMPLETE';state.progress=100;state.detail=String(detail||'Operation completed successfully');state.result=result??null;state.canCancel=false;push('COMPLETE',state.detail,100);render();stopTimer();}
function fail(detail,error){state.active=true;state.phase=String(error?.code||'ERROR')==='OWNER_OPERATION_STALLED'?'STALLED':'ERROR';state.operationStatus=state.phase;state.detail=String(detail||'Operation failed');state.error=error||null;state.canCancel=false;push(state.phase,state.detail,state.progress);render();stopTimer();}
function minimize(){const root=$('#vexa-process-console');if(!root)return;root.classList.remove('is-active');state.active=false;startTimer();}
function hide(){const root=$('#vexa-process-console');if(!root)return;root.classList.remove('is-active','is-minimized');closeStream();if(pollTimer){clearInterval(pollTimer);pollTimer=null;}state.active=false;state.operationId=null;state.canCancel=false;stopTimer();}
async function cancel(){if(!state.operationId)return;try{const r=await fetch(`${API()}/api/sso-application-analyzer/operations/${encodeURIComponent(state.operationId)}/cancel`,{method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json'}});const d=await r.json().catch(()=>({}));if(!r.ok||!d.operation)throw Error(d.message||`Cancel failed (${r.status})`);applyOperation(d.operation);state.active=true;render();}catch(e){push('CANCEL ERROR',e.message||'Cancellation request failed',state.progress);}}
function closeStream(){if(stream){try{stream.close();}catch(_){}stream=null;}}
function applyOperation(o){
  if(!o)return;
  state.operationId=o.id||state.operationId;
  state.operationStatus=String(o.status||'running').toUpperCase();
  state.phase=o.phase||state.phase;
  state.detail=o.detail||state.detail;
  state.progress=Number.isFinite(Number(o.progress))?Number(o.progress):state.progress;
  state.events=Array.isArray(o.events)?o.events:state.events;
  state.startedAt=serverStart(o);
  state.lastServerUpdate=Date.now();
  state.result=o.result??null;
  state.error=o.error??null;
  state.canCancel=!TERMINAL.has(String(o.status||'').toLowerCase());
  state.active=true;
  render();
}
function finishOperation(o,onComplete,onError){
  const status=String(o.status||'').toLowerCase();
  if(status==='completed'){complete(o.detail||'Operation completed successfully',o.result);if(onComplete)onComplete(o.result,o);}
  else if(status==='failed'){fail(o.detail||'Operation failed',o.error);if(onError)onError(o.error,o);}
  else if(status==='stalled'){fail(o.detail||'Server operation stalled',o.error||{message:o.detail,code:'OWNER_OPERATION_STALLED'});if(onError)onError(o.error,o);}
  else if(status==='cancelled'){fail(o.detail||'Operation cancelled',{message:o.detail,code:'OWNER_OPERATION_CANCELLED'});if(onError)onError({message:o.detail,code:'OWNER_OPERATION_CANCELLED'},o);}
}
function handleStreamPayload(raw,onComplete,onError){
  try{const payload=JSON.parse(raw);const o=payload.operation||payload;if(!o)return;applyOperation(o);if(TERMINAL.has(String(o.status||'').toLowerCase())){closeStream();if(pollTimer){clearInterval(pollTimer);pollTimer=null;}finishOperation(o,onComplete,onError);}}catch(e){push('STREAM PARSE ERROR',e.message||'Invalid server event',state.progress);}}
function startPolling(operationId,onComplete,onError){
  if(pollTimer)clearInterval(pollTimer);
  const poll=async()=>{
    if(pollInFlight)return;
    pollInFlight=true;
    try{const r=await fetch(`${API()}/api/sso-application-analyzer/operations/${encodeURIComponent(operationId)}`,{credentials:'include',cache:'no-store',headers:{Accept:'application/json','Cache-Control':'no-cache'}});const d=await r.json().catch(()=>({}));if(!r.ok||!d.operation)throw Error(d.message||`Operation status failed (${r.status})`);applyOperation(d.operation);if(TERMINAL.has(String(d.operation.status||'').toLowerCase())){clearInterval(pollTimer);pollTimer=null;finishOperation(d.operation,onComplete,onError);}}
    catch(e){state.operationStatus='CONNECTION RETRY';state.detail=e.message||'Unable to read operation status';push('STATUS RETRY',state.detail,state.progress);}
    finally{pollInFlight=false;}
  };
  poll();
  pollTimer=setInterval(poll,1500);
}
function startStream(operationId,onComplete,onError){
  closeStream();
  if(typeof EventSource==='undefined'){startPolling(operationId,onComplete,onError);return;}
  const url=`${API()}/api/sso-application-analyzer/operations/${encodeURIComponent(operationId)}/stream`;
  try{stream=new EventSource(url,{withCredentials:true});
    stream.onmessage=e=>handleStreamPayload(e.data,onComplete,onError);
    stream.addEventListener('state',e=>handleStreamPayload(e.data,onComplete,onError));
    stream.addEventListener('event',e=>handleStreamPayload(e.data,onComplete,onError));
    stream.addEventListener('heartbeat',e=>handleStreamPayload(e.data,onComplete,onError));
    stream.onerror=()=>{if(stream){try{stream.close();}catch(_){}stream=null;}if(!pollTimer){push('STREAM FALLBACK','Live stream interrupted; switching to resilient status polling.',state.progress);startPolling(operationId,onComplete,onError);}};
  }catch(_){startPolling(operationId,onComplete,onError);}
}
async function watch(operationId,{onComplete,onError,onUpdate}={}){
  ensure();
  if(pollTimer){clearInterval(pollTimer);pollTimer=null;}
  closeStream();
  state.operationId=operationId;state.active=true;state.operationStatus='CONNECTING';state.canCancel=true;startTimer();render();
  const api=`${API()}/api/sso-application-analyzer/operations/${encodeURIComponent(operationId)}`;
  try{const r=await fetch(api,{credentials:'include',cache:'no-store',headers:{Accept:'application/json','Cache-Control':'no-cache'}});const d=await r.json().catch(()=>({}));if(!r.ok||!d.operation)throw Error(d.message||`Operation status failed (${r.status})`);applyOperation(d.operation);if(onUpdate)onUpdate(d.operation);if(TERMINAL.has(String(d.operation.status||'').toLowerCase())){finishOperation(d.operation,onComplete,onError);return;}startStream(operationId,onComplete,onError);}
  catch(e){push('STATUS RETRY',e.message||'Unable to read operation status',state.progress);startPolling(operationId,onComplete,onError);}
}
function classify(url){const u=String(url||'');if(/sso-application-analyzer\/analyze$/.test(u))return['ANALYSING','Repository analysis request'];if(/sso-application-analyzer\/plan$/.test(u))return['SOURCE REVIEW','Precise source review request'];if(/sso-application-kit\/generate-target-replacements$/.test(u))return['TARGET REVIEW','Target replacement request'];if(/sso-application-kit\/generate$/.test(u))return['GENERATING','Integration generation request'];return null;}
const nativeFetch=window.fetch.bind(window);
window.fetch=async function(input,init){const url=typeof input==='string'?input:input?.url||'';const phase=classify(url);if(!phase)return nativeFetch(input,init);begin(phase[0],phase[1]);try{const response=await nativeFetch(input,init);if(!response.ok){fail('HTTP '+response.status+' · request rejected');return response;}step(`${phase[0]} request completed · HTTP ${response.status}`,100);complete(`${phase[0]} completed successfully`);return response;}catch(e){fail(`${phase[0]} failed · ${e?.message||'network error'}`);throw e;}};
window.vexaOwnerProcess={ensure,begin,setPhase,step,complete,fail,watch,minimize,hide};
})();
