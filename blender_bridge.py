"""Local Blender job service. Immutable revisions, bounded queue, no AI calls."""
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from blender_protocol import validate_plan


class BlenderUnavailable(ValueError):
    pass


class BlenderBridge:
    def __init__(self, root, directory, publish):
        self.root=Path(root);self.directory=Path(directory)/'blender'
        self.directory.mkdir(exist_ok=True)
        self.publish=publish;self.lock=threading.RLock()
        self.executor=ThreadPoolExecutor(max_workers=1,thread_name_prefix='canvasflow-blender')
        self.cache=None
        for path in self.directory.glob('blend-*/job.json'):
            row=self._read(path)
            if row.get('status') in ('queued','running'):
                row.update(status='failed',error='本地服务已重启，请重新提交建模任务')
                self._write(path,row)

    @staticmethod
    def _read(path):
        try:
            value=json.loads(path.read_text(encoding='utf-8'))
            return value if isinstance(value,dict) else {}
        except (FileNotFoundError,ValueError):return {}

    @staticmethod
    def _write(path,value):
        temp=path.with_name(path.name+'.'+uuid.uuid4().hex+'.tmp')
        try:temp.write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8');temp.replace(path)
        finally:temp.unlink(missing_ok=True)

    def executable(self):
        config=self._read(self.directory/'settings.json')
        candidates=[os.environ.get('CANVASFLOW_BLENDER'),config.get('executable'),shutil.which('blender')]
        for parent in (self.root,self.root.parent):
            runtime=parent/'.runtime'/'blender'
            candidates.extend(str(p) for p in sorted(runtime.glob('blender-*/blender.exe'),reverse=True))
            candidates.extend(str(p) for p in runtime.glob('blender-*/blender'))
        if os.name=='nt':
            for key in ('ProgramFiles','ProgramFiles(x86)'):
                candidates.extend(str(p) for p in (Path(os.environ.get(key,'C:/Program Files'))/'Blender Foundation').glob('Blender */blender.exe'))
        return next((str(Path(p).resolve()) for p in candidates if p and Path(p).is_file()),'')

    def status(self,force=False):
        executable=self.executable()
        if self.cache and self.cache.get('executable')==executable and not force:return dict(self.cache)
        value={'available':False,'executable':executable,'version':'','tools':['create','update','material','bevel','subdivide','boolean','smooth','remove']}
        if executable:
            try:
                result=subprocess.run([executable,'--version'],capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=10,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
                version=result.stdout.splitlines()[0] if result.stdout else ''
                value.update(available=result.returncode==0 and version.startswith('Blender '),version=version)
            except (OSError,subprocess.SubprocessError) as error:value['error']='无法启动 Blender：'+str(error)[:200]
        else:value['error']='未检测到 Blender，请配置可执行文件路径'
        self.cache=value;return dict(value)

    def configure(self,raw):
        if not isinstance(raw,dict):raise ValueError('连接配置需要 JSON 对象')
        path=str(raw.get('executable') or '').strip()
        if path and (not Path(path).is_absolute() or Path(path).name.lower() not in ('blender.exe','blender') or not Path(path).is_file()):
            raise ValueError('请选择存在的 Blender 可执行文件绝对路径')
        self._write(self.directory/'settings.json',{'executable':path})
        return self.status(force=True)

    def job(self,id,workspace):
        if not isinstance(id,str) or not re.fullmatch(r'blend-[a-f0-9]{32}',id):raise LookupError('建模任务不存在')
        row=self._read(self.directory/id/'job.json')
        if not row or row.get('workspaceId')!=workspace:raise LookupError('建模任务不存在')
        return row

    @staticmethod
    def public(row):
        return {k:v for k,v in row.items() if k not in ('executable','sourceBlend')}

    def jobs(self,workspace):
        rows=[self._read(path) for path in self.directory.glob('blend-*/job.json')]
        return [self.public(row) for row in sorted(rows,key=lambda row:row.get('createdAt',0),reverse=True) if row.get('workspaceId')==workspace][:100]

    def submit(self,raw,workspace):
        plan=validate_plan(raw)
        status=self.status()
        if not status['available']:raise BlenderUnavailable(status.get('error') or 'Blender 不可用')
        with self.lock:
            active=[self._read(p) for p in self.directory.glob('blend-*/job.json')]
            active=[r for r in active if r.get('status') in ('queued','running')]
            if len(active)>=4:raise ValueError('已有四个建模任务，请等待完成后再提交')
            source=''
            if plan['sourceJobId']:
                parent=self.job(plan['sourceJobId'],workspace)
                if parent['status']!='succeeded':raise ValueError('只能继续编辑已完成的版本')
                source=str(self.directory/parent['id']/'model.blend')
                if not Path(source).is_file():raise ValueError('源工程文件不存在')
            id='blend-'+uuid.uuid4().hex;directory=self.directory/id;directory.mkdir()
            row={'id':id,'name':plan['name'],'workspaceId':workspace,'sourceJobId':plan['sourceJobId'],
                 'status':'queued','createdAt':time.time(),'plan':plan}
            self._write(directory/'job.json',row)
            self._write(directory/'task.json',{'plan':plan,'sourceBlend':source})
            self.executor.submit(self._run,id,status['executable'])
        return self.public(row)

    def _run(self,id,executable):
        directory=self.directory/id
        row=self._read(directory/'job.json');row['status']='running';self._write(directory/'job.json',row)
        try:
            with (directory/'worker.log').open('wb') as log:
                result=subprocess.run([executable,'--background','--factory-startup','--disable-autoexec',
                    '--python-exit-code','1','--python',str(self.root/'blender_worker.py'),'--',str(directory/'task.json')],
                    cwd=self.root,stdout=log,stderr=subprocess.STDOUT,timeout=240,
                    creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
            info=self._read(directory/'result.json')
            if result.returncode or not info.get('ok'):raise ValueError(info.get('error') or 'Blender 执行失败，请查看本地任务日志')
            if not (directory/'model.blend').is_file() or not (directory/'model.glb').is_file():raise ValueError('模型导出不完整')
            asset=self.publish(row,directory,info)
            row.update(status='succeeded',asset=asset,result=info,finishedAt=time.time())
        except subprocess.TimeoutExpired:row.update(status='failed',error='建模超过四分钟，任务已停止；请减少对象或细分级别',finishedAt=time.time())
        except Exception as error:row.update(status='failed',error=str(error)[:500],finishedAt=time.time())
        self._write(directory/'job.json',row)

    def artifact(self,id,workspace,kind):
        row=self.job(id,workspace)
        if row.get('status')!='succeeded':raise ValueError('任务尚未完成')
        name={'blend':'model.blend','glb':'model.glb'}.get(kind)
        if not name:raise ValueError('仅支持下载 Blender 工程或 GLB 模型')
        return self.directory/id/name
