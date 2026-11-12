'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const acorn=require('../tools/release/node_modules/acorn');
const source=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
let functionSource,viewerSource;
(function visit(node){if(!node||typeof node!=='object')return;if(node.type==='FunctionDeclaration'&&node.id?.name==='openScriptAssetPreview')functionSource=source.slice(node.start,node.end);if(node.type==='FunctionDeclaration'&&node.id?.name==='openImageNodePreview')viewerSource=source.slice(node.start,node.end);for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object')visit(value);}})(acorn.parse(source,{ecmaVersion:'latest'}));
function setup(fetchAssetData=async()=>null){const calls=[],notices=[];const scope={fetchAssetData,openImageNodePreview:(node,options)=>calls.push({node,...options}),showToast:text=>notices.push(text)};vm.createContext(scope);vm.runInContext(functionSource,scope);return{...scope,calls,notices};}
test('script asset zoom uses an in-app image preview for local and inline images',async()=>{
 const env=setup();await env.openScriptAssetPreview({imageMedia:'data:image/png;base64,AAAA'},'角色图');
 assert.equal(env.calls[0].node,null);assert.equal(env.calls[0].source,'data:image/png;base64,AAAA');assert.equal(env.calls[0].name,'角色图');
 assert.equal(env.notices.length,0);
});
test('asset-id-only images are resolved to image data instead of opening a JSON API in another window',async()=>{
 let requested;const env=setup(async id=>{requested=id;return'data:image/png;base64,BBBB';});await env.openScriptAssetPreview({imageAsset:'asset-one'},'场景图');
 assert.equal(requested,'asset-one');assert.equal(env.calls[0].source,'data:image/png;base64,BBBB');
});
test('missing or unavailable asset image gives a reminder and opens no empty preview',async()=>{
 const env=setup();await env.openScriptAssetPreview({},'空素材');await env.openScriptAssetPreview({imageAsset:'missing'},'失效素材');
 assert.equal(env.calls.length,0);assert.equal(env.notices.length,2);
});
test('the actual image viewer supports a script asset without a canvas image node',async()=>{
 const created=[];
 function element(tag){const row={tag,children:[],attributes:{},appendChild(child){this.children.push(child);},setAttribute(name,value){this.attributes[name]=value;},addEventListener(){},classList:{toggle(){}},focus(){}};row.querySelector=selector=>selector.includes('stage')?(row.stage ||= element('stage')):element('button');created.push(row);return row;}
 const body=element('body');const scope={$:()=>null,document:{createElement:element,body},escapeHtml:text=>text.replaceAll('<','&lt;'),showToast:()=>{throw Error('Unexpected missing-image prompt');}};
 vm.createContext(scope);vm.runInContext(viewerSource,scope);
 await scope.openImageNodePreview(null,{source:'data:image/png;base64,AAAA',name:'角色预览'});
 const image=created.find(row=>row.tag==='img');assert.equal(image.src,'data:image/png;base64,AAAA');assert.equal(image.alt,'角色预览');assert.equal(body.children.length,1);
});
