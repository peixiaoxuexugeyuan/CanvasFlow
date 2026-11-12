import io
import unittest
from urllib.request import Request
from urllib.error import URLError
from network_security import SafeRedirect, http_origin, open_http_url
from network_security import validate_provider_access,network_access,check_network_url,NetworkAccessError
from unittest.mock import patch
from network_security import CheckedHTTPConnection
import http.client
import threading
from http.server import HTTPServer,BaseHTTPRequestHandler


class NetworkSecurityTests(unittest.TestCase):
    def test_non_http_schemes_and_embedded_credentials_are_rejected_without_io(self):
        for url in ('file:///C:/secret.txt','ftp://example.com/private','https://user:password@example.com','http://[broken','data:text/plain,secret'):
            with self.assertRaises(URLError): open_http_url(url)

    def test_redirect_to_a_different_origin_drops_provider_credentials(self):
        req=Request('https://api.example.com/models',headers={'Authorization':'Bearer fake','X-API-Key':'fake','Cookie':'fake','Accept':'application/json'})
        moved=SafeRedirect().redirect_request(req,io.BytesIO(),302,'Found',{},'https://cdn.example.com/models')
        names={key.lower() for key in moved.headers}
        self.assertFalse(names & {'authorization','x-api-key','cookie'})
        self.assertEqual(moved.get_header('Accept'),'application/json')

    def test_same_origin_redirect_keeps_credentials(self):
        req=Request('https://api.example.com/models',headers={'Authorization':'Bearer fake'})
        moved=SafeRedirect().redirect_request(req,io.BytesIO(),302,'Found',{},'https://api.example.com/v1/models')
        self.assertEqual(moved.get_header('Authorization'),'Bearer fake')

    def test_https_downgrade_and_different_ports_drop_credentials(self):
        for url in ('http://api.example.com/models','https://api.example.com:8443/models'):
            req=Request('https://api.example.com/models',headers={'Authorization':'Bearer fake'})
            moved=SafeRedirect().redirect_request(req,io.BytesIO(),302,'Found',{},url)
            self.assertIsNone(moved.get_header('Authorization'))

    def test_redirect_cannot_switch_to_a_file_url(self):
        with self.assertRaises(URLError):
            SafeRedirect().redirect_request(Request('https://api.example.com'),io.BytesIO(),302,'Found',{},'file:///C:/secret.txt')

    def test_local_and_lan_provider_configuration_is_admin_only(self):
        for url in ('http://localhost:8000/v1','http://127.0.0.1:8000/v1','http://192.168.1.2/v1','http://10.1.2.3/v1','http://[::1]/v1','http://169.254.169.254/latest'):
            for role in ('user','vip'):
                with self.assertRaises(NetworkAccessError):validate_provider_access(role,url)
            validate_provider_access('admin',url)

    def test_hostname_resolving_to_private_network_is_also_restricted(self):
        with patch('network_security.socket.getaddrinfo',return_value=[(2,1,6,'',('10.0.0.8',80))]):
            with self.assertRaises(NetworkAccessError):validate_provider_access('vip','http://model.example/v1')
        with patch('network_security.socket.getaddrinfo',return_value=[(2,1,6,'',('8.8.8.8',80))]):
            validate_provider_access('vip','http://model.example/v1')

    def test_public_provider_redirect_cannot_enter_untrusted_lan(self):
        with network_access('user'):
            with self.assertRaises(URLError):SafeRedirect().redirect_request(Request('https://api.example.com'),io.BytesIO(),302,'Found',{},'http://127.0.0.1:8000/secret')

    def test_only_explicit_admin_configured_origin_is_trusted_for_regular_usage(self):
        with network_access('user',{http_origin('http://127.0.0.1:8000/v1')}):
            check_network_url('http://127.0.0.1:8000/models')
            with self.assertRaises(URLError):check_network_url('http://127.0.0.1:9000/models')

    def test_connected_peer_blocks_dns_rebinding_before_http_headers(self):
        class Socket:
            def getpeername(self):return ('127.0.0.1',8000)
            def close(self):pass
        def connect(connection):connection.sock=Socket()
        with network_access('user'),patch.object(http.client.HTTPConnection,'connect',connect):
            connection=CheckedHTTPConnection('public.example',url='http://public.example/v1')
            with self.assertRaises(URLError):connection.connect()
            self.assertIsNone(connection.sock)

    def test_guarded_opener_really_handles_http_connections(self):
        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):self.send_response(200);self.end_headers();self.wfile.write(b'isolated')
            def log_message(self,*args):pass
        server=HTTPServer(('127.0.0.1',0),Handler);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
        try:
            with network_access('admin'),open_http_url(f'http://127.0.0.1:{server.server_port}/'):pass
        finally:server.shutdown();server.server_close();thread.join()


if __name__=='__main__': unittest.main()
