/* VexaAccount PWA service worker — versioned static shell, network-first navigation, never cache API. */
const CACHE='vexaaccount-user-shell-v13';
const SHELL=['/','/offline.html','/src/app.js','/src/account-center-loader.js','/src/account-center-runtime-v2.js','/src/account-center-premium-theme.js','/src/account-center-fetch-guard.js','/src/pwa.js','/src/theme.css','/src/styles.css','/src/premium.css','/src/glass-premium.css','/src/responsive-premium.css','/src/startup-stability.css','/public/auth.css','/public/manifest.json','/public/brand.svg','/public/icons/icon-192.png','/public/icons/icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>Promise.all(SHELL.map(u=>c.add(u).catch(()=>null)))).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('vexaaccount-user-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET')return;
 const u=new URL(e.request.url);
 if(u.origin!==self.location.origin||u.pathname.startsWith('/api/')||u.pathname.startsWith('/auth/'))return;
 if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).then(r=>{if(r.ok)caches.open(CACHE).then(c=>c.put(e.request,r.clone()));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('/offline.html'))));return}
 e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{if(r.ok)caches.open(CACHE).then(c=>c.put(e.request,r.clone()));return r})).catch(()=>caches.match('/offline.html')));
});
self.addEventListener('message',e=>{if(e.data?.type==='SKIP_WAITING')self.skipWaiting()});