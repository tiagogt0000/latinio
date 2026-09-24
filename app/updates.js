export const APP_VERSION='1.8.8';
export function waitForInstallation(worker,timeout=45000){
  return new Promise((resolve,reject)=>{
    const finish=error=>{clearTimeout(timer);worker.removeEventListener('statechange',check);error?reject(error):resolve();};
    const check=()=>{if(worker.state==='installed'||worker.state==='activated')finish();else if(worker.state==='redundant')finish(Error('Das Update konnte nicht geladen werden. Bitte erneut versuchen.'));};
    const timer=setTimeout(()=>finish(Error('Das Herunterladen dauert zu lange. Bitte erneut versuchen.')),timeout);
    worker.addEventListener('statechange',check);check();
  });
}
export async function publishedVersion(){
  const url=new URL('../version.json',import.meta.url);url.searchParams.set('check',Date.now());
  const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Die veröffentlichte Version konnte nicht geprüft werden. Bitte erneut versuchen.');
  const result=await response.json();
  if(!/^\d+\.\d+\.\d+$/.test(result.version))throw Error('Ungültige Versionsantwort. Bitte erneut versuchen.');
  return result.version;
}
export function workerVersion(worker,timeout=3000){
  if(!worker)return Promise.resolve(null);
  return new Promise(resolve=>{
    const channel=new MessageChannel();
    const finish=value=>{clearTimeout(timer);channel.port1.close();channel.port2.close();resolve(value);};
    const timer=setTimeout(()=>finish(null),timeout);
    channel.port1.onmessage=event=>finish(event.data?.version||null);
    try{worker.postMessage({type:'GET_VERSION'},[channel.port2]);}catch{finish(null);}
  });
}
export class AppUpdates extends EventTarget {
  constructor(serviceWorker,loadVersion=publishedVersion){super();this.serviceWorker=serviceWorker;this.loadVersion=loadVersion;this.state='idle';this.message='Suche nach einer neuen App-Version.';this.reloadReady=false;
    serviceWorker?.addEventListener?.('controllerchange',()=>{
      // A second tab may have activated the new shell. This page still has old modules.
      if(this.state!=='installing')void workerVersion(serviceWorker.controller).then(version=>{if(version&&version!==APP_VERSION){this.reloadReady=true;this.set('available','Eine neue App-Version ist bereit.');}});
    });
  }
  set(state,message){this.state=state;this.message=message;this.dispatchEvent(new Event('change'));}
  watch(registration){
    this.registration=registration;
    if(this.watched===registration)return;
    this.watched=registration;
    registration.addEventListener?.('updatefound',()=>{
      const worker=registration.installing;if(!worker)return;
      void waitForInstallation(worker).then(()=>{if(registration.waiting&&this.state!=='checking'&&this.state!=='installing')this.set('available','Eine neue App-Version ist bereit.');}).catch(error=>{if(this.state!=='checking'&&this.state!=='installing')this.set('error',error.message);});
    });
  }
  async check(){
    if(this.state==='checking'||this.state==='installing')return;
    this.set('checking','Nach Updates wird gesucht …');
    try{
      if(!this.serviceWorker)throw Error('App-Updates sind in diesem Browser nicht verfügbar.');
      const registration=await this.serviceWorker.getRegistration();
      if(!registration)throw Error('Die Offline-App wird noch eingerichtet. Bitte gleich erneut versuchen.');
      this.watch(registration);
      // An already downloaded update also works offline.
      if(registration.waiting||this.reloadReady){this.set('available','Eine neue App-Version ist bereit.');return;}
      if(!navigator.onLine)throw Error('Für die Update-Suche brauchst du eine Internetverbindung.');
      await Promise.race([registration.update(),new Promise((_,reject)=>{this.checkTimer=setTimeout(()=>reject(Error('Die Update-Suche dauert zu lange. Bitte erneut versuchen.')),30000);})]);
      clearTimeout(this.checkTimer);
      if(registration.installing)await waitForInstallation(registration.installing);
      if(registration.waiting){this.set('available','Eine neue App-Version ist bereit.');return;}
      const latest=await this.loadVersion();
      if(latest!==APP_VERSION){
        const active=await workerVersion(registration.active);
        if(active===latest){this.reloadReady=true;this.set('available','Eine neue App-Version ist bereit.');return;}
        throw Error('Eine neue Version wird bereitgestellt. Die App versucht es automatisch erneut.');
      }
      this.set('current',`Du bist auf dem neuesten Stand · ${APP_VERSION}`);
    }catch(error){this.set('error',error.message);}finally{clearTimeout(this.checkTimer);}
  }
  async apply(){
    if(this.state==='installing')return;
    const worker=this.registration?.waiting;
    if(!worker&&!this.reloadReady){await this.check();return;}
    this.set('installing','Update wird aktiviert …');
    if(!worker&&this.reloadReady){location.reload();return;}
    try{
      await new Promise((resolve,reject)=>{
        const changed=()=>{clearTimeout(timer);this.serviceWorker.removeEventListener('controllerchange',changed);resolve();};
        const timer=setTimeout(()=>{this.serviceWorker.removeEventListener('controllerchange',changed);reject(Error('Bitte die App einmal schließen und erneut öffnen.'));},15000);
        this.serviceWorker.addEventListener('controllerchange',changed);
        worker.postMessage({type:'ACTIVATE_UPDATE'});
      });
      location.reload();
    }catch(error){this.set('error',error.message);}
  }
}
