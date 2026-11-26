(() => {
  'use strict';
  const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
  const mix = (a, b, t=.5) => ({x:a.x+(b.x-a.x)*t, y:a.y+(b.y-a.y)*t});
  const dist = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
  const angle = (a,b) => Math.atan2(b.y-a.y,b.x-a.x);

  let worker, idleTimer, requestId = 0;
  const pending = new Map();
  function stopWorker() {
    worker?.terminate();
    worker = null;
    for (const {reject} of pending.values()) reject(new Error('关键点检测已停止'));
    pending.clear();
  }
  async function landmarks(source, body) {
    clearTimeout(idleTimer);
    const bitmap = await createImageBitmap(source);
    try {
      if (!worker) {
        worker = new Worker('role-studio-landmarks.js');
        worker.onmessage = ({data}) => {
          const entry = pending.get(data.id);
          pending.delete(data.id);
          if (entry) data.error ? entry.reject(new Error(data.error)) : entry.resolve(data.result);
          if (!pending.size) idleTimer = setTimeout(stopWorker, 45000);
        };
        worker.onerror = stopWorker;
      }
      const id = ++requestId;
      return await new Promise((resolve, reject) => {
        pending.set(id, {resolve, reject});
        try { worker.postMessage({id, image:bitmap, body}, [bitmap]); }
        catch (error) { pending.delete(id); reject(error); }
      });
    } finally { bitmap.close(); }
  }

  function settings(controls) {
    const values = [];
    for (const mode of window.CanvasFlowRoleModes || []) {
      if (mode.id !== 'face' && mode.id !== 'body') continue;
      for (const tab of mode.tabs) for (const f of tab.fields) {
        const prefix=[mode.id,tab.id,''].join('.');
        if (f.display==='cards' && (tab.id==='makeup' || f.label==='眼神光')) {
          const id=controls?.[prefix+f.id];
          if(id && id!=='无'){
            const color=tab.fields.find(field=>field.id===f.id+'Color');
            const strength=tab.fields.find(field=>field.id===f.id+'Strength');
            const n=strength?clamp(Number(controls[prefix+strength.id]??strength.default)/100,0,1):1;
            const details={};
            if(f.label==='眼神光') for(const option of tab.fields.filter(item=>item.activeWhen?.id===f.id)){
              details[option.label]=option.read ? option.read(controls) : controls[prefix+option.id]??option.default;
            }
            const lightOff=f.label==='眼神光'&&!Number(details['眼神光程度（左）'])&&!Number(details['眼神光程度（右）']);
            if(n && !lightOff) values.push({mode:'face',name:f.label,n,material:f.labels?.[id]||id,
              details,variant:Math.max(0,f.options.indexOf(id)-1),total:f.options.length-1,card:f.images?.[id],
              color:color?.colors[controls[prefix+color.id]??color.default]});
          }
          continue;
        }
        if(f.activeWhen) continue; // The selected material reads its dependent sliders and colors together.
        if (!['range','switch'].includes(f.type) || f.generationOnly || f.hint?.includes('不支持预览')) continue;
        const value = controls?.[[mode.id,tab.id,f.id].join('.')];
        const n = f.type === 'switch' ? Number(value === true) : clamp((Number(value ?? f.default)-Number(f.default||0))/100,-1,1);
        if (!Number.isFinite(n) || !n) continue;
        const side = f.label.match(/(?:[（(-])([左右])[）)]?$/);
        const name = f.label.slice(0, side ? side.index : undefined).replace(/\s+/g,'');
        values.push({mode:mode.id, name, side:side?.[1], n});
      }
    }
    return values;
  }

  const colors = {
    '琥珀':'#ad7742','橄榄绿':'#708360','混血灰':'#8e959c','灰粉':'#aa9194','烟花紫':'#837395',
    '摩卡棕':'#765448','亚麻灰':'#999387','金星棕':'#ac8a5a','黑瞳':'#292324','黑边':'#342b2a',
    '红宝石':'#914148','深棕':'#654634','金珀':'#c59a61','珊瑚粉':'#e78780','裸粉':'#bd757c',
    '蜜桃':'#e48c84','樱桃':'#b43a4c','南瓜':'#bd663f','亮橘':'#e35a43','正红':'#bd2638',
    '西柚':'#db665c','浆果':'#84324d','豆沙粉':'#b06d73','玫瑰':'#ad4d65','火龙果':'#be3c71',
    '果冻':'#df7181','裸棕':'#a46c66','砖红':'#a5483d','车厘子':'#76243d','玫红':'#c14a74',
  };
  const materialSamples=new Map();
  async function sampleMaterial(item) {
    if(!item.card || !['眉毛','眼影'].includes(item.name)) return item;
    const key=item.card+'|'+(item.color||'');
    if(!materialSamples.has(key)) materialSamples.set(key,(async()=>{
      const image=new Image();image.src=item.card;await image.decode();
      const source=document.createElement('canvas');source.width=100;source.height=100;
      const ctx=source.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,100,100);
      const data=ctx.getImageData(0,0,100,100), rgb=data.data;
      if(item.name==='眉毛'){
        let x0=100,x1=0,y0=100,y1=0;
        const tint=parseInt((item.color||'#513c33').slice(1),16);
        for(let x=0;x<100;x++){
          const background=(rgb[x*4]+rgb[x*4+1]+rgb[x*4+2])/3;
          for(let y=8;y<92;y++){
            const i=(100*y+x)*4;
            const a=clamp((background-(rgb[i]+rgb[i+1]+rgb[i+2])/3-9)/(background*.83),0,1);
            rgb[i]=tint>>16;rgb[i+1]=(tint>>8)&255;rgb[i+2]=tint&255;rgb[i+3]=Math.round(a*255);
            if(a>.09){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
          }
        }
        if(x0>=x1||y0>=y1)return {};
        ctx.putImageData(data,0,0);
        const brow=document.createElement('canvas');brow.width=x1-x0+1;brow.height=y1-y0+1;
        brow.getContext('2d').drawImage(source,x0,y0,brow.width,brow.height,0,0,brow.width,brow.height);
        return {brow};
      }
      const base=[0,0,0],tone=[0,0,0];
      for(let x=27;x<74;x++)for(let y=28;y<40;y++) for(let k=0;k<3;k++){
        base[k]+=rgb[(5*100+x)*4+k];
        tone[k]+=rgb[(y*100+x)*4+k];
      }
      const shadow='#'+tone.map((v,k)=>Math.round(clamp(255*v/Math.max(1,base[k])-13,40,240)).toString(16).padStart(2,'0')).join('');
      return {shadow};
    })().catch(()=>{materialSamples.delete(key);return {};}));
    return {...item,...await materialSamples.get(key)};
  }
  function drawMakeup(ctx, points, materials, effects) {
    if(!materials.length || !points) return;
    // Attach color and strokes to the edited geometry when a face slider and material coexist.
    const warped=points.map(p=>{
      let x=p.x,y=p.y;
      for(const {c,rx,ry,a,props} of effects){
        const cos=Math.cos(a),sin=Math.sin(a),dx=p.x-c.x,dy=p.y-c.y;
        const u=dx*cos+dy*sin,v=-dx*sin+dy*cos,r=(u/rx)**2+(v/ry)**2;
        if(r>=1) continue;
        const weight=(1-r)**2,tx=(props.tx||0)+(props.sx||0)*u-(props.turn||0)*v,ty=(props.ty||0)+(props.sy||0)*v+(props.turn||0)*u;
        x+=(tx*cos-ty*sin)*weight;y+=(tx*sin+ty*cos)*weight;
      }
      return {x,y};
    });
    const p=i=>warped[i], w=dist(p(234),p(454)), rot=angle(p(33),p(263));
    const path=(ids,close=true)=>{
      ids.forEach((id,i)=>{const q=p(id);if(i)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y);});
      if(close) ctx.closePath();
    };
    const spot=(c,rx,ry,color)=>{
      ctx.save();ctx.translate(c.x,c.y);ctx.rotate(rot);ctx.scale(rx,ry);
      const g=ctx.createRadialGradient(0,0,0,0,0,1);g.addColorStop(0,color);g.addColorStop(1,color+'00');
      ctx.fillStyle=g;ctx.fillRect(-1,-1,2,2);ctx.restore();
    };
    const eyes=[
      {sign:-1,outer:33,inner:133,top:159,lower:145,iris:468,cheek:116,
        brow:[70,63,105,66,107,55,65,52,53,46],line:[33,246,161,160,159,158,157,173,133],lowerLine:[155,154,153,145,144,163,7]},
      {sign:1,outer:263,inner:362,top:386,lower:374,iris:473,cheek:345,
        brow:[300,293,334,296,336,285,295,282,283,276],line:[263,466,388,387,386,385,384,398,362],lowerLine:[382,381,380,374,373,390,249]},
    ];
    for(const {name,n,material,variant,total,color,details,brow:browTexture,shadow} of materials){
      ctx.save();
      ctx.globalAlpha=n;
      const variation=variant/Math.max(1,total-1);
      if(name==='唇彩'){
        ctx.beginPath();path([61,40,37,0,267,270,291,321,314,17,84,91]);path([78,81,13,311,308,402,14,178]);
        ctx.globalCompositeOperation='multiply';ctx.globalAlpha=n*.77;ctx.fillStyle=colors[material]||'#be6272';ctx.fill('evenodd');
      }else if(name==='高光'){
        ctx.globalCompositeOperation='screen';ctx.globalAlpha=n*.55;
        const regions={'眼下提亮':[116,345],'丰润':[50,280,17],'平整':[9,4,152],'盈润':[50,280,4],
          '丰盈':[50,280,17,152],'笔挺':[168,197,4],'透亮':[9,116,345,4],'水光':[50,280,4,0],'小灯泡':[9,168,4,50,280,152]};
        for(const i of regions[material]||[168,4,50,280])spot(p(i),w*(i===168?.053:.1+.026*variation),w*(i===168?.14:.048+.025*variation),'#f5d2ae');
      }else{
        for(const eye of eyes){
          const iris=p(eye.iris)||mix(p(eye.inner),p(eye.outer)), eyeWidth=dist(p(eye.outer),p(eye.inner));
          const brow=eye.brow, sign=eye.sign;
          ctx.save();ctx.lineCap='round';ctx.lineJoin='round';
          switch(name){
            case '眉毛':
              if(browTexture){
                const inner=p(brow[4]),outer=p(brow[0]),mid=mix(inner,outer),span=dist(inner,outer)*1.18;
                ctx.translate(mid.x,mid.y);ctx.rotate(sign>0?angle(inner,outer):angle(outer,inner));
                ctx.scale(sign,1);ctx.globalAlpha=n*.89;
                const h=span*browTexture.height/browTexture.width;
                ctx.drawImage(browTexture,-span/2,-h/2,span,h);break;
              }
              ctx.beginPath();path(brow);ctx.globalCompositeOperation='multiply';ctx.globalAlpha=n*(.47+.15*variation);
              ctx.fillStyle=color||'#564038';ctx.fill();break;
            case '美瞳': case '眼神光': {
              ctx.beginPath();path([...eye.line,...eye.lowerLine]);ctx.clip();
              const r=p(eye.iris+1)?dist(iris,p(eye.iris+1)):eyeWidth*.2;
              if(name==='美瞳'){
                ctx.beginPath();ctx.arc(iris.x,iris.y,r,0,Math.PI*2);ctx.arc(iris.x,iris.y,r*.43,0,Math.PI*2,true);
                ctx.fillStyle=colors[material]||'#936a4a';ctx.globalAlpha=n*.72;ctx.fill('evenodd');
              }else{
                const side=sign>0?'（左）':'（右）', option=label=>Number(details['眼神光'+label+side]||0)/100;
                const flip=details['眼神光水平翻转'+side]?-1:1;
                const radius=r*(.8+.8*option('缩放'));
                ctx.translate(iris.x+r*.65*option('水平位置'),iris.y+r*.65*option('垂直位置'));
                ctx.rotate(rot+option('旋转')*1.5*Math.PI);ctx.scale(flip,1);
                ctx.fillStyle='#fff9eb';ctx.globalAlpha=n*clamp(option('程度'),0,1);
                ctx.beginPath();ctx.arc(-r*.34,-r*.36,radius*(.18+.12*variation),0,Math.PI*2);ctx.fill();
                if(variant%2)spot({x:r*.32,y:r*.28},radius*.17,radius*.17,'#ffffff');
              }
              break;
            }
            case '卧蚕':
              ctx.globalCompositeOperation='screen';ctx.globalAlpha=n*.55;
              spot(mix(p(eye.lower),p(eye.cheek),.16),eyeWidth*.57,eyeWidth*(.1+.08*variation),'#edc4ab');break;
            case '眼影':
              ctx.globalCompositeOperation='multiply';ctx.globalAlpha=n*.65;
              spot(mix(p(eye.top),p(brow[2]),.45),eyeWidth*(.65+.1*variation),eyeWidth*.31,
                shadow||'#b48076');break;
            case '眼线': {
              ctx.strokeStyle=color||'#3a292b';ctx.globalAlpha=n*.85;ctx.lineWidth=eyeWidth*(.027+.035*variation);
              ctx.beginPath();path(eye.line,false);ctx.stroke();
              const corner=p(eye.outer);
              ctx.beginPath();ctx.moveTo(corner.x,corner.y);
              ctx.lineTo(corner.x+sign*eyeWidth*(.07+.13*variation),corner.y-eyeWidth*.08);ctx.stroke();break;
            }
            case '睫毛':
              ctx.strokeStyle='#34282a';ctx.globalAlpha=n*.87;ctx.lineWidth=Math.max(.6,eyeWidth*.018);
              for(let i=1;i<eye.line.length-1;i++){
                const at=p(eye.line[i]);ctx.beginPath();ctx.moveTo(at.x,at.y);
                ctx.quadraticCurveTo(at.x+sign*eyeWidth*.04,at.y-eyeWidth*.03,
                  at.x+sign*eyeWidth*(.045+.038*variation),at.y-eyeWidth*(.09+.09*variation));ctx.stroke();
              }break;
            case '修容':
              ctx.globalCompositeOperation='multiply';ctx.globalAlpha=n*.5;
              spot(mix(p(eye.cheek),p(sign>0?397:172),.52),w*.155,w*(.17+.05*variation),'#9d7560');break;
            case '腮红':
              ctx.globalCompositeOperation='multiply';ctx.globalAlpha=n*.73;
              spot(mix(p(eye.cheek),p(sign>0?425:205),.28+.4*variation),w*(.16+.04*variation),w*.115,color||'#dc8990');break;
            case '妆饰': {
              const c=p(eye.cheek);
              if(material.includes('钻')){
                spot(c,w*.013,w*.021,'#ffffff');
              }else{
                ctx.fillStyle='#875840';ctx.globalAlpha=n*.65;
                for(let k=0;k<15;k++){
                  const x=Math.sin(k*14.1+variant)*w*.1,y=Math.cos(k*8.7+variant)*w*.055;
                  ctx.beginPath();ctx.arc(c.x+x,c.y+y,w*(.0025+.002*(k%3)),0,Math.PI*2);ctx.fill();
                }
              }break;
            }
          }
          ctx.restore();
        }
      }
      ctx.restore();
    }
  }

  function faceEffects(points, values, add) {
    if (!points || points.length < 468) return false;
    const p = i => points[i];
    const w = dist(p(234),p(454)), h = dist(p(10),p(152)), tilt = angle(p(33),p(263));
    const eyeSpan = dist(p(33),p(263));
    const noseAxis = ((p(1).x-p(33).x)*Math.cos(tilt)+(p(1).y-p(33).y)*Math.sin(tilt))/eyeSpan;
    if (w < 18 || h < 24 || noseAxis < .17 || noseAxis > .83 || eyeSpan/w < .42) return false;
    const dir = (center,rx,ry,props) => add(center, w*rx, h*ry, tilt, props);
    const skin = mix(p(10),p(152),.52), lips=mix(p(61),p(291));
    // Positive and negative values follow the subject's anatomical axes, also for a tilted face.
    for (const {name,side,n} of values) {
      const fl = (c,rx,ry,props) => dir(c,rx,ry,Object.fromEntries(Object.entries(props).map(([k,v])=>[k,v*n])));
      const moveY = (c,rx,ry,delta) => fl(c,rx,ry,{ty:h*delta});
      switch (name) {
        case '质感磨皮': fl(skin,.53,.54,{smooth:.86}); break;
        case '皮肤纹理（脸部）': fl(skin,.53,.54,{smooth:-.95}); break;
        case '皮肤透亮': fl(skin,.53,.55,{light:23}); break;
        case '皮肤红润': fl(skin,.51,.53,{rosy:25}); break;
        case '皮肤美白': fl(skin,.54,.55,{light:33,smooth:.12}); break;
        case '山根': fl(p(168),.14,.17,{sy:.36,light:8}); break;
        case '鼻梁': fl(mix(p(168),p(1)),.14,.22,{sx:-.44,light:10}); break;
        case '鼻尖': moveY(p(1),.16,.115,-.035); break;
        case '鼻子长短': moveY(p(2),.2,.2,.06); break;
        case '鼻子大小': fl(p(4),.26,.23,{sx:.55,sy:.38}); break;
        case '鼻翼': fl(mix(p(98),p(327)),.24,.14,{sx:.6}); break;
        case '嘴巴上下': moveY(lips,.28,.15,-.045); break;
        case '丰下唇': moveY(p(17),.22,.085,.027); break;
        case '嘴巴宽度': fl(lips,.32,.13,{sx:.51}); break;
        case '丰唇': fl(lips,.26,.13,{sy:.72}); break;
        case '嘴角调整': for(const i of [61,291]) moveY(p(i),.115,.095,-.029); break;
        case '嘴巴倾斜': fl(lips,.29,.17,{turn:.21}); break;
        case '嘴巴大小': fl(lips,.32,.19,{sx:.5,sy:.4}); break;
        case '丰上唇': moveY(p(0),.22,.085,-.025); break;
        case '唇妆增强': fl(lips,.22,.077,{rosy:40,light:-8}); break;
        case '额头': moveY(mix(p(10),p(168),.12),.48,.28,-.054); break;
        case 'V脸':
          for(const [i,s] of [[172,1],[397,-1]]) fl(p(i),.31,.24,{tx:s*w*.075});
          break;
        case '小脸': fl(skin,.8,.72,{sx:-.35,sy:-.2}); break;
        case '脸部宽度': fl(skin,.84,.62,{sx:.37}); break;
        case '下巴高度': moveY(p(152),.34,.25,.062); break;
        case '中庭': moveY(p(1),.43,.3,.052); break;
        case '下庭': moveY(mix(lips,p(152),.62),.48,.31,.06); break;
        case '人中': moveY(mix(p(2),p(0),.62),.19,.14,.026); break;
        default:
          for(const left of (side ? [side==='左'] : [false,true])) {
            const sign=left?1:-1;
            const eye=mix(p(left?263:33),p(left?362:133)), brow=p(left?334:105);
            switch(name) {
              case '亮眼': fl(eye,.145,.067,{light:35}); break;
              case '眼睛大小': fl(eye,.205,.125,{sx:.53,sy:.7}); break;
              case '眼宽': fl(eye,.205,.125,{sx:.65}); break;
              case '眼高': fl(eye,.18,.115,{sy:.82}); break;
              case '眼距': fl(eye,.22,.14,{tx:sign*w*.045}); break;
              case '眼睑': moveY(p(left?386:159),.16,.085,-.022); break;
              case '眼睛倾斜': fl(eye,.2,.12,{turn:-sign*.28}); break;
              case '开眼角': fl(p(left?362:133),.1,.08,{tx:-sign*w*.029}); break;
              case '眼睛上下': moveY(eye,.2,.125,-.037); break;
              case '眉毛间距': fl(brow,.22,.11,{tx:sign*w*.044}); break;
              case '眉毛上下': moveY(brow,.21,.105,-.04); break;
              case '眉峰': moveY(brow,.11,.08,-.03); break;
              case '眉毛粗细': fl(brow,.2,.09,{sy:.79}); break;
              case '眉毛倾斜': fl(brow,.23,.105,{turn:-sign*.24}); break;
              case '眉毛增强': fl(brow,.2,.059,{light:-22,smooth:-.45}); break;
              case '下颌': fl(p(left?397:172),.31,.24,{tx:sign*w*.07}); break;
              case '颧骨': fl(p(left?352:123),.24,.18,{tx:sign*w*.057}); break;
              case '太阳穴': fl(p(left?356:127),.23,.2,{tx:sign*w*.048}); break;
            }
          }
      }
    }
    return true;
  }

  function bodyEffects(points, values, add, width, height) {
    if (!points || points.length < 33) return;
    const p=i=>points[i];
    const visible=(...ids)=>ids.every(i=>p(i).visibility>=.5 && p(i).x>=0 && p(i).x<width && p(i).y>=0 && p(i).y<height);
    if (!visible(11,12)) return;
    const s=mix(p(12),p(11)), base=dist(p(12),p(11)), turn=angle(p(12),p(11));
    if(base<19 || Math.abs(turn) > .65) return;
    const hip=mix(p(24),p(23)), torso=dist(s,hip), knees=mix(p(25),p(26)), ankles=mix(p(27),p(28));
    for(const {name,n} of values){
      const patch=(c,rx,ry,props,a=turn)=>add(c,rx,ry,a,Object.fromEntries(Object.entries(props).map(([k,v])=>[k,v*n])));
      if(name==='肩膀宽度' || name==='直角肩'){
        for(const [i,sign] of [[11,1],[12,-1]]) patch(p(i),base*.4,base*.34,name==='直角肩'?{ty:-base*.075}:{tx:sign*base*.11});
      }else if(name==='小头' && visible(0,7,8)){
        const head=mix(p(7),p(8)), size=Math.max(base*.21,dist(p(7),p(8))*.8);
        patch(head,size*1.6,size*2.1,{sx:-.38,sy:-.32});
      }else if(name==='瘦手臂'){
        for(const [sh,el] of [[11,13],[12,14]]) if(visible(sh,el))
          patch(mix(p(sh),p(el)),base*.22,dist(p(sh),p(el))*.7,{sx:-.59},angle(p(sh),p(el))-Math.PI/2);
      }else if(visible(23,24) && torso>base*.5 && hip.y>s.y){
        switch(name){
          case '丰胸': patch(mix(s,hip,.28),base*.58,torso*.29,{sx:.33,sy:.24}); break;
          case '瘦身': patch(mix(s,hip),base*.84,torso*.85,{sx:-.42}); break;
          case '瘦肚子': patch(mix(s,hip,.66),base*.63,torso*.36,{sx:-.46}); break;
          case '美腰': patch(mix(s,hip,.58),base*.72,torso*.39,{sx:-.55}); break;
          case '美臀': patch(hip,base*.65,torso*.38,{sx:.39,ty:-base*.02}); break;
          case '瘦腿':
            for(const [hi,kn] of [[23,25],[24,26]]) if(visible(hi,kn))
              patch(mix(p(hi),p(kn)),base*.25,dist(p(hi),p(kn))*.66,{sx:-.55},angle(p(hi),p(kn))-Math.PI/2);
            break;
          case '长腿': case 'AI增高':
            if(visible(25,26,27,28) && ankles.y>knees.y && knees.y>hip.y){
              const leg=dist(hip,ankles);
              patch(hip,base*.85,leg*.68,{ty:-leg*.09});
              patch(knees,base*.78,leg*.48,{ty:-leg*.047});
              if(name==='AI增高') patch(s,base*1.04,torso*.9,{ty:-torso*.09});
            }
            break;
        }
      }
    }
  }

  function photo(image, longestEdge = 960) {
    const scale = Math.min(1, longestEdge/Math.max(image.naturalWidth,image.naturalHeight));
    const source = document.createElement('canvas');
    source.width = Math.max(1,Math.round(image.naturalWidth*scale));
    source.height = Math.max(1,Math.round(image.naturalHeight*scale));
    const ctx=source.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(image,0,0,source.width,source.height);
    return {source, detections:{}};
  }
  function softened(frame) {
    if(frame.soft) return frame.soft;
    const {width,height}=frame.source;
    const copy=document.createElement('canvas');
    copy.width=width;copy.height=height;
    const ctx=copy.getContext('2d',{willReadFrequently:true});
    ctx.filter='blur('+Math.max(1,Math.min(width,height)*.003)+'px)';
    ctx.drawImage(frame.source,0,0);
    return frame.soft=ctx.getImageData(0,0,width,height).data;
  }

  // Accumulate inverse displacement and local color corrections on a four-pixel grid.
  // Bilinear sampling preserves detail, and the compact masks leave distant pixels unchanged.
  function paint(canvas, frame, effects) {
    const {width:w,height:h}=frame.source, step=4, cols=Math.ceil(w/step)+1, rows=Math.ceil(h/step)+1;
    if(canvas.width!==w) canvas.width=w;
    if(canvas.height!==h) canvas.height=h;
    const ctx=canvas.getContext('2d');
    if(!effects.length){
      ctx.clearRect(0,0,w,h);
      ctx.drawImage(frame.source,0,0);
      return;
    }
    const stride=5, field=new Float32Array(cols*rows*stride);
    let xmin=w,ymin=h,xmax=0,ymax=0,needsSoft=false;
    for(const {c,rx,ry,a,props} of effects){
      const {tx=0,ty=0,sx=0,sy=0,turn=0,smooth=0,light=0,rosy=0}=props;
      const cos=Math.cos(a),sin=Math.sin(a),extentX=Math.hypot(rx*cos,ry*sin),extentY=Math.hypot(rx*sin,ry*cos);
      const x0=clamp(Math.floor((c.x-extentX)/step),0,cols-1),x1=clamp(Math.ceil((c.x+extentX)/step),0,cols-1);
      const y0=clamp(Math.floor((c.y-extentY)/step),0,rows-1),y1=clamp(Math.ceil((c.y+extentY)/step),0,rows-1);
      xmin=Math.min(xmin,x0*step); xmax=Math.max(xmax,x1*step);
      ymin=Math.min(ymin,y0*step); ymax=Math.max(ymax,y1*step);
      needsSoft ||= !!smooth;
      for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
        const dx=x*step-c.x,dy=y*step-c.y,lx=dx*cos+dy*sin,ly=-dx*sin+dy*cos;
        const radius=(lx/rx)**2+(ly/ry)**2;
        if(radius>=1) continue;
        const weight=(1-radius)**2,localX=tx+sx*lx-turn*ly,localY=ty+sy*ly+turn*lx;
        const i=(y*cols+x)*stride;
        field[i]+=(cos*localX-sin*localY)*weight;
        field[i+1]+=(sin*localX+cos*localY)*weight;
        field[i+2]+=weight*smooth;
        field[i+3]+=weight*light;
        field[i+4]+=weight*rosy;
      }
    }
    const src=(frame.pixels ||= frame.source.getContext('2d').getImageData(0,0,w,h)).data;
    const output=frame.output ||= ctx.createImageData(w,h), dst=output.data;
    dst.set(src);
    const soft=needsSoft?softened(frame):null, sample=new Float32Array(stride);
    for(let y=ymin;y<Math.min(h,ymax);y++){
      const gy=Math.floor(y/step), fy=y/step-gy;
      for(let x=xmin;x<Math.min(w,xmax);x++){
        const gx=Math.floor(x/step),fx=x/step-gx,i=(gy*cols+gx)*stride,j=i+cols*stride;
        const u=(1-fx)*(1-fy),v=fx*(1-fy),m=(1-fx)*fy,n=fx*fy;
        for(let k=0;k<stride;k++) sample[k]=field[i+k]*u+field[i+stride+k]*v+field[j+k]*m+field[j+stride+k]*n;
        const dx=sample[0],dy=sample[1],blur=clamp(sample[2],-1,1),light=sample[3],red=sample[4];
        if(!dx&&!dy&&!blur&&!light&&!red) continue;
        const px=clamp(x-dx,0,w-1),py=clamp(y-dy,0,h-1),ix=Math.floor(px),iy=Math.floor(py);
        const t=px-ix,b=py-iy,index=(iy*w+ix)*4,right=ix===w-1?0:4,down=iy===h-1?0:w*4;
        const dest=(y*w+x)*4;
        for(let k=0;k<4;k++){
          const idx=index+k;
          let color=(src[idx]*(1-t)+src[idx+right]*t)*(1-b)+(src[idx+down]*(1-t)+src[idx+down+right]*t)*b;
          if(k<3){
            if(blur) color+=(soft[idx]-color)*blur;
            color+= light+(k===0?red:k===1?-.29*red:-.15*red);
          }
          dst[dest+k]=color;
        }
      }
    }
    ctx.putImageData(output,0,0);
  }

  const addedPortraits = new Map();
  for (const {number, images, fullSubject, halfPreview, halfSubject} of window.CanvasFlowOfficialRoleAdditions || []) {
    if (images[0]) addedPortraits.set(images[0], {number, full:true, subject:fullSubject, halfPreview});
    const half = halfPreview || images[1];
    if (images[1] && images[1] !== images[0]) addedPortraits.set(images[1], {number, full:false});
    if (half && half !== images[0]) addedPortraits.set(half, {number, full:false, subject:halfSubject});
  }
  function officialPortrait(src) {
    if (!src) return null;
    let url;
    try { url = new URL(src, document.baseURI); } catch { return null; }
    if (url.origin !== location.origin) return null;
    const base = new URL('.', document.baseURI).pathname;
    if (!url.pathname.startsWith(base)) return null;
    const path = url.pathname.slice(base.length).replace(/^_libtv_roles\//, 'role-library/');
    const added = addedPortraits.get(path);
    if (added) return added;
    const legacy = path.match(/^role-library\/web\/(00[1-9]|01\d|02[0-4])-([12])\.jpg$/i);
    return legacy ? {number:legacy[1], full:legacy[2] === '1', subject:`assets/role-studio/subjects/${legacy[1]}-${legacy[2]}.webp`} : null;
  }
  window.roleStudioOfficialPortrait = officialPortrait;

  // Both camera views may revisit the same upload during comparison or undo.
  const cutoutCache = new Map();
  async function cutoutFor(key, signal) {
    if (cutoutCache.has(key)) return cutoutCache.get(key);
    const source = new Image();
    source.src = key;
    await source.decode();
    signal.throwIfAborted();
    const blob = await window.roleStudioCutout(source, {signal});
    signal.throwIfAborted();
    if (cutoutCache.size >= 4) cutoutCache.delete(cutoutCache.keys().next().value);
    cutoutCache.set(key, blob);
    return blob;
  }

  window.createRoleAppearancePreview = image => {
    const canvas=document.createElement('canvas');
    canvas.className='rs-appearance-preview'; canvas.setAttribute('aria-hidden','true');
    canvas.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none;';
    canvas.hidden=true;
    const subject=document.createElement('img');
    subject.className='rs-subject-preview';subject.hidden=true;subject.alt='';subject.draggable=false;
    subject.setAttribute('aria-hidden','true');subject.style.cssText=canvas.style.cssText;
    image.after(canvas,subject);
    const frames=new Map(), bounds=new Map();
    const originalOpacity=image.style.opacity;
    let current={}, version=0, raf=0, destroyed=false, sourceKey='', subjectKey='', liveFrame;
    let subjectRequest, pendingSubject=false, objectUrl='', cutoutFailed=false;
    function studioPortrait(src) {
      const subjectPath=officialPortrait(src)?.subject;
      return subjectPath?new URL(subjectPath,document.baseURI).href:'';
    }
    function hasSubject() { return !!subjectKey && subject.currentSrc===subjectKey && subject.complete && subject.naturalWidth>0; }
    function layers() {
      const available=hasSubject();
      subject.hidden=!available || !canvas.hidden;
      image.style.opacity=available || pendingSubject?'0':originalOpacity;
    }
    function stateChanged(state) {
      if(canvas.dataset.previewState===state) return;
      canvas.dataset.previewState=state;
      canvas.dispatchEvent(new CustomEvent('rolepreviewstate',{detail:state,bubbles:true}));
    }
    function hide(state) { canvas.hidden=true;stateChanged(state);layers(); }
    async function selectSubject(key) {
      subjectRequest?.abort();
      subjectRequest=new AbortController();
      const {signal}=subjectRequest;
      subjectKey='';
      subject.removeAttribute('src');
      if(objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl='';
      cutoutFailed=false;
      pendingSubject=Boolean(key);
      if(!key) return;
      try {
        let url=studioPortrait(key);
        if(url) {
          const prepared=new Image();
          prepared.src=url;
          try { await prepared.decode(); } catch { url=''; }
        }
        if(signal.aborted) return;
        if(!url) {
          const blob=await cutoutFor(key,signal);
          if(signal.aborted) return;
          objectUrl=URL.createObjectURL(blob);
          url=objectUrl;
        }
        subjectKey=url;
        subject.src=url;
        await subject.decode();
      } catch {
        if(signal.aborted) return;
        subjectKey='';
        subject.removeAttribute('src');
        cutoutFailed=true;
      }
      if(signal.aborted) return;
      pendingSubject=false;
      liveFrame=null;
      update(current);
    }
    function frameFor(key) {
      if(frames.has(key)) return frames.get(key);
      const ready=(async()=>{
        if(image.currentSrc===key && image.complete && image.naturalWidth) return photo(image);
        const source=new Image();
        if(/^https?:/i.test(key) && new URL(key).origin!==location.origin) source.crossOrigin='anonymous';
        source.src=key;await source.decode();
        if(destroyed) throw new Error('角色编辑器已关闭');
        return photo(source);
      })();
      if(frames.size>=2) frames.delete(frames.keys().next().value);
      frames.set(key,ready);
      ready.catch(()=>{if(frames.get(key)===ready) frames.delete(key);});
      return ready;
    }
    function detectionFor(frame,body) {
      const type=body?'full':'face';
      if(!frame.detections[type] && !frame.detections.full) {
        frame.detections[type]=landmarks(frame.source,body).catch(error=>{
          delete frame.detections[type];
          throw error;
        });
      }
      return frame.detections.full || frame.detections[type];
    }
    async function faceBounds(src) {
      if(destroyed || !src) return null;
      try {
        const key=new URL(src,document.baseURI).href;
        if(!bounds.has(key)){
          const result=(async()=>{
            const frame=await frameFor(key);
            const {faces,poses}=await detectionFor(frame,false);
            if(destroyed || faces.length!==1 || poses.length>1) return null;
            const face=faces[0];
            const pixels=face.map(p=>({x:p.x*frame.source.width,y:p.y*frame.source.height}));
            if(!faceEffects(pixels,[],()=>{})) return null;
            const contour=[10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,
              152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109].map(i=>face[i]);
            const xs=contour.map(p=>p.x),ys=contour.map(p=>p.y);
            const x=clamp(Math.min(...xs),0,1),y=clamp(Math.min(...ys),0,1);
            const width=clamp(Math.max(...xs),0,1)-x,height=clamp(Math.max(...ys),0,1)-y;
            return width>0 && height>0?Object.freeze({x,y,width,height}):null;
          })();
          bounds.set(key,result);
          result.catch(()=>{if(bounds.get(key)===result)bounds.delete(key);});
        }
        return await bounds.get(key);
      } catch { return null; }
    }
    async function surfaceFor(src) {
      if(!src || destroyed)return null;
      const frame=await frameFor(new URL(src,document.baseURI).href);
      if(!frame.surface) frame.surface=detectionFor(frame,true).then(({faces,poses})=>{
        if(destroyed || faces.length>1 || poses.length>1)return null;
        return window.CanvasFlowMarkSurface.create(frame.source.width,frame.source.height,faces[0],poses[0]);
      }).catch(error=>{delete frame.surface;throw error;});
      return frame.surface;
    }
    async function composition(frame,values,raster=frame.source) {
      const {faces,poses}=await detectionFor(frame,values.some(v=>v.mode==='body'));
      if(faces.length>1 || poses.length>1) return {state:'multiple'};
      const {width,height}=raster;
      const pixels=arr=>arr?.map(p=>({...p,x:p.x*width,y:p.y*height}));
      const effects=[], add=(c,rx,ry,a,props)=>effects.push({c,rx,ry,a,props});
      const head=pixels(faces[0]);
      const located=faceEffects(head,values.filter(v=>v.mode==='face' && !v.material),add);
      const makeup=located?await Promise.all(values.filter(v=>v.material).map(sampleMaterial)):[];
      bodyEffects(pixels(poses[0]),values.filter(v=>v.mode==='body'),add,width,height);
      return {state:effects.length || makeup.length?'ready':'unlocated',head,effects,makeup};
    }
    function paintComposition(target,frame,{head,effects,makeup}) {
      paint(target,frame,effects);
      drawMakeup(target.getContext('2d'),head,makeup,effects);
    }
    async function referenceFor(src,controls) {
      const values=settings(controls);
      if(!src || !values.length || destroyed) return null;
      const frame=await frameFor(new URL(src,document.baseURI).href);
      const comp=await composition(frame,values);
      if(destroyed || comp.state!=='ready') return null;
      const target=document.createElement('canvas');
      paintComposition(target,frame,comp);
      return target;
    }
    // Track the displayed photograph in physical pixels, including the half-body camera.
    // Landmark inference and exported references keep their own, smaller buffers.
    function liveEdge(source) {
      const {width,height}=image.getBoundingClientRect();
      const density=window.devicePixelRatio||1;
      const native=Math.max(source.naturalWidth,source.naturalHeight);
      const screen=Math.ceil(Math.max(width,height)*density/128)*128;
      const budget=native*Math.sqrt(4500000/(source.naturalWidth*source.naturalHeight));
      return Math.min(native,Math.floor(budget),Math.max(960,screen));
    }
    function liveRaster(frame) {
      const source=hasSubject()?subject:image;
      const edge=liveEdge(source);
      if(liveFrame?.source!==source || liveFrame.edge!==edge){
        const raster=source===image && edge===Math.max(frame.source.width,frame.source.height)
          ? frame : photo(source,edge);
        liveFrame={source,edge,raster};
      }
      return liveFrame.raster;
    }
    function refreshResolution() {
      if(!destroyed && current.enabled && liveFrame && liveEdge(liveFrame.source)!==liveFrame.edge) update(current);
    }
    async function draw(revision,values,key) {
      try {
        const frame=await frameFor(key);
        if(destroyed || revision!==version) return;
        if(canvas.hidden) hide('locating');
        const display=liveRaster(frame);
        const comp=await composition(frame,values,display.source);
        if(destroyed || revision!==version) return;
        if(comp.state!=='ready') return hide(comp.state);
        paintComposition(canvas,display,comp);
        canvas.hidden=false;stateChanged('ready');layers();
      } catch {
        if(!destroyed && revision===version) hide('unavailable');
      }
    }
    function update(state) {
      if(destroyed) return;
      current=state;version++;cancelAnimationFrame(raf);
      const key=image.getAttribute('src')?image.src:'';
      if(sourceKey!==key) {sourceKey=key;liveFrame=null;selectSubject(key);hide('loading');}
      layers();
      const values=settings(state.controls);
      if(pendingSubject && (!studioPortrait(key) || values.length)) return hide('cutting');
      if(!state.enabled || !image.complete || !image.naturalWidth || image.hidden || !values.length) return hide(cutoutFailed?'cutout-failed':'original');
      const revision=version;
      raf=requestAnimationFrame(()=>draw(revision,values,key));
    }
    const loaded=()=>update(current);
    image.addEventListener('load',loaded);
    subject.addEventListener('load',loaded);
    return {update,refreshResolution,faceBounds,surfaceFor,referenceFor,hasLocalChanges:controls=>settings(controls).length>0,destroy(){
      destroyed=true;version++;cancelAnimationFrame(raf);frames.clear();bounds.clear();liveFrame=null;
      subjectRequest?.abort();
      if(objectUrl) URL.revokeObjectURL(objectUrl);
      image.style.opacity=originalOpacity;
      image.removeEventListener('load',loaded);subject.removeEventListener('load',loaded);subject.remove();canvas.remove();
    }};
  };
})();
