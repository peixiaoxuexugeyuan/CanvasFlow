'use strict';
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const acorn = require('../tools/release/node_modules/acorn');
const source = fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
const tree = acorn.parse(source,{ecmaVersion:'latest'});
const functions = new Map();
(function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'FunctionDeclaration' && node.id) functions.set(node.id.name,source.slice(node.start,node.end));
  for (const value of Object.values(node)) {if (Array.isArray(value)) value.forEach(visit);else if (value && typeof value === 'object') visit(value);}
})(tree);
function context(names, extra={}) {
  const notices=[],views=[],calls=[];
  const state={projectId:'only',lastOpenedProjectId:'only',projectLoadPending:false,projectName:'Only',projectRevision:1,saveTimer:null,workspaceProjectCount:1};
  let cached={projectId:'only'};
  const scope={state,notices,views,calls,navigationEpoch:0,clearTimeout,URL,location:{href:'http://127.0.0.1:5173/?project=only'},history:{replaceState:(_a,_b,url)=>calls.push(['url',url])},window:{history:{}},
    $:()=>null,$$:()=>[],workspaceHeader:()=>({'X-Workspace-Id':'test-workspace'}),showToast:message=>notices.push(message),openView:view=>views.push(view),stopJobPolling:()=>calls.push(['stop']),
    projectSaveQueue:{discard:id=>calls.push(['discard',id])},safeStorage:{get:()=>cached,set:value=>{cached=value;}},promptInput:{value:'old'},
    resetCanvasNodes:()=>calls.push(['reset']),resetHistoryBaseline:()=>{},renderDockRefs:()=>{},syncInspectorToNode:()=>{},
    askConfirm:async()=>true,isStandaloneFile:()=>false,removeLocalProject:id=>calls.push(['removeLocal',id]),readLocalProjects:()=>[],renderProjects:list=>calls.push(['render',list.length]),
    api:async(route,options)=>{calls.push(['api',route,options?.method]);return options?.method==='DELETE'?{deleted:true}:{projects:[]};},
    crypto:require('node:crypto'), ...extra};
  scope.window.history=scope.history;
  vm.createContext(scope);
  vm.runInContext(names.map(name=>functions.get(name) || (()=>{throw Error(name);})()).join('\n'),scope);
  scope.cached=()=>cached;return scope;
}
const clearing=['clearCurrentProject','updateProjectUrl'];
test('deleting the last project clears its identity and cache, leaves zero projects, and never creates a replacement',async()=>{
  const env=context([...clearing,'deleteProject']);
  await env.deleteProject('only');
  assert.equal(env.state.projectId,'');assert.equal(env.state.lastOpenedProjectId,'');assert.equal(env.state.projectLoadPending,true);
  assert.equal(env.cached(),null);assert(env.calls.some(row=>row[0]==='discard'&&row[1]==='only'));
  assert(!env.calls.some(row=>row[0]==='api'&&row[2]==='POST'));
  assert(env.calls.some(row=>row[0]==='render'&&row[1]===0));assert(env.views.includes('projects'));
  assert(env.notices.some(text=>text.includes('请先新建项目')));
  assert(env.calls.some(row=>row[0]==='url'&&row[1]==='/'));
});
test('empty-project canvas navigation only shows a reminder and cannot expose canvas controls',()=>{
  const env=context(['requireCurrentProject','openCanvas'],{state:{projectId:'',projectLoadPending:true,workspaceProjectCount:0}});
  env.openCanvas();assert.deepEqual(env.views,['projects']);assert(env.notices[0].includes('请先新建项目'));
});
test('autosaving with no project cannot write caches or call the backend',()=>{
  const env=context(['saveProject'],{state:{projectId:'',projectLoadPending:false}});
  env.saveProject();assert.deepEqual(env.calls,[]);assert.equal(env.cached().projectId,'only');
});
test('opening a deleted deep link clears it instead of silently creating a project',()=>{
  const env=context([...clearing,'activateFallbackProject']);
  env.activateFallbackProject();assert.equal(env.state.projectId,'');assert(env.views.includes('projects'));
  assert(!env.calls.some(row=>row[0]==='api'));assert(env.notices[0].includes('已被删除'));
});
test('failed deletion leaves the current project usable and keeps its cache',async()=>{
  let resumed=false;
  const env=context([...clearing,'deleteProject'],{api:async()=>null,resumeJobBindings:()=>{resumed=true;}});
  await env.deleteProject('only');assert.equal(env.state.projectId,'only');assert.equal(env.state.projectLoadPending,false);
  assert.equal(env.cached().projectId,'only');assert(resumed);assert(!env.calls.some(row=>row[0]==='discard'));
});

