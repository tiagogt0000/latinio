import test from 'node:test';
import assert from 'node:assert/strict';
import {notificationsUI} from '../app/notifications.js';

function fixture(t,{permission='default',subscribed=false}={}){
 const originals=new Map(['navigator','Notification','PushManager','document'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 t.after(()=>{for(const [key,value] of originals)value?Object.defineProperty(globalThis,key,value):delete globalThis[key];});
 const calls=[],dialogs=[];let allowed=true;
 const sub={endpoint:'https://web.push.apple.com/test',toJSON:()=>({endpoint:'test',keys:{}}),unsubscribe:async()=>{}};
 const pushManager={getSubscription:async()=>subscribed?sub:null,subscribe:async()=>{calls.push('subscribe');return sub;}};
 const notification={permission,requestPermission(){calls.push('permission');notification.permission='granted';return Promise.resolve('granted');}};
 for(const [key,value] of Object.entries({Notification:notification,PushManager:function(){},navigator:{serviceWorker:{ready:Promise.resolve({pushManager})}},document:{querySelector:()=>null}}))Object.defineProperty(globalThis,key,{value,configurable:true});
 const options={sync:{async request(action){calls.push(action);return {publicKey:'public-test'};}},profile:{id:'student',role:'student'},h:String,showModal:html=>dialogs.push(html),showAdmin(){},notify(){},render(){},closeModal:()=>calls.push('close'),canPrompt:()=>allowed};
 const ui=notificationsUI(options);return {ui,options,calls,dialogs,setAllowed:value=>allowed=value};
}
test('All unregistered profiles get the activation notice once per app opening, not during a round or another dialog',async t=>{
 const f=fixture(t);f.setAllowed(false);await f.ui.refresh();assert.equal(f.ui.maybePrompt(),false);assert.equal(f.dialogs.length,0);
 f.setAllowed(true);assert.equal(f.ui.maybePrompt(),true);assert.match(f.dialogs[0],/notification-enable/);assert.match(f.dialogs[0],/OK/);assert.equal(f.ui.maybePrompt(),false);assert.ok(!f.calls.includes('permission'));
 await f.ui.handle({dataset:{action:'notification-later'}});assert.ok(!f.calls.includes('permission'));
 const reopened=notificationsUI(f.options);await reopened.refresh();assert.equal(reopened.maybePrompt(),true);
});
test('OK requests the native permission synchronously in the click handler before awaiting network or subscription work',async t=>{
 const f=fixture(t);await f.ui.refresh();f.ui.maybePrompt();f.calls.length=0;
 const operation=f.ui.handle({dataset:{action:'notification-enable'}});
 assert.deepEqual(f.calls,['close','permission'],'native prompt retains the user activation');
 await operation;assert.ok(f.calls.indexOf('permission')<f.calls.indexOf('subscribe'));assert.ok(f.calls.includes('notificationSubscribe'));assert.equal(f.ui.maybePrompt(),false);
});
test('Enabled devices are not asked again; blocked permissions get honest settings instructions instead of an impossible native re-prompt',async t=>{
 const f=fixture(t,{permission:'granted',subscribed:true});await f.ui.refresh();assert.equal(f.ui.maybePrompt(),false);assert.equal(f.dialogs.length,0);
 Notification.permission='denied';const blocked=notificationsUI(f.options);await blocked.refresh();assert.equal(blocked.maybePrompt(),true);assert.match(f.dialogs[0],/Einstellungen/);assert.doesNotMatch(f.dialogs[0],/notification-enable/);assert.ok(!f.calls.includes('permission'));
});
test('A temporary server failure never prompts an already enabled device again',async t=>{
 const f=fixture(t,{permission:'granted',subscribed:true});f.options.sync.request=async action=>{if(action==='notificationSubscribe')throw Error('Offline');return {publicKey:'test'};};await f.ui.refresh();assert.equal(f.ui.maybePrompt(),false);assert.equal(f.dialogs.length,0);
});
