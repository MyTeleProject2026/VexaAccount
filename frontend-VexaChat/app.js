(()=>{'use strict';
const API=String(window.VEXA_CHAT_API_BASE||'').replace(/\/$/,'');
const token=()=>localStorage.getItem('vexaaccount_access_token')||sessionStorage.getItem('vexaaccount_access_token')||'';
const csrf=()=>document.cookie.match(/(?:^|; )XSRF-TOKEN=([^;]+)/)?.[1]||'';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={folder:'all',customFolders:[],selectedMessages:new Set(),selectionMode:false,localStream:null,me:null,eventsRetry:null,livePollTimer:null,chats:[],active:null,messages:[],query:'',view:'chats',chatFilter:'all',lastListView:'chats',groupRole:null,events:null,typingTimer:null,typingUsers:{},typingTimers:{},hasMoreMessages:true,loadingOlderMessages:false,reactions:{},contacts:[],calls:[],settings:null,attachmentData:{},pc:null,callId:null,callType:null,callStartedAt:null,incomingCallData:null,incomingCallTimer:null,pendingAttachment:null,pendingCallSignals:[],seenIncomingCalls:{}};
const AUTH_STATE={mode:'login',email:'',userId:null,method:null};
const FOLDER_KEY='vexachat_custom_folders_v1';
function loadCustomFolders(){try{const v=JSON.parse(localStorage.getItem(FOLDER_KEY)||'[]');return Array.isArray(v)?v.filter(x=>x&&x.id&&x.name):[]}catch{return[]}}
function saveCustomFolders(){try{localStorage.setItem(FOLDER_KEY,JSON.stringify(state.customFolders||[]))}catch{}}
function folderMatches(c,f){if(!f||f.id==='all')return true;const unread=Number(c.unread_count)||0,pinned=Number(c.pinned)===1,archived=Number(c.archived)===1;const t=c.conversation_type||'direct';switch(f.filter){case 'unread':return unread>0;case 'pinned':return pinned;case 'groups':return t==='group';case 'personal':return t==='direct';case 'archived':return archived;default:return true}}
function folderLabel(f){return f?.name||'All'}
function renderFolderTabs(){const wrap=document.querySelector('.folder-tabs');if(!wrap)return;const built=[['all','All'],['personal','Personal'],['work','Work'],['groups','Groups'],['channels','Channels']];const custom=state.customFolders||[];wrap.innerHTML=built.map(([id,name])=>'<button class="folder-tab '+(state.folder===id?'active ':'')+'" data-folder="'+esc(id)+'">'+esc(name)+'</button>').join('')+custom.map(f=>'<button class="folder-tab custom-folder '+(state.folder===f.id?'active ':'')+'" data-folder="'+esc(f.id)+'">'+esc(f.name)+'</button>').join('')+'<button class="folder-edit" id="folderInfo" type="button" aria-label="Folder settings" title="Folder settings">⚙</button>';wrap.querySelectorAll('.folder-tab').forEach(x=>x.onclick=()=>{state.folder=x.dataset.folder||'all';renderFolderTabs();window.addEventListener('vexachat:folders-changed',()=>{state.customFolders=loadCustomFolders();renderFolderTabs();renderChats()});renderChats()});document.querySelector('#folderInfo')?.addEventListener('click',()=>window.VexaChatSettings?.open({state,api,modal,profile,accountSecurity,logout,notify,initials,esc},'folders'))}

function resetTokenFromUrl(){return new URLSearchParams(location.search).get('reset_token')||''}
function authCard(mode='login',message=''){
 AUTH_STATE.mode=mode;
 const titles={login:'Welcome back to VexaChat',register:'Create your VexaAccount',verify:'Verify your email',forgot:'Forgot your password?',reset:'Create a new password',twofa:'Security verification'};
 const subtitles={login:'Sign in with your VexaAccount — stay inside VexaChat.',register:'Create your VexaAccount and start messaging.',verify:'Enter the verification code sent to your email.',forgot:'Enter your email and we’ll help you get back in.',reset:'Choose a strong new password for your account.',twofa:'Complete the security check to finish signing in.'};
 let body='';
 if(mode==='login') body='<form id="authForm" class="auth-form"><div class="auth-field"><label for="authEmail">Email</label><input id="authEmail" type="email" inputmode="email" autocomplete="username" placeholder="you@example.com" required></div><div class="auth-field"><div class="auth-label-row"><label for="authPassword">Password</label><button type="button" class="auth-mini-link" id="forgotInline">Forgot password?</button></div><div class="auth-password"><input id="authPassword" type="password" autocomplete="current-password" placeholder="Enter your password" required><button type="button" class="password-toggle" data-target="authPassword" aria-label="Show password">Show</button></div></div><button class="primary auth-submit" type="submit">Sign in</button></form><div class="auth-divider"><span>or</span></div><button class="auth-alt" data-auth="register" type="button">Create a VexaAccount</button>';
 if(mode==='register') body='<form id="authForm" class="auth-form"><div class="auth-field"><label for="authName">Full name</label><input id="authName" autocomplete="name" placeholder="Your name" required></div><div class="auth-field"><label for="authEmail">Email</label><input id="authEmail" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" required></div><div class="auth-field"><label for="authPassword">Password</label><div class="auth-password"><input id="authPassword" type="password" autocomplete="new-password" minlength="8" placeholder="At least 8 characters" required><button type="button" class="password-toggle" data-target="authPassword">Show</button></div><div class="password-hint">Use at least 8 characters.</div></div><button class="primary auth-submit" type="submit">Create account</button></form><div class="auth-secondary-row">Already have an account? <button class="auth-mini-link" data-auth="login" type="button">Sign in</button></div>';
 if(mode==='verify') body='<form id="authForm" class="auth-form"><div class="auth-field"><label for="authEmail">Email</label><input id="authEmail" type="email" value="'+esc(AUTH_STATE.email)+'" readonly></div><div class="auth-field"><label for="authOtp">Verification code</label><input id="authOtp" class="auth-code" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="Enter code" required></div><button class="primary auth-submit" type="submit">Verify and open VexaChat</button></form><div class="auth-secondary-row"><button class="auth-mini-link" id="resendOtp" type="button">Resend verification code</button><span> · </span><button class="auth-mini-link" data-auth="login" type="button">Back to sign in</button></div>';
 if(mode==='forgot') body='<form id="authForm" class="auth-form"><div class="auth-field"><label for="authEmail">Email</label><input id="authEmail" type="email" inputmode="email" autocomplete="email" placeholder="you@example.com" required></div><button class="primary auth-submit" type="submit">Send reset link</button></form><div class="auth-secondary-row"><button class="auth-mini-link" data-auth="login" type="button">Back to sign in</button></div>';
 if(mode==='reset') body='<form id="authForm" class="auth-form"><input id="authResetToken" type="hidden" value="'+esc(resetTokenFromUrl())+'"><div class="auth-field"><label for="authPassword">New password</label><div class="auth-password"><input id="authPassword" type="password" autocomplete="new-password" minlength="8" placeholder="At least 8 characters" required><button type="button" class="password-toggle" data-target="authPassword">Show</button></div></div><div class="auth-field"><label for="authPasswordConfirm">Confirm password</label><input id="authPasswordConfirm" type="password" autocomplete="new-password" minlength="8" placeholder="Repeat your password" required></div><button class="primary auth-submit" type="submit">Reset password</button></form><div class="auth-secondary-row"><button class="auth-mini-link" data-auth="login" type="button">Back to sign in</button></div>';
 if(mode==='twofa') body='<form id="authForm" class="auth-form"><div class="auth-field"><label for="authOtp">Security code</label><input id="authOtp" inputmode="numeric" autocomplete="one-time-code" maxlength="8" placeholder="Enter security code" required></div><button class="primary auth-submit" type="submit">Verify and open VexaChat</button></form><div class="auth-secondary-row"><button class="auth-mini-link" data-auth="login" type="button">Cancel</button></div>';
 const msg=message?'<div class="auth-message" role="alert">'+esc(message)+'</div>':'';
 document.querySelector('#app').innerHTML='<main class="auth-gate"><div class="auth-layout"><section class="auth-brand-panel"><div class="auth-brand-mark">V</div><div class="auth-brand-name">VexaChat</div><p>Private messaging powered by your VexaAccount.</p><div class="auth-brand-points"><span>✓ Secure account access</span><span>✓ Messages, media & calls</span><span>✓ One identity across Vexa services</span></div></section><section class="auth-card" aria-labelledby="authTitle"><div class="auth-mobile-mark">V</div><div class="auth-card-top"><span class="auth-app-label">VexaChat</span><span class="auth-secure-label">Secure</span></div><h1 id="authTitle">'+titles[mode]+'</h1><p class="auth-subtitle">'+subtitles[mode]+'</p>'+msg+body+'<p class="auth-footer-note">Your sign-in is handled directly by the VexaAccount API. VexaChat stays in VexaChat after authentication.</p></section></div></main>';
 document.querySelectorAll('[data-auth]').forEach(x=>x.onclick=()=>authCard(x.dataset.auth));
 document.querySelector('#forgotInline')?.addEventListener('click',()=>authCard('forgot'));
 document.querySelectorAll('.password-toggle').forEach(btn=>btn.onclick=()=>{const input=document.getElementById(btn.dataset.target);if(!input)return;const show=input.type==='password';input.type=show?'text':'password';btn.textContent=show?'Hide':'Show';btn.setAttribute('aria-label',show?'Hide password':'Show password')});
 const code=document.querySelector('#authOtp');if(code)code.addEventListener('input',e=>{e.target.value=e.target.value.replace(/\\D/g,'').slice(0,8)});
 document.querySelector('#authForm')?.addEventListener('submit',handleAuthSubmit);
 document.querySelector('#resendOtp')?.addEventListener('click',resendVerification);
}
function authGate(message=''){authCard('login',message)}
async function handleAuthSubmit(e){
 e.preventDefault();
 const mode=AUTH_STATE.mode;
 try{
  let d;
  if(mode==='login'){
   const email=$('#authEmail').value.trim().toLowerCase(),password=$('#authPassword').value;
   AUTH_STATE.email=email;
   d=await api('/api/auth/login',{method:'POST',body:JSON.stringify({email,password})});
   if(d.requiresAuthenticator2fa){AUTH_STATE.userId=d.userId;AUTH_STATE.method='totp';return authCard('twofa','Enter your authenticator code.')}
   if(d.requiresEmail2fa){AUTH_STATE.userId=d.userId;AUTH_STATE.method='email';return authCard('verify','Enter the email security code.')}
   finishAuth(d);
  }else if(mode==='register'){
   const name=$('#authName').value.trim(),email=$('#authEmail').value.trim().toLowerCase(),password=$('#authPassword').value;
   AUTH_STATE.email=email;
   d=await api('/api/auth/register',{method:'POST',body:JSON.stringify({name,email,password})});
   if(d.success){return authCard('verify','Account created. Check your email for the verification code.')}
  }else if(mode==='verify'){
   const otp=$('#authOtp').value.trim();
   if(AUTH_STATE.userId&&AUTH_STATE.method==='email') d=await api('/api/auth/verify-email-2fa',{method:'POST',body:JSON.stringify({userId:AUTH_STATE.userId,email:AUTH_STATE.email,otp})});
   else d=await api('/api/auth/verify-otp',{method:'POST',body:JSON.stringify({email:AUTH_STATE.email,otp})});
   finishAuth(d);
  }else if(mode==='twofa'){
   d=await api('/api/auth/twofa/verify',{method:'POST',body:JSON.stringify({userId:AUTH_STATE.userId,token:$('#authOtp').value.trim()})});
   finishAuth(d);
  }else if(mode==='forgot'){
   d=await api('/api/auth/forgot-password',{method:'POST',body:JSON.stringify({email:$('#authEmail').value.trim().toLowerCase()})});
   authCard('login',d.message||'If the email is registered, a reset link has been sent.'); }else if(mode==='reset'){
   const p=$('#authPassword').value,pc=$('#authPasswordConfirm').value,t=$('#authResetToken').value;
   if(p!==pc) throw Error('Passwords do not match');
   d=await api('/api/auth/reset-password',{method:'POST',body:JSON.stringify({token:t,newPassword:p})});
   authCard('login',d.message||'Password reset successfully. Please sign in.');

  }
 }catch(err){if(mode==='login'&&Number(err.status)===403&&/verif/i.test(String(err.message||''))){authCard('verify','Your email is not verified yet. Enter the verification code, or resend it below.');return}authCard(mode,err.message||'Authentication failed. Please try again.')}
}
function finishAuth(d){if(d?.token)localStorage.setItem('vexaaccount_access_token',d.token);if(d?.user)state.me=d.user;AUTH_STATE.userId=d?.user?.id||AUTH_STATE.userId;shell();connectionStatus('Connected');Promise.allSettled([loadChats(),loadContacts(),loadCalls(),loadNotifications(),setPresence('online')]).then(()=>{state.active=null;renderActive();connectEvents()})}
async function resendVerification(){
 try{const endpoint=AUTH_STATE.method==='email'&&AUTH_STATE.userId?'/api/auth/resend-email-2fa':'/api/auth/resend-otp';const body=AUTH_STATE.method==='email'&&AUTH_STATE.userId?{userId:AUTH_STATE.userId,email:AUTH_STATE.email}:{email:AUTH_STATE.email};const d=await api(endpoint,{method:'POST',body:JSON.stringify(body)});notify(d.message||'Verification code sent');}
 catch(e){notify(e.message)}
}
const $=s=>document.querySelector(s);
const api=async(path,opt={})=>{const h=new Headers(opt.headers||{});h.set('Content-Type','application/json');const t=token();if(t)h.set('Authorization','Bearer '+t);const x=csrf();if(x)h.set('X-XSRF-TOKEN',decodeURIComponent(x));const r=await fetch(API+path,{...opt,headers:h,credentials:'include'});const d=await r.json().catch(()=>({success:false,message:'Invalid server response'}));if(r.status===401){localStorage.removeItem('vexaaccount_access_token');sessionStorage.removeItem('vexaaccount_access_token');state.events?.close();clearTimeout(state.eventsRetry);clearInterval(state.livePollTimer);state.events=null;authGate(d.message||'Your VexaAccount session has expired. Please sign in again.');throw Error('Sign-in required')}if(!r.ok||d.success===false){const err=Error(d.message||('Request failed ('+r.status+')'));err.status=r.status;throw err}return d};
const notify=m=>{const x=document.createElement('div');x.className='toast';x.textContent=m;document.body.appendChild(x);setTimeout(()=>x.remove(),3000)};
const initials=n=>String(n||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'?';
const time=v=>v?new Date(v).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'';
const nameOf=c=>c?.display_name||c?.title||'Conversation';
const avatarMarkup=(item,cls='avatar')=>{const url=item?.avatar_url||item?.picture||item?.avatar||'';const label=initials(item?.display_name||item?.name||item?.email||item?.title);return url?'<div class="'+cls+' avatar-image"><img src="'+esc(url)+'" alt="" loading="lazy"><span>'+esc(label)+'</span></div>':'<div class="'+cls+'">'+esc(label)+'</div>'};
function modal(title,body){document.querySelector('#modal')?.remove();const page=/(VexaChat Settings|Profile|Contacts|Calls|Account Security|Notifications|Privacy|Appearance|Chat Settings|Data & Storage|Language|Help|User & conversation details|Group details|Incoming (voice|video) call|Search messages|Edit message|Delete message|Emoji|React|Add to message|Forward message|New conversation|New direct chat|Create group)/i.test(String(title));const kind=page?'page':'dialog';const safeTitle=esc(title);const pageNav=page?'<nav class="page-top-nav" aria-label="VexaChat page navigation"><button type="button" data-page-nav="back" aria-label="Back">‹ <span>Back</span></button><strong>'+safeTitle+'</strong><button type="button" data-page-nav="menu" aria-label="Open navigation">☰</button></nav>':'';const bottomNav=page?'<nav class="page-bottom-nav" aria-label="VexaChat navigation"><button type="button" data-page-nav="chats"><span>▣</span><b>Chats</b></button><button type="button" data-page-nav="contacts"><span>♙</span><b>Contacts</b></button><button type="button" data-page-nav="calls"><span>☎</span><b>Calls</b></button><button type="button" data-page-nav="profile"><span>●</span><b>Profile</b></button><button type="button" data-page-nav="settings"><span>⚙</span><b>Settings</b></button></nav>':'';document.body.insertAdjacentHTML('beforeend','<div class="modal-back '+kind+'-overlay" id="modal" role="dialog" aria-modal="true" aria-label="'+safeTitle+'"><section class="modal '+kind+'-modal">'+pageNav+'<div class="modal-head">'+(page?'<button class="icon-btn modal-back-btn" id="backModal" type="button" aria-label="Back" title="Back">‹</button>':'')+'<h2>'+safeTitle+'</h2><button class="icon-btn" id="closeModal" aria-label="Close" title="Close">×</button></div>'+body+bottomNav+'</section></div>');const close=()=>$('#modal')?.remove();$('#closeModal').onclick=close;$('#backModal')?.addEventListener('click',()=>{const back=document.querySelector('#settingsBack');if(back)back.click();else close()});$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')close()});document.querySelectorAll('#modal [data-page-nav]').forEach(b=>b.onclick=()=>{const v=b.dataset.pageNav;if(v==='back'){close();return}if(v==='menu'){close();document.body.classList.add('nav-drawer-open');return}close();if(v==='chats'){showMobileList(v);return}if(v==='contacts'||v==='calls'){openAppSurface(v);return}if(v==='profile'){profile();return}if(v==='settings'){window.VexaChatSettings?.open({state,api,modal,profile,accountSecurity,logout,notify,initials,esc});return}});document.addEventListener('keydown',function escModal(e){if(e.key==='Escape'&&$('#modal')){close();document.removeEventListener('keydown',escModal)}})}
function showMobileList(view='chats'){document.body.classList.add('mobile-list-open');state.lastListView=view;sideView(view);window.scrollTo?.({top:0,behavior:'instant'})}
function showMobileChat(){document.body.classList.remove('mobile-list-open');window.scrollTo?.({top:0,behavior:'instant'});setTimeout(()=>$('#messageInput')?.focus(),80)}
function saveChatDraft(){if(!state.active)return;const input=$('#messageInput');if(!input)return;let drafts={};try{drafts=JSON.parse(localStorage.getItem('vexachat_drafts_v1')||'{}')}catch{}const key=String(state.active.id);const value=input.value||'';if(value.trim())drafts[key]=value;else delete drafts[key];try{localStorage.setItem('vexachat_drafts_v1',JSON.stringify(drafts))}catch{}}function restoreChatDraft(){const input=$('#messageInput');if(!input||!state.active)return;bindComposerInteractions();let drafts={};try{drafts=JSON.parse(localStorage.getItem('vexachat_drafts_v1')||'{}')}catch{}input.value=String(drafts[String(state.active.id)]||'');input.style.height='auto';input.style.height=Math.min(input.scrollHeight,130)+'px';updateComposerState()}function clearChatDraft(id){let drafts={};try{drafts=JSON.parse(localStorage.getItem('vexachat_drafts_v1')||'{}')}catch{}delete drafts[String(id)];try{localStorage.setItem('vexachat_drafts_v1',JSON.stringify(drafts))}catch{}}
function accountSecurity(){
 const m=state.me||{};
 modal('Account Security','<div class="settings-layout"><section class="settings-content"><div class="settings-heading"><h3>Account Security</h3><p>Protect the VexaAccount identity used by this VexaChat session.</p></div><div class="settings-card"><div class="settings-info-row"><b>Signed-in account</b><span>'+esc(m.email||'VexaAccount user')+'</span></div><div class="settings-info-row"><b>Session</b><span>Authenticated directly against the VexaAccount API. VexaChat does not redirect to the account dashboard.</span></div></div><div class="settings-card"><button class="settings-action" id="securityChangePassword"><b>Change password</b><span>Open the secure password recovery flow</span></button><button class="settings-action" id="securitySessions"><b>Active sessions</b><span>Session management is available when exposed by the backend</span></button></div></section></div>');
 $('#securityChangePassword').onclick=()=>{const email=m.email||'';$('#modal')?.remove();const old=AUTH_STATE.mode;AUTH_STATE.email=email;authCard('forgot');};
 $('#securitySessions').onclick=()=>notify('Remote session management is not exposed by the current VexaAccount API');
}
function shell(){state.customFolders=loadCustomFolders();document.querySelector('#app').innerHTML=`<div class="chat-shell">
<aside class="sidebar" aria-label="VexaChat navigation">
  <div class="side-head">
    <div class="logo"><img src="./icon.svg" alt="VexaChat"></div>
    <div class="brand">VexaChat<small id="connectionStatus">Connecting…</small></div>
    <button id="newChat" class="icon-btn" aria-label="New chat" title="New chat">＋</button>
    <button id="settingsTop" class="icon-btn" aria-label="Settings" title="Settings">⚙</button>
    <button id="profile" class="icon-btn" aria-label="Profile" title="Profile">●</button>
  </div>
  <div class="search"><span>⌕</span><input id="search" placeholder="Search chats and people" aria-label="Search chats and people"></div>
  <div class="folder-tabs" role="tablist" aria-label="Chat folders"></div>
  <div class="side-tabs" role="tablist" aria-label="Main sections">
    <button class="tab active" data-view="chats">Chats</button>
    <button class="tab" data-view="contacts">Contacts</button>
    <button class="tab" data-view="calls">Calls</button>
  </div>
  <div class="list-filters" role="tablist" aria-label="Chat filters">
    <button class="filter active" data-filter="all">All</button>
    <button class="filter" data-filter="unread">Unread</button>
    <button class="filter" data-filter="pinned">Pinned</button>
    <button class="filter" data-filter="muted">Muted</button>
    <button class="filter" data-filter="archived">Archived</button>
  </div>
  <div id="chatList" class="list" aria-live="polite"></div>
</aside>
<main class="main">
  <header class="chat-head">
    <button id="back" class="icon-btn mobile-only" aria-label="Back to chats">‹</button>
    <div class="avatar head-avatar" id="headAvatar"><img src="./icon.svg" alt="VexaChat"></div>
    <div class="title"><strong id="headName">VexaChat</strong><small id="headStatus">Choose a conversation</small></div>
    <div class="head-actions">
      <button id="voice" class="icon-btn" aria-label="Voice call" title="Voice call">☎</button>
      <button id="video" class="icon-btn" aria-label="Video call" title="Video call">▣</button>
      <button id="searchMessages" class="icon-btn" aria-label="Search messages" title="Search messages">⌕</button>
      <button id="info" class="icon-btn" aria-label="Conversation details" title="Conversation details">ⓘ</button>
      <button id="chatMenu" class="icon-btn" aria-label="Chat menu" title="Chat menu" disabled>⋮</button>
    </div>
  </header>
  <div id="conversationBanner" class="conversation-banner" hidden></div>
  <section id="messages" class="messages" aria-live="polite"><div class="empty"><strong>VexaChat</strong><span>Private conversations, groups, media and calls.</span></div></section>
  <form id="composer" class="composer" aria-label="Message composer">
    <button type="button" id="attach" class="icon-btn" aria-label="Attach media or file" title="Attach">＋</button>
    <textarea id="messageInput" rows="1" placeholder="Write a message…" aria-label="Write a message" disabled></textarea>
    <button type="button" id="emoji" class="icon-btn" aria-label="Emoji" title="Emoji">☺</button>
    <button type="button" id="recordVoice" class="icon-btn voice-note-btn" aria-label="Record voice message" title="Hold to record voice message">🎙</button>
    <button class="send" aria-label="Send message" title="Send" disabled>➤</button>
    <input id="file" type="file" hidden accept="image/*,video/*,audio/*,.pdf,.zip,.txt,.doc,.docx,.xls,.xlsx">
  </form>
</main>
</div>
<nav class="mobile-bar" aria-label="Mobile navigation">
  <button id="mobileChats" class="active"><span class="mobile-nav-icon">⌂</span><span>Chats</span></button>
  <button id="mobileNew"><span class="mobile-nav-icon">＋</span><span>New</span></button>
  <button id="mobileContacts"><span class="mobile-nav-icon">♙</span><span>Contacts</span></button>
  <button id="mobileCalls"><span class="mobile-nav-icon">☎</span><span>Calls</span></button>
  <button id="mobileProfile"><span class="mobile-nav-icon">●</span><span>Profile</span></button>
</nav>`;$('#composer').addEventListener('submit',send);updateComposerState();$('#search').oninput=e=>{state.query=e.target.value.trim().toLowerCase();if(state.view==='contacts')renderContacts();else if(state.view==='calls')renderCalls();else {renderChats();searchPeople(state.query)}};$('#search').onkeydown=e=>{if(e.key==='Escape'){e.target.value='';state.query='';clearTimeout(searchTimer);searchRequest++;renderChats();e.target.blur()}};$('#newChat').onclick=newChat;$('#mobileNew').onclick=newChat;$('#settingsTop').onclick=()=>window.VexaChatSettings?.open({state,api,modal,profile,accountSecurity,logout,notify,initials,esc});$('#profile').onclick=profile;$('#mobileProfile').onclick=profile;$('#back').onclick=()=>{state.active=null;renderActive();showMobileList(state.lastListView||'chats')};$('#info').onclick=conversationInfo;$('#searchMessages').onclick=messageSearch;$('#voice').onclick=()=>startCall('voice');$('#video').onclick=()=>startCall('video');$('#attach').onclick=attachmentMenu;$('#file').onchange=uploadFile;$('#emoji').onclick=emojiPicker;$('#messageInput').oninput=e=>{saveChatDraft();typing();updateComposerState()};$('#messageInput').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){let p={};try{p=JSON.parse(localStorage.getItem('vexachat_preferences_v1')||'{}')}catch{}if(p.enter_to_send!==false){e.preventDefault();$('#composer').requestSubmit()}}};document.querySelectorAll('.tab').forEach(x=>x.onclick=()=>sideView(x.dataset.view));renderFolderTabs();document.querySelectorAll('.filter').forEach(x=>x.onclick=()=>{state.chatFilter=x.dataset.filter||'all';document.querySelectorAll('.filter').forEach(b=>b.classList.toggle('active',b===x));state.view='chats';document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.view==='chats'));document.querySelectorAll('.mobile-bar button').forEach(b=>b.classList.remove('active'));$('#mobileChats')?.classList.add('active');renderChats()});$('#mobileContacts').onclick=()=>showMobileList('contacts');$('#mobileCalls').onclick=()=>showMobileList('calls');$('#mobileChats').onclick=()=>showMobileList('chats');bindTelegramInteractions()}

