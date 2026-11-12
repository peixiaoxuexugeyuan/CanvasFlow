"""Previsualization project links with owner-only settings and revocable public access."""
import copy
import hmac
import json
import secrets
from urllib.parse import quote

class ShareDenied(Exception):
    def __init__(self,status,message):self.status,self.message=status,message

class PrevisSharing:
    def __init__(self,directory,read,write,projects,now):
        self.file=directory/'previs-shares.json';self.read,self.write,self.projects,self.now=read,write,projects,now
    def project_node(self,project_id,node_id):
        project=next((p for p in self.projects() if p.get('id')==project_id),None)
        if not project:raise ShareDenied(404,'项目不存在或已删除')
        node=next((n for n in project.get('nodes',[]) if n.get('id')==node_id and n.get('type')=='director'),None)
        if not node:raise ShareDenied(404,'预演场景不存在或已删除')
        return project,node
    def records(self):
        rows=self.read(self.file,{})
        return rows if isinstance(rows,dict) else {}
    def config(self,project):
        record=self.records().get(project['id'],{})
        return record if record.get('ownerId')==project.get('ownerId') else {'access':'private','token':''}
    def owner(self,project,user):
        if not user:raise ShareDenied(401,'请先登录')
        if project.get('ownerId')!=user['id']:raise ShareDenied(403,'只有项目所有者可以设置分享权限')
    def info(self,project_id,node_id,user):
        project,node=self.project_node(project_id,node_id);self.owner(project,user);record=self.config(project)
        path='/previs/'+quote(project_id,safe='')+'?node='+quote(node_id,safe='')
        access=record.get('access','private')
        if access=='public' and record.get('token'):path+='&share='+quote(record['token'],safe='')
        else:access='private'
        return {'access':access,'url':path,'projectId':project_id,'nodeId':node_id,'updatedAt':record.get('updatedAt','')}
    def update(self,project_id,node_id,user,access):
        project,node=self.project_node(project_id,node_id);self.owner(project,user)
        if access not in ('private','public'):raise ShareDenied(400,'分享权限无效')
        rows=self.records();previous=self.config(project)
        if previous.get('access','private')!=access:
            rows[project_id]={'ownerId':user['id'],'access':access,'token':secrets.token_urlsafe(24) if access=='public' else '', 'updatedAt':self.now()}
            self.write(self.file,rows)
        return self.info(project_id,node_id,user)
    def view(self,project_id,node_id,user,token):
        project,node=self.project_node(project_id,node_id);record=self.config(project)
        is_owner=bool(user and project.get('ownerId')==user.get('id'))
        valid=record.get('access')=='public' and isinstance(token,str) and token.isascii() and len(token)<128 and bool(record.get('token')) and hmac.compare_digest(token,record['token'])
        # A supplied revoked/stale link never falls back to a private owner link.
        if token and not valid:raise ShareDenied(403,'分享链接已失效或已关闭公开访问')
        if not valid and not is_owner:raise ShareDenied(403 if user else 401,'此预演仅项目所有者可见，请使用所有者账户登录')
        try:scene=json.loads(node.get('directorProject') or '{}')
        except (TypeError,ValueError):raise ShareDenied(404,'预演场景数据不可用')
        if not isinstance(scene,dict) or scene.get('version')!=3:raise ShareDenied(404,'预演场景数据不可用')
        if not isinstance(scene.get('scene', {}), dict) or any(not isinstance(scene.get(key, []), list) for key in ('objects', 'cameras')):
            raise ShareDenied(404,'预演场景数据不可用')
        allowed=('version','scene','objects','cameras','activeCameraId','sequence','cameraTrack','objectAnimationTracks','timeline','modelUrl')
        scene={k:copy.deepcopy(scene[k]) for k in allowed if k in scene}
        for key in ('panoramaHistory','panoramaJob','panoramaPrompt','panoramaModelId'):(scene.get('scene')or{}).pop(key,None)
        return {'projectId':project_id,'nodeId':node_id,'projectName':project.get('projectName') or '3D预演台','title':node.get('title') or '3D预演台','scene':scene,'readOnly':True,'isOwner':is_owner}
