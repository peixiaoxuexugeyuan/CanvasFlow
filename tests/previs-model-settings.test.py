"""Exercise only the new pure configuration boundary; never open the user's DB."""
import ast
import unittest
from pathlib import Path


class PrevisModelsTest(unittest.TestCase):
    def setUp(self):
        source = ast.parse(Path('server.py').read_text(encoding='utf-8'))
        functions = [n for n in source.body if isinstance(n, ast.FunctionDef)
                     and n.name in ('previs_models_payload', 'save_previs_models')]
        self.storage = {}
        self.models = [
            {'id': 'text', 'name': 'Scene text', 'type': 'i2t', 'enabled': True, 'apiKey': 'SECRET', 'baseUrl': 'PRIVATE'},
            {'id': 'image', 'name': 'Image', 'type': 't2i', 'enabled': False},
            {'id': 'private', 'ownerId': 'another-user', 'enabled': True},
        ]
        self.scope = {'PREVIS_MODELS_FILE': 'config',
                      'read_file': lambda path, fallback: self.storage.get(path, fallback),
                      'write_file': lambda path, value: self.storage.__setitem__(path, value),
                      'read_ai_models': lambda: self.models,
                      'model_owner_of': lambda m: m.get('ownerId', ''),
                      'model_has_usage': lambda m, usage: m.get('type') == 'i2t'}
        exec(compile(ast.Module(body=functions, type_ignores=[]), 'server.py', 'exec'), self.scope)

    def test_all_primary_models_listed_without_credentials_or_private_models(self):
        data = self.scope['previs_models_payload']({'role': 'user'})
        self.assertFalse(data['canEdit'])
        self.assertEqual([m['id'] for m in data['models']], ['text', 'image'])
        self.assertNotIn('SECRET', str(data))
        self.assertNotIn('PRIVATE', str(data))
        self.assertTrue(data['models'][0]['supportsScene'])
        self.assertFalse(data['models'][1]['enabled'])

    def test_checked_ids_deduplicated_private_and_deleted_ids_removed(self):
        self.scope['save_previs_models']({'selectedIds': ['text', 'text', 'private', 'deleted']})
        data = self.scope['previs_models_payload']({'role': 'admin'})
        self.assertTrue(data['canEdit'])
        self.assertEqual(self.storage['config']['selectedIds'], ['text'])
        self.assertEqual([m['id'] for m in data['models'] if m['checked']], ['text'])
        self.scope['save_previs_models']({'selectedIds': []})
        self.assertFalse(any(m['checked'] for m in self.scope['previs_models_payload']({})['models']))

    def test_malformed_input_rejected_without_overwriting_selection(self):
        for value in ([], {}, {'selectedIds': 'text'}, {'selectedIds': [123]}):
            with self.assertRaises(ValueError):
                self.scope['save_previs_models'](value)
        self.assertFalse(self.storage)


if __name__ == '__main__':
    unittest.main()
