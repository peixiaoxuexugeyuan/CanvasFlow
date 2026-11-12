"""Run the real auth branches against an isolated SQLite database, without importing server side effects."""
import ast
import hashlib
import hmac
import pathlib
import secrets
import sqlite3
import tempfile
import unittest
from contextvars import ContextVar
import uuid
from datetime import datetime, timedelta, timezone
from http.cookies import SimpleCookie

TREE = ast.parse((pathlib.Path(__file__).resolve().parents[1] / 'server.py').read_text(encoding='utf-8-sig'))
HANDLER = next(n for n in TREE.body if isinstance(n, ast.ClassDef) and n.name == 'Handler')


def branch_method(path, name, args):
    branch = next(n for n in ast.walk(HANDLER) if isinstance(n, ast.If)
                  and isinstance(n.test, ast.Compare) and isinstance(n.test.left, ast.Name)
                  and n.test.left.id == 'path' and any(isinstance(c, ast.Constant) and c.value == path for c in n.test.comparators))
    method = ast.parse(f'def {name}({args}): pass').body[0]
    method.body = branch.body
    return method


@unittest.skip("Local edition has no login or account-status API; covered by test_local_app.py")
class AuthStatusTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.dbfile = pathlib.Path(self.temp.name) / 'auth.db'
        scope = dict(sqlite3=sqlite3, AUTH_DB_FILE=self.dbfile, hashlib=hashlib, hmac=hmac,
                     STORAGE_ACTOR=ContextVar('isolated_auth_actor',default=''),NETWORK_ROLE=ContextVar('isolated_auth_network_role',default='user'),
                     secrets=secrets, uuid=uuid, datetime=datetime, timedelta=timedelta, timezone=timezone,
                     SimpleCookie=SimpleCookie, os=__import__('os'), re=__import__('re'), SESSION_COOKIE='canvasflow_session',
                     AGREEMENT_VERSION='2026-09-01', AUTH_SECRET=b'isolated-test-secret')
        functions = {'auth_now', 'auth_iso', 'auth_db', 'init_auth_db', 'normalize_email', 'create_password_hash',
                     'verify_password', 'create_session', 'agreement_is_accepted', 'session_digest', 'record_agreement_acceptance'}
        nodes = [n for n in TREE.body if isinstance(n, ast.FunctionDef) and n.name in functions]
        nodes += [n for n in TREE.body if isinstance(n, ast.Assign)
                  and any(isinstance(t, ast.Name) and t.id in {'EMAIL_PATTERN', 'ACCOUNT_SUSPENDED_MESSAGE'} for t in n.targets)]
        methods = [n for n in HANDLER.body if isinstance(n, ast.FunctionDef)
                   and n.name in {'authenticated_user', 'auth_cookie', 'session_token'}]
        methods += [branch_method('/api/auth/login', 'login', 'self, incoming'), branch_method('/api/auth/me', 'me', 'self')]
        request = ast.parse('class Request: pass').body[0]
        request.body = methods
        module = ast.fix_missing_locations(ast.Module(body=nodes + [request], type_ignores=[]))
        exec(compile(module, 'isolated-auth', 'exec'), scope)
        self.scope = scope
        connections = []
        open_db = scope['auth_db']
        def tracked_db():
            connection = open_db()
            connections.append(connection)
            return connection
        scope['auth_db'] = tracked_db
        self.addCleanup(lambda: [connection.close() for connection in connections])
        scope['init_auth_db']()
        self.request = scope['Request']()
        self.request.headers = {}
        self.request.client_ip = lambda: '127.0.0.1'
        self.request.send_json = lambda body, status=200, headers=None: (status, body, headers or {})
        digest, salt = scope['create_password_hash']('FixtureOnly123')
        stamp = scope['auth_iso']()
        with scope['auth_db']() as db:
            db.execute('INSERT INTO users (id,nickname,avatar,status,role,password_hash,password_salt,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)',
                       ('fixture-user', '测试用户', 'T', 'active', 'user', digest, salt, stamp, stamp))
            db.execute('INSERT INTO auth_identities VALUES (?,?,?,?,?,?,?)',
                       ('identity', 'fixture-user', 'email', 'fixture@example.com', 'fixture@example.com', stamp, stamp))

    def login(self, password='FixtureOnly123'):
        return self.request.login(dict(email='fixture@example.com', password=password,
                                       agreementAccepted=True, agreementVersion='2026-09-01'))

    def suspend(self, status='suspended'):
        with self.scope['auth_db']() as db:
            db.execute('UPDATE users SET status=? WHERE id=?', (status, 'fixture-user'))

    def session_count(self):
        with self.scope['auth_db']() as db:
            return db.execute('SELECT COUNT(*) FROM sessions').fetchone()[0]

    def test_active_login_and_session(self):
        status, body, headers = self.login()
        self.assertEqual(status, 200)
        self.assertEqual(body['user']['id'], 'fixture-user')
        self.request.headers['Cookie'] = headers['Set-Cookie'].split(';')[0]
        self.assertEqual(self.request.me()[0], 200)
        self.assertEqual(self.session_count(), 1)

    def test_suspended_login_has_exact_message_and_no_session(self):
        self.suspend()
        for _ in range(12):
            status, body, headers = self.login()
            self.assertEqual(status, 403)
            self.assertEqual(body, dict(error='account_suspended', message='您的账号已被停用，停用原因和启用账号请咨询客服，谢谢理解！'))
            self.assertIn('Max-Age=0', headers['Set-Cookie'])
        self.assertEqual(self.session_count(), 0)
        with self.scope['auth_db']() as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM agreement_acceptances').fetchone()[0], 0)

    def test_wrong_password_remains_rejected(self):
        self.suspend()
        status, body, headers = self.login('WrongPassword123')
        self.assertEqual(status, 401)
        self.assertEqual(body['error'], 'invalid_credentials')
        self.assertNotIn('Set-Cookie', headers)
        self.assertEqual(self.session_count(), 0)

    def test_suspending_invalidates_existing_session(self):
        _, _, headers = self.login()
        self.request.headers['Cookie'] = headers['Set-Cookie'].split(';')[0]
        self.suspend()
        status, body, headers = self.request.me()
        self.assertEqual(status, 403)
        self.assertEqual(body['message'], self.scope['ACCOUNT_SUSPENDED_MESSAGE'])
        self.assertIn('Max-Age=0', headers['Set-Cookie'])
        self.assertEqual(self.session_count(), 0)
        self.assertEqual(self.request.me()[0], 401)

    def test_other_authenticated_endpoints_cannot_use_suspended_session(self):
        _, _, headers = self.login()
        self.request.headers['Cookie'] = headers['Set-Cookie'].split(';')[0]
        self.suspend()
        self.assertIsNone(self.request.authenticated_user())
        # An earlier data request must not erase the reason before startup /me runs.
        self.assertIsNone(self.request.authenticated_user())
        self.assertEqual(self.request.me()[1]['error'], 'account_suspended')
        self.assertEqual(self.session_count(), 0)

    def test_reactivated_user_can_log_in_again(self):
        self.suspend()
        self.assertEqual(self.login()[0], 403)
        self.suspend('active')
        self.assertEqual(self.login()[0], 200)

    def test_expired_session_still_returns_unauthenticated(self):
        _, _, headers = self.login()
        self.request.headers['Cookie'] = headers['Set-Cookie'].split(';')[0]
        with self.scope['auth_db']() as db:
            db.execute('UPDATE sessions SET expires_at=?', (self.scope['auth_iso'](self.scope['auth_now']() - timedelta(days=1)),))
        status, body, _ = self.request.me()
        self.assertEqual(status, 401)
        self.assertEqual(body['error'], 'unauthenticated')


if __name__ == '__main__':
    unittest.main()
