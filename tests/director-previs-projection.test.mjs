import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import * as T from '../vendor/three/three.module.js';
const source=fs.readFileSync(new URL('../director.js',import.meta.url),'utf8'),body=source.slice(source.indexOf('  function renderPrevisFilm()'),source.indexOf('  function renderExportCameraFrame('));
function setup(aspect,fov,W=1200,H=650,fail=false){
 const camera=new T.PerspectiveCamera(fov,aspect,.01,2000),calls=[];
 const renderer={domElement:{clientWidth:W,clientHeight:H},autoClear:true,setScissorTest:v=>calls.push(['scissor',v]),setScissor(){},setViewport:(...v)=>calls.push(['viewport',...v]),render(){if(fail)throw Error('render failed');}};
 const S={renderer,compareCamera:camera},scope={S,activeCameraObj:()=>({id:'camera'}),cameraAspect:()=>aspect,ensureCompareCamera(){},syncRenderCameraFromGizmo(c){c.fov=fov;c.position.set(0,0,0);c.quaternion.identity();c.updateMatrixWorld();},renderCameraScene(){},getAspectDim:()=>({scene:{},cam:{}})};vm.runInNewContext(body,scope);return{scope,S,camera,calls,W,H};
}
test('finished preview frame boundaries exactly match camera optics for all supported ratios and FOVs',()=>{
 for(const aspect of [21/9,16/9,4/3,1,3/4,9/16])for(const fov of [30,50,95]){
  const x=setup(aspect,fov);x.scope.renderPrevisFilm();let fw=x.W*.8,fh=fw/aspect;if(fh>x.H-152){fh=x.H-152;fw=fh*aspect;}
  const half=Math.tan(fov*Math.PI/360)*10;
  for(const [px,py]of [[-1,-1],[-1,1],[1,-1],[1,1]]){const p=new T.Vector3(px*half*aspect,py*half,-10).project(x.camera);assert.ok(Math.abs(p.x-px*fw/x.W)<1e-8);assert.ok(Math.abs(p.y-py*fh/x.H)<1e-8);}
  assert.equal(x.S.renderer.autoClear,true);assert.deepEqual(x.calls.at(-1),['viewport',0,0,x.W,x.H]);
 }
});
test('overscan shading failure always restores renderer state',()=>{const x=setup(16/9,50,1200,650,true);assert.throws(()=>x.scope.renderPrevisFilm(),/render failed/);assert.equal(x.S.renderer.autoClear,true);assert.deepEqual(x.calls.slice(-2),[['scissor',false],['viewport',0,0,1200,650]]);});
