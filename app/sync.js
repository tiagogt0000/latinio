import {rebase} from './core.js';
export class GoogleBridge {
  constructor(url,token){this.url=url;this.token=token;this.callbacks=new Map();}
  async connect(){
    if(this.connected)return;
    if(this.connecting)return this.connecting;
    this.connecting=new Promise((resolve,reject)=>{
      const channel=crypto.randomUUID();
      this.listener=event=>{
        const msg=event.data;
        if(!msg||msg.channel!==channel||!/^https:\/\/[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.googleusercontent\.com$/.test(event.origin))return;
        if(msg.type==='latinio-ready'&&!this.target){this.target=event.source;this.origin=event.origin;this.connected=true;clearTimeout(timer);resolve();}
        if(event.source!==this.target||event.origin!==this.origin)return;
        if(msg.type==='latinio-response'){const cb=this.callbacks.get(msg.id);if(cb){this.callbacks.delete(msg.id);clearTimeout(cb.timer);msg.error?cb.reject(Error(msg.error)):cb.resolve(msg.result);}}
      };
      this.channel=channel;window.addEventListener('message',this.listener);
      this.frame=document.createElement('iframe');this.frame.hidden=true;this.frame.title='Google-Synchronisierung';this.frame.referrerPolicy='no-referrer';
      const parsed=new URL(this.url);parsed.searchParams.set('channel',channel);this.frame.src=parsed.href;
      const timer=setTimeout(()=>{this.destroy();reject(Error('Google antwortet nicht. Prüfe die Verbindung und die Einrichtung.'));},25000);
      document.body.append(this.frame);
    });
    return this.connecting;
  }
  async request(action,payload={}){
    await this.connect();
    return new Promise((resolve,reject)=>{const id=crypto.randomUUID();const timer=setTimeout(()=>{this.callbacks.delete(id);reject(Error('Zeitüberschreitung. Deine Änderungen bleiben lokal gespeichert.'));},30000);this.callbacks.set(id,{resolve,reject,timer});this.target.postMessage({type:'latinio-request',channel:this.channel,id,request:{...payload,action,token:this.token}},this.origin);});
  }
  destroy(){window.removeEventListener('message',this.listener);this.frame?.remove();this.connected=false;this.connecting=null;this.target=null;for(const cb of this.callbacks.values()){clearTimeout(cb.timer);cb.reject(Error('Verbindung wurde geändert.'));}this.callbacks.clear();}
}
export class Sync extends EventTarget {
  constructor(store){super();this.store=store;this.status='unconfigured';this.cloudVersion=null;this.remote=null;this.busy=false;this.message='Cloud noch nicht verbunden';this.lastFullSync=0;
    window.addEventListener('online',()=>this.schedule(0));
    window.addEventListener('offline',()=>this.set('offline','Offline · lokal gespeichert'));
  }
  set(status,message){this.status=status;this.message=message;this.dispatchEvent(new Event('change'));}
  get configured(){return !!this.store.doc.config.url&&!!this.store.doc.config.token;}
  schedule(ms=1200){clearTimeout(this.timer);this.timer=setTimeout(()=>this.run(),ms);}
  async request(action,payload){
    const config=this.store.doc.config;
    if(!this.bridge||this.bridge.url!==config.url||this.bridge.token!==config.token){this.bridge?.destroy();this.bridge=new GoogleBridge(config.url,config.token);}
    try{return await this.bridge.request(action,payload);}catch(error){
      // A long-lived Apps Script iframe may still point at the previous deployment.
      // Retry only an unknown-action rejection: the server has not performed it.
      if(!/Unbekannte.*Aktion/i.test(error.message))throw error;
      this.bridge.destroy();this.bridge=new GoogleBridge(config.url,config.token);
      return this.bridge.request(action,payload);
    }
  }
  run(){if(this.inFlight)return this.inFlight;this.inFlight=this.performRun().finally(()=>{this.inFlight=null;});return this.inFlight;}
  async performRun(){
    if(this.busy||this.remote)return;
    if(!this.configured){this.set('unconfigured','Cloud noch nicht verbunden');return;}
    if(!navigator.onLine){this.set('offline','Offline · lokal gespeichert');return;}
    this.busy=true;
    try{
      this.set('checking','Cloud-Version wird geprüft …');
      const full=Date.now()-this.lastFullSync>300000;
      if(full&&this.store.profileId){const identity=await this.request('whoami');if(identity.profile?.id!==this.store.profileId)throw Error('Die Cloud-Anmeldung gehört zu einem anderen Profil. Bitte abmelden und mit der richtigen E-Mail erneut anmelden.');}
      const meta=await this.request('check');this.cloudVersion=meta.version;
      if(meta.version<this.store.doc.base)throw Error('Die Cloud ist älter als der bestätigte Gerätestand. Kein automatisches Überschreiben.');
      if(meta.version>this.store.doc.base||full){await this.fetchRemote(full);return;}
      while(this.store.doc.pending.length){
        const ops=this.store.doc.pending.slice(0,200),base=this.store.doc.base;
        this.set('uploading',`Fortschritt wird hochgeladen · ${this.store.doc.pending.length} Änderungen`);
        const result=await this.request('push',{base,ops});
        if(result.conflict){await this.fetchRemote();return;}
        this.cloudVersion=result.version;
        const ids=new Set(result.accepted);
        await this.store.update(doc=>{doc.shadow=result.data;doc.base=result.version;doc.pending=doc.pending.filter(o=>!ids.has(o.id));doc.lastSync=Date.now();return doc;});
      }
      await this.store.update(doc=>{doc.lastSync=Date.now();return doc;});
      this.set('synced',`Alles hochgeladen · v${this.store.doc.base}`);
    }catch(e){this.set('error',e.message);}
    finally{this.busy=false;}
  }
  async fetchRemote(full=false){
    this.remote=await this.request('pull',{since:full?0:this.store.doc.base});this.remoteFull=full;this.cloudVersion=this.remote.version;
    this.set('newer',`Neuere Cloud-Version · v${this.remote.version}`);this.dispatchEvent(new Event('remote'));
  }
  compare(choices={}){return rebase(this.remote.data,this.remote.ops,this.store.doc.pending,choices);}
  async accept(choices={}){
    const merged=this.compare(choices);if(merged.conflicts.length)throw Error('Bitte wähle für jede doppelt bearbeitete Angabe den gewünschten Stand.');
    this.set('loading','Cloud-Version wird geladen …');
    const remote=this.remote;
    await this.store.update(doc=>{
      const latest=rebase(remote.data,remote.ops,doc.pending,choices);
      if(latest.conflicts.length)throw Error('Es gibt inzwischen weitere lokale Änderungen. Bitte erneut vergleichen.');
      doc.shadow=latest.shadow;doc.pending=latest.pending;doc.base=remote.version;doc.lastSync=Date.now();doc.seeded=true;return doc;
    });
    if(this.remoteFull)this.lastFullSync=Date.now();this.remoteFull=false;this.remote=null;this.set('synced',`Cloud-Version v${remote.version} geladen`);this.schedule(0);
  }
}
