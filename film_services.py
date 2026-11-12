"""Workspace-scoped bridge to CanvasFlow's existing provider protocols. No keys in IPC."""
import base64
import json
import mimetypes
import re
import time
import uuid
from film_media import image_request, image_capabilities, upload_video_reference, video_capabilities


def service_handler(host, user, workspace, preferred_model=None):
    manager = host.get('FILM_WORKBENCH')
    if manager is not None:
        if not hasattr(manager, 'preferred_models'): manager.preferred_models = {}
        if preferred_model: manager.preferred_models[workspace] = preferred_model
    def models():
        out={v:[] for v in ('image','video','tts','music','sfx','asr','translate')}
        for entry in host['visible_ai_models'](user['id']):
            if not entry.get('enabled') or not host['provider_has_credentials'](entry): continue
            item={'id':entry['id'],'name':entry.get('name') or entry.get('model') or entry['id']}
            for verb,usage in [('image','image'),('video','video'),('translate','text')]:
                if host['model_has_usage'](entry,usage):
                    spec = image_capabilities(host,entry) if verb == 'image' else (video_capabilities(host,entry) if verb == 'video' else {})
                    out[verb].append({**item,**({'spec':spec} if spec else {})})
            name=str(entry.get('model') or '').lower()
            if host['model_has_usage'](entry,'audio'):
                # Separate music and transcription from speech: never silently pick a different kind of endpoint.
                kind='asr' if re.search(r'whisper|transcrib|\basr\b',name) else 'music' if re.search(r'suno|music|udio',name) else 'sfx' if re.search(r'sfx|sound.effect',name) else 'tts'
                out[kind].append(item)
        return out
    def media_result(uri):
        if str(uri).startswith('data:'):
            header,body=uri.split(',',1);return {'mime':header[5:].split(';')[0],'base64':body}
        if not str(uri).startswith('/media/'): raise ValueError('生成结果尚未保存到本地')
        file=host['resolve_media_file'](uri.split('/')[-1])
        if not file: raise ValueError('生成文件不存在')
        if file.stat().st_size>host['MEDIA_MAX_BYTES']: raise ValueError('生成文件超过大小限制')
        return {'mime':mimetypes.guess_type(file.name)[0] or 'application/octet-stream','base64':base64.b64encode(file.read_bytes()).decode()}
    def callback(method,payload):
        catalog=models()
        if method=='models':return {'models':catalog}
        if method=='voices':
            wanted=payload.get('model') or (catalog['tts'] or [{}])[0].get('id')
            if not wanted or not any(m['id']==wanted for m in catalog['tts']):raise ValueError('请选择可用的配音模型')
            entry=next(e for e in host['visible_ai_models'](user['id']) if e.get('id')==wanted)
            voices,error=host['fetch_model_voices'](entry,entry['model'])
            if not voices and str(entry['model']).lower() in ('gpt-4o-mini-tts','tts-1','tts-1-hd'):
                voices=[{'id':v,'name':v} for v in ('marin','cedar','alloy','ash','ballad','coral','echo','fable','nova','onyx','sage','shimmer','verse')]
                error=''
            return {'voices':voices,'error':error,'filters':host['voice_filter_options'](voices)}
        if method not in ('ask','generate'):raise ValueError('模型操作无效')
        verb='translate' if method=='ask' else payload.get('verb')
        selected = manager.preferred_models.get(workspace) if manager is not None and method == 'ask' else None
        wanted=payload.get('model') or selected or (catalog.get(verb) or [{}])[0].get('id')
        if not wanted or not any(m['id']==wanted for m in catalog.get(verb,[])):
            raise ValueError('当前工作区没有启用适用于此功能的模型，请在 CanvasFlow 供应商设置中配置')
        entry=next((e for e in host['visible_ai_models'](user['id']) if e.get('id')==wanted),None)
        args=payload.get('args') or {}
        prompt=str(payload.get('text') if method=='ask' else args.get('text') or args.get('prompt') or '')
        if verb=='translate':
            result,error=host['agent_billed_call'](user,entry,prompt,lambda trace:host['call_chat_completion'](
                entry,[{'type':'text','text':prompt}],max_tokens=8000,timeout=180,trace=trace),max_tokens=8000)
            if error:raise ValueError(error)
            return {'text':result}
        if verb=='image':
            if len(payload.get('files',[]))>18:raise ValueError('参考文件过多')
            result,error=host['agent_billed_call'](user,entry,prompt,lambda trace:image_request(
                host,entry,prompt,args,payload.get('files',[]),trace))
            if error:raise ValueError(error)
            return media_result(result)
        if verb in ('tts','music','sfx','video'):
            if verb=='video':
                source_videos=[]
                if args.get('video'):
                    videos=[f for f in payload.get('files',[]) if f.get('role')=='video']
                    if len(videos)!=1:raise ValueError('需要读取一个本地参考视频')
                    source_videos=[upload_video_reference(host,entry,videos[0])]
                image_files=[f for f in payload.get('files',[]) if f.get('role') not in ('audio','voice','video')]
                if len(image_files)>2: raise ValueError('当前 CanvasFlow 视频接口最多接受两张参考图')
                refs=['data:'+(f.get('mime') or mimetypes.guess_type(f['path'])[0] or 'image/png')+';base64,'+f['base64'] for f in image_files]
                audios=['data:'+(f.get('mime') or mimetypes.guess_type(f['path'])[0] or 'audio/mpeg')+';base64,'+f['base64'] for f in payload.get('files',[]) if f.get('role') in ('audio','voice')]
                if len(audios)>1: raise ValueError('当前视频接口仅支持一段参考音频，请选择 audio 或 voice 之一')
                mode='video2video' if source_videos else 'mixed2video' if audios and refs else 'audio2video' if audios else 'frames2video' if args.get('last-frame') else 'image2video' if args.get('input-reference') else 'singleImage2video' if refs else 'text2video'
                incoming={'prompt':prompt,'generationSettings':{'modelId':wanted,'duration':args.get('duration') or args.get('dur') or 4,
                    'aspectRatio':args.get('aspect-ratio') or args.get('ratio') or '16:9','referenceMode':mode,
                    **({'resolution':args['resolution']} if args.get('resolution') else {}),
                    'videoMode':'图生视频' if refs else '文生视频'},'referenceImages':refs,'sourceAudios':audios}
                if source_videos:incoming['sourceVideos']=source_videos
                job,error=host['create_video_job'](user,incoming,workspace)
            else:
                job,error=host['create_audio_job'](user,{'modelId':wanted,'text':prompt,'voice':args.get('voice') or 'alloy',
                    'mode':'speech' if verb=='tts' else 'generation','speed':args.get('speed') or 1,
                    'spec':{**(args.get('spec') or {}),**({'duration':args['sec']} if args.get('sec') else {})}},workspace)
            if error:raise ValueError(error.get('message') or str(error))
            until=time.monotonic()+540
            while time.monotonic()<until:
                current=next((j for j in host['latest_jobs'](user['id'],limit=None,workspace_id=workspace) if j['id']==job['id']),job)
                job=host['job_view'](current)
                if job.get('status')=='completed':return media_result(job.get('videoUrl') or job.get('audioUrl'))
                if job.get('status') in ('failed','cancelled'):raise ValueError(job.get('error') or '生成未完成')
                time.sleep(2)
            raise ValueError('模型仍在处理，请在 CanvasFlow 任务记录中查看；不会重复提交')
        if verb=='asr':
            files=payload.get('files') or []
            if len(files)!=1:raise ValueError('需要一个语音文件')
            raw=base64.b64decode(files[0]['base64'],validate=True)
            if len(raw)>25*1024*1024:raise ValueError('转写文件不能超过 25 MB')
            boundary='cf-film-'+uuid.uuid4().hex
            fields={'model':entry.get('model'),'response_format':'verbose_json','timestamp_granularities[]':'word'}
            body=b''.join((f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n').encode() for k,v in fields.items())
            name=re.sub(r'[^a-zA-Z0-9_.-]','_',str(files[0].get('name') or 'speech.mp3'))[-100:]
            mime=str(files[0].get('mime') or 'audio/mpeg')
            if not re.fullmatch(r'(audio|video)/[a-zA-Z0-9.+-]+',mime): raise ValueError('转写文件类型无效')
            body+=(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: {mime}\r\n\r\n').encode()+raw+f'\r\n--{boundary}--\r\n'.encode()
            url=host['endpoint_candidates'](entry['baseUrl'],'audio/transcriptions')[0]
            status,result,error=host['http_body_request'](url,body,headers=host['auth_headers'](entry,entry.get('apiKey'),{'Content-Type':'multipart/form-data; boundary='+boundary}),timeout=300)
            if error or not 200<=status<300:raise ValueError(error or '语音转写失败')
            words=[{'token':w.get('word',''),'start':w['start'],'end':w.get('end',w['start'])} for w in result.get('words',[]) if isinstance(w,dict) and isinstance(w.get('start'),(float,int)) and w.get('word')]
            if not words:raise ValueError('该转写模型没有返回逐字时间戳，无法生成准确对齐字幕')
            return {'index':[{'src':args.get('src'),'text':result.get('text',''),'words':words,'transcribed':True}]}
        raise ValueError('当前服务不支持此生成类型')
    return callback
