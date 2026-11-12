const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');
const acorn = require('../tools/release/node_modules/acorn');

// Execute production function bodies with controlled I/O, never a real project or AI service.
function readFunctions(file) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const functions = {};
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'FunctionDeclaration') functions[node.id.name] = source.slice(node.start, node.end);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  }
  visit(acorn.parse(source, { ecmaVersion: 'latest' }));
  return functions;
}
const app = readFunctions('app.js'), settings = readFunctions('settings.js');
function load(scope, names, source = app) {
  if (!vm.isContext(scope)) vm.createContext(scope);
  vm.runInContext(names.map(name => { assert.ok(source[name], name); return source[name]; }).join('\n'), scope);
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}
const tick = () => new Promise(resolve => setImmediate(resolve));
const contexts = ['generationContext', 'generationContextActive', 'prepareGenerationSubmission'];

function videoFixture() {
  const references = deferred(), requests = [], saves = [], renders = [];
  const output = { dataset: { node: 'output', nodeId: 'output-A' }, isConnected: true };
  const button = { disabled: false, dataset: {} };
  const scope = {
    state: { projectId: 'project-A', jobBindings: [], generationSettings: { referenceMode: 'text2video', duration: '4', modelOptions: { quality: 'low' } }, advancedSettings: { seed: '17' } },
    workspace: 'workspace-A', workspaceHeader: () => ({ 'X-Workspace-Id': scope.workspace }),
    $: () => button, resolveGenerationTarget: () => output,
    collectUpstreamInputs: () => ({ prompt: 'original prompt', labels: [], inputs: [] }),
    defaultGenerationSettings: () => ({}), collectVideoReferenceImages: () => references.promise,
    collectVideoSourceVideos: () => [], videoModelNeedsSourceVideo: () => false,
    evaluateVideoGenMode: () => ({ canGenerate: true }), videoReferenceInputs: () => [],
    isKnownReferenceMode: () => true, canvasflowVideoAudioInputs: async () => ['original audio'],
    graph: [{ id: 'original-node', nested: { text: 'original' } }], graphSnapshot: () => ({ nodes: scope.graph }),
    saveProject: async () => { saves.push(scope.state.projectId); return true; },
    api: async (url, options) => { requests.push({ url, ...options, body: JSON.parse(options.body) }); return { job: { id: 'video-job' } }; },
    setSendButtonState: (_button, value) => { button.mode = value; },
    resetOutputForNewJob() {}, renderJobProgress: (...args) => renders.push(args),
    showToast() {}, stopJobPolling() {}, watchPendingJobs() {}, scheduleSave() {},
  };
  load(scope, [...contexts, 'generateVideo']);
  return { scope, references, output, button, requests, saves, renders };
}

test('video double click locks before reference fetch and submits exactly once', async () => {
  const f = videoFixture();
  const first = f.scope.generateVideo(), second = f.scope.generateVideo();
  assert.equal(f.button.disabled, true);
  f.references.resolve([]); await Promise.all([first, second]);
  assert.equal(f.requests.length, 1); assert.equal(f.saves.length, 1);
  assert.equal(f.scope.state.jobBindings.length, 1);
  assert.equal(f.output.dataset.videoSubmitting, undefined);
});

for (const boundary of ['project', 'workspace', 'reopened canvas']) {
  test(`video reference preparation cancels after switching ${boundary}`, async () => {
    const f = videoFixture(); const run = f.scope.generateVideo();
    if (boundary === 'project') f.scope.state.projectId = 'project-B';
    else if (boundary === 'workspace') f.scope.workspace = 'workspace-B';
    else f.scope.state.canvasEpoch = 2;
    f.references.resolve([]); await run;
    assert.equal(f.requests.length, 0); assert.equal(f.saves.length, 0);
    assert.equal(f.button.disabled, false);
  });
}

test('video keeps the submitted model, options and node snapshot while references load', async () => {
  const f = videoFixture(); const run = f.scope.generateVideo();
  f.scope.state.generationSettings.duration = '8';
  f.scope.state.generationSettings.modelOptions.quality = 'high';
  f.scope.state.advancedSettings.seed = '99'; f.scope.graph[0].nested.text = 'edited';
  f.references.resolve(['original image']); await run;
  const payload = f.requests[0].body;
  assert.equal(payload.projectId, 'project-A'); assert.equal(payload.outputId, 'output-A');
  assert.equal(payload.generationSettings.duration, '4');
  assert.equal(payload.generationSettings.modelOptions.quality, 'low');
  assert.equal(payload.advancedSettings.seed, '17');
  assert.equal(payload.nodes[0].nested.text, 'original');
  assert.equal(f.requests[0].headers['X-Workspace-Id'], 'workspace-A');
});

