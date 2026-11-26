// Chromium, the local API and a three-page loopback supplier are real. TTS returns fixture MP3 bytes.
const assert = require('node:assert/strict');
const {createHash}=require('node:crypto');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const readline = require('node:readline');
const {spawn} = require('node:child_process');
const {chromium} = require('../tools/openfilm/node_modules/.pnpm/playwright-core@1.61.1/node_modules/playwright-core');
const root = path.resolve(__dirname, '..');
const data = fs.mkdtempSync(path.join(os.tmpdir(),'canvasflow-voice-test-'));
const script = [
  'import server, sys, ipaddress, base64, json, threading, http.server',
  'def restrict(event, args):',
  '    if event == "socket.connect" and not ipaddress.ip_address(args[1][0]).is_loopback: raise ValueError("local fixture only")',
  'sys.addaudithook(restrict)',
  'entry = dict(id="role-tts",model="gpt-4o-mini-tts",name="Fixture TTS",type="tts",usages=["audio"],enabled=True,baseUrl="http://127.0.0.1:1",apiKey="")',
  'class Supplier(http.server.BaseHTTPRequestHandler):',
  '    def log_message(self,*args): pass',
  '    def do_GET(self):',
  '        url = server.urlparse(self.path); query = server.parse_qs(url.query)',
  '        assert url.path.endswith("/skills/voices") and query["model"] == ["fixed-speaker-synthesis"]',
  '        cursor = query.get("cursor", [""])[0]; page = int(query.get("page", ["1"])[0])',
  '        indexes = range(35,46) if cursor=="last" else range(17,36) if page==2 else range(18)',
  '        voices = [dict(id=f"speaker-{i:02d}",name=f"声线 {i:02d}",language="粤语、zh" if i%2 else "中文",gender="female" if i%2 else "男",ageGroup="young" if i%2 else "中年",accent="cantonese" if i%2 else "普通话",capability="对白,叙事",scene="旁白") for i in indexes]',
  '        metadata = {"hasMore":False} if cursor else {"nextCursor":"last"} if page==2 else {"next":"?page=2"}',
  '        raw = json.dumps(dict(voices=voices,pagination=metadata)).encode()',
  '        self.send_response(200); self.send_header("Content-Type","application/json"); self.end_headers(); self.wfile.write(raw)',
  'supplier = http.server.ThreadingHTTPServer(("127.0.0.1",0),Supplier)',
  'threading.Thread(target=supplier.serve_forever,daemon=True).start()',
  'fixed = dict(entry,id="fixed-tts",name="真实音色目录",model="fixed-speaker-synthesis",authMode="none",baseUrl=f"http://127.0.0.1:{supplier.server_port}")',
  'native = dict(entry,id="native-tts",name="ElevenLabs 测试",model="eleven_multilingual_v2",baseUrl="https://api.elevenlabs.io",apiKey="fixture-only")',
  'server.write_ai_models([entry,fixed,native])',
  'remote = {}; attempts = []; original_json = server.http_json_request; original_tts = server.call_tts',
  'mp3 = (server.ROOT / "assets/role-studio/voices/young.mp3").read_bytes()',
  'def native_json(url, payload=None, headers=None, **kwargs):',
  '    if not url.startswith("https://api.elevenlabs.io/"): return original_json(url,payload,headers,**kwargs)',
  '    assert headers["xi-api-key"] == "fixture-only"',
  '    if url.endswith("/v1/text-to-voice/design"):',
  '        assert "Fixture" in payload["voice_description"] and "warm native voice" in payload["voice_description"] and len(payload["text"])>=100',
  '        return 200, {"previews":[{"generated_voice_id":f"candidate-{i}", "audio_base_64":base64.b64encode(mp3).decode()} for i in range(3)]}, None',
  '    if url.endswith("/v1/text-to-voice"):',
  '        assert not remote and payload["generated_voice_id"].startswith("candidate-") and payload["voice_name"] == "专属测试"',
  '        attempts.append(payload["generated_voice_id"])',
  '        if len(attempts) == 1: return 422, {}, "模拟供应商拒绝注册"',
  '        remote.update(voice_id="registered-test-voice",labels=payload["labels"]); return 0, {}, "模拟供应商回复丢失"',
  '    assert url.startswith("https://api.elevenlabs.io/v2/voices?") and "search=" in url',
  '    if "next_page_token=" not in url: return 200, {"voices":[],"has_more":True,"next_page_token":"another-page"}, None',
  '    return 200, {"voices":[remote]}, None',
  'server.http_json_request = native_json',
  'def native_audio(urls,payload,headers,timeout,**kwargs):',
  '    assert urls == ["https://api.elevenlabs.io/v1/text-to-speech/registered-test-voice"] and headers["xi-api-key"] == "fixture-only" and kwargs["expected_audio"]',
  '    assert payload == {"text":"Speak as the registered actor.", "model_id":"eleven_multilingual_v2"}',
  '    return mp3, urls[0], None',
  'server.request_bytes_candidates = native_audio',
  'def synth(entry, text, **params):',
  '    if entry["id"] == "native-tts": return original_tts(entry,text,**params)',
  '    if entry["id"] == "fixed-tts": assert params["voice"] == "speaker-43" and "instructions" not in params["spec"] and text == "Use the selected speaker."',
  '    else: assert "gentle voice" in params["spec"]["instructions"] and text != "gentle voice"',
  '    sample = "elite.mp3" if entry["id"] == "fixed-tts" else "young.mp3"',
  '    data = (server.ROOT / "assets/role-studio/voices" / sample).read_bytes()',
  '    return "data:audio/mpeg;base64," + base64.b64encode(data).decode(), None',
  'server.call_tts = synth',
  'server.Handler.log_message = lambda *args: None',
  'httpd = server.ThreadingHTTPServer(("127.0.0.1",0),server.Handler)',
  'print("VOICE_PORT",httpd.server_address[1],flush=True)',
  'httpd.serve_forever()',
].join('\n');
const server = spawn(path.join(root,'.runtime/python/python.exe'),['-u','-c',script], {cwd:root, windowsHide:true,
  env:{...process.env, LOCALAPPDATA:data, CANVASFLOW_DATA_DIR:data}, stdio:['ignore','pipe','inherit']});
