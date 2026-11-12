"""Agent regression tests: disposable accounts, fake keys and loopback upstream only."""
import io
import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch
from urllib.error import HTTPError, URLError
import agent_runtime as agent
import test_security_audit as fixture


class AgentRuntimeReviewTests(unittest.TestCase):
    def call(self, id, name, **args):
        return {'id': id, 'name': name, 'arguments': json.dumps(args)}

    def test_invalid_target_never_calls_paid_tool(self):
        for name in ('generate_text', 'generate_image'):
            callback = unittest.mock.Mock()
            with self.assertRaises(agent.ToolError):
                agent.execute_tool(name, {'prompt':'forest', 'nodeId':'missing'},
                                   {'canvas':agent.WorkingCanvas(), name:callback})
            callback.assert_not_called()

    def test_ask_batch_and_resume_always_pairs_all_tools(self):
        calls = [self.call('ask','ask_user',question='选择？',options=['A','B']), self.call('later','create_node',type='prompt')]
        messages=[]
        events=list(agent.run_agent_loop(messages=messages,chat=lambda *_:iter([('tool_calls', calls)]),ctx={'canvas':agent.WorkingCanvas()}))
        self.assertTrue(any(e['type']=='ask' for e in events))
        self.assertEqual([m.get('tool_call_id') for m in messages if m['role']=='tool'], ['later'])
        list(agent.run_agent_loop(messages=messages,chat=lambda *_:iter([('text','完成')]),ctx={},resume={'toolCallId':'ask','content':'A'}))
        self.assertEqual({m['tool_call_id'] for m in messages if m['role']=='tool'}, {'ask','later'})

    def test_manual_generation_requires_stored_approval(self):
        callback=unittest.mock.Mock(return_value=('data:image/png;base64,fixture',None))
        ctx={'canvas':agent.WorkingCanvas(), 'generate_image':callback, 'genMode':'manual'}
        messages=[]; calls=[self.call('image','generate_image',prompt='forest')]
        events=list(agent.run_agent_loop(messages=messages,chat=lambda *_:iter([('tool_calls',calls)]),ctx=ctx))
        ask=next(e for e in events if e['type']=='ask'); callback.assert_not_called()
        list(agent.run_agent_loop(messages=messages,chat=lambda *_:iter([('text','完成')]),ctx=ctx,
                                 resume={'toolCallId':'image','content':'确认生成','generationApproval':ask['generationApproval']}))
        callback.assert_called_once()

    def test_script_mode_and_cancel_never_generate(self):
        for mode, answer in [('script-original','确认生成'), ('allround','取消')]:
            callback=unittest.mock.Mock();ctx={'canvas':agent.WorkingCanvas(),'generate_image':callback,'mode':mode}
            messages=[];events=list(agent.run_agent_loop(messages=messages,chat=lambda *_:iter([('tool_calls',[self.call('i','generate_image',prompt='p')])]),ctx=ctx,max_steps=1))
            ask=next((e for e in events if e['type']=='ask'),None)
            if ask:list(agent.run_agent_loop(messages=messages,chat=lambda *_:iter([('text','取消')]),ctx=ctx,resume={'toolCallId':'i','content':answer,'generationApproval':ask['generationApproval']}))
            callback.assert_not_called()

    def test_interrupted_tools_remain_paired(self):
        messages=[{'role':'assistant','tool_calls':[{'id':'lost','function':{'name':'create_node'}}]}]
        agent.repair_interrupted_tools(messages)
        self.assertEqual(messages[-1]['tool_call_id'],'lost')
        agent.repair_interrupted_tools(messages)
        self.assertEqual(len(messages),2)

    def test_tool_stream_resource_limits(self):
        accumulator=agent.ToolCallAccumulator()
        with self.assertRaises(ValueError):
            accumulator.feed([{'index':0,'function':{'name':'create_node','arguments':'x'*64001}}])
        accumulator=agent.ToolCallAccumulator()
        with self.assertRaises(ValueError):
            accumulator.feed([{'index':i,'function':{'name':'read_canvas'}} for i in range(33)])

    def test_short_history_with_unfinished_call_never_indexes_past_end(self):
        messages=[{'role':'user','content':'hi'},{'role':'assistant','tool_calls':[{'id':'ask'}]}]
        self.assertIsInstance(agent.trim_history(messages,keep=1),list)


