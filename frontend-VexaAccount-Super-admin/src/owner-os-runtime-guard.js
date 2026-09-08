(()=>{'use strict';
if(window.__VEXA_OWNER_RUNTIME_GUARD__)return;window.__VEXA_OWNER_RUNTIME_GUARD__=true;
// Owner OS now owns its own request timeout boundary. This guard intentionally does
// not wrap fetch(), auto-reload the application, or retry a partially rendered page.
// Those behaviors can create competing AbortControllers and leave the browser in a
// perpetual reload/recovery state when one backend request is slow.
})();
