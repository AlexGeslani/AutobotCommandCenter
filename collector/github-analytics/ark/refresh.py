#!/usr/bin/env python3
"""Pull the GitHub analytics authority, verify it, and publish one ACC Dev projection."""
from __future__ import annotations
import fcntl, hashlib, json, os, re, shlex, shutil, subprocess, sys
from datetime import datetime, timezone
from pathlib import Path

CONFIG=Path(os.environ.get('GITHUB_ANALYTICS_ARK_CONFIG', Path.home()/'.config/github-analytics/ark.json'))
STATE=Path(os.environ.get('GITHUB_ANALYTICS_ARK_STATE', Path.home()/'.local/state/github-analytics'))

def sha(path:Path)->str:
    h=hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda:stream.read(1024*1024),b''): h.update(block)
    return h.hexdigest()

def absolute_path(value:object,name:str)->str:
    if not isinstance(value,str) or not Path(value).is_absolute() or '..' in Path(value).parts:
        raise RuntimeError(f'{name}_boundary')
    return value

def load_config()->dict:
    value=json.loads(CONFIG.read_text())
    fields={'schemaVersion','authority','mirrorRoot','compiler','node','projectionTarget'}
    if not isinstance(value,dict) or set(value)!=fields or value.get('schemaVersion')!='github-analytics-ark-refresh-v1':
        raise RuntimeError('config_boundary')
    authority=value.get('authority')
    if not isinstance(authority,dict) or set(authority)!={'host','root'}:
        raise RuntimeError('authority_boundary')
    host=authority.get('host')
    if not isinstance(host,str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9.-]{0,252}',host):
        raise RuntimeError('authority_host_boundary')
    absolute_path(authority.get('root'),'authority_root')
    for key in ('mirrorRoot','compiler','node','projectionTarget'):
        absolute_path(value.get(key),key)
    if Path(value['projectionTarget']).name!='github-portfolio.v1.json':
        raise RuntimeError('projection_target_boundary')
    if Path(value['mirrorRoot'])==Path(value['projectionTarget']).parent:
        raise RuntimeError('placement_boundary')
    return value

def validate_archive(root:Path)->dict:
    files=set(); observations=0
    for path in sorted(root.rglob('*')):
        if path.is_symlink(): raise RuntimeError('archive_symlink')
        if not path.is_file(): continue
        if path.name.endswith('.json.gz'):
            side=Path(str(path)+'.sha256')
            if not side.is_file(): raise RuntimeError('archive_sidecar_missing')
            parts=side.read_text(errors='strict').strip().split('  ')
            if len(parts)!=2 or parts[1]!=path.name or parts[0]!=sha(path): raise RuntimeError('archive_checksum')
            files.update((path,side)); observations+=1
    if observations==0: raise RuntimeError('archive_empty')
    for path in root.rglob('*'):
        if path.is_file() and path not in files: raise RuntimeError('archive_unexpected_file')
    return {'observations':observations,'files':len(files)}

def atomic_write(path:Path,data:bytes,mode:int)->None:
    path.parent.mkdir(parents=True,exist_ok=True)
    tmp=path.with_name('.'+path.name+'.tmp-'+str(os.getpid()))
    with tmp.open('wb') as stream:
        stream.write(data);stream.flush();os.fsync(stream.fileno())
    os.chmod(tmp,mode);os.replace(tmp,path)

def main()->int:
    config=load_config(); STATE.mkdir(parents=True,exist_ok=True);os.chmod(STATE,0o700)
    with (STATE/'ark-refresh.lock').open('a+') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        mirror=Path(config['mirrorRoot']); parent=mirror.parent
        incoming=parent/f'.archive.incoming-{os.getpid()}'; previous=parent/f'.archive.previous-{os.getpid()}'
        run=STATE/'projections'/str(os.getpid()); output=run/'github-portfolio.v1.json'
        incoming.mkdir(parents=True,exist_ok=False);run.mkdir(parents=True,exist_ok=False)
        try:
            command=f"/usr/bin/tar -C {shlex.quote(config['authority']['root'])} -cf - ."
            source=subprocess.Popen(['/usr/bin/ssh','-o','BatchMode=yes',config['authority']['host'],command],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
            extract=subprocess.run(['/usr/bin/tar','-xf','-','-C',str(incoming)],stdin=source.stdout,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            if source.stdout: source.stdout.close()
            if source.wait() or extract.returncode: raise RuntimeError('authority_pull_failed')
            counts=validate_archive(incoming)
            subprocess.run([config['node'],config['compiler'],'--archive-root',str(incoming),'--output',str(output)],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            projection=output.read_bytes(); json.loads(projection)
            if mirror.exists(): os.replace(mirror,previous)
            os.replace(incoming,mirror)
            try: atomic_write(Path(config['projectionTarget']),projection,0o644)
            except Exception:
                if mirror.exists(): os.replace(mirror,incoming)
                if previous.exists(): os.replace(previous,mirror)
                raise
            if previous.exists(): shutil.rmtree(previous)
            receipt={'schemaVersion':'github-analytics-ark-refresh-receipt-v1','completedAtUtc':datetime.now(timezone.utc).isoformat(),'authorityRoot':config['authority']['root'],'archiveObservationCount':counts['observations'],'projectionSha256':hashlib.sha256(projection).hexdigest()}
            atomic_write(STATE/'last-success.json',(json.dumps(receipt,indent=2,sort_keys=True)+'\n').encode(),0o600)
            print(json.dumps({'status':'success','observations':counts['observations'],'projectionPublished':True,'authorityVerified':True},sort_keys=True))
            return 0
        finally:
            shutil.rmtree(run,ignore_errors=True)
            if incoming.exists(): shutil.rmtree(incoming,ignore_errors=True)
            if previous.exists() and not mirror.exists(): os.replace(previous,mirror)

if __name__=='__main__':
    try: raise SystemExit(main())
    except SystemExit: raise
    except Exception as exc:
        print(json.dumps({'status':'error','errorType':type(exc).__name__},sort_keys=True),file=sys.stderr)
        raise SystemExit(1)
