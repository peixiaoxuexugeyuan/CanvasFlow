"""Account content quotas, renewable 30-day retention and signed media access."""
import hashlib
import hmac
import json
import mimetypes
import re
import threading
import time
from pathlib import Path
from urllib.parse import urlencode

RETENTION_SECONDS = 30 * 86400
MEDIA_NAME = re.compile(r'media-[a-f0-9]{32}\.[a-z0-9]{1,5}\Z')


class StorageError(ValueError):
    def __init__(self,message,status=400):
        super().__init__(message);self.status=status


def media_ids(value):
    if isinstance(value,dict):
        return set().union(*(media_ids(child) for child in value.values())) if value else set()
    if isinstance(value,list):return set().union(*(media_ids(child) for child in value)) if value else set()
    if not isinstance(value,str):return set()
    found=set(re.findall(r'media-[a-f0-9]{32}\.[a-z0-9]{1,5}(?=$|[^a-z0-9])',value))
    if value.lstrip().startswith(('{','[')):
        try:found.update(media_ids(json.loads(value)))
        except (ValueError,RecursionError):pass
    return found


def content_size(value):
    if '_storageBytes' in value:return value['_storageBytes']
    text=json.dumps(value,ensure_ascii=False,indent=2)
    return len(text.encode('utf-8'))+2*len(text.splitlines())+2


