import test from 'node:test';
import assert from 'node:assert/strict';
import {sharingUI} from '../app/sharing-ui.js';
import {sharingCheck,adjustDifferenceSelection} from '../app/sharing-check.js';
import {accessOverview} from '../app/share-access.js';
const h=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function environment(t){
 const previousDocument=Object.getOwnPropertyDescriptor(globalThis,'document'),previousNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 const nodes=new Map();
 const document={querySelector(selector){if(!nodes.has(selector))nodes.set(selector,{isConnected:true,textContent:'',innerHTML:'',disabled:false,querySelectorAll:()=>[]});return nodes.get(selector);},querySelectorAll:()=>[]};
 Object.defineProperty(globalThis,'document',{value:document,configurable:true});
 Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});
 t.after(()=>{previousDocument?Object.defineProperty(globalThis,'document',previousDocument):delete globalThis.document;previousNavigator?Object.defineProperty(globalThis,'navigator',previousNavigator):delete globalThis.navigator;});
 return {nodes,document,disconnect(){for(const node of nodes.values())node.isConnected=false;nodes.clear();}};
}
function setup(t,{role='admin',openShareSubject}={}){
 const env=environment(t),requests=[],views=[],modals=[],notices=[];
 let visible='',closes=0;
 const store=new EventTarget();
 store.doc={pending:[]};store.data={settings:{},collections:{},words:{},reviews:{}};
 store.update=async change=>{store.doc=change(store.doc);};
 store.commit=async()=>{};
 const sync={subject:'latin',configured:false,status:'synced',run:async()=>{},schedule(){},request(action,args){return new Promise((resolve,reject)=>requests.push({action,args,resolve,reject}));}};
 const options={store,sync,profile:{id:'admin',role},h,
  showAdmin(html,tab='people'){env.disconnect();visible=tab;views.push({html,tab});},
  isAdminView:tab=>visible===tab,
  showModal:html=>modals.push(html),closeModal:()=>closes++,notify:message=>notices.push(message),render(){},openShareSubject};
 const ui=sharingUI(options);
 return {ui,store,sync,requests,views,modals,notices,...env,options,
  action:(action,id)=>ui.handle({dataset:{action,id}}),
  navigate(tab){visible=tab;env.disconnect();},get closes(){return closes;},get visible(){return visible;}};
}
const people=[{id:'p1',name:'Anna',email:'anna@example.invalid',allowedSubjects:['latin']},{id:'p2',name:'Ben',email:'ben@example.invalid',allowedSubjects:['latin']}];
async function loadShares(f,resourceShares=[]){
 await f.action('share-panel');
 f.requests.find(request=>request.action==='profiles').resolve({profiles:people});
 f.requests.find(request=>request.action==='shareList').resolve({shares:[],resourceShares,predicateShares:[],accessSchema:2});
 await tick();
}
function formData(t,recipients,mode='add'){
 const original=globalThis.FormData;
 globalThis.FormData=class{get(key){return key==='mode'?mode:null;}getAll(key){return key==='recipient'?recipients:[];}};
 t.after(()=>{globalThis.FormData=original;});
}
function accessForm(resources){
 const status={isConnected:true,textContent:''},controls=[{disabled:false}];
 return {id:'access-editor',dataset:{subject:'latin',resources:JSON.stringify(resources)},isConnected:true,querySelector:()=>status,querySelectorAll:()=>controls,status,controls};
}
const diff=(id,profileId='p1')=>({id,profileId,subject:'latin',resourceId:'lesson',key:'word',resourceName:'Lektion',label:'Vokabel',before:{latin:'alt',meanings:[['alt']]},after:{latin:'neu',meanings:[['neu']]}});
async function openChecker(f){
 await f.action('sharing-check');
 f.requests.find(request=>request.action==='profiles').resolve({profiles:people});
 await tick();await f.action('check-all-people');
}
async function check(f,differences){
 await f.action('check-run');await tick();
 const request=f.requests.filter(request=>request.action==='autoShareCheck').at(-1);
 assert.ok(request);
 request.resolve({differences,checkedAt:1234});await tick();
}

