import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../app/main.js',import.meta.url),'utf8');
function functionLine(name){
  const line=source.split('\n').find(line=>line.startsWith(`function ${name}(`)||line.startsWith(`async function ${name}(`));
  assert(line,`${name} exists`);return line;
}

test('an announcement response started in classic cannot interrupt a subsequently opened landscape',async()=>{
  let finish;const displayed=[];
  const pending=new Promise(resolve=>{finish=resolve;});
  const context=vm.createContext({screen:'learn',cloudWait:{blocked:false},ready:true,
    sync:{configured:true,request:()=>pending},navigator:{onLine:true},announcementLoading:false,
    modalRoot:{children:[]},announcementQueue:[],working:false,waitingStart:false,
    announcementView:item=>displayed.push(item),reminders:{maybePrompt(){}}});
  vm.runInContext(functionLine('checkAnnouncements'),context);
  const task=context.checkAnnouncements();context.screen='landscape';
  finish({announcements:[{id:'news',text:'Nachricht'}]});await task;
  assert.equal(displayed.length,0);
  assert.equal(context.announcementQueue.length,1);
  assert.equal(context.announcementLoading,false);
});

test('landscape protects a visible round from auto-update but does not suppress updates after leaving',()=>{
  let applied=0;
  const context=vm.createContext({screen:'landscape',landscape:{active:true},ready:true,
    updates:{state:'available',apply:()=>{applied++;}},working:false,waitingStart:false,
    cloudWait:{blocked:false},modalRoot:{children:[]},sync:{busy:false},sharing:{busy:false},store:{doc:{pending:[]}}});
  vm.runInContext(functionLine('autoUpdate'),context);
  context.autoUpdate();assert.equal(applied,0);
  context.screen='learn';context.autoUpdate();assert.equal(applied,1);
});
