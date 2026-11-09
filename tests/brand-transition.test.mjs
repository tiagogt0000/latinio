import test from 'node:test';
import assert from 'node:assert/strict';
import {beginSubjectTransition,beginSubjectIntro,SUBJECTS,subjectInfo,brandWord} from '../app/subjects.js';

const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function fixture({broken=false,missing=false,handoff=null}={}){
 const calls=[],overlays=[],timers=new Map(),listeners=new Set(),documentListeners=new Map(),viewListeners=new Map();let now=0,nextId=0;
 const preference={matches:false,addEventListener(_type,listener){listeners.add(listener);},removeEventListener(_type,listener){listeners.delete(listener);}};
 const eventTarget=registry=>({addEventListener(type,listener){if(!registry.has(type))registry.set(type,new Set());registry.get(type).add(listener);},removeEventListener(type,listener){registry.get(type)?.delete(listener);}});
 const view={...eventTarget(viewListeners),matchMedia:()=>preference,setTimeout(callback,delay){timers.set(++nextId,{callback,at:now+delay,delay});return nextId;},clearTimeout:id=>timers.delete(id)};
 function element(name){
  const attributes=new Map(),dataset={},style={setProperty(name,value){this[name]=value;},removeProperty(name){delete this[name];}};
  const node={name,attributes,dataset,style,removed:false,classList:{add(){},remove(){}},
   setAttribute(name,value){attributes.set(name,String(value));if(name.startsWith('data-'))dataset[name.slice(5).replace(/-([a-z])/g,(_,letter)=>letter.toUpperCase())]=String(value);},
   getAttribute:name=>attributes.get(name)??null,removeAttribute(name){attributes.delete(name);},remove(){this.removed=true;},
  };
  if(!missing)node.animate=function(frames,options){
   if(broken)throw new TypeError('Animation not available');
   let finish,reject;
   const animation={cancelled:false,finished:new Promise((yes,no)=>{finish=yes;reject=no;}),finish(){finish();},cancel(){this.cancelled=true;reject();}};
   calls.push({element:this,frames,options,animation});return animation;
  };
  return node;
 }
 function overlay(){
  const node=element('overlay'),source=element('source'),target=element('target'),backdrop=element('backdrop'),content=element('content');
  node.querySelector=selector=>({'.is-from':source,'.is-to':target,'.subject-transition-backdrop':backdrop,'.subject-transition-content':content}[selector]||null);
  return node;
 }
 const doc={...eventTarget(documentListeners),defaultView:view,hidden:false,visibilityState:'visible',documentElement:element('html'),body:{append:node=>overlays.push(node)},createElement:overlay,getElementById:id=>overlays.find(node=>node.id===id&&!node.removed)||null};
 const root={...element('root'),ownerDocument:doc};
 if(handoff){const node=overlay();node.id='subject-transition-handoff';node.setAttribute('data-from',handoff.from);node.setAttribute('data-to',handoff.to);overlays.push(node);root.setAttribute('data-subject-handoff','');}
 function advance(ms){now+=ms;for(const [id,timer] of [...timers])if(timer.at<=now){timers.delete(id);timer.callback();}}
 function reduce(){preference.matches=true;for(const listener of listeners)listener({matches:true});}
 function hide(){doc.hidden=true;doc.visibilityState='hidden';for(const listener of documentListeners.get('visibilitychange')||[])listener();}
 function viewEvent(type,event={}){for(const listener of [...viewListeners.get(type)||[]])listener(event);}
 function finishAnimations(){calls.forEach(call=>call.animation.finish());}
 const listenerCount=()=>listeners.size+[...documentListeners.values(),...viewListeners.values()].reduce((total,set)=>total+set.size,0);
 return {root,calls,overlays,timers,listeners,advance,reduce,hide,viewEvent,finishAnimations,listenerCount};
}

