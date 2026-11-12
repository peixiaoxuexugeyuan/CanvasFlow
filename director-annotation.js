/* Viewport annotations become an image reference; they do not invent camera keyframes. */
(function(){
'use strict';
const COLORS=['#FF1212','#FFCC00','#00EA88','#0A5BFD','#FFFFFF','#808080','#000000'];
const clone=value=>JSON.parse(JSON.stringify(value));
function bounds(s){
 if(s.type==='text')return{x:s.start.x,y:s.start.y-s.width*5,w:Math.max(s.width*5,s.textWidth||s.text.length*s.width*5),h:s.width*6};
 const points=s.points||[s.start,s.end];const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
 return{x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};
}
function distance(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
function hit(s,p,tolerance=8){
 const b=bounds(s),pad=tolerance+s.width/2;if(p.x<b.x-pad||p.y<b.y-pad||p.x>b.x+b.w+pad||p.y>b.y+b.h+pad)return false;
 if(s.type==='text')return true;
 if(s.type==='brush')return s.points.some((v,i)=>distance(p,v,s.points[i+1]||v)<=pad);
 if(s.type==='arrow')return distance(p,s.start,s.end)<=pad;
 if(s.type==='rectangle')return Math.min(Math.abs(p.x-b.x),Math.abs(p.x-b.x-b.w),Math.abs(p.y-b.y),Math.abs(p.y-b.y-b.h))<=pad;
 const rx=b.w/2,ry=b.h/2;if(!rx||!ry)return distance(p,s.start,s.end)<=pad;
 return Math.abs(Math.hypot((p.x-b.x-rx)/rx,(p.y-b.y-ry)/ry)-1)<=pad/Math.min(rx,ry);
}
function translate(s,dx,dy){const next=clone(s);for(const p of next.points||[next.start,next.end].filter(Boolean)){p.x+=dx;p.y+=dy;}return next;}
function segmentsNear(a,b,c,d,r){
 const cross=(p,q,v)=>(q.x-p.x)*(v.y-p.y)-(q.y-p.y)*(v.x-p.x);
 if(cross(a,b,c)*cross(a,b,d)<=0&&cross(c,d,a)*cross(c,d,b)<=0&&Math.max(Math.min(a.x,b.x),Math.min(c.x,d.x))<=Math.min(Math.max(a.x,b.x),Math.max(c.x,d.x))&&Math.max(Math.min(a.y,b.y),Math.min(c.y,d.y))<=Math.min(Math.max(a.y,b.y),Math.max(c.y,d.y)))return true;
 return Math.min(distance(a,c,d),distance(b,c,d),distance(c,a,b),distance(d,a,b))<=r;
}
function sweptHit(s,a,b,r){
 if(hit(s,a,r)||hit(s,b,r))return true;
 let points=s.points||[s.start,s.end],box=bounds(s);
 if(s.type==='rectangle'||s.type==='text'){points=[{x:box.x,y:box.y},{x:box.x+box.w,y:box.y},{x:box.x+box.w,y:box.y+box.h},{x:box.x,y:box.y+box.h},{x:box.x,y:box.y}];}
 if(s.type==='ellipse'){points=Array.from({length:65},(_,i)=>({x:box.x+box.w/2+Math.cos(i/64*Math.PI*2)*box.w/2,y:box.y+box.h/2+Math.sin(i/64*Math.PI*2)*box.h/2}));}
 return points.some((p,i)=>segmentsNear(a,b,p,points[i+1]||p,r+s.width/2));
}
function paint(ctx,s){
 ctx.save();ctx.strokeStyle=ctx.fillStyle=s.color;ctx.lineWidth=s.width;ctx.lineCap=ctx.lineJoin='round';ctx.beginPath();
 if(s.type==='text'){ctx.font=`${s.width*5}px sans-serif`;ctx.fillText(s.text,s.start.x,s.start.y);}
 else if(s.type==='brush'){ctx.moveTo(s.points[0].x,s.points[0].y);for(const p of s.points.slice(1))ctx.lineTo(p.x,p.y);if(s.points.length===1){ctx.arc(s.points[0].x,s.points[0].y,s.width/2,0,Math.PI*2);ctx.fill();}else ctx.stroke();}
 else if(s.type==='arrow'){const a=s.start,b=s.end,angle=Math.atan2(b.y-a.y,b.x-a.x),len=Math.max(14,s.width*4);ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.x-len*Math.cos(angle-.45),b.y-len*Math.sin(angle-.45));ctx.lineTo(b.x-len*Math.cos(angle+.45),b.y-len*Math.sin(angle+.45));ctx.closePath();ctx.fill();}
 else{const b=bounds(s);if(s.type==='rectangle')ctx.rect(b.x,b.y,b.w,b.h);else ctx.ellipse(b.x+b.w/2,b.y+b.h/2,Math.max(.01,b.w/2),Math.max(.01,b.h/2),0,0,Math.PI*2);ctx.stroke();}ctx.restore();
}
window.DirectorAnnotationGeometry={bounds,hit,translate,paint,sweptHit};
window.createDirectorAnnotation=function({host,source,onScenePick,onComplete,onClose,onError}){
 const base=document.createElement('canvas');base.width=source.width;base.height=source.height;base.getContext('2d').drawImage(source,0,0);
 const layer=document.createElement('section');layer.className='pv-annotation';layer.setAttribute('aria-label','运镜轨迹标注');
 const canvas=document.createElement('canvas');canvas.width=base.width;canvas.height=base.height;canvas.tabIndex=0;canvas.setAttribute('aria-label','标注画布');canvas.style.aspectRatio=base.width+'/'+base.height;layer.appendChild(canvas);
 const toolbar=document.createElement('div');toolbar.className='pv-annotation-toolbar';toolbar.setAttribute('role','toolbar');toolbar.setAttribute('aria-label','标注');
 const svg=path=>`<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
 const tools=[['exit','退出标注','<path d="m6 6 12 12M6 18 18 6"/>'],['select','选择','<path d="m5 3 5 17 3-7 7-3Z"/>'],['brush','画笔','<path d="m14 4 6 6-10 10H4v-6Z"/>'],['arrow','箭头','<path d="m5 19 14-14M9 5h10v10"/>'],['ellipse','圆形','<circle cx="12" cy="12" r="8"/>'],['rectangle','方形','<rect x="4" y="4" width="16" height="16" rx="1"/>'],['text','文字','<path d="M4 5h16M12 5v15M8 20h8"/>'],['erase','橡皮擦','<path d="m4 13 9-9 7 7-9 9H7Zm6-6 7 7"/>'],['done','完成标注','<path d="m5 12 4 4L19 6"/>']];
 toolbar.innerHTML=`<div class="pv-annotation-style">${[['细',2],['中',4],['粗',7]].map(([name,n])=>`<button type="button" aria-label="${name}" data-stroke="${n}"><i style="width:${n+3}px;height:${n+3}px"></i></button>`).join('')}<span class="pv-annotation-divider"></span>${COLORS.map(c=>`<button type="button" aria-label="${c}" data-color="${c}"><i style="background:${c}"></i></button>`).join('')}</div><div class="pv-annotation-tools">${tools.map(([id,name,path])=>`<button type="button" data-tool="${id}" aria-label="${name}" title="${name}">${svg(path)}</button>`).join('')}</div>`;
 const hint=document.createElement('div');hint.className='pv-annotation-hint';hint.setAttribute('role','status');toolbar.prepend(hint);const eraserCursor=document.createElement('div');eraserCursor.className='pv-annotation-eraser';eraserCursor.hidden=true;layer.appendChild(eraserCursor);
 layer.appendChild(toolbar);host.appendChild(layer);const ctx=canvas.getContext('2d');let shapes=[],undo=[],redo=[],draft=null,gesture=null,selected=-1,tool='brush',color=COLORS[0],width=7,closed=false,textField=null,sceneSelection='';
 function remember(){undo.push(clone(shapes));if(undo.length>80)undo.shift();redo=[];}
 function draw(){ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(base,0,0);shapes.forEach(s=>paint(ctx,s));if(draft)paint(ctx,draft);if(selected>=0&&shapes[selected]){const b=bounds(shapes[selected]),scale=canvas.width/canvas.getBoundingClientRect().width;ctx.save();ctx.strokeStyle='#19c8ee';ctx.lineWidth=2*scale;ctx.setLineDash([5*scale,4*scale]);ctx.strokeRect(b.x-8*scale,b.y-8*scale,b.w+16*scale,b.h+16*scale);ctx.restore();}hint.textContent=tool==='select'?(selected>=0?'拖动移动标注 · Delete 删除 · Ctrl+Z 撤销':sceneSelection?'已选中 '+sceneSelection: onScenePick?'点击选择模型、机位或已绘制的标注':shapes.length?'点击标注进行选择，再拖动移动':'先绘制标注，再点击选择并拖动') : tool==='erase'?(shapes.length?'点击或拖过标注即可擦除 · Ctrl+Z 撤销':'暂无标注可擦除，请先绘制') : '';hint.hidden=!hint.textContent;}
 function sync(){toolbar.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tool===tool)));toolbar.querySelectorAll('[data-stroke]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.stroke)===width)));toolbar.querySelectorAll('[data-color]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.color===color)));eraserCursor.hidden=true;canvas.style.cursor=tool==='select'?'default':tool==='text'?'text':tool==='erase'?'none':'crosshair';draw();}
 function point(e){const r=canvas.getBoundingClientRect();return{x:(e.clientX-r.left)/r.width*canvas.width,y:(e.clientY-r.top)/r.height*canvas.height};}
 function find(p,interior=false){const tolerance=8*canvas.width/canvas.getBoundingClientRect().width;for(let i=shapes.length-1;i>=0;i--){const b=bounds(shapes[i]);if(hit(shapes[i],p,tolerance)||interior&&p.x>=b.x&&p.x<=b.x+b.w&&p.y>=b.y&&p.y<=b.y+b.h)return i;}return -1;}
 function eraseBetween(a,b){const radius=12*canvas.width/canvas.getBoundingClientRect().width;shapes=shapes.filter(s=>!sweptHit(s,a,b,radius));}
 function commitText(){if(!textField)return;const field=textField;textField=null;if(field.value.trim()){remember();ctx.font=`${width*5}px sans-serif`;shapes.push({type:'text',text:field.value.trim(),textWidth:ctx.measureText(field.value.trim()).width,start:field.annotationPoint,color,width});}field.remove();draw();}
 function addText(p){commitText();textField=document.createElement('input');textField.className='pv-annotation-text';textField.setAttribute('aria-label','标注文字');textField.placeholder='输入文字';textField.maxLength=200;textField.annotationPoint=p;const r=canvas.getBoundingClientRect(),h=layer.getBoundingClientRect();textField.style.left=Math.min(h.width-190,r.left-h.left+p.x/canvas.width*r.width)+'px';textField.style.top=Math.max(0,r.top-h.top+p.y/canvas.height*r.height-25)+'px';layer.appendChild(textField);textField.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();commitText();canvas.focus();}if(e.key==='Escape'){textField.remove();textField=null;canvas.focus();}});textField.focus();}
 function end(e,cancel=false){if(!gesture||e&&e.pointerId!==gesture.pointer)return;const old=gesture;gesture=null;if(canvas.hasPointerCapture(old.pointer))canvas.releasePointerCapture(old.pointer);if(cancel){if(old.before)shapes=old.before;draft=null;draw();return;}if(draft){remember();shapes.push(draft);draft=null;}else if(old.before&&JSON.stringify(shapes)!==JSON.stringify(old.before)){undo.push(old.before);if(undo.length>80)undo.shift();redo=[];}draw();}
 canvas.addEventListener('pointerdown',e=>{if(e.button!==0||gesture)return;e.preventDefault();commitText();canvas.focus();const p=point(e);selected=-1;if(tool==='text'){addText(p);return;}gesture={pointer:e.pointerId,start:p,previous:p};canvas.setPointerCapture(e.pointerId);if(tool==='select'||tool==='erase'){gesture.before=clone(shapes);if(tool==='erase')eraseBetween(p,p);else{selected=find(p,true);gesture.original=selected>=0?clone(shapes[selected]):null;if(selected<0&&onScenePick){sceneSelection=onScenePick(e.clientX,e.clientY,canvas.getBoundingClientRect())||'';base.getContext('2d').drawImage(source,0,0,base.width,base.height);}}}else draft=tool==='brush'?{type:tool,points:[p],width,color}:{type:tool,start:p,end:p,width,color};draw();});
 canvas.addEventListener('pointermove',e=>{const p=point(e);if(tool==='erase'){const r=layer.getBoundingClientRect();eraserCursor.style.left=(e.clientX-r.left)+'px';eraserCursor.style.top=(e.clientY-r.top)+'px';eraserCursor.hidden=false;}else if(tool==='select')canvas.style.cursor=find(p,true)>=0?'move':'default';if(!gesture||gesture.pointer!==e.pointerId)return;if(draft){if(draft.points){if(draft.points.length<10000&&distance(p,draft.points.at(-1),draft.points.at(-1))>.5)draft.points.push(p);}else draft.end=p;}else if(tool==='select'&&gesture.original){shapes[selected]=translate(gesture.original,p.x-gesture.start.x,p.y-gesture.start.y);}else if(tool==='erase')eraseBetween(gesture.previous,p);gesture.previous=p;draw();});
 canvas.addEventListener('pointerleave',()=>eraserCursor.hidden=true);
 canvas.addEventListener('pointerup',e=>end(e));canvas.addEventListener('pointercancel',e=>end(e,true));canvas.addEventListener('lostpointercapture',e=>end(e,true));
 function close(){if(closed)return;closed=true;end(null,true);layer.remove();window.removeEventListener('keydown',keydown,true);onClose?.();}
 async function complete(){commitText();end(null);selected=-1;draw();const output=document.createElement('canvas');output.width=base.width;output.height=base.height;const context=output.getContext('2d');context.drawImage(base,0,0);shapes.forEach(s=>paint(context,s));const done=toolbar.querySelector('[data-tool=done]');done.disabled=true;try{const blob=await new Promise(resolve=>output.toBlob(resolve,'image/png'));if(!blob)throw Error('标注图片生成失败');if(closed)return;await onComplete(new File([blob],'运镜轨迹标注.png',{type:'image/png'}));close();}catch(error){onError?.(error);if(!closed)done.disabled=false;}}
 toolbar.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;commitText();end(null);if(b.dataset.tool==='exit'){close();return;}if(b.dataset.tool==='done'){complete();return;}if(b.dataset.tool){tool=b.dataset.tool;selected=-1;}if(b.dataset.color)color=b.dataset.color;if(b.dataset.stroke)width=Number(b.dataset.stroke);sync();canvas.focus();});
 const keydown=e=>{if(closed||e.target===textField)return;e.stopImmediatePropagation();if(e.key==='Escape'){e.preventDefault();close();return;}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();end(null,true);const from=e.shiftKey?redo:undo,to=e.shiftKey?undo:redo;if(from.length){to.push(clone(shapes));shapes=from.pop();selected=-1;draw();}}if(['Delete','Backspace'].includes(e.key)&&selected>=0){e.preventDefault();remember();shapes.splice(selected,1);selected=-1;draw();}};
 window.addEventListener('keydown',keydown,true);sync();canvas.focus();return{close,get element(){return layer;}};
};
})();
