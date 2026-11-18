'use strict';
const API='https://elektrogilbersserver.tail7c7157.ts.net:8443/api';
const VERSION='2.25.0';
const ACTIVE='latinio-account-v2';
const $=id=>document.getElementById(id);
let admin=false,busy=false,registration;
function status(message){$('status').textContent=message;}
function showLogin(message=''){$('login').hidden=false;$('toggle').hidden=false;status(message);}
function dbName(profile){return profile.id==='admin'?'latinio-v1':'latinio-profile-'+profile.id;}
async function database(profile){return new Promise((resolve,reject)=>{
 const request=indexedDB.open(dbName(profile),1),timer=setTimeout(()=>reject(Error('Der Gerätespeicher antwortet nicht. Bitte die App erneut öffnen.')),12000);
 request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('state'))request.result.createObjectStore('state');};
 request.onsuccess=()=>{clearTimeout(timer);resolve(request.result);};request.onerror=()=>{clearTimeout(timer);reject(request.error);};request.onblocked=()=>{clearTimeout(timer);reject(Error('Bitte andere Latinio-Fenster schließen.'));};
});}
async function savedSession(){
 let profile;try{profile=JSON.parse(localStorage.getItem(ACTIVE));}catch{}
 if(!profile?.id)return null;
 const db=await database(profile);
 try{return await new Promise((resolve,reject)=>{const request=db.transaction('state').objectStore('state').get('main');request.onsuccess=()=>resolve(request.result?.config?.token?{profile,token:request.result.config.token}:null);request.onerror=()=>reject(request.error);});}finally{db.close();}
}
async function saveSession(result){
 const db=await database(result.profile);
 try{await new Promise((resolve,reject)=>{
  const tx=db.transaction('state','readwrite'),store=tx.objectStore('state'),request=store.get('main');
  request.onsuccess=()=>{const doc=request.result||{schema:1,device:crypto.randomUUID(),seq:0,base:0,shadow:{collections:{},words:{},reviews:{},sessions:{},settings:{}},pending:[],session:null,lastSync:null};doc.config={...doc.config,url:API,token:result.token};doc.profile=result.profile;doc.seeded=true;store.put(doc,'main');};
  tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Speichern fehlgeschlagen.'));
 });}finally{db.close();}
 localStorage.setItem(ACTIVE,JSON.stringify(result.profile));localStorage.setItem('latinio-account-migrated-v2','1');
}
async function workerReady(){
 if(!('serviceWorker'in navigator))throw Error('Bitte öffne Latinio in Safari oder einem aktuellen Browser mit Website-Speicher.');
 registration=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
 if(registration.waiting)registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});
 await navigator.serviceWorker.ready;
 const currentVersion=()=>new Promise(resolve=>{const worker=navigator.serviceWorker.controller;if(!worker)return resolve(null);const channel=new MessageChannel(),timer=setTimeout(()=>{channel.port1.close();resolve(null);},800);channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data?.version);};worker.postMessage({type:'GET_VERSION'},[channel.port2]);});
 const deadline=Date.now()+20000;
 while(await currentVersion()!==VERSION){if(Date.now()>deadline)throw Error('Die App wird noch vorbereitet. Bitte erneut versuchen.');if(registration.waiting)registration.waiting.postMessage({type:'ACTIVATE_UPDATE'});await new Promise(resolve=>setTimeout(resolve,150));}
}
async function installPackage(token){
 status('Deine App wird geladen …');
 const response=await fetch(API.replace(/\/api$/,'/app-package'),{headers:{Authorization:'Bearer '+token},mode:'cors',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(60000)});
 if(response.status===401){const error=Error('Bitte melde dich erneut an.');error.login=true;throw error;}
 if(!response.ok)throw Error('Die App konnte gerade nicht geladen werden. Bitte erneut versuchen.');
 const bundle=await response.json();
 if(bundle.version!==VERSION||!Array.isArray(bundle.files))throw Error('Eine neue Version wird gerade bereitgestellt. Bitte gleich erneut versuchen.');
 const paths=new Set();for(const file of bundle.files){if(typeof file.path!=='string'||!/^(?:app\/[a-zA-Z0-9_./-]+|[a-zA-Z0-9_.-]+)$/.test(file.path)||file.path.split('/').some(p=>p==='..'||p==='.')||paths.has(file.path)||typeof file.body!=='string'||typeof file.type!=='string')throw Error('Die App-Dateien sind ungültig.');paths.add(file.path);}
 if(!paths.has('index.html')||!paths.has('app/main.js'))throw Error('Die App-Dateien sind unvollständig.');
 const name='latinio-private-'+VERSION,cache=await caches.open(name),base=new URL('./',location.href);
 // The marker is written last. An interrupted download never replaces a complete app.
 if(!await cache.match(new URL('.complete',base))){
  for(const file of bundle.files){const bytes=Uint8Array.from(atob(file.body),c=>c.charCodeAt(0));await cache.put(new URL(file.path,base),new Response(bytes,{headers:{'Content-Type':file.type}}));}
  await cache.put(new URL('.complete',base),new Response(VERSION));
 }
 const url=new URL(location.href);url.searchParams.delete('offline');url.searchParams.delete('gate');location.replace(url.href);
}
$('toggle').onclick=()=>{admin=!admin;$('heading').textContent=admin?'Admin-Anmeldung':'Willkommen bei Latinio';$('intro').textContent=admin?'Gib deinen Admin-PIN ein.':'Gib deinen persönlichen vierstelligen Zugangscode ein. Du bekommst ihn vom Admin.';$('credential-label').textContent=admin?'Admin-PIN':'Zugangscode';$('credential').maxLength=admin?12:4;$('credential').pattern=admin?'[0-9]{4,12}':'[0-9]{4}';$('toggle').textContent=admin?'Zur Schüler-Anmeldung':'Admin-Anmeldung';$('credential').value='';};
$('login').onsubmit=async event=>{event.preventDefault();if(busy)return;busy=true;$('submit').disabled=true;$('toggle').disabled=true;try{
 status('Anmeldung läuft …');const value=$('credential').value.trim();
 const response=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},mode:'cors',credentials:'omit',cache:'no-store',body:JSON.stringify({action:'login',...(admin?{admin:true,pin:value}:{code:value})}),signal:AbortSignal.timeout(20000)});
 const body=await response.json();if(!response.ok||body.error)throw Error(body.error||'Die Anmeldung ist fehlgeschlagen.');
 const result=body.result;if(!result?.token||!result.profile?.id)throw Error('Ungültige Anmeldeantwort.');
 $('credential').value='';await saveSession(result);await workerReady();await installPackage(result.token);
 }catch(error){status(error.message||'Keine Verbindung. Bitte erneut versuchen.');}finally{busy=false;$('submit').disabled=false;$('toggle').disabled=false;}};
$('retry').onclick=()=>location.reload();
$('offline').onclick=()=>{const url=new URL(location.href);url.searchParams.set('offline','1');location.replace(url.href);};
async function start(){try{
 await workerReady();
 const session=await savedSession();
 let old=false;const base=new URL('./',location.href);
 for(const name of await caches.keys()){if(!name.startsWith('latinio-shell-')&&!name.startsWith('latinio-private-'))continue;const cache=await caches.open(name);if(name.startsWith('latinio-private-')&&!await cache.match(new URL('.complete',base)))continue;if(await cache.match(new URL('index.html',base))){old=true;break;}}
 $('offline').hidden=!old;
 if(session){try{await installPackage(session.token);return;}catch(error){if(!error.login){$('retry').hidden=false;showLogin('Die Verbindung ist gerade nicht verfügbar. Du kannst es erneut versuchen oder eine gespeicherte App öffnen.');return;}showLogin(error.message);return;}}
 showLogin();
 }catch(error){showLogin(error.message);$('retry').hidden=false;}}
void start();
