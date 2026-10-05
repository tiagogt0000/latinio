export const LAST_SUBJECT_KEY='latinio-last-subject';

export function currentSubject(search,storage){
  const requested=new URLSearchParams(search).get('subject');
  if(requested==='latin'||requested==='english'){
    storage.setItem(LAST_SUBJECT_KEY,requested);
    return requested;
  }
  return storage.getItem(LAST_SUBJECT_KEY)==='english'?'english':'latin';
}

export function rememberSubject(subject,storage){
  if(subject==='latin'||subject==='english')storage.setItem(LAST_SUBJECT_KEY,subject);
}
