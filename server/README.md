# Pi-Backend für Latinio — seit 11. Oktober 2026 produktiv

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

Der REST-Client in app/rest-bridge.js ist produktiv. Version 2.3.0 nutzt Schüler-Zugangscodes; Version 2.2.1 korrigierte den
Safari-Aufruf von fetch. Die Hauptversion verbindet sich direkt mit dem Pi.
Ältere PWA-Versionen werden vorübergehend über Google an den Pi weitergereicht.

## Vor Ort geprüfter Stand (10./11. Oktober 2026)

- Elektro-Container gilbers-app-app-1 gesund, Binding 127.0.0.1:8080.
- Elektro-Volume gilbers-app_gilbers_data unverändert.
- Elektro-Sicherung gilbers-20261010-193955.sqlite erfolgreich.
- Latinio-Container vokabeltrainer-api-1 gesund, Binding 127.0.0.1:8081.
- Eigenes Volume vokabeltrainer_latinio_data; erster Export als Testkopie importiert.
- Bestehender Tailscale-Funnel HTTPS 443 weiter zur Elektro-App.
- Zusätzlicher Funnel HTTPS 8443 zur Vokabel-App.
- Öffentlicher Health- und CORS-Test erfolgreich; kein Tailscale auf den Endgeräten nötig.
- RAM-Limit wird vom vorhandenen Kernel nicht unterstützt; keine Betriebssystemänderung vorgenommen.
- Finaler Export: 17 Tabellen und 11474 Datenzeilen; Import mit vorheriger SQLite-Sicherung erfolgreich.
- Nutzer bestätigt beide Container healthy; öffentliche Health-Prüfung ready.
- Google-Weiterleitung am 11. Oktober um 00:18:56 aktiviert; Pages-Release erfolgreich.
- Abschließende Synchronisierungsprüfung durch Nutzer noch ausstehend.

## Ablauf der Datenübernahme (Schritte 1–7 abgeschlossen)

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

## Vorbereitetes Update 2.4.0

AutoSharing.gs ergänzt automatische Inhaltsfreigaben und den Live-Prüfer. Der
Pi-Start aktiviert enableAutoSharing:true. Keine Änderung vorhandener DB-Dateien
und kein Reimport. Die persönlichen Lernjournale bleiben bestehen; zusätzliche
Metadaten entstehen beim Teilen in _LatinioAutoShares.

Vor Installation SQLite online sichern. Nur den Stack vokabeltrainer bauen und
neu starten. Health muss danach autoSharingEnabled:true zeigen. Erst dann das
vorbereitete Frontend veröffentlichen. Bestand mit dem Prüfer bewusst auswählen
und angleichen; die Installation selbst überschreibt keine bestehenden Inhalte.

Bash-Heredoc-Installer müssen Docker-Aufrufe mit </dev/null ausführen, damit
Docker nicht die restlichen Scriptzeilen als stdin konsumiert.
