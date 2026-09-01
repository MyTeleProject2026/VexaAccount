/* Authentication/session bridge for the canonical VexaAccount user runtime. */
(()=>{
  'use strict';
  if(window.__VEXA_AUTH_FLOW_FIX__) return;
  window.__VEXA_AUTH_FLOW_FIX__=true;

  const nativeFetch=window.fetch.bind(window);
  const TOKEN_KEY='vexaaccount_session_token';
  const readToken=()=>{try{return localStorage.getItem(TOKEN_KEY)||''}catch(_){return ''}};
  const saveToken=(data)=>{
    if(data&&typeof data.token==='string'&&data.token){
      try{localStorage.setItem(TOKEN_KEY,data.token)}catch(_){ }
    }
  };
  const clearToken=()=>{try{localStorage.removeItem(TOKEN_KEY)}catch(_){ }};

  const isVexaApiRequest=(url)=>{
    try{
      const u=new URL(url,window.location.href);
      return /\/api\/(?:auth|account)(?:\/|$)/.test(u.pathname);
    }catch(_){
      return /\/api\/(?:auth|account)(?:\/|$)/.test(String(url||''));
    }
  };

  window.fetch=async (...args)=>{
    let input=args[0];
    let init={...(args[1]||{})};
    const url=String(typeof input==='string'?input:(input&&input.url)||'');
    const token=readToken();

    /*
     * The API uses the HTTP-only cookie when available, but deployed
     * cross-origin browsers can reject/omit that cookie. Send the token
     * returned by login/OTP verification as an Authorization fallback for
     * every protected VexaAccount API call, not only /auth/session.
     */
    if(token && isVexaApiRequest(url)){
      const headers=new Headers(init.headers||((input instanceof Request)?input.headers:undefined));
      if(!headers.has('Authorization')) headers.set('Authorization',`Bearer ${token}`);
      init={...init,headers,credentials:'include'};
      if(typeof input==='string') args=[input,init];
      else args=[new Request(input,init)];
    }else if(isVexaApiRequest(url)){
      init={...init,credentials:'include'};
      if(typeof input==='string') args=[input,init];
      else args=[new Request(input,init)];
    }

    const response=await nativeFetch(...args);

    try{
      const data=await response.clone().json().catch(()=>null);
      if(data) saveToken(data);
      if(/\/api\/auth\/logout(?:\?|$)/.test(url)) clearToken();
      if(/\/api\/auth\/session(?:\?|$)/.test(url) && data && data.success===false && /invalid session|no session|no user session/i.test(data.message||'')){
        if(/invalid session/i.test(data.message||'')) clearToken();
      }

      /* Preserve the real HTTP response for register errors while making
         verification-required responses usable by the frontend flow. */
      if(/\/api\/auth\/register(?:\?|$)/.test(url) && data && data.action==='verify'){
        return new Response(JSON.stringify({
          success:true,
          action:'verify',
          verificationRequired:true,
          email:data.email||'',
          data:data.data,
          message:data.message
        }),{status:200,headers:{'Content-Type':'application/json'}});
      }
    }catch(_){ }

    return response;
  };
})();
