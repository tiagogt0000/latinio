import test from 'node:test';
import assert from 'node:assert/strict';
import {createCloudNotice} from '../app/cloud-notice.js';

function fixture({local=true,connected=true}={}){
 const sync={status:'checking',message:''},dialogs=[];
 let open=false,available=true,reloads=0,reload=async()=>{sync.status='synced';notice.update();};
 const notice=createCloudNotice({sync,online:()=>connected,hasLocalContent:()=>local,
  showModal:html=>{dialogs.push(html);open=true;},closeModal:()=>{open=false;},isOpen:()=>open,canPrompt:()=>available&&!open,
  reload:async()=>{reloads++;await reload();}});
 function status(value,message=''){sync.status=value;sync.message=message;notice.update();}
 return {notice,sync,dialogs,status,get open(){return open;},get reloads(){return reloads;},
  setAvailable:value=>available=value,setConnected:value=>connected=value,setReload:value=>reload=value,nativeClose:()=>open=false};
}
test('Routine checks, downloads, uploads and successful sync stay silent',()=>{
 const f=fixture();
 for(const status of ['unconfigured','checking','loading','newer','uploading','synced'])f.status(status);
 assert.equal(f.dialogs.length,0);assert.equal(f.notice.maybePrompt(),false);
});
test('An offline start explains saved learning and offers reload and dismissal once per outage',()=>{
 const f=fixture({connected:false});f.notice.update();
 assert.equal(f.dialogs.length,1);assert.match(f.dialogs[0],/Du bist offline/);
 assert.match(f.dialogs[0],/gespeicherten Sammlungen offline weiterlernen/);
 assert.match(f.dialogs[0],/data-action="cloud-retry">Erneut laden/);assert.match(f.dialogs[0],/data-action="cloud-dismiss">Ausblenden/);
 f.notice.dismiss();assert.equal(f.open,false);
 for(let i=0;i<5;i++){f.status('checking');f.status('offline');}
 assert.equal(f.dialogs.length,1,'background retries must not nag');
 f.setConnected(true);f.status('checking');f.status('synced');f.status('error','Cloud nicht erreichbar');
 assert.equal(f.dialogs.length,2,'a new outage after a successful recovery is announced');
});
test('The first offline download does not promise unavailable local lessons',()=>{
 const f=fixture({local:false,connected:false});f.notice.update();
 assert.match(f.dialogs[0],/noch keine Sammlungen gespeichert/);assert.doesNotMatch(f.dialogs[0],/offline weiterlernen/);
});
test('Closing with Escape or X also suppresses repeated notices for the same failure',()=>{
 const f=fixture();f.status('error','Zeitüberschreitung');f.nativeClose();
 f.status('checking');f.status('error','Zeitüberschreitung');f.notice.maybePrompt();assert.equal(f.dialogs.length,1);
});
test('Failures wait for dialogs and active exercises without stealing focus, and recovery cancels a pending notice',()=>{
 const f=fixture();f.setAvailable(false);f.status('error','Netzfehler');assert.equal(f.dialogs.length,0);
 f.setAvailable(true);f.notice.maybePrompt();assert.equal(f.dialogs.length,1);
 f.notice.dismiss();f.status('checking');f.status('synced');
 f.setAvailable(false);f.status('error');f.status('checking');f.status('synced');
 f.setAvailable(true);assert.equal(f.notice.maybePrompt(),false);assert.equal(f.dialogs.length,1);
});
test('Retry closes its notice and waits for a new result without stacking duplicate requests',async()=>{
 const f=fixture();f.status('error','Nicht erreichbar');let finish;
 f.setReload(()=>new Promise(resolve=>{finish=resolve;f.status('checking');}));
 const first=f.notice.retry();assert.equal(f.open,false);await f.notice.retry();assert.equal(f.reloads,1);
 f.status('error','Noch nicht erreichbar');assert.equal(f.dialogs.length,1,'no notice while explicit retry is pending');
 finish();await first;assert.equal(f.dialogs.length,2);assert.equal(f.open,true);
 f.setReload(async()=>f.status('synced'));await f.notice.retry();assert.equal(f.open,false);assert.equal(f.dialogs.length,2);
});
test('Recovery closes only the connection notice, preserving a replacement dialog',()=>{
 const f=fixture();f.status('error');assert.equal(f.open,true);f.status('checking');f.status('synced');assert.equal(f.open,false);
 f.status('error');f.nativeClose();f.setAvailable(false);f.status('checking');f.status('synced');
 assert.equal(f.notice.maybePrompt(),false);
});
test('Rejected retries and initial gate failures are readable and escape server messages',async()=>{
 const f=fixture();f.setAvailable(false);f.notice.fail(Error('<img src=x onerror=bad>'));
 f.setAvailable(true);f.notice.maybePrompt();assert.match(f.dialogs[0],/&lt;img/);assert.doesNotMatch(f.dialogs[0],/<img/);
 f.setReload(async()=>{throw Error('Verbindung fehlgeschlagen');});await f.notice.retry();
 assert.match(f.dialogs.at(-1),/Verbindung fehlgeschlagen/);
});
