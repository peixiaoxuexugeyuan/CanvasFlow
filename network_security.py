"""HTTP-only upstream requests, with credential-safe redirects."""
from urllib.parse import urlsplit
from urllib import request, error
from contextvars import ContextVar
from contextlib import contextmanager
import ipaddress
import socket
import http.client

_network_access = ContextVar('canvasflow_network_access', default=None)


class NetworkAccessError(ValueError):
    def __init__(self,message,status=403):super().__init__(message);self.status=status


def private_url(url):
    scheme,host,port=http_origin(url)
    if host=='localhost' or host.endswith(('.localhost','.local','.internal')):return True
    try:
        address=ipaddress.ip_address(host)
        return not (address.ipv4_mapped if isinstance(address,ipaddress.IPv6Address) and address.ipv4_mapped else address).is_global
    except ValueError:pass
    try:addresses=socket.getaddrinfo(host,port,type=socket.SOCK_STREAM)
    except socket.gaierror:return False
    return any(not ipaddress.ip_address(item[4][0]).is_global for item in addresses)


def validate_provider_access(role,url):
    try:http_origin(url)
    except error.URLError as problem:raise NetworkAccessError('模型地址必须是有效的 HTTP/HTTPS 地址',400) from problem
    if role!='admin' and private_url(url):raise NetworkAccessError('本机和局域网模型服务仅允许管理员接入')


@contextmanager
def network_access(role='user',trusted_origins=()):
    token=_network_access.set((role,set(trusted_origins)))
    try:yield
    finally:_network_access.reset(token)


def check_network_url(url):
    policy=_network_access.get()
    if policy and policy[0]!='admin' and http_origin(url) not in policy[1] and private_url(url):
        raise error.URLError('拒绝访问未经管理员配置的本机或局域网服务')


def check_connected_peer(connection,url):
    policy=_network_access.get()
    if not policy or policy[0]=='admin' or http_origin(url) in policy[1]:return
    # Validate the actual connection, so a second DNS lookup cannot rebind to a LAN address.
    peer=ipaddress.ip_address(connection.sock.getpeername()[0])
    if isinstance(peer,ipaddress.IPv6Address) and peer.ipv4_mapped:peer=peer.ipv4_mapped
    if not peer.is_global:
        if any(origin[1]==connection.host.lower() and origin[2]==connection.port for origin in policy[1]):return
        connection.close();raise error.URLError('拒绝连接未经授权的本机或局域网地址')


class CheckedHTTPConnection(http.client.HTTPConnection):
    def __init__(self,host,*,url,**options):super().__init__(host,**options);self.url=url
    def connect(self):super().connect();check_connected_peer(self,self.url)


class CheckedHTTPSConnection(http.client.HTTPSConnection):
    def __init__(self,host,*,url,**options):super().__init__(host,**options);self.url=url
    def connect(self):super().connect();check_connected_peer(self,self.url)


class CheckedHTTPHandler(request.HTTPHandler):
    def http_open(self,req):return self.do_open(lambda host,**options:CheckedHTTPConnection(host,url=req.full_url,**options),req)


class CheckedHTTPSHandler(request.HTTPSHandler):
    def https_open(self,req):return self.do_open(lambda host,**options:CheckedHTTPSConnection(host,url=req.full_url,**options),req,context=self._context)


class CheckedProxyHandler(request.ProxyHandler):
    def proxy_open(self,req,proxy,type):
        if private_url(req.full_url):return None
        return super().proxy_open(req,proxy,type)


def http_origin(url):
    try:
        parsed = urlsplit(url)
        if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password:
            raise ValueError('仅支持不含用户凭据的 HTTP/HTTPS 地址')
        return parsed.scheme, parsed.hostname.lower(), parsed.port or (443 if parsed.scheme == 'https' else 80)
    except (ValueError, TypeError) as problem:
        raise error.URLError('仅支持有效的 HTTP/HTTPS 地址') from problem


class SafeRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        destination = http_origin(newurl)
        check_network_url(newurl)
        redirected = super().redirect_request(req, fp, code, msg, headers, newurl)
        if redirected is not None and destination != http_origin(req.full_url):
            for name in list(redirected.headers) + list(redirected.unredirected_hdrs):
                if name.lower() in {'authorization', 'proxy-authorization', 'x-api-key', 'api-key', 'cookie'}:
                    redirected.remove_header(name)
        return redirected


def open_http_url(req, timeout=None):
    url=req.full_url if isinstance(req,request.Request) else req
    http_origin(url)
    check_network_url(url)
    handlers=[SafeRedirect(),CheckedHTTPHandler(),CheckedHTTPSHandler(),CheckedProxyHandler()]
    # An explicitly authorized LAN endpoint must stay on the LAN, not leak via a proxy.
    return request.build_opener(*handlers).open(req, timeout=timeout)
