"""Film integration boundaries. Temporary local data; never call AI services."""
import base64
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from film_workbench import FilmWorkbench, FilmUnavailable
import test_security_audit as fixture


class FilmRoutesTests(unittest.TestCase):
    project = fixture.SecurityAuditTests.project
    def request(self, method, path, data=None, **kwargs):
        if isinstance(data, dict) and path.startswith('/api/film/'):
            data = {'projectId':'p', **data}
        return fixture.SecurityAuditTests.request(self, method, path, data, **kwargs)

    @classmethod
    def setUpClass(cls): fixture.SecurityAuditTests.setUpClass.__func__(cls)

    @classmethod
    def tearDownClass(cls):
        cls.app.FILM_WORKBENCH.close()
        fixture.SecurityAuditTests.tearDownClass.__func__(cls)

    def setUp(self): fixture.SecurityAuditTests.setUp(self)

    def test_output_retries_deduplicate_but_replaced_file_creates_a_new_asset(self):
        with tempfile.TemporaryDirectory() as directory:
            output=Path(directory)/'frame.png';output.write_bytes(b'first')
            with patch.object(self.app.FILM_WORKBENCH,'call',return_value={'file':str(output)}), patch.object(self.app,'save_media_blob',return_value={'kind':'image','mediaId':'fixture','url':'/media/fixture.png','size':5}) as saved:
                first=self.app.publish_film_output(self.app.LOCAL_CONTEXT,'workspace-a','film','Title',{'token':'opaque','addToCanvas':True})
                second=self.app.publish_film_output(self.app.LOCAL_CONTEXT,'workspace-a','film','Title',{'token':'opaque'})
                self.assertEqual(first['assetId'],second['assetId']);self.assertEqual(saved.call_count,1)
                self.assertEqual(first['_effects'][0]['assetId'],first['assetId'])
                self.assertEqual(first['_effects'][0]['image'],'/media/fixture.png')
                output.write_bytes(b'second')
                third=self.app.publish_film_output(self.app.LOCAL_CONTEXT,'workspace-a','film','Title',{'token':'opaque'})
                self.assertNotEqual(first['assetId'],third['assetId']);self.assertEqual(saved.call_count,2)

    def test_long_storyboard_text_returns_as_full_text_without_uploading_a_media_file(self):
        text='完整正文'*9000
        def worker(workspace,op,**payload):
            if payload['args']['action']=='canvas_read':return {'canvas':{'nodes':[{'id':'native','path':'assets/full.txt'}],'edges':[]},'links':{'native':'original'}}
            self.assertEqual(payload['args'],{'action':'read','path':'assets/full.txt'})
            return {'text':text}
        with patch.object(self.app.FILM_WORKBENCH,'call',side_effect=worker),patch.object(self.app,'publish_film_output') as publish:
            result=self.app.sync_film_canvas({'id':'alice'},'workspace-a','film','Title',{'direction':'from-film','graph':{'nodes':[{'id':'original'}]}})
        self.assertEqual(result['_effects'][0]['copy'],text)
        self.assertEqual(result['_effects'][0]['op'],'update_node');publish.assert_not_called()

    def test_unknown_workspace_and_project_never_launch_editor(self):
        with patch.object(self.app.FILM_WORKBENCH, 'call') as call:
            self.assertEqual(self.request('POST', '/api/film/open', {}, headers={'X-Workspace-Id':'missing'})[0], 404)
            self.assertEqual(self.request('POST', '/api/film/open', {'projectId':'missing'})[0], 404)
            call.assert_not_called()

    def test_empty_drafts_are_isolated_and_keep_their_key_after_first_node(self):
        before = self.app.read_projects()
        with patch.object(self.app.FILM_WORKBENCH, 'call', return_value={'projectId':'film-one'}) as call:
            first='project-11111111-1111-4111-8111-111111111111'
            second='project-22222222-2222-4222-8222-222222222222'
            for key in (first,second):
                self.assertEqual(self.request('POST','/api/film/open',{'projectId':key,'draft':True})[0],200)
                self.assertEqual(call.call_args.kwargs['projectKey'],key)
            self.assertEqual(before,self.app.read_projects())
            user=self.app.LOCAL_CONTEXT
            self.app.write_file(self.app.PROJECTS_FILE,[*before,dict(id=first,ownerId=user['id'],workspaceId=self.app.default_workspace_id(user['id']),projectName='Named')])
            self.assertEqual(self.request('POST','/api/film/open',{'projectId':first})[0],200)
            self.assertEqual(call.call_args.kwargs['projectKey'],first)
            self.app.write_file(self.app.PROJECTS_FILE,before)
        self.assertEqual(before, self.app.read_projects())

    def test_invalid_selection_never_launches_editor(self):
        with patch.object(self.app.FILM_WORKBENCH, 'call') as call:
            for ids in (None, [], ['x']*51, [3], {'x':1}):
                self.assertEqual(self.request('POST', '/api/film/import', {'materialIds':ids})[0], 400)
            call.assert_not_called()

    def test_catalog_scope_and_remote_files_are_not_bypassed(self):
        with patch.object(self.app, 'build_catalog', return_value=[{'id':'remote','kind':'video','url':'http://127.0.0.1:22/private'}]), patch.object(self.app.FILM_WORKBENCH, 'call') as call:
            for ids in (['missing'], ['remote']):
                self.assertEqual(self.request('POST', '/api/film/import', {'materialIds':ids})[0], 400)
            call.assert_not_called()

    def test_other_project_materials_cannot_be_imported_even_in_same_workspace(self):
        source='data:image/png;base64,'+base64.b64encode(b'fixture').decode()
        rows=[{'id':'own','kind':'image','url':source,'projects':[{'id':'p'}]},
              {'id':'other','kind':'image','url':source,'projects':[{'id':'q'}]},
              {'id':'unassigned','kind':'image','url':source,'projects':[]}]
        with patch.object(self.app,'build_catalog',return_value=rows),patch.object(self.app.FILM_WORKBENCH,'call') as worker:
            for ids in (['other'],['unassigned'],['own','other']):
                status,body,_=self.request('POST','/api/film/import',{'materialIds':ids})
                self.assertEqual(status,400)
                self.assertIn('当前画布',body['message'])
            worker.assert_not_called()

    def test_no_shared_fallback_and_invalid_draft_never_launches_editor(self):
        with patch.object(self.app.FILM_WORKBENCH,'call') as worker:
            for body in ({'projectId':''},{'projectId':'missing','draft':True}):
                self.assertEqual(self.request('POST','/api/film/open',body)[0],404)
            worker.assert_not_called()

    def test_local_file_is_streamed_with_safe_name_and_selection_is_deduplicated(self):
        media = self.app.MEDIA_DIR / ('media-' + 'a'*32 + '.mp4')
        media.write_bytes(b'test-media')
        row = {'projects':[{'id':'p'}],'id':'clip', 'kind':'video', 'name':'../a/b', 'url':'/media/'+media.name}
        def imported(workspace, operation, **payload):
            self.assertEqual(operation, 'import')
            self.assertEqual(len(payload['files']), 1)
            self.assertEqual(Path(payload['files'][0]['path']).read_bytes(), b'test-media')
            self.assertNotIn('/', payload['files'][0]['name'])
            return {'imported':1}
        with patch.object(self.app, 'build_catalog', return_value=[row]), patch.object(self.app.FILM_WORKBENCH, 'call', side_effect=imported):
            status, data, _ = self.request('POST', '/api/film/import', {'materialIds':['clip','clip']})
        self.assertEqual(status, 200)
        self.assertEqual(data['imported'], 1)
        self.assertTrue(media.exists())

    def test_inline_file_lives_until_import_completes_then_is_removed(self):
        row = {'projects':[{'id':'p'}],'id':'pic','kind':'image','name':'pic','url':'data:image/png;base64,'+base64.b64encode(b'png-fixture').decode()}
        seen = []
        def imported(workspace, operation, **payload):
            seen.append(Path(payload['files'][0]['path']))
            self.assertEqual(seen[0].read_bytes(), b'png-fixture')
            return {'imported':1}
        with patch.object(self.app, 'build_catalog', return_value=[row]), patch.object(self.app.FILM_WORKBENCH, 'call', side_effect=imported):
            self.assertEqual(self.request('POST', '/api/film/import', {'materialIds':['pic']})[0], 200)
        self.assertFalse(seen[0].exists())

    def test_malformed_inline_file_does_not_reach_editor(self):
        row = {'projects':[{'id':'p'}],'id':'pic','kind':'image','url':'data:image/png;base64,!!!'}
        with patch.object(self.app, 'build_catalog', return_value=[row]), patch.object(self.app.FILM_WORKBENCH, 'call') as call:
            self.assertEqual(self.request('POST', '/api/film/import', {'materialIds':['pic']})[0], 400)
            call.assert_not_called()

    def test_unavailable_editor_has_recoverable_error(self):
        with patch.object(self.app.FILM_WORKBENCH, 'call', side_effect=FilmUnavailable('component unavailable')):
            status, data, _ = self.request('POST', '/api/film/open', {})
        self.assertEqual(status, 503)
        self.assertEqual(data['error'], 'film_unavailable')

    def test_cross_origin_requests_are_refused(self):
        with patch.object(self.app.FILM_WORKBENCH, 'call') as call:
            for route in ('/api/film/open','/api/film/import'):
                self.assertEqual(self.request('POST', route, {}, headers={'Origin':'https://untrusted.invalid'})[0], 403)
            call.assert_not_called()


class FilmRuntimeTests(unittest.TestCase):
    def test_missing_runtime_has_clear_error_and_no_process(self):
        with tempfile.TemporaryDirectory() as directory:
            manager = FilmWorkbench(directory, directory)
            try:
                with self.assertRaises(FilmUnavailable): manager.call('workspace', 'open', projectKey='p')
                self.assertEqual(manager.workers, {})
            finally: manager.close()

    def test_arbitrary_operations_are_refused_before_start(self):
        with tempfile.TemporaryDirectory() as directory:
            manager = FilmWorkbench(directory, directory)
            try:
                with patch.object(manager, '_start') as start:
                    with self.assertRaises(ValueError): manager.call('workspace', 'exec', command='not allowed')
                    start.assert_not_called()
            finally: manager.close()


if __name__ == '__main__': unittest.main()
