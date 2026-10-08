import {sortedCollections,refreshDecks,deckMembers} from './refresh-decks.js';
import {predicateDecks,predicateCloudItems} from './predicates.js';

export const resourceKey=(kind,id)=>JSON.stringify([kind,id]);
export function shareResources(data,subject='latin'){
 return [
  ...sortedCollections(data).map(c=>({...c,resourceKind:'lesson',label:'Vokabeln',count:Object.values(data.words).filter(w=>w.collectionId===c.id).length})),
  ...refreshDecks(data).map(c=>({...c,resourceKind:'refresh',label:'Auffrischen',count:deckMembers(data,c).length})),
  ...(subject==='latin'?predicateDecks(data).map(c=>({...c,resourceKind:'predicates',label:'Prädikate',count:predicateCloudItems(data).filter(item=>item.deckId===c.id).length})):[])
 ].map(c=>({...c,key:resourceKey(c.resourceKind,c.id)})).sort((a,b)=>a.name.localeCompare(b.name,'de',{numeric:true})||a.resourceKind.localeCompare(b.resourceKind));
}
export function resourceRecipients(resource,{shares=[],resourceShares=[],predicateShares=[]},people){
 const ids=new Set((resource.resourceKind==='lesson'?shares:resourceShares).filter(s=>!s.revoked&&s.sourceId===resource.id&&(resource.resourceKind==='lesson'||s.resourceKind===resource.resourceKind)).map(s=>s.profileId));
 if(resource.resourceKind==='predicates')for(const s of predicateShares)if(!s.revoked&&s.sourceIds?.includes(resource.id))ids.add(s.profileId);
 return people.filter(p=>ids.has(p.id));
}
export function accessOverview(resources,state,people,h){
 return `<div class="access-table" role="table" aria-label="Sammlungen und Freigaben"><div class="access-heading" role="row"><span>Auswahl / Sammlung</span><span>Geteilt mit</span><span>Aktion</span></div>${resources.map(c=>{const recipients=resourceRecipients(c,state,people);return `<div class="access-row" role="row"><label class="access-collection" role="cell"><input type="checkbox" data-access-select="${h(c.key)}" aria-label="${h(c.name)} auswählen"><span><strong>${h(c.name)}</strong><small>${c.label} · ${c.count} Einträge</small></span></label><div class="access-recipients ${recipients.length?'is-shared':''}" role="cell">${recipients.length?`<strong>${recipients.length===people.length?'Alle Nutzer':recipients.length+' Nutzer'}</strong><span>${recipients.map(p=>h(p.name)).join(', ')}</span>`:'<span>Nicht geteilt</span>'}</div><div role="cell"><button class="text-button" data-action="access-edit" data-id="${h(c.key)}">${recipients.length?'Bearbeiten':'Teilen'}</button></div></div>`;}).join('')||'<p class="muted">Keine passenden Sammlungen.</p>'}</div>`;
}
