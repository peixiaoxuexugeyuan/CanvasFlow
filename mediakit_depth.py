"""Volcengine AI MediaKit depth-video jobs; only submit on explicit confirmation."""
from collections import deque
import hashlib
import json
import math
import mimetypes
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import threading
import time
from urllib import error, request
from urllib.parse import quote, urlsplit

from network_security import http_origin, network_access, open_http_url
from video_prompt import selected_video_file, source_video_file


API = 'https://mediakit.cn-beijing.volces.com'
PROTOCOL = 'mediakit-depth'
SUBMIT = '/api/v1/tools/video-depth'
UPLOAD = '/api/v1/tools-sync/request-media-upload-url'
TOKEN = re.compile(r'^[\w-]{1,100}$', re.ASCII)
ACTIVE = ('queued', 'running')


class DepthPaused(Exception):
    """The current durable stage will be resumed by the next server instance."""


class DepthError(ValueError):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def https_url(url):
    if isinstance(url, str) and len(url) <= 8192:
        try:
            if http_origin(url)[0] == 'https':
                return url
        except (ValueError, error.URLError):
            pass
    raise DepthError('需要有效的 HTTPS 视频地址')


def transport(key, path, payload=None):
    req = request.Request(API + path, data=json.dumps(payload).encode() if payload is not None else None,
                          headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'})
    req.same_origin_only = True
    try:
        with network_access('media'), open_http_url(req, timeout=60) as response:
            raw = response.read(512001)
        if len(raw) > 512000:
            raise ValueError
        result = json.loads(raw)
    except error.HTTPError as exc:
        raise DepthError(f'MediaKit 返回 HTTP {exc.code}，请检查服务凭证和任务状态', 502) from exc
    except (ValueError, OSError, error.URLError) as exc:
        raise DepthError('无法读取 MediaKit 响应，请检查连接', 502) from exc
    if (isinstance(result, dict) and path.startswith('/api/v1/tasks/')
            and result.get('status') in ('failed', 'cancelled', 'canceled', 'expired')):
        return result
    if not isinstance(result, dict) or result.get('success') is not True:
        raise DepthError('MediaKit 未接受该请求，请检查服务权限、余额和素材规格', 502)
    return result


def upload_media(key, path):
    ticket = transport(key, UPLOAD, {}).get('result') or {}
    uri = ticket.get('file_id')
    url = https_url(ticket.get('upload_url'))
    if not isinstance(uri, str) or not uri.startswith('mediakit://') or ticket.get('method', 'PUT') != 'PUT':
        raise DepthError('MediaKit 返回无效的上传凭据', 502)
    headers = {'Content-Type': mimetypes.guess_type(path.name)[0] or 'application/octet-stream',
               'Content-Length': str(path.stat().st_size)}
    extra = ticket.get('upload_headers') or []
    if isinstance(extra, dict):
        extra = [{'key': k, 'value': v} for k, v in extra.items()]
    for row in extra:
        if isinstance(row, dict):
            name, value = row.get('key') or row.get('name'), row.get('value')
            if isinstance(name, str) and isinstance(value, str) and name.lower() not in (
                    'authorization', 'proxy-authorization', 'host', 'content-length', 'cookie'):
                headers[name] = value
    try:
        with path.open('rb') as stream, network_access('media'):
            req = request.Request(url, data=stream, method='PUT', headers=headers)
            req.same_origin_only = True
            with open_http_url(req, timeout=240):
                pass
    except (ValueError, OSError, error.URLError) as exc:
        raise DepthError('源视频上传至 MediaKit 失败，请检查网络和文件大小', 502) from exc
    return uri


def executable(root, name):
    binary = name + ('.exe' if os.name == 'nt' else '')
    path = next((root / '.runtime/openfilm-ffmpeg').glob('*/bin/' + binary), None) or shutil.which(binary)
    if not path:
        raise DepthError('深度视频需要 FFmpeg 和 FFprobe，请安装完整运行组件')
    return str(path)


def run_media(command, timeout, stop=None):
    tool = Path(command[0]).stem
    try:
        with tempfile.TemporaryFile() as diagnostics:
            with subprocess.Popen(command, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=diagnostics,
                                  creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0)) as process:
                deadline = time.monotonic() + timeout
                try:
                    while True:
                        if stop and stop.is_set():
                            raise DepthPaused
                        remaining = deadline - time.monotonic()
                        if remaining <= 0:
                            raise DepthError(f'本机 {tool} 处理超时，请缩短视频片段后重试')
                        try:
                            stdout, _ = process.communicate(timeout=min(remaining, 0.5) if stop else remaining)
                            break
                        except subprocess.TimeoutExpired:
                            continue
                finally:
                    if process.poll() is None:
                        process.kill()
                        process.communicate()
                if process.returncode == 0:
                    return stdout
                diagnostics.seek(0, os.SEEK_END)
                diagnostics.seek(max(0, diagnostics.tell() - 4096))
                detail = diagnostics.read().decode('utf8', 'replace').lower()
        # FFmpeg output can include local paths and signed URLs. Report actionable categories.
        if 'no space left' in detail:
            hint = '本地磁盘空间不足'
        elif 'unknown encoder' in detail or 'encoder not found' in detail:
            hint = '本地运行组件缺少 H.264 编码器'
        elif 'permission denied' in detail:
            hint = '本地视频或临时目录没有读写权限'
        else:
            hint = '请检查视频文件是否完整以及编解码器是否可用'
        raise DepthError(f'本机 {tool} 处理失败（退出码 {process.returncode}），{hint}')
    except OSError as exc:
        raise DepthError(f'无法启动或读写本机 {tool}，请检查本地运行组件与临时目录权限') from exc


