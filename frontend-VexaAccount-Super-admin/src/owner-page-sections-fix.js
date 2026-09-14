(()=>{
'use strict';
if(window.__VEXA_OWNER_PAGE_SECTION_FIX__)return;
window.__VEXA_OWNER_PAGE_SECTION_FIX__=true;
const DEDICATED=new Set(['sso-registered','sso-active','sso-credentials','sso-redirects','sso-scopes','sso-config']);
function dedupe(){
  const nav=document.querySelector('.op-side nav');
  if(!nav)return;
  const seen=new Set();
  nav.querySelectorAll('[data-section-route]').forEach(el=>{
    const route=el.getAttribute('data-section-route');
    if(!DEDICATED.has(route))return;
    if(seen.has(route))el.remove(); else seen.add(route);
  });
}
let ticks=0;
const timer=setInterval(()=>{dedupe();if(++ticks>40)clearInterval(timer)},250);
new MutationObserver(dedupe).observe(document.documentElement,{subtree:true,childList:true});
})();
