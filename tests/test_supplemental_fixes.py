"""Gap-audit regressions: synthetic bytes and isolated storage, no live AI."""
import io
import os
import sys
import tempfile
import unittest
from email.message import Message
from http.client import IncompleteRead
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
DATA = tempfile.TemporaryDirectory(prefix='canvasflow-gap-fixes-')
os.environ['CANVASFLOW_DATA_DIR'] = DATA.name
import server as app


class Response(io.BytesIO):
    def __init__(self, body, mime='audio/mpeg', extra_length=0):
        super().__init__(body)
        self.headers = Message()
        self.headers['Content-Type'] = mime
        self.headers['Content-Length'] = str(len(body) + extra_length)


class SupplementalFixes(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        DATA.cleanup()

    def setUp(self):
        block = patch.object(app, 'guarded_open_http_url', side_effect=AssertionError('No live upstream'))
        block.start()
        self.addCleanup(block.stop)

    def test_tts_valid_audio_and_octet_stream_remain_accepted(self):
        body = b'ID3' + bytes(40)
        for mime in ('audio/mpeg', 'application/octet-stream', ''):
            with self.subTest(mime=mime), patch.object(app, 'open_http_url', return_value=Response(body, mime)) as call:
                raw, _, error = app.request_bytes_candidates(['https://fixture.invalid'], {}, expected_audio=True)
                self.assertEqual(raw, body)
                self.assertIsNone(error)
                self.assertEqual(call.call_count, 1)

    def test_tts_error_content_never_falls_back_or_returns_audio(self):
        for mime, body in [('text/html', b'<html>maintenance</html>'),
                           ('application/json', b'{"error":"quota"}'),
                           ('audio/mpeg', b'{"error":"wrong content type"}'),
                           ('application/octet-stream', b'not audio')]:
            with self.subTest(mime=mime), patch.object(app, 'open_http_url', return_value=Response(body, mime)) as call:
                raw, hit, error = app.request_bytes_candidates(['https://fixture.invalid/a','https://fixture.invalid/b'], {}, expected_audio=True)
                self.assertIsNone(raw)
                self.assertIsNone(hit)
                self.assertTrue(error)
                self.assertEqual(call.call_count, 1)

    def test_damaged_http_error_does_not_retry_even_for_route_rejection(self):
        for status in (404, 405, 504):
            error = HTTPError('https://fixture.invalid', status, 'failure', {}, None)
            error.read = lambda *_: (_ for _ in ()).throw(IncompleteRead(b'broken', 20))
            with patch.object(app, 'open_http_url', side_effect=error) as call:
                raw, _, detail = app.request_bytes_candidates(['https://fixture.invalid/a','https://fixture.invalid/b'], {})
                self.assertIsNone(raw)
                self.assertIn(str(status), detail)
                self.assertEqual(call.call_count, 1)

    def test_truncated_media_is_not_written(self):
        body = b'ID3' + bytes(40)
        with patch.object(app, 'open_http_url', return_value=Response(body, extra_length=50)), patch.object(app, 'save_media_blob') as save:
            with self.assertRaises(ValueError): app.persist_media_url('https://fixture.invalid/media.mp3')
            save.assert_not_called()

    def test_specs_reject_non_array_params(self):
        for value in (None, 42, 'bad', {}, False):
            with self.subTest(value=value), patch.object(app, 'http_json_request', return_value=(200, {'params': value}, None)):
                rows, meta, error = app.fetch_upstream_specs('fixture', 'https://fixture.invalid', 'fake')
                self.assertEqual((rows, meta), ([], {}))
                self.assertTrue(error)
        with patch.object(app, 'http_json_request', return_value=(200, {'params': []}, None)):
            self.assertEqual(app.fetch_upstream_specs('fixture', 'https://fixture.invalid', 'fake')[1]['totalParams'], 0)

    def test_nonfinite_timeouts_are_ignored_and_valid_overrides_survive(self):
        app.write_user_timeouts(app.LOCAL_ID, {'timeouts': {'textExec': 33}})
        for value in ('1e309', '-1e309', 'NaN', 'Infinity', float('inf')):
            app.write_user_timeouts(app.LOCAL_ID, {'timeouts': {'textExec': value}})
            self.assertEqual(app.user_timeout_overrides(app.LOCAL_ID)['textExec'], 33)
            self.assertEqual(app.clamp_timeouts({'textExec': value}), {})
        app.write_user_timeouts(app.LOCAL_ID, {'timeouts': {'textExec': None}})
        self.assertNotIn('textExec', app.user_timeout_overrides(app.LOCAL_ID))


if __name__ == '__main__': unittest.main()