test('All three subjects use the Latinio brand and distinct metadata',()=>{
 assert.deepEqual(SUBJECTS.map(subject=>subject.id),['latin','english','french']);
 assert.equal(subjectInfo('french').id,'french');assert.equal(subjectInfo('french').code,'fr');assert.equal(brandWord('french'),'latinio<span>✦</span>');
});
test('A switch gradually softens the background before written wordmarks exchange scale and position',async()=>{
 const f=fixture(),transition=beginSubjectTransition(f.root,'latin','english');
 const overlay=f.overlays[0];assert.equal(f.overlays.length,1);assert.equal(overlay.removed,false);
 assert.equal(overlay.attributes.get('role'),'status');assert.equal(overlay.attributes.get('aria-busy'),'true');
 assert.equal((overlay.innerHTML.match(/latinio<span>✦<\/span>/g)||[]).length,2);assert.match(overlay.innerHTML,/is-from\" data-subject=\"latin/);assert.match(overlay.innerHTML,/is-to\" data-subject=\"english/);assert.doesNotMatch(overlay.innerHTML,/<img/);assert.match(overlay.innerHTML,/Englisch wird geladen/);
 const backdrop=f.calls.find(call=>call.element.name==='backdrop'),source=f.calls.find(call=>call.element.name==='source'),target=f.calls.find(call=>call.element.name==='target');
 assert.deepEqual(backdrop.frames.map(frame=>frame.opacity),[0,1]);assert.equal(backdrop.options.duration,360);
 assert.equal(f.calls.filter(call=>call.element.name==='source').length,1,'one source animation avoids overlapping backwards-fill transforms');
 assert.equal(source.frames[0].opacity,0);assert.equal(source.options.duration,1020);
 const appeared=source.frames.find(frame=>frame.opacity===1);assert.ok(appeared.offset>0&&appeared.offset<1);assert.match(appeared.transform,/scale\(1\)/);
 assert.match(source.frames.at(-1).transform,/translateX\(-130%\).*scale\(0?\.68\)/);assert.equal(source.frames.at(-1).opacity,0);
 assert.match(target.frames[0].transform,/translateX\(130%\).*scale\(0?\.76\)/);assert.match(target.frames.at(-1).transform,/scale\(1\)/);assert.equal(target.frames.at(-1).opacity,1);
 assert.equal(target.options.delay,300);assert.equal(target.options.duration,720);
 assert.ok(f.calls.every(call=>call.frames.every(frame=>!('filter' in frame)&&!('backdropFilter' in frame))),'blur remains on its own layer and is introduced by opacity');
 let entered=false;void transition.entered.then(()=>entered=true);await flush();assert.equal(entered,false);
 for(const call of f.calls.filter(call=>call!==target))call.animation.finish();await flush();assert.equal(entered,false,'navigation waits for the incoming wordmark to settle');
 target.animation.finish();await transition.entered;assert.equal(overlay.removed,false);assert.ok([...f.timers.values()].every(timer=>timer.delay===1800),'only the delayed loading status may remain');
 const beforeClose=f.calls.length,finished=transition.finish();assert.equal(typeof finished?.then,'function');assert.equal(transition.closing,true);
 const closing=f.calls.slice(beforeClose),content=closing.find(call=>call.element.name==='content'),background=closing.find(call=>call.element.name==='backdrop');
 assert.equal(content.options.duration,400);assert.equal(background.options.duration,600);assert.equal(background.frames.at(-1).opacity,0);
 content.animation.finish();await flush();assert.equal(overlay.removed,false,'the background fade must not be cut off by the shorter wordmark exit');
 assert.equal(content.options.fill,'forwards');assert.equal(content.animation.cancelled,false,'the completed wordmark fade must stay hidden while the backdrop is still fading');
 background.animation.finish();await finished;assert.equal(overlay.removed,true);assert.equal(f.timers.size,0);assert.equal(f.listenerCount(),0);
});
test('Every subject pair sends the old written logo left and brings the new one from the right',async()=>{
 for(const from of SUBJECTS)for(const to of SUBJECTS){
  if(from.id===to.id)continue;
  const f=fixture(),transition=beginSubjectTransition(f.root,from.id,to.id);
  const exit=f.calls.find(call=>call.element.name==='source'),entry=f.calls.find(call=>call.element.name==='target');
  assert.match(exit.frames.at(-1).transform,/translateX\(-130%\)/,from.id+' → '+to.id);
  assert.match(entry.frames[0].transform,/translateX\(130%\)/,from.id+' → '+to.id);
  assert.match(f.overlays[0].innerHTML,new RegExp('data-subject="'+to.id+'"'));
  transition.dispose();await transition.entered;assert.ok(f.calls.every(call=>call.animation.cancelled));assert.equal(f.listenerCount(),0);
 }
});
test('Initial subject selection introduces one centered written wordmark and gives it a readable hold',async()=>{
 for(const subject of SUBJECTS){
  const f=fixture(),intro=beginSubjectIntro(f.root,subject.id),overlay=f.overlays[0];
  assert.equal((overlay.innerHTML.match(/latinio<span>✦<\/span>/g)||[]).length,1);
  assert.doesNotMatch(overlay.innerHTML,/is-from|<img/);assert.match(overlay.innerHTML,new RegExp('is-to" data-subject="'+subject.id+'"'));
  const backdrop=f.calls.find(call=>call.element.name==='backdrop'),wordmark=f.calls.find(call=>call.element.name==='target');
  assert.equal(f.calls.length,2);assert.equal(backdrop.options.duration,360);assert.deepEqual(backdrop.frames.map(frame=>frame.opacity),[0,1]);
  assert.equal(wordmark.options.delay,100);assert.equal(wordmark.options.duration,850);assert.equal(wordmark.options.fill,'backwards');
  assert.equal(wordmark.frames[0].opacity,0);assert.match(wordmark.frames[0].transform,/scale\(\.95\)/);
  assert.equal(wordmark.frames[1].opacity,1);assert.equal(wordmark.frames[1].transform,'scale(1)');
  assert.equal(wordmark.options.duration*wordmark.frames[1].offset,500,'the name softly enters over500ms');
  assert.equal(wordmark.options.duration*(1-wordmark.frames[1].offset),350,'the final frame holds for350ms');
  assert.equal(wordmark.frames.at(-1).opacity,1);assert.equal(wordmark.frames.at(-1).transform,'scale(1)');
  assert.ok(f.calls.every(call=>call.frames.every(frame=>!('filter' in frame)&&!('backdropFilter' in frame)&&!String(frame.transform).includes('translate'))));
  let entered=false;void intro.entered.then(()=>entered=true);
  backdrop.animation.finish();await flush();assert.equal(entered,false,'fast readiness cannot skip the written name');
  f.advance(600);await flush();assert.equal(entered,false,'the hold remains part of the entry before reveal');
  wordmark.animation.finish();await intro.entered;assert.equal(overlay.removed,false);
  const start=f.calls.length,finished=intro.finish();
  assert.deepEqual(f.calls.slice(start).map(call=>[call.element.name,call.options.duration]),[['content',400],['backdrop',600]]);
  f.finishAnimations();await finished;assert.equal(overlay.removed,true);assert.equal(f.timers.size,0);assert.equal(f.listenerCount(),0);
 }
});
test('Initial wordmark respects immediate navigation and interrupted or unavailable animation paths',async()=>{
 for(const options of [{keyboard:true},{reducedMotion:true}]){
  const f=fixture(),intro=beginSubjectIntro(f.root,'french',options);
  await intro.entered;await intro.finish();assert.equal(f.calls.length,0);assert.equal(f.overlays[0].removed,true);assert.equal(f.timers.size,0);assert.equal(f.listenerCount(),0);
 }
 for(const interrupt of ['hidden','reduced','pagehide','replacement','failure','timeout']){
  const f=fixture(),intro=beginSubjectIntro(f.root,'english');
  if(interrupt==='hidden')f.hide();else if(interrupt==='reduced')f.reduce();else if(interrupt==='pagehide')f.viewEvent('pagehide');
  else if(interrupt==='replacement')beginSubjectTransition(f.root,'english','french').dispose();
  else if(interrupt==='failure')intro.fail();
  else {f.advance(1100);await flush();assert.equal(intro.disposed,false);f.advance(10);}
  await intro.entered;
  if(interrupt==='timeout'){const finished=intro.finish();f.advance(760);await finished;}else await intro.finish();
  assert.equal(f.overlays[0].removed,true,interrupt);assert.equal(f.timers.size,0,interrupt);assert.equal(f.listenerCount(),0,interrupt);
 }
 for(const options of [{broken:true},{missing:true}]){
  const f=fixture(options),intro=beginSubjectIntro(f.root,'latin');await intro.entered;await intro.finish();
  assert.equal(f.overlays[0].removed,true);assert.equal(f.timers.size,0);assert.equal(f.listenerCount(),0);
 }
});
test('Keyboard and reduced motion skip the visual wait and remove the overlay immediately',async()=>{
 for(const options of [{keyboard:true},{reducedMotion:true}]){
  const f=fixture(),transition=beginSubjectTransition(f.root,'latin','english',options);
  await transition.entered;assert.equal(f.calls.length,0);assert.equal(f.timers.size,0);assert.equal(f.overlays[0].removed,true);
  await transition.finish();assert.equal(f.overlays[0].removed,true);assert.equal(f.timers.size,0);assert.equal(f.listenerCount(),0);
 }
});
test('Reload resumes the matching destination handoff without replaying the outgoing wordmark',async()=>{
 const f=fixture({handoff:{from:'latin',to:'french'}}),handoff=f.overlays[0];
 const transition=beginSubjectTransition(f.root,'latin','french',{resume:true});
 await transition.entered;assert.equal(f.overlays.length,1);assert.equal(f.overlays[0],handoff);assert.equal(handoff.removed,false);assert.equal(f.calls.length,0);assert.ok([...f.timers.values()].every(timer=>timer.delay===1800));
 const finished=transition.finish();assert.ok(f.calls.length>0);assert.ok(f.calls.every(call=>['content','backdrop'].includes(call.element.name)));
 f.finishAnimations();await finished;assert.equal(handoff.removed,true);assert.equal(f.root.getAttribute('data-subject-handoff'),null);assert.equal(f.listenerCount(),0);
});
test('A mismatched handoff is removed instead of keeping a stale subject above the new one',async()=>{
 const f=fixture({handoff:{from:'latin',to:'french'}}),stale=f.overlays[0];
 const transition=beginSubjectTransition(f.root,'latin','english',{resume:true});
 await transition.entered;assert.equal(stale.removed,true);assert.equal(f.overlays.length,2);assert.match(f.overlays[1].innerHTML,/data-subject="english"/);
 transition.dispose();assert.equal(f.listenerCount(),0);
});
test('An early finish, failure and replacement release their animations and promises',async()=>{
 const f=fixture(),first=beginSubjectTransition(f.root,'latin','english');
 const early=first.finish();f.finishAnimations();await early;await first.entered;assert.equal(f.overlays[0].removed,true);
 const second=beginSubjectTransition(f.root,'english','latin'),third=beginSubjectTransition(f.root,'latin','french');
 await second.entered;assert.equal(f.overlays[1].removed,true);assert.equal(f.overlays[2].removed,false);
 third.fail();third.dispose();await third.finish();await third.entered;
 assert.equal(f.overlays[2].removed,true);assert.equal(f.timers.size,0);assert.equal(f.listenerCount(),0);
});
test('Enabling reduced motion settles the travel and also interrupts an active closing fade',async()=>{
 for(const duringClose of [false,true]){
  const f=fixture(),transition=beginSubjectTransition(f.root,'latin','english');
  if(duringClose){f.finishAnimations();await transition.entered;transition.finish();}
  f.reduce();await transition.entered;
  if(!duringClose)await transition.finish();
  assert.equal(f.overlays[0].removed,true);assert.equal(f.timers.size,0);assert.equal(f.listenerCount(),0);
 }
});
test('Backgrounding a tab settles entry without waiting for suspended browser animation clocks',async()=>{
 const f=fixture(),transition=beginSubjectTransition(f.root,'latin','english');
 f.hide();await transition.entered;await transition.finish();assert.equal(f.overlays[0].removed,true);assert.equal(f.timers.size,0);assert.equal(f.listenerCount(),0);
});
test('Pagehide and a persisted pageshow cannot retain an old transition or its listeners',async()=>{
 for(const event of ['pagehide','pageshow']){
  const f=fixture(),transition=beginSubjectTransition(f.root,'latin','french');
  if(event==='pageshow'){f.viewEvent(event,{persisted:false});assert.equal(transition.disposed,false);}
  f.viewEvent(event,{persisted:true});await transition.entered;await transition.finish();
  assert.equal(transition.disposed,true);assert.equal(f.overlays[0].removed,true);assert.equal(f.timers.size,0);assert.equal(f.listenerCount(),0);
 }
});
test('Unavailable or throwing animation APIs cannot hold loading or leave an overlay after finish',async()=>{
 for(const options of [{broken:true},{missing:true}]){
  const f=fixture(options),transition=beginSubjectTransition(f.root,'latin','english');
  await transition.entered;assert.ok([...f.timers.values()].every(timer=>timer.delay===1800));await transition.finish();
  assert.equal(f.overlays[0].removed,true);assert.equal(f.timers.size,0);assert.equal(f.listenerCount(),0);
 }
});
test('Stalled animation promises have finite entry and closing bounds without shortening normal motion',async()=>{
 const f=fixture(),transition=beginSubjectTransition(f.root,'latin','english');
 let entered=false;void transition.entered.then(()=>entered=true);f.advance(1000);await flush();assert.equal(entered,false,'the former 300 ms bound must not cut the requested choreography short');
 f.advance(250);await transition.entered;assert.ok([...f.timers.values()].every(timer=>timer.delay===1800));
 const finished=transition.finish();f.advance(800);await finished;assert.equal(f.overlays[0].removed,true);
 assert.ok(f.calls.every(call=>call.animation.cancelled));assert.equal(f.timers.size,0);assert.equal(f.listenerCount(),0);
});
