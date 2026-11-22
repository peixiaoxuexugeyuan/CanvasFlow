"""Use temporary catalogues and synthetic credentials only."""
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
DATA = tempfile.TemporaryDirectory(prefix='canvasflow-provider-test-')
os.environ['CANVASFLOW_DATA_DIR'] = DATA.name
import server


@unittest.skipUnless(os.name == 'nt', 'Windows DPAPI')
class ProviderStorageTests(unittest.TestCase):
    def test_migrate_and_resave_model_and_provider(self):
        with tempfile.TemporaryDirectory() as directory:
            models = Path(directory, 'ai-models.json')
            providers = Path(directory, 'ai-providers.json')
            secret = 'synthetic-test-key-' * 17
            for path in (models, providers):
                path.write_text(json.dumps([{'id': 'test', 'apiKey': secret}]), encoding='utf-8')
            with patch.object(server, 'AI_MODELS_FILE', models), patch.object(server, 'AI_PROVIDERS_FILE', providers):
                server.migrate_provider_credentials()
                for path in (models, providers):
                    stored = path.read_text(encoding='utf-8')
                    self.assertNotIn(secret, stored)
                    rows = server.read_file(path, [])
                    self.assertEqual(rows[0]['apiKey'], secret)
                    self.assertNotIn('protectedApiKey', rows[0])
                    rows[0]['name'] = 'renamed'
                    server.write_file(path, rows)
                    self.assertNotIn(secret, path.read_text(encoding='utf-8'))
                    self.assertEqual(server.read_file(path, [])[0]['apiKey'], secret)
                server.migrate_provider_credentials()
                self.assertTrue(server.ai_model_public(server.read_file(models, [])[0])['apiKeySet'])

    def test_unreadable_key_preserved_until_replaced(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory, 'ai-providers.json')
            source = {'id':'provider-test', 'baseUrl':'https://example.com', 'protectedApiKey':'invalid'}
            path.write_text(json.dumps([source]), encoding='utf-8')
            old = server.read_file(path, [])[0]
            saved = server.provider_record({'provider':'renamed'}, old)
            self.assertFalse(saved['apiKey'])
            self.assertEqual(saved['protectedApiKey'], 'invalid')
            self.assertNotIn('protectedApiKey', server.ai_provider_public(saved))
            fresh = server.provider_record({'apiKey':'synthetic-replacement'}, saved)
            server.write_file(path, [fresh])
            self.assertEqual(server.read_file(path, [])[0]['apiKey'], 'synthetic-replacement')


class MediaPolicyTests(unittest.TestCase):
    def test_provider_diagnostics_redact_before_storage_or_display(self):
        import io
        from urllib.error import HTTPError
        from urllib.request import Request
        key = 'sample-credential-for-offline-tests'
        link = 'https://example.test/result?signature=sample-query-value'
        detail = f'Quota exceeded for {key}, see {link}'
        error = HTTPError('https://example.test/jobs', 429, 'limit', {}, io.BytesIO(json.dumps({'message':detail}).encode()))
        req = Request('https://example.test/jobs', headers={'Authorization':'Bearer ' + key})
        with patch.object(server, 'open_http_url', side_effect=error):
            _, _, message = server.send_request(req)
        self.assertIn('Quota exceeded', message)
        self.assertNotIn(key, message)
        self.assertNotIn('sample-query-value', message)
        business_error = server.media_status_payload_error({'error':{'message':detail}}, {'apiKey':key})
        self.assertNotIn(key, business_error)
        job = {'pollError':f'api-key={key}, see {link}', 'videoUrl':link}
        safe = server.scrub_job_diagnostics(job)
        self.assertEqual(safe['videoUrl'], link)
        self.assertNotIn(key, safe['pollError'])
        self.assertNotIn('sample-query-value', safe['pollError'])
        self.assertEqual(server.scrub_job_diagnostics(safe), safe)

    def test_legacy_journal_removes_echoed_configured_key_during_compaction(self):
        key = 'offline-legacy-provider-value'
        job = {'id':'old-job', 'status':'running', 'pollError':'Quota exhausted for ' + key}
        with tempfile.TemporaryDirectory() as directory:
            jobs = Path(directory, 'jobs.jsonl')
            jobs.write_text(json.dumps(job) + '\n', encoding='utf-8')
            with (patch.object(server, 'JOBS_FILE', jobs),
                  patch.object(server, 'configured_diagnostic_credentials', return_value={key})):
                self.assertNotIn(key, server.latest_jobs()[0]['pollError'])
                server.append_job({'id':'new-job', 'status':'queued'})
            self.assertNotIn(key, jobs.read_text(encoding='utf-8'))

    def test_download_uses_media_policy_and_restores_local_role(self):
        with patch.object(server, 'open_http_url', side_effect=lambda *a, **kw: server.NETWORK_ROLE.get()):
            token = server.NETWORK_ROLE.set('admin')
            try:
                self.assertEqual(server.open_media_url('https://example.com/video'), 'media')
                self.assertEqual(server.NETWORK_ROLE.get(), 'admin')
            finally:
                server.NETWORK_ROLE.reset(token)

    def test_media_trusts_configured_provider_origins_and_keeps_proxies_separate(self):
        models = [{'baseUrl': 'http://localhost:8000/api'}]
        providers = [{'baseUrl': 'http://localhost:8001/v1'}]
        with (patch.object(server, 'read_ai_models', return_value=models),
              patch.object(server, 'read_ai_providers', return_value=providers),
              patch.dict(os.environ, {'HTTP_PROXY':'http://localhost:8002', 'OPENAI_BASE_URL':''}),
              patch.object(server, 'network_access', wraps=server.network_access) as policy,
              patch.object(server, 'guarded_open_http_url') as transport):
            server.open_media_url('https://example.com/image')
            role, origins = policy.call_args.args
            self.assertEqual(role, 'media')
            self.assertEqual(origins, {('http', 'localhost', 8000), ('http', 'localhost', 8001)})
            transport.assert_called_once()


if __name__ == '__main__':
    unittest.main()
