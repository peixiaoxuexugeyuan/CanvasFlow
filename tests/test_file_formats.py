import base64
import json
import tempfile
import unittest
from pathlib import Path
from file_formats import validate_media_file,validate_asset_media


class FileFormatTests(unittest.TestCase):
    def setUp(self):
        self.directory=tempfile.TemporaryDirectory();self.root=Path(self.directory.name)
        box=lambda kind,body:(len(body)+8).to_bytes(4,'big')+kind+body
        container=lambda handler:box(b'ftyp',b'isom'+bytes(4))+box(b'moov',box(b'hdlr',bytes(8)+handler+bytes(4)))
        chunk=json.dumps({'asset':{'version':'2.0'},'meshes':[{}]}).encode();chunk+=b' '*(-len(chunk)%4)
        self.samples={'.png':base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7X8AAAAASUVORK5CYII='),
            '.jpg':b'\xff\xd8\xff'+bytes(30)+b'\xff\xd9', '.webp':b'RIFF'+(16).to_bytes(4,'little')+b'WEBPVP8L'+bytes(8),
            '.wav':b'RIFF'+(36).to_bytes(4,'little')+b'WAVEfmt '+bytes(12)+b'data'+bytes(12),
            '.mp3':b'\xff\xfb\x90\x00'+bytes(413), '.m4a':container(b'soun'), '.mp4':container(b'vide'), '.mov':container(b'vide'),
            '.webm':b'\x1aE\xdf\xa3'+b'webm'+bytes(4)+b'V_VP8',
            '.glb':b'glTF'+(2).to_bytes(4,'little')+(20+len(chunk)).to_bytes(4,'little')+len(chunk).to_bytes(4,'little')+b'JSON'+chunk}

    def tearDown(self):self.directory.cleanup()

    def file(self,ext,raw):
        path=self.root/('sample'+ext);path.write_bytes(raw);return path

    def test_supported_containers(self):
        for kind,exts in [('images',['.png','.jpg','.webp']),('videos',['.mp4','.mov','.webm']),('music',['.wav','.mp3','.m4a']),('models',['.glb'])]:
            for ext in exts:
                with self.subTest(kind=kind,ext=ext):validate_media_file(kind,self.file(ext,self.samples[ext]))

    def test_renamed_arbitrary_files_are_rejected(self):
        for kind,ext in [('images','.png'),('videos','.mp4'),('music','.mp3'),('models','.glb')]:
            with self.subTest(kind=kind):
                with self.assertRaises(ValueError):validate_media_file(kind,self.file(ext,b'<script>not real media</script>'))

    def test_wrong_category_and_unsupported_extensions(self):
        for kind,ext in [('images','.mp4'),('videos','.wav'),('music','.glb'),('models','.obj'),('images','.svg'),('music','.exe')]:
            with self.assertRaises(ValueError):validate_media_file(kind,self.file(ext,self.samples['.png']))

    def test_video_cannot_be_renamed_to_audio_container(self):
        with self.assertRaises(ValueError):validate_media_file('music',self.file('.m4a',self.samples['.mp4']))
        with self.assertRaises(ValueError):validate_media_file('videos',self.file('.mp4',self.samples['.m4a']))

    def test_asset_kind_must_match_media_contents(self):
        path=self.file('.png',self.samples['.png']);self.assertEqual(validate_asset_media('file',path),'image')
        with self.assertRaises(ValueError):validate_asset_media('audio',path)
        url='data:image/png;base64,'+base64.b64encode(self.samples['.png']).decode()
        self.assertEqual(validate_asset_media('image',data=url),'image')
        with self.assertRaises(ValueError):validate_asset_media('image',data='data:image/png;base64,ZmFrZQ==')


if __name__=='__main__':unittest.main()
