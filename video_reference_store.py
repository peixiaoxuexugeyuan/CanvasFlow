"""Temporary, read-only video references on a configured private S3-compatible bucket."""
import hashlib
import hmac
import http.client
import mimetypes
import os
from datetime import datetime, timezone
from urllib.parse import quote, urlencode, urlsplit


def sign_url(method, endpoint, key, region, access, secret, *, ttl, at, token=''):
    base = urlsplit(endpoint)
    if (base.scheme != 'https' or not base.hostname or base.username or base.password
            or base.query or base.fragment):
        raise ValueError('视频中转存储需要 HTTPS 存储桶地址')
    path = quote(base.path.rstrip('/') + '/' + key, safe='/-_.~')
    stamp = at.strftime('%Y%m%dT%H%M%SZ')
    day = stamp[:8]
    scope = f'{day}/{region}/s3/aws4_request'
    args = {
        'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
        'X-Amz-Credential': f'{access}/{scope}',
        'X-Amz-Date': stamp,
        'X-Amz-Expires': str(ttl),
        'X-Amz-SignedHeaders': 'host',
    }
    if token:
        args['X-Amz-Security-Token'] = token
    query = urlencode(sorted(args.items()), quote_via=quote, safe='~')
    canonical = f'{method}\n{path}\n{query}\nhost:{base.netloc}\n\nhost\nUNSIGNED-PAYLOAD'
    digest = hashlib.sha256(canonical.encode()).hexdigest()
    signing = ('AWS4' + secret).encode()
    for part in (day, region, 's3', 'aws4_request'):
        signing = hmac.digest(signing, part.encode(), 'sha256')
    signature = hmac.new(signing, f'AWS4-HMAC-SHA256\n{stamp}\n{scope}\n{digest}'.encode(), 'sha256').hexdigest()
    return f'https://{base.netloc}{path}?{query}&X-Amz-Signature={signature}'


def configured():
    return all(os.environ.get('CF_VIDEO_STORE_' + key, '').strip()
               for key in ('BUCKET_URL', 'REGION', 'ACCESS_KEY', 'SECRET_KEY'))


def can_use_original(model_id):
    return bool(model_id and model_id in os.environ.get('CF_VIDEO_HEVC_MODEL_IDS', '').split())


def publish(file, owner):
    settings = [os.environ.get('CF_VIDEO_STORE_' + key, '').strip()
                for key in ('BUCKET_URL', 'REGION', 'ACCESS_KEY', 'SECRET_KEY')]
    if not all(settings):
        raise ValueError('这个供应商需要 HTTPS 参考视频。请配置私有视频中转存储，或使用支持直接上传的供应商。')
    endpoint, region, access, secret = settings
    object_id = hashlib.sha256((owner + '/' + file.name).encode()).hexdigest()
    key = 'canvasflow-video/' + object_id + file.suffix.lower()
    def signed(method, ttl):
        return sign_url(method, endpoint, key, region, access, secret, ttl=ttl,
                        at=datetime.now(timezone.utc), token=os.environ.get('CF_VIDEO_STORE_SESSION_TOKEN', ''))
    target = urlsplit(signed('PUT', 900))
    conn = http.client.HTTPSConnection(target.hostname, target.port or 443, timeout=120)
    try:
        with file.open('rb') as stream:
            conn.request('PUT', target.path + '?' + target.query, body=stream, headers={
                'Content-Length': str(file.stat().st_size),
                'Content-Type': mimetypes.guess_type(file.name)[0] or 'application/octet-stream',
            })
        response = conn.getresponse()
        if not 200 <= response.status < 300:
            raise ValueError(f'上传至视频中转存储失败（HTTP {response.status}），请检查存储权限与地域。')
    except (OSError, http.client.HTTPException) as error:
        raise ValueError('无法连接视频中转存储，请检查地址和网络。') from error
    finally:
        conn.close()
    return signed('GET', 86400)
