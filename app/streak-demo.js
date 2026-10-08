// Shared animation artwork for admin previews and completed rounds.
// Persistence belongs to streak.js; this renderer never writes learning data.
const variants={
 orbit:{title:'Feuerkreis',tag:'Licht, das sich sammelt',description:'Ein glühender Bogen zeichnet einen Kreis. Funken umkreisen die lebendige Flamme, dann wechselt die Tageszahl.'},
 wave:{title:'Flammenwelle',tag:'Ein warmer, ruhiger Auftritt',description:'Aus einem roten Schimmer steigen weiche Lichtwellen auf. Die Flamme entfaltet sich und trägt die neue Zahl nach oben.'},
 impact:{title:'Sonnenkern',tag:'Der große Meilenstein',description:'Licht verdichtet sich im Zentrum. Die Zahl kommt aus der Tiefe, landet federnd und schickt einen goldenen Impuls nach außen.'}
};
const days=[1,2,3,7,30,100];
const themes={auto:'Wie in der App',light:'Hell',dark:'Dunkel'};
export function streakLab(day=1,theme='auto'){
 return `<h2 id="modal-title">Admin Tests</h2><p class="muted">Erst eine Test-Vokabel, dann der Übergang in deine Streak-Animation. Reine Vorschau – ohne gespeicherte Ergebnisse.</p><div class="streak-lab-settings"><label>Vorschautag<select id="streak-demo-day">${days.map(n=>`<option value="${n}" ${n===day?'selected':''}>Tag ${n}${[1,30,100].includes(n)?' · Meilenstein':''}</option>`).join('')}</select></label><label>Erscheinungsbild<select id="streak-demo-theme">${Object.entries(themes).map(([id,title])=>`<option value="${id}" ${id===theme?'selected':''}>${title}</option>`).join('')}</select></label></div><div class="streak-demo-options">${Object.entries(variants).map(([id,v],i)=>`<article><span class="streak-option-index">0${i+1}</span><div><h3>${v.title}</h3><p class="streak-option-tag">${v.tag}</p><p class="small muted">${v.description}</p><button class="button secondary wide" data-action="streak-demo" data-id="${id}">Mit Test-Vokabel starten</button></div></article>`).join('')}</div><p class="small muted">Tag 1 entzündet den ersten Funken, Tag 30 erhält einen Kranz aus 30 Lichtstrichen und Tag 100 eine große Funkenkrone. Hell und Dunkel ändern nur diese Vorschau.</p>`;
}
function flame(){
 return `<svg class="streak-flame" viewBox="0 0 120 150" aria-hidden="true"><defs><linearGradient id="streak-fire" x1="0" y1="1" x2=".65" y2="0"><stop stop-color="#e7492c"/><stop offset=".55" stop-color="#ff923e"/><stop offset="1" stop-color="#ffcd78"/></linearGradient><linearGradient id="streak-core" x1="0" y1="1" x2="0" y2="0"><stop stop-color="#fff9df"/><stop offset="1" stop-color="#ffd375"/></linearGradient></defs><g class="streak-flame-shell"><path fill="url(#streak-fire)" d="M60 3C77 29 61 42 78 60c5-9 9-17 10-24 6 28 24 40 24 66 0 28-22 44-52 44S8 128 8 102c0-24 13-39 25-53-1 20 4 25 10 30C35 46 53 25 60 3Z"/><path class="streak-flame-middle" fill="#ffbb52" d="M61 43c9 22-2 35 10 49 7-5 10-13 10-19 12 18 17 26 17 40 0 20-17 32-38 32s-38-13-38-32c0-17 12-30 17-39 0 15 5 20 11 23-7-23 5-39 11-54Z"/><path class="streak-flame-core" fill="url(#streak-core)" d="M61 85c4 16-1 23 8 31 4-4 5-8 5-12 8 10 12 16 12 23 0 11-12 18-26 18s-26-8-26-19c0-10 8-18 13-25 0 9 2 13 6 17-1-13 3-22 8-33Z"/></g></svg>`;
}
export function streakDemo(day,variant='orbit',theme='auto',options={}){
 const live=options.live===true;
 day=live?(Number.isSafeInteger(Number(day))&&Number(day)>0?Number(day):1):(days.includes(Number(day))?Number(day):1);
 variant=Object.hasOwn(variants,variant)?variant:'orbit';
 theme=Object.hasOwn(themes,theme)?theme:'auto';
 const special=[1,30,100].includes(day);
 const caption=live&&options.celebrate===false?'Dein Tagesziel für den Streak ist schon erreicht.':day===1?'Jeder große Streak beginnt mit einem Funken.':day===30?'30 Tage drangeblieben. Dein Feuer wächst.':day===100?'Hundert Tage. Das ist dein Moment.':'Ein neuer Tag. Dein Feuer bleibt.';
 const sparks=Array.from({length:day===100?36:24},(_,i)=>`<i style="--angle:${i*(day===100?10:15)}deg;--delay:${(i%6)*.065}s;--distance:${82+(i%5)*11}px;--drift:${Math.round(Math.sin(i)*100)}px"></i>`).join('');
 return `<div class="streak-stage" data-live="${live}" data-long-count="${day>=1000}" data-phase="${live?'blank':'question'}" data-variant="${variant}" data-day="${day}" data-theme="${theme}" data-special="${special}">
 <h2 id="modal-title" class="streak-sr">${live?'Runde abgeschlossen':'Animationsvorschau · '+variants[variant].title}</h2><p class="streak-sr" data-streak-status role="status" aria-live="polite"></p>
 ${live?'':`<div class="streak-question"><form data-streak-form novalidate>
 <div class="streak-question-card"><div class="streak-question-top"><span>TEST-RUNDE</span><span>1 / 1</span></div><div class="streak-question-progress"><span></span></div><h3>Was bedeutet …</h3><div class="latin-word">Test</div></div>
 <div class="streak-answer-block"><label for="streak-test-answer">Deine Antwort</label><input id="streak-test-answer" name="answer" placeholder="Test eingeben" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="40" aria-describedby="streak-answer-hint streak-answer-error"><p id="streak-answer-hint">Schreibe „Test“, um den Rundenabschluss auszuprobieren.</p><p id="streak-answer-error" role="alert"></p></div>
 <div class="streak-question-next"><button class="button primary wide" type="submit">Weiter <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg></button><p>Animationsvorschau · ${variants[variant].title}</p></div>
 </form></div>`}
 <div class="streak-celebration" hidden aria-hidden="true">
 <div class="streak-backdrop" aria-hidden="true"><div class="streak-current streak-current-left"></div><div class="streak-current streak-current-right"></div><div class="streak-current streak-current-top"></div><div class="streak-current streak-current-bottom"></div></div><div class="streak-atmosphere" aria-hidden="true"></div><div class="streak-horizon" aria-hidden="true"></div>
 <div class="streak-composition"><div class="streak-emblem">
 <svg class="streak-rings" viewBox="0 0 400 400" fill="none" aria-hidden="true"><circle class="streak-ring-track" cx="200" cy="200" r="168"/><g class="streak-ring-turn"><circle class="streak-ring-draw" cx="200" cy="200" r="168" pathLength="100"/><circle class="streak-ring-trail" cx="200" cy="200" r="181" pathLength="100"/></g><circle class="streak-month-ring" cx="200" cy="200" r="187" pathLength="30"/></svg>
 <div class="streak-shockwave" aria-hidden="true"></div><div class="streak-shockwave streak-shockwave-second" aria-hidden="true"></div>
 <div class="streak-sparks" aria-hidden="true">${sparks}</div><div class="streak-rays" aria-hidden="true">${Array.from({length:12},(_,i)=>`<i style="--angle:${i*30}deg;--delay:${(i%3)*.1}s"></i>`).join('')}</div>
 <div class="streak-flame-entry"><div class="streak-flame-float">${flame()}<i class="streak-loose-ember"></i><i class="streak-loose-ember streak-loose-ember-second"></i></div></div>
 <div class="streak-counter" aria-hidden="true">${day>1?`<span class="streak-old">${day-1}</span>`:''}<span class="streak-new">${day}</span></div>
 </div><div class="streak-copy"><p class="streak-milestone">${live&&options.celebrate===false?'RUNDE GESCHAFFT':day===1?'DER ANFANG':day===30?'DEIN MEILENSTEIN':day===100?'DREISTELLIG. UNAUFHALTSAM.':'STREAK FORTGESETZT'}</p><h3 class="streak-day-label">Tag ${day}</h3><p class="streak-caption">${caption}</p></div></div>
 </div>
 ${finishControls(live)}</div>`;
}

