// No credentials cross into Studio: all model requests go back to the workspace-scoped CanvasFlow host.
import {landing, translationAsk, translatedLines, pictureSize, gifFrameSize, mimeOf, speechUpload} from './node_modules/openfilm/studio/server/providers/common.mjs';
const call=(method,args)=>globalThis.canvasflowHost(method,args);
const provider={id:'canvasflow',name:'CanvasFlow · 当前工作区',env:'CANVASFLOW_HOST',verbs:['voice','image','video','tts','music','sfx','asr','translate'],models:{},
  keyless:true,speechFormat:'mp3',refresh:refreshModels,
  ready:()=>Object.values(provider.models).some(a=>a.length),
  async run(verb,args,ctx) {
    if(verb==='voice'){
      const result=await call('voices',{model:ctx.model});
      const voices=(result.voices||[]).filter(v=>(!args.language||String(v.language||'').includes(args.language))&&(!args.gender||v.gender===args.gender)&&(!args.prompt||JSON.stringify(v).toLowerCase().includes(String(args.prompt).toLowerCase())));
      return {files:[],index:[],receipt:{voices:voices.slice(0,Math.min(100,Number(args.limit)||30)).map(v=>({...v,voiceId:v.id})),notes:result.error?[result.error]:[]}};
    }
    const input={verb,model:ctx.model,args:{...args},files:[]};
    const refs=Array.isArray(args.ref)?args.ref:args.ref?[args.ref]:[];
    if(verb==='video')for(const role of ['first-frame','last-frame','input-reference','audio','voice','video'])for(const path of [args[role]].flat().filter(Boolean))input.files.push({path,role,base64:Buffer.from(await ctx.read(path)).toString('base64')});
    else for(const path of refs.slice(0,16))input.files.push({path,base64:Buffer.from(await ctx.read(path)).toString('base64')});
    if(verb==='asr' && args.src) {const upload=await speechUpload(args.src,ctx);input.files.push({path:args.src,name:upload.name,mime:upload.blob.type,base64:Buffer.from(await upload.blob.arrayBuffer()).toString('base64')});}
    if(verb==='image'){const ratio=args.ratio||'1:1',size=pictureSize(ratio,args.size||'1k');if(!size)throw Error('不支持所选图片比例');input.args.dimensions=args.format==='gif'?gifFrameSize(ratio,Math.max(2,Math.min(16,Number(args.frames)||9)),size):size;if(!input.args.dimensions)throw Error('GIF 帧数与画幅不匹配，请减少帧数');}
    if(verb==='image')for(const role of ['mask','markup'])if(args[role])input.files.push({path:args[role],role,mime:mimeOf(args[role]),base64:Buffer.from(await ctx.read(args[role])).toString('base64')});
    if(verb==='translate')input.args.prompt=(()=>{const p=translationAsk(args.lines,args.language);return p.system+'\n\n'+p.user;})();
    const result=await call('generate',input);
    if(verb==='translate')return {files:[],index:[],receipt:{lines:translatedLines(result.text,args.lines.length),provider:'canvasflow',model:ctx.model}};
    if(verb==='asr')return {files:[],index:result.index||[],receipt:result};
    const ext=({'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif','image/svg+xml':'svg','audio/wav':'wav','video/mp4':'mp4','video/webm':'webm'})[result.mime]||'mp3';
    const path=landing(verb==='image'?'image':verb==='video'?'video':'audio',args.out,ext);
    return {files:[{path,bytes:Buffer.from(result.base64,'base64')}],index:[{src:path,kind:verb==='image'?'image':verb==='video'?'video':'audio',...(verb==='tts'?{text:args.text||args.prompt}: {})}],receipt:{provider:'canvasflow',model:ctx.model}};
  }};
export async function refreshModels(){const next=(await call('models',{})).models;for(const key of Object.keys(provider.models))delete provider.models[key];Object.assign(provider.models,next);return provider.models;}
export default provider;