function creationContext(extra={}) {
  return context([...clearing,'beginDraftCanvas','newProject','saveProject','loadProject'],{state:{projectId:'',projectLoadPending:true,projectCreationPending:false},
    remember:()=>{},defaultAdvancedSettings:()=>({}),defaultGenerationSettings:()=>({}),currentUser:()=>({id:'local',name:'Local',avatar:''}),
    graphSnapshot:()=>({nodes:[],edges:[]}),projectSaveQueue:{reset:()=>{},discard:()=>{}},
    updateNodeCount:()=>{},updateTransform:()=>{},resetGraphEdges:()=>{},refreshProjectBadge:()=>{},renderGroups:()=>{},
    openCanvas:()=>{},URLSearchParams,location:{search:'',href:'http://127.0.0.1:5173/'},...extra});
}
test('new empty canvas is editable without creating or caching a project',async()=>{
  const env=creationContext();await env.newProject();
  assert.match(env.state.projectId,/^project-/);assert.equal(env.state.projectIsDraft,true);
  assert.equal(env.state.projectLoadPending,false);assert.equal(env.state.projectCreationPending,false);
  assert.equal(env.saveProject(),true);assert(!env.calls.some(row=>row[0]==='api'));
  assert.equal(env.cached().projectId,'only');
  const previous=env.state.projectId;await env.newProject();assert.notEqual(env.state.projectId,previous);
  assert(!env.calls.some(row=>row[0]==='api'));
});
test('root startup always creates an empty draft instead of reopening a cached project',()=>{
  const env=creationContext();env.loadProject();
  assert.equal(env.state.projectIsDraft,true);assert.notEqual(env.state.projectId,'only');
  assert.equal(env.state.projectName,'未命名创作项目');assert.equal(env.state.zoom,1);
  assert(!env.calls.some(row=>row[0]==='api'));assert(!env.views.includes('projects'));
});

test('new canvas waits for the previous save and rejects double-clicks while it is pending',async()=>{
  let finish,saves=0;
  const env=creationContext({state:{projectId:'old',projectLoadPending:false}});
  env.saveProject=()=>{saves++;return new Promise(resolve=>{finish=resolve;});};
  const work=env.newProject();await env.newProject();assert.equal(saves,1);assert.equal(env.state.projectId,'old');
  finish(false);await work;assert.equal(env.state.projectId,'old');
  assert.equal(env.state.projectCreationPending,false);assert(env.notices.some(text=>text.includes('尚未保存成功')));
});

function workflowContext(){
  const env=context(['agentHubStartWorkflow','generationContext','generationContextActive'],{
    agentState:{running:false,pendingAsk:null},agentEls:{input:{value:''}},
    agentLeaveFilm:()=>{},agentAutoGrow:()=>{},agentRenderHighlight:()=>{},
    agentStartNewConversation:()=>{},agentToggle:()=>{},
    agentPrepareSkillTokens:async()=>{},
  });
  env.newProject=async()=>{env.calls.push('create');env.state.projectId='workflow';env.state.canvasEpoch=1;env.navigationEpoch++;return 'workflow';};
  env.saveProject=async()=>{assert.equal(env.state.draftPersistenceRequested,true);env.calls.push('save');return true;};
  env.agentSubmit=()=>{env.calls.push('send');env.agentState.running=true;};
  return env;
}

test('skill-only workflow persists its new empty canvas before automatically sending',async()=>{
  const env=workflowContext();
  assert.equal(await env.agentHubStartWorkflow('skill instructions',[],{title:'Film skill'}),true);
  assert.deepEqual(env.calls,['create','save','send']);
  assert.equal(env.state.projectName,'Film skill');assert.equal(env.agentEls.input.value,'skill instructions');
  assert.equal(env.agentState.hubStarting,false);
});

