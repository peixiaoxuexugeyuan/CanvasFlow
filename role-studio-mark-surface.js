// Depth in image-width units, shared by the editor overlay and the exported reference.
(() => {
  const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
  let triangles;
  async function create(width,height,face,pose) {
    if (!face && !pose) return null;
    const scale=Math.min(1,512/Math.max(width,height));
    const w=Math.max(2,Math.round(width*scale)), h=Math.max(2,Math.round(height*scale));
    const depth=new Float32Array(w*h).fill(Infinity), region=new Uint8Array(w*h);
    function patch(x1,y1,x2,y2,part,sample) {
      for(let y=Math.max(0,Math.floor(y1));y<=Math.min(h-1,Math.ceil(y2));y++) {
        for(let x=Math.max(0,Math.floor(x1));x<=Math.min(w-1,Math.ceil(x2));x++) {
          const index=y*w+x,z=sample(x+.5,y+.5);
          if(z<depth[index] || (part===1 && Number.isFinite(z) && region[index]!==1)) {
            depth[index]=z;region[index]=part;
          }
        }
      }
    }
    const points=list=>list.map(p=>({x:p.x*w,y:p.y*h,z:(p.z||0)*w,visible:(p.visibility??1)>.5}));
    if(pose) {
      const p=points(pose);
      const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
      const middle=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:(a.z+b.z)/2,visible:a.visible&&b.visible});
      const shoulders=distance(p[11],p[12]), hips=distance(p[23],p[24]);
      function tube(a,b,r0,r1,id) {
        if(!a.visible||!b.visible)return;
        const dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy,r=Math.max(r0,r1);
        if(d<1||r<1)return;
        patch(Math.min(a.x,b.x)-r,Math.min(a.y,b.y)-r,Math.max(a.x,b.x)+r,Math.max(a.y,b.y)+r,id,(x,y)=>{
          const t=clamp(((x-a.x)*dx+(y-a.y)*dy)/d,0,1);
          const radius=r0+(r1-r0)*t, side=Math.hypot(x-a.x-t*dx,y-a.y-t*dy);
          return side<=radius ? a.z+(b.z-a.z)*t-.7*Math.sqrt(radius*radius-side*side) : Infinity;
        });
      }
      tube(middle(p[11],p[12]),middle(p[23],p[24]),shoulders*.48,hips*.56,2);
      for(const side of [0,1]) {
        tube(p[11+side],p[13+side],shoulders*.15,shoulders*.10,3+side);
        tube(p[13+side],p[15+side],shoulders*.10,shoulders*.067,3+side);
        tube(p[23+side],p[25+side],hips*.29,hips*.19,5+side);
        tube(p[25+side],p[27+side],hips*.19,hips*.1,5+side);
      }
    }
    if(face) {
      if (!triangles) triangles=(await import('./vendor/role-vision/vision_bundle.mjs')).FaceLandmarker.FACE_LANDMARKS_TESSELATION;
      const p=points(face);
      for(let i=0;i<triangles.length;i+=3) {
        const a=p[triangles[i].start], b=p[triangles[i].end], c=p[triangles[i+1].end];
        const den=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);
        if(Math.abs(den)<.001)continue;
        patch(Math.min(a.x,b.x,c.x),Math.min(a.y,b.y,c.y),Math.max(a.x,b.x,c.x),Math.max(a.y,b.y,c.y),1,(x,y)=>{
          const u=((b.y-c.y)*(x-c.x)+(c.x-b.x)*(y-c.y))/den;
          const v=((c.y-a.y)*(x-c.x)+(a.x-c.x)*(y-c.y))/den;
          return u>=0&&v>=0&&u+v<=1 ? u*a.z+v*b.z+(1-u-v)*c.z : Infinity;
        });
      }
    }
    return {w,h,depth,region};
  }
  const textures=new WeakMap();
  function warp(surface,image,p,angle) {
    if(!surface||!image.naturalWidth)return null;
    const {w,h,region,depth}=surface, cx=p.x*w/100,cy=p.y*h/100;
    const ix=clamp(Math.floor(cx),0,w-1), iy=clamp(Math.floor(cy),0,h-1), part=region[iy*w+ix];
    if(!part)return null;
    let texture=textures.get(image);
    if(!texture || texture.url!==image.src) {
      const source=document.createElement('canvas'), scale=Math.min(1,512/Math.max(image.naturalWidth,image.naturalHeight));
      source.width=Math.max(1,Math.round(image.naturalWidth*scale));source.height=Math.max(1,Math.round(image.naturalHeight*scale));
      const ctx=source.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,source.width,source.height);
      texture={url:image.src,rgba:ctx.getImageData(0,0,source.width,source.height)};textures.set(image,texture);
    }
    const rgba=texture.rgba,sw=p.size*w/100,sh=sw*image.naturalHeight/image.naturalWidth;
    const span=Math.hypot(sw,sh), bitmap=document.createElement('canvas');
    bitmap.width=bitmap.height=clamp(Math.ceil(span*2),8,512);
    const ctx=bitmap.getContext('2d'),result=ctx.createImageData(bitmap.width,bitmap.height);
    const theta=angle*Math.PI/180,cos=Math.cos(theta),sin=Math.sin(theta),n=bitmap.width;
    // Surface distances accumulate along each row / column. Curved edges compress
    // the projected texture while unrelated or occluding body parts remain clear.
    const xStart=Math.max(0,Math.floor(cx-span/2)), xEnd=Math.min(w-1,Math.ceil(cx+span/2));
    const yStart=Math.max(0,Math.floor(cy-span/2)), yEnd=Math.min(h-1,Math.ceil(cy+span/2));
    const mapWidth=xEnd-xStart+1,mapHeight=yEnd-yStart+1;
    if(mapWidth<=0||mapHeight<=0)return null;
    const arcX=new Float32Array(mapWidth*mapHeight),arcY=new Float32Array(arcX.length);
    const step=(a,b)=>region[a]===part&&region[b]===part ? Math.hypot(1,depth[a]-depth[b]) : 1;
    for(let y=yStart;y<=yEnd;y++)for(const sign of [-1,1]) {
      let arc=0;
      for(let x=ix+sign;x>=xStart&&x<=xEnd;x+=sign){
        arc+=step(y*w+x,y*w+x-sign);arcX[(y-yStart)*mapWidth+x-xStart]=sign*arc;
      }
    }
    for(let x=xStart;x<=xEnd;x++)for(const sign of [-1,1]) {
      let arc=0;
      for(let y=iy+sign;y>=yStart&&y<=yEnd;y+=sign){
        arc+=step(y*w+x,(y-sign)*w+x);arcY[(y-yStart)*mapWidth+x-xStart]=sign*arc;
      }
    }
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const dx=((x+.5)/n-.5)*span,dy=((y+.5)/n-.5)*span;
      const sx=Math.floor(cx+dx),sy=Math.floor(cy+dy);
      if(sx<xStart||sx>xEnd||sy<yStart||sy>yEnd||region[sy*w+sx]!==part)continue;
      const idx=(sy-yStart)*mapWidth+sx-xStart;
      const ax=arcX[idx]+dx-(sx-ix),ay=arcY[idx]+dy-(sy-iy);
      const u=(ax*cos+ay*sin)/sw+.5,v=(-ax*sin+ay*cos)/sh+.5;
      if(u<0||v<0||u>=1||v>=1)continue;
      const si=(Math.floor(v*rgba.height)*rgba.width+Math.floor(u*rgba.width))*4;
      const di=(y*n+x)*4;for(let k=0;k<4;k++)result.data[di+k]=rgba.data[si+k];
    }
    ctx.putImageData(result,0,0);return {bitmap,ratio:span/sw};
  }
  window.CanvasFlowMarkSurface={create,warp};
})();
