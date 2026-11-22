const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const source=fs.readFileSync('agent-skill-editor.js','utf8');
const body=source.slice(source.indexOf('    async function importFiles('),source.indexOf("    dialog.querySelector('.cse-file-input').addEventListener"));
function setup(files=[{path:'SKILL.md',content:''}]){
 const errors=[];const scope={busy:false,closed:false,error:{},fields:{},save:{},selected:'SKILL.md',primary:'SKILL.md',folders:[],files,TextEncoder,
  validPath:p=>!!p&&!p.includes('..'),autofill(){},paint(){},fail:m=>errors.push(m)};
 vm.createContext(scope);vm.runInContext(body,scope);return {scope,errors};
}
const file=(name,content,extra={})=>({name,size:Buffer.byteLength(content),text:async()=>content,...extra});
test('multiple documents are all staged and an empty default primary is filled',async()=>{
 const {scope,errors}=setup();await scope.importFiles([file('SKILL.md','main'),file('camera.md','reference')],false);
 assert.equal(scope.files.length,2);assert.equal(scope.files[0].content,'main');assert.equal(scope.files[1].content,'reference');assert.deepEqual(errors,[]);
});
test('a conflicting or duplicate multi-file drop never partially mutates existing files',async()=>{
 for(const picks of [[file('new.md','new'),file('SKILL.md','overwrite')],[file('a.md','1'),file('A.md','2')],[file('new.md','new'),file('bad.png','bad')]]){
  const {scope,errors}=setup([{path:'SKILL.md',content:'original'}]);await scope.importFiles(picks,false);
  assert.equal(scope.files.length,1);assert.equal(scope.files[0].content,'original');assert.equal(errors.length,1);
 }
});
test('single file replacement preserves references; folders preserve relative paths',async()=>{
 const {scope}=setup([{path:'SKILL.md',content:'old'},{path:'ref.md',content:'reference'}]);await scope.importFiles([file('main.md','new')],false);
 assert.equal(scope.files[0].content,'new');assert.equal(scope.files[1].content,'reference');
 await scope.importFiles([file('SKILL.md','main',{webkitRelativePath:'pack/SKILL.md'}),file('note.md','ref',{webkitRelativePath:'pack/references/note.md'})],true);
 assert.equal(scope.files[1].path,'references/note.md');
});
test('combined document size is bounded before replacing any content',async()=>{
 const {scope,errors}=setup([{path:'SKILL.md',content:'x'.repeat(1999998)}]);await scope.importFiles([file('a.md','abc'),file('b.md','def')],false);
 assert.equal(scope.files.length,1);assert.match(errors[0],/2 MB/);
});
test('a folder with unsupported dependencies lists them and keeps the previous skill intact',async()=>{
 const {scope,errors}=setup([{path:'SKILL.md',content:'original'}]);
 await scope.importFiles([file('SKILL.md','see templates/config.json',{webkitRelativePath:'pack/SKILL.md'}),
  file('config.json','{}',{webkitRelativePath:'pack/templates/config.json'})],true);
 assert.equal(scope.files[0].content,'original');assert.match(errors[0],/pack\/templates\/config\.json/);
});