function activeChatMenu(){
 const c=state.active;if(!c)return;
 const id=Number(c.id),pinned=Number(c.pinned)===1,archived=Number(c.archived)===1,muted=isChatMuted(c);
 contextMenu([
  ['ⓘ','Conversation details',()=>conversationInfo()],
  ['🔕',muted?'Unmute notifications':'Mute notifications',async()=>{try{await api('/api/chat/conversations/'+id+'/settings',{method:'POST',body:JSON.stringify({muted_until:muted?null:new Date(Date.now()+86400000).toISOString()})});await loadChats();notify(muted?'Notifications unmuted':'Notifications muted')}catch(e){notify(e.message)}}],
  ['📌',pinned?'Unpin conversation':'Pin conversation',async()=>{try{await api('/api/chat/conversations/'+id+'/settings',{method:'POST',body:JSON.stringify({pinned:!pinned})});await loadChats()}catch(e){notify(e.message)}}],
  ['📦',archived?'Unarchive conversation':'Archive conversation',async()=>{try{await api('/api/chat/conversations/'+id+'/settings',{method:'POST',body:JSON.stringify({archived:!archived})});if(archived)await loadChats();else{state.active=null;renderActive();await loadChats()}notify(archived?'Conversation restored':'Conversation archived')}catch(e){notify(e.message)}}],
  ['⌕','Search messages',()=>messageSearch()]
 ],Math.max(8,innerWidth-250),64);
}
function syncMobileViewport(){
 const vv=window.visualViewport;
 const root=document.documentElement;
 const h=vv?.height||window.innerHeight;
 const top=vv?.offsetTop||0;
 root.style.setProperty('--vexa-viewport-height',Math.round(h)+'px');
 root.style.setProperty('--vexa-viewport-top',Math.round(top)+'px');
 const input=document.querySelector('#messageInput');
 const keyboardOpen=!!(vv&&window.innerHeight-vv.height>120&&document.activeElement===input);
 document.body.classList.toggle('vexa-keyboard-open',keyboardOpen);
 if(keyboardOpen){
  requestAnimationFrame(()=>{
   const main=document.querySelector('.main');
   if(main)main.scrollTop=0;
  });
 }
}
function bindMobileKeyboardViewport(){
 syncMobileViewport();
 const vv=window.visualViewport;
 vv?.addEventListener('resize',syncMobileViewport,{passive:true});
 vv?.addEventListener('scroll',syncMobileViewport,{passive:true});
 window.addEventListener('resize',syncMobileViewport,{passive:true});
 document.addEventListener('focusin',e=>{if(e.target?.id==='messageInput')setTimeout(syncMobileViewport,50)},{passive:true});
 document.addEventListener('focusout',e=>{if(e.target?.id==='messageInput')setTimeout(syncMobileViewport,120)},{passive:true});
}
function bindTelegramInteractions(){
 bindVoiceRecorder();
 bindMobileKeyboardViewport();
 const chatMenu=$('#chatMenu');if(chatMenu&&!chatMenu.dataset.bound){chatMenu.dataset.bound='1';chatMenu.addEventListener('click',activeChatMenu)}
 // Telegram/WhatsApp-style mobile navigation: swipe from the left edge or tap the chat identity to return/open details.
 const main=$('.main'), chatHead=$('.chat-head');
 const syncChatMenu=()=>{const b=$('#chatMenu');if(b)b.disabled=!state.active};
 syncChatMenu();
 let navTouchX=0, navTouchY=0;
 main?.addEventListener('touchstart',e=>{
  const t=e.touches?.[0]; if(!t)return;
  navTouchX=t.clientX; navTouchY=t.clientY;
 },{passive:true});
 main?.addEventListener('touchend',e=>{
  const t=e.changedTouches?.[0]; if(!t)return;
  const dx=t.clientX-navTouchX, dy=Math.abs(t.clientY-navTouchY);
  if(window.matchMedia('(max-width:760px)').matches && state.active && navTouchX<34 && dx>88 && dy<80){
   state.active=null; renderActive(); showMobileList(state.lastListView||'chats');
  }
 },{passive:true});
 chatHead?.addEventListener('click',e=>{
  if(!state.active || e.target.closest('button'))return;
  conversationInfo();
 });

 const list=$('#chatList'), input=$('#messageInput'), messages=$('#messages');
 if(!list||!input||!messages)return;
 // Long-press a conversation to expose its existing action sheet, matching mobile messenger behavior.
 let pressTimer=null;
 list.addEventListener('touchstart',e=>{
  const row=e.target.closest('.chat-row'); if(!row)return;
  pressTimer=setTimeout(()=>{pressTimer=null;row.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true}))},520);
 },{passive:true});
 ['touchend','touchmove','touchcancel'].forEach(type=>list.addEventListener(type,()=>{if(pressTimer){clearTimeout(pressTimer);pressTimer=null}},{passive:true}));
 // Desktop context-click and mobile long-press are handled by the unified handlers below.
 // Mobile messenger gesture: swipe a conversation left to archive it.
 let rowSwipe=null,rowSwipeStartX=0,rowSwipeStartY=0,rowSwipeMoved=false;
 const resetRowSwipe=()=>{if(rowSwipe){rowSwipe.style.transform='';rowSwipe.classList.remove('swipe-archive-ready')}rowSwipe=null;rowSwipeMoved=false};
 list.addEventListener('touchstart',e=>{
  const row=e.target.closest('.chat-row');if(!row)return;
  const t=e.touches?.[0];if(!t)return;
  rowSwipe=row;rowSwipeStartX=t.clientX;rowSwipeStartY=t.clientY;rowSwipeMoved=false;
 },{passive:true});
 list.addEventListener('touchmove',e=>{
  if(!rowSwipe)return;
  const t=e.touches?.[0];if(!t)return;
  const dx=t.clientX-rowSwipeStartX,dy=t.clientY-rowSwipeStartY;
  if(Math.abs(dx)>8||Math.abs(dy)>8)rowSwipeMoved=true;
  if(Math.abs(dx)>Math.abs(dy)&&dx<0&&Math.abs(dx)<118){
   rowSwipe.style.transform='translateX('+Math.max(-86,dx*.7)+'px)';
   rowSwipe.classList.toggle('swipe-archive-ready',dx<-55);
  }else if(Math.abs(dy)>Math.abs(dx)) resetRowSwipe();
 },{passive:true});
 list.addEventListener('touchend',async e=>{
  if(!rowSwipe)return;
  const row=rowSwipe,t=e.changedTouches?.[0],dx=t?t.clientX-rowSwipeStartX:0,dy=t?Math.abs(t.clientY-rowSwipeStartY):0;
  if(window.matchMedia('(max-width:760px)').matches&&rowSwipeMoved&&dx<-62&&dy<55){
   const id=Number(row.dataset.id),chat=state.chats.find(x=>Number(x.id)===id);
   resetRowSwipe();
   if(chat)try{await api('/api/chat/conversations/'+id+'/settings',{method:'POST',body:JSON.stringify({archived:true})});if(state.active?.id===id){state.active=null;renderActive()}await loadChats();notify('Conversation archived')}catch(err){notify(err.message)}
  }else resetRowSwipe();
 },{passive:true});
 const resize=()=>{input.style.height='auto';input.style.height=Math.min(input.scrollHeight,130)+'px'};
 input.addEventListener('input',resize);resize();
 ['dragenter','dragover'].forEach(ev=>messages.addEventListener(ev,e=>{e.preventDefault();messages.classList.add('drop-target')}));
 ['dragleave','drop'].forEach(ev=>messages.addEventListener(ev,e=>{e.preventDefault();if(ev==='dragleave'&&!messages.contains(e.relatedTarget))messages.classList.remove('drop-target');if(ev==='drop'){messages.classList.remove('drop-target');const files=[...(e.dataTransfer?.files||[])];if(files[0]){const dt=new DataTransfer();dt.items.add(files[0]);const file=$('#file');if(file){file.files=dt.files;file.dispatchEvent(new Event('change',{bubbles:true}))}}}}));
 document.addEventListener('keydown',e=>{
  if(e.key==='Escape'){
   if($('#modal')){$('#modal').remove();return}
   if(state.active&&window.matchMedia('(max-width:760px)').matches){state.active=null;renderActive();showMobileList(state.lastListView||'chats');return}
   if(document.activeElement===input){input.value='';updateComposerState();input.blur()}
  }
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#search')?.focus();$('#search')?.select()}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='f'&&state.active){e.preventDefault();messageSearch()}
  if(e.altKey&&e.key==='ArrowLeft'&&state.active&&window.matchMedia('(max-width:760px)').matches){e.preventDefault();state.active=null;renderActive();showMobileList(state.lastListView||'chats')}
 });
 let touchX=0,touchY=0,longPressTimer=null,longPressTarget=null,suppressNextClick=false;
 const cancelLongPress=()=>{clearTimeout(longPressTimer);longPressTimer=null;longPressTarget=null};
 const suppressClickOnce=()=>{suppressNextClick=true;setTimeout(()=>{suppressNextClick=false},450)};
 document.addEventListener('click',e=>{if(!suppressNextClick)return;suppressNextClick=false;e.preventDefault();e.stopPropagation()},true);
 messages.addEventListener('touchstart',e=>{const t=e.touches?.[0];if(!t)return;touchX=t.clientX;touchY=t.clientY;longPressTarget=null;cancelLongPress();const bubble=e.target.closest('[data-message-id]');if(bubble){longPressTarget=bubble;longPressTimer=setTimeout(()=>{const id=Number(bubble.dataset.messageId),m=state.messages.find(x=>Number(x.id)===id);if(m){suppressClickOnce();messageQuickMenu(m,t.clientX,t.clientY)}cancelLongPress()},520)}},{passive:true});
messages.addEventListener('touchmove',e=>{const t=e.touches?.[0];if(!t)return;const bubble=longPressTarget;if(bubble&&Math.abs(t.clientX-touchX)>10){cancelLongPress();bubble.classList.add('swipe-active');bubble.style.transform='translateX('+Math.max(-18,Math.min(72,t.clientX-touchX))+'px)'}},{passive:true});
messages.addEventListener('touchcancel',()=>{if(longPressTarget){longPressTarget.classList.remove('swipe-active');longPressTarget.style.transform=''}cancelLongPress()},{passive:true});
messages.addEventListener('touchend',e=>{const t=e.changedTouches?.[0];if(!t)return;const bubble=longPressTarget;const dx=t.clientX-touchX,dy=Math.abs(t.clientY-touchY);if(bubble){bubble.classList.remove('swipe-active');bubble.style.transform='';if(window.matchMedia('(max-width:760px)').matches&&dx>62&&dy<70){const id=Number(bubble.dataset.messageId);cancelLongPress();suppressClickOnce();replyTo(id);return}}cancelLongPress()},{passive:true});
list.addEventListener('touchstart',e=>{const row=e.target.closest('[data-id]');if(!row)return;const t=e.touches?.[0];if(!t)return;cancelLongPress();longPressTarget=row;longPressTimer=setTimeout(()=>{const id=Number(row.dataset.id),chat=state.chats.find(x=>Number(x.id)===id);if(chat){suppressClickOnce();chatQuickMenu(chat,t.clientX,t.clientY)}cancelLongPress()},520)},{passive:true});
 list.addEventListener('touchmove',cancelLongPress,{passive:true});
 list.addEventListener('touchcancel',cancelLongPress,{passive:true});
 list.addEventListener('touchend',cancelLongPress,{passive:true});
 list.addEventListener('contextmenu',e=>{
  const row=e.target.closest('[data-id]');if(!row)return;e.preventDefault();
  const id=Number(row.dataset.id),chat=state.chats.find(x=>Number(x.id)===id);if(!chat)return;
  chatQuickMenu(chat,e.clientX,e.clientY);
 });
 messages.addEventListener('contextmenu',e=>{
  const bubble=e.target.closest('[data-message-id]');if(!bubble)return;e.preventDefault();
  const id=Number(bubble.dataset.messageId),m=state.messages.find(x=>Number(x.id)===id);if(!m)return;
  messageQuickMenu(m,e.clientX,e.clientY);
 });
 messages.addEventListener('scroll',()=>{const el=$('#messages');if(!el)return;const nearBottom=el.scrollHeight-el.scrollTop-el.clientHeight<180;if(nearBottom)$('#jumpLatest')?.remove();if(el.scrollTop<120&&!state.loadingOlderMessages)loadOlderMessages()},{passive:true});
