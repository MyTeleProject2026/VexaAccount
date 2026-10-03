const CACHE='vexachat-shell-v7';
const APP_SHELL=['./','./index.html','./offline.html','./telegram-style-v7.css?v=20261003-02','./app.js','./settings.js','./config.js','./manifest.webmanifest','./icon.svg','./logo.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);
  if(url.pathname.includes('/api/chat/events')) return;
  event.respondWith(fetch(event.request).then(response=>{
    if(response.ok && url.origin===location.origin){const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{});}
    return response;
  }).catch(()=>caches.match(event.request).then(cached=>cached||caches.match('./index.html'))));
});