test('missing Skill documents prevent canvas creation and keep the existing draft',async()=>{
  const env=workflowContext();env.agentPrepareSkillTokens=async()=>{throw Error('Skill 文件读取失败');};
  assert.equal(await env.agentHubStartWorkflow('[[技能:libtv-example]]'),false);
  assert.deepEqual(env.calls,[]);assert.equal(env.state.projectId,'only');assert.equal(env.agentState.hubStarting,false);
});

test('navigation during lazy Skill loading cannot create a late workflow',async()=>{
  const env=workflowContext();let finish;env.agentPrepareSkillTokens=()=>new Promise(resolve=>{finish=resolve;});
  const work=env.agentHubStartWorkflow('[[技能:libtv-example]]');env.navigationEpoch++;finish();
  assert.equal(await work,false);assert.deepEqual(env.calls,[]);
});

test('creating a Skill persists a separate canvas and opens intake without sending a model request',async()=>{
  const env=workflowContext();
  env.agentStartCreateSkill=options=>{assert.equal(options.fresh,true);env.calls.push('intake');};
  assert.equal(await env.agentHubStartWorkflow('',[],{title:'创建 Skill',skillIntake:true}),true);
  assert.deepEqual(env.calls,['create','save','intake']);
  assert.equal(env.agentState.running,false);assert.equal(env.agentState.hubStarting,false);
});

test('double submission during workflow creation creates and sends only once',async()=>{
  const env=workflowContext();let finish,reached;const saving=new Promise(resolve=>{reached=resolve;});
  env.saveProject=()=>new Promise(resolve=>{finish=resolve;reached();});
  const first=env.agentHubStartWorkflow('first');await saving;
  assert.equal(await env.agentHubStartWorkflow('second'),false);
  finish(true);assert.equal(await first,true);
  assert.deepEqual(env.calls,['create','send']);assert.equal(env.agentEls.input.value,'first');
});

test('workflow cancelled by navigation, canvas replacement or workspace switch cannot send a late chat',async()=>{
  for(const change of [env=>env.navigationEpoch++,env=>env.state.canvasEpoch++,env=>{env.workspaceHeader=()=>({'X-Workspace-Id':'other'});}]){
    const env=workflowContext();let finish,reached;const saving=new Promise(resolve=>{reached=resolve;});env.saveProject=()=>new Promise(resolve=>{finish=resolve;reached();});
    const work=env.agentHubStartWorkflow('should not send');await saving;change(env);finish(true);
    assert.equal(await work,false);assert.deepEqual(env.calls,['create']);assert.equal(env.agentState.hubStarting,false);
  }
});

test('failed workflow save never sends and releases the startup lock',async()=>{
  const env=workflowContext();env.saveProject=async()=>false;
  assert.equal(await env.agentHubStartWorkflow('keep draft'),false);
  assert.deepEqual(env.calls,['create']);assert.equal(env.agentState.hubStarting,false);
  assert.ok(env.notices.some(text=>text.includes('新画布尚未保存成功')));
});

test('declined new canvas or an active Agent task prevents workflow launch',async()=>{
  const env=workflowContext();env.newProject=async()=>undefined;
  assert.equal(await env.agentHubStartWorkflow('keep draft'),false);assert.equal(env.state.projectId,'only');
  for(const flag of ['running','pendingAsk']){
    const busy=workflowContext();busy.agentState[flag]=true;
    assert.equal(await busy.agentHubStartWorkflow('keep draft'),false);assert.deepEqual(busy.calls,[]);
  }
});

test('deletion from the project list also removes a cached last project that is not currently open',()=>{
  let list;
  const env=context(['removeLocalProject'],{state:{projectId:'',projectLoadPending:true},localProjectsStorage:{set:value=>{list=value;}}});
  env.removeLocalProject('only');assert.equal(env.cached(),null);assert.equal(list.length,0);
});

