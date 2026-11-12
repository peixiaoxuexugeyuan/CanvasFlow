"""Launch the local service and open CanvasFlow in a desktop app window."""
import argparse
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import time
from urllib.request import build_opener, ProxyHandler
import webbrowser
from local_app import installation_id

ROOT = Path(__file__).resolve().parent


def available_port(preferred):
    for candidate in range(preferred, min(65536, preferred + 100)):
        with socket.socket() as probe:
            try: probe.bind(('127.0.0.1', candidate))
            except OSError: continue
            return candidate
    raise RuntimeError('没有可用的本地端口，请使用 --port 指定其他端口')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=5173)
    parser.add_argument('--no-open', action='store_true')
    args = parser.parse_args()
    if not 1 <= args.port <= 65535: parser.error('端口必须在 1–65535 之间')
    data = Path(os.environ.get('CANVASFLOW_DATA_DIR') or ROOT / 'server-data').resolve()
    expected = installation_id(ROOT, data)
    url = f'http://127.0.0.1:{args.port}'
    client = build_opener(ProxyHandler({}))

    def ready():
        try:
            with client.open(url + '/api/local/bootstrap', timeout=1) as response:
                payload = json.load(response)
                return isinstance(payload, dict) and payload.get('mode') == 'local' and payload.get('installationId') == expected
        except (OSError, ValueError):
            return False

    if not ready():
        args.port = available_port(args.port)
        url = f'http://127.0.0.1:{args.port}'
        logs = data / 'local-logs'
        logs.mkdir(parents=True, exist_ok=True)
        with (logs / 'server.log').open('ab') as output:
            process = subprocess.Popen([sys.executable, str(ROOT / 'server.py'), str(args.port)],
                                       cwd=ROOT, stdout=output, stderr=output,
                                       creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
        for _ in range(100):
            if ready():
                break
            if process.poll() is not None:
                raise RuntimeError('Local service failed to start. See server-data/local-logs/server.log')
            time.sleep(.1)
        else:
            raise RuntimeError('Local service startup timed out. See server-data/local-logs/server.log')
    if not args.no_open:
        candidates = [Path(os.environ.get(key, '')) / suffix
                      for key in ('ProgramFiles(x86)', 'ProgramFiles', 'LOCALAPPDATA')
                      for suffix in ('Microsoft/Edge/Application/msedge.exe', 'Google/Chrome/Application/chrome.exe')]
        browser = next((str(file) for file in candidates if file.is_file()), None)
        browser = browser or shutil.which('msedge') or shutil.which('chrome')
        if browser:
            subprocess.Popen([browser, '--app=' + url + '/', '--new-window'])
        else:
            webbrowser.open(url + '/')
    print(url + '/')


if __name__ == '__main__':
    main()
