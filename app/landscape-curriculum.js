// Transcribed from the supplied schoolbook, not a general Latin morphology table.
export const BOOK_CASES = Object.freeze([
  {id:'nom',label:'Nominativ',ordinal:1},
  {id:'acc',label:'Akkusativ',ordinal:4},
  {id:'gen',label:'Genitiv',ordinal:2},
  {id:'dat',label:'Dativ',ordinal:3},
  {id:'abl',label:'Ablativ',ordinal:6},
]);
export const DECLENSION_GROUPS = Object.freeze([
  {id:'a',label:'a-Deklination',example:'domina'},
  {id:'o-m',label:'o-Deklination männlich',example:'dominus'},
  {id:'o-n',label:'o-Deklination sächlich',example:'templum'},
  {id:'third',label:'3. Deklination · senātor-Muster',example:'senātor'},
]);
export const CASE_QUESTIONS = Object.freeze({
  nom:'Wer oder was?',acc:'Wen oder was?',gen:'Wessen?',dat:'Wem?',
  abl:'Womit? · Wodurch? · Woher?',
});
const FORMS = Object.freeze({
  nom:[['-a','-ae'],['-us','-ī'],['-um','-a'],[null,'-ēs']],
  gen:[['-ae','-ārum'],['-ī','-ōrum'],['-ī','-ōrum'],['-is','-um']],
  dat:[['-ae','-īs'],['-ō','-īs'],['-ō','-īs'],['-ī','-ibus']],
  acc:[['-am','-ās'],['-um','-ōs'],['-um','-a'],['-em','-ēs']],
  abl:[['-ā','-īs'],['-ō','-īs'],['-ō','-īs'],['-e','-ibus']],
});
export function endingCells(caseId){
  const row=FORMS[caseId];
  if(!row)return [];
  return DECLENSION_GROUPS.flatMap((group,index)=>['sg','pl'].map((number,n)=>({
    id:`ending-${caseId}-${group.id}-${number}`,caseId,groupId:group.id,number,
    label:`${group.label} · ${number==='sg'?'Singular':'Plural'}`,
    answer:row[index][n]??'Grundform – keine feste Endung',editable:row[index][n]!==null,
  })));
}
export function normalizeEnding(value){
  return typeof value==='string'?value.trim().replace(/^[-–−]\s*/,'').normalize('NFD').replace(/\u0304/g,'').toLocaleLowerCase('la'):'';
}
export function checkEnding(input,cell){
  if(!cell?.editable||typeof cell.answer!=='string')return false;
  const answer=normalizeEnding(input);
  return !!answer&&answer===normalizeEnding(cell.answer);
}
