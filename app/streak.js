// Calendar-day records are immutable and merge by union, never by a counter.
// Existing settings synchronization carries them without a new backend endpoint.
export function dayKey(now=Date.now()){
 const d=new Date(now);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function validDay(day){return typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day))&&new Date(day).toISOString().slice(0,10)===day;}
export function previousDay(day){return new Date(Date.parse(day+'T12:00:00Z')-86400000).toISOString().slice(0,10);}
export function streakDays(data){return Object.values(data?.settings||{}).filter(row=>row?.kind==='streakDay'&&validDay(row.day)).map(row=>row.day);}
export function streakState(days,now=Date.now()){
 const today=dayKey(now),set=new Set(days.filter(validDay)),active=set.has(today);
 let cursor=active?today:previousDay(today),count=0;
 while(set.has(cursor)){count++;cursor=previousDay(cursor);}
 return {today,active,count};
}
export function streakVariant(day){return ['orbit','wave','impact'][(Math.max(1,day)-1)%3];}
export function streakDayChanges(data,days){
 return [...new Set(days.filter(validDay))].sort().filter(day=>{const row=data.settings?.['streak_day_'+day];return row?.kind!=='streakDay'||row.day!==day;}).map(day=>['settings','streak_day_'+day,{kind:'streakDay',day}]);
}
export function createStreakLedger({profileId,storage,locks}){
 const key='latinio-streak-days:'+profileId;let memory=[],serial=Promise.resolve();
 function read(){try{const stored=JSON.parse(storage.getItem(key)||'[]');return Array.isArray(stored)?stored.filter(validDay):[];}catch{return [];}}
 function merge(days=[]){memory=[...new Set([...memory,...read(),...days.filter(validDay)])].sort();try{storage.setItem(key,JSON.stringify(memory));}catch{}return [...memory];}
 return {
  key,merge,
  state(data,now=Date.now()){return streakState(merge(streakDays(data)),now);},
  claim(store,now=Date.now()){
   const perform=async()=>{
    await store.read();
    const days=merge(streakDays(store.data)),before=streakState(days,now);
    const next=[...days,before.today];
    const changes=streakDayChanges(store.data,next);
    // Persist before consuming the celebration, so a failed write can be retried.
    if(changes.length)await store.commit(changes);
    const state=streakState(merge(next),now);
    return {...state,celebrate:!before.active,variant:streakVariant(state.count)};
   };
   const run=()=>locks?.request?locks.request(key,perform):perform();
   const task=serial.then(run);serial=task.catch(()=>{});return task;
  }
 };
}
