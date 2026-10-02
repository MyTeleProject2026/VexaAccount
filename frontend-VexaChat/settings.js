(()=>{'use strict';
const KEY='vexachat_preferences_v1';
const defaults={appearance:'system',density:'comfortable',enter_to_send:true,animations:true,link_previews:true,autoplay_media:false,read_receipts:true,last_seen:'everyone',profile_photo:'everyone',calls_from:'contacts',message_preview:true,desktop_notifications:true,language:'English',data_saver:false};
const load=()=>{try{return {...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{return {...defaults}}};
const save=p=>localStorage.setItem(KEY,JSON.stringify(p));
const applyPreferences=p=>{document.documentElement.dataset.theme=p.appearance;document.documentElement.dataset.density=p.density;document.documentElement.dataset.motion=p.animations?'on':'off'};
applyPreferences(load());
const row=(label,desc,control)=>'<div class="settings-row"><div><strong>'+label+'</strong><small>'+desc+'</small></div>'+control+'</div>';
const select=(id,values,value)=>'<select class="settings-select" id="'+id+'">'+values.map(v=>'<option value="'+v+'" '+(v===value?'selected':'')+'>'+v[0].toUpperCase()+v.slice(1)+'</option>').join('')+'</select>';
function open(ctx,initialSection){
 const p=load(); const ns=ctx.state.settings||{}; Object.assign(p,{desktop_notifications:ns.messages_enabled!==0,message_preview:ns.previews_enabled!==0,calls_enabled:ns.calls_enabled!==0}); let section=sectionsInitial(initialSection);
 const serverNotify=()=>ctx.state.settings||{};
 const serverPrivacy=async()=>{try{return (await ctx.api('/api/chat/privacy/settings')).settings||{}}catch{return {}}};
 const sectionsInitial=x=>['account','privacy','notifications','chats','appearance','data','language','help'].includes(x)?x:'account';
 const syncNotifications=async()=>{try{ctx.state.settings=(await ctx.api('/api/chat/notifications/settings',{method:'PUT',body:JSON.stringify({messages_enabled:p.desktop_notifications,calls_enabled:p.calls_enabled!==false,previews_enabled:p.message_preview})})).settings;ctx.notify('Notification settings saved')}catch(e){ctx.notify(e.message)}};
 const sections=[
  ['account','Account','Profile, identity and sign-in'],
  ['privacy','Privacy & Security','Visibility, receipts and calls'],
  ['notifications','Notifications','Message and call alerts'],
  ['chats','Chats','Message behavior and media'],
  ['appearance','Appearance','Theme, density and motion'],
  ['data','Data & Storage','Network and media usage'],
  ['language','Language','Application language'],
  ['help','Help','Support and app information']
 ];
 function render(){
  const body=section==='account'?account():section==='privacy'?privacy():section==='notifications'?notifications():section==='chats'?chats():section==='appearance'?appearance():section==='data'?data():section==='language'?language():help();
  ctx.modal('VexaChat Settings','<div class="settings-layout"><nav class="settings-nav">'+sections.map(s=>'<button class="'+(s[0]===section?'active':'')+'" data-setting="'+s[0]+'"><span>'+icon(s[0])+'</span><b>'+s[1]+'</b><small>'+s[2]+'</small></button>').join('')+'</nav><section class="settings-content">'+body+'</section></div>');
  document.querySelectorAll('[data-setting]').forEach(b=>b.onclick=()=>{section=b.dataset.setting;render()});
  bind();
 }
 function icon(x){return ({account:'●',privacy:'⌁',notifications:'◉',chats:'▣',appearance:'◐',data:'⇅',language:'文',help:'?'})[x]||'•'}
 function heading(t,d){return '<div class="settings-heading"><h3>'+t+'</h3><p>'+d+'</p></div>'}
 function toggle(id,on){return '<label class="switch"><input id="'+id+'" type="checkbox" '+(on?'checked':'')+'><span></span></label>'}
 function account(){return heading('Account','Manage your VexaAccount identity used by VexaChat')+'<div class="settings-profile"><div class="avatar">'+ctx.initials(ctx.state.me?.name||ctx.state.me?.email)+'</div><div><strong>'+ctx.esc(ctx.state.me?.name||'VexaAccount user')+'</strong><small>'+ctx.esc(ctx.state.me?.email||'')+'</small></div></div><div class="settings-card"><button class="settings-action" id="editProfile"><b>Edit profile</b><span>Display name and avatar</span></button><button class="settings-action" id="accountCenter"><b>Open VexaAccount</b><span>Account, password and verification</span></button><button class="settings-action" id="signOut"><b>Sign out</b><span>End this VexaChat session</span></button></div>'}
 function privacy(){return heading('Privacy & Security','Control who can see activity and contact you')+'<div class="settings-card">'+row('Read receipts','Show when messages are read',toggle('read_receipts',p.read_receipts))+row('Last seen','Who can see your online activity',select('last_seen',['everyone','contacts','nobody'],p.last_seen))+row('Profile photo','Who can view your profile photo',select('profile_photo',['everyone','contacts','nobody'],p.profile_photo))+row('Calls','Who can start calls with you',select('calls_from',['everyone','contacts','nobody'],p.calls_from))+'</div><div class="settings-note">Privacy choices are saved to your VexaChat account and follow you across signed-in devices.</div>'}
 function notifications(){const s=serverNotify();return heading('Notifications','Choose how VexaChat alerts you')+'<div class="settings-card">'+row('Message notifications','New message alerts',toggle('desktop_notifications',s.messages_enabled!==0))+row('Message previews','Show message text in notifications',toggle('message_preview',s.previews_enabled!==0))+row('Call notifications','Incoming voice and video call alerts',toggle('calls_enabled',s.calls_enabled!==0))+row('Browser notifications','Allow this device to display notifications','<button class="secondary" id="requestNotify">Enable</button>')+'</div><div class="settings-note">Notification permissions are device-specific; message, call and preview preferences are saved to your VexaChat account.</div>'}
 function chats(){return heading('Chats','Message composition and media behavior')+'<div class="settings-card">'+row('Enter to send','Enter sends a message instead of a new line',toggle('enter_to_send',p.enter_to_send))+row('Link previews','Generate previews for supported links',toggle('link_previews',p.link_previews))+row('Autoplay media','Automatically play received media',toggle('autoplay_media',p.autoplay_media))+row('Read receipts','Keep read-state updates enabled',toggle('read_receipts',p.read_receipts))+'</div>'}
 function appearance(){return heading('Appearance','Make the messenger comfortable on phone and desktop')+'<div class="settings-card">'+row('Theme','Choose the application theme',select('appearance',['system','dark','light'],p.appearance))+row('Density','Adjust conversation and list spacing',select('density',['comfortable','compact'],p.density))+row('Animations','Use transitions and motion',toggle('animations',p.animations))+'</div>'}
 function data(){return heading('Data & Storage','Control media loading and local application data')+'<div class="settings-card">'+row('Data saver','Reduce automatic media/network usage',toggle('data_saver',p.data_saver))+row('Clear local preferences','Reset VexaChat appearance and behavior settings','<button class="secondary" id="clearPrefs">Reset</button>')+'</div><div class="settings-note">Messages, contacts and account data remain on the connected VexaAccount services; this control only resets local VexaChat preferences.</div>'}
 function language(){return heading('Language','Choose the VexaChat interface language')+'<div class="settings-card">'+row('Application language','Interface language',select('language',['English','မြန်မာ'],p.language))+'</div><div class="settings-note">Additional translations can be added without changing account or messaging data.</div>'}
 function help(){return heading('Help','Support and application information')+'<div class="settings-card"><button class="settings-action" id="helpSupport"><b>VexaChat Help</b><span>Messaging, groups, calls and account support</span></button><button class="settings-action" id="reportProblem"><b>Report a problem</b><span>Open the VexaAccount support area</span></button><div class="settings-about"><b>VexaChat</b><span>Secure messenger · VexaAccount identity</span></div></div>'}
 function bind(){
  const ids=['read_receipts','enter_to_send','link_previews','autoplay_media','animations','data_saver'];
  ids.forEach(id=>document.querySelector('#'+id)?.addEventListener('change',async e=>{p[id]=e.target.checked;save(p);apply();if(id==='read_receipts')try{await ctx.api('/api/chat/privacy/settings',{method:'PATCH',body:JSON.stringify({read_receipts:p.read_receipts,last_seen:p.last_seen,profile_photo:p.profile_photo,calls_from:p.calls_from})});ctx.notify('Privacy settings saved')}catch(err){ctx.notify(err.message)}}));
  ['desktop_notifications','message_preview','calls_enabled'].forEach(id=>document.querySelector('#'+id)?.addEventListener('change',async e=>{p[id]=e.target.checked;save(p);if(id==='desktop_notifications')p.desktop_notifications=e.target.checked;if(id==='message_preview')p.message_preview=e.target.checked;await syncNotifications();render()}));
  ['last_seen','profile_photo','calls_from','appearance','density','language'].forEach(id=>document.querySelector('#'+id)?.addEventListener('change',async e=>{p[id]=e.target.value;save(p);apply();if(['last_seen','profile_photo','calls_from'].includes(id))try{await ctx.api('/api/chat/privacy/settings',{method:'PATCH',body:JSON.stringify({read_receipts:p.read_receipts,last_seen:p.last_seen,profile_photo:p.profile_photo,calls_from:p.calls_from})});ctx.notify('Privacy settings saved')}catch(err){ctx.notify(err.message)}}));
  document.querySelector('#editProfile')?.addEventListener('click',()=>{document.querySelector('#modal')?.remove();ctx.profile()});
  document.querySelector('#accountCenter')?.addEventListener('click',()=>location.href='https://vexaaccount-management.onrender.com/');
  document.querySelector('#signOut')?.addEventListener('click',ctx.logout);
  document.querySelector('#requestNotify')?.addEventListener('click',async()=>{if(!('Notification' in window))return ctx.notify('Notifications are not supported on this device');const permission=await Notification.requestPermission();ctx.notify(permission==='granted'?'Notifications enabled':'Notifications not enabled')});
  document.querySelector('#clearPrefs')?.addEventListener('click',()=>{localStorage.removeItem(KEY);Object.assign(p,defaults);save(p);apply();render()});
  document.querySelector('#helpSupport')?.addEventListener('click',()=>location.href='https://vexaaccount-management.onrender.com/');
  document.querySelector('#reportProblem')?.addEventListener('click',()=>location.href='https://vexaaccount-management.onrender.com/');
 }
 function apply(){applyPreferences(p)}
 apply();serverPrivacy().then(sp=>{if(sp&&Object.keys(sp).length){Object.assign(p,{read_receipts:sp.read_receipts!==0,last_seen:sp.last_seen||p.last_seen,profile_photo:sp.profile_photo||p.profile_photo,calls_from:sp.calls_from||p.calls_from});save(p)}render()});
}
window.VexaChatSettings={open};
})();