class AccountStorage:
    def __init__(self,directory,db,records,remove_record,secret,default_quota=3*1024**3,clock=time.time,expire_record=None):
        self.directory,self.db,self.records,self.remove_record=Path(directory),db,records,remove_record
        self.secret,self.default_quota,self.clock=secret if isinstance(secret,bytes) else secret.encode(),default_quota,clock
        self.lock=threading.RLock();self.last_sync=float('-inf')
        self.expire_record=expire_record
        with self.db() as connection:
            connection.executescript('''CREATE TABLE IF NOT EXISTS media_storage (
                media_id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,name TEXT NOT NULL,mime TEXT NOT NULL,
                size INTEGER NOT NULL,created_at REAL NOT NULL,expires_at REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS account_storage_limits (user_id TEXT PRIMARY KEY,quota_bytes INTEGER NOT NULL);
                CREATE TABLE IF NOT EXISTS content_retention (kind TEXT NOT NULL,item_id TEXT NOT NULL,owner_id TEXT NOT NULL,
                expires_at REAL NOT NULL,PRIMARY KEY(kind,item_id));''')
            if 'sha256' not in {row[1] for row in connection.execute('PRAGMA table_info(media_storage)')}:
                connection.execute('ALTER TABLE media_storage ADD COLUMN sha256 TEXT')

    def sync(self,force=False):
        stamp=self.clock()
        with self.lock:
            if not force and stamp-self.last_sync<15:return
            records=self.records()
            with self.db() as connection:
                existing={row[0] for row in connection.execute('SELECT media_id FROM media_storage')}
                fallback=connection.execute("SELECT id FROM users WHERE role='admin' ORDER BY created_at LIMIT 1").fetchone()
                fallback=fallback[0] if fallback else ''
                owners={}
                for kind,item in records:
                    owner=item.get('ownerId') or item.get('userId')
                    if not owner:continue
                    for media_id in media_ids(item):owners.setdefault(media_id,(owner,str(item.get('name') or item.get('projectName') or item.get('prompt') or media_id)[:160]))
                    if kind in ('asset','music','model','previs','job','role') and item.get('id'):
                        connection.execute('INSERT OR IGNORE INTO content_retention VALUES (?,?,?,?)',(kind,str(item['id']),owner,stamp+RETENTION_SECONDS))
                for file in self.directory.iterdir():
                    if not file.is_file() or not MEDIA_NAME.fullmatch(file.name) or file.name in existing:continue
                    owner,name=owners.get(file.name,(fallback,'历史未归属文件 · '+file.name))
                    if not owner:continue
                    connection.execute('INSERT OR IGNORE INTO media_storage (media_id,owner_id,name,mime,size,created_at,expires_at) VALUES (?,?,?,?,?,?,?)',
                                       (file.name,owner,name,mimetypes.guess_type(file.name)[0] or 'application/octet-stream',file.stat().st_size,stamp,stamp+RETENTION_SECONDS))
            self.last_sync=stamp

    def quota(self,user_id,connection=None):
        if connection is None:
            with self.db() as db:return self.quota(user_id,db)
        row=connection.execute('SELECT quota_bytes FROM account_storage_limits WHERE user_id=?',(user_id,)).fetchone()
        return row[0] if row else self.default_quota

    def set_quota(self,user_id,quota,connection=None):
        if type(quota) is not int or not 0<=quota<=100*1024**4:raise StorageError('空间配额必须在 0 至 100 TB 之间')
        if connection is None:
            with self.db() as db:return self.set_quota(user_id,quota,db)
        connection.execute('INSERT OR REPLACE INTO account_storage_limits VALUES (?,?)',(user_id,quota))

    def metadata_bytes(self,user_id):
        return sum(content_size(item) for _,item in self.records() if (item.get('ownerId') or item.get('userId'))==user_id)

    def used(self,user_id,connection=None):
        if connection is None:
            with self.db() as db:return self.used(user_id,db)
        files=sum(size for name,size in connection.execute('SELECT media_id,size FROM media_storage WHERE owner_id=?',(user_id,)) if (self.directory/name).is_file())
        return files+self.metadata_bytes(user_id)

    def ensure(self,user_id,extra):
        self.sync()
        with self.db() as db:
            if extra>0 and self.used(user_id,db)+extra>self.quota(user_id,db):raise StorageError('账户空间不足，请删除内容或联系管理员调整配额',413)

    def write(self,user_id,media_id,raw,mime,name):
        if not user_id:raise StorageError('媒体缺少所属账户',401)
        if not MEDIA_NAME.fullmatch(media_id):raise StorageError('文件名无效')
        with self.lock:
            digest=hashlib.sha256(raw).hexdigest();stamp=self.clock()
            with self.db() as db:
                for existing, in db.execute('SELECT media_id FROM media_storage WHERE owner_id=? AND sha256=? AND mime=?',(user_id,digest,mime)):
                    if (self.directory/existing).is_file():
                        db.execute('UPDATE media_storage SET expires_at=? WHERE media_id=?',(stamp+RETENTION_SECONDS,existing))
                        return existing
            self.ensure(user_id,len(raw))
            file=self.directory/media_id
            try:
                file.write_bytes(raw)
                with self.db() as db:db.execute('INSERT INTO media_storage (media_id,owner_id,name,mime,size,created_at,expires_at,sha256) VALUES (?,?,?,?,?,?,?,?)',(media_id,user_id,str(name or media_id)[:160],mime,len(raw),stamp,stamp+RETENTION_SECONDS,digest))
            except Exception:
                file.unlink(missing_ok=True);raise
            return media_id

    def file_row(self,media_id):
        if not MEDIA_NAME.fullmatch(str(media_id)):return None
        self.sync()
        with self.db() as db:
            row=db.execute('SELECT media_id,owner_id,name,mime,size,created_at,expires_at FROM media_storage WHERE media_id=?',(media_id,)).fetchone()
        if not row and (self.directory/media_id).is_file():
            self.sync(force=True)
            with self.db() as db:row=db.execute('SELECT media_id,owner_id,name,mime,size,created_at,expires_at FROM media_storage WHERE media_id=?',(media_id,)).fetchone()
        return dict(zip(('mediaId','ownerId','name','mime','size','createdAt','expiresAt'),row)) if row else None

    def public(self,media_id):
        # Explicit public portfolio entries may publish a cover or media without publishing a workflow.
        with self.db() as db:
            row=db.execute('SELECT owner_id FROM media_storage WHERE media_id=?',(media_id,)).fetchone()
        if not row:return False
        for kind,item in self.records():
            if (item.get('ownerId') or item.get('userId'))!=row[0]:continue
            if (item.get('shared') is True or kind=='music' and item.get('shared',True) is True or kind=='portfolio' and item.get('isPublic') is True) and media_id in media_ids(item):return True
        return False

    def can_read(self,media_id,user_id='',signature='',expires=''):
        row=self.file_row(media_id)
        if not row or row['expiresAt']<=self.clock() or not (self.directory/media_id).is_file():return False
        if user_id and row['ownerId']==user_id:return True
        if self.public(media_id):return True
        if self.valid_signature(media_id,signature,expires):return True
        return False

    def signature(self,media_id,expires):
        return hmac.new(self.secret,f'media:{media_id}:{expires}'.encode(),hashlib.sha256).hexdigest()

    def valid_signature(self,media_id,signature,expires):
        if not MEDIA_NAME.fullmatch(media_id) or not isinstance(signature,str):return False
        try:expiry=int(expires)
        except (TypeError,ValueError):return False
        if expiry<=self.clock() or expiry>self.clock()+86400:return False
        return hmac.compare_digest(signature,self.signature(media_id,str(expiry)))

    def signed_url(self,media_id,seconds=3600):
        expires=str(int(self.clock()+min(max(seconds,1),86400)))
        return '/media/'+media_id+'?'+urlencode({'expires':expires,'signature':self.signature(media_id,expires)})

    def items(self,user_id):
        self.sync(force=True)
        stamp=self.clock()
        with self.db() as db:
            files=[]
            for row in db.execute('SELECT media_id,name,mime,size,created_at,expires_at FROM media_storage WHERE owner_id=? ORDER BY created_at DESC',(user_id,)):
                if not (self.directory/row[0]).is_file():continue
                files.append(dict(id='file:'+row[0],mediaId=row[0],name=row[1],mime=row[2],size=row[3],createdAt=row[4],expiresAt=row[5],url='/media/'+row[0],kind='file',expired=row[5]<=stamp))
            lifetimes={(kind,id):expiry for kind,id,expiry in db.execute('SELECT kind,item_id,expires_at FROM content_retention WHERE owner_id=?',(user_id,))}
        for kind,item in self.records():
            if (item.get('ownerId') or item.get('userId'))!=user_id or not item.get('id'):continue
            protected=kind in ('project','portfolio','settings','session','share','skill')
            key=(kind,str(item['id']))
            files.append(dict(id=kind+':'+str(item['id']),kind=kind,name=str(item.get('projectName') or item.get('name') or item.get('title') or item.get('prompt') or '生成记录')[:160],
                              size=content_size(item),expiresAt=lifetimes.get(key),mime='application/json',url='',expired=False,protected=protected,
                              sourceId=str(item['id']),workspaceId=item.get('workspaceId','')))
        return files

    def renew(self,user_id,item_id):
        self.sync(force=True)
        expiry=self.clock()+RETENTION_SECONDS
        kind,_,id=item_id.partition(':')
        with self.lock:
            with self.db() as db:
                if kind=='file':
                    row=db.execute('SELECT owner_id,expires_at FROM media_storage WHERE media_id=?',(id,)).fetchone()
                    if not row or row[0]!=user_id:raise StorageError('只能保存自己的文件',403)
                    if not (self.directory/id).is_file():raise StorageError('文件已清理，不能续期',410)
                    db.execute('UPDATE media_storage SET expires_at=? WHERE media_id=?',(expiry,id))
                    for group,item in self.records():
                        if group in ('asset','music','model','previs','job','role') and (item.get('ownerId') or item.get('userId'))==user_id and id in media_ids(item):
                            db.execute('UPDATE content_retention SET expires_at=? WHERE kind=? AND item_id=? AND owner_id=?',(expiry,group,str(item.get('id')),user_id))
                else:
                    row=db.execute('SELECT owner_id FROM content_retention WHERE kind=? AND item_id=?',(kind,id)).fetchone()
                    if not row or row[0]!=user_id:raise StorageError('只能保存自己的素材或生成记录',403)
                    source=next((item for group,item in self.records() if group==kind and str(item.get('id'))==id and (item.get('ownerId') or item.get('userId'))==user_id),{})
                    if not source:raise StorageError('内容已删除，不能续期',410)
                    db.execute('UPDATE content_retention SET expires_at=? WHERE kind=? AND item_id=?',(expiry,kind,id))
                    for media_id in media_ids(source):db.execute('UPDATE media_storage SET expires_at=? WHERE media_id=? AND owner_id=?',(expiry,media_id,user_id))
            return {'expiresAt':expiry}

    def delete(self,user_id,item_id):
        kind,_,id=item_id.partition(':')
        if kind=='file':
            row=self.file_row(id)
            if not row or row['ownerId']!=user_id:raise StorageError('只能删除自己的文件',403)
            with self.lock:
                (self.directory/id).unlink(missing_ok=True)
                with self.db() as db:db.execute('DELETE FROM media_storage WHERE media_id=? AND owner_id=?',(id,user_id))
        else:
            allowed=next((item for group,item in self.records() if group==kind and str(item.get('id'))==id and (item.get('ownerId') or item.get('userId'))==user_id),None)
            if not allowed or kind not in ('asset','music','model','previs','job','role'):raise StorageError('不能删除这项内容',403)
            if kind=='job' and allowed.get('status') in ('queued','running','processing'):
                raise StorageError('任务仍在执行，请等待任务结束后删除历史',409)
            self.remove_record(kind,id,user_id)
            with self.db() as db:db.execute('DELETE FROM content_retention WHERE kind=? AND item_id=? AND owner_id=?',(kind,id,user_id))

    def cleanup(self):
        self.sync(force=True);stamp=self.clock()
        with self.db() as db:
            files=list(db.execute('SELECT media_id,owner_id FROM media_storage WHERE expires_at<=?',(stamp,)))
            records=list(db.execute('SELECT kind,item_id,owner_id FROM content_retention WHERE expires_at<=?',(stamp,)))
        for id,owner in files:
            with self.lock:
                current=self.file_row(id)
                if current and current['expiresAt']<=stamp:self.delete(owner,'file:'+id)
        for kind,id,owner in records:
            source=next((item for group,item in self.records() if group==kind and str(item.get('id'))==id),None)
            if source and kind=='job' and source.get('status') in ('queued','running','processing'):continue
            if source:
                if self.expire_record:self.expire_record(kind,id,owner,stamp)
                else:
                    with self.lock:
                        with self.db() as db:row=db.execute('SELECT expires_at FROM content_retention WHERE kind=? AND item_id=?',(kind,id)).fetchone()
                        if row and row[0]<=stamp:self.delete(owner,kind+':'+id)
            else:
                with self.db() as db:db.execute('DELETE FROM content_retention WHERE kind=? AND item_id=?',(kind,id))
