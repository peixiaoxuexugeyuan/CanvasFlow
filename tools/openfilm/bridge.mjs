// CanvasFlow integration; OpenFilm remains a separately licensed, unmodified dependency.
import { startStudio } from 'openfilm/studio';
import { openProject, projectById } from './node_modules/openfilm/studio/server/projects.mjs';
import { importFile } from './node_modules/openfilm/studio/server/files.mjs';
import { readFile, writeFile, rename, mkdir, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createInterface } from 'node:readline';
import { createReadStream } from 'node:fs';
import {copyFile} from 'node:fs/promises';
import { prepareEditor } from './editor-adapter.mjs';
import { inspectFilm, editFilm, undoFilm } from './agent-edit.mjs';
import {advancedFilm, registeredFile, nativeApi, checkpoint, projectFile} from './agent-advanced.mjs';
import {externalAgent, workingExternal, closeExternal} from './external-agents.mjs';
import {pathToFileURL} from 'node:url';
import {refreshModels} from './canvasflow-provider.mjs';
import {changeSettings} from './node_modules/openfilm/studio/server/keys.mjs';
import {syncCanvas} from './canvas-sync.mjs';
import {snapshot,changes} from './desktop-runtime/file-changes.mjs';

const home = resolve(process.argv[2]);
const parent = Number(process.argv[3]);
const projectRoot = process.argv[4] ? resolve(process.argv[4]) : null;
const lockedProjectKey = process.argv[5] || '';
const mappingFile = join(home, 'canvas-links.json');
const reply = value => process.stdout.write(`CANVASFLOW_FILM ${JSON.stringify(value)}\n`);
let studio;
const active = new Set();
const callbacks=new Map();let callbackSeq=0;
globalThis.canvasflowHost=(method,args)=>new Promise((resolve,reject)=>{
  const id=String(++callbackSeq),timer=setTimeout(()=>{callbacks.delete(id);reject(Error('CanvasFlow 模型服务超时'));},600000);
  callbacks.set(id,{resolve,reject,timer});reply({callback:id,method,args});
});
let ending = false;
const stop = async () => {
  if (ending) return;
  ending = true;
  closeExternal();
  const forced = setTimeout(() => process.exit(0), 5000);
  forced.unref();
  await studio?.close();
  process.exit(0);
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
setInterval(() => { try { process.kill(parent, 0); } catch { void stop(); } }, 3000).unref();

async function linkedProject(key, title) {
  let mappings = {};
  try { mappings = JSON.parse(await readFile(mappingFile, 'utf8')); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const hash = createHash('sha256').update(String(key)).digest('hex').slice(0, 24);
  if (mappings[hash]) {
    const previous = await projectById(mappings[hash]).catch(() => null);
    if (previous && !previous.missing) return previous;
  }
  const name = String(title || '工作区成片').replace(/[\\/:*?"<>|\x00-\x1f]/g, '_').replace(/[. ]+$/g, '').slice(0, 70) || '成片';
  let folder = join(projectRoot || join(home, 'projects', hash), name);
  if (projectRoot) {
    const existing = await readdir(projectRoot, {withFileTypes:true}).catch(e=>{if(e.code==='ENOENT')return [];throw e;});
    const directories = existing.filter(entry=>entry.isDirectory()&&!entry.isSymbolicLink());
    if (directories.length === 1) folder = join(projectRoot, directories[0].name);
    else if (directories.length > 1) throw Error('当前画布有多个历史成片目录，请先核对，避免打开错误项目');
  }
  await mkdir(folder, {recursive: true});
  const project = await openProject(folder);
  mappings[hash] = project.id;
  await writeFile(mappingFile + '.tmp', JSON.stringify(mappings));
  await rename(mappingFile + '.tmp', mappingFile);
  return project;
}
async function run(message) {
  if (!['open', 'import', 'inspect', 'edit', 'undo','advanced','output','sync','archive_check'].includes(message.op)) throw new Error('不支持的成片操作');
  if (lockedProjectKey && message.projectKey !== lockedProjectKey) throw Error('成片请求与当前画布不一致');
  const project = await linkedProject(message.projectKey, message.projectName);
  if(message.op==='archive_check'){
    if(active.has(project.path)||workingExternal().includes(project.path)||callbacks.size)return {safe:false};
    const list=await advancedFilm(studio,project,{action:'exports'});
    return {safe:!list.exports.some(j=>['waiting','running','queued'].includes(j.status))};
  }
  if(message.op==='sync')return syncCanvas(studio,project,message);
  if(message.op==='advanced') {
    if(message.args?.action==='material_links'){
      try{return {links:JSON.parse(await readFile(join(project.path,'.canvasflow-materials.json'),'utf8'))};}
      catch(e){if(e.code==='ENOENT')return {links:{}};throw e;}
    }
    if(message.args?.action==='diff'){try{return {ok:true,...JSON.parse(await readFile(join(project.path,'.canvasflow-last-changes.json'),'utf8'))};}catch{return {ok:true,files:[]};}}
    if(message.args?.action==='layout_save') {
      const text=JSON.stringify(message.args.layout);if(text.length>30000)throw Error('布局无效');
      await writeFile(join(home,'editor-layout.json'),text);return {ok:true};
    }
    if(message.args?.action==='services')return {ok:true,models:await refreshModels()};
    if(message.args?.action==='voices')return {ok:true,...await globalThis.canvasflowHost('voices',{model:message.args.model})};
    if(message.args?.action==='agents' || message.args?.action?.startsWith('agent_'))return externalAgent(studio,project,home,message.args);
    active.add(project.path);
    const before=['write','edit','canvas_write','take'].includes(message.args?.action)?await snapshot(project.path,{canvas:true}):null;
    try {const result=await advancedFilm(studio,project,message.args);if(before)await writeFile(join(project.path,'.canvasflow-last-changes.json'),JSON.stringify(await changes(project.path,before)));return {ok:true,...result};}
    finally {active.delete(project.path);}
  }
  if(message.op==='output')return registeredFile(message.args?.token,project);
  if (message.op === 'inspect') return inspectFilm(project,message.args);
  if (message.op === 'edit') return editFilm(project,message.args);
  if (message.op === 'undo') return undoFilm(project,message.args);
  let imported = 0, updated=0; const conflicts=[];
  if (message.op === 'import') {
    let origins={};const originFile=join(project.path,'.canvasflow-materials.json');
    try{origins=JSON.parse(await readFile(originFile,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
    for (const file of message.files || []) {
      try {
        const name=String(file.name).replace(/[\\/:*?"<>|\x00-\x1f]/g,'_');
        const previous=origins[file.sourceId],sourceInfo=await stat(file.path);
        const fingerprint=sourceInfo.size+':'+sourceInfo.mtimeMs;
        let target=null;
        if(previous){try{target=await projectFile(project.path,previous.path);await stat(target);}catch{target=null;}}
        if(message.synchronize && previous?.fingerprint===fingerprint && target){
          origins[file.sourceId]={...previous,...file.metadata,sourceDeleted:false};continue;
        }
        const digest=createHash('sha256').update(await readFile(file.path)).digest('hex');let path;
        if(previous && target && previous.digest===digest)path=previous.path;
        else if(previous && target && previous.path.split('.').at(-1).toLowerCase()===name.split('.').at(-1).toLowerCase()){
          if(createHash('sha256').update(await readFile(target)).digest('hex')!==previous.digest)throw Error('成片内素材已被手动修改，请保留该版本后再同步');
          await checkpoint(nativeApi(studio,project),'同步工作区素材前');
          await copyFile(file.path,target+'.tmp');await rename(target+'.tmp',target);path=previous.path;updated++;
        }else{
          if(message.synchronize && previous)throw Error('素材格式已变化，请重新导入并替换时间轴片段');
          path=(await importFile(project.path,'assets/'+name,createReadStream(file.path))).path;
        }
        if(file.sourceId)origins[file.sourceId]={path,digest,name,fingerprint,sourceDeleted:false,...file.metadata};
        imported++;
      }catch(e){if(!message.synchronize)throw e;conflicts.push({id:file.sourceId,message:e.message});}
    }
    if(message.synchronize)for(const [id,item]of Object.entries(origins)){
      const row=(message.syncRows||[]).find(r=>r.id===id);item.sourceDeleted=!row||row.deleted===true;
      if(row)Object.assign(item,{name:row.name,category:row.category,rating:row.rating,favorite:row.favorite});
    }
    await writeFile(originFile+'.tmp',JSON.stringify(origins));await rename(originFile+'.tmp',originFile);
  }
  const to = `/projects/${encodeURIComponent(project.id)}`;
  if(message.op==='open')await refreshModels().catch(()=>{});
  return {url: `${studio.origin}/open?key=${studio.key}&to=${encodeURIComponent(to)}`,
    projectId: project.id, imported, updated, conflicts, engine: 'OpenFilm 0.3.2'};
}
try {
  const editorDir = await prepareEditor(home);
  const providerDir=join(home,'settings','providers','canvasflow');await mkdir(providerDir,{recursive:true});
  await writeFile(join(providerDir,'provider.mjs'),`export {default} from ${JSON.stringify(new URL('./canvasflow-provider.mjs',import.meta.url).href)};\n`);
  await changeSettings(s=>{for(const verb of ['image','video','tts','music','sfx','asr','translate'])if(!s.use[verb])s.use[verb]='canvasflow';return s;});
  studio = await startStudio({port: 0, stays: true, advertise: false, editorDir, working:()=>[...active,...workingExternal()],
    askAgent:async text=>(await globalThis.canvasflowHost('ask',{text})).text,openBrowser() {}});
  reply({ready: true});
  let work = Promise.resolve();
  const input = createInterface({input: process.stdin});
  input.on('line', line => {
    let message;try{message=JSON.parse(line);}catch{reply({error:'无效请求'});return;}
    if(message.callbackResult){const pending=callbacks.get(message.callbackResult);if(pending){clearTimeout(pending.timer);callbacks.delete(message.callbackResult);message.error?pending.reject(Error(message.error)):pending.resolve(message.result);}return;}
    work = work.then(async () => {
      try { reply(await run(message)); }
      catch (e) { reply({error: String(e.message || e).slice(0, 400)}); }
    });
  });
  input.on('close', () => { void work.finally(stop); });
} catch (e) {
  console.error(e);
  reply({error: 'OpenFilm 编辑器启动失败'});
  process.exitCode = 1;
}
