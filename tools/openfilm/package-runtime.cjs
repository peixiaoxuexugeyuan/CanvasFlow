'use strict';
// Copy only runtime inputs. Never copy workspace projects, keys, screenshots, upstream checkout or test output.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const own=['bridge.mjs','agent-edit.mjs','agent-advanced.mjs','canvas-sync.mjs','canvasflow-provider.mjs','external-agents.mjs','turn-history.mjs','editor-adapter.mjs','editor-bootstrap.js','package.json','UPSTREAM-NOTICE.md','runtime-sources.json'];
function findPackage(from,name){let current=from;while(true){const p=path.join(current,'node_modules',name);if(fs.existsSync(path.join(p,'package.json')))return fs.realpathSync(p);const next=path.dirname(current);if(next===current)throw Error('Missing film dependency '+name);current=next;}}
function copyPackage(source,target,ancestors=new Map()){
  const manifest=JSON.parse(fs.readFileSync(path.join(source,'package.json'),'utf8'));
  fs.cpSync(source,target,{recursive:true,dereference:true,filter:p=>!path.relative(source,p).split(path.sep).some(x=>['node_modules','.git','test','tests','__tests__'].includes(x))&&!p.endsWith('.map')});
  const next=new Map(ancestors);next.set(manifest.name,{source,target});
  for(const [name]of Object.entries({...manifest.peerDependencies,...manifest.dependencies,...manifest.optionalDependencies})){
    let dependency;try{dependency=findPackage(source,name);}catch(e){if(manifest.optionalDependencies?.[name]||manifest.peerDependenciesMeta?.[name]?.optional)continue;throw e;}
    if(next.get(name)?.source===dependency)continue;
    copyPackage(dependency,path.join(target,'node_modules',name),next);
  }
}
function prepareRuntime(backend,{protect=false}={}){
  const target=path.join(backend,'tools','openfilm');if(fs.existsSync(target))throw Error('Film runtime target already exists');
  for(const folder of ['node','openfilm-browser','openfilm-ffmpeg','openfilm-git'])if(!fs.existsSync(path.join(root,'.runtime',folder)))throw Error('Missing film runtime .runtime/'+folder);
  fs.mkdirSync(target,{recursive:true});
  for(const name of own){const input=fs.readFileSync(path.join(__dirname,name));fs.writeFileSync(path.join(target,name),protect&&/\.m?js$/.test(name)?require('../release/protection.cjs')(input.toString(),name.endsWith('.mjs')):input);}
  fs.cpSync(path.join(__dirname,'desktop-runtime'),path.join(target,'desktop-runtime'),{recursive:true});
  fs.cpSync(path.join(__dirname,'licenses'),path.join(target,'licenses'),{recursive:true});
  const manifest=require('./package.json');
  for(const name of Object.keys(manifest.dependencies))copyPackage(findPackage(__dirname,name),path.join(target,'node_modules',name));
  for(const folder of ['node','openfilm-browser','openfilm-ffmpeg','openfilm-git'])fs.cpSync(path.join(root,'.runtime',folder),path.join(backend,'.runtime',folder),{recursive:true,dereference:true,filter:p=>!p.split(path.sep).includes('__pycache__')&&!p.endsWith('.log')});
  return target;
}
module.exports={prepareRuntime,findPackage,copyPackage};
if(require.main===module){const target=path.resolve(process.argv[2]||'');if(!target.startsWith(root+path.sep))throw Error('Use a fresh directory inside the development workspace');prepareRuntime(target,{protect:process.argv.includes('--protect')});}
