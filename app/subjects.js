export const SUBJECTS=[
 {id:'latin',label:'Latein',flag:'🇻🇦',code:'la',logo:'./icon.svg',brand:'latinio'},
 {id:'english',label:'Englisch',flag:'🇺🇸',code:'en',logo:'./icon-english.svg',brand:'latinio'},
 {id:'french',label:'Französisch',flag:'🇫🇷',code:'fr',logo:'./icon-vocabify.svg',brand:'Vocabify'}
];
export const subjectInfo=id=>SUBJECTS.find(s=>s.id===id)||SUBJECTS[0];
export const brandWord=id=>id==='french'?'<span class="vocabify-word">Vocabify<span>✦</span></span>':'latinio<span>✦</span>';
export const TRANSITION_KEY='latinio-brand-transition';
export async function brandTransition(root,from,to,{reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches}={}){
 if((from==='french')===(to==='french'))return;
 const veil=document.createElement('div');veil.className='brand-transition';veil.setAttribute('aria-label',`${subjectInfo(from).brand} und ${subjectInfo(to).brand}`);
 veil.innerHTML=`<div class="brand-partnership"><div class="partnership-first brand ${from==='french'?'brand-vocabify':'brand-latinio'}">${brandWord(from)}</div><i></i><div class="partnership-second brand ${to==='french'?'brand-vocabify':'brand-latinio'}">${brandWord(to)}</div></div>`;
 const backdrop=root.querySelector?.('.subject-entrance')||root;
 const foreground=globalThis.getComputedStyle?.(backdrop)?.color;
 if(foreground)veil.style.color=foreground;
 veil.setAttribute('data-measuring','');document.body.append(veil);
 // Equal grid columns anchor both wordmarks to a fixed central divider.
 // Only the solo phases move; their offsets use the actual rendered widths.
 const divider=veil.querySelector('i').getBoundingClientRect();
 const center=divider.left+divider.width/2;
 for(const [name,selector] of [['first','.partnership-first'],['second','.partnership-second']]){
  const rect=veil.querySelector(selector).getBoundingClientRect();
  veil.style.setProperty(`--${name}-center`,`${center-rect.left-rect.width/2}px`);
 }
 veil.removeAttribute('data-measuring');
 try{if(!reducedMotion){const animation=veil.animate([{opacity:0},{opacity:1,offset:.1},{opacity:1,offset:.9},{opacity:0}],{duration:2000,fill:'forwards'});await animation.finished.catch(()=>{});}}
 finally{veil.remove();}
}
