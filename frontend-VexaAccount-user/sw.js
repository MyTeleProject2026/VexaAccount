/* VexaAccount root service worker: app-wide scope, safe shell caching, no API interception. */
const CACHE='vexaaccount-user-shell-v9';
const SHELL=['/','/src/app.js','/src/account-center-loader.js','/src/account-center-runtime-v2.js','/src/pwa.js','/src/theme.css','/src/styles.css','/src/startup-stability.css','/public/auth.css','/manifest.json','/public/brand.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('vexaaccount-user-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin||url.pathname.startsWith('/api/'))return;
  event.respondWith(fetch(event.request,{cache:'no-store'}).catch(()=>caches.match(event.request).then(r=>r||caches.match('/'))));
});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
