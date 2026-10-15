// French learning modes, pronunciation and text imports adapted from Vocabify 1.3.1.
// Accounts, persistence and sharing use Latinio; no Firebase connection is made.
import {englishTasks} from './english.js';
import {wordsForDecks} from './refresh-decks.js';
export async function seedFrenchStarter(store){
 if(store.subject!=='french'||store.profileId!=='admin'||store.data.settings.vocabify_starter||Object.keys(store.data.collections).length)return;
 const pairs=[['la mère','die Mutter'],['le père','der Vater'],['le frère','der Bruder'],['la sœur','die Schwester'],['les grands-parents','die Großeltern'],['le chien','der Hund'],['habiter','wohnen'],['aimer','lieben, mögen']];
 const id='vocabify-ma-famille';
 await store.commit([
  ['collections',id,{id,name:'Vocabify · Ma famille (Startsammlung)'}],
  ...pairs.map(([f,d],i)=>{const key='vocabify-starter-'+i;return ['words',key,{id:key,collectionId:id,latin:f,meanings:splitMeanings(d).map(x=>[x])}];}),
  ['settings','vocabify_starter',{kind:'vocabifyStarter',installed:true}]
 ]);
}
export function frenchImport(input){
 if(input?.lang&& !['fr','french'].includes(input.lang))throw Error('Bitte nur französische Vocabify-Sammlungen importieren.');
 const words=input?.words||input?.vocab;
 if(!Array.isArray(words))return input;
 return {...input,format:input.format||'latinio-collection',schema:input.schema||1,words:words.map(w=>({
  ...w,latin:w.latin??w.french??w.f,
  meanings:w.meanings??(Array.isArray(w.german)?w.german.map(x=>Array.isArray(x)?x:[x]):splitMeanings(w.german??w.d??'').map(x=>[x]))
 }))};
}
function splitMeanings(text){let depth=0,part='',out=[];for(const ch of String(text)){if(ch==='(')depth++;if(ch===')')depth=Math.max(0,depth-1);if(!depth&&/[,;/]/.test(ch)){if(part.trim())out.push(part.trim());part='';}else part+=ch;}if(part.trim())out.push(part.trim());return out;}
export function frenchTextImport(text,filename='Französisch'){
 let name=filename.replace(/\.(vocab\.)?(txt|csv)$/i,'');const words=[];
 for(const raw of text.split(/\r?\n/)){const line=raw.trim();if(!line)continue;if(line.startsWith('#')){if(/^#\s*Name:/i.test(line))name=line.replace(/^#\s*Name:\s*/i,'');if(/^#\s*Sprache:/i.test(line)&&!/^#\s*Sprache:\s*(fr|french)\s*$/i.test(line))throw Error('Diese Datei gehört nicht zu Französisch.');continue;}
 if(/^(Französisch|French|fr)\s*;\s*(Deutsch|German|de)$/i.test(line))continue;
 const pos=line.indexOf(';');if(pos<1)throw Error('Jede Zeile braucht Französisch ; Deutsch.');words.push({f:line.slice(0,pos).trim(),d:line.slice(pos+1).trim()});}
 if(!words.length)throw Error('Die Datei enthält keine Vokabeln.');return frenchImport({name,vocab:words});
}
export function frenchTasks(data,ids,mode,limit,direction,now=Date.now()){
 if(!['older','newest','errors'].includes(mode))return englishTasks(data,ids,mode,limit,direction,now);
 const selected=wordsForDecks(data,ids),reviews=Object.values(data.reviews);
 const words=selected.filter(w=>{const events=reviews.filter(r=>r.wordId===w.id),last=Math.max(0,...events.map(r=>r.at));return mode==='older'?last>0&&now-last>7*86400000:mode==='newest'?!events.length:events.some(r=>r.grade!=='full');});
 const allowed=new Set(words.map(w=>w.id));return englishTasks(data,ids,'all',limit,direction,now).filter(t=>allowed.has(t.wordId)).slice(0,limit);
}
export function speakFrench(text){
 if(!globalThis.speechSynthesis||!globalThis.SpeechSynthesisUtterance)return false;
 speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(String(text).replace(/\([^)]*\)/g,'').replace(/[;/]/g,', '));utterance.lang='fr-FR';utterance.rate=.9;
 const voice=speechSynthesis.getVoices().find(v=>v.lang.replace('_','-').startsWith('fr'));if(voice)utterance.voice=voice;speechSynthesis.speak(utterance);return true;
}
export function frenchHome(data,today,goal,h){
 const words=Object.values(data.words).filter(w=>data.collections[w.collectionId]),reviews=Object.values(data.reviews),correct=new Set(reviews.filter(r=>new Date(r.at).toLocaleDateString('sv')===new Date().toLocaleDateString('sv')&&r.grade==='full').map(r=>r.wordId)).size;
 return `<section class="vocabify-welcome"><div><p class="eyebrow">BONJOUR · FRANZÖSISCH MIT VOCABIFY</p><h2>Un petit pas, chaque jour.</h2><p class="muted">Ein kleiner Schritt. Jeden Tag. Dein Lernstand bleibt bei dir.</p></div></section><section class="vocabify-stats"><div><strong>${correct}</strong><span>heute richtig</span></div><div><strong>${words.length}</strong><span>Vokabeln</span></div><div><strong>${Math.min(today,goal)} / ${goal}</strong><span>deine Tagesrunde</span></div></section><div class="vocabify-path"><span>Ton chemin · Dein Lernpfad</span><progress max="${goal}" value="${Math.min(today,goal)}" aria-label="Heute geübte Aufgaben"></progress></div>`;
}
