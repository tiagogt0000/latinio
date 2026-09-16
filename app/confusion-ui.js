import {uid} from './core.js';
import {pairs,pairId,suggestions,makeRound,matchRound} from './confusions.js';
export function confusionUI({store,sync,h,showModal,closeModal,notify,go,render}){
  const d=()=>store.data;
  function prompt(word,feedback,session){
    return suggestions(word,feedback,d()).filter(x=>!session.confusionDismissed?.includes(session.cursor+':'+x.word.id)).map(x=>`<aside class="confusion-suggestion"><p>Meintest du bei „${h(x.answer)}“ vielleicht <strong>${h(x.word.latin)}</strong>?</p><div class="button-row"><button type="button" class="text-button" data-action="confusion-add" data-a="${h(word.id)}" data-b="${h(x.word.id)}">Ja, als Verwechslung merken</button><button type="button" class="text-button" data-action="confusion-dismiss" data-id="${h(x.word.id)}">Nein</button></div></aside>`).join('');
  }
  function manager(){
    const data=d(),words=Object.values(data.words).filter(w=>data.collections[w.collectionId]).sort((a,b)=>a.latin.localeCompare(b.latin));
    const options='<option value="">Vokabel auswählen …</option>'+words.map(w=>`<option value="${h(w.id)}">${h(w.latin)} · ${h(data.collections[w.collectionId].name)}</option>`).join('');
    showModal(`<h2 id="modal-title">Verwechslungsgefahr</h2><p class="muted">Merke dir Wörter, die du auseinanderhalten möchtest. Du kannst mehrere Paare anlegen.</p><div class="confusion-picker"><label>Erstes Wort<select id="confusion-a">${options}</select></label><label>Zweites Wort<select id="confusion-b">${options}</select></label><button class="button primary" data-action="confusion-manual">Paar hinzufügen</button></div><div class="confusion-pairs">${pairs(data).map(p=>`<div class="confusion-pair"><span><strong>${h(data.words[p.wordIds[0]].latin)}</strong> ↔ <strong>${h(data.words[p.wordIds[1]].latin)}</strong></span><button class="text-button" data-action="confusion-delete" data-id="${h(p.id)}" aria-label="Verwechslung entfernen">Entfernen</button></div>`).join('')||'<p class="muted">Noch keine Verwechslungen gespeichert.</p>'}</div><button class="button secondary wide" data-action="confusion-practice" ${!pairs(data).length?'disabled':''}>Verwechslungen üben</button>`);
  }
  async function add(a,b){
    if(!a||!b||a===b)throw Error('Wähle zwei verschiedene Vokabeln.');
    if(!d().words[a]||!d().words[b])throw Error('Eine Vokabel ist nicht mehr vorhanden.');
    const id=pairId(a,b);if(d().settings[id]){notify('Dieses Paar ist schon gespeichert.');return;}
    await store.commit([['settings',id,{id,kind:'confusion',wordIds:[a,b].sort(),createdAt:Date.now()}]]);sync.schedule();notify('Verwechslung gespeichert.');
  }
  async function offer(wordIds,returnScreen='result',force=false){
    if(store.doc.matchRound){go('match');return true;}
    const round=makeRound(d(),wordIds,force);if(!round)return false;
    round.returnScreen=returnScreen;await store.update(doc=>{doc.matchRound=round;return doc;});closeModal();go('match');return true;
  }
  function view(){
    const r=store.doc.matchRound;if(!r)return '<main class="test-shell"><h1>Keine Zuordnungsrunde offen.</h1><button class="button primary" data-action="nav" data-screen="collections">Zu den Sammlungen</button></main>';
    const complete=r.doneLeft.length===r.words.length;
    const cards=(side)=>r[side].map(id=>{const w=r.words.find(w=>w.id===id),done=r[side==='left'?'doneLeft':'doneRight'].includes(id),chosen=side==='left'&&r.selected===id,bad=r.bad?.[side]===id;return `<button class="match-card ${done?'matched':''} ${chosen?'chosen':''} ${bad?'mismatch':''}" data-action="confusion-card" data-side="${side}" data-id="${h(id)}" ${done?'disabled':''} ${side==='left'?`aria-pressed="${chosen}"`:''}>${done?'<span aria-label="Zugeordnet">✓ </span>':''}${side==='left'?h(w.latin):w.meanings.map(g=>h(g.join(' / '))).join(' · ')}</button>`;}).join('');
    return `<main class="test-shell"><div class="eyebrow">VERWECHSLUNGEN FESTIGEN</div><h1>Was gehört zusammen?</h1><p class="muted match-help">Tippe zuerst auf Latein, dann auf die passenden deutschen Bedeutungen. Jede deutsche Karte zeigt alle Bedeutungen des Wortes.</p><div class="match-grid"><section aria-label="Latein"><h2>Latein</h2>${cards('left')}</section><section aria-label="Deutsch"><h2>Deutsch</h2>${cards('right')}</section></div><p role="status" class="match-message">${h(complete?'Alle Wörter zugeordnet!':r.message)}</p><p class="small muted">${r.doneLeft.length} / ${r.words.length} zugeordnet</p>${complete?'<button class="button primary wide" data-action="confusion-complete">Weiter</button>':'<button class="text-button" data-action="confusion-leave">Später üben</button>'}</main>`;
  }
  async function handle(button){
    const action=button.dataset.action;if(!action.startsWith('confusion-'))return false;
    if(action==='confusion-manage')manager();
    if(action==='confusion-add'){await add(button.dataset.a,button.dataset.b);render();}
    if(action==='confusion-dismiss'){await store.update(doc=>{const s=doc.session;s.confusionDismissed??=[];s.confusionDismissed.push(s.cursor+':'+button.dataset.id);return doc;});render();}
    if(action==='confusion-manual'){await add(document.querySelector('#confusion-a').value,document.querySelector('#confusion-b').value);manager();}
    if(action==='confusion-delete'){await store.commit([['settings',button.dataset.id,null]]);sync.schedule();manager();}
    if(action==='confusion-practice'){if(!await offer(null,'collections',true))notify('Lege zuerst ein Verwechslungspaar an.');}
    if(action==='confusion-card'){
      await store.update(doc=>{let r=doc.matchRound;if(!r)return doc;const id=button.dataset.id;
        if(button.dataset.side==='left'){if(!r.doneLeft.includes(id)){r.selected=id;r.bad=null;r.message='Wähle jetzt die passende deutsche Karte.';}}
        else if(!r.selected)r.message='Wähle zuerst ein lateinisches Wort.';
        else r=matchRound(r,id);doc.matchRound=r;return doc;});render();
    }
    if(action==='confusion-complete'||action==='confusion-leave'){
      const round=store.doc.matchRound;if(!round)return true;
      if(action==='confusion-complete'){
        if(round.doneLeft.length!==round.words.length)return true;
        const changes=round.pairIds.filter(id=>d().settings[id]).map(pairId=>{const id='cr_'+round.id+'_'+pairId;return ['settings',id,{id,kind:'confusionReview',pairId,correct:round.errors===0,at:Date.now()}];});
        await store.commit(changes);sync.schedule(0);
      }
      await store.update(doc=>{doc.matchRound=null;return doc;});go(round.returnScreen);
    }
    return true;
  }
  return {prompt,manager,offer,view,handle};
}
