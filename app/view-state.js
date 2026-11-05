// Preserve the actual scroll containers as well as the page during same-view updates.
const SCROLL_AREAS='.bounded-list,.table-scroll,.admin-tabs,.collection-tabs-nav,.access-editor-list,[data-preserve-scroll]';
function identity(element){
 if(!element?.tagName)return null;
 const attributes=Array.from(element.attributes||[]).filter(a=>a.name==='id'||a.name==='name'||a.name.startsWith('data-')).map(a=>[a.name,a.value]);
 if(!attributes.length)return null;
 return {tag:element.tagName.toLowerCase(),attributes};
}
function locate(root,key){return key?Array.from(root.querySelectorAll(key.tag)).find(el=>key.attributes.every(([name,value])=>el.getAttribute(name)===value)):null;}
export function captureViewState(root,win=globalThis.window){
 const active=root.ownerDocument?.activeElement;
 const snapshot={win,x:win?.scrollX||0,y:win?.scrollY||0,focus:root.contains?.(active)?identity(active):null,selection:active&&typeof active.selectionStart==='number'?[active.selectionStart,active.selectionEnd]:null,areas:Array.from(root.querySelectorAll(SCROLL_AREAS)).map((el,index)=>({index,key:identity(el),top:el.scrollTop,left:el.scrollLeft})),minHeight:root.style?.minHeight||''};
 if(root.style)root.style.minHeight=Math.max(root.getBoundingClientRect?.().height||0,root.scrollHeight||0)+'px';
 return snapshot;
}
export function restoreViewState(root,snapshot,{preserve=true}={}){
 if(root.style)root.style.minHeight=snapshot.minHeight;
 if(!preserve)return;
 const areas=Array.from(root.querySelectorAll(SCROLL_AREAS));
 for(const old of snapshot.areas){const node=locate(root,old.key)||areas[old.index];if(node){node.scrollTop=old.top;node.scrollLeft=old.left;}}
 const focus=locate(root,snapshot.focus);
 if(focus&&!focus.disabled){focus.focus?.({preventScroll:true});if(snapshot.selection)try{focus.setSelectionRange?.(...snapshot.selection);}catch{}}
 snapshot.win?.scrollTo({left:snapshot.x,top:snapshot.y,behavior:'instant'});
}
