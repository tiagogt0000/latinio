import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {subjectInfo} from '../app/subjects.js';

const source=fs.readFileSync(new URL('../app/main.js',import.meta.url),'utf8');
function fixture({dark=false,mode='system',account=false}={}){
 const meta={content:'old'},favicon={href:''},dataset={},listeners=new Map(),media={matches:dark,addEventListener:(type,handler)=>listeners.set(type,handler)};
 let preference=mode,booted=false;
 const context=vm.createContext({
  document:{documentElement:{dataset},querySelector:selector=>selector==='meta[name="theme-color"]'?meta:favicon,title:''},
  store:account?{}:null,prefs:()=>({theme:preference}),subject:'latin',english:false,
  matchMedia:()=>media,subjectInfo,languageName:()=>subjectInfo(context.subject).label,
  rememberSubject(){},localStorage:{},boot(){booted=true;assert.notEqual(meta.content,'old','apply theme before asynchronous startup');},
 });
 vm.runInContext(source.slice(source.indexOf('function applyColorScheme('),source.indexOf('function nav(')),context);
 vm.runInContext(source.split('\n').find(line=>line.startsWith('function subjectMetadata(')),context);
 return {context,meta,favicon,dataset,media,listeners,setMode:value=>{preference=value;},get booted(){return booted;}};
}

test('Page colors and browser chrome follow the selected mode together for every subject',()=>{
 for(const subject of ['latin','english','french'])for(const dark of [false,true])for(const mode of ['system','light','dark']){
  const f=fixture({dark,mode,account:true});f.context.subject=subject;f.context.subjectMetadata();
  const resolved=mode==='system'?(dark?'dark':'light'):mode;
  assert.equal(f.dataset.theme,resolved);assert.equal(f.meta.content,resolved==='dark'?'#1c1c1e':'#fafafc');
  assert.equal(f.dataset.subject,subject);assert.equal(f.favicon.href,subjectInfo(subject).logo);
 }
});

test('OS color changes update the page and chrome before account loading and after startup',()=>{
 const f=fixture({dark:true});
 vm.runInContext(source.slice(source.indexOf('// Keep the browser chrome in sync')),f.context);
 assert.equal(f.booted,true);assert.equal(f.meta.content,'#1c1c1e');assert.equal(f.dataset.theme,'dark');
 f.media.matches=false;f.listeners.get('change')();
 assert.equal(f.meta.content,'#fafafc');assert.equal(f.dataset.theme,'light');
 f.context.store={};f.media.matches=true;f.listeners.get('change')();
 assert.equal(f.meta.content,'#1c1c1e');assert.equal(f.dataset.theme,'dark');
 f.setMode('light');f.listeners.get('change')();
 assert.equal(f.meta.content,'#fafafc');assert.equal(f.dataset.theme,'light','an explicit mode wins over the OS');
});

test('A subject-permission fallback reuses the same theme and metadata path',()=>{
 const f=fixture({dark:true});f.context.subject='english';f.context.english=true;f.context.profile={role:'student',allowedSubjects:['french']};
 const start=source.indexOf(" if(profile.role!=='admin'&&Array.isArray(profile.allowedSubjects)");
 const end=source.indexOf(" if(subject!=='latin'){",start);
 vm.runInContext(source.slice(start,end),f.context);
 assert.equal(f.context.subject,'french');assert.equal(f.favicon.href,subjectInfo('french').logo);
 assert.equal(f.context.document.title,'Vocabify · Französisch lernen');
 assert.equal(f.meta.content,'#1c1c1e');assert.equal(f.dataset.theme,'dark');
});
