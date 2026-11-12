"""Advanced Studio media inputs, using the configured CanvasFlow provider only."""
import base64
import json
import mimetypes
import re
import time
import uuid
from urllib.parse import urlparse


def file_bytes(item, kind=None, limit=100 * 1024 * 1024):
    if not isinstance(item, dict) or not isinstance(item.get('base64'), str):
        raise ValueError('参考文件内容缺失')
    if len(item['base64']) > (limit + 2) // 3 * 4:
        raise ValueError('参考文件超过大小限制')
    raw = base64.b64decode(item['base64'], validate=True)
    mime = item.get('mime') or mimetypes.guess_type(item.get('path', ''))[0] or 'application/octet-stream'
    if not raw or len(raw) > limit or not re.fullmatch(r'[a-z]+/[a-zA-Z0-9.+-]+', mime):
        raise ValueError('参考文件无效')
    if kind and not mime.startswith(kind + '/'):
        raise ValueError('参考文件类型应为 ' + kind)
    return raw, mime


def image_capabilities(host, entry):
    doc = host.get('image_parameter_contract', lambda e: {})(entry)
    params = {p['name']: p for p in doc.get('params', []) if p.get('name')}
    native = host.get('resolve_image_transport', lambda e: '')(entry) == 'openai-images'
    standard = native and bool(re.search(r'gpt[-_]?image|tt-image', str(entry.get('model', '')), re.I))
    known_animated = native and entry.get('model') in ('gpt-image-2.6-flare','gpt-image-2.6-sunburst')
    formats = params.get('output_format', params.get('format', {})).get('options') or (['png','gif','svg'] if known_animated else ['png', 'jpeg', 'webp'] if standard else ['png'])
    formats = [v.get('value') if isinstance(v, dict) else v for v in formats]
    formats = [v for v in formats if v in ('png', 'jpeg', 'webp', 'gif', 'svg')]
    qualities=host.get('supported_image_qualities',lambda *a:[])(entry.get('model'),entry.get('name',''))
    return dict(refs=16, mask=standard or 'mask' in params, markup=standard or 'markup' in params,
                transparent=standard or 'background' in params, formats=formats or ['png'],qualities=qualities)


