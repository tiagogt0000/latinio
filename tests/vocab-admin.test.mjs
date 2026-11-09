import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './google-harness.mjs';
import {openDatabase} from '../server/database.mjs';

const admin='a'.repeat(64),subject='french',plain=value=>JSON.parse(JSON.stringify(value));let sequence=0;
function push(h,entity,key,value,token=admin,language=subject){return h.request({action:'push',subject:language,token,base:h.request({action:'check',subject:language,token}).version,ops:[{id:'test_'+(++sequence),entity,key,value,device:'test',seq:sequence,at:Date.now()}]});}
function data(h,token=admin,language=subject){return plain(h.request({action:'pull',subject:language,token,since:0}).data);}
function person(h,name,subjects=['french'],grants=[]){const profile=h.request({action:'profileCreate',name,email:name.toLowerCase()+'@example.org',allowedSubjects:subjects,vocabAdminSubjects:grants}).profile;return {...plain(profile),token:h.request({action:'login',email:profile.email}).token};}
function fixture(){
 const h=harness();h.ctx.AUTOMATIC_SHARING_ENABLED=true;
 push(h,'collections','lesson',{id:'lesson',name:'Lernwoche 1'});
 push(h,'words','word',{id:'word',collectionId:'lesson',latin:'seul/seule',meanings:[['allein']],answerVariants:['seul','seule']});
 push(h,'words','other',{id:'other',collectionId:'lesson',latin:'bonjour',meanings:[['Guten Tag']]});
 const editor=person(h,'Camille',['french','english'],['french']),student=person(h,'Alex'),excluded=person(h,'Luke',['latin']);
 const local=Object.values(data(h,editor.token).words).find(w=>w.latin==='seul/seule');
 return {h,editor,student,excluded,local};
}
function prepare(h,editor,local){return plain(h.request({action:'vocabAdminWord',subject,token:editor.token,wordId:local.id}));}
function publish(h,editor,local,base,extra={}){return h.request({action:'vocabAdminPublish',subject,token:editor.token,wordId:local.id,revision:base.revision,requestId:'publish_'+(++sequence),confirmed:true,word:{latin:'seul/seule',meanings:[['allein','einzeln']],answerVariants:['seul','seule']},...extra});}

test('Subject editor grants default empty, persist through old clients, are primary-admin-only and limited to accessible subjects',()=>{
 const h=harness(),p=person(h,'Camille',['french','english']);assert.deepEqual(p.vocabAdminSubjects,[]);
 const update={action:'profileUpdate',profileId:p.id,name:p.name,email:p.email,allowedSubjects:['french','english'],vocabAdminSubjects:['french']};
 assert.throws(()=>h.request({...update,token:p.token}),/Admin/);
 assert.deepEqual(plain(h.request(update).profile.vocabAdminSubjects),['french']);
 assert.deepEqual(plain(h.request({action:'whoami',subject,token:p.token}).profile.vocabAdminSubjects),['french']);
 assert.deepEqual(plain(h.request({action:'check',subject,token:p.token}).vocabAdminSubjects),['french']);
 assert.equal(h.request({action:'whoami',subject,token:p.token}).profile.role,'student');
 const legacy={...update};delete legacy.vocabAdminSubjects;assert.deepEqual(plain(h.request(legacy).profile.vocabAdminSubjects),['french']);
 for(const grants of [null,'french',['latin'],['french','unknown'],['french','french','french','french']])assert.throws(()=>h.request({...update,vocabAdminSubjects:grants}),/Vokabel-Admin/);
 assert.throws(()=>h.request({action:'profileCreate',name:'Bad',email:'bad@example.org',allowedSubjects:['latin'],vocabAdminSubjects:['french']}),/Vokabel-Admin/);
 assert.equal(h.request({action:'profiles'}).profiles.length,1);
 assert.deepEqual(plain(h.request({action:'profileUpdateSubjects',profileId:p.id,allowedSubjects:['english']}).profile.vocabAdminSubjects),[]);
 assert.deepEqual(plain(h.request({action:'profileUpdateSubjects',profileId:p.id,allowedSubjects:['english','french']}).profile.vocabAdminSubjects),[],'restoring subject access must not restore removed admin grants');
});