class AgentHTTPReviewTests(unittest.TestCase):
    project=fixture.SecurityAuditTests.project
    request=fixture.SecurityAuditTests.request
    @classmethod
    def setUpClass(cls):fixture.SecurityAuditTests.setUpClass.__func__(cls)
    @classmethod
    def tearDownClass(cls):fixture.SecurityAuditTests.tearDownClass.__func__(cls)
    def setUp(self):fixture.SecurityAuditTests.setUp(self)

    def test_chat_cannot_use_foreign_project_or_workspace_session(self):
        self.assertEqual(self.request('POST','/api/agent/chat',{'message':'hello','canvas':{'projectId':'missing-project'}})[0],404)
        self.app.write_file(self.app.WORKSPACES_FILE,self.app.read_workspaces()+[{'id':'another-workspace','ownerId':'alice','name':'Other workspace'}])
        self.app.save_agent_session({'id':'foreign-workspace','userId':'alice','workspaceId':'another-workspace','messages':[]})
        self.assertEqual(self.request('POST','/api/agent/chat',{'message':'hello','sessionId':'foreign-workspace'})[0],404)

    def test_share_cannot_publish_foreign_private_asset(self):
        self.app.save_agent_session({'id':'s','userId':'alice','messages':[{'role':'user','content':'hello'}]})
        self.app.write_file(self.app.ASSETS_FILE,[{'id':'private','ownerId':'bob','shared':False}])
        self.assertEqual(self.request('POST','/api/agent/share',{'sessionId':'s','canvas':{'nodes':[{'mediaKind':'image','mediaAsset':'private'}]}})[0],404)

    def test_old_forged_share_cannot_read_private_asset(self):
        self.app.write_file(self.app.ASSETS_FILE,[{'id':'private','ownerId':'bob','shared':False,'data':'data:image/png;base64,private'}])
        self.app.write_file(self.app.AGENT_SHARES_FILE,[{'shareId':'s','userId':'alice','payload':{'canvas':{'nodes':[{'mediaAsset':'private'}]}}}])
        self.assertEqual(self.request('GET','/api/share/s/asset/private',user=None)[0],404)

    def test_busy_session_does_not_start_second_model_request(self):
        self.app.AGENT_ACTIVE_SESSIONS.add((self.app.LOCAL_ID,'s'))
        try:self.assertEqual(self.request('POST','/api/agent/chat',{'sessionId':'s','message':'hello'})[0],409)
        finally:self.app.AGENT_ACTIVE_SESSIONS.clear()

    def test_no_global_history_eviction(self):
        self.app.write_file(self.app.AGENT_SESSIONS_FILE,[{'id':str(i),'userId':'bob','messages':[]} for i in range(205)])
        self.app.save_agent_session({'id':'new','userId':'alice','messages':[]})
        self.assertEqual(len(self.app.read_agent_sessions()),206)

    def test_submission_errors_are_not_retried_on_other_paths(self):
        for status in (0,400,401,403,404,429,500,503):
            with patch.object(self.app,'http_json_request',return_value=(status,{},'failed')) as send:
                self.app.request_json_candidates(['http://mock.invalid/a','http://mock.invalid/b'],{})
                send.assert_called_once()
        for failure in (URLError('timeout'), HTTPError('http://mock.invalid/a',500,'failed',{},io.BytesIO(b'{}')),
                        HTTPError('http://mock.invalid/a',404,'failed',{},io.BytesIO(b'{"error":{"type":"invalid_request_error","message":"model not found"}}'))):
            with patch.object(self.app,'open_http_url',side_effect=failure) as send:
                self.app.agent_open_stream({'baseUrl':'http://mock.invalid','apiKey':'fake','model':'fake'},[],[],1)
                send.assert_called_once()

    def test_route_miss_can_fall_back(self):
        with patch.object(self.app,'http_json_request',side_effect=[(404,{},'Invalid URL'),(200,{'ok':True},None)]) as send:
            self.assertEqual(self.app.request_json_candidates(['http://mock.invalid/a','http://mock.invalid/b'],{})[0],{'ok':True})
            self.assertEqual(send.call_count,2)

    def test_mock_upstream_stream_usage_and_tool_round_trip(self):
        hits=[]
        class Upstream(BaseHTTPRequestHandler):
            def log_message(self,*_):pass
            def do_POST(self):
                body=json.loads(self.rfile.read(int(self.headers['Content-Length']))); hits.append(body)
                if len(hits)==1:
                    delta={'tool_calls':[{'index':0,'id':'create','type':'function','function':{'name':'create_node','arguments':'{"type":"prompt","title":"Mock forest"}'}}]}
                else:delta={'content':'Mock scene prepared'}
                chunks=[{'choices':[{'delta':delta}]},{'choices':[],'usage':{'prompt_tokens':10,'completion_tokens':5,'total_tokens':15}}]
                raw=(''.join('data: '+json.dumps(c)+'\n\n' for c in chunks)+'data: [DONE]\n\n').encode()
                self.send_response(200);self.send_header('Content-Type','text/event-stream');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
        upstream=ThreadingHTTPServer(('127.0.0.1',0),Upstream); thread=threading.Thread(target=upstream.serve_forever,daemon=True);thread.start()
        try:
            entry={'id':'mock','name':'Mock only','type':'i2t','model':'mock','enabled':True,'apiKey':'fake-key-only',
                   'baseUrl':f'http://127.0.0.1:{upstream.server_port}','billing':'per-call','pricing':{'perCall':2}}
            self.app.write_ai_models([entry])
            status,raw,_=self.request('POST','/api/agent/chat',{'message':'Build mock scene','canvas':{'projectId':'p'},'modelId':'mock','genMode':'auto'})
            self.assertEqual(status,200)
            events=[json.loads(line[6:]) for line in raw.decode().splitlines() if line.startswith('data: ')]
            self.assertTrue(any(e.get('effects') for e in events));self.assertEqual(events[-1]['type'],'done')
            self.assertEqual(len(hits),2)
            self.assertTrue(any(m.get('role')=='tool' for m in hits[1]['messages']))
            with self.app.auth_db() as db:
                self.assertEqual(db.execute('SELECT count(*) FROM generation_settlements').fetchone()[0],0)
                self.assertEqual(self.app.user_credit_balance(db,'alice'),1000)
        finally:upstream.shutdown();upstream.server_close();thread.join()

    def test_paid_tool_failure_refunds_and_success_settles_once(self):
        entry={'id':'fake','name':'Mock','billing':'per-call','pricing':{'perCall':2}}
        for failed in (True,False):
            result=self.app.agent_billed_call({'id':'alice'},entry,'prompt',lambda _: (None,'mock failure') if failed else ('mock result',None))
            self.assertEqual(bool(result[1]),failed)
        with self.app.auth_db() as db:
            self.assertEqual(db.execute('SELECT count(*) FROM generation_settlements').fetchone()[0],0)

    def test_responses_protocol_preserves_system_tools_results_and_usage(self):
        entry={'baseUrl':'http://mock.invalid','apiKey':'fake','model':'mock','textProtocol':'responses'}
        messages=[{'role':'system','content':'Never change mode'}, {'role':'user','content':'scene'},
                  {'role':'assistant','content':None,'tool_calls':[{'id':'c','function':{'name':'read_canvas','arguments':'{}'}}]},
                  {'role':'tool','tool_call_id':'c','content':'{"ok":true}'}]
        trace={};response={'output':[{'type':'function_call','call_id':'next','name':'create_node','arguments':'{"type":"prompt"}'},
                                   {'type':'message','content':[{'type':'output_text','text':'Building'}]}],'usage':{'input_tokens':3,'output_tokens':4}}
        with patch.object(self.app,'request_json_candidates',return_value=(response,'mock',None)) as send:
            events=list(self.app.agent_chat_stream(entry,messages,agent.TOOL_SCHEMAS,trace))
        body=send.call_args.args[1]
        self.assertEqual(body['instructions'],'Never change mode');self.assertFalse(body['store'])
        self.assertEqual(body['input'][-1]['type'],'function_call_output')
        self.assertEqual(body['tools'][0]['type'],'function')
        self.assertEqual(events[-1][1][0]['id'],'next');self.assertEqual(trace['usage']['output_tokens'],4)

    def test_manual_confirmation_round_trip_uses_stored_arguments(self):
        entry={'id':'mock-manual','name':'Mock','type':'i2t','model':'mock','enabled':True,'apiKey':'fake','baseUrl':'http://mock.invalid',
               'billing':'per-call','pricing':{'perCall':2}}
        image_entry=dict(entry,id='mock-image',type='t2i')
        self.app.write_ai_models([entry,image_entry])
        def planned(*args,**kwargs):
            yield ('tool_calls',[{'id':'paid','name':'generate_image','arguments':'{"prompt":"original forest"}'}])
        with patch.object(self.app,'agent_chat_stream',side_effect=planned),patch.object(self.app,'call_image_generation') as image:
            status,raw,_=self.request('POST','/api/agent/chat',{'message':'forest','modelId':'mock-manual','imageModelId':'mock-image','genMode':'manual'})
            self.assertEqual(status,200);image.assert_not_called()
        events=[json.loads(line[6:]) for line in raw.decode().splitlines() if line.startswith('data: ')]
        ask=next(e for e in events if e['type']=='ask');self.assertEqual(ask['options'][0]['label'],'确认生成')
        session_id=events[-1]['sessionId'];session=self.app.find_agent_session(session_id,self.app.LOCAL_ID)
        self.assertEqual(session['pendingAsk']['generationApproval']['args']['prompt'],'original forest')
        with patch.object(self.app,'call_image_generation',return_value=('fixture',None)) as image:
            with patch.object(self.app,'agent_chat_stream',return_value=iter([('text','done')])):
                status,_,_=self.request('POST','/api/agent/chat',{'sessionId':session_id,'modelId':'mock-manual', 'genMode':'manual',
                    'resume':{'toolCallId':'paid','content':'确认生成','generationApproval':{'name':'generate_image','args':{'prompt':'tampered'}}}})
            self.assertEqual(status,200)
            image.assert_called_once();self.assertEqual(image.call_args.args[1],'original forest')
        self.assertIsNone(self.app.find_agent_session(session_id,self.app.LOCAL_ID)['pendingAsk'])

    def test_stream_disconnect_settles_once(self):
        entry={'id':'fake','name':'Mock','billing':'per-call','pricing':{'perCall':2}}
        with patch.object(self.app,'agent_chat_stream',return_value=iter([('text','started'),('text','rest')])):
            stream=self.app.agent_billed_chat({'id':'alice'},entry,[],[])
            self.assertEqual(next(stream),('text','started'));stream.close();stream.close()
        with self.app.auth_db() as db:self.assertEqual(db.execute('SELECT count(*) FROM generation_settlements').fetchone()[0],0)

    def test_anthropic_tools_results_and_usage(self):
        entry={'baseUrl':'http://mock.invalid/v1','apiKey':'fake','model':'mock','protocol':'anthropic'}
        messages=[{'role':'system','content':'Rules'},{'role':'user','content':'scene'}]
        response={'role':'assistant','content':[{'type':'tool_use','id':'c','name':'read_canvas','input':{}}], 'usage':{'input_tokens':3,'output_tokens':2}}
        trace={}
        with patch.object(self.app,'request_json_candidates',return_value=(response,'mock',None)) as send:
            events=list(self.app.agent_chat_stream(entry,messages,agent.TOOL_SCHEMAS,trace))
        self.assertEqual(send.call_args.args[1]['system'],'Rules')
        self.assertEqual(send.call_args.args[0],['http://mock.invalid/v1/messages'])
        self.assertEqual(events[-1][1][0]['name'],'read_canvas');self.assertEqual(trace['usage']['output_tokens'],2)

    def test_previs_asset_cannot_reference_foreign_private_file(self):
        media=self.app.save_media_blob(b'fixture','image/png',owner_id='bob')
        self.assertEqual(self.request('POST','/api/previs/assets',{'name':'Forbidden cover','thumbnail':media['url'],'object':{'kind':'geometry','geometryType':'box'}})[0],201)

    def test_legacy_share_cannot_sign_foreign_private_file(self):
        media=self.app.save_media_blob(b'fixture','image/png',owner_id='bob')
        self.app.write_file(self.app.AGENT_SHARES_FILE,[{'shareId':'bad','userId':'alice','payload':{'canvas':{'nodes':[{'mediaUrl':media['url']}]}}}])
        self.assertEqual(self.request('GET','/api/share/bad',user=None)[0],404)
        self.app.write_file(self.app.AGENT_SHARES_FILE,[{'shareId':'good','userId':'bob','payload':{'canvas':{'nodes':[{'mediaUrl':media['url']}]}}}])
        status,body,_=self.request('GET','/api/share/good',user=None)
        self.assertEqual(status,404)


if __name__=='__main__':unittest.main()
