import {uid,clone,emptyData,applyOps} from './core.js';
export class Store extends EventTarget {
  async open(){
    const dbName='wordlo-v1';
    this.db=await new Promise((resolve,reject)=>{const r=indexedDB.open(dbName,1);r.onupgradeneeded=()=>r.result.createObjectStore('state');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    await this.update(current=>current||{schema:1,device:uid(),seq:0,base:0,shadow:emptyData(),pending:[],session:null,config:{url:'',token:''},lastSync:null,seeded:false});
    this.channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('wordlo-updates'):null;
    if(this.channel)this.channel.onmessage=async()=>{await this.read();this.dispatchEvent(new Event('external'));};
    return this;
  }
  async read(){return this.doc=await new Promise((resolve,reject)=>{const r=this.db.transaction('state').objectStore('state').get('main');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  async update(fn){
    const value=await new Promise((resolve,reject)=>{const tx=this.db.transaction('state','readwrite');const os=tx.objectStore('state');const req=os.get('main');let value;
      req.onsuccess=()=>{try{value=fn(req.result);os.put(value,'main');}catch(e){reject(e);tx.abort();}};
      tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error||Error('Lokales Speichern fehlgeschlagen.'));tx.onabort=()=>reject(tx.error||Error('Lokales Speichern abgebrochen.'));
    });
    this.doc=value;this.channel?.postMessage('updated');this.dispatchEvent(new Event('change'));return value;
  }
  get data(){return applyOps(this.doc.shadow,this.doc.pending);}
  close(){this.channel?.close();this.db?.close();}
  async commit(changes,session=undefined){const previous=this.data;const result=await this.update(doc=>{
    for(const [entity,key,value]of changes){doc.seq++;doc.pending.push({id:uid(),entity,key,value:clone(value),device:doc.device,seq:doc.seq,at:Date.now()});}
    if(session!==undefined)doc.session=clone(session);return doc;
  });this.dispatchEvent(new CustomEvent('commit',{detail:{changes,previous}}));return result;}
}

