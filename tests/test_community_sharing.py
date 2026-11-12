import ast, base64, copy, json, tempfile, threading, unittest
from pathlib import Path
from community_sharing import prepare_share, CommunityShareError
from previs_assets import PrevisAssetStore
from account_storage import StorageError


class CommunityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.root = Path(self.temp.name)
        self.user = {'id':'alice','nickname':'Alice','avatar':'A'}
        self.media = {}
        for index, ext in enumerate(('png','mp4','mp3','glb')):
            name = 'media-'+str(index)*32+'.'+ext
            file = self.root/name
            chunk=json.dumps({'asset':{'version':'2.0'},'meshes':[{}]}).encode(); chunk+=b' '*(-len(chunk)%4)
            box=lambda kind,body:(len(body)+8).to_bytes(4,'big')+kind+body
            samples={'png':base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7X8AAAAASUVORK5CYII='),
                     'mp3':b'\xff\xfb\x90\x00'+bytes(413),
                     'mp4':box(b'ftyp',b'isom'+bytes(4))+box(b'moov',box(b'hdlr',bytes(8)+b'vide'+bytes(4))),
                     'glb':b'glTF'+(2).to_bytes(4,'little')+(20+len(chunk)).to_bytes(4,'little')+len(chunk).to_bytes(4,'little')+b'JSON'+chunk}
            file.write_bytes(samples[ext])
            self.media[ext] = name
        self.resolve = lambda name: self.root/name if (self.root/name).is_file() else None
        self.clean = lambda obj,id:dict(copy.deepcopy(obj),id=id)
        self.fields = {'name':'Edited','description':'Description'}
    def tearDown(self): self.temp.cleanup()
    def prepare(self,kind,fields=None,old=None,user=None):
        return prepare_share(kind,fields or self.fields,user or self.user,old,self.resolve,self.clean,'now','workspace-alice')
    def test_files_and_metadata_all_media_types(self):
        for kind,ext in [('images','png'),('videos','mp4'),('music','mp3'),('models','glb')]:
            item=self.prepare(kind,dict(self.fields,mediaId=self.media[ext],ownerId='bob'))
            self.assertEqual(item['ownerId'],'alice');self.assertTrue(item['shared']);self.assertEqual(item['description'],'Description')
            self.assertEqual(item['mediaUrl'],'/media/'+self.media[ext])
            if kind=='music':self.assertEqual(item['data'],item['mediaUrl'])
            if kind=='models':self.assertEqual(item['object']['modelUrl'],item['mediaUrl']);self.assertEqual(item['assetType'],'3d')
    def test_owner_edit_preserves_id_and_counters(self):
        old=self.prepare('models',dict(self.fields,mediaId=self.media['glb']));old['uses']=17
        edited=self.prepare('models',{'name':'Rename','description':'New'},old)
        self.assertEqual(edited['id'],old['id']);self.assertEqual(edited['object'],old['object']);self.assertEqual(edited['uses'],17);self.assertEqual(old['name'],'Edited')
    def test_other_user_cannot_edit_any_kind(self):
        for kind in ('projects','images','videos','music','models'):
            with self.assertRaises(CommunityShareError) as err:self.prepare(kind,old={'id':'owned','ownerId':'bob'})
            self.assertEqual(err.exception.status,403)
    def test_no_missing_name_file_or_wrong_type(self):
        for fields in ({'name':''},{'name':'X'},{'name':'X','mediaId':'../../escape'},dict(self.fields,mediaId=self.media['mp3'])):
            with self.assertRaises(CommunityShareError):self.prepare('images',fields)
    def test_replacement_removes_stale_embedded_data(self):
        item=self.prepare('images',dict(self.fields,mediaId=self.media['png']),{'id':'a','ownerId':'alice','data':'data:image/png;old'})
        self.assertNotIn('data',item)
    def test_project_import_and_edit_keep_workflow(self):
        graph={'nodes':[{'id':'n','type':'director','directorProject':'fixture'}],'edges':[],'ownerId':'bob'}
        item=self.prepare('projects',dict(self.fields,project=graph));self.assertEqual(item['ownerId'],'alice');self.assertEqual(item['nodes'],graph['nodes'])
        edited=self.prepare('projects',self.fields,item);self.assertEqual(edited['nodes'],graph['nodes']);self.assertEqual(edited['revision'],2)
        with self.assertRaises(CommunityShareError):self.prepare('projects',dict(self.fields,project=graph),item)
    def test_invalid_cover_and_glb_rejected(self):
        with self.assertRaises(ValueError):self.prepare('music',dict(self.fields,mediaId=self.media['mp3'],thumbnail='javascript:bad'))
        (self.root/self.media['glb']).write_bytes(b'fake model')
        with self.assertRaises(CommunityShareError):self.prepare('models',dict(self.fields,mediaId=self.media['glb']))
    def test_legacy_preset_can_be_edited_without_file(self):
        item=self.prepare('models',old={'id':'old','ownerId':'alice','uses':9});self.assertEqual(item['name'],'Edited')
    def test_external_or_invalid_glb_resources_are_rejected(self):
        for document in ({'meshes':[{}],'buffers':[{'uri':'external.bin'}]}, {'meshes':[{}],'images':[None]}, {'meshes':[{}],'buffers':{}}, {'meshes':[]}):
            chunk=json.dumps(document).encode();chunk+=b' '*(-len(chunk)%4)
            (self.root/self.media['glb']).write_bytes(b'glTF'+(2).to_bytes(4,'little')+(20+len(chunk)).to_bytes(4,'little')+len(chunk).to_bytes(4,'little')+b'JSON'+chunk)
            with self.assertRaises(CommunityShareError):self.prepare('models',dict(self.fields,mediaId=self.media['glb']))


