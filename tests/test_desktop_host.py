"""Focused desktop lifecycle tests; temporary data, no AI calls or user projects."""
import io
import json
import os
from pathlib import Path
import queue
import socket
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.request import build_opener, ProxyHandler
from unittest.mock import Mock
from desktop_host import bootstrap, installation_id
from local_app import installation_id as existing_id

ROOT = Path(__file__).resolve().parents[1]

def unused_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1',0))
        return sock.getsockname()[1]

def online(url):
    try:
        with build_opener(ProxyHandler({})).open(url+'/api/local/bootstrap',timeout=.5) as response:
            return response.status == 200
    except OSError: return False


class DesktopHostTests(unittest.TestCase):
    def test_identity_and_invalid_bootstrap_are_safe(self):
        with tempfile.TemporaryDirectory() as folder:
            self.assertEqual(installation_id(ROOT,folder),existing_id(ROOT,folder))
        for value in ([], {'mode':'local','installationId':'foreign'}, {'mode':'cloud','installationId':'expected'}):
            client=Mock(); client.open.return_value=io.BytesIO(json.dumps(value).encode())
            self.assertFalse(bootstrap(client,'http://127.0.0.1:5173','expected'))

    def launch(self, data, port):
        process=subprocess.Popen([sys.executable,'-u',str(ROOT/'desktop_host.py'),'--root',str(ROOT),'--data',str(data),'--port',str(port)],
            cwd=ROOT,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
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

    def assert_stopped(self,url):
        until=time.monotonic()+8
        while time.monotonic()<until and online(url):time.sleep(.1)
        self.assertFalse(online(url),'Owned server survived desktop shutdown')

    def test_owned_server_exits_on_parent_pipe_eof_and_reused_server_is_not_stopped(self):
        with tempfile.TemporaryDirectory() as folder:
            first,owned=self.launch(folder,unused_port())
            self.assertFalse(owned['reused']);self.assertTrue(online(owned['url']))
            reused,info=self.launch(folder,int(owned['url'].rsplit(':',1)[1]))
            self.assertTrue(info['reused'])
            self.finish(reused)
            self.assertTrue(online(owned['url']))
            self.finish(first)
            self.assert_stopped(owned['url'])

    @unittest.skipUnless(os.name=='nt','Windows Job Object integration')
    def test_supervisor_crash_closes_windows_job_and_server(self):
        with tempfile.TemporaryDirectory() as folder:
            process,info=self.launch(folder,unused_port())
            process.kill();process.wait(timeout=5)
            self.assert_stopped(info['url'])

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
                self.finish(process);self.assert_stopped(info['url'])
                self.assertTrue(online(f'http://127.0.0.1:{port}'))
        finally:server.shutdown();server.server_close()


if __name__=='__main__':unittest.main()
