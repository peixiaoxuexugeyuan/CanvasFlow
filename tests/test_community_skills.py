import copy
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import community_skills as module


ITEM = {'id': 'community-example', 'name': '完整技能', 'contentHash': 'a'*64,
        'fileCount': 2, 'primarySkillFilePath': 'SKILL.md'}
CATALOG = {'schemaVersion': 1, 'skills': [ITEM]}
PACKAGE = {'skill': dict(ITEM, files=[{'path': 'SKILL.md', 'content': '[参考](references/camera.md)'},
                                      {'path': 'references/camera.md', 'content': '完整参考正文'}])}


class CommunitySkillsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.file = Path(self.temp.name)/'catalog.json'
        self.now = 1000
        self.calls = []
        self.response = copy.deepcopy(CATALOG)
        def fetch(path):
            self.calls.append(path)
            if isinstance(self.response, Exception): raise self.response
            return copy.deepcopy(self.response)
        self.client = module.CommunitySkills(self.file, fetch, lambda: self.now)

    def test_cache_refresh_and_removal_are_authoritative(self):
        self.assertEqual(self.client.catalog()['count'], 1)
        self.client.catalog()
        self.assertEqual(len(self.calls), 1)
        self.response = {'schemaVersion': 1, 'skills': []}
        self.now += 6
        self.assertEqual(self.client.catalog(force=True)['count'], 0)
        self.assertEqual(json.loads(self.file.read_text())['skills'], [])

    def test_network_failure_preserves_cache_and_recovers(self):
        self.client.catalog()
        self.response = OSError('offline')
        self.now += 70
        result = self.client.catalog()
        self.assertTrue(result['stale'])
        self.assertEqual(result['count'], 1)
        restored = module.CommunitySkills(self.file, self.client.fetch, lambda: self.now)
        self.assertTrue(restored.catalog()['stale'])
        self.response = copy.deepcopy(CATALOG)
        self.now += 70
        self.assertFalse(self.client.catalog()['stale'])

    def test_first_failure_is_explicit_and_retry_is_throttled(self):
        self.response = OSError('private networking details')
        for _ in range(2):
            with self.assertRaisesRegex(module.CommunityError, '本地技能仍可使用'):
                self.client.catalog(force=True)
        self.assertEqual(len(self.calls), 1)

    def test_bad_catalog_cannot_replace_good_snapshot(self):
        self.client.catalog()
        for item in [dict(ITEM, id='../bad'), dict(ITEM, contentHash='bad'), dict(ITEM, fileCount=0), dict(ITEM, demo=True)]:
            self.response = {'schemaVersion': 1, 'skills': [item]}
            self.now += 70
            self.assertTrue(self.client.catalog()['stale'])
            self.assertEqual(self.client.catalog()['skills'][0]['id'], ITEM['id'])

    def test_package_keeps_every_document_and_rechecks_withdrawal(self):
        self.response = copy.deepcopy(PACKAGE)
        self.assertEqual(self.client.detail(ITEM['id']), PACKAGE)
        self.response = HTTPError('https://skill.zzzapi.xyz', 404, '', {}, None)
        with self.assertRaises(module.CommunityError) as result:
            self.client.detail(ITEM['id'])
        self.assertEqual(result.exception.status, 404)

    def test_no_arbitrary_proxy_or_unsafe_file_paths(self):
        for ident in ('../private', 'https://example.com', 'id?key=private', 'a/b'):
            with self.assertRaises(module.CommunityError): self.client.detail(ident)
        self.assertEqual(self.calls, [])
        for path in ('../escape.md', '/root.md', 'C:/file.md', 'a\\b.md', 'references//camera.md', 'skill.md'):
            self.response = copy.deepcopy(PACKAGE)
            self.response['skill']['files'][1]['path'] = path
            with self.assertRaises(module.CommunityError): self.client.detail(ITEM['id'])

    def test_fixed_public_request_has_no_local_credentials_and_is_bounded(self):
        raw = json.dumps(CATALOG).encode()
        with patch.object(module.request, 'build_opener') as builder:
            builder.return_value.open.return_value.__enter__.return_value = io.BytesIO(raw)
            self.assertEqual(module.read_public(''), CATALOG)
            req = builder.return_value.open.call_args.args[0]
            self.assertEqual(req.full_url, 'https://skill.zzzapi.xyz/api/library')
            self.assertIsNone(req.data)
            self.assertNotIn('Cookie', req.headers)
            self.assertNotIn('Authorization', req.headers)
        with self.assertRaises(module.CommunityError):
            module.NoRedirect().redirect_request(None, None, 302, '', {}, 'https://other.invalid')


if __name__ == '__main__': unittest.main()
