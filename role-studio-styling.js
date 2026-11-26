(() => {
  'use strict';

  function hsvFromHex(hex) {
    const [r,g,b]=hex.slice(1).match(/../g).map(pair=>parseInt(pair,16)/255);
    const max=Math.max(r,g,b), delta=max-Math.min(r,g,b);
    const angle=!delta?0:max===r?(g-b)/delta:max===g?(b-r)/delta+2:(r-g)/delta+4;
    return {h:(angle*60+360)%360,s:max?delta/max:0,v:max};
  }
  function toHex({h,s,v}) {
    const value=n=>{
      const k=(n+h/60)%6;
      return Math.round(255*v*(1-s*Math.max(0,Math.min(k,4-k,1)))).toString(16).padStart(2,'0');
    };
    return '#'+[5,3,1].map(value).join('');
  }
  function mountColorPicker(trigger, initial, apply) {
    const box=document.createElement('section');
    box.className='rs-hsv';box.setAttribute('role','dialog');box.setAttribute('aria-label','自定义发色');
    box.innerHTML='<button type="button" class="rs-hsv-plane" aria-label="饱和度和亮度，使用方向键调整"><i></i></button><label>色相<input type="range" min="0" max="359" step="1"></label><label>颜色值<input type="text" maxlength="7" spellcheck="false" aria-label="十六进制发色"></label><footer><button type="button" class="rs-hsv-cancel">取消</button><button type="button" class="rs-hsv-apply">应用</button></footer>';
    trigger.parentElement.after(box);
    trigger.setAttribute('aria-expanded','true');
    const plane=box.querySelector('.rs-hsv-plane'),hue=box.querySelector('[type=range]'),hex=box.querySelector('[type=text]'),accept=box.querySelector('.rs-hsv-apply');
    let state=hsvFromHex(initial);
    const clamp=x=>Math.max(0,Math.min(1,x));
    function draw() {
      box.style.setProperty('--rs-hue',state.h);
      plane.style.setProperty('--rs-s',state.s*100+'%');
      plane.style.setProperty('--rs-v',(1-state.v)*100+'%');
      plane.setAttribute('aria-label','饱和度 '+Math.round(state.s*100)+'%，亮度 '+Math.round(state.v*100)+'%，使用方向键调整');
      hue.value=String(Math.round(state.h));hex.value=toHex(state);accept.disabled=false;
    }
    function dismiss(restoreFocus=false) {box.remove();trigger.setAttribute('aria-expanded','false');if(restoreFocus)trigger.focus();}
    function point(e) {
      const rect=plane.getBoundingClientRect();
      state.s=clamp((e.clientX-rect.left)/rect.width);state.v=1-clamp((e.clientY-rect.top)/rect.height);draw();
    }
    plane.addEventListener('pointerdown',e=>{if(e.button!==0)return;plane.setPointerCapture(e.pointerId);point(e);});
    plane.addEventListener('pointermove',e=>{if(plane.hasPointerCapture(e.pointerId))point(e);});
    plane.addEventListener('keydown',e=>{
      const steps={ArrowLeft:[-.01,0],ArrowRight:[.01,0],ArrowDown:[0,-.01],ArrowUp:[0,.01]};
      const step=steps[e.key];if(!step)return;e.preventDefault();state.s=clamp(state.s+step[0]);state.v=clamp(state.v+step[1]);draw();
    });
    hue.addEventListener('input',()=>{state.h=Number(hue.value);draw();});
    hex.addEventListener('input',()=>{const valid=/^#[0-9a-f]{6}$/i.test(hex.value);accept.disabled=!valid;if(valid){state=hsvFromHex(hex.value);draw();}});
    box.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();dismiss(true);}});
    box.addEventListener('click',e=>e.stopPropagation());
    for(const event of ['input','change'])box.addEventListener(event,e=>e.stopPropagation());
    box.querySelector('.rs-hsv-cancel').onclick=()=>dismiss(true);
    accept.onclick=()=>{const color=toHex(state);dismiss();apply(color);};
    draw();plane.focus({preventScroll:true});
    return {element:box,trigger,dismiss};
  }

  const skillIds = {
    '妆造复刻':'libtv-7efd8f0969b04bf391dc3589f8aebdc9',
    '人设定制造型':'libtv-2247c88d1ecc496abdd7d8246eead1bb',
  };
  function skillId(name) { return skillIds[name] || ''; }
  function skillTitle(name) {
    return window.CanvasFlowPublicSkillCatalog?.find(item=>item.id===skillIds[name])?.title || '';
  }
  window.CanvasFlowRoleStyling={mountColorPicker,skillId,skillTitle};
})();
