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
function metaSheet_(name){
  const book=SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
  let sheet=book.getSheetByName(name);
  if(!sheet){sheet=book.insertSheet(name);sheet.getRange(1,1,1,2).setValues([['Schlüssel','Daten (JSON)']]);}
  return sheet;
}
function records_(name){
  const sheet=metaSheet_(name),data=Object.create(null),last=sheet.getLastRow();
  if(last>1)sheet.getRange(2,1,last-1,2).getValues().forEach(function(row){data[row[0]]=JSON.parse(row[1]);});
  return data;
}
function saveRecord_(name,key,value){
  const sheet=metaSheet_(name),json=JSON.stringify(value);if(json.length>45000)throw new Error('Datensatz zu groß.');
  const last=sheet.getLastRow();
  const keys=last>1?sheet.getRange(2,1,last-1,1).getValues():[];
  let index=keys.findIndex(function(row){return row[0]===key;});
  sheet.getRange(index<0?last+1:index+2,1,1,2).setValues([[key,json]]);
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
function readState_(id){
  const sheet=ensureLog_(id),last=sheet.getLastRow();
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
function mapWord_(word,share){return word?{id:targetId_(share.id,word.id),collectionId:share.targetId,latin:word.latin,meanings:word.meanings}:null;}
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
function accountApi_(request,identity){
  if(request.action==='logout'){saveRecord_('_LatinioSessions',hash_(request.token),{profileId:identity.id,expires:0});return {ok:true};}
  if(identity.role!=='admin')throw new Error('Nur für das Admin-Profil.');
  if(request.action==='profiles')return {profiles:Object.values(records_('_LatinioProfiles'))};
  if(request.action==='profileCreate'){
    const name=String(request.name||'').trim(),email=String(request.email||'').trim().toLowerCase();
    if(!name||name.length>80||email.length>254||!/^\S+@\S+\.\S+$/.test(email))throw new Error('Name und gültige E-Mail eingeben.');
    const profiles=records_('_LatinioProfiles');if(Object.values(profiles).some(function(p){return p.email===email;}))throw new Error('Diese E-Mail ist bereits angelegt.');
    const profile={id:'p_'+Utilities.getUuid().replace(/-/g,''),name:name,email:email,active:true};
    saveRecord_('_LatinioProfiles',profile.id,profile);return {profile:profile};
  }
  const records=records_('_LatinioShares');
  if(request.action==='shareList')return {shares:Object.values(records).filter(function(s){return s&&s.kind==='share'&&s.ready;})};
  if(request.action==='shareCreate'){
    const profile=records_('_LatinioProfiles')[request.profileId];if(!profile||!profile.active)throw new Error('Profil nicht gefunden.');
    const data=readState_('admin').data,collection=data.collections[request.collectionId];if(!collection)throw new Error('Sammlung zuerst hochladen.');
    const id=shareId_(profile.id,collection.id);let share=records[id];
    if(share&&share.ready)return {share:share,already:true};
    if(!share){
      share={id:id,kind:'share',profileId:profile.id,profileName:profile.name,sourceId:collection.id,targetId:'c_'+id,collection:collection,ready:false};
      saveRecord_('_LatinioShares',id,share);
    }
    // Prepare per-word snapshots before appending. Deterministic operation IDs make retries safe.
    const words=Object.values(data.words).filter(function(w){return w.collectionId===collection.id;});
    words.forEach(function(w){const key=id+'_'+w.id;if(!records[key])saveRecord_('_LatinioShares',key,{kind:'entry',shareId:id,sourceId:w.id,source:w});});
    const entries=Object.values(records_('_LatinioShares')).filter(function(e){return e.kind==='entry'&&e.shareId===id;});
    const changes=[{id:'init_'+share.targetId,entity:'collections',key:share.targetId,value:{id:share.targetId,name:share.collection.name}}];
    entries.forEach(function(e){const w=mapWord_(e.source,share);changes.push({id:'init_'+w.id,entity:'words',key:w.id,value:w});});
    serverWrite_(profile.id,changes);share.ready=true;saveRecord_('_LatinioShares',id,share);return {share:share};
  }
  const share=records[request.shareId];if(!share||share.kind!=='share'||!share.ready)throw new Error('Freigabe nicht gefunden.');
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
    selected.forEach(function(c){if(c.entity==='collections'){share.collection=c.source;share.revision=(share.revision||0)+1;saveRecord_('_LatinioShares',share.id,share);}else saveRecord_('_LatinioShares',share.id+'_'+c.key,{kind:'entry',shareId:share.id,sourceId:c.key,source:c.source,revision:((records[share.id+'_'+c.key]||{}).revision||0)+1});});
    return {sent:changes.length};
  }
  throw new Error('Unbekannte Verwaltungsaktion.');
}
