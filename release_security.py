"""Constrain a production release to verified public artifacts, never source files."""
import hashlib
import json
from pathlib import Path
from request_security import public_static_path


class PublicFiles:
    def __init__(self, application_root, configured_root=''):
        self.application_root = Path(application_root).resolve()
        candidate = Path(configured_root) if configured_root else self.application_root / 'public'
        if candidate.is_symlink() or (hasattr(candidate, 'is_junction') and candidate.is_junction()):
            raise RuntimeError('发布目录不能是文件系统链接')
        candidate = candidate.resolve()
        self.release = bool(configured_root) or candidate.is_dir() or (self.application_root / 'release-manifest.json').is_file()
        self.root = candidate if self.release else self.application_root
        self.files = None
        if not self.release:
            return
        if self.root == self.application_root or self.application_root in self.root.parents and self.root.name != 'public':
            raise RuntimeError('发布资源必须使用独立的 public 目录')
        manifest = json.loads((self.application_root / 'release-manifest.json').read_text(encoding='utf-8'))
        if manifest.get('version') != 1 or not isinstance(manifest.get('files'), dict):
            raise RuntimeError('发布文件清单无效')
        self.files = manifest['files']
        for relative, expected in self.files.items():
            if not isinstance(relative, str) or Path(relative).is_absolute() or '..' in Path(relative).parts:
                raise RuntimeError('发布清单包含无效路径')
            path = self.root / relative
            if not self._inside(path) or not path.is_file() or not isinstance(expected, str):
                raise RuntimeError('发布清单包含无效文件')
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            if digest != expected:
                raise RuntimeError('发布文件校验失败：' + relative)
        if 'index.html' not in self.files:
            raise RuntimeError('发布入口缺失')

    def _inside(self, target):
        raw = Path(target)
        try:
            relative = raw.relative_to(self.root)
            resolved = raw.resolve().relative_to(self.root.resolve())
        except (OSError, ValueError):
            return False
        if relative != resolved or any(p in {'.', '..'} or p.startswith('.') for p in relative.parts):
            return False
        current = self.root
        for part in relative.parts:
            current = current / part
            if current.is_symlink() or (hasattr(current, 'is_junction') and current.is_junction()):
                return False
        return True

    def allowed(self, target):
        if not public_static_path(target, self.root):
            return False
        if not self.release:
            return True
        if not self._inside(target):
            return False
        relative = Path(target).relative_to(self.root).as_posix()
        # SimpleHTTPRequestHandler checks the root before resolving its index.
        return relative == '.' or relative in self.files
