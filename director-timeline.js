/* Director timeline UI. Data and sampling are independent of the DOM. */
(function () {
'use strict';
window.createDirectorTimeline = function (h) {
const {S,esc,ICONS,toast,persist,pushUndo,selectObject,renderInspector,setPlayhead,setPlaying}=h;
const A=window.DirectorAnimation;
const titles={position:'位置',rotation:'旋转',scale:'缩放',target:'注视坐标',fov:'视野角度',pose:'上身与头部姿态'};
const labels={'位置':'position','旋转':'rotation','缩放':'scale','注视坐标':'target','视野角度 (FOV)':'fov','横滚 (Roll)':'rotation.z','统一缩放':'scale'};
const pathTitles={circle:'圆环路径',line:'直线路径',rectangle:'矩形路径',pencil:'铅笔路径',pen:'钢笔路径'};
const pathIcons={circle:'<ellipse cx="8" cy="8" rx="6" ry="5"/>',line:'<path d="M2 14 14 2"/>',rectangle:'<rect x="2" y="3" width="12" height="10" rx="1"/>',pencil:'<path d="m2 12 4-7 4 5 4-7"/>',pen:'<path d="M2 13C2 2 14 14 14 3"/><rect x="1" y="12" width="2" height="2"/><rect x="13" y="2" width="2" height="2"/>'};
let selected=new Set(),expanded=new Set(),axisExpanded=new Set(),clipboard=[],pathLines=[],drawing=null,dragCleanup=null,timeScrubCleanup=null,openMenu=null,valueEdit=null;
const fps=()=>S.project.sequence.fps,duration=()=>S.project.sequence.durationFrames;
const trackOf=id=>S.project.objectAnimationTracks.find(t=>t.objectId===id),objectOf=id=>S.project.objects.find(o=>o.id===id);
const allEntries=()=>S.project.objectAnimationTracks.flatMap(t=>A.entries(t));
const sampled=obj=>A.sampleObject(obj,trackOf(obj.id),S.playhead),groupOf=label=>labels[label]||label;
function track(id){let t=trackOf(id);if(!t){t={objectId:id,channels:{},keys:[]};S.project.objectAnimationTracks.push(t);}return A.normalizeTrack(t);}
function writable(id=S.selectedId){const obj=objectOf(id);if(!obj){toast('请先选择角色、道具或机位');return null;}if(window.DirectorCrowd?.inherited(S.project,id,'locked')||trackOf(id)?.locked){toast('此对象或轨道已锁定');return null;}return obj;}
function init(){
 A.migrate(S.project);selected.clear();expanded.clear();axisExpanded.clear();clipboard=[];
 if(S.project.timeline.uiVersion!==2){if(!S.project.timeline.height||S.project.timeline.height===220)S.project.timeline.height=128;if(!S.project.timeline.zoom||S.project.timeline.zoom===3)S.project.timeline.zoom=212/fps();S.project.timeline.uiVersion=2;}
 S.workArea=S.project.sequence.workArea.slice();S.timelineZoom=S.project.timeline.zoom||3;S.loopWorkArea=!!S.project.timeline.loop;S.autoKey=!!S.project.timeline.autoKey;S.sampledObjects=new Map();
 const shell=S.el.shell.querySelector('.director-shell');shell.classList.add('dt-animation-workspace');shell.appendChild(S.el.timeline);
 const toolbar=S.el.timeline.querySelector('.director-timeline-toolbar');
 toolbar.innerHTML=`<div class="dtl-transport"><button data-dt-play aria-label="播放" title="播放 Space">${ICONS.play}</button><button id="dtAutoKey" title="自动帧" aria-label="自动帧"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="14" r="7"/><path d="M12 7V3m-3 0h6m-3 8v4m6-10 2 2"/></svg></button><button data-dt-loop title="循环播放" aria-label="循环播放"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14-1v3a2 2 0 0 1-2 2H3"/></svg></button><div class="dtl-time-group"><input id="dtTimecodeInput" aria-label="播放头位置"><input id="dtDurationSec" type="number" min="0.1" max="3600" step="0.1" aria-label="总时长"><button data-dtl-unit title="切换时间单位">s</button></div><button data-dtl-track="toggle" aria-label="新建轨道">＋ 新建轨道</button></div><div class="dtl-ruler-viewport"><div class="dtl-header-ruler"></div></div><div class="dtl-actions"><input type="range" id="dtZoom" aria-label="时间轴缩放" min="0.025" max="16" step="0.025" value="3"><button data-dt-timeline-collapse title="时间线最小化" aria-label="时间线最小化"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 15h18"/></svg></button><select id="dtExportFps" aria-label="导出帧率"><option value="30">30 帧/秒</option><option value="60">60 帧/秒</option></select><button class="dtl-export" data-dt-record title="导出当前机位视频到画布">导出视频到画布</button></div><div class="dtl-settings" hidden><button data-dt-key-nav="prev" title="上一个关键帧">◀◆</button><button data-dt-keyframe="all">＋关键帧</button><button data-dt-key-nav="next" title="下一个关键帧">◆▶</button><button data-dt-key-copy title="复制关键帧 Ctrl+C">复制</button><button data-dt-key-paste title="粘贴关键帧 Ctrl+V">粘贴</button><button data-dt-key-delete title="删除选中关键帧 Delete">删除</button><select id="dtInterp" aria-label="关键帧插值"><option value="linear">线性</option><option value="ease">平滑</option><option value="ease-in">缓入</option><option value="ease-out">缓出</option><option value="hold">保持</option></select><label>入点 <input id="dtWorkIn" type="number" min="0" aria-label="工作区入点"></label><label>出点 <input id="dtWorkOut" type="number" min="1" aria-label="工作区出点"></label><span class="dtl-hint">Shift 多选 · 拖动关键帧 · Alt 关闭吸附 · Ctrl/Cmd+C/V</span></div>`;
 toolbar.querySelector('.dtl-header-ruler').addEventListener('pointerdown',pointerDown);
 toolbar.querySelector('#dtExportFps').value=String(S.project.timeline.exportFps===60?60:30);
 toolbar.querySelector('#dtExportFps').addEventListener('change',e=>{S.project.timeline.exportFps=Number(e.target.value)===60?60:30;persist();});
 toolbar.addEventListener('contextmenu',e=>{if(e.target.closest('input,select'))return;e.preventDefault();const panel=toolbar.querySelector('.dtl-settings');panel.hidden=!panel.hidden;S.el.timeline.classList.toggle('dtl-advanced',!panel.hidden);});
 const fields={timecodeInput:'#dtTimecodeInput',durationSec:'#dtDurationSec',frameNumber:'#dtFrameNumber',workIn:'#dtWorkIn',workOut:'#dtWorkOut',interpSelect:'#dtInterp',autoKeyBtn:'#dtAutoKey',playBtn:'[data-dt-play]',loopBtn:'[data-dt-loop]',zoomInput:'#dtZoom',recordBtn:'[data-dt-record]'};
 for(const [k,q]of Object.entries(fields))S.el[k]=toolbar.querySelector(q);
 bindTimeScrub(S.el.timecodeInput,false);bindTimeScrub(S.el.durationSec,true);
 S.el.zoomInput.value=S.timelineZoom;S.el.timeline.style.height=(S.project.timeline.height||128)+'px';S.el.timeline.classList.remove('dtl-minimized','dtl-advanced');
 S.el.timeline.querySelector('.dt-resize-handle').setAttribute('aria-label','拖拽调整时间轴高度');S.el.trackContent.tabIndex=0;S.el.trackContent.setAttribute('aria-label','动画时间轴');
 S.el.trackScroll.addEventListener('scroll',()=>{S.el.trackLabels.scrollTop=S.el.trackScroll.scrollTop;syncHeader();});
 S.el.trackLabels.addEventListener('wheel',e=>{e.preventDefault();S.el.trackScroll.scrollTop+=e.deltaY;},{passive:false});
 S.el.trackScroll.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();zoom(S.timelineZoom*(e.deltaY>0?.85:1.15));}},{passive:false});
 S.el.timeline.addEventListener('click',click);S.el.shell.addEventListener('click',pathClick);S.el.shell.addEventListener('input',pathChange);S.el.shell.addEventListener('focusin',e=>{if(e.target.matches('[data-dtl-path-field],[data-dtl-path-vector]'))h.beginBatch?.();});S.el.shell.addEventListener('focusout',e=>{if(e.target.matches('[data-dtl-path-field],[data-dtl-path-vector]'))h.endBatch?.();});S.el.trackContent.addEventListener('pointerdown',pointerDown);
 S.el.timeline.addEventListener('focusin',e=>{if(!e.target.matches('[data-dtl-edit-value]'))return;if(valueEdit)h.endBatch?.();valueEdit={input:e.target,changed:false};h.beginBatch?.();});
 S.el.timeline.addEventListener('focusout',e=>{if(valueEdit?.input!==e.target)return;const changed=valueEdit.changed;valueEdit=null;h.endBatch?.();if(changed)refresh(true);});
 S.el.timeline.addEventListener('input',e=>{const input=e.target,channel=input.dataset.dtlEditValue;if(!channel||input.value===''||S.recording)return;const obj=writable(input.dataset.object),value=Number(input.value);if(!obj||!Number.isFinite(value))return;pushUndo();const previous=sampled(obj);A.write(obj,channel,value);const t=trackOf(obj.id);if(S.autoKey||t?.channels[channel]?.length){const dest=track(obj.id);if(S.autoKey&&S.playhead>0&&!dest.channels[channel]?.length)A.putKey(dest,channel,0,A.read(previous,channel));A.putKey(dest,channel,S.playhead,value,S.interpMode||'linear');}if(valueEdit)valueEdit.changed=true;persist();h.sampleAtFrame(S.playhead);updateUI();});
 S.el.timeline.addEventListener('keydown',e=>{if(!e.target.matches('[data-dtl-edit-value]'))return;if(e.key==='Enter')e.target.blur();if(e.key==='Escape')e.target.blur();});
 S.el.trackContent.addEventListener('dblclick',e=>{const row=e.target.closest('[data-dtl-channel]');if(row&&!e.target.closest('.dt-keyframe')){selectObject(row.dataset.object);setPlayhead(frameAt(e.clientX));keyframe(row.dataset.dtlChannel);}});
 S.el.trackContent.addEventListener('contextmenu',contextMenu);S.el.holder.addEventListener('pointerdown',drawPointer,true);S.el.holder.addEventListener('dblclick',e=>{if(drawing){e.preventDefault();e.stopPropagation();finishDraw();}},true);syncMeta();
}
function bindTimeScrub(input,total){
 input.title=(total?'总时长':'播放头位置')+' · 左键左右拖动或滚轮调整，Shift 精细调整';
 input.setAttribute('data-no-scrub', '');
 input.classList.add('dtl-time-scrub');
 input.addEventListener('wheel',e=>{
  if(S.recording||(total&&S.readOnly)||input.disabled||input.readOnly)return;
  const steps=window.CanvasFlowScrub?.wheelSteps(e,input);if(!steps)return;
  const next=(total?duration():S.playhead)+steps*(e.shiftKey?1:Math.max(1,Math.round(fps()/10)));
  setPlaying(false);if(total){h.beginBatch?.();try{setDuration(next);}finally{h.endBatch?.();}persist();}else setPlayhead(A.clamp(next,0,duration()-1));
  syncMeta();
 },{passive:false});
 input.addEventListener('pointerdown',e=>{
  if(e.button!==0||S.recording)return;
  e.preventDefault();e.stopPropagation();timeScrubCleanup?.();
  const startX=e.clientX,startFrame=total?duration():S.playhead,pointer=e.pointerId,oldCursor=document.body.style.cursor;
  let moved=false;
  input.focus();input.setPointerCapture?.(pointer);
  const cleanup=()=>{
   window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);window.removeEventListener('blur',finish);
   if(input.hasPointerCapture?.(pointer))input.releasePointerCapture(pointer);
   input.classList.remove('is-scrubbing');document.body.style.cursor=oldCursor;timeScrubCleanup=null;
  };
  const finish=()=>{
   cleanup();if(moved){if(total){h.endBatch?.();persist();}input.blur();syncMeta();}else input.select();
  };
  const move=ev=>{
   if(ev.pointerId!==pointer)return;
   const dx=ev.clientX-startX;if(!moved&&Math.abs(dx)<3)return;
   ev.preventDefault();
   if(!moved){moved=true;setPlaying(false);if(total)h.beginBatch?.();input.classList.add('is-scrubbing');document.body.style.cursor='ew-resize';}
   const frames=Math.round(startFrame+dx*(ev.shiftKey ? 0.1 : 0.5));
   if(total)setDuration(frames);else setPlayhead(A.clamp(frames,0,duration()-1));
   const value=total?duration():S.playhead,unit=S.project.timeline.unit;
   input.value=unit==='f'?value:unit==='ms'?Math.round(value/fps()*1000):(value/fps()).toFixed(2);
  };
  const up=ev=>{if(ev.pointerId===pointer)finish();};
  timeScrubCleanup=()=>{cleanup();if(moved&&total)h.endBatch?.();};
  window.addEventListener('pointermove',move,{passive:false});window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);window.addEventListener('blur',finish);
 });
}
function syncMeta(){
 if(!S.el.timeline)return;const unit=S.project.timeline.unit||'s',factor=unit==='ms'?1000:unit==='f'?fps():1;
 if(document.activeElement!==S.el.timecodeInput)S.el.timecodeInput.value=unit==='f'?S.playhead:(S.playhead/fps()*factor).toFixed(unit==='s'?2:0);
 if(document.activeElement!==S.el.durationSec)S.el.durationSec.value=(duration()/fps()*factor).toFixed(unit==='s'?2:0);
 S.el.durationSec.max=unit==='ms'?3600000:unit==='f'?fps()*3600:3600;S.el.durationSec.step=unit==='s'?.1:1;
 const unitButton=S.el.timeline.querySelector('[data-dtl-unit]');unitButton.textContent=unit;const nextUnit={s:'ms',ms:'f',f:'s'}[unit];unitButton.title='切换时间单位为 '+nextUnit;unitButton.setAttribute('aria-label',unitButton.title);
 for(const [b,on]of [[S.el.autoKeyBtn,S.autoKey],[S.el.loopBtn,S.loopWorkArea]]){b.classList.toggle('is-active',on);b.setAttribute('aria-pressed',String(on));}
 if(document.activeElement!==S.el.workIn)S.el.workIn.value=S.workArea[0];if(document.activeElement!==S.el.workOut)S.el.workOut.value=S.workArea[1];
 S.el.workIn.max=S.workArea[1]-1;S.el.workOut.max=duration()-1;
 const obj=objectOf(S.selectedId),button=S.el.timeline.querySelector('[data-dtl-track]'),bound=!!trackOf(S.selectedId);
 button.disabled=!obj||obj.kind==='camera'||!!trackOf(S.selectedId)?.locked||!!window.DirectorCrowd?.inherited(S.project,S.selectedId,'locked');button.dataset.dtlTrack=bound?'remove':'add';button.textContent=bound?'− 移除轨道':'＋ 新建轨道';button.setAttribute('aria-label',bound?'移除轨道':'新建轨道');button.title=bound?'解除当前对象的动画轨道，保留场景对象':'选中角色、道具或分组后建立轨道';
 S.el.timeline.querySelector('#dtExportFps').disabled=!!S.recording;
}
function timelineObjects(){
 const objects=S.project.objects.filter(o=>o.kind!=='camera'&&!!trackOf(o.id));
 const camera=h.activeCameraObj();if(camera)objects.push(camera);
 return objects;
}
function refresh(preserveLabels=false){
 if(!S.el.trackContent||!S.project)return;S.project.objectAnimationTracks.forEach(A.normalizeTrack);const liveKeys=new Set(allEntries().map(e=>e.key.id));selected=new Set([...selected].filter(id=>liveKeys.has(id)));
 const left=S.el.trackScroll.scrollLeft,top=S.el.trackScroll.scrollTop,z=S.timelineZoom;
 let label='',rows='';
 const addRow=(lh,body,cls='',attrs='')=>{label+=`<div class="dt-track-label ${cls}" ${attrs}>${lh}</div>`;rows+=`<div class="dt-track-row ${cls}" ${attrs}><div class="dt-track">${body}</div></div>`;};
 const markers=(t,group)=>{const byFrame=new Map();for(const e of A.entries(t,group)){const list=byFrame.get(e.key.frame)||[];list.push(e);byFrame.set(e.key.frame,list);}const baked=[...byFrame].filter(([,ee])=>ee.every(e=>e.key.source==='path')).map(([f])=>f).sort((a,b)=>a-b);return [...byFrame].filter(([f,ee])=>ee.some(e=>e.key.source!=='path')||f===baked[0]||f===baked.at(-1)).map(([f,ee])=>`<button class="dt-keyframe ${ee.some(e=>selected.has(e.key.id))?'is-selected':''}" style="left:${f*z}px" data-dtl-keys="${ee.map(e=>e.key.id).join(',')}" data-object="${esc(t.objectId)}" aria-label="${esc(titles[group]||group||'变换')}关键帧 ${(f/fps()).toFixed(2)}秒" title="${f}f · ${(f/fps()).toFixed(2)}s · ${ee[0].key.interp}"></button>`).join('');};
 const visible=timelineObjects(),cam=h.activeCameraObj();
 for(const obj of visible){const t=trackOf(obj.id),ex=expanded.has(obj.id),active=S.selectedId===obj.id,master=obj.id===cam?.id;const range=A.trackRange(t);
 addRow(`<button class="dtl-chevron" data-dtl-expand="${esc(obj.id)}" aria-label="${ex?'收起':'展开'}${esc(obj.name)}属性" aria-expanded="${ex}">${ex?'⌄':'›'}</button><button class="dtl-track-name" data-dtl-select="${esc(obj.id)}" title="${esc(obj.name)}">${esc(master?'主机位 · '+obj.name:obj.name)}</button><button class="dtl-path-button" data-dtl-path-menu="${esc(obj.id)}">◎ 绘制轨迹</button>`,`${range&&range.end>range.start?`<div class="dtl-span ${active?'is-active':''}" style="left:${range.start*z}px;width:${(range.end-range.start)*z}px" data-dtl-range="${esc(obj.id)}" title="拖动动画区间；拖动两端调整时长"><i data-edge="start"></i><i data-edge="end"></i></div>`:''}`,'dtl-object-row'+(active?' is-selected':'')+(t?.muted?' is-muted':'')+(master?' dtl-master-row':''),`data-object="${esc(obj.id)}"`);
 if(!ex)continue;
 for(const group of obj.kind==='camera'?['position','rotation','target','fov']:obj.kind==='character'?['position','rotation','scale','pose']:['position','rotation','scale']){
 const valueInput=channel=>`<input class="dtl-channel-input" type="number" step="0.1" data-dtl-edit-value="${channel}" data-object="${esc(obj.id)}" aria-label="${esc(obj.name)} ${titles[group]} ${channel.includes('.')?channel.slice(-1).toUpperCase():''}" value="${A.read(sampled(obj),channel)}" ${t?.locked||window.DirectorCrowd?.inherited(S.project,obj.id,'locked')?'disabled':''}>`;const ch=A.channels(group),ee=t?A.entries(t,group):[],sub=axisExpanded.has(obj.id+group);
 const nav=`<button data-dtl-nav="-1" data-object="${esc(obj.id)}" data-group="${group}" title="上一${titles[group]}关键帧">‹</button><button class="dtl-key-toggle ${ee.some(e=>e.key.frame===S.playhead)?'is-active':''}" data-dtl-add-key="${group}" data-object="${esc(obj.id)}" title="在当前帧添加${titles[group]}关键帧">◆</button><button data-dtl-nav="1" data-object="${esc(obj.id)}" data-group="${group}" title="下一${titles[group]}关键帧">›</button>`;
 addRow(`<button class="dtl-property-name" data-dtl-axis-expand="${group}" data-object="${esc(obj.id)}">${ch.length>1?(sub?'⌄':'›'):''} ${titles[group]}</button><span class="dtl-key-nav">${nav}</span>${ch.length===1?valueInput(ch[0]):`<span class="dtl-channel-value" data-dtl-value="${group}" data-object="${esc(obj.id)}"></span>`}`,t?markers(t,group):'','dtl-property-row',`data-dtl-channel="${group}" data-object="${esc(obj.id)}"`);
 if(sub&&ch.length>1)for(const channel of ch)addRow(`<span class="dtl-axis-label">${channel.slice(-1).toUpperCase()}</span><button class="dtl-key-toggle" data-dtl-add-key="${channel}" data-object="${esc(obj.id)}" title="添加 ${channel} 关键帧">◆</button>${valueInput(channel)}`,t?markers(t,channel):'','dtl-axis-row',`data-dtl-channel="${channel}" data-object="${esc(obj.id)}"`);
 }
 }
 if(!cam)addRow('<span class="dtl-track-name">主机位</span>','','dtl-master-row');
 const step=[1/fps(),.1,.25,.5,1,2,5,10,30,60,120,300].find(s=>s*fps()*z>=130)||600;
 let ruler='<div class="dt-ruler">';for(let s=0;s<=duration()/fps();s+=step)ruler+=`<span style="left:${s*fps()*z}px">${Number(s.toFixed(2))}s</span>`;ruler+='</div>';
 if(!preserveLabels)S.el.trackLabels.innerHTML=label;S.el.trackContent.style.width=Math.max(duration()*z+28,S.el.trackScroll.clientWidth)+'px';
 S.el.timeline.querySelector('.dtl-header-ruler').innerHTML=ruler+'<div class="dtl-header-playhead"></div>';
 S.el.trackContent.innerHTML=`<div class="dtl-workarea" style="left:${S.workArea[0]*z}px;width:${(S.workArea[1]-S.workArea[0])*z}px"><i data-dtl-work="in" title="拖动工作区入点"></i><i data-dtl-work="out" title="拖动工作区出点"></i></div>`+rows+`<div class="dt-playhead" role="slider" tabindex="0" aria-label="动画时间轴播放头" aria-valuemin="0" aria-valuemax="${duration()-1}" aria-valuenow="${S.playhead}" style="left:${S.playhead*z}px"></div>`;
 S.el.timeline.style.setProperty('--dtl-tick',(step*fps()*z/10)+'px');syncHeader();S.el.trackScroll.scrollLeft=left;S.el.trackScroll.scrollTop=top;S.el.trackLabels.scrollTop=top;syncMeta();updateUI();renderPaths();
}
function revealSelected(){
 const viewport=S.el.trackScroll;if(!viewport||!viewport.clientHeight)return;
 const rows=[...S.el.trackContent.querySelectorAll('.dt-track-row[data-object]')].filter(row=>row.dataset.object===S.selectedId);
 if(!rows.length)return;
 const v=viewport.getBoundingClientRect(),first=rows[0].getBoundingClientRect(),last=rows[rows.length-1].getBoundingClientRect();
 if(first.top<v.top||last.bottom>v.bottom)viewport.scrollTop+=first.top-v.top;
 S.el.trackLabels.scrollTop=viewport.scrollTop;
}
function syncHeader(){const header=S.el.timeline?.querySelector('.dtl-header-ruler');if(!header)return;header.style.width=S.el.trackContent.style.width;header.style.transform=`translateX(${-S.el.trackScroll.scrollLeft}px)`;const handle=header.querySelector('.dtl-header-playhead');if(handle)handle.style.left=S.playhead*S.timelineZoom+'px';}
function updateUI(){
 if(!S.el.timeline)return;syncMeta();syncHeader();
 const frameLabel=S.el.inspector.querySelector('.dt-obj-header-side strong');if(frameLabel)frameLabel.textContent=String(S.playhead);
 for(const b of S.el.trackLabels.querySelectorAll('[data-dtl-add-key]')){const t=trackOf(b.dataset.object);b.classList.toggle('is-active',!!t&&A.entries(t,b.dataset.dtlAddKey).some(e=>e.key.frame===S.playhead));}
 for(const input of S.el.trackLabels.querySelectorAll('[data-dtl-edit-value]')){if(document.activeElement!==input){const obj=objectOf(input.dataset.object);if(obj)input.value=Number(A.read(sampled(obj),input.dataset.dtlEditValue).toFixed(3));}}
 for(const node of S.el.trackLabels.querySelectorAll('[data-dtl-value]')){const obj=objectOf(node.dataset.object);if(obj)node.textContent=A.channels(node.dataset.dtlValue).map(c=>Number(A.read(sampled(obj),c).toFixed(2))).join(', ');}
 S.el.trackContent.querySelector('.dt-playhead')?.setAttribute('aria-valuenow',S.playhead);
 const obj=objectOf(S.selectedId);
 if(obj&&!drawing){const value=h.inspectorSample?.(obj)||sampled(obj);for(const input of S.el.inspector.querySelectorAll('[data-dt-axis]')){if(document.activeElement===input)continue;const channel=groupOf(input.dataset.dtProp)+'.'+input.dataset.dtAxis.toLowerCase();if(A.channels(channel).length)input.value=Number(A.read(value,channel).toFixed(3));}for(const b of S.el.inspector.querySelectorAll('[data-dt-keyframe]'))b.classList.toggle('is-active',hasKey(b.dataset.dtKeyframe));for(const input of S.el.inspector.querySelectorAll('[data-dt-range],[data-dt-range-value]')){const label=input.dataset.dtRange||input.dataset.dtRangeValue,ch=label==='视野角度 (FOV)'?'fov':label==='横滚 (Roll)'?'rotation.z':label==='统一缩放'?'scale.x':null;if(ch&&document.activeElement!==input)input.value=Number((A.read(value,ch)/(label==='统一缩放'?(h.uniformScaleBase?.(obj)||1):1)).toFixed(3));}}
 if(S.playing){const x=S.playhead*S.timelineZoom,v=S.el.trackScroll;if(x>v.scrollLeft+v.clientWidth-35||x<v.scrollLeft)v.scrollLeft=Math.max(0,x-v.clientWidth*.25);}
}
function hasKey(label){const t=trackOf(S.selectedId);return !!t&&A.entries(t,groupOf(label)).some(e=>e.key.frame===S.playhead);}
function keyframe(label='all',quiet=false){
 const obj=writable();if(!obj)return;if(!quiet)pushUndo();
 const t=track(obj.id),group=groupOf(label),value=sampled(obj),chs=label==='all'?['position','rotation','scale'].flatMap(A.channels):A.channels(group);
 for(const ch of chs)A.putKey(t,ch,S.playhead,A.read(value,ch),S.interpMode||'linear');
 expanded.add(obj.id);persist();refresh();renderInspector();if(!quiet)toast('已添加'+(titles[group]||'变换')+'关键帧');
}
function edit(obj,label,previous){
 const group=groupOf(label),t=trackOf(obj.id);
 if(S.autoKey||(t&&A.entries(t,group).length))for(const ch of A.channels(group)){
   const dest=track(obj.id);if(S.autoKey&&previous&&S.playhead>0&&!dest.channels[ch]?.length)A.putKey(dest,ch,0,A.read(previous,ch),S.interpMode||'linear');
   A.putKey(dest,ch,S.playhead,A.read(obj,ch),S.interpMode||'linear');
 }
 persist();refresh();
}
function selectedEntries(){const own=trackOf(S.selectedId);return selected.size?allEntries().filter(e=>selected.has(e.key.id)):own?A.entries(own).filter(e=>e.key.frame===S.playhead):[];}
function copy(){const ee=selectedEntries();if(!ee.length)return toast('先选择关键帧');const start=Math.min(...ee.map(e=>e.key.frame));clipboard=ee.map(e=>({objectId:e.track.objectId,channel:e.channel,key:A.clone(e.key),offset:e.key.frame-start}));toast(`已复制 ${new Set(ee.map(e=>e.key.frame)).size} 组关键帧`);}
function paste(){
 if(!clipboard.length)return toast('没有已复制的关键帧');const single=new Set(clipboard.map(c=>c.objectId)).size===1;
 const targets=clipboard.map(c=>({c,obj:objectOf(single&&S.selectedId?S.selectedId:c.objectId)})).filter(x=>x.obj&&!window.DirectorCrowd?.inherited(S.project,x.obj.id,'locked')&&!trackOf(x.obj.id)?.locked);
 if(!targets.length)return toast('目标轨道不可编辑');pushUndo();selected.clear();
 for(const {c,obj}of targets){const frame=S.playhead+c.offset;if(frame>=duration())continue;const k=A.putKey(track(obj.id),c.channel,frame,c.key.value,c.key.interp);selected.add(k.id);expanded.add(obj.id);}
 persist();refresh();h.sampleAtFrame(S.playhead);toast('已粘贴关键帧');
}
function removeKeys(){const ee=selectedEntries().filter(e=>!e.track.locked&&!window.DirectorCrowd?.inherited(S.project,e.track.objectId,'locked'));if(!ee.length)return toast('没有可删除的关键帧');pushUndo();const ids=new Set(ee.map(e=>e.key.id));for(const t of S.project.objectAnimationTracks)for(const ch of Object.keys(t.channels))t.channels[ch]=t.channels[ch].filter(k=>!ids.has(k.id));selected.clear();persist();refresh();h.sampleAtFrame(S.playhead);}
function navigate(dir,objectId=S.selectedId,group){const t=trackOf(objectId),frames=[...new Set((t?A.entries(t,group):allEntries()).map(e=>e.key.frame))].sort((a,b)=>a-b);const f=dir>0?frames.find(f=>f>S.playhead):frames.reverse().find(f=>f<S.playhead);if(f!==undefined)setPlayhead(f);}
function interpolate(mode){S.interpMode=mode;const ee=selectedEntries();if(ee.length){pushUndo();ee.forEach(e=>{if(!e.track.locked&&!window.DirectorCrowd?.inherited(S.project,e.track.objectId,'locked'))e.key.interp=mode;});persist();refresh();}}
function frameAt(x){return A.clamp(Math.round((x-S.el.trackContent.getBoundingClientRect().left)/S.timelineZoom),0,duration()-1);}
function gesture(e,onMove,onEnd){
 if(dragCleanup)dragCleanup();const pointer=e.pointerId,root=e.currentTarget;
 // Capture on the stable container: refresh replaces the clip/key DOM during a drag.
 root?.setPointerCapture?.(pointer);
 const move=ev=>{if(ev.pointerId===pointer)onMove(ev);},finish=ev=>{cleanup();onEnd?.(ev);},up=ev=>{if(ev.pointerId===pointer)finish(ev);};
 const cleanup=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);window.removeEventListener('blur',finish);if(root?.hasPointerCapture?.(pointer))root.releasePointerCapture(pointer);dragCleanup=null;};
 dragCleanup=cleanup;window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);window.addEventListener('blur',finish);
}
function pointerDown(e){
 if(e.button!==0||S.recording)return;e.preventDefault();setPlaying(false);
 const span=e.target.closest('[data-dtl-range]');
 if(span){const obj=writable(span.dataset.dtlRange);if(!obj)return;selectObject(obj.id);const t=trackOf(obj.id),range=A.trackRange(t),original=A.clone({track:t||null}),start=e.clientX,edge=e.target.dataset.edge;let moved=false;
  gesture(e,ev=>{const dx=ev.clientX-start;if(!moved&&Math.abs(dx)<3)return;if(!moved){pushUndo();moved=true;}const delta=Math.round(dx/S.timelineZoom),length=range.end-range.start;let from=range.start,to=range.end;
   if(edge==='start')from=A.clamp(range.start+delta,0,to-1);else if(edge==='end')to=A.clamp(range.end+delta,from+1,duration()-1);else{from=A.clamp(range.start+delta,0,Math.max(0,duration()-1-length));to=from+length;}
   const scale=(to-from)/length,map=f=>Math.round(from+(f-range.start)*scale);
   if(t){t.channels=A.clone(original.track.channels);A.entries(t).forEach(({key})=>key.frame=map(key.frame));A.normalizeTrack(t);if(original.track.path){t.path=A.clone(original.track.path);t.path.startFrame=map(t.path.startFrame);t.path.duration*=scale;}}
   h.sampleAtFrame(S.playhead);refresh();
  },()=>{if(moved){persist();renderInspector();}});return;}
 const marker=e.target.closest('[data-dtl-keys]'),work=e.target.closest('[data-dtl-work]');
 if(marker){const ids=marker.dataset.dtlKeys.split(','),obj=objectOf(marker.dataset.object);if(!obj||window.DirectorCrowd?.inherited(S.project,obj.id,'locked')||trackOf(obj.id)?.locked)return;
 if(e.shiftKey){ids.forEach(id=>selected.has(id)?selected.delete(id):selected.add(id));refresh();return;}
 if(!ids.every(id=>selected.has(id)))selected=new Set(ids);selectObject(obj.id);const start=e.clientX,original=A.clone(S.project.objectAnimationTracks);let moved=false;
 const entry=allEntries().find(k=>k.key.id===ids[0]);if(entry)setPlayhead(entry.key.frame);refresh();
 gesture(e,ev=>{if(!moved&&Math.abs(ev.clientX-start)<3)return;if(!moved){pushUndo();moved=true;}S.project.objectAnimationTracks=A.clone(original);A.moveKeys(S.project.objectAnimationTracks,selected,(ev.clientX-start)/S.timelineZoom,duration(),!ev.altKey);h.sampleAtFrame(S.playhead);refresh();},()=>{if(moved)persist();});return;}
 if(work){pushUndo();const i=work.dataset.dtlWork==='in'?0:1;gesture(e,ev=>{S.workArea[i]=A.clamp(frameAt(ev.clientX),i?S.workArea[0]+1:0,i?duration()-1:S.workArea[1]-1);S.project.sequence.workArea=S.workArea.slice();refresh();},()=>persist());return;}
 const row=e.target.closest('[data-object]');if(row)selectObject(row.dataset.object);selected.clear();setPlayhead(frameAt(e.clientX));gesture(e,ev=>setPlayhead(frameAt(ev.clientX)),()=>refresh());
}
function click(e){const b=e.target.closest('button');if(!b||S.recording)return;const d=b.dataset;
 if(d.dtlExpand){expanded.has(d.dtlExpand)?expanded.delete(d.dtlExpand):expanded.add(d.dtlExpand);refresh();}
 if(d.dtlSelect)selectObject(d.dtlSelect);
 if(d.dtlAxisExpand){const key=d.object+d.dtlAxisExpand;axisExpanded.has(key)?axisExpanded.delete(key):axisExpanded.add(key);refresh();}
 if(d.dtlAddKey){selectObject(d.object);keyframe(d.dtlAddKey);}
 if(d.dtlNav)navigate(Number(d.dtlNav),d.object,d.group);
 if(d.dtlTrack){const obj=writable();if(!obj)return;pushUndo();if(d.dtlTrack==='add'){track(obj.id);expanded.add(obj.id);}else{S.project.objectAnimationTracks=S.project.objectAnimationTracks.filter(t=>t.objectId!==obj.id);expanded.delete(obj.id);selected.clear();h.sampleAtFrame(S.playhead);}persist();refresh();renderInspector();}
 if(d.dtlMute){pushUndo();const t=track(d.dtlMute);t.muted=!t.muted;persist();refresh();h.sampleAtFrame(S.playhead);}
 if(d.dtlLock){pushUndo();const t=track(d.dtlLock);t.locked=!t.locked;persist();refresh();}
 if(d.dtlUnit!==undefined){const units=['s','ms','f'];S.project.timeline.unit=units[(units.indexOf(S.project.timeline.unit||'s')+1)%3];syncMeta();persist();}
 if(d.dtlFit!==undefined)zoom((S.el.trackScroll.clientWidth-28)/duration());
 if(d.dtlSettings!==undefined){if(S.el.timeline.classList.contains('dtl-minimized'))toggleMinimized();const p=S.el.timeline.querySelector('.dtl-settings');p.hidden=!p.hidden;S.el.timeline.classList.toggle('dtl-advanced',!p.hidden);}
}
function toggleMinimized(){const panel=S.el.timeline,on=panel.classList.toggle('dtl-minimized');if(on){S.project.timeline.height=parseFloat(panel.style.height)||128;panel.querySelector('.dtl-settings').hidden=true;panel.classList.remove('dtl-advanced');}const button=panel.querySelector('[data-dt-timeline-collapse]');button.setAttribute('aria-label',on?'展开时间线':'时间线最小化');button.title=on?'展开时间线':'时间线最小化';persist();}
function zoom(z){const scroll=S.el.trackScroll,center=(scroll.scrollLeft+scroll.clientWidth/2)/S.timelineZoom;S.timelineZoom=A.clamp(z,.025,16);S.project.timeline.zoom=S.timelineZoom;S.el.zoomInput.value=S.timelineZoom;refresh();scroll.scrollLeft=Math.max(0,center*S.timelineZoom-scroll.clientWidth/2);persist();}
function parseTime(v){const n=Number(v);if(!Number.isFinite(n))return null;return(S.project.timeline.unit==='ms'?n/1000:S.project.timeline.unit==='f'?n/fps():n)*fps();}
function setDuration(frames){if(!Number.isFinite(frames)||Math.round(frames)===duration())return;pushUndo();const old=duration();S.project.sequence.durationFrames=A.clamp(Math.round(frames),2,fps()*3600);if(S.workArea[1]===old-1)S.workArea[1]=duration()-1;S.workArea=[Math.min(S.workArea[0],duration()-2),Math.min(S.workArea[1],duration()-1)];S.project.sequence.workArea=S.workArea.slice();for(const c of S.project.cameraTrack.clips)if(c.endFrame===old)c.endFrame=duration();setPlayhead(Math.min(S.playhead,duration()-1));persist();refresh();}
function setRange(which,value){pushUndo();const i=which==='in'?0:1;S.workArea[i]=A.clamp(Math.round(Number(value)||0),i?S.workArea[0]+1:0,i?duration()-1:S.workArea[1]-1);S.project.sequence.workArea=S.workArea.slice();persist();refresh();}
function dismissMenuOutside(e){if(e.type==='pointerdown'&&openMenu?.dataset?.pathOwner&&e.target.closest?.('[data-dtl-path-menu]')?.dataset.dtlPathMenu===openMenu.dataset.pathOwner)return;if(openMenu&&!openMenu.contains(e.target))closeMenu();}
function menuKey(e){if(openMenu&&e.key==='Escape'){e.preventDefault();e.stopPropagation();closeMenu();}}
function closeMenu(){openMenu?.remove();openMenu=null;document.removeEventListener('pointerdown',dismissMenuOutside,true);document.removeEventListener('contextmenu',dismissMenuOutside,true);document.removeEventListener('keydown',menuKey,true);document.removeEventListener('wheel',dismissMenuOutside,true);window.removeEventListener('resize',closeMenu);window.removeEventListener('blur',closeMenu);}
function menuAt(x,y,html){closeMenu();openMenu=document.createElement('div');openMenu.className='dtl-menu';openMenu.setAttribute('role','menu');openMenu.innerHTML=html;S.el.shell.appendChild(openMenu);const r=openMenu.getBoundingClientRect();openMenu.style.left=Math.max(8,Math.min(x,innerWidth-r.width-8))+'px';openMenu.style.top=Math.max(8,Math.min(y-r.height,innerHeight-r.height-8))+'px';document.addEventListener('pointerdown',dismissMenuOutside,true);document.addEventListener('contextmenu',dismissMenuOutside,true);document.addEventListener('keydown',menuKey,true);document.addEventListener('wheel',dismissMenuOutside,true);window.addEventListener('resize',closeMenu);window.addEventListener('blur',closeMenu);}
function contextMenu(e){e.preventDefault();const marker=e.target.closest('[data-dtl-keys]');if(!marker){const row=e.target.closest('[data-object]');if(!row)return;selectObject(row.dataset.object);menuAt(e.clientX,e.clientY,`<button data-dtl-cmd="key">在当前帧添加关键帧</button><button data-dtl-track="remove">移除轨道</button><button data-dtl-mute="${esc(row.dataset.object)}">启用／禁用轨道</button><button data-dtl-lock="${esc(row.dataset.object)}">锁定／解锁轨道</button><button data-dtl-settings>关键帧与工作区设置</button>`);return;}selected=new Set(marker.dataset.dtlKeys.split(','));selectObject(marker.dataset.object);refresh();menuAt(e.clientX,e.clientY,`<button data-dtl-cmd="copy">复制关键帧</button><button data-dtl-cmd="paste">粘贴到播放头</button><button data-dtl-cmd="delete">删除选中关键帧</button>${['linear','ease','ease-in','ease-out','hold'].map((m,i)=>`<button data-dtl-interp="${m}">${['线性','平滑','缓入','缓出','保持'][i]}</button>`).join('')}`);}
function pathClick(e){if(S.recording)return;const b=e.target.closest('button');if(!b){if(openMenu&&!e.target.closest('.dtl-menu'))closeMenu();return;}const d=b.dataset;
 if(d.dtlPathMenu!==undefined){if(!d.dtlPathMenu)return;const r=b.getBoundingClientRect(),same=openMenu?.dataset.pathOwner===d.dtlPathMenu;closeMenu();if(same)return;selectObject(d.dtlPathMenu);menuAt(r.left,r.bottom+8,Object.entries(pathTitles).map(([k,v])=>`<button role="menuitem" data-dtl-path-create="${k}"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true">${pathIcons[k]}</svg>${v}</button>`).join(''));if(openMenu){openMenu.dataset.pathOwner=d.dtlPathMenu;openMenu.style.width=r.width+'px';openMenu.style.boxSizing='border-box';openMenu.style.top=Math.max(8,Math.min(r.bottom+8,innerHeight-openMenu.getBoundingClientRect().height-8))+'px';}}
 if(d.dtlPathCreate){closeMenu();createPath(d.dtlPathCreate);}
 if(d.dtlAnchorMode){const t=trackOf(S.selectedId),index=S.pathEditor?.selectedAnchor();if(t?.path&&index!=null&&writable()){pushUndo();A.setAnchorMode(t.path,index,d.dtlAnchorMode);commitPath();renderInspector();}}
 if(d.dtlPathClear!==undefined){if(!writable())return;pushUndo();const t=track(S.selectedId);for(const ch in t.channels)t.channels[ch]=t.channels[ch].filter(k=>k.source!=='path');delete t.path;S.pathEditor?.clear();persist();refresh();renderInspector();}
 if(d.dtlDrawFinish!==undefined)finishDraw();if(d.dtlDrawCancel!==undefined)cancelDraw();
 if(d.dtlCmd){({copy,paste,delete:removeKeys,key:keyframe})[d.dtlCmd]();closeMenu();}if(b.closest('.dtl-menu')&&(d.dtlTrack||d.dtlMute||d.dtlLock||d.dtlSettings!==undefined)){click(e);closeMenu();}
 if(d.dtlInterp){interpolate(d.dtlInterp);closeMenu();}
}
function pathPanel(obj){const p=trackOf(obj.id)?.path;if(p)A.upgradePath(p);
 const vector=(key,label,step=.1)=>`<div class="dtl-path-vector"><span>${label}</span><div>${['X','Y','Z'].map((axis,i)=>`<label>${axis}<input type="number" step="${step}" ${key==='scale3'?'min="0.01"':''} data-dtl-path-vector="${key}" data-axis="${i}" aria-label="轨迹${label} ${axis}" value="${Number(p[key][i].toFixed(3))}"></label>`).join('')}</div></div>`;
 const scalar=(key,label,min,max,step)=>`<label class="dtl-path-slider"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" data-dtl-path-field="${key}" aria-label="轨迹${label}滑杆" value="${p[key]}"><input type="number" min="${min}" max="${max}" step="${step}" data-dtl-path-field="${key}" aria-label="轨迹${label}" value="${p[key]}"></label>`;
 const selectedAnchor=S.pathEditor?.selectedAnchor(),a=selectedAnchor!=null&&p?.anchors[selectedAnchor];
 return `<div class="dtl-path-panel"><h3 class="dt-section-title">运动轨迹</h3><div class="dt-insp-block"><button class="dtl-create-path" data-dtl-path-menu="${obj.id}" aria-haspopup="menu">创建运动轨迹 <span>⌄</span></button>${p?`<div class="dtl-path-heading"><span>${esc(p.name)}</span><button data-dtl-path-clear aria-label="删除运动轨迹" title="删除运动轨迹">×</button></div>${a?`<div class="dtl-anchor-type"><span>锚点类型</span><div>${[['vertex','角点'],['symmetric','对称'],['asymmetric','非对称']].map(([key,label])=>`<button data-dtl-anchor-mode="${key}" class="${a.mode===key?'is-active':''}">${label}</button>`).join('')}</div></div>`:''}${scalar('duration','时长',.1,Math.max(10,duration()/fps()),.1)}${vector('origin','位置')}${vector('rotation','旋转',1)}${vector('scale3','缩放',.05)}${scalar('scale','统一缩放',.1,10,.05)}${obj.kind!=='camera'?`<label class="dt-switch-line"><input type="checkbox" data-dtl-path-follow ${p.follow?'checked':''}>绑定对象沿路径朝向</label>`:''}`:''}</div></div>`;
}
function commitPath(){const t=trackOf(S.selectedId);if(!t?.path)return;const p=t.path;
 const required=p.startFrame+Math.round(p.duration*fps());if(required>duration()){S.project.sequence.durationFrames=Math.min(required,fps()*3600);S.workArea[1]=duration()-1;S.project.sequence.workArea=S.workArea.slice();}
 S.el.inspector.querySelectorAll('[data-dtl-path-field="duration"]').forEach(el=>{el.max=Math.max(10,duration()/fps());el.value=p.duration;});
 A.bakePath(t,p,fps(),duration());persist();refresh();h.sampleAtFrame(S.playhead);S.pathEditor?.update();
}
function createPath(type){const obj=writable();if(!obj)return;setPlaying(false);h.switchMode('director');S.charTab='path';S.pathEditor?.clear();if(type==='pencil'||type==='pen'){startDraw(type,obj);return;}
 pushUndo();const current=sampled(obj),position=current.transform.position,target=current.target||obj.target||[0,1,0],yaw=obj.kind==='camera'?Math.atan2(target[0]-position[0],target[2]-position[2])*180/Math.PI:current.transform.rotation[1],p=A.pathPreset(type,position,yaw,duration()/fps(),obj.kind!=='camera');A.bakePath(track(obj.id),p,fps(),duration());expanded.add(obj.id);persist();refresh();renderInspector();h.sampleAtFrame(S.playhead);S.pathEditor?.update();}
