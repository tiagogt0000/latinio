import {focusInput} from './input-visibility.js';

export function hasAnswerContent(answers){
 return Array.isArray(answers)&&answers.some(answer=>typeof answer==='string'&&answer.trim().length>0);
}

export function appendAnswerField(root,renderInput){
 const answers=root.querySelector('#answers');
 if(!answers)return false;
 const index=answers.children.length;
 answers.insertAdjacentHTML('beforeend',renderInput('',index,false));
 focusInput(answers.lastElementChild?.querySelector('input'));
 return true;
}
