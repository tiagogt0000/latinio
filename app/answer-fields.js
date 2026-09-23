export function appendAnswerField(root,renderInput){
 const answers=root.querySelector('#answers');
 if(!answers)return false;
 const index=answers.children.length;
 answers.insertAdjacentHTML('beforeend',renderInput('',index,false));
 answers.lastElementChild?.querySelector('input')?.focus({preventScroll:true});
 return true;
}
