from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import io
import json
import mimetypes
import os
import re
import secrets
import smtplib
import ssl
import sqlite3
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP, ROUND_CEILING
import math
import threading
import time
import shutil
import uuid
from contextvars import ContextVar
from concurrent.futures import ThreadPoolExecutor
from email.message import EmailMessage
from email.utils import formataddr, formatdate, make_msgid
from html import escape as html_escape
from html.parser import HTMLParser
from http.cookies import SimpleCookie
from http.client import IncompleteRead
from urllib import error as urllib_error
from urllib import request as urllib_request
from datetime import datetime, timedelta, timezone
from http.server import SimpleHTTPRequestHandler
from bounded_http import ThreadingHTTPServer
from pathlib import Path
from local_app import LOCAL_ID, LOCAL_CONTEXT, LocalStorage, local_content, local_job, retired_route, installation_id
from workspace_materials import build_catalog, summary_item, category_list, media_kind as material_media_kind
from blender_bridge import BlenderBridge, BlenderUnavailable
from film_workbench import FilmWorkbench, FilmUnavailable
from urllib.parse import parse_qs, quote, unquote, urlparse
from request_security import RequestBodyError, StorageReadError, request_allowed, public_static_path, byte_range
from release_security import PublicFiles
from network_security import open_http_url as guarded_open_http_url, http_origin, validate_provider_access, network_access, private_url, NetworkAccessError

ROOT = Path(__file__).resolve().parent
PUBLIC_FILES = PublicFiles(ROOT, os.environ.get('CANVASFLOW_PUBLIC_DIR') or '')
PUBLIC_DIR = PUBLIC_FILES.root

# 画布「登记表」（规格表）的默认值 —— 由 `_migrate_model_specs.py` 从旧的前端常量迁移而来。
# ★ 只在 `server-data/model-specs.json` 缺失时兜底：那个文件才是真源（「模型管理」面板写它）。
try:
    from model_specs_defaults import DEFAULT_MODEL_SPECS
except ImportError:  # 迁移脚本还没跑过：给一份空骨架，不影响服务启动
    DEFAULT_MODEL_SPECS = {'version': 1, 'audio': {}, 'video': {}, 'camera': {}}

# Windows 注册表常把 .svg 注册成 image/svg，浏览器会拒绝用它渲染 <img>/光标资源，这里强制标准值。
mimetypes.add_type('image/svg+xml', '.svg')
mimetypes.add_type('image/webp', '.webp')
DATA_DIR = Path(os.environ.get('CANVASFLOW_DATA_DIR') or ROOT / 'server-data').resolve()
DATA_DIR.mkdir(exist_ok=True)
FILM_WORKBENCH = FilmWorkbench(ROOT, DATA_DIR)
# 视频/大文件落盘目录。**不走 assets.json** —— 那是内联 base64，已经 150MB+，
# 而且 read_json 有 8MB 上限，视频塞进去必然爆。这里存独立文件，节点只记文件名。
MEDIA_DIR = DATA_DIR / 'media'
MEDIA_DIR.mkdir(exist_ok=True)
PROJECTS_FILE = DATA_DIR / 'projects.json'
ASSETS_FILE = DATA_DIR / 'assets.json'
MUSIC_FILE = DATA_DIR / 'music.json'
SUBSCRIPTION_PLANS_FILE = DATA_DIR / 'subscription-plans.json'
# 「了解 CanvasFlow」落地页（模板02-星流 本地托管，r912）。learn/ 是构建脚本 _build_learn.py 的产物：
# index.html + assets/，其中 index.html 的资源前缀已改写为 /learn/assets/、路由 base 补丁为 '/learn/'。
LEARN_DIR = PUBLIC_DIR / 'learn'
# 快照构建时内嵌的版本号（router-uga91Xdy.js 的 Je 常量）。/version.json 原样返回它，
# 模板的「平台已经更新」比对（t.version !== Je）恒为假 → 不再弹挡板。
LEARN_SNAPSHOT_VERSION = '1790569438530'
# learn 页 API 桩的夹具清单（_capture_fixtures.js 捕获的真实响应；图片 URL 已本地化）。
LEARN_API_FIXTURES_FILE = ROOT / 'learn' / 'api' / 'fixtures.json'
MODELS_FILE = DATA_DIR / 'models.json'
JOBS_FILE = DATA_DIR / 'jobs.jsonl'
AUTH_DB_FILE = DATA_DIR / 'auth.db'
AUTH_SECRET_FILE = DATA_DIR / 'auth-secret.txt'
AGENT_SESSIONS_FILE = DATA_DIR / 'agent-sessions.json'
SESSION_COOKIE = 'canvasflow_session'
AGREEMENT_VERSION = '2026-09-01'
ACCOUNT_SUSPENDED_MESSAGE = '您的账号已被停用，停用原因和启用账号请咨询客服，谢谢理解！'
LOCK = threading.RLock()
STORAGE_ACTOR = ContextVar('canvasflow_storage_actor', default='')
NETWORK_ROLE = ContextVar('canvasflow_network_role', default='user')
FILE_IO_LOCK = threading.Lock()

# 对话式 Agent 的纯逻辑放在 agent_runtime.py（不反向依赖本文件，便于单测）。
# 这里把「调模型 / 读模型表」这些能力注入进去，运行时本身不认识本模块。
import sys as _sys
if str(ROOT) not in _sys.path:
    _sys.path.insert(0, str(ROOT))
import agent_runtime as agent


def auth_now():
    return datetime.now(timezone.utc)


def auth_iso(value=None):
    return (value or auth_now()).isoformat()


def auth_db():
    class ManagedConnection(sqlite3.Connection):
        def __exit__(self, *args):
            try:
                return super().__exit__(*args)
            finally:
                self.close()
    connection = sqlite3.connect(AUTH_DB_FILE, timeout=10, factory=ManagedConnection)
    connection.row_factory = sqlite3.Row
    connection.execute('PRAGMA foreign_keys = ON')
    return connection


def init_auth_db():
    schema = """
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        nickname TEXT NOT NULL,
        avatar TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        role TEXT NOT NULL DEFAULT 'user',
        password_hash TEXT,
        password_salt TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auth_identities (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        identifier TEXT NOT NULL,
        normalized_identifier TEXT NOT NULL,
        verified_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(type, normalized_identifier)
    );
    CREATE TABLE IF NOT EXISTS verification_codes (
        id TEXT PRIMARY KEY,
        channel TEXT NOT NULL,
        identifier TEXT NOT NULL,
        purpose TEXT NOT NULL,
        code_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        consumed_at TEXT,
        requested_ip TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_verification_identifier ON verification_codes(channel, identifier, purpose, created_at);
    CREATE INDEX IF NOT EXISTS idx_verification_ip ON verification_codes(requested_ip, created_at);
    CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE TABLE IF NOT EXISTS login_attempts (
        id TEXT PRIMARY KEY,
        identifier TEXT NOT NULL,
        requested_ip TEXT NOT NULL,
        successful INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_login_attempt_identifier ON login_attempts(identifier, created_at);
    CREATE INDEX IF NOT EXISTS idx_login_attempt_ip ON login_attempts(requested_ip, created_at);
    CREATE TABLE IF NOT EXISTS agreement_acceptances (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        document_type TEXT NOT NULL,
        version TEXT NOT NULL,
        action TEXT NOT NULL,
        accepted_at TEXT NOT NULL,
        requested_ip TEXT NOT NULL,
        user_agent TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_agreement_user ON agreement_acceptances(user_id, version, accepted_at);
    CREATE TABLE IF NOT EXISTS credit_ledger (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS generation_settlements (
        hold_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        result TEXT NOT NULL
    );
    -- ★ r886 社交关系与点赞。**刻意不设外键**：被关注 / 被赞的对象可能是演示账号
    --   （`user-canvasflow` / `user-mori`，它们没有 users 行）。加外键会让「关注官方账号」直接 500。
    CREATE TABLE IF NOT EXISTS follows (
        follower_id TEXT NOT NULL,
        following_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (follower_id, following_id)
    );
    CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
    CREATE TABLE IF NOT EXISTS likes (
        user_id TEXT NOT NULL,
        target_kind TEXT NOT NULL,
        target_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY (user_id, target_kind, target_id)
    );
    CREATE INDEX IF NOT EXISTS idx_likes_target ON likes(target_kind, target_id);
    """
    with auth_db() as db:
        db.executescript(schema)
        user_columns = {row['name'] for row in db.execute('PRAGMA table_info(users)').fetchall()}
        if 'role' not in user_columns:
            db.execute("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'")
        if 'password_hash' not in user_columns:
            db.execute('ALTER TABLE users ADD COLUMN password_hash TEXT')
        if 'password_salt' not in user_columns:
            db.execute('ALTER TABLE users ADD COLUMN password_salt TEXT')
        if 'phone' not in user_columns:
            db.execute('ALTER TABLE users ADD COLUMN phone TEXT')
        # ★ r884：积分流水加 `meta`（JSON 文本）—— 记「这次为什么扣/退、用了多少 token、
        #   单价是多少」。以前 reason 是一句中文，明细全丢，用户看到「生成扣费 -12」无从核对。
        #   老库自动补列（本项目既有的迁移写法）。
        ledger_columns = {row['name'] for row in db.execute('PRAGMA table_info(credit_ledger)').fetchall()}
        if 'meta' not in ledger_columns:
            db.execute('ALTER TABLE credit_ledger ADD COLUMN meta TEXT')
        verification_columns={row['name'] for row in db.execute('PRAGMA table_info(verification_codes)')}
        if 'requested_user_id' not in verification_columns:
            db.execute("ALTER TABLE verification_codes ADD COLUMN requested_user_id TEXT NOT NULL DEFAULT ''")
        db.execute('DELETE FROM sessions WHERE expires_at <= ?', (auth_iso(),))
        db.execute('''DELETE FROM sessions WHERE rowid IN (
            SELECT rowid FROM (SELECT rowid, ROW_NUMBER() OVER (
                PARTITION BY user_id ORDER BY created_at DESC, rowid DESC) AS rank
                FROM sessions) WHERE rank > 1)''')


def load_auth_secret():
    configured = str(os.environ.get('CANVASFLOW_AUTH_SECRET') or '').strip()
    if configured:
        return configured.encode('utf-8')
    if AUTH_SECRET_FILE.exists():
        existing = AUTH_SECRET_FILE.read_text(encoding='utf-8').strip()
        if existing:
            return existing.encode('utf-8')
    generated = secrets.token_urlsafe(48)
    AUTH_SECRET_FILE.write_text(generated, encoding='utf-8')
    return generated.encode('utf-8')


AUTH_SECRET = load_auth_secret()
AUTH_DEV_MODE = str(os.environ.get('CANVASFLOW_ENV') or 'production').lower() == 'development'
EMAIL_PATTERN = re.compile(r'^[^\s@]+@[^\s@]+\.[^\s@]+$')
PHONE_PATTERN = re.compile(r'^1[3-9]\d{9}$')


def normalize_email(value):
    email = str(value or '').strip().lower()
    if len(email) > 254 or not EMAIL_PATTERN.fullmatch(email):
        return ''
    return email


REGISTRATION_EMAIL_DOMAINS = frozenset({'qq.com', 'gmail.com'})


def registration_email_error(value):
    email = normalize_email(value)
    local = email.split('@', 1)[0]
    if (not email or len(local) > 64 or local.startswith('.') or local.endswith('.')
            or '..' in local or not re.fullmatch(r"[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+", local)):
        return {'error': 'invalid_email', 'message': '邮箱格式不正确，请填写完整的 QQ 邮箱或 Gmail 地址'}
    if email.rsplit('@', 1)[1] not in REGISTRATION_EMAIL_DOMAINS:
        return {'error': 'unsupported_email_domain', 'message': '仅支持 QQ 邮箱（@qq.com）和谷歌 Gmail（@gmail.com）注册，请检查邮箱后缀'}
    return None


def normalize_phone(value):
    phone = re.sub(r'[\s\-()]', '', str(value or '')).strip()
    if phone.startswith('+86'):
        phone = phone[3:]
    elif phone.startswith('86') and len(phone) == 13:
        phone = phone[2:]
    return phone if PHONE_PATTERN.fullmatch(phone) else ''


def digest_value(value):
    return hmac.new(AUTH_SECRET, str(value).encode('utf-8'), hashlib.sha256).hexdigest()


def verification_digest(email, code, purpose='login'):
    return digest_value(f'{purpose}:{email}:{code}')


def session_digest(token):
    return hashlib.sha256(str(token).encode('utf-8')).hexdigest()


def validate_password(value):
    password = str(value or '')
    if len(password) < 8 or len(password) > 128:
        return '', '密码长度需要为 8 到 128 个字符'
    if not re.search(r'[A-Za-z]', password) or not re.search(r'\d', password):
        return '', '密码至少需要包含一个字母和一个数字'
    return password, ''


def create_password_hash(password):
    salt = secrets.token_bytes(16)
    derived = hashlib.scrypt(password.encode('utf-8'), salt=salt, n=2**14, r=8, p=1, dklen=32)
    return derived.hex(), salt.hex()


def verify_password(password, expected_hash, salt_hex):
    try:
        if not isinstance(password, str) or len(password) > 128:
            return False
        salt = bytes.fromhex(str(salt_hex or ''))
        derived = hashlib.scrypt(str(password).encode('utf-8'), salt=salt, n=2**14, r=8, p=1, dklen=32).hex()
        return hmac.compare_digest(derived, str(expected_hash or ''))
    except (ValueError, TypeError):
        return False


def create_session(db, user_id, current_dt):
    token = secrets.token_urlsafe(36)
    current = auth_iso(current_dt)
    expires = auth_iso(current_dt + timedelta(days=30))
    # DELETE and INSERT share the caller's transaction: concurrent logins leave one session.
    db.execute('DELETE FROM sessions WHERE user_id = ?', (user_id,))
    db.execute('INSERT INTO sessions (token_hash, user_id, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?)', (session_digest(token), user_id, expires, current, current))
    return token


def reserve_verification_code(email, purpose, ip, requested_user_id=''):
    """Reserve the send slot atomically before contacting SMTP."""
    current_dt=auth_now();current=auth_iso(current_dt)
    code=f'{secrets.randbelow(1_000_000):06d}';code_id='code-'+uuid.uuid4().hex
    with auth_db() as db:
        db.execute('BEGIN IMMEDIATE')
        for column,value,window,limit,error,message in (
            ('identifier',email,60,1,'too_frequent','发送过于频繁，请 60 秒后再试'),
            ('identifier',email,86400,10,'daily_limit','该邮箱今天的验证码发送次数已达上限'),
            ('requested_ip',ip,3600,30,'ip_limit','当前网络请求过于频繁，请稍后再试')):
            count=db.execute(f"SELECT COUNT(*) FROM verification_codes WHERE channel='email' AND {column}=? AND created_at>=?",(value,auth_iso(current_dt-timedelta(seconds=window)))).fetchone()[0]
            if count>=limit:return None,None,{'error':error,'message':message}
        db.execute("UPDATE verification_codes SET consumed_at=? WHERE channel='email' AND identifier=? AND purpose=? AND consumed_at IS NULL",(current,email,purpose))
        db.execute('INSERT INTO verification_codes (id,channel,identifier,purpose,code_hash,expires_at,requested_ip,created_at,requested_user_id) VALUES (?,?,?,?,?,?,?,?,?)',
                   (code_id,'email',email,purpose,verification_digest(email,code,purpose),auth_iso(current_dt+timedelta(minutes=10)),ip,current,requested_user_id))
    return code_id,code,None


def agreement_is_accepted(payload):
    return payload.get('agreementAccepted') is True and str(payload.get('agreementVersion') or '') == AGREEMENT_VERSION


def record_agreement_acceptance(db, user_id, email, action, ip, user_agent, accepted_at):
    for document_type in ('terms', 'privacy'):
        db.execute('INSERT INTO agreement_acceptances (id, user_id, email, document_type, version, action, accepted_at, requested_ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', (f'agreement-{uuid.uuid4().hex}', user_id, email, document_type, AGREEMENT_VERSION, action, accepted_at, ip, str(user_agent or '')[:500]))


CREDIT_QUANTUM = Decimal('0.01')


def credit_amount(value):
    """Currency-sized credits; unit rates retain their separate higher precision."""
    try:
        number = Decimal(str(value or 0))
        if not number.is_finite():
            raise ValueError('invalid credit amount')
        return float(number.quantize(CREDIT_QUANTUM, rounding=ROUND_HALF_UP))
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError('积分金额必须是有效数字')


def parse_credit_delta(value):
    if isinstance(value, bool):
        raise ValueError('余额调整必须是金额，最多保留两位小数')
    result = credit_amount(value)
    if Decimal(str(value or 0)) != Decimal(str(result)):
        raise ValueError('余额调整最多保留两位小数')
    return result


def capture_job_metering(job, payload):
    if not isinstance(payload, dict):
        return
    candidate = payload.get('usage') or payload
    if usage_tokens(candidate) is not None:
        job['upstreamUsage'] = {key: value for key, value in candidate.items()
                                if key in ('input_tokens', 'output_tokens', 'prompt_tokens',
                                           'completion_tokens', 'total_tokens')}
    # duration_seconds is queue/processing wall time in this provider; NEVER bill it.
    for key in ('output_duration', 'video_duration', 'media_duration'):
        value = payload.get(key)
        try:
            seconds = float(value)
        except (ValueError, TypeError):
            continue
        if seconds > 0:
            job['seconds'] = seconds
            break

def user_credit_balance(db, user_id):
    row = db.execute('SELECT COALESCE(SUM(CAST(ROUND(amount * 100) AS INTEGER)) / 100.0, 0) AS balance FROM credit_ledger WHERE user_id = ?', (user_id,)).fetchone()
    return credit_amount(row['balance'] or 0) if row else 0.0


def user_credits_view(user_id, limit=40):
    """「个人中心 → 我的账户」的余额 + 积分流水视图。

    ★★ 只读**传入的那个 user_id** 自己的账。调用方必须传「当前登录用户」的 id，
       **绝不允许**从请求参数 / query 里取 userId —— 否则任何人都能读别人的余额与消费记录。
    ★ 流水按时间倒序，同一秒内写入的靠 `rowid` 兜底（`created_at` 精度只到秒，
       连续两次充值会同秒 → 光按时间排顺序不稳定）。
    """
    try:
        size = max(1, min(200, int(limit)))
    except (TypeError, ValueError):
        size = 40
    with auth_db() as db:
        balance = user_credit_balance(db, user_id)
        rows = db.execute(
            'SELECT id, amount, reason, created_at, meta FROM credit_ledger WHERE user_id = ? '
            'ORDER BY created_at DESC, rowid DESC LIMIT ?', (user_id, size)
        ).fetchall()
        # ★ r889（用户需求：「本月用量」卡的数字要和后台「我的账户」对得上）：
        #   两边必须读**同一份流水**。`ledger` 只取最近 N 条（够画列表就行），
        #   所以「本月已用」必须单独在**整份流水**上求和 —— 否则流水一多就会少算，
        #   卡片和账户页对不上。口径 = 本月（UTC）所有负向流水（生成消耗）的绝对值之和。
        month_key = datetime.now(timezone.utc).strftime('%Y-%m')
        month_used = db.execute(
            'SELECT COALESCE(SUM(CAST(ROUND(-amount * 100) AS INTEGER)) / 100.0, 0) FROM credit_ledger '
            "WHERE user_id = ? AND amount < 0 AND substr(created_at, 1, 7) = ?",
            (user_id, month_key),
        ).fetchone()[0]
    ledger = []
    for row in rows:
        # ★ r884：`meta` 是 JSON 文本（预扣 / 结算的 token 明细）。坏数据只丢这一条的明细，
        #   不能让整份流水接口 500 —— 用户会以为余额也没了。
        try:
            meta = json.loads(row['meta']) if row['meta'] else None
        except (TypeError, ValueError):
            meta = None
        ledger.append({
            'id': row['id'],
            'amount': credit_amount(row['amount'] or 0),
            'reason': row['reason'] or '',
            'createdAt': row['created_at'] or '',
            'meta': meta,
        })
    return {'creditBalance': balance, 'monthUsed': credit_amount(month_used or 0), 'ledger': ledger}


# ===========================================================================
# 社交关系与点赞（r886）
#
# 用户需求：「我用当前账号关注别人，应该我的账号信息这边显示，并且应该是可以点进去查看关注了
#   哪些人的……获赞和作品这些数量都需要有统计，并且同步，获赞的话应该是社区分享里，
#   分享的任何东西都要加入点赞功能。」
#
# 所以**四项统计全部落库**（关注 / 粉丝 / 获赞 / 作品），不再靠 localStorage 装样子：
#   · localStorage 只对「我这台浏览器」可见 → 对方的粉丝数永远是 0，也没法列出「我关注了谁」；
#   · 点赞更是必须落库，否则「获赞」根本无从统计。
#
# 统计口径（唯一真相在这里，前端不要自己再算一遍）：
#   works     = 我**公开分享**的 项目 + 音乐 + 素材 + 模型 总数
#   likes     = 上面那些内容收到的点赞总数（= 条目自带基线 + likes 表里的真实点赞）
#   following = follows 里 follower_id = 我 的行数
#   followers = follows 里 following_id = 我 的行数
# ===========================================================================

SOCIAL_KINDS = ('project', 'music', 'asset', 'model')
SOCIAL_KIND_LABEL = {'project': '项目', 'music': '音乐', 'asset': '素材', 'model': '模型'}
# `/api/community` 的响应键 → 点赞用的 target_kind
SOCIAL_PAYLOAD_KEYS = (('projects', 'project'), ('music', 'music'), ('assets', 'asset'), ('models', 'model'))


def social_owner_of(item):
    return str((item or {}).get('ownerId') or '').strip()


def social_base_likes(item):
    """条目自带的点赞基线（演示音乐预置了 24 / 18 / 31）。真实点赞在其上累加。"""
    try:
        return max(0, int((item or {}).get('likes') or 0))
    except (TypeError, ValueError):
        return 0


def social_public_items():
    """全站公开分享内容 → [(kind, item)]。**「作品 / 获赞」统计的唯一来源。**

    ★ 可见性判据必须与 `/api/community` 一致（都是 `shared`）—— 改一处要两处一起看。
    """
    rows = []
    for item in read_projects():
        if item.get('shared'):
            rows.append(('project', item))
    for item in read_music():
        if item.get('shared', True):
            rows.append(('music', item))
    for item in read_assets():
        if item.get('shared'):
            rows.append(('asset', item))
    for item in read_models():
        if item.get('shared'):
            rows.append(('model', item))
    return rows


def social_like_counts():
    """{('project','p1'): 3, ...} —— **真实**点赞数（不含条目自带的基线）。"""
    with auth_db() as db:
        rows = db.execute(
            'SELECT target_kind, target_id, COUNT(*) AS n FROM likes GROUP BY target_kind, target_id'
        ).fetchall()
    return {(str(row['target_kind']), str(row['target_id'])): int(row['n'] or 0) for row in rows}


def social_liked_set(user_id):
    uid = str(user_id or '')
    if not uid:
        return set()
    with auth_db() as db:
        rows = db.execute('SELECT target_kind, target_id FROM likes WHERE user_id = ?', (uid,)).fetchall()
    return {(str(row['target_kind']), str(row['target_id'])) for row in rows}


def social_is_following(follower_id, following_id):
    follower, following = str(follower_id or ''), str(following_id or '')
    if not follower or not following:
        return False
    with auth_db() as db:
        row = db.execute('SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?',
                         (follower, following)).fetchone()
    return bool(row)


def social_stats(user_id, items=None, counts=None):
    """某个账号的四项统计。★ 「作品 / 获赞」按公开分享算，「关注 / 粉丝」按 follows 表算。"""
    uid = str(user_id or '')
    items = social_public_items() if items is None else items
    counts = social_like_counts() if counts is None else counts
    mine = [(kind, item) for kind, item in items if uid and social_owner_of(item) == uid]
    with auth_db() as db:
        following = db.execute('SELECT COUNT(*) FROM follows WHERE follower_id = ?', (uid,)).fetchone()[0]
        followers = db.execute('SELECT COUNT(*) FROM follows WHERE following_id = ?', (uid,)).fetchone()[0]
    likes = 0
    for kind, item in mine:
        target = str(item.get('id') or '')
        likes += social_base_likes(item) + counts.get((kind, target), 0)
    return {'works': len(mine), 'likes': likes,
            'following': int(following or 0), 'followers': int(followers or 0)}


def social_person(user_id):
    """展示用的账号信息：优先真实用户表，其次从公开内容里找作者名，最后兜底。"""
    uid = str(user_id or '').strip()
    if not uid:
        return {'id': '', 'name': '创作者', 'avatar': '创'}
    with auth_db() as db:
        row = db.execute('SELECT id, nickname, avatar FROM users WHERE id = ?', (uid,)).fetchone()
    if row:
        name = str(row['nickname'] or '用户')
        return {'id': uid, 'name': name, 'avatar': str(row['avatar'] or name[:1])}
    for _kind, item in social_public_items():
        if social_owner_of(item) == uid:
            name = str(item.get('ownerName') or '创作者')
            return {'id': uid, 'name': name, 'avatar': str(item.get('ownerAvatar') or name[:1])}
    return {'id': uid, 'name': uid.replace('user-', '').replace('-', ' ').strip() or '创作者', 'avatar': '创'}


def social_view(user_id):
    """`GET /api/social`：我自己的四项统计 + 我关注的人 + 关注我的人 + 我点过赞的内容。"""
    uid = str(user_id or '')
    with auth_db() as db:
        following_ids = [str(row['following_id']) for row in db.execute(
            'SELECT following_id FROM follows WHERE follower_id = ? ORDER BY created_at DESC, rowid DESC',
            (uid,)).fetchall()]
        follower_ids = [str(row['follower_id']) for row in db.execute(
            'SELECT follower_id FROM follows WHERE following_id = ? ORDER BY created_at DESC, rowid DESC',
            (uid,)).fetchall()]
    stats=social_stats(uid)
    if globals().get('PORTFOLIO'):stats['portfolioWorks']=sum(row.get('ownerId')==uid for row in PORTFOLIO.rows())
    return {'stats': stats,
            'following': [social_person(pid) for pid in following_ids],
            'followers': [social_person(pid) for pid in follower_ids],
            'likes': [list(pair) for pair in sorted(social_liked_set(uid))]}


def social_set_follow(follower_id, following_id, on=True):
    """关注 / 取关。★ 不能关注自己 —— 否则「关注」列表里出现自己、统计还会自增。"""
    follower, following = str(follower_id or ''), str(following_id or '').strip()
    if not follower or not following:
        return {'error': 'invalid_user', 'message': '关注对象不存在'}, 400
    if follower == following:
        return {'error': 'cannot_follow_self', 'message': '不能关注自己'}, 400
    with auth_db() as db:
        if on:
            db.execute('INSERT OR IGNORE INTO follows (follower_id, following_id, created_at) VALUES (?,?,?)',
                       (follower, following, auth_iso()))
        else:
            db.execute('DELETE FROM follows WHERE follower_id = ? AND following_id = ?', (follower, following))
    return {'following': bool(on), 'target': social_person(following),
            'stats': social_stats(follower), 'targetStats': social_stats(following)}, None


def social_set_like(user_id, kind, target_id, on=True):
    """点赞 / 取消点赞。返回**该内容最新的总点赞数**，前端直接用它刷新数字。"""
    kind = str(kind or '').strip()
    target = str(target_id or '').strip()
    if kind not in SOCIAL_KINDS or not target:
        return {'error': 'invalid_target', 'message': '点赞对象不存在'}, 400
    with auth_db() as db:
        if on:
            db.execute('INSERT OR IGNORE INTO likes (user_id, target_kind, target_id, created_at) VALUES (?,?,?,?)',
                       (str(user_id), kind, target, auth_iso()))
        else:
            db.execute('DELETE FROM likes WHERE user_id = ? AND target_kind = ? AND target_id = ?',
                       (str(user_id), kind, target))
    counts = social_like_counts()
    entry = next((item for k, item in social_public_items()
                  if k == kind and str(item.get('id') or '') == target), None)
    return {'liked': bool(on), 'kind': kind, 'id': target,
            'likeCount': (social_base_likes(entry) if entry else 0) + counts.get((kind, target), 0),
            'ownerId': social_owner_of(entry) if entry else ''}, None


def social_attach_likes(payload, user_id=None):
    """给社区 / 公开主页的条目补 `likeCount` + `liked`。★ **只改响应，一个字节都不落盘。**"""
    counts = social_like_counts()
    liked = social_liked_set(user_id)
    for key, kind in SOCIAL_PAYLOAD_KEYS:
        for item in payload.get(key) or []:
            if not isinstance(item, dict):
                continue
            target = str(item.get('id') or '')
            item['likeCount'] = social_base_likes(item) + counts.get((kind, target), 0)
            item['liked'] = (kind, target) in liked
    return payload


# ===========================================================================
# 用量计量与积分扣费（r884）
#
# 用户需求：「按 token 计费要能**准确扣费** —— 上游有些模型是先预扣、生成完再多退少补，
#   并且能和上游同步 token 数。」
#
# 做法 = **两阶段扣费**，让账本净额恒等于「上游真实用量」：
#   ① 预扣 `open_generation_charge()`：提交前按「提示词估算 token + 输出上限」× 单价先扣一笔，
#      写一条 `生成预扣·<模型>` 流水（meta 记 estimated / tokens / pricing）。
#   ② 结算 `settle_generation_charge()`：上游返回后取**真实 usage** 算实际费用 →
#      写一条「多退少补」差额流水（正数 = 退回，负数 = 补扣）。净额 = -实际费用。
#      ★ 上游没给 usage → **保持预扣**，并在结果里标 `note='上游未返回用量，保持预扣（估算）'`
#        —— 诚实标注比假装准确重要。
#   ③ 失败 → 全额退回预扣（上游失败不该让用户买单）。
#   ★ 幂等：会话带 `settled` 标记；差额为 0 时不写流水（不给账本塞噪音）。
#
# 为什么不是「先请求、拿到 usage 再扣」？—— 因为**额度必须先于算力**：不预扣就等于
#   允许余额为负的人无限调用上游。预扣 + 结算是唯一能同时满足「不超支」与「不扣错」的做法，
#   这也正是上游自己的模型（先预扣、多退少补）。
# ===========================================================================

# 带图的请求（视觉模型 / 图生文）输入侧的固定 token 余量：图会占掉相当一部分上下文，
# 只按文字长度估算会严重低估（一张 1024×1024 大约 700~1100 token）。
VISION_INPUT_TOKEN_ALLOWANCE = 1100


def estimate_tokens(text):
    """**预扣用**的粗略估算：宽字符（中日韩）≈ 1 token/字，ASCII ≈ 1 token/4 字符。

    ★ 结算永远以上游 `usage` 为准，这里只决定「先扣多少」。
    ★ 宽字符按 1:1 是**偏保守**（宁可多扣再退，也不漏扣导致余额透支）。
    """
    value = str(text or '')
    if not value:
        return 0
    wide = sum(1 for ch in value if ord(ch) > 0x2E80)
    narrow = len(value) - wide
    return int(wide + (narrow + 3) // 4)


def usage_tokens(usage):
    """把各家上游的 `usage` 归一化成 `{'input','output','total','source'}`。

    兼容四种**本项目真实接入过**的形状：
      · OpenAI chat/completions → prompt_tokens / completion_tokens / total_tokens
      · OpenAI Responses        → input_tokens / output_tokens / total_tokens
      · Anthropic Messages      → input_tokens / output_tokens
      · 媒体类（图 / 视频 / 音频）→ 常只给 total_tokens，或只给 input_tokens
    ★ 返回 `None` = **上游没给用量** → 调用方保持预扣（不要拿估算冒充实测）。
    """
    if not isinstance(usage, dict):
        return None

    def pick(*keys):
        for key in keys:
            value = usage.get(key)
            if isinstance(value, bool):
                continue
            if isinstance(value, (int, float)):
                return int(value)
            if isinstance(value, str) and value.strip().lstrip('-').isdigit():
                return int(value.strip())
        return None

    if 'prompt_tokens' in usage or 'completion_tokens' in usage:
        source = 'chat-completions'
    elif 'input_tokens' in usage or 'output_tokens' in usage:
        source = 'responses/anthropic'
    elif 'total_tokens' in usage:
        source = 'total-only'
    else:
        return None
    details = usage.get('prompt_tokens_details') or usage.get('input_tokens_details') or {}
    cache_read = int(details.get('cached_tokens') or usage.get('cache_read_input_tokens') or 0)
    cache_write = int(details.get('cache_creation_tokens') or usage.get('cache_creation_input_tokens') or 0)
    prompt = pick('prompt_tokens', 'input_tokens')
    if prompt is not None and ('cache_read_input_tokens' in usage or 'cache_creation_input_tokens' in usage):
        prompt += cache_read + cache_write
    completion = pick('completion_tokens', 'output_tokens')
    total = pick('total_tokens')
    if prompt is None and completion is None and total is None:
        return None
    if prompt is None:
        prompt = max(0, (total or 0) - (completion or 0)) if completion is not None else (total or 0)
    if completion is None:
        completion = max(0, (total or 0) - prompt) if total is not None else 0
    if total is None:
        total = prompt + completion
    return {'input': max(0, int(prompt)), 'output': max(0, int(completion)),
            'total': max(0, int(total)), 'source': source, 'cache_read': max(0, cache_read), 'cache_write': max(0, cache_write)}


def pricing_charge(pricing, billing='', tokens=None, calls=1, seconds=0.0):
    """Calculate using Decimal, then round the transaction to cents, never whole credits."""
    price = lambda name: Decimal(str(pricing.get(name) or 0))
    if billing == 'per-token':
        tokens = tokens if isinstance(tokens, dict) else {}
        input_count = max(0, int(tokens.get('input') or 0))
        read = min(input_count, max(0, int(tokens.get('cache_read') or 0)))
        write = min(input_count - read, max(0, int(tokens.get('cache_write') or 0)))
        long_context = input_count > 272000 and price('longInputPer1k') > 0
        input_rate = price('longInputPer1k' if long_context else 'inputPer1k')
        output_rate = price('longOutputPer1k' if long_context else 'outputPer1k')
        read_rate = price('longCacheReadPer1k' if long_context else 'cacheReadPer1k') or input_rate
        write_rate = price('longCacheWritePer1k' if long_context else 'cacheWritePer1k') or input_rate
        amount = (Decimal(input_count - read - write) * input_rate + Decimal(read) * read_rate + Decimal(write) * write_rate) / 1000
        amount += Decimal(int(tokens.get('output') or 0)) * output_rate / 1000
    elif billing == 'per-second':
        amount = Decimal(str(seconds or 0)) * price('perSecond')
    else:
        amount = Decimal(str(calls or 1)) * price('perCall')
    return credit_amount(max(Decimal(0), amount))


def credit_ledger_insert(db, user_id, amount, reason, meta=None):
    """写一条积分流水。`amount` 正数 = 入账（充值 / 退回），负数 = 出账（扣费 / 补扣）。"""
    db.execute(
        'INSERT INTO credit_ledger (id, user_id, amount, reason, created_at, meta) VALUES (?,?,?,?,?,?)',
        (f'credit-{uuid.uuid4().hex}', user_id, credit_amount(amount), str(reason)[:200], auth_iso(),
         json.dumps(meta, ensure_ascii=False) if isinstance(meta, dict) else None))


GENERATION_REQUEST_CHARGE = ContextVar('generation_request_charge', default=None)
PAID_GENERATION_PATHS = {'/api/generate', '/api/ai/text-generate', '/api/ai/image-generate',
                         '/api/ai/tts', '/api/ai/image-to-text', '/api/ai/translate'}


class InsufficientCredits(Exception):
    def __init__(self, balance, required):
        self.payload = {'error': 'insufficient_credits', 'message': f'积分余额不足：本次需预留 {required:.2f} 积分，当前余额 {balance:.2f} 积分，请先充值。',
                        'balance': balance, 'required': required, 'rechargeRequired': True}
        super().__init__(self.payload['message'])


def generation_kind(entry):
    if model_has_usage(entry, 'video'): return 'video'
    if model_has_usage(entry, 't2i'): return 'image'
    if model_has_usage(entry, 'tts'): return 'audio'
    return 'text'


def reserve_video_seconds(entry, settings):
    raw = settings.get('duration')
    contract = effective_provider_contract(entry)
    name = str(entry.get('model') or '').lower()
    # The upstream explicitly omits duration for the audio-driven avatar route.
    if media_generate_entry(entry) and 'avatar' in name: return 10.0
    if raw is None or raw == '': return 10.0 if media_generate_entry(entry) else float(contract.get('defaultDuration') or 5)
    if str(raw).strip().lower() in ('auto', 'adaptive', '智能时长', '-1'):
        return float(contract.get('maxDuration') or (30 if '2.5' in name or 'wan3' in name else 15))
    return max(1.0, parse_video_seconds(raw))


# Provider catalog snapshot: documentation and free metadata only, never generation.
_UPSTREAM_CONTRACTS_CACHE = None
def upstream_contract_catalog():
    global _UPSTREAM_CONTRACTS_CACHE
    if _UPSTREAM_CONTRACTS_CACHE is not None:return _UPSTREAM_CONTRACTS_CACHE
    try:
        _UPSTREAM_CONTRACTS_CACHE=json.loads((ROOT / 'upstream-model-contracts.json').read_text(encoding='utf-8'))
        return _UPSTREAM_CONTRACTS_CACHE
    except FileNotFoundError:
        return {}


def upstream_contract(entry):
    return upstream_contract_catalog().get(str(entry.get('model') or ''), {}) if str(entry.get('id') or '').startswith('newapi-lk888-') else {}


def effective_provider_contract(entry):
    return upstream_contract_catalog().get('__provider_contracts',{}).get(str(entry.get('id') or ''),entry.get('providerContract') or {})


def constrained_model_entries(items):
    result=[]
    for entry in items:
        entry={**entry}
        raw=str(entry.get('model') or '')
        if raw.startswith('tt-image-'):entry['name']=raw.replace('tt-image-','gpt-image-',1)
        elif raw.startswith('gk-'):entry['name']=raw.replace('gk-','grok-',1)
        elif raw=='mj_imagine':entry['name']='Midjourney'
        entry['provider']={'紫叶链':'chatgpt','特惠1 · 纵横':'特惠一','特惠2 · 视频工作流':'特惠2','上游视频工具':'视频超分工具','TT':'gpt-image','GK':'grok'}.get(entry.get('provider'),entry.get('provider'))
        contract=effective_provider_contract(entry)
        if contract:
            entry={**entry,'providerContract':contract}
            if contract.get('catalogUnavailable'):entry['enabled']=False
        result.append(entry)
    return result


def image_parameter_contract(entry):
    """Use the same declared image controls for custom and built-in provider IDs."""
    doc = upstream_contract(entry)
    if doc:
        return doc
    reserved = {'aspectRatio', 'resolution', 'quality', 'count', 'size', 'prompt'}
    params = []
    for row in spec_rows_for_entry(entry, 'image') or []:
        name = row.get('field') or row.get('key')
        if not name or row.get('key') in reserved or name in {'model', 'prompt', 'size', 'quality', 'n'}:
            continue
        if row.get('options'):
            params.append({'name': name, 'label': row.get('label') or name,
                           'type': 'select', 'options': row['options']})
    return {'type': 'image', 'params': params}


def image_entry_options(entry,incoming):
    options=incoming.get('modelOptions') or (incoming.get('generationSettings') or {}).get('modelOptions') or {}
    if not isinstance(options,dict):raise ValueError('图片模型参数格式错误')
    doc=image_parameter_contract(entry);names={p['name'] for p in doc.get('params',[]) if p.get('type') not in ('upload','textarea') and p['name']!='prompt'}
    unknown = sorted(set(options) - names)
    if unknown: raise ValueError('包含该图片模型未声明的参数：' + '、'.join(unknown))
    validate_contract_options(doc,options)
    return {**entry,'mediaParams':{**media_param_overrides(entry),**options}}


def upstream_spec_overlay(specs):
    # Preserve administrator defaults where still valid; the upstream defines the domain.
    specs = json.loads(json.dumps(specs))
    semantic = {'aspect_ratio':'aspectRatio','aspectRatio':'aspectRatio','n':'count','generate_audio':'generateAudio'}
    configured = {str(entry.get('model') or '') for entry in read_ai_models()}
    for name, doc in upstream_contract_catalog().items():
        if name not in configured: continue
        kind = {'video':'video','image':'image','audio':'audio','tts':'audio'}.get(doc.get('type'))
        if not kind: continue
        previous = {r['key']:r for r in specs.get(kind,{}).get(name,[]) if isinstance(r,dict) and r.get('key')}
        rows=[]
        for p in doc.get('params',[]):
            if p.get('name')=='prompt' or (p.get('type')=='upload' and (kind=='audio' or not p.get('required'))): continue
            key=next((k for k,r in previous.items() if r.get('field')==p['name']),semantic.get(p['name'],p['name']))
            if kind=='image' and p['name']=='imageSize':key='resolution'
            if kind=='image' and p['name']=='size' and p.get('options'):
                key='aspectRatio' if any(':' in str(o.get('value')) for o in p.get('options',[])) else 'resolution'
            old=previous.get(key,{})
            options=[{'value':str(o['value']),'label':str(o.get('label') or o['value'])} for o in p.get('options',[]) if o.get('value') is not None and not o.get('currently_unavailable')]
            # If every current channel constrains a field, remove unsupported values.
            groups=doc.get('channel_constraints') or []
            if options and groups and all(p['name'] in g.get('supported_options',{}) for g in groups):
                allowed={str(v).lower() for g in groups for v in g['supported_options'][p['name']]}
                options=[o for o in options if str(o['value']).lower() in allowed]
            default=old.get('default');values=[o['value'] for o in options]
            if values and str(default) not in values: default=values[0]
            rows.append({'key':key,'field':p['name'],'label':p.get('label') or key,'options':options,'default':default})
        specs.setdefault(kind,{})[name]=rows
    return specs


def public_model_contracts(user):
    result={}
    for entry in visible_ai_models(user['id']):
        doc=upstream_contract(entry)
        if doc: result[entry['id']]=doc
        elif entry.get('providerContract'): result[entry['id']]={'providerContract':effective_provider_contract(entry),'type':'video'}
    return result


def contract_condition(condition, params):
    source=condition.get('source');key=condition.get('param');op=condition.get('op')
    if source=='internal': value=None
    elif source=='derived' and key=='input_form':
        images=params.get('images') or params.get('image_url') or []
        count=len(images) if isinstance(images,list) else int(bool(images))
        refs=bool(count or params.get('video_url') or params.get('audio_url'))
        value=('shouzhen' if count==1 else 'shouweizhen') if params.get('mode')=='shouweizhen' and count else 'cankaosheng' if refs else 'wensheng'
    else: value=params.get(key)
    values=value if isinstance(value,list) else [value] if value not in (None,'') else []
    choices={str(v).lower() for v in condition.get('values',[])}
    if op=='present': return bool(values)
    if op=='absent': return not values
    if op=='count_gt': return len(values)>float(condition.get('value') or 0)
    if op=='count_lt': return len(values)<float(condition.get('value') or 0)
    if op=='ext_in': return any(urlparse(str(v)).path.lower().rsplit('.',1)[-1] in choices for v in values)
    if op=='in': return any(str(v).lower() in choices for v in values)
    if op=='not_in': return any(str(v).lower() not in choices for v in values)
    return False


def validate_contract_options(doc, params):
    for p in doc.get('params',[]):
        name=p['name'];value=params.get(name)
        if value in (None,''): continue
        text=('true' if value is True else 'false' if value is False else str(value)).lower()
        options=p.get('options') or []
        if options:
            chosen=next((o for o in options if str(o.get('value')).lower()==text),None)
            if not chosen or chosen.get('currently_unavailable'): raise ValueError(f"{p.get('label') or name}不支持此选项，请按所选模型重新设置。")
            for dependency,allowed in (chosen.get('requires') or {}).items():
                if params.get(dependency) not in (None,'') and str(params[dependency]).lower() not in [str(v).lower() for v in allowed]:
                    raise ValueError(f"{p.get('label') or name}与当前{dependency}不兼容。")
        if p.get('type')=='number':
            try: number=float(value)
            except (TypeError,ValueError): raise ValueError(f"{p.get('label') or name}必须是数字。")
            if not math.isfinite(number) or number<=0: raise ValueError(f"{p.get('label') or name}必须大于零。")
    groups=doc.get('channel_constraints') or []
    if groups:
        def accepts(g):
            for name,allowed in g.get('supported_options',{}).items():
                value=params.get(name)
                if value not in (None,'') and str(value).lower() not in [str(v).lower() for v in allowed]:return False
            return not any(r.get('effect')=='reject' and all(contract_condition(c,params) for c in r.get('when',[])) for r in g.get('capability_rules',[]))
        if not any(accepts(g) for g in groups):raise ValueError('此参数组合没有上游可用线路，请调整画质、版本或参考素材。')


def validate_generation_contract(entry, kind, incoming, *, strict=False):
    settings=incoming.setdefault('generationSettings',{})
    if not isinstance(settings,dict): raise ValueError('生成参数格式不正确')
    doc=upstream_contract(entry);provider=effective_provider_contract(entry);params={}
    if provider.get('catalogUnavailable'):raise ValueError('上游当前目录中没有该模型，暂不提供生成。')
    if kind=='video':
        params.update(settings.get('modelOptions') or {})
        for row in spec_rows_for_entry(entry,'video') or []:
            key=row['key'];name=row.get('field') or key
            value=settings.get({'count':'generateCount'}.get(key,key)) if key in ['duration','resolution','aspectRatio','count','generateAudio'] else params.get(name,row.get('default'))
            if value not in (None,''):
                if key=='duration' and str(value).lower() not in ('auto','adaptive','-1'):value=format(parse_video_seconds(value),'g')
                params[name]=value
        for raw,slot in [('referenceImages','images'),('sourceVideos','video_url'),('sourceAudios','audio_url')]:
            if incoming.get(raw):params[slot]=incoming[raw]
        if provider:
            if provider.get('apiReferenceModes') and settings.get('referenceMode') and settings['referenceMode'] not in provider['apiReferenceModes']:raise ValueError('该上游API文档不支持此参考模式，请改用文生或普通参考生成。')
            aspect=next((r for r in spec_rows_for_entry(entry,'video') or [] if r['key']=='aspectRatio'),None)
            if aspect and settings.get('aspectRatio') and str(settings['aspectRatio']) not in [str(o['value']) for o in aspect.get('options',[])]:raise ValueError('画面比例不受该模型支持。')
            if not any(r['key']=='generateAudio' for r in spec_rows_for_entry(entry,'video') or []):settings.pop('generateAudio',None)
            duration=reserve_video_seconds(entry,settings)
            if provider.get('durationOptions') and duration not in provider['durationOptions']:raise ValueError('该模型只支持以下时长：'+ '、'.join(str(v) for v in provider['durationOptions'])+' 秒。')
            if duration<float(provider.get('minDuration') or 1) or duration>float(provider.get('maxDuration') or 30):raise ValueError('视频时长超过上游支持范围。')
            resolution=str(settings.get('resolution') or provider.get('defaultResolution') or '')
            available=provider.get('resolutions') or []
            if available and resolution.lower() not in [str(v).lower() for v in available]:raise ValueError('清晰度不受该模型支持，请重新选择。')
            limit=(provider.get('maxByResolution') or {}).get(resolution)
            if limit and duration>float(limit):raise ValueError(f'该清晰度最多支持 {limit} 秒。')
            for raw,cap in [('referenceImages','max_image'),('sourceVideos','max_video'),('sourceAudios','max_audio')]:
                if len(incoming.get(raw) or [])>int(provider.get(cap,0)):raise ValueError('参考素材数量超过该模型限制。')
        # Models driven by a source video/audio do not accept an invented duration.
        if doc and not any(p['name']=='duration' for p in doc.get('params',[])) and 'duration' in settings:
            settings.pop('duration',None)
    elif kind=='audio':
        params.update(media_audio_spec(incoming));voice=incoming.get('voice')
        if voice:
            field=next((p['name'] for p in doc.get('params',[]) if p['name'] in ('voice_id','voice','speaker','speaker_id')),None)
            if field:params.setdefault(field,voice)
    elif kind=='image':
        params.update(incoming.get('spec') or {});params.update(incoming.get('modelOptions') or settings.get('modelOptions') or {})
        rows=spec_rows_for_entry(entry,'image') or []
        if incoming.get('presetScene')=='720_panoramic':
            aspect_row=next((r for r in rows if r['key']=='aspectRatio'),{})
            size_row=next((r for r in rows if r['key']=='resolution'),{})
            size=str(incoming.get('size') or '')
            supported=any(str(o.get('value'))=='2:1' for o in aspect_row.get('options',[])) or any(str(o.get('value'))==size for o in size_row.get('options',[]))
            dimensions=re.fullmatch(r'(\d+)x(\d+)',size)
            if not supported or not dimensions or int(dimensions[1])!=2*int(dimensions[2]):raise ValueError('此模型不支持所选2:1全景图规格。')
            settings['aspect']='2:1';settings['resolution']=size
        for row in rows:
            value=settings.get({'aspectRatio':'aspect'}.get(row['key'],row['key']))
            if row['key']=='quality':value=incoming.get('quality') or value
            if row['key']=='resolution' and value and 'x' in str(value):
                values=[str(o.get('value')) for o in row.get('options',[])]
                if values and not any('x' in v for v in values):
                    tiers=[v for v in values if re.fullmatch(r'(?:\d+(?:\.\d+)?)k',v,re.I)]
                    if tiers:
                        longest=max(float(v) for v in str(value).split('x'))
                        value=min(tiers,key=lambda v:abs(float(v[:-1])*1024-longest))
                    else:raise ValueError('该图片模型不支持此像素尺寸，请按模型规格重新选择。')
            if row['key']=='resolution' and not value:
                size=str(incoming.get('size') or '')
                values=[str(o.get('value')) for o in row.get('options',[])]
                if size and size in values:value=size
                elif size and values and any('x' in v for v in values):raise ValueError('该图片模型不支持此像素尺寸，请按模型规格重新选择。')
            if value not in (None,''):params[row.get('field') or row['key']]=value
    if doc:
        validate_contract_options(doc,params)
        if strict and kind=='video':
            for p in doc.get('params',[]):
                if not p.get('required') or p.get('type')!='upload':continue
                name=p['name'];slot='referenceImages' if 'image' in name else 'sourceVideos' if 'video' in name else 'sourceAudios' if 'audio' in name else ''
                if slot and not incoming.get(slot):raise ValueError('该模型需要'+str(p.get('label') or name)+'，请先上传或连接素材。')
    return params


def agent_chat_quote(user, incoming):
    brain,error=agent_resolve_model(str(incoming.get('modelId') or '').strip(),user['id'])
    if error:raise ValueError(error)
    session_id=str(incoming.get('sessionId') or '')
    session=find_agent_session(session_id,user['id']) if session_id else None
    messages=json.loads(json.dumps((session or {}).get('messages') or []))
    resume=incoming.get('resume')
    if not resume:messages.append({'role':'user','content':str(incoming.get('message') or '').strip()})
    elif isinstance(resume,dict):messages.append({'role':'tool','tool_call_id':str(resume.get('toolCallId') or ''),'content':json.dumps({'ok':True,'answer':str(resume.get('content') or '')},ensure_ascii=False)})
    messages=agent.trim_history(messages,keep=agent.HISTORY_KEEP)
    canvas=incoming.get('canvas') if isinstance(incoming.get('canvas'),dict) else {}
    ctx=build_agent_ctx(user,canvas,brain)
    system=agent.build_system_prompt('CanvasFlow')+'\n\n'+agent.canvas_digest(ctx['canvas'])
    if isinstance(incoming.get('film'),dict):
        system+='\n\n'+agent.FILM_DIRECTIVE
        ctx['film_call']=True  # Quote includes the same tool definitions; no operation is executed here.
    for directive in (agent.mode_directive(str(incoming.get('mode') or '')[:32]),agent.gen_mode_directive(str(incoming.get('genMode') or '')[:32])):
        if directive:system+='\n\n'+directive
    messages=[{'role':'system','content':system}]+[m for m in messages if m.get('role')!='system']
    q=generation_quote(user,brain,prompt_text=json.dumps(messages,ensure_ascii=False)+json.dumps(agent.film_tools(ctx,agent.TOOL_SCHEMAS),ensure_ascii=False),max_tokens=4096,kind='text')
    q['notice']='首轮对话预扣（含历史、画布上下文及工具定义），最多 4096 输出 Token。后续对话轮次与图片、视频工具分别预扣；不是整项任务总价。 '+q['notice']
    return q


def generation_quote(user, entry, *, prompt_text='', max_tokens=0, seconds=0.0, calls=1,
                     extra_input_tokens=0, kind=None, settings=None, image_size='1024x1024'):
    return {'modelId': entry.get('id'), 'modelName': entry.get('name'), 'kind': kind or generation_kind(entry),
            'billing': 'local', 'pricing': {}, 'tokens': None, 'seconds': float(seconds or 0), 'calls': calls,
            'amount': 0, 'estimatedAmount': 0, 'requiredBalance': 0, 'balance': 0,
            'canAfford': True, 'phase': 'local', 'notice': '', 'local': True}


def quote_request(user, path, incoming):
    settings = incoming.get('generationSettings') if isinstance(incoming.get('generationSettings'),dict) else {}
    kind = incoming.get('kind') if path == '/api/ai/quote' else {'/api/generate':'video','/api/ai/tts':'audio','/api/ai/image-generate':'image'}.get(path,'text')
    wanted = {'video':'video','image':'t2i','audio':'tts','text':'text'}.get(kind,'text')
    model_id = str(incoming.get('modelId') or settings.get('modelId') or '').strip()
    models = [m for m in visible_ai_models(user['id']) if m.get('enabled') and (model_has_usage(m,wanted) or (kind=='text' and path=='/api/ai/image-to-text' and model_has_usage(m,'i2t')))]
    entry = next((m for m in models if m.get('id')==model_id), None) if model_id else next(iter(models),None)
    if not entry: raise ValueError('所选模型不存在或未启用，请重新选择模型。')
    validate_generation_contract(entry,kind,incoming,strict=path!='/api/ai/quote')
    source_path=incoming.get('sourcePath') if path=='/api/ai/quote' else path
    prompt = str(incoming.get('prompt') or incoming.get('text') or incoming.get('instruction') or '')
    preset = preset_prompt_text(str(incoming.get('presetScene') or '')) if incoming.get('presetScene') else ''
    prompt = '\n'.join(p for p in [preset,prompt] if p)
    output_limit = 0
    if kind=='text':
        purpose='scene_agent' if incoming.get('purpose')=='scene_agent' else 'text'
        _,output_limit,_=text_generation_profile(purpose)
        prompt=text_generation_input_text(prompt,purpose)
    extra = VISION_INPUT_TOKEN_ALLOWANCE if source_path=='/api/ai/image-to-text' else 0
    if source_path=='/api/ai/image-to-text':
        output_limit=500
        prompt=str(incoming.get('instruction') or '').strip()
    seconds = reserve_video_seconds(entry,settings) if kind=='video' else 0
    return entry,generation_quote(user,entry,prompt_text=prompt,max_tokens=output_limit,seconds=seconds,
        calls=incoming.get('quoteCount',1),extra_input_tokens=extra,kind=kind,settings=settings,image_size=str(incoming.get('size') or '1024x1024'))


def prepare_request_generation(user, path, incoming):
    entry,quote=quote_request(user,path,incoming)
    charge=open_generation_charge(user,entry,prepared_quote=quote)
    GENERATION_REQUEST_CHARGE.set({'charge':charge,'deferred':False})
    return quote


def open_generation_charge(user, entry, *, prompt_text='', max_tokens=0, seconds=0.0, calls=1,
                           extra_input_tokens=0, label='', prepared_quote=None):
    return {'enabled': False, 'settled': True, 'amount': 0, 'userId': LOCAL_ID, 'modelId': (entry or {}).get('id')}



def settle_generation_charge(charge, usage=None, *, seconds=None, calls=None, failed=False, label=''):
    return {'estimated': 0, 'actual': 0, 'charged': 0, 'refunded': 0, 'tokens': usage_tokens(usage), 'note': '', 'balance': 0}


def charge_generation_after(user, entry, *, prompt_text='', output_text='', extra_input_tokens=0,
                            calls=1, seconds=0.0, label=''):
    return None


def billing_payload(charge, settlement=None, usage=None):
    return None


def settle_job_charge(job):
    return False


def email_display_name(email):
    local = str(email).split('@', 1)[0].strip() or 'CanvasFlow 用户'
    return local[:40]


def send_login_email(email, code, purpose='register'):
    host = str(os.environ.get('SMTP_HOST') or '').strip()
    sender = str(os.environ.get('SMTP_FROM') or os.environ.get('SMTP_USER') or '').strip()
    if not host or not sender:
        if not AUTH_DEV_MODE:
            raise RuntimeError('生产环境未配置 SMTP_HOST 和 SMTP_FROM')
        print(f'[CanvasFlow Auth] development email code for {email} ({purpose}): {code}')
        return 'development'
    port = int(os.environ.get('SMTP_PORT') or 587)
    username = str(os.environ.get('SMTP_USER') or '').strip()
    password = str(os.environ.get('SMTP_PASSWORD') or '')
    use_ssl = str(os.environ.get('SMTP_SSL') or '').lower() in {'1', 'true', 'yes'} or port == 465
    use_tls = str(os.environ.get('SMTP_USE_TLS') or '1').lower() not in {'0', 'false', 'no'}
    message = EmailMessage()
    message['From'] = formataddr(('CanvasFlow', sender))
    message['To'] = email
    message['Date'] = formatdate(localtime=True)
    message['Message-ID'] = make_msgid(domain=sender.rsplit('@', 1)[-1])
    if purpose == 'change_email':
        message['Subject'] = 'CanvasFlow 邮箱更换验证码'
        message.set_content(f'你正在把 CanvasFlow 账户的邮箱更换为 {email}。\n\n验证码：{code}\n\n验证码 10 分钟内有效，使用后立即失效。如果不是你本人操作，请忽略此邮件。')
    else:
        message['Subject'] = 'CanvasFlow 注册验证码'
        message.set_content(f'你的 CanvasFlow 注册验证码是：{code}\n\n验证码 10 分钟内有效，使用后立即失效。如果不是你本人操作，请忽略此邮件。')
    client = smtplib.SMTP_SSL(host, port, timeout=20, context=ssl.create_default_context()) if use_ssl else smtplib.SMTP(host, port, timeout=20)
    try:
        client.ehlo()
        if use_tls and not use_ssl:
            client.starttls(context=ssl.create_default_context()); client.ehlo()
        if username:
            client.login(username, password)
        client.send_message(message, from_addr=sender, to_addrs=[email])
    finally:
        try: client.quit()
        except Exception: pass
    return 'smtp'


init_auth_db()

DEFAULT_NODES = []
DEFAULT_EDGES = []
# ★ 内置演示数据已按用户要求全部清空（2026-09-29）：
#   · DEFAULT_PROJECTS / DEFAULT_ASSETS —— 仅在对应 json 文件**整个丢失**时由 read_file 写回，
#     留空列表保证新环境/丢文件后也不再出现演示项目与演示素材；
#   · DEFAULT_MUSIC —— read_music 在 music.json 为空时会用这份默认值**回种**，
#     留空才能让音乐库/社区页保持真空；
#   · TEMPLATES —— /api/templates 直接返回本常量，不落盘，置空即永久无模板。
DEFAULT_PROJECTS = []
DEFAULT_ASSETS = []
DEFAULT_MUSIC = []
TEMPLATES = []


def make_sample_graph(layout, links):
    nodes = [{'id': nid, 'type': ntype, 'left': left, 'top': top} for nid, ntype, left, top in layout]
    edges = [{'id': f'edge-{src}-{dst}', 'source': src, 'target': dst} for src, dst in links]
    return nodes, edges


SAMPLE_GRAPHS = {
    'summer-skincare': make_sample_graph(
        [('sk-prompt-1', 'prompt', 110, 120), ('sk-image-1', 'image', 110, 330), ('sk-prompt-2', 'prompt', 110, 540), ('sk-audio-1', 'audio', 110, 750), ('sk-model-1', 'model', 520, 200), ('sk-model-2', 'model', 520, 560), ('sk-output-1', 'output', 930, 220), ('sk-output-2', 'output', 930, 580)],
        [('sk-prompt-1', 'sk-model-1'), ('sk-image-1', 'sk-model-1'), ('sk-prompt-2', 'sk-model-2'), ('sk-audio-1', 'sk-model-2'), ('sk-model-1', 'sk-output-1'), ('sk-model-2', 'sk-output-2')]),
    'pop-mv-lab': make_sample_graph(
        [('mv-prompt-1', 'prompt', 80, 80), ('mv-prompt-2', 'prompt', 80, 300), ('mv-prompt-3', 'prompt', 80, 520), ('mv-prompt-4', 'prompt', 80, 740), ('mv-image-1', 'image', 80, 960), ('mv-audio-1', 'audio', 80, 1180), ('mv-model-1', 'model', 480, 120), ('mv-model-2', 'model', 480, 380), ('mv-model-3', 'model', 480, 640), ('mv-model-4', 'model', 480, 900), ('mv-model-5', 'model', 480, 1160), ('mv-output-1', 'output', 880, 140), ('mv-output-2', 'output', 880, 400), ('mv-output-3', 'output', 880, 660), ('mv-output-4', 'output', 880, 920), ('mv-output-5', 'output', 880, 1180)],
        [('mv-prompt-1', 'mv-model-1'), ('mv-prompt-2', 'mv-model-2'), ('mv-prompt-3', 'mv-model-3'), ('mv-prompt-4', 'mv-model-4'), ('mv-image-1', 'mv-model-5'), ('mv-audio-1', 'mv-model-5'), ('mv-audio-1', 'mv-model-1'), ('mv-model-1', 'mv-output-1'), ('mv-model-2', 'mv-output-2'), ('mv-model-3', 'mv-output-3'), ('mv-model-4', 'mv-output-4'), ('mv-model-5', 'mv-output-5')]),
    'city-travel': make_sample_graph(
        [('ct-prompt-1', 'prompt', 100, 110), ('ct-prompt-2', 'prompt', 100, 330), ('ct-image-1', 'image', 100, 550), ('ct-image-2', 'image', 100, 770), ('ct-audio-1', 'audio', 100, 990), ('ct-model-1', 'model', 500, 180), ('ct-model-2', 'model', 500, 520), ('ct-model-3', 'model', 500, 860), ('ct-output-1', 'output', 900, 200), ('ct-output-2', 'output', 900, 540), ('ct-output-3', 'output', 900, 880)],
        [('ct-prompt-1', 'ct-model-1'), ('ct-prompt-2', 'ct-model-1'), ('ct-image-1', 'ct-model-2'), ('ct-image-2', 'ct-model-2'), ('ct-audio-1', 'ct-model-3'), ('ct-prompt-2', 'ct-model-3'), ('ct-model-1', 'ct-output-1'), ('ct-model-2', 'ct-output-2'), ('ct-model-3', 'ct-output-3')]),
}


def clone(value):
    return json.loads(json.dumps(value, ensure_ascii=False))


def read_file(path: Path, fallback):
    if not path.exists():
        path.write_text(json.dumps(fallback, ensure_ascii=False, indent=2), encoding='utf-8')
        return local_content(path, clone(fallback))
    try:
        return local_content(path, json.loads(path.read_text(encoding='utf-8')))
    except (OSError, UnicodeError, json.JSONDecodeError):
        # Corrupt data must not be silently replaced by defaults: the next write would then
        # overwrite the user's only copy. Keep the broken file side by side for manual recovery.
        try:
            backup = path.with_suffix(path.suffix + '.corrupt')
            backup.write_text(path.read_text(encoding='utf-8', errors='replace'), encoding='utf-8')
            print(f'[CanvasFlow API] {path.name} 解析失败，已备份到 {backup.name}')
        except OSError:
            pass
        raise StorageReadError(f'{path.name} 无法读取；原文件已保留，请恢复有效备份后重试')


def materialize_inline_content(value,owner_id):
    if isinstance(value,dict):
        return {key:materialize_inline_content(child,owner_id) for key,child in value.items()}
    if isinstance(value,list):return [materialize_inline_content(child,owner_id) for child in value]
    if not isinstance(value,str) or not owner_id:return value
    if value.lstrip().startswith(('{','[')):
        try:
            parsed=json.loads(value);converted=materialize_inline_content(parsed,owner_id)
            return json.dumps(converted,ensure_ascii=False) if converted!=parsed else value
        except (ValueError,RecursionError):pass
    pattern=r'data:(?:image/(?:png|jpeg|webp)|video/(?:mp4|webm|quicktime)|audio/(?:mpeg|wav|x-wav|mp4));base64,[A-Za-z0-9+/=]+'
    def replace(match):
        mime,raw=decode_data_uri(match[0])
        if not raw:return match[0]
        return save_media_blob(raw,mime,'项目或素材内嵌媒体',owner_id=owner_id)['url']
    return re.sub(pattern,replace,value)


def write_file(path: Path, value):
    storage = globals().get('ACCOUNT_STORAGE')
    actor = STORAGE_ACTOR.get()
    content_files = {'projects.json','assets.json','music.json','models.json','previs-assets.json','portfolio.json','agent-sessions.json','agent-shares.json','agent-skills.json','ai-models.json'}
    if storage and actor and path.name in content_files and isinstance(value,list):
        if path.name!='ai-models.json':
            value=[materialize_inline_content(row,actor) if isinstance(row,dict) and (row.get('ownerId') or row.get('userId'))==actor else row for row in value]
        previous=json.loads(path.read_text(encoding='utf-8')) if path.exists() else []
        def owned_bytes(rows):return sum(content_size(row) for row in rows if isinstance(row,dict) and (row.get('ownerId') or row.get('userId'))==actor)
        storage.ensure(actor,owned_bytes(value)-owned_bytes(previous))
    temp = path.with_name(path.name + '.' + uuid.uuid4().hex + '.tmp')
    try:
        temp.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf-8')
        with FILE_IO_LOCK:
            for attempt in range(6):
                try:
                    temp.replace(path)
                    break
                except PermissionError:
                    if attempt == 5: raise
                    # Windows readers can briefly prevent atomic replacement.
                    time.sleep(.01 * (2 ** attempt))
    finally:
        temp.unlink(missing_ok=True)


# ===== 工作区（Workspace）=====
# 每个工作区是一个独立空间：项目 / 素材库 / 技能 / Agent 会话 / 生成任务都按工作区分区，
# 空间之间互不可见。唯一跨工作区互通的是「社区」—— 即 shared=true 的公开内容。
# 分区键走请求头 X-Workspace-Id，前端一次注入即可覆盖所有接口，不必给 30 个 URL 各加参数。
WORKSPACES_FILE = DATA_DIR / 'workspaces.json'
WORKSPACE_DEFAULT_PREFIX = 'workspace-default-'


def default_workspace_id(user_id):
    return f'{WORKSPACE_DEFAULT_PREFIX}{user_id}'


def read_workspaces():
    value = read_file(WORKSPACES_FILE, [])
    return value if isinstance(value, list) else []


def write_workspaces(items):
    write_file(WORKSPACES_FILE, items if isinstance(items, list) else [])


def workspace_view(item):
    return {
        'id': item.get('id'),
        'name': item.get('name') or '未命名工作区',
        'type': item.get('type') or '个人空间',
        'isDefault': bool(item.get('isDefault')),
        'createdAt': item.get('createdAt') or '',
        'updatedAt': item.get('updatedAt') or '',
    }


def workspaces_for_user(user_id):
    return [item for item in read_workspaces() if item.get('userId') == user_id]


def ensure_default_workspace(user_id, nickname=''):
    """每个账号必有一个默认工作区。升级前的老数据没有 workspaceId，全部按 ownerId 归到
    各自的默认工作区 —— 惰性归属，所以不必重写 assets.json（150MB+）这类大文件。"""
    hit = next((item for item in workspaces_for_user(user_id) if item.get('isDefault')), None)
    if hit:
        return hit
    stamp = now()
    created = {'id': default_workspace_id(user_id), 'userId': user_id,
               'name': '本地工作区',
               'type': '本地空间', 'isDefault': True, 'createdAt': stamp, 'updatedAt': stamp}
    with LOCK:
        items = read_workspaces()
        if not any(item.get('id') == created['id'] for item in items):
            items.append(created)
            write_workspaces(items)
    return created


def workspace_id_set():
    """现存工作区 id 集合。用来识别「工作区已被删除」的遗留记录。"""
    return {str(item.get('id')) for item in read_workspaces() if item.get('id')}


def item_workspace_id(item, valid_ids=None):
    """一条记录属于哪个工作区。

    - 有 workspaceId：直接用它；但它指向的工作区若已被删除，内容要退回主人自己的默认工作区，
      否则那些项目/素材会变成谁也看不见的孤儿（删除工作区因此不必重写数据文件）。
    - 没有 workspaceId（升级前的老数据）：按 ownerId / userId 归入其默认工作区。
    """
    if not isinstance(item, dict):
        return ''
    owner = str(item.get('ownerId') or item.get('userId') or '').strip()
    fallback = default_workspace_id(owner) if owner else ''
    explicit = str(item.get('workspaceId') or '').strip()
    if not explicit:
        return fallback
    if valid_ids is not None and explicit not in valid_ids:
        return fallback
    return explicit


def in_workspace(item, workspace_id, valid_ids=None):
    return bool(workspace_id) and item_workspace_id(item, valid_ids) == workspace_id


def read_projects():
    projects = read_file(PROJECTS_FILE, DEFAULT_PROJECTS)
    normalized = []
    for item in projects:
        project = dict(item) if isinstance(item, dict) else {}
        project_id = project.get('id')
        # ★★ r807：只有**字段缺失**才补默认图（老数据 / 示例项目）。
        #   以前这里写的是 `not project.get('nodes')` —— **空数组也命中**，
        #   于是用户把画布删空后一刷新，服务端又补回三个默认节点
        #   （这就是「画布至少需要保留一个节点」的服务端版本，客户端那三处已一并移除）。
        #   空画布（nodes: [] 且 edges: []）是用户的合法状态，必须原样保留。
        if project_id and 'nodes' not in project:
            nodes, edges = SAMPLE_GRAPHS.get(project_id, (DEFAULT_NODES, DEFAULT_EDGES))
            project['nodes'] = clone(nodes)
            project['edges'] = clone(edges)
        elif 'edges' not in project:
            project['edges'] = []
        # nodeCount 始终跟着 nodes 走（含 0）—— 项目列表里显示的就是它。
        if 'nodes' in project:
            project['nodeCount'] = len(project['nodes'] or [])
        project.setdefault('ownerId', 'user-canvasflow')
        project.setdefault('ownerName', '林默' if project_id == 'city-night-intro' else 'CanvasFlow 社区')
        project.setdefault('ownerAvatar', str(project.get('ownerName') or 'C')[:1])
        if 'shared' not in project:
            project['shared'] = project_id in {'city-night-intro', 'summer-skincare', 'pop-mv-lab'}
        normalized.append(project)
    return normalized


def read_assets():
    return read_file(ASSETS_FILE, DEFAULT_ASSETS)


# ---------------------------------------------------------------------------
# 大文件媒体（视频等）：独立落盘，不进 assets.json
# ---------------------------------------------------------------------------
# 为什么单独一套：`blob:` URL 只活在「创建它的那个浏览器标签页」里 ——
# ①分享页是另一个文档，拿不到 → 视频节点在分享页变空卡；
# ②主站刷新后 blob 被销毁 → 视频也没了。
# 所以「替换素材 / 生成的视频」必须落成服务端真实文件，节点只记 `/media/<file>`。
MEDIA_EXT_BY_MIME = {
    'model/gltf-binary': '.glb',
    'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov',
    'video/x-matroska': '.mkv', 'video/ogg': '.ogv',
    'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp',
    'image/gif': '.gif', 'audio/mpeg': '.mp3', 'audio/wav': '.wav', 'audio/mp4': '.m4a',
    'audio/ogg': '.ogg', 'audio/flac': '.flac', 'audio/aac': '.aac',
}
MEDIA_MAX_BYTES = 200_000_000        # 200MB，本机自用够了；再大就是用户在乱选
MEDIA_UPLOAD_SLOTS = threading.BoundedSemaphore(2)
MEDIA_SAFE_NAME = re.compile(r'^media-[0-9a-f]{32}\.[a-z0-9]{1,5}$')


def media_kind_of(mime, name=''):
    mime = str(mime or '').lower()
    if mime.startswith('video/'): return 'video'
    if mime.startswith('image/'): return 'image'
    if mime.startswith('audio/'): return 'audio'
    ext = Path(str(name or '')).suffix.lower()
    if ext in ('.mp4', '.webm', '.mov', '.mkv', '.ogv'): return 'video'
    if ext in ('.png', '.jpg', '.jpeg', '.webp', '.gif'): return 'image'
    if ext in ('.mp3', '.wav', '.m4a'): return 'audio'
    return 'file'


def media_ext(mime, name=''):
    mime = str(mime or '').lower().split(';')[0].strip()
    if mime in MEDIA_EXT_BY_MIME: return MEDIA_EXT_BY_MIME[mime]
    ext = Path(str(name or '')).suffix.lower()
    if ext in ('.mp4', '.webm', '.mov', '.mkv', '.ogv', '.png', '.jpg', '.jpeg',
               '.webp', '.gif', '.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac', '.glb'):
        return '.jpg' if ext == '.jpeg' else ext
    return '.bin'


def sniff_media_mime(raw):
    """从**魔数**判断真实媒体类型；认不出返回 `''`。

    ★★★ 为什么必须有这一层（2026-09-25 真出图验证时踩到）：
      `finish_image_result` 以前把下载回来的字节**一律**写成 `data:image/png;base64,…`，
      而实测 lk888 的 `banana-2` 返回的是 **JPEG**（`ff d8 ff e0 … JFIF`）。
      后果链：data URI 的 MIME 是假的 → `persist_media_url` 信任它 → 落盘成 `.png` 文件、
      按 `image/png` 下发 → **扩展名与内容不符**。浏览器 `<img>` 会嗅探所以看不出问题，
      但严格的下游（把这张图再上传给别的生图接口当参考图、`createImageBitmap` 带类型提示、
      外部编辑器打开）会拒绝或误判 —— 这类"看得见但别处用不了"的 bug 最难查。

    ★ 判据只认**文件头**，不信任何声明（Content-Type / data URI header 都可能是错的）。
    """
    if not raw or len(raw) < 12:
        return ''
    head = bytes(raw[:16])
    if head.startswith(b'\x89PNG\r\n\x1a\n'): return 'image/png'
    if head.startswith(b'\xff\xd8\xff'): return 'image/jpeg'
    if head[:6] in (b'GIF87a', b'GIF89a'): return 'image/gif'
    if head[:2] == b'BM': return 'image/bmp'
    if head[:4] == b'RIFF':
        tag = head[8:12]
        if tag == b'WEBP': return 'image/webp'
        if tag == b'WAVE': return 'audio/wav'
        if tag == b'AVI ': return 'video/x-msvideo'
        return ''
    if head[4:8] == b'ftyp':
        brand = head[8:12]
        if brand in (b'heic', b'heix', b'mif1', b'msf1'): return 'image/heic'
        if brand == b'qt  ': return 'video/quicktime'
        return 'video/mp4'
    if head.startswith(b'\x1a\x45\xdf\xa3'): return 'video/webm'
    if head.startswith(b'ID3') or head[:2] in (b'\xff\xfb', b'\xff\xf3', b'\xff\xf2'): return 'audio/mpeg'
    if head.startswith(b'OggS'): return 'audio/ogg'
    if head.startswith(b'fLaC'): return 'audio/flac'
    return ''


def prefer_sniffed_mime(mime, raw):
    """声明类型 vs 魔数：**同一大类**以内以魔数为准；认不出或跨大类就保留声明。

    ★ 只在同大类内覆盖是有意为之：魔数认不出 HEIF 变种时不能把图判成 `''`；
      更不能因为嗅到 `ftyp` 就把一段音频改成 `video/mp4`。
    """
    sniffed = sniff_media_mime(raw)
    if not sniffed:
        return mime
    declared = str(mime or '').split(';')[0].strip().lower()
    if not declared:
        return sniffed
    return sniffed if sniffed.split('/')[0] == declared.split('/')[0] else mime


def save_media_blob(raw, mime, name='', owner_id=None):
    """把二进制写进 server-data/media/，返回可直接塞进节点的公开 URL。

    ★ 落盘前先用**魔数**校正 MIME（见 `prefer_sniffed_mime`）：这里是所有落盘路径的
      唯一收口点，在这一层修一次，图片/视频/音频/上传全覆盖。
    """
    if not raw:
        raise ValueError('空文件')
    if len(raw) > MEDIA_MAX_BYTES:
        raise ValueError(f'文件超过 {MEDIA_MAX_BYTES // 1_000_000}MB 上限')
    mime = prefer_sniffed_mime(mime, raw)
    filename = f'media-{uuid.uuid4().hex}{media_ext(mime, name)}'
    storage = globals().get('ACCOUNT_STORAGE')
    actor = owner_id if owner_id is not None else STORAGE_ACTOR.get()
    if storage and actor:
        filename=storage.write(actor, filename, raw, mime, name)
    else:
        # Legacy migration has no request context; ownership is reconstructed from records.
        (MEDIA_DIR / filename).write_bytes(raw)
    return {'mediaId': filename, 'url': f'/media/{filename}', 'kind': media_kind_of(mime, name), 'size': len(raw)}


def resolve_media_file(name):
    """把 URL 里的文件名映射到磁盘路径。**只认自己发出去的那个格式**，防目录穿越。"""
    name = str(name or '').strip()
    if not MEDIA_SAFE_NAME.match(name):
        return None
    target = (MEDIA_DIR / name).resolve()
    if target.parent != MEDIA_DIR.resolve() or not target.is_file():
        return None
    return target


# ★★ 个人素材库配额：3 GB（二进制 GB，与网盘口径一致）。
#   口径 = 该用户名下**素材行**占用的字节数（落盘文件按真实大小、内联 base64 按解码后体积）。
#   ★ 节点上直接用的图（走 `/api/upload` 但不建素材行的）**不计入** —— 那是画布资产，
#     不是素材库；否则用户在画布上贴几张参考图就被算成"空间不足"。
#   ★ 可用环境变量覆盖，方便本地验证「超限提醒 / 上传被拒」：
#       CF_USER_STORAGE_QUOTA=1048576 python server.py 5199
try:
    USER_STORAGE_QUOTA_BYTES = max(1, int(os.environ.get('CF_USER_STORAGE_QUOTA') or 3 * 1024 ** 3))
except (TypeError, ValueError):
    USER_STORAGE_QUOTA_BYTES = 3 * 1024 ** 3


def human_bytes(size):
    """把字节数写成 `1.24 GB` 这种给人看的形式（前端进度条旁边直接显示）。"""
    try:
        value = float(size)
    except (TypeError, ValueError):
        return '0 B'
    for unit, step in (('TB', 1024 ** 4), ('GB', 1024 ** 3), ('MB', 1024 ** 2), ('KB', 1024)):
        if value >= step:
            return f'{value / step:.2f}'.rstrip('0').rstrip('.') + ' ' + unit
    return f'{int(value)} B'


def asset_storage_bytes(asset):
    """一条素材实际占用的字节数。

    ★ 落盘素材（有 `mediaId`）按**文件真实大小**算。
    ★ 内联 base64 按**解码后**体积算 —— base64 有 4/3 膨胀，直接 `len()` 会虚高 33%，
      用户会觉得「没传多少就满了」。
    """
    media_id = str((asset or {}).get('mediaId') or '').strip()
    if media_id:
        path = resolve_media_file(media_id)
        if path:
            try:
                return path.stat().st_size
            except OSError:
                return 0
    data = (asset or {}).get('data')
    if isinstance(data, str) and data.startswith('data:'):
        _, _, payload = data.partition(',')
        return max(0, len(payload) * 3 // 4)
    return 0


def user_storage_usage(user_id):
    """该用户已用字节数 = 素材行（按 `ownerId`）+ **自己私有的角色卡素材**（r796）。

    ★ 官方角色库的内容**不计入**（用户明确要求）—— 那是平台资产，不是用户上传的素材。
    """
    if not user_id:
        return 0
    if globals().get('ACCOUNT_STORAGE'):
        ACCOUNT_STORAGE.sync()
        return ACCOUNT_STORAGE.used(user_id)
    assets = sum(asset_storage_bytes(item) for item in read_assets() if item.get('ownerId') == user_id)
    return assets + user_role_storage_bytes(user_id)


def user_storage_view(user_id):
    """给前端「我的素材」页用的配额视图。"""
    used = user_storage_usage(user_id)
    limit = ACCOUNT_STORAGE.quota(user_id) if globals().get('ACCOUNT_STORAGE') else USER_STORAGE_QUOTA_BYTES
    owned = [item for item in read_assets() if item.get('ownerId') == user_id]
    role_used = user_role_storage_bytes(user_id)
    mine_roles = scoped_preset_roles('mine', user_id) if user_id else {'custom': [], 'overrides': {}}
    return {
        'used': used,
        'limit': limit,
        'remaining': max(0, limit - used),
        'percent': round(min(100.0, used * 100.0 / limit), 2) if limit else (100.0 if used else 0.0),
        'over': used > limit,
        'usedLabel': human_bytes(used),
        'limitLabel': human_bytes(limit),
        'assetCount': len(owned),
        # 角色卡素材单独报一份：前端「我的素材」页可以据此解释占用来源。
        'roleUsed': role_used,
        'roleUsedLabel': human_bytes(role_used),
        'roleCount': len(mine_roles['custom']) + len(mine_roles['overrides'] or {}),
    }


def media_referenced_by(media_id, assets=None, projects=None):
    """这个落盘文件还有谁在用？返回引用方描述列表，空列表 = 可以安全删除（r686）。

    两条引用路径都要查，漏一条就会删掉别人正在用的图：
      ① 素材表：`asset['mediaId']`
      ② 项目快照：节点上的 `previewMedia` / `videoUrl`（`/media/<file>`）
         —— 「Agent 生成的图」只走这条，**不建素材行**，只查素材表会误删。
    """
    media_id = str(media_id or '').strip()
    if not media_id:
        return []
    needle = f'/media/{media_id}'
    refs = []
    def contains(value):
        if isinstance(value, dict):
            return any((key == 'mediaId' and child == media_id) or contains(child) for key, child in value.items())
        if isinstance(value, list):
            return any(contains(child) for child in value)
        if not isinstance(value, str):
            return False
        # Scene JSON, covers, audio tracks and nested material textures all count.
        if re.search(re.escape(needle) + r'''(?=$|[?#\s"'<>\\),;\]}])''', value):
            return True
        if value.lstrip().startswith(('{', '[')):
            try: return contains(json.loads(value))
            except (ValueError, TypeError, RecursionError): pass
        return False
    for asset in (read_assets() if assets is None else assets):
        if contains(asset):
            refs.append(f"素材 {asset.get('id')}")
    directory=globals().get('DATA_DIR')
    if directory is not None:
        for workspace,bucket in read_file(directory/'workspace-materials.json',{}).items():
            if contains(bucket):refs.append(f'素材管理 {workspace}')
    for item in read_music()+read_models():
        if contains(item):
            refs.append(f"社区分享 {item.get('id')}")
    library = globals().get('PREVIS_ASSETS')
    if library:
        for asset in library.records():
            if contains(asset):
                refs.append(f"3D 资产 {asset.get('id')}")
    bridge=globals().get('BLENDER_BRIDGE')
    if bridge:
        for path in bridge.directory.glob('blend-*/job.json'):
            if contains(bridge._read(path).get('asset')):refs.append('Blender model revision '+path.parent.name)
    portfolio = globals().get('PORTFOLIO')
    if portfolio:
        for work in portfolio.rows():
            if contains(work): refs.append(f"作品集 {work.get('id')}")
    for project in (read_projects() if projects is None else projects):
        if contains(project):
            refs.append(f"项目 {project.get('id')}")
    # Background jobs and public snapshots may outlive a removed canvas node.
    for reader_name in ('read_agent_sessions', 'read_agent_shares'):
        reader = globals().get(reader_name)
        if reader:
            for item in reader():
                if contains(item): refs.append(f"对话/分享 {item.get('id')}")
    jobs_file = globals().get('JOBS_FILE')
    if jobs_file and jobs_file.exists():
        with jobs_file.open(encoding='utf-8') as stream:
            for line in stream:
                try:
                    item = json.loads(line)
                    if contains(item): refs.append(f"生成任务 {item.get('id')}")
                except (ValueError, AttributeError): continue
    return list(dict.fromkeys(refs))

def delete_media_file(media_id):
    """删掉落盘文件。文件不存在 / 名字不合法都返回 False，不抛。"""
    target = resolve_media_file(media_id)
    if not target:
        return False
    try:
        target.unlink()
        return True
    except OSError:
        return False


def purge_media_if_unused(media_id):
    """没人再引用了就删掉落盘文件（r686）。返回 (是否删除, 剩余引用描述)。"""
    refs = media_referenced_by(media_id)
    if refs:
        return False, refs
    return delete_media_file(media_id), []


# 供应商成片落盘：超时和上限都留够余量（视频动辄几十上百 MB），但**必须封顶**，
# 否则一个异常大的响应会把内存吃光 —— 本机自用也不该被供应商拖死。
MEDIA_FETCH_TIMEOUT = 180
MEDIA_FETCH_MAX_BYTES = 250_000_000


def persist_media_url(url, mime='', name=''):
    """把**远程媒体地址**下载到本地 media/ 目录，返回 save_media_blob 那种 dict。

    为什么需要它：生成的视频原本只在 job/节点里存供应商给的地址，而**那是会过期的**
    （云存储临时链接、签名链）。过期后画布上视频不可恢复、分享链接变死链。
    落盘一次就变成我们自己的 /media/<file>，永久可播。

    设计成「纯函数 + 只抛 ValueError」：调用方自己决定失败怎么降级，
    不要因为「存不下来」就把整个生成任务判成失败 —— 视频其实已经生成好了。

    **接对象存储时只需替换这一个函数体**（改成 put_object + 返回 CDN 地址），
    调用方一行都不用动。这就是现在不接 OSS 也能先把链路打通的原因。
    """
    url = str(url or '').strip()
    if not url:
        raise ValueError('空地址')
    if url.startswith('/media/'):
        # 已经是本地地址，幂等返回，别重复下载
        name=urlparse(url).path.rsplit('/',1)[-1]
        query=parse_qs(urlparse(url).query)
        if globals().get('ACCOUNT_STORAGE') and STORAGE_ACTOR.get() and not ACCOUNT_STORAGE.can_read(name,STORAGE_ACTOR.get(),str((query.get('signature') or [''])[0]),str((query.get('expires') or [''])[0])):
            raise ValueError('媒体文件已过期或当前账户没有访问权限')
        existing = resolve_media_file(name)
        if existing:
            return {'mediaId': existing.name, 'url': url,
                    'kind': media_kind_of('', existing.name), 'size': existing.stat().st_size}
        raise ValueError('本地媒体文件不存在')
    if url.startswith('data:'):
        header, _, encoded = url.partition(',')
        try:
            raw = base64.b64decode(encoded, validate=False) if ';base64' in header else unquote(encoded).encode('utf-8')
        except (binascii.Error, ValueError) as exc:
            raise ValueError(f'内联数据解码失败：{exc}') from exc
        if header.startswith('data:') and ';' in header:
            mime = mime or header[5:].split(';', 1)[0]
    else:
        request = urllib_request.Request(url, headers={
            'Accept': '*/*', 'User-Agent': 'CanvasFlow/1.0',
        })
        try:
            with open_http_url(request, timeout=MEDIA_FETCH_TIMEOUT) as response:
                declared = response.headers.get('Content-Length')
                if declared and declared.isdigit() and int(declared) > MEDIA_FETCH_MAX_BYTES:
                    raise ValueError(f'远端文件超过 {MEDIA_FETCH_MAX_BYTES // 1_000_000}MB 上限')
                mime = mime or (response.headers.get_content_type() or '')
                # 按 1MB 分块读，边读边封顶 —— 不要 read() 一次性拿到内存里，
                # 供应商返回一个「没有 Content-Length 的无限流」会直接把内存吃穿。
                chunks, total = [], 0
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    total += len(chunk)
                    if total > MEDIA_FETCH_MAX_BYTES:
                        raise ValueError(f'远端文件超过 {MEDIA_FETCH_MAX_BYTES // 1_000_000}MB 上限')
                    chunks.append(chunk)
                if declared and declared.isdigit() and total != int(declared):
                    raise ValueError('远端媒体响应长度不完整，请重新下载')
                raw = b''.join(chunks)
        except (urllib_error.URLError, OSError, ValueError, IncompleteRead) as exc:
            if isinstance(exc, ValueError):
                raise
            raise ValueError(f'下载远端媒体失败：{exc}') from exc
    if not raw:
        raise ValueError('远端媒体内容为空')
    suffix = Path(urlparse(url).path).suffix or name
    return save_media_blob(raw, mime, name or suffix)


def persist_job_video(job):
    """把 job 上的供应商视频地址就地换成落盘后的 /media/ 地址。

    返回 True 表示发生了替换。失败**只记一笔**（`videoPersistError`），
    保留原地址继续可用 —— 供应商链接也许还能撑几天，但至少用户当场看得到。
    """
    url = str(job.get('videoUrl') or '').strip()
    if not url:
        return False
    # 已经是本地地址：**先确认文件真的在**。
    # 直接 return False 会把「指向一个不存在的本地文件」当成「已经落好了」——
    # 那种情况下用户看到的是一个永远播不出来的视频，而且还不报错。
    if url.startswith('/media/'):
        if resolve_media_file(url.rsplit('/', 1)[-1]):
            return False
        job['videoPersistError'] = '本地媒体文件已丢失'
        return False
    try:
        saved = persist_media_url(url, name=f"{job.get('id') or 'video'}.mp4")
    except ValueError as exc:
        job['videoPersistError'] = str(exc)[:300]
        return False
    job['videoUrl'] = saved['url']
    job['mediaId'] = saved['mediaId']
    job.pop('videoPersistError', None)
    return True


def persist_job_image(job):
    """把 job 上的图片（data URI 或供应商地址）落盘成 /media/ 直链。

    与 persist_job_video 同构：失败只记一笔 `imagePersistError`，不把任务判死
    （图确实生成好了，只是没存下来）。落盘后 job['imageUrl'] 是稳定的本地地址，
    前端直接 fetch 成 data URI 写节点。
    """
    source = str(job.get('imageData') or job.get('imageUrl') or '').strip()
    if not source:
        return False
    if source.startswith('/media/'):
        if resolve_media_file(source.rsplit('/', 1)[-1]):
            return False
        job['imagePersistError'] = '本地媒体文件已丢失'
        return False
    try:
        saved = persist_media_url(source, name=f"{job.get('id') or 'image'}.png")
    except ValueError as exc:
        job['imagePersistError'] = str(exc)[:300]
        return False
    job['imageUrl'] = saved['url']
    job['mediaId'] = saved['mediaId']
    job.pop('imageData', None)
    job.pop('imagePersistError', None)
    return True


def persist_job_audio(job):
    """把 job 上的音频（data URI 或供应商地址）落盘成 /media/ 直链。

    与 persist_job_image / persist_job_video 同构：失败只记一笔 `audioPersistError`，
    不把任务判死（音频确实生成好了，只是没存下来）。
    """
    source = str(job.get('audioData') or job.get('audioUrl') or '').strip()
    if not source:
        return False
    if source.startswith('/media/'):
        if resolve_media_file(source.rsplit('/', 1)[-1]):
            return False
        job['audioPersistError'] = '本地媒体文件已丢失'
        return False
    try:
        saved = persist_media_url(source, name=f"{job.get('id') or 'audio'}.mp3")
    except ValueError as exc:
        job['audioPersistError'] = str(exc)[:300]
        return False
    job['audioUrl'] = saved['url']
    job['mediaId'] = saved['mediaId']
    job.pop('audioData', None)
    job.pop('audioPersistError', None)
    return True


def media_data_uri(media_id):
    """把 media/ 下的文件读成 data URI。文件不在就返回空串（不抛）。"""
    target = resolve_media_file(str(media_id or '').strip())
    if not target:
        return ''
    try:
        raw = target.read_bytes()
    except OSError:
        return ''
    mime = mimetypes.guess_type(target.name)[0] or 'application/octet-stream'
    encoded = base64.b64encode(raw).decode('ascii')
    return f'data:{mime};base64,{encoded}'


# ---------------------------------------------------------------- 存量内联素材迁移
INLINE_DATA_URI = re.compile(r'^data:([^;,]+);base64,(.*)$', re.S)


def decode_data_uri(data):
    """把 data URI 解成 (mime, raw)；不是 base64 data URI 或解不出来就返回 (None, None)。

    迁移脚本和素材写库共用这一份，避免两处解码逻辑漂移。
    """
    if not isinstance(data, str) or not data.startswith('data:'):
        return None, None
    match = INLINE_DATA_URI.match(data)
    if not match:
        return None, None
    try:
        raw = base64.b64decode(match.group(2))
    except Exception:  # noqa: BLE001
        return None, None
    return (match.group(1), raw) if raw else (None, None)



def migrate_inline_assets(dry_run=True, limit=0):
    """把素材表里的内联 base64 搬到 server-data/media/，素材行只留 {mediaId, mediaUrl}。

    为什么要做：assets.json 已经一百多 MB，而 read_assets() 有 8 处调用 —— 每次都要全量解析；
    而且单条内联上限 5,000,000 字符，超限时**既不存也不报错**（用户看到永远打不开的空卡）。

    安全性：
      - 幂等（已有 mediaId 的跳过），可反复跑；
      - **先落盘、再逐字节对账（SHA-256），一致才删内联 data**；任何一步失败都原样保留并记进 errors；
      - dry_run=True 只盘点不写盘。
    """
    with LOCK:
        assets = read_assets()
        report = {
            'dryRun': bool(dry_run), 'total': len(assets), 'inline': 0, 'migrated': 0, 'skipped': [],
            'errors': [], 'alreadyMigrated': 0, 'bytesMoved': 0,
            'emptyPreview': sum(1 for a in assets if a.get('hasPreview') and not a.get('data') and not a.get('mediaId')),
        }
        targets = []
        for asset in assets:
            if asset.get('mediaId'):
                report['alreadyMigrated'] += 1
                continue
            data = asset.get('data')
            if isinstance(data, str) and data.startswith('data:'):
                targets.append(asset)
        report['inline'] = len(targets)
        if limit:
            targets = targets[:limit]
        for asset in targets:
            asset_id = asset.get('id')
            mime, raw = decode_data_uri(asset['data'])
            if not raw:
                report['skipped'].append({'id': asset_id, 'reason': '不是可解析的 base64 data URI'})
                continue
            if len(raw) > MEDIA_MAX_BYTES:
                report['skipped'].append({'id': asset_id, 'reason': f'超过落盘上限（{len(raw)} 字节）'})
                continue
            if dry_run:
                report['migrated'] += 1
                report['bytesMoved'] += len(raw)
                continue
            try:
                blob = save_media_blob(raw, mime, str(asset.get('name') or ''), owner_id=asset.get('ownerId') or '')
            except Exception as exc:  # noqa: BLE001
                report['errors'].append({'id': asset_id, 'reason': f'落盘失败：{exc}'})
                continue
            path = MEDIA_DIR / blob['mediaId']
            # ★ 逐字节对账：落盘内容和原内联内容必须完全一致，否则绝不删内联 data
            try:
                same = path.exists() and hashlib.sha256(path.read_bytes()).digest() == hashlib.sha256(raw).digest()
            except OSError as exc:
                same = False
                report['errors'].append({'id': asset_id, 'reason': f'回读失败：{exc}'})
                continue
            if not same:
                report['errors'].append({'id': asset_id, 'reason': '落盘校验不一致，已保留内联 data'})
                continue
            asset['mediaId'] = blob['mediaId']
            asset['mediaUrl'] = blob['url']
            asset.pop('data', None)
            report['migrated'] += 1
            report['bytesMoved'] += len(raw)
        if not dry_run and report['migrated']:
            # ★ 动真格之前先备份（数据迁移的底线）：assets.json.bak-inline-migration-<时间戳>
            stamp = time.strftime('%Y%m%d-%H%M%S')
            backup = ASSETS_FILE.with_name(f'assets.json.bak-inline-migration-{stamp}')
            try:
                shutil.copyfile(ASSETS_FILE, backup)
                report['backup'] = backup.name
            except OSError as exc:
                # 备份失败就不动数据 —— 宁可这次不迁，也不能没有退路
                report['errors'].append({'id': '', 'reason': f'备份失败，已放弃迁移：{exc}'})
                return report
            write_file(ASSETS_FILE, assets)
        report['assetsFileBytes'] = ASSETS_FILE.stat().st_size if ASSETS_FILE.exists() else 0
        return report


def asset_with_data(asset):
    """给素材补上 `data`（内容），供 `/api/assets/<id>` 与历史选择器消费（r684）。

    有 mediaId 就从磁盘读回来当 data URI；没有就沿用内联的 data。
    **必须返回新 dict，不能就地改** —— 就地改会把这个临时拼出来的几 MB base64
    写回 assets.json，等于白折腾。
    """
    view = dict(asset)
    if not view.get('data') and view.get('mediaId'):
        uri = media_data_uri(view['mediaId'])
        if uri:
            view['data'] = uri
    return view


def read_music():
    value = read_file(MUSIC_FILE, DEFAULT_MUSIC)
    return value if isinstance(value, list) and value else clone(DEFAULT_MUSIC)


def write_music(items):
    write_file(MUSIC_FILE, items if isinstance(items, list) else [])


# 订阅套餐（r908）：管理后台可增删改，弹窗 / 套餐管理共用同一份数据。
DEFAULT_SUBSCRIPTION_PLANS = [
    {'id': 'free', 'note': '免费版', 'price': 0, 'popular': False,
     'features': ['注册赠 500 积分', '基础视频模型', '标准清晰度导出', '社区分享与素材库']},
    {'id': 'pro', 'note': '专业版', 'price': 39, 'popular': True,
     'features': ['每月发放 600 积分', '全部视频模型', '高清无水印导出', '生成优先队列']},
    {'id': 'max', 'note': '旗舰版', 'price': 99, 'popular': False,
     'features': ['每月发放 1800 积分', '含专业版全部权益', '4K 导出与批量生成', '专属客服支持']},
]


def read_subscription_plans():
    # ★ 空表是合法状态（管理员把套餐删光了）：只在文件不存在（read_file 已回种默认）或
    #   内容损坏不是列表时才用默认值打底。旧逻辑「空了就回种默认」有两个恶果：
    #   ① 删光套餐变成不可能 —— 刷新后 3 个默认套餐又回来了；
    #   ② 空表上任何一次编辑/新增都会先把默认值克隆整体写回文件，
    #      管理后台的增删改表现为「怎么改，刷新都还原」。
    value = read_file(SUBSCRIPTION_PLANS_FILE, DEFAULT_SUBSCRIPTION_PLANS)
    if not isinstance(value, list):
        return clone(DEFAULT_SUBSCRIPTION_PLANS)
    return value


def write_subscription_plans(items):
    write_file(SUBSCRIPTION_PLANS_FILE, items if isinstance(items, list) else [])


def plan_public(item):
    try:
        price = max(0, int(item.get('price') or 0))
    except (TypeError, ValueError):
        price = 0
    features = [str(f).strip()[:80] for f in (item.get('features') or []) if str(f).strip()][:8]
    return {
        'id': str(item.get('id') or ''),
        'note': str(item.get('note') or '未命名套餐')[:40],
        'price': price,
        'popular': bool(item.get('popular')),
        'features': features,
    }


def plan_from_payload(payload, *, plan_id=None):
    note = str(payload.get('note') or '').strip()[:40]
    if not note:
        return None, {'error': 'invalid_note', 'message': '请填写套餐名称'}, 400
    try:
        price = max(0, int(payload.get('price') or 0))
    except (TypeError, ValueError):
        return None, {'error': 'invalid_price', 'message': '月费必须是不小于 0 的整数'}, 400
    raw_features = payload.get('features')
    if isinstance(raw_features, str):
        raw_features = raw_features.splitlines()
    features = [str(f).strip()[:80] for f in (raw_features or []) if str(f).strip()][:8]
    plan = {'id': plan_id or f"plan-{uuid.uuid4().hex}", 'note': note, 'price': price,
            'popular': bool(payload.get('popular')), 'features': features}
    return plan, None, None


DEFAULT_MODELS = [
    {'id': 'model-cinematic-night', 'name': '电影感城市夜景', 'description': '适合霓虹夜景、雨夜街头与电影感片头的画面风格。', 'createdAt': '2026-08-28T09:30:00+00:00', 'uses': 12, 'ownerId': 'user-canvasflow', 'ownerName': 'CanvasFlow 社区', 'ownerAvatar': '◈', 'shared': True},
    {'id': 'model-soft-product', 'name': '柔光产品特写', 'description': '适合护肤品、饮品等商业产品的柔光特写风格。', 'createdAt': '2026-08-26T14:00:00+00:00', 'uses': 7, 'ownerId': 'user-mori', 'ownerName': 'Mori Sound', 'ownerAvatar': 'M', 'shared': True},
]


def read_models():
    value = read_file(MODELS_FILE, DEFAULT_MODELS)
    return value if isinstance(value, list) else []


def write_models(items):
    write_file(MODELS_FILE, items if isinstance(items, list) else [])


from previs_assets import PrevisAssetStore
PREVIS_ASSETS = PrevisAssetStore(DATA_DIR, read_file, write_file, read_models, write_models, lambda: now())


def publish_blender_asset(job, directory, info):
    from file_formats import validate_model_file
    model=directory/'model.glb'
    validate_model_file(model)
    media=save_media_blob(model.read_bytes(),'model/gltf-binary',job['name']+'.glb',owner_id=LOCAL_ID)
    preview=save_media_blob((directory/'preview.png').read_bytes(),'image/png',job['name']+'.png',owner_id=LOCAL_ID)
    with LOCK:
        return PREVIS_ASSETS.create({**LOCAL_CONTEXT,'workspaceId':job['workspaceId']},{
            'name':job['name'],'description':'Blender 本地建模 · '+str(info['objectCount'])+' 个部件 · 可继续编辑源工程',
            'thumbnail':preview['url'],'object':{'kind':'geometry','geometryType':'model','local':True,
                'modelUrl':media['url'],'blenderJobId':job['id'],
                'transform':{'position':[0,0,0],'rotation':[0,0,0],'scale':[1,1,1]}}})


BLENDER_BRIDGE = BlenderBridge(ROOT, DATA_DIR, publish_blender_asset)
from platform_notifications import NotificationStore, NotificationError
PLATFORM_NOTIFICATIONS = NotificationStore(DATA_DIR / 'platform-notifications.json', read_file, write_file, LOCK, lambda: now())
from portfolio import PortfolioStore, PortfolioError
PORTFOLIO = PortfolioStore(DATA_DIR / 'portfolio.json', read_file, write_file, LOCK, read_projects, read_assets, read_music, lambda: now())
from community_favorites import collect_favorites
from file_formats import validate_asset_media


def community_favorites_payload(user_id):
    payload = social_attach_likes({
        'projects':[item for item in read_projects() if item.get('shared')],
        'assets':[item for item in read_assets() if item.get('shared') or item.get('ownerId')==user_id],
        'music':[item for item in read_music() if item.get('shared',True)],
        'models':[item for item in read_models() if item.get('shared') or item.get('ownerId')==user_id],
    },user_id)
    return {'favorites':collect_favorites(payload,social_liked_set(user_id),PREVIS_ASSETS.favorites(user_id))}

from community_sharing import prepare_share, CommunityShareError
from previs_sharing import PrevisSharing, ShareDenied
PREVIS_SHARING = PrevisSharing(DATA_DIR,read_file,write_file,read_projects,lambda:now())


# ===== AI 模型接入注册表：管理员在后台维护各厂模型（密钥只存服务端，永不下发浏览器）=====
AI_MODELS_FILE = DATA_DIR / 'ai-models.json'
# ===== 画布「登记表」（规格表）：由「模型管理」面板维护，画布按它渲染选项面板 =====
# 三类：`audio`（按上游模型名索引的规格行）/ `video`（全局的生成规格）/ `camera`（摄像机库四组）。
# ★ 与 `ai-models.json` **分开存**：那个文件被多处依赖、结构不能动；这份只回答「面板长什么样」。
# ★ 从前端 `app.js` 的 AUDIO_SPEC_SCHEMAS / VIDEO_SPEC_* 与 `camera-library.js` 迁入（2026-09-25）。
MODEL_SPECS_FILE = DATA_DIR / 'model-specs.json'
# 供应商 LOGO 内联上限（约 300KB 字符）：前端缩到 128px 后通常只有 10~30KB，
# 留足余量即可；超限直接丢弃而不是截断 —— 截断的 base64 是永远打不开的坏图。
LOGO_MAX_CHARS = 300_000



PROVIDER_PROFILE_ORDER = ('openai-standard', 'grok2api')
PROVIDER_PROFILES = set(PROVIDER_PROFILE_ORDER)
# 参考文件传输方式：勾选供应商支持的方式，实际发送时按这个次序挑第一个可用的。
REFERENCE_MODE_ORDER = ('data-url', 'file-upload', 'public-url')
REFERENCE_MODES = set(REFERENCE_MODE_ORDER)
REFERENCE_KIND_ORDER = ('image', 'video', 'audio')
REFERENCE_KINDS = set(REFERENCE_KIND_ORDER)
DEFAULT_FILE_UPLOAD_PATH = '/v1/files/upload'
# 模型行的请求形态：决定这个模型走哪条调用路径。
# ★★ `media-generate`（2026-09-25 加）：走平台的**统一媒体端点** `POST /v1/media/generate`。
#   与图片那边的 `imageTransport == media-generate` 是同一套实现、两个入口 ——
#   音频模型没有「图片传输合同」这个字段（它只对 t2i 有意义），所以音频用「请求形态」这条路。
REQUEST_PROFILE_ORDER = ('auto', 'chat-image', 'async-video-task', 'openai-audio-speech',
                         'openai-audio-generation', 'media-generate', 'zhongheng-video', 'sanyuan-video')
REQUEST_PROFILES = set(REQUEST_PROFILE_ORDER)
# 生成端点的任务模式：同步（提交即回结果）/ 异步（提交后轮询查询接口）
GENERATION_MODES = {'sync', 'async'}


def normalize_enum_list(value, order):
    """把前端传来的数组收敛成「白名单内、去重、按固定次序」的列表。

    顺序很重要：参考文件传输方式要按 data-url → file-upload → public-url 的固定优先级挑，
    不能听前端的顺序，否则同一次配置在不同客户端上会发不同的请求体。
    """
    allowed = set(order)
    if isinstance(value, str):
        raw = [part.strip() for part in value.split(',')]
    elif isinstance(value, (list, tuple)):
        raw = [str(part).strip() for part in value]
    else:
        raw = []
    picked = {part for part in raw if part in allowed}
    return [part for part in order if part in picked]
AI_MODEL_TYPES = {'i2t': '图生文', 't2i': '图片生成', 'video': '视频生成', 'tts': '文字转语音'}

# 计费方式（r864）。**用户明确要求区分并标明**：同一家的 `tt-image-2.5`（按次）与
# `tt-image-2.5-token`（按 Token 计费）是两个不同模型，扣费方式与额度完全不同。
BILLING_MODES = ('per-call', 'per-token', 'per-second')


def infer_billing(model_id):
    """按模型 id 的**命名约定**推断计费方式。

    · `-token` 后缀 → 按 Token 计费（平台自己的写法，如 `tt-image-2.5-token`）；
    · `-anmiao` / 「按秒」→ 按秒计费（视频类，如 `seedance-2.5-anmiao`）；
    · 其余 → 按次计费。
    ★ 推断结果会写进模型行，管理员可在面板里改（`billing` 字段）；不要在这里写死 UI 文案。
    """
    value = str(model_id or '').strip().lower()
    if value.endswith('-token') or '-token-' in value or value.endswith('_token'):
        return 'per-token'
    if value.endswith('-anmiao') or '-anmiao-' in value or '按秒' in value:
        return 'per-second'
    return 'per-call'


# ===== 模型定价（r884，用户需求）=====
# 「偏好设置 · 模型定价」里从**主供应商**逐个模型定价，支持 按次 / 按 Token / 按秒 三种口径。
# ★★★ 这里是**唯一**的价格结构定义 —— 加字段必须同步三处白名单（本项目踩过多次静默丢弃）：
#   ① `normalize_ai_model`（保存闸门）② `ai_model_public`（后台读）③ `/api/ai/models` 内联 `model_payload`（画布读）。
MODEL_PRICING_FIELDS = ('perCall', 'inputPer1k', 'outputPer1k', 'perSecond', 'cacheReadPer1k', 'cacheWritePer1k', 'longInputPer1k', 'longOutputPer1k', 'longCacheReadPer1k', 'longCacheWritePer1k')
# 单价上限：护栏，防误填把一次生成扣成天文数字（管理员仍可改，只是被夹在区间内）。
MODEL_PRICE_MAX = 1000000.0


def _price_number(value):
    try:
        number = float(value)
    except (TypeError, ValueError):
        return 0.0
    if number != number or number in (float('inf'), float('-inf')):   # NaN / ±Inf
        return 0.0
    return round(max(0.0, min(MODEL_PRICE_MAX, number)), 10)


def normalize_model_pricing(value):
    """价格结构白名单。**统一返回四种口径的完整结构**（没选中的那些是 0）——
    前端不用再猜哪个键存在，这正是本项目「多处白名单」教训的正面用法。

    · `perCall`     —— 按次：每次调用多少积分
    · `inputPer1k`  —— 按 Token：每 1000 输入 token 多少积分
    · `outputPer1k` —— 按 Token：每 1000 输出 token 多少积分
    · `perSecond`   —— 按秒：每秒多少积分
    · `precharge`   —— 上游是否「先预扣、生成完多退少补」（按 Token 口径默认开）
    · `note`        —— 备注（写清上游计费口径）
    """
    raw = value if isinstance(value, dict) else {}
    out = {field: _price_number(raw.get(field)) for field in MODEL_PRICING_FIELDS}
    out['precharge'] = bool(raw.get('precharge', True))
    out['note'] = str(raw.get('note') or '').strip()[:200]
    out['updatedAt'] = str(raw.get('updatedAt') or '')[:40]
    return out


def model_pricing(item):
    item = item if isinstance(item, dict) else {}
    return normalize_model_pricing(item.get('pricing'))


def pricing_is_set(pricing, billing=''):
    """这个模型到底定没定价 —— 三种口径各自看自己那个键。

    ★ 全 0 = **未定价 = 完全不扣费**（不是「扣 0 积分」）：不给没配价格的模型凭空写流水。
    """
    mode = billing if billing in BILLING_MODES else 'per-call'
    if mode == 'per-token':
        return (pricing.get('inputPer1k') or 0) > 0 or (pricing.get('outputPer1k') or 0) > 0
    if mode == 'per-second':
        return (pricing.get('perSecond') or 0) > 0
    return (pricing.get('perCall') or 0) > 0



MODEL_USAGE_ORDER = ('text', 'image', 'video', 'audio')
MODEL_USAGE_LABELS = {'text': '语言', 'image': '图像', 'video': '视频', 'audio': '音频'}
USAGE_TO_TYPE = {'text': 'i2t', 'image': 't2i', 'video': 'video', 'audio': 'tts'}
TYPE_TO_USAGE = {value: key for key, value in USAGE_TO_TYPE.items()}


def normalize_usages(value, fallback_type=''):
    """用途集合白名单。空集合回落到单一 type（老记录零迁移）。"""
    raw = value if isinstance(value, (list, tuple, set)) else []
    wanted = {str(item).strip() for item in raw}
    out = [usage for usage in MODEL_USAGE_ORDER if usage in wanted]
    if not out:
        legacy = TYPE_TO_USAGE.get(str(fallback_type or '').strip())
        out = [legacy] if legacy else []
    return out


def model_usages(item):
    return normalize_usages(item.get('usages'), item.get('type'))


def model_has_usage(item, kind):
    """kind 既接受用途名（text/image/video/audio）也接受老类别名（i2t/t2i/...）。"""
    key = str(kind or '').strip()
    target = TYPE_TO_USAGE.get(key, key)
    return target in model_usages(item)


def model_param_defaults(item):
    """给前端用的「默认参数」：只带非空值，且**不含任何密钥/供应商机密**。

    前端在用户选中某个模型时把它写进生成设置（图片的比例/分辨率/质量/数量、视频的模式/时长等）。
    """
    params = normalize_model_params(item.get('modelParams'))
    out = {}
    image = {key: value for key, value in params['image'].items() if key != 'transport' and value}
    if image:
        out['image'] = image
    video = {key: value for key, value in params['video'].items() if value}
    if video:
        out['video'] = video
    if params['text'].get('multimodal'):
        out['text'] = {'multimodal': True}
    return out


def model_supports_vision(item):
    """能不能吃图片（图生文）。

    老记录：type == 'i2t' 本身就是视觉模型。
    新记录：用途里勾了「语言」，并且参数能力里勾了「多模态」。
    ★ 注意别用 model_has_usage(item, 'i2t') 代替 —— i2t 在用途映射里等于 text，
      那样所有聊天模型都会被当成视觉模型（usages 重构时踩过）。
    """
    if not model_has_usage(item, 'text'):
        return False
    if str(item.get('type') or '').strip() == 'i2t':
        return True
    params = item.get('modelParams') if isinstance(item.get('modelParams'), dict) else {}
    text_params = params.get('text') if isinstance(params.get('text'), dict) else {}
    return bool(text_params.get('multimodal'))




MODEL_PARAM_SPEC = {
    'text': {'multimodal': 'bool'},
    'image': {'transport': 'transport', 'aspectRatio': ('text', 20), 'resolution': ('text', 20),
              'quality': ('text', 20), 'count': ('text', 4)},
    # ★ r872：`durationSteps` = 「可用档位」（逗号串，如 "4,8,12"）。上游只认固定档的模型靠它锁档。
    #   ★★★ 这个白名单是**字段闸门**：加字段不同步这里 = 静默丢弃（存进去、读出来就没了）。
    #   长度给 240 是为了装下 1~30 全档（"1,2,3,...,30" ≈ 110 字符），留足余量。
    'video': {'minDuration': ('text', 12), 'maxDuration': ('text', 12), 'durationSteps': ('text', 240),
              'aspectRatio': ('text', 20), 'resolution': ('text', 12), 'mode': ('text', 24), 'duration': ('text', 12)},
    'audio': {'requestProfile': ('enum', REQUEST_PROFILE_ORDER)},
}


def normalize_model_params(value):
    raw = value if isinstance(value, dict) else {}
    out = {}
    for usage, spec in MODEL_PARAM_SPEC.items():
        incoming = raw.get(usage) if isinstance(raw.get(usage), dict) else {}
        bucket = {}
        for field, rule in spec.items():
            if rule == 'bool':
                bucket[field] = bool(incoming.get(field))
            elif rule == 'transport':
                bucket[field] = normalize_image_transport(incoming.get(field)) or ''
            elif isinstance(rule, tuple) and rule[0] == 'enum':
                bucket[field] = incoming.get(field) if incoming.get(field) in rule[1] else ''
            else:
                bucket[field] = str(incoming.get(field) or '').strip()[:rule[1]]
        out[usage] = bucket
    return out



DEFAULT_AI_MODELS = [
    {'id': 'qwen-vl-max', 'name': '通义千问 VL Max', 'provider': '阿里云百炼', 'type': 'i2t', 'baseUrl': 'https://dashscope.aliyuncs.com/compatible-mode/v1', 'model': 'qwen-vl-max'},
    {'id': 'qwen-vl-plus', 'name': '通义千问 VL Plus', 'provider': '阿里云百炼', 'type': 'i2t', 'baseUrl': 'https://dashscope.aliyuncs.com/compatible-mode/v1', 'model': 'qwen-vl-plus'},
    {'id': 'glm-4v-plus', 'name': '智谱 GLM-4V Plus', 'provider': '智谱 BigModel', 'type': 'i2t', 'baseUrl': 'https://open.bigmodel.cn/api/paas/v4', 'model': 'glm-4v-plus'},
    {'id': 'doubao-vision-pro', 'name': '豆包视觉 Pro', 'provider': '火山方舟', 'type': 'i2t', 'baseUrl': 'https://ark.cn-beijing.volces.com/api/v3', 'model': 'doubao-1.5-vision-pro-32k'},
    {'id': 'kimi-vision', 'name': 'Kimi 视觉', 'provider': '月之暗面', 'type': 'i2t', 'baseUrl': 'https://api.moonshot.cn/v1', 'model': 'moonshot-v1-8k-vision-preview'},
    {'id': 'ernie-vision', 'name': '文心 ERNIE-4.5 VL', 'provider': '百度千帆', 'type': 'i2t', 'baseUrl': 'https://qianfan.baidubce.com/v2', 'model': 'ernie-4.5-turbo-vl'},
    {'id': 'openai-gpt-4o-mini', 'name': 'OpenAI GPT-4o mini', 'provider': 'OpenAI', 'type': 'i2t', 'baseUrl': 'https://api.openai.com/v1', 'model': 'gpt-4o-mini'},
    {'id': 'claude-sonnet', 'name': 'Claude Sonnet', 'provider': 'Anthropic', 'type': 'i2t', 'baseUrl': 'https://api.anthropic.com', 'model': 'claude-sonnet-4-5', 'protocol': 'anthropic'},
    {'id': 'claude-haiku', 'name': 'Claude Haiku', 'provider': 'Anthropic', 'type': 'i2t', 'baseUrl': 'https://api.anthropic.com', 'model': 'claude-haiku-4-5', 'protocol': 'anthropic'},
    {'id': 'siliconflow-flux-schnell', 'name': 'FLUX.1 Schnell（快速）', 'provider': '硅基流动', 'type': 't2i', 'baseUrl': 'https://api.siliconflow.cn/v1', 'model': 'black-forest-labs/FLUX.1-schnell'},
    {'id': 'siliconflow-flux-dev', 'name': 'FLUX.1 Dev（精细）', 'provider': '硅基流动', 'type': 't2i', 'baseUrl': 'https://api.siliconflow.cn/v1', 'model': 'black-forest-labs/FLUX.1-dev'},
    {'id': 'siliconflow-sd35', 'name': 'Stable Diffusion 3.5 Large', 'provider': '硅基流动', 'type': 't2i', 'baseUrl': 'https://api.siliconflow.cn/v1', 'model': 'stabilityai/stable-diffusion-3-5-large'},
    {'id': 'openai-gpt-image-1', 'name': 'OpenAI GPT Image 1', 'provider': 'OpenAI', 'type': 't2i', 'baseUrl': 'https://api.openai.com/v1', 'model': 'gpt-image-1'},
    {'id': 'dashscope-wan-2.1', 'name': '通义万相 Wan 2.1', 'provider': '阿里云百炼', 'type': 'video', 'protocol': 'dashscope', 'baseUrl': 'https://dashscope.aliyuncs.com/api/v1', 'model': 'wanx2.1-t2v-turbo'},
    {'id': 'openai-compatible-video', 'name': '通用视频任务 API', 'provider': '自定义供应商', 'type': 'video', 'protocol': 'openai-video', 'baseUrl': 'https://example.com/v1', 'model': 'video-model'},
]
# A new local installation starts with no configured generation models.
DEFAULT_AI_MODELS = []


def read_ai_models():
    value = read_file(AI_MODELS_FILE, DEFAULT_AI_MODELS)
    return constrained_model_entries(value if isinstance(value,list) else DEFAULT_AI_MODELS)


def write_ai_models(items):
    write_file(AI_MODELS_FILE, items if isinstance(items, list) else [])


PREVIS_MODELS_FILE = DATA_DIR / 'previs-models.json'


def previs_models_payload(user):
    """Only publish model metadata from the primary providers, never credentials."""
    stored = read_file(PREVIS_MODELS_FILE, {})
    selected = stored.get('selectedIds', []) if isinstance(stored, dict) else []
    selected = {i for i in selected if isinstance(i, str)} if isinstance(selected, list) else set()
    models = [{'id': m.get('id'), 'name': m.get('name') or m.get('model'),
               'provider': m.get('provider') or '', 'kind': m.get('type') or '',
               'enabled': bool(m.get('enabled')), 'supportsScene': model_has_usage(m, 'text'),
               'checked': m.get('id') in selected}
              for m in read_ai_models() if not model_owner_of(m)]
    return {'models': models, 'canEdit': user.get('role') == 'admin'}


def save_previs_models(value):
    if not isinstance(value, dict): raise ValueError('请选择有效的预演台模型')
    ids = value.get('selectedIds')
    if not isinstance(ids, list) or any(not isinstance(i, str) for i in ids):
        raise ValueError('请选择有效的预演台模型')
    allowed = {m.get('id') for m in read_ai_models() if not model_owner_of(m)}
    selected = list(dict.fromkeys(i for i in ids if i in allowed))
    write_file(PREVIS_MODELS_FILE, {'selectedIds': selected})


# ------------------------------------------------------- 画布登记表（规格表）
# 「模型管理」面板维护的三类数据。**画布不写死任何选项** —— 面板长什么样完全由这份数据决定。
# ★★ 归一化是**白名单**：前端传来的脏结构在这里被收敛，未知字段直接丢弃。
#    加新字段必须同步下面每个分支，否则会被静默丢掉（本项目踩过多次的坑）。
MODEL_SPEC_KINDS = ('audio', 'video', 'camera', 'image')
CAMERA_GROUPS = ('camera', 'lens', 'focal', 'aperture')


def _spec_text(value, limit=200):
    """规格里的文本字段：去空白、限长。None → 空串。"""
    return str(value if value is not None else '').strip()[:limit]


def normalize_spec_option(raw):
    """一个选项 → `{value, label}`；值只允许标量（对象/数组会被上游当成脏值）。"""
    if isinstance(raw, dict):
        if 'value' not in raw:
            return None
        value, label = raw.get('value'), raw.get('label')
    else:
        value, label = raw, None
    if isinstance(value, bool):
        pass
    elif isinstance(value, (int, float)):
        pass
    elif isinstance(value, str):
        value = value.strip()[:80]
        if not value:
            return None
    else:
        return None
    text = _spec_text(label, 60)
    return {'value': value, 'label': text or str(value)}


def normalize_spec_row(raw):
    """一行规格 → `{key, label, field, options, default}`。

    · `key` 必填 —— 没有它这一行取不到值，直接丢弃；
    · `field` = LibTV 的 `originalField`：**面板属性名 ≠ 上游字段名**，缺省时按 `key` 发；
    · `default` 必须落在 options 里，否则取第一项 —— 免得前端把一个上游不认的值发出去。
    """
    if not isinstance(raw, dict):
        return None
    key = _spec_text(raw.get('key'), 60)
    if not key:
        return None
    options = []
    for item in (raw.get('options') if isinstance(raw.get('options'), list) else []):
        option = normalize_spec_option(item)
        if option and not any(option['value'] == seen['value'] for seen in options):
            options.append(option)
    default = raw.get('default')
    if options:
        if not any(option['value'] == default for option in options):
            default = options[0]['value']
    else:
        default = None
    return {'key': key, 'label': _spec_text(raw.get('label'), 40) or key,
            'field': _spec_text(raw.get('field'), 60) or key,
            'options': options, 'default': default}


def normalize_camera_item(raw):
    """摄像机库的一项 → `{key, name, prompt, thumb[, type][, default]}`。"""
    if not isinstance(raw, dict):
        return None
    name = _spec_text(raw.get('name'), 60)
    key = _spec_text(raw.get('key'), 60)
    if not key and not name:
        return None
    if not key:  # 没填 key 就用名字派生一个，保证同组内可寻址
        key = re.sub(r'[^a-z0-9]+', '_', name.lower()).strip('_') or uuid.uuid4().hex[:8]
    item = {'key': key, 'name': name or key, 'prompt': _spec_text(raw.get('prompt'), 600),
            'thumb': _spec_text(raw.get('thumb'), 200)}
    kind = _spec_text(raw.get('type'), 20)
    if kind:
        item['type'] = kind
    if raw.get('default'):
        item['default'] = True
    return item


# ---------------------------------------------------------------- 生成提交规格（登记表 v2）
# 「登记表」按 kind 分四类：audio / image / video / camera。
#   · audio 一直是**按模型**的行式表；
#   · 2026-09-25（r860）起 image / video 也升级成同构结构：
#
#         "image": { "<上游模型名>": [ {key, label, field, options, default}, … ] }
#         "video": { "<上游模型名>": [ … ] }
#
# ★★★ 为什么必须按模型：图片/视频以前是「全局一套比例 / 清晰度 / 数量」，于是
#   **模型专有参数**（如 `tt-image-2.5` 的 `version=flare`、`banana-2` 的 `aspectRatio`）
#   只能靠 `modelParams.mediaParams` 直接改 JSON —— 后台界面看不见、改不了。
#   现在这些都在「偏好设置 · 模型管理」里登记，且**真的进请求体**（见 build_media_spec_params）。
# ★ `'*'` = 未登记模型的**兜底**（迁移前那套全局配置就落在这里）—— 保证行为不突变：
#   某个模型没登记时，画布看到的面板与提交的字段名与升级前逐字一致。
SPEC_WILDCARD = '*'
# 「画布有专门控件」的语义键。行里写这些 key = 接管对应控件；写别的 key = 模型专有参数。
SPEC_SEMANTIC_KEYS = {
    'image': ('aspectRatio', 'resolution', 'quality', 'count'),
    'video': ('aspectRatio', 'resolution', 'duration', 'generateAudio', 'count'),
}
# 旧版（全局一套）结构的特征键 —— 见到它们就说明是迁移前的数据，自动转成 `'*'` 兜底行。
SPEC_LEGACY_KEYS = {
    'image': ('aspectRatios', 'aspectLabels', 'resTiers', 'qualityOptions', 'counts'),
    'video': ('ratios', 'resolutions', 'counts', 'ratioLabels'),
}
# 语义键 → 默认上游字段名（行里显式写了 `field` 就以行为准；这只是迁移时的初值）。
SPEC_SEMANTIC_FIELDS = {
    'image': {'aspectRatio': 'aspectRatio', 'resolution': 'resolution', 'quality': 'quality', 'count': 'n'},
    'video': {'aspectRatio': 'aspectRatio', 'resolution': 'resolution', 'count': 'count',
              'duration': 'duration', 'generateAudio': 'generate_audio'},
}
SPEC_SEMANTIC_LABELS = {
    'image': {'aspectRatio': '画面比例', 'resolution': '清晰度', 'quality': '画质', 'count': '生成数量'},
    'video': {'aspectRatio': '画面比例', 'resolution': '清晰度', 'count': '生成数量',
              'duration': '视频时长', 'generateAudio': '生成音频'},
}


# 「生成数量」这一行的取值域**必须夹住**：改成行式之前它走 `int_list(1, 16)`，
# 若因为换结构就把它放开，`0` / `99` / `'x'` 会被原样发给上游（参数错误，或者一口气生成一堆图）。
SPEC_COUNT_RANGE = (1, 16)


def _spec_option_allowed(key, value):
    if key != 'count':
        return True
    try:
        number = int(value)
    except (TypeError, ValueError):
        return False
    return SPEC_COUNT_RANGE[0] <= number <= SPEC_COUNT_RANGE[1]


def _spec_list_row(key, values, labels, kind):
    """旧版「一个键 → 一组裸值」→ 一行规格。值里的 `label` 优先取旧版的标签表。"""
    options = []
    for item in (values if isinstance(values, list) else []):
        option = normalize_spec_option(item)
        if not option or any(option['value'] == seen['value'] for seen in options):
            continue
        if not _spec_option_allowed(key, option['value']):
            continue
        if key == 'count':
            option['value'] = int(option['value'])   # 数量统一成整数（旧行为）
        text = _spec_text((labels or {}).get(str(option['value'])), 60)
        options.append({'value': option['value'], 'label': text or option['label']})
    if not options:
        return None
    return {'key': key, 'label': SPEC_SEMANTIC_LABELS[kind].get(key, key),
            'field': SPEC_SEMANTIC_FIELDS[kind].get(key, key),
            'options': options, 'default': options[0]['value']}


def legacy_spec_rows(raw, kind):
    """旧版全局结构 → 行式规格（只在迁移/兜底时用一次）。"""
    raw = raw if isinstance(raw, dict) else {}
    if kind == 'image':
        labels = raw.get('aspectLabels') if isinstance(raw.get('aspectLabels'), dict) else {}
        quality = []
        for item in (raw.get('qualityOptions') if isinstance(raw.get('qualityOptions'), list) else []):
            option = normalize_spec_option(item)
            if option and not any(option['value'] == seen['value'] for seen in quality):
                quality.append(option)
        candidates = [
            _spec_list_row('aspectRatio', raw.get('aspectRatios'), labels, 'image'),
            _spec_list_row('resolution', raw.get('resTiers'), {}, 'image'),
            _spec_list_row('count', raw.get('counts'), {}, 'image'),
            {'key': 'quality', 'label': SPEC_SEMANTIC_LABELS['image']['quality'],
             'field': SPEC_SEMANTIC_FIELDS['image']['quality'], 'options': quality,
             'default': quality[0]['value'] if quality else None} if quality else None,
        ]
    else:
        labels = raw.get('ratioLabels') if isinstance(raw.get('ratioLabels'), dict) else {}
        candidates = [
            _spec_list_row('aspectRatio', raw.get('ratios'), labels, 'video'),
            _spec_list_row('resolution', raw.get('resolutions'), {}, 'video'),
            _spec_list_row('count', raw.get('counts'), {}, 'video'),
        ]
    return [row for row in candidates if row]


def normalize_spec_model_map(raw, kind):
    """一类规格归一化成 `{模型名: [行]}`。旧版全局结构 → 落到 `'*'` 兜底。"""
    out = {}
    if not isinstance(raw, dict):
        return out
    if any(key in raw for key in SPEC_LEGACY_KEYS.get(kind, ())):
        rows = legacy_spec_rows(raw, kind)
        if rows:
            out[SPEC_WILDCARD] = rows
        return out
    for model, rows in raw.items():
        name = _spec_text(model, 80)
        if not name:
            continue
        cleaned = []
        for item in (rows if isinstance(rows, list) else []):
            row = normalize_spec_row(item)
            if not row:
                continue
            # ★ 「生成数量」行的取值域在**两道门**都要夹（迁移一道、后台录入一道），
            #   否则管理员在面板里填 99 就等于把旧版 `int_list(1,16)` 的保护拆掉了。
            if str(row.get('key') or '') == 'count':
                row['options'] = [option for option in row['options']
                                  if _spec_option_allowed('count', option['value'])]
                if row['options']:
                    if not any(option['value'] == row['default'] for option in row['options']):
                        row['default'] = row['options'][0]['value']
                else:
                    row['default'] = None
            cleaned.append(row)
        out[name] = cleaned
    return out


def resolve_spec_rows(specs, kind, *names):
    """按模型取登记行：依次试 `names`（上游模型名 → 展示名），最后落 `'*'` 兜底。

    返回 `None` = 这类规格整块没登记（调用方保持老行为）；返回 `[]` = 登记过但空表（如实为空）。
    """
    table = (specs or {}).get(kind) if isinstance(specs, dict) else None
    if not isinstance(table, dict) or not table:
        return None
    for name in names:
        text = str(name or '').strip()
        if text and text in table:
            return table[text]
    return table.get(SPEC_WILDCARD)


def spec_rows_for_entry(entry, kind):
    """当前模型在登记表里的行（`None` = 没登记 → 调用方保持升级前的行为）。

    ★ 为什么要这个壳：调用点不该各自 `read_model_specs()` + 自己拼「上游模型名 / 展示名」的顺序 ——
      顺序写错就会出现「后台明明登记了、画布却不认」（本项目踩过这类静默不匹配）。
    """
    if not isinstance(entry, dict):
        return None
    return resolve_spec_rows(read_model_specs(), kind, entry.get('model'), entry.get('name'))


def spec_rows_registered_for_entry(entry, kind):
    """这个模型是不是**自己**在登记表里登记过（而不是落到 `'*'` 兜底行）。

    ★★★ 为什么必须与 `spec_rows_for_entry` 分开（r873 踩到）：
      两者语义不同，混用会**破坏零回归**。以「时长」为例：
        · 老模型（没登记）→ 期望继续发 `seconds` 兜底（升级前的行为一字不变）；
        · 新模型（登记了但没有 duration 行，如视频超分）→ 期望**不发**时长
          （时长由源视频决定，发一个它没声明过的键就是纪律①的参数错误）。
      而 `'*'` 兜底行**存在但通常没有 duration 行** —— 只看
      `spec_rows_for_entry() 里有没有 duration 行` 会把老模型误判成"新模型"，悄悄停发 `seconds`。
      实测踩到：未登记的 `some-model` 请求体里时长整段消失。
    """
    if not isinstance(entry, dict):
        return False
    table = read_model_specs().get(kind) if isinstance(read_model_specs(), dict) else None
    if not isinstance(table, dict) or not table:
        return False
    for name in (entry.get('model'), entry.get('name')):
        text = str(name or '').strip()
        if text and text in table:
            return True
    return False


def spec_semantic_field(entry, kind, semantic_key, fallback=''):
    """这个模型的某个**语义键**该用哪个上游字段名发。

    ★★★ 为什么必须看登记表而不是写死（r872）：
      绝大多数模型时长的字段名是 `duration`，但**即梦 3.5 Pro 叫 `audio_duration`**。
      协议层以前一律发 `seconds` / `duration` → 那个模型的时长永远发不上去。
      登记表的 `duration` 行里 `field` 记的就是上游真实字段名（抓上游 spec 时生成），
      所以这里以行为准；没登记 / 行里没写 `field` → 回落 `fallback`（老行为）。
    """
    for row in (spec_rows_for_entry(entry, kind) or []):
        if isinstance(row, dict) and str(row.get('key') or '').strip() == semantic_key:
            name = str(row.get('field') or '').strip()
            if name:
                return name
    return fallback


def spec_semantic_values(rows, semantic):
    """登记行 + 画布语义值 → `{行 key: 要发的值}`。

    · 语义键（比例/清晰度/画质/数量…）：值来自用户本次选择（`semantic`），没给就用行里的默认值；
    · 模型专有键（version / background …）：用行里登记的默认值 —— 这就是「后台按模型声明参数」
      的那一层，以前只能直接改 `ai-models.json` 的 `mediaParams`。
    """
    out = {}
    for row in (rows or []):
        if not isinstance(row, dict):
            continue
        key = str(row.get('key') or '').strip()
        if not key:
            continue
        value = semantic.get(key) if isinstance(semantic, dict) else None
        if value in (None, ''):
            value = row.get('default')
        if value in (None, ''):
            continue
        out[key] = value
    return out


def spec_field_candidates(row):
    """一行规格可能对应的上游字段名，按优先级排。

    ★ 登记表里的 `field` 是**首选**，不是铁律：平台自己声明的 schema 才是真源
      （纪律①「只发 schema 里声明过的键」）。而平台两种命名都有
      （`banana-2` 用 `aspectRatio`、`tt-image-2.5` 用 `aspect_ratio`），
      所以这里把蛇形 / 驼峰互转也作为候选一起给出去。
    """
    names = []
    for raw in (row.get('field'), row.get('key')):
        text = str(raw or '').strip()
        if text and text not in names:
            names.append(text)
    for name in list(names):
        snake = re.sub(r'(?<!^)(?=[A-Z])', '_', name).lower()
        camel = re.sub(r'_([a-z])', lambda match: match.group(1).upper(), name)
        for variant in (snake, camel):
            if variant and variant not in names:
                names.append(variant)
    return names


def normalize_model_specs(raw):
    """整份登记表归一化。**读写都过这一个入口**，别在别处再写一套。"""
    raw = raw if isinstance(raw, dict) else {}

    audio = {}
    audio_raw = raw.get('audio') if isinstance(raw.get('audio'), dict) else {}
    for model, rows in audio_raw.items():
        name = _spec_text(model, 80)
        if not name:
            continue
        cleaned = []
        for item in (rows if isinstance(rows, list) else []):
            row = normalize_spec_row(item)
            if row:
                cleaned.append(row)
        audio[name] = cleaned

    camera_raw = raw.get('camera') if isinstance(raw.get('camera'), dict) else {}
    camera = {}
    for group in CAMERA_GROUPS:
        items, seen = [], set()
        for item in (camera_raw.get(group) if isinstance(camera_raw.get(group), list) else []):
            cleaned = normalize_camera_item(item)
            if cleaned and cleaned['key'] not in seen:
                seen.add(cleaned['key'])
                items.append(cleaned)
        camera[group] = items

    # 图片 / 视频规格：**按模型**的行式表（见文件上方 SPEC_* 常量处的说明）。
    # 旧版「全局一套」的结构由 `normalize_spec_model_map` 自动转成 `'*'` 兜底行 —— 行为不突变。
    return {'version': 2, 'audio': audio,
            'video': normalize_spec_model_map(raw.get('video'), 'video'),
            'camera': camera,
            'image': normalize_spec_model_map(raw.get('image'), 'image')}


def read_model_specs():
    """读登记表。文件缺失 → `read_file` 用默认值建好；损坏 → 回落默认值（已备份 .corrupt）。"""
    value = read_file(MODEL_SPECS_FILE, DEFAULT_MODEL_SPECS)
    if not isinstance(value, dict):
        return normalize_model_specs(DEFAULT_MODEL_SPECS)
    return upstream_spec_overlay(normalize_model_specs(value))


def write_model_specs(specs):
    """写登记表。**按 kind 局部更新**由调用方先读后合并 —— 这里只负责整份落盘。"""
    write_file(MODEL_SPECS_FILE, normalize_model_specs(specs if isinstance(specs, dict) else {}))


# ★ 例外白名单（r860）：这几个参数**上游声明成 input/textarea**（自由文本），但它们在画布上
#   有专门控件（底栏「音色」），必须能被拉进登记表 —— 否则会出现
#   「上游明明声明了 voice_id，后台却拉不到、音色控件被判成不支持而藏起来」。
#   实测：`doubao-tts-2.0` 的 `voice_id` 是 input、`gem-3.1-tts` 的 `voice_id` 还是 **required**。
#   收进来的行**没有 options** —— 前端据此渲染成「自由输入」而不是选项按钮。
SPEC_FREETEXT_PARAMS = ('voice_id', 'voice', 'speaker_id', 'speaker', 'timbre', 'voice_name')
# ★ 提示词类参数**永不登记**：画布有自己的提示词输入框（且会走 collectGenerationPrompt 组装），
#   收进登记表只会多出一行没人用的空白框，还容易让用户以为要在那里写词。
SPEC_PROMPT_PARAMS = ('prompt', 'text', 'text_prompt', 'content', 'input_text')


def spec_row_is_free_text(row):
    """这一行是不是「自由文本」行（上游声明成 input/textarea，没有 options）。

    ★★ 判据只有这一处 —— 前端 / 组装 / 对账都从这里取，别各写一套。
      · 上游 input 型参数（音色 `voice_id`、超分的 `video_url`…）没有 options；
      · 前端据此渲染成**输入框**（`input/textarea`）而不是选项按钮；
      · `build_media_generate_params` 据此判断「原样收字符串」。
    """
    if not isinstance(row, dict):
        return False
    if row.get('options'):
        return False
    field = str(row.get('field') or '').strip().lower()
    if field in ('input', 'textarea'):
        return True
    # 兼容：没写 field 的行（老数据 / 手填行）—— 上游 input 型也没有 options。
    return not str(row.get('field') or '').strip()


# ★★★ 上游「带 options 的枚举型」参数 —— **必须当成 select 收**（2026-09-25 实测）。
#   踩过的坑：`upstream_spec_rows()` 以前只认 `type == 'select'`，于是上游用
#   `radio` / `switch` 声明的枚举被**整条丢掉**：
#     wan2.6-image.size(8档) / qwen-image.size(8档) / wan2.7-image.size(7档)+quality(2档) /
#     vidu-image-2.aspect_ratio(10档)+resolution(3档)+quality(3档) / banana-2.web_search(2档)
#   症状极具欺骗性：拉取「成功」（ok=true）却只回 2 行，看起来像「上游就给了这么多字段」，
#   实际是**我们自己的过滤器把它们扔了** → 登记表里比例/清晰度全无 → 画布回落到内置默认
#   → 用户点了比例卡片发不出去（假控件）。
#   ★ 判据放宽：**只要带 options 就是枚举**，与上游叫它 select / radio / switch 无关。
#     反过来 `type == 'select'` 但 options 为空的，仍然丢弃（那种是配置不全，收了没法渲染）。
SPEC_OPTION_TYPES = ('select', 'radio', 'switch')

# ★★★ 上游字段名 → **画布语义键** 的识别表（2026-09-25）。
#   为什么必须有它：画布上的「画面比例 / 清晰度 / 画质」控件只认语义键
#   （`SPEC_SEMANTIC_KEYS` = aspectRatio / resolution / quality / count…），
#   而上游各家字段名完全不统一，甚至**语义和名字是错位的**：
#     · `wan2.6-image` / `qwen-image` 的 `size` 里装的是**宽高比**（label 写着「宽高比」）；
#     · `doubao-seedream` 的 `size` 里装的才是**分辨率档位**（1K/2K），比例另走 `aspect_ratio`；
#     · `banana-*` 用 `imageSize` 装分辨率档位、`aspectRatio` 装比例；
#     · `kling-v3` / `gk-image-2.0` 用 `resolution` + `aspect_ratio`（最规整的那种）。
#   ★ 所以**不能只看字段名**：`size` 到底算比例还是清晰度，得看它的 options 长什么样。
#     判定顺序：先看字段名能否直接对上语义键；对不上再按 **选项值形态**推断。
#   ★ 只做「能确定」的映射：认不出来就保持上游原字段名（当模型专有参数发出去），不硬猜。
SPEC_FIELD_ALIASES = {
    'aspectratio': 'aspectRatio',
    'aspect_ratio': 'aspectRatio',
    'ratio': 'aspectRatio',
    'imageaspectratio': 'aspectRatio',
    'imageratio': 'aspectRatio',
    'resolutionsize': 'resolution',
    'imagesize': 'resolution',
    'size': 'resolution',        # ★ 兜底：见下面 _spec_infer_semantic_key 的形态判断（ratio 形态会改判成比例）
    'resolution': 'resolution',
    'quality': 'quality',
    'imagequality': 'quality',
    'count': 'count',
    'n': 'count',
    'numimages': 'count',
    'numberofimages': 'count',
}
# 比例形态：`16:9` / `1:1` / `9:16` …
_SPEC_RATIO_RE = re.compile(r'^\s*\d{1,3}\s*:\s*\d{1,3}\s*$')
# 分辨率档位形态：`1K` / `2k` / `4K` / `1080p` / `720P` …
_SPEC_TIER_RE = re.compile(r'^\s*\d{3,4}\s*[kKpP]\s*$|^\s*[1-8]\s*[kK]\s*$')


def _spec_infer_semantic_key(field, options):
    """按「字段名 + 选项值形态」推断语义键；认不出来返回空串（保持原字段名）。

    ★ 形态判断优先于字段名 —— 因为 `size` 这个名字在两个模型上装着两种东西：
      `wan2.6-image.size` 是 `16:9`（比例），`doubao-seedream.size` 是 `2K`（档位）。
    """
    name = str(field or '').strip().lower().replace('-', '').replace('_', '')
    values = [str(option.get('value')) for option in (options or []) if isinstance(option, dict)]
    ratio_hits = sum(1 for value in values if _SPEC_RATIO_RE.match(value))
    tier_hits = sum(1 for value in values if _SPEC_TIER_RE.match(value))
    total = len(values) or 1
    # ① 形态明确：过半是比例 → 比例；过半是档位 → 清晰度
    if ratio_hits and ratio_hits / total >= 0.5:
        return 'aspectRatio'
    if tier_hits and tier_hits / total >= 0.5:
        return 'resolution'
    # ② 形态说不清（自由值 / 混装）→ 退回字段名
    if name in ('aspect_ratio', 'aspectratio', 'ratio', 'imageaspectratio', 'imageratio'):
        return 'aspectRatio'
    if name in ('resolution', 'imagesize', 'size'):
        return 'resolution'
    if name in ('quality', 'imagequality'):
        return 'quality'
    if name in ('count', 'n', 'numimages', 'numberofimages'):
        return 'count'
    return ''


def upstream_spec_rows(payload):
    """把上游 `GET /v1/skills/models/{name}` 的 `params` 归一化成规格行。

    ★ 只收两类参数，其余一律不要：
      ① **带 options 的枚举**（`SPEC_OPTION_TYPES` = select / radio / switch）—— 渲染成选项按钮；
      ② **必传（required）的自由文本**参数 —— 渲染成输入框。
    ★★★ 为什么「必传」必须收（2026-09-25 补，实测 `video-enhance` 的 `video_url`）：
      以前只收 select，且自由文本只放 `SPEC_FREETEXT_PARAMS`（音色那几个）——
      于是**上游必传的 `video_url` 被整个丢掉**，登记表里连它的存在都看不见。
      后果不是"少一行 UI"，而是**用户拿不到任何提示**：面板看着完整、点生成 → 上游硬 400
      「缺少必传参数」，而这个参数在后台根本无处登记。所以
      **required + 自由文本 → 必收**（label 里会写清是必传）。
      ★ 非必传的自由文本（`prompt` / 备注这类）仍然不收 —— 画布有自己的提示词输入框，
        收进来只会多一行没人用的空白框。
      ★ 音色那几个例外（`SPEC_FREETEXT_PARAMS`）**不管必不必传都收**：它们在画布上有专门控件。
    ★ 默认值：上游**不给** `default` 字段，只在 label 里标「（推荐）」→ 优先取那一项，
      否则取第一项。实测 `suno-v4.5` 的 `mv` 标了「V4.5 最新（推荐）」，取它是对的。
    """
    params = payload.get('params') if isinstance(payload, dict) else None
    if not isinstance(params, list):
        return []
    rows = []
    seen_keys = set()
    for param in params:
        if not isinstance(param, dict):
            continue
        key = _spec_text(param.get('name'), 60)
        if not key:
            continue
        # ★ 提示词不收：画布有自己的输入框，收了只会多一行没人用的空白框（`prompt_extend` 之类保留）。
        if key.lower() in SPEC_PROMPT_PARAMS:
            continue
        kind = 'select' if param.get('options') else str(param.get('type') or '').strip().lower()
        required = bool(param.get('required'))
        options = []
        if kind in SPEC_OPTION_TYPES:
            for item in (param.get('options') or []):
                option = normalize_spec_option(item)
                if option and not any(option['value'] == seen['value'] for seen in options):
                    options.append(option)
        else:
            # 自由文本：只有「必传」或「画布有专门控件」才收
            if not required and key.lower() not in SPEC_FREETEXT_PARAMS:
                continue
        # 枚举型但没吐出任何选项 → 上游声明不全，收了也没法渲染，丢弃。
        # ★ 注意判据是「options 为空」而不是「kind != 'select'」—— radio/switch 同样在这条守卫下。
        if kind in SPEC_OPTION_TYPES and not options:
            continue
        recommended = next((option['value'] for option in options if '推荐' in str(option.get('label') or '')), None)
        label = _spec_text(param.get('label'), 40) or key
        if not options and required:
            label = f'{label}（必传）'
        # ★★★ 语义键映射（2026-09-25）：上游字段名 → 画布语义键。
        #   画布的比例/清晰度控件只认语义键；上游却各叫各的（size / imageSize / aspect_ratio…），
        #   而且 `size` 在两家装的还是两种东西（比例 vs 档位）→ 按选项形态推断。
        #   · 认出来了 → `key` 换成语义键（控件就能接管），`field` 保留上游真名（提交时发这个）；
        #   · 没认出来 → 原样保留（当模型专有参数，仍会按行的 default 提交）。
        semantic_key = _spec_infer_semantic_key(key, options) if options else ''
        row_key = semantic_key or key
        # ★ 同一个语义键只留**第一个**：上游偶有重复声明（如同时给 `size` 与 `aspect_ratio`），
        #   两行都映射到 aspectRatio 会让面板出现两个「画面比例」，改一个另一个还是旧的。
        if row_key in seen_keys:
            continue
        seen_keys.add(row_key)
        rows.append({'key': row_key, 'label': label,
                     # ★ 自由文本行必须自带 `field` —— 它就是「原样收字符串」的标记（见 spec_row_is_free_text）。
                     # ★ 枚举行也要显式写 `field`：语义键与上游字段名不同名时必须靠它转发。
                     'field': key if options else 'input',
                     'required': required,
                     'options': options,
                     'default': recommended if recommended is not None else (options[0]['value'] if options else None)})
    return rows


def prune_model_specs(drop=None, kind_map=None):
    """把**已不在模型表里**的登记行删掉，返回 `(清理掉的清单, 是否真的改了)`。

    ★★★ 生命周期同步（2026-09-25，用户需求）：后台把模型**停用或删除**后，
      「模型管理」里对应的规格配置要跟着走 —— 否则登记表会越积越多：
      删掉的模型还占着下拉里一项、换模型时还会命中一份永远不会生效的配置。
    ★ 停用或删除**都**清（用户原话：停用或者直接删除，配置也要一起删）。
      理由：停用的模型不会出现在画布的模型选择器里 → 它的登记行永远不会被命中，
      留着只会在后台下拉框里堆死项。重新启用时点一次「从上游拉取」就回来了（成本极低）。
    ★★ `'*'` 兜底行**永不清理** —— 它不属于任何模型，是"没登记的模型"的公共兜底
      （迁移前那套全局配置就落在那里）。摄像头库（`camera`）同样不参与。
    ★ 按**上游模型名**匹配（登记表的键就是上游名），同时兼容历史上误用展示名登记的情况。
    ★ 返回的清单形如 `['audio:suno-v4.5', 'image:banana-2']`，供接口回报给用户。
    """
    drop = drop if isinstance(drop, (list, set, tuple)) else []
    live = {}  # {上游模型名: set(展示名)}
    for item in drop:
        if not isinstance(item, dict):
            continue
        name = str(item.get('model') or '').strip()
        if not name:
            continue
        bucket = live.setdefault(name, set())
        display = str(item.get('name') or '').strip()
        if display:
            bucket.add(display)
    specs = read_model_specs()
    removed = []
    changed = False
    for kind in (kind_map or ('audio', 'image', 'video')):
        table = specs.get(kind)
        if not isinstance(table, dict):
            continue
        for subject in list(table.keys()):
            if subject == '*':
                continue
            if subject in live:
                continue
            # 上游名对不上，但登记时用的是展示名 → 也认（历史数据）
            if any(subject in names for names in live.values()):
                continue
            table.pop(subject, None)
            removed.append(f'{kind}:{subject}')
            changed = True
    if changed:
        write_model_specs(specs)
    return removed, changed


def find_model_for_spec_fetch(models, subject='', model_id=''):
    """在模型表里找「这次拉取该用哪一行」的凭据，返回 `(entry, error)`。

    ★★★ 为什么要这个函数（2026-09-25，用户反馈「从上游拉取失败」）：
      API Key **永不下发浏览器**（安全铁律），所以前端只能告诉我们「是哪个模型」，
      由服务端自己把 `baseUrl` / `apiKey` 找回来。而"怎么找"就是失败的高发点：

      · 老逻辑只认 `entry['model'] == 传入的模型名` 这一种键，且**大小写敏感、不认别名**。
        前端传的是**登记表的键**（用户可能填了展示名 `视频超分（按次）`、或大小写不一致的名称），
        一旦不严格相等 → 回查失败 → 直接抛「缺少接口地址或 API Key」。
        用户看到的就是"拉取失败"，但其实是**本地回查没命中**，跟上游一点关系都没有。
      · 点「新增模型」手输名字后立刻点拉取：那一行**还没保存**（不在模型表里），
        以前无条件要求带 key → 必然失败。现在支持显式带凭据（从面板当前编辑的供应商行取）。

    ★ 匹配顺序（从准到松，命中即止）：
      ① 显式 `modelId` —— 前端选中已启用模型时带的最强凭据；
      ② `model` / `name` 字段**精确**匹配（先区分大小写，再忽略大小写）；
      ③ 去掉「（按次）/（按 Token）」这类**计费后缀**后再比一次 —— 展示名带后缀是常态
         （`视频超分（按次）` 的真实上游名是 `video-enhance`）。
    ★ 只在**主供应商**（`ownerId` 空）与当前用户名下的模型里找 —— 与 `visible_ai_models` 同口径。
    """
    subject = str(subject or '').strip()
    model_id = str(model_id or '').strip()
    # ★ `models` 为空时回落到读盘（调用点大多不传）。★ 别把回落写成"总是读盘"——
    #   那会让传进来的池形同虚设，测试与调用点都无法注入（本函数踩过这个坑）。
    source = models if isinstance(models, (list, tuple)) and models else read_ai_models()
    pool = [m for m in source if isinstance(m, dict)]
    if not pool:
        return None, '本地还没有任何供应商模型，请先到「主供应商设置」接入并在「模型」列表里启用'

    def usable(entry):
        return entry and str(entry.get('baseUrl') or '').strip() and provider_has_credentials(entry)

    if model_id:
        for entry in pool:
            if str(entry.get('id') or '').strip() == model_id:
                if usable(entry):
                    return entry, ''
                return None, '该模型没有填接口地址或 API Key，请先到「主供应商设置」补全'

    if subject:
        def strip_billing(text):
            # 「视频超分（按次）」→「视频超分」；「GPT Image 2.5 · 官转（按 Token）」→「GPT Image 2.5 · 官转」
            return re.sub(r'[（(]\s*按(?:次|秒|Token)[^）)]*[）)]\s*$', '', str(text or '')).strip()

        wanted = {subject, subject.lower()}
        loose = {strip_billing(subject), strip_billing(subject).lower()}
        candidates = []
        for entry in pool:
            if not usable(entry):
                continue
            fields = (str(entry.get('model') or '').strip(), str(entry.get('name') or '').strip())
            if any(f in wanted for f in fields):
                return entry, ''
            if any(strip_billing(f) in loose for f in fields):
                candidates.append(entry)
        if candidates:
            return candidates[0], ''

    return None, (f'没找到「{subject}」对应的供应商行 —— 请确认「上游模型名」与'
                  f'「主供应商设置」里该模型的「模型标识」完全一致（含大小写）')


def fetch_upstream_specs(model_name, base_url, api_key, timeout=20, auth_mode=None):
    """去上游拉某个模型的参数表，返回 `(rows, meta, error)`。"""
    model_name = str(model_name or '').strip()
    base_url = str(base_url or '').strip().rstrip('/')
    api_key = str(api_key or '').strip()
    if not model_name:
        return [], {}, '缺少上游模型名'
    if not base_url or not provider_has_credentials({'apiKey':api_key,'authMode':auth_mode}):
        return [], {}, '缺少接口地址或 API Key'
    url = f'{base_url}/skills/models/{quote(model_name, safe="")}' if base_url.endswith('/v1') else f'{base_url}/v1/skills/models/{quote(model_name, safe="")}'
    status, payload, error = http_json_request(url, headers=auth_headers({'baseUrl':base_url,'authMode':auth_mode}, api_key), timeout=timeout)
    if error:
        return [], {}, f'HTTP {status}：{error}'
    if not isinstance(payload, dict):
        return [], {}, f'上游返回的不是 JSON 对象（HTTP {status}）'
    params = payload.get('params', [])
    if not isinstance(params, list):
        return [], {}, '上游参数表格式错误：params 必须为数组'
    rows = upstream_spec_rows(payload)
    meta = {'name': model_name,
            'displayName': _spec_text(payload.get('display_name'), 80),
            'description': _spec_text(payload.get('description'), 400),
            'inputHint': _spec_text(payload.get('input_hint'), 400),
            'totalParams': len(params)}
    return rows, meta, ''


# ★★★ 模型的两个作用域（r794，用户需求）：
#   · global —— 「主供应商设置」：`ownerId` 为空，**所有用户可见、可调用**，仅管理员可改；
#   · mine   —— 「供应商设置」：`ownerId` = 当前用户，**只有本人可见、可调用**，管理员 + VIP 可改。
#   ★ 存量条目没有 `ownerId` → 天然属于 global，行为与升级前一致（向后兼容）。
MODEL_SCOPES = ('global', 'mine')


def model_owner_of(item):
    return str((item or {}).get('ownerId') or '').strip()


def visible_ai_models(user_id):
    return [with_user_timeouts(m, LOCAL_ID) for m in read_ai_models()]


def scoped_ai_models(scope, user_id):
    return read_ai_models()


def write_scoped_ai_models(scope, user_id, items):
    write_ai_models([dict(item, ownerId='') for item in items])


# Connection records survive removal of the last model. They are never generation models.
AI_PROVIDERS_FILE = DATA_DIR / 'ai-providers.json'
BUILTIN_PROVIDER_ID = 'provider-builtin-zzzapi'
BUILTIN_PROVIDER_FIELDS = {
    'baseUrl': 'https://ai.zzzapi.xyz',
    'docsUrl': 'https://ai.zzzapi.xyz',
}
BUILTIN_PROVIDERS = {
    BUILTIN_PROVIDER_ID: {'provider': 'CanvasFlow · 文本', 'kind': 'text'},
    'provider-builtin-zzzapi-image': {'provider': 'CanvasFlow · 图片', 'kind': 'image'},
    'provider-builtin-zzzapi-video': {'provider': 'CanvasFlow · 视频', 'kind': 'video'},
    'provider-builtin-zzzapi-audio': {'provider': 'CanvasFlow · 音频', 'kind': 'audio'},
}
AI_PROVIDER_FIELDS = ('provider', 'baseUrl', 'protocol', 'authMode', 'apiKey',
    'docsUrl', 'logoUrl', 'textProtocol', 'imageTransport', 'submitPath', 'statusPath',
    'imageSubmitPath', 'imageEditPath', 'providerProfile', 'referenceInputModes',
    'fileUploadPath', 'fileUploadMediaKinds', 'imageTaskMode', 'imageStatusPath',
    'imageCancelPath', 'videoTaskMode', 'videoCancelPath', 'generationTimeouts')


def read_ai_providers():
    rows = read_file(AI_PROVIDERS_FILE, [])
    rows = [row for row in rows if isinstance(row, dict)] if isinstance(rows, list) else []
    builtin = []
    for provider_id, config in BUILTIN_PROVIDERS.items():
        saved = next((row for row in rows if row.get('id') == provider_id), {})
        builtin.append({'protocol': 'openai', 'authMode': 'bearer', **saved,
                        'id': provider_id, 'provider': config['provider'], **BUILTIN_PROVIDER_FIELDS})
    return builtin + [row for row in rows if row.get('id') not in BUILTIN_PROVIDERS]


def provider_identity(item):
    return tuple(str(item.get(key) or default).strip() for key, default in
                 (('provider', ''), ('baseUrl', ''), ('protocol', 'openai')))


def provider_record(incoming, existing=None):
    normalized = normalize_ai_model(incoming, existing)
    saved = {'id': (existing or {}).get('id') or 'provider-' + uuid.uuid4().hex[:12],
             **{key: normalized[key] for key in AI_PROVIDER_FIELDS if key in normalized}}
    group = (existing or {}).get('providerGroup') or incoming.get('providerGroup')
    if group:
        if group != 'canvasflow':
            raise ValueError('无效的供应商分组')
        kind = incoming.get('configKind', (existing or {}).get('configKind', 'text'))
        if kind not in ('text', 'image', 'video', 'audio'):
            raise ValueError('无效的子配置类型')
        saved.update(providerGroup=group, configKind=kind, **BUILTIN_PROVIDER_FIELDS)
    return saved


def ai_provider_public(item):
    public = ai_model_public(item)
    config = BUILTIN_PROVIDERS.get(item.get('id'))
    return {'builtIn': config is not None, 'builtInKind': config['kind'] if config else '',
            'providerGroup': 'canvasflow' if config else item.get('providerGroup', ''),
            'configKind': config['kind'] if config else item.get('configKind', ''),
            **{key: public.get(key) for key in (*AI_PROVIDER_FIELDS, 'id', 'apiKeySet', 'apiKeyHint')
               if key != 'apiKey'}}


def remember_ai_provider(model):
    """Called under LOCK before deleting a model; retain a nonempty saved credential."""
    rows = read_ai_providers()
    existing = next((row for row in rows if provider_identity(row) == provider_identity(model)), None)
    if existing and (existing.get('id') in BUILTIN_PROVIDERS or existing.get('providerGroup') == 'canvasflow'):
        return
    saved = provider_record(model, existing)
    if existing and not saved.get('apiKey'):
        saved['apiKey'] = existing.get('apiKey') or ''
    write_file(AI_PROVIDERS_FILE, [saved if row is existing else row for row in rows]
               if existing else rows + [saved])


def ai_model_public(item):
    key = str(item.get('apiKey') or '')
    return {
        'id': item.get('id'), 'name': item.get('name'), 'provider': item.get('provider'),
        'type': item.get('type'), 'usages': model_usages(item),
        # 计费方式（按次 / 按 Token / 按秒）—— 画布与后台都要标出来，别让用户猜。
        'billing': item.get('billing') or infer_billing(item.get('model') or item.get('name')),
        # ★ r884：定价必须一起下发 —— 后台「模型定价」面板靠它回显，画布靠它标「本次大概多少钱」。
        'pricing': model_pricing(item),
        'modelParams': normalize_model_params(item.get('modelParams')),
        'baseUrl': item.get('baseUrl'), 'model': item.get('model'),
        'protocol': item.get('protocol') or 'openai', 'submitPath': item.get('submitPath') or '', 'statusPath': item.get('statusPath') or '',
        'imageTransport': item.get('imageTransport') or '', 'imageSubmitPath': item.get('imageSubmitPath') or '',
        'imageEditPath': item.get('imageEditPath') or '',
        'authMode': item.get('authMode') or 'bearer', 'docsUrl': item.get('docsUrl') or '',
        'textProtocol': item.get('textProtocol') or '', 'logoUrl': item.get('logoUrl') or '',
        'providerProfile': item.get('providerProfile') or '',
        'referenceInputModes': list(item.get('referenceInputModes') or []),
        'fileUploadPath': item.get('fileUploadPath') or '',
        'fileUploadMediaKinds': list(item.get('fileUploadMediaKinds') or []),
        'imageTaskMode': item.get('imageTaskMode') or '', 'imageStatusPath': item.get('imageStatusPath') or '',
        'imageCancelPath': item.get('imageCancelPath') or '',
        'videoTaskMode': item.get('videoTaskMode') or '', 'videoCancelPath': item.get('videoCancelPath') or '',
        'requestProfile': item.get('requestProfile') or '',
        # 独立生成超时（供应商级覆盖）：**字段不存在 = 开关关闭 = 走全局**。
        # ★ 这是第二处白名单（第一处是 normalize_ai_model）：只加 normalize 忘了这里，
        #   前端拿到的永远是 undefined → 开关打开后一刷新又变回关闭（本项目踩过的经典静默丢弃）。
        'generationTimeouts': dict(item['generationTimeouts']) if isinstance(item.get('generationTimeouts'), dict) and item['generationTimeouts'] else None,
        'enabled': bool(item.get('enabled')), 'apiKeySet': bool(key),
        'apiKeyHint': (f'****{key[-4:]}' if len(key) >= 8 else ('已设置' if key else '')),
        # 作用域（r794）：前端据此在模型选择器里标「主供应商 / 我的」
        'ownerId': model_owner_of(item),
        'scope': 'mine' if model_owner_of(item) else 'global',
    }


def normalize_ai_model(incoming, existing=None):
    for field in ('id','type','billing','protocol','authMode','textProtocol','providerProfile',
                  'imageTaskMode','videoTaskMode','requestProfile'):
        if field in incoming and incoming[field] is not None and not isinstance(incoming[field], str):
            raise ValueError(field + ' 必须是文本')
    item = dict(existing or {})
    item['id'] = str(item.get('id') or incoming.get('id') or f'aimodel-{uuid.uuid4().hex[:10]}')
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,100}', item['id']):
        raise ValueError('模型 ID 只能包含字母、数字、下划线和短横线')
    item['name'] = str(incoming.get('name') or item.get('name') or '').strip()[:40]
    item['provider'] = str(incoming.get('provider') or item.get('provider') or '').strip()[:30]
    item['type'] = incoming.get('type') if incoming.get('type') in AI_MODEL_TYPES else item.get('type', 'i2t')
    # 用途集合：空 = 回落到单一 type；type 始终跟随「主用途」，让老逻辑继续可用。
    if 'usages' in incoming:
        # 显式传空 = 保持原样（用途不允许被清空），前端取消最后一个开关时也不会把记录打坏。
        usages = normalize_usages(incoming.get('usages'), '') or normalize_usages(item.get('usages'), item.get('type'))
    else:
        usages = normalize_usages(item.get('usages'), item.get('type'))
    item['usages'] = usages
    if usages and TYPE_TO_USAGE.get(item['type']) not in usages:
        item['type'] = USAGE_TO_TYPE[usages[0]]
    # ★★ 计费方式：加字段必须同步白名单，否则前端传上来会被**静默丢弃**（本项目踩过多次）。
    billing = incoming.get('billing') if 'billing' in incoming else item.get('billing')
    item['billing'] = billing if billing in BILLING_MODES else infer_billing(item.get('model') or item.get('name'))
    # ★★★ r884 定价：与 `billing` 同一条纪律 —— 加字段不同步这里，前端传上来的价格会被**静默丢弃**
    #   （表现：面板里填了、保存成功、一刷新全变 0）。`'pricing' in incoming` 判据保证
    #   只改别的字段（如启停）时不会把已有定价清掉。
    previous_pricing = normalize_model_pricing(item.get('pricing'))
    item['pricing'] = normalize_model_pricing(incoming.get('pricing') if 'pricing' in incoming else item.get('pricing'))
    # ★ 定价**真的变了**才盖时间戳 —— 前端不必自己造时间，也不会因为忘了传而显示空白。
    #   比较时排除 `updatedAt` 自身，否则每次保存都会判为「变化」（自指比较）。
    if any(item['pricing'][key] != previous_pricing[key] for key in MODEL_PRICING_FIELDS) \
            or item['pricing']['note'] != previous_pricing['note']:
        item['pricing']['updatedAt'] = auth_iso()
    item['protocol'] = incoming.get('protocol') if incoming.get('protocol') in {'openai', 'anthropic', 'dashscope', 'kling', 'openai-video'} else item.get('protocol', 'openai')
    item['submitPath'] = str(incoming.get('submitPath') or item.get('submitPath') or '').strip()[:200]
    item['statusPath'] = str(incoming.get('statusPath') or item.get('statusPath') or '').strip()[:200]
    # 图片传输合同：空 / auto 表示「按供应商身份自动推断」，见 resolve_image_transport()
    transport = incoming.get('imageTransport') if 'imageTransport' in incoming else item.get('imageTransport')
    item['imageTransport'] = '' if str(transport or '').strip() in ('', 'auto') else (normalize_image_transport(transport) or '')
    item['imageSubmitPath'] = str(incoming.get('imageSubmitPath') or item.get('imageSubmitPath') or '').strip()[:200]
    item['imageEditPath'] = str(incoming.get('imageEditPath') or item.get('imageEditPath') or '').strip()[:200]
    item['authMode'] = incoming.get('authMode') if incoming.get('authMode') in AUTH_MODES else item.get('authMode', 'bearer')
    # 文本协议：空 / auto 表示按默认（chat-completions）
    text_protocol = incoming.get('textProtocol') if 'textProtocol' in incoming else item.get('textProtocol')
    item['textProtocol'] = '' if str(text_protocol or '').strip() in ('', 'auto') else (
        text_protocol if text_protocol in TEXT_PROTOCOLS else '')
    item['docsUrl'] = str(incoming.get('docsUrl') or item.get('docsUrl') or '').strip()[:200]
    # 供应商 LOGO：前端已把用户选的图缩到 128px 再转 data URI，这里只做协议白名单 + 体积兜底。
    # 走内联而不是媒体库：媒体库有「孤儿回收」，LOGO 不被任何项目引用，会被 gc 当垃圾删掉。
    logo = incoming.get('logoUrl') if 'logoUrl' in incoming else item.get('logoUrl')
    logo = str(logo or '').strip()
    item['logoUrl'] = logo[:LOGO_MAX_CHARS] if re.match(r'^data:image/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$', logo) else ''
    item['baseUrl'] = str(incoming.get('baseUrl') or item.get('baseUrl') or '').strip()[:200].rstrip('/')
    # ===== 供应商能力位（全部默认空 = 走老行为，零回归）=====
    profile = incoming.get('providerProfile') if 'providerProfile' in incoming else item.get('providerProfile')
    item['providerProfile'] = profile if profile in PROVIDER_PROFILES else ''
    modes = incoming.get('referenceInputModes') if 'referenceInputModes' in incoming else item.get('referenceInputModes')
    item['referenceInputModes'] = normalize_enum_list(modes, REFERENCE_MODE_ORDER)
    item['fileUploadPath'] = str(incoming.get('fileUploadPath') or item.get('fileUploadPath') or '').strip()[:200]
    kinds = incoming.get('fileUploadMediaKinds') if 'fileUploadMediaKinds' in incoming else item.get('fileUploadMediaKinds')
    item['fileUploadMediaKinds'] = normalize_enum_list(kinds, REFERENCE_KIND_ORDER)
    for field in ('imageTaskMode', 'videoTaskMode'):
        value = incoming.get(field) if field in incoming else item.get(field)
        item[field] = value if value in GENERATION_MODES else ''
    for field in ('imageStatusPath', 'imageCancelPath', 'videoCancelPath'):
        item[field] = str(incoming.get(field) or item.get(field) or '').strip()[:200]
    request_profile = incoming.get('requestProfile') if 'requestProfile' in incoming else item.get('requestProfile')
    item['requestProfile'] = request_profile if request_profile in REQUEST_PROFILES else ''
    item['modelParams'] = normalize_model_params(incoming.get('modelParams') if 'modelParams' in incoming else item.get('modelParams'))
    # 请求形态只有一个真相：模型级 requestProfile。参数能力弹窗「音频」段里的请求形态是同一字段的
    # 另一个入口 —— 这里双向同步，避免出现「卡片下拉显示 A、弹窗显示 B」的假象。
    audio_params = item['modelParams'].get('audio')
    if not isinstance(audio_params, dict):
        audio_params = {}
    if audio_params.get('requestProfile') and not incoming.get('requestProfile'):
        item['requestProfile'] = audio_params['requestProfile']
    audio_params['requestProfile'] = item.get('requestProfile') or ''
    item['modelParams']['audio'] = audio_params
    item['model'] = str(incoming.get('model') or item.get('model') or '').strip()[:80]
    # 独立生成超时（供应商级覆盖全局）：**字段缺失 = 开关关闭 = 无覆盖**，老记录一个字节不用迁移。
    # 只接受已知键、逐项夹紧到 TIMEOUT_LIMITS；一个合法键都没有时直接删掉整个字段，
    # 免得落一个空对象让「开关是开还是关」产生歧义（判据统一成「字段在不在」）。
    if 'generationTimeouts' in incoming or 'generationTimeouts' in item:
        raw_timeouts = incoming.get('generationTimeouts') if 'generationTimeouts' in incoming else item.get('generationTimeouts')
        cleaned = {}
        if isinstance(raw_timeouts, dict):
            for tkey, (low, high) in TIMEOUT_LIMITS.items():
                if tkey not in raw_timeouts:
                    continue
                try:
                    tvalue = int(raw_timeouts[tkey])
                except (TypeError, ValueError):
                    continue
                cleaned[tkey] = max(low, min(high, tvalue))
        if cleaned:
            item['generationTimeouts'] = cleaned
        else:
            item.pop('generationTimeouts', None)
    key = str(incoming.get('apiKey') or '').strip()
    if existing and existing.get('apiKey') and not key:
        validate_provider_access('admin', item['baseUrl'])
        if http_origin(item['baseUrl']) != http_origin(existing['baseUrl']):
            raise NetworkAccessError('更换接口主机后必须重新填写 API Key，不能把原密钥转发到其他主机',400)
    if key: item['apiKey'] = key[:200]
    elif 'apiKey' not in item: item['apiKey'] = ''
    item['enabled'] = bool(incoming.get('enabled', item.get('enabled', False)))
    return item


if not AI_MODELS_FILE.exists(): write_ai_models(DEFAULT_AI_MODELS)


def merge_default_ai_models():
    """新版本预置的模型自动补进注册表；管理员删除过的预设记录在豁免名单里不再复活。"""
    stored = read_ai_models()
    known = {m.get('id') for m in stored}
    try:
        dismissed = json.loads((DATA_DIR / 'ai-models-dismissed.json').read_text(encoding='utf-8'))
    except (FileNotFoundError, json.JSONDecodeError):
        dismissed = []
    missing = [m for m in DEFAULT_AI_MODELS if m.get('id') not in known and m.get('id') not in dismissed]
    if missing: write_ai_models(stored + missing)


merge_default_ai_models()


# ===== 预设提示词（管理员统一管理）=====
# 画布内所有预设（斜杠预设 15 项 + 情绪调节）的提示词正文都归这里管：
#   · 只有管理员能拿到正文（GET 会按角色过滤）；
#   · 生成时由服务端按 presetScene 注入，前端不需要持有正文；
#   · 实际生效值 = server-data/preset-prompts.json（管理员改过的），缺项回落到本表。
# ★ 本表由 `_extract_preset_prompts.js` 从 app.js 的 SLASH_PRESETS / MOOD_ADJUST_PROMPT 提取生成，
#   两边必须逐字一致 —— 守卫测试 `_test_preset_prompt_defaults.py` 盯着这件事。
PRESET_PROMPT_DEFAULTS = {
    "storyboard_canvas_skill_new": {
        'title': "调度故事板",
        'desc': "生成带有运动轨迹等调度草图分镜",
        'placeholder': "描述一个 10-15 秒内能演完的小剧情片段。可补充角色、场景、道具、动作过程、走位、对白或参考图，系统会整理为 4-6 个中文调度分镜手绘版",
        'icon': "slashStoryboard",
        'prompt': "把这段剧情整理成 4-6 个连续的中文调度分镜手绘版，按时间顺序排成一条连贯的格子长图。\n每个分镜标注镜头机位与运动轨迹：用箭头画出摄影机或主体的运动方向，标出起止位置。\n保持角色外观、服装、场景与道具在所有格子间严格一致，只变化机位、景别与动作阶段。\n画风为黑白线条草图，线条干净，不加上色与光影渲染，便于后续直接作为分镜参考。",
    },
    "storyboard_canvas_skill": {
        'title': "故事板",
        'desc': "生成完整剧情片段",
        'placeholder': "描述一个 10-15 秒内能演完的小剧情片段，系统会整理为 4-8 个连续分镜，内容过长时会自动提炼关键剧情。提供角色三视图、美术设定图及准确的需求描述，生成效果会更好。",
        'icon': "slashStoryboard",
        'prompt': "把这 10-15 秒的剧情拆成 4-8 个连续分镜，按时间顺序排成一张连贯的故事板长图。\n每个分镜给出景别与机位（远/全/中/近/特写、平/俯/仰），画面要能一眼看出前后镜头的衔接关系。\n保持角色外观、服装、场景、光源方向与色调在所有分镜间完全一致。\n按剧情节奏分配画面比重，关键情绪点给更大的画面或更强的构图对比。\n输出为带细边框的彩色故事板，每个分镜角落标注镜号。",
    },
    "continuous_storyboard_grid_25": {
        'title': "25宫格连贯分镜",
        'desc': "生成连续分镜长图",
        'placeholder': "点击生成，直接基于当前图像进行25宫格剧情推演；支持文生/参考图生成。",
        'icon': "storyboard25",
        'prompt': "基于当前图像推演后续剧情，输出一张 5×5 共 25 格的连贯分镜长图，按从左到右、从上到下的顺序阅读。\n25 格必须构成一段完整连续的叙事：有起承转合，最后一格收束到明确的结果。\n保持主角外观、服装、场景与美术风格在全部 25 格中严格一致，只推进动作、机位与景别。\n每格节奏均匀，避免连续多格画面雷同；关键转折格给更强的构图与更近的景别。",
    },
    "story_beat_grid_4": {
        'title': "剧情推演四宫格",
        'desc': "生成四格剧情推演",
        'placeholder': "点击生成，直接基于当前图像进行4宫格剧情推演；支持文生/参考图生成。",
        'icon': "storyBeat4",
        'prompt': "基于当前图像做 2×2 四宫格剧情推演，四格按「起 → 承 → 转 → 合」排列。\n第一格还原当前画面作为起点，后三格依次推进事件，第四格给出明确的结果或反转。\n保持主体、场景、光线与美术风格在四格间完全一致，只变化动作、机位与景别。\n四格要有清晰的情绪递进，不要四格都是同一个瞬间的不同角度。",
    },
    "frame_prediction_plus_3s": {
        'title': "画面推演 - 3秒后",
        'desc': "推演画面后续动作",
        'placeholder': "",
        'icon': "framePlus3s",
        'prompt': "基于当前画面推演 3 秒后的状态，严格遵循物理规律与动作惯性。\n保持主体外观、材质、服装、场景与光线方向完全不变，只让动作、姿态与位置向前推进。\n正在发生的运动要继续完成（落下、扬起、倾倒、扩散等），并给出符合物理的中间态。\n不要改变构图与机位，输出与当前画面同视角的同规格图像。",
    },
    "frame_prediction_minus_5s": {
        'title': "画面推演 - 5秒前",
        'desc': "还原画面前置状态",
        'placeholder': "基于物理逻辑，反推5秒前的动作起因。",
        'icon': "frameMinus5s",
        'prompt': "基于当前画面反推 5 秒前的状态，严格遵循物理规律与动作因果。\n保持主体外观、材质、服装、场景与光线方向完全不变，只把动作回退到它的起因阶段。\n当前画面里的结果（飞溅、扬起、倒伏、位移等）应当尚未发生，或正好处于起因的起点。\n不要改变构图与机位，输出与当前画面同视角的同规格图像。",
    },
    "portrait_texture_adjustment": {
        'title': "人像质感调节",
        'desc': "降低 AI 感，优化人物质感与光影",
        'placeholder': "",
        'icon': "portrait",
        'prompt': "在完全不改变人物长相、身份与姿态的前提下，提升人脸与皮肤的真实质感。\n减弱 AI 生成常见的塑料感与过度磨皮：保留自然的毛孔、细小绒毛、皮肤纹理与浅层瑕疵。\n重塑体积感光照明暗过渡，让高光柔和收敛、阴影保留细节，避免死黑与死白。\n头发与胡须保持发丝分明的边缘，眼睛补上自然的高光与湿润感。\n输出为高清写实的人像特写，肤色自然、光影通透，整体不增删画面内容。",
    },
    "cinematic_lighting_correction": {
        'title': "电影级光影校正",
        'desc': "调整画面光影质感",
        'placeholder': "点击生成，直接对当前图像进行电影机光影矫正、景别视角；支持通过文本/参考图生成。",
        'icon': "cinematic",
        'prompt': "保持主体、构图与画面内容不变，只对当前图像做电影级的光影矫正。\n建立明确的单一主光方向，让亮部与暗部形成有层次的明暗过渡，暗部保留细节而非压死。\n补上环境光与轮廓光，让主体从背景中分离出来，增强空间纵深与体积感。\n统一色温与色调，向电影胶片的色彩倾向收拢，降低高饱和廉价感。\n输出为高动态范围、低噪点的成片级画面。",
    },
    "720_panoramic": {
        'title': "720全景",
        'desc': "生成全景场景图",
        'placeholder': "点击生成，直接将场景图像转为720全景图；支持文生/参考图生成。",
        'icon': "panoramic720",
        'prompt': "基于上游参考图创建 720° 全景图，保持主体、材质、光线和场景风格一致。\n画面需要可无缝环绕拼接，左右边缘自然衔接，避免明显断层、畸变和重复主体。\n输出为超宽全景构图，保留环境细节和空间纵深。",
    },
    "multi_camera_grid_9": {
        'title': "多机位九宫格",
        'desc': "生成多视角机位图",
        'placeholder': "点击生成，直接基于当前图生成约9个不同的角度、景别视角；支持模型图像分辨率。",
        'icon': "grid9",
        'prompt': "基于当前图像，输出一张 3×3 九宫格的多机位视图，九格为同一主体与场景的九个不同视角。\n九个视角要真正拉开区别：环绕主体的不同方位（正/侧/背/斜）、不同机位高度（平/俯/仰）与不同景别（远/全/中/近）。\n保持主体外观、服装、材质、场景与光照条件在九格间严格一致——只有观察角度在变。\n每格构图完整、主体清晰，避免出现半张脸或主体被裁切。",
    },
    "character_face_turnaround_3view": {
        'title': "角色脸部三视图",
        'desc': "基于一张参考图生成脸部细节三视图",
        'placeholder': "点击生成，直接基于当前图像生成带正面肖像特写的白底三视图；支持通过文本/参考图生成。",
        'icon': "charFace3view",
        'prompt': "基于当前图像生成角色脸部三视图，并附带一张正面肖像特写。\n三视图为正面、正侧面、背面，同一角色、同一光照、同一比例横向并排，高度对齐。\n正面肖像特写要放大脸部细节：五官结构、皮肤质感、发丝走向与眼神高光都要清晰可辨。\n严格保持角色的脸型、发型、发色、瞳色与配饰一致，不发生身份漂移。\n背景纯白，无投影、无道具、无多余元素，只保留角色本体。",
    },
    "character_setting_sheet": {
        'title': "角色设定图",
        'desc': "角色主视觉与设定拆解",
        'placeholder': "点击生成，直接基于当前图像生成完整的角色设定图；支持通过文本/参考图生成。",
        'icon': "person",
        'prompt': "基于当前图像生成一张完整的角色设定图，用于后续所有镜头的形象基准。\n版面包含：主视觉半身立绘、正面全身、背面全身，以及头部、服装、配饰的局部细节特写。\n标注角色的关键识别特征：发型与发色、瞳色、体型比例、服装结构与材质、随身道具。\n同一角色在全部视图与特写中必须完全一致，允许在其中标注色彩与材质说明。\n背景干净中性，不抢主体，便于直接作为美术设定的参考图。",
    },
    "character_turnaround_3view": {
        'title': "角色三视图",
        'desc': "正侧背视图与脸部特写",
        'placeholder': "点击生成，直接基于当前图像生成带正面肖像特写的白底三视图；支持通过文本/参考图生成。",
        'icon': "char3view",
        'prompt': "基于当前图像生成角色全身三视图：正面、正侧面、背面，横向并排、高度对齐、同一比例。\n三视图必须严格保持角色一致：身高体型、发型发色、五官、服装结构与材质、配饰位置全部吻合。\n另附一张正面脸部特写，交代五官细节与神态。\n人物为自然站姿、双臂自然下垂，不做夸张动作，方便测量比例。\n背景纯白，无投影、无道具，只保留角色本体。",
    },
    "scene_setting_sheet": {
        'title': "场景设定图",
        'desc': "角色主视觉与设定拆解",
        'placeholder': "点击生成，直接基于当前图像生成完整的角色设定图；支持通过文本/参考图生成。",
        'icon': "layers",
        'prompt': "基于当前图像生成一张完整的场景设定图，用于后续所有镜头的空间基准。\n版面包含：场景全景主视图，以及关键区域、建筑结构、地面与道具的局部细节特写。\n交代清晰的空间关系与光照条件：主光方向、光源性质（日光/夜灯/火光）、时段氛围与色温倾向。\n标注材质与环境细节：建筑用料、植被、地貌、天气与空气感（雾气、尘埃、湿度）。\n同一空间在全部视图与特写中保持一致，不要出现结构与陈设的矛盾。",
    },
    "product_setting_sheet": {
        'title': "产品设定图",
        'desc': "角色主视觉与设定拆解",
        'placeholder': "点击生成，直接基于当前图像生成完整的角色设定图；支持通过文本/参考图生成。",
        'icon': "product",
        'prompt': "基于当前图像生成一张完整的产品设定图，用于后续所有镜头的产品一致性基准。\n版面包含：产品主视觉图，以及多个角度的整体视图（正面/侧面/背面/俯视）。\n补上关键细节特写：材质肌理、表面工艺、logo 与丝印、接口与结构接缝、包装形态。\n交代材质与工艺信息：金属/塑料/玻璃/织物等材质属性，以及表面处理（磨砂、镜面、拉丝）。\n产品外观、配色与比例在所有视图与特写中必须完全一致。\n采用干净的影棚布光与中性背景，凸显产品的形体、质感与高级感。",
    },
    "mood_adjustment": {
        'title': "情绪调节",
        'desc': "截取人脸 / 角色后打开表情编辑器，调整人物情绪",
        'placeholder': "",
        'icon': "emotion",
        'prompt': "以参考图一（原图）为主参考图，保持人物长相、发型、发色、服装、配饰、姿态、构图、景别、背景与光线方向完全不变。\n只把人物的表情与情绪表达设置成提示词中指定的情绪，让神态自然贴合，面部肌肉、眉眼与口型的变化符合真实解剖与情绪逻辑。\n不要替换人物、不要改变年龄与性别特征、不要调整机位与景别、不要增删画面中的任何元素。\n输出与参考图同视角、同规格的高清图像。",
    },
    # ===== 脚本节点「智能合成」用的两段改写指令（r783）=====
    # ★ 正文里用 `【字段名】` 做占位，服务端在 `render_preset_template()` 里替换成这一镜的实际值。
    #   占位名必须和前端 `PROMPT_FIELD_TOKENS` / `SCRIPT_PROMPT_FIELDS` 保持一致。
    # ★ 为什么模板放服务端而不是前端：预设提示词正文按设计**只下发给管理员**
    #   （`preset_prompts_for_role()` 会给非管理员剥掉 prompt），普通用户合成时拿不到正文，
    #   所以只能由服务端注入。
    "script_prompt_image": {
        'title': "脚本节点 · 分镜提示词",
        'desc': "「合成提示词」里生成分镜提示词（用于生图）的那段改写指令",
        'placeholder': "把下面这一镜的分镜信息，改写成一段可直接用于 AI 生成图片的画面提示词",
        'icon': "slashStoryboard",
        'prompt': "你是影视分镜师。下面是这一镜的分镜信息，请改写为一段可直接用于 AI 生成图片的画面提示词。\n\n【时长】\n【画面描述】\n【景别】\n【光影构图】\n【对白旁白】\n【音效】\n\n硬性要求：\n1. 只使用上面给出的信息，不得添加任何未提及的情绪、故事、人物关系或心理活动；\n2. 输出一段话，用逗号连接，不要分号分句、不要换行、不要小标题、不要编号、不要解释；\n3. 上面每一项字段都要落到文字里，尤其是时长（写成「5 秒」这种）、景别、光影与运镜，一项都不能丢；\n4. 形如「@角色名」的引用要写成角色名本身（去掉 @ 符号）—— @ 只是画布里的引用语法，不能进最终提示词；\n5. 按「主体与动作 → 景别与构图 → 光影氛围 → 画面质感」的顺序组织；\n6. 结尾用一句画质描述收尾（例如「高清细腻画质」）；\n7. 全段 60–120 字，信息要铺开写，不要压缩成短句，也不要重复同一个意思；\n参考下面这段的信息密度与句式（只学写法，内容一律以本次分镜信息为准，绝对不要照抄）：\n主体在逆光氛围中缓慢向前走动，近景构图，逆光勾勒出柔和轮廓光，画面温暖朦胧，电影级光影质感，镜头缓慢拉远，高清细腻画质。",
    },
    "script_prompt_video": {
        'title': "脚本节点 · 视频运动提示词",
        'desc': "「合成提示词」里生成视频运动提示词（用于生视频）的那段改写指令",
        'placeholder': "把下面这一镜的分镜信息，改写成一段可直接用于 AI 生成视频的镜头运动提示词",
        'icon': "cinematic",
        'prompt': "你是影视分镜师。下面是这一镜的分镜信息，请改写为一段可直接用于 AI 生成视频的镜头运动提示词。\n\n【时长】\n【画面描述】\n【景别】\n【光影构图】\n【对白旁白】\n【音效】\n\n硬性要求：\n1. 只使用上面给出的信息，不得添加任何未提及的情绪、故事、人物关系或心理活动；\n2. 输出一段话，用逗号连接，不要分号分句、不要换行、不要小标题、不要编号、不要解释；\n3. 上面每一项字段都要落到文字里，尤其是时长（写成「5 秒」这种）、景别、光影与运镜，一项都不能丢；\n4. 形如「@角色名」的引用要写成角色名本身（去掉 @ 符号）—— @ 只是画布里的引用语法，不能进最终提示词；\n5. 重点写清楚镜头怎么动：起幅、运动方式与节奏、落幅，以及主体的动作；\n6. 结尾用一句画质描述收尾（例如「高清细腻画质」）；\n7. 全段 60–120 字，信息要铺开写，不要压缩成短句，也不要重复同一个意思；\n参考下面这段的信息密度与句式（只学写法，内容一律以本次分镜信息为准，绝对不要照抄）：\n镜头以缓慢平滑的节奏向后拉远，展现主体逆光剪影与轮廓，持续 5 秒后落幅于近景全身，捕捉其向前行走的动态，高清细腻画质。",
    },
}

# 脚本节点「智能合成」模板里的占位名（与前端 PROMPT_FIELD_TOKENS 一一对应）
SCRIPT_PROMPT_FIELDS = ('时长', '画面描述', '景别', '光影构图', '对白旁白', '音效')


def render_preset_template(template, fields):
    """把模板里的 `【字段名】` 占位替换成这一镜的实际值。

    ★ 只替换**已知的 6 个字段名** —— 模板里可能还有别的方括号内容（比如示例文案），
      无条件替换会把它们也吃掉。
    """
    text = str(template or '')
    values = fields if isinstance(fields, dict) else {}
    for name in SCRIPT_PROMPT_FIELDS:
        token = '【' + name + '】'
        if token in text:
            text = text.replace(token, str(values.get(name) or '').strip())
    return text

# ===== 角色库的「全局角色」（管理员维护的那一份）=====
# ★★ 角色库的**增 / 改 / 删全部按角色分层**（用户明确要求）：
#   · **管理员**：新增 → 所有人可见；编辑 → 所有人看到新内容；删除 → 所有人都看不到。
#   · **普通用户 / VIP**：新增 / 编辑 / 删除**都只影响自己**，别人的角色库不受任何影响。
#   所以这里只存**管理员**那一份，字段分三块：
#     · `deleted`   —— 被管理员全局删掉的预置角色 id；
#     · `overrides` —— 被管理员改过的预置角色（id → 角色对象，覆盖内置默认值）；
#     · `custom`    —— 管理员**新增**的角色（全局可见，别人也能用）。
#   普通用户的任何写操作都不会进这个文件（前端只写自己的 localStorage）。
PRESET_ROLES_FILE = DATA_DIR / 'preset-roles.json'


def _clean_role(item):
    """把前端传来的角色对象收敛成服务端认可的形状（字段白名单 + 长度夹紧）。"""
    if not isinstance(item, dict):
        return None
    role_id = str(item.get('id') or '').strip()[:80]
    name = str(item.get('name') or '').strip()[:40]
    if not role_id or not name:
        return None
    images = item.get('images')
    return {
        'id': role_id,
        'name': name,
        'value': str(item.get('value') or item.get('prompt') or '').strip(),
        'tags': [str(tag).strip()[:20] for tag in (item.get('tags') or []) if str(tag or '').strip()][:8],
        'images': [str(img or '')[:200000] for img in (images if isinstance(images, list) else [])][:4],
    }


def read_preset_roles():
    """读取管理员维护的全局角色（删除列表 / 预置覆盖 / 新增角色）。"""
    stored = read_file(PRESET_ROLES_FILE, {})
    if not isinstance(stored, dict):
        stored = {}
    deleted = stored.get('deleted')
    ids = [str(item).strip()[:80] for item in deleted if str(item or '').strip()][:500] if isinstance(deleted, list) else []
    overrides = {}
    raw_overrides = stored.get('overrides')
    if isinstance(raw_overrides, dict):
        for key, value in list(raw_overrides.items())[:500]:
            cleaned = _clean_role(value)
            if cleaned:
                overrides[str(key)[:80]] = cleaned
    custom = []
    raw_custom = stored.get('custom')
    if isinstance(raw_custom, list):
        for value in raw_custom[:200]:
            cleaned = _clean_role(value)
            if cleaned:
                custom.append(cleaned)
    return {'deleted': ids, 'overrides': overrides, 'custom': custom}


def write_preset_roles(payload):
    """管理员保存全局角色（整表覆盖）。"""
    payload = payload if isinstance(payload, dict) else {}
    deleted = payload.get('deleted')
    ids = [str(item).strip()[:80] for item in deleted if str(item or '').strip()][:500] if isinstance(deleted, list) else []
    overrides = {}
    raw_overrides = payload.get('overrides')
    if isinstance(raw_overrides, dict):
        for key, value in list(raw_overrides.items())[:500]:
            cleaned = _clean_role(value)
            if cleaned:
                overrides[str(key)[:80]] = cleaned
    custom = []
    raw_custom = payload.get('custom')
    if isinstance(raw_custom, list):
        for value in raw_custom[:200]:
            cleaned = _clean_role(value)
            if cleaned:
                custom.append(cleaned)
    result = {'deleted': ids, 'overrides': overrides, 'custom': custom}
    write_file(PRESET_ROLES_FILE, {'version': 2, 'updatedAt': auth_iso(), **result})
    return result


# ===== 角色库的双作用域（r796）=====
# 与「模型注册表」（r794）同一套思路，但这里的两个作用域是**产品语义**：
#   global = **官方角色库** —— 所有账号都看得到，只有管理员能改；
#   mine   = **我的角色库** —— 该账号自己那份（自建角色 + 对官方卡的私有改动），别人看不到。
# 存储形状（preset-roles.json）：
#   { version:3, deleted:[], overrides:{}, custom:[],
#     users: { '<userId>': {deleted:[], overrides:{}, custom:{}} } }
# ★ 向后兼容：老文件没有 `users` → 天然「谁都没有私有那份」，不用迁移。
ROLE_SCOPES = ('global', 'mine')


def read_preset_roles_raw():
    stored = read_file(PRESET_ROLES_FILE, {})
    if not isinstance(stored, dict):
        stored = {}
    if not isinstance(stored.get('users'), dict):
        stored = {**stored, 'users': {}}
    return stored


def _clean_role_bucket(raw):
    """把 `{deleted, overrides, custom}` 三件套收敛成服务端认可的形状。"""
    raw = raw if isinstance(raw, dict) else {}
    deleted = raw.get('deleted')
    ids = [str(item).strip()[:80] for item in deleted if str(item or '').strip()][:500] if isinstance(deleted, list) else []
    overrides = {}
    raw_overrides = raw.get('overrides')
    if isinstance(raw_overrides, dict):
        for key, value in list(raw_overrides.items())[:500]:
            cleaned = _clean_role(value)
            if cleaned:
                overrides[str(key)[:80]] = cleaned
    custom = []
    raw_custom = raw.get('custom')
    if isinstance(raw_custom, list):
        for value in raw_custom[:200]:
            cleaned = _clean_role(value)
            if cleaned:
                custom.append(cleaned)
    return {'deleted': ids, 'overrides': overrides, 'custom': custom}


def scoped_preset_roles(scope, user_id):
    """取某个作用域那一批（**不合并**）。"""
    stored = read_preset_roles_raw()
    if scope == 'mine':
        if not user_id:
            return {'deleted': [], 'overrides': {}, 'custom': []}
        return _clean_role_bucket((stored.get('users') or {}).get(user_id))
    return _clean_role_bucket(stored)


def write_scoped_preset_roles(scope, user_id, payload):
    """**只替换该作用域那一批** —— 别的用户 / 全局那份原样保留（私有隔离的命门）。"""
    bucket = _clean_role_bucket(payload)
    stored = read_preset_roles_raw()
    if scope == 'mine':
        if not user_id:
            raise ValueError('missing user')
        users = dict(stored.get('users') or {})
        users[str(user_id)] = bucket
        stored = {**stored, 'users': users}
    else:
        stored = {**stored, **bucket}
    stored['version'] = 3
    stored['updatedAt'] = auth_iso()
    write_file(PRESET_ROLES_FILE, stored)
    return bucket


def visible_preset_roles(user_id):
    """下发给某个账号的**合并视图**：全局那份 + 他自己的私有那份（私有优先）。

    `deleted` 取并集；`overrides` 私有覆盖全局；`custom` 两边相加（再去掉被删的）。
    ★ 额外回一份 `mine` —— 前端要靠它区分「我的角色库」的卡（以及配额只算这一份）。
    """
    global_bucket = scoped_preset_roles('global', '')
    mine = scoped_preset_roles('mine', user_id)
    deleted = list(dict.fromkeys([*global_bucket['deleted'], *mine['deleted']]))
    gone = set(deleted)
    overrides = {**global_bucket['overrides'], **mine['overrides']}
    custom = [item for item in [*global_bucket['custom'], *mine['custom']] if str(item.get('id') or '') not in gone]
    # `global` 单独回一份：前端要拿它当"官方原版"的基线，判断某张预置卡到底有没有被我改过
    # （不这么做，非管理员保存一次就会把 24 张预置卡全部冻结成自己的旧副本）。
    return {'deleted': deleted, 'overrides': overrides, 'custom': custom, 'mine': mine, 'global': global_bucket}


def role_storage_bytes(role):
    """角色卡素材的字节数。口径与素材一致：内联 base64 按**解码后**体积算。"""
    if not isinstance(role, dict):
        return 0
    total = 0
    for image in (role or {}).get('images') or []:
        value = str(image or '')
        if value.startswith('data:'):
            _, _, payload = value.partition(',')
            total += max(0, len(payload) * 3 // 4)
        elif value.startswith('/media/'):
            path = resolve_media_file(value.rsplit('/', 1)[-1])
            if path:
                try:
                    total += path.stat().st_size
                except OSError:
                    pass
    return total


def user_role_storage_bytes(user_id):
    """该账号**私有**角色卡的素材占用（官方角色库不计入，用户明确要求）。

    ★ 私有那份里既可能有自建角色（`custom`），也可能有对官方卡的私有改动（`overrides`）——
      两者都是"我自己的内容"，一起算。
    """
    if not user_id:
        return 0
    mine = scoped_preset_roles('mine', user_id)
    roles = [*mine['custom'], *(mine['overrides'] or {}).values()]
    return sum(role_storage_bytes(role) for role in roles)


# ===== 预设提示词的读取 / 保存 / 注入 =====

PRESET_PROMPTS_FILE = DATA_DIR / 'preset-prompts.json'
_PRESET_PROMPTS_CACHE = {'value': None}


def read_preset_prompts():
    """读取预设提示词表（内置默认 + 管理员改过的覆盖值，合并后）。

    ★ 返回的是**完整表**，只在服务端内部使用 —— 对外一律走 `preset_prompts_for_role()`，
      它会给非管理员剥掉 prompt 正文。这是「普通用户看不到提示词」的服务端保证。
    """
    if _PRESET_PROMPTS_CACHE['value'] is not None:
        return _PRESET_PROMPTS_CACHE['value']
    stored = read_file(PRESET_PROMPTS_FILE, {})
    overrides = stored.get('prompts') if isinstance(stored, dict) and isinstance(stored.get('prompts'), dict) else {}
    merged = {}
    for scene, default in PRESET_PROMPT_DEFAULTS.items():
        item = dict(default)
        override = overrides.get(scene)
        if isinstance(override, str) and override.strip():
            item['prompt'] = override
        merged[scene] = item
    _PRESET_PROMPTS_CACHE['value'] = merged
    return merged


def write_preset_prompts(incoming):
    """管理员保存。

    ★ 只落"与默认值不同"的项：以后改了 app.js 里的默认文案，没被管理员动过的那些会自动跟着变，
      不会被一份陈旧的整表快照钉死。
    """
    prompts = incoming.get('prompts') if isinstance(incoming, dict) else None
    if not isinstance(prompts, dict):
        return None
    overrides = {}
    for scene, value in prompts.items():
        key = str(scene)[:80]
        if key not in PRESET_PROMPT_DEFAULTS:
            continue
        text = str(value or '').strip()
        if not text or text == PRESET_PROMPT_DEFAULTS[key]['prompt']:
            continue
        overrides[key] = text
    payload = {'version': 1, 'updatedAt': auth_iso(), 'prompts': overrides}
    write_file(PRESET_PROMPTS_FILE, payload)
    _PRESET_PROMPTS_CACHE['value'] = None      # 下次读重新合并
    return payload


def reset_preset_prompts():
    """恢复默认：清空全部覆盖值。"""
    payload = {'version': 1, 'updatedAt': auth_iso(), 'prompts': {}}
    write_file(PRESET_PROMPTS_FILE, payload)
    _PRESET_PROMPTS_CACHE['value'] = None
    return payload


def preset_prompt_text(scene):
    """按 scene 取提示词正文（生成时注入用）。取不到返回空串。"""
    key = str(scene or '').strip()[:80]
    if not key:
        return ''
    item = read_preset_prompts().get(key)
    return str(item.get('prompt') or '') if item else ''


def preset_prompts_for_role(is_admin):
    """对外视图：**非管理员拿不到 `prompt` 字段**（正文不下发）。"""
    out = {}
    for scene, item in read_preset_prompts().items():
        default_prompt = PRESET_PROMPT_DEFAULTS.get(scene, {}).get('prompt')
        entry = {
            'title': item.get('title') or '',
            'desc': item.get('desc') or '',
            'placeholder': item.get('placeholder') or '',
            'icon': item.get('icon') or '',
            # 让管理员一眼看出哪些项被改过（前端给这些项打「已自定义」标记）
            'custom': item.get('prompt') != default_prompt,
        }
        if is_admin:
            entry['prompt'] = item.get('prompt') or ''
        out[scene] = entry
    return out


# ===== 运镜广场 / 表情编辑器的提示词（r832 · 全局一套，只有管理员能编辑）=====
#
# 与 `PRESET_PROMPT_DEFAULTS` 同一套「内置默认表 + 管理员覆盖」的机制，**但有一条关键差别**：
#   · 预设提示词：正文**只下发给管理员**（非管理员生成时由服务端注入）；
#   · 这两张表：正文**对所有登录用户下发**。
#     原因：`[[运镜:固定镜头]]` / `[[表情:愤怒|3]]` 这两个 token 是**浏览器侧**展开的
#     （`resolvePromptTokens()` 在提交前把 token 换成自然语言），非管理员拿不到正文就会
#     落回短名（等于没有提示词）。
#   → 所以「只有管理员可以看到和编辑」在这里的落点是：**编辑入口只对管理员渲染**。
### DOCK_PROMPT_DEFAULTS_START ###
# ★★★ 本表由 `_extract_dock_prompts.js` 从 app.js 的 CAMERA_MOTION_PRESETS / EMOTION_WHEEL /
#   EMOTION_CALM / EMOTION_DYNAMIC_TEMPLATE_FIELDS 生成（运镜正文在该脚本里人工撰写）。
#   **别手改这里** —— 改完跑：
#     node _extract_dock_prompts.js --write
#   守卫测试 `_test_dock_prompt_defaults.py` 盯着两边逐字一致。

# ===== 运镜广场的提示词（key = CAMERA_MOTION_PRESETS 的 id）=====
CAMERA_PROMPT_DEFAULTS = {
    "motion-01": {'title': "固定镜头", 'prompt': "镜头固定不动，机位、焦段与构图全程保持稳定，画面内只有主体与环境元素在运动。"},
    "motion-02": {'title': "跟随拍摄", 'prompt': "镜头跟随主体同步移动，与主体保持相对固定的距离与高度，背景持续向后掠过。"},
    "motion-03": {'title': "盘旋抬升", 'prompt': "镜头围绕主体盘旋的同时逐渐向上抬升，视角由平视转为俯视。"},
    "motion-04": {'title': "盘旋下降", 'prompt': "镜头围绕主体盘旋的同时逐渐向下降低，视角由平视转为仰视。"},
    "motion-05": {'title': "镜头上摇", 'prompt': "镜头机位不动，镜头向上摇摄，画面由下往上扫过场景。"},
    "motion-06": {'title': "镜头下摇", 'prompt': "镜头机位不动，镜头向下摇摄，画面由上往下扫过场景。"},
    "motion-07": {'title': "镜头左摇", 'prompt': "镜头机位不动，镜头向左水平摇摄，画面由右向左扫过场景。"},
    "motion-08": {'title': "镜头右摇", 'prompt': "镜头机位不动，镜头向右水平摇摄，画面由左向右扫过场景。"},
    "motion-09": {'title': "镜头上升", 'prompt': "镜头垂直向上运动，机位升高，画面自上而下展开更开阔的视野。"},
    "motion-10": {'title': "镜头下降", 'prompt': "镜头垂直向下运动，机位降低，视角逐渐贴近地面。"},
    "motion-11": {'title': "镜头左移", 'prompt': "镜头水平向左平移，与主体保持等距，前景与背景产生视差。"},
    "motion-12": {'title': "镜头右移", 'prompt': "镜头水平向右平移，与主体保持等距，前景与背景产生视差。"},
    "motion-13": {'title': "镜头前推", 'prompt': "镜头向主体缓慢推进，主体在画面中逐渐放大，景别由中景收向近景。"},
    "motion-14": {'title': "镜头后移", 'prompt': "镜头从主体缓慢向后拉远，主体逐渐变小，环境全貌依次展开。"},
    "motion-15": {'title': "变焦推进", 'prompt': "机位不动，焦段向长焦推进，视角收窄、主体放大，背景压缩感增强。"},
    "motion-16": {'title': "变焦拉远", 'prompt': "机位不动，焦段向广角拉远，视角变宽、主体缩小，环境纳入更多。"},
    "motion-17": {'title': "柯克变焦", 'prompt': "机位向后移动的同时焦段向前推进，主体大小基本不变而背景剧烈伸缩，形成眩晕的希区柯克变焦效果。"},
    "motion-18": {'title': "环绕拍摄", 'prompt': "镜头围绕主体做水平环绕运动，始终保持主体在画面中心，背景连续变化。"},
    "motion-19": {'title': "滚筒旋转", 'prompt': "镜头沿光轴方向旋转，画面产生滚筒式倾斜与翻滚。"},
    "motion-20": {'title': "第一视角", 'prompt': "采用第一人称视角，镜头即人物双眼，随人物动作与头部转动自然变化。"},
    "motion-21": {'title': "无人机", 'prompt': "无人机视角跟拍，镜头在空中平滑移动并保持对主体的跟随。"},
    "motion-22": {'title': "高空航拍", 'prompt': "高空俯瞰航拍，镜头自高处缓慢平移或下降，展现大范围地形与场景布局。"},
    "motion-23": {'title': "手持拍摄", 'prompt': "手持拍摄，画面带有轻微自然的晃动与呼吸感，构图略有漂移，纪实风格。"},
}

# ===== 表情编辑器 · 静态提示词（key = `calm` 或 `<情绪 id>-<强度 1..5>`）=====
EMOTION_PROMPT_DEFAULTS = {
    'calm': {'title': "平静", 'prompt': "眉眼自然放松，双唇轻合，下颌保持松弛"},
    "joy-1": {'title': "喜悦 · 微露笑意", 'prompt': "嘴角轻提并保持对称，双颊微微上托，眼睑轻柔收窄"},
    "joy-2": {'title': "喜悦 · 浅笑", 'prompt': "嘴角清楚向外上扬，双颊轻度隆起，眼下出现柔和笑意"},
    "joy-3": {'title': "喜悦 · 明朗笑容", 'prompt': "嘴角向外上方展开，双颊明显抬起，唇间微分并露出上齿"},
    "joy-4": {'title': "喜悦 · 大笑", 'prompt': "嘴角大幅上扬，双颊饱满高抬，双眼因笑意明显收窄，上齿自然显露"},
    "joy-5": {'title': "喜悦 · 开怀大笑", 'prompt': "下颌自然打开，上下齿清楚可见，双颊高抬，眼角笑纹清晰"},
    "surprise-1": {'title': "吃惊 · 轻微意外", 'prompt': "双眉轻轻抬起，上眼睑略微打开，嘴唇保持自然闭合"},
    "surprise-2": {'title': "吃惊 · 察觉意外", 'prompt': "双眉明显上提，双眼睁大，双唇轻微分开"},
    "surprise-3": {'title': "吃惊 · 明显吃惊", 'prompt': "眉毛高抬并形成弧形，双眼明显睁大，嘴唇张成小圆形"},
    "surprise-4": {'title': "吃惊 · 强烈震惊", 'prompt': "双眉高高抬起，眼白明显显露，下颌快速下落，嘴巴张开"},
    "surprise-5": {'title': "吃惊 · 极度震惊", 'prompt': "额眉充分上提，双眼圆睁，下颌大幅打开，嘴巴形成纵向圆口"},
    "fear-1": {'title': "恐惧 · 隐约害怕", 'prompt': "眉头轻抬并向内靠拢，双眼略微睁大，嘴角轻向两侧绷紧"},
    "fear-2": {'title': "恐惧 · 不安恐惧", 'prompt': "双眉内侧上提，眼白略微显露，嘴唇横向绷紧"},
    "fear-3": {'title': "恐惧 · 明显恐惧", 'prompt': "眉头高抬并紧靠，双眼睁大，嘴角向两侧拉开，唇间微张"},
    "fear-4": {'title': "恐惧 · 强烈惊恐", 'prompt': "眉头高抬紧缩，双眼圆睁，嘴唇向两侧拉紧，下颌明显打开"},
    "fear-5": {'title': "恐惧 · 极度惊恐", 'prompt': "双眉高抬并强烈内收，眼白大幅显露，嘴角极度横拉，下颌大幅张开"},
    "anxiety-1": {'title': "焦虑 · 轻微焦虑", 'prompt': "眉头略微上提，目光保持警觉，双唇轻轻抿住"},
    "anxiety-2": {'title': "焦虑 · 紧张不安", 'prompt': "眉头向内上方聚拢，双眼略微睁大，嘴角向两侧收紧"},
    "anxiety-3": {'title': "焦虑 · 明显焦虑", 'prompt': "眉头明显内聚上提，上眼睑抬高，嘴唇绷紧，下颌轻度紧张"},
    "anxiety-4": {'title': "焦虑 · 强烈焦虑", 'prompt': "双眉紧靠并抬起，双眼警觉睁大，嘴角横向拉紧，下唇轻颤般绷住"},
    "anxiety-5": {'title': "焦虑 · 濒临崩溃", 'prompt': "眉头高抬紧缩，双眼紧张圆睁，嘴唇强烈绷紧，下颌僵住"},
    "sadness-1": {'title': "悲伤 · 淡淡悲伤", 'prompt': "眉头轻轻上提，上眼睑略微下垂，嘴角轻度下沉"},
    "sadness-2": {'title': "悲伤 · 低落", 'prompt': "眉头向内上方抬起，双眼显得沉重，嘴角明显下弯"},
    "sadness-3": {'title': "悲伤 · 明显悲伤", 'prompt': "眉头明显抬起并靠拢，眼睑低垂，嘴角向下牵拉，下巴轻皱"},
    "sadness-4": {'title': "悲伤 · 深切悲伤", 'prompt': "眉头高抬紧靠，双眼湿润般半垂，嘴角显著下沉，下唇轻微推出"},
    "sadness-5": {'title': "悲伤 · 悲恸欲哭", 'prompt': "眉头强烈上提内收，双眼痛苦收窄，嘴角大幅下拉，下巴明显颤紧"},
    "pain-1": {'title': "痛苦 · 轻微不适", 'prompt': "眉头轻轻下压，眼睑略微收紧，嘴角轻度下沉"},
    "pain-2": {'title': "痛苦 · 忍受疼痛", 'prompt': "双眉向内下方压紧，双眼明显眯起，嘴唇轻轻绷住"},
    "pain-3": {'title': "痛苦 · 明显痛苦", 'prompt': "眉头紧锁，双眼用力收窄，鼻翼轻皱，嘴角向下绷紧"},
    "pain-4": {'title': "痛苦 · 强烈疼痛", 'prompt': "双眉强烈压紧，双眼几乎闭合，鼻部皱起，嘴巴痛苦张开"},
    "pain-5": {'title': "痛苦 · 剧烈痛苦", 'prompt': "眉眼极度紧缩，鼻根深皱，嘴角大幅下拉，下颌明显张开"},
    "suppression-1": {'title': "压抑 · 轻微克制", 'prompt': "眼睑轻度收紧，双唇轻轻抿住，下颌保持克制"},
    "suppression-2": {'title': "压抑 · 压住情绪", 'prompt': "眉眼略显紧张，双唇明显抿紧，嘴角保持水平"},
    "suppression-3": {'title': "压抑 · 明显压抑", 'prompt': "双眉轻度内压，眼睑明显收紧，嘴唇压紧，下巴轻皱"},
    "suppression-4": {'title': "压抑 · 强忍情绪", 'prompt': "眉头明显内压，双眼紧绷，嘴唇用力压住，下颌僵紧"},
    "suppression-5": {'title': "压抑 · 极度压抑", 'prompt': "眉眼强烈紧缩，嘴唇死死压紧，下巴明显隆起，下颌用力咬住"},
    "disgust-1": {'title': "厌恶 · 轻微反感", 'prompt': "鼻翼轻轻提起，上唇略微抬高，眼睑轻度收紧"},
    "disgust-2": {'title': "厌恶 · 明显嫌弃", 'prompt': "鼻部轻皱，上唇清楚抬起，双眼略微眯起"},
    "disgust-3": {'title': "厌恶 · 明显厌恶", 'prompt': "鼻翼明显皱起，上唇向上翻提，眼睑收紧，嘴角略向下"},
    "disgust-4": {'title': "厌恶 · 强烈厌恶", 'prompt': "鼻根和鼻翼显著皱缩，上唇高高抬起，双眼明显眯起，下唇略向下拉"},
    "disgust-5": {'title': "厌恶 · 极度厌恶", 'prompt': "鼻部强烈皱缩，上唇大幅翻起，双眼厌恶般收窄，嘴角向下扭曲"},
    "anger-1": {'title': "愤怒 · 轻微不悦", 'prompt': "眉头轻轻下压，目光变得集中，双唇略微收紧"},
    "anger-2": {'title': "愤怒 · 恼怒", 'prompt': "双眉向内下方聚拢，眼睑轻度收紧，嘴唇明显绷住"},
    "anger-3": {'title': "愤怒 · 明显愤怒", 'prompt': "眉头明显压紧，双眼锐利收窄，嘴唇用力抿紧，鼻翼轻张"},
    "anger-4": {'title': "愤怒 · 强烈愤怒", 'prompt': "双眉深深压紧，双眼怒视，鼻翼明显张开，嘴唇紧压，下颌前顶"},
    "anger-5": {'title': "愤怒 · 暴怒", 'prompt': "眉眼极度压紧，双眼强烈怒视，鼻翼扩张，嘴巴愤怒张开，下颌前冲"},
    "contempt-1": {'title': "轻蔑 · 轻微不屑", 'prompt': "一侧嘴角轻轻收紧，同侧眼睑略微收窄，另一侧保持平静"},
    "contempt-2": {'title': "轻蔑 · 浅露轻蔑", 'prompt': "一侧嘴角向上收紧，同侧面颊轻抬，目光略显冷淡"},
    "contempt-3": {'title': "轻蔑 · 明显轻蔑", 'prompt': "一侧嘴角明显上挑，同侧眼睑收窄，下唇略向反侧偏移"},
    "contempt-4": {'title': "轻蔑 · 强烈鄙视", 'prompt': "一侧嘴角高高挑起，同侧鼻翼轻提，同侧眼睛明显眯起，另一侧冷淡放松"},
    "contempt-5": {'title': "轻蔑 · 极度轻蔑", 'prompt': "一侧嘴角强烈扭起，同侧鼻翼皱缩，同侧眼睑紧收，下颌轻微侧偏"},
}

# ===== 表情编辑器 · 动态提示词（key = `tpl-*` 通用文案 / `<情绪 id>-<强度>` 每档正文）=====
#   ★ 每档正文默认是**空串** —— 语义是「沿用静态那一档」（管理员单独写了才落盘）。
EMOTION_DYNAMIC_PROMPT_DEFAULTS = {
    "tpl-head": {'title': "开头标记", 'prompt': "@表情变化："},
    "tpl-range": {'title': "时间范围", 'prompt': "{start}至{end}秒内，"},
    "tpl-prefix-first": {'title': "首帧前缀", 'prompt': "开场"},
    "tpl-prefix-mid": {'title': "中间帧前缀", 'prompt': "随后"},
    "tpl-prefix-last": {'title': "末帧前缀", 'prompt': "结尾"},
    "tpl-cue-joiner": {'title': "同帧要点分隔", 'prompt': "、"},
    "tpl-segment-joiner": {'title': "帧与帧分隔", 'prompt': "；"},
    "tpl-tail-normal": {'title': "结尾语", 'prompt': "；过渡连续自然"},
    "tpl-tail-loop": {'title': "循环结尾语", 'prompt': "；循环回到开场"},
    "tpl-fallback": {'title': "兜底要点", 'prompt': "眉眼放松"},
    "tpl-empty": {'title': "无关键帧整句", 'prompt': "@表情变化：全程眉眼放松、嘴唇自然闭合"},
    'calm': {'title': "平静", 'prompt': ""},
    "joy-1": {'title': "喜悦 · 微露笑意", 'prompt': ""},
    "joy-2": {'title': "喜悦 · 浅笑", 'prompt': ""},
    "joy-3": {'title': "喜悦 · 明朗笑容", 'prompt': ""},
    "joy-4": {'title': "喜悦 · 大笑", 'prompt': ""},
    "joy-5": {'title': "喜悦 · 开怀大笑", 'prompt': ""},
    "surprise-1": {'title': "吃惊 · 轻微意外", 'prompt': ""},
    "surprise-2": {'title': "吃惊 · 察觉意外", 'prompt': ""},
    "surprise-3": {'title': "吃惊 · 明显吃惊", 'prompt': ""},
    "surprise-4": {'title': "吃惊 · 强烈震惊", 'prompt': ""},
    "surprise-5": {'title': "吃惊 · 极度震惊", 'prompt': ""},
    "fear-1": {'title': "恐惧 · 隐约害怕", 'prompt': ""},
    "fear-2": {'title': "恐惧 · 不安恐惧", 'prompt': ""},
    "fear-3": {'title': "恐惧 · 明显恐惧", 'prompt': ""},
    "fear-4": {'title': "恐惧 · 强烈惊恐", 'prompt': ""},
    "fear-5": {'title': "恐惧 · 极度惊恐", 'prompt': ""},
    "anxiety-1": {'title': "焦虑 · 轻微焦虑", 'prompt': ""},
    "anxiety-2": {'title': "焦虑 · 紧张不安", 'prompt': ""},
    "anxiety-3": {'title': "焦虑 · 明显焦虑", 'prompt': ""},
    "anxiety-4": {'title': "焦虑 · 强烈焦虑", 'prompt': ""},
    "anxiety-5": {'title': "焦虑 · 濒临崩溃", 'prompt': ""},
    "sadness-1": {'title': "悲伤 · 淡淡悲伤", 'prompt': ""},
    "sadness-2": {'title': "悲伤 · 低落", 'prompt': ""},
    "sadness-3": {'title': "悲伤 · 明显悲伤", 'prompt': ""},
    "sadness-4": {'title': "悲伤 · 深切悲伤", 'prompt': ""},
    "sadness-5": {'title': "悲伤 · 悲恸欲哭", 'prompt': ""},
    "pain-1": {'title': "痛苦 · 轻微不适", 'prompt': ""},
    "pain-2": {'title': "痛苦 · 忍受疼痛", 'prompt': ""},
    "pain-3": {'title': "痛苦 · 明显痛苦", 'prompt': ""},
    "pain-4": {'title': "痛苦 · 强烈疼痛", 'prompt': ""},
    "pain-5": {'title': "痛苦 · 剧烈痛苦", 'prompt': ""},
    "suppression-1": {'title': "压抑 · 轻微克制", 'prompt': ""},
    "suppression-2": {'title': "压抑 · 压住情绪", 'prompt': ""},
    "suppression-3": {'title': "压抑 · 明显压抑", 'prompt': ""},
    "suppression-4": {'title': "压抑 · 强忍情绪", 'prompt': ""},
    "suppression-5": {'title': "压抑 · 极度压抑", 'prompt': ""},
    "disgust-1": {'title': "厌恶 · 轻微反感", 'prompt': ""},
    "disgust-2": {'title': "厌恶 · 明显嫌弃", 'prompt': ""},
    "disgust-3": {'title': "厌恶 · 明显厌恶", 'prompt': ""},
    "disgust-4": {'title': "厌恶 · 强烈厌恶", 'prompt': ""},
    "disgust-5": {'title': "厌恶 · 极度厌恶", 'prompt': ""},
    "anger-1": {'title': "愤怒 · 轻微不悦", 'prompt': ""},
    "anger-2": {'title': "愤怒 · 恼怒", 'prompt': ""},
    "anger-3": {'title': "愤怒 · 明显愤怒", 'prompt': ""},
    "anger-4": {'title': "愤怒 · 强烈愤怒", 'prompt': ""},
    "anger-5": {'title': "愤怒 · 暴怒", 'prompt': ""},
    "contempt-1": {'title': "轻蔑 · 轻微不屑", 'prompt': ""},
    "contempt-2": {'title': "轻蔑 · 浅露轻蔑", 'prompt': ""},
    "contempt-3": {'title': "轻蔑 · 明显轻蔑", 'prompt': ""},
    "contempt-4": {'title': "轻蔑 · 强烈鄙视", 'prompt': ""},
    "contempt-5": {'title': "轻蔑 · 极度轻蔑", 'prompt': ""},
}

DOCK_PROMPT_DEFAULTS = {
    'camera': CAMERA_PROMPT_DEFAULTS,
    'emotion': EMOTION_PROMPT_DEFAULTS,
    'emotionDynamic': EMOTION_DYNAMIC_PROMPT_DEFAULTS,
}
### DOCK_PROMPT_DEFAULTS_END ###

DOCK_PROMPTS_FILE = DATA_DIR / 'dock-prompts.json'
_DOCK_PROMPTS_CACHE = {'value': None}


def read_dock_prompts():
    """运镜 / 表情提示词（内置默认 + 管理员改过的覆盖值，合并后）。

    ★ 返回**完整表**，服务端内部与对外下发都用它（与 preset_prompts_for_role 不同，这里不剥正文）。
    """
    if _DOCK_PROMPTS_CACHE['value'] is not None:
        return _DOCK_PROMPTS_CACHE['value']
    stored = read_file(DOCK_PROMPTS_FILE, {})
    overrides = stored.get('prompts') if isinstance(stored, dict) and isinstance(stored.get('prompts'), dict) else {}
    merged = {}
    for kind, defaults in DOCK_PROMPT_DEFAULTS.items():
        kind_overrides = overrides.get(kind) if isinstance(overrides.get(kind), dict) else {}
        table = {}
        for key, default in defaults.items():
            item = dict(default)
            override = kind_overrides.get(key)
            if isinstance(override, str) and override.strip():
                item['prompt'] = override
            table[key] = item
        merged[kind] = table
    _DOCK_PROMPTS_CACHE['value'] = merged
    return merged


def write_dock_prompts(incoming):
    """管理员保存。

    ★ 只落「与默认值不同」的项 —— 以后改了默认文案，没被管理员动过的那些会自动跟着变
      （口径与 `write_preset_prompts` 完全一致）。
    ★★ 与 `write_preset_prompts` 的**关键差别**：这里是**按 kind 合并**，不是整表替换。
      原因：运镜广场与表情编辑器各有各的编辑面板，一次只提交自己那张表；
      整表替换会把另一张表的覆盖值**静默清空**（实测过：存完表情，运镜的自定义就没了）。
      没提交的 kind = 保持原样；提交了但全是默认值 = 清掉该 kind 的覆盖。
    """
    prompts = incoming.get('prompts') if isinstance(incoming, dict) else None
    if not isinstance(prompts, dict):
        return None
    stored = read_file(DOCK_PROMPTS_FILE, {})
    overrides = {}
    if isinstance(stored, dict) and isinstance(stored.get('prompts'), dict):
        overrides = {str(k): dict(v) for k, v in stored['prompts'].items() if isinstance(v, dict)}
    for kind, defaults in DOCK_PROMPT_DEFAULTS.items():
        incoming_kind = prompts.get(kind)
        if not isinstance(incoming_kind, dict):
            continue
        kind_overrides = {}
        for key, value in incoming_kind.items():
            key = str(key)[:80]
            if key not in defaults:
                continue
            text = str(value or '').strip()
            if not text or text == defaults[key]['prompt']:
                continue
            kind_overrides[key] = text
        if kind_overrides:
            overrides[kind] = kind_overrides
        else:
            overrides.pop(kind, None)
    payload = {'version': 1, 'updatedAt': auth_iso(), 'prompts': overrides}
    write_file(DOCK_PROMPTS_FILE, payload)
    _DOCK_PROMPTS_CACHE['value'] = None      # 下次读重新合并
    return payload


def reset_dock_prompts(kind=None):
    """恢复默认：清空覆盖值。

    ★ `kind` 给了就**只清那一张表**（运镜 / 表情各自一个入口，别互相清掉）。
      不认识的 kind 返回 None（路由层回 400）。
    """
    if kind:
        key = str(kind).strip()[:20]
        if key not in DOCK_PROMPT_DEFAULTS:
            return None
        stored = read_file(DOCK_PROMPTS_FILE, {})
        overrides = stored.get('prompts') if isinstance(stored, dict) and isinstance(stored.get('prompts'), dict) else {}
        overrides.pop(key, None)
        payload = {'version': 1, 'updatedAt': auth_iso(), 'prompts': overrides}
    else:
        payload = {'version': 1, 'updatedAt': auth_iso(), 'prompts': {}}
    write_file(DOCK_PROMPTS_FILE, payload)
    _DOCK_PROMPTS_CACHE['value'] = None
    return payload


def dock_prompts_payload():
    """对外视图（**所有人都拿得到正文**，见本节开头的说明）。"""
    merged = read_dock_prompts()
    out = {}
    for kind, defaults in DOCK_PROMPT_DEFAULTS.items():
        table = {}
        for key, item in merged.get(kind, {}).items():
            table[key] = {
                'title': item.get('title') or '',
                'prompt': item.get('prompt') or '',
                # 让管理员一眼看出哪些项被改过（前端给这些项打「已自定义」标记）
                'custom': item.get('prompt') != (defaults.get(key) or {}).get('prompt'),
            }
        out[kind] = table
    return out


# ===== 应用级设置（偏好设置面板 · 通用设置）：生成超时等运行时参数 =====
#
# ★★★ 双作用域（r803）—— 「我改了超时，别的账号一点感觉都没有」：
#   · `timeouts`              = **全局默认**（管理员改）→ 所有没做个人覆盖的账号都吃它；
#   · `users[uid].timeouts`   = **我的生成超时**（任何登录用户改）→ 只影响自己。
#   生效顺序（从具体到笼统）：供应商条目自带 `generationTimeouts` > 我的覆盖 > 全局默认。
#   沿用项目里既有的双作用域约定（官方/我的角色库、主供应商/私有模型）。
APP_SETTINGS_FILE = DATA_DIR / 'app-settings.json'
DEFAULT_APP_SETTINGS = {
    'timeouts': {
        'textExec': 60,        # 文本执行：单次文本 / 多模态请求超时（秒）
        'imageExec': 120,      # 图片执行：单次图片生成请求超时（秒）
        'videoSubmit': 180,    # 视频提交：提交生成任务请求超时（秒）
        'statusPoll': 60,      # 单次状态查询：轮询供应商任务状态超时（秒）
        'imageTotalWait': 3,   # 图片总等待：图片生成整体预算（分钟）
        'videoTotalWait': 20,  # 视频总等待：视频任务最长等待（分钟）
    },
    'users': {},               # { <userId>: { 'timeouts': { 只存被改过的项 } } }
}
TIMEOUT_LIMITS = {
    'textExec': (5, 600), 'imageExec': (5, 900), 'videoSubmit': (5, 900),
    'statusPoll': (3, 120), 'imageTotalWait': (1, 60), 'videoTotalWait': (1, 240),
}
_APP_SETTINGS_CACHE = {'value': None}


def clamp_timeouts(payload):
    """把一组超时值按 TIMEOUT_LIMITS 夹紧，返回只含合法键的 dict。

    ★ 全局默认与个人覆盖**共用**这一个夹紧器 —— 两套阈值不一致会让「覆盖」失去意义。
    """
    out = {}
    if not isinstance(payload, dict):
        return out
    for key, (low, high) in TIMEOUT_LIMITS.items():
        if key not in payload:
            continue
        try:
            value = int(float(payload.get(key)))
        except (TypeError, ValueError, OverflowError):
            continue
        out[key] = max(low, min(high, value))
    return out


def read_app_settings():
    """读取应用设置；所有字段都按上下限夹紧，避免面板里填出会拖死服务的值。

    ★ 个人覆盖也要一起读出来（并且一起夹紧）—— 少了这一层，
      `write_app_settings()` 写回全局时会把所有人的个人覆盖**整段抹掉**。
    """
    if _APP_SETTINGS_CACHE['value'] is not None:
        return _APP_SETTINGS_CACHE['value']
    # fallback 直接用默认值：read_file 首次会用它建文件，免得落一个空对象不好手动改。
    stored = read_file(APP_SETTINGS_FILE, DEFAULT_APP_SETTINGS)
    if not isinstance(stored, dict): stored = {}
    incoming = stored.get('timeouts') if isinstance(stored.get('timeouts'), dict) else {}
    merged = {'timeouts': dict(DEFAULT_APP_SETTINGS['timeouts']), 'users': {}}
    for key, (low, high) in TIMEOUT_LIMITS.items():
        try:
            value = int(incoming.get(key))
        except (TypeError, ValueError, OverflowError):
            continue
        merged['timeouts'][key] = max(low, min(high, value))
    raw_users = stored.get('users')
    if isinstance(raw_users, dict):
        for uid, entry in raw_users.items():
            if not isinstance(entry, dict):
                continue
            clamped = clamp_timeouts(entry.get('timeouts'))
            if clamped:
                merged['users'][str(uid)] = {'timeouts': clamped}
    _APP_SETTINGS_CACHE['value'] = merged
    return merged


def write_app_settings(incoming):
    """写**全局默认**超时（仅管理员）。个人覆盖原样保留。"""
    current = read_app_settings()
    payload = incoming.get('timeouts') if isinstance(incoming, dict) and isinstance(incoming.get('timeouts'), dict) else incoming
    if isinstance(payload, dict):
        for key, (low, high) in TIMEOUT_LIMITS.items():
            if key not in payload: continue
            try:
                value = int(payload.get(key))
            except (TypeError, ValueError, OverflowError):
                continue
            current['timeouts'][key] = max(low, min(high, value))
    write_file(APP_SETTINGS_FILE, current)
    _APP_SETTINGS_CACHE['value'] = current
    return current


def user_timeout_overrides(user_id):
    """该账号的个人超时覆盖（只含被改过的项；没改过就是空 dict）。"""
    uid = str(user_id or '').strip()
    if not uid:
        return {}
    users = read_app_settings().get('users')
    entry = users.get(uid) if isinstance(users, dict) else None
    timeouts = entry.get('timeouts') if isinstance(entry, dict) else None
    return dict(timeouts) if isinstance(timeouts, dict) else {}


def effective_timeouts(user_id):
    """该账号**实际生效**的一组超时 = 全局默认 + 个人覆盖（面板上显示的就是它）。"""
    merged = dict(read_app_settings()['timeouts'])
    merged.update(user_timeout_overrides(user_id))
    return merged


def with_user_timeouts(entry, user_id):
    """把「我的生成超时」投影进供应商条目副本。

    ★★ 这是**唯一**的注入点，挂在 `visible_ai_models()` 的出口上 —— 所有「按 modelId 取条目
       去调上游」的路径都经过它，于是底层那些 `call_xxx(entry, ...)` 一个都不用改签名
       （它们本来就拿不到用户身份，全项目 15 个函数都无 user 上下文）。
    ★ 供应商条目自带 `generationTimeouts`（卡片上的「独立生成超时」）**优先** ——
      它比账号级设置更具体，属于该供应商的拥有者。
    """
    overrides = user_timeout_overrides(user_id)
    if not overrides or not isinstance(entry, dict):
        return entry
    own = entry.get('generationTimeouts') if isinstance(entry.get('generationTimeouts'), dict) else {}
    projected = dict(entry)
    projected['generationTimeouts'] = {**overrides, **own}
    return projected


def write_user_timeouts(user_id, payload):
    """写某个账号的个人超时覆盖。值为 None / 空串的键 = **恢复默认**（删掉该键）。

    ★ 只落盘「真的被改过」的项：与全局默认相同的值不留痕，
      以后管理员调全局默认时，没动过的项会自然跟着走。
    """
    uid = str(user_id or '').strip()
    if not uid:
        return read_app_settings()
    current = read_app_settings()
    users = current.get('users') if isinstance(current.get('users'), dict) else {}
    entry = dict(users.get(uid) or {})
    mine = dict(entry.get('timeouts') or {})
    source = payload.get('timeouts') if isinstance(payload, dict) and isinstance(payload.get('timeouts'), dict) else payload
    if isinstance(source, dict):
        for key, (low, high) in TIMEOUT_LIMITS.items():
            if key not in source:
                continue
            raw = source.get(key)
            if raw is None or raw == '':
                mine.pop(key, None)          # 恢复默认 = 从覆盖层里移除
                continue
            try:
                value = int(float(raw))
            except (TypeError, ValueError, OverflowError):
                continue
            mine[key] = max(low, min(high, value))
    if mine: entry['timeouts'] = mine
    else: entry.pop('timeouts', None)
    if entry: users[uid] = entry
    else: users.pop(uid, None)
    current['users'] = users
    write_file(APP_SETTINGS_FILE, current)
    _APP_SETTINGS_CACHE['value'] = current
    return current


def timeout_value(key, fallback):
    try:
        return int(read_app_settings()['timeouts'].get(key, fallback))
    except (KeyError, TypeError, ValueError, OverflowError):
        return fallback


def app_settings_payload(user):
    """下发给偏好设置面板的设置视图：全局默认 + **我的**覆盖 + 我实际生效的那组。

    ★★ 只下发自己的个人覆盖，**绝不下发 `users` 全表** —— 那是别人账号的设置。
    """
    settings = read_app_settings()
    uid = (user or {}).get('id')
    mine = user_timeout_overrides(uid) if uid else {}
    return {
        'settings': {'timeouts': dict(settings['timeouts'])},
        'mine': {'timeouts': mine},
        'effective': {**settings['timeouts'], **mine},
        'limits': TIMEOUT_LIMITS,
        'role': (user or {}).get('role') or '',
        'canEditGlobal': (user or {}).get('role') == 'admin',
    }





def provider_timeout_value(entry, key, fallback):
    """按供应商取超时值：该供应商开了「独立生成超时」就用它的，否则回落全局。

    ★ 必须自己校验并夹紧，不能信任落盘的值：
      历史数据可能是手改的、或来自没有前端夹紧的接口调用，
      一个超大的值会让请求永久挂住（而「超时」这件事本身就是为了防这个）。
      夹紧规则与全局共用 TIMEOUT_LIMITS —— 两套阈值不一致会让「覆盖」失去意义。
    """
    if isinstance(entry, dict):
        overrides = entry.get('generationTimeouts')
        if isinstance(overrides, dict) and key in overrides:
            try:
                value = int(overrides[key])
            except (TypeError, ValueError, OverflowError):
                value = None
            if value is not None:
                low, high = TIMEOUT_LIMITS.get(key, (1, 3600))
                return max(low, min(high, value))
    return timeout_value(key, fallback)


# ---------------------------------------------------------------------------
# 对话式 Agent：会话存储
# ---------------------------------------------------------------------------
# 一条会话 = 一个 projectId 下的一段对话。messages 直接存模型能吃的原始形态
# （含 assistant.tool_calls 与 tool 消息），这样「刷新页面 / 重启服务后继续」都不丢上下文。

def read_agent_sessions():
    value = read_file(AGENT_SESSIONS_FILE, [])
    return value if isinstance(value, list) else []


def write_agent_sessions(items):
    write_file(AGENT_SESSIONS_FILE, items if isinstance(items, list) else [])










AGENT_SHARES_FILE = DATA_DIR / 'agent-shares.json'
AGENT_ACTIVE_SESSIONS = set()


def read_agent_shares():
    value = read_file(AGENT_SHARES_FILE, [])
    return value if isinstance(value, list) else []


def write_agent_shares(items):
    write_file(AGENT_SHARES_FILE, items if isinstance(items, list) else [])


def find_agent_share(share_id):
    for item in read_agent_shares():
        if item.get('shareId') == share_id:
            return item
    return None


AGENT_SKILLS_FILE = DATA_DIR / 'agent-skills.json'


def read_agent_skills():
    value = read_file(AGENT_SKILLS_FILE, [])
    return value if isinstance(value, list) else []


def write_agent_skills(items):
    write_file(AGENT_SKILLS_FILE, items if isinstance(items, list) else [])


def agent_skill_view(item):
    return {
        'id': item.get('id'), 'name': item.get('name') or '未命名技能',
        'description': item.get('description') or '', 'prompt': item.get('prompt') or '',
        'icon': item.get('icon') or 'wand', 'source': item.get('source') or 'user',
        'createdAt': item.get('createdAt') or '',
    }


def save_agent_skill(user_id, name, description='', prompt='', icon='wand', source='user'):
    """存一个技能（用户在面板里手写/导入，或 Agent 用 create_skill 工具存）。
    返回 (skill, error)。重名就直接覆盖 —— 技能是「按名字认」的，同名再存一遍是最自然的更新方式。
    技能**不按工作区隔离**：它是「我这个人的能力」，换个空间也该带着走，所以重名判据只看 userId。"""
    name = str(name or '').strip()[:60]
    prompt = str(prompt or '').strip()
    if not name:
        return None, '技能名不能为空'
    if not prompt:
        return None, '技能内容不能为空'
    with LOCK:
        items = read_agent_skills()
        exist = next((i for i in items if i.get('userId') == user_id and i.get('name') == name), None)
        if exist:
            exist.update({'description': str(description or '').strip()[:200], 'prompt': prompt,
                          'icon': icon or 'wand', 'updatedAt': now()})
            write_agent_skills(items)
            return agent_skill_view(exist), None
        skill = {
            'id': f"skill-{secrets.token_hex(6)}", 'userId': user_id, 'name': name,
            'description': str(description or '').strip()[:200], 'prompt': prompt,
            'icon': icon or 'wand', 'source': source, 'createdAt': now(), 'updatedAt': now(),
        }
        items.append(skill)
        write_agent_skills(items)
        return agent_skill_view(skill), None


def tool_result_summary(text, name=''):
    """把工具结果压成一句人话，给分享页用。

    工具返回的是一坨 JSON（`{"ok":true,"count":2,"optimized":[...]}`）。直接截 300 字
    会在分享页上摊出一片花括号，对方根本读不下去。这里按常见结构挑出「最有信息量的那句话」：
      ① 有 message/error 就直接用（那是给人看的）
      ② 有 count/n/数量 就报数
      ③ 否则退化成「调用成功 / 调用失败」
    拿不准的结构宁可少说，也不要把原始 JSON 倒出去。
    """
    raw = str(text or '').strip()
    label = str(name or '').strip()
    if not raw:
        return ''
    try:
        data = json.loads(raw)
    except (ValueError, TypeError):
        # 不是 JSON：多半本来就是纯文本结果，截断即可
        return raw[:300]
    if not isinstance(data, dict):
        if isinstance(data, list):
            return f'返回 {len(data)} 条结果'
        return raw[:300]
    for key in ('message', 'error', 'reason', 'detail'):
        value = data.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()[:300]
    if data.get('ok') is False:
        return '调用未成功'
    for key in ('count', 'total', 'n'):
        value = data.get(key)
        if isinstance(value, int) and not isinstance(value, bool):
            return f'共 {value} 项'
    for key, prefix in (('optimized', '优化了'), ('created', '创建了'), ('updated', '更新了'),
                        ('deleted', '删除了'), ('nodes', '涉及'), ('items', '共')):
        value = data.get(key)
        if isinstance(value, list) and value:
            return f'{prefix} {len(value)} 项'
    if data.get('ok') is True:
        return '调用成功'
    return f'{label} 已完成' if label else '已完成'


def share_message_view(item):
    """把一条会话消息压成分享页要用的最小形态。

    **有意丢掉的东西**：tool_calls 的原始 arguments、tool 结果的完整 JSON、
    base64 内嵌图。分享页是给人读的，不是给模型吃的 —— 把后端细节原样端出去
    既没必要（对方看不懂），也容易夹带不该外露的东西（节点 id、路径、报错栈）。
    只留下「谁说的 / 说了什么 / 调了哪个工具 / 这个工具的结果摘要」。
    """
    role = item.get('role') or ''
    content = item.get('content')
    if isinstance(content, (list, dict)):
        # 多模态内容：只取文本片段，图/音一律丢掉（它们的体积也扛不住）
        parts = content if isinstance(content, list) else [content]
        content = ' '.join(str(p.get('text') or '') for p in parts if isinstance(p, dict))
    text = str(content or '').strip()
    # 用户消息尾部可能挂着自动化控制块（<<...>>）。前端气泡显示时剥掉了，
    # 分享页也要一致 —— 不然对方看到的是 `<<FAKE:{"turns":[...]}>>` 这种噪声。
    if role == 'user':
        text = agent.strip_control_block(text).strip()
    view = {'role': role, 'content': text[:8000]}
    if role == 'assistant':
        calls = []
        for call in item.get('tool_calls') or []:
            fn = call.get('function') if isinstance(call, dict) else None
            if isinstance(fn, dict) and fn.get('name'):
                calls.append({'id': call.get('id'), 'name': str(fn.get('name'))[:60]})
        if calls:
            view['tools'] = calls
    if role == 'tool':
        view['toolCallId'] = item.get('tool_call_id')
        # 工具消息本身不带函数名（名字在对应的 assistant.tool_calls 里），
        # 但分享页要显示「这步调了什么」—— 调用方在这里补 name 进来。
        if item.get('name'):
            view['name'] = str(item.get('name'))[:60]
        # 工具结果可能是一大坨 JSON，压成一句「这步干了什么」。
        # 摘要只是兜底，name 由 agent_share_payload 回填，这里不强求。
        view['summary'] = tool_result_summary(text, view.get('name'))
    return view


_SHARE_DATA_URI_RE = re.compile(r'data:[a-z0-9.+-]+/[a-z0-9.+-]+;base64,', re.I)


def _share_plain_text(value, limit=400):
    """把可能进分享快照的文本洗成「安全的纯文字」。

    分享快照是公开的，所以这里做两件事：① 压掉换行/连续空白（卡片上就一行）；
    ② 拦下任何形态的 base64 / data URI —— 一个素材节点的 base64 有几百 KB 到几 MB，
    跟着快照走既臃肿又没必要（分享页要的是「可读的文字」，不是图片本体）。
    """
    if not isinstance(value, str):
        return ''
    text = re.sub(r'\s+', ' ', value).strip()
    if _SHARE_DATA_URI_RE.search(text):
        return ''
    if text.startswith('data:') or len(text) > limit * 4:
        # 长到不合理的基本就是被塞了 base64（正常正文不会有这个量级）
        return text[:limit] if not text.startswith('data:') else ''
    return text[:limit]


def agent_share_payload(session, message_id, canvas_summary, owner):
    """打包一份分享快照。"""
    messages = session.get('messages') or []
    # 只截到 lastMessageId 为止 —— 用户点分享那一刻之后的消息不该进快照
    if message_id:
        cut = None
        for i, item in enumerate(messages):
            if item.get('id') == message_id:
                cut = i
                break
        if cut is not None:
            messages = messages[:cut + 1]
    # tool 消息自己不带函数名（名字挂在对应 assistant.tool_calls 上）。分享页要显示
    # 「这步调了什么」，所以先建一张 toolCallId -> name 的表，回填给 tool 消息。
    call_names = {}
    for item in messages:
        for call in item.get('tool_calls') or []:
            fn = call.get('function') if isinstance(call, dict) else None
            if isinstance(fn, dict) and call.get('id') and fn.get('name'):
                call_names[call.get('id')] = str(fn.get('name'))[:60]
    views = []
    for item in messages:
        view = share_message_view(item)
        if view.get('role') == 'tool' and not view.get('name'):
            view['name'] = call_names.get(view.get('toolCallId')) or 'tool'
        views.append(view)
    return {
        'sessionId': session.get('id'),
        'title': session.get('title') or '新对话',
        'mode': session.get('mode') or '',
        'messages': views,
        'canvas': canvas_summary
            if isinstance(canvas_summary, dict) else {'nodeCount': 0, 'nodes': [], 'edges': []},
        'ownerName': str(owner.get('name') or 'CanvasFlow 用户')[:40],
        'createdAt': now(),
    }


def agent_session_view(item, with_messages=False):
    view = {
        'id': item.get('id'), 'projectId': item.get('projectId') or '',
        'title': item.get('title') or '新对话',


        'mode': item.get('mode') or '',
        'createdAt': item.get('createdAt') or '', 'updatedAt': item.get('updatedAt') or '',
        'messageCount': len(item.get('messages') or []),
        # 上下文预算：前端拿它画「上下文剩余 N%」那个环
        'contextLimit': agent.HISTORY_KEEP,
    }
    if with_messages:
        view['messages'] = item.get('messages') or []
        view['pendingAsk'] = item.get('pendingAsk') or None
    return view


def find_agent_session(session_id, user_id):
    for item in read_agent_sessions():
        if item.get('id') == session_id and item.get('userId') == user_id:
            return item
    return None


def save_agent_session(session):
    with LOCK:
        items = read_agent_sessions()
        index = next((i for i, item in enumerate(items) if item.get('id') == session.get('id')), None)
        if index is None:
            items.insert(0, session)
        else:
            items[index] = session
        # Account quotas control growth; one user's activity must never evict
        # another user's history.
        write_agent_sessions(items)
    return session


AUTH_MODES = {'bearer': 'Bearer Token', 'x-api-key': 'x-api-key', 'api-key': 'api-key', 'none': '无鉴权'}


TEXT_PROTOCOLS = {'chat-completions', 'responses'}


def provider_has_credentials(entry):
    """An explicitly anonymous provider needs no invented credential."""
    return bool(str(entry.get('apiKey') or '').strip() or
                (str(entry.get('authMode') or '').lower() == 'none' and
                 str(entry.get('protocol') or '').lower() != 'kling'))


class ProviderHeaders(dict):
    """Keep credential origin attached until the final request URL is known."""
    def __init__(self,values,base_url):
        super().__init__(values);self.base_url=base_url
    def for_url(self,url):
        if http_origin(url)==http_origin(self.base_url):return dict(self)
        return {key:value for key,value in self.items() if key.lower() not in {'authorization','proxy-authorization','api-key','x-api-key','cookie'}}


def auth_headers(entry, api_key=None, extra=None):
    """按供应商配置的鉴权方式生成请求头。默认 bearer，与历史行为完全一致。
    Anthropic 协议固定用 x-api-key，由协议分支自己构造，不走这里。"""
    key = str(api_key if api_key is not None else (entry or {}).get('apiKey') or '').strip()
    mode = str((entry or {}).get('authMode') or 'bearer').lower()
    headers = dict(extra or {})
    if key and mode != 'none':
        if mode == 'x-api-key': headers['x-api-key'] = key
        elif mode == 'api-key': headers['api-key'] = key
        else: headers['Authorization'] = f'Bearer {key}'
    return ProviderHeaders(headers,str((entry or {}).get('baseUrl') or ''))


def now():
    return datetime.now(timezone.utc).isoformat()


QUEUE_SECONDS = 1.5
RENDER_SECONDS = 9.0


VIDEO_PROTOCOLS = {'dashscope', 'kling', 'openai-video'}
VIDEO_MAX_IMAGE = 5_000_000


def parse_video_seconds(value):
    match = re.search(r'\d+(?:\.\d+)?', str(value or ''))
    try:
        return max(0.01, float(match.group(0))) if match else 5
    except (TypeError, ValueError):
        return 5


def video_size(aspect):
    return {
        '16:9': '1280*720', '9:16': '720*1280', '1:1': '1024*1024',
        '4:3': '1024*768', '3:4': '768*1024', '21:9': '1280*544',
    }.get(str(aspect or '').strip(), '1280*720')


# Permit a full inline media result up to the existing media limit, including
# base64 expansion. Read in bounded chunks; partial generated files are never successes.
UPSTREAM_JSON_MAX_BYTES = (MEDIA_MAX_BYTES * 4 // 3) + 1_000_000
UPSTREAM_BINARY_MAX_BYTES = MEDIA_MAX_BYTES


class UpstreamResponseError(ValueError):
    pass


class UpstreamResponseTooLarge(UpstreamResponseError):
    pass


def read_upstream_response(response, limit):
    declared = str(getattr(response, 'headers', {}).get('Content-Length') or '')
    if declared.isdigit() and int(declared) > limit:
        raise UpstreamResponseTooLarge(f'供应商响应超过 {limit // 1_000_000}MB 上限；未自动重发生成请求，请到供应商任务记录获取结果')
    data = io.BytesIO()
    while True:
        try:
            chunk = response.read(min(1024 * 1024, limit + 1 - data.tell()))
        except IncompleteRead as exc:
            raise UpstreamResponseError('供应商响应传输中断；未自动重发生成请求，请到供应商任务记录获取结果') from exc
        if not chunk:
            if declared.isdigit() and data.tell() != int(declared):
                raise UpstreamResponseError('供应商响应长度不完整；未自动重发生成请求，请到供应商任务记录获取结果')
            return data.getvalue()
        data.write(chunk)
        if data.tell() > limit:
            raise UpstreamResponseTooLarge(f'供应商响应超过 {limit // 1_000_000}MB 上限；未自动重发生成请求，请到供应商任务记录获取结果')


def send_request(req, timeout=120):
    """统一的上游请求发送 + JSON 解析，返回 (status, data, error)。绝不回传密钥。"""
    # Identify the API client explicitly; urllib's default identity is rejected by
    # some provider gateways. Keep any adapter-specific identity supplied by callers.
    if not req.has_header('User-agent'):
        req.add_header('User-Agent', 'CanvasFlow/1.0')
    try:
        with open_http_url(req, timeout=timeout) as response:
            raw = read_upstream_response(response, UPSTREAM_JSON_MAX_BYTES)
            if not raw:
                return response.status, {}, None
            try:
                return response.status, json.loads(raw.decode('utf-8')), None
            except (UnicodeDecodeError, json.JSONDecodeError):
                return response.status, {'raw': raw[:2000].decode('utf-8', errors='replace')}, None
    except UpstreamResponseError as exc:
        return 0, {}, str(exc)
    except urllib_error.HTTPError as exc:
        try:
            raw = exc.read(4000).decode('utf-8', errors='replace')
            detail_payload = json.loads(raw)
            detail = detail_payload.get('message') or detail_payload.get('error', {}).get('message') if isinstance(detail_payload, dict) else None
            detail = detail or raw[:500]
        except Exception:
            detail = ''
        return exc.code, {}, f'供应商返回 HTTP {exc.code}：{detail or "请求失败"}'
    except (urllib_error.URLError, TimeoutError, OSError) as exc:
        return 0, {}, f'无法连接模型服务：{exc}'


def http_json_request(url, payload=None, headers=None, method=None, timeout=120):
    """Small JSON HTTP client used by provider adapters; never returns raw secrets."""
    safe_headers=headers.for_url(url) if isinstance(headers,ProviderHeaders) else headers
    request_headers = {'Accept': 'application/json', **(safe_headers or {})}
    body = None
    if payload is not None:
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        request_headers.setdefault('Content-Type', 'application/json')
    req = urllib_request.Request(url, data=body, method=method or ('POST' if body is not None else 'GET'), headers=request_headers)
    return send_request(req, timeout)


def http_body_request(url, body, headers=None, timeout=120):
    """发送已编码好的请求体（如 multipart 上传），返回 (status, data, error)。"""
    safe_headers=headers.for_url(url) if isinstance(headers,ProviderHeaders) else headers
    request_headers = {'Accept': 'application/json', **(safe_headers or {})}
    req = urllib_request.Request(url, data=body, method='POST', headers=request_headers)
    return send_request(req, timeout)


def response_text(status, payload, error):
    """把一次响应摊平成小写文本，供「路由级 404 vs 业务级 404」判定用。

    ★ 必须**同时**看 payload 与 error：`send_request` 在 4xx/5xx 时把响应体
    压进了 error 字符串（payload 是空 dict），只读 payload 会把业务级 404 看成空响应。
    """
    body = json.dumps(payload, ensure_ascii=False) if isinstance(payload, dict) else ''
    return (body + ' ' + str(error or '')).lower()


def is_route_miss(status, payload, error):
    """路由级 404（端点根本不存在）→ True；业务级 404（端点存在、id 不存在）→ False。"""
    if status != 404:
        return False
    text = response_text(status, payload, error)
    return any(mark in text for mark in ('invalid url', 'page not found', 'unknown endpoint'))


def request_json_first_hit(urls, headers, timeout):
    """按候选顺序请求，跳过「路由级 404」的候选，返回第一个有效响应 (status, payload, error, hit_url)。

    供应商的 BaseURL 形态各异（带 /v1 / 不带 /v1），候选链里的无效路径会返回
    `404 Invalid URL` —— 那种要跳过继续试下一个，不能当成最终结果。
    """
    last = (0, {}, '没有可用端点', '')
    for url in urls or []:
        status, payload, error = http_json_request(url, headers=headers, timeout=timeout)
        if is_route_miss(status, payload, error):
            last = (status, payload, error, url)
            continue
        return status, payload, error, url
    return last




def unique_strings(items):
    """保序去重，顺手丢掉空值。"""
    seen, result = set(), []
    for item in items:
        value = str(item or '').strip()
        if value and value not in seen:
            seen.add(value)
            result.append(value)
    return result


def endpoint_candidates(base_url, endpoint):
    """生成上游端点的候选 URL（按优先级）。

    供应商填的 BaseURL 形态各异：有的带 /v1、有的只有域名。项目原有实现是直接
    拼 f'{base}/{endpoint}'，用户只填域名时会拼出 .../chat/completions 而 404。
    这里把**原有拼接保持为第一候选**（已配好的供应商行为完全不变），再补上 FTV
    的两条兜底：{base}/v1/{endpoint}，以及 {base}/v1beta/openai/{endpoint}
    （后者是 Gemini 的 OpenAI 兼容层）。
    """
    base = str(base_url or '').strip().rstrip('/')
    if not base:
        return []
    path = str(endpoint or '').strip().lstrip('/')
    if not path:
        return []
    # ★★ 顺序有讲究：BaseURL 只填域名时，`{base}/chat/completions` 这类路径**可能返回 200 +
    #   非 OpenAI 结构的响应**（网站首页 / 错误页），而 `request_json_candidates` 只看"有没有 error"，
    #   于是拿着垃圾数据往下走，上层只报「AI 接口未返回内容」，非常难查。
    #   实测踩过：ziyelian 的 `deepseek-v4-flash-0731` —— `/chat/completions` 返回 200 但无 content，
    #   `/v1/chat/completions` 完全正常（脚本节点的「合成提示词」因此全军覆没）。
    #   所以 `/v1/` 变体**优先**；真配错了路径时 404 会继续试下一个，行为不变。
    candidates = []
    if not base.endswith('/v1'):
        candidates.append(f'{base}/v1/{path}')
    candidates.append(f'{base}/{path}')
    if not base.endswith('/v1'):
        candidates.append(f'{base}/v1beta/openai/{path}')
    return unique_strings(candidates)


def request_json_candidates(candidates, payload=None, headers=None, timeout=120, method=None):
    """依次尝试候选端点，返回 (data, 命中的 url, error)。

    - 2xx            → 立即返回
    - 401 / 403      → 立即中断：鉴权问题，换路径也没用，直接把原因报出来
    - 404 / 405 / 其它 → 继续试下一个

    ★★ 全部失败时**报哪个错误**（2026-09-24 修正）：
    以前是 `return last_error`（= 最后一个候选的错误），于是**回退候选的路由级 404
    会把前面候选的真实错误盖掉**。实测症状：视频生成报
    `供应商返回 HTTP 404：Invalid URL (POST /v1/videos/generations)`，看着像"路径配错了"，
    而排在最前面的 `/v1/videos`（server.py:3058）其实返回的是 400 `prompt is required`
    —— 端点存在、只是参数缺；用户被这个 404 误导了整轮排查。
    现在的规则：**优先报第一个「有信息量」的错误** —— 即非路由级 404 的错误
    （400 / 422 / 429 / 5xx，以及**业务级** 404，如 `IMAGE_TASK_NOT_FOUND`）；
    只有当所有候选都是路由级 404 时，才退回报**第一个**候选的错误。
    回归测试：`_test_error_pick.py`（本地假上游，零外部请求）。
    """
    first_error = ''
    meaningful_error = ''
    for url in candidates or []:
        status, data, error = http_json_request(url, payload, headers=headers, method=method, timeout=timeout)
        if not error:
            return data, url, None
        if not first_error:
            first_error = error
        # 路由级 404（`Invalid URL` / `page not found`）只说明「这个路径不存在」，
        # 换路径本来就会好，对用户没有信息量；其余错误都是上游在说真话 → 优先报它。
        if not meaningful_error and not is_route_miss(status, data, error):
            meaningful_error = error
        if status not in (404, 405) or (status == 404 and not is_route_miss(status, data, error)):
            break
    return None, None, meaningful_error or first_error or '请求上游失败'


# ---------------------------------------------------------------- 模型列表解析

MODEL_ID_KEYS = ('id', 'model', 'name', 'model_id', 'modelId', 'slug', 'key')


def _model_ids_from_list(items):
    """从一个数组里抽出模型标识。元素可能是字符串，也可能是带 id/name 的对象。"""
    ids = []
    for item in items or []:
        value = ''
        if isinstance(item, str):
            value = item.strip()
        elif isinstance(item, dict):
            for key in MODEL_ID_KEYS:
                candidate = item.get(key)
                if isinstance(candidate, str) and candidate.strip():
                    value = candidate.strip()
                    break
                if isinstance(candidate, (int, float)) and not isinstance(candidate, bool):
                    value = str(candidate)
                    break
        if value:
            ids.append(value)
    return ids


def extract_model_ids(payload, depth=0):
    """从各种形态的响应体里抠出模型标识列表。

    上游返回的形态五花八门：{data:[{id}]}、{models:[{name}]}、{data:{models:[…]}}、
    {result:[…]}，甚至顶层直接是数组。这里按常见键优先找，找不到再深度遍历，返回
    第一个「确实解析出模型标识」的数组；都找不到就返回空列表。
    """
    if payload is None or depth > 4:
        return []
    if isinstance(payload, list):
        return _model_ids_from_list(payload)
    if not isinstance(payload, dict):
        return []
    for key in ('data', 'models', 'model_list', 'modelList', 'result', 'items', 'list', 'records', 'rows'):
        value = payload.get(key)
        if isinstance(value, list):
            ids = _model_ids_from_list(value)
            if ids:
                return ids
        elif isinstance(value, dict):
            ids = extract_model_ids(value, depth + 1)
            if ids:
                return ids
    # 兜底：结构不认识时，深度遍历任意数组 / 对象字段。
    for value in payload.values():
        if isinstance(value, list):
            ids = _model_ids_from_list(value)
            if ids:
                return ids
    for value in payload.values():
        if isinstance(value, dict):
            ids = extract_model_ids(value, depth + 1)
            if ids:
                return ids
    return []


def response_snippet(payload, limit=160):
    """把响应体压成一行短摘要，用于把真实原因回显给用户。"""
    if isinstance(payload, dict):
        text = payload.get('raw') or json.dumps(payload, ensure_ascii=False)
    else:
        text = str(payload)
    return ' '.join(str(text).split())[:limit]


def fetch_remote_models(base_url, api_key, protocol='openai', auth_mode=None, timeout=20):
    """拉取供应商的模型列表，返回 (ids, diagnostics, error)。

    与 request_json_candidates 的关键差别：**HTTP 200 不等于成功**。不少网关或站点
    会把未知路径吞掉、返回 200 的 HTML 首页 / 空响应 / 与模型无关的 JSON；照单全收
    就会误报「供应商没有返回可用的模型列表」，还会让候选链提前终止、永远试不到
    {base}/v1/models。所以这里要求响应体真的能解析出模型标识，否则继续试下一个候选，
    并把每个候选的真实结果记进 diagnostics 回显给用户。
    """
    base_url = str(base_url or '').strip().rstrip('/')
    api_key = str(api_key or '').strip()
    if protocol == 'anthropic':
        candidates = [f'{base_url}/models' if base_url.endswith('/v1') else f'{base_url}/v1/models']
        headers = auth_headers({'baseUrl':base_url,'authMode':'none' if str(auth_mode or '').lower()=='none' else 'x-api-key'}, api_key, {'anthropic-version':'2023-06-01'})
    else:
        candidates = endpoint_candidates(base_url, 'models')
        headers = auth_headers({'authMode': auth_mode,'baseUrl':base_url}, api_key)
    diagnostics, http_error, shape_error = [], '', ''
    for url in candidates:
        status, payload, error = http_json_request(url, headers=headers, timeout=timeout)
        if error:
            diagnostics.append({'url': url, 'status': status, 'detail': error})
            if status in (401, 403):
                # 鉴权/权限问题是根因，直接回传上游原文，不再往下试（换路径也救不了）。
                return [], diagnostics, error
            http_error = http_error or error
            continue
        ids = extract_model_ids(payload)
        if ids:
            return ids, diagnostics, ''
        detail = f'HTTP {status} 但响应里没有模型列表（{response_snippet(payload)}）'
        diagnostics.append({'url': url, 'status': status, 'detail': detail})
        shape_error = shape_error or detail
    # 「地址通了但响应不是模型列表」比前面的 404 更有诊断价值，优先回传它。
    return [], diagnostics, shape_error or http_error or '没有可用的候选端点'


# 平台目录的 `type` → 我们的 `usages`。**这是权威映射**，别再靠模型名猜 ——
# 实测（2026-09-25）：`banana-2` / `banana-pro` / `mj_imagine` 是**图片**模型，
# 按名字猜会判成「文本」→ 画布上它们跑到文本模型选择器里，图片选择器里反而没有。
PLATFORM_TYPE_TO_USAGES = {
    'image': ['image'], 'video': ['video'], 'audio': ['audio'],
    'text': ['text'], 'chat': ['text'], 'llm': ['text'], 'music': ['audio'], 'speech': ['audio'],
}


def fetch_remote_catalog(base_url, api_key, protocol='openai', auth_mode=None, timeout=25):
    """拉供应商的模型清单（**带开通状态与模态**），返回 `(entries, diagnostics, error)`。

    `entries` = `[{id, name, type, usages, available}]`；`available` 为 `None` = 平台没提供这个信息。

    ★★★ 为什么先试平台的**目录**接口 `GET /v1/skills/models`（2026-09-25 用户实测）：
      · `/v1/models` **不管开通没开通都把模型列出来** —— 用户在 lk888 只开通 19 个，它回 23 个，
        面板显示「读取到 23 个模型」，用户困惑「我明明只开了 20 个」（差的 4 个是
        `tt-image-2.5-flare` / `-sunburst` 及其 token 版，**没开通，用了会失败**）；
      · 它**不给模态** → 只能按模型名猜，于是 `banana-2` 被判成文本模型。
      目录接口的 `available_for_this_key` 与 `type` 才是权威。
    ★ 目录拿不到就回落到 `/v1/models`（只有一串 id → `available=None, type=''`，前端不做标注、不猜模态）。
    """
    base_url = str(base_url or '').strip().rstrip('/')
    api_key = str(api_key or '').strip()
    diagnostics = []
    if protocol != 'anthropic':
        headers = auth_headers({'authMode': auth_mode,'baseUrl':base_url}, api_key)
        for url in endpoint_candidates(base_url, 'skills/models'):
            status, payload, error = http_json_request(url, headers=headers, timeout=timeout)
            if error:
                diagnostics.append({'url': url, 'status': status, 'detail': error})
                if status in (401, 403):
                    break
                continue
            items = payload.get('models') if isinstance(payload, dict) else None
            if isinstance(items, list) and items:
                entries = []
                for item in items:
                    if not isinstance(item, dict):
                        continue
                    name = str(item.get('name') or '').strip()
                    if not name:
                        continue
                    kind = str(item.get('type') or '').strip().lower()
                    entries.append({'id': name,
                                    'name': str(item.get('display_name') or '').strip() or name,
                                    'type': kind,
                                    'usages': PLATFORM_TYPE_TO_USAGES.get(kind, []),
                                    'billing': infer_billing(name),
                                    'available': item.get('available_for_this_key') is True})
                if entries:
                    return entries, diagnostics, ''
            diagnostics.append({'url': url, 'status': status, 'detail': '响应里没有模型目录'})
    ids, more, error = fetch_remote_models(base_url, api_key, protocol, auth_mode, timeout)
    diagnostics.extend(more)
    return [{'id': i, 'name': i, 'type': '', 'usages': [], 'billing': infer_billing(i),
             'available': None} for i in ids], diagnostics, error


def request_body_candidates(candidates, build_body, headers=None, timeout=120):
    """Only retry a generation POST when the server explicitly rejected its route."""
    last_error = ''
    for url in candidates or []:
        status, data, error = http_body_request(url, build_body(url), headers=headers, timeout=timeout)
        if not error:
            return data, url, None
        last_error = error
        if status != 405 and not is_route_miss(status, data, error):
            break
    return None, None, last_error or '请求上游失败'


def request_bytes_candidates(candidates, payload=None, headers=None, timeout=120, expected_audio=False):
    """TTS binary responses use the same non-idempotent fallback rule as JSON."""
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8') if payload is not None else None
    last_error = ''
    for url in candidates or []:
        safe_headers = headers.for_url(url) if isinstance(headers, ProviderHeaders) else headers
        request_headers = {'Accept': '*/*', 'User-Agent': 'CanvasFlow/1.0', **(safe_headers or {})}
        if body is not None:
            request_headers.setdefault('Content-Type', 'application/json')
        req = urllib_request.Request(url, data=body, method='POST', headers=request_headers)
        try:
            with open_http_url(req, timeout=timeout) as response:
                raw = read_upstream_response(response, UPSTREAM_BINARY_MAX_BYTES)
                if raw:
                    if expected_audio:
                        mime = str(response.headers.get('Content-Type') or '').split(';')[0].strip().lower()
                        sniffed = sniff_media_mime(raw)
                        prefix = raw[:256].lstrip(b'\xef\xbb\xbf \t\r\n')
                        if (prefix.startswith((b'<', b'{', b'[')) or
                                mime.startswith('text/') or 'json' in mime or 'xml' in mime or
                                not (mime.startswith('audio/') or
                                     mime in ('', 'application/octet-stream', 'binary/octet-stream') and sniffed.startswith('audio/')) or
                                sniffed.startswith('image/')):
                            last_error = '供应商返回的不是音频文件，可能是错误页面或错误 JSON；未自动重发生成请求'
                            break
                    return raw, url, None
                last_error = '接口未返回数据'
                break
        except urllib_error.HTTPError as exc:
            try:
                raw = exc.read(4000).decode('utf-8', errors='replace')
            except (IncompleteRead, urllib_error.URLError, TimeoutError, OSError) as read_error:
                last_error = f'供应商返回 HTTP {exc.code}，错误响应读取中断；未自动重发生成请求'
                break
            try:
                parsed = json.loads(raw)
                nested = parsed.get('error') if isinstance(parsed, dict) else None
                detail = (parsed.get('message') or (nested.get('message') if isinstance(nested, dict) else nested)) if isinstance(parsed, dict) else None
            except (ValueError, TypeError):
                parsed, detail = {}, None
            last_error = f'供应商返回 HTTP {exc.code}：{detail or raw[:500] or "请求失败"}'
            if exc.code != 405 and not is_route_miss(exc.code, parsed, last_error):
                break
        except UpstreamResponseError as exc:
            last_error = str(exc)
            break
        except (urllib_error.URLError, TimeoutError, OSError) as exc:
            last_error = f'无法连接模型服务：{exc}'
            break
    return None, None, last_error or '请求上游失败'


def provider_error(message):
    return str(message or '视频模型未返回可用任务信息').replace('\x00', '')[:800]


def encode_jwt_hs256(access_key, secret_key):
    """Kling uses an HS256 token; keep this dependency-free for the local server."""
    header = base64.urlsafe_b64encode(json.dumps({'alg': 'HS256', 'typ': 'JWT'}, separators=(',', ':')).encode()).rstrip(b'=').decode()
    current = int(time.time())
    payload = base64.urlsafe_b64encode(json.dumps({'iss': access_key, 'exp': current + 1800, 'nbf': current - 5}, separators=(',', ':')).encode()).rstrip(b'=').decode()
    unsigned = f'{header}.{payload}'
    signature = base64.urlsafe_b64encode(hmac.new(secret_key.encode(), unsigned.encode(), hashlib.sha256).digest()).rstrip(b'=').decode()
    return f'{unsigned}.{signature}'


def kling_auth(api_key):
    raw = str(api_key or '').strip()
    access_key = secret_key = ''
    if raw.startswith('{'):
        try:
            parsed = json.loads(raw)
            access_key = str(parsed.get('accessKey') or parsed.get('access_key') or '').strip()
            secret_key = str(parsed.get('secretKey') or parsed.get('secret_key') or '').strip()
        except json.JSONDecodeError:
            pass
    if not access_key and any(separator in raw for separator in (':', '\n')):
        access_key, secret_key = re.split(r'[:\n]', raw, maxsplit=1)
        access_key, secret_key = access_key.strip(), secret_key.strip()
    if not access_key or not secret_key:
        return '', 'Kling API Key 请填写 accessKey:secretKey（两段密钥只保存在服务端）'
    return encode_jwt_hs256(access_key, secret_key), None


def response_value(payload, *keys):
    if not isinstance(payload, dict):
        return None
    for key in keys:
        value = payload.get(key)
        if value not in (None, ''):
            return value
    for parent in ('output', 'data', 'result'):
        nested = payload.get(parent)
        if isinstance(nested, dict):
            value = response_value(nested, *keys)
            if value not in (None, ''):
                return value
    return None


def extract_provider_job_id(payload):
    return extract_task_id(payload)


def extract_provider_video_url(payload):
    return extract_video_url(payload)


def extract_provider_progress(payload):
    value = response_value(payload, 'progress', 'percent', 'percentage')
    # ★ 有的平台把进度写成**百分比字符串**（lk888 的 /v1/skills/task-status 返回 "50%"），
    #   直接 float("50%") 会抛 ValueError → 进度静默丢失、退回「不确定滑动」动效。
    text = str(value if value is not None else '').strip().rstrip('%').strip()
    try:
        number = float(text)
        if number <= 1: number *= 100
        return max(0, min(99, int(number)))
    except (TypeError, ValueError):
        return None


def normalize_provider_status(payload):
    """把上游状态收敛成 completed / failed / running / queued。

    ★★ 两个必须按**字段**而不是按词表判的特例（2026-09-25 接入 lk888 统一媒体端点时加）：
      ① `is_final === true` —— `/v1/skills/task-status` 用它标终态，且它的 `status` 是
         **中文**（"生成完成"），不在任何英文词表里；
      ② 该接口的失败判据是 `error != null`，不是 status 文案（平台文档明确写的）。
      所以先按这两个字段判，再走通用词表。
    ★ 另外 `response_value` 按固定键序取**第一个非空值**：该接口同时有 `status`
      （"生成完成"）和 `state`（"success"），老写法取到中文 → 落到兜底 `running`
      → 任务永远"进行中"、进度条永不收敛。改成**把所有候选值都过一遍词表**，任一命中即返回。
    """
    if isinstance(payload, dict) and payload.get('is_final') is True:
        return 'failed' if response_value(payload, 'error') else 'completed'
    values = []
    for key in ('state', 'task_status', 'taskStatus', 'status'):
        raw = str(response_value(payload, key) or '').strip().lower()
        if raw and raw not in values:
            values.append(raw)
    for value in values:
        if value in {'succeed', 'succeeded', 'success', 'completed', 'complete', 'done', 'finished'} \
                or value in {'生成完成', '已完成', '成功'}:
            return 'completed'
        if value in {'failed', 'failure', 'error', 'canceled', 'cancelled', 'rejected'} \
                or value in {'生成失败', '失败', '已取消'}:
            return 'failed'
    for value in values:
        if value in {'running', 'processing', 'in_progress', 'in-progress', 'generating'} \
                or value in {'生成中', '处理中'}:
            return 'running'
        if value in {'queued', 'pending', 'submitted', 'created', 'waiting'} \
                or value in {'排队中', '等待中', '已提交'}:
            return 'queued'
    return 'running' if values else 'queued'






# 可能装着结果资源的数组键
RESOURCE_ARRAY_KEYS = ('data', 'output', 'result', 'images', 'image_urls', 'assets')
# 可能直接装着结果地址的键
RESOURCE_VALUE_KEYS = ('url', 'cover_url', 'image_url', 'video_url', 'watermark_free_url', 'fallback_url')
# 正文里可能夹带结果地址的键
EMBEDDED_URL_TEXT_KEYS = ('', 'content', 'message', 'output', 'output_text', 'response', 'result', 'text')

_MEDIA_URL_PATTERNS = (
    re.compile(r'!\[[^\]]*\]\((https?://[^)\s]+|data:image/[^)\s]+)\)', re.I),
    re.compile(r'\[[^\]]*\]\((https?://[^)\s]+|data:image/[^)\s]+)\)', re.I),
    re.compile(r'(https?://[^\s"\'<>）)]+|data:image/[a-z0-9.+-]+;base64,[a-z0-9+/=]+)', re.I),
)
_MEDIA_FILE_RE = re.compile(r'\.(?:png|jpe?g|webp|gif|mp4|webm|mov|m4v|mp3|wav|m4a|aac|ogg|oga|opus|flac)(?:[?#].*)?$', re.I)
_VIDEO_FILE_RE = re.compile(r'\.(?:mp4|webm|mov|m4v)(?:[?#].*)?$', re.I)
# ★★ 音频扩展名必须一起收（2026-09-25 接音频 media/generate 时补）：
#   `GET /v1/skills/task-status` 把结果放在顶层 `result_url`，音乐生成返回的是 `.mp3`。
#   少了这几个后缀 → `looks_like_media_resource('.mp3')` 判否 → `extract_generation_urls`
#   **整条结果被丢掉**，表现为「任务已完成、但服务端说供应商没返回音频地址」（与视频那边同款坑）。
_MEDIA_AUDIO_RE = re.compile(r'\.(?:mp3|wav|m4a|aac|ogg|oga|opus|flac)(?:[?#].*)?$', re.I)


def looks_like_media_resource(value):
    """像不像一个可用的媒体地址（宽松版：用于把非 URL 的字符串筛掉）。"""
    text = str(value or '').strip()
    if not text:
        return False
    return bool(re.match(r'^(?:https?://|/|blob:|data:(?:image|video|audio)/)', text, re.I)) or bool(_MEDIA_FILE_RE.search(text))


def looks_like_media_file(value):
    """是不是明确指向媒体文件（严格版：用于排序，避免把状态/文档链接当结果）。"""
    text = str(value or '').strip()
    if not text:
        return False
    if re.match(r'^data:(?:image|video|audio)/', text, re.I):
        return True
    return bool(_MEDIA_FILE_RE.search(text)) or bool(re.search(r'/(?:assets|files|media|download)/', text, re.I))


def extract_generation_urls(payload):
    """从任意结构的响应里挖出结果媒体地址。

    既遍历已知容器（data[] / output[] / result.images[] / result.image_urls[] /
    result.assets[]），也扫任意 *_url 键，最后再从正文里用正则抠 URL。
    """
    found = []

    def push(value):
        if isinstance(value, str) and looks_like_media_resource(value):
            found.append(value.strip())

    def push_record(record):
        if not isinstance(record, dict):
            return
        for key in RESOURCE_VALUE_KEYS:
            value = record.get(key)
            if isinstance(value, str):
                push(value)
            elif isinstance(value, dict):
                push(value.get('url'))
        b64 = record.get('b64_json')
        if isinstance(b64, str) and b64:
            # ★ 同样不能写死 `image/png`：上游 b64_json 里也可能是 JPEG。
            #   只解**开头 24 个 base64 字符**（= 18 字节）判魔数，不用把整张图解一遍。
            try:
                prefix = base64.b64decode(b64[:24], validate=False)
            except (binascii.Error, ValueError):
                prefix = b''
            found.append(f'data:{sniff_media_mime(prefix) or "image/png"};base64,{b64}')

    def push_any(value):
        if isinstance(value, str):
            push(value)
        else:
            push_record(value)

    def from_text(value):
        for pattern in _MEDIA_URL_PATTERNS:
            for match in pattern.findall(value):
                push(match)

    def walk(node, key=''):
        if isinstance(node, str):
            lowered = str(key).lower()
            if lowered in ('url', 'image', 'video') or lowered.endswith('_url'):
                push(node)
            elif lowered in EMBEDDED_URL_TEXT_KEYS:
                from_text(node)
            return
        if isinstance(node, list):
            for item in node:
                if key in RESOURCE_ARRAY_KEYS:
                    push_any(item)
                walk(item, key)
            return
        if not isinstance(node, dict):
            return
        push_record(node)
        for entry_key, entry_value in node.items():
            walk(entry_value, str(entry_key).lower())

    if isinstance(payload, dict):
        for container in ('data', 'output'):
            items = payload.get(container)
            if isinstance(items, list):
                for item in items:
                    push_any(item)
        result = payload.get('result')
        if isinstance(result, dict):
            for container in ('images', 'image_urls', 'assets'):
                items = result.get(container)
                if isinstance(items, list):
                    for item in items:
                        push_any(item)
            push_record(result)
        push_record(payload)
    walk(payload)
    return unique_strings(found)


def prefer_media_files(urls):
    """排序偏好：内联 data: URI（无需下载）→ 明确是媒体文件的地址 → 其余兜底。"""
    urls = list(urls or [])
    inline = [url for url in urls if url.lower().startswith('data:')]
    files = [url for url in urls if not url.lower().startswith('data:') and looks_like_media_file(url)]
    rest = [url for url in urls if not url.lower().startswith('data:') and not looks_like_media_file(url)]
    return inline + files + rest


def find_string_by_keys(payload, keys, depth=0):
    """按给定的键名优先级深度遍历，找第一个像媒体地址的字符串值。"""
    if depth > 6:
        return ''
    if isinstance(payload, list):
        for item in payload:
            found = find_string_by_keys(item, keys, depth + 1)
            if found: return found
        return ''
    if not isinstance(payload, dict):
        return ''
    for key in keys:
        value = payload.get(key)
        if isinstance(value, str) and looks_like_media_resource(value):
            return value.strip()
        if isinstance(value, dict):
            inner = value.get('url')
            if isinstance(inner, str) and looks_like_media_resource(inner):
                return inner.strip()
    for value in payload.values():
        found = find_string_by_keys(value, keys, depth + 1)
        if found: return found
    return ''


def extract_video_url(payload):
    """视频结果地址。优先按视频相关键名找，其次找带视频扩展名的地址。

    刻意不接受相对路径（`/api/...`）—— 拿不到 base 就没法播放，属于误报。
    """
    candidate = find_string_by_keys(payload, ('video_url', 'videoUrl', 'watermark_free_url', 'video', 'url'))
    if candidate and re.match(r'^(?:https?://|data:video/)', candidate, re.I):
        return candidate[:4000]
    for url in extract_generation_urls(payload):
        if _VIDEO_FILE_RE.search(url) or url.startswith('data:video/'):
            return url[:4000]
    return ''


def extract_text_content(payload):
    """从响应里取文本（对齐 FTV 的 7 级兜底）。"""
    def flatten(value):
        if isinstance(value, str):
            return value
        if isinstance(value, list):
            parts = []
            for part in value:
                if isinstance(part, str):
                    parts.append(part)
                elif isinstance(part, dict):
                    parts.append(str(part.get('text') or part.get('content') or part.get('value') or ''))
            return ''.join(parts)
        return ''

    if not isinstance(payload, dict):
        return ''
    for key in ('output_text', 'text'):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    choices = payload.get('choices')
    if isinstance(choices, list) and choices:
        for choice in choices:
            if not isinstance(choice, dict):
                continue
            message = choice.get('message') if isinstance(choice.get('message'), dict) else {}
            delta = choice.get('delta') if isinstance(choice.get('delta'), dict) else {}
            for candidate in (flatten(message.get('content')), flatten(delta.get('content')), flatten(choice.get('text'))):
                if candidate.strip():
                    return candidate.strip()
    elif isinstance(payload.get('message'), str) and payload['message'].strip():
        return payload['message'].strip()
    output = payload.get('output')
    if isinstance(output, list):
        for item in output:
            if isinstance(item, dict):
                candidate = flatten(item.get('content')) or flatten(item.get('text'))
                if candidate.strip():
                    return candidate.strip()
    return ''


def extract_task_id(payload):
    """任务 ID：task_id / taskId / job_id / request_id / id，并递归进 data（对齐 FTV）。"""
    keys = ('task_id', 'taskId', 'job_id', 'jobId', 'request_id', 'requestId', 'id')

    def search(node, depth=0):
        if depth > 4 or not isinstance(node, dict):
            return ''
        for key in keys:
            value = node.get(key)
            if isinstance(value, (str, int)) and str(value).strip():
                return str(value).strip()
        for key in ('data', 'output', 'result', 'response'):
            nested = node.get(key)
            if isinstance(nested, list):
                for item in nested:
                    found = search(item, depth + 1)
                    if found: return found
            else:
                found = search(nested, depth + 1)
                if found: return found
        return ''

    return search(payload)


def extract_failure_reason(payload):
    """失败原因：fail_reason → failure_reason → error_message → message（对齐 FTV）。"""
    value = response_value(payload, 'fail_reason', 'failure_reason', 'error_message', 'error_detail', 'message')
    return str(value).strip() if value not in (None, '') else ''


def provider_base_url(entry):
    return str(entry.get('baseUrl') or '').strip().rstrip('/')


def provider_image_value(images):
    for item in images if isinstance(images, list) else []:
        data = str(item or '').strip()
        if data.startswith('data:image/') and len(data) <= VIDEO_MAX_IMAGE:
            return data
        if data.startswith('http://') or data.startswith('https://'):
            return data[:4000]
    return ''


def provider_image_values(images):
    """按顺序取出**所有**可用的图片值（最多 2 张）—— 首尾帧要第一张 + 第二张。
    单张版 `provider_image_value` 仍然保留：多数协议只吃一张图。"""
    values = []
    for item in images if isinstance(images, list) else []:
        data = str(item or '').strip()
        if data.startswith('data:image/') and len(data) <= VIDEO_MAX_IMAGE:
            values.append(data)
        elif data.startswith('http://') or data.startswith('https://'):
            values.append(data[:4000])
        if len(values) >= 2:
            break
    return values


# ★★★ r873：「输入视频」（源视频）—— 视频超分 / 视频编辑 / 视频续写这类模型的**必传**素材。
#   与参考图是两码事：参考图进 `referenceImages`（前端收集、走图片键位），
#   源视频必须是**可公开访问的 URL**（上游明确写了「视频文件仍需传 URL」，不接受 base64）。
#   实测（`_upspec/video-enhance.json`）：`video_url` 是 `type=upload` + `required=true`。
VIDEO_INPUT_VIDEO_MAX_LEN = 4000
# 上游对「源视频」这类参数的命名比图片更不统一：单数 `video_url` / 复数 `videos` 都有，
# 还有 `video` 这种裸名。按优先级依次试（`spec_field_candidates` 里登记表声明的 field 排第一）。
VIDEO_INPUT_FIELD_CANDIDATES = ('video_url', 'videoUrl', 'video', 'videos', 'video_urls', 'input_video')


def provider_video_value(videos):
    """从候选里取**一个**可用的源视频直链；取不到返回空串。

    ★ 只认 http(s)：上游文档写明「视频文件仍需传 URL」（base64 只对图片/音频开放），
      传 data: 会被判参数格式错误 —— 所以这里**主动丢掉** data: 值，宁可不发让上游报缺参。
    ★ 相对路径（`/media/xxx.mp4`）也丢掉：那是我们自己的源，上游服务器够不到。
    """
    for item in (videos if isinstance(videos, list) else [videos]):
        data = str(item or '').strip()
        if data.startswith('http://') or data.startswith('https://'):
            return data[:VIDEO_INPUT_VIDEO_MAX_LEN]
    return ''


def spec_input_video_rows(entry, kind='video'):
    """登记表里「输入视频」这类行（= 上游 required 的视频上传参数）。

    ★ 判据：行的取值来源只能是**运行时**（用户连线的视频 / 上游生成结果），
      登记表里的 `default` 永远是 null（没有"默认源视频"这种东西）。
      所以这里认两种形态，任一条命中即算：
        ① 行 key 落在 `VIDEO_INPUT_FIELD_CANDIDATES` 里（`video_url` / `videos` …）；
        ② 行声明了 `field`，且 field 也在候选里。
    ★ 返回**空列表**而不是 None：`spec_rows_for_entry` 的 None 语义是"整块没登记"，
      这里没命中只代表"这个模型不需要源视频"，调用方不该因此改走别的分支。
    """
    rows = spec_rows_for_entry(entry, kind) or []
    hits = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        names = {str(row.get('key') or '').strip(), str(row.get('field') or '').strip()}
        if names & set(VIDEO_INPUT_FIELD_CANDIDATES):
            hits.append(row)
    return hits


def entry_needs_input_video(entry, kind='video'):
    """这个模型是不是**必须有**一个源视频才能提交。"""
    return bool(spec_input_video_rows(entry, kind))






VIDEO_REFERENCE_MODES = {
    'text2video', 'singleImage2video', 'frames2video', 'image2video', 'video2video',
    'videoEdit2video', 'audio2video', 'mixed2video', 'videoExtend2video', 'longVideo2video',
}
# 旧存档（r829 及以前）存的是中文标签，读出来要能认 —— 否则老项目一提交就静默退回旧行为。
VIDEO_REFERENCE_MODE_ALIASES = {
    '文生视频': 'text2video', '图生视频': 'singleImage2video',
    '首尾帧': 'frames2video', '首帧': 'frames2video',
    '图片参考': 'image2video', '视频参考': 'video2video', '视频编辑': 'videoEdit2video',
    '音频参考': 'audio2video', '全能参考': 'mixed2video',
    '视频续写': 'videoExtend2video', '超长视频': 'longVideo2video',
}


def normalize_reference_mode(value):
    """把前端/旧存档里的模式值归一成上面那十个 key；认不出来返回空串（= 走旧逻辑）。"""
    raw = str(value or '').strip()
    if not raw:
        return ''
    if raw in VIDEO_REFERENCE_MODES:
        return raw
    return VIDEO_REFERENCE_MODE_ALIASES.get(raw, '')


def video_payload(job, entry):
    settings = job.get('generationSettings') if isinstance(job.get('generationSettings'), dict) else {}
    # ★ 模式优先：`referenceMode` 认得出就用它判文生 / 图生；认不出（旧存档、没传）再退回 `videoMode`。
    #   这样老项目的请求形态一字不变，新项目才是「选了什么模式就按什么发」。
    #   ★★ 注意 `mode` 在服务端的语义只是「这次请求带不带图」（各协议分支都按 `if image:` 决定字段），
    #      **不等于**用户选的那个模式：音频参考 / 全能参考这些模式可能一张图都不带，
    #      那就必须走 text-to-video，否则会死在下面那句「请先上传或连接一张参考图片」上。
    reference_mode = normalize_reference_mode(settings.get('referenceMode'))
    # ★★★ r873：**源视频模型**（超分 / 视频编辑）不该按「图生视频」判。
    #   它们吃的是视频不是图，硬判 image-to-video 会让请求死在下面那句
    #   「请先上传或连接一张参考图片」上 —— 用户明明连了视频节点，却被告知缺图片。
    #   判据用**登记表**（模型能力），不用 `referenceMode`（用户意图）：模式是"想怎么用素材"，
    #   模型有没有源视频槽是"这个模型支不支持"，两者混用会漏判。
    has_source_video = bool(provider_video_value(job.get('sourceVideos')))
    needs_input_video = entry_needs_input_video(entry)
    if needs_input_video or has_source_video:
        # 带源视频 → 这次请求就是"视频进、视频出"，不再要求参考图（图仍可作附加参考）。
        mode = 'text-to-video' if not provider_image_value(job.get('referenceImages')) else 'image-to-video'
    elif reference_mode == 'text2video':
        mode = 'text-to-video'
    elif reference_mode:
        mode = 'image-to-video' if provider_image_value(job.get('referenceImages')) else 'text-to-video'
    else:
        mode = 'text-to-video' if settings.get('videoMode') == 'text-to-video' else 'image-to-video'
    prompt = str(job.get('prompt') or '').strip()
    image = provider_image_value(job.get('referenceImages'))
    # ★ 首尾帧要**两张**图：第一张是首帧、第二张是尾帧。只有 frames2video 用得上尾帧，
    #   其余模式（含 mixed2video 混参）仍只发第一张 —— 别把参考图悄悄当成尾帧发上去。
    last_frame = ''
    if reference_mode == 'frames2video':
        values = provider_image_values(job.get('referenceImages'))
        if len(values) >= 2:
            last_frame = values[1]
    seconds = parse_video_seconds(settings.get('duration'))



    aspect = str(settings.get('aspectRatio') or '').strip()[:20]
    if aspect.lower() in ('auto', 'adaptive'):
        aspect = ''
    advanced = job.get('advancedSettings') if isinstance(job.get('advancedSettings'), dict) else {}
    negative = str(advanced.get('negativePrompt') or '').strip()
    seed = str(advanced.get('seed') or '').strip()
    # ★★★ r873：源视频（视频超分 / 视频编辑这类模型的必传素材）。
    #   与参考图**两条独立的路**：参考图进 referenceImages（前端只收 image/），
    #   源视频单独放 `sourceVideos`（必须是 http(s) 直链，上游不收 base64）。
    #   ★ 不按 referenceMode 判：模式是"用户想怎么用素材"，而"这个模型有没有源视频槽"是
    #     模型能力（由登记表判）。两者混在一起会出现「选了视频编辑但模型其实不吃视频」的静默错发。
    source_video = provider_video_value(job.get('sourceVideos'))
    return mode, prompt, image, seconds, aspect, negative, seed, last_frame, source_video


def build_media_video_params(entry, job, schema):
    """Use the registered model fields; keep media inputs out of protocol fields."""
    settings = job.get('generationSettings') or {}
    advanced = job.get('advancedSettings') or {}
    params = build_media_audio_params(schema, overrides=media_param_overrides(entry))
    params.update(build_media_audio_params(schema,spec=settings.get('modelOptions') or {}))
    semantic = {'aspectRatio': settings.get('aspectRatio'),
                'resolution': settings.get('resolution'), 'duration': settings.get('duration'),
                'count': settings.get('generateCount'), 'generateAudio': settings.get('generateAudio')}
    for row in spec_rows_for_entry(entry, 'video') or []:
        key = str(row.get('key') or '')
        value = semantic.get(key)
        if key == 'duration' and value not in (None, '', 'auto'):
            match = re.search(r'\d+(?:\.\d+)?', str(value))
            value = match.group(0) if match else value
        for name in spec_field_candidates(row):
            if name not in schema or schema[name].get('type') == 'upload':
                continue
            allowed = media_param_options(schema, name)
            text = 'true' if value is True else 'false' if value is False else str(value or '')
            if value in (None, '') or (allowed and text not in allowed):
                value = row.get('default')
            params.update(build_media_audio_params(schema, spec={name: value}))
            break
    for source, name in [('negativePrompt', 'negative_prompt'), ('seed', 'seed')]:
        params.update(build_media_audio_params(schema, spec={name: advanced.get(source)}))
    # The reference mode chooses the provider's declared upload slot, not a guessed field.
    if 'script_content' in schema:
        params.setdefault('script_content', str(job.get('prompt') or ''))
    if 'script_name' in schema:
        params.setdefault('script_name', str(job.get('prompt') or '').split('\n')[0][:60])
    reference = str(settings.get('referenceMode') or '')
    if 'mode' in schema:
        wanted = 'cankaosheng' if (job.get('sourceVideos') or job.get('sourceAudios') or reference in
                 ('mixed2video', 'video2video', 'videoEdit2video', 'audio2video')) else 'shouweizhen'
        if wanted in media_param_options(schema, 'mode'):
            params['mode'] = wanted
    images = provider_image_values(job.get('referenceImages'))
    videos = [provider_video_value(job.get('sourceVideos'))] if provider_video_value(job.get('sourceVideos')) else []
    audios = [str(x) for x in job.get('sourceAudios', []) if isinstance(x, str) and
              x.startswith(('https://', 'http://', 'data:audio/'))][:1]
    for name, definition in schema.items():
        if definition.get('type') != 'upload':
            continue
        conditions = definition.get('available_when') or {}
        if any(field in params and str(params[field]) not in [str(v) for v in allowed]
               for field, allowed in conditions.items() if isinstance(allowed, list)):
            continue
        if name in ('audio_url', 'audio', 'sound_file', 'audio_file', 'reference_audio'):
            values = audios
        elif name in ('video_url', 'videos', 'video', 'reference_video', 'source_video', 'clips'):
            values = videos
        elif name in ('images', 'image', 'image_url', 'image_urls', 'reference_images',
                      'reference_urls', 'input_image', 'lip_ref_url'):
            values = images
        else:
            continue
        if values:
            params[name] = values if name.endswith('s') and not name.endswith('ss') else values[0]
    return params


def submit_video_media_generate(entry, job, trace=None):
    model = str(entry.get('model') or '')
    schema = media_model_schema(entry, model)
    if not schema:
        return None, '暂时无法读取该视频模型的参数表，请稍后重试；尚未提交生成任务'
    params = build_media_video_params(entry, job, schema)
    missing = [str(p.get('label') or name) for name, p in schema.items()
               if p.get('required') and name != 'prompt' and params.get(name) in (None, '', [])]
    if missing:
        return None, '该模型还缺少必传素材或参数：' + '、'.join(missing)
    payload = {'model': model, 'prompt': str(job.get('prompt') or ''), 'params': params}
    result, hit, error = request_json_candidates(
        [provider_base_url(entry) + '/v1/media/generate'], payload,
        headers=auth_headers(entry, None, {'Content-Type': 'application/json'}),
        timeout=provider_timeout_value(entry, 'videoSubmit', 180))
    if trace is not None:
        trace.update({'endpoint': hit, 'contract': 'media-generate', 'params': sorted(params)})
    if error:
        return None, provider_error(error)
    if not isinstance(result, dict) or str(result.get('code')) != '200':
        return None, '供应商拒绝了本次请求：' + media_error_text(result)
    task_id = extract_task_id(result)
    if not task_id:
        return None, '供应商未返回视频任务号'
    return {'provider': entry.get('provider') or 'media-generate', 'providerProtocol': 'openai',
            'providerJobId': task_id, 'submittedAt': now(), 'progress': 0}, None


def media_video_result_url(payload):
    if not isinstance(payload, dict) or payload.get('error'):
        return ''
    values = [payload.get('result_url')] + list(payload.get('result_urls') or [])
    return next((v[:4000] for v in values if isinstance(v, str) and v.startswith(('https://', 'http://'))), '')


def provider_inline_reference(value, media_kind):
    value = str(value or '')
    if value.startswith('data:' + media_kind + '/'):
        return value
    if value.startswith('/media/'):
        media_id = urlparse(value).path.rsplit('/', 1)[-1]
        validate_new_media(STORAGE_ACTOR.get(), value)
        return media_data_uri(media_id)
    if not value.startswith(('https://', 'http://')):
        raise ValueError('参考素材必须是有效的文件或链接')
    request = urllib_request.Request(value, headers={'Accept': media_kind + '/*'})
    with open_http_url(request, timeout=60) as response:
        mime = response.headers.get_content_type()
        if not mime.startswith(media_kind + '/'):
            raise ValueError('参考素材类型不正确')
        raw = response.read(25 * 1024 * 1024 + 1)
    if len(raw) > 25 * 1024 * 1024:
        raise ValueError('参考素材超过 25MB')
    return 'data:' + mime + ';base64,' + base64.b64encode(raw).decode()


def zhongheng_reference(entry, value, media_kind):
    if str(value).startswith('https://'):
        return value
    inline = provider_inline_reference(value, media_kind)
    header, encoded = inline.split(',', 1);mime = header[5:].split(';')[0]
    raw = base64.b64decode(encoded, validate=True)
    if len(raw) > 25 * 1024 * 1024:
        raise ValueError('参考素材超过上游 25MB 限制')
    boundary = 'CanvasFlow' + uuid.uuid4().hex
    ext = mimetypes.guess_extension(mime) or '.bin'
    body = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="reference{ext}"\r\nContent-Type: {mime}\r\n\r\n'.encode() + raw + f'\r\n--{boundary}--\r\n'.encode())
    status, result, error = http_body_request(provider_base_url(entry) + '/v1/media', body,
        headers=auth_headers(entry, None, {'Content-Type': 'multipart/form-data; boundary=' + boundary}), timeout=90)
    if error or not isinstance(result, dict) or not result.get('success'):
        raise ValueError('参考素材上传失败：' + str(error or result.get('message') or '上游没有返回文件地址'))
    rows = result.get('data') or []
    url = str(rows[0].get('url') or '') if rows and isinstance(rows[0], dict) else ''
    if not url.startswith('https://'):
        raise ValueError('上游没有返回 HTTPS 素材地址')
    return url


def provider_video_payload(entry, job):
    profile = entry.get('requestProfile');contract = effective_provider_contract(entry)
    settings = job.get('generationSettings') or {};advanced = job.get('advancedSettings') or {}
    duration = parse_video_seconds(settings.get('duration'))
    if duration < float(contract.get('minDuration') or 1) or duration > float(contract.get('maxDuration') or 30) or (contract.get('durationOptions') and duration not in contract['durationOptions']):
        raise ValueError('所选视频时长超过该模型上限')
    images = provider_image_values(job.get('referenceImages'))
    videos = [provider_video_value(job.get('sourceVideos'))] if provider_video_value(job.get('sourceVideos')) else []
    audios = job.get('sourceAudios') or []
    limits = [('image', images), ('video', videos), ('audio', audios)]
    for kind, values in limits:
        cap = int(contract.get('max_' + kind, 0))
        if len(values) > cap:
            raise ValueError('该模型最多支持 ' + str(cap) + ' 个' + {'image':'参考图','video':'参考视频','audio':'参考音频'}[kind])
    if profile == 'zhongheng-video':
        result = {'model': entry['model'], 'prompt': job.get('prompt') or '', 'duration': duration}
        aspect = str(settings.get('aspectRatio') or '16:9')
        if aspect not in ('adaptive', 'auto'):result['ratio'] = aspect
        resolution = str(settings.get('resolution') or contract.get('defaultResolution') or '720p').lower()
        supported = contract.get('resolutions') or []
        result['resolution'] = resolution if resolution in supported or not supported else contract['defaultResolution']
        if advanced.get('negativePrompt'):result['negative_prompt'] = advanced['negativePrompt']
        if settings.get('generateAudio') is not None:result['generate_audio'] = bool(settings['generateAudio'])
        image_urls = [zhongheng_reference(entry, v, 'image') for v in images]
        if settings.get('referenceMode') == 'frames2video' and image_urls:
            result['start_frame'] = image_urls[0]
            if len(image_urls) > 1:result['end_frame'] = image_urls[1]
        elif image_urls:result['images'] = image_urls
        if videos:result['reference_videos'] = [zhongheng_reference(entry, v, 'video') for v in videos]
        if audios:result['reference_audios'] = [zhongheng_reference(entry, v, 'audio') for v in audios]
        return '/v1/videos', result
    # The workflow API uses base64 inputs, POST polling, and authenticated downloads.
    result = {'workflow': entry['model'], 'prompt': job.get('prompt') or '', 'duration': duration,
              'context_ir_enabled': False}
    resolutions = contract.get('resolutions') or []
    wanted = str(settings.get('resolution') or '')
    if wanted not in resolutions:
        tier = wanted.lower().replace('p', '')
        orientation = '竖' if str(settings.get('aspectRatio') or '9:16') in ('9:16','3:4','2:3') else '横'
        wanted = next((r for r in resolutions if r.lower().startswith(tier) and r.endswith(orientation)), contract.get('defaultResolution'))
    limit = (contract.get('maxByResolution') or {}).get(wanted)
    if limit and duration > float(limit):
        raise ValueError('所选清晰度最多支持 ' + str(limit) + ' 秒')
    if wanted and not contract.get('omitResolution'):result['resolution'] = wanted
    if images:result['image_data_urls'] = [provider_inline_reference(v, 'image') for v in images]
    if audios:result['audio_data_urls'] = [provider_inline_reference(v, 'audio') for v in audios]
    if str(advanced.get('seed') or '').isdigit():result['seed'] = int(advanced['seed'])
    return '/v1/video/generate', result


def submit_provider_video(entry, job, trace=None):
    try:
        path, body = provider_video_payload(entry, job)
    except (ValueError, KeyError) as error:
        return None, str(error)
    headers = auth_headers(entry, None, {'Content-Type':'application/json'})
    if entry.get('requestProfile') == 'zhongheng-video':headers['Idempotency-Key'] = str(job.get('id') or uuid.uuid4().hex)
    url = provider_base_url(entry) + path
    status, result, error = http_json_request(url, body, headers=headers, method='POST', timeout=180)
    if trace is not None:trace['endpoint'] = url
    if error:return None, provider_error(error)
    if not isinstance(result, dict) or result.get('ok') is False or result.get('success') is False:
        return None, provider_error(str((result or {}).get('error') or (result or {}).get('message') or '上游拒绝任务'))
    task_id = result.get('event_id') if entry.get('requestProfile') == 'sanyuan-video' else result.get('task_id')
    if not task_id:return None, '上游没有返回任务号'
    return {'providerJobId':str(task_id),'providerProtocol':'openai','submittedAt':now(),'progress':0}, None


def provider_video_status(entry, job):
    task_id = str(job.get('providerJobId') or '');base = provider_base_url(entry)
    if entry.get('requestProfile') == 'zhongheng-video':
        status, result, error = http_json_request(base + '/v1/tasks/' + quote(task_id, safe=''),
                                                headers=auth_headers(entry), timeout=60)
        return result, error, ''
    status, result, error = http_json_request(base + '/v1/video/check', {'event_id':task_id},
        headers=auth_headers(entry, None, {'Content-Type':'application/json'}), method='POST', timeout=60)
    if error or not isinstance(result,dict) or result.get('ok') is False:
        return {}, error or str((result or {}).get('error') or '查询任务失败'), ''
    if result.get('status') == 'done':
        path = str(result.get('download_url') or '')
        if not path.startswith('/v1/video/file/'):
            return {}, '任务完成但上游没有返回有效的下载地址', ''
        request = urllib_request.Request(base + path, headers=auth_headers(entry))
        with open_http_url(request, timeout=MEDIA_FETCH_TIMEOUT) as response:
            chunks = [];total = 0
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:break
                total += len(chunk)
                if total > MEDIA_FETCH_MAX_BYTES:raise ValueError('视频文件过大')
                chunks.append(chunk)
        saved = save_media_blob(b''.join(chunks), 'video/mp4', name=(job.get('id') or 'video') + '.mp4')
        result = {'status':'succeeded', 'canvasflow_local_video':saved['url']}
    return result, None, ''


def call_video_submit(entry, job, trace=None):
    base = provider_base_url(entry)
    api_key = str(entry.get('apiKey') or '').strip()
    model = str(entry.get('model') or '').strip()
    if not base or not provider_has_credentials(entry) or not model:
        return None, '视频模型配置不完整（接口地址 / API Key / 模型标识）'
    if entry.get('requestProfile') in {'zhongheng-video', 'sanyuan-video'}:
        return submit_provider_video(entry, job, trace)
    if media_generate_entry(entry):
        return submit_video_media_generate(entry, job, trace)
    mode, prompt, image, seconds, aspect, negative, seed, last_frame, source_video = video_payload(job, entry)
    if mode == 'image-to-video' and not image:
        return None, '当前选择了图生视频，请先上传或连接一张参考图片'
    # ★★★ r873：这个模型在登记表里登记了「必传源视频」却没拿到 → **提前拦下**。
    #   不拦的后果：请求照发，上游回 400 参数错误，用户看到的是一句英文的参数报错，
    #   完全不知道自己只是"没连视频节点"（这类"看得见的失败点"必须由我们给出）。
    if entry_needs_input_video(entry) and not source_video:
        return None, f'{entry.get("name") or model} 需要一段源视频：请连接一个已生成的视频节点（或上游生成结果）后再提交'
    protocol = str(entry.get('protocol') or 'openai-video').lower()
    # 请求形态 = 异步视频任务：这一个模型强制走通用异步任务接口，忽略供应商级协议
    # （同一家供应商里既有标准异步任务模型、又有可灵/百炼专属模型的场景）。
    if str(entry.get('requestProfile') or '').strip() == 'async-video-task':
        protocol = 'openai-video'
    headers = {}
    if protocol == 'kling':
        token, error = kling_auth(api_key)
        if error: return None, error
        headers = {'Authorization': f'Bearer {token}'}
        path = '/v1/videos/image2video' if mode == 'image-to-video' else '/v1/videos/text2video'
        payload = {'model_name': model, 'prompt': prompt, 'duration': str(seconds)}
        if aspect: payload['aspect_ratio'] = aspect
        if image: payload['image'] = image
        # ★ r830：可灵的 image2video 用 `image_tail` 承载尾帧（首尾帧模式的官方字段名）。
        if last_frame: payload['image_tail'] = last_frame
        if negative: payload['negative_prompt'] = negative
        if seed.isdigit(): payload['seed'] = int(seed)
        submit_urls = [f'{base}{path}']
    elif protocol == 'dashscope':
        headers = auth_headers(entry, api_key, {'X-DashScope-Async': 'enable'})
        parameters = {'duration': seconds}
        if aspect: parameters['size'] = video_size(aspect)
        payload = {'model': model, 'input': {'prompt': prompt}, 'parameters': parameters}
        if image: payload['input']['img_url'] = image
        # ★ r830：百炼的「首尾帧」是独立模型（`*-kf2v-*`），字段是 first_frame_url / last_frame_url。
        #   只有模型名里带 kf2v 才走这套 —— 别的模型塞进去会被判非法参数。
        if last_frame and 'kf2v' in model.lower():
            payload['input'].pop('img_url', None)
            payload['input']['first_frame_url'] = image
            payload['input']['last_frame_url'] = last_frame
        if negative: payload['parameters']['negative_prompt'] = negative
        if seed.isdigit(): payload['parameters']['seed'] = int(seed)
        submit_urls = [f'{base}/services/aigc/video-generation/video-synthesis' if not base.endswith('/video-synthesis') else base]
    elif protocol in {'openai-video', 'openai'}:
        headers = auth_headers(entry, api_key)
        # ★★★ r872：时长的上游字段名以**登记表**为准（即梦 3.5 Pro 叫 `audio_duration`，
        #   其余绝大多数叫 `duration`）。以前一律发 `seconds` → 那个模型时长永远发不上去。
        #   `seconds` 仍是兜底（没登记这个模型时行为不变，零回归）。
        # ★★ r873：**登记了但没 duration 行**的模型（视频超分）不该再吃这个兜底 ——
        #   它的时长由源视频决定，发一个它没声明过的 `seconds` 就是纪律①说的"多发一个未声明的键"。
        #   ★ 判据必须用 `spec_rows_registered_for_entry`（**自己**登记过吗）而不是
        #     `spec_rows_for_entry`（含 `'*'` 兜底）—— 否则老模型会落到兜底行、被判成"登记了"、
        #     时长整段停发（实测踩到）。没自己登记 = 零回归，继续发 `seconds`。
        video_rows = spec_rows_for_entry(entry, 'video')
        duration_field = spec_semantic_field(entry, 'video', 'duration', 'seconds')
        has_duration_row = any(str((row or {}).get('key') or '').strip() == 'duration' for row in (video_rows or []))
        payload = {'model': model, 'prompt': prompt}
        if not spec_rows_registered_for_entry(entry, 'video') or has_duration_row:
            payload[duration_field] = str(seconds)
        # ★★★ r873：**其余语义键**（清晰度 / 数量 / 生成音频…）也要有机会进请求体。
        #   起因：视频超分的 `resolution` 是**必传**（720p/1080p/2k/4k/8k），而这条协议分支
        #   以前只映射了 aspectRatio 与 duration —— `resolution` 属于语义键，又被下面那段
        #   「模型专有行」循环 `if key in SPEC_SEMANTIC_KEYS['video']: continue` 排除在外，
        #   于是两头都不管 → 必传参数整段缺失 → 上游 400（用户只看到一句看不懂的参数错误）。
        #   · 值的来源：用户本次选择（`generationSettings.resolution`）→ 没有就用行里的默认值；
        #   · 字段名：行的 `field` 优先（含蛇形/驼峰变体，见 `spec_field_candidates`）；
        #   · **只在 schema 声明过这个键时才发**（纪律①）。拿不到 schema（网络抖动）→ 退回
        #     "按登记表发" —— 登记表本身就是从上游 schema 抓来的，比完全不发更可靠。
        #   · 已在 payload 里的键不覆盖（协议自己映射过的以协议为准：model / prompt / 时长 / size…）。
        #   · 只发**用户真正选过**的值，或行里登记的默认值 —— 空值不发（让上游报缺参，
        #     好过我们瞎填一个它不认的值）。
        #   ★★ 只对**自己登记过**的模型做（`spec_rows_registered_for_entry`）：落到 `'*'` 兜底行的
        #     老模型必须保持升级前的请求体一字不变 —— 实测踩到：不设这道门，兜底行里的
        #     `aspectRatio: adaptive` / `resolution: 480P` / `count: 1` 会被无中生有地塞进
        #     未登记模型的请求体（既有 `aspectRatio: adaptive` 这种上游可能不认的值）。
        schema = media_model_schema(entry, model) if hasattr(entry, 'get') else {}
        has_video_schema = bool(schema)
        job_settings = job.get('generationSettings') if isinstance(job.get('generationSettings'), dict) else {}
        semantic_defaults = {
            'resolution': str(job_settings.get('resolution') or '').strip(),
            'count': str(job_settings.get('generateCount') or '').strip(),
            # ★ 比例也走这一趟：上游字段名不统一（即梦 `ratio` / 多数 `aspect_ratio`），
            #   以前写死发 `size` → 对声明了 `ratio` 的模型等于发了个不存在的键 + 用户选择丢失。
            'aspectRatio': aspect,
        }
        audio_setting = job_settings.get('generateAudio')
        if audio_setting is not None:
            semantic_defaults['generateAudio'] = 'true' if audio_setting is not False else 'false'
        for row in (video_rows if spec_rows_registered_for_entry(entry, 'video') else []):
            key = str((row or {}).get('key') or '').strip()
            if not key or key == 'duration' or key not in SPEC_SEMANTIC_KEYS['video']:
                continue
            value = semantic_defaults.get(key) or row.get('default')
            if value in (None, ''):
                continue
            text = 'true' if value is True else 'false' if value is False else str(value)
            for name in spec_field_candidates(row):
                if name in payload:
                    break
                if has_video_schema and name not in schema:
                    continue
                payload[name] = text
                break
        # ★ 比例：**登记了自己有 aspectRatio 行的模型**由上面那一趟按行里的 field 发（已发出）；
        #   其余（老模型 / 只有 `'*'` 兜底）保持老行为发 `size`，零回归。
        registered = spec_rows_registered_for_entry(entry, 'video')
        if aspect and not (registered and any(k in payload for k in ('ratio', 'aspect_ratio', 'aspectRatio'))):
            payload['size'] = aspect
        if image: payload['input_reference'] = image
        if negative: payload['negative_prompt'] = negative
        if seed.isdigit(): payload['seed'] = int(seed)
        # ★ r860：登记表里的**模型专有行**（key 不在 SPEC_SEMANTIC_KEYS['video'] 里的）合并进请求体
        #   —— 这是「后台按模型声明提交参数」的落点（以前只能直接改 ai-models.json）。
        #   · 只在这条协议里合并：`openai-video` 的请求体是我们自己拼的，加字段可控；
        #     kling / dashscope 的字段名与层级是平台钉死的（`parameters.size` 之类），硬塞会 400。
        #   · `setdefault`：协议自己映射过的字段（model / prompt / seconds / size …）不被覆盖。
        #   · 语义键（比例/清晰度/数量/时长）不在这里处理 —— 它们的字段名是**协议级**的，
        #     由上面的映射负责；登记表控制的是「这个模型允许选哪些值」（见前端 applyModelSpecs）。
        for row in (spec_rows_for_entry(entry, 'video') or []):
            key = str((row or {}).get('key') or '').strip()
            if not key or key in SPEC_SEMANTIC_KEYS['video']:
                continue
            value = row.get('default')
            if value in (None, ''):
                continue
            payload.setdefault(str(row.get('field') or key), value)
        # ★★★ r873：源视频（超分 / 视频编辑）。登记表那条行 `default=null`（没有"默认源视频"），
        #   上面那段 `if value in (None, ''): continue` 会跳过它 —— 所以**必须单独写**，
        #   否则「登记了必传源视频」一路静默到上游 400。
        #   字段名：登记行声明的 `field` 优先（含蛇形/驼峰变体），再回落通用候选；
        #   复数名一律传数组（平台点名过：直接传字符串可能被判参数格式错误）。
        if source_video:
            names = []
            for row in spec_input_video_rows(entry, 'video'):
                for name in spec_field_candidates(row):
                    if name not in names:
                        names.append(name)
            for name in VIDEO_INPUT_FIELD_CANDIDATES:
                if name not in names:
                    names.append(name)
            for name in names:
                if name in payload:
                    break
                plural = name.endswith('s') and not name.endswith('ss')
                payload[name] = [source_video] if plural else source_video
                break
        submit_path = str(entry.get('submitPath') or '').strip()
        if submit_path.startswith('http'):
            submit_urls = [submit_path]
        elif submit_path:
            submit_urls = endpoint_candidates(base, submit_path)
        else:


            submit_urls = endpoint_candidates(base, 'videos') + endpoint_candidates(base, 'videos/generations')
    else:
        return None, f'不支持的视频协议：{protocol}'
    result, hit_url, error = request_json_candidates(submit_urls, payload, headers=headers, timeout=provider_timeout_value(entry, 'videoSubmit', 180))
    if trace is not None and hit_url:
        trace['endpoint'] = hit_url
    if error: return None, provider_error(error)
    provider_id = extract_provider_job_id(result)
    video_url = extract_provider_video_url(result)
    # 任务模式=同步：提交就该拿到成片地址。拿不到就直接说清楚，
    # 而不是偷偷退回异步轮询 —— 那会让「我明明配了同步」变成一条查不出来的行为差异。
    if str(entry.get('videoTaskMode') or '').strip() == 'sync' and not video_url:
        return None, '已按「同步」任务模式提交，但供应商没有直接返回成片地址；请把任务模式改成「异步」，或确认该供应商支持同步返回'
    if not provider_id and not video_url:
        return None, provider_error(response_value(result, 'message', 'error') or '供应商未返回 task_id 或视频地址')
    submitted = {'provider': entry.get('provider') or protocol, 'providerProtocol': protocol, 'providerJobId': provider_id, 'videoUrl': video_url, 'submittedAt': now(), 'progress': 100 if video_url else 0}
    # 少数供应商是同步返回成片的（提交即有地址）。这条路同样要落盘，
    # 否则「同步返回」这一支会绕过 refresh_video_job 的落盘逻辑，留下会过期的链接。
    if video_url:
        persist_job_video(submitted)
    return submitted, None


def status_endpoint_candidates(entry, job, base, safe_id):
    """异步任务状态查询的候选端点（对齐 FTV）。

    - 显式配了 statusPath（`{task_id}` 或 `{id}` 占位）→ 只用它
    - 之前命中过的路径（记在 job.statusPathHit）→ 直接用，不再每次试一圈
    - 否则按常见形态依次尝试，**项目原有默认 videos/{id} 排第一**（零回归）
    """
    configured = str(entry.get('statusPath') or '').strip()
    if configured:
        path = configured.replace('{task_id}', safe_id).replace('{id}', safe_id)
        return [path if path.startswith('http') else f'{base}/{path.lstrip("/")}']
    hit = str(job.get('statusPathHit') or '').strip()
    if hit:
        return [hit.replace('{task_id}', safe_id).replace('{id}', safe_id)]
    templates = ['videos/{task_id}', 'videos/generations/{task_id}']
    if model_has_usage(entry, 't2i'):
        templates.append('images/tasks/{task_id}')
    templates.extend(['tasks/{task_id}', 'task/{task_id}', 'async/tasks/{task_id}'])
    candidates = []
    for template in templates:
        candidates.extend(endpoint_candidates(base, template.replace('{task_id}', safe_id)))
    return unique_strings(candidates)


def video_endpoint_preview(entry):
    """视频链路不做在线实测（按次计费高），这里只列出「将会尝试的端点」，方便排查配置。"""
    base = provider_base_url(entry)
    if not base:
        return {'submit': [], 'status': []}
    protocol = str(entry.get('protocol') or 'openai-video').lower()
    if protocol == 'kling':
        return {
            'submit': [f'{base}/v1/videos/text2video', f'{base}/v1/videos/image2video'],
            'status': [f'{base}/v1/videos/{{task_id}}'],
        }
    if protocol == 'dashscope':
        return {
            'submit': [f'{base}/services/aigc/video-generation/video-synthesis'],
            'status': [f'{base}/tasks/{{task_id}}'],
        }
    submit_path = str(entry.get('submitPath') or '').strip()
    if submit_path.startswith('http'):
        submit = [submit_path]
    elif submit_path:
        submit = endpoint_candidates(base, submit_path)
    else:
        submit = endpoint_candidates(base, 'videos') + endpoint_candidates(base, 'videos/generations')
    return {
        'submit': unique_strings(submit),
        'status': status_endpoint_candidates(entry, {}, base, '{task_id}'),
    }


def provider_status_request(entry, job):
    """查询异步任务状态。返回 (result, error, 命中的 URL 模板)。

    候选链命中后把 URL 模板记到 job 上，后续轮询就不用再逐个试。
    """
    if entry.get('requestProfile') in {'zhongheng-video', 'sanyuan-video'}:
        return provider_video_status(entry, job)
    protocol = str(entry.get('protocol') or 'openai-video').lower()
    provider_id = str(job.get('providerJobId') or '').strip()
    if not provider_id:
        return {}, '供应商任务 ID 缺失', ''
    base = provider_base_url(entry)
    safe_id = quote(provider_id, safe='')
    headers = {}
    if protocol == 'kling':
        token, error = kling_auth(entry.get('apiKey'))
        if error: return {}, error, ''
        headers = {'Authorization': f'Bearer {token}'}
        candidates = [f'{base}/v1/videos/{safe_id}']
    elif protocol == 'dashscope':
        headers = auth_headers(entry, None, {'X-DashScope-Async': 'enable'})
        candidates = [f'{base}/tasks/{safe_id}']
    else:
        headers = auth_headers(entry)
        candidates = status_endpoint_candidates(entry, job, base, safe_id)
    last_error = ''
    for url in candidates:
        status, result, error = http_json_request(url, headers=headers,
                                timeout=provider_timeout_value(entry, 'statusPoll', 60))
        if not error:
            if media_generate_entry(entry):
                failure = media_status_payload_error(result)
                if failure: return {}, failure, ''
            return result, None, url.replace(safe_id, '{task_id}')
        last_error = error
        if status in (401, 403):
            break
    return {}, last_error or '无法查询任务状态', ''


def refresh_video_job(job):
    current = dict(job)
    if current.get('status') in {'completed', 'failed'}:
        if current.get('status') == 'completed':
            current['progress'] = 100
        # 已完成/已失败的任务不再轮询供应商，但**落盘这件事还没做**就得补。
        # 这段专门兜两类历史遗留：
        #   ① 落盘功能上线**之前**生成的任务，手上还是会过期的供应商地址；
        #   ② 上一次落盘失败（供应商暂时 5xx）留下的，下次刷新有机会自愈。
        # 没有这段的话，「已完成」会变成一个永不修补的终态 —— 视频能看几天，
        # 然后链接一过期就永久黑掉，而且没有任何报错。
        if current.get('status') == 'completed' and str(current.get('videoUrl') or '').strip() \
                and not str(current.get('videoUrl') or '').startswith('/media/'):
            persist_job_video(current)
        return current
    entry = next((item for item in read_ai_models() if item.get('id') == current.get('modelId') and model_has_usage(item, 'video')), None)
    # ★ r803：后台轮询也要吃「发起者自己那套超时」。
    #   这条路径走的是 read_ai_models()（全量），**不经过** visible_ai_models 的注入出口，
    #   所以这里补一次投影 —— job 里存了 userId（见 create_video_job），历史 job 没有则回落全局。
    entry = with_user_timeouts(entry, current.get('userId'))
    if not entry:
        current.update({'status': 'failed', 'progress': 0, 'error': '视频模型已被删除或停用'})
        return current
    if current.get('videoUrl'):
        current.update({'status': 'completed', 'progress': 100, 'simulated': False})
        return current
    # 视频总等待：超过上限仍未完成的任务直接判定失败，避免永远挂在「生成中」。
    # ★ 用 provider_timeout_value(entry, ...)：entry 在上一行才定义，所以取值必须放在这里，
    #   挪到 entry 之前会 NameError（这个函数开头还有一段 completed/failed 的早退分支用不到它）。
    limit_minutes = provider_timeout_value(entry, 'videoTotalWait', 20)
    submitted = str(current.get('submittedAt') or '')
    if limit_minutes and submitted:
        try:
            stamp = datetime.fromisoformat(submitted)
            if stamp.tzinfo is None: stamp = stamp.replace(tzinfo=timezone.utc)
            elapsed = (datetime.now(timezone.utc) - stamp).total_seconds()
        except (TypeError, ValueError):
            elapsed = 0
        if elapsed > limit_minutes * 60:
            current.update({'status': 'failed', 'progress': 0, 'simulated': False, 'error': f'等待超过 {limit_minutes} 分钟仍未完成，已停止跟踪'})
            return current
    result, error, status_path_hit = provider_status_request(entry, current)
    if error:
        # A query failure says nothing about whether the upstream task succeeded.
        # Keep polling until its business status or the total-wait deadline is known.
        current.update({'pollError': provider_error(error), 'lastPollErrorAt': now(),
                        'pollErrorCount': int(current.get('pollErrorCount') or 0) + 1, 'simulated': False})
        return current
    for key in ('pollError', 'lastPollErrorAt', 'pollErrorCount'):
        current.pop(key, None)
    if status_path_hit:
        # 记住命中的状态路径，后续轮询直接用它，不再逐个试候选
        current['statusPathHit'] = status_path_hit
    capture_job_metering(current, result)
    provider_status = normalize_provider_status(result)
    video_url = result.get('canvasflow_local_video') or (media_video_result_url(result) if media_generate_entry(entry) else '') or extract_provider_video_url(result)
    current['progress'] = extract_provider_progress(result) or (100 if video_url else int(current.get('progress') or 0))
    current['status'] = 'completed' if video_url or provider_status == 'completed' else provider_status
    if current['status'] == 'completed':
        current['progress'] = 100
    if video_url:
        current['videoUrl'] = video_url
        # **拿到地址的这一刻就落盘。** 供应商给的链接会过期，晚存不如早存 ——
        # 而且这里已经处在「正在等视频生成」的用户可接受延迟里，多花几秒下载不会更糟。
        # 失败不影响任务成功（视频确实生成好了），只留一笔 videoPersistError。
        persist_job_video(current)
    if current['status'] == 'failed': current['error'] = provider_error(str(result.get('error') or '') or extract_failure_reason(result) or '供应商生成失败')
    current['simulated'] = False
    return current


def completed_media_update(previous, incoming):
    """Allow only a durable-media upgrade of an existing completed result.

    Terminal status, billing and all generation metadata still come from the
    persisted snapshot, so a stale poll cannot undo cancellation or completion.
    """
    merged = dict(previous)
    if previous.get('status') != 'completed' or incoming.get('status') != 'completed':
        return merged
    for kind in ('image', 'video', 'audio'):
        url_key = kind + 'Url'
        source = str(previous.get(kind + 'Data') or previous.get(url_key) or '')
        target = str(incoming.get(url_key) or '')
        if not source or (source.startswith('/media/') and resolve_media_file(source.rsplit('/', 1)[-1])):
            continue
        if not target.startswith('/media/') or not resolve_media_file(target.removeprefix('/media/')):
            continue
        merged[url_key] = target
        merged['mediaId'] = target.removeprefix('/media/')
        merged.pop(kind + 'Data', None)
        merged.pop(kind + 'PersistError', None)
    return merged


def append_job(job):
    """Append a latest job snapshot while keeping the append-only log bounded."""
    with LOCK:
        lines = JOBS_FILE.read_text(encoding='utf-8').splitlines() if JOBS_FILE.exists() else []
        # A delayed poll/background worker must not undo a completed or cancelled task.
        for line in reversed(lines):
            try:
                previous = json.loads(line)
            except (ValueError, TypeError):
                continue
            if not isinstance(previous, dict) or previous.get('id') != job.get('id'):
                continue
            if previous.get('status') in {'completed', 'failed'}:
                merged = completed_media_update(previous, job)
                job.clear()
                job.update(merged)
                if merged == previous:
                    return
                break
            if previous == job:
                return
            break
        if job.get('charge') and job.get('status') in {'completed', 'failed'}:
            settle_job_charge(job)
        if globals().get('ACCOUNT_STORAGE') and (job.get('userId') or job.get('ownerId')):
            ACCOUNT_STORAGE.ensure(job.get('userId') or job.get('ownerId'),len(json.dumps(job,ensure_ascii=False).encode('utf-8'))+1)
        lines.append(json.dumps(job, ensure_ascii=False))
        temp = JOBS_FILE.with_name(JOBS_FILE.name + '.' + uuid.uuid4().hex + '.tmp')
        try:
            temp.write_text('\n'.join(lines) + '\n', encoding='utf-8')
            temp.replace(JOBS_FILE)
        finally:
            temp.unlink(missing_ok=True)
    scope = GENERATION_REQUEST_CHARGE.get()
    if scope and job.get('charge') and job['charge'].get('holdId') == scope['charge'].get('holdId') and job.get('status') not in {'completed','failed'}:
        scope['deferred'] = True


def create_video_job(user, incoming, workspace_id='', *, retry_of=None):
    """提交一个视频生成任务。返回 (public_job, failure)。

    `/api/generate`（画布上点「生成」）和对话式 Agent 的 submit_video_job 工具共用这一份，
    避免两条路径对「怎么选模型、怎么记 job」产生分歧。
    failure 形如 {'error':..., 'message':..., 'status': 400}。
    """
    # ★ 与生图同一条约定：带 `presetScene` 时由**服务端**注入提示词正文
    #   （普通用户/VIP 的浏览器里根本没有正文，只传 scene id）；
    #   用户自己写的补充内容拼在后面，一起发。
    preset_scene = str(incoming.get('presetScene') or '').strip()[:80]
    preset_text = preset_prompt_text(preset_scene) if preset_scene else ''
    user_text = str(incoming.get('prompt') or '').strip()
    prompt = '\n'.join([part for part in (preset_text, user_text) if part]).strip()
    if not prompt:
        return None, {'error': 'missing_prompt', 'message': '请输入视频提示词', 'status': 400}
    settings = incoming.get('generationSettings') if isinstance(incoming.get('generationSettings'), dict) else {}
    model_id = str(settings.get('modelId') or incoming.get('modelId') or '').strip()
    # 必须按「真的能提交」来筛：光看 enabled 会把没填 API Key 的占位模型也算进来，
    # 于是「只有一个可用模型就自动选它」这条兜底会失效 —— 实测踩过：用户有一个启用的
    # 无 Key 演示模型（可灵）+ 一个配好的模型，结果报「还没有启用中的视频模型」，
    # 而用户刚刚才接好一个，非常误导。
    all_video = [item for item in visible_ai_models(user['id']) if model_has_usage(item, 'video') and item.get('enabled')]

    def submittable(item):
        return bool(provider_has_credentials(item) and str(item.get('baseUrl') or '').strip()
                    and str(item.get('model') or '').strip())

    models = [item for item in all_video if submittable(item)]
    entry = next((item for item in models if item.get('id') == model_id), None)
    if not entry and not model_id and len(models) == 1:
        entry = models[0]
        model_id = str(entry.get('id') or '')
    if not entry:
        if not all_video:
            message = '还没有启用中的视频模型，请先在设置里接入一个视频模型'
        elif not models:
            message = '已启用的视频模型都还没配全（缺 API Key / 接口地址 / 模型标识），请到设置里补全'
        else:
            message = '指定的视频模型不可用或没配全，请重新选一个（可以先用 list_models 看看有哪些可用）'
        return None, {'error': 'video_model_not_configured', 'message': message, 'status': 400}
    try:validate_generation_contract(entry,'video',incoming,strict=True)
    except ValueError as error:return None,{'error':'invalid_model_parameters','message':str(error),'status':400}
    job = {
        'id': f'job-{uuid.uuid4().hex[:10]}', 'kind': 'video', 'userId': user['id'], 'projectId': incoming.get('projectId'),
        'outputId': str(incoming.get('outputId') or '')[:100], 'modelId': model_id, 'provider': entry.get('provider') or entry.get('protocol') or 'video',
        'prompt': prompt, 'status': 'queued', 'progress': 0, 'simulated': False, 'createdAt': now(),
    }
    if retry_of:
        job['retryOf'] = str(retry_of['id'])
        job['retryCount'] = int(retry_of.get('retryCount') or 0) + 1
    # ★ r830：`referenceMode` 必须一起留下来 —— 它是「视频生成模式」的真身
    #   （text2video / singleImage2video / frames2video / image2video / video2video /
    #    videoEdit2video / audio2video / mixed2video / videoExtend2video / longVideo2video）。
    #   漏了它就等于前端选了个模式、服务端完全不知道（旧版就是这个状态：模式只是标签）。
    job['generationSettings'] = {key: settings.get(key) for key in ('modelId', 'videoMode', 'referenceMode', 'aspectRatio', 'resolution', 'duration', 'cameraMove', 'generateAudio', 'generateCount', 'modelOptions') if settings.get(key) is not None}
    if isinstance(incoming.get('advancedSettings'), dict):
        job['advancedSettings'] = {key: incoming['advancedSettings'].get(key) for key in ('seed', 'motion', 'negativePrompt') if incoming['advancedSettings'].get(key) is not None}
    if isinstance(incoming.get('upstreamInputs'), list): job['upstreamInputs'] = [str(item)[:120] for item in incoming['upstreamInputs'] if str(item).strip()][:8]
    images = incoming.get('referenceImages') if isinstance(incoming.get('referenceImages'), list) else []
    job['referenceImages']=[]
    for item in images[:2]:
        if not isinstance(item,str):return None,{'error':'invalid_reference','message':'参考图片格式无效','status':400}
        if item.startswith('/media/'):
            validate_new_media(user['id'],item)
            media_id=urlparse(item).path.rsplit('/',1)[-1];file=resolve_media_file(media_id)
            if not file:return None,{'error':'invalid_reference','message':'参考图片文件不存在','status':400}
            if ((file.stat().st_size+2)//3)*4+64>VIDEO_MAX_IMAGE:
                return None,{'error':'reference_too_large','message':'参考图片过大，请压缩后再生成','status':400}
            from file_formats import validate_asset_media
            try:validate_asset_media('image',path=file)
            except ValueError as error:return None,{'error':'invalid_reference','message':str(error),'status':400}
            item=media_data_uri(media_id)
        if len(item)>VIDEO_MAX_IMAGE:return None,{'error':'reference_too_large','message':'参考图片过大，请压缩后再生成','status':400}
        if not (item.startswith('data:image/') or item.startswith(('http://','https://'))):
            return None,{'error':'invalid_reference','message':'参考图片格式无效','status':400}
        job['referenceImages'].append(item)
    # ★★★ r873：源视频（超分 / 视频编辑这类模型的必传素材）。与参考图**严格分开**：
    #   只收 http(s) 直链（上游不收 base64 视频），最多 1 个（上游声明"仅支持 1 个"）。
    source_videos = incoming.get('sourceVideos') if isinstance(incoming.get('sourceVideos'), list) else []
    if any(not isinstance(item,str) or len(item)>VIDEO_INPUT_VIDEO_MAX_LEN or not item.startswith(('http://','https://')) for item in source_videos[:1]):
        return None,{'error':'invalid_source_video','message':'源视频需要有效的 HTTP 链接，且不得超过允许的长度','status':400}
    job['sourceVideos'] = source_videos[:1]
    source_audios = incoming.get('sourceAudios') if isinstance(incoming.get('sourceAudios'), list) else []
    if any(not isinstance(value, str) or len(value) > VIDEO_MAX_IMAGE or not value.startswith(('https://', 'http://', 'data:audio/')) for value in source_audios[:1]):
        return None, {'error': 'invalid_source_audio', 'message': '参考音频需要有效的音频链接或音频文件', 'status': 400}
    job['sourceAudios'] = source_audios[:1]
    # ★★ r884：视频在**提交时预扣**（按次 = perCall；按秒 = 请求时长 × perSecond）。
    #   真正的「多退少补」在任务走到终态时由 `settle_job_charge()` 收口 ——
    #   上游回报的实际时长可能和请求的不一样，而且失败必须全额退回。
    #   ★ 预扣放在这里而不是端点层：`/api/generate` 与 Agent 的 submit_video_job 共用这一份，
    #     放端点层必然漏掉一条路径（本项目「多入口一致性」踩过）。
    job['charge'] = open_generation_charge(
        user, entry, prompt_text=prompt, seconds=parse_video_seconds(job['generationSettings'].get('duration')),
        label=entry.get('name'))
    trace = {}
    submitted, error = call_video_submit(entry, job, trace=trace)
    if error:
        # 提交失败 → 预扣全额退回（用户不该为一次没发出去的请求买单）。
        if job.get('charge'):
            job['charge']['settled'] = False
            settle_generation_charge(job['charge'], failed=True, label=entry.get('name'))
        return None, {'error': 'video_submit_failed', 'message': provider_error(error), 'provider': entry.get('provider') or entry.get('protocol'), 'status': 502}
    if trace.get('usage') is not None:
        job['upstreamUsage'] = trace['usage']
    job.update(submitted)
    job['status'] = 'completed' if job.get('videoUrl') else 'queued'
    job['progress'] = 100 if job.get('videoUrl') else 0
    job['workspaceId'] = workspace_id
    append_job(job)
    return {key: value for key, value in job.items() if key != 'referenceImages'}, None


def latest_jobs(user_id=None, limit=100, project_id=None, workspace_id=None, valid_ids=None):
    """Read one latest snapshot per job, scoped to the signed-in user（以及所在工作区）。"""
    snapshots = {}
    if not JOBS_FILE.exists(): return []
    try:
        lines = JOBS_FILE.read_text(encoding='utf-8').splitlines()
    except OSError:
        return []
    for line in lines:
        try:
            job = json.loads(line)
        except (json.JSONDecodeError, TypeError):
            continue
        if not isinstance(job, dict) or not job.get('id'):
            continue
        local_job(job)
        if user_id and job.get('userId') != user_id:
            continue
        if workspace_id and not in_workspace(job, workspace_id, valid_ids):
            continue
        if project_id and str(job.get('projectId') or '') != project_id:
            continue
        snapshots[str(job['id'])] = job
    jobs = list(snapshots.values())
    jobs.sort(key=lambda item: str(item.get('createdAt') or ''), reverse=True)
    return jobs if limit is None else jobs[:max(1, min(int(limit or 100), 200))]


# ---------------------------------------------------------------- 图片生成任务（轮询式）
# 图片上游分两类：
#   ① 配了 imageTaskMode=async 的供应商 → 提交拿任务号，进度/结果由 refresh_image_job 查上游（**真进度**）；
#   ② 其余（chat-image / 标准同步协议）→ 没有任务号，由后台线程跑完整生成，
#      期间 progress 保持 None（前端显示不确定动效），但 stage 会真实推进。
# 前端只有一套：提交 → jobId → 轮询 /api/jobs/{id}，按 progress 有没有值决定显示百分比还是阶段文字。
# ★ 参考图（data URI，可能几 MB）**不进 job 快照**（jobs.jsonl 会爆），只放这张内存表；
#   进程重启会丢，那种情况下任务本就无法继续，由总等待超时保护判失败。
IMAGE_JOB_PAYLOADS = {}
IMAGE_JOB_LOCK = threading.Lock()
# 异步查询路径的探测结果缓存：baseUrl -> 查询路径（'' = 确认不支持）。避免每次生成都探测。
IMAGE_TASK_PATH_CACHE = {}
# 「异步图片任务是否已启用」的探测缓存：baseUrl -> bool。
IMAGE_ASYNC_READY_CACHE = {}
# 「该模型历史中位耗时」缓存：modelId -> (取数时间戳, 秒数)。5 分钟过期。
IMAGE_TYPICAL_CACHE = {}
IMAGE_TYPICAL_TTL = 300


def typical_job_seconds(kind, model_id):
    """该模型历史**成功**任务的中位耗时（秒）；样本不足 3 条返回 0。

    按 `kind`（image / audio）分别统计。用途：上游不返回 progress 时，前端拿
    「已用时间 ÷ 这个值」换算预估进度条 —— 数据来自**真实历史记录**，不是拍脑袋的固定曲线。
    样本不足就不显示预估（宁可不给，不给错的）。
    """
    kind = str(kind or '').strip() or 'image'
    model_id = str(model_id or '').strip()
    if not model_id:
        return 0
    cache_key = f'{kind}:{model_id}'
    cached = IMAGE_TYPICAL_CACHE.get(cache_key)
    if cached and time.monotonic() - cached[0] < IMAGE_TYPICAL_TTL:
        return cached[1]
    durations = []
    try:
        for job in latest_jobs(limit=200):
            if str(job.get('kind') or '') != kind or job.get('modelId') != model_id:
                continue
            if job.get('status') != 'completed':
                continue
            started, done = str(job.get('createdAt') or ''), str(job.get('completedAt') or '')
            if not started or not done:
                continue
            try:
                a = datetime.fromisoformat(started)
                b = datetime.fromisoformat(done)
                if a.tzinfo is None: a = a.replace(tzinfo=timezone.utc)
                if b.tzinfo is None: b = b.replace(tzinfo=timezone.utc)
                seconds = (b - a).total_seconds()
            except (TypeError, ValueError):
                continue
            if 1 <= seconds <= 1800:
                durations.append(seconds)
    except Exception:  # noqa: BLE001 —— 统计失败不该影响任务本身
        return 0
    value = 0
    if len(durations) >= 3:
        durations.sort()
        value = int(durations[len(durations) // 2])
    IMAGE_TYPICAL_CACHE[cache_key] = (time.monotonic(), value)
    return value


def detect_image_async_ready(entry):
    """该供应商的异步图片任务是否**已启用**（不只是端点存在）。

    ★★ 「端点存在」≠「功能启用」：sub2api 的异步功能是**部署级开关**（需配 S3 对象存储），
    未启用时 `/images/tasks/{id}` **仍返回业务级 404**，只有 async 提交端点会明确回
    `404 async image tasks are not enabled`。所以判据必须打在**提交端点**上。

    探测方式：向 async 提交端点发一个**空 prompt + 不存在的 model** 的 POST ——
    双重拒因，必定被业务校验拦下（400/403/503…），**不会创建任务、不消耗额度**；
    只有明确回 `not enabled` 才算未启用。结果按 baseUrl 缓存。
    """
    base_url = str(entry.get('baseUrl') or '').rstrip('/')
    api_key = str(entry.get('apiKey') or '').strip()
    if not base_url or not provider_has_credentials(entry):
        return False
    if base_url in IMAGE_ASYNC_READY_CACHE:
        return IMAGE_ASYNC_READY_CACHE[base_url]
    submit_path = str(entry.get('imageSubmitPath') or '').strip() or '/images/generations/async'
    ready = False
    for url in endpoint_candidates(base_url, submit_path):
        status, payload, error = http_json_request(
            url, {'model': 'canvasflow-probe-not-a-real-model'},
            headers=auth_headers(entry, api_key), timeout=20)
        text = response_text(status, payload, error)
        if 'not enabled' in text:
            ready = False
            break
        if is_route_miss(status, payload, error):
            continue  # 候选路径不对，试下一个
        ready = True   # 进了业务逻辑（400/403/502…）⇒ 功能已启用
        break
    IMAGE_ASYNC_READY_CACHE[base_url] = ready
    return ready


def detect_image_task_path(entry):
    """探测某供应商是否支持「异步图片任务查询」，返回可用查询路径（含 {task_id}）或 ''。

    ★★ 判据是 404 的**响应体语义**，不是状态码 —— 这是唯一零额度消耗的探测方式：
      · 路由级 404（`Invalid URL` / `page not found`）→ 端点不存在；
      · 业务级 404（`IMAGE_TASK_NOT_FOUND` / `task_not_exist`）→ **端点存在**，只是假任务号查不到。
    只试不带 id 的路径会把「支持异步」误判成「不支持」（本项目踩过这个坑）。
    显式配了 imageStatusPath 时直接用它，不探测。
    """
    configured = str(entry.get('imageStatusPath') or '').strip()
    if configured and detect_image_async_ready(entry):
        return configured
    base_url = str(entry.get('baseUrl') or '').rstrip('/')
    api_key = str(entry.get('apiKey') or '').strip()
    if not base_url or not provider_has_credentials(entry):
        return ''
    if base_url in IMAGE_TASK_PATH_CACHE:
        return IMAGE_TASK_PATH_CACHE[base_url]
    # ★ 功能没启用时，查询端点仍会返回业务级 404（看着"端点存在"）—— 先确认启用，否则直接判不支持。
    if not detect_image_async_ready(entry):
        IMAGE_TASK_PATH_CACHE[base_url] = ''
        return ''
    found = ''
    probe_id = 'canvasflow-probe-not-exist'
    for candidate in ('/images/tasks/{task_id}', '/tasks/{task_id}', '/images/generations/{task_id}'):
        path = candidate.replace('{task_id}', probe_id)
        urls = endpoint_candidates(base_url, path)
        status, payload, error, _hit = request_json_first_hit(urls, auth_headers(entry, api_key), 20)
        if status in (401, 403):
            break  # 认证有问题，别再猜路径了
        text = response_text(status, payload, error)
        if is_route_miss(status, payload, error):
            continue  # 所有候选都路由级 404 → 这个路径不存在
        if 'task' in text or 'not_exist' in text or 'not_found' in text:
            found = candidate
            break
    IMAGE_TASK_PATH_CACHE[base_url] = found
    return found


def run_image_job_in_background(job_id):
    """同步协议图片任务：后台线程里跑完整生成，完成后把结果写回 job 快照。"""
    with IMAGE_JOB_LOCK:
        payload = IMAGE_JOB_PAYLOADS.pop(job_id, None)
    if not payload:
        return
    job = dict(payload.get('job') or {})
    STORAGE_ACTOR.set(job.get('userId') or job.get('ownerId') or '')
    entry = payload.get('entry') or {}
    try:
        image_data, error = call_image_generation(
            entry, payload.get('prompt'), size=payload.get('size') or '1024x1024',
            reference_image=payload.get('referenceImage'),
            reference_images=payload.get('referenceImages'),
            quality=payload.get('quality'))
        if error or not image_data:
            job.update({'status': 'failed', 'stage': 'failed', 'error': str(error or '生图失败')[:300]})
        else:
            job['stage'] = 'downloading'
            job['imageData'] = image_data
            persist_job_image(job)
            job.update({'status': 'completed', 'stage': 'completed', 'progress': 100, 'completedAt': now()})
    except Exception as exc:  # noqa: BLE001 —— 后台线程绝不能把异常抛出去
        job.update({'status': 'failed', 'stage': 'failed', 'error': str(exc)[:300]})
    try:
        append_job(job)
    except Exception:  # noqa: BLE001
        pass


def create_image_job(user, incoming, workspace_id=''):
    """提交一个图片生成任务。返回 (public_job, failure)。

    与 /api/ai/image-generate 的同步路径共用同一套模型校验与预设注入规则，
    区别只在「立即等结果」还是「先返回 jobId 再轮询」。
    """
    preset_scene = str(incoming.get('presetScene') or '').strip()[:80]
    preset_text = preset_prompt_text(preset_scene) if preset_scene else ''
    user_text = str(incoming.get('prompt') or '').strip()
    prompt_text = '\n'.join([part for part in (preset_text, user_text) if part]) or None
    model_id = str(incoming.get('modelId') or '').strip()
    entry = next((m for m in visible_ai_models(user['id'])
                  if m.get('id') == model_id and m.get('enabled') and model_has_usage(m, 't2i')), None) if model_id else None
    if not entry:
        return None, {'error': 'ai_model_not_found', 'message': '所选生图模型不存在或未启用，请在管理后台「模型接入」中配置', 'status': 400}
    entry=image_entry_options(entry,incoming)
    size = str(incoming.get('size') or '1024x1024')
    reference_image = incoming.get('referenceImage') if isinstance(incoming.get('referenceImage'), str) else None
    raw_references = incoming.get('referenceImages')
    references = [item for item in raw_references if isinstance(item, str) and item.strip()] if isinstance(raw_references, list) else []
    quality = incoming.get('quality') if isinstance(incoming.get('quality'), str) else None
    job = {
        'id': f'job-{uuid.uuid4().hex[:10]}', 'kind': 'image', 'userId': user['id'],
        'projectId': incoming.get('projectId'), 'outputId': str(incoming.get('outputId') or '')[:100],
        'modelId': model_id, 'provider': entry.get('provider') or entry.get('protocol') or 'image',
        'prompt': str(prompt_text or ''), 'size': size,
        'status': 'queued', 'stage': 'submitted', 'progress': None,
        'simulated': False, 'createdAt': now(), 'workspaceId': workspace_id,
    }
    job['inputSummary'] = {'referenceCount': len(references) if references else int(bool(reference_image)),
                           'size': size, 'quality': image_quality_value(entry.get('model'), quality, entry.get('name')),
                           'modelOptions': incoming.get('modelOptions') or {}}
    job['charge'] = open_generation_charge(user, entry, prompt_text=prompt_text or '', calls=1, label=entry.get('name'))
    # ★ 异步能力判定：显式 `imageTaskMode=async` 优先；没配时**自动探测**
    #   （一次带假任务号的 GET，零额度消耗，按 baseUrl 缓存）——用户不需要手动填配置，
    #   支持轮询的供应商自动走真进度，不支持的自动走后台线程。
    #   `imageTaskMode=sync` 可显式关掉（有些供应商端点存在但行为不靠谱时用）。
    # ★★ 统一媒体端点（/v1/media/generate）是**天生异步**的，没有"一次请求直接拿图"的形态。
    #    所以这里跳过整套能力探测（`detect_image_async_ready` 打的是 `/images/generations/async`，
    #    对这类平台必然路由级 404 → 会误判"不支持异步"→ 回落到后台线程 → 退到 `call_image_generation`
    #    的 `images/*` 路径 —— 而这类模型正是被 `images/*` **路由级拒绝**的（实测原话：
    #    「模型不支持 /v1/images/* 端点，请改用 POST /v1/media/generate」）。
    #    直接钉死：模式=异步，查询接口=平台固定的 `skills/task-status?task_id={task_id}`。
    if media_generate_entry(entry):
        task_mode = 'async'
        status_path = str(entry.get('imageStatusPath') or '').strip() or MEDIA_STATUS_PATH
        media_async_pinned = True
    else:
        task_mode = str(entry.get('imageTaskMode') or '').strip()
        status_path = str(entry.get('imageStatusPath') or '').strip()
        media_async_pinned = False
    if not media_async_pinned and task_mode != 'sync':
        # ★★ 显式配了异步（taskMode 或 statusPath）也要**先确认供应商真的启用了异步**：
        #   否则提交会打在未启用的 async 端点上（404 not enabled）→ 白白生成失败。
        #   这里确认不了就**自动回落同步**，只记一笔 asyncFallback —— 换供应商不用改配置、更不会失败。
        if status_path:
            if not detect_image_async_ready(entry):
                job['asyncFallback'] = '供应商未启用异步图片任务，已自动改用同步提交'
                status_path = ''
        else:
            status_path = detect_image_task_path(entry)
    if task_mode == 'async' or status_path:
        submitted, submit_error = submit_image_generation(
            entry, prompt_text, size=size, reference_image=reference_image,
            reference_images=references, quality=quality)
        provider_id = extract_provider_job_id(submitted) if submitted else ''
        if provider_id:
            job.update({'providerJobId': provider_id, 'providerProtocol': entry.get('protocol') or 'image',
                        'imageStatusPath': status_path, 'status': 'running', 'stage': 'running'})
            append_job(job)
            return job, None
        # ★ 提交已发出但解析不到任务号：**绝不能回落后台线程再生成一次** ——
        #   那等于同一张图提交两遍（真金白银扣两次）。这里就地收敛：
        #   ① 有些供应商的"异步"提交会直接把图带回来 → 就地完成；
        #   ② 否则判失败并把原因写清楚（用户改配置即可，不会静默重复消费）。
        job['submitFallback'] = str(submit_error or '供应商未返回任务号')[:200]
        image_data, image_error = (None, job['submitFallback'])
        if submitted:
            image_data, image_error = finish_image_result(submitted, time.monotonic() + 120)
        if image_data:
            job['imageData'] = image_data
            persist_job_image(job)
            job.update({'status': 'completed', 'stage': 'completed', 'progress': 100, 'completedAt': now()})
        else:
            # ★ 提交阶段就失败（没拿到 submitted）时别说"已按异步模式提交" —— 那会让用户
            #   以为是任务号解析问题，实际是**请求根本没被接受**（参数错误 / 余额不足 / 模型名不对）。
            #   也**不再套一层"供应商拒绝了本次提交"** —— submit_error 本身已经是人话
            #   （如「供应商拒绝了本次请求（code=404）：模型不存在或未启用」），套两层只会更难读。
            message = (str(image_error or '')[:200] if submitted is None
                       else f'已按异步模式提交，但未能取得任务号：{str(image_error or "")[:160]}')
            job.update({'status': 'failed', 'stage': 'failed', 'error': message})
        append_job(job)
        return job, None
    with IMAGE_JOB_LOCK:
        IMAGE_JOB_PAYLOADS[job['id']] = {
            'job': dict(job), 'entry': entry, 'prompt': prompt_text, 'size': size,
            'referenceImage': reference_image, 'referenceImages': references, 'quality': quality,
        }
    job.update({'status': 'running', 'stage': 'running'})
    append_job(job)
    threading.Thread(target=run_image_job_in_background, args=(job['id'],), daemon=True).start()
    return job, None


def refresh_image_job(job):
    """刷新一个图片任务。

    - 有任务号（异步供应商）→ 查上游：写回真实 progress / stage，拿到图就落盘并完成；
    - 无任务号（同步供应商）→ progress 保持 None（前端显示不确定动效），
      完成与否由后台线程写回 job 快照，这里只做总等待超时兜底。
    """
    current = dict(job)
    if current.get('status') in {'completed', 'failed'}:
        return current
    entry = next((item for item in read_ai_models() if item.get('id') == current.get('modelId')), None)
    entry = with_user_timeouts(entry, current.get('userId'))
    limit_minutes = provider_timeout_value(entry, 'imageTotalWait', 3) if entry else 3
    submitted = str(current.get('createdAt') or '')
    if limit_minutes and submitted:
        try:
            stamp = datetime.fromisoformat(submitted)
            if stamp.tzinfo is None: stamp = stamp.replace(tzinfo=timezone.utc)
            elapsed = (datetime.now(timezone.utc) - stamp).total_seconds()
        except (TypeError, ValueError):
            elapsed = 0
        if elapsed > limit_minutes * 60:
            current.update({'status': 'failed', 'stage': 'failed',
                            'error': f'等待超过 {limit_minutes} 分钟仍未完成，已停止跟踪'})
            return current
    provider_id = str(current.get('providerJobId') or '').strip()
    if not provider_id:
        # 后台线程模式：进度不可知，保持 progress=None；线程完成后会写新的 job 快照。
        return current
    if not entry:
        current.update({'status': 'failed', 'stage': 'failed', 'error': '图片模型已被删除或停用'})
        return current
    base_url = str(entry.get('baseUrl') or '').rstrip('/')
    api_key = str(entry.get('apiKey') or '').strip()
    # 查询路径优先用 job 里存的（可能是自动探测到的），再回落模型配置。
    payload, error, status_code = query_image_task_once(
        entry, provider_id, base_url, api_key,
        status_path=str(current.get('imageStatusPath') or '').strip())
    if error:
        # 单次查询失败不判死（可能是瞬时抖动），由上面的总等待兜底。
        # ★ 例外：统一媒体端点的查询接口**请求级**失败（4xx = 任务号无效 / 越权 / 端点不对）
        #   重试永远不会成功 —— 实测它回 HTTP 400 + `{"error":{"message":"task_id 参数无效"}}`，
        #   而且 `http_json_request` 在 4xx 时把响应体压进 `error`、`payload` 留空 dict，
        #   所以只能按**状态码**判，不能靠解析响应体。5xx 与传输层抖动仍走"不判死"。
        if media_generate_entry(entry) and status_code in (400, 401, 403, 404):
            current.update({'status': 'failed', 'stage': 'failed',
                            'error': f'查询任务状态失败（HTTP {status_code}）：{str(error)[:200]}'})
            return current
        current['stage'] = 'running'
        return current
    # ★ 统一媒体端点的查询接口**出错时**会回 `{code,msg}` 信封（成功时是顶层裸字段、没有 code）。
    #   不识别它 → 状态被判成 queued → 任务一直"排队中"到总超时。这里就地收敛并写明原因。
    if media_generate_entry(entry):
        status_error = media_status_payload_error(payload)
        if status_error:
            current.update({'status': 'failed', 'stage': 'failed',
                            'error': f'查询任务状态失败：{status_error}'})
            return current
    capture_job_metering(current, payload)
    progress = extract_provider_progress(payload)
    if progress is not None:
        current['progress'] = progress
    if prefer_media_files(extract_generation_urls(payload)):
        current['stage'] = 'downloading'
        image_data, image_error = finish_image_result(payload, time.monotonic() + 120)
        if image_error:
            current.update({'status': 'failed', 'stage': 'failed', 'error': image_error})
            return current
        current['imageData'] = image_data
        persist_job_image(current)
        # completedAt 供「历史中位耗时」统计用（typical_image_seconds）
        current.update({'status': 'completed', 'stage': 'completed', 'progress': 100, 'completedAt': now()})
        return current
    provider_status = normalize_provider_status(payload)
    if provider_status == 'failed':
        current.update({'status': 'failed', 'stage': 'failed',
                        'error': provider_error(response_value(payload, 'message', 'error') or '供应商生成失败')})
        return current
    # ★ 上游已报完成、却没给可用地址：别再干等到总超时，立刻判失败并写明原因
    #   （视频那边同款处理：「已完成，但供应商未返回视频地址」）。
    if provider_status == 'completed':
        current.update({'status': 'failed', 'stage': 'failed',
                        'error': '供应商已完成，但未返回可用的图片地址'})
        return current
    current['stage'] = 'running'
    if current.get('status') == 'queued':
        current['status'] = 'running'
    return current


# ---------------------------------------------------------------- 音频（TTS）生成任务
# TTS 绝大多数是**秒级同步接口**（一次请求直接返回音频，没有任务号可查），所以这里走
# 「后台线程 + 前端轮询」模式：进度不可知 → 前端按「已用时间」显示（与图片的同步分支一致）。
# ★ 若将来接入异步 TTS（提交拿任务号 + 查询接口），照 create_image_job 的 async 分支加一条即可。
AUDIO_JOB_PAYLOADS = {}
AUDIO_JOB_LOCK = threading.Lock()











AUDIO_SPEC_RESERVED_KEYS = {'model', 'input', 'voice', 'speed', 'response_format', 'mode', 'pitch', 'volume'}
AUDIO_SPEC_KEY_RE = re.compile(r'^[A-Za-z_][A-Za-z0-9_]{0,40}$')


def sanitize_audio_spec(raw, reserved=None):
    """把前端传来的音频规格收敛成「可安全发往上游的键值对」。

    `reserved` = 「不能被 spec 顶掉的协议字段」集合，**两套形态各不相同**：
      · TTS 形态（默认 `AUDIO_SPEC_RESERVED_KEYS`）：`call_tts` 把 spec 平铺进**顶层** payload，
        所以 model / input / voice / speed / response_format 必须挡住；
      · media/generate 形态（传 `MEDIA_AUDIO_RESERVED_KEYS`）：spec 进**嵌套的 params**，
        只挡 model / prompt —— `speed` / `pitch` 在那边是**模型参数**（speech 类就靠它们），
        沿用 TTS 的保留键会把它们静默剔掉。
    """
    if not isinstance(raw, dict):
        return {}
    reserved = AUDIO_SPEC_RESERVED_KEYS if reserved is None else reserved
    out = {}
    for key, value in raw.items():
        name = str(key or '').strip()
        if not name or name in reserved or not AUDIO_SPEC_KEY_RE.match(name):
            continue
        # 显式挡掉 dunder（`__proto__` / `__class__`…）：它们在 Python dict 里无害，
        # 但这类键从来不是合法的模型参数，收进来只会让上游困惑。
        if name.startswith('__'):
            continue
        if isinstance(value, bool):
            out[name] = value
        elif isinstance(value, (int, float)):
            out[name] = value
        elif isinstance(value, str):
            text = value.strip()
            if text:
                out[name] = text
    return out


def run_audio_job_in_background(job_id):
    """音频（TTS）任务：后台线程里跑完整合成，完成后把结果写回 job 快照。"""
    with AUDIO_JOB_LOCK:
        payload = AUDIO_JOB_PAYLOADS.pop(job_id, None)
    if not payload:
        return
    job = dict(payload.get('job') or {})
    STORAGE_ACTOR.set(job.get('userId') or job.get('ownerId') or '')
    entry = payload.get('entry') or {}
    try:
        audio_data, error = call_tts(
            entry, payload.get('text'),
            voice=payload.get('voice') or 'alloy',
            speed=payload.get('speed') or 1.0,
            pitch=payload.get('pitch') or 0,
            volume=1.0 if payload.get('volume') is None else payload.get('volume'),
            mode=payload.get('mode') or 'speech',
            spec=payload.get('spec'))
        if error or not audio_data:
            job.update({'status': 'failed', 'stage': 'failed', 'error': str(error or '配音失败')[:300]})
        else:
            job['stage'] = 'downloading'
            job['audioData'] = audio_data
            persist_job_audio(job)
            job.update({'status': 'completed', 'stage': 'completed', 'progress': 100, 'completedAt': now()})
    except Exception as exc:  # noqa: BLE001 —— 后台线程绝不能把异常抛出去
        job.update({'status': 'failed', 'stage': 'failed', 'error': str(exc)[:300]})
    try:
        append_job(job)
    except Exception:  # noqa: BLE001
        pass


def create_audio_job(user, incoming, workspace_id=''):
    """提交一个音频（TTS）生成任务。返回 (public_job, failure)。

    与 /api/ai/tts 的同步路径共用同一套模型校验，区别只在「立即等结果」还是「先返回 jobId 再轮询」。
    """
    text = str(incoming.get('text') or '').strip()
    if not text:
        return None, {'error': 'missing_text', 'message': '请先写下要朗读的文本', 'status': 400}
    model_id = str(incoming.get('modelId') or '').strip()
    entry = next((m for m in visible_ai_models(user['id'])
                  if m.get('id') == model_id and m.get('enabled') and model_has_usage(m, 'tts')), None) if model_id else None
    if not entry:
        return None, {'error': 'tts_model_not_found', 'message': '所选 TTS 模型不存在或未启用，请在管理后台「模型接入」中配置文字转语音模型', 'status': 400}
    job = {
        'id': f'job-{uuid.uuid4().hex[:10]}', 'kind': 'audio', 'userId': user['id'],
        'projectId': incoming.get('projectId'), 'outputId': str(incoming.get('outputId') or '')[:100],
        'modelId': model_id, 'provider': entry.get('provider') or entry.get('protocol') or 'tts',
        'prompt': text, 'audioMode': str(incoming.get('mode') or 'speech')[:20],
        'status': 'queued', 'stage': 'submitted', 'progress': None,
        'simulated': False, 'createdAt': now(), 'workspaceId': workspace_id,
    }
    job['charge'] = open_generation_charge(user, entry, prompt_text=text, calls=1, label=entry.get('name'))
    # ★★ 统一媒体端点（`POST /v1/media/generate`）是**天生异步**的：提交拿任务号，进度靠轮询。
    #    与图片那边（create_image_job）同款分流 —— 不进「后台线程 + 无任务号」的同步模式。
    #    判据：图片用「图片传输合同」，音频用「请求形态」，同一个 media_generate_entry()。
    if media_generate_entry(entry):
        submitted, submit_error = submit_audio_media_generate(
            entry, text, voice=str(incoming.get('voice') or ''),
            spec=media_audio_spec(incoming))
        provider_id = extract_provider_job_id(submitted) if submitted else ''
        if provider_id:
            job.update({'providerJobId': provider_id, 'providerProtocol': entry.get('protocol') or 'audio',
                        'imageStatusPath': str(entry.get('imageStatusPath') or '').strip() or MEDIA_STATUS_PATH,
                        'status': 'running', 'stage': 'running'})
            append_job(job)
            return job, None
        # ★ 提交阶段就失败（或拿不到任务号）时**绝不回落后台线程再生成一次** ——
        #   那等于同一首曲子提交两遍（真金白银扣两次）。就地收敛并把原因写成人话。
        message = (str(submit_error or '')[:200] if submitted is None
                   else f'已按异步模式提交，但未能取得任务号：{str(submit_error or "")[:160]}')
        job.update({'status': 'failed', 'stage': 'failed', 'error': message})
        append_job(job)
        return job, None
    with AUDIO_JOB_LOCK:
        AUDIO_JOB_PAYLOADS[job['id']] = {
            'job': dict(job), 'entry': entry, 'text': text,
            'voice': incoming.get('voice'), 'speed': incoming.get('speed'),
            'pitch': incoming.get('pitch'), 'volume': incoming.get('volume'),
            'mode': incoming.get('mode'),
            # ★ 音频规格（模型专有参数）必须显式带上 —— 白名单漏一个键 = 静默丢弃。
            'spec': sanitize_audio_spec(incoming.get('spec')),
        }
    job.update({'status': 'running', 'stage': 'running'})
    append_job(job)
    threading.Thread(target=run_audio_job_in_background, args=(job['id'],), daemon=True).start()
    return job, None


def refresh_audio_job(job):
    """刷新一个音频任务。

    - **有任务号**（统一媒体端点等异步供应商）→ 查上游：写回真实 progress / stage，
      拿到音频就落盘并完成；
    - 无任务号（老式同步 TTS）→ TTS 没有任务号可查，只做总等待超时兜底，
      完成与否由后台线程写回 job 快照。
    """
    current = dict(job)
    if current.get('status') in {'completed', 'failed'}:
        return current
    entry = next((item for item in read_ai_models() if item.get('id') == current.get('modelId')), None)
    entry = with_user_timeouts(entry, current.get('userId'))
    limit_minutes = provider_timeout_value(entry, 'imageTotalWait', 3) if entry else 3
    submitted = str(current.get('createdAt') or '')
    if limit_minutes and submitted:
        try:
            stamp = datetime.fromisoformat(submitted)
            if stamp.tzinfo is None: stamp = stamp.replace(tzinfo=timezone.utc)
            elapsed = (datetime.now(timezone.utc) - stamp).total_seconds()
        except (TypeError, ValueError):
            elapsed = 0
        if elapsed > limit_minutes * 60:
            current.update({'status': 'failed', 'stage': 'failed',
                            'error': f'等待超过 {limit_minutes} 分钟仍未完成，已停止跟踪'})
            return current
    # ---- 异步分支（有任务号）：与图片的 refresh_image_job 同一套判据 ----
    provider_id = str(current.get('providerJobId') or '').strip()
    if not provider_id:
        # 后台线程模式：进度不可知，保持 progress=None；线程完成后会写新的 job 快照。
        return current
    if not entry:
        current.update({'status': 'failed', 'stage': 'failed', 'error': '音频模型已被删除或停用'})
        return current
    base_url = str(entry.get('baseUrl') or '').rstrip('/')
    api_key = str(entry.get('apiKey') or '').strip()
    payload, error, status_code = query_image_task_once(
        entry, provider_id, base_url, api_key,
        status_path=str(current.get('imageStatusPath') or '').strip())
    if error:
        # 单次查询失败不判死（瞬时抖动），由上面的总等待兜底。
        # ★ 例外：统一媒体端点的查询接口**请求级**失败（4xx = 任务号无效 / 越权 / 端点不对）
        #   重试永远不会成功 —— 实测回 HTTP 400 + `{"error":{"message":"task_id 参数无效"}}`，
        #   而且 4xx 时响应体被压进 `error`、`payload` 留空 dict，只能按**状态码**判。
        if media_generate_entry(entry) and status_code in (400, 401, 403, 404):
            current.update({'status': 'failed', 'stage': 'failed',
                            'error': f'查询任务状态失败（HTTP {status_code}）：{str(error)[:200]}'})
            return current
        current['stage'] = 'running'
        return current
    # ★ 统一媒体端点的查询接口**出错时**回 `{code,msg}` 信封（成功时是顶层裸字段、没有 code）。
    #   不识别它 → 状态被判成 queued → 任务一直"排队中"到总超时。
    if media_generate_entry(entry):
        status_error = media_status_payload_error(payload)
        if status_error:
            current.update({'status': 'failed', 'stage': 'failed',
                            'error': f'查询任务状态失败：{status_error}'})
            return current
    capture_job_metering(current, payload)
    progress = extract_provider_progress(payload)
    if progress is not None:
        current['progress'] = progress
    if prefer_media_files(extract_generation_urls(payload)):
        current['stage'] = 'downloading'
        audio_data, audio_error = finish_audio_result(payload, time.monotonic() + 120)
        if audio_error:
            current.update({'status': 'failed', 'stage': 'failed', 'error': audio_error})
            return current
        current['audioData'] = audio_data
        persist_job_audio(current)
        current.update({'status': 'completed', 'stage': 'completed', 'progress': 100, 'completedAt': now()})
        return current
    provider_status = normalize_provider_status(payload)
    if provider_status == 'failed':
        current.update({'status': 'failed', 'stage': 'failed',
                        'error': provider_error(response_value(payload, 'message', 'error') or '供应商生成失败')})
        return current
    # ★ 上游已报完成、却没给可用地址：别再干等到总超时，立刻判失败并写明原因。
    if provider_status == 'completed':
        current.update({'status': 'failed', 'stage': 'failed',
                        'error': '供应商已完成，但未返回音频地址'})
        return current
    current['stage'] = 'running'
    return current


# ---------------------------------------------------------------------------
# 「粗档进度」降级（r841）
#
# 上游的 progress 有两种语义，长得一样但**不能一样用**：
#   ① 真百分比 —— 12% → 37% → 68%…（图片/视频的异步任务常见）
#   ② 阶段档位 —— 只有 0 / 10 / 100 三档（实测 api.lk888.ai 的 suno-v4.5 音乐生成）
# ② 是**真数据**，但画成百分比条会「冻在中间档一分钟再瞬间跳满」，比不给进度还难看。
# 而前端 `job.progress != null` 这个判据只看「有没有值」，分不出 ①② →
# 所以必须在这里拦掉，别让它流到前端（前端因此**零改动**，自动落到「不确定滑动 + 阶段文案」）。
#
# ★ 判据只能是「观察到的取值够不够多」—— 单看一个值永远分不出它是 10% 还是第 2 档。
# ★ 这个降级是**单向**的：档位攒够就永久升级成真进度条，不会反过来。
#   任务刚开始档位必然少，此时先按阶段显示；一旦凑够就切真进度，信息量只增不减，用户不会觉得异常。
# ---------------------------------------------------------------------------
PROGRESS_TRACE = {}
PROGRESS_TRACE_LOCK = threading.Lock()
COARSE_PROGRESS_MIN_LEVELS = 5
PROGRESS_TRACE_MAX = 800


def _coarse_progress_view(view):
    """把「档位太粗」或「服务端自己编的」进度降级成阶段。返回是否发生了降级。

    降级动作：`progress` 置 None + `typicalSeconds` 置 0。
    后者是为了**不让前端回落到「预估条」形态** —— 半透明斜纹的预估条同样是一个（猜出来的）
    百分比观感，而这里要的是「三步走 + 条子一直在滑」。
    """
    if not view:
        return False
    job_id = str(view.get('id') or '')
    status = str(view.get('status') or '')
    if job_id and status in {'completed', 'failed'}:
        # 任务已终结 → 不再需要观察，顺手清掉，避免内存表无限长。
        with PROGRESS_TRACE_LOCK:
            PROGRESS_TRACE.pop(job_id, None)
        return False
    # ① 服务端自己编的假进度（`_refresh_job_view` 的 simulated 分支）→ 一律不认。
    #    ★ 前端根本不读 `simulated` 字段（app.js 里零次出现），所以这层必须在这里拦，
    #      否则那条 9 秒假曲线会被前端当真进度画出来，且不报错、不告警。
    if view.get('simulated') is True:
        view['progress'] = None
        view['typicalSeconds'] = 0
        view['coarseProgress'] = True
        return True
    raw = view.get('progress')
    if raw is None or not job_id:
        return False
    try:
        value = int(round(float(raw)))
    except (TypeError, ValueError):
        return False
    with PROGRESS_TRACE_LOCK:
        if len(PROGRESS_TRACE) >= PROGRESS_TRACE_MAX:
            # 兜底：极端情况下（大量任务卡在未完成）丢最早的一半，别让它无限长。
            for key in list(PROGRESS_TRACE.keys())[:PROGRESS_TRACE_MAX // 2]:
                PROGRESS_TRACE.pop(key, None)
        trace = PROGRESS_TRACE.setdefault(job_id, [])
        if value not in trace:
            trace.append(value)
        levels = len(trace)
        if levels >= COARSE_PROGRESS_MIN_LEVELS:
            # 够细 → 永久放行（留一点余量后不再增长）。
            if len(trace) > COARSE_PROGRESS_MIN_LEVELS * 4:
                del trace[:COARSE_PROGRESS_MIN_LEVELS * 2]
            return False
    view['progress'] = None
    view['typicalSeconds'] = 0
    view['coarseProgress'] = True
    view['progressLevels'] = levels
    return True


def job_view(job, sync=True):
    """对外 job 视图。图片/音频任务额外带上「该模型历史中位耗时」（typicalSeconds），
    供前端在**没有真实进度**时用「已用时间 ÷ 中位耗时」画预估进度条；有真实进度时前端忽略它。

    ★ 出口处统一做一次「粗档进度降级」，见 `_coarse_progress_view` 的说明 ——
      所有对外出口（单任务查询 / 列表 / 统计 / 下载）都走这里，所以只需拦这一处。
    """
    view = _refresh_job_view(job, sync)
    coarse = _coarse_progress_view(view)
    kind = str(view.get('kind') or '') if view else ''
    if kind in {'image', 'audio'} and not coarse:
        view['typicalSeconds'] = typical_job_seconds(kind, view.get('modelId'))
    return view


def _refresh_job_view(job, sync=True):
    if not job:
        return None
    is_real = job.get('simulated') is False or job.get('providerJobId') or job.get('providerProtocol')
    if is_real:
        if not sync:
            return dict(job)
        # 三类任务共用这套 job 轮询，刷新逻辑各不相同：
        # image/audio 都有「没有任务号」的同步分支，video 走供应商状态查询。
        kind = str(job.get('kind') or '')
        if kind == 'image':
            current = refresh_image_job(job)
        elif kind == 'audio':
            current = refresh_audio_job(job)
        else:
            current = refresh_video_job(job)
        # Also reconcile unchanged poll responses with a concurrent terminal
        # snapshot. append_job skips identical snapshots and preserves terminal states.
        append_job(current)
        return current
    current = dict(job)
    try:
        age = (datetime.now(timezone.utc) - datetime.fromisoformat(job['createdAt'])).total_seconds()
    except (KeyError, TypeError, ValueError):
        age = RENDER_SECONDS
    if age >= RENDER_SECONDS:
        current['status'], current['progress'] = 'completed', 100
    elif age >= QUEUE_SECONDS:
        current['status'] = 'running'
        current['progress'] = max(5, min(95, int(5 + (age - QUEUE_SECONDS) / max(0.001, RENDER_SECONDS - QUEUE_SECONDS) * 90)))
    else:
        current['status'], current['progress'] = 'queued', 0
    current['simulated'] = True
    return current


# ---------------------------------------------------------------------------
# 富文本净化（r686）
#
# 文本节点的 `copyHtml` 是唯一一个「服务端数据会被塞进 innerHTML」的字段
# （`app.js` 的 `applyNodeContent` 里 `copyEl.innerHTML = options.copyHtml`）。
# 项目又可以被社区分享给别人打开，所以这里不做净化就等于开了一条**存储型 XSS**。
#
# 用 `HTMLParser` 走白名单重建，不用正则 —— 正则净化 HTML 是经典翻车点。
# 策略：
#   * 白名单外的标签 → **拆掉标签、保留文字**（unwrap），比整段删更符合用户预期。
#   * `script`/`style`/`iframe` 等危险容器 → **连内容一起丢**（它们的文字内容没有意义）。
#   * 属性只留 `style`，且只留白名单属性 + 值要过字符与关键字检查。
# ---------------------------------------------------------------------------
RICH_TEXT_TAGS = {
    'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'ins', 'mark',
    'span', 'font', 'div', 'p', 'br', 'ul', 'ol', 'li',
    'sub', 'sup', 'code', 'pre', 'blockquote',
}
RICH_TEXT_VOID_TAGS = {'br'}
# 这些容器连**内容**一起丢：它们的文字不是用户想看的正文。
RICH_TEXT_DROP_TAGS = {
    'script', 'style', 'iframe', 'object', 'embed', 'svg', 'math',
    'template', 'noscript', 'form', 'input', 'button', 'select', 'textarea',
    'link', 'meta', 'base', 'title', 'head',
}
# 只放行编辑器真的会产生的那几个属性（见 app.js 的格式栏实现）。
RICH_TEXT_STYLE_PROPS = {
    'font-size', 'font-weight', 'font-style', 'color',
    'text-decoration', 'text-align', 'background-color', 'line-height',
}
# 值只允许这些字符：px / rgb(...) / #hex / 关键字都能过，url(...) 之类过不了。
_RICH_TEXT_STYLE_VALUE_RE = re.compile(r"^[A-Za-z0-9#%.,()\s\-+/'\"]{1,120}$")
_RICH_TEXT_STYLE_BAD = ('url(', 'expression', 'javascript', '\\', '@import', 'behavior', 'binding')


def _rich_text_style_ok(value):
    if not _RICH_TEXT_STYLE_VALUE_RE.match(value):
        return False
    low = value.lower()
    return not any(bad in low for bad in _RICH_TEXT_STYLE_BAD)


def _rich_text_clean_style(value):
    """把 style 串按声明拆开，只留白名单属性 + 合法值。"""
    kept = []
    for chunk in str(value or '').split(';'):
        prop, sep, val = chunk.partition(':')
        if not sep:
            continue
        prop, val = prop.strip().lower(), val.strip()
        if prop not in RICH_TEXT_STYLE_PROPS or not _rich_text_style_ok(val):
            continue
        kept.append(f'{prop}: {val}')
    return '; '.join(kept)


class _RichTextSanitizer(HTMLParser):
    """白名单重建 HTML。`convert_charrefs=True` → 文字里的实体先还原，输出时再统一转义。"""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []
        self._drop_depth = 0     # >0 = 正处在危险容器里，内容整段丢
        self._open = []          # 还开着的标签栈，用来补闭合

    def _clean_attrs(self, attrs):
        for name, value in attrs:
            if name.lower() != 'style':
                continue
            cleaned = _rich_text_clean_style(value)
            if cleaned:
                return f' style="{html_escape(cleaned, quote=True)}"'
        return ''

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag in RICH_TEXT_DROP_TAGS:
            self._drop_depth += 1
            return
        if self._drop_depth:
            return
        if tag not in RICH_TEXT_TAGS:
            return                      # unwrap：丢标签，文字照留
        self.out.append(f'<{tag}{self._clean_attrs(attrs)}>')
        if tag not in RICH_TEXT_VOID_TAGS:
            self._open.append(tag)

    def handle_startendtag(self, tag, attrs):
        tag = tag.lower()
        if self._drop_depth or tag in RICH_TEXT_DROP_TAGS or tag not in RICH_TEXT_TAGS:
            return
        self.out.append(f'<{tag}{self._clean_attrs(attrs)}>')

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in RICH_TEXT_DROP_TAGS:
            self._drop_depth = max(0, self._drop_depth - 1)
            return
        if self._drop_depth or tag not in RICH_TEXT_TAGS or tag in RICH_TEXT_VOID_TAGS:
            return
        if tag not in self._open:
            return                      # 没开过 / 已经闭合过 → 忽略，不产生游离闭合标签
        while self._open:
            opened = self._open.pop()
            self.out.append(f'</{opened}>')
            if opened == tag:
                break

    def handle_data(self, data):
        if self._drop_depth:
            return
        self.out.append(html_escape(data, quote=False))

    def result(self):
        for tag in reversed(self._open):     # 收尾补齐未闭合的标签
            self.out.append(f'</{tag}>')
        self._open = []
        return ''.join(self.out)


def sanitize_rich_text(raw, limit=None):
    """把用户富文本净化成白名单 HTML。解析失败时**退化成纯文本**，绝不原样放行。"""
    text = str(raw or '')
    if not text.strip():
        return ''
    if limit is not None:
        text = text[:limit]
    parser = _RichTextSanitizer()
    try:
        parser.feed(text)
        parser.close()
        cleaned = parser.result()
    except Exception:
        cleaned = html_escape(re.sub(r'<[^>]*>', '', text), quote=False)
    return cleaned if limit is None else cleaned[:limit]


def clean_graph(incoming):
    incoming = incoming if isinstance(incoming, dict) else {}
    for field in ('nodes', 'edges', 'groups'):
        if field in incoming and not isinstance(incoming[field], list):
            raise ValueError(field + ' 必须为列表，项目未保存')
    nodes, seen_nodes = [], set()
    for item in incoming.get('nodes') or []:
        if not isinstance(item, dict):
            continue
        node_id = str(item.get('id') or '').strip()[:100]
        node_type = str(item.get('type') or 'prompt').strip()[:40]
        if node_type == 'storyboard' and 'cells' in item and not isinstance(item['cells'], list):
            raise ValueError('分镜格子必须为列表，项目未保存')
        if not node_id or node_id in seen_nodes:
            continue
        seen_nodes.add(node_id)
        try:
            left, top = float(item.get('left', 0)), float(item.get('top', 0))
        except (TypeError, ValueError):
            left, top = 0, 0
        node = {'id': node_id, 'type': node_type, 'left': round(max(-10000, min(10000, left)), 2), 'top': round(max(-10000, min(10000, top)), 2)}
        # 前端总是发送字符串（可能为空）：空值代表用户清空了文案，必须落盘，否则刷新后旧文字会回来。
        title, copy_text = str(item.get('title') or '').strip()[:120], str(item.get('copy') or '').strip()
        if item.get('title') is not None: node['title'] = title
        if item.get('copy') is not None: node['copy'] = copy_text
        # Text generation instructions and generated body are independent fields.
        if node_type == 'prompt' and item.get('textInstruction') is not None:
            node['textInstruction'] = str(item.get('textInstruction') or '')
        # 手动改过标题的输出卡：自动命名不再覆盖，需要跨会话记住这个标记。
        if item.get('titleCustom') is True: node['titleCustom'] = True
        track_id = str(item.get('trackId') or '').strip()[:100]
        if track_id: node['trackId'] = track_id
        audio_url = str(item.get('audioUrl') or '')
        if audio_url.startswith('data:audio/') or (audio_url.startswith('/media/') and resolve_media_file(audio_url[7:])):
            node['audioUrl'] = audio_url
        if item.get('audioName'):
            node['audioName'] = str(item['audioName'])[:200]
        for field in ('generationJobId', 'appliedGenerationJobId'):
            if item.get(field):
                node[field] = str(item[field])[:100]
        # The full base64 preview (previewData) stays client-side only; the server keeps just the
        # asset reference so projects.json does not balloon to tens of megabytes.
        generated = item.get('generated')
        if generated is True: node['generated'] = True
        preview_asset = str(item.get('previewAsset') or '').strip()[:100]
        if preview_asset: node['previewAsset'] = preview_asset
        preview_name = str(item.get('previewName') or '').strip()[:200]
        if preview_name: node['previewName'] = preview_name
        # 落盘直链（r685）。**必须存**：`clean_graph` 是字段白名单，漏了就等于静默丢弃。
        # 「Agent 生成的图」这条链路只有 previewMedia、没有 previewAsset，
        # 服务端不存它 → 刷新后这个节点没有任何图片来源 → 空白卡。
        preview_media = str(item.get('previewMedia') or '').strip()[:300]
        if preview_media: node['previewMedia'] = preview_media
        # 卡片层级（右键「置于顶层 / 置于底层」）：`applySavedNodeLayers` 载入时按它排序。
        # 同样漏了 → 刷新后叠放次序悄悄回到默认，用户只会觉得「怎么又乱了」。
        try:
            layer = int(float(item.get('layer')))
        except (TypeError, ValueError):
            layer = None
        if layer is not None: node['layer'] = max(0, min(100000, layer))
        # 资产评级（1–5 星）：资产管理面板按它筛选，也随项目走。
        try:
            rating = int(float(item.get('rating')))
        except (TypeError, ValueError):
            rating = 0
        if rating > 0: node['rating'] = max(1, min(5, rating))
        # 图片节点级属性（720 全景投影标记 / 21:9 比例覆盖 / 2K 清晰度 / 尺寸文案）。
        for field, limit in (('imageProjection', 20), ('aspectRatio', 12), ('resolution', 20), ('dimension', 30)):
            value = str(item.get(field) or '').strip()[:limit]
            if value: node[field] = value
        # ★★★ 卡片尺寸的两个数值句柄（必须与 app.js `nodeSnapshot()` 的字段名一致）：
        #   nodeScale  = 节点级整体缩放（角色参考卡片 0.6、三视图按行宽算）
        #   mediaRatio = 媒体真实比例（高/宽）
        #   漏了 = 刷新后卡片按 1 倍渲染，而 left/top 仍是按缩放后尺寸排的 →
        #   角色四件套互相压在一起（用户报的 bug）。夹在 0.05–8，防脏数据把卡片撑爆。
        for field in ('nodeScale', 'mediaRatio'):
            try:
                number = float(item.get(field))
            except (TypeError, ValueError):
                continue
            if number > 0:
                node[field] = round(max(0.05, min(8.0, number)), 4)
        # 输出节点的成片与任务状态：丢了它们，刷新后下载/重试就永久不可用。
        video_url = str(item.get('videoUrl') or '').strip()[:200_000]
        if video_url: node['videoUrl'] = video_url
        source_director = str(item.get('sourceDirectorId') or '').strip()[:100]
        if source_director: node['sourceDirectorId'] = source_director
        job_id = str(item.get('jobId') or '').strip()[:100]
        if job_id: node['jobId'] = job_id
        job_status = str(item.get('jobStatus') or '').strip()[:40]
        if job_status: node['jobStatus'] = job_status
        job_error = str(item.get('jobError') or '').strip()[:500]
        if job_error: node['jobError'] = job_error
        # 图片生成历史：只存资产 ID 列表（最近 8 条），画面本体仍在素材库。
        history = item.get('imageHistory')
        if isinstance(history, list) and history:
            node['imageHistory'] = [str(entry).strip()[:100] for entry in history[:8] if str(entry or '').strip()]


        preset_scene = str(item.get('presetScene') or '').strip()[:60]
        if preset_scene:
            node['presetScene'] = preset_scene
            # ★★ 预设节点的卡片文案 = **用户自己写的补充内容**，照常保存。
            #   这里只做一件事：把「历史残留的提示词正文」清掉 —— 如果 copy 恰好等于该预设的正文，
            #   说明是早期版本写进去的（那时正文会落进节点数据），清空它。
            #   ★ 正文本身**永不落进节点数据**：否则本机 localStorage 的项目快照里就有它，
            #     "普通用户/VIP 看不到提示词"这条承诺就破了。
            legacy_prompt = str(PRESET_PROMPT_DEFAULTS.get(preset_scene, {}).get('prompt') or '').strip()
            if node.get('copy') and legacy_prompt and node['copy'].strip() == legacy_prompt:
                node['copy'] = ''
        preset_entry = str(item.get('presetEntry') or '').strip()[:40]
        if preset_entry:
            node['presetEntry'] = preset_entry
        # 预设指定的节点标题（底部输入框的「预设胶囊」用它做标题）。同样必须进白名单，
        # 否则刷新后胶囊标题退化成预设默认名（如「人像质感调节」而不是用户要的「人像调节」）。
        preset_title = str(item.get('presetTitle') or '').strip()[:80]
        if preset_title:
            node['presetTitle'] = preset_title




        shots_raw = str(item.get('shots') or '')
        if shots_raw:
            node['shots'] = shots_raw
        script_assets = str(item.get('scriptAssets') or '')
        if script_assets:
            node['scriptAssets'] = script_assets
        script_theme = str(item.get('scriptTheme') or '').strip()[:120]
        if script_theme:
            node['scriptTheme'] = script_theme
        script_style = str(item.get('scriptStyle') or '').strip()[:120]
        if script_style:
            node['scriptStyle'] = script_style
        auto_link = str(item.get('autoLink') or '').strip()[:4]
        if auto_link: node['autoLink'] = auto_link
        # 逐帧动画的帧数。
        if node_type == 'animation':
            try:
                node['frames'] = max(2, min(12, int(item.get('frames', 4))))
            except (TypeError, ValueError):
                node['frames'] = 4
            node['layout'] = str(item.get('layout') or '1x').strip()[:8]
            try:
                node['speed'] = max(40, min(600, int(item.get('speed', 140))))
            except (TypeError, ValueError):
                node['speed'] = 140
            node['modelId'] = str(item.get('modelId') or '').strip()[:60]
        # 3D 导演台的场景数据（JSON 字符串）。director.js 只把它 JSON.parse 进 dataset，
        # 没有任何 innerHTML 落点，所以存下来是安全的 —— 不存就等于「刷新后舞台清空」。
        if node_type == 'director':
            # read_json already caps the complete request at 8 MB. Never truncate JSON:
            # many per-axis/path keys can exceed 200 KB and must survive a save/reload.
            director_project = str(item.get('directorProject') or '').strip()
            if director_project: node['directorProject'] = director_project
        # 文本节点富文本正文（r686）。**必须净化后才能存** ——
        # 它是唯一一个「服务端数据被塞进 innerHTML」的字段（app.js `applyNodeContent`），
        # 项目又能被社区分享给别人打开，不净化 = 存储型 XSS。
        # 纯文本正文继续走 `copy`，这里只在真的带标签时才有值（旧数据零迁移）。
        if node_type == 'prompt':
            rich_html = sanitize_rich_text(item.get('copyHtml'))
            if rich_html: node['copyHtml'] = rich_html
        # 分组成员标记：分组框渲染依赖它。
        node_group = str(item.get('groupId') or '').strip()[:60]
        if node_group: node['groupId'] = node_group
        # 分镜宫格：布局与逐格数据。格子里的 base64 预览图与节点预览同理，只保留资产引用。
        if node_type == 'sourcefile':
            for field in ('fileName', 'fileKind', 'fileSize', 'fileAsset'):
                value = str(item.get(field) or '').strip()
                if field == 'fileName': value = value[:150]
                elif field in ('fileKind',): value = value[:20]
                elif field == 'fileSize': value = value[:20]
                else: value = value[:100]
                if value: node[field] = value
        if node_type == 'charview':
            node['charName'] = str(item.get('charName') or '').strip()[:60]
            ref_asset = str(item.get('refAsset') or '').strip()[:100]
            if ref_asset: node['refAsset'] = ref_asset
            node['modelId'] = str(item.get('modelId') or '').strip()[:60]
        if node_type == 'storyboard':
            try:
                grid_cols, grid_rows = int(item.get('cols', 2)), int(item.get('rows', 2))
            except (TypeError, ValueError):
                grid_cols, grid_rows = 2, 2
            node['cols'], node['rows'] = min(3, max(2, grid_cols)), min(3, max(2, grid_rows))
            cells = []
            for cell in (item.get('cells') or [])[:node['cols'] * node['rows']]:
                if not isinstance(cell, dict):
                    continue
                entry = {'prompt': str(cell.get('prompt') or '').strip()}
                cell_asset = str(cell.get('previewAsset') or '').strip()[:100]
                if cell_asset: entry['previewAsset'] = cell_asset
                cell_name = str(cell.get('previewName') or '').strip()[:200]
                if cell_name: entry['previewName'] = cell_name
                cells.append(entry)
            node['cells'] = cells
        nodes.append(node)
    # 分组框：纯排版元数据，限制字段长度与坐标范围即可。
    groups = []
    for group in (incoming.get('groups') or []):
        if not isinstance(group, dict):
            continue
        entry = {'id': str(group.get('id') or '').strip()[:60], 'name': str(group.get('name') or '').strip()[:40], 'color': str(group.get('color') or '').strip()[:10], 'collapsed': bool(group.get('collapsed'))}
        if not entry['id']:
            continue
        # ★★★ 生成器组的身份字段（r802）：这里是**字段白名单**，漏一个就是静默丢弃 ——
        #   漏掉的后果是「刷新后生成器组退回普通组」：外观（浮在框上的标题）、
        #   以及「整组执行」要靠的 `scriptNodeId` / `memberShots` 全没了。
        for field, limit in (('kind', 20), ('generatorType', 20), ('scriptNodeId', 100)):
            value = str(group.get(field) or '').strip()[:limit]
            if value:
                entry[field] = value
        raw_members = group.get('memberShots')
        if isinstance(raw_members, list):
            member_shots = []
            for item in raw_members:
                if not isinstance(item, dict):
                    continue
                node_id = str(item.get('nodeId') or '').strip()[:100]
                shot_id = str(item.get('shotId') or '').strip()[:80]
                if node_id and shot_id:
                    member_shots.append({'nodeId': node_id, 'shotId': shot_id})
            if member_shots:
                entry['memberShots'] = member_shots
        for field in ('x', 'y', 'w', 'h'):
            try:
                entry[field] = round(float(group.get(field, 0)), 2)
            except (TypeError, ValueError):
                entry[field] = 0.0
        groups.append(entry)
    node_ids, edges, seen_edges = {item['id'] for item in nodes}, [], set()
    for item in incoming.get('edges') or []:
        if not isinstance(item, dict): continue
        source, target = str(item.get('source') or '').strip(), str(item.get('target') or '').strip()
        key = (source, target)
        if source not in node_ids or target not in node_ids or source == target or key in seen_edges: continue
        seen_edges.add(key); edges.append({'id': str(item.get('id') or f'edge-{uuid.uuid4().hex[:8]}')[:100], 'source': source, 'target': target})
    return nodes, edges, groups


def project_revision(item):
    """项目的保存版本号。老记录没有这个字段 = 0，行为与改造前一致。"""
    try:
        return max(0, int(item.get('revision') or 0))
    except (TypeError, ValueError):
        return 0


def clean_project(incoming, project_id=None):
    incoming = incoming if isinstance(incoming, dict) else {}
    project = {'id': project_id or str(incoming.get('id') or f'project-{uuid.uuid4().hex[:8]}')[:100]}
    project['projectName'] = str(incoming.get('projectName') or '未命名创作项目').strip()[:120] or '未命名创作项目'
    nodes, edges, groups = clean_graph(incoming)
    project['nodes'], project['edges'] = nodes, edges
    if 'groups' in incoming:
        project['groups'] = groups
    if 'nodes' in incoming:
        project['nodeCount'] = len(nodes)
    else:
        try:
            raw_count = int(float(incoming.get('nodeCount') or 0))
        except (TypeError, ValueError):
            raw_count = 0
        project['nodeCount'] = max(0, min(500, raw_count))
    for key, low, high, default in [('zoom', .1, 8, 1), ('panX', -10000, 10000, 0), ('panY', -10000, 10000, 0)]:
        try: value = float(incoming.get(key, default))
        except (TypeError, ValueError): value = default
        project[key] = round(max(low, min(high, value)), 3)
    generation = incoming.get('generationSettings')
    if isinstance(generation, dict):
        model_id = str(generation.get('modelId') or 'wan-2.1').strip()[:80]
        video_mode = str(generation.get('videoMode') or 'image-to-video').strip().lower()
        if video_mode not in {'text-to-video', 'image-to-video'}:
            video_mode = 'image-to-video'
        aspect = str(generation.get('aspectRatio') or '16:9').strip()[:12]
        duration = str(generation.get('duration') or '5 秒').strip()[:20]
        # ★★★ r830：`referenceMode` 必须进这个白名单 —— 它是**字段白名单**，漏一个就是静默丢弃。
        #   漏掉的后果：用户在底栏选了「首尾帧」，一刷新又变回「全能参考」（模式根本没存住）。
        #   存的是 key（10 个之一）；旧存档里的中文标签在读取侧由 normalize_reference_mode 兜底。
        reference_mode = normalize_reference_mode(generation.get('referenceMode'))
        project['generationSettings'] = {
            'modelId': model_id,
            'videoMode': video_mode,
            'aspectRatio': aspect,
            'duration': duration,
            'resolution': str(generation.get('resolution') or '720P')[:40],
            'cameraMove': str(generation.get('cameraMove') or '')[:120],
            'generateAudio': generation.get('generateAudio', True) is True,
            'generateCount': generation.get('generateCount') if generation.get('generateCount') in (1, 2, 4) else 1,
            **({'modelOptions': generation['modelOptions']} if isinstance(generation.get('modelOptions'), dict) else {}),
            **({'referenceMode': reference_mode} if reference_mode else {}),
        }
    image_generation = incoming.get('imageGenerationSettings')
    if isinstance(image_generation, dict):
        image_mode = str(image_generation.get('mode') or 'text-to-image').strip()
        if image_mode not in {'text-to-image', 'image-to-image'}: image_mode = 'text-to-image'
        image_resolution = str(image_generation.get('resolution') or '1024x1024').strip()[:20]

        image_aspect = str(image_generation.get('aspect') or '16:9').strip()[:12]
        if not re.fullmatch(r'\d{1,2}:\d{1,2}', image_aspect): image_aspect = '16:9'
        try:
            image_count = int(image_generation.get('count') or 1)
        except (TypeError, ValueError):
            image_count = 1
        if image_count not in (1, 2, 4): image_count = 1
        project['imageGenerationSettings'] = {'modelId': str(image_generation.get('modelId') or 'flux-1.1').strip()[:80], 'mode': image_mode, 'resolution': image_resolution, 'aspect': image_aspect, 'count': image_count}
        # Keep the exact controls that will be restored into the generation dock.
        project['imageGenerationSettings']['quality'] = str(image_generation.get('quality') or 'standard')[:40]
        camera = image_generation.get('cameraControl')
        if isinstance(camera, dict):
            project['imageGenerationSettings']['cameraControl'] = {
                'enabled': camera.get('enabled') is True,
                **{key: str(camera.get(key) or '')[:120] for key in ('camera', 'lens', 'focal', 'aperture')},
            }
        options = image_generation.get('modelOptions')
        if isinstance(options, dict):
            project['imageGenerationSettings']['modelOptions'] = options

    # Dock 里针对模型/输出节点写的提示词也随项目保存，刷新后可复现已提交过的生成。
    if incoming.get('modelPrompt') is not None:
        project['modelPrompt'] = str(incoming.get('modelPrompt') or '').strip()
    advanced = incoming.get('advancedSettings')
    if isinstance(advanced, dict):
        motion = str(advanced.get('motion') or 'medium').strip().lower()
        project['advancedSettings'] = {
            'seed': str(advanced.get('seed') or '').strip()[:20],
            'motion': motion if motion in {'low', 'medium', 'high'} else 'medium',
            'negativePrompt': str(advanced.get('negativePrompt') or '').strip(),
        }
    project['ownerId'] = str(incoming.get('ownerId') or 'user-canvasflow').strip()[:100]
    project['ownerName'] = str(incoming.get('ownerName') or '林默').strip()[:120] or '林默'
    project['ownerAvatar'] = str(incoming.get('ownerAvatar') or project['ownerName'][:1]).strip()[:4]
    project['shared'] = bool(incoming.get('shared'))
    project['description'] = str(incoming.get('description') or '').strip()[:1000]
    if incoming.get('thumbnail'):
        project['thumbnail'] = str(incoming['thumbnail'])[:1_500_000]
    # Running/simulated jobs are remembered per output node so a reload can resume tracking them.
    bindings = incoming.get('jobBindings')
    if isinstance(bindings, list):
        cleaned_bindings = []
        for item in bindings:
            if not isinstance(item, dict):
                continue
            job_id = str(item.get('jobId') or '').strip()[:100]
            output_id = str(item.get('outputId') or '').strip()[:100]
            if not job_id or not output_id:
                continue
            cleaned_bindings.append({'jobId': job_id, 'outputId': output_id})
            if len(cleaned_bindings) >= 20:
                break
        project['jobBindings'] = cleaned_bindings
    cover = str(incoming.get('cover') or '')
    if cover.startswith('data:image/') and len(cover) <= 1_500_000:
        project['cover'] = cover
    # Reference thumbnails attached in the bottom dock have to survive a reload.
    references = incoming.get('references')
    if isinstance(references, list):
        cleaned_refs = []
        for item in references:
            if not isinstance(item, dict):
                continue
            data = str(item.get('data') or '')
            local_path = resolve_media_file(data.removeprefix('/media/')) if data.startswith('/media/') else None
            local_image = local_path and mimetypes.guess_type(str(local_path))[0] in {'image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'}
            if not local_image and (not data.startswith('data:image/') or len(data) > 1_500_000):
                continue
            cleaned_refs.append({
                'id': str(item.get('id') or f'ref-{uuid.uuid4().hex[:8]}')[:60],
                'name': str(item.get('name') or '参考图').strip()[:120] or '参考图',
                'data': data,
                # ★ 归属节点：工具给自己那个节点加的参考（如「情绪调节」裁出的人脸）只在该节点
                #   被选中时显示。**不加进白名单就会被静默剥掉** → 刷新后它又变成项目级的，
                #   跟着用户切到别的节点（"参考图怎么还在"）。空串不写。
                **({'ownerNodeId': str(item.get('ownerNodeId'))[:60]}
                   if str(item.get('ownerNodeId') or '').strip() else {}),
            })
            if len(cleaned_refs) >= 6:
                break
        project['references'] = cleaned_refs
    project['updatedAt'], project['status'] = now(), str(incoming.get('status') or 'draft')[:30]
    return project


def extract_response_text(payload):
    """Responses API 的文本提取。保留旧名，内部改用更宽容的统一提取器。"""
    return extract_text_content(payload)


def describe_image_with_ai(image_data, instruction=''):
    api_key = str(os.environ.get('OPENAI_API_KEY') or '').strip()
    if not api_key:
        return None, 'OPENAI_API_KEY 未配置'
    if not isinstance(image_data, str) or not image_data.startswith('data:image/'):
        return None, '图片数据无效'
    if len(image_data) > 6_000_000:
        return None, '图片过大，请压缩到 4MB 左右后重试'
    base_url = str(os.environ.get('OPENAI_BASE_URL') or 'https://api.openai.com/v1').rstrip('/')
    model = str(os.environ.get('OPENAI_VISION_MODEL') or 'gpt-4.1-mini').strip()
    prompt = str(instruction or '').strip() or '请分析这张图片，并生成一段可直接用于 AI 视频生成的中文提示词。准确描述主体、人物外观与姿态、构图、景别、镜头视角、环境、光线、颜色、材质和氛围。不要臆测图片中不存在的内容，不要使用标题或列表，输出 120 到 220 字的单段文本。'
    payload = {
        'model': model,
        'input': [{
            'role': 'user',
            'content': [
                {'type': 'input_text', 'text': prompt},
                {'type': 'input_image', 'image_url': image_data, 'detail': 'auto'},
            ],
        }],
        'max_output_tokens': 500,
    }
    headers = {'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'}
    result, _, error = request_json_candidates(endpoint_candidates(base_url, 'responses'), payload, headers=headers, timeout=60)
    if error:
        return None, error
    text = extract_response_text(result)
    if not text:
        return None, 'AI 接口未返回描述文本'
    return text, None


def anthropic_content_part(part):
    """Anthropic 图片不接受 data URL，需要拆成 base64 + media_type 结构。"""
    if part.get('type') == 'image_url':
        url = (part.get('image_url') or {}).get('url') or ''
        if url.startswith('data:'):
            header, _, data = url.partition(',')
            media_type = header[5:].split(';')[0] or 'image/png'
            return {'type': 'image', 'source': {'type': 'base64', 'media_type': media_type, 'data': data}}
        return {'type': 'image', 'source': {'type': 'url', 'url': url}}
    return {'type': 'text', 'text': str(part.get('text') or '')}


def to_responses_content(content_parts):
    """把 chat/completions 的 content 数组转成 Responses API 的 input 数组。

    Responses 用的是 input_text / input_image，且 input_image 的地址是**字符串**
    （chat/completions 那边是 {image_url: {url}} 对象）。
    """
    converted = []
    for part in content_parts or []:
        if not isinstance(part, dict):
            continue
        if part.get('type') == 'image_url':
            image = part.get('image_url')
            url = image.get('url') if isinstance(image, dict) else image
            if url:
                converted.append({'type': 'input_image', 'image_url': url})
            continue
        text = str(part.get('text') or '')
        if text:
            converted.append({'type': 'input_text', 'text': text})
    return converted


def call_chat_completion(entry, content_parts, max_tokens=500, timeout=None, trace=None):
    """Generic caller: OpenAI-compatible chat/completions、OpenAI Responses 或 Anthropic Messages API。

    trace 传入 dict 时，会写入实际命中的上游端点（`endpoint`），便于「实测链路」排查配置。
    """
    timeout = timeout or provider_timeout_value(entry, 'textExec', 60)
    base_url = str(entry.get('baseUrl') or '').rstrip('/')
    api_key = str(entry.get('apiKey') or '').strip()
    model = str(entry.get('model') or '').strip()
    if not base_url or not provider_has_credentials(entry) or not model:
        return None, '模型配置不完整（接口地址 / API Key / 模型标识）'
    protocol = str(entry.get('protocol') or 'openai').lower()
    text_protocol = str(entry.get('textProtocol') or '').strip() or 'chat-completions'
    if protocol == 'anthropic':
        payload = {'model': model, 'max_tokens': max_tokens, 'messages': [{'role': 'user', 'content': [anthropic_content_part(part) for part in content_parts]}]}
        headers = auth_headers({**entry, 'authMode': 'none' if str(entry.get('authMode') or '').lower() == 'none' else 'x-api-key'}, api_key, {'anthropic-version': '2023-06-01', 'Content-Type': 'application/json'})
        candidates = [f'{base_url}/messages' if base_url.endswith('/v1') else f'{base_url}/v1/messages']
    elif text_protocol == 'responses':
        content = to_responses_content(content_parts)
        has_image = any(part.get('type') == 'input_image' for part in content)
        payload = {
            'model': model,
            # 纯文本时 input 可以直接是字符串；带图必须用 [{role, content:[...]}] 结构
            'input': [{'role': 'user', 'content': content}] if has_image else ''.join(part.get('text', '') for part in content),
            'max_output_tokens': max_tokens,
            'stream': False,
        }
        headers = auth_headers(entry, api_key, {'Content-Type': 'application/json'})
        candidates = endpoint_candidates(base_url, 'responses')
    else:
        payload = {'model': model, 'messages': [{'role': 'user', 'content': content_parts}], 'max_tokens': max_tokens}
        headers = auth_headers(entry, api_key, {'Content-Type': 'application/json'})
        candidates = endpoint_candidates(base_url, 'chat/completions')
    result, hit_url, error = request_json_candidates(candidates, payload, headers=headers, timeout=timeout)
    if trace is not None and hit_url:
        trace['endpoint'] = hit_url
    # ★ r884：把上游的 `usage` 原样回传给调用方 —— 这是「按 token 准确扣费」的唯一依据。
    #   以前它被直接丢掉，账本只能靠猜（本项目「token 扣费算不准」的根因就在这里）。
    if trace is not None and isinstance(result, dict) and result.get('usage') is not None:
        trace['usage'] = result['usage']
    if error:
        return None, error
    if protocol == 'anthropic':
        parts = result.get('content') if isinstance(result, dict) else None
        text = ''.join(part.get('text', '') for part in parts or [] if isinstance(part, dict) and part.get('type') == 'text')
    else:
        text = extract_text_content(result)
    if not isinstance(text, str) or not text.strip():
        return None, 'AI 接口未返回内容'
    return text.strip(), None


TEXT_GENERATION_SYSTEM_HINT = (
    '你是视频创作助手。请按用户要求直接输出可用于图生视频的中文画面描述或文案，'
    '只输出正文本身，不要解释、不要加标题、不要用 Markdown 代码块包裹。'
)


def text_generation_profile(purpose='text'):
    if purpose == 'scene_agent':
        return ('你是3D预演场景助手。严格遵循用户提供的数据工具协议，只输出完整合法JSON。'
                '使用当前场景和对话记录进行增量修改，不输出代码，不编造已执行的结果。', 12000, 180)
    return TEXT_GENERATION_SYSTEM_HINT, 3000, 90


def text_generation_input_text(prompt, purpose='text'):
    """文本节点「发送」**真正送进上游**的输入文本（系统提示 + 用户要求）。

    ★ 唯一真相：`generate_text_with_model()` 发的是它，`/api/ai/text-generate` 预扣
      也是按它估算输入 token。以前两处各写一遍拼装，结果「预扣按 17 token 算、
      实际发了 80 token」—— 预扣系统性低估输入侧（实测由端到端脚本 C1 抓到）。
    """
    hint, _, _ = text_generation_profile(purpose)
    return f'{hint}\n\n用户要求：{prompt}'


def generate_text_with_model(prompt, entry, trace=None, purpose='text'):
    """文本节点底部面板的「发送」：交给接入的语言大模型把用户输入生成成节点正文。

    `trace` 传入 dict 时会带回上游 `usage`（r884：按 token 准确扣费的依据）。
    """
    _, max_tokens, timeout = text_generation_profile(purpose)
    return call_chat_completion(
        entry,
        [{'type': 'text', 'text': text_generation_input_text(prompt, purpose)}],
        trace=trace,
        # ★ 这里必须**留足** max_tokens：本机启用的 `deepseek-v4-flash-0731` 是**推理模型**，
        #   思考 token 会把预算吃光 → 上游只回 reasoning、content 为空 →
        #   表现就是「AI 接口未返回内容」（实测踩过，脚本节点的「合成提示词」全军覆没）。
        max_tokens=max_tokens,
        timeout=timeout,
    )


def generate_text_with_ai(prompt, purpose='text'):
    """未指定模型时走服务端默认的 OpenAI 兼容语言模型。"""
    entry = default_text_model_entry()
    if not entry:
        return None, '未配置语言模型：请在管理后台「模型接入」添加并启用一个文本模型，或设置服务端 OPENAI_API_KEY'
    return generate_text_with_model(prompt, entry, purpose=purpose)


def default_text_model_entry():
    """服务端默认语言模型（环境变量方式）。没配 Key 就返回 None。"""
    api_key = str(os.environ.get('OPENAI_API_KEY') or '').strip()
    if not api_key:
        return None
    return {
        'baseUrl': os.environ.get('OPENAI_BASE_URL') or 'https://api.openai.com/v1',
        'apiKey': api_key,
        'model': os.environ.get('OPENAI_TEXT_MODEL') or 'gpt-4o-mini',
        'protocol': 'openai',
    }






PROMPT_PLACEHOLDER_RE = re.compile(
    r'(@[^\s@，。；：！？、,.!?;:]{1,40}'          # @节点引用：吃到空白或标点为止
    r'|\{\{[^{}\n]{1,80}\}\}'                     # {{...}} 占位符
    r'|<#[^#\n]{1,24}#>'                          # <#...#> 时间码
    r'|\[\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?\s*s?\])'  # [0.5s] / [1-3s] 区间标记
)

PROMPT_TRANSLATE_HINT = (
    '你是提示词翻译器，服务于 AI 绘画 / 视频生成的提示词。'
    '把用户给出的片段在中文和英文之间互译，保持原有的镜头术语、风格词、构图描述与标点结构。'
    '只输出译文本身：不要解释、不要加引号、不要补全或润色内容。'
)


def _translate_segment(segment, entry):
    """翻译单个片段，返回 (译文, error)。"""
    text, error = call_chat_completion(
        entry,
        [{'type': 'text', 'text': f'{PROMPT_TRANSLATE_HINT}\n\n{segment}'}],
        max_tokens=1200,
        timeout=60,
    )
    if error:
        return None, error
    cleaned = str(text or '').strip().strip('"“”\'')
    return (cleaned or None), None


def translate_prompt_text(text, model_id='', user_id=''):
    """把提示词在中英之间互译，结构标记原样保留。返回 (译文, error, direction)。

    **所有分支都必须返回三元组** —— 之前有两个分支漏了 direction，调用方按三个值解包，
    一次「整段都是标记」的请求就把服务端打成 RemoteDisconnected（连接直接断掉，不是 500）。
    """
    raw = str(text or '')

    direction = 'zh->en' if re.search(r'[\u4e00-\u9fff]', raw) else 'en->zh'
    if not raw.strip():
        return None, '请先填写提示词，再进行翻译', direction
    entry = None
    if model_id:
        entry = next((item for item in visible_ai_models(user_id) if item.get('id') == model_id and item.get('enabled')), None)
        if not entry:
            return None, '所选文本模型不存在或未启用，请在管理后台「模型接入」中配置', direction
    if not entry:
        entry = next((item for item in visible_ai_models(user_id)
                      if model_supports_vision(item) and item.get('enabled') and provider_has_credentials(item)), None)
    if not entry:
        entry = default_text_model_entry()
    if not entry:
        return None, '未配置语言模型：请在管理后台「模型接入」添加并启用一个文本模型', direction
    parts = PROMPT_PLACEHOLDER_RE.split(raw)   # 带捕获组 → 奇数下标就是被保护的标记
    jobs = [(index, part) for index, part in enumerate(parts) if index % 2 == 0 and part.strip()]
    if not jobs:
        return raw, None, direction             # 整段都是标记，没什么可翻的
    with ThreadPoolExecutor(max_workers=min(4, len(jobs))) as pool:
        results = list(pool.map(lambda job: _translate_segment(job[1], entry), jobs))
    for _, error in results:
        if error:
            return None, error, direction
    for (index, original), (translated, _) in zip(jobs, results):
        if not translated:
            continue
        # 保留片段原有的前后空白，拼回去不改变排版
        leading = original[:len(original) - len(original.lstrip())]
        trailing = original[len(original.rstrip()):]
        parts[index] = f'{leading}{translated}{trailing}'
    return ''.join(parts), None, direction


def probe_models_endpoint(entry, timeout=15):
    """零成本探测：GET /models 只验证地址可达与密钥有效，不消耗 token。
    端点按候选链尝试，兼容 BaseURL 带不带 /v1 的供应商。"""
    base_url = str(entry.get('baseUrl') or '').rstrip('/')
    api_key = str(entry.get('apiKey') or '').strip()
    protocol = str(entry.get('protocol') or 'openai').lower()
    if not base_url or not provider_has_credentials(entry):
        return False, '模型配置不完整（接口地址 / API Key）'
    if protocol == 'anthropic':
        candidates = [f'{base_url}/models' if base_url.endswith('/v1') else f'{base_url}/v1/models']
        headers = auth_headers({**entry,'authMode':'none' if str(entry.get('authMode') or '').lower()=='none' else 'x-api-key'}, api_key, {'anthropic-version':'2023-06-01'})
    else:
        candidates = endpoint_candidates(base_url, 'models')
        headers = auth_headers(entry, api_key)
    last_status, last_error = 0, ''
    shape_error = ''
    for url in candidates:
        status, result, error = http_json_request(url, headers=headers, timeout=timeout)
        if not error:
            ids = extract_model_ids(result)
            if not ids:
                shape_error = shape_error or f'服务响应格式异常（{response_snippet(result)}）'
                last_status, last_error = status, shape_error
                continue
            return True, f'密钥有效 · 服务可达（发现 {len(ids)} 个可用模型）'
        last_status, last_error = status, error
        if status in (401, 403):
            return False, 'API Key 无效或无权限'
        if status == 0:
            return False, '无法连接服务（地址错误或网络不通）'
    if shape_error:
        return False, shape_error
    if last_status == 404:
        return False, '该服务商未提供模型列表接口，免费探测不可用；可用「最小实测」验证'
    return False, last_error or '探测失败'





PROBE_CACHE = {}
PROBE_CACHE_TTL = 20.0


def probe_identity(entry):
    return '|'.join([
        str(entry.get('baseUrl') or '').rstrip('/'),
        str(entry.get('apiKey') or ''),
        str(entry.get('protocol') or 'openai').lower(),
        str(entry.get('authMode') or 'bearer'),
    ])


def probe_models_endpoint_cached(entry, timeout=15):
    """带短缓存的连通性探测。

    只缓存**成功**结果：失败常常是用户刚改完配置（改完就想重测），压 20 秒会很坑。
    """
    identity = probe_identity(entry)
    now = time.monotonic()
    hit = PROBE_CACHE.get(identity)
    if hit and hit[0] > now:
        return hit[1], hit[2]
    ok, message = probe_models_endpoint(entry, timeout=timeout)
    if ok:
        PROBE_CACHE[identity] = (now + PROBE_CACHE_TTL, ok, message)
    return ok, message



def call_tts(entry, text, voice='alloy', speed=1.0, pitch=0, volume=1.0, mode='speech', timeout=None, trace=None, spec=None):
    """OpenAI Audio Speech 协议（POST {baseUrl}/audio/speech），返回 mp3 的 data URI。"""
    timeout = timeout or provider_timeout_value(entry, 'textExec', 60)
    base_url = str(entry.get('baseUrl') or '').rstrip('/')
    api_key = str(entry.get('apiKey') or '').strip()
    model = str(entry.get('model') or '').strip()
    text = str(text or '').strip()
    if not base_url or not provider_has_credentials(entry) or not model:
        return None, '模型配置不完整（接口地址 / API Key / 模型标识）'
    if not text:
        return None, '请输入要转换的文字'
    try:
        safe_speed = max(0.25, min(4.0, float(speed) or 1.0))
    except (TypeError, ValueError):
        safe_speed = 1.0
    try:
        safe_pitch = max(-12, min(12, int(round(float(pitch)))))
    except (TypeError, ValueError):
        safe_pitch = 0
    try:
        safe_volume = max(0.0, min(2.0, float(volume)))
    except (TypeError, ValueError):
        safe_volume = 1.0
    safe_mode = str(mode or 'speech').strip() or 'speech'
    payload = {'model': model, 'input': text, 'voice': str(voice or 'alloy'), 'speed': safe_speed, 'response_format': 'mp3'}
    # 请求形态 = 兼容 Audio Generations 时改走 audio/generations（与标准 audio/speech 是两条接口）。
    profile = str(entry.get('requestProfile') or '').strip()
    speech_path = 'audio/generations' if profile == 'openai-audio-generation' else 'audio/speech'
    if profile == 'openai-audio-generation' and safe_mode == 'speech':
        safe_mode = 'generation'

    if safe_mode != 'speech':
        payload['mode'] = safe_mode
    if safe_pitch:
        payload['pitch'] = safe_pitch
    if safe_volume != 1.0:
        payload['volume'] = safe_volume
    # ★ 音频规格（模型专有参数）平铺进顶层 —— 与 mode / pitch / volume 同级。
    #   保留键已在 `sanitize_audio_spec()` 里剔除，不会顶掉 model / input / voice / speed / response_format。
    for spec_key, spec_value in (spec or {}).items():
        payload[spec_key] = spec_value
    audio_bytes, hit_url, error = request_bytes_candidates(
        endpoint_candidates(base_url, speech_path), payload,
        headers=auth_headers(entry, api_key, {'Content-Type': 'application/json'}), timeout=timeout, expected_audio=True)
    if trace is not None and hit_url:
        trace['endpoint'] = hit_url
    if error:
        return None, error
    if not audio_bytes:
        return None, 'AI 接口未返回音频数据'
    return f'data:audio/mpeg;base64,{base64.b64encode(audio_bytes).decode("ascii")}', None







IMAGE_TRANSPORTS = {
    'openai-images': {'generation': 'images/generations', 'reference': 'images/edits', 'body': 'multipart-files'},
    'json-image-edits': {'generation': 'images/generations', 'reference': 'images/edits', 'body': 'json-image-values'},
    'grok2api-images': {'generation': 'images/generations', 'reference': 'images/edits', 'body': 'json-image-objects'},
    'generation-reference-images': {'generation': 'images/generations', 'reference': 'images/generations', 'body': 'reference-images'},
    'generation-image-urls': {'generation': 'images/generations', 'reference': 'images/generations', 'body': 'image-url-values'},
    'generation-images-array': {'generation': 'images/generations', 'reference': 'images/generations', 'body': 'images-array'},
    'generation-input-image': {'generation': 'images/generations', 'reference': 'images/generations', 'body': 'input-image'},
    # ★★ 「统一媒体端点」：不是 images/* 那一族，提交/轮询语义完全不同（见下方 MEDIA_* 常量）。
    #    放进这张表只是为了让 `normalize_image_transport()` 认它、后台下拉能选它；
    #    `body` 字段用不到 —— 真正的分支在 `submit_image_generation()` 里**提前 return**。
    'media-generate': {'generation': 'media/generate', 'reference': 'media/generate', 'body': 'media-params'},
}

# ---------------------------------------------------------------- 统一媒体端点（对齐 lk888 等平台）
# 有些平台把生图/生视频/音频收敛到**同一个** `POST /v1/media/generate`：
#   · 模型专有参数**必须放进 `params` 对象**，顶层只放 model / prompt；
#   · 参数定义来自 `GET /v1/skills/models/{name}`（含 options / required），**不能自拟**；
#   · 返回 `{code, msg, data:{task_id}}` 信封，**HTTP 200 ≠ 成功**，要判 `code == 200`；
#   · 结果靠 `GET /v1/skills/task-status?task_id=` 轮询（顶层字段，无信封）。
# 为什么必须单开一条路：这类模型走 `images/generations` 会被**路由级拒绝** ——
#   实测 banana-2（lk888 上映射到 gemini-3.1-flash-image-preview）原话：
#   「模型 'gemini-3.1-flash-image-preview' 不支持 /v1/images/* 端点，请改用 POST /v1/media/generate」。
MEDIA_GENERATE_TRANSPORT = 'media-generate'
MEDIA_GENERATE_PATH = 'media/generate'
# 查询接口用 {task_id} 占位（与 imageStatusPath 同一套占位规则）。
MEDIA_STATUS_PATH = 'skills/task-status?task_id={task_id}'
MEDIA_MODEL_SCHEMA_PATH = 'skills/models'
# 模型参数定义缓存：{ (baseUrl, model): {paramName: 定义} }
MEDIA_SCHEMA_CACHE = {}
# 标准比例表（用于把 WxH 还原成 params.aspectRatio 要的比例串）
MEDIA_ASPECT_VALUES = ('1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5',
                       '2:1', '1:2', '21:9', '9:21', '1:4', '4:1', '1:8', '8:1')

# 旧字段名 → 合同 id（兼容历史配置）
IMAGE_TRANSPORT_LEGACY = {
    'openai-image': 'openai-images',
    'image-reference-images': 'generation-reference-images',
    'image-input-image': 'generation-input-image',
    'image-images-array': 'generation-images-array',
}


def normalize_image_transport(value):
    raw = str(value or '').strip()
    if raw in IMAGE_TRANSPORTS:
        return raw
    return IMAGE_TRANSPORT_LEGACY.get(raw)


def infer_image_transport(entry):
    """按供应商身份推断合同（对齐 FTV 的硬编码兜底规则）。"""
    identity = f"{entry.get('id') or ''} {entry.get('name') or ''} {entry.get('baseUrl') or ''}".lower()
    if 'api.bjhuiqu.net' in identity or 'huiquyun' in identity or '汇取云' in identity:
        return 'generation-image-urls'
    if re.match(r'^grok[-_\s]?imagine', str(entry.get('model') or '').strip().lower()):
        return 'grok2api-images'
    return 'openai-images'


def resolve_image_transport(entry):
    """供应商显式配置 → 模型级「图片传输覆盖」→ 兼容方言 → 按身份推断 → 默认 openai-images。"""
    explicit = normalize_image_transport(entry.get('imageTransport'))
    if explicit:
        return explicit
    params = entry.get('modelParams') if isinstance(entry.get('modelParams'), dict) else {}
    image_params = params.get('image') if isinstance(params.get('image'), dict) else {}
    per_model = normalize_image_transport(image_params.get('transport'))
    if per_model:
        return per_model
    if str(entry.get('providerProfile') or '').strip() == 'grok2api':
        return 'grok2api-images'
    return infer_image_transport(entry)




def reference_modes(entry):
    """这个供应商允许的参考文件传输方式；没配过就等价于「只支持 Base64」（老行为）。"""
    return normalize_enum_list(entry.get('referenceInputModes'), REFERENCE_MODE_ORDER) or ['data-url']


def extract_file_id(payload):
    """从上传响应里抠文件 id —— 各家字段名不统一，逐层兜底。"""
    if isinstance(payload, dict):
        for key in ('id', 'file_id', 'fileId', 'fileID'):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        for key in ('data', 'file', 'result', 'response'):
            found = extract_file_id(payload.get(key))
            if found:
                return found
    elif isinstance(payload, list):
        for item in payload:
            found = extract_file_id(item)
            if found:
                return found
    return ''


def upload_reference_file(entry, raw, mime, timeout=None):
    """把参考图上传到供应商的上传接口，返回 (file_id, error)。

    上传协议各家不同，这里按最常见形态发 multipart/form-data（字段名 file + purpose=vision），
    响应里按 id → file_id → data.id … 的顺序兜底取。401/403 立即中断（再试别的路径也没用）。
    """
    base = str(entry.get('baseUrl') or '').rstrip('/')
    api_key = str(entry.get('apiKey') or '').strip()
    path = str(entry.get('fileUploadPath') or '').strip() or DEFAULT_FILE_UPLOAD_PATH
    if not base or not provider_has_credentials(entry):
        return None, '上传参考文件需要先配置接口地址和 API Key'
    if not raw:
        return None, '参考文件内容为空，无法上传'
    boundary = f'----CanvasFlowUpload{uuid.uuid4().hex}'
    extension = (mimetypes.guess_extension(mime or 'image/png') or '.png').lstrip('.')
    body = b''.join([
        f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="reference.{extension}"\r\n'
        f'Content-Type: {mime or "application/octet-stream"}\r\n\r\n'.encode('utf-8'),
        raw, b'\r\n',
        f'--{boundary}\r\nContent-Disposition: form-data; name="purpose"\r\n\r\nvision\r\n'.encode('utf-8'),
        f'--{boundary}--\r\n'.encode('utf-8'),
    ])
    headers = auth_headers(entry, api_key, {'Content-Type': f'multipart/form-data; boundary={boundary}'})
    last = ''
    for url in endpoint_candidates(base, path):
        status, payload, error = http_body_request(url, body, headers=headers,
                                                   timeout=timeout or provider_timeout_value(entry, 'imageExec', 120))
        if error:
            last = error
            if status in (401, 403):
                break
            continue
        file_id = extract_file_id(payload)
        if file_id:
            return file_id, None
        last = '上传接口没有返回文件 id'
    return None, f'上传参考文件失败：{last or "未知原因"}'


def local_image_reference(value):
    """Expand an authorized local image server-side, keeping browser requests compact."""
    if not value.startswith('/media/'):
        return value
    name = urlparse(value).path.removeprefix('/media/')
    target = resolve_media_file(name)
    if not target:
        raise ValueError('参考图片文件不存在或路径无效')
    validate_new_media(STORAGE_ACTOR.get(), value)
    if not (mimetypes.guess_type(target.name)[0] or '').startswith('image/'):
        raise ValueError('参考素材必须是图片')
    if target.stat().st_size > 25 * 1024 * 1024:
        raise ValueError('单张参考图片超过 25MB 上限')
    data = media_data_uri(name)
    if not data:
        raise ValueError('参考图片读取失败')
    return data


def resolve_reference_values(entry, references, modes):
    """按供应商勾选的传输方式，把参考图变成真正要发出去的值。

    画布上的参考图永远是本机 data URI，所以三种方式的可用性是确定的：
      data-url     → 原样发（老行为）
      file-upload  → 先上传拿文件 id，再发 id
      public-url   → 只有参考图本来就是外链才用得上；本机图片没有公网地址，必须明确报错，
                     而不是把一个对方下载不到的地址发过去（那样只会得到一个含糊的 400）。
    """
    out = []
    for index, value in enumerate(references):
        value = local_image_reference(value)
        is_url = value.startswith('http://') or value.startswith('https://')
        if is_url:
            if 'public-url' in modes or 'data-url' in modes:
                out.append(value)
                continue
            return None, f'第 {index + 1} 张参考图是外链，但该供应商没有勾选「公网 URL」'
        if 'data-url' in modes:
            out.append(value)
            continue
        if 'file-upload' in modes:
            kinds = normalize_enum_list(entry.get('fileUploadMediaKinds'), REFERENCE_KIND_ORDER) or ['image']
            if 'image' not in kinds:
                return None, '该供应商的「上传文件类型」里没有勾选图片，无法上传参考图'
            raw, mime = decode_data_uri_image(value)
            if not raw:
                return None, f'第 {index + 1} 张参考图数据无效'
            file_id, error = upload_reference_file(entry, raw, mime)
            if error:
                return None, error
            out.append(file_id)
            continue
        return None, '该供应商只勾选了「公网 URL」参考文件，而画布上的参考图是本机图片、没有公网地址；请改选 Base64 或文件上传'
    return out, None


def cancel_provider_job(entry, job, kind='video'):
    """调用供应商的取消接口（配了才调）。返回 (ok, message)。

    没有配置取消接口时返回 (False, '该供应商未配置取消接口') —— 不假装成功。
    """
    field = 'imageCancelPath' if kind == 'image' else 'videoCancelPath'
    path = str(entry.get(field) or '').strip()
    if not path:
        return False, '该供应商未配置取消接口'
    provider_id = str(job.get('providerJobId') or '').strip()
    if not provider_id:
        return False, '任务还没有上游任务号，无法取消'
    base = provider_base_url(entry)
    target = path.replace('{task_id}', quote(provider_id, safe='')).replace('{id}', quote(provider_id, safe=''))
    urls = [target] if target.startswith('http') else endpoint_candidates(base, target)
    last = ''
    for url in urls:
        status, _, error = http_json_request(url, headers=auth_headers(entry), method='POST',
                                            timeout=provider_timeout_value(entry, 'statusPoll', 60))
        if error:
            last = error
            if status in (401, 403):
                break
            continue
        if status and status >= 400:
            last = f'供应商拒绝取消（HTTP {status}）'
            continue
        return True, '已通知供应商取消任务'
    return False, f'调用取消接口失败：{last or "未知原因"}'


def decode_data_uri_image(value):
    """把 data:image/...;base64,xxx 解成 (bytes, mime)。"""
    header, _, encoded = str(value or '').partition(',')
    if not header.startswith('data:') or not encoded:
        return None, ''
    mime = header[5:].split(';')[0] or 'image/png'
    try:
        raw = base64.b64decode(encoded, validate=False) if ';base64' in header else unquote(encoded).encode('utf-8')
    except Exception:
        return None, ''
    return (raw or None), mime


# 界面上的画质档（与前端 `IMAGE_QUALITY_OPTIONS` 的 id 逐字一致，改一处必须改另一处）。
IMAGE_QUALITY_TIERS = ['low', 'standard', 'high', 'xhigh', 'max']

# GPT Image 2.5 的官方画质档：low / medium / high / xhigh / max（xhigh、max 是 2.5 新增的）。
# 界面 5 档与之一一对应（「标准画质」= medium）。
GPT_IMAGE_25_QUALITY = {'auto': 'auto', 'medium': 'medium', 'low': 'low', 'standard': 'medium', 'high': 'high', 'xhigh': 'xhigh', 'max': 'max'}
# 旧版 gpt-image（2 及以前）只认 3 档 —— xhigh / max 是 2.5 才有的，发过去会被拒。
GPT_IMAGE_QUALITY = {'low': 'low', 'standard': 'medium', 'high': 'high'}


def image_quality_family(model, name=''):
    """识别模型属于哪个「画质族」；返回 `None` = **我们不认识这个族**。

    ★★★ 为什么必须同时看 `model`（上游 id）和 `name`（后台显示名）（2026-09-24 修）：
      这些模型在后台的**显示名**是 `gpt-image-2.5-sunburst`，但真正发往上游的 `model`
      字段是供应商自己的 id `tt-image-2.5-sunburst`（`/v1/models` 里 `owned_by = lingkeai`）。
      原来的正则只认 `^gpt-image`、且只看 `model`，于是 **2.5 系列一个都认不出来** →
      `supported_image_qualities()` 返回 `[]` → 界面 5 档**全部显灰、一个都选不了**。
    ★ 前缀写成显式枚举（gpt / gptt / tt）而不是「含 image-2.5 就算」——
      `agnes-image-2.5-flash` 里也含 `image-2.5`，但它是另一家的模型，不能误判成 2.5。
    """
    for raw in (model, name):
        text = str(raw or '').strip().lower()
        if not text:
            continue
        if re.match(r'^(?:gpt|gptt|tt)[-_\s]?image[-_\s]?2[.\-_]?5', text):
            return 'gpt-image-2.5'
        # ★ 供应商侧的老版本同样是 `tt-` 前缀（`tt-image-2`），不能只认 `^gpt-image`：
        #   漏掉的话它会落进「不认识」→ 不显灰 → 用户能选「超高 / 极致」，
        #   而 `image_quality_value()` 返回 '' → **静默不发**（正是本轮要消灭的那类坑）。
        if re.match(r'^(?:gpt|gptt|tt)[-_\s]?image', text):
            return 'gpt-image'
        if re.match(r'^dall[-_]?e', text):
            return 'dall-e'
    return None


def image_quality_value(model, quality, name=''):
    """把界面的画质档映射成模型真正认识的取值；返回 '' 表示这个字段不发。

    不同模型族取值不同，乱发会 400：
      GPT Image 2.5（显示名 `gpt-image-2.5*` / 上游 `tt-image-2.5*`）→ low / medium / high / xhigh / max
      gpt-image（2 及以前）                                        → low / medium / high
      DALL·E 系列                                                  → standard / hd
      不认识的族                                                   → 一律不发（保守，避免未知字段报错）
    """
    value = str(quality or '').strip().lower()
    if not value:
        return ''
    family = image_quality_family(model, name)
    if family == 'gpt-image-2.5':
        return GPT_IMAGE_25_QUALITY.get(value, '')
    if family == 'gpt-image':
        return GPT_IMAGE_QUALITY.get(value, '')
    if family == 'dall-e':
        return {'standard': 'standard', 'high': 'hd'}.get(value, '')
    return ''


def supported_image_qualities(model, name=''):
    """该模型**真正支持**的界面画质档 id 列表（与 `image_quality_value` 同源）。

    ★★★ 为什么要有这个函数（2026-09-24）：`image_quality_value` 对不认识的取值返回 `''`，
      也就是「这个字段干脆不发」。结果是前端 5 档里
        · `gpt-image*` 只有 低/标准/高 生效，「超高画质 / 极致画质」**静默无效**；
        · 其余模型族（如 `agnes-image-2.5-flash`）**5 档全都不发**。
      用户选了没反应，却没有任何反馈 —— 与「选了 16:9 却发 1024x1024」是同一类坑。
    ★ 判据**只有这一处**：让前端拿这个列表去把不支持的档位显灰，
      这样「UI 显示的可用档」与「实际发出去的字段」永远同源，不会两处各写一套正则。

    ★★★ 返回 `None` = **不认识这个模型族**，不等于「一个档都不支持」。
      调用方要把它当**未知**处理（下发时干脆不带这个键）→ 前端就不显灰。
      把一个自己没映射过的族当成「全不支持」，会让画质区**整块变成点不动的死控件**
      （2.5 系列正是这样被误伤的）；只在我们**确实知道**映射关系时才显灰。
    """
    family = image_quality_family(model, name)
    if family is None:
        return None
    return [tier for tier in IMAGE_QUALITY_TIERS if image_quality_value(model, tier, name)]


def image_extra_params(entry):
    # Only forward parameters declared by this provider, without replacing core inputs.
    reserved = {'model', 'prompt', 'size', 'quality', 'n', 'count', 'image', 'images',
                'reference_images', 'image_urls', 'input_image', 'aspect_ratio', 'aspectRatio', 'resolution'}
    allowed = {p['name'] for p in image_parameter_contract(entry).get('params', [])
               if p.get('name') and p.get('type') not in ('upload', 'textarea') and p['name'] not in reserved}
    return {k: v for k, v in media_param_overrides(entry).items() if k in allowed}


def build_image_reference_body(body_kind, model, prompt, size, reference_images, quality='', extra_params=None):
    """按合同形态构造带参考图的请求体。

    返回 (payload, body_bytes, content_type, error)：
    multipart 走 body_bytes + content_type，JSON 各合同走 payload，两者只会有一个非空。
    """
    if body_kind == 'multipart-files':
        boundary = f'----CanvasFlow{uuid.uuid4().hex}'
        parts = []
        fields = [('model', model), ('prompt', prompt), ('size', size)]
        if quality:
            fields.append(('quality', quality))
        fields.extend((key, value if isinstance(value, str) else json.dumps(value, ensure_ascii=False))
                      for key, value in (extra_params or {}).items())
        for field_name, field_value in fields:
            parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{field_name}"\r\n\r\n{field_value}\r\n'.encode('utf-8'))
        for index, reference in enumerate(reference_images):
            field = 'image' if len(reference_images) == 1 else 'image[]'
            raw, mime = decode_data_uri_image(reference)
            if not raw:
                value = str(reference or '').strip()
                # 不是 data URI 的（文件 id / 外链）才是普通文本字段，不能再当文件 part 发。
                # 但**以 data: 开头却解不出来的**是坏数据，必须报错 —— 否则「空参考图」会被
                # 静默当成一个文件 id 发出去，用户只会看到上游一句莫名其妙的 400。
                if value and not value.startswith('data:'):
                    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{field}"\r\n\r\n{value}\r\n'.encode('utf-8'))
                    continue
                return None, None, None, f'第 {index + 1} 张参考图数据无效'
            parts.append(
                f'--{boundary}\r\nContent-Disposition: form-data; name="{field}"\r\n'
                f'Content-Type: {mime}\r\n\r\n'.encode('utf-8') + raw + b'\r\n')
        parts.append(f'--{boundary}--\r\n'.encode('utf-8'))
        return None, b''.join(parts), f'multipart/form-data; boundary={boundary}', None

    payload = {'model': model, 'prompt': prompt, 'size': size, 'n': 1}
    if quality:
        payload['quality'] = quality
    payload.update(extra_params or {})
    single = len(reference_images) == 1
    if body_kind == 'json-image-values':
        payload['image' if single else 'images'] = reference_images[0] if single else list(reference_images)
    elif body_kind == 'json-image-objects':
        objects = [{'url': url} for url in reference_images]
        payload['image' if single else 'images'] = objects[0] if single else objects
    elif body_kind == 'reference-images':
        payload['reference_images'] = list(reference_images)
    elif body_kind == 'image-url-values':
        payload['image_urls'] = list(reference_images)
    elif body_kind == 'images-array':
        payload['images'] = list(reference_images)
    elif body_kind == 'input-image':
        if not single:
            return None, None, None, f'当前图片传输合同（input-image）只支持 1 张参考图，实际 {len(reference_images)} 张；请减少参考图或改用其他合同'
        payload['input_image'] = reference_images[0]
    else:
        return None, None, None, f'未知的图片传输合同形态：{body_kind}'
    return payload, None, None, None


def finish_image_result(result, deadline):
    """把上游响应收敛成 data URI：先抠结果地址，再（必要时）下载。

    下载也计入「图片总等待」预算，避免结果地址很慢时整次生成被无限拖长。
    """
    urls = prefer_media_files(extract_generation_urls(result))
    if not urls:
        return None, 'AI 接口未返回图片数据'
    target = urls[0]
    if target.startswith('data:image/'):
        return target, None
    if not target.startswith('http'):
        return None, 'AI 接口未返回可用的图片'
    remaining = deadline - time.monotonic()
    if remaining <= 1:
        return None, '图片生成超过总等待上限，已中止下载'
    try:
        with open_http_url(urllib_request.Request(target), timeout=max(5, min(60, int(remaining)))) as image_response:
            image_bytes = image_response.read(MEDIA_MAX_BYTES+1)
            if len(image_bytes)>MEDIA_MAX_BYTES:return None,'生成图片超过文件大小上限'
    except (urllib_error.URLError, TimeoutError) as exc:
        return None, f'下载生成图片失败：{exc}'
    # ★ 不能写死 `image/png`：上游返回 JPEG 是常态（实测 lk888 的 banana-2 就是 JPEG）。
    #   写死会让 data URI 的 MIME 与内容不符 → 落盘扩展名错、再上传给别的接口被拒。
    mime = sniff_media_mime(image_bytes) or 'image/png'
    return f'data:{mime};base64,{base64.b64encode(image_bytes).decode("ascii")}', None


def query_image_task_once(entry, provider_id, base_url, api_key, trace=None, status_path=''):
    """查一次异步图片任务。返回 (payload, error, http_status)。

    ★ 从 poll_image_task 里拆出来的单次查询 —— 前端轮询式架构下，
    「查一次、把 progress 写回 job」是主路径，不能再由服务端一个循环等到超时。
    查询接口用 {task_id} 占位上游任务号；`status_path` 参数优先（自动探测到的路径存在 job 里）。
    """
    provider_id = str(provider_id or '').strip()
    if not provider_id:
        return None, '供应商没有返回任务号', 0
    status_path = str(status_path or entry.get('imageStatusPath') or '').strip()
    # ★ 统一媒体端点的查询接口是**平台固定**的（skills/task-status），不需要用户手填；
    #   没配就用默认值，否则会在这里直接判「异步模式需要填写查询接口」。
    if not status_path and media_generate_entry(entry):
        status_path = MEDIA_STATUS_PATH
    if not status_path:
        return None, '异步模式需要填写「查询接口」（用 {task_id} 占位上游任务号）', 0
    target = status_path.replace('{task_id}', quote(provider_id, safe='')).replace('{id}', quote(provider_id, safe=''))
    urls = [target] if target.startswith('http') else endpoint_candidates(base_url, target)
    # ★ 走候选链（跳过路由级 404）：供应商 BaseURL 带不带 /v1 不一，只试首个候选会白跑。
    status, polled, error, hit_url = request_json_first_hit(urls, auth_headers(entry, api_key),
                                                           provider_timeout_value(entry, 'statusPoll', 60))
    if error:
        return None, error, status
    if trace is not None:
        trace['endpoint'] = hit_url
    return polled, None, status


def poll_image_task(entry, submitted, base_url, api_key, deadline, trace=None):
    """异步图片任务：拿任务号轮询「查询接口」，直到拿到图片地址 / 判定失败 / 超时。

    查询接口用 {task_id} 占位上游任务号；401/403 立即中断（换路径也没用）。
    """
    provider_id = extract_provider_job_id(submitted)
    status_path = str(entry.get('imageStatusPath') or '').strip()
    if not status_path and media_generate_entry(entry):
        status_path = MEDIA_STATUS_PATH
    if not provider_id:
        return None, '已按异步模式提交，但供应商没有返回任务号'
    if not status_path:
        return None, '异步模式需要填写「查询接口」（用 {task_id} 占位上游任务号）'
    interval = max(1, min(10, int(provider_timeout_value(entry, 'statusPoll', 60) // 10) or 3))
    last = ''
    while time.monotonic() < deadline:
        time.sleep(interval)
        polled, error, http_status = query_image_task_once(entry, provider_id, base_url, api_key, trace=trace)
        if error:
            last = error
            if http_status in (401, 403):
                return None, error
            continue
        if prefer_media_files(extract_generation_urls(polled)):
            return polled, None
        if normalize_provider_status(polled) == 'failed':
            return None, provider_error(response_value(polled, 'message', 'error') or '供应商任务失败')
        last = '任务仍在进行'
    return None, f'异步图片任务超时（{last or "任务仍在进行"}）'


def call_image_generation_chat(entry, prompt, size='1024x1024', reference_images=None, timeout=None, trace=None):
    """请求形态 = chat-image：走 /chat/completions 让模型直接产出图片。

    请求体按 OpenRouter / Gemini 那一套发（messages.content + modalities），
    响应从 choices[0].message.images[].image_url.url 取图 —— 与图片传输合同无关。
    """
    timeout = timeout or provider_timeout_value(entry, 'imageExec', 120)
    deadline = time.monotonic() + provider_timeout_value(entry, 'imageTotalWait', 3) * 60
    base_url = str(entry.get('baseUrl') or '').rstrip('/')
    api_key = str(entry.get('apiKey') or '').strip()
    model = str(entry.get('model') or '').strip()
    if not base_url or not provider_has_credentials(entry) or not model:
        return None, '模型配置不完整（接口地址 / API Key / 模型标识）'
    content = [{'type': 'text', 'text': str(prompt or '')}]
    for reference in (reference_images or []):
        if isinstance(reference, str) and reference.strip():
            content.append({'type': 'image_url', 'image_url': {'url': reference.strip()}})
    payload = {'model': model, 'messages': [{'role': 'user', 'content': content}], 'modalities': ['image', 'text']}
    if size:
        payload['size'] = size
    if trace is not None:
        trace['transport'] = 'chat-image'
        trace['endpointPath'] = 'chat/completions'
    result, hit_url, error = request_json_candidates(
        endpoint_candidates(base_url, 'chat/completions'), payload,
        headers=auth_headers(entry, api_key), timeout=timeout)
    if trace is not None and hit_url:
        trace['endpoint'] = hit_url
    if error:
        return None, error
    return finish_image_result(result, deadline)


def call_image_generation(entry, prompt, size='1024x1024', reference_image=None, reference_images=None, quality=None, timeout=None, trace=None):
    """OpenAI Images 协议，按「图片传输合同」决定参考图怎么发。

    文生图走合同的 generation 端点；带参考图走 reference 端点（部分合同两者相同）。
    端点按候选链尝试（兼容 BaseURL 带不带 /v1 的供应商），响应按 FTV 的容错规则深度解析。
    返回统一为 data URI；供应商返回临时 URL 时在服务端立即下载，避免一小时后失效。
    trace 传入 dict 时写入实际命中的端点与用到的合同。

    三条能力位在这里生效（都默认关闭 = 老行为）：
      requestProfile=chat-image → 整条走 /chat/completions，不看图片传输合同
      referenceInputModes        → 决定参考图发 data URI / 文件 id / 外链
      imageMode=async            → 提交后轮询「查询接口」再取图
    """
    timeout = timeout or provider_timeout_value(entry, 'imageExec', 120)
    # 图片总等待：覆盖「请求 + 结果下载」的整体预算，避免慢供应商把一次生成拖成好几分钟。
    deadline = time.monotonic() + provider_timeout_value(entry, 'imageTotalWait', 3) * 60
    base_url = str(entry.get('baseUrl') or '').rstrip('/')
    api_key = str(entry.get('apiKey') or '').strip()
    model = str(entry.get('model') or '').strip()
    if not base_url or not provider_has_credentials(entry) or not model:
        return None, '模型配置不完整（接口地址 / API Key / 模型标识）'
    text_prompt = str(prompt or '')
    # 画质只在该模型族认识时才发（GPT Image 2.5 → 5 档，gpt-image → 3 档，DALL·E → standard/hd，其余不发）
    # ★ 必须把**显示名**一起传进去：上游 id 可能是 `tt-image-2.5-sunburst` 这种供应商私有前缀。
    quality_value = image_quality_value(model, quality, entry.get('name'))
    references = [item.strip() for item in (reference_images or []) if isinstance(item, str) and item.strip()]
    if not references and isinstance(reference_image, str) and reference_image.strip():
        references = [reference_image.strip()]
    if media_generate_entry(entry):
        submitted, error = submit_media_generate(entry, text_prompt, size=size, reference_images=references,
                                                 quality=quality, timeout=timeout, trace=trace)
        if error:
            return None, error
        result, error = poll_image_task(entry, submitted, base_url, api_key, deadline, trace=trace)
        if error:
            return None, error
        if trace is not None and isinstance(result, dict) and result.get('usage') is not None:
            trace['usage'] = result['usage']
        return finish_image_result(result, deadline)
    # 参考文件按供应商勾选的传输方式落成实际值（data URI / 文件 id / 外链）
    if references:
        references, reference_error = resolve_reference_values(entry, references, reference_modes(entry))
        if reference_error:
            return None, reference_error

    if str(entry.get('requestProfile') or '').strip() == 'chat-image':
        return call_image_generation_chat(entry, text_prompt, size, references, timeout=timeout, trace=trace)

    contract = IMAGE_TRANSPORTS[resolve_image_transport(entry)]
    if references:
        endpoint_path = str(entry.get('imageEditPath') or '').strip() or contract['reference']
        payload, body, content_type, build_error = build_image_reference_body(
            contract['body'], model, text_prompt, size, references, quality_value, image_extra_params(entry))
        if build_error:
            return None, build_error
        headers = auth_headers(entry, api_key, {'Content-Type': content_type} if content_type else None)
        if body is not None:
            result, hit_url, error = request_body_candidates(
                endpoint_candidates(base_url, endpoint_path), lambda _url: body, headers=headers, timeout=timeout)
        else:
            result, hit_url, error = request_json_candidates(
                endpoint_candidates(base_url, endpoint_path), payload, headers=headers, timeout=timeout)
    else:
        endpoint_path = str(entry.get('imageSubmitPath') or '').strip() or contract['generation']
        payload = {'model': model, 'prompt': text_prompt, 'n': 1, 'size': size}
        if quality_value:
            payload['quality'] = quality_value
        payload.update(image_extra_params(entry))
        headers = auth_headers(entry, api_key)
        result, hit_url, error = request_json_candidates(
            endpoint_candidates(base_url, endpoint_path), payload, headers=headers, timeout=timeout)
    if trace is not None:
        trace['transport'] = resolve_image_transport(entry)
        trace['endpointPath'] = endpoint_path
        if hit_url:
            trace['endpoint'] = hit_url
    if error:
        return None, error
    if str(entry.get('imageTaskMode') or '').strip() == 'async':
        if trace is not None:
            trace['imageTaskMode'] = 'async'
        polled, poll_error = poll_image_task(entry, result, base_url, api_key, deadline, trace=trace)
        if poll_error:
            return None, poll_error
        result = polled
    # ★ r884：图片模型（尤其 `*-token` 后缀那些）也会回 `usage` —— 一起回传给调用方用于结算。
    if trace is not None and isinstance(result, dict) and result.get('usage') is not None:
        trace['usage'] = result['usage']
    return finish_image_result(result, deadline)


# ---------------------------------------------------------------- 统一媒体端点：参数组装与提交

def media_generate_entry(entry):
    """这个模型是否要走「统一媒体端点」（POST /v1/media/generate）。

    ★★ 两个入口都认（2026-09-25 扩展）：
      · `imageTransport == media-generate` —— **图片**模型在后台「图片传输合同」里选它；
      · `requestProfile == media-generate` —— **音频**模型没有「图片传输合同」这个字段
        （它只对 t2i 有意义），所以走「请求形态」这条路。
    同一份提交/轮询实现，两个开关 —— 这样音频不用假装自己是一张图片。
    """
    entry = entry or {}
    if normalize_image_transport(entry.get('imageTransport')) == MEDIA_GENERATE_TRANSPORT:
        return True
    return str(entry.get('requestProfile') or '').strip() == MEDIA_GENERATE_TRANSPORT


def resolution_tier(resolution):
    """`1024x576` → `1K` / `2K` / `4K`（长边判定，与前端 `imageResTier()` 同一套阈值）。"""
    try:
        width, height = [int(part) for part in str(resolution or '').split('x')]
    except (TypeError, ValueError):
        return ''
    if width <= 0 or height <= 0:
        return ''
    long_side = max(width, height)
    if long_side <= 512:return '0.5K'
    if long_side > 2900:
        return '4K'
    return '2K' if long_side > 1024 else '1K'


def aspect_from_size(size, options=None, tolerance=0.02):
    """`1024x576` → `16:9`。params.aspectRatio 只收比例串，不收像素尺寸。

    ★★ 关键：候选比例必须优先用**模型自己声明的** `options`（`options` 传进来时），
      不能用我们的全局表 —— 每个模型允许的比例集合都不一样，实测：
        · banana-2     ：1:1 2:3 3:2 3:4 4:3 4:5 5:4 9:16 16:9 21:9 1:4 4:1 1:8 8:1（**没有 2:1/1:2/9:21**）
        · tt-image-2.5 ：auto 1:1 16:9 9:16 4:3 3:4 3:2 2:3 5:4 4:5 2:1 1:2 21:9 9:21（**没有 1:4/4:1/1:8/8:1**）
      用全局表挑出的值很可能不在模型的可选集合里 → 要么被上游 400，要么被静默丢掉。
    ★ `tolerance` 是「差多少才算同一个比例」：默认 2%（避免把用户选的 16:9 悄悄改成 21:9）；
      调用方对**必填**参数会放宽到 1.0（即"就近取一个"），见 build_media_generate_params。
    """
    try:
        width, height = [int(part) for part in str(size or '').split('x')]
    except (TypeError, ValueError):
        return ''
    if width <= 0 or height <= 0:
        return ''
    candidates = tuple(options) if options else MEDIA_ASPECT_VALUES
    target = width / height
    best, best_gap = '', None
    for value in candidates:
        try:
            aspect_w, aspect_h = [int(part) for part in str(value).split(':')]
        except (TypeError, ValueError):
            continue
        if aspect_w <= 0 or aspect_h <= 0:
            continue
        ratio = aspect_w / aspect_h
        gap = abs(target - ratio) / ratio
        if best_gap is None or gap < best_gap:
            best, best_gap = str(value), gap
    if best_gap is None:
        return ''
    return best if best_gap <= tolerance else ''


def media_model_schema(entry, model):
    """取 `GET /v1/skills/models/{name}` 的 params 定义（带缓存）；取不到返回 `{}`。

    ★ 为什么必须真去查：平台明确要求「params 用法：先调 /v1/skills/models/{model_name}
      获取模型的 params 定义」，而且**不再返回默认值** —— 不知道它声明了哪些键就没法安全地传参。
    ★ 取不到（网络抖动 / 老平台没这个接口）时返回 `{}` → 只发 model + prompt，
      让上游把"缺哪个必填参数"报出来，比我们瞎猜一个键名强。
    """
    base_url = str((entry or {}).get('baseUrl') or '').rstrip('/')
    api_key = str((entry or {}).get('apiKey') or '').strip()
    model = str(model or '').strip()
    if not base_url or not provider_has_credentials(entry) or not model:
        return {}
    cache_key = (base_url, model, hashlib.sha256(json.dumps(auth_headers(entry, api_key), sort_keys=True).encode()).hexdigest())
    cached = MEDIA_SCHEMA_CACHE.get(cache_key)
    if cached and time.monotonic() - cached[0] < 600:
        return cached[1]
    urls = endpoint_candidates(base_url, f'{MEDIA_MODEL_SCHEMA_PATH}/{quote(model, safe="")}')
    _status, payload, error, _hit = request_json_first_hit(urls, auth_headers(entry, api_key), 30)
    schema = {}
    if not error and isinstance(payload, dict):
        for item in (payload.get('params') or []):
            if isinstance(item, dict) and item.get('name'):
                schema[str(item['name'])] = item
    # Imported media contracts retain the supplier's documented parameter schema.
    # Some gateways expose generation without the read-only skills route.
    if not schema:
        for item in upstream_contract(entry).get('params') or []:
            if isinstance(item, dict) and item.get('name'):
                schema[str(item['name'])] = item
    # Cache only successful lookups. A temporary failure must be retried, even
    # when a bundled contract supplied fallback options for this request.
    if not error and isinstance(payload, dict):
        MEDIA_SCHEMA_CACHE[cache_key] = (time.monotonic(), schema)
    return schema


# ---------------------------------------------------------------- 预置音色列表（只读代理，r862）
# 上游 `GET /v1/skills/voices?model=<上游模型名>` 返回这个模型可用的**预置音色**。
# 实测（2026-09-25）：`doubao-tts-2.0` → 36 条、`gem-3.1-tts` → 30 条，每条带
#   `voice_id` / `name`（Vivi 2.0、小何 2.0…）/ `description` / `gender` / `language` /
#   `capability`（情感变化,指令遵循,ASMR）/ `scene` / **`demo_audio`（可直接试听）**。
# ★★ 为什么必须由服务端代理：**API Key 不能下发浏览器**（与 `/api/ai/models` 同一条纪律）。
# ★ 这是**只读**接口、零额度消耗；但它真的会发一次 HTTP，所以按 (baseUrl, model) 缓存。
# ★ 拉不到**不是错误**：前端会依次回落到「登记表里该模型的选项」→「内置音色库」，
#   所以这里失败时返回空列表 + 原因，而不是把弹层整块判死。
VOICE_LIST_PATH = 'skills/voices'
VOICE_LIST_CACHE = {}
VOICE_LIST_TTL = 600   # 10 分钟：音色表基本静态，但也别做成进程级缓存（供应商加音色要看得见）


def normalize_voice_item(raw):
    """一条上游音色 → `{id, name, description, gender, language, scene, capability, demo}`。"""
    if not isinstance(raw, dict):
        return None
    voice_id = _spec_text(raw.get('voice_id') or raw.get('id'), 120)
    if not voice_id:
        return None
    return {
        'id': voice_id,
        'name': _spec_text(raw.get('name'), 60) or voice_id,
        'description': _spec_text(raw.get('description'), 80),
        'gender': _spec_text(raw.get('gender'), 20),
        'language': _spec_text(raw.get('language'), 80),
        'scene': _spec_text(raw.get('scene'), 40),
        'capability': _spec_text(raw.get('capability'), 120),
        'demo': _spec_text(raw.get('demo_audio'), 400),
    }


def voice_filter_options(voices):
    """「筛选」能用的可选值 —— 只列**真的出现过**的值，不凭空造（造了就会筛出 0 条）。

    ★ `capability` 是逗号分隔的多值（「情感变化,指令遵循,ASMR」）→ 拆开；其余按整串收
      （`language` 有「中文、日文、印尼、墨西哥西班牙语」这种复合值，拆开反而没法筛）。
    """
    def collect(field, split=False):
        out = []
        for voice in voices or []:
            text = str((voice or {}).get(field) or '').strip()
            if not text:
                continue
            parts = [part.strip() for part in text.split(',')] if split else [text]
            for part in parts:
                if part and part not in out:
                    out.append(part)
        return out
    return {'genders': collect('gender'), 'languages': collect('language'),
            'scenes': collect('scene'), 'capabilities': collect('capability', split=True)}


def fetch_model_voices(entry, model, timeout=20):
    """取某个上游模型的预置音色列表。返回 `(voices, error)`；失败返回 `([], 原因)`。"""
    base_url = str((entry or {}).get('baseUrl') or '').rstrip('/')
    api_key = str((entry or {}).get('apiKey') or '').strip()
    model = str(model or '').strip()
    if not base_url or not provider_has_credentials(entry) or not model:
        return [], '模型配置不完整（接口地址 / API Key / 模型标识）'
    documented=upstream_contract(entry).get('voices') or []
    if documented:return [v for v in (normalize_voice_item(r) for r in documented) if v],''
    cache_key = (base_url, model)
    cached = VOICE_LIST_CACHE.get(cache_key)
    if cached and time.monotonic() - cached[0] < VOICE_LIST_TTL:
        return cached[1], ''
    urls = endpoint_candidates(base_url, f'{VOICE_LIST_PATH}?model={quote(model, safe="")}')
    _status, payload, error, _hit = request_json_first_hit(urls, auth_headers(entry, api_key), timeout)
    if error:
        return [], str(error)[:200]
    raw = payload.get('voices') if isinstance(payload, dict) else None
    if not isinstance(raw, list):
        return [], '上游没有返回音色列表'
    voices, seen = [], set()
    for item in raw:
        voice = normalize_voice_item(item)
        if voice and voice['id'] not in seen:
            seen.add(voice['id'])
            voices.append(voice)
    VOICE_LIST_CACHE[cache_key] = (time.monotonic(), voices)
    return voices, ''


def media_param_options(schema, name):
    """某个参数声明的可选值（select / radio 才有）。"""
    item = schema.get(name) or {}
    return [str(option.get('value')) for option in (item.get('options') or [])
            if isinstance(option, dict) and option.get('value') is not None]


def media_param_overrides(entry):
    """后台为这个模型配的「媒体端点专有参数」默认值（字典）。

    ★ 为什么必须有这一层：`version`（tt-image-2.5 的 flare / sunburst）是**必填**的 select，
      却不在「尺寸 / 画质」这套通用映射里 —— 代码无从推导，只能由后台按模型声明。
      同一个字段也顺手覆盖了 `background` / `web_search` / `thinkingLevel` 这类模型私有开关。
    ★ 取值优先级：模型级 `modelParams.image.mediaParams` 覆盖供应商级 `mediaParams`
      （与 `resolve_image_transport` 的「模型级覆盖优先」保持同一套直觉）。
    """
    entry = entry or {}
    model_params = entry.get('modelParams') if isinstance(entry.get('modelParams'), dict) else {}
    image_params = model_params.get('image') if isinstance(model_params.get('image'), dict) else {}
    merged = {}
    for source in (entry.get('mediaParams'), image_params.get('mediaParams')):
        if isinstance(source, dict):
            merged.update({str(key): value for key, value in source.items()})
    return merged


def build_media_generate_params(schema, size='', quality_candidates=None, references=None, overrides=None,
                                spec_rows=None, source_videos=None):
    """按模型**自己声明的** params 定义组装参数。

    ★★★ 四条纪律（平台文档明确要求，违反任一条都会 400）：
      ① 只发 schema 里声明过的键 —— 多发一个未声明的键就是参数错误；
      ② `type=select/radio/switch` 的值**只能**从 options 里挑，不能自拟；
      ③ 只有 `type=input/textarea` 这类**没有 options** 的才原样收字符串；
      ④ 我们不认识的参数（version / web_search / background…）**不替模型猜** ——
         由后台通过 `mediaParams` 显式声明（见 media_param_overrides）。
    ★ 复数名参数（images / image_urls…）**一律传数组**，即使只有一张。
      平台文档点名过：「直接传字符串可能被部分模型判为参数格式错误」。
    ★★ 比例（aspectRatio / aspect_ratio）**只在模型声明的选项里挑**，且分两档容差：
        · 非必填 → 严格 2%，挑不中就不发（让上游用它自己的 auto，而不是把 16:9 悄悄改成 21:9）；
        · 必填   → 放宽到"就近取一个"。理由：必填参数少一个就是硬 400，
          用户会完全生成不了（实测 banana-2 的 aspectRatio 必填，且**没有** 2:1 / 1:2 / 9:21，
          用户选 2:1 尺寸时严格匹配会落空）。两档的取舍写在 trace 里，可回溯。
    ★ 写值顺序：`overrides`（后台默认）→ 自动推导（用户本次选择）→ 后者覆盖前者，
      即**用户本次的选择优先于后台默认值**。
    """
    params = {}
    quality_candidates = [str(item) for item in (quality_candidates or []) if item]
    # ★★★ r873：源视频（视频超分 / 视频编辑这类模型的**必传**素材）。
    #   只留 http(s) 直链，data: 与相对路径一律丢掉（上游明确「视频文件仍需传 URL」）。
    source_video = provider_video_value(source_videos)
    # ★ 上游对源视频参数的命名不统一，且**声明为 upload 的参数本身没有 options**
    #   （`media_param_options` 返回空）→ 走 put() 的 `input/textarea` 分支会**落空**
    #   （upload 不在那个白名单里）。所以源视频必须自己判"字段在 schema 里"再写。
    #   这类参数的"可用值"不是枚举，而是"任意可公开访问的 URL"，无所谓猜值。
    def put_upload(name, value):
        if name not in schema or not value:
            return False
        declared = declared_type(name)
        if declared and declared not in ('input', 'textarea', 'upload'):
            return False
        params[name] = value
        return True

    def declared_type(name):
        return str((schema.get(name) or {}).get('type') or '').strip().lower()

    def put(name, wanted):
        """按声明写一个参数；返回是否写入成功。"""
        if name not in schema:
            return False
        allowed = media_param_options(schema, name)
        if not allowed:
            if declared_type(name) in {'input', 'textarea'}:
                if wanted and wanted[0]:
                    params[name] = wanted[0]
                    return True
            return False
        for value in wanted:
            if value and value in allowed:
                params[name] = value
                return True
        return False

    # ① 后台配的模型专有参数（version / background / web_search …），先写，允许被下面覆盖
    for key, value in (overrides or {}).items():
        if value in (None, ''):
            continue
        text = 'true' if value is True else 'false' if value is False else str(value)
        put(str(key), [text])

    # ②③④ 比例 / 分辨率 / 画质 —— 两条路：**登记表接管** 或 旧的启发式。
    if spec_rows is not None:
        # ★★★ r860：登记表接管。字段名与取值都以「模型管理 · 图片规格」里登记的那份为准 ——
        #   以前字段名是**猜**出来的（依次试 aspectRatio / aspect_ratio、imageSize / resolution），
        #   模型专有参数（`tt-image-2.5` 的 `version` 之类）只能直接改 ai-models.json 的 `mediaParams`
        #   —— 后台界面看不见、改不了。现在都在登记表里，且真的进请求体。
        #   · 语义键（比例/清晰度/画质…）→ 用户本次选择（`semantic`），没给就用行里的默认值；
        #   · 模型专有键（version / background …）→ 用行里登记的默认值；
        #   · 字段名只在**平台声明过**的候选里挑（纪律①），挑不中就不发（宁可让上游报缺参，也不瞎猜）。
        semantic = {'aspectRatio': aspect_from_size(size), 'resolution': resolution_tier(size)}
        if quality_candidates:
            semantic['quality'] = quality_candidates[0]
        declared = set()
        for row in spec_rows:
            key = str((row or {}).get('key') or '').strip()
            if not key:
                continue
            declared.add(key)
            value = semantic.get(key)
            # ★★★ r873：语义值**不在这一行的选项里**时，回落到行里的默认值，而不是原样发出去。
            #   起因：`resolution_tier()` 给的是 `1K/2K/4K`，而登记表的档位常写成 `720p/1080p/2k/4k`
            #   —— 名称体系不同 → 直接发 `2K` 会被上游拒（纪律②：select 的值只能从 options 里挑），
            #   而 `put()` 挑不中会**静默不写**，于是必填的清晰度整段缺失（比发错更难查）。
            #   加这道回落：先按选项校验，不合规就用行默认；行默认也没有才不发。
            candidate_options = media_param_options(schema, str(row.get('field') or key)) or []
            if value not in (None, '') and candidate_options and str(value) not in candidate_options:
                value = row.get('default')
            if value in (None, ''):
                value = row.get('default')
            if value in (None, ''):
                continue
            text = 'true' if value is True else 'false' if value is False else str(value)
            for name in spec_field_candidates(row):
                if put(name, [text]):
                    break
        # 比例是**必填**时不能落空：登记表声明了比例行、但用户选的值不在上游选项里
        # → 就近取一个（与旧逻辑同一取舍：少一个必填 = 硬 400，用户完全生成不了）。
        if 'aspectRatio' in declared:
            for name in ('aspectRatio', 'aspect_ratio'):
                if name not in schema:
                    continue
                if name not in params:
                    allowed = media_param_options(schema, name)
                    if allowed and (schema.get(name) or {}).get('required'):
                        chosen = aspect_from_size(size, allowed, tolerance=1.0)
                        if chosen:
                            params[name] = chosen
                break
    else:
        # ② 比例：两种命名都试（banana-2 用 aspectRatio、tt-image-2.5 用 aspect_ratio）
        for name in ('aspectRatio', 'aspect_ratio'):
            if name not in schema:
                continue
            allowed = media_param_options(schema, name)
            chosen = aspect_from_size(size, allowed) if allowed else aspect_from_size(size)
            if not chosen and allowed and (schema.get(name) or {}).get('required'):
                chosen = aspect_from_size(size, allowed, tolerance=1.0)
            if chosen:
                params[name] = chosen
            break

        # ③ 分辨率：banana-2 叫 imageSize（0.5K/1K/2K/4K），tt-image-2.5 叫 resolution（auto/1K/2K/4K）
        tier = resolution_tier(size)
        for name in ('imageSize', 'resolution'):
            if put(name, [tier]):
                break

        # ④ 画质：候选值由调用方给（已做「界面档 → 上游取值」的映射），只认 options 里有的
        put('quality', quality_candidates)

    # ⑤ 参考图
    if references:
        for name in ('images', 'image_urls', 'reference_images', 'referenceImages'):
            if name in schema:
                params[name] = list(references)
                break
        else:
            if 'input_image' in schema:
                params['input_image'] = references[0]

    # ⑥ 源视频（r873）——**运行时**取值，不是登记表的默认值。
    #   ★★★ 为什么必须单独一段：登记表那条 `video_url` 行的 `default` 是 null
    #     （没有"默认源视频"这种东西），上面的循环 `if value in (None, ''): continue` 会跳过它；
    #     而 `put()` 又只对 `input/textarea` 原样收字符串，`upload` 类型会落空。
    #     于是「登记表登记了必传的源视频」这件事**一路静默到上游 400** —— 用户只看到
    #     "参数错误"，完全不知道自己没连视频节点。这里把它接上。
    #   · 字段名：登记行声明的 `field` 优先（用 spec_field_candidates 拿蛇形/驼峰变体），
    #     再回落到通用候选（video_url / videos …）。
    #   · 只在 schema 声明过这个键时才发（纪律①：多发一个未声明的键就是参数错误）。
    if source_video:
        names = []
        for row in (spec_rows or []):
            if isinstance(row, dict):
                key = str(row.get('key') or '').strip()
                field = str(row.get('field') or '').strip()
                if key in VIDEO_INPUT_FIELD_CANDIDATES or field in VIDEO_INPUT_FIELD_CANDIDATES:
                    for name in spec_field_candidates(row):
                        if name not in names:
                            names.append(name)
        for name in VIDEO_INPUT_FIELD_CANDIDATES:
            if name not in names:
                names.append(name)
        # 复数名一律传数组（平台点名过：直接传字符串可能被判参数格式错误）；单数名传字符串。
        for name in names:
            if name not in schema:
                continue
            plural = name.endswith('s') and not name.endswith('ss')
            if put_upload(name, [source_video] if plural else source_video):
                break
    return params


def media_error_text(payload):
    """从 `{code, msg, data}` 信封里取出人能看懂的错误。"""
    if not isinstance(payload, dict):
        return str(payload)[:200]
    message = str(payload.get('msg') or '').strip()
    data = payload.get('data')
    detail = ''
    if isinstance(data, dict):
        detail = str(data.get('详情') or data.get('message') or data.get('error') or '').strip()
    elif isinstance(data, str):
        detail = data.strip()
    return '：'.join(part for part in (message, detail) if part) or str(payload)[:200]


def media_status_payload_error(payload):
    """统一媒体端点的**查询**接口出错时返回错误文本；正常时返回 `''`。

    ★ 实测这个平台的两种出错形态（都在 `_probe_lk888_contract_final.py` 里取证过）：
      · 提交接口出错 → HTTP 200 + `{"code":404,"data":{...},"msg":"模型不存在或未启用"}`
      · 查询接口出错 → HTTP 400 + `{"error":{"message":"task_id 参数无效",...}}`
      所以两种信封都要认。查询接口正常时是**顶层裸字段**（`is_final` / `state` / `result_url`），
      既没有 `code` 也没有 `error`，自然返回空串。

    ★ 为什么必须单判这一条：查询失败若不被识别，会被 `normalize_provider_status` 兜底成
      `queued`（没有任何 state/status 字段可读）→ 任务一直显示"排队中"直到「图片总等待」
      超时才失败，用户完全看不到真正原因。

    ★★ 反过来也要分清（2026-09-25 接音频时踩到）：**带 `is_final` 的响应是正常的状态查询**，
      不是查询接口出错。这类响应的失败语义是「任务失败了」，它的 `error` 字段是**任务错误**，
      不是**查询错误** —— 混在一起会让用户看到「查询任务状态失败：上游算力不足」这种
      把两件事糊在一句话里的文案（用户会以为是我们的轮询坏了，其实是上游任务没跑成）。
    """
    if not isinstance(payload, dict):
        return ''
    if 'is_final' in payload:
        return ''
    if 'code' in payload:
        return '' if str(payload.get('code')) == '200' else media_error_text(payload)
    error = payload.get('error')
    if isinstance(error, dict) and error.get('message'):
        return str(error['message']).strip()
    if isinstance(error, str) and error.strip():
        return error.strip()
    return ''


def submit_media_generate(entry, prompt, size='1024x1024', reference_image=None, reference_images=None,
                          quality=None, timeout=None, trace=None, spec_rows=None, source_videos=None):
    """统一媒体端点提交（POST /v1/media/generate）。返回 (submitted_payload, error)。

    ★ 与 `images/*` 路径的三点不同：
      ① 模型专有参数必须放在 `params` 里，顶层只放 model / prompt；
      ② 响应是 `{code, msg, data:{task_id}}` 信封 —— **HTTP 200 ≠ 成功**。
         平台原文：「本平台没有 code=0 语义，请用 code==200 判成功」。所以这里必须自己
         看 body.code：否则参数错误（HTTP 200 + code 400）会被当成"提交成功"，
         然后拿着空任务号去轮询 → 用户看到的是"任务莫名卡住"，而不是一句参数错误；
      ③ 天然异步，没有"一次请求直接拿图"的形态。
    """
    timeout = timeout or provider_timeout_value(entry, 'imageExec', 120)
    base_url = str(entry.get('baseUrl') or '').rstrip('/')
    api_key = str(entry.get('apiKey') or '').strip()
    model = str(entry.get('model') or '').strip()
    if not base_url or not provider_has_credentials(entry) or not model:
        return None, '模型配置不完整（接口地址 / API Key / 模型标识）'
    references = [item.strip() for item in (reference_images or []) if isinstance(item, str) and item.strip()]
    if not references and isinstance(reference_image, str) and reference_image.strip():
        references = [reference_image.strip()]
    references = [local_image_reference(value) for value in references]
    schema = media_model_schema(entry, model)
    quality_text = str(quality or '').strip().lower()
    mapped = image_quality_value(model, quality_text, entry.get('name')) if quality_text else ''
    # ★ 登记表优先：这个模型在「模型管理 · 图片规格」里登记过 → 字段名/取值以登记表为准；
    #   没登记（返回 None）→ 回落升级前的启发式（行为逐字不变，保证不突变）。
    rows = spec_rows_for_entry(entry, 'image') if spec_rows is None else spec_rows
    params = build_media_generate_params(
        schema, size=size,
        quality_candidates=[mapped, quality_text, {'standard': 'medium'}.get(quality_text, '')],
        references=references, overrides=media_param_overrides(entry),
        spec_rows=rows, source_videos=source_videos)
    payload = {'model': model, 'prompt': str(prompt or '')}
    if params:
        payload['params'] = params
    validate_contract_options(upstream_contract(entry),params)
    urls = endpoint_candidates(base_url, MEDIA_GENERATE_PATH)
    result, hit_url, error = request_json_candidates(
        urls, payload, headers=auth_headers(entry, api_key, {'Content-Type': 'application/json'}),
        timeout=timeout)
    if trace is not None:
        trace['endpoint'] = hit_url
        trace['contract'] = MEDIA_GENERATE_TRANSPORT
        trace['params'] = sorted(params.keys())
        trace['schemaParams'] = sorted(schema.keys())
        trace['specSource'] = 'registry' if rows is not None else 'heuristic'
    if error:
        return None, error
    if isinstance(result, dict) and result.get('code') is not None and str(result.get('code')) != '200':
        return None, f'供应商拒绝了本次请求（code={result.get("code")}）：{media_error_text(result)}'
    if not extract_task_id(result):
        return None, f'供应商未返回任务号：{str(result)[:200]}'
    return result, None


# ---------------------------------------------------------------- 统一媒体端点：音频（音乐 / 语音）
# 与图片走**同一个端点**（`POST /v1/media/generate`），差别只在「参数从哪来」：
#   图片 → 尺寸 / 比例 / 画质（通用映射 + 模型 schema）
#   音频 → 面板规格（`spec`，键名已经是上游字段名）+ 音色
# 三条纪律与图片完全一致（见 `submit_media_generate` 的说明）：params 嵌套 / 判 `code==200` / 天然异步。
#
# ★★★ 为什么不能沿用 `call_tts`（`audio/speech`）：实测 api.lk888.ai **没有 `/v1/audio/*`**
#   （`GET /v1/skills` 的接口清单里只有 `media/generate` + `skills/*`）。
#   老路径会打到 `{baseUrl}/audio/speech` → **路由级 404**。
#   而 `suno-v4.5` / `music-2.5+` 本身就是**音乐生成**模型（不是 TTS），平台只从 media/generate 收。
MEDIA_AUDIO_PARAM_FALLBACK = (
    'mv', 'lyrics', 'make_instrumental', 'is_instrumental', 'vocal_gender',
    'sample_rate', 'bitrate', 'speed', 'pitch', 'emotion', 'emotion_scale',
    'sound_effects', 'quality', 'speech_rate', 'format', 'language',
    'model_version', 'voice_id', 'voice', 'style', 'title', 'duration',
)
# ★ media/generate 形态下 `params` 是**独立嵌套对象**，不会顶掉顶层协议字段 ——
#   所以这里**不剔** speed / pitch / voice（它们是 speech 类的模型参数，不是协议字段）。
#   与 TTS 形态（`call_tts` 把 spec 平铺进**顶层**、必须剔）是两套不同的保留键。
MEDIA_AUDIO_RESERVED_KEYS = {'model', 'prompt'}


def media_audio_spec(incoming):
    """media/generate 形态的音频参数：登记表规格 + 三个高级滑块（语速 / 声调 / 音量）。

    ★★★ 为什么必须把 speed / pitch / volume 并进来（r860）：
      它们在**老式 TTS 形态**里是协议字段（`call_tts` 平铺进顶层 payload），但在
      media/generate 形态里是**模型参数**。以前这里只把 `spec` 传下去，于是底栏「高级设置」
      的三个滑块对当前配置的音频模型（doubao-tts-2.0 / suno-v4.5 … 全是 media-generate）
      **拖了完全没反应** —— 值在 `create_audio_job` 这一步就被丢了，不报任何错。
    ★ 仍然由 `build_media_audio_params()` 按「只发模型声明过的键」过滤（纪律①），
      所以对没声明 speed 的模型（doubao 用 `speech_rate`）多发一个键也不会 400，只是不生效。
    ★ 用 `setdefault`：spec 里显式写了同名键时以 spec 为准（一个值只有一个真源）。
    """
    spec = dict(sanitize_audio_spec(incoming.get('spec'), reserved=MEDIA_AUDIO_RESERVED_KEYS))
    for key in ('speed', 'pitch', 'volume'):
        value = incoming.get(key)
        if value in (None, ''):
            continue
        spec.setdefault(key, value)
    return spec


def build_media_audio_params(schema, spec=None, voice='', overrides=None):
    """音频版参数组装：只发模型**自己声明的**键（纪律①：多发一个未声明的键就是 400）。

    ★ schema 有值 → 严格按 schema 过滤（连 `lyrics` 这种 textarea 也认）；
    ★ schema 空（参数表取不到）→ 回落 `MEDIA_AUDIO_PARAM_FALLBACK` 白名单。
      理由：全丢会让「面板上选了却没生效」重演；而白名单里的键全部是上游 audio 模型
      **真实声明过**的（已取证），发过去不会引入未声明键。trace 里记 `schemaSource` 便于回溯。
    ★ 写值顺序：`overrides`（后台默认）→ 音色 → `spec`（用户本次选择），后者覆盖前者。
    """
    params = {}
    schema = schema if isinstance(schema, dict) else {}
    known = set(schema.keys()) if schema else set(MEDIA_AUDIO_PARAM_FALLBACK)

    def allowed_values(name):
        item = schema.get(name) or {}
        return [str(option.get('value')) for option in (item.get('options') or [])
                if isinstance(option, dict) and option.get('value') is not None]

    def put(name, value):
        name = str(name or '').strip()
        if not name or name not in known or value in (None, ''):
            return False
        options = allowed_values(name)
        if options:
            # select / radio：值**只能**从 options 里挑（纪律②）。
            text = 'true' if value is True else 'false' if value is False else str(value)
            if text not in options:
                return False
            params[name] = text
            return True
        # input / textarea（没有 options）：原样收（纪律③）。
        if isinstance(value, bool):
            params[name] = value
        elif isinstance(value, (int, float)):
            params[name] = value
        else:
            params[name] = str(value)[:2000]
        return True

    for key, value in (overrides or {}).items():
        put(key, value)
    if voice:
        for name in ('voice_id', 'voice'):
            if put(name, voice):
                break
    for key, value in (spec or {}).items():
        put(key, value)
    return params


def submit_audio_media_generate(entry, text, voice='', spec=None, timeout=None, trace=None):
    """音频的统一媒体端点提交（POST /v1/media/generate）。返回 (submitted, error)。

    ★ 请求体形状与图片完全一致：顶层只放 `model` / `prompt`，模型参数进 `params`。
      平台对 suno 的 `input_hint` 写明「音乐风格描述传顶层 prompt，完整歌词传 params.lyrics」——
      所以 `text` 一律进顶层 prompt（歌词留空 = AI 按风格自动作词，正是我们要的行为）。
    ★ 成功判据同样是 `body.code == 200`（HTTP 200 ≠ 成功），失败要**在提交阶段**就说清原因，
      否则会拿着空任务号去轮询 → 用户看到「任务莫名卡住」而不是一句参数错误。
    """
    timeout = timeout or provider_timeout_value(entry, 'imageExec', 120)
    base_url = str(entry.get('baseUrl') or '').rstrip('/')
    api_key = str(entry.get('apiKey') or '').strip()
    model = str(entry.get('model') or '').strip()
    if not base_url or not provider_has_credentials(entry) or not model:
        return None, '模型配置不完整（接口地址 / API Key / 模型标识）'
    text = str(text or '').strip()
    if not text:
        return None, '请先写下要生成的内容'
    schema = media_model_schema(entry, model)
    params = build_media_audio_params(
        schema, spec=spec, voice=voice, overrides=media_param_overrides(entry))
    payload = {'model': model, 'prompt': text}
    if params:
        payload['params'] = params
    validate_contract_options(upstream_contract(entry),params)
    urls = endpoint_candidates(base_url, MEDIA_GENERATE_PATH)
    result, hit_url, error = request_json_candidates(
        urls, payload, headers=auth_headers(entry, api_key, {'Content-Type': 'application/json'}),
        timeout=timeout)
    if trace is not None:
        trace['endpoint'] = hit_url
        trace['contract'] = MEDIA_GENERATE_TRANSPORT
        trace['params'] = sorted(params.keys())
        trace['schemaParams'] = sorted(schema.keys())
        trace['schemaSource'] = 'upstream' if schema else 'fallback'
    if error:
        return None, error
    if isinstance(result, dict) and result.get('code') is not None and str(result.get('code')) != '200':
        return None, f'供应商拒绝了本次请求（code={result.get("code")}）：{media_error_text(result)}'
    if not extract_task_id(result):
        return None, f'供应商未返回任务号：{str(result)[:200]}'
    return result, None


def finish_audio_result(result, deadline):
    """把上游响应收敛成音频 data URI（与 finish_image_result 同构）。"""
    urls = prefer_media_files(extract_generation_urls(result))
    if not urls:
        return None, 'AI 接口未返回音频数据'
    target = urls[0]
    if target.startswith('data:audio/'):
        return target, None
    if not target.startswith('http'):
        return None, 'AI 接口未返回可用的音频'
    remaining = deadline - time.monotonic()
    if remaining <= 1:
        return None, '音频生成超过总等待上限，已中止下载'
    try:
        with open_http_url(urllib_request.Request(target), timeout=max(5, min(60, int(remaining)))) as audio_response:
            audio_bytes = audio_response.read(MEDIA_MAX_BYTES+1)
            if len(audio_bytes)>MEDIA_MAX_BYTES:return None,'生成音频超过文件大小上限'
    except (urllib_error.URLError, TimeoutError) as exc:
        return None, f'下载生成音频失败：{exc}'
    # 魔数优先：上游给 mp3 / wav 都有可能，写死会让 data URI 的 MIME 与内容不符。
    mime = sniff_media_mime(audio_bytes) or 'audio/mpeg'
    return f'data:{mime};base64,{base64.b64encode(audio_bytes).decode("ascii")}', None


def poll_audio_task(entry, submitted, base_url, api_key, deadline, trace=None):
    """音频异步任务：拿任务号轮询，直到拿到音频地址 / 判定失败 / 超时。

    与 `poll_image_task` 同构（共用 `query_image_task_once` / `normalize_provider_status` /
    `extract_provider_progress`），差别只在「什么算拿到结果」—— 这里要**音频**地址。
    """
    provider_id = extract_provider_job_id(submitted)
    status_path = str(entry.get('imageStatusPath') or '').strip()
    if not status_path and media_generate_entry(entry):
        status_path = MEDIA_STATUS_PATH
    if not provider_id:
        return None, '已按异步模式提交，但供应商没有返回任务号'
    if not status_path:
        return None, '异步模式需要填写「查询接口」（用 {task_id} 占位上游任务号）'
    interval = max(1, min(10, int(provider_timeout_value(entry, 'statusPoll', 60) // 10) or 3))
    last = ''
    while time.monotonic() < deadline:
        time.sleep(interval)
        polled, error, http_status = query_image_task_once(entry, provider_id, base_url, api_key,
                                                          trace=trace, status_path=status_path)
        if error:
            last = error
            if http_status in (401, 403):
                return None, error
            continue
        if media_generate_entry(entry):
            status_error = media_status_payload_error(polled)
            if status_error:
                return None, status_error
        if prefer_media_files(extract_generation_urls(polled)):
            return polled, None
        if normalize_provider_status(polled) == 'failed':
            return None, provider_error(response_value(polled, 'message', 'error') or '供应商任务失败')
        last = '任务仍在进行'
    return None, f'音频生成超时（{last or "任务仍在进行"}）'


def submit_image_generation(entry, prompt, size='1024x1024', reference_image=None, reference_images=None,
                            quality=None, timeout=None, trace=None):
    """异步图片任务：**只做「提交」这一步**，返回上游提交响应（内含任务号）。

    与 call_image_generation 共用同一套端点 / 图片传输合同 / 参考图规则，
    唯一区别是**不等待结果** —— 供轮询式 job 架构用（进度由 refresh_image_job 查）。
    返回 (submitted_payload, error)；调用方用 extract_provider_job_id() 取任务号。
    """
    timeout = timeout or provider_timeout_value(entry, 'imageExec', 120)
    base_url = str(entry.get('baseUrl') or '').rstrip('/')
    api_key = str(entry.get('apiKey') or '').strip()
    model = str(entry.get('model') or '').strip()
    if not base_url or not provider_has_credentials(entry) or not model:
        return None, '模型配置不完整（接口地址 / API Key / 模型标识）'
    # ★★ 统一媒体端点（/v1/media/generate）走另一条路：请求体形状、成功判据（body.code==200）、
    #    轮询接口全都不一样。放在这里**提前分流**，下面的 images/* 逻辑一行都不用动。
    if media_generate_entry(entry):
        return submit_media_generate(entry, prompt, size=size, reference_image=reference_image,
                                     reference_images=reference_images, quality=quality,
                                     timeout=timeout, trace=trace)
    # chat-image 形态是「一次对话直接出图」，没有任务号可查 —— 交给调用方回落后台线程模式。
    if str(entry.get('requestProfile') or '').strip() == 'chat-image':
        return None, '该模型走 chat-image 形态，没有异步任务号'
    text_prompt = str(prompt or '')
    quality_value = image_quality_value(model, quality, entry.get('name'))
    references = [item.strip() for item in (reference_images or []) if isinstance(item, str) and item.strip()]
    if not references and isinstance(reference_image, str) and reference_image.strip():
        references = [reference_image.strip()]
    if references:
        references, reference_error = resolve_reference_values(entry, references, reference_modes(entry))
        if reference_error:
            return None, reference_error
    contract = IMAGE_TRANSPORTS[resolve_image_transport(entry)]
    if references:
        endpoint_path = str(entry.get('imageEditPath') or '').strip() or contract['reference']
        payload, body, content_type, build_error = build_image_reference_body(
            contract['body'], model, text_prompt, size, references, quality_value, image_extra_params(entry))
        if build_error:
            return None, build_error
        headers = auth_headers(entry, api_key, {'Content-Type': content_type} if content_type else None)
        if body is not None:
            result, hit_url, error = request_body_candidates(
                endpoint_candidates(base_url, endpoint_path), lambda _url: body, headers=headers, timeout=timeout)
        else:
            result, hit_url, error = request_json_candidates(
                endpoint_candidates(base_url, endpoint_path), payload, headers=headers, timeout=timeout)
    else:
        endpoint_path = str(entry.get('imageSubmitPath') or '').strip() or contract['generation']
        payload = {'model': model, 'prompt': text_prompt, 'n': 1, 'size': size}
        if quality_value:
            payload['quality'] = quality_value
        payload.update(image_extra_params(entry))
        headers = auth_headers(entry, api_key)
        result, hit_url, error = request_json_candidates(
            endpoint_candidates(base_url, endpoint_path), payload, headers=headers, timeout=timeout)
    if error:
        return None, error
    if trace is not None:
        trace['transport'] = resolve_image_transport(entry)
        trace['endpointPath'] = endpoint_path
        if hit_url:
            trace['endpoint'] = hit_url
    return result, None


def describe_image_with_model(image_data, instruction, entry):
    if not isinstance(image_data, str) or not image_data.startswith('data:image/'):
        return None, '图片数据无效'
    if len(image_data) > 6_000_000:
        return None, '图片过大，请压缩到 4MB 左右后重试'
    prompt = str(instruction or '').strip() or '请分析这张图片，并生成一段可直接用于 AI 视频生成的中文提示词。准确描述主体、人物外观与姿态、构图、景别、镜头视角、环境、光线、颜色、材质和氛围。不要臆测图片中不存在的内容，不要使用标题或列表，输出 120 到 220 字的单段文本。'
    parts = [{'type': 'text', 'text': prompt}, {'type': 'image_url', 'image_url': {'url': image_data, 'detail': 'auto'}}]
    return call_chat_completion(entry, parts)


# ---------------------------------------------------------------------------
# 对话式 Agent：模型调用层
# ---------------------------------------------------------------------------

# 画布快照里随请求带过来的图片数据上限：单张不超过这个大小，最多带 3 张。
# 图片是 data URI，整包要卡在 read_json 的 8MB 之内，所以必须限量。
AGENT_IMAGE_MAX_CHARS = 1_200_000
AGENT_IMAGE_MAX_COUNT = 3


def agent_resolve_model(model_id='', user_id=''):
    """挑一个能当 Agent 大脑的模型。

    CanvasFlow 的模型注册表没有独立的「文本」类型，文本能力挂在 i2t 上，
    所以优先级是：显式指定 → i2t → 其它非视频/非语音/非生图的启用模型 → 环境变量。
    返回 (entry, error)。
    """
    models = [m for m in visible_ai_models(user_id) if m.get('enabled') and provider_has_credentials(m)]
    if model_id:
        hit = next((m for m in models if m.get('id') == model_id), None)
        if not hit:
            return None, f'模型 {model_id} 不存在或未启用'
        if not model_supports_vision(hit) and any(model_has_usage(hit,k) for k in ('video','tts','t2i')):
            return None, '所选模型不支持对话，请选择语言或图生文模型'
        return hit, None
    for kind in ('i2t',):
        hit = next((m for m in models if model_supports_vision(m)), None)
        if hit:
            return hit, None
    hit = next((m for m in models if not any(model_has_usage(m, k) for k in ('video', 'tts', 't2i'))), None)
    if hit:
        return hit, None
    api_key = str(os.environ.get('OPENAI_API_KEY') or '').strip()
    if api_key:
        return {
            'id': 'env-openai', 'name': '服务端默认语言模型',
            'baseUrl': os.environ.get('OPENAI_BASE_URL') or 'https://api.openai.com/v1',
            'apiKey': api_key, 'model': os.environ.get('OPENAI_TEXT_MODEL') or 'gpt-4o-mini',
            'protocol': 'openai',
        }, None
    return None, '还没有可用的语言模型：请先接入并启用一个图生文模型，或设置服务端 OPENAI_API_KEY'


def agent_anthropic_messages(messages):
    """把 OpenAI 形态的历史转成 Anthropic Messages API 形态。返回 (system_parts, messages)。"""
    system_parts, converted = [], []
    for item in messages or []:
        role = item.get('role')
        if role == 'system':
            system_parts.append(str(item.get('content') or ''))
        elif role == 'tool':
            converted.append({'role': 'user', 'content': [{
                'type': 'tool_result', 'tool_use_id': str(item.get('tool_call_id') or ''),
                'content': str(item.get('content') or '')}]})
        elif role == 'assistant':
            blocks = []
            if item.get('content'):
                blocks.append({'type': 'text', 'text': str(item['content'])})
            for call in item.get('tool_calls') or []:
                function = call.get('function') if isinstance(call.get('function'), dict) else {}
                blocks.append({
                    'type': 'tool_use', 'id': str(call.get('id') or ''),
                    'name': str(function.get('name') or ''),
                    'input': agent.parse_tool_arguments(function.get('arguments')),
                })
            if blocks:
                converted.append({'role': 'assistant', 'content': blocks})
        else:
            converted.append({'role': 'user', 'content': [{'type': 'text', 'text': str(item.get('content') or '')}]})
    # Anthropic 要求 user / assistant 严格交替，相邻同角色合并
    merged = []
    for item in converted:
        if merged and merged[-1]['role'] == item['role']:
            merged[-1]['content'] = list(merged[-1]['content']) + list(item['content'])
        else:
            merged.append({'role': item['role'], 'content': list(item['content'])})
    if not merged:
        merged = [{'role': 'user', 'content': [{'type': 'text', 'text': '你好'}]}]
    return system_parts, merged


def agent_anthropic_tools(tools):
    return [
        {'name': item['function']['name'], 'description': item['function']['description'],
         'input_schema': item['function']['parameters']}
        for item in tools or []
    ]


def upstream_error_detail(body, reason=''):
    """把上游的错误响应压成一句人话。

    各家格式五花八门（{error:{message}} / {message} / {msg} / {detail} / 纯文本），
    直接把原文塞给用户，界面上就是一坨 JSON —— 实测过：
    `HTTP 403：{"code":"GROUP_DISABLED","message":"API Key 所属分组已停用"}`，
    真正有用的只有后半句。这里尽力抠出那句话，抠不到再退回原文（截断），
    保证任何情况下都不会「什么都看不到」。
    """
    text = str(body or '').strip()
    if text:
        try:
            payload = json.loads(text)
        except json.JSONDecodeError:
            payload = None
        if isinstance(payload, dict):
            error = payload.get('error')
            candidates = [
                payload.get('message'),
                error.get('message') if isinstance(error, dict) else error,
                payload.get('msg'),
                payload.get('detail'),
            ]
            for item in candidates:
                if isinstance(item, str) and item.strip():
                    message = item.strip()
                    code = payload.get('code')
                    if isinstance(code, str) and code.strip() and code.strip() != message:
                        return f'{message}（{code.strip()}）'
                    return message
    return text[:200] or str(reason or '请求失败')


def agent_open_stream(entry, messages, tools, timeout, include_usage=True):
    """向 OpenAI 兼容端点发起流式请求，返回 (response, hit_url, error)。

    候选链沿用项目既有约定：第一候选保持原有直拼，404/405 继续试下一个，
    401/403 立即中断（密钥不对，换路径没意义）。
    """
    base_url = str(entry.get('baseUrl') or '').rstrip('/')
    api_key = str(entry.get('apiKey') or '').strip()
    model = str(entry.get('model') or '').strip()
    if not base_url or not provider_has_credentials(entry) or not model:
        return None, '', '模型配置不完整（接口地址 / API Key / 模型标识）'
    payload = {'model': model, 'messages': messages, 'stream': True, 'temperature': 0.4}
    payload['max_tokens'] = 4096
    if include_usage: payload['stream_options'] = {'include_usage': True}
    if tools:
        payload['tools'] = tools
        payload['tool_choice'] = 'auto'
    headers = auth_headers(entry, api_key, {'Content-Type': 'application/json', 'Accept': 'text/event-stream'})
    body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
    candidates = endpoint_candidates(base_url, 'chat/completions')
    last_error = ''
    for candidate in candidates:
        try:
            request = urllib_request.Request(candidate, data=body, headers=headers, method='POST')
            return open_http_url(request, timeout=timeout), candidate, None
        except urllib_error.HTTPError as exc:
            detail = ''
            try:
                detail = exc.read(4000).decode('utf-8', 'replace')[:300]
            except Exception:
                pass
            last_error = f'HTTP {exc.code}：{upstream_error_detail(detail, exc.reason)}'
            if exc.code == 400 and include_usage and 'stream_options' in detail:
                return agent_open_stream(entry,messages,tools,timeout,include_usage=False)
            if exc.code not in (404, 405) or (exc.code==404 and not is_route_miss(exc.code,{},detail)):
                break
            continue
        except Exception as exc:
            last_error = f'{type(exc).__name__}：{exc}'
            break  # A timeout may follow successful submission; never resubmit.
    return None, '', last_error or '没有可用的上游端点'


def agent_chat_stream(entry, messages, tools, trace=None):
    """迭代出 ('text', delta) / ('tool_calls', [call...]) / ('error', msg)。

    - openai 协议：真流式，带工具调用（主流形态）
    - anthropic 协议：非流式，带工具调用
    - responses 协议：非流式，保留系统指令、工具调用与工具结果
    """
    protocol = str(entry.get('protocol') or 'openai').lower()
    text_protocol = str(entry.get('textProtocol') or '').strip() or 'chat-completions'
    if protocol == 'anthropic':
        yield from agent_chat_anthropic(entry, messages, tools, trace=trace)
        return
    if text_protocol == 'responses':
        yield from agent_chat_responses(entry, messages, tools, trace=trace)
        return

    timeout = provider_timeout_value(entry, 'textExec', 90)
    response, hit_url, error = agent_open_stream(entry, messages, tools, timeout)
    if error and tools and error.startswith('HTTP 400') and any(word in error.lower() for word in ('tools','tool_choice','function calling')):
        # 有些网关不认 tools 字段：去掉工具再试一次，至少还能对话。
        response, hit_url, error = agent_open_stream(entry, messages, None, timeout)
    if error or response is None:
        yield ('error', f'调用语言模型失败（{hit_url or entry.get("baseUrl")}）：{error}')
        return
    accumulator = agent.ToolCallAccumulator()
    try:
        total_bytes=0
        while True:
            raw=response.readline(1_200_001)
            if not raw:break
            total_bytes+=len(raw)
            if len(raw)>1_200_000 or total_bytes>12_000_000:
                raise ValueError('模型流式响应超过大小上限')
            payload = agent.parse_stream_line(raw.decode('utf-8', 'replace'))
            if not payload:
                continue
            if trace is not None and isinstance(payload, dict) and payload.get('usage'):
                trace['usage'] = payload['usage']
            text, deltas, _ = agent.extract_delta(payload)
            if text:
                yield ('text', text)
            if deltas:
                accumulator.feed(deltas)
    except Exception as exc:
        yield ('error', f'读取模型流式响应中断：{type(exc).__name__}：{exc}')
        return
    finally:
        try:
            response.close()
        except Exception:
            pass
    yield ('tool_calls', accumulator.finish())


def agent_chat_anthropic(entry, messages, tools, trace=None):
    base_url = str(entry.get('baseUrl') or '').rstrip('/')
    api_key = str(entry.get('apiKey') or '').strip()
    model = str(entry.get('model') or '').strip()
    if not base_url or not provider_has_credentials(entry) or not model:
        yield ('error', '模型配置不完整（接口地址 / API Key / 模型标识）')
        return
    system_parts, converted = agent_anthropic_messages(messages)
    payload = {'model': model, 'max_tokens': 4096, 'messages': converted}
    if system_parts:
        payload['system'] = '\n\n'.join(system_parts)
    if tools:
        payload['tools'] = agent_anthropic_tools(tools)
    headers = auth_headers({**entry, 'authMode': 'none' if str(entry.get('authMode') or '').lower() == 'none' else 'x-api-key'}, api_key, {'anthropic-version': '2023-06-01', 'Content-Type': 'application/json'})
    result, _hit, error = request_json_candidates(
        [f'{base_url}/messages' if base_url.endswith('/v1') else f'{base_url}/v1/messages'], payload, headers=headers,
                                                  timeout=provider_timeout_value(entry, 'textExec', 90))
    if error:
        yield ('error', f'调用语言模型失败：{error}')
        return
    if trace is not None and isinstance(result, dict) and result.get('usage'):
        trace['usage'] = result['usage']
    text, calls = agent.parse_completion(result)
    if text:
        yield ('text', text)
    yield ('tool_calls', calls)


def agent_chat_responses(entry, messages, tools, trace=None):
    inputs, instructions = [], []
    for item in messages:
        role = item.get('role')
        if role == 'system':
            instructions.append(str(item.get('content') or ''))
            continue
        if role == 'tool':
            inputs.append({'type':'function_call_output','call_id':item['tool_call_id'],'output':str(item.get('content') or '')})
            continue
        if item.get('content'):
            inputs.append({'role':role,'content':str(item['content'])})
        for call in item.get('tool_calls') or []:
            fn=call.get('function') or {}
            inputs.append({'type':'function_call','call_id':call['id'],'name':fn.get('name') or '', 'arguments':fn.get('arguments') or '{}'})
    payload={'model':entry.get('model'),'input':inputs,'instructions':'\n\n'.join(instructions),'max_output_tokens':4096,'stream':False,'store':False}
    if tools:payload['tools']=[{'type':'function',**tool['function']} for tool in tools]
    result,_,error=request_json_candidates(endpoint_candidates(entry.get('baseUrl') or '', 'responses'),payload,
                                           headers=auth_headers(entry,extra={'Content-Type':'application/json'}),
                                           timeout=provider_timeout_value(entry,'textExec',90))
    if error:
        yield ('error',f'调用语言模型失败：{error}')
        return
    if trace is not None and isinstance(result,dict) and result.get('usage'):trace['usage']=result['usage']
    calls=[]
    for item in (result or {}).get('output') or []:
        if item.get('type')=='function_call':
            calls.append({'id':item.get('call_id') or item.get('id') or 'call_'+uuid.uuid4().hex[:12],
                          'name':item.get('name') or '', 'arguments':item.get('arguments') or '{}'})
        elif item.get('type')=='message':
            for block in item.get('content') or []:
                if block.get('type')=='output_text' and block.get('text'):yield ('text',block['text'])
    yield ('tool_calls',calls)


def agent_chat_plain(entry, messages, trace=None):
    """无工具兜底：把历史压成一段文本，单轮往返。"""
    lines = []
    for item in messages or []:
        role = str(item.get('role') or '')
        if role == 'system':
            continue
        content = item.get('content')
        if content:
            lines.append(f'[{role}] {content}')
    text, error = call_chat_completion(
        entry, [{'type': 'text', 'text': '\n'.join(lines)}], max_tokens=1500,
            timeout=provider_timeout_value(entry, 'textExec', 90), trace=trace)
    if error:
        yield ('error', f'调用语言模型失败：{error}')
        return
    yield ('text', text)
    yield ('tool_calls', [])


def resolve_film_scope(user, workspace, valid, incoming):
    """An empty draft has its own stable ID; never fall back to a shared film."""
    project_id = incoming.get('projectId')
    if not isinstance(project_id, str) or not project_id or len(project_id) > 100:
        raise ValueError('请先打开当前创作画布')
    row = next((p for p in read_projects() if p.get('id') == project_id), None)
    if row:
        if row.get('ownerId') != user['id'] or not in_workspace(row, workspace, valid):
            raise ValueError('成片对应项目不存在或没有编辑权限')
        return project_id, str(row.get('projectName') or '画布成片')
    if incoming.get('draft') is True and re.fullmatch(r'project-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}', project_id):
        return project_id, '新建画布'
    raise ValueError('成片对应项目不存在，请重新打开当前画布')


def film_material_in_project(row, project_id):
    return any(p.get('id') == project_id for p in row.get('projects', []) if isinstance(p, dict))


def import_film_workspace_materials(workspace, valid, project_key, project_name, ids, *, synchronize=False):
    if not isinstance(ids, list) or not (0 if synchronize else 1) <= len(ids) <= (5000 if synchronize else 50) or any(not isinstance(x, str) for x in ids):
        raise ValueError('每次请选择 1–50 项素材')
    with LOCK:
        catalog = build_catalog(workspace, read_projects(), read_assets(), read_music(),
            PREVIS_ASSETS.records() + read_models(), latest_jobs(limit=None),
            lambda item, wid: in_workspace(item, wid, valid), read_file(DATA_DIR / 'workspace-materials.json', {}))
        rows = {row['id']: row for row in catalog if film_material_in_project(row, project_key)}
    sync_rows = [{'id':r['id'],'name':r.get('name') or '素材','category':r.get('category',''),'rating':r.get('rating',0),'favorite':r.get('favorite',False)}
                 for r in rows.values() if r['id'] in ids]
    import tempfile
    with tempfile.TemporaryDirectory(prefix='film-import-', dir=DATA_DIR) as temp:
        files = []
        extensions = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp4', '.webm', '.mov', '.mp3', '.wav', '.m4a'}
        for identifier in dict.fromkeys(ids):
            row = rows.get(identifier)
            if synchronize and not row: continue
            if not row or row.get('kind') not in ('image', 'video', 'audio'):
                raise ValueError('所选素材不属于当前画布，或不是图片、视频、音频')
            source = str(row.get('url') or '')
            if source.startswith('/media/'):
                file = resolve_media_file(urlparse(source).path.rsplit('/', 1)[-1])
                if not file or file.suffix.lower() not in extensions: raise ValueError('素材文件不存在或格式不支持')
            elif source.startswith('data:'):
                header, _, body = source.partition(',')
                ext = {'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp', 'image/gif': '.gif', 'audio/mpeg': '.mp3', 'audio/wav': '.wav', 'video/mp4': '.mp4', 'video/webm': '.webm'}.get(header[5:].split(';')[0])
                if not ext or ';base64' not in header or len(body) > 140 * 1024 * 1024:
                    raise ValueError('该素材暂不支持导入，请先下载后在编辑器中导入')
                file = Path(temp) / (hashlib.sha256(identifier.encode()).hexdigest() + ext)
                file.write_bytes(base64.b64decode(body, validate=True))
            else:
                raise ValueError('该素材尚未保存到本地，请先下载后在编辑器中导入')
            name = str(row.get('name') or '素材').replace('/', '_').replace('\\', '_')[:100]
            if Path(name).suffix.lower() != file.suffix.lower(): name += file.suffix.lower()
            files.append({'path': str(file), 'name': name,'sourceId':identifier,
                'metadata':{'category':row.get('category'),'projects':row.get('projects'),'origins':row.get('origins'),
                            'rating':row.get('rating',0),'favorite':row.get('favorite',False)}})
        result = FILM_WORKBENCH.call(workspace, 'import', projectKey=project_key, projectName=project_name, files=files,
                                    **({'synchronize':True,'syncRows':sync_rows} if synchronize else {}))
    return result


def build_agent_ctx(user, canvas, brain, project_id='', anchor_node_id='', workspace_id='',
                    image_model_id='', video_model_id='', mode='', gen_mode='manual'):
    """组装 agent_runtime.execute_tool 需要的上下文（把服务端能力注入进去）。

    ★★★ `image_model_id` / `video_model_id` = 用户在对话面板「模型」页签里**显式指定**的生图/生视频模型
      （r838 之前这两个页签只做「如实展示」，行是不可点的，用户无法选择 —— 只能吃自动挑的那个）。
      **指定优先、但不静默回退**：指定了却不可用时，如实报「指定的模型不可用」，
      而不是偷偷换一个别的模型去生成（换了用户不知道，出来的东西跟预期不符更难查）。
    """
    def list_models():
        return [ai_model_public(item) for item in visible_ai_models(user.get('id')) if item.get('enabled') and provider_has_credentials(item)]

    def save_skill(name, description='', prompt=''):
        # 注入给 create_skill 工具用；运行时本身不碰文件
        skill, error = save_agent_skill(user.get('id'), name, description, prompt, source='agent')
        return (skill or {}), error

    def pick(kind, override_id=''):
        """挑一个「真能用」的模型：启用 + 有 Key + 用途匹配（i2t 另按视觉能力判定）。

        传了 `override_id` 就**只认它**（不在候选里 → 返回 None，由调用方决定怎么报错）。
        """
        def usable(item):
            if not (item.get('enabled') and provider_has_credentials(item)):
                return False
            return model_supports_vision(item) if kind == 'i2t' else model_has_usage(item, kind)
        candidates = visible_ai_models(user.get('id'))
        if override_id:
            return next((item for item in candidates if item.get('id') == override_id and usable(item)), None)
        return next((item for item in candidates if usable(item)), None)

    def generate_text(prompt):
        return agent_billed_call(user, brain, prompt, lambda trace: call_chat_completion(
            brain, [{'type': 'text', 'text': prompt}], max_tokens=1400,
            timeout=provider_timeout_value(brain, 'textExec', 90), trace=trace), max_tokens=1400)

    def generate_image(prompt, size, quality):
        entry = pick('t2i', image_model_id)
        if not entry:
            return None, (f'指定的图片模型不可用或没配全（{image_model_id}），请在「模型」面板里重新选一个'
                          if image_model_id else
                          '还没有启用中的生图模型，请先在设置里接入一个图片生成模型')
        return agent_billed_call(user, entry, prompt, lambda trace: call_image_generation(
            entry, prompt, size=size or '1024x1024',
            quality=quality if isinstance(quality, str) else None,
            timeout=provider_timeout_value(entry, 'imageExec', 300), trace=trace))

    def analyze_image(image, instruction):
        entry = pick('i2t') or brain
        validate_new_media(user['id'], image)
        return agent_billed_call(user, entry, instruction, lambda trace: call_chat_completion(
            entry, [{'type': 'text', 'text': instruction}, {'type': 'image_url', 'image_url': {'url': image}}],
            max_tokens=500, trace=trace), max_tokens=500)

    def submit_video(prompt, model_id, options):
        settings = {}
        # ★★★ r838：用户在「模型」面板里显式选的视频模型**优先于** Agent 自己传的 modelId。
        #   理由：面板选择是用户当下的明确意图，Agent 传的只是它自己的猜测 —— 让猜测盖掉用户选择，
        #   会出现「我在面板里选了 A，结果用 B 生成」这种无法解释的行为。
        #   （面板没选时，才轮到 Agent 传的 modelId，最后才是 create_video_job 的自动挑。）
        chosen = str(video_model_id or model_id or '').strip()
        if chosen:
            settings['modelId'] = chosen
        if options.get('aspectRatio'):
            settings['aspectRatio'] = str(options['aspectRatio'])[:20]
        if options.get('duration') is not None:
            settings['duration'] = options['duration']
        # videoMode 必须显式传：video_payload 在缺省时按「图生视频」处理，
        # 不传就会让纯提示词的提交死在「请先上传或连接一张参考图片」上。
        if options.get('videoMode'):
            settings['videoMode'] = str(options['videoMode'])[:20]
        # ★ r830：Agent 的 `submit_video` 工具也能带模式（认得出才传，认不出就走旧的 videoMode）。
        reference_mode = normalize_reference_mode(options.get('referenceMode'))
        if reference_mode:
            settings['referenceMode'] = reference_mode
        incoming = {'prompt': prompt, 'projectId': project_id, 'generationSettings': settings}
        reference = str(options.get('reference') or '')
        if reference:
            validate_new_media(user['id'], reference)
            incoming['referenceImages'] = [reference]
        job, failure = create_video_job(user, incoming, workspace_id)
        if failure:
            return None, failure.get('message') or failure.get('error')
        return job, None

    def resolve_node_image(node_id):
        working = agent.as_working_canvas(canvas)
        return str((working.images or {}).get(str(node_id)) or '')

    return {
        'canvas': agent.as_working_canvas(canvas),
        'film_brain_id': brain.get('id') if brain else None,
        'list_models': list_models,
        'generate_text': generate_text,
        'generate_image': generate_image,
        'analyze_image': analyze_image,
        'submit_video': submit_video,
        'resolve_node_image': resolve_node_image,
        'save_skill': save_skill,
        'anchorNodeId': str(anchor_node_id or ''),
        'mode': mode, 'genMode': gen_mode,
    }


def bind_film_agent(ctx, user, workspace, valid, film):
    if not isinstance(film, dict): return
    from film_services import service_handler
    FILM_WORKBENCH.callbacks[workspace] = service_handler(globals(),user,workspace,ctx.get('film_brain_id'))
    def target():
        return resolve_film_scope(user, workspace, valid, film)
    target()  # Reject an invalid target before an agent request starts.
    def call(name,args):
        key,title = target()
        if name == 'list_film_materials':
            query = str(args.get('query') or '').lower()[:100]
            offset = args.get('offset',0)
            if not isinstance(offset,int) or offset < 0: raise ValueError('分页起点无效')
            with LOCK:
                rows = build_catalog(workspace, read_projects(), read_assets(), read_music(),
                    PREVIS_ASSETS.records() + read_models(), latest_jobs(limit=None),
                    lambda item,wid: in_workspace(item,wid,valid),read_file(DATA_DIR / 'workspace-materials.json',{}))
            rows = [r for r in rows if film_material_in_project(r,key) and r.get('kind') in ('image','video','audio') and query in str(r.get('name') or '').lower()]
            return {'ok':True,'total':len(rows),'offset':offset,'pageSize':20,'materials':[
                {'id':r['id'],'name':str(r.get('name') or '')[:200],'kind':r['kind'],
                 'availableLocally':str(r.get('url') or '').startswith(('/media/','data:'))} for r in rows[offset:offset+20]]}
        if name == 'import_film_materials':
            result = import_film_workspace_materials(workspace,valid,key,title,args.get('materialIds'))
            return {'ok':True,'imported':result.get('imported',0)}  # Never pass the editor session URL/key to a model.
        if name == 'publish_film_output':
            return publish_film_output(user, workspace, key, title, args)
        if name in ('film_author','look_film','generate_film_media'):
            result = FILM_WORKBENCH.call(workspace,'advanced',projectKey=key,projectName=title,
                args={**args, **({'action':'look'} if name == 'look_film' else {})})
            if name == 'look_film':
                result['_images'] = ['data:'+p['mime']+';base64,'+p.pop('base64') for p in result.get('pictures',[])]
            return result
        operation = {'read_film':'inspect','edit_film':'edit','undo_film_edit':'undo'}.get(name)
        if not operation: raise ValueError('不支持的成片操作')
        return FILM_WORKBENCH.call(workspace,operation,projectKey=key,projectName=title,args=args)
    ctx['film_call'] = call


def publish_film_output(user, workspace, key, title, args):
    """Only opaque tokens minted for this linked film can enter the media store."""
    record = FILM_WORKBENCH.call(workspace,'output',projectKey=key,projectName=title,args={'token':args.get('token')})
    file = Path(record['file'])
    import mimetypes
    mime = mimetypes.guess_type(file.name)[0] or 'application/octet-stream'
    if not mime.startswith(('image/','video/','audio/')):
        return {'ok':True,'name':file.name,'message':'工程或字幕文件已导出，可在成片导出列表中打开；只有媒体文件可加入画布'}
    # An output token is stable for the running editor. Repeating a tool call does not duplicate an asset.
    if file.stat().st_size > MEDIA_MAX_BYTES: raise ValueError('导出文件超过素材大小上限，请从成片导出列表直接打开')
    content_hash = hashlib.sha256()
    with file.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024*1024), b''): content_hash.update(chunk)
    origin = 'film-output:' + hashlib.sha256((str(file.resolve()) + ':' + content_hash.hexdigest()).encode()).hexdigest()
    with LOCK:
        existing = next((a for a in read_assets() if a.get('filmOrigin') == origin and a.get('workspaceId') == workspace and a.get('ownerId') == user['id']),None)
    if existing:
        asset = existing
    else:
        if file.stat().st_size > MEDIA_MAX_BYTES: raise ValueError('导出文件超过素材大小上限，请从成片导出列表直接打开')
        media = save_media_blob(file.read_bytes(),mime,file.name,owner_id=user['id'])
        asset = {'id':'asset-'+uuid.uuid4().hex[:12],'name':file.name,'kind':media['kind'],
            'mediaId':media['mediaId'],'mediaUrl':media['url'],'size':str(media['size']),
            'ownerId':user['id'],'workspaceId':workspace,'projectId':key,'createdAt':now(),'origin':'generated','filmOrigin':origin,'hasPreview':True}
        with LOCK:
            assets = read_assets(); assets.append(asset); write_file(ASSETS_FILE,assets)
    effects = []
    if args.get('addToCanvas'):
        kind=asset['kind']; field={'image':'image','video':'video','audio':'audio'}.get(kind)
        if field: effects.append({'op':'create_node','nodeId':'node-'+uuid.uuid4().hex[:12],
            'type':{'video':'output'}.get(kind,kind),'title':asset['name'],'assetId':asset['id'],field:asset['mediaUrl'],field+'Name':asset['name']})
    return {'ok':True,'assetId':asset['id'],'name':asset['name'],'url':asset['mediaUrl'],'_effects':effects}


def sync_film_canvas(user,workspace,key,title,args):
    """Bridge the two canvases explicitly, keeping manual edits and never deleting unlinked nodes."""
    graph=args.get('graph') or {}
    if not isinstance(graph,dict) or not isinstance(graph.get('nodes',[]),list) or len(graph.get('nodes',[]))>500:
        raise ValueError('每次最多同步 500 个画布节点')
    if args.get('direction')=='from-film':
        result=FILM_WORKBENCH.call(workspace,'advanced',projectKey=key,projectName=title,args={'action':'canvas_read'})
        existing={n.get('id') for n in graph.get('nodes',[]) if isinstance(n,dict)}
        effects=[];mapped={}
        for n in result['canvas']['nodes']:
            node_id=result.get('links',{}).get(n['id']) or 'node-film-'+hashlib.sha256(n['id'].encode()).hexdigest()[:20];mapped[n['id']]=node_id
            effect={'op':'update_node' if node_id in existing else 'create_node','nodeId':node_id,'type':'prompt','title':'成片故事板','copy':n.get('text') or n.get('group') or n.get('path','')}
            if n.get('path'):
                if str(n['path']).lower().endswith(('.txt','.md')):
                    text_file=FILM_WORKBENCH.call(workspace,'advanced',projectKey=key,projectName=title,args={'action':'read','path':n['path']})
                    effect['copy']=text_file['text']
                    effects.append(effect)
                    continue
                output=FILM_WORKBENCH.call(workspace,'advanced',projectKey=key,projectName=title,args={'action':'asset_output','path':n['path']})
                media=publish_film_output(user,workspace,key,title,{'token':output['files'][0]['token'],'addToCanvas':True})
                if media.get('_effects'):
                    effect.update({k:v for k,v in media['_effects'][0].items() if k not in ('op','nodeId')})
            effects.append(effect)
        edges=[{'source':mapped[e['from']],'target':mapped[e['to']]} for e in result['canvas']['edges'] if e['from'] in mapped and e['to'] in mapped]
        if edges:effects.append({'op':'connect_nodes','edges':edges})
        return {'ok':True,'synced':len(mapped),'_effects':effects}
    import tempfile
    validate_new_media(user['id'],graph)
    with tempfile.TemporaryDirectory(prefix='film-sync-',dir=DATA_DIR) as temp:
        files=[];nodes=[]
        for n in graph.get('nodes',[]):
            if not isinstance(n,dict) or not n.get('id'):continue
            identifier=str(n['id'])[:100]
            nodes.append({'id':identifier,'x':n.get('left',0),'y':n.get('top',0),'text':str(n.get('title') or '')+'\n'+str(n.get('copy') or '')})
            source=n.get('videoUrl') or n.get('audioUrl') or n.get('previewMedia') or n.get('previewData') or ''
            if not source and n.get('previewAsset'):
                asset=next((a for a in read_assets() if a.get('id')==n['previewAsset'] and a.get('ownerId')==user['id'] and a.get('workspaceId')==workspace),None)
                if asset:source=asset.get('mediaUrl') or asset.get('data') or ''
            file=None
            if str(source).startswith('/media/'):file=resolve_media_file(str(source).split('/')[-1])
            elif str(source).startswith('data:'):
                mime,raw=decode_data_uri(source)
                if raw and mime.startswith(('image/','video/','audio/')):
                    file=Path(temp)/(hashlib.sha256(identifier.encode()).hexdigest()+media_ext(mime,''));file.write_bytes(raw)
            if file:files.append({'id':identifier,'path':str(file)})
        return FILM_WORKBENCH.call(workspace,'sync',projectKey=key,projectName=title,nodes=nodes,edges=graph.get('edges',[]),files=files)


def agent_billed_call(user, entry, prompt, callback, max_tokens=0):
    ACCOUNT_STORAGE.ensure(user['id'], 1)
    charge = open_generation_charge(user, entry, prompt_text=prompt, max_tokens=max_tokens, calls=1)
    trace = {}
    failed = True
    try:
        result, error = callback(trace)
        failed = bool(error)
        return result, error
    finally:
        settle_generation_charge(charge, trace.get('usage'), failed=failed, label=entry.get('name'))


def agent_billed_chat(user, entry, messages, tools):
    ACCOUNT_STORAGE.ensure(user['id'], 1)
    try:
        charge = open_generation_charge(user, entry, prompt_text=json.dumps(messages, ensure_ascii=False)+json.dumps(tools,ensure_ascii=False), max_tokens=4096, calls=1)
    except InsufficientCredits as error:
        yield 'error',str(error)
        return
    trace, failed = {}, False
    try:
        for kind, payload in agent_chat_stream(entry, messages, tools, trace=trace):
            if kind == 'error': failed = True
            yield kind, payload
    except GeneratorExit:
        # A client disconnect can follow upstream work. Settle once without
        # pretending the provider failed or refunding a completed request.
        raise
    except Exception:
        failed = True
        raise
    finally:
        settle_generation_charge(charge, trace.get('usage'), failed=failed, label=entry.get('name'))


class PayloadTooLarge(Exception): pass


class ClientGone(Exception):
    """SSE 客户端断开（关页面 / 切走）。用来中断推送，不作为错误上报。"""
    pass


from account_storage import AccountStorage, StorageError, media_ids, content_size


def storage_records():
    rows = []
    for kind, reader in [('project',read_projects),('asset',read_assets),('music',read_music),('model',read_models),
                         ('previs',PREVIS_ASSETS.records),('portfolio',PORTFOLIO.rows),('session',read_agent_sessions),('share',read_agent_shares),('skill',read_agent_skills)]:
        rows.extend((kind,dict(item,id=item.get('shareId'),name='对话分享',_storageBytes=content_size(item)) if kind=='share' else item)
                    for item in reader() if isinstance(item,dict))
    roles=read_preset_roles_raw()
    for owner,bucket in roles.get('users',{}).items():
        for item in bucket.get('custom',[]):rows.append(('role',dict(item,ownerId=owner)))
        for id,item in bucket.get('overrides',{}).items():rows.append(('role',dict(item,id=id,ownerId=owner)))
    settings=read_app_settings()
    rows.extend(('settings',dict(item,id=owner,ownerId=owner,name='账户生成设置')) for owner,item in settings.get('users',{}).items() if isinstance(item,dict))
    rows.extend(('settings',dict(item,name=item.get('name') or '供应商配置')) for item in read_ai_models() if item.get('ownerId'))
    jobs={};sizes={}
    if JOBS_FILE.exists():
        for line in JOBS_FILE.read_text(encoding='utf-8').splitlines():
            try:item=json.loads(line)
            except ValueError:continue
            if not isinstance(item,dict) or not item.get('id'):continue
            jobs[item['id']]=item;sizes[item['id']]=sizes.get(item['id'],0)+len(line.encode('utf-8'))+1
    rows.extend(('job',dict(item,_storageBytes=sizes[id])) for id,item in jobs.items())
    return rows


def remove_storage_record(kind,item_id,owner_id,expired_before=None):
    with LOCK, ACCOUNT_STORAGE.lock:
        if expired_before is not None:
            with auth_db() as db:
                row=db.execute('SELECT expires_at FROM content_retention WHERE kind=? AND item_id=? AND owner_id=?',(kind,item_id,owner_id)).fetchone()
            if not row or row[0]>expired_before:return False
        result=_remove_storage_record_locked(kind,item_id,owner_id)
        if expired_before is not None:
            with auth_db() as db:db.execute('DELETE FROM content_retention WHERE kind=? AND item_id=? AND owner_id=?',(kind,item_id,owner_id))
        return result


def _remove_storage_record_locked(kind,item_id,owner_id):
    if kind=='job':
        remaining=[]
        for line in JOBS_FILE.read_text(encoding='utf-8').splitlines() if JOBS_FILE.exists() else []:
            try:item=json.loads(line)
            except ValueError:
                remaining.append(line);continue
            if not (item.get('id')==item_id and (item.get('userId') or item.get('ownerId'))==owner_id):remaining.append(line)
        temp=JOBS_FILE.with_name(JOBS_FILE.name+'.'+uuid.uuid4().hex+'.tmp')
        try:temp.write_text('\n'.join(remaining)+('\n' if remaining else ''),encoding='utf-8');temp.replace(JOBS_FILE)
        finally:temp.unlink(missing_ok=True)
        return
    if kind=='role':
        stored=read_preset_roles_raw();bucket=stored.get('users',{}).get(owner_id,{})
        bucket['custom']=[item for item in bucket.get('custom',[]) if item.get('id')!=item_id]
        bucket.get('overrides',{}).pop(item_id,None);write_file(PRESET_ROLES_FILE,stored);return
    file={'asset':ASSETS_FILE,'music':MUSIC_FILE,'model':MODELS_FILE,'previs':PREVIS_ASSETS.file}.get(kind)
    if not file:raise StorageError('不支持删除这项内容')
    write_file(file,[row for row in read_file(file,[]) if not (str(row.get('id'))==item_id and row.get('ownerId')==owner_id)])


ACCOUNT_STORAGE = LocalStorage(MEDIA_DIR, auth_db, storage_records, remove_storage_record, AUTH_SECRET, USER_STORAGE_QUOTA_BYTES, expire_record=lambda kind,id,owner,stamp:remove_storage_record(kind,id,owner,expired_before=stamp))


def open_http_url(request,timeout=None):
    with auth_db() as db:
        administrators={row[0] for row in db.execute("SELECT id FROM users WHERE role='admin' AND status='active'")}
    trusted=set()
    for model in read_ai_models():
        # Local installation trusts its configured provider origins.
        try:trusted.add(http_origin(model.get('baseUrl') or ''))
        except urllib_error.URLError:pass
    if os.environ.get('OPENAI_BASE_URL'):
        try:trusted.add(http_origin(os.environ['OPENAI_BASE_URL']))
        except urllib_error.URLError:pass
    for name in ('HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','http_proxy','https_proxy','all_proxy'):
        if os.environ.get(name):
            try:trusted.add(http_origin(os.environ[name]))
            except urllib_error.URLError:pass
    with network_access(NETWORK_ROLE.get(),trusted):return guarded_open_http_url(request,timeout)


def validate_new_media(user_id,value,previous=None):
    previous_ids=previous if isinstance(previous,set) else media_ids(previous or {})
    signatures={}
    def collect(item):
        if isinstance(item,dict):
            for child in item.values():collect(child)
        elif isinstance(item,list):
            for child in item:collect(child)
        elif isinstance(item,str):
            if item.lstrip().startswith(('{','[')):
                try:collect(json.loads(item));return
                except (ValueError,RecursionError):pass
            for match in re.finditer(r'''/media/(media-[a-f0-9]{32}\.[a-z0-9]{1,5})\?([^\s"'<>]+)''',item):
                query=parse_qs(match[2]);signatures[match[1]]=(str((query.get('signature') or [''])[0]),str((query.get('expires') or [''])[0]))
    collect(value)
    for media_id in media_ids(value)-previous_ids:
        signature,expiry=signatures.get(media_id,('',''))
        if not ACCOUNT_STORAGE.can_read(media_id,user_id,signature,expiry):raise StorageError('内容引用了没有访问权限或已过期的文件',403)


def signed_media_payload(value):
    if isinstance(value,dict):return {key:signed_media_payload(child) for key,child in value.items()}
    if isinstance(value,list):return [signed_media_payload(child) for child in value]
    if not isinstance(value,str):return value
    if value.lstrip().startswith(('{','[')):
        try:return json.dumps(signed_media_payload(json.loads(value)),ensure_ascii=False)
        except (ValueError,RecursionError):pass
    return re.sub(r'/media/(media-[a-f0-9]{32}\.[a-z0-9]{1,5})(?![a-z0-9?])',lambda match:ACCOUNT_STORAGE.signed_url(match[1]),value)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs): super().__init__(*args, directory=str(PUBLIC_DIR), **kwargs)
    def setup(self):
        super().setup()
        self.connection.settimeout(30)
    def parse_request(self):
        if not super().parse_request():
            return False
        hosts = tuple(h.strip().lower() for h in os.environ.get('CANVASFLOW_ALLOWED_HOSTS', '').split(',') if h.strip())
        if not request_allowed(self.headers, self.command, self.server.server_address[1], hosts):
            self.close_connection = True
            self.send_json({'error': 'request_origin_denied', 'message': '请求来源不受信任'}, 403)
            return False
        path = unquote(urlparse(self.path).path).rstrip('/')
        if retired_route(path):
            self.close_connection = True
            self.send_json({'error': 'not_found', 'message': '本地版不提供此功能'}, 404)
            return False
        if self.headers.get('Transfer-Encoding'):
            self.close_connection = True
            self.send_json({'error': 'invalid_body', 'message': '请使用带明确长度的请求体'}, 400)
            return False
        return True
    def handle_one_request(self):
        STORAGE_ACTOR.set('')
        NETWORK_ROLE.set('user')
        try:
            return super().handle_one_request()
        except RequestBodyError as error:
            self.close_connection = True
            return self.send_json({'error': 'invalid_json', 'message': str(error)}, 400)
        except InsufficientCredits as error:
            return self.send_json(error.payload, 402)
        except NetworkAccessError as error:
            return self.send_json({'error':'network_access_denied','message':str(error)},error.status)
        except StorageError as error:
            return self.send_json({'error':'storage_error','message':str(error)},error.status)
        except ValueError as error:
            return self.send_json({'error':'invalid_model_parameters','message':str(error)},400)
        except StorageReadError as error:
            return self.send_json({'error': 'storage_unavailable', 'message': str(error)}, 503)
        except PayloadTooLarge:
            self.close_connection = True
            return self.send_json({'error': 'payload_too_large', 'message': '请求体超过 8MB 限制'}, 413)
        except sqlite3.OperationalError:
            return self.send_json({'error':'billing_unavailable','message':'账户服务暂不可用，请稍后重试；尚未提交生成请求。'},503)
        except sqlite3.IntegrityError:
            return self.send_json({'error':'record_conflict','message':'内容已被其他请求修改，请刷新后重试'},409)
    def log_message(self, fmt, *args): print(f'[CanvasFlow API] {self.address_string()} - {fmt % args}')
    def end_headers(self):
        # SSE 长连接不能带 no-store：部分代理会因此把整条流缓冲到结束才吐给浏览器。
        if not getattr(self, '_sse_mode', False):
            self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'same-origin')
        self.send_header('Cross-Origin-Resource-Policy', 'same-origin')
        self.send_header('X-Frame-Options', 'SAMEORIGIN')
        super().end_headers()
    def send_json(self, payload, status=200, headers=None):
        self._billing_response_status = status
        scope = GENERATION_REQUEST_CHARGE.get()
        if status >= 400 and scope and not scope.get('deferred'):
            settle_generation_charge(scope.get('charge'), failed=True)
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        for key, value in (headers or {}).items():
            self.send_header(key, value)
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)
    def client_ip(self):
        return str(self.client_address[0] if self.client_address else 'unknown')[:80]
    def session_token(self):
        raw = self.headers.get('Cookie') or ''
        try:
            cookie = SimpleCookie(); cookie.load(raw)
            morsel = cookie.get(SESSION_COOKIE)
            return morsel.value if morsel else ''
        except Exception:
            return ''
    def authenticated_user(self):
        self.auth_failure = None
        STORAGE_ACTOR.set(LOCAL_ID)
        NETWORK_ROLE.set('admin')
        return dict(LOCAL_CONTEXT)
    def model_scope_request(self, user, query=None):
        return 'global', None

    def auth_cookie(self, token='', clear=False):
        secure = str(os.environ.get('CANVASFLOW_SECURE_COOKIE') or '').lower() in {'1', 'true', 'yes'}
        parts = [f'{SESSION_COOKIE}={token}', 'Path=/', 'HttpOnly', 'SameSite=Lax']
        if clear:
            parts.extend(['Max-Age=0', 'Expires=Thu, 01 Jan 1970 00:00:00 GMT'])
        else:
            parts.append(f'Max-Age={30 * 24 * 60 * 60}')
        if secure:
            parts.append('Secure')
        return '; '.join(parts)
    def read_json(self):
        try: length = int(self.headers.get('Content-Length', 0))
        except (TypeError, ValueError): raise RequestBodyError('请求体长度无效')
        if length < 0: raise RequestBodyError('请求体长度无效')
        if length == 0: return {}
        if length > 8_000_000:
            self.close_connection = True
            raise PayloadTooLarge()
        try:
            raw = self.rfile.read(length)
            if len(raw) != length: raise RequestBodyError('请求体传输不完整')
            payload = json.loads(raw.decode('utf-8'), parse_constant=lambda value: (_ for _ in ()).throw(ValueError(value)))
            if not isinstance(payload, dict): raise RequestBodyError('请求体必须为 JSON 对象')
            pending=[(payload,0)]
            while pending:
                value,depth=pending.pop()
                if depth>64:raise RequestBodyError('请求内容嵌套过深')
                if isinstance(value,dict):pending.extend((child,depth+1) for child in value.values())
                elif isinstance(value,list):pending.extend((child,depth+1) for child in value)
                elif isinstance(value,float) and (value!=value or value in (float('inf'),float('-inf'))):
                    raise RequestBodyError('请求数值必须是有限数')
            return payload
        except (ValueError, UnicodeDecodeError, RecursionError) as error:
            raise RequestBodyError('请求体不是有效的 JSON 对象') from error
    def handle_media_upload(self):
        if not MEDIA_UPLOAD_SLOTS.acquire(blocking=False):
            self.close_connection = True
            return self.send_json({'error':'uploads_busy','message':'同时上传的文件过多，请稍后重试'},429,{'Retry-After':'2'})
        try:
            return self._handle_media_upload()
        finally:
            MEDIA_UPLOAD_SLOTS.release()

    def _handle_media_upload(self):
        """大文件（视频/音频）上传：收**原始二进制**，不走 read_json。

        为什么单独一条路：read_json 有 8MB 上限、还要过 base64 与 JSON，
        视频必然爆；而且它是被 _route_post 开头无脑调用的，body 会被提前吃掉。
        所以这里 **必须是全流程里第一个碰 body 的人**。

        返回 {media:{mediaId,url,kind,size,name}}，url 形如 /media/media-<uuid>.mp4。
        """
        user = self.authenticated_user()
        if not user:
            # 未登录也要把 body 排空，否则连接被重置，前端只看到网络错误看不到 401。
            self.drain_request_body()
            return self.send_json({'error': 'unauthenticated', 'message': '请先登录'}, 401)
        try:
            length = int(self.headers.get('Content-Length', 0))
        except (TypeError, ValueError):
            length = 0
        if length <= 0:
            return self.send_json({'error': 'empty_body', 'message': '没有收到文件内容'}, 400)
        if length > MEDIA_MAX_BYTES:
            self.drain_request_body()
            return self.send_json({'error': 'payload_too_large', 'message': f'文件超过 {MEDIA_MAX_BYTES // 1_000_000}MB 上限'}, 413)
        # 一次性读满。rfile 是已缓冲的 socket 文件对象，read(n) 会读够 n 字节或到 EOF，
        # 不需要自己写分块循环（之前的分块循环 + body 已被读走 = 永久阻塞）。
        raw = self.rfile.read(length)
        if len(raw) < length:
            return self.send_json({'error': 'incomplete_body', 'message': '文件传输中断，请重试'}, 400)
        mime = str(self.headers.get('X-Media-Type') or self.headers.get('Content-Type') or '').split(';')[0].strip()
        name = unquote(str(self.headers.get('X-Media-Name') or ''))
        try:
            from file_formats import validate_upload
            mime = validate_upload(raw, name, mime)
            saved = save_media_blob(raw, mime, name)
        except StorageError as exc:
            return self.send_json({'error':'storage_error','message':str(exc)},exc.status)
        except ValueError as exc:
            return self.send_json({'error': 'invalid_media', 'message': str(exc)}, 400)
        saved['name'] = name[:160] or saved['mediaId']
        return self.send_json({'media': saved}, 201)
    def drain_request_body(self):
        """把已声明长度的请求体读掉 —— 不读的话 keep-alive/HTTP 层会把它当成下一个请求，连接直接乱掉。"""
        try:
            length = int(self.headers.get('Content-Length', 0))
        except (TypeError, ValueError):
            length = 0
        if length <= 0:
            return
        # Denied uploads must not allocate or wait for attacker-controlled bodies.
        self.close_connection = True
    def find_project(self, project_id):
        return next((item for item in read_projects() if item.get('id') == project_id), None)
    def find_job(self, job_id, user_id=None, workspace_id=None, valid_ids=None):
        # 不传工作区时按调用者身份自行推导 —— 任务天然属于它所在的工作区，
        # 这样各处调用点不必逐个改造，也不会出现「在新工作区里翻到旧空间的任务」。
        if workspace_id is None and user_id:
            workspace_id, valid_ids = self.workspace_scope({'id': user_id})
        jobs = latest_jobs(user_id=user_id, limit=None, workspace_id=workspace_id, valid_ids=valid_ids)
        return next((job for job in jobs if job.get('id') == job_id), None)

    # ----- 工作区：本次请求作用在哪个空间 -----
    def request_workspace_id(self):
        return str(self.headers.get('X-Workspace-Id') or '').strip()[:80]

    def workspace_scope(self, user):
        """返回 (workspace_id, valid_ids)。

        前端没带 header（老客户端）或传了一个不属于自己的 id → 一律落到自己的默认工作区，
        所以升级后老页面照旧能看到自己的项目，不会变成空白。
        """
        valid = workspace_id_set()
        user_id = str((user or {}).get('id') or '')
        if not user_id:
            return '', valid
        fallback = ensure_default_workspace(user_id)
        wanted = self.request_workspace_id()
        if wanted and wanted != str(fallback.get('id')):
            hit = next((item for item in workspaces_for_user(user_id) if item.get('id') == wanted), None)
            if hit:
                return str(hit.get('id')), valid
        return str(fallback.get('id')), valid

    def scoped(self, items, workspace_id, valid):
        return [item for item in items if in_workspace(item, workspace_id, valid)]

    def workspace_list(self, user):
        """工作区列表 + 每个空间的内容计数（前端用来显示「N 个项目」并判断空空间）。

        故意不统计素材：assets.json 已经 150MB+，为了一个角标把它读进内存不值得。
        """
        ensure_default_workspace(user['id'])
        valid = workspace_id_set()

        def tally(items):
            counter = {}
            for item in items:
                key = item_workspace_id(item, valid)
                counter[key] = counter.get(key, 0) + 1
            return counter

        # 只统计「按空间隔离」的东西。技能不隔离，给它按空间计数只会给出误导性的数字。
        projects = tally(read_projects())
        sessions = tally(read_agent_sessions())
        ordered = sorted(workspaces_for_user(user['id']),
                         key=lambda i: (not i.get('isDefault'), str(i.get('createdAt') or '')))
        payload = []
        for item in ordered:
            view = workspace_view(item)
            key = str(item.get('id'))
            view['counts'] = {'projects': projects.get(key, 0), 'sessions': sessions.get(key, 0)}
            payload.append(view)
        return self.send_json({'workspaces': payload, 'currentId': self.workspace_scope(user)[0]})

    # ----- 对话式 Agent：SSE 输出 -----
    def start_sse(self):
        """开一条 SSE 长连接。

        本服务是 HTTP/1.0（SimpleHTTPRequestHandler 默认），没有 Content-Length 的响应
        以「连接关闭」作为结束标志 —— 正好符合流式语义，浏览器 fetch 的 reader 会边收边给。
        """
        self._sse_mode = True
        self.close_connection = True
        self.send_response(200)
        self.send_header('Content-Type', 'text/event-stream; charset=utf-8')
        self.send_header('Connection', 'close')
        self.send_header('X-Accel-Buffering', 'no')
        self.end_headers()
        # 先送一个注释行把响应头挤出去，否则某些浏览器会等满一个缓冲区才交给 JS。
        self.wfile.write(b': canvasflow-agent\n\n')
        self.wfile.flush()

    def send_sse(self, payload):
        try:
            self.wfile.write(f'data: {json.dumps(payload, ensure_ascii=False)}\n\n'.encode('utf-8'))
            self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, OSError):
            # 用户关掉页面/切走时连接会断，这不是错误，直接让上层停止推送。
            raise ClientGone()

    def agent_create_session(self, user, incoming):
        project_id = str(incoming.get('projectId') or '')[:100]
        stamp = now()
        workspace_id, _ = self.workspace_scope(user)
        session = {
            'id': agent.new_session_id(), 'userId': user['id'], 'workspaceId': workspace_id,
            'projectId': project_id, 'title': '新对话', 'messages': [], 'pendingAsk': None,
            'createdAt': stamp, 'updatedAt': stamp,
        }
        save_agent_session(session)
        return self.send_json({'session': agent_session_view(session, with_messages=True)}, 201)

    def agent_sessions_list(self, user):
        project_id = str(parse_qs(urlparse(self.path).query).get('projectId', [''])[0]).strip()
        workspace_id, valid = self.workspace_scope(user)
        items = [item for item in read_agent_sessions()
                 if item.get('userId') == user['id'] and in_workspace(item, workspace_id, valid)]
        if project_id:









            project_ids = {str(item.get('id') or '') for item in read_projects()}
            def belongs(item):
                owner = str(item.get('projectId') or '')
                return owner == project_id or not owner or owner not in project_ids
            items = [item for item in items if belongs(item)]
        items.sort(key=lambda item: str(item.get('updatedAt') or ''), reverse=True)
        return self.send_json({'sessions': [agent_session_view(item) for item in items[:100]], 'workspaceId': workspace_id})

    def agent_session_detail(self, user, session_id):
        session = find_agent_session(session_id, user['id'])
        workspace_id, valid = self.workspace_scope(user)
        if session and not in_workspace(session, workspace_id, valid):
            session = None  # 别的工作区的对话：当作不存在，而不是让它在这里被读到
        if not session:
            return self.send_json({'error': 'session_not_found', 'message': '对话不存在'}, 404)
        return self.send_json({'session': agent_session_view(session, with_messages=True)})

    def agent_session_rename(self, user, session_id, incoming):
        """重命名对话（照 LibTV 的 update-title）。

        三条规矩：
          - 上限 100 字，跟创建时记 projectId 的口径一致，别让标题把历史列表撑爆；
          - 空标题**不接受**（LibTV 的提交逻辑也是 `if(n && n!==原值)` 才发请求）——
            清了输入框按回车等于放弃，不该把标题改成空串；
          - 改完要动 updatedAt，否则列表按时间排序后它不往上走，用户会以为没生效。
        """
        name = str(incoming.get('title') or '').strip()[:100]
        if not name:
            return self.send_json({'error': 'invalid_title', 'message': '标题不能为空'}, 400)
        workspace_id, valid = self.workspace_scope(user)
        with LOCK:
            items = read_agent_sessions()
            target = None
            for item in items:
                if (item.get('id') == session_id and item.get('userId') == user['id']
                        and in_workspace(item, workspace_id, valid)):
                    target = item
                    break
            if not target:
                return self.send_json({'error': 'session_not_found', 'message': '对话不存在'}, 404)
            target['title'] = name
            target['updatedAt'] = now()
            write_agent_sessions(items)
        return self.send_json({'session': agent_session_view(target)})

    def agent_share_create(self, user, incoming):
        """为当前会话生成一条只读分享链接（照 LibTV 的 createProjectShare）。

        返回 {"shareId": ..., "url": "/share/<id>"}。url 用相对路径，让前端自己拼 origin
        —— 服务端口可能被换成 5174，硬编码 5173 会让链接指向一个没在跑的服务。
        """
        session_id = str(incoming.get('sessionId') or '').strip()
        if not session_id:
            return self.send_json({'error': 'no_session', 'message': '当前会话无法分享'}, 400)
        workspace_id, valid = self.workspace_scope(user)
        session = None
        for item in read_agent_sessions():
            if (item.get('id') == session_id and item.get('userId') == user['id']
                    and in_workspace(item, workspace_id, valid)):
                session = item
                break
        if not session:
            return self.send_json({'error': 'session_not_found', 'message': '对话不存在'}, 404)

        if not (session.get('messages') or []):
            return self.send_json({'error': 'no_message', 'message': '当前会话无消息，无法分享'}, 400)

        canvas = incoming.get('canvas') if isinstance(incoming.get('canvas'), dict) else {}
        validate_new_media(user['id'], canvas)
        for node in canvas.get('nodes') or []:
            if not isinstance(node, dict): continue
            asset_id = str(node.get('mediaAsset') or '')
            if asset_id:
                asset = next((row for row in read_assets() if row.get('id') == asset_id), None)
                if not asset or (asset.get('ownerId') != user['id'] and not asset.get('shared')):
                    return self.send_json({'error': 'forbidden', 'message': '分享引用了没有权限的素材'}, 403)
        # 画布只留「气质」不留全量：节点标题 + 类型 + 正文摘要 + 坐标，最多 40 个。
        # base64 预览图绝不能跟着快照走（一个素材节点就有几 MB），但坐标要带 ——
        # 分享页左边那块只读画布预览靠它排版，光有标题只能摊成一堆卡片。
        nodes = []
        for node in (canvas.get('nodes') or [])[:40]:
            if not isinstance(node, dict):
                continue
            item = {
                'id': str(node.get('id') or '')[:60],
                'type': str(node.get('type') or '')[:30],
                'title': str(node.get('title') or node.get('name') or '')[:80],
            }
            # 正文摘要是「卡片上要显示的那行字」。前端已经清洗过一遍，这里再兜一次：
            # 分享快照是公开的，任何形态的 base64 / data URI 都不该出现在里面。
            copy_text = _share_plain_text(node.get('copy'), 400)
            if copy_text:
                item['copy'] = copy_text
            # 媒体：分享页要能真的看到图片/视频，否则「分享画布」就只剩一堆空卡。
            # 只接受**服务端能自解释**的三类地址，其余（尤其 blob:）一律丢：
            #   /media/<file>   —— 本机落盘的大文件（视频走这条）
            #   http(s)://...   —— 供应商回的视频直链
            #   data:image/...  —— 小图内联（≤900KB，前端已限过一次，这里再卡一次）
            media_kind = str(node.get('mediaKind') or '')[:10]
            media_url = str(node.get('mediaUrl') or '').strip()
            if media_kind in ('image', 'video'):
                if media_url.startswith('/media/'):
                    item['mediaKind'], item['mediaUrl'] = media_kind, media_url[:300]
                elif media_url.startswith('data:image/') and len(media_url) <= 900_000:
                    item['mediaKind'], item['mediaUrl'] = media_kind, media_url
                elif re.match(r'^https?://', media_url, re.I):
                    item['mediaKind'], item['mediaUrl'] = media_kind, media_url[:600]
            media_asset = str(node.get('mediaAsset') or '').strip()[:100]
            if media_kind == 'image' and media_asset and not item.get('mediaUrl'):
                item['mediaKind'], item['mediaAsset'] = 'image', media_asset
            for key, cap in (('x', 1e7), ('y', 1e7), ('w', 4000), ('h', 4000)):
                try:
                    value = float(node.get(key))
                except (TypeError, ValueError):
                    continue
                if value != value or value in (float('inf'), float('-inf')):  # NaN / Inf
                    continue
                item[key] = int(max(-cap, min(cap, value)))
            nodes.append(item)
        # 连线：只要两端都在快照里的（前端已经筛过一遍，这里再兜一次 ——
        # 分享快照是公开的，不该出现指向不存在节点的线）
        valid_ids = {n['id'] for n in nodes if n['id']}
        edges = []
        for edge in (canvas.get('edges') or [])[:200]:
            if not isinstance(edge, dict):
                continue
            src = str(edge.get('from') or edge.get('source') or '')[:60]
            dst = str(edge.get('to') or edge.get('target') or '')[:60]
            if src and dst and src in valid_ids and dst in valid_ids:
                edges.append({'from': src, 'to': dst})
        payload = agent_share_payload(session, str(incoming.get('lastMessageId') or ''),
                                      {'nodeCount': len(canvas.get('nodes') or []),
                                       'nodes': nodes, 'edges': edges[:120]}, user)
        share_id = f"share-{uuid.uuid4().hex[:12]}"
        record = {'shareId': share_id, 'userId': user['id'], 'createdAt': now(), 'payload': payload}
        with LOCK:
            items = read_agent_shares()
            # 同一个人反复点分享不必每次都攒一份，但**不做去重**：
            # 用户可能改了内容想发一条新的，去重会把链接指向旧快照 —— 那才是真的坑。
            items.insert(0, record)
            write_agent_shares(items)
        return self.send_json({'shareId': share_id, 'url': f'/share/{share_id}',
                               'session': agent_session_view(session)}, 201)

    def agent_share_asset(self, share_id, asset_id):
        """按分享快照取素材图。**只放行该快照引用过的素材 id**（r684）。

        分享页没有登录态，够不到需要鉴权的 `/api/assets/<id>`；
        直接放公开又会把全部素材暴露给任意跨站请求。折中办法是拿快照本身当白名单 ——
        你把画布分享出去，就意味着分享页上的那张图别人能看，其余仍然看不了。
        """
        record = find_agent_share(share_id)
        if not record:
            return self.send_json({'error': 'share_not_found', 'message': '分享不存在或已失效'}, 404)
        asset_id = str(asset_id or '').strip()
        if not asset_id:
            return self.send_json({'error': 'asset_not_found'}, 404)
        canvas = (record.get('payload') or {}).get('canvas') or {}
        referenced = {str(node.get('mediaAsset') or '') for node in (canvas.get('nodes') or [])}
        if asset_id not in referenced:
            return self.send_json({'error': 'asset_not_found', 'message': '该素材不在本次分享里'}, 404)
        asset = next((item for item in read_assets() if item.get('id') == asset_id), None)
        if not asset:
            return self.send_json({'error': 'asset_not_found'}, 404)
        if asset.get('ownerId') != record.get('userId') and not asset.get('shared'):
            return self.send_json({'error': 'asset_not_found'}, 404)
        # 落盘素材直接 302 到 /media/<file>，让浏览器走图片直链（还能吃到长缓存）。
        media_id = str(asset.get('mediaId') or '').strip()
        if media_id and resolve_media_file(media_id):
            self.send_response(302)
            self.send_header('Location', ACCOUNT_STORAGE.signed_url(media_id))
            self.send_header('Cache-Control', 'public, max-age=3600')
            self.send_header('Content-Length', '0')
            self.end_headers()
            return
        data = str(asset.get('data') or '')
        if not data.startswith('data:'):
            return self.send_json({'error': 'asset_not_found', 'message': '素材没有可显示的内容'}, 404)
        return self.send_json({'asset': {'id': asset_id, 'data': data}})

    def agent_share_read(self, share_id):
        """读一份分享快照。**故意的公开接口**：分享的本意就是「谁拿到链接都能看」。

        所以这里不校验登录、不校验工作区 —— 校验了就等于只有自己能看到，
        那还不如把「分享」两个字摘掉。快照内容在生成时已经脱敏（见 share_message_view）。
        """
        record = find_agent_share(share_id)
        if not record:
            return self.send_json({'error': 'share_not_found', 'message': '分享不存在或已失效'}, 404)
        payload = record.get('payload') or {}
        canvas = payload.get('canvas') or {'nodeCount': 0, 'nodes': [], 'edges': []}
        for media_id in media_ids(canvas):
            if not ACCOUNT_STORAGE.can_read(media_id,record.get('userId') or ''):
                return self.send_json({'error':'share_media_unavailable','message':'分享中的文件已过期或没有访问权限'},404)
        return self.send_json({
            'shareId': record.get('shareId'),
            'createdAt': record.get('createdAt') or '',
            'title': payload.get('title') or '新对话',
            'mode': payload.get('mode') or '',
            'ownerName': payload.get('ownerName') or '',
            'messages': payload.get('messages') or [],
            'canvas': signed_media_payload(canvas),
        })

    def agent_session_delete(self, user, session_id):
        workspace_id, valid = self.workspace_scope(user)
        with LOCK:
            items = read_agent_sessions()
            remaining = [item for item in items
                         if not (item.get('id') == session_id and item.get('userId') == user['id']
                                 and in_workspace(item, workspace_id, valid))]
            if len(remaining) == len(items):
                return self.send_json({'error': 'session_not_found', 'message': '对话不存在'}, 404)
            write_agent_sessions(remaining)
        return self.send_json({'deleted': True, 'id': session_id})

    def agent_chat(self, user, incoming):
        key = (user['id'], str(incoming.get('sessionId') or ''))
        with LOCK:
            if key in AGENT_ACTIVE_SESSIONS:
                return self.send_json({'error': 'agent_busy', 'message': '这段对话正在处理中，请等待完成'}, 409)
            AGENT_ACTIVE_SESSIONS.add(key)
        try:
            return self._agent_chat_locked(user, incoming)
        finally:
            with LOCK: AGENT_ACTIVE_SESSIONS.discard(key)

    def _agent_chat_locked(self, user, incoming):
        """对话主入口：跑一轮 Agent，把过程以 SSE 推给前端。

        请求体：
          sessionId  — 会话 id；不传则新建
          message    — 用户这轮说的话（resume 时可为空）
          resume     — 从中断恢复：{'toolCallId':..., 'content':...}
          canvas     — 画布快照 {'projectId','nodes':[...],'edges':[...],'images':{nodeId:dataUri}}
          modelId    — 指定用哪个模型当大脑，可空
          imageModelId — 指定用哪个模型生图（对话面板「图片」页签选的），可空
          videoModelId — 指定用哪个模型生视频（对话面板「视频」页签选的），可空
          anchorNodeId — 用户当前选中的节点，用来决定新节点的落点与上游连线
          mode       — 对话模式（allround / script / directing），只影响系统提示词的侧重
          genMode    — 生成模式（manual / auto），控制有代价的操作要不要先问
        """
        session_id = str(incoming.get('sessionId') or '').strip()
        message = str(incoming.get('message') or '').strip()
        resume = incoming.get('resume') if isinstance(incoming.get('resume'), dict) else None
        canvas = incoming.get('canvas') if isinstance(incoming.get('canvas'), dict) else {}
        project_id = str(canvas.get('projectId') or incoming.get('projectId') or '')[:100]
        anchor_node_id = str(incoming.get('anchorNodeId') or '')[:100]
        mode = str(incoming.get('mode') or '')[:32]
        gen_mode = str(incoming.get('genMode') or '')[:32]

        workspace_id, valid = self.workspace_scope(user)
        if project_id:
            project = next((row for row in read_projects() if row.get('id') == project_id), None)
            if not project or project.get('ownerId') != user['id'] or not in_workspace(project, workspace_id, valid):
                return self.send_json({'error': 'project_not_found', 'message': '项目不存在或没有编辑权限'}, 404)

        session = find_agent_session(session_id, user['id']) if session_id else None
        if session and not in_workspace(session, workspace_id, valid): session = None
        if session_id and not session:
            return self.send_json({'error': 'session_not_found', 'message': '对话不存在'}, 404)
        if not session:
            stamp = now()
            session = {
                'id': agent.new_session_id(), 'userId': user['id'], 'workspaceId': workspace_id, 'projectId': project_id,
                'title': '新对话', 'messages': [], 'pendingAsk': None,

                'mode': mode, 'createdAt': stamp, 'updatedAt': stamp,
            }
        if not resume and not message:
            return self.send_json({'error': 'empty_message', 'message': '请先写下你想做什么'}, 400)
        if not resume and session.get('pendingAsk'):
            return self.send_json({'error': 'awaiting_answer', 'message': '上一轮还在等你的回答，请先选一个选项'}, 409)
        if resume:
            # resume 必须对得上「正在等的那次反问」。不校验的话，一个对不上的 toolCallId
            # 会往历史里塞一条**没有对应 assistant.tool_calls 的 tool 消息** ——
            # 真实供应商会因此拒掉**之后每一次**请求，这条会话就永久坏了。
            # （假网关不校验消息配对，所以这类问题在测试环境里看不出来。）
            # 前端也可能发出过期/错位的 toolCallId（比如刷新后点到旧卡片），所以这不是纯理论风险。
            pending = session.get('pendingAsk') or {}
            pending_id = str(pending.get('toolCallId') or '')
            given_id = str(resume.get('toolCallId') or '')
            if not pending_id:
                return self.send_json({'error': 'nothing_to_resume',
                                       'message': '这一轮没有在等回答，请直接发消息'}, 409)
            if given_id != pending_id:
                return self.send_json({'error': 'stale_resume',
                                       'message': '这个问题已经过期了（可能画布已刷新），请重新发送'}, 409)
            resume = {'toolCallId': pending_id, 'content': str(resume.get('content') or '')}
            if pending.get('generationApproval'):
                resume['generationApproval'] = pending['generationApproval']

        brain, brain_error = agent_resolve_model(str(incoming.get('modelId') or '').strip(), user['id'])
        if brain_error:
            self.start_sse()
            self.send_sse({'type': 'error', 'message': brain_error})
            self.send_sse({'type': 'done', 'sessionId': session['id']})
            return

        messages = json.loads(json.dumps(session.get('messages') or []))
        if not resume:
            messages.append({'role': 'user', 'content': message})
            if session.get('title') in (None, '', '新对话'):
                session['title'] = agent.session_title_from(message)
        messages = agent.trim_history(messages, keep=agent.HISTORY_KEEP)
        if project_id:
            session['projectId'] = project_id

        ctx = build_agent_ctx(user, canvas, brain, project_id=project_id, anchor_node_id=anchor_node_id,
                              workspace_id=self.workspace_scope(user)[0],
                              image_model_id=str(incoming.get('imageModelId') or '').strip()[:100],
                              video_model_id=str(incoming.get('videoModelId') or '').strip()[:100], mode=mode, gen_mode=gen_mode)
        if isinstance(incoming.get('film'),dict):
            if self.request_workspace_id() and self.request_workspace_id() != workspace_id:
                return self.send_json({'error':'workspace_not_found','message':'工作区不存在'},404)
            try: bind_film_agent(ctx,user,workspace_id,valid,incoming['film'])
            except ValueError as exc: return self.send_json({'error':'film_not_found','message':str(exc)},404)
        system = agent.build_system_prompt('CanvasFlow') + '\n\n' + agent.canvas_digest(ctx['canvas'])
        if ctx.get('film_call'): system += '\n\n' + agent.FILM_DIRECTIVE
        for directive in (agent.mode_directive(mode), agent.gen_mode_directive(gen_mode)):
            if directive:
                system = system + '\n\n' + directive

        first_quote=agent_chat_quote(user,incoming)
        if not first_quote['canAfford']:raise InsufficientCredits(first_quote['balance'],first_quote['requiredBalance'])
        self.start_sse()
        self.send_sse({'type':'billing_quote','quote':first_quote})
        self.send_sse({'type': 'session', 'sessionId': session['id'], 'title': session['title'],
                       'model': str(brain.get('name') or brain.get('model') or '')})
        interrupted = False
        pending_event = None
        try:
            for event in agent.run_agent_loop(
                messages=messages, chat=lambda m, t: agent_billed_chat(user, brain, m, t),
                ctx=ctx, system=system, resume=resume,
            ):
                if event.get('type') == 'ask':
                    interrupted = True
                    pending_event = event
                self.send_sse(event)
        except ClientGone:
            # 前端断了：这一轮的上下文仍然存下来，下次打开还能接着看。
            agent.repair_interrupted_tools(messages,pending_event['toolCallId'] if pending_event else '')
            session['messages'] = messages
            session['pendingAsk'] = ({'toolCallId': pending_event['toolCallId'], 'name': 'ask_user',
                                      **({'generationApproval': pending_event['generationApproval']} if pending_event.get('generationApproval') else {})} if pending_event else None)
            session['updatedAt'] = now()
            save_agent_session(session)
            return
        except Exception as exc:
            try:
                self.send_sse({'type': 'error', 'message': f'服务端异常：{type(exc).__name__}：{exc}'})
                self.send_sse({'type': 'done', 'sessionId': session['id']})
            except ClientGone:
                pass
            agent.repair_interrupted_tools(messages,pending_event['toolCallId'] if pending_event else '')
            session['messages'] = messages
            session['pendingAsk'] = ({'toolCallId':pending_event['toolCallId'],'name':'ask_user',
                                      **({'generationApproval':pending_event['generationApproval']} if pending_event.get('generationApproval') else {})} if pending_event else None)
            session['updatedAt'] = now()
            save_agent_session(session)
            return

        # 中断时记住在等哪个 toolCallId 的答案，刷新页面后前端才知道该渲染哪个卡片
        pending = None
        if interrupted:
            last = next((item for item in reversed(messages) if item.get('role') == 'assistant' and item.get('tool_calls')), None)
            answered = {item.get('tool_call_id') for item in messages if item.get('role') == 'tool'}
            for call in (last or {}).get('tool_calls') or []:
                if call.get('id') not in answered:
                    pending = {'toolCallId': call.get('id'), 'name': (call.get('function') or {}).get('name')}
                    break
            if pending and pending_event and pending_event.get('generationApproval'):
                pending['generationApproval'] = pending_event['generationApproval']
        session['messages'] = messages
        session['pendingAsk'] = pending
        session['updatedAt'] = now()
        save_agent_session(session)
        try:
            self.send_sse({'type': 'done', 'sessionId': session['id'], 'title': session['title'],
                           'awaiting': bool(pending),
                           # 上下文预算：前端拿它画「上下文剩余 N%」那个环
                           'context': {'used': len(session.get('messages') or []),
                                       'limit': agent.HISTORY_KEEP}})
        except ClientGone:
            pass

    def send_file_attachment(self, target, filename, content_type='application/octet-stream'):
        """Stream local downloads; HEAD sends metadata without allocating the file."""
        try:
            handle = target.open('rb')
        except OSError:
            return self.send_json({'error':'file_unavailable','message':'本地文件不存在或无法读取'},404)
        with handle:
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.send_header('Content-Length', str(os.fstat(handle.fileno()).st_size))
            safe_name = re.sub(r'[^A-Za-z0-9_.-]', '-', str(filename))[:160]
            self.send_header('Content-Disposition', 'attachment; filename="'+safe_name+'"')
            self.end_headers()
            if self.command == 'HEAD': return
            try:
                shutil.copyfileobj(handle, self.wfile, 1024 * 1024)
            except (OSError, ConnectionError):
                self.close_connection = True

    def send_video_download(self, job):
        """Proxy a completed provider video so downloads work for remote and data URLs."""
        video_url = str(job.get('videoUrl') or '').strip()
        if not video_url:
            return self.send_json({'error': 'video_not_ready', 'message': '该任务还没有可下载的视频'}, 409)
        filename = f"canvasflow-{str(job.get('id') or 'video')[-16:]}.mp4"
        content_type = 'video/mp4'
        # 老任务（落盘功能上线前生成的）手上还是供应商地址 —— 用户点下载说明他现在
        # 还在意这个视频，顺手落盘并把 job 回填掉，下次刷新画布就指向本地文件了。
        # 失败不拦下载：该代理转发照旧，用户至少拿得到这一次。
        if not video_url.startswith('/media/') and not video_url.startswith('data:'):
            if persist_job_video(job):
                video_url = job['videoUrl']
                append_job(job)   # 回填落盘结果，下次画布刷新就指向本地文件
            elif job.get('videoPersistError'):
                append_job(job)   # 保留供应商地址和可重试的落盘失败原因
        if video_url.startswith('/media/'):
            media_name=urlparse(video_url).path.rsplit('/',1)[-1];query=parse_qs(urlparse(video_url).query)
            if not ACCOUNT_STORAGE.can_read(media_name,STORAGE_ACTOR.get(),str((query.get('signature') or [''])[0]),str((query.get('expires') or [''])[0])):
                return self.send_json({'error':'media_forbidden','message':'媒体文件已过期或没有访问权限'},403)
            target = resolve_media_file(media_name)
            if target:
                return self.send_file_attachment(target,filename,mimetypes.guess_type(target.name)[0] or content_type)
        response_started = False
        try:
            if video_url.startswith('data:'):
                header, encoded = video_url.split(',', 1)
                if ';base64' in header:
                    body = base64.b64decode(encoded, validate=False)
                else:
                    body = unquote(encoded).encode('utf-8')
                if header.startswith('data:') and ';' in header:
                    content_type = header[5:].split(';', 1)[0] or content_type
                if len(body) > 250 * 1024 * 1024:
                    return self.send_json({'error': 'video_too_large', 'message': '视频文件过大，暂不支持下载'}, 413)
                self.send_response(200)
                self.send_header('Content-Type', content_type)
                self.send_header('Content-Length', str(len(body)))
                self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
                self.end_headers()
                response_started = True
                self.wfile.write(body)
                return
            request = urllib_request.Request(video_url, headers={'Accept': 'video/*,*/*;q=0.8', 'User-Agent': 'CanvasFlow/1.0'})
            with open_http_url(request, timeout=120) as response:
                content_type = response.headers.get_content_type() or content_type
                # Validate the bounded body before promising a successful attachment.
                # The fallback must not reintroduce the truncated-file bug after persistence fails.
                body = read_upstream_response(response, MEDIA_FETCH_MAX_BYTES)
                if not body:
                    raise ValueError('远端媒体内容为空')
                self.send_response(200)
                self.send_header('Content-Type', content_type)
                self.send_header('Content-Length', str(len(body)))
                self.send_header('Content-Disposition', f'attachment; filename="{filename}"')
                self.end_headers()
                response_started = True
                self.wfile.write(body)
                return
        except (ValueError, base64.binascii.Error, urllib_error.HTTPError, urllib_error.URLError, TimeoutError, OSError) as exc:
            if response_started:
                self.close_connection = True
                return None
            if not self.wfile.closed:
                try: return self.send_json({'error': 'video_download_failed', 'message': f'视频下载失败：{exc}'}, 502)
                except (BrokenPipeError, ConnectionResetError): return None
            return None
    def do_HEAD(self):
        # 视频播放器（尤其 Safari）会先拿 HEAD 探一下：有没有、多大、支不支持 Range。
        # 没有这个入口时 SimpleHTTPRequestHandler 会把它当静态文件找，落到 server-data
        # 的拦截路径上，浏览器拿到 404 后常常直接放弃播放。
        # GET 那条路已经处理了 HEAD（只发头不发体），复用即可。
        return self.do_GET()

    def learn_api_stub(self, raw_path):
        # 读 POST 体（原样字符串，含 域名/语言 等字段）→ 在夹具清单里按 [方法+路径+体] 精确匹配，
        # 退而按 [方法+路径] 取第一条；都没有 → 通用成功壳（data=null，页面端各处均有空兜底）。
        try:
            length = int(self.headers.get('Content-Length') or 0)
        except (TypeError, ValueError):
            length = 0
        if length < 0: raise RequestBodyError('请求体长度无效')
        if length > 8_000_000:
            self.close_connection = True
            raise PayloadTooLarge()
        body = self.rfile.read(length).decode('utf-8', 'replace') if length else ''
        method = (self.headers.get('X-HTTP-Method-Override') or self.command or 'POST').upper()
        path = raw_path[len('/learnapi'):] or '/'
        if method == 'OPTIONS':
            self.send_response(204)
            self.send_header('Content-Length', '0')
            self.end_headers()
            return
        matched = None
        with LOCK:
            try:
                fixtures = json.loads(LEARN_API_FIXTURES_FILE.read_text(encoding='utf-8'))
            except (OSError, ValueError):
                fixtures = []
        for item in fixtures:
            if item.get('method', 'POST').upper() == method and item.get('path') == path and (item.get('body') or '') == body:
                matched = item
                break
        if matched is None:
            for item in fixtures:
                if item.get('method', 'POST').upper() == method and item.get('path') == path:
                    matched = item
                    break
        payload = matched.get('response') if matched else None
        if not payload:
            payload = json.dumps({'code': 200, 'data': None, 'msg': '获取成功'}, ensure_ascii=False)
        data = payload.encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        if self.command != 'HEAD': self.wfile.write(data)

    def learn_static(self, path):
        # ★ 分支顺序**必须**先判 /learn/assets/ 与 /assets/（资产文件），再判 /learn/*（SPA fallback）。
        #   反过来会让所有 JS/CSS 请求拿到 index.html——应用静默起不来、canvas 黑屏（踩过，r914 修正）。
        # /learn/assets/<file> → learn/assets/<file>（允许一层 images/ 子目录）；
        # /assets/<file> 是兜底别名：实测 Chrome 对部分 modulepreload 投机请求仍会按根路径发
        # （initiator=about:client，文档里并无根路径标签）——按 learn/assets 解析即可。
        # ★ 主应用（index.html/app.js）不使用 /assets/ 前缀，无冲突；文件不存在照旧 404。
        if path.startswith('/learn/assets/') or path.startswith('/assets/'):
            rel = path[len('/learn/assets/'):] if path.startswith('/learn/assets/') else path[len('/assets/'):]
            parts = [p for p in rel.split('/') if p]
            if not parts or len(parts) > 6 or any(p in ('.', '..') for p in parts) \
                    or any(not re.fullmatch(r'[A-Za-z0-9._-]+', p) for p in parts):
                return self.send_json({'error': 'not_found'}, 404)
            target = LEARN_DIR.joinpath('assets', *parts)
            # App motion presets also use /assets/. Prefer an actual public app resource.
            if path.startswith('/assets/'):
                application_asset = PUBLIC_DIR.joinpath('assets', *parts)
                if PUBLIC_FILES.allowed(application_asset) and application_asset.is_file():
                    target = application_asset
            # r916：本地开发服务，资源改 no-cache —— chunk/夹具更新后浏览器不会拿旧文件（踩过）。
            cache = 'no-cache'
        else:
            # /learn/*（SPA fallback：/learn/zh-CN 等路由深链接一律出 index.html，交给 Vue 路由）。
            # /learn/<name>.html：learn/ 下真实存在的文件直接出（如 site-snapshot.html 快照入口）。
            tail = path[len('/learn/'):] if path.startswith('/learn/') and len(path) > len('/learn/') else ''
            direct = LEARN_DIR / tail if tail and re.fullmatch(r'[A-Za-z0-9._-]+\.html', tail) else None
            if direct and direct.is_file():
                target, cache = direct, 'no-store'
            else:
                target, cache = LEARN_DIR / 'index.html', 'no-store'
        if not PUBLIC_FILES.allowed(target) or not target.is_file():
            return self.send_json({'error': 'not_found'}, 404)
        mime = mimetypes.guess_type(target.name)[0] or 'application/octet-stream'
        if target.suffix == '.js':
            mime = 'text/javascript; charset=utf-8'
        elif target.suffix == '.css':
            mime = 'text/css; charset=utf-8'
        elif target.suffix == '.html':
            mime = 'text/html; charset=utf-8'
        try:
            body = target.read_bytes()
        except OSError:
            return self.send_json({'error': 'not_found'}, 404)
        self.send_response(200)
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', cache)
        self.end_headers()
        if self.command != 'HEAD': self.wfile.write(body)

    def blender_api(self, path, method):
        user=self.authenticated_user()
        if not user:return self.send_json({'error':'unauthenticated'},401)
        workspace=self.workspace_scope(user)[0]
        try:
            if method=='GET' and path=='/api/blender/status':
                return self.send_json(BLENDER_BRIDGE.status())
            if method=='GET' and path=='/api/blender/examples':
                from blender_examples import table_plan, refine_table_plan
                return self.send_json({'table':table_plan(),'refine':refine_table_plan()})
            if method=='PUT' and path=='/api/blender/settings':
                return self.send_json(BLENDER_BRIDGE.configure(self.read_json()))
            if path=='/api/blender/jobs':
                if method=='GET':return self.send_json({'jobs':BLENDER_BRIDGE.jobs(workspace)})
                if method=='POST':return self.send_json({'job':BLENDER_BRIDGE.submit(self.read_json(),workspace)},202)
            parts=path.split('/')
            if method=='GET' and len(parts)==5 and parts[3]=='jobs':
                return self.send_json({'job':BLENDER_BRIDGE.public(BLENDER_BRIDGE.job(parts[4],workspace))})
            if method=='GET' and len(parts)==6 and parts[3]=='jobs' and parts[5]=='download':
                kind=(parse_qs(urlparse(self.path).query).get('format') or ['blend'])[0]
                wanted=(parse_qs(urlparse(self.path).query).get('workspace') or [workspace])[0]
                if wanted not in {str(w.get('id')) for w in workspaces_for_user(user['id'])}:
                    raise LookupError('建模任务不存在')
                artifact=BLENDER_BRIDGE.artifact(parts[4],wanted,kind)
                return self.send_file_attachment(artifact,'CanvasFlow-model.'+kind)
        except BlenderUnavailable as error:return self.send_json({'error':'blender_unavailable','message':str(error)},503)
        except LookupError as error:return self.send_json({'error':'blender_job_not_found','message':str(error)},404)
        except (ValueError,TypeError) as error:return self.send_json({'error':'invalid_blender_request','message':str(error)},400)
        return self.send_json({'error':'not_found'},404)

    def previs_assets_api(self, path, method, incoming=None):
        user = self.authenticated_user()
        if not user:
            return self.send_json({'error':'unauthenticated','message':'请先登录'},401)
        incoming = incoming if isinstance(incoming,dict) else {}
        parts = path.split('/')
        workspace_id, valid_ids = self.workspace_scope(user)
        try:
            with LOCK:
                if method == 'GET' and path == '/api/previs/assets':
                    library = PREVIS_ASSETS.library(user['id'])
                    library['assets'] = [row for row in library['assets'] if in_workspace(row, workspace_id, valid_ids)]
                    return self.send_json(library)
                if method == 'POST' and path == '/api/previs/assets':
                    validate_new_media(user['id'],incoming)
                    obj = incoming.get('object')
                    if isinstance(obj, dict) and obj.get('modelUrl'):
                        from file_formats import validate_model_file
                        match = re.fullmatch(r'/media/(media-[a-f0-9]{32}\.(?:glb|bin))', str(obj['modelUrl']))
                        file = resolve_media_file(match[1]) if match else None
                        if not file: raise ValueError('模型文件不存在，请重新上传')
                        validate_model_file(file, allow_gltf=file.suffix == '.bin')
                    local_owner={**user,'workspaceId':workspace_id}
                    return self.send_json({'asset':PREVIS_ASSETS.create(local_owner,incoming)},201)
                if method == 'PUT' and len(parts)==5 and parts[3]=='assets':
                    previous=next((row for row in PREVIS_ASSETS.records() if row.get('id')==parts[4] and row.get('ownerId')==user['id']),None)
                    if previous is None or not in_workspace(previous, workspace_id, valid_ids):
                        raise LookupError('资产不存在或不属于当前工作区')
                    validate_new_media(user['id'],incoming,previous)
                    return self.send_json({'asset':PREVIS_ASSETS.update(user['id'],parts[4],incoming)})
                if method == 'POST' and len(parts)==6 and parts[5]=='share':
                    return self.send_json({'model':PREVIS_ASSETS.share(user['id'],parts[4])})
                if method == 'POST' and len(parts)==5 and parts[2]=='models' and parts[4]=='favorite':
                    return self.send_json({'model':PREVIS_ASSETS.favorite(user['id'],parts[3],incoming.get('favorite'))})
        except LookupError as error:
            return self.send_json({'error':'asset_not_found','message':str(error)},404)
        except StorageError as error:
            return self.send_json({'error':'storage_error','message':str(error)},error.status)
        except (ValueError,TypeError) as error:
            return self.send_json({'error':'invalid_asset','message':str(error)},400)
        return self.send_json({'error':'not_found'},404)

    def community_share_api(self, path, incoming):
        user = self.authenticated_user()
        if not user: return self.send_json({'message':'请先登录'},401)
        parts = path.split('/')
        kind = parts[4] if len(parts)>4 else ''
        item_id = parts[5] if len(parts)>5 else ''
        if kind not in ('projects','images','videos','music','models'):
            return self.send_json({'message':'分享类型无效'},400)
        file = {'projects':PROJECTS_FILE,'images':ASSETS_FILE,'videos':ASSETS_FILE,'music':MUSIC_FILE,'models':MODELS_FILE}[kind]
        workspace = self.workspace_scope(user)[0]
        try:
            with LOCK:
                rows = read_file(file,[])
                existing = next((item for item in rows if item.get('id')==item_id),None) if item_id else None
                if item_id and existing is None: raise CommunityShareError('分享内容不存在',404)
                if existing and kind in ('images','videos') and existing.get('kind') != ('image' if kind=='images' else 'video'):
                    raise CommunityShareError('素材类型不匹配')
                source_asset = None
                if kind=='models' and incoming.get('assetId'):
                    source_asset = next((a for a in PREVIS_ASSETS.records() if a.get('id')==incoming['assetId'] and a.get('ownerId')==user['id']),None)
                    if source_asset is None: raise CommunityShareError('模型资产不存在或无编辑权限',403)
                    linked = next((m for m in rows if m.get('id')==source_asset.get('sharedModelId') and m.get('ownerId')==user['id']),None)
                    existing = linked or {k:source_asset[k] for k in ('object','assetType','ownerId','thumbnail','cover') if k in source_asset}
                saved = prepare_share(kind,incoming,user,existing,resolve_media_file,clean_project,now(),workspace)
                if source_asset: saved['sourceAssetId']=source_asset['id']
                validate_new_media(user['id'],saved,existing)
                if existing and existing in rows: rows[rows.index(existing)] = saved
                else: rows.insert(0,saved)
                write_file(file,rows)
                if kind=='models' and saved.get('sourceAssetId'):
                    private = PREVIS_ASSETS.records()
                    for asset in private:
                        if asset.get('id')==saved['sourceAssetId'] and asset.get('ownerId')==user['id']:
                            asset['sharedModelId']=saved['id']
                            for key in ('name','description','thumbnail','object','updatedAt'):
                                if key in saved: asset[key]=saved[key]
                    write_file(PREVIS_ASSETS.file,private)
            return self.send_json({'item':saved},200 if existing else 201)
        except StorageError as error:
            return self.send_json({'message':str(error)},error.status)
        except CommunityShareError as error:
            return self.send_json({'message':str(error)},error.status)
        except (ValueError,TypeError) as error:
            return self.send_json({'message':str(error)},400)

    def previs_share_api(self,path,method):
        parts=path.split('/');project_id=parts[4] if len(parts)>4 else ''
        query=parse_qs(urlparse(self.path).query);node_id=str((query.get('node') or [''])[0])
        user=self.authenticated_user()
        incoming=self.read_json() if method=='PUT' else {}
        try:
            with LOCK:
                if method=='GET' and parts[-1]=='view':
                    payload=PREVIS_SHARING.view(project_id,node_id,user,str((query.get('share') or [''])[0]))
                    return self.send_json(signed_media_payload(payload))
                if method=='GET' and parts[-1]=='share':
                    return self.send_json(PREVIS_SHARING.info(project_id,node_id,user))
                if method=='PUT' and parts[-1]=='share':
                    return self.send_json(PREVIS_SHARING.update(project_id,node_id,user,incoming.get('access') if isinstance(incoming,dict) else None))
        except ShareDenied as error:
            return self.send_json({'error':'previs_share_denied','message':error.message},error.status)
        return self.send_json({'error':'not_found'},404)

    def notifications_api(self, path, method):
        user = self.authenticated_user()
        if not user: return self.send_json({'error':'unauthenticated','message':'请先登录'},401)
        admin = path.startswith('/api/admin/notifications')
        if admin and user.get('role') != 'admin': return self.send_json({'error':'forbidden','message':'需要管理员权限'},403)
        try:
            if method == 'GET':
                payload = {'notifications':PLATFORM_NOTIFICATIONS.list()}
                if not admin: payload['firstPopupSeen'] = PLATFORM_NOTIFICATIONS.acknowledged(user)
                return self.send_json(payload)
            if path == '/api/notifications/ack' and method == 'POST':
                incoming = self.read_json()
                if not isinstance(incoming, dict): raise NotificationError('通知确认内容无效')
                return self.send_json({'firstPopupSeen':PLATFORM_NOTIFICATIONS.acknowledge(user,incoming.get('ids'))})
            item_id = path.split('/')[-1] if path != '/api/admin/notifications' else None
            if method == 'POST' and item_id is None:
                return self.send_json({'notification':PLATFORM_NOTIFICATIONS.save(user,self.read_json())},201)
            if method == 'PUT' and item_id:
                return self.send_json({'notification':PLATFORM_NOTIFICATIONS.save(user,self.read_json(),item_id)})
            if method == 'DELETE' and item_id:
                PLATFORM_NOTIFICATIONS.delete(user,item_id)
                return self.send_json({'deleted':True,'id':item_id})
            return self.send_json({'error':'not_found'},404)
        except NotificationError as error:
            return self.send_json({'error':'notification_error','message':str(error)},error.status)

    def portfolio_api(self, path, method):
        try:
            if method == 'GET' and re.fullmatch(r'/api/portfolio/public/[A-Za-z0-9_-]{1,100}', path):
                owner_id = path.rsplit('/',1)[-1]
                with auth_db() as db:
                    owner = db.execute('SELECT nickname,avatar FROM users WHERE id=?', (owner_id,)).fetchone()
                if not owner: return self.send_json({'error':'not_found','message':'作品集不存在'},404)
                return self.send_json({'owner':{'name':owner['nickname'],'avatar':owner['avatar']},'works':PORTFOLIO.list(owner_id,own=False)})
            user = self.authenticated_user()
            if not user: return self.send_json({'error':'unauthenticated','message':'请先登录'},401)
            if path == '/api/portfolio' and method == 'GET':
                return self.send_json({'works':PORTFOLIO.list(user['id']),'ownerId':user['id']})
            if path == '/api/portfolio/sources' and method == 'GET':
                return self.send_json({'sources':PORTFOLIO.sources(user['id'])})
            if path == '/api/portfolio' and method == 'POST':
                return self.send_json({'work':PORTFOLIO.save(user,self.read_json())},201)
            if path == '/api/portfolio/reorder' and method == 'PUT':
                PORTFOLIO.reorder(user['id'],self.read_json().get('ids'))
                return self.send_json({'works':PORTFOLIO.list(user['id'])})
            if re.fullmatch(r'/api/portfolio/work-[a-f0-9]{16}',path):
                item_id = path.rsplit('/',1)[-1]
                if method == 'PUT': return self.send_json({'work':PORTFOLIO.save(user,self.read_json(),item_id)})
                if method == 'DELETE':
                    PORTFOLIO.delete(user['id'],item_id)
                    return self.send_json({'deleted':True})
            return self.send_json({'error':'not_found'},404)
        except PortfolioError as error:
            return self.send_json({'error':'portfolio_error','message':str(error)},error.status)

    def storage_api(self,path,method):
        user=self.authenticated_user()
        if not user:return self.send_json({'error':'unauthenticated','message':'请先登录'},401)
        try:
            if re.fullmatch(r'/api/admin/users/[^/]+/storage',path):
                if user.get('role')!='admin':return self.send_json({'error':'forbidden','message':'只有管理员可以调整空间配额'},403)
                target=path.split('/')[-2]
                with auth_db() as db:
                    if not db.execute('SELECT id FROM users WHERE id=?',(target,)).fetchone():return self.send_json({'error':'not_found'},404)
                    if method=='PUT':ACCOUNT_STORAGE.set_quota(target,self.read_json().get('quotaBytes'),db)
                    elif method!='GET':return self.send_json({'error':'not_found'},404)
                return self.send_json({'storage':user_storage_view(target)})
            if path=='/api/storage/items' and method=='GET':
                return self.send_json({'items':ACCOUNT_STORAGE.items(user['id']),'storage':user_storage_view(user['id'])})
            if path=='/api/storage/renew' and method=='POST':
                result=ACCOUNT_STORAGE.renew(user['id'],str(self.read_json().get('id') or ''))
                return self.send_json(result)
            if path=='/api/storage/delete' and method=='POST':
                ACCOUNT_STORAGE.delete(user['id'],str(self.read_json().get('id') or ''))
                return self.send_json({'deleted':True,'storage':user_storage_view(user['id'])})
            if path=='/api/storage/share' and method=='POST':
                media_id=str(self.read_json().get('mediaId') or '')
                row=ACCOUNT_STORAGE.file_row(media_id)
                if not row or row['ownerId']!=user['id']:raise StorageError('只能分享自己的文件',403)
                if not ACCOUNT_STORAGE.can_read(media_id,user['id']):raise StorageError('文件已过期或已删除',410)
                return self.send_json({'url':ACCOUNT_STORAGE.signed_url(media_id),'validSeconds':3600})
            return self.send_json({'error':'not_found'},404)
        except StorageError as error:return self.send_json({'error':'storage_error','message':str(error)},error.status)

    def workspace_materials_api(self, path, method):
        user = self.authenticated_user()
        workspace_id, valid = self.workspace_scope(user)
        metadata_file = DATA_DIR / 'workspace-materials.json'
        with LOCK:
            categories_file = DATA_DIR / 'workspace-material-categories.json'
            saved_categories = read_file(categories_file,{})
            categories = category_list(workspace_id,saved_categories)
            metadata = read_file(metadata_file, {})
            def material_catalog(include_deleted=False):
                result=build_catalog(workspace_id, read_projects(), read_assets(), read_music(),
                    PREVIS_ASSETS.records() + read_models(), latest_jobs(limit=None),
                    lambda item, wid: in_workspace(item, wid, valid), metadata, include_deleted=include_deleted)
                allowed={row['id'] for row in categories}
                for row in result:
                    if row['category'] not in allowed:row['category']=''
                return result
            category_base='/api/workspace/materials/categories'
            if path == category_base or path.startswith(category_base+'/'):
                category_id=path[len(category_base):].strip('/')
                hit=next((row for row in categories if row['id']==category_id),None)
                if category_id and not hit:return self.send_json({'error':'category_not_found','message':'当前工作区中没有这个标签'},404)
                if method == 'GET':return self.send_json({'categories':categories,'workspaceId':workspace_id})
                if method == 'DELETE' and hit:
                    catalog=material_catalog()
                    affected=[row['id'] for row in catalog if row['category']==category_id]
                    bucket=metadata.setdefault(workspace_id,{})
                    for value in bucket.values():
                        if isinstance(value,dict) and value.get('category')==category_id:value['category']=''
                    for material_id in affected:bucket[material_id]={**bucket.get(material_id,{}),'category':''}
                    write_file(metadata_file,metadata)
                    rows=[row for row in saved_categories.get(workspace_id,[]) if row.get('id')!=category_id]
                    if hit['builtin']:rows.append({'id':category_id,'name':hit['name'],'deleted':True})
                    saved_categories[workspace_id]=rows
                    write_file(categories_file,saved_categories)
                    return self.send_json({'deleted':category_id,'affected':len(affected),'categories':category_list(workspace_id,saved_categories),'workspaceId':workspace_id})
                if not ((method=='POST' and not category_id) or (method=='PUT' and hit)):
                    return self.send_json({'error':'method_not_allowed'},405)
                incoming=self.read_json()
                name=str(incoming.get('name') or '').strip()
                if not name or len(name)>40 or name in ('全部分类','未分类'):
                    return self.send_json({'error':'invalid_category','message':'标签名称需为 1 至 40 个字，且不能使用“全部分类”或“未分类”'},400)
                existing=next((row for row in categories if row['id']!=category_id and row['name'].casefold()==name.casefold()),None)
                if existing:
                    if method=='POST':return self.send_json({'category':existing,'categories':categories,'workspaceId':workspace_id})
                    return self.send_json({'error':'duplicate_category','message':'已经存在同名标签'},409)
                created={'id':category_id or 'tag-'+uuid.uuid4().hex,'name':name}
                rows=list(saved_categories.get(workspace_id,[]))
                index=next((i for i,row in enumerate(rows) if row.get('id')==created['id']),-1)
                if index>=0:rows[index]=created
                else:rows.append(created)
                saved_categories[workspace_id]=rows
                write_file(categories_file,saved_categories)
                return self.send_json({'category':{**created,'builtin':bool(hit and hit['builtin'])},'categories':category_list(workspace_id,saved_categories),'workspaceId':workspace_id},201 if method=='POST' else 200)
            restoring = path == '/api/workspace/materials/restore' and method == 'POST'
            catalog = material_catalog(include_deleted=method == 'DELETE' or restoring)
            item_id = path.rsplit('/', 1)[-1] if path != '/api/workspace/materials' else ''
            if method == 'DELETE' or restoring:
                incoming = self.read_json()
                ids = incoming.get('ids', [item_id] if method == 'DELETE' and item_id else [])
                if not isinstance(ids,list) or not ids or any(not isinstance(id,str) or not id for id in ids):
                    return self.send_json({'error':'invalid_material_ids','message':'请选择需要操作的素材'},400)
                ids = list(dict.fromkeys(ids))
                visible = {item['id'] for item in catalog}
                if any(id not in visible for id in ids):
                    return self.send_json({'error':'material_not_found','message':'素材不存在于当前工作区，请刷新后重试'},404)
                bucket = metadata.setdefault(workspace_id,{})
                for id in ids:
                    update = dict(bucket.get(id,{}))
                    if restoring:
                        update.pop('deleted',None);update.pop('deletedAt',None)
                    else:
                        update['deleted'] = True
                        update['deletedAt'] = update.get('deletedAt') or now()
                    if update:bucket[id]=update
                    else:bucket.pop(id,None)
                write_file(metadata_file,metadata)
                # This is library removal, not removal of project nodes or shared media files.
                return self.send_json({'restored' if restoring else 'deleted':ids,'workspaceId':workspace_id})
            if method == 'PUT':
                incoming = self.read_json()
                ids = incoming.get('ids') if isinstance(incoming.get('ids'), list) else [item_id]
                visible = {item['id'] for item in catalog}
                if not ids or any(not isinstance(id,str) or id not in visible for id in ids):
                    return self.send_json({'error':'material_not_found','message':'素材不存在于当前工作区'},404)
                update = {}
                if 'category' in incoming:
                    category = str(incoming['category'] or '')
                    if category and category not in {row['id'] for row in categories}:
                        return self.send_json({'error':'invalid_category','message':'分类标签不存在于当前工作区，请刷新后重试'},400)
                    update['category'] = category
                if 'name' in incoming:
                    name = str(incoming['name'] or '').strip()
                    if not name or len(name) > 160:return self.send_json({'error':'invalid_name','message':'素材名称需要 1 至 160 个字'},400)
                    if len(ids) != 1:return self.send_json({'error':'invalid_name','message':'请逐个修改素材名称'},400)
                    update['name'] = name
                if 'rating' in incoming:
                    rating=incoming['rating']
                    if isinstance(rating,bool) or not isinstance(rating,int) or not 0 <= rating <= 5:
                        return self.send_json({'error':'invalid_rating','message':'评级应为 0–5'},400)
                    update['rating']=rating
                if 'favorite' in incoming:
                    if not isinstance(incoming['favorite'],bool):
                        return self.send_json({'error':'invalid_favorite','message':'收藏状态无效'},400)
                    update['favorite']=incoming['favorite']
                if 'replacementMediaId' in incoming:
                    if len(ids)!=1:return self.send_json({'error':'invalid_replacement','message':'请逐个替换素材文件'},400)
                    media_id=str(incoming['replacementMediaId'] or '')
                    file=resolve_media_file(media_id)
                    kind=material_media_kind('/media/'+media_id)
                    if not file or kind not in ('image','video','audio','model'):
                        return self.send_json({'error':'invalid_replacement','message':'替换文件不存在，请重新选择文件'},400)
                    try:
                        if kind=='model':
                            from file_formats import validate_model_file
                            validate_model_file(file)
                        else:validate_asset_media(kind,file)
                    except ValueError as error:return self.send_json({'error':'invalid_replacement','message':str(error)},400)
                    update['replacement']={'mediaId':media_id,'url':'/media/'+media_id,'kind':kind,'size':human_bytes(file.stat().st_size),'createdAt':now()}
                bucket = metadata.setdefault(workspace_id,{})
                for id in ids:bucket[id] = {**bucket.get(id,{}), **update}
                write_file(metadata_file, metadata)
                return self.send_json({'updated':ids,'workspaceId':workspace_id})
            if item_id:
                item = next((item for item in catalog if item['id'] == item_id),None)
                return self.send_json({'material':item} if item else {'error':'material_not_found'},200 if item else 404)
            query = parse_qs(urlparse(self.path).query)
            kind = (query.get('kind') or ['all'])[0]
            category = (query.get('category') or ['all'])[0]
            project = (query.get('project') or ['all'])[0]
            origin = (query.get('origin') or ['all'])[0]
            search = (query.get('q') or [''])[0].strip().lower()
            filtered = [item for item in catalog
                if (kind == 'all' or item['kind'] == kind)
                and (category == 'all' or item['category'] == ('' if category == 'uncategorized' else category))
                and (project == 'all' or any(p['id'] == project for p in item['projects']))
                and (origin == 'all' or origin in item['origins'])
                and (not search or search in (item['name']+' '+' '.join(p['name'] for p in item['projects'])).lower())]
            return self.send_json({'materials':[summary_item(item) for item in filtered],
                'workspaceId':workspace_id,'total':len(catalog),'categories':categories,
                'projects':[{'id':p['id'],'name':p.get('projectName') or '未命名项目'}
                    for p in read_projects() if in_workspace(p,workspace_id,valid)]})

    def film_workbench_api(self, path):
        user = self.authenticated_user()
        if not user:
            return self.send_json({'error': 'unauthenticated', 'message': '请先登录'}, 401)
        workspace, valid = self.workspace_scope(user)
        wanted = self.request_workspace_id()
        if wanted and wanted != workspace:
            return self.send_json({'error': 'workspace_not_found', 'message': '工作区不存在'}, 404)
        incoming = self.read_json()
        if not isinstance(incoming, dict):
            return self.send_json({'error': 'invalid_request', 'message': '成片请求格式无效'}, 400)
        try:
            project_key, project_name = resolve_film_scope(user, workspace, valid, incoming)
        except ValueError as exc:
            return self.send_json({'error':'project_not_found','message':str(exc)},404)
        from film_services import service_handler
        FILM_WORKBENCH.callbacks[workspace] = service_handler(globals(),user,workspace)
        try:
            if path == '/api/film/open':
                return self.send_json(FILM_WORKBENCH.call(workspace, 'open', projectKey=project_key, projectName=project_name))
            if path == '/api/film/action':
                args = incoming.get('args')
                if not isinstance(args,dict): raise ValueError('成片操作参数无效')
                if args.get('action') == 'publish':
                    result = publish_film_output(user,workspace,project_key,project_name,args)
                elif args.get('action') == 'sync_materials':
                    linked=FILM_WORKBENCH.call(workspace,'advanced',projectKey=project_key,projectName=project_name,args={'action':'material_links'})
                    result=import_film_workspace_materials(workspace,valid,project_key,project_name,list(linked.get('links',{})),synchronize=True)
                    result.update(FILM_WORKBENCH.call(workspace,'advanced',projectKey=project_key,projectName=project_name,args={'action':'material_links'}))
                elif args.get('action') == 'sync_canvas':
                    result = sync_film_canvas(user,workspace,project_key,project_name,args)
                else:
                    result = FILM_WORKBENCH.call(workspace,'advanced',projectKey=project_key,projectName=project_name,args=args)
                    for picture in result.get('pictures',[]): picture.pop('base64',None)
                return self.send_json(result)
            result = import_film_workspace_materials(workspace, valid, project_key, project_name, incoming.get('materialIds'))
            return self.send_json(result)
        except (ValueError, OSError) as exc:
            return self.send_json({'error': 'film_import_failed', 'message': str(exc)}, 400)
        except FilmUnavailable as exc:
            return self.send_json({'error': 'film_unavailable', 'message': str(exc)}, 503)

    def do_GET(self):
        path = unquote(urlparse(self.path).path).rstrip('/')
        if path == '/api/blender' or path.startswith('/api/blender/'):
            return self.blender_api(path, 'GET')
        if path == '/api/workspace/materials' or path.startswith('/api/workspace/materials/'):
            return self.workspace_materials_api(path, 'GET')
        if path.startswith('/api/storage/') or re.fullmatch(r'/api/admin/users/[^/]+/storage',path):return self.storage_api(path,'GET')
        if path == '/api/portfolio' or path.startswith('/api/portfolio/'):
            return self.portfolio_api(path,'GET')
        if re.fullmatch(r'/portfolio/[A-Za-z0-9_-]{1,100}',path):
            self.path = '/portfolio-view.html'
            return super().do_GET()
        if path == '/api/favorites':
            user = self.authenticated_user()
            if not user: return self.send_json({'error':'unauthenticated','message':'请先登录'},401)
            return self.send_json(community_favorites_payload(user['id']))
        if path == '/api/notifications' or path == '/api/admin/notifications':
            return self.notifications_api(path,'GET')
        if path == '/api/previs/assets':
            return self.previs_assets_api(path, 'GET')
        # The learning site's /assets alias must not intercept the app's animation previews.
        if re.fullmatch(r'/assets/motion-presets/(?:[1-9]|1[0-9]|2[0-3])\.webp', path):
            return super().do_GET()
        if re.fullmatch(r'/api/previs/projects/[^/]+/(share|view)',path):
            return self.previs_share_api(path,'GET')
        if path.startswith('/previs/'):
            return self.serve_previs_page()
        # 「了解 CanvasFlow」落地页（模板02-星流 本地托管）+ 版本应答。公开静态路由，不鉴权。
        if path == '/version.json':
            body = json.dumps({'version': LEARN_SNAPSHOT_VERSION}, separators=(',', ':')).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            if self.command != 'HEAD': self.wfile.write(body)
            return
        # ★ 用**未 rstrip** 的原始路径判断：/learn → 301 到 /learn/（路由 base 需要带斜杠），
        #   /learn/ 直接出页。path 变量已被 rstrip('/')，不能再拿来判断，否则 301 死循环（踩过）。
        raw_path = unquote(urlparse(self.path).path)
        if raw_path == '/learn':
            self.send_response(301)
            self.send_header('Location', '/learn/')
            self.send_header('Content-Length', '0')
            self.end_headers()
            return
        if raw_path.rstrip('/') == '/learn' or (raw_path.startswith('/learn/') and not raw_path.startswith('/learn/assets/')) \
                or path.startswith('/learn/assets/') or path.startswith('/assets/'):
            return self.learn_static(path)
        # 「了解 CanvasFlow」API 桩（r916）：learn/ 快照页的配置接口全部由本地夹具应答，
        # 页面对外网（api.lingkeai.ai / cos.lingkeai.vip）零依赖。公开路由，不鉴权。
        if raw_path.startswith('/learnapi/'):
            return self.learn_api_stub(unquote(raw_path))
        if path == '/api/auth/me':
            user = self.authenticated_user()
            if self.auth_failure:
                with auth_db() as db:
                    db.execute('DELETE FROM sessions WHERE token_hash = ?', (session_digest(self.session_token()),))
                return self.send_json(self.auth_failure, 403, {'Set-Cookie': self.auth_cookie(clear=True)})
            return self.send_json({'user': user} if user else {'error': 'unauthenticated'}, 200 if user else 401)
        if path == '/api/local/bootstrap': return self.send_json({'context': dict(LOCAL_CONTEXT), 'mode': 'local', 'installationId':installation_id(ROOT,DATA_DIR)})
        if path == '/api/health': return self.send_json({'ok': True, 'service': 'canvasflow-local-api', 'mode': 'local'})
        # 分享快照是**故意的公开接口**（见 agent_share_read）：不校验登录、不校验工作区。
        # 放在所有鉴权分支之前，别被下面的 `if path.startswith('/api/')` 兜走。
        if path.startswith('/api/share/') and '/asset/' in path:
            # 分享页取素材图。**故意的公开接口**，但**不是素材公开接口**：
            # 只有当这个 asset 真的被该快照引用过时才给，别的 id 一律 404。
            # 这样既不用把 /api/assets/<id> 整条放公开（那等于把全部素材暴露给任意网站），
            # 分享页又能真的看到图 —— 而不是一排「图片未能载入」。
            parts = path.split('/')
            return self.agent_share_asset(parts[3] if len(parts) > 3 else '', parts[-1])
        if path.startswith('/api/share/'):
            return self.agent_share_read(path.split('/')[-1])
        if path == '/api/previs/models':
            user = self.authenticated_user()
            if not user: return self.send_json({'error': 'unauthenticated', 'message': '请先登录'}, 401)
            return self.send_json(previs_models_payload(user))
        if path == '/api/ai/models':
            user = self.authenticated_user()
            if not user: return self.send_json({'error': 'unauthenticated', 'message': '请先登录'}, 401)
            # params 只放「参数能力」里的非空默认值（前端选中模型时用它填生成设置）。
            # ★ 只下发「自己可见」的模型 = 主供应商 + 自己名下的私有模型（r794）
            # `qualities` = 该模型真正支持的界面画质档（前端拿它把不支持的档位显灰）。
            # ★ 与真正发请求时的 `image_quality_value()` 同源，避免"UI 说支持、实际不发"。
            # ★★ **不认识的模型族干脆不下发这个键**（前端视为未知 → 不显灰），
            #    别下发空数组 —— 那会让画质区整块变成点不动的死控件。
            visible = visible_ai_models(user['id'])

            def model_payload(item):
                # ★★★ 必须下发上游模型名 `model`（与 ai_model_public 一致，不是机密；apiKey 才不下发）。
                #   前端要拿它做**能力匹配**，而展示名 `name` 是管理员可随手改的（实测：
                #   `model: "music-2.5+"` 的展示名被填成「minimax-音乐生成-2.5+」）→ 只按 name 匹配必然漏。
                #   踩过的坑：音频规格面板按 `model.model` 找 schema，因这个键缺失 → 一路回落到兜底三行，
                #   表现为「选了模型但面板还是语种/采样率/输出格式」，且不报任何错。
                payload = {'id': item.get('id'), 'name': item.get('name'), 'provider': item.get('provider'),
                           'model': item.get('model'),
                           'params': model_param_defaults(item),
                           # ★ r860：告诉前端「这个模型走统一媒体端点」——
                           #   媒体形态下**只发模型自己声明过的参数**，所以底栏那些
                           #   「协议字段」型的控件（语速 / 声调 / 音量）在登记表没声明时必须藏起来，
                           #   否则就是"拖了没反应"的假控件（这一条是 `_probe` 实测出来的坑）。
                           'mediaGenerate': bool(media_generate_entry(item))}
                # ★★ r872：计费方式也要下发给**画布**（不只后台）—— 用户有权知道
                #   「这一次是按次算钱还是按时长算钱」。以前 `ai_model_public` 有、这里漏了，
                #   结果画布侧 `model.billing` 永远是 undefined（本项目"两处白名单"的经典漏点）。
                #   ★ 同一句话已经写在下面 `generationTimeouts` 的注释里：加字段必须两个投影都过一遍。
                payload['billing'] = item.get('billing') or infer_billing(item.get('model') or item.get('name'))
                # ★ r884：定价也要下发到**画布**（不只后台）—— 用户有权在生成前看到「这个模型多少钱」。
                #   这就是 `billing` 当年漏掉的那个「第三个投影」，别再漏第二次。
                payload['pricing'] = model_pricing(item)
                qualities = supported_image_qualities(item.get('model'), item.get('name'))
                if qualities is not None:
                    payload['qualities'] = qualities
                return payload

            grouped = {kind: [model_payload(item)
                              for item in visible
                              if item.get('enabled') and (model_supports_vision(item) if kind == 'i2t' else model_has_usage(item, kind))]
                       for kind in AI_MODEL_TYPES}
            return self.send_json({'models': grouped})





        if path == '/api/ai/voices':
            user = self.authenticated_user()
            if not user: return self.send_json({'error': 'unauthenticated', 'message': '请先登录'}, 401)
            query = parse_qs(urlparse(self.path).query)
            model_id = str((query.get('modelId') or [''])[0]).strip()
            entry = next((item for item in visible_ai_models(user['id'])
                          if item.get('id') == model_id and item.get('enabled')
                          and model_has_usage(item, 'tts')), None) if model_id else None
            if not entry:
                return self.send_json({'error': 'tts_model_not_found',
                                       'message': '所选音频模型不存在或未启用'}, 400)
            upstream = str(entry.get('model') or '').strip()
            voices, error = fetch_model_voices(entry, upstream)
            if error:
                return self.send_json({'model': upstream, 'voices': [], 'error': error}, 200)
            return self.send_json({'model': upstream, 'voices': voices,
                                   'filters': voice_filter_options(voices)}, 200)
        # 画布「登记表」（规格表）：**登录即可读** —— 画布靠它渲染所有选项面板（音频规格 /
        # 视频规格 / 摄像机库）。2026-09-25 从 `app.js` 与 `camera-library.js` 迁入服务端。
        # ★ 单开一个接口而不是塞进 `/api/ai/models`：那个接口的返回结构被多处依赖；
        #   而且「登记表」与「有哪些模型」是两件事 —— 同一份登记表服务所有账号。
        if path == '/api/model-specs':
            user = self.authenticated_user()
            if not user: return self.send_json({'error': 'unauthenticated', 'message': '请先登录'}, 401)
            return self.send_json({'specs': read_model_specs(), 'contracts':public_model_contracts(user)})
        if path == '/api/settings':
            user = self.authenticated_user()
            if not user: return self.send_json({'error': 'unauthenticated', 'message': '请先登录'}, 401)
            return self.send_json(app_settings_payload(user))
        # 预设提示词（管理员统一管理）：**正文只下发给管理员**，其余角色只拿到元数据。
        # ★ 生成时由服务端按 presetScene 注入正文（见 /api/ai/image-generate），
        #   所以普通用户/VIP 拿不到正文也不影响出图 —— 这是「看不到但发得出」的关键。
        if path == '/api/preset-prompts':
            user = self.authenticated_user()
            if not user: return self.send_json({'error': 'unauthenticated', 'message': '请先登录'}, 401)
            is_admin = user.get('role') == 'admin'
            return self.send_json({
                'prompts': preset_prompts_for_role(is_admin),
                'role': 'admin' if is_admin else (user.get('role') or 'user'),
                'canReadPrompt': is_admin,
            })
        # 运镜 / 表情的提示词（r832）：**正文对所有人下发** —— 前端要用它做 token 展开，
        # 拿不到就会落回短名。编辑入口只对管理员渲染（见 `openDockPromptEditor`）。
        if path == '/api/dock-prompts':
            user = self.authenticated_user()
            if not user: return self.send_json({'error': 'unauthenticated', 'message': '请先登录'}, 401)
            return self.send_json({
                'ok': True,
                'prompts': dock_prompts_payload(),
                'canEdit': user.get('role') == 'admin',
            })
        # 预置角色的**全局**删除记录（只有管理员删过的会在这里）。
        # ★ 所有登录用户都要读得到 —— 普通用户也得知道"哪些预置角色被管理员全局删了"，
        #   这样他们那边也不会再显示。
        # ★★ r796：这里下发的是**合并视图**（全局 + 该账号私有的那份），另外多回一个 `mine`
        #   给前端区分「我的角色库」的卡、以及给配额只算私有那一份用。
        if path == '/api/preset-roles':
            user = self.authenticated_user()
            if not user: return self.send_json({'error': 'unauthenticated', 'message': '请先登录'}, 401)
            return self.send_json(visible_preset_roles(user.get('id')))
        # 文本模型列表：给底部工具栏的「文本模型」选择器用（脚本节点的「合成提示词」也走它）。
        # ★ 单开一个接口而不是塞进 `/api/ai/models` 的分组里 —— 那个接口的返回结构被多处依赖。
        if path == '/api/ai/text-models':
            user = self.authenticated_user()
            if not user: return self.send_json({'error': 'unauthenticated', 'message': '请先登录'}, 401)
            # ★ 只下发「自己可见」的文本模型 = 主供应商 + 自己名下的私有模型（r794）
            entries = [m for m in visible_ai_models(user['id']) if m.get('enabled') and model_has_usage(m, 'text')]
            public = [{
                'id': str(m.get('id') or ''),
                'name': str(m.get('name') or m.get('model') or '文本模型'),
                'provider': str(m.get('provider') or m.get('baseUrl') or ''),
            } for m in entries]
            return self.send_json({'models': public, 'defaultId': public[0]['id'] if public else ''})
        # 项目/素材/社区数据包含用户创作内容，且 JSON 响应带 CORS *：
        # 不要求登录的话，用户浏览器里的任意网站都能跨站读走全部项目。
        if path == '/api/projects' or path.startswith('/api/projects/') or path == '/api/assets' or path.startswith('/api/assets/') or path == '/api/community' or path == '/api/music':
            user = self.authenticated_user()
            if not user: return self.send_json({'error': 'unauthenticated', 'message': '请先登录'}, 401)
        if path.startswith('/api/admin/'):
            admin = self.authenticated_user()
            if not admin: return self.send_json({'error': 'unauthenticated', 'message': '请先登录'}, 401)
            # ★★ 供应商相关路径要放 VIP 进来（r794）：「供应商设置」= scope=mine 对管理员 + VIP 开放。
            #    这些路径的权限由下面各自的 `model_scope_request()` 按 scope 分别把关 —— 不是无条件放行：
            #    scope=global（主供应商）仍然只有管理员能过。
            in_model_scope = (path == '/api/admin/ai-models' or path.startswith('/api/admin/ai-models/')
                              or path == '/api/admin/provider-models-test')
            if admin.get('role') != 'admin' and not in_model_scope:
                return self.send_json({'error': 'forbidden', 'message': '需要管理员权限'}, 403)
            if path == '/api/admin/ai-models':
                scope, err = self.model_scope_request(admin)
                if err: return self.send_json(err, 403)
                return self.send_json({'models': [ai_model_public(item) for item in scoped_ai_models(scope, admin['id'])],
                                       'providers': [ai_provider_public(item) for item in read_ai_providers()], 'scope': scope})
            # 画布登记表（规格表）：**全局一套**，只有管理员可读写（VIP 也不行 —— 它影响所有人看到的面板）。
            if path == '/api/admin/model-specs':
                return self.send_json({'specs': read_model_specs(), 'contracts':public_model_contracts(admin)})
            with auth_db() as db:
                if path == '/api/admin/overview':
                    users = db.execute('SELECT COUNT(*) FROM users').fetchone()[0]
                    active_users = db.execute("SELECT COUNT(*) FROM users WHERE status = 'active'").fetchone()[0]
                    credits = db.execute('SELECT COALESCE(SUM(CAST(ROUND(amount * 100) AS INTEGER)) / 100.0, 0) FROM credit_ledger').fetchone()[0]
                    return self.send_json({'overview': {'users': users, 'activeUsers': active_users, 'creditBalance': credit_amount(credits or 0)}})
                # 管理后台：单用户的积分调整记录（管理后台用户卡里的展示/删除列表用）
                if path.startswith('/api/admin/users/') and path.endswith('/credit-history'):
                    target_id = path.split('/')[-2]
                    if not target_id: return self.send_json({'error': 'invalid_user', 'message': '缺少用户 ID'}, 400)
                    rows = db.execute('SELECT id, amount, reason, created_at FROM credit_ledger WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 200', (target_id,)).fetchall()
                    return self.send_json({'history': [{'id': row['id'], 'amount': credit_amount(row['amount']), 'reason': row['reason'], 'createdAt': row['created_at']} for row in rows]})
                if path == '/api/admin/users':
                    query = str(parse_qs(urlparse(self.path).query).get('q', [''])[0]).strip().lower()[:80]
                    sql = "SELECT u.id, u.nickname, u.avatar, u.role, u.status, u.phone, u.created_at, i.identifier AS email, COALESCE(credits.balance, 0) AS credit_balance FROM users u LEFT JOIN auth_identities i ON i.user_id = u.id AND i.type = 'email' LEFT JOIN (SELECT user_id, SUM(CAST(ROUND(amount * 100) AS INTEGER)) / 100.0 AS balance FROM credit_ledger GROUP BY user_id) credits ON credits.user_id = u.id"
                    params = []
                    if query:
                        sql += " WHERE lower(COALESCE(i.identifier, '')) LIKE ? OR lower(u.nickname) LIKE ? OR lower(u.id) LIKE ?"
                        like = f'%{query}%'; params = [like, like, like]
                    sql += ' ORDER BY u.created_at DESC LIMIT 300'
                    rows = db.execute(sql, params).fetchall()
                    users_payload = [{'id': row['id'], 'nickname': row['nickname'], 'avatar': row['avatar'], 'email': row['email'] or '', 'phone': row['phone'] or '', 'role': row['role'] or 'user', 'status': row['status'], 'createdAt': row['created_at'], 'creditBalance': credit_amount(row['credit_balance'] or 0)} for row in rows]
                    ACCOUNT_STORAGE.sync()
                    for account in users_payload:
                        account.update(storageQuota=ACCOUNT_STORAGE.quota(account['id']),storageUsed=ACCOUNT_STORAGE.used(account['id']))
                    return self.send_json({'users': users_payload})
            return self.send_json({'error': 'not_found'}, 404)
        if path == '/api/projects':
            # 项目列表按工作区过滤 —— 空间之间互不互通；社区内容另有 /api/community。
            workspace_id, valid = self.workspace_scope(user)
            return self.send_json({'projects': self.scoped(read_projects(), workspace_id, valid), 'workspaceId': workspace_id})
        if path.startswith('/api/projects/'):
            project = self.find_project(path.split('/')[-1])
            if project and project.get('ownerId')!=user['id'] and not project.get('shared'):
                return self.send_json({'error':'project_forbidden','message':'此项目仅所有者可见'},403)
            return self.send_json({'project':project} if project else {'error':'project_not_found'},200 if project else 404)
        if path.startswith('/api/assets/'):
            asset_id = path.split('/')[-1]
            asset = next((item for item in read_assets() if item.get('id') == asset_id), None)
            if not asset:
                return self.send_json({'error': 'asset_not_found'}, 404)
            if not asset.get('shared') and asset.get('ownerId') != user['id']:
                return self.send_json({'error': 'forbidden', 'message': '此素材仅所有者可见'}, 403)
            # 带 mediaId 的素材：把媒体文件读回来当 data URI 返回（r684）。
            # 这样 `fetchAssetData(id) -> /api/assets/<id>` 这条老路径一行都不用改，
            # 而磁盘上有文件、内存里就不必再压一份 base64。
            return self.send_json({'asset': asset_with_data(asset)}, 200)
        if path == '/api/assets':
            # scope=community → 只看公开分享（社区页）；默认 → 当前工作区的素材 **加上**所有公开分享的。
            # 「别人分享的」不按工作区隔离：素材库本来就该能直接取用社区里的东西，
            # 工作区隔离的只是「我自己这个空间里的私有素材」。
            scope = str(parse_qs(urlparse(self.path).query).get('scope', ['workspace'])[0]).strip().lower()
            assets = read_assets()
            if scope == 'community':
                # 社区页只要引用信息，剥掉 base64（与 /api/community 一致），否则每次都要传 150MB+。
                return self.send_json(social_attach_likes({'assets': [{k: v for k, v in item.items() if k != 'data'}
                                                  for item in assets if item.get('shared')]},user['id']))
            workspace_id, valid = self.workspace_scope(user)
            items = [item for item in assets if item.get('shared') or in_workspace(item, workspace_id, valid)]
            return self.send_json(social_attach_likes({'assets': items, 'workspaceId': workspace_id},user['id']))
        if path == '/api/storage':
            # 「个人中心 → 我的素材」的存储用量：3 GB 配额 + 已用进度条。
            user = self.authenticated_user()
            if not user: return self.send_json({'error': 'unauthenticated', 'message': '请先登录'}, 401)
            return self.send_json({'storage': user_storage_view(user['id'])})
        if path == '/api/credits':
            # 「个人中心 → 我的账户」的余额 + 积分流水。
            # ★ 账户数据一律以**登录态**为准，不接受任何来自 query/body 的 userId。
            user = self.authenticated_user()
            if not user: return self.send_json({'error': 'unauthenticated', 'message': '请先登录'}, 401)
            return self.send_json({'credits': user_credits_view(user['id'])})
        if path == '/api/subscription-plans':
            # 订阅套餐列表（登录即可读，订阅弹窗与管理后台共用；按月费升序展示）。
            user = self.authenticated_user()
            if not user: return self.send_json({'error': 'unauthenticated', 'message': '请先登录'}, 401)
            with LOCK:
                plans = read_subscription_plans()
            payload = [plan_public(item) for item in plans]
            payload.sort(key=lambda item: (item['price'], item['note']))
            return self.send_json({'plans': payload})
        if path == '/api/social':
            # r886：我自己的「作品 / 获赞 / 关注 / 粉丝」四项统计 + 关注列表 + 粉丝列表 + 我点过的赞。
            # ★ 与 `/api/credits` 同一条纪律：一律以**登录态**为准，不接受任何来自 query/body 的 userId。
            user = self.authenticated_user()
            if not user: return self.send_json({'error': 'unauthenticated', 'message': '请先登录'}, 401)
            return self.send_json(social_view(user['id']))
        if path == '/api/music': return self.send_json(social_attach_likes({'music': [item for item in read_music() if item.get('shared', True) or item.get('ownerId') == user['id']]}, user['id']))
        if path == '/api/models':
            viewer = self.authenticated_user()
            return self.send_json({'models': PREVIS_ASSETS.model_views([m for m in read_models() if m.get('shared') or m.get('ownerId') == (viewer or {}).get('id')], (viewer or {}).get('id',''))})
        if path == '/api/workspaces':
            user = self.authenticated_user()
            if not user: return self.send_json({'error': 'unauthenticated', 'message': '请先登录'}, 401)
            return self.workspace_list(user)
        if path == '/api/community':
            projects = [item for item in read_projects() if item.get('shared')]
            # 社区分享同步「图片 / 视频 / 音频」三类素材（去掉 base64，只留引用字段）。
            assets = [{k: v for k, v in item.items() if k != 'data'} for item in read_assets() if item.get('shared')]
            # ★ r886：每条分享内容补 `likeCount` + `liked`（响应层注入，不落盘）。
            #   社区列表里每一张卡都要能点赞 —— 这是「获赞」统计的数据来源。
            viewer = self.authenticated_user()
            return self.send_json(social_attach_likes(
                {'projects': projects, 'assets': assets, 'music': [item for item in read_music() if item.get('shared', True)],
                 'models': PREVIS_ASSETS.model_views([item for item in read_models() if item.get('shared')], (viewer or {}).get('id',''))},
                (viewer or {}).get('id')))
        if path.startswith('/api/profiles/'):
            profile_id = path.split('/')[-1]
            projects, music, models = read_projects(), read_music(), read_models()
            owned_projects = [item for item in projects if item.get('ownerId') == profile_id and item.get('shared')]
            owned_music = [item for item in music if item.get('ownerId') == profile_id and item.get('shared')]
            owned_models = [item for item in models if item.get('ownerId') == profile_id and item.get('shared')]
            first = (owned_projects + owned_music + owned_models + [item for item in projects + music if item.get('ownerId') == profile_id])
            name = first[0].get('ownerName') if first else profile_id.replace('user-', '').replace('-', ' ').strip() or '创作者'
            avatar = first[0].get('ownerAvatar') if first else name[:1]
            # ★ r886：四项统计统一走 `social_stats()`（与个人主页同一个口径）——
            #   以前这里的 `likes` 只数音乐自带的静态字段，获赞永远是 0 或假数。
            person = social_person(profile_id)
            stats = social_stats(profile_id)
            stats['music'] = len(owned_music)
            stats['models'] = len(owned_models)
            viewer = self.authenticated_user()
            return self.send_json({'profile': {
                'id': profile_id, 'name': person['name'], 'avatar': person['avatar'],
                'bio': '在 CanvasFlow 分享创作灵感。', 'stats': stats,
                'following': bool(viewer and social_is_following(viewer['id'], profile_id))}})
        if path == '/api/templates': return self.send_json({'templates': TEMPLATES})
        if path.startswith('/api/jobs'):
            user = self.authenticated_user()
            if not user: return self.send_json({'error': 'unauthenticated', 'message': '请先登录'}, 401)
            if path == '/api/jobs/stats':
                current_month = datetime.now(timezone.utc).strftime('%Y-%m')
                # 列表/统计不做供应商同步（每个未完成任务可能阻塞 60s）；真实状态只由单任务查询刷新。
                workspace_id, valid = self.workspace_scope(user)
                all_jobs = latest_jobs(user_id=user['id'], limit=200, workspace_id=workspace_id, valid_ids=valid)
                count = sum(1 for job in all_jobs if str(job.get('createdAt') or '').startswith(current_month))
                active = sum(1 for job in all_jobs if job_view(job, sync=False).get('status') in {'queued', 'running'})
                return self.send_json({'monthCount': count, 'activeCount': active, 'quota': 50})
            if path == '/api/jobs':
                query = parse_qs(urlparse(self.path).query)
                try: limit = max(1, min(200, int((query.get('limit') or ['50'])[0])))
                except (TypeError, ValueError): limit = 50
                project_id = str((query.get('projectId') or [''])[0]).strip()[:100]
                status_filter = str((query.get('status') or ['all'])[0]).strip().lower()
                kind_filter = str((query.get('kind') or ['all'])[0]).strip().lower()
                try: offset = max(0, int((query.get('offset') or ['0'])[0]))
                except (TypeError, ValueError): offset = 0
                workspace_id, valid = self.workspace_scope(user)
                jobs = latest_jobs(user_id=user['id'], limit=None, project_id=project_id or None, workspace_id=workspace_id, valid_ids=valid)
                if status_filter in {'queued', 'running', 'completed', 'failed'}:
                    jobs = [job for job in jobs if job.get('status') == status_filter]
                if kind_filter in {'image', 'video', 'audio'}:
                    jobs = [job for job in jobs if (job.get('kind') or 'video') == kind_filter]
                return self.send_json({'jobs': [job_view(job, sync=False) for job in jobs[offset:offset+limit]], 'total': len(jobs), 'activeCount': sum(1 for job in jobs if job.get('status') in {'queued', 'running'})})
            if path.endswith('/download'):
                job_id = path.split('/')[-2]
                job = self.find_job(job_id, user['id'])
                if not job: return self.send_json({'error': 'job_not_found', 'message': '任务不存在'}, 404)
                current = job_view(job)
                if current.get('status') != 'completed': return self.send_json({'error': 'video_not_ready', 'message': '任务尚未完成，暂时不能下载'}, 409)
                return self.send_video_download(current)
            job_id = path.split('/')[-1]
            job = self.find_job(job_id, user['id'])
            return self.send_json({'job': job_view(job)} if job else {'error': 'job_not_found'}, 200 if job else 404)
        if path == '/api/agent/skills':
            # 用户自己存的技能（手写 / 导入 / Agent 用 create_skill 存的）。
            # 内置技能在前端 AGENT_SKILLS 里，不走这里 —— 这里只返回「我的」。
            user = self.authenticated_user()
            if not user: return self.send_json({'error': 'unauthenticated', 'message': '请先登录'}, 401)
            # 技能不按工作区隔离：技能是「我这个人的能力」，换个空间也该跟着走。
            items = [agent_skill_view(i) for i in read_agent_skills() if i.get('userId') == user['id']]
            items.sort(key=lambda i: i.get('createdAt') or '', reverse=True)
            return self.send_json({'skills': items})
        if path == '/api/agent/models':
            # 给对话面板的「选择模型」用：列出全部模型 + 标注哪些真能用（有 Key / 已启用），
            # 并告诉前端「不指定时服务端会自动挑哪个」—— 用户看到生成失败时能立刻知道为什么。
            user = self.authenticated_user()
            if not user: return self.send_json({'error': 'unauthenticated', 'message': '请先登录'}, 401)
            # ★ 只列出「自己可见」的模型 = 主供应商 + 自己名下的私有模型（r794）
            models = visible_ai_models(user['id'])
            brain, _ = agent_resolve_model('', user['id'])

            def brief(item):
                return {
                    'id': item.get('id'), 'name': item.get('name') or item.get('model') or '未命名模型',
                    'model': item.get('model') or '', 'provider': item.get('provider') or '',
                    'type': item.get('type') or '', 'enabled': bool(item.get('enabled')),
                    'hasKey': provider_has_credentials(item),
                    # baseUrl / protocol 是「供应商」的聚合键（与设置面板 groupProviders 同一套规则），
                    # 前端拿它把模型按供应商分组显示
                    'baseUrl': item.get('baseUrl') or '', 'protocol': item.get('protocol') or 'openai',
                    # 作用域：前端据此在列表里标「主供应商 / 我的」（r794）
                    'scope': 'mine' if model_owner_of(item) else 'global',
                }

            def auto_pick(kind):
                hit = next((m for m in models
                            if m.get('enabled') and provider_has_credentials(m)
                            and (model_supports_vision(m) if kind == 'i2t' else model_has_usage(m, kind))), None)
                return hit.get('id') if hit else ''

            return self.send_json({
                'models': [brief(m) for m in models],
                'brainDefaultId': str((brain or {}).get('id') or ''),
                'autoPick': {'t2i': auto_pick('t2i'), 'video': auto_pick('video')},
            })
        if path == '/api/agent/sessions' or path.startswith('/api/agent/sessions/'):
            user = self.authenticated_user()
            if not user: return self.send_json({'error': 'unauthenticated', 'message': '请先登录'}, 401)
            if path == '/api/agent/sessions':
                return self.agent_sessions_list(user)
            return self.agent_session_detail(user, path.split('/')[-1])
        if path.startswith('/api/'): return self.send_json({'error': 'not_found'}, 404)
        if 'server-data' in path: return self.send_json({'error': 'not_found'}, 404)
        # 落盘的大文件（视频等）。分享页也要播得动，所以**不校验登录** ——
        # 分享的本意就是「谁拿到链接都能看」，跟 /api/share/<id> 同一套逻辑。
        # 文件名是可猜的（媒体 id 是 uuid，够长），这跟分享链接本身的安全性等价。
        if path.startswith('/media/'):
            return self.serve_media_file(path[len('/media/'):])
        # 只读分享页：/share/<shareId> 交给 share.html，由它自己按路径里的 id 拉快照。
        # 走静态文件派发是拿不到这个页面的 —— 磁盘上并没有名为 share/<id> 的文件。
        if path == '/share' or path.startswith('/share/'):
            return self.serve_share_page()
        return super().do_GET()
    def serve_media_file(self, name):
        target = resolve_media_file(name)
        if not target:
            return self.send_json({'error': 'not_found', 'message': '媒体不存在'}, 404)
        user=self.authenticated_user()
        query=parse_qs(urlparse(self.path).query)
        if not ACCOUNT_STORAGE.can_read(name,(user or {}).get('id',''),str((query.get('signature') or [''])[0]),str((query.get('expires') or [''])[0])):
            return self.send_json({'error':'media_forbidden','message':'文件已过期，或需要所属账户登录后访问'},403 if user else 401)
        try:
            total = target.stat().st_size
        except OSError:
            return self.send_json({'error': 'server_error'}, 500)
        ctype = mimetypes.guess_type(target.name)[0] or 'application/octet-stream'
        # **必须支持 Range**：视频拖进度条要靠它，而且 Safari/iOS 遇到不支持 Range 的
        # 视频源会直接拒绝播放（不是降级成不能拖，是整个黑屏）。本机 200MB 的视频
        # 走一次 Range 只传几 MB，体验差别很大。
        start, end, status = byte_range(str(self.headers.get('Range') or '').strip(), total)
        if status == 416:
            self.send_response(416)
            self.send_header('Content-Range', f'bytes */{total}')
            self.send_header('Content-Length', '0')
            self.end_headers()
            return
        length = max(0, end - start + 1) if total else 0
        self.send_response(status)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Security-Policy', "sandbox; default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'")
        self.send_header('Content-Length', str(length))
        if status == 206:
            self.send_header('Content-Range', f'bytes {start}-{end}/{total}')
        # 声明支持 Range：没有这个头，有些浏览器干脆不发 Range 请求。
        self.send_header('Accept-Ranges', 'bytes')
        # 文件名带 uuid，内容永不变化 → 可以放心长缓存（重复看同一个视频不再走网络）。
        self.send_header('Cache-Control', 'private, no-store')
        # 分享页与主站可能不同源（用户换端口），放行跨源取媒体。
        self.send_header('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length')
        self.end_headers()
        if self.command == 'HEAD':
            return
        # 分块流式发送，别 read_bytes() 把整个视频读进内存（大视频会很吃内存）。
        try:
            with target.open('rb') as handle:
                handle.seek(start)
                remaining = length
                while remaining > 0:
                    chunk = handle.read(min(1024 * 1024, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    self.wfile.write(chunk)
        except (OSError, ConnectionError):
            # 客户端中途关掉（用户拖进度条时很常见）—— 静默收场，别往日志里刷栈。
            pass
    def serve_previs_page(self):
        body=(ROOT/'previs-view.html').read_bytes();self.send_response(200);self.send_header('Content-Type','text/html; charset=utf-8');self.send_header('Content-Length',str(len(body)));self.send_header('Cache-Control','no-store');self.end_headers()
        if self.command != 'HEAD': self.wfile.write(body)

    def serve_share_page(self):
        target = PUBLIC_DIR / 'share.html'
        if not target.is_file():
            return self.send_json({'error': 'not_found', 'message': '分享页不存在'}, 404)
        try:
            body = target.read_bytes()
        except OSError:
            return self.send_json({'error': 'server_error', 'message': '分享页读取失败'}, 500)
        self.send_response(200)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        if self.command != 'HEAD': self.wfile.write(body)
    def translate_path(self, path):
        # server-data holds provider API keys and auth.db; it must never be served as a static file,
        # so resolve the final filesystem path and reject anything inside that directory.
        translated = super().translate_path(path)
        if not PUBLIC_FILES.allowed(translated):
            return str(DATA_DIR / '.blocked')
        return translated
    def list_directory(self, path):
        self.send_error(404)
        return None
    def do_PUT(self):
        try:
            return self._route_put()
        except PayloadTooLarge:
            return self.send_json({'error': 'payload_too_large', 'message': '请求体超过 8MB 限制，请减小参考图或素材大小后重试'}, 413)
    def _route_put(self):
        path = unquote(urlparse(self.path).path).rstrip('/')
        if path == '/api/blender/settings':return self.blender_api(path, 'PUT')
        if path == '/api/workspace/materials' or path.startswith('/api/workspace/materials/'):
            return self.workspace_materials_api(path, 'PUT')
        if re.fullmatch(r'/api/admin/users/[^/]+/storage',path):return self.storage_api(path,'PUT')
        if path == '/api/portfolio' or path.startswith('/api/portfolio/'):
            return self.portfolio_api(path,'PUT')
        if path.startswith('/api/admin/notifications/'):
            return self.notifications_api(path,'PUT')
        if re.fullmatch(r'/api/previs/projects/[^/]+/share',path):
            return self.previs_share_api(path,'PUT')
        if path.startswith('/api/previs/assets/'):
            return self.previs_assets_api(path, 'PUT', self.read_json())
        user = self.authenticated_user()
        if not user: return self.send_json({'error': 'unauthenticated', 'message': '请先登录'}, 401)
        if path.startswith('/api/admin/ai-providers/'):
            scope, err = self.model_scope_request(user)
            if err: return self.send_json(err, 403)
            incoming = self.read_json()
            with LOCK:
                rows = read_ai_providers()
                existing = next((row for row in rows if row.get('id') == path.split('/')[-1]), None)
                if not existing: return self.send_json({'error': 'provider_not_found'}, 404)
                if existing['id'] in BUILTIN_PROVIDERS:
                    fixed_fields = {**BUILTIN_PROVIDER_FIELDS,
                                    'provider': BUILTIN_PROVIDERS[existing['id']]['provider']}
                    if any(key in incoming and incoming[key] != value for key, value in fixed_fields.items()):
                        return self.send_json({'error': 'fixed_provider_fields',
                                               'message': '内置供应商的名称和网址不可修改'}, 409)
                saved = provider_record(incoming, existing)
                validate_provider_access(user.get('role'), saved['baseUrl'])
                if any(row.get('id') != saved['id'] and provider_identity(row) == provider_identity(saved)
                       and (saved.get('providerGroup') == 'canvasflow' or row.get('providerGroup') == 'canvasflow'
                            or row.get('id') in BUILTIN_PROVIDERS) for row in rows):
                    return self.send_json({'error': 'duplicate_provider', 'message': '已存在同名配置，请换一个名称'}, 409)
                if (saved.get('providerGroup') == 'canvasflow'
                        and provider_identity(saved) != provider_identity(existing)
                        and any(provider_identity(row) == provider_identity(saved) for row in visible_ai_models(user['id']))):
                    return self.send_json({'error': 'duplicate_provider', 'message': '该名称已被其他模型配置使用'}, 409)
                write_file(AI_PROVIDERS_FILE, [saved if row is existing else row for row in rows])
            return self.send_json({'provider': ai_provider_public(saved)})
        if path == '/api/previs/models':
            if user.get('role') != 'admin': return self.send_json({'error': 'forbidden', 'message': '只有管理员可修改预演台模型设置'}, 403)
            try:
                with LOCK: save_previs_models(self.read_json())
            except (ValueError, TypeError) as error:
                return self.send_json({'error': 'invalid_models', 'message': str(error)}, 400)
            return self.send_json(previs_models_payload(user))
        # 通用设置：生成超时。**双作用域（r803）** ——
        #   · `?scope=mine`（默认，任何登录用户）：写自己的个人覆盖 → 只影响自己账号；
        #   · `?scope=global`（仅管理员）：写全局默认 → 作为所有未覆盖账号的基线。
        #   ★ 不传 scope 时按角色兜底（管理员 = global，与升级前行为一致；其他人 = mine），
        #     这样没刷新的老前端也不会突然 403。
        if path == '/api/settings':
            query = parse_qs(urlparse(self.path).query)
            raw_scope = str((query.get('scope') or [''])[0]).strip().lower()
            if raw_scope not in ('global', 'mine'):
                raw_scope = 'global' if user.get('role') == 'admin' else 'mine'
            if raw_scope == 'global':
                if user.get('role') != 'admin':
                    return self.send_json({'error': 'forbidden', 'message': '只有管理员可以修改全局默认的生成超时'}, 403)
                incoming = self.read_json()
                with LOCK: write_app_settings(incoming)
            else:
                incoming = self.read_json()
                with LOCK: write_user_timeouts(user.get('id'), incoming)
            return self.send_json({'ok': True, 'scope': raw_scope, **app_settings_payload(user)})
        # 预设提示词：只有管理员能改（**全局一套**，所有工作区/项目共用）。
        if path == '/api/preset-prompts':
            if user.get('role') != 'admin':
                return self.send_json({'error': 'forbidden', 'message': '需要管理员权限才能修改预设提示词'}, 403)
            payload = write_preset_prompts(self.read_json())
            if payload is None:
                return self.send_json({'error': 'bad_request', 'message': '请求体缺少 prompts'}, 400)
            return self.send_json({'ok': True, 'updatedAt': payload.get('updatedAt'), 'customCount': len(payload.get('prompts') or {})})
        # 运镜 / 表情的提示词（r832）：只有管理员能改（**全局一套**，所有账号/项目共用）。
        if path == '/api/dock-prompts':
            if user.get('role') != 'admin':
                return self.send_json({'error': 'forbidden', 'message': '需要管理员权限才能修改运镜 / 表情提示词'}, 403)
            payload = write_dock_prompts(self.read_json())
            if payload is None:
                return self.send_json({'error': 'bad_request', 'message': '请求体缺少 prompts'}, 400)
            custom = payload.get('prompts') or {}
            return self.send_json({
                'ok': True,
                'updatedAt': payload.get('updatedAt'),
                'customCount': sum(len(table) for table in custom.values()),
            })
        # 画布「登记表」（规格表）：**全局一套**，只有管理员能改（2026-09-25）。
        # ★★ 按 kind 局部更新：请求体 `{kind, data}`，**只替换该 kind**，其余 kind 原样保留 ——
        #    整份替换的写法会让「改音频规格」顺手把摄像机库清空（本项目在别处踩过这类覆盖）。
        # ★ `data` 省略 / 为 null = 清空该 kind，这是明确语义，不算错误。
        if path == '/api/admin/model-specs':
            if user.get('role') != 'admin':
                return self.send_json({'error': 'forbidden', 'message': '需要管理员权限才能修改登记表'}, 403)
            payload = self.read_json()
            if not isinstance(payload, dict):
                return self.send_json({'error': 'bad_request', 'message': '请求体格式不正确'}, 400)
            kind = str(payload.get('kind') or '').strip()
            if kind not in MODEL_SPEC_KINDS:
                return self.send_json({'error': 'bad_kind',
                                       'message': f'kind 必须是 {" / ".join(MODEL_SPEC_KINDS)} 之一'}, 400)
            value = payload.get('data')
            if value is not None and (not isinstance(value, dict) or any(
                    not isinstance(rows, dict if key in ('aspectLabels','ratioLabels') else list)
                    for key, rows in value.items())):
                return self.send_json({'error':'invalid_specs','message':'规格内容必须是按模型或分组排列的列表，原配置未修改'},400)
            if value is not None:
                legacy = kind in ('image','video') and any(key in value for key in SPEC_LEGACY_KEYS.get(kind,()))
                if not legacy and any(not isinstance(row,dict) or
                        ('options' in row and not isinstance(row['options'],list))
                        for rows in value.values() for row in rows):
                    return self.send_json({'error':'invalid_specs','message':'规格行必须是对象，选项必须为列表，原配置未修改'},400)
            with LOCK:
                specs = read_model_specs()
                specs[kind] = value
                write_model_specs(specs)
            return self.send_json({'ok': True, 'kind': kind, 'specs': read_model_specs()})
        # 角色库的维护（r796）—— 按 `?scope=` 分两个作用域：
        #   · global（**官方角色库**）：仅管理员 → 对所有账号生效；
        #   · mine（**我的角色库**）：任何登录用户 → 只对自己生效（自建角色 + 对官方卡的私有改动）。
        #   ★ 不传 scope 时：管理员按 global（与升级前行为一致），其他人按 mine。
        if path == '/api/preset-roles':
            query = parse_qs(urlparse(self.path).query)
            raw_scope = str((query.get('scope') or [''])[0]).strip().lower()
            if raw_scope not in ROLE_SCOPES:
                raw_scope = 'global' if user.get('role') == 'admin' else 'mine'
            if raw_scope == 'global' and user.get('role') != 'admin':
                return self.send_json({'error': 'forbidden', 'message': '官方角色库只有管理员可以修改'}, 403)
            payload = self.read_json()
            if not isinstance(payload, dict):
                return self.send_json({'error': 'bad_request', 'message': '请求体格式不正确'}, 400)
            # ★★ 私有角色卡的素材**计入个人配额**（官方角色库不计入）。超限就拒绝，
            #    口径与 `POST /api/assets` 完全一致（先扣掉已有的角色占用，避免重复计算）。
            if raw_scope == 'mine':
                user_id = user.get('id')
                already_roles = user_role_storage_bytes(user_id)
                assets_only = user_storage_usage(user_id) - already_roles
                custom_list = payload.get('custom') if isinstance(payload.get('custom'), list) else []
                overrides_map = payload.get('overrides') if isinstance(payload.get('overrides'), dict) else {}
                incoming = sum(role_storage_bytes(role) for role in [*custom_list, *overrides_map.values()])
                limit=ACCOUNT_STORAGE.quota(user_id)
                if assets_only + incoming > limit:
                    return self.send_json({
                        'error': 'storage_quota_exceeded',
                        'message': f'个人存储空间不足，请删除部分素材（已用 {human_bytes(assets_only + incoming)} / {human_bytes(limit)}）',
                    }, 413)
            return self.send_json({'ok': True, 'scope': raw_scope, **write_scoped_preset_roles(raw_scope, user.get('id'), payload)})
        if path == '/api/preset-prompts/reset':
            if user.get('role') != 'admin':
                return self.send_json({'error': 'forbidden', 'message': '需要管理员权限才能恢复默认提示词'}, 403)
            payload = reset_preset_prompts()
            return self.send_json({'ok': True, 'updatedAt': payload.get('updatedAt')})
        # 运镜 / 表情的提示词恢复默认（r832）：只有管理员。`kind` 只清对应那张表。
        if path == '/api/dock-prompts/reset':
            if user.get('role') != 'admin':
                return self.send_json({'error': 'forbidden', 'message': '需要管理员权限才能恢复默认提示词'}, 403)
            incoming = self.read_json()
            kind = incoming.get('kind') if isinstance(incoming, dict) else None
            payload = reset_dock_prompts(kind)
            if payload is None:
                return self.send_json({'error': 'bad_request', 'message': 'kind 只能是 camera / emotion / emotionDynamic'}, 400)
            return self.send_json({'ok': True, 'updatedAt': payload.get('updatedAt')})
        # 重命名对话（历史面板里的行内改名）。写操作必须校验工作区：读宽写严。
        if path.startswith('/api/agent/sessions/'):
            return self.agent_session_rename(user, path.split('/')[-1], self.read_json())
        # 编辑已上传的素材（改名 / 改标签 / 改类型）；只有本人上传的素材可编辑。
        if path.startswith('/api/assets/'):
            incoming = self.read_json()
            item_id = path.split('/')[-1]
            with LOCK:
                items = read_assets()
                target = next((item for item in items if item.get('id') == item_id), None)
                if not target: return self.send_json({'error': 'asset_not_found', 'message': '素材不存在'}, 404)
                if target.get('ownerId') != user['id']: return self.send_json({'error': 'forbidden', 'message': '只能编辑自己上传的素材'}, 403)
                if incoming.get('kind') is not None and incoming.get('kind') != target.get('kind'):
                    try: validate_asset_media(str(incoming['kind']),resolve_media_file(target['mediaId']) if target.get('mediaId') else None,target.get('data',''))
                    except ValueError as error: return self.send_json({'error':'invalid_file_format','message':str(error)},400)
                if incoming.get('name') is not None: target['name'] = (str(incoming.get('name')).strip()[:160] or target.get('name'))
                if incoming.get('tag') is not None: target['tag'] = str(incoming.get('tag'))[:20]
                if incoming.get('kind') is not None: target['kind'] = str(incoming.get('kind'))[:30]
                validate_new_media(user['id'],target, next((item for item in read_assets() if item.get('id')==item_id),{}))
                write_file(ASSETS_FILE, items)
            return self.send_json({'asset': target})
        if path.startswith('/api/admin/ai-models/'):
            scope, err = self.model_scope_request(user)
            if err: return self.send_json(err, 403)
            incoming = self.read_json()
            model_id = path.split('/')[-1]
            turned_off = False
            specs_removed = []
            with LOCK:
                items = scoped_ai_models(scope, user['id'])
                index = next((i for i, m in enumerate(items) if m.get('id') == model_id), None)
                if index is None: return self.send_json({'error': 'ai_model_not_found', 'message': '模型不存在'}, 404)
                was_enabled = items[index].get('enabled') is not False
                item = normalize_ai_model(incoming, items[index])
                validate_provider_access(user.get('role'),item['baseUrl'])
                old_key=items[index].get('apiKey') or ''
                if old_key and http_origin(item['baseUrl'])!=http_origin(items[index]['baseUrl']) and item.get('apiKey')==old_key and str(incoming.get('apiKey') or '').strip()!=old_key:
                    raise NetworkAccessError('更换接口主机后必须重新填写 API Key，不能把原密钥转发到其他主机',400)
                if not item['name'] or not item['model'] or not item['baseUrl']:
                    return self.send_json({'error': 'invalid_ai_model', 'message': '名称、模型标识和接口地址不能为空'}, 400)
                # ★ 归属字段**不能由客户端改**：按当前作用域强制写回（改别人作用域的模型也够不着 —— 上面已按 scope 取过列表）
                item['ownerId'] = '' if scope == 'global' else str(user['id'])
                items[index] = item
                write_scoped_ai_models(scope, user['id'], items)
                # ★★★ 生命周期同步（2026-09-25，用户需求）：「停用」也要连带清掉规格登记。
                #   ★ 判据用 **转移**（曾启用 → 现停用），不是「当前停用」——
                #     否则编辑一个一直停用的模型会反复触发清理（幂等但白跑一遍读盘）。
                turned_off = was_enabled and item.get('enabled') is False
            if turned_off:
                # ★ 传「当前作用域下仍启用的模型」——刚停用的那个不在里面 → 它的登记行被清。
                #   放在 LOCK 外面：`prune_model_specs` 自己读模型表，锁内再读会自我等待。
                try:
                    live = [m for m in scoped_ai_models(scope, user['id']) if m.get('enabled') is not False]
                    specs_removed, _ = prune_model_specs(live)
                except Exception as exc:  # noqa: BLE001 —— 尽力而为，绝不能连累保存
                    print(f'[CanvasFlow API] 模型 {model_id} 停用后清理规格登记失败：{exc}')
            payload = {'model': ai_model_public(item)}
            if specs_removed:
                payload['specsRemoved'] = specs_removed
                payload['message'] = f'模型已停用，并同时删除其规格配置（{"、".join(specs_removed)}）'
            return self.send_json(payload)
        if path.startswith('/api/admin/plans/'):
            # 管理后台 → 套餐管理：编辑订阅套餐（全量更新表单字段）。
            if user.get('role') != 'admin': return self.send_json({'error': 'forbidden', 'message': '需要管理员权限'}, 403)
            plan_id = path.split('/')[-1]
            payload = self.read_json()
            if not isinstance(payload, dict): return self.send_json({'error': 'bad_request', 'message': '请求体格式不正确'}, 400)
            plan, err, status = plan_from_payload(payload, plan_id=plan_id)
            if err: return self.send_json(err, status)
            with LOCK:
                plans = read_subscription_plans()
                index = next((i for i, item in enumerate(plans) if str(item.get('id')) == plan_id), None)
                if index is None: return self.send_json({'error': 'plan_not_found', 'message': '套餐不存在或已被删除'}, 404)
                plans[index] = plan
                write_subscription_plans(plans)
            return self.send_json({'plan': plan_public(plan), 'plans': [plan_public(item) for item in plans]})
        if path.startswith('/api/admin/users/'):
            if user.get('role') != 'admin': return self.send_json({'error': 'forbidden', 'message': '需要管理员权限'}, 403)
            incoming = self.read_json()
            user_id = path.split('/')[-1]
            if 'status' in incoming and incoming.get('status') not in ('active','suspended'):
                return self.send_json({'error':'invalid_status','message':'账户状态无效'},400)
            if 'role' in incoming and str(incoming.get('role') or '').strip() not in {'user','vip','admin'}:
                return self.send_json({'error':'invalid_role','message':'角色只能是普通用户 / VIP 用户 / 管理员'},400)
            if 'creditDelta' in incoming:
                value=incoming['creditDelta']
                if isinstance(value,bool) or not re.fullmatch(r'-?\d+',str(value)):
                    return self.send_json({'error':'invalid_credit_delta','message':'余额调整必须是有效金额，最多保留两位小数'},400)
            if user_id==user['id'] and incoming.get('status')=='suspended':
                return self.send_json({'error':'cannot_suspend_self','message':'不能停用当前管理员账户'},400)
            with auth_db() as db:
                account = db.execute('SELECT id, nickname, avatar, role, status FROM users WHERE id = ?', (user_id,)).fetchone()
                if not account: return self.send_json({'error': 'user_not_found'}, 404)
                if user_id==user['id'] and 'role' in incoming and incoming['role']!=account['role']:
                    return self.send_json({'error':'cannot_change_own_role','message':'不能修改自己的角色'},400)
                now_stamp = auth_iso()
                if 'status' in incoming and incoming.get('status') in {'active', 'suspended'}:
                    if user_id == user['id'] and incoming.get('status') == 'suspended': return self.send_json({'error': 'cannot_suspend_self', 'message': '不能停用当前管理员账户'}, 400)
                    db.execute('UPDATE users SET status=?, updated_at=? WHERE id=?', (incoming['status'], now_stamp, user_id))
                # 角色白名单。vip 只是身份标签（不进管理员分支、不额外授权），
                # 权限判定一律认 role == 'admin'，所以加它不会影响任何现有判断。
                # 非法值**明确报错**而不是静默忽略：静默忽略会让「前端传错值」表现为
                # 「保存成功但没变」，以后再加角色时极难排查。
                if 'role' in incoming:
                    next_role = str(incoming.get('role') or '').strip()
                    if next_role not in {'user', 'vip', 'admin'}:
                        return self.send_json({'error': 'invalid_role', 'message': '角色只能是普通用户 / VIP 用户 / 管理员'}, 400)
                    # ★ 只拦「真的改了角色」：前端保存行时总带着当前角色值（含自己那行），
                    #   旧逻辑对自己无条件 400，连带同一请求里的 creditDelta 一起被拦 ——
                    #   管理员在后台给自己调余额永远失败，个人中心/侧边栏永远不同步。
                    if user_id == user['id'] and next_role != (account['role'] or 'user'):
                        return self.send_json({'error': 'cannot_change_own_role', 'message': '不能修改自己的角色'}, 400)
                    if next_role != (account['role'] or 'user'):
                        db.execute('UPDATE users SET role=?, updated_at=? WHERE id=?', (next_role, now_stamp, user_id))
                if 'creditDelta' in incoming:
                    try: delta = parse_credit_delta(incoming.get('creditDelta') or 0)
                    except (TypeError, ValueError): return self.send_json({'error': 'invalid_credit_delta', 'message': '余额调整必须是有效金额，最多保留两位小数'}, 400)
                    delta = max(-10_000_000, min(10_000_000, delta))
                    if delta:
                        db.execute('INSERT INTO credit_ledger (id,user_id,amount,reason,created_at) VALUES (?,?,?,?,?)', (f'credit-{uuid.uuid4().hex}', user_id, delta, str(incoming.get('creditReason') or '管理员调整')[:200], now_stamp))
                row = db.execute("SELECT u.id, u.nickname, u.avatar, u.role, u.status, u.created_at, i.identifier AS email, COALESCE(credits.balance, 0) AS credit_balance FROM users u LEFT JOIN auth_identities i ON i.user_id=u.id AND i.type='email' LEFT JOIN (SELECT user_id,SUM(CAST(ROUND(amount * 100) AS INTEGER)) / 100.0 AS balance FROM credit_ledger GROUP BY user_id) credits ON credits.user_id=u.id WHERE u.id=?", (user_id,)).fetchone()
            payload = {'id': row['id'], 'nickname': row['nickname'], 'avatar': row['avatar'], 'email': row['email'] or '', 'role': row['role'] or 'user', 'status': row['status'], 'createdAt': row['created_at'], 'creditBalance': credit_amount(row['credit_balance'] or 0)}
            return self.send_json({'user': payload})
        if path.startswith('/api/music/'):
            music_id, incoming = path.split('/')[-1], self.read_json()
            with LOCK:
                items = read_music(); track = next((item for item in items if item.get('id') == music_id), None)
                if not track: return self.send_json({'error': 'music_not_found'}, 404)
                if not track.get('shared', True) and track.get('ownerId') != user['id']:
                    return self.send_json({'error': 'forbidden', 'message': '此音乐仅所有者可见'}, 403)
                if incoming.get('action') == 'like': track['likes'] = int(track.get('likes') or 0) + 1
                write_music(items)
            return self.send_json({'music': track})
        if path.startswith('/api/models/'):
            model_id, incoming = path.split('/')[-1], self.read_json()
            with LOCK:
                items = read_models(); model = next((item for item in items if item.get('id') == model_id), None)
                if not model: return self.send_json({'error': 'model_not_found'}, 404)
                if not model.get('shared') and model.get('ownerId') != user['id']:
                    return self.send_json({'error': 'forbidden', 'message': '此模型仅所有者可见'}, 403)
                if any(k in incoming for k in ('shared','description','name')) and model.get('ownerId') != user['id']:
                    return self.send_json({'error':'forbidden','message':'只能编辑自己分享的模型'},403)
                if incoming.get('action') == 'use': model['uses'] = int(model.get('uses') or 0) + 1
                if 'shared' in incoming: model['shared'] = bool(incoming.get('shared'))
                if isinstance(incoming.get('description'), str): model['description'] = incoming['description'].strip()[:300]
                write_models(items)
            return self.send_json({'model': model})
        if path.startswith('/api/workspaces/'):
            target_id, incoming = path.split('/')[-1], self.read_json()
            user = self.authenticated_user()
            if not user: return self.send_json({'error': 'unauthenticated', 'message': '请先登录'}, 401)
            name = str(incoming.get('name') or '').strip()[:40]
            if not name: return self.send_json({'error': 'invalid_name', 'message': '请填写工作区名称'}, 400)
            with LOCK:
                items = read_workspaces()
                target = next((item for item in items
                               if item.get('id') == target_id and item.get('userId') == user['id']), None)
                if not target: return self.send_json({'error': 'workspace_not_found', 'message': '工作区不存在'}, 404)
                target['name'] = name
                if isinstance(incoming.get('type'), str) and incoming['type'].strip():
                    target['type'] = incoming['type'].strip()[:20]
                target['updatedAt'] = now()
                write_workspaces(items)
            return self.send_json({'workspace': workspace_view(target)})
        if not path.startswith('/api/projects/'): return self.send_json({'error': 'not_found'}, 404)
        project_id, incoming = path.split('/')[-1], self.read_json()
        user = self.authenticated_user()
        if not user: return self.send_json({'error': 'unauthenticated', 'message': '请先登录'}, 401)
        workspace_id, valid = self.workspace_scope(user)
        with LOCK:
            projects = read_projects()
            index = next((i for i, item in enumerate(projects) if item.get('id') == project_id), None)
            # PUT is update-only now: unknown ids used to auto-create projects, so stray requests
            # silently accumulated garbage entries in projects.json.
            if index is None: return self.send_json({'error': 'project_not_found'}, 404)
            if projects[index].get('ownerId') != user['id']:
                return self.send_json({'error': 'forbidden', 'message': '只能编辑自己的项目'}, 403)
            # 写路径必须挡：读得到别的工作区的项目（深链/示例）不代表能在本空间里改它。
            if not in_workspace(projects[index], workspace_id, valid):
                return self.send_json({'error': 'workspace_mismatch', 'message': '该项目属于另一个工作区，请先切换过去'}, 403)
            # ★ 乐观锁：客户端带了自己最后看到的 revision，和服务端不一致就拒写（数据原样不动）。
            #   不带 revision 的调用方（封面更新、工作区移动、老客户端）走老路径，行为不变。
            expected_revision = incoming.pop('revision', None)
            current_revision = project_revision(projects[index])
            if expected_revision is not None:
                try:
                    if isinstance(expected_revision, bool) or not isinstance(expected_revision, (int, str)):
                        raise ValueError('invalid revision')
                    expected_value = int(expected_revision)
                except (TypeError, ValueError):
                    return self.send_json({'error': 'invalid_revision', 'message': '项目版本号无效，请刷新后重试'}, 400)
                if expected_value != current_revision:
                    return self.send_json({
                        'error': 'revision_conflict',
                        'message': '这个项目已在别处被更新（可能是另一个标签页），本次保存被拦下以免覆盖',
                        'revision': current_revision,
                        'updatedAt': projects[index].get('updatedAt') or projects[index].get('updated_at') or '',
                    }, 409)
            previous_media=media_ids(projects[index])
            current = dict(projects[index]); current.update(incoming); project = clean_project(current, project_id)
            for field in ('ownerId', 'ownerName', 'ownerAvatar'):
                project[field] = projects[index].get(field, '')
            project['revision'] = current_revision + 1
            # 移动项目是工作区之间唯一的受控出口（只能移到自己名下的空间）。
            target = str(incoming.get('workspaceId') or '').strip()
            if target and target != workspace_id:
                allowed = {str(item.get('id')) for item in workspaces_for_user(user['id'])}
                if target not in allowed:
                    return self.send_json({'error': 'workspace_not_found', 'message': '目标工作区不存在'}, 404)
                project['workspaceId'] = target
            else:
                project['workspaceId'] = workspace_id
            projects[index] = project
            validate_new_media(user['id'],project,previous_media)
            write_file(PROJECTS_FILE, projects)
        return self.send_json({'project': project})
    def do_POST(self):
        billing_token = GENERATION_REQUEST_CHARGE.set(None)
        self._billing_response_status = 500
        try:
            return self._route_post()
        except InsufficientCredits as error:
            return self.send_json(error.payload, 402)
        except ValueError as error:
            return self.send_json({'error':'invalid_model_parameters','message':str(error)},400)
        except ValueError as error:
            return self.send_json({'error':'invalid_request','message':str(error)},400)
        except PayloadTooLarge:
            return self.send_json({'error': 'payload_too_large', 'message': '请求体超过 8MB 限制，请减小参考图或素材大小后重试'}, 413)
        finally:
            scope = GENERATION_REQUEST_CHARGE.get()
            if scope and not scope.get('deferred') and not scope['charge'].get('settled'):
                settle_generation_charge(scope['charge'], failed=self._billing_response_status >= 400)
            GENERATION_REQUEST_CHARGE.reset(billing_token)
    def _route_post(self):
        path = unquote(urlparse(self.path).path).rstrip('/')
        if path in ('/api/film/open', '/api/film/import', '/api/film/action'):
            return self.film_workbench_api(path)
        if path == '/api/blender/jobs':return self.blender_api(path, 'POST')
        if path in ('/api/workspace/materials/categories','/api/workspace/materials/restore'):
            return self.workspace_materials_api(path,'POST')
        if path.startswith('/api/storage/'):return self.storage_api(path,'POST')
        if path == '/api/portfolio' or path.startswith('/api/portfolio/'):
            return self.portfolio_api(path,'POST')
        if path in ('/api/admin/notifications', '/api/notifications/ack'):
            return self.notifications_api(path,'POST')
        # 「了解 CanvasFlow」API 桩（r916）：learn/ 快照页全部用 POST 调配置接口，
        # 必须在鉴权之前分流（踩过：落到下面 authenticated_user() 对未登录直接崩）。
        raw_path = unquote(urlparse(self.path).path)
        if raw_path.startswith('/learnapi/'):
            return self.learn_api_stub(raw_path)
        # 管理后台 → 套餐管理：新增订阅套餐。
        # ★ 管理员校验必须在**本分支内**完成，不能提到函数顶部：
        #   顶部拦截会把后面所有未登录分支（登录/注册/发码）一并挡掉——未登录用户连
        #   /api/auth/login 都到不了，且 authenticated_user() 返回 None 时 user.get() 直接
        #   崩掉连接（踩过：登录请求 "Failed to fetch"，r921 修正）。
        if path == '/api/admin/plans':
            user = self.authenticated_user()
            if not user or user.get('role') != 'admin': return self.send_json({'error': 'forbidden', 'message': '需要管理员权限'}, 403)
            payload = self.read_json()
            if not isinstance(payload, dict): return self.send_json({'error': 'bad_request', 'message': '请求体格式不正确'}, 400)
            plan, err, status = plan_from_payload(payload)
            if err: return self.send_json(err, status)
            with LOCK:
                plans = read_subscription_plans()
                plans.append(plan)
                write_subscription_plans(plans)
            return self.send_json({'plan': plan_public(plan), 'plans': [plan_public(item) for item in plans]})
        # 二进制上传路由**不能先 read_json()** —— 那会把整个 body 读走（而且非 JSON 直接吞掉返回 {}），
        # 之后路由里再想读 body 就只剩 EOF，rfile.read() 会一直阻塞到连接超时。
        # 所以这条路径提前分流，自己管 body。
        if path == '/api/media':
            return self.handle_media_upload()
        if path == '/api/media/gc':
            # 扫掉落盘目录，删掉「谁都不引用」的孤儿文件（r686）。
            # 为什么需要它：删掉一个带图的**节点**（而不是删素材）时，项目快照里那条
            # `previewMedia` 引用就没了，但文件不会被任何一条删除路径扫到 ——
            # 只有这里做全量对账才能收回来。
            # 只删「全库无引用」的，所以是安全的；但它是全局维护操作，限管理员。
            # 注意：这条分支在 `read_json()` 之前，`user` 还没取，得自己鉴权。
            gc_user = self.authenticated_user()
            if not gc_user:
                return self.send_json({'error': 'unauthenticated', 'message': '请先登录'}, 401)
            if gc_user.get('role') != 'admin':
                return self.send_json({'error': 'forbidden', 'message': '需要管理员权限才能执行存储清理'}, 403)
            with LOCK:
                assets, projects = read_assets(), read_projects()
                scanned, removed, freed = 0, [], 0
                for name in sorted(os.listdir(MEDIA_DIR)):
                    if not MEDIA_SAFE_NAME.match(name):
                        continue
                    scanned += 1
                    record=ACCOUNT_STORAGE.file_row(name)
                    if record and record['expiresAt']>time.time():continue
                    # Upload and asset/project save are separate requests. Keep fresh
                    # uploads while the second request is still being prepared.
                    try:
                        if (MEDIA_DIR / name).stat().st_mtime > time.time() - 600:continue
                    except OSError:continue
                    if media_referenced_by(name, assets, projects):
                        continue
                    target = MEDIA_DIR / name
                    try:
                        size = target.stat().st_size
                        target.unlink()
                    except OSError:
                        continue
                    removed.append(name); freed += size
            return self.send_json({'scanned': scanned, 'deleted': len(removed),
                                   'freedBytes': freed, 'deletedFiles': removed[:50]})
        incoming = self.read_json()
        if path == '/api/follows':
            user = self.authenticated_user()
            if not user: return self.send_json({'error': 'unauthenticated', 'message': '请先登录'}, 401)
            result, err = social_set_follow(user['id'], incoming.get('userId'), True)
            return self.send_json(result, err or 200)
        if path == '/api/likes':
            user = self.authenticated_user()
            if not user: return self.send_json({'error': 'unauthenticated', 'message': '请先登录'}, 401)
            result, err = social_set_like(user['id'], incoming.get('kind'), incoming.get('id'), True)
            return self.send_json(result, err or 200)
        if path == '/api/auth/send-code':
            if not agreement_is_accepted(incoming):
                return self.send_json({'error': 'agreement_required', 'message': '请先阅读并同意用户服务协议和隐私政策', 'agreementVersion': AGREEMENT_VERSION}, 400)
            email = normalize_email(incoming.get('email'))
            email_error = registration_email_error(incoming.get('email'))
            if email_error:
                return self.send_json(email_error, 400)
            current_dt = auth_now(); current = auth_iso(current_dt)
            minute_ago = auth_iso(current_dt - timedelta(seconds=60))
            hour_ago = auth_iso(current_dt - timedelta(hours=1))
            day_ago = auth_iso(current_dt - timedelta(days=1))
            ip = self.client_ip()
            with auth_db() as db:
                existing = db.execute("SELECT u.password_hash FROM auth_identities i JOIN users u ON u.id = i.user_id WHERE i.type = 'email' AND i.normalized_identifier = ?", (email,)).fetchone()
            if existing and existing['password_hash']:
                return self.send_json({'error': 'email_registered', 'message': '该邮箱已经注册，请直接登录'}, 409)
            code_id,code,error=reserve_verification_code(email,'register',ip,'')
            if error:return self.send_json(error,429)
            try:
                delivery=send_login_email(email,code,'register')
            except Exception as exc:
                with auth_db() as db:db.execute('UPDATE verification_codes SET consumed_at=? WHERE id=?',(auth_iso(),code_id))
                print(f'[CanvasFlow Auth] email delivery failed: {exc}')
                return self.send_json({'error':'email_delivery_failed','message':'验证码邮件发送失败，请检查邮件服务配置'},502)
            payload = {'sent': True, 'email': email, 'expiresIn': 600, 'delivery': delivery, 'purpose': 'register'}
            if delivery == 'development' and AUTH_DEV_MODE:
                payload['devCode'] = code
            return self.send_json(payload, 202)
        if path == '/api/auth/register':
            if not agreement_is_accepted(incoming):
                return self.send_json({'error': 'agreement_required', 'message': '请先阅读并同意用户服务协议和隐私政策', 'agreementVersion': AGREEMENT_VERSION}, 400)
            email = normalize_email(incoming.get('email'))
            password, password_error = validate_password(incoming.get('password'))
            code = str(incoming.get('code') or '').strip()
            email_error = registration_email_error(incoming.get('email'))
            if email_error:
                return self.send_json(email_error, 400)
            if password_error:
                return self.send_json({'error': 'weak_password', 'message': password_error}, 400)
            if not re.fullmatch(r'\d{6}', code):
                return self.send_json({'error': 'invalid_code', 'message': '请输入邮箱收到的六位验证码'}, 400)
            current_dt = auth_now(); current = auth_iso(current_dt)
            with auth_db() as db:
                db.execute('BEGIN IMMEDIATE')
                row = db.execute("SELECT * FROM verification_codes WHERE channel = 'email' AND identifier = ? AND purpose = 'register' AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1", (email,)).fetchone()
                if not row:
                    return self.send_json({'error': 'code_not_found', 'message': '请先获取注册验证码'}, 400)
                if row['expires_at'] <= current:
                    db.execute('UPDATE verification_codes SET consumed_at = ? WHERE id = ?', (current, row['id']))
                    return self.send_json({'error': 'code_expired', 'message': '验证码已过期，请重新获取'}, 400)
                if int(row['attempts'] or 0) >= 5:
                    db.execute('UPDATE verification_codes SET consumed_at = ? WHERE id = ?', (current, row['id']))
                    return self.send_json({'error': 'attempt_limit', 'message': '验证码错误次数过多，请重新获取'}, 429)
                if not hmac.compare_digest(row['code_hash'], verification_digest(email, code, 'register')):
                    db.execute('UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?', (row['id'],))
                    return self.send_json({'error': 'code_mismatch', 'message': '验证码不正确'}, 400)
                identity_row = db.execute("SELECT i.user_id, u.nickname, u.avatar, u.role, u.password_hash FROM auth_identities i JOIN users u ON u.id = i.user_id WHERE i.type = 'email' AND i.normalized_identifier = ?", (email,)).fetchone()
                password_hash, password_salt = create_password_hash(password)
                if identity_row and identity_row['password_hash']:
                    return self.send_json({'error': 'email_registered', 'message': '该邮箱已经注册，请直接登录'}, 409)
                if identity_row:
                    user_id, nickname, avatar, role = identity_row['user_id'], identity_row['nickname'], identity_row['avatar'], identity_row['role'] or 'user'
                    db.execute('UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?', (password_hash, password_salt, current, user_id))
                    is_new = False
                else:
                    user_id = f'user-{uuid.uuid4().hex}'
                    nickname = email_display_name(email)
                    avatar = (nickname[:1] or 'C').upper()
                    role = 'user'
                    db.execute('INSERT INTO users (id, nickname, avatar, status, role, password_hash, password_salt, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', (user_id, nickname, avatar, 'active', 'user', password_hash, password_salt, current, current))
                    db.execute('INSERT INTO auth_identities (id, user_id, type, identifier, normalized_identifier, verified_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', (f'identity-{uuid.uuid4().hex}', user_id, 'email', email, email, current, current))
                    is_new = True
                db.execute('UPDATE verification_codes SET consumed_at = ? WHERE id = ?', (current, row['id']))
                record_agreement_acceptance(db, user_id, email, 'register', self.client_ip(), self.headers.get('User-Agent'), current)
                token = create_session(db, user_id, current_dt)
            user = {'id': user_id, 'nickname': nickname, 'avatar': avatar, 'email': email, 'phone': '', 'role': role}
            return self.send_json({'user': user, 'isNew': is_new}, 201 if is_new else 200, {'Set-Cookie': self.auth_cookie(token)})
        if path == '/api/auth/login':
            if not agreement_is_accepted(incoming):
                return self.send_json({'error': 'agreement_required', 'message': '请先阅读并同意用户服务协议和隐私政策', 'agreementVersion': AGREEMENT_VERSION}, 400)
            email = normalize_email(incoming.get('email'))
            password = str(incoming.get('password') or '')
            if not email or not password:
                return self.send_json({'error': 'missing_credentials', 'message': '请输入邮箱和密码'}, 400)
            current_dt = auth_now(); current = auth_iso(current_dt)
            window_start = auth_iso(current_dt - timedelta(minutes=15))
            ip = self.client_ip()
            with auth_db() as db:
                db.execute('BEGIN IMMEDIATE')
                failed_email = db.execute('SELECT COUNT(*) FROM login_attempts WHERE identifier = ? AND successful = 0 AND created_at >= ?', (email, window_start)).fetchone()[0]
                failed_ip = db.execute('SELECT COUNT(*) FROM login_attempts WHERE requested_ip = ? AND successful = 0 AND created_at >= ?', (ip, window_start)).fetchone()[0]
                if failed_email >= 10 or failed_ip >= 30:
                    return self.send_json({'error': 'login_limited', 'message': '登录失败次数过多，请 15 分钟后再试'}, 429)
                account = db.execute("SELECT i.user_id, i.identifier AS email, u.nickname, u.avatar, u.status, u.role, u.phone, u.password_hash, u.password_salt FROM auth_identities i JOIN users u ON u.id = i.user_id WHERE i.type = 'email' AND i.normalized_identifier = ?", (email,)).fetchone()
                credentials_valid = bool(account and account['password_hash'] and verify_password(password, account['password_hash'], account['password_salt']))
                if credentials_valid and account['status'] == 'suspended':
                    return self.send_json({'error': 'account_suspended', 'message': ACCOUNT_SUSPENDED_MESSAGE}, 403, {'Set-Cookie': self.auth_cookie(clear=True)})
                valid = bool(credentials_valid and account['status'] == 'active')
                db.execute('INSERT INTO login_attempts (id, identifier, requested_ip, successful, created_at) VALUES (?, ?, ?, ?, ?)', (f'attempt-{uuid.uuid4().hex}', email, ip, 1 if valid else 0, current))
                if not valid:
                    return self.send_json({'error': 'invalid_credentials', 'message': '邮箱或密码不正确'}, 401)
                record_agreement_acceptance(db, account['user_id'], email, 'login', ip, self.headers.get('User-Agent'), current)
                token = create_session(db, account['user_id'], current_dt)
                user = {'id': account['user_id'], 'nickname': account['nickname'], 'avatar': account['avatar'], 'email': account['email'], 'phone': account['phone'] or '', 'role': account['role'] or 'user'}
            return self.send_json({'user': user}, 200, {'Set-Cookie': self.auth_cookie(token)})
        if path == '/api/auth/verify-code':
            return self.send_json({'error': 'deprecated_flow', 'message': '请使用邮箱、密码和验证码完成注册'}, 410)
        if path == '/api/auth/logout':
            token = self.session_token()
            if token:
                with auth_db() as db:
                    db.execute('DELETE FROM sessions WHERE token_hash = ?', (session_digest(token),))
            return self.send_json({'loggedOut': True}, 200, {'Set-Cookie': self.auth_cookie(clear=True)})
        user = self.authenticated_user()
        if not user:
            return self.send_json({'error': 'unauthenticated', 'message': '请先登录'}, 401)
        if path == '/api/agent/quote':
            return self.send_json({'quote':agent_chat_quote(user,incoming)})
        if path == '/api/ai/quote':
            _, quote = quote_request(user, path, incoming)
            return self.send_json({'quote':quote})
        if path in PAID_GENERATION_PATHS:
            prepare_request_generation(user, path, incoming)
        if path.startswith('/api/ai/') or path in ('/api/generate','/api/agent/chat'):
            validate_new_media(user['id'],incoming)
            ACCOUNT_STORAGE.ensure(user['id'],1)
        if re.fullmatch(r'/api/assets/[^/]+/share', path):
            if not isinstance(incoming.get('shared'), bool):
                return self.send_json({'error': 'invalid_share', 'message': '分享状态必须为开启或关闭'}, 400)
            item_id = path.split('/')[-2]
            with LOCK:
                items = read_assets()
                target = next((item for item in items if item.get('id') == item_id), None)
                if not target: return self.send_json({'error': 'asset_not_found'}, 404)
                if target.get('ownerId') != user['id']:
                    return self.send_json({'error': 'forbidden', 'message': '只能操作自己的素材'}, 403)
                target['shared'] = incoming['shared']
                write_file(ASSETS_FILE, items)
            return self.send_json({'asset': target})
        if re.fullmatch(r'/api/community/shares/(?:projects|images|videos|music|models)(?:/[^/]+)?',path):
            return self.community_share_api(path,incoming)
        if path.startswith('/api/previs/assets') or re.fullmatch(r'/api/models/[^/]+/favorite',path):
            return self.previs_assets_api(path, 'POST', incoming)
        if path == '/api/media/migrate-inline':
            if user.get('role') != 'admin': return self.send_json({'error': 'forbidden', 'message': '需要管理员权限'}, 403)
            # 默认 dry-run：真迁移必须显式传 dryRun=false（避免误点一下就动一百多 MB 数据）
            dry_run = incoming.get('dryRun') is not False
            try:
                limit = int(incoming.get('limit') or 0)
            except (TypeError, ValueError):
                limit = 0
            return self.send_json({'report': migrate_inline_assets(dry_run=dry_run, limit=max(0, limit))})
        if path == '/api/account/phone':
            phone = normalize_phone(incoming.get('phone'))
            current_password = str(incoming.get('currentPassword') or '')
            if not phone:
                return self.send_json({'error': 'invalid_phone', 'message': '请输入有效的 11 位手机号'}, 400)
            with auth_db() as db:
                account = db.execute('SELECT password_hash, password_salt FROM users WHERE id = ?', (user['id'],)).fetchone()
                if not account or not account['password_hash'] or not verify_password(current_password, account['password_hash'], account['password_salt']):
                    return self.send_json({'error': 'invalid_credentials', 'message': '当前密码不正确'}, 401)
                taken = db.execute('SELECT 1 FROM users WHERE phone = ? AND id != ?', (phone, user['id'])).fetchone()
                if taken:
                    return self.send_json({'error': 'phone_registered', 'message': '该手机号已被其他账户使用'}, 409)
                db.execute('UPDATE users SET phone = ?, updated_at = ? WHERE id = ?', (phone, auth_iso(), user['id']))
            return self.send_json({'phone': phone, 'message': '手机号已更新'}, 200)
        if path == '/api/account/email/send-code':
            email = normalize_email(incoming.get('email'))
            if not email:
                return self.send_json({'error': 'invalid_email', 'message': '请输入有效的新邮箱地址'}, 400)
            current_password=str(incoming.get('currentPassword') or '')
            with auth_db() as db:
                account=db.execute('SELECT password_hash,password_salt FROM users WHERE id=?',(user['id'],)).fetchone()
                if not account or not account['password_hash'] or not verify_password(current_password,account['password_hash'],account['password_salt']):
                    return self.send_json({'error':'invalid_credentials','message':'请使用当前密码确认更换邮箱'},401)
            current_dt = auth_now(); current = auth_iso(current_dt)
            minute_ago = auth_iso(current_dt - timedelta(seconds=60))
            hour_ago = auth_iso(current_dt - timedelta(hours=1))
            day_ago = auth_iso(current_dt - timedelta(days=1))
            ip = self.client_ip()
            with auth_db() as db:
                own = db.execute("SELECT normalized_identifier FROM auth_identities WHERE type = 'email' AND user_id = ?", (user['id'],)).fetchone()
                if own and own['normalized_identifier'] == email:
                    return self.send_json({'error': 'same_email', 'message': '新邮箱和当前邮箱相同'}, 400)
                taken = db.execute("SELECT 1 FROM auth_identities WHERE type = 'email' AND normalized_identifier = ? AND user_id != ?", (email, user['id'])).fetchone()
                if taken:
                    return self.send_json({'error': 'email_registered', 'message': '该邮箱已被其他账户使用'}, 409)
            code_id,code,error=reserve_verification_code(email,'change_email',ip,user['id'])
            if error:return self.send_json(error,429)
            try:
                delivery=send_login_email(email,code,'change_email')
            except Exception as exc:
                with auth_db() as db:db.execute('UPDATE verification_codes SET consumed_at=? WHERE id=?',(auth_iso(),code_id))
                print(f'[CanvasFlow Auth] email delivery failed: {exc}')
                return self.send_json({'error':'email_delivery_failed','message':'验证码邮件发送失败，请检查邮件服务配置'},502)
            payload = {'sent': True, 'email': email, 'expiresIn': 600, 'delivery': delivery, 'purpose': 'change_email'}
            if delivery == 'development' and AUTH_DEV_MODE:
                payload['devCode'] = code
            return self.send_json(payload, 202)
        if path == '/api/account/email':
            email = normalize_email(incoming.get('email'))
            code = str(incoming.get('code') or '').strip()
            if not email:
                return self.send_json({'error': 'invalid_email', 'message': '请输入有效的新邮箱地址'}, 400)
            if not re.fullmatch(r'\d{6}', code):
                return self.send_json({'error': 'invalid_code', 'message': '请输入新邮箱收到的六位验证码'}, 400)
            current_dt = auth_now(); current = auth_iso(current_dt)
            with auth_db() as db:
                db.execute('BEGIN IMMEDIATE')
                own = db.execute("SELECT id, normalized_identifier FROM auth_identities WHERE type = 'email' AND user_id = ?", (user['id'],)).fetchone()
                if own and own['normalized_identifier'] == email:
                    return self.send_json({'error': 'same_email', 'message': '新邮箱和当前邮箱相同'}, 400)
                taken = db.execute("SELECT 1 FROM auth_identities WHERE type = 'email' AND normalized_identifier = ? AND user_id != ?", (email, user['id'])).fetchone()
                if taken:
                    return self.send_json({'error': 'email_registered', 'message': '该邮箱已被其他账户使用'}, 409)
                row = db.execute("SELECT * FROM verification_codes WHERE channel = 'email' AND identifier = ? AND purpose = 'change_email' AND requested_user_id=? AND consumed_at IS NULL ORDER BY created_at DESC LIMIT 1", (email,user['id'])).fetchone()
                if not row:
                    return self.send_json({'error': 'code_not_found', 'message': '请先获取新邮箱的验证码'}, 400)
                if row['expires_at'] <= current:
                    db.execute('UPDATE verification_codes SET consumed_at = ? WHERE id = ?', (current, row['id']))
                    return self.send_json({'error': 'code_expired', 'message': '验证码已过期，请重新获取'}, 400)
                if int(row['attempts'] or 0) >= 5:
                    db.execute('UPDATE verification_codes SET consumed_at = ? WHERE id = ?', (current, row['id']))
                    return self.send_json({'error': 'attempt_limit', 'message': '验证码错误次数过多，请重新获取'}, 429)
                if not hmac.compare_digest(row['code_hash'], verification_digest(email, code, 'change_email')):
                    db.execute('UPDATE verification_codes SET attempts = attempts + 1 WHERE id = ?', (row['id'],))
                    return self.send_json({'error': 'code_mismatch', 'message': '验证码不正确'}, 400)
                db.execute('UPDATE verification_codes SET consumed_at = ? WHERE id = ?', (current, row['id']))
                if own:
                    db.execute("UPDATE auth_identities SET identifier = ?, normalized_identifier = ?, verified_at = ? WHERE id = ?", (email, email, current, own['id']))
                else:
                    db.execute("INSERT INTO auth_identities (id, user_id, type, identifier, normalized_identifier, verified_at, created_at) VALUES (?, ?, 'email', ?, ?, ?, ?)", (f'identity-{uuid.uuid4().hex}', user['id'], email, email, current, current))
                account = db.execute('SELECT nickname, avatar, role, phone FROM users WHERE id = ?', (user['id'],)).fetchone()
            updated = {'id': user['id'], 'nickname': account['nickname'], 'avatar': account['avatar'], 'email': email, 'phone': account['phone'] or '', 'role': account['role'] or 'user'}
            return self.send_json({'user': updated, 'message': '邮箱已更新，下次登录请使用新邮箱'}, 200)
        if path == '/api/account/password':
            current_password = str(incoming.get('currentPassword') or '')
            new_password, password_error = validate_password(incoming.get('newPassword'))
            if password_error:
                return self.send_json({'error': 'weak_password', 'message': password_error}, 400)
            with auth_db() as db:
                account = db.execute('SELECT password_hash, password_salt FROM users WHERE id = ?', (user['id'],)).fetchone()
                if not account or not account['password_hash'] or not verify_password(current_password, account['password_hash'], account['password_salt']):
                    return self.send_json({'error': 'invalid_credentials', 'message': '当前密码不正确'}, 401)
                if verify_password(new_password, account['password_hash'], account['password_salt']):
                    return self.send_json({'error': 'same_password', 'message': '新密码不能和当前密码相同'}, 400)
                password_hash, password_salt = create_password_hash(new_password)
                db.execute('UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?', (password_hash, password_salt, auth_iso(), user['id']))
                db.execute('DELETE FROM sessions WHERE user_id=? AND token_hash<>?',(user['id'],session_digest(self.session_token())))
                db.execute("UPDATE verification_codes SET consumed_at=? WHERE purpose='change_email' AND requested_user_id=? AND consumed_at IS NULL", (auth_iso(), user['id']))
            return self.send_json({'updated': True, 'message': '密码已更新，下次登录请使用新密码'}, 200)
        if path.startswith('/api/jobs/') and path.endswith('/cancel'):
            job_id = path.split('/')[-2]
            target = self.find_job(job_id, user['id'])
            if not target: return self.send_json({'error': 'job_not_found', 'message': '任务不存在'}, 404)
            # sync=False：取消不该顺带去上游查一次状态。
            current = job_view(target, sync=False)
            if current.get('status') in {'completed', 'failed'}:
                return self.send_json({'error': 'job_not_cancellable', 'message': '任务已经结束，无法取消'}, 409)
            entry = next((item for item in visible_ai_models(user['id']) if item.get('id') == current.get('modelId')), None)
            # 配了「取消接口」才去通知上游；没配就如实说没通知，不假装成功。
            kind = current.get('kind') or 'video'
            if kind not in ('video','image'):
                return self.send_json({'error':'job_not_cancellable','message':'该类型任务暂不支持取消，请等待任务完成'},409)
            notified, message = cancel_provider_job(entry, current, kind) if entry else (False, '找不到任务对应的模型配置，未通知上游')
            if not notified:
                return self.send_json({'error':'upstream_cancel_failed','message':message,'upstreamCancelled':False},409)
            with LOCK:
                latest = self.find_job(job_id, user['id'])
                if not latest or latest.get('status') in ('completed','failed'):
                    return self.send_json({'error':'job_not_cancellable','message':'任务已结束，请刷新查看结果'},409)
                cancelled = dict(latest)
                cancelled.update({
                    'status': 'failed', 'progress': 0, 'upstreamCancelled': True,
                    'error': f'任务已取消（{message}）', 'cancelledAt': now(),
                })
                append_job(cancelled)
            return self.send_json({
                'cancelled': True, 'upstreamCancelled': bool(notified), 'message': message,
                'job': {key: value for key, value in cancelled.items() if key != 'referenceImages'},
            })
        if path.startswith('/api/jobs/') and path.endswith('/retry'):
            original_id = path.split('/')[-2]
            original = self.find_job(original_id, user['id'])
            if not original: return self.send_json({'error': 'job_not_found', 'message': '任务不存在'}, 404)
            current = job_view(original)
            if current.get('status') != 'failed': return self.send_json({'error': 'job_not_retryable', 'message': '只有失败任务可以重试'}, 409)
            # Reuse the normal submit validation/adapter and copy all generation
            # inputs, instead of maintaining a second, incomplete retry payload.
            retry_input = {key: clone(current[key]) for key in (
                'prompt', 'projectId', 'modelId', 'generationSettings', 'advancedSettings',
                'upstreamInputs', 'referenceImages', 'sourceVideos', 'sourceAudios') if key in current}
            retry_input['outputId'] = str(incoming.get('outputId') or current.get('outputId') or '')[:100]
            workspace_id, _ = self.workspace_scope(user)
            public_job, failure = create_video_job(user, retry_input, workspace_id, retry_of=current)
            if failure:
                return self.send_json({key: value for key, value in failure.items() if key != 'status'}, failure['status'])
            return self.send_json({'job': public_job}, 202)
        if path == '/api/credits/recharge':
            return self.send_json({'error':'payment_not_configured','message':'在线支付尚未开通，请联系客服充值。积分只能由管理员核实到账后调整。'},503)
        if path == '/api/ai/tts':
            # ★ 轮询式提交：前端传 asyncTask=true 时**立即返回 jobId**，进度与结果由 /api/jobs/{id} 轮询。
            #   不传则保持原来的「一次请求等结果」行为 —— 向后兼容旧前端与其它调用方。
            if incoming.get('asyncTask') is True:
                public_job, failure = create_audio_job(user, incoming, self.workspace_scope(user)[0])
                if failure:
                    return self.send_json({key: value for key, value in failure.items() if key != 'status'}, failure['status'])
                return self.send_json({'jobId': public_job['id'], 'job': public_job}, 202)
            model_id = str(incoming.get('modelId') or '').strip()
            entry = next((m for m in visible_ai_models(user['id']) if m.get('id') == model_id and m.get('enabled') and model_has_usage(m, 'tts')), None) if model_id else None
            if not entry:
                return self.send_json({'error': 'tts_model_not_found', 'message': '所选 TTS 模型不存在或未启用，请在管理后台「模型接入」中配置文字转语音模型'}, 400)
            # ★★ 统一媒体端点（音乐 / 语音生成）：走 `POST /v1/media/generate` + 轮询。
            #    绝不能落到下面的 `call_tts` —— `audio/speech` 在 lk888 这类平台上是**路由级 404**
            #    （接口清单里只有 media/generate + skills/*），而音乐生成模型只从 media/generate 收。
            if media_generate_entry(entry):
                submitted, error = submit_audio_media_generate(
                    entry, incoming.get('text'), voice=str(incoming.get('voice') or ''),
                    spec=media_audio_spec(incoming))
                if error:
                    return self.send_json({'error': 'tts_failed', 'message': error}, 502)
                deadline = time.monotonic() + max(1, provider_timeout_value(entry, 'imageTotalWait', 3)) * 60
                polled, error = poll_audio_task(
                    entry, submitted, str(entry.get('baseUrl') or '').rstrip('/'),
                    str(entry.get('apiKey') or '').strip(), deadline)
                if error:
                    return self.send_json({'error': 'tts_failed', 'message': error}, 502)
                audio_data, error = finish_audio_result(polled, time.monotonic() + 120)
                if error:
                    return self.send_json({'error': 'tts_failed', 'message': error}, 502)
                audio_format = 'wav' if audio_data.startswith('data:audio/wav') else 'mp3'
                return self.send_json({'audio': audio_data, 'format': audio_format,
                                       'billing': charge_generation_after(
                                           user, entry, prompt_text=str(incoming.get('text') or ''),
                                           calls=1, label=entry.get('name'))}, 200)
            raw_volume = incoming.get('volume')
            audio_data, error = call_tts(
                entry, incoming.get('text'),
                voice=str(incoming.get('voice') or 'alloy'),
                speed=incoming.get('speed') or 1.0,
                pitch=incoming.get('pitch') or 0,
                volume=1.0 if raw_volume is None else raw_volume,
                mode=str(incoming.get('mode') or 'speech'),
                spec=sanitize_audio_spec(incoming.get('spec')),
            )
            if error:
                return self.send_json({'error': 'tts_failed', 'message': error}, 502)
            return self.send_json({'audio': audio_data, 'format': 'mp3',
                                   'billing': charge_generation_after(
                                       user, entry, prompt_text=str(incoming.get('text') or ''),
                                       calls=1, label=entry.get('name'))}, 200)
        if path == '/api/ai/image-generate':
            # ★ 轮询式提交：前端传 asyncTask=true 时**立即返回 jobId**，进度与结果由 /api/jobs/{id} 轮询。
            #   不传则保持原来的「一次请求等结果」行为 —— 向后兼容旧前端与其它调用方。
            if incoming.get('asyncTask') is True:
                public_job, failure = create_image_job(user, incoming, self.workspace_scope(user)[0])
                if failure:
                    return self.send_json({key: value for key, value in failure.items() if key != 'status'}, failure['status'])
                return self.send_json({'jobId': public_job['id'], 'job': public_job}, 202)
            model_id = str(incoming.get('modelId') or '').strip()
            entry = next((m for m in visible_ai_models(user['id']) if m.get('id') == model_id and m.get('enabled') and model_has_usage(m, 't2i')), None) if model_id else None
            if not entry:
                return self.send_json({'error': 'ai_model_not_found', 'message': '所选生图模型不存在或未启用，请在管理后台「模型接入」中配置'}, 400)
            raw_references = incoming.get('referenceImages')
            references = [item for item in raw_references if isinstance(item, str) and item.strip()] if isinstance(raw_references, list) else []
            # ★ 预设提示词由**服务端**注入：前端（尤其普通用户/VIP）手里没有正文，只传 presetScene。
            #   管理员那边即使把正文一起传上来，也以库里的为准 —— 免得两边悄悄不一致。
            # ★ 用户自己写的补充内容（`prompt`）**拼在后面一起发**：预设是起点，用户可以再补充。
            preset_scene = str(incoming.get('presetScene') or '').strip()[:80]
            preset_text = preset_prompt_text(preset_scene) if preset_scene else ''
            user_text = str(incoming.get('prompt') or '').strip()
            prompt_text = '\n'.join([part for part in (preset_text, user_text) if part]) or None
            # ★ r884：`tt-image-2.5-token` 这类**按 Token** 的生图模型正是「上游先预扣」的典型 ——
            #   所以这里也走两阶段（预扣 → 拿上游 usage 结算）。按次模型则是一次性平扣（差额为 0）。
            entry=image_entry_options(entry,incoming)
            charge = open_generation_charge(user, entry, prompt_text=prompt_text or '', calls=1,
                                            label=entry.get('name'))
            trace = {}
            image_data, error = call_image_generation(
                entry, prompt_text,
                size=str(incoming.get('size') or '1024x1024'),
                reference_image=incoming.get('referenceImage') if isinstance(incoming.get('referenceImage'), str) else None,
                reference_images=references,
                quality=incoming.get('quality') if isinstance(incoming.get('quality'), str) else None,
                trace=trace,
            )
            settlement = settle_generation_charge(charge, trace.get('usage'), failed=bool(error),
                                                  label=entry.get('name'))
            if error:
                return self.send_json({'error': 'image_generate_failed', 'message': error}, 502)
            return self.send_json({'image': image_data, 'model': entry.get('name'),
                                   'billing': billing_payload(charge, settlement, trace.get('usage'))}, 201)
        if path == '/api/ai/image-to-text':
            model_id = str(incoming.get('modelId') or '').strip()
            entry = next((m for m in visible_ai_models(user['id']) if m.get('id') == model_id and m.get('enabled')), None) if model_id else None
            if model_id and not entry:
                return self.send_json({'error': 'ai_model_not_found', 'message': '所选模型不存在或未启用', 'debug': {'model_id': model_id, 'enabled_ids': [m.get('id') for m in visible_ai_models(user['id']) if m.get('enabled')], 'file': str(AI_MODELS_FILE)}}, 400)
            if entry:
                description, error = describe_image_with_model(incoming.get('image'), incoming.get('instruction'), entry)
                model_name = entry.get('name')
            else:
                description, error = describe_image_with_ai(incoming.get('image'), incoming.get('instruction'))
                model_name = str(os.environ.get('OPENAI_VISION_MODEL') or '服务端默认模型')
            if error:
                status = 503 if 'OPENAI_API_KEY' in error else 502
                return self.send_json({'error': 'image_to_text_failed', 'message': error}, status)
            # ★ r884：图生文按次 / 按 Token 计费。输入侧要加**图片 token 余量** ——
            #   只按 instruction 那几十个字估算会严重低估（图才是上下文的大头）。
            return self.send_json({'description': description, 'model': model_name,
                                   'billing': charge_generation_after(
                                       user, entry, prompt_text=str(incoming.get('instruction') or ''),
                                       output_text=description or '',
                                       extra_input_tokens=VISION_INPUT_TOKEN_ALLOWANCE,
                                       label=(entry or {}).get('name'))})
        if path == '/api/ai/text-generate':
            # 文本节点底部面板的「发送」：用户输入的是要求，交给语言大模型生成正文后再写回节点。
            prompt = str(incoming.get('prompt') or '').strip()
            purpose = 'scene_agent' if incoming.get('purpose') == 'scene_agent' else 'text'
            _, output_limit, _ = text_generation_profile(purpose)
            # ★★ 脚本节点的「智能合成」走**预设模板**：前端只传 `presetScene` + 这一镜的字段值，
            #   服务端把模板里的 `【字段】` 占位替换掉再送模型。
            #   为什么不让前端拼好整段？—— 预设提示词正文按设计**只下发给管理员**，
            #   普通用户 / VIP 在浏览器里根本拿不到它（见 `preset_prompts_for_role`）。
            preset_scene = str(incoming.get('presetScene') or '').strip()
            if preset_scene:
                template = read_preset_prompts().get(preset_scene, {}).get('prompt')
                if template:
                    prompt = render_preset_template(template, incoming.get('presetFields')).strip()
            if not prompt:
                return self.send_json({'error': 'empty_prompt', 'message': '请先写下你想生成的内容'}, 400)
            model_id = str(incoming.get('modelId') or '').strip()
            entry = next((m for m in visible_ai_models(user['id']) if m.get('id') == model_id and m.get('enabled')), None) if model_id else None
            if model_id and not entry:
                return self.send_json({'error': 'ai_model_not_found', 'message': '所选文本模型不存在或未启用，请在管理后台「模型接入」中配置'}, 400)
            # ★ 调用方没指定模型时，**自动挑一个启用中的文本模型**。
            #   以前这里直接落到 `generate_text_with_ai`（只认服务端 OPENAI_API_KEY），
            #   于是本机明明在「模型接入」里启用了文本模型，调用方（如脚本节点的「合成提示词」）
            #   却收到「未配置语言模型」—— 要求每个调用点都知道 modelId 太脆了。
            if not entry:
                entry = next((m for m in visible_ai_models(user['id']) if m.get('enabled') and model_has_usage(m, 'text')), None)
            charge, settlement, trace = None, None, {}
            if entry:
                # ★ r884 两阶段：预扣（按提示词估算 + max_tokens 上限）→ 上游 usage → 结算多退少补。
                #   输出上限由同一 profile 决定，必须与真正的模型请求一致，
                #   否则预扣上限和真实上限对不上（这是「预扣」唯一允许的误差来源）。
                # ★ 预扣的输入侧必须与真正发出去的文本一致（`text_generation_input_text`），
                #   否则系统提示那几十个 token 会被漏算，预扣系统性偏低。
                charge = open_generation_charge(user, entry,
                                                prompt_text=text_generation_input_text(prompt, purpose),
                                                max_tokens=output_limit, label=entry.get('name'))
                text, error = generate_text_with_model(prompt, entry, trace=trace, purpose=purpose)
                settlement = settle_generation_charge(charge, trace.get('usage'), failed=bool(error),
                                                      label=entry.get('name'))
                model_name = entry.get('name')
            else:
                text, error = generate_text_with_ai(prompt, purpose=purpose)
                model_name = str(os.environ.get('OPENAI_TEXT_MODEL') or '服务端默认模型')
            if error:
                return self.send_json({'error': 'text_generate_failed', 'message': error}, 502)
            return self.send_json({'text': text, 'model': model_name,
                                   'billing': billing_payload(charge, settlement, trace.get('usage'))})
        if path == '/api/ai/translate':
            # 节点卡片上的「翻译提示词」：中英互译，@节点引用等结构标记原样保留。
            raw_text = str(incoming.get('text') or '')
            if not raw_text.strip():
                return self.send_json({'error': 'empty_text', 'message': '提示词为空，请输入内容后点击'}, 400)
            translated, error, direction = translate_prompt_text(raw_text, str(incoming.get('modelId') or '').strip(), user['id'])
            if error:
                return self.send_json({'error': 'translate_failed', 'message': error}, 502)
            # ★ r884：翻译按 Token 计费 —— 逐段并发调用，逐段汇总 usage 不划算，
            #   而我们**同时知道输入与输出文本**，按真实长度估算比预扣更贴近实际。
            entry = next((m for m in visible_ai_models(user['id'])
                          if m.get('id') == str(incoming.get('modelId') or '').strip()), None)
            if not entry:
                entry = next((m for m in visible_ai_models(user['id'])
                              if m.get('enabled') and model_has_usage(m, 'text')), None)
            return self.send_json({'text': translated, 'direction': direction,
                                   'billing': charge_generation_after(
                                       user, entry, prompt_text=raw_text, output_text=translated or '',
                                       label=(entry or {}).get('name'))})
        if path == '/api/admin/ai-providers':
            scope, err = self.model_scope_request(user)
            if err: return self.send_json(err, 403)
            item = provider_record(incoming)
            validate_provider_access(user.get('role'), item['baseUrl'])
            if not item['provider'] or not item['baseUrl']:
                return self.send_json({'error': 'invalid_provider'}, 400)
            with LOCK:
                rows = read_ai_providers()
                if any(provider_identity(row) == provider_identity(item)
                       and (item.get('providerGroup') == 'canvasflow' or row.get('providerGroup') == 'canvasflow'
                            or row.get('id') in BUILTIN_PROVIDERS) for row in rows):
                    return self.send_json({'error': 'duplicate_provider', 'message': '已存在同名配置，请换一个名称'}, 409)
                if (item.get('providerGroup') == 'canvasflow'
                        and any(provider_identity(row) == provider_identity(item) for row in visible_ai_models(user['id']))):
                    return self.send_json({'error': 'duplicate_provider', 'message': '该名称已被其他模型配置使用'}, 409)
                source = next((row for row in rows if row['id'] == incoming.get('inheritKeyFrom')), None)
                if source and http_origin(source['baseUrl']) == http_origin(item['baseUrl']):
                    item['apiKey'] = item.get('apiKey') or source.get('apiKey') or ''
                rows.append(item)
                write_file(AI_PROVIDERS_FILE, rows)
            return self.send_json({'provider': ai_provider_public(item)}, 201)
        if path == '/api/admin/ai-models':
            scope, err = self.model_scope_request(user)
            if err: return self.send_json(err, 403)
            item = normalize_ai_model(incoming)
            validate_provider_access(user.get('role'),item['baseUrl'])
            if not item['name'] or not item['model'] or not item['baseUrl']:
                return self.send_json({'error': 'invalid_ai_model', 'message': '名称、模型标识和接口地址不能为空'}, 400)
            # ★ 归属：主供应商留空（所有人可见可调），供应商设置写当前用户（只有本人可见可用）
            item['ownerId'] = '' if scope == 'global' else str(user['id'])
            # 面板里新增/复制模型时，密钥从不下发浏览器，所以由服务端按来源模型继承。
            # ★ 只能继承**自己可见范围内**的模型 —— 否则随便传个 id 就能把别人的 Key 偷过来。
            source_id = str(incoming.get('inheritKeyFrom') or '').strip()
            if source_id and not item.get('apiKey'):
                source = next((m for m in visible_ai_models(user['id']) + read_ai_providers() if m.get('id') == source_id), None)
                if source:
                    if http_origin(source['baseUrl'])!=http_origin(item['baseUrl']):raise NetworkAccessError('只能在同一个接口主机内继承 API Key')
                    item['apiKey'] = str(source.get('apiKey') or '')
            with LOCK:
                items = scoped_ai_models(scope, user['id'])
                # ★ 查重必须查**全局**：id 全局唯一，否则私有模型能用主供应商的 id 造出重复条目
                if any(m.get('id') == item['id'] for m in read_ai_models()):
                    return self.send_json({'error': 'ai_model_exists', 'message': '模型 ID 已存在'}, 409)
                items.insert(0, item)
                write_scoped_ai_models(scope, user['id'], items)
            return self.send_json({'model': ai_model_public(item)}, 201)
        if path == '/api/admin/ai-models/batch-test':
            scope, err = self.model_scope_request(user)
            if err: return self.send_json(err, 403)
            auto_disable = incoming.get('autoDisable') is not False
            items = scoped_ai_models(scope, user['id'])
            targets = [m for m in items if provider_has_credentials(m)]
            results = []

            def probe_one(item):
                try:validate_provider_access(user.get('role'),item.get('baseUrl') or '')
                except NetworkAccessError as error:return {'id':item.get('id'),'name':item.get('name'),'type':item.get('type'),'ok':False,'message':str(error)}
                ok, message = probe_models_endpoint(item, timeout=10)
                return {'id': item.get('id'), 'name': item.get('name'), 'type': item.get('type'), 'ok': ok, 'message': message}

            if targets:
                with ThreadPoolExecutor(max_workers=6) as pool:
                    results = list(pool.map(probe_one, targets))

            disabled_ids = []
            if auto_disable:
                with LOCK:
                    items = scoped_ai_models(scope, user['id'])
                    for item in items:
                        if not item.get('enabled'): continue
                        entry = next((r for r in results if r['id'] == item.get('id')), None)
                        if entry and not entry['ok']:
                            item['enabled'] = False
                            item['updated_at'] = auth_iso()
                            disabled_ids.append(item.get('id'))
                    if disabled_ids: write_scoped_ai_models(scope, user['id'], items)
            for r in results:
                r['action'] = 'disabled' if r['id'] in disabled_ids else ('skipped' if r.get('skipped') else 'kept')
            skipped_no_key = [m.get('name') or m.get('id') for m in items if not provider_has_credentials(m)]
            ok_count = sum(1 for r in results if r['ok'])
            fail_count = len(results) - ok_count
            return self.send_json({'ok': True, 'tested': len(results), 'passed': ok_count, 'failed': fail_count, 'disabled': disabled_ids, 'skippedNoKey': skipped_no_key, 'results': results})
        if path == '/api/admin/ai-models/fetch-remote':
            scope, err = self.model_scope_request(user)
            if err: return self.send_json(err, 403)
            base_url = str(incoming.get('baseUrl') or '').strip().rstrip('/')
            validate_provider_access(user.get('role'),base_url)
            api_key = str(incoming.get('apiKey') or '').strip()
            protocol = str(incoming.get('protocol') or 'openai').lower()
            provider_id = str(incoming.get('providerId') or '').strip()
            # 密钥永不下发浏览器，所以「用已保存的密钥拉列表」必须由服务端自己按地址回查。
            # ★ 回查范围 = 自己可见的模型（含主供应商）—— 普通 VIP 也能借用主供应商的 Key 拉列表。
            if provider_id:
                saved_provider = next((row for row in read_ai_providers() if row.get('id') == provider_id), None)
                if not saved_provider or saved_provider.get('baseUrl', '').rstrip('/') != base_url:
                    return self.send_json({'error': 'provider_not_found', 'message': '找不到与接口地址对应的供应商'}, 404)
                api_key = api_key or str(saved_provider.get('apiKey') or '')
            elif base_url and not api_key:
                same = next((m for m in visible_ai_models(user['id']) + read_ai_providers()
                             if str(m.get('baseUrl') or '').rstrip('/') == base_url and str(m.get('apiKey') or '').strip()), None)
                if same: api_key = str(same.get('apiKey') or '')
            if not base_url or not provider_has_credentials({'apiKey':api_key,'authMode':incoming.get('authMode'),'protocol':protocol}):
                return self.send_json({'error': 'missing_config', 'message': '请先填写接口地址和 API Key 再拉取模型列表'}, 400)
            # ★ r864：改走**带开通状态与模态**的目录接口（见 `fetch_remote_catalog` 的说明）。
            #   `models` 的元素是对象（`{id, name, type, usages, available}`）；旧前端那行
            #   `item.id || item.name || item` 仍然吃得下，所以向后兼容。
            entries, diagnostics, error = fetch_remote_catalog(base_url, api_key, protocol, incoming.get('authMode'))
            if error and not entries:
                return self.send_json({'error': 'fetch_failed', 'message': error, 'diagnostics': diagnostics}, 502)
            known = any(entry.get('available') is not None for entry in entries)
            available_count = sum(1 for entry in entries if entry.get('available') is True)
            # ★ 已开通的排前面：目录是**平台全量**（实测 174 条、只有 19 条已开通），
            #   不排序的话调用方（面板 / 任何脚本）看到的前几十条几乎全是"加了也用不了"的。
            entries.sort(key=lambda item: 0 if item.get('available') is True else 1)
            return self.send_json({'ok': True, 'count': len(entries),
                                   'availableCount': available_count if known else None,
                                   'source': 'skills' if any(entry.get('type') for entry in entries) else 'models',
                                   'models': entries, 'diagnostics': diagnostics})
        # 从上游拉某个模型的参数表（2026-09-25）。
        # ★ 只回传、**不落盘** —— 让管理员在面板里看清楚再决定保存，避免误拉把登记表覆盖掉。
        if path == '/api/admin/model-specs/fetch-upstream':
            if user.get('role') != 'admin':
                return self.send_json({'error': 'forbidden', 'message': '需要管理员权限'}, 403)
            model_name = str(incoming.get('model') or '').strip()
            if not model_name:
                return self.send_json({'error': 'bad_request', 'message': '请先填写上游模型名'}, 400)
            base_url = str(incoming.get('baseUrl') or '').strip()
            if base_url:validate_provider_access(user.get('role'),base_url)
            api_key = str(incoming.get('apiKey') or '').strip()
            entry = None
            # ★★★ 密钥永不下发浏览器 → 没带 key 时由服务端自己把凭据找回来（含主供应商的行）。
            #   回查逻辑单独成函数（`find_model_for_spec_fetch`），因为这里是"拉取失败"的高发点：
            #   见那个函数的说明 —— 只认一种匹配键 = 用户填展示名/大小写不一致时直接报
            #   「缺少接口地址或 API Key」，与上游无关。
            if not api_key:
                entry, lookup_error = find_model_for_spec_fetch(
                    read_ai_models(), subject=model_name, model_id=incoming.get('modelId'))
                if entry:
                    saved_url = str(entry.get('baseUrl') or '')
                    if base_url and (not http_origin(saved_url) or http_origin(base_url) != http_origin(saved_url)):
                        return self.send_json({'error': 'credential_origin_mismatch',
                                               'message': '接口地址与保存凭据不属于同一服务，请提供该地址对应的 API Key'}, 400)
                    api_key = str(entry.get('apiKey') or '')
                    base_url = base_url or saved_url
                    # 回查命中的那一行，上游名以**模型行里的 `model`** 为准
                    # （登记表的键可能是展示名，直接拿去请求上游会 404）。
                    canonical = str(entry.get('model') or '').strip()
                    if canonical:
                        model_name = canonical
                elif not base_url:
                    return self.send_json({'error': 'fetch_failed', 'message': lookup_error}, 502)
            rows, meta, error = fetch_upstream_specs(model_name, base_url, api_key, auth_mode=(entry or {}).get('authMode') if not incoming.get('apiKey') else incoming.get('authMode'))
            if error:
                return self.send_json({'error': 'fetch_failed', 'message': error}, 502)
            return self.send_json({'ok': True, 'model': model_name, 'rows': rows, 'meta': meta})
        # ★★★ 生命周期同步（2026-09-25，用户需求）：模型**停用**后连带清理它的登记行。
        #   删除模型那条路径由服务端在写入时自动清理（见 PUT /api/admin/ai-models），
        #   这里补的是「停用」——停用不一定走保存流程，所以给前端一个显式入口。
        #   `dryRun` 只回报要清什么，不落盘（面板可先提示再执行）。
        if path == '/api/admin/model-specs/prune':
            if user.get('role') != 'admin':
                return self.send_json({'error': 'forbidden', 'message': '需要管理员权限'}, 403)
            scope, err = self.model_scope_request(user)
            if err: return self.send_json(err, 403)
            live = scoped_ai_models(scope, user['id'])
            # 只看启用的：停用的模型等同于"不在模型表里"，登记行一并清掉。
            enabled = [m for m in live if m.get('enabled') is not False]
            if incoming.get('dryRun') is True:
                specs = read_model_specs()
                preview = []
                live_names = {str(m.get('model') or '').strip() for m in enabled}
                live_names |= {str(m.get('name') or '').strip() for m in enabled}
                for kind in ('audio', 'image', 'video'):
                    table = specs.get(kind) or {}
                    if not isinstance(table, dict):
                        continue
                    for subject in table:
                        if subject != '*' and subject not in live_names:
                            preview.append(f'{kind}:{subject}')
                return self.send_json({'ok': True, 'dryRun': True, 'wouldRemove': preview})
            removed, changed = prune_model_specs(enabled)
            return self.send_json({'ok': True, 'removed': removed, 'changed': changed})
        if path == '/api/admin/provider-models-test':
            scope, err = self.model_scope_request(user)
            if err: return self.send_json(err, 403)
            ids = incoming.get('ids') if isinstance(incoming.get('ids'), list) else []
            wanted = {str(item) for item in ids}
            items = scoped_ai_models(scope, user['id'])
            # ★ 空 ids 就是「没有要测的模型」，**不是**「测全部」——
            #   否则前端传空数组会顺手把用户整库模型全探一遍。
            targets = [m for m in items if str(m.get('id')) in wanted]
            probes = {}
            results = []
            for item in targets:
                entry_base = str(item.get('baseUrl') or '').strip()
                entry_key = str(item.get('apiKey') or '').strip()
                entry_model = str(item.get('model') or '').strip()
                if not entry_base or not provider_has_credentials(item) or not entry_model:
                    results.append({'id': item.get('id'), 'ok': False, 'message': '模型配置不完整（接口地址 / API Key）',
                                    'steps': [{'name': '配置检查', 'ok': False, 'free': True, 'ms': 0,
                                               'detail': '模型配置不完整（接口地址 / API Key）'}]})
                    continue
                identity = probe_identity(item)
                if identity not in probes:
                    started = time.monotonic()
                    probes[identity] = (probe_models_endpoint_cached(item, timeout=15), int((time.monotonic() - started) * 1000))
                (ok, message), ms = probes[identity]
                results.append({'id': item.get('id'), 'ok': ok, 'message': message,
                                'steps': [{'name': '连通性（GET /models）', 'ok': ok, 'free': True, 'detail': message, 'ms': ms}]})
            return self.send_json({'results': results, 'probed': len(probes), 'cached': len(targets) - len(probes)})
        if path.startswith('/api/admin/ai-models/') and path.endswith('/test'):
            scope, err = self.model_scope_request(user)
            if err: return self.send_json(err, 403)
            # do_POST 顶部已统一解析请求体（incoming），二次 read_json 会阻塞到客户端超时。
            deep = incoming.get('deep') is True
            model_id = path.split('/')[-2]
            entry = next((m for m in scoped_ai_models(scope, user['id']) if m.get('id') == model_id), None)
            if not entry: return self.send_json({'error': 'ai_model_not_found', 'message': '模型不存在'}, 404)
            validate_provider_access(user.get('role'),entry.get('baseUrl') or '')
            kind = str(entry.get('type') or 'i2t')

            # 分步报告：每一步都带上「是否通过 / 说明 / 耗时 / 命中的上游端点」，方便直接定位配置问题。
            steps = []
            started = time.monotonic()
            probe_started = time.monotonic()
            probe_ok, probe_message = probe_models_endpoint_cached(entry)
            steps.append({
                'name': '连通性（GET /models）', 'ok': probe_ok, 'free': True,
                'detail': probe_message, 'ms': int((time.monotonic() - probe_started) * 1000),
            })
            if not deep:
                return self.send_json({'ok': probe_ok, 'message': probe_message, 'free': True, 'steps': steps})

            # 最小实测：真实调用、产生少量费用。视频按次计费高，只做端点预览不做实测。
            trace = {}
            step_started = time.monotonic()
            if kind == 'video':
                preview = video_endpoint_preview(entry)
                steps.append({
                    'name': '视频链路', 'ok': probe_ok, 'free': True, 'skipped': True,
                    'detail': '视频按次计费较高，未做在线实测；生成时会按下列顺序尝试端点。',
                    'endpoints': preview, 'ms': 0,
                })
            elif kind == 't2i':
                image_data, error = call_image_generation(entry, 'a minimal test image', size='256x256', timeout=90, trace=trace)
                steps.append({
                    'name': '图片链路（生成 256px 测试图）', 'ok': not error, 'free': False,
                    'detail': error or f'已生成测试图（约 {len(image_data or "") // 1024} KB）',
                    'endpoint': trace.get('endpoint', ''), 'transport': trace.get('transport', ''),
                    'ms': int((time.monotonic() - step_started) * 1000),
                })
            elif kind == 'tts':
                audio_data, error = call_tts(entry, '你好', timeout=60, trace=trace)
                steps.append({
                    'name': '音频链路（合成 2 个字）', 'ok': not error, 'free': False,
                    'detail': error or f'已合成音频（约 {len(audio_data or "") // 1024} KB）',
                    'endpoint': trace.get('endpoint', ''), 'ms': int((time.monotonic() - step_started) * 1000),
                })
            else:
                text, error = call_chat_completion(entry, [{'type': 'text', 'text': 'ping'}], max_tokens=1, timeout=30, trace=trace)
                steps.append({
                    'name': '文本链路（1 个输出 token）', 'ok': not error, 'free': False,
                    'detail': error or f'已返回内容（{len(text or "")} 个字符）',
                    'endpoint': trace.get('endpoint', ''), 'ms': int((time.monotonic() - step_started) * 1000),
                })

            ok = all(step['ok'] for step in steps)
            failed = next((step for step in steps if not step['ok']), None)
            total_ms = int((time.monotonic() - started) * 1000)
            message = '全部通过' if ok else f"{failed['name']}失败：{failed['detail']}"
            return self.send_json({'ok': ok, 'message': message, 'steps': steps, 'totalMs': total_ms})
        if path == '/api/projects':
            incoming.update({'ownerId': user['id'], 'ownerName': user['nickname'], 'ownerAvatar': user['avatar']})
            project = clean_project(incoming)
            project['workspaceId'] = self.workspace_scope(user)[0]
            with LOCK:
                projects = read_projects()
                existing = {item.get('id') for item in projects}
                while project['id'] in existing: project['id'] = f'project-{uuid.uuid4().hex[:8]}'
                # New projects should be visible immediately at the top of the project space.
                project['revision'] = max(1, project_revision(project))
                validate_new_media(user['id'],project)
                projects.insert(0, project)
                write_file(PROJECTS_FILE, projects)
            return self.send_json({'project': project}, 201)
        if path == '/api/assets':
            incoming.update({'ownerId': user['id'], 'ownerName': user['nickname'], 'ownerAvatar': user['avatar']})
            name, kind = str(incoming.get('name') or '未命名素材')[:160], str(incoming.get('kind') or 'file')[:30]
            data = incoming.get('data') if isinstance(incoming.get('data'), str) else ''
            # **优先接受 mediaId 引用**（r684）。内联 base64 只在 <=5MB 时才存得下，
            # 超一点服务端就静默丢掉 —— 用户看到的是一张「存过但打不开」的素材。
            # 现在前端先落盘拿 mediaId，素材表只留引用，多大都不怕。
            media_id = str(incoming.get('mediaId') or '').strip()
            if media_id and not resolve_media_file(media_id):
                return self.send_json({'error': 'media_not_found', 'message': '媒体文件不存在，请重新上传'}, 400)
            # ★★ 配额闸门：素材库 3 GB。超了直接拒绝，并明确告诉用户怎么办。
            #   ★ 这里**只拒绝入库、不删已经落盘的 media 文件** —— 同一个 mediaId 很可能
            #     还被画布节点引用着（前端流程是「先上传拿 mediaId，再建素材行」），
            #     删掉会让用户画布上的图当场裂开。代价是极端情况下 media/ 留一份孤儿文件，
            #     那比「删错用户的图」轻得多。
            media_path = resolve_media_file(media_id) if media_id else None
            try: kind=validate_asset_media(kind,media_path,data)
            except ValueError as error: return self.send_json({'error':'invalid_file_format','message':str(error)},400)
            incoming_bytes = 0
            if not incoming_bytes and data.startswith('data:'):
                _, _, payload = data.partition(',')
                incoming_bytes = max(0, len(payload) * 3 // 4)
            used_bytes = user_storage_usage(user['id'])
            limit=ACCOUNT_STORAGE.quota(user['id'])
            if used_bytes + incoming_bytes > limit:
                return self.send_json({
                    'error': 'storage_quota_exceeded',
                    'message': (f'个人存储空间不足，请删除部分素材'
                                f'（已用 {human_bytes(used_bytes)} / {human_bytes(limit)}）'),
                    'storage': user_storage_view(user['id']),
                }, 413)
            asset = {'id': f'asset-{uuid.uuid4().hex[:10]}', 'name': name, 'kind': kind, 'size': str(incoming.get('size') or f'{max(1, len(data) // 1024)} KB')[:40], 'hasPreview': bool(data or media_id), 'tag': str(incoming.get('tag') or '')[:20], 'ownerId': str(incoming.get('ownerId') or 'user-canvasflow')[:100], 'ownerName': str(incoming.get('ownerName') or '林默').strip()[:120] or '林默', 'ownerAvatar': str(incoming.get('ownerAvatar') or '林')[:4], 'shared': bool(incoming.get('shared', False))}
            if media_id:
                asset['mediaId'] = media_id
                asset['mediaUrl'] = f'/media/{media_id}'
            elif data.startswith('data:'):
                # ★ 以前这里是 `and len(data) <= 5_000_000`：超限就**静默丢掉**，
                #   用户看到的是一张「存过但打不开」的空卡（历史上已经攒了 9 条）。
                #   现在改成：能解出来就**透明转存成落盘文件**，多大都不怕；
                #   解不出来就明确报错，绝不静默丢。
                mime, raw = decode_data_uri(data)
                if not raw:
                    return self.send_json({'error': 'invalid_asset_data',
                                           'message': '素材内容无法解析（不是合法的 base64 data URI），请改用上传接口'}, 400)
                try:
                    blob = save_media_blob(raw, mime, name)
                except ValueError as exc:
                    return self.send_json({'error': 'asset_too_large', 'message': f'素材过大：{exc}'}, 400)
                asset['mediaId'] = blob['mediaId']
                asset['mediaUrl'] = blob['url']
                asset['size'] = f'{len(raw) // 1024} KB'
            asset['workspaceId'] = self.workspace_scope(user)[0]
            asset['createdAt'] = now()
            if incoming.get('origin') in ('generated','uploaded'):asset['origin']=incoming['origin']
            validate_new_media(user['id'],asset)
            with LOCK: assets = read_assets(); assets.append(asset); write_file(ASSETS_FILE, assets)
            return self.send_json({'asset': asset}, 201)
        if path == '/api/music':
            incoming.update({'ownerId': user['id'], 'ownerName': user['nickname'], 'ownerAvatar': user['avatar']})
            if 'shared' in incoming and not isinstance(incoming['shared'],bool):
                return self.send_json({'error':'invalid_share','message':'分享状态必须为开启或关闭'},400)
            incoming.setdefault('shared',False)
            name = str(incoming.get('name') or '未命名音乐').strip()[:160] or '未命名音乐'
            data = str(incoming.get('data') or '')
            try:
                validate_asset_media('audio', data=data)
            except ValueError as error:
                return self.send_json({'error': 'invalid_file_format', 'message': str(error)}, 400)
            track = {'id': f'music-{uuid.uuid4().hex[:10]}', 'name': name, 'artist': str(incoming.get('artist') or incoming.get('ownerName') or '本地上传').strip()[:120], 'duration': str(incoming.get('duration') or '本地音频')[:30], 'size': str(incoming.get('size') or f'{max(1, len(data) // 1024)} KB')[:40], 'likes': 0, 'ownerId': str(incoming.get('ownerId') or 'user-canvasflow')[:100], 'ownerName': str(incoming.get('ownerName') or '林默').strip()[:120] or '林默', 'ownerAvatar': str(incoming.get('ownerAvatar') or '林')[:4], 'shared': bool(incoming.get('shared', True))}
            if data.startswith('data:audio/'):
                if len(data) > 5_000_000:
                    return self.send_json({'error': 'music_too_large', 'message': '音乐文件过大（超过 5MB），请改用上传接口'}, 400)
                track['data'] = data
            elif data:
                return self.send_json({'error': 'invalid_music_data', 'message': '音乐内容格式不正确'}, 400)
            with LOCK:
                items = read_music(); items.insert(0, track); write_music(items)
            return self.send_json({'music': track}, 201)
        if path == '/api/models':
            # The legacy endpoint must enforce the same real-file rules as publication.
            validate_new_media(user['id'],incoming)
            try:
                workspace = self.workspace_scope(user)[0]
                with LOCK:
                    model = prepare_share('models', incoming, user, None, resolve_media_file,
                                          clean_project, now(), workspace)
                    items = read_models(); items.insert(0, model); write_models(items)
                return self.send_json({'model': model}, 201)
            except CommunityShareError as error:
                return self.send_json({'error': 'invalid_model', 'message': str(error)}, error.status)
        if path == '/api/generate':
            public_job, failure = create_video_job(user, incoming, self.workspace_scope(user)[0])
            if failure:
                return self.send_json({key: value for key, value in failure.items() if key != 'status'}, failure['status'])
            return self.send_json({'job': public_job}, 202)
        if path == '/api/agent/chat':
            return self.agent_chat(user, incoming)
        if path == '/api/agent/sessions':
            return self.agent_create_session(user, incoming)
        if path == '/api/agent/share':
            return self.agent_share_create(user, incoming)
        if path == '/api/workspaces':
            name = str(incoming.get('name') or '').strip()[:40]
            if not name: return self.send_json({'error': 'invalid_name', 'message': '请填写工作区名称'}, 400)
            stamp = now()
            created = {'id': f'workspace-{secrets.token_hex(8)}', 'userId': user['id'], 'name': name,
                       'type': str(incoming.get('type') or '个人空间').strip()[:20] or '个人空间',
                       'isDefault': False, 'createdAt': stamp, 'updatedAt': stamp}
            with LOCK:
                items = read_workspaces(); items.append(created); write_workspaces(items)
            return self.send_json({'workspace': workspace_view(created)}, 201)
        if path == '/api/agent/skills':
            name = str(incoming.get('name') or '').strip()
            prompt = str(incoming.get('prompt') or '').strip()
            skill, error = save_agent_skill(
                user['id'], name, str(incoming.get('description') or ''),
                prompt, icon=str(incoming.get('icon') or 'wand'),
                source=str(incoming.get('source') or 'user'))
            if error: return self.send_json({'error': 'invalid_skill', 'message': error}, 400)
            return self.send_json({'skill': skill})
        return self.send_json({'error': 'not_found'}, 404)
    def do_DELETE(self):
        try:
            return self._route_delete()
        except PayloadTooLarge:
            return self.send_json({'error': 'payload_too_large', 'message': '请求体超过 8MB 限制'}, 413)
    def _route_delete(self):
        path = unquote(urlparse(self.path).path).rstrip('/')
        if path == '/api/workspace/materials' or path.startswith('/api/workspace/materials/'):
            return self.workspace_materials_api(path,'DELETE')
        if path == '/api/portfolio' or path.startswith('/api/portfolio/'):
            return self.portfolio_api(path,'DELETE')
        if path.startswith('/api/admin/notifications/'):
            return self.notifications_api(path,'DELETE')
        user = self.authenticated_user()
        if not user: return self.send_json({'error': 'unauthenticated', 'message': '请先登录'}, 401)
        if path.startswith('/api/admin/ai-providers/'):
            scope, err = self.model_scope_request(user)
            if err: return self.send_json(err, 403)
            provider_id = path.split('/')[-1]
            if provider_id in BUILTIN_PROVIDERS:
                return self.send_json({'error': 'builtin_provider', 'message': '内置供应商不可删除'}, 403)
            with LOCK:
                rows = read_ai_providers()
                remaining = [row for row in rows if row.get('id') != provider_id]
                if len(rows) == len(remaining): return self.send_json({'error': 'provider_not_found'}, 404)
                write_file(AI_PROVIDERS_FILE, remaining)
            return self.send_json({'deleted': True})
        # 管理员删除单条积分调整记录：台账余额 = SUM(CAST(ROUND(amount * 100) AS INTEGER)) / 100.0，删记录即回退该笔调整
        if path.startswith('/api/admin/credit-history/'):
            if user.get('role') != 'admin': return self.send_json({'error': 'forbidden', 'message': '需要管理员权限'}, 403)
            record_id = path.split('/')[-1]
            if not record_id: return self.send_json({'error': 'invalid_record', 'message': '缺少记录 ID'}, 400)
            with auth_db() as db:
                row = db.execute('SELECT id FROM credit_ledger WHERE id = ?', (record_id,)).fetchone()
                if not row: return self.send_json({'error': 'record_not_found', 'message': '记录不存在或已删除'}, 404)
                db.execute('DELETE FROM credit_ledger WHERE id = ?', (record_id,))
            return self.send_json({'deleted': True, 'id': record_id})
        # 管理后台 → 套餐管理：删除订阅套餐
        if path.startswith('/api/admin/plans/'):
            if user.get('role') != 'admin': return self.send_json({'error': 'forbidden', 'message': '需要管理员权限'}, 403)
            plan_id = path.split('/')[-1]
            if not plan_id: return self.send_json({'error': 'invalid_plan', 'message': '缺少套餐 ID'}, 400)
            with LOCK:
                plans = read_subscription_plans()
                index = next((i for i, item in enumerate(plans) if str(item.get('id')) == plan_id), None)
                if index is None: return self.send_json({'error': 'plan_not_found', 'message': '套餐不存在或已被删除'}, 404)
                removed = plans.pop(index)
                write_subscription_plans(plans)
            return self.send_json({'deleted': True, 'id': plan_id, 'plan': plan_public(removed), 'plans': [plan_public(item) for item in plans]})
        if path.startswith('/api/follows/'):
            result, err = social_set_follow(user['id'], path.split('/')[-1], False)
            return self.send_json(result, err or 200)
        if path.startswith('/api/likes/'):
            parts = path.split('/')          # ['', 'api', 'likes', '<kind>', '<id>']
            if len(parts) == 5:
                result, err = social_set_like(user['id'], parts[3], parts[4], False)
                return self.send_json(result, err or 200)
            return self.send_json({'error': 'invalid_target', 'message': '点赞对象不存在'}, 400)
        if path.startswith('/api/workspaces/'):
            target_id = path.split('/')[-1]
            with LOCK:
                items = read_workspaces()
                target = next((item for item in items
                               if item.get('id') == target_id and item.get('userId') == user['id']), None)
                if not target: return self.send_json({'error': 'workspace_not_found', 'message': '工作区不存在'}, 404)
                if target.get('isDefault'):
                    return self.send_json({'error': 'cannot_delete_default', 'message': '默认工作区不能删除'}, 400)
                if len([item for item in items if item.get('userId') == user['id']]) <= 1:
                    return self.send_json({'error': 'last_workspace', 'message': '至少需要保留一个工作区'}, 400)
                remaining = [item for item in items if item.get('id') != target_id]
                write_workspaces(remaining)
            # 空间里的内容不会被连带删除：它们的 workspaceId 指向一个已不存在的工作区，
            # item_workspace_id() 会把它们退回主人自己的默认工作区，所以这里不必重写数据文件。
            return self.send_json({'deleted': True, 'id': target_id})
        if path.startswith('/api/jobs/') and len(path.split('/')) == 4:
            job_id = path.split('/')[-1]
            target = self.find_job(job_id, user['id'])
            if not target: return self.send_json({'error': 'job_not_found', 'message': '任务不存在'}, 404)
            if target.get('status') in ('queued','running','processing'):
                return self.send_json({'error':'job_active','message':'任务仍在执行，请等待任务结束后删除历史'},409)
            try:
                with LOCK:
                    lines = JOBS_FILE.read_text(encoding='utf-8').splitlines() if JOBS_FILE.exists() else []
                    kept = []
                    for line in lines:
                        try: item = json.loads(line)
                        except json.JSONDecodeError: kept.append(line); continue
                        if item.get('id') != job_id: kept.append(line)
                    temp=JOBS_FILE.with_name(JOBS_FILE.name+'.'+uuid.uuid4().hex+'.tmp')
                    try:
                        temp.write_text(('\n'.join(kept)+('\n' if kept else '')),encoding='utf-8');temp.replace(JOBS_FILE)
                    finally:temp.unlink(missing_ok=True)
            except OSError as exc:
                return self.send_json({'error': 'job_delete_failed', 'message': f'删除任务记录失败：{exc}'}, 500)
            return self.send_json({'deleted': True, 'id': job_id})
        if path.startswith('/api/admin/ai-models/'):
            scope, err = self.model_scope_request(user)
            if err: return self.send_json(err, 403)
            model_id = path.split('/')[-1]
            removed_target = None
            with LOCK:
                items = scoped_ai_models(scope, user['id'])
                removed_target = next((m for m in items if m.get('id') == model_id), None)
                remaining = [m for m in items if m.get('id') != model_id]
                if len(remaining) == len(items): return self.send_json({'error': 'ai_model_not_found', 'message': '模型不存在'}, 404)
                remember_ai_provider(removed_target)
                write_scoped_ai_models(scope, user['id'], remaining)
                if any(m.get('id') == model_id for m in DEFAULT_AI_MODELS):
                    try:
                        dismissed = json.loads((DATA_DIR / 'ai-models-dismissed.json').read_text(encoding='utf-8'))
                    except (FileNotFoundError, json.JSONDecodeError):
                        dismissed = []
                    if model_id not in dismissed:
                        dismissed.append(model_id)
                        (DATA_DIR / 'ai-models-dismissed.json').write_text(json.dumps(dismissed), encoding='utf-8')
            # ★★★ 生命周期同步（2026-09-25，用户需求）：删掉模型 → 连带清掉它的规格登记。
            #   放在 LOCK **外面**：`prune_model_specs` 自己读模型表，在锁内再读会自我等待。
            #   ★ 清理失败**不能**让删除接口报错 —— 模型已经删了，这是既成事实；
            #     登记表多留一行只是脏数据，下次停用/保存时还会被清掉。
            specs_removed = []
            try:
                # 传「当前剩下的全部模型」：删掉的那个自然不在里面 → 它的登记行被清。
                specs_removed, _ = prune_model_specs(remaining)
            except Exception as exc:  # noqa: BLE001 —— 清理是尽力而为，绝不能连累主流程
                print(f'[CanvasFlow API] 模型 {model_id} 删除后清理规格登记失败：{exc}')
            payload = {'deleted': True, 'id': model_id}
            if specs_removed:
                payload['specsRemoved'] = specs_removed
                payload['message'] = f'已同时删除该模型的规格配置（{"、".join(specs_removed)}）'
            if removed_target:
                payload['removedModel'] = {'model': removed_target.get('model'), 'name': removed_target.get('name')}
            return self.send_json(payload)
        if path.startswith('/api/admin/users/'):
            if user.get('role') != 'admin': return self.send_json({'error': 'forbidden', 'message': '需要管理员权限'}, 403)
            target_id = path.split('/')[-1]
            if target_id == user['id']: return self.send_json({'error': 'cannot_delete_self', 'message': '不能删除当前登录的管理员账户'}, 400)
            with auth_db() as db:
                if not db.execute('SELECT 1 FROM users WHERE id=?', (target_id,)).fetchone(): return self.send_json({'error': 'user_not_found', 'message': '用户不存在或已被删除'}, 404)
                email = db.execute("SELECT identifier FROM auth_identities WHERE user_id=? AND type='email'", (target_id,)).fetchone()
                db.execute('DELETE FROM sessions WHERE user_id=?', (target_id,))
                db.execute('DELETE FROM credit_ledger WHERE user_id=?', (target_id,))
                db.execute('DELETE FROM agreement_acceptances WHERE user_id=?', (target_id,))
                db.execute('DELETE FROM auth_identities WHERE user_id=?', (target_id,))
                if email:
                    db.execute("DELETE FROM verification_codes WHERE channel='email' AND identifier=?", (email['identifier'],))
                    db.execute('DELETE FROM login_attempts WHERE identifier=?', (email['identifier'],))
                db.execute('DELETE FROM users WHERE id=?', (target_id,))
            return self.send_json({'deleted': True, 'id': target_id})
        if path.startswith('/api/projects/'):
            item_id = path.split('/')[-1]
            workspace_id, valid = self.workspace_scope(user)
            with LOCK:
                projects = read_projects()
                target = next((item for item in projects if item.get('id') == item_id), None)
                if not target: return self.send_json({'error': 'project_not_found'}, 404)
                if target.get('ownerId') != user['id']:
                    return self.send_json({'error': 'forbidden', 'message': '只能删除自己的项目'}, 403)
                if not in_workspace(target, workspace_id, valid):
                    return self.send_json({'error': 'workspace_mismatch', 'message': '该项目属于另一个工作区，请先切换过去'}, 403)
                try:
                    archived_film=FILM_WORKBENCH.archive_project(workspace_id,item_id,target.get('projectName') or '')
                except (FilmUnavailable,OSError) as exc:
                    return self.send_json({'error':'film_archive_failed','message':'关联成片未能移入回收区，项目已保留：'+str(exc)},409)
                remaining = [item for item in projects if item.get('id') != item_id]
                write_file(PROJECTS_FILE, remaining)
                # 项目没了 → 它节点上的 `previewMedia` / `videoUrl` 引用也随之消失（r686）。
                # 顺手把因此变成孤儿的落盘文件清掉，否则删项目也还是只增不减。
                orphaned = set()
                for node in (target.get('nodes') or []):
                    if not isinstance(node, dict):
                        continue
                    for field in ('previewMedia', 'videoUrl'):
                        value = str(node.get(field) or '')
                        if value.startswith('/media/'):
                            orphaned.add(value.split('/media/', 1)[1].split('?')[0])
                purged_media = [mid for mid in orphaned if purge_media_if_unused(mid)[0]]
            return self.send_json({'deleted': True, 'id': item_id, 'remaining': len(remaining),
                                   'mediaFilesDeleted': len(purged_media),'archivedFilm':archived_film})
        if path.startswith('/api/music/'):
            item_id = path.split('/')[-1]
            with LOCK:
                items = read_music(); remaining = [item for item in items if item.get('id') != item_id]
                if len(remaining) == len(items): return self.send_json({'error': 'music_not_found'}, 404)
                target = next(item for item in items if item.get('id') == item_id)
                if target.get('ownerId') != user['id']: return self.send_json({'error':'forbidden','message':'只能删除自己分享的内容'},403)
                write_music(remaining)
            return self.send_json({'deleted': True, 'id': item_id, 'remaining': len(remaining)})
        if path.startswith('/api/models/'):
            item_id = path.split('/')[-1]
            with LOCK:
                items = read_models(); remaining = [item for item in items if item.get('id') != item_id]
                if len(remaining) == len(items): return self.send_json({'error': 'model_not_found'}, 404)
                target = next(item for item in items if item.get('id') == item_id)
                if target.get('ownerId') != user['id']: return self.send_json({'error':'forbidden','message':'只能删除自己分享的内容'},403)
                write_models(remaining)
            return self.send_json({'deleted': True, 'id': item_id, 'remaining': len(remaining)})
        if path.startswith('/api/media/'):
            # 显式删掉落盘文件（r686）。老实现根本没有这个口子 —— 上传只进不出。
            if user.get('role') != 'admin':
                return self.send_json({'error': 'forbidden', 'message': '直接清理媒体文件需要管理员权限，请从自己的素材或项目中删除'}, 403)
            media_id = path.split('/')[-1]
            if not resolve_media_file(media_id):
                return self.send_json({'error': 'media_not_found', 'message': '媒体文件不存在'}, 404)
            # **默认拒绝删除仍被引用的文件**：删素材/删项目才是正确的入口，
            # 直接删文件会让正在用它的项目变成空卡，而且没有任何提示。
            with LOCK:
                deleted, refs = purge_media_if_unused(media_id)
            if not deleted and refs:
                return self.send_json({
                    'error': 'media_in_use', 'mediaId': media_id, 'referencedBy': refs[:10],
                    'message': f'该文件仍被 {len(refs)} 处引用，删掉会让那些卡片变成空图。请先删除对应素材或项目。',
                }, 409)
            return self.send_json({'deleted': deleted, 'mediaId': media_id})
        if path.startswith('/api/assets/'):
            item_id = path.split('/')[-1]
            media_id, purged, refs = '', False, []
            with LOCK:
                items = read_assets(); remaining = [item for item in items if item.get('id') != item_id]
                if len(remaining) == len(items): return self.send_json({'error': 'asset_not_found'}, 404)
                removed = next(item for item in items if item.get('id') == item_id)
                if removed.get('ownerId') != user['id']: return self.send_json({'error':'forbidden','message':'只能删除自己分享的内容'},403)
                media_id = str(removed.get('mediaId') or '')
                write_file(ASSETS_FILE, remaining)
                # 顺手清掉落盘文件（r686）：老实现只摘表里的行，`server-data/media/` 里的文件
                # 会永久留着 —— 删得越多，本地磁盘越只增不减。
                # **只在这个文件确实没人再引用时才删**（别的素材可能共用，项目快照也可能挂着它）。
                if media_id:
                    purged, refs = purge_media_if_unused(media_id)
            return self.send_json({'deleted': True, 'id': item_id, 'remaining': len(remaining),
                                   'mediaId': media_id, 'mediaFileDeleted': purged,
                                   'mediaStillUsedBy': refs[:5]})
        if path.startswith('/api/agent/sessions/'):
            return self.agent_session_delete(user, path.split('/')[-1])
        if path.startswith('/api/agent/skills/'):
            skill_id = path.split('/')[-1]
            with LOCK:
                items = read_agent_skills()
                remaining = [i for i in items
                             if not (i.get('id') == skill_id and i.get('userId') == user['id'])]
                if len(remaining) == len(items):
                    return self.send_json({'error': 'skill_not_found', 'message': '技能不存在'}, 404)
                write_agent_skills(remaining)
            return self.send_json({'deleted': True, 'id': skill_id})
        return self.send_json({'error': 'not_found'}, 404)
    def do_OPTIONS(self):
        self.send_response(204); self.send_header('Allow', 'GET,HEAD,POST,PUT,DELETE,OPTIONS'); self.send_header('Content-Length', '0'); self.end_headers()


def main():
    import sys
    # 5173 is a popular Vite default; allow `python server.py 5174` or CANVASFLOW_PORT to avoid clashing.
    raw_port = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('CANVASFLOW_PORT') or 5173
    try:
        port = int(raw_port)
    except (TypeError, ValueError):
        print(f'无效端口「{raw_port}」，使用默认端口 5173')
        port = 5173
    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    ACCOUNT_STORAGE.sync(force=True)
    print(f'CanvasFlow local server running at http://127.0.0.1:{port}')
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally:
        FILM_WORKBENCH.close()
        server.server_close()


if __name__ == '__main__':
    main()
