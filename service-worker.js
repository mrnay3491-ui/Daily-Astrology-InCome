const CACHE='daily-astrology-business-v2-share-20261112';
const FILES=['./','./index.html','./manifest.json','./icon.svg','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('daily-astrology-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
const url=new URL(event.request.url);const isDocument=event.request.mode==='navigate'||url.pathname.endsWith('/index.html')||url.pathname.endsWith('/');
if(isDocument){event.respondWith(fetch(event.request).then(response=>{if(response.ok){let cp=response.clone();caches.open(CACHE).then(c=>c.put(event.request,cp))}return response}).catch(()=>caches.match(event.request).then(x=>x||caches.match('./index.html'))));return}
event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok){let cp=response.clone();caches.open(CACHE).then(c=>c.put(event.request,cp))}return response})))})