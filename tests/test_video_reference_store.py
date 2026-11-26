import os
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch
from urllib.parse import parse_qs, urlsplit

import video_reference_store as store


class PrivateVideoTransfer(unittest.TestCase):
    def test_aws_sigv4_published_get_object_example(self):
        url = store.sign_url(
            'GET', 'https://examplebucket.s3.amazonaws.com', 'test.txt', 'us-east-1',
            'AKIAIOSFODNN7EXAMPLE', 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
            ttl=86400, at=datetime(2013, 5, 24, tzinfo=timezone.utc))
        self.assertEqual(parse_qs(urlsplit(url).query)['X-Amz-Signature'],
                         ['aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404'])

    def test_stream_upload_and_separate_temporary_read_url(self):
        settings = dict(CF_VIDEO_STORE_BUCKET_URL='https://objects.example/bucket',
                        CF_VIDEO_STORE_REGION='test', CF_VIDEO_STORE_ACCESS_KEY='example',
                        CF_VIDEO_STORE_SECRET_KEY='example-key', CF_VIDEO_STORE_SESSION_TOKEN='a+b')
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, settings), \
                patch.object(store.http.client, 'HTTPSConnection') as connection:
            path = Path(folder, 'private-scene.mp4')
            path.write_bytes(b'video data')
            conn = connection.return_value
            conn.getresponse.return_value.status = 200
            received = []
            conn.request.side_effect = lambda method, target, body, headers: received.append(
                (method, urlsplit(target), body.read(), headers))
            download = urlsplit(store.publish(path, 'me'))
            method, target, contents, headers = received[0]
            self.assertEqual((method, target.path, contents), ('PUT', download.path, b'video data'))
            self.assertNotIn(path.stem, download.path)
            self.assertEqual(headers['Content-Type'], 'video/mp4')
            self.assertEqual(parse_qs(download.query)['X-Amz-Expires'], ['86400'])
            self.assertNotEqual(parse_qs(target.query)['X-Amz-Signature'], parse_qs(download.query)['X-Amz-Signature'])
            self.assertEqual(parse_qs(target.query)['X-Amz-Security-Token'], ['a+b'])
            conn.getresponse.return_value.status = 403
            with self.assertRaisesRegex(ValueError, '403'):
                store.publish(path, 'me')
