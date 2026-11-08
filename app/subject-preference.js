export const LAST_SUBJECT_KEY='latinio-last-subject';

export function currentSubject(search,storage){
  const requested=new URLSearchParams(search).get('subject');
  if(['latin','english','french'].includes(requested)){
    const subject=requested==='english'?'english':'latin';
    rememberSubject(subject,storage);
    return subject;
  }
  let saved;try{saved=storage.getItem(LAST_SUBJECT_KEY);}catch{}
  if(saved==='french')rememberSubject('latin',storage);
  return saved==='english'?'english':'latin';
}

export function rememberSubject(subject,storage){
  if(['latin','english','french'].includes(subject)){
    try{storage.setItem(LAST_SUBJECT_KEY,subject==='english'?'english':'latin');}catch{}
  }
}
