/* Authentication UX bridge for the canonical VexaAccount user runtime. */
(()=>{
  'use strict';
  if(window.__VEXA_AUTH_FLOW_FIX__) return;
  window.__VEXA_AUTH_FLOW_FIX__=true;
  const nativeFetch=window.fetch.bind(window);

  window.fetch=async (...args)=>{
    const response=await nativeFetch(...args);
    try{
      const input=args[0];
      const url=typeof input==='string'?input:(input&&input.url)||'';
      if(!/\/api\/auth\/register(?:\?|$)/.test(url)) return response;

      const copy=response.clone();
      const data=await copy.json().catch(()=>null);
      if(data && data.action==='verify' && data.email){
        // The account is intentionally considered created even when SMTP is
        // temporarily unavailable. Let the existing register handler continue
        // into the editable verification page instead of leaving the user on
        // the registration form after a 502.
        return new Response(JSON.stringify({
          success:true,
          action:'verify',
          verificationRequired:true,
          email:data.email,
          data:data.data,
          message:data.message
        }),{
          status:200,
          headers:{'Content-Type':'application/json'}
        });
      }
    }catch(_){ /* preserve the original network response */ }
    return response;
  };
})();
