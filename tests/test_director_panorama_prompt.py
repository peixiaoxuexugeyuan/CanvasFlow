"""Exercise real server preset injection without storage writes or paid requests."""
import ast
import pathlib
import threading
import types
import unittest
from contextvars import ContextVar
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[1]
TREE = ast.parse((ROOT / 'server.py').read_text(encoding='utf-8-sig'))
NAMES = {'read_preset_prompts', 'preset_prompt_text', 'create_image_job', 'run_image_job_in_background'}
MODULE = ast.Module(body=[n for n in TREE.body if isinstance(n, ast.FunctionDef) and n.name in NAMES], type_ignores=[])
DEFAULTS = ast.literal_eval(next(n.value for n in TREE.body if isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'PRESET_PROMPT_DEFAULTS' for t in n.targets)))


class PanoramaPromptTest(unittest.TestCase):
    def scope(self, asynchronous, override=None):
        calls, jobs = [], []
        entry = {'id': 'image-model', 'enabled': True, 'imageTaskMode': 'sync'}
        class Thread:
            def __init__(self, target, args, **kwargs): self.target, self.args = target, args
            def start(self): self.target(*self.args)
        def generate(model, prompt, **kwargs):
            calls.append({'model': model, 'prompt': prompt, **kwargs})
            return (None, 'mock response')
        def submit(model, prompt, **kwargs):
            calls.append({'model': model, 'prompt': prompt, **kwargs})
            return {'task_id': 'upstream-task'}, None
        scope = dict(
            STORAGE_ACTOR=ContextVar('isolated_panorama_actor',default=''),
            uuid=uuid, threading=types.SimpleNamespace(Thread=Thread), now=lambda: 'test-time',
            PRESET_PROMPT_DEFAULTS=DEFAULTS, PRESET_PROMPTS_FILE=None,
            _PRESET_PROMPTS_CACHE={'value': None},
            read_file=lambda *_: {'prompts': {'720_panoramic': override}} if override else {},
            visible_ai_models=lambda _: [entry], model_has_usage=lambda m, usage: usage == 't2i',
            media_generate_entry=lambda _: asynchronous, MEDIA_STATUS_PATH='/task-status',
            submit_image_generation=submit, extract_provider_job_id=lambda data: data['task_id'],
            IMAGE_JOB_PAYLOADS={}, IMAGE_JOB_LOCK=threading.Lock(),
            image_quality_value=lambda _model, value, _name=None: value,
            image_entry_options=lambda entry,incoming:entry, open_generation_charge=lambda *a,**k:{'enabled':False}, call_image_generation=generate, append_job=lambda job: jobs.append(dict(job)),
        )
        exec(compile(ast.fix_missing_locations(MODULE), 'panorama-prompt', 'exec'), scope)
        return scope, calls, jobs

    def test_default_and_admin_prompt_reach_both_upstream_paths_in_full(self):
        for asynchronous in (False, True):
            for override in (None, '管理后台720预设：' + '完整全景接缝约束。' * 100):
                with self.subTest(asynchronous=asynchronous, override=bool(override)):
                    scope, calls, jobs = self.scope(asynchronous, override)
                    job, error = scope['create_image_job']({'id': 'user'}, {
                        'modelId': 'image-model', 'presetScene': '720_panoramic',
                        'prompt': '用户补充：保留参考图的光线', 'size': '2048x1024',
                        'referenceImage': 'data:image/png;base64,reference',
                        'projectId': 'original-canvas', 'outputId': 'result',
                    }, 'workspace')
                    self.assertIsNone(error)
                    expected = (override or DEFAULTS['720_panoramic']['prompt']) + '\n用户补充：保留参考图的光线'
                    self.assertEqual(len(calls), 1)
                    self.assertEqual(calls[0]['prompt'], expected)
                    self.assertEqual(calls[0]['size'], '2048x1024')
                    self.assertEqual(calls[0]['reference_image'], 'data:image/png;base64,reference')
                    self.assertEqual(job['prompt'], expected)
                    self.assertEqual(job['workspaceId'], 'workspace')

    def test_reference_only_generation_still_injects_managed_720_prompt(self):
        scope, calls, _ = self.scope(True)
        scope['create_image_job']({'id': 'user'}, {'modelId': 'image-model', 'presetScene': '720_panoramic', 'referenceImage': 'reference'})
        self.assertEqual(calls[0]['prompt'], DEFAULTS['720_panoramic']['prompt'])
        self.assertIn('无缝', calls[0]['prompt'])


if __name__ == '__main__': unittest.main()
