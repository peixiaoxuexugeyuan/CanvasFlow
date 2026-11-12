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
    scheduleDockQuote(){},dispatchPromptInput(){listeners.input?.();},setDockPresetMode(){},bindAudioDock(){},
    setModelJobState(){},setModelNodeVideo(){},PROMPT_TOKEN_PATTERN:/unused/,deleteWholeTokens(){},
    slashTargetNode:()=>nodes[0],openImageToolbox(){toolboxes++;}};
  vm.createContext(scope);
  vm.runInContext(['bindPromptInput','syncInspectorToNode','applyNodeVisualState'].map(key=>functions[key]).join('\n'),scope);
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