def image_request(host, entry, prompt, args, files, trace):
    """Advanced options never silently disappear or select another model."""
    caps = image_capabilities(host, entry)
    fmt = args.get('format') or 'png'
    if fmt not in caps['formats']:
        raise ValueError('当前模型没有声明 ' + str(fmt) + ' 输出能力')
    for key in ('mask', 'markup', 'transparent'):
        if args.get(key) and not caps[key]:
            raise ValueError('当前模型没有声明 ' + key + ' 能力，请在模型参数中配置支持的选项')
    refs = [f for f in files if f.get('role') not in ('mask', 'markup')]
    if len(refs)>16:raise ValueError('最多使用 16 张参考图片')
    if fmt=='svg' and (refs or args.get('mask') or args.get('markup')):raise ValueError('SVG 输出只接受文字描述')
    if fmt=='gif' and args.get('mask'):raise ValueError('GIF 生成请使用标注引导图，不支持重绘遮罩')
    if args.get('transparent') and fmt=='jpeg':raise ValueError('JPEG 不支持透明背景，请选择 PNG 或 WebP')
    quality='standard' if args.get('quality')=='medium' else args.get('quality')
    if quality and caps['qualities'] and quality not in caps['qualities']:raise ValueError('当前模型不支持所选画质')
    special = {f.get('role'): f for f in files if f.get('role') in ('mask', 'markup')}
    if args.get('mask') and args.get('markup'):
        raise ValueError('遮罩和标注请任选一种')
    if (args.get('mask') or args.get('markup')) and not refs:
        raise ValueError('遮罩或标注需要同时提供参考图片')
    for role in ('mask', 'markup'):
        if args.get(role) and role not in special:
            raise ValueError('没有读取到' + role + '文件')
    references = ['data:' + mime + ';base64,' + base64.b64encode(raw).decode()
                  for raw, mime in (file_bytes(f, 'image', 25 * 1024 * 1024) for f in refs)]
    dim = args.get('dimensions') or {}
    width, height = int(dim.get('width', 1024)), int(dim.get('height', 1024))
    if not 1 <= width <= 16384 or not 1 <= height <= 16384:
        raise ValueError('图片尺寸无效')
    size = f'{width}x{height}'
    advanced = bool(special or args.get('transparent') or fmt != 'png')
    if not advanced:
        return host['call_image_generation'](entry, prompt, size=size, reference_images=references,
            quality=quality, timeout=300, trace=trace)
    fields = {'output_format': fmt}
    if args.get('transparent'): fields['background'] = 'transparent'
    if fmt == 'gif':
        fields.update(frame_count=max(2,min(16,int(args.get('frames') or 9))),
                      frame_duration_ms=max(20,min(2000,int(args.get('frame-ms') or 200))))
    if host['media_generate_entry'](entry):
        if special:
            raise ValueError('此统一媒体协议尚未声明遮罩文件传输方式，请使用支持图片编辑的供应商')
        patched = json.loads(json.dumps(entry))
        patched['mediaParams'] = {**host['media_param_overrides'](entry), **fields}
        image = patched.setdefault('modelParams', {}).setdefault('image', {})
        image['mediaParams'] = {**image.get('mediaParams', {}), **fields}
        return host['call_image_generation'](patched,prompt,size=size,reference_images=references,
            quality=quality,timeout=300,trace=trace)
    if entry.get('requestProfile') == 'chat-image':
        raise ValueError('聊天生图协议没有声明这些高级图片参数，请使用图片生成或编辑协议')
    contract = host['IMAGE_TRANSPORTS'][host['resolve_image_transport'](entry)]
    fields = {**host['image_extra_params'](entry), **fields}
    quality = host['image_quality_value'](entry.get('model'),quality,entry.get('name'))
    headers = host['auth_headers'](entry,entry.get('apiKey'))
    if references:
        endpoint = entry.get('imageEditPath') or contract['reference']
        payload,body,content_type,error = host['build_image_reference_body'](
            contract['body'],entry['model'],prompt,size,references,quality,fields)
        if error: return None,error
        if special:
            if body is None: return None,'此图片传输协议不支持遮罩/标注文件，请使用 OpenAI 图片编辑协议'
            boundary = content_type.split('boundary=',1)[1]
            ending = ('--'+boundary+'--\r\n').encode()
            if not body.endswith(ending): raise ValueError('图片请求格式无效')
            body = body[:-len(ending)]
            for role,item in special.items():
                raw,mime = file_bytes(item,'image',25*1024*1024)
                body += (f'--{boundary}\r\nContent-Disposition: form-data; name="{role}"; filename="{role}.png"\r\nContent-Type: {mime}\r\n\r\n'.encode()+raw+b'\r\n')
            body += ending
        if body is not None:
            result,url,error = host['request_body_candidates'](host['endpoint_candidates'](entry['baseUrl'],endpoint),
                lambda _:body,headers={**headers,'Content-Type':content_type},timeout=300)
        else:
            result,url,error = host['request_json_candidates'](host['endpoint_candidates'](entry['baseUrl'],endpoint),
                payload,headers=headers,timeout=300)
    else:
        endpoint = entry.get('imageSubmitPath') or contract['generation']
        payload = {'model':entry['model'],'prompt':prompt,'n':1,'size':size,**fields}
        if quality: payload['quality']=quality
        result,url,error = host['request_json_candidates'](host['endpoint_candidates'](entry['baseUrl'],endpoint),payload,headers=headers,timeout=300)
    if error: return None,error
    trace.update(endpoint=url,usage=result.get('usage') if isinstance(result,dict) else None)
    if entry.get('imageTaskMode') == 'async':
        result,error = host['poll_image_task'](entry,result,entry['baseUrl'],entry.get('apiKey'),time.monotonic()+540,trace=trace)
        if error:return None,error
    if fmt == 'svg' and isinstance(result,dict):
        records=result.get('data') or []
        if records and isinstance(records[0],dict) and records[0].get('b64_json'):
            raw=base64.b64decode(records[0]['b64_json'],validate=True)
            import xml.etree.ElementTree as ET
            if re.search(rb'<!DOCTYPE|<!ENTITY',raw,re.I):return None,'供应商返回的 SVG 包含不安全声明'
            root=ET.fromstring(raw)
            if root.tag.split('}')[-1]!='svg':return None,'供应商没有返回有效 SVG'
            for node in root.iter():
                if node.tag.split('}')[-1] in ('script','foreignObject','animate','animateTransform','animateMotion','set','discard','iframe','object','embed') or any(k.split('}')[-1].lower().startswith('on') for k in node.attrib):
                    return None,'供应商返回的 SVG 包含活动代码'
                for key,value in node.attrib.items():
                    if key.split('}')[-1] in ('href','src') and not value.startswith('#'):return None,'SVG 不允许引用外部资源'
                styles=(node.text or '')+' '+' '.join(node.attrib.values())
                if re.search(r'@import|javascript:|expression\s*\(|\\',styles,re.I):return None,'SVG 包含不安全样式'
                if any(not value.strip().strip('\x22\x27').startswith('#') for value in re.findall(r'url\s*\(([^)]*)\)',styles,re.I)):return None,'SVG 不允许引用外部样式资源'
            return 'data:image/svg+xml;base64,'+base64.b64encode(raw).decode(),None
    return host['finish_image_result'](result,time.monotonic()+120)


