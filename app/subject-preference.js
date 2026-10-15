export const LAST_SUBJECT_KEY='latinio-last-subject';

export function currentSubject(search,storage){
  const requested=new URLSearchParams(search).get('subject');
  if(['latin','english','french'].includes(requested)){
    storage.setItem(LAST_SUBJECT_KEY,requested);
    return requested;
  }
  const saved=storage.getItem(LAST_SUBJECT_KEY);return ['latin','english','french'].includes(saved)?saved:'latin';
}

export function rememberSubject(subject,storage){
  if(['latin','english','french'].includes(subject))storage.setItem(LAST_SUBJECT_KEY,subject);
}