messages.addEventListener('dblclick',e=>{
  const bubble=e.target.closest('[data-message-id]');if(!bubble)return;
  const m=state.messages.find(x=>Number(x.id)===Number(bubble.dataset.messageId));if(!m||m.deleted_at)return;
  const current=(state.reactions[m.id]||[]).find(r=>Number(r.user_id)===Number(state.me?.id));
  const emoji=current?.emoji||'❤️';
  api('/api/chat/reactions',{method:current?'DELETE':'POST',body:JSON.stringify({message_id:m.id,emoji})}).then(()=>loadReactions(m.id)).catch(()=>notify('Reaction unavailable'));
 });
}
function closeContextMenu(){document.querySelector('#vcContextMenu')?.remove()}
function contextMenu(items,x,y){
 closeContextMenu();
 const menu=document.createElement('div');menu.id='vcContextMenu';menu.className='vc-context-menu';
 menu.innerHTML=items.map((i,n)=>i==='-'?'<div class="vc-context-sep"></div>':'<button type="button" data-cm="'+n+'"><span>'+esc(i[0])+'</span><b>'+esc(i[1])+'</b></button>').join('');
 document.body.appendChild(menu);
 const w=menu.offsetWidth,h=menu.offsetHeight;
 menu.style.left=Math.max(8,Math.min(x,innerWidth-w-8))+'px';menu.style.top=Math.max(8,Math.min(y,innerHeight-h-8))+'px';
 menu.querySelectorAll('[data-cm]').forEach(btn=>btn.onclick=()=>{const i=items[Number(btn.dataset.cm)];if(i&&i[2])i[2]();closeContextMenu()});
 setTimeout(()=>document.addEventListener('pointerdown',closeContextMenu,{once:true}),0);
}
function chatQuickMenu(chat,x,y){
 const id=Number(chat.id),pinned=Number(chat.pinned)===1,archived=Number(chat.archived)===1,muted=isChatMuted(chat);
 contextMenu([
  ['💬','Open',()=>openChat(id)],
  ['📌',pinned?'Unpin':'Pin',async()=>{try{await api('/api/chat/conversations/'+id+'/settings',{method:'POST',body:JSON.stringify({pinned:!pinned})});await loadChats()}catch(e){notify(e.message)}}],
  ['🔕',muted?'Unmute':'Mute',async()=>{try{await api('/api/chat/conversations/'+id+'/settings',{method:'POST',body:JSON.stringify({muted_until:muted?null:new Date(Date.now()+86400000).toISOString()})});await loadChats();notify(muted?'Notifications unmuted':'Notifications muted for 24 hours')}catch(e){notify(e.message)}}],
  ['📦',archived?'Unarchive':'Archive',async()=>{try{await api('/api/chat/conversations/'+id+'/settings',{method:'POST',body:JSON.stringify({archived:!archived})});if(state.active?.id===id&&!archived){state.active=null;renderActive();showMobileList('chats')}await loadChats();notify(archived?'Conversation restored':'Conversation archived')}catch(e){notify(e.message)}}],
  '-',
  ['ⓘ','Details',async()=>{if(state.active?.id!==id)await openChat(id);conversationInfo()}]
 ],x,y);
}
function messageQuickMenu(m,x,y){
 const id=Number(m.id),mine=Number(m.sender_id)===Number(state.me?.id),deleted=!!m.deleted_at;
 const items=[['↩','Reply',()=>replyTo(id)],['↗','Forward',()=>forwardMessage(m)],['😊','React',()=>reactionPicker(id)],['📋','Copy',()=>navigator.clipboard?.writeText(m.body||'').then(()=>notify('Message copied')).catch(()=>notify('Copy unavailable'))]];
 if(mine&&!deleted&&String(m.message_type||'text')==='text')items.push(['✎','Edit',()=>editMessage(id)]);
 if((mine||state.groupRole==='owner'||state.groupRole==='admin')&&!deleted)items.push(['🗑','Delete',()=>deleteMessage(id)]);
 contextMenu(items,x,y);
}
async function forwardMessage(m){if(!m||m.deleted_at||!String(m.body||'').trim())return notify('Only non-deleted text messages can be forwarded');const chats=state.chats.filter(c=>Number(c.id)!==Number(state.active?.id));if(!chats.length)return notify('No other conversations available');modal('Forward message','<div class="forward-preview"><small>Forwarding</small><div>'+esc(m.body)+'</div></div><div class="result-list" id="forwardTargets">'+chats.map(c=>'<button class="result" data-forward="'+c.id+'">'+avatarMarkup(c,'avatar')+'<span>'+esc(nameOf(c))+'<small>'+esc(c.conversation_type==='group'?'Group':'Private chat')+'</small></span></button>').join('')+'</div>');document.querySelectorAll('[data-forward]').forEach(b=>b.onclick=async()=>{try{b.disabled=true;await api('/api/chat/conversations/'+Number(b.dataset.forward)+'/messages',{method:'POST',body:JSON.stringify({body:String(m.body),message_type:'text',client_message_id:crypto.randomUUID(),metadata:{forwarded:true,forwarded_from_message_id:Number(m.id),forwarded_from_conversation_id:Number(m.conversation_id)}})});$('#modal')?.remove();await loadChats();notify('Message forwarded')}catch(e){b.disabled=false;notify(e.message)}})}const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function connectionStatus(message){const el=$('#connectionStatus');if(el)el.textContent=message}
async function boot(){
 try{
  if(!token()&&resetTokenFromUrl()){authCard('reset');return}
  if(!token()){authGate();return}
  shell(); connectionStatus('Connecting…');
  const controller=new AbortController(); const watchdog=setTimeout(()=>controller.abort(),12000);
  let data;
  try{
   const h=new Headers({'Content-Type':'application/json'}); const t=token(); if(t)h.set('Authorization','Bearer '+t);
   const x=csrf(); if(x)h.set('X-XSRF-TOKEN',decodeURIComponent(x));
   const res=await fetch(API+'/api/chat/me',{headers:h,credentials:'include',signal:controller.signal});
   data=await res.json().catch(()=>({}));
   if(res.status===401){localStorage.removeItem('vexaaccount_access_token');sessionStorage.removeItem('vexaaccount_access_token');authGate(data.message||'Please sign in again.');return}
   if(!res.ok||data.success===false)throw Error(data.message||('Server returned '+res.status));
  }finally{clearTimeout(watchdog)}
  state.me=data.user; connectionStatus('Connected');
  await Promise.allSettled([loadChats(),loadContacts(),loadCalls(),loadNotifications(),setPresence('online')]);
  state.active=null; renderActive(); connectEvents();
 }catch(e){
  console.error('[VexaChat boot]',e);
  const message=e?.name==='AbortError'?'Connection timed out.':'Unable to start VexaChat.';
  connectionStatus(message+' Tap to retry');
  const el=$('#connectionStatus'); if(el){el.style.cursor='pointer';el.title='Retry VexaChat';el.onclick=()=>{el.onclick=null;boot()}}
  const app=$('#app'); if(app&&!app.querySelector('.boot-error')){const d=document.createElement('div');d.className='boot-error';d.innerHTML='<strong>VexaChat could not start</strong><span>'+esc(e?.message||message)+'</span><button type="button">Retry</button>';d.querySelector('button').onclick=()=>{d.remove();boot()};app.appendChild(d)}
 }
}
async function loadChats(){const activeId=state.active?.id;state.chats=(await api('/api/chat/conversations')).conversations||[];if(activeId!=null){const fresh=state.chats.find(x=>+x.id===+activeId);if(fresh)state.active=Object.assign(state.active||{},fresh)}renderChats();if(state.active)renderActive()}
async function loadContacts(){state.contacts=(await api('/api/chat/contacts')).contacts||[]}
async function loadCalls(){state.calls=(await api('/api/chat/calls?limit=50')).calls||[]}
async function loadNotifications(){state.settings=(await api('/api/chat/notifications/settings')).settings}
let presenceOfflineSent=false;
async function setPresence(status){try{await api('/api/chat/presence',{method:'POST',body:JSON.stringify({status}),keepalive:status==='offline'})}catch{}}
function markPresenceOffline(){if(presenceOfflineSent||!token()||!API)return;presenceOfflineSent=true;setPresence('offline').catch(()=>{})}
function sideView(v){state.view=v;if(v==='chats'||v==='contacts'||v==='calls'){state.lastListView=v;if(v!=='chats'){state.chatFilter='all';document.querySelectorAll('.filter').forEach(b=>b.classList.toggle('active',b.dataset.filter==='all'))}}document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.view===v));document.querySelectorAll('.mobile-bar button').forEach(x=>x.classList.remove('active'));const mb={chats:'#mobileChats',contacts:'#mobileContacts',calls:'#mobileCalls'}[v];if(mb)$(mb)?.classList.add('active');const filters=document.querySelector('.list-filters');if(filters)filters.style.display=v==='chats'?'flex':'none';v==='contacts'?renderContacts():v==='calls'?renderCalls():renderChats()}
let searchTimer=null,searchRequest=0;
async function searchPeople(q){
 const el=$('#chatList'); if(!el||state.view!=='chats')return;
 clearTimeout(searchTimer);
 if(!q){return}
 searchTimer=setTimeout(async()=>{
  const request=++searchRequest;
  try{
   const d=await api('/api/chat/users?q='+encodeURIComponent(q));
   if(request!==searchRequest||state.query!==q||state.view!=='chats')return;
   const people=(d.users||[]).filter(u=>Number(u.id)!==Number(state.me?.id)).slice(0,20);
   const conversations=state.chats.filter(c=>nameOf(c).toLowerCase().includes(q)||(c.last_message||'').toLowerCase().includes(q)).slice(0,20);
   const seen=new Set();
   const conversationHtml=conversations.map(c=>{seen.add('c'+c.id);return '<button class="chat-row search-result-row" data-search-chat="'+c.id+'"><div class="avatar">'+esc(initials(nameOf(c)))+'</div><div class="row-main"><div class="row-name">'+esc(nameOf(c))+'</div><div class="row-preview">'+esc(c.last_message||'Conversation')+'</div></div><div class="row-meta">Chat</div></button>'}).join('');
   const peopleHtml=people.map(u=>'<button class="chat-row search-result-row" data-search-user="'+u.id+'"><div class="avatar">'+esc(initials(u.name||u.email))+'</div><div class="row-main"><div class="row-name">'+esc(u.name||u.email)+'</div><div class="row-preview">'+esc(u.email||'VexaAccount user')+'</div></div><div class="row-meta">'+esc(u.status||'offline')+'</div></button>').join('');
   const html='<div class="section-title">Search results</div>'+conversationHtml+(peopleHtml?'<div class="section-title">People</div>'+peopleHtml:''); el.innerHTML=(conversationHtml||peopleHtml)?html:'<div class="side-empty">No results found.</div>';
   el.querySelectorAll('[data-search-chat]').forEach(b=>b.onclick=()=>openChat(Number(b.dataset.searchChat)));
   el.querySelectorAll('[data-search-user]').forEach(b=>b.onclick=()=>openContact(Number(b.dataset.searchUser)));
  }catch(e){if(request===searchRequest)el.innerHTML='<div class="side-empty">Search unavailable.</div>'}
 },180);
}
function isChatMuted(c){return !!c?.muted_until&&new Date(c.muted_until).getTime()>Date.now()}
function notificationsAllowed(){return state.settings?.messages_enabled!==0&&state.settings?.messages_enabled!==false}
function getChatDraft(id){let drafts={};try{drafts=JSON.parse(localStorage.getItem('vexachat_drafts_v1')||'{}')}catch{}return String(drafts[String(id)]||'').trim()}
function updateChatFilterCounts(){const fs=document.querySelector('.list-filters');if(!fs)return;const active=state.chats.filter(c=>Number(c.archived)!==1);const counts={all:active.length,unread:active.filter(c=>(Number(c.unread_count)||0)>0).length,pinned:active.filter(c=>Number(c.pinned)===1).length,muted:active.filter(c=>isChatMuted(c)).length,archived:state.chats.filter(c=>Number(c.archived)===1).length};fs.querySelectorAll('.filter').forEach(b=>{const n=counts[b.dataset.filter]??0;const labels={all:'All',unread:'Unread',pinned:'Pinned',muted:'Muted',archived:'Archived'};b.textContent=labels[b.dataset.filter]+' · '+n;b.setAttribute('aria-label',labels[b.dataset.filter]+' '+n)});}
function renderChats(){updateChatFilterCounts();const el=$('#chatList');let list=state.chats.filter(c=>{const archived=Number(c.archived)===1,pinned=Number(c.pinned)===1,unread=(Number(c.unread_count)||0)>0,muted=isChatMuted(c);switch(state.chatFilter){case 'archived':return archived;case 'pinned':return pinned&&!archived;case 'unread':return unread&&!archived;case 'muted':return muted&&!archived;default:return !archived}});const custom=(state.customFolders||[]).find(f=>f.id===state.folder);if(custom)list=list.filter(c=>folderMatches(c,custom));else {if(state.folder==='personal')list=list.filter(c=>c.conversation_type==='direct');if(state.folder==='work'||state.folder==='groups')list=list.filter(c=>c.conversation_type==='group');if(state.folder==='channels'){el.innerHTML='<div class="folder-empty"><strong>Channels</strong><span>Channel conversations are not enabled in the current VexaChat API.</span></div>';return}}list=list.filter(c=>!state.query||nameOf(c).toLowerCase().includes(state.query)||(c.last_message||'').toLowerCase().includes(state.query));list.sort((a,b)=>Number(b.pinned)-Number(a.pinned)||new Date(b.last_message_at||b.updated_at||0)-new Date(a.last_message_at||a.updated_at||0));el.innerHTML=list.map(c=>{const muted=isChatMuted(c),pinned=Number(c.pinned)===1,unread=Number(c.unread_count)||0,isGroup=c.conversation_type==='group';const draft=getChatDraft(c.id);const preview=draft||c.last_message||'No messages yet';const kind=isGroup?'Group': 'Private';return '<button class="chat-row '+(state.active?.id===c.id?'active ':'')+(unread?'has-unread ':'')+'" data-id="'+c.id+'" aria-label="Open '+esc(nameOf(c))+'">'+avatarMarkup(c)+'<div class="row-main"><div class="row-name"><span class="row-name-text">'+esc(nameOf(c))+'</span>'+(pinned?'<span class="row-icon" title="Pinned">📌</span>':'')+(muted?'<span class="row-icon" title="Notifications muted">🔕</span>':'')+'</div><div class="row-preview"><span class="row-kind">'+esc(kind)+'</span><span class="row-preview-text '+(draft?'draft-preview':'')+'">'+(draft?'<b>Draft:</b> ':'')+esc(preview)+'</span></div></div><div class="row-meta"><time>'+esc(time(c.last_message_at))+'</time>'+(unread?'<div class="badge '+(muted?'muted-badge':'')+'">'+(unread>99?'99+':unread)+'</div>':'')+'</div></button>'}).join('')||'<div class="side-empty"><strong>No conversations yet</strong><span>Start a new chat to begin.</span></div>';el.querySelectorAll('[data-id]').forEach(x=>x.onclick=()=>openChat(Number(x.dataset.id)))}
function renderContacts(){const el=$('#chatList');if(!el)return;const q=state.query;const list=state.contacts.filter(c=>!q||String(c.name||'').toLowerCase().includes(q)||String(c.email||'').toLowerCase().includes(q)||String(c.status||'').toLowerCase().includes(q));const toolbar='<div class="contact-toolbar"><button class="primary contact-add" id="addContactFromList">＋ Add contact</button><span>'+list.length+' contact'+(list.length===1?'':'s')+'</span></div>';const rows=list.map(c=>'<button class="chat-row contact-row" data-contact="'+c.user_id+'">'+avatarMarkup(c)+'<div class="row-main"><div class="row-name"><span class="row-name-text">'+esc(c.name||c.email||'Contact')+'</span></div><div class="row-preview"><span class="row-kind">Contact</span><span class="row-preview-text">'+esc(c.email||'VexaAccount contact')+' · '+esc(c.status||'offline')+'</span></div></div><div class="row-meta">›</div></button>').join('');el.innerHTML=toolbar+(rows||'<div class="side-empty"><strong>No contacts found</strong><span>Try another name or email, or add a new contact.</span></div>');$('#addContactFromList')?.addEventListener('click',addContactModal);el.querySelectorAll('[data-contact]').forEach(x=>x.onclick=()=>contactDetails(Number(x.dataset.contact)))}
function callStatusLabel(c){const s=String(c.status||'').toLowerCase();if(s==='missed')return 'Missed';if(s==='declined')return 'Declined';if(s==='ended')return 'Completed';if(s==='active')return 'In progress';if(s==='ringing')return 'Ringing';return s||'Call'}
function callDuration(c){if(!c.started_at||!c.ended_at)return '';const sec=Math.max(0,Math.floor((new Date(c.ended_at)-new Date(c.started_at))/1000));if(sec<60)return sec+'s';return Math.floor(sec/60)+'m '+(sec%60)+'s'}
function callDate(v){if(!v)return '';const d=new Date(v),now=new Date();return d.toDateString()===now.toDateString()?time(v):d.toLocaleDateString([], {month:'short',day:'numeric'})}
function renderCalls(){const el=$('#chatList');const calls=[...state.calls].sort((a,b)=>new Date(b.started_at||0)-new Date(a.started_at||0));const rows=calls.map(c=>{const outgoing=Number(c.caller_id)===Number(state.me?.id);const missed=String(c.status)==='missed';const who=outgoing?(c.peer_name||c.conversation_title||'Contact'):(c.caller_name||c.caller_email||'Contact');const person=outgoing?{name:c.peer_name||c.peer_email,avatar_url:c.peer_avatar}:{name:c.caller_name||c.caller_email,avatar_url:c.caller_avatar};const arrow=outgoing?'↗':'↙';return '<div class="call-history-row '+(missed?'missed':'')+'" data-call-conversation="'+Number(c.conversation_id)+'">'+avatarMarkup(person,'avatar call-avatar')+'<div class="row-main"><div class="row-name">'+esc(who)+'</div><div class="row-preview"><span class="call-direction">'+arrow+'</span> '+esc(c.call_type==='video'?'Video call':'Voice call')+' · '+esc(callStatusLabel(c))+(callDuration(c)?' · '+esc(callDuration(c)):'')+'</div></div><div class="row-meta">'+esc(callDate(c.started_at))+'<button class="call-redial" data-redial="'+esc(c.conversation_id)+'" title="Call again" aria-label="Call again">↗</button></div></div>'}).join('');el.innerHTML=calls.length?'<div class="call-history-head"><div><strong>Recent calls</strong><small>'+calls.length+' call'+(calls.length===1?'':'s')+'</small></div></div>'+rows:'<div class="side-empty"><strong>No calls yet</strong><span>Your voice and video call history will appear here.</span></div>';el.querySelectorAll('[data-call-conversation]').forEach(x=>x.onclick=()=>openChat(Number(x.dataset.callConversation)));el.querySelectorAll('[data-redial]').forEach(x=>x.onclick=e=>{e.stopPropagation();openChat(Number(x.dataset.redial)).then(()=>startCall(calls.find(v=>Number(v.conversation_id)===Number(x.dataset.redial))?.call_type==='video'?'video':'voice'))})}
async function openContact(id){try{const d=await api('/api/chat/conversations/direct',{method:'POST',body:JSON.stringify({user_id:id})});await loadChats();openChat(d.conversation_id)}catch(e){if(Number(e.status)===403){try{const s=await api('/api/chat/blocks/'+Number(id)+'/status');if(s.blocked_by_me){modal('Unblock to start chat','<div class="confirm-card"><div class="confirm-icon">✓</div><strong>This contact is currently blocked.</strong><p>Unblock this user to start the conversation and exchange messages.</p><div class="modal-actions"><button class="secondary" id="unblockCancel">Cancel</button><button class="primary" id="unblockAndChat">Unblock & start chat</button></div></div>');$('#unblockCancel').onclick=()=>$('#modal')?.remove();$('#unblockAndChat').onclick=async()=>{try{const b=$('#unblockAndChat');b.disabled=true;await api('/api/chat/blocks/'+Number(id),{method:'DELETE'});$('#modal')?.remove();notify('User unblocked');await openContact(id)}catch(err){notify(err.message);$('#unblockAndChat')?.removeAttribute('disabled')}};return}if(s.blocked_by_other){notify('This contact has blocked your account. You cannot start a chat until they unblock you.');return}}catch{}}notify(e.message)}}
function addContactModal(){modal('Add contact','<input id="contactSearch" class="modal-input" placeholder="Search name or email" autocomplete="off"><div id="contactResults" class="result-list"><div class="hint">Search your VexaAccount contacts by name or email.</div></div>');const input=$('#contactSearch'),out=$('#contactResults');let timer=null;input.oninput=()=>{clearTimeout(timer);const q=input.value.trim();if(!q){out.innerHTML='<div class="hint">Search your VexaAccount contacts by name or email.</div>';return}timer=setTimeout(async()=>{try{const d=await api('/api/chat/users?q='+encodeURIComponent(q));const users=(d.users||[]).filter(u=>Number(u.id)!==Number(state.me.id));out.innerHTML=users.map(u=>'<button class="result" data-add-user="'+u.id+'"><span class="avatar">'+esc(initials(u.name||u.email))+'</span><span>'+esc(u.name||u.email)+'<small>'+esc(u.email||'VexaAccount user')+'</small></span></button>').join('')||'<div class="hint">No users found.</div>';out.querySelectorAll('[data-add-user]').forEach(b=>b.onclick=()=>saveContact(Number(b.dataset.addUser),b.textContent.trim()))}catch(e){out.innerHTML='<div class="hint">Search unavailable.</div>'}},180)};input.focus()}
function contactNameModal(title,initial,done){modal(title,'<div class="contact-name-form"><label class="modal-label">Contact name <span>optional</span></label><input id="contactNameInput" class="modal-input" maxlength="80" value="'+esc(initial||'')+'" placeholder="Enter a name"><div class="modal-actions"><button class="secondary" id="nameCancel">Cancel</button><button class="primary" id="nameSave">Save</button></div></div>');const input=$('#contactNameInput');$('#nameCancel').onclick=()=>$('#modal')?.remove();$('#nameSave').onclick=()=>{const v=input.value.trim();if(!v&&title!=='Add contact')return notify('Enter a contact name');done(v)};input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('#nameSave').click()}if(e.key==='Escape')$('#nameCancel').click()};input.focus();input.select()}
async function saveContact(userId,label){contactNameModal('Add contact',label||'',async nickname=>{try{await api('/api/chat/contacts',{method:'POST',body:JSON.stringify({user_id:userId,nickname})});await loadContacts();$('#modal')?.remove();state.view='contacts';state.query='';if($('#search'))$('#search').value='';renderContacts();notify('Contact added')}catch(e){notify(e.message)}})}
async function contactDetails(userId){const c=state.contacts.find(x=>Number(x.user_id)===Number(userId));if(!c)return;let blocked=false;try{blocked=!!(await api('/api/chat/blocks/'+Number(c.user_id)+'/status')).blocked}catch{}modal('User Info','<div class="profile-page contact-profile-page"><section class="profile-hero"><div class="profile-photo-wrap"><div class="profile-photo">'+avatarMarkup(c,'contact-detail-avatar')+'</div></div><div class="profile-identity"><h2>'+esc(c.name||c.email)+'</h2><p>'+esc(c.email||'')+'</p><span class="profile-status">● '+esc(c.status||'offline')+'</span></div></section><section class="profile-menu"><div class="profile-menu-row"><span class="profile-menu-icon">📱</span><span><b>Contact</b><small>'+esc(c.email||'VexaAccount contact')+'</small></span></div><div class="profile-menu-row"><span class="profile-menu-icon">●</span><span><b>Presence</b><small>'+esc(c.status||'offline')+'</small></span></div><div class="profile-menu-row"><span class="profile-menu-icon">🚫</span><span><b>Messaging access</b><small>'+esc(blocked?"Blocked: this contact cannot message you":"Allowed: messaging and calls are available")+'</small></span></div></section><div class="contact-actions"><button class="primary" id="contactMessage" '+(blocked?"disabled":"")+'>💬 Start chat</button><button class="secondary" id="contactVoice" '+(blocked?"disabled":"")+'>☎ Voice call</button><button class="secondary" id="contactVideo" '+(blocked?"disabled":"")+'>▣ Video call</button><button class="secondary" id="contactRename">✎ Edit name</button><button class="'+(blocked?"primary":"danger")+'" id="contactBlock">'+(blocked?"✓ Unblock user":"🚫 Block user")+'</button><button class="danger" id="contactDelete">Remove contact</button></div></div>');$('#contactMessage').onclick=async()=>{if(blocked)return;$('#modal')?.remove();await openContact(Number(c.user_id))};$('#contactVoice').onclick=async()=>{if(blocked)return;$('#modal')?.remove();await openContact(Number(c.user_id));startCall('voice')};$('#contactVideo').onclick=async()=>{if(blocked)return;$('#modal')?.remove();await openContact(Number(c.user_id));startCall('video')};$('#contactRename').onclick=()=>editContactName(c);$('#contactDelete').onclick=()=>removeContact(c);$('#contactBlock').onclick=async()=>{try{const path='/api/chat/blocks/'+Number(c.user_id);if(blocked){await api(path,{method:'DELETE'});notify('User unblocked')}else{await api('/api/chat/blocks',{method:'POST',body:JSON.stringify({user_id:Number(c.user_id)})});notify('User blocked')}$('#modal')?.remove();await loadChats();renderContacts()}catch(e){notify(e.message)}}}
async function editContactName(c){contactNameModal('Edit contact name',c.name||'',async nickname=>{try{await api('/api/chat/contacts/'+Number(c.user_id),{method:'PATCH',body:JSON.stringify({nickname})});await loadContacts();$('#modal')?.remove();renderContacts();notify('Contact updated')}catch(e){notify(e.message)}})}
async function removeContact(c){modal('Remove contact','<div class="confirm-card"><div class="confirm-icon">×</div><strong>Remove '+esc(c.name||'this contact')+'?</strong><p>This removes the contact relationship. Your existing conversation is kept.</p><div class="modal-actions"><button class="secondary" id="removeCancel">Cancel</button><button class="danger" id="removeConfirm">Remove contact</button></div></div>');$('#removeCancel').onclick=()=>$('#modal')?.remove();$('#removeConfirm').onclick=async()=>{try{await api('/api/chat/contacts/'+Number(c.user_id),{method:'DELETE'});await loadContacts();$('#modal')?.remove();renderContacts();notify('Contact removed')}catch(e){notify(e.message)}}}
async function openChat(id){saveChatDraft();clearTimeout(searchTimer);searchRequest++;state.query='';if($('#search'))$('#search').value='';showMobileChat();state.active=state.chats.find(x=>Number(x.id)===Number(id))||{id:Number(id),conversation_type:'direct',name:'Conversation'};state.groupRole=null;restoreChatDraft();try{const details=await api('/api/chat/conversations/'+Number(id)+'/details');if(!state.active||Number(state.active.id)!==Number(id))return;const other=details.members?.find(x=>Number(x.user_id)!==Number(state.me?.id));if(other&&state.active.conversation_type==='direct'){state.active=Object.assign({},state.active,{name:other.name||other.email||'Conversation',email:other.email||'',avatar_url:other.avatar_url||other.picture||'',online:other.status==='online',presence:other.status||'offline'});const bs=await api('/api/chat/blocks/'+Number(other.user_id)+'/status');if(state.active&&Number(state.active.id)===Number(id)){state.active.blocked=!!bs.blocked;state.active.blocked_by_me=!!bs.blocked_by_me;state.active.blocked_by_other=!!bs.blocked_by_other}}else if(details.title){state.active=Object.assign({},state.active,{name:details.title,conversation_type:details.conversation_type||state.active.conversation_type});}}catch{}state.messages=[];state.reactions={};state.hasMoreMessages=true;state.loadingOlderMessages=false;renderActive();try{if(state.active?.conversation_type==='group'){try{const details=await api('/api/chat/conversations/'+id+'/details');if(Number(state.active?.id)!==Number(id))return;state.groupRole=details.members.find(x=>Number(x.user_id)===Number(state.me?.id))?.role||null}catch{state.groupRole=null}}const d=await api('/api/chat/conversations/'+id+'/messages?limit=100');if(!state.active||Number(state.active.id)!==Number(id))return;state.messages=d.messages||[];state.hasMoreMessages=state.messages.length>=100;const visible=state.messages.slice(-100);await Promise.all(visible.map(async m=>{try{state.reactions[m.id]=(await api('/api/chat/conversations/'+id+'/messages/'+m.id+'/reactions')).reactions||[]}catch{state.reactions[m.id]=[]}}));if(!state.active||Number(state.active.id)!==Number(id))return;renderMessages();if(state.messages.length){await markRead(state.messages.at(-1).id);await loadChats()}}catch(e){if(Number(state.active?.id)===Number(id))notify(e.message)}}
function renderDashboard(){
 const el=$('#messages');
 if(!el)return;
 el.innerHTML='<div class="empty-chat-state" aria-label="Select a conversation">'+
   '<div class="empty-chat-icon"><img src="./icon.svg" alt="VexaChat"></div>'+
   '<h2>Select a chat</h2>'+
   '<p>Choose a conversation from the list to start messaging.</p>'+
   '<span class="empty-chat-hint">Your conversations, contacts and calls stay inside VexaChat.</span>'+
 '</div>';
}
async function renderActive(){
 renderChats();
 const c=state.active;
 $('#back').style.display=c?'block':'none';
 $('#headName').textContent=c?nameOf(c):'VexaChat';
 if(!c){
  $('#headStatus').textContent='Connected · ready to message';
  $('#headAvatar').outerHTML='<div class="avatar head-avatar"><img src="./icon.svg" alt="VexaChat"></div>';
  $('#messageInput').disabled=true; $('.send').disabled=true; $('#voice').disabled=true; $('#video').disabled=true; $('#info').disabled=true; $('#chatMenu').disabled=true;
  const banner=$('#conversationBanner'); if(banner){banner.hidden=true;banner.innerHTML=''}
  renderDashboard();
  return;
 }
 const online=c?.online||c?.presence==='online'||c?.status==='online';
 const lastSeen=c?.last_seen||c?.lastSeen;
 const typingCount=Object.keys(state.typingUsers||{}).length;
 $('#headStatus').textContent=typingCount?'typing…':(online?'online':lastSeen?'last seen '+time(lastSeen):c.conversation_type==='group'?'Group chat':'Secure conversation');
 $('#headAvatar').outerHTML=avatarMarkup(c,'avatar head-avatar');
 const blocked=!!c?.blocked;
 $('#messageInput').disabled=blocked; $('.send').disabled=blocked; $('#voice').disabled=blocked; $('#video').disabled=blocked; $('#info').disabled=false; $('#chatMenu').disabled=false;
 const banner=$('#conversationBanner');
 if(banner){
  const muted=isChatMuted(c),pinned=Number(c.pinned)===1,archived=Number(c.archived)===1,flags=[];
  if(blocked)flags.push('<span>🚫 '+(c.blocked_by_me?'You blocked this contact':'Messaging blocked')+'</span>'); if(pinned)flags.push('<span>📌 Pinned</span>'); if(muted)flags.push('<span>🔕 Notifications muted</span>'); if(archived)flags.push('<span>📦 Archived</span>');
  banner.hidden=!flags.length;
  banner.innerHTML=flags.length?'<div class="conversation-banner-copy">'+flags.join('')+'</div><div class="conversation-banner-actions">'+(blocked&&c.blocked_by_me?'<button type="button" data-banner-action="unblock">Unblock</button>':'')+(muted?'<button type="button" data-banner-action="mute">Unmute</button>':'<button type="button" data-banner-action="mute">Mute</button>')+(archived?'<button type="button" data-banner-action="archive">Restore</button>':'<button type="button" data-banner-action="archive">Archive</button>')+'</div>':'';
  banner.querySelectorAll('[data-banner-action]').forEach(b=>b.onclick=async()=>{const action=b.dataset.bannerAction;try{if(action==='unblock'){const d=await api('/api/chat/conversations/'+Number(c.id)+'/details');const other=d.members.find(x=>Number(x.user_id)!==Number(state.me.id));if(other)await api('/api/chat/blocks/'+Number(other.user_id),{method:'DELETE'});c.blocked=false;c.blocked_by_me=false;c.blocked_by_other=false;await loadChats();renderActive();notify('Contact unblocked');return}if(action==='mute')await api('/api/chat/conversations/'+Number(c.id)+'/settings',{method:'POST',body:JSON.stringify({muted_until:muted?null:new Date(Date.now()+86400000).toISOString()})});if(action==='archive')await api('/api/chat/conversations/'+Number(c.id)+'/settings',{method:'POST',body:JSON.stringify({archived:!archived})});await loadChats();if(action==='archive'&&!archived){state.active=null;renderActive();showMobileList('chats')}else renderActive();notify(action==='mute'?(muted?'Notifications unmuted':'Notifications muted for 24 hours'):(archived?'Conversation restored':'Conversation archived'))}catch(e){notify(e.message)}});
 }
}
function clearMessageSelection(){state.selectedMessages.clear();state.selectionMode=false;document.querySelector('.message-selection-bar')?.remove();renderMessages()}
function updateMessageSelectionBar(){let bar=document.querySelector('.message-selection-bar');if(!state.selectionMode){bar?.remove();return}if(!bar){bar=document.createElement('div');bar.className='message-selection-bar';bar.innerHTML='<button class="icon-btn" id="cancelMessageSelection" aria-label="Cancel selection">×</button><strong id="selectionCount">0 selected</strong><button class="secondary" id="copySelected">Copy</button><button class="secondary" id="deleteSelected">Delete</button>';document.querySelector('.main')?.prepend(bar);bar.querySelector('#cancelMessageSelection').onclick=clearMessageSelection;bar.querySelector('#copySelected').onclick=async()=>{const rows=state.messages.filter(m=>state.selectedMessages.has(Number(m.id))&&!m.deleted_at);const text=rows.map(m=>m.body||'').filter(Boolean).join('\n');try{await navigator.clipboard.writeText(text);notify(rows.length+' message'+(rows.length===1?'':'s')+' copied')}catch{notify('Copy unavailable')}};bar.querySelector('#deleteSelected').onclick=async()=>{const rows=state.messages.filter(m=>state.selectedMessages.has(Number(m.id))&&!m.deleted_at&&Number(m.sender_id)===Number(state.me?.id));if(!rows.length)return notify('Only your messages can be deleted in bulk');if(!confirm('Delete '+rows.length+' selected message'+(rows.length===1?'':'s')+'?'))return;for(const m of rows){try{await api('/api/chat/conversations/'+state.active.id+'/messages/'+m.id,{method:'DELETE'});m.body='Message deleted';m.deleted_at=new Date().toISOString()}catch{}}clearMessageSelection()}}const count=bar.querySelector('#selectionCount');if(count)count.textContent=state.selectedMessages.size+' selected'}
function toggleMessageSelection(id){const n=Number(id);state.selectionMode=true;if(state.selectedMessages.has(n))state.selectedMessages.delete(n);else state.selectedMessages.add(n);if(!state.selectedMessages.size){clearMessageSelection();return}updateMessageSelectionBar();renderMessages()}
function toggleMessageSelectFromEvent(e){const bubble=e.target.closest?.('.bubble');if(!bubble)return;const id=Number(bubble.dataset.messageId);if(!state.selectionMode)return;if(e.target.closest('button'))return;e.preventDefault();toggleMessageSelection(id)}
function messageContext(id,point){const m=state.messages.find(x=>+x.id===id);if(!m)return;if(state.selectionMode){toggleMessageSelection(id);return}const mine=Number(m.sender_id)===Number(state.me.id),preview=esc((m.body||m.message_type||'Message').slice(0,180));const isTouch=window.matchMedia?.('(pointer:coarse)').matches;const shell=isTouch?'context-sheet':'context-menu-modal';modal('',
'<div class="'+shell+'">'+(isTouch?'<div class="sheet-handle"></div>':'')+'<div class="context-message-preview"><span class="context-icon">💬</span><span>'+preview+'</span></div><div class="context-actions">'+
'<button class="context-action" id="ctxReply"><span>↩</span><b>Reply</b></button>'+ '<button class="context-action" id="ctxReact"><span>☺</span><b>React</b></button>'+ '<button class="context-action" id="ctxCopy"><span>⧉</span><b>Copy</b></button>'+ '<button class="context-action" id="ctxSelect"><span>☑</span><b>Select</b></button>'+ (mine?'<button class="context-action" id="ctxEdit"><span>✎</span><b>Edit</b></button><button class="context-action danger-action" id="ctxDelete"><span>⌫</span><b>Delete</b></button>':((state.groupRole==='owner'||state.groupRole==='admin')&&!m.deleted_at?'<button class="context-action danger-action" id="ctxDelete"><span>⌫</span><b>Delete</b></button>':''))+'</div><button class="context-cancel" id="ctxCancel">Cancel</button></div>');const close=()=>$('#modal')?.remove();$('#ctxCancel').onclick=close;$('#ctxSelect').onclick=()=>{close();state.selectedMessages=new Set([Number(id)]);state.selectionMode=true;renderMessages();updateMessageSelectionBar()};$('#ctxReply').onclick=()=>{close();replyTo(id)};$('#ctxReact').onclick=()=>{close();reactionPicker(id)};$('#ctxCopy').onclick=()=>{navigator.clipboard?.writeText(m.body||'').then(()=>notify('Message copied')).catch(()=>notify('Copy unavailable'));close()};$('#ctxEdit')?.addEventListener('click',()=>{close();editMessage(id)});$('#ctxDelete')?.addEventListener('click',()=>{close();deleteMessage(id)});}function messageSearch(){if(!state.active)return notify("Open a conversation first");modal("Search messages",'<div class="message-search-bar"><span>⌕</span><input id="messageSearchInput" class="modal-input" placeholder="Search messages" autocomplete="off"><button class="icon-btn" id="clearMessageSearch" type="button">×</button></div><div id="messageSearchCount" class="search-count"></div><div id="messageSearchResults" class="result-list"></div>');const input=$("#messageSearchInput"),results=$("#messageSearchResults"),count=$("#messageSearchCount");const highlight=(text,q)=>{const raw=String(text||"");if(!q)return esc(raw);const safe=q.replace(/[.*+?^${}()|[\\]\\\\]/g,"\\\\$&"),re=new RegExp(safe,"ig");let out="",last=0;raw.replace(re,(m,offset)=>{out+=esc(raw.slice(last,offset))+"<mark>"+esc(m)+"</mark>";last=offset+m.length;return m});return out+esc(raw.slice(last))};const render=()=>{const q=input.value.trim().toLowerCase(),rows=q?state.messages.filter(m=>(m.body||"").toLowerCase().includes(q)).slice().reverse():[];count.textContent=q?rows.length+" result"+(rows.length===1?"":"s"):"";results.innerHTML=rows.map(m=>'<button class="result message-result" data-msg-search="'+m.id+'"><span class="result-avatar">'+esc(initials(Number(m.sender_id)===Number(state.me.id)?"You":(m.sender_name||m.sender_email)))+'</span><span class="message-result-body">'+highlight(m.body||"Message",q)+'<small>'+esc(Number(m.sender_id)===Number(state.me.id)?"You":(m.sender_name||m.sender_email))+' · '+time(m.created_at)+'</small></span></button>').join("")||'<div class="hint">'+(q?"No messages found in this conversation.":"Type a word or phrase to search this conversation.")+"</div>";results.querySelectorAll("[data-msg-search]").forEach(b=>b.onclick=()=>{const id=Number(b.dataset.msgSearch),m=state.messages.find(x=>Number(x.id)===id);$("#modal")?.remove();const bubble=document.querySelector(".bubble[data-message-id=\""+id+"\"]");bubble?.scrollIntoView({behavior:"smooth",block:"center"});bubble?.classList.add("search-hit");setTimeout(()=>bubble?.classList.remove("search-hit"),1800);if(m?.body)notify("Found message · "+time(m.created_at))})};input.oninput=render;$("#clearMessageSearch").onclick=()=>{input.value="";input.focus();render()};input.onkeydown=e=>{if(e.key==="Escape")$("#modal")?.remove()};render();input.focus()}
function replyTo(id){const m=state.messages.find(x=>+x.id===id);if(!m)return;const input=$('#messageInput');input.dataset.replyTo=id;input.placeholder='Write a reply…';let bar=$('#replyComposer');if(!bar){bar=document.createElement('div');bar.id='replyComposer';bar.className='reply-composer';input.parentElement.insertBefore(bar,input)}bar.innerHTML='<div><b>Replying to '+esc(m.sender_name||m.sender_email||'message')+'</b><span>'+esc((m.body||m.message_type||'Message').slice(0,120))+'</span></div><button type="button" class="icon-btn" id="cancelReply" aria-label="Cancel reply">×</button>';$('#cancelReply').onclick=clearReply;input.focus()}
function clearReply(){const input=$('#messageInput');if(!input)return;delete input.dataset.replyTo;input.placeholder='Write a message…';$('#replyComposer')?.remove();input.focus()}
async function getAttachment(id){if(!id)return null;if(state.attachmentData?.[id])return state.attachmentData[id];try{const d=await api('/api/chat/attachments/'+id);const a=d.attachment||null;if(a)state.attachmentData[id]=a;return a}catch(e){notify(e.message);return null}}
async function openAttachmentData(id,el){const a=await getAttachment(id);if(a&&el)el.src=a.data_url}
function openMediaViewer(a){
 const type=String(a?.mime_type||a?.content_type||'').toLowerCase();
 const isImage=type.startsWith('image/');
 const isVideo=type.startsWith('video/');
 if(!a?.data_url)return;
 const media=isImage?'<img class="media-viewer-content" src="'+a.data_url+'" alt="'+esc(a.file_name||'Media')+'">':isVideo?'<video class="media-viewer-content" src="'+a.data_url+'" controls autoplay playsinline></video>':'<div class="media-viewer-file">📎<strong>'+esc(a.file_name||'Attachment')+'</strong></div>';
 modal('', '<div class="media-viewer"><div class="media-viewer-top"><span>'+esc(a.file_name||'Media')+'</span><button type="button" class="icon-btn" id="mediaViewerClose" aria-label="Close">×</button></div><div class="media-viewer-stage">'+media+'</div><div class="media-viewer-actions"><a class="primary" href="'+a.data_url+'" download="'+esc(a.file_name||'download')+'">Download</a></div></div>');
 $('#mediaViewerClose').onclick=()=>$('#modal')?.remove();
}
async function openAttachment(id){const a=await getAttachment(id);if(!a)return;const w=window.open();if(!w)return;w.document.write('<a download="'+esc(a.file_name||'download')+'" href="'+a.data_url+'">Download '+esc(a.file_name||'file')+'</a>')}
const messageMeta=m=>{if(!m)return {};if(typeof m.metadata==='object'&&m.metadata)return m.metadata;try{return JSON.parse(m.metadata||'{}')}catch{return {}}};
async function loadOlderMessages(){
 if(!state.active||state.loadingOlderMessages||!state.hasMoreMessages||!state.messages.length)return;
 const conversationId=Number(state.active.id),before=Number(state.messages[0]?.id||0);
 if(!before)return;
 state.loadingOlderMessages=true;
 const el=$('#messages');
 const oldHeight=el?.scrollHeight||0;
 const oldTop=el?.scrollTop||0;
 try{
  const d=await api('/api/chat/conversations/'+conversationId+'/messages?limit=100&before='+encodeURIComponent(before));
  if(!state.active||Number(state.active.id)!==conversationId)return;
  const older=d.messages||[];
  if(!older.length){state.hasMoreMessages=false;return}
  const existing=new Set(state.messages.map(m=>Number(m.id)));
  const fresh=older.filter(m=>!existing.has(Number(m.id)));
  state.messages=[...fresh,...state.messages];
  if(older.length<100)state.hasMoreMessages=false;
  await Promise.all(fresh.map(async m=>{try{state.reactions[m.id]=(await api('/api/chat/conversations/'+conversationId+'/messages/'+m.id+'/reactions')).reactions||[]}catch{state.reactions[m.id]=[]}}));
  renderMessages();
  requestAnimationFrame(()=>{const next=$('#messages');if(next)next.scrollTop=oldTop+(next.scrollHeight-oldHeight)});
 }catch(e){notify(e.message||'Could not load older messages')}
 finally{state.loadingOlderMessages=false}
}
function scrollMessagesToBottom(force=false){const el=$('#messages');if(!el)return;const distance=el.scrollHeight-el.scrollTop-el.clientHeight;if(force||distance<180){requestAnimationFrame(()=>{el.scrollTop=el.scrollHeight});$('#jumpLatest')?.remove();}}
function showJumpToLatest(count=1){const el=$('#messages');if(!el)return;let b=$('#jumpLatest');if(!b){b=document.createElement('button');b.id='jumpLatest';b.className='jump-latest';b.type='button';b.innerHTML='<span>↓</span><span>New messages</span><span class="jump-count">1</span>';b.onclick=()=>{scrollMessagesToBottom(true);if(state.messages.length)markRead(state.messages.at(-1).id)};el.appendChild(b)}const badge=b.querySelector('.jump-count');if(badge)badge.textContent=String(Math.max(1,Number(badge.textContent||0)+Math.max(1,count)))} 
function renderMessages(){
const el=$('#messages');
if(!el)return;
const previousDistance=el.scrollHeight-el.scrollTop-el.clientHeight;
const wasNearBottom=previousDistance<180;
if(!state.messages.length){el.innerHTML='<div class="empty"><strong>Start the conversation</strong><span>Send a message, image, document or call.</span></div>';return}
let lastDay='',lastSender=null,unreadInserted=false;const group=state.active?.conversation_type==='group',lastRead=Number(state.active?.last_read_message_id||0),typingNames=Object.values(state.typingUsers||{}).map(v=>v?.name||v?.email||'Someone').filter(Boolean);
el.innerHTML=state.messages.map(m=>{
const mine=Number(m.sender_id)===Number(state.me.id),rx=state.reactions[m.id]||[],meta=messageMeta(m),reply=m.reply_to_id?state.messages.find(x=>+x.id===+m.reply_to_id):null,day=new Date(m.created_at).toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'}),sep=day!==lastDay?(lastDay=day,'<div class="date-separator"><span>'+esc(day)+'</span></div>'):'',isUnread=!mine&&!unreadInserted&&lastRead>0&&Number(m.id)>lastRead,unread=isUnread?'<div class="unread-divider"><span>New messages</span></div>':'';
if(isUnread)unreadInserted=true;const sender=m.sender_name||m.sender_email||'Member',sameSender=group&&!mine&&lastSender===String(m.sender_id);lastSender=String(m.sender_id);
const selected=state.selectedMessages.has(Number(m.id));const avatar=!mine&&group&&!sameSender?avatarMarkup(m,'message-avatar'):(!mine&&group?'<div class="message-avatar message-avatar-spacer" aria-hidden="true"></div>':''),body=m.deleted_at?'<div class="body deleted-body">Message deleted</div>':'<div class="body">'+esc(m.body||'')+'</div>';
const actions=m.deleted_at?'':('<div class="msg-menu"><button class="tiny" data-forward="'+m.id+'">↗</button><button class="tiny" data-reply="'+m.id+'">↩</button><button class="tiny" data-react="'+m.id+'">☺</button>'+(mine&&m.message_type==='text'?'<button class="tiny" data-edit="'+m.id+'">Edit</button>':'')+(mine&&!m.deleted_at?'<button class="tiny" data-delete="'+m.id+'">Delete</button>':((state.groupRole==='owner'||state.groupRole==='admin')&&!mine&&!m.deleted_at?'<button class="tiny" data-delete="'+m.id+'">Delete</button>':''))+'</div>');
return sep+unread+'<article class="bubble '+(selected?'selected-message ':'')+(mine?'mine ':'')+(group?'group-message ':'')+(sameSender?'same-sender ':'')+(m.deleted_at?'deleted ':'')+'" data-message-id="'+m.id+'">'+avatar+'<div class="message-content">'+(group&&!mine&&!sameSender?'<div class="sender">'+esc(sender)+'</div>':'')+(reply?'<button type="button" class="reply-preview" data-jump-reply="'+reply.id+'"><b>↩ '+esc(reply.sender_name||reply.sender_email||'Reply')+'</b><span>'+esc(reply.deleted_at?'Message deleted':(reply.body||reply.message_type||'Message').slice(0,90))+'</span></button>':'')+actions+body+(m.message_type!=='text'&&!m.deleted_at?'<div class="attachment-shell" data-type="'+esc(m.message_type)+'" data-attachment-shell="'+esc(meta.attachment_id||'')+'"><button class="attachment-card" data-attachment="'+esc(meta.attachment_id||'')+'">📎 '+esc(meta.file_name||m.body||m.message_type)+'</button></div>':'')+'<div class="time">'+time(m.created_at)+(m.edited_at&&!m.deleted_at?' · edited':'')+(mine&&!m.deleted_at?'<span class="delivery-state" aria-label="'+(m.read_at?'Read':'Sent')+'" title="'+(m.read_at?'Read':'Sent')+'">'+(m.read_at?'✓✓':'✓')+'</span>':'')+'</div>'+(rx.length&&!m.deleted_at?'<div class="reactions">'+rx.map(r=>'<button type="button" class="reaction-chip" data-react="'+m.id+'">'+esc(r.emoji)+'</button>').join('')+'</div>':'')+'</div></article>'
}).join('')+(typingNames.length?'<div class="typing-indicator" aria-live="polite"><span>'+esc(typingNames.slice(0,3).join(', '))+'</span><i></i><i></i><i></i></div>':'');
requestAnimationFrame(()=>{
  if(wasNearBottom){el.scrollTop=el.scrollHeight;$('#jumpLatest')?.remove();}
  else {const max=Math.max(0,el.scrollHeight-el.clientHeight-previousDistance);el.scrollTop=max;}
});
el.querySelectorAll('[data-attachment]').forEach(b=>b.onclick=async()=>{const id=b.dataset.attachment,a=await getAttachment(id),shell=b.closest('[data-attachment-shell]'),type=shell?.dataset.type;if(!a||!shell)return;if(type==='image'){const img=document.createElement('img');img.className='attachment-preview';img.alt=a.file_name||'Image';img.src=a.data_url;img.tabIndex=0;img.title='Open media viewer';img.onclick=()=>openMediaViewer(a);img.onkeydown=e=>{if(e.key==='Enter'||e.key===' ')openMediaViewer(a)};shell.replaceChildren(img)}else if(type==='video'){const v=document.createElement('video');v.className='attachment-video';v.controls=true;v.playsInline=true;v.preload='metadata';v.src=a.data_url;v.onclick=()=>openMediaViewer(a);shell.replaceChildren(v)}else if(type==='audio'){const au=document.createElement('audio');au.className='attachment-audio';au.controls=true;au.src=a.data_url;shell.replaceChildren(au)}else openAttachment(id)});
el.querySelectorAll('.attachment-card').forEach(b=>{const id=b.dataset.attachment;if(!id)return;const m=state.messages.find(x=>String(messageMeta(x).attachment_id||'')===String(id));if(m?.message_type==='image'){const img=document.createElement('img');img.className='attachment-preview';img.alt=m.body||'Image';b.before(img);openAttachmentData(id,img)}});
el.querySelectorAll('[data-forward]').forEach(b=>b.onclick=e=>{e.stopPropagation();const m=state.messages.find(x=>+x.id===+b.dataset.forward);if(m)forwardMessage(m)});el.querySelectorAll('[data-reply]').forEach(b=>b.onclick=()=>replyTo(+b.dataset.reply));
el.querySelectorAll('[data-message-id]').forEach(b=>{b.addEventListener('dblclick',()=>{const id=Number(b.dataset.messageId);if(id&&!b.classList.contains('deleted'))reactionPicker(id)});});el.querySelectorAll('[data-jump-reply]').forEach(b=>b.onclick=()=>{const target=el.querySelector('[data-message-id="'+b.dataset.jumpReply+'"]');target?.scrollIntoView({behavior:'smooth',block:'center'});target?.classList.add('search-hit');setTimeout(()=>target?.classList.remove('search-hit'),900)});el.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editMessage(+b.dataset.edit));el.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>deleteMessage(+b.dataset.delete));el.querySelectorAll('[data-react]').forEach(b=>b.onclick=()=>reactionPicker(+b.dataset.react));
el.addEventListener('click',toggleMessageSelectFromEvent);el.querySelectorAll('.bubble').forEach(b=>{let timer,moved=false,startX=0,startY=0,swiping=false;const resetSwipe=()=>{b.style.transform='';b.classList.remove('swipe-reply-ready');swiping=false};b.addEventListener('touchstart',e=>{if(e.touches.length!==1)return;const t=e.touches[0];startX=t.clientX;startY=t.clientY;moved=false;swiping=false;timer=setTimeout(()=>{if(!moved&&!swiping){navigator.vibrate?.(12);messageContext(Number(b.dataset.messageId),t.clientX,t.clientY)}},500);},{passive:true});b.addEventListener('touchmove',e=>{const t=e.touches[0],dx=t.clientX-startX,dy=t.clientY-startY;if(Math.abs(dx)>8||Math.abs(dy)>8){moved=true;clearTimeout(timer)}if(Math.abs(dx)>Math.abs(dy)&&dx>0&&dx<92){swiping=true;b.style.transform='translateX('+Math.min(72,dx*.65)+'px)';b.classList.toggle('swipe-reply-ready',dx>48)}},{passive:true});b.addEventListener('touchend',()=>{clearTimeout(timer);if(swiping&&b.classList.contains('swipe-reply-ready')){navigator.vibrate?.(8);replyTo(Number(b.dataset.messageId))}setTimeout(resetSwipe,120)});b.addEventListener('touchcancel',()=>{clearTimeout(timer);resetSwipe()},{passive:true});b.addEventListener('dblclick',()=>{const id=Number(b.dataset.messageId);const mine=(state.reactions[id]||[]).some(r=>Number(r.user_id)===Number(state.me.id)&&r.emoji==='❤️');api('/api/chat/reactions',{method:mine?'DELETE':'POST',body:JSON.stringify({message_id:id,emoji:'❤️'})}).then(()=>loadReactions(id)).catch(()=>notify('Reaction unavailable'))});});
}function clearAttachmentDraft(){state.pendingAttachment=null;const input=$('#file');if(input)input.value='';$('#attachmentPreview')?.remove();updateComposerState()}
let voiceRecorder=null,voiceChunks=[],voiceStartedAt=0,voiceTimer=null;
function setVoiceButton(recording=false){const b=$('#recordVoice');if(!b)return;b.classList.toggle('recording',recording);b.textContent=recording?'■':'🎙';b.title=recording?'Release to send voice message':'Hold to record voice message';}
async function stopVoiceRecording(sendIt=true){if(!voiceRecorder)return;const r=voiceRecorder;voiceRecorder=null;clearInterval(voiceTimer);voiceTimer=null;setVoiceButton(false);r._sendAfterStop=!!sendIt;if(r.state!=='inactive')r.stop();else if(!sendIt)voiceChunks=[]}
async function beginVoiceRecording(e){if(!state.active||state.pendingAttachment||$('#messageInput')?.value.trim())return;if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)return notify('Voice recording is not supported on this device');e?.preventDefault();try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});const mime=['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(x=>MediaRecorder.isTypeSupported?.(x))||'';const r=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);voiceChunks=[];voiceStartedAt=Date.now();voiceRecorder=r;r.ondataavailable=x=>x.data?.size&&voiceChunks.push(x.data);r.onstop=async()=>{stream.getTracks().forEach(t=>t.stop());const sendAfter=r._sendAfterStop!==false;if(!sendAfter){voiceChunks=[];return}try{const blob=new Blob(voiceChunks,{type:r.mimeType||'audio/webm'});if(blob.size>8*1024*1024)throw Error('Voice message is too large');const dataUrl=await new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(String(fr.result||''));fr.onerror=reject;fr.readAsDataURL(blob)});state.pendingAttachment={file_name:'Voice message '+new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})+'.webm',mime_type:r.mimeType||'audio/webm',file_size:blob.size,data_url:dataUrl};renderAttachmentDraft();await send({preventDefault(){}})}catch(err){notify(err.message||'Unable to send voice message')}finally{voiceChunks=[]}};r.start(200);setVoiceButton(true);voiceTimer=setInterval(()=>{const b=$('#recordVoice');if(b)b.dataset.duration=String(Math.floor((Date.now()-voiceStartedAt)/1000))+'s'},500)}catch(err){notify('Microphone permission is required')}} 
document.addEventListener('visibilitychange',()=>{if(document.hidden&&voiceRecorder){stopVoiceRecording(false).catch(()=>{})}});
function bindVoiceRecorder(){const b=$('#recordVoice');if(!b||b.dataset.voiceBound)return;b.dataset.voiceBound='1';let pressed=false,startToken=0,startPromise=null;const finish=async cancel=>{if(!pressed)return;pressed=false;const token=startToken;b.releasePointerCapture?.(b._pointerId);b._pointerId=null;try{await startPromise}catch{}startPromise=null;if(token!==startToken)return;if(voiceRecorder){voiceRecorder._sendAfterStop=!cancel;await stopVoiceRecording(!cancel)}else if(cancel){setVoiceButton(false)}};const start=e=>{if(pressed)return;if(e.pointerType==='mouse'&&e.button!==0)return;pressed=true;startToken++;b._pointerId=e.pointerId;b.setPointerCapture?.(e.pointerId);startPromise=beginVoiceRecording(e).catch(err=>{if(pressed)notify(err?.message||'Microphone permission is required')})};b.addEventListener('pointerdown',start);b.addEventListener('pointerup',()=>finish(false));b.addEventListener('pointercancel',()=>finish(true));b.addEventListener('lostpointercapture',()=>finish(false));}
function bindComposerInteractions(){const input=$('#messageInput');if(!input||input.dataset.interactionsBound)return;input.dataset.interactionsBound='1';input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();if(!e.repeat)$('#composer')?.requestSubmit()}});input.addEventListener('input',()=>{input.style.height='auto';input.style.height=Math.min(input.scrollHeight,130)+'px';saveChatDraft();typing();updateComposerState()});input.addEventListener('paste',e=>{const files=[...(e.clipboardData?.files||[])];if(files.length){e.preventDefault();const f=files[0];if(f.size<=8*1024*1024){fileToDataUrl(f).then(dataUrl=>{state.pendingAttachment={file_name:f.name||'Pasted image',mime_type:f.type||'application/octet-stream',file_size:f.size,data_url:dataUrl};renderAttachmentDraft();notify('Pasted attachment ready')}).catch(()=>notify('Could not read pasted attachment'))}else notify('Maximum attachment size is 8 MB')}});}
function updateComposerState(){const active=!!state.active;const hasText=!!$('#messageInput')?.value.trim();const hasAttachment=!!state.pendingAttachment;if($('#messageInput'))$('#messageInput').disabled=!active;const sendBtn=$('.send');if(sendBtn){sendBtn.disabled=!(active&&(hasText||hasAttachment))}const mic=$('#recordVoice');if(mic){mic.disabled=!active||hasText||hasAttachment;mic.setAttribute('aria-disabled',String(mic.disabled))}}
function renderAttachmentDraft(){const draft=state.pendingAttachment;if(!draft){$('#attachmentPreview')?.remove();updateComposerState();return}let el=$('#attachmentPreview');if(!el){el=document.createElement('div');el.id='attachmentPreview';el.className='attachment-draft';const composer=$('#composer');composer.insertBefore(el,composer.querySelector('#messageInput'));}const visual=draft.mime_type.startsWith('image/')?'<img src="'+esc(draft.data_url)+'" alt="" loading="lazy">':draft.mime_type.startsWith('video/')?'<span class="attachment-draft-icon">▶</span>':'<span class="attachment-draft-icon">📎</span>';el.innerHTML=visual+'<div class="attachment-draft-copy"><b>'+esc(draft.file_name)+'</b><small>'+esc((draft.file_size/1024/1024).toFixed(2))+' MB</small></div><button type="button" class="icon-btn" id="clearAttachment" aria-label="Remove attachment">×</button>';$('#clearAttachment').onclick=clearAttachmentDraft;updateComposerState()}
function fileToDataUrl(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result||''));reader.onerror=()=>reject(new Error('Unable to read this file'));reader.readAsDataURL(file)})}
async function uploadFile(e){const file=e.target.files?.[0];if(!file)return;try{if(file.size>8*1024*1024)throw Error('Maximum attachment size is 8 MB');if(!file.type)throw Error('This file type is not supported');const dataUrl=await fileToDataUrl(file);state.pendingAttachment={file_name:file.name,mime_type:file.type,file_size:file.size,data_url:dataUrl};renderAttachmentDraft();notify('Attachment ready — send when you are ready')}catch(err){notify(err.message)}finally{e.target.value=''}}
async function send(e){e.preventDefault();if(!state.active)return;if(state.active.blocked)return notify(state.active.blocked_by_me?'Unblock this contact to send messages':'This contact has blocked messaging');const input=$('#messageInput'),text=input.value.trim(),draft=state.pendingAttachment;if(!text&&!draft)return;const button=$('.send');if(button)button.disabled=true;try{let attachmentId=null,type='text',body=text;if(draft){const up=await api('/api/chat/uploads',{method:'POST',body:JSON.stringify({file_name:draft.file_name,mime_type:draft.mime_type,data_base64:draft.data_url})});attachmentId=up.attachment_id;type=draft.mime_type.startsWith('image/')?'image':draft.mime_type.startsWith('video/')?'video':draft.mime_type.startsWith('audio/')?'audio':'file';body=body||draft.file_name}const payload={body,message_type:type,client_message_id:crypto.randomUUID(),attachment_id:attachmentId||undefined,metadata:attachmentId?{attachment_id:attachmentId,file_name:draft.file_name,mime_type:draft.mime_type,file_size:draft.file_size}:undefined};if(input.dataset.replyTo)payload.reply_to_id=Number(input.dataset.replyTo);const d=await api('/api/chat/conversations/'+state.active.id+'/messages',{method:'POST',body:JSON.stringify(payload)});state.messages.push(d.message);state.reactions[d.message.id]=[];input.value='';clearChatDraft(state.active.id);clearReply();clearAttachmentDraft();renderMessages();await loadChats();markRead(d.message.id)}catch(err){notify(err.message)}finally{updateComposerState();input.focus()}}
function emojiPicker(){const es=['😀','😂','😍','👍','❤️','🔥','🎉','😢','😎','🙏','👏','🤝','🚀','💯','😊','🤔','🤣','😘','🥰','😁','😅','😉','🙌','✨','💙','💔','😡','😱','🤗','🤔','😴','🤩','🥳','😇','🫶','👋','👌','✌️','💪','🎈','🎁','🍕','☕','🌟','❤️‍🔥','💖','😭','😆','😌','😏','🤝','👀','🔥'];modal('Emoji','<input id="emojiSearch" class="modal-input" placeholder="Search emoji by name or paste one"><div class="emoji-grid" id="emojiGrid">'+es.map(x=>'<button type="button" data-e="'+x+'">'+x+'</button>').join('')+'</div>');const grid=$('#emojiGrid');const apply=()=>{const q=($('#emojiSearch')?.value||'').trim();grid.innerHTML=es.filter(x=>!q||x.includes(q)).map(x=>'<button type="button" data-e="'+x+'">'+x+'</button>').join('');grid.querySelectorAll('[data-e]').forEach(b=>b.onclick=()=>{$('#messageInput').value+=b.dataset.e;$('#modal').remove();$('#messageInput').focus()})};$('#emojiSearch').oninput=apply;grid.querySelectorAll('[data-e]').forEach(b=>b.onclick=()=>{$('#messageInput').value+=b.dataset.e;$('#modal').remove();$('#messageInput').focus()});$('#emojiSearch').focus()}
function attachmentMenu(){if(!state.active)return notify('Open a conversation first');modal('Add to message','<div class="choice-grid attachment-choice-grid"><button type="button" id="pickMedia">🖼️<b>Photos & videos</b><small>Choose from your device</small></button><button type="button" id="pickCamera">📷<b>Camera</b><small>Take a photo or video</small></button><button type="button" id="pickFile">📎<b>Document</b><small>PDF, ZIP, Office and files</small></button></div>');const file=$('#file');const open=(accept,capture)=>{file.value='';file.accept=accept;file.removeAttribute('capture');if(capture)file.setAttribute('capture',capture);$('#modal')?.remove();file.click()};$('#pickMedia').onclick=()=>open('image/*,video/*','');$('#pickCamera').onclick=()=>open('image/*,video/*','environment');$('#pickFile').onclick=()=>open('.pdf,.zip,.txt,.doc,.docx,.xls,.xlsx,application/*','')}function reactionPicker(id){const es=['👍','❤️','😂','😮','😢','🔥','👏','🎉'];modal('React','<div class="emoji-grid">'+es.map(x=>'<button data-r="'+x+'">'+x+'</button>').join('')+'</div>');document.querySelectorAll('[data-r]').forEach(b=>b.onclick=async()=>{try{const exists=(state.reactions[id]||[]).some(r=>Number(r.user_id)===Number(state.me.id)&&r.emoji===b.dataset.r);await api('/api/chat/reactions',{method:exists?'DELETE':'POST',body:JSON.stringify({message_id:id,emoji:b.dataset.r})});await loadReactions(id);$('#modal').remove()}catch(e){notify(e.message)}})}
async function loadReactions(id){state.reactions[id]=(await api('/api/chat/conversations/'+state.active.id+'/messages/'+id+'/reactions')).reactions||[];renderMessages()}
async function editMessage(id){const m=state.messages.find(x=>+x.id===id);if(!m||m.deleted_at)return;if(m.message_type&&m.message_type!=='text')return notify('Only text messages can be edited');modal('Edit message','<textarea id="editBody" class="modal-input">'+esc(m.body)+'</textarea><button class="primary" id="saveEdit">Save</button>');$('#saveEdit').onclick=async()=>{try{const d=await api('/api/chat/conversations/'+state.active.id+'/messages/'+id+'/edit',{method:'POST',body:JSON.stringify({body:$('#editBody').value})});Object.assign(m,d.message);renderMessages();$('#modal').remove()}catch(e){notify(e.message)}}}
async function deleteMessage(id){const m=state.messages.find(x=>+x.id===id);if(!m)return;modal('Delete message','<div class="confirm-copy">Delete this message? This action cannot be undone.</div><div class="modal-actions"><button class="secondary" id="deleteCancel">Cancel</button><button class="danger" id="deleteConfirm">Delete</button></div>');$('#deleteCancel').onclick=()=>$('#modal')?.remove();$('#deleteConfirm').onclick=async()=>{try{await api('/api/chat/conversations/'+state.active.id+'/messages/'+id,{method:'DELETE'});m.body='Message deleted';renderMessages();$('#modal')?.remove()}catch(e){notify(e.message)}}}
async function markRead(id){try{await api('/api/chat/conversations/'+state.active.id+'/read',{method:'POST',body:JSON.stringify({message_id:id})})}catch{}}
async function typing(){if(!state.active)return;try{await api('/api/chat/conversations/'+state.active.id+'/typing',{method:'POST',body:JSON.stringify({typing:true})});clearTimeout(state.typingTimer);state.typingTimer=setTimeout(()=>api('/api/chat/conversations/'+state.active.id+'/typing',{method:'POST',body:JSON.stringify({typing:false})}).catch(()=>{}),1500)}catch{}}
function startLivePoll(){clearInterval(state.livePollTimer);state.livePollTimer=setInterval(async()=>{if(!token()||!API)return;try{await loadChats();await loadCalls();for(const call of state.calls||[]){if(String(call.status)==='ringing'&&Number(call.caller_id)!==Number(state.me?.id)&&!state.seenIncomingCalls[call.id]){state.seenIncomingCalls[call.id]=true;incomingCall(call)}}if(state.active){const d=await api('/api/chat/conversations/'+state.active.id+'/messages?limit=60');const next=d.messages||[];const oldIds=state.messages.map(x=>x.id);const messagePane=$('#messages');const wasNearBottom=messagePane?messagePane.scrollHeight-messagePane.scrollTop-messagePane.clientHeight<180:true;if(JSON.stringify(next)!==JSON.stringify(state.messages)){const oldSet=new Set(oldIds.map(Number));const added=next.filter(m=>!oldSet.has(Number(m.id))).length;state.messages=next;for(const m of state.messages){if(!state.reactions[m.id]){try{state.reactions[m.id]=(await api('/api/chat/conversations/'+state.active.id+'/messages/'+m.id+'/reactions')).reactions||[]}catch{}}}renderMessages();if(wasNearBottom){scrollMessagesToBottom(true);if(state.messages.length)markRead(state.messages.at(-1).id)}else if(added){showJumpToLatest(added)}}}}catch{}},10000)}
function connectEvents(){state.events?.close();clearTimeout(state.eventsRetry);state.eventsRetry=null;const t=token();if(!t||!API){connectionStatus('Sign-in required');return}const es=new EventSource(API+'/api/chat/events?token='+encodeURIComponent(t)+'&v='+Date.now(),{withCredentials:true});state.events=es;es.onopen=()=>{connectionStatus('Connected · live sync');clearTimeout(state.eventsRetry);state.eventsRetry=null};startLivePoll();es.addEventListener('message',async e=>{const m=JSON.parse(e.data);if(state.active&&+m.conversation_id===+state.active.id){if(!state.messages.some(x=>+x.id===+m.id)){const el=$('#messages');const nearBottom=el?el.scrollHeight-el.scrollTop-el.clientHeight<180:true;state.messages.push(m);renderMessages();if(nearBottom){scrollMessagesToBottom(true);markRead(m.id)}else showJumpToLatest(1)}}else {const chat=state.chats.find(v=>Number(v.id)===Number(m.conversation_id));const muted=isChatMuted(chat);if(!muted&&notificationsAllowed()){notify('New message');if('Notification' in window&&Notification.permission==='granted')new Notification('VexaChat',{body:state.settings?.previews_enabled===0||state.settings?.previews_enabled===false?'New message':(m.body||'New message')})}}loadChats()});es.addEventListener('message_updated',e=>{const m=JSON.parse(e.data);if(!state.active||Number(m.conversation_id)!==Number(state.active.id)){loadChats();return}const x=state.messages.find(v=>+v.id===+m.id);if(x){Object.assign(x,m);renderMessages()}else{state.messages.push(m);renderMessages()}});
es.addEventListener('message_deleted',e=>{const x=JSON.parse(e.data);if(!state.active||Number(x.conversation_id)!==Number(state.active.id)){loadChats();return}const m=state.messages.find(v=>+v.id===+x.message_id);if(m){m.body='';m.deleted_at=new Date().toISOString();renderMessages()}loadChats()});es.addEventListener('read',e=>{const x=JSON.parse(e.data);if(!state.active||+x.conversation_id!==+state.active.id)return;state.messages.forEach(m=>{if(Number(m.sender_id)===Number(state.me?.id)&&Number(m.id)<=Number(x.message_id))m.read_at=m.read_at||new Date().toISOString()});renderMessages()});es.addEventListener('reaction',e=>{const x=JSON.parse(e.data);if(x.message_id&&state.active&&Number(x.conversation_id)===Number(state.active.id))loadReactions(+x.message_id).catch(()=>{})});es.addEventListener('presence',e=>{const x=JSON.parse(e.data);if(x.user_id){state.chats.forEach(c=>{if(c.other_user_id&&Number(c.other_user_id)===Number(x.user_id))c.status=x.status});if(state.active){const details=state.active;const directMember=details.other_user_id;if(Number(directMember)===Number(x.user_id))$('#headStatus').textContent=x.status||'offline'}renderChats()}});es.addEventListener('typing',e=>{const x=JSON.parse(e.data);const cid=Number(x.conversation_id),uid=Number(x.user_id);if(!state.active||cid!==Number(state.active.id)||uid===Number(state.me.id))return;clearTimeout(state.typingTimers[uid]);if(x.typing){state.typingUsers[uid]=true;$('#headStatus').textContent='typing…';state.typingTimers[uid]=setTimeout(()=>{delete state.typingUsers[uid];if(state.active&&Number(state.active.id)===cid)$('#headStatus').textContent='Secure conversation'},3500)}else{delete state.typingUsers[uid];$('#headStatus').textContent='Secure conversation'}});es.addEventListener('conversation_updated',e=>{const x=JSON.parse(e.data);const c=state.chats.find(v=>+v.id===+x.conversation_id);if(c){for(const key of ['title','avatar_url','updated_at'])if(Object.prototype.hasOwnProperty.call(x,key))c[key]=x[key];if(Number(x.user_id)===Number(state.me?.id)){for(const key of ['archived','pinned','muted_until'])if(Object.prototype.hasOwnProperty.call(x,key))c[key]=x[key]}renderChats();if(state.active&&Number(state.active.id)===Number(x.conversation_id)){Object.assign(state.active,c);renderActive()}}});es.addEventListener('call',e=>{const x=JSON.parse(e.data);if(String(x.status||'')==='ringing'&&Number(x.caller_id)!==Number(state.me?.id)){incomingCall(x)}else{if(String(x.status||'')==='ended'||String(x.status||'')==='declined'||String(x.status||'')==='missed'){if(String(state.callId)===String(x.call_id)){cleanupCallUi();notify(callStatusLabel(x))}}loadCalls().catch(()=>{})}});es.addEventListener('call_signal',e=>handleSignal(JSON.parse(e.data)));es.onerror=()=>{if(state.events!==es)return;connectionStatus('Reconnecting live sync…');startLivePoll();es.close();state.events=null;clearTimeout(state.eventsRetry);const retryDelay=3000;state.eventsRetry=setTimeout(()=>{state.eventsRetry=null;if(token())connectEvents()},retryDelay)}}
function newChat(){modal('New conversation','<div class="choice-grid"><button id="directChoice">Direct chat</button><button id="groupChoice">Create group</button></div>');$('#directChoice').onclick=directModal;$('#groupChoice').onclick=groupModal}
function directModal(){modal('New direct chat','<input id="userSearch" class="modal-input" placeholder="Search name or email"><div id="userResults" class="result-list"></div>');$('#userSearch').oninput=async e=>{if(!e.target.value.trim())return;try{const d=await api('/api/chat/users?q='+encodeURIComponent(e.target.value));$('#userResults').innerHTML=d.users.map(u=>'<button class="result" data-u="'+u.id+'"><span class="avatar">'+esc(initials(u.name||u.email))+'</span><span>'+esc(u.name||u.email)+'<small>'+esc(u.email)+'</small></span></button>').join('');document.querySelectorAll('[data-u]').forEach(b=>b.onclick=async()=>{await openContact(+b.dataset.u);$('#modal')?.remove()})}catch(e){notify(e.message)}}}
function groupModal(){modal('Create group','<input id="groupTitle" class="modal-input" placeholder="Group name"><input id="memberSearch" class="modal-input" placeholder="Search members by name or email"><div id="memberResults" class="result-list"></div><div id="selectedMembers" class="selected-list"></div><button class="primary" id="createGroup">Create group</button>');const selected=new Map();$('#memberSearch').oninput=async e=>{if(!e.target.value.trim())return;try{const d=await api('/api/chat/users?q='+encodeURIComponent(e.target.value));$('#memberResults').innerHTML=d.users.map(u=>'<button class="result" data-g="'+u.id+'"><span class="avatar">'+esc(initials(u.name||u.email))+'</span><span>'+esc(u.name||u.email)+'<small>'+esc(u.email)+'</small></span></button>').join('');document.querySelectorAll('[data-g]').forEach(b=>b.onclick=()=>{selected.set(+b.dataset.g,1);renderSelected()})}catch(e){notify(e.message)}};function renderSelected(){$('#selectedMembers').innerHTML=[...selected.keys()].map(id=>'<span class="chip">User '+id+' <button data-x="'+id+'">×</button></span>').join('');document.querySelectorAll('[data-x]').forEach(b=>b.onclick=()=>{selected.delete(+b.dataset.x);renderSelected()})}$('#createGroup').onclick=async()=>{try{const d=await api('/api/chat/conversations/group',{method:'POST',body:JSON.stringify({title:$('#groupTitle').value,user_ids:[...selected.keys()]})});$('#modal').remove();await loadChats();openChat(d.conversation_id)}catch(e){notify(e.message)}}}
async function conversationInfo(){
 if(!state.active)return;
 try{
  const id=Number(state.active.id);
  const d=await api('/api/chat/conversations/'+id+'/details');
  const current=state.chats.find(x=>+x.id===id)||state.active;
  const group=d.conversation.conversation_type==='group';
  const directOther=group?null:d.members.find(x=>+x.user_id!==+state.me.id);
  let directBlocked=false;
  if(directOther){
   try{directBlocked=!!(await api('/api/chat/blocks/'+Number(directOther.user_id)+'/status')).blocked}catch{}
  }
  const meRole=d.members.find(x=>+x.user_id===+state.me.id)?.role||'member';
  const canManage=group&&(meRole==='owner'||meRole==='admin');
  const canPromote=group&&meRole==='owner';
  const otherName=directOther?.name||directOther?.email||'VexaAccount user';
  const identity=avatarMarkup(group?d.conversation:(directOther||d.conversation),'group-avatar');
  const members=d.members.map(m=>{
   const canRole=canPromote&&Number(m.user_id)!==Number(state.me.id)&&m.role!=='owner';
   const canRemove=canManage&&Number(m.user_id)!==Number(state.me.id)&&m.role!=='owner'&&(meRole==='owner'||m.role!=='admin');
   return '<div class="member"><div class="member-avatar">'+avatarMarkup(m,'avatar')+'</div><span class="member-copy"><b>'+esc(m.name||m.email)+'</b><small>'+esc(m.role)+' · '+esc(m.status||'offline')+'</small></span>'+(canRole?'<button class="member-action" data-role="'+m.user_id+'" data-next-role="'+(m.role==='admin'?'member':'admin')+'">'+(m.role==='admin'?'Demote':'Promote')+'</button>':'')+(canRemove?'<button class="member-action danger" data-remove="'+m.user_id+'">Remove</button>':'')+'</div>';
  }).join('');
  const directActions=!group
   ? '<section class="detail-section"><div class="detail-section-head"><div><b>About '+esc(otherName)+'</b><small>VexaAccount profile and conversation actions</small></div></div><div class="detail-about">'+
     '<div class="detail-about-row"><span>Username</span><b>'+esc(directOther?.username||'Not set')+'</b></div>'+
     '<div class="detail-about-row"><span>Email</span><b>'+esc(directOther?.email||'Not available')+'</b></div>'+
     '<div class="detail-about-row"><span>Status</span><b>'+esc(directOther?.status||'offline')+'</b></div>'+
     '<div class="detail-about-row"><span>Bio</span><b>'+esc(directOther?.bio||'No bio yet')+'</b></div>'+
     '</div></section>'+
     '<section class="detail-section"><div class="detail-section-head"><div><b>Actions</b><small>Real VexaChat conversation controls</small></div></div><div class="detail-action-grid">'+
     '<button class="primary" id="directMessage">💬 Message</button>'+
     '<button class="secondary" id="directVoice">☎ Voice call</button>'+
     '<button class="secondary" id="directVideo">▣ Video call</button>'+
     '<button class="secondary" id="directAddContact">＋ Add contact</button>'+
     '<button class="secondary" id="directSearch">⌕ Search messages</button>'+
     '<button class="secondary" id="directMute">🔕 '+(isChatMuted(current)?'Unmute':'Mute 24h')+'</button>'+
     '<button class="secondary" id="directArchive">▱ '+(Number(current.archived)?'Unarchive':'Archive')+'</button>'+
     '<button class="secondary" id="directPin">📌 '+(Number(current.pinned)?'Unpin':'Pin')+'</button>'+
     '<button class="'+(directBlocked?"primary":"danger")+'" id="blockContact">'+(directBlocked?"✓ Unblock user":"🚫 Block user")+'</button>'+
     '</div></section>'
   : '<section class="detail-section"><div class="detail-section-head"><div><b>Conversation</b><small>Quick controls</small></div></div><div class="detail-action-grid"><button class="secondary" id="mute">🔕 '+(isChatMuted(current)?'Unmute':'Mute 24h')+'</button><button class="secondary" id="archive">▱ '+(Number(current.archived)?'Unarchive':'Archive')+'</button><button class="secondary" id="pin">📌 '+(Number(current.pinned)?'Unpin':'Pin')+'</button><button class="secondary" id="addContact">＋ Add contact</button><button class="secondary" id="rename">✎ Rename</button></div></section>';
  modal(group?'Group details':'User & conversation details',
   '<div class="conversation-detail-page">'+
   '<section class="conversation-hero">'+identity+'<div class="conversation-identity"><h2>'+esc(group?nameOf(state.active):otherName)+'</h2><p>'+esc(group?(d.members.length+' members'):(directOther?.status||'Private conversation'))+'</p><span class="detail-role">'+esc(group?meRole:(directBlocked?'Blocked':'Contact conversation'))+'</span></div></section>'+
   (group?'<input id="groupAvatarFile" type="file" hidden accept="image/*" capture="environment"><div class="detail-photo-actions"><button class="secondary" id="changeGroupAvatar" type="button">Change photo</button>'+(d.conversation.avatar_url?'<button class="ghost" id="removeGroupAvatar" type="button">Remove photo</button>':'')+'</div>':'')+
   (group?'<section class="detail-section"><div class="detail-section-head"><div><b>Members</b><small>'+d.members.length+' people</small></div>'+(canManage?'<button class="secondary" id="addMember">＋ Add</button>':'')+'</div><div class="member-list">'+members+'</div></section>':'')+
   directActions+
   '</div>');
  const applySetting=async(v)=>{await setChatSetting(v);};
  $('#mute')?.addEventListener('click',()=>applySetting(isChatMuted(current)?{muted_until:null}:{muted_until:new Date(Date.now()+86400000).toISOString()}));
  $('#archive')?.addEventListener('click',()=>applySetting({archived:Number(current.archived)!==1}));
  $('#pin')?.addEventListener('click',()=>applySetting({pinned:Number(current.pinned)!==1}));
  $('#directMute')?.addEventListener('click',()=>applySetting(isChatMuted(current)?{muted_until:null}:{muted_until:new Date(Date.now()+86400000).toISOString()}));
  $('#directArchive')?.addEventListener('click',()=>applySetting({archived:Number(current.archived)!==1}));
  $('#directPin')?.addEventListener('click',()=>applySetting({pinned:Number(current.pinned)!==1}));
  $('#directMessage')?.addEventListener('click',()=>{$('#modal')?.remove();showMobileChat();$('#messageInput')?.focus()});
  $('#directSearch')?.addEventListener('click',()=>{$('#modal')?.remove();messageSearch()});
  $('#rename')?.addEventListener('click',renameGroup);
  $('#addMember')?.addEventListener('click',addMember);
  $('#addContact')?.addEventListener('click',addCurrentContact);
  $('#directAddContact')?.addEventListener('click',addCurrentContact);
  $('#directVoice')?.addEventListener('click',async()=>{$('#modal')?.remove();await startCall('voice')});
  $('#directVideo')?.addEventListener('click',async()=>{$('#modal')?.remove();await startCall('video')});
  $('#blockContact')?.addEventListener('click',blockCurrentContact);
  if(group){
   const gf=$('#groupAvatarFile');
   $('#changeGroupAvatar')?.addEventListener('click',()=>gf?.click());
   gf?.addEventListener('change',async()=>{
    const file=gf.files?.[0];if(!file)return;
    if(!file.type.startsWith('image/'))return notify('Please choose an image file');
    if(file.size>8*1024*1024)return notify('Group photos must be 8 MB or smaller');
    try{
     notify('Uploading group photo…');
     const dataUrl=await new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=()=>reject(Error('Could not read image'));fr.readAsDataURL(file)});
     const up=await api('/api/account/storage/cloudinary-upload',{method:'POST',body:JSON.stringify({dataUrl,displayName:'VexaChat group photo'})});
     const url=up.file?.url;if(!url)throw Error('Photo upload did not return a URL');
     await api('/api/chat/conversations/'+id,{method:'PATCH',body:JSON.stringify({avatar_url:url})});
     $('#modal')?.remove();await loadChats();state.active=state.chats.find(x=>+x.id===id)||state.active;renderActive();await conversationInfo();notify('Group photo updated');
    }catch(e){notify(e.message||'Group photo upload failed')}finally{gf.value=''}
   });
   $('#removeGroupAvatar')?.addEventListener('click',async()=>{try{await api('/api/chat/conversations/'+id,{method:'PATCH',body:JSON.stringify({avatar_url:null})});$('#modal')?.remove();await loadChats();state.active=state.chats.find(x=>+x.id===id)||state.active;renderActive();await conversationInfo();notify('Group photo removed')}catch(e){notify(e.message)}});
  }
  document.querySelectorAll('[data-remove]').forEach(btn=>btn.onclick=async()=>{try{btn.disabled=true;await api('/api/chat/conversations/'+id+'/members/'+btn.dataset.remove,{method:'DELETE'});$('#modal').remove();await loadChats();await conversationInfo();notify('Member removed')}catch(e){btn.disabled=false;notify(e.message)}});
  document.querySelectorAll('[data-role]').forEach(btn=>btn.onclick=async()=>{try{btn.disabled=true;await api('/api/chat/conversations/'+id+'/members/'+btn.dataset.role,{method:'PATCH',body:JSON.stringify({role:btn.dataset.nextRole})});$('#modal').remove();await loadChats();await conversationInfo();notify(btn.dataset.nextRole==='admin'?'Administrator promoted':'Administrator demoted')}catch(e){btn.disabled=false;notify(e.message)}});
 }catch(e){notify(e.message||'Could not open conversation details')}
}
async function setChatSetting(v){try{const d=await api('/api/chat/conversations/'+state.active.id+'/settings',{method:'POST',body:JSON.stringify(v)});const c=state.chats.find(x=>+x.id===+state.active.id);if(c)Object.assign(c,d.settings||v);$('#modal')?.remove();renderChats();notify(v.muted_until?'Notifications muted for this conversation':'Conversation updated')}catch(e){notify(e.message)}}
async function renameGroup(){if(!state.active)return;const current=nameOf(state.active);modal('Rename group','<label class="modal-label">Group name</label><input id="groupRenameInput" class="modal-input" maxlength="120" value="'+esc(current)+'" placeholder="Enter group name"><div class="modal-actions"><button class="secondary" id="renameCancel">Cancel</button><button class="primary" id="renameSave">Save</button></div>');const input=$('#groupRenameInput');$('#renameCancel').onclick=()=>$('#modal')?.remove();const save=async()=>{const title=input.value.trim();if(!title)return notify('Enter a group name');try{await api('/api/chat/conversations/'+state.active.id,{method:'PATCH',body:JSON.stringify({title})});await loadChats();state.active=state.chats.find(x=>+x.id===+state.active.id);renderActive();$('#modal')?.remove();notify('Group renamed')}catch(e){notify(e.message)}};$('#renameSave').onclick=save;input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();save()}if(e.key==='Escape')$('#renameCancel').click()};input.focus();input.select()}
async function blockCurrentContact(){if(state.active?.conversation_type!=='direct')return notify('Block is available for direct conversations');try{const d=await api('/api/chat/conversations/'+state.active.id+'/details');const other=d.members.find(x=>+x.user_id!==+state.me.id);if(!other)return;const status=await api('/api/chat/blocks/'+Number(other.user_id)+'/status');if(status.blocked){await api('/api/chat/blocks/'+Number(other.user_id),{method:'DELETE'});notify('User unblocked')}else{await api('/api/chat/blocks',{method:'POST',body:JSON.stringify({user_id:other.user_id})});notify('User blocked')}$('#modal')?.remove();await loadChats();renderActive();}catch(e){notify(e.message)}}

