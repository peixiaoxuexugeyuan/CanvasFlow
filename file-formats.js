(() => {
  const extensions={images:['png','jpg','jpeg','webp'],videos:['mp4','webm','mov'],music:['mp3','wav','m4a'],models:['glb'],cover:['png','jpg','jpeg','webp']};
  const labels={images:'PNG/JPG/WebP 图片',videos:'MP4/WebM/MOV 视频',music:'MP3/WAV/M4A 音乐',models:'GLB 2.0 模型',cover:'PNG/JPG/WebP 封面图片'};
  const ascii=(bytes,start=0,end=bytes.length)=>String.fromCharCode(...bytes.subarray(start,end));
  const has=(bytes,text)=>ascii(bytes).includes(text);
  const u32=(bytes,offset,little=false)=>new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).getUint32(offset,little);
  async function isoHandlers(file){
    const handlers=new Set();let at=0;
    while(at+8<=file.size){
      const head=new Uint8Array(await file.slice(at,at+16).arrayBuffer());let length=u32(head,0),header=8;
      const type=ascii(head,4,8);
      if(length===1){length=Number(new DataView(head.buffer).getBigUint64(8));header=16;}
      else if(length===0)length=file.size-at;
      if(length<header||at+length>file.size)return new Set();
      if(type==='moov'){
        if(length>16000000)return new Set();
        const body=new Uint8Array(await file.slice(at+header,at+length).arrayBuffer());
        for(let i=0;i+16<=body.length;i++)if(ascii(body,i,i+4)==='hdlr')handlers.add(ascii(body,i+12,i+16));
      }
      at+=length;
    }
    return handlers;
  }
  async function validate(file,kind,{gltf=false}={}){
    const ext=file.name.split('.').pop().toLowerCase(),allowed=gltf&&kind==='models'?['glb','gltf']:extensions[kind];
    if(!allowed?.includes(ext))throw Error('只支持 '+(gltf&&kind==='models'?'GLB/glTF 模型':labels[kind]||'指定格式文件'));
    if(!file.size||file.size>(kind==='models'?40000000:kind==='cover'?20000000:200000000))throw Error('文件为空或超过允许的大小');
    const head=new Uint8Array(await file.slice(0,65536).arrayBuffer());let valid=false;
    if(ext==='gltf'){
      const data=JSON.parse(await file.text());valid=data.asset?.version==='2.0'&&Array.isArray(data.meshes)&&data.meshes.length>0;
      for(const group of ['buffers','images']){
        if(data[group]!==undefined&&!Array.isArray(data[group]))throw Error('glTF 资源列表格式无效');
        for(const resource of data[group]||[]){
          if(!resource||typeof resource!=='object'||Array.isArray(resource)||(resource.uri!==undefined&&typeof resource.uri!=='string'))throw Error('glTF 资源格式无效');
          if(resource.uri&&!resource.uri.startsWith('data:'))throw Error('请导入资源已内嵌的 glTF 文件');
        }
      }
    }else if(head.length>=12){
      if(ext==='png'){const tail=new Uint8Array(await file.slice(-32).arrayBuffer());valid=head[0]===137&&ascii(head,1,4)==='PNG'&&ascii(head,12,16)==='IHDR'&&has(tail,'IEND');}
      else if(ext==='jpg'||ext==='jpeg'){const tail=new Uint8Array(await file.slice(-32).arrayBuffer());valid=head[0]===255&&head[1]===216&&head[2]===255&&tail.some((value,i)=>value===255&&tail[i+1]===217);}
      else if(ext==='webp')valid=ascii(head,0,4)==='RIFF'&&ascii(head,8,12)==='WEBP'&&['VP8 ','VP8L','VP8X'].includes(ascii(head,12,16))&&u32(head,4,true)+8<=file.size;
      else if(ext==='wav')valid=ascii(head,0,4)==='RIFF'&&ascii(head,8,12)==='WAVE'&&has(head,'fmt ')&&has(head,'data')&&u32(head,4,true)+8<=file.size;
      else if(ext==='mp3'){
        let offset=0;if(ascii(head,0,3)==='ID3')offset=10+head.subarray(6,10).reduce((sum,value)=>sum*128+(value&127),0);
        const frame=new Uint8Array(await file.slice(offset,offset+4).arrayBuffer());valid=frame.length===4&&frame[0]===255&&(frame[1]&224)===224&&((frame[1]>>3)&3)!==1&&((frame[1]>>1)&3)!==0&&![0,15].includes(frame[2]>>4)&&((frame[2]>>2)&3)!==3;
      }else if(['mp4','mov','m4a'].includes(ext)){const handlers=await isoHandlers(file);valid=ext==='m4a'?handlers.has('soun')&&!handlers.has('vide'):handlers.has('vide');}
      else if(ext==='webm')valid=head[0]===26&&head[1]===69&&head[2]===223&&head[3]===163&&has(head.subarray(0,4096),'webm')&&['V_VP8','V_VP9','V_AV1'].some(codec=>has(head,codec));
      else if(ext==='glb')valid=ascii(head,0,4)==='glTF'&&u32(head,4,true)===2&&u32(head,8,true)===file.size;
    }
    if(!valid)throw Error('文件内容与扩展名不一致或文件已损坏，请选择有效的 '+(gltf&&kind==='models'?'GLB/glTF 模型':labels[kind]));
    return file;
  }
  window.CanvasFlowFileFormats={validate,accept:kind=>extensions[kind].map(ext=>'.'+ext).join(','),kindFor:file=>{const ext=file.name.split('.').pop().toLowerCase();return ['images','videos','music'].find(kind=>extensions[kind].includes(ext));}};
})();
