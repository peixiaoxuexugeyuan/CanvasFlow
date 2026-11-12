"""Provider routing uses only fake callbacks: no paid calls or real keys."""
import base64
import unittest
from unittest.mock import Mock
from types import SimpleNamespace
from film_services import service_handler


class FilmServiceTests(unittest.TestCase):
    def setUp(self):
        self.entries=[dict(id=id,model=model,enabled=True,usages=[usage],baseUrl='https://invalid.example',apiKey='fixture') for id,model,usage in [
            ('img','image','image'),('vid','video','video'),('tts','speech','audio'),('music','suno-4.5','audio'),('asr','whisper','audio'),('text1','text','text'),('text2','text2','text')]]
        self.host={'visible_ai_models':lambda uid:self.entries,'provider_has_credentials':lambda entry:True,
            'model_has_usage':lambda entry,kind:kind in entry['usages'],'FILM_WORKBENCH':SimpleNamespace(),
            'agent_billed_call':Mock(side_effect=lambda u,e,p,fn,**kw:fn({})),
            'call_chat_completion':Mock(return_value=('translated',None)),
            'call_image_generation':Mock(return_value=('data:image/png;base64,YWJj',None)),
            'create_video_job':Mock(return_value=({'id':'job'},None)),
            'create_audio_job':Mock(return_value=({'id':'job'},None)),
            'latest_jobs':lambda *a,**kw:[{'id':'job'}],
            'job_view':lambda j:{'status':'completed','videoUrl':'data:video/mp4;base64,YWJj'},
            'endpoint_candidates':lambda base,path:[base+'/'+path], 'auth_headers':lambda e,key,headers:headers,
            'http_body_request':Mock(return_value=(200,{'text':'hello','words':[{'word':'hello','start':0,'end':1}]},None))}
        self.service=service_handler(self.host,{'id':'fixture'},'workspace','text2')
    def test_catalog_separates_audio_kinds_and_has_no_credentials(self):
        catalog=self.service('models',{})['models']
        self.assertEqual([m['id'] for m in catalog['music']],['music'])
        self.assertEqual([m['id'] for m in catalog['tts']],['tts'])
        self.assertEqual([m['id'] for m in catalog['asr']],['asr'])
        self.assertNotIn('apiKey',str(catalog))
    def test_selected_chat_model_survives_http_rebinding(self):
        service_handler(self.host,{'id':'fixture'},'workspace')('ask',{'text':'Translate'})
        self.assertEqual(self.host['call_chat_completion'].call_args.args[0]['id'],'text2')
    def test_incorrect_model_kind_never_calls_a_provider(self):
        with self.assertRaises(ValueError): self.service('generate',{'verb':'video','model':'tts','args':{}})
        self.host['create_video_job'].assert_not_called()
    def test_first_last_frames_resolution_ratio_and_duration_are_forwarded(self):
        self.service('generate',{'verb':'video','model':'vid','args':{'prompt':'test','duration':4,'resolution':'480p','aspect-ratio':'9:16','first-frame':'a.png','last-frame':'b.png'},
            'files':[{'path':'a.png','role':'first-frame','base64':'YWJj'},{'path':'b.png','role':'last-frame','base64':'ZGVm'}]})
        incoming=self.host['create_video_job'].call_args.args[1]
        self.assertEqual(incoming['generationSettings'],{'modelId':'vid','duration':4,'resolution':'480p','aspectRatio':'9:16','referenceMode':'frames2video','videoMode':'图生视频'})
        self.assertEqual(len(incoming['referenceImages']),2)
        self.host['create_video_job'].assert_called_once()
    def test_unsupported_inputs_fail_before_spending(self):
        for verb,model,args in [('video','vid',{'video':'source.mp4'}),('image','img',{'transparent':True})]:
            with self.assertRaises(ValueError):self.service('generate',{'verb':verb,'model':model,'args':args})
        self.host['create_video_job'].assert_not_called();self.host['call_image_generation'].assert_not_called()
    def test_music_duration_and_mode_are_preserved(self):
        self.service('generate',{'verb':'music','model':'music','args':{'prompt':'piano','sec':8}})
        args=self.host['create_audio_job'].call_args.args[1]
        self.assertEqual(args['mode'],'generation');self.assertEqual(args['spec']['duration'],8)
    def test_transcription_preserves_actual_upload_format_and_word_times(self):
        result=self.service('generate',{'verb':'asr','model':'asr','args':{'src':'sound.wav'},'files':[{'path':'sound.wav','name':'sound.wav','mime':'audio/wav','base64':base64.b64encode(b'RIFFfixture').decode()}]})
        body=self.host['http_body_request'].call_args.args[1]
        self.assertIn(b'filename="sound.wav"',body);self.assertIn(b'Content-Type: audio/wav',body)
        self.assertEqual(result['index'][0]['words'][0]['end'],1)


    def test_voice_directory_uses_selected_model_and_keeps_demo_metadata(self):
        voices=[{'id':'voice-1','name':'声音','gender':'女','language':'中文','demo':'https://demo.invalid/v.mp3'}]
        self.host['fetch_model_voices']=Mock(return_value=(voices,''));self.host['voice_filter_options']=lambda v:{'genders':['女'],'languages':['中文']}
        response=self.service('voices',{'model':'tts'})
        self.assertEqual(response['voices'],voices);self.assertEqual(response['filters']['genders'],['女'])
        self.assertEqual(self.host['fetch_model_voices'].call_args.args[0]['id'],'tts')
        with self.assertRaises(ValueError):self.service('voices',{'model':'vid'})
        self.host['create_audio_job'].assert_not_called()
