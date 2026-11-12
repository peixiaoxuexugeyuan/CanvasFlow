"""Persistent platform announcements with administrator-only mutations."""
import copy
import uuid
from pathlib import Path


class NotificationError(ValueError):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


class NotificationStore:
    def __init__(self, path, read, write, lock, now):
        self.path, self.read, self.write, self.lock, self.now = path, read, write, lock, now
        self.receipts_path = Path(path).with_name('platform-notification-receipts.json')

    def rows(self):
        rows = self.read(self.path, [])
        return rows if isinstance(rows, list) else []

    def list(self):
        with self.lock:
            rows = [dict(row, pinned=bool(row.get('pinned', False)), firstPopup=bool(row.get('firstPopup', False))) for row in self.rows()]
            return copy.deepcopy(sorted(rows, key=lambda row: (row['pinned'], row.get('updatedAt', ''), row.get('id', '')), reverse=True))

    def acknowledged(self, actor):
        if not actor or not actor.get('id'):
            raise NotificationError('请先登录', 401)
        with self.lock:
            receipts = self.read(self.receipts_path, {})
            return list(receipts.get(actor['id'], [])) if isinstance(receipts, dict) else []

    def acknowledge(self, actor, ids):
        if not actor or not actor.get('id'):
            raise NotificationError('请先登录', 401)
        if not isinstance(ids, list) or len(ids) > 200 or any(not isinstance(value, str) for value in ids):
            raise NotificationError('通知确认内容无效')
        with self.lock:
            valid = {row['id'] for row in self.rows() if row.get('firstPopup')}
            receipts = self.read(self.receipts_path, {})
            if not isinstance(receipts, dict): receipts = {}
            seen = set(receipts.get(actor['id'], []))
            seen.update(value for value in ids if value in valid)
            receipts[actor['id']] = sorted(seen)
            self.write(self.receipts_path, receipts)
            return list(receipts[actor['id']])

    def save(self, actor, fields, item_id=None):
        if not actor or actor.get('role') != 'admin':
            raise NotificationError('需要管理员权限', 403)
        if not isinstance(fields, dict):
            raise NotificationError('通知内容无效')
        title, content = fields.get('title'), fields.get('content')
        if not isinstance(title, str) or not title.strip() or len(title.strip()) > 120:
            raise NotificationError('通知标题不能为空，且不能超过 120 字')
        if not isinstance(content, str) or not content.strip() or len(content.strip()) > 10000:
            raise NotificationError('通知内容不能为空，且不能超过 10000 字')
        for key in ('pinned', 'firstPopup'):
            if key in fields and not isinstance(fields[key], bool):
                raise NotificationError('通知开关必须为开启或关闭')
        with self.lock:
            rows = self.rows()
            old = next((row for row in rows if row['id'] == item_id), None) if item_id else None
            if item_id and old is None:
                raise NotificationError('通知不存在或已删除', 404)
            stamp = self.now()
            row = dict(old or {}, id=item_id or 'notice-'+uuid.uuid4().hex[:16], title=title.strip(),
                       content=content.strip(), createdAt=(old or {}).get('createdAt', stamp), updatedAt=stamp,
                       revision=int((old or {}).get('revision', 0))+1, publisherId=actor['id'],
                       publisherName=actor.get('nickname') or actor.get('name') or 'CanvasFlow 管理员')
            for key in ('pinned', 'firstPopup'):
                row[key] = fields.get(key, bool((old or {}).get(key, False)))
            self.write(self.path, [row]+[item for item in rows if item['id'] != row['id']])
            return copy.deepcopy(row)

    def delete(self, actor, item_id):
        if not actor or actor.get('role') != 'admin':
            raise NotificationError('需要管理员权限', 403)
        with self.lock:
            rows = self.rows()
            if not any(row['id'] == item_id for row in rows):
                raise NotificationError('通知不存在或已删除', 404)
            self.write(self.path, [row for row in rows if row['id'] != item_id])
