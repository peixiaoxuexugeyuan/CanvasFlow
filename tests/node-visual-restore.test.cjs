const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const acorn=require('../tools/release/node_modules/acorn'),source=fs.readFileSync('app.js','utf8');let definition;
function walk(n){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration'&&n.id.name==='applyNodeVisualState')definition=source.slice(n.start,n.end);for(const v of Object.values(n))if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}
walk(acorn.parse(source,{ecmaVersion:'latest'}));
test('failed model nodes restore their retry state independently of window.status',()=>{
  const states=[],scope={setModelJobState:(_,text)=>states.push(text),setModelNodeVideo:()=>{},status:'completed'};
  vm.createContext(scope);vm.runInContext(definition,scope);
  const node={dataset:{node:'model'},matches:()=>false,querySelector:()=>null};
  scope.applyNodeVisualState(node,{jobStatus:'failed'});assert.deepEqual(states,['生成失败 · 可右键重试']);
  states.length=0;scope.status='failed';scope.applyNodeVisualState(node,{jobStatus:'queued'});assert.deepEqual(states,[]);
});
