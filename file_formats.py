"""Check the declared file extension against the actual media container before publication."""
from pathlib import Path
import base64
import re
import tempfile
import json

EXTENSIONS = {'images':{'.png','.jpg','.jpeg','.webp'}, 'videos':{'.mp4','.webm','.mov'},
              'music':{'.mp3','.wav','.m4a'}, 'models':{'.glb'}}
LABELS = {'images':'PNG/JPG/WebP 图片', 'videos':'MP4/WebM/MOV 视频', 'music':'MP3/WAV/M4A 音乐', 'models':'GLB 2.0 模型'}


def validate_model_file(path, allow_gltf=False):
    """Check the embedded document and reject external model dependencies."""
    path = Path(path)
    size = path.stat().st_size
    if size > 40_000_000:
        raise ValueError('模型不能超过 40MB')
    with path.open('rb') as stream:
        header = stream.read(20)
        if header[:4] == b'glTF':
            if len(header) != 20 or int.from_bytes(header[4:8], 'little') != 2 or int.from_bytes(header[8:12], 'little') != size or header[16:20] != b'JSON':
                raise ValueError('请选择有效的 GLB 2.0 模型文件')
            length = int.from_bytes(header[12:16], 'little')
            if not 0 < length <= size - 20 or length % 4:
                raise ValueError('GLB 模型描述无效')
            raw = stream.read(length)
            position = 20 + length
            while position < size:
                chunk = stream.read(8)
                if len(chunk) != 8: raise ValueError('GLB 数据块不完整')
                count = int.from_bytes(chunk[:4], 'little')
                if count % 4 or position + 8 + count > size: raise ValueError('GLB 数据块不完整')
                stream.seek(count, 1); position += 8 + count
        elif allow_gltf:
            stream.seek(0); raw = stream.read()
        else:
            raise ValueError('请选择有效的 GLB 2.0 模型文件')
    try: document = json.loads(raw.decode('utf-8-sig').rstrip('\0 '))
    except (ValueError, UnicodeError) as error: raise ValueError('模型描述无法解析') from error
    if not isinstance(document, dict) or not isinstance(document.get('asset'), dict) or document['asset'].get('version') != '2.0':
        raise ValueError('请选择 glTF 2.0 模型')
    if not isinstance(document.get('meshes'), list) or not document['meshes']:
        raise ValueError('模型没有可显示的几何体')
    for group in ('buffers', 'images'):
        resources = document.get(group, [])
        if not isinstance(resources, list): raise ValueError('模型资源描述无效')
        for resource in resources:
            if not isinstance(resource, dict) or not isinstance(resource.get('uri', ''), str):
                raise ValueError('模型资源描述无效')
            if resource.get('uri') and not resource['uri'].startswith('data:'):
                raise ValueError('请上传所有资源已内嵌的模型文件')
    return document


def _mpeg_frame(raw):
    return len(raw)>=4 and raw[0]==255 and raw[1]&224==224 and (raw[1]>>3)&3!=1 and (raw[1]>>1)&3!=0 and (raw[2]>>4) not in (0,15) and (raw[2]>>2)&3!=3


def _iso_handlers(stream, size):
    position=0; handlers=set(); has_type=False
    while position+8<=size:
        stream.seek(position); header=stream.read(16)
        length=int.from_bytes(header[:4],'big'); kind=header[4:8]; header_size=8
        if length==1:
            length=int.from_bytes(header[8:16],'big'); header_size=16
        elif length==0:
            length=size-position
        if length<header_size or position+length>size: return set()
        if kind==b'ftyp': has_type=True
        if kind==b'moov':
            if length>16_000_000: return set()
            stream.seek(position+header_size); body=stream.read(length-header_size)
            start=0
            while True:
                at=body.find(b'hdlr',start)
                if at<0: break
                handlers.add(body[at+12:at+16]);start=at+4
        position+=length
    return handlers if has_type or handlers else set()


