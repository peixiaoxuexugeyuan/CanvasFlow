/* Private build tool. Never copy tools/ or original frontend files into public/. */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const terser = require('terser'), acorn = require('acorn'), CleanCSS = require('clean-css');
const {minify: minifyHTML} = require('html-minifier-terser');
const protectedBuild = process.argv.includes('--protect');
const source = path.resolve(__dirname, '../..');
const target = path.resolve(process.argv[2] || path.join(source, '../CanvasFlow'));
if (target === source || !fs.statSync(target).isDirectory()) throw Error('Use an existing, separate deployment directory');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const program = fs.readFileSync(path.join(__dirname, 'files.txt'), 'utf8').split(/\r?\n/).filter(line => line.trim());
const stage = path.join(target, '.release-stage-' + crypto.randomUUID());
fs.mkdirSync(stage);
const publicFiles = {}, originals = {}, stats = [], removedDebug = [];
const jsOptions = {
  ecma: 2022, module: false, toplevel: false,
  compress: {defaults: false, dead_code: true, drop_debugger: true},
  mangle: {toplevel: false, properties: false, eval: false},
  format: {comments: /^!|@license|@preserve/i}, sourceMap: false
};
function removeDirectorDebug(code) {
  const tree = acorn.parse(code, {ecmaVersion: 'latest', sourceType: 'script'}), ranges = [];
  const member = (n, object, property) => n?.type === 'MemberExpression' && !n.computed && n.object.type === 'Identifier' && n.object.name === object && n.property.name === property;
  function walk(n) {
    if (!n || typeof n !== 'object') return;
    if (n.type === 'ExpressionStatement' && n.expression?.type === 'AssignmentExpression' && member(n.expression.left, 'window', '__poseDebug')) {
      ranges.push([n.start, n.end]); removedDebug.push('__poseDebug'); return;
    }
    if (n.type === 'IfStatement' && member(n.test, 'window', '__dtPixelProbeWanted')) {
      ranges.push([n.start, n.end]); removedDebug.push('pixelProbe'); return;
    }
    if (n.type === 'AssignmentExpression' && member(n.left, 'window', 'CanvasFlowDirector') && n.right.type === 'ObjectExpression') {
      const props = n.right.properties, index = props.findIndex(p => p.key?.name === 'debug');
      if (index >= 0) {
        const p = props[index];
        ranges.push(index === props.length - 1 ? [props[index - 1].end, p.end] : [p.start, props[index + 1].start]);
        removedDebug.push('CanvasFlowDirector.debug');
      }
    }
    for (const value of Object.values(n)) {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === 'object') walk(value);
    }
  }
  walk(tree);
  if (removedDebug.length !== 3) throw Error('Director debug structure changed; review the build transform');
  for (const [start, end] of ranges.sort((a,b) => b[0]-a[0])) code = code.slice(0,start)+code.slice(end);
  acorn.parse(code,{ecmaVersion:'latest'});
  return code;
}
async function transform(relative, input) {
  const extension = path.extname(relative), own = !relative.includes('/');
  if (own && ['.js','.mjs'].includes(extension)) {
    const code = relative === 'director.js' ? removeDirectorDebug(input.toString()) : input.toString();
    const result = await terser.minify(code, {...jsOptions, module: extension === '.mjs'});
    if (result.map || /sourceMappingURL|__poseDebug|__dtPixelProbeWanted/.test(result.code)) throw Error('Release contains developer artifacts: ' + relative);
    return Buffer.from(protectedBuild ? require('./protection.cjs')(result.code, extension === '.mjs') : result.code);
  }
  if (own && extension === '.css') {
    const result = new CleanCSS({level:0,sourceMap:false,rebase:false}).minify(input.toString());
    if (result.errors.length) throw Error(relative + ': ' + result.errors.join('; '));
    return Buffer.from(result.styles);
  }
  if (own && extension === '.html') {
    return Buffer.from(await minifyHTML(input.toString(), {removeComments:true,collapseWhitespace:false,
      minifyCSS:{level:0,rebase:false},minifyJS:{...jsOptions,mangle:false,compress:false}}));
  }
  return input;
}
(async()=>{
  for (const relative of program) {
    const inputPath = path.resolve(source,relative);
    if (!inputPath.startsWith(source+path.sep) || relative.includes('..')) throw Error('Unsafe input: ' + JSON.stringify(relative));
    if (path.extname(relative) === '.py' || relative.startsWith('learn/api/')) continue;
    if (/\.map$|\.orig$|\.bak|(?:^|\/)\./.test(relative)) continue;
    const original = fs.readFileSync(inputPath), output = await transform(relative,original);
    const outputPath=path.join(stage,relative);fs.mkdirSync(path.dirname(outputPath),{recursive:true});fs.writeFileSync(outputPath,output);
    publicFiles[relative]=sha(output);originals[relative]=sha(original);
    if (!relative.includes('/') && ['.js','.mjs','.css','.html'].includes(path.extname(relative))) stats.push({file:relative,before:original.length,after:output.length});
  }
  // Version all first-party page script/style requests without changing module interfaces.
  const buildId=sha(Buffer.from(JSON.stringify(publicFiles))).slice(0,16);
  for (const relative of Object.keys(publicFiles).filter(x => !x.includes('/') && x.endsWith('.html'))) {
    const file=path.join(stage,relative);
    let html=fs.readFileSync(file,'utf8');
    html=html.replace(/\b(src|href)=(['"])([^'"?]+\.(?:js|mjs|css))(?:\?[^'"]*)?\2/g,(match,key,quote,url)=>{
      if (publicFiles[url.replace(/^\//,'')]) return `${key}=${quote}${url}?v=${buildId}${quote}`;
      return match;
    });
    fs.writeFileSync(file,html);publicFiles[relative]=sha(Buffer.from(html));
  }
  const existing=path.join(target,'public');
  if (fs.existsSync(existing)) throw Error('public/ already exists; preserve it before replacing a release');
  // Publication is complete only after both directory and the private manifest are installed.
  fs.renameSync(stage,existing);
  const appVersion = require('../desktop/app/package.json').version;
  fs.writeFileSync(path.join(target,'release-manifest.json'),JSON.stringify({version:1,appVersion,buildId,files:publicFiles},null,2));
  for (const relative of program.filter(x => x.endsWith('.py')).concat('release_security.py')) fs.copyFileSync(path.join(source,relative),path.join(target,relative));
  fs.copyFileSync(path.join(source,'upstream-model-contracts.json'),path.join(target,'upstream-model-contracts.json'));
  for (const relative of program.filter(x => x.startsWith('learn/api/'))) {
    const output=path.join(target,relative);fs.mkdirSync(path.dirname(output),{recursive:true});fs.copyFileSync(path.join(source,relative),output);
  }
  fs.copyFileSync(path.join(source,'Start-CanvasFlow.cmd'),path.join(target,'Start-CanvasFlow.cmd'));
  fs.copyFileSync(path.join(source,'README.md'),path.join(target,'README.md'));
  for (const document of ['LOCAL_APP.md','BLENDER_BRIDGE.md','DESKTOP_APP.md']) fs.copyFileSync(path.join(source,document),path.join(target,document));
  const report={appVersion,buildId,protectedBuild,removedDebug,publicFiles:Object.keys(publicFiles).length,sourceHashes:originals,stats,terserVersion:require('terser/package.json').version,sourceMaps:false,thirdPartyRewritten:false};
  fs.writeFileSync(path.join(__dirname,'build-report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({buildId,publicFiles:report.publicFiles,removedDebug,bytesBefore:stats.reduce((n,x)=>n+x.before,0),bytesAfter:stats.reduce((n,x)=>n+x.after,0)}));
})().catch(error=>{console.error(error);process.exitCode=1;});
