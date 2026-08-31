export const CONTROL_MODULES = [
  {id:'applications',title:'Applications',description:'Register, approve, reject, enable, disable and revoke ecosystem applications.'},
  {id:'credentials',title:'Client credentials',description:'Generate and rotate client credentials with explicit lifecycle controls.'},
  {id:'scopes',title:'Ecosystem scopes',description:'Manage the scopes exposed to connected applications.'},
  {id:'redirects',title:'Redirect URIs',description:'Review and manage application callback allowlists.'},
  {id:'sessions',title:'Sessions',description:'Review active account sessions and revoke compromised sessions.'},
  {id:'security',title:'Security',description:'Review security activity and account protection events.'},
  {id:'audit',title:'Audit logs',description:'Track administrative and application lifecycle activity.'},
  {id:'system',title:'System',description:'Review backend connectivity, configuration status and migration state.'}
];

export const STANDARD_SCOPES = ['openid','profile','email','account','session','applications','notifications'];
