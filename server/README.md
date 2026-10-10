# Pi-Backend für Latinio — vorbereitet, noch nicht produktiv

## Ziel

Die bestehende PWA bleibt unter https://tiagogt0000.github.io/latinio/.
Nur ihre Cloud-Schnittstelle wird auf einen öffentlichen HTTPS-Endpunkt des
Raspberry Pi umgestellt. Freunde benötigen keinen Tailscale-Zugang, keine neue
URL und keine Neuinstallation. Derselbe Ursprung bewahrt IndexedDB und die
lokalen Änderungsjournale. Die Elektro-App darf nicht geändert werden.

Die Oberfläche wird ausdrücklich weiter auf GitHub gehostet.

## Implementierter Stand

- Node.js 24 mit lokaler SQLite-Datenbank, WAL und atomaren Transaktionen.
- Bestehende Domainfunktionen aus Code.gs und Accounts.gs laufen innerhalb
  von Node; alle Speicher-, Hash- und Sitzungsfunktionen werden lokal ausgeführt.
  Der Server stellt keine Verbindung zu Google her. Die Dateien behalten
  zunächst ihre Namen, damit die bewährten Fachregeln unverändert bleiben.
- POST /api: bisherige Aktionen, JSON-Antworten, Bearer-Token.
- CORS ausschließlich für https://tiagogt0000.github.io.
- Bestehende Nutzer- und Admin-Sitzungen sowie PIN-Hashes werden übernommen.
- Neue Datenbank kann nur einmal aus einer Migrationsdatei befüllt werden.
- SQLite-Backup läuft über die Online-Backupfunktion, einschließlich WAL-Daten.
- Eigener Compose-Name vokabeltrainer, eigener Volume latinio_data,
  ausschließlich 127.0.0.1:8081, automatischer Neustart und Ressourcenlimits.

server/rest-bridge.mjs ist der geprüfte, noch nicht in die laufende Oberfläche
eingebundene REST-Client. Die aktive App nutzt weiterhin Google. Kein
Versionswechsel wurde veröffentlicht. Docker-Build, öffentliche HTTPS-Adresse
und Pi-Betrieb sind noch nicht vor Ort geprüft.

## Nächster benötigter Schritt: nur Pi-Inventar lesen

Vom Nutzer am 10. Oktober 2026 per Terminal-Screenshot bestätigt:
- Elektro-Container: gilbers-app-app-1, Status healthy.
- Image: gilbers-app-app; Versionsnummer im Screenshot nicht sichtbar.
- Elektro-Volume: gilbers-app_gilbers_data.
- Binding: 127.0.0.1:8080 auf Container-Port 8080.
- Funnel auf HTTPS 443 leitet / an http://127.0.0.1:8080.
- In der vorherigen Portliste kein Listener auf 8081 oder 8443.

Nächster Arbeitsschritt ist der private Google-Datenexport. Vor Änderungen
am Pi das vorhandene Elektro-Backupverfahren prüfen und ausführen.

```sh
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}'
docker volume ls
ss -ltn
tailscale serve status
tailscale funnel status
```

Vor Änderungen an gemeinsam genutzter Infrastruktur die vorhandene
Elektro-Sicherung ausführen und überprüfen. Keine Änderung am Elektro-Projekt,
kein pauschales Compose-down und kein Tailscale-reset. Der freie lokale und
öffentliche HTTPS-Port wird erst nach dieser Bestandsaufnahme festgelegt.

## Datenübernahme und Umschaltung: noch auszuführen

1. Google-Tabelle und aktuelle Script-Konfiguration privat sichern.
2. ExportPi.gs als zusätzliche Datei im Apps-Script-Editor hinzufügen und
   exportLatinioForPi manuell ausführen. Der Export kommt als private JSON-Datei
   in das Drive des ausführenden Kontos. Die aktive Bereitstellung wird dabei
   nicht geändert. Exportdatei enthält sensible Konto-/Sitzungs-Hashes und
   gehört weder ins öffentliche Repository noch in das Webverzeichnis.
3. Testimport nur in eine neue Datenbank durchführen. Profile, beide Fächer,
   Journallängen/Versionen, Freigaben, Nachrichten und Stichproben vergleichen.
4. Backend auf Pi parallel einrichten und öffentlichen HTTPS-Zugriff testen.
5. Vor dem endgültigen Import Schreibzugriffe auf Google kontrolliert anhalten
   oder über eine vorübergehende Kompatibilitätsbrücke auf den Pi leiten.
   Export und Umschaltung müssen einen gemeinsamen Datenstand besitzen.
   Noch zwischengespeicherte alte PWA-Versionen dürfen danach keine zweite,
   unabhängige Datenbank in Google fortschreiben.
6. Finalen Export übernehmen, Einmalimport und Backups prüfen. Offline-Geräte
   behalten ihr lokales Journal; der Pi erhält dieselben Versionsnummern/IDs.
7. REST-Transport und Endpunkt in der Oberfläche aktivieren, Legacy-Anmeldepfad
   prüfen, Versionsnummern und Service-Worker-Dateiliste aktualisieren.
   Geschlossene App-Fenster müssen das normale PWA-Update erhalten können.
8. Bestehende iPhone-Installationen prüfen: Admin/Schüler, beide Fächer,
   Synchronisierung, Freigaben, Offline-Nachträge und Streak. Ablaufende oder
   bereits ungültige Sitzungen brauchen weiterhin eine reguläre Anmeldung.
9. Google erst abschalten, wenn die Altversionen behandelt und die Datenprüfung
   abgeschlossen ist. Bei Fehlern nach Pi-Schreibzugriffen keine unkontrollierte
   Rückschaltung auf den alten Google-Datenstand.

Für die Umschaltung ist keine Weiterleitung der GitHub-Website vorgesehen.
Eine transparente Migration aller Geräte kann erst nach diesen Prüfungen
bestätigt werden. Wiederherstellung und automatischer Start beider Apps müssen
auf dem tatsächlichen Pi geprüft werden.
