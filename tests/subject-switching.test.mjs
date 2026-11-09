import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {SUBJECTS,beginSubjectTransition,TRANSITION_KEY} from '../app/subjects.js';
import {consumeSubjectSwitch,SUBJECT_SWITCH_KEY} from '../app/subject-entrance.js';
import {rememberSubject,LAST_SUBJECT_KEY} from '../app/subject-preference.js';

const source=fs.readFileSync(new URL('../app/main.js',import.meta.url),'utf8');
const actions=source.slice(source.indexOf('async function actions('),source.indexOf("document.addEventListener('click',event=>"));
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
const storage=()=>{const items=new Map();return {getItem:key=>items.get(key)??null,setItem:(key,value)=>items.set(key,String(value)),removeItem:key=>items.delete(key)};};

function fixture(t,{reducedMotion=false,allowed=['latin','english'],navigationError=false}={}){
 const calls=[],animations=[],timers=new Map(),localStorage=storage(),sessionStorage=storage();
 let timerId=0;
 const setTimer=(callback,delay)=>{timers.set(++timerId,{callback,delay});return timerId;};
 const clearTimer=id=>timers.delete(id);
 const animate=()=>{let resolve;const animation={finished:new Promise(done=>resolve=done),finish:()=>resolve(),cancel:()=>resolve()};animations.push(animation);return animation;};
 const veil={setAttribute(){},removeAttribute(){},querySelector:()=>({animate}),animate,remove(){calls.push('dispose');}};
 const document={hidden:false,visibilityState:'visible',documentElement:{},getElementById:()=>null,addEventListener(){},removeEventListener(){},defaultView:{setTimeout:setTimer,clearTimeout:clearTimer,addEventListener(){},removeEventListener(){},matchMedia:()=>({matches:reducedMotion,addEventListener(){},removeEventListener(){}})},createElement:()=>veil,body:{append(){calls.push('begin');}}};
 const app={ownerDocument:document,removeAttribute(){}};
 const doc={pending:[{id:'saved-review',entity:'reviews'}],session:{id:'round',answers:['amavi']}};
 const context=vm.createContext({vocabularyAdminUI:null,simpleMode:()=>false,flushCloudRender(){},
  app,document,URL,localStorage,sessionStorage,rememberSubject,TRANSITION_KEY,SUBJECT_SWITCH_KEY,beginSubjectTransition,
  subject:'latin',subjectTransition:null,ready:true,working:false,waitingStart:false,screen:'learn',
  subjectAllowed:id=>SUBJECTS.some(item=>item.id===id)&&allowed.includes(id),
  collectionOpener:{cancel(){}},tablePractice:null,grammar:null,reminders:null,
  store:{doc},sync:{busy:true},cloudWait:{blocked:true,wait(){throw Error('Subject navigation waited for initial sync');}},
  settleSync(){throw Error('Subject navigation waited for cloud reconciliation');},
  sharing:{handle:async()=>false,afterAction(){}},
  location:{href:'https://example.test/app/?subject=latin&keep=1#home',assign(url){if(navigationError)throw Error('Navigation failed');calls.push(['navigate',url]);}},
  setTimeout:setTimer,clearTimeout:clearTimer,closeModal(){calls.push('close');},checkShareNotices(){},autoUpdate(){},notify:message=>calls.push(['notice',message]),
 });
 vm.runInContext(actions,context);
 function click(id='english',detail=1){
  const button={dataset:{action:'switch-subject',id},isConnected:true,removeAttribute(){},closest:()=>({removeAttribute:name=>calls.push(['details',name])})};
  return context.actions({detail,preventDefault(){},target:{closest:()=>button}});
 }
 t.after(()=>context.subjectTransition?.dispose());
 return {context,calls,animations,timers,localStorage,sessionStorage,doc,click};
}

test('Actual subject action shows transition before waiting, preserves local work and bypasses cloud sync',async t=>{
 const f=fixture(t),saved=structuredClone(f.doc);
 const switching=f.click();await flush();
 assert.ok(f.calls.includes('begin'),'the loading surface appears while cloud sync remains pending');
 assert.equal(f.calls.some(call=>Array.isArray(call)&&call[0]==='navigate'),false,'the written wordmark transition finishes before navigation');
 assert.equal(f.animations.length,3,'background, outgoing wordmark and incoming wordmark animate independently');
 assert.equal(f.localStorage.getItem(LAST_SUBJECT_KEY),'english');
 assert.equal(f.sessionStorage.getItem(TRANSITION_KEY),'latin');
 assert.equal(f.sessionStorage.getItem(SUBJECT_SWITCH_KEY),'english');
 assert.deepEqual(f.doc,saved,'navigation must neither clear saved answers nor drain the pending journal');
 f.animations.forEach(animation=>animation.finish());await switching;
 const target=new URL(f.calls.find(call=>Array.isArray(call)&&call[0]==='navigate')[1]);
 assert.equal(target.searchParams.get('subject'),'english');assert.equal(target.searchParams.get('keep'),'1');assert.equal(target.hash,'#home');
 assert.equal(consumeSubjectSwitch(f.sessionStorage),'english');assert.equal(consumeSubjectSwitch(f.sessionStorage),null);
 assert.equal(f.context.working,false);
});

