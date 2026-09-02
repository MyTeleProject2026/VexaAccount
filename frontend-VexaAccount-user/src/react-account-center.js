/* Deprecated compatibility shim.
 * The canonical VexaAccount Account Center is now rendered by account-center-runtime.js.
 * Keep this file syntax-safe for stale cached HTML that may still reference it.
 */
(()=>{
  'use strict';
  if(typeof window.view!=='function') window.view=function(){ return true; };
})();
