// CanvasFlow tool boundary. All timeline writes use OpenFilm's own edit engine.
import {readFile, writeFile, rename, realpath, stat} from 'node:fs/promises';
import {join, relative, isAbsolute} from 'node:path';
import {randomUUID} from 'node:crypto';
import {changeProjectFilm, settleProjectFilm} from './node_modules/openfilm/studio/server/film.mjs';
import {applyOps} from './node_modules/openfilm/studio/server/ops.mjs';
import {listFiles} from './node_modules/openfilm/studio/server/files.mjs';
import {probe} from './node_modules/openfilm/studio/server/derived.mjs';
import {readFilm} from './node_modules/openfilm/src/film-doc.mjs';

const number = (v, min, max, name) => {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw Error(`${name} 必须在 ${min}–${max} 之间`);
  return v;
};
const seconds = (v, name) => number(v, 0, 86400, name);
const index = v => { number(v, 0, 99, '轨道'); if (!Number.isInteger(v)) throw Error('轨道必须是整数'); return v; };
function clipIn(value, id) {
  for (const track of value.tracks) {
    const clip = track.clips.find(c => c.id === id);
    if (clip) { if (track.locked) throw Error('该片段所在轨道已锁定'); return clip; }
  }
  throw Error('片段不存在，请重新读取成片');
}
async function safeSource(root, source) {
  if (typeof source !== 'string' || !source.startsWith('assets/') || source.includes('\\') || /[:?#\x00-\x1f]/.test(source) || source.split('/').some(p => !p || p === '..' || p === '.')) throw Error('只能使用本成片 assets 内的媒体');
  if (!/\.(png|jpe?g|webp|gif|avif|bmp|mp4|webm|mov|mkv|mp3|wav|m4a|ogg|flac)$/i.test(source)) throw Error('不支持的素材格式');
  const base = await realpath(root), file = await realpath(join(root, source));
  const rel = relative(base, file);
  if (rel.startsWith('..') || isAbsolute(rel) || !(await stat(file)).isFile()) throw Error('素材不在当前成片内');
  return source;
}
function timePair(start, end) {
  seconds(start, '入点'); seconds(end, '出点');
  if (end <= start) throw Error('出点必须大于入点');
  return [start, end];
}
async function operations(root, value, actions) {
  if (!Array.isArray(actions) || !actions.length || actions.length > 50) throw Error('每批剪辑需要 1–50 个操作');
  const ops = [];
  for (const a of actions) {
    if (!a || typeof a !== 'object') throw Error('剪辑操作无效');
    let next;
    if (a.action === 'insert') {
      const source = await safeSource(root, a.source);
      const info = await probe(root,source);
      const end = a.end ?? info.duration ?? 3;
      if (info.duration && end > info.duration + .001) throw Error('出点超过素材时长');
      const clip = {src:source, id:`cf-${randomUUID()}`, time:timePair(a.start ?? 0, end)};
      next = {op:'insert',clip,at:seconds(a.at ?? 0,'位置')};
      if (a.track !== undefined) next.track = index(a.track);
      if (a.newTrack !== undefined) next.newTrack = index(a.newTrack);
      // A default insertion must not silently choose a locked track inside applyOps.
      if (a.track === undefined && a.newTrack === undefined) next.newTrack = value.tracks.length;
    } else if (a.action === 'stage') {
      next = {op:'stage',w:number(a.width,16,7680,'宽度'),h:number(a.height,16,7680,'高度')};
      if (!Number.isInteger(a.width) || !Number.isInteger(a.height)) throw Error('画幅尺寸必须为整数');
    } else {
      const c = clipIn(value, a.clipId);
      if (a.action === 'remove') next = {op:'remove',clip:c.id};
      else if (a.action === 'move') {
        next = {op:'move',clip:c.id,at:seconds(a.at,'位置')};
        if (a.track !== undefined) { next.track=index(a.track); if (value.tracks[a.track]?.locked) throw Error('目标轨道已锁定'); }
      } else if (a.action === 'trim') {
        const info = await probe(root,await safeSource(root,c.src));
        if (info.duration && a.end > info.duration + .001) throw Error('出点超过素材时长');
        next = {op:'set',clip:c.id,field:'time',value:timePair(a.start,a.end)};
      }
      else if (a.action === 'volume') next = {op:'set',clip:c.id,field:'volume',value:number(a.value,0,2,'音量')};
      else if (a.action === 'speed') next = {op:'set',clip:c.id,field:'speed',value:number(a.value,.1,10,'速度')};
      else if (a.action === 'fade') next = {op:'props',edits:[{clip:c.id,prop:'fade',value:[number(a.fadeIn ?? 0,0,30,'淡入'),number(a.fadeOut ?? 0,0,30,'淡出')]}]};
      else if (a.action === 'split') {
        const [start,end] = c.time || [];
        if (typeof start !== 'number' || typeof end !== 'number') throw Error('先裁剪并明确片段入点、出点，再分割');
        const at = seconds(a.at,'分割位置'), cut = start + (at-(c.at || 0))*(c.speed || 1);
        if (cut <= start || cut >= end) throw Error('分割点必须位于片段内部');
        next = {op:'split',clip:c.id,at,time:[start,cut],restTime:[cut,end],restId:`cf-${randomUUID()}`};
      } else throw Error('不支持的剪辑操作');
    }
    if (next.track !== undefined && value.tracks[next.track]?.locked) throw Error('目标轨道已锁定');
    applyOps(value, [next]); // validate later actions against earlier ones, without writing yet
    ops.push(next);
  }
  const checked = readFilm(value);
  if (!checked.doc) throw Error(checked.problems.join('\n'));
  return {value,ops};
}
export async function inspectFilm(project, args = {}) {
  const current = await settleProjectFilm(project.path);
  const all = (current.value?.tracks || []).flatMap((t,track) => t.clips.map(c => ({
    id:c.id,source:c.src,track,at:c.at || 0,time:c.time,speed:c.speed || 1,volume:c.volume ?? 1,locked:Boolean(t.locked),
  })));
  const offset = Number.isInteger(args.offset) ? Math.max(0,args.offset) : 0;
  const files = (await listFiles(project.path)).files.filter(f => ['image','video','audio'].includes(f.kind));
  const safe = [];
  for (const f of files.slice(offset,offset+20)) {
    try {
      await safeSource(project.path,f.path);
      const info = await probe(project.path,f.path).catch(() => ({}));
      safe.push({source:f.path,kind:f.kind,bytes:f.size,duration:info.duration,width:info.width,height:info.height,audio:info.audio});
    } catch { /* do not offer outside links */ }
  }
  return {ok:true,projectId:project.id,revision:current.rev,stage:current.value?.stage || {w:1920,h:1080},
    tracks:(current.value?.tracks || []).length,clips:all.slice(offset,offset+20),totalClips:all.length,
    assets:safe,totalAssets:files.length,offset,pageSize:20,problems:current.problems};
}
const historyPath = root => join(root,'.canvasflow-agent-undo.json');
async function history(root) {
  try { const rows = JSON.parse(await readFile(historyPath(root),'utf8')); return Array.isArray(rows) ? rows.slice(-10) : []; }
  catch (e) { if (e.code === 'ENOENT') return []; throw Error('剪辑撤销记录无法读取'); }
}
async function saveHistory(root, rows) {
  const file = historyPath(root), temp = `${file}.${randomUUID()}.tmp`;
  await writeFile(temp,JSON.stringify(rows)); await rename(temp,file);
}
export async function editFilm(project,args) {
  const current = await settleProjectFilm(project.path);
  if (!current.value && current.text.trim()) throw Error('成片文件暂时无法解析，请先修复文件；不会覆盖原有内容');
  if (!args.revision || args.revision !== current.rev) throw Error('成片已变化，请重新 read_film 后再剪辑');
  const made = await operations(project.path,structuredClone(current.value || {stage:{w:1920,h:1080},tracks:[]}),args.operations);
  const rows = await history(project.path);
  const done = await changeProjectFilm(project.path, (value,latest) => {
    if (latest.rev !== args.revision) throw Error('你或其他操作刚修改了成片，请重新读取后再剪辑');
    return {value:made.value};
  }, {ops:made.ops});
  // Store the exact prior document; undo refuses to overwrite subsequent human edits.
  let warning;
  try { await saveHistory(project.path,[...rows,{before:current.value || {stage:{w:1920,h:1080},tracks:[]},after:done.rev}].slice(-10)); }
  catch { warning='剪辑已保存，但撤销记录保存失败，请使用编辑器版本历史恢复'; }
  return {ok:true,revision:done.rev,changed:made.ops.length,...warning?{warning}:{}};
}
export async function undoFilm(project,args) {
  const rows = await history(project.path), last = rows.at(-1);
  if (!last) throw Error('没有可撤销的 Agent 剪辑');
  const checked = readFilm(last.before);
  if (!checked.doc) throw Error('撤销记录无效');
  const done = await changeProjectFilm(project.path, (value,current) => {
    if (current.rev !== last.after || current.rev !== args.revision) throw Error('成片已有后续修改，无法直接撤销；请重新读取并调整，或使用版本历史');
    return {value:last.before};
  }, {undo:true});
  rows.pop();
  if (rows.length) rows.at(-1).after = done.rev;
  let warning;
  try { await saveHistory(project.path,rows); }
  catch { warning='撤销已完成，但撤销记录保存失败；继续编辑前请重新读取成片'; }
  return {ok:true,revision:done.rev,changed:1,...warning?{warning}:{}};
}
