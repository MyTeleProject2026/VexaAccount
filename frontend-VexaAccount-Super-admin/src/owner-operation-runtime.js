(()=>{
  'use strict';
  if(window.__VEXA_OWNER_OPERATION_RUNTIME_V3__)return;
  window.__VEXA_OWNER_OPERATION_RUNTIME_V3__=true;

  const API=(window.VEXA_ACCOUNT_ADMIN_API_BASE||'https://api-vexaaccount.onrender.com').replace(/\/$/,'');
  const POLL_MS=1000;
  const MAX_VISIBLE_EVENTS=80;
  const TERMINAL=new Set(['completed','failed','cancelled','stalled']);
  const state={watchers:new Map(),panel:null,activeId:null,expanded:true,minimized:false,lastRenderedEventsKey:'',timer:null};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const terminal=s=>TERMINAL.has(String(s||'').toLowerCase());
  const formatElapsed=ms=>{const sec=Math.max(0,Math.floor(ms/1000));const h=String(Math.floor(sec/3600)).padStart(2,'0');const m=String(Math.floor((sec%3600)/60)).padStart(2,'0');const s=String(sec%60).padStart(2,'0');return `${h}:${m}:${s}`};
  const statusClass=s=>{s=String(s||'').toLowerCase();return s==='completed'?'success':s==='failed'||s==='stalled'?'error':s==='cancelled'?'warning':'live'};
  const phaseLabel=s=>String(s||'RUNNING').replace(/[_-]+/g,' ');
  const shortId=id=>id?String(id).slice(0,14):'—';

  function ensurePanel(){
    if(state.panel)return state.panel;
    const host=document.createElement('div');
    host.id='vexa-owner-live-operation';
    host.innerHTML=`<style>
      #vexa-owner-live-operation{position:fixed;inset:0;z-index:2147483000;display:none;pointer-events:none;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#dbe7f5}
      #vexa-owner-live-operation.vo-visible{display:block}
      #vexa-owner-live-operation:before{content:"";position:absolute;inset:0;background:radial-gradient(circle at 50% 0%,rgba(24,64,105,.20),transparent 45%),rgba(2,8,18,.56);backdrop-filter:blur(3px);pointer-events:none}
      #vexa-owner-live-operation .vo-shell{position:absolute;inset:4.5vh 4vw;display:flex;flex-direction:column;min-height:0;background:#07111f;border:1px solid rgba(105,160,210,.25);border-radius:18px;box-shadow:0 30px 100px rgba(0,0,0,.62),0 0 0 1px rgba(255,255,255,.02) inset;overflow:hidden;pointer-events:auto}
      #vexa-owner-live-operation .vo-top{height:70px;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:0 20px;border-bottom:1px solid rgba(148,163,184,.13);background:linear-gradient(180deg,rgba(15,31,51,.96),rgba(7,17,31,.96))}
      #vexa-owner-live-operation .vo-brand{display:flex;align-items:center;gap:12px;min-width:0}.vo-brand-mark{width:30px;height:30px;border:1px solid rgba(56,189,248,.35);border-radius:8px;display:grid;place-items:center;color:#67e8f9;font:700 11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;background:#0a1b2e}.vo-kicker{font:700 10px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;color:#67e8f9}.vo-title{font-size:15px;font-weight:750;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vo-subtitle{font-size:10px;color:#71849b;margin-top:3px}
      #vexa-owner-live-operation .vo-head-actions{display:flex;align-items:center;gap:8px}.vo-live-pill{display:flex;align-items:center;gap:7px;padding:6px 9px;border:1px solid rgba(52,211,153,.2);border-radius:999px;background:rgba(6,35,32,.55);font:700 9px ui-monospace,SFMono-Regular,Menlo,monospace;color:#86efac;letter-spacing:.08em}.vo-live-dot{width:6px;height:6px;border-radius:50%;background:#4ade80;box-shadow:0 0 10px #4ade80}.vo-live-dot.pulse{animation:vo-pulse 1.5s ease-in-out infinite}@keyframes vo-pulse{50%{opacity:.35;box-shadow:0 0 3px #4ade80}}
      #vexa-owner-live-operation button{font:600 11px system-ui,sans-serif;border:1px solid rgba(148,163,184,.18);background:#0c1a2b;color:#cbd5e1;border-radius:8px;padding:8px 11px;cursor:pointer;transition:background .15s,border-color .15s}#vexa-owner-live-operation button:hover{background:#12263d;border-color:rgba(103,232,249,.3)}#vexa-owner-live-operation button:focus-visible{outline:2px solid rgba(56,189,248,.65);outline-offset:2px}.vo-danger{color:#fecaca!important;border-color:rgba(248,113,113,.25)!important;background:#28151b!important}.vo-danger:hover{background:#3a1922!important}.vo-hidden{display:none!important}
      #vexa-owner-live-operation .vo-body{display:flex;flex:1;min-height:0}.vo-main{flex:1;min-width:0;display:flex;flex-direction:column}.vo-overview{padding:18px 20px 14px;border-bottom:1px solid rgba(148,163,184,.12)}.vo-overview-line{display:flex;justify-content:space-between;gap:20px;align-items:end}.vo-phase{font-size:20px;font-weight:760;letter-spacing:-.02em;color:#f1f5f9}.vo-detail{font-size:11px;color:#91a4ba;margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:72vw}.vo-percent{font:700 24px ui-monospace,SFMono-Regular,Menlo,monospace;color:#67e8f9}.vo-progress{height:5px;margin-top:15px;background:#101f32;border-radius:999px;overflow:hidden}.vo-bar{height:100%;width:0;background:linear-gradient(90deg,#0ea5e9,#22d3ee);box-shadow:0 0 14px rgba(34,211,238,.35);transition:width .35s ease}.vo-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px}.vo-stat{min-width:0;padding:9px 10px;background:rgba(12,27,44,.75);border:1px solid rgba(148,163,184,.09);border-radius:9px}.vo-label{font:700 8px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em;color:#60758c}.vo-value{font:600 11px system-ui,sans-serif;color:#d9e7f5;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vo-value.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
      .vo-log-head{display:flex;justify-content:space-between;align-items:center;padding:11px 20px 8px;color:#7f95ac;font:700 9px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em}.vo-log{flex:1;min-height:0;overflow:auto;padding:0 20px 18px;font:11px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace;scroll-behavior:auto}.vo-event{display:grid;grid-template-columns:72px 86px 1fr 38px;gap:8px;align-items:baseline;padding:5px 0;border-bottom:1px solid rgba(148,163,184,.055)}.vo-event-time{color:#52677d}.vo-event-phase{color:#67e8f9;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vo-event-detail{color:#b8c7d8;overflow-wrap:anywhere}.vo-event-progress{text-align:right;color:#5f748a}.vo-empty{padding:24px 0;color:#53687e}.vo-cursor{display:inline-block;width:6px;height:12px;background:#67e8f9;margin-left:4px;vertical-align:-2px;animation:vo-cursor 1s steps(2,end) infinite}@keyframes vo-cursor{50%{opacity:0}}
      .vo-side{width:285px;border-left:1px solid rgba(148,163,184,.12);background:rgba(5,14,25,.65);padding:16px;display:flex;flex-direction:column;gap:12px;overflow:auto}.vo-side-card{padding:12px;border:1px solid rgba(148,163,184,.1);border-radius:10px;background:rgba(10,24,40,.7)}.vo-side-title{font:700 8px ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.1em;color:#627890;margin-bottom:9px}.vo-check{display:flex;align-items:center;gap:8px;padding:6px 0;font-size:10px;color:#9eb0c3;border-bottom:1px solid rgba(148,163,184,.06)}.vo-check:last-child{border-bottom:0}.vo-check-dot{width:6px;height:6px;border-radius:50%;background:#475569}.vo-check.live .vo-check-dot{background:#38bdf8;box-shadow:0 0 7px rgba(56,189,248,.55)}.vo-check.success .vo-check-dot{background:#4ade80}.vo-check.error .vo-check-dot{background:#fb7185}.vo-operation-id{font:10px ui-monospace,SFMono-Regular,Menlo,monospace;color:#8ea3b9;word-break:break-all}.vo-actions{margin-top:auto;display:flex;flex-direction:column;gap:7px}.vo-result{font:10px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;color:#8fa4ba;white-space:pre-wrap;overflow-wrap:anywhere;max-height:190px;overflow:auto}.vo-result.success{color:#86efac}.vo-result.error{color:#fda4af}.vo-result.warning{color:#fde68a}
      #vexa-owner-live-operation.vo-minimized .vo-shell{inset:auto 18px 18px auto;width:min(440px,calc(100vw - 36px));height:auto;border-radius:13px}.vo-minimized .vo-top{height:56px}.vo-minimized .vo-body{display:none}.vo-minimized .vo-subtitle{display:none}.vo-minimized .vo-title{font-size:12px}.vo-minimized .vo-brand-mark{width:25px;height:25px}.vo-minimized .vo-live-pill{display:none}
      #vexa-owner-live-operation.vo-success .vo-live-pill{border-color:rgba(52,211,153,.3);color:#86efac}#vexa-owner-live-operation.vo-error .vo-live-pill{border-color:rgba(248,113,113,.3);background:rgba(55,14,22,.55);color:#fda4af}.vo-error .vo-live-dot{background:#fb7185;box-shadow:0 0 9px #fb7185}.vo-warning .vo-live-dot{background:#fbbf24;box-shadow:0 0 9px #fbbf24}
      @media(max-width:900px){#vexa-owner-live-operation .vo-shell{inset:2vh 2vw;border-radius:14px}.vo-side{width:230px}.vo-event{grid-template-columns:60px 72px 1fr 34px}}
      @media(max-width:680px){#vexa-owner-live-operation .vo-shell{inset:0;border-radius:0}.vo-top{height:62px!important;padding:0 13px!important}.vo-subtitle{display:none}.vo-head-actions button{font-size:10px!important;padding:7px 8px!important}.vo-body{display:block}.vo-main{height:100%}.vo-overview{padding:14px}.vo-stats{grid-template-columns:1fr 1fr}.vo-log-head,.vo-log{padding-left:14px;padding-right:14px}.vo-event{grid-template-columns:48px 62px 1fr}.vo-event-progress{display:none}.vo-side{display:none}.vo-phase{font-size:17px}.vo-percent{font-size:20px}.vo-detail{max-width:65vw}}
    </style>
    <section class="vo-shell" role="dialog" aria-modal="false" aria-label="Owner OS live operation workspace">
      <header class="vo-top"><div class="vo-brand"><div class="vo-brand-mark">OS</div><div><div class="vo-kicker">VEXAACCOUNT / OWNER OS</div><div class="vo-title">Live Operations Workspace</div><div class="vo-subtitle">Real server execution · source review · verification · deployment</div></div></div><div class="vo-head-actions"><div class="vo-live-pill"><i class="vo-live-dot pulse"></i><span data-live-label>LIVE</span></div><button type="button" data-minimize>Minimize</button><button type="button" data-close>Close</button></div></header>
      <div class="vo-body"><main class="vo-main"><section class="vo-overview"><div class="vo-overview-line"><div><div class="vo-phase" data-phase>READY</div><div class="vo-detail" data-detail>Owner OS is ready.</div></div><div class="vo-percent" data-percent>0%</div></div><div class="vo-progress"><div class="vo-bar" data-bar></div></div><div class="vo-stats"><div class="vo-stat"><div class="vo-label">OPERATION</div><div class="vo-value mono" data-id>—</div></div><div class="vo-stat"><div class="vo-label">STATUS</div><div class="vo-value" data-status>READY</div></div><div class="vo-stat"><div class="vo-label">ELAPSED</div><div class="vo-value mono" data-elapsed>00:00:00</div></div><div class="vo-stat"><div class="vo-label">EVENTS</div><div class="vo-value mono" data-count>0</div></div></div></section><div class="vo-log-head"><span>LIVE EXECUTION LOG</span><span data-log-state>SERVER STATE</span></div><div class="vo-log" data-events><div class="vo-empty">Waiting for an Owner OS operation<span class="vo-cursor"></span></div></div></main><aside class="vo-side"><div class="vo-side-card"><div class="vo-side-title">OPERATION CONTEXT</div><div class="vo-operation-id" data-side-id>—</div></div><div class="vo-side-card"><div class="vo-side-title">SYSTEM CHECKS</div><div class="vo-check" data-check="server"><i class="vo-check-dot"></i><span>Owner operation service</span></div><div class="vo-check" data-check="state"><i class="vo-check-dot"></i><span>Live server state</span></div><div class="vo-check" data-check="worker"><i class="vo-check-dot"></i><span>Worker heartbeat</span></div><div class="vo-check" data-check="result"><i class="vo-check-dot"></i><span>Result verification</span></div></div><div class="vo-side-card"><div class="vo-side-title">CURRENT ACTION</div><div class="vo-result" data-result>Standing by.</div></div><div class="vo-actions"><button type="button" class="vo-danger" data-cancel hidden>Cancel current operation</button><button type="button" data-minimize-2>Minimize workspace</button></div></aside></div>
    </section>`;
    document.body.appendChild(host);
    state.panel=host;
    host.querySelector('[data-minimize]').onclick=()=>toggleMinimize();
    host.querySelector('[data-minimize-2]').onclick=()=>toggleMinimize();
    host.querySelector('[data-close]').onclick=()=>hide();
    host.querySelector('[data-cancel]').onclick=()=>cancelActive();
    return host;
  }

  function show(){const p=ensurePanel();p.classList.add('vo-visible');p.classList.remove('vo-minimized');state.minimized=false}
  function toggleMinimize(){const p=ensurePanel();state.minimized=!state.minimized;p.classList.toggle('vo-minimized',state.minimized);if(state.minimized)p.classList.add('vo-visible')}
  function hide(){const p=ensurePanel();p.classList.remove('vo-visible','vo-minimized');state.minimized=false}

  function setChecks(snapshot){
    const p=ensurePanel();
    const status=String(snapshot?.status||'').toLowerCase();
    const live=!terminal(status);
    p.querySelector('[data-check="server"]').className=`vo-check ${live||status?'live':''}`;
    p.querySelector('[data-check="state"]').className=`vo-check ${snapshot?'success':'live'}`;
    p.querySelector('[data-check="worker"]').className=`vo-check ${status==='stalled'?'error':live?'live':'success'}`;
    p.querySelector('[data-check="result"]').className=`vo-check ${status==='failed'||status==='stalled'?'error':status==='completed'?'success':live?'live':''}`;
  }

  function render(snapshot){
    const p=ensurePanel();
    if(!snapshot){show();return}
    show();
    p.dataset.operationId=snapshot.id||'';
    const status=String(snapshot.status||'running').toLowerCase();
    const pct=Math.max(0,Math.min(100,Number(snapshot.progress)||0));
    p.classList.toggle('vo-success',status==='completed');p.classList.toggle('vo-error',status==='failed'||status==='stalled');p.classList.toggle('vo-warning',status==='cancelled');
    p.querySelector('[data-phase]').textContent=phaseLabel(snapshot.phase);
    p.querySelector('[data-detail]').textContent=snapshot.detail||'Operation is running…';
    p.querySelector('[data-percent]').textContent=`${Math.round(pct)}%`;
    p.querySelector('[data-bar]').style.width=`${pct}%`;
    p.querySelector('[data-id]').textContent=shortId(snapshot.id);
    p.querySelector('[data-side-id]').textContent=String(snapshot.id||'—');
    p.querySelector('[data-status]').textContent=status.toUpperCase();
    p.querySelector('[data-count]').textContent=String(Array.isArray(snapshot.events)?snapshot.events.length:0);
    p.querySelector('[data-live-label]').textContent=terminal(status)?status.toUpperCase():'LIVE';
    p.querySelector('[data-cancel]').hidden=terminal(status);
    const result=p.querySelector('[data-result]');
    if(status==='completed'){result.className='vo-result success';result.textContent='Operation completed successfully. Result is available to the calling application.'}
    else if(status==='failed'||status==='stalled'){result.className='vo-result error';result.textContent=snapshot.error?.message||snapshot.detail||'Operation failed.'}
    else if(status==='cancelled'){result.className='vo-result warning';result.textContent=snapshot.detail||'Operation cancelled by Owner.'}
    else{result.className='vo-result';result.textContent=snapshot.detail||'Processing…'}
    setChecks(snapshot);
    const events=Array.isArray(snapshot.events)?snapshot.events:[];
    const key=`${snapshot.id}|${events.length}|${events.length?events[events.length-1].at:''}|${snapshot.progress}|${snapshot.phase}|${snapshot.detail}`;
    if(key!==state.lastRenderedEventsKey){
      state.lastRenderedEventsKey=key;
      const log=p.querySelector('[data-events]');
      if(events.length){
        log.innerHTML=events.slice(-MAX_VISIBLE_EVENTS).map(e=>`<div class="vo-event"><span class="vo-event-time">${esc(e.at?new Date(e.at).toLocaleTimeString([], {hour12:false}):'')}</span><span class="vo-event-phase">${esc(phaseLabel(e.phase))}</span><span class="vo-event-detail">${esc(e.detail||'')}</span><span class="vo-event-progress">${Number.isFinite(Number(e.progress))?Math.round(Number(e.progress))+'%':''}</span></div>`).join('');
        log.scrollTop=log.scrollHeight;
      }else log.innerHTML='<div class="vo-empty">Operation connected. Waiting for the first server event<span class="vo-cursor"></span></div>';
    }
  }

  function updateTimer(){
    const p=state.panel;if(!p)return;
    const id=p.dataset.operationId;if(!id)return;
    const w=state.watchers.get(id);if(!w?.snapshot)return;
    const start=Date.parse(w.snapshot.startedAt||w.snapshot.createdAt||'');if(!Number.isFinite(start))return;
    const end=terminal(w.snapshot.status)&&w.snapshot.completedAt?Date.parse(w.snapshot.completedAt):Date.now();
    p.querySelector('[data-elapsed]').textContent=formatElapsed(Math.max(0,end-start));
  }

  async function getState(id,signal){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),12000);
    if(signal)signal.addEventListener('abort',()=>controller.abort(),{once:true});
    try{const r=await fetch(`${API}/api/sso-application-analyzer/operations/${encodeURIComponent(id)}`,{credentials:'include',cache:'no-store',headers:{Accept:'application/json','Cache-Control':'no-cache'},signal:controller.signal});const d=await r.json().catch(()=>({}));if(!r.ok||d.success===false)throw new Error(d.message||`Operation request failed (${r.status})`);return d.operation}
    finally{clearTimeout(timer)}
  }

  function stopWatcher(id){const w=state.watchers.get(id);if(!w)return;w.stopped=true;if(w.poll)clearTimeout(w.poll);w.poll=null;state.watchers.delete(id);if(state.activeId===id)state.activeId=null}
  function finish(id,snapshot){const w=state.watchers.get(id);if(!w)return;w.snapshot=snapshot;render(snapshot);updateTimer();stopWatcher(id);w.onComplete?.(snapshot)}

  function attach(id,handlers={}){
    id=String(id);
    if(state.watchers.has(id))return state.watchers.get(id);
    const controller=new AbortController();
    const w={id,snapshot:null,onComplete:handlers.onComplete,onError:handlers.onError,poll:null,stopped:false,controller};
    state.watchers.set(id,w);state.activeId=id;show();ensurePanel().dataset.operationId=id;
    const consume=snapshot=>{if(w.stopped)return;w.snapshot=snapshot;render(snapshot);updateTimer();if(terminal(snapshot.status)){if(String(snapshot.status).toLowerCase()==='completed')w.onComplete?.(snapshot);else w.onError?.(snapshot.error||new Error(snapshot.detail||`Operation ${snapshot.status}`));stopWatcher(id)}};
    const schedule=()=>{if(w.stopped||terminal(w.snapshot?.status))return;w.poll=setTimeout(async()=>{w.poll=null;if(w.stopped)return;try{consume(await getState(id,controller.signal))}catch(e){if(e?.name!=='AbortError'){const p=ensurePanel();p.querySelector('[data-log-state]').textContent='RETRYING SERVER STATE';p.querySelector('[data-result]').textContent=e?.message||'Temporary status read failure'} }finally{schedule()}},POLL_MS)};
    getState(id,controller.signal).then(consume).catch(e=>{if(e?.name!=='AbortError'){render({id,status:'failed',phase:'CONNECTION ERROR',progress:0,detail:e.message,events:[],error:{message:e.message}});w.onError?.(e)}stopWatcher(id)}).finally(schedule);
    return w;
  }

  async function cancelActive(){
    const id=state.activeId||ensurePanel().dataset.operationId;if(!id)return;
    try{const r=await fetch(`${API}/api/sso-application-analyzer/operations/${encodeURIComponent(id)}/cancel`,{method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json'}});const d=await r.json().catch(()=>({}));if(!r.ok||!d.operation)throw new Error(d.message||`Cancel failed (${r.status})`);render(d.operation)}catch(e){const p=ensurePanel();p.querySelector('[data-result]').className='vo-result error';p.querySelector('[data-result]').textContent=e.message||'Cancellation request failed'}}

  const api={
    ensure:ensurePanel,
    show,
    hide,
    minimize:()=>{state.minimized=true;ensurePanel().classList.add('vo-visible','vo-minimized')},
    begin:(phase,detail)=>{const p=ensurePanel();show();p.querySelector('[data-phase]').textContent=phaseLabel(phase||'RUNNING');p.querySelector('[data-detail]').textContent=detail||'Working…';p.querySelector('[data-status]').textContent='RUNNING';p.querySelector('[data-percent]').textContent='0%';p.querySelector('[data-bar]').style.width='0%';return p},
    setPhase:(phase,detail,progress)=>{const p=ensurePanel();show();if(phase)p.querySelector('[data-phase]').textContent=phaseLabel(phase);if(detail)p.querySelector('[data-detail]').textContent=detail;if(progress!==undefined){const pct=Math.max(0,Math.min(100,Number(progress)||0));p.querySelector('[data-percent]').textContent=`${Math.round(pct)}%`;p.querySelector('[data-bar]').style.width=`${pct}%`}},
    watch:(id,handlers)=>new Promise((resolve,reject)=>attach(id,{onComplete:s=>{handlers?.onComplete?.(s.result??s,s);resolve(s.result??s)},onError:e=>{handlers?.onError?.(e);reject(e)}})),
    cancel:id=>id?fetch(`${API}/api/sso-application-analyzer/operations/${encodeURIComponent(id)}/cancel`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'}}):cancelActive(),
    status:()=>state.activeId?state.watchers.get(state.activeId)?.snapshot:null
  };
  window.vexaOwnerProcess=api;
  state.timer=setInterval(updateTimer,1000);
  window.addEventListener('pagehide',()=>{for(const w of state.watchers.values()){w.stopped=true;w.controller?.abort();if(w.poll)clearTimeout(w.poll)}state.watchers.clear()},{capture:true});
  window.addEventListener('beforeunload',()=>{for(const w of state.watchers.values()){w.stopped=true;w.controller?.abort();if(w.poll)clearTimeout(w.poll)}},{capture:true});
})();