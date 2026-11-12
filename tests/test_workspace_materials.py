"""Workspace media union, deduplication and classification without provider calls."""
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from workspace_materials import build_catalog, summary_item

def scope(row,workspace):return row.get('workspaceId')==workspace
def media(letter,ext):return '/media/media-'+letter*32+'.'+ext

class WorkspaceMaterialsTest(unittest.TestCase):
    def catalog(self,projects=(),assets=(),music=(),models=(),jobs=(),metadata=None,workspace='a'):
        return build_catalog(workspace,list(projects),list(assets),list(music),list(models),list(jobs),scope,metadata)

    def test_union_all_projects_and_workspace_isolation(self):
        projects=[{'id':'p1','workspaceId':'a','projectName':'First','nodes':[
            {'id':'n1','type':'image','previewAsset':'img','generated':True}]},
            {'id':'p2','workspaceId':'a','projectName':'Second','nodes':[
            {'id':'n2','type':'image','previewMedia':media('a','png'),'generated':True}]},
            {'id':'private','workspaceId':'b','nodes':[{'previewMedia':media('b','png')}]}]
        assets=[{'id':'img','workspaceId':'a','kind':'image','mediaUrl':media('a','png'),'name':'Main'},
                {'id':'hidden','workspaceId':'b','kind':'image','mediaUrl':media('c','png')}]
        jobs=[{'id':'job','workspaceId':'a','kind':'image','status':'completed','imageUrl':media('a','png')},
              {'id':'hidden','workspaceId':'b','kind':'video','status':'completed','videoUrl':media('d','mp4')}]
        rows=self.catalog(projects,assets,jobs=jobs)
        self.assertEqual(len(rows),1)
        self.assertEqual({p['id'] for p in rows[0]['projects']},{'p1','p2'})
        self.assertEqual(rows[0]['origins'],['generated'])
        self.assertEqual(len(rows[0]['references']),2)

    def test_four_types_and_content_categories(self):
        project={'id':'p','workspaceId':'a','nodes':[
            {'id':'char','type':'charview','previewMedia':media('a','png'),'generated':True},
            {'id':'scene','imageProjection':'equirectangular','previewMedia':media('b','jpg')},
            {'id':'audio','previewMedia':'data:audio/wav;base64,AAAA'},
            {'id':'video','videoUrl':media('c','mp4')},
            {'id':'director','type':'director','directorProject':json.dumps({'objects':[
                {'id':'box','kind':'geometry','name':'Box','geometryType':'box'}]})}]}
        rows=self.catalog([project])
        self.assertEqual({r['kind'] for r in rows},{'image','audio','video','model'})
        self.assertEqual(next(r for r in rows if r['url']==media('a','png'))['category'],'character')
        self.assertEqual(next(r for r in rows if r['url']==media('b','jpg'))['category'],'scene')
        model=next(r for r in rows if r['kind']=='model')
        self.assertEqual(model['category'],'prop');self.assertEqual(model['object']['geometryType'],'box')

    def test_nested_script_assets_history_and_director_background(self):
        project={'id':'p','workspaceId':'a','nodes':[
            {'id':'script','scriptAssets':json.dumps({'characters':[{'name':'Actor','url':media('a','png')}],
                                                      'props':[{'name':'Bag','url':media('b','png')}]})},
            {'id':'image','imageHistory':json.dumps(['old'])},
            {'id':'director','type':'director','directorProject':json.dumps({'scene':{'panoramaUrl':media('c','png')}})}]}
        rows=self.catalog([project],assets=[{'id':'old','workspaceId':'a','kind':'image','mediaUrl':media('d','png')}])
        self.assertEqual(len(rows),4)
        self.assertEqual({r['category'] for r in rows},{'','character','scene','prop'})
        self.assertEqual(next(r for r in rows if r['url']==media('d','png'))['origins'],['generated'])

    def test_imported_model_shared_file_and_metadata_override(self):
        obj={'id':'m','kind':'geometry','modelUrl':media('e','glb'),'local':True}
        project={'id':'p','workspaceId':'a','nodes':[{'id':'n','type':'director','directorProject':{'objects':[obj]}}]}
        models=[{'id':'saved','workspaceId':'a','name':'Saved','object':obj}]
        rows=self.catalog([project],models=models);self.assertEqual(len(rows),1)
        key=rows[0]['id'];metadata={'a':{key:{'name':'Renamed','category':'scene'}},'b':{key:{'name':'Other'}}}
        row=self.catalog([project],models=models,metadata=metadata)[0]
        self.assertEqual((row['name'],row['category']),('Renamed','scene'))
        self.assertEqual(row['object'],obj)

    def test_shared_rating_and_favorite_override_node_rating_without_changing_project(self):
        project={'id':'p','workspaceId':'a','nodes':[{'id':'n','previewMedia':media('a','png'),'rating':3}]}
        original=self.catalog([project])[0]
        self.assertEqual(original['rating'],3)
        row=self.catalog([project],metadata={'a':{original['id']:{'rating':5,'favorite':True}}})[0]
        self.assertEqual(row['rating'],5);self.assertTrue(row['favorite']);self.assertEqual(project['nodes'][0]['rating'],3)

    def test_inline_payload_deferred_and_invalid_urls_ignored(self):
        project={'id':'p','workspaceId':'a','nodes':[{'previewMedia':'data:image/png;base64,AAAA'},
                    {'imageUrl':'javascript:alert(1)'},{'imageUrl':'http://['}]}
        rows=self.catalog([project]);self.assertEqual(len(rows),1)
        summary=summary_item(rows[0]);self.assertTrue(summary['deferred']);self.assertEqual(summary['url'],'')
        self.assertTrue(rows[0]['url'].startswith('data:image/'))

    def test_blender_generated_models_remain_generated_in_library_and_project(self):
        obj={'id':'desk','kind':'geometry','local':True,'modelUrl':media('f','glb'),
             'blenderJobId':'blend-'+'a'*32}
        model={'id':'saved','workspaceId':'a','name':'Desk','object':obj}
        project={'id':'p','workspaceId':'a','nodes':[{'id':'n','type':'director',
                 'directorProject':{'objects':[obj]}}]}
        rows=self.catalog([project],models=[model])
        self.assertEqual(len(rows),1);self.assertEqual(rows[0]['origins'],['generated'])
        imported={**obj};imported.pop('blenderJobId')
        self.assertEqual(self.catalog(models=[{**model,'object':imported}])[0]['origins'],['uploaded'])

    def test_procedural_model_replacement_keeps_identity_and_updates_type(self):
        project={'id':'p','workspaceId':'a','nodes':[{'id':'n','type':'director','directorProject':{
            'objects':[{'id':'box','kind':'geometry','name':'Box','geometryType':'box'}]}}]}
        original=self.catalog([project])[0]
        metadata={'a':{original['id']:{'name':'Replaced model','replacement':{'kind':'image','url':media('a','png'),'size':'2 KB'}}}}
        row=self.catalog([project],metadata=metadata)[0]
        self.assertEqual((row['id'],row['kind'],row['name']),(original['id'],'image','Replaced model'))
        self.assertIsNone(row['object']);self.assertEqual(row['origins'],['uploaded'])
        self.assertEqual(row['projects'],original['projects']);self.assertFalse(summary_item(row)['hasObject'])

    def test_deleted_material_stays_hidden_across_all_sources_and_workspaces(self):
        project={'id':'p','workspaceId':'a','nodes':[{'id':'n','previewMedia':media('a','png')}]}
        asset={'id':'asset','workspaceId':'a','name':'Shared image','kind':'image','mediaUrl':media('a','png')}
        job={'id':'job','workspaceId':'a','status':'completed','kind':'image','imageUrl':media('a','png')}
        original=self.catalog([project],[asset],jobs=[job])[0]
        metadata={'a':{original['id']:{'deleted':True,'name':'Keep this name','category':'character'}}}
        self.assertEqual(self.catalog([project],[asset],jobs=[job],metadata=metadata),[])
        restored=build_catalog('a',[project],[asset],[],[],[job],scope,metadata,include_deleted=True)
        self.assertEqual(len(restored),1)
        self.assertEqual(restored[0]['name'],'Keep this name')
        self.assertEqual(restored[0]['references'],original['references'])
        other={**asset,'workspaceId':'b'}
        self.assertEqual(len(self.catalog(assets=[other],metadata=metadata,workspace='b')),1)

if __name__=='__main__':unittest.main()