test('The checker opens in its own admin section without blocking navigation or opening a modal',async t=>{
 const f=setup(t);
 assert.equal(await f.action('sharing-check'),true);
 assert.equal(f.visible,'checks');assert.equal(f.ui.busy,true);
 assert.match(f.views.at(-1).html,/Nutzer werden geladen/);
 assert.equal(f.modals.length,0);
 f.navigate('messages');const count=f.views.length;
 f.requests[0].resolve({profiles:people});await tick();
 assert.equal(f.views.length,count);assert.equal(f.visible,'messages');assert.equal(f.ui.busy,false);
});

test('Checker failures stay in the checker with retry and restore usable controls',async t=>{
 const f=setup(t);
 await f.action('sharing-check');f.requests[0].reject(Error('Offline <script>'));await tick();
 assert.match(f.views.at(-1).html,/role="alert"/);
 assert.match(f.views.at(-1).html,/Offline &lt;script&gt;/);
 assert.match(f.views.at(-1).html,/Erneut laden/);
 await f.action('sharing-check');f.requests[1].resolve({profiles:people});await tick();
 await f.action('check-all-people');await f.action('check-run');await tick();
 const request=f.requests.find(request=>request.action==='autoShareCheck');
 request.reject(Error('Verbindung unterbrochen'));await tick();
 const html=f.views.at(-1).html;
 assert.match(html,/Verbindung unterbrochen/);
 assert.match(html,/data-action="check-run" >Jetzt prüfen/);
 assert.doesNotMatch(html,/data-check-person="p1" checked disabled/);
 assert.equal(f.ui.busy,false);
});

test('A check synchronizes all three supported subjects and reads differences without changing any grant',async t=>{
 const otherSubjects=[],contexts=[];
 const f=setup(t,{openShareSubject:async subject=>{
  otherSubjects.push(subject);
  const context={store:{doc:{pending:[]},data:{settings:{},collections:{},words:{}}},sync:{status:'synced',run:async()=>{}}};
  contexts.push(context);return context;
 }});
 await openChecker(f);await check(f,[diff('d1')]);
 assert.deepEqual(otherSubjects,['english','french']);
 assert.deepEqual(f.requests.map(request=>request.action),['profiles','autoShareCheck']);
 assert.deepEqual(f.requests[1].args,{profileIds:['p1','p2']});
 assert.match(f.views.at(-1).html,/1 Unterschiede/);
 assert.equal(f.ui.busy,false);
});

test('Only selected differences are applied and excluded changes remain scoped to the recipient',async t=>{
 const f=setup(t);await openChecker(f);await check(f,[diff('d1'),diff('d2','p2')]);
 f.ui.change({dataset:{checkDiff:'d1'},checked:false});
 await f.action('check-apply');await tick();
 const apply=f.requests.find(request=>request.action==='autoShareApply');
 assert.deepEqual(apply.args.differenceIds,['d2']);
 apply.resolve({ok:true});await tick();
 const recheck=f.requests.filter(request=>request.action==='autoShareCheck').at(-1);
 recheck.resolve({differences:[diff('d1'),diff('d2','p2')],checkedAt:1235});await tick();
 const html=f.views.at(-1).html;
 assert.match(html,/data-check-diff="d2" checked/);
 assert.doesNotMatch(html,/data-check-diff="d1" checked/);
});

test('A completed check never returns the user to the checker after switching tabs',async t=>{
 const f=setup(t);await openChecker(f);
 await f.action('check-run');await tick();
 const request=f.requests.find(request=>request.action==='autoShareCheck');
 f.navigate('people');const count=f.views.length;
 request.resolve({differences:[diff('d1')],checkedAt:1234});await tick();
 assert.equal(f.views.length,count);assert.equal(f.visible,'people');assert.equal(f.ui.busy,false);
});

test('Required parent selection affects only the matching recipient and subject',()=>{
 const differences=[
  {id:'p1-parent',profileId:'p1',subject:'latin',resourceId:'c',key:'deck',parentMissing:true},
  {id:'p1-word',profileId:'p1',subject:'latin',resourceId:'c',key:'word',parentMissing:true},
  {id:'p2-parent',profileId:'p2',subject:'latin',resourceId:'c',key:'deck',parentMissing:true},
  {id:'p2-word',profileId:'p2',subject:'latin',resourceId:'c',key:'word',parentMissing:true}
 ],selected=new Set();
 adjustDifferenceSelection(differences,selected,'p2-word',true);
 assert.deepEqual([...selected].sort(),['p2-parent','p2-word']);
 adjustDifferenceSelection(differences,selected,'p1-parent',false);
 assert.deepEqual([...selected].sort(),['p2-parent','p2-word']);
});

