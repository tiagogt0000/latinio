/** Canonical content sharing. Reviews, sessions, activity and streaks are never copied. */
function autoSharingEnabled_(){return typeof AUTOMATIC_SHARING_ENABLED!=='undefined'&&AUTOMATIC_SHARING_ENABLED===true;}
function autoJson_(value){if(Array.isArray(value))return '['+value.map(autoJson_).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(function(k){return JSON.stringify(k)+':'+autoJson_(value[k]);}).join(',')+'}';return JSON.stringify(value);}
function autoKey_(profileId,subject,kind,sourceId){return 'as_'+hash_(profileId+':'+subject+':'+kind+':'+sourceId).slice(0,40);}
function autoEntryKey_(resourceId,key){return resourceId+'_'+hash_(key).slice(0,24);}
function autoSources_(data){
  const result=Object.values(data.collections).filter(function(c){return !c.refreshSource;}).map(function(c){return {kind:'lesson',sourceId:c.id,name:c.name};});
  const decks=Object.create(null);
  Object.values(data.settings).filter(function(v){return v.kind==='predicateDeck';}).forEach(function(v){decks[v.id]={kind:'predicates',sourceId:v.id,name:v.name};});
  Object.values(data.settings).filter(function(v){return v.kind==='predicateItem';}).forEach(function(v){const id=predicateDeckId_(v);if(!decks[id])decks[id]={kind:'predicates',sourceId:id,name:v.name||'Prädikate'};});
  return result.concat(Object.values(decks));
}
function autoContext_(){return {states:Object.create(null),records:records_('_LatinioAutoShares'),manual:records_('_LatinioShares')};}
function autoState_(context,id,subject){const key=id+':'+subject;return context.states[key]||(context.states[key]=readState_(id,true,subject));}
function autoPlan_(context,profile,subject,resource){
  const source=autoState_(context,'admin',subject).data,target=autoState_(context,profile.id,subject).data;
  const id=autoKey_(profile.id,subject,resource.kind,resource.sourceId),saved=context.records[id];
  let manual=Object.values(context.manual).find(function(s){return s.profileId===profile.id&&shareSubject_(s)===subject&&(resource.kind==='lesson'?s.kind==='share':s.kind==='resourceShare'&&s.resourceKind==='predicates')&&s.sourceId===resource.sourceId;});
  if(!manual&&resource.kind==='predicates'){const legacy=Object.values(context.manual).find(function(s){return s.kind==='predicateShare'&&s.profileId===profile.id&&Object.values(context.manual).some(function(e){return e.kind==='predicateEntry'&&e.shareId===s.id&&e.source&&predicateDeckId_(e.source)===resource.sourceId;});});if(legacy)manual=Object.assign({},legacy,{legacy:true,targetId:resource.sourceId});}
  const sourceItems=resource.kind==='lesson'?Object.values(source.words).filter(function(w){return w.collectionId===resource.sourceId;}):Object.values(source.settings).filter(function(v){return v.kind==='predicateItem'&&predicateDeckId_(v)===resource.sourceId;});
  const deck=resource.kind==='lesson'?source.collections[resource.sourceId]:source.settings[resource.sourceId]|| (sourceItems.length?{id:resource.sourceId,kind:'predicateDeck',name:resource.name}:null);
  if(!deck)sourceItems.length=0;
  const targetDecks=resource.kind==='lesson'?target.collections:Object.fromEntries(Object.entries(target.settings).filter(function(e){return e[1].kind==='predicateDeck';}));
  const names=Object.values(targetDecks).filter(function(c){return c.name===resource.name;});
  const targetId=saved?.targetId||manual?.targetId||(targetDecks[resource.sourceId]?resource.sourceId:names.length===1?names[0].id:'auto_'+hash_(id).slice(0,40));
  const parentEntity=resource.kind==='lesson'?'collections':'settings';
  const parent=deck?(resource.kind==='lesson'?{id:targetId,name:deck.name}:{id:targetId,kind:'predicateDeck',name:deck.name,active:target.settings[targetId]?.active!==false}):null;
  const record={id:id,kind:'autoResource',profileId:profile.id,subject:subject,resourceKind:resource.kind,sourceId:resource.sourceId,targetId:targetId,name:deck?.name||saved?.name||resource.name,active:!!deck};
  const entries=[],desired=[],used=new Set();
  const existingEntries=Object.values(context.records).filter(function(e){return e.kind==='autoEntry'&&e.resourceId===id;});
  if(manual)Object.values(context.manual).filter(function(e){return e.shareId===manual.id&&(resource.kind==='lesson'?e.kind==='entry':manual.legacy?e.kind==='predicateEntry'&&e.source&&predicateDeckId_(e.source)===resource.sourceId:e.kind==='resourceEntry'&&e.sourceId!=='deck');}).forEach(function(e){
    if(!existingEntries.some(function(v){return v.sourceKey===e.sourceId;}))existingEntries.push({kind:'autoEntry',resourceId:id,sourceKey:e.sourceId,entity:resource.kind==='lesson'?'words':'settings',targetKey:resource.kind==='lesson'?targetId_(manual.id,e.sourceId):manual.legacy?'shared_'+hash_(manual.id+':'+e.sourceId).slice(0,32):e.targetKey,sourceValue:e.source||e.value});
  });
  function add(key,entity,targetKey,value,label,sourceValue){
    desired.push({key:key,entity:entity,targetKey:targetKey,value:value,label:label});used.add(targetKey);
    if(key!=='deck')entries.push([autoEntryKey_(id,key),{kind:'autoEntry',resourceId:id,sourceKey:key,entity:entity,targetKey:targetKey,sourceValue:sourceValue||null}]);
  }
  add('deck',parentEntity,targetId,parent,record.name,deck);
  sourceItems.forEach(function(item){
    const previous=existingEntries.find(function(e){return e.sourceKey===item.id;});
    let targetKey=previous?.targetKey;
    if(!targetKey&&manual){
      if(resource.kind==='lesson')targetKey=targetId_(manual.id,item.id);
      else targetKey=Object.values(context.manual).find(function(e){return e.kind==='resourceEntry'&&e.shareId===manual.id&&e.sourceId===item.id;})?.targetKey;
    }
    const entity=resource.kind==='lesson'?'words':'settings';
    const candidates=Object.values(target[entity]).filter(function(v){return resource.kind==='lesson'?v.collectionId===targetId&&v.latin===item.latin:v.kind==='predicateItem'&&predicateDeckId_(v)===targetId&&v.grundform===item.grundform;});
    if(!targetKey)targetKey=target[entity][item.id]&&(resource.kind==='lesson'?target.words[item.id].collectionId===targetId:predicateDeckId_(target.settings[item.id])===targetId)?item.id:candidates.length===1&&!used.has(candidates[0].id)?candidates[0].id:'auto_'+hash_(id+':'+item.id).slice(0,40);
    const value=resource.kind==='lesson'?Object.assign({},item,{id:targetKey,collectionId:targetId}):Object.assign({},item,{id:targetKey,deckId:targetId,name:record.name,sharedFrom:'admin'});
    add(item.id,entity,targetKey,value,item.latin||item.grundform,item);
  });
  existingEntries.filter(function(e){return !sourceItems.some(function(v){return v.id===e.sourceKey;});}).forEach(function(e){add(e.sourceKey,e.entity,e.targetKey,null,e.sourceValue?.latin||e.sourceValue?.grundform||'Gelöschter Eintrag',null);});
  const contents=resource.kind==='lesson'?Object.values(target.words).filter(function(w){return w.collectionId===targetId;}):Object.values(target.settings).filter(function(v){return v.kind==='predicateItem'&&predicateDeckId_(v)===targetId;});
  contents.filter(function(v){return !used.has(v.id);}).forEach(function(v){add('extra_'+v.id,resource.kind==='lesson'?'words':'settings',v.id,null,v.latin||v.grundform,null);});
  const diffs=desired.flatMap(function(row){
    const before=target[row.entity][row.targetKey]||null;
    if(autoJson_(before)===autoJson_(row.value))return [];
    const diffId='df_'+hash_(id+':'+row.key+':'+autoJson_(before)+':'+autoJson_(row.value)).slice(0,40);
    return [{id:diffId,profileId:profile.id,profileName:profile.name,subject:subject,resourceId:id,resourceKind:resource.kind,sourceId:resource.sourceId,resourceName:record.name,key:row.key,entity:row.entity,targetKey:row.targetKey,label:row.label,before:before,after:row.value,parentMissing:!!parent&&!target[parentEntity][targetId],parentTarget:targetId}];
  });
  return {record:record,entries:entries,diffs:diffs,manual:manual};
}
function autoResourcesFor_(context,profile,subject){
  const sources=autoSources_(autoState_(context,'admin',subject).data).filter(function(r){return subject==='latin'||r.kind==='lesson';});
  Object.values(context.records).filter(function(r){return r.kind==='autoResource'&&r.profileId===profile.id&&r.subject===subject;}).forEach(function(r){if(!sources.some(function(s){return s.kind===r.resourceKind&&s.sourceId===r.sourceId;}))sources.push({kind:r.resourceKind,sourceId:r.sourceId,name:r.name});});
  return sources;
}
function autoCheck_(request){
  if(!Array.isArray(request.profileIds)||!request.profileIds.length||request.profileIds.length>100)throw new Error('Wähle 1 bis 100 Nutzer aus.');
  const profiles=records_('_LatinioProfiles'),context=autoContext_(),plans=[],people=[];
  Array.from(new Set(request.profileIds)).forEach(function(id){
    const profile=profiles[id];if(!profile||!profile.active)throw new Error('Ein ausgewähltes Profil ist nicht mehr aktiv.');
    people.push({id:profile.id,name:profile.name});
    normalizeSubjects_(profile.allowedSubjects).forEach(function(subject){autoResourcesFor_(context,profile,subject).forEach(function(resource){plans.push(autoPlan_(context,profile,subject,resource));});});
  });
  const diffs=plans.flatMap(function(p){return p.diffs;});if(diffs.length>20000)throw new Error('Bitte weniger Nutzer gleichzeitig prüfen.');
  return {people:people,plans:plans,differences:diffs,checkedAt:Date.now()};
}
function autoApplyPlans_(plans,selected,requestId){
  const groups=Object.create(null);let changes=0;
  plans.forEach(function(plan){
    const diffs=plan.diffs.filter(selected);if(!diffs.length)return;
    // Missing container must be selected too, otherwise child rows would be orphaned.
    diffs.forEach(function(d){if(d.after&&d.key!=='deck'&&d.parentMissing&&!diffs.some(function(p){return p.key==='deck'&&p.after;}))throw new Error('Wähle auch die fehlende Sammlung aus.');});
    const key=plan.record.profileId+':'+plan.record.subject;
    if(!groups[key])groups[key]={profileId:plan.record.profileId,subject:plan.record.subject,ops:[]};
    diffs.forEach(function(d){groups[key].ops.push({id:'auto_'+hash_(requestId+':'+d.id).slice(0,40),entity:d.entity,key:d.targetKey,value:d.after});changes++;});
    const state=readState_(plan.record.profileId,true,plan.record.subject).data;Object.entries(state.settings).filter(function(e){return e[1].kind==='incomingShare'&&diffs.some(function(d){return d.entity===e[1].entity&&d.targetKey===e[1].key;});}).forEach(function(e){groups[key].ops.push({id:'auto_'+hash_(requestId+':notice:'+e[0]).slice(0,40),entity:'settings',key:e[0],value:null});});
    saveRecord_('_LatinioAutoShares',plan.record.id,plan.record);saveRecords_('_LatinioAutoShares',plan.entries);
    if(plan.manual&&plan.manual.kind==='share')saveRecord_('_LatinioShares',plan.manual.id,Object.assign({},plan.manual,{automatic:true}));
  });
  Object.values(groups).forEach(function(g){serverWrite_(g.profileId,g.ops,g.subject);});
  return {changes:changes,users:new Set(Object.values(groups).map(function(g){return g.profileId;})).size};
}
function autoSharingApi_(request,identity){
  if(identity.role!=='admin')throw new Error('Nur für das Admin-Profil.');
  const result=autoCheck_(request);
  if(request.action==='autoShareCheck')return {people:result.people,differences:result.differences,checkedAt:result.checkedAt};
  if(!Array.isArray(request.differenceIds)||request.differenceIds.length>200||typeof request.requestId!=='string'||!/^[a-zA-Z0-9_-]{8,100}$/.test(request.requestId))throw new Error('Bitte höchstens 200 Unterschiede je Schritt auswählen.');
  const ids=new Set(request.differenceIds),available=new Set(result.differences.map(function(d){return d.id;}));
  if(Array.from(ids).some(function(id){return !available.has(id);}))throw new Error('Der Cloud-Stand hat sich seit der Prüfung geändert. Bitte erneut prüfen.');
  return autoApplyPlans_(result.plans,function(d){return ids.has(d.id);},request.requestId);
}
function autoShareChanges_(ops,subject){
  if(!autoSharingEnabled_())return null;
  const context=autoContext_(),source=autoState_(context,'admin',subject).data,affected=new Map();
  const resource=function(kind,id,name){affected.set(kind+':'+id,{kind:kind,sourceId:id,name:name||'Sammlung'});};
  ops.forEach(function(op){
    if(op.entity==='collections'&&!op.value?.refreshSource)resource('lesson',op.key,op.value?.name);
    if(op.entity==='words'){
      if(op.value&&source.collections[op.value.collectionId]&&!source.collections[op.value.collectionId].refreshSource)resource('lesson',op.value.collectionId,source.collections[op.value.collectionId].name);
      Object.values(context.records).filter(function(e){return e.kind==='autoEntry'&&e.sourceKey===op.key;}).forEach(function(e){const r=context.records[e.resourceId];if(r&&r.subject===subject&&r.resourceKind==='lesson')resource('lesson',r.sourceId,r.name);});
      Object.values(context.manual).filter(function(e){return e.kind==='entry'&&e.sourceId===op.key;}).forEach(function(e){const s=context.manual[e.shareId];if(s&&shareSubject_(s)===subject)resource('lesson',s.sourceId,s.collection?.name);});
    }
    if(op.entity==='settings'&&(op.value?.kind==='predicateDeck'||op.value?.kind==='predicateItem'))resource('predicates',op.value.kind==='predicateDeck'?op.key:predicateDeckId_(op.value),op.value.name);
    if(op.entity==='settings'&&!op.value)Object.values(context.manual).forEach(function(e){const r=context.manual[e.shareId];if(r&&e.sourceId===op.key){if(r.kind==='resourceShare'&&r.resourceKind==='predicates'&&shareSubject_(r)===subject)resource('predicates',r.sourceId,r.name);if(e.kind==='predicateEntry'&&e.source)resource('predicates',predicateDeckId_(e.source),e.source.name);}});
    if(op.entity==='settings'&&!op.value)Object.values(context.records).forEach(function(e){const r=e.kind==='autoResource'?e:context.records[e.resourceId];if(r&&r.subject===subject&&r.resourceKind==='predicates'&&(r.sourceId===op.key||e.sourceKey===op.key))resource('predicates',r.sourceId,r.name);});
  });
  const profiles=Object.values(records_('_LatinioProfiles')).filter(function(p){return p.active&&normalizeSubjects_(p.allowedSubjects).includes(subject);}),plans=[];
  profiles.forEach(function(profile){affected.forEach(function(r){const plan=autoPlan_(context,profile,subject,r);plans.push(plan);});});
  const keys=new Set(ops.map(function(o){return o.key;}));
  const result=autoApplyPlans_(plans,function(d){
    const parentChanged=ops.some(function(o){return o.key===d.sourceId&&(o.entity==='collections'||o.value?.kind==='predicateDeck'||o.entity==='settings'&&!o.value);});
    return d.parentMissing||keys.has(d.key)||parentChanged&&!d.key.startsWith('extra_');
  },ops[ops.length-1]?.id||Utilities.getUuid());
  // Save stable mappings even when the content already matched.
  plans.forEach(function(p){saveRecord_('_LatinioAutoShares',p.record.id,p.record);saveRecords_('_LatinioAutoShares',p.entries);});
  return result;
}
function autoShareNewProfile_(profile){
  if(!autoSharingEnabled_())return null;
  const context=autoContext_(),plans=[];
  normalizeSubjects_(profile.allowedSubjects).forEach(function(subject){autoSources_(autoState_(context,'admin',subject).data).filter(function(r){return subject==='latin'||r.kind==='lesson';}).forEach(function(r){plans.push(autoPlan_(context,profile,subject,r));});});
  return autoApplyPlans_(plans,function(d){return !d.key.startsWith('extra_');},Utilities.getUuid());
}
function autoShareDirectory_(result,subject){
  if(!autoSharingEnabled_())return result;
  const context=autoContext_(),profiles=Object.values(records_('_LatinioProfiles')).filter(function(p){return p.active&&normalizeSubjects_(p.allowedSubjects).includes(subject);});
  autoSources_(autoState_(context,'admin',subject).data).filter(function(r){return subject==='latin'||r.kind==='lesson';}).forEach(function(resource){
    profiles.forEach(function(profile){
      const plan=autoPlan_(context,profile,subject,resource),data=autoState_(context,profile.id,subject).data;
      const dto={id:plan.record.id,profileId:profile.id,profileName:profile.name,sourceId:resource.sourceId,targetId:plan.record.targetId,subject:subject,automatic:true,revoked:false,ready:true,name:resource.name};
      if(resource.kind==='lesson'){
        dto.kind='share';dto.collection={name:resource.name};dto.delivery={present:!!data.collections[dto.targetId],wordCount:Object.values(data.words).filter(function(w){return w.collectionId===dto.targetId;}).length,missingWords:plan.diffs.filter(function(d){return d.entity==='words'&&d.after&&!d.before;}).length};
        result.shares=result.shares.filter(function(s){return s.profileId!==profile.id||s.sourceId!==resource.sourceId;}).concat([dto]);
      }else{
        dto.kind='resourceShare';dto.resourceKind='predicates';
        result.resourceShares=result.resourceShares.filter(function(s){return s.profileId!==profile.id||s.sourceId!==resource.sourceId||s.resourceKind!=='predicates';}).concat([dto]);
      }
    });
  });
  result.automaticSharing=true;return result;
}
