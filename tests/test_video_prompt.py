import base64
from io import BytesIO
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import Mock, patch

import video_prompt as prompt


class Response(BytesIO):
    def __init__(self, data, headers=None):
        super().__init__(json.dumps(data).encode())
        self.headers = headers or {}


class VideoPromptTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.clip = Path(self.directory.name) / 'clip.mp4'
        self.clip.write_bytes(b'offline transport fixture')
        self.entry = {'baseUrl':'https://generativelanguage.googleapis.com/v1beta/openai',
                      'model':'gemini-2.5-flash', 'apiKey':'test-only'}
        self.text = {'candidates':[{'content':{'parts':[{'thought':True, 'text':'hidden'}, {'text':'镜头向前推进'}]}}]}

    def test_automatic_capability_requires_first_party_endpoint(self):
        self.assertEqual(prompt.video_transport(self.entry), 'gemini-native')
        self.assertFalse(prompt.video_transport({**self.entry, 'baseUrl':'https://example.invalid'}))
        self.assertFalse(prompt.video_transport({**self.entry, 'model':'gemini-flash-image'}))
        self.assertFalse(prompt.video_transport({**self.entry, 'modelParams':{'text':{'videoInput':'disabled'}}}))

    def test_inline_uses_actual_video_and_its_mime(self):
        opener = Mock(return_value=Response(self.text))
        text, _ = prompt.generate(self.clip, self.entry, opener, {}, 15)
        self.assertEqual(text, '镜头向前推进')
        req = opener.call_args.args[0]
        self.assertTrue(req.full_url.endswith('/v1beta/models/gemini-2.5-flash:generateContent'))
        self.assertIn('X-goog-api-key', req.headers)
        parts = json.loads(req.data)['contents'][0]['parts']
        self.assertEqual(base64.b64decode(parts[0]['inlineData']['data']), self.clip.read_bytes())
        self.assertEqual(parts[0]['inlineData']['mimeType'], 'video/mp4')
        self.assertIn('提示词', parts[1]['text'])

    def test_files_processing_and_cleanup_on_success_and_failure(self):
        for success in (True, False):
            seen = []
            def opener(req, timeout):
                seen.append(req)
                if len(seen) == 1:
                    return Response({}, {'X-Goog-Upload-URL':'https://generativelanguage.googleapis.com/upload-session'})
                if len(seen) == 2:
                    self.assertEqual(req.data.read(), self.clip.read_bytes())
                    return Response({'file':{'name':'files/test', 'state':'PROCESSING'}})
                if len(seen) == 3:
                    return Response({'state':'ACTIVE' if success else 'FAILED','uri':'https://files.invalid/test'})
                if req.method == 'DELETE':
                    return Response({})
                part = json.loads(req.data)['contents'][0]['parts'][0]
                self.assertEqual(part['fileData']['fileUri'], 'https://files.invalid/test')
                return Response(self.text)
            with patch.object(prompt, 'INLINE_LIMIT', 1), patch.object(prompt.time, 'sleep'):
                if success:
                    prompt.generate(self.clip, self.entry, opener, {}, 15)
                else:
                    with self.assertRaises(prompt.VideoServiceError):
                        prompt.generate(self.clip, self.entry, opener, {}, 15)
            self.assertEqual(seen[-1].method, 'DELETE')

    def test_foreign_upload_url_rejected_before_sending_file(self):
        opener = Mock(return_value=Response({}, {'X-Goog-Upload-URL':'https://other.invalid/upload'}))
        with patch.object(prompt, 'INLINE_LIMIT', 1), self.assertRaisesRegex(prompt.VideoServiceError, '同源'):
            prompt.generate(self.clip, self.entry, opener, {}, 15)
        self.assertEqual(opener.call_count, 1)

    def test_chat_video_transmits_declared_format(self):
        relay = {**self.entry, 'baseUrl':'https://relay.invalid/api/v1',
                 'modelParams':{'text':{'videoInput':'chat-video'}}}
        def opener(req, timeout):
            self.assertEqual(req.full_url, 'https://relay.invalid/api/v1/chat/completions')
            data = json.load(req.data)
            video = data['messages'][0]['content'][0]
            self.assertEqual(video['type'], 'video_url')
            self.assertEqual(base64.b64decode(video['video_url']['url'].split(',')[1]), self.clip.read_bytes())
            return Response({'choices':[{'message':{'content':'中文提示词'}}]})
        self.assertEqual(prompt.generate(self.clip, relay, opener, {}, 15)[0], '中文提示词')

    def test_local_video_checked_as_user(self):
        checked = Mock(side_effect=ValueError('no access'))
        with self.assertRaisesRegex(ValueError, 'no access'):
            with prompt.source_video_file('/media/not-owned.mp4', 'user1', check_media=checked,
                                          resolve_media=None, media_opener=None, size_limit=100):
                self.fail('must not yield')
        checked.assert_called_once_with('user1','/media/not-owned.mp4')

    def test_selected_range_produces_a_real_shorter_clip(self):
        root = Path(__file__).resolve().parents[1]
        folder = next((root / '.runtime/openfilm-ffmpeg').glob('*/bin'), None)
        ffmpeg = (folder / 'ffmpeg.exe') if folder else shutil.which('ffmpeg')
        ffprobe = (folder / 'ffprobe.exe') if folder else shutil.which('ffprobe')
        if not ffmpeg or not ffprobe:
            self.skipTest('FFmpeg is unavailable')
        subprocess.run([str(ffmpeg),'-v','error','-y','-f','lavfi','-i','color=size=64x64:duration=2:rate=8',
                        '-c:v','libx264',str(self.clip)], check=True)
        with prompt.selected_video_file(self.clip, root, 0.5, 1.25) as output:
            self.assertNotEqual(output, self.clip)
            duration = subprocess.check_output([str(ffprobe),'-v','error','-show_entries','format=duration',
                '-of','default=nw=1:nk=1',str(output)], text=True)
            self.assertAlmostEqual(float(duration.strip()), .75, places=1)
        self.assertFalse(output.exists())
        with self.assertRaises(ValueError):
            with prompt.selected_video_file(self.clip, root, 1.5, 1):
                self.fail('must not send untrimmed source')

    def test_server_samples_original_timeline_from_remote_video_without_cors(self):
        root = Path(__file__).resolve().parents[1]
        try:
            ffmpeg = prompt._media_binary(root, 'ffmpeg')
            ffprobe = prompt._media_binary(root, 'ffprobe')
        except ValueError:
            self.skipTest('FFmpeg and FFprobe are unavailable')
        subprocess.run([ffmpeg, '-nostdin', '-v', 'error', '-y', '-f', 'lavfi', '-i',
                        'color=black:s=1024x256:r=2:d=1', '-f', 'lavfi', '-i', 'color=white:s=1024x256:r=2:d=1',
                        '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0', '-c:v', 'libx264', str(self.clip)], check=True)
        remote = BytesIO(self.clip.read_bytes())
        remote.headers = {'Content-Type':'video/mp4'}
        with prompt.source_video_file('https://media.invalid/example', 'local', check_media=None, resolve_media=None,
                                     media_opener=Mock(return_value=remote), size_limit=1000000) as source:
            result = prompt.extract_frames(source, root, .4, 2, 2)
        self.assertFalse(source.exists())
        for actual, target in zip(result['times'], (.8, 1.6)):
            self.assertAlmostEqual(actual, target)
        for index, frame in enumerate(result['referenceImages']):
            jpeg = base64.b64decode(frame.split(',')[1])
            info = json.loads(subprocess.check_output([ffprobe, '-v', 'error', '-show_entries',
                'stream=width,height', '-of', 'json', 'pipe:0'], input=jpeg))['streams'][0]
            self.assertEqual((info['width'], info['height']), (768, 192))
            gray_pixel = subprocess.check_output([ffmpeg, '-v', 'error', '-i', 'pipe:0', '-vf', 'scale=1:1',
                '-frames:v','1','-f','rawvideo','-pix_fmt','gray','pipe:1'], input=jpeg)[0]
            self.assertAlmostEqual(gray_pixel, 255 * index, delta=6)
        for count in (1, 16, 30):
            result = prompt.extract_frames(self.clip, root, .5, 1.5, count)
            self.assertEqual(result['times'], [.5 + (index + .5) / count for index in range(count)])
            self.assertEqual(len(result['referenceImages']), count)
        for start, end, count in ((3, 4, 2), (None, None, 0), (None, None, 31), (None, None, True),
                                  (None, None, 1.5), (float('nan'), None, 2)):
            with self.assertRaises(ValueError):
                prompt.extract_frames(self.clip, root, start, end, count)
        # Fit every timestamp even when the full-size JPEGs exceed the transport budget.
        with patch.object(prompt, 'FRAME_DATA_LIMIT', 1800):
            frames = prompt.extract_frames(self.clip, root, .4, 2, 2)
            self.assertEqual(len(frames['referenceImages']), 2)
            self.assertLessEqual(sum(map(len, frames['referenceImages'])), 1800)
            prompt.validate_frame_images(frames['referenceImages'])
        with patch.object(prompt, 'FRAME_DATA_LIMIT', 12), self.assertRaisesRegex(ValueError, '传输上限'):
            prompt.extract_frames(self.clip, root, count=2)