test('Automatic sharing rows go straight to the checker; manual editing waits for current data',()=>{
 const resources=[{id:'c',key:'c',name:'Lektion',resourceKind:'lesson',label:'Vokabeln',count:1,automatic:true},{id:'r',key:'r',name:'Wiederholen',resourceKind:'refresh',label:'Auffrischen',count:1}];
 const html=accessOverview(resources,{},people,h,{ready:false});
 assert.match(html,/data-action="sharing-check" data-id="c"/);
 assert.doesNotMatch(html,/data-action="access-edit" data-id="c"/);
 assert.match(html,/data-action="access-edit" data-id="r" disabled/);
});

test('Directory loading failures offer a retry and subject switching does not trap navigation',async t=>{
 let release;
 const f=setup(t,{openShareSubject:()=>new Promise(resolve=>{release=resolve;})});
 await f.action('share-panel');f.requests[0].reject(Error('Offline'));f.requests[1].resolve({shares:[]});await tick();
 assert.match(f.nodes.get('[data-directory-status]').innerHTML,/data-action="share-panel"/);
 assert.match(f.nodes.get('[data-directory-status]').innerHTML,/Erneut versuchen/);
 assert.equal(await f.action('share-subject','english'),true);
 assert.match(f.views.at(-1).html,/Freigaben · Englisch/);
 f.navigate('messages');const count=f.views.length;
 release({store:f.store,sync:f.sync});await tick();
 assert.equal(f.views.length,count);assert.equal(f.visible,'messages');
});

test('Saving unchanged recipients sends no mutation; explicit removal sends only the removed recipient',async t=>{
 const f=setup(t),grants=people.map(person=>({resourceKind:'refresh',sourceId:'r',profileId:person.id}));
 await loadShares(f,grants);
 formData(t,['p1','p2']);
 const form=accessForm([{resourceKind:'refresh',sourceId:'r',name:'Auffrischen'}]);
 await f.ui.submit(form);await tick();
 assert.equal(f.requests.filter(request=>request.action==='collectionAccessSet').length,0);
 assert.match(form.status.textContent,/Keine Änderungen/);
 globalThis.FormData=class{get(){return null;}getAll(){return ['p1'];}};
 await f.ui.submit(form);await tick();
 const mutation=f.requests.find(request=>request.action==='collectionAccessSet');
 assert.deepEqual(mutation.args,{resourceKind:'refresh',sourceId:'r',name:'Auffrischen',profileId:'p2',enabled:false});
 mutation.resolve({ok:true});await tick();
 f.requests.filter(request=>request.action==='shareList').at(-1).resolve({shares:[],resourceShares:[grants[0]],accessSchema:2});await tick();
 assert.equal(f.requests.filter(request=>request.action==='collectionAccessSet').length,1);
});

test('Student handlers cannot open admin views or submit management mutations',async t=>{
 const f=setup(t,{role:'student'});
 for(const action of ['sharing-check','check-run','check-apply','account-profiles','share-panel','profile-view','profile-delete','profile-new-toggle','access-edit','share-subject']){
  assert.equal(await f.action(action,'p1'),true);
 }
 for(const id of ['access-editor','profile-create','profile-edit-form','profile-delete','share-revoke'])assert.equal(await f.ui.submit({id,dataset:{}}),true);
 assert.equal(await f.action('share-notices-read'),false,'normal user notices belong to the main handler');
 assert.equal(await f.action('nav'),false);
 assert.equal(f.requests.length,0);assert.equal(f.views.length,0);assert.equal(f.modals.length,0);
});

