import copy
import json
import tempfile
import unittest
from pathlib import Path
from previs_assets import PrevisAssetStore, clean_asset_object, clean_thumbnail

class AssetTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.directory=Path(self.tmp.name);self.models=[]
        self.read=lambda p,d:json.loads(p.read_text()) if p.exists() else copy.deepcopy(d)
        self.write=lambda p,v:p.write_text(json.dumps(v))
        self.store=PrevisAssetStore(self.directory,self.read,self.write,lambda:copy.deepcopy(self.models),lambda rows:setattr(self,'models',rows),lambda:'2026-10-12')
        self.user={'id':'alice','nickname':'Alice'};self.obj={'kind':'geometry','geometryType':'box','transform':{'position':[0,0,0],'rotation':[0,0,0],'scale':[1,1,1]}}
    def tearDown(self):self.tmp.cleanup()
    def make(self):return self.store.create(self.user,{'name':'Cube','object':self.obj,'ownerId':'bob'})
    def test_owner_and_private_assets(self):
        a=self.make();self.assertEqual(a['ownerId'],'alice');self.assertEqual(self.store.library('bob')['assets'],[]);self.assertEqual(len(self.store.library('alice')['assets']),1)
    def test_reopen_reads_saved_models(self):
        a=self.make();fresh=PrevisAssetStore(self.directory,self.read,self.write,lambda:self.models,lambda rows:None,lambda:'now');self.assertEqual(fresh.library('alice')['assets'][0],a)
    def test_edit_forbidden_for_other_owner(self):
        a=self.make()
        with self.assertRaises(LookupError):self.store.update('bob',a['id'],{'name':'Stolen'})
        self.assertEqual(self.store.records()[0]['name'],'Cube')
    def test_share_is_explicit_idempotent(self):
        a=self.make();self.assertEqual(self.models,[]);m=self.store.share('alice',a['id']);self.assertEqual(self.store.share('alice',a['id'])['id'],m['id']);self.assertEqual(len(self.models),1)
        with self.assertRaises(LookupError):self.store.share('bob',a['id'])
    def test_favorite_shared_model_and_persist(self):
        a=self.make();m=self.store.share('alice',a['id']);self.store.favorite('bob',m['id'],True);self.assertEqual(self.store.library('bob')['favorites'][0]['object'],self.obj);self.assertTrue(self.store.model_views(self.models,'bob')[0]['favorited']);self.assertFalse(self.store.model_views(self.models,'alice')[0]['favorited']);self.store.favorite('bob',m['id'],False);self.assertEqual(self.store.library('bob')['favorites'],[])
    def test_unshared_favorites_are_filtered(self):
        m={'id':'private','ownerId':'alice','shared':False};self.models=[m]
        with self.assertRaises(LookupError):self.store.favorite('bob','private',True)
        self.store.favorite('alice','private',True);self.assertEqual(len(self.store.library('alice')['favorites']),1)
    def test_cancelled_share_disappears(self):
        a=self.make();m=self.store.share('alice',a['id']);self.store.favorite('bob',m['id'],True);self.models[0]['shared']=False;self.assertEqual(self.store.library('bob')['favorites'],[])
    def test_share_edit_syncs_thumbnail_name_description(self):
        a=self.make();m=self.store.share('alice',a['id']);thumb='/assets3d/previews/box.png';self.store.update('alice',a['id'],{'name':'New','description':'Edited','thumbnail':thumb});self.assertEqual(self.models[0]['name'],'New');self.assertEqual(self.models[0]['thumbnail'],thumb);self.assertEqual(self.models[0]['description'],'Edited')
    def test_legacy_styles_are_not_converted(self):
        self.models=[{'id':'style','shared':True,'name':'Night style'}];self.store.favorite('alice','style',True);self.assertNotIn('object',self.store.library('alice')['favorites'][0])
    def test_invalid_transform_and_files_rejected(self):
        for value in [None,{'kind':'group'},dict(self.obj,transform=[]),dict(self.obj,transform={'scale':[0,1,1]}),dict(self.obj,local=True),dict(self.obj,modelUrl='https://example.com/model.glb'),dict(self.obj,modelUrl=33),dict(self.obj,geometryType='evil')]:
            with self.subTest(value=value),self.assertRaises(ValueError):clean_asset_object(value)
    def test_whitebox_recipe_validation(self):
        obj={'kind':'geometry','whitebox':{'type':'building','parameters':{'size':[6,5,8],'floors':2}}};self.assertEqual(clean_asset_object(obj)['whitebox'],obj['whitebox'])
        for spec in [{'type':'evil','parameters':{}},{'type':'road','parameters':{'size':[1,-2,3]}},{'type':'mesh','parameters':{'size':[1,1,1],'vertices':[0]*9,'indices':[0,1,90]}}]:
            with self.assertRaises(ValueError):clean_asset_object({'kind':'geometry','whitebox':spec})
    def test_invalid_thumbnails_rejected(self):
        for thumb in ['https://example.com/a.png','data:image/png;base64,YWJj','/assets3d/previews/../../x.png']:
            with self.assertRaises(ValueError):clean_thumbnail(thumb)
    def test_whitelist_excludes_scene_identity_and_animation(self):
        value=dict(self.obj,id='old',parentId='oldParent',name='name',keys=[1],locked=True);clean=clean_asset_object(value);self.assertNotIn('id',clean);self.assertNotIn('parentId',clean);self.assertNotIn('keys',clean)
    def test_asset_limit_and_empty_names(self):
        self.write(self.store.file,[{'ownerId':'alice'} for _ in range(300)])
        self.assertTrue(self.make()['id'])
    def test_invalid_favorite_type(self):
        a=self.make();m=self.store.share('alice',a['id'])
        with self.assertRaises(ValueError):self.store.favorite('alice',m['id'],'true')

class RouteTests(unittest.TestCase):
    def setUp(self):
        AssetTests.setUp(self)
        import ast, threading
        source=ast.parse(Path('server.py').read_text(encoding='utf-8'))
        route=next(n for n in ast.walk(source) if isinstance(n,ast.FunctionDef) and n.name=='previs_assets_api')
        references=next(n for n in source.body if isinstance(n,ast.FunctionDef) and n.name=='media_referenced_by')
        scope={'PREVIS_ASSETS':self.store,'LOCK':threading.Lock(),'json':json,'re':__import__('re'),'read_assets':lambda:[],'read_projects':lambda:[],'read_music':lambda:[],'read_models':self.store.models}
        from account_storage import StorageError
        scope.update(StorageError=StorageError,validate_new_media=lambda *args:None,
                     in_workspace=lambda row,workspace,valid=None:row.get('workspaceId')==workspace)
        exec(compile(ast.Module(body=[route,references],type_ignores=[]),'asset-routes','exec'),scope)
        self.references=scope['media_referenced_by']
        class Request:
            user={'id':'alice'}
            def authenticated_user(req):return req.user
            def workspace_scope(req,user):return 'workspace-test',set()
            def send_json(req,data,status=200):return data,status
        Request.api=scope['previs_assets_api'];self.request=Request()
    def tearDown(self):AssetTests.tearDown(self)
    def test_route_auth_and_error_statuses(self):
        self.request.user=None
        self.assertEqual(self.request.api('/api/previs/assets','GET')[1],401)
        self.request.user={'id':'alice'}
        self.assertEqual(self.request.api('/api/previs/assets','POST',{})[1],400)
        self.assertEqual(self.request.api('/api/previs/assets/missing','PUT',{'name':'X'})[1],404)
        self.assertEqual(self.request.api('/api/models/missing/favorite','POST',{'favorite':True})[1],404)
    def test_routes_roundtrip_and_owner_guard(self):
        a,status=self.request.api('/api/previs/assets','POST',{'name':'Cube','object':self.obj});self.assertEqual(status,201);asset=a['asset'];self.assertEqual(self.request.api('/api/previs/assets','GET')[0]['assets'][0]['id'],asset['id'])
        share,status=self.request.api('/api/previs/assets/'+asset['id']+'/share','POST',{});self.assertEqual(status,200)
        self.request.user={'id':'bob'};self.assertEqual(self.request.api('/api/previs/assets/'+asset['id'],'PUT',{'name':'Other'})[1],404)
        result,status=self.request.api('/api/models/'+share['model']['id']+'/favorite','POST',{'favorite':True});self.assertEqual(status,200);self.assertTrue(result['model']['favorited'])
    def test_media_gc_keeps_personal_and_scene_model_files(self):
        media='media-'+('a'*32)+'.glb';obj=dict(self.obj,local=True,modelUrl='/media/'+media);self.store.create(self.user,{'name':'GLB','object':obj})
        self.assertTrue(self.references(media,[],[]))
        media2='media-'+('b'*32)+'.glb';projects=[{'id':'p','nodes':[{'id':'n','directorProject':json.dumps({'objects':[{'modelUrl':'/media/'+media2}]})}]}]
        self.assertTrue(self.references(media2,[],projects));self.assertEqual(self.references('media-'+('c'*32)+'.glb',[],projects),[])

if __name__=='__main__':unittest.main()
