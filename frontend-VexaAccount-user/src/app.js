/* VexaAccount User frontend compatibility entrypoint. The canonical runtime lives in app-fixed.js. */
(() => {
  if (window.__VEXA_ACCOUNT_RUNTIME_LOADING__) return;
  window.__VEXA_ACCOUNT_RUNTIME_LOADING__ = true;
  const script = document.createElement('script');
  script.src = './src/app-fixed.js?v=20260901-8';
  script.defer = true;
  document.head.appendChild(script);
})();
