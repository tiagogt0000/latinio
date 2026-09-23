export function installKeyboardSupport({root,active,session,submit,next,addField}){
 const handler=event=>{
  if(!active()||event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey)return;
  const target=event.target;
  if(target?.name!=='answer'||!target.closest?.('#answer-form'))return;
  const current=session();
  if(event.key==='Enter'){
   event.preventDefault();
   if(current?.feedback)next();else submit();
   return;
  }
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
