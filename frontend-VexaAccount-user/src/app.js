/* VexaAccount User canonical runtime loader. */
(()=>{if(window.__VEXA_ACCOUNT_RUNTIME_LOADING__)return;window.__VEXA_ACCOUNT_RUNTIME_LOADING__=true;
const style=document.createElement('link');style.rel='stylesheet';style.href='./src/vexatrade-notifications.css?v=20260901-4';document.head.appendChild(style);
const runtime=document.createElement('script');runtime.src='./src/vexatrade-toast-runtime.js?v=20260901-4';runtime.defer=true;document.head.appendChild(runtime);
const compat=document.createElement('script');compat.src='./src/vexatrade-toast-compat.js?v=20260901-1';compat.defer=true;document.head.appendChild(compat);
const app=document.createElement('script');app.src='./src/app-v3.js?v=20260901-2';app.defer=true;document.head.appendChild(app);
})();
