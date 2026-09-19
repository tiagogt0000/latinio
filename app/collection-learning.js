export const activityKey=id=>'collection-active_'+id;
export const collectionActive=(data,id)=>!!data.collections[id]&&data.settings[activityKey(id)]?.active!==false;
export function forgottenWords(data){
  const latest=new Map();
  for(const r of Object.values(data.reviews)){
    if(r.repeat)continue;
    const old=latest.get(r.wordId);
    if(!old||r.at>old.at||(r.at===old.at&&r.id>old.id))latest.set(r.wordId,r);
  }
  return Object.values(data.words).filter(w=>{
    const r=latest.get(w.id);
    return data.collections[w.collectionId]&&!collectionActive(data,w.collectionId)&&r?.mode?.startsWith('inactive-')&&r.grade!=='full';
  }).sort((a,b)=>latest.get(a.id).at-latest.get(b.id).at||a.id.localeCompare(b.id));
}
export function inactiveQueue(data,ids,mode,limit){
  const words=mode==='inactive-practice'?forgottenWords(data):Object.values(data.words).filter(w=>data.collections[w.collectionId]&&ids.includes(w.collectionId));
  return (mode==='inactive-practice'?words.slice(0,limit):words).map(w=>w.id);
}
