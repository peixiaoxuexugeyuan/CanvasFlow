"""Real OpenFilm edits from a scripted Agent model; no external model requests."""
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
import agent_runtime as agent
from film_workbench import FilmWorkbench, FilmUnavailable


@unittest.skipUnless(os.environ.get('CANVASFLOW_TEST_FILM_RUNTIME')=='1','requires prepared OpenFilm runtime')
class FilmAgentIntegrationTests(unittest.TestCase):
    def test_real_timeline_edit_loop_conflicts_atomicity_and_undo(self):
        root=Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory(prefix='cf-film-agent-') as directory:
            manager=FilmWorkbench(root,directory)
            def call(op,**args):
                return manager.call('fixture-workspace',op,projectKey='agent-film',args=args)
            try:
                source=Path(directory)/'test.mp4'
                ffmpeg=next((root/'.runtime/openfilm-ffmpeg').glob('*/bin/ffmpeg.exe'))
                subprocess.run([str(ffmpeg),'-v','error','-f','lavfi','-i','testsrc2=size=160x90:rate=10','-t','3','-pix_fmt','yuv420p',str(source)],check=True,capture_output=True,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
                manager.call('fixture-workspace','import',projectKey='agent-film',files=[{'path':str(source),'name':'test.mp4'}])
                initial=call('inspect')
                self.assertEqual(initial['totalClips'],0)
                self.assertAlmostEqual(initial['assets'][0]['duration'],3,places=1)
                phases=[]
                def scripted_model(messages, tools):
                    step=len([m for m in messages if m['role']=='tool'])
                    phases.append(step)
                    if step in (0,2): name,args='read_film',{}
                    elif step==1:
                        read=json.loads(messages[-1]['content'])
                        name,args='edit_film',{'revision':read['revision'],'operations':[
                            {'action':'insert','source':read['assets'][0]['source'],'start':0,'end':2,'at':0},
                            {'action':'stage','width':640,'height':360}]}
                    else:
                        verified=json.loads(messages[-1]['content'])
                        self.assertEqual(verified['totalClips'],1)
                        yield 'text','测试剪辑完成'; return
                    yield 'tool_calls',[{'id':f'step{step}','name':name,'arguments':json.dumps(args)}]
                callback=lambda name,args: call({'read_film':'inspect','edit_film':'edit','undo_film_edit':'undo'}[name],**args)
                list(agent.run_agent_loop(messages=[],chat=scripted_model,ctx={'film_call':callback}))
                self.assertEqual(phases,[0,1,2,3])
                inserted=call('inspect'); clip=inserted['clips'][0]['id']
                self.assertEqual(inserted['stage'],{'w':640,'h':360})
                with self.assertRaises(FilmUnavailable):
                    call('edit',revision=initial['revision'],operations=[{'action':'remove','clipId':clip}])
                # A failed second operation must not partially apply the first.
                with self.assertRaises(FilmUnavailable):
                    call('edit',revision=inserted['revision'],operations=[{'action':'volume','clipId':clip,'value':.1},{'action':'trim','clipId':clip,'start':0,'end':99}])
                self.assertEqual(call('inspect')['revision'],inserted['revision'])
                for path in ('assets/../../test.mp4','C:/secret.mp4','https://host/secret.mp4'):
                    with self.assertRaises(FilmUnavailable): call('edit',revision=inserted['revision'],operations=[{'action':'insert','source':path}])
                changed=call('edit',revision=inserted['revision'],operations=[
                    {'action':'trim','clipId':clip,'start':.2,'end':1.8},
                    {'action':'move','clipId':clip,'at':1},
                    {'action':'volume','clipId':clip,'value':.5},
                    {'action':'speed','clipId':clip,'value':2},
                    {'action':'fade','clipId':clip,'fadeIn':.1,'fadeOut':.1},
                    {'action':'split','clipId':clip,'at':1.4}])
                split=call('inspect'); self.assertEqual(split['totalClips'],2)
                self.assertEqual(split['clips'][0]['volume'],.5)
                self.assertEqual(split['clips'][0]['speed'],2)
                self.assertAlmostEqual(split['clips'][1]['at'],1.4)
                with self.assertRaises(FilmUnavailable): call('undo',revision=inserted['revision'])
                call('undo',revision=changed['revision'])
                restored=call('inspect'); self.assertEqual(restored['clips'],inserted['clips'])
                call('undo',revision=restored['revision'])
                self.assertEqual(call('inspect')['totalClips'],0)
                manager.close()
                self.assertEqual(call('inspect')['totalClips'],0)
            finally: manager.close()


if __name__=='__main__': unittest.main()
