"""Video studio and canvas use the same provider payload builder. No network requests."""
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]


class StudioVideoParamsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp = tempfile.TemporaryDirectory()
        with patch.dict(os.environ, CANVASFLOW_DATA_DIR=cls.temp.name):
            spec = importlib.util.spec_from_file_location('studio_video_server', ROOT / 'server.py')
            cls.app = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(cls.app)
        cls.catalog = json.loads((ROOT / 'upstream-model-contracts.json').read_text(encoding='utf-8'))

    @classmethod
    def tearDownClass(cls):
        cls.temp.cleanup()

    def params(self, model, reference, *, options=None, images=(), videos=(), audios=()):
        fields = {field['name']: field for field in self.catalog[model]['params']}
        entry = {'id': 'newapi-lk888-test', 'model': model}
        rows = [{'key': name, 'field': name, 'default': (field.get('options') or [{}])[0].get('value')}
                for name, field in fields.items() if name != 'prompt']
        job = {'prompt': 'Test shot', 'generationSettings': {'referenceMode': reference, 'modelOptions': options or {}},
               'referenceImages': list(images), 'sourceVideos': list(videos), 'sourceAudios': list(audios)}
        with patch.object(self.app, 'spec_rows_for_entry', return_value=rows):
            return self.app.build_media_video_params(entry, job, fields)

    def test_frame_order_and_reference_array_use_the_declared_slots(self):
        photos = ['https://example.org/a.png', 'https://example.org/b.png']
        params = self.params('seedance-2.5-guanfang', 'frames2video', images=photos)
        self.assertEqual(params['mode'], 'shouweizhen')
        self.assertEqual(params['images'], photos)
        self.assertNotIn('image_url', params)
        params = self.params('seedance-2.5-guanfang', 'image2video', images=photos)
        self.assertEqual(params['mode'], 'cankaosheng')
        self.assertEqual(params['image_url'], photos)
        self.assertNotIn('images', params)
        self.assertNotIn('_quan_neng_mode', params)

    def test_wan_mixed_references_preserve_every_item_in_order(self):
        photos, videos, sounds = [[f'https://example.org/{kind}/{i}' for i in range(n)]
                                 for kind, n in [('image', 10), ('video', 5), ('audio', 5)]]
        params = self.params('wan3.0', 'mixed2video', images=photos, videos=videos, audios=sounds)
        self.assertEqual([params['image_url'], params['video_url'], params['audio_url']], [photos, videos, sounds])
        self.assertNotIn('images', params)

    def test_video_enhance_accepts_empty_prompt_with_source(self):
        app = self.app
        entry = {'id':'newapi-lk888-test', 'model':'video-enhance', 'type':'video',
                 'baseUrl':'https://example.org', 'apiKey':'test', 'enabled':True}
        submit_result = ({'providerJobId':'offline','submittedAt':app.now()}, None)
        with patch.object(app, 'visible_ai_models', return_value=[entry]), patch.object(app, 'call_video_submit', return_value=submit_result) as submit:
            job, failure = app.create_video_job(dict(app.LOCAL_CONTEXT), {'modelId':entry['id'],
                'prompt':'', 'sourceVideos':['https://example.org/input.mp4']})
            self.assertIsNone(failure, failure)
            self.assertEqual(job['prompt'], '')
            self.assertEqual(submit.call_args.args[1]['sourceVideos'], ['https://example.org/input.mp4'])

    def test_mixed_media_and_edit_subtype_reach_upstream(self):
        params = self.params('seedance-2.5-guanfang', 'videoEdit2video', options={'web_search': 'true'},
                             videos=['https://example.org/v.mp4'], audios=['https://example.org/a.mp3'])
        self.assertEqual(params['mode'], 'cankaosheng')
        self.assertEqual(params['_quan_neng_mode'], 'edit')
        self.assertEqual(params['video_url'], 'https://example.org/v.mp4')
        self.assertEqual(params['audio_url'], 'https://example.org/a.mp3')
        self.assertEqual(params['web_search'], 'true')

    def test_quality_mode_is_distinct_from_reference_mode(self):
        params = self.params('kling-avatar-image2video', 'mixed2video', options={'mode': 'pro'},
                             images=['https://example.org/i.png'], audios=['https://example.org/a.wav'])
        self.assertEqual(params['mode'], 'pro')
        self.assertEqual(params['image'], 'https://example.org/i.png')
        self.assertEqual(params['sound_file'], 'https://example.org/a.wav')

    def test_inactive_ratio_from_registry_is_not_sent_for_first_frame(self):
        params = self.params('viduq4-preview', 'singleImage2video', images=['https://example.org/open.png'])
        self.assertEqual(params['mode'], 'shouweizhen')
        self.assertNotIn('aspect_ratio', params)
        self.assertNotIn('image_url', params)

    def test_zhongheng_uploads_authorized_local_video_before_generation(self):
        media_id = 'media-' + 'a' * 32 + '.webm'
        file = self.app.MEDIA_DIR / media_id
        raw = b'\x1aE\xdf\xa3' + b'webm' + b'V_VP9' + bytes(128)
        file.write_bytes(raw)
        url = '/media/' + media_id
        entry = {'requestProfile': 'zhongheng-video', 'model': 'studio-test',
                 'providerContract': {'max_video': 1}, 'baseUrl': 'https://supplier.invalid'}
        with patch.object(self.app, 'validate_new_media') as check:
            sources = self.app.video_job_sources(entry, 'owner', [url])
            check.assert_called_once_with('owner', url)
            response = (200, {'success': True, 'data': [{'url': 'https://cdn.invalid/shot.webm'}]}, None)
            with patch.object(self.app, 'http_body_request', return_value=response) as upload:
                _, outgoing = self.app.provider_video_payload(entry, {'sourceVideos': sources})
            self.assertTrue(upload.call_args.args[0].endswith('/v1/media'))
            self.assertIn(raw, upload.call_args.args[1])
            self.assertEqual(outgoing['reference_videos'], ['https://cdn.invalid/shot.webm'])
            with self.assertRaisesRegex(ValueError, 'HTTP'):
                self.app.video_job_sources({'requestProfile': 'media-generate'}, 'owner', [url])
            file.write_bytes(b'not a video')
            with self.assertRaises(ValueError):
                self.app.video_job_sources(entry, 'owner', [url])
            with file.open('wb') as out:
                out.truncate(25 * 1024 * 1024 + 1)
            with self.assertRaisesRegex(ValueError, '25 MB'):
                self.app.video_job_sources(entry, 'owner', [url])
        with patch.object(self.app, 'validate_new_media', side_effect=self.app.StorageError('没有访问权限', 403)):
            with self.assertRaises(self.app.StorageError):
                self.app.video_job_sources(entry, 'other', [url])

