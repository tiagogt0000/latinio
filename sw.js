const CACHE='latinio-shell-0.2.1';
const SHELL=['./','./index.html','./app/main.js','./app/confusions.js','./app/confusion-ui.js','./app/feedback.js','./app/updates.js','./app/core.js','./app/store.js','./app/sync.js','./app/vocabulary.js','./app/style.css','./icon.svg','./icon-brand-180.png','./icon-brand-192.png','./icon-brand-512.png','./manifest.webmanifest'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL.map(url=>new Request(url,{cache:'reload'}))))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('latinio-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
 const scope=new URL(self.registration.scope).pathname;
 const asset=url.pathname.slice(scope.length);
 if(!(asset===''||SHELL.some(s=>s.slice(2)===asset)))return;
 event.respondWith(caches.match(event.request,{ignoreSearch:true}).then(cached=>cached||fetch(event.request)));
});

self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')event.waitUntil(self.skipWaiting());});
