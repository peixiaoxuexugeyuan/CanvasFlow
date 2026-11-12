const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const acorn=require('../tools/release/node_modules/acorn'),source=fs.readFileSync('settings.js','utf8'),parts={};
function walk(n){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration')parts[n.id.name]=source.slice(n.start,n.end);for(const v of Object.values(n))if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}
walk(acorn.parse(source,{ecmaVersion:'latest'}));
function scope(extra={}){const s={...extra};vm.createContext(s);vm.runInContext(['platformTypeToKind','candidateKind','inferModelKind','wizardCandidates','wizardModelMatches','selectedWizardModels','applyWizardModelFilters','saveWizard','filteredRemoteCandidates','remoteCandidateTargets','addAllCandidates'].map(k=>parts[k]).join('\n'),s);return s;}
test('remote declared types and usages survive wizard parsing; Midjourney aliases infer image',()=>{
 const s=scope(),rows=s.wizardCandidates([{id:'opaque-image',type:'audio'},{id:'opaque',usages:['video']},{id:'mj_imagine'},'mj-imagine',{id:'banana-pro'},null]);
 assert.deepEqual(Array.from(rows,r=>r.type),['tts','video','t2i','t2i','t2i']);
 assert.ok(rows.every(r=>r.enabled===false));
 assert.equal(s.inferModelKind('deepseek-v4.1-flash'),'i2t');
 assert.equal(s.inferModelKind('wan2.7-image'),'t2i');
 assert.equal(s.inferModelKind('mj_imagine-video'),'video');
 assert.equal(s.inferModelKind('MiniMax-H3'),'video');
 assert.equal(s.inferModelKind('MiniMax-H3-Max'),'video');
 assert.equal(s.inferModelKind('MiniMax-M2.5'),'i2t');
});
test('combined case insensitive name and type filters preserve stable row identity and hidden selections',()=>{
 const models=[{model:'mj_imagine',type:'t2i',enabled:true},{model:'speech-2.8',type:'tts',enabled:true},{model:'suno-v6',type:'tts',enabled:false}];
 const elements=models.map((_,i)=>({dataset:{wizardRow:String(i)},hidden:false})),count={},empty={};
 const s=scope({wizard:{models,modelFilter:'tts',modelSearch:'SPEECH'},document:{querySelectorAll:()=>elements},$id:id=>id==='wizardModelCount'?count:empty});
 s.applyWizardModelFilters();assert.deepEqual(elements.map(e=>e.hidden),[true,false,true]);
 assert.equal(count.textContent,'显示 1 / 3 个 · 已选 2 个');assert.equal(empty.hidden,true);
 assert.deepEqual(Array.from(s.selectedWizardModels(models),r=>r.model),['mj_imagine','speech-2.8']);
 s.wizard.modelSearch='no match';s.applyWizardModelFilters();assert.equal(empty.hidden,false);
 s.wizard.modelFilter='all';s.wizard.modelSearch='';s.applyWizardModelFilters();assert.ok(elements.every(e=>!e.hidden));assert.ok(models[0].enabled);
});
test('saving submits only selected models, including selected models hidden by the current filter',async()=>{
 const requests=[],form=new Proxy({name:'Audio provider',baseUrl:'https://provider.example',apiKey:'',referenceInputModes:[],fileUploadMediaKinds:[]},{get:(t,k)=>t[k]??''});
 const s=scope({wizard:{form,modelFilter:'tts',models:[{model:'mj_imagine',type:'t2i',enabled:false},{model:'speech-2.8',type:'tts',enabled:true},{model:'selected-image',type:'t2i',enabled:true}]},$id:()=>null,providerApi:async(path,options)=>{requests.push(JSON.parse(options.body));return{id:'saved'};},providerCache:{},expandedProviders:new Set(),providerBucket:()=>'',toast(){},renderPane(){},renderWizardLayer(){}});
 await s.saveWizard();assert.deepEqual(requests.map(r=>r.model),['speech-2.8','selected-image']);assert.ok(requests.every(r=>r.enabled));
});
test('provider fetched candidates combine type, ID/alias search and availability independently',()=>{
 const s=scope(),remote={list:['mj_imagine','speech-2.8','audio-disabled','known-audio'],meta:{'speech-2.8':{type:'audio',name:'Narration voice'},'audio-disabled':{type:'audio',available:false},'known-audio':{type:'audio'}},filterKind:'tts',query:''};
 assert.deepEqual(Array.from(s.filteredRemoteCandidates(remote)),['speech-2.8','known-audio']);
 remote.query='NARRATION';assert.deepEqual(Array.from(s.filteredRemoteCandidates(remote)),['speech-2.8']);
 remote.query='';remote.showAll=true;assert.deepEqual(Array.from(s.remoteCandidateTargets({models:[{model:'known-audio'}]},remote)),['speech-2.8']);
 remote.filterKind='t2i';assert.deepEqual(Array.from(s.filteredRemoteCandidates(remote)),['mj_imagine']);
 const other={...remote,filterKind:'tts'};assert.equal(s.filteredRemoteCandidates(other).length,3);assert.equal(remote.filterKind,'t2i');
});
test('bulk adding fetched models respects filters and retains other candidates after a partial failure',async()=>{
 const group={key:'audio',models:[]},remote={list:['mj_imagine','speech-a','speech-b','speech-c'],meta:{'speech-a':{type:'audio'},'speech-b':{type:'audio'},'speech-c':{type:'audio'}},filterKind:'tts',query:'speech'},requests=[],cache=new Map([['audio',remote]]);
 const s=scope({remoteCandidates:cache,keyInheritSource:()=>({id:'source'}),providerCreatePayload:(_,model,options)=>({...model,...options}),providerApi:async(_,request)=>{requests.push(JSON.parse(request.body));return requests.length===2?{error:'failed'}:{id:'ok'};},providerCache:{},panelToast(){},renderPane(){}});
 await s.addAllCandidates(group);assert.deepEqual(requests.map(r=>r.model),['speech-a','speech-b']);assert.ok(requests.every(r=>r.enabled===false));
 assert.deepEqual(Array.from(cache.get('audio').list),['mj_imagine','speech-b','speech-c']);
 assert.equal(cache.get('audio').filterKind,'tts');assert.equal(cache.get('audio').query,'speech');
});

test('built-in brand expands into four independent non-deletable configuration cards', () => {
 const providers = ['text', 'image', 'video', 'audio'].map((kind, index) => ({
   id: 'fixed-' + kind, provider: 'CanvasFlow · ' + kind, baseUrl: 'https://ai.zzzapi.xyz',
   protocol: 'openai', builtIn: true, builtInKind: kind, apiKeySet: index === 0
 }));
 const models = providers.map((provider, index) => ({
   ...provider, id: 'model-' + index, model: 'model-' + index
 }));
 const s = { expandedProviders: new Set(), builtInProviderExpanded: true, builtInChildDraft: null, renamingKey: '',
   esc: value => String(value || ''), svgIcon: () => '', hostOf: () => '' };
 vm.createContext(s);
 vm.runInContext(source.match(/const BUILTIN_CONFIG_LABELS = .*;/)[0] + '\n' +
   ['providerBucket', 'groupProviders', 'providerLogoHtml', 'providerLetter', 'keyInheritSource', 'isCanvasFlowProvider',
    'renderProviderCard', 'renderBuiltInProviderGroup', 'renderBuiltInChildForm'].map(key => parts[key]).join('\n'), s);
 const groups = s.groupProviders(models, providers);
 assert.equal(groups.length, 4);
 groups.forEach((group, index) => {
   assert.equal(group.providerId, providers[index].id);
   assert.equal(group.models.length, 1);
   assert.equal(group.models[0].id, models[index].id);
 });
 assert.equal(s.keyInheritSource(groups[0]).id, providers[0].id);
 assert.equal(s.keyInheritSource(groups[1]), null);
 const html = s.renderBuiltInProviderGroup(groups);
 assert.equal((html.match(/<article /g) || []).length, 4);
 for (const title of ['文本配置', '图片配置', '视频配置', '音频配置']) assert.ok(html.includes(title));
 assert.ok(html.includes('CanvasFlow Logo'));
 assert.ok(html.includes('brand-orb'));
 assert.ok(!html.includes('data-provider-delete='));
 assert.ok(!html.includes('data-provider-rename-start='));
 assert.ok(html.indexOf('data-provider-add-child') < html.indexOf('title="内置供应商不可删除"'));
 const custom = {id:'child-image',provider:'图片备用配置',providerGroup:'canvasflow',configKind:'image',
   baseUrl:'https://ai.zzzapi.xyz',protocol:'openai',apiKeySet:false};
 const child = s.groupProviders([{...custom,id:'child-model',apiKeySet:true}], [custom])[0];
 assert.equal(child.providerGroup, 'canvasflow');
 assert.equal(child.configKind, 'image');
 assert.equal(child.models.length, 1);
 assert.equal(s.keyInheritSource(child), null);
 const childHtml = s.renderProviderCard(child);
 assert.ok(childHtml.includes('图片备用配置'));
 assert.ok(childHtml.includes('CanvasFlow Logo'));
 assert.ok(childHtml.includes('data-provider-delete='));
 s.builtInProviderExpanded = false;
 assert.ok(!s.renderBuiltInProviderGroup(groups).includes('<article '));
 assert.ok(s.renderProviderCard({key: 'custom', name: 'Custom', models: []}).includes('data-provider-delete='));
});

test('adding a child stores its type without copying credentials and keeps failed drafts retryable', async () => {
 const requests = [];
 const s = {builtInChildDraft: {name:' 图片备用配置 ',kind:'image',saving:false}, providerCache:{},
   builtInProviderExpanded:false, expandedProviders:new Set(), renderPane(){}, toast(){}, hostOf:()=>'',
   providerApi:async(_,request)=>{assert.equal(request.throwOnError,true);const data=JSON.parse(request.body);requests.push(data);return {provider:{...data,id:'child'}};}};
 vm.createContext(s);
 vm.runInContext(parts.saveBuiltInChild + '\n' + parts.providerBucket, s);
 await s.saveBuiltInChild();
 assert.equal(requests[0].provider, '图片备用配置');
 assert.equal(requests[0].providerGroup, 'canvasflow');
 assert.equal(requests[0].configKind, 'image');
 assert.ok(!('apiKey' in requests[0]) && !('inheritKeyFrom' in requests[0]));
 assert.equal(s.builtInChildDraft, null);
 assert.equal(s.providerCache, null);
 assert.equal(s.builtInProviderExpanded, true);
 assert.equal(s.expandedProviders.size, 1);
 s.builtInChildDraft={name:'重复名称',kind:'audio',saving:false};
 s.providerApi=async()=>{throw new Error('已存在同名配置');};
 await s.saveBuiltInChild();
 assert.equal(s.builtInChildDraft.name, '重复名称');
 assert.equal(s.builtInChildDraft.kind, 'audio');
 assert.equal(s.builtInChildDraft.saving, false);
 assert.equal(s.builtInChildDraft.error, '已存在同名配置');
});
