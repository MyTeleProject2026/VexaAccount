/* VexaAccount User canonical runtime loader + persistent bearer-session bridge. */
(()=>{
  if(window.__VEXA_ACCOUNT_RUNTIME_LOADING__)return;
  window.__VEXA_ACCOUNT_RUNTIME_LOADING__=true;

  // Keep the bearer token as the durable client-side session credential. The
  // backend also sets an HttpOnly cookie, but the bearer token makes the
  // cross-origin account-center requests deterministic after refresh/reload.
  const TOKEN_KEYS=['vexaaccount_access_token','vexa_access_token','access_token'];
  const getToken=()=>{
    for(const key of TOKEN_KEYS){
      try{const value=localStorage.getItem(key);if(value)return value}catch{}
    }
    return null;
  };
  const saveToken=token=>{
    if(!token)return;
    try{localStorage.setItem(TOKEN_KEYS[0],String(token));sessionStorage.setItem(TOKEN_KEYS[0],String(token))}catch{}
  };
  const clearToken=()=>{try{TOKEN_KEYS.forEach(k=>localStorage.removeItem(k));sessionStorage.removeItem(TOKEN_KEYS[0])}catch{}};
  const originalFetch=window.fetch.bind(window);

  window.fetch=async(input,init={})=>{
    const url=typeof input==='string'?input:(input&&input.url)||'';
    const headers=new Headers((init&&init.headers)||(input&&input.headers)||{});
    const isApi=/\/api\//.test(url);
    const token=getToken();
    if(token&&!headers.has('Authorization')&&isApi)headers.set('Authorization','Bearer '+token);

    const response=await originalFetch(input,{...init,headers});

    // Capture credentials from every supported authentication response. This
    // is intentionally broader than one exact route so OTP/SSO/recovery flows
    // cannot leave the account center without a persistent session.
    if(response.ok&&isApi){
      try{
        const copy=response.clone();
        const data=await copy.json();
        const authToken=data?.token||data?.accessToken||data?.data?.token||data?.data?.accessToken;
        if(authToken)saveToken(authToken);
      }catch{}
    }

    if(response.status===401&&isApi)clearToken();
    if(/\/api\/auth\/logout$/.test(url)&&response.ok)clearToken();
    return response;
  };

  const style=document.createElement('link');style.rel='stylesheet';style.href='./src/vexatrade-notifications.css?v=20260901-7';document.head.appendChild(style);
  const runtime=document.createElement('script');runtime.src='./src/vexatrade-toast-runtime.js?v=20260901-7';runtime.defer=true;document.head.appendChild(runtime);
  const compat=document.createElement('script');compat.src='./src/vexatrade-toast-compat.js?v=20260901-4';compat.defer=true;document.head.appendChild(compat);
  const app=document.createElement('script');app.src='./src/app-v3.js?v=20260901-5';app.defer=true;document.head.appendChild(app);
})();
