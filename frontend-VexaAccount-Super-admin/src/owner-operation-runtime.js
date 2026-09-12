(()=>{
  'use strict';
  if(window.__VEXA_OWNER_OPERATION_RUNTIME_V3__)return;
  window.__VEXA_OWNER_OPERATION_RUNTIME_V3__=true;

  const API=(window.VEXA_ACCOUNT_ADMIN_API_BASE||'https://api-vexaaccount.onrender.com').replace(/\/$/,'');
  const POLL_MS=1000;
  const state={watchers:new Map(),panel:null,timer:null};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const terminal=s=>['completed','failed','cancelled','stalled'].includes(String(s||'').toLowerCase());
  const formatElapsed=ms=>{const sec=Math.max(0,Math.floor(ms/1000));const h=String(Math.floor(sec/3600)).padStart(2,'0');const m=String(Math.floor((sec%3600)/60)).padStart(2,'0');const s=String(sec%60).padStart(2,'0');return `${h}:${m}:${s}`};

  function ensurePanel(){
    if(state.panel)return state.panel;
    const host=document.createElement('div');
    host.id='vexa-owner-live-operation';
    host.innerHTML=`<style>
      #vexa-owner-live-operation{position:fixed;right:18px;bottom:18px;z-index:2147483000;pointer-events:none;font:13px/1.4 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      #vexa-owner-live-operation .vo-panel{width:min(620px,calc(100vw - 36px));max-height:min(76vh,720px);overflow:hidden;background:rgba(7,15,29,.97);border:1px solid rgba(100,180,255,.28);border-radius:16px;box-shadow:0 18px 60px rgba(0,0,0,.48);color:#e6edf7;pointer-events:auto;backdrop-filter:blur(14px)}
      #vexa-owner-live-operation .vo-head{display:flex;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid rgba(148,163,184,.16)}
      #vexa-owner-live-operation .vo-title{font-weight:700;font-size:14px}.vo-sub{font-size:11px;color:#94a3b8;margin-top:2px}
      #vexa-owner-live-operation button{border:1px solid rgba(148,163,184,.2);background:#101d31;color:#dbeafe;border-radius:8px;padding:7px 10px;cursor:pointer}
      #vexa-owner-live-operation .vo-body{padding:14px 16px}.vo-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.vo-stat{background:rgba(15,30,50,.75);border-radius:10px;padding:9px}.vo-label{font-size:9px;letter-spacing:.1em;color:#64748b}.vo-value{margin-top:3px;font-size:12px;font-weight:650}.vo-progress{height:7px;background:#172338;border-radius:99px;overflow:hidden;margin:12px 0}.vo-bar{height:100%;width:0;background:#38bdf8;transition:width .25s ease}.vo-detail{font-size:11px;color:#cbd5e1;min-height:30px}.vo-events{margin-top:12px;max-height:270px;overflow:auto;border-top:1px solid rgba(148,163,184,.12)}.vo-event{padding:7px 0;border-bottom:1px solid rgba(148,163,184,.08)}.vo-event-top{display:flex;justify-content:space-between;gap:8px}.vo-phase{font-size:10px;font-weight:700;color:#93c5fd}.vo-time{font-size:9px;color:#64748b}.vo-event-detail{font-size:11px;color:#cbd5e1;margin-top:2px}.vo-event-progress{font-size:9px;color:#64748b}.vo-actions{display:flex;gap:8px;margin-top:12px}.vo-actions button{font-size:11px}.vo-cancel{background:#3b1720!important;color:#fecaca!important;border-color:#7f1d1d!important}.vo-hidden{display:none!important}.vo-terminal{color:#86efac}.vo-error{color:#fca5a5}.vo-warning{color:#fde68a}
      @media(max-width:600px){#vexa-owner-live-operation{right:8px;bottom:8px}.vo-panel{width:calc(100vw - 16px)!important}.vo-events{max-height:220px}}
    </style><section class="vo-panel" role="status" aria-live="polite">
      <header class="vo-head"><div><div class="vo-title">OWNER OS // LIVE EXECUTION</div><div class="vo-sub">Real server operation · 1s live state polling · non-blocking workspace</div></div><div><button data-minimize>Minimize</button></div></header>
      <div class="vo-body">
        <div class="vo-grid"><div class="vo-stat"><div class="vo-label">OPERATION</div><div class="vo-value" data-id>—</div></div><div class="vo-stat"><div class="vo-label">STATUS</div><div class="vo-value" data-status>—</div></div><div class="vo-stat"><div class="vo-label">PHASE</div><div class="vo-value" data-phase>—</div></div><div class="vo-stat"><div class="vo-label">ELAPSED</div><div class="vo-value" data-elapsed>00:00:00</div></div></div>
        <div class="vo-progress"><div class="vo-bar" data-bar></div></div><div class="vo-detail" data-detail>Waiting for server operation…</div>
        <div class="vo-events" data-events></div>
        <div class="vo-actions"><button class="vo-cancel" data-cancel>Cancel operation</button><button data-hide>Minimize workspace</button></div>
      </div>
    </section>`;
    document.body.appendChild(host); state.panel=host;
    host.querySelector('[data-minimize]').onclick=()=>host.querySelector('.vo-body').classList.toggle('vo-hidden');
    host.querySelector('[data-hide]').onclick=()=>host.querySelector('.vo-panel').classList.add('vo-hidden');
    host.querySelector('[data-cancel]').onclick=async()=>{const id=host.dataset.operationId;if(!id)return;try{await fetch(`${API}/api/sso-application-analyzer/operations/${encodeURIComponent(id)}/cancel`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},keepalive:true})}catch(e){renderError(e)}};
    return host;
  }

  function renderError(error){const p=ensurePanel();const d=p.querySelector('[data-detail]');d.className='vo-detail vo-error';d.textContent=error?.message||String(error||'Operation failed')}

  function render(snapshot){
    const p=ensurePanel();
    p.querySelector('.vo-panel').classList.remove('vo-hidden');
    if(!snapshot)return;
    p.dataset.operationId=snapshot.id||'';
    p.querySelector('[data-id]').textContent=String(snapshot.id||'').slice(0,12)||'—';
    p.querySelector('[data-status]').textContent=String(snapshot.status||'').toUpperCase();
    p.querySelector('[data-phase]').textContent=String(snapshot.phase||'—');
    p.querySelector('[data-bar]').style.width=`${Math.max(0,Math.min(100,Number(snapshot.progress)||0))}%`;
    const detail=p.querySelector('[data-detail]');detail.className='vo-detail';detail.textContent=snapshot.detail||'Working…';
    if(snapshot.status==='failed'||snapshot.status==='stalled')detail.className='vo-detail vo-error';
    if(snapshot.status==='cancelled')detail.className='vo-detail vo-warning';
    if(snapshot.status==='completed')detail.className='vo-detail vo-terminal';
    const events=Array.isArray(snapshot.events)?snapshot.events:[];
    p.querySelector('[data-events]').innerHTML=events.slice(-120).reverse().map(e=>`<div class="vo-event"><div class="vo-event-top"><span class="vo-phase">${esc(e.phase)}</span><span class="vo-time">${esc(e.at?new Date(e.at).toLocaleTimeString(): '')}</span></div><div class="vo-event-detail">${esc(e.detail)}</div><div class="vo-event-progress">${esc(e.kind||'event')} · ${Number(e.progress)||0}%</div></div>`).join('');
    p.querySelector('[data-cancel]').classList.toggle('vo-hidden',terminal(snapshot.status));
  }

  function updateTimer(){
    const p=state.panel;if(!p)return;const id=p.dataset.operationId;if(!id)return;const w=state.watchers.get(id);if(!w?.snapshot)return;
    const startMs=Date.parse(w.snapshot.startedAt||w.snapshot.createdAt);if(!Number.isFinite(startMs))return;
    const endMs=terminal(w.snapshot.status)&&w.snapshot.completedAt?Date.parse(w.snapshot.completedAt):Date.now();
    p.querySelector('[data-elapsed]').textContent=formatElapsed(Math.max(0,endMs-startMs));
  }

  async function getState(id){
    const r=await fetch(`${API}/api/sso-application-analyzer/operations/${encodeURIComponent(id)}`,{credentials:'include',cache:'no-store',headers:{Accept:'application/json','Cache-Control':'no-cache'}});
    const d=await r.json().catch(()=>({}));if(!r.ok||d.success===false)throw new Error(d.message||`Operation request failed (${r.status})`);return d.operation;
  }

  function stopWatcher(id){const w=state.watchers.get(id);if(!w)return;if(w.poll){clearTimeout(w.poll);w.poll=null}state.watchers.delete(id)}

  function finish(id,snapshot){
    const w=state.watchers.get(id);if(!w)return;w.snapshot=snapshot;render(snapshot);updateTimer();stopWatcher(id);
    if(terminal(snapshot.status)){if(snapshot.status==='completed')w.onComplete?.(snapshot.result??snapshot);else w.onError?.(snapshot.error||new Error(snapshot.detail||`Operation ${snapshot.status}`));}
  }

  function attach(id,handlers={}){
    if(state.watchers.has(id))return state.watchers.get(id);
    const w={id,snapshot:null,onComplete:handlers.onComplete,onError:handlers.onError,poll:null,stopped:false};state.watchers.set(id,w);ensurePanel().dataset.operationId=id;
    const consume=snapshot=>{if(w.stopped)return;w.snapshot=snapshot;render(snapshot);updateTimer();if(terminal(snapshot.status))finish(id,snapshot)};
    const schedule=()=>{if(w.stopped||terminal(w.snapshot?.status))return;w.poll=setTimeout(async()=>{w.poll=null;if(w.stopped)return;try{consume(await getState(id))}catch(e){renderError(e)}finally{schedule()}},POLL_MS)};
    getState(id).then(consume).catch(e=>{renderError(e);w.onError?.(e);stopWatcher(id)}).finally(schedule);
    return w;
  }

  const api={
    ensure(){return ensurePanel()},
    watch(id,handlers){return new Promise((resolve,reject)=>{attach(String(id),{onComplete:r=>{handlers.onComplete?.(r);resolve(r)},onError:e=>{handlers.onError?.(e);reject(e)}})})},
    cancel(id){return fetch(`${API}/api/sso-application-analyzer/operations/${encodeURIComponent(id)}/cancel`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},keepalive:true})}
  };
  window.vexaOwnerProcess=api;
  if(!state.timer)state.timer=setInterval(updateTimer,250);
  window.addEventListener('pagehide',()=>{for(const w of state.watchers.values()){w.stopped=true;if(w.poll)clearTimeout(w.poll);w.poll=null}state.watchers.clear()},{capture:true});
  window.addEventListener('beforeunload',()=>{for(const w of state.watchers.values()){w.stopped=true;if(w.poll)clearTimeout(w.poll)}},{capture:true});
})();
