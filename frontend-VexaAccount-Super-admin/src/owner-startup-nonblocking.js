(()=>{'use strict';
if(window.__VEXA_OWNER_STARTUP_NONBLOCKING__)return;window.__VEXA_OWNER_STARTUP_NONBLOCKING__=true;
const API=(window.VEXA_ACCOUNT_ADMIN_API_BASE||'https://api-vexaaccount.onrender.com').replace(/\/$/,'');
const pending=new Map([
 ['/api/sso-registry/applications',true],
 ['/api/sso-registry/audit?limit=100',true],
 ['/api/owner/users?limit=200',true]
]);
const nativeFetch=window.fetch.bind(window);
window.fetch=async(input,init)=>{
 const url=typeof input==='string'?input:(input&&input.url)||'';
 let path='';try{path=new URL(url,location.href).pathname+(new URL(url,location.href).search||'')}catch{}
 if(pending.get(path)&&(!init?.method||String(init.method).toUpperCase()==='GET')){
  pending.delete(path);
  void nativeFetch(input,init).catch(()=>{});
  const payload=path.startsWith('/api/sso-registry/applications')?{success:true,applications:[]}:path.startsWith('/api/sso-registry/audit')?{success:true,events:[]}:{success:true,users:[]};
  return new Response(JSON.stringify(payload),{status:200,headers:{'Content-Type':'application/json'}});
 }
 return nativeFetch(input,init);
};
})();
