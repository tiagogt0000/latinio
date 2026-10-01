# Google-Skript aktualisieren (Latinio 1.9.0)

Die Englisch-Erweiterung benötigt separate Änderungsjournale und fachgetrennte Freigaben. Kopiere **Code.gs und Accounts.gs** vollständig in das bestehende, an die private Tabelle gebundene Apps-Script-Projekt und veröffentliche dessen vorhandene Web-App-Bereitstellung als neue Version. Die bestehenden Latein-Blätter und Daten werden nicht umbenannt. Englisch erhält erst bei Nutzung eigene Blätter `Englisch_Änderungen` beziehungsweise `Englisch_Lernen_<Profil-ID>`. Keine erneute Einrichtung, kein neuer PIN und keine neue URL. Das bisherige Update-Verfahren steht unten.

Für Empfangsprüfung und Reparatur fehlender Freigaben:

1. Den Inhalt von `Code.gs` und `Accounts.gs` durch die aktuellen Fassungen ersetzen und speichern.
2. **Bereitstellen → Bereitstellungen verwalten → Stift → Neue Version → Bereitstellen.**
3. Bestehende Web-App-Adresse weiterverwenden. PIN-Einrichtung nicht erneut ausführen.

Die vorhandenen Nutzer, Vokabeln und Lernstände bleiben erhalten.

Danach in der App „Sammlungen → Teilen verwalten“ öffnen. Bei betroffenen Freigaben „Übertragung prüfen / reparieren“ ausführen oder die fehlenden Sammlungen erneut teilen. Anschließend die Empfänger-App neu öffnen. Die Reparatur ergänzt auch vom Empfänger gelöschte Einträge aus der zuletzt geteilten Fassung, überschreibt aber keine vorhandenen Bearbeitungen.
