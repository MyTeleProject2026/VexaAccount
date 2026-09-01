/* VexaAccount User frontend canonical runtime loader. */
(()=>{if(window.__VEXA_ACCOUNT_RUNTIME_LOADING__)return;window.__VEXA_ACCOUNT_RUNTIME_LOADING__=true;
  const style=document.createElement('link');style.rel='stylesheet';style.href='./src/vexatrade-notifications.css?v=20260901-1';document.head.appendChild(style);
  const nativeSetTimeout=window.setTimeout.bind(window);window.setTimeout=(fn,delay,...rest)=>nativeSetTimeout(fn,delay===3800?12000:delay,...rest);
  const bridge=document.createElement('script');bridge.src='./src/auth-flow-fix.js?v=20260901-3';bridge.defer=true;
  bridge.onload=()=>{const s=document.createElement('script');s.src='./src/app-fixed.js?v=20260901-13';s.defer=true;document.head.appendChild(s)};
  document.head.appendChild(bridge);
})();