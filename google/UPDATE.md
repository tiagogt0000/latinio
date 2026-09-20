# Bestehende Google-Verbindung aktualisieren

Wenn „Freigabe beenden“ eine ältere Skript-Version meldet:

1. Im vorhandenen Apps-Script-Projekt `Code.gs` **und** `Accounts.gs` durch die aktuellen Dateien aus diesem Ordner ersetzen und speichern.
2. **Bereitstellen → Bereitstellungen verwalten** öffnen.
3. Bei der bisherigen Web-App den **Stift** wählen.
4. Bei **Version** die Option **Neue Version** wählen, dann **Bereitstellen**.
5. Latinio vollständig schließen, neu öffnen und die Aktion erneut versuchen.

Die bisherige Web-App-URL, Tabelle und Zugangsdaten bleiben gleich. Keine neue Bereitstellung anlegen und keine Einrichtung erneut ausführen. Nur Speichern aktualisiert die veröffentlichte Web-App nicht.

Technischer Hintergrund: `Code.gs` leitet `shareRevoke`, `profileDelete` und `profileCollections` an `Accounts.gs` weiter. Eine ältere `Code.gs` kann diese Aktionen ablehnen, obwohl `Accounts.gs` bereits ersetzt wurde. Die App verbindet sich bei dieser Ablehnung einmal neu, um einen alten iframe-Kontext auszuschließen.

„Freigabe beenden“ stoppt weitere Weitergaben; die bereits bearbeitbare Kopie beim Empfänger bleibt erhalten.