async function addCurrentContact(){if(state.active?.conversation_type!=='direct')return notify('Open a direct conversation to add a contact');try{const d=await api('/api/chat/conversations/'+state.active.id+'/details');const other=d.members.find(x=>+x.user_id!==+state.me.id);if(other){await api('/api/chat/contacts',{method:'POST',body:JSON.stringify({user_id:other.user_id})});await loadContacts();notify('Contact saved')}}catch(e){notify(e.message)}}
async function addMember(){if(!state.active)return;modal('Add member','<input id="memberLookup" class="modal-input" placeholder="Search name or email"><div id="memberLookupResults" class="result-list"></div>');let timer=null;$('#memberLookup').oninput=e=>{clearTimeout(timer);const q=e.target.value.trim();if(!q){$('#memberLookupResults').innerHTML='';return}timer=setTimeout(async()=>{try{const d=await api('/api/chat/users?q='+encodeURIComponent(q));const users=(d.users||[]).filter(u=>Number(u.id)!==Number(state.me?.id));$('#memberLookupResults').innerHTML=users.slice(0,20).map(u=>'<button class="result" data-member="'+u.id+'"><span class="avatar">'+esc(initials(u.name||u.email))+'</span><span>'+esc(u.name||u.email)+'<small>'+esc(u.email||'VexaAccount user')+'</small></span></button>').join('')||'<div class="side-empty">No users found.</div>';document.querySelectorAll('[data-member]').forEach(b=>b.onclick=async()=>{try{await api('/api/chat/conversations/'+state.active.id+'/members',{method:'POST',body:JSON.stringify({user_id:Number(b.dataset.member)})});$('#modal')?.remove();await conversationInfo();await loadChats();notify('Member added')}catch(e){notify(e.message)}})}catch(e){notify(e.message)}},180)}}
function openAppSurface(view){
 const title=view==='contacts'?'Contacts':'Calls';
 const body=view==='contacts'
  ? '<div class="app-surface-page"><div class="app-surface-toolbar"><div><strong>Contacts</strong><span id="surfaceCount"></span></div><button class="primary" id="surfaceAddContact">＋ Add contact</button></div><label class="surface-search"><span>⌕</span><input id="surfaceSearch" placeholder="Search contacts"></label><div class="app-surface-list" id="surfaceList"></div></div>'
  : '<div class="app-surface-page"><div class="app-surface-toolbar"><div><strong>Calls</strong><span>Recent voice and video activity</span></div><button class="secondary" id="surfaceRefreshCalls">↻ Refresh</button></div><div class="app-surface-list" id="surfaceList"></div></div>';
 modal(title,body);
 const list=$('#surfaceList');
 const draw=()=>{
  if(view==='contacts'){
   const q=String($('#surfaceSearch')?.value||'').trim().toLowerCase();
   const rows=state.contacts.filter(c=>!q||String(c.name||'').toLowerCase().includes(q)||String(c.email||'').toLowerCase().includes(q)).map(c=>'<button class="surface-row" data-surface-contact="'+Number(c.user_id)+'">'+avatarMarkup(c,'avatar')+'<span class="surface-row-main"><b>'+esc(c.name||c.email||'Contact')+'</b><small>'+esc(c.email||'VexaAccount contact')+' · '+esc(c.status||'offline')+'</small></span><span>›</span></button>').join('');
   list.innerHTML=rows||'<div class="side-empty"><strong>No contacts found</strong><span>Try another name or add a contact.</span></div>';
   $('#surfaceCount').textContent=state.contacts.length+' contact'+(state.contacts.length===1?'':'s');
   list.querySelectorAll('[data-surface-contact]').forEach(b=>b.onclick=()=>contactDetails(Number(b.dataset.surfaceContact)));
  }else{
   const calls=[...state.calls].sort((a,b)=>new Date(b.started_at||0)-new Date(a.started_at||0));
   list.innerHTML=calls.map(c=>{const out=Number(c.caller_id)===Number(state.me?.id),who=out?(c.peer_name||c.conversation_title||'Contact'):(c.caller_name||c.caller_email||'Contact');const p=out?{name:c.peer_name||c.peer_email,avatar_url:c.peer_avatar}:{name:c.caller_name||c.caller_email,avatar_url:c.caller_avatar};return '<div class="surface-row '+(String(c.status)==='missed'?'missed':'')+'">'+avatarMarkup(p,'avatar')+'<span class="surface-row-main"><b>'+esc(who)+'</b><small>'+esc(c.call_type==='video'?'Video call':'Voice call')+' · '+esc(callStatusLabel(c))+(callDuration(c)?' · '+esc(callDuration(c)):'')+'</small></span><span class="surface-row-meta">'+esc(callDate(c.started_at))+'<button class="surface-row-call" data-surface-redial="'+Number(c.conversation_id)+'">↗</button></span></div>'}).join('')||'<div class="side-empty"><strong>No calls yet</strong><span>Your voice and video call history will appear here.</span></div>';
   list.querySelectorAll('[data-surface-redial]').forEach(b=>b.onclick=async e=>{e.stopPropagation();await openChat(Number(b.dataset.surfaceRedial));const c=calls.find(x=>Number(x.conversation_id)===Number(b.dataset.surfaceRedial));await startCall(c?.call_type==='video'?'video':'voice')});
  }
 };
 $('#surfaceSearch')?.addEventListener('input',draw);
 $('#surfaceAddContact')?.addEventListener('click',addContactModal);
 $('#surfaceRefreshCalls')?.addEventListener('click',async()=>{await loadCalls();draw();notify('Calls refreshed')});
 draw();
}
async function profile(){
 const me=state.me||{};
 const avatar=me.avatar_url||'';
 const photo=avatar?'<img src="'+esc(avatar)+'" alt="Profile photo">':'<span>'+esc(initials(me.name||me.email))+'</span>';
 modal('Profile','<div class="profile-page">'+
 '<section class="profile-hero"><div class="profile-photo-wrap"><div class="profile-photo" id="profilePhoto">'+photo+'</div><button class="profile-photo-edit" id="changeProfilePhoto" type="button" aria-label="Change profile photo">✎</button></div><div class="profile-identity"><h2>'+esc(me.name||'VexaAccount user')+'</h2><p>'+esc(me.email||'')+'</p><span class="profile-status">● '+esc(me.status||'online')+'</span></div></section>'+
 '<input id="profilePhotoFile" type="file" hidden accept="image/*" capture="user">'+
 '<div class="profile-photo-actions"><button class="secondary" id="chooseProfilePhoto">Change photo</button>'+(avatar?'<button class="ghost" id="removeProfilePhoto">Remove photo</button>':'')+'</div>'+
 '<section class="profile-section"><div class="profile-section-title"><h3>Personal information</h3><span>Visible to your VexaChat contacts</span></div>'+
 '<label class="profile-field"><span>Display name</span><input id="profileName" value="'+esc(me.name||'')+'" maxlength="255" placeholder="Your name"></label>'+
 '<label class="profile-field"><span>First name</span><input id="profileFirstName" value="'+esc(me.first_name||'')+'" maxlength="120" placeholder="First name"></label>'+
 '<label class="profile-field"><span>Last name</span><input id="profileLastName" value="'+esc(me.last_name||'')+'" maxlength="120" placeholder="Last name"></label>'+
 '<label class="profile-field"><span>Phone</span><input id="profilePhone" type="tel" value="'+esc(me.phone||'')+'" maxlength="40" placeholder="Phone number"></label>'+
 '<label class="profile-field"><span>Bio</span><textarea id="profileBio" maxlength="500" rows="3" placeholder="Tell people a little about yourself">'+esc(me.bio||'')+'</textarea></label>'+
 '<label class="profile-field"><span>Country</span><input id="profileCountry" value="'+esc(me.country||'')+'" maxlength="120" placeholder="Country"></label>'+
 '<button class="primary profile-save" id="saveProfile" type="button">Save profile</button></section>'+
 '<section class="profile-menu"><button class="profile-menu-row" id="profilePrivacy"><span class="profile-menu-icon">⌁</span><span><b>Privacy & Security</b><small>Last seen, profile photo, calls and read receipts</small></span><strong>›</strong></button>'+
 '<button class="profile-menu-row" id="profileNotifications"><span class="profile-menu-icon">◉</span><span><b>Notifications</b><small>Messages, previews and calls</small></span><strong>›</strong></button>'+
 '<button class="profile-menu-row" id="profileSettings"><span class="profile-menu-icon">⚙</span><span><b>VexaChat Settings</b><small>Appearance, chats, data, language and help</small></span><strong>›</strong></button>'+
 '<button class="profile-menu-row" id="profileSecurity"><span class="profile-menu-icon">🔐</span><span><b>Account Security</b><small>Password, 2FA and account protection</small></span><strong>›</strong></button>'+
 '</section><button class="danger profile-signout" id="logout">Sign out</button></div>');
 const file=$('#profilePhotoFile');
 const gallery=document.createElement('input');gallery.type='file';gallery.accept='image/*';gallery.hidden=true;document.body.appendChild(gallery);

 const uploadProfilePhoto=async(f)=>{if(!f)return;if(!f.type.startsWith('image/'))return notify('Please choose an image file');if(f.size>8*1024*1024)return notify('Profile photos must be 8 MB or smaller');try{notify('Uploading profile photo…');const dataUrl=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error('Could not read image'));r.readAsDataURL(f)});const up=await api('/api/account/storage/cloudinary-upload',{method:'POST',body:JSON.stringify({dataUrl,displayName:'VexaChat profile photo'})});const url=up.file?.url;if(!url)throw Error('Photo upload did not return a URL');state.me=(await api('/api/chat/profile',{method:'PATCH',body:JSON.stringify({avatar_url:url})})).user;profile();notify('Profile photo updated')}catch(e){notify(e.message||'Photo upload failed')}};
 let profileCameraStream=null;
