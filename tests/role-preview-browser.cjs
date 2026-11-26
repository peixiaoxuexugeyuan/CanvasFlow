// Run the bundled landmark models on the shipped gallery photographs without external requests.
const assert = require('node:assert/strict');
const fs = require('node:fs'), http = require('node:http'), path = require('node:path');
const {chromium} = require('../tools/openfilm/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core');
const root = path.resolve(__dirname,'..'), requests = [];
const assets = new Set(fs.readFileSync(path.join(root,'tools/release/files.txt'),'utf8').split(/\r?\n/));
const server = http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname.slice(1));
  if(!name){
    res.setHeader('Content-Type','text/html; charset=utf-8');
    return res.end('<div style="position:relative;width:480px"><img id="subject" style="width:100%"></div><script src="role-studio-controls.js"></script><script src="role-studio-mark-surface.js"></script><script src="assets/role-studio/official-additions.js"></script><script src="role-studio-cutout.js"></script><script src="role-studio-preview.js"></script>');
  }
  if(!assets.has(name)) {res.statusCode=404;return res.end();}
  requests.push(name);
  const types={'.js':'text/javascript','.mjs':'text/javascript','.wasm':'application/wasm','.jpg':'image/jpeg','.webp':'image/webp'};
  res.setHeader('Content-Type',types[path.extname(name)]||'application/octet-stream');
  fs.createReadStream(path.join(root,name)).pipe(res);
});
let browser;
async function main(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({executablePath:path.join(root,'.runtime/openfilm-browser/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe')});
  const context=await browser.newContext();
  const external=[];
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin===origin || ['data:','blob:'].includes(url.protocol)) return route.continue();
    external.push(url.origin);return route.abort();
  });
  const page=await context.newPage();
  page.on('pageerror',e=>console.error(e.message));
  await page.goto(origin);
  await page.evaluate(()=>{
    window.img=document.querySelector('#subject');
    window.preview=window.createRoleAppearancePreview(img);
    window.overlay=img.nextElementSibling;
    window.show=async src=>{img.src=src;await img.decode();};
    window.apply=(controls,enabled=true)=>{overlay.dataset.previewState='pending';preview.update({controls,slot:1,enabled});};
    window.checkSliders=async modeId=>{
      const mode=CanvasFlowRoleModes.find(m=>m.id===modeId), results=[];
      for(const tab of mode.tabs) for(const field of tab.fields){
        if(!['range','switch'].includes(field.type)||field.hint?.includes('不支持预览')) continue;
        const state={[[modeId,tab.id,field.id].join('.')]:field.type==='switch'?true:field.max};
        if(field.activeWhen){
          const material=tab.fields.find(f=>f.id===field.activeWhen.id);
          state[[modeId,tab.id,material.id].join('.')]=material.options.find(v=>v!=='无');
        }
        apply(state);
        for(let i=0;i<120 && ['pending','locating','loading','cutting'].includes(overlay.dataset.previewState);i++)
          await new Promise(r=>requestAnimationFrame(r));
        results.push([field.label,overlay.dataset.previewState]);
      }
      return results;
    };
    window.changed=()=>{
      const w=overlay.width,h=overlay.height;
      const src=document.createElement('canvas');src.width=w;src.height=h;
      const cutout=document.querySelector('.rs-subject-preview');
      const ctx=src.getContext('2d');ctx.drawImage(cutout.complete&&cutout.naturalWidth&&cutout.getAttribute('src')?cutout:img,0,0,w,h);
      const a=ctx.getImageData(0,0,w,h).data,b=overlay.getContext('2d').getImageData(0,0,w,h).data;
      let count=0,left=w,right=0,top=h,bottom=0;
      for(let i=0;i<a.length;i+=4) if(Math.max(...[0,1,2].map(k=>Math.abs(a[i+k]-b[i+k])))>=3){
        count++; const x=i/4%w,y=Math.floor(i/4/w);
        left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
      }
      return {count,left:left/w,right:right/w,top:top/h,bottom:bottom/h};
    };
  });
  const show=src=>page.evaluate(src=>show(src),src);
  const apply=async (controls,enabled=true)=>{
    await page.evaluate(([c,e])=>apply(c,e),[controls,enabled]);
    await page.waitForFunction(()=>!['pending','locating','loading','cutting'].includes(overlay.dataset.previewState),null,{timeout:45000});
    return page.evaluate(()=>({state:overlay.dataset.previewState,hidden:overlay.hidden,delta:overlay.hidden?null:changed()}));
  };
  await show('/role-library/web/001-2.jpg');
  assert.equal((await apply({})).state,'original');
  await page.waitForFunction(()=>document.querySelector('.rs-subject-preview').naturalWidth>0 && img.style.opacity==='0');
  assert.equal(await page.evaluate(()=>img.getAttribute('src')),'/role-library/web/001-2.jpg');
  assert.ok(!requests.some(name=>name.includes('vendor/role-vision')));
  const eye=await apply({'face.eyes.eyeSizeLeft':100});
  assert.equal(eye.state,'ready',JSON.stringify(eye));assert.ok(eye.delta.count>10);
  // Zooming an already retouched portrait must repaint at display resolution.
  // A larger CSS box alone would just magnify the old 960px bitmap.
  await page.evaluate(()=>{img.parentElement.style.width='1150px';preview.refreshResolution();});
  await page.waitForFunction(()=>!overlay.hidden && overlay.height>=img.getBoundingClientRect().height);
  const zoomedEye=await page.evaluate(()=>changed());
  assert.ok(Math.abs(zoomedEye.left-eye.delta.left)<.03 && Math.abs(zoomedEye.bottom-eye.delta.bottom)<.03,
    'the same eye is retouched at both resolutions');
  await page.evaluate(()=>{img.parentElement.style.width='480px';preview.refreshResolution();});
  await page.waitForFunction(()=>overlay.height===960);
  assert.ok(eye.delta.right-eye.delta.left<.38 && eye.delta.bottom-eye.delta.top<.28);
  const mouth=await apply({'face.lips.mouthSize':100});
  assert.equal(mouth.state,'ready');assert.ok(mouth.delta.bottom>eye.delta.bottom);
  assert.equal((await apply({'face.lips.mouthSize':100},false)).hidden,true);
  assert.ok(await page.locator('.rs-subject-preview').isVisible(),'the compare view keeps its clean backdrop');
  assert.deepEqual((await apply({'face.eyes.eyeSizeLeft':100})).delta,eye.delta);
  const faceSliders=await page.evaluate(()=>checkSliders('face'));
  assert.deepEqual(faceSliders.filter(([,state])=>state!=='ready'),[]);
  const trials=await page.evaluate(async()=>{
    const face=CanvasFlowRoleModes.find(m=>m.id==='face'),report=[];
    for(const tab of face.tabs) for(const field of tab.fields.filter(f=>f.previewNote)){
      const signatures=new Map();
      for(const id of field.options.filter(value=>value!=='无')){
        const key='face.'+tab.id+'.'+field.id;
        apply({[key]:id,[key+'Strength']:100});
        for(let i=0;i<180 && ['pending','loading','locating','cutting'].includes(overlay.dataset.previewState);i++)
          await new Promise(r=>requestAnimationFrame(r));
        if(overlay.dataset.previewState!=='ready') throw Error(key+' preview unavailable: '+id);
        const rgba=overlay.getContext('2d').getImageData(0,0,overlay.width,overlay.height).data;
        const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',rgba))).join('.');
        if(signatures.has(hash)) throw Error('Identical '+field.label+' previews: '+signatures.get(hash)+' / '+id);
        signatures.set(hash,id);
      }
      report.push([field.label,signatures.size]);
    }
    return report;
  });
  assert.equal(trials.length,12);
  const exported=await page.evaluate(async()=>{
    const ref=await preview.referenceFor(img.src,{'face.eyes.eyeSizeLeft':95});
    const raw=document.createElement('canvas');raw.width=ref.width;raw.height=ref.height;
    raw.getContext('2d').drawImage(img,0,0,raw.width,raw.height);
    const a=raw.getContext('2d').getImageData(0,0,raw.width,raw.height).data;
    const b=ref.getContext('2d').getImageData(0,0,ref.width,ref.height).data;
    let changed=0,background=0;
    for(let i=0;i<a.length;i+=4)if(Math.abs(a[i]-b[i])>3){changed++;if(i/4%raw.width<raw.width*.1) background++;}
    return {changed,background,corner:b[3]};
  });
  assert.ok(exported.changed>300);assert.equal(exported.background,0);assert.equal(exported.corner,255);
  assert.equal((await apply({'face.skin.beauty':100,'face.skin.blemish':true,'face.eyes.darkCircles':100,
    'face.lips.lipLines':100,'face.shape.contourSmooth':100})).state,'original');
  const blush={'face.makeup.blushPreset':'blush01','face.makeup.blushPresetStrength':100};
  const blushA=await apply({...blush,'face.makeup.blushPresetColor':'001'});
  const blushB=await apply({...blush,'face.makeup.blushPresetColor':'002'});
  assert.ok(blushA.delta.count>10);assert.notDeepEqual(blushA.delta,blushB.delta);
  assert.equal((await apply({...blush,'face.makeup.blushPresetStrength':0})).state,'original');
  const sparkle=await apply({'face.eyes.eyeLight':'yangqi'});
  assert.ok(sparkle.delta.count>8,JSON.stringify(sparkle));
  assert.deepEqual((await apply({'face.eyes.eyeLight':'yangqi','face.eyes.lightAlphaLeft':50,'face.eyes.lightAlphaRight':50})).delta,sparkle.delta);
  assert.equal((await apply({'face.eyes.eyeLight':'yangqi','face.eyes.lightAlphaLeft':0})).state,'original');
  const leftOnly={'face.eyes.eyeLight':'yangqi','face.eyes.lightAlphaLeft':80};
  const oneEye=(await apply(leftOnly)).delta;
  assert.deepEqual((await apply({...leftOnly,'face.eyes.lightAlphaRight':0})).delta,oneEye);
  assert.equal((await apply({'face.eyes.eyeLight':'yangqi','face.eyes.lightAlphaLeft':0,'face.eyes.lightAlphaRight':0})).state,'original');
  for(const option of ['lightXLeft','lightYRight','lightAlphaLeft','lightSizeRight','lightRotateLeft','lightFlipRight']){
    const moved=await apply({'face.eyes.eyeLight':'yangqi',['face.eyes.'+option]:option.includes('Flip')?true:90});
    const identical=await page.evaluate(()=>overlay.toDataURL());
    await apply({'face.eyes.eyeLight':'yangqi'});
    assert.notEqual(await page.evaluate(()=>overlay.toDataURL()),identical,'eye light '+option);
    assert.ok(moved.delta.count>0);
  }
  assert.equal((await apply({'body.figure.thighs':100})).hidden,true,'cropped legs');
  const occluded=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;
    const ctx=c.getContext('2d');ctx.drawImage(img,0,0);ctx.fillStyle='#888';ctx.fillRect(0,0,c.width*.7,c.height);return c.toDataURL();});
  const source=await page.evaluate(()=>{const copy=document.createElement('canvas');copy.width=800;copy.height=400;
    const c=copy.getContext('2d');c.drawImage(img,0,0,400,400);c.drawImage(img,400,0,400,400);return copy.toDataURL();});
  await show(source);
  const group=await apply({'face.eyes.eyeSizeLeft':100});assert.equal(group.state,'multiple',JSON.stringify(group));
  assert.ok(await page.locator('.rs-subject-preview').isVisible(),'custom references show the foreground even when multiple faces disable retouching');
  assert.equal(await page.evaluate(()=>img.style.opacity),'0');
  await show(occluded);
  assert.equal((await apply({'face.eyes.eyeSizeLeft':100})).hidden,true,'occluded face');
  const blank=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=320;c.height=240;return c.toDataURL();});
  await show(blank);
  assert.equal((await apply({'face.eyes.eyeSizeLeft':100,'body.figure.waist':100})).state,'unlocated');
  await show('/role-library/web/001-1.jpg');
  const waist=await apply({'body.figure.waist':100});
  assert.equal(waist.state,'ready',JSON.stringify(waist));assert.ok(waist.delta.count>50);
  const legs=await apply({'body.figure.thighs':100});
  assert.equal(legs.state,'ready');assert.ok(legs.delta.bottom>waist.delta.bottom);
  assert.equal(await page.evaluate(()=>overlay.getContext('2d').getImageData(6,6,1,1).data[3]),0,'edited foreground remains transparent');
  const bodySliders=await page.evaluate(()=>checkSliders('body'));
  assert.deepEqual(bodySliders.filter(([,state])=>state!=='ready'),[]);
  const projection=await page.evaluate(async()=>{
    const actual=await preview.surfaceFor(img.src);
    const swatch=document.createElement('canvas');swatch.width=64;swatch.height=32;
    const brush=swatch.getContext('2d');brush.fillStyle='#f03';brush.fillRect(0,0,64,32);
    const texture=new Image();texture.src=swatch.toDataURL();await texture.decode();
    const region=new Uint8Array(10000).fill(1),depth=new Float32Array(10000);
    function painted(){
      const {bitmap}=CanvasFlowMarkSurface.warp({w:100,h:100,region,depth},texture,{x:50,y:50,size:30},0);
      return bitmap.getContext('2d').getImageData(0,0,bitmap.width,bitmap.height).data.filter((v,i)=>i%4===3 && v).length;
    }
    const flat=painted();
    for(let i=0;i<depth.length;i++)depth[i]=2*(i%100);
    const slope=painted();
    for(let i=0;i<region.length;i++)if(i%100>50)region[i]=2;
    return {face:actual.region.includes(1),torso:actual.region.includes(2),flat,slope,clipped:painted()};
  });
  assert.ok(projection.face && projection.torso,'shipped portrait has both face and body projection geometry');
  assert.ok(projection.slope<projection.flat*.6 && projection.clipped<projection.slope*.7 && projection.clipped>0,
    'a sloping surface compresses the mark and an adjacent surface clips it: '+JSON.stringify(projection));
  assert.equal((await apply({'body.figure.posture':100})).state,'original');
  // Zoom and HiDPI affect the live surface, while detection stays on its own raster.
  const session=await context.newCDPSession(page);
  await session.send('Emulation.setDeviceMetricsOverride',{width:1096,height:881,deviceScaleFactor:2,mobile:false});
  const material={'face.eyes.eyeSizeLeft':100};
  await page.evaluate(()=>{img.parentElement.style.width='200px';});
  const small=await apply(material);
  assert.equal(small.state,'ready');
  const before=await page.evaluate(()=>overlay.height);
  assert.equal(before,960);
  await page.evaluate(()=>{
    img.parentElement.style.transform='scale(2.75)';
    preview.refreshResolution();
  });
  await page.waitForFunction(old=>overlay.height>old && !overlay.hidden,before);
  const zoom=await page.evaluate(()=>{
    const cutout=document.querySelector('.rs-subject-preview'), rect=img.getBoundingClientRect();
    return {height:overlay.height,native:cutout.naturalHeight,requested:rect.height*devicePixelRatio,delta:changed()};
  });
  assert.ok(zoom.height>=Math.min(zoom.native,Math.floor(zoom.requested)),JSON.stringify(zoom));
  assert.ok(zoom.height<=zoom.native);
  for(const side of ['left','top','right','bottom']) assert.ok(Math.abs(zoom.delta[side]-small.delta[side])<.02,'same feature after zoom: '+side);
  await page.evaluate(()=>{img.parentElement.style.transform='';preview.refreshResolution();});
  await page.waitForFunction(h=>overlay.height===h && !overlay.hidden,before);
  await page.addScriptTag({url:'/role-studio-marks.js'});
  const sticker=await page.evaluate(async()=>{
    const host=document.createElement('div');document.body.append(host);
    const solid=(color,size)=>{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
      const ctx=canvas.getContext('2d');ctx.fillStyle=color;ctx.fillRect(0,0,size,size);return canvas;
    };
    const full='/role-library/web/001-1.jpg',half='/role-library/web/001-2.jpg';
    const locations=new Map(), key='features.marks.items';
    const item={id:'saved',preset:'自定义',view:'full',x:40,y:30,size:8,turn:0,src:solid('#e00000',12).toDataURL()};
    const state={[key]:JSON.stringify([item])};
    let slot=1;
    const marks=createRoleStudioMarks({host,presets:{},controls:()=>state,setValue:(k,v)=>{state[k]=v;},
      getSlot:()=>slot,sources:()=>[full,half],editable:()=>true,commit(){},changed(){},
      faceBounds:url=>new Promise(resolve=>locations.set(url,resolve))});
    try{
      // Export immediately on reopening, before either photograph has finished detection.
      const exported=marks.composite('half',solid('#fff',128));
      const adding=marks.add('自定义',item.src);
      await Promise.resolve();
      if(!locations.has(full)||!locations.has(half)) throw Error('Export must locate both portraits');
      if(JSON.parse(state[key]).length!==1) throw Error('A new sticker must wait for the detected face');
      locations.get(half)({x:.4,y:.2,width:.4,height:.4});
      locations.get(full)({x:.3,y:.2,width:.2,height:.2});
      await adding;
      const added=JSON.parse(state[key]).find(row=>row.id!==item.id);
      const image=new Image();image.src=(await exported).url;await image.decode();
      const target=solid('#fff',128).getContext('2d');target.drawImage(image,0,0);
      const center=Array.from(target.getImageData(77,51,1,1).data);
      const position=()=>['left','top','width'].map(k=>Math.round(parseFloat(host.firstElementChild.style[k])));
      marks.update(true);const halfPos=position();
      host.firstElementChild.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
      const halfMoved=position();slot=0;marks.update(true);const fullPos=position();
      return {center,halfPos,halfMoved,fullPos,added:[added.x,added.y],persisted:JSON.parse(state[key]).find(row=>row.id===item.id).x};
    }finally{marks.destroy();host.remove();}
  });
  assert.deepEqual(sticker.halfPos,[60,40,16]);
  assert.deepEqual(sticker.added,[40,30]);
  assert.deepEqual(sticker.halfMoved,[61,40,16]);
  assert.deepEqual(sticker.fullPos,[41,30,8]);
  assert.equal(sticker.persisted,40.5);
  assert.ok(sticker.center[0]>200 && sticker.center[1]<25,'export uses the measured portrait pair');
  await page.evaluate(()=>preview.destroy());
  assert.equal(await page.locator('.rs-appearance-preview').count(),0);
  assert.ok(requests.includes('vendor/role-vision/pose-lite.bin'));assert.deepEqual(external,[]);
  console.log(JSON.stringify({faceSliders:faceSliders.length,bodySliders:bodySliders.length,materials:trials.reduce((sum,[,n])=>sum+n,0),eye:eye.delta,mouth:mouth.delta,group:group.state,waist:waist.delta,legs:legs.delta,zoom,external}));
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
