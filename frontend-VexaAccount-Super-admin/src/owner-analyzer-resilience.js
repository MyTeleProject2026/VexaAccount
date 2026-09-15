(()=>{
'use strict';
if(window.__VEXA_OWNER_ANALYZER_RESILIENCE__)return;
window.__VEXA_OWNER_ANALYZER_RESILIENCE__=true;
const API=(window.VEXA_ACCOUNT_ADMIN_API_BASE||'https://api-vexaaccount.onrender.com').replace(/\/$/,'');
const STORE='vexa.owner.async.planner.v2';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const terminal=s=>['completed','failed','cancelled','stalled'].includes(String(s||'').toLowerCase());
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function get(path){const r=await fetch(API+path,{credentials:'include',cache:'no-store',headers:{Accept:'application/json','Cache-Control':'no-cache'}});const d=await r.json().catch(()=>({}));if(!r.ok||d.success===false)throw Error(d.message||d.error||`Request failed (${r.status})`);return d}
function root(){return document.getElementById('vexa-async-planner')}
function setText(sel,text){const r=root();const e=r?.querySelector(sel);if(e)e.textContent=text}
function setStatus(status,phase,progress,detail){const r=root();if(!r)return;const s=r.querySelector('[data-status]'),p=r.querySelector('[data-percent]'),b=r.querySelector('[data-bar]'),d=r.querySelector('[data-phase]'),dot=r.querySelector('[data-dot]');if(s)s.textContent=String(status||'RUNNING').toUpperCase();if(p)p.textContent=`${Math.max(0,Math.min(100,Number(progress)||0))}%`;if(b)b.style.width=p.textContent;if(d)d.textContent=detail||phase||'';if(dot)dot.className='vap-dot '+(String(status)==='completed'?'ok':terminal(status)?'err':'live')}
function save(op,repo,branch){try{localStorage.setItem(STORE,JSON.stringify({opId:op.id,kind:'analyze',startedAt:Date.parse(op.startedAt||'')||Date.now(),repository:repo,branch:branch,applicationKey:''}))}catch(_) {}}
function clear(){try{localStorage.removeItem(STORE)}catch(_) {}}
async function findLatest(repo,branch){
  for(let i=0;i<8;i++){
    try{
      const d=await get('/api/sso-application-analyzer/operations?includeTerminal=true&limit=20');
      const ops=d.operations||[];
      const hit=ops.find(o=>!terminal(o.status)&&String(o.type)==='repository-analysis');
      if(hit){const payloadRepo=String(oPayload(hit,'repository')||'');if(!payloadRepo||normalize(payloadRepo)===normalize(repo))return hit;}
      const same=ops.find(o=>String(o.type)==='repository-analysis'&&normalize(oPayload(o,'repository'))===normalize(repo)&&normalize(oPayload(o,'branch')||'main')===normalize(branch));
      if(same)return same;
    }catch(_){}
    await sleep(500);
  }
  return null;
}
function oPayload(op,key){return op?.payload?.[key]??op?.request?.[key]??''}
function normalize(v){return String(v||'').trim().replace(/^https?:\/\/github\.com\//i,'').replace(/\.git$/i,'').replace(/\/$/,'').toLowerCase()}
async function watch(id,repo,branch){
  let delay=900,started=Date.now();
  while(Date.now()-started<30*60*1000){
    try{
      const d=await get('/api/sso-application-analyzer/operations/'+encodeURIComponent(id));
      const op=d.operation||d;save(op,repo,branch);setText('[data-op]',op.id||id);setStatus(op.status,op.phase,op.progress,op.detail);const elapsed=root()?.querySelector('[data-elapsed]');if(elapsed)elapsed.textContent=new Date(Math.max(0,Date.now()-(Date.parse(op.startedAt||'')||started))).toISOString().slice(11,19);
      if(terminal(op.status)){clear();if(op.status==='completed'){window.__VEXA_LAST_SOURCE_ANALYSIS__=op.result||{};const p=root()?.querySelector('[data-plan]');if(p)p.disabled=!(op.result?.files||[]).length;setText('[data-phase]','Analysis completed. Review the findings before continuing.')}else{root()?.querySelector('[data-output]')?.insertAdjacentHTML('afterbegin',`<div class="vap-error">Analysis ${esc(op.status)}: ${esc(op.error||op.detail||'No additional error information')}</div>`)}return op;
      }
      delay=op.lastHeartbeatAt?1000:1800;
    }catch(e){setStatus('running','NETWORK RETRY',0,'Temporary connection interruption; server operation continues independently.');delay=Math.min(4000,delay+500)}
    await sleep(delay);
  }
  setStatus('running','STILL RUNNING',0,'The server operation is still independent; this page will keep retrying without aborting it.');return null;
}
async function startNoAbort(){
  const r=root();if(!r)return;
  const repo=r.querySelector('[data-repo]')?.value.trim()||'';const branch=r.querySelector('[data-branch]')?.value.trim()||'main';
  if(!repo){setStatus('failed','INPUT',0,'Enter the target GitHub repository.');return}
  const button=r.querySelector('[data-analyze]');if(button)button.disabled=true;
  setStatus('queued','SUBMITTING',0,'Submitting analysis request without a client-side abort timer…');
  r.querySelector('[data-output]').innerHTML='<div class="vap-ok">Server-side analysis is starting. This request is intentionally not tied to page navigation or a short browser timeout.</div>';
  try{
    // This is deliberately a plain fetch: the async endpoint returns 202 and the
    // actual GitHub work is durable on the server. No AbortController is allowed
    // to cancel the submission while GitHub analysis is starting.
    const response=await fetch(API+'/api/sso-application-analyzer/analyze/async',{method:'POST',credentials:'include',cache:'no-store',headers:{Accept:'application/json','Content-Type':'application/json','Cache-Control':'no-cache','Pragma':'no-cache'},body:JSON.stringify({repository:repo,branch})});
    const d=await response.json().catch(()=>({}));
    if(response.ok&&d.success&&d.operation?.id){save(d.operation,repo,branch);setStatus(d.operation.status,d.operation.phase,d.operation.progress,d.operation.detail||'Server operation accepted.');await watch(d.operation.id,repo,branch);return}
    // If a proxy closes the submission after accepting it, recover by locating
    // the newest durable repository-analysis operation instead of declaring failure.
    const recovered=await findLatest(repo,branch);if(recovered?.id){save(recovered,repo,branch);setStatus(recovered.status,recovered.phase,recovered.progress,recovered.detail||'Recovered server-side operation.');await watch(recovered.id,repo,branch);return}
    throw Error(d.message||d.error||`Analysis submission failed (${response.status})`);
  }catch(e){
    const recovered=await findLatest(repo,branch);
    if(recovered?.id){save(recovered,repo,branch);setStatus(recovered.status,recovered.phase,recovered.progress,'Submission connection closed, but the server operation was recovered.');await watch(recovered.id,repo,branch);return}
    setStatus('failed','SUBMISSION ERROR',0,e?.message||'Analysis submission failed');r.querySelector('[data-output]').insertAdjacentHTML('afterbegin',`<div class="vap-error">${esc(e?.message||'Analysis submission failed')}</div>`);
  }finally{if(button)button.disabled=false}
}
function bind(){const r=root();const b=r?.querySelector('[data-analyze]');if(!b||b.dataset.resilienceBound)return;b.dataset.resilienceBound='1';b.onclick=e=>{e.preventDefault();e.stopPropagation();void startNoAbort()}}
function init(){bind();new MutationObserver(bind).observe(document.body,{childList:true,subtree:true})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
