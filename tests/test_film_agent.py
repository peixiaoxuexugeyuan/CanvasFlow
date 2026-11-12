"""CanvasFlow Agent/film contracts; fake model, isolated accounts, no paid API."""
import json
import unittest
from unittest.mock import Mock, patch
import agent_runtime as agent
from film_agent import FILM_TOOL_NAMES, film_tools
import test_security_audit as fixture


class FilmAgentToolsTests(unittest.TestCase):
    def test_media_generation_waits_for_approval_and_script_mode_cannot_call_it(self):
        callback=Mock()
        def chat(messages,tools):
            yield 'tool_calls',[{'id':'gen','name':'generate_film_media','arguments':'{"verb":"image","model":"fixture"}'}]
        events=list(agent.run_agent_loop(messages=[],chat=chat,ctx={'film_call':callback,'genMode':'manual'},max_steps=1))
        callback.assert_not_called()
        self.assertTrue(any(e.get('type')=='ask' for e in events),str(events))
        with self.assertRaises(agent.ToolError):
            agent.execute_tool('generate_film_media',{'verb':'image','model':'fixture'},{'film_call':callback,'mode':'script'})
        callback.assert_not_called()

    def test_generic_author_cannot_bypass_generation_or_launch_an_external_agent(self):
        callback=Mock()
        for action in ['generate','translate','transcribe','agent_start','agent_answer']:
            with self.assertRaises(agent.ToolError):agent.execute_tool('film_author',{'action':action},{'film_call':callback})
        callback.assert_not_called()

    def test_visual_frames_reach_model_after_all_tool_results_without_entering_tool_events(self):
        phase=0
        def chat(messages,tools):
            nonlocal phase
            if phase==0:
                phase+=1
                yield 'tool_calls',[{'id':'look','name':'look_film','arguments':'{}'},{'id':'read','name':'read_film','arguments':'{}'}]
            else:
                self.assertEqual([m['role'] for m in messages[-3:]],['tool','tool','user'])
                self.assertEqual(messages[-1]['content'][1]['type'],'image_url')
                yield 'text','已检查测试帧'
        def callback(name,args):
            return {'ok':True,'pictures':[{'name':'frame.png'}],'_images':['data:image/png;base64,YWJj']} if name=='look_film' else {'ok':True}
        events=list(agent.run_agent_loop(messages=[],chat=chat,ctx={'film_call':callback}))
        self.assertNotIn('data:image/png',json.dumps([e for e in events if e.get('type')!='checkpoint']))

    def test_film_tools_are_scoped_to_an_open_workbench(self):
        normal = agent.TOOL_SCHEMAS
        self.assertIs(film_tools({}, normal), normal)
        names = {s['function']['name'] for s in film_tools({'film_call':Mock()}, normal)}
        self.assertTrue(FILM_TOOL_NAMES <= names)
        with self.assertRaises(agent.ToolError): agent.execute_tool('edit_film', {}, {})

    def test_tool_failure_remains_a_failure(self):
        with self.assertRaisesRegex(agent.ToolError, 'changed'):
            agent.execute_tool('edit_film', {}, {'film_call':Mock(side_effect=ValueError('changed'))})

    def test_model_loop_calls_film_tool_and_returns_result_without_canvas_mutations(self):
        calls = []
        def fake_chat(messages, tools):
            self.assertIn('read_film', [s['function']['name'] for s in tools])
            if not any(m['role']=='tool' for m in messages):
                yield 'tool_calls', [{'id':'read1','name':'read_film','arguments':'{}'}]
            else:
                self.assertEqual(json.loads(messages[-1]['content'])['revision'], 'rev1')
                yield 'text', '读取完成'
        def callback(name, args):
            calls.append(name)
            return {'ok':True,'revision':'rev1','clips':[]}
        events = list(agent.run_agent_loop(messages=[],chat=fake_chat,ctx={'film_call':callback}))
        self.assertEqual(calls,['read_film'])
        self.assertFalse(any(e.get('effects') for e in events))


class FilmAgentScopeTests(unittest.TestCase):
    project = fixture.SecurityAuditTests.project
    @classmethod
    def setUpClass(cls): fixture.SecurityAuditTests.setUpClass.__func__(cls)
    @classmethod
    def tearDownClass(cls):
        cls.app.FILM_WORKBENCH.close()
        fixture.SecurityAuditTests.tearDownClass.__func__(cls)
    def setUp(self):
        fixture.SecurityAuditTests.setUp(self)
        self.workspace = self.app.default_workspace_id('alice')
        self.valid = {self.workspace}
        # Test the binding's ownership boundary directly, before single-device storage migration.
        self.rows = [self.project('p','alice'),self.project('q','bob')]
        reader = patch.object(self.app,'read_projects',side_effect=lambda:self.rows)
        reader.start(); self.addCleanup(reader.stop)
    def bind(self, project='p'):
        ctx={}
        self.app.bind_film_agent(ctx,{'id':'alice'},self.workspace,self.valid,{'projectId':project})
        return ctx['film_call']
    def test_foreign_missing_and_revoked_projects_are_rejected(self):
        with patch.object(self.app.FILM_WORKBENCH,'call') as worker:
            for name in ['q','missing']:
                with self.assertRaises(ValueError): self.bind(name)
            callback=self.bind()
            self.rows.clear()
            with self.assertRaises(ValueError): callback('read_film',{})
            worker.assert_not_called()
    def test_workspace_target_and_arguments_reach_the_same_worker(self):
        with patch.object(self.app.FILM_WORKBENCH,'call',return_value={'ok':True}) as worker:
            self.bind('p')('edit_film',{'revision':'r','operations':[]})
            self.assertEqual(worker.call_args.args,(self.workspace,'edit'))
            self.assertEqual(worker.call_args.kwargs['projectKey'],'p')
            self.assertEqual(worker.call_args.kwargs['args']['revision'],'r')
    def test_import_never_exposes_editor_session_key_to_model(self):
        with patch.object(self.app,'import_film_workspace_materials',return_value={'url':'http://local/open?key=private','imported':1}):
            self.assertEqual(self.bind()('import_film_materials',{'materialIds':['x']}),{'ok':True,'imported':1})

    def test_agent_lists_only_materials_of_its_linked_canvas(self):
        rows=[{'id':'own','name':'mine','kind':'image','url':'/media/own.png','projects':[{'id':'p'}]},
              {'id':'foreign','name':'other','kind':'image','url':'/media/other.png','projects':[{'id':'q'}]}]
        with patch.object(self.app,'build_catalog',return_value=rows):
            result=self.bind()('list_film_materials',{})
        self.assertEqual(result['total'],1)
        self.assertEqual(result['materials'][0]['id'],'own')


if __name__ == '__main__': unittest.main()
