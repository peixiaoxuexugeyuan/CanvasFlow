import ast
import copy
import threading
import unittest
from pathlib import Path


class CommunityDeleteOwnershipTests(unittest.TestCase):
    def run_delete(self, resource, viewer, missing=False):
        tree = ast.parse(Path('server.py').read_text(encoding='utf-8'))
        route = next(n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef) and n.name == '_route_delete')
        branch = next(n for n in route.body if isinstance(n, ast.If) and ast.unparse(n.test) == f"path.startswith('/api/{resource}/')")
        wrapper = ast.parse('def delete(self,path,user):\n pass').body[0]
        wrapper.body = [copy.deepcopy(branch)]
        module = ast.fix_missing_locations(ast.Module(body=[wrapper], type_ignores=[]))
        rows = [{'id': 'target', 'ownerId': 'alice'}, {'id': 'other', 'ownerId': 'bob'}]
        writes = []
        scope = {'LOCK': threading.Lock(), 'ASSETS_FILE': 'assets',
                 'read_music': lambda: copy.deepcopy(rows), 'read_models': lambda: copy.deepcopy(rows),
                 'read_assets': lambda: copy.deepcopy(rows), 'write_music': lambda data: writes.append(data),
                 'write_models': lambda data: writes.append(data), 'write_file': lambda _, data: writes.append(data)}
        exec(compile(module, 'production-delete-route', 'exec'), scope)
        handler = type('Handler', (), {'send_json': lambda self, body, status=200: (body, status)})()
        result = scope['delete'](handler, f'/api/{resource}/'+('missing' if missing else 'target'), viewer)
        return result, writes

    def test_other_users_and_admins_cannot_delete_shares(self):
        for resource in ('music', 'models', 'assets'):
            for role in ('user', 'admin'):
                with self.subTest(resource=resource, role=role):
                    (_, status), writes = self.run_delete(resource, {'id': 'bob', 'role': role})
                    self.assertEqual(status, 403)
                    self.assertEqual(writes, [])

    def test_owner_can_delete_only_their_target(self):
        for resource in ('music', 'models', 'assets'):
            with self.subTest(resource=resource):
                (body, status), writes = self.run_delete(resource, {'id': 'alice'})
                self.assertEqual(status, 200)
                self.assertTrue(body['deleted'])
                self.assertEqual(writes, [[{'id': 'other', 'ownerId': 'bob'}]])

    def test_missing_record_does_not_write(self):
        for resource in ('music', 'models', 'assets'):
            with self.subTest(resource=resource):
                (_, status), writes = self.run_delete(resource, {'id': 'alice'}, missing=True)
                self.assertEqual(status, 404)
                self.assertEqual(writes, [])


if __name__ == '__main__':
    unittest.main()
