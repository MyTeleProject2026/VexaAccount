const crypto = require('crypto');

const TTL_SECONDS = 15 * 60;
function secret() {
  const value = String(process.env.OWNER_SSO_PLAN_SIGNING_SECRET || '').trim();
  if (!value || value.length < 32) throw Object.assign(new Error('Owner SSO plan signing is not configured. Set OWNER_SSO_PLAN_SIGNING_SECRET to a random secret of at least 32 characters.'), { status: 503 });
  return value;
}
function b64(v) { return Buffer.from(v).toString('base64url'); }
function sign(input) { return crypto.createHmac('sha256', secret()).update(input).digest('base64url'); }
function create(payload) { const now=Math.floor(Date.now()/1000); const body={...payload,iat:now,exp:now+TTL_SECONDS}; const encoded=b64(JSON.stringify(body)); return `${encoded}.${sign(encoded)}`; }
function verify(token) { const parts=String(token||'').split('.'); const encoded=parts[0],signature=parts[1]; if(!encoded||!signature) throw Object.assign(new Error('Invalid Owner SSO source-plan token'),{status:409}); const expected=sign(encoded); const a=Buffer.from(signature),b=Buffer.from(expected); if(a.length!==b.length||!crypto.timingSafeEqual(a,b)) throw Object.assign(new Error('Invalid Owner SSO source-plan token'),{status:409}); let body; try{body=JSON.parse(Buffer.from(encoded,'base64url').toString('utf8'));}catch{throw Object.assign(new Error('Invalid Owner SSO source-plan token payload'),{status:409});} if(!Number.isInteger(body.iat)||!Number.isInteger(body.exp)||body.exp<body.iat||body.exp<Math.floor(Date.now()/1000)||body.exp-body.iat>TTL_SECONDS) throw Object.assign(new Error('Owner SSO source-review plan has expired or is invalid. Build a new precise plan.'),{status:409}); return body; }
module.exports={create,verify,TTL_SECONDS};
