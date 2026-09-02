/* VexaAccount root service worker: app-wide scope, navigation fallback, safe asset caching, never cache API/auth responses. */
const CACHE='vexaaccount-user-shell-v10';
const SHELL=['/','/offline.html','/src/app.js','/src/account-center-loader.js','/src/account-center-runtime-v2.js','/src/pwa.js','/src/theme.css','/src/styles.css','/src/startup-stability.css','/public/auth.css','/manifest.json','/public/brand.svg','/public/icons/icon-192.png','/public/icons/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(async cache=>{for(const url of SHELL){try{await cache.add(url)}catch{}}}).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('vexaaccount-user-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);
 if(url.origin!==self.location.origin||url.pathname.startsWith('/api/')||url.pathname.startsWith('/auth/'))return;
 if(event.request.mode==='navigate'){event.respondWith(fetch(event.request,{cache:'no-store'}).catch(()=>caches.match('/offline.html')));return}
 event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{})}return response}).catch(()=>caches.match(event.request).then(r=>r||caches.match('/offline.html'))));
});
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
