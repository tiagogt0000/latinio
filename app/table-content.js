// Transcribed from the supplied textbook photographs. Macrons are optional in answers.
export const CASES=[{id:'nom',label:'Nominativ',short:'Nom.'},{id:'gen',label:'Genitiv',short:'Gen.'},{id:'dat',label:'Dativ',short:'Dat.'},{id:'acc',label:'Akkusativ',short:'Akk.'},{id:'abl',label:'Ablativ',short:'Abl.'}];
export const NUMBERS=[{id:'sg',label:'Singular'},{id:'pl',label:'Plural'}];
export const GENDERS=[{id:'m',label:'Maskulinum'},{id:'f',label:'Femininum'},{id:'n',label:'Neutrum'}];
export const PERSONS=[{id:'1',label:'1. Person'},{id:'2',label:'2. Person'}];
export const DECLENSIONS=[{id:'a',label:'a-Deklination',short:'a-Dekl.',example:'domina'},{id:'o-m',label:'o-Deklination (m.)',short:'o-Dekl. m.',example:'dominus'},{id:'o-n',label:'o-Deklination (n.)',short:'o-Dekl. n.',example:'templum'},{id:'third',label:'3. Deklination',short:'3. Dekl.',example:'senātor'}];
export const TARGETS=[{id:'presentStem',label:'Präsensstamm'},{id:'perfectStem',label:'Perfektstamm'},{id:'perfectFirst',label:'1. Person Singular Perfekt'}];
function genderTable(id,label,description,forms){
 const items=CASES.flatMap((grammaticalCase,caseIndex)=>NUMBERS.flatMap((number,numberIndex)=>GENDERS.map((gender,genderIndex)=>{
  const variants=forms[caseIndex][numberIndex*3+genderIndex],accepted=Array.isArray(variants)?variants:[variants];
  return {id:`${id}-${grammaticalCase.id}-${number.id}-${gender.id}`,case:grammaticalCase.id,number:number.id,gender:gender.id,prompt:`${label} · ${grammaticalCase.label} · ${number.label} · ${gender.label}`,answer:accepted.join(' / '),accepted};
 })));
 return {id,label,description,dimensions:['cases','numbers','genders'],items};
}
const adjectives=genderTable('adjectives','Adjektive: magnus, a, um','Die a- und o-Deklination am Beispiel magnus – groß. Trage die vollständige Form ein.',[
 ['magnus','magna','magnum','magnī','magnae','magna'],
 ['magnī','magnae','magnī','magnōrum','magnārum','magnōrum'],
 ['magnō','magnae','magnō','magnīs','magnīs','magnīs'],
 ['magnum','magnam','magnum','magnōs','magnās','magna'],
 ['magnō','magnā','magnō','magnīs','magnīs','magnīs']
]);
// Arrays follow the case order above. Bare ablatives are also correct.
const personalForms={
 '1':{sg:[['egō'],['meī'],['mihi'],['mē'],['ā mē / mēcum','ā mē','mēcum','mē']],pl:[['nōs'],['nostrī','nostrum'],['nōbīs'],['nōs'],['ā nōbīs / nōbīscum','ā nōbīs','nōbīscum','nōbīs']]},
 '2':{sg:[['tū'],['tuī'],['tibi'],['tē'],['ā tē / tēcum','ā tē','tēcum','tē']],pl:[['vōs'],['vestrī','vestrum'],['vōbīs'],['vōs'],['ā vōbīs / vōbīscum','ā vōbīs','vōbīscum','vōbīs']]}
};
const personal={id:'personal',label:'Personalpronomen: egō und tū',description:'Die 1. und 2. Person. Beim Ablativ gelten die Formen aus dem Buch und die reine Pronomenform.',dimensions:['cases','numbers','persons'],
 items:CASES.flatMap((grammaticalCase,caseIndex)=>NUMBERS.flatMap(number=>PERSONS.map(person=>{
  const accepted=personalForms[person.id][number.id][caseIndex];
  return {id:`personal-${grammaticalCase.id}-${number.id}-${person.id}`,case:grammaticalCase.id,number:number.id,person:person.id,prompt:`Personalpronomen · ${person.label} · ${grammaticalCase.label} · ${number.label}`,answer:accepted[0],accepted};
 })))
};
const relative=genderTable('relative','Relativpronomen: quī, quae, quod','Das bezügliche Fürwort in allen fünf Fällen, im Singular und Plural.',[
 ['quī','quae','quod','quī','quae','quae'],
 ['cuius','cuius','cuius','quōrum','quārum','quōrum'],
 ['cui','cui','cui','quibus','quibus','quibus'],
 ['quem','quam','quod','quōs','quās','quae'],
 ['quō','quā','quō','quibus','quibus','quibus']
]);
const isPronoun=genderTable('is','Pronomen: is, ea, id','Das Demonstrativ-, Personal- und Possessivpronomen. Bei Varianten genügt eine richtige Form.',[
 ['is','ea','id',['iī','eī'],'eae','ea'],
 ['eius','eius','eius','eōrum','eārum','eōrum'],
 ['eī','eī','eī',['eīs','iīs'],['eīs','iīs'],['eīs','iīs']],
 ['eum','eam','id','eōs','eās','ea'],
 ['eō','eā','eō',['iīs','eīs'],['iīs','eīs'],['iīs','eīs']]
]);
const perfect={id:'perfect',label:'Dehnungsperfekt',description:'Die zusätzliche Tabelle mit vidēre, venīre und capere: Präsensstamm, Perfektstamm und Perfektform.',dimensions:['targets'],
 items:[{id:'videre',infinitive:'vidēre',forms:['vide-','vīd-','vīd-ī']},{id:'venire',infinitive:'venīre',forms:['veni-','vēn-','vēn-ī']},{id:'capere',infinitive:'capere',forms:['capi-','cēp-','cēp-ī']}].flatMap(verb=>TARGETS.map((target,index)=>({id:`perfect-${verb.id}-${target.id}`,target:target.id,prompt:`${verb.infinitive} · ${target.label}`,answer:verb.forms[index],accepted:[verb.forms[index]]})))
};
// Rows follow CASES; each row contains the four singular and four plural forms.
const nounForms=[
 ['domina','dominus','templum','senātor','dominae','dominī','templa','senātōrēs'],
 ['dominae','dominī','templī','senātōris','dominārum','dominōrum','templōrum','senātōrum'],
 ['dominae','dominō','templō','senātōrī','dominīs','dominīs','templīs','senātōribus'],
 ['dominam','dominum','templum','senātōrem','dominās','dominōs','templa','senātōrēs'],
 ['dominā','dominō','templō','senātōre','dominīs','dominīs','templīs','senātōribus']
];
const nouns={id:'nouns',label:'Substantive (Deklination)',description:'Die a-, o- und 3. Deklination am Beispiel domina, dominus, templum und senātor. Trage die vollständige Form ein.',dimensions:['cases','numbers','declensions'],
 items:CASES.flatMap((grammaticalCase,caseIndex)=>NUMBERS.flatMap((number,numberIndex)=>DECLENSIONS.map((declension,declensionIndex)=>{
  const answer=nounForms[caseIndex][numberIndex*DECLENSIONS.length+declensionIndex],accepted=[answer];
  if(grammaticalCase.id==='abl'){
   const preposition=declension.id==='o-n'?'in':'cum';
   accepted.push(`${preposition} ${answer}`,`(${preposition}) ${answer}`);
  }
  return {id:`nouns-${grammaticalCase.id}-${number.id}-${declension.id}`,case:grammaticalCase.id,number:number.id,declension:declension.id,prompt:`${declension.example} · ${grammaticalCase.label} · ${number.label} · ${declension.label}`,answer,accepted};
 })))
};
export const TABLES=[adjectives,personal,relative,isPronoun,perfect,nouns];
export const PREFIXES=[
 {id:'ab',prompt:'ab- (a-, abs-)',answer:'weg-, ab-',accepted:['weg','ab']},
 {id:'ad',prompt:'ad- (ac-, at- und andere Formen)',answer:'hinzu-, dabei-',accepted:['hinzu','dabei']},
 {id:'circum',prompt:'circum-',answer:'um-, herum-',accepted:['um','herum']},
 {id:'com',prompt:'com- (col-, con-)',answer:'zusammen-',accepted:['zusammen']},
 {id:'de',prompt:'de-',answer:'herab-, weg-',accepted:['herab','weg']},
 {id:'ex',prompt:'ex- (e-, ef-)',answer:'heraus-',accepted:['heraus']},
 {id:'in',prompt:'in-',answer:'hinein-, darin-',accepted:['hinein','darin']},
 {id:'per',prompt:'per-',answer:'(hin)durch-',accepted:['durch','hindurch','(hin)durch']},
 {id:'pro',prompt:'pro-',answer:'vor-, voraus-',accepted:['vor','voraus']},
 {id:'ne',prompt:'ne-',answer:'nicht',accepted:['nicht']},
 {id:'re',prompt:'re-',answer:'zurück-, wieder',accepted:['zurück','wieder']}
];
const dimensionFields={cases:'case',numbers:'number',genders:'gender',persons:'person',targets:'target',declensions:'declension'};
// Omitted dimensions select everything; empty selections select nothing.
export function selectTableItems(tableId,filters={}){
 const table=TABLES.find(candidate=>candidate.id===tableId);
 if(!table)return [];
 return table.items.filter(item=>table.dimensions.every(dimension=>{
  const selected=filters?.[dimension];
  return selected===undefined||Array.isArray(selected)&&selected.includes(item[dimensionFields[dimension]]);
 }));
}
function normalizeAnswer(value,prefix){
 let normalized=value.normalize('NFC').toLocaleLowerCase('de').trim();
 if(prefix)normalized=normalized.replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss');
 return normalized.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[\s\u00ad‐‑‒–—−-]/g,'');
}
function alternatives(value){return value.split(/[,;/]|\b(?:und|oder)\b/iu);}
// One meaning/form is sufficient, but all submitted alternatives must be correct.
export function checkAnswer(input,item,{prefix=false}={}){
 if(typeof input!=='string'||!input.trim()||!item)return false;
 const expected=Array.isArray(item.accepted)?item.accepted:[item.answer];
 const accepted=new Set(expected.filter(value=>typeof value==='string').flatMap(alternatives).map(value=>normalizeAnswer(value,prefix)).filter(Boolean));
 if(!accepted.size)return false;
 const submitted=alternatives(input).map(value=>normalizeAnswer(value,prefix));
 return submitted.length>0&&submitted.every(value=>value&&accepted.has(value));
}
