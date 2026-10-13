# Windows-Installer für Latinio

Künftige Pi-Updates als ZIP mit Installieren.bat und Installieren.ps1 liefern,
entsprechend dem vom Nutzer bereitgestellten Gilbers-Starter. Keine manuellen
Befehlsblöcke als regulären Installationsweg verlangen.

Die PowerShell-Datei prüft den Hash der enthaltenen Backend-ZIP, überträgt sie
mit Windows OpenSSH auf tiagos Pi und startet den mitgelieferten Bash-Installer.
Passwörter werden ausschließlich von SSH/sudo abgefragt und nicht gespeichert.
Windows-Administratorrechte oder globale Execution-Policy-Änderungen sind nicht
nötig. Der Starter verwendet den prozessbezogenen Bypass wie die Nutzervorlage.

Der Pi-Installer ist ausschließlich ein Update für /home/tiago/vokabeltrainer.
Er prüft Compose-Projekt, API-Dienst, localhost:8081 und das eigene Daten-Volume;
er verweigert symlinkbasierte oder fremde Ziele. Vor der Aktualisierung legt er
eine Online-SQLite-Sicherung an, kopiert sie in die privaten Projekt-Backups und
prüft deren Integrität. Er behält alte Code-Dateien und ein eigenes Rollback-Image.
Bei Build-/Start-/Health-Fehlern stellt er nur den vorherigen Vokabel-Code wieder
her, ohne den Datenstand zurückzusetzen. Elektro wird ausschließlich gelesen.

Paket bauen (Entwicklerseite):

```sh
python3 installer/build-package.py --output /absoluter/pfad/Latinio_Update_2.4.0.zip --release c412e73f0ab2f95c356c23a7db9fdb51b68a64b0
python3 installer/test_installer.py -v
```

Die Paketliste enthält nur die sieben benötigten öffentlichen Backend-Dateien.
Keine Datenbank, privaten Exporte, Konten oder Zugangsdaten einpacken. Das
Frontend wird erst nach bestätigter Pi-Installation über GitHub veröffentlicht;
der Windows-Installer erhält keine GitHub-Zugangsdaten.

Tests führen den echten Bash-Installer gegen isolierte Docker-/sudo-/curl-
Testadapter und echte SQLite-Sicherungen aus. Sie decken Erfolg, Buildfehler,
Startfehler, fehlgeschlagene Health-Prüfung sowie fremde Volumes ab. Der native
Windows-Starter wurde in der Linux-Umgebung nicht ausgeführt.
