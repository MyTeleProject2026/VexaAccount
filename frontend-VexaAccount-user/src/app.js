/* VexaAccount User canonical runtime loader + persistent bearer-session bridge. */
(()=>{
  if(window.__VEXA_ACCOUNT_RUNTIME_LOADING__)return;
  window.__VEXA_ACCOUNT_RUNTIME_LOADING__=true;

  const TOKEN_KEYS=['vexaaccount_access_token','vexa_access_token','access_token'];
  const getToken=()=>{
    for(const key of TOKEN_KEYS){
      try{const value=localStorage.getItem(key);if(value)return value}catch{}
    }
    return null;
  };
  const saveToken=token=>{
    if(!token)return;
    try{
      localStorage.setItem(TOKEN_KEYS[0],String(token));
      sessionStorage.setItem(TOKEN_KEYS[0],String(token));
    }catch{}
  };
  const clearToken=()=>{
    try{
      TOKEN_KEYS.forEach(k=>localStorage.removeItem(k));
      sessionStorage.removeItem(TOKEN_KEYS[0]);
    }catch{}
  };
  const originalFetch=window.fetch.bind(window);

  window.fetch=async(input,init={})=>{
    const url=typeof input==='string'?input:(input&&input.url)||'';
    const headers=new Headers((init&&init.headers)||(input&&input.headers)||{});
    const isApi=/\/api\//.test(url);
    const token=getToken();
    if(token&&!headers.has('Authorization')&&isApi)headers.set('Authorization','Bearer '+token);

    const response=await originalFetch(input,{...init,headers});

    if(response.ok&&isApi){
      try{
        const data=await response.clone().json();
        const authToken=data?.token||data?.accessToken||data?.data?.token||data?.data?.accessToken;
        if(authToken)saveToken(authToken);
      }catch{}
    }

    if(response.status===401&&isApi)clearToken();
    if(/\/api\/auth\/logout$/.test(url)&&response.ok)clearToken();
    return response;
  };

  // An unauthenticated visit to the account-center root is a login state, not
  // an account error. This prevents the UI from presenting the API's
  // harmless {success:false,message:"No session"} response as a broken page.
  try{
    const hash=window.location.hash||'';
    if(!getToken()&&!hash.startsWith('#/login')&&!hash.startsWith('#/register')&&!hash.startsWith('#/forgot-password')&&!hash.startsWith('#/verify-email')&&!hash.startsWith('#/reset-password')){
      window.location.hash='#/login';
    }
  }catch{}

  const version='20260901-16';
  const add=(tag,src)=>{const node=document.createElement(tag);node.src=src+'?v='+version;node.defer=true;document.head.appendChild(node)};
  const css=document.createElement('link');css.rel='stylesheet';css.href='./src/vexatrade-notifications.css?v='+version;document.head.appendChild(css);
  add('script','./src/vexatrade-toast-runtime.js');
  add('script','./src/vexatrade-toast-compat.js');
  add('script','./src/app-v3.js');
})();
