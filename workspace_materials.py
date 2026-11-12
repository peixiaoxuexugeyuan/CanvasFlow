"""Read a workspace's real media across its library, projects and finished jobs."""
import hashlib
import json
import re
from pathlib import Path
from urllib.parse import urlsplit

KINDS = ('image', 'video', 'model', 'audio')
CATEGORIES = ('character', 'scene', 'prop')
DEFAULT_CATEGORIES = (('character','角色'),('scene','场景'),('prop','道具'))
TAGS = {'人物':'character','角色':'character','character':'character','场景':'scene','scene':'scene',
        '物品':'prop','道具':'prop','prop':'prop'}
EXTENSIONS = {'image':{'.png','.jpg','.jpeg','.webp','.gif','.svg','.avif'},
              'video':{'.mp4','.webm','.mov','.m4v'}, 'audio':{'.mp3','.wav','.m4a','.ogg','.flac'},
              'model':{'.glb','.gltf','.obj','.fbx'}}


def category_list(workspace_id, saved):
    rows=saved.get(workspace_id,[]) if isinstance(saved,dict) else []
    rows=rows if isinstance(rows,list) else []
    overrides={row.get('id'):row for row in rows if isinstance(row,dict) and isinstance(row.get('id'),str)}
    result=[]
    for key,name in DEFAULT_CATEGORIES:
        override=overrides.get(key,{})
        if not override.get('deleted'):
            result.append({'id':key,'name':str(override.get('name') or name),'builtin':True})
    return result+[{'id':row['id'],'name':row['name'],'builtin':False} for row in rows
                   if isinstance(row,dict) and isinstance(row.get('id'),str)
                   and row['id'].startswith('tag-') and isinstance(row.get('name'),str)
                   and row['name'].strip() and not row.get('deleted')]


def decoded(value, fallback):
    if isinstance(value, type(fallback)): return value
    try:
        result=json.loads(value or '')
        return result if isinstance(result,type(fallback)) else fallback
    except (ValueError,TypeError): return fallback


def safe_url(value):
    if not isinstance(value,str): return ''
    if value.startswith(('/media/','/assets3d/','data:image/','data:video/','data:audio/')):return value
    try:return value if urlsplit(value).scheme in ('http','https') else ''
    except ValueError:return ''


def media_kind(value, hint=''):
    value=str(value or '')
    for kind in ('image','video','audio'):
        if value.startswith('data:'+kind+'/'):return kind
    try:extension=Path(urlsplit(value).path).suffix.lower()
    except ValueError:return ''
    return next((kind for kind,extensions in EXTENSIONS.items() if extension in extensions),hint if hint in KINDS else '')


