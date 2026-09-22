export const activityLabels={opened:'App geöffnet / zurückgekehrt',started:'Lernrunde gestartet',paused:'Lernrunde pausiert',finished:'Lernrunde beendet',words:'Vokabeleinträge bearbeitet',collections:'Sammlungen bearbeitet',refresh:'Auffrisch-Sammlung bearbeitet',settings:'Lerneinstellungen geändert'};
export function activityKinds(changes,previous){
 const kinds=new Set();
 for(const [entity,key,value] of changes){
  if(entity==='sessions')kinds.add('finished');
  if(entity==='words')kinds.add('words');
  if(entity==='collections')kinds.add('collections');
  if(entity==='settings'&&(value?.kind==='refreshDeck'||previous.settings[key]?.kind==='refreshDeck'))kinds.add('refresh');
  if(entity==='settings'&&key==='general')kinds.add('settings');
 }
 return [...kinds];
}
export function activityRows(events,h){return events.map(e=>`<li><time>${h(new Date(e.at).toLocaleString('de-DE',{timeZone:'Europe/Berlin',dateStyle:'medium',timeStyle:'short'}))}</time><br>${h(activityLabels[e.action]||'Aktivität')}</li>`).join('');}
