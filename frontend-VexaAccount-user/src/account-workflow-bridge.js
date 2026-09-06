(()=>{
'use strict';
if(window.__VEXA_ACCOUNT_WORKFLOW_BRIDGE__)return;
window.__VEXA_ACCOUNT_WORKFLOW_BRIDGE__=true;
const API=window.VEXA_ACCOUNT_API_BASE||'https://api-vexaaccount.onrender.com';
const keys=['vexaaccount_access_token','vexa_access_token','access_token','token','userToken','accessToken'];
const token=()=>{try{const t=window.vexaAccountAuth?.getToken?.();if(t)return t}catch{}for(const s of [localStorage,sessionStorage])for(const k of keys){try{const v=s.getItem(k);if(v)return v}catch{}}return null};
async function api(path,opt={}){const h=new Headers(opt.headers||{});if(opt.body&&!h.has('Content-Type'))h.set('Content-Type','application/json');const t=token();if(t)h.set('Authorization','Bearer '+t);const r=await fetch(API+path,{credentials:'include',...opt,headers:h});const d=await r.json().catch(()=>({success:false,message:'Invalid server response'}));if(!r.ok||d.success===false)throw Error(d.message||`Request failed (${r.status})`);return d}
const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const notify=(m,type='info')=>{if(typeof window.vexaNotify==='function')return window.vexaNotify(m,type);if(typeof window.vexaReactNotify?.[type==='success'?'showSuccess':type==='error'?'showError':'showInfo']==='function')return window.vexaReactNotify[type==='success'?'showSuccess':type==='error'?'showError':'showInfo'](m);alert(m)};
function recoveryModal(){
 const bg=document.createElement('div');bg.className='vx-modal-bg';bg.innerHTML='<div class="vx-modal"><div class="vx-modal-head"><b>Recovery email</b><button class="close" type="button">×</button></div><div class="vx-modal-body"><form id="vx-recovery-request" class="vx-form"><p class="muted">Your current password is required. The new recovery address is not saved until the verification code is confirmed.</p><label>Recovery email<input class="vx-input" type="email" name="recovery_email" required></label><label>Current password<input class="vx-input" type="password" name="current_password" autocomplete="current-password" required></label><button class="vx-btn primary">Send verification code</button></form></div></div>';
 document.body.appendChild(bg);bg.querySelector('.close').onclick=()=>bg.remove();bg.onclick=e=>{if(e.target===bg)bg.remove()};
 bg.querySelector('#vx-recovery-request').onsubmit=async e=>{e.preventDefault();const b=e.currentTarget.querySelector('button');b.disabled=true;try{const d=await api('/api/account/recovery',{method:'PATCH',body:JSON.stringify(Object.fromEntries(new FormData(e.currentTarget)))});bg.querySelector('.vx-modal-body').innerHTML='<form id="vx-recovery-confirm" class="vx-form"><p class="muted">A 6-digit verification code was sent to <b>'+esc(d.pendingRecoveryEmail||'the new recovery email')+'</b>. Your existing recovery email remains active until this code is confirmed.</p><label>Verification code<input class="vx-input" name="otp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" required></label><button class="vx-btn primary">Confirm recovery email</button></form><button id="vx-recovery-cancel" class="vx-btn" style="margin-top:10px">Cancel</button>';bg.querySelector('#vx-recovery-cancel').onclick=()=>bg.remove();bg.querySelector('#vx-recovery-confirm').onsubmit=async ev=>{ev.preventDefault();const btn=ev.currentTarget.querySelector('button');btn.disabled=true;try{const r=await api('/api/account/recovery/confirm',{method:'POST',body:JSON.stringify({otp:String(new FormData(ev.currentTarget).get('otp')||'').trim()})});bg.remove();notify(r.message||'Recovery email verified and updated successfully','success');window.dispatchEvent(new Event('vexa-account-route-change'));setTimeout(()=>location.reload(),250)}catch(err){notify(err.message,'error');btn.disabled=false}}}catch(err){notify(err.message,'error');b.disabled=false}};
}
function install(){
 document.addEventListener('click',e=>{
  const b=e.target.closest('[data-action="recovery-email"]');
  if(b){e.preventDefault();e.stopImmediatePropagation();recoveryModal();return}
  const t=e.target.closest('[data-action="toggle"]');
  const people=t?.closest('.vx-page[data-page="people"]');
  if(!people)return;
  e.preventDefault();e.stopImmediatePropagation();
  const key=t.dataset.key;const value=!Number(t.dataset.value||'0');
  const supported=['location_sharing_enabled','personalization_enabled','activity_history_enabled','push_notifications_enabled','product_updates_enabled','marketing_email_enabled','security_email_enabled'];
  if(!supported.includes(key))return notify('This sharing control is not available through the current backend contract.','warning');
  api('/api/account/people',{method:'PATCH',body:JSON.stringify({[key]:value})}).then(()=>{notify('Sharing setting updated','success');location.reload()}).catch(err=>notify(err.message,'error'));
 },true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();
