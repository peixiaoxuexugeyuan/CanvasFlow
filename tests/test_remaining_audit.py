"""Remaining-route audit with temporary accounts; no model calls or real emails."""
import concurrent.futures
import json
import os
import unittest
import threading
import http.client
from unittest.mock import patch
import test_security_audit as fixture


class RemainingAuditTests(unittest.TestCase):
    project=fixture.SecurityAuditTests.project
    request=fixture.SecurityAuditTests.request
    @classmethod
    def setUpClass(cls):fixture.SecurityAuditTests.setUpClass.__func__(cls)
    @classmethod
    def tearDownClass(cls):fixture.SecurityAuditTests.tearDownClass.__func__(cls)
    def setUp(self):
        fixture.SecurityAuditTests.setUp(self)
        digest,salt=self.app.create_password_hash('AuditPassword123!')
        with self.app.auth_db() as db:
            for owner in ('alice','bob'):
                self.tokens[owner]=self.app.create_session(db,owner,self.app.auth_now())
            db.execute('DELETE FROM verification_codes')
            db.execute('DELETE FROM auth_identities')
            for owner in ('alice','bob'):
                db.execute('UPDATE users SET password_hash=?,password_salt=?,status=? WHERE id=?',(digest,salt,'active',owner))
                db.execute('INSERT INTO auth_identities VALUES (?,?,?,?,?,?,?)',(owner+'-email',owner,'email',owner+'@audit.invalid',owner+'@audit.invalid',self.app.auth_iso(),self.app.auth_iso()))

    @unittest.skip("Retired platform account/share/quota/billing behavior; local HTTP coverage: test_local_security_audit.py")
    def test_admin_invalid_fields_never_partially_commit(self):
        for data in ({'status':'suspended','role':'invalid'}, {'status':'suspended','creditDelta':'1.2'},
                     {'status':'suspended','creditDelta':True}):
            self.assertEqual(self.request('PUT','/api/admin/users/bob',data)[0],400)
            with self.app.auth_db() as db:self.assertEqual(db.execute("SELECT status FROM users WHERE id='bob'").fetchone()[0],'active')

    @unittest.skip("Retired platform account/share/quota/billing behavior; local HTTP coverage: test_local_security_audit.py")
    def test_password_change_invalidates_other_sessions_only(self):
        other='legacy-second-session'
        with self.app.auth_db() as db:
            db.execute('INSERT INTO sessions VALUES (?,?,?,?,?)',(self.app.session_digest(other),'alice','2099-01-01T00:00:00+00:00',self.app.auth_iso(),self.app.auth_iso()))
        self.assertEqual(self.request('POST','/api/account/password',{'currentPassword':'AuditPassword123!','newPassword':'NewAuditPassword123!'})[0],200)
        self.assertEqual(self.request('GET','/api/auth/me')[0],200)
        with self.app.auth_db() as db:self.assertIsNone(db.execute('SELECT token_hash FROM sessions WHERE token_hash=?',(self.app.session_digest(other),)).fetchone())

    @unittest.skip("Retired platform account/share/quota/billing behavior; local HTTP coverage: test_local_security_audit.py")
    def test_email_change_requires_password_and_code_is_account_bound(self):
        target='new@audit.invalid'
        with patch.object(self.app,'send_login_email',return_value='development') as mail,patch.object(self.app,'AUTH_DEV_MODE',True):
            self.assertEqual(self.request('POST','/api/account/email/send-code',{'email':target})[0],401);mail.assert_not_called()
            status,body,_=self.request('POST','/api/account/email/send-code',{'email':target,'currentPassword':'AuditPassword123!'})
        self.assertEqual(status,202);code=body['devCode']
        self.assertEqual(self.request('POST','/api/account/email',{'email':target,'code':code},user='bob')[0],400)
        self.assertEqual(self.request('POST','/api/account/email',{'email':target,'code':code})[0],200)
        self.assertEqual(self.request('POST','/api/account/email',{'email':target,'code':code},user='bob')[0],409)

    @unittest.skip("Retired platform account/share/quota/billing behavior; local HTTP coverage: test_local_security_audit.py")
    def test_production_does_not_echo_development_code(self):
        with patch.object(self.app,'AUTH_DEV_MODE',False),patch.object(self.app,'send_login_email',return_value='development'):
            status,body,_=self.request('POST','/api/auth/send-code',{'email':'new@audit.invalid','agreementAccepted':True,'agreementVersion':'2026-09-01'},user=None)
        self.assertEqual(status,202);self.assertNotIn('devCode',body)
        with patch.dict(os.environ,{'SMTP_HOST':'','SMTP_FROM':'','SMTP_USER':''}),patch.object(self.app,'AUTH_DEV_MODE',False):
            with self.assertRaises(RuntimeError):self.app.send_login_email('fixture@audit.invalid','123456')

    @unittest.skip("Retired platform account/share/quota/billing behavior; local HTTP coverage: test_local_security_audit.py")
    def test_parallel_registration_consumes_code_once(self):
        email='parallel@audit.invalid';stamp=self.app.auth_iso()
        with self.app.auth_db() as db:
            db.execute('INSERT INTO verification_codes (id,channel,identifier,purpose,code_hash,expires_at,requested_ip,created_at) VALUES (?,?,?,?,?,?,?,?)',
                       ('parallel','email',email,'register',self.app.verification_digest(email,'123456','register'),'2099-01-01T00:00:00+00:00','127.0.0.1',stamp))
        payload={'email':email,'password':'AuditPassword123!','code':'123456','agreementAccepted':True,'agreementVersion':'2026-09-01'}
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            statuses=list(pool.map(lambda _:self.request('POST','/api/auth/register',payload,user=None)[0],range(2)))
        self.assertEqual(statuses.count(201),1);self.assertIn(400,statuses)
        with self.app.auth_db() as db:self.assertEqual(db.execute('SELECT count(*) FROM auth_identities WHERE normalized_identifier=?',(email,)).fetchone()[0],1)

    def test_credentials_only_go_to_their_declared_origin(self):
        entry={'baseUrl':'https://original.invalid/v1','apiKey':'PRIVATE-FAKE-KEY','authMode':'bearer'}
        headers=self.app.auth_headers(entry)
        with patch.object(self.app,'send_request',return_value=(200,{},None)) as send:
            self.app.http_json_request('https://original.invalid/v1/tasks/1',headers=headers)
            self.assertEqual(send.call_args.args[0].get_header('Authorization'),'Bearer PRIVATE-FAKE-KEY')
            self.app.http_json_request('https://other.invalid/status',headers=headers)
            self.assertIsNone(send.call_args.args[0].get_header('Authorization'))
            self.app.http_body_request('http://original.invalid/upload',b'fixture',headers=headers)
            self.assertIsNone(send.call_args.args[0].get_header('Authorization'))

    @unittest.skip("Retired platform account/share/quota/billing behavior; local HTTP coverage: test_local_security_audit.py")
    def test_active_job_cannot_be_deleted_while_its_worker_can_write(self):
        self.app.append_job({'id':'active','userId':'alice','workspaceId':self.app.default_workspace_id('alice'),'status':'running'})
        self.assertEqual(self.request('DELETE','/api/jobs/active')[0],409)
        self.assertEqual(self.request('POST','/api/storage/delete',{'id':'job:active'})[0],409)
        self.assertIn('active',self.app.JOBS_FILE.read_text(encoding='utf-8'))

    def test_invalid_explicit_video_model_never_falls_back_to_paid_provider(self):
        candidate={'id':'other','enabled':True,'type':'video','apiKey':'fake','baseUrl':'http://mock.invalid','model':'mock'}
        with patch.object(self.app,'visible_ai_models',return_value=[candidate]),patch.object(self.app,'call_video_submit') as submit:
            job,error=self.app.create_video_job({'id':'alice'},{'prompt':'scene','generationSettings':{'modelId':'missing'}})
            self.assertIsNone(job);self.assertEqual(error['status'],400);submit.assert_not_called()

    @unittest.skip("Retired platform account/share/quota/billing behavior; local HTTP coverage: test_local_security_audit.py")
    def test_new_device_login_revokes_previous_session(self):
        old_token=self.tokens['alice']
        payload={'email':'alice@audit.invalid','password':'AuditPassword123!','agreementAccepted':True,'agreementVersion':'2026-09-01'}
        status,_,headers=self.request('POST','/api/auth/login',payload,user=None)
        self.assertEqual(status,200)
        self.assertEqual(self.request('GET','/api/auth/me')[0],401)
        cookie=headers['Set-Cookie'].split(';')[0]
        self.assertEqual(self.request('GET','/api/auth/me',user=None,headers={'Cookie':cookie})[0],200)
        self.assertEqual(self.request('GET','/api/auth/me',user='bob')[0],200)
        with self.app.auth_db() as db:
            self.assertEqual(db.execute("SELECT count(*) FROM sessions WHERE user_id='alice'").fetchone()[0],1)
            self.assertIsNone(db.execute('SELECT 1 FROM sessions WHERE token_hash=?',(self.app.session_digest(old_token),)).fetchone())

    @unittest.skip("Retired platform account/share/quota/billing behavior; local HTTP coverage: test_local_security_audit.py")
    def test_parallel_device_logins_leave_exactly_one_valid_cookie(self):
        payload={'email':'alice@audit.invalid','password':'AuditPassword123!','agreementAccepted':True,'agreementVersion':'2026-09-01'}
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            results=list(pool.map(lambda _:self.request('POST','/api/auth/login',payload,user=None),range(2)))
        self.assertTrue(all(result[0]==200 for result in results))
        statuses=[self.request('GET','/api/auth/me',user=None,headers={'Cookie':result[2]['Set-Cookie'].split(';')[0]})[0] for result in results]
        self.assertEqual(sorted(statuses),[200,401])

    @unittest.skip("Retired platform account/share/quota/billing behavior; local HTTP coverage: test_local_security_audit.py")
    def test_failed_device_login_does_not_revoke_existing_session(self):
        payload={'email':'alice@audit.invalid','password':'WrongPassword123!','agreementAccepted':True,'agreementVersion':'2026-09-01'}
        self.assertEqual(self.request('POST','/api/auth/login',payload,user=None)[0],401)
        self.assertEqual(self.request('GET','/api/auth/me')[0],200)

    @unittest.skip("Retired platform account/share/quota/billing behavior; local HTTP coverage: test_local_security_audit.py")
    def test_startup_prunes_old_sessions_and_keeps_newest_unexpired_session(self):
        with self.app.auth_db() as db:
            for token,created,expiry in [('legacy-old','2025-01-01','2099-01-01'),('expired-new','2098-01-01','2020-01-01')]:
                db.execute('INSERT INTO sessions VALUES (?,?,?,?,?)',(self.app.session_digest(token),'alice',expiry,created,created))
        self.app.init_auth_db()
        self.assertEqual(self.request('GET','/api/auth/me')[0],200)
        with self.app.auth_db() as db:self.assertEqual(db.execute("SELECT count(*) FROM sessions WHERE user_id='alice'").fetchone()[0],1)

    def test_anonymous_provider_can_be_selected_and_called_without_fake_credentials(self):
        entry={'id':'local','enabled':True,'type':'i2t','authMode':'none','baseUrl':'http://127.0.0.1:9999/v1','model':'fixture'}
        with patch.object(self.app,'visible_ai_models',return_value=[entry]):
            self.assertEqual(self.app.agent_resolve_model('local','alice')[0],entry)
        with patch.object(self.app,'request_json_candidates',return_value=({'choices':[{'message':{'content':'fixture response'}}]},'mock',None)) as send:
            self.assertEqual(self.app.call_chat_completion(entry,[{'type':'text','text':'fixture'}]),('fixture response',None))
            self.assertNotIn('Authorization',send.call_args.kwargs['headers'])
        with patch.object(self.app,'fetch_remote_catalog',return_value=([],[],'')) as fetch:
            result=self.request('POST','/api/admin/ai-models/fetch-remote',{'baseUrl':entry['baseUrl'],'authMode':'none'})
            self.assertEqual(result[0],200);self.assertEqual(fetch.call_args.args[1],'')
        with patch.object(self.app,'fetch_remote_catalog',return_value=([],[],'')):
            self.assertEqual(self.request('POST','/api/admin/ai-models/fetch-remote',{'baseUrl':entry['baseUrl'],'authMode':'none'},user='bob')[0],200)

    def test_bad_reference_or_source_video_is_rejected_before_provider_submission(self):
        candidate={'id':'video','enabled':True,'type':'video','apiKey':'fake','baseUrl':'http://mock.invalid','model':'mock'}
        with patch.object(self.app,'visible_ai_models',return_value=[candidate]),patch.object(self.app,'call_video_submit') as submit:
            for input_fields in ({'referenceImages':['data:image/png;base64,'+'A'*self.app.VIDEO_MAX_IMAGE]}, {'sourceVideos':['https://mock.invalid/'+'A'*self.app.VIDEO_INPUT_VIDEO_MAX_LEN]}):
                job,error=self.app.create_video_job({'id':'alice'},{'prompt':'scene','generationSettings':{'modelId':'video'},**input_fields})
                self.assertIsNone(job);self.assertEqual(error['status'],400)
            submit.assert_not_called()

    def test_extreme_range_returns_416_without_integer_conversion_failure(self):
        from request_security import byte_range
        self.assertEqual(byte_range('bytes='+'9'*5000+'-',100),(0,-1,416))

    def test_busy_upload_returns_retryable_response_without_reading_large_body(self):
        with patch.object(self.app,'MEDIA_UPLOAD_SLOTS',threading.BoundedSemaphore(0)):
            status,body,headers=self.request('POST','/api/media',headers={'Content-Length':'200000000'})
        self.assertEqual(status,429);self.assertEqual(body['error'],'uploads_busy');self.assertEqual(headers['Retry-After'],'2')

    def test_http_thread_limit_recovers_after_slow_request_finishes(self):
        from bounded_http import ThreadingHTTPServer
        from http.server import BaseHTTPRequestHandler
        entered=threading.Event();release=threading.Event()
        class Limited(ThreadingHTTPServer):max_request_threads=1
        class Handler(BaseHTTPRequestHandler):
            def do_GET(self):
                entered.set();release.wait(3);self.send_response(200);self.send_header('Content-Length','0');self.end_headers()
            def log_message(self,*args):pass
        server=Limited(('127.0.0.1',0),Handler);runner=threading.Thread(target=server.serve_forever,daemon=True);runner.start()
        def request():
            client=http.client.HTTPConnection('127.0.0.1',server.server_port,timeout=4)
            try:client.request('GET','/');response=client.getresponse();response.read();return response.status
            finally:client.close()
        try:
            with concurrent.futures.ThreadPoolExecutor() as pool:
                first=pool.submit(request);self.assertTrue(entered.wait(2));self.assertEqual(request(),503);release.set();self.assertEqual(first.result(),200)
            self.assertEqual(request(),200)
        finally:release.set();server.shutdown();server.server_close();runner.join()

    @unittest.skip("Retired platform account/share/quota/billing behavior; local HTTP coverage: test_local_security_audit.py")
    def test_recharge_cannot_create_credits_without_verified_payment(self):
        for user in ('alice','bob'):
            with self.app.auth_db() as db:before=self.app.user_credit_balance(db,user)
            self.assertEqual(self.request('POST','/api/credits/recharge',{'amount':100000},user=user)[0],503)
            with self.app.auth_db() as db:self.assertEqual(self.app.user_credit_balance(db,user),before)

    @unittest.skip("Retired platform account/share/quota/billing behavior; local HTTP coverage: test_local_security_audit.py")
    def test_parallel_email_requests_reserve_one_send_and_failed_delivery_invalidates_code(self):
        payload={'email':'reserve@audit.invalid','agreementAccepted':True,'agreementVersion':'2026-09-01'}
        with patch.object(self.app,'send_login_email',return_value='development') as mail:
            with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
                statuses=list(pool.map(lambda _:self.request('POST','/api/auth/send-code',payload,user=None)[0],range(2)))
        self.assertEqual(sorted(statuses),[202,429]);self.assertEqual(mail.call_count,1)
        payload['email']='failed@audit.invalid'
        with patch.object(self.app,'send_login_email',side_effect=RuntimeError('fixture failure')):
            self.assertEqual(self.request('POST','/api/auth/send-code',payload,user=None)[0],502)
        with self.app.auth_db() as db:
            self.assertTrue(db.execute('SELECT consumed_at FROM verification_codes WHERE identifier=?',(payload['email'],)).fetchone()[0])

    def test_unsuccessful_cancellation_cannot_fail_or_refund_a_running_job(self):
        job={'id':'pending','userId':'alice','workspaceId':self.app.default_workspace_id('alice'),'status':'running','simulated':False,'kind':'video','modelId':'video'}
        self.app.append_job(job)
        with patch.object(self.app,'visible_ai_models',return_value=[{'id':'video'}]),patch.object(self.app,'cancel_provider_job',return_value=(False,'fixture unavailable')):
            self.assertEqual(self.request('POST','/api/jobs/pending/cancel',{})[0],409)
        self.assertEqual(self.app.latest_jobs(user_id=self.app.LOCAL_ID)[0]['status'],'running')

    def test_image_cancellation_uses_image_endpoint_and_preserves_terminal_result(self):
        job={'id':'image','userId':'alice','workspaceId':self.app.default_workspace_id('alice'),'status':'running','simulated':False,'kind':'image','modelId':'image'}
        self.app.append_job(job)
        def finish(entry,current,kind):
            self.assertEqual(kind,'image');self.app.append_job({**job,'status':'completed'});return True,'fixture accepted'
        with patch.object(self.app,'visible_ai_models',return_value=[{'id':'image'}]),patch.object(self.app,'cancel_provider_job',side_effect=finish):
            self.assertEqual(self.request('POST','/api/jobs/image/cancel',{})[0],409)
        self.assertEqual(self.app.latest_jobs(user_id=self.app.LOCAL_ID)[0]['status'],'completed')

    def test_successful_cancellation_writes_terminal_history_without_nested_lock_deadlock(self):
        job={'id':'cancel-ok','userId':'alice','workspaceId':self.app.default_workspace_id('alice'),'status':'running','simulated':False,'kind':'video','modelId':'video'}
        self.app.append_job(job)
        with patch.object(self.app,'visible_ai_models',return_value=[{'id':'video'}]),patch.object(self.app,'cancel_provider_job',return_value=(True,'fixture accepted')):
            self.assertEqual(self.request('POST','/api/jobs/cancel-ok/cancel',{})[0],200)
        latest=self.app.latest_jobs(user_id=self.app.LOCAL_ID)[0]
        self.assertEqual(latest['status'],'failed');self.assertEqual(latest['upstreamCancelled'],True)


if __name__=='__main__':unittest.main()

