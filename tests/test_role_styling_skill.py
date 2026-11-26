import importlib.util
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


class RoleStylingSkillTests(unittest.TestCase):
    def test_selected_package_and_ordered_references_reach_image_adapter(self):
        root = Path(__file__).resolve().parents[1]
        with tempfile.TemporaryDirectory() as data, patch.dict(os.environ, CANVASFLOW_DATA_DIR=data):
            spec = importlib.util.spec_from_file_location('role_skill_fixture', root / 'server.py')
            server = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(server)
            try:
                self.check_dispatch(server)
            finally:
                server._STARTUP_DATA_LEASE.close()

    def check_dispatch(self, server):
        model = dict(id='fixture', name='Fixture', model='image', enabled=True, usages=['image'],
                     imageTaskMode='async', imageStatusPath='/status')
        refs = ['/media/character.jpg', '/media/outfit.jpg']
        payload = dict(modelId='fixture', prompt='Red dress', referenceImages=refs, projectId='test-project')
        with (patch.object(server, 'visible_ai_models', return_value=[model]),
              patch.object(server, 'detect_image_async_ready', return_value=True),
              patch.object(server, 'open_generation_charge', return_value={}) as charge,
              patch.object(server, 'append_job'),
              patch.object(server, 'submit_image_generation', return_value=({'task_id':'stub-job'},None)) as submit):
            for skill_id in [*server.ROLE_STYLING_SKILLS, None]:
                args = dict(payload, roleStyling={'skillId':skill_id}) if skill_id else payload
                job, failure = server.create_image_job({'id':'fixture-user'},args)
                self.assertIsNone(failure)
                prompt = submit.call_args.args[1]
                self.assertEqual(submit.call_args.kwargs['reference_images'], refs)
                self.assertIn(payload['prompt'], prompt)
                if skill_id:
                    template = skill_id.removeprefix('libtv-')
                    bundle = json.loads((server.PUBLIC_DIR / 'assets' / 'agent-skills' / 'libtv' /
                                         template / 'bundle.bin').read_text(encoding='utf-8'))
                    self.assertEqual(job['roleStyling']['skillId'], skill_id)
                    self.assertEqual(job['roleStyling']['version'], bundle['version'])
                    for doc in bundle['files']:
                        self.assertIn(doc['content'], prompt)
                else:
                    self.assertEqual(prompt, payload['prompt'])
                    self.assertNotIn('roleStyling', job)
            _, failure = server.create_image_job({'id':'fixture-user'},dict(payload,roleStyling={'skillId':'unknown'}))
            self.assertEqual(failure['status'],400)
            self.assertEqual(submit.call_count,3)
            self.assertEqual(charge.call_count,3)
