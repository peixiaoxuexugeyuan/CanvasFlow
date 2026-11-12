"""Persistent, account-owned 3D assets and community model favorites."""
import base64
import copy
import json
import math
import re
import uuid
from file_formats import validate_asset_media


def clean_asset_object(value):
    if not isinstance(value, dict) or value.get('kind') not in ('geometry', 'character', 'camera'):
        raise ValueError('请选择可保存的模型或机位')
    if len(json.dumps(value, ensure_ascii=False)) > 220_000:
        raise ValueError('模型参数过大，请使用 GLB 文件保存')
    keys = ('kind', 'geometryType', 'whitebox', 'bodyType', 'local', 'modelUrl', 'color', 'poseName',
            'poseMode', 'poseControls', 'rigVersion', 'transform', 'target', 'fov', 'aspectRatio', 'cameraRotationAbsolute', 'blenderJobId')
    result = {k:copy.deepcopy(value[k]) for k in keys if k in value}
    if result.get('blenderJobId') and not re.fullmatch(r'blend-[a-f0-9]{32}', str(result['blenderJobId'])):
        raise ValueError('Blender 源版本无效')
    if not isinstance(value.get('transform',{}),dict):
        raise ValueError('模型空间参数无效')
    result['transform'] = {}
    for key, default in [('position',[0,0,0]), ('rotation',[0,0,0]), ('scale',[1,1,1])]:
        vector = (value.get('transform') or {}).get(key, default)
        if not isinstance(vector, list) or len(vector) != 3 or any(isinstance(n,bool) or not isinstance(n,(int,float)) or not math.isfinite(n) or abs(n)>10000 for n in vector):
            raise ValueError('模型空间参数无效')
        if key == 'scale' and any(n<=0 for n in vector):
            raise ValueError('模型缩放必须大于零')
        result.setdefault('transform', {})[key] = vector[:]
    if result.get('modelUrl') and (not isinstance(result['modelUrl'],str) or not re.fullmatch(r'/media/media-[a-f0-9]{32}\.(?:glb|bin)', result['modelUrl'])):
        raise ValueError('模型文件必须先上传到素材服务')
    if result.get('local') and not result.get('modelUrl'):
        raise ValueError('本地模型尚未保存文件，请重新上传')
    if value.get('kind') == 'geometry' and not (value.get('whitebox') or value.get('geometryType') or value.get('modelUrl')):
        raise ValueError('缺少模型几何数据')
    if result.get('whitebox') is not None:
        spec = result['whitebox']
        recipes = ('box','sphere','cylinder','cone','torus','pyramid','building','road','wall','room','stairs','bridge','tree','car','table','chair','extrusion','mesh')
        if not isinstance(spec,dict) or spec.get('type') not in recipes or not isinstance(spec.get('parameters',{}),dict):
            raise ValueError('白模参数无效')
        params=spec.get('parameters',{})
        size=params.get('size')
        if not isinstance(size,list) or len(size)!=3 or any(isinstance(n,bool) or not isinstance(n,(int,float)) or not math.isfinite(n) or not .02<=n<=200 for n in size):
            raise ValueError('白模尺寸无效')
        if spec['type']=='mesh':
            vertices=params.get('vertices');indices=params.get('indices')
            if not isinstance(vertices,list) or not 9<=len(vertices)<=18000 or len(vertices)%3 or any(isinstance(n,bool) or not isinstance(n,(int,float)) or not math.isfinite(n) or abs(n)>100 for n in vertices):
                raise ValueError('网格顶点无效')
            if not isinstance(indices,list) or not 3<=len(indices)<=36000 or len(indices)%3 or any(isinstance(n,bool) or not isinstance(n,int) or not 0<=n<len(vertices)/3 for n in indices):
                raise ValueError('网格索引无效')
        if spec['type']=='extrusion':
            outline=params.get('outline')
            if not isinstance(outline,list) or not 3<=len(outline)<=64 or any(not isinstance(point,list) or len(point)!=2 or any(isinstance(n,bool) or not isinstance(n,(int,float)) or not math.isfinite(n) or abs(n)>100 for n in point) for point in outline):
                raise ValueError('挤出轮廓无效')
        for key in ('floors','steps','count'):
            n=params.get(key,1)
            if isinstance(n,bool) or not isinstance(n,int) or not 1<=n<=24:
                raise ValueError('白模数量无效')
        if params.get('roof','flat') not in ('flat','gable'):
            raise ValueError('屋顶参数无效')
    if result['kind']=='character' and not result.get('local') and result.get('bodyType','sam') not in ('sam','female','muscular','slim','broad','child','teen','chibi','mannequin'):
        raise ValueError('角色类型无效')
    if result['kind']=='geometry' and not result.get('whitebox') and not result.get('local') and result.get('geometryType') not in ('box','sphere','cylinder','cone','torus','pyramid'):
        raise ValueError('模型几何类型无效')
    if result['kind']=='camera':
        target=result.get('target',[0,1,0])
        if not isinstance(target,list) or len(target)!=3 or any(isinstance(n,bool) or not isinstance(n,(int,float)) or not math.isfinite(n) or abs(n)>10000 for n in target):
            raise ValueError('机位目标无效')
        fov=result.get('fov',50)
        if isinstance(fov,bool) or not isinstance(fov,(int,float)) or not math.isfinite(fov) or not 1<=fov<=179:
            raise ValueError('机位焦距无效')
    return result