test('A confirmed correction updates the canonical word and all subject recipients, with private learning state intact and audit provenance',()=>{
 const {h,editor,student,excluded,local}=fixture(),base=prepare(h,editor,local);
 assert.equal(base.eligible,true);assert.equal(base.sourceWordId,'word');assert.equal(base.collectionName,'Lernwoche 1');
 const own=data(h,student.token),target=Object.values(own.words).find(w=>w.latin==='seul/seule'),other=Object.values(own.words).find(w=>w.id!==target.id);
 push(h,'words',target.id,{...target,latin:'privater Fehler'},student.token);push(h,'words',other.id,{...other,meanings:[['persönliche Notiz']]},student.token);
 push(h,'reviews','review',{id:'review',wordId:target.id,grade:'full',at:123},student.token);
 push(h,'sessions','session',{id:'session',createdAt:123,questions:[target.id]},student.token);
 push(h,'settings','streak_day_2026_11_09',{kind:'streakDay',day:'2026-11-09'},student.token);
 const before=data(h,student.token),excludedBefore=data(h,excluded.token,'latin'),adminBefore=data(h),result=plain(publish(h,editor,local,base));
 assert.equal(result.users,2);assert.equal(result.recipients.length,2);
 for(const token of [admin,editor.token,student.token]){const word=Object.values(data(h,token).words).find(w=>w.latin==='seul/seule');assert.deepEqual(word.meanings,[['allein','einzeln']]);assert.deepEqual(word.answerVariants,['seul','seule']);}
 const after=data(h,student.token);for(const key of ['collections','reviews','sessions','settings'])assert.deepEqual(after[key],before[key]);assert.deepEqual(after.words[other.id],before.words[other.id]);assert.deepEqual(data(h,excluded.token,'latin'),excludedBefore);assert.deepEqual(data(h).words.other,adminBefore.words.other);
 const history=plain(h.request({action:'vocabAdminHistory',subject}));assert.equal(history.changes.length,1);const audit=history.changes[0];
 assert.equal(audit.id,result.auditId);assert.equal(audit.actorId,editor.id);assert.equal(audit.actorName,editor.name);assert.equal(audit.status,'complete');assert.equal(audit.subject,subject);assert.ok(audit.at>0);assert.deepEqual(audit.before,base.before);assert.deepEqual(audit.after.meanings,[['allein','einzeln']]);assert.deepEqual(audit.recipients,result.recipients);
 assert.throws(()=>h.request({action:'vocabAdminHistory',subject,token:editor.token}),/Admin/);
});

test('Publication requires an explicit grant and confirmation, and cannot create/delete/move words or edit another person’s private data',()=>{
 const {h,editor,student,local}=fixture(),base=prepare(h,editor,local),before=data(h),version=h.request({action:'check',subject}).version;
 for(const extra of [{confirmed:false},{confirmed:'true'},{token:student.token},{subject:'english'},{word:null},{word:{...base.before}},{word:{latin:'new',meanings:[['neu']],collectionId:'other'}},{word:{latin:'new',meanings:[['neu']],id:'new'}},{word:{latin:'new',meanings:[]}},{word:{latin:'new',meanings:[['neu']],answerVariants:[]}},{word:{latin:'new',meanings:[['neu']],forms:['']}}])assert.throws(()=>publish(h,editor,local,base,extra));
 const theirs=Object.values(data(h,student.token).words)[0];assert.throws(()=>prepare(h,editor,theirs),/nicht mehr vorhanden/);
 push(h,'words','private',{id:'private',collectionId:local.collectionId,latin:'privé',meanings:[['privat']]},editor.token);
 assert.equal(prepare(h,editor,{id:'private'}).eligible,false);assert.throws(()=>publish(h,editor,{id:'private'},base),/geteilte Vokabeln/);
 assert.deepEqual(data(h),before);assert.equal(h.request({action:'check',subject}).version,version);assert.equal(h.request({action:'vocabAdminHistory',subject}).changes.length,0);
 h.request({action:'profileUpdate',profileId:editor.id,name:editor.name,email:editor.email,allowedSubjects:['french','english'],vocabAdminSubjects:[]});assert.throws(()=>publish(h,editor,local,base),/nicht als Vokabel-Admin/);
 for(const action of ['profiles','profileDelete','autoShareCheck','shareList','announcementList'])assert.throws(()=>h.request({action,subject,token:editor.token,profileId:student.id,profileIds:[student.id]}),/Admin/);
});

