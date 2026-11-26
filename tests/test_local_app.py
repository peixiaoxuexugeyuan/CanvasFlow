"""Local app integration checks. Uses isolated storage and no paid upstream calls."""
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import sys
import tempfile
import threading
import unittest
import base64
import io
import wave
from email import policy
from email.parser import BytesParser
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
    def test_voice_catalog_bounds_and_source(self):
        entry = {'baseUrl':'https://voices.example/v1', 'authMode':'none'}
        first = entry['baseUrl'] + '/skills/voices?model=model'

        def fetch(*responses, pages=40, rows=5000):
            with patch.dict(server.VOICE_LIST_CACHE, clear=True), patch.object(server, 'VOICE_LIST_MAX_PAGES', pages), \
                 patch.object(server, 'VOICE_LIST_MAX_ROWS', rows), patch.object(server, 'request_json_first_hit') as call:
                call.side_effect = lambda urls, headers, timeout: (200, responses[call.call_count-1], None, urls[0])
                voices, warning = server.fetch_model_voices(entry,'model')
                self.assertEqual(server.fetch_model_voices(entry,'model'), (voices,warning))
                return [v['id'] for v in voices], warning, [args.args[0][0] for args in call.call_args_list]

        rows, warning, urls = fetch({'voices':[{'id':'a'},{'id':'a'},{'id':'b'}]})
        self.assertEqual((rows,warning,len(urls)), (['a','b'],'',1))
        rows, warning, urls = fetch({'voices':[{'id':'a'}],'next':'https://elsewhere.example/voices?cursor=next'})
        self.assertEqual(rows,['a']); self.assertIn('不同来源',warning); self.assertEqual(len(urls),1)
        rows, warning, urls = fetch({'voices':[{'id':'a'}],'next':first})
        self.assertEqual(rows,['a']); self.assertIn('重复',warning); self.assertEqual(len(urls),1)
        rows, warning, urls = fetch({'voices':[{'id':'a'}],'has_more':True}, {'voices':[{'id':'a'}],'has_more':True})
        self.assertEqual(rows,['a']); self.assertIn('重复',warning); self.assertEqual(len(urls),2)
        rows, warning, urls = fetch({'voices':[{'id':'a'}],'hasMore':True}, pages=1)
        self.assertEqual(rows,['a']); self.assertIn('最多',warning); self.assertEqual(len(urls),1)
        rows, warning, urls = fetch([{'id':'a'},{'id':'b'}], rows=1)
        self.assertEqual(rows,['a']); self.assertIn('最多',warning)
        rows, warning, urls = fetch({'data':{'items':[{'id':'a'}]},'meta':{'pagination':{'current_page':1,'total_pages':2}}},
                                    {'data':[{'id':'b'}], 'hasMore':False})
        self.assertEqual((rows,warning),(['a','b'],'')); self.assertIn('page=2',urls[1])
        with patch.object(server, 'upstream_contract', return_value={'voices':[{'id':'a'}, {'id':'a'}, {'id':'b'}]}), \
             patch.object(server,'request_json_first_hit') as call:
            rows, warning = server.fetch_model_voices(entry,'model')
            self.assertEqual(([v['id'] for v in rows],warning),(['a','b'],'')); call.assert_not_called()

    def test_recover_completed_video_from_authenticated_content(self):
        entry = {'id': 'content-model', 'model': 'video', 'type': 'video', 'usages': ['video'],
                 'baseUrl': 'https://provider.invalid', 'apiKey': 'fixture-only'}
        job = {'id': 'job-content-recovery', 'modelId': entry['id'], 'kind': 'video',
               'providerJobId': 'task-7', 'status': 'completed', 'videoUrl': '', 'progress': 100}
        result = {'status': 'completed', 'video_url': '/v1/videos/task-7/content'}
        status_url = entry['baseUrl'] + '/v1/videos/{task_id}'
        video = b'\x00\x00\x00\x18ftypisom' + bytes(32)
        def download(req, timeout):
            self.assertEqual(req.get_method(), 'GET')
            self.assertEqual(req.full_url, entry['baseUrl'] + result['video_url'])
            self.assertEqual(req.get_header('Authorization'), 'Bearer fixture-only')
            response = io.BytesIO(video)
            response.headers = BytesParser(policy=policy.default).parsebytes(b'Content-Type: application/octet-stream\r\n\r\n')
            return response
        with patch.object(server, 'read_ai_models', return_value=[entry]), \
             patch.object(server, 'provider_status_request', return_value=(result, None, status_url)) as poll, \
             patch.object(server, 'open_media_url', side_effect=HTTPError(status_url, 502, 'Bad Gateway', {}, None)) as fetch, \
             patch.object(server, 'call_video_submit') as submit:
            failed = server.recover_studio_video(job)
            self.assertEqual(failed['videoUrl'], '')
            self.assertEqual(failed['status'], 'completed')
            self.assertIn('502', failed['videoPersistError'])
            fetch.side_effect = download
            recovered = server.recover_studio_video(failed)
            self.assertTrue(recovered['videoUrl'].startswith('/media/'))
            self.assertEqual(server.resolve_media_file(recovered['videoUrl'].split('/')[-1]).read_bytes(), video)
            self.assertNotIn('videoPersistError', recovered)
            self.assertEqual(poll.call_count, 2)
            submit.assert_not_called()

    def test_video_content_credentials_are_scoped_to_the_original_task(self):
        entry = {'baseUrl': 'https://provider.invalid', 'apiKey': 'fixture-only'}
        for url in ('https://cdn.invalid/v1/videos/task-7/content', 'https://provider.invalid/v1/videos/other/content'):
            job = {'providerJobId': 'task-7', 'videoUrl': url}
            with patch.object(server, 'persist_media_url', side_effect=ValueError('offline')) as save:
                server.persist_job_video(job, entry)
                self.assertNotIn('video_content_headers', save.call_args.kwargs)
                self.assertEqual(job['videoUrl'], url)

    def test_workspace_review_skill_cover_survives_canvas_cleanup(self):
        png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jEOcAAAAASUVORK5CYII=')
        blob = server.save_media_blob(png, 'image/png', 'shared.png', server.LOCAL_ID)
        again = server.save_media_blob(png, 'image/png', 'cover.png', server.LOCAL_ID)
        self.assertEqual(again['url'], blob['url'])
        payload = {'name':'Cover retention', 'prompt':'Example', 'metadata':{
            'useScenario':'Test', 'inputType':'Image', 'outputContent':'Image', 'kind':'图片', 'cover':again['url']}}
        self.assertEqual(self.api('/api/agent/skills', 'POST', payload)[0], 200)
        project = self.api('/api/projects', 'POST', {'projectName':'Cover sharing'})[1]['project']
        path = '/api/projects/' + project['id']
        project['nodes'] = [{'id':'image-test', 'type':'image', 'previewMedia':blob['url']}]
        self.assertEqual(self.api(path, 'PUT', project)[0], 200)
        status, result = self.api(path, 'DELETE')
        self.assertEqual(status, 200)
        self.assertEqual(result['mediaFilesDeleted'], 0)
        with self.client.open(self.base+again['url']) as response:
            self.assertEqual(response.read(), png)

    def test_workspace_review_persisted_materials_and_blender_after_removal(self):
        old = self.api('/api/workspaces', 'POST', {'name':'Source for recovery'})[1]['workspace']['id']
        headers = {'X-Workspace-Id':old}
        assets = server.read_assets()
        assets.append({'id':'workspace-recovery-image', 'ownerId':server.LOCAL_ID, 'workspaceId':old,
                       'name':'Recovery image', 'kind':'image', 'url':'https://fixture.invalid/recovery.png'})
        server.write_file(server.ASSETS_FILE, assets)
        material = self.api('/api/workspace/materials', headers=headers)[1]['materials'][0]['id']
        local_tag = self.api('/api/workspace/materials/categories', 'POST', {'name':'Recovered tag'})[1]['category']['id']
        tag = self.api('/api/workspace/materials/categories', 'POST', {'name':'Recovered tag'}, headers)[1]['category']['id']
        self.assertEqual(self.api('/api/workspace/materials/categories/scene', 'DELETE', headers=headers)[0], 200)
        png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jEOcAAAAASUVORK5CYII=')
        replacement = server.save_media_blob(png, 'image/png', 'replacement.png', server.LOCAL_ID)
        route = '/api/workspace/materials/' + material
        status, result = self.api(route, 'PUT', {'category':tag, 'rating':5, 'favorite':True,
                                                 'replacementMediaId':replacement['mediaId']}, headers)
        self.assertEqual(status, 200, result)
        job = 'blend-'+'5'*32
        folder = server.BLENDER_BRIDGE.directory / job
        folder.mkdir()
        (folder/'model.blend').write_bytes(b'fixture-version')
        server.BLENDER_BRIDGE._write(folder/'job.json', {'id':job, 'workspaceId':old, 'status':'succeeded'})
        self.assertEqual(self.api('/api/blender/jobs/'+job)[0], 404)
        self.assertEqual(self.api('/api/workspaces/'+old, 'DELETE')[0], 200)
        row = self.api(route)[1]['material']
        self.assertEqual((row['category'], row['rating'], row['favorite'], row['url']),
                         (tag, 5, True, replacement['url']))
        categories = {c['id']:c['name'] for c in self.api('/api/workspace/materials/categories')[1]['categories']}
        self.assertIn('scene', categories)
        self.assertEqual(categories[local_tag], 'Recovered tag')
        self.assertEqual(categories[tag], 'Recovered tag (2)')
        self.assertIn(job, [j['id'] for j in self.api('/api/blender/jobs')[1]['jobs']])
        with self.client.open(self.base+'/api/blender/jobs/'+job+'/download') as response:
            self.assertEqual(response.read(), b'fixture-version')
        self.assertEqual(self.api(route, 'PUT', {'rating':1})[0], 200)
        self.assertEqual(self.api(route)[1]['material']['rating'], 1)

    def test_workspace_review_project_move_includes_conversation(self):
        source = self.api('/api/workspaces', 'POST', {'name':'Source canvas'})[1]['workspace']['id']
        target = self.api('/api/workspaces', 'POST', {'name':'Destination canvas'})[1]['workspace']['id']
        src, dst = {'X-Workspace-Id':source}, {'X-Workspace-Id':target}
        project = self.api('/api/projects', 'POST', {'projectName':'Project and chat'}, src)[1]['project']
        session = self.api('/api/agent/sessions', 'POST', {'projectId':project['id']}, src)[1]['session']
        route = '/api/agent/sessions/'+session['id']
        status, result = self.api('/api/projects/'+project['id'], 'PUT', {**project, 'workspaceId':target}, src)
        self.assertEqual(status, 200, result)
        self.assertEqual(self.api(route, headers=src)[0], 404)
        self.assertEqual(self.api(route, headers=dst)[0], 200)
        raw = json.loads(server.AGENT_SESSIONS_FILE.read_text(encoding='utf-8'))
        self.assertEqual(next(row for row in raw if row['id']==session['id'])['workspaceId'], target)
        # Older builds left the source workspace in this file.
        next(row for row in raw if row['id']==session['id'])['workspaceId'] = source
        server.write_agent_sessions(raw)
        self.assertEqual(self.api(route, headers=dst)[0], 200)
        self.assertEqual(self.api(route, headers=src)[0], 404)

    def test_moved_project_keeps_existing_and_inflight_jobs_in_destination(self):
        source, target = [self.api('/api/workspaces', 'POST', {'name': name})[1]['workspace']['id']
                          for name in ('Job source', 'Job destination')]
        src, dst = {'X-Workspace-Id': source}, {'X-Workspace-Id': target}
        project = self.api('/api/projects', 'POST', {'projectName': 'Movable jobs'}, src)[1]['project']
        active = {'id': 'moving-task', 'kind': 'video', 'userId': server.LOCAL_ID, 'workspaceId': source,
                  'projectId': project['id'], 'providerJobId': 'fixture', 'status': 'running'}
        server.append_job(active)
        finished = {**active, 'id': 'moving-completed', 'status': 'completed'}
        server.append_job(finished)
        listing = '/api/jobs?projectId=' + project['id']
        self.assertEqual(self.api(listing, headers=src)[1]['total'], 2)
        self.assertEqual(self.api('/api/projects/' + project['id'], 'PUT', {'workspaceId': target}, src)[0], 200)
        self.assertEqual(self.api(listing, headers=dst)[1]['total'], 2)
        self.assertEqual(self.api(listing, headers=src)[1]['total'], 0)
        # A worker can finish with its pre-move snapshot.
        server.append_job({**active, 'status': 'completed'})
        for job_id in (active['id'], finished['id']):
            recovered = self.api('/api/jobs/' + job_id, headers=dst)[1]['job']
            self.assertEqual((recovered['status'], recovered['workspaceId']), ('completed', target))
            self.assertEqual(self.api('/api/jobs/' + job_id, headers=src)[0], 404)

    def test_workspace_review_removed_space_tombstones_respect_existing_default_materials(self):
        workspace = self.api('/api/workspaces', 'POST', {'name':'Old tombstones'})[1]['workspace']['id']
        default = server.default_workspace_id(server.LOCAL_ID)
        headers = {'X-Workspace-Id':workspace}
        assets = server.read_assets()
        for key, url, scope in [('local','shared',default),('other','shared',workspace),('hidden','hidden',workspace)]:
            assets.append({'id':'tombstone-'+key, 'ownerId':server.LOCAL_ID, 'workspaceId':scope,
                           'kind':'image', 'name':url, 'url':'https://fixture.invalid/tombstone-'+url+'.png'})
        server.write_file(server.ASSETS_FILE, assets)
        rows = self.api('/api/workspace/materials', headers=headers)[1]['materials']
        ids = {row['name']:row['id'] for row in rows}
        self.assertEqual(self.api('/api/workspace/materials', 'DELETE', {'ids':list(ids.values())}, headers)[0], 200)
        self.assertEqual(self.api('/api/workspaces/'+workspace, 'DELETE')[0], 200)
        self.assertEqual(self.api('/api/workspace/materials/'+ids['shared'])[0], 200)
        self.assertEqual(self.api('/api/workspace/materials/'+ids['hidden'])[0], 404)

    def test_workspace_review_chat_reply_preserves_delete_and_rename(self):
        for action in ('DELETE', 'PUT'):
            session = self.api('/api/agent/sessions', 'POST', {})[1]['session']
            route = '/api/agent/sessions/'+session['id']
            changes = []
            def loop(messages, **kwargs):
                changes.append(self.api(route, action, {'title':'New title'} if action=='PUT' else None)[0])
                messages.append({'role':'assistant','content':'Offline reply'})
                yield {'type':'text','text':'Offline reply'}
            with patch.object(server,'agent_resolve_model',return_value=({'model':'test'},None)), \
                 patch.object(server,'agent_chat_quote',return_value={'canAfford':True}), \
                 patch.object(server.agent,'run_agent_loop',side_effect=loop):
                body = json.dumps({'sessionId':session['id'], 'message':'Continue'}).encode()
                with self.client.open(Request(self.base+'/api/agent/chat', data=body,
                                              headers={'Content-Type':'application/json'}),timeout=10) as response:
                    self.assertIn(b'Offline reply', response.read())
            self.assertEqual(changes, [200])
            status, result = self.api(route)
            if action == 'DELETE':
                self.assertEqual(status, 404)
            else:
                self.assertEqual(result['session']['title'], 'New title')
                self.assertEqual(result['session']['messages'][-1]['content'], 'Offline reply')

    def test_studio_job_restores_editable_inputs_and_skips_inline_media_in_lists(self):
        raw = {'prompt': 'original prompt', 'settings': {'seed': 0, 'generateAudio': False,
               'option.shape': 'wide', 'constructor': 'ignored'}, 'refs': {'firstFrame': [
                   {'name': '首帧', 'kind': 'image', 'url': '/media/first.png'},
                   {'name': 'inline', 'kind': 'image', 'url': 'data:image/png;base64,AAAA'}]}}
        job = {'id': 'test', 'kind': 'video', 'referenceImages': ['data:image/png;base64,AAAA'],
               'sourceAudios': ['data:audio/wav;base64,AAAA'], 'prompt': 'resolved camera description'}
        server.attach_studio_draft(job, {'studioDraft': raw})
        view = server.studio_job_view(job)
        self.assertEqual(view['studioDraft'], {'prompt': 'original prompt',
            'settings': {'seed': 0, 'generateAudio': False, 'option.shape': 'wide'},
            'refs': {'firstFrame': [{'name': '首帧', 'kind': 'image', 'url': '/media/first.png'}]}})
        self.assertNotIn('referenceImages', view)
        self.assertNotIn('sourceAudios', view)

    def test_studio_recovery_queries_existing_video_once_and_keeps_terminal_state(self):
        job = {'id': 'fixture', 'kind': 'video', 'providerJobId': 'upstream-id', 'status': 'completed',
               'prompt': 'original', 'submittedAt': '2020-01-01', 'videoUrl': ''}
        with (patch.object(server, 'refresh_video_job', return_value={'videoUrl': '/media/recovered.mp4'}) as poll,
              patch.object(server, 'resolve_media_file', return_value=Path('recovered.mp4')),
              patch.object(server, 'append_job') as append):
            recovered = server.recover_studio_video(job)
            self.assertEqual(poll.call_args.args[0]['providerJobId'], 'upstream-id')
            self.assertEqual(poll.call_args.args[0]['submittedAt'], '')
            self.assertEqual(recovered['status'], 'completed')
            self.assertEqual(recovered['submittedAt'], job['submittedAt'])
            self.assertEqual(server.completed_media_update(job, recovered)['videoUrl'], '/media/recovered.mp4')
            append.assert_called_once()
        with patch.object(server, 'refresh_video_job', return_value={'status': 'failed'}) as poll:
            self.assertEqual(server.recover_studio_video(job), job)
            self.assertEqual(server.recover_studio_video({**job, 'status':'failed'})['status'], 'failed')
            poll.assert_called_once()
        remote = {**job, 'videoUrl':'https://fixture.invalid/result.mp4', 'videoPersistError':'temporary'}
        self.assertFalse(server.completed_media_update(job, remote)['videoUrl'])
        self.assertEqual(server.completed_media_update(job, {**remote, '_studioLookup': True})['videoUrl'], remote['videoUrl'])

    def test_recovery_replaces_expired_and_missing_results_without_resubmission(self):
        refreshed = 'https://fixture.invalid/fresh.mp4'
        space = self.api('/api/workspaces', 'POST', {'name': 'Recover result'})[1]['workspace']['id']
        headers = {'X-Workspace-Id': space}
        for suffix, old in [('cdn', 'https://fixture.invalid/stale.mp4'), ('local', '/media/missing.mp4')]:
            job = {'id': 'recover-' + suffix, 'status': 'completed', 'kind': 'video', 'userId': server.LOCAL_ID,
                   'workspaceId': space, 'providerJobId': 'task-' + suffix, 'videoUrl': old}
            server.append_job(job)
            route = '/api/jobs/' + job['id'] + '?recoverMedia=1'
            with patch.object(server, 'refresh_video_job') as lookup, patch.object(server, 'call_video_submit') as submit:
                lookup.return_value = {'videoUrl': old, 'videoPersistError': 'unavailable'}
                self.assertEqual(self.api(route, headers=headers)[0], 409)
                self.assertEqual(server.index_jobs()[job['id']]['videoUrl'], old)
                lookup.return_value = {'videoUrl': refreshed, 'videoPersistError': 'temporary download failure'}
                self.assertEqual(self.api(route, headers=headers)[1]['job']['videoUrl'], refreshed)
                self.assertEqual(server.index_jobs()[job['id']]['videoUrl'], refreshed)
                self.assertEqual(lookup.call_args.args[0]['videoUrl'], '')
                submit.assert_not_called()

    def test_depth_video_recovery_rebuilds_missing_playback_from_local_master(self):
        space = self.api('/api/workspaces', 'POST', {'name': 'Recover depth video'})[1]['workspace']['id']
        headers = {'X-Workspace-Id': space}
        raw = b'\x00\x00\x00\x18ftypisom' + bytes(32)
        master = server.save_media_blob(raw, 'video/mp4', 'master.mp4', owner_id=server.LOCAL_ID)
        playable = server.save_media_blob(raw, 'video/mp4', 'playable.mp4', owner_id=server.LOCAL_ID)
        job = {'id': 'recover-depth-master', 'status': 'completed', 'kind': 'video', 'userId': server.LOCAL_ID,
               'workspaceId': space, 'providerProtocol': server.DEPTH_PROTOCOL, 'providerJobId': 'depth-task',
               'videoUrl': '/media/missing.mp4', 'depthMasterUrl': master['url']}
        server.append_job(job)
        route = '/api/jobs/' + job['id'] + '?recoverMedia=1'
        with patch('mediakit_depth.playable_version', return_value=playable['url']) as transcode, \
             patch('mediakit_depth.transport') as transport, patch.object(server, 'refresh_video_job') as lookup:
            self.assertEqual(self.api(route, headers=headers)[1]['job']['videoUrl'], playable['url'])
            self.assertEqual(self.api(route, headers=headers)[1]['job']['videoUrl'], playable['url'])
            transcode.assert_called_once()
            transport.assert_not_called()
            lookup.assert_not_called()

    def test_studio_submission_can_be_loaded_from_workspace_history(self):
        saved = {'prompt': '原始镜头描述', 'settings': {'referenceMode': 'frames2video', 'duration': '5'},
                 'refs': {'firstFrame': [{'url':'https://fixture.invalid/first.jpg','kind':'image','name':'首帧'}],
                          'lastFrame': [{'url':'https://fixture.invalid/last.jpg','kind':'image','name':'尾帧'}]}}
        model = {'id':'studio-video', 'kind':'video', 'usages':['video'], 'enabled':True,
                 'model':'demo', 'baseUrl':'https://fixture.invalid', 'apiKey':'fixture'}
        body = {'modelId':model['id'], 'prompt':'镜头描述与展开的运镜设置', 'studioDraft':saved,
                'generationSettings': saved['settings'],
                'referenceImages':[saved['refs'][slot][0]['url'] for slot in ('firstFrame','lastFrame')]}
        with patch.object(server, 'visible_ai_models', return_value=[model]), \
                patch.object(server, 'call_video_submit', return_value=({'providerJobId':'existing-id'}, None)) as send:
            status, response = self.api('/api/generate', 'POST', body)
        self.assertEqual(status, 202, response)
        send.assert_called_once()
        submitted_job = response['job']
        self.assertEqual(submitted_job['studioDraft'], saved)
        status, history = self.api('/api/jobs?kind=video&view=studio')
        self.assertEqual(status, 200)
        recorded = next(row for row in history['jobs'] if row['id'] == submitted_job['id'])
        self.assertEqual(recorded['studioDraft'], saved)
        self.assertNotIn('referenceImages', recorded)
        self.assertEqual(recorded['prompt'], body['prompt'])

    def test_studio_image_auto_size_and_provider_options_reach_upstream(self):
        entry = {'id': 'newapi-lk888-studio', 'model': 'tt-image-2.5', 'apiKey': 'fixture',
                 'baseUrl': 'https://fixture.invalid', 'imageTransport': 'media-generate'}
        doc = server.upstream_contract(entry)
        schema = {p['name']: p for p in doc['params']}
        request = {'size': 'auto', 'quality': 'high',
                   'imageSpec': {'aspectRatio': 'auto', 'resolution': '2K', 'quality': 'high'},
                   'modelOptions': {'version': 'sunburst', 'background': 'auto'}}
        with patch.object(server, 'read_ai_models', return_value=[entry]), \
                patch.object(server, 'media_model_schema', return_value=schema), \
                patch.object(server, 'request_json_candidates',
                             return_value=({'code': 200, 'data': {'task_id': 'fixture'}}, 'fixture', None)) as upstream:
            prepared = server.image_entry_options(entry, request)
            result, error = server.submit_media_generate(prepared, 'prompt', request['size'], quality=request['quality'])
        self.assertIsNone(error)
        self.assertTrue(result)
        params = upstream.call_args.args[1]['params']
        self.assertEqual({k: params[k] for k in ('aspect_ratio', 'resolution', 'quality', 'version', 'background')},
                         {'aspect_ratio': 'auto', 'resolution': '2K', 'quality': 'high',
                          'version': 'sunburst', 'background': 'auto'})
        self.assertNotIn('size', params)
        with patch.object(server, 'read_ai_models', return_value=[entry]), \
                patch.object(server, 'media_model_schema', return_value=schema), \
                patch.object(server, 'request_json_candidates',
                             return_value=({'code': 200, 'data': {'task_id': 'fixture'}}, 'fixture', None)) as upstream:
            with self.assertRaisesRegex(ValueError, '像素范围'):
                server.image_entry_options(entry, {'modelOptions': {'size': '1000x1000'}})
            prepared = server.image_entry_options(entry, {'modelOptions': {'size': '1536x864'}})
            server.submit_media_generate(prepared, 'prompt', '1536x864')
            params = upstream.call_args.args[1]['params']
            self.assertEqual(params['size'], '1536x864')
            self.assertFalse({'resolution', 'aspect_ratio'} & set(params))

    def test_studio_image_pixel_size_native_quality_and_reference_limits(self):
        entry = {'id': 'newapi-lk888-pixels', 'model': 'tt-image-2', 'apiKey': 'fixture',
                 'baseUrl': 'https://fixture.invalid', 'imageTransport': 'openai-images'}
        self.assertEqual(server.image_reference_limits(entry), {'min': 0, 'max': 14})
        self.assertEqual(server.image_reference_limits({**entry, 'model': 'gk-image-2.0'})['max'], 3)
        self.assertEqual(server.image_reference_limits({**entry, 'model': 'tt-image-2.5'})['max'], 16)
        self.assertEqual(server.image_reference_limits({'imageTransport': 'generation-input-image'})['max'], 1)
        with self.assertRaisesRegex(ValueError, '参考图数量'):
            server.image_entry_options(entry, {'referenceImages': ['fixture'] * 15})
        for size, quality in [('1024x1536', 'medium'), ('auto', 'auto')]:
            with self.subTest(size=size), patch.object(server, 'request_json_candidates',
                    return_value=({'task_id': 'fixture'}, 'fixture', None)) as upstream:
                prepared = server.image_entry_options(entry, {'quality': quality})
                server.submit_image_generation(prepared, 'prompt', size=size, quality=quality)
                payload = upstream.call_args.args[1]
                self.assertEqual((payload['size'], payload['quality'], payload['n']), (size, quality, 1))

    def test_community_bridge_routes_and_cross_origin_protection(self):
        with patch.object(server.COMMUNITY_SKILLS, 'catalog', return_value={'skills': [], 'count': 0}) as catalog:
            status, result = self.api('/api/agent/community-skills?refresh=1')
            self.assertEqual(status, 200)
            self.assertEqual(result['count'], 0)
            catalog.assert_called_once_with(force=True)
            self.assertEqual(self.api('/api/agent/community-skills', headers={'Origin':'https://untrusted.invalid'})[0], 403)
            self.assertEqual(catalog.call_count, 1)
        with patch.object(server.COMMUNITY_SKILLS, 'detail', side_effect=server.CommunityError('已下架', 404)) as detail:
            self.assertEqual(self.api('/api/agent/community-skills/community-test')[0], 404)
            detail.assert_called_once_with('community-test')

    def test_skill_editor_preserves_identity_and_prevents_overwrite(self):
        self.assertEqual(server.agent.session_title_from('更新我的 Skill「Example」\n\nCurrent instructions'), '更新我的 Skill')
        payload = {'name':'Editor original', 'description':'First description', 'prompt':'First instructions',
                   'files':[{'path':'SKILL.md','content':'# First\r\n'}, {'path':'references/note.md','content':'Reference\n'}],
                   'primarySkillFilePath':'SKILL.md', 'createOnly':True,
                   'metadata':{'useScenario':'广告镜头', 'inputType':'提供产品参考', 'outputContent':'镜头表', 'kind':'视频', 'cover':'/media/media-test.png'}}
        status, created = self.api('/api/agent/skills', 'POST', payload)
        self.assertEqual(status, 200)
        original = created['skill']
        status, _ = self.api('/api/agent/skills', 'POST', {**payload, 'prompt':'Do not overwrite'})
        self.assertEqual(status, 400)
        status, updated = self.api('/api/agent/skills/'+original['id'], 'PUT',
                                   {**payload, 'name':'Editor renamed', 'description':'Updated description'})
        self.assertEqual(status, 200)
        self.assertEqual(updated['skill']['id'], original['id'])
        self.assertEqual(updated['skill']['createdAt'], original['createdAt'])
        self.assertEqual(updated['skill']['files'][1]['content'], 'Reference\n')
        self.assertEqual(updated['skill']['description'], 'Updated description')
        self.assertEqual(updated['skill']['metadata'], payload['metadata'])
        self.assertEqual(self.api('/api/agent/skills')[1]['skillEditorVersion'], 2)
        for invalid in ({**payload['metadata'], 'inputType':''}, {**payload['metadata'], 'kind':'invalid'},
                        {**payload['metadata'], 'cover':'javascript:alert(1)'}, {**payload['metadata'], 'cover':'/media/../private.png'}):
            status, _ = self.api('/api/agent/skills/'+original['id'], 'PUT', {**payload, 'metadata':invalid})
            self.assertEqual(status, 400)
        status, other = self.api('/api/agent/skills', 'POST', {**payload, 'name':'Editor other'})
        self.assertEqual(status, 200)
        status, _ = self.api('/api/agent/skills/'+original['id'], 'PUT', {**payload, 'name':'Editor other'})
        self.assertEqual(status, 409)
        status, _ = self.api('/api/agent/skills/nonexistent', 'PUT', payload)
        self.assertEqual(status, 404)
        foreign, error = server.save_agent_skill('different-user', 'Editor renamed', prompt='Must not change', skill_id=original['id'])
        self.assertIsNone(foreign)
        self.assertIn('无权编辑', error)
        saved = {s['id']:s for s in self.api('/api/agent/skills')[1]['skills']}
        self.assertEqual(saved[original['id']]['name'], 'Editor renamed')
        self.assertEqual(saved[original['id']]['prompt'], 'First instructions')
        self.assertEqual(saved[other['skill']['id']]['name'], 'Editor other')
        owner = next(s['userId'] for s in server.read_agent_skills() if s['id'] == original['id'])
        legacy, error = server.save_agent_skill(owner, 'Editor renamed', prompt='Agent rewrite')
        self.assertIsNone(legacy)
        self.assertIn('update_skill', error)
        self.assertEqual(next(s for s in server.read_agent_skills() if s['id'] == original['id'])['metadata'], payload['metadata'])

    def test_skill_folder_documents_roundtrip_and_validation(self):
        documents = [{'path': 'SKILL.md', 'content': '# Folder skill\n\n[Reference](references/camera.md)'},
                     {'path': 'references/camera.md', 'content': 'Camera reference\r\n'}]
        payload = {'name': 'Folder skill test', 'prompt': 'Execute both documents', 'files': documents,
                   'primarySkillFilePath': 'SKILL.md', 'source': 'import'}
        status, result = self.api('/api/agent/skills', 'POST', payload)
        self.assertEqual(status, 200)
        skill = result['skill']
        saved = next(item for item in self.api('/api/agent/skills')[1]['skills'] if item['id'] == skill['id'])
        self.assertEqual(saved['files'][1]['content'], 'Camera reference\r\n')
        self.assertEqual(saved['primarySkillFilePath'], 'SKILL.md')
        # The canvas import path in older clients omits createOnly and sends one file.
        status, conflict = self.api('/api/agent/skills', 'POST', {**payload, 'files':documents[:1]})
        self.assertEqual(status, 400)
        self.assertIn('同名', conflict['message'])
        for bad_path in ('../escape.md', '/absolute.md', 'C:/escape.md', 'scripts/run.py'):
            with self.subTest(path=bad_path):
                status, _ = self.api('/api/agent/skills', 'POST', {**payload, 'files': [{'path':bad_path,'content':'bad'}]})
                self.assertEqual(status, 400)
        status, _ = self.api('/api/agent/skills', 'POST', {**payload, 'primarySkillFilePath':'missing.md'})
        self.assertEqual(status, 400)
        status, updated = self.api('/api/agent/skills', 'POST', {'name':payload['name'],'prompt':'New instructions'})
        self.assertEqual(status, 400)
        saved = next(s for s in self.api('/api/agent/skills')[1]['skills'] if s['id'] == skill['id'])
        self.assertEqual(saved['files'][1]['content'], 'Camera reference\r\n')

    def test_agent_skill_patch_preserves_files_identity_and_metadata(self):
        payload = {'name':'Agent patch audit', 'description':'Original', 'prompt':'Combined instructions',
                   'files':[{'path':'SKILL.md','content':'See [camera](references/camera.md)'},
                            {'path':'references/camera.md','content':'Camera details'}], 'primarySkillFilePath':'SKILL.md',
                   'metadata':{'useScenario':'广告', 'inputType':'参考图', 'outputContent':'分镜', 'kind':'视频'}}
        status, result = self.api('/api/agent/skills', 'POST', payload)
        self.assertEqual(status, 200)
        original = result['skill']; skill_id = original['id']
        owner = next(s['userId'] for s in server.read_agent_skills() if s['id'] == skill_id)
        ctx = server.build_agent_ctx({'id':owner}, {'nodes':[], 'edges':[]}, {})
        def run(args): return server.agent._tool_update_skill({'skillId':skill_id, **args}, ctx, [])
        listed = server.agent._tool_list_skills({'skillId':skill_id}, ctx, [])['skills']
        self.assertTrue(any(s['id'] == skill_id and len(s['files']) == 2 for s in listed))
        count = len(server.read_agent_skills())
        self.assertTrue(run({'name':'Agent patch renamed', 'description':'Changed'})['ok'])
        saved = next(s for s in server.read_agent_skills() if s['id'] == skill_id)
        self.assertEqual(len(server.read_agent_skills()), count)
        self.assertEqual(saved['name'], 'Agent patch renamed')
        self.assertEqual(saved['files'], original['files'])
        self.assertEqual(saved['metadata'], original['metadata'])
        self.assertEqual(saved['createdAt'], original['createdAt'])
        self.assertTrue(run({'fileUpdates':[{'path':'SKILL.md','content':'Updated [camera](references/camera.md)'}]})['ok'])
        saved = next(s for s in server.read_agent_skills() if s['id'] == skill_id)
        self.assertEqual(saved['files'][1]['content'], 'Camera details')
        self.assertIn('Camera details', saved['prompt'])
        before = json.dumps(saved, sort_keys=True)
        for bad in ([{'path':'../escape.md','content':'bad'}], [{'path':'SKILL.md','content':''}],
                    [{'path':'A.md','content':'1'}, {'path':'a.md','content':'2'}]):
            self.assertFalse(run({'fileUpdates':bad})['ok'])
            self.assertEqual(json.dumps(next(s for s in server.read_agent_skills() if s['id'] == skill_id),sort_keys=True),before)
        foreign, error = server.update_agent_skill('another-user', skill_id, {'name':'hijacked'})
        self.assertIsNone(foreign); self.assertIn('无权',error)
        duplicate = server.agent._tool_create_skill({'name':'Agent patch renamed','prompt':'replacement'},ctx,[])
        self.assertFalse(duplicate['ok'])
        self.assertEqual(json.dumps(next(s for s in server.read_agent_skills() if s['id'] == skill_id),sort_keys=True),before)

    @classmethod
    def setUpClass(cls):
        cls.http = server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler,access_key=os.urandom(32))
        server.Handler.log_message = lambda *args: None
        cls.base = 'http://127.0.0.1:'+str(cls.http.server_address[1])
        threading.Thread(target=cls.http.serve_forever,daemon=True).start()
        cls.client = build_opener(ProxyHandler({}))
        cls.client.addheaders = [('X-CanvasFlow-Session', cls.http.local_access.desktop_token)]

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

    def derivative_request(self, slots=(1, 2)):
        key = str(server.uuid.uuid4())
        source = server.save_media_blob(b'role source', 'image/png', 'source.png',server.LOCAL_ID)['url']
        role = {'id':'role-'+key,'name':'派生图测试','images':[source, '', '', ''],
                'styling':{'version':1,'sourceImages':[source,'','',''],'renderedSlots':[0],'renderReadySlots':[0]}}
        items = [{'slot':i, 'payload':{'modelId':'model-offline','prompt':str(i),'referenceImages':[source]}} for i in slots]
        return {'id':role['id'],'record':role,'expectedRevision':'','derivatives':{'id':key,'projectId':'','items':items}}

    def test_role_derivatives_background_and_replay(self):
        from time import monotonic, sleep
        request = self.derivative_request()
        path = '/api/preset-roles/record?scope=mine'
        key = request['derivatives']['id']
        status_path = '/api/preset-roles/derivatives?id='+key
        gate = threading.Event()
        def submit(user, payload, workspace, *, job_id):
            self.assertTrue(gate.wait(5))
            blob = server.save_media_blob(('result '+payload['prompt']).encode(),'image/png','slot.png',user['id'])
            return {'id':job_id, 'status':'completed', 'imageUrl':blob['url']}, None
        with patch.object(server, 'create_image_job', side_effect=submit) as create:
            code, saved = self.api(path,'PUT',request)
            self.assertEqual(code,200,saved)
            self.assertEqual(saved['derivatives']['initialRevision'],saved['recordRevisions'][request['id']])
            self.assertEqual(self.api(path,'PUT',request)[0],200)
            self.assertEqual(self.api(path,'PUT',{**request,'record':{**request['record'],'name':'另一个修改'}})[0],409)
            gate.set()
            deadline = monotonic()+8
            while monotonic()<deadline:
                code, state = self.api(status_path)
                if state['status']=='completed':
                    break
                sleep(.05)
            self.assertEqual((code,state['status']),(200,'completed'),state)
            self.assertEqual(create.call_count,2)
            self.http.role_worker.close()
            self.http.role_worker = server.RoleDerivativeWorker()
        code, replay = self.api(path,'PUT',request)
        self.assertEqual(code,200)
        card = next(r for r in replay['custom'] if r['id']==request['id'])
        self.assertEqual(card['images'][1:3],[item['imageUrl'] for item in state['items']])
        self.assertEqual(card['styling']['renderReadySlots'],[0,1,2])
        self.assertEqual(replay['recordRevisions'][card['id']],state['revision'])
        self.assertEqual(card['styling']['derivativeBatchId'],key)
        self.assertNotIn('payload',state['items'][0])

    def test_role_derivative_result_cannot_overwrite_intervening_edit(self):
        request = self.derivative_request((1,2,3))
        path = '/api/preset-roles/record?scope=mine'
        key = request['derivatives']['id']
        with patch.object(self.http.role_worker, 'resume'):
            code, reply = self.api(path,'PUT',request)
            self.assertEqual(code,200)
        role = next(r for r in reply['custom'] if r['id']==request['id'])
        replacement = server.save_media_blob(b'replacement','image/png','new.png',server.LOCAL_ID)['url']
        def submit(user, payload, workspace, *, job_id):
            self.assertEqual(self.api(path,'PUT',{'id':role['id'],'expectedRevision':reply['recordRevisions'][role['id']],
                                                  'record':{**role,'name':'较新版本','images':[replacement]*4}})[0],200)
            return {'id':job_id,'status':'completed','imageUrl':role['images'][0]}, None
        with patch.object(server, 'create_image_job', side_effect=submit) as create:
            worker = server.RoleDerivativeWorker()
            worker.advance(key)
            self.assertEqual(create.call_count,1)
        _, state = self.api('/api/preset-roles/derivatives?id='+key)
        self.assertEqual([r['status'] for r in state['items']], ['superseded']*3)
        mine = self.api('/api/preset-roles')[1]['mine']['custom']
        self.assertEqual(next(r['images'] for r in mine if r['id']==role['id']),[replacement]*4)

    def test_role_derivative_resumes_existing_async_receipt(self):
        request = self.derivative_request((1,))
        key = request['derivatives']['id']
        path = '/api/preset-roles/record?scope=mine'
        with patch.object(self.http.role_worker, 'resume'):
            self.assertEqual(self.api(path, 'PUT', request)[0], 200)
        def submit(user, payload, workspace, *, job_id):
            job = {'id':job_id, 'userId':user['id'], 'workspaceId':workspace, 'modelId':payload['modelId'],
                   'kind':'image', 'simulated':False, 'providerJobId':'remote-offline', 'status':'running'}
            server.append_job(job)
            return job, None
        worker = server.RoleDerivativeWorker()
        with patch.object(server, 'create_image_job', side_effect=submit) as create:
            worker.advance(key)
            blob = server.save_media_blob(b'async result','image/png','async-result.png',server.LOCAL_ID)
            resumed = server.RoleDerivativeWorker()
            with patch.object(server, 'refresh_image_job', side_effect=lambda j: {**j,'status':'completed','imageUrl':blob['url']}) as refresh:
                resumed.advance(key)
                self.assertEqual(refresh.call_args.args[0]['providerJobId'],'remote-offline')
            self.assertEqual(create.call_count,1)
        self.assertEqual(self.api('/api/preset-roles/derivatives?id='+key)[1]['status'],'completed')

    def test_role_derivatives_validate_restore_and_stale_role(self):
        path = '/api/preset-roles/record?scope=mine'
        with patch.object(self.http.role_worker,'resume'):
            request = self.derivative_request((1,))
            role, spec = request['record'], request['derivatives']
            code, _ = self.api(path,'PUT',{**request,'derivatives':{**spec,'projectId':'missing-project'}})
            self.assertEqual(code,400)
            bad = {**spec['items'][0]['payload'],'referenceImages':['https://invalid.example/file.png']}
            self.assertEqual(self.api(path,'PUT',{**request,'derivatives':{**spec,'items':[{'slot':1,'payload':bad}]}})[0],400)
            shared = server.save_media_blob(b'public role fixture','image/png','published.png','other-owner')['url']
            refs = [role['images'][0], shared]
            borrowed = {**request,'derivatives':{**spec,'items':[{'slot':1,'payload':{**bad,'referenceImages':refs}}]}}
            file_row, can_read = server.ACCOUNT_STORAGE.file_row, server.ACCOUNT_STORAGE.can_read
            with patch.object(server.ACCOUNT_STORAGE,'file_row',side_effect=lambda name:
                              {**file_row(name),'ownerId':'other-owner'} if name==shared[7:] else file_row(name)):
                with patch.object(server.ACCOUNT_STORAGE,'can_read',side_effect=lambda name, owner: name!=shared[7:] and can_read(name,owner)):
                    self.assertEqual(self.api(path,'PUT',borrowed)[1]['error'],'invalid_derivatives')
                with patch.object(server.ACCOUNT_STORAGE,'can_read',side_effect=lambda name, owner: name==shared[7:] or can_read(name,owner)):
                    code, result = self.api(path,'PUT',borrowed)
                    self.assertEqual((code,result['error'],result['references']),(400,'copy_shared_role_references',[shared]))
            code, initial = self.api(path,'PUT',request)
            self.assertEqual(code,200,initial)
        worker = server.RoleDerivativeWorker()
        # Simulate a crash between provider submission and receipt persistence.
        key = spec['id']
        with server.LOCK:
            raw = server.read_preset_roles_raw()
            raw['derivativeBatches'][key]['items'][0].update(status='running', jobId='job-missing-derivative')
            server.write_file(server.PRESET_ROLES_FILE,raw)
        with patch.object(server,'create_image_job') as create:
            worker.advance(key)
            create.assert_not_called()
        code, failed = self.api('/api/preset-roles/derivatives?id='+key)
        self.assertEqual((code,failed['status']),(200,'failed'))
        with patch.object(self.http.role_worker,'resume'):
            second = self.derivative_request((3,))
            code, saved = self.api(path,'PUT',second)
            self.assertEqual(code,200)
            latest = next(r for r in saved['custom'] if r['id']==second['id'])
            self.assertEqual(self.api(path,'PUT',{'id':latest['id'],'record':{**latest,'name':'更新后的角色'},
                                                  'expectedRevision':saved['recordRevisions'][latest['id']]})[0],200)
        key = second['derivatives']['id']
        with patch.object(server,'create_image_job') as create:
            worker.advance(key)
            create.assert_not_called()
        self.assertEqual(self.api('/api/preset-roles/derivatives?id='+key)[1]['status'],'superseded')

    def test_role_styling_and_references_survive_single_record_writes(self):
        path = '/api/preset-roles/record?scope=mine'
        official = {'id': 'libtv-local-fixture', 'name': '模板', 'value': '原设定'}
        self.assertEqual(self.api('/api/preset-roles?scope=global', 'PUT', {'overrides': {official['id']: official}})[0], 200)
        self.assertEqual(self.api(path, 'PUT', {'id': official['id'], 'record': official})[0], 409)
        blob = server.save_media_blob(b'role reference', 'image/png', 'role.png', server.LOCAL_ID)
        outfit = server.save_media_blob(b'outfit reference', 'image/png', 'outfit.png', server.LOCAL_ID)
        styling = {'version': 1, 'outfitUrl': outfit['url'], 'controls': {'character.hair.length': -79, 'voice.tone.enabled': False,
                                             'voice.tone.description': '轻声、缓慢'}, 'prompt': '长发。声音轻缓。'}
        copy = {**official, 'id': 'char-copy-fixture', 'styling': styling, 'images': ['', blob['url'], '', '']}
        private = {'id': 'char-existing-fixture', 'name': '同名', 'value': '老格式'}
        for record in [copy, private, dict(copy, name='新名字')]:
            status, result = self.api(path, 'PUT', {'id': record['id'], 'record': record})
            self.assertEqual(status, 200, result)
        snapshot = self.api('/api/preset-roles')[1]
        saved = {role['id']: role for role in snapshot['mine']['custom']}
        self.assertEqual(saved[copy['id']], {**copy, 'name': '新名字', 'tags': []})
        self.assertNotIn('styling', saved[private['id']])
        self.assertEqual(snapshot['global']['overrides'][official['id']]['value'], '原设定')
        self.assertNotIn('styling', snapshot['global']['overrides'][official['id']])
        self.assertIn('角色库', server.media_referenced_by(blob['url'].split('/')[-1]))
        self.assertIn('角色库', server.media_referenced_by(outfit['url'].split('/')[-1]))
        self.assertEqual(server.role_storage_bytes(saved[copy['id']]), len(b'role reference') + len(b'outfit reference'))
        for untrusted in ('https://example.invalid/outfit.jpg', '/media/../file.jpg', 'data:image/png;base64,YmFk'):
            invalid = {**copy, 'styling': {**styling, 'outfitUrl': untrusted}}
            self.assertNotIn('outfitUrl', server._clean_role(invalid)['styling'])
        self.assertEqual(self.api(path, 'PUT', {'id': copy['id'], 'remove': True})[0], 200)
        self.assertNotIn('角色库', server.media_referenced_by(outfit['url'].split('/')[-1]))
        self.assertNotIn('角色库', server.media_referenced_by(blob['url'].split('/')[-1]))

    def test_multiple_wardrobe_references_and_render_provenance(self):
        path = '/api/preset-roles/record?scope=mine'
        first = server.save_media_blob(b'first outfit', 'image/png', 'first.png', server.LOCAL_ID)
        second = server.save_media_blob(b'second outfit', 'image/png', 'second.png', server.LOCAL_ID)
        foreign = server.save_media_blob(b'other outfit', 'image/png', 'other.png', 'other-owner')
        renamed = server.save_media_blob(b'plain text', 'text/plain', 'renamed.png', server.LOCAL_ID)
        images = [first['url'], second['url'], '', '']
        style = {'version':1, 'controls':{}, 'outfitUrls':[second['url'],first['url'],second['url']],
                 'renderBasisKey':'abc0' * 8, 'renderReadySlots':[1, 0, 1, 3], 'renderSlotModels':['new','old','',''],
                 'sourceImages':images, 'renderedSlots':[1], 'renderModelId':'new'}
        record = {'id':'char-outfits', 'name':'服装配方', 'images':images, 'styling':style}
        def save(styling):
            return self.api(path, 'PUT', {'id':record['id'],'record':{**record,'styling':styling}})
        self.assertEqual(save(style)[0],200)
        saved = next(r for r in self.api('/api/preset-roles')[1]['mine']['custom'] if r['id'] == record['id'])
        self.assertEqual(saved['styling']['outfitUrl'],second['url'])
        self.assertEqual(saved['styling']['outfitUrls'],[second['url'],first['url']])
        self.assertEqual(saved['styling']['renderReadySlots'],[0,1])
        self.assertEqual(saved['styling']['renderBasisKey'],style['renderBasisKey'])
        self.assertEqual(saved['styling']['renderSlotModels'],style['renderSlotModels'])
        self.assertEqual(server.role_storage_bytes(saved),len(b'first outfitsecond outfit'))
        allowed = server.ACCOUNT_STORAGE.can_read
        with patch.object(server.ACCOUNT_STORAGE,'can_read',side_effect=lambda media,user:media != foreign['mediaId'] and allowed(media,user)):
            self.assertEqual(save({**style,'outfitUrls':[first['url'],foreign['url']]})[0],400)
        for urls in [first['url'], [renamed['url']], ['/media/media-'+'a'*32+'.mp3'], ['https://invalid.test/f.png'], [first['url']]*17]:
            with self.subTest(urls=urls): self.assertGreaterEqual(save({**style,'outfitUrls':urls})[0],400)
        cleared = server._clean_role({**record,'styling':{**style,'outfitUrls':[],'outfitUrl':first['url']}})['styling']
        self.assertNotIn('outfitUrl',cleared)
        self.assertEqual(cleared['outfitUrls'],[])

    def test_account_mark_library_filters_and_reuses_private_uploads(self):
        path = '/api/preset-roles/marks'
        stamp = server.save_media_blob(b'private mark library test', 'image/png', 'mark-library.png', server.LOCAL_ID)
        legacy = server.save_media_blob(b'legacy mark library test', 'image/png', 'mark-legacy.png', server.LOCAL_ID)
        other = server.save_media_blob(b'unrelated image', 'image/png', 'not-a-mark.png', server.LOCAL_ID)
        role = {'id':'char-legacy-mark-library', 'name':'旧贴图', 'styling':{'version':1, 'controls':{'features.marks.customImage':legacy['url']}}}
        self.assertEqual(self.api('/api/preset-roles/record?scope=mine', 'PUT', {'id':role['id'], 'record':role})[0],200)
        for _ in range(2):
            status, result = self.api(path, 'PUT', {'url':stamp['url']})
            self.assertEqual(status,200)
            self.assertEqual(result['mark'],{'url':stamp['url'], 'name':'mark-library.png'})
        status, result = self.api(path)
        self.assertEqual(status,200)
        urls = [mark['url'] for mark in result['marks']]
        self.assertEqual(urls.count(stamp['url']),1)
        self.assertIn(legacy['url'],urls)
        self.assertNotIn(other['url'],urls)
        self.assertNotIn(stamp['url'],[mark['url'] for mark in server.role_custom_marks('another-account')])
        self.assertIn('角色贴图库',server.media_referenced_by(stamp['mediaId']))
        with patch.object(server.ACCOUNT_STORAGE,'file_row',return_value={'ownerId':'another-account'}):
            self.assertEqual(self.api(path,'PUT',{'url':stamp['url']})[0],404)
        self.assertEqual(self.api(path,'PUT',{'url':'role-library/web/001-1.jpg'})[0],400)

    def test_role_source_views_custom_mark_and_render_flags_round_trip_and_protect_media(self):
        path = '/api/preset-roles/record?scope=mine'
        source = server.save_media_blob(b'source view', 'image/png', 'source.png', server.LOCAL_ID)
        mark = server.save_media_blob(b'decal', 'image/png', 'mark.png', server.LOCAL_ID)
        output = server.save_media_blob(b'generated face', 'image/png', 'face.png', server.LOCAL_ID)
        key = 'features.marks.customImage'
        role = {'id': 'char-render-state', 'name': '造型版本', 'images': ['', output['url'], '', ''],
                'styling': {'version': 1, 'controls': {key: mark['url']}, 'sourceImages':
                            ['_libtv_roles/web/001-1.jpg', source['url'], '', ''],
                            'renderedSlots': [False, 1, 1, 3, 9], 'halfPreviewOnly': True}}
        self.assertEqual(self.api(path, 'PUT', {'id': role['id'], 'record': role})[0], 200)
        stored = next(r for r in self.api('/api/preset-roles')[1]['mine']['custom'] if r['id'] == role['id'])
        self.assertEqual(stored['styling']['renderedSlots'], [1])
        self.assertTrue(stored['styling']['halfPreviewOnly'])
        self.assertEqual(stored['styling']['sourceImages'], ['role-library/web/001-1.jpg', source['url'], '', ''])
        self.assertEqual(stored['styling']['controls'][key], mark['url'])
        self.assertEqual(server.role_storage_bytes(stored), len(b'decal')+len(b'source view')+len(b'generated face'))
        self.assertEqual(server.role_storage_bytes({**stored, 'images':[source['url'],output['url']]}), server.role_storage_bytes(stored))
        self.assertIn('角色库', server.media_referenced_by(source['url'].split('/')[-1]))
        self.assertIn('角色库', server.media_referenced_by(mark['url'].split('/')[-1]))
        with patch.object(server.ACCOUNT_STORAGE, 'can_read', return_value=False):
            for route, payload in [(path, {'record':role, 'id':role['id']}),('/api/preset-roles?scope=mine', {'custom':[role]})]:
                self.assertEqual(self.api(route, 'PUT', payload)[0], 400)
        for style in ({'sourceImages':['../private.png']}, {'controls':{key:'https://example.invalid/mark.png'}}):
            invalid = {**role, 'styling':{**role['styling'], **style}}
            self.assertEqual(self.api(path, 'PUT', {'id':role['id'], 'record':invalid})[0], 400)
        self.assertEqual(self.api(path, 'PUT', {'id':role['id'], 'remove':True})[0], 200)
        self.assertNotIn('角色库', server.media_referenced_by(source['url'].split('/')[-1]))
        self.assertNotIn('角色库', server.media_referenced_by(mark['url'].split('/')[-1]))

    def test_multiple_role_marks_validate_each_user_image_and_release_removed_layers(self):
        route = '/api/preset-roles/record?scope=mine'
        a = server.save_media_blob(b'first sticker', 'image/png', 'first.png', server.LOCAL_ID)
        b = server.save_media_blob(b'second sticker', 'image/png', 'second.png', server.LOCAL_ID)
        preset = {'id':'mole', 'preset':'痣', 'x':43.5, 'y':10, 'size':5, 'turn':-40}
        first = {**preset, 'id':'one', 'preset':'自定义', 'src':a['url'], 'view':'full'}
        second = {**first, 'id':'two', 'src':b['url'], 'view':'half'}
        key = 'features.marks.items'
        def with_marks(items):
            return {'id':'char-multi-mark', 'name':'叠加贴图', 'images':[],
                    'styling':{'version':1, 'controls':{key:json.dumps(items, ensure_ascii=False)}}}
        def put(record):
            return self.api(route, 'PUT', {'id':record['id'], 'record':record})[0]
        role = with_marks([preset, first, second, {**first, 'id':'duplicate-image'}])
        self.assertEqual(put(role), 200)
        response = self.api('/api/preset-roles')[1]
        self.assertGreaterEqual(response['imageLineageVersion'], 2)
        saved = next(r for r in response['mine']['custom'] if r['id'] == role['id'])
        self.assertEqual(json.loads(saved['styling']['controls'][key]), json.loads(role['styling']['controls'][key]))
        self.assertEqual(server.role_storage_bytes(saved), len(b'first sticker')+len(b'second sticker'))
        for media in (a,b):
            self.assertIn('角色库', server.media_referenced_by(media['url'].split('/')[-1]))
        allowed = server.ACCOUNT_STORAGE.can_read
        def only_first(filename, user_id):
            return filename != b['url'].split('/')[-1] and allowed(filename, user_id)
        with patch.object(server.ACCOUNT_STORAGE, 'can_read', side_effect=only_first):
            self.assertEqual(put(role), 400)
            self.assertEqual(self.api('/api/preset-roles?scope=mine','PUT',{'custom':[role]})[0],400)
        for items in [[{**second, 'src':'https://example.invalid/sticker.png'}],
                      [{**second, 'src':'data:image/png;base64,YmFk'}], [first,first],
                      [{**second,'turn':361}], [{**second, 'x':-1}], [{**second,'view':'unknown'}]]:
            self.assertEqual(put(with_marks(items)), 400)
        self.assertEqual(put(with_marks([preset,second])), 200)
        self.assertNotIn('角色库', server.media_referenced_by(a['url'].split('/')[-1]))
        self.assertIn('角色库', server.media_referenced_by(b['url'].split('/')[-1]))
        self.assertEqual(self.api(route, 'PUT', {'id':role['id'], 'remove':True})[0], 200)
        self.assertNotIn('角色库', server.media_referenced_by(b['url'].split('/')[-1]))

    def test_role_record_and_bucket_compare_versions_for_preexisting_data(self):
        route = '/api/preset-roles/record?scope=mine'
        key = 'char-revision-legacy'
        record = {'id':key,'name':'历史角色','styling':{'version':1,'controls':{},'renderModelId':'local-test'}}
        result = self.api(route,'PUT',{'id':key,'record':record})[1]
        rev = result['recordRevisions'][key]
        old_bucket = result['revision']
        for suffix in ['A','B']:
            other = {**record,'id':key+suffix}
            self.assertEqual(self.api(route,'PUT',{'id':other['id'],'record':other,'expectedRevision':''})[0],200)
        def update(body):
            return self.api(route, 'PUT', {'id':key,'expectedRevision':rev,**body})
        ok, changed = update({'record':{**record,'name':'并发的改动'}})
        self.assertEqual(ok, 200)
        self.assertNotEqual(changed['recordRevisions'][key], rev)
        for body in [{'record':record},{'remove':True}]:
            code, response = update(body)
            self.assertEqual((code,response.get('error')), (409,'role_revision_conflict'))
        self.assertEqual(self.api('/api/preset-roles?scope=mine','PUT',{'custom':[record],'expectedRevision':old_bucket})[0],409)
        snapshot = self.api('/api/preset-roles')[1]['mine']
        current = next(r for r in snapshot['custom'] if r['id']==key)
        self.assertEqual(current['name'],'并发的改动')
        self.assertEqual(current['styling']['renderModelId'],'local-test')
        for item in [key,key+'A',key+'B']:
            self.assertEqual(self.api(route,'PUT',{'id':item,'remove':True,'expectedRevision':snapshot['recordRevisions'][item]})[0],200)

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

    def test_role_prompt_edits_persist_and_reset_only_selected_entries(self):
        path = '/api/dock-prompts'
        studio = 'roleStudio'
        skin, hair = 'field.face.skin.smooth', 'step.outfit.styling.hairstyle'
        camera = 'motion-01'
        store = Path(self.enterContext(tempfile.TemporaryDirectory())) / 'dock-prompts.json'
        self.enterContext(patch.object(server, 'DOCK_PROMPTS_FILE', store))
        self.enterContext(patch.object(server, '_DOCK_PROMPTS_CACHE', {'value': None}))
        _, packed = self.api('/role-studio-prompts.json')
        status, defaults = self.api(path)
        self.assertEqual(status, 200)
        self.assertTrue(defaults['canEdit'])
        self.assertEqual(set(defaults['prompts'][studio]), set(packed))
        self.assertEqual(defaults['prompts'][studio][skin], {**packed[skin], 'custom': False})
        self.assertEqual(self.api(path, 'PUT', {'prompts': {'camera': {camera: '运镜自定义'}}})[0], 200)

        def edit(changes):
            return self.api(path, 'PUT', {'partial': True, 'prompts': {studio: changes}})

        with ThreadPoolExecutor(max_workers=2) as editors:
            saves = editors.map(edit, ({skin: '面部编辑 {value}'}, {hair: '发型编辑 {value}'}))
            for status, saved in saves:
                self.assertEqual(status, 200)
                self.assertTrue(saved['partial'])
        server._DOCK_PROMPTS_CACHE['value'] = None
        merged = self.api(path)[1]['prompts']
        self.assertEqual(merged[studio][skin]['prompt'], '面部编辑 {value}')
        self.assertTrue(merged[studio][skin]['custom'])
        self.assertEqual(merged[studio][hair]['prompt'], '发型编辑 {value}')
        for invalid in ({skin: '不应被保留', 'unknown': '未注册'}, {skin: {'prompt': '错误类型'}}):
            self.assertEqual(edit(invalid)[0], 400)
        self.assertEqual(self.api(path, 'PUT', {
            'partial': True, 'prompts': {studio: {skin: ''}, 'camera': {}},
        })[0], 400)
        self.assertEqual(self.api(path)[1]['prompts'][studio][skin]['prompt'], '面部编辑 {value}')
        self.assertEqual(edit({skin: ''})[0], 200)
        cleared = self.api(path)[1]['prompts']
        self.assertEqual(cleared[studio][skin], {**packed[skin], 'custom': False})
        self.assertTrue(cleared[studio][hair]['custom'])
        self.assertEqual(json.loads(store.read_text(encoding='utf-8'))['prompts'], {
            'camera': {camera: '运镜自定义'}, studio: {hair: '发型编辑 {value}'},
        })
        self.assertEqual(self.api(path, 'PUT', {'prompts': {studio: {skin: '只保存新的一组'}}})[0], 200)
        full = self.api(path)[1]['prompts']
        self.assertFalse(full[studio][hair]['custom'])
        self.assertTrue(full[studio][skin]['custom'])
        self.assertEqual(self.api(path + '/reset', 'PUT', {'kind': studio})[0], 200)
        reset = self.api(path)[1]['prompts']
        self.assertFalse(reset[studio][skin]['custom'])
        self.assertEqual(reset['camera'][camera]['prompt'], '运镜自定义')

    def test_role_prompt_readers_cannot_edit_or_reset(self):
        path = '/api/dock-prompts'
        with patch.object(server.Handler, 'authenticated_user', return_value={'role': 'user', 'id': 'viewer'}):
            status, response = self.api(path)
            self.assertEqual(status, 200)
            self.assertFalse(response['canEdit'])
            self.assertIn('roleStudio', response['prompts'])
            self.assertEqual(self.api(path, 'PUT', {'prompts': {'roleStudio': {}}})[0], 403)
            self.assertEqual(self.api(path + '/reset', 'PUT', {'kind': 'roleStudio'})[0], 403)

    def test_node_text_and_media_prompts_round_trip_verbatim(self):
        title = '  ' + '長いタイトル' * 30 + '  '
        body = '  A\n\n一段\n '
        nodes = [{'id':'img', 'type':'image', 'title':title, 'copy':body, 'mediaPrompt':'  @素材 A\r\n鏡頭\n',
                  'mediaPromptMentions':[{'start':2,'end':7,'nodeId':'ref','type':'mixed','mediaType':'image','index':1}]},
                 {'id':'vid', 'type':'output', 'title':'動画', 'mediaPrompt':''},
                 {'id':'legacy', 'type':'output'}, {'id':'no-editor','type':'image','mediaPrompt':None}]
        _, created = self.api('/api/projects', 'POST', {'projectName':'Verbatim graph'})
        path = '/api/projects/' + created['project']['id']
        self.assertEqual(self.api(path, 'PUT', {**created['project'], 'nodes':nodes})[0], 200)
        saved = self.api(path)[1]['project']['nodes']
        for source, returned in zip(nodes, saved):
            self.assertEqual({key:returned[key] for key in source}, source)
        self.assertNotIn('mediaPrompt', saved[2])

    def test_conflict_copy_can_be_retried_and_saved_without_touching_original(self):
        _, created = self.api('/api/projects', 'POST', {'projectName': 'original', 'modelPrompt': 'server draft'})
        original = created['project']
        copy = {'restoreConflictCopy': True, 'id': 'project-recovery-1', 'projectId': original['id'],
                'modelPrompt': 'unsynced text', 'projectName': 'recoverable', 'shared': False}
        status, result = self.api('/api/projects', 'POST', copy)
        self.assertEqual(status, 201)
        restored = result['project']
        self.assertEqual(restored['id'], copy['id'])
        self.assertEqual(restored['modelPrompt'], 'unsynced text')
        path = '/api/projects/' + restored['id']
        self.assertEqual(self.api(path, 'PUT', {'revision': restored['revision'], 'modelPrompt': 'edited copy'})[0], 200)
        status, retry = self.api('/api/projects', 'POST', copy)
        self.assertEqual(status, 200)
        self.assertEqual(retry['project']['modelPrompt'], 'edited copy')
        self.assertEqual(self.api('/api/projects/' + original['id'])[1]['project']['modelPrompt'], 'server draft')

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

    def test_image_edit_sync_and_async_uploads_are_parsed_as_files(self):
        entry = {'model': 'gpt-image-2.6', 'baseUrl': 'https://fixture.invalid', 'apiKey': 'fixture-only',
                 'imageTransport': 'openai-images', 'referenceInputModes': ['data-url']}
        samples = [('image/png', b'\x89PNG\x00\xff\r\nfixture', '.png'),
                   ('image/jpeg', b'\xff\xd8\xffjpeg-fixture', '.jpg'),
                   ('image/webp', b'RIFF\x00WEBP-fixture', '.webp'),
                   ('image/gif', b'GIF89a\x00fixture', '.gif')]
        for generate in (server.call_image_generation, server.submit_image_generation):
            for selected in ([samples[0]], samples):
                with self.subTest(function=generate.__name__, count=len(selected)):
                    references = ['data:' + mime + ';base64,' + base64.b64encode(raw).decode()
                                  for mime, raw, _ in selected]
                    result = {'id': 'fixture-task', 'data': [{'b64_json': base64.b64encode(b'result').decode()}]}
                    with patch.object(server, 'upstream_contract', return_value={}), \
                         patch.object(server, 'request_body_candidates', return_value=(result, 'https://fixture.invalid/v1/images/edits', None)) as request, \
                         patch.object(server, 'request_json_candidates') as json_request:
                        _, error = generate(entry, '中文 reference prompt', size='1024x1536', reference_images=references, quality='high')
                    self.assertIsNone(error)
                    request.assert_called_once()
                    json_request.assert_not_called()
                    body = request.call_args.args[1]('https://fixture.invalid/v1/images/edits')
                    content_type = request.call_args.kwargs['headers']['Content-Type']
                    form = BytesParser(policy=policy.default).parsebytes(
                        ('Content-Type: ' + content_type + '\r\n\r\n').encode() + body)
                    self.assertEqual(form.defects, [])
                    parts = list(form.iter_parts())
                    files = [part for part in parts if part.get_filename() is not None]
                    self.assertEqual(len(files), len(selected), 'Reference bytes must be file parts, not ordinary text fields')
                    for index, (part, (mime, raw, extension)) in enumerate(zip(files, selected)):
                        self.assertEqual(part.get_param('name', header='content-disposition'), 'image' if len(selected) == 1 else 'image[]')
                        self.assertEqual(part.get_filename(), f'reference-{index + 1}{extension}')
                        self.assertEqual(part.get_content_type(), mime)
                        self.assertEqual(part.get_payload(decode=True), raw)
                    fields = {part.get_param('name', header='content-disposition'): part.get_payload(decode=True).decode()
                              for part in parts if part.get_filename() is None}
                    self.assertEqual(fields, {'model': entry['model'], 'prompt': '中文 reference prompt', 'size': '1024x1536', 'quality': 'high'})

    def test_image_reference_text_values_and_invalid_data_are_not_fake_files(self):
        references = ['https://fixture.invalid/reference.png', 'file-fixture-id']
        payload, body, content_type, error = server.build_image_reference_body(
            'multipart-files', 'gpt-image-2.6', 'fixture', '1024x1024', references)
        self.assertIsNone(error)
        self.assertIsNone(payload)
        form = BytesParser(policy=policy.default).parsebytes(
            ('Content-Type: ' + content_type + '\r\n\r\n').encode() + body)
        images = [part for part in form.iter_parts() if part.get_param('name', header='content-disposition') == 'image[]']
        self.assertEqual([part.get_payload(decode=True).decode() for part in images], references)
        self.assertTrue(all(part.get_filename() is None for part in images))
        for reference in ('data:image/png;base64,', 'data:image/png;base64,a'):
            with self.subTest(reference=reference):
                payload, body, content_type, error = server.build_image_reference_body(
                    'multipart-files', 'gpt-image-2.6', 'fixture', '1024x1024', [reference])
                self.assertIsNone(body)
                self.assertIn('参考图数据无效', error)

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

    def test_distant_canvas_layout_survives_save_and_reopen(self):
        layout = {'nodes': [{'id': 'left', 'type': 'prompt', 'left': -12450.5, 'top': 20500.25},
                            {'id': 'right', 'type': 'image', 'left': 31450, 'top': -14760}],
                  'groups': [{'id': 'group', 'x': 31400, 'y': -14800, 'w': 500, 'h': 400}],
                  'panX': -20101.625, 'panY': 12001.125, 'zoom': .25}
        status, created = self.api('/api/projects', 'POST', layout)
        self.assertEqual(status, 201, created)
        path = '/api/projects/' + created['project']['id']
        updated = {**layout, 'panX': 54321, 'panY': -45678, 'zoom': 8}
        for index, expected in enumerate([layout, updated]):
            if index:
                status, result = self.api(path, 'PUT', {**expected, 'revision': created['project']['revision']})
                self.assertEqual(status, 200, result)
            status, result = self.api(path)
            self.assertEqual(status, 200, result)
            project = result['project']
            for key in ('panX', 'panY', 'zoom'):
                self.assertEqual(project[key], expected[key])
            for node, source in zip(project['nodes'], expected['nodes'], strict=True):
                self.assertEqual((node['left'], node['top']), (source['left'], source['top']))
            self.assertEqual(project['groups'][0]['x'], 31400)

        invalid = server.clean_project({'nodes': [{'id': 'n', 'left': 'NaN', 'top': -12345}],
                                        'groups': [{'id': 'g', 'x': 'inf'}],
                                        'panX': '-Infinity', 'panY': 10 ** 400, 'zoom': 'NaN'})
        self.assertEqual((invalid['nodes'][0]['left'], invalid['nodes'][0]['top']), (0, -12345))
        self.assertEqual((invalid['groups'][0]['x'], invalid['panX'], invalid['panY'], invalid['zoom']), (0, 0, 0, 1))

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