const stopProfileCamera=()=>{profileCameraStream?.getTracks().forEach(t=>t.stop());profileCameraStream=null};
const openLiveCamera=async()=>{if(!navigator.mediaDevices?.getUserMedia)return notify('Live camera is not supported on this device');modal('Take profile photo','<div class="profile-camera"><video id="profileCameraVideo" autoplay playsinline muted></video><canvas id="profileCameraCanvas" hidden></canvas><p class="settings-note">Allow camera access, position your face, then capture a photo.</p><div class="modal-actions"><button class="secondary" id="cameraCancel">Cancel</button><button class="primary" id="captureProfilePhoto">Capture photo</button></div></div>');try{profileCameraStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'user'},width:{ideal:1280},height:{ideal:1280}},audio:false});const video=$('#profileCameraVideo');if(video){video.srcObject=profileCameraStream;await video.play().catch(()=>{})}}catch(e){stopProfileCamera();$('#modal')?.remove();notify('Camera permission is required to take a profile photo');return}$('#cameraCancel').onclick=()=>{stopProfileCamera();$('#modal')?.remove()};$('#captureProfilePhoto').onclick=async()=>{const video=$('#profileCameraVideo'),canvas=$('#profileCameraCanvas');if(!video||!canvas||video.readyState<2)return notify('Camera is not ready yet');const max=1200,scale=Math.min(1,max/Math.max(video.videoWidth||1,video.videoHeight||1));canvas.width=Math.max(1,Math.round((video.videoWidth||1)*scale));canvas.height=Math.max(1,Math.round((video.videoHeight||1)*scale));canvas.getContext('2d',{alpha:false}).drawImage(video,0,0,canvas.width,canvas.height);const dataUrl=canvas.toDataURL('image/jpeg',0.9);stopProfileCamera();$('#modal')?.remove();try{const blob=await (await fetch(dataUrl)).blob();const f=new File([blob],'vexachat-profile-photo.jpg',{type:'image/jpeg'});await uploadProfilePhoto(f)}catch(e){notify(e.message||'Could not capture profile photo')}}};
const openPhotoActions=()=>{modal('Profile photo','<div class="choice-grid"><button id="photoGallery" type="button"><b>Gallery</b><small>Choose from local files</small></button><button id="photoCamera" type="button"><b>Camera</b><small>Open the live camera</small></button></div><button class="secondary context-cancel" id="photoCancel" type="button">Cancel</button>');$('#photoGallery').onclick=()=>{$('#modal')?.remove();gallery.click()};$('#photoCamera').onclick=()=>{openLiveCamera()};$('#photoCancel').onclick=()=>$('#modal')?.remove()};
 $('#chooseProfilePhoto')?.addEventListener('click',openPhotoActions);$('#changeProfilePhoto')?.addEventListener('click',openPhotoActions);
 file?.addEventListener('change',()=>{const f=file.files?.[0];uploadProfilePhoto(f).finally(()=>{file.value=''})});
 gallery.addEventListener('change',()=>{const f=gallery.files?.[0];uploadProfilePhoto(f).finally(()=>{gallery.value=''})});
 
 $('#removeProfilePhoto')?.addEventListener('click',async()=>{try{state.me=(await api('/api/chat/profile',{method:'PATCH',body:JSON.stringify({avatar_url:null})})).user;profile();notify('Profile photo removed')}catch(e){notify(e.message)}});
 $('#saveProfile')?.addEventListener('click',async()=>{try{const d=await api('/api/chat/profile',{method:'PATCH',body:JSON.stringify({name:$('#profileName').value.trim(),first_name:$('#profileFirstName').value.trim(),last_name:$('#profileLastName').value.trim(),phone:$('#profilePhone').value.trim(),bio:$('#profileBio').value.trim(),country:$('#profileCountry').value.trim()})});state.me=d.user;profile();notify('Profile updated')}catch(e){notify(e.message)}});
 $('#profilePrivacy')?.addEventListener('click',()=>{document.querySelector('#modal')?.remove();window.VexaChatSettings?.open({state,api,modal,profile,logout,notify,initials,esc},'privacy')});
 $('#profileNotifications')?.addEventListener('click',()=>{document.querySelector('#modal')?.remove();window.VexaChatSettings?.open({state,api,modal,profile,logout,notify,initials,esc},'notifications')});
 $('#profileSettings')?.addEventListener('click',()=>{document.querySelector('#modal')?.remove();window.VexaChatSettings?.open({state,api,modal,profile,accountSecurity,logout,notify,initials,esc})});
 $('#profileSecurity')?.addEventListener('click',()=>accountSecurity());
 $('#logout')?.addEventListener('click',logout);
}
async function accountSecurity(){
 modal('Account Security','<div class="security-page"><div class="security-banner"><b>Protect your VexaAccount</b><span>VexaChat uses the same verified VexaAccount identity and security controls without leaving the app.</span></div><div class="settings-card"><button class="settings-action" id="security2fa"><b>Authenticator 2FA</b><span>Set up, verify or disable two-factor authentication</span></button><button class="settings-action" id="securityPassword"><b>Change password</b><span>Update your VexaAccount password securely inside VexaChat</span></button></div></div>');
 $('#security2fa').onclick=security2fa;
 $('#securityPassword').onclick=securityPassword;
}
async function security2fa(){
 try{
  const d=await api('/api/auth/profile');
  const enabled=!!(d.user?.twofa_enabled);
  modal('Authenticator 2FA','<div class="security-page"><p>'+(enabled?'Two-factor authentication is currently enabled.':'Authenticator 2FA is currently disabled.')+'</p>'+(enabled?'<button class="danger" id="disable2fa">Disable 2FA</button>':'<button class="primary" id="start2fa">Set up authenticator</button>')+'</div>');
  const start=$('#start2fa');
  if(start)start.onclick=()=>{modal('Set up authenticator 2FA','<form id="twofaSetup" class="stack-form"><label>Account password<input id="secPassword" type="password" autocomplete="current-password" required></label><button class="primary" type="submit">Generate setup</button></form>');const form=$('#twofaSetup');if(form)form.onsubmit=async e=>{e.preventDefault();try{const x=await api('/api/auth/twofa/generate',{method:'POST'});modal('Confirm authenticator','<form id="twofaEnable" class="stack-form"><p>Scan the QR code with your authenticator app.</p>'+(x.qrCode?'<img class="twofa-qr" src="'+esc(x.qrCode)+'" alt="Authenticator QR code">':'')+'<p>Manual secret: <code>'+esc(x.secret)+'</code></p><label>Authenticator code<input id="secOtp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required></label><button class="primary" type="submit">Enable 2FA</button></form>');const ef=$('#twofaEnable');if(ef)ef.onsubmit=async ev=>{ev.preventDefault();try{const y=await api('/api/auth/twofa/verify-enable',{method:'POST',body:JSON.stringify({secret:x.secret,token:$('#secOtp').value.trim()})});notify(y.message||'Authenticator 2FA enabled');security2fa()}catch(err){notify(err.message)}}}catch(err){notify(err.message)}}};
  const disable=$('#disable2fa');
  if(disable)disable.onclick=async()=>{try{const y=await api('/api/auth/twofa/disable',{method:'POST'});notify(y.message||'2FA disabled');security2fa()}catch(err){notify(err.message)}};
 }catch(e){notify(e.message)}
}
async function securityPassword(){
 modal('Change password','<form id="passwordChangeForm" class="stack-form"><label>Current password<input id="currentPassword" type="password" autocomplete="current-password" required></label><label>New password<input id="newPassword" type="password" autocomplete="new-password" minlength="8" required></label><label>Confirm new password<input id="confirmPassword" type="password" autocomplete="new-password" minlength="8" required></label><button class="primary" type="submit">Change password</button></form>');
 $('#passwordChangeForm').onsubmit=async e=>{e.preventDefault();const next=$('#newPassword').value;if(next!==$('#confirmPassword').value)return notify('New passwords do not match');try{const d=await api('/api/auth/change-password',{method:'POST',body:JSON.stringify({currentPassword:$('#currentPassword').value,newPassword:next})});notify(d.message||'Password changed');localStorage.removeItem('vexaaccount_access_token');sessionStorage.removeItem('vexaaccount_access_token');$('#modal')?.remove();authGate('Password changed. Please sign in again.')}catch(err){notify(err.message)}};
}
async function notificationSettings(){modal('Notifications','<label class="check"><input id="nm" type="checkbox" '+(state.settings.messages_enabled?'checked':'')+'> Message notifications</label><label class="check"><input id="nc" type="checkbox" '+(state.settings.calls_enabled?'checked':'')+'> Call notifications</label><label class="check"><input id="np" type="checkbox" '+(state.settings.previews_enabled?'checked':'')+'> Message previews</label><button class="primary" id="saveNotif">Save</button>');$('#saveNotif').onclick=async()=>{state.settings=(await api('/api/chat/notifications/settings',{method:'PUT',body:JSON.stringify({messages_enabled:$('#nm').checked,calls_enabled:$('#nc').checked,previews_enabled:$('#np').checked})})).settings;$('#modal').remove()}}
async function logout(){try{await api('/api/auth/logout',{method:'POST'})}catch{}localStorage.removeItem('vexaaccount_access_token');sessionStorage.removeItem('vexaaccount_access_token');document.querySelector('#modal')?.remove();authGate('Signed out of VexaChat.');}
async function startCall(type){if(!state.active||state.callId)return;try{state.callType=type;state.callStartedAt=Date.now();state.callId=(await api('/api/chat/calls',{method:'POST',body:JSON.stringify({conversation_id:state.active.id,call_type:type})})).call_id;await createPeer(true)}catch(e){notify(e.message);const id=state.callId;try{if(id)await api('/api/chat/calls/'+id,{method:'PATCH',body:JSON.stringify({status:'declined'})});if(id)await api('/api/chat/calls/'+id+'/signal',{method:'POST',body:JSON.stringify({signal_type:'decline',payload:{reason:'media_permission'}})})}catch{}cleanupCallUi();loadCalls().catch(()=>{})}}
function incomingCall(x){if(!x?.call_id||Number(x.caller_id)===Number(state.me?.id))return;if(state.incomingCallData&&String(state.incomingCallData.call_id)===String(x.call_id))return;if(state.callId&&String(state.callId)!==String(x.call_id))return;state.callId=x.call_id;state.callType=x.call_type==='video'?'video':'voice';state.callStartedAt=null;state.incomingCallData=x;state.pendingCallSignals=[];state.seenIncomingCalls[x.call_id]=Date.now();clearTimeout(state.incomingCallTimer);const who=x.caller_name||x.caller_email||'Contact';const callerAvatar=x.caller_avatar||'';state.incomingCallTimer=setTimeout(async()=>{if(String(state.callId)===String(x.call_id)){try{await api('/api/chat/calls/'+x.call_id,{method:'PATCH',body:JSON.stringify({status:'missed'})});await api('/api/chat/calls/'+x.call_id+'/signal',{method:'POST',body:JSON.stringify({signal_type:'hangup',payload:{reason:'timeout'}})})}catch{}cleanupCallUi();loadCalls().catch(()=>{});notify('Missed call from '+who)}},30000);const icon=state.callType==='video'?'▣':'☎';if(state.settings?.calls_enabled!==0&&state.settings?.calls_enabled!==false&&'Notification' in window&&Notification.permission==='granted')new Notification('Incoming '+state.callType+' call',{body:state.settings?.previews_enabled===0||state.settings?.previews_enabled===false?'Incoming call from '+who:who,tag:'vexachat-call-'+x.call_id});modal('Incoming '+state.callType+' call','<div class="incoming-call-card"><div class="incoming-avatar">'+(callerAvatar?'<img src="'+esc(callerAvatar)+'" alt="" loading="lazy">':esc(initials(who)))+'</div><div class="incoming-call-type">'+icon+'</div><strong>'+esc(who)+'</strong><small>'+esc(state.callType==='video'?'Video call':'Voice call')+'</small><div class="incoming-actions"><button class="danger" id="declineCall">Decline</button><button class="primary" id="acceptCall">Accept</button></div></div>');$('#acceptCall').onclick=async()=>{try{state.callStartedAt=Date.now();await createPeer(false);const queued=state.pendingCallSignals.splice(0);for(const sig of queued)await handleSignal(sig);try{const sd=await api('/api/chat/calls/'+state.callId+'/signals?after=0');for(const sig of (sd.signals||[]))await handleSignal(sig)}catch{}await api('/api/chat/calls/'+state.callId,{method:'PATCH',body:JSON.stringify({status:'active'})});$('#modal')?.remove()}catch(e){notify(e.message);await endCall('declined')}};$('#declineCall').onclick=async()=>{await endCall('declined');$('#modal')?.remove()}}
async function createPeer(offer){state.pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});state.pc.onicecandidate=e=>e.candidate&&signal('ice',e.candidate).catch(()=>{});state.pc.onconnectionstatechange=()=>{const s=state.pc?.connectionState;if(s==='connected'){connectionStatus('Connected · call active');return}if(['failed','closed'].includes(s)&&state.callId){notify('Call connection lost');endCall('ended').catch(()=>{})}};state.pc.oniceconnectionstatechange=()=>{const s=state.pc?.iceConnectionState;if(s==='disconnected')notify('Call network interrupted, reconnecting…');if(s==='failed'&&state.callId)endCall('ended').catch(()=>{})};if(!$('#callWindow'))document.body.insertAdjacentHTML('beforeend','<div class="call-window" id="callWindow"><div class="call-stage"><video id="remoteVideo" autoplay playsinline></video><video id="localVideo" autoplay muted playsinline></video><div id="callLabel">'+esc(state.callType==='video'?'Video call':'Voice call')+'</div></div><div class="call-controls"><button id="muteCall">Mute</button><button id="cameraCall" '+(state.callType==='video'?'':'hidden')+'>Camera</button><button class="danger" id="hangup">End call</button></div></div>');state.pc.ontrack=e=>{const v=$('#remoteVideo');if(v){v.srcObject=e.streams[0];v.play?.().catch(()=>{})}};try{if(!navigator.mediaDevices?.getUserMedia)throw Error('Media capture is unavailable in this browser or app');const s=await navigator.mediaDevices.getUserMedia({audio:true,video:state.callType==='video'});state.localStream=s;s.getTracks().forEach(t=>state.pc.addTrack(t,s));const lv=$('#localVideo');if(lv){lv.srcObject=s;lv.play?.().catch(()=>{})}$('#muteCall').onclick=()=>{const t=s.getAudioTracks()[0];if(t){t.enabled=!t.enabled;$('#muteCall').textContent=t.enabled?'Mute':'Unmute'}};$('#cameraCall')?.addEventListener('click',()=>{const t=s.getVideoTracks()[0];if(t){t.enabled=!t.enabled;$('#cameraCall').textContent=t.enabled?'Camera off':'Camera on'}});$('#hangup').onclick=()=>endCall('ended')}catch(e){notify(e.message||'Camera/microphone permission is required');state.pc?.close();state.pc=null;throw e}if(offer){const o=await state.pc.createOffer();await state.pc.setLocalDescription(o);await signal('offer',o)}}
async function signal(type,payload){if(state.callId)await api('/api/chat/calls/'+state.callId+'/signal',{method:'POST',body:JSON.stringify({signal_type:type,payload})})}
function cleanupCallUi(){clearTimeout(state.incomingCallTimer);state.incomingCallTimer=null;state.localStream?.getTracks().forEach(t=>t.stop());state.localStream=null;state.pc?.close();state.pc=null;state.callId=null;state.callType=null;state.callStartedAt=null;state.incomingCallData=null;state.pendingCallSignals=[];$('#callWindow')?.remove();$('#modal')?.remove()}
async function endCall(status='ended'){const id=state.callId;try{if(id){await api('/api/chat/calls/'+id,{method:'PATCH',body:JSON.stringify({status})});const signal_type=status==='declined'?'decline':'hangup';await api('/api/chat/calls/'+id+'/signal',{method:'POST',body:JSON.stringify({signal_type,payload:{}})})}}catch{}cleanupCallUi();loadCalls().catch(()=>{})}
async function handleSignal(x){if(String(x.call_id)!==String(state.callId)||+x.sender_id===+state.me.id)return;if(['offer','answer','ice'].includes(x.signal_type)&&!state.pc){if(!state.pendingCallSignals.some(s=>String(s.id||'')===String(x.id||'')&&s.signal_type===x.signal_type)){state.pendingCallSignals.push(x)}return}const p=x.payload;if(x.signal_type==='offer'){if(!state.pc)await createPeer(false);await state.pc.setRemoteDescription(p);const a=await state.pc.createAnswer();await state.pc.setLocalDescription(a);await signal('answer',a)}else if(x.signal_type==='answer'&&state.pc)await state.pc.setRemoteDescription(p);else if(x.signal_type==='ice'&&state.pc)try{await state.pc.addIceCandidate(p)}catch{}else if(['hangup','decline'].includes(x.signal_type)){cleanupCallUi();loadCalls().catch(()=>{});notify(x.signal_type==='decline'?'Call declined':'Call ended')}}

