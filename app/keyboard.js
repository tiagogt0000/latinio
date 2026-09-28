export function installKeyboardSupport({root,active,session,submit,next,addField,rateCard}){
 const handler=event=>{
  if(!active()||event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey)return;
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
   if(current?.feedback)next();else submit();
   return;
  }
  if(target?.name!=='answer'||!target.closest?.('#answer-form'))return;
  if(event.key!=='ArrowDown'||current?.feedback)return;
  const fields=[...root.querySelectorAll('#answers input[name="answer"]')],index=fields.indexOf(target);
  if(index<0)return;
  event.preventDefault();
  if(fields[index+1])fields[index+1].focus({preventScroll:true});
  else if(root.querySelector('[data-action="add-answer"]')){
   addField();setTimeout(()=>root.querySelectorAll('#answers input[name="answer"]')[index+1]?.focus({preventScroll:true}),0);
  }
 };
 root.addEventListener('keydown',handler);
 return ()=>root.removeEventListener('keydown',handler);
}
