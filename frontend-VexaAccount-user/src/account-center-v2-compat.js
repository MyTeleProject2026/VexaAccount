(()=>{
'use strict';
if(window.__VEXA_ACCOUNT_V2_COMPAT__)return;window.__VEXA_ACCOUNT_V2_COMPAT__=true;
document.addEventListener('click',e=>{const b=e.target.closest?.('[data-action="toggle"]');if(!b)return;if(b.dataset.key==='service_activity_enabled')b.dataset.key='activity_history_enabled';if(b.dataset.key==='communication_enabled')b.dataset.key='push_notifications_enabled'},true);
})();
