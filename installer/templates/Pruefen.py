import hashlib
import json
import sqlite3
import sys
from pathlib import Path
from urllib.parse import quote

FILES = (
    'google/Code.gs', 'google/Accounts.gs', 'google/AutoSharing.gs',
    'server/database.mjs', 'server/start.mjs', 'server/http.mjs', 'server/Dockerfile',
    'server/notifications.mjs', 'server/package.json', 'server/package-lock.json',
)

def require(condition, message):
    if not condition:
        raise SystemExit(message)

def package(directory, root):
    require(root.resolve() == root and root.is_dir(), 'Das separate Vokabel-Verzeichnis fehlt oder ist ein Link. Abbruch.')
    manifest = json.loads((directory / 'Manifest.json').read_text())
    require(manifest['version'] == '__VERSION__', 'Falsche Paketversion.')
    require(tuple(manifest['files']) == FILES, 'Die Dateiliste des Pakets stimmt nicht.')
    for name in FILES:
        source = directory / 'Dateien' / name
        require(source.is_file() and not source.is_symlink(), 'Eine Paketdatei fehlt.')
        require(hashlib.sha256(source.read_bytes()).hexdigest() == manifest['files'][name], 'Eine Paketdatei ist beschaedigt.')
        target = root / name
        require(target.resolve().is_relative_to(root), 'Ein Ziel liegt ausserhalb des Vokabel-Projekts. Abbruch.')
        require(not target.is_symlink() and not target.parent.is_symlink(), 'Ein Ziel ist ein Link. Abbruch.')

def configuration(file, root):
    config = json.loads(file.read_text())
    require(config.get('name') == 'vokabeltrainer', 'Falsches Compose-Projekt.')
    require(set(config['services']) == {'api'}, 'Unerwartete Dienste im Vokabel-Projekt.')
    api = config['services']['api']
    build = api['build']
    require(Path(build['context']).resolve() == root, 'Falscher Docker-Build-Kontext.')
    require(build['dockerfile'] == 'server/Dockerfile', 'Falsche Dockerfile.')
    ports = api.get('ports', [])
    require(len(ports) == 1 and str(ports[0]['published']) == '8081' and ports[0]['target'] == 8080 and ports[0]['host_ip'] == '127.0.0.1', 'Unerwartete Portbindung. Abbruch.')
    mounts = api['volumes']
    require(len(mounts) == 1 and mounts[0]['type'] == 'volume' and mounts[0]['source'] == 'latinio_data' and mounts[0]['target'] == '/data', 'Unerwarteter Datenspeicher. Abbruch.')
    volume = config['volumes']['latinio_data']
    require(volume.get('name') == 'vokabeltrainer_latinio_data' and not volume.get('external'), 'Der Datenspeicher gehoert nicht zum Vokabel-Projekt.')

def container(file):
    info = json.loads(file.read_text())[0]
    labels = info['Config']['Labels']
    require(labels.get('com.docker.compose.project') == 'vokabeltrainer' and labels.get('com.docker.compose.service') == 'api', 'Falscher laufender Container.')
    require(info['State']['Running'] or info['State'].get('Restarting') or info['State'].get('Status') == 'exited', 'Der Vokabel-Container hat einen unerwarteten Zustand. Abbruch.')
    data = [mount for mount in info['Mounts'] if mount['Destination'] == '/data']
    require(len(data) == 1 and data[0]['Type'] == 'volume' and data[0]['Name'] == 'vokabeltrainer_latinio_data', 'Der laufende Container nutzt nicht den privaten Vokabel-Speicher.')

def database(path):
    require(path.is_file() and path.stat().st_size > 0, 'Die Sicherung fehlt.')
    db = sqlite3.connect('file:' + quote(str(path)) + '?mode=ro', uri=True)
    try:
        require(db.execute('PRAGMA quick_check').fetchone()[0] == 'ok', 'Die SQLite-Sicherung ist nicht in Ordnung.')
        keys = {row[0] for row in db.execute('SELECT key FROM properties')}
        require({'TOKEN_HASH', 'ADMIN_PIN_HASH', 'SHEET_ID'} <= keys, 'Die Sicherung enthaelt nicht die erwarteten Anmeldedaten.')
    finally:
        db.close()

def ready(path):
    require(json.loads(path.read_text()).get('ready') is True, 'Die Vokabel-App ist nicht bereit.')

def rollback_image(path,version):
    import re
    matches=[tag for tag in path.read_text().splitlines() if re.fullmatch(r'vokabeltrainer:vor-'+re.escape(version)+r'-[0-9]{8}-[0-9]{6}-[0-9]+',tag)]
    require(bool(matches), 'Keine passende gesicherte Vokabel-Version gefunden.')
    print(max(matches))

def health(path):
    result = json.loads(path.read_text())
    require(result.get('ready') is True and result.get('studentCodesRequired') is True and result.get('autoSharingEnabled') is True and result.get('frenchEnabled') is True and result.get('pushReady') is True, 'Das neue Vokabel-Backend ist noch nicht bereit.')

if __name__ == '__main__':
    action = sys.argv[1]
    if action == 'package': package(Path(sys.argv[2]), Path(sys.argv[3]))
    elif action == 'config': configuration(Path(sys.argv[2]), Path(sys.argv[3]))
    elif action == 'container': container(Path(sys.argv[2]))
    elif action == 'database': database(Path(sys.argv[2]))
    elif action == 'health': health(Path(sys.argv[2]))
    elif action == 'ready': ready(Path(sys.argv[2]))
    elif action == 'rollback-image': rollback_image(Path(sys.argv[2]),sys.argv[3])
    else: raise SystemExit('Unbekannte Pruefung.')
