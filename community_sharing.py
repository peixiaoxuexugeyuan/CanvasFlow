"""Owner-only community publication and metadata/file replacement."""
import copy
import json
import re
import uuid
from previs_assets import clean_thumbnail
from file_formats import validate_media_file


class CommunityShareError(ValueError):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def prepare_share(kind, incoming, user, existing, resolve_media, clean_project, now, workspace):
    if kind not in ('projects', 'images', 'videos', 'music', 'models'):
        raise CommunityShareError('分享类型无效')
    if not isinstance(incoming, dict):
        raise CommunityShareError('分享内容无效')
    if existing is not None and existing.get('ownerId') != user['id']:
        raise CommunityShareError('只能编辑自己分享的内容', 403)
    name = str(incoming.get('name') or '').strip()[:120]
    if not name:
        raise CommunityShareError('请填写名称')
    item = copy.deepcopy(existing or {})
    description = str(incoming.get('description') or '').strip()[:1000]
    media_id = str(incoming.get('mediaId') or '')
    if media_id:
        if not re.fullmatch(r'media-[a-f0-9]{32}\.[a-z0-9]{1,5}', media_id):
            raise CommunityShareError('文件引用无效')
        media = resolve_media(media_id)
        if not media:
            raise CommunityShareError('文件不存在，请重新上传')
        suffix = media.suffix.lower()
        allowed = {'images': {'.png','.jpg','.jpeg','.webp'}, 'videos': {'.mp4','.webm','.mov'},
                   'music': {'.mp3','.wav','.m4a'}, 'models': {'.glb'}}
        if kind not in allowed or suffix not in allowed[kind]:
            raise CommunityShareError('文件格式与分享类型不一致')
        try: validate_media_file(kind, media)
        except ValueError as error: raise CommunityShareError(str(error)) from error
        if kind == 'models':
            item.update(assetType='3d', object={'kind':'geometry','local':True,'modelUrl':'/media/'+media_id,
                       'transform':{'position':[0,0,0],'rotation':[0,0,0],'scale':[1,1,1]}})
        item.update(mediaId=media_id, mediaUrl='/media/'+media_id, size=f'{max(1,media.stat().st_size//1024)} KB', hasPreview=True)
        item.pop('data', None)
        if kind == 'music':
            item['data'] = item['mediaUrl']
    if kind == 'projects':
        if incoming.get('project') is not None:
            # Imported JSON creates a separate project; never replace the current canvas graph.
            if existing is not None:
                raise CommunityShareError('编辑项目时请保留原工作流；导入 JSON 请新建分享')
            source = incoming['project']
            if not isinstance(source, dict) or not isinstance(source.get('nodes'), list) or not isinstance(source.get('edges', []), list):
                raise CommunityShareError('请选择含 nodes 和 edges 的项目 JSON 文件')
            item = clean_project(source, 'project-'+uuid.uuid4().hex[:12])
            item['workspaceId'] = workspace
        elif existing is None:
            raise CommunityShareError('请选择当前项目或上传项目 JSON')
        item['projectName'] = name
        item['revision'] = int(item.get('revision') or 0)+1
    else:
        item['name'] = name
        if kind in ('images','videos'):
            item['kind'] = 'image' if kind == 'images' else 'video'
        if not item.get('mediaId') and not item.get('data') and not item.get('object'):
            # Existing legacy style presets remain editable; new models require a file.
            if existing is None or kind != 'models':
                raise CommunityShareError('请上传分享文件')
    if not item.get('id'):
        prefix = {'images':'asset','videos':'asset','music':'music','models':'model'}[kind]
        item['id'] = prefix+'-'+uuid.uuid4().hex[:12]
    if 'thumbnail' in incoming:
        item['thumbnail'] = clean_thumbnail(incoming['thumbnail'])
        item['cover'] = item['thumbnail']
    item.update(description=description, shared=True, ownerId=user['id'], ownerName=user.get('nickname') or user.get('name') or '创作者',
                ownerAvatar=user.get('avatar') or 'C', updatedAt=now)
    item.setdefault('createdAt', now)
    item.setdefault('workspaceId', workspace)
    return item
