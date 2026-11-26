const fs = require('node:fs'), vm = require('node:vm');
const test = require('node:test'), assert = require('node:assert/strict');
const acorn = require('../tools/release/node_modules/acorn');
const source = fs.readFileSync('app.js', 'utf8'), functions = {};
function walk(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'FunctionDeclaration') functions[node.id.name] = source.slice(node.start, node.end);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') walk(value);
  }
}
walk(acorn.parse(source, {ecmaVersion:'latest'}));

test('character, script shot and emotion prompts retain long user content', () => {
  const long = '完整细节。'.repeat(3000) + '末尾标记';
  const scope = { dockPromptCues: () => [long], EMOTION_CALM: {name:'平静',cues:[]}, EMOTION_WHEEL: [] };
  vm.createContext(scope);
  vm.runInContext(['normalizeCharacter','scriptParseShots','emotionEntry','emotionPromptText'].map(key => functions[key]).join('\n'), scope);
  assert.equal(scope.normalizeCharacter({id:'role', value:long}).value, long);
  assert.equal(scope.scriptParseShots(JSON.stringify({shots:[{description:long,dialogue:long,lighting:long,cameraMove:long}]}))[0].description, long);
  assert.equal(scope.scriptParseShots(JSON.stringify({shots:[{description:long,dialogue:long}]}))[0].dialogue, long);
  assert.equal(scope.emotionPromptText('calm',1), '@表情：'+long);
});
function fixture() {
  const listeners = {}, input = {value:'',dataset:{},addEventListener:(event,fn)=>listeners[event]=fn};
  const body = {textContent:'Generated body'};
  const nodes = ['a','b'].map(id=>({dataset:{node:'prompt',nodeId:id},querySelector:()=>body,matches:()=>false}));
  let saves = 0, toolboxes = 0;
  const scope = {promptInput:input, state:{activeNodeId:'a',modelPrompt:'',isRestoring:false},
    $:selector=>selector==='#promptInput'?input:null, $$:()=>nodes,
    syncPresetDescVisibility(){},renderPromptHighlight(){},promptValueSyncing:false,
    scheduleSave(){saves++;},lastPromptEmpty:false,syncVideoGenModeState(){},
    scheduleDockQuote(){},dispatchPromptInput(bubbles){listeners.input?.({detail:{reflectOnly:!bubbles}});},setDockPresetMode(){},bindAudioDock(){},
    setModelJobState(){},setModelNodeVideo(){},PROMPT_TOKEN_PATTERN:/unused/,deleteWholeTokens(){},
    slashTargetNode:()=>nodes[0],openImageToolbox(){toolboxes++;}};
  vm.createContext(scope);
  vm.runInContext(['bindPromptInput','syncInspectorToNode','applyNodeVisualState','mediaNodePrompt','updateMediaMentionsAfterEdit'].map(key=>functions[key]).join('\n'),scope);
  scope.bindPromptInput();
  return {scope,input,nodes,body,listeners,saves:()=>saves,toolboxes:()=>toolboxes};
}
test('text instructions save separately, switch independently and clear without touching generated body',()=>{
  const f=fixture();
  f.input.value='Instruction A';f.listeners.input();
  assert.equal(f.nodes[0].dataset.textInstruction,'Instruction A');assert.equal(f.saves(),1);
  assert.equal(f.body.textContent,'Generated body');
  f.scope.state.activeNodeId='b';f.scope.syncInspectorToNode(f.nodes[1]);
  assert.equal(f.input.value,'');assert.equal(f.saves(),1);
  f.input.value='Instruction B';f.listeners.input();
  f.scope.state.activeNodeId='a';f.scope.syncInspectorToNode(f.nodes[0]);
  assert.equal(f.input.value,'Instruction A');assert.equal(f.saves(),2);
  f.input.value='';f.listeners.input();
  assert.equal(f.nodes[0].dataset.textInstruction,'');assert.equal(f.body.textContent,'Generated body');
  assert.equal(f.saves(),3);
});
test('snapshot restoration restores instruction and clears stale instructions in legacy snapshots',()=>{
  const f=fixture();
  f.scope.applyNodeVisualState(f.nodes[0],{textInstruction:'Saved instruction'});
  f.scope.syncInspectorToNode(f.nodes[0]);assert.equal(f.input.value,'Saved instruction');
  f.scope.applyNodeVisualState(f.nodes[0],{});f.scope.syncInspectorToNode(f.nodes[0]);
  assert.equal(f.input.value,'');assert.equal(f.body.textContent,'Generated body');
});
test('typing global video instructions schedules persistence',()=>{
  const f=fixture();f.scope.state.activeNodeId='missing';
  f.input.value='Global video instruction';f.listeners.input();
  assert.equal(f.scope.state.modelPrompt,'Global video instruction');assert.equal(f.saves(),1);
  f.listeners.input();assert.equal(f.saves(),1);
});

