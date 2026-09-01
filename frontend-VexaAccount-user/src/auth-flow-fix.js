/* Authentication/session bridge for the canonical VexaAccount user runtime. */
(()=>{
  'use strict';
  if(window.__VEXA_AUTH_FLOW_FIX__) return;
  window.__VEXA_AUTH_FLOW_FIX__=true;
  const nativeFetch=window.fetch.bind(window);
  const TOKEN_KEY='vexaaccount_session_token';
  const saveToken=(data)=>{if(data&&typeof data.token==='string'&&data.token){try{localStorage.setItem(TOKEN_KEY,data.token)}catch(_){}}};
  window.fetch=async (...args)=>{
    let input=args[0],init=args[1]||{};
    const url=String(typeof input==='string'?input:(input&&input.url)||'');
    if(/\/api\/auth\/session(?:\?|$)/.test(url)){
      const token=(()=>{try{return localStorage.getItem(TOKEN_KEY)||''}catch(_){return ''}})();
      if(token){init={...init,headers:{...(init.headers||{}),Authorization:`Bearer ${token}`},credentials:'include'};if(typeof input==='string')args=[input,init];else args=[new Request(input,init)];}
    }
    const response=await nativeFetch(...args);
    try{
      const data=await response.clone().json().catch(()=>null);
      if(data)saveToken(data);
      if(/\/api\/auth\/register(?:\?|$)/.test(url)&&data&&data.action==='verify'&&data.email){return new Response(JSON.stringify({success:true,action:'verify',verificationRequired:true,email:data.email,data:data.data,message:data.message}),{status:200,headers:{'Content-Type':'application/json'}})}
    }catch(_){ }
    return response;
  };
})();
