// Explicit, non-destructive sync: only nodes created by this link are updated; conflicts remain visible.
import {readFile,writeFile,rename,mkdir,copyFile} from 'node:fs/promises';
import {join,dirname,extname} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {nativeApi,checkpoint,projectFile} from './agent-advanced.mjs';
const hash=x=>createHash('sha256').update(x).digest('hex');
export async function syncCanvas(studio,project,message){
  const api=nativeApi(studio,project),file=join(project.path,'.canvasflow-sync.json');
  let previous={nodes:{},media:{}};try{previous=JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
  const canvas=await api('canvas'),nodes=new Map(canvas.nodes.map(n=>[n.id,n])),conflicts=[],textFiles=[];
  await checkpoint(api,'画布同步前');
  for(const media of message.files||[]){
    const id=String(media.id),data=await readFile(media.path),digest=hash(data);
    const dest=`assets/canvasflow/${hash(id).slice(0,20)}${extname(media.path).toLowerCase()}`;
    const prior=previous.media[id];
    if(prior && prior.path===dest){const current=await readFile(await projectFile(project.path,dest,true)).catch(()=>null);if(current && hash(current)!==prior.digest){conflicts.push(id);continue;}}
    const absolute=await projectFile(project.path,dest,true);await mkdir(dirname(absolute),{recursive:true});const tmp=absolute+'.'+randomUUID()+'.tmp';await writeFile(tmp,data);await rename(tmp,absolute);
    previous.media[id]={path:dest,digest};
  }
  for(const node of message.nodes||[]){
    const id='cf-'+hash(node.id).slice(0,24),old=previous.nodes[id],current=nodes.get(id);
    if(old && current && JSON.stringify(current)!==JSON.stringify(old.value)){conflicts.push(node.id);continue;}
    const text=String(node.text||'');
    let content=previous.media[node.id]?{path:previous.media[node.id].path}:{text};
    if(!previous.media[node.id] && text.length>20000){
      // Native note cards truncate at 20,000 characters. A file card retains every character instead.
      const path=`assets/canvasflow/text-${hash(node.id).slice(0,20)}.txt`;
      const absolute=await projectFile(project.path,path,true),existing=await readFile(absolute).catch(()=>null);
      if(existing && (!old?.textDigest || hash(existing)!==old.textDigest)){conflicts.push(node.id);continue;}
      await mkdir(dirname(absolute),{recursive:true});const tmp=absolute+'.'+randomUUID()+'.tmp';
      await writeFile(tmp,text,'utf8');await rename(tmp,absolute);
      content={path};textFiles.push(node.id);
    }
    const next={id,x:Number(node.x)||0,y:Number(node.y)||0,w:280,...content};
    nodes.set(id,next);previous.nodes[id]={sourceId:node.id,value:next};
    if(textFiles.includes(node.id))previous.nodes[id].textDigest=hash(Buffer.from(text));
  }
  const bySource=new Map(Object.entries(previous.nodes).map(([id,n])=>[n.sourceId,id]));
  const edges=canvas.edges.slice();
  for(const e of message.edges||[]){const from=bySource.get(e.source),to=bySource.get(e.target);if(from&&to&&!edges.some(old=>old.from===from&&old.to===to))edges.push({id:'cf-'+hash(from+'>'+to).slice(0,24),from,to});}
  await api('canvas','PUT',{...canvas,nodes:[...nodes.values()],edges});
  await writeFile(file+'.tmp',JSON.stringify(previous));await rename(file+'.tmp',file);
  return {ok:true,synced:Math.max(0,(message.nodes||[]).length-new Set(conflicts).size),conflicts:[...new Set(conflicts)],textFiles,media:previous.media,keptRemoved:true};
}