function pathChange(e){if(S.recording)return;const input=e.target,d=input.dataset;
 if(d.dtlPathField===undefined&&d.dtlPathVector===undefined&&d.dtlPathFollow===undefined)return;const obj=writable();if(!obj)return;const t=trackOf(obj.id);if(!t?.path||input.value==='')return;const p=A.upgradePath(t.path),v=Number(input.value);if(d.dtlPathFollow===undefined&&!Number.isFinite(v))return;pushUndo();
 if(d.dtlPathField!==undefined){const k=d.dtlPathField;p[k]=A.clamp(v,.1,k==='scale'?10:3600);S.el.inspector.querySelectorAll(`[data-dtl-path-field="${k}"]`).forEach(el=>{if(el!==input)el.value=p[k];});}
 if(d.dtlPathVector!==undefined)p[d.dtlPathVector][Number(d.axis)]=d.dtlPathVector==='scale3'?Math.max(.01,v):v;
 if(d.dtlPathFollow!==undefined)p.follow=input.checked;commitPath();
}
function clearLines(){for(const line of pathLines){line.parent?.remove(line);line.geometry.dispose();line.material.dispose();}pathLines=[];}
function syncPathVisibility(){for(const line of pathLines)line.visible=!S.poseEditor?.active();}
function renderPaths(){
 clearLines();if(!S.three||!S.scene||S.recording||S.poseEditor?.active())return;const obj=objectOf(S.selectedId),t=obj&&trackOf(obj.id);if(!obj||!t||!A.entries(t,'position').length||t.muted)return;
 const times=[...new Set(A.entries(t,'position').map(e=>e.key.frame))].sort((a,b)=>a-b);if(times.length<2)return;
 const points=(t.path?A.pathPoints(t.path):times.map(f=>A.sampleObject(obj,t,f).transform.position)).map(p=>new S.three.Vector3(...p));
 const line=new S.three.Line(new S.three.BufferGeometry().setFromPoints(points),new S.three.LineBasicMaterial({color:0x50cbd9,transparent:true,opacity:.8,depthTest:false}));line.userData.directorPath=true;line.renderOrder=20;(S.sceneObjects.get(S.selectedId)?.parent||S.envRoot||S.scene).add(line);pathLines.push(line);
}
function startDraw(type,obj){cancelDraw();h.switchMode('director');drawing={type,objectId:obj.id,points:[],anchors:[],origin:sampled(obj).transform.position.slice()};S.controls.enabled=false;S.el.holder.classList.add('dtl-drawing');const banner=document.createElement('div');banner.className='dtl-drawing-banner';banner.innerHTML=`<span>${type==='pencil'?'按住鼠标在地面绘制轨迹':'点击地面添加锚点，拖出曲线手柄，双击完成'} · Esc 取消</span><button data-dtl-draw-finish>完成</button><button data-dtl-draw-cancel>取消</button>`;S.el.holder.appendChild(banner);}
function groundPoint(e){const rect=S.renderer.domElement.getBoundingClientRect(),ray=new S.three.Raycaster();ray.setFromCamera(new S.three.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),S.camera);const p=new S.three.Vector3();const parent=S.sceneObjects.get(drawing.objectId)?.parent||S.envRoot;if(parent){parent.updateWorldMatrix(true,false);ray.ray.applyMatrix4(parent.matrixWorld.clone().invert());}return ray.ray.intersectPlane(new S.three.Plane(new S.three.Vector3(0,1,0),-drawing.origin[1]),p)?p.toArray():null;}
function drawPointer(e){if(!drawing||e.button!==0||e.target.closest('button'))return;e.stopPropagation();e.preventDefault();const valid=p=>p&&p.every(v=>Number.isFinite(v)&&Math.abs(v)<1000);
 if(drawing.type==='pen'){if(e.detail>1)return;const point=groundPoint(e);if(!valid(point))return;const anchor={point,mode:'vertex'};drawing.anchors.push(anchor);drawing.points.push(point);previewDraw();gesture(e,ev=>{if(!drawing)return;const q=groundPoint(ev);if(!valid(q)||Math.hypot(...q.map((v,i)=>v-point[i]))<.03)return;anchor.out=q;anchor.in=q.map((v,i)=>2*point[i]-v);anchor.mode='symmetric';previewDraw();},()=>{});return;}
 const add=ev=>{if(!drawing)return;const p=groundPoint(ev);if(valid(p)){const last=drawing.points.at(-1);if((!last||Math.hypot(...p.map((v,i)=>v-last[i]))>.04)&&drawing.points.length<512){drawing.points.push(p);previewDraw();}}};add(e);gesture(e,add,()=>{if(drawing?.points.length>1)finishDraw();});
}
function drawingSpec(){const anchors=drawing.type==='pen'?drawing.anchors:drawing.points.map(point=>({point,mode:'vertex'}));return A.pathFromAnchors(drawing.type,anchors,duration()/fps(),false);}
function previewDraw(){clearLines();if(drawing.points.length<2)return;const line=new S.three.Line(new S.three.BufferGeometry().setFromPoints(A.pathPoints(drawingSpec()).map(p=>new S.three.Vector3(...p))),new S.three.LineBasicMaterial({color:0x51d3e6,depthTest:false}));line.userData.directorPath=true;(S.sceneObjects.get(drawing.objectId)?.parent||S.envRoot).add(line);pathLines.push(line);}
function finishDraw(){if(!drawing||drawing.points.length<2)return toast('至少需要两个有效路径点');const d=drawing;pushUndo();const spec=drawingSpec();A.bakePath(track(d.objectId),spec,fps(),duration());cancelDraw();S.charTab='path';expanded.add(d.objectId);persist();refresh();renderInspector();h.sampleAtFrame(S.playhead);S.pathEditor?.update();}
function cancelDraw(){if(!drawing)return false;drawing=null;dragCleanup?.();if(S.controls)S.controls.enabled=S.viewMode==='director';S.el.holder?.classList.remove('dtl-drawing');S.el.holder?.querySelector('.dtl-drawing-banner')?.remove();renderPaths();return true;}
function escape(){if(openMenu){closeMenu();return true;}if(cancelDraw())return true;return S.pathEditor?.escape()||false;}
function dispose(){if(valueEdit){valueEdit=null;h.endBatch?.();}timeScrubCleanup?.();cancelDraw();closeMenu();dragCleanup?.();clearLines();}
function cut(){const obj=objectOf(S.selectedId),cam=obj?.kind==='camera'?obj:h.activeCameraObj();if(!cam)return toast('先添加机位');selectObject(cam.id);persist();refresh();}
return {init,refresh,revealSelected,syncMeta,updateUI,track,trackOf,sampled,keyframe,hasKey,edit,copy,paste,removeKeys,navigate,interpolate,zoom,toggleMinimized,parseTime,setDuration,setRange,createPath,pathPanel,commitPath,renderPaths,syncPathVisibility,escape,dispose,cut,expanded,
 saveSettings(){Object.assign(S.project.timeline,{zoom:S.timelineZoom,loop:S.loopWorkArea,autoKey:S.autoKey,height:parseFloat(S.el.timeline?.style.height)||S.el.timeline?.offsetHeight||128});persist();},
 selectionChanged(){if(selected.size && allEntries().some(e=>selected.has(e.key.id)&&e.track.objectId!==S.selectedId))selected.clear();if(S.el.timeline){refresh();revealSelected();}},isDrawing:()=>!!drawing};
};
})();