// Cancellable sequence: keyboard dismissal, staggered exit, empty frame, reveal.
// CSS owns the choreography after the celebration is mounted.
export function mountStreakDemo(stage,{reducedMotion=false,schedule=setTimeout,cancel=clearTimeout,onStart=()=>{}}={}){
 const form=stage.querySelector('[data-streak-form]'),input=stage.querySelector('#streak-test-answer');
 const error=stage.querySelector('#streak-answer-error'),question=stage.querySelector('.streak-question');
 const celebration=stage.querySelector('.streak-celebration'),controls=stage.querySelector('.streak-finish-controls');
 const status=stage.querySelector('[data-streak-status]'),submit=form.querySelector('[type="submit"]');
 const timers=new Set();let disposed=false,started=false;
 stage.dataset.reducedMotion=String(reducedMotion);
 function later(callback,delay){const timer=schedule(()=>{timers.delete(timer);if(!disposed)callback();},delay);timers.add(timer);}
 function clearError(){error.textContent='';input.removeAttribute('aria-invalid');}
 function start(event){
  event.preventDefault();event.stopPropagation();
  if(disposed||started)return;
  if(input.value.trim().toLocaleLowerCase('de-DE')!=='test'){
   error.textContent='Gib bitte „Test“ ein. Dann startet die Vorschau.';input.setAttribute('aria-invalid','true');input.focus({preventScroll:true});return;
  }
  started=true;clearError();input.blur();input.disabled=true;submit.disabled=true;onStart();
  stage.dataset.phase='leaving';status.textContent='Richtig. Die Animationsvorschau beginnt.';
  later(()=>{question.hidden=true;stage.dataset.phase='blank';},reducedMotion?100:920);
  later(()=>{
   celebration.hidden=false;celebration.setAttribute('aria-hidden','false');stage.dataset.phase='celebrate';
   later(()=>{
    controls.hidden=false;controls.querySelectorAll('button').forEach(button=>{button.disabled=false;button.focus({preventScroll:true});});
    status.textContent=`Vorschau: Tag ${stage.dataset.day}. ${stage.querySelector('.streak-caption').textContent}`;
   },reducedMotion?100:3600);
  },reducedMotion?220:1200);
 }
 form.addEventListener('submit',start);input.addEventListener('input',clearError);input.focus({preventScroll:true});
 return ()=>{disposed=true;timers.forEach(cancel);timers.clear();form.removeEventListener('submit',start);input.removeEventListener('input',clearError);};
}