test('Reduced-motion and keyboard switches navigate without animation or timer waits',async t=>{
 for(const options of [{reducedMotion:true,detail:1},{reducedMotion:false,detail:0}]){
  const f=fixture(t,options);await f.click('english',options.detail);
  assert.equal(f.animations.length,0);assert.equal(f.timers.size,0);
  assert.ok(f.calls.some(call=>Array.isArray(call)&&call[0]==='navigate'));
  assert.equal(f.sessionStorage.getItem('latinio-subject-keyboard'),options.detail===0?'1':'0','the destination retains input intent for its arrival');
  assert.equal(f.context.working,false);
 }
});
test('Boot consumes direct-switch keyboard intent once without inventing picker intent',()=>{
 const start=source.indexOf('let directKeyboard;'),end=source.indexOf('const selectedAtEntrance',start);
 const consume=source.slice(start,end)+';directKeyboard';
 assert.ok(start>=0&&end>start);
 const sessionStorage=storage();sessionStorage.setItem('latinio-subject-keyboard','1');
 assert.equal(vm.runInNewContext(consume,{direct:'english',sessionStorage}),true);
 assert.equal(sessionStorage.getItem('latinio-subject-keyboard'),null);
 assert.equal(vm.runInNewContext(consume,{direct:null,sessionStorage}),undefined,'initial selection keeps its local keyboard intent');
});

test('Duplicate switching clicks cannot replace the pending subject or navigate twice',async t=>{
 const f=fixture(t),first=f.click();await flush();await f.click('latin');
 assert.equal(f.calls.filter(call=>call==='begin').length,1);
 assert.equal(f.sessionStorage.getItem(SUBJECT_SWITCH_KEY),'english');
 f.animations.forEach(animation=>animation.finish());await first;
 assert.equal(f.calls.filter(call=>Array.isArray(call)&&call[0]==='navigate').length,1);
});

test('An active subject transition blocks navigation and admin actions until the destination loads',async t=>{
 const f=fixture(t),switching=f.click();await flush();
 f.context.isAdmin=()=>true;
 f.context.render=()=>{throw Error('Navigation rendered over an active subject transition');};
 f.context.sharing.handle=()=>{throw Error('Admin navigation ran during a subject transition');};
 for(const dataset of [{action:'nav',screen:'settings'},{action:'nav',screen:'admin'},{action:'account-profiles'},{action:'collection-open',id:'lesson'}]){
  await f.context.actions({detail:1,preventDefault(){},target:{closest:()=>({dataset})}});
 }
 assert.equal(f.context.screen,'learn');assert.equal(f.context.working,true);
 assert.equal(f.calls.filter(call=>call==='begin').length,1);
 f.animations.forEach(animation=>animation.finish());await switching;
 assert.equal(f.calls.filter(call=>Array.isArray(call)&&call[0]==='navigate').length,1);
});
test('A ready destination accepts navigation immediately while the remaining backdrop fades',async t=>{
 const f=fixture(t);
 const transition=beginSubjectTransition(f.context.app,'latin','english');f.context.subjectTransition=transition;
 f.animations.forEach(animation=>animation.finish());await transition.entered;
 const closing=transition.finish();assert.equal(transition.closing,true);
 f.context.render=()=>f.calls.push('render');
 await f.context.actions({detail:1,preventDefault(){},target:{closest:()=>({dataset:{action:'nav',screen:'settings'}})}});
 await closing;
 assert.equal(f.context.screen,'settings');assert.equal(f.context.subjectTransition,null);assert.ok(f.calls.includes('render'));
 assert.equal(f.timers.size,0,'the interrupted decorative exit releases its fallback timer');
});
test('A completed overlay cannot block controls while delayed destination cards are still arriving',async t=>{
 const f=fixture(t);
 const transition=beginSubjectTransition(f.context.app,'latin','english');f.context.subjectTransition=transition;
 f.animations.forEach(animation=>animation.finish());await transition.entered;
 const closing=transition.finish();f.animations.forEach(animation=>animation.finish());await closing;
 assert.equal(transition.disposed,true);assert.equal(transition.closing,false);
 f.context.arrivalPending=true;f.context.render=()=>f.calls.push('render');
 await f.context.actions({detail:1,preventDefault(){},target:{closest:()=>({dataset:{action:'nav',screen:'settings'}})}});
 assert.equal(f.context.screen,'settings');assert.equal(f.context.subjectTransition,null);assert.ok(f.calls.includes('render'));
});

