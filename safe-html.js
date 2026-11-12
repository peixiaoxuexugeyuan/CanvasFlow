/* Rebuild editor markup in an inert template before inserting any user HTML. */
(function(){
'use strict';
const tags=new Set('b strong i em u s strike del ins mark span font div p br ul ol li sub sup code pre blockquote'.split(' '));
const drop=new Set('script style iframe object embed svg math template noscript form input button select textarea link meta base title head'.split(' '));
const props=new Set('font-size font-weight font-style color text-decoration text-align background-color line-height'.split(' '));
function sanitize(value){
 const template=document.createElement('template');template.innerHTML=String(value||'');
 const output=document.createElement('div');
 function visit(node,target,depth){
  if(depth>64)return;
  if(node.nodeType===3){target.appendChild(document.createTextNode(node.textContent));return;}
  if(node.nodeType!==1||drop.has(node.localName))return;
  let destination=target;
  if(tags.has(node.localName)){
   destination=document.createElement(node.localName);
   for(const chunk of String(node.getAttribute('style')||'').split(';')){
    const colon=chunk.indexOf(':');if(colon<0)continue;const name=chunk.slice(0,colon).trim().toLowerCase(),text=chunk.slice(colon+1).trim();
    if(props.has(name)&&/^[A-Za-z0-9#%.,()\s\-+/'"]{1,120}$/.test(text)&&!/(url\s*\(|expression|javascript|\\|@import|behavior|binding)/i.test(text))destination.style.setProperty(name,text);
   }
   if(node.localName==='font'){
    const color=node.getAttribute('color')||'';if(/^(#[a-f0-9]{3,8}|[a-z]{1,20})$/i.test(color))destination.setAttribute('color',color);
    const size=node.getAttribute('size')||'';if(/^[1-7]$/.test(size))destination.setAttribute('size',size);
   }
   target.appendChild(destination);
  }
  for(const child of node.childNodes)visit(child,destination,depth+1);
 }
 for(const node of template.content.childNodes)visit(node,output,0);
 return output.innerHTML;
}
window.CanvasFlowSafeHTML={sanitize};
})();
