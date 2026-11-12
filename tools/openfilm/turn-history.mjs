// Full per-turn copies: upstream hard links alone cannot undo in-place media edits.
import {snapshot,holdDir} from './desktop-runtime/file-changes.mjs';
import {lstat,mkdir,copyFile,readFile,writeFile,rm} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
const LIMIT=512*1024*1024;
function turnId(id){if(typeof id!=='string'||!/^[\w-]{1,120}$/.test(id))throw Error('快照标识无效');return id;}
export async function saveTurnSnapshots(root,id,value){
  const file=await safeTurnPath(root,'.film/cache/turn-files/'+turnId(id)+'/snapshots.json');
  await mkdir(dirname(file),{recursive:true});await writeFile(file,JSON.stringify(value));
}
export async function loadTurnSnapshots(root,id){return JSON.parse(await readFile(await safeTurnPath(root,'.film/cache/turn-files/'+turnId(id)+'/snapshots.json'),'utf8'));}
export async function discardTurnSnapshots(root,id){
  // Validate the complete parent chain before removing this specific cache folder.
  await safeTurnPath(root,'.film/cache/turn-files/'+turnId(id)+'/snapshots.json');
  await rm(holdDir(root,id),{recursive:true,force:true});
}
export async function safeTurnPath(root,path){
  if(typeof path!=='string'||/[\\:\x00-\x1f]/.test(path)||path.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('撤销快照路径无效');
  let target=root;
  const rootInfo=await lstat(root);if(!rootInfo.isDirectory()||rootInfo.isSymbolicLink())throw Error('成片目录已变更');
  for(const [i,p]of path.split('/').entries()){
    target=join(target,p);const info=await lstat(target).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
    if(info&&(info.isSymbolicLink()||(i<path.split('/').length-1?!info.isDirectory():!info.isFile())))throw Error('文件路径被替换为链接或其他类型，撤销已停止');
  }
  return target;
}
export async function turnSnapshot(root,id){
  const result=await snapshot(root,{canvas:true});let kept=0;
  for(const [path,seen]of result.files){
    const source=await safeTurnPath(root,path);
    if(seen.text!=null)continue;
    kept+=seen.size;if(kept>LIMIT){result.cut=true;continue;}
    seen.digest=createHash('sha256').update(await readFile(source)).digest('hex');
    if(id){const dest=await safeTurnPath(root,'.film/cache/turn-files/'+id+'/'+path);await mkdir(dirname(dest),{recursive:true});await copyFile(source,dest);seen.held=true;}
  }
  return result;
}
export const turnSignature=s=>JSON.stringify([...s.files].sort(([a],[b])=>a.localeCompare(b)).map(([p,v])=>[p,v.text??null,v.size,v.digest??(v.text==null?v.mtimeMs:null)]));
export async function restoreTurn(root,before,id,current,trash){
  if(before.cut||current.cut)throw Error('工程超过单轮快照容量，请使用版本历史恢复');
  const paths=[...new Set([...before.files.keys(),...current.files.keys()])];
  // Validate every destination and retained copy before changing any content.
  for(const path of paths){await safeTurnPath(root,path);const was=before.files.get(path);
    if(was&&was.text==null){if(!was.held)throw Error('没有保留完整媒体快照');const held=await safeTurnPath(root,'.film/cache/turn-files/'+id+'/'+path);if(createHash('sha256').update(await readFile(held)).digest('hex')!==was.digest)throw Error('媒体快照不完整，撤销已停止');}}
  let restored=0;
  for(const path of paths){const was=before.files.get(path),now=current.files.get(path);if(was&&now&&turnSignature({files:new Map([[path,was]])})===turnSignature({files:new Map([[path,now]])}))continue;
    const target=await safeTurnPath(root,path);
    if(!was){await trash(target);restored++;continue;}
    await mkdir(dirname(target),{recursive:true});
    if(was.text!=null)await writeFile(target,was.text);else await copyFile(join(holdDir(root,id),...path.split('/')),target);
    restored++;
  }
  return {restored,missed:[]};
}
