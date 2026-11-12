/* Deterministic director animation data. No renderer, DOM or wall-clock dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (typeof window === 'object' || typeof module !== 'object' || !module.exports) root.DirectorAnimation = api;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const GROUPS = { position: ['position.x','position.y','position.z'], rotation: ['rotation.x','rotation.y','rotation.z'], scale: ['scale.x','scale.y','scale.z'], target: ['target.x','target.y','target.z'], fov: ['fov'] };
  const POSE_KEYS = ['body.yaw','body.pitch','body.roll','torso.yaw','torso.pitch','torso.roll','head.yaw','head.pitch','head.roll'];
  GROUPS.pose = POSE_KEYS.map(key => 'pose.' + key);
  const clone = v => JSON.parse(JSON.stringify(v));
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const number = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  let serial = 0;
  const id = () => 'ak-' + Date.now().toString(36) + '-' + (++serial).toString(36);
  function channels(group) { return GROUPS[group] || (Object.values(GROUPS).flat().includes(group) ? [group] : []); }
  function read(object, channel) {
    if (channel.startsWith('pose.')) return number(object.poseControls?.[channel.slice(5)]);
    const [prop, axis] = channel.split('.');
    if (!axis) return number(object[prop], prop === 'fov' ? 50 : 0);
    const a = prop === 'target' ? object.target : object.transform?.[prop];
    return number(a?.['xyz'.indexOf(axis)], prop === 'scale' ? 1 : 0);
  }
  function write(object, channel, value) {
    if (channel.startsWith('pose.')) { (object.poseControls ||= {})[channel.slice(5)] = value; return; }
    const [prop, axis] = channel.split('.');
    if (!axis) { object[prop] = value; return; }
    const host = prop === 'target' ? object : (object.transform ||= {});
    const a = (host[prop] ||= prop === 'scale' ? [1,1,1] : [0,0,0]);
    a['xyz'.indexOf(axis)] = value;
  }
  function normalizeTrack(track) {
    track.channels ||= {};
    for (const key of track.keys || []) {
      for (const [prop, list] of Object.entries(GROUPS)) {
        if (key[prop] == null) continue;
        list.forEach((channel, i) => {
          const value = prop === 'fov' ? key.fov : prop === 'pose' ? key.pose[list[i].slice(5)] : key[prop][i];
          if (Number.isFinite(value)) putKey(track, channel, key.frame, value, key.interp || 'linear', (key.id || id()) + '-' + channel);
        });
      }
    }
    track.keys = []; // Legacy compound keys are consumed once, never re-created after deletion.
    for (const [channel, keys] of Object.entries(track.channels)) {
      if (!channels(channel).length) { delete track.channels[channel]; continue; }
      const unique = new Map();
      for (const key of keys || []) if (Number.isFinite(key.value) && Number.isFinite(key.frame)) {
        key.id ||= id(); key.frame = Math.max(0, Math.round(key.frame)); unique.set(key.frame, key);
      }
      track.channels[channel] = [...unique.values()].sort((a,b) => a.frame-b.frame);
    }
    return track;
  }
  function putKey(track, channel, frame, value, interp = 'linear', keyId) {
    track.channels ||= {};
    const keys = (track.channels[channel] ||= []);
    frame = Math.max(0, Math.round(frame));
    let key = keys.find(k => k.frame === frame);
    if (key) { key.value = value; key.interp = interp; }
    else { key = { id: keyId || id(), frame, value, interp }; keys.push(key); keys.sort((a,b) => a.frame-b.frame); }
    return key;
  }
  function entries(track, group) {
    const allowed = group ? channels(group) : Object.keys(track.channels || {});
    return allowed.flatMap(channel => (track.channels?.[channel] || []).map(key => ({track, channel, key})));
  }
  function ease(t, mode) {
    if (mode === 'hold' || mode === 'step') return 0;
    if (mode === 'ease') return t*t*(3-2*t);
    if (mode === 'ease-in') return t*t;
    if (mode === 'ease-out') return 1-(1-t)*(1-t);
    return t;
  }
  function sampleKeys(keys, frame, rotation = false) {
    if (!keys?.length) return undefined;
    if (frame <= keys[0].frame) return keys[0].value;
    for (let i=1; i<keys.length; i++) {
      const b=keys[i], a=keys[i-1];
      if (frame === b.frame) return b.value; // Hold must change on the exact destination frame.
      if (frame < b.frame) {
        const t=ease((frame-a.frame)/(b.frame-a.frame),a.interp);
        let delta=b.value-a.value;
        if (rotation && !a.unwrapped) delta=((delta+180)%360+360)%360-180;
        return a.value+delta*t;
      }
    }
    return keys[keys.length-1].value;
  }
  function sampleObject(object, track, frame) {
    const out = {...object, transform: clone(object.transform), target: object.target?.slice(), poseControls: {...object.poseControls}};
    if (track && !track.muted) for (const [channel, keys] of Object.entries(track.channels || {})) {
      const value=sampleKeys(keys,frame,channel.startsWith('rotation.'));
      if (value !== undefined) write(out,channel,value);
    }
    return out;
  }



  function samplePathWalk(object, track, frame, fps) {
    if(track?.agentPaths?.length){const p=track.agentPaths.filter(p=>frame>=p.startFrame&&frame<p.startFrame+Math.round(p.duration*fps)-1).at(-1);if(!p)return null;track={...track,path:p};}
    if(object.kind!=='character'||!track?.path||track.muted||track.path.enabled===false||!Number.isFinite(frame))return null;
    if(track.path.action==='none')return null;
    fps=number(fps,24);if(fps<=0)return null;
    const keys=entries(track,'position').filter(e=>e.key.source==='path');
    if(keys.length<2)return null;
    const start=Math.min(...keys.map(e=>e.key.frame)),end=Math.max(...keys.map(e=>e.key.frame));
    if(frame<start||frame>=end)return null;
    // A held key jumps to its destination; it is not a continuous walk.
    const interpolating=GROUPS.position.some(ch=>(track.channels[ch]||[]).some((k,i,list)=>{
      const next=list[i+1];return next&&frame>=k.frame&&frame<next.frame&&k.value!==next.value&&!['hold','step'].includes(k.interp);
    }));
    if(!interpolating)return null;
    const a=Math.max(start,frame-fps*.05),b=Math.min(end,frame+fps*.05);
    const p=sampleObject(object,track,a).transform.position,q=sampleObject(object,track,b).transform.position;
    const speed=Math.hypot(...q.map((v,i)=>v-p[i]))*fps/(b-a);
    if(speed<=.05)return null;
    if(!track.path.action)return{seconds:frame/fps,speed};
    // Integrate authored distance for cadence, so seeks and exports share the same gait.
    const steps=Math.min(200,Math.max(1,Math.ceil(frame-start))),step=(frame-start)/steps;let distance=0,previous=sampleObject(object,track,start).transform.position;
    for(let i=1;i<=steps;i++){const point=sampleObject(object,track,start+i*step).transform.position;distance+=Math.hypot(...point.map((v,k)=>v-previous[k]));previous=point;}
    const action=track.path.action==='auto'?(speed>2.4?'run':'walk'):track.path.action;
    return{seconds:distance/(action==='run'?2.8:1.35),speed,action};
  }
  function migrate(project) {
    project.sequence ||= {fps:24,durationFrames:240};
    project.sequence.fps = clamp(Math.round(number(project.sequence.fps,24)),1,120);
    project.sequence.durationFrames = clamp(Math.round(number(project.sequence.durationFrames,240)),2,project.sequence.fps*3600);
    project.objectAnimationTracks = (project.objectAnimationTracks || []).map(normalizeTrack);
    if(project.characterTracks?.some(t=>t.clips?.length))project.removedMotionTracks ||= clone(project.characterTracks);
    delete project.characterTracks;
    for(const o of project.objects||[])if(o.kind==='character')o.poseMode='static';
    project.cameraTrack ||= {clips:[]}; project.cameraTrack.clips ||= [];
    project.timeline ||= {unit:'s',zoom:3,loop:false,autoKey:false};
    const max=project.sequence.durationFrames-1;
    project.sequence.workArea ||= [0,max];
    project.sequence.workArea=[clamp(number(project.sequence.workArea[0]),0,max-1),clamp(number(project.sequence.workArea[1],max),1,max)];
    if(project.sequence.workArea[1]<=project.sequence.workArea[0]) project.sequence.workArea[1]=project.sequence.workArea[0]+1;
    return project;
  }
  function moveKeys(trackList, selectedIds, delta, duration, snap = true) {
    selectedIds=new Set(trackList.filter(t=>!t.locked).flatMap(t=>entries(t)).filter(e=>selectedIds.has(e.key.id)).map(e=>e.key.id));
    const selected = trackList.flatMap(t=>entries(t)).filter(e=>selectedIds.has(e.key.id));
    if(!selected.length) return 0;
    const min=Math.min(...selected.map(e=>e.key.frame)), max=Math.max(...selected.map(e=>e.key.frame));
    delta=clamp(Math.round(delta),-min,duration-1-max);
    if(snap) {
      const candidates=trackList.flatMap(t=>entries(t)).filter(e=>!selectedIds.has(e.key.id)).map(e=>e.key.frame);
      let distance=3, adjustment=0;
      for(const e of selected) for(const f of candidates) { const d=f-(e.key.frame+delta); if(Math.abs(d)<distance){distance=Math.abs(d);adjustment=d;} }
      delta=clamp(delta+adjustment,-min,duration-1-max);
    }
    // A move onto an occupied channel/frame replaces that key deterministically.
    for(const t of trackList) for(const [channel,keys] of Object.entries(t.channels||{})) {
      const moving=keys.filter(k=>selectedIds.has(k.id)); const destinations=new Set(moving.map(k=>k.frame+delta));
      t.channels[channel]=keys.filter(k=>selectedIds.has(k.id)||!destinations.has(k.frame+0));
      moving.forEach(k=>{k.frame+=delta;}); t.channels[channel].sort((a,b)=>a.frame-b.frame);
    }
    return delta;
  }
  function cameraAt(project, frame) {
    const cuts=(project.cameraTrack?.clips || []).filter(c=>c.startFrame<=frame && frame<c.endFrame).sort((a,b)=>b.startFrame-a.startFrame);
    return cuts[0]?.cameraId || project.activeCameraId;
  }
  function cutCamera(project, cameraId, frame) {
    const end=project.sequence.durationFrames;
    const clips=project.cameraTrack.clips;
    const next=clips.filter(c=>c.startFrame>frame).sort((a,b)=>a.startFrame-b.startFrame)[0]?.startFrame || end;
    project.cameraTrack.clips=clips.filter(c=>c.startFrame!==frame);
    for(const c of project.cameraTrack.clips) if(c.startFrame<frame && c.endFrame>frame) c.endFrame=frame;
    project.cameraTrack.clips.push({id:id(),cameraId,startFrame:frame,endFrame:next});
    project.cameraTrack.clips.sort((a,b)=>a.startFrame-b.startFrame);
  }
  function pathPoints(spec) {
    if(spec.version===2&&spec.anchors){
      const pts=[];
      for(let i=0;i<spec.anchors.length-1;i++){
        const a=spec.anchors[i],b=spec.anchors[i+1],steps=a.out||b.in?32:1;
        for(let j=0;j<steps;j++){const t=j/steps,u=1-t;pts.push(pathToWorld(spec,a.point.map((v,k)=>u*u*u*v+3*u*u*t*(a.out||a.point)[k]+3*u*t*t*(b.in||b.point)[k]+t*t*t*b.point[k])));}
      }
      if(spec.anchors.length)pts.push(pathToWorld(spec,spec.anchors.at(-1).point));
      return pts;
    }
    const n=96, pts=[], w=number(spec.width,3), h=number(spec.depth,3);
    if(spec.type==='circle') for(let i=0;i<=n;i++){const a=i/n*Math.PI*2;pts.push([Math.sin(a)*w/2,0,(1-Math.cos(a))*h/2]);}
    else if(spec.type==='rectangle') pts.push([0,0,0],[w,0,0],[w,0,h],[0,0,h],[0,0,0]);
    else if(spec.type==='line') pts.push([0,0,0],[w,0,h]);
    else {
      const source=spec.points || [[0,0,0],[w,0,h]];
      if(spec.type==='pen' && source.length>2) {
        for(let i=0;i<source.length-1;i++) for(let j=0;j<12;j++) {
          const p0=source[Math.max(0,i-1)],p1=source[i],p2=source[i+1],p3=source[Math.min(source.length-1,i+2)],t=j/12;
          pts.push([0,1,2].map(k=>.5*((2*p1[k])+(-p0[k]+p2[k])*t+(2*p0[k]-5*p1[k]+4*p2[k]-p3[k])*t*t+(-p0[k]+3*p1[k]-3*p2[k]+p3[k])*t*t*t)));
        }
        pts.push(source[source.length-1]);
      } else pts.push(...source);
    }
    const a=number(spec.yaw)*Math.PI/180, s=number(spec.scale,1), origin=spec.origin || [0,0,0];
    return pts.map(p=>[origin[0]+s*(p[0]*Math.cos(a)+p[2]*Math.sin(a)),origin[1]+s*p[1],origin[2]+s*(-p[0]*Math.sin(a)+p[2]*Math.cos(a))]);
  }
  // Path geometry is independent of Three.js so playback and export use identical curves.
  function rotatePathPoint(point,rotation,inverse=false){
    let p=point.slice();
    for(const axis of inverse?[0,1,2]:[2,1,0]){
      const a=(rotation?.[axis]||0)*Math.PI/180*(inverse?-1:1),c=Math.cos(a),s=Math.sin(a),[x,y,z]=p;
      p=axis===0?[x,c*y-s*z,s*y+c*z]:axis===1?[c*x+s*z,y,-s*x+c*z]:[c*x-s*y,s*x+c*y,z];
    }
    return p;
  }
  function pathToWorld(p,point){const r=rotatePathPoint(point.map((v,i)=>v*(p.scale3?.[i]??1)*(p.scale??1)),p.rotation);return r.map((v,i)=>v+(p.origin?.[i]||0));}
  function pathToLocal(p,point){return rotatePathPoint(point.map((v,i)=>v-(p.origin?.[i]||0)),p.rotation,true).map((v,i)=>v/((p.scale3?.[i]??1)*(p.scale??1)));}
  function pathFromAnchors(type,anchors,duration=10,follow=true){
    const all=anchors.flatMap(a=>[a.point,a.in,a.out].filter(Boolean)),origin=[0,1,2].map(k=>(Math.min(...all.map(p=>p[k]))+Math.max(...all.map(p=>p[k])))/2);
    return {version:2,type,name:({circle:'圆环路径',line:'直线路径',rectangle:'矩形路径',pencil:'铅笔路径',pen:'钢笔路径'}[type]||'路径')+'1',startFrame:0,duration,origin,rotation:[0,0,0],scale3:[1,1,1],scale:1,follow,anchors:anchors.map(a=>Object.fromEntries(Object.entries(a).map(([k,v])=>[k,Array.isArray(v)?v.map((n,i)=>n-origin[i]):v])))};
  }
  function upgradePath(p){
    if(p.version===2)return p;
    const anchors=pathPoints(p).map(point=>({point,mode:'vertex'})),n=pathFromAnchors(p.type,anchors,p.duration,p.follow);
    return Object.assign(p,n,{startFrame:p.startFrame||0});
  }
  function pathPreset(type,position,yaw,duration=10,follow=true){
    const a=yaw*Math.PI/180,f=[Math.sin(a),0,Math.cos(a)],r=[f[2],0,-f[0]],add=(v,w=0)=>position.map((n,i)=>n+f[i]*v+r[i]*w);
    let nodes;
    if(type==='line')nodes=[{point:add(0),mode:'vertex'},{point:add(4),mode:'vertex'}];
    else if(type==='rectangle')nodes=[add(0),add(3),add(3,4),add(0,4),add(0)].map(point=>({point,mode:'vertex'}));
    else {const c=position.map((v,i)=>v-r[i]*2),k=1.1045694996;nodes=Array.from({length:5},(_,i)=>{const t=i*Math.PI/2,point=c.map((v,j)=>v+2*(r[j]*Math.cos(t)+f[j]*Math.sin(t))),tangent=f.map((v,j)=>v*Math.cos(t)-r[j]*Math.sin(t));return {point,in:point.map((v,j)=>v-k*tangent[j]),out:point.map((v,j)=>v+k*tangent[j]),mode:'symmetric'};});}
    return pathFromAnchors(type,nodes,duration,follow);
  }
  function editPathAnchor(p,index,part,world){
    upgradePath(p);const a=p.anchors[index];if(!a)return;
    const value=pathToLocal(p,world);
    if(part==='point'){const delta=value.map((v,i)=>v-a.point[i]);for(const k of ['point','in','out'])if(a[k])a[k]=a[k].map((v,i)=>v+delta[i]);}
    else {a[part]=value;const other=part==='in'?'out':'in';if(a.mode==='symmetric')a[other]=value.map((v,i)=>2*a.point[i]-v);else if(a.mode==='asymmetric'&&a[other]){const length=Math.hypot(...a[other].map((v,i)=>v-a.point[i])),vector=value.map((v,i)=>v-a.point[i]),d=Math.hypot(...vector);if(d>1e-8)a[other]=vector.map((v,i)=>a.point[i]-v*length/d);}}
    // Closed paths share their first/last anchor and tangent continuity.
    if(['circle','rectangle'].includes(p.type)&&(index===0||index===p.anchors.length-1))p.anchors[index===0?p.anchors.length-1:0]=clone(a);
  }
  function setAnchorMode(p,index,mode){
    const a=p.anchors[index];if(!a)return;a.mode=mode;
    if(mode==='vertex'){delete a.in;delete a.out;}
    else {const next=p.anchors[Math.min(index+1,p.anchors.length-1)].point,prev=p.anchors[Math.max(0,index-1)].point;const vector=a.out?a.out.map((v,i)=>v-a.point[i]):next.map((v,i)=>(v-prev[i])/6);a.out=a.point.map((v,i)=>v+vector[i]);a.in=a.point.map((v,i)=>v-vector[i]);}
    if(['circle','rectangle'].includes(p.type)&&(index===0||index===p.anchors.length-1))p.anchors[index===0?p.anchors.length-1:0]=clone(a);
  }
  function resamplePath(points, count) {
    const distances=[0];
    for(let i=1;i<points.length;i++) distances.push(distances[i-1]+Math.hypot(...points[i].map((v,k)=>v-points[i-1][k])));
    const length=distances[distances.length-1];
    return Array.from({length:count},(_,i)=>{
      const d=length*i/(count-1); let k=1; while(k<distances.length-1 && distances[k]<d) k++;
      const a=points[k-1]||points[0],b=points[k]||a,t=(d-distances[k-1])/(distances[k]-distances[k-1]||1);
      return a.map((v,j)=>v+(b[j]-v)*t);
    });
  }
  function bakePath(track, spec, fps, duration) {
    delete track.agentPaths; // A manual path edit replaces the AI's staged path.
    normalizeTrack(track);
    const start=clamp(Math.round(number(spec.startFrame)),0,duration-2);
    const end=clamp(start+Math.max(1,Math.round(number(spec.duration,10)*fps)-1),start+1,duration-1);
    const points=resamplePath(pathPoints(spec),Math.min(97,end-start+1));
    // Integer frame rounding must also adjust distance. Otherwise a straight
    // path alternates between faster and slower segments at 2/3-frame gaps.
    const timed=points.map((_,i)=>{
      const frame=start+Math.round((end-start)*i/(points.length-1));
      const at=(frame-start)/(end-start)*(points.length-1),a=Math.floor(at),b=Math.min(points.length-1,a+1),t=at-a;
      return {frame,point:points[a].map((v,j)=>v+(points[b][j]-v)*t)};
    });
    for(const channel of [...GROUPS.position,'rotation.y']) if(track.channels?.[channel]) track.channels[channel]=track.channels[channel].filter(k=>k.source!=='path' && (!(GROUPS.position.includes(channel)||spec.follow!==false) || k.frame<start || k.frame>end));
    let prevYaw;
    timed.forEach(({point:p,frame},i)=>{
      GROUPS.position.forEach((ch,j)=>{putKey(track,ch,frame,p[j],'linear').source='path';});
      if(spec.follow!==false) {
        const q=i<timed.length-1?timed[i+1].point:timed[i-1].point,sign=i<timed.length-1?1:-1;
        let yaw=Math.atan2((q[0]-p[0])*sign,(q[2]-p[2])*sign)*180/Math.PI;
        if(prevYaw!==undefined) yaw=prevYaw+((yaw-prevYaw+180)%360+360)%360-180;
        prevYaw=yaw; const k=putKey(track,'rotation.y',frame,yaw,'linear'); k.source='path'; k.unwrapped=true;
      }
    });
    track.path=clone(spec); return points;
  }
  // Export sampling is independent of the editing frame rate. Keep scene time intact.
  function exportPlan(sequence, workArea, rate = 30) {
    rate = rate === 60 ? 60 : 30;
    const fps = sequence.fps, from = workArea[0], end = workArea[1] + 1;
    const seconds = (end - from) / fps;
    return {rate, seconds, count:Math.ceil(seconds * rate), frameAt:i=>Math.min(end - 1e-6, from + i * fps / rate)};
  }
  function trackRange(track) {
    const frames = entries(track || {channels:{}}).map(e=>e.key.frame);
    return frames.length ? frames.reduce((range,f)=>({start:Math.min(range.start,f),end:Math.max(range.end,f)}),{start:Infinity,end:-Infinity}) : null;
  }
  return {GROUPS,clone,clamp,channels,read,write,normalizeTrack,putKey,entries,sampleKeys,sampleObject,samplePathWalk,migrate,moveKeys,cameraAt,cutCamera,pathPoints,pathToWorld,pathToLocal,pathPreset,pathFromAnchors,upgradePath,editPathAnchor,setAnchorMode,resamplePath,bakePath,exportPlan,trackRange};
});
