"""Authenticate a loopback CanvasFlow process and its local clients."""
import base64
import hashlib
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import tempfile
import threading
import time
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener

from provider_credentials import _transform

# The compiled launcher imports server before invoking its main entry.
NATIVE_SERVER_START = False


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def local_client():
    return build_opener(ProxyHandler({}), NoRedirect())


def user_secret():
    profile = Path(os.environ.get('LOCALAPPDATA') or os.environ.get('XDG_STATE_HOME') or Path.home() / '.local' / 'state')
    directory = profile / 'CanvasFlow' / 'access'
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    key_file = directory / 'identity.key'
    if not key_file.exists():
        secret = secrets.token_bytes(32)
        protected = _transform(secret, True) if os.name == 'nt' else secret
        with tempfile.NamedTemporaryFile(dir=directory, delete=False) as handle:
            temp = Path(handle.name)
            handle.write(protected)
        try:
            os.link(temp, key_file)
        except FileExistsError:
            pass
        finally:
            temp.unlink(missing_ok=True)
    raw = key_file.read_bytes()
    key = _transform(raw, False) if os.name == 'nt' else raw
    if len(key) != 32:
        raise RuntimeError('本机身份文件无效，无法连接服务')
    return key


def discover_existing(client, preferred, data, installation, key):
    """The lock file is a port hint only. Authenticate every candidate."""
    ports = [preferred]
    try:
        with (Path(data) / '.local-service.lock').open('rb') as file:
            file.seek(1)  # byte zero is reserved for the OS file lock
            port = int(file.read(6))
        if 1 <= port <= 65535 and port != preferred:
            ports.insert(0, port)
    except (OSError, ValueError):
        pass
    for port in ports:
        url = f'http://127.0.0.1:{port}'
        access = identify(client, url, installation, key)
        if access:
            return url, access
        # An older version can still be writing this same database. Do not
        # reuse it as a trusted backend or start a second writer beside it.
        try:
            with client.open(url + '/api/local/bootstrap', timeout=.4) as response:
                old = json.loads(response.read(2048))
            if isinstance(old, dict) and old.get('mode') == 'local' and old.get('installationId') == installation:
                raise RuntimeError('旧版 CanvasFlow 服务仍在使用此数据目录，请先关闭它，再打开新版本。')
        except (OSError, ValueError):
            pass
    return f'http://127.0.0.1:{preferred}', None


def set_service_port(lease, port):
    lease.seek(0)
    lease.truncate()
    lease.write(b' ' + str(port).encode('ascii'))
    lease.flush()


def lock_data_directory(data):
    """Keep one server per data directory, including if the preferred port moves."""
    file = (Path(data) / '.local-service.lock').open('a+b')
    try:
        file.seek(0)
        if os.name == 'nt':
            import msvcrt
            msvcrt.locking(file.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(file.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError as error:
        file.close()
        raise RuntimeError('此数据目录已有 CanvasFlow 服务在使用，或无法写入启动状态。') from error
    return file


class LocalAccess:
    def __init__(self, key, installation, port, instance=None):
        self.key = key
        self.instance = instance or secrets.token_hex(24)
        self.scope = f'{installation}:{port}:{self.instance}'
        self.desktop_token = self.sign('desktop')
        self.browser_token = self.sign('browser')
        self.basic = 'Basic ' + base64.b64encode(('canvasflow:' + self.browser_token).encode()).decode()
        self.redeemed = {}
        self.lock = threading.Lock()

    def sign(self, purpose):
        return hmac.new(self.key, f'{self.scope}:{purpose}'.encode(), hashlib.sha256).hexdigest()

    def challenge(self, nonce):
        return {'instance': self.instance, 'proof': self.sign('proof:' + nonce)}

    def browser_url(self, origin):
        serial = f'{int(time.time())}.{secrets.token_hex(12)}'
        ticket = serial + '.' + self.sign('ticket:' + serial)
        return origin + '/local-connect#' + ticket

    def redeem(self, ticket):
        if not isinstance(ticket, str) or not re.fullmatch(r'[0-9]{10,11}\.[0-9a-f]{24}\.[0-9a-f]{64}', ticket):
            return False
        serial, signature = ticket.rsplit('.', 1)
        issued = int(serial.split('.')[0])
        now = time.time()
        if not 0 <= now - issued < 120 or not hmac.compare_digest(self.sign('ticket:' + serial), signature):
            return False
        with self.lock:
            self.redeemed = {s: end for s, end in self.redeemed.items() if end > now}
            if serial in self.redeemed:
                return False
            self.redeemed[serial] = issued + 120
            return True

    def accepts(self, headers):
        return (hmac.compare_digest(self.desktop_token.encode(), headers.get('X-CanvasFlow-Session', '').encode())
                or hmac.compare_digest(self.basic.encode(), headers.get('Authorization', '').encode()))


def identify(client, url, installation, key):
    """Mutual discovery never sends an access credential to an unverified listener."""
    nonce = secrets.token_hex(32)
    request = Request(url + '/api/local/identify', headers={'X-CanvasFlow-Challenge': nonce})
    try:
        with client.open(request, timeout=.8) as response:
            if response.geturl() != request.full_url:
                return None
            payload = json.loads(response.read(2048))
        if not isinstance(payload, dict) or not re.fullmatch(r'[a-f0-9]{48}', str(payload.get('instance', ''))):
            return None
        access = LocalAccess(key, installation, int(url.rsplit(':', 1)[1]), payload['instance'])
        proof = payload.get('proof')
        if isinstance(proof, str) and hmac.compare_digest(access.sign('proof:' + nonce).encode(), proof.encode()):
            return access
    except (OSError, ValueError):
        pass
    return None


CONNECT_PAGE = """<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><meta name="referrer" content="no-referrer">
<title>打开 CanvasFlow</title><body><p id="status">正在连接本机 CanvasFlow…</p><script>
(async () => {
  const ticket = location.hash.slice(1);
  const project = new URLSearchParams(location.search).get('project');
  history.replaceState(null, '', '/local-connect');
  const status = document.getElementById('status');
  try {
    if (!ticket) throw Error();
    const exchange = await fetch('/api/local/pair', {method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ticket}), redirect:'error', cache:'no-store'});
    if (!exchange.ok) throw Error();
    const {password} = await exchange.json();
    // Seed the browser's origin-scoped HTTP authentication cache at a root-level path.
    // Cookies for loopback hosts would also be sent to unrelated ports.
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/local-session', true, 'canvasflow', password);
    xhr.onload = () => { if (xhr.status === 200) location.replace(project ? '/?project=' + encodeURIComponent(project) : '/'); else failed(); };
    xhr.onerror = failed;
    xhr.send();
  } catch { failed(); }
  function failed() { status.textContent = '请从 CanvasFlow 启动器重新打开工作台，生成新的本机访问链接。'; }
})();
</script></body></html>"""