test('image and video prompts stay with their node, including explicit clears and an older shared video prompt',()=>{
  const f=fixture(), [img,vid]=f.nodes;
  img.dataset.node='image'; vid.dataset.node='output';
  f.scope.state.modelPrompt='旧项目提示词'; f.body.textContent='镜头图片.png';
  img.dataset.previewName=f.body.textContent;
  f.scope.syncInspectorToNode(img); assert.equal(f.input.value,'');
  const first='  AI生成图片 · 逐字输入\n第二行\n ';
  f.input.value=first; f.listeners.input(); assert.equal(img.dataset.mediaPrompt, first);
  assert.equal(f.body.textContent, '镜头图片.png');
  f.scope.state.activeNodeId='b'; f.scope.syncInspectorToNode(vid);
  assert.equal(f.input.value,'旧项目提示词'); assert.equal(vid.dataset.mediaPrompt,undefined);
  f.input.value=''; f.listeners.input();
  f.scope.state.activeNodeId='a'; f.scope.syncInspectorToNode(img); assert.equal(f.input.value,first);
  f.scope.state.activeNodeId='b'; f.scope.syncInspectorToNode(vid); assert.equal(f.input.value,'');
  assert.equal(f.scope.state.modelPrompt,'旧项目提示词'); assert.equal(f.saves(),2);
});

test('rich text retains the original plain-text paragraph and list breaks across a snapshot',()=>{
  const html='<p>第一段<br>次の行</p><ul><li>最后一节</li></ul>';
  const plain='第一段\n次の行\n\n最后一节';
  const body={firstElementChild:{},innerHTML:'',innerText:'',textContent:''};
  const node={dataset:{node:'prompt'},querySelector:()=>body};
  const scope={restoredPromptBodies:new WeakMap(),window:{CanvasFlowSafeHTML:{sanitize:value=>value}},syncPromptNodeTextState(){}};
  vm.createContext(scope);
  vm.runInContext(['applyNodeContent','textNodeText'].map(key=>functions[key]).join('\n'),scope);
  scope.applyNodeContent(node,{copy:plain,copyHtml:html});
  assert.equal(scope.textNodeText(node),plain);
  body.innerHTML='<p>Revised</p>'; body.innerText='Revised';
  assert.equal(scope.textNodeText(node),'Revised');
});

test('mention offsets follow edits in UTF-16 and a deleted mention no longer links to its original node',()=>{
  const f=fixture(), node=f.nodes[0];
  node.dataset.node='image';
  node.dataset.mediaPrompt='😀 图片 1 / 图片 2';
  const refs=[{start:3,end:7,nodeId:'n1',index:1,type:'image'}, {start:10,end:14,nodeId:'n2',index:2,type:'image'}];
  node.dataset.mediaPromptMentions=JSON.stringify(refs);
  f.input.value='前\n'+node.dataset.mediaPrompt; f.listeners.input();
  assert.deepEqual(JSON.parse(node.dataset.mediaPromptMentions),refs.map(ref=>({...ref,start:ref.start+2,end:ref.end+2})));
  f.input.value=f.input.value.replace('图片 1','海边'); f.listeners.input();
  assert.deepEqual(JSON.parse(node.dataset.mediaPromptMentions),[refs[1]]);
});
test('a script node uses its own editable prompt without altering the storyboard',()=>{
  const f=fixture(), node=f.nodes[0]; node.dataset.node='script'; node.dataset.scriptTheme='根据剧本和人物参考生成分镜脚本';
  node.dataset.shots='[{"id":"1"}]'; f.scope.syncInspectorToNode(node); assert.equal(f.input.value,node.dataset.scriptTheme);
  f.input.value='  更新\n'; f.listeners.input(); assert.equal(node.dataset.scriptTheme,'  更新\n');
  assert.equal(node.dataset.shots,'[{"id":"1"}]'); assert.equal(f.scope.state.modelPrompt,'');
});

 test('long instructions survive input, node switching and snapshot restoration',()=>{
  const f=fixture(), long='长提示词🌲'.repeat(1200);
  f.input.value=long;f.listeners.input();
  assert.equal(f.input.value,long);assert.equal(f.nodes[0].dataset.textInstruction,long);
  f.scope.state.activeNodeId='b';f.scope.syncInspectorToNode(f.nodes[1]);
  f.scope.applyNodeVisualState(f.nodes[0],{textInstruction:long});
  f.scope.state.activeNodeId='a';f.scope.syncInspectorToNode(f.nodes[0]);
  assert.equal(f.input.value,long);assert.equal(f.body.textContent,'Generated body');
});

test('pasting slashes preserves all text without opening toolbox',()=>{
 const f=fixture();
 for(const value of ['正/侧/背，35mm，f/2.8，https://example.com/a/b','/','粘贴多行\n正/侧/背']){
   f.input.value=value;f.listeners.input({inputType:'insertFromPaste',data:value});
   assert.equal(f.input.value,value);assert.equal(f.nodes[0].dataset.textInstruction,value);assert.equal(f.toolboxes(),0);
 }
});
test('only slash keystroke in empty prompt opens toolbox and prevents insertion',()=>{
 const f=fixture();let prevented=false;
 f.listeners.keydown({key:'/',preventDefault(){prevented=true;}});
 assert.equal(prevented,true);assert.equal(f.toolboxes(),1);assert.equal(f.input.value,'');
});
test('slash in existing text, IME and modified shortcuts stay ordinary editor input',()=>{
 const f=fixture();f.input.value='f';
 const event={key:'/',preventDefault(){throw Error('unexpected shortcut interception');}};
 f.listeners.keydown(event);f.input.value='';
 for(const modifier of ['isComposing','ctrlKey','metaKey','altKey'])f.listeners.keydown({...event,[modifier]:true});
 f.scope.promptValueSyncing=true;f.listeners.keydown(event);assert.equal(f.toolboxes(),0);
});
