"""Exercise production HTTP routes with isolated data, accounts and credit ledger."""
import base64
import concurrent.futures
import copy
import http.client
import importlib.util
import io
import json
import os
from pathlib import Path
import sqlite3
import tempfile
import threading
import unittest
from request_security import StorageReadError, byte_range, public_static_path, request_allowed

ROOT = Path(__file__).resolve().parents[1]


class SecurityAuditTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        previous = os.environ.get('CANVASFLOW_DATA_DIR')
        os.environ['CANVASFLOW_DATA_DIR'] = cls.temp.name
        try:
            spec = importlib.util.spec_from_file_location('isolated_security_server', ROOT / 'server.py')
            cls.app = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(cls.app)
        finally:
            if previous is None: os.environ.pop('CANVASFLOW_DATA_DIR', None)
            else: os.environ['CANVASFLOW_DATA_DIR'] = previous
        cls.tokens = {}
        stamp = cls.app.auth_iso()
        with cls.app.auth_db() as db:
            for user, role in [('alice', 'admin'), ('bob', 'user')]:
                db.execute('INSERT INTO users (id,nickname,avatar,status,role,created_at,updated_at) VALUES (?,?,?,?,?,?,?)',
                           (user, user.title(), user[0], 'active', role, stamp, stamp))
                cls.tokens[user] = cls.app.create_session(db, user, cls.app.auth_now())
        class QuietHandler(cls.app.Handler):
            def log_message(self, *args): pass
        cls.http = cls.app.ThreadingHTTPServer(('127.0.0.1', 0), QuietHandler)
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown(); cls.http.server_close(); cls.thread.join()
        cls.temp.cleanup()

    def setUp(self):
        self.app.write_file(self.app.PROJECTS_FILE, [self.project('p', 'alice'), self.project('q', 'bob')])
        for file in (self.app.ASSETS_FILE, self.app.MUSIC_FILE, self.app.MODELS_FILE,
                     self.app.PREVIS_ASSETS.file, self.app.AGENT_SESSIONS_FILE, self.app.AGENT_SHARES_FILE):
            self.app.write_file(file, [])
        self.app.write_file(self.app.PREVIS_ASSETS.favorites_file, {})
        self.app.JOBS_FILE.write_text('', encoding='utf-8')
        with self.app.auth_db() as db:
            db.execute('DELETE FROM account_storage_limits')
            db.execute("UPDATE users SET role='user' WHERE id='bob'")
            db.execute('DELETE FROM generation_settlements')
            db.execute('DELETE FROM credit_ledger')
            self.app.credit_ledger_insert(db, 'alice', 1000, 'isolated fixture')

    def project(self, id, user):
        return dict(id=id, ownerId=user, ownerName=user.title(), ownerAvatar=user[0],
                    workspaceId=self.app.default_workspace_id(user), projectName=id, nodes=[], edges=[], revision=1, shared=False)

    def request(self, method, path, data=None, user='alice', headers=None, raw=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.http.server_port, timeout=5)
        all_headers = dict(headers or {})
        if user: all_headers['Cookie'] = f'{self.app.SESSION_COOKIE}={self.tokens[user]}'
        if data is not None:
            raw = json.dumps(data).encode(); all_headers['Content-Type'] = 'application/json'
        try:
            connection.request(method, path, body=raw, headers=all_headers)
            response = connection.getresponse(); body = response.read(); status = response.status
            result = json.loads(body) if body and response.getheader('Content-Type', '').startswith('application/json') else body
            return status, result, dict(response.getheaders())
        finally: connection.close()

    @unittest.skip("Retired platform account/share/quota/billing behavior; local HTTP coverage: test_local_security_audit.py")
    def test_private_asset_and_private_music_cannot_leak(self):
        self.app.write_file(self.app.ASSETS_FILE, [dict(id='a', ownerId='alice', shared=False, kind='image', data='private')])
        self.assertEqual(self.request('GET', '/api/assets/a', user='bob')[0], 403)
        self.assertEqual(self.request('GET', '/api/assets/a')[1]['asset']['data'], 'private')
        self.app.write_file(self.app.MUSIC_FILE, [dict(id='private-m', ownerId='alice', shared=False), dict(id='public-m', ownerId='alice', shared=True)])
        self.assertEqual([m['id'] for m in self.request('GET', '/api/community', user='bob')[1]['music']], ['public-m'])
        self.assertEqual(self.request('PUT', '/api/music/private-m', {'action':'like'}, user='bob')[0], 403)

    @unittest.skip("Retired platform account/share/quota/billing behavior; local HTTP coverage: test_local_security_audit.py")
    def test_asset_share_toggle_exists_and_is_owner_only(self):
        self.app.write_file(self.app.ASSETS_FILE, [dict(id='a', ownerId='alice', shared=True)])
        self.assertEqual(self.request('POST', '/api/assets/a/share', {'shared':False}, user='bob')[0], 403)
        self.assertEqual(self.request('POST', '/api/assets/a/share', {'shared':'false'})[0], 400)
        self.assertFalse(self.request('POST', '/api/assets/a/share', {'shared':False})[1]['asset']['shared'])
        self.assertTrue(self.request('POST', '/api/assets/a/share', {'shared':True})[1]['asset']['shared'])

    @unittest.skip("Retired platform account/share/quota/billing behavior; local HTTP coverage: test_local_security_audit.py")
    def test_project_owner_cannot_be_reassigned(self):
        status, body, _ = self.request('PUT', '/api/projects/p', {'ownerId':'bob', 'ownerName':'forged', 'ownerAvatar':'X', 'revision':1})
        self.assertEqual(status, 200)
        self.assertEqual((body['project']['ownerId'], body['project']['ownerName']), ('alice', 'Alice'))
        self.assertEqual(self.request('PUT', '/api/projects/p', {'projectName':'attack'}, user='bob')[0], 403)
        self.assertEqual(self.request('DELETE', '/api/projects/p', user='bob')[0], 403)

    @unittest.skip("Retired platform account/share/quota/billing behavior; local HTTP coverage: test_local_security_audit.py")
    def test_forged_workspace_does_not_grant_project_write_access(self):
        rows = self.app.read_projects(); rows[1]['workspaceId'] = self.app.default_workspace_id('alice')
        self.app.write_file(self.app.PROJECTS_FILE, rows)
        self.assertEqual(self.request('PUT', '/api/projects/q', {'projectName':'attack'})[0], 403)
        self.assertEqual(self.request('DELETE', '/api/projects/q')[0], 403)

    def test_bad_or_stale_revision_never_overwrites_project(self):
        for value in ('bad', True, 1.9):
            self.assertEqual(self.request('PUT', '/api/projects/p', {'revision':value, 'projectName':'wrong'})[0], 400)
        self.assertEqual(self.request('PUT', '/api/projects/p', {'revision':0})[0], 409)
        self.assertEqual(self.app.read_projects()[0]['projectName'], 'p')

    def test_malformed_json_does_not_modify_saved_project(self):
        before = self.app.PROJECTS_FILE.read_bytes()
        for raw in (b'{broken', b'[]', b'null', b'{"zoom":NaN}',b'{"zoom":1e999}',b'{"x":'+b'['*100+b'0'+b']'*100+b'}',b'{"x":'+b'['*1100+b'0'+b']'*1100+b'}'):
            self.assertEqual(self.request('PUT', '/api/projects/p', raw=raw)[0], 400)
            self.assertEqual(self.app.PROJECTS_FILE.read_bytes(), before)

    def test_excessive_body_is_rejected_before_reading(self):
        self.assertEqual(self.request('PUT', '/api/projects/p', headers={'Content-Length':'9000000'}, raw=b'')[0], 413)
        self.assertEqual(self.request('POST', '/api/projects', headers={'Content-Length':'9000000'}, raw=b'')[0], 413)

    def test_cross_origin_write_and_rebinding_host_are_denied(self):
        self.assertEqual(self.request('PUT', '/api/projects/p', {'projectName':'evil'}, headers={'Origin':'https://evil.example'})[0], 403)
        self.assertEqual(self.request('POST', '/api/auth/logout', headers={'Sec-Fetch-Site':'cross-site'})[0], 403)
        self.assertEqual(self.request('GET', '/api/health', headers={'Host':f'evil.example:{self.http.server_port}'})[0], 403)
        self.assertEqual(self.request('GET', '/api/health')[0], 200)
        self.assertEqual(self.request('PUT', '/api/projects/p', {'projectName':'same origin'}, headers={'Origin':f'http://127.0.0.1:{self.http.server_port}'})[0], 200)

    def test_static_private_files_and_encoded_paths_are_blocked(self):
        for path in ('/server.py', '/_test_session.txt', '/server-data/auth.db', '/preview/forest-scene-20261013/saved-scene.json',
                     '/%73erver.py', '/vendor/../server.py', '/.venv/pyvenv.cfg', '/tests/test_auth_status.py'):
            self.assertEqual(self.request('GET', path, user=None)[0], 404, path)
        for path in ('/', '/app.js', '/assets3d/index.json', '/assets3d/forest-building-plans.json', '/vendor/three/three.module.js'):
            self.assertEqual(self.request('GET', path, user=None)[0], 200, path)
        self.assertEqual(self.request('GET', '/learn/assets/untrusted.py', user=None)[0], 404)

    def test_head_and_range_responses_have_correct_lengths(self):
        media = 'media-'+'a'*32+'.mp4'; (self.app.MEDIA_DIR/media).write_bytes(b'0123456789')
        for path in ('/api/health', '/', '/media/'+media):
            status, body, headers = self.request('HEAD', path, user='alice' if path.startswith('/media/') else None)
            self.assertEqual(status, 200, path); self.assertEqual(body, b'')
            self.assertGreater(int(headers['Content-Length']), 0)
        self.assertEqual(self.request('GET', '/media/'+media, headers={'Range':'bytes=2-5'})[:2], (206, b'2345'))
        self.assertEqual(self.request('GET', '/media/'+media, headers={'Range':'bytes=-3'})[:2], (206, b'789'))
        for header in ('bytes=-0', 'bytes=-1-4', 'bytes=9-2', 'bytes=10-', 'bytes=abc-def'):
            self.assertEqual(self.request('GET', '/media/'+media, headers={'Range':header})[0], 416, header)

    @unittest.skip("Retired platform account/share/quota/billing behavior; local HTTP coverage: test_local_security_audit.py")
    def test_only_admin_can_delete_raw_media(self):
        name = 'media-'+'b'*32+'.png'; (self.app.MEDIA_DIR/name).write_bytes(b'fixture')
        self.assertEqual(self.request('DELETE', '/api/media/'+name, user='bob')[0], 403)
        self.assertTrue((self.app.MEDIA_DIR/name).exists())

    def test_media_gc_preserves_nested_covers_audio_models_and_snapshots(self):
        media='media-'+'c'*32+'.png'; url='/media/'+media
        for row in ({'thumbnail':url}, {'cover':url}, {'data':url}, {'nodes':[{'audioUrl':url}]},
                    {'nodes':[{'directorProject':json.dumps({'objects':[{'materials':[{'map':url}]}]})}]}):
            self.assertTrue(self.app.media_referenced_by(media, [row], []), row)
        self.app.write_file(self.app.AGENT_SHARES_FILE, [dict(id='s', canvas={'nodes':[{'image':url}]})])
        self.assertTrue(self.app.media_referenced_by(media, [], []))
        self.app.write_file(self.app.AGENT_SHARES_FILE, [])
        self.app.JOBS_FILE.write_text(json.dumps({'id':'job','audioUrl':url})+'\n')
        self.assertTrue(self.app.media_referenced_by(media, [], []))
        self.app.JOBS_FILE.write_text('')
        self.assertFalse(self.app.media_referenced_by(media, [{'cover':url+'2'}], []))

    def test_recent_uploads_survive_gc_before_asset_save(self):
        name='media-'+'d'*32+'.png'; file=self.app.MEDIA_DIR/name; file.write_bytes(b'upload')
        self.assertEqual(self.request('POST', '/api/media/gc')[0], 200)
        self.assertTrue(file.exists())
        os.utime(file, (1, 1)); self.request('POST', '/api/media/gc')
        self.assertTrue(file.exists())
        with self.app.auth_db() as db:db.execute('UPDATE media_storage SET expires_at=0 WHERE media_id=?',(name,))
        self.request('POST', '/api/media/gc')
        self.assertFalse(file.exists())

    def test_corrupt_storage_fails_closed_without_overwriting(self):
        broken=b'{not valid'; self.app.PROJECTS_FILE.write_bytes(broken)
        self.assertEqual(self.request('PUT', '/api/projects/p', {'projectName':'overwrite'})[0], 503)
        self.assertEqual(self.app.PROJECTS_FILE.read_bytes(), broken)
        self.assertEqual(self.app.PROJECTS_FILE.with_suffix('.json.corrupt').read_bytes(), broken)

    def test_atomic_writers_never_share_temporary_files(self):
        file=self.app.DATA_DIR/'atomic.json'
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            list(pool.map(lambda i:self.app.write_file(file, {'value':i}), range(40)))
        self.assertIn(json.loads(file.read_text())['value'], range(40))
        self.assertFalse(list(self.app.DATA_DIR.glob('atomic.json.*.tmp')))

    def test_database_connections_commit_and_close(self):
        with self.app.auth_db() as db: db.execute('SELECT 1')
        with self.assertRaises(sqlite3.ProgrammingError): db.execute('SELECT 1')

    def charge(self):
        return self.app.open_generation_charge({'id':'alice'}, {'id':'fake','name':'Isolated','billing':'per-call','pricing':{'perCall':10}}, calls=1)

    @unittest.skip("Retired platform account/share/quota/billing behavior; local HTTP coverage: test_local_security_audit.py")
    def test_refund_is_once_only_even_after_serialization_and_concurrent_polls(self):
        charge=self.charge(); clones=[copy.deepcopy(charge) for _ in range(8)]
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
            list(pool.map(lambda item:self.app.settle_generation_charge(item, failed=True), clones))
        self.app.settle_generation_charge(copy.deepcopy(charge), failed=True)
        with self.app.auth_db() as db:
            self.assertEqual(self.app.user_credit_balance(db, 'alice'), 1000)
            self.assertEqual(db.execute('SELECT COUNT(*) FROM generation_settlements').fetchone()[0], 1)
            self.assertEqual(db.execute('SELECT COUNT(*) FROM credit_ledger WHERE amount=10').fetchone()[0], 1)

    @unittest.skip("Retired platform account/share/quota/billing behavior; local HTTP coverage: test_local_security_audit.py")
    def test_completed_settlement_cannot_later_be_refunded(self):
        charge=self.charge(); stale=copy.deepcopy(charge)
        self.app.settle_generation_charge(charge)
        self.app.settle_generation_charge(stale, failed=True)
        with self.app.auth_db() as db: self.assertEqual(self.app.user_credit_balance(db,'alice'),990)

    @unittest.skip("Retired platform account/share/quota/billing behavior; local HTTP coverage: test_local_security_audit.py")
    def test_failed_hold_cannot_mint_refund(self):
        charge=self.charge()
        with self.app.auth_db() as db: db.execute("DELETE FROM credit_ledger WHERE amount=-10")
        self.assertIsNone(self.app.settle_generation_charge(charge, failed=True))
        self.assertFalse(charge['settled'])
        with self.app.auth_db() as db: self.assertEqual(self.app.user_credit_balance(db,'alice'),1000)

    @unittest.skip("Retired platform account/share/quota/billing behavior; local HTTP coverage: test_local_security_audit.py")
    def test_legacy_settlement_before_upgrade_cannot_be_refunded_again(self):
        charge=self.charge()
        with self.app.auth_db() as db:
            self.app.credit_ledger_insert(db, 'alice', 10, 'old settlement',
                                         {'kind':'settle', 'holdId':charge['holdId'], 'actual':0, 'note':'old refund'})
        self.app.settle_generation_charge(charge, failed=True)
        with self.app.auth_db() as db: self.assertEqual(self.app.user_credit_balance(db,'alice'),1000)

    def test_raw_upload_and_legacy_model_routes_enforce_file_formats(self):
        before=set(self.app.MEDIA_DIR.iterdir())
        for name in ('fake.png', 'script.html', 'fake.glb'):
            self.assertEqual(self.request('POST','/api/media',raw=b'<html>arbitrary upload</html>',headers={'X-Media-Name':name,'Content-Type':'image/png'})[0],400)
        self.assertEqual(set(self.app.MEDIA_DIR.iterdir()),before)
        self.assertEqual(self.request('POST','/api/models',{'name':'fake','description':'no file'})[0],404)
        raw=(ROOT/'assets3d/previews/torus.png').read_bytes()
        status,body,_=self.request('POST','/api/media',raw=raw,headers={'X-Media-Name':'valid.png','Content-Type':'image/png'})
        self.assertEqual(status,201); self.assertEqual(body['media']['kind'],'image')

    def test_private_model_import_rejects_external_dependencies(self):
        name='media-'+'e'*32+'.bin'; file=self.app.MEDIA_DIR/name
        file.write_text(json.dumps({'asset':{'version':'2.0'},'meshes':[{}],'buffers':[{'uri':'http://evil.example/model.bin'}]}))
        self.assertEqual(self.request('POST','/api/previs/assets',{'name':'Bad','object':{'kind':'geometry','local':True,'modelUrl':'/media/'+name}})[0],400)
        self.assertEqual(self.app.PREVIS_ASSETS.records(),[])

    def test_more_than_200_music_uploads_do_not_delete_other_users_records(self):
        self.app.write_music([dict(id=f'm-{i}',ownerId='bob',shared=True) for i in range(201)])
        raw=b'RIFF'+(36).to_bytes(4,'little')+b'WAVEfmt '+bytes(12)+b'data'+bytes(12)
        self.assertEqual(self.request('POST','/api/music',{'name':'Added','data':'data:audio/wav;base64,'+base64.b64encode(raw).decode()})[0],201)
        self.assertEqual(len(self.app.read_music()),202)

    def upload_png(self,name='torus'):
        status,body,_=self.request('POST','/api/media',raw=(ROOT/f'assets3d/previews/{name}.png').read_bytes(),headers={'X-Media-Name':name+'.png','Content-Type':'image/png'})
        self.assertEqual(status,201);return body['media']['mediaId']

    @unittest.skip("Retired platform account/share/quota/billing behavior; local HTTP coverage: test_local_security_audit.py")
    def test_private_media_and_signed_sharing_enforce_permissions(self):
        media=self.upload_png();self.assertEqual(self.request('GET','/media/'+media,user=None)[0],401)
        self.assertEqual(self.request('GET','/media/'+media,user='bob')[0],403)
        self.assertEqual(self.request('GET','/media/'+media)[0],200)
        self.assertEqual(self.request('POST','/api/storage/share',{'mediaId':media},user='bob')[0],403)
        status,data,_=self.request('POST','/api/storage/share',{'mediaId':media});self.assertEqual(status,200)
        self.assertEqual(self.request('GET',data['url'],user=None)[0],200)
        self.assertEqual(self.request('GET',data['url']+'x',user=None)[0],401)
        self.assertEqual(self.request('PUT','/api/projects/q',{'nodes':[{'id':'image','type':'image','previewMedia':{'src':'/media/'+media,'type':'image'}}]},user='bob')[0],403)
        self.assertEqual(self.request('POST','/api/ai/image-to-text',{'image':'/media/'+media},user='bob')[0],403)

    @unittest.skip("Retired platform account/share/quota/billing behavior; local HTTP coverage: test_local_security_audit.py")
    def test_individual_quota_management_and_renewal(self):
        media=self.upload_png()
        self.assertEqual(self.request('PUT','/api/admin/users/alice/storage',{'quotaBytes':1},user='bob')[0],403)
        self.assertEqual(self.request('POST','/api/storage/renew',{'id':'file:'+media},user='bob')[0],403)
        status,data,_=self.request('POST','/api/storage/renew',{'id':'file:'+media});self.assertEqual(status,200)
        import time
        self.assertLess(abs(data['expiresAt']-(time.time()+30*86400)),3)
        self.assertEqual(self.request('PUT','/api/admin/users/alice/storage',{'quotaBytes':0})[0],200)
        self.assertEqual(self.request('GET','/api/storage')[1]['storage']['limit'],0)
        self.assertTrue((self.app.MEDIA_DIR/media).exists())
        self.assertEqual(self.request('POST','/api/media',raw=(ROOT/'assets3d/previews/cone.png').read_bytes(),headers={'X-Media-Name':'cone.png','Content-Type':'image/png'})[0],413)
        self.assertEqual(self.request('POST','/api/portfolio',{'name':'Work','sourceKind':'project','sourceId':'p'})[0],413)

    @unittest.skip("Retired platform account/share/quota/billing behavior; local HTTP coverage: test_local_security_audit.py")
    def test_portfolio_http_publication_and_owner_controls(self):
        status,data,_=self.request('POST','/api/portfolio',{'name':'Scene','sourceKind':'project','sourceId':'p'});self.assertEqual(status,201);work=data['work']
        self.assertEqual(self.request('GET','/api/portfolio',user=None)[0],401)
        self.assertEqual(self.request('GET','/api/portfolio/public/alice',user=None)[1]['works'],[])
        self.assertEqual(self.request('PUT','/api/portfolio/'+work['id'],{'name':'Wrong','revision':1},user='bob')[0],403)
        self.assertEqual(self.request('DELETE','/api/portfolio/'+work['id'],user='bob')[0],403)
        self.assertEqual(self.request('PUT','/api/portfolio/'+work['id'],{'name':'Public scene','revision':1,'isPublic':True})[0],200)
        public=self.request('GET','/api/portfolio/public/alice',user=None)[1]['works'];self.assertEqual(public[0]['name'],'Public scene');self.assertNotIn('nodes',public[0]);self.assertNotIn('sourceId',public[0])
        self.assertFalse(self.app.read_projects()[0]['shared']);self.assertEqual(self.request('GET','/portfolio/alice',user=None)[0],200)
        self.assertEqual(self.request('DELETE','/api/portfolio/'+work['id'])[0],200);self.assertEqual(len(self.app.read_projects()),2)

    @unittest.skip("Retired platform account/share/quota/billing behavior; local HTTP coverage: test_local_security_audit.py")
    def test_vip_cannot_register_private_network_provider_or_redirect_inherited_key(self):
        with self.app.auth_db() as db:db.execute("UPDATE users SET role='vip' WHERE id='bob'")
        self.assertEqual(self.request('POST','/api/admin/ai-models?scope=mine',{'name':'Local','model':'fake','baseUrl':'http://127.0.0.1:8000/v1'},user='bob')[0],403)
        status,data,_=self.request('POST','/api/admin/ai-models',{'name':'Safe','model':'fake','baseUrl':'https://provider.example/v1','apiKey':'fake-secret','enabled':False});self.assertEqual(status,201)
        self.assertEqual(self.request('POST','/api/admin/ai-models?scope=mine',{'name':'Stolen','model':'fake','baseUrl':'https://attacker.invalid/v1','inheritKeyFrom':data['model']['id']},user='bob')[0],403)
        self.assertEqual(self.request('POST','/api/admin/ai-models',{'name':'Admin local','model':'fake','baseUrl':'http://127.0.0.1:8000/v1','enabled':False})[0],201)

    @unittest.skip("Retired platform account/share/quota/billing behavior; local HTTP coverage: test_local_security_audit.py")
    def test_a_successful_renewal_wins_over_a_stale_cleanup_snapshot(self):
        self.app.write_file(self.app.ASSETS_FILE,[{'id':'renewed','ownerId':'alice','name':'Retained record','kind':'image'}])
        self.app.ACCOUNT_STORAGE.sync(force=True)
        with self.app.auth_db() as db:db.execute("UPDATE content_retention SET expires_at=0 WHERE item_id='renewed'")
        self.assertEqual(self.request('POST','/api/storage/renew',{'id':'asset:renewed'})[0],200)
        import time
        self.app.remove_storage_record('asset','renewed','alice',expired_before=time.time())
        self.assertEqual(self.app.read_assets()[0]['id'],'renewed')


if __name__ == '__main__': unittest.main()
