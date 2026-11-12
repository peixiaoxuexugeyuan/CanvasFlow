"""Curated, account-owned portfolios; publication never publishes source projects."""
import copy
import re
import uuid
from previs_assets import clean_thumbnail


class PortfolioError(ValueError):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


class PortfolioStore:
    def __init__(self, path, read, write, lock, projects, assets, music, now):
        self.path, self.read, self.write, self.lock = path, read, write, lock
        self.readers = {'project': projects, 'asset': assets, 'music': music}
        self.now = now

    def rows(self):
        # A missing portfolio stays empty without creating data on a public visit.
        if not self.path.exists(): return []
        rows = self.read(self.path, [])
        if not isinstance(rows, list): raise PortfolioError('作品集数据格式无效', 503)
        return rows

    def source_map(self):
        return {(kind, str(item.get('id'))): item for kind, reader in self.readers.items()
                for item in reader() if isinstance(item, dict)}

    def thumbnail(self, value):
        try: return clean_thumbnail(value)
        except ValueError as error: raise PortfolioError(str(error)) from error

    def media(self, source):
        value = source.get('mediaUrl') or source.get('data') or ''
        if isinstance(value, str) and re.fullmatch(r'/media/media-[a-f0-9]{32}\.[a-z0-9]{1,5}', value): return value
        # Small legacy images can still be displayed; arbitrary URLs are never copied.
        if source.get('kind') == 'image':
            try: return self.thumbnail(value)
            except PortfolioError: pass
        return ''

    def describe_source(self, kind, source):
        label = '项目' if kind == 'project' else '音频' if kind == 'music' else {'image':'图片','video':'视频','audio':'音频'}.get(source.get('kind'), '')
        if not label: return None
        cover = source.get('thumbnail') or source.get('cover') or (self.media(source) if source.get('kind') == 'image' else '')
        try: cover = self.thumbnail(cover)
        except PortfolioError: cover = ''
        return {'sourceKind':kind, 'sourceId':str(source['id']), 'name':source.get('projectName') or source.get('name') or '未命名作品',
                'kind':label, 'thumbnail':cover, 'workspaceId':source.get('workspaceId',''),
                'mediaUrl':self.media(source), 'updatedAt':source.get('updatedAt','')}

    def sources(self, user_id):
        with self.lock:
            chosen = {(row['sourceKind'], row['sourceId']) for row in self.rows() if row.get('ownerId') == user_id}
            items = []
            for (kind, _), source in self.source_map().items():
                if source.get('ownerId') != user_id: continue
                item = self.describe_source(kind, source)
                if item:
                    item['added'] = (kind,item['sourceId']) in chosen
                    items.append(item)
            return sorted(items, key=lambda item: item['updatedAt'], reverse=True)

    def view(self, row, sources, own):
        source = sources.get((row['sourceKind'], row['sourceId']))
        available = bool(source and source.get('ownerId') == row['ownerId'])
        result = {key:copy.deepcopy(row.get(key)) for key in ('id','name','description','thumbnail','kind','isPublic','createdAt','updatedAt','revision')}
        result.update(available=available, mediaUrl=row.get('mediaUrl',''), sourceKind=row['sourceKind'],
                      canOpen=available and (own or bool(source.get('shared'))))
        if own or result['canOpen']: result['sourceId'] = row['sourceId']
        if own and source: result['workspaceId'] = source.get('workspaceId','')
        # Private project nodes, prompts, director scenes and workflow settings are never sent.
        return result

    def list(self, user_id, own=True):
        with self.lock:
            sources = self.source_map()
            rows = sorted((row for row in self.rows() if row.get('ownerId') == user_id and (own or row.get('isPublic') is True)),
                          key=lambda row: row.get('order',0))
            result = [self.view(row,sources,own) for row in rows]
            return result if own else [row for row in result if row['available']]

    def save(self, actor, fields, item_id=None):
        if not isinstance(fields, dict): raise PortfolioError('作品内容无效')
        name, description = fields.get('name'), fields.get('description','')
        if not isinstance(name,str) or not name.strip() or len(name.strip()) > 120: raise PortfolioError('名称不能为空，且不能超过 120 字')
        if not isinstance(description,str) or len(description) > 1500: raise PortfolioError('描述不能超过 1500 字')
        if 'isPublic' in fields and not isinstance(fields['isPublic'],bool): raise PortfolioError('作品公开设置无效')
        with self.lock:
            rows = self.rows()
            old = next((row for row in rows if row['id'] == item_id),None) if item_id else None
            if item_id and not old: raise PortfolioError('作品不存在',404)
            if old and old['ownerId'] != actor['id']: raise PortfolioError('只能编辑自己的作品',403)
            if old and (type(fields.get('revision')) is not int or fields['revision'] != old['revision']): raise PortfolioError('作品已更新，请刷新后重试',409)
            kind = old['sourceKind'] if old else fields.get('sourceKind')
            source_id = old['sourceId'] if old else fields.get('sourceId')
            if not isinstance(kind,str) or kind not in self.readers or not isinstance(source_id,str): raise PortfolioError('请选择有效的作品来源')
            source_map = self.source_map()
            source = source_map.get((kind,source_id))
            available = bool(source and source.get('ownerId') == actor['id'])
            if not old and not available: raise PortfolioError('只能添加自己的项目或素材',403)
            public = fields.get('isPublic',old.get('isPublic',False) if old else False)
            if public and not available: raise PortfolioError('原项目或素材已移除，不能公开展示')
            if not old:
                owned = [row for row in rows if row['ownerId'] == actor['id']]
                if len(owned) >= 100: raise PortfolioError('作品集最多保存 100 项作品')
                if any(row['sourceKind']==kind and row['sourceId']==source_id for row in owned): raise PortfolioError('这个内容已经加入作品集',409)
                detail = self.describe_source(kind,source)
                if not detail: raise PortfolioError('该素材类型不支持加入作品集')
                old = {'id':'work-'+uuid.uuid4().hex[:16], 'ownerId':actor['id'],'sourceKind':kind,'sourceId':source_id,
                       'createdAt':self.now(),'revision':0,'kind':detail['kind'],'thumbnail':detail['thumbnail'],
                       'mediaUrl':detail['mediaUrl'], 'order':max((row.get('order',0) for row in owned),default=-1)+1}
            row = dict(old, name=name.strip(), description=description.strip(), isPublic=public,
                       updatedAt=self.now(), revision=old['revision']+1)
            if 'thumbnail' in fields: row['thumbnail'] = self.thumbnail(fields['thumbnail'])
            self.write(self.path,[row if item['id']==row['id'] else item for item in rows] if item_id else rows+[row])
            return self.view(row,source_map,True)

    def reorder(self, user_id, ids):
        if not isinstance(ids,list) or any(not isinstance(i,str) for i in ids) or len(set(ids)) != len(ids): raise PortfolioError('作品顺序无效')
        with self.lock:
            rows = self.rows()
            owned = [row for row in rows if row['ownerId']==user_id]
            if set(ids) != {row['id'] for row in owned}: raise PortfolioError('作品列表已变化，请刷新后重试',409)
            order = {id:index for index,id in enumerate(ids)}
            for row in owned: row['order']=order[row['id']]
            self.write(self.path,rows)

    def delete(self, user_id, item_id):
        with self.lock:
            rows = self.rows()
            target = next((row for row in rows if row['id']==item_id),None)
            if not target: raise PortfolioError('作品不存在',404)
            if target['ownerId'] != user_id: raise PortfolioError('只能移除自己的作品',403)
            self.write(self.path,[row for row in rows if row['id']!=item_id])