test('Stale canonical and personal snapshots cannot overwrite another device’s edits',()=>{
 for(const changeCanonical of [true,false]){
  const {h,editor,local}=fixture(),base=prepare(h,editor,local);
  if(changeCanonical)push(h,'words','word',{...base.before,meanings:[['bereits korrigiert']]});else push(h,'words',local.id,{...local,meanings:[['meine neuere Antwort']]},editor.token);
  const before=data(h),personal=data(h,editor.token);assert.throws(()=>publish(h,editor,local,base),/inzwischen geändert/);
  assert.deepEqual(data(h),before);assert.deepEqual(data(h,editor.token),personal);assert.equal(h.request({action:'vocabAdminHistory',subject}).changes.length,0);
 }
});

test('Retried publication is idempotent even after a later correction, and reusing an ID for different content fails',()=>{
 const {h,editor,local}=fixture(),base=prepare(h,editor,local),requestId='stable_request_123',first=plain(publish(h,editor,local,base,{requestId}));
 const personal=data(h,editor.token),current=prepare(h,editor,personal.words[local.id]);publish(h,editor,local,current,{word:{latin:'seul',meanings:[['allein']],answerVariants:['seul']}});
 const versions=[admin,editor.token].map(token=>h.request({action:'check',subject,token}).version),latest=data(h);
 assert.deepEqual(plain(publish(h,editor,local,base,{requestId})),first);assert.deepEqual(data(h),latest);assert.deepEqual([admin,editor.token].map(token=>h.request({action:'check',subject,token}).version),versions);
 assert.throws(()=>publish(h,editor,local,base,{requestId,word:{latin:'different',meanings:[['anders']]}}),/Änderungskennung/);
 const page=plain(h.request({action:'vocabAdminHistory',subject,limit:1}));assert.equal(page.changes.length,1);assert.ok(page.nextBefore);
 const older=plain(h.request({action:'vocabAdminHistory',subject,limit:1,before:page.nextBefore}));assert.equal(older.changes.length,1);assert.notEqual(older.changes[0].id,page.changes[0].id);assert.equal(older.nextBefore,null);
 assert.equal(h.request({action:'vocabAdminHistory',subject:'english'}).changes.length,0);
});

test('Legacy shared-word mappings work and explicit publication fans out even when automatic routine sharing is disabled',()=>{
 const h=harness(),editor=person(h,'Camille',['french'],['french']),student=person(h,'Alex');
 push(h,'collections','lesson',{id:'lesson',name:'Lektion'});push(h,'words','word',{id:'word',collectionId:'lesson',latin:'bonjour',meanings:[['Hallo']]});
 push(h,'words','other',{id:'other',collectionId:'lesson',latin:'salut',meanings:[['hi']]});
 h.request({action:'shareCreate',subject,profileId:editor.id,collectionId:'lesson'});
 h.request({action:'shareCreate',subject,profileId:student.id,collectionId:'lesson'});
 const local=Object.values(data(h,editor.token).words).find(w=>w.latin==='bonjour'),base=prepare(h,editor,local);assert.equal(base.eligible,true);
 const original=data(h,student.token),target=Object.values(original.words).find(w=>w.latin==='bonjour'),other=Object.values(original.words).find(w=>w.latin==='salut');
 push(h,'words',target.id,{...target,meanings:[['privater Fehler']]},student.token);push(h,'words',other.id,{...other,meanings:[['persönliche Notiz']]},student.token);
 push(h,'reviews','manual_review',{id:'manual_review',wordId:target.id,grade:'full',at:123},student.token);
 const before=data(h,student.token);publish(h,editor,local,base,{word:{latin:'bonjour',meanings:[['Guten Tag']]}});
 const after=data(h,student.token);assert.deepEqual(after.words[target.id].meanings,[['Guten Tag']]);assert.equal(Object.keys(after.words).length,2);assert.deepEqual(after.words[other.id],before.words[other.id]);assert.deepEqual(after.collections,before.collections);assert.deepEqual(after.reviews,before.reviews);
});