test('Unavailable subjects and the already selected subject do not start a transition',async t=>{
 const f=fixture(t,{allowed:['latin']});
 for(const subject of ['latin','english','french','missing'])await f.click(subject);
 assert.ok(!f.calls.includes('begin'));assert.equal(f.sessionStorage.getItem(SUBJECT_SWITCH_KEY),null);
 assert.equal(f.localStorage.getItem(LAST_SUBJECT_KEY),null);assert.equal(f.context.working,false);
});

test('A stalled wordmark animation cannot prevent the actual action from navigating',async t=>{
 const f=fixture(t),switching=f.click();await flush();
 const timeout=[...f.timers.values()].find(timer=>timer.delay>=1020&&timer.delay<1500);
 assert.ok(timeout,'a finite transition fallback is registered');timeout.callback();await switching;
 assert.ok(f.calls.some(call=>Array.isArray(call)&&call[0]==='navigate'));assert.equal(f.context.working,false);
});

test('Navigation failure removes the loading surface and releases the action lock',async t=>{
 const f=fixture(t,{reducedMotion:true,navigationError:true});await f.click();
 assert.ok(f.calls.includes('dispose'));assert.equal(f.context.subjectTransition,null);assert.equal(f.context.working,false);
 assert.ok(f.calls.some(call=>Array.isArray(call)&&call[0]==='notice'&&call[1]==='Navigation failed'));
});

function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}

function bootStartFixture({direct=null,reminded=null,picker='latin',keyboard=false,login=false}={}){
 const calls=[],entry=deferred(),account=deferred(),sessionStorage=storage(),localStorage=storage();
 if(direct){sessionStorage.setItem(SUBJECT_SWITCH_KEY,direct);sessionStorage.setItem(TRANSITION_KEY,direct==='latin'?'english':'latin');sessionStorage.setItem('latinio-subject-keyboard',keyboard?'1':'0');}
 let loginNode;
 const app={innerHTML:'',removeAttribute(){},querySelector:selector=>selector==='.login-shell'?loginNode:null};
 const transition={entered:entry.promise,disposed:false,dispose(){this.disposed=true;entry.resolve();calls.push(['dispose']);},fail(){this.dispose();},finish(){calls.push(['finish']);this.disposed=true;return Promise.resolve();}};
 const location={search:reminded?`?from=reminder&subject=${reminded}`:direct?`?subject=${direct}`:'',href:'https://example.test/app/'};
 const context=vm.createContext({
  app,document:{getElementById:()=>null},subject:'latin',subjectTransition:null,english:false,SUBJECTS,URL,URLSearchParams,location,history:{replaceState(){}},
  sessionStorage,localStorage,consumeSubjectSwitch,TRANSITION_KEY,rememberSubject,queueMicrotask,
  chooseSubject:async()=>{calls.push(['choose']);return picker;},subjectChoiceUsesKeyboard:()=>keyboard,
  beginSubjectIntro(_root,subject,options){calls.push(['intro',subject,options]);return transition;},
  beginSubjectTransition(_root,from,to,options){calls.push(['switch',from,to,options]);return transition;},
  subjectMetadata(){calls.push(['metadata']);},
  openAccount(_root,{onLogin}){calls.push(['account']);if(login){onLogin();loginNode={style:{},isConnected:true};}return account.promise;},
  arrive(_root,options){calls.push(['arrive',options]);return Promise.resolve();},h:String,
 });
 const bootSource=source.slice(source.indexOf('async function boot()'),source.indexOf('// Keep the browser chrome'));
 const running=vm.runInContext(bootSource+'\nboot();',context);
 return {context,calls,entry,transition,get loginNode(){return loginNode;},async stop(){account.reject(Error('Controlled account stop'));await running;await flush();}};
}

