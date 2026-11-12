import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,mkdir,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {setChosenPaths} from '../tools/openfilm/desktop-runtime/agents.mjs';
import {externalAgent,closeExternal} from '../tools/openfilm/external-agents.mjs';

test('upstream ACP session waits for permission, resumes, records replies and cancels without AI', {timeout:60000},async()=>{
  const home=await mkdtemp(join(tmpdir(),'cf-acp-fixture-'));
  const project={id:'fixture',path:join(home,'project')};await mkdir(project.path);
  const script=join(home,'fixture-agent.mjs');
  await writeFile(script,`import {createInterface} from 'node:readline';import {writeFileSync} from 'node:fs';
    let options=[{id:'model',category:'model',name:'Model',type:'select',currentValue:'small',options:[{value:'small',name:'Small'},{value:'large',name:'Large'}]}];
    const send=m=>process.stdout.write(JSON.stringify({jsonrpc:'2.0',...m})+'\\n');let prompt;
    createInterface({input:process.stdin}).on('line',line=>{const m=JSON.parse(line);
      if(m.method==='initialize')send({id:m.id,result:{protocolVersion:1,agentCapabilities:{loadSession:true,promptCapabilities:{image:true}},authMethods:[],_meta:{steering:{supported:true}}}});
      else if(m.method==='session/new'||m.method==='session/load')send({id:m.id,result:{sessionId:'fixture-session',configOptions:options}});
      else if(m.method==='session/set_config_option'){options=options.map(o=>o.id===m.params.configId?{...o,currentValue:m.params.value}:o);send({id:m.id,result:{configOptions:options}});}
      else if(m.method==='_session/steering')send({id:m.id,result:{outcome:'injected'}});
      else if(m.method==='session/prompt'){prompt=m;writeFileSync('received.json',JSON.stringify(m.params.prompt));send({method:'session/update',params:{sessionId:'fixture-session',update:{sessionUpdate:'tool_call',toolCallId:'edit',title:'Edit film',kind:'edit',status:'in_progress'}}});send({id:900,method:'session/request_permission',params:{sessionId:'fixture-session',toolCall:{toolCallId:'edit',title:'写入测试标题',kind:'edit',status:'pending'},options:[{optionId:'allow',name:'允许本次',kind:'allow_once'},{optionId:'deny',name:'拒绝',kind:'reject_once'}]}});}
      else if(m.id===900){writeFileSync('film.html','agent result');send({method:'session/update',params:{sessionId:'fixture-session',update:{sessionUpdate:'agent_message_chunk',content:{type:'text',text:'fixture reply'}}}});send({id:prompt.id,result:{stopReason:'end_turn'}});}
      else if(m.method==='session/cancel'&&prompt)send({id:prompt.id,result:{stopReason:'cancelled'}});
      else if(m.id!==undefined&&m.method)send({id:m.id,result:{}});
    });`);
  const server=createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end('{}');});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const studio={origin:'http://127.0.0.1:'+server.address().port,key:'fixture'};
  setChosenPaths({qwen:script});
  const call=args=>externalAgent(studio,project,home,args);
  async function until(id,condition){for(let i=0;i<150;i++){const result=await call({action:'agent_poll',id});if(condition(result))return result;await new Promise(r=>setTimeout(r,100));}throw Error('ACP fixture timed out');}
  try{
    await writeFile(join(project.path,'film.html'),'original');
    const config=await call({action:'agent_config',agent:'qwen'});assert.equal(config.options[0].id,'model');
    await call({action:'agent_config_save',agent:'qwen',options:{model:'large'}});
    await assert.rejects(call({action:'agent_config_save',agent:'qwen',options:{model:'missing'}}));
    const attachment=await call({action:'agent_attach',name:'reference.png',base64:Buffer.from('fixture image').toString('base64')});
    await assert.rejects(call({action:'agent_attach',name:'run.exe',base64:'YWJj'}));
    const first=await call({action:'agent_start',agent:'qwen',message:'Create a fixture title',attachments:[attachment]});
    const waiting=await until(first.jobId,r=>r.pending.length||r.status==='failed');assert.equal(waiting.status,'running',waiting.error);
    assert.equal(waiting.options[0].currentValue,'large');assert.equal(waiting.steering,true);
    await call({action:'agent_steer',id:first.jobId,message:'Keep the original ratio'});
    await call({action:'agent_option',id:first.jobId,configId:'model',value:'small'});
    assert.ok(JSON.parse(await readFile(join(project.path,'received.json'))).some(b=>b.type==='image'));
    assert.equal(waiting.pending[0].params.toolCall.title,'写入测试标题');
    await assert.rejects(call({action:'agent_answer',id:first.jobId,requestId:waiting.pending[0].id,answer:'invalid'}));
    await call({action:'agent_answer',id:first.jobId,requestId:waiting.pending[0].id,answer:'allow'});
    const done=await until(first.jobId,r=>r.status!=='running');assert.equal(done.status,'done',done.error);
    assert.ok(done.updates.some(u=>u.content?.text==='fixture reply'));
    for(let i=0;i<40;i++){if((await call({action:'agent_history'})).turns.length)break;await new Promise(r=>setTimeout(r,50));}
    assert.equal((await call({action:'agent_history'})).turns[0].prompt,'Create a fixture title');
    assert.equal(JSON.parse(await readFile(join(project.path,'.canvasflow-agent-sessions.json'))).qwen.sessionId,'fixture-session');
    const turn=(await call({action:'agent_history'})).turns[0];assert.equal(turn.canUndo,true);
    await writeFile(join(project.path,'film.html'),'later manual edit');
    await assert.rejects(call({action:'agent_undo',turnId:turn.id}),/后续工作/);
    await writeFile(join(project.path,'film.html'),'agent result');
    await call({action:'agent_undo',turnId:turn.id});assert.equal(await readFile(join(project.path,'film.html'),'utf8'),'original');
    const second=await call({action:'agent_start',agent:'qwen',message:'wait'});
    await until(second.jobId,r=>r.pending.length||r.status==='failed');
    await call({action:'agent_stop',id:second.jobId});
    assert.equal((await until(second.jobId,r=>r.status!=='running')).status,'cancelled');
    await assert.rejects(externalAgent(studio,{...project,id:'foreign'},home,{action:'agent_poll',id:first.jobId}));
  }finally{closeExternal();setChosenPaths({});await new Promise(r=>server.close(r));await new Promise(r=>setTimeout(r,300));await rm(home,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});
