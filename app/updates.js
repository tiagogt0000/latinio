export const APP_VERSION='1.0.1';
export function waitForInstallation(worker,timeout=45000){
  return new Promise((resolve,reject)=>{
    const finish=error=>{clearTimeout(timer);worker.removeEventListener('statechange',check);error?reject(error):resolve();};
    const check=()=>{if(worker.state==='installed'||worker.state==='activated')finish();else if(worker.state==='redundant')finish(Error('Das Update konnte nicht geladen werden. Bitte erneut versuchen.'));};
    const timer=setTimeout(()=>finish(Error('Das Herunterladen dauert zu lange. Bitte erneut versuchen.')),timeout);
    worker.addEventListener('statechange',check);check();
  });
}
export class AppUpdates extends EventTarget {
  constructor(serviceWorker){super();this.serviceWorker=serviceWorker;this.state='idle';this.message='Suche nach einer neuen App-Version.';}
  set(state,message){this.state=state;this.message=message;this.dispatchEvent(new Event('change'));}
  async check(){
    if(this.state==='checking'||this.state==='installing')return;
    this.set('checking','Nach Updates wird gesucht …');
    try{
      if(!this.serviceWorker)throw Error('App-Updates sind in diesem Browser nicht verfügbar.');
      if(!navigator.onLine)throw Error('Für die Update-Suche brauchst du eine Internetverbindung.');
      const registration=await this.serviceWorker.getRegistration();
      if(!registration)throw Error('Die Offline-App wird noch eingerichtet. Bitte gleich erneut versuchen.');
      this.registration=registration;
      // An installed update is usable even if the latest network check fails.
      if(!registration.waiting){
        await Promise.race([registration.update(),new Promise((_,reject)=>{this.checkTimer=setTimeout(()=>reject(Error('Die Update-Suche dauert zu lange. Bitte erneut versuchen.')),30000);})]);
        clearTimeout(this.checkTimer);
        if(registration.installing)await waitForInstallation(registration.installing);
      }
      if(registration.waiting)this.set('available','Eine neue App-Version ist bereit.');
      else this.set('current',`Du bist auf dem neuesten Stand · ${APP_VERSION}`);
    }catch(error){this.set('error',error.message);}finally{clearTimeout(this.checkTimer);}
  }
  async apply(){
    const worker=this.registration?.waiting;
    if(!worker){await this.check();return;}
    this.set('installing','Update wird aktiviert …');
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
