import base64
import unittest
from unittest.mock import Mock
from film_media import image_request,image_capabilities,upload_video_reference,video_capabilities

def file(role='',mime='image/png'):
    return {'path':'test.png','role':role,'mime':mime,'base64':base64.b64encode(b'fixture').decode()}

class FilmMediaTests(unittest.TestCase):
    def setUp(self):
        self.entry={'model':'gpt-image-2.5','baseUrl':'https://invalid.example','apiKey':'test'}
        self.host={'resolve_image_transport':lambda e:'openai-images','media_generate_entry':lambda e:False,
          'supported_image_qualities':lambda *a:['low','standard','high','xhigh','max'],
          'IMAGE_TRANSPORTS':{'openai-images':{'body':'multipart-files','reference':'images/edits','generation':'images/generations'}},
          'image_extra_params':lambda e:{},'image_quality_value':lambda m,q,n:q,
          'auth_headers':lambda e,key,headers=None:{**(headers or {}),'Authorization':'test'},
          'endpoint_candidates':lambda base,path:[base+'/'+path],
          'build_image_reference_body':Mock(return_value=({},b'--test--\r\n','multipart/form-data; boundary=test',None)),
          'request_body_candidates':Mock(return_value=({'data':[]},'endpoint',None)),
          'request_json_candidates':Mock(return_value=({'data':[]},'endpoint',None)),
          'call_image_generation':Mock(return_value=('data:image/png;base64,YWJj',None)),
          'finish_image_result':Mock(return_value=('data:image/png;base64,YWJj',None))}
    def test_mask_multipart_keeps_model_references_format_quality_and_transparency(self):
        image_request(self.host,self.entry,'description',{'mask':'mask.png','transparent':True,'quality':'max'},[file(),file('mask')],{})
        request=self.host['build_image_reference_body'].call_args.args
        self.assertEqual(request[1:3],('gpt-image-2.5','description'));self.assertEqual(request[5],'max');self.assertEqual(request[6]['background'],'transparent')
        body=self.host['request_body_candidates'].call_args.args[1](None)
        self.assertIn(b'name="mask"',body);self.assertTrue(body.endswith(b'--test--\r\n'))
    def test_markup_uses_its_own_part_and_non_png_format(self):
        image_request(self.host,self.entry,'description',{'markup':'marked.png','format':'webp'},[file(),file('markup')],{})
        body=self.host['request_body_candidates'].call_args.args[1](None)
        self.assertIn(b'name="markup"',body);self.assertEqual(self.host['build_image_reference_body'].call_args.args[6]['output_format'],'webp')
    def test_plain_quality_is_not_silently_downgraded(self):
        image_request(self.host,self.entry,'test',{'quality':'max'},[],{})
        self.assertEqual(self.host['call_image_generation'].call_args.kwargs['quality'],'max')
    def test_invalid_combinations_do_not_submit(self):
        for args,files in [({'mask':'a'},[]),({'mask':'a','markup':'b'},[file()]),({'format':'jpeg','transparent':True},[]),({'format':'gif'},[]),({'quality':'unknown'},[])]:
            with self.assertRaises(ValueError):image_request(self.host,self.entry,'test',args,files,{})
        self.host['request_body_candidates'].assert_not_called();self.host['request_json_candidates'].assert_not_called();self.host['call_image_generation'].assert_not_called()
    def test_declared_gif_is_forwarded_without_switching_model(self):
        self.host['image_parameter_contract']=lambda e:{'params':[{'name':'output_format','options':['png','gif']}]}
        image_request(self.host,self.entry,'test',{'format':'gif','frames':4,'frame-ms':100},[],{})
        body=self.host['request_json_candidates'].call_args.args[1]
        self.assertEqual((body['model'],body['output_format'],body['frame_count'],body['frame_duration_ms']),('gpt-image-2.5','gif',4,100))
    def test_svg_rejects_active_and_external_content(self):
        self.host['image_parameter_contract']=lambda e:{'params':[{'name':'format','options':['svg']}]}
        for svg in (b'<svg><script>bad()</script></svg>',b'<svg><image href="https://outside.invalid/x"/></svg>'):
            self.host['request_json_candidates'].return_value=({'data':[{'b64_json':base64.b64encode(svg).decode()}]},'endpoint',None)
            result,error=image_request(self.host,self.entry,'test',{'format':'svg'},[],{});self.assertIsNone(result);self.assertTrue(error)
    def test_local_video_uses_configured_upload_and_never_invents_public_localhost_url(self):
        self.assertFalse(video_capabilities(self.host,self.entry)['clip'])
        with self.assertRaises(ValueError):upload_video_reference(self.host,self.entry,file('video','video/mp4'))
        self.entry['fileUploadPath']='v1/upload';self.host['request_body_candidates'].return_value=({'data':{'url':'https://cdn.invalid/clip.mp4'}},'',None)
        self.assertTrue(video_capabilities(self.host,self.entry)['clip'])
        self.assertEqual(upload_video_reference(self.host,self.entry,file('video','video/mp4')),'https://cdn.invalid/clip.mp4')
        self.assertEqual(self.host['request_body_candidates'].call_args.args[0],['https://invalid.example/v1/upload'])
        self.host['request_body_candidates'].return_value=({'id':'file-123'},'',None)
        with self.assertRaisesRegex(ValueError,'文件标识'):upload_video_reference(self.host,self.entry,file('video','video/mp4'))
    def test_upstream_error_does_not_fall_back_to_another_provider(self):
        self.host['request_json_candidates'].return_value=({},'', 'provider rejected')
        result,error=image_request(self.host,self.entry,'test',{'format':'webp'},[],{})
        self.assertIsNone(result);self.assertEqual(error,'provider rejected');self.host['call_image_generation'].assert_not_called()
