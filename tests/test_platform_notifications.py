import ast
import json
import tempfile
import threading
import unittest
from pathlib import Path
from platform_notifications import NotificationStore, NotificationError


class NotificationTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.path = Path(self.directory.name) / 'notifications.json'
        self.store = NotificationStore(self.path, lambda p, default: json.loads(p.read_text()) if p.exists() else default,
                                       lambda p, rows: p.write_text(json.dumps(rows)), threading.Lock(), lambda: '2026-10-13')
        self.admin = {'id': 'admin', 'nickname': 'Administrator', 'role': 'admin'}

    def tearDown(self):
        self.directory.cleanup()

    def test_publish_edit_delete_and_persistence(self):
        item = self.store.save(self.admin, {'title': ' New notice ', 'content': ' Line 1\nLine 2 '})
        self.assertEqual(item['title'], 'New notice')
        self.assertEqual(item['content'], 'Line 1\nLine 2')
        update = self.store.save(self.admin, {'title': 'Changed', 'content': 'Updated'}, item['id'])
        self.assertEqual(update['id'], item['id'])
        self.assertEqual(update['createdAt'], item['createdAt'])
        self.assertEqual(update['revision'], 2)
        self.assertEqual(json.loads(self.path.read_text())[0]['title'], 'Changed')
        self.store.delete(self.admin, item['id'])
        self.assertEqual(self.store.list(), [])

    def test_non_admin_cannot_publish_edit_or_delete(self):
        item = self.store.save(self.admin, {'title': 'Notice', 'content': 'Keep me'})
        for actor in (None, {'id': 'other', 'role': 'user'}, {'id': 'other', 'role': 'vip'}):
            for operation in (lambda: self.store.save(actor, {'title': 'x', 'content': 'y'}),
                              lambda: self.store.save(actor, {'title': 'x', 'content': 'y'}, item['id']),
                              lambda: self.store.delete(actor, item['id'])):
                with self.assertRaises(NotificationError) as failure:
                    operation()
                self.assertEqual(failure.exception.status, 403)
        self.assertEqual(self.store.list(), [item])

    def test_validation_cannot_create_empty_or_oversized_notices(self):
        for payload in (None, {}, {'title':' ', 'content':'body'}, {'title':'title', 'content':''},
                        {'title':3, 'content':'body'}, {'title':'a'*121, 'content':'body'},
                        {'title':'title', 'content':'x'*10001}):
            with self.assertRaises(NotificationError):
                self.store.save(self.admin, payload)
        self.assertEqual(self.store.list(), [])

    def test_missing_id_never_creates_or_deletes_a_different_notice(self):
        for operation in (lambda: self.store.save(self.admin, {'title':'x','content':'y'}, 'missing'),
                          lambda: self.store.delete(self.admin, 'missing')):
            with self.assertRaises(NotificationError) as failure:
                operation()
            self.assertEqual(failure.exception.status, 404)

    def test_response_cannot_mutate_stored_records(self):
        item = self.store.save(self.admin, {'title':'Safe', 'content':'Body'})
        result = self.store.list()
        result[0]['title'] = 'Client changed'
        self.assertEqual(self.store.list(), [item])

    def test_production_route_authentication_and_admin_checks(self):
        tree = ast.parse(Path('server.py').read_text(encoding='utf-8'))
        method = next(n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef) and n.name == 'notifications_api')
        scope = {'PLATFORM_NOTIFICATIONS': self.store, 'NotificationError': NotificationError}
        exec(compile(ast.Module(body=[method], type_ignores=[]), 'notification-route', 'exec'), scope)
        for actor, path, method_name, expected in ((None,'/api/notifications','GET',401),
                ({'id':'reader','role':'user'},'/api/notifications','GET',200),
                ({'id':'reader','role':'user'},'/api/admin/notifications','GET',403),
                ({'id':'reader','role':'user'},'/api/admin/notifications','POST',403),
                ({'id':'reader','role':'user'},'/api/admin/notifications/missing','PUT',403),
                ({'id':'reader','role':'user'},'/api/admin/notifications/missing','DELETE',403)):
            handler = type('Handler', (), {'authenticated_user':lambda self:actor,
                'send_json':lambda self, body, status=200:(body,status)})()
            self.assertEqual(scope['notifications_api'](handler,path,method_name)[1], expected)

    def test_pinned_order_and_independent_flags_survive_partial_edits(self):
        first=self.store.save(self.admin,{'title':'Pinned','content':'body','pinned':True,'firstPopup':False})
        second=self.store.save(self.admin,{'title':'Popup','content':'body','pinned':False,'firstPopup':True})
        self.assertEqual(self.store.list()[0]['id'],first['id'])
        updated=self.store.save(self.admin,{'title':'Changed','content':'body'},first['id'])
        self.assertTrue(updated['pinned']);self.assertFalse(updated['firstPopup'])
        self.assertTrue(next(row for row in self.store.list() if row['id']==second['id'])['firstPopup'])
        with self.assertRaises(NotificationError): self.store.save(self.admin,{'title':'Bad','content':'body','firstPopup':'false'})

    def test_first_popup_confirmation_is_persistent_and_account_scoped(self):
        item=self.store.save(self.admin,{'title':'Read once','content':'body','firstPopup':True})
        alice={'id':'alice','role':'user'};bob={'id':'bob','role':'user'}
        self.assertEqual(self.store.acknowledged(alice),[])
        self.assertEqual(self.store.acknowledge(alice,[item['id']]),[item['id']])
        self.assertEqual(self.store.acknowledged(bob),[])
        reopened=NotificationStore(self.path,self.store.read,self.store.write,threading.Lock(),lambda:'later')
        self.assertEqual(reopened.acknowledged(alice),[item['id']])
        self.store.save(self.admin,{'title':'Updated','content':'body','firstPopup':False},item['id'])
        self.store.save(self.admin,{'title':'Updated','content':'body','firstPopup':True},item['id'])
        self.assertEqual(self.store.acknowledged(alice),[item['id']])
        self.assertEqual(self.store.acknowledge(bob,['missing']),[])
        with self.assertRaises(NotificationError): self.store.acknowledge(None,[item['id']])
        with self.assertRaises(NotificationError): self.store.acknowledge(alice,'invalid')


if __name__ == '__main__':
    unittest.main()