def validate_video(root, path, stop=None, start=0, end=None):
    info = run_media([executable(root, 'ffprobe'), '-v', 'error', '-protocol_whitelist', 'file,pipe',
                      '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration',
                      '-of', 'json', str(path)], 40, stop)
    try:
        parsed = json.loads(info)
        stream = parsed['streams'][0]
        width, height = int(stream['width']), int(stream['height'])
        duration = float(parsed['format']['duration'])
    except (KeyError, IndexError, TypeError, ValueError) as exc:
        raise DepthError('没有可识别的视频轨或时长') from exc
    if not math.isfinite(duration) or duration <= 0:
        raise DepthError('没有可识别的视频时长')
    interval = (min(end, duration) if end is not None else duration) - (start or 0)
    if interval <= 0:
        raise DepthError('所选时间段没有可截取的画面')
    if interval > 600:
        raise DepthError('火山深度动作捕捉的视频最长 10 分钟，请先截取片段')
    if min(width, height) <= 0:
        raise DepthError('无法读取源视频尺寸')
    # MediaKit documents 2K without specifying aspect ratios for this tool.
    if width * height > 2560 * 1440:
        raise DepthError(f'源视频 {width}×{height} 超过火山深度动作捕捉的 2K 限制，请先降低分辨率')


def playable_version(host, master, user_id, stop=None):
    with tempfile.TemporaryDirectory(prefix='canvasflow-depth-') as work:
        output = Path(work) / 'depth.mp4'
        run_media([executable(host.ROOT, 'ffmpeg'), '-nostdin', '-v', 'error',
                   '-protocol_whitelist', 'file,pipe', '-i', str(master), '-map', '0:v:0', '-an',
                   '-vf', 'pad=ceil(iw/2)*2:ceil(ih/2)*2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                   '-crf', '18', '-preset', 'veryfast', '-movflags', '+faststart', str(output)], 900, stop)
        if output.stat().st_size > host.MEDIA_MAX_BYTES:
            raise DepthError('深度视频超过本地媒体大小限制')
        return host.save_media_blob(output.read_bytes(), 'video/mp4', '深度动作捕捉.mp4', owner_id=user_id)['url']


def local_file(host, url, user_id):
    parsed = urlsplit(url)
    filename = parsed.path.removeprefix('/media/')
    if parsed.netloc or not parsed.path.startswith('/media/') or not host.MEDIA_SAFE_NAME.fullmatch(filename):
        raise DepthError('无效的本地视频地址')
    host.validate_new_media(user_id, url)
    file = host.resolve_media_file(filename)
    if not file:
        raise DepthError('源视频文件不存在')
    with file.open('rb') as stream:
        if not host.sniff_media_mime(stream.read(65536)).startswith('video/'):
            raise DepthError('所选文件没有可识别的视频内容')
    return file


class DepthService:
    """Persistent job stages distinguish a new submission from polling or local recovery."""
    def __init__(self, host):
        self.host = host
        self.lock = threading.RLock()
        self.queue = deque()
        self.scheduled = set()
        self.workers = set()
        self.stop = threading.Event()

    def resume(self):
        with self.host.LOCK:
            pending = [dict(job) for job in self.host.index_jobs().values()
                       if job.get('providerProtocol') == PROTOCOL and job.get('status') in ACTIVE]
        for job in pending:
            self.schedule(job)

    def close(self):
        with self.host.LOCK:
            self.stop.set()
        with self.lock:
            self.queue.clear()
            self.scheduled.clear()
            workers = tuple(self.workers)
        for worker in workers:
            worker.join()

    def check_active(self):
        if self.stop.is_set():
            raise DepthPaused

    def check_accepting(self):
        if self.stop.is_set():
            raise DepthError('本地服务正在关闭，请在重新打开画布后重试', 503)

    def credential(self, user_id, replacement=None):
        path = self.host.DATA_DIR / 'mediakit-credentials.json'
        with self.host.LOCK:
            self.check_accepting()
            rows = self.host.read_file(path, [])
            if replacement is not None:
                if not isinstance(replacement, str) or len(replacement) > 4096 or any(
                        not 32 < ord(c) < 127 for c in replacement):
                    raise DepthError('请输入有效的 MediaKit API Key')
                rows = [row for row in rows if row.get('userId') != user_id]
                if replacement:
                    rows.append({'userId': user_id, 'apiKey': replacement})
                self.host.write_file(path, rows)
                if os.name != 'nt':
                    path.chmod(0o600)
            return next((row.get('apiKey', '') for row in rows if row.get('userId') == user_id), '')

    def submit(self, data, user_id, workspace_id):
        source = data.get('sourceUrl')
        project, node, token = (data.get(key) for key in ('projectId', 'nodeId', 'requestId'))
        if not all(isinstance(v, str) and TOKEN.fullmatch(v) for v in (project, node, token)):
            raise DepthError('缺少项目、输出节点或请求标识')
        if not isinstance(source, str) or len(source) > 8192:
            raise DepthError('请选择源视频')
        if source.startswith('/media/'):
            local_file(self.host, source, user_id)
        else:
            https_url(source)
        job = {'kind': 'video', 'providerProtocol': PROTOCOL, 'simulated': False,
               'modelName': '深度动作捕捉', 'title': '深度动作捕捉', 'userId': user_id,
               'workspaceId': workspace_id, 'projectId': project, 'outputId': node,
               'sourceVideos': [source], 'status': 'queued', 'stage': 'uploading',
               'createdAt': self.host.now(), 'progress': 0}
        for key in ('start', 'end'):
            value = data.get(key)
            if value is not None:
                if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
                    raise DepthError('无效的视频截取区间')
                job[key] = value
        if 'end' in job and job['end'] <= job.get('start', 0):
            raise DepthError('截取结束时间应晚于开始时间')
        seed = json.dumps([user_id, workspace_id, project, token]).encode()
        job['id'] = 'job-depth-' + hashlib.sha256(seed).hexdigest()[:32]
        with self.host.LOCK:
            self.check_accepting()
            existing = self.host.index_jobs().get(job['id'])
            if existing:
                for key in ('sourceVideos', 'outputId', 'start', 'end'):
                    if existing.get(key) != job.get(key):
                        raise DepthError('同一请求标识已用于其他视频或区间', 409)
                job = dict(existing)
            else:
                if self.host.update_reserved():
                    raise DepthError('CanvasFlow 正在安装更新，请在重新打开应用后提交动作捕捉任务', 503)
                if not self.credential(user_id):
                    raise DepthError('请先配置火山引擎 AI MediaKit API Key')
                self.host.append_job(job)
        self.schedule(job)
        return job

    def recover(self, job):
        with self.host.LOCK:
            self.check_accepting()
            job = dict(self.host.index_jobs().get(job['id']) or job)
            if job['status'] == 'failed':
                if not job.get('recoverable') or not job.get('providerJobId'):
                    raise DepthError('该任务没有可继续取回的结果', 409)
                job.update(status='running', stage='recovering', error='', recoverable=False)
                self.host.append_job(job, depth_recovery=True)
        self.schedule(job)
        return job

    def schedule(self, job):
        if job['status'] not in ACTIVE:
            return
        key = job['id']
        with self.lock:
            if self.stop.is_set() or key in self.scheduled:
                return
            self.scheduled.add(key)
            self.queue.append(key)
            if len(self.workers) < 2:
                worker = threading.Thread(target=self._drain, daemon=True, name='CanvasFlow-MediaKit')
                self.workers.add(worker)
                worker.start()

    def _drain(self):
        while True:
            with self.lock:
                if self.stop.is_set() or not self.queue:
                    self.workers.discard(threading.current_thread())
                    return
                key = self.queue.popleft()
            try:
                with self.host.LOCK:
                    job = dict(self.host.index_jobs().get(key) or {})
                if job.get('status') in ACTIVE:
                    actor = self.host.STORAGE_ACTOR.set(job['userId'])
                    try:
                        self.process(job)
                    finally:
                        self.host.STORAGE_ACTOR.reset(actor)
            except Exception:
                # A failure writing storage must not consume a worker slot permanently.
                pass
            finally:
                with self.lock:
                    self.scheduled.discard(key)
            if not self.stop.is_set():
                try:
                    with self.host.LOCK:
                        latest = dict(self.host.index_jobs().get(key) or {})
                    if latest.get('stage') == 'recovering' and latest.get('status') == 'running':
                        self.schedule(latest)
                except (OSError, ValueError):
                    continue

    def _save(self, job, **fields):
        job.update(fields)
        self.host.append_job(job)

    def process(self, job):
        try:
            self.check_active()
            if not job.get('providerJobId'):
                if job['stage'] == 'submitting':
                    raise DepthError('上次提交结果未知。请先核对 MediaKit 任务记录，避免重复提交')
                self.submit_upstream(job)
            self.check_active()
            self.fetch_result(job)
        except DepthPaused:
            return
        except Exception as exc:
            if self.stop.is_set():
                return
            message = str(exc) if isinstance(exc, (DepthError, ValueError)) else '深度视频处理失败，请检查网络、存储空间及媒体文件'
            self._save(job, status='failed', stage='failed', error=message,
                       recoverable=bool(job.get('providerJobId')) and not job.get('upstreamFailed'))

    def submit_upstream(self, job):
        key = self.credential(job['userId'])
        if not key:
            raise DepthError('请先配置火山引擎 AI MediaKit API Key')
        executable(self.host.ROOT, 'ffmpeg')
        with source_video_file(job['sourceVideos'][0], job['userId'], check_media=self.host.validate_new_media,
                               resolve_media=self.host.resolve_media_file, media_opener=self.host.open_media_url,
                               size_limit=self.host.MEDIA_MAX_BYTES) as source:
            self.check_active()
            validate_video(self.host.ROOT, source, self.stop, job.get('start'), job.get('end'))
            with selected_video_file(source, self.host.ROOT, job.get('start'), job.get('end')) as selected:
                self.check_active()
                if selected != source:
                    validate_video(self.host.ROOT, selected, self.stop)
                file_id = upload_media(key, selected)
        self.check_active()
        self._save(job, status='running', stage='submitting')
        try:
            response = transport(key, SUBMIT, {'video_url': file_id, 'model': 'standard'})
            task_id = response.get('task_id')
            if not isinstance(task_id, str) or not TOKEN.fullmatch(task_id):
                raise DepthError('MediaKit 未返回有效任务标识', 502)
        except DepthError as exc:
            raise DepthError(str(exc) + '。请先核对火山任务记录，应用不会自动重复提交', 502) from exc
        self._save(job, stage='processing', providerJobId=task_id, submittedAt=self.host.now(),
                   depthSubmittedTime=time.time())

    def fetch_result(self, job):
        master_url = job.get('depthMasterUrl', '')
        master = self.host.resolve_media_file(master_url.removeprefix('/media/')) if master_url else None
        if not master:
            url = job.get('depthOriginalUrl')
            if not url or job.get('depthExpiresAt', 0) <= time.time():
                key = self.credential(job['userId'])
                if not key:
                    raise DepthError('请恢复当前账号的 MediaKit API Key 后继续取回')
                result = self.wait_for_result(key, job)
                url = https_url((result.get('result') or {}).get('video_url'))
                expires = result.get('expires_at')
                if isinstance(expires, (int, float)) and expires > 0 and expires <= time.time():
                    job['upstreamFailed'] = True
                    raise DepthError('火山深度视频的下载链接已过期，当前项目没有本地副本')
                if not isinstance(expires, (int, float)):
                    expires = job.get('depthSubmittedTime', time.time()) + 86400
                self._save(job, stage='downloading', depthOriginalUrl=url, depthExpiresAt=expires)
            self.check_active()
            try:
                saved = self.host.persist_media_url(url, name='depth-original.mp4')
            except ValueError as exc:
                raise DepthError('深度视频下载失败，可继续取回已有任务') from exc
            master = local_file(self.host, saved['url'], job['userId'])
            self._save(job, stage='transcoding', depthMasterUrl=saved['url'])
        self.check_active()
        video = playable_version(self.host, master, job['userId'], self.stop)
        self._save(job, status='completed', stage='completed', progress=100,
                   videoUrl=video, recoverable=False, finishedAt=self.host.now())

    def wait_for_result(self, key, job):
        for delay in range(360):
            self.check_active()
            result = transport(key, '/api/v1/tasks/' + quote(job['providerJobId'], safe=''))
            state = result.get('status')
            if state == 'completed':
                return result
            if state in ('failed', 'cancelled', 'canceled', 'expired'):
                job['upstreamFailed'] = True
                raise DepthError('MediaKit 任务失败或已过期，请在火山控制台查看详情')
            if self.stop.wait(min(12, 2 + delay)):
                raise DepthPaused
        raise DepthError('任务仍在处理，可稍后继续取回')

