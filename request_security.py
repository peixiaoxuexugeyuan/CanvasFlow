"""Pure request guards for the local HTTP server; no application data access."""
from pathlib import Path
from urllib.parse import urlsplit


class RequestBodyError(ValueError):
    pass


class StorageReadError(OSError):
    pass


def request_allowed(headers, method, port, allowed_hosts=()):
    """Reject DNS rebinding and cross-origin access to this account-free app."""
    if hasattr(headers, 'get_all') and any(len(headers.get_all(key, [])) > 1
                                           for key in ('Host', 'Origin', 'Content-Length')):
        return False
    host = str(headers.get('Host') or '')
    try:
        destination = urlsplit('http://' + host)
        hostname = destination.hostname
        destination_port = destination.port or 80
    except ValueError:
        return False
    if destination.username or destination.password or destination.path or destination.query or destination.fragment:
        return False
    if hostname not in {'127.0.0.1', 'localhost', '::1', *allowed_hosts} or destination_port != port:
        return False
    origin = headers.get('Origin')
    if origin:
        try:
            source = urlsplit(origin)
            if source.scheme != 'http' or source.username or source.password or source.path or source.query or source.fragment:
                return False
            if source.hostname != hostname or (source.port or (443 if source.scheme == 'https' else 80)) != destination_port:
                return False
        except ValueError:
            return False
    return str(headers.get('Sec-Fetch-Site') or '').lower() != 'cross-site'


def public_static_path(target, root):
    """Serve browser resources only, never source/config/backups/browser profiles."""
    try:
        relative = Path(target).resolve().relative_to(Path(root).resolve())
    except (OSError, ValueError):
        return False
    parts = relative.parts
    if not parts:
        # SimpleHTTPRequestHandler must resolve the document root before its index.
        return True
    suffix = relative.suffix.lower()
    browser_types = {'.js', '.mjs', '.css', '.html', '.svg', '.png', '.jpg', '.jpeg', '.webp',
                     '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.mp3', '.wav', '.m4a',
                     '.mp4', '.webm', '.mov', '.glb', '.gltf', '.bin', '.hdr', '.exr', '.wasm'}
    if len(parts) == 1:
        return not parts[0].startswith(('.', '_')) and suffix in {'.html', '.js', '.mjs', '.css', '.ico', '.svg'}
    if any(part.startswith('.') for part in parts):
        return False
    if parts[0] in {'assets', 'assets3d', 'vendor', 'camera-thumbs', 'emotion-poses'}:
        return suffix in browser_types or (parts[0] in {'assets3d', 'emotion-poses'} and suffix == '.json')
    if parts[0] == '_relight_presets' or parts[:2] == ('role-library', 'web'):
        return suffix in {'.png', '.jpg', '.jpeg', '.webp', '.svg'}
    if parts[0] == 'learn':
        return suffix in browser_types and (len(parts) == 2 or parts[1] == 'assets')
    return False


def byte_range(header, total):
    """Return (start, end, status); invalid byte ranges produce an empty 416."""
    full = (0, max(0, total - 1), 200)
    if not header or not header.startswith('bytes=') or ',' in header:
        return full
    spec = header[6:].strip()
    first, separator, last = spec.partition('-')
    if len(first)>20 or len(last)>20:return (0,-1,416)
    if not separator or not (first or last) or (first and not first.isdecimal()) or (last and not last.isdecimal()) or total <= 0:
        return (0, -1, 416)
    if first:
        start, end = int(first), min(int(last) if last else total - 1, total - 1)
    else:
        count = int(last)
        if count <= 0:
            return (0, -1, 416)
        start, end = max(0, total - count), total - 1
    return (start, end, 206) if 0 <= start <= end and start < total else (0, -1, 416)
