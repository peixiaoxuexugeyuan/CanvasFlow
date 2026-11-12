"""Independent website preview protocol checks, on a synthetic static root."""
import importlib.util
import socket
import tempfile
import threading
import unittest
from pathlib import Path

SITE = Path(__file__).resolve().parents[2] / '发布页'


@unittest.skipUnless((SITE / 'preview_server.py').exists(), 'Independent website is not in this checkout')
class PreviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location('public_preview_fixture', SITE / 'preview_server.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        cls.data = tempfile.TemporaryDirectory(prefix='canvasflow-site-fixture-')
        module.ROOT = Path(cls.data.name)
        (module.ROOT / 'learn/assets').mkdir(parents=True)
        for name in ('index.html','learn/index.html','learn/assets/test.js','learn/assets/test.js.orig'):
            (module.ROOT / name).write_text('fixture', encoding='utf-8')
        class Quiet(module.Preview):
            def log_message(self, *args): pass
        cls.http = module.ThreadingHTTPServer(('127.0.0.1', 0), Quiet)
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown(); cls.http.server_close(); cls.thread.join(); cls.data.cleanup()

    def request(self, method, path):
        with socket.create_connection(('127.0.0.1', self.http.server_port), timeout=5) as client:
            client.sendall(f'{method} {path} HTTP/1.0\r\nHost: localhost\r\n\r\n'.encode())
            parts=[]
            while chunk := client.recv(65536): parts.append(chunk)
        headers, body = b''.join(parts).split(b'\r\n\r\n', 1)
        return int(headers.split()[1]), headers, body

    def test_head_has_get_headers_without_body(self):
        for path in ('/','/learn/zh-CN','/learn/assets/test.js','/assets/test.js'):
            get = self.request('GET',path); head = self.request('HEAD',path)
            self.assertEqual(get[0],200); self.assertEqual(head[0],200)
            self.assertEqual(get[2],b'fixture'); self.assertEqual(head[2],b'')
            self.assertIn(b'Content-Length: 7',head[1])

    def test_private_backups_and_traversals_are_blocked(self):
        for path in ('/learn/assets/test.js.orig','/assets/test.js.orig','/assets/test.js.%6frig',
                     '/assets/test.js.ORIG','/preview_server.py','/assets/../index.html'):
            self.assertEqual(self.request('GET',path)[0],404,path)
            head=self.request('HEAD',path);self.assertEqual(head[0],404,path);self.assertEqual(head[2],b'')

    def test_release_assets_do_not_contain_backup_files(self):
        self.assertEqual(list((SITE / 'learn/assets').glob('*.orig')),[])


if __name__ == '__main__': unittest.main()
