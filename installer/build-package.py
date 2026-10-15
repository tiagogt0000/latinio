import argparse
import hashlib
import io
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEMPLATES = ROOT / 'installer' / 'templates'
FILES = (
    'google/Code.gs', 'google/Accounts.gs', 'google/AutoSharing.gs',
    'server/database.mjs', 'server/start.mjs', 'server/http.mjs', 'server/Dockerfile',
    'server/notifications.mjs', 'server/package.json', 'server/package-lock.json',
)

def build(output, release):
    version = json.loads((ROOT / 'package.json').read_text())['version']
    if not re.fullmatch(r'\d+\.\d+\.\d+', version) or not re.fullmatch(r'[a-f0-9]{40}', release):
        raise ValueError('Version oder Release-ID ungueltig.')
    values = {name: (ROOT / name).read_bytes() for name in FILES}
    manifest = {'version': version, 'release': release, 'files': {name: hashlib.sha256(data).hexdigest() for name, data in values.items()}}
    payload = io.BytesIO()
    with zipfile.ZipFile(payload, 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('Manifest.json', json.dumps(manifest, indent=2))
        for name in ('Installieren-Pi.sh', 'Pruefen.py'):
            content = (TEMPLATES / name).read_text().replace('__VERSION__', version)
            archive.writestr(name, content.encode('utf-8'))
        for name, data in values.items():
            archive.writestr('Dateien/' + name, data)
    data = payload.getvalue()
    starter = (TEMPLATES / 'Installieren.ps1').read_text().replace('__VERSION__', version).replace('__PAYLOAD_HASH__', hashlib.sha256(data).hexdigest())
    instructions = f'''Latinio {version} installieren

1. Die gesamte ZIP in einen Ordner entpacken (Rechtsklick: Alle extrahieren).
2. Installieren.bat doppelklicken. Die anderen Dateien im selben Ordner lassen.
3. Bei Nachfrage das SSH-Passwort fuer tiago eingeben. Auf dem Pi kann auch
   das sudo-Passwort abgefragt werden. Bei der Eingabe erscheinen keine Zeichen.
4. Warten, bis die gruene Erfolgsmeldung erscheint. Danach ChatGPT kurz Bescheid
   geben, damit die vorbereitete App-Oberflaeche veroeffentlicht wird.

Der Windows-PC braucht eine Verbindung zum Pi (wie bisher ueber Tailscale)
und die bereits benutzten Windows-Befehle ssh und scp.

Der Installer aktualisiert ausschliesslich /home/tiago/vokabeltrainer mit
dem Compose-Projekt vokabeltrainer. Er prueft den eigenen Port 8081 und das
eigene Daten-Volume. Keine Aenderung an /home/tiago/gilbers-app, keine Updates
des Betriebssystems, kein Loeschen von Daten-Volumes und keine Tailscale-Aenderung.

Vorher wird eine gepruefte SQLite-Sicherung unter
/home/tiago/vokabeltrainer/backups angelegt. Alte Backend-Dateien und ein
Rollback-Image bleiben fuer einen fehlgeschlagenen Installationsversuch erhalten.
Bei einem Fehler wird nur der vorherige Vokabel-Code wiederhergestellt;
die Datenbank wird nicht auf einen alten Stand zurueckgesetzt.

Passwoerter, Admin-PIN, Nutzer- und Lerndaten sind nicht in diesem Paket enthalten.
Dieses Paket ist ein Update fuer den bereits eingerichteten Pi.
'''
    output.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
        archive.writestr('Installieren.bat', (TEMPLATES / 'Installieren.bat').read_text().replace('\n', '\r\n').encode('ascii'))
        archive.writestr('Installieren.ps1', starter.replace('\n', '\r\n').encode('ascii'))
        archive.writestr(f'Latinio-Backend-{version}.zip', data)
        archive.writestr('Liesmich.txt', instructions.replace('\n', '\r\n').encode('utf-8'))
    return manifest

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--release', required=True)
    args = parser.parse_args()
    build(args.output, args.release)
    print(str(args.output))
