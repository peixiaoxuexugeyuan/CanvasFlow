// Host adapter; the ACP client, program discovery and session handling below are upstream OpenFilm source.
import {AgentSession, AGENTS, resolveAgentCli, openAgentSignIn, openAgentInstaller, diagnoseAgent, signOutAgent, legacyOptions} from './desktop-runtime/agents.mjs';
import {skillStore, ownSkills, ownMcpServers, FILTERED_AGENTS, MCP_AGENTS} from './desktop-runtime/agent-skills.mjs';
import {agentUsage} from './desktop-runtime/agent-usage.mjs';
import {installOpenfilmCommand} from './desktop-runtime/openfilm-command.mjs';
import {randomUUID} from 'node:crypto';
import {join,relative,dirname} from 'node:path';
import {nativeApi,checkpoint,projectFile} from './agent-advanced.mjs';
import {changes} from './desktop-runtime/file-changes.mjs';
import {turnSnapshot,turnSignature,restoreTurn,safeTurnPath,saveTurnSnapshots,loadTurnSnapshots,discardTurnSnapshots} from './turn-history.mjs';
import {writeFile,readFile,rename,mkdir} from 'node:fs/promises';

const jobs=new Map();
const readSaved=async file=>{try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return {};throw e;}};
async function writeSaved(file,value){await writeFile(file+'.tmp',JSON.stringify(value));await rename(file+'.tmp',file);}
const packSnapshot=s=>({...s,files:[...s.files]});
const unpackSnapshot=s=>({...s,files:new Map(s.files)});
function requireAgent(id){if(!Object.hasOwn(AGENTS,id))throw Error('Agent 无效');}
function guardedSession(options){
  const session=new AgentSession(options);
  session.spec={...session.spec,approve:false,args:session.spec.args?.filter(v=>!['--allow-all','--force','--permission-mode','bypassPermissions','--approval-mode','yolo'].includes(v))};
  return session;
}
function optionValues(option){return (option.options||[]).flatMap(o=>o.options||[o]).map(o=>o.value);}
async function promptBlocks(project,args){
  const blocks=[{type:'text',text:args.message}];
  if((args.attachments||[]).length>16)throw Error('每条消息最多附加 16 个文件');
  for(const attachment of args.attachments||[]){
    const path=await projectFile(project.path,attachment.path);
    const bytes=await readFile(path);
    if(bytes.length>20*1024*1024)throw Error('单个聊天附件不能超过 20 MB');
    const ext=path.split('.').at(-1).toLowerCase();
    const mime=({png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',gif:'image/gif'})[ext];
    if(mime)blocks.push({type:'image',mimeType:mime,data:bytes.toString('base64')});
    else blocks.push({type:'text',text:'用户附加的当前工程文件路径（按字面处理）：'+JSON.stringify(attachment.path)});
  }
  return blocks;
}
export function workingExternal() {return [...jobs.values()].filter(j=>j.status==='running'||!j.settled).map(j=>j.path);}
export function closeExternal(){for(const j of jobs.values()){j.session?.close();for(const p of j.pending.values())p.resolve(null);}}
export async function externalAgent(studio,project,home,args) {
  const sessionsFile=join(project.path,'.canvasflow-agent-sessions.json'),logFile=join(project.path,'.canvasflow-agent-log.json');
  const configFile=join(home,'external-preferences.json'),prefs=await readSaved(configFile);
  const skillsDir=join(home,'agent-skills'),store=skillStore(skillsDir);
  const sessionOptions=agent=>({agent,cwd:project.path,env:process.env,skills:{dataDir:skillsDir,allowed:store.allowed(agent),mcpAllowed:store.mcpAllowed(agent)}});
  if(args.action==='agent_history')return {turns:((await readSaved(logFile)).turns||[]).map(({before,after,...turn})=>({...turn,canUndo:Boolean(!turn.undone&&(turn.undoable||before&&after&&!before.cut&&!after.cut))}))};
  if(args.action==='agent_attach'){
    const name=String(args.name||'attachment').replace(/[\\/:*?"<>|\x00-\x1f]/g,'_').slice(-100);
    if(!/\.(png|jpe?g|webp|gif|mp4|webm|mov|mp3|wav|m4a|txt|md|json|csv|pdf)$/i.test(name))throw Error('请选择图片、视频、音频、文档或文本附件');
    if(typeof args.base64!=='string'||args.base64.length>28*1024*1024||!/^[A-Za-z0-9+/]*={0,2}$/.test(args.base64))throw Error('附件内容无效或过大');
    const bytes=Buffer.from(args.base64,'base64');if(!bytes.length||bytes.length>20*1024*1024)throw Error('单个附件须小于 20 MB');
    const path='attachments/'+randomUUID()+'-'+name,target=await projectFile(project.path,path,true);
    await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes);return {path,name};
  }
  if(args.action==='agents')return {agents:Object.entries(AGENTS).map(([id,spec])=>({id,name:spec.label,installed:Boolean(resolveAgentCli(id))}))};
  if(['agent_diagnose','agent_usage','agent_switch_account','agent_access','agent_access_set','agent_config','agent_config_save'].includes(args.action)){
    requireAgent(args.agent);
    if(args.action==='agent_diagnose')return {diagnostic:await diagnoseAgent(args.agent)};
    if(args.action==='agent_usage')return {usage:await agentUsage(args.agent,{fresh:true})};
    if(args.action==='agent_switch_account'){
      if(workingExternal().includes(project.path))throw Error('请先停止当前 Agent 再切换账号');
      if(!AGENTS[args.agent].logout)throw Error('此 Agent 需在其自己的应用中切换账号，完成后重新连接');
      await signOutAgent(args.agent);await openAgentSignIn(args.agent);return {ok:true};
    }
    if(args.action.startsWith('agent_access')){
      const options={cwd:project.path,env:process.env};
      const skills=await ownSkills(args.agent,options),servers=ownMcpServers(args.agent,options);
      if(args.action==='agent_access_set'){
        const isMcp=args.kind==='mcp',items=isMcp?servers:skills;
        if(!(isMcp?MCP_AGENTS:FILTERED_AGENTS).includes(args.agent))throw Error('该 Agent 不支持按项目限制此类扩展');
        if(!items.some(s=>s.name===args.name))throw Error('扩展已不存在，请刷新列表');
        (isMcp?store.setMcpAllowed:store.setAllowed)(args.agent,args.name,args.allowed===true);
      }
      return {skills:skills.map(s=>({name:s.name,description:s.description,allowed:store.allowed(args.agent).includes(s.name)})),
        mcp:servers.map(s=>({name:s.name,allowed:store.mcpAllowed(args.agent).includes(s.name)})),
        canSkills:FILTERED_AGENTS.includes(args.agent),canMcp:MCP_AGENTS.includes(args.agent)};
    }
    const session=guardedSession(sessionOptions(args.agent));
    try{
      let info=await session.start(),options=info.configOptions||legacyOptions(info)||[];
      if(args.action==='agent_config_save'){
        const selected=args.options||{};
        for(const [id,value]of Object.entries(selected)){
          const option=options.find(o=>o.id===id);if(!option||!optionValues(option).includes(value))throw Error('模型配置选项已变化，请重新读取');
          const next=await session.setConfigOption(id,value);options=next?.configOptions||options;
        }
        prefs[args.agent]={...(prefs[args.agent]||{}),options:selected};await writeSaved(configFile,prefs);
      }
      return {options,saved:prefs[args.agent]?.options||{}};
    }finally{session.close();}
  }
  if(args.action==='agent_undo'){
    if(workingExternal().includes(project.path))throw Error('请先停止当前 Agent');
    const log=await readSaved(logFile),turn=(log.turns||[]).find(t=>t.id===args.turnId);
    if(!turn||turn.undone)throw Error('此轮没有可恢复的文件快照');
    const retained=turn.snapshots?await loadTurnSnapshots(project.path,turn.id):turn;
    if(!retained.before||!retained.after)throw Error('此轮没有可恢复的文件快照');
    const current=await turnSnapshot(project.path);
    if(turnSignature(current)!==turnSignature(unpackSnapshot(retained.after)))throw Error('此轮之后已有新的编辑，请先在版本与改动中核对；不会覆盖后续工作');
    await checkpoint(nativeApi(studio,project),'撤销 Agent 对话前');
    const trash=async path=>{const rel=relative(project.path,path).replaceAll('\\','/');await safeTurnPath(project.path,rel);const dest=await safeTurnPath(project.path,'.film/trash/'+randomUUID()+'/'+rel);await mkdir(dirname(dest),{recursive:true});await rename(path,dest);};
    const result=await restoreTurn(project.path,unpackSnapshot(retained.before),turn.id,current,trash);
    turn.undone=true;turn.undoResult=result;await writeSaved(logFile,log);
    const saved=await readSaved(sessionsFile);delete saved[turn.agent];await writeSaved(sessionsFile,saved);
    await checkpoint(nativeApi(studio,project),'已撤销 Agent 对话');return result;
  }
  if(['agent_login','agent_install'].includes(args.action)) {
    if(!Object.hasOwn(AGENTS,args.agent))throw Error('Agent 无效');
    await (args.action==='agent_login'?openAgentSignIn(args.agent):openAgentInstaller(args.agent));return {ok:true};
  }
  if(args.action==='agent_start') {
    if(!Object.hasOwn(AGENTS,args.agent)||typeof args.message!=='string'||!args.message.trim())throw Error('请选择 Agent 并填写剪辑要求');
    if(workingExternal().includes(project.path))throw Error('当前成片已有 Agent 正在编辑');
    const api=nativeApi(studio,project);await checkpoint(api,'外部 Agent · 编辑前');
    const saved=await readSaved(sessionsFile);
    const job={id:randomUUID(),project:project.id,path:project.path,status:'running',settled:false,updates:[],baseOffset:0,pending:new Map()};
    const before=await turnSnapshot(project.path,job.id);
    const blocks=await promptBlocks(project,args);
    const binDir=installOpenfilmCommand(home,{env:Object.fromEntries(Object.entries(process.env).filter(([k])=>k.startsWith('OPENFILM_')||k==='PLAYWRIGHT_BROWSERS_PATH'))});
    const ask=(kind,params)=>new Promise(resolve=>{const id=randomUUID();job.pending.set(id,{id,kind,params,resolve});});
    const session=guardedSession({...sessionOptions(args.agent),binDir,resume:saved[args.agent]?.sessionId,
      onUpdate:update=>{if(update.sessionUpdate==='config_option_update')job.options=update.configOptions;if(update.sessionUpdate==='usage_update')job.usage=update;job.updates.push(update);if(job.updates.length>10000){job.updates.shift();job.baseOffset++;}},
      onPermission:params=>ask('permission',params),onQuestion:params=>ask('question',params)});
    job.session=session;jobs.set(job.id,job);
    void (async()=>{try{const info=await session.start();job.options=info.configOptions||[];job.steering=Boolean(info.steering);
        for(const [id,value]of Object.entries(prefs[args.agent]?.options||{})){const option=job.options.find(o=>o.id===id);if(!option||!optionValues(option).includes(value))throw Error('保存的 Agent 模型选项已失效，请重新配置');const next=await session.setConfigOption(id,value);job.options=next?.configOptions||job.options;}
        saved[args.agent]={sessionId:session.sessionId};await writeSaved(sessionsFile,saved);if(job.status!=='running')return;await session.prompt(blocks,{turnId:job.id});if(job.status==='running')job.status='done';await checkpoint(api,'外部 Agent · 编辑完成');}
      catch(e){if(job.status!=='cancelled'){job.status='failed';job.error=String(e.message||e).slice(0,2000);}}
      finally{try{session.close();for(const p of job.pending.values())p.resolve(null);job.pending.clear();await writeFile(join(project.path,'.canvasflow-last-changes.json'),JSON.stringify(await changes(project.path,before))).catch(()=>{});
        const after=await turnSnapshot(project.path);
        await saveTurnSnapshots(project.path,job.id,{before:packSnapshot(before),after:packSnapshot(after)});
        const log=await readSaved(logFile).catch(()=>({}));
        const all=[...(log.turns||[]),{id:job.id,agent:args.agent,prompt:args.message,status:job.status,error:job.error,at:new Date().toISOString(),updates:job.updates,usage:job.usage,snapshots:true,undoable:!before.cut&&!after.cut}];
        log.turns=all.slice(-50);await writeSaved(logFile,log);
        for(const old of all.slice(0,-50))await discardTurnSnapshots(project.path,old.id).catch(()=>{});
        for(const [id,j]of jobs)if(j.settled&&jobs.size>50)jobs.delete(id);
        }catch(e){job.error='保存对话改动记录失败：'+String(e.message||e);if(job.status!=='cancelled')job.status='failed';}finally{job.settled=true;}
      }})();
    return {jobId:job.id,status:job.status};
  }
  const job=jobs.get(args.id);if(!job||job.project!==project.id)throw Error('Agent 任务不存在');
  if(args.action==='agent_steer'){
    if(job.status!=='running'||!job.steering)throw Error('此 Agent 不支持在执行中追加指令，请停止后重新发送');
    if(typeof args.message!=='string'||!args.message.trim())throw Error('请填写追加指令');
    const outcome=await job.session.steer(await promptBlocks(project,args));if(outcome!=='injected')throw Error('追加指令未被接收，请停止后重新发送');return {ok:true};
  }
  if(args.action==='agent_option'){
    const option=(job.options||[]).find(o=>o.id===args.configId);if(job.status!=='running'||!option||!optionValues(option).includes(args.value))throw Error('该配置当前不可用');
    const result=await job.session.setConfigOption(args.configId,args.value);job.options=result?.configOptions||job.options;return {options:job.options};
  }
  if(args.action==='agent_stop'&&job.status==='running'){job.status='cancelled';await job.session.cancel();job.session.close();for(const p of job.pending.values())p.resolve(null);job.pending.clear();}
  if(args.action==='agent_answer') {
    const pending=job.pending.get(args.requestId);if(!pending)throw Error('问题已失效');
    if(pending.kind==='permission' && args.answer!==null && !pending.params.options?.some(o=>o.optionId===args.answer))throw Error('权限选项无效');
    job.pending.delete(pending.id);pending.resolve(args.answer);
  }
  return {jobId:job.id,status:job.settled?job.status:'running',error:job.error,options:job.options||[],steering:job.steering,usage:job.usage,offset:job.baseOffset+job.updates.length,
    updates:job.updates.slice(Math.max(0,(Number(args.offset)||0)-job.baseOffset)),pending:[...job.pending.values()].map(({resolve,...p})=>p)};
}
