/* Data-only scene commands. The model plans; this module validates and executes. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(typeof window==='object'||typeof module!=='object'||!module.exports)root.DirectorSceneAgent=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const RECIPES=['box','sphere','cylinder','cone','torus','pyramid','building','road','wall','room','stairs','bridge','tree','car','table','chair','extrusion','mesh'];
const SIZES={building:[6,5,6],road:[8,.08,20],wall:[5,3,.2],room:[8,3,8],stairs:[2,2,4],bridge:[4,3,12],tree:[2,4,2],car:[1.8,1.5,4.3],table:[1.6,.75,.9],chair:[.5,.95,.5]};
const BODIES=['sam','female','muscular','slim','broad','child','teen','chibi'];
const clone=v=>JSON.parse(JSON.stringify(v));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function number(v,fallback,min=-500,max=500){if(v===undefined)return fallback;if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error('场景参数超出范围');return v;}
function vector(v,def=[0,0,0],min=-500,max=500){if(v===undefined)return def.slice();if(!Array.isArray(v)||v.length!==3)throw Error('空间坐标需要三个数值');return v.map(n=>number(n,0,min,max));}
function text(v,max=80){return typeof v==='string'?v.slice(0,max):'';}
function ident(v){if(typeof v!=='string'||!/^[\w\-:.]{1,120}$/.test(v)||['__proto__','constructor','prototype'].includes(v))throw Error('对象标识无效');return v;}
function color(v,def='#d5d7dc'){if(v===undefined)return def;if(!/^#[0-9a-f]{6}$/i.test(v))throw Error('颜色参数无效');return v;}
function recipe(raw={}){
 const type=raw.type||'box';if(!RECIPES.includes(type))throw Error('不支持的白模工具：'+type);
 const p=raw.parameters||{},d=vector(p.size,SIZES[type]||[2,2,2],.02,200);
 const out={type,parameters:{size:d}};
 for(const key of ['floors','steps','count'])if(p[key]!==undefined)out.parameters[key]=Math.round(number(p[key],1,1,24));
 if(p.roof!==undefined){if(!['flat','gable'].includes(p.roof))throw Error('屋顶类型无效');out.parameters.roof=p.roof;}
 if(type==='extrusion'){
  if(!Array.isArray(p.outline)||p.outline.length<3||p.outline.length>64)throw Error('挤出轮廓需要 3–64 个点');
  out.parameters.outline=p.outline.map(a=>{if(!Array.isArray(a)||a.length!==2)throw Error('轮廓坐标无效');return a.map(n=>number(n,0,-100,100));});
  let area=0;const pts=out.parameters.outline;for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];area+=a[0]*b[1]-a[1]*b[0];}if(Math.abs(area)<.001)throw Error('挤出轮廓面积为零');
 }
 if(type==='mesh'){
  if(!Array.isArray(p.vertices)||p.vertices.length<9||p.vertices.length>18000||p.vertices.length%3)throw Error('网格顶点无效');
  if(!Array.isArray(p.indices)||p.indices.length<3||p.indices.length>36000||p.indices.length%3)throw Error('网格三角形无效');
  out.parameters.vertices=p.vertices.map(n=>number(n,0,-100,100));
  out.parameters.indices=p.indices.map(n=>{if(!Number.isInteger(n)||n<0||n>=p.vertices.length/3)throw Error('网格索引无效');return n;});
 }
 return out;
}
function fields(raw,creating=false){
 const out={};
 for(const key of ['position','rotation','scale'])if(raw[key]!==undefined||creating)out[key]=vector(raw[key],key==='scale'?[1,1,1]:[0,0,0],key==='scale'?.01:-500,key==='scale'?50:500);
 if(raw.name!==undefined||creating)out.name=text(raw.name,80)||'白模对象';
 if(raw.color!==undefined||creating)out.color=color(raw.color);
 if(raw.visible!==undefined){if(typeof raw.visible!=='boolean')throw Error('可见状态无效');out.visible=raw.visible;}
 if(raw.bodyType!==undefined){if(!BODIES.includes(raw.bodyType))throw Error('角色类型无效');out.bodyType=raw.bodyType;}
 if(raw.pose!==undefined){if(!['站立','思考','单膝跪','双膝跪','招手','伸手'].includes(raw.pose))throw Error('角色姿势无效');out.pose=raw.pose;}
 if(raw.target!==undefined)out.target=vector(raw.target);
 if(raw.fov!==undefined)out.fov=number(raw.fov,50,10,100);
 if(raw.poseControls!==undefined){
  if(!raw.poseControls||typeof raw.poseControls!=='object'||Array.isArray(raw.poseControls))throw Error('姿态参数无效');
  const keys=['body.yaw','body.pitch','body.roll','torso.yaw','torso.pitch','torso.roll','head.yaw','head.pitch','head.roll'];
  out.poseControls={};for(const [key,value]of Object.entries(raw.poseControls)){if(!keys.includes(key))throw Error('不支持的姿态通道：'+key);out.poseControls[key]=number(value,0,-90,90);}
 }
 if(raw.recipe!==undefined){
  if(creating)out.recipe=recipe(raw.recipe);
  else{const type=raw.recipe.type;if(type&&!RECIPES.includes(type))throw Error('不支持的白模工具');const p=raw.recipe.parameters||{},complete=recipe({type:['mesh','extrusion'].includes(type)?'box':type,parameters:p});out.recipe={...(type?{type}:{}),parameters:Object.fromEntries(Object.entries(complete.parameters).filter(([k])=>Object.hasOwn(p,k)))};for(const key of ['outline','vertices','indices'])if(p[key]!==undefined)out.recipe.parameters[key]=clone(p[key]);}
 }
 return out;
}
function parse(input){
 let raw;try{raw=typeof input==='string'?JSON.parse(input.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'')):input;}catch{throw Error('模型未返回有效场景指令，请重试');}
 if(!raw||typeof raw!=='object')throw Error('场景指令为空');
 // Older providers can still send the original objects protocol.
 if(!raw.operations&&Array.isArray(raw.objects))raw={message:raw.message,operations:raw.objects.map(o=>({op:o.operation==='update'?'update':'create',...o,id:o.id,recipe:o.kind==='geometry'?{type:o.type||'box',parameters:{size:[.8,.8,.8]}}:undefined}))};
 if(!Array.isArray(raw.operations)||raw.operations.length>180)throw Error('一次最多执行 180 条场景指令');
 const operations=raw.operations.map((o,i)=>{
  if(!o||typeof o!=='object')throw Error('场景指令无效');const op=o.op;
  if(['create','update'].includes(op)){
   if(op==='create'&&!['geometry','character','camera'].includes(o.kind))throw Error('对象类型无效');
   const row={op,id:o.id===undefined&&op==='create'?'new-'+i:ident(o.id),...fields(o,op==='create')};
   if(op==='create')row.kind=o.kind;
   return row;
  }
  if(op==='remove')return{op,id:ident(o.id)};
  if(op==='sequence')return{op,duration:number(o.duration,15,.1,3600)};
  if(op==='environment')return{op,whitebox:!!o.whitebox,background:o.background===undefined?undefined:color(o.background),groundHeight:number(o.groundHeight,0,-100,100),showGround:o.showGround===undefined?undefined:!!o.showGround,gridOpacity:o.gridOpacity===undefined?undefined:number(o.gridOpacity,0,0,1),groundOpacity:o.groundOpacity===undefined?undefined:number(o.groundOpacity,0,0,1),showLabels:o.showLabels===undefined?undefined:!!o.showLabels};
  if(op==='camera'){
   const row={op,id:ident(o.id)};if(o.active!==undefined)row.active=!!o.active;
   for(const k of ['lookAtId','followId'])if(o[k]!==undefined)row[k]=o[k]===null?null:ident(o[k]);
   if(o.aspectRatio!==undefined){if(!['16:9','9:16','1:1','4:3','3:4','21:9'].includes(o.aspectRatio))throw Error('画幅无效');row.aspectRatio=o.aspectRatio;}
   return row;
  }
  if(op==='motion'){
   const start=number(o.start,0,0,3599),duration=number(o.duration,10,.1,3600);if(start+duration>3600)throw Error('动画超过一小时');
   const type=o.type||'path';if(!['path','line','circle','rectangle'].includes(type))throw Error('路径类型无效');
   const row={op,id:ident(o.id),start,duration,type,follow:o.follow!==false,action:o.action||'auto'};
   if(!['auto','walk','run','none'].includes(row.action))throw Error('动作类型无效');
   if(type==='path'||type==='line'){if(!Array.isArray(o.points)||o.points.length<2||o.points.length>64)throw Error('路径需要 2–64 个点');row.points=o.points.map(p=>vector(p));}
   else{row.center=vector(o.center);row.radius=number(o.radius,3,.05,100);row.height=number(o.height,1.8,-100,100);row.angle=number(o.angle,360,-720,720);row.startAngle=number(o.startAngle,0,-720,720);}
   return row;
  }
  if(op==='keyframes'){
   if(!Array.isArray(o.keys)||o.keys.length<1||o.keys.length>128)throw Error('关键帧数量无效');
   return{op,id:ident(o.id),replace:o.replace!==false,keys:o.keys.map(k=>{const row={time:number(k.time,0,0,3600),...fields(k)};row.interp=k.interp||'linear';if(!['linear','ease','ease-in','ease-out','hold'].includes(row.interp))throw Error('插值类型无效');if(!['position','rotation','scale','target','fov','poseControls'].some(p=>row[p]!==undefined))throw Error('关键帧缺少属性');return row;})};
  }
  throw Error('不支持的场景操作：'+text(op));
 });
 return{message:text(raw.message,1200)||'已完成场景调整',operations};
}
// Recipes return bounded primitives in metres, with origin at the floor.
function parts(spec){
 const r=recipe(spec),p=r.parameters,[w,h,d]=p.size,out=[];
 const add=(type,size,position,rotation=[0,0,0],shade)=>out.push({type,size,position,rotation,shade});
 const box=(size,pos,shade)=>add('box',size,pos,[0,0,0],shade);
 if(['box','sphere','cylinder','cone','pyramid','torus'].includes(r.type))add(r.type,[w,h,d],[0,h/2,0]);
 if(r.type==='road'){box([w,.08,d],[0,.04,0],'#b8bec6');box([.3,.16,d],[-w/2,.08,0]);box([.3,.16,d],[w/2,.08,0]);}
 if(r.type==='wall')box([w,h,d],[0,h/2,0]);
 if(r.type==='building'){
  const roof=p.roof||'gable',roofH=roof==='gable'?h*.2:.15,wallH=h-roofH;
  box([w,wallH,d],[0,wallH/2,0]);
  if(roof==='gable')add('gable',[w*1.08,roofH,d*1.08],[0,wallH,0]);else box([w*1.06,roofH,d*1.06],[0,wallH+roofH/2,0]);
  const floors=p.floors||Math.max(1,Math.min(6,Math.floor(wallH/2.5))),n=Math.max(1,Math.min(8,Math.floor(w/1.5)));
  for(let f=0;f<floors;f++)for(let i=0;i<n;i++)box([Math.min(.6,w/(n*2)),Math.min(.8,wallH/(floors*2)),.035],[(i-(n-1)/2)*w/n,(f+.5)*wallH/floors,d/2+.02],'#aab0b8');
  box([Math.min(1,w*.25),Math.min(2,wallH*.7),.04],[0,Math.min(2,wallH*.7)/2,d/2+.045],'#969fa9');
 }
 if(r.type==='room'){
  const t=Math.min(.2,w/10,d/10);box([w,.1,d],[0,.05,0]);box([w,h,t],[0,h/2,-d/2]);for(const x of [-w/2,w/2])box([t,h,d],[x,h/2,0]);
 }
 if(r.type==='stairs'){const n=p.steps||8;for(let i=0;i<n;i++)box([w,h*(i+1)/n,d/n],[0,h*(i+1)/(2*n),-d/2+d*(i+.5)/n]);}
 if(r.type==='bridge'){
  const deck=Math.min(.3,h*.2),rail=Math.min(1,h*.4);box([w,deck,d],[0,h-rail-deck/2,0]);
  for(const x of [-w/2,w/2]){box([.12,.12,d],[x,h-.06,0]);for(let i=0;i<7;i++)box([.1,rail,.1],[x,h-rail/2,-d/2+i*d/6]);}
  for(const z of [-d*.35,d*.35])for(const x of [-w*.35,w*.35])box([.35,h-rail,.35],[x,(h-rail)/2,z]);
 }
 if(r.type==='tree'){add('cylinder',[w*.13,h*.6,w*.13],[0,h*.3,0],[0,0,0],'#70533c');add('cone',[w,h*.65,d],[0,h*.675,0]);}
 if(r.type==='car'){
  box([w,h*.42,d],[0,h*.43,0]);box([w*.85,h*.45,d*.48],[0,h*.765,-d*.08]);
  for(const x of [-w*.48,w*.48])for(const z of [-d*.32,d*.32])add('cylinder',[h*.38,w*.12,h*.38],[x,h*.19,z],[0,0,90],'#7e8791');
 }
 if(r.type==='table'){box([w,h*.08,d],[0,h*.96,0]);for(const x of [-w*.4,w*.4])for(const z of [-d*.4,d*.4])box([w*.07,h*.92,d*.07],[x,h*.46,z]);}
 if(r.type==='chair'){box([w,h*.08,d],[0,h*.48,0]);box([w,h*.48,d*.08],[0,h*.76,-d*.46]);for(const x of [-w*.4,w*.4])for(const z of [-d*.4,d*.4])box([w*.08,h*.44,d*.08],[x,h*.22,z]);}
 if(r.type==='extrusion'||r.type==='mesh')out.push({type:r.type,parameters:p,position:[0,0,0],rotation:[0,0,0],size:p.size});
 return out;
}
function meshFor(T,spec,tint='#d5d7dc'){
 const group=new T.Group(),materials=new Map();group.userData.aiWhitebox=true;
 const material=c=>{if(!materials.has(c))materials.set(c,new T.MeshStandardMaterial({color:c,roughness:.88,metalness:0}));return materials.get(c);};
 for(const p of parts(spec)){
  let g;const [w,h,d]=p.size;
  if(p.type==='sphere')g=new T.SphereGeometry(.5,16,12);
  else if(p.type==='cylinder')g=new T.CylinderGeometry(.5,.5,1,16);
  else if(p.type==='cone'||p.type==='pyramid')g=new T.ConeGeometry(.5,1,p.type==='pyramid'?4:12);
  else if(p.type==='torus')g=new T.TorusGeometry(.35,.15,10,24);
  else if(p.type==='gable'){
   const shape=new T.Shape();shape.moveTo(-w/2,0);shape.lineTo(0,h);shape.lineTo(w/2,0);shape.closePath();g=new T.ExtrudeGeometry(shape,{depth:d,bevelEnabled:false});g.translate(0,0,-d/2);
  }else if(p.type==='extrusion'){
   const shape=new T.Shape();p.parameters.outline.forEach((v,i)=>i?shape.lineTo(v[0],v[1]):shape.moveTo(v[0],v[1]));shape.closePath();g=new T.ExtrudeGeometry(shape,{depth:h,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,h,0);
  }else if(p.type==='mesh'){
   g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p.parameters.vertices,3));g.setIndex(p.parameters.indices);g.computeVertexNormals();
  }else g=new T.BoxGeometry(w,h,d);
  if(p.type==='extrusion'||p.type==='mesh'){g.computeBoundingBox();const b=g.boundingBox,center=b.getCenter(new T.Vector3()),size=b.getSize(new T.Vector3());g.translate(-center.x,-b.min.y,-center.z);g.scale(w/(size.x||1),h/(size.y||1),d/(size.z||1));}
  const mesh=new T.Mesh(g,material(p.shade||tint));if(['sphere','cylinder','cone','pyramid','torus'].includes(p.type))mesh.scale.set(w,h,d);
  mesh.position.fromArray(p.position);mesh.rotation.set(...p.rotation.map(v=>v*Math.PI/180));mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
 }
 return group;
}
function apply(project,input,A){
 const plan=parse(input),next=clone(project),changed=new Set(),created=[];
 if(!plan.operations.length)return{project:next,changed:[],created:[],message:plan.message,operations:0};
 next.objects||=[];next.objectAnimationTracks||=[];next.sequence||={fps:24,durationFrames:240};next.scene||={};next.cameraTrack||={clips:[]};
 const fps=next.sequence.fps||24,used=new Set(next.objects.map(o=>o.id)),aliases=new Map();let serial=0;
 for(const op of plan.operations.filter(o=>o.op==='create')){
  if(aliases.has(op.id))throw Error('新增对象标识重复');let id=op.id;if(used.has(id)){do{id='ai-'+op.id+'-'+(++serial);}while(used.has(id));}aliases.set(op.id,id);used.add(id);
 }
 const idOf=id=>aliases.get(id)||id;
 const object=id=>{const o=next.objects.find(o=>o.id===idOf(id));if(!o)throw Error('找不到对象：'+id);return o;};
 const locked=o=>{let p=o;const seen=new Set();while(p&&!seen.has(p.id)){seen.add(p.id);if(p.locked||next.objectAnimationTracks.find(t=>t.objectId===p.id)?.locked)throw Error('请先解锁对象：'+o.name);p=next.objects.find(x=>x.id===p.parentId);}};
 const track=o=>{let t=next.objectAnimationTracks.find(t=>t.objectId===o.id);if(!t){t={objectId:o.id,channels:{},keys:[]};next.objectAnimationTracks.push(t);}return A.normalizeTrack(t);};
 function assign(o,op){
  for(const k of ['position','rotation','scale'])if(op[k])o.transform[k]=op[k].slice();
  for(const k of ['name','color','visible'])if(op[k]!==undefined)o[k]=op[k];
  if(o.kind==='geometry'&&op.recipe){o.geometryType='whitebox';o.whitebox=recipe({...(o.whitebox||{}),...op.recipe,parameters:{...(o.whitebox?.parameters||{}),...op.recipe.parameters}});}
  if(o.kind==='character'){if(op.bodyType)o.bodyType=op.bodyType;if(op.pose){o.poseName=op.pose;o.agentPose=op.pose;}if(op.poseControls)o.poseControls={...o.poseControls,...op.poseControls};o.rigVersion=2;}
  if(o.kind==='camera'){if(op.target)o.target=op.target.slice();if(op.fov!==undefined)o.fov=op.fov;}
 }
 for(const op of plan.operations.filter(o=>o.op==='create')){
  const o={id:idOf(op.id),kind:op.kind,name:op.name,visible:true,locked:false,color:op.color,transform:{position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]}};
  if(o.kind==='geometry'){o.geometryType='whitebox';o.whitebox=op.recipe||recipe();}
  if(o.kind==='character'){o.bodyType=op.bodyType||'sam';o.poseName=op.pose||'站立';o.agentPose=o.poseName;o.rigVersion=2;}
  if(o.kind==='camera'){o.target=op.target||[0,1.2,0];o.fov=op.fov||50;o.aspectRatio='16:9';}
  assign(o,op);next.objects.push(o);created.push(o.id);changed.add(o.id);
 }
 for(const op of plan.operations.filter(o=>o.op==='update')){
  const o=object(op.id);locked(o);const old=o.transform.position.slice();assign(o,op);changed.add(o.id);
  if(op.position){const delta=op.position.map((n,i)=>n-old[i]),t=next.objectAnimationTracks.find(t=>t.objectId===o.id);if(t){for(let i=0;i<3;i++)for(const k of t.channels?.['position.'+'xyz'[i]]||[])k.value+=delta[i];if(t.path?.origin)t.path.origin=t.path.origin.map((v,i)=>v+delta[i]);for(const p of t.agentPaths||[])if(p.origin)p.origin=p.origin.map((v,i)=>v+delta[i]);}}
 }
 for(const op of plan.operations.filter(o=>o.op==='remove')){
  const o=object(op.id),ids=new Set([o.id]);let repeat=true;while(repeat){repeat=false;for(const child of next.objects)if(ids.has(child.parentId)&&!ids.has(child.id)){ids.add(child.id);repeat=true;}}
  for(const target of next.objects.filter(x=>ids.has(x.id)))locked(target);
  next.objects=next.objects.filter(x=>!ids.has(x.id));next.objectAnimationTracks=next.objectAnimationTracks.filter(t=>!ids.has(t.objectId));next.cameraTrack.clips=next.cameraTrack.clips.filter(c=>!ids.has(c.cameraId));
  for(const x of next.objects){if(ids.has(x.lookAtTargetId)){delete x.lookAtTargetId;x.targetMode='manual';}if(ids.has(x.followTargetId)){delete x.followTargetId;delete x.followAnchor;delete x.followOffset;delete x.followViewMode;}}ids.forEach(id=>changed.add(id));
 }
 if(next.objects.length>600)throw Error('场景最多容纳 600 个可编辑对象');
 const seq=plan.operations.filter(o=>o.op==='sequence').at(-1),seconds=seq?.duration;
 const required=Math.max(2,...plan.operations.filter(o=>o.op==='motion').map(o=>Math.ceil((o.start+o.duration)*fps)),...plan.operations.filter(o=>o.op==='keyframes').flatMap(o=>o.keys.map(k=>Math.round(k.time*fps)+1)));
 if(seq&&required>Math.ceil(seconds*fps)+1)throw Error('动画时间超出设定时长');
 const frames=seq?Math.max(2,Math.ceil(seconds*fps)):Math.max(next.sequence.durationFrames,required);
 if(frames!==next.sequence.durationFrames){next.sequence.durationFrames=frames;next.sequence.workArea=[0,frames-1];for(const t of next.objectAnimationTracks)for(const [ch,keys]of Object.entries(t.channels||{}))t.channels[ch]=keys.filter(k=>k.frame<frames);}
 for(const op of plan.operations.filter(o=>o.op==='environment')){
  next.scene.groundHeight=op.groundHeight;if(op.background)next.scene.backgroundColor=op.background;
  next.scene.whitebox=op.whitebox;
  if(op.whitebox){next.scene.backgroundColor=op.background||'#858d99';next.scene.panoramaData='';next.scene.panoramaUrl='';next.scene.panoramaName='';next.scene.showGround=true;for(const o of next.objects)if(o.kind==='character')o.color='#d5d7dc';}
  if(op.showGround!==undefined)next.scene.showGround=op.showGround;
  for(const key of ['gridOpacity','groundOpacity','showLabels'])if(op[key]!==undefined)next.scene[key]=op[key];
 }
 for(const op of plan.operations.filter(o=>o.op==='camera')){
  const cam=object(op.id);locked(cam);if(cam.kind!=='camera')throw Error('此对象不是机位');changed.add(cam.id);
  if(op.active)next.activeCameraId=cam.id;if(op.aspectRatio)cam.aspectRatio=op.aspectRatio;
  for(const key of ['lookAtId','followId'])if(op[key]!==undefined){
   const target=op[key]===null?null:object(op[key]);if(target&&!['character','group'].includes(target.kind))throw Error('机位绑定目标需要是角色或分组');
   if(key==='lookAtId'){cam.targetMode=target?'object':'manual';if(target)cam.lookAtTargetId=target.id;else delete cam.lookAtTargetId;}
   else if(target){cam.followTargetId=target.id;cam.followAnchor=target.transform.position.slice();cam.followOffset=cam.transform.position.map((v,i)=>v-cam.followAnchor[i]);cam.followViewMode='thirdPerson';}
   else{delete cam.followTargetId;delete cam.followAnchor;delete cam.followOffset;delete cam.followViewMode;}
  }
 }
 for(const op of plan.operations.filter(o=>o.op==='motion')){
  const o=object(op.id);locked(o);const t=track(o);t.muted=false;
  let points=op.points;
  if(op.type==='circle')points=Array.from({length:49},(_,i)=>{const a=(op.startAngle+op.angle*i/48)*Math.PI/180;return[op.center[0]+Math.sin(a)*op.radius,op.height,op.center[2]+Math.cos(a)*op.radius];});
  if(op.type==='rectangle'){const [x,y,z]=op.center,r=op.radius;points=[[x-r,op.height,z-r],[x+r,op.height,z-r],[x+r,op.height,z+r],[x-r,op.height,z+r],[x-r,op.height,z-r]];}
  const path={version:2,type:op.type==='circle'?'circle':op.type==='rectangle'?'rectangle':op.type==='line'?'line':'pencil',name:'AI '+o.name+'轨迹',startFrame:Math.round(op.start*fps),duration:op.duration,origin:[0,0,0],rotation:[0,0,0],scale3:[1,1,1],scale:1,follow:o.kind==='camera'?false:op.follow,action:op.action,anchors:points.map(point=>({point:point.slice(),mode:'vertex'}))};
  const baked={channels:{}};A.bakePath(baked,path,fps,frames);
  const from=path.startFrame,to=Math.min(frames-1,from+Math.round(path.duration*fps)-1);
  t.agentPaths||=t.path?[clone(t.path)]:[];t.agentPaths.push(clone(path));if(t.agentPaths.length>32)t.agentPaths=t.agentPaths.slice(-32);
  for(const ch of [...A.GROUPS.position,'rotation.y']){
   const old=t.channels[ch]||[],fresh=baked.channels[ch]||[];
   if(A.GROUPS.position.includes(ch)||path.follow!==false)t.channels[ch]=[...old.filter(k=>k.frame<from||k.frame>to),...fresh].sort((a,b)=>a.frame-b.frame);
  }
  t.path=clone(path);changed.add(o.id);
 }
 for(const op of plan.operations.filter(o=>o.op==='keyframes')){
  const o=object(op.id);locked(o);const t=track(o);t.muted=false;
  const props=[...new Set(op.keys.flatMap(k=>['position','rotation','scale','target','fov','poseControls'].filter(p=>k[p]!==undefined)))];
  if(props.includes('poseControls')&&o.kind!=='character')throw Error('姿态关键帧仅适用于角色');
  if(o.kind!=='camera'&&props.some(p=>['target','fov'].includes(p)))throw Error('注视点和焦距仅适用于机位');
  if(op.replace)for(const p of props)for(const ch of A.channels(p==='poseControls'?'pose':p))delete t.channels[ch];
  if(op.replace&&props.includes('position')){delete t.path;delete t.agentPaths;}
  for(const k of op.keys)for(const p of props)if(k[p]!==undefined)for(const [i,ch]of A.channels(p==='poseControls'?'pose':p).entries()){
   const value=p==='poseControls'?k[p][ch.slice(5)]:p==='fov'?k[p]:k[p][i];
   if(value!==undefined)A.putKey(t,ch,Math.min(frames-1,Math.round(k.time*fps)),value,k.interp);
  }
  changed.add(o.id);
 }
 const camera=next.objects.find(o=>o.id===next.activeCameraId&&o.kind==='camera')||next.objects.find(o=>o.kind==='camera');next.activeCameraId=camera?.id||'';
 next.cameraTrack.clips=camera?[{id:'ai-selected-camera',cameraId:camera.id,startFrame:0,endFrame:frames}]:[];
 A.migrate(next);
 return{project:next,changed:[...changed],created,message:plan.message,operations:plan.operations.length};
}
function sceneContext(project,selectedId=''){
 const objects=(project.objects||[]).map(o=>({id:o.id,name:o.name,kind:o.kind,parentId:o.parentId,visible:o.visible,locked:o.locked,transform:o.transform,recipe:o.whitebox?.type==='mesh'?{type:'mesh',parameters:{size:o.whitebox.parameters.size},vertexCount:o.whitebox.parameters.vertices.length/3}:o.whitebox,bodyType:o.bodyType,pose:o.poseName,target:o.target,fov:o.fov,lookAtId:o.lookAtTargetId,followId:o.followTargetId,aspectRatio:o.aspectRatio}));
 const tracks=(project.objectAnimationTracks||[]).map(t=>({id:t.objectId,locked:t.locked,muted:t.muted,path:t.path,stages:t.agentPaths,channels:Object.fromEntries(Object.entries(t.channels||{}).map(([ch,keys])=>[ch,keys.length<=12?keys:keys.filter((_,i)=>i===0||i===keys.length-1||i%Math.ceil(keys.length/10)===0)]))}));
 return{units:'metres',up:'Y',scene:project.scene?{groundHeight:project.scene.groundHeight||0,whitebox:!!project.scene.whitebox}: {},selectedId,activeCameraId:project.activeCameraId,sequence:project.sequence,objects,tracks};
}
function history(project){return Array.isArray(project.aiConversation)?project.aiConversation.filter(h=>['user','assistant'].includes(h.role)&&typeof h.content==='string').slice(-16).map(h=>({role:h.role,content:h.content})):[];}
function remember(project,prompt,message,report){project.aiConversation=[...history(project),{role:'user',content:String(prompt||'')},{role:'assistant',content:String(message||'')}].slice(-20);project.aiLastReport={issues:(report?.issues||[]).slice(0,16),operations:report?.operations||0};}
function request({prompt,project,selectedId='',reference='',feedback}){
 const protocol={message:'解释已完成的修改，不要声称工具不支持的功能已完成',operations:[
  {op:'create',id:'house1',kind:'geometry',name:'房屋',recipe:{type:'building',parameters:{size:[6,5,8],roof:'gable',floors:2}},position:[-6,0,0]},
  {op:'update',id:'现有对象ID',position:[0,0,2]},
  {op:'remove',id:'明确要求删除的对象ID'},
  {op:'sequence',duration:15},
  {op:'environment',whitebox:true,background:'#858d99',groundHeight:0},
  {op:'motion',id:'角色ID',type:'path',points:[[0,0,0],[0,0,8]],start:0,duration:15,follow:true,action:'walk'},
  {op:'motion',id:'机位ID',type:'circle',center:[0,0,0],radius:4,height:2,startAngle:0,angle:180,start:0,duration:15,follow:false,action:'none'},
  {op:'keyframes',id:'机位ID',replace:true,keys:[{time:0,position:[0,2,8],target:[0,1.2,0],fov:50},{time:15,position:[0,2,4],target:[0,1.2,0],fov:50,interp:'ease'}]},
  {op:'camera',id:'机位ID',active:true,lookAtId:'角色ID',followId:null,aspectRatio:'16:9'}]};
 const guide='你是用户3D预演台内的场景Agent。使用数据工具搭建可编辑白模、安排角色动作和单机位运镜。只返回合法JSON，不返回代码。先理解需求、规划空间和时间，再发工具指令。'+
  '所有坐标为米，Y向上，地面默认Y=0；角度用度，时间用秒。角色约1.83米高。白模recipe原点在底面中心，size为宽高深；road高参数不影响薄路面。'+
  '可用几何工具：'+RECIPES.join(',')+'。building可设roof flat/gable、floors 1–24；stairs设steps；extrusion设二维XZ outline和size中的高度；mesh设vertices扁平三维坐标和indices三角形索引。复合模型整体可选择、移动、缩放和删除。'+
  'create kind仅geometry/character/camera。角色bodyType为'+BODIES.join(',')+'，静态pose为站立/思考/单膝跪/双膝跪/招手/伸手。位置旋转缩放可用于create/update。'+
  '每轮优先修改已有对象ID，新增ID需在本轮唯一；不要重新生成未提及的场景。若选中对象，优先作用于它。尊重锁定和隐藏状态。只有用户明确要求删除才remove。不要删除用户未提及的对象。'+
  '搭建新白模场景时environment whitebox=true；调整已有场景时保留背景与设置。场景布局至少留出人物通路，禁止墙和房屋阻挡运动路径。'+
  '运动用motion world points，path/line；circle/rectangle可设center radius height。角色follow=true沿路径转身；action walk/run/auto/none，none只移动不摆动身体。'+
  'camera lookAtId绑定角色/分组，followId可让机位跟随目标，null取消；绑定几何体时用target关键帧指向其中心。跟随绑定与绝对路径不要叠加同一运动。'+
  'keyframes支持位置、旋转、缩放、target、fov和角色poseControls。poseControls只接受body/torso/head的yaw/pitch/roll，角度范围-90到90度，可与行走轨迹同时采样，用于回头、点头和上身转动。replace仅替换本轮提供的通道，其他动画保留。时间必须在sequence内。只保留一个当前机位，多个镜头通过该机位不同时刻的位置和注视点实现。'+
  '一次最多180条指令，场景最多600个对象。不支持的复杂模型先用组合白模表达并解释。不要编造外部资产URL。无操作时operations=[]并解释。'+
  '\n工具协议示例（只用本轮必要操作，示例中的ID不是真实对象）：'+JSON.stringify(protocol);
 return guide+'\n最近对话：'+JSON.stringify(history(project))+'\n当前真实场景：'+JSON.stringify(sceneContext(project,selectedId))+'\n参考图分析：'+reference+'\n用户需求：'+prompt+(feedback?'\n执行后检查：'+JSON.stringify(feedback)+'\n仅修正这些问题，保留已完成的其他操作；无法修正则operations=[]说明原因。':'');
}
// Broad-phase checks deliberately report warnings, not destructive auto-fixes.
function inspect(project,A){
 const issues=[],fps=project.sequence.fps,frames=project.sequence.durationFrames,objects=project.objects,byId=new Map(objects.map(o=>[o.id,o])),cam=byId.get(project.activeCameraId);
 const push=(code,id,message)=>{if(issues.length<24&&!issues.some(i=>i.code===code&&i.id===id))issues.push({code,id,message});};
 const sample=(o,f)=>A.sampleObject(o,project.objectAnimationTracks.find(t=>t.objectId===o.id),f);
 for(const o of objects){
  if(o.visible===false||o.parentId)continue;
  const p=o.transform.position;if(o.kind!=='camera'&&o.whitebox&&!['bridge','mesh','extrusion'].includes(o.whitebox.type)&&Math.abs(p[1]-(project.scene.groundHeight||0))>.1)push('ground',o.id,o.name+'的底面与地面高度不一致，检查是否为用户要求');
  if(o.kind!=='character')continue;
  const t=project.objectAnimationTracks.find(t=>t.objectId===o.id),paths=t?.agentPaths?.length?t.agentPaths:t?.path?[t.path]:[];if(!paths.length)continue;
  for(const block of objects.filter(b=>b.visible!==false&&!b.parentId&&['building','wall'].includes(b.whitebox?.type))){
   const bp=block.transform.position,[w,,d]=block.whitebox.parameters.size,angle=-(block.transform.rotation[1]||0)*Math.PI/180;
   for(const path of paths){const points=A.pathPoints(path);
   for(let i=0;i<points.length-1;i++){const a=points[i],b=points[i+1],n=Math.min(200,Math.max(2,Math.ceil(Math.hypot(...b.map((v,k)=>v-a[k]))/.25)));let hit=false;
    for(let j=0;j<=n;j++){const x=a[0]+(b[0]-a[0])*j/n-bp[0],z=a[2]+(b[2]-a[2])*j/n-bp[2],lx=x*Math.cos(angle)-z*Math.sin(angle),lz=x*Math.sin(angle)+z*Math.cos(angle),y=a[1]+(b[1]-a[1])*j/n;if(Math.abs(lx)<w*block.transform.scale[0]/2+.2&&Math.abs(lz)<d*block.transform.scale[2]/2+.2&&y<bp[1]+block.whitebox.parameters.size[1]*block.transform.scale[1]&&y+1.8>bp[1]){hit=true;break;}}
    if(hit){push('path-obstacle',o.id,o.name+'的路径可能穿过'+block.name);break;}
   }
   }
  }
 }
 if(cam){
  const subjects=cam.lookAtTargetId?[byId.get(cam.lookAtTargetId)].filter(Boolean):objects.filter(o=>o.kind==='character'&&o.visible!==false&&!o.parentId).slice(0,4);
  for(const subject of subjects)for(const f of [0,Math.floor((frames-1)/2),frames-1]){
   const c=sample(cam,f),s=sample(subject,f),eye=c.transform.position.slice(),point=s.transform.position.map((v,i)=>v+(i===1?1.1*s.transform.scale[1]:0));
   if(cam.followTargetId){const target=byId.get(cam.followTargetId);if(target){const now=sample(target,f).transform.position,anchor=cam.followAnchor||target.transform.position;eye.forEach((_,i)=>eye[i]+=now[i]-anchor[i]);}}
   const target=cam.targetMode==='object'&&byId.has(cam.lookAtTargetId)?sample(byId.get(cam.lookAtTargetId),f).transform.position.map((v,i)=>v+(i===1?1.2:0)):(c.target||[0,1.2,0]);
   const a=target.map((v,i)=>v-eye[i]),b=point.map((v,i)=>v-eye[i]),la=Math.hypot(...a),lb=Math.hypot(...b);if(lb<.2){push('camera-close',cam.id,'机位可能与'+subject.name+'过近');continue;}
   const angle=Math.acos(clamp(a.reduce((n,v,i)=>n+v*b[i],0)/(la*lb||1),-1,1))*180/Math.PI;
   if(angle>c.fov*.55)push('framing',cam.id,subject.name+'在 '+(f/fps).toFixed(1)+' 秒可能超出机位中心视野');
  }
 }
 return{objects:objects.length,cameraId:project.activeCameraId,duration:frames/fps,issues};
}
async function run({project,prompt,selectedId='',referenceImage='',modelId,previs=true,animation:A,buildScene,prepare=async()=>{},preview=()=>null,current=()=>true,progress=()=>{}}){
 const check=()=>{if(!current())throw Error('场景已改变或预演台已关闭，请根据最新场景重新提交');};
 const original=clone(project);let candidate=original,result,feedback,previewImage='',operationCount=0,messages=[],changed=new Set(),created=new Set(),reviewUnavailable='';
 for(let round=0;round<2;round++){
  check();progress(round?'正在检查并调整场景…':'正在规划白模、动作和运镜…');
  let response;try{response=await buildScene({prompt,scene:candidate.objects,project:candidate,selectedId,referenceImage:round?'':referenceImage,feedback,feedbackImage:previewImage,modelId,previs});}catch(error){check();if(round&&operationCount){reviewUnavailable='自动检查未完成：'+error.message;break;}throw error;}check();if(feedback?.visualReviewUnavailable)reviewUnavailable=feedback.visualReviewUnavailable;
  try{result=apply(candidate,response,A);}catch(error){
   if(round)throw error;feedback={issues:[{code:'invalid-command',message:error.message}],rejectedResponse:text(response,12000)};continue;
  }
  candidate=result.project;operationCount+=result.operations;result.changed.forEach(id=>changed.add(id));result.created.forEach(id=>created.add(id));messages.push(result.message);
  progress('正在构建白模与动画…');await prepare(candidate);check();
  const report=inspect(candidate,A);progress('正在检查路径和镜头画面…');
  try{const visual=preview(candidate);previewImage=visual?.image||'';if(visual?.issues)report.issues.push(...visual.issues);}catch(error){reviewUnavailable='预览检查失败：'+error.message;}
  check();feedback=report;
  // One bounded review; never leave the user in an unbounded agent loop.
  if(round||!result.operations||(!report.issues.length&&!previewImage))break;
 }
 if(!result)throw Error('模型未返回可执行的场景调整');
 const report=inspect(candidate,A);report.issues.push(...(feedback?.issues||[]).filter(i=>['out-of-frame','occluded'].includes(i.code)));report.operations=operationCount;if(reviewUnavailable)report.issues.push({code:'review-unavailable',message:reviewUnavailable});
 const message=messages.filter(Boolean).join('\n');remember(candidate,prompt,message,report);
 return{project:candidate,message,report,changed:[...changed],created:[...created],operations:operationCount};
}
return{RECIPES,parse,recipe,parts,meshFor,apply,sceneContext,history,remember,request,inspect,run};
});
