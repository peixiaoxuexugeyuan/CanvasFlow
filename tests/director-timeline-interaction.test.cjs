const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const A=require('../director-animation.js');
const source=fs.readFileSync(require.resolve('../director-timeline.js'),'utf8');
function events(){
 const handlers=new Map();
 return {addEventListener(name,fn){const set=handlers.get(name)||new Set();set.add(fn);handlers.set(name,set);},removeEventListener(name,fn){handlers.get(name)?.delete(fn);},emit(name,event={}){for(const fn of [...handlers.get(name)||[]])fn(event);},count(){return [...handlers.values()].reduce((sum,set)=>sum+set.size,0);}};
}
function menuHarness(){
 const doc=events(),win=events();doc.createElement=()=>({style:{},setAttribute(){},getBoundingClientRect:()=>({width:160,height:120}),contains:el=>!!el.inside,remove(){this.removed=true;}});
 const scope={document:doc,window:win,openMenu:null,innerWidth:1000,innerHeight:800,S:{el:{shell:{appendChild(){}}}}};vm.createContext(scope);vm.runInContext(source.slice(source.indexOf('function dismissMenuOutside('),source.indexOf('function contextMenu(')),scope);return {scope,doc,win,open:()=>scope.menuAt(600,600,'actions')};
}
test('menus dismiss on any outside pointer, including buttons, without swallowing that action',()=>{
 const h=menuHarness();for(let i=0;i<3;i++){h.open();h.doc.emit('pointerdown',{target:{inside:true}});assert.ok(h.scope.openMenu);h.doc.emit('pointerdown',{target:{tagName:'BUTTON'},preventDefault(){throw Error('outside action swallowed');}});assert.equal(h.scope.openMenu,null);assert.equal(h.doc.count()+h.win.count(),0);}
});
test('Escape closes only the menu; wheel, new context menu, resize and blur also clean up',()=>{
 const h=menuHarness();h.open();let prevented=false,stopped=false;h.doc.emit('keydown',{key:'Escape',preventDefault(){prevented=true;},stopPropagation(){stopped=true;}});assert.ok(prevented&&stopped);assert.equal(h.scope.openMenu,null);
 for(const [bus,event]of [[h.doc,'wheel'],[h.doc,'contextmenu'],[h.win,'resize'],[h.win,'blur']]){h.open();bus.emit(event,{target:{}});assert.equal(h.scope.openMenu,null);assert.equal(h.doc.count()+h.win.count(),0);}
});
