import {rebase,emptyData,entities,uid} from './core.js';
export class GoogleBridge {
  constructor(url,token){this.url=url;this.token=token;this.callbacks=new Map();}
  connect(){
    if(this.connected)return Promise.resolve();if(this.connecting)return this.connecting;
    this.connecting=new Promise((resolve,reject)=>{
      const channel=crypto.randomUUID();this.channel=channel;
      this.listener=event=>{const m=event.data;
        if(!m||m.channel!==channel||!/^https:\/\/[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.googleusercontent\.com$/.test(event.origin))return;
        if(m.type==='wordlo-ready'&&!this.target){this.target=event.source;this.origin=event.origin;this.connected=true;clearTimeout(this.timer);resolve();}
        if(event.source!==this.target||event.origin!==this.origin)return;
        if(m.type==='wordlo-response'){const cb=this.callbacks.get(m.id);if(cb){this.callbacks.delete(m.id);clearTimeout(cb.timer);m.error?cb.reject(Error(m.error)):cb.resolve(m.result);}}
      };
      window.addEventListener('message',this.listener);this.frame=document.createElement('iframe');this.frame.hidden=true;this.frame.title='Wordlo Google-Verbindung';this.frame.referrerPolicy='no-referrer';
      const url=new URL(this.url);url.searchParams.set('channel',channel);this.frame.src=url.href;
      this.timer=setTimeout(()=>{this.destroy();reject(Error('Google antwortet nicht. Prüfe die Wordlo-Bereitstellung. Lokal ist alles gespeichert.'));},20000);
      document.body.append(this.frame);
    });return this.connecting;
  }
  async request(action,payload={}){
    await this.connect();return new Promise((resolve,reject)=>{const id=uid(),timer=setTimeout(()=>{this.callbacks.delete(id);reject(Error('Google braucht zu lange. Änderungen bleiben lokal gespeichert.'));},30000);this.callbacks.set(id,{resolve,reject,timer});this.target.postMessage({type:'wordlo-request',channel:this.channel,id,request:{...payload,action,token:this.token,app:'wordlo'}},this.origin);});
  }
  destroy(){clearTimeout(this.timer);window.removeEventListener('message',this.listener);this.frame?.remove();this.connected=false;this.connecting=null;this.target=null;for(const cb of this.callbacks.values()){clearTimeout(cb.timer);cb.reject(Error('Verbindung beendet.'));}this.callbacks.clear();}
}
export class Sync extends EventTarget {
  constructor(store){super();this.store=store;this.status='local';this.message='Auf diesem Gerät';this.conflicts=[];window.addEventListener('online',()=>this.schedule(0));}
  get configured(){return !!this.store.doc.config.url&&!!this.store.doc.config.token;}
  set(status,message){this.status=status;this.message=message;this.dispatchEvent(new Event('change'));}
  schedule(ms=1000){clearTimeout(this.timer);this.timer=setTimeout(()=>this.run(),ms);}
  async configure(url,token){
    if(!/^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(url))throw Error('Bitte die Google-Web-App-Adresse mit /exec am Ende verwenden.');
    if(!/^[a-zA-Z0-9_-]{32,200}$/.test(token))throw Error('Bitte den vollständigen privaten Verbindungsschlüssel eingeben.');
    const bridge=new GoogleBridge(url,token);let meta;try{meta=await bridge.request('check');if(meta.app!=='wordlo')throw Error('Diese Verbindung gehört nicht zu Wordlo.');}catch(e){bridge.destroy();throw e;}
    if(this.inFlight)await this.inFlight;
    this.bridge?.destroy();this.bridge=bridge;
    await this.store.update(doc=>{const previous=this.store.data;doc.config={url,token};doc.base=0;doc.shadow=emptyData();doc.pending=[];
      for(const entity of entities)for(const [key,value] of Object.entries(previous[entity])){doc.seq++;doc.pending.push({id:uid(),entity,key,value,device:doc.device,seq:doc.seq,at:Date.now()});}return doc;});
    this.conflicts=[];this.remote=null;await this.run();
  }
  async request(action,payload={}){const c=this.store.doc.config;if(!this.bridge||this.bridge.url!==c.url||this.bridge.token!==c.token){this.bridge?.destroy();this.bridge=new GoogleBridge(c.url,c.token);}return this.bridge.request(action,payload);}
  run(){if(this.inFlight)return this.inFlight;this.inFlight=this.perform().finally(()=>{this.inFlight=null;});return this.inFlight;}
  async perform(){
    if(!this.configured){this.set('local','Auf diesem Gerät');return;}if(!navigator.onLine){this.set('offline','Offline · lokal gespeichert');return;}if(this.conflicts.length){this.set('conflict','Änderungen vergleichen');return;}
    try{
      this.set('syncing','Wird abgeglichen …');
      for(let attempt=0;attempt<8;attempt++){
        const base=this.store.doc.base,remote=await this.request('pull',{since:base});
        if(remote.app!=='wordlo'||!Number.isSafeInteger(remote.version)||remote.version<base||!Array.isArray(remote.ops)||entities.some(k=>!remote.data?.[k]))throw Error('Unerwarteter Cloud-Stand. Lokale Daten bleiben erhalten.');
        let conflicts=[];
        await this.store.update(doc=>{
          if(doc.base>remote.version)return doc;
          const merged=rebase(remote.data,remote.ops,doc.pending);conflicts=merged.conflicts;
          if(conflicts.length)return doc;
          doc.shadow=merged.shadow;doc.pending=merged.pending;doc.base=remote.version;return doc;
        });
        if(conflicts.length){this.conflicts=conflicts;this.remote=remote;this.set('conflict','Änderungen vergleichen');return;}
        if(!this.store.doc.pending.length){await this.store.update(doc=>{doc.lastSync=Date.now();return doc;});this.set('synced','Mit Google synchronisiert');return;}
        const batch=this.store.doc.pending.slice(0,100),result=await this.request('push',{base:this.store.doc.base,ops:batch});
        if(result.conflict)continue;
        if(!Number.isSafeInteger(result.version)||!Array.isArray(result.accepted)||entities.some(k=>!result.data?.[k]))throw Error('Google hat das Speichern nicht bestätigt.');
        const accepted=new Set(result.accepted);
        await this.store.update(doc=>{if(doc.base<=result.version){doc.base=result.version;doc.shadow=result.data;}doc.pending=doc.pending.filter(o=>!accepted.has(o.id));doc.lastSync=Date.now();return doc;});
      }
      this.set('syncing','Weitere Änderungen werden übertragen …');this.schedule(1000);
    }catch(e){this.set('error',e.message);}
  }
  async resolve(choices){
    if(this.conflicts.some(c=>!['local','cloud'].includes(choices[c.key])))throw Error('Bitte für jeden Konflikt eine Version auswählen.');
    const remote=this.remote;
    await this.store.update(doc=>{const merge=rebase(remote.data,remote.ops,doc.pending,choices);if(merge.conflicts.length)throw Error('Neue Änderungen vorhanden. Bitte erneut vergleichen.');doc.shadow=merge.shadow;doc.pending=merge.pending;doc.base=remote.version;return doc;});
    this.remote=null;this.conflicts=[];this.schedule(0);
  }
}
