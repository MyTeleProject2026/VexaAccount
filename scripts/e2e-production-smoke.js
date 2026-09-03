const BASE=String(process.env.VEXA_ACCOUNT_BASE_URL||'https://api-vexaaccount.onrender.com').replace(/\/$/,'');
const checks=[];
async function request(name,url,options={}){
  try{
    const r=await fetch(BASE+url,{redirect:'manual',...options});
    const text=await r.text();
    return {r,text};
  }catch(e){
    checks.push({name,status:'error',ok:false});
    console.error(`FAIL ${name}: ${e.message}`);
    throw e;
  }
}
function pass(name,status){checks.push({name,status,ok:true});console.log(`PASS ${name} (${status})`);}
function fail(name,status,text){checks.push({name,status,ok:false});throw new Error(`${name}: HTTP ${status} ${String(text||'').slice(0,240)}`);}
async function check(name,url,options={},expected=[200]){
  const {r,text}=await request(name,url,options);
  if(!expected.includes(r.status)) fail(name,r.status,text);
  pass(name,r.status);
  return {r,text};
}
async function checkProtected(name,url,options={}){
  const {r,text}=await request(name,url,options);
  if(r.status===401||r.status===403){pass(name,r.status);return {r,text};}
  if(r.status===200){
    let body;
    try{body=JSON.parse(text);}catch{fail(name,r.status,text);}
    // Some VexaAccount session endpoints deliberately return HTTP 200 with
    // success:false for an anonymous caller. That is still protected as long
    // as no authenticated resource/session is exposed.
    const denied=body?.success===false&&(
      /no .*session|unauthenticated|authentication|not authenticated|forbidden/i.test(String(body.message||''))
      ||body.session==null
    );
    if(denied){pass(name,r.status);return {r,text};}
  }
  fail(name,r.status,text);
}
(async()=>{
  await check('service health','/api/health');
  const discovery=await check('SSO discovery','/api/sso/.well-known/openid-configuration');
  const d=JSON.parse(discovery.text);
  for(const key of ['issuer','authorization_endpoint','token_endpoint','userinfo_endpoint']){
    if(!d[key]) throw new Error(`Discovery missing ${key}`);
  }
  await checkProtected('unauthenticated owner session is protected','/api/auth/super-admin/session');
  await checkProtected('unauthenticated owner user list is protected','/api/owner/users');
  await checkProtected('unauthenticated SSO registry is protected','/api/sso-registry/applications');
  await checkProtected('user session endpoint is protected','/api/auth/session');
  console.log(`Smoke certification complete: ${checks.filter(x=>x.ok).length}/${checks.length} checks passed.`);
})().catch(()=>process.exit(1));
