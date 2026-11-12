// CanvasFlow boundary around OpenFilm 0.3.2's native authoring, inspection and export APIs.
import {readFile, writeFile, mkdir, rename, realpath, stat} from 'node:fs/promises';
import {join, dirname, relative, isAbsolute, extname, basename} from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {look} from './node_modules/openfilm/src/look.mjs';
import {coreSkills, usableSkills, skillText} from './node_modules/openfilm/src/skills.mjs';
import {settleProjectFilm, changeProjectFilm} from './node_modules/openfilm/studio/server/film.mjs';
import {applyOps} from './node_modules/openfilm/studio/server/ops.mjs';
import {readFilm} from './node_modules/openfilm/src/film-doc.mjs';
import {filesWritten} from './node_modules/openfilm/studio/server/person-edits.mjs';
import {libraryIndex} from './node_modules/openfilm/studio/server/library.mjs';
import {runGet} from './node_modules/openfilm/studio/server/get.mjs';
import {freshProviders} from './node_modules/openfilm/studio/server/providers/index.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const TEXT = /\.(html?|css|js|json|svg|vtt|srt|txt|md)$/i;
export async function projectFile(root, path, missing = false) {
  if (typeof path !== 'string' || path.length > 300 || /[\\:\x00-\x1f?#]/.test(path) || path.split('/').some(p => !p || p === '.' || p.startsWith('.'))) throw Error('需要当前成片内的相对文件路径');
  const base = await realpath(root), target = join(base,path);
  let check = target;
  while (true) {
    try { check = await realpath(check); break; }
    catch (e) { if (!missing || e.code !== 'ENOENT' || dirname(check) === check) throw e; check = dirname(check); }
  }
  const rel = relative(base,check);
  if (rel.startsWith('..') || isAbsolute(rel)) throw Error('文件不属于当前成片');
  return target;
}
export function nativeApi(studio, project) {
  return async (path, method='GET', body, global=false) => {
    const url = `${studio.origin}/api/${global ? '' : `projects/${encodeURIComponent(project.id)}/`}${path}`;
    const res = await fetch(url,{method,headers:{'x-studio-key':studio.key,'content-type':'application/json'},body:body === undefined ? undefined : JSON.stringify(body),signal:AbortSignal.timeout(300000)});
    const data = await res.json();
    if (!res.ok) throw Error(String(data.message || data.error || `OpenFilm ${res.status}`));
    return data;
  };
}
export async function checkpoint(api,message) {
  try{return await api('history/save','POST',{message});}
  catch(e){if(/nothing changed since the version checked out/i.test(e.message))return {unchanged:true};throw e;}
}
const publicJob = j => ({id:j.id,kind:j.kind,status:j.status,phase:j.phase,progress:j.progress,error:j.error,files:(j.outputs || []).map(p=>basename(p))});
const registrations = new Map();
export async function registeredFile(token, project) {
  const row = registrations.get(token);
  if (!row || row.project !== project.id) throw Error('成片输出已过期，请重新获取');
  const file = await realpath(row.file);
  if (!(await stat(file)).isFile()) throw Error('输出文件不存在');
  return {...row,file};
}
function register(project,file) { const token=randomUUID(); registrations.set(token,{project:project.id,file}); if(registrations.size>500)registrations.delete(registrations.keys().next().value); return token; }
export async function advancedFilm(studio, project, args={}) {
  const api=nativeApi(studio,project), action=args.action;
  if(action==='files') return {files:(await api('files')).files.map(f=>({path:f.path,kind:f.kind,size:f.size}))};
  if(action==='read' || action==='write') {
    if(!TEXT.test(args.path || '')) throw Error('只能读写成片的网页、字幕、样式和文本文件');
    const file=await projectFile(project.path,args.path,true);
    const before=await readFile(file).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
    if(before?.length>1024*1024) throw Error('文件超过单次读取限制');
    const revision=before===null?null:digest(before);
    if(action==='read')return {path:args.path,revision,text:before?.toString('utf8') ?? null};
    if(args.revision!==revision)throw Error('文件已变化，请重新读取；新文件 revision 必须为 null');
    if(typeof args.text!=='string' || Buffer.byteLength(args.text)>1024*1024)throw Error('请提供不超过 1 MB 的文件文本');
    // Native history captures all files before a replacement, not just the timeline.
    await checkpoint(api,'CanvasFlow Agent · 写入前');
    const latest=await readFile(file).catch(e=>{if(e.code==='ENOENT')return null;throw e;});
    if((latest===null?null:digest(latest))!==revision)throw Error('文件刚被修改，请重新读取');
    await mkdir(dirname(file),{recursive:true});
    const tmp=`${file}.${randomUUID()}.tmp`;
    await writeFile(tmp,args.text); await rename(tmp,file);
    filesWritten(project.path,{[args.path]:before},{[args.path]:Buffer.from(args.text)});
    await checkpoint(api,`CanvasFlow Agent · ${args.path}`);
    return {path:args.path,revision:digest(args.text),bytes:Buffer.byteLength(args.text)};
  }
  if(action==='edit') {
    const current=await settleProjectFilm(project.path);
    if(args.revision!==current.rev || !current.value)throw Error('请先读取有效成片的最新 revision');
    if(!Array.isArray(args.ops)||!args.ops.length||args.ops.length>100)throw Error('需要 1–100 个 OpenFilm 编辑操作');
    const value=structuredClone(current.value);
    for(const op of args.ops) {
      if(!['set','move','insert','remove','split','props','stage','fields','track','reorder','captions','uncaptions','keyframes'].includes(op.op))throw Error('编辑操作不支持');
      // Respect locked tracks; explicit unlocking remains available to a user-requested edit.
      const ids=[typeof op.clip==='string'?op.clip:null,...(op.edits||[]).map(e=>e.clip)].filter(Boolean);
      for(const t of value.tracks)if(t.locked && t.clips.some(c=>ids.includes(c.id)))throw Error('目标片段的轨道已锁定');
      if(Number.isInteger(op.track) && value.tracks[op.track]?.locked && op.op!=='track')throw Error('目标轨道已锁定');
      applyOps(value,[op]);
    }
    for(const t of value.tracks) {
      if(t.captions?.src)await projectFile(project.path,t.captions.src);
      for(const c of t.clips) await projectFile(project.path,c.src);
    }
    const parsed=readFilm(value);if(!parsed.doc)throw Error(parsed.problems.join('\n'));
    await checkpoint(api,'CanvasFlow Agent · 编辑前');
    const done=await changeProjectFilm(project.path,(_,latest)=>{if(latest.rev!==args.revision)throw Error('成片已变化，请重新读取');return {value};},{ops:args.ops});
    return {revision:done.rev,changed:args.ops.length};
  }
  if(action==='document') {const c=await settleProjectFilm(project.path);return {revision:c.rev,film:c.value,problems:c.problems};}
  if(action==='look') {
    const path=args.path||'film.html';await projectFile(project.path,path);
    const at=String(args.at ?? '0');if(!/^\d+(?:\.\d+)?(?:-\d+(?:\.\d+)?)?$/.test(at))throw Error('抽帧时间应为秒数或起止范围，如 0-3');
    const result=await look([join(project.path,path),at],{root:project.path,count:Math.min(8,Math.max(1,Number(args.count)||4)),offline:true});
    const pictures=[];
    for(const file of (result.files||[]).slice(0,4)) {
      const raw=await readFile(file); if(raw.length<=12*1024*1024)pictures.push({token:register(project,file),name:basename(file),mime:'image/png',base64:raw.toString('base64')});
    }
    return {ok:result.ok,checks:result.lines,pictures};
  }
  if(action==='history')return api('history?limit=30');
  if(action==='version') {
    if(!['save','checkout','film'].includes(args.operation))throw Error('版本操作无效');
    if(args.operation==='save')return checkpoint(api,String(args.message||'CanvasFlow 版本').slice(0,200));
    if(args.operation!=='save' && !/^[a-f0-9]{6,64}$/i.test(args.commit||''))throw Error('请从历史列表选择版本');
    return api(`history/${args.operation}`,'POST',{commit:args.commit,message:String(args.message||'CanvasFlow 版本').slice(0,200),discard:false});
  }
  if(action==='changes') {
    if(!/^[a-f0-9]{6,64}$/i.test(args.commit||''))throw Error('请选择版本');
    return api(`history/versions/${args.commit}`);
  }
  if(action==='skills')return {skills:[...coreSkills(),...usableSkills({project:project.path})].map(s=>({uid:s.uid,name:s.name,description:s.description}))};
  if(action==='skill_catalog')return api(`skills?project=${encodeURIComponent(project.id)}`,'GET',undefined,true);
  if(action==='skill_install') {
    const catalog=await api(`skills?project=${encodeURIComponent(project.id)}`,'GET',undefined,true);
    if(!catalog.skills.some(s=>s.uid===args.uid))throw Error('请选择技能目录中的条目');
    return api(`skills/${encodeURIComponent(args.uid)}/installed`,'PUT',{installed:true},true);
  }
  if(action==='skill') {
    const skill=[...coreSkills(),...usableSkills({project:project.path})].find(s=>s.uid===args.uid||s.name===args.uid);
    if(!skill)throw Error('技能未安装或已停用');return {uid:skill.uid,text:skillText(skill)};
  }
  if(action==='library') {
    const index=libraryIndex();const q=String(args.query||'').toLowerCase();
    const items=(index.items||[]).filter(i=>(!args.kind||i.kind===args.kind)&&JSON.stringify(i).toLowerCase().includes(q));
    const offset=Math.max(0,Number(args.offset)||0);return {groups:index.groups,total:items.length,items:items.slice(offset,offset+30)};
  }
  if(action==='take') {
    const item=(libraryIndex().items||[]).find(i=>i.id===args.id);if(!item)throw Error('请从资源库选择有效条目');
    await api('library/fetch','POST',{id:item.id},true);
    if(item.kind==='fade')return {transition:item,description:'该条目是原生叠化预设；通过片段 fade/motion 属性应用，或在编辑器拖到切点'};
    return api('saved/take','POST',{path:`openfilm/${item.file||item.path||item.id}`});
  }
  if(action==='generate') {
    if(!['image','video','tts','music','sfx','asr'].includes(args.verb))throw Error('生成类型无效');
    await freshProviders();
    return runGet(project.path,args.verb,args.options||{},{via:'canvasflow',model:args.model,yes:true});
  }
  if(action==='translate')return api('subtitles/translate','POST',{language:args.language});
  if(action==='transcribe')return api('subtitles/transcribe','POST',{srcs:args.srcs});
  if(action==='captions')return api('captions');
  if(action==='subtitle_style')return args.style ? api('subtitles','PUT',{style:args.style}) : api('subtitles');
  if(action==='caption_line')return api('captions/line','PUT',args.line);
  if(action==='canvas')return api('canvas');
  if(action==='canvas_write') {
    const before=await api('canvas');if(args.revision!==digest(JSON.stringify(before)))throw Error('原生画布已改变，请先重新读取并合并');
    for(const n of args.canvas?.nodes||[])if(n.path)await projectFile(project.path,n.path);
    return api('canvas','PUT',args.canvas);
  }
  if(action==='canvas_read') {const canvas=await api('canvas');let links={};try{const saved=JSON.parse(await readFile(join(project.path,'.canvasflow-sync.json'),'utf8'));links=Object.fromEntries(Object.entries(saved.nodes||{}).map(([id,n])=>[id,n.sourceId]));}catch{}return {canvas,links,revision:digest(JSON.stringify(canvas))};}
  if(action==='exports') {const all=await api('exports');return {can:all.can,drafts:all.drafts,exports:all.exports.map(publicJob)};}
  if(action==='export') {
    const settings=structuredClone(args.settings||{});
    if(!['video','gif','audio','stills','poster','subtitles','slides','nle','project'].includes(settings.kind))throw Error('请指定导出类型');
    if(settings.folder||settings.jobs)throw Error('导出只能保存到当前工作区的成片输出目录');
    settings.name=String(settings.name||'CanvasFlow').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(0,80);
    const result=await api('exports','POST',settings);return {export:publicJob(result.export)};
  }
  if(action==='cancel_export') {
    const all=await api('exports');if(!all.exports.some(j=>j.id===args.id))throw Error('导出任务不存在');
    return api(`exports/${encodeURIComponent(args.id)}`,'DELETE');
  }
  if(action==='outputs') {
    const all=await api('exports'), job=all.exports.find(j=>j.id===args.id);
    if(!job || job.status!=='done')throw Error(`导出尚未完成：${job?.status||'不存在'}`);
    const files=[];for(const file of job.outputs||[])if((await stat(file)).isFile())files.push({name:basename(file),token:register(project,file)});
    return {files};
  }
  if(action==='asset_output') {const file=await projectFile(project.path,args.path);return {files:[{name:basename(file),token:register(project,file)}]};}
  throw Error('未识别的成片能力');
}
