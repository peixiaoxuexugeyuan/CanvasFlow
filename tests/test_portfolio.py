import copy
import json
import tempfile
import threading
import unittest
from pathlib import Path
from portfolio import PortfolioStore,PortfolioError


class PortfolioTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.path=Path(self.tmp.name)/'portfolio.json'
        self.projects=[{'id':'a','ownerId':'alice','projectName':'Private scene','shared':False,'nodes':[{'secret':'prompt'}]},
                       {'id':'b','ownerId':'bob','projectName':'Other scene','shared':True}]
        self.assets=[{'id':'image','ownerId':'alice','name':'Still','kind':'image','mediaUrl':'/media/media-'+'a'*32+'.png'}]
        self.store=PortfolioStore(self.path,lambda p,d:json.loads(p.read_text()) if p.exists() else copy.deepcopy(d),lambda p,v:p.write_text(json.dumps(v)),threading.Lock(),lambda:self.projects,lambda:self.assets,lambda:[],lambda:'2026-10-14T00:00:00Z')
        self.alice={'id':'alice'}
    def tearDown(self):self.tmp.cleanup()
    def create(self,**extra):return self.store.save(self.alice,{'name':'Scene','sourceKind':'project','sourceId':'a',**extra})
    def denied(self,status,action):
        with self.assertRaises(PortfolioError) as error:action()
        self.assertEqual(error.exception.status,status)
    def test_empty_public_visit_does_not_create_store(self):
        self.assertEqual(self.store.list('alice',False),[]);self.assertFalse(self.path.exists())
    def test_default_private_and_account_isolated_sources(self):
        work=self.create();self.assertFalse(work['isPublic']);self.assertEqual(self.store.list('alice',False),[])
        self.assertEqual(self.store.list('bob'),[]);self.assertEqual(len(self.store.sources('alice')),2)
        self.denied(403,lambda:self.store.save(self.alice,{'name':'Stolen','sourceKind':'project','sourceId':'b'}))
    def test_publication_does_not_publish_project_or_leak_graph(self):
        self.create(isPublic=True);public=self.store.list('alice',False)[0]
        self.assertFalse(self.projects[0]['shared']);self.assertNotIn('nodes',public);self.assertNotIn('prompt',json.dumps(public));self.assertNotIn('sourceId',public);self.assertFalse(public['canOpen'])
    def test_owner_only_update_and_delete_with_revision_conflict(self):
        work=self.create()
        self.denied(403,lambda:self.store.save({'id':'bob'},{'name':'Evil','revision':1},work['id']))
        self.denied(403,lambda:self.store.delete('bob',work['id']))
        self.denied(409,lambda:self.store.save(self.alice,{'name':'Stale','revision':0},work['id']))
        updated=self.store.save(self.alice,{'name':'Updated','description':'Detail','revision':1},work['id'])
        self.assertEqual(updated['revision'],2);self.assertEqual(self.store.list('alice')[0]['name'],'Updated')
        self.store.delete('alice',work['id']);self.assertEqual(len(self.projects),2)
    def test_duplicate_rejected_and_order_survives_reopen(self):
        first=self.create();self.denied(409,self.create)
        second=self.store.save(self.alice,{'name':'Still','sourceKind':'asset','sourceId':'image'})
        self.store.reorder('alice',[second['id'],first['id']]);self.assertEqual([w['id'] for w in self.store.list('alice')],[second['id'],first['id']])
        self.denied(409,lambda:self.store.reorder('alice',[first['id']]))
        self.denied(400,lambda:self.store.reorder('alice',[first['id'],first['id']]))
    def test_unpublish_takes_effect_and_removed_source_is_hidden(self):
        work=self.create(isPublic=True);self.store.save(self.alice,{'name':'Scene','revision':1,'isPublic':False},work['id']);self.assertEqual(self.store.list('alice',False),[])
        self.store.save(self.alice,{'name':'Scene','revision':2,'isPublic':True},work['id']);self.projects.pop(0)
        self.assertEqual(self.store.list('alice',False),[]);self.assertFalse(self.store.list('alice')[0]['available'])
        self.denied(400,lambda:self.store.save(self.alice,{'name':'Scene','revision':3,'isPublic':True},work['id']))
    def test_malformed_fields_and_unsafe_cover_do_not_modify_store(self):
        for fields in ({'name':'','sourceKind':'project','sourceId':'a'}, {'name':'X','sourceKind':'project','sourceId':'a','isPublic':'true'}, {'name':'X','sourceKind':'project','sourceId':'a','thumbnail':'https://evil.test/x.svg'}):
            self.denied(400,lambda:self.store.save(self.alice,fields))
        self.assertFalse(self.path.exists())


if __name__=='__main__':unittest.main()
