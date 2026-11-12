const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const acorn=require('../tools/release/node_modules/acorn');
const source=fs.readFileSync(require('node:path').join(__dirname,'../workspace-materials.js'),'utf8');
const tree=acorn.parse(source,{ecmaVersion:'latest'}),parts=[];
function visit(node){
  if(!node||typeof node!=='object')return;
  if(node.type==='FunctionDeclaration'&&node.id.name==='uploadKind')parts.push(source.slice(node.start,node.end));
  if(node.type==='VariableDeclaration'&&node.declarations.some(d=>d.id.name==='UPLOAD_KINDS'))parts.push(source.slice(node.start,node.end));
  for(const value of Object.values(node))if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);
}
visit(tree);const scope={};vm.createContext(scope);vm.runInContext(parts.join('\n'),scope);
for(const [name,expected] of [['photo.PNG','image'],['photo.jpeg','image'],['clip.MOV','video'],['clip.webm','video'],['music.M4A','audio'],['sound.wav','audio'],['actor.GLB','model'],['unknown.exe',''],['no-extension','']])assert.equal(scope.uploadKind({name}),expected,name);
assert.equal(scope.uploadKind(null),'');console.log('Automatic upload type detection OK.');
