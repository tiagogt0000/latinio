function afterPaint(){
 return new Promise(resolve=>{
  let first,second;
  const finish=()=>{clearTimeout(timer);cancelAnimationFrame(first);cancelAnimationFrame(second);resolve();};
  // Two frames allow the pressed button to paint before building a large collection.
  const timer=setTimeout(finish,120);
  first=requestAnimationFrame(()=>{second=requestAnimationFrame(finish);});
 });
}

export function createCollectionOpener({waitForPaint=afterPaint}={}){
 let sequence=0;
 return {
  cancel(){sequence++;},
  async open(button,show,isCurrent=()=>true){
   if(button.classList.contains('opening-collection'))return false;
   const ticket=++sequence,html=button.innerHTML,busy=button.getAttribute('aria-busy');
   button.classList.add('opening-collection');
   button.setAttribute('aria-busy','true');
   button.innerHTML='<span class="button-loading" role="status" aria-label="Sammlung wird geöffnet"><i></i><i></i><i></i></span>';
   try{
    await waitForPaint();
    if(ticket!==sequence||!isCurrent())return false;
    show();return true;
   }finally{
    button.innerHTML=html;button.classList.remove('opening-collection');
    if(busy===null)button.removeAttribute('aria-busy');else button.setAttribute('aria-busy',busy);
   }
  }
 };
}
