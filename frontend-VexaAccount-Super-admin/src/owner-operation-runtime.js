(()=>{
'use strict';
if(window.__VEXA_OWNER_OPERATION_RUNTIME_V6__)return;
window.__VEXA_OWNER_OPERATION_RUNTIME_V6__=true;
window.__VEXA_OWNER_OPERATION_RUNTIME_V5__=true;
window.__VEXA_OWNER_OPERATION_RUNTIME_V4__=true;
window.__VEXA_OWNER_OPERATION_RUNTIME_V3__=true;

const API=(window.VEXA_ACCOUNT_ADMIN_API_BASE||'https://api-vexaaccount.onrender.com').replace(/\/$/,'');
const POLL_DELAY_MS=900;
const REQUEST_TIMEOUT_MS=4500;
const MAX_EVENTS=100;
const TERMINAL=new Set(['completed','failed','cancelled','stalled']);
const state={panel:null,activeId:null,watchers:new Map(),timer:null,pollTimer:null,pollInFlight:false,minimized:false};

const isTerminal=s=>TERMINAL.has(String(s||'').toLowerCase());
const elapsed=ms=>{let n=Math.max(0,Math.floor(ms/1000)),h=Math.floor(n/3600),m=Math.floor((n%3600)/60),s=n%60;return [h,m,s].map(v=>String(v).padStart(2,'0')).join(':')};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function readToken(v){
 if(!v)return '';
 let x=String(v).trim();
 try{const p=JSON.parse(x);if(typeof p==='string')x=p;else if(p&&typeof p==='object')x=p.token||p.accessToken||p.access_token||'';}catch(_){ }
 return String(x||'').replace(/^Bearer\s+/i,'').trim();
}
function authHeaders(){
 const h={Accept:'application/json','Cache-Control':'no-cache'};
 const values=[];
 try{['adminToken','admin_token','superAdminToken','super_admin_token','accessToken','access_token','token'].forEach(k=>{values.push(localStorage.getItem(k));values.push(sessionStorage.getItem(k));});}catch(_){ }
 values.push(window.VEXA_ACCOUNT_ADMIN_TOKEN,window.VEXA_SUPER_ADMIN_TOKEN,window.vexaAdminToken,window.vexaSuperAdminToken);
 for(const v of values){const t=readToken(v);if(t){h.Authorization='Bearer '+t;break;}}
 return h;
}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

function ensure(){
 if(state.panel)return state.panel;
 const p=document.createElement('div');p.id='vexa-owner-live-operation';
 p.innerHTML=`<style>
#vexa-owner-live-operation{position:fixed;inset:0;z-index:2147483000;display:none;pointer-events:none;color:#dbe7f5;font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif}
#vexa-owner-live-operation.visible{display:block}#vexa-owner-live-operation:before{content:"";position:absolute;inset:0;background:rgba(2,8,18,.60)}
.vo-shell{position:absolute;inset:4vh 3.5vw;display:flex;flex-direction:column;min-height:0;overflow:hidden;background:#06111f;border:1px solid rgba(103,232,249,.2);border-radius:18px;box-shadow:0 28px 90px rgba(0,0,0,.65);pointer-events:auto}
.vo-head{height:68px;flex:0 0 68px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;border-bottom:1px solid rgba(148,163,184,.12);background:#091728}.vo-brand{display:flex;gap:10px;align-items:center;min-width:0}.vo-mark{width:30px;height:30px;display:grid;place-items:center;border:1px solid rgba(103,232,249,.35);border-radius:8px;background:#0a1d31;color:#67e8f9;font:700 10px ui-monospace,monospace}.vo-kicker{font:700 9px ui-monospace,monospace;letter-spacing:.12em;color:#67e8f9}.vo-title{font-size:15px;font-weight:750}.vo-sub{font-size:9px;color:#6f849a;margin-top:2px}.vo-actions{display:flex;gap:7px;align-items:center}.vo-pill{display:flex;align-items:center;gap:6px;padding:6px 9px;border-radius:999px;border:1px solid rgba(74,222,128,.2);color:#86efac;background:#06251f;font:700 9px ui-monospace,monospace}.vo-dot{width:6px;height:6px;border-radius:50%;background:#4ade80;box-shadow:0 0 9px #4ade80}.vo-dot.pulse{animation:vo-p 1.4s infinite}@keyframes vo-p{50%{opacity:.3}}
.vo-btn{padding:7px 10px;border:1px solid rgba(148,163,184,.18);border-radius:8px;background:#0d1d30;color:#cbd5e1;font:600 10px system-ui;cursor:pointer}.vo-btn:hover{background:#142a42}.vo-danger{color:#fecaca;background:#29151c}.vo-body{display:flex;flex:1;min-height:0}.vo-main{display:flex;flex:1;flex-direction:column;min-width:0}.vo-overview{padding:17px 19px 13px;border-bottom:1px solid rgba(148,163,184,.1)}.vo-row{display:flex;justify-content:space-between;gap:15px;align-items:end}.vo-phase{font-size:20px;font-weight:760}.vo-detail{margin-top:4px;color:#8ea3b8;font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vo-percent{font:700 24px ui-monospace,monospace;color:#67e8f9}.vo-track{height:5px;margin-top:13px;border-radius:99px;background:#102033;overflow:hidden}.vo-bar{height:100%;width:0;background:linear-gradient(90deg,#0ea5e9,#22d3ee);box-shadow:0 0 12px rgba(34,211,238,.35);transition:width .25s ease}.vo-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin-top:10px}.vo-stat{padding:8px 9px;border:1px solid rgba(148,163,184,.08);border-radius:8px;background:#0a192a;min-width:0}.vo-label{font:700 8px ui-monospace,monospace;color:#5f748a;letter-spacing:.08em}.vo-value{margin-top:3px;font-size:10px;color:#d8e5f2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mono{font-family:ui-monospace,monospace}.vo-log-head{display:flex;justify-content:space-between;padding:10px 19px 7px;color:#70869d;font:700 8px ui-monospace,monospace;letter-spacing:.1em}.vo-log{flex:1;min-height:0;overflow:auto;padding:0 19px 16px;font:10px/1.5 ui-monospace,monospace}.vo-event{display:grid;grid-template-columns:65px 78px 1fr 35px;gap:8px;padding:4px 0;border-bottom:1px solid rgba(148,163,184,.045)}.vo-time{color:#50667c}.vo-phase-e{color:#67e8f9;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vo-detail-e{color:#b5c6d8;overflow-wrap:anywhere}.vo-prog{text-align:right;color:#60758a}.vo-side{width:270px;padding:14px;border-left:1px solid rgba(148,163,184,.1);background:#050f1b;overflow:auto}.vo-card{padding:11px;margin-bottom:10px;border:1px solid rgba(148,163,184,.09);border-radius:9px;background:#091827}.vo-card-title{font:700 8px ui-monospace,monospace;color:#61778e;letter-spacing:.1em;margin-bottom:8px}.vo-id{font:9px ui-monospace,monospace;color:#91a5b9;word-break:break-all}.vo-check{display:flex;gap:7px;padding:5px 0;color:#91a5b9;font-size:9px;border-bottom:1px solid rgba(148,163,184,.05)}.vo-check i{width:6px;height:6px;margin-top:3px;border-radius:50%;background:#475569}.vo-check.live i{background:#38bdf8;box-shadow:0 0 7px #38bdf8}.vo-check.ok i{background:#4ade80}.vo-check.err i{background:#fb7185}.vo-result{font:9px/1.5 ui-monospace,monospace;color:#91a5b9;white-space:pre-wrap;overflow:auto;max-height:170px}.vo-result.ok{color:#86efac}.vo-result.err{color:#fda4af}.vo-side-actions{display:flex;flex-direction:column;gap:7px;margin-top:14px}
#vexa-owner-live-operation.min .vo-shell{inset:auto 16px 16px auto;width:min(430px,calc(100vw - 32px));height:auto;border-radius:12px}.min .vo-head{height:54px;flex-basis:54px}.min .vo-body{display:none}.min .vo-sub{display:none}.min .vo-title{font-size:12px}.min .vo-pill{display:none}
@media(max-width:700px){.vo-shell{inset:0;border-radius:0}.vo-head{height:60px;flex-basis:60px;padding:0 12px}.vo-sub{display:none}.vo-side{display:none}.vo-overview{padding:13px}.vo-stats{grid-template-columns:1fr 1fr}.vo-log,.vo-log-head{padding-left:13px;padding-right:13px}.vo-event{grid-template-columns:50px 65px 1fr}.vo-prog{display:none}.vo-phase{font-size:17px}.vo-percent{font-size:20px}}
</style><section class="vo-shell" aria-label="Owner OS Live Operations Workspace"><header class="vo-head"><div class="vo-brand"><div class="vo-mark">OS</div><div><div class="vo-kicker">VEXAACCOUNT / OWNER OS</div><div class="vo-title">Live Operations Workspace</div><div class="vo-sub">Real execution · source review · verification · deployment</div></div></div><div class="vo-actions"><div class="vo-pill"><i class="vo-dot pulse"></i><span data-live>LIVE</span></div><button class="vo-btn" data-min>Minimize</button><button class="vo-btn" data-close>Close</button></div></header><div class="vo-body"><main class="vo-main"><section class="vo-overview"><div class="vo-row"><div><div class="vo-phase" data-phase>READY</div><div class="vo-detail" data-detail>Owner OS ready.</div></div><div class="vo-percent" data-percent>0%</div></div><div class="vo-track"><div class="vo-bar" data-bar></div></div><div class="vo-stats"><div class="vo-stat"><div class="vo-label">OPERATION</div><div class="vo-value mono" data-id>—</div></div><div class="vo-stat"><div class="vo-label">STATUS</div><div class="vo-value" data-status>READY</div></div><div class="vo-stat"><div class="vo-label">ELAPSED</div><div class="vo-value mono" data-elapsed>00:00:00</div></div><div class="vo-stat"><div class="vo-label">EVENTS</div><div class="vo-value mono" data-count>0</div></div></div></section><div class="vo-log-head"><span>LIVE EXECUTION LOG</span><span data-log-state>SERVER STATE</span></div><div class="vo-log" data-log></div></main><aside class="vo-side"><div class="vo-card"><div class="vo-card-title">OPERATION CONTEXT</div><div class="vo-id" data-side-id>—</div></div><div class="vo-card"><div class="vo-card-title">SYSTEM CHECKS</div><div class="vo-check" data-check-server><i></i><span>Operation service</span></div><div class="vo-check" data-check-state><i></i><span>Live server state</span></div><div class="vo-check" data-check-worker><i></i><span>Worker heartbeat</span></div><div class="vo-check" data-check-result><i></i><span>Result verification</span></div></div><div class="vo-card"><div class="vo-card-title">CURRENT ACTION</div><div class="vo-result" data-result>Standing by.</div></div><div class="vo-side-actions"><button class="vo-btn vo-danger" data-cancel hidden>Cancel current operation</button><button class="vo-btn" data-min2>Minimize workspace</button></div></aside></div></section>`;
 document.body.appendChild(p);state.panel=p;
 p.querySelector('[data-min]').onclick=toggleMin;p.querySelector('[data-min2]').onclick=toggleMin;p.querySelector('[data-close]').onclick=hide;p.querySelector('[data-cancel]').onclick=cancelActive;
 return p;
}
function show(){const p=ensure();p.classList.add('visible');p.classList.remove('min');state.minimized=false}
function toggleMin(){const p=ensure();state.minimized=!state.minimized;p.classList.toggle('min',state.minimized);p.classList.add('visible')}
function hide(){const p=ensure();p.classList.remove('visible','min');state.minimized=false}
function render(op){
 const p=ensure();
 const status=String(op.status||'running').toLowerCase();
 const events=Array.isArray(op.events)?op.events.slice(-MAX_EVENTS):[];
 const percent=Math.max(0,Math.min(100,Number(op.progress)||0));
 p.querySelector('[data-phase]').textContent=String(op.phase||'RUNNING').replace(/[_-]+/g,' ');
 p.querySelector('[data-detail]').textContent=op.detail||'';
 p.querySelector('[data-percent]').textContent=percent+'%';
 p.querySelector('[data-bar]').style.width=percent+'%';
 p.querySelector('[data-id]').textContent=op.id||'—';
 p.querySelector('[data-side-id]').textContent=op.id||'—';
 p.querySelector('[data-status]').textContent=status.toUpperCase();
 p.querySelector('[data-count]').textContent=String(events.length);
 p.querySelector('[data-live]').textContent=isTerminal(status)?status.toUpperCase():'LIVE';
 p.querySelector('[data-log-state]').textContent=status==='running'?'SERVER STATE · LIVE':'SERVER STATE · '+status.toUpperCase();
 const result=p.querySelector('[data-result]');
 result.textContent=op.error?String(op.error):op.result?JSON.stringify(op.result,null,2):op.detail||'Operation is running.';
 result.className='vo-result '+(status==='completed'?'ok':(status==='failed'||status==='stalled'?'err':''));
 p.querySelector('[data-cancel]').hidden=isTerminal(status);
 p.querySelector('[data-check-server]').className='vo-check ok';
 p.querySelector('[data-check-state]').className='vo-check '+(status==='running'?'live':'ok');
 p.querySelector('[data-check-worker]').className='vo-check '+(op.lastHeartbeatAt?'live':'');
 p.querySelector('[data-check-result]').className='vo-check '+(isTerminal(status)?(status==='completed'?'ok':'err'):'');
 const log=p.querySelector('[data-log]');
 const key=events.map(e=>(e.at||'')+'|'+(e.phase||'')+'|'+(e.detail||'')+'|'+(e.progress??'')).join('\n');
 if(log.dataset.key!==key){
  const wasBottom=log.scrollHeight-log.scrollTop-log.clientHeight<48;
  log.dataset.key=key;
  const frag=document.createDocumentFragment();
  events.forEach(e=>{const row=document.createElement('div');row.className='vo-event';const t=document.createElement('span');t.className='vo-time';t.textContent=e.at?new Date(e.at).toLocaleTimeString([], {hour12:false}):'--:--:--';const ph=document.createElement('span');ph.className='vo-phase-e';ph.textContent=e.phase||'SYSTEM';const d=document.createElement('span');d.className='vo-detail-e';d.textContent=e.detail||'';const pr=document.createElement('span');pr.className='vo-prog';pr.textContent=(Number(e.progress)||0)+'%';row.append(t,ph,d,pr);frag.appendChild(row);});
  log.replaceChildren(frag);
  if(wasBottom||!state.minimized)log.scrollTop=log.scrollHeight;
 }
}
function clock(){const w=state.watchers.get(state.activeId);if(!w||!w.op)return;const end=w.op.completedAt?Date.parse(w.op.completedAt):Date.now();const start=Date.parse(w.op.startedAt||w.op.createdAt||'')||w.startedAt||Date.now();const el=ensure().querySelector('[data-elapsed]');if(el)el.textContent=elapsed(end-start);}
function startClock(){if(state.timer)return;state.timer=setInterval(clock,1000);clock()}
function stopClock(){if(state.timer){clearInterval(state.timer);state.timer=null}}
function authFetch(url,options={}){
 const ctl=new AbortController();const timer=setTimeout(()=>ctl.abort(),REQUEST_TIMEOUT_MS);
 const opts={...options,credentials:'include',cache:'no-store',signal:ctl.signal,headers:{...authHeaders(),...(options.headers||{})}};
 const nativeFetch=window.__VEXA_OWNER_NATIVE_FETCH__;
 const transport=typeof nativeFetch==='function'?nativeFetch:(typeof window.fetch==='function'?window.fetch.bind(window):null);
 if(!transport){clearTimeout(timer);return Promise.reject(new Error('Native browser fetch is unavailable.'));}
 return transport(url,opts).finally(()=>clearTimeout(timer));
}
async function getState(id){
 try{
  const r=await authFetch(`${API}/api/sso-application-analyzer/operations/${encodeURIComponent(id)}`);
  const d=await r.json().catch(()=>({}));
  if(!r.ok||!d.operation){const e=new Error(d.message||`Operation status HTTP ${r.status}`);e.status=r.status;throw e;}
  return d.operation;
 }catch(e){if(e.name==='AbortError'){const x=new Error('Operation status request timed out; retrying without blocking the workspace.');x.code='OWNER_OPERATION_STATUS_TIMEOUT';throw x;}throw e;}
}
function apply(op,onUpdate){
 if(!op)return;
 const id=op.id||state.activeId;state.activeId=id;
 const w=state.watchers.get(id);if(w){w.op=op;}
 show();render(op);clock();if(onUpdate)onUpdate(op);
 if(isTerminal(op.status)){
  if(w)w.terminal=true;
  stopPolling();
  if(op.status==='completed')w?.onComplete?.(op.result,op);
  else w?.onError?.(op.error||{message:op.detail,code:'OWNER_OPERATION_'+String(op.status).toUpperCase()},op);
 }
}
function stopPolling(){if(state.pollTimer){clearTimeout(state.pollTimer);state.pollTimer=null;}state.pollInFlight=false}
function schedulePoll(id){if(state.pollTimer)return;state.pollTimer=setTimeout(()=>{state.pollTimer=null;pollOnce(id).catch(()=>{});},POLL_DELAY_MS)}
async function pollOnce(id){
 const w=state.watchers.get(id);if(!w||w.terminal||state.pollInFlight)return;
 state.pollInFlight=true;
 try{const op=await getState(id);apply(op,w.onUpdate);if(!isTerminal(op.status))schedulePoll(id);}
 catch(e){
  if(w.terminal)return;
  w.failures=(w.failures||0)+1;
  const detail=e.status===401||e.status===403?'Owner session is not authorized for live status; retrying.':(e.message||'Live status temporarily unavailable; retrying.');
  const pseudo={id,status:'running',phase:'RECONNECTING',progress:w.op?.progress||0,detail,events:w.op?.events||[],startedAt:w.op?.startedAt||w.startedAt,lastHeartbeatAt:w.op?.lastHeartbeatAt,result:null,error:null};
  w.op=pseudo;render(pseudo);clock();schedulePoll(id);
 }
 finally{state.pollInFlight=false;}
}
function startPolling(id){stopPolling();schedulePoll(id)}
async function watch(id,opts={}){
 ensure();
 if(!id)return null;
 stopPolling();state.activeId=id;
 const w={id,startedAt:Date.now(),op:null,terminal:false,failures:0,onComplete:opts.onComplete,onError:opts.onError,onUpdate:opts.onUpdate};
 state.watchers.set(id,w);show();startClock();
 try{const op=await getState(id);apply(op,opts.onUpdate);if(!isTerminal(op.status))startPolling(id);}
 catch(e){w.failures=1;render({id,status:'running',phase:'RECONNECTING',progress:0,detail:e.message||'Connecting to operation service…',events:[],startedAt:new Date(w.startedAt).toISOString()});startPolling(id);}
 return w.op;
}
async function cancelActive(){
 const id=state.activeId;if(!id)return;
 const w=state.watchers.get(id);try{
  const r=await authFetch(`${API}/api/sso-application-analyzer/operations/${encodeURIComponent(id)}/cancel`,{method:'POST',headers:{'Content-Type':'application/json'}});
  const d=await r.json().catch(()=>({}));if(!r.ok||!d.operation)throw new Error(d.message||`Cancel HTTP ${r.status}`);apply(d.operation,w?.onUpdate);
 }catch(e){const op=w?.op||{id,status:'running',phase:'CANCEL',progress:0,events:[]};op.detail='Cancel request failed; operation remains running. '+(e.message||'');render(op);}
}
function status(){const w=state.watchers.get(state.activeId);return w?.op||null}
function ensureAndShow(){show();return ensure()}
function begin(phase,detail,total){ensureAndShow();const id='local-'+Date.now();const op={id,status:'running',phase:phase||'RUNNING',progress:0,detail:detail||'Working…',events:[],createdAt:new Date().toISOString(),startedAt:new Date().toISOString(),lastHeartbeatAt:new Date().toISOString()};state.watchers.set(id,{id,op,startedAt:Date.now(),terminal:false,total:total||0});state.activeId=id;render(op);startClock();return id}
function setPhase(phase,detail,total){const w=state.watchers.get(state.activeId);if(!w)return;w.op={...(w.op||{}),phase:phase||w.op.phase,detail:detail||w.op.detail};render(w.op)}
function step(detail,progress){const w=state.watchers.get(state.activeId);if(!w)return;const o=w.op||{};const events=Array.isArray(o.events)?o.events.slice(-MAX_EVENTS):[];events.push({at:new Date().toISOString(),phase:o.phase||'RUNNING',detail:detail||'',progress:Number(progress??o.progress??0),kind:'event'});w.op={...o,events,progress:Number(progress??o.progress??0),detail:detail||o.detail,lastHeartbeatAt:new Date().toISOString()};render(w.op)}
function complete(detail,result){const w=state.watchers.get(state.activeId);if(!w)return;w.op={...(w.op||{}),status:'completed',phase:'COMPLETE',progress:100,detail:detail||'Operation completed successfully',completedAt:new Date().toISOString(),result:result??null};w.terminal=true;render(w.op);stopPolling()}
function fail(detail,error){const w=state.watchers.get(state.activeId);if(!w)return;w.op={...(w.op||{}),status:'failed',phase:'ERROR',detail:detail||'Operation failed',error:error||null,completedAt:new Date().toISOString()};w.terminal=true;render(w.op);stopPolling()}
function minimize(){const p=ensure();state.minimized=true;p.classList.add('min','visible')}
function hide(){const p=ensure();p.classList.remove('visible','min');state.minimized=false}
function cancel(){return cancelActive()}
window.vexaOwnerProcess={ensure:ensureAndShow,begin,setPhase,step,complete,fail,watch,minimize,hide,show,cancel,status};
window.addEventListener('pagehide',stopPolling,{passive:true});
})();