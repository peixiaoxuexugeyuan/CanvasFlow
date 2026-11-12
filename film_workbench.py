"""Private, workspace-scoped OpenFilm processes; no provider credentials are shared."""
import atexit
import hashlib
import json
import os
from pathlib import Path
import queue
import subprocess
import threading
import time
import uuid


class FilmUnavailable(RuntimeError):
    pass


class FilmWorkbench:
    def __init__(self, root, data_dir):
        self.root, self.data_dir = Path(root), Path(data_dir)
        self.lock = threading.RLock()
        self.workers = {}
        self.callbacks = {}
        atexit.register(self.close)

    def _start(self, workspace, project_key):
        node = self.root / '.runtime/node/node.exe'
        script = self.root / 'tools/openfilm/bridge.mjs'
        package = self.root / 'tools/openfilm/node_modules/openfilm/package.json'
        if not all(p.is_file() for p in (node, script, package)):
            raise FilmUnavailable('成片编辑器运行组件尚未安装，请按 FILM_WORKBENCH.md 准备运行环境。')
        workspace_home = self.data_dir / 'films' / hashlib.sha256(workspace.encode()).hexdigest()[:24]
        project_hash = hashlib.sha256(project_key.encode()).hexdigest()[:24]
        directory = workspace_home / 'scopes' / project_hash
        # Keep existing film/media files in place. Only the editor's registry,
        # asset library, saved items and sessions become project-local.
        project_root = workspace_home / 'projects' / project_hash
        directory.mkdir(parents=True, exist_ok=True)
        # Only OS/runtime variables: never inherit model keys or another OpenFilm profile.
        keep = {'systemroot', 'windir', 'temp', 'tmp', 'comspec', 'pathext', 'localappdata', 'appdata', 'userprofile', 'programfiles', 'programfiles(x86)', 'programdata', 'path'}
        env = {k: v for k, v in os.environ.items() if k.lower() in keep}
        ffmpeg = list((self.root / '.runtime/openfilm-ffmpeg').glob('*/bin'))
        env['PATH'] = os.pathsep.join([str(node.parent), *(str(p) for p in ffmpeg), env.get('PATH', '')])
        git = self.root / '.runtime/openfilm-git/cmd'
        if git.is_dir(): env['PATH'] = str(git) + os.pathsep + env['PATH']
        env['PLAYWRIGHT_BROWSERS_PATH'] = str(self.root / '.runtime/openfilm-browser')
        for key, folder in [('OPENFILM_HOME', 'settings'), ('OPENFILM_SHARED_HOME', 'settings'),
                            ('OPENFILM_LIBRARY', 'projects'), ('OPENFILM_SAVED', 'saved'), ('OPENFILM_EXPORTS', 'exports')]:
            env[key] = str(directory / folder)
        env['OPENFILM_NO_UPDATE_CHECK'] = '1'
        env['OPENFILM_LIBRARY'] = str(project_root)
        log = (directory / 'runtime.log').open('a', encoding='utf-8')
        try:
            proc = subprocess.Popen([str(node), str(script), str(directory), str(os.getpid()), str(project_root), project_key],
                cwd=str(script.parent), env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                stderr=log, text=True, encoding='utf-8', creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        except OSError as exc:
            log.close()
            raise FilmUnavailable('无法启动成片编辑器运行进程') from exc
        replies = queue.Queue()
        input_lock = threading.Lock()
        def callback(message):
            try:
                handler = self.callbacks.get(workspace)
                if not handler: raise ValueError('请先在 CanvasFlow 中打开当前工作区的成片')
                result = handler(message.get('method'),message.get('args') or {})
                response = {'callbackResult':message['callback'],'result':result}
            except Exception as exc:
                response = {'callbackResult':message['callback'],'error':str(exc)[:1000]}
            try:
                with input_lock:
                    proc.stdin.write(json.dumps(response,ensure_ascii=False)+'\n');proc.stdin.flush()
            except (OSError,ValueError): pass
        def read():
            try:
                for line in proc.stdout:
                    if line.startswith('CANVASFLOW_FILM '):
                        try:
                            message=json.loads(line[len('CANVASFLOW_FILM '):])
                            if message.get('callback'): threading.Thread(target=callback,args=(message,),daemon=True).start()
                            else: replies.put(message)
                        except ValueError: pass
            finally:
                proc.stdout.close()
                replies.put({'error': '成片编辑器进程已退出，请重试'})
        threading.Thread(target=read, daemon=True).start()
        worker = (proc, replies, log)
        proc.film_input_lock = input_lock
        proc.film_call_lock = threading.RLock()
        try:
            ready = replies.get(timeout=30)
            if not ready.get('ready'): raise FilmUnavailable(ready.get('error', '成片编辑器启动失败'))
        except (queue.Empty, FilmUnavailable) as exc:
            self._stop(worker)
            raise FilmUnavailable('成片编辑器启动失败，请查看当前工作区的成片运行日志') from exc
        self.workers[(workspace, project_key)] = worker
        return worker

    @staticmethod
    def _stop(worker):
        proc, _, log = worker
        try:
            if proc.stdin: proc.stdin.close()
            try: proc.wait(timeout=6)
            except subprocess.TimeoutExpired:
                proc.terminate()
                proc.wait(timeout=6)
        except (OSError, subprocess.TimeoutExpired):
            if proc.poll() is None:
                proc.kill()
                proc.wait(timeout=6)
        finally:
            log.close()

    def call(self, workspace, operation, **payload):
        if operation not in ('open', 'import', 'inspect', 'edit', 'undo', 'advanced', 'output','sync'): raise ValueError('成片操作无效')
        project_key = payload.get('projectKey')
        if not isinstance(project_key, str) or not project_key: raise ValueError('成片必须关联当前画布')
        scope = (workspace, project_key)
        with self.lock:
            worker = self.workers.get(scope)
            if worker and worker[0].poll() is not None:
                self._stop(worker)
                self.workers.pop(scope, None)
                worker = None
            worker = worker or self._start(workspace, project_key)
        # Responses remain ordered within one editor, while another project's
        # export/generation must not freeze every other workbench.
        proc, replies, _ = worker
        with getattr(proc, 'film_call_lock', self.lock):
            if proc.poll() is not None:
                raise FilmUnavailable('成片已关闭，请重新打开')
            try:
                with getattr(proc,'film_input_lock',threading.Lock()):
                    proc.stdin.write(json.dumps({'op': operation, **payload}, ensure_ascii=False) + '\n')
                    proc.stdin.flush()
                result = replies.get(timeout=660 if operation == 'advanced' else 360 if operation in ('import','sync') else 45)
            except (OSError, queue.Empty) as exc:
                with self.lock:
                    if self.workers.get(scope) is worker: self.workers.pop(scope, None)
                self._stop(worker)
                raise FilmUnavailable('成片编辑器暂未响应，请重试；已经保存的剪辑不会丢失') from exc
            if result.get('error'): raise FilmUnavailable(result['error'])
            return result

    def archive_project(self, workspace, project_key, title=''):
        """Move the linked film to a recoverable, workspace-local recycle area."""
        base=(self.data_dir/'films'/hashlib.sha256(workspace.encode()).hexdigest()[:24]).resolve()
        key=hashlib.sha256(project_key.encode()).hexdigest()[:24]
        targets=[base/'projects'/key,base/'scopes'/key]
        for target in targets:
            if target.exists() and (target.is_symlink() or not target.resolve().is_relative_to(base)):
                raise FilmUnavailable('成片目录路径异常，项目未删除')
        with self.lock:
            worker=self.workers.get((workspace,project_key))
            if worker:
                proc,replies,_=worker
                call_lock=getattr(proc,'film_call_lock',self.lock)
                if not call_lock.acquire(blocking=False):
                    raise FilmUnavailable('成片正在处理任务，请完成后再删除项目')
                try:
                    if proc.poll() is None:
                        with proc.film_input_lock:
                            proc.stdin.write(json.dumps({'op':'archive_check','projectKey':project_key})+'\n');proc.stdin.flush()
                        try:result=replies.get(timeout=5)
                        except queue.Empty:
                            self.workers.pop((workspace,project_key),None);self._stop(worker)
                            raise FilmUnavailable('无法确认成片任务状态，请重试；文件已保留')
                        if not result.get('safe'):raise FilmUnavailable(result.get('error') or '成片正在生成、导出或由 Agent 编辑，请完成后再删除项目')
                    self.workers.pop((workspace,project_key),None)
                    self._stop(worker)
                finally:call_lock.release()
        if not any(p.exists() for p in targets):return None
        recycle=base/'recycle'
        if recycle.is_symlink() or not recycle.resolve().is_relative_to(base):raise FilmUnavailable('成片回收区路径异常，项目未删除')
        record=recycle/uuid.uuid4().hex
        record.mkdir(parents=True)
        moved=[]
        try:
            for target in targets:
                if target.exists():
                    destination=record/target.parent.name
                    target.rename(destination);moved.append((destination,target))
            (record/'record.json').write_text(json.dumps({'projectId':project_key,'title':title,'archivedAt':time.time()},ensure_ascii=False),encoding='utf-8')
        except Exception:
            for source,target in reversed(moved):
                if source.exists() and not target.exists():source.rename(target)
            raise
        return record.name

    def close(self):
        with self.lock:
            workers, self.workers = self.workers, {}
            for worker in workers.values(): self._stop(worker)
