import concurrent.futures
from contextlib import contextmanager
import sqlite3
import tempfile
import unittest
from pathlib import Path
from urllib.parse import parse_qs,urlparse
from account_storage import AccountStorage,StorageError,RETENTION_SECONDS,content_size,media_ids


class AccountStorageTests(unittest.TestCase):
    def test_removed_record_cannot_be_renewed(self):
        self.rows=[('asset',{'id':'gone','ownerId':'alice','name':'Removed'})]
        self.store.sync(force=True)
        self.rows=[]
        with self.assertRaises(StorageError) as error:self.store.renew('alice','asset:gone')
        self.assertEqual(error.exception.status,410)
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();root=Path(self.tmp.name);self.directory=root/'media';self.directory.mkdir();self.database=root/'auth.db'
        @contextmanager
        def db():
            connection=sqlite3.connect(self.database,timeout=10)
            try:
                with connection:yield connection
            finally:connection.close()
        self.db=db
        with db() as connection:
            connection.execute('CREATE TABLE users (id TEXT PRIMARY KEY,role TEXT,created_at TEXT)')
            connection.executemany('INSERT INTO users VALUES (?,?,?)',[('alice','admin','2026-01-01'),('bob','user','2026-01-02')])
        self.now=1000.;self.rows=[]
        def remove(kind,id,owner):self.rows[:]=[(group,item) for group,item in self.rows if not (group==kind and item['id']==id and (item.get('ownerId') or item.get('userId'))==owner)]
        self.store=AccountStorage(self.directory,db,lambda:self.rows,remove,b'secret',5000,lambda:self.now)
    def tearDown(self):self.tmp.cleanup()
    def name(self,id=1):return 'media-'+format(id,'032x')+'.png'
    def write(self,owner='alice',id=1,size=100):
        name=self.name(id);return self.store.write(owner,name,bytes([id%256])*size,'image/png','Still')
    def denied(self,status,action):
        with self.assertRaises(StorageError) as error:action()
        self.assertEqual(error.exception.status,status)
    def test_metadata_and_unreferenced_files_both_consume_quota_once(self):
        name=self.write(size=200);self.rows=[('project',{'id':'p','ownerId':'alice','nodes':[{'url':'/media/'+name}]}),('asset',{'id':'a','ownerId':'alice','mediaId':name})]
        self.assertEqual(self.store.used('alice'),200+sum(content_size(item) for _,item in self.rows))
        self.assertEqual(self.store.used('bob'),0)
    def test_migration_gives_old_files_a_full_thirty_days(self):
        name=self.name();file=self.directory/name;file.write_bytes(b'old')
        self.rows=[('project',{'id':'p','ownerId':'bob','nodes':[{'mediaUrl':'/media/'+name}]})]
        self.store.sync(force=True);row=self.store.file_row(name)
        self.assertEqual(row['ownerId'],'bob');self.assertEqual(row['expiresAt'],self.now+RETENTION_SECONDS)
    def test_private_media_requires_owner_or_valid_time_limited_link(self):
        name=self.write();self.assertTrue(self.store.can_read(name,'alice'));self.assertFalse(self.store.can_read(name,'bob'));self.assertFalse(self.store.can_read(name))
        url=self.store.signed_url(name);query=parse_qs(urlparse(url).query);signature=query['signature'][0];expires=query['expires'][0]
        self.assertTrue(self.store.can_read(name,signature=signature,expires=expires))
        self.assertFalse(self.store.can_read(name,signature=signature+'x',expires=expires));self.assertFalse(self.store.can_read(self.name(2),signature=signature,expires=expires))
        self.now+=3601;self.assertFalse(self.store.can_read(name,signature=signature,expires=expires))
    def test_publication_and_revocation_are_checked_on_each_read(self):
        name=self.write();self.rows=[('asset',{'id':'a','ownerId':'alice','mediaId':name,'shared':True})]
        self.assertTrue(self.store.can_read(name));self.rows[0][1]['shared']=False;self.assertFalse(self.store.can_read(name))
        self.rows=[('portfolio',{'id':'w','ownerId':'alice','mediaUrl':'/media/'+name,'isPublic':True})];self.assertTrue(self.store.can_read(name))
    def test_renewal_resets_deadline_and_renews_linked_metadata(self):
        name=self.write();self.rows=[('asset',{'id':'a','ownerId':'alice','mediaId':name})];self.store.sync(force=True)
        self.now+=10*86400;result=self.store.renew('alice','file:'+name);self.assertEqual(result['expiresAt'],self.now+RETENTION_SECONDS)
        with self.db() as db:self.assertEqual(db.execute("SELECT expires_at FROM content_retention WHERE item_id='a'").fetchone()[0],result['expiresAt'])
        self.now+=86400;result=self.store.renew('alice','asset:a');self.assertEqual(self.store.file_row(name)['expiresAt'],result['expiresAt'])
    def test_foreign_account_cannot_renew_delete_or_change_file_owner(self):
        name=self.write();self.denied(403,lambda:self.store.renew('bob','file:'+name));self.denied(403,lambda:self.store.delete('bob','file:'+name));self.assertTrue((self.directory/name).exists())
    def test_lowering_quota_never_deletes_existing_content(self):
        name=self.write(size=1000);self.store.set_quota('alice',50);self.assertTrue((self.directory/name).exists());self.assertEqual(self.store.used('alice'),1000)
        self.denied(413,lambda:self.write(id=2,size=1));self.store.ensure('alice',-1)
        self.store.delete('alice','file:'+name);self.assertEqual(self.store.used('alice'),0)
    def test_concurrent_uploads_cannot_exceed_account_quota(self):
        def upload(id):
            try:self.write(id=id,size=1000);return True
            except StorageError:return False
        with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:results=list(pool.map(upload,range(1,10)))
        self.assertEqual(sum(results),5);self.assertEqual(self.store.used('alice'),5000)
        self.assertEqual(len(list(self.directory.iterdir())),5)
    def test_expiration_cleans_files_and_generation_records_but_keeps_projects(self):
        name=self.write();self.rows=[('project',{'id':'p','ownerId':'alice','nodes':[]}),('asset',{'id':'a','ownerId':'alice','mediaId':name}),('job',{'id':'j','userId':'alice','status':'completed'}),('portfolio',{'id':'w','ownerId':'alice'})]
        self.store.sync(force=True);self.now+=RETENTION_SECONDS+1;self.store.cleanup()
        self.assertFalse((self.directory/name).exists());self.assertEqual({group for group,_ in self.rows},{'project','portfolio'})
        self.assertEqual(self.store.used('alice'),sum(content_size(item) for _,item in self.rows))
    def test_cleanup_does_not_remove_active_generation_jobs(self):
        self.rows=[('job',{'id':'j','userId':'alice','status':'running'})];self.store.sync(force=True);self.now+=RETENTION_SECONDS+1;self.store.cleanup();self.assertEqual(len(self.rows),1)
    def test_invalid_quota_and_foreign_record_deletion_are_rejected(self):
        for value in (True,-1,'100',None,100*1024**4+1):self.denied(400,lambda:self.store.set_quota('alice',value))
        self.rows=[('asset',{'id':'a','ownerId':'alice'})];self.store.sync(force=True);self.denied(403,lambda:self.store.delete('bob','asset:a'))
    def test_nested_and_serialized_scene_media_references_are_found(self):
        name=self.name();self.assertEqual(media_ids({'scene':'{"texture":"/media/'+name+'"}','model':'/media/'+name+'?expires=5'}),{name})
    def test_repeated_content_is_reused_within_an_account_only(self):
        first=self.write();second=self.store.write('alice',self.name(2),bytes([1])*100,'image/png','Same')
        self.assertEqual(first,second);self.assertEqual(self.store.used('alice'),100);self.assertEqual(len(list(self.directory.iterdir())),1)
        self.store.write('bob',self.name(3),bytes([1])*100,'image/png','Same');self.assertEqual(len(list(self.directory.iterdir())),2)


if __name__=='__main__':unittest.main()