test('SQLite commits provenance, canonical word, and recipient journals atomically and rolls everything back on fanout failure',t=>{
 const {h,editor,student,local}=fixture(),snapshot={format:'latinio-pi-migration',schema:1,properties:h.props,sheets:[...h.sheets].map(([name,s])=>({name,rows:structuredClone(s.rows)}))};
 const db=openDatabase(':memory:',{enableAutoSharing:true});t.after(()=>db.close());db.importSnapshot(snapshot);db.db.prepare('INSERT OR REPLACE INTO properties VALUES (?,?)').run('FRENCH_ENABLED','true');
 const api={request:request=>db.request({token:admin,...request})},base=prepare(api,editor,local),before=data(api),own=data(api,editor.token);
 const metadata=db.db.prepare("SELECT position,value FROM rows WHERE sheet='_LatinioAutoShares' ORDER BY position").all().slice(1),resource=metadata.map(r=>JSON.parse(JSON.parse(r.value)[1])).find(r=>r.kind==='autoResource'&&r.profileId===student.id);
 const row=metadata.find(r=>{const value=JSON.parse(JSON.parse(r.value)[1]);return value.kind==='autoEntry'&&value.resourceId===resource.id&&value.sourceKey==='word';}),payload=JSON.parse(row.value),record=JSON.parse(payload[1]);record.targetKey='__proto__';payload[1]=JSON.stringify(record);
 db.db.prepare("UPDATE rows SET value=? WHERE sheet='_LatinioAutoShares' AND position=?").run(JSON.stringify(payload),row.position);
 assert.throws(()=>publish(api,editor,local,base),/Kennung/);assert.deepEqual(data(api),before);assert.deepEqual(data(api,editor.token),own);assert.equal(api.request({action:'vocabAdminHistory',subject}).changes.length,0);
 db.db.prepare("UPDATE rows SET value=? WHERE sheet='_LatinioAutoShares' AND position=?").run(row.value,row.position);
 const result=publish(api,editor,local,base);assert.equal(result.users,2);assert.equal(api.request({action:'vocabAdminHistory',subject}).changes.length,1);assert.equal(db.db.prepare('PRAGMA quick_check').get().quick_check,'ok');
});

test('Restoring a private typo to the existing canonical spelling still corrects all recipient copies and records the editor’s real before value',()=>{
 const {h,editor,student,local}=fixture();push(h,'words',local.id,{...local,latin:'seull'},editor.token);
 const recipient=Object.values(data(h,student.token).words).find(w=>w.latin==='seul/seule');push(h,'words',recipient.id,{...recipient,latin:'seulle'},student.token);
 const base=prepare(h,editor,local),result=publish(h,editor,local,base,{word:{latin:'seul/seule',meanings:[['allein']],answerVariants:['seul','seule']}});
 assert.equal(result.users,2);assert.equal(data(h,editor.token).words[local.id].latin,'seul/seule');assert.equal(data(h,student.token).words[recipient.id].latin,'seul/seule');
 const audit=h.request({action:'vocabAdminHistory',subject}).changes[0];assert.equal(audit.editorBefore.latin,'seull');assert.equal(audit.before.latin,'seul/seule');assert.equal(audit.after.latin,'seul/seule');
});

test('Each subject supports only its assigned existing vocabulary, including Latin word forms and intentional removal of stale answer variants',()=>{
 for(const language of ['latin','english','french']){
  const h=harness();h.ctx.AUTOMATIC_SHARING_ENABLED=true;
  const editor=person(h,'Editor',[language],[language]);
  push(h,'collections','lesson',{id:'lesson',name:'Lektion'},admin,language);
  push(h,'words','w',{id:'w',collectionId:'lesson',latin:'old',meanings:[['alt']],forms:['olds'],answerVariants:['old','olde']},admin,language);
  const local=Object.values(data(h,editor.token,language).words)[0],base=h.request({action:'vocabAdminWord',subject:language,token:editor.token,wordId:local.id});
  h.request({action:'vocabAdminPublish',subject:language,token:editor.token,wordId:local.id,revision:base.revision,requestId:'publish_each_'+language,confirmed:true,word:{latin:'new',meanings:[['neu']],forms:['newa','newae']}});
  for(const token of [admin,editor.token]){const actual=Object.values(data(h,token,language).words)[0];assert.equal(actual.latin,'new');assert.deepEqual(actual.forms,['newa','newae']);assert.equal(actual.answerVariants,undefined);}
 }
});

