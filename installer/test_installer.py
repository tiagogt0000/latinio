import importlib.util
import io
import json
import os
import shutil
import sqlite3
import subprocess
import tempfile
import unittest
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
VERSION = json.loads((REPO / 'package.json').read_text())['version']
spec = importlib.util.spec_from_file_location('build_package', REPO / 'installer/build-package.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)

DOCKER = r'''#!/usr/bin/env python3
import json,os,sys,sqlite3,shutil
from pathlib import Path
file=Path(os.environ['LATINIO_TEST_STATE']);state=json.loads(file.read_text());args=sys.argv[1:]
state['calls'].append(args);file.write_text(json.dumps(state))
root=Path(state['root']);mode=state['fail']
def save():file.write_text(json.dumps(state))
if args[0]=='inspect':
 target=args[-1]
 if '--format' in args:
  field=args[args.index('--format')+1]
  if target=='gilbers-app-app-1':print('business-id 2026-10-10T00:00:00Z true')
  elif field=='{{.Image}}':print('sha256:oldabc')
  elif field=='{{.Config.Image}}':print('vokabeltrainer-api')
 else:
  print(json.dumps([{'Config':{'Labels':{'com.docker.compose.project':'vokabeltrainer','com.docker.compose.service':'api'}},'State':{'Running':state['running']!='broken','Restarting':state['running']=='broken'},'Mounts':[{'Destination':'/data','Type':'volume','Name':'vokabeltrainer_latinio_data'}]}]))
elif args[:2]==['image','tag']:pass
elif args[:2]==['image','ls']:print('vokabeltrainer:vor-2.5.0-20261013-221958-566047')
elif args[0]=='logs':print('previous startup error fixture')
elif args[0]=='compose':
 assert args[1:3]==['-p','vokabeltrainer'];assert args[3]=='-f';assert Path(args[4])==root/'server/compose.yaml'
 command=args[5:]
 if command[0]=='config':
  name='gilbers-app_gilbers_data' if mode=='unsafe-volume' else 'vokabeltrainer_latinio_data'
  print(json.dumps({'name':'vokabeltrainer','services':{'api':{'build':{'context':str(root),'dockerfile':'server/Dockerfile'},'ports':[{'published':'8081','target':8080,'host_ip':'127.0.0.1'}],'volumes':[{'type':'volume','source':'latinio_data','target':'/data'}]}},'volumes':{'latinio_data':{'name':name}}}))
 elif command[0]=='ps':print('api-id')
 elif command[0]=='exec':
  dest=Path(state['volume'])/Path(command[-1]).name
  db=sqlite3.connect(dest);db.execute('CREATE TABLE properties(key TEXT PRIMARY KEY,value TEXT)')
  db.executemany('INSERT INTO properties VALUES (?,?)',[(k,'fixture') for k in ['TOKEN_HASH','ADMIN_PIN_HASH','SHEET_ID']]);db.commit();db.close()
 elif command[0]=='cp':shutil.copy2(Path(state['volume'])/Path(command[1]).name,command[2])
 elif command[0]=='build':
  if mode=='build':sys.exit(42)
 elif command[0]=='up':
  if '--no-build' in command:state['running']='old';save()
  elif mode=='up':state['running']='broken';save();sys.exit(44)
  else:state['running']='new';save()
 else:raise Exception(command)
else:raise Exception(args)
'''

DOCKER = DOCKER.replace('2.5.0', VERSION)

CURL = r'''#!/usr/bin/env python3
import json,os,sys
from pathlib import Path
state=json.loads(Path(os.environ['LATINIO_TEST_STATE']).read_text())
ok=state['running']=='new' and state['fail']!='health'
ready=state['running']=='old' or ok
Path(sys.argv[sys.argv.index('-o')+1]).write_text(json.dumps({'ready':ready,'studentCodesRequired':True,'autoSharingEnabled':ok,'frenchEnabled':ok,'pushReady':ok,'grammarReady':ok}))
'''

class InstallerTests(unittest.TestCase):
    def scenario(self, failure=''):
        with tempfile.TemporaryDirectory(prefix='latinio-installer-test-') as temp:
            directory=Path(temp);root=directory/'vokabeltrainer';root.mkdir()
            old={}
            for name in builder.FILES:
                if name=='google/AutoSharing.gs':continue
                file=root/name;file.parent.mkdir(parents=True,exist_ok=True)
                old[name]=('previous '+name+'\n').encode();file.write_bytes(old[name])
            (root/'server/compose.yaml').write_text('test configuration')
            output=directory/'installer.zip';builder.build(output,'c412e73f0ab2f95c356c23a7db9fdb51b68a64b0')
            package=directory/'package';package.mkdir()
            with zipfile.ZipFile(output) as outer:
                self.assertEqual(set(outer.namelist()),{'Installieren.bat','Installieren.ps1','Liesmich.txt',f'Latinio-Backend-{VERSION}.zip'})
                self.assertIn(b'\r\n',outer.read('Installieren.bat'))
                payload=outer.read(f'Latinio-Backend-{VERSION}.zip')
                with zipfile.ZipFile(io.BytesIO(payload)) as inner:inner.extractall(package)
            for source in (package/'Dateien').rglob('*'):
                if source.is_file():source.chmod(0o600)
            script=package/'Installieren-Pi.sh';script.write_text(script.read_text().replace('/home/tiago/vokabeltrainer',str(root)))
            binaries=directory/'bin';binaries.mkdir()
            for name,content in [('sudo','#!/bin/sh\nif [ "$1" = "-v" ]; then exit 0; fi\nexec "$@"\n'),('docker',DOCKER),('curl',CURL),('sleep','#!/bin/sh\nexit 0\n')]:
                path=binaries/name;path.write_text(content);path.chmod(0o755)
            volume=directory/'volume';volume.mkdir()
            state=directory/'state.json';state.write_text(json.dumps({'root':str(root),'volume':str(volume),'fail':failure,'running':'broken' if failure=='already-broken' else 'old','calls':[]}))
            env={**os.environ,'PATH':str(binaries)+os.pathsep+os.environ['PATH'],'LATINIO_TEST_STATE':str(state)}
            result=subprocess.run(['bash',str(script)],env=env,text=True,capture_output=True,timeout=30)
            final=json.loads(state.read_text())
            mutating=[args for args in final['calls'] if args[0]!='inspect']
            self.assertTrue(all('gilbers' not in ' '.join(args) for args in mutating))
            if not failure or failure=='already-broken':
                self.assertEqual(result.returncode,0,result.stdout+result.stderr)
                self.assertEqual(final['running'],'new')
                self.assertIn('ERFOLGREICH',result.stdout)
                for name in builder.FILES:
                    self.assertEqual((root/name).read_bytes(),(REPO/name).read_bytes())
                    self.assertEqual((root/name).stat().st_mode & 0o777,0o644)
                self.assertEqual(len(list((root/'backups').glob('*.sqlite'))),1)
            else:
                self.assertNotEqual(result.returncode,0,result.stdout+result.stderr)
                self.assertEqual(final['running'],'old',result.stdout+result.stderr)
                for name,data in old.items():self.assertEqual((root/name).read_bytes(),data)
                self.assertFalse((root/'google/AutoSharing.gs').exists())
                if failure=='unsafe-volume':self.assertFalse((root/'backups').exists())

    def test_successful_private_installation(self):self.scenario()
    def test_recovers_previously_broken_private_container_then_installs(self):self.scenario('already-broken')
    def test_failed_build_restores_code(self):self.scenario('build')
    def test_failed_restart_restores_previous_private_container(self):self.scenario('up')
    def test_failed_health_restores_previous_private_container(self):self.scenario('health')
    def test_shared_or_business_volume_is_rejected_before_changes(self):self.scenario('unsafe-volume')

if __name__=='__main__':unittest.main()
