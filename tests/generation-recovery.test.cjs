const fs = require('node:fs'), vm = require('node:vm');
const test = require('node:test'), assert = require('node:assert/strict');
const acorn = require('../tools/release/node_modules/acorn');
const source = fs.readFileSync('app.js', 'utf8'), functions = {};
function walk(n) {
  if (!n || typeof n !== 'object') return;
  if (n.type === 'FunctionDeclaration') functions[n.id.name] = source.slice(n.start, n.end);
  for (const v of Object.values(n)) { if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v === 'object') walk(v); }
}
walk(acorn.parse(source, { ecmaVersion: 'latest' }));
function load(scope, names) { vm.runInContext(names.map(n => functions[n]).join('\n'), scope); }
function fixture() {
  const node = { dataset: { nodeId: 'output', node: 'image' }, isConnected: true, querySelector: () => null, style: {} };
  const applied = [], queries = [], saved = [];
  const job = { id: 'job', outputId: 'output', kind: 'image', status: 'completed', prompt: 'test' };
  const scope = {
    state: { projectId: 'original' }, workspaceHeader: () => ({ 'X-Workspace-Id': 'workspace-a' }),
    isStandaloneFile: () => false, document: { querySelector: () => node }, CSS: { escape: x => x },
    api: async path => { queries.push(path); return { jobs: [job] }; },
    pollGenerationJob: async () => ({ image: 'image', imageUrl: '/media/file.png', jobId: 'job' }),
    nodeHasUsableImage: () => false, audioNodeTrack: () => null,
    applyGeneratedImage: (...args) => applied.push(args), applyGeneratedAudio: (...args) => applied.push(args),
    saveProject: () => saved.push(true), showToast() {},
  };
  vm.createContext(scope);
  load(scope, ['generationContext', 'generationContextActive', 'prepareGenerationSubmission', 'bindGenerationJob', 'resumeGenerationJobs']);
  return { scope, node, job, applied, queries, saved };
}

test('completed-but-unapplied image is recovered once and recorded in project', async () => {
  const f = fixture(); await f.scope.resumeGenerationJobs(); await f.scope.resumeGenerationJobs();
  assert.equal(f.applied.length, 1); assert.equal(f.node.dataset.appliedGenerationJobId, 'job');
  assert.ok(!f.queries[0].includes('status=running')); assert.ok(f.saved.length >= 2);
});

test('queued audio is recovered with its durable file URL', async () => {
  const f = fixture(); f.node.dataset.node = f.job.kind = 'audio'; f.job.status = 'queued';
  f.scope.pollGenerationJob = async () => ({ audio: 'data', audioUrl: '/media/audio.wav', jobId: 'job' });
  await f.scope.resumeGenerationJobs(); assert.equal(f.applied.length, 1);
  assert.equal(f.applied[0][1].audioUrl, '/media/audio.wav');
});

test('recovery does not apply an old result after project switch', async () => {
  const f = fixture(); f.scope.pollGenerationJob = async () => { f.scope.state.projectId = 'other'; return { image: 'old' }; };
  await f.scope.resumeGenerationJobs(); assert.equal(f.applied.length, 0);
  assert.equal(f.node.dataset.appliedGenerationJobId, undefined);
});

test('newest failed task suppresses an older completed result for the same node', async () => {
  const f = fixture(); f.scope.api = async () => ({ jobs: [{ ...f.job, id: 'new', status: 'failed' }, f.job] });
  await f.scope.resumeGenerationJobs(); assert.equal(f.applied.length, 0);
});

test('task discovery paginates and finds older nodes beyond the first 200 entries', async () => {
  const f = fixture(); let pages = 0;
  f.scope.api = async () => ({ jobs: pages++ === 0 ? Array.from({ length: 200 }, (_, i) => ({ id: `v-${i}`, kind: 'video' })) : [f.job] });
  await f.scope.resumeGenerationJobs(); assert.equal(pages, 2); assert.equal(f.applied.length, 1);
});

test('concurrent resume calls do not duplicate the same output application', async () => {
  const f = fixture(); let release;
  f.scope.pollGenerationJob = () => new Promise(r => release = r);
  const first = f.scope.resumeGenerationJobs(); await new Promise(r => setImmediate(r));
  await f.scope.resumeGenerationJobs(); release({ image: 'result' }); await first;
  assert.equal(f.applied.length, 1);
});