test('An interrupted legacy Apps Script fanout resumes with one audit and cannot overwrite a subsequent private edit',()=>{
 for(const changeLocal of [false,true]){
  const {h,editor,local}=fixture(),base=prepare(h,editor,local),fanout=h.ctx.autoShareChanges_,requestId='resume_legacy_123';
  h.ctx.autoShareChanges_=()=>{throw new Error('temporary fanout failure');};
  assert.throws(()=>publish(h,editor,local,base,{requestId}),/temporary fanout failure/);
  h.ctx.autoShareChanges_=fanout;
  assert.equal(h.request({action:'vocabAdminHistory',subject}).changes[0].status,'pending');
  if(changeLocal){push(h,'words',local.id,{...local,latin:'new private edit'},editor.token);assert.throws(()=>publish(h,editor,local,base,{requestId}),/inzwischen geändert/);assert.equal(data(h,editor.token).words[local.id].latin,'new private edit');}
  else {const result=publish(h,editor,local,base,{requestId});assert.equal(result.users,2);assert.equal(h.request({action:'vocabAdminHistory',subject}).changes.length,1);assert.equal(h.request({action:'vocabAdminHistory',subject}).changes[0].status,'complete');}
 }
});

test('The full existing 300-form by 100-character vocabulary limit is publishable and auditable without truncation',()=>{
 const {h,editor,local}=fixture(),forms=Array.from({length:300},(_,i)=>String(i).padStart(4,'0')+'x'.repeat(96));
 const canonical=data(h).words.word;push(h,'words','word',{...canonical,forms});
 const base=prepare(h,editor,local),changed=forms.map(form=>form.slice(0,99)+'y');
 const result=publish(h,editor,local,base,{word:{latin:canonical.latin,meanings:canonical.meanings,forms:changed,answerVariants:canonical.answerVariants}});
 assert.equal(result.users,2);assert.deepEqual(data(h).words.word.forms,changed);assert.deepEqual(data(h,editor.token).words[local.id].forms,changed);
 const audit=plain(h.request({action:'vocabAdminHistory',subject}).changes[0]);assert.deepEqual(audit.before.forms,forms);assert.deepEqual(audit.editorBefore.forms,forms);assert.deepEqual(audit.after.forms,changed);
 const stored=h.sheets.get('_LatinioVocabEditWords').rows.slice(1);assert.equal(stored.length,3);assert.ok(stored.every(row=>row[1].length<=45000));
 const metadata=JSON.parse(h.sheets.get('_LatinioVocabEdits').rows[1][1]);assert.equal(metadata.before,undefined);assert.equal(metadata.after,undefined);
 const current=prepare(h,editor,local);
 for(const invalid of [Array(301).fill('a'),['a'.repeat(101)]])assert.throws(()=>publish(h,editor,local,current,{word:{latin:canonical.latin,meanings:canonical.meanings,forms:invalid}}),/Wortformen/);
 assert.equal(h.request({action:'vocabAdminHistory',subject}).changes.length,1);
});

test('Vocabulary editor sessions keep the existing expiry and expired sessions cannot read or publish corrections',()=>{
 const {h,editor,local}=fixture(),base=prepare(h,editor,local),key=h.ctx.hash_(editor.token),session=h.ctx.records_('_LatinioSessions')[key],remaining=session.expires-Date.now();
 assert.ok(remaining>179.99*86400000&&remaining<=180*86400000,'the normal six-month student session duration is unchanged');
 h.ctx.saveRecord_('_LatinioSessions',key,{...session,expires:Date.now()-1});
 const before=data(h);assert.throws(()=>prepare(h,editor,local),/erneut anmelden/);assert.throws(()=>publish(h,editor,local,base),/erneut anmelden/);assert.deepEqual(data(h),before);assert.equal(h.request({action:'vocabAdminHistory',subject}).changes.length,0);
});
