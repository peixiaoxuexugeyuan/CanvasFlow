/* CanvasFlow launch animation. UI preferences stay on this device; no project writes. */
(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.CanvasFlowStartup = api; api.install(); }
})(typeof window === 'object' ? window : globalThis, function (root) {
  'use strict';
  const KEY = 'canvasflow-startup-animation';
  const clamp = value => Math.max(0, Math.min(1, value));
  const smooth = value => { const x=clamp(value); return x*x*(3-2*x); };
  const lerp = (a,b,t) => a+(b-a)*t;
  let active = null, installed = false, bootReady = false, dataReady = false;

  function normalize(value) {
    const source=value && typeof value==='object' && !Array.isArray(value) ? value : {};
    return {enabled:source.enabled!==false, mode:source.mode==='flip'?'flip':'water'};
  }
  function preferences() {
    try { return normalize(JSON.parse(root.localStorage.getItem(KEY)||'null')); }
    catch { return normalize(null); }
  }
  function savePreferences(patch) {
    const next=normalize({...preferences(),...patch});
    try { root.localStorage.setItem(KEY,JSON.stringify(next)); return next; }
    catch { return null; }
  }
  function timing(mode) {
    return mode==='water' ? {load:7200,flipStart:7200,flipEnd:7200,end:9000}
      : {load:4400,flipStart:5050,flipEnd:6500,end:9000};
  }
  function sample(time, mode='water') {
    const times=timing(mode),load=clamp(time/times.load);
    const flip=mode==='flip'?clamp((time-times.flipStart)/(times.flipEnd-times.flipStart)):0;
    const morph=smooth((flip-.10)/.80),turn=smooth(flip);
    const zoom=mode==='flip'?clamp((time-times.flipEnd)/(times.end-times.flipEnd)):0;
    const fade=mode==='water'?smooth((time-8200)/800):0;
    return {load,flip,morph,turn,zoom,size:smooth(zoom),fade,done:time>=times.end};
  }

  const logoMarkup=`<svg class="cf-launch-svg" viewBox="56 56 144 134" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs><path id="cf-launch-triangle" d="M56 190 128 56l72 134z"/>
      <clipPath id="cf-launch-clip"><use href="#cf-launch-triangle"/></clipPath>
      <linearGradient id="cf-launch-color" x1="0" y1="0" x2="0" y2="145" gradientUnits="userSpaceOnUse"><stop stop-color="#bcecff"/><stop offset=".5" stop-color="#74bffc"/><stop offset="1" stop-color="#427fe8"/></linearGradient>
      <path id="cf-launch-wave" d="M-64 0Q-48-5-32 0T0 0T32 0T64 0T96 0T128 0T160 0T192 0T224 0T256 0T288 0T320 0T352 0T384 0V260H-64Z"/>
    </defs>
    <use href="#cf-launch-triangle" fill="#d5e5ff" fill-opacity=".05" stroke="#d8e9ff" stroke-opacity=".18" stroke-width=".8"/>
    <g clip-path="url(#cf-launch-clip)"><g data-launch-water><use data-launch-wave-back href="#cf-launch-wave" fill="#bce7ff" fill-opacity=".35"/><use data-launch-wave-front href="#cf-launch-wave" fill="url(#cf-launch-color)"/></g></g>
    <use data-launch-white href="#cf-launch-triangle" fill="#f6f9ff" opacity="0"/>
  </svg>`;

  function play(options={}) {
    if (active || !root.document) return Promise.resolve(false);
    const document=root.document, shell=document.querySelector('.app-shell');
    if (!shell) { document.documentElement.classList.remove('cf-startup-pending'); return Promise.resolve(false); }
    let mode=normalize({mode:options.mode||preferences().mode}).mode;
    if(mode==='flip' && root.CSS?.supports && !root.CSS.supports('transform-style','preserve-3d'))mode='water';
    const preview=options.preview===true,reduced=root.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
    const times=timing(mode),previousFocus=document.activeElement;
    const underlay=document.createElement('div');underlay.className='cf-launch-underlay';underlay.setAttribute('aria-hidden','true');
    const overlay=document.createElement('section');overlay.className='cf-launch-overlay';
    overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label',preview?'启动动画预览':'CanvasFlow 正在启动');
    overlay.innerHTML=`<div class="cf-launch-ambient" aria-hidden="true"></div><div class="cf-launch-portal" aria-hidden="true"><div class="cf-launch-front">${logoMarkup}</div></div>
      <div class="cf-launch-copy"><div class="cf-launch-name">CanvasFlow</div><div class="cf-launch-progress" role="progressbar" aria-label="工作区加载进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="cf-launch-meta"><span data-launch-status role="status" aria-live="polite">正在加载</span><span data-launch-number aria-hidden="true">00%</span></div><div class="cf-launch-track"><div data-launch-fill></div></div></div></div>
      <button class="cf-launch-skip" type="button">${preview?'结束预览':'跳过动画'}</button><p class="cf-launch-caption">${preview?(mode==='flip'?'备用方案 · 水位加载 / 180° 翻转展开':'默认方案 · 水位加载'):'让灵感，开始流动。'}</p>`;
    const pick=selector=>overlay.querySelector(selector),portal=pick('.cf-launch-portal'),front=pick('.cf-launch-front');
    const svg=pick('.cf-launch-svg'),copy=pick('.cf-launch-copy'),skip=pick('.cf-launch-skip'),ambient=pick('.cf-launch-ambient');
    const water=pick('[data-launch-water]'),waveFront=pick('[data-launch-wave-front]'),waveBack=pick('[data-launch-wave-back]'),white=pick('[data-launch-white]');
    const progress=pick('.cf-launch-progress'),number=pick('[data-launch-number]'),status=pick('[data-launch-status]'),fill=pick('[data-launch-fill]');
    const properties=['position','inset','z-index','width','height','min-width','min-height','max-width','margin','transform','transform-origin','backface-visibility','opacity','pointer-events','clip-path','border-radius','will-change','visibility'];
    const saved=properties.map(name=>[name,shell.style.getPropertyValue(name),shell.style.getPropertyPriority(name)]);
    const wasInert=shell.inert,ariaHidden=shell.getAttribute('aria-hidden');
    const obscured=Array.from(document.body.children||[]).filter(element=>element!==shell).map(element=>[element,element.inert]);
    let frameId=0,guardId=0,elapsed=0,last=null,wallStart=root.performance.now(),settled=false,lastPercent=-1,lastStatus='';
    let resolve;const result=new Promise(done=>{resolve=done;});
    function finish() {
      if(settled)return;settled=true;root.cancelAnimationFrame(frameId);root.clearTimeout(guardId);
      root.removeEventListener('keydown',onKey,true);document.removeEventListener('visibilitychange',onVisibility);
      saved.forEach(([name,value,priority])=>{if(value)shell.style.setProperty(name,value,priority);else shell.style.removeProperty(name);});
      shell.inert=wasInert;if(ariaHidden===null)shell.removeAttribute('aria-hidden');else shell.setAttribute('aria-hidden',ariaHidden);
      obscured.forEach(([element,inert])=>{element.inert=inert;});
      overlay.remove();underlay.remove();document.documentElement.classList.remove('cf-startup-active','cf-startup-pending');active=null;
      try {
        root.dispatchEvent(new root.Event('resize'));
        root.CanvasFlowConnections?.draw?.();
        if(previousFocus?.isConnected && previousFocus!==document.body)previousFocus.focus({preventScroll:true});
      } finally {resolve(true);}
    }
    function onKey(event) {
      // Global canvas shortcuts must not edit the project while the launch overlay owns focus.
      event.preventDefault();event.stopImmediatePropagation();
      if(event.key==='Escape')finish();else if(event.key==='Tab')skip.focus({preventScroll:true});
    }
    function onVisibility(){last=null;}
    function paint(time) {
      const state=sample(time,mode),width=root.innerWidth,height=root.innerHeight;
      const glyphW=height<580?116:146,glyphH=glyphW*134/144;
      const w=lerp(lerp(glyphW,width*.38,state.morph),width,state.size);
      const h=lerp(lerp(glyphH,height*.38,state.morph),height,state.size);
      const cy=lerp(height*.40,height*.50,smooth(state.flip));
      const angle=reduced?(state.flip>=.5?180:0):state.turn*180;
      const left=lerp(50,0,state.morph),right=lerp(50,100,state.morph);
      const polygon=`polygon(${left}% 0%,${right}% 0%,100% 100%,0% 100%)`;
      const radius=lerp(0,10,state.morph)*(1-state.size);
      portal.style.width=w+'px';portal.style.height=h+'px';portal.style.top=cy+'px';
      portal.style.transform=`translate(-50%,-50%) rotateY(${angle}deg)`;
      front.style.clipPath=polygon;front.style.borderRadius=radius+'px';front.style.background=`rgba(246,249,255,${state.morph})`;
      svg.style.opacity=1-state.morph;
      const copyOpacity=mode==='water'?1-state.fade:1-smooth(state.flip/.65);
      copy.style.opacity=copyOpacity;portal.style.opacity=mode==='water'?1-state.fade:1;
      ambient.style.opacity=mode==='water'?1-state.fade:1-.65*state.size;
      water.setAttribute('transform',`translate(0 ${196-state.load*146})`);
      const waveTime=reduced?0:time;
      waveFront.setAttribute('transform',`translate(${-waveTime/2600*64%64} 0)`);
      waveBack.setAttribute('transform',`translate(${-64+waveTime/3900*64%64+19} -2.5)`);
      white.setAttribute('opacity',smooth((time-times.load)/550));
      if(mode==='flip'){
        shell.style.transform=`perspective(1800px) translateY(${cy-height/2}px) rotateY(${angle-180}deg) scale(${w/width},${h/height})`;
        shell.style.clipPath=polygon;shell.style.borderRadius=(radius/(w/width))+'px';
        shell.style.opacity=.10+.90*smooth(state.zoom);
        if(state.size===1){shell.style.transform='none';shell.style.clipPath='none';shell.style.willChange='auto';}
      }else {shell.style.transform='none';shell.style.clipPath='none';shell.style.opacity=state.fade;}
      const percent=Math.floor(state.load*100);
      if(percent!==lastPercent){lastPercent=percent;number.textContent=String(percent).padStart(2,'0')+'%';progress.setAttribute('aria-valuenow',percent);}
      const nextStatus=state.load>=1?'准备就绪':state.load>=.90?'正在准备工作区':'正在加载';
      if(nextStatus!==lastStatus){lastStatus=nextStatus;status.textContent=nextStatus;}
      fill.style.width=(state.load*100)+'%';
    }
    function frame(now) {
      try {
        const delta=last===null?0:Math.min(80,Math.max(0,now-last));last=now;
        const ready=preview||(bootReady&&dataReady),ceiling=ready?times.end:times.load*.92;
        elapsed=Math.min(elapsed+delta,ceiling);paint(elapsed);
        if(elapsed>=times.end){finish();return;}
        if(now-wallStart>15000 && !ready)status.textContent='工作区加载较慢，可跳过动画';
        frameId=root.requestAnimationFrame(frame);
      } catch {finish();}
    }
    try {
      active={finish,mode,preview};
      shell.inert=true;shell.setAttribute('aria-hidden','true');
      obscured.forEach(([element])=>{element.inert=true;});
      const css={position:'fixed',inset:'0','z-index':'2147483001',width:'100vw',height:'100vh','min-width':'0','min-height':'0','max-width':'none',margin:'0','transform-origin':'50% 50%','backface-visibility':'hidden','pointer-events':'none','will-change':'transform,opacity',visibility:'visible'};
      Object.entries(css).forEach(([name,value])=>shell.style.setProperty(name,value));
      document.body.append(underlay,overlay);paint(0);
      document.documentElement.classList.add('cf-startup-active');document.documentElement.classList.remove('cf-startup-pending');
      skip.addEventListener('click',finish);root.addEventListener('keydown',onKey,true);document.addEventListener('visibilitychange',onVisibility);
      skip.focus({preventScroll:true});
      // A broken initialization or an unavailable local service must never trap the application.
      guardId=root.setTimeout(finish,20000);frameId=root.requestAnimationFrame(frame);
    }catch {finish();}
    return result;
  }
  function install() {
    if(installed||!root.document)return;installed=true;
    const document=root.document;
    if(!preferences().enabled)return;
    document.documentElement.classList.add('cf-startup-pending');
    const earlyGuard=root.setTimeout(()=>document.documentElement.classList.remove('cf-startup-pending'),15000);
    const start=()=>{root.clearTimeout(earlyGuard);void play();};
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
  }
  return {KEY,normalize,preferences,savePreferences,sample,timing,install,play,
    preview:mode=>play({mode,preview:true}),booted:()=>{bootReady=true;},ready:()=>{dataReady=true;},
    skip:()=>active?.finish(),isPlaying:()=>Boolean(active)};
});
