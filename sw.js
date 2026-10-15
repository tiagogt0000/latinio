const CACHE='latinio-shell-2.5.1';
const SHELL=['./','./index.html','./app/main.js','./app/streak-demo.js','./app/streak.js','./app/round-completion.js','./app/round-transition.js','./app/streak-demo.css','./app/error-retry.js','./app/predicates.js','./app/predicate-ui.js','./app/app-lifecycle.js','./app/subjects.js','./app/french.js','./app/notifications.js','./icon-vocabify.svg','./app/subject-preference.js','./app/subject-entrance.js','./app/english.js','./app/keyboard.js','./app/answer-fields.js','./app/training-queue.js','./app/progressive-learning.js','./app/refresh-import.js','./app/refresh-reconcile.js','./app/activity.js','./app/refresh-cards.js','./app/classroom.js','./app/collection-learning.js','./app/refresh-decks.js','./app/refresh-ui.js','./app/morphology.js','./app/accounts.js','./app/cloud-config.js','./app/sharing-ui.js','./app/sharing-check.js','./app/share-access.js','./app/multiuser-sync.js','./app/confusions.js','./app/confusion-ui.js','./app/feedback.js','./app/updates.js','./app/core.js','./app/store.js','./app/sync.js','./app/rest-bridge.js','./app/vocabulary.js','./app/style.css','./icon.svg','./icon-english.svg','./icon-brand-180.png','./icon-brand-192.png','./icon-brand-512.png','./manifest.webmanifest'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL.map(url=>new Request(url,{cache:'reload'}))))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('latinio-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin)return;
 const scope=new URL(self.registration.scope).pathname;
 const asset=url.pathname.slice(scope.length);
 if(!(asset===''||SHELL.some(s=>s.slice(2)===asset)))return;
 event.respondWith(caches.open(CACHE).then(cache=>cache.match(event.request,{ignoreSearch:true})).then(cached=>cached||fetch(event.request)));
});

self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')event.waitUntil(self.skipWaiting());});

self.addEventListener('message',event=>{if(event.data?.type==='GET_VERSION')event.ports[0]?.postMessage({version:'2.5.1'});});

self.addEventListener('push',event=>{
 let payload={};try{payload=event.data?.json()||{};}catch{}
 event.waitUntil(self.registration.showNotification(String(payload.title||'Latinio · Lernen').slice(0,100),{
  body:String(payload.body||'Eine kleine Lernrunde wartet auf dich. ✨').slice(0,240),
  icon:new URL('./icon-brand-192.png',self.registration.scope).href,
  tag:String(payload.tag||'latinio-learn').slice(0,100),data:{url:payload.url},renotify:false
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  let target=new URL('./',self.registration.scope);
  try{const requested=new URL(event.notification.data?.url||'./',self.registration.scope);const subject=requested.searchParams.get('subject');if(['latin','english','french'].includes(subject))target.searchParams.set('subject',subject);}catch{}
  target.searchParams.set('from','reminder');
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  const existing=windows.find(client=>new URL(client.url).origin===target.origin&&new URL(client.url).pathname.startsWith(new URL(self.registration.scope).pathname));
  // Keep an in-progress round and its typed answers intact.
  if(existing)return existing.focus();
  return self.clients.openWindow(target.href);
 })());
});
