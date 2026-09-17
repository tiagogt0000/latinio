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
export async function settleSync(sync,store){
  for(let attempt=0;attempt<10;attempt++){
    if(!navigator.onLine)throw Error('Du bist offline. Dein Lernstand ist auf diesem Gerät gespeichert.');
    await sync.run();
    if(sync.status==='error'||sync.status==='offline')throw Error(sync.message);
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
export function cloudGate({sync,store,onReady}){
  const dialog=document.createElement('dialog');dialog.className='cloud-wait';document.body.append(dialog);
  dialog.addEventListener('cancel',e=>e.preventDefault());let running=null;
  async function execute(label){
    if(running)return running;
    running=(async()=>{
      if(!navigator.onLine)return;
      dialog.innerHTML='<h2></h2><p role="status">Einen Moment bitte …</p><div class="indeterminate"></div>';dialog.querySelector('h2').textContent=label;dialog.showModal();
      while(true){
        try{await settleSync(sync,store);break;}
        catch(error){
          dialog.innerHTML='<h2>Verbindung nicht abgeschlossen</h2><p role="status"></p><div class="word-tools"><button class="button primary" data-choice="retry">Erneut versuchen</button><button class="button secondary" data-choice="offline">Offline fortfahren</button></div>';
          dialog.querySelector('p').textContent=error.message;
          const choice=await new Promise(resolve=>{dialog.onclick=e=>{const b=e.target.closest('[data-choice]');if(b)resolve(b.dataset.choice);};});dialog.onclick=null;
          if(choice==='offline')break;
          dialog.innerHTML='<h2>Cloud wird abgeglichen …</h2><div class="indeterminate"></div>';
        }
      }
    })().finally(()=>{dialog.close();running=null;onReady?.();});
    return running;
  }
  return {run:execute,get blocked(){return !!running;}};
}
