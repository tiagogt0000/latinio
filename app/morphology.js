// Offline lookup hints, not a complete morphological parser. Generated matches
// must always be labelled uncertain; explicit imported forms are exact aliases.
// Reference: Allen & Greenough, Dickinson College Commentaries,
// https://dcc.dickinson.edu/grammar/latin/four-conjugations
export const latinKey=s=>String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim();
const perfect={esse:'fu',videre:'vid',facere:'fec',dicere:'dix',ducere:'dux',legere:'leg',capere:'cep',venire:'ven',mittere:'mis',scribere:'scrips',agere:'eg',gerere:'gess',velle:'volu',posse:'potu',ferre:'tul'};
const irregular={esse:'sum es est sumus estis sunt eram eras erat eramus eratis erant ero eris erit erimus eritis erunt',posse:'possum potes potest possumus potestis possunt poteram poterat',velle:'volo vis vult volumus vultis volunt',ferre:'fero fers fert ferimus fertis ferunt'};
const cache=new Map();
export function inferredForms(latin){
 if(cache.has(latin))return cache.get(latin);
 const tokens=latinKey(latin).replace(/\([^)]*\)/g,'').split(/[^a-z]+/).filter(Boolean),head=tokens[0]||'',forms=new Set();
 const add=(stem,endings)=>endings.split(' ').forEach(e=>forms.add(stem+e));
 if(irregular[head])irregular[head].split(' ').forEach(f=>forms.add(f));
 if(/(are|ere|ire)$/.test(head)){
  const root=head.slice(0,-3),type=head.slice(-3);
  if(type==='are'){add(root,'o as at amus atis ant');add(root+'a','bam bas bat bamus batis bant bo bis bit bimus bitis bunt');}
  if(type==='ire'){add(root,'io is it imus itis iunt');add(root+'ie','bam bas bat bamus batis bant');}
  if(type==='ere'){
   // Unmarked -ere can be 2nd or 3rd conjugation: suggestions only.
   add(root,'o is it imus itis unt eo es et emus etis ent io iunt');
   add(root+'e','bam bas bat bamus batis bant');
  }
  const stem=perfect[head]||(type==='are'?root+'av':type==='ire'?root+'iv':null);
  if(stem)add(stem,'i isti it imus istis erunt ere eram eras erat eramus eratis erant');
 }else if(perfect[head])add(perfect[head],'i isti it imus istis erunt ere eram eras erat eramus eratis erant');
 // Noun stems come from the supplied genitive, not arbitrary suffix stripping.
 const gen=tokens[1];
 if(gen?.endsWith('is')||gen?.endsWith('em'))add(gen.slice(0,-2),'is i em e es um ium ibus a ia');
 else if(gen?.endsWith('ae'))add(gen.slice(0,-2),'a ae am arum is as');
 else if(gen?.endsWith('i'))add(gen.slice(0,-1),'us e i o um orum is os a');
 else if(tokens.length===1&&head.endsWith('a'))add(head.slice(0,-1),'ae am arum is as');
 else if(tokens.length===1&&/(us|um)$/.test(head))add(head.slice(0,-2),'i o um orum is os a');
 if(cache.size>5000)cache.clear();cache.set(latin,forms);return forms;
}
export function formMatch(word,query){
 const q=latinKey(query);
 if((word.forms||[]).some(f=>latinKey(f)===q))return 'stored';
 return q.length>=3&&inferredForms(word.latin).has(q)?'inferred':null;
}