test('image submission captures project/workspace even if UI switches before response', async () => {
  const f = fixture(); let submitted, polled;
  f.scope.api = async (_path, options) => { submitted = options; f.scope.state.projectId = 'other'; return { jobId: 'job' }; };
  f.scope.pollGenerationJob = async (_id, options) => { polled = options; return null; };
  load(f.scope, ['runImageGenerationJob']);
  await f.scope.runImageGenerationJob({ prompt: 'test' }, { node: f.node });
  assert.equal(JSON.parse(submitted.body).projectId, 'original');
  assert.equal(submitted.headers['X-Workspace-Id'], 'workspace-a');
  assert.equal(polled.context.projectId, 'original'); assert.equal(f.saved.length, 1);
});

test('refresh between submission and receiving job ID recovers replacement of an existing image', async () => {
  const f = fixture(); f.node.dataset.generationJobId = 'pending'; f.node.dataset.appliedGenerationJobId = 'old-job';
  f.scope.nodeHasUsableImage = () => true;
  await f.scope.resumeGenerationJobs(); assert.equal(f.applied.length, 1);
  assert.equal(f.node.dataset.appliedGenerationJobId, 'job');
});

test('failed project save prevents paid submission', async () => {
  const f = fixture(); f.scope.saveProject = async () => false;
  load(f.scope, ['runImageGenerationJob']);
  await assert.rejects(f.scope.runImageGenerationJob({ prompt: 'test' }, { node: f.node }), /项目尚未保存成功/);
  assert.equal(f.queries.length, 0);
});

test('audio playback binding survives total loss of browser music cache', () => {
  const f = fixture(); f.node.dataset.node = 'audio';
  Object.assign(f.scope, {
    musicStorage: { get: () => null, set() {} }, demoMusic: [], updateMusicCount() {},
    currentUser: () => ({ id: 'local' }), remember() {}, scheduleSave() {}, refreshQuickToolbarState() {},
    ensureAudioNodeControls() {}, refreshAudioButtons() {}, $$: () => [f.node], nodeLayerOf: () => 0, nodeLabelEl: () => null,
  });
  load(f.scope, ['saveAudioToLibrary', 'writeMusicLibrary', 'readMusicLibrary', 'applyAudioTrack', 'applyGeneratedAudio', 'nodeSnapshot', 'applyNodeContent', 'audioNodeTrack', 'audioNodeData']);
  f.scope.applyGeneratedAudio(f.node, { audio: 'data:audio/wav;base64,bytes', audioUrl: '/media/saved.wav', jobId: 'job' }, 'hello');
  const snapshot = f.scope.nodeSnapshot()[0];
  assert.equal(snapshot.audioUrl, '/media/saved.wav'); assert.equal(snapshot.appliedGenerationJobId, 'job');
  f.scope.state.musicTracks = [];
  const restored = { dataset: { node: 'audio' }, querySelector: () => null };
  // Only persistable fields are needed; no cached data or original node object.
  f.scope.applyNodeContent(restored, { audioUrl: snapshot.audioUrl, audioName: snapshot.audioName });
  f.scope.applyAudioTrack(restored, snapshot.trackId);
  assert.equal(f.scope.audioNodeData(restored), '/media/saved.wav');
});

test('normal project opening invokes image/audio recovery after restoring graph', () => {
  const body = functions.applyLoadedProject;
  assert.ok(body.includes('resumeGenerationJobs()')); assert.ok(body.indexOf('applyGraph(') < body.indexOf('resumeGenerationJobs()'));
});

test('generated image binds original file immediately; delayed asset registration cannot modify another canvas', async () => {
  const f = fixture(), history = []; let release, request;
  const preview = { dataset: { previewData: 'stale' }, classList: { add() {}, remove() {} }, querySelector: () => null };
  f.node.querySelector = () => preview;
  Object.assign(f.scope, {
    scheduleSave() {}, pushImageHistory: (...x) => history.push(x),
    setMediaNodeImageUrl: (node, url) => { node.dataset.previewMedia = url; },
    api: (_path, options) => { request = options; return new Promise(r => release = r); },
  });
  load(f.scope, ['applyGeneratedImage']);
  f.scope.applyGeneratedImage(f.node, 'bytes', 'prompt', { imageUrl: '/media/original.png' });
  assert.equal(f.node.dataset.previewMedia, '/media/original.png'); assert.equal(preview.dataset.previewData, undefined);
  assert.equal(JSON.parse(request.body).mediaId, 'original.png'); assert.equal(request.headers['X-Workspace-Id'], 'workspace-a');
  f.scope.state.projectId = 'other'; release({ asset: { id: 'asset' } });
  await new Promise(r => setImmediate(r)); assert.equal(history.length, 0);
});
