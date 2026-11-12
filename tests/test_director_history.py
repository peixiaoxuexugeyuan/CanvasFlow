"""Image history pagination must retain older results and workspace isolation."""
import ast
import json
import pathlib
import tempfile
import unittest
from urllib.parse import parse_qs, urlparse

tree = ast.parse((pathlib.Path(__file__).resolve().parents[1] / 'server.py').read_text(encoding='utf-8-sig'))
latest = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'latest_jobs')
route = next(n for n in ast.walk(tree) if isinstance(n, ast.If) and isinstance(n.test, ast.Compare) and isinstance(n.test.left, ast.Name) and n.test.left.id == 'path' and any(isinstance(c, ast.Constant) and c.value == '/api/jobs' for c in n.test.comparators))
handler = ast.parse('def get_jobs(self, user):\n    pass').body[0]
handler.body = route.body
module = ast.fix_missing_locations(ast.Module(body=[latest, handler], type_ignores=[]))

class ImageHistoryTest(unittest.TestCase):
    def test_paginated_completed_images_are_not_capped_before_filtering(self):
        with tempfile.TemporaryDirectory() as folder:
            file = pathlib.Path(folder) / 'jobs.jsonl'
            jobs = [dict(id=str(i), userId='u', workspaceId='w', projectId='p', kind='image', status='completed', createdAt=f'{i:04d}') for i in range(205)]
            jobs += [dict(id=f'queued-{i}', userId='u', workspaceId='w', kind='image', status='queued', createdAt='9999') for i in range(210)]
            jobs += [dict(id='private', userId='other', workspaceId='w', kind='image', status='completed'), dict(id='other-workspace', userId='u', workspaceId='elsewhere', kind='image', status='completed'), dict(id='video', userId='u', workspaceId='w', kind='video', status='completed')]
            jobs.append({**jobs[0], 'name': 'latest snapshot'})
            file.write_text('\n'.join(map(json.dumps, jobs)), encoding='utf-8')
            scope = dict(json=json, JOBS_FILE=file, parse_qs=parse_qs, urlparse=urlparse, job_view=lambda j, sync=False: j, local_job=lambda j:j, in_workspace=lambda j, w, valid: j.get('workspaceId') == w)
            exec(compile(module, 'history-route', 'exec'), scope)
            class Request:
                path = '/api/jobs?kind=image&status=completed&limit=200'
                def workspace_scope(self, user): return 'w', set()
                def send_json(self, data): return data
            request = Request()
            first = scope['get_jobs'](request, {'id': 'u'})
            self.assertEqual(first['total'], 205)
            self.assertEqual(len(first['jobs']), 200)
            request.path += '&offset=200'
            second = scope['get_jobs'](request, {'id': 'u'})
            self.assertEqual(len(second['jobs']), 5)
            self.assertEqual(second['jobs'][-1]['name'], 'latest snapshot')
            self.assertEqual(len({j['id'] for j in first['jobs'] + second['jobs']}), 205)

if __name__ == '__main__': unittest.main()
