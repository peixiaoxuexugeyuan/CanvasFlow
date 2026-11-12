const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const scope={window:{}};vm.runInNewContext(fs.readFileSync('director-annotation.js','utf8'),scope);const G=scope.window.DirectorAnnotationGeometry;
test('annotation selection and erasing hit strokes rather than empty interior regions',()=>{
 const style={width:4,color:'#FF1212'};
 assert.ok(G.hit({...style,type:'arrow',start:{x:0,y:0},end:{x:100,y:100}},{x:50,y:51},2));
 assert.equal(G.hit({...style,type:'arrow',start:{x:0,y:0},end:{x:100,y:100}},{x:10,y:90},2),false);
 for(const type of ['rectangle','ellipse']){const s={...style,type,start:{x:0,y:0},end:{x:100,y:100}};assert.ok(G.hit(s,{x:50,y:0},2));assert.equal(G.hit(s,{x:50,y:50},2),false);}
 const line={...style,type:'brush',points:[{x:10,y:10},{x:40,y:10},{x:40,y:80}]};assert.ok(G.hit(line,{x:40,y:45},2));assert.equal(G.hit(line,{x:20,y:50},2),false);
});
test('moving annotations retains originals for cancellation and undo, including text and freehand points',()=>{
 for(const s of [{type:'text',text:'向前',start:{x:10,y:30},width:7},{type:'brush',points:[{x:1,y:2},{x:4,y:8}],width:2},{type:'rectangle',start:{x:90,y:80},end:{x:10,y:20},width:4}]){const before=JSON.stringify(s),n=G.translate(s,5,-2);assert.equal(JSON.stringify(s),before);assert.equal((n.points?.[0]||n.start).x,(s.points?.[0]||s.start).x+5);assert.equal((n.points?.[0]||n.start).y,(s.points?.[0]||s.start).y-2);}
});
test('reverse-drawn and degenerate shapes have finite bounds and can be hit',()=>{
 const s={type:'rectangle',start:{x:90,y:80},end:{x:10,y:20},width:4};assert.deepEqual(JSON.parse(JSON.stringify(G.bounds(s))),{x:10,y:20,w:80,h:60});assert.ok(G.hit(s,{x:10,y:50}));
 assert.ok(G.hit({...s,type:'ellipse',end:s.start},s.start));assert.ok(G.hit({type:'brush',points:[{x:4,y:8}],width:7},{x:4,y:8}));
});
test('text annotations without an end point do not break selection or erasing of later shapes',()=>{
 const text={type:'text',text:'向前推进',start:{x:30,y:90},width:7,textWidth:140};
 assert.deepEqual(JSON.parse(JSON.stringify(G.bounds(text))),{x:30,y:55,w:140,h:42});
 assert.ok(G.hit(text,{x:100,y:70},2));assert.equal(G.hit(text,{x:250,y:70},2),false);
 const moved=G.translate(text,10,20);assert.ok(G.hit(moved,{x:110,y:90},2));
 const shapes=[{type:'arrow',start:{x:300,y:100},end:{x:400,y:200},width:7},text];
 const found=shapes.findLastIndex(s=>G.hit(s,{x:350,y:150},2));assert.equal(found,0);
});
test('fast eraser sweeps detect crossed strokes between pointer events',()=>{
 const line={type:'brush',points:[{x:50,y:20},{x:50,y:80}],width:2};
 assert.equal(G.hit(line,{x:0,y:50},3),false);assert.equal(G.hit(line,{x:100,y:50},3),false);
 assert.ok(G.sweptHit(line,{x:0,y:50},{x:100,y:50},3));
 assert.equal(G.sweptHit(line,{x:0,y:100},{x:100,y:100},3),false);
 for(const type of ['text','rectangle','ellipse']){const s={type,start:{x:20,y:20},end:{x:80,y:80},text:'文字',textWidth:60,width:4};assert.ok(G.sweptHit(s,{x:0,y:20},{x:100,y:20},3));}
});
