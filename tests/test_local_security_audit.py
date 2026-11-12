"""Live HTTP regressions for the single-machine edition. No paid upstream calls."""
import concurrent.futures
import http.client
import json
import socket
import unittest
from unittest.mock import patch
import test_security_audit as fixture


class LocalSecurityAuditTests(unittest.TestCase):
    project = fixture.SecurityAuditTests.project
    request = fixture.SecurityAuditTests.request
    @classmethod
    def setUpClass(cls): fixture.SecurityAuditTests.setUpClass.__func__(cls)
    @classmethod
    def tearDownClass(cls): fixture.SecurityAuditTests.tearDownClass.__func__(cls)
    def setUp(self): fixture.SecurityAuditTests.setUp(self)

    test_bad_or_stale_revision_never_overwrites_project = fixture.SecurityAuditTests.test_bad_or_stale_revision_never_overwrites_project
    test_malformed_json_does_not_modify_saved_project = fixture.SecurityAuditTests.test_malformed_json_does_not_modify_saved_project
    test_corrupt_storage_fails_closed_without_overwriting = fixture.SecurityAuditTests.test_corrupt_storage_fails_closed_without_overwriting
    test_cross_origin_write_and_rebinding_host_are_denied = fixture.SecurityAuditTests.test_cross_origin_write_and_rebinding_host_are_denied

    def test_cross_origin_reads_cannot_reach_local_data_or_proxy(self):
        for method in ('GET','HEAD','OPTIONS','POST','PUT','DELETE'):
            for headers in ({'Origin':'https://untrusted.invalid'}, {'Sec-Fetch-Site':'cross-site'},
                            {'Origin':f'https://127.0.0.1:{self.http.server_port}'},
                            {'Origin':f'http://127.0.0.1:{self.http.server_port+1}'}, {'Origin':'null'}):
                with self.subTest(method=method,headers=headers):
                    self.assertEqual(self.request(method,'/api/projects',headers=headers)[0],403)
        status, _, headers = self.request('GET','/api/projects',headers={'Origin':f'http://127.0.0.1:{self.http.server_port}'})
        self.assertEqual(status,200)
        self.assertEqual(headers['Cross-Origin-Resource-Policy'],'same-origin')
        self.assertEqual(headers['X-Frame-Options'],'SAMEORIGIN')

    def test_removed_share_routes_cannot_be_reenabled(self):
        for path in ('/api/assets/a/share','/api/previs/assets/a/share','/api/agent/share','/api/share/a',
                     '/api/community','/api/admin/users','/api/credits','/api/storage/delete'):
            for method in ('GET','POST','PUT','DELETE'):
                with self.subTest(path=path,method=method):self.assertEqual(self.request(method,path,{})[0],404)
        for path in ('/%2fshare.html','/assets/../share.html','/%2fsupport.js',
                     '/assets/../notifications.js','/api/assets/a/../a/share'):
            self.assertEqual(self.request('GET',path)[0],404,path)

    def test_private_source_and_encoded_paths_are_not_served(self):
        for path in ('/server.py','/server-data/auth.db','/.runtime/blender/download-source.json',
                     '/%73erver.py','/vendor/../server.py','/tests/test_local_app.py','/preview/full-audit-20261019/source-inventory.json',
                     '/.local-app-backup/full-audit-20261019/app.js','/tools/release/package-lock.json'):
            with self.subTest(path=path):self.assertEqual(self.request('GET',path)[0],404)
        for path in ('/','/app.js','/assets3d/index.json','/vendor/three/three.module.js'):
            self.assertEqual(self.request('GET',path)[0],200,path)

    def test_head_ranges_and_error_responses_are_framed(self):
        media='media-'+'a'*32+'.mp4'; (self.app.MEDIA_DIR/media).write_bytes(b'0123456789')
        for path in ('/api/health','/','/media/'+media,'/version.json','/missing.json'):
            status,body,headers=self.request('HEAD',path)
            self.assertIn(status,(200,404));self.assertEqual(body,b'',path)
            self.assertGreater(int(headers['Content-Length']),0)
        self.assertEqual(self.request('GET','/media/'+media,headers={'Range':'bytes=2-5'})[:2],(206,b'2345'))
        self.assertEqual(self.request('GET','/media/'+media,headers={'Range':'bytes=-3'})[:2],(206,b'789'))
        for value in ('bytes=-0','bytes=10-','bytes=9-2','bytes=abc-def','bytes='+'9'*100+'-'):
            self.assertEqual(self.request('GET','/media/'+media,headers={'Range':value})[0],416)

    def test_no_balance_gate_on_chat_with_an_empty_local_wallet(self):
        self.app.write_ai_models([{'id':'mock','name':'Mock','type':'i2t','model':'mock','enabled':True,
            'apiKey':'fake-local-test-only','baseUrl':'http://mock.invalid'}])
        with patch.object(self.app,'agent_chat_stream',return_value=iter([('text','Local dialogue works')])) as upstream:
            status,raw,_=self.request('POST','/api/agent/chat',{'message':'hello','modelId':'mock'})
        self.assertEqual(status,200);upstream.assert_called_once()
        events=[json.loads(line[6:]) for line in raw.decode().splitlines() if line.startswith('data: ')]
        self.assertEqual(events[-1]['type'],'done')
        with self.app.auth_db() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM generation_settlements').fetchone()[0],0)

    def test_invalid_blender_source_is_a_client_error(self):
        for value in (1,True,['wrong'],{'wrong':'id'}):
            status,_,_=self.request('POST','/api/blender/jobs',{'sourceJobId':value,
                'operations':[{'op':'create','id':'cube','shape':'box'}]})
            self.assertEqual(status,400)

    def test_blender_download_head_has_no_body_and_get_is_complete(self):
        file=self.app.DATA_DIR/'test-model.blend';file.write_bytes(b'fixture'*300000)
        workspace=self.app.default_workspace_id(self.app.LOCAL_ID)
        with patch.object(self.app.BLENDER_BRIDGE,'artifact',return_value=file):
            path='/api/blender/jobs/blend-'+'a'*32+'/download?format=blend&workspace='+workspace
            with socket.create_connection(('127.0.0.1',self.http.server_port),timeout=5) as raw:
                raw.sendall(f'HEAD {path} HTTP/1.0\r\nHost: 127.0.0.1:{self.http.server_port}\r\n\r\n'.encode())
                chunks=[]
                while chunk:=raw.recv(65536):chunks.append(chunk)
            headers,body=b''.join(chunks).split(b'\r\n\r\n',1)
            self.assertIn(b'200 OK',headers);self.assertEqual(body,b'')
            status,body,_=self.request('GET',path)
            self.assertEqual(status,200);self.assertEqual(body,file.read_bytes())

    def test_provider_origin_changes_require_a_new_credential(self):
        status,result,_=self.request('POST','/api/admin/ai-providers',{
            'provider':'Fixture','baseUrl':'http://127.0.0.1:9999','apiKey':'fake-provider-secret'})
        self.assertEqual(status,201);id=result['provider']['id']
        before=self.app.AI_PROVIDERS_FILE.read_bytes()
        status,result,_=self.request('PUT','/api/admin/ai-providers/'+id,{'baseUrl':'http://127.0.0.1:9998'})
        self.assertEqual(status,400);self.assertEqual(result['error'],'network_access_denied')
        self.assertEqual(before,self.app.AI_PROVIDERS_FILE.read_bytes())
        self.assertEqual(self.request('PUT','/api/admin/ai-providers/'+id,{
            'baseUrl':'http://127.0.0.1:9998','apiKey':'fake-new-provider-secret'})[0],200)

    def test_nested_model_enums_are_client_errors_and_ids_are_stable(self):
        for key in ('id','type','billing','protocol','authMode','textProtocol','providerProfile','imageTaskMode','requestProfile'):
            for value in (['bad'],{'bad':1}):
                with self.subTest(key=key,value=value):
                    status,_,_=self.request('POST','/api/admin/ai-models',{'name':'Fixture','model':'fixture',
                        'baseUrl':'http://127.0.0.1:9999',key:value})
                    self.assertEqual(status,400)
        self.app.write_ai_models([{'id':'original','name':'Fixture','model':'fixture','type':'i2t',
            'baseUrl':'http://127.0.0.1:9999','enabled':False}])
        status,result,_=self.request('PUT','/api/admin/ai-models/original',{'id':'replacement','name':'Renamed'})
        self.assertEqual(status,200);self.assertEqual(result['model']['id'],'original')

    def test_old_history_jobs_remain_addressable_after_two_hundred_new_jobs(self):
        jobs=[{'id':str(i),'userId':self.app.LOCAL_ID,'workspaceId':self.app.default_workspace_id(self.app.LOCAL_ID),
            'kind':'image','status':'completed','createdAt':f'{i:04d}','imageUrl':'https://example.invalid/test.png'} for i in range(210)]
        self.app.JOBS_FILE.write_text('\n'.join(map(json.dumps,jobs))+'\n',encoding='utf-8')
        status,result,_=self.request('GET','/api/jobs/0')
        self.assertEqual(status,200);self.assertEqual(result['job']['id'],'0')

    def test_invalid_spec_shapes_do_not_clear_existing_configuration(self):
        before=self.app.MODEL_SPECS_FILE.read_bytes() if self.app.MODEL_SPECS_FILE.exists() else None
        for kind in ('audio','video','image','camera'):
            for value in (1,[],{'bad':1}):
                status,_,_=self.request('PUT','/api/admin/model-specs',{'kind':kind,'data':value})
                self.assertEqual(status,400)
        after=self.app.MODEL_SPECS_FILE.read_bytes() if self.app.MODEL_SPECS_FILE.exists() else None
        self.assertEqual(before,after)

    def test_nested_project_shapes_are_rejected_without_overwriting(self):
        original=self.app.PROJECTS_FILE.read_bytes()
        for data in ({'nodes':2},{'nodes':{}},{'edges':2},{'edges':{}},
                     {'nodes':[{'id':'x','type':'storyboard','cells':3}]},
                     {'nodes':[{'id':'x','type':'storyboard','cells':{'x':1}}]}):
            with self.subTest(data=data):
                status,_,_=self.request('PUT','/api/projects/p',{'revision':1,**data})
                self.assertEqual(status,400)
                self.assertEqual(original,self.app.PROJECTS_FILE.read_bytes())

    def test_concurrent_edits_have_one_winner_and_preserve_a_valid_file(self):
        def edit(index):return self.request('PUT','/api/projects/p',{'revision':1,'projectName':str(index)})[0]
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:codes=list(pool.map(edit,range(8)))
        self.assertEqual(codes.count(200),1);self.assertEqual(codes.count(409),7)
        self.assertEqual(next(p for p in self.app.read_projects() if p['id']=='p')['revision'],2)

    def test_project_rich_text_strips_executable_markup_and_preserves_editor_format(self):
        payloads=['<script>window.evil=1</script>','<img src=x onerror="alert(1)">',
            '<svg><a href="javascript:alert(1)">bad</a></svg>',
            '<math><mtext><img src=x onerror=alert(1)></mtext></math>',
            '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
            '<object data="data:text/html,test"></object>',
            '<form><input name=innerHTML></form>',
            '<span onclick="alert(1)" style="background:url(javascript:alert(1))">safe</span>',
            '<span style="color:expression(alert(1))">safe</span>']
        for raw in payloads:
            status,result,_=self.request('POST','/api/projects',{'nodes':[{'id':'text','type':'prompt','copyHtml':raw}]})
            self.assertEqual(status,201)
            cleaned=result['project']['nodes'][0].get('copyHtml','')
            for forbidden in ('<script','<img','<svg','<math','<iframe','<object','<form','<input','onclick=','onerror=','javascript:','expression('):
                self.assertNotIn(forbidden,cleaned.lower(),raw)
        safe='<p style="text-align: center"><strong>标题</strong><em>内容</em></p>'
        status,result,_=self.request('POST','/api/projects',{'nodes':[{'id':'text','type':'prompt','copyHtml':safe}]})
        self.assertEqual(status,201);self.assertIn('<strong>标题</strong>',result['project']['nodes'][0]['copyHtml'])

    def test_workspaces_isolate_writes_materials_and_agent_history(self):
        status,result,_=self.request('POST','/api/workspaces',{'name':'Isolated audit space'})
        self.assertEqual(status,201);workspace=result['workspace']['id'];headers={'X-Workspace-Id':workspace}
        status,result,_=self.request('POST','/api/projects',{'projectName':'Other space'},headers=headers)
        self.assertEqual(status,201);id=result['project']['id']
        status,result,_=self.request('GET','/api/projects')
        self.assertNotIn(id,{p['id'] for p in result['projects']})
        self.assertEqual(self.request('PUT','/api/projects/'+id,{'projectName':'Wrong space'})[0],403)
        self.assertEqual(self.request('DELETE','/api/projects/'+id)[0],403)
        self.assertEqual(self.request('PUT','/api/projects/'+id,{'projectName':'Saved'},headers=headers)[0],200)
        self.assertEqual(self.request('POST','/api/agent/chat',{'message':'hello','canvas':{'projectId':id}})[0],404)


if __name__=='__main__':unittest.main()
