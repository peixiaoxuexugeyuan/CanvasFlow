const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('director.js','utf8');
function fixture(fullscreen=false){
 const host={clientWidth:260,style:{},appendChild(c){c.parentElement=this;}};
 const largeHost={clientWidth:700,style:{},appendChild(c){c.parentElement=this;}};
 const title={},fov={},canvas={width:288,height:162,style:{},parentElement:host};
 const overlay={hidden:!fullscreen,clientWidth:1280,clientHeight:720,querySelector:s=>s.endsWith('Title')?title:largeHost};
 const rendered=[];
 const renderer={domElement:canvas,setSize(w,h){canvas.width=w;canvas.height=h;},setScissorTest(value){assert.equal(value,false);},setViewport(x,y,w,h){assert.equal(x,0);assert.equal(y,0);assert.equal(w,canvas.width);assert.equal(h,canvas.height);}};
 const S={el:{shell:{querySelector:()=>overlay},inspector:{querySelector:s=>s==='#dtCamPreviewFov'?fov:host}},project:{objects:[{id:'camera',kind:'camera',name:'机位1',fov:50}]},selectedId:'camera',three:{},scene:{},camPreviewRenderer:renderer,camPreviewCamera:{fov:75,updateProjectionMatrix(){}}};
 const scope={S,window:{devicePixelRatio:1.5},cameraAspect:()=>16/9,syncRenderCameraFromGizmo(){},renderCameraScene(r,c){rendered.push({aspect:c.aspect,fov:c.fov});}};
 const code=source.match(/  function renderCamPreview\([^)]*\) \{[\s\S]*?\n  \}/)[0];
 vm.runInNewContext(code,scope);return{scope,S,host,largeHost,overlay,canvas,title,fov,rendered,renderer};
}
test('preview renders the entire camera frame without letterboxing for all aspect ratios',()=>{
 const x=fixture();
 for(const aspect of [9/16,1,4/3,16/9,21/9]){
  x.scope.cameraAspect=()=>aspect;x.scope.renderCamPreview();
  assert.equal(x.S.camPreviewCamera.aspect,aspect);
  assert.equal(x.canvas.width,390);assert.equal(x.canvas.height,Math.round(390/aspect));
  assert.equal(x.host.style.aspectRatio,String(aspect));
  assert.equal(x.fov.textContent,'FOV 75°','the label uses sampled camera optics');
 }
 assert.equal(x.S.camPreviewRenderer,x.renderer);
});
test('fullscreen uses the same canvas and renderer, and fits the complete frame inside the viewport',()=>{
 const x=fixture(true);x.scope.cameraAspect=()=>9/16;x.scope.renderCamPreview();
 assert.equal(x.canvas.parentElement,x.largeHost);
 assert.ok(parseFloat(x.largeHost.style.width)<=1280-32);
 assert.ok(parseFloat(x.largeHost.style.width)/(9/16)<=720-100);
 assert.equal(x.title.textContent,'机位1 · FOV 75°');
 x.overlay.hidden=true;x.scope.renderCamPreview();assert.equal(x.canvas.parentElement,x.host);
 assert.equal(x.S.camPreviewRenderer,x.renderer);
});
test('resizing the preview reuses the renderer and respects resolution bounds',()=>{
 const x=fixture();x.host.clientWidth=2000;x.scope.renderCamPreview();assert.equal(x.canvas.width,1920);
 x.host.clientWidth=190;x.scope.renderCamPreview();assert.equal(x.canvas.width,285);
 assert.equal(x.S.camPreviewRenderer,x.renderer);
});
