"""Prepare canvas video clips and submit them to declared video-understanding transports."""
import base64
from contextlib import contextmanager
import json
from http.client import HTTPException
import math
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import time
from urllib import error, request
from urllib.parse import urlsplit

from file_formats import validate_asset_media


INSTRUCTION = ('分析所附视频，按画面中动作发生的先后顺序写出可直接用于视频生成的中文提示词。'
               '描述主体、环境、动作、镜头运动、景别、光线与节奏。发生明显切镜时分镜描述，'
               '单镜头直接写一段；只写有依据的细节，不猜测原作者的提示词，仅输出提示词正文。')
# Keep the complete JSON request below the 20 MB limit of older compatible endpoints.
INLINE_LIMIT = 14 * 1024 * 1024
VIDEO_MIMES = {'.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime'}
# Leave headroom for JSON framing and the prompt in the existing 8 MB text endpoint.
FRAME_DATA_LIMIT = 6_000_000
MAX_FRAME_COUNT = 30
FRAME_PREFIX = 'data:image/jpeg;base64,'


class VideoServiceError(RuntimeError):
    pass


@contextmanager
def source_video_file(value, user_id, *, check_media, resolve_media, media_opener, size_limit):
    """Resolve an owned local asset or temporarily stage a bounded remote video."""
    if not isinstance(value, str) or not value or len(value) > 8192:
        raise ValueError('请选择有效的视频素材')
    parts = urlsplit(value)
    if value.startswith('/media/'):
        check_media(user_id, value)
        path = resolve_media(parts.path.removeprefix('/media/'))
        if not path or path.stat().st_size > size_limit:
            raise ValueError('本地视频不存在或超过大小限制')
        yield path
        return
    _origin(value)
    req = request.Request(value, headers={'User-Agent':'CanvasFlow/1.0', 'Accept':'video/*'})
    with tempfile.TemporaryDirectory(prefix='canvasflow-input-') as folder:
        try:
            with media_opener(req, timeout=180) as stream:
                declared = stream.headers.get('Content-Length', '')
                if declared.isdigit() and int(declared) > size_limit:
                    raise ValueError('视频文件超过大小限制')
                mime = stream.headers.get('Content-Type', '').split(';')[0].strip().lower()
                ext = next((key for key, val in VIDEO_MIMES.items() if val == mime), Path(parts.path).suffix.lower())
                path = Path(folder) / ('source' + (ext if ext in VIDEO_MIMES else '.mp4'))
                total = 0
                with path.open('wb') as out:
                    while chunk := stream.read(1024 * 1024):
                        total += len(chunk)
                        if total > size_limit:
                            raise ValueError('视频文件超过大小限制')
                        out.write(chunk)
                if declared.isdigit() and int(declared) != total:
                    raise ValueError('视频文件传输不完整')
        except (error.URLError, OSError, HTTPException):
            raise ValueError('无法读取远程视频，请下载后导入画布') from None
        yield path


def video_transport(entry):
    text_params = (entry.get('modelParams') or {}).get('text') or {}
    selected = text_params.get('videoInput')
    if selected in ('gemini-native', 'chat-video'):
        return selected
    if selected == 'disabled':
        return ''
    host = urlsplit(entry.get('baseUrl') or '').hostname
    model = str(entry.get('model') or '').removeprefix('models/').lower()
    if (host == 'generativelanguage.googleapis.com' and model.startswith('gemini-')
            and not any(word in model for word in ('tts', 'image', 'embedding', 'audio', 'robotics'))):
        return 'gemini-native'
    return ''


def _time_value(value):
    try:
        result = float(value)
    except (TypeError, ValueError):
        raise ValueError('视频截取时间无效') from None
    if isinstance(value, bool) or not math.isfinite(result) or result < 0:
        raise ValueError('视频截取时间无效')
    return result


def _media_binary(runtime_root, name):
    runtime = Path(runtime_root) / '.runtime' / 'openfilm-ffmpeg'
    bundled = next((p for p in runtime.glob('*/bin/' + name + '*') if p.name in (name, name + '.exe')), None)
    binary = bundled or shutil.which(name)
    if not binary:
        raise ValueError('本地视频处理需要 FFmpeg 和 FFprobe，请安装成片运行组件后重试')
    return str(binary)


