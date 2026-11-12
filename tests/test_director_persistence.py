"""Regression: large director projects must never be truncated into invalid JSON."""
import ast
import json
import pathlib
import re
import unittest
import uuid

root = pathlib.Path(__file__).resolve().parents[1]
tree = ast.parse((root / 'server.py').read_text(encoding='utf-8-sig'))
node = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'clean_graph')
scope = {'re': re, 'json': json, 'uuid': uuid, 'read_music': lambda: [], 'read_models': lambda: []}
exec(compile(ast.Module(body=[node], type_ignores=[]), str(root / 'server.py'), 'exec'), scope)
media_node = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'media_referenced_by')
exec(compile(ast.Module(body=[media_node], type_ignores=[]), str(root / 'server.py'), 'exec'), scope)

class DirectorPersistenceTest(unittest.TestCase):
    def test_agent_scene_conversation_and_staged_motion_roundtrip(self):
        scene = {'version':3, 'scene':{'whitebox':True},
                 'objects':[{'id':'house', 'kind':'geometry', 'whitebox':{'type':'building', 'parameters':{'size':[4,5,6], 'floors':2}}}],
                 'objectAnimationTracks':[{'objectId':'actor', 'agentPaths':[{'startFrame':0,'action':'walk'},{'startFrame':120,'action':'run'}]}],
                 'aiConversation':[{'role':'user','content':'搭建街道'},{'role':'assistant','content':'已完成白模'}],
                 'aiLastReport':{'issues':[], 'operations':12}}
        nodes, _, _ = scope['clean_graph']({'nodes':[{'id':'director-test','type':'director','directorProject':json.dumps(scene)}]})
        self.assertEqual(json.loads(nodes[0]['directorProject']), scene)

    def test_large_animation_roundtrip(self):
        keys = [{'id':f'key-{i}', 'frame':i, 'value':i / 100, 'interp':'linear'} for i in range(6000)]
        scene = {'version':3, 'objects':[], 'objectAnimationTracks':[{'objectId':'actor', 'channels':{'position.x':keys}}]}
        raw = json.dumps(scene)
        self.assertGreater(len(raw), 200_000)
        nodes, _, _ = scope['clean_graph']({'nodes':[{'id':'director-test','type':'director','directorProject':raw}]})
        self.assertEqual(nodes[0]['directorProject'], raw)
        self.assertEqual(json.loads(nodes[0]['directorProject']), scene)

    def test_video_reference_roundtrip(self):
        nodes, _, _ = scope['clean_graph']({'nodes':[{'id':'video-test','type':'output','videoUrl':'/media/director-test.webm','previewName':'导演台预演.webm'}]})
        self.assertEqual(nodes[0]['videoUrl'], '/media/director-test.webm')

    def test_cover_and_downstream_relation_roundtrip(self):
        nodes, edges, _ = scope['clean_graph']({'nodes':[
            {'id':'director','type':'director','previewMedia':'/media/cover.png'},
            {'id':'video','type':'output','sourceDirectorId':'director','previewMedia':'/media/poster.jpg','videoUrl':'/media/export.mp4'}],
            'edges':[{'id':'edge','source':'director','target':'video'}]})
        self.assertEqual(nodes[0]['previewMedia'], '/media/cover.png')
        self.assertEqual(nodes[1]['sourceDirectorId'], 'director')
        self.assertEqual(edges[0]['source'], 'director')
        for media_id in ('cover.png','poster.jpg','export.mp4'):
            self.assertTrue(scope['media_referenced_by'](media_id, [], [{'id':'p','nodes':nodes}]))

    def test_panorama_and_history_media_are_protected_from_gc(self):
        scene = {'panoramaUrl': '/media/current.png', 'panoramaHistory': [{'data':'/media/history.png'}]}
        projects = [{'id':'p', 'nodes':[{'id':'director', 'directorProject':json.dumps({'scene':scene})}]}]
        for media_id in ('current.png', 'history.png'):
            self.assertTrue(scope['media_referenced_by'](media_id, [], projects))
        self.assertFalse(scope['media_referenced_by']('unrelated.png', [], projects))
        projects[0]['nodes'][0]['directorProject'] = '{broken'
        self.assertFalse(scope['media_referenced_by']('current.png', [], projects))

if __name__ == '__main__':
    unittest.main()
