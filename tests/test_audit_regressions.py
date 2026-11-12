"""2026-11-06 backend audit regressions. Isolated storage; never call paid APIs."""
import copy
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
DATA = tempfile.TemporaryDirectory(prefix='canvasflow-backend-fixes-')
os.environ['CANVASFLOW_DATA_DIR'] = DATA.name
import server as app


class Response(io.BytesIO):
    status = 200
    headers = {}


class BackendAuditRegressions(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        DATA.cleanup()

    def setUp(self):
        self.network = patch.object(app, 'guarded_open_http_url', side_effect=AssertionError('Live network forbidden'))
        self.network.start()
        self.addCleanup(self.network.stop)
        self.job_file = Path(DATA.name) / (self.id().rsplit('.', 1)[-1] + '.jsonl')
        self.jobs = patch.object(app, 'JOBS_FILE', self.job_file)
        self.jobs.start()
        self.addCleanup(self.jobs.stop)
        self.entry = {'id':'mock-video', 'model':'mock-video', 'type':'video', 'usages':['video'],
                      'enabled':True, 'baseUrl':'https://example.invalid', 'apiKey':'fixture-only'}

    def test_multipart_does_not_duplicate_on_ambiguous_or_business_error(self):
        for status in (0, 400, 401, 403, 404, 429, 500, 504):
            with self.subTest(status=status), patch.object(app, 'http_body_request', return_value=(status, {}, 'failed')) as request:
                result = app.request_body_candidates(['https://example.invalid/a', 'https://example.invalid/b'], lambda _:b'fixture')
                self.assertIsNotNone(result[2])
                self.assertEqual(request.call_count, 1)

    def test_multipart_can_fallback_only_for_route_rejection(self):
        for status, message in ((404, 'unknown endpoint'), (405, 'method not allowed')):
            with self.subTest(status=status), patch.object(app, 'http_body_request', side_effect=[(status, {}, message), (200, {'ok':True}, None)]) as request:
                self.assertEqual(app.request_body_candidates(['https://example.invalid/a', 'https://example.invalid/b'], lambda _:b'fixture')[0], {'ok':True})
                self.assertEqual(request.call_count, 2)

    def test_tts_timeout_and_http_errors_never_repeat_generation(self):
        errors = [TimeoutError('read timeout'), HTTPError('https://example.invalid/a',504,'timeout',{},io.BytesIO(b'{"message":"timeout"}')),
                  HTTPError('https://example.invalid/a',404,'not found',{},io.BytesIO(b'{"message":"model not found"}'))]
        for error in errors:
            with self.subTest(error=str(error)), patch.object(app, 'open_http_url', side_effect=error) as request:
                self.assertIsNotNone(app.request_bytes_candidates(['https://example.invalid/a','https://example.invalid/b'], {'input':'test'})[2])
                self.assertEqual(request.call_count, 1)

    def test_tts_route_rejection_allows_fallback(self):
        failure = HTTPError('https://example.invalid/a',404,'missing',{},io.BytesIO(b'unknown endpoint'))
        with patch.object(app, 'open_http_url', side_effect=[failure,Response(b'whole audio')]) as request:
            self.assertEqual(app.request_bytes_candidates(['https://example.invalid/a','https://example.invalid/b'], {'input':'test'})[0], b'whole audio')
            self.assertEqual(request.call_count, 2)

    def test_tts_cross_origin_candidate_does_not_leak_auth(self):
        entry = {'baseUrl':'https://first.invalid', 'apiKey':'fixture-secret', 'authMode':'bearer'}
        seen = []
        def send(req, timeout):
            seen.append(req.get_header('Authorization'))
            if len(seen) == 1:
                raise HTTPError(req.full_url,405,'unsupported',{},io.BytesIO(b''))
            return Response(b'audio')
        with patch.object(app, 'open_http_url', side_effect=send):
            app.request_bytes_candidates(['https://first.invalid/a','https://second.invalid/b'], {'input':'test'}, headers=app.auth_headers(entry))
        self.assertEqual(seen,['Bearer fixture-secret',None])

    def test_large_generated_image_json_is_complete(self):
        encoded = 'A' * 12_000_001
        with patch.object(app, 'open_http_url', return_value=Response(json.dumps({'data':[{'b64_json':encoded}]}).encode())):
            status, body, error = app.http_json_request('https://example.invalid/images', {'prompt':'test'})
        self.assertIsNone(error)
        self.assertEqual(status, 200)
        self.assertEqual(body['data'][0]['b64_json'], encoded)

    def test_large_tts_audio_is_complete(self):
        raw = b'a' * 24_000_001
        with patch.object(app, 'open_http_url', return_value=Response(raw)):
            actual, _, error = app.request_bytes_candidates(['https://example.invalid/tts'], {'input':'test'})
        self.assertIsNone(error)
        self.assertEqual(actual, raw)

    def test_response_overflow_is_explicit_and_not_retried(self):
        with patch.object(app, 'UPSTREAM_BINARY_MAX_BYTES', 10), patch.object(app, 'open_http_url', return_value=Response(b'x'*11)) as request:
            raw, _, error = app.request_bytes_candidates(['https://example.invalid/a','https://example.invalid/b'], {})
        self.assertIsNone(raw)
        self.assertIn('未自动重发', error)
        self.assertEqual(request.call_count, 1)
        with patch.object(app, 'UPSTREAM_JSON_MAX_BYTES', 10), patch.object(app, 'open_http_url', return_value=Response(b'x'*11)):
            _, body, error = app.http_json_request('https://example.invalid/a', {})
        self.assertEqual(body, {})
        self.assertIn('超过', error)

    def test_incomplete_declared_response_is_not_a_success(self):
        response = Response(b'partial')
        response.headers = {'Content-Length':'100'}
        with patch.object(app, 'open_http_url', return_value=response) as request:
            raw, _, error = app.request_bytes_candidates(['https://example.invalid/a','https://example.invalid/b'], {})
        self.assertIsNone(raw)
        self.assertIn('长度不完整', error)
        self.assertEqual(request.call_count, 1)

    def test_completed_video_job_view_persists_repaired_url(self):
        original={'id':'repair','kind':'video','status':'completed','simulated':False,'userId':app.LOCAL_ID,
                  'videoUrl':'https://example.invalid/temporary.mp4','videoPersistError':'temporary failure'}
        app.append_job(dict(original))
        filename='media-'+('c'*32)+'.mp4'
        (app.MEDIA_DIR/filename).write_bytes(b'local-video')
        with patch.object(app,'persist_media_url',return_value={'url':'/media/'+filename,'mediaId':filename}) as persist:
            repaired=app.job_view(dict(original))
            self.assertEqual(repaired['videoUrl'],'/media/'+filename)
            again=app.job_view(app.latest_jobs(limit=None)[0])
            self.assertEqual(again['videoUrl'],'/media/'+filename)
            self.assertNotIn('videoPersistError',again)
            persist.assert_called_once()

    def test_video_poll_timeout_keeps_job_live_and_can_recover(self):
        job = {'id':'poll', 'modelId':self.entry['id'], 'status':'running', 'progress':35, 'submittedAt':app.now(), 'userId':app.LOCAL_ID}
        with patch.object(app, 'read_ai_models', return_value=[self.entry]), patch.object(app, 'provider_status_request', side_effect=[({},'temporary timeout',''),({'status':'completed','videoUrl':'https://example.invalid/result.mp4'},None,'/tasks/{task_id}')]), patch.object(app, 'persist_job_video'):
            retry = app.refresh_video_job(job)
            self.assertEqual(retry['status'], 'running')
            self.assertEqual(retry['progress'], 35)
            self.assertIn('pollError', retry)
            complete = app.refresh_video_job(retry)
        self.assertEqual(complete['status'], 'completed')
        self.assertNotIn('pollError', complete)

    def test_video_query_errors_still_obey_total_deadline(self):
        job = {'id':'timeout','modelId':self.entry['id'],'status':'running','submittedAt':'2000-01-01T00:00:00+00:00'}
        with patch.object(app, 'read_ai_models', return_value=[self.entry]), patch.object(app, 'provider_status_request') as request:
            self.assertEqual(app.refresh_video_job(job)['status'], 'failed')
            request.assert_not_called()

    def test_completed_job_allows_media_save_without_metadata_overwrite(self):
        for kind, suffix in (('image','png'),('audio','mp3'),('video','mp4')):
            with self.subTest(kind=kind):
                original = {'id':kind,'kind':kind,'status':'completed','userId':app.LOCAL_ID,'prompt':'original',
                            kind+'Url':'https://example.invalid/temporary.'+suffix, kind+'PersistError':'temporary failure'}
                app.append_job(original)
                filename = 'media-' + ('a'*32) + '.' + suffix
                (app.MEDIA_DIR / filename).write_bytes(b'persisted-result')
                upgrade = {**original, kind+'Url':'/media/'+filename, 'prompt':'stale-metadata'}
                app.append_job(upgrade)
                self.assertEqual(upgrade[kind+'Url'], '/media/'+filename)
                self.assertEqual(upgrade['prompt'], 'original')
                self.assertNotIn(kind+'PersistError',upgrade)
                self.assertEqual(next(j for j in app.latest_jobs(limit=None) if j['id']==kind)[kind+'Url'],'/media/'+filename)
                stale = {**original, 'status':'running'}
                app.append_job(stale)
                self.assertEqual(stale[kind+'Url'], '/media/'+filename)

    def test_terminal_failed_and_missing_media_stay_protected(self):
        for state in ('failed','completed'):
            original={'id':state,'status':state,'videoUrl':'https://example.invalid/original.mp4'}
            app.append_job(original)
            stale={**original,'status':'completed','videoUrl':'/media/media-'+('b'*32)+'.mp4'}
            app.append_job(stale)
            self.assertEqual(stale,original)

    def test_video_retry_preserves_settings_references_and_workspace(self):
        settings={'modelId':self.entry['id'],'videoMode':'text-to-video','referenceMode':'mixed2video','aspectRatio':'16:9',
                  'resolution':'1080p','duration':'4','cameraMove':'push','generateAudio':False,'generateCount':2,'modelOptions':{'seed':42}}
        original={'id':'retry-source','kind':'video','status':'failed','simulated':False,'userId':app.LOCAL_ID,'workspaceId':'second',
                  'prompt':'test','generationSettings':settings,'modelId':self.entry['id'],'projectId':'p','sourceAudios':['https://example.invalid/a.wav'],
                  'sourceVideos':['https://example.invalid/v.mp4'],'referenceImages':['https://example.invalid/i.png'],'upstreamInputs':['n1'],
                  'advancedSettings':{'seed':17,'motion':5,'negativePrompt':'negative'}}
        request=object.__new__(app.Handler)
        request.path='/api/jobs/retry-source/retry'
        request.read_json=lambda:{}
        request.authenticated_user=lambda:dict(app.LOCAL_CONTEXT)
        request.send_json=lambda data,status=200,headers=None:(status,data)
        request.find_job=lambda *args:copy.deepcopy(original)
        request.workspace_scope=lambda user:('second',{'second'})
        with patch.object(app,'visible_ai_models',return_value=[self.entry]), patch.object(app,'validate_generation_contract'), patch.object(app,'prepare_request_generation'), patch.object(app,'call_video_submit',return_value=({'providerJobId':'upstream-new'},None)) as submit:
            status,result=request._route_post()
        self.assertEqual(status,202,result)
        sent=submit.call_args.args[1]
        for key in ('generationSettings','sourceAudios','sourceVideos','referenceImages','advancedSettings','upstreamInputs'):
            self.assertEqual(sent[key],original[key],key)
        self.assertEqual(result['job']['kind'],'video')
        self.assertEqual(sent['kind'],'video')
        self.assertEqual(result['job']['workspaceId'],'second')
        self.assertEqual(result['job']['retryOf'],original['id'])
        self.assertEqual(app.latest_jobs(limit=None)[0]['workspaceId'],'second')

    def test_new_video_jobs_declare_kind_for_recovery(self):
        with patch.object(app,'visible_ai_models',return_value=[self.entry]), patch.object(app,'validate_generation_contract'), patch.object(app,'call_video_submit',return_value=({'providerJobId':'upstream-new'},None)):
            result,error=app.create_video_job(dict(app.LOCAL_CONTEXT),{'prompt':'test','generationSettings':{'modelId':self.entry['id']}},'second')
        self.assertIsNone(error)
        self.assertEqual(result['kind'],'video')
        self.assertEqual(app.latest_jobs(limit=None)[0]['kind'],'video')

    def test_agent_media_image_uses_params_and_waits_for_async_result(self):
        entry={'id':'mock-image','model':'mock-image','enabled':True,'usages':['t2i'],'baseUrl':'https://example.invalid','apiKey':'fixture','imageTransport':'media-generate'}
        image='data:image/png;base64,ZmFrZQ=='
        schema={'aspect_ratio':{'name':'aspect_ratio','type':'string','options':[{'value':'1:1'}]},'resolution':{'name':'resolution','type':'string','options':[{'value':'1K'}]}}
        with patch.object(app,'media_model_schema',return_value=schema), patch.object(app,'spec_rows_for_entry',return_value=None), patch.object(app,'request_json_candidates',return_value=({'code':200,'data':{'task_id':'task-once'}},'https://example.invalid/v1/media/generate',None)) as submit, patch.object(app,'query_image_task_once',return_value=({'data':[{'url':image}]},None,200)) as poll, patch.object(app.time,'sleep'):
            result,error=app.call_image_generation(entry,'test',size='1024x1024')
        self.assertIsNone(error)
        self.assertEqual(result,image)
        self.assertIn('/media/generate',submit.call_args.args[0][0])
        self.assertIn('params',submit.call_args.args[1])
        self.assertNotIn('n',submit.call_args.args[1])
        self.assertEqual(poll.call_args.args[1],'task-once')
        submit.assert_called_once()

    def test_canvas_zoom_and_large_groups_roundtrip(self):
        groups=[{'id':'g'+str(i),'memberShots':[{'nodeId':'n'+str(j),'shotId':'s'+str(j)} for j in range(101)]} for i in range(81)]
        for zoom in (.1,.25,1,2,8):
            with self.subTest(zoom=zoom):
                saved=app.clean_project({'nodes':[],'edges':[],'groups':groups,'zoom':zoom})
                self.assertEqual(saved['zoom'],zoom)
                self.assertEqual(len(saved['groups']),81)
                self.assertEqual(len(saved['groups'][0]['memberShots']),101)

    def test_previs_read_and_update_are_scoped_to_workspace(self):
        request=object.__new__(app.Handler)
        request.authenticated_user=lambda:dict(app.LOCAL_CONTEXT)
        request.workspace_scope=lambda user:('A',{'A','B'})
        request.send_json=lambda data,status=200:(status,data)
        with patch.object(app,'validate_new_media'):
            status,created=request.previs_assets_api('/api/previs/assets','POST',{'name':'A cube','object':{'kind':'geometry','geometryType':'box'}})
            self.assertEqual(status,201)
            path='/api/previs/assets/'+created['asset']['id']
            request.workspace_scope=lambda user:('B',{'A','B'})
            self.assertEqual(request.previs_assets_api('/api/previs/assets','GET')[1]['assets'],[])
            self.assertEqual(request.previs_assets_api(path,'PUT',{'name':'intruder'})[0],404)
            request.workspace_scope=lambda user:('A',{'A','B'})
            self.assertEqual(request.previs_assets_api(path,'PUT',{'name':'renamed'})[0],200)
            self.assertEqual(request.previs_assets_api('/api/previs/assets','GET')[1]['assets'][0]['name'],'renamed')

    def test_previs_legacy_asset_remains_in_default_workspace(self):
        legacy=app.PREVIS_ASSETS.create(dict(app.LOCAL_CONTEXT),{'name':'Legacy cube','object':{'kind':'geometry','geometryType':'box'}})
        default=app.default_workspace_id(app.LOCAL_ID)
        request=object.__new__(app.Handler)
        request.authenticated_user=lambda:dict(app.LOCAL_CONTEXT)
        request.workspace_scope=lambda user:(default,{default,'other'})
        request.send_json=lambda data,status=200:(status,data)
        self.assertIn(legacy['id'],[a['id'] for a in request.previs_assets_api('/api/previs/assets','GET')[1]['assets']])
        request.workspace_scope=lambda user:('other',{default,'other'})
        self.assertNotIn(legacy['id'],[a['id'] for a in request.previs_assets_api('/api/previs/assets','GET')[1]['assets']])


if __name__=='__main__':
    unittest.main()
