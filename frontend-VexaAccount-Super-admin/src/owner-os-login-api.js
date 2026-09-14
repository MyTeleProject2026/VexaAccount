(()=>{'use strict';
if(window.__VEXA_OWNER_LOGIN_API_V1__)return;
window.__VEXA_OWNER_LOGIN_API_V1__=true;
const API=(window.VEXA_ACCOUNT_ADMIN_API_BASE||'https://api-vexaaccount.onrender.com').replace(/\/$/,'');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function clearOverlays(){
 document.querySelector('#vexa-owner-operation-center')?.classList.remove('visible');
 document.querySelector('#vexa-owner-operation-center')?.setAttribute('aria-hidden','true');
 document.querySelector('#vexa-owner-live-operation')?.classList.remove('visible','owner-operation-full-open','min');
 document.documentElement.classList.remove('voc-open');
 document.body.classList.remove('owner-processing','is-loading','loading','voc-open');
}
function showLogin(message=''){
 window.__VEXA_OWNER_BOOTING__=false;
 window.__VEXA_OWNER_BOOT_STATE__='unauthenticated';
 clearOverlays();
 const app=document.querySelector('#app');
 if(!app)return;
 app.innerHTML=`<main class="os-login"><section class="os-login-card"><span class="os-mark">V</span><p class="os-eyebrow">VEXAACCOUNT ECOSYSTEM</p><h1>Owner Access</h1><p class="os-muted">Secure authentication for the Owner OS.</p>${message?`<p class="os-error">${esc(message)}</p>`:''}<form class="os-form" id="owner-login"><label>Email<input id="login-email" type="email" autocomplete="username" required></label><label>Password<input id="login-password" type="password" autocomplete="current-password" required></label><button class="os-btn os-primary" type="submit">Enter Owner OS</button></form></section></main>`;
 const form=document.querySelector('#owner-login');
 form?.addEventListener('submit',async e=>{
  e.preventDefault();
  const button=form.querySelector('button');
  const email=document.querySelector('#login-email')?.value.trim()||'';
  const password=document.querySelector('#login-password')?.value||'';
  button.disabled=true;
  try{
   const controller=new AbortController();
   const timer=setTimeout(()=>controller.abort(),12000);
   let r;
   try{r=await fetch(API+'/api/auth/super-admin/login',{method:'POST',credentials:'include',cache:'no-store',headers:{'Content-Type':'application/json','Accept':'application/json','Cache-Control':'no-cache'},body:JSON.stringify({email,password}),signal:controller.signal})}finally{clearTimeout(timer)}
   const d=await r.json().catch(()=>({}));
   if(!r.ok||d.success!==true)throw Error(d.message||`Owner sign-in failed (${r.status})`);
   window.__VEXA_OWNER_BOOTING__=false;
   window.__VEXA_OWNER_BOOT_STATE__='signed-in';
   if(typeof window.vexaOwnerOS?.reload==='function')await window.vexaOwnerOS.reload();
   else window.location.reload();
  }catch(err){
   button.disabled=false;
   const old=document.querySelector('#owner-login-error');
   if(old)old.remove();
   const p=document.createElement('p');p.id='owner-login-error';p.className='os-error';p.textContent=err?.name==='AbortError'?'Owner sign-in timed out. Please try again.':(err?.message||'Owner sign-in failed');
   form.prepend(p);
  }
 });
 setTimeout(()=>document.querySelector('#login-email')?.focus(),0);
}
window.vexaOwnerOS=window.vexaOwnerOS||{};
window.vexaOwnerOS.showLogin=showLogin;
window.vexaOwnerShowLogin=showLogin;
})();
