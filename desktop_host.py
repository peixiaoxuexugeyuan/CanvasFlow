"""Pipe-owned local server supervisor for the desktop app (no browser launch)."""
import argparse
import ctypes
from ctypes import wintypes
import hashlib
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import threading
from local_access import discover_existing, identify, local_client, user_secret


class WindowsJob:
    """Closing this handle terminates the owned server and its Blender children."""
    def __init__(self):
        self.handle = None
        if os.name != 'nt':
            return
        kernel = ctypes.WinDLL('kernel32', use_last_error=True)
        class Limits(ctypes.Structure):
            _fields_ = [('processTime', ctypes.c_int64), ('jobTime', ctypes.c_int64),
                        ('flags', wintypes.DWORD), ('minWorkingSet', ctypes.c_size_t),
                        ('maxWorkingSet', ctypes.c_size_t), ('activeProcesses', wintypes.DWORD),
                        ('affinity', ctypes.c_size_t), ('priority', wintypes.DWORD), ('scheduling', wintypes.DWORD)]
        class Counters(ctypes.Structure):
            _fields_ = [(name, ctypes.c_uint64) for name in ('readOps','writeOps','otherOps','readBytes','writeBytes','otherBytes')]
        class ExtendedLimits(ctypes.Structure):
            _fields_ = [('basic', Limits), ('io', Counters), ('processMemory', ctypes.c_size_t),
                        ('jobMemory', ctypes.c_size_t), ('peakProcessMemory', ctypes.c_size_t), ('peakJobMemory', ctypes.c_size_t)]
        kernel.CreateJobObjectW.argtypes = [ctypes.c_void_p, wintypes.LPCWSTR]
        kernel.CreateJobObjectW.restype = wintypes.HANDLE
        kernel.SetInformationJobObject.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD]
        kernel.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
        kernel.CloseHandle.argtypes = [wintypes.HANDLE]
        self.kernel = kernel
        self.handle = kernel.CreateJobObjectW(None, None)
        if not self.handle:
            raise ctypes.WinError(ctypes.get_last_error())
        limits = ExtendedLimits()
        limits.basic.flags = 0x2000  # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        if not kernel.SetInformationJobObject(self.handle, 9, ctypes.byref(limits), ctypes.sizeof(limits)):
            error = ctypes.get_last_error()
            self.close()
            raise ctypes.WinError(error)

    def assign(self, process):
        if self.handle and not self.kernel.AssignProcessToJobObject(self.handle, wintypes.HANDLE(int(process._handle))):
            raise ctypes.WinError(ctypes.get_last_error())

    def close(self):
        if self.handle:
            self.kernel.CloseHandle(self.handle)
            self.handle = None


def installation_id(root, data):
    return hashlib.sha256('\0'.join(os.path.normcase(str(Path(p).resolve())) for p in (root, data)).encode()).hexdigest()[:24]


def free_port(preferred):
    for port in range(preferred, min(preferred + 100, 65536)):
        with socket.socket() as probe:
            try: probe.bind(('127.0.0.1', port))
            except OSError: continue
            return port
    raise RuntimeError('没有可用的本地端口')


def run(root, data, preferred):
    root, data = Path(root).resolve(), Path(data).resolve()
    native = root / 'CanvasFlowBackend.exe'
    if not native.is_file() and not (root / 'server.py').is_file():
        raise RuntimeError('应用后端文件缺失，请重新解压完整的桌面应用目录')
    data.mkdir(parents=True, exist_ok=True)
    stopped = threading.Event()
    def watch_parent():
        try:
            # The Electron parent keeps this anonymous pipe open for its lifetime.
            while sys.stdin.buffer.read(1):
                pass
        finally:
            stopped.set()
    threading.Thread(target=watch_parent, daemon=True).start()
    expected = installation_id(root, data)
    client = local_client()
    process = None
    job = None
    try:
        key = user_secret()
        url, access = discover_existing(client, preferred, data, expected, key)
        reused = access is not None
        if not reused:
            port = free_port(preferred)
            url = f'http://127.0.0.1:{port}'
            logs = data / 'local-logs'
            logs.mkdir(exist_ok=True)
            job = WindowsJob()
            with (logs/'server.log').open('ab') as output:
                command = [str(native), 'serve', str(port)] if native.is_file() else [sys.executable, '-u', str(root/'server.py'), str(port)]
                process = subprocess.Popen(command, cwd=root,
                    env=dict(os.environ, CANVASFLOW_DATA_DIR=str(data), PYTHONIOENCODING='utf-8',
                             CANVASFLOW_DESKTOP_PARENT_PIPE='1'),
                    stdin=subprocess.PIPE, stdout=output, stderr=output,
                    creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
            job.assign(process)
            for _ in range(300):
                if stopped.is_set(): return
                if process.poll() is not None:
                    # A simultaneous launcher may have acquired this data directory.
                    url, access = discover_existing(client, preferred, data, expected, key)
                    if access:
                        process.stdin.close()
                        process = None
                        reused = True
                        break
                    raise RuntimeError('本地服务启动失败，请查看数据目录的 local-logs/server.log')
                access = identify(client, url, expected, key)
                if access: break
                stopped.wait(.1)
            else:
                raise RuntimeError('本地服务启动超时，请查看数据目录的 local-logs/server.log')
        print(json.dumps({'event':'ready', 'url':url, 'reused':reused, 'serverPid':process.pid if process else None,
                          'sessionToken':access.desktop_token}), flush=True)
        missed_proofs = 0
        while not stopped.wait(2 if reused else .25):
            if reused:
                current = identify(client, url, expected, key)
                missed_proofs = missed_proofs + 1 if current is None else 0
                if missed_proofs >= 15 or (current and current.instance != access.instance):
                    raise RuntimeError('复用的本地服务已停止或重新启动，请重新打开 CanvasFlow。')
            elif process.poll() is not None:
                raise RuntimeError('本地服务意外退出，请查看 local-logs/server.log')
    finally:
        try:
            if process:
                process.stdin.close()
                # On a normal window close the server may still be recording an accepted
                # provider task. Keep the Job Object alive until server_close has drained it.
                if stopped.is_set():
                    process.wait()
        finally:
            if job: job.close()
            if process and process.poll() is None:
                process.terminate()
                try: process.wait(timeout=5)
                except subprocess.TimeoutExpired: process.kill(); process.wait(timeout=5)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', required=True)
    parser.add_argument('--data', required=True)
    parser.add_argument('--port', type=int, default=5173)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535: parser.error('无效端口')
    try:
        run(args.root, args.data, args.port)
    except Exception as error:
        print(json.dumps({'event':'error','message':str(error)}, ensure_ascii=True), flush=True)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