// VexaChat UI v8 interaction layer.
// Keeps the existing API-backed messenger logic intact while adding a denser, familiar
// Telegram-style navigation surface, mobile drawer behavior, keyboard shortcuts and
// resilient focus handling. No Telegram source code or proprietary assets are used.
const _vexaOriginalShell=shell;
shell=function(){
  _vexaOriginalShell();
  const sidebar=document.querySelector('.sidebar');
  const main=document.querySelector('.main');
  const head=document.querySelector('.chat-head');
  if(!sidebar||!main||!head)return;
  if(!document.querySelector('#mobileMenu')){
    const b=document.createElement('button');
    b.id='mobileMenu'; b.className='icon-btn mobile-only menu-trigger';
    b.type='button'; b.setAttribute('aria-label','Open navigation'); b.title='Navigation';
    b.textContent='☰';
    head.insertBefore(b,head.firstChild);
    b.addEventListener('click',()=>document.body.classList.add('nav-drawer-open'));
  }
  if(!document.querySelector('#navScrim')){
    const s=document.createElement('button');
    s.id='navScrim'; s.className='nav-scrim'; s.type='button';
    s.setAttribute('aria-label','Close navigation');
    document.body.appendChild(s);
    s.addEventListener('click',()=>document.body.classList.remove('nav-drawer-open'));
  }
function installVexaNavigation(){
  if(document.querySelector('#vexaNavDrawer'))return;
  const drawer=document.createElement('aside');
  drawer.id='vexaNavDrawer';
  drawer.className='vexa-nav-drawer';
  drawer.setAttribute('aria-label','VexaChat navigation');
  drawer.innerHTML='<div class="nav-drawer-head"><div class="avatar nav-drawer-avatar"><img src="./icon.svg" alt="VexaChat"></div><div><strong>VexaChat</strong><small>VexaAccount messenger</small></div><button type="button" class="icon-btn" data-nav-close aria-label="Close menu">×</button></div>'+
    '<button type="button" class="nav-account-row" data-nav="profile"><div class="avatar">'+avatarMarkup(state.me||{},'avatar')+'</div><span><b>'+esc(state.me?.name||state.me?.email||'Account')+'</b><small>'+esc(state.me?.email||'Connected account')+'</small></span><strong>›</strong></button>'+
    '<nav class="nav-drawer-list">'+
      '<button type="button" data-nav="chats"><i>⌂</i><span>Chats</span></button>'+
      '<button type="button" data-nav="newGroup"><i>👥</i><span>New Group</span></button>'+
      '<button type="button" data-nav="contacts"><i>♙</i><span>Contacts</span></button>'+
      '<button type="button" data-nav="calls"><i>☎</i><span>Calls</span></button>'+
      '<button type="button" data-nav="saved"><i>🔖</i><span>Saved Messages</span></button>'+
      '<button type="button" data-nav="profile"><i>●</i><span>Profile</span></button>'+
      '<button type="button" data-nav="settings"><i>⚙</i><span>Settings</span></button>'+
      '<button type="button" data-nav="folders"><i>▤</i><span>Chat Folders</span></button>'+
    '</nav>'+
    '<div class="nav-drawer-divider"></div><nav class="nav-drawer-list nav-secondary">'+
      '<button type="button" data-nav="invite"><i>↗</i><span>Invite Friends</span></button>'+
      '<button type="button" data-nav="features"><i>✦</i><span>VexaChat Features</span></button>'+
      '<button type="button" data-nav="logout"><i>⇥</i><span>Sign out</span></button>'+
    '</nav>'+
    '<div class="nav-drawer-foot"><small>VexaAccount · Secure session</small></div>';
  document.body.appendChild(drawer);
  const close=()=>document.body.classList.remove('nav-drawer-open');
  drawer.querySelector('[data-nav-close]')?.addEventListener('click',close);
  drawer.querySelectorAll('[data-nav]').forEach(b=>b.addEventListener('click',()=>{
    const v=b.dataset.nav;
    close();
    if(v==='newGroup'){groupModal();return}
    if(v==='profile'){profile();return}
    if(v==='settings'){window.VexaChatSettings?.open({state,api,modal,profile,accountSecurity,logout,notify,initials,esc});return}
    if(v==='contacts'||v==='calls'){openAppSurface(v);return}
    if(v==='folders'){modal('Chat folders','<div class="hint">Chat folders are managed from your VexaChat settings.</div>');return}
    if(v==='saved'){notify('Saved Messages is not connected to a dedicated backend route yet.');return}
    if(v==='invite'){notify('Invite Friends will use VexaChat contacts and sharing when the invite API is available.');return}
    if(v==='features'){modal('VexaChat features','<div class="hint">Messaging, media, reactions, replies, editing, contacts, calls, folders and VexaAccount security are available in VexaChat.</div>');return}
    if(v==='logout'){logout();return}
    state.active=null;
    showMobileList('chats');
  }));
  const scrim=document.querySelector('.nav-scrim');
  scrim?.addEventListener('click',close,{passive:true});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close()});
}

  installVexaNavigation();
  sidebar.addEventListener('click',e=>{
    if(e.target.closest('.chat-row,.tab,.folder-tab,.filter,[data-view],[data-folder],[data-filter]'))
      document.body.classList.remove('nav-drawer-open');
  },{passive:true});
  const search=document.querySelector('#search');
  search?.addEventListener('keydown',e=>{
    if(e.key==='Escape'){search.value='';search.dispatchEvent(new Event('input',{bubbles:true}));search.blur()}
  });
  document.addEventListener('keydown',function vexaShortcuts(e){
    if(e.defaultPrevented||e.target.matches('input,textarea,select,[contenteditable="true"]'))return;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();search?.focus()}
    if(e.key==='Escape')document.body.classList.remove('nav-drawer-open');
  });
  let sx=0,sy=0;
  main.addEventListener('touchstart',e=>{const t=e.touches[0];sx=t.clientX;sy=t.clientY},{passive:true});
  main.addEventListener('touchend',e=>{
    const t=e.changedTouches[0],dx=t.clientX-sx,dy=t.clientY-sy;
    if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*1.35){
      if(dx>0)showMobileList(state.lastListView||'chats');
    }
  },{passive:true});
  document.documentElement.classList.add('vexachat-v8');
};
window.addEventListener('pagehide',markPresenceOffline,{capture:true});
document.addEventListener('visibilitychange',()=>{
 if(document.visibilityState==='hidden')markPresenceOffline();
 else if(document.visibilityState==='visible'&&token()){presenceOfflineSent=false;setPresence('online').catch(()=>{})}
});boot();
})();