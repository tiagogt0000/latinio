import test from 'node:test';
import assert from 'node:assert/strict';
import {harness} from './google-harness.mjs';
import {openDatabase} from '../server/database.mjs';

let seq=0;
function push(h,entity,key,value,token='a'.repeat(64),subject='latin'){
  return h.request({action:'push',token,subject,base:h.request({action:'check',token,subject}).version,ops:[{id:'change_'+(++seq),entity,key,value,device:'test',seq,at:Date.now()}]});
}
function student(h,name='Felix',allowedSubjects=['latin','english']){
  const p=h.request({action:'profileCreate',name,email:name.toLowerCase()+'@example.org',allowedSubjects}).profile;
  return {...h.request({action:'login',email:p.email}),id:p.id};
}
function state(h,p,subject='latin'){return h.request({action:'pull',token:p.token,subject,since:0}).data;}
const word=(id,name='Tag')=>({id,collectionId:'lesson',latin:name,meanings:[['day']],forms:['Tages']});
function apply(h,ids,profileIds){return h.request({action:'autoShareApply',profileIds,differenceIds:ids,requestId:'apply_'+(++seq)});}

test('New lessons and all content edits automatically reach allowed students in both subjects',()=>{
  const h=harness(),f=student(h),english=student(h,'Tom',['english']);h.ctx.AUTOMATIC_SHARING_ENABLED=true;
  push(h,'collections','lesson',{id:'lesson',name:'Lektion 1'});const added=push(h,'words','w',word('w'));
  assert.equal(added.autoShare.users,1);assert.equal(Object.values(state(h,f).words)[0].latin,'Tag');
  push(h,'words','w',word('w','Nacht'));assert.equal(Object.values(state(h,f).words)[0].latin,'Nacht');
  push(h,'collections','lesson',{id:'lesson',name:'LW 1'},undefined,'english');push(h,'words','en',word('en','day'),undefined,'english');
  assert.equal(Object.values(state(h,english,'english').words)[0].latin,'day');
  assert.equal(h.request({action:'autoShareCheck',profileIds:[f.id,english.id]}).differences.length,0);
  assert.equal(h.request({action:'shareList'}).shares[0].automatic,true);
});
test('Automatic changes preserve user learning, activity, unrelated edits and extra words',()=>{
  const h=harness(),f=student(h);h.ctx.AUTOMATIC_SHARING_ENABLED=true;
  push(h,'collections','lesson',{id:'lesson',name:'Lektion'});push(h,'words','a',word('a','A'));push(h,'words','b',word('b','B'));
  let d=state(h,f);const a=Object.values(d.words).find(w=>w.latin==='A'),b=Object.values(d.words).find(w=>w.latin==='B');
  push(h,'reviews','review',{id:'review',wordId:a.id,grade:'full',at:2},f.token);
  push(h,'settings','streak_day_2026-10-13',{kind:'streakDay',day:'2026-10-13'},f.token);
  push(h,'words',b.id,{...b,latin:'Meine Variante'},f.token);
  push(h,'words','extra',{...a,id:'extra',latin:'Mein Zusatz'},f.token);
  push(h,'words','a',word('a','Neu'));
  d=state(h,f);assert.equal(d.words[a.id].latin,'Neu');assert.equal(d.words[b.id].latin,'Meine Variante');assert.equal(d.words.extra.latin,'Mein Zusatz');
  assert.equal(d.reviews.review.grade,'full');assert.equal(d.settings['streak_day_2026-10-13'].day,'2026-10-13');
  const differences=h.request({action:'autoShareCheck',profileIds:[f.id]}).differences;
  assert.equal(differences.length,2);assert.ok(differences.some(d=>d.key.startsWith('extra_')));
  const replace=differences.find(d=>d.key==='b');apply(h,[replace.id],[f.id]);
  assert.equal(state(h,f).words[b.id].latin,'B');assert.ok(state(h,f).words.extra);assert.ok(state(h,f).reviews.review);
});
test('The live checker adopts previous manual shares without duplicating collections and preserves unchecked differences',()=>{
  const h=harness(),f=student(h);
  push(h,'collections','lesson',{id:'lesson',name:'Lektion'});push(h,'words','w',word('w'));
  const shared=h.request({action:'shareCreate',profileId:f.id,collectionId:'lesson'}).share;
  const old=Object.values(state(h,f).words)[0];push(h,'words',old.id,{...old,meanings:[['my own meaning']]},f.token);
  h.ctx.AUTOMATIC_SHARING_ENABLED=true;
  const check=h.request({action:'autoShareCheck',profileIds:[f.id]});const diff=check.differences.find(d=>d.key==='w');
  assert.equal(diff.targetKey,old.id);assert.equal(diff.before.meanings[0][0],'my own meaning');
  assert.equal(Object.keys(state(h,f).collections).length,1);
  apply(h,[],[f.id]);assert.equal(state(h,f).words[old.id].meanings[0][0],'my own meaning');
  apply(h,[diff.id],[f.id]);assert.equal(state(h,f).words[old.id].meanings[0][0],'day');
  assert.ok(state(h,f).collections[shared.targetId]);assert.equal(Object.keys(state(h,f).collections).length,1);
  assert.equal(h.request({action:'autoShareCheck',profileIds:[f.id]}).differences.length,0);
});
test('Perfect collections share automatically but refresher collections and progress do not',()=>{
  const h=harness(),f=student(h);h.ctx.AUTOMATIC_SHARING_ENABLED=true;
  push(h,'settings','deck',{id:'deck',kind:'predicateDeck',name:'Perfekt Lektion 1',active:true});
  push(h,'settings','verb',{id:'verb',kind:'predicateItem',deckId:'deck',name:'Perfekt Lektion 1',grundform:'esse',praedikate:['fui']});
  let item=Object.values(state(h,f).settings).find(v=>v.kind==='predicateItem');assert.equal(item.praedikate[0],'fui');
  push(h,'settings','learned',{kind:'predicateReview',itemId:item.id,correct:true,at:1},f.token);
  push(h,'settings','verb',{id:'verb',kind:'predicateItem',deckId:'deck',name:'Perfekt Lektion 1',grundform:'esse',praedikate:['fui','fuisse']});
  item=state(h,f).settings[item.id];assert.equal(item.praedikate.length,2);assert.equal(state(h,f).settings.learned.correct,true);
  push(h,'settings','refresh',{id:'refresh',kind:'refreshDeck',name:'Auffrischen',members:[]});
  assert.equal(state(h,f).settings.refresh,undefined);
  push(h,'settings','verb',null);assert.equal(state(h,f).settings[item.id],undefined);assert.ok(state(h,f).settings.learned);
});
test('The checker rejects students and stale selections, detects extra words and missing containers',()=>{
  const h=harness(),f=student(h);push(h,'collections','lesson',{id:'lesson',name:'Lektion'});push(h,'words','w',word('w'));
  h.ctx.AUTOMATIC_SHARING_ENABLED=true;
  assert.throws(()=>h.request({action:'autoShareCheck',token:f.token,profileIds:[f.id]}),/Admin/);
  const first=h.request({action:'autoShareCheck',profileIds:[f.id]});const child=first.differences.find(d=>d.key==='w');
  assert.throws(()=>apply(h,[child.id],[f.id]),/fehlende Sammlung/);
  assert.equal(Object.keys(state(h,f).collections).length,0);
  apply(h,first.differences.map(d=>d.id),[f.id]);
  const saved=Object.values(state(h,f).words)[0];push(h,'words',saved.id,{...saved,latin:'different'},f.token);
  const stale=h.request({action:'autoShareCheck',profileIds:[f.id]}).differences[0];
  push(h,'words','w',word('w','NEW'));
  assert.throws(()=>apply(h,[stale.id],[f.id]),/erneut prüfen/);assert.equal(state(h,f).words[saved.id].latin,'NEW');
});
test('New profiles receive current lessons; automatic SQLite fan-out is atomic and persists',t=>{
  const h=harness();push(h,'collections','lesson',{id:'lesson',name:'Lektion'});push(h,'words','w',word('w'));
  const snapshot={format:'latinio-pi-migration',schema:1,properties:h.props,sheets:[...h.sheets].map(([name,s])=>({name,rows:structuredClone(s.rows)}))};
  const db=openDatabase(':memory:',{enableAutoSharing:true});t.after(()=>db.close());db.importSnapshot(snapshot);
  const admin='a'.repeat(64),created=db.request({action:'profileCreate',token:admin,name:'New',email:'new@example.org'});
  assert.equal(created.autoShare.users,1);
  const login=db.request({action:'login',email:'new@example.org'});
  assert.equal(Object.values(db.request({action:'pull',token:login.token,since:0}).data.words)[0].latin,'Tag');
  const base=db.request({action:'check',token:admin}).version;
  assert.throws(()=>db.request({action:'push',token:admin,base,ops:[{id:'bad',entity:'words',key:'w',value:word('wrong'),device:'test',seq:1,at:1}]}),/Vokabel/);
  assert.equal(db.request({action:'check',token:admin}).version,base);
  assert.equal(Object.values(db.request({action:'pull',token:login.token,since:0}).data.words)[0].latin,'Tag');
});
test('A failure during recipient fan-out rolls back admin edits and earlier recipient writes together',t=>{
  const h=harness();push(h,'collections','lesson',{id:'lesson',name:'Lektion'});push(h,'words','w',word('w'));
  const snapshot={format:'latinio-pi-migration',schema:1,properties:h.props,sheets:[...h.sheets].map(([name,s])=>({name,rows:structuredClone(s.rows)}))};
  const db=openDatabase(':memory:',{enableAutoSharing:true});t.after(()=>db.close());db.importSnapshot(snapshot);
  const admin='a'.repeat(64);
  const first=db.request({action:'profileCreate',token:admin,name:'First',email:'first@example.org'}).profile;
  const second=db.request({action:'profileCreate',token:admin,name:'Second',email:'second@example.org'}).profile;
  const token=db.request({action:'login',email:first.email}).token;
  const metadata=db.db.prepare("SELECT position,value FROM rows WHERE sheet='_LatinioAutoShares' ORDER BY position").all().slice(1);
  const resource=metadata.map(r=>JSON.parse(JSON.parse(r.value)[1])).find(r=>r.kind==='autoResource'&&r.profileId===second.id);
  const entry=metadata.find(r=>{const v=JSON.parse(JSON.parse(r.value)[1]);return v.kind==='autoEntry'&&v.resourceId===resource.id;});
  const row=JSON.parse(entry.value),record=JSON.parse(row[1]);record.targetKey='__proto__';row[1]=JSON.stringify(record);
  db.db.prepare("UPDATE rows SET value=? WHERE sheet='_LatinioAutoShares' AND position=?").run(JSON.stringify(row),entry.position);
  const base=db.request({action:'check',token:admin}).version;
  assert.throws(()=>db.request({action:'push',token:admin,base,ops:[{id:'atomic-new',entity:'words',key:'w',value:word('w','new'),device:'test',seq:1,at:1}]}),/Kennung/);
  assert.equal(db.request({action:'check',token:admin}).version,base);
  assert.equal(Object.values(db.request({action:'pull',token,since:0}).data.words)[0].latin,'Tag');
});
test('Revoked old manual shares are adopted again without duplicating retained user collections',()=>{
  const h=harness(),f=student(h);push(h,'collections','lesson',{id:'lesson',name:'Lektion'});push(h,'words','w',word('w'));
  const shared=h.request({action:'shareCreate',profileId:f.id,collectionId:'lesson'}).share;
  h.request({action:'shareRevoke',shareId:shared.id});h.ctx.AUTOMATIC_SHARING_ENABLED=true;
  push(h,'words','w',word('w','new'));
  const actual=state(h,f);assert.equal(Object.keys(actual.collections).length,1);assert.equal(Object.values(actual.words)[0].latin,'new');
});
