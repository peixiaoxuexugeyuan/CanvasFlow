"""Real upstream engine, synthetic footage, no model network calls."""
import os
from pathlib import Path
import subprocess
import tempfile
import time
import unittest
import base64
from film_workbench import FilmWorkbench, FilmUnavailable


@unittest.skipUnless(os.environ.get('CANVASFLOW_TEST_FILM_RUNTIME')=='1','prepared runtime required')
class AdvancedFilmIntegration(unittest.TestCase):
    def test_author_look_versions_export_and_boundaries(self):
        root=Path(os.environ.get('CANVASFLOW_FILM_TEST_ROOT') or Path(__file__).resolve().parents[1])
        with tempfile.TemporaryDirectory(prefix='cf-film-advanced-') as directory:
            manager=FilmWorkbench(root,directory)
            manager.callbacks['test']=lambda method,args: {'models':{}}
            def call(action,**args):return manager.call('test','advanced',projectKey='test',args={'action':action,**args})
            try:
                manager.call('test','open',projectKey='test')
                print('opened',flush=True)
                skills=call('skills');self.assertIn('edit',[s['name'] for s in skills['skills']])
                self.assertIn('film.html',call('skill',uid='edit')['text'])
                before=call('read',path='film.html');self.assertIsNotNone(before['revision'])
                html='<!doctype html><html><head><meta name="viewport" content="width=320, height=180"></head><body style="margin:0;background:#112244;color:white;font:32px sans-serif"><div id="title">CanvasFlow</div><script>window.film={width:320,height:180,duration:1,frame(t){document.getElementById("title").style.opacity=String(Math.min(1,.4+t));}};</script></body></html>'
                call('write',path='title.html',revision=None,text=html)
                with self.assertRaises(FilmUnavailable):call('write',path='title.html',revision=None,text='oops')
                for path in ['../outside.txt','C:/secret.txt','.film/settings.json','assets/../../outside.txt']:
                    with self.assertRaises(FilmUnavailable):call('read',path=path)
                doc=call('document');call('edit',revision=doc['revision'],ops=[{'op':'stage','w':320,'h':180},{'op':'insert','clip':{'src':'title.html','id':'title','time':[0,1]},'at':0}])
                print('authored',flush=True)
                frame=call('look',at='0.5',count=1)
                self.assertTrue(frame['pictures'],str(frame.get('checks')));self.assertGreater(len(frame['pictures'][0]['base64']),100)
                print('look passed',flush=True)
                history=call('history');self.assertTrue(history['versions'])
                board=call('canvas_read');call('canvas_write',revision=board['revision'],canvas={'nodes':[{'id':'note','text':'shot','x':0,'y':0}],'edges':[]})
                self.assertEqual(call('canvas_read')['canvas']['nodes'][0]['text'],'shot')
                sync=manager.call('test','sync',projectKey='test',nodes=[{'id':'source','text':'linked','x':100,'y':50}],edges=[],files=[])
                self.assertEqual(sync['synced'],1)
                board=call('canvas_read');node=next(n for n in board['canvas']['nodes'] if n['id'].startswith('cf-'))
                self.assertEqual(board['links'][node['id']],'source')
                node['text']='manual edit'
                call('canvas_write',revision=board['revision'],canvas=board['canvas'])
                sync=manager.call('test','sync',projectKey='test',nodes=[{'id':'source','text':'replace','x':100,'y':50}],edges=[],files=[])
                self.assertEqual(sync['conflicts'],['source'])
                self.assertEqual(len(call('canvas_read')['canvas']['nodes']),2)
                long_text='完整长文本\n'*5000
                sync=manager.call('test','sync',projectKey='test',nodes=[{'id':'long','text':long_text}],edges=[],files=[])
                self.assertEqual(sync['textFiles'],['long'])
                board=call('canvas_read');long_node=next(n for n in board['canvas']['nodes'] if board['links'].get(n['id'])=='long')
                text_file=call('read',path=long_node['path']);self.assertEqual(text_file['text'],long_text)
                call('write',path=long_node['path'],revision=text_file['revision'],text=long_text+'manual')
                sync=manager.call('test','sync',projectKey='test',nodes=[{'id':'long','text':long_text+'new'}],edges=[],files=[])
                self.assertEqual(sync['conflicts'],['long'])
                call('write',path='captions.vtt',revision=None,text='WEBVTT\n\n00:00.000 --> 00:01.000\nCanvasFlow\n')
                doc=call('document');call('edit',revision=doc['revision'],ops=[{'op':'captions','captions':{'src':'captions.vtt'}}])
                audio=Path(directory)/'tone.wav'
                ffmpeg=next((root/'.runtime/openfilm-ffmpeg').glob('*/bin/ffmpeg.exe'))
                subprocess.run([str(ffmpeg),'-v','error','-f','lavfi','-i','sine=frequency=440:duration=1',str(audio)],check=True,capture_output=True,creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
                manager.call('test','import',projectKey='test',files=[{'path':str(audio),'name':'tone.wav','sourceId':'tone'}])
                doc=call('document');call('edit',revision=doc['revision'],ops=[{'op':'insert','clip':{'src':'assets/tone.wav','id':'tone','time':[0,1]},'at':0,'newTrack':len(doc['film']['tracks'])}])
                for kind,settings in [('poster',{'format':'png','at':0}),('video',{'codec':'h264','shortEdge':180,'fps':10}),('gif',{'width':160,'fps':5}),('audio',{'format':'mp3'}),('subtitles',{'format':'srt'}),('slides',{'format':'pptx','shortEdge':180}),('nle',{'format':'xml','alpha':'png','footage':'source'}),('project',{'as':'zip'})]:
                    job=call('export',settings={'kind':kind,'name':'fixture',**settings})['export'];until=time.monotonic()+100
                    while time.monotonic()<until:
                        current=next(j for j in call('exports')['exports'] if j['id']==job['id'])
                        if current['status'] not in ('waiting','running'):break
                        time.sleep(.5)
                    self.assertEqual(current['status'],'done',str(current))
                    files=call('outputs',id=job['id'])['files'];self.assertTrue(files)
                    out=manager.call('test','output',projectKey='test',args={'token':files[0]['token']});self.assertTrue(Path(out['file']).is_file())
                    with self.assertRaises(FilmUnavailable):manager.call('test','output',projectKey='another',args={'token':files[0]['token']})
                    print(kind+' export passed',flush=True)
                # Run native provider -> duplex callback -> native media saving, without a real model.
                picture=frame['pictures'][0]['base64'];seen=[]
                def fake_service(method,args):
                    if method=='models':return {'models':{'image':[{'id':'fixture-image','name':'Fixture'}]}}
                    seen.append((method,args));return {'mime':'image/png','base64':picture}
                manager.callbacks['test']=fake_service
                generated=call('generate',verb='image',model='fixture-image',options={'out':'fixture-generated','prompt':'synthetic title'})
                self.assertEqual(seen[0][0],'generate');self.assertEqual(seen[0][1]['model'],'fixture-image')
                self.assertTrue(any('fixture-generated' in f['path'] for f in call('files')['files']))
                self.assertTrue(call('skill_catalog')['skills'])
                # Built-in transition import uses actual upstream resources, no model.
                self.assertTrue(call('library',query='light-sweep')['items'])
                taken=call('take',id='transitions/light-sweep');self.assertTrue(taken)
                self.assertIn('codex',[a['id'] for a in call('agents')['agents']])
                self.assertIn('image',call('services')['models'] if call('services')['models'] else {'image':[]})
            finally:manager.close()

if __name__=='__main__':unittest.main()