function draftSavingContext(api, nodes=[{id:'first',type:'prompt',copy:'hello'}]) {
  const labels={saveStatus:{textContent:''},projectName:{textContent:'新建画布'}};
  const env=context(['sendProjectSnapshot','saveProject','updateProjectUrl'],{
    api,state:{projectId:'draft-uuid',projectName:'未命名创作项目',projectRevision:0,projectIsDraft:true,projectLoadPending:false,references:[]},
    currentUser:()=>({id:'local',name:'Local'}),graphSnapshot:()=>({nodes,edges:[],groups:[]}),
    $:selector=>labels[selector.slice(1)]||null,writeLocalProject:payload=>env.calls.push(['cache',payload.nodes.length]),
    refreshProjectBadge:()=>env.calls.push(['badge'])});
  env.Queue=require('../project-save-queue.js');
  const queueDefinition=source.slice(source.indexOf('    const createdDraftProjectIds'),source.indexOf('    function saveProject()'));
  vm.runInContext('window.CanvasFlowProjectSaveQueue=Queue;\n'+queueDefinition+'\nthis.projectSaveQueue=projectSaveQueue;',env);
  return {env,nodes,labels};
}

test('a conflicted canvas can reopen its own recoverable snapshot after a reload', async()=>{
  const store=new Map();
  const storage={
    get length(){return store.size;},key:i=>[...store.keys()][i],getItem:k=>store.get(k)||null,
    setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k),
  };
  const conflict=Object.assign(new Error('conflict'),{status:409});
  const {env,nodes}=draftSavingContext(async()=>{throw conflict;});
  env.localStorage=storage;
  env.state.projectIsDraft=false;
  env.state.jobBindings=[{jobId:'video-A',outputId:'clip'}];
  assert.equal(await env.saveProject(),false);
  nodes[0].copy='latest unsynced edit';await env.saveProject();
  const recoveredCalls=[];
  const fresh=draftSavingContext(async(_path,options)=>{
    const body=JSON.parse(options.body);recoveredCalls.push(body);
    return {project:{id:body.id}};
  }).env;
  fresh.localStorage=storage;fresh.openProject=async id=>recoveredCalls.push(id);
  const [[key,copy]]=fresh.currentRecoveryCopies();
  assert.equal(copy.nodes[0].copy,'latest unsynced edit');
  assert.equal(copy.jobBindings[0].jobId,'video-A');
  assert.equal(copy.shared,false);
  assert.notEqual(copy.id,env.state.projectId);
  fresh.workspaceHeader=()=>({'X-Workspace-Id':'other-workspace'});
  assert.equal(fresh.currentRecoveryCopies().length,0);
  fresh.workspaceHeader=env.workspaceHeader;
  await fresh.restoreConflictCopy(key,copy,{disabled:false});
  assert.equal(recoveredCalls[0].restoreConflictCopy,true);
  assert.equal(recoveredCalls[1],copy.id);
  assert.equal(fresh.currentRecoveryCopies().length,0);
});

test('first node creates a project once, queued edits use its accepted revision, and later empty state remains saved',async()=>{
  let release;const requests=[];
  const {env,nodes}=draftSavingContext(async(route,options={})=>{
    const body=options.body?JSON.parse(options.body):null;requests.push({route,method:options.method||'GET',body});
    if(!options.method)throw Object.assign(Error('missing'),{status:404});
    if(options.method==='POST')return new Promise(resolve=>{release=()=>resolve({project:{id:'draft-uuid',revision:1}});});
    return {project:{id:'draft-uuid',revision:body.revision+1}};
  });
  const first=env.saveProject();await new Promise(resolve=>setImmediate(resolve));
  nodes[0].copy='latest';const second=env.saveProject();release();await Promise.all([first,second]);
  assert.equal(requests.filter(r=>r.method==='POST').length,1);assert.equal(requests.at(-1).method,'PUT');
  assert.equal(requests.at(-1).body.revision,1);assert.equal(requests.at(-1).body.nodes[0].copy,'latest');
  assert.equal(env.state.projectIsDraft,false);assert.equal(env.state.projectRevision,2);
  nodes.length=0;await env.saveProject();assert.equal(requests.at(-1).body.nodes.length,0);
  assert(env.calls.some(row=>row[0]==='badge'));assert.equal(requests.at(-1).body.createDraft,undefined);
});