def validate_frame_images(frames):
    """Sampled frames are transient inline images; they don't belong in project media."""
    if not isinstance(frames, list) or not 1 <= len(frames) <= MAX_FRAME_COUNT:
        raise ValueError(f'视频反推需要 1 到 {MAX_FRAME_COUNT} 张截取画面')
    if any(not isinstance(frame, str) or not frame.startswith(FRAME_PREFIX) for frame in frames):
        raise ValueError('截取画面必须为 JPEG 图片')
    if sum(map(len, frames)) > FRAME_DATA_LIMIT:
        raise ValueError('所选视频帧超过传输上限，请减少帧数后重试')
    for frame in frames:
        validate_asset_media('image', data=frame)


def extract_frames(path, runtime_root, start=None, end=None, count=None):
    """Sample the displayed frames at evenly spaced times on the source timeline."""
    validate_asset_media('video', path=path)
    if count is not None and (type(count) is not int or not 1 <= count <= MAX_FRAME_COUNT):
        raise ValueError(f'截取帧数必须为 1 到 {MAX_FRAME_COUNT} 之间的整数')
    if start is not None:
        start = _time_value(start)
    if end is not None:
        end = _time_value(end)
    quiet = dict(stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                 check=True, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
    input_flags = ['-v', 'error', '-protocol_whitelist', 'file,pipe']
    try:
        probe = subprocess.run([_media_binary(runtime_root, 'ffprobe'), *input_flags, '-select_streams', 'v:0',
                                '-show_entries', 'stream=duration:format=duration', '-of', 'json', str(path)],
                               timeout=30, **quiet)
        metadata = json.loads(probe.stdout)
        duration = metadata['streams'][0].get('duration')
        if duration in (None, '', 'N/A'):
            duration = metadata.get('format', {}).get('duration')
        duration = _time_value(duration)
    except (OSError, subprocess.SubprocessError, KeyError, IndexError, TypeError, ValueError):
        raise ValueError('无法读取视频时长，请检查视频和本机 FFprobe') from None
    start = start or 0
    end = min(duration, end) if end is not None else duration
    if end <= start:
        raise ValueError('所选时间段没有可截取的画面')
    count = count or max(2, min(12, math.ceil((end - start) * 2)))
    times = [start + (i + 0.5) * (end - start) / count for i in range(count)]
    images = []
    ffmpeg = _media_binary(runtime_root, 'ffmpeg')
    deadline = time.monotonic() + 120
    remaining_bytes = FRAME_DATA_LIMIT
    for timestamp in times:
        # Seeking to the previous keyframe keeps the frame displayed at this time,
        # even for low-FPS clips whose last frame starts before the final sample.
        budget = remaining_bytes // (count - len(images))
        for side, quality in ((768, 6), (576, 10), (384, 16), (192, 24)):
            args = [ffmpeg, *input_flags, '-nostdin', '-ss', f'{timestamp:.9f}', '-noaccurate_seek', '-i', str(path),
                    '-map', '0:v:0', '-an', '-vf',
                    "tpad=stop_mode=clone:stop_duration=1,fps=10:start_time=0:round=up,"
                    f"scale='min(iw,{side})':'min(ih,{side})':force_original_aspect_ratio=decrease",
                    '-frames:v', '1', '-c:v', 'mjpeg', '-q:v', str(quality), '-f', 'image2pipe', 'pipe:1']
            try:
                jpeg = subprocess.run(args, timeout=max(0.01, min(30, deadline - time.monotonic())), **quiet).stdout
            except (OSError, subprocess.SubprocessError):
                raise ValueError('读取视频帧失败或超时，请缩短所选片段后重试') from None
            if not jpeg.startswith(b'\xff\xd8') or not jpeg.endswith(b'\xff\xd9'):
                raise ValueError('无法解码所选时刻的视频画面')
            if len(FRAME_PREFIX) + 4 * ((len(jpeg) + 2) // 3) <= budget:
                image = FRAME_PREFIX + base64.b64encode(jpeg).decode('ascii')
                images.append(image)
                remaining_bytes -= len(image)
                break
        else:
            raise ValueError('所选视频帧超过传输上限，请减少帧数后重试')
    return {'referenceImages': images, 'times': times}


@contextmanager
def selected_video_file(source_path, runtime_root, start=None, end=None):
    """Yield only the selected interval. Never send the original if trimming fails."""
    source = Path(source_path)
    validate_asset_media('video', path=source)
    start = _time_value(start) if start is not None else 0.0
    if end is not None:
        end = _time_value(end)
        if end <= start:
            raise ValueError('截取结束时间必须晚于开始时间')
    if start == 0 and end is None:
        yield source
        return
    binary = _media_binary(runtime_root, 'ffmpeg')
    with tempfile.TemporaryDirectory(prefix='canvasflow-video-') as folder:
        output = Path(folder) / 'clip.mp4'
        args = [str(binary), '-nostdin', '-v', 'error', '-protocol_whitelist', 'file,pipe',
                '-ss', str(start), '-i', str(source)]
        if end is not None:
            args.extend(['-t', str(end - start)])
        args.extend(['-map', '0:v:0', '-map', '0:a:0?', '-c:v', 'libx264', '-preset', 'veryfast',
                     '-c:a', 'aac', '-movflags', '+faststart', str(output)])
        try:
            subprocess.run(args, check=True, timeout=600, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                           creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        except (OSError, subprocess.SubprocessError):
            raise ValueError('无法读取所选视频片段，请检查截取范围与视频文件') from None
        validate_asset_media('video', path=output)
        yield output


def _origin(url):
    parts = urlsplit(url)
    if parts.scheme not in ('http', 'https') or not parts.hostname or parts.username or parts.password:
        raise ValueError('视频理解接口地址无效')
    return parts.scheme, parts.hostname, parts.port or (443 if parts.scheme == 'https' else 80)


def _google_base(url):
    parts = urlsplit(url)
    _origin(url)
    if parts.query or parts.fragment:
        raise ValueError('Gemini 接口地址不能包含查询参数或片段')
    return re.sub(r'/(v1beta|v1)(/openai)?$', '', url.rstrip('/'))


def _json_call(opener, url, headers, method, *, body=None, timeout=120):
    req = request.Request(url, data=body, headers=headers, method=method)
    req.same_origin_only = True
    try:
        with opener(req, timeout=timeout) as response:
            raw = response.read(4 * 1024 * 1024 + 1)
            if len(raw) > 4 * 1024 * 1024:
                raise VideoServiceError('视频理解服务的响应过大')
            # Upload initiation returns metadata in headers and no body.
            data = json.loads(raw) if raw.strip() else {}
            if not isinstance(data, dict):
                raise VideoServiceError('视频理解服务的响应格式无效')
            return data, response.headers
    except error.HTTPError as exc:
        code = exc.code
        exc.close()
        raise VideoServiceError(f'视频理解服务返回 HTTP {code}，请核对模型协议、权限及文件接口配置') from None
    except (error.URLError, OSError, ValueError, HTTPException):
        raise VideoServiceError('视频理解服务连接失败或未返回有效结果，请检查供应商配置') from None


def _first_result(data, key):
    items = data.get(key)
    if isinstance(items, list) and items and isinstance(items[0], dict):
        return items[0]
    return {}


@contextmanager
def _gemini_part(path, base, auth, opener, timeout):
    mime = VIDEO_MIMES[path.suffix.lower()]
    size = path.stat().st_size
    if size <= INLINE_LIMIT:
        yield {'inlineData': {'mimeType': mime, 'data': base64.b64encode(path.read_bytes()).decode('ascii')}}
        return
    protocol_headers = {**auth, 'Content-Type': 'application/json', 'X-Goog-Upload-Protocol': 'resumable',
                        'X-Goog-Upload-Command': 'start', 'X-Goog-Upload-Header-Content-Length': str(size),
                        'X-Goog-Upload-Header-Content-Type': mime}
    _, headers = _json_call(opener, base + '/upload/v1beta/files', protocol_headers, 'POST',
                            body=b'{"file":{"display_name":"CanvasFlow video"}}', timeout=timeout)
    upload_url = headers.get('X-Goog-Upload-URL', '')
    if not upload_url or _origin(upload_url) != _origin(base):
        raise VideoServiceError('视频理解服务未返回同源文件上传地址')
    with path.open('rb') as stream:
        uploaded, _ = _json_call(opener, upload_url, {
            'Content-Type': mime, 'Content-Length': str(size), 'X-Goog-Upload-Offset': '0',
            'X-Goog-Upload-Command': 'upload, finalize'}, 'POST', body=stream, timeout=timeout)
    file = uploaded.get('file')
    if not isinstance(file, dict) or not re.fullmatch(r'files/[A-Za-z0-9_-]+', str(file.get('name') or '')):
        raise VideoServiceError('视频上传未返回有效文件编号')
    endpoint = base + '/v1beta/' + file['name']
    try:
        deadline = time.monotonic() + max(timeout, 180)
        while file.get('state') == 'PROCESSING':
            if time.monotonic() >= deadline:
                raise VideoServiceError('供应商处理视频超时，请稍后重试')
            time.sleep(2)
            file, _ = _json_call(opener, endpoint, auth, 'GET', timeout=timeout)
        if file.get('state') != 'ACTIVE' or not file.get('uri'):
            raise VideoServiceError('供应商未能处理视频，请检查文件格式')
        yield {'fileData': {'mimeType': mime, 'fileUri': file['uri']}}
    finally:
        # Release the temporary remote upload even if generation or polling fails.
        try:
            _json_call(opener, endpoint, auth, 'DELETE', timeout=min(timeout, 15))
        except VideoServiceError:
            pass


def generate(path, entry, opener, auth, timeout):
    upstream = str(entry.get('model') or '')
    transport = video_transport(entry)
    if transport == 'gemini-native':
        base = _google_base(str(entry.get('baseUrl') or ''))
        model = upstream.removeprefix('models/')
        if not re.fullmatch(r'[A-Za-z0-9._-]+', model):
            raise ValueError('Gemini 视频理解模型标识无效')
        if urlsplit(base).hostname == 'generativelanguage.googleapis.com':
            auth = {'x-goog-api-key': entry.get('apiKey') or ''}
        with _gemini_part(path, base, auth, opener, timeout) as video:
            payload = {'contents': [{'role': 'user', 'parts': [video, {'text': INSTRUCTION}]}]}
            data, _ = _json_call(opener, f'{base}/v1beta/models/{model}:generateContent',
                                 {**auth, 'Content-Type': 'application/json'}, 'POST',
                                 body=json.dumps(payload, ensure_ascii=False).encode(), timeout=timeout)
        content = _first_result(data, 'candidates').get('content')
        parts = content.get('parts') if isinstance(content, dict) else None
        if not isinstance(parts, list):
            raise VideoServiceError('Gemini 未返回可读取的提示词，请检查模型回复或内容限制')
        text = '\n'.join(part['text'] for part in parts if isinstance(part, dict) and not part.get('thought')
                         and isinstance(part.get('text'), str)).strip()
        metadata = data.get('usageMetadata')
        counts = {k: v for k, v in metadata.items() if isinstance(v, int) and v >= 0} if isinstance(metadata, dict) else {}
        usage = {'prompt_tokens': counts.get('promptTokenCount', 0),
                 'completion_tokens': counts.get('candidatesTokenCount', 0) + counts.get('thoughtsTokenCount', 0)}
    elif transport == 'chat-video':
        mime = VIDEO_MIMES[path.suffix.lower()]
        # Stream the inline JSON body from disk so a full-length clip does not
        # require several copies of the video in Python's memory.
        marker = '__CANVASFLOW_VIDEO_PAYLOAD__'
        parts = [{'type': 'video_url', 'video_url': {'url': f'data:{mime};base64,{marker}'}},
                 {'type': 'text', 'text': INSTRUCTION}]
        payload = {'model': upstream, 'messages': [{'role': 'user', 'content': parts}], 'stream': False}
        base = str(entry.get('baseUrl') or '').rstrip('/')
        endpoint = base + ('/chat/completions' if base.endswith('/v1') else '/v1/chat/completions')
        prefix, _, suffix = json.dumps(payload, ensure_ascii=False).encode().rpartition(marker.encode())
        with tempfile.TemporaryFile() as body, path.open('rb') as stream:
            body.write(prefix)
            while chunk := stream.read(3 * 256 * 1024):
                body.write(base64.b64encode(chunk))
            body.write(suffix)
            headers = {**auth, 'Content-Type': 'application/json', 'Content-Length': str(body.tell())}
            body.seek(0)
            data, _ = _json_call(opener, endpoint, headers, 'POST', body=body, timeout=timeout)
        message = _first_result(data, 'choices').get('message')
        content = message.get('content') if isinstance(message, dict) else None
        if isinstance(content, list):
            content = '\n'.join(p['text'] for p in content if isinstance(p, dict) and isinstance(p.get('text'), str))
        text = content.strip() if isinstance(content, str) else ''
        usage = data['usage'] if isinstance(data.get('usage'), dict) else {}
    else:
        raise ValueError('所选模型未配置整段视频理解协议')
    if not text:
        raise VideoServiceError('视频理解模型未返回提示词')
    return text, usage
