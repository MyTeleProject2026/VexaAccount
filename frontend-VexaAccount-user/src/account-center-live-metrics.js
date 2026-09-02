(()=>{
'use strict';
if(window.__VEXA_ACCOUNT_CENTER_LIVE_METRICS_V2__)return;
window.__VEXA_ACCOUNT_CENTER_LIVE_METRICS_V2__=true;
// Security score is already represented by the authenticated /security snapshot.
// Do not issue a second network request just to display the same value.
function sync(){for(const stat of document.querySelectorAll('.vx-stat')){if(!/security strength/i.test(stat.textContent||''))continue;const strong=stat.querySelector('strong');if(strong&&/^\d+%$/.test((strong.textContent||'').trim()))return;}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync,{once:true});else sync();
const observer=new MutationObserver(()=>{if(document.querySelector('.vx-content')){sync();observer.disconnect()}});if(document.documentElement)observer.observe(document.documentElement,{childList:true,subtree:true});
})();
