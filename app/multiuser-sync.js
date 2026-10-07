export function unreadShareNotices(data){return Object.values(data.settings).filter(n=>n?.kind==='shareNotice'&&!data.settings['read_'+n.id]).sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id));}
export function noticeCollections(notices){return [...new Map(notices.flatMap(n=>n.resources||n.collections||[]).map(c=>[c.id,c])).values()].sort((a,b)=>a.name.localeCompare(b.name,'de',{numeric:true}));}
export async function acknowledgeShareNotices(store,sync,notices){
 if(notices.length)await store.commit(notices.map(n=>['settings','read_'+n.id,{kind:'shareNoticeRead',noticeId:n.id,at:Date.now()}]));
 await settleSync(sync,store);
}
// Incoming shared edits are independent of regular progress synchronization.
export function incoming(data){return Object.values(data.settings).filter(x=>x?.kind==='incomingShare').sort((a,b)=>(a.order??a.at)-(b.order??b.at)||a.id.localeCompare(b.id));}
export function incomingChanges(data){
  const changes=[],conflicts=[],copy=structuredClone(data);
  for(const item of incoming(data)){
    const current=copy[item.entity]?.[item.key]??null;
    const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    const parentMissing=item.entity==='words'&&item.value&&!copy.collections[item.collectionId];
    const collectionDelete=item.entity==='collections'&&item.value===null&&Object.values(copy.words).some(w=>w.collectionId===item.key);
    if(!parentMissing&&!collectionDelete&&(same(current,item.previous)||same(current,item.value))){
      changes.push([item.entity,item.key,item.value],['settings',item.id,null]);
      if(item.value===null)delete copy[item.entity][item.key];else copy[item.entity][item.key]=item.value;
      delete copy.settings[item.id];
    }else conflicts.push(item);
  }
  return {changes,conflicts};
}
const settling=new WeakMap();
export function settleSync(sync,store){
 if(settling.has(sync))return settling.get(sync);
 const task=settle(sync,store).finally(()=>settling.delete(sync));settling.set(sync,task);return task;
}
async function settle(sync,store){
  for(let attempt=0;attempt<10;attempt++){
    if(!navigator.onLine)throw Error('Du bist offline. Dein Lernstand ist auf diesem Gerät gespeichert.');
    await sync.run();
    if(sync.status==='error'||sync.status==='offline'||sync.status==='restricted')throw Error(sync.message);
    if(sync.remote){
      // Regular multi-device conflicts preserve pending local edits; shared vocabulary edits use the inbox.
      const choices=Object.fromEntries(sync.compare().conflicts.map(c=>[c.key,'local']));
      await sync.accept(choices);continue;
    }
    const result=incomingChanges(store.data);
    if(result.changes.length){await store.commit(result.changes);continue;}
    if(!store.doc.pending.length&&sync.status==='synced')return;
  }
  throw Error('Der Abgleich ist noch nicht abgeschlossen. Bitte erneut versuchen.');
}
// Only the first reconciliation is awaited by learning actions. Navigation and
// editing remain available, and a failed/offline check releases cached lessons.
export function cloudGate({sync,store,onReady,onError,afterSync}){
 let running=null,finished=false;
 function execute(){
  if(running)return running;
  if(finished)return Promise.resolve();
  running=Promise.resolve().then(async()=>{
   if(navigator.onLine&&sync.configured!==false)await settleSync(sync,store);
   await afterSync?.();
  }).catch(error=>{onError?.(error);}).finally(()=>{running=null;finished=true;onReady?.();});
  return running;
 }
 return {run:execute,wait:()=>running||Promise.resolve(),get blocked(){return !!running;}};
}

export async function waitForInitialSync(gate,button){
 if(!gate?.blocked)return;
 const original=button.innerHTML,disabled=button.disabled,label=button.getAttribute('aria-label');
 button.disabled=true;button.setAttribute('aria-busy','true');button.setAttribute('aria-label','Runde wird geladen');
 button.innerHTML='<span class="button-loading" role="status" aria-label="Runde wird geladen"><i></i><i></i><i></i></span>';
 try{await gate.wait();}finally{button.innerHTML=original;button.disabled=disabled;button.removeAttribute('aria-busy');if(label===null)button.removeAttribute('aria-label');else button.setAttribute('aria-label',label);}
}
