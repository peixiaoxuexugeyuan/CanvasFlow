/* Crowd is a group of real actors, not a duplicated SkinnedMesh sharing one skeleton. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(typeof window==='object'||typeof module!=='object'||!module.exports)root.DirectorCrowd=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';const COLORS=['#4f8ef7','#f75353','#34c759','#ff9f0a','#af52de','#ff2d55','#5ac8fa','#ffd60a'];
const clone=o=>JSON.parse(JSON.stringify(o));const transform=()=>({position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]});
function params(rows=3,columns=3,spacing=1.2){return{rows:Math.max(1,Math.min(10,Math.round(Number(rows)||3))),columns:Math.max(1,Math.min(10,Math.round(Number(columns)||3))),spacing:Math.max(.1,Math.min(10,Number(spacing)||1.2))};}
function standControls(){return{_c2:1,_rigAxes:3,'body.pitch':0,'body.yaw':0,'body.roll':0,'torso.pitch':2,'torso.yaw':0,'torso.roll':0,'head.pitch':-10,'head.yaw':0,'head.roll':0,'leftShoulder.pitch':-5,'leftShoulder.spread':12,'leftShoulder.twist':0,'rightShoulder.pitch':-5,'rightShoulder.spread':14,'rightShoulder.twist':0,'leftElbow.bend':15,'rightElbow.bend':15,'leftHip.pitch':0,'leftHip.spread':0,'leftHip.twist':0,'rightHip.pitch':0,'rightHip.spread':0,'rightHip.twist':0,'leftKnee.bend':0,'rightKnee.bend':0};}
function layout(spec,camera=[0,1.6,10]){const p=params(spec.rows,spec.columns,spec.spacing);return Array.from({length:p.rows*p.columns},(_,i)=>{const position=[(i%p.columns-(p.columns-1)/2)*p.spacing,0,(Math.floor(i/p.columns)-(p.rows-1)/2)*p.spacing];return{position,rotation:[0,Math.atan2(camera[0]-position[0],camera[2]-position[2])*180/Math.PI,0],scale:[1.03,1.03,1.03]};});}
function letter(n){let name='';do{name=String.fromCharCode(65+n%26)+name;n=Math.floor(n/26)-1;}while(n>=0);return name;}
function create(project,spec,uid,camera=[0,1.6,10]){const p=params(spec.rows,spec.columns,spec.spacing),group={id:uid('group'),kind:'group',name:`群众 (${p.rows}x${p.columns})`,visible:true,locked:false,transform:transform(),crowdSpec:p};const n=project.objects.filter(o=>o.kind==='character').length;const usedNames=new Set(project.objects.map(o=>o.name));let nameIndex=n;const nextName=()=>{while(usedNames.has('角色'+letter(nameIndex)))nameIndex++;const name='角色'+letter(nameIndex++);usedNames.add(name);return name;};
 const members=layout(p,camera).map((t,i)=>({id:uid('char'),kind:'character',name:nextName(),bodyType:'sam',rigVersion:2,parentId:group.id,visible:true,locked:false,color:COLORS[(n+i)%COLORS.length],transform:t,poseName:'站立',poseControls:standControls()}));return{group,members};}
function descendants(project,id){const ids=new Set([id]);let changed=true;while(changed){changed=false;for(const o of project.objects)if(o.parentId&&ids.has(o.parentId)&&!ids.has(o.id)){ids.add(o.id);changed=true;}}return ids;}
function inherited(project,id,property){const seen=new Set();let o=project.objects.find(x=>x.id===id);while(o&&!seen.has(o.id)){seen.add(o.id);if(property==='visible'?o.visible===false:o.locked===true)return property==='visible'?false:true;o=project.objects.find(x=>x.id===o.parentId);}return property==='visible'?true:false;}
function migrate(project,scales){
 project.characterTracks||=[];project.objectAnimationTracks||=[];
 for(const old of [...project.objects]){
  if(old.kind==='character'&&old.crowd==='3x3'){
   const original=clone(old),motion=project.characterTracks.find(t=>t.characterId===old.id),p=params();
   Object.assign(old,{kind:'group',crowdSpec:p});delete old.crowd;delete old.bodyType;delete old.poseControls;delete old.poseName;old.name=/群众/.test(old.name)?old.name:'群众 (3x3)';
   const count=project.objects.filter(o=>o.kind==='character').length;
   const members=layout(p).map((t,i)=>{const o=clone(original);o.id=old.id+'-member-'+i;o.name='角色'+letter(count+i);o.parentId=old.id;o.visible=true;o.locked=false;o.color=COLORS[(count+i)%COLORS.length];o.transform=t;if(!o.poseControls){o.poseName='站立';o.poseControls=standControls();}const scale=original.local?1:(scales[original.bodyType]||1);o.transform.scale=[scale,scale,scale];o.rigVersion=2;delete o.crowd;return o;});
   project.objects.push(...members);project.characterTracks=project.characterTracks.filter(t=>t.characterId!==old.id);
   members.forEach(o=>project.characterTracks.push({id:o.id+'-motion',characterId:o.id,clips:(motion?.clips||[]).map(c=>({...clone(c),id:o.id+'-'+c.id}))}));
  }
 }
 for(const o of project.objects)if(o.kind==='character'&&o.rigVersion!==2){const factor=o.local?1:(scales[o.bodyType]||1);o.transform.scale=o.transform.scale.map(v=>v*factor);const track=project.objectAnimationTracks.find(t=>t.objectId===o.id);for(const ch of ['scale.x','scale.y','scale.z'])for(const k of track?.channels?.[ch]||[])k.value*=factor;for(const k of track?.keys||[])if(k.scale)k.scale=k.scale.map(v=>v*factor);o.rigVersion=2;}
 return project;
}
return{COLORS,params,layout,letter,create,descendants,inherited,migrate};
});
