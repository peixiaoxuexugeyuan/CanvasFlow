"""Real Blender acceptance, isolated from application projects and AI providers."""
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import time
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from blender_bridge import BlenderBridge
from blender_protocol import validate_plan
from blender_examples import table_plan,refine_table_plan
from file_formats import validate_model_file


class BlenderProtocolTest(unittest.TestCase):
    def test_rejects_code_unknown_fields_nonfinite_values_and_invalid_geometry(self):
        cases=[{'name':'bad','operations':[{'op':'python','code':'print(1)'}]},
          {'name':'bad','operations':[{'op':'create','id':'a','shape':'box','script':'anything'}]},
          {'name':'bad','operations':[{'op':'create','id':'a','shape':'box','size':[float('nan'),1,1]}]},
          {'name':'bad','operations':[{'op':'create','id':'a','shape':'extrude','outline':[[0,0],[1,1],[2,2]]}]},
          {'name':'bad','sourceJobId':'../private','operations':[{'op':'smooth','id':'a'}]}]
        for case in cases:
            with self.subTest(case=case),self.assertRaises(ValueError):validate_plan(case)


class BlenderRealTest(unittest.TestCase):
    def test_create_modify_export_and_reload_native_source(self):
        with tempfile.TemporaryDirectory(prefix='canvasflow-blender-test-') as temp:
            bridge=BlenderBridge(ROOT,Path(temp),lambda row,directory,info:{'name':row['name']})
            if not bridge.status()['available']:self.skipTest('Blender is not installed')
            def wait(job):
                deadline=time.monotonic()+240
                while time.monotonic()<deadline:
                    row=bridge.job(job['id'],'test-workspace')
                    if row['status'] not in ('queued','running'):
                        if row['status']!='succeeded':
                            log=(bridge.directory/job['id']/'worker.log').read_text(encoding='utf-8',errors='replace')
                            self.fail(row.get('error','Failed')+'\n'+log[-6000:])
                        return row
                    time.sleep(.25)
                self.fail('Blender job timed out')
            try:
                first=wait(bridge.submit(table_plan(),'test-workspace'))
                directory=bridge.directory/first['id']
                before=hashlib.sha256((directory/'model.blend').read_bytes()).hexdigest()
                validate_model_file(directory/'model.glb')
                self.assertEqual(first['result']['objectCount'],15)
                self.assertGreater(first['result']['triangles'],1000)
                self.assertTrue((directory/'preview.png').read_bytes().startswith(b'\x89PNG'))
                objects={o['id']:o for o in first['result']['objects']}
                self.assertNotIn('drawer-cut-0',objects)
                self.assertGreater(objects['drawer-case-0']['triangles'],12)
                self.assertAlmostEqual(objects['top']['bounds']['max'][1],.79,places=3)
                second=wait(bridge.submit({**refine_table_plan(),'sourceJobId':first['id']},'test-workspace'))
                self.assertEqual(before,hashlib.sha256((directory/'model.blend').read_bytes()).hexdigest())
                self.assertEqual(second['result']['objectCount'],15)
                changed={o['id']:o for o in second['result']['objects']}
                self.assertAlmostEqual(changed['leg-0']['bounds']['max'][0]-changed['leg-0']['bounds']['min'][0],.095,places=3)
                self.assertGreater(changed['leg-0']['bounds']['max'][0]-changed['leg-0']['bounds']['min'][0],objects['leg-0']['bounds']['max'][0]-objects['leg-0']['bounds']['min'][0])
                self.assertEqual(changed['top']['modifiers'][0]['segments'],8)
                self.assertEqual(changed['top']['materials'],objects['top']['materials'])
                with self.assertRaises(LookupError):bridge.job(first['id'],'different-workspace')
                with self.assertRaises(LookupError):bridge.submit({**refine_table_plan(),'sourceJobId':first['id']},'different-workspace')
                with self.assertRaises(LookupError):bridge.job('../../anything','test-workspace')
                shapes=wait(bridge.submit({'name':'Shape tools','operations':[
                    {'op':'create','id':'outline','shape':'extrude','size':[2,1,2],'position':[0,.5,0],
                     'outline':[[0,0],[2,0],[2,1],[1,1],[1,2],[0,2]]},
                    {'op':'create','id':'rounded','shape':'box','size':[1,1,1],'position':[3,.5,0]},
                    {'op':'subdivide','id':'rounded','levels':2},
                    {'op':'create','id':'temporary','shape':'sphere'},
                    {'op':'remove','id':'temporary'},
                    {'op':'create','id':'ring','shape':'torus','position':[-3,.5,0]},
                ]},'test-workspace'))
                shape_rows={o['id']:o for o in shapes['result']['objects']}
                self.assertNotIn('temporary',shape_rows)
                self.assertAlmostEqual(shape_rows['outline']['signedVolume'],3,places=3)
                self.assertAlmostEqual(shape_rows['outline']['bounds']['min'][1],0,places=3)
                self.assertAlmostEqual(shape_rows['outline']['bounds']['min'][0],-1,places=3)
                self.assertGreater(shape_rows['rounded']['triangles'],12)
                self.assertGreater(shape_rows['ring']['triangles'],100)
                invalid=bridge.submit({'name':'Missing object','operations':[{'op':'update','id':'missing','size':[1,1,1]}]},'test-workspace')
                deadline=time.monotonic()+60
                while time.monotonic()<deadline:
                    failed=bridge.job(invalid['id'],'test-workspace')
                    if failed['status']=='failed':break
                    time.sleep(.25)
                self.assertEqual(failed['status'],'failed')
                self.assertIn('missing',failed['error'])
            finally:bridge.executor.shutdown(wait=True)


if __name__=='__main__':unittest.main()
