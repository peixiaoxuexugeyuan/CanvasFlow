import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rename,rm,symlink,open,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {turnSnapshot,turnSignature,restoreTurn,saveTurnSnapshots,loadTurnSnapshots,discardTurnSnapshots} from '../tools/openfilm/turn-history.mjs';
test('turn restore preserves binary bytes after in-place editing and retains new files in trash',async()=>{
 const root=await mkdtemp(join(tmpdir(),'cf-turn-'));
 try{await mkdir(join(root,'assets'));await writeFile(join(root,'film.html'),'before');await writeFile(join(root,'assets/a.png'),Buffer.from([1,2,3]));
 const before=await turnSnapshot(root,'fixture');await writeFile(join(root,'film.html'),'after');await writeFile(join(root,'assets/a.png'),Buffer.from([4,5,6]));await writeFile(join(root,'new.txt'),'keep me');
 const after=await turnSnapshot(root);assert.notEqual(turnSignature(before),turnSignature(after));
 const result=await restoreTurn(root,before,'fixture',after,async file=>{await rename(file,join(root,'.film/new-preserved.txt'));});assert.equal(result.restored,3);
 assert.equal(await readFile(join(root,'film.html'),'utf8'),'before');assert.deepEqual(await readFile(join(root,'assets/a.png')),Buffer.from([1,2,3]));assert.equal(await readFile(join(root,'.film/new-preserved.txt'),'utf8'),'keep me');
 await writeFile(join(root,'assets/a.png'),Buffer.from([7,8,9]));assert.deepEqual(await readFile(join(root,'.film/cache/turn-files/fixture/assets/a.png')),Buffer.from([1,2,3]));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('restore rejects links to outside files and incomplete snapshots before writing',async()=>{
 const root=await mkdtemp(join(tmpdir(),'cf-turn-link-')),outside=await mkdtemp(join(tmpdir(),'cf-turn-outside-'));
 try{await mkdir(join(root,'assets'));await writeFile(join(root,'assets/a.txt'),'original');const before=await turnSnapshot(root,'fixture');await writeFile(join(root,'assets/a.txt'),'modified');const current=await turnSnapshot(root);
 await rm(join(root,'assets'),{recursive:true});await writeFile(join(outside,'a.txt'),'outside');await symlink(outside,join(root,'assets'),'junction');
 await assert.rejects(restoreTurn(root,before,'fixture',current,async()=>{}),/链接/);assert.equal(await readFile(join(outside,'a.txt'),'utf8'),'outside');
 await rm(join(root,'assets'));await assert.rejects(restoreTurn(root,{...before,cut:true},'fixture',current,async()=>{}),/容量/);
 }finally{await rm(root,{recursive:true,force:true});await rm(outside,{recursive:true,force:true});}
});
test('real 512 MB capacity guard refuses incomplete undo and corrupt copies leave all files untouched',async()=>{
 const root=await mkdtemp(join(tmpdir(),'cf-turn-capacity-'));
 try{
  await mkdir(join(root,'assets'));await writeFile(join(root,'film.html'),'original');
  const file=await open(join(root,'assets/large.mp4'),'w');try{await file.truncate(512*1024*1024+1);}finally{await file.close();}
  const oversized=await turnSnapshot(root,'over-cap');assert.equal(oversized.cut,true);
  await assert.rejects(restoreTurn(root,oversized,'over-cap',oversized,()=>{}),/容量/);
  await rm(join(root,'assets/large.mp4'));await writeFile(join(root,'assets/a.png'),Buffer.from([1,2,3]));
  const before=await turnSnapshot(root,'corrupt');await writeFile(join(root,'film.html'),'edited');await writeFile(join(root,'assets/a.png'),Buffer.from([4,5,6]));const after=await turnSnapshot(root);
  await writeFile(join(root,'.film/cache/turn-files/corrupt/assets/a.png'),Buffer.from([9]));
  await assert.rejects(restoreTurn(root,before,'corrupt',after,()=>{}),/不完整/);
  assert.equal(await readFile(join(root,'film.html'),'utf8'),'edited');assert.deepEqual(await readFile(join(root,'assets/a.png')),Buffer.from([4,5,6]));
 }finally{await rm(root,{recursive:true,force:true});}
});
test('50 retained snapshot directories can be reopened and pruning deletes only the expired turn',async()=>{
 const root=await mkdtemp(join(tmpdir(),'cf-turn-retain-'));
 try{
  await writeFile(join(root,'film.html'),'keep');
  for(let i=0;i<51;i++)await saveTurnSnapshots(root,'turn-'+i,{before:{files:[['film.html',{text:'before-'+i}]]},after:{files:[['film.html',{text:'after-'+i}]]}});
  await discardTurnSnapshots(root,'turn-0');await assert.rejects(stat(join(root,'.film/cache/turn-files/turn-0')),/ENOENT/);
  for(let i=1;i<51;i++)assert.equal((await loadTurnSnapshots(root,'turn-'+i)).before.files[0][1].text,'before-'+i);
  assert.equal(await readFile(join(root,'film.html'),'utf8'),'keep');
  await assert.rejects(discardTurnSnapshots(root,'../escape'),/标识无效/);
 }finally{await rm(root,{recursive:true,force:true});}
});
