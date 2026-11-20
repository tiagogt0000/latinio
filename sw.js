const VERSION='2.26.0';
const PUBLIC='latinio-gate-'+VERSION,PRIVATE='latinio-private-'+VERSION,ROUTING='latinio-routing-v1';
const START=['./','./index.html','./bootstrap.js','./manifest.webmanifest','./icon.svg','./icon-brand-180.png','./icon-brand-192.png','./icon-brand-512.png'];
const local=path=>new URL(path,self.registration.scope).href;
const pins=new Map();
const bounded=(promise,ms=6000)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Local storage timed out')),ms);Promise.resolve(promise).then(value=>{clearTimeout(timer);resolve(value);},error=>{clearTimeout(timer);reject(error);});});
const unavailable=()=>new Response('Die gespeicherte App ist gerade nicht vollständig verfügbar. Bitte die App erneut öffnen.',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
const validPath=path=>typeof path==='string'&&/^(?:app\/[a-zA-Z0-9_./-]+|[a-zA-Z0-9_.-]+)$/.test(path)&&!path.split('/').some(part=>part==='.'||part==='..');
const versionOf=name=>name.replace(/^latinio-(?:private|shell|gate)-/,'');
const compareVersions=(a,b)=>versionOf(b).localeCompare(versionOf(a),undefined,{numeric:true});

// Only opaque digests of verified historical inventories are public. The file
// manifests themselves remain inside authenticated device caches.
const HISTORICAL_INVENTORIES = new Map([
 ["latinio-shell-2.25.0","b1b75ee5948966ec3357540c05ee07975d3162ef0e6da6bd8fd6c999cf829d65"],
 ["latinio-shell-2.23.0","d3d5a6cf9cb3f08117f4ca2a33d212c444022f66e66a0629de3756aa2483eb36"],
 ["latinio-shell-2.22.0 latinio-shell-2.21.0 latinio-shell-2.20.1 latinio-shell-2.20.0 latinio-shell-2.19.0","06ef2981b93635e5ed50dfff69de07cdd1b489ccb73a8bdce3ee5da4cb45abb1"],
 ["latinio-shell-2.18.0","90379a530996167699b9c9f74fc1f6f8de4f52fdee2a35bdb198cc6942d048e1"],
 ["latinio-shell-2.17.3 latinio-shell-2.17.2 latinio-shell-2.17.1 latinio-shell-2.17.0","70c7f77379700045d169550399d19fe0f2086f25d746f466bc2072af4dd66bf5"],
 ["latinio-shell-2.16.0","db205b1ded8ce33743f0e4aa4b648ade226fefc808978492c595e8780c0c4361"],
 ["latinio-shell-2.15.2","6b84245b5212acca84ae4c21d17a214de552a56814260d166222d11c60809ac4"],
 ["latinio-shell-2.15.1 latinio-shell-2.15.0","bbef26a200598e4d43244e8de8e7f568135141f807ab19d881273bfe658af7a8"],
 ["latinio-shell-2.14.0","6b41b220557504ba3fa38000bd0ab5994a7716f5351a19d38f4a9106d4133a2c"],
 ["latinio-shell-2.13.0","c9093deda97c1b29c67bfc19ed4933d0cfcbc6ad86b8ea510e76267a601f2de6"],
 ["latinio-shell-2.12.0 latinio-shell-2.11.0 latinio-shell-2.10.0","d0a7f69c9252ba83d58dc030a3dae5760bfd1f0aa4570ae92fb6c6745bd1064a"],
 ["latinio-shell-2.9.0","2c02130c272b3bec352ed93bc1d54dccca70f36c17c20e07ba59e5df0d8cc2ae"],
 ["latinio-shell-2.8.0","b812c74b30ddc38accfd099d3360788a53067e54d10f00665bfd442882acdd50"],
 ["latinio-shell-2.7.0","3b281e4493bff834f52475ce34654ea3ddc6ec67b3121d40265d2e00164a40e9"],
 ["latinio-shell-2.6.0","018c1478bb5e4f28ded9de5240d001dcc12c63060720f8c0c15d8d41c75d5d72"],
 ["latinio-shell-2.5.2 latinio-shell-2.5.1 latinio-shell-2.5.0","0a4fbc379d24b2760aea2da11c3c37381c79a1afdcb2d406dd7939e5dd1f97b9"],
 ["latinio-shell-2.4.0","050ade84e009d9449a92afcc222b64ff5364952b3df1e0cbc029d8f646fec9d0"],
 ["latinio-shell-2.3.0","90621bf981c29750b6b1b34ea520f5362b9f96a8cbbac1fa5ed4fabafd00d0f0"],
 ["latinio-shell-2.2.2 latinio-shell-2.2.1 latinio-shell-2.2.0 latinio-shell-2.1.5","1eee25a90a354bee98725d8af33beb7e4eae20990fbadbce483a5fb279ae68a2"],
 ["latinio-shell-2.1.4 latinio-shell-2.1.3 latinio-shell-2.1.2 latinio-shell-2.1.1 latinio-shell-2.1.0","0ad4c699f01a54d3bc67347cf2c22cb007d15b3463f55613756e6986edfbb623"],
 ["latinio-shell-2.0.11 latinio-shell-2.0.10 latinio-shell-2.0.9 latinio-shell-2.0.8","39ac386e915e69c5f0b1ee3ef1ebb990466030e56105efc13d5d27da02eea5aa"],
 ["latinio-shell-2.0.7 latinio-shell-2.0.6","f5fbf2fa6daf7ed6515e8a7055775e75b409d88bbebdbfb2c7f56375a3c36f6e"],
 ["latinio-shell-2.0.5","8fb121e8ffe279e7080a52a615a98ab0b392b85fef3e048dc99da6bc46b0a278"],
 ["latinio-shell-2.0.4 latinio-shell-2.0.3 latinio-shell-2.0.2 latinio-shell-2.0.1 latinio-shell-2.0.0 latinio-shell-1.9.12","a424c2b8df63fe80a541383bffc6c4f2ef39fae04ab56697c8013da0684e4c90"],
 ["latinio-shell-1.9.11","ab1583b06596c38649b27ecac53c6c7ee3ccc3cf95ef8746e88d1738cc36bd59"],
 ["latinio-shell-1.9.10 latinio-shell-1.9.9 latinio-shell-1.9.8","24b44bb4c677482e9d9c79a84c282e924b425fbfee1710092ed7341a1b926ba1"],
 ["latinio-shell-1.9.7 latinio-shell-1.9.6 latinio-shell-1.9.5 latinio-shell-1.9.4 latinio-shell-1.9.3 latinio-shell-1.9.2 latinio-shell-1.9.1","ae99bebdccdc807661d31f1693f887117f70b50da3c24613800d2899c3ae419a"],
 ["latinio-shell-1.9.0","c3ec1000b1ddacca75a439fdcbbf8fd6bcaf167901a19e9068b1d93078bdb21d"],
 ["latinio-shell-1.8.12 latinio-shell-1.8.11","66cabd1747c3ba54a65f6e425b53e0df8ec206016fe81d372b703d853439fffc"],
 ["latinio-shell-1.8.10 latinio-shell-1.8.9 latinio-shell-1.8.8","ae22e61df0b273ab10dfbc9982458f2bfbca2fa490666ea27acd1ac7cb266c10"],
 ["latinio-shell-1.8.7 latinio-shell-1.8.6 latinio-shell-1.8.5","68c1909baab04918da48da9fcb80b2dc9cbbddecc8acd73c27c3081e2948876e"],
 ["latinio-shell-1.8.4","d83c6f6d4c721aca38bd1dca8414273656a09c952e092d41c7c66627bbfa39fb"],
 ["latinio-shell-1.8.3 latinio-shell-1.8.2 latinio-shell-1.8.1 latinio-shell-1.8.0","fc79b8480972344fed2993fc149447d64dcbb2fcc9eed8e9b76dc9c78e832103"],
 ["latinio-shell-1.7.0","7231ec6b5544a99427d515c09d9ffe70bd512b61959c97e2936915733f010e06"],
 ["latinio-shell-1.6.2 latinio-shell-1.6.1 latinio-shell-1.6.0 latinio-shell-1.5.0 latinio-shell-1.4.1 latinio-shell-1.4.0 latinio-shell-1.3.1 latinio-shell-1.3.0","531ac5d97f2dfe064617cd091c56b39f2f2631bb1fb44c13971e0dd8c56b3ddb"],
 ["latinio-shell-1.2.0","d9859c31af3c02526c343d35c0be24dd2e4e7cdfa3d35f67bcd7b8c4bbdeb1bb"],
 ["latinio-shell-1.1.0","844671eeb3e3ca3a09ef054da1bf7d938577ef8c7c67cbce3dae7e0227e5d99a"],
 ["latinio-shell-1.0.3 latinio-shell-1.0.2 latinio-shell-1.0.1 latinio-shell-1.0.0","203c1e4f1d06cbcd07c5c8c95301ee6762707cd63a6bfdd0c13dede9fb6cc27d"],
 ["latinio-shell-0.2.3 latinio-shell-0.2.2 latinio-shell-0.2.1","a290e4235a78891bf6399752839354cdbd66efc2650805b9e1ae749cd34b188a"],
 ["latinio-shell-0.2.0","dc9990bd5434219e9c289d6715c7d574bdf078d7ad57eb0ae64a3cb9ca81766b"],
 ["latinio-shell-0.1.3","e57fedae9604befaf14bb6e6a63aa12dd5320dea8fb5b1ed419e6ba64576984b"],
 ["latinio-shell-0.1.2","ff4e59995296b164e5823a86c5fce70dbb7acbc881f5b8f009e8176f2c2c44ed"],
 ["latinio-shell-0.1.1","5a7d5bef5a0e51f6531b7cac6eeaa1344559f4d036fcc86a2454c58fac12e3d4"],
 ["latinio-shell-0.1.0","519f2824eb6557e0b3b1e302c1060b9399242a3dc5fa5a081cca6c0cfae2d5e9"],
 ["latinio-private-2.25.0","81248661c7f3af6580f568cfeed1f2b99dd8174224f96e1f9404324240620a1d"],
 ["latinio-private-2.24.0","d04b76863906cae508ecc859cfeaf25628017e81f33e7f7f109423a2daee3eea"]
].flatMap(([names,digest])=>names.split(' ').map(name=>[name,digest])));
async function historicalInventory(cache,name){
 const expected=HISTORICAL_INVENTORIES.get(name);if(!expected)return false;
 const scope=new URL(self.registration.scope),keys=await cache.keys(),paths=[];
 for(const request of keys){const url=new URL(request.url);if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return false;const path=url.pathname.slice(scope.pathname.length);if(path!=='.complete')paths.push(path);}
 const bytes=new TextEncoder().encode([...new Set(paths)].sort().join('\n'));
 const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
 return digest===expected;
}
async function completePackage(name){
 if(!/^latinio-(?:private|shell)-[\w.-]+$/.test(name))return null;
 const cache=await caches.open(name),index=await cache.match(local('index.html')),main=await cache.match(local('app/main.js'));
 if(!index?.ok||!main?.ok)return null;
 const html=await index.text();
 if(!/<script\b[^>]*\bsrc\s*=\s*["'](?:\.\/)?app\/main\.js(?:\?[^"']*)?["']/i.test(html))return null;
 const marker=await cache.match(local('.complete'));
 if(name.startsWith('latinio-private-')&&!marker)return null;
 if(marker){
  const text=await marker.text();let manifest;try{manifest=JSON.parse(text);}catch{}
  if(manifest&&typeof manifest==='object'){
   if(manifest.version!==versionOf(name)||!Array.isArray(manifest.files)||!manifest.files.includes('index.html')||!manifest.files.includes('app/main.js')||new Set(manifest.files).size!==manifest.files.length||!manifest.files.every(validPath))return null;
   // The installer writes only successful responses and commits the inventory last.
   // Listing keys avoids reading every audio file, script and stylesheet at startup.
   const urls=new Set((await cache.keys()).map(request=>request.url));
   if(!manifest.files.every(path=>urls.has(local(path))))return null;
   return {name,version:manifest.version,kind:'private'};
  }
  if(text.trim()!==versionOf(name))return null;
 }
 if(!await historicalInventory(cache,name))return null;
 return {name,version:versionOf(name),kind:name.startsWith('latinio-private-')?'private':'legacy'};
}
async function savedPackage({current=false,excludeCurrent=false}={}){
 const names=current?[PRIVATE]:(await caches.keys()).filter(name=>/^latinio-(?:private|shell)-/.test(name)&&(!excludeCurrent||versionOf(name)!==VERSION)).sort(compareVersions);
 for(const name of names){const candidate=await completePackage(name);if(candidate)return candidate;}
 return null;
}
async function gatePackage(name=PUBLIC){
 const cache=await caches.open(name),index=await cache.match(local('index.html')),script=await cache.match(local('bootstrap.js'));
 if(!index?.ok||!script?.ok||await cache.match(local('.gate-installing')))return null;
 const version=versionOf(name),js=await script.text(),html=await index.text();
 if(js.match(/\bconst\s+VERSION\s*=\s*['"]([^'"]+)['"]/)?.[1]!==version)return null;
 const source=html.match(/<script\b[^>]*\bsrc\s*=\s*['"]([^'"]*bootstrap\.js[^'"]*)['"]/i)?.[1];
 if(!source)return null;const declared=new URL(source,local('index.html')).searchParams.get('v');if(declared&&declared!==version)return null;
 if(!(await Promise.all(START.map(async path=>(await cache.match(local(path)))?.ok===true))).every(Boolean))return null;
 return {name,version:versionOf(name),kind:'gate'};
}
async function persistPin(id,pin){
 if(!id||!pin)return;const cache=await caches.open(ROUTING);
 const saved={...pin,createdAt:Date.now()};await cache.put(local('.routing/client/'+encodeURIComponent(id)),new Response(JSON.stringify(saved),{headers:{'Content-Type':'application/json'}}));pins.set(id,saved);
}
async function removeOrphanPins(startedAt){
 const live=new Set((await self.clients.matchAll({type:'window',includeUncontrolled:true})).map(client=>client.id)),cache=await caches.open(ROUTING),prefix=local('.routing/client/');
 for(const request of await cache.keys()){
  if(!request.url.startsWith(prefix))continue;const id=decodeURIComponent(request.url.slice(prefix.length));if(live.has(id))continue;
  let pin;try{pin=await (await cache.match(request)).json();}catch{}
  // A navigation may be pinned before its new Client appears in matchAll().
  if((pin?.createdAt||0)>=startedAt-60000)continue;
  await cache.delete(request);pins.delete(id);
 }
}
async function readPin(id){
 if(!id)return null;if(pins.has(id))return pins.get(id);
 const cache=await caches.open(ROUTING),response=await cache.match(local('.routing/client/'+encodeURIComponent(id)));
 if(!response)return null;try{const pin=await response.json();if(!/^latinio-(?:private|shell|gate)-[\w.-]+$/.test(pin.name)||!['private','legacy','gate'].includes(pin.kind))return null;pins.set(id,pin);return pin;}catch{return null;}
}
async function inheritedPin(id,path){
 const existing=await readPin(id);if(existing)return existing;
 const routing=await caches.open(ROUTING),response=await routing.match(local('.routing/activation'));
 let previous;try{previous=await response?.json();}catch{}
 const client=id?await self.clients.get(id):null,isGate=path==='bootstrap.js'||new URL(client?.url||local('')).searchParams.has('gate');
 const pin=isGate?await gatePackage(previous?.gate||PUBLIC):previous?.app?await completePackage(previous.app):await savedPackage();
 if(pin)await persistPin(id,pin);return pin;
}

self.addEventListener('install',event=>event.waitUntil(bounded((async()=>{
 const responses=await Promise.all(START.map(async path=>{const url=new URL(local(path));url.searchParams.set('v',VERSION);const response=await fetch(new Request(url,{cache:'reload'}));if(!response.ok)throw Error('Gate download failed');const bytes=await response.arrayBuffer();return [path,{bytes,type:response.headers.get('Content-Type')||'application/octet-stream'}];}));
 const html=new TextDecoder().decode(responses.find(([path])=>path==='./index.html')[1].bytes),js=new TextDecoder().decode(responses.find(([path])=>path==='./bootstrap.js')[1].bytes);
 const source=html.match(/<script\b[^>]*\bsrc\s*=\s*['"]([^'"]*bootstrap\.js[^'"]*)['"]/i)?.[1];
 if(!source||new URL(source,local('index.html')).searchParams.get('v')!==VERSION||js.match(/\bconst\s+VERSION\s*=\s*['"]([^'"]+)['"]/)?.[1]!==VERSION)throw Error('Gate files belong to different versions');
 const cache=await caches.open(PUBLIC);await cache.put(local('.gate-installing'),new Response(VERSION));
 for(const [path,response] of responses)await cache.put(local(path),new Response(response.bytes,{headers:{'Content-Type':response.type}}));
 await cache.delete(local('.gate-installing'));await self.skipWaiting();
})(),20000)));
self.addEventListener('activate',event=>event.waitUntil(bounded((async()=>{
 const startedAt=Date.now();
 const routing=await caches.open(ROUTING),old=await savedPackage({excludeCurrent:true})||await savedPackage();
 const gates=(await caches.keys()).filter(name=>name.startsWith('latinio-gate-')&&name!==PUBLIC).sort(compareVersions);
 const previous={app:old?.name||null,gate:gates[0]||PUBLIC};
 await routing.put(local('.routing/activation'),new Response(JSON.stringify(previous)));
 for(const client of await self.clients.matchAll({type:'window'}))if(!await readPin(client.id))await inheritedPin(client.id,'');
 await removeOrphanPins(startedAt);
 // Keep complete old packages: live tabs and offline restarts can still use them.
 await self.clients.claim();
})()).catch(()=>self.clients.claim())));

async function route(event,url,path){
 if(event.request.mode==='navigate'){
  const pin=url.searchParams.has('gate')?await gatePackage():await savedPackage()||await gatePackage();
  if(!pin)return unavailable();
  await persistPin(event.resultingClientId||event.clientId,pin);
  const entry=await (await caches.open(pin.name)).match(local('index.html'));
  if(!entry)return unavailable();
  if(pin.kind!=='gate'&&pin.version!==VERSION){
   // An installed app stays interactive while the signed-in account stages the
   // new package. Its existing scripts and styles remain pinned to one version.
   const installer='<script defer data-latinio-update src="./bootstrap.js?background='+VERSION+'"></script>';
   const html=await entry.text();
   return new Response(html.includes('</head>')?html.replace('</head>',installer+'</head>'):html+installer,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'}});
  }
  return entry;
 }
 if(path==='bootstrap.js'&&url.searchParams.has('background')){
  const version=url.searchParams.get('background');
  if(!/^\d+\.\d+\.\d+$/.test(version))return unavailable();
  return await (await caches.open('latinio-gate-'+version)).match(local('bootstrap.js'))||unavailable();
 }
 const pin=await inheritedPin(event.clientId,path);
 if(pin){
  const response=await (await caches.open(pin.name)).match(local(path),{ignoreSearch:true});
  // Never repair one version with a module, stylesheet, icon or sound from another.
  return response||unavailable();
 }
 if(path.startsWith('app/'))return new Response('Anmeldung erforderlich.',{status:401,headers:{'Content-Type':'text/plain; charset=utf-8'}});
 const gate=await gatePackage();return gate?await (await caches.open(gate.name)).match(local(path),{ignoreSearch:true})||unavailable():unavailable();
}
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url),scope=new URL(self.registration.scope);
 if(event.request.method!=='GET'||url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname))return;
 const path=url.pathname.slice(scope.pathname.length)||'index.html';
 if(path==='sw.js'||path==='version.json')return;
 event.respondWith(bounded(route(event,url,path)).catch(unavailable));
});
self.addEventListener('message',event=>{
 if(event.data?.type==='ACTIVATE_UPDATE')event.waitUntil(self.skipWaiting());
 if(event.data?.type==='GET_VERSION')event.waitUntil(bounded((async()=>{
  const pin=await readPin(event.source?.id);
  // Older clients reload automatically when a new worker reports itself ready.
  // Report readiness only after the corresponding private files are available.
  const staged=!pin||pin.kind==='gate'||pin.version===VERSION||await savedPackage({current:true});
  event.ports[0]?.postMessage({version:staged?VERSION:pin.version});
 })()).catch(()=>event.ports[0]?.postMessage({version:null})));
 if(event.data?.type==='GET_OFFLINE_STATUS')event.waitUntil(bounded((async()=>{const current=await savedPackage({current:true}),saved=current||await savedPackage();event.ports[0]?.postMessage({available:!!saved,current:!!current,...(saved?{version:saved.version}:{})});})()).catch(()=>event.ports[0]?.postMessage({available:false,current:false,error:'Lokaler Speicher nicht verfügbar.'})));
 if(event.data?.type==='PIN_GATE'&&event.source?.id)event.waitUntil(bounded((async()=>{const pin=await gatePackage('latinio-gate-'+String(event.data.version||VERSION));if(pin)await persistPin(event.source.id,pin);})()).catch(()=>{}));
});
