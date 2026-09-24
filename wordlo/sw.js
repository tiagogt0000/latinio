const VERSION='wordlo-1.0.1-cloud-setup';
const SHELL=['./','./index.html','./app/main.js','./app/core.js','./app/store.js','./app/sync.js','./app/style.css','./icon.svg','./icon-180.png','./icon-192.png','./icon-512.png','./manifest.webmanifest','./EINRICHTUNG.html','./IMPORTFORMAT.md','./examples/sammlung.json','./examples/auffrischen.json','./google/Code.gs','./google/Bridge.html'];
self.addEventListener('install',event=>event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(SHELL))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('wordlo-')&&key!==VERSION)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
  if(url.pathname.endsWith('/version.json')||url.pathname.endsWith('/sw.js'))return;
  event.respondWith((async()=>{const cache=await caches.open(VERSION),cached=await cache.match(event.request,{ignoreSearch:true});if(cached)return cached;return fetch(event.request);})());
});
