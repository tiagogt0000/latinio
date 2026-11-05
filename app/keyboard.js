import {hasAnswerContent} from './answer-fields.js';
import {focusInput} from './input-visibility.js';

export function installKeyboardSupport({root,active,session,submit,next,addField,addCorrectionField,rateCard,beginCorrection,submitCorrection}){
 let focusTimer=null;
 const handler=event=>{
  if(!active()||event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||event.isComposing||event.keyCode===229)return;
  const current=session();
  if(current?.mode==='inactive-check'){
   if(!current.cardFlipped)return;
   if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
    event.preventDefault();rateCard(event.key==='ArrowRight');
   }
   return;
  }
  const target=event.target;
  if(event.key==='Enter'){
   event.preventDefault();
   if(current?.correctionMode&&current.correctionResult?.grade==='full'){next();return;}
   if(current?.feedback&&!current.correctionMode){next();return;}
   // Enter in a newly added, empty field is not an instruction to grade the round.
   if(target?.name==='answer'&&!String(target.value??'').trim())return;
   const selector=current?.correctionMode?'#practice-answers input[name="answer"]':'#answers input[name="answer"]';
   if(!hasAnswerContent([...root.querySelectorAll(selector)].map(field=>field.value)))return;
   if(current?.correctionMode)submitCorrection?.();else submit();
   return;
  }
  if(current?.feedback&&current.feedback.grade!=='full'&&!current.correctionMode&&event.key.length===1){
   event.preventDefault();beginCorrection?.(event.key);return;
  }
  if(current?.correctionMode&&event.key==='ArrowDown'){
   const fields=[...root.querySelectorAll('#practice-answers input[name="answer"]')],index=fields.indexOf(target);
   if(index>=0){event.preventDefault();if(fields[index+1])focusInput(fields[index+1]);else addCorrectionField?.();}
   return;
  }
  if(target?.name!=='answer'||!target.closest?.('#answer-form'))return;
  if(event.key!=='ArrowDown'||current?.feedback)return;
  const fields=[...root.querySelectorAll('#answers input[name="answer"]')],index=fields.indexOf(target);
  if(index<0)return;
  event.preventDefault();
  if(fields[index+1])focusInput(fields[index+1]);
  else if(root.querySelector('[data-action="add-answer"]')){
   addField();clearTimeout(focusTimer);focusTimer=setTimeout(()=>{focusTimer=null;if(active())focusInput(root.querySelectorAll('#answers input[name="answer"]')[index+1]);},0);
  }
 };
 root.addEventListener('keydown',handler);
 return ()=>{clearTimeout(focusTimer);root.removeEventListener('keydown',handler);};
}
