const VERSION='2.25.0';
const PUBLIC='latinio-gate-'+VERSION,PRIVATE='latinio-private-'+VERSION;
const START=['./','./index.html','./bootstrap.js','./manifest.webmanifest','./icon.svg','./icon-brand-180.png','./icon-brand-192.png','./icon-brand-512.png'];
const local=path=>new URL(path,self.registration.scope).href;
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(PUBLIC);await cache.addAll(START.map(url=>new Request(url,{cache:'reload'})));await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
async function privateCache(){const cache=await caches.open(PRIVATE);return await cache.match(local('.complete'))?cache:null;}
async function savedResponse(path){
 const names=(await caches.keys()).filter(name=>name.startsWith('latinio-private-')||name.startsWith('latinio-shell-')).reverse();
 for(const name of names){const cache=await caches.open(name);if(name.startsWith('latinio-private-')&&!await cache.match(local('.complete')))continue;const response=await cache.match(local(path),{ignoreSearch:true});if(response)return response;}
}
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url),scope=new URL(self.registration.scope);
 if(event.request.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
 const path=url.pathname.slice(scope.pathname.length)||'index.html';
 if(path==='sw.js'||path==='version.json')return;
 event.respondWith((async()=>{
  const cache=await privateCache();
  if(event.request.mode==='navigate'){
   if(!url.searchParams.has('gate')&&cache){const response=await cache.match(local('index.html'));if(response)return response;}
   if(url.searchParams.get('offline')==='1'){const old=await savedResponse('index.html');if(old)return old;}
   const shell=await caches.open(PUBLIC);return await shell.match(local('index.html'))||fetch(event.request);
  }
  if(path.startsWith('app/')){
   const response=await cache?.match(local(path),{ignoreSearch:true})||await savedResponse(path);
   return response||new Response('Anmeldung erforderlich.',{status:401,headers:{'Content-Type':'text/plain'}});
  }
  const shell=await caches.open(PUBLIC);return await shell.match(event.request,{ignoreSearch:true})||await cache?.match(event.request,{ignoreSearch:true})||fetch(event.request);
 })());
});
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')event.waitUntil(self.skipWaiting());if(event.data?.type==='GET_VERSION')event.ports[0]?.postMessage({version:VERSION});});