test('Removing access from an unshared, subject-restricted recipient is a harmless no-op',async t=>{
 const f=setup(t);
 await f.action('share-panel');
 f.requests[0].resolve({profiles:[{...people[0],allowedSubjects:['english']}]});
 f.requests[1].resolve({shares:[],resourceShares:[],accessSchema:2});await tick();
 formData(t,['p1'],'remove');
 const form=accessForm([{resourceKind:'refresh',sourceId:'r1',name:'A'},{resourceKind:'refresh',sourceId:'r2',name:'B'}]);
 await f.ui.submit(form);await tick();
 assert.match(form.status.textContent,/Keine Änderungen/);
 assert.equal(f.requests.filter(request=>request.action==='collectionAccessSet').length,0);
});

test('Profile dialogs offer explicit cancel and detail pages a return to the same management area',async t=>{
 const f=setup(t);
 await f.action('account-profiles');f.requests[0].resolve({profiles:people});await tick();
 for(const request of f.requests.filter(request=>request.action==='profileActivity'))request.resolve({events:[]});
 await tick();
 await f.action('profile-new-toggle');
 assert.match(f.modals.at(-1),/Nutzer anlegen/);assert.match(f.modals.at(-1),/data-action="close-modal">Abbrechen/);
 await f.action('profile-edit','p1');assert.match(f.modals.at(-1),/data-action="close-modal">Abbrechen/);
 await f.action('profile-delete','p1');assert.match(f.modals.at(-1),/data-action="close-modal">Abbrechen/);
 await f.action('profile-view','p1');assert.equal(f.views.at(-1).tab,'people');assert.match(f.views.at(-1).html,/← Alle Nutzer/);
});

test('Checker handling stays synchronous even while an asynchronous request is pending',t=>{
 environment(t);let calls=0;
 const checker=sharingCheck({sync:{request(){calls++;return new Promise(()=>{});}},h,showAdmin(){},prepare:async()=>{},notify(){}});
 assert.equal(checker.handle({dataset:{action:'sharing-check'}}),true);
 assert.equal(checker.busy,true);assert.equal(calls,1);
 assert.equal(checker.handle({dataset:{action:'not-a-checker-action'}}),false);
});

test('A late profile edit does not reopen administration after its dialog was closed',async t=>{
 const f=setup(t),original=globalThis.FormData;
 globalThis.FormData=class{get(key){return key==='name'?'Anna Neu':'anna@example.invalid';}getAll(){return ['latin'];}has(){return false;}};
 t.after(()=>{globalThis.FormData=original;});
 const message={isConnected:true,textContent:''},button={isConnected:false,disabled:false};
 const form={id:'profile-edit-form',dataset:{id:'p1'},isConnected:false,querySelector:selector=>selector==='[data-save-status]'?message:button};
 f.navigate('messages');const count=f.views.length;
 await f.ui.submit(form);await tick();
 f.requests[0].resolve({profile:{...people[0],name:'Anna Neu'}});await tick();
 assert.equal(f.views.length,count);assert.equal(f.visible,'messages');assert.equal(f.modals.length,0);
 assert.ok(f.notices.includes('Nutzer aktualisiert.'));
});

test('A late access-code response stays in memory and can be shown without reopening another screen',async t=>{
 const f=setup(t);formData(t,[]);
 await f.action('account-profiles');f.requests[0].resolve({profiles:people});await tick();
 for(const request of f.requests.filter(request=>request.action==='profileActivity'))request.resolve({events:[]});await tick();
 const message={isConnected:false,textContent:''},button={isConnected:false,disabled:false};
 const form={id:'profile-code-form',dataset:{id:'p1'},isConnected:false,querySelector:selector=>selector==='[data-save-status]'?message:button};
 f.navigate('messages');const count=f.views.length;
 await f.ui.submit(form);await tick();
 const secret='CODE-ONLY-IN-MEMORY';
 f.requests.find(request=>request.action==='profileCodeGenerate').resolve({profile:people[0],code:secret});await tick();
 assert.equal(f.views.length,count);assert.equal(f.visible,'messages');assert.equal(f.modals.length,0);
 assert.ok(!JSON.stringify(f.store.doc).includes(secret));
 await f.action('admin-person','p1');assert.match(f.views.at(-1).html,/Neuen Code anzeigen/);
 await f.action('profile-code-show','p1');assert.ok(f.modals.at(-1).includes(secret));
});
