(()=>{
'use strict';
if(window.__VEXA_OWNER_OPERATION_RUNTIME_V6__)return;
window.__VEXA_OWNER_OPERATION_RUNTIME_V6__=true;
window.__VEXA_OWNER_OPERATION_RUNTIME_V5__=true;
window.__VEXA_OWNER_OPERATION_RUNTIME_V4__=true;
window.__VEXA_OWNER_OPERATION_RUNTIME_V3__=true;
const API=(window.VEXA_ACCOUNT_ADMIN_API_BASE||'https://api-vexaaccount.onrender.com').replace(/\/$/,'');
const POLL_DELAY_MS=900;
const REQUEST_TIMEOUT_MS=12000;
const MAX_EVENTS=100;
const TERMINAL=new Set(['completed','failed','cancelled','stalled']);
const state={panel:null,activeId:null,watchers:new Map(),timer:null,pollTimer:null,pollInFlight:false,pollEpoch:0,minimized:false};
const isTerminal=s=>TERMINAL.has(String(s||'').toLowerCase());
const elapsed=ms=>{let n=Math.max(0,Math.floor(ms/1000)),h=Math.floor(n/3600),m=Math.floor((n%3600)/60),s=n%60;return [h,m,s].map(v=>String(v).padStart(2,'0')).join(':')};
function readToken(v){if(!v)return '';let x=String(v).trim();try{const p=JSON.parse(x);if(typeof p==='string')x=p;else if(p&&typeof p==='object')x=p.token||p.accessToken||p.access_token||''}catch(_){}return String(x||'').replace(/^Bearer\s+/i,'').trim()}
function authHeaders(){const h={Accept:'application/json','Cache-Control':'no-cache'},values=[];try{['adminToken','admin_token','superAdminToken','super_admin_token','accessToken','access_token','token'].forEach(k=>{values.push(localStorage.getItem(k));values.push(sessionStorage.getItem(k))})}catch(_){}values.push(window.VEXA_ACCOUNT_ADMIN_TOKEN,window.VEXA_SUPER_ADMIN_TOKEN,window.vexaAdminToken,window.vexaSuperAdminToken);for(const v of values){const t=readToken(v);if(t){h.Authorization='Bearer '+t;break}}return h}
function authFetch(url,options={}){const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),REQUEST_TIMEOUT_MS);const opts={...options,credentials:'include',cache:'no-store',signal:ctl.signal,headers:{...authHeaders(),...(options.headers||{})}};const nativeFetch=window.__VEXA_OWNER_NATIVE_FETCH__;const transport=typeof nativeFetch==='function'?nativeFetch:(typeof window.fetch==='function'?window.fetch.bind(window):null);if(!transport){clearTimeout(timer);return Promise.reject(new Error('Native browser fetch is unavailable.'))}return transport(url,opts).catch(e=>{if(e?.name==='AbortError'){const x=Error('Operation status request timed out; retrying without blocking the workspace.');x.code='OWNER_OPERATION_STATUS_TIMEOUT';throw x}throw e}).finally(()=>clearTimeout(timer))}
})();
