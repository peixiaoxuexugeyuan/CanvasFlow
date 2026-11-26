(() => {
  'use strict';
  const prefix = 'features.marks.';
  const key = prefix + 'items';
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const round = value => Math.round(value * 100) / 100;
  const angle = value => round(((value % 360 + 540) % 360) - 180);
  const fallback = {
    half: { x: .25, y: .25, width: .5, height: .5 },
    full: { x: .43, y: .065, width: .14, height: .13 },
  };

  function axis(value, start, length, target, span) {
    const end = start + length;
    if (value < start && start > 0) return target * value / start;
    if (value > end && end < 1) return target + span + (value - end) / (1 - end) * (1 - target - span);
    return target + (value - start) / length * span;
  }

  window.createRoleStudioMarks = function ({ host, presets, controls, setValue, getSlot, sources, legacySources=sources, faceBounds, surfaceFor, commit, changed, editable }) {
    let selected = '', drag = null, disposed = false, lastInput, lastItems;
    const bounds = new Map(), waiting = new Map(), retryAfter=new Map(), nodes = new Map();
    const surfaces=new Map(), surfaceRequests=new Map();
    function surface(url) {
      if (!url || !surfaceFor || disposed) return Promise.resolve(null);
      if (surfaces.has(url)) return Promise.resolve(surfaces.get(url));
      if (!surfaceRequests.has(url)) {
        surfaceRequests.set(url,surfaceFor(url).then(value=>{
          if(!disposed){surfaces.set(url,value);draw();}
          return value;
        }).catch(()=>null).finally(()=>surfaceRequests.delete(url)));
      }
      return surfaceRequests.get(url);
    }
    const view = () => getSlot() ? 'half' : 'full';
    const srcFor = item => item.preset === '自定义' ? item.src : presets[item.preset];
    const source = (name, images) => name === 'half' ? images[1] || images[0] : images[0] || images[1];
    const photo = host.closest('.rs-photo');
    let handled = null;
    const handleObserver = new ResizeObserver(positionHandles);
    handleObserver.observe(host);
    if (photo) handleObserver.observe(photo);
    window.addEventListener('scroll',positionHandles,true);

    function positionHandles() {
      if (!handled || host.hidden || !handled.isConnected || !photo) return;
      const rect=handled.getBoundingClientRect(), stage=photo.getBoundingClientRect();
      let left=Math.max(0,stage.left), top=Math.max(0,stage.top);
      let right=Math.min(document.documentElement.clientWidth,stage.right), bottom=Math.min(window.innerHeight,stage.bottom);
      for (let parent=photo.parentElement;parent;parent=parent.parentElement) {
        const css=getComputedStyle(parent);
        if (css.overflowX==='visible' && css.overflowY==='visible') continue;
        const box=parent.getBoundingClientRect();
        if (css.overflowX!=='visible') {left=Math.max(left,box.left);right=Math.min(right,box.right);}
        if (css.overflowY!=='visible') {top=Math.max(top,box.top);bottom=Math.min(bottom,box.bottom);}
      }
      const diameter=handled.querySelector('[data-mark-action=erase]').offsetWidth;
      if (!diameter || right-left<diameter || bottom-top<diameter) return;
      // Only the handles are clipped. The sticker and its rotation pivot retain their projected coordinates.
      function edges(start,end,low,high) {
        const margin=diameter/2, gap=Math.min(diameter+3,high-low-diameter);
        const center=(start+end)/2, half=Math.max(end-start,gap)/2;
        const near=clamp(center-half,low+margin,high-margin-gap);
        return [near-start,clamp(center+half,near+gap,high-margin)-start];
      }
      const [x1,x2]=edges(rect.left,rect.right,left,right), [y1,y2]=edges(rect.top,rect.bottom,top,bottom);
      for (const [name,value] of Object.entries({x1,x2,y1,y2})) handled.style.setProperty('--rs-handle-'+name,value+'px');
    }

    function observeHandles(node) {
      if (node!==handled) {
        if (handled) handleObserver.unobserve(handled);
        handled=node;
        if (handled) handleObserver.observe(handled);
      }
      positionHandles();
    }

    function items() {
      const values = controls();
      if (values[key]) {
        if (values[key] !== lastInput) {
          lastInput = values[key];
          try {
            const list = JSON.parse(lastInput);
            lastItems = Array.isArray(list) ? list.filter(item => item?.id && srcFor(item)).map(item => ({ view:'half', ...item })) : [];
          }
          catch { lastItems = []; }
        }
        return lastItems;
      }
      const preset = values[prefix + 'mark'];
      if (!preset) return [];
      const legacy = {
        id:'legacy', preset, view:values[prefix + 'view'] === 'full' ? 'full' : 'half',
        x:Number(values[prefix + 'x'] ?? 50), y:Number(values[prefix + 'y'] ?? 50),
        size:Number(values[prefix + 'size'] ?? (preset === '痣' ? 9 : 18)), turn:angle(Number(values[prefix + 'turn'] || 0)),
      };
      if (preset === '自定义') legacy.src = values[prefix + 'customImage'];
      return srcFor(legacy) ? [legacy] : [];
    }
    function write(list) {
      const state = controls();
      for (const id of ['mark','customImage','view','x','y','size','turn']) delete state[prefix + id];
      setValue(key, list.length ? JSON.stringify(list) : '');
    }
    function measure(url) {
      if (!url || !faceBounds || bounds.get(url) || (retryAfter.get(url)||0)>Date.now()) return Promise.resolve();
      if (!waiting.has(url)) {
        const pending = Promise.resolve().then(() => faceBounds(url)).then(box => {
          if(box?.width>0 && box.height>0){bounds.set(url,box);retryAfter.delete(url);}
          else retryAfter.set(url,Date.now()+3000);
        }).catch(() => retryAfter.set(url,Date.now()+3000)).finally(() => {
          waiting.delete(url);
          if (!disposed && !drag) draw();
        });
        waiting.set(url, pending);
      }
      return waiting.get(url);
    }
    // Older half-view stickers are stored against the original portrait, even on
    // roles whose current half view is a camera crop of their full photograph.
    function originUrl(view,images) {
      return source(view,view==='half'?legacySources():images);
    }
    function measureViews(list,destination,images,editing=false) {
      const urls=new Set([source(destination,images),...list.map(item=>originUrl(item.view,images))]);
      if(editing) urls.add(source('full',images)); // New stickers use the full portrait's coordinate space.
      return Promise.all([...urls].map(measure));
    }
    function frames(origin, destination, images) {
      const from = originUrl(origin,images), to = source(destination,images);
      if (from === to) return null;
      const full=source('full',images);
      return [bounds.get(from) || (from===full?fallback.full:fallback.half),
        bounds.get(to) || (to===full?fallback.full:fallback.half)];
    }
    function projected(item, destination, images, frame=frames(item.view,destination,images)) {
      if (!frame) return { x:item.x, y:item.y, size:item.size };
      const [a,b] = frame;
      return {
        x:100 * axis(item.x / 100, a.x, a.width, b.x, b.width),
        y:100 * axis(item.y / 100, a.y, a.height, b.y, b.height),
        size:item.size * b.width / a.width,
      };
    }
    function movedPosition(x,y,frame) {
      x=clamp(x,0,100); y=clamp(y,0,100);
      if (!frame) return {x:round(x),y:round(y)};
      const [a,b]=frame;
      return {x:round(100*axis(x/100,b.x,b.width,a.x,a.width)),
        y:round(100*axis(y/100,b.y,b.height,a.y,a.height))};
    }
    function makeNode(item) {
      const layer = document.createElement('div');
      layer.className = 'rs-mark';
      layer.dataset.markId = item.id;
      layer.setAttribute('role', 'group');
      layer.setAttribute('aria-label', item.preset + '贴图');
      layer.innerHTML = '<img draggable="false" alt=""><button type="button" data-mark-action="rotate" title="旋转" aria-label="旋转">↻</button><button type="button" data-mark-action="erase" title="删除" aria-label="删除">×</button><span class="rs-resize" data-mark-action="resize" role="slider" tabindex="0" aria-label="缩放特征" aria-valuemin="3" aria-valuemax="80"></span>';
      nodes.set(item.id, layer);
      layer.firstElementChild.addEventListener('load',draw);
      return layer;
    }
    function draw() {
      if (disposed) return;
      const list = items(), images = sources(), destination = view();
      if (!list.some(item => item.id === selected)) selected = list.at(-1)?.id || '';
      const remaining = new Set(list.map(item => item.id));
      for (const [id, node] of nodes) if (!remaining.has(id)) { node.remove(); nodes.delete(id); }
      if (host.hidden) { observeHandles(null); return; }
      for (const [index, item] of list.entries()) {
        const node = nodes.get(item.id) || makeNode(item);
        const p = drag?.id===item.id ? projected(item,destination,images,drag.frame) : projected(item,destination,images);
        const graphic = node.firstElementChild;
        if (graphic.getAttribute('src') !== srcFor(item)) graphic.src = srcFor(item);
        const editing = editable();
        node.classList.toggle('rs-mark-interactive', editing);
        node.classList.toggle('rs-mark-editing', editing && selected === item.id);
        node.tabIndex = editing ? 0 : -1;
        node.style.left = p.x + '%'; node.style.top = p.y + '%'; node.style.width = p.size + '%';
        node.style.zIndex = String(index + 1);
        node.style.setProperty('--turn', item.turn + 'deg');
        const imageUrl=source(destination,images), mesh=surfaces.get(imageUrl);
        if(mesh && graphic.complete && graphic.naturalWidth) {
          const renderKey=JSON.stringify([imageUrl,graphic.src,p.x,p.y,p.size,item.turn]);
          if(node.dataset.surfaceKey!==renderKey){
            node.querySelector('.rs-projected-mark')?.remove();
            const result=window.CanvasFlowMarkSurface.warp(mesh,graphic,p,item.turn);
            graphic.style.opacity=result?'0':'';
            if(result){
              result.bitmap.className='rs-projected-mark';
              result.bitmap.style.width=(result.ratio*100)+'%';
              node.append(result.bitmap);
            }
            node.dataset.surfaceKey=renderKey;
          }
        } else {
          delete node.dataset.surfaceKey;
          node.querySelector('.rs-projected-mark')?.remove();graphic.style.opacity='';
        }
        const resize=node.querySelector('.rs-resize'), ratio=p.size/item.size;
        resize.setAttribute('aria-valuemin',String(round(3*ratio)));
        resize.setAttribute('aria-valuemax',String(round(80*ratio)));
        resize.setAttribute('aria-valuenow',String(round(p.size)));
        resize.setAttribute('aria-valuetext',round(p.size)+'%');
        if (!node.isConnected) host.append(node);
      }
      observeHandles(editable() ? nodes.get(selected) : null);
    }
    function update(visible) {
      host.hidden = !visible;
      if (!visible) { draw(); return; }
      const list=items(), editing=editable();
      if (editing || list.length) {
        const images = sources();
        if(list.length)void surface(source(view(),images));
        void measureViews(list,view(),images,editing);
      }
      draw();
    }
    async function add(preset, src) {
      const images=sources(), current='full';
      await measureViews([],view(),images,true);
      if(disposed) return;
      const face=bounds.get(source(current,images)) || fallback.full;
      const item = { id:crypto.randomUUID(), preset, view:current, x:round(100 * (face.x + face.width / 2)), y:round(100 * (face.y + face.height / 2)),
        size:round(clamp((preset === '痣' ? 25 : 50) * face.width, 3, 80)), turn:0 };
      if (src) item.src = src;
      selected = item.id;
      write([...items(), item]);
    }
    function select(id) {
      const list = items(), item = list.find(row => row.id === id);
      if (!item) return;
      selected = id;
      if (list.at(-1)?.id !== id) write([...list.filter(row => row.id !== id), item]);
      draw();
      return item;
    }
    function remove(id) {
      const list = items().filter(row => row.id !== id);
      selected = list.at(-1)?.id || '';
      write(list); changed(); commit();
    }
    function change(id, patch) {
      write(items().map(row => row.id === id ? { ...row, ...patch } : row));
      draw();
    }
    host.addEventListener('pointerdown', event => {
      const node = event.target.closest('[data-mark-id]');
      const action = event.target.closest('[data-mark-action]')?.dataset.markAction;
      if (!editable() || !node || action === 'erase' || event.button !== 0) return;
      const item = select(node.dataset.markId);
      if (!item) return;
      const area = host.getBoundingClientRect(), box = node.getBoundingClientRect();
      const center = { x:box.left + box.width / 2, y:box.top + box.height / 2 };
      const images=sources(), frame=frames(item.view,view(),images);
      const p = projected(item, view(), images,frame);
      drag = { id:item.id, pointer:event.pointerId, x:event.clientX, y:event.clientY, center, area, p, frame, size:item.size, turn:item.turn, action,
        radius:Math.max(1, Math.hypot(event.clientX-center.x,event.clientY-center.y)),
        start:Math.atan2(event.clientY-center.y,event.clientX-center.x) };
      host.setPointerCapture(event.pointerId);
      node.focus({preventScroll:true}); event.preventDefault();
    });
    host.addEventListener('pointermove', event => {
      if (!drag || drag.pointer !== event.pointerId || !editable()) return;
      const { center, area, p } = drag;
      let patch = {};
      if (drag.action === 'resize') patch.size = round(clamp(drag.size * Math.hypot(event.clientX-center.x,event.clientY-center.y) / drag.radius, 3, 80));
      else if (drag.action === 'rotate') patch.turn = angle(drag.turn + (Math.atan2(event.clientY-center.y,event.clientX-center.x) - drag.start) * 180 / Math.PI);
      else {
        patch = movedPosition(p.x + (event.clientX - drag.x) / area.width * 100,
          p.y + (event.clientY - drag.y) / area.height * 100, drag.frame);
      }
      change(drag.id,patch);
    });
    host.addEventListener('lostpointercapture', () => { if (drag) { drag = null; changed(); commit(); } });
    host.addEventListener('click', event => {
      const node = event.target.closest('[data-mark-id]');
      if (!node || !editable()) return;
      const action = event.target.closest('[data-mark-action]')?.dataset.markAction;
      if (action === 'erase') remove(node.dataset.markId);
      if (action === 'rotate' && event.detail === 0) {
        const item = select(node.dataset.markId); change(item.id,{turn:angle(item.turn + 15)}); commit();
      }
    });
    host.addEventListener('keydown', event => {
      const node = event.target.closest('[data-mark-id]');
      if (!node || !editable()) return;
      const resize = event.target.matches('.rs-resize');
      if (event.target !== node && !resize) return;
      if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Delete','Backspace',' ','Enter'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const item = select(node.dataset.markId);
      if (event.key === 'Delete' || event.key === 'Backspace') return remove(item.id);
      if (event.key.startsWith('Arrow')) {
        const step = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
        if (resize) change(item.id, { size:round(clamp(item.size + step,3,80)) });
        else {
          const images=sources(), frame=frames(item.view,view(),images), p=projected(item,view(),images,frame);
          const horizontal = event.key === 'ArrowLeft' || event.key === 'ArrowRight';
          change(item.id,movedPosition(p.x+(horizontal?step:0),p.y+(horizontal?0:step),frame));
        }
      }
      commit();
    });
    async function composite(destination=view(), appearance=null, images=sources()) {
      const list = items();
      if (!list.length && !appearance) return null;
      const base = source(destination, images);
      if (!base) return null;
      const load = async url => { const img = new Image(); img.crossOrigin='anonymous'; img.src=url; await img.decode(); return img; };
      const [person,stickers] = await Promise.all([appearance || load(base),Promise.all(list.map(item=>load(srcFor(item)))),
        list.length && measureViews(list,destination,images)]);
      const canvas = document.createElement('canvas'), scale = Math.min(1,1024 / Math.max(person.width,person.height));
      canvas.width = Math.max(1,Math.round(person.width*scale)); canvas.height = Math.max(1,Math.round(person.height*scale));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.drawImage(person,0,0,canvas.width,canvas.height);
      const mesh=list.length ? await surface(base) : null;
      list.forEach((item,index) => {
        const p = projected(item,destination,images), width = p.size / 100 * canvas.width;
        const warped=mesh && window.CanvasFlowMarkSurface.warp(mesh,stickers[index],p,item.turn);
        if(warped){
          const extent=width*warped.ratio;
          ctx.drawImage(warped.bitmap,canvas.width*p.x/100-extent/2,canvas.height*p.y/100-extent/2,extent,extent);
          return;
        }
        const height = width * stickers[index].height / stickers[index].width;
        ctx.save(); ctx.translate(canvas.width*p.x/100,canvas.height*p.y/100); ctx.rotate(item.turn*Math.PI/180);
        ctx.drawImage(stickers[index],-width/2,-height/2,width,height); ctx.restore();
      });
      const label=list.length?'角色原图上已定位的特征（'+list.map(i=>i.preset).join('、')+'），保留各层的位置、大小、方向与叠放顺序。':'角色的局部外观调整';
      return {url:canvas.toDataURL('image/jpeg',.94),label:label+(appearance?' 保持参考图中的脸部与身材比例、局部颜色和妆效。':'')};
    }
    function describe(format) {
      return items().map(item => {
        const view = item.view === 'half' ? '半身' : '全身';
        return format ? format(item, view) : item.preset + '位于' + view + '图横向' + item.x + '%、纵向' + item.y + '%，宽' + item.size + '%，旋转' + item.turn + '°';
      });
    }
    function destroy() {
      disposed=true; handled=null; handleObserver.disconnect();
      window.removeEventListener('scroll',positionHandles,true);
    }
    return { add, update, refresh:draw, composite, describe, current:() => items().find(item=>item.id===selected)?.preset || items().at(-1)?.preset || '', destroy };
  };
})();
