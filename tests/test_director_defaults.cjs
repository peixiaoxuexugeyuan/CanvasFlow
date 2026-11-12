// Execute production project constructors and migration with rendering dependencies stubbed.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const acorn=require('../tools/release/node_modules/acorn');
const source=fs.readFileSync(path.join(__dirname,'../director.js'),'utf8');
const tree=acorn.parse(source,{ecmaVersion:'latest'}),functions={};
function walk(node){
  if(!node||typeof node!=='object')return;
  if(node.type==='FunctionDeclaration'&&['defaultProject','migrateProject','migrateCameraAspects'].includes(node.id.name))functions[node.id.name]=source.slice(node.start,node.end);
  if(node.type==='VariableDeclaration'&&node.declarations.some(d=>d.id.name==='ASPECT_RATIOS'))functions.ratios=source.slice(node.start,node.end);
  for(const value of Object.values(node))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);
}
walk(tree);
const scope={FPS:24,DEFAULT_DURATION:240,Crowd:null,Rig:null,Animation:{migrate:p=>p}};
vm.createContext(scope);vm.runInContext(Object.values(functions).join('\n'),scope);
assert.equal(scope.defaultProject().scene.aspectRatio,'自适应');
assert.equal(scope.migrateProject(null).scene.aspectRatio,'自适应');
for(const ratio of ['自适应','21:9','16:9','4:3','1:1','3:4','9:16']){
  const saved={version:3,scene:{aspectRatio:ratio},objects:[],cameras:[]};
  assert.equal(scope.migrateProject(saved).scene.aspectRatio,ratio);
}
assert.equal(scope.migrateProject({objects:[],cameras:[],scene:{}}).scene.aspectRatio,'自适应');
const partial=scope.migrateProject({version:3,scene:{}});
assert.ok(Array.isArray(partial.objects));assert.ok(Array.isArray(partial.cameras));
console.log('Director default and saved aspect preservation OK.');