def build_catalog(workspace_id, projects, assets, music, models, jobs, in_scope, metadata=None, *, include_deleted=False):
    """Do not rewrite project nodes or invoke a generation/provider API."""
    items={};asset_map={str(a.get('id')):a for a in assets};music_map={str(a.get('id')):a for a in music}
    scoped_projects=[p for p in projects if in_scope(p,workspace_id)]
    project_map={str(p.get('id')):p for p in scoped_projects}
    job_ids={str(j.get('id')) for j in jobs if in_scope(j,workspace_id)}

    def add(record, kind='', project=None, origin='', category='', node_id='', label='', object_data=None, identity=''):
        record=record if isinstance(record,dict) else {}
        url=next((safe_url(record.get(key)) for key in ('mediaUrl','previewMedia','imageUrl','videoUrl','audioUrl','modelUrl','url','data') if safe_url(record.get(key))), '')
        if not url and record.get('mediaId'):url='/media/'+str(record['mediaId'])
        kind=media_kind(url,kind or record.get('kind') or record.get('type'))
        if not kind or not (url or object_data):return
        # A media file reused by several projects is a single material with several references.
        match=re.search(r'/media/(media-[a-f0-9]{32}\.[a-z0-9]+)',url)
        key='file:'+match[1] if match else url or identity or json.dumps(object_data,sort_keys=True,ensure_ascii=False)
        id='material-'+hashlib.sha256(key.encode()).hexdigest()[:24]
        item=items.setdefault(id,{'id':id,'kind':kind,'name':str(label or record.get('name') or record.get('previewName') or record.get('title') or {'image':'图片','video':'视频','audio':'音频','model':'模型'}[kind])[:160],
            'url':url,'thumbnail':safe_url(record.get('thumbnail') or record.get('cover')),
            'category':category or TAGS.get(str(record.get('category') or record.get('tag') or ''),''),
            'origins':set(),'projects':{},'references':[],'createdAt':str(record.get('createdAt') or record.get('updatedAt') or (project or {}).get('updatedAt') or ''),
            'size':str(record.get('size') or record.get('fileSize') or ''), 'object':object_data})
        if not item['category']:item['category']=category or TAGS.get(str(record.get('tag') or ''),'')
        if origin in ('generated','uploaded'):item['origins'].add(origin)
        if origin=='generated' and label:item['name']=str(label)[:160]
        if not item['thumbnail']:item['thumbnail']=safe_url(record.get('thumbnail') or record.get('cover'))
        if object_data and not item['object']:item['object']=object_data
        if project:
            pid=str(project['id']);item['projects'][pid]={'id':pid,'name':project.get('projectName') or '未命名项目'}
            reference={'projectId':pid,'nodeId':node_id}
            if reference not in item['references']:item['references'].append(reference)
        return item

    def resolve(id, kind='', project=None, origin='', category='', node_id=''):
        record=asset_map.get(str(id)) or music_map.get(str(id))
        if record:add(record,kind or ('audio' if str(id) in music_map else ''),project,origin,category,node_id)

    for record in assets:
        if in_scope(record,workspace_id):
            origin=str(record.get('source') or record.get('origin') or '')
            add(record,origin='generated' if origin in ('generated','generation') else 'uploaded' if origin in ('uploaded','upload') else '',
                project=project_map.get(str(record.get('projectId') or '')))
    for record in music:
        if in_scope(record,workspace_id):add(record,'audio',project_map.get(str(record.get('projectId') or '')))
    for record in models:
        if in_scope(record,workspace_id):
            obj=record.get('object')
            if not obj:continue
            category='character' if obj.get('kind')=='character' else TAGS.get(str(record.get('tag') or ''),'')
            add({**record,'modelUrl':obj.get('modelUrl')},'model',project_map.get(str(record.get('projectId') or '')),
                origin='uploaded' if obj.get('local') and not obj.get('blenderJobId') else 'generated',category=category,object_data=obj,identity='model:'+str(record.get('id')))

    def attachments(value, project, origin, node_id, category=''):
        if isinstance(value,str):
            value=decoded(value,[]) if value.lstrip().startswith('[') else decoded(value,{})
        if isinstance(value,list):
            for entry in value:attachments(entry,project,origin,node_id,category)
        if not isinstance(value,dict):return
        category=TAGS.get(str(value.get('category') or value.get('tag') or ''),category)
        for field in ('previewAsset','fileAsset','refAsset','assetId','trackId'):
            if value.get(field):resolve(value[field],project=project,origin=origin,category=category,node_id=node_id)
        for field,kind in (('previewMedia','image'),('previewData','image'),('mediaUrl',''),('imageUrl','image'),('videoUrl','video'),('audioUrl','audio'),('modelUrl','model'),('panoramaUrl','image'),('lastCaptureUrl','image'),('url',''),('data','')):
            if safe_url(value.get(field)):
                add({'url':value[field],'name':value.get('name') or value.get('title') or value.get('previewName')},kind,project,origin,category,node_id)
        for key,child in value.items():
            if isinstance(child,(dict,list)):
                child_category={'characters':'character','roles':'character','scenes':'scene','props':'prop'}.get(key,category)
                attachments(child,project,origin,node_id,child_category)

    for project in scoped_projects:
        for node in project.get('nodes') or []:
            if not isinstance(node,dict):continue
            origin='generated' if node.get('generated') or node.get('type')=='director' or node.get('sourceDirectorId') or str(node.get('jobId') or '') in job_ids else 'uploaded'
            category='character' if node.get('type')=='charview' else 'scene' if node.get('type') in ('panorama','pano') or node.get('imageProjection')=='equirectangular' else ''
            attachments(node,project,origin,str(node.get('id') or ''),category)
            for id in decoded(node.get('imageHistory'),[]):resolve(id,'image',project,'generated',category,str(node.get('id') or ''))
            for key in ('scriptAssets','shots','cells','references'):
                if node.get(key):attachments(node[key],project,origin,str(node.get('id') or ''),category)
            if node.get('type')=='director':
                scene=decoded(node.get('directorProject'),{})
                attachments(scene.get('scene') or {},project,'generated',str(node.get('id') or ''),'scene')
                attachments(scene.get('cameras') or [],project,'generated',str(node.get('id') or ''))
                for obj in scene.get('objects') or []:
                    if not isinstance(obj,dict) or obj.get('kind') not in ('geometry','character'):continue
                    # Objects without a file can still be exported and reused as model JSON.
                    payload={k:v for k,v in obj.items() if k not in ('selected','mesh','runtime')}
                    add({'modelUrl':obj.get('modelUrl'),'name':obj.get('name') or node.get('title'),'thumbnail':obj.get('thumbnail')},
                        'model',project,'uploaded' if obj.get('local') and not obj.get('blenderJobId') else 'generated',
                        'character' if obj.get('kind')=='character' else 'prop',str(node.get('id') or ''),object_data=payload,
                        identity='object:'+str(project['id'])+':'+str(node.get('id'))+':'+str(obj.get('id')))
        attachments(project.get('references') or [],project,'uploaded','')
    for job in jobs:
        if not in_scope(job,workspace_id) or job.get('status')!='completed':continue
        kind=job.get('kind') or 'video'
        field={'image':'imageUrl','video':'videoUrl','audio':'audioUrl'}.get(kind)
        if field and job.get(field):
            add({'url':job[field],'name':job.get('name') or job.get('projectName') or '生成'+{'image':'图片','video':'视频','audio':'音频'}[kind],
                 'createdAt':job.get('createdAt')},kind,project_map.get(str(job.get('projectId') or '')),'generated')

    saved=(metadata or {}).get(workspace_id,{})
    ratings={(str(p.get('id')),str(n.get('id'))):max(0,min(5,int(n.get('rating') or 0)))
             for p in scoped_projects for n in p.get('nodes') or []
             if isinstance(n,dict) and str(n.get('rating') or '0').isdigit()}
    result=[]
    for id,item in items.items():
        override=saved.get(id,{})
        # A material can be rediscovered through projects, saved assets and finished jobs.
        # Keep one workspace-scoped tombstone so refresh never resurrects a deleted card.
        if override.get('deleted') and not include_deleted:continue
        if 'name' in override:item['name']=override['name']
        if 'category' in override:item['category']=override['category']
        value=override.get('rating',max((ratings.get((ref['projectId'],ref['nodeId']),0) for ref in item['references']),default=0))
        item['rating']=max(0,min(5,int(value))) if str(value).isdigit() else 0
        item['favorite']=bool(override.get('favorite',False))
        replacement=override.get('replacement')
        if isinstance(replacement,dict) and replacement.get('kind') in KINDS and safe_url(replacement.get('url')):
            item.update(url=replacement['url'],kind=replacement['kind'],size=replacement.get('size') or '',
                        thumbnail=replacement['url'] if replacement['kind']=='image' else '',object=None,
                        createdAt=replacement.get('createdAt') or item['createdAt'],origins={'uploaded'},replacement=True)
        item['origins']=sorted(item['origins'] or {'uploaded'})
        item['projects']=list(item['projects'].values())
        result.append(item)
    return sorted(result,key=lambda row:(row['createdAt'],row['name']),reverse=True)


def summary_item(item):
    result={key:value for key,value in item.items() if key!='object'}
    result['hasObject']=bool(item.get('object'))
    result['deferred']=str(result['url']).startswith('data:')
    if result['deferred']:result['url']=''
    if len(result.get('thumbnail') or '')>180000:result['thumbnail']=''
    return result
