import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from release_security import PublicFiles


class ReleaseSecurityTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.root = Path(self.folder.name)
        self.public = self.root / 'public'
        self.public.mkdir()
        (self.public / 'index.html').write_text('release')
        self.files = {'index.html': hashlib.sha256(b'release').hexdigest()}
        self.manifest()

    def tearDown(self):
        self.folder.cleanup()

    def manifest(self):
        (self.root / 'release-manifest.json').write_text(json.dumps({'version':1,'files':self.files}))

    def test_only_manifest_public_files_are_allowed(self):
        (self.public / 'injected.js').write_text('not in manifest')
        release = PublicFiles(self.root)
        self.assertTrue(release.allowed(self.public))
        self.assertTrue(release.allowed(self.public / 'index.html'))
        self.assertFalse(release.allowed(self.public / 'injected.js'))
        self.assertFalse(release.allowed(self.root / 'server.py'))
        self.assertFalse(release.allowed(self.public / '../server.py'))

    def test_private_files_are_denied_even_if_listed(self):
        (self.public / 'auth.db').write_bytes(b'private')
        self.files['auth.db'] = hashlib.sha256(b'private').hexdigest()
        self.manifest()
        self.assertFalse(PublicFiles(self.root).allowed(self.public / 'auth.db'))

    def test_changed_release_fails_closed(self):
        (self.public / 'index.html').write_text('changed')
        with self.assertRaises(RuntimeError): PublicFiles(self.root)

    def test_missing_manifest_does_not_fall_back_to_original_source(self):
        (self.root / 'release-manifest.json').unlink()
        with self.assertRaises(FileNotFoundError): PublicFiles(self.root)

    def test_missing_public_directory_does_not_fall_back_to_original_source(self):
        import shutil
        shutil.rmtree(self.public)
        (self.root/'index.html').write_text('unprocessed original')
        with self.assertRaises(RuntimeError): PublicFiles(self.root)

    def test_missing_entry_fails_closed(self):
        self.files.clear(); self.manifest()
        with self.assertRaises(RuntimeError): PublicFiles(self.root)

    def test_manifest_cannot_escape_public_root(self):
        (self.root / 'private.js').write_bytes(b'private')
        self.files['../private.js']=hashlib.sha256(b'private').hexdigest();self.manifest()
        with self.assertRaises(RuntimeError): PublicFiles(self.root)

    def test_development_keeps_existing_static_routes(self):
        other=self.root/'development';other.mkdir()
        files=PublicFiles(other)
        self.assertFalse(files.release)
        self.assertTrue(files.allowed(other/'app.js'))
        self.assertFalse(files.allowed(other/'server.py'))

    def test_manifest_cannot_use_absolute_paths(self):
        self.files[str(self.public/'index.html')]=self.files['index.html'];self.manifest()
        with self.assertRaises(RuntimeError): PublicFiles(self.root)


if __name__ == '__main__': unittest.main()