function finishControls(live=false){
 return `<footer class="streak-finish-controls" hidden><button type="button" class="streak-continue" data-action="${live?'round-home':'admin-tests'}" disabled>Weiter <span aria-hidden="true">→</span></button></footer>`;
}
export function mountStreakFinish(stage,{celebrate=true,reducedMotion=false,schedule=setTimeout,cancel=clearTimeout}={}){
 let disposed=false;const timers=new Set();
 const later=(fn,delay)=>{const id=schedule(()=>{timers.delete(id);if(!disposed)fn();},delay);timers.add(id);};
 stage.dataset.reducedMotion=String(reducedMotion);
 later(()=>{
  const scene=stage.querySelector('.streak-celebration');scene.hidden=false;scene.setAttribute('aria-hidden','false');
  stage.dataset.phase=celebrate?'celebrate':'settled';
  later(()=>{
   const controls=stage.querySelector('.streak-finish-controls');controls.hidden=false;
   const button=controls.querySelector('button');button.disabled=false;button.focus({preventScroll:true});
   stage.querySelector('[data-streak-status]').textContent=celebrate?`Streak fortgesetzt: Tag ${stage.dataset.day}.`:'Runde abgeschlossen.';
  },celebrate&&!reducedMotion?3600:100);
 },reducedMotion?0:240);
 return ()=>{disposed=true;timers.forEach(cancel);timers.clear();};
}
