"""Package an already captured public Skill snapshot; never execute its contents."""
import json, re, hashlib, posixpath
from pathlib import Path, PurePosixPath
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'build-private/libtv-full-skills'
DEST = ROOT / 'assets/agent-skills/libtv'
DATE = '2026-11-14'
def read(path): return json.loads(path.read_text(encoding='utf8'))
def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding='utf8')
def safe_path(value):
    value = str(value).replace('\\', '/')
    path = PurePosixPath(value)
    if not value or path.is_absolute() or any(x in ('..', '', '.') for x in value.split('/')) or re.search(r'[\x00-\x1f]', value):
        raise ValueError('Unsafe file path: ' + value)
    if path.suffix.lower() not in ('.md', '.markdown'): raise ValueError('Not a Markdown document: ' + value)
    return str(path)

def main():
    catalog = read(SOURCE/'catalog.json')
    index, unavailable, audits = [], [], []
    categories = {'专业影视','商业广告','短剧漫剧','动漫游戏','音乐MV','自媒体创作','通用技能'}
    for entry in catalog:
        uuid = entry['templateUuid']
        if not re.fullmatch(r'[a-f0-9]{28,36}', uuid): raise ValueError('Invalid template ID')
        if not entry.get('showMarkdown'):
            unavailable.append({'templateUuid':uuid,'name':entry['name'],'reason':'作者未公开 Skill 文件'})
            continue
        data = read(SOURCE/(uuid+'.json'))['data']; skill = data.get('skill',data)
        if not skill.get('showMarkdown'):
            unavailable.append({'templateUuid':uuid,'name':entry['name'],'reason':'详情文件不可公开读取'})
            continue
        snapshot = json.loads(skill.get('snapshotData') or '{}')
        files = skill.get('skillFiles') or snapshot.get('skillFiles') or []
        origin = 'skillFiles'
        if not files:
            markdown = skill.get('markdownContent') or snapshot.get('markdownContent') or ''
            if not markdown: raise ValueError('Missing public content: '+uuid)
            files = [{'path':skill.get('primarySkillFilePath') or snapshot.get('primarySkillFilePath') or 'SKILL.md','content':markdown,'primary':True}]
            origin = 'snapshotData.markdownContent'
        documents=[]; hashes=[]; seen=set(); disk_seen=set()
        for f in files:
            path=safe_path(f['path'])
            if path in seen: raise ValueError('Duplicate path: '+uuid+'/'+path)
            seen.add(path)
            content=f['content']
            if not isinstance(content,str) or not content.strip(): raise ValueError('Empty file: '+uuid+'/'+path)
            # Preserve the original virtual path; encode Windows-reserved characters only on disk.
            disk_path='/'.join(re.sub(r'[<>:"|?*%]|[. ]+$',lambda m:''.join('%%%02X'%ord(c) for c in m[0]),part) for part in path.split('/'))
            if disk_path.casefold() in disk_seen:disk_path=posixpath.splitext(disk_path)[0]+'~'+hashlib.sha256(path.encode()).hexdigest()[:8]+posixpath.splitext(disk_path)[1]
            disk_seen.add(disk_path.casefold())
            raw=content.encode('utf8'); dest=DEST/uuid/'files'/disk_path
            dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(raw)
            digest=hashlib.sha256(raw).hexdigest()
            documents.append({'path':path,'content':content,'contentType':f.get('contentType') or 'text/markdown','primary':bool(f.get('primary'))})
            hashes.append({'path':path,'diskPath':disk_path,'bytes':len(raw),'sha256':digest})
        primary=skill.get('primarySkillFilePath') or snapshot.get('primarySkillFilePath') or next((f['path'] for f in documents if f['primary']),documents[0]['path'])
        if primary not in {f['path'] for f in documents}: raise ValueError('Primary missing: '+uuid+'/'+primary)
        for f in documents:f['primary']=f['path']==primary
        missing=set()
        for f in documents:
            # Only explicit relative Markdown links are mechanically checkable; prose references remain unverified.
            for link in re.findall(r'\]\(([^\s)]+)', f['content']):
                target=unquote(link.split('#')[0].split('?')[0])
                if not target or re.match(r'^[a-z][a-z0-9+.-]*:',target,re.I) or target.startswith('/'):continue
                if not target.lower().endswith(('.md','.markdown')):continue
                resolved=posixpath.normpath(posixpath.join(posixpath.dirname(f['path']),target))
                if resolved not in seen:missing.add(resolved)
        detail={k:skill.get(k,'') for k in ('templateUuid','name','version','description','useScenario','inputType','outputContent','ownerName','ownerAvatar')}
        detail.update(primarySkillFilePath=primary,files=documents,sourceUrl='https://www.liblib.tv/skill',capturedAt=DATE,
                      examples=[x['productionCaseUrl'] for x in skill.get('caseItems',[]) if x.get('productionCaseUrl')],
                      missingReferences=sorted(missing),contentOrigin=origin)
        # UTF-8 JSON data in a generic asset container; existing servers expose .bin.
        # It is fetched as data, never imported/evaluated as JavaScript.
        write(DEST/uuid/'bundle.bin',detail)
        category=next((t['tagLabel'] for t in entry.get('tags',[]) if t['tagLabel'] in categories),'通用技能')
        index.append({'id':'libtv-'+uuid,'templateUuid':uuid,'title':skill['name'],'desc':skill.get('description') or '',
                      'cat':category,'kind':{1:'文本',2:'图片',3:'视频',4:'音频'}.get(skill.get('resultType'),'技能'),
                      'cover':skill.get('coverUrl') or '', 'slug':skill.get('skillKey') or '',
                      'details':{k:detail[k] for k in ('templateUuid','ownerName','sourceUrl','version')},
                      'bundleUrl':f'assets/agent-skills/libtv/{uuid}/bundle.bin','fileCount':len(documents)})
        audits.append({'templateUuid':uuid,'name':skill['name'],'version':skill.get('version'), 'primarySkillFilePath':primary,
                       'contentOrigin':origin,'files':hashes,'missingRelativeMarkdownLinks':sorted(missing)})
    summary={'capturedAt':DATE,'catalogTotal':len(catalog),'publicSkills':len(index),'files':sum(len(s['files']) for s in audits),
             'contentBytes':sum(f['bytes'] for s in audits for f in s['files']), 'unavailableSkills':len(unavailable),
             'skillsWithMissingRelativeLinks':sum(bool(s['missingRelativeMarkdownLinks']) for s in audits),
             'scope':'公开接口实际返回的全部 Markdown 文件；未声称包含未公开依赖、平台工具或模型。'}
    write(DEST/'manifest.json',{'summary':summary,'skills':audits,'unavailable':unavailable})
    (ROOT/'agent-skill-catalog.js').write_text('/* Public Skill metadata only. Documents load on demand from local bundles. */\nwindow.CanvasFlowPublicSkillCatalog = '+json.dumps(index,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf8')
    whitelist=ROOT/'tools/release/files.txt'
    entries=[line for line in whitelist.read_text(encoding='utf8').splitlines() if not line.startswith('assets/agent-skills/libtv/') and line not in ('agent-skill-catalog.js','agent-public-skills.js')]
    entries+=['agent-skill-catalog.js','agent-public-skills.js','assets/agent-skills/libtv/manifest.json']+[item['bundleUrl'] for item in index]
    whitelist.write_text('\n'.join(entries)+'\n',encoding='utf8')
    print(json.dumps(summary,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
