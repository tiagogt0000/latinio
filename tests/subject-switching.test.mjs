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
 const veil={setAttribute(){},querySelector:()=>({animate}),animate,remove(){calls.push('dispose');}};
 const document={documentElement:{},defaultView:{setTimeout:setTimer,clearTimeout:clearTimer,matchMedia:()=>({matches:reducedMotion,addEventListener(){},removeEventListener(){}})},createElement:()=>veil,body:{append(){calls.push('begin');}}};
 const app={ownerDocument:document};
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
 assert.equal(f.calls.some(call=>Array.isArray(call)&&call[0]==='navigate'),false,'the visible icon transition finishes before navigation');
 assert.equal(f.animations.length,2);
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
test('Boot consumes keyboard intent once and uses it for both startup arrival calls',()=>{
 const start=source.indexOf('let directKeyboard;'),end=source.indexOf('subject=direct',start);
 const consume=source.slice(start,end)+';directKeyboard';
 assert.ok(start>=0&&end>start);
 const sessionStorage=storage();sessionStorage.setItem('latinio-subject-keyboard','1');
 assert.equal(vm.runInNewContext(consume,{direct:'english',sessionStorage}),true);
 assert.equal(sessionStorage.getItem('latinio-subject-keyboard'),null);
 assert.equal(vm.runInNewContext(consume,{direct:null,sessionStorage}),undefined,'initial selection keeps its local keyboard intent');
 assert.equal(source.match(/arrive\(app,\{keyboard:directKeyboard\}\)/g)?.length,2);
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

test('Unavailable subjects and the already selected subject do not start a transition',async t=>{
 const f=fixture(t,{allowed:['latin']});
 for(const subject of ['latin','english','french','missing'])await f.click(subject);
 assert.ok(!f.calls.includes('begin'));assert.equal(f.sessionStorage.getItem(SUBJECT_SWITCH_KEY),null);
 assert.equal(f.localStorage.getItem(LAST_SUBJECT_KEY),null);assert.equal(f.context.working,false);
});

test('A stalled icon animation cannot prevent the actual action from navigating',async t=>{
 const f=fixture(t),switching=f.click();await flush();
 const timeout=[...f.timers.values()].find(timer=>timer.delay>140);
 assert.ok(timeout,'a finite transition fallback is registered');timeout.callback();await switching;
 assert.ok(f.calls.some(call=>Array.isArray(call)&&call[0]==='navigate'));assert.equal(f.context.working,false);
});

test('Navigation failure removes the loading surface and releases the action lock',async t=>{
 const f=fixture(t,{reducedMotion:true,navigationError:true});await f.click();
 assert.ok(f.calls.includes('dispose'));assert.equal(f.context.subjectTransition,null);assert.equal(f.context.working,false);
 assert.ok(f.calls.some(call=>Array.isArray(call)&&call[0]==='notice'&&call[1]==='Navigation failed'));
});