def clean_thumbnail(value):
    value = str(value or '')
    if not value:
        return ''
    if re.fullmatch(r'/media/media-[a-f0-9]{32}\.(?:png|jpg|webp)', value) or re.fullmatch(r'/assets3d/previews/[a-z0-9-]+\.png', value):
        return value
    match = re.fullmatch(r'data:image/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)', value)
    if not match or len(value)>1_500_000:
        raise ValueError('缩略图格式不正确或图片过大')
    try:
        raw = base64.b64decode(match[2], validate=True)
    except ValueError as error:
        raise ValueError('缩略图内容无效') from error
    valid = raw.startswith(b'\x89PNG\r\n\x1a\n') if match[1]=='png' else raw.startswith(b'\xff\xd8\xff') if match[1]=='jpeg' else raw[:4]==b'RIFF' and raw[8:12]==b'WEBP'
    if not valid:
        raise ValueError('缩略图内容与格式不一致')
    validate_asset_media('image',data=value)
    return value


class PrevisAssetStore:
    def __init__(self, directory, read, write, models, write_models, now):
        self.file = directory / 'previs-assets.json'
        self.favorites_file = directory / 'model-favorites.json'
        self.read, self.write, self.models, self.write_models, self.now = read, write, models, write_models, now

    def records(self):
        rows = self.read(self.file, [])
        return rows if isinstance(rows,list) else []

    def favorites(self, user_id):
        rows = self.read(self.favorites_file, {})
        return set(rows.get(user_id, [])) if isinstance(rows,dict) else set()

    def model_views(self, rows, user_id):
        selected = self.favorites(user_id)
        return [{**m, 'favorited':m.get('id') in selected} for m in rows]

    def library(self, user_id):
        selected = self.favorites(user_id)
        models = [m for m in self.models() if m.get('id') in selected and (m.get('shared') or m.get('ownerId')==user_id)]
        return {'assets':[a for a in self.records() if a.get('ownerId')==user_id], 'favorites':self.model_views(models,user_id)}

    def create(self, user, incoming):
        rows = self.records()
        obj = clean_asset_object(incoming.get('object'))
        name = str(incoming.get('name') or '未命名模型').strip()[:120] or '未命名模型'
        asset = {'id':'asset3d-'+uuid.uuid4().hex, 'name':name, 'description':str(incoming.get('description') or '').strip()[:1000],
                 'thumbnail':clean_thumbnail(incoming.get('thumbnail')), 'object':obj, 'assetType':'3d',
                 'ownerId':user['id'], 'ownerName':user.get('nickname') or user.get('name') or '创作者',
                 'ownerAvatar':user.get('avatar') or 'C', 'createdAt':self.now(), 'updatedAt':self.now()}
        if user.get('workspaceId'):asset['workspaceId']=user['workspaceId']
        rows.insert(0,asset);self.write(self.file,rows)
        return asset

    def update(self, user_id, asset_id, incoming):
        rows = self.records()
        asset = next((a for a in rows if a.get('id')==asset_id and a.get('ownerId')==user_id), None)
        if not asset:
            raise LookupError('资产不存在或无编辑权限')
        if 'name' in incoming:
            name=str(incoming['name']).strip()[:120]
            if not name:
                raise ValueError('请填写模型名称')
            asset['name']=name
        if 'description' in incoming:
            asset['description']=str(incoming['description']).strip()[:1000]
        if 'thumbnail' in incoming:
            asset['thumbnail']=clean_thumbnail(incoming['thumbnail'])
        asset['updatedAt']=self.now();self.write(self.file,rows)
        if asset.get('sharedModelId'):
            models=self.models()
            for model in models:
                if model.get('id')==asset['sharedModelId'] and model.get('ownerId')==user_id:
                    model.update(name=asset['name'], description=asset['description'], thumbnail=asset['thumbnail'], cover=asset['thumbnail'])
            self.write_models(models)
        return asset

    def share(self, user_id, asset_id):
        rows=self.records();asset=next((a for a in rows if a.get('id')==asset_id and a.get('ownerId')==user_id),None)
        if not asset:
            raise LookupError('资产不存在或无分享权限')
        models=self.models();model=next((m for m in models if m.get('id')==asset.get('sharedModelId') and m.get('ownerId')==user_id),None)
        if not model:
            model={'id':'model-'+uuid.uuid4().hex[:12], 'uses':0, 'createdAt':self.now()};models.insert(0,model)
        model.update({k:copy.deepcopy(asset[k]) for k in ('name','description','object','thumbnail','assetType','ownerId','ownerName','ownerAvatar')})
        model.update(shared=True,cover=asset['thumbnail'],sourceAssetId=asset['id'])
        asset['sharedModelId']=model['id'];self.write_models(models);self.write(self.file,rows)
        return model

    def favorite(self, user_id, model_id, value):
        model=next((m for m in self.models() if m.get('id')==model_id and (m.get('shared') or m.get('ownerId')==user_id)),None)
        if not model:
            raise LookupError('模型分享不存在或已取消分享')
        if not isinstance(value,bool):
            raise ValueError('收藏状态无效')
        rows=self.read(self.favorites_file, {});rows=rows if isinstance(rows,dict) else {}
        selected=set(rows.get(user_id,[]))
        if value: selected.add(model_id)
        else: selected.discard(model_id)
        rows[user_id]=sorted(selected);self.write(self.favorites_file,rows)
        return {**model,'favorited':value}
