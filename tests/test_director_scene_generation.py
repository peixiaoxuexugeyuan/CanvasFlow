"""Exercise the production scene generation profile and route without upstream calls."""
import ast
import pathlib
import unittest

source = ast.parse((pathlib.Path(__file__).resolve().parents[1] / 'server.py').read_text(encoding='utf-8-sig'))
names = {'text_generation_profile', 'text_generation_input_text', 'generate_text_with_model', 'generate_text_with_ai'}
definitions = [n for n in source.body if isinstance(n, ast.FunctionDef) and n.name in names]
hint = next(n for n in source.body if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'TEXT_GENERATION_SYSTEM_HINT' for t in n.targets))
handler = next(n for n in source.body if isinstance(n, ast.ClassDef) and n.name == 'Handler')
branch = next(n for n in ast.walk(handler) if isinstance(n, ast.If) and isinstance(n.test, ast.Compare) and any(isinstance(x, ast.Constant) and x.value == '/api/ai/text-generate' for x in n.test.comparators))
route = ast.parse('def route(self, incoming, user):\n    pass').body[0]
route.body = branch.body
module = ast.fix_missing_locations(ast.Module(body=[hint, *definitions, route], type_ignores=[]))


class SceneGenerationTest(unittest.TestCase):
    def setUp(self):
        self.calls, self.charges = [], []
        self.entry = {'id':'test', 'enabled':True, 'name':'Test'}
        self.scope = {
            'call_chat_completion':lambda entry, content, **kw: (self.calls.append((content, kw)) or ('{"operations":[]}', None)),
            'default_text_model_entry':lambda: self.entry,
            'visible_ai_models':lambda user: [self.entry],
            'model_has_usage':lambda *args: True,
            'VISION_INPUT_TOKEN_ALLOWANCE':1100,
            'model_supports_vision':lambda entry: True,
            'video_reference_values':lambda user, value, kind: (value, 'inline:' + value),
            'open_generation_charge':lambda user, entry, **kw: (self.charges.append(kw) or {'id':'charge'}),
            'settle_generation_charge':lambda *args, **kw: {},
            'billing_payload':lambda *args: {},
        }
        exec(compile(module, 'server-scene-generation', 'exec'), self.scope)
        self.response = None

    def send_json(self, body, status=200):
        self.response = (body, status)
        return self.response

    def test_script_reference_images_are_sent_in_order_to_the_selected_vision_model(self):
        payload = {'prompt':'看两张人物参考图', 'modelId':'test', 'referenceImages':['/media/a.png','/media/b.png']}
        self.scope['route'](self, payload, {'id':'local-test'})
        self.assertEqual(self.response[1], 200)
        content = self.calls[0][0]
        self.assertEqual([part['image_url']['url'] for part in content[1:]], ['inline:/media/a.png', 'inline:/media/b.png'])
        self.assertEqual(self.charges[0]['extra_input_tokens'], 2200)
        self.scope['model_supports_vision'] = lambda entry: False
        self.scope['route'](self, payload, {'id':'local-test'})
        self.assertEqual(self.response[1], 400)
        self.assertEqual(len(self.calls), 1)

    def test_scene_tools_use_json_instructions_and_bounded_output_budget(self):
        self.scope['generate_text_with_model']('搭建街道', self.entry, purpose='scene_agent')
        content, options = self.calls[0]
        self.assertIn('完整合法JSON', content[0]['text'])
        self.assertEqual(options['max_tokens'], 12000)
        self.assertEqual(options['timeout'], 180)

    def test_video_prompt_submits_30_frames_and_preserves_the_normal_reference_limit(self):
        # A 16 x 16 JPEG. The same visual frame can legitimately occur at many timestamps.
        frame = ('data:image/jpeg;base64,/9j/4AAQSkZJRgABAgAAAQABAAD//gAPTGF2YzYzLjEuMTAyAP/bAEMACAQEBAQEBQUF'
                 'BQUFBgYGBgYGBgYGBgYGBgcHBwgICAcHBwYGBwcICAgICQkJCAgICAkJCgoKDAwLCw4ODhERFP/EAEwAAQEAAAAAAAAA'
                 'AAAAAAAAAAAGAQEBAAAAAAAAAAAAAAAAAAAGBxABAAAAAAAAAAAAAAAAAAAAABEBAAAAAAAAAAAAAAAAAAAAAP/AABEIABAAEAMB'
                 'IgACEQADEQD/2gAMAwEAAhEDEQA/AIsATX9//9k=')
        payload = {'modelId': 'test', 'prompt': '分析动作', 'referenceImages': [frame] * 30, 'purpose': 'video_prompt_frames'}
        user = {'id': 'local-test'}
        self.scope['route'](self, payload, user)
        self.assertEqual(self.response[1], 200, self.response)
        content = self.calls[0][0]
        self.assertEqual([part['image_url']['url'] for part in content[1:]], payload['referenceImages'])
        self.assertEqual(self.charges[0]['extra_input_tokens'], 30 * 1100)
        for changes in ({'purpose':'text'}, {'referenceImages':[frame] * 31}, {'referenceImages':[]},
                        {'referenceImages':['/media/test.jpg']}, {'referenceImages':['data:image/jpeg;base64,AAAA']}):
            self.scope['route'](self, {**payload, **changes}, user)
            self.assertEqual(self.response[1], 400, changes)
        self.assertEqual(len(self.calls), 1)

    def test_normal_text_generation_keeps_its_existing_budget_and_hint(self):
        self.scope['generate_text_with_model']('写文案', self.entry)
        content, options = self.calls[0]
        self.assertIn('视频创作助手', content[0]['text'])
        self.assertEqual(options['max_tokens'], 3000)
        self.assertEqual(options['timeout'], 90)

    def test_route_bills_the_same_input_and_budget_as_the_actual_request(self):
        for purpose, expected in [('scene_agent',12000), ('text',3000), ('untrusted-custom-purpose',3000)]:
            self.scope['route'](self, {'prompt':'test', 'modelId':'test', 'purpose':purpose}, {'id':'local-test'})
            content, options = self.calls[-1]
            charge = self.charges[-1]
            self.assertEqual(charge['max_tokens'], expected)
            self.assertEqual(charge['max_tokens'], options['max_tokens'])
            self.assertEqual(charge['prompt_text'], content[0]['text'])
            self.assertEqual(self.response[1], 200)


if __name__ == '__main__':
    unittest.main()