def validate_media_file(kind, path):
    path=Path(path)
    if kind not in EXTENSIONS or path.suffix.lower() not in EXTENSIONS[kind]:
        raise ValueError('只支持 '+LABELS.get(kind,'指定格式文件'))
    size=path.stat().st_size
    if size<12: raise ValueError('文件内容不完整或格式无效')
    with path.open('rb') as stream:
        header=stream.read(65536);suffix=path.suffix.lower();valid=False
        if suffix=='.png':
            valid=header.startswith(b'\x89PNG\r\n\x1a\n') and header[12:16]==b'IHDR' and size>=45
            stream.seek(max(0,size-32));valid=valid and b'IEND' in stream.read()
        elif suffix in ('.jpg','.jpeg'):
            stream.seek(max(0,size-32));valid=header.startswith(b'\xff\xd8\xff') and b'\xff\xd9' in stream.read()
        elif suffix=='.webp':
            valid=header[:4]==b'RIFF' and header[8:12]==b'WEBP' and header[12:16] in (b'VP8 ',b'VP8L',b'VP8X') and int.from_bytes(header[4:8],'little')+8<=size
        elif suffix=='.wav':
            valid=header[:4]==b'RIFF' and header[8:12]==b'WAVE' and b'fmt ' in header and b'data' in header and int.from_bytes(header[4:8],'little')+8<=size
        elif suffix=='.mp3':
            offset=0
            if header.startswith(b'ID3'):
                offset=10+sum((header[6+i]&127)<<(7*(3-i)) for i in range(4))
            stream.seek(offset);valid=offset+4<size and _mpeg_frame(stream.read(4))
        elif suffix in ('.m4a','.mp4','.mov'):
            handlers=_iso_handlers(stream,size)
            valid=b'soun' in handlers and b'vide' not in handlers if suffix=='.m4a' else b'vide' in handlers
        elif suffix=='.webm':
            valid=header[:4]==b'\x1aE\xdf\xa3' and b'webm' in header[:4096] and any(codec in header for codec in (b'V_VP8',b'V_VP9',b'V_AV1'))
        elif suffix=='.glb':
            valid=header[:4]==b'glTF' and int.from_bytes(header[4:8],'little')==2 and int.from_bytes(header[8:12],'little')==size
    if not valid: raise ValueError('文件内容与扩展名不一致或文件已损坏，请选择有效的 '+LABELS[kind])
    if kind == 'models': validate_model_file(path)


def validate_asset_media(kind, path=None, data=''):
    mapping={'image':'images','video':'videos','audio':'music'}
    if kind=='file' and path:
        kind=next((asset_kind for asset_kind,share_kind in mapping.items() if Path(path).suffix.lower() in EXTENSIONS[share_kind]),'file')
    if kind not in mapping: raise ValueError('素材仅支持 PNG/JPG/WebP 图片、MP4/WebM/MOV 视频和 MP3/WAV/M4A 音乐')
    if path:
        validate_media_file(mapping[kind],path)
    elif data:
        match=re.fullmatch(r'data:([^;,]+);base64,([A-Za-z0-9+/=]+)',data)
        suffix={'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp','audio/mpeg':'.mp3','audio/wav':'.wav','audio/x-wav':'.wav','audio/mp4':'.m4a','video/mp4':'.mp4','video/webm':'.webm','video/quicktime':'.mov'}.get(match[1] if match else '')
        if not suffix: raise ValueError('文件格式不受支持')
        try: raw=base64.b64decode(match[2],validate=True)
        except ValueError as error: raise ValueError('文件内容无效') from error
        with tempfile.TemporaryDirectory() as directory:
            file=Path(directory)/('upload'+suffix);file.write_bytes(raw);validate_media_file(mapping[kind],file)
    else: raise ValueError('请上传有效的文件')
    return kind


def validate_upload(raw, name, mime):
    """Validate raw uploads before writing any persistent file; return canonical MIME."""
    types = {'.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp',
             '.mp4':'video/mp4', '.webm':'video/webm', '.mov':'video/quicktime', '.mp3':'audio/mpeg',
             '.wav':'audio/wav', '.m4a':'audio/mp4', '.glb':'model/gltf-binary', '.gltf':'model/gltf+json'}
    suffix = Path(name).suffix.lower() if name else next((ext for ext, value in types.items() if value == mime), '')
    if suffix not in types:
        raise ValueError('仅支持 PNG/JPG/WebP、MP4/WebM/MOV、MP3/WAV/M4A 和 GLB/glTF 文件')
    with tempfile.TemporaryDirectory() as folder:
        file = Path(folder) / ('upload' + suffix)
        file.write_bytes(raw)
        if suffix == '.gltf': validate_model_file(file, allow_gltf=True)
        else:
            kind = next(key for key, exts in EXTENSIONS.items() if suffix in exts)
            validate_media_file(kind, file)
    return types[suffix]
