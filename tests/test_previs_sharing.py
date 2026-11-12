import json,copy,tempfile,unittest
from pathlib import Path
from previs_sharing import PrevisSharing,ShareDenied
class SharingTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.rows=[{'id':'p','ownerId':'alice','shared':False,'projectName':'Scene','nodes':[{'id':'n','type':'director','directorProject':json.dumps({'version':3,'scene':{'panoramaJob':{'secret':'x'},'panoramaHistory':[1]},'objects':[],'aiConversation':[{'content':'private prompt'}]})}]}];self.user={'id':'alice'}
  self.read=lambda p,d:json.loads(p.read_text()) if p.exists() else copy.deepcopy(d);self.write=lambda p,v:p.write_text(json.dumps(v));self.store=PrevisSharing(Path(self.tmp.name),self.read,self.write,lambda:self.rows,lambda:'now')
 def tearDown(self):self.tmp.cleanup()
 def denied(self,status,fn):
  with self.assertRaises(ShareDenied) as error:fn()
  self.assertEqual(error.exception.status,status)
 def public(self):return self.store.update('p','n',self.user,'public')
 def token(self):return self.store.config(self.rows[0])['token']
 def test_default_private_and_no_implicit_publication(self):
  self.assertEqual(self.store.info('p','n',self.user)['access'],'private');self.assertNotIn('share=',self.store.info('p','n',self.user)['url']);self.assertFalse(self.rows[0]['shared']);self.denied(401,lambda:self.store.view('p','n',None,''))
 def test_private_owner_can_view(self):self.assertTrue(self.store.view('p','n',self.user,'')['readOnly'])
 def test_other_user_cannot_configure_or_view(self):
  user={'id':'bob'};self.denied(403,lambda:self.store.info('p','n',user));self.denied(403,lambda:self.store.update('p','n',user,'public'));self.denied(403,lambda:self.store.view('p','n',user,''))
 def test_anonymous_configure_rejected(self):self.denied(401,lambda:self.store.update('p','n',None,'public'))
 def test_public_requires_exact_token(self):
  self.public();self.assertTrue(self.store.view('p','n',None,self.token())['readOnly']);self.denied(401,lambda:self.store.view('p','n',None,''));self.denied(403,lambda:self.store.view('p','n',None,'wrong'));self.denied(403,lambda:self.store.view('p','n',None,'中文'))
 def test_revoke_takes_effect_for_old_link(self):
  self.public();old=self.token();self.store.update('p','n',self.user,'private');self.denied(403,lambda:self.store.view('p','n',None,old));self.denied(403,lambda:self.store.view('p','n',self.user,old))
 def test_reenable_rotates_token(self):
  self.public();old=self.token();self.store.update('p','n',self.user,'private');self.public();self.assertNotEqual(self.token(),old);self.denied(403,lambda:self.store.view('p','n',None,old))
 def test_same_selection_retains_valid_link(self):
  first=self.public();self.assertEqual(self.public(),first)
 def test_setting_survives_project_autosave_and_store_reopen(self):
  self.public();token=self.token();self.rows[0]=copy.deepcopy(self.rows[0]);fresh=PrevisSharing(Path(self.tmp.name),self.read,self.write,lambda:self.rows,lambda:'later');self.assertEqual(fresh.info('p','n',self.user)['access'],'public');self.assertTrue(fresh.view('p','n',None,token))
 def test_deleted_node_and_project_are_unavailable(self):
  self.public();token=self.token();self.rows[0]['nodes']=[];self.denied(404,lambda:self.store.view('p','n',None,token));self.rows.clear();self.denied(404,lambda:self.store.view('p','n',None,token))
 def test_changed_owner_revokes_existing_token(self):
  self.public();token=self.token();self.rows[0]['ownerId']='bob';self.denied(403,lambda:self.store.view('p','n',None,token));self.assertEqual(self.store.info('p','n',{'id':'bob'})['access'],'private')
 def test_only_scene_is_shared_and_not_ai_history(self):
  self.public();data=self.store.view('p','n',None,self.token());self.assertNotIn('aiConversation',data['scene']);self.assertNotIn('panoramaJob',data['scene']['scene']);self.assertNotIn('panoramaHistory',data['scene']['scene']);self.assertNotIn('nodes',data)
 def test_invalid_access_rejected(self):
  for access in ('shared','true',True,None):self.denied(400,lambda:self.store.update('p','n',self.user,access))
 def test_malformed_scene_returns_unavailable_instead_of_server_error(self):
  for scene in ({'scene':None,'objects':[]}, {'scene':{},'objects':{}}, {'scene':{},'objects':[],'cameras':{} }):
   self.rows[0]['nodes'][0]['directorProject']=json.dumps(scene)
   self.denied(404,lambda:self.store.view('p','n',self.user,''))
class ExistingProjectAccessTests(unittest.TestCase):
 def test_private_source_project_cannot_bypass_preview_access(self):
  import ast
  tree=ast.parse(Path('server.py').read_text(encoding='utf-8'))
  handler=next(n for n in tree.body if isinstance(n,ast.ClassDef) and n.name=='Handler');method=next(n for n in handler.body if isinstance(n,ast.FunctionDef) and n.name=='do_GET')
  branch=next(n for n in method.body if isinstance(n,ast.If) and isinstance(n.test,ast.Call) and isinstance(n.test.func,ast.Attribute) and n.test.func.attr=='startswith' and any(isinstance(a,ast.Constant) and a.value=='/api/projects/' for a in n.test.args))
  func=ast.parse('def route(self,user,path):\n pass').body[0];func.body=branch.body;scope={};exec(compile(ast.fix_missing_locations(ast.Module(body=[func],type_ignores=[])),'project-read-guard','exec'),scope)
  class Request:
   project={'id':'p','ownerId':'alice','shared':False}
   def find_project(req,id):return req.project
   def send_json(req,data,status=200):return data,status
  request=Request();self.assertEqual(scope['route'](request,{'id':'bob'},'/api/projects/p')[1],403);self.assertEqual(scope['route'](request,{'id':'alice'},'/api/projects/p')[1],200);request.project['shared']=True;self.assertEqual(scope['route'](request,{'id':'bob'},'/api/projects/p')[1],200)

if __name__=='__main__':unittest.main()
