'use strict';
(()=>{
const API='https://elektrogilbersserver.tail7c7157.ts.net:8443/api';
const VERSION='2.30.0';
const ACTIVE='latinio-account-v2';
const STORAGE_WAIT=5000,WORKER_WAIT=10000;
const $=id=>document.getElementById(id);
let admin=false,busy=false,registration,operation=0,pendingLogin=null,retryTimer,retryDelay=1000;
const onlineEntry=new URL('/latinio/',API);onlineEntry.port='';
function directMode(){const page=new URL(location.href);return [onlineEntry.origin,new URL(API).origin].includes(page.origin) && ([onlineEntry.pathname.slice(0,-1),onlineEntry.pathname,onlineEntry.pathname+'index.html'].includes(page.pathname));}
const directURL=path=>new URL('/latinio/'+path,location.href).href;
const accountAPI=()=>directMode()?directURL('api'):API;
function supportsInstallation(){
 try{return !!(navigator.serviceWorker && globalThis.caches && globalThis.indexedDB);}catch{return false;}
}
function usableStorage(){try{return !!(globalThis.indexedDB && globalThis.localStorage);}catch{return false;}}
function unsupported(){return Error('Dieser Browser kann die Offline-App hier nicht einrichten. Öffne Latinio direkt auf dem Lernserver.');}

const cancelled=()=>Object.assign(Error('Der vorherige Vorgang wurde beendet.'),{cancelled:true});
function guard(run){if(run!==operation)throw cancelled();}
function status(message){$('status').textContent=message;}
function showPanel(message=''){$('gate-panel').hidden=false;status(message);
 if($('login').hidden){$('heading').textContent='Latinio';$('intro').hidden=true;}
}
function showInstall(message){
 $('login').hidden=true;$('toggle').hidden=true;$('retry').hidden=true;
 $('online-entry').hidden=true;showPanel(message);
}
function showLogin(message=''){$('login').hidden=false;$('toggle').hidden=false;$('heading').textContent=admin?'Admin-Anmeldung':'Willkommen bei Latinio';$('intro').hidden=false;showPanel(message);}
function failure(error){
 clearTimeout(retryTimer);
 if(error?.transient && $('login').hidden && !document.hidden && navigator.onLine!==false){
  const run=operation;
  retryTimer=setTimeout(()=>{if(run===operation && !busy && !document.hidden)void start();},retryDelay);
  retryDelay=Math.min(15000,retryDelay*2);
 }
 if(error?.nextVersion){const url=new URL(location.href);if(/^\d+\.\d+\.\d+$/.test(error.nextVersion)&&url.searchParams.get('_gateVersion')!==error.nextVersion){url.searchParams.delete('gate');url.searchParams.set('_gateVersion',error.nextVersion);url.searchParams.delete('offline');status('Die aktuelle App wird geöffnet …');location.replace(url.href);return;}}
 const message=error?.message||'Die Verbindung ist gerade nicht verfügbar. Bitte erneut versuchen.';
 if(error?.login){pendingLogin=null;showLogin(message);}else showPanel(message);
 $('retry').hidden=!!error?.login;
 $('online-entry').hidden=directMode()||!!error?.login;
}
function checkWorkerVersion(version){
 const parts=value=>/^\d+\.\d+\.\d+$/.test(value||'')?value.split('.').map(Number):null,a=parts(version),b=parts(VERSION);
 if(a&&b&&a.some((value,index)=>value>b[index]&&a.slice(0,index).every((part,i)=>part===b[i])))throw Object.assign(Error('Diese Startseite ist noch nicht aktuell. Bitte erneut versuchen.'),{nextVersion:version});
 return version===VERSION;
}
function bounded(promise,ms,message,cancel=()=>{}){
 return new Promise((resolve,reject)=>{let settled=false;const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(value);};const timer=setTimeout(()=>{try{cancel();}catch{}finish(Error(message));},ms);Promise.resolve(promise).then(value=>finish(null,value),error=>finish(error));});
}
async function request(url,options,ms){
 const controller=new AbortController();
 return bounded((async()=>{let response;
  try{response=await fetch(url,{...options,signal:controller.signal});}
  catch{throw Object.assign(Error(navigator.onLine===false?'Du bist offline. Für die Anmeldung brauchst du eine Internetverbindung.':'Der Lernserver ist von diesem Browser aus gerade nicht erreichbar.'),{transient:true});}
  if(response.status===204)return {response,body:null};
  let body;try{body=await response.json();}catch{if(response.ok)throw Error('Die Antwort konnte nicht gelesen werden. Bitte erneut versuchen.');body={};}return {response,body};})(),ms,'Die Verbindung antwortet gerade nicht. Bitte erneut versuchen.',()=>controller.abort());
}
function dbName(profile){return profile.id==='admin'?'latinio-v1':'latinio-profile-'+profile.id;}
async function database(profile){return new Promise((resolve,reject)=>{
 let settled=false,timer;const finish=(error,db)=>{if(settled){db?.close();return;}settled=true;clearTimeout(timer);error?reject(error):resolve(db);};
 let request;try{request=indexedDB.open(dbName(profile),1);}catch(error){finish(error);return;}
 timer=setTimeout(()=>finish(Error('Der Gerätespeicher antwortet nicht. Bitte andere Latinio-Fenster schließen und erneut versuchen.')),STORAGE_WAIT);
 request.onupgradeneeded=()=>{if(settled){request.transaction?.abort();return;}if(!request.result.objectStoreNames.contains('state'))request.result.createObjectStore('state');};
 request.onsuccess=()=>finish(null,request.result);request.onerror=()=>finish(request.error||Error('Der Gerätespeicher konnte nicht geöffnet werden.'));request.onblocked=()=>finish(Error('Bitte andere Latinio-Fenster schließen und erneut versuchen.'));
});}
async function storedDocument(db,update){
 let tx;
 return bounded(new Promise((resolve,reject)=>{
  tx=db.transaction('state',update?'readwrite':'readonly');const store=tx.objectStore('state'),read=store.get('main');let value;
  read.onsuccess=()=>{try{value=update?update(read.result):read.result;if(update)store.put(value,'main');}catch(error){reject(error);tx.abort();}};
  tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error||Error('Der Gerätespeicher konnte nicht gelesen werden.'));tx.onabort=()=>reject(tx.error||Error('Speichern wurde unterbrochen. Bitte erneut versuchen.'));
 }),STORAGE_WAIT,'Der Gerätespeicher antwortet nicht. Bitte erneut versuchen.',()=>tx?.abort());
}
async function savedSession(){
 let profile;try{profile=JSON.parse(localStorage.getItem(ACTIVE));}catch{}
 if(!profile?.id)return null;
 const db=await database(profile);
 try{const doc=await storedDocument(db);return doc?.config?.token?{profile,token:doc.config.token}:null;}finally{db.close();}
}
async function saveSession(result,run){
 const db=await database(result.profile);
 try{await storedDocument(db,current=>{guard(run);const doc=current||{schema:1,device:crypto.randomUUID(),seq:0,base:0,shadow:{collections:{},words:{},reviews:{},sessions:{},settings:{}},pending:[],session:null,lastSync:null};doc.config={...doc.config,url:accountAPI(),token:result.token};doc.profile=result.profile;doc.seeded=true;return doc;});}finally{db.close();}
 guard(run);localStorage.setItem(ACTIVE,JSON.stringify(result.profile));localStorage.setItem('latinio-account-migrated-v2','1');
}
function workerMessage(type){return new Promise(resolve=>{
 const worker=navigator.serviceWorker?.controller;if(!worker)return resolve(null);
 let channel,timer,settled=false;const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);channel?.port1.close();channel?.port2.close();resolve(value);};
 try{channel=new MessageChannel();timer=setTimeout(()=>finish(null),['GET_GATE_VERSION','GET_VERSION'].includes(type)?600:3000);channel.port1.onmessage=event=>finish(event.data);worker.postMessage({type},[channel.port2]);}catch{finish(null);}
});}
const workerVersion=async()=>(await workerMessage('GET_GATE_VERSION'))?.version || (await workerMessage('GET_VERSION'))?.version;
async function workerReady({exact=true}={}){
 if(!('serviceWorker'in navigator))throw Error('Bitte öffne Latinio in Safari oder einem aktuellen Browser mit Website-Speicher.');
 const deadline=Date.now()+WORKER_WAIT;
 if(navigator.serviceWorker.controller&&(!exact||checkWorkerVersion(await workerVersion()))){
  // Keep version discovery running even when a cached gate already has a
  // working controller. Its update must never delay opening the saved app.
  Promise.resolve().then(()=>navigator.serviceWorker.getRegistration()).then(value=>value?.update()).catch(()=>{});
  navigator.serviceWorker.controller.postMessage({type:'PIN_GATE',version:VERSION});return;
 }
 registration=await bounded(navigator.serviceWorker.register('./sw.js?v='+VERSION,{updateViaCache:'none'}),Math.max(1,deadline-Date.now()),'Die App konnte nicht vorbereitet werden. Bitte erneut versuchen oder die Offline App öffnen.');
 // serviceWorker.ready can remain pending forever on iPad. Observe the actual
 // controller with one deadline, including registration and activation.
 while(Date.now()<deadline){
  if(registration.waiting)registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});
  if(navigator.serviceWorker.controller&&(!exact||checkWorkerVersion(await workerVersion()))){navigator.serviceWorker.controller.postMessage({type:'PIN_GATE',version:VERSION});return;}
  await new Promise(resolve=>setTimeout(resolve,100));
 }
 throw Error('Die App wird noch vorbereitet. Bitte erneut versuchen oder die Offline App öffnen.');
}
const privateEntry=html=>/<script\b[^>]*\bsrc\s*=\s*["'](?:\.\/)?app\/main\.js(?:\?[^"']*)?["']/i.test(html);
async function completeCache(cache,base,required=[],expectedVersion){
 const marker=await cache.match(new URL('.complete',base));if(!marker)return false;
 const text=await marker.text();let manifest;try{manifest=JSON.parse(text);}catch{}
 if(expectedVersion && (manifest?.version!==expectedVersion || !Array.isArray(manifest.files)))return false;
 const files=[...new Set([...(manifest&&Array.isArray(manifest.files)?manifest.files:['index.html','app/main.js']),...required])];
 if(!files.includes('index.html')||!files.includes('app/main.js'))return false;
 const index=await cache.match(new URL('index.html',base));if(!index||!privateEntry(await index.text()))return false;
 const keys=new Set((await cache.keys()).map(entry=>entry.url));
 return files.every(path=>typeof path==='string'&&keys.has(new URL(path,base).href));
}
async function findOffline(){
 if(!globalThis.caches)return false;
 const base=new URL('./',location.href);
 for(const name of (await caches.keys()).reverse()){
  if(!name.startsWith('latinio-shell-')&&!name.startsWith('latinio-private-'))continue;
  const cache=await caches.open(name);
  if(name.startsWith('latinio-private-')?await completeCache(cache,base):await cache.match(new URL('index.html',base))&&await cache.match(new URL('app/main.js',base))&&privateEntry(await(await cache.match(new URL('index.html',base))).text()))return true;
 }
 return false;
}
function probeOffline(){return bounded(findOffline(),STORAGE_WAIT,'Die gespeicherte App konnte gerade nicht geprüft werden.').then(found=>{$('offline').hidden=!found;return found;},()=>false);}
async function offlineStatus(){const status=await workerMessage('GET_OFFLINE_STATUS');if(status&&typeof status.available==='boolean'){$('offline').hidden=!status.available;return status;}return null;}
function enterApp(offline=false){const url=new URL(location.href);url.searchParams.delete('gate');url.searchParams.delete('_gateVersion');if(offline)url.searchParams.set('offline','1');else url.searchParams.delete('offline');location.replace(url.href);}
async function writePackage(token,run,name,onProgress){
 const base=new URL('./',globalThis.registration?.scope || location.href);
 const cache=await bounded(caches.open(name),STORAGE_WAIT,'Die App konnte auf diesem Gerät nicht gespeichert werden.');guard(run);
 if(await bounded(completeCache(cache,base,[],VERSION),STORAGE_WAIT,'Die gespeicherte App antwortet nicht. Bitte erneut versuchen.'))return;
 guard(run);
 const url=new URL('/app-package',API);url.searchParams.set('version',VERSION);
 const {response,body:bundle}=await request(url.href,{headers:{Authorization:'Bearer '+token},mode:'cors',credentials:'omit',cache:'no-store'},60000);guard(run);
 if(response.status===401){const error=Error('Bitte melde dich erneut an.');error.login=true;throw error;}
 if(response.status===409)checkWorkerVersion(bundle?.currentVersion);
 if(!response.ok)throw Object.assign(Error('Das App-Paket konnte gerade nicht geladen werden. Bitte erneut versuchen.'),{transient:response.status>=500});
 if(bundle.version!==VERSION||!Array.isArray(bundle.files))throw Error('Eine neue Version wird gerade bereitgestellt. Bitte gleich erneut versuchen.');
 const paths=new Set();for(const file of bundle.files){if(typeof file.path!=='string'||!/^(?:app\/[a-zA-Z0-9_./-]+|[a-zA-Z0-9_.-]+)$/.test(file.path)||file.path.split('/').some(p=>p==='..'||p==='.')||paths.has(file.path)||typeof file.body!=='string'||typeof file.type!=='string')throw Error('Die App-Dateien sind ungültig.');paths.add(file.path);}
 if(!paths.has('index.html')||!paths.has('app/main.js'))throw Error('Die App-Dateien sind unvollständig.');
 if(!privateEntry(atob(bundle.files.find(file=>file.path==='index.html').body)))throw Error('Die App-Dateien sind unvollständig.');
 await bounded(cache.delete(new URL('.complete',base)),STORAGE_WAIT,'Die App konnte auf diesem Gerät nicht gespeichert werden.');
  // Bound outstanding writes on memory-constrained devices while avoiding one disk round trip per file.
  for(let start=0;start<bundle.files.length;start+=6){
   guard(run);
   const batch=bundle.files.slice(start,start+6);
   await Promise.all(batch.map(file=>{
    const bytes=Uint8Array.from(atob(file.body),c=>c.charCodeAt(0));
    return bounded(cache.put(new URL(file.path,base),new Response(bytes,{headers:{'Content-Type':file.type}})),STORAGE_WAIT,'Die App konnte auf diesem Gerät nicht vollständig gespeichert werden.');
   }));
   guard(run);onProgress?.(start+batch.length,bundle.files.length);
  }
 guard(run);await bounded(cache.put(new URL('.complete',base),new Response(JSON.stringify({version:VERSION,files:[...paths]}),{headers:{'Content-Type':'application/json'}})),STORAGE_WAIT,'Die App konnte auf diesem Gerät nicht vollständig gespeichert werden.');
}
async function installPackage(token,run,{background=false,onProgress}={}){
 const name='latinio-private-'+VERSION,write=()=>writePackage(token,run,name,onProgress);
 if(navigator.locks?.request){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),20000);
  try{await navigator.locks.request(name,{signal:controller.signal},()=>{clearTimeout(timer);return write();});}
  catch(error){if(controller.signal.aborted)throw Error('Ein anderes Latinio-Fenster richtet die App gerade ein. Bitte erneut versuchen.');throw error;}
  finally{clearTimeout(timer);}
 }else await write();
 guard(run);if(!background)enterApp();
}
// An older page gets this bridge when the new worker serves its pinned bundle.
// Only reopen an identified idle screen. A lesson can start while the download runs.
function stageUpdate(){
 let running=false,complete=false,reloading=false,observer,retry;
 function openWhenIdle(){
  if(!complete || reloading || document.hidden || window.latinioUpdatesStarted)return;
  const root=document.getElementById('app');
  if(!root || root.querySelector('.ls-fullscreen-learning,.test-shell,.subject-transition,[aria-busy="true"]') || document.querySelector('#modal-root form,.ls-modal form,.ls-tour-layer'))return;
  const picker=root.querySelector('.subject-entrance [data-enter-subject]:not(:disabled)');
  const map=root.querySelector('.ls-overview');
  if(!picker && !map)return;
  if(map && document.querySelector('[data-lesson-orbit],.ls-modal-layer'))return;
  if(map)try{const subject=root.querySelector('[data-landscape-root]')?.dataset.subject;if(subject)sessionStorage.setItem('latinio-direct-subject-switch',subject);}catch{}
  reloading=true;observer?.disconnect();clearTimeout(retry);location.reload();
 }
 async function attempt(){
  if(window.latinioUpdatesStarted){observer?.disconnect();clearTimeout(retry);return;}
  if(complete){openWhenIdle();return;}
  if(running||document.hidden||navigator.onLine===false)return;
  clearTimeout(retry);running=true;
  try{
   const session=await savedSession();
   if(session){
    await installPackage(session.token,operation,{background:true});complete=true;
    const root=document.getElementById('app');
    if(root){observer=new MutationObserver(openWhenIdle);observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['aria-busy','disabled','class']});}
    openWhenIdle();
   }
  }catch{/* Keep using the complete older package during a deployment or connection interruption. */}
  finally{running=false;if(!complete&&!document.hidden)retry=setTimeout(attempt,4000);}
 }
 void attempt();window.addEventListener('online',attempt);document.addEventListener('visibilitychange',attempt);
}
async function openDirect(token,run){
 const {response}=await request(directURL('session'),{method:'POST',headers:{Authorization:'Bearer '+token},credentials:'same-origin',cache:'no-store'},20000);guard(run);
 if(response.status===401)throw Object.assign(Error('Deine Anmeldung ist abgelaufen. Bitte melde dich erneut an.'),{login:true});
 if(response.status!==204)throw Object.assign(Error('Der Lernserver konnte die App gerade nicht öffnen. Bitte erneut versuchen.'),{transient:response.status>=500});
 const check=await request(directURL('session'),{credentials:'same-origin',cache:'no-store'},10000);guard(run);
 if(check.response.status===401)throw Error('Der Browser speichert die Anmeldung hier nicht. Erlaube Cookies für diesen Lernserver und tippe auf „Erneut versuchen“.');
 if(check.response.status!==204)throw Object.assign(Error('Die gespeicherte Anmeldung konnte gerade nicht geprüft werden. Bitte erneut versuchen.'),{transient:check.response.status>=500});
 enterApp();
}
const installProgress=(done,total)=>status(`Die Lernapp wird gespeichert … ${done} von ${total} Dateien`);
async function forgetRejectedToken(token){
 const saved=await savedSession();
 if(!saved || saved.token!==token)return;
 const db=await database(saved.profile);
 try{
  await storedDocument(db,doc=>{
   if(doc?.config?.token===token){
    doc.config.token='';
    let active;try{active=JSON.parse(localStorage.getItem(ACTIVE));}catch{}
    if(active?.id===saved.profile.id){localStorage.removeItem(ACTIVE);localStorage.setItem('latinio-account-migrated-v2','1');}
   }
   return doc;
  });
 }finally{db.close();}
}
async function openSignedIn(token,run,{workerChecked=false}={}){
 try{
 if(directMode()){showInstall('Deine Lernapp wird geöffnet …');return await openDirect(token,run);}
 if(!supportsInstallation())throw unsupported();
 showInstall('Deine Lernapp wird heruntergeladen …');
 if(!workerChecked){
  await workerReady();guard(run);
  const saved=await offlineStatus();guard(run);
  if(saved?.current){enterApp();return;}
 }
 await installPackage(token,run,{onProgress:installProgress});
 }catch(error){
  if(error.login && run===operation)await forgetRejectedToken(token).catch(()=>{});
  throw error;
 }
}
function setupGate(){
 // During a Pages rollout a previous document can briefly load the new script.
 if(!$('gate-panel'))document.querySelector('main').id='gate-panel';
 if(!$('online-entry')){
  const link=document.createElement('a');link.id='online-entry';link.className='text';link.hidden=true;
  link.textContent='Latinio auf dem Lernserver öffnen';$('gate-panel').append(link);
 }
 $('online-entry').href=onlineEntry.href;
 const reconnect=()=>{if(!busy && !document.hidden && $('login').hidden && !$('retry').hidden)void start();};
 globalThis.addEventListener?.('online',reconnect);
 document.addEventListener?.('visibilitychange',reconnect);
$('toggle').onclick=()=>{admin=!admin;$('heading').textContent=admin?'Admin-Anmeldung':'Willkommen bei Latinio';$('intro').textContent=admin?'Gib deinen Admin-PIN ein.':'Gib deinen persönlichen vierstelligen Zugangscode ein. Du bekommst ihn vom Admin.';$('credential-label').textContent=admin?'Admin-PIN':'Zugangscode';$('credential').maxLength=admin?12:4;$('credential').pattern=admin?'[0-9]{4,12}':'[0-9]{4}';$('toggle').textContent=admin?'Zur Schüler-Anmeldung':'Admin-Anmeldung';$('credential').value='';};
$('login').onsubmit=async event=>{event.preventDefault();if(busy)return;const run=++operation;busy=true;$('submit').disabled=true;$('toggle').disabled=true;try{
 $('retry').hidden=true;$('online-entry').hidden=true;
 if(!usableStorage())throw Error('Der Browser stellt keinen Gerätespeicher bereit. Bitte erlaube den Website-Speicher oder verwende ein reguläres Browserfenster.');
 if(!directMode()&&!supportsInstallation())throw unsupported();
 status('Anmeldung läuft …');const value=$('credential').value.trim();
 const {response,body}=await request(accountAPI(),{method:'POST',headers:{'Content-Type':'application/json'},mode:'cors',credentials:'omit',cache:'no-store',body:JSON.stringify({action:'login',...(admin?{admin:true,pin:value}:{code:value})})},20000);guard(run);
 if(!response.ok||body?.error)throw Object.assign(Error(body?.error||'Die Anmeldung ist fehlgeschlagen.'),{login:response.status===401||response.status===400});
 const result=body?.result;if(!result?.token||!result.profile?.id)throw Error('Ungültige Anmeldeantwort.');
 $('credential').value='';pendingLogin=result;showInstall('Angemeldet. Dein Zugang wird auf diesem Gerät gespeichert …');
 await saveSession(result,run);guard(run);pendingLogin=null;await openSignedIn(result.token,run);
 }catch(error){if(run===operation&&!error.cancelled)failure(error);}finally{if(run===operation){busy=false;$('submit').disabled=false;$('toggle').disabled=false;}if(!directMode())void probeOffline();}};
$('retry').onclick=()=>{if(!busy)void start();};
$('offline').onclick=async()=>{const run=++operation;busy=true;status('Die Offline App wird geöffnet …');try{await workerReady({exact:false});const saved=await offlineStatus();guard(run);if(!saved?.available)throw Error('Auf diesem Gerät ist gerade keine vollständig gespeicherte App verfügbar. Bitte verbinde dich mit dem Internet und versuche es erneut.');enterApp(true);}catch(error){if(run===operation)failure(error);}finally{if(run===operation){busy=false;$('submit').disabled=false;$('toggle').disabled=false;}}};
}
async function start(){
 clearTimeout(retryTimer);
 const run=++operation;
 // Signal that the loader executed even when device storage or installation
 // takes longer than the missing-script watchdog.
 globalThis.latinioBootReady?.();
 $('retry').hidden=true;$('online-entry').hidden=true;
 try{
  if(!usableStorage())throw Error('Der Browser stellt keinen Gerätespeicher bereit. Bitte erlaube den Website-Speicher oder verwende ein reguläres Browserfenster.');
  if(pendingLogin){const session=pendingLogin;await saveSession(session,run);guard(run);pendingLogin=null;await openSignedIn(session.token,run);return;}
  if(directMode()){
   const session=await savedSession();guard(run);
   if(session){await openSignedIn(session.token,run);return;}
   showLogin();return;
  }
  if(!supportsInstallation())throw unsupported();
  const localInstall=probeOffline();
  // Start both checks, but an installed app can open without waiting for
  // the public page's independent read of its account database.
  const sessionRead=savedSession().then(value=>({value}),error=>({error}));
  void Promise.all([sessionRead,localInstall]).then(([session,installed])=>{
   if(!installed&&!session.value&&!session.error&&run===operation&&!busy)showLogin();
  });
  // A cached gate, its controller and the published worker can each be one release apart.
  // The controller that will serve the navigation is authoritative about complete packages.
  if(navigator.serviceWorker.controller){
   const saved=await offlineStatus();guard(run);
   if(saved?.available){navigator.serviceWorker.controller.postMessage({type:'PIN_GATE',version:VERSION});enterApp(!saved.current);return;}
  }
  try{await workerReady();}catch(error){
   guard(run);
   if(navigator.serviceWorker.controller && (await offlineStatus())?.available){guard(run);enterApp();return;}
   const result=await sessionRead;guard(run);
   if(!result.error&&!result.value)showLogin();
   throw error;
  }
  const saved=await offlineStatus();guard(run);
  if(saved?.available){enterApp(!saved.current);return;}
  const session=await sessionRead;guard(run);
  if(session.error)throw session.error;
  if(session.value)await openSignedIn(session.value.token,run,{workerChecked:true});else showLogin();
 }catch(error){if(run===operation&&!error.cancelled)failure(error);}
}
if(typeof document==='undefined'){
 globalThis.latinioInstallPackage=Object.assign(token=>installPackage(token,operation,{background:true}),{version:VERSION,api:API});
}else if(document.currentScript?.hasAttribute('data-latinio-update'))stageUpdate();
else {setupGate();void start();}
})();
