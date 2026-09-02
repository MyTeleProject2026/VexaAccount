const crypto = require('crypto');

function config() {
  if (!process.env.VEXA_ACCOUNT_SSO_CONFIG) throw new Error('VEXA_ACCOUNT_SSO_CONFIG is required');
  if (!process.env.VEXA_ACCOUNT_CLIENT_SECRET) throw new Error('VEXA_ACCOUNT_CLIENT_SECRET is required');
  let c;
  try { c = JSON.parse(process.env.VEXA_ACCOUNT_SSO_CONFIG); } catch { throw new Error('VEXA_ACCOUNT_SSO_CONFIG must be valid JSON'); }
  if (!c.url || !c.clientId || !c.redirectUri) throw new Error('VEXA_ACCOUNT_SSO_CONFIG requires url, clientId and redirectUri');
  if (Object.prototype.hasOwnProperty.call(c, 'clientSecret')) throw new Error('clientSecret is forbidden inside VEXA_ACCOUNT_SSO_CONFIG');
  return { ...c, url: String(c.url).replace(/\/$/, ''), scopes: Array.isArray(c.scopes) ? c.scopes : ['openid','profile','email'], timeoutMs: Number(c.timeoutMs || 10000), clientSecret: process.env.VEXA_ACCOUNT_CLIENT_SECRET };
}

function base64url(buf) { return Buffer.from(buf).toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_'); }
function randomString(bytes=32) { return base64url(crypto.randomBytes(bytes)); }
function pkce(verifier) { return base64url(crypto.createHash('sha256').update(verifier).digest()); }
function authorization({state, verifier}) {
  const c = config();
  const u = new URL(c.url + '/api/sso/authorize');
  u.searchParams.set('response_type','code'); u.searchParams.set('client_id',c.clientId); u.searchParams.set('redirect_uri',c.redirectUri);
  u.searchParams.set('scope',c.scopes.join(' ')); u.searchParams.set('state',state); u.searchParams.set('code_challenge',pkce(verifier)); u.searchParams.set('code_challenge_method','S256');
  return u.toString();
}
async function exchange({code, verifier}) {
  const c = config();
  const r = await fetch(c.url + '/api/sso/token',{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({grant_type:'authorization_code',client_id:c.clientId,client_secret:c.clientSecret,code,redirect_uri:c.redirectUri,code_verifier:verifier}),signal:AbortSignal.timeout(c.timeoutMs)});
  const d = await r.json().catch(()=>({})); if(!r.ok) throw new Error(d.message || d.error || `VexaAccount token exchange failed (${r.status})`); return d;
}
async function userinfo(accessToken) {
  const c = config();
  const r = await fetch(c.url + '/api/sso/userinfo',{headers:{authorization:`Bearer ${accessToken}`,accept:'application/json'},signal:AbortSignal.timeout(c.timeoutMs)});
  const d = await r.json().catch(()=>({})); if(!r.ok) throw new Error(d.message || d.error || `VexaAccount userinfo failed (${r.status})`); return d;
}
async function refresh(refreshToken) {
  const c = config();
  const r = await fetch(c.url + '/api/sso/token',{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({grant_type:'refresh_token',client_id:c.clientId,client_secret:c.clientSecret,refresh_token:refreshToken}),signal:AbortSignal.timeout(c.timeoutMs)});
  const d = await r.json().catch(()=>({})); if(!r.ok) throw new Error(d.message || d.error || `VexaAccount refresh failed (${r.status})`); return d;
}
async function logout(refreshToken) {
  const c = config();
  const r = await fetch(c.url + '/api/sso/logout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({client_id:c.clientId,client_secret:c.clientSecret,refresh_token:refreshToken}),signal:AbortSignal.timeout(c.timeoutMs)});
  return r.ok;
}
function startState() { const state=randomString(32), verifier=randomString(48); return {state,verifier,url:authorization({state,verifier})}; }
module.exports={config,startState,exchange,userinfo,refresh,logout};
