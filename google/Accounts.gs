/** Profile login is intentionally email-only. Admin PIN is stored only in ScriptProperties. */
function setupMultiuser(){
  const props=PropertiesService.getScriptProperties(),ui=SpreadsheetApp.getUi();
  if(!props.getProperty('SHEET_ID')||!props.getProperty('TOKEN_HASH'))throw new Error('Die bestehende Latinio-Einrichtung fehlt.');
  const result=ui.prompt('Admin-PIN einrichten','Gib deinen vereinbarten Admin-PIN ein. Der bisherige Cloud-Schlüssel und deine Lerndaten bleiben erhalten.',ui.ButtonSet.OK_CANCEL);
  if(result.getSelectedButton()!==ui.Button.OK)return;
  const pin=result.getResponseText().trim();if(!/^\d{4,12}$/.test(pin))throw new Error('Bitte 4 bis 12 Ziffern eingeben.');
  const salt=Utilities.getUuid();props.setProperties({ADMIN_PIN_SALT:salt,ADMIN_PIN_HASH:hash_(salt+':'+pin),PIN_FAILURES:'0',PIN_BLOCKED_UNTIL:'0'});
  ['_LatinioProfiles','_LatinioSessions','_LatinioShares'].forEach(metaSheet_);
  ui.alert('Mehrbenutzer-Zugang eingerichtet. Die bestehende Web-App jetzt als neue Version bereitstellen.');
}
var requestSheets_=Object.create(null);
function metaSheet_(name,readOnly){
  if(requestSheets_[name])return requestSheets_[name];
  const book=SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
  let sheet=book.getSheetByName(name);
  if(!sheet&&readOnly)return null;
  if(!sheet){sheet=book.insertSheet(name);sheet.getRange(1,1,1,2).setValues([['Schlüssel','Daten (JSON)']]);}
  requestSheets_[name]=sheet;return sheet;
}
function records_(name){
  const sheet=metaSheet_(name,true),data=Object.create(null);if(!sheet)return data;const last=sheet.getLastRow();
  if(last>1)sheet.getRange(2,1,last-1,2).getValues().forEach(function(row){data[row[0]]=JSON.parse(row[1]);});
  return data;
}
function saveRecord_(name,key,value){saveRecords_(name,[[key,value]]);}
function saveRecords_(name,entries){
  if(!entries.length)return;
  const sheet=metaSheet_(name),last=sheet.getLastRow();
  const keys=last>1?sheet.getRange(2,1,last-1,1).getValues():[];
  const positions=new Map(keys.map(function(row,i){return [row[0],i+2];}));
  let next=last+1;const updates=new Map();
  entries.forEach(function(entry){
    const json=JSON.stringify(entry[1]);if(json.length>45000)throw new Error('Datensatz zu groß.');
    if(!positions.has(entry[0]))positions.set(entry[0],next++);
    updates.set(positions.get(entry[0]),[entry[0],json]);
  });
  const sorted=Array.from(updates).sort(function(a,b){return a[0]-b[0];});
  for(let i=0;i<sorted.length;){const start=sorted[i][0],values=[sorted[i++][1]];while(i<sorted.length&&sorted[i][0]===start+values.length)values.push(sorted[i++][1]);sheet.getRange(start,1,values.length,2).setValues(values);}
}
function login_(request){
  const props=PropertiesService.getScriptProperties();let profile;
  if(request.admin===true){
    const blocked=Number(props.getProperty('PIN_BLOCKED_UNTIL')||0);
    if(blocked>Date.now())throw new Error('Zu viele PIN-Versuche. Bitte in fünf Minuten erneut versuchen.');
    const expected=props.getProperty('ADMIN_PIN_HASH'),salt=props.getProperty('ADMIN_PIN_SALT');
    if(!expected)throw new Error('Der Admin-PIN wurde im Google-Skript noch nicht eingerichtet.');
    if(typeof request.pin!=='string'||request.pin.length>12||hash_(salt+':'+request.pin)!==expected){
      const attempts=Number(props.getProperty('PIN_FAILURES')||0)+1;
      props.setProperties({PIN_FAILURES:String(attempts>=5?0:attempts),PIN_BLOCKED_UNTIL:String(attempts>=5?Date.now()+300000:0)});
      throw new Error('Der PIN stimmt nicht.');
    }
    props.setProperties({PIN_FAILURES:'0',PIN_BLOCKED_UNTIL:'0'});profile={id:'admin',name:'Admin',role:'admin'};
  }else{
    const email=String(request.email||'').trim().toLowerCase();
    profile=Object.values(records_('_LatinioProfiles')).find(function(p){return p.active&&p.email===email;});
    if(!profile)throw new Error('Diese E-Mail ist noch nicht freigeschaltet. Bitte frage den Admin.');
    profile={id:profile.id,name:profile.name,email:profile.email,role:'student'};
  }
  const token=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');
  saveRecord_('_LatinioSessions',hash_(token),{profileId:profile.id,expires:Date.now()+180*86400000});
  return {token:token,profile:profile,apiVersion:2};
}
function readState_(id,readOnly){
  const sheet=ensureLog_(id,readOnly);if(!sheet)return {sheet:null,log:[],data:replay_([]),version:0};const last=sheet.getLastRow();
  const log=last>1?sheet.getRange(2,1,last-1,5).getValues().map(function(r){return {version:Number(r[0]),op:JSON.parse(r[4])};}):[];
  return {sheet:sheet,log:log,data:replay_(log),version:log.length?log[log.length-1].version:0};
}
function serverWrite_(profileId,changes){
  const state=readState_(profileId),known=new Set(state.log.map(function(r){return r.op.id;})),rows=[];
  changes.forEach(function(c){
    if(known.has(c.id))return;
    const op={id:c.id,entity:c.entity,key:c.key,value:c.value,device:'sharing',seq:++state.version,at:Date.now()};
    if(op.value&&op.value.kind==='incomingShare')op.value.order=state.version;
    validateOp_(op);const json=JSON.stringify(op);if(json.length>45000)throw new Error('Ein Eintrag ist zu groß.');
    rows.push([state.version,op.id,new Date().toISOString(),'sharing',json]);known.add(op.id);
  });
  if(rows.length)state.sheet.getRange(state.sheet.getLastRow()+1,1,rows.length,5).setValues(rows);
  SpreadsheetApp.flush();
}
function shareId_(profileId,collectionId){return 'sh_'+hash_(profileId+':'+collectionId).slice(0,32);}
function targetId_(shareId,wordId){return 'w_'+hash_(shareId+':'+wordId).slice(0,32);}
function mapWord_(word,share){return word?{id:targetId_(share.id,word.id),collectionId:share.targetId,latin:word.latin,meanings:word.meanings,...(word.forms?{forms:word.forms}:{})}:null;}
function shareChanges_(share){
  const data=readState_('admin').data,records=records_('_LatinioShares'),changes=[];
  const collection=data.collections[share.sourceId]||null;
  if(JSON.stringify(collection)!==JSON.stringify(share.collection))changes.push({key:'collection',label:collection?collection.name:'Sammlung löschen',entity:'collections',previous:share.collection,source:collection});
  const ids=new Set(Object.values(data.words).filter(function(w){return w.collectionId===share.sourceId;}).map(function(w){return w.id;}));
  Object.values(records).filter(function(e){return e&&e.kind==='entry'&&e.shareId===share.id;}).forEach(function(e){ids.add(e.sourceId);});
  ids.forEach(function(id){
    const record=records[share.id+'_'+id],previous=record?record.source:null;
    const word=data.words[id],current=word&&word.collectionId===share.sourceId?word:null;
    if(JSON.stringify(current)!==JSON.stringify(previous))changes.push({key:id,label:current?current.latin:'Löschen: '+(previous?previous.latin:id),entity:'words',previous:previous,source:current});
  });
  return changes;
}
function shareNotice_(profileId,shares,deliveryId){
  const id='notice_'+hash_(deliveryId).slice(0,40);
  serverWrite_(profileId,[{id:id,entity:'settings',key:id,value:{kind:'shareNotice',id:id,at:Date.now(),collections:shares.map(function(s){return {id:s.targetId,name:s.collection?s.collection.name:'Sammlung'};})}}]);
}
function shareDelivery_(share,state,records){
  const collection=state.data.collections[share.targetId],entries=Object.values(records).filter(function(e){return e.kind==='entry'&&e.shareId===share.id&&e.source;});
  return {present:!!collection,wordCount:Object.values(state.data.words).filter(function(w){return w.collectionId===share.targetId;}).length,missingWords:entries.filter(function(e){return !state.data.words[targetId_(share.id,e.sourceId)];}).length,version:state.version};
}
function repairShare_(share){
  const state=readState_(share.profileId,true),records=records_('_LatinioShares'),changes=[];
  if(!share.collection)throw new Error('Die geteilte Sammlung wurde gelöscht. Bitte eine vorhandene Sammlung teilen.');
  const prefix='repair_'+share.id+'_'+state.version+'_';
  if(!state.data.collections[share.targetId])changes.push({id:prefix+'collection',entity:'collections',key:share.targetId,value:{id:share.targetId,name:share.collection.name}});
  Object.values(records).filter(function(e){return e.kind==='entry'&&e.shareId===share.id&&e.source;}).forEach(function(e){const word=mapWord_(e.source,share);if(!state.data.words[word.id])changes.push({id:prefix+word.id,entity:'words',key:word.id,value:word});});
  if(changes.length){
    const noticeId='notice_'+hash_(prefix).slice(0,40);
    changes.push({id:noticeId,entity:'settings',key:noticeId,value:{kind:'shareNotice',id:noticeId,at:Date.now(),collections:[{id:share.targetId,name:share.collection.name}]}});
    serverWrite_(share.profileId,changes);
  }
  return {repaired:Math.max(0,changes.length-1),delivery:shareDelivery_(share,readState_(share.profileId,true),records)};
}
function accountApi_(request,identity){
  if(request.action==='logout'){saveRecord_('_LatinioSessions',hash_(request.token),{profileId:identity.id,expires:0});return {ok:true};}
  if(identity.role!=='admin')throw new Error('Nur für das Admin-Profil.');
  if(request.action==='profiles')return {profiles:Object.values(records_('_LatinioProfiles')).filter(function(p){return p.active;})};
  if(request.action==='profileDelete'){
    const profile=records_('_LatinioProfiles')[request.profileId];if(!profile)throw new Error('Profil nicht gefunden.');
    profile.active=false;profile.deletedAt=Date.now();saveRecord_('_LatinioProfiles',profile.id,profile);
    const shares=Object.values(records_('_LatinioShares')).filter(function(s){return s.kind==='share'&&s.profileId===profile.id;});
    saveRecords_('_LatinioShares',shares.map(function(s){s.revoked=true;return [s.id,s];}));
    return {ok:true};
  }
  if(request.action==='profileCollections'){
    const profile=records_('_LatinioProfiles')[request.profileId];if(!profile||!profile.active)throw new Error('Profil nicht gefunden.');
    const state=readState_(profile.id,true),records=records_('_LatinioShares'),source=readState_('admin',true).data;
    const shares=Object.values(records).filter(function(s){return s.kind==='share'&&s.ready&&!s.revoked&&s.profileId===profile.id;});
    const comparisons=[];
    shares.forEach(function(share){Object.values(records).filter(function(e){return e.kind==='entry'&&e.shareId===share.id&&e.source;}).forEach(function(entry){
      const previous=mapWord_(entry.source,share),current=state.data.words[previous.id]||null;
      comparisons.push({key:previous.id,collectionId:share.targetId,previous:previous,current:current,admin:source.words[entry.sourceId]||null,changed:JSON.stringify(previous)!==JSON.stringify(current)});
    });});
    return {profile:{id:profile.id,name:profile.name},version:state.version,checkedAt:Date.now(),collections:state.data.collections,words:state.data.words,comparisons:comparisons};
  }
  if(request.action==='profileCreate'){
    const name=String(request.name||'').trim(),email=String(request.email||'').trim().toLowerCase();
    if(!name||name.length>80||email.length>254||!/^\S+@\S+\.\S+$/.test(email))throw new Error('Name und gültige E-Mail eingeben.');
    const profiles=records_('_LatinioProfiles');if(Object.values(profiles).some(function(p){return p.active&&p.email===email;}))throw new Error('Diese E-Mail ist bereits angelegt.');
    const profile={id:'p_'+Utilities.getUuid().replace(/-/g,''),name:name,email:email,active:true};
    saveRecord_('_LatinioProfiles',profile.id,profile);return {profile:profile};
  }
  if(request.action==='shareCreateMany'){
    if(!Array.isArray(request.collectionIds)||!request.collectionIds.length||request.collectionIds.length>50)throw new Error('Bitte 1 bis 50 Sammlungen auswählen.');
    const ids=Array.from(new Set(request.collectionIds)),profile=records_('_LatinioProfiles')[request.profileId],data=readState_('admin',true).data;
    if(!profile||!profile.active)throw new Error('Profil nicht gefunden.');
    if(ids.some(function(id){return typeof id!=='string'||!data.collections[id];}))throw new Error('Sammlungen zuerst hochladen.');
    const records=records_('_LatinioShares'),snapshots=[],results=[],changes=[];
    ids.forEach(function(sourceId){
      const collection=data.collections[sourceId],id=shareId_(profile.id,sourceId);
      let share=records[id];const already=!!(share&&share.ready),restored=!!(already&&share.revoked);
      if(!share){share={id:id,kind:'share',profileId:profile.id,profileName:profile.name,sourceId:sourceId,targetId:'c_'+id,collection:collection,ready:false};snapshots.push([id,share]);}
      if(!already){
        Object.values(data.words).filter(function(w){return w.collectionId===sourceId;}).forEach(function(w){
          const key=id+'_'+w.id;if(!records[key]){records[key]={kind:'entry',shareId:id,sourceId:w.id,source:w};snapshots.push([key,records[key]]);}
        });
        changes.push({id:'init_'+share.targetId,entity:'collections',key:share.targetId,value:{id:share.targetId,name:share.collection.name}});
        Object.values(records).filter(function(e){return e.kind==='entry'&&e.shareId===id;}).forEach(function(e){const w=mapWord_(e.source,share);if(w)changes.push({id:'init_'+w.id,entity:'words',key:w.id,value:w});});
      }
      const noticeId='notice_'+hash_('initial:'+id).slice(0,40);
      changes.push({id:noticeId,entity:'settings',key:noticeId,value:{kind:'shareNotice',id:noticeId,at:Date.now(),collections:[{id:share.targetId,name:share.collection.name}]}});
      results.push({share:share,already:already,restored:restored});
    });
    // Three batched writes, irrespective of the number of lessons. Retries
    // reuse snapshots and deterministic operation IDs without replacing user edits.
    snapshots.sort(function(a,b){return Number(b[1].kind==='share')-Number(a[1].kind==='share');});
    saveRecords_('_LatinioShares',snapshots);
    serverWrite_(profile.id,changes);
    saveRecords_('_LatinioShares',results.filter(function(r){return !r.already||r.restored;}).map(function(r){r.share.ready=true;r.share.revoked=false;return [r.share.id,r.share];}));
    const received=readState_(profile.id,true);
    results.forEach(function(r){if(!received.data.collections[r.share.targetId])r.repair=repairShare_(r.share);});
    const verified=readState_(profile.id,true),saved=records_('_LatinioShares');
    results.forEach(function(r){r.share.delivery=shareDelivery_(r.share,verified,saved);if(!r.share.delivery.present)throw new Error('Die Sammlung fehlt beim Empfänger. Bitte Übertragung reparieren.');});
    return {results:results};
  }
  if(request.action==='shareNotify'){
    if(!Array.isArray(request.shareIds)||!request.shareIds.length||request.shareIds.length>50||typeof request.requestId!=='string'||!/^[a-zA-Z0-9_-]{8,100}$/.test(request.requestId))throw new Error('Sammlungen und gültige Benachrichtigung auswählen.');
    const profile=records_('_LatinioProfiles')[request.profileId],records=records_('_LatinioShares');
    if(!profile||!profile.active)throw new Error('Profil nicht gefunden.');
    const shares=Array.from(new Set(request.shareIds)).map(function(id){return records[id];});
    if(shares.some(function(s){return !s||s.kind!=='share'||!s.ready||s.revoked||s.profileId!==profile.id;}))throw new Error('Diese Freigabe ist beendet oder gehört zu einem anderen Nutzer.');
    shareNotice_(profile.id,shares,'reminder:'+profile.id+':'+request.requestId);
    return {ok:true};
  }
  const records=records_('_LatinioShares');
  if(request.action==='shareList'){
    const states=Object.create(null);
    return {shares:Object.values(records).filter(function(s){return s&&s.kind==='share'&&!s.revoked;}).map(function(s){if(!states[s.profileId])states[s.profileId]=readState_(s.profileId,true);return Object.assign({},s,{delivery:shareDelivery_(s,states[s.profileId],records)});})};
  }
  if(request.action==='shareCreate'){
    const profile=records_('_LatinioProfiles')[request.profileId];if(!profile||!profile.active)throw new Error('Profil nicht gefunden.');
    const data=readState_('admin').data,collection=data.collections[request.collectionId];if(!collection)throw new Error('Sammlung zuerst hochladen.');
    const id=shareId_(profile.id,collection.id);let share=records[id];
    if(share&&share.ready){const restored=!!share.revoked;if(restored){share.revoked=false;saveRecord_('_LatinioShares',share.id,share);}if(!readState_(profile.id,true).data.collections[share.targetId])repairShare_(share);return {share:share,already:true,restored:restored};}
    if(!share){
      share={id:id,kind:'share',profileId:profile.id,profileName:profile.name,sourceId:collection.id,targetId:'c_'+id,collection:collection,ready:false};
      saveRecord_('_LatinioShares',id,share);
    }
    // Prepare per-word snapshots before appending. Deterministic operation IDs make retries safe.
    const words=Object.values(data.words).filter(function(w){return w.collectionId===collection.id;});
    saveRecords_('_LatinioShares',words.filter(function(w){return !records[id+'_'+w.id];}).map(function(w){return [id+'_'+w.id,{kind:'entry',shareId:id,sourceId:w.id,source:w}];}));
    const entries=Object.values(records_('_LatinioShares')).filter(function(e){return e.kind==='entry'&&e.shareId===id;});
    const changes=[{id:'init_'+share.targetId,entity:'collections',key:share.targetId,value:{id:share.targetId,name:share.collection.name}}];
    entries.forEach(function(e){const w=mapWord_(e.source,share);changes.push({id:'init_'+w.id,entity:'words',key:w.id,value:w});});
    serverWrite_(profile.id,changes);share.ready=true;saveRecord_('_LatinioShares',id,share);return {share:share};
  }
  if(request.action==='shareRepair'){
    let target=records[request.shareId];
    if(!target||target.kind!=='share'||target.revoked||!records_('_LatinioProfiles')[target.profileId]?.active)throw new Error('Freigabe nicht gefunden oder beendet.');
    if(!target.ready)target=accountApi_({action:'shareCreate',profileId:target.profileId,collectionId:target.sourceId},identity).share;
    const result=repairShare_(target);return Object.assign(result,{share:Object.assign({},target,{delivery:result.delivery})});
  }
  const share=records[request.shareId];if(!share||share.kind!=='share'||!share.ready)throw new Error('Freigabe nicht gefunden.');
  if(request.action==='shareRevoke'){share.revoked=true;saveRecord_('_LatinioShares',share.id,share);return {ok:true};}
  if(share.revoked||!records_('_LatinioProfiles')[share.profileId]?.active)throw new Error('Diese Freigabe ist beendet.');
  if(request.action==='shareChanges')return {share:share,changes:shareChanges_(share)};
  if(request.action==='shareSend'){
    if(!Array.isArray(request.keys)||request.keys.length>200)throw new Error('Bitte maximal 200 Änderungen auswählen.');
    const selected=shareChanges_(share).filter(function(c){return request.keys.includes(c.key);});
    const changes=[];
    selected.forEach(function(c){
      const entry=records[share.id+'_'+c.key];
      const previous=c.entity==='collections'?(share.collection?{id:share.targetId,name:share.collection.name}:null):mapWord_(entry?entry.source:null,share);
      const value=c.entity==='collections'?(c.source?{id:share.targetId,name:c.source.name}:null):mapWord_(c.source,share);
      const target=c.entity==='collections'?share.targetId:targetId_(share.id,c.key);
      const revision=c.entity==='collections'?(share.revision||0):(entry?.revision||0);
      const id='in_'+hash_(share.id+':'+c.key+':'+revision+':'+JSON.stringify(previous)+':'+JSON.stringify(value)).slice(0,40);
      changes.push({id:id,entity:'settings',key:id,value:{kind:'incomingShare',id:id,entity:c.entity,key:target,previous:previous,value:value,collectionId:share.targetId,label:c.label,at:Date.now()}});
    });
    // Recipients first; a retry deduplicates delivery even if saving the baseline fails.
    serverWrite_(share.profileId,changes);
    const baselines=selected.map(function(c){if(c.entity==='collections'){share.collection=c.source;share.revision=(share.revision||0)+1;return [share.id,share];}return [share.id+'_'+c.key,{kind:'entry',shareId:share.id,sourceId:c.key,source:c.source,revision:((records[share.id+'_'+c.key]||{}).revision||0)+1}];});
    saveRecords_('_LatinioShares',baselines);
    return {sent:changes.length};
  }
  throw new Error('Unbekannte Verwaltungsaktion.');
}
