'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Startup=require('../startup-animation.js');
const code=fs.readFileSync(require('node:path').join(__dirname,'../startup-animation.js'),'utf8');

function fixture({supports3d=true,storageError=false}={}) {
  const frames=new Map(),timers=new Map(),listeners=new Map(),documentListeners=new Map(),nodes=[],classes=new Set(),events=[];
  let sequence=0,now=0,draws=0;
  const style=()=>({getPropertyValue(name){return this[name]||'';},getPropertyPriority(){return '';},setProperty(name,value){this[name]=value;},removeProperty(name){delete this[name];}});
  const node=()=>{
    const attrs=new Map(),children=new Map();
    const item={style:style(),inert:false,isConnected:true,textContent:'',className:'',
      setAttribute:(name,value)=>attrs.set(name,String(value)),getAttribute:name=>attrs.get(name)??null,removeAttribute:name=>attrs.delete(name),
      addEventListener:(name,handler)=>{item['on'+name]=handler;},
      querySelector(selector){if(!children.has(selector))children.set(selector,node());return children.get(selector);},
      focus(){document.activeElement=item;},remove(){const index=nodes.indexOf(item);if(index>=0)nodes.splice(index,1);item.isConnected=false;}};
    return item;
  };
  const shell=node();shell.style.position='relative';shell.style.opacity='.8';
  const previousFocus=node();
  const document={readyState:'complete',activeElement:previousFocus,body:{append(...items){nodes.push(...items);}},
    documentElement:{classList:{add:(...names)=>names.forEach(name=>classes.add(name)),remove:(...names)=>names.forEach(name=>classes.delete(name))}},
    querySelector:selector=>selector==='.app-shell'?shell:null,createElement:()=>node(),
    addEventListener:(name,handler)=>documentListeners.set(name,handler),removeEventListener:name=>documentListeners.delete(name)};
  const values=new Map();
  const window={document,innerWidth:1440,innerHeight:900,performance:{now:()=>now},CSS:{supports:()=>supports3d},matchMedia:()=>({matches:false}),
    localStorage:{getItem:key=>{if(storageError)throw Error('blocked');return values.get(key)||null;},setItem:(key,value)=>{if(storageError)throw Error('blocked');values.set(key,value);}},
    requestAnimationFrame:callback=>{const id=++sequence;frames.set(id,callback);return id;},cancelAnimationFrame:id=>frames.delete(id),
    setTimeout:(callback,delay)=>{const id=++sequence;timers.set(id,{callback,delay});return id;},clearTimeout:id=>timers.delete(id),
    Event:class{constructor(type){this.type=type;}},dispatchEvent:event=>events.push(event.type),CanvasFlowConnections:{draw:()=>{draws++;}}};
  window.addEventListener=(name,handler)=>listeners.set(name,handler);window.removeEventListener=name=>listeners.delete(name);
  const context={window,module:{exports:{}},console};vm.runInNewContext(code,context);
  return {api:context.module.exports,shell,document,nodes,classes,listeners,documentListeners,frames,timers,events,previousFocus,values,
    advance(milliseconds){for(let count=0;count<Math.ceil(milliseconds/80);count++){now+=80;const pending=[...frames.values()];frames.clear();pending.forEach(callback=>callback(now));}},get draws(){return draws;}};
}

test('default is the enabled first water scheme; invalid settings and blocked storage have safe defaults',()=>{
  for(const value of [null,[],false,{},'flip',{mode:'unknown'}])assert.deepEqual(Startup.normalize(value),{enabled:true,mode:'water'});
  assert.deepEqual(Startup.normalize({enabled:false,mode:'water'}),{enabled:false,mode:'water'});
  const f=fixture({storageError:true});assert.equal(f.api.preferences().mode,'water');assert.equal(f.api.savePreferences({mode:'flip'}),null);
});

test('scheme and enable switch persist independently without modifying any project data',()=>{
  const f=fixture();assert.equal(f.api.savePreferences({mode:'water'}).enabled,true);
  assert.equal(f.api.savePreferences({enabled:false}).mode,'water');assert.equal(f.values.size,1);
  assert.equal(f.api.preferences().enabled,false);
});

test('launch waits below 100 percent for both boot and workspace readiness, then restores real canvas',async()=>{
  const f=fixture(),done=f.api.play();f.advance(10000);
  assert.equal(f.api.isPlaying(),true);const progress=f.nodes[1].querySelector('.cf-launch-progress');assert.equal(progress.getAttribute('aria-valuenow'),'92');
  f.api.booted();f.advance(1000);assert.equal(f.api.isPlaying(),true);
  f.api.ready();f.advance(10000);assert.equal(await done,true);assert.equal(f.api.isPlaying(),false);
  assert.equal(f.shell.inert,false);assert.equal(f.shell.style.position,'relative');assert.equal(f.shell.style.opacity,'.8');
  assert.equal(f.shell.getAttribute('aria-hidden'),null);assert.equal(f.nodes.length,0);assert.equal(f.classes.size,0);
  assert.equal(f.frames.size,0);assert.equal(f.timers.size,0);assert.equal(f.document.activeElement,f.previousFocus);
  assert(f.events.includes('resize'));assert.equal(f.draws,1);
});

test('preview uses the requested backup scheme without changing saved selection or waiting for boot',async()=>{
  const f=fixture();f.api.savePreferences({mode:'flip',enabled:false});const done=f.api.preview('water');
  f.advance(10000);assert.equal(await done,true);assert.equal(f.api.preferences().mode,'flip');assert.equal(f.api.preferences().enabled,false);
});

test('Escape skips the overlay and blocks canvas shortcut handlers while animation owns focus',async()=>{
  const f=fixture(),done=f.api.preview('flip');let prevented=0,stopped=0;
  assert.equal(f.documentListeners.has('keydown'),false);assert(f.listeners.has('keydown'));
  const event={key:'Delete',preventDefault:()=>prevented++,stopImmediatePropagation:()=>stopped++};
  f.listeners.get('keydown')(event);assert.equal(f.api.isPlaying(),true);
  f.listeners.get('keydown')({...event,key:'Escape'});assert.equal(await done,true);
  assert.equal(prevented,2);assert.equal(stopped,2);assert.equal(f.shell.inert,false);assert.equal(f.listeners.size,0);
});

test('hard timeout cleans up the overlay even when initialization never becomes ready',async()=>{
  const f=fixture(),done=f.api.play();const guard=[...f.timers.values()].find(timer=>timer.delay===20000);guard.callback();
  assert.equal(await done,true);assert.equal(f.api.isPlaying(),false);assert.equal(f.nodes.length,0);assert.equal(f.shell.inert,false);
});

test('unsupported 3D uses the first water scheme and animation samples remain bounded through completion',async()=>{
  const f=fixture({supports3d:false}),done=f.api.preview('flip');f.advance(6500);
  assert.equal(f.shell.style.transform,'none');assert.equal(Number(f.shell.style.opacity),0);f.advance(3500);assert.equal(await done,true);
  for(const mode of ['water','flip'])for(let time=0;time<=10000;time+=100){const state=Startup.sample(time,mode);for(const key of ['load','flip','morph','turn','zoom','size','fade'])assert(state[key]>=0&&state[key]<=1);}
});

test('disabled startup installs no overlay and concurrent preview calls cannot stack',async()=>{
  const f=fixture();f.api.savePreferences({enabled:false});f.api.install();assert.equal(f.nodes.length,0);assert.equal(f.classes.size,0);
  const first=f.api.preview('flip');assert.equal(await f.api.preview('water'),false);f.api.skip();assert.equal(await first,true);
});