let browser;
async function main() {
  let origin;
  for await (const line of readline.createInterface({input:server.stdout})) {
    if (line.startsWith('VOICE_PORT ')) { origin = 'http://127.0.0.1:' + line.slice(11); break; }
  }
  assert.ok(origin);
  const access = require('./local-browser-access.cjs')(root, data, origin);
  browser = await chromium.launch({executablePath:path.join(root,'.runtime/openfilm-browser/chromium_headless_shell-1228/chrome-headless-shell-win64/chrome-headless-shell.exe')});
  const page = await browser.newPage();
  page.on('pageerror', e => console.error(e.message));
  await page.addInitScript(() => localStorage.setItem('canvasflow-startup-animation', JSON.stringify({enabled:false})));
  await page.route('**/*',route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
  await page.goto(access.link); await page.waitForURL(origin + '/');
  await page.waitForFunction(() => window.mountRoleStudioVoice && window.createRoleVoiceService
    && JSON.parse(localStorage.getItem('canvasflow-identity') || '{}').workspaceId === 'workspace-default-local-device');
  const mount = () => page.evaluate(() => {
    window.voicePanel?.destroy();
    const host = document.querySelector('#voiceFixture') || document.createElement('dialog');
    host.id = 'voiceFixture'; host.className = 'role-studio';
    host.style.cssText = 'z-index:99999;position:fixed;inset:10px;width:350px;overflow:auto;visibility:visible;display:block';
    document.body.append(host);
    if (!host.open) host.showModal();
    window.voiceValues ||= {};
    window.voicePanel = window.mountRoleStudioVoice(host,{role:{name:'Fixture'},controls:window.voiceValues,
      onChange(k,v){window.voiceValues[k] = v;}});
  });
  await mount();
  const host = page.locator('#voiceFixture');
  assert.equal(await host.locator('.rs-voice-card').count(),20);
  assert.equal(await host.getByRole('button',{name:'筛选音色'}).count(),1,
    JSON.stringify(await host.evaluate(el => ({parent:el.parentElement.tagName, hidden:getComputedStyle(el).visibility, dialog:el.open,
      filters:el.querySelector('.rs-voice-filter')?.outerHTML, dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>d.id)}))));
  const filter = host.getByRole('button',{name:'筛选音色'});
  const filters = host.getByRole('dialog',{name:'音色筛选'});
  await host.getByLabel('音色来源').getByRole('option',{name:'真实音色目录'}).waitFor({state:'attached'});
  await page.evaluate(()=>{
    window.samplePlayers=[];
    const play=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(){
      if(this instanceof HTMLAudioElement && !this.isConnected) window.samplePlayers.push(this);
      return play.call(this);
    };
    window.restoreSampleProbe=()=>{HTMLMediaElement.prototype.play=play;};
  });
  // These SHA-256 values come from the official catalog's demo URLs, not from files under test.
  const expectedSamples=[
    ['young','青涩青年音色','74bab327b65c371b975f70bb8e25b800a09d21a049f80fb77aba94f6471f090e'],
    ['elite','精英青年音色','89c1ff8b93205f0bd11c26326f7a43d4a8f914165ce9881f9bfe701ea121c81b'],
    ['bold','霸道青年音色','0321bf9f4090c15e06e4095c77209cbc3cda734a63b1fb5d4c4f100b6ec60a84'],
    ['campus','青年大学生音色','1449319beb97fdae8cc4e232afc5a2468a5076ce857a976b5449ffd6416b8948'],
    ['girl','少女音色','ed4975bb8d702870fb9a00bf1ba5ba423486311139c2e37177ea38751a58c6c9'],
    ['lady','御姐音色','4a00ff1c7b6bd59adff533f745db409f28255abfec2d340445e65e6abf301bbf'],
    ['mature','成熟女性音色','3cd28df25645ea2f72e63f2b53c69dd643a09f007b2c1dbd484458bdb304aaca'],
    ['sweet','甜美女性音色','480fb26f320d3b350297059e1427a77beca4f9a454804b0af36bbc2672724140'],
    ['young-beta','青涩青年音色-beta','bd3c8553f2daec3b102462238bff825c65524e2cfdc98329a65df3d29387eaf4'],
    ['elite-beta','精英青年音色-beta','34aa6f178dd988b5825d25f51cda8b6a8fadd72183a779741454fee7d4c159bf'],
    ['bold-beta','霸道青年音色-beta','11080d6319949b36ee672e29c0e1b5fe3885ef1fbf091a5a92ff808778db2b65'],
    ['campus-beta','青年大学生音色-beta','9df683839b3a53e7ed0e365502f211cb83bda112167d1461b25622194c727167'],
    ['girl-beta','少女音色-beta','f78bdaff47a57d0dc43f02e7cc3ce008da81f80d6b7ddcd0fd4c591fbee77d3a'],
    ['lady-beta','御姐音色-beta','b09f85209569d67fb18e68fe0b07a45cc655041c588907db051962f6930e7e26'],
    ['mature-beta','成熟女性音色-beta','d904c6fd08f71f2261c6f0c0c5bd9159aea7d0a85347a1648e6fc0fa7e22003d'],
    ['sweet-beta','甜美女性音色-beta','963d43e9da14a38d240774da3d49bc3bceec4f081d5c1e82553933c4033e6f23'],
    ['clever-boy','聪明男童','4e8575ff6da629cec9fe2a44eefd8ac409cca6b7c1436ce1d03b3761b0159b6b'],
    ['cute-boy','可爱男童','ece0854be56db1b1678ca949c118fd3276a241151bd76bc9f01b9dfb004c0b80'],
    ['cute-girl','萌萌女童','fbaae1bc4728c73f4dd4e48949af38eaaa6c1fcc3ab1b93fabdeeb7a19b85c2a'],
    ['cartoon','卡通猪小琪','ee0824250ea5f40b45c3a0cf136f7c309f678a71ba045f62579f92f48bd97f1c'],
  ];
  for(const [id,name,expectedHash] of expectedSamples){
    const [media]=await Promise.all([
      page.waitForResponse(r=>{
        const url=new URL(r.url());
        return r.request().resourceType()==='media' && url.origin===origin && url.pathname==='/assets/role-studio/voices/'+id+'.mp3';
      }),
      host.getByRole('button',{name:'试听'+name,exact:true}).click(),
    ]);
    assert.ok(media.ok(),name+' sample responded');
    assert.equal(createHash('sha256').update(await media.body()).digest('hex'),expectedHash,name+' recording');
    await page.waitForFunction(id=>{
      const active=window.samplePlayers.filter(a=>!a.paused);
      return active.length===1 && active[0].currentTime>0 && new URL(active[0].currentSrc).pathname==='/assets/role-studio/voices/'+id+'.mp3';
    },id);
  }
  const stopped=()=>page.waitForFunction(()=>window.samplePlayers.every(a=>a.paused));
  await host.getByRole('button',{name:'停止试听卡通猪小琪',exact:true}).click();
  await stopped();
  const sampler=id=>host.locator('[data-rs-voice-card="'+id+'"] .rs-voice-play');
  await host.evaluate(root=>{
    for(const id of ['young','elite','young']) root.querySelector('[data-rs-voice-card="'+id+'"] .rs-voice-play').click();
  });
  await page.waitForFunction(()=>{
    const players=window.samplePlayers;
    return players.at(-1).currentTime>0 && !players.at(-1).paused && players.slice(0,-1).every(a=>a.paused);
  });
  assert.equal(await sampler('young').getAttribute('aria-pressed'),'true');
  await host.getByRole('searchbox').fill('青涩');
  assert.equal(await sampler('young').getAttribute('aria-pressed'),'true','matching local search keeps the current sample');
  await host.getByRole('searchbox').fill('少女');
  await stopped();
  await host.getByRole('searchbox').fill('');
  await sampler('young').click();
  await host.locator('[data-rs-voice-card=elite] .rs-voice-select').click();
  await stopped();
  await filter.click();
  assert.ok(await filters.getByLabel('语言').locator('option').count()>=24);
  assert.ok(await filters.getByLabel('口音').isDisabled());
  await filters.getByLabel('语言').selectOption('中文');
  await filters.getByLabel('口音').selectOption('粤语');
  await filters.getByLabel('语言').selectOption('英文');
  assert.ok(await filters.getByLabel('口音').isDisabled());
  await filters.getByLabel('性别').selectOption('女');
  assert.equal(await host.locator('.rs-voice-card').count(),20);
  await page.keyboard.press('Escape');
  await sampler('young').click();
  await filter.click();
  assert.equal(await filters.getByLabel('性别').inputValue(),'');
  await filters.getByLabel('性别').selectOption('女');
  await filters.getByRole('button',{name:'筛选',exact:true}).click();
  assert.equal(await host.locator('.rs-voice-card').count(),9);
  await stopped();
  await page.evaluate(()=>window.restoreSampleProbe());
  await filter.click();
  await filters.getByRole('button',{name:'重置筛选'}).click();
  await filters.getByRole('button',{name:'儿童',exact:true}).click();
  await filters.getByRole('button',{name:'筛选',exact:true}).click();
  assert.equal(await host.locator('.rs-voice-card').count(),4);
  await filter.click();
  await filters.getByRole('button',{name:'重置筛选'}).click();
  await filters.getByRole('button',{name:'青年',exact:true}).click();
  await filters.getByRole('button',{name:'筛选',exact:true}).click();
  assert.equal(await host.locator('.rs-voice-card').count(),12);
  await filter.click();
  await filters.getByRole('button',{name:'重置筛选'}).click();
  await filters.getByRole('button',{name:'筛选',exact:true}).click();
  await host.getByRole('searchbox').fill('聪明男童');
  assert.equal(await host.locator('.rs-voice-card').count(),1);
  await host.getByRole('button',{name:'试听聪明男童'}).click();
  await host.getByRole('button',{name:'停止试听聪明男童'}).waitFor();
  const decoded = await page.evaluate(async ids => {
    const context = new AudioContext();
    try {
      const lengths = [];
      for (const id of ids) {
        const response = await fetch('/assets/role-studio/voices/'+id+'.mp3');
        const audio = await context.decodeAudioData(await response.arrayBuffer());
        const peak = audio.getChannelData(0).reduce((result,sample)=>Math.max(result,Math.abs(sample)),0);
        if (peak < 0.01) throw Error('silent sample '+id);
        lengths.push(audio.duration);
      }
      return lengths;
    } finally { await context.close(); }
  },expectedSamples.map(([id])=>id));
  assert.ok(decoded.every(n=>Number.isFinite(n) && n>6.5 && n<12.6),'duration of the official recordings: '+decoded);
  await host.locator('.rs-voice-select').click();
  assert.equal(await page.evaluate(()=>JSON.parse(window.voiceValues['voice.selection']).name),'聪明男童');
  await host.locator('.rs-voice-body > label select').selectOption('fixed-tts');
  await host.getByText('共 46 个音色').waitFor();
  await filter.click();
  await filters.getByLabel('性别').selectOption('女');
  await filters.getByRole('button',{name:'青年',exact:true}).click();
  await filters.getByRole('button',{name:'儿童',exact:true}).click();
  await filters.getByLabel('语言').selectOption('中文');
  await filters.getByLabel('口音').selectOption('粤语');
  await filters.getByRole('button',{name:'筛选',exact:true}).click();
  await host.getByText('共 23 个音色').waitFor();
  const later = host.getByRole('button',{name:/^声线 43 /});
  if (!await later.count()) await host.getByRole('button',{name:'加载更多音色'}).click();
  await later.click();
  const supplier = await page.evaluate(()=>JSON.parse(window.voiceValues['voice.selection']));
  assert.deepEqual(supplier.profile,{modelId:'fixed-tts',voice:'speaker-43'});
  assert.equal(supplier.source,'provider');
  await page.evaluate(async voice => {
    const record={id:'provider-role',name:'供应商角色',images:['/role-library/web/001-1.jpg','','',''],
      styling:{version:1,controls:{'voice.selection':JSON.stringify(voice)}}};
    const r=await fetch('/api/preset-roles/record?scope=mine',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:record.id,record})});
    if(!r.ok)throw Error(await r.text());
  },supplier);
  await host.getByRole('tab',{name:'我的音色'}).click();
  await host.getByText('暂无音色数据').waitFor({timeout:3000}).catch(async err => {
    throw new Error(err.message + '\nPanel: ' + await host.innerText());
  });
  await host.getByRole('tab',{name:'AI 生成'}).click();
  await host.getByText('暂无历史记录').waitFor();
  const generate = host.getByRole('button',{name:'生成音色',exact:true});
  await page.waitForFunction(()=>!document.querySelector('.rs-voice-generate').disabled);
  await host.getByLabel('语音模型').selectOption('role-tts');
  await host.locator('textarea').fill('gentle voice');
  await generate.click();
  await host.getByRole('button',{name:'保存并使用'}).click();
  let form=host.getByRole('form',{name:'保存音色资料'});
  assert.ok(await form.getByRole('button',{name:'保存并使用'}).isDisabled());
  await form.getByLabel('名称').fill('取消这次编辑');
  await form.getByRole('button',{name:'取消'}).click();
  assert.equal(await page.evaluate(async()=>(await (await fetch('/api/assets')).json()).assets.filter(a=>a.roleVoiceProfile).length),0);
  await host.getByRole('button',{name:'保存并使用'}).click();
  form=host.getByRole('form',{name:'保存音色资料'});
  for (const [label,value] of Object.entries({名称:'粤语旁白',语言:'粤语',年龄段:'中年',性别:'女',口音:'广州',描述:'试读档案'})) await form.getByLabel(label).fill(value);
  await form.getByRole('button',{name:'保存并使用'}).click();
  await host.getByText('音色已保存到我的音色。').waitFor();
  await mount();
  await host.getByRole('tab',{name:'AI 生成'}).click();
  await host.locator('.rs-voice-result audio').waitFor();
  await host.getByRole('button',{name:'使用音色'}).click();
  await host.getByText('已选择「粤语旁白」。').waitFor();
  await host.getByRole('tab',{name:'我的音色'}).click();
  await host.locator('.rs-voice-card').waitFor();
  assert.equal(await host.locator('.rs-voice-card').count(),1);
  await host.locator('.rs-voice-select').click();
  const choice = await page.evaluate(async () => {
    const value = JSON.parse(window.voiceValues['voice.selection']);
    const record = {id:'role-fixture-actor',name:'测试声线角色',value:'',
      images:['/role-library/web/001-1.jpg','/role-library/web/001-2.jpg','',''],
      styling:{version:1,controls:window.voiceValues,prompt:''}};
    const response = await fetch('/api/preset-roles/record?scope=mine', {method:'PUT',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({id:record.id,record})});
    if (!response.ok) throw Error('保存角色失败');
    return value;
  });
  assert.match(choice.profile.description,/角色：Fixture[\s\S]*gentle voice/);
  assert.equal(choice.profile.modelId,'role-tts');
  assert.deepEqual([choice.name,choice.language,choice.ageGroup,choice.gender,choice.accent,choice.description],
    ['粤语旁白','粤语','中年','女','广州','试读档案']);
  await page.reload();
  await page.getByRole('button',{name:'新建项目'}).first().click();
  await page.locator('#roleLibraryBtn').click();
  await page.locator('[data-role-scope=mine]').click();
  await page.locator('[data-role-style="role-fixture-actor"]').click();
  const studio = page.getByRole('dialog',{name:'角色造型室'});
  await studio.locator('[data-tab=eyes]').click();
  await studio.locator('[data-field="face.eyes.eyeWidthLeft"]').press('End');
  const appearance=studio.locator('.rs-appearance-preview');
  await appearance.waitFor({state:'visible',timeout:20000});
  const compare=studio.getByRole('button',{name:'按住对比'});
  await compare.focus();await page.keyboard.down('Space');
  assert.equal(await appearance.isHidden(),true);
  assert.equal(await studio.locator('.rs-subject-preview').isVisible(),true);
  await page.keyboard.up('Space');await appearance.waitFor({state:'visible'});
  await studio.locator('[data-action=undo]').click();
  await appearance.waitFor({state:'hidden'});
  await studio.locator('[data-mode=voice]').click();
  await studio.getByRole('tab',{name:'我的音色'}).click();
  await studio.locator('.rs-voice-card.is-selected').waitFor();
  await studio.locator('[data-action=save]').click();
  await studio.getByRole('menuitem',{name:'更新当前角色'}).click();
  await studio.waitFor({state:'detached'});
  await page.locator('#roleLibraryModal button.role-library-close').click();
  await page.locator('[data-empty-add="audio"]').click({timeout:5000});
  await page.locator('#audioVoiceSelectBtn').click();
  await page.locator('[data-voice-tab="roles"]').click();
  await page.locator('[data-voice-select="role:role-fixture-actor"]').first().click();
  const actor = page.locator('.flow-node.selected[data-node=audio]');
  assert.equal(await actor.evaluate(el=>JSON.parse(el.dataset.roleVoice).profile.voice),choice.profile.voice);
  await page.locator('#promptInput').fill('Read these new words.');
  const submission = page.waitForRequest(r=>r.method()==='POST' && new URL(r.url()).pathname === '/api/ai/tts');
  await page.locator('#generateAudioBtn').click();
  const payload = (await submission).postDataJSON();
  assert.equal(payload.text,'Read these new words.');
  assert.equal(payload.modelId,choice.profile.modelId);
  assert.equal(payload.voice,choice.profile.voice);
  assert.equal(payload.spec.instructions,choice.profile.description);
  await page.waitForFunction(()=>document.querySelector('.flow-node[data-node=audio]')?.dataset.audioUrl?.startsWith('/media/'));
  await page.waitForFunction(async () => {
    const {projects} = await (await fetch('/api/projects')).json();
    for (const summary of projects || []) {
      const {project} = await (await fetch('/api/projects/'+encodeURIComponent(summary.id))).json();
      if (project?.nodes?.some(n => n.type === 'audio' && JSON.parse(n.roleVoice || '{}').profile?.description?.includes('gentle voice') && n.audioUrl?.startsWith('/media/'))) return true;
    }
    return false;
  });
  await page.locator('#audioVoiceSelectBtn').click();
  await page.locator('[data-voice-tab="roles"]').click();
  await page.locator('[data-voice-select="role:provider-role"]').click();
  await page.locator('#promptInput').fill('Use the selected speaker.');
  const direct = page.waitForRequest(r=>r.method()==='POST' && new URL(r.url()).pathname === '/api/ai/tts');
  const reply = page.waitForResponse(r=>r.request().method()==='POST' && new URL(r.url()).pathname === '/api/ai/tts');
  await page.locator('#generateAudioBtn').click();
  const request = (await direct).postDataJSON();
  assert.equal(request.modelId,'fixed-tts'); assert.equal(request.voice,'speaker-43');
  assert.equal(request.text,'Use the selected speaker.'); assert.deepEqual(request.spec,{});
  const {jobId} = await (await reply).json();
  await page.waitForFunction(async id => {
    const {job} = await (await fetch('/api/jobs/'+id)).json();
    if (job.status==='failed') throw Error(job.error);
    return job.status==='completed' && job.audioUrl?.startsWith('/media/');
  },jobId);
  const sharedClip = await page.evaluate(async () => {
    const post = async (url, body) => {
      const res = await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      if (!res.ok) throw Error(await res.text()); return res.json();
    };
    const prior = (await (await fetch('/api/assets')).json()).assets.find(a=>a.roleVoiceJobId);
    const {jobId} = await post('/api/ai/tts',{modelId:'role-tts',voice:'speaker-b',text:'Another audition.',asyncTask:true,
      spec:{instructions:'gentle voice'},roleVoiceName:'第二段音色',roleVoiceDescription:'gentle voice'});
    let job;
    for (let i=0;i<50;i++) {
      ({job}=await (await fetch('/api/jobs/'+jobId)).json());
      if (job.status==='completed') break;
      if (job.status==='failed') throw Error(job.error);
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    const body={kind:'audio',name:'角色音色 · 第二段音色',mediaId:job.audioUrl.slice(7),roleVoiceJobId:jobId,roleVoiceMetadata:{language:'中文',gender:'女',ageGroup:'青年'}};
    const [a,b]=await Promise.all([post('/api/assets',body),post('/api/assets',body)]);
    return [prior.mediaUrl===job.audioUrl, a.asset.id!==prior.id, a.asset.id===b.asset.id, a.asset.roleVoiceProfile.voice];
  });
  assert.deepEqual(sharedClip,[true,true,true,'speaker-b']);
  await mount();
  await host.getByRole('tab',{name:'AI 生成'}).click();
  await host.getByText('Use the selected speaker.',{exact:true}).waitFor();
  assert.ok(await host.getByRole('button',{name:'仅可试听'}).first().isDisabled());
  await host.getByLabel('语音模型').selectOption('native-tts');
  await host.getByLabel('AI 音色描述').fill('warm native voice');
  const designRequest=page.waitForRequest(r=>r.method()==='POST' && new URL(r.url()).pathname==='/api/ai/tts');
  await host.getByRole('button',{name:'生成音色',exact:true}).click();
  const projectId=(await designRequest).postDataJSON().projectId;
  assert.ok(projectId);
  await page.waitForFunction(()=>document.querySelectorAll('#voiceFixture .rs-voice-result audio').length===4);
  const players=host.locator('.rs-voice-result audio');
  await players.nth(0).evaluate(player=>player.play());
  await players.nth(1).evaluate(player=>player.play());
  assert.ok(await players.nth(0).evaluate(player=>player.paused));
  await players.nth(1).evaluate(player=>player.pause());
  const candidate=host.locator('.rs-voice-result').filter({has:page.getByRole('button',{name:'保存并使用'})}).first();
  await candidate.getByRole('button',{name:'保存并使用'}).click();
  const registration=host.getByRole('form',{name:'保存音色资料'});
  for (const [label,value] of Object.entries({名称:'专属测试',年龄段:'成年',性别:'女'})) await registration.getByLabel(label).fill(value);
  await registration.getByRole('button',{name:'保存并使用'}).click();
  await host.getByText('模拟供应商拒绝注册').waitFor();
  await registration.getByRole('button',{name:'保存并使用'}).click();
  await host.getByText('模拟供应商回复丢失').waitFor();
  await registration.getByRole('button',{name:'保存并使用'}).click();
  await host.getByText('音色已保存到我的音色。').waitFor();
  const registered=await page.evaluate(async projectId=>{
    const json=async url=>(await (await fetch(url)).json());
    const history='/api/jobs?kind=audio&view=role-voices';
    const scoped=await json(history+'&projectId='+encodeURIComponent(projectId)+'&limit=2');
    const tail=await json(history+'&projectId='+encodeURIComponent(projectId)+'&limit=2&offset=2');
    const unassigned=await json(history+'&unassignedOnly=1');
    const value=JSON.parse(window.voiceValues['voice.selection']);
    const template={id:'native-role',name:'专属配音角色',images:['/role-library/web/001-1.jpg','','',''],
      styling:{version:1,controls:{'voice.selection':JSON.stringify(value)}}};
    const response=await fetch('/api/preset-roles/record?scope=mine',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:template.id,record:template})});
    if(!response.ok)throw Error(await response.text());
    const audioOnly=await fetch('/api/assets',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'角色音色 · 旧录音',kind:'audio',mediaId:value.url.slice(7)})});
    if(!audioOnly.ok)throw Error(await audioOnly.text());
    return {profile:value.profile,first:scoped.jobs.map(j=>j.id),tail:tail.jobs.map(j=>j.id),total:scoped.total,unassigned:unassigned.jobs.map(j=>j.id)};
  },projectId);
  assert.deepEqual(registered.profile,{kind:'registered',provider:'elevenlabs',modelId:'native-tts',voice:'registered-test-voice'});
  assert.equal(registered.total,4); assert.equal(registered.first.length,2); assert.equal(registered.tail.length,2);
  assert.equal(new Set([...registered.first,...registered.tail]).size,4);
  assert.ok(registered.unassigned.length>=1 && registered.unassigned.every(id=>![...registered.first,...registered.tail].includes(id)));
  await host.getByRole('tab',{name:'我的音色'}).click();
  const legacy=host.locator('.rs-voice-card').filter({hasText:'旧录音'});
  await legacy.getByText('仅可试听').waitFor();
  assert.ok(await legacy.locator('.rs-voice-select').isDisabled());
  await legacy.getByRole('button',{name:'试听旧录音'}).click();
  await legacy.getByRole('button',{name:'停止试听旧录音'}).waitFor();
  await page.reload();
  await page.getByRole('button',{name:'新建项目'}).first().click();
  await page.locator('[data-empty-add="audio"]').click();
  await page.locator('#audioVoiceSelectBtn').click();
  await page.locator('[data-voice-tab="roles"]').click();
  await page.locator('[data-voice-select="role:native-role"]').click();
  await page.locator('#promptInput').fill('Speak as the registered actor.');
  const spoken=page.waitForResponse(r=>r.request().method()==='POST' && new URL(r.url()).pathname==='/api/ai/tts');
  await page.locator('#generateAudioBtn').click();
  const nativeRequest=await spoken;
  assert.equal(nativeRequest.request().postDataJSON().voice,'registered-test-voice');
  const nativeJob=await nativeRequest.json();
  await page.waitForFunction(async id=>{
    const {job}=await (await fetch('/api/jobs/'+id)).json();
    if(job.status==='failed')throw Error(job.error); return job.status==='completed' && job.audioUrl?.startsWith('/media/');
  },nativeJob.jobId);
  await checkPendingVoiceEditor(page);
  console.log('20 samples decoded; explicit filters, required metadata, 46-voice catalog, scoped history pagination, three design candidates, interrupted registration recovery, preview-only assets and all three canvas dialogue paths passed.');
}

