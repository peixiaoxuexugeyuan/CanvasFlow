"""The landing-page /assets alias must not shadow the app's local motion previews."""
import ast
import pathlib
import re
import unittest
from urllib.parse import unquote, urlparse

source = ast.parse((pathlib.Path(__file__).resolve().parents[1] / 'server.py').read_text(encoding='utf-8-sig'))
handler = next(n for n in source.body if isinstance(n, ast.ClassDef) and n.name == 'Handler')
method = next(n for n in handler.body if isinstance(n, ast.FunctionDef) and n.name == 'do_GET')
branch = next(n for n in method.body if isinstance(n, ast.If) and isinstance(n.test, ast.Call) and isinstance(n.test.func, ast.Attribute) and n.test.func.attr == 'fullmatch' and any(isinstance(a,ast.Constant) and '/assets/motion-presets/' in str(a.value) for a in n.test.args))
test_class = ast.parse('class PreviewHandler(Base):\n    def do_GET(self):\n        pass').body[0]
test_class.body[0].body = [method.body[0], branch, *ast.parse("return 'landing-assets'").body]
module = ast.fix_missing_locations(ast.Module(body=[test_class], type_ignores=[]))


class Base:
    def do_GET(self):
        return 'app-static'


class MotionPreviewRouteTest(unittest.TestCase):
    def setUp(self):
        scope = {'Base':Base, 're':re, 'unquote':unquote, 'urlparse':urlparse}
        exec(compile(module, 'motion-preview-route', 'exec'), scope)
        self.handler = scope['PreviewHandler']()

    def route(self, path):
        self.handler.path = path
        return self.handler.do_GET()

    def test_all_23_local_previews_use_application_static_files(self):
        for n in range(1,24):
            self.assertEqual(self.route(f'/assets/motion-presets/{n}.webp?v=updated'), 'app-static')

    def test_landing_assets_and_invalid_preview_paths_keep_their_existing_route(self):
        for path in ['/assets/landing.js', '/learn/assets/landing.js', '/assets/motion-presets/24.webp', '/assets/motion-presets/0.webp', '/assets/motion-presets/../server-data/auth.db', '/assets/motion-presets/%2e%2e/server-data/auth.db']:
            self.assertEqual(self.route(path), 'landing-assets')


if __name__ == '__main__':
    unittest.main()
