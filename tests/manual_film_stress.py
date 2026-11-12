"""Isolated native 4K/100-clip, renderer soak, recovery and export acceptance. No AI."""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from film_workbench import FilmWorkbench, FilmUnavailable

runtime = Path(os.environ.get('CANVASFLOW_FILM_TEST_ROOT') or ROOT)
report = {'clips': 100, 'stage': [3840, 2160], 'checks': {}}
output = ROOT / 'build-private/acceptance-20261111'
output.mkdir(parents=True, exist_ok=True)
with tempfile.TemporaryDirectory(prefix='cf-film-stress-') as folder:
    manager = FilmWorkbench(runtime, folder)
    manager.callbacks['fixture'] = lambda *_: {'models': {}}
    def call(action, **args):
        return manager.call('fixture', 'advanced', projectKey='stress', args={'action': action, **args})
    try:
        start = time.monotonic()
        opened = manager.call('fixture', 'open', projectKey='stress')
        report['startupSeconds'] = round(time.monotonic()-start, 2)
        ffmpeg = next((runtime / '.runtime/openfilm-ffmpeg').glob('*/bin/ffmpeg.exe'))
        clip = Path(folder) / 'synthetic-4k.mp4'
        subprocess.run([str(ffmpeg), '-v', 'error', '-f', 'lavfi', '-i',
                        'testsrc2=size=3840x2160:rate=24', '-t', '3', '-c:v', 'libx264',
                        '-preset', 'ultrafast', '-crf', '30', '-threads', '2', '-pix_fmt', 'yuv420p', str(clip)],
                       check=True, capture_output=True, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        manager.call('fixture', 'import', projectKey='stress', files=[{'path': str(clip), 'name': clip.name}])
        doc = call('document')
        ops = [{'op': 'stage', 'w': 3840, 'h': 2160}]
        ops += [{'op': 'insert', 'clip': {'src': 'assets/'+clip.name, 'id': f'shot-{i}', 'time': [0, 3]},
                 'at': i*3, **({'newTrack': 0} if i == 0 else {'track': 0})} for i in range(100)]
        # Keep writes within the application's native batch-size limit.
        for at in range(0, len(ops), 40):
            doc = call('document'); call('edit', revision=doc['revision'], ops=ops[at:at+40])
        doc = call('document')
        assert sum(len(t['clips']) for t in doc['film']['tracks']) == 100
        report['checks']['100ClipAuthoring'] = True
        snap = call('look', at='151', count=1)
        assert snap['pictures'], snap.get('checks')
        report['checks']['4kFrameCapture'] = True
        env = dict(os.environ, FILM_STRESS_URL=opened['url'], FILM_STRESS_SECONDS=os.environ.get('FILM_STRESS_SECONDS', '180'))
        result = subprocess.run([str(ROOT/'.runtime/node/node.exe'), '--max-old-space-size=512',
                                 str(ROOT/'tests/manual_film_stress.mjs')], env=env, cwd=ROOT,
                                capture_output=True, text=True, encoding='utf-8', timeout=360,
                                creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        (output/'stress-ui.log').write_text(result.stdout+'\n'+result.stderr, encoding='utf-8')
        assert result.returncode == 0, result.stderr[-1200:]
        report['browser'] = json.loads((output/'stress-browser.json').read_text(encoding='utf-8'))
        # Abrupt death, not a graceful close: persisted timeline must survive.
        worker = manager.workers[('fixture', 'stress')][0]
        worker.kill(); worker.wait(timeout=10)
        reopened = manager.call('fixture', 'open', projectKey='stress')
        assert reopened['projectId'] == opened['projectId']
        restored = call('document')
        assert restored['film'] == doc['film']
        report['checks']['workerCrashRecovery'] = True
        # Export a short genuine 4K film, avoiding a 5-minute render on the user's workstation.
        call('edit', revision=restored['revision'], ops=[{'op': 'remove', 'clip': f'shot-{i}'} for i in range(1, 50)])
        restored = call('document')
        call('edit', revision=restored['revision'], ops=[{'op': 'remove', 'clip': f'shot-{i}'} for i in range(50, 100)])
        job = call('export', settings={'kind': 'video', 'codec': 'h264', 'shortEdge': 2160, 'fps': 24, 'name': 'synthetic-4k'})['export']
        until = time.monotonic()+180
        while time.monotonic() < until:
            current = next(j for j in call('exports')['exports'] if j['id'] == job['id'])
            if current['status'] not in ('waiting', 'running'): break
            time.sleep(.5)
        assert current['status'] == 'done', current
        file = call('outputs', id=job['id'])['files'][0]
        exported = manager.call('fixture', 'output', projectKey='stress', args={'token': file['token']})['file']
        probe = ffmpeg.with_name('ffprobe.exe')
        info = json.loads(subprocess.check_output([str(probe), '-v', 'error', '-show_streams', '-of', 'json', exported]))
        video = next(s for s in info['streams'] if s['codec_type']=='video')
        assert (video['width'], video['height']) == (3840, 2160), video
        report['checks']['4kExport'] = {'width': video['width'], 'height': video['height'], 'frames': video.get('nb_frames')}
        # Persisted recycle record and complete source can be restored after the worker stops.
        record = manager.archive_project('fixture', 'stress', 'Stress fixture')
        record_file = next(Path(folder).rglob(record+'/record.json'))
        entry = record_file.parent
        metadata = json.loads(record_file.read_text())
        assert metadata['projectId'] == 'stress'
        report['checks']['recycleArchiveComplete'] = bool(list(entry.rglob('synthetic-4k.mp4')))
    finally:
        manager.close()
        (output/'stress-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(report, ensure_ascii=False))
