"""Offline MediaKit adapter tests using real canvas storage and a tiny synthetic video."""
from contextlib import nullcontext
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import threading
import unittest
from unittest.mock import Mock, patch

import mediakit_depth as depth


ROOT = Path(__file__).resolve().parents[1]


class DepthTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        spec = importlib.util.spec_from_file_location('isolated_mediakit_canvas', ROOT / 'server.py')
        self.server = importlib.util.module_from_spec(spec)
        with patch.dict(os.environ, CANVASFLOW_DATA_DIR=self.temp.name):
            spec.loader.exec_module(self.server)
        self.svc = depth.DepthService(self.server.DEPTH_HOST)
        self.uid = self.server.LOCAL_ID
        self.workspace = self.server.default_workspace_id(self.uid)
        self.svc.credential(self.uid, 'test-key')
        self.data = {'sourceUrl': 'https://example.com/video.mp4', 'projectId': 'project-id',
                     'nodeId': 'node-output', 'requestId': 'request-id'}
        self.scheduler = patch.object(self.svc, 'schedule').start()
        self.addCleanup(patch.stopall)

    def test_deduplicates_and_sets_key_per_account(self):
        self.assertEqual(self.svc.credential('other'), '')
        if os.name == 'nt':
            credentials = Path(self.temp.name, 'mediakit-credentials.json').read_text(encoding='utf8')
            self.assertNotIn('test-key', credentials)
        job = self.svc.submit(self.data, self.uid, self.workspace)
        repeated = self.svc.submit(self.data, self.uid, self.workspace)
        self.assertEqual(job, repeated)
        with self.assertRaisesRegex(depth.DepthError, '同一请求'):
            self.svc.submit({**self.data, 'start': 1}, self.uid, self.workspace)
        self.assertFalse(self.svc.credential(self.uid, ''))

    def test_installer_waits_for_persisted_task_id_and_blocks_new_submissions_at_handoff(self):
        gate = self.server.desktop_image_update_gate
        job = self.svc.submit(self.data, self.uid, self.workspace)
        self.assertTrue(gate('reserve')['busy'])
        self.svc._save(job, status='running', stage='submitting')
        self.assertTrue(gate('reserve')['busy'])
        self.svc._save(job, stage='processing', providerJobId='durable-receipt')
        self.assertFalse(gate('reserve')['busy'])
        new_request = {**self.data, 'requestId': 'other'}
        with self.assertRaisesRegex(depth.DepthError, '正在安装更新'):
            self.svc.submit(new_request, self.uid, self.workspace)
        self.assertEqual(self.svc.submit(self.data, self.uid, self.workspace)['providerJobId'], 'durable-receipt')
        gate('release')
        self.assertEqual(self.svc.submit(new_request, self.uid, self.workspace)['status'], 'queued')

    def test_ambiguous_submit_restart_never_posts(self):
        job = self.svc.submit(self.data, self.uid, self.workspace)
        self.svc._save(job, stage='submitting', status='running')
        with patch.object(depth, 'transport', side_effect=AssertionError) as calls:
            self.svc.process(job)
        calls.assert_not_called()
        self.assertFalse(job['recoverable'])
        self.assertEqual(job['status'], 'failed')

    def test_upload_stream_and_separate_origins(self):
        media = Path(self.temp.name, 'sample.mp4')
        media.write_bytes(b'video-bytes')
        def upstream(req, timeout):
            if req.full_url.endswith(depth.UPLOAD):
                self.assertEqual(req.get_header('Authorization'), 'Bearer service-key')
                return io.BytesIO(json.dumps({'success': True, 'result': {'method': 'PUT',
                    'file_id': 'mediakit://fake', 'upload_url': 'https://cdn.example.com/up'}}).encode())
            self.assertEqual(req.get_method(), 'PUT')
            self.assertEqual(req.full_url, 'https://cdn.example.com/up')
            self.assertIsNone(req.get_header('Authorization'))
            self.assertEqual(req.data.read(), b'video-bytes')
            return io.BytesIO()
        with patch.object(depth, 'open_http_url', side_effect=upstream) as calls:
            self.assertEqual(depth.upload_media('service-key', media), 'mediakit://fake')
            self.assertEqual(calls.call_count, 2)

    def test_recover_keeps_paid_task_and_transcodes_local_master(self):
        try:
            ffmpeg = depth.executable(ROOT, 'ffmpeg')
        except depth.DepthError:
            self.skipTest('FFmpeg is not installed')
        fixture = Path(self.temp.name, 'motion.mp4')
        subprocess.run([ffmpeg, '-nostdin', '-loglevel', 'error', '-f', 'lavfi', '-i',
                        'testsrc2=size=64x64:rate=10', '-t', '0.5', '-c:v', 'libx265', '-tag:v', 'hvc1',
                        '-x265-params', 'log-level=error', str(fixture)], check=True, timeout=30)
        self.assertIn(b'hvc1', fixture.read_bytes())
        local = self.server.save_media_blob(fixture.read_bytes(), 'video/mp4', 'source.mp4', owner_id=self.uid)['url']
        data = {**self.data, 'sourceUrl': local, 'start': 0, 'end': 0.3}
        job = self.svc.submit(data, self.uid, self.workspace)
        def mock_service(key, path, payload=None):
            if path == depth.SUBMIT:
                self.assertEqual(payload, {'video_url': 'mediakit://owned', 'model': 'standard'})
                return {'success': True, 'task_id': 'persistent-task'}
            self.assertEqual(path, '/api/v1/tasks/persistent-task')
            return {'success': True, 'status': 'completed', 'result': {'video_url': 'https://cdn.example.com/depth'}}
        with patch.object(depth, 'upload_media', return_value='mediakit://owned') as uploader,\
             patch.object(depth, 'transport', side_effect=mock_service) as requests,\
             patch.object(self.svc.host, 'persist_media_url', side_effect=[ValueError('timeout'), {'url': local}]):
            self.svc.process(job)
            self.assertEqual(job['status'], 'failed')
            self.assertTrue(job['recoverable'])
            self.assertEqual(job['providerJobId'], 'persistent-task')
            resumed = self.svc.recover(job)
            self.svc.process(resumed)
            self.assertEqual(resumed['status'], 'completed', resumed.get('error'))
            result = self.server.resolve_media_file(resumed['videoUrl'].split('/')[-1])
            self.assertIn(b'avc1', result.read_bytes())
            self.assertEqual(requests.call_count, 2)
            uploader.assert_called_once()
            stored = self.server.index_jobs()[job['id']]
            self.assertEqual(stored['videoUrl'], resumed['videoUrl'])

    def test_closing_waits_for_paid_receipt_then_restart_resumes_only_polling(self):
        job = self.svc.submit(self.data, self.uid, self.workspace)
        submitted, reply, polled = (threading.Event() for _ in range(3))
        def upstream(key, path, payload=None):
            if path == depth.SUBMIT:
                submitted.set()
                self.assertTrue(reply.wait(5))
                return {'success': True, 'task_id': 'paid-receipt'}
            self.assertEqual(path, '/api/v1/tasks/paid-receipt')
            polled.set()
            return {'success': True, 'status': 'running'}

        source = Path(self.temp.name, 'dummy.mp4')
        def listen():
            return self.server.ThreadingHTTPServer(('127.0.0.1', 0), self.server.Handler)
        with patch.object(depth, 'source_video_file', side_effect=lambda *a, **k: nullcontext(source)), \
             patch.object(depth, 'selected_video_file', side_effect=lambda *a: nullcontext(source)), \
             patch.object(depth, 'validate_video'), patch.object(depth, 'executable'), \
             patch.object(depth, 'upload_media', return_value='mediakit://unit') as upload, \
             patch.object(depth, 'transport', side_effect=upstream) as api:
            first = listen()
            closer = None
            try:
                self.assertTrue(submitted.wait(4))
                closer = threading.Thread(target=first.server_close)
                closer.start()
                self.assertTrue(first.depth_service.stop.wait(2))
                self.assertFalse(first._data_lease.closed)
            finally:
                reply.set()
                if closer:
                    closer.join(5)
                else:
                    first.server_close()
            self.assertFalse(closer.is_alive())
            self.assertTrue(first._data_lease.closed)
            saved = self.server.index_jobs()[job['id']]
            self.assertEqual((saved['stage'], saved['providerJobId']), ('processing', 'paid-receipt'))
            with self.assertRaisesRegex(depth.DepthError, '正在关闭'):
                first.depth_service.submit(self.data, self.uid, self.workspace)
            with listen() as restarted:
                self.assertTrue(polled.wait(4))
            self.assertTrue(restarted._data_lease.closed)
            self.assertFalse(restarted.depth_service.workers)
            self.assertEqual(self.server.index_jobs()[job['id']]['status'], 'running')
            self.assertEqual([c.args[1] for c in api.call_args_list], [depth.SUBMIT, '/api/v1/tasks/paid-receipt'])
            upload.assert_called_once()

    def test_input_limits_apply_to_selected_duration_and_orientation(self):
        def probe(width, height):
            return json.dumps({'format': {'duration': '700'}, 'streams': [{'width': width, 'height': height}]}).encode()
        with patch.object(depth, 'executable'), patch.object(depth, 'run_media', return_value=probe(1440, 2560)):
            with self.assertRaisesRegex(depth.DepthError, '10 分钟'):
                depth.validate_video(ROOT, 'source')
            depth.validate_video(ROOT, 'source', start=100, end=700)
        with patch.object(depth, 'executable'), patch.object(depth, 'run_media', return_value=probe(2160, 3840)):
            with self.assertRaisesRegex(depth.DepthError, '2K'):
                depth.validate_video(ROOT, 'source', start=100, end=101)

    def test_invalid_local_media_reports_ffmpeg_diagnostic(self):
        try:
            binary = depth.executable(ROOT, 'ffprobe')
        except depth.DepthError:
            self.skipTest('FFprobe is not installed')
        with self.assertRaisesRegex(depth.DepthError, 'ffprobe.*退出码'):
            depth.run_media([binary, '-v', 'error', str(Path(self.temp.name, 'missing.mp4'))], 10)

    def test_api_never_returns_key(self):
        handler = Mock()
        handler.server.depth_service = self.svc
        handler.authenticated_user.return_value = {'id': self.uid}
        self.server.Handler.depth_api(handler, '/api/media-tools/depth/settings', 'GET')
        handler.send_json.assert_called_with({'configured': True})
        handler.read_json.return_value = {'apiKey': ''}
        self.server.Handler.depth_api(handler, '/api/media-tools/depth/settings', 'POST')
        handler.send_json.assert_called_with({'configured': False})
        handler.authenticated_user.return_value = None
        self.server.Handler.depth_api(handler, '/api/media-tools/depth/settings', 'POST')
        self.assertEqual(handler.send_json.call_args.args[-1], 401)