test('Only a fresh picker selection starts the centered intro while local account preparation continues',async()=>{
 for(const options of [{picker:'french'},{picker:'english',keyboard:true},{direct:'english'},{direct:'french',keyboard:true},{reminded:'french'}]){
  const f=bootStartFixture(options);
  try{
   await flush();assert.ok(f.calls.some(call=>call[0]==='account'),'local preparation starts before the intro promise resolves');
   const intro=f.calls.find(call=>call[0]==='intro'),swap=f.calls.find(call=>call[0]==='switch');
   if(options.direct){assert.equal(intro,undefined);assert.equal(swap[2],options.direct);assert.equal(swap[3].resume,true);assert.equal(swap[3].keyboard,!!options.keyboard);}
   else if(options.reminded){assert.equal(intro,undefined);assert.equal(swap,undefined);assert.equal(f.calls.some(call=>call[0]==='choose'),false);}
   else{assert.equal(intro[1],options.picker);assert.equal(intro[2].keyboard,!!options.keyboard);assert.equal(swap,undefined);}
   assert.equal(f.calls.some(call=>call[0]==='arrive'),false,'no incomplete loading view starts the card wave');
  }finally{await f.stop();}
 }
});

test('The first login form waits under the intro and receives the original picker keyboard intent',async()=>{
 for(const keyboard of [false,true]){
  const f=bootStartFixture({picker:'french',keyboard,login:true});
  try{
   await flush();assert.equal(f.loginNode.style.visibility,'hidden');assert.equal(f.transition.disposed,false);
   assert.equal(f.calls.some(call=>call[0]==='arrive'),false);
   f.entry.resolve();await flush();assert.equal(f.loginNode.style.visibility,'');
   const arrival=f.calls.find(call=>call[0]==='arrive');assert.equal(arrival[1].keyboard,keyboard);assert.equal(arrival[1].delay,300);
   assert.equal(f.calls.filter(call=>call[0]==='finish').length,1);assert.equal(f.context.subjectTransition,null);
  }finally{await f.stop();}
 }
});

test('A login replaced during the intro never animates its replacement or leaves a pending transition',async()=>{
 for(const replacedController of [false,true]){
  const f=bootStartFixture({picker:'english',login:true}),replacement={fail(){}};
  try{
   await flush();f.loginNode.isConnected=false;if(replacedController)f.context.subjectTransition=replacement;
   f.entry.resolve();await flush();
   assert.equal(f.loginNode.style.visibility,'');assert.equal(f.transition.disposed,true);assert.equal(f.context.subjectTransition,replacedController?replacement:null);
   assert.equal(f.calls.some(call=>call[0]==='arrive'||call[0]==='finish'),false);
  }finally{await f.stop();}
 }
});

test('Direct-switch login keeps its immediate cleanup and never waits for a new centered intro',async()=>{
 const f=bootStartFixture({direct:'english',login:true,keyboard:true});
 try{
  await flush();assert.equal(f.transition.disposed,true);assert.equal(f.context.subjectTransition,null);
  assert.equal(f.calls.some(call=>call[0]==='intro'),false);assert.equal(f.loginNode.style.visibility,undefined);
  const arrival=f.calls.find(call=>call[0]==='arrive');assert.equal(arrival[1].keyboard,true);
 }finally{await f.stop();}
});

test('Cloud loading starts during the intro but the first render waits and background renders wait through arrival',async()=>{
 const start=source.indexOf(' const startup=cloudWait.run();'),end=source.indexOf(' void startup.then(',start);
 assert.ok(start>=0&&end>start);
 const calls=[],entry=deferred(),cloud=deferred(),arrival=deferred(),closing=deferred();
 const transition={entered:entry.promise,disposed:false,finish(){calls.push('finish');return closing.promise;}};
 const context=vm.createContext({
  cloudWait:{run(){calls.push('cloud');return cloud.promise;}},subjectTransition:transition,ready:false,arrivalPending:false,directKeyboard:false,
  reminders:{refresh(){calls.push('reminders');return Promise.resolve();},maybePrompt(){}},render(){calls.push('render');},app:{removeAttribute(){}},
  arrive(_app,options){calls.push(['arrival',options]);return arrival.promise;},flushCloudRender(){calls.push('flush');},
 });
 const running=vm.runInContext('(async()=>{'+source.slice(start,end)+'})()',context);
 await flush();assert.deepEqual(calls,['cloud']);assert.equal(context.ready,false);
 entry.resolve();await running;await flush();assert.equal(context.ready,true);assert.equal(context.arrivalPending,true);
 assert.ok(calls.includes('render'));assert.equal(calls.find(call=>Array.isArray(call))[1].delay,300);
 assert.equal(calls.includes('flush'),false);
 closing.resolve();await flush();assert.equal(context.arrivalPending,true,'decorative overlay completion must not replace still-arriving content');
 arrival.resolve();await flush();assert.equal(context.arrivalPending,false);assert.equal(context.subjectTransition,null);assert.ok(calls.includes('flush'));
});
