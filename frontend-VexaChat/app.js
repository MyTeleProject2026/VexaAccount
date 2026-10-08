  if(document.querySelector('#vexaNavDrawer'))return;
  const drawer=document.createElement('aside');
  drawer.id='vexaNavDrawer';
  drawer.className='vexa-nav-drawer';
  drawer.setAttribute('aria-label','VexaChat navigation');
  drawer.innerHTML='<div class="nav-drawer-head"><div class="avatar nav-drawer-avatar"><img src="./icon.svg" alt="VexaChat"></div><div><strong>VexaChat</strong><small>VexaAccount messenger</small></div><button type="button" class="icon-btn" data-nav-close aria-label="Close menu">×</button></div>'+
    '<button type="button" class="nav-account-row" data-nav="profile"><div class="avatar">'+avatarMarkup(state.me||{},'avatar')+'</div><span><b>'+esc(state.me?.name||state.me?.email||'Account')+'</b><small>'+esc(state.me?.email||'Connected account')+'</small></span><strong>›</strong></button>'+
    '<nav class="nav-drawer-list">'+
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