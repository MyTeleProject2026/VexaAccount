/* VexaAccount User frontend canonical runtime loader. */
(()=>{if(window.__VEXA_ACCOUNT_RUNTIME_LOADING__)return;window.__VEXA_ACCOUNT_RUNTIME_LOADING__=true;
  const style=document.createElement('link');style.rel='stylesheet';style.href='./src/vexatrade-notifications.css?v=20260901-1';document.head.appendChild(style);
  const nativeSetTimeout=window.setTimeout.bind(window);window.setTimeout=(fn,delay,...rest)=>nativeSetTimeout(fn,delay===3800?12000:delay,...rest);
  const s=document.createElement('script');s.src='./src/app-fixed.js?v=20260901-12';s.defer=true;s.onload=()=>{const f=document.createElement('script');f.src='./src/auth-flow-fix.js?v=20260901-2';f.defer=true;document.head.appendChild(f)};document.head.appendChild(s)
})();