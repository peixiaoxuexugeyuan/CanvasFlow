"""Compatibility for a single-machine CanvasFlow installation.

The fixed storage key is internal: there are no accounts, sessions or plans.
Legacy records are adapted when read, keeping the original files intact.
"""
from pathlib import Path
import hashlib
import os
import posixpath
from account_storage import AccountStorage, MEDIA_NAME

LOCAL_ID = 'local-device'
LOCAL_WORKSPACE = 'workspace-default-local-device'
LOCAL_CONTEXT = {'id': LOCAL_ID, 'nickname': '本地工作台', 'avatar': '本',
                 'email': '', 'phone': '', 'role': 'admin', 'local': True}


def installation_id(root, data):
    """Opaque identity prevents a second checkout opening the first one's data."""
    paths = [os.path.normcase(str(Path(path).resolve())) for path in (root, data)]
    return hashlib.sha256('\0'.join(paths).encode('utf-8')).hexdigest()[:24]


class LocalStorage(AccountStorage):
    """Keep media permanently, bounded only by the local disk."""
    def quota(self, user_id, connection=None):
        return float('inf')

    def ensure(self, user_id, extra):
        return None

    def can_read(self, media_id, user_id='', signature='', expires=''):
        # The caller already validates media file names; no account/signature expiry.
        return bool(MEDIA_NAME.fullmatch(str(media_id))) and (self.directory / media_id).is_file()

    def file_row(self, media_id):
        row = super().file_row(media_id)
        if row:
            row['ownerId'] = LOCAL_ID
        return row

    def cleanup(self):
        return None

CONTENT_FILES = {'projects.json', 'assets.json', 'music.json', 'models.json',
                 'ai-models.json', 'agent-sessions.json', 'agent-skills.json',
                 'previs-assets.json'}


def local_content(path, value):
    name = Path(path).name
    if name == 'workspaces.json' and isinstance(value, list):
        result = []
        for source in value:
            row = dict(source, userId=LOCAL_ID, type='本地空间')
            if row.get('isDefault') or str(row.get('id', '')).startswith('workspace-default-'):
                if any(item.get('id') == LOCAL_WORKSPACE for item in result):
                    continue
                row.update(id=LOCAL_WORKSPACE, isDefault=True, name='本地工作区')
            result.append(row)
        return result
    if name in CONTENT_FILES and isinstance(value, list):
        for row in value:
            if not isinstance(row, dict):
                continue
            if name == 'ai-models.json':
                # One local model catalogue, including former private providers.
                row['ownerId'] = ''
            else:
                if 'userId' in row:
                    row['userId'] = LOCAL_ID
                row['ownerId'] = LOCAL_ID
                if not row.get('workspaceId') or str(row['workspaceId']).startswith('workspace-default-'):
                    row['workspaceId'] = LOCAL_WORKSPACE
                row['shared'] = False
        return value
    if name == 'preset-roles.json' and isinstance(value, dict):
        buckets = list((value.get('users') or {}).values())
        if buckets:
            merged = {'deleted': [], 'overrides': {}, 'custom': []}
            for bucket in buckets:
                merged['deleted'].extend(bucket.get('deleted') or [])
                merged['overrides'].update(bucket.get('overrides') or {})
                merged['custom'].extend(bucket.get('custom') or [])
            merged['deleted'] = list(dict.fromkeys(merged['deleted']))
            merged['custom'] = list({item['id']: item for item in merged['custom'] if item.get('id')}.values())
            value['users'] = {LOCAL_ID: merged}
    if name == 'model-favorites.json' and isinstance(value, dict):
        value = {LOCAL_ID: list(dict.fromkeys(item for rows in value.values() for item in rows))}
    return value


def local_job(job):
    job['userId'] = LOCAL_ID
    if not job.get('workspaceId') or str(job['workspaceId']).startswith('workspace-default-'):
        job['workspaceId'] = LOCAL_WORKSPACE
    return job


def retired_route(path):
    """Removed platform features cannot be reopened through an old link/API."""
    path = posixpath.normpath('/' + path.replace('\\','/').lstrip('/'))
    prefixes = ('/api/auth', '/api/account', '/api/community', '/api/social',
                '/api/portfolio', '/api/share', '/api/agent/share', '/api/notifications',
                '/api/admin/users', '/api/admin/overview', '/api/admin/credit-history',
                '/api/admin/plans', '/api/admin/notifications', '/api/credits',
                '/api/subscription-plans', '/api/storage', '/api/favorites',
                '/api/likes', '/api/follows',
                '/portfolio/', '/previs/', '/learn', '/learnapi')
    return (any(path == prefix or path.startswith(prefix + '/') or
                (prefix.endswith('/') and path.startswith(prefix)) for prefix in prefixes)
            or path in ('/share.html', '/portfolio-view.html', '/previs-view.html',
                        '/support.js', '/notifications.js', '/notifications.css',
                        '/community-editor.js', '/portfolio.js', '/director-share.js')
            or path.startswith('/api/previs/projects/') and path.endswith(('/share', '/view'))
            or path.startswith('/api/previs/assets/') and path.endswith('/share')
            or path.startswith('/api/assets/') and path.endswith('/share')
            or path.startswith('/api/models') and not path.endswith('/favorite'))
