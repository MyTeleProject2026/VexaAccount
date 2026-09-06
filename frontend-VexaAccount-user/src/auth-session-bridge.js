(()=>{'use strict';
if(window.__VEXA_SESSION_BRIDGE_V2__)return;
window.__VEXA_SESSION_BRIDGE_V2__=true;
const API=window.VEXA_ACCOUNT_API_BASE||'https://api-vexaaccount.onrender.com';
const getToken=()=>window.vexaAccountAuth?.getToken?.()||null;
async function request(path){const token=getToken();const headers={'Content-Type':'application/json'};if(token)headers.Authorization='Bearer '+token;return fetch(API+path,{credentials:'include',headers})}
window.vexaSessionFetch=async()=>{const r=await request('/api/auth/session');const d=await r.json().catch(()=>({success:false,message:'Invalid session response'}));if(d?.success===true&&d.user)return d;const token=getToken();if(!token)return d;const p=await request('/api/auth/profile');const pd=await p.json().catch(()=>({success:false}));if(p.ok&&pd.success&&pd.user)return{success:true,user:pd.user,recoveredFromProfile:true};return d};
async function bootstrapCookieSession(){try{if(getToken())return;if(/^#\/sso\/authorize/i.test(location.hash||''))return;const d=await window.vexaSessionFetch();if(d?.success!==true||!d.user)return;if(/^#\/(login|signin)$/i.test(location.hash||''))location.hash='#/';window.dispatchEvent(new CustomEvent('vexa:auth-changed',{detail:{user:d.user,source:'cookie-session'}}));window.dispatchEvent(new Event('vexa-auth-ready'));}catch(error){console.debug('[VexaAccount] cookie session bootstrap skipped',error?.message||error)}}
bootstrapCookieSession();
})();
