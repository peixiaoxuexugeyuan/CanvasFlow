"""Read-only bridge to the reviewed community library. Never forwards local credentials."""
import json
import re
import threading
import time
from pathlib import Path
from urllib import request, error

ORIGIN = 'https://skill.zzzapi.xyz'
MAX_BYTES = 12 * 1024 * 1024
ID = re.compile(r'[A-Za-z0-9_-]{1,100}\Z')


class CommunityError(ValueError):
    def __init__(self, message, status=502):
        super().__init__(message)
        self.status = status


class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise CommunityError('社区接口地址发生变化，请稍后重试')


def read_public(path):
    # Only callers below construct paths; redirects cannot turn this into an arbitrary proxy.
    req = request.Request(ORIGIN + '/api/library' + path,
                          headers={'Accept': 'application/json', 'User-Agent': 'CanvasFlow/1.0 CommunitySync'})
    with request.build_opener(NoRedirect()).open(req, timeout=15) as response:
        raw = response.read(MAX_BYTES + 1)
    if len(raw) > MAX_BYTES:
        raise CommunityError('社区技能数据超出大小限制')
    return json.loads(raw)


def validate_item(item):
    if not isinstance(item, dict) or not ID.fullmatch(str(item.get('id', ''))):
        raise CommunityError('社区技能标识无效')
    if not isinstance(item.get('name'), str) or not item['name'].strip():
        raise CommunityError('社区技能名称无效')
    if not re.fullmatch(r'[a-f0-9]{64}', str(item.get('contentHash', ''))):
        raise CommunityError('社区技能版本无效')
    if not isinstance(item.get('fileCount'), int) or not 1 <= item['fileCount'] <= 500:
        raise CommunityError('社区技能包不完整')
    if item.get('demo') or item.get('missingReferences'):
        raise CommunityError('社区技能包不完整')
    return item


def validate_catalog(data):
    if not isinstance(data, dict) or data.get('schemaVersion') != 1 or not isinstance(data.get('skills'), list) or len(data['skills']) > 10000:
        raise CommunityError('社区技能目录格式不正确')
    ids = set()
    for item in data['skills']:
        validate_item(item)
        if item['id'] in ids:
            raise CommunityError('社区技能目录存在重复条目')
        ids.add(item['id'])
    return {'schemaVersion': 1, 'skills': data['skills'], 'count': len(ids)}


def validate_package(data, ident):
    skill = data.get('skill') if isinstance(data, dict) else None
    if not isinstance(skill, dict) or skill.get('id') != ident:
        raise CommunityError('社区技能文件与目录不匹配')
    files = skill.get('files')
    if not isinstance(files, list) or not 1 <= len(files) <= 500 or skill.get('missingReferences'):
        raise CommunityError('社区技能包不完整')
    paths = set()
    for file in files:
        if not isinstance(file, dict):
            raise CommunityError('社区技能文件无效')
        path, content = file.get('path'), file.get('content')
        if not isinstance(path, str) or len(path) > 500 or re.search(r'[\\:\x00-\x1f]', path) or any(p in ('', '.', '..') for p in path.split('/')):
            raise CommunityError('社区技能文件路径无效')
        if path.lower() in paths or not isinstance(content, str) or not content.strip():
            raise CommunityError('社区技能文件重复或内容为空')
        paths.add(path.lower())
    if not any(f['path'] == skill.get('primarySkillFilePath') for f in files):
        raise CommunityError('社区技能缺少主文件')
    validate_item(dict(skill, fileCount=len(files)))
    return data


class CommunitySkills:
    def __init__(self, cache_file, fetch=read_public, clock=time.time):
        self.cache_file = Path(cache_file)
        self.fetch, self.clock = fetch, clock
        self.lock = threading.Lock()
        self.snapshot = None
        self.synced_at = self.attempted_at = 0
        self.failed = False
        try:
            cached = json.loads(self.cache_file.read_text(encoding='utf-8'))
            self.snapshot = validate_catalog(cached)
            self.synced_at = float(cached['syncedAt'])
        except (OSError, ValueError, KeyError, TypeError):
            pass

    def catalog(self, force=False):
        with self.lock:
            now = self.clock()
            interval = 5 if force else 60
            if not self.attempted_at or now - self.attempted_at >= interval:
                self.attempted_at = now
                try:
                    snapshot = validate_catalog(self.fetch(''))
                    self.snapshot, self.synced_at, self.failed = snapshot, now, False
                    try:
                        self.cache_file.parent.mkdir(parents=True, exist_ok=True)
                        temp = self.cache_file.with_suffix('.tmp')
                        temp.write_text(json.dumps(dict(snapshot, syncedAt=now), ensure_ascii=False), encoding='utf-8')
                        temp.replace(self.cache_file)
                    except OSError:
                        pass  # Read-only disks must not prevent online use.
                except (OSError, ValueError, TypeError, KeyError):
                    self.failed = True
            if self.snapshot is None:
                raise CommunityError('暂时无法连接技能社区，本地技能仍可使用')
            return dict(self.snapshot, syncedAt=self.synced_at, stale=self.failed, source=ORIGIN)

    def detail(self, ident):
        if not ID.fullmatch(ident):
            raise CommunityError('技能标识无效', 400)
        try:
            # Revalidate publication on every use, including previously opened packages.
            return validate_package(self.fetch('/' + ident), ident)
        except error.HTTPError as exc:
            if exc.code == 404:
                raise CommunityError('该社区 Skill 已下架或不存在，请同步技能库', 404) from None
            raise CommunityError('社区技能暂时无法读取，请重试') from None
        except (OSError, ValueError, TypeError, KeyError) as exc:
            if isinstance(exc, CommunityError):
                raise
            raise CommunityError('社区技能暂时无法读取，请重试') from None
