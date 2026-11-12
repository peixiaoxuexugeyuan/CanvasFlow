"""Opt-in real local OpenFilm smoke: CANVASFLOW_TEST_FILM_RUNTIME=1. No AI calls."""
import os
from pathlib import Path
import tempfile
import unittest
import re
import hashlib
import json
from urllib.request import urlopen
from urllib.parse import urlsplit
from film_workbench import FilmWorkbench


@unittest.skipUnless(os.environ.get('CANVASFLOW_TEST_FILM_RUNTIME') == '1', 'requires prepared OpenFilm runtime')
class FilmRuntimeIntegration(unittest.TestCase):
    def test_material_sync_conflicts_metadata_and_project_recycle(self):
        root=Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory(prefix='cf-film-sync-') as folder:
            manager=FilmWorkbench(root,folder)
            try:
                manager.call('w','open',projectKey='p',projectName='A')
                manager.call('w','open',projectKey='q',projectName='B')
                source=Path(folder)/'source.png';source.write_bytes(b'original')
                files=[{'path':str(source),'name':'source.png','sourceId':'image','metadata':{'category':'character','rating':4,'favorite':True}}]
                manager.call('w','import',projectKey='p',files=files)
                links=lambda:manager.call('w','advanced',projectKey='p',args={'action':'material_links'})['links']
                self.assertTrue(links()['image']['favorite']);self.assertEqual(links()['image']['rating'],4)
                rows=[{'id':'image','name':'renamed','category':'scene','rating':2,'favorite':False}]
                source.write_bytes(b'replacement')
                result=manager.call('w','import',projectKey='p',files=files,synchronize=True,syncRows=rows)
                self.assertEqual(result['updated'],1);self.assertEqual(links()['image']['name'],'renamed')
                copy=next((Path(folder)/'films').rglob('assets/source.png'));self.assertEqual(copy.read_bytes(),b'replacement')
                copy.write_bytes(b'manual');source.write_bytes(b'another replacement')
                result=manager.call('w','import',projectKey='p',files=files,synchronize=True,syncRows=rows)
                self.assertEqual(len(result['conflicts']),1);self.assertEqual(copy.read_bytes(),b'manual')
                manager.call('w','import',projectKey='p',files=[],synchronize=True,syncRows=[])
                self.assertTrue(links()['image']['sourceDeleted']);self.assertTrue(copy.exists())
                record=manager.archive_project('w','p','A')
                base=Path(folder)/'films'/hashlib.sha256(b'w').hexdigest()[:24]
                self.assertEqual(json.loads((base/'recycle'/record/'record.json').read_text())['projectId'],'p')
                self.assertEqual(next((base/'recycle'/record).rglob('assets/source.png')).read_bytes(),b'manual')
                self.assertFalse((base/'projects'/hashlib.sha256(b'p').hexdigest()[:24]).exists())
                self.assertIn(('w','q'),manager.workers)
                # Verify the documented offline recovery, including registry/settings and media bytes.
                archived=base/'recycle'/record
                project_hash=hashlib.sha256(b'p').hexdigest()[:24]
                for name in ('projects','scopes'):
                    original=base/name/project_hash
                    self.assertFalse(original.exists())
                    self.assertTrue(original.resolve().is_relative_to(base.resolve()))
                    (archived/name).rename(original)
                manager.call('w','open',projectKey='p',projectName='A')
                self.assertEqual(links()['image']['rating'],2)
                self.assertEqual(next((base/'projects'/project_hash).rglob('assets/source.png')).read_bytes(),b'manual')
            finally:manager.close()

    def test_workspaces_projects_import_reopen_and_shutdown(self):
        root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory(prefix='canvasflow-film-test-') as directory:
            manager = FilmWorkbench(root, directory)
            processes = []
            try:
                first = manager.call('workspace-a', 'open', projectKey='p', projectName='Film A')
                address = urlsplit(first['url'])
                self.assertEqual((address.scheme,address.hostname,address.path), ('http','127.0.0.1','/open'))
                with urlopen(first['url'], timeout=15) as response:
                    page = response.read().decode('utf8')
                adapter = re.search(r'/assets/canvasflow-layout-[a-f0-9]+\.js', page)
                self.assertIsNotNone(adapter)
                with urlopen(f'{address.scheme}://{address.netloc}{adapter.group()}', timeout=15) as response:
                    self.assertIn(b'canvasflow.editor.layout.v1', response.read())
                self.assertEqual(manager.call('workspace-a','open',projectKey='p')['projectId'],first['projectId'])
                second = manager.call('workspace-a','open',projectKey='q',projectName='Film B')
                third = manager.call('workspace-b','open',projectKey='p',projectName='Film C')
                self.assertEqual(len({first['projectId'],second['projectId'],third['projectId']}),3)
                self.assertEqual(len({urlsplit(p['url']).netloc for p in (first,second,third)}),3)
                source = Path(directory)/'source.png'
                source.write_bytes(b'fixture-copy-only')
                for _ in range(2):
                    imported = manager.call('workspace-a','import',projectKey='p',files=[{'path':str(source),'name':'source.png'}])
                    self.assertEqual(imported['imported'],1)
                copies = list((Path(directory)/'films').rglob('assets/source.png'))
                self.assertEqual(len(copies),1)
                self.assertEqual(copies[0].read_bytes(),source.read_bytes())
                processes = [worker[0] for worker in manager.workers.values()]
                manager.close()
                self.assertTrue(all(process.poll() is not None for process in processes))
                resumed = manager.call('workspace-a','open',projectKey='p')
                self.assertEqual(resumed['projectId'],first['projectId'])
                processes.extend(worker[0] for worker in manager.workers.values())
            finally:
                manager.close()
            self.assertTrue(all(process.poll() is not None for process in processes))


if __name__ == '__main__': unittest.main()
