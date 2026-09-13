from pathlib import Path

path = Path('frontend-VexaAccount-Super-admin/src/owner-os.js')
text = path.read_text(encoding='utf-8')
if 'Startup hydration runs in the background and never re-renders the gateway.' in text:
    print('Owner OS startup hydration fix is already present.')
    raise SystemExit(0)
old = '''    // The authenticated Owner gateway is rendered immediately. Slow operational
    // data must update the UI later and must never hold the whole page on its
    // loading screen.
    const results=await Promise.allSettled([
      api('/api/sso-registry/applications'),
      api('/api/sso-registry/audit?limit=100'),
      api('/api/owner/users?limit=200')
    ]);
    const [appsResult,auditResult,usersResult]=results;
    if(appsResult.status==='fulfilled')S.apps=appsResult.value.applications||[];
    if(auditResult.status==='fulfilled')S.audit=auditResult.value.events||[];
    if(usersResult.status==='fulfilled')S.users=usersResult.value.users||[];
    render();
    window.__VEXA_OWNER_BOOT_STATE__='ready';
    const unavailable=[
      appsResult.status==='rejected'?'SSO application registry':null,
      auditResult.status==='rejected'?'SSO audit':null,
      usersResult.status==='rejected'?'Owner users':null
    ].filter(Boolean);
    if(unavailable.length)toast(unavailable.join(', ')+' temporarily unavailable. Your Owner session remains authenticated.',true);'''
new = '''    // The gateway is interactive immediately after authentication.
    // Startup hydration runs in the background and never re-renders the gateway.
    // Re-rendering the whole Owner DOM after these requests complete can interrupt
    // clicks/navigation and makes a slow API call feel like a frozen application.
    window.__VEXA_OWNER_BOOT_STATE__='ready';
    void Promise.allSettled([
      api('/api/sso-registry/applications'),
      api('/api/sso-registry/audit?limit=100'),
      api('/api/owner/users?limit=200')
    ]).then(results=>{
      const [appsResult,auditResult,usersResult]=results;
      if(appsResult.status==='fulfilled')S.apps=appsResult.value.applications||[];
      if(auditResult.status==='fulfilled')S.audit=auditResult.value.events||[];
      if(usersResult.status==='fulfilled')S.users=usersResult.value.users||[];
      const unavailable=[
        appsResult.status==='rejected'?'SSO application registry':null,
        auditResult.status==='rejected'?'SSO audit':null,
        usersResult.status==='rejected'?'Owner users':null
      ].filter(Boolean);
      if(unavailable.length)toast(unavailable.join(', ')+' temporarily unavailable. Your Owner session remains authenticated.',true);
    }).catch(e=>console.error('Owner OS background hydration failed',e));'''
if old not in text:
    raise SystemExit('Expected Owner OS boot block was not found; refusing to modify the file.')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('Owner OS startup hydration patch applied.')
