import ast
import base64
import threading
import unittest
import uuid
from pathlib import Path
from file_formats import validate_asset_media


class MusicUploadFormatTests(unittest.TestCase):
    def setUp(self):
        tree = ast.parse(Path('server.py').read_text(encoding='utf-8'))
        post = next(n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef) and n.name == '_route_post')
        branch = next(n for n in post.body if isinstance(n, ast.If) and ast.unparse(n.test) == "path == '/api/music'")
        wrapper = ast.parse('def upload(self, path, incoming, user):\n pass').body[0]
        wrapper.body = [branch]
        self.rows = []
        scope = dict(validate_asset_media=validate_asset_media, uuid=uuid, LOCK=threading.Lock(),
                     read_music=lambda: self.rows, write_music=lambda rows: setattr(self, 'rows', rows))
        exec(compile(ast.fix_missing_locations(ast.Module(body=[wrapper], type_ignores=[])), 'production-music-upload', 'exec'), scope)
        self.upload = scope['upload']

    def send_json(self, value, status=200):
        return value, status

    def request(self, data):
        return self.upload(self, '/api/music', {'name': 'test.wav', 'data': data},
                           {'id': 'alice', 'nickname': 'Alice', 'avatar': 'A'})

    def test_rejects_unsupported_or_disguised_audio_without_persistence(self):
        for data in ('', 'data:audio/ogg;base64,ZmFrZQ==', 'data:audio/mpeg;base64,ZmFrZQ==', 'data:image/png;base64,ZmFrZQ=='):
            with self.subTest(data=data):
                result, status = self.request(data)
                self.assertEqual(status, 400)
                self.assertEqual(result['error'], 'invalid_file_format')
                self.assertEqual(self.rows, [])

    def test_accepts_valid_wav_and_binds_owner(self):
        import struct
        pcm = bytes(1600)
        raw = b'RIFF' + struct.pack('<I', 36 + len(pcm)) + b'WAVEfmt ' + struct.pack('<IHHIIHH', 16, 1, 1, 8000, 16000, 2, 16) + b'data' + struct.pack('<I', len(pcm)) + pcm
        result, status = self.request('data:audio/wav;base64,' + base64.b64encode(raw).decode())
        self.assertEqual(status, 201)
        self.assertEqual(result['music']['ownerId'], 'alice')
        self.assertEqual(len(self.rows), 1)


if __name__ == '__main__':
    unittest.main()
