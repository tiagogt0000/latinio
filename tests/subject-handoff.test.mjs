import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const bootstrap=html.match(/<script>([\s\S]*?)<\/script>/)[1];
const main=fs.readFileSync(new URL('../app/main.js',import.meta.url),'utf8');
const boot=main.slice(main.indexOf('async function boot()'),main.indexOf('// Keep the browser chrome'));

function fixture({from='latin',to='english',keyboard=false,reducedMotion=false,dark=false,storageError=false,mediaAPI=true}={}){
 const nodes=new Map(),listeners=new Map(),timers=[];
 const values=new Map([['latinio-brand-transition',from],['latinio-direct-subject-switch',to],['latinio-subject-keyboard',keyboard?'1':'0']]);
 const before=[...values];
 const app={attributes:new Map(),boot:true,innerHTML:'',setAttribute(name,value){this.attributes.set(name,value);},removeAttribute(name){this.attributes.delete(name);},querySelector(selector){return selector==='.boot'&&this.boot?{textContent:'Deine Vokabeln werden geladen …'}:null;}};
 nodes.set('app',app);
 const document={documentElement:{dataset:{}},getElementById:id=>nodes.get(id),body:{append(element){element.themeAtAppend={...document.documentElement.dataset};nodes.set(element.id,element);}},createElement(){return {attributes:new Map(),setAttribute(name,value){this.attributes.set(name,value);},remove(){nodes.delete(this.id);}};}};
 const window={addEventListener(name,callback){listeners.set(name,callback);}};
 if(mediaAPI)window.matchMedia=query=>({matches:query==='(prefers-color-scheme: dark)'?dark:reducedMotion});
 const sessionStorage={getItem(key){if(storageError)throw Error('Storage unavailable');return values.get(key)??null;},setItem(){throw Error('Preboot must not mutate routing state');},removeItem(){throw Error('Preboot must not consume routing state');}};
 vm.runInNewContext(bootstrap,{document,window,sessionStorage,navigator:{},location:{protocol:'https:'},setTimeout(callback,delay){timers.push({callback,delay});}});
 return {app,nodes,listeners,timers,values,before,document};
}

test('The inline reload handoff preserves the destination wordmark before the application module starts',()=>{
 assert.ok(html.indexOf(bootstrap)<html.indexOf('<script type="module"'),'handoff runs before module evaluation');
 for(const [from,to,label] of [['latin','english','Englisch'],['english','french','Französisch'],['french','latin','Latein']]){
  const f=fixture({from,to}),handoff=f.nodes.get('subject-transition-handoff');
  assert.ok(handoff);assert.equal(handoff.className,'subject-transition');
  assert.equal(handoff.attributes.get('data-from'),from);assert.equal(handoff.attributes.get('data-to'),to);
  assert.equal(handoff.attributes.get('role'),'status');assert.equal(handoff.attributes.get('aria-live'),'polite');
  assert.equal(handoff.attributes.get('aria-busy'),'true');assert.ok(f.app.attributes.has('data-subject-handoff'));
  assert.match(handoff.innerHTML,/subject-transition-backdrop/);
  assert.match(handoff.innerHTML,new RegExp(`is-to" data-subject="${to}">latinio<span>✦</span>`));
  assert.match(handoff.innerHTML,new RegExp(`${label} wird geladen`));assert.doesNotMatch(handoff.innerHTML,/<img/);
  assert.deepEqual([...f.values],f.before,'the application must still consume the original route and input intent');
 }
});

test('Initial startup, same-subject and invalid persisted routes never create a handoff',()=>{
 for(const options of [{from:null,to:null},{from:null},{to:null},{from:'english',to:'english'},{from:'retired-subject'},{to:'unknown'},{from:'__proto__'},{to:'constructor'},{to:'"><img src=x>'}]){
  const f=fixture(options);assert.equal(f.nodes.has('subject-transition-handoff'),false);assert.equal(f.app.attributes.has('data-subject-handoff'),false);assert.deepEqual([...f.values],f.before);assert.deepEqual(f.document.documentElement.dataset,{});
 }
});

test('Keyboard and reduced-motion navigation keep normal immediate startup',()=>{
 for(const options of [{keyboard:true},{reducedMotion:true}]){
  const f=fixture(options);assert.equal(f.nodes.has('subject-transition-handoff'),false);assert.equal(f.app.attributes.has('data-subject-handoff'),false);assert.deepEqual(f.document.documentElement.dataset,{});
 }
 assert.ok(fixture({mediaAPI:false}).nodes.has('subject-transition-handoff'),'unavailable media queries cannot break startup');
});