test('video failed save or failed references never submit and always unlock', async () => {
  for (const kind of ['save', 'reference']) {
    const f = videoFixture();
    if (kind === 'save') f.scope.saveProject = async () => false;
    const run = f.scope.generateVideo();
    if (kind === 'reference') f.references.reject(Error('unreadable image')); else f.references.resolve([]);
    await run; assert.equal(f.requests.length, 0); assert.equal(f.button.disabled, false);
    assert.equal(f.output.dataset.videoSubmitting, undefined);
  }
});

test('late video submission response cannot bind a job to the newly opened project', async () => {
  const f = videoFixture(), response = deferred();
  f.scope.api = async () => response.promise;
  const run = f.scope.generateVideo(); f.references.resolve([]); await tick();
  f.scope.state.projectId = 'project-B'; f.scope.state.jobBindings = [];
  response.resolve({ job: { id: 'job-A' } }); await run;
  assert.equal(f.scope.state.jobBindings.length, 0); assert.equal(f.button.dataset.jobId, undefined);
});

for (const kind of [undefined, 'video']) test(`unbound video job (${kind || 'legacy missing kind'}) recovers by original project and output`, async () => {
  const f = videoFixture(); f.output.dataset.generationJobId = 'pending';
  let watched = 0;
  Object.assign(f.scope, {
    isStandaloneFile: () => false, CSS: { escape: x => x }, document: { querySelector: () => f.output },
    api: async () => ({ jobs: [{ id: 'lost-job', ...(kind ? { kind } : {}), outputId: 'output-A', status: 'running' }] }),
    watchPendingJobs: () => watched++,
  });
  load(f.scope, ['resumeGenerationJobs']);
  await f.scope.resumeGenerationJobs(); await f.scope.resumeGenerationJobs();
  assert.equal(f.scope.state.jobBindings.length, 1); assert.equal(watched, 1);
  assert.equal(f.scope.state.jobBindings[0].jobId, 'lost-job');
});

test('video polling does not overlap and ignores a pending response after project switch', async () => {
  const f = videoFixture(), result = deferred(); let callback, queries = 0;
  Object.assign(f.scope, {
    CSS: { escape: x => x }, document: { querySelector: () => f.output },
    setInterval: fn => { callback = fn; return 123; }, clearInterval() {},
    api: () => { queries++; return result.promise; }, refreshUsage() {},
  });
  load(f.scope, ['stopJobPolling', 'watchPendingJobs']);
  f.scope.state.jobBindings = [{ jobId: 'job-A', outputId: 'output-A', done: false }];
  f.scope.watchPendingJobs(); const pending = callback(); await callback();
  assert.equal(queries, 1);
  f.scope.state.projectId = 'project-B'; f.scope.state.jobTimer = 456;
  f.scope.state.jobBindings = [{ jobId: 'job-B', outputId: 'output-B', done: false }];
  result.resolve({ job: { id: 'job-A', status: 'completed' } }); await pending;
  assert.equal(f.renders.length, 0); assert.equal(f.scope.state.jobTimer, 456);
  assert.equal(f.scope.state.jobBindings[0].jobId, 'job-B');
});

function agentFixture() {
  const read = deferred(), events = [], calls = [];
  let readCount = 0, cancelled = 0;
  const reader = { read: () => readCount++ ? Promise.resolve({ done: true }) : read.promise, cancel: async () => { cancelled++; } };
  const scope = {
    state: { projectId: 'project-A' }, agentState: { running: true }, agentEls: {},
    workspace: 'workspace-A', workspaceHeader: () => ({ 'X-Workspace-Id': scope.workspace }),
    AbortController, TextDecoder, isStandaloneFile: () => false,
    fetch: async (url, options) => {
      calls.push({ url, options });
      return url.endsWith('quote') ? { ok: true, json: async () => ({ quote: { canAfford: true } }) }
        : { ok: true, body: { getReader: () => reader } };
    },
    agentHandleEvent: event => events.push({ project: scope.state.projectId, event }),
    agentSetRunning: running => { scope.agentState.running = running; },
    agentLoadSessions() {}, agentAppendSystemText() {}, agentShowNotice() {},
  };
  load(scope, ['generationContext', 'generationContextActive', 'agentRequest']);
  const chunk = () => ({ done: false, value: new TextEncoder().encode('data: ' + JSON.stringify({ type: 'tool_result', effects: [{ op: 'create_node' }] }) + '\n\n') });
  return { scope, read, events, calls, chunk, cancelled: () => cancelled };
}

test('Agent applies stream events to the original active canvas', async () => {
  const f = agentFixture(); const run = f.scope.agentRequest({ projectId: 'project-A' });
  await tick(); f.read.resolve(f.chunk()); await run;
  assert.equal(f.events.length, 1); assert.equal(f.events[0].project, 'project-A');
  assert.equal(f.scope.agentState.running, false);
});

for (const boundary of ['project', 'workspace', 'reopened canvas']) {
  test(`Agent ignores old SSE after switching ${boundary}`, async () => {
    const f = agentFixture(); const run = f.scope.agentRequest({ projectId: 'project-A' });
    await tick();
    if (boundary === 'project') f.scope.state.projectId = 'project-B';
    else if (boundary === 'workspace') f.scope.workspace = 'workspace-B';
    else f.scope.state.canvasEpoch = 2;
    f.read.resolve(f.chunk()); await run;
    assert.equal(f.events.length, 0); assert.equal(f.scope.agentState.controller, null);
    assert.ok(f.cancelled() > 0);
  });
}

test('Agent cannot submit chat after switching during quote retrieval', async () => {
  const f = agentFixture(), quote = deferred();
  f.scope.fetch = async (url) => { f.calls.push(url); return quote.promise; };
  const run = f.scope.agentRequest({ projectId: 'project-A' });
  f.scope.workspace = 'workspace-B';
  quote.resolve({ ok: true, json: async () => ({ quote: { canAfford: true } }) }); await run;
  assert.deepEqual(f.calls, ['/api/agent/quote']);
});

test('cancelled Agent finally cannot clear the controller or running state of a new run', async () => {
  const f = agentFixture(); const old = f.scope.agentRequest({ projectId: 'project-A' }); await tick();
  f.scope.state.activeAgentRun.abort();
  const nextRead = deferred();
  f.scope.fetch = async url => url.endsWith('quote') ? { ok: true, json: async () => ({ quote: { canAfford: true } }) }
    : { ok: true, body: { getReader: () => ({ read: () => nextRead.promise, cancel: async () => {} }) } };
  f.scope.agentState.running = true;
  const next = f.scope.agentRequest({ projectId: 'project-A' }); const controller = f.scope.agentState.controller;
  await tick(); f.read.resolve(f.chunk()); await old;
  assert.equal(f.scope.agentState.controller, controller); assert.equal(f.scope.agentState.running, true);
  assert.equal(f.events.length, 0); nextRead.resolve({ done: true }); await next;
});

test('Agent canvas snapshot includes the entire node prompt beyond 300 characters', () => {
  const copy = '提示词'.repeat(1000) + '保留最后一段约束';
  const node = { dataset: { nodeId: 'n', node: 'prompt' }, querySelector: selector => selector === '.node-copy' ? { textContent: copy } : null };
  const scope = { $$: () => [node], stage: {}, state: { projectId: 'draft' }, nodeLabel: () => '', nodeHasUsableImage: () => false, window: {} };
  load(scope, ['agentCanvasPayload']); assert.equal(scope.agentCanvasPayload().nodes[0].copy, copy);
});

function agentSessionsFixture() {
  const requests = [], rendered = [];
  const scope = {
    state: { projectId: 'project-A' }, agentState: { sessions: [] }, agentEls: { title: {} },
    workspace: 'A', workspaceHeader: () => ({ 'X-Workspace-Id': scope.workspace }),
    isStandaloneFile: () => false, showToast() {},
    api: (url, options) => { const response = deferred(); requests.push({ url, options, ...response }); return response.promise; },
    agentRenderSessions: () => rendered.push(scope.state.projectId), agentRenderHistory() {},
    agentSyncContextRing() {}, agentCloseSessions() {},
  };
  load(scope, ['generationContext', 'generationContextActive', 'agentLoadSessions', 'agentOpenSession']);
  return { scope, requests, rendered };
}

for (const change of ['project', 'workspace', 'reopened canvas']) {
  test(`late Agent session list/detail cannot change ${change}`, async () => {
    const f = agentSessionsFixture();
    const list = f.scope.agentLoadSessions(), detail = f.scope.agentOpenSession('session-A');
    if (change === 'project') f.scope.state.projectId = 'project-B';
    else if (change === 'workspace') f.scope.workspace = 'B';
    else f.scope.state.canvasEpoch = 2;
    f.requests[0].resolve({ sessions: [{ id: 'session-A' }] });
    f.requests[1].resolve({ session: { id: 'session-A', projectId: 'project-A' } });
    await Promise.all([list, detail]);
    assert.equal(f.rendered.length, 0); assert.equal(f.scope.agentState.sessions.length, 0);
    assert.equal(f.scope.agentState.sessionId, undefined);
    assert.equal(f.requests[0].options.headers['X-Workspace-Id'], 'A');
  });
}

test('Agent session list and selected session both keep the latest request', async () => {
  const f = agentSessionsFixture();
  const oldList = f.scope.agentLoadSessions(), newList = f.scope.agentLoadSessions();
  f.requests[1].resolve({ sessions: [{ id: 'new' }] }); await newList;
  f.requests[0].resolve({ sessions: [{ id: 'old' }] }); await oldList;
  assert.equal(f.scope.agentState.sessions[0].id, 'new');
  const oldDetail = f.scope.agentOpenSession('old'), newDetail = f.scope.agentOpenSession('new');
  f.requests[3].resolve({ session: { id: 'new', projectId: 'project-A' } }); await newDetail;
  f.requests[2].resolve({ session: { id: 'old', projectId: 'project-A' } }); await oldDetail;
  assert.equal(f.scope.agentState.sessionId, 'new');
});

test('Agent rejects a stale session card belonging to another project', async () => {
  const f = agentSessionsFixture(); const opening = f.scope.agentOpenSession('other-project-session');
  f.requests[0].resolve({ session: { id: 'other-project-session', projectId: 'project-B' } });
  await opening; assert.equal(f.scope.agentState.sessionId, undefined);
  assert.equal(f.requests.length, 2); // Refresh the list for the current canvas.
  f.requests[1].resolve({ sessions: [] }); await tick();
});

test('image history replacement clears stale media and uses the restored image as reference', async () => {
  const preview = { dataset: { previewMedia: '/media/old.png' }, style: {}, classList: { add() {} }, querySelector: () => null };
  const node = { dataset: { nodeId: 'source', node: 'image', previewMedia: '/media/old.png', previewAsset: 'old' }, matches: () => true, querySelector: s => s === '.media-preview' ? preview : null };
  const target = { dataset: { nodeId: 'target', node: 'image' } };
  const scope = { state: { references: [] }, Image: class {}, refreshQuickToolbarState() {},
    window: { CanvasFlowConnections: { getEdges: () => [{ source: 'source', target: 'target' }] } },
    $$: () => [node, target], resolveNodeImageData: async () => preview.dataset.previewData,
  };
  load(scope, ['nodeImageHandles', 'nodeHasUsableImage', 'setMediaNodeImage', 'collectImageReferenceImages']);
  scope.setMediaNodeImage(node, 'data:image/png;base64,RESTORED', 'restored', 'restored-asset');
  assert.equal(node.dataset.previewMedia, undefined); assert.equal(preview.dataset.previewMedia, undefined);
  assert.equal(node.dataset.previewAsset, 'restored-asset');
  assert.equal((await scope.collectImageReferenceImages(target))[0], 'data:image/png;base64,RESTORED');
  scope.setMediaNodeImage(node, 'data:image/png;base64,NEW_UPLOAD', 'new');
  assert.equal(node.dataset.previewAsset, '');
});

function providersFixture() {
  const calls = [], backdrop = { hidden: false };
  const scope = {
    providerSaveTimer: null, providerSaveInFlight: null, pendingProviderPatches: new Map(),
    PROVIDER_SAVE_DELAY: 600, setTimeout: () => 1, clearTimeout() {},
    patchProvider: async (group, patch) => { calls.push({ id: group.providerId, patch: { ...patch } }); return true; },
    panelToast() {}, $id: () => backdrop, wizard: {}, renderWizardLayer() {},
  };
  load(scope, ['queueProviderPatch', 'flushProviderPatch', 'close'], settings);
  return { scope, calls, backdrop };
}

test('editing two providers within debounce interval saves both, including on close', async () => {
  const f = providersFixture();
  f.scope.queueProviderPatch({ providerId: 'A' }, { baseUrl: 'https://a.test' });
  f.scope.queueProviderPatch({ providerId: 'B' }, { apiKey: 'test-only' });
  await f.scope.close();
  assert.deepEqual(f.calls.map(call => call.id), ['A', 'B']); assert.equal(f.backdrop.hidden, true);
});

test('provider writes are serialized and edits arriving during save are not lost', async () => {
  const f = providersFixture(), firstSave = deferred(); let concurrent = 0, maximum = 0;
  f.scope.patchProvider = async (group, patch) => {
    concurrent++; maximum = Math.max(maximum, concurrent); f.calls.push({ id: group.providerId, patch: { ...patch } });
    if (f.calls.length === 1) await firstSave.promise;
    concurrent--; return true;
  };
  f.scope.queueProviderPatch({ providerId: 'A' }, { baseUrl: 'https://old.test' });
  const first = f.scope.flushProviderPatch();
  f.scope.queueProviderPatch({ providerId: 'A' }, { baseUrl: 'https://new.test' });
  f.scope.queueProviderPatch({ providerId: 'B' }, { apiKey: 'test-only' });
  const second = f.scope.flushProviderPatch(); firstSave.resolve(); await Promise.all([first, second]);
  assert.equal(maximum, 1); assert.equal(f.calls.length, 3);
  assert.equal(f.calls[1].patch.baseUrl, 'https://new.test');
});

test('provider save failure keeps the dialog open and retains the edits for retry', async () => {
  const f = providersFixture(); f.scope.patchProvider = async () => false;
  f.scope.queueProviderPatch({ providerId: 'A' }, { baseUrl: 'https://retry.test' });
  await f.scope.close(); assert.equal(f.backdrop.hidden, false); assert.equal(f.scope.pendingProviderPatches.size, 1);
  f.scope.patchProvider = async (_group, patch) => { assert.equal(patch.baseUrl, 'https://retry.test'); return true; };
  await f.scope.close(); assert.equal(f.backdrop.hidden, true); assert.equal(f.scope.pendingProviderPatches.size, 0);
});

function navigationFixture() {
  const requests = new Map(), applied = [], saved = [];
  const scope = {
    state: { projectId: 'initial', projectName: 'initial' }, navigationEpoch: 0,
    workspace: 'A', workspaceHeader: () => ({ 'X-Workspace-Id': scope.workspace }),
    api: async url => { const result = deferred(); requests.set(url.split('/').pop(), result); return result.promise; },
    applyLoadedProject: project => { applied.push(project.id); scope.state.projectId = project.id; },
    findLocalProject: () => null, saveProject: () => saved.push(scope.state.projectId), showToast() {},
  };
  load(scope, ['openProject']); return { scope, requests, applied, saved };
}

test('opening A then B with reversed responses leaves B open and saves only B', async () => {
  const f = navigationFixture(); const a = f.scope.openProject('A'), b = f.scope.openProject('B');
  f.requests.get('B').resolve({ project: { id: 'B' } }); await b;
  f.requests.get('A').resolve({ project: { id: 'A' } }); await a;
  assert.deepEqual(f.applied, ['B']); assert.deepEqual(f.saved, ['B']);
});

test('new canvas cannot override a newer view change while waiting for an existing project save', async () => {
  const f = navigationFixture(), saved = deferred(); let created = 0;
  f.scope.clearTimeout = () => {};
  f.scope.saveProject = () => saved.promise;
  f.scope.beginDraftCanvas = () => { created++; };
  load(f.scope, ['newProject']);
  const creating = f.scope.newProject(); f.scope.navigationEpoch++;
  saved.resolve(true); await creating;
  assert.equal(created, 0); assert.equal(f.scope.state.projectCreationPending, false);
});

for (const change of ['view', 'workspace', 'new canvas']) {
  test(`pending project response cannot override ${change} navigation`, async () => {
    const f = navigationFixture(); const pending = f.scope.openProject('A');
    if (change === 'view') f.scope.navigationEpoch++;
    else if (change === 'workspace') f.scope.workspace = 'B';
    else f.scope.state.projectNavigationRequest++;
    f.requests.get('A').resolve({ project: { id: 'A' } }); await pending;
    assert.equal(f.applied.length, 0); assert.equal(f.saved.length, 0);
  });
}
