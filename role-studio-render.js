(() => {
  'use strict';

  const assetSlots = [0, 1, 2, 3];
  const slotNames = ['全身图', '面部特写', '表情九宫格', '人物设定板'];

  window.createRoleStudioRenderer = function ({role = {}, isActive = () => true, onProgress = () => {}, onModelChange=()=>{}}) {
    const savedStyle = role.styling || {};
    const fourImages = list => Array.from({length:4}, (_, slot) => typeof list?.[slot] === 'string' ? list[slot] : '');
    const originals = fourImages(Array.isArray(savedStyle.sourceImages) ? savedStyle.sourceImages : role.images);
    for (let i = 0; i < originals.length; i++) {
      if (!originals[i] && !savedStyle.renderSlotModels?.[i] && !savedStyle.renderedSlots?.includes(i)) originals[i] = role.images?.[i] || '';
    }
    const filterKeys = new Set();
    for (const mode of window.CanvasFlowRoleModes || []) {
      for (const tab of mode.tabs) for (const field of tab.fields) {
        if (field.filterOnly) filterKeys.add(mode.id + '.' + tab.id + '.' + field.id);
      }
    }
    // Choosing a supplier is independent of the identity and pictures already confirmed.
    let activeModel = savedStyle.renderModelId || '';
    function selectModel(id) {
      if (id && activeModel !== id) { activeModel = id; onModelChange(id); }
    }
    const wardrobe = value => [...new Set((Array.isArray(value) ? value : [value]).filter(url => typeof url === 'string' && url))];
    const outfitsFor = input => wardrobe(input.outfitUrls ?? input.outfitUrl);
    let previousBasis;
    function basisKey(controls, outfit, legacy = false) {
      const visual = Object.entries(controls || {}).filter(([key]) => !key.startsWith('voice.') && !filterKeys.has(key)).sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0);
      const urls=wardrobe(outfit);
      const prompts = window.CanvasFlowRolePrompts, revision = legacy ? -1 : prompts?.revision || 0;
      if (previousBasis?.revision===revision && urls.length===previousBasis.urls.length && visual.length===previousBasis.visual.length
        && urls.every((url,i)=>url===previousBasis.urls[i]) && visual.every(([key,value],i)=>
          key===previousBasis.visual[i][0] && value===previousBasis.visual[i][1])) return previousBasis.key;
      const templates = !legacy && prompts?.signature(controls,urls);
      const text = JSON.stringify(templates ? [visual,urls,templates] : [visual,urls]);
      // Synchronous 128-bit fingerprint for cache identity and stored render provenance.
      const hash = [0x811c9dc5,0x85ebca77,0xc2b2ae3d,0x27d4eb2f];
      for (let i = 0; i < text.length; i++) {
        const n = text.charCodeAt(i);
        hash[0] = Math.imul(hash[0] ^ n, 0x01000193);
        hash[1] = Math.imul(hash[1] ^ n, 0x85ebca6b);
        hash[2] = Math.imul(hash[2] ^ n, 0xc2b2ae35);
        hash[3] = Math.imul(hash[3] ^ n, 0x27d4eb2d);
      }
      const key=hash.map(n => (n >>> 0).toString(16).padStart(8,'0')).join('');
      previousBasis={key,urls,visual,revision};
      return key;
    }
    const drafts = new Map(), supplied = fourImages(role.images);
    const fullPortrait = window.roleStudioOfficialPortrait(originals[0]);
    const facePortrait = window.roleStudioOfficialPortrait(originals[1]);
    const replacedPortrait = supplied[1] && supplied[1] !== originals[1] && !savedStyle.renderedSlots?.includes(1);
    const pairedFace = fullPortrait?.full && facePortrait && !facePortrait.full && facePortrait.number === fullPortrait.number;
    const officialHalf = fullPortrait?.full && !replacedPortrait && (!originals[1] || pairedFace)
      ? fullPortrait.halfPreview || originals[1] : '';
    const blank = key => ({key, assets:fourImages(), half:'', halfModel:'', models:fourImages(),job:null,
      generated:new Set(), visualReferences:null, pending:new Map()});
    const hasMetadata = Array.isArray(savedStyle.sourceImages) && Array.isArray(savedStyle.renderedSlots);
    const baselineKey = savedStyle.renderBasisKey || (hasMetadata && !savedStyle.renderedSlots.length
      ? basisKey({},[],true) : basisKey(savedStyle.controls, outfitsFor(savedStyle),true));
    const baseline = blank(baselineKey);
    const ready = savedStyle.renderReadySlots || (hasMetadata && savedStyle.renderedSlots.length ? savedStyle.renderedSlots : assetSlots);
    for (const slot of assetSlots) {
      if (!supplied[slot]) continue;
      const generated = !!savedStyle.renderedSlots?.includes(slot);
      const model = savedStyle.renderSlotModels?.[slot] ?? (generated ? savedStyle.renderModelId : '');
      if (slot === 1 && generated && savedStyle.halfPreviewOnly) {
        baseline.half = supplied[slot]; baseline.halfModel = model || '';
      } else if (ready.includes(slot)) {
        baseline.assets[slot] = supplied[slot]; baseline.models[slot] = model || '';
        if (generated) baseline.generated.add(slot);
      }
    }
    if (savedStyle.halfPreviewUrl) {
      baseline.half = savedStyle.halfPreviewUrl;
      baseline.halfModel = savedStyle.halfPreviewModel || baseline.halfModel;
    }
    drafts.set(baselineKey, readFrame(baselineKey,frameData(baseline)));
    let lastConfirmed = baseline, catalog = [], queue = Promise.resolve();

    function draftFor(controls, outfit, visualReferences) {
      const key = basisKey(controls,outfit);
      let draft = drafts.get(key);
      if (visualReferences) {
        if (!draft) { draft = blank(key); drafts.set(key,draft); }
        draft.visualReferences = visualReferences.map(({url,label}) => ({url,label}));
      }
      return draft;
    }
    function previewSources() {
      return originals.map((url,i)=>url || supplied[i] || imageAt(lastConfirmed,i));
    }
    function images(controls,outfit) {
      const entry = draftFor(controls,outfit);
      return previewSources().map((url,i) => entry?.assets[i] || (i === 1 && entry?.half) || url);
    }
    function framingSources() {
      const original = previewSources();
      const main = original[0] || original[1] || original.find(Boolean) || '';
      return [main, officialHalf || main];
    }
    function viewFrame(slot,controls,outfit,original=false) {
      const entry = original ? null : draftFor(controls,outfit);
      const [full, portrait] = framingSources();
      const main = entry?.assets[0] || full;
      const generatedFull = !!entry?.generated.has(0);
      if (slot === 1) {
        if (entry?.half) return {url:entry.half, crop:false, rendered:true};
        if (!generatedFull && main === full && portrait !== full) return {url:portrait, crop:false, rendered:false};
      }
      return {url:main, crop:slot === 1, rendered:generatedFull};
    }
    function isRendered(slot,controls,outfit) {
      const entry = draftFor(controls,outfit);
      return !!(entry?.generated.has(slot) || (slot === 1 && entry?.half));
    }
    function frameData(entry) {
      return {assets:fourImages(entry?.assets),half:entry?.half || '',models:fourImages(entry?.models),
        halfModel:entry?.halfModel || '',generated:[...(entry?.generated || [])].sort(),...(entry?.job ? {job:{...entry.job}} : {}),
        ...(entry?.retained ? {retained:fourImages(entry.retained), retainedModels:fourImages(entry.retainedModels)} : {})};
    }
    function capture(controls,outfit) {
      const entry=draftFor(controls,outfit), snapshot=frameData(entry);
      // Old/default templates already have a key deterministically derived from controls and outfit.
      // Write an explicit key only for customized text, including not-yet-rendered frames.
      if(window.CanvasFlowRolePrompts?.revision) {
        const key = entry?.key || basisKey(controls,outfit);
        if(key !== basisKey(controls,outfit,true)) snapshot.basisKey = key;
      }
      if (!entry?.half && !entry?.assets.some(Boolean) && lastConfirmed!==baseline) {
        snapshot.confirmed={key:lastConfirmed.key,...frameData(lastConfirmed)};
      }
      const pending=[...drafts.values()].filter(item=>item!==entry && item.job);
      if (pending.length) snapshot.pendingFrames=pending.map(item=>({key:item.key,...frameData(item)}));
      return snapshot;
    }
    function readFrame(key,snapshot) {
      const entry=blank(key);
      entry.assets = fourImages(snapshot?.assets);
      entry.half = snapshot?.half || '';
      entry.generated = new Set(snapshot?.generated || assetSlots.filter(slot=>entry.assets[slot]));
      entry.models = fourImages(snapshot?.models || entry.assets.map((_,slot)=>entry.generated.has(slot) ? snapshot?.modelId : ''));
      entry.halfModel = snapshot?.halfModel || (entry.half ? snapshot?.modelId : '') || '';
      if (snapshot?.retained?.some(Boolean)) {entry.retained=fourImages(snapshot.retained);entry.retainedModels=fourImages(snapshot.retainedModels);}
      const job=snapshot?.job;
      if (typeof job?.id==='string' && job.id && assetSlots.includes(job.slot) && typeof job.modelId==='string') entry.job={...job};
      return entry;
    }
    function restore(controls,outfit,snapshot) {
      const key=snapshot?.basisKey || basisKey(controls,outfit,true);
      const legacyBlank=!Array.isArray(snapshot?.generated) && !snapshot?.half && !snapshot?.assets?.some(Boolean);
      const entry=readFrame(key,legacyBlank && key===baselineKey ? frameData(baseline) : snapshot);
      lastConfirmed=baseline;
      if (snapshot?.confirmed?.key) {
        lastConfirmed=readFrame(snapshot.confirmed.key,snapshot.confirmed);
        drafts.set(lastConfirmed.key,lastConfirmed);
      }
      for (const pending of snapshot?.pendingFrames || []) {
        if (pending.key && pending.key!==key && pending.job) drafts.set(pending.key,readFrame(pending.key,pending));
      }
      drafts.set(key,entry);
      if (entry.half || entry.assets.some(Boolean)) {
        const original=key===baselineKey && JSON.stringify(frameData(entry))===JSON.stringify(frameData(baseline));
        lastConfirmed=original ? baseline : entry;
      }
    }
    function savedEntry(controls,outfit) {
      const entry = draftFor(controls,outfit);
      return entry && (entry.assets.some(Boolean) || entry.half) ? entry : lastConfirmed;
    }
    function savedImages(controls,outfit) {
      const entry = savedEntry(controls,outfit);
      return assetSlots.map(i=>imageAt(entry,i));
    }
    function imageAt(entry,i) {
      const prior=i===1 && savedStyle.halfPreviewOnly ? originals[i] : supplied[i];
      return entry.assets[i] || entry.retained?.[i] || prior || originals[i];
    }
    function modelAt(entry,i) {
      if (entry.assets[i]) return entry.models[i];
      if (entry.retained?.[i]) return entry.retainedModels[i];
      if(i===1 && savedStyle.halfPreviewOnly) return '';
      return savedStyle.renderSlotModels?.[i] || (savedStyle.renderedSlots?.includes(i) && savedStyle.renderModelId) || '';
    }
    function persistence(controls,outfit) {
      const entry = savedEntry(controls,outfit);
      const renderedSlots = assetSlots.filter(i => entry.generated.has(i));
      const renderSlotModels = assetSlots.map(i=>modelAt(entry,i));
      const renderModelId = renderSlotModels[0] || entry.halfModel || renderedSlots.map(i=>renderSlotModels[i]).find(Boolean) || renderSlotModels.find(Boolean);
      return {sourceImages:[...originals], renderedSlots, renderReadySlots:assetSlots.filter(i=>entry.assets[i]),
        renderBasisKey:entry.key, renderSlotModels, ...(renderModelId ? {renderModelId} : {}),
        halfPreviewOnly:false,
        ...(entry.half ? {halfPreviewUrl:entry.half,halfPreviewModel:entry.halfModel} : {})};
    }

    async function models() {
      catalog = await window.CanvasFlowRoleGeneration.models();
      return catalog;
    }

    function checkActive() {
      if (!isActive()) throw Error('角色编辑已结束。');
    }

    function schedule(draft, key, work) {
      if (draft.pending.has(key)) return draft.pending.get(key);
      const result = queue.then(async () => {
        checkActive();
        return await work();
      }).finally(() => draft.pending.delete(key));
      queue = result.catch(() => {});
      draft.pending.set(key, result);
      return result;
    }

    async function selectedModel(id) {
      if (!id) throw Error('请先选择生图模型。');
      if (!catalog.some(model => model.id === id)) await models();
      checkActive();
      const model = catalog.find(item => item.id === id);
      if (!model) throw Error('所选图片模型不可用，请重新选择。');
      return model;
    }

    function prepareReferences(draft, slot, model, outfits, preview, half, stylingSource) {
      const max = model.maxReferences ?? Infinity;
      const sources=previewSources();
      const full = draft.assets[0] || supplied[0] || sources[0];
      const portrait = draft.assets[1] || supplied[1] || sources[1];
      const confirmedFull = draft.assets[0];
      let preferred;
      if (slot === 0 || slot === 3) preferred = [full,draft.half,portrait];
      else if (slot === 1 && !half) preferred = [draft.half,confirmedFull,portrait,full];
      else preferred = [draft.half,portrait,full];
      const sourceCandidates = [...new Set([stylingSource,...preferred,...originals,...supplied].filter(Boolean))];
      const primary = sourceCandidates[0];
      const candidates = sourceCandidates.filter(url=>url===primary || !outfits.includes(url));
      if (outfits.length && max < 1) throw Error('此模型无法接收服装参考图，请选择支持参考图的模型。');
      if (candidates.length && max < 1) throw Error('生成已有角色需要保留身份参考图，请选择能接收参考图的图片模型。');
      const garmentRefs = outfits.filter(url=>url!==primary);
      const required = Number(!!candidates.length) + garmentRefs.length;
      if (required > max) {
        const dressed = draft.half || preferred.find(url=>url && draft.generated.has(draft.assets.indexOf(url)));
        if (dressed && max === 1 && outfits.length === 1) {
          return {refs:[dressed], instructions:['参考图 1 是本次造型的角色，保持面部身份、体态和服装一致。'],
            omittedReferences:[preview,...draft.visualReferences].filter(Boolean).map(ref=>ref.label)};
        }
        throw Error('此模型最多支持 '+max+' 张参考图，当前需要'+(candidates.length?'角色身份图和':'')+outfits.length+
          ' 张服装参考图。请减少服装参考图或选择支持至少'+(required===2?'两':required)+'张参考图的模型。');
      }
      const available = max - garmentRefs.length;
      const confirmed = primary && (primary===draft.half || [...draft.generated].some(i=>draft.assets[i]===primary));
      const combined = preview && available === 1 && !outfits.includes(primary) && !confirmed;
      if (combined) candidates.unshift(preview.url);
      const seen = new Set([...candidates,...outfits]);
      const supplements = [];
      for (const ref of [...(preview && !combined ? [preview] : []), ...draft.visualReferences]) {
        if (!ref.url || seen.has(ref.url)) continue;
        seen.add(ref.url); supplements.push(ref);
      }
      const selected = supplements.slice(0, Math.max(0,available - Number(!!candidates.length)));
      const omittedReferences = supplements.slice(selected.length).map(ref=>ref.label);
      const desired = Math.max(2,(model.minReferences || 0) - garmentRefs.length - selected.length);
      const identity = candidates.slice(0, Math.min(desired,available-selected.length));
      const refs = [...identity];
      const instructions = identity.map((_,i)=>'参考图 '+(i+1)+' 用于保持角色身份、脸部特征和身形一致。');
      if (combined) instructions[0]='参考图 1 同时用于保持角色身份并还原'+preview.label+'。';
      for (const url of outfits) {
        if (!refs.includes(url)) refs.push(url);
        const n = refs.indexOf(url)+1;
        instructions.push('参考图 '+n+(identity.includes(url)?' 同时用于服装、配饰和材质。':' 仅用于服装、配饰和材质，保留本角色的身份与面部特征。'));
      }
      for (const ref of selected) {
        refs.push(ref.url);
        instructions.push('参考图 '+refs.length+' 用于还原'+ref.label+'，保留原角色身份。');
      }
      if (refs.length < (model.minReferences || 0)) throw Error('此模型至少需要 '+model.minReferences+' 张参考图。');
      return {refs, instructions, omittedReferences};
    }

    function acceptImage(draft,url,slot,half,modelId,view) {
      // A partial render can replace one picture while the other approved pictures still belong to an earlier look.
      const retained=assetSlots.map(i=>imageAt(lastConfirmed,i));
      const retainedModels=assetSlots.map(i=>modelAt(lastConfirmed,i));
      if (retained.some((image,i)=>image && (image!==supplied[i] || retainedModels[i]!==modelAt(baseline,i)))) {
        draft.retained=retained; draft.retainedModels=retainedModels;
      }
      if (view) {
        if (slot===0) {draft.half='';draft.halfModel='';}
        for (const i of [1,2,3]) clearAsset(draft,i);
      }
      if (half) {draft.half=url; draft.halfModel=modelId;}
      else {draft.assets[slot]=url; draft.models[slot]=modelId; draft.generated.add(slot);}
      draft.job=null;lastConfirmed=draft;
    }
    function recordProgress(draft,job) {
      if (job?.status==='failed') {draft.job=null;onProgress({phase:'checkpoint'});}
    }
    async function recover(draft,input) {
      const prior=draft.job;
      if (!prior) return;
      const report=job=>{recordProgress(draft,job);onProgress({slot:prior.slot,half:prior.half,phase:'progress',completed:0,total:1,job});};
      let url;
      try {
        url=await window.CanvasFlowRoleGeneration.generate({slot:prior.slot,resumeJobId:prior.id,
          signal:input.signal,isActive,onProgress:report});
      } catch(error) {
        if (error?.status===404) {draft.job=null;onProgress({phase:'checkpoint'});}
        throw error;
      }
      checkActive();
      if (!url) throw Error('已提交的角色任务没有返回图片，请在生成历史中查看。');
      acceptImage(draft,url,prior.slot,prior.half,prior.modelId,prior.view);
      onProgress({slot:prior.slot,half:prior.half,phase:'completed',completed:1,total:1});
      return url;
    }
    async function recoverSubmitted(input) {
      let last;
      for (const entry of drafts.values()) if(entry.job) last=await recover(entry,input);
      return last;
    }
    async function render(draft, input, model, slot, half, completed, total, view=false) {
      checkActive();
      const preview=await input.previewFor?.(slot);
      checkActive();
      const {refs, instructions, omittedReferences} = prepareReferences(draft, slot, model, outfitsFor(input), preview?.url ? preview : null, half, input.stylingSource);
      omittedReferences.push(...(preview?.omitted||[]));
      const description = [
        role.name && '角色名：' + role.name,
        role.value && '原角色设定：' + role.value,
        input.prompt && '本次外观设定（优先采用）：' + input.prompt,
        ...instructions,
        omittedReferences.length && '以下选项按文字设定绘制：' + omittedReferences.join('、'),
      ].filter(Boolean).join('\n');
      const report = (phase, done, job) => onProgress({slot, half, completed:done, total, phase, job, omittedReferences});
      if (!input.prepareOnly) report('generating', completed);
      const url = await window.CanvasFlowRoleGeneration.generate({
        modelId:model.id, slot, preview:half ? 'half' : undefined, prompt:description,
        prepareOnly:!!input.prepareOnly, referenceCache:input.referenceCache,
        referenceImages:refs, roleStyling:input.styleAI, isActive, signal:input.signal,beforeSubmit:input.beforeSubmit,
        onSubmitted:id=>{draft.job={id,modelId:model.id,slot,half,view,...(input.step?{step:input.step}:{})};onProgress({phase:'checkpoint'});},
        onProgress:job=>{recordProgress(draft,job);report('progress',completed,job);},
      });
      checkActive();
      if (input.prepareOnly) return url;
      if (!url) throw Error(slotNames[slot] + '没有返回图片。');
      acceptImage(draft,url,slot,half,model.id,view);
      report('completed', completed + 1);
      return url;
    }
    function clearAsset(draft,slot) {
      draft.assets[slot]=''; draft.models[slot]=''; draft.generated.delete(slot);
    }
    async function ensureStylingSteps(input) {
      if(!input.stylingSteps?.length)return;
      const completed=new Set(), steps=input.stylingSteps, slot=input.slot===1?1:0;
      const controls={...input.controls}, wardrobe=outfitsFor(input);
      const stepKeys=new Set(steps.map(step=>step.key));
      for(const key of stepKeys)delete controls[key];
      let image;
      for(const entry of drafts.values()) {
        if(!entry.job)continue;
        const prior=entry.job;
        const result=await recover(entry,input);
        const previous={...controls};
        for(const step of steps) {
          if(Object.hasOwn(input.controls,step.key))previous[step.key]=input.controls[step.key];
          if(prior.step?.key!==step.key || prior.step.value!==step.value)continue;
          if(basisKey(previous,wardrobe)===entry.key){
            completed.add(step.key);image=result;input.onStylingStep?.(step.key,step.value);
          }
          break;
        }
      }
      const model=await selectedModel(input.modelId);
      for(const [index,step] of steps.entries()) {
        if(Object.hasOwn(input.controls,step.key))controls[step.key]=input.controls[step.key];
        if(completed.has(step.key))continue;
        const first=index===0;
        const refs=step.image?[{url:step.image,label:step.label}]:[];
        if(first)refs.push(...(input.visualReferences||[]).filter(ref=>!stepKeys.has(ref.key)));
        const stage=draftFor(controls,wardrobe,refs);
        const source=image || (slot===1 && lastConfirmed.half) || imageAt(lastConfirmed,slot) || imageAt(lastConfirmed,1-slot);
        const prompt=[first && input.stylingBase,step.prompt].filter(Boolean).join('\n');
        const partial={...input,slot,step:{key:step.key,value:step.value},prompt,
          previewFor:first?input.previewFor:null,stylingSource:source,outfitUrls:first?wardrobe:[],styleAI:null};
        image=await render(stage,partial,model,slot,slot===1,index,steps.length,true);
        input.onStylingStep?.(step.key,step.value);
      }
      draftFor(input.controls,wardrobe,input.visualReferences || []);
      return image;
    }
    function generateView(input) {
      const {slot,modelId,controls} = input;
      if (![0,1].includes(slot)) return Promise.reject(Error('请选择半身或全身视角。'));
      selectModel(modelId);
      const draft = draftFor(controls,outfitsFor(input),input.visualReferences || []);
      return schedule(draft,'view-'+slot+'-'+modelId,async () => {
        if(input.stylingSteps?.length)return ensureStylingSteps(input);
        const recovered=await recoverSubmitted(input);
        if (recovered) return recovered;
        const model = await selectedModel(modelId);
        return render(draft,input,model,slot,slot===1,0,1,true);
      });
    }
    function generateAssets(input) {
      selectModel(input.modelId);
      const draft = draftFor(input.controls,outfitsFor(input),input.visualReferences || []);
      return schedule(draft,'assets-'+input.modelId,async () => {
        await ensureStylingSteps({...input,slot:0});
        await recoverSubmitted(input);
        const missing = assetSlots.filter(i => !draft.assets[i]);
        if (missing.length) {
          const model = await selectedModel(input.modelId);
          for (const [i,slot] of missing.entries()) await render(draft,input,model,slot,false,i,missing.length);
        }
        return [...draft.assets];
      });
    }
    function preparePrimary(input) {
      selectModel(input.modelId);
      const draft = draftFor(input.controls,outfitsFor(input),input.visualReferences || []);
      return schedule(draft,'primary-'+input.modelId,async()=>{
        await ensureStylingSteps({...input,slot:0});
        await recoverSubmitted(input);
        const missing = assetSlots.filter(slot=>!draft.assets[slot]);
        if (!missing.length) return [];
        const model = await selectedModel(input.modelId);
        if (!draft.assets[0]) await render(draft,input,model,0,false,0,1);
        const prepared = {...input,prepareOnly:true,referenceCache:new Map()};
        const items = [];
        for (const slot of missing.filter(slot=>slot!==0)) {
          const payload = await render(draft,prepared,model,slot,false,0,1);
          items.push({slot,payload});
        }
        return items;
      });
    }
    function plan(controls,outfit) {
      const entry=draftFor(controls,outfit);
      const ready=fourImages(entry?.assets).map(Boolean), job=entry?.job;
      if (job?.view) for(const slot of [1,2,3]) ready[slot]=false;
      if (job && !job.half) ready[job.slot]=true;
      const primary=ready[0] ? 0 : 1, derived=[1,2,3].filter(i=>!ready[i]).length;
      const pending=[...drafts.values()].filter(item=>item.job).length;
      return {primary,derived,total:primary+derived,pending,stale:savedEntry(controls,outfit).key!==basisKey(controls,outfit)};
    }
    const remaining=(controls,outfit)=>plan(controls,outfit).total;
    return {models,generateView,generateAssets,preparePrimary,images,savedImages,previewSources,framingSources,viewFrame,isRendered,persistence,capture,restore,selectModel,basisKey,plan,remaining};
  };
})();
