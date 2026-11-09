// Prepare an additive import before making a normal authenticated push. Existing
// words, personal reviews and collection edits are never overwritten.
const key=value=>String(value).normalize('NFC').replace(/’/g,"'").toLocaleLowerCase('fr').trim().replace(/\s+/g,' ');
const validId=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(value);
export function planCollectionImport(data,collections){
 const changes=[],skipped=[],seen=new Map(Object.values(data.words).map(word=>[key(word.latin),word]));
 const ids=new Set(),wordIds=new Set(Object.keys(data.words));
 for(const input of collections){
  if(input?.format!=='latinio-collection'||input.schema!==1||!validId(input.id)||ids.has(input.id)||typeof input.name!=='string'||!input.name.trim()||input.name.length>100||!Array.isArray(input.words))throw Error('Ungültige Import-Sammlung.');
  ids.add(input.id);const additions=[];
  const existing=data.collections[input.id];
  if(existing&&existing.name!==input.name)throw Error('Die vorhandene Sammlung wurde geändert: '+input.id);
  for(const source of input.words){
   if(!validId(source.id)||typeof source.latin!=='string'||!source.latin.trim()||source.latin.length>200||!Array.isArray(source.meanings)||!source.meanings.length||source.meanings.some(group=>!Array.isArray(group)||!group.length||group.some(text=>typeof text!=='string'||!text.trim()||text.length>300)))throw Error('Ungültige Import-Vokabel.');
   if(source.answerVariants!==undefined&&(!Array.isArray(source.answerVariants)||!source.answerVariants.length||source.answerVariants.length>40||source.answerVariants.some(text=>typeof text!=='string'||!text.trim()||text.length>200)))throw Error('Ungültige Antwortvarianten.');
   const word={id:source.id,collectionId:input.id,latin:source.latin,meanings:source.meanings,...(source.answerVariants?{answerVariants:source.answerVariants}:{})};
   const current=data.words[word.id];
   if(current){
    if(current.collectionId!==word.collectionId||current.latin!==word.latin||JSON.stringify(current.meanings)!==JSON.stringify(word.meanings)||JSON.stringify(current.answerVariants)!==JSON.stringify(word.answerVariants))throw Error('Die vorhandene Vokabel wurde geändert: '+word.id);
    skipped.push({id:word.id,reason:'already-imported'});continue;
   }
   if(wordIds.has(word.id))throw Error('Doppelte Vokabelkennung: '+word.id);
   wordIds.add(word.id);
   const duplicate=seen.get(key(word.latin));
   if(duplicate){skipped.push({id:word.id,reason:'existing-word',existingId:duplicate.id});continue;}
   seen.set(key(word.latin),word);additions.push(['words',word.id,word]);
  }
  if(!existing&&additions.length)changes.push(['collections',input.id,{id:input.id,name:input.name}]);
  changes.push(...additions);
 }
 return {changes,skipped};
}
