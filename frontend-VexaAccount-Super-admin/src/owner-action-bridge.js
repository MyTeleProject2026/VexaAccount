(()=>{
'use strict';
if(window.__VEXA_OWNER_ACTION_BRIDGE__)return;window.__VEXA_OWNER_ACTION_BRIDGE__=true;
const API=(window.VEXA_ACCOUNT_ADMIN_API_BASE||'https://api-vexaaccount.onrender.com').replace(/\/$/,'');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
async function api(path,opt={}){const r=await fetch(API+path,{credentials:'include',cache:'no-store',...opt,headers:{Accept:'application/json',...(opt.body?{'Content-Type':'application/json'}:{}),...(opt.headers||{})}});const d=await r.json().catch(()=>({}));if(r.status===401||r.status===403){location.reload();throw Error('Owner session expired')}if(!r.ok||d.success===false)throw Error(d.message||d.error||`Request failed (${r.status})`);return d}
function toast(m,bad=false){const n=document.createElement('div');n.className='op-toast '+(bad?'bad':'');n.textContent=m;document.body.appendChild(n);setTimeout(()=>n.remove(),3200)}
const val=id=>document.getElementById(id)?.value??'';
async function action(id){
 try{
  if(id==='logout'){await api('/api/auth/super-admin/logout',{method:'POST'});location.reload();return}
  if(id.startsWith('app:')){window.__vexaOwnerOpenApp?.(id.slice(4));return}
  if(id.startsWith('app-save:')){const cid=id.slice(9);await api('/api/sso-registry/applications/'+encodeURIComponent(cid),{method:'PATCH',body:JSON.stringify({display_name:val('ad-name'),owner_label:val('ad-owner'),environment:val('ad-env'),description:val('ad-desc')})});toast('Application profile saved');location.hash='sso-applications';location.reload();return}
  if(id.startsWith('app-check:')){await api('/api/sso-registry/applications');toast('Application registry and authorization check passed');return}
  if(id.startsWith('user:')){window.__vexaOwnerOpenUser?.(id.slice(5));return}
  if(id.startsWith('user-save:')){const uid=id.slice(10);await api('/api/owner/users/'+encodeURIComponent(uid)+'/profile',{method:'PATCH',body:JSON.stringify({name:val('u-name'),country:val('u-country')})});toast('User profile saved');location.hash='user-detail';location.reload();return}
  if(id.startsWith('user-2fa:')){await api('/api/owner/users/'+id.slice(9)+'/security/reset-2fa',{method:'POST'});toast('2FA enrollment reset');return}
  if(id.startsWith('user-pass:')){await api('/api/owner/users/'+id.slice(10)+'/security/reset-passcode',{method:'POST'});toast('Passcode enrollment reset');return}
  if(id.startsWith('user-sessions:')){await api('/api/owner/users/'+id.slice(14)+'/sessions/revoke-all',{method:'POST'});toast('All user sessions revoked');return}
  if(id.startsWith('user-credit:')){const uid=id.slice(12);const amount=Number(val('u-credit'));if(!Number.isInteger(amount)||amount===0)throw Error('Enter a non-zero integer credit adjustment');await api('/api/owner/users/'+encodeURIComponent(uid)+'/credits',{method:'PATCH',body:JSON.stringify({creditScoreDelta:amount,reason:'Owner Control Center adjustment'})});toast('Credit adjustment applied');return}
  if(id.startsWith('user-storage:')){const d=await api('/api/owner/users/'+id.slice(13)+'/storage');toast(`Loaded ${Array.isArray(d.records)?d.records.length:0} storage records`);return}
  if(id.startsWith('user-note:')){const note=val('u-note').trim();if(!note)throw Error('Enter an admin note');await api('/api/owner/users/'+id.slice(10)+'/notes',{method:'POST',body:JSON.stringify({note})});document.getElementById('u-note').value='';toast('Admin note added');return}
  if(id==='analyze-start'){const repo=val('a-repo').trim(),branch=val('a-branch').trim()||'main';if(!repo)throw Error('Repository is required');const d=await api('/api/sso-application-analyzer/analyze/async',{method:'POST',body:JSON.stringify({repository:repo,branch})});toast(`Analysis started: ${d.operation?.id||'operation created'}`);return}
  if(id==='factory-analyze'){const repo=val('f-repo').trim(),branch=val('f-branch').trim()||'main';if(!repo)throw Error('Repository is required');const d=await api('/api/sso-application-analyzer/analyze/async',{method:'POST',body:JSON.stringify({repository:repo,branch})});const out=document.getElementById('f-result');if(out)out.textContent=JSON.stringify(d.operation||d,null,2);toast('Repository analysis started');return}
  if(id==='factory-generate'){throw Error('Generate kit requires a completed signed source-review plan; run analysis and source planning first')}
  if(id==='operations'){location.hash='operations';return}
 }catch(e){toast(e.message,true)}
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(b){e.preventDefault();action(b.dataset.action)}});
window.__vexaOwnerOpenApp=id=>{location.hash='sso-application-detail';setTimeout(()=>window.__vexaOwnerRouteApp?.(id),0)};
window.__vexaOwnerOpenUser=id=>{location.hash='user-detail';setTimeout(()=>window.__vexaOwnerRouteUser?.(id),0)};
})();