test('Reload handoffs apply the target tint and current system appearance before the first visible frame',()=>{
 for(const dark of [false,true])for(const to of ['english','french']){
  const f=fixture({dark,to}),expected={theme:dark?'dark':'light',subject:to};
  assert.deepEqual(f.nodes.get('subject-transition-handoff').themeAtAppend,expected);
  assert.deepEqual(f.document.documentElement.dataset,expected);
  assert.deepEqual([...f.values],f.before,'appearance initialization never writes preferences or route state');
 }
});

test('Storage failure leaves the ordinary boot screen and its recovery active',()=>{
 const f=fixture({storageError:true});assert.equal(f.nodes.has('subject-transition-handoff'),false);assert.equal(f.app.attributes.has('data-subject-handoff'),false);
 assert.ok(f.listeners.has('error'));assert.equal(f.timers[0].delay,20000);
 f.timers[0].callback();assert.match(f.app.innerHTML,/Latinio startet nicht weiter/);
});

test('Boot errors and timeout remove the handoff before revealing recovery controls',()=>{
 for(const kind of ['error','timeout']){
  const f=fixture();assert.ok(f.nodes.has('subject-transition-handoff'));
  if(kind==='error')f.listeners.get('error')();else f.timers[0].callback();
  assert.equal(f.nodes.has('subject-transition-handoff'),false);assert.equal(f.app.attributes.has('data-subject-handoff'),false);
  assert.match(f.app.innerHTML,/Latinio startet nicht weiter/);assert.match(f.app.innerHTML,/Erneut laden/);
 }
});

test('Late boot watchdogs never replace an already rendered screen or its ongoing arrival',()=>{
 const f=fixture();f.app.boot=false;f.app.innerHTML='<main>Deine Sammlungen</main>';
 f.listeners.get('error')();f.timers[0].callback();assert.equal(f.app.innerHTML,'<main>Deine Sammlungen</main>');
 assert.ok(f.nodes.has('subject-transition-handoff'),'the transition controller owns cleanup after the app renders');
});

test('Module startup failures reveal recovery even before a transition controller can adopt the handoff',async()=>{
 for(const phase of ['before-controller','after-controller']){
  const f=fixture(),calls=[];
  const context=vm.createContext({
   app:f.app,document:f.document,subjectTransition:null,subject:'latin',english:false,
   URLSearchParams,location:{search:'?subject=english'},SUBJECTS:[{id:'latin'},{id:'english'},{id:'french'}],
   consumeSubjectSwitch:()=> 'english',TRANSITION_KEY:'latinio-brand-transition',localStorage:{},
   sessionStorage:{getItem:key=>f.values.get(key)??null,removeItem(){}},
   rememberSubject(){if(phase==='before-controller')throw Error('Preference storage unavailable');},
   beginSubjectTransition(){calls.push('created');return {fail(){calls.push('failed');}};},
   subjectMetadata(){},openAccount:async()=>{throw Error('Local account unavailable');},h:value=>String(value),
  });
  await vm.runInContext(boot+'\nboot();',context);
  assert.deepEqual(calls,phase==='before-controller'?[]:['created','failed']);
  assert.equal(context.subjectTransition,null);assert.equal(f.nodes.has('subject-transition-handoff'),false);
  assert.equal(f.app.attributes.has('data-subject-handoff'),false);
  assert.match(f.app.innerHTML,/Die App konnte nicht starten/);assert.match(f.app.innerHTML,/Erneut laden/);
 }
});

test('An allowed-subject fallback removes the wrong destination wordmark before changing the subject metadata',()=>{
 const start=boot.indexOf(" if(profile.role!=='admin'&&Array.isArray(profile.allowedSubjects)"),end=boot.indexOf("\n if(subject!=='latin')",start);
 assert.ok(start>=0&&end>start);
 for(const hasController of [false,true]){
  const f=fixture({to:'french'}),calls=[];
  const context=vm.createContext({
   app:f.app,document:f.document,subject:'french',english:true,
   profile:{role:'student',allowedSubjects:['english']},SUBJECTS:[{id:'latin'},{id:'english'},{id:'french'}],localStorage:{},
   subjectTransition:hasController?{dispose(){calls.push('disposed');}}:null,
   rememberSubject(subject){calls.push('remember:'+subject);},
   subjectMetadata(){
    assert.equal(f.nodes.has('subject-transition-handoff'),false);assert.equal(f.app.attributes.has('data-subject-handoff'),false);
    calls.push('metadata');
   },
  });
  vm.runInContext(boot.slice(start,end),context);
  assert.equal(context.subject,'english');assert.equal(context.english,true);assert.equal(context.subjectTransition,null);
  assert.deepEqual(calls,[...(hasController?['disposed']:[]),'remember:english','metadata']);
 }
});
