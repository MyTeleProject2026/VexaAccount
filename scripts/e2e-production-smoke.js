const BASE=String(process.env.VEXA_ACCOUNT_BASE_URL||'https://api-vexaaccount.onrender.com').replace(/\/$/,'');
const checks=[];
async function check(name,url,options={},expected=[200]){try{const r=await fetch(BASE+url,{redirect:'manual',...options});const text=await r.text();const ok=expected.includes(r.status);checks.push({name,status:r.status,ok});if(!ok)throw new Error(`${name}: HTTP ${r.status} ${text.slice(0,240)}`);console.log(`PASS ${name} (${r.status})`);return {r,text};}catch(e){checks.push({name,status:'error',ok:false});console.error(`FAIL ${name}: ${e.message}`);throw e}}
(async()=>{
 await check('service health','/api/health');
 const discovery=await check('SSO discovery','/api/sso/.well-known/openid-configuration');
 const d=JSON.parse(discovery.text); for(const key of ['issuer','authorization_endpoint','token_endpoint','userinfo_endpoint']) if(!d[key]) throw new Error(`Discovery missing ${key}`);
 await check('unauthenticated owner session is protected','/api/auth/super-admin/session',{},[401]);
 await check('unauthenticated owner user list is protected','/api/owner/users',{},[401]);
 await check('unauthenticated SSO registry is protected','/api/sso-registry/applications',{},[401]);
 await check('user session endpoint is protected','/api/auth/session',{},[401]);
 console.log(`Smoke certification complete: ${checks.filter(x=>x.ok).length}/${checks.length} checks passed.`);
})().catch(()=>process.exit(1));
