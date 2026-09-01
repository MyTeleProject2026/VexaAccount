(()=>{'use strict';
const API=window.VEXA_ACCOUNT_API_BASE||'https://api-vexaaccount.onrender.com';
const getToken=()=>window.vexaAccountAuth?.getToken?.()||null;
async function request(path){const token=getToken();const headers={'Content-Type':'application/json'};if(token)headers.Authorization='Bearer '+token;return fetch(API+path,{credentials:'include',headers})}
window.vexaSessionFetch=async()=>{let r=await request('/api/auth/session');let d=await r.json().catch(()=>({success:false,message:'Invalid session response'}));if(d?.success===true&&d.user)return d;
const token=getToken();if(!token)return d;
const p=await request('/api/auth/profile');const pd=await p.json().catch(()=>({success:false}));if(p.ok&&pd.success&&pd.user){return {success:true,user:pd.user,recoveredFromProfile:true}}
return d};
})();
