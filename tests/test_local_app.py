"""Local app integration checks. Uses isolated storage and no paid upstream calls."""
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import unittest
import base64
import wave
from unittest.mock import patch
from urllib.error import HTTPError
from urllib.request import Request, build_opener, ProxyHandler

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
DATA = tempfile.TemporaryDirectory(prefix='canvasflow-local-test-')
os.environ['CANVASFLOW_DATA_DIR'] = DATA.name
data = Path(DATA.name)
(data / 'projects.json').write_text(json.dumps([
    {'id':'legacy-a','projectName':'Existing A','ownerId':'old-a','nodes':[],'edges':[], 'shared':True},
    {'id':'legacy-b','projectName':'Existing B','ownerId':'old-b','nodes':[],'edges':[],
     'workspaceId':'workspace-default-old-b'},
]), encoding='utf-8')
(data / 'ai-models.json').write_text(json.dumps([
    {'id':'local-model','name':'Local','model':'local-model','kind':'i2t','type':'i2t','usages':['text'],
     'baseUrl':'http://127.0.0.1:9999','ownerId':'old-b','enabled':True,'apiKey':'',
     'pricing':{'perCall':100000},'billing':'per-call'},
]), encoding='utf-8')
import server


class LocalAppTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.http = server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler)
        server.Handler.log_message = lambda *args: None
        cls.base = 'http://127.0.0.1:'+str(cls.http.server_address[1])
        threading.Thread(target=cls.http.serve_forever,daemon=True).start()
        cls.client = build_opener(ProxyHandler({}))

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown();cls.http.server_close();DATA.cleanup()

    def api(self,path,method='GET',body=None,headers=None):
        request=Request(self.base+path,method=method,
                        data=json.dumps(body).encode() if body is not None else None,
                        headers={'Content-Type':'application/json',**(headers or {})})
        try:
            with self.client.open(request,timeout=10) as response:
                return response.status,json.load(response)
        except HTTPError as error:
            return error.code,json.load(error)

    def test_role_library_images_and_saved_legacy_urls(self):
        expected = (server.ROOT / 'role-library/web/001-1.jpg').read_bytes()
        for prefix in ('role-library', '_libtv_roles'):
            with self.subTest(prefix=prefix):
                with self.client.open(self.base + '/' + prefix + '/web/001-1.jpg', timeout=10) as response:
                    self.assertEqual(response.status, 200)
                    self.assertEqual(response.read(), expected)
                for suffix in ('/_manifest.json', '/web/../../server.py', '/web/../_manifest.json'):
                    with self.assertRaises(HTTPError) as error:
                        self.client.open(self.base + '/' + prefix + suffix, timeout=10)
                    self.assertEqual(error.exception.code, 404)

    def test_video_studio_lists_video_jobs_with_and_without_kind(self):
        fixtures = [
            {'id': 'legacy-video', 'status': 'completed', 'simulated': False},
            {'id': 'explicit-video', 'kind': 'video', 'status': 'running', 'simulated': False},
            {'id': 'image', 'kind': 'image', 'status': 'completed', 'simulated': False},
        ]
        with patch.object(server, 'latest_jobs', return_value=fixtures):
            status, result = self.api('/api/jobs?kind=video')
        self.assertEqual(status, 200)
        self.assertEqual([job['id'] for job in result['jobs']], ['legacy-video', 'explicit-video'])
        self.assertEqual(result['activeCount'], 1)

    def test_long_prompts_survive_project_rich_text_roles_and_presets(self):
        prompt = '完整提示词内容。' * 3000 + '最后一句必须保留'
        _, created = self.api('/api/projects', 'POST', {'projectName': 'Long prompts regression'})
        project = {**created['project'], 'modelPrompt': prompt,
                   'advancedSettings': {'negativePrompt': prompt},
                   'nodes': [{'id': 'text', 'type': 'prompt', 'copy': prompt, 'copyHtml': '<p>' + prompt + '</p>', 'textInstruction': prompt}]}
        path = '/api/projects/' + project['id']
        self.assertEqual(self.api(path, 'PUT', project)[0], 200)
        saved = self.api(path)[1]['project']
        self.assertEqual(saved['modelPrompt'], prompt)
        self.assertEqual(saved['advancedSettings']['negativePrompt'], prompt)
        self.assertEqual(saved['nodes'][0]['copy'], prompt)
        self.assertEqual(saved['nodes'][0]['textInstruction'], prompt)
        self.assertIn(prompt, saved['nodes'][0]['copyHtml'])
        self.assertEqual(server._clean_role({'id': 'role', 'name': 'role', 'value': prompt})['value'], prompt)
        preset = next(iter(server.PRESET_PROMPT_DEFAULTS))
        self.assertEqual(server.write_preset_prompts({'prompts': {preset: prompt}})['prompts'][preset], prompt)
        kind = next(iter(server.DOCK_PROMPT_DEFAULTS))
        key = next(iter(server.DOCK_PROMPT_DEFAULTS[kind]))
        self.assertEqual(server.write_dock_prompts({'prompts': {kind: {key: prompt}}})['prompts'][kind][key], prompt)
        skill, error = server.save_agent_skill(server.LOCAL_ID, 'Long prompt regression', prompt=prompt)
        self.assertIsNone(error)
        self.assertEqual(skill['prompt'], prompt)
        self.assertNotIn('onclick', server.sanitize_rich_text('<p onclick="bad()">' + prompt + '</p>'))

    def test_long_tts_text_and_audio_prompt_options_reach_upstream_intact(self):
        prompt = '用于配音的完整内容。' * 1500 + '最后一句'
        entry = {'baseUrl': 'https://tts.invalid/v1', 'apiKey': 'fixture', 'model': 'fixture'}
        with patch.object(server, 'request_bytes_candidates', return_value=(b'fixture', '', None)) as request:
            audio, error = server.call_tts(entry, prompt)
        self.assertIsNone(error)
        self.assertTrue(audio.startswith('data:audio/'))
        self.assertEqual(request.call_args.args[1]['input'], prompt)
        self.assertEqual(server.sanitize_audio_spec({'lyrics': prompt})['lyrics'], prompt)

    def test_review_references_survive_materialization_and_second_save(self):
        png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg=='
        status, result = self.api('/api/projects', 'POST', {'projectName': 'References regression'})
        self.assertEqual(status, 201)
        project = result['project']
        project['references'] = [{'id': 'ref', 'ownerNodeId': 'image', 'name': 'original', 'data': png}]
        path = '/api/projects/' + project['id']
        self.assertEqual(self.api(path, 'PUT', project)[0], 200)
        stored = self.api(path)[1]['project']
        self.assertTrue(stored['references'][0]['data'].startswith('/media/'))
        self.assertEqual(self.api(path, 'PUT', stored)[0], 200)
        again = self.api(path)[1]['project']
        self.assertEqual(again['references'], stored['references'])
        unsafe = server.clean_project({'references': [{'data': '/media/../../server.py'}, {'data': 'javascript:alert(1)'}]})
        self.assertEqual(unsafe['references'], [])

    def test_review_script_and_video_options_roundtrip_without_truncation(self):
        shots = json.dumps([{'prompt': 'detail' * 1000}] * 51)
        assets = json.dumps([{'description': 'detail' * 1000}] * 26)
        settings = {'modelId': 'video', 'resolution': '1080P', 'cameraMove': 'push', 'duration': '4 秒',
                    'generateAudio': False, 'generateCount': 4, 'modelOptions': {'seed': 123, 'style': 'natural'}}
        _, created = self.api('/api/projects', 'POST', {'projectName': 'Large script regression'})
        project = {**created['project'], 'nodes': [{'id': 'script', 'type': 'script', 'shots': shots, 'scriptAssets': assets}], 'generationSettings': settings}
        path = '/api/projects/' + project['id']
        self.assertEqual(self.api(path, 'PUT', project)[0], 200)
        saved = self.api(path)[1]['project']
        self.assertEqual(json.loads(saved['nodes'][0]['shots']), json.loads(shots))
        self.assertEqual(json.loads(saved['nodes'][0]['scriptAssets']), json.loads(assets))
        for key, value in settings.items(): self.assertEqual(saved['generationSettings'][key], value)

    def test_review_audio_file_and_job_bindings_persist_in_project(self):
        media_id = 'media-' + 'c' * 32 + '.wav'
        (server.MEDIA_DIR / media_id).write_bytes(b'audio-fixture')
        _, created = self.api('/api/projects', 'POST', {'projectName': 'Audio regression'})
        node = {'id': 'audio', 'type': 'audio', 'trackId': 'track', 'audioUrl': '/media/' + media_id,
                'audioName': 'Saved audio', 'generationJobId': 'job-a', 'appliedGenerationJobId': 'job-a'}
        project = {**created['project'], 'nodes': [node]}
        path = '/api/projects/' + project['id']
        self.assertEqual(self.api(path, 'PUT', project)[0], 200)
        saved = self.api(path)[1]['project']['nodes'][0]
        for key, value in node.items(): self.assertEqual(saved[key], value)

    def test_review_schema_failure_retries_and_credentials_do_not_share_cache(self):
        entry = {'id': 'custom', 'baseUrl': 'https://schema.invalid', 'apiKey': 'key-a'}
        server.MEDIA_SCHEMA_CACHE.clear()
        with patch.object(server, 'request_json_first_hit', side_effect=[(503, {}, 'unavailable', ''), (200, {'params': [{'name': 'size'}]}, '', '')]) as request:
            self.assertEqual(server.media_model_schema(entry, 'model'), {})
            self.assertIn('size', server.media_model_schema(entry, 'model'))
            self.assertIn('size', server.media_model_schema(entry, 'model'))
            self.assertEqual(request.call_count, 2)
        with patch.object(server, 'request_json_first_hit', return_value=(200, {'params': [{'name': 'quality'}]}, '', '')) as request:
            self.assertIn('quality', server.media_model_schema({**entry, 'apiKey': 'key-b'}, 'model'))
            request.assert_called_once()
        with patch.object(server.time, 'monotonic', return_value=10**15), patch.object(server, 'request_json_first_hit', return_value=(200, {'params': [{'name': 'updated'}]}, '', '')):
            self.assertIn('updated', server.media_model_schema(entry, 'model'))
        server.MEDIA_SCHEMA_CACHE.clear()

    def test_review_stale_poll_cannot_overwrite_terminal_snapshot(self):
        for terminal in ('completed', 'failed'):
            with self.subTest(terminal=terminal), patch.object(server, 'JOBS_FILE', data / ('review-' + terminal + '.jsonl')):
                original = {'id': 'race', 'kind': 'image', 'userId': server.LOCAL_ID, 'status': 'running', 'progress': 1, 'simulated': False}
                server.append_job(original)
                def refresh(job):
                    server.append_job({**job, 'status': terminal, 'progress': 100})
                    return {**job, 'status': 'running', 'progress': 20}
                with patch.object(server, 'refresh_image_job', side_effect=refresh):
                    current = server._refresh_job_view(original)
                self.assertEqual(current['status'], terminal)
                self.assertEqual(server.latest_jobs()[0]['status'], terminal)
                late = {**original, 'status': 'completed'}
                server.append_job(late)
                self.assertEqual(late['status'], terminal)

    def test_boot_without_cookie_and_legacy_projects(self):
        status,result=self.api('/api/local/bootstrap')
        self.assertEqual(status,200);self.assertEqual(result['mode'],'local')
        status,result=self.api('/api/projects')
        self.assertEqual(status,200)
        self.assertTrue({'legacy-a','legacy-b'} <= {p['id'] for p in result['projects']})
        for id in ('legacy-a','legacy-b'):
            status,result=self.api('/api/projects/'+id)
            self.assertEqual(status,200);self.assertFalse(result['project']['shared'])

    def test_audio_async_job_preserves_custom_status_route(self):
        for route in ('media/tasks/{task_id}', ''):
            entry = {'id':'qa-audio', 'enabled':True, 'usages':['audio'],
                     'requestProfile':'media-generate', 'imageStatusPath':route}
            with self.subTest(route=route), \
                 patch.object(server, 'visible_ai_models', return_value=[entry]), \
                 patch.object(server, 'submit_audio_media_generate', return_value=({'data':{'task_id':'upstream-once'}}, None)) as submit, \
                 patch.object(server, 'append_job'):
                job, error = server.create_audio_job({'id':'local-device'}, {'modelId':'qa-audio','text':'test'})
                self.assertIsNone(error)
                self.assertEqual(job['providerJobId'], 'upstream-once')
                self.assertEqual(job['imageStatusPath'], route or server.MEDIA_STATUS_PATH)
                submit.assert_called_once()

    def test_imported_media_contract_schema_when_gateway_has_no_skills_route(self):
        entry = {'id':'newapi-lk888-qa-video','model':'MiniMax-H3',
                 'baseUrl':'https://schema.example/lk888','apiKey':'test-key'}
        server.MEDIA_SCHEMA_CACHE.clear()
        with patch.object(server, 'request_json_first_hit', return_value=(404, {}, 'not found', '')):
            schema = server.media_model_schema(entry, entry['model'])
        self.assertEqual([v['value'] for v in schema['duration']['options']][0], '4')
        self.assertTrue(schema['resolution']['required'])
        server.MEDIA_SCHEMA_CACHE.clear()
        with patch.object(server, 'request_json_first_hit', return_value=(404, {}, 'not found', '')):
            self.assertEqual(server.media_model_schema({**entry,'id':'ordinary-provider'}, entry['model']), {})
        server.MEDIA_SCHEMA_CACHE.clear()

    def test_completed_video_reports_full_progress_even_when_provider_says_99(self):
        entry = {'id':'qa-video','usages':['video'],'requestProfile':'media-generate'}
        result = {'state':'success','progress':99,'result_url':'https://example.test/result.mp4'}
        with patch.object(server, 'read_ai_models', return_value=[entry]), \
             patch.object(server, 'provider_status_request', return_value=(result,None,'')), \
             patch.object(server, 'persist_job_video'):
            job = server.refresh_video_job({'id':'job-test','modelId':'qa-video','status':'running'})
            self.assertEqual(job['status'], 'completed')
            self.assertEqual(job['progress'], 100)
            job['progress'] = 99
            self.assertEqual(server.refresh_video_job(job)['progress'], 100)

    def test_project_create_save_reload_delete(self):
        status,result=self.api('/api/projects','POST',{'projectName':'Local test'})
        self.assertEqual(status,201)
        project=result['project'];id=project['id']
        status,result=self.api('/api/projects/'+id,'PUT',{**project,'projectName':'Saved locally','nodes':[], 'edges':[]})
        self.assertEqual(status,200)
        status,result=self.api('/api/projects/'+id)
        self.assertEqual(result['project']['projectName'],'Saved locally')
        self.assertEqual(self.api('/api/projects/'+id,'DELETE')[0],200)

    def test_platform_routes_removed(self):
        for path in ('/api/auth/me','/api/auth/login','/api/admin/users','/api/community',
                     '/api/portfolio','/api/notifications','/api/admin/notifications','/api/credits',
                     '/api/subscription-plans','/api/share/old','/share.html','/support.js',
                     '/api/previs/projects/legacy-a/share','/api/previs/assets/old/share'):
            for method in ('GET','POST'):
                with self.subTest(path=path,method=method):
                    self.assertEqual(self.api(path,method,{} if method=='POST' else None)[0],404)

    def test_text_instruction_roundtrip_does_not_overwrite_body(self):
        _, result = self.api('/api/projects', 'POST', {'projectName': 'Instruction persistence'})
        project = result['project']; route = '/api/projects/' + project['id']
        project['nodes'] = [{'id':'text-1','type':'prompt','copy':'Generated body',
                             'textInstruction':'  Separate instruction  '}]
        self.assertEqual(self.api(route, 'PUT', project)[0], 200)
        _, result = self.api(route)
        saved = result['project']; node = saved['nodes'][0]
        self.assertEqual(node['copy'], 'Generated body')
        self.assertEqual(node['textInstruction'], '  Separate instruction  ')
        node['textInstruction'] = '长提示词🌲' * 1200
        saved['modelPrompt'] = '镜头运动' * 1600
        saved['nodes'].append({'id':'image-long','type':'image','copy':'图片描述' * 1600})
        _, result = self.api(route, 'PUT', saved)
        self.assertEqual(result['project']['nodes'][0]['textInstruction'], '长提示词🌲' * 1200)
        self.assertEqual(result['project']['modelPrompt'], '镜头运动' * 1600)
        self.assertEqual(self.api(route)[1]['project']['nodes'][1]['copy'], '图片描述' * 1600)
        self.assertEqual(self.api(route)[1]['project']['nodes'][0]['textInstruction'], '长提示词🌲' * 1200)
        saved = result['project']; saved['nodes'][0]['textInstruction'] = ''
        _, result = self.api(route, 'PUT', saved)
        self.assertEqual(result['project']['nodes'][0]['textInstruction'], '')
        self.assertEqual(result['project']['nodes'][0]['copy'], 'Generated body')
        self.assertEqual(self.api(route, 'DELETE')[0], 200)

    def test_image_controls_persist_and_reference_edit_payload_contains_all_inputs(self):
        _, result = self.api('/api/projects', 'POST', {'projectName': 'Image input fixture'})
        project = result['project']; route = '/api/projects/' + project['id']
        controls = {'modelId': 'fixture', 'mode': 'text-to-image', 'resolution': '2731x4096',
                    'aspect': '2:3', 'count': 2, 'quality': 'max',
                    'cameraControl': {'enabled': True, 'camera': 'camera-a', 'lens': 'lens-a', 'focal': '35', 'aperture': '2.8'},
                    'modelOptions': {'style': 'natural'}}
        project['imageGenerationSettings'] = controls
        self.assertEqual(self.api(route, 'PUT', project)[0], 200)
        self.assertEqual(self.api(route)[1]['project']['imageGenerationSettings'], controls)
        self.assertEqual(self.api(route, 'DELETE')[0], 200)
        entry = {'model': 'gpt-image-2.5', 'baseUrl': 'https://fixture.invalid', 'apiKey': 'fixture-only',
                 'imageTransport': 'openai-images', 'referenceInputModes': ['base64'],
                 'mediaParams': {'version': 'enhanced', 'background': 'opaque', 'prompt': 'must not replace prompt'}}
        reference = 'data:image/png;base64,' + base64.b64encode(b'fixture-image-bytes').decode()
        prompt = 'Full image prompt ' * 200
        self.assertEqual(server.image_quality_value('tt-image-2.5', 'auto'), 'auto')
        self.assertEqual(server.image_quality_value('tt-image-2.5', 'medium'), 'medium')
        trace = {}
        with patch.object(server, 'upstream_contract', return_value={'params': [{'name':'version','type':'select'}, {'name':'background','type':'select'}, {'name':'prompt','type':'textarea'}]}), \
             patch.object(server, 'resolve_reference_values', return_value=([reference], None)), \
             patch.object(server, 'request_body_candidates', return_value=({'id': 'fixture-task'}, 'https://fixture.invalid/v1/images/edits', None)) as request, \
             patch.object(server, 'request_json_candidates') as text_only:
            submitted, error = server.submit_image_generation(entry, prompt, size='2731x4096', reference_images=[reference], quality='max', trace=trace)
        self.assertIsNone(error)
        self.assertEqual(submitted['id'], 'fixture-task')
        self.assertEqual(trace['endpointPath'], 'images/edits')
        body = request.call_args.args[1]('https://fixture.invalid/v1/images/edits')
        for value in (prompt.encode(), b'fixture-image-bytes', b'2731x4096', b'max', b'gpt-image-2.5', b'enhanced', b'opaque'):
            self.assertIn(value, body)
        self.assertNotIn(b'must not replace prompt', body)
        text_only.assert_not_called()

    def test_large_reference_uses_compact_request_and_expands_only_inside_server(self):
        name = 'media-' + 'c' * 32 + '.png'
        path = server.MEDIA_DIR / name
        raw = b'large-reference-fixture' * 350000
        path.write_bytes(raw)
        with server.auth_db() as db:
            db.execute('INSERT INTO media_storage (media_id,owner_id,name,mime,size,created_at,expires_at) VALUES (?,?,?,?,?,?,?)',
                       (name, 'local-device', 'Large reference', 'image/png', len(raw), 1, 2**62))
        entry = {'id': 'large-image-fixture', 'model': 'gpt-image-2.5', 'enabled': True, 'usages': ['image'],
                 'baseUrl': 'https://fixture.invalid', 'apiKey': 'fixture-only', 'imageTransport': 'openai-images'}
        request_body = {'modelId': entry['id'], 'prompt': 'Reference fixture', 'referenceImages': ['/media/' + name], 'quality': 'max'}
        self.assertLess(len(json.dumps(request_body)), 1000)
        self.assertGreater(len(base64.b64encode(raw)), 8 * 1024 * 1024)
        with patch.object(server, 'visible_ai_models', return_value=[entry]), \
             patch.object(server, 'upstream_contract', return_value={}), \
             patch.object(server, 'request_body_candidates', return_value=({'data': [{'b64_json': base64.b64encode(b'fixture-result').decode()}]}, 'https://fixture.invalid/v1/images/edits', None)) as upstream:
            status, result = self.api('/api/ai/image-generate', 'POST', request_body)
        self.assertEqual(status, 201, result)
        body = upstream.call_args.args[1]('https://fixture.invalid/v1/images/edits')
        self.assertIn(raw, body)
        for invalid in ('/media/../auth.db', '/media/missing.png'):
            with self.assertRaises(ValueError): server.local_image_reference(invalid)
        with patch.object(server, 'validate_new_media', side_effect=ValueError('forbidden')):
            with self.assertRaises(ValueError): server.local_image_reference('/media/' + name)

    def test_custom_provider_image_options_match_visible_catalog_and_reach_upstream(self):
        # Use a normal newly-added ID and the actual shipped catalog, without mocking its contract.
        entry = {'id': 'aimodel-custom-fixture', 'model': 'tt-image-2.5', 'name': 'gpt-image-2.5',
                 'enabled': True, 'usages': ['image'], 'baseUrl': 'https://fixture.invalid', 'apiKey': 'fixture-only'}
        body = {'modelId': entry['id'], 'prompt': 'custom provider fixture', 'quality': 'max',
                'size': '2731x4096', 'modelOptions': {'version': 'flare', 'background': 'opaque'}}
        with patch.object(server, 'visible_ai_models', return_value=[entry]), \
             patch.object(server, 'read_ai_models', return_value=[entry]), \
             patch.object(server, 'request_json_candidates', return_value=({'data':[{'b64_json':base64.b64encode(b'fixture-image').decode()}]}, 'https://fixture.invalid/v1/images/generations', None)) as upstream:
            self.assertEqual(server.upstream_contract(entry), {})
            declared = server.image_parameter_contract(entry)
            self.assertEqual({p['name'] for p in declared['params']}, {'version', 'background'})
            status, result = self.api('/api/ai/image-generate', 'POST', body)
            self.assertEqual(status, 201, result)
            submitted = upstream.call_args.args[1]
            self.assertEqual(submitted['version'], 'flare')
            self.assertEqual(submitted['background'], 'opaque')
            self.assertEqual(submitted['prompt'], body['prompt'])
            for options in ({'version': 'not-a-version'}, {'background': 'not-a-background'}, {'arbitrary': 'bad'}, {'prompt': 'overwrite'}):
                rejected = self.api('/api/ai/image-generate', 'POST', {**body, 'modelOptions':options})
                self.assertEqual(rejected[0], 400, rejected)
            self.assertEqual(upstream.call_count, 1)

    def test_provider_requests_identify_app_and_preserve_custom_identity(self):
        class Response:
            status = 200
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def __init__(self): self.body = __import__('io').BytesIO(b'{"ok":true}')
            def read(self, limit): return self.body.read(limit)
        headers = []
        def capture(request, timeout):
            headers.append(request.get_header('User-agent'))
            return Response()
        with patch.object(server, 'open_http_url', side_effect=capture):
            self.assertEqual(server.http_json_request('https://provider.example/v1/models')[0], 200)
            self.assertEqual(server.http_body_request('https://provider.example/upload', b'body')[0], 200)
            self.assertEqual(server.http_json_request('https://provider.example/v1/models',
                             headers={'User-Agent':'SpecificAdapter/2.0'})[0], 200)
            self.assertIsNone(server.request_bytes_candidates(['https://provider.example/v1/audio/speech'], {'input':'test'})[2])
            self.assertIsNone(server.request_bytes_candidates(['https://provider.example/v1/audio/speech'],
                             {'input':'test'},headers={'User-Agent':'SpeechAdapter/1.0'})[2])
        self.assertEqual(headers, ['CanvasFlow/1.0', 'CanvasFlow/1.0', 'SpecificAdapter/2.0', 'CanvasFlow/1.0', 'SpeechAdapter/1.0'])

    def test_deleting_only_project_leaves_workspace_empty_and_late_save_cannot_restore_it(self):
        status,result=self.api('/api/workspaces','POST',{'name':'Last project deletion acceptance'})
        self.assertEqual(status,201)
        headers={'X-Workspace-Id':result['workspace']['id']}
        status,result=self.api('/api/projects','POST',{'projectName':'Only project'},headers=headers)
        self.assertEqual(status,201);project=result['project'];route='/api/projects/'+project['id']
        self.assertEqual(len(self.api('/api/projects',headers=headers)[1]['projects']),1)
        self.assertEqual(self.api(route,'DELETE',headers=headers)[0],200)
        self.assertEqual(self.api('/api/projects',headers=headers)[1]['projects'],[])
        self.assertEqual(self.api(route,'GET',headers=headers)[0],404)
        self.assertEqual(self.api(route,'PUT',project,headers=headers)[0],404)
        self.assertEqual(self.api('/api/projects',headers=headers)[1]['projects'],[])

    def test_all_model_settings_open_and_private_model_available(self):
        status,result=self.api('/api/admin/model-specs')
        self.assertEqual(status,200)
        self.assertIsInstance(result['specs'],dict)
        self.assertIn('contracts',result)
        status,result=self.api('/api/admin/ai-models')
        self.assertEqual(status,200)
        self.assertIn('local-model',{model['id'] for model in result['models']})
        models=server.visible_ai_models('local-device')
        self.assertTrue(next(m for m in models if m['id']=='local-model')['enabled'])
        self.assertEqual(self.api('/api/preset-prompts')[0],200)

    def test_blender_tool_routes_are_local_and_validate_before_execution(self):
        status,result=self.api('/api/blender/status')
        self.assertEqual(status,200);self.assertIsInstance(result['available'],bool)
        self.assertIn('boolean',result['tools'])
        self.assertEqual(self.api('/api/blender/examples')[0],200)
        self.assertEqual(self.api('/api/blender/jobs')[0],200)
        self.assertEqual(self.api('/api/blender/jobs','POST',{'name':'No code',
            'operations':[{'op':'python','code':'print(1)'}]})[0],400)
        self.assertEqual(self.api('/api/blender/jobs/blend-'+'0'*32)[0],404)
        self.assertEqual(self.api('/api/blender/settings','PUT',{'executable':'../other.exe'})[0],400)
        self.assertEqual(self.api('/api/blender/jobs','POST',{},
            {'Origin':'https://untrusted.invalid','Sec-Fetch-Site':'cross-site'})[0],403)

    def test_no_balance_reservation_or_settlement(self):
        with server.auth_db() as db:
            before=db.execute('SELECT COUNT(*) FROM credit_ledger').fetchone()[0]
        entry=server.read_ai_models()[0]
        quote=server.generation_quote(server.LOCAL_CONTEXT,entry)
        self.assertTrue(quote['canAfford']);self.assertEqual(quote['requiredBalance'],0)
        charge=server.open_generation_charge(server.LOCAL_CONTEXT,entry)
        self.assertFalse(charge['enabled'])
        server.settle_generation_charge(charge,{'input_tokens':1000000})
        self.assertIsNone(server.charge_generation_after(server.LOCAL_CONTEXT,entry))
        with server.auth_db() as db:
            self.assertEqual(before,db.execute('SELECT COUNT(*) FROM credit_ledger').fetchone()[0])

    def test_builtin_provider_is_available_without_key_and_cannot_be_deleted(self):
        provider_id = server.BUILTIN_PROVIDER_ID
        url = 'https://ai.zzzapi.xyz'
        path = '/api/admin/ai-providers/' + provider_id
        fetch_path = '/api/admin/ai-models/fetch-remote'
        body = {'baseUrl': url, 'providerId': provider_id}
        with tempfile.TemporaryDirectory() as directory, patch.object(
            server, 'AI_PROVIDERS_FILE', Path(directory) / 'ai-providers.json'
        ), patch.object(server, 'fetch_remote_catalog', return_value=([], {}, '')) as fetch:
            status, result = self.api('/api/admin/ai-models')
            self.assertEqual(status, 200)
            self.assertEqual([row['builtInKind'] for row in result['providers']], ['text', 'image', 'video', 'audio'])
            for row in result['providers']:
                self.assertTrue(row['provider'].startswith('CanvasFlow · '))
                self.assertFalse(row['apiKeySet'])
                self.assertEqual((row['baseUrl'], row['docsUrl']), (url, url))
                self.assertEqual(self.api('/api/admin/ai-providers/' + row['id'], 'DELETE')[0], 403)
            provider = result['providers'][0]
            self.assertEqual(provider['id'], provider_id)
            self.assertTrue(provider['builtIn'])
            self.assertEqual((provider['baseUrl'], provider['docsUrl']), (url, url))
            self.assertFalse(provider['apiKeySet'])
            self.assertNotIn('apiKey', provider)
            self.assertNotIn(provider_id, [item['id'] for item in result['models']])
            self.assertEqual(self.api(path, 'DELETE')[0], 403)
            self.assertEqual(self.api(path, 'PUT', {'baseUrl': 'https://other.example'})[0], 409)

            self.assertEqual(self.api('/api/admin/ai-providers', 'POST', {
                'provider': 'Other connection', 'baseUrl': url, 'apiKey': 'other-test-key'
            })[0], 201)
            self.assertEqual(self.api(fetch_path, 'POST', body)[0], 400)
            fetch.assert_not_called()
            status, saved = self.api(path, 'PUT', {
                'apiKey': 'builtin-test-key', 'textProtocol': 'responses'
            })
            self.assertEqual(status, 200)
            self.assertTrue(saved['provider']['apiKeySet'])
            self.assertNotIn('apiKey', saved['provider'])
            self.assertEqual(self.api(path, 'DELETE')[0], 403)
            provider = self.api('/api/admin/ai-models')[1]['providers'][0]
            self.assertEqual(provider['textProtocol'], 'responses')
            self.assertEqual(self.api(fetch_path, 'POST', body)[0], 200)
            self.assertEqual(fetch.call_args.args[:2], (url, 'builtin-test-key'))

            image_id = 'provider-builtin-zzzapi-image'
            image_body = {**body, 'providerId': image_id}
            self.assertEqual(self.api(fetch_path, 'POST', image_body)[0], 400)
            self.assertEqual(self.api('/api/admin/ai-providers/' + image_id, 'PUT', {
                'apiKey': 'image-test-key', 'imageTransport': 'openai'
            })[0], 200)
            self.assertEqual(self.api(fetch_path, 'POST', image_body)[0], 200)
            self.assertEqual(fetch.call_args.args[:2], (url, 'image-test-key'))
            self.assertEqual(self.api(fetch_path, 'POST', body)[0], 200)
            self.assertEqual(fetch.call_args.args[:2], (url, 'builtin-test-key'))
            rows = self.api('/api/admin/ai-models')[1]['providers']
            self.assertEqual([row['apiKeySet'] for row in rows if row['builtIn']], [True, True, False, False])

    def test_canvasflow_child_provider_is_persisted_and_uses_its_own_key(self):
        url = 'https://ai.zzzapi.xyz'
        payload = {'provider': '图片备用配置', 'providerGroup': 'canvasflow', 'configKind': 'image',
                   'baseUrl': url, 'docsUrl': url, 'protocol': 'openai'}
        with tempfile.TemporaryDirectory() as directory, patch.object(
            server, 'AI_PROVIDERS_FILE', Path(directory) / 'ai-providers.json'
        ), patch.object(server, 'AI_MODELS_FILE', Path(directory) / 'ai-models.json'), patch.object(
            server, 'fetch_remote_catalog', return_value=([], {}, '')
        ) as fetch:
            status, result = self.api('/api/admin/ai-providers', 'POST', payload)
            self.assertEqual(status, 201)
            provider = result['provider']
            self.assertEqual(provider['providerGroup'], 'canvasflow')
            self.assertEqual(provider['configKind'], 'image')
            self.assertFalse(provider['builtIn'])
            self.assertFalse(provider['apiKeySet'])
            self.assertNotIn('apiKey', provider)
            self.assertEqual(self.api('/api/admin/ai-providers', 'POST', payload)[0], 409)
            self.assertEqual(self.api('/api/admin/ai-providers', 'POST', {
                **payload, 'provider': 'CanvasFlow · 文本'
            })[0], 409)
            path = '/api/admin/ai-providers/' + provider['id']
            self.assertEqual(self.api(path, 'PUT', {'provider': 'CanvasFlow · 图片'})[0], 409)
            self.assertEqual(self.api('/api/admin/ai-providers/' + server.BUILTIN_PROVIDER_ID,
                'PUT', {'apiKey': 'other-fake-test-key'})[0], 200)
            fetch_body = {'baseUrl': url, 'providerId': provider['id']}
            self.assertEqual(self.api('/api/admin/ai-models/fetch-remote', 'POST', fetch_body)[0], 400)
            fetch.assert_not_called()
            status, saved = self.api(path, 'PUT', {'apiKey': 'child-fake-test-key', 'provider': '图片备用二'})
            self.assertEqual(status, 200)
            self.assertEqual(saved['provider']['configKind'], 'image')
            self.assertEqual(saved['provider']['providerGroup'], 'canvasflow')
            self.assertEqual(self.api('/api/admin/ai-models/fetch-remote', 'POST', fetch_body)[0], 200)
            self.assertEqual(fetch.call_args.args[:2], (url, 'child-fake-test-key'))
            status, model = self.api('/api/admin/ai-models', 'POST', {
                'provider': '图片备用二', 'baseUrl': url, 'name': 'Child model', 'model': 'child-test-image',
                'type': 't2i', 'inheritKeyFrom': provider['id']})
            self.assertEqual(status, 201)
            self.assertTrue(model['model']['apiKeySet'])
            self.assertEqual(self.api('/api/admin/ai-models/' + model['model']['id'], 'DELETE')[0], 200)
            rows = self.api('/api/admin/ai-models')[1]['providers']
            child = next(row for row in rows if row['id'] == provider['id'])
            self.assertEqual(child['providerGroup'], 'canvasflow')
            self.assertEqual(child['provider'], '图片备用二')
            self.assertTrue(child['apiKeySet'])
            self.assertEqual(self.api(path, 'DELETE')[0], 200)
            self.assertEqual(len(self.api('/api/admin/ai-models')[1]['providers']), 4)

    def test_z_clear_models_retains_provider_and_can_add_again(self):
        files = (server.AI_MODELS_FILE, server.AI_PROVIDERS_FILE, server.MODEL_SPECS_FILE,
                 server.DATA_DIR / 'ai-models-dismissed.json')
        saved = {path: path.read_bytes() if path.exists() else None for path in files}
        try:
            connection = {'provider':'Retained connection', 'baseUrl':'http://127.0.0.1:9999',
                          'protocol':'openai', 'authMode':'bearer'}
            first = server.normalize_ai_model({**connection, 'id':'clear-a', 'model':'clear-a',
                       'name':'First', 'apiKey':'test-secret-key', 'enabled':True})
            second = server.normalize_ai_model({**connection, 'id':'clear-b', 'model':'clear-b',
                        'name':'Second', 'apiKey':'', 'enabled':True})
            server.write_ai_models([first, second])
            server.write_file(server.AI_PROVIDERS_FILE, [])
            specs = server.read_model_specs()
            specs['image'] = {'*':[], 'clear-a':[]}
            server.write_model_specs(specs)
            self.assertEqual(self.api('/api/admin/ai-models/clear-a','DELETE')[0],200)
            self.assertEqual(self.api('/api/admin/ai-models/clear-b','DELETE')[0],200)
            status, result = self.api('/api/admin/ai-models')
            self.assertEqual(status,200);self.assertEqual(result['models'],[])
            self.assertEqual(server.visible_ai_models('local-device'),[])
            providers = [item for item in result['providers'] if not item['builtIn']]
            self.assertEqual(len(providers),1)
            provider = providers[0]
            self.assertTrue(provider['apiKeySet']);self.assertNotIn('apiKey',provider)
            self.assertNotIn('test-secret-key',json.dumps(result))
            status, specs_result = self.api('/api/admin/model-specs')
            self.assertEqual(status,200)
            for kind in ('image','video','audio'):
                self.assertLessEqual(set(specs_result['specs'][kind]),{'*'})
            self.assertNotIn('clear-a',specs_result['specs']['image'])
            self.assertIn('*',specs_result['specs']['image'])
            self.assertEqual(specs_result['specs'].get('camera'),specs.get('camera'))
            provider_path = '/api/admin/ai-providers/'+provider['id']
            self.assertEqual(self.api(provider_path,'PUT',{'provider':'Renamed connection'})[0],200)
            self.assertEqual(self.api(provider_path,'PUT',{'apiKey':'replacement-secret'})[0],200)
            status, result = self.api('/api/admin/ai-models','POST',{
                **connection, 'provider':'Renamed connection', 'name':'Added again',
                'model':'added-again', 'inheritKeyFrom':provider['id']})
            self.assertEqual(status,201);self.assertTrue(result['model']['apiKeySet'])
            self.assertEqual(next(row for row in server.read_ai_models()
                if row['id']==result['model']['id'])['apiKey'],'replacement-secret')
            status, copied = self.api('/api/admin/ai-providers','POST',{
                **connection,'provider':'Copy','inheritKeyFrom':provider['id']})
            self.assertEqual(status,201);self.assertTrue(copied['provider']['apiKeySet'])
            self.assertEqual(self.api('/api/admin/ai-providers/'+copied['provider']['id'],'DELETE')[0],200)
            self.assertEqual(self.api(provider_path,'DELETE')[0],200)
        finally:
            for path, content in saved.items():
                if content is None: path.unlink(missing_ok=True)
                else: path.write_bytes(content)

    def test_expired_legacy_media_remains_readable_and_no_quota(self):
        id='media-'+'a'*32+'.png'
        file=server.MEDIA_DIR/id;file.write_bytes(b'local-media')
        with server.auth_db() as db:
            db.execute('INSERT INTO media_storage (media_id,owner_id,name,mime,size,created_at,expires_at) VALUES (?,?,?,?,?,?,?)',
                       (id,'old-a','Old file','image/png',11,1,2))
        server.ACCOUNT_STORAGE.ensure('local-device',10**30)
        server.ACCOUNT_STORAGE.cleanup()
        self.assertTrue(file.exists());self.assertTrue(server.ACCOUNT_STORAGE.can_read(id))
        self.assertFalse(server.ACCOUNT_STORAGE.can_read('../auth.db'))
        with self.client.open(self.base+'/media/'+id) as response:
            self.assertEqual(response.read(),b'local-media')

    def test_large_local_graph_is_not_truncated(self):
        nodes=[{'id':'node-'+str(index),'type':'prompt','left':index*10,'top':0,'title':'Text','copy':'Test'} for index in range(600)]
        cleaned=server.clean_graph({'nodes':nodes,'edges':[]})
        self.assertEqual(len(cleaned[0]),600)

    def test_material_filters_classification_persist_and_workspace_scope(self):
        status,result=self.api('/api/workspaces','POST',{'name':'Material isolation'})
        self.assertEqual(status,201)
        other=result['workspace']['id']
        default=server.ensure_default_workspace('local-device')['id']
        assets=server.read_assets()
        assets.extend([{'id':'material-test-a','ownerId':'local-device','workspaceId':default,
                       'name':'Visible image','kind':'image','mediaUrl':'/media/media-'+'e'*32+'.png'},
                       {'id':'material-test-b','ownerId':'local-device','workspaceId':other,
                       'name':'Other video','kind':'video','mediaUrl':'/media/media-'+'f'*32+'.mp4'}])
        server.write_file(server.ASSETS_FILE,assets)
        status,result=self.api('/api/workspace/materials')
        self.assertEqual(status,200)
        self.assertEqual([m['name'] for m in result['materials']],['Visible image'])
        key=result['materials'][0]['id']
        status,result=self.api('/api/workspace/materials','PUT',{'ids':[key],'category':'character'})
        self.assertEqual(status,200)
        self.assertEqual(self.api('/api/workspace/materials/'+key,'PUT',{'name':'Renamed actor'})[0],200)
        self.assertEqual(self.api('/api/workspace/materials?kind=video')[1]['materials'],[])
        result=self.api('/api/workspace/materials?kind=image&category=character&q=actor')[1]
        self.assertEqual([m['name'] for m in result['materials']],['Renamed actor'])
        saved=server.read_file(server.DATA_DIR/'workspace-materials.json',{})
        self.assertEqual(saved[default][key],{'name':'Renamed actor','category':'character'})
        headers={'X-Workspace-Id':other}
        self.assertEqual(self.api('/api/workspace/materials/'+key,headers=headers)[0],404)
        self.assertEqual(self.api('/api/workspace/materials','PUT',{'ids':[key],'category':'prop'},headers=headers)[0],404)
        self.assertEqual([m['name'] for m in self.api('/api/workspace/materials',headers=headers)[1]['materials']],['Other video'])
        status,result=self.api('/api/previs/assets','POST',{'name':'Other model','object':{
            'kind':'geometry','geometryType':'box','transform':{'position':[0,0,0],'rotation':[0,0,0],'scale':[1,1,1]}}},headers=headers)
        self.assertEqual(status,201)
        self.assertEqual(result['asset']['workspaceId'],other)
        self.assertEqual(len(self.api('/api/workspace/materials')[1]['materials']),1)
        models=self.api('/api/workspace/materials?kind=model',headers=headers)[1]['materials']
        self.assertEqual([m['name'] for m in models],['Other model'])
        detail=self.api('/api/workspace/materials/'+models[0]['id'],headers=headers)[1]['material']
        self.assertEqual(detail['object']['geometryType'],'box')
        status,result=self.api('/api/workspace/materials/categories','POST',{'name':'  建筑  '})
        self.assertEqual(status,201)
        custom=result['category'];self.assertEqual(custom['name'],'建筑')
        self.assertEqual(self.api('/api/workspace/materials/categories','POST',{'name':'建筑'})[1]['category']['id'],custom['id'])
        self.assertEqual(self.api('/api/workspace/materials/categories','POST',{'name':'角色'})[1]['category']['id'],'character')
        for name in ('',' '*4,'全部分类','未分类','x'*41):
            self.assertEqual(self.api('/api/workspace/materials/categories','POST',{'name':name})[0],400)
        self.assertEqual(self.api('/api/workspace/materials/'+key,'PUT',{'category':custom['id']})[0],200)
        result=self.api('/api/workspace/materials?category='+custom['id'])[1]
        self.assertEqual(result['materials'][0]['category'],custom['id'])
        self.assertIn(custom['id'],{c['id'] for c in result['categories']})
        saved=server.read_file(server.DATA_DIR/'workspace-material-categories.json',{})
        self.assertEqual(saved[default][0],{'id':custom['id'],'name':'建筑'})
        self.assertNotIn(custom['id'],{c['id'] for c in self.api('/api/workspace/materials/categories',headers=headers)[1]['categories']})
        self.assertEqual(self.api('/api/workspace/materials/'+models[0]['id'],'PUT',{'category':custom['id']},headers=headers)[0],400)

    def test_material_tag_management_and_replacement(self):
        workspace=self.api('/api/workspaces','POST',{'name':'Tag lifecycle'})[1]['workspace']['id']
        headers={'X-Workspace-Id':workspace}
        original='media-'+'1'*32+'.png';replacement='media-'+'2'*32+'.wav'
        (server.MEDIA_DIR/original).write_bytes(base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7X8AAAAASUVORK5CYII='))
        with wave.open(str(server.MEDIA_DIR/replacement),'wb') as audio:
            audio.setnchannels(1);audio.setsampwidth(2);audio.setframerate(8000);audio.writeframes(bytes(160))
        assets=server.read_assets();assets.append({'id':'replace-me','name':'Original image','kind':'image',
            'workspaceId':workspace,'ownerId':'local-device','mediaId':original})
        server.write_file(server.ASSETS_FILE,assets)
        key=self.api('/api/workspace/materials',headers=headers)[1]['materials'][0]['id']
        category=self.api('/api/workspace/materials/categories','POST',{'name':'Architecture'},headers=headers)[1]['category']
        path='/api/workspace/materials/categories/'+category['id']
        self.assertEqual(self.api('/api/workspace/materials/'+key,'PUT',{'category':category['id']},headers=headers)[0],200)
        status,result=self.api(path,'PUT',{'name':'Buildings'},headers=headers)
        self.assertEqual(status,200);self.assertEqual(result['category']['id'],category['id'])
        self.assertEqual(result['category']['name'],'Buildings')
        self.assertEqual(self.api(path,'PUT',{'name':'场景'},headers=headers)[0],409)
        self.assertEqual(self.api(path,'PUT',{'name':'Cross workspace'})[0],404)
        self.assertEqual(self.api(path,'DELETE')[0],404)
        status,result=self.api(path,'DELETE',headers=headers)
        self.assertEqual(status,200);self.assertEqual(result['affected'],1)
        rows=self.api('/api/workspace/materials?category=uncategorized',headers=headers)[1]['materials']
        self.assertEqual(rows[0]['id'],key);self.assertTrue((server.MEDIA_DIR/original).exists())
        self.assertEqual(self.api('/api/workspace/materials/categories/scene','PUT',{'name':'Locations'},headers=headers)[0],200)
        self.assertEqual(self.api('/api/workspace/materials/categories/scene','DELETE',headers=headers)[0],200)
        self.assertNotIn('scene',{r['id'] for r in self.api('/api/workspace/materials/categories',headers=headers)[1]['categories']})
        status,result=self.api('/api/workspace/materials/'+key,'PUT',{'name':'Replacement sound','replacementMediaId':replacement},headers=headers)
        self.assertEqual(status,200)
        row=self.api('/api/workspace/materials/'+key,headers=headers)[1]['material']
        self.assertEqual((row['id'],row['name'],row['kind'],row['url']),(key,'Replacement sound','audio','/media/'+replacement))
        self.assertEqual(self.api('/api/workspace/materials?kind=image',headers=headers)[1]['materials'],[])
        self.assertEqual(len(self.api('/api/workspace/materials?kind=audio',headers=headers)[1]['materials']),1)
        self.assertTrue(server.media_referenced_by(replacement,[],[]))
        self.assertTrue((server.MEDIA_DIR/original).exists())
        self.assertEqual(self.api('/api/workspace/materials/'+key,'PUT',{'replacementMediaId':'../auth.db'},headers=headers)[0],400)
        self.assertEqual(self.api('/api/workspace/materials/'+key,headers=headers)[1]['material']['url'],'/media/'+replacement)


    def test_material_delete_restore_preserves_files_projects_and_shared_workspaces(self):
        workspace=self.api('/api/workspaces','POST',{'name':'Delete materials'})[1]['workspace']['id']
        other=self.api('/api/workspaces','POST',{'name':'Shared material'})[1]['workspace']['id']
        headers={'X-Workspace-Id':workspace};other_headers={'X-Workspace-Id':other}
        media_id='media-'+'d'*32+'.png';url='/media/'+media_id
        file=server.MEDIA_DIR/media_id;file.write_bytes(b'deletion fixture, never a real user upload')
        assets=server.read_assets()+[
            {'id':'delete-local','workspaceId':workspace,'ownerId':'local-device','name':'Delete me','kind':'image','mediaUrl':url},
            {'id':'delete-shared','workspaceId':other,'ownerId':'local-device','name':'Shared file','kind':'image','mediaUrl':url}]
        server.write_file(server.ASSETS_FILE,assets)
        project={'id':'delete-material-project','workspaceId':workspace,'ownerId':'local-device','projectName':'Keep project',
                 'nodes':[{'id':'image','type':'image','previewMedia':url}],'edges':[]}
        server.write_file(server.PROJECTS_FILE,server.read_projects()+[project])
        key=self.api('/api/workspace/materials',headers=headers)[1]['materials'][0]['id']
        self.assertEqual(self.api('/api/workspace/materials/'+key,'PUT',{'name':'Edited name','category':'character'},headers)[0],200)
        before_assets=server.ASSETS_FILE.read_bytes();before_projects=server.PROJECTS_FILE.read_bytes()
        status,result=self.api('/api/workspace/materials/'+key,'DELETE',headers=headers)
        self.assertEqual(status,200);self.assertEqual(result['deleted'],[key])
        self.assertEqual(self.api('/api/workspace/materials',headers=headers)[1]['materials'],[])
        self.assertEqual(self.api('/api/workspace/materials/'+key,headers=headers)[0],404)
        self.assertEqual(self.api('/api/workspace/materials/'+key,'PUT',{'name':'Hidden'},headers)[0],404)
        self.assertEqual(len(self.api('/api/workspace/materials',headers=other_headers)[1]['materials']),1)
        self.assertEqual(self.api('/api/workspace/materials/'+key,'DELETE',headers=headers)[0],200)
        saved=server.read_file(server.DATA_DIR/'workspace-materials.json',{})
        self.assertTrue(saved[workspace][key]['deleted'])
        self.assertEqual(self.api('/api/workspace/materials/restore','POST',{'ids':[key]},headers)[0],200)
        row=self.api('/api/workspace/materials',headers=headers)[1]['materials'][0]
        self.assertEqual((row['id'],row['name'],row['category']),(key,'Edited name','character'))
        self.assertEqual(server.ASSETS_FILE.read_bytes(),before_assets)
        self.assertEqual(server.PROJECTS_FILE.read_bytes(),before_projects)
        self.assertEqual(file.read_bytes(),b'deletion fixture, never a real user upload')

    def test_material_batch_delete_is_atomic_scoped_and_rejects_empty_or_unknown_ids(self):
        workspace=self.api('/api/workspaces','POST',{'name':'Batch delete'})[1]['workspace']['id']
        other=self.api('/api/workspaces','POST',{'name':'Foreign material'})[1]['workspace']['id']
        headers={'X-Workspace-Id':workspace};other_headers={'X-Workspace-Id':other}
        records=[{'id':'delete-'+kind,'ownerId':'local-device','workspaceId':workspace,'name':kind,
                  'kind':kind,'mediaUrl':'/media/media-'+letter*32+'.'+extension}
                 for kind,letter,extension in [('image','a','png'),('audio','b','wav'),('video','c','mp4')]]
        records.append({'id':'foreign-delete','ownerId':'local-device','workspaceId':other,'name':'Foreign',
                        'kind':'image','mediaUrl':'/media/media-'+'f'*32+'.png'})
        server.write_file(server.ASSETS_FILE,server.read_assets()+records)
        ids=[r['id'] for r in self.api('/api/workspace/materials',headers=headers)[1]['materials']]
        foreign=self.api('/api/workspace/materials',headers=other_headers)[1]['materials'][0]['id']
        metadata=server.DATA_DIR/'workspace-materials.json'
        before=metadata.read_bytes() if metadata.exists() else None
        self.assertEqual(self.api('/api/workspace/materials','DELETE',{'ids':ids},
                         {**headers,'Origin':'https://untrusted.invalid'})[0],403)
        self.assertEqual(metadata.read_bytes() if metadata.exists() else None,before)
        for body,status in [({'ids':[]},400),({'ids':'bad'},400),({'ids':[ids[0],foreign]},404),
                            ({'ids':[ids[0],'material-missing']},404),({'ids':[None]},400)]:
            self.assertEqual(self.api('/api/workspace/materials','DELETE',body,headers)[0],status)
            self.assertEqual(metadata.read_bytes() if metadata.exists() else None,before)
        status,result=self.api('/api/workspace/materials','DELETE',{'ids':ids+[ids[0]]},headers)
        self.assertEqual(status,200);self.assertEqual(set(result['deleted']),set(ids))
        self.assertEqual(len(result['deleted']),3)
        self.assertEqual(self.api('/api/workspace/materials',headers=headers)[1]['total'],0)
        deleted=metadata.read_bytes()
        self.assertEqual(self.api('/api/workspace/materials/restore','POST',{'ids':[ids[0],foreign]},headers)[0],404)
        self.assertEqual(metadata.read_bytes(),deleted)
        self.assertEqual(self.api('/api/workspace/materials/restore','POST',{'ids':ids},headers)[0],200)
        self.assertEqual(self.api('/api/workspace/materials',headers=headers)[1]['total'],3)

if __name__=='__main__':unittest.main()
