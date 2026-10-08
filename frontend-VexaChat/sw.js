const CACHE='vexachat-shell-v17-20261009';
const APP_SHELL=['./','./index.html','./offline.html','./telegram-style-v7.css?v=20261009-13','./app.js?v=20261009-13','./settings.js?v=20261009-13','./config.js','./manifest.webmanifest','./icon.svg','./logo.svg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting()});
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  const url=new URL(event.request.url);
  if(url.pathname.includes('/api/chat/events')) return;
  event.respondWith((async()=>{
    try{
      const response=await fetch(event.request,{cache:'no-store'});
      if(response.ok&&url.origin===location.origin&&(!url.pathname.endsWith('/app.js')&&!url.pathname.endsWith('/settings.js')&&!url.pathname.endsWith('/index.html')&&!url.pathname.endsWith('/config.js'))){
        const copy=response.clone();caches.open(CACHE).then(c=>c.put(event.request,copy)).catch(()=>{});
      }
      return response;
    }catch(e){
      const cached=await caches.match(event.request);
      return cached||caches.match('./index.html');
    }
  })());
});