async function checkPendingVoiceEditor(page) {
  await page.evaluate(()=>{
    const candidate={id:'job-voice-lock',name:'测试音色',url:'/assets/role-studio/voices/young.mp3',
      profile:{modelId:'fixture',kind:'preview',description:'模拟的音色登记'}};
    window.voiceCalls=0;
    window.createRoleVoiceService=()=>({
      models:async()=>[{id:'fixture',name:'Fixture',design:true}],mine:async()=>[],history:async()=>({entries:[],total:0}),
      generate:()=>new Promise(resolve=>{window.voiceCalls++;window.finishGeneration=()=>resolve(candidate);}),
      save:()=>new Promise(resolve=>{window.finishRegistration=()=>resolve({...candidate,id:'saved-voice',source:'mine',
        profile:{modelId:'fixture',kind:'registered',voice:'saved-voice'}});}),
    });
    window.CanvasFlowRoleStudio.open({role:{id:'lock-fixture',name:'测试人物',images:[],tags:['青年','男']},
      official:false,escapeHtml:String,workspaceKey:'voice-lock-test',persist:async record=>{window.lockedRole=record;return record;},
      saved() {},exitLibrary() {},notify() {}});
  });
  const studio=page.getByRole('dialog',{name:'角色造型室'});
  const voice=studio.locator('[data-mode=voice]'),face=studio.locator('[data-mode=face]');
  await voice.click();
  const design=studio.getByRole('tab',{name:'AI 生成'});
  await design.click();
  await studio.getByRole('button',{name:'生成音色',exact:true}).click();
  await face.click(); await voice.click();
  assert.equal(await design.getAttribute('aria-selected'),'true');
  assert.ok(await studio.getByRole('button',{name:'生成中…',exact:true}).isDisabled());
  assert.equal(await page.evaluate(()=>window.voiceCalls),1);
  await page.evaluate(()=>window.finishGeneration());
  await studio.getByRole('button',{name:'保存并使用'}).click();
  await studio.getByRole('form',{name:'保存音色资料'}).getByRole('button',{name:'保存并使用'}).click();
  await face.click();
  for (const action of ['save','apply','back','close']) assert.ok(await studio.locator('[data-action='+action+']').isDisabled(),action);
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('alertdialog').count(),0);
  assert.ok(await studio.isVisible());
  await page.evaluate(()=>window.finishRegistration());
  await studio.locator('[data-action=save]').click();
  await studio.getByRole('menuitem',{name:'更新当前角色'}).click();
  await studio.waitFor({state:'hidden'});
  assert.equal(await page.evaluate(()=>JSON.parse(window.lockedRole.styling.controls['voice.selection']).id),'saved-voice');
}
main().catch(e => {console.error(e);process.exitCode=1;}).finally(async () => {
  await browser?.close();
  const exit = server.exitCode === null ? new Promise(resolve => server.once('exit',resolve)) : Promise.resolve();
  server.kill(); await exit;
  const target = fs.realpathSync(data);
  if (path.dirname(target) === fs.realpathSync(os.tmpdir()) && path.basename(target).startsWith('canvasflow-voice-test-')) {
    fs.rmSync(target,{recursive:true,force:true,maxRetries:3});
  }
});