class RouteTests(CommunityTests):
    def setUp(self):
        super().setUp()
        def read(p,default):return json.loads(p.read_text()) if p.exists() else copy.deepcopy(default)
        def write(p,v):p.write_text(json.dumps(v))
        self.store=PrevisAssetStore(self.root,read,write,lambda:read(self.root/'models.json',[]),lambda v:write(self.root/'models.json',v),lambda:'now')
        scope=dict(prepare_share=prepare_share,CommunityShareError=CommunityShareError,StorageError=StorageError,validate_new_media=lambda *_:None,LOCK=threading.Lock(),read_file=read,write_file=write,
                   user_storage_usage=lambda user:0,asset_storage_bytes=lambda item:7,USER_STORAGE_QUOTA_BYTES=100,PREVIS_ASSETS=self.store,resolve_media_file=self.resolve,clean_project=self.clean,now=lambda:'now')
        for name in ('PROJECTS','ASSETS','MUSIC','MODELS'):scope[name+'_FILE']=self.root/(name.lower()+'.json')
        tree=ast.parse(Path('server.py').read_text(encoding='utf-8'));method=next(n for n in ast.walk(tree) if isinstance(n,ast.FunctionDef) and n.name=='community_share_api')
        exec(compile(ast.Module(body=[method],type_ignores=[]),'production-community-route','exec'),scope)
        class Request:
            user=self.user
            def authenticated_user(req):return req.user
            def workspace_scope(req,u):return 'workspace-alice',True
            def send_json(req,v,status=200):return v,status
        Request.api=scope['community_share_api'];self.request=Request();self.scope=scope
    def test_auth_missing_and_owner_only(self):
        self.request.user=None;self.assertEqual(self.request.api('/api/community/shares/images',self.fields)[1],401)
        self.request.user=self.user;self.assertEqual(self.request.api('/api/community/shares/images/missing',self.fields)[1],404)
        item,status=self.request.api('/api/community/shares/images',dict(self.fields,mediaId=self.media['png']));self.assertEqual(status,201)
        self.request.user={'id':'bob'};self.assertEqual(self.request.api('/api/community/shares/images/'+item['item']['id'],self.fields)[1],403)
    def test_private_asset_share_reedit_is_idempotent_and_syncs(self):
        asset=self.store.create(self.user,{'name':'Cube','object':{'kind':'geometry','geometryType':'box'}})
        fields=dict(self.fields,assetId=asset['id'])
        first,status=self.request.api('/api/community/shares/models',fields);self.assertEqual(status,200)
        second,status=self.request.api('/api/community/shares/models',dict(fields,name='Changed'));self.assertEqual(first['item']['id'],second['item']['id'])
        self.assertEqual(len(self.store.models()),1);self.assertEqual(self.store.records()[0]['name'],'Changed')
        self.request.user={'id':'bob'};self.assertEqual(self.request.api('/api/community/shares/models',fields)[1],403)
    def test_storage_limit_rejects_without_publishing(self):
        def quota_rejected_write(path,value):raise StorageError('空间不足',413)
        self.scope['write_file']=quota_rejected_write
        result,status=self.request.api('/api/community/shares/images',dict(self.fields,mediaId=self.media['png']))
        self.assertEqual(status,413);self.assertFalse(self.scope['ASSETS_FILE'].exists())


if __name__=='__main__':unittest.main()
