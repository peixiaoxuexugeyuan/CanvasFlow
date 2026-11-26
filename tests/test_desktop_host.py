"""Focused desktop lifecycle tests; temporary data, no AI calls or user projects."""
import io
import importlib.util
import json
import os
from pathlib import Path
import queue
import socket
import subprocess
import sys
import tempfile
import textwrap
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import Request, build_opener, ProxyHandler
from unittest.mock import Mock, patch
from desktop_host import installation_id
from local_access import LocalAccess, identify, lock_data_directory
from local_app import installation_id as existing_id

ROOT = Path(__file__).resolve().parents[1]

def unused_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1',0))
        return sock.getsockname()[1]

def online(url, token=''):
    try:
        request = Request(url + '/api/local/bootstrap', headers={'X-CanvasFlow-Session':token})
        with build_opener(ProxyHandler({})).open(request,timeout=.5) as response:
            return response.status == 200
    except OSError: return False


class DesktopHostTests(unittest.TestCase):
    def test_busy_data_directory_stops_both_entries_before_running_job_recovery(self):
        native_entry = ("import runpy,sys;sys.path.insert(0,'.');"
                        "sys.argv=['backend_entry.py','serve','0'];"
                        "runpy.run_path('tools/native/backend_entry.py',run_name='__main__')")
        with tempfile.TemporaryDirectory() as folder, lock_data_directory(folder) as lease:
            root = Path(folder)
            job = root / 'blender' / ('blend-' + '1'*32) / 'job.json'
            job.parent.mkdir(parents=True)
            job.write_text(json.dumps({'id':job.parent.name, 'status':'running'}), encoding='utf-8')
            original = job.read_bytes()
            files = {entry.relative_to(root) for entry in root.rglob('*')}
            for args in (['server.py', '0'], ['-c', native_entry]):
                with self.subTest(entry=args[0]):
                    result = subprocess.run([sys.executable, *args], cwd=ROOT,
                        env=dict(os.environ, CANVASFLOW_DATA_DIR=folder, LOCALAPPDATA=folder),
                        capture_output=True, timeout=10)
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn(b'lock_data_directory', result.stderr)
                    self.assertEqual(job.read_bytes(), original)
                    self.assertEqual({entry.relative_to(root) for entry in root.rglob('*')}, files)

    def test_image_update_waits_through_job_persistence_and_blocks_new_work_only_at_handoff(self):
        with tempfile.TemporaryDirectory() as data, patch.dict(os.environ, CANVASFLOW_DATA_DIR=data):
            spec = importlib.util.spec_from_file_location('desktop_jobs_server', ROOT / 'server.py')
            server = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(server)
            entered, finish = threading.Event(), threading.Event()
            def persist_result(_payload):
                entered.set()
                finish.wait(3)
            server.IMAGE_JOB_PAYLOADS['test'] = {'job': {'id':'test'}}
            with patch.object(server, 'finish_background_image', persist_result):
                self.assertTrue(server.desktop_image_update_gate('reserve')['busy'])
                worker = threading.Thread(target=server.run_image_job_in_background, args=('test',))
                worker.start()
                try:
                    self.assertTrue(entered.wait(2))
                    self.assertTrue(server.desktop_image_update_gate('reserve')['busy'])
                finally:
                    finish.set()
                    worker.join(3)
            self.assertFalse(server.desktop_image_update_gate('reserve')['busy'])
            with self.assertRaisesRegex(ValueError, '正在安装更新'):
                server.create_image_job({}, {})
            with self.assertRaisesRegex(ValueError, '正在安装更新'):
                server.call_image_generation({}, 'test')
            server.desktop_image_update_gate('release')
            @server.track_image_call
            def failing_request():
                self.assertTrue(server.desktop_image_update_gate('reserve')['busy'])
                raise RuntimeError('intentional test exception')
            with self.assertRaises(RuntimeError):
                failing_request()
            self.assertFalse(server.desktop_image_update_gate('status')['busy'])
            handler = Mock(path='/api/local/desktop-update', headers={})
            handler.read_json.return_value = {'action': 'reserve'}
            with patch.dict(os.environ, CANVASFLOW_DESKTOP_UPDATE_TOKEN='isolated-test-token'):
                server.Handler._route_post(handler)
                handler.send_json.assert_called_with({'error': 'not_found'}, 404)
                handler.headers['X-CanvasFlow-Desktop'] = 'isolated-test-token'
                server.Handler._route_post(handler)
                handler.send_json.assert_called_with({'busy': False})
                with self.assertRaisesRegex(ValueError, '正在安装更新'):
                    server.create_image_job({}, {})
                handler.read_json.return_value = {'action': 'release'}
                server.Handler._route_post(handler)
                self.assertEqual(server.IMAGE_UPDATE_LEASE_UNTIL, 0)

    def test_identity_and_invalid_bootstrap_are_safe(self):
        with tempfile.TemporaryDirectory() as folder:
            self.assertEqual(installation_id(ROOT,folder),existing_id(ROOT,folder))
        for value in ([], {'mode':'local','installationId':'foreign'}, {'mode':'cloud','installationId':'expected'}):
            client=Mock(); payload=io.BytesIO(json.dumps(value).encode())
            payload.geturl = lambda: 'http://127.0.0.1:5173/api/local/identify'
            client.open.return_value=payload
            self.assertIsNone(identify(client,'http://127.0.0.1:5173','expected',b'fixture'))

    def test_pairing_ticket_is_short_lived_one_use_and_bound_to_running_service(self):
        a = LocalAccess(b'fixture', 'test-data', 5173)
        b = LocalAccess(b'fixture', 'test-data', 5173)
        link = a.browser_url('http://127.0.0.1:5173')
        ticket = link.split('#')[1]
        self.assertFalse(b.redeem(ticket))
        self.assertTrue(a.redeem(ticket))
        self.assertFalse(a.redeem(ticket))
        with patch('local_access.time.time', return_value=time.time()-180):
            expired = a.browser_url('http://127.0.0.1:5173').split('#')[1]
        self.assertFalse(a.redeem(expired))

    def launch(self, data, port):
        process=subprocess.Popen([sys.executable,'-u',str(ROOT/'desktop_host.py'),'--root',str(ROOT),'--data',str(data),'--port',str(port)],
            cwd=ROOT,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,
            env=dict(os.environ, LOCALAPPDATA=str(data)))
        self.addCleanup(self.finish,process)
        messages=queue.Queue()
        def read():
            for line in process.stdout:
                try:messages.put(json.loads(line))
                except ValueError:pass
        threading.Thread(target=read,daemon=True).start()
        value=messages.get(timeout=45)
        self.assertEqual(value.get('event'),'ready',value)
        return process,value

    @staticmethod
    def finish(process):
        if process.poll() is None:
            if process.stdin and not process.stdin.closed:process.stdin.close()
            try:process.wait(timeout=10)
            except subprocess.TimeoutExpired:process.kill();process.wait(timeout=5)
        for stream in (process.stdin,process.stdout,process.stderr):
            if stream and not stream.closed:stream.close()

    def assert_stopped(self,url,token):
        until=time.monotonic()+8
        while time.monotonic()<until and online(url,token):time.sleep(.1)
        self.assertFalse(online(url,token),'Owned server survived desktop shutdown')

    def test_owned_server_exits_on_parent_pipe_eof_and_reused_server_is_not_stopped(self):
        with tempfile.TemporaryDirectory() as folder:
            first,owned=self.launch(folder,unused_port())
            self.assertFalse(owned['reused']);self.assertTrue(online(owned['url'],owned['sessionToken']))
            self.assertFalse(online(owned['url']))
            reused,info=self.launch(folder,unused_port())
            self.assertEqual(owned['url'],info['url'])
            self.assertTrue(info['reused']);self.assertEqual(owned['sessionToken'],info['sessionToken'])
            self.finish(reused)
            self.assertTrue(online(owned['url'],owned['sessionToken']))
            self.finish(first)
            self.assert_stopped(owned['url'],owned['sessionToken'])

    def test_owned_backend_drains_paid_submission_before_job_object_closes(self):
        with tempfile.TemporaryDirectory() as folder:
            data = Path(folder)
            from mediakit_depth import PROTOCOL
            job = {'id': 'job-depth-test', 'userId': 'fixture', 'kind': 'video', 'status': 'queued',
                   'stage': 'uploading', 'providerProtocol': PROTOCOL,
                   'sourceVideos': ['https://example.invalid/fixture.mp4']}
            (data / 'jobs.jsonl').write_text(json.dumps(job) + '\n', encoding='utf-8')
            # Only this isolated child imports the stub. Uploaded media and network
            # transport are replaced before the real server resumes its queued job.
            fixture = data / 'sitecustomize.py'
            fixture.write_text(textwrap.dedent("""
                import os
                from pathlib import Path
                import sys
                if Path(sys.argv[0]).name == 'server.py':
                    from contextlib import nullcontext
                    import time
                    import mediakit_depth as depth
                    work = Path(os.environ['CANVASFLOW_DATA_DIR'])
                    depth.DepthService.credential = lambda *args: 'fixture'
                    depth.source_video_file = lambda *args, **kw: nullcontext(work/'fixture.mp4')
                    depth.selected_video_file = lambda source, *args: nullcontext(source)
                    depth.validate_video = lambda *args: None
                    depth.executable = lambda *args: None
                    depth.upload_media = lambda *args: 'mediakit://fixture'
                    def transport(key, path, payload=None):
                        assert path == depth.SUBMIT
                        (work/'accepted').touch()
                        deadline = time.monotonic() + 20
                        while not (work/'release').exists():
                            if time.monotonic() > deadline: raise RuntimeError('fixture deadline')
                            time.sleep(.02)
                        return {'task_id':'paid-fixture'}
                    depth.transport = transport
                    original_close = depth.DepthService.close
                    def close(service):
                        (work/'draining').touch()
                        original_close(service)
                    depth.DepthService.close = close
            """), encoding='utf-8')
            def marker(name):
                deadline = time.monotonic() + 8
                while not (data / name).exists() and time.monotonic() < deadline:
                    time.sleep(.02)
                self.assertTrue((data/name).exists(), name)
            with patch.dict(os.environ, PYTHONPATH=os.pathsep.join([folder, str(ROOT)])):
                host, info = self.launch(folder, unused_port())
            try:
                self.assertFalse(info['reused'])
                marker('accepted')
                host.stdin.close()
                marker('draining')
                self.assertIsNone(host.poll())
            finally:
                (data/'release').touch()
                self.finish(host)
            journal = [json.loads(line) for line in (data/'jobs.jsonl').read_text(encoding='utf-8').splitlines()]
            self.assertEqual(journal[-1]['providerJobId'], 'paid-fixture')

    @unittest.skipUnless(os.name=='nt','Windows Job Object integration')
    def test_supervisor_crash_closes_windows_job_and_server(self):
        with tempfile.TemporaryDirectory() as folder:
            process,info=self.launch(folder,unused_port())
            process.kill();process.wait(timeout=5)
            self.assert_stopped(info['url'],info['sessionToken'])

    def test_foreign_service_is_not_reused_or_terminated(self):
        class Foreign(BaseHTTPRequestHandler):
            def do_GET(self):
                body=b'{"mode":"local","installationId":"foreign"}'
                self.send_response(200);self.send_header('Content-Length',str(len(body)));self.end_headers();self.wfile.write(body)
            def log_message(self,*args):pass
        server=ThreadingHTTPServer(('127.0.0.1',0),Foreign)
        threading.Thread(target=server.serve_forever,daemon=True).start()
        try:
            with tempfile.TemporaryDirectory() as folder:
                port=server.server_port
                process,info=self.launch(folder,port)
                self.assertFalse(info['reused']);self.assertNotEqual(info['url'],f'http://127.0.0.1:{port}')
                self.finish(process);self.assert_stopped(info['url'],info['sessionToken'])
                self.assertTrue(online(f'http://127.0.0.1:{port}'))
        finally:server.shutdown();server.server_close()


if __name__=='__main__':unittest.main()
