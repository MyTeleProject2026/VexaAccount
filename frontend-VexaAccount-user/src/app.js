/* VexaAccount User canonical runtime loader + persistent bearer-session bridge. */
(()=>{
  if(window.__VEXA_ACCOUNT_RUNTIME_LOADING__)return;
  window.__VEXA_ACCOUNT_RUNTIME_LOADING__=true;

  // The API returns a JWT from login/OTP verification. Keep it locally so
  // cross-origin requests to api-vexaaccount.onrender.com remain authenticated.
  // This is intentionally client-side token storage because the frontend and
  // API are hosted on different origins; the backend still validates the JWT.
  const TOKEN_KEY='vexaaccount_access_token';
  const originalFetch=window.fetch.bind(window);
  window.fetch=async(input,init={})=>{
    const url=typeof input==='string'?input:(input&&input.url)||'';
    const method=String((init&&init.method)||(input&&input.method)||'GET').toUpperCase();
    const headers=new Headers((init&&init.headers)||(input&&input.headers)||{});
    const token=localStorage.getItem(TOKEN_KEY);
    if(token&&!headers.has('Authorization')&&/\/api\//.test(url))headers.set('Authorization','Bearer '+token);
    const nextInit={...init,headers};
    const response=await originalFetch(input,nextInit);

    // Capture JWTs returned by every successful authentication step, including
    // registration verification, email-2FA and authenticator-2FA.
    if(/\/api\/auth\/(login|verify-otp|verify-email-2fa|twofa\/verify|google)$/.test(url)&&response.ok){
      try{
        const copy=response.clone();
        const data=await copy.json();
        if(data&&data.token)localStorage.setItem(TOKEN_KEY,data.token);
      }catch{}
    }
    if(/\/api\/auth\/logout$/.test(url)&&response.ok)localStorage.removeItem(TOKEN_KEY);
    return response;
  };

  const style=document.createElement('link');style.rel='stylesheet';style.href='./src/vexatrade-notifications.css?v=20260901-5';document.head.appendChild(style);
  const runtime=document.createElement('script');runtime.src='./src/vexatrade-toast-runtime.js?v=20260901-5';runtime.defer=true;document.head.appendChild(runtime);
  const compat=document.createElement('script');compat.src='./src/vexatrade-toast-compat.js?v=20260901-2';compat.defer=true;document.head.appendChild(compat);
  const app=document.createElement('script');app.src='./src/app-v3.js?v=20260901-3';app.defer=true;document.head.appendChild(app);
})();
