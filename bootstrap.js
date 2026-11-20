'use strict';
const API='https://elektrogilbersserver.tail7c7157.ts.net:8443/api';
const VERSION='2.26.0';
const ACTIVE='latinio-account-v2';
const STORAGE_WAIT=5000,WORKER_WAIT=10000;
const $=id=>document.getElementById(id);
let admin=false,busy=false,registration,operation=0;
const cancelled=()=>Object.assign(Error('Der vorherige Vorgang wurde beendet.'),{cancelled:true});
function guard(run){if(run!==operation)throw cancelled();}
function status(message){$('status').textContent=message;}
function showPanel(message=''){$('gate-panel').hidden=false;status(message);
 if($('login').hidden){$('heading').textContent='Latinio';$('intro').hidden=true;}
}
function showLogin(message=''){$('login').hidden=false;$('toggle').hidden=false;$('heading').textContent=admin?'Admin-Anmeldung':'Willkommen bei Latinio';$('intro').hidden=false;showPanel(message);}
function failure(error){
 if(error?.nextVersion){const url=new URL(location.href);if(url.searchParams.get('_gateVersion')!==error.nextVersion){url.searchParams.set('gate','1');url.searchParams.set('_gateVersion',error.nextVersion);url.searchParams.delete('offline');status('Die aktuelle App wird geöffnet …');location.replace(url.href);return;}}
 const message=error?.message||'Die Verbindung ist gerade nicht verfügbar. Bitte erneut versuchen.';
 if(error?.login)showLogin(message);else showPanel(message);
 $('retry').hidden=false;
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
 return bounded((async()=>{const response=await fetch(url,{...options,signal:controller.signal});let body;try{body=await response.json();}catch{if(response.ok)throw Error('Die Antwort konnte nicht gelesen werden. Bitte erneut versuchen.');body={};}return {response,body};})(),ms,'Die Verbindung antwortet gerade nicht. Bitte erneut versuchen.',()=>controller.abort());
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
 try{await storedDocument(db,current=>{guard(run);const doc=current||{schema:1,device:crypto.randomUUID(),seq:0,base:0,shadow:{collections:{},words:{},reviews:{},sessions:{},settings:{}},pending:[],session:null,lastSync:null};doc.config={...doc.config,url:API,token:result.token};doc.profile=result.profile;doc.seeded=true;return doc;});}finally{db.close();}
 guard(run);localStorage.setItem(ACTIVE,JSON.stringify(result.profile));localStorage.setItem('latinio-account-migrated-v2','1');
}
function workerMessage(type){return new Promise(resolve=>{
 const worker=navigator.serviceWorker?.controller;if(!worker)return resolve(null);
 let channel,timer,settled=false;const finish=value=>{if(settled)return;settled=true;clearTimeout(timer);channel?.port1.close();channel?.port2.close();resolve(value);};
 try{channel=new MessageChannel();timer=setTimeout(()=>finish(null),type==='GET_VERSION'?600:1800);channel.port1.onmessage=event=>finish(event.data);worker.postMessage({type},[channel.port2]);}catch{finish(null);}
});}
const workerVersion=async()=>(await workerMessage('GET_VERSION'))?.version;
async function workerReady({exact=true}={}){
 if(!('serviceWorker'in navigator))throw Error('Bitte öffne Latinio in Safari oder einem aktuellen Browser mit Website-Speicher.');
 const deadline=Date.now()+WORKER_WAIT;
 if(navigator.serviceWorker.controller&&(!exact||checkWorkerVersion(await workerVersion()))){
  // Keep version discovery running even when a cached gate already has a
  // working controller. Its update must never delay opening the saved app.
  Promise.resolve().then(()=>navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'})).then(value=>{if(value.waiting)value.waiting.postMessage({type:'ACTIVATE_UPDATE'});}).catch(()=>{});
  navigator.serviceWorker.controller.postMessage({type:'PIN_GATE',version:VERSION});return;
 }
 registration=await bounded(navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}),Math.max(1,deadline-Date.now()),'Die App konnte nicht vorbereitet werden. Bitte erneut versuchen oder die Offline App öffnen.');
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
async function completeCache(cache,base,required=[]){
 const marker=await cache.match(new URL('.complete',base));if(!marker)return false;
 const text=await marker.text();let manifest;try{manifest=JSON.parse(text);}catch{}
 const files=[...new Set([...(manifest&&Array.isArray(manifest.files)?manifest.files:['index.html','app/main.js']),...required])];
 if(!files.includes('index.html')||!files.includes('app/main.js'))return false;
 const index=await cache.match(new URL('index.html',base));if(!index||!privateEntry(await index.text()))return false;
 return (await Promise.all(files.map(path=>typeof path==='string'?cache.match(new URL(path,base)):false))).every(Boolean);
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
async function installPackage(token,run,{background=false}={}){
 guard(run);
 const {response,body:bundle}=await request(API.replace(/\/api$/,'/app-package'),{headers:{Authorization:'Bearer '+token},mode:'cors',credentials:'omit',cache:'no-store'},60000);guard(run);
 if(response.status===401){const error=Error('Bitte melde dich erneut an.');error.login=true;throw error;}
 if(!response.ok)throw Error('Die App konnte gerade nicht geladen werden. Bitte erneut versuchen.');
 if(bundle.version!==VERSION||!Array.isArray(bundle.files))throw Error('Eine neue Version wird gerade bereitgestellt. Bitte gleich erneut versuchen.');
 const paths=new Set();for(const file of bundle.files){if(typeof file.path!=='string'||!/^(?:app\/[a-zA-Z0-9_./-]+|[a-zA-Z0-9_.-]+)$/.test(file.path)||file.path.split('/').some(p=>p==='..'||p==='.')||paths.has(file.path)||typeof file.body!=='string'||typeof file.type!=='string')throw Error('Die App-Dateien sind ungültig.');paths.add(file.path);}
 if(!paths.has('index.html')||!paths.has('app/main.js'))throw Error('Die App-Dateien sind unvollständig.');
 if(!privateEntry(atob(bundle.files.find(file=>file.path==='index.html').body)))throw Error('Die App-Dateien sind unvollständig.');
 const name='latinio-private-'+VERSION,base=new URL('./',location.href),cache=await bounded(caches.open(name),STORAGE_WAIT,'Die App konnte auf diesem Gerät nicht gespeichert werden.');guard(run);
 if(!await bounded(completeCache(cache,base,[...paths]),STORAGE_WAIT,'Die gespeicherte App antwortet nicht. Bitte erneut versuchen.')){
  await bounded(cache.delete(new URL('.complete',base)),STORAGE_WAIT,'Die App konnte auf diesem Gerät nicht gespeichert werden.');
  for(const file of bundle.files){guard(run);const bytes=Uint8Array.from(atob(file.body),c=>c.charCodeAt(0));await bounded(cache.put(new URL(file.path,base),new Response(bytes,{headers:{'Content-Type':file.type}})),STORAGE_WAIT,'Die App konnte auf diesem Gerät nicht vollständig gespeichert werden.');}
 }
 guard(run);await bounded(cache.put(new URL('.complete',base),new Response(JSON.stringify({version:VERSION,files:[...paths]}),{headers:{'Content-Type':'application/json'}})),STORAGE_WAIT,'Die App konnte auf diesem Gerät nicht vollständig gespeichert werden.');
 guard(run);if(!background)enterApp();
}
// The worker adds this script only to older installed entries. It never takes
// over their UI, changes their account, or navigates an active lesson.
function stageUpdate(){
 let running=false,complete=false,lastAttempt=0;
 async function attempt(){
  if(running||complete||document.hidden||navigator.onLine===false||Date.now()-lastAttempt<15000)return;
  running=true;lastAttempt=Date.now();
  try{
   const session=await savedSession();
   if(session){await installPackage(session.token,operation,{background:true});complete=true;}
  }catch{/* The previous package remains active. Retry when the app next opens or reconnects. */}
  finally{running=false;}
 }
 void attempt();window.addEventListener('online',attempt);document.addEventListener('visibilitychange',attempt);
}
function setupGate(){
$('toggle').onclick=()=>{admin=!admin;$('heading').textContent=admin?'Admin-Anmeldung':'Willkommen bei Latinio';$('intro').textContent=admin?'Gib deinen Admin-PIN ein.':'Gib deinen persönlichen vierstelligen Zugangscode ein. Du bekommst ihn vom Admin.';$('credential-label').textContent=admin?'Admin-PIN':'Zugangscode';$('credential').maxLength=admin?12:4;$('credential').pattern=admin?'[0-9]{4,12}':'[0-9]{4}';$('toggle').textContent=admin?'Zur Schüler-Anmeldung':'Admin-Anmeldung';$('credential').value='';};
$('login').onsubmit=async event=>{event.preventDefault();if(busy)return;const run=++operation;busy=true;$('submit').disabled=true;$('toggle').disabled=true;try{
 status('Anmeldung läuft …');const value=$('credential').value.trim();
 const {response,body}=await request(API,{method:'POST',headers:{'Content-Type':'application/json'},mode:'cors',credentials:'omit',cache:'no-store',body:JSON.stringify({action:'login',...(admin?{admin:true,pin:value}:{code:value})})},20000);guard(run);
 if(!response.ok||body.error)throw Error(body.error||'Die Anmeldung ist fehlgeschlagen.');
 const result=body.result;if(!result?.token||!result.profile?.id)throw Error('Ungültige Anmeldeantwort.');
 $('credential').value='';await saveSession(result,run);guard(run);$('login').hidden=true;$('toggle').hidden=true;$('gate-panel').hidden=true;await workerReady();const saved=await offlineStatus();guard(run);if(saved?.current)enterApp();else await installPackage(result.token,run);
 }catch(error){if(run===operation&&!error.cancelled)failure(error);}finally{if(run===operation){busy=false;$('submit').disabled=false;$('toggle').disabled=false;}void probeOffline();}};
$('retry').onclick=()=>location.reload();
$('offline').onclick=async()=>{const run=++operation;busy=true;status('Die Offline App wird geöffnet …');try{await workerReady({exact:false});const saved=await offlineStatus();guard(run);if(!saved?.available)throw Error('Auf diesem Gerät ist gerade keine vollständig gespeicherte App verfügbar. Bitte verbinde dich mit dem Internet und versuche es erneut.');enterApp(true);}catch(error){if(run===operation)failure(error);}finally{if(run===operation){busy=false;$('submit').disabled=false;$('toggle').disabled=false;}}};
}
async function start(){
 const run=++operation;
 // Signal that the loader executed even when device storage or installation
 // takes longer than the missing-script watchdog.
 globalThis.latinioBootReady?.();
 void probeOffline();
 try{
  // Start both checks, but an installed app can open without waiting for
  // the public page's independent read of its account database.
  const sessionRead=savedSession().then(value=>({value}),error=>({error}));
  try{await workerReady();}catch(error){
   const result=await sessionRead;guard(run);
   if(!result.error&&!result.value)showLogin();
   throw error;
  }
  const saved=await offlineStatus();guard(run);
  if(saved?.available){enterApp(!saved.current);return;}
  const session=await sessionRead;guard(run);
  if(session.error)throw session.error;
  if(session.value)await installPackage(session.value.token,run);else showLogin();
 }catch(error){if(run===operation&&!error.cancelled)failure(error);}
}
if(document.currentScript?.hasAttribute('data-latinio-update'))stageUpdate();
else {setupGate();void start();}
