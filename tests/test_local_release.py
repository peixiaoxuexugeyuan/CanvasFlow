"""Verify a portable or protected native release with isolated data; no real AI."""
from pathlib import Path
import json
import os
import re
import socket
import subprocess
import sys
import tempfile
import time
from urllib.error import HTTPError
from urllib.request import build_opener, ProxyHandler

release = Path(sys.argv[1]).resolve()
runtime = release / '.runtime' / 'python' / 'python.exe'
native = release / 'CanvasFlowBackend.exe'
with tempfile.TemporaryDirectory(prefix='canvasflow-release-test-') as temporary:
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0));port=probe.getsockname()[1]
    environment = dict(os.environ, CANVASFLOW_DATA_DIR=temporary)
    with open(Path(temporary)/'server.log','wb') as output:
        command = [str(native),'serve',str(port)] if native.is_file() else [str(runtime),str(release/'server.py'),str(port)]
        process=subprocess.Popen(command,cwd=release,env=environment,stdout=output,stderr=output,
                                 creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
    client=build_opener(ProxyHandler({}));base=f'http://127.0.0.1:{port}'
    try:
        for _ in range(100):
            try:
                with client.open(base+'/api/local/bootstrap',timeout=1) as response:
                    assert json.load(response)['mode']=='local'
                break
            except OSError:
                if process.poll() is not None:
                    raise RuntimeError((Path(temporary)/'server.log').read_text(errors='replace'))
                time.sleep(.1)
        else:raise RuntimeError('Release failed to start')
        with client.open(base+'/') as response:html=response.read().decode()
        resources=re.findall(r'(?:src|href)=["\']([^"\']+\.(?:js|mjs|css)(?:\?[^"\']*)?)["\']',html)
        resources=[url for url in resources if not url.startswith(('https://','http://'))]
        for url in resources:
            with client.open(base+'/'+url.lstrip('/')) as response:assert response.status==200,url
        with client.open(base+'/api/workspace/materials') as response:
            catalog=json.load(response)
            assert isinstance(catalog['materials'],list)
            assert catalog['workspaceId']
            assert catalog['materials'] == [], 'Test release contains user media'
        with client.open(base+'/api/projects') as response:
            assert json.load(response)['projects'] == [], 'Test release contains user projects'
        from urllib.request import Request
        if (release/'tools/openfilm/bridge.mjs').is_file():
            context={'projectId':'project-33333333-3333-4333-8333-333333333333','draft':True}
            def film(route, body):
                with client.open(Request(base+route,method='POST',headers={'Content-Type':'application/json'},data=json.dumps(body).encode()),timeout=60) as response:return json.load(response)
            opened=film('/api/film/open',context)
            assert opened['engine']=='OpenFilm 0.3.2'
            doc=film('/api/film/action',{**context,'args':{'action':'document'}})
            assert not any(t['clips'] for t in doc['film']['tracks'])
            services=film('/api/film/action',{**context,'args':{'action':'services'}})
            assert not any(services['models'].values()), 'Test release contains configured AI models'
            print('Compiled film bridge, empty draft and empty AI catalog passed')
        with client.open(base+'/api/blender/status') as response:blender=json.load(response)
        with client.open(base+'/api/blender/examples') as response:assert 'table' in json.load(response)
        if blender['available']:
            from urllib.request import Request
            plan={'name':'Portable Blender check','operations':[
                {'op':'create','id':'cube','shape':'box','size':[1,1,1],'position':[0,.5,0]},
                {'op':'bevel','id':'cube','width':.04,'segments':4}]}
            with client.open(Request(base+'/api/blender/jobs',method='POST',headers={'Content-Type':'application/json'},data=json.dumps(plan).encode())) as response:
                job=json.load(response)['job']
            deadline=time.monotonic()+90
            while time.monotonic()<deadline:
                with client.open(base+'/api/blender/jobs/'+job['id']) as response:result=json.load(response)['job']
                if result['status'] not in ('queued','running'):break
                time.sleep(.25)
            assert result['status']=='succeeded',result
            with client.open(base+result['asset']['object']['modelUrl']) as response:assert response.read(4)==b'glTF'
        for id in ('authGate','communityNavGroup','profileBtn','usagePercent','notificationsBtn','shareBtn'):
            assert f'id="{id}"' not in html,id
        try:client.open(base+'/api/community')
        except HTTPError as error:assert error.code==404
        else:raise AssertionError('Community route still active')
        print(f'Portable release OK; {len(resources)} entry resources served successfully; Blender execution: '+('passed' if blender['available'] else 'not installed'))
    finally:
        process.terminate();process.wait(timeout=10)