def video_capabilities(host,entry):
    contract=host.get('effective_provider_contract',lambda e:{})(entry)
    clip=bool(entry.get('fileUploadPath') or contract.get('adapter')=='zhongheng' or entry.get('requestProfile')=='zhongheng-video')
    return {'clip':clip,'refs':2}


def upload_video_reference(host,entry,item):
    raw,mime=file_bytes(item,'video')
    path=str(entry.get('fileUploadPath') or '').strip()
    contract=host.get('effective_provider_contract',lambda e:{})(entry)
    if contract.get('adapter') == 'zhongheng' or entry.get('requestProfile') == 'zhongheng-video':
        return host['zhongheng_reference'](entry,'data:'+mime+';base64,'+base64.b64encode(raw).decode(),'video')
    if not path:
        raise ValueError('此供应商尚未配置文件上传接口；请填写返回视频访问地址的上传接口后使用本地视频参考')
    boundary='CanvasFlowFilm'+uuid.uuid4().hex
    ext=mimetypes.guess_extension(mime) or '.mp4'
    body=(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="reference{ext}"\r\nContent-Type: {mime}\r\n\r\n'.encode()+raw+f'\r\n--{boundary}--\r\n'.encode())
    result,_,error=host['request_body_candidates'](host['endpoint_candidates'](entry['baseUrl'],path),
        lambda _:body,headers=host['auth_headers'](entry,entry.get('apiKey'),{'Content-Type':'multipart/form-data; boundary='+boundary}),timeout=180)
    if error:raise ValueError('参考视频上传失败：'+str(error))
    def urls(value):
        if isinstance(value,dict):
            for key,item in value.items():
                if key in ('url','file_url','download_url','uri') and isinstance(item,str):yield item
                elif isinstance(item,(dict,list)):yield from urls(item)
        elif isinstance(value,list):
            for item in value:yield from urls(item)
    for url in urls(result):
        parsed=urlparse(url)
        if parsed.scheme in ('http','https') and parsed.hostname and not parsed.username and not parsed.password:return url
    raise ValueError('上传接口只返回文件标识，没有返回可供该视频协议使用的访问地址')
