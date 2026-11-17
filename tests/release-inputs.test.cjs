const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const inputs=new Set(fs.readFileSync(path.join(root,'tools/release/files.txt'),'utf8').split(/\r?\n/).filter(Boolean));
test('all local page scripts and styles are included in the desktop release',()=>{
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  const resources=[...html.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)].map(m=>m[1].split('?')[0]);
  for(const file of resources.filter(p=>!/^https?:/.test(p)&&/\.(?:js|mjs|css)$/.test(p))){
    assert(inputs.has(file),`Missing release input: ${file}`);
    assert(fs.existsSync(path.join(root,file)),`Missing source file: ${file}`);
  }
});
test('3D-BOX showcase artwork ships with its entry point',()=>{
  for(let i=1;i<=5;i++){
    const file=`assets/3d-box/showcase-${i}.webp`;
    assert(inputs.has(file),`Missing release artwork: ${file}`);
    assert(fs.existsSync(path.join(root,file)));
  }
});