test('clearing the first node during creation queues the empty graph instead of restoring a deleted node',async()=>{
  let release;const writes=[];
  const {env,nodes}=draftSavingContext(async(route,options={})=>{
    if(!options.method)throw Object.assign(Error('missing'),{status:404});
    const body=JSON.parse(options.body);writes.push(body);
    if(options.method==='POST')return new Promise(resolve=>{release=()=>resolve({project:{id:'draft-uuid',revision:1}});});
    return {project:{id:'draft-uuid',revision:2}};
  });
  const first=env.saveProject();await new Promise(resolve=>setImmediate(resolve));nodes.length=0;
  const cleared=env.saveProject();release();await Promise.all([first,cleared]);
  assert.equal(writes.length,2);assert.equal(writes[1].nodes.length,0);assert.equal(writes[1].revision,1);
});

test('retry after a lost create response reuses the existing project rather than posting a duplicate',async()=>{
  let exists=false;const methods=[];
  const {env}=draftSavingContext(async(route,options={})=>{
    const method=options.method||'GET';methods.push(method);
    if(method==='GET'){if(exists)return {project:{id:'draft-uuid',revision:1}};throw Object.assign(Error('missing'),{status:404});}
    if(method==='POST'){exists=true;throw Error('response lost');}
    return {project:{id:'draft-uuid',revision:2}};
  });
  assert.equal(await env.saveProject(),false);assert.equal(env.state.projectIsDraft,true);
  assert.equal(await env.saveProject(),true);assert.equal(env.state.projectIsDraft,false);
  assert.deepEqual(methods,['GET','POST','GET','PUT']);
});

test('coalesced saves can restore the last acknowledged references while a different selection is in flight', async()=>{
  let release;
  const writes=[];
  let storedRefs;
  const {env,nodes}=draftSavingContext(async(_route,options)=>{
    const body=JSON.parse(options.body);
    writes.push(body);
    if (writes.length===2) await new Promise(resolve=>{release=resolve;});
    if (body.references) storedRefs=body.references;
    return {project:{id:'draft-uuid',revision:body.revision+1}};
  });
  env.state.projectIsDraft=false;
  env.state.references=[{id:'first'}];
  assert.equal(await env.saveProject(),true);
  env.state.references=[{id:'second'}];
  const inFlight=env.saveProject();
  env.state.references=[];
  const removed=env.saveProject();
  env.state.references=[{id:'first'}];
  const restored=env.saveProject();
  release();
  assert.deepEqual(await Promise.all([inFlight,removed,restored]),[true,true,true]);
  assert.equal(writes.length,3);
  assert.deepEqual(storedRefs,[{id:'first'}]);
  nodes[0].copy='only text changed';
  await env.saveProject();
  assert.equal('references' in writes.at(-1),false);
});

test('offline save reports storage failure, retains the draft, and can persist it on retry',()=>{
  const {env,labels}=draftSavingContext(()=>{throw Error('unexpected API call');});
  const storage=new Map([['canvasflow-projects','[]']]);
  let quotaExceeded=true;
  env.localStorage={
    getItem:key=>storage.get(key)??null,
    setItem:(key,value)=>{
      if (quotaExceeded && key==='canvasflow-projects') throw Error('QuotaExceededError');
      storage.set(key,value);
    },
  };
  env.isStandaloneFile=()=>true;
  env.updateProjectBadge=count=>env.calls.push(['badge',count]);
  vm.runInContext(source.slice(source.indexOf('    const localProjectsStorage'),source.indexOf('    const sidebarStorage'))
    + ['readLocalProjects','writeLocalProject','findLocalProject'].map(name=>functions.get(name)).join('\n'),env);
  assert.equal(env.saveProject(),false);
  assert.match(labels.saveStatus.textContent,/本机保存失败/);
  assert.equal(env.state.projectIsDraft,true);
  assert.equal(env.cached().projectId,'only');
  assert.equal(env.findLocalProject('draft-uuid'),null);
  assert.equal(env.calls.length,0);
  quotaExceeded=false;
  assert.equal(env.saveProject(),true);
  assert.equal(env.state.projectIsDraft,false);
  assert.equal(env.findLocalProject('draft-uuid').nodes[0].copy,'hello');
  assert.match(labels.saveStatus.textContent,/已保存到本机/);
});
