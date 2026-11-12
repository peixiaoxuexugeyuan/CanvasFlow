'use strict';
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'../..');
const target=path.resolve(process.argv[2] || '');
if (!target.startsWith(root+path.sep) || path.basename(target)!=='app.asar') throw Error('Expected app.asar inside workspace');
const stage=path.join(root,'build-private','shell-'+require('node:crypto').randomUUID());
(async()=>{
  fs.cpSync(path.join(__dirname,'app'),stage,{recursive:true});
  for(const file of fs.readdirSync(stage).filter(x=>x.endsWith('.cjs'))){const p=path.join(stage,file);fs.writeFileSync(p,require('../release/protection.cjs')(fs.readFileSync(p,'utf8')));}
  const asar=await import(pathToFileURL(require.resolve('@electron/asar',{paths:[path.dirname(require.resolve('@electron/packager'))]})).href);
  await asar.createPackage(stage,target);
  console.log('Protected desktop shell rebuilt: '+target);
})().catch(error=>{console.error(error);process.exitCode=1;});
