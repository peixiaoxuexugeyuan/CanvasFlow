"""Manual UI fixture: two isolated canvases and generated color charts, no AI."""
import os
import subprocess
import sys
import tempfile
import threading
from pathlib import Path

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))
with tempfile.TemporaryDirectory(prefix='canvasflow-film-scope-ui-') as folder:
    os.environ['CANVASFLOW_DATA_DIR'] = folder
    import server as app
    # Optional acceptance of the exact protected public assets/film adapters.
    # The Python host stays source-based; this is not a native executable test.
    if os.environ.get('CANVASFLOW_FIXTURE_PUBLIC_ROOT'):
        protected = Path(os.environ['CANVASFLOW_FIXTURE_PUBLIC_ROOT']).resolve()
        app.PUBLIC_FILES = app.PublicFiles(protected)
        app.PUBLIC_DIR = app.PUBLIC_FILES.root
        app.FILM_WORKBENCH.close()
        app.FILM_WORKBENCH = app.FilmWorkbench(protected, app.DATA_DIR)
    ffmpeg = next((root / '.runtime/openfilm-ffmpeg').glob('*/bin/ffmpeg.exe'))
    def media(suffix, extra):
        name = 'media-' + ('a' * 32 if suffix == '.png' else 'b' * 32) + suffix
        subprocess.run([str(ffmpeg), '-v', 'error', '-f', 'lavfi', '-i',
                        'testsrc2=size=640x360:rate=10', *extra, str(app.MEDIA_DIR/name)],
                       check=True, capture_output=True, creationflags=getattr(subprocess,'CREATE_NO_WINDOW',0))
        return '/media/' + name
    pic = media('.png', ['-frames:v','1'])
    vid = media('.mp4', ['-t','3','-pix_fmt','yuv420p'])
    # Test-only provider catalog; .invalid addresses can never submit paid jobs.
    app.visible_ai_models=lambda uid:[dict(id='fixture-'+kind,model=model,name=label,enabled=True,usages=[kind],apiKey='fixture-only',baseUrl='https://fixture.invalid',requestProtocol='openai') for kind,model,label in [('image','gpt-image-2.5','图片参数验收'),('video','video','视频参数验收'),('audio','tts-1','音色目录验收')]]
    app.fetch_model_voices=lambda *a,**kw:([{'id':'fixture-voice','name':'测试音色','gender':'女','language':'中文','demo':''}], '')
    user = app.LOCAL_CONTEXT
    workspace = app.default_workspace_id(user['id'])
    nodes = [dict(id='image-fixture',type='image',title='图片预览验收',previewMedia=pic,x=80,y=100,width=280,height=200),
             dict(id='video-fixture',type='output',title='视频预览验收',previewMedia=vid,videoUrl=vid,left=400,top=100,width=280,height=200)]
    app.write_file(app.PROJECTS_FILE, [dict(id='film-scope-'+name.lower(),projectName='隔离验收 '+name,
        ownerId=user['id'],workspaceId=workspace,nodes=nodes if name=='A' else [],edges=[],revision=1,
        zoom=1,panX=0,panY=0) for name in ('A','B')])
    class Quiet(app.Handler):
        def log_message(self,*args): pass
    http = app.ThreadingHTTPServer(('127.0.0.1',5199), Quiet)
    threading.Thread(target=http.serve_forever,daemon=True).start()
    try:
        # Avoid overlapping the engine and UI browser cold starts on low-memory machines.
        app.FILM_WORKBENCH.call(workspace, 'open', projectKey='film-scope-a', projectName='隔离验收 A')
        print('http://127.0.0.1:5199/?project=film-scope-a',flush=True)
        input('Press Enter to stop the isolated fixture.\n')
    finally:
        http.shutdown(); http.server_close(); app.FILM_WORKBENCH.close()
