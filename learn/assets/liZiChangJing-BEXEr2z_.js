import{Bn as e,Bs as t,Do as n,J as r,Js as i,Oo as a,Qi as o,ai as s,bn as c,ca as l,co as u,ii as d,ks as f,lt as p,na as m,o as ee,ps as h,q as g,st as _,zs as v}from"./three.module-gN7TBLi5.js";var y={name:`CopyShader`,uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`},b=class{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error(`THREE.Pass: .render() must be implemented in derived pass.`)}dispose(){}},x=new o(-1,1,1,-1,0,1),S=new class extends r{constructor(){super(),this.setAttribute(`position`,new c([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute(`uv`,new c([0,2,0,0,2,0],2))}},C=class{constructor(e){this._mesh=new d(S,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,x)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}},w=class extends b{constructor(e,t=`tDiffuse`){super(),this.textureID=t,this.uniforms=null,this.material=null,e instanceof a?(this.uniforms=e.uniforms,this.material=e):e&&(this.uniforms=f.clone(e.uniforms),this.material=new a({name:e.name===void 0?`unspecified`:e.name,defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader})),this._fsQuad=new C(this.material)}render(e,t,n){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=n.texture),this._fsQuad.material=this.material,this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}},T=class extends b{constructor(e,t){super(),this.scene=e,this.camera=t,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,t,n){let r=e.getContext(),i=e.state;i.buffers.color.setMask(!1),i.buffers.depth.setMask(!1),i.buffers.color.setLocked(!0),i.buffers.depth.setLocked(!0);let a,o;this.inverse?(a=0,o=1):(a=1,o=0),i.buffers.stencil.setTest(!0),i.buffers.stencil.setOp(r.REPLACE,r.REPLACE,r.REPLACE),i.buffers.stencil.setFunc(r.ALWAYS,a,4294967295),i.buffers.stencil.setClear(o),i.buffers.stencil.setLocked(!0),e.setRenderTarget(n),this.clear&&e.clear(),e.render(this.scene,this.camera),e.setRenderTarget(t),this.clear&&e.clear(),e.render(this.scene,this.camera),i.buffers.color.setLocked(!1),i.buffers.depth.setLocked(!1),i.buffers.color.setMask(!0),i.buffers.depth.setMask(!0),i.buffers.stencil.setLocked(!1),i.buffers.stencil.setFunc(r.EQUAL,1,4294967295),i.buffers.stencil.setOp(r.KEEP,r.KEEP,r.KEEP),i.buffers.stencil.setLocked(!0)}},E=class extends b{constructor(){super(),this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}},te=class{constructor(t,n){if(this.renderer=t,this._pixelRatio=t.getPixelRatio(),n===void 0){let r=t.getSize(new v);this._width=r.width,this._height=r.height,n=new i(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:e}),n.texture.name=`EffectComposer.rt1`}else this._width=n.width,this._height=n.height;this.renderTarget1=n,this.renderTarget2=n.clone(),this.renderTarget2.texture.name=`EffectComposer.rt2`,this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new w(y),this.copyPass.material.blending=0,this.timer=new h}swapBuffers(){let e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,t){this.passes.splice(t,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){let t=this.passes.indexOf(e);t!==-1&&this.passes.splice(t,1)}isLastEnabledPass(e){for(let t=e+1;t<this.passes.length;t++)if(this.passes[t].enabled)return!1;return!0}render(e){this.timer.update(),e===void 0&&(e=this.timer.getDelta());let t=this.renderer.getRenderTarget(),n=!1;for(let t=0,r=this.passes.length;t<r;t++){let r=this.passes[t];if(r.enabled!==!1){if(r.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(t),r.render(this.renderer,this.writeBuffer,this.readBuffer,e,n),r.needsSwap){if(n){let t=this.renderer.getContext(),n=this.renderer.state.buffers.stencil;n.setFunc(t.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),n.setFunc(t.EQUAL,1,4294967295)}this.swapBuffers()}T!==void 0&&(r instanceof T?n=!0:r instanceof E&&(n=!1))}}this.renderer.setRenderTarget(t)}reset(e){if(e===void 0){let t=this.renderer.getSize(new v);this._pixelRatio=this.renderer.getPixelRatio(),this._width=t.width,this._height=t.height,e=this.renderTarget1.clone(),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,t){this._width=e,this._height=t;let n=this._width*this._pixelRatio,r=this._height*this._pixelRatio;this.renderTarget1.setSize(n,r),this.renderTarget2.setSize(n,r);for(let e=0;e<this.passes.length;e++)this.passes[e].setSize(n,r)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}},ne=class extends b{constructor(e,t,n=null,r=null,i=null){super(),this.scene=e,this.camera=t,this.overrideMaterial=n,this.clearColor=r,this.clearAlpha=i,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this.isRenderPass=!0,this._oldClearColor=new _}render(e,t,n){let r=e.autoClear;e.autoClear=!1;let i,a;this.overrideMaterial!==null&&(a=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(e.getClearColor(this._oldClearColor),e.setClearColor(this.clearColor,e.getClearAlpha())),this.clearAlpha!==null&&(i=e.getClearAlpha(),e.setClearAlpha(this.clearAlpha)),this.clearDepth==1&&e.clearDepth(),e.setRenderTarget(this.renderToScreen?null:n),this.clear===!0&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),e.render(this.scene,this.camera),this.clearColor!==null&&e.setClearColor(this._oldClearColor),this.clearAlpha!==null&&e.setClearAlpha(i),this.overrideMaterial!==null&&(this.scene.overrideMaterial=a),e.autoClear=r}},D={name:`LuminosityHighPassShader`,uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new _(0)},defaultOpacity:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float v = luminance( texel.xyz );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`},O=class n extends b{constructor(n,r=1,o,c){super(),this.strength=r,this.radius=o,this.threshold=c,this.resolution=n===void 0?new v(256,256):new v(n.x,n.y),this.clearColor=new _(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let l=Math.round(this.resolution.x/2),u=Math.round(this.resolution.y/2);this.renderTargetBright=new i(l,u,{type:e}),this.renderTargetBright.texture.name=`UnrealBloomPass.bright`,this.renderTargetBright.texture.generateMipmaps=!1;for(let t=0;t<this.nMips;t++){let n=new i(l,u,{type:e});n.texture.name=`UnrealBloomPass.h`+t,n.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(n);let r=new i(l,u,{type:e});r.texture.name=`UnrealBloomPass.v`+t,r.texture.generateMipmaps=!1,this.renderTargetsVertical.push(r),l=Math.round(l/2),u=Math.round(u/2)}let d=D;this.highPassUniforms=f.clone(d.uniforms),this.highPassUniforms.luminosityThreshold.value=c,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new a({uniforms:this.highPassUniforms,vertexShader:d.vertexShader,fragmentShader:d.fragmentShader}),this.separableBlurMaterials=[];let p=[6,10,14,18,22];l=Math.round(this.resolution.x/2),u=Math.round(this.resolution.y/2);for(let e=0;e<this.nMips;e++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(p[e])),this.separableBlurMaterials[e].uniforms.invSize.value=new v(1/l,1/u),l=Math.round(l/2),u=Math.round(u/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=r,this.compositeMaterial.uniforms.bloomRadius.value=.1;let m=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=m,this.bloomTintColors=[new t(1,1,1),new t(1,1,1),new t(1,1,1),new t(1,1,1),new t(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=f.clone(y.uniforms),this.blendMaterial=new a({uniforms:this.copyUniforms,vertexShader:y.vertexShader,fragmentShader:y.fragmentShader,premultipliedAlpha:!0,blending:2,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new _,this._oldClearAlpha=1,this._basic=new s,this._fsQuad=new C(null)}dispose(){for(let e=0;e<this.renderTargetsHorizontal.length;e++)this.renderTargetsHorizontal[e].dispose();for(let e=0;e<this.renderTargetsVertical.length;e++)this.renderTargetsVertical[e].dispose();this.renderTargetBright.dispose();for(let e=0;e<this.separableBlurMaterials.length;e++)this.separableBlurMaterials[e].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(e,t){let n=Math.round(e/2),r=Math.round(t/2);this.renderTargetBright.setSize(n,r);for(let e=0;e<this.nMips;e++)this.renderTargetsHorizontal[e].setSize(n,r),this.renderTargetsVertical[e].setSize(n,r),this.separableBlurMaterials[e].uniforms.invSize.value=new v(1/n,1/r),n=Math.round(n/2),r=Math.round(r/2)}render(e,t,r,i,a){e.getClearColor(this._oldClearColor),this._oldClearAlpha=e.getClearAlpha();let o=e.autoClear;e.autoClear=!1,e.setClearColor(this.clearColor,0),a&&e.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this._fsQuad.material=this._basic,this._basic.map=r.texture,e.setRenderTarget(null),e.clear(),this._fsQuad.render(e)),this.highPassUniforms.tDiffuse.value=r.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,e.setRenderTarget(this.renderTargetBright),e.clear(),this._fsQuad.render(e);let s=this.renderTargetBright;for(let t=0;t<this.nMips;t++)this._fsQuad.material=this.separableBlurMaterials[t],this.separableBlurMaterials[t].uniforms.colorTexture.value=s.texture,this.separableBlurMaterials[t].uniforms.direction.value=n.BlurDirectionX,e.setRenderTarget(this.renderTargetsHorizontal[t]),e.clear(),this._fsQuad.render(e),this.separableBlurMaterials[t].uniforms.colorTexture.value=this.renderTargetsHorizontal[t].texture,this.separableBlurMaterials[t].uniforms.direction.value=n.BlurDirectionY,e.setRenderTarget(this.renderTargetsVertical[t]),e.clear(),this._fsQuad.render(e),s=this.renderTargetsVertical[t];this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,e.setRenderTarget(this.renderTargetsHorizontal[0]),e.clear(),this._fsQuad.render(e),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,a&&e.state.buffers.stencil.setTest(!0),this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(r),this._fsQuad.render(e)),e.setClearColor(this._oldClearColor,this._oldClearAlpha),e.autoClear=o}_getSeparableBlurMaterial(e){let t=[],n=e/3;for(let r=0;r<e;r++)t.push(.39894*Math.exp(-.5*r*r/(n*n))/n);return new a({defines:{KERNEL_RADIUS:e},uniforms:{colorTexture:{value:null},invSize:{value:new v(.5,.5)},direction:{value:new v(.5,.5)},gaussianCoefficients:{value:t}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				#include <common>

				varying vec2 vUv;

				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float gaussianCoefficients[KERNEL_RADIUS];

				void main() {

					float weightSum = gaussianCoefficients[0];
					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * weightSum;

					for ( int i = 1; i < KERNEL_RADIUS; i ++ ) {

						float x = float( i );
						float w = gaussianCoefficients[i];
						vec2 uvOffset = direction * invSize * x;
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += ( sample1 + sample2 ) * w;

					}

					gl_FragColor = vec4( diffuseSum, 1.0 );

				}`})}_getCompositeMaterial(e){return new a({defines:{NUM_MIPS:e},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`

				varying vec2 vUv;

				void main() {

					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

				}`,fragmentShader:`

				varying vec2 vUv;

				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor( const in float factor ) {

					float mirrorFactor = 1.2 - factor;
					return mix( factor, mirrorFactor, bloomRadius );

				}

				void main() {

					// 3.0 for backwards compatibility with previous alpha-based intensity
					vec3 bloom = 3.0 * bloomStrength * (
						lerpBloomFactor( bloomFactors[ 0 ] ) * bloomTintColors[ 0 ] * texture2D( blurTexture1, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 1 ] ) * bloomTintColors[ 1 ] * texture2D( blurTexture2, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 2 ] ) * bloomTintColors[ 2 ] * texture2D( blurTexture3, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 3 ] ) * bloomTintColors[ 3 ] * texture2D( blurTexture4, vUv ).rgb +
						lerpBloomFactor( bloomFactors[ 4 ] ) * bloomTintColors[ 4 ] * texture2D( blurTexture5, vUv ).rgb
					);

					float bloomAlpha = max( bloom.r, max( bloom.g, bloom.b ) );
					gl_FragColor = vec4( bloom, bloomAlpha );

				}`})}};O.BlurDirectionX=new v(1,0),O.BlurDirectionY=new v(0,1);var k={name:`OutputShader`,uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#elif defined( CUSTOM_TONE_MAPPING )

				gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`},A=class extends b{constructor(){super(),this.isOutputPass=!0,this.uniforms=f.clone(k.uniforms),this.material=new u({name:k.name,uniforms:this.uniforms,vertexShader:k.vertexShader,fragmentShader:k.fragmentShader}),this._fsQuad=new C(this.material),this._outputColorSpace=null,this._toneMapping=null}render(e,t,n){this.uniforms.tDiffuse.value=n.texture,this.uniforms.toneMappingExposure.value=e.toneMappingExposure,(this._outputColorSpace!==e.outputColorSpace||this._toneMapping!==e.toneMapping)&&(this._outputColorSpace=e.outputColorSpace,this._toneMapping=e.toneMapping,this.material.defines={},p.getTransfer(this._outputColorSpace)===`srgb`&&(this.material.defines.SRGB_TRANSFER=``),this._toneMapping===1?this.material.defines.LINEAR_TONE_MAPPING=``:this._toneMapping===2?this.material.defines.REINHARD_TONE_MAPPING=``:this._toneMapping===3?this.material.defines.CINEON_TONE_MAPPING=``:this._toneMapping===4?this.material.defines.ACES_FILMIC_TONE_MAPPING=``:this._toneMapping===6?this.material.defines.AGX_TONE_MAPPING=``:this._toneMapping===7?this.material.defines.NEUTRAL_TONE_MAPPING=``:this._toneMapping===5&&(this.material.defines.CUSTOM_TONE_MAPPING=``),this.material.needsUpdate=!0),this.renderToScreen===!0?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}},j=`// ============================================================================\r
//  白猪AI · 主粒子系统顶点着色器\r
//  单个 Points 对象，在 5 组目标坐标之间按 uProgress(0→4) 连续 lerp 变形：\r
//    0 星球/星系  →  1 胶囊输入框  →  2 噪点云  →  3 波形带  →  4 漩涡/黑洞\r
// ============================================================================\r
precision highp float;\r
\r
#define PI 3.141592653589793\r
\r
uniform float uTime;\r
uniform float uProgress;      // 0..4，由 ScrollTrigger scrub 驱动\r
uniform float uSize;          // 基础点大小\r
uniform float uDpr;\r
uniform vec3  uMouse;         // 世界坐标下的指针位置\r
uniform float uMouseStrength; // 斥力强度\r
uniform vec2  uParallax;      // hero 星球 ±5° 视差\r
uniform vec3  uSphereCenter;  // 星球中心（横屏偏右）\r
uniform float uPillHalfW;     // 胶囊半宽，内部流动粒子取模用\r
uniform float uWaveBoost;     // 播放按钮 hover 时增大波形振幅\r
uniform float uWaveOffsetY;   // 波形带整体下移，避开标题文案\r
uniform float uIntro;         // 入场：1 = 完全散开，0 = 汇聚成形\r
\r
// 形态 0 复用内置的 position 属性，省一组 buffer\r
attribute vec3  aPos1;\r
attribute vec3  aPos2;\r
attribute vec3  aPos3;\r
attribute vec3  aPos4;\r
attribute vec3  aRandom;\r
attribute vec4  aInfo;   // x:球体类型(0核心/1壳层/2轨道环) y:环半径 z:环角度 w:环编号\r
attribute vec4  aInfo2;  // x:胶囊内部标记 y:波形归一化x z:漩涡半径 w:漩涡角度\r
attribute float aScale;\r
\r
varying vec3  vColor;\r
varying float vAlpha;\r
\r
// ---- 主色板 ---------------------------------------------------------------\r
const vec3 C_CYAN   = vec3(0.310, 0.820, 1.000); // #4FD1FF\r
const vec3 C_BLUE   = vec3(0.357, 0.486, 1.000); // #5B7CFF\r
const vec3 C_PURPLE = vec3(0.608, 0.420, 1.000); // #9B6BFF\r
const vec3 C_PINK   = vec3(1.000, 0.420, 0.839); // #FF6BD6\r
const vec3 C_ORANGE = vec3(1.000, 0.702, 0.361); // #FFB35C\r
\r
mat2 rot(float a) { float s = sin(a), c = cos(a); return mat2(c, -s, s, c); }\r
\r
float hash11(float p) {\r
  p = fract(p * 0.1031);\r
  p *= p + 33.33;\r
  p *= p + p;\r
  return fract(p);\r
}\r
\r
float noise11(float x) {\r
  float i = floor(x), f = fract(x);\r
  f = f * f * (3.0 - 2.0 * f);\r
  return mix(hash11(i), hash11(i + 1.0), f);\r
}\r
\r
// 五段渐变：青 → 蓝 → 紫 → 粉 → 橙\r
vec3 ramp5(float t) {\r
  t = clamp(t, 0.0, 1.0) * 4.0;\r
  if (t < 1.0) return mix(C_CYAN,   C_BLUE,   t);\r
  if (t < 2.0) return mix(C_BLUE,   C_PURPLE, t - 1.0);\r
  if (t < 3.0) return mix(C_PURPLE, C_PINK,   t - 2.0);\r
  return              mix(C_PINK,   C_ORANGE, t - 3.0);\r
}\r
\r
// 轨道环的倾角（按环编号给不同姿态）\r
vec3 applyTilt(vec3 p, float id) {\r
  float ax =  0.52 + id * 0.40;\r
  float az = -0.30 + id * 0.55;\r
  p.yz = rot(ax) * p.yz;\r
  p.xy = rot(az) * p.xy;\r
  return p;\r
}\r
\r
// ---- 形态 0：星球 / 星系 ---------------------------------------------------\r
vec3 animSphere(vec3 p) {\r
  if (aInfo.x > 1.5) {\r
    // 轨道环：在自身平面内公转（约 30s/圈），再套用倾角\r
    float r = aInfo.y;\r
    float a = aInfo.z + uTime * (0.21 + aInfo.w * 0.045);\r
    vec3 q = vec3(cos(a) * r, aRandom.y * 0.10, sin(a) * r);\r
    p = applyTilt(q, aInfo.w);\r
  } else {\r
    // 核心与壳层：整体缓慢自转 + 轻微呼吸\r
    p.xz = rot(uTime * 0.055) * p.xz;\r
    p += aRandom * 0.07 * sin(uTime * 0.7 + aRandom.x * 12.0);\r
  }\r
  // 鼠标视差 ±5°\r
  p.yz = rot(uParallax.y) * p.yz;\r
  p.xz = rot(uParallax.x) * p.xz;\r
  return p + uSphereCenter;\r
}\r
\r
// ---- 形态 1：胶囊输入框 ----------------------------------------------------\r
vec3 animPill(vec3 p) {\r
  if (aInfo2.x > 0.5) {\r
    // 内部稀疏粒子与周围浮尘：沿 x 轴循环流动\r
    float w = uPillHalfW * (aInfo2.x > 1.5 ? 1.4 : 1.0);\r
    float speed = aInfo2.x > 1.5 ? 0.35 : 0.85;\r
    p.x = mod(p.x + uTime * speed + w, 2.0 * w) - w;\r
    p.y += sin(uTime * 1.3 + aRandom.z * 9.0) * 0.05;\r
  } else {\r
    // 外沿：只做极小抖动，保持轮廓锐利\r
    p += aRandom * 0.035 * sin(uTime * 2.0 + aRandom.x * 20.0);\r
  }\r
  return p;\r
}\r
\r
// ---- 形态 2：散乱噪点云 ----------------------------------------------------\r
vec3 animCloud(vec3 p) {\r
  float r = length(p.xy);\r
  p.xy = rot(uTime * 0.13 / (1.0 + r * 0.35)) * p.xy;   // 中心快、外圈慢的旋涌\r
  p.z += sin(uTime * 0.6 + aRandom.y * 10.0) * 0.30;\r
  p += aRandom * 0.22 * sin(uTime * 0.4 + aRandom.z * 7.0);\r
  return p;\r
}\r
\r
// ---- 形态 3：正弦波形带 ----------------------------------------------------\r
vec3 animWave(vec3 p) {\r
  float nx  = aInfo2.y;                       // 0..1\r
  float env = pow(sin(nx * PI), 1.15);        // 中部振幅最大\r
  float y = sin(nx * 13.0 - uTime * 1.6) * 1.00\r
          + sin(nx * 26.0 + uTime * 1.1) * 0.42\r
          + (noise11(nx * 17.0 + uTime * 0.9) - 0.5) * 1.10;\r
  p.y  = y * env * (2.3 + uWaveBoost) + aRandom.y * (0.26 * env + 0.07) + uWaveOffsetY;\r
  p.z += sin(uTime * 0.9 + nx * 9.0) * 0.45;\r
  return p;\r
}\r
\r
// ---- 形态 4：漩涡 / 黑洞 ---------------------------------------------------\r
vec3 animVortex(vec3 p) {\r
  float r = aInfo2.z;\r
  float a = aInfo2.w + uTime * (0.60 / (0.7 + r * 0.55));  // 越靠内转得越快\r
  vec3 q = vec3(cos(a) * r, sin(a) * r, p.z);\r
  q.z += sin(uTime * 0.5 + r * 1.4) * 0.45;\r
  return q;\r
}\r
\r
void main() {\r
  float p = clamp(uProgress, 0.0, 4.0);\r
\r
  // 顺序 lerp 的四个插值因子，各自做一次 smoothstep 让过渡更柔\r
  float c1 = smoothstep(0.0, 1.0, clamp(p,       0.0, 1.0));\r
  float c2 = smoothstep(0.0, 1.0, clamp(p - 1.0, 0.0, 1.0));\r
  float c3 = smoothstep(0.0, 1.0, clamp(p - 2.0, 0.0, 1.0));\r
  float c4 = smoothstep(0.0, 1.0, clamp(p - 3.0, 0.0, 1.0));\r
\r
  vec3 s0 = animSphere(position);\r
  vec3 s1 = animPill(aPos1);\r
  vec3 s2 = animCloud(aPos2);\r
  vec3 s3 = animWave(aPos3);\r
  vec3 s4 = animVortex(aPos4);\r
\r
  vec3 pos = s0;\r
  pos = mix(pos, s1, c1);\r
  pos = mix(pos, s2, c2);\r
  pos = mix(pos, s3, c3);\r
  pos = mix(pos, s4, c4);\r
\r
  // 变形途中让粒子适度飞散，两端为 0\r
  float tr = sin(fract(p) * PI);\r
  pos += aRandom * tr * 1.15;\r
\r
  // 入场：从散乱状态汇聚\r
  pos += aRandom * uIntro * 9.0;\r
\r
  // 各形态的有效权重（用于混色与透明度）\r
  float w4 = c4;\r
  float w3 = c3 * (1.0 - c4);\r
  float w2 = c2 * (1.0 - c3) * (1.0 - c4);\r
  float w1 = c1 * (1.0 - c2) * (1.0 - c3) * (1.0 - c4);\r
  float w0 = (1.0 - c1) * (1.0 - c2) * (1.0 - c3) * (1.0 - c4);\r
\r
  // 指针微弱斥力\r
  vec2 d = pos.xy - uMouse.xy;\r
  float dist = length(d);\r
  float force = uMouseStrength / (1.0 + dist * dist * 0.55);\r
  pos.xy += normalize(d + vec2(0.0001)) * min(force, 0.9);\r
\r
  // ---- 颜色 ---------------------------------------------------------------\r
  float rad0 = length(position);\r
  vec3 col0 = mix(\r
    vec3(1.0),                                              // 核心亮白\r
    mix(C_BLUE, C_PURPLE, smoothstep(1.0, 6.0, rad0)),      // 外围蓝紫\r
    smoothstep(0.0, 1.7, rad0)\r
  );\r
  vec3 col1 = mix(C_CYAN, vec3(0.88, 0.96, 1.0), hash11(aRandom.x * 31.0));\r
  vec3 col2 = ramp5(fract(aRandom.x * 3.7 + aRandom.z * 1.3));\r
  vec3 col3 = ramp5(aInfo2.y);\r
  vec3 col4 = mix(C_PURPLE, C_PINK, clamp(aInfo2.z / 9.0, 0.0, 1.0));\r
  col4 = mix(col4, C_CYAN, smoothstep(7.0, 12.0, aInfo2.z) * 0.6);\r
\r
  vColor = col0 * w0 + col1 * w1 + col2 * w2 + col3 * w3 + col4 * w4;\r
\r
  // ---- 透明度：胶囊内部/浮尘压暗、漩涡中心掏空 + 随机闪烁 ------------------\r
  float aPill = aInfo2.x < 0.5 ? 1.0 : (aInfo2.x < 1.5 ? 0.42 : 0.2);\r
  float aVortex = smoothstep(0.5, 3.2, aInfo2.z);\r
  float alpha = w0 + aPill * w1 + w2 + w3 + aVortex * w4;\r
  float tw = 0.72 + 0.28 * sin(uTime * 1.6 + aRandom.x * 40.0);\r
  vAlpha = clamp(alpha, 0.0, 1.0) * tw * (0.42 + 0.38 * hash11(aRandom.z * 97.0));\r
  vAlpha *= 1.0 - uIntro * 0.6;\r
\r
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);\r
  gl_Position = projectionMatrix * mv;\r
  gl_PointSize = uSize * aScale * uDpr * (30.0 / max(-mv.z, 0.001));\r
}\r
`,M=`// 主粒子系统片元着色器：软边圆点 + additive blending\r
precision highp float;\r
\r
varying vec3  vColor;\r
varying float vAlpha;\r
\r
void main() {\r
  vec2 uv = gl_PointCoord - 0.5;\r
  float d = length(uv);\r
  float a = smoothstep(0.5, 0.0, d);\r
  a = pow(a, 1.9);\r
  if (a < 0.01) discard;\r
  gl_FragColor = vec4(vColor * a, a * vAlpha);\r
}\r
`,N=`// 星空背景层：慢速视差漂移 + 随机闪烁\r
precision highp float;\r
\r
uniform float uTime;\r
uniform float uSize;\r
uniform float uDpr;\r
uniform float uDrift;     // 该层的漂移速度（视差）\r
uniform vec2  uParallax;  // 指针视差\r
\r
attribute float aSeed;\r
attribute float aScale;\r
\r
varying float vTwinkle;\r
varying float vTint;\r
\r
void main() {\r
  vec3 p = position;\r
\r
  // 横向缓慢漂移，越过边界后回绕\r
  float span = 60.0;\r
  p.x = mod(p.x + uTime * uDrift + span * 0.5, span) - span * 0.5;\r
  p.xy += uParallax * (1.0 + aSeed * 0.8);\r
\r
  // 随机相位闪烁\r
  float tw = sin(uTime * (0.6 + aSeed * 2.2) + aSeed * 60.0);\r
  vTwinkle = 0.35 + 0.65 * (tw * 0.5 + 0.5);\r
  vTint = aSeed;\r
\r
  vec4 mv = modelViewMatrix * vec4(p, 1.0);\r
  gl_Position = projectionMatrix * mv;\r
  gl_PointSize = uSize * aScale * uDpr * (30.0 / max(-mv.z, 0.001));\r
}\r
`,P=`precision highp float;\r
\r
uniform float uOpacity;\r
\r
varying float vTwinkle;\r
varying float vTint;\r
\r
void main() {\r
  vec2 uv = gl_PointCoord - 0.5;\r
  float d = length(uv);\r
  float a = smoothstep(0.5, 0.0, d);\r
  a = pow(a, 2.2);\r
  if (a < 0.01) discard;\r
\r
  // 大部分冷白，少量偏青/偏紫\r
  vec3 c = mix(vec3(0.86, 0.90, 1.0), vec3(0.62, 0.78, 1.0), step(0.75, vTint));\r
  c = mix(c, vec3(0.80, 0.70, 1.0), step(0.93, vTint));\r
\r
  gl_FragColor = vec4(c * a, a * vTwinkle * uOpacity);\r
}\r
`;function F(e){return e?{星球中心:[0,-2.6,0],星球半径:2.5,胶囊半宽:3.9,胶囊半高:1.15,星云半径:5.4,波形半宽:6,波形下移:-3.4,漩涡半径:6.2}:{星球中心:[7.4,.2,0],星球半径:5,胶囊半宽:9.6,胶囊半高:1.25,星云半径:9,波形半宽:18,波形下移:-2.6,漩涡半径:11}}function I(){let e=0;for(let t=0;t<3;t++)e+=Math.random();return(e/3-.5)*2}function L(){let e=Math.random()*2-1,t=Math.random()*Math.PI*2,n=Math.sqrt(1-e*e);return[n*Math.cos(t),e,n*Math.sin(t)]}function R(e,t){let n=new Float32Array(e*3),r=new Float32Array(e*4),i=t.星球半径,a=Math.floor(e*.05),o=Math.floor(e*.72),s=[i*1.26,i*1.54,i*1.84];for(let t=0;t<e;t++){let e=t*3,c=t*4,[l,u,d]=L();if(t<a){let t=i*.055*Math.cbrt(Math.random());n[e]=l*t,n[e+1]=u*t,n[e+2]=d*t,r[c]=0}else if(t<o){let t=i*(.34+.66*Math.random()**.42);n[e]=l*t,n[e+1]=u*t*.94,n[e+2]=d*t,r[c]=1}else{let i=(t-o)%3,a=s[i]+I()*.13,l=Math.random()*Math.PI*2;n[e]=Math.cos(l)*a,n[e+1]=I()*.1,n[e+2]=Math.sin(l)*a,r[c]=2,r[c+1]=a,r[c+2]=l,r[c+3]=i}}return{pos:n,info:r}}function z(e,t){let n=new Float32Array(e*3),r=new Float32Array(e),i=t.胶囊半宽,a=t.胶囊半高,o=Math.max(i-a,.001)*2,s=Math.PI*a,c=o*2+s*2,l=Math.floor(e*.56),u=Math.floor(e*.78);for(let t=0;t<e;t++){let e=t*3;if(t<l){let i=Math.random()*c,l,u;if(i<o)l=-o/2+i,u=a;else if((i-=o)<s){let e=-Math.PI/2+i/s*Math.PI;l=o/2+Math.cos(e)*a,u=Math.sin(e)*a}else if((i-=s)<o)l=o/2-i,u=-a;else{i-=o;let e=Math.PI/2+i/s*Math.PI;l=-o/2+Math.cos(e)*a,u=Math.sin(e)*a}n[e]=l+I()*.022,n[e+1]=u+I()*.022,n[e+2]=I()*.07,r[t]=0}else if(t<u){let s=(Math.random()*2-1)*i,c=Math.min(Math.max(Math.abs(s)-o/2,0),a),l=Math.sqrt(Math.max(a*a-c*c,0))*.8;n[e]=s,n[e+1]=(Math.random()*2-1)*l,n[e+2]=I()*.3,r[t]=1}else n[e]=I()*i*1.35,n[e+1]=I()*a*4.2,n[e+2]=I()*2.4,r[t]=2}return{pos:n,interior:r}}function B(e,t){let n=new Float32Array(e*3),r=t.星云半径;for(let t=0;t<e;t++){let e=t*3,[i,a,o]=L(),s=r*Math.random()**.72;n[e]=i*s,n[e+1]=a*s*.82,n[e+2]=o*s*.45}return{pos:n}}function V(e,t){let n=new Float32Array(e*3),r=new Float32Array(e),i=t.波形半宽;for(let t=0;t<e;t++){let e=t*3,a=Math.random();r[t]=a,n[e]=(a-.5)*2*i,n[e+1]=0,n[e+2]=I()*1.05}return{pos:n,nx:r}}function H(e,t){let n=new Float32Array(e*3),r=new Float32Array(e*2),i=t.漩涡半径;for(let t=0;t<e;t++){let e=t*3,a=t*2,o=.45+(i-.45)*Math.random()**.62,s=t%3*(Math.PI*2/3),c=I()*(.24+o/i*.85),l=s+o*.55+c;n[e]=Math.cos(l)*o,n[e+1]=Math.sin(l)*o,n[e+2]=I()*.9*(1-o/i*.6),r[a]=o,r[a+1]=l}return{pos:n,ra:r}}function U(e,t,n){let r=new Float32Array(e*3),i=new Float32Array(e),a=new Float32Array(e);for(let o=0;o<e;o++){let e=o*3;r[e]=(Math.random()-.5)*60,r[e+1]=(Math.random()-.5)*42,r[e+2]=t+Math.random()*(n-t),i[o]=Math.random(),a[o]=.45+Math.random()**2.4*1.5}return{pos:r,seed:i,scale:a}}function W(e,i,o,s){let c=new ee({canvas:e,antialias:!1,alpha:!1,powerPreference:`high-performance`});c.setClearColor(`#050508`,1);let u=new n;u.background=new _(`#050508`);let d=new m(50,1,.1,200);d.position.z=22;let f,p,h=!1,y=performance.now(),b=0,x=0,S,C=new v,w=new v,T=c.getContext(),E=T.getExtension(`WEBGL_debug_renderer_info`),D=E?String(T.getParameter(E.UNMASKED_RENDERER_WEBGL)):``,k=/swiftshader|llvmpipe|software|microsoft basic/i.test(D)||navigator.hardwareConcurrency<=4||navigator.deviceMemory<=4,I=!1,L=[],W=[];c.debug.onShaderError=()=>{throw Error(`粒子着色器不可用`)};function G(){for(let e of[...u.children])e.geometry.dispose(),e.material.dispose(),u.remove(e);L.length=0}function K(e,t,n,i){let o=new r;for(let[t,[n,r]]of Object.entries(e))o.setAttribute(t,new g(n,r));let s=new a({vertexShader:t,fragmentShader:n,uniforms:i,transparent:!0,depthWrite:!1,depthTest:!1,blending:2}),c=new l(o,s);c.frustumCulled=!1,u.add(c),L.push(s)}function re(){G();let e=k?1e4:S?24e3:52e3,n=F(S),r=R(e,n),i=z(e,n),a=B(e,n),o=V(e,n),s=H(e,n),c=new Float32Array(e*4),l=new Float32Array(e*3),u=new Float32Array(e);for(let t=0;t<e;t++)c.set([i.interior[t],o.nx[t],s.ra[t*2],s.ra[t*2+1]],t*4),l.set([Math.random()*2-1,Math.random()*2-1,Math.random()*2-1],t*3),u[t]=.4+Math.random()**3*1.35;K({position:[r.pos,3],aPos1:[i.pos,3],aPos2:[a.pos,3],aPos3:[o.pos,3],aPos4:[s.pos,3],aInfo:[r.info,4],aInfo2:[c,4],aRandom:[l,3],aScale:[u,1]},j,M,{uTime:{value:0},uProgress:{value:0},uSize:{value:S?3:3.4},uDpr:{value:1},uMouse:{value:new t(999,999,0)},uMouseStrength:{value:0},uParallax:{value:new v},uSphereCenter:{value:new t(...n.星球中心)},uPillHalfW:{value:n.胶囊半宽},uWaveBoost:{value:0},uWaveOffsetY:{value:n.波形下移},uIntro:{value:1}});for(let[e,t,n,r,i,a]of[[S?700:1400,-34,-20,2.6,.12,.55],[S?500:1e3,-14,-6,3.4,.32,.85]]){let o=U(e,t,n);K({position:[o.pos,3],aSeed:[o.seed,1],aScale:[o.scale,1]},N,P,{uTime:{value:0},uSize:{value:r},uDpr:{value:1},uDrift:{value:i},uOpacity:{value:a},uParallax:{value:new v}})}}function q(){let e=window.innerWidth,t=window.innerHeight,n=e<=900||t>e;d.aspect=e/t,d.updateProjectionMatrix(),c.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5)),c.setSize(e,t,!1),f?.setPixelRatio(c.getPixelRatio()),f?.setSize(e,t),n!==S&&(S=n,re())}function J(e){C.set(e.clientX/innerWidth*2-1,e.clientY/innerHeight*2-1),I=!0}function Y(){I=!1,C.set(0,0)}function X(e){if(h)return;let t=Math.min((e-y)/1e3,.05);if(y=e,!document.hidden){b+=t,x+=(i()-x)*Math.min(t*6,1);for(let e of L){let n=e.uniforms;if(n.uTime.value=b,n.uDpr.value=c.getPixelRatio(),n.uParallax.value.lerp(w.set(C.x*.07,-C.y*.07),Math.min(t*4,1)),n.uProgress){let e=s?.();e&&n.uSphereCenter.value.set(e.x*10.26*d.aspect,e.y*10.26,0),n.uProgress.value=x,n.uIntro.value=Math.max(0,1-b/2.6)**3,n.uMouseStrength.value=I?.55:0,n.uMouse.value.set(C.x*10.26*d.aspect,-C.y*10.26,0)}}try{f&&!S?f.render():c.render(u,d)}catch{Q(),o();return}}document.hidden||(p=requestAnimationFrame(X))}function Z(){cancelAnimationFrame(p),!document.hidden&&!h&&(y=performance.now(),p=requestAnimationFrame(X))}function Q(){h||(h=!0,cancelAnimationFrame(p),window.removeEventListener(`resize`,q),window.removeEventListener(`pointermove`,J),document.removeEventListener(`pointerleave`,Y),document.removeEventListener(`visibilitychange`,Z),e.removeEventListener(`webglcontextlost`,$),G(),W.forEach(e=>e.dispose?.()),f?.dispose(),c.dispose())}function $(e){e.preventDefault(),Q(),o()}try{return q(),!S&&!k&&(f=new te(c),W.push(new ne(u,d),new O(new v(innerWidth,innerHeight),.42,.6,.42),new A),W.forEach(e=>f.addPass(e))),window.addEventListener(`resize`,q,{passive:!0}),window.addEventListener(`pointermove`,J,{passive:!0}),document.addEventListener(`pointerleave`,Y),document.addEventListener(`visibilitychange`,Z),e.addEventListener(`webglcontextlost`,$),X(performance.now()),h?null:Q}catch(e){throw Q(),e}}export{W as 创建粒子场景};