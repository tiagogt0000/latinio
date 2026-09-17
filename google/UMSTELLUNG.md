# Umstellung auf Latinio 1.0.0

Vorbereitet im Zweig `multiuser-upgrade`. Noch nicht mit `main` zusammenführen: Die bestehende Google-Web-App-Adresse muss zuerst in `app/cloud-config.js` eingetragen und das Backend aktualisiert werden.

## Vorhandene Cloud weiterverwenden

Die bestehende Tabelle, Web-App-Bereitstellung und der bisherige Verbindungsschlüssel bleiben erhalten. `Änderungen` enthält weiterhin ausschließlich den bisherigen Admin-Lernstand. Neue Profile erhalten eigene Tabellenblätter. Die alte App funktioniert mit dem aktualisierten Backend weiter.

1. In der bisherigen Google-Tabelle **Erweiterungen → Apps Script** öffnen.
2. Den Inhalt der vorhandenen `Code.gs` durch `google/Code.gs` aus diesem Zweig ersetzen.
3. Eine neue Skriptdatei `Accounts` hinzufügen und den Inhalt von `google/Accounts.gs` einfügen. `Bridge.html` bleibt erhalten.
4. Speichern. Die Funktion **setupMultiuser** ausführen oder die Google-Tabelle neu öffnen und **Latinio → Mehrbenutzer-Update einrichten** wählen. Den im Chat vereinbarten Admin-PIN im Dialog eingeben. Nicht `setupLatinio` ausführen: Diese alte Funktion würde den bisherigen Verbindungsschlüssel ersetzen.
5. **Bereitstellen → Bereitstellungen verwalten → vorhandene Web-App bearbeiten → Neue Version → Bereitstellen**. Die vorhandenen Einstellungen „Ausführen als: Ich“ und Zugriff „Jeder“ beibehalten. Keine zusätzliche Bereitstellung anlegen.
6. Die Web-App-Adresse mit `/exec` am Ende in `app/cloud-config.js` eintragen. Diese Adresse ist öffentlich. Weder Admin-PIN noch bisherigen Verbindungsschlüssel in die Website eintragen.
7. Erst jetzt den vorbereiteten Zweig nach `main` übernehmen und die GitHub-Pages-Bereitstellung abwarten.

## Nach dem Update

- Das bisher eingerichtete Gerät übernimmt das Admin-Profil samt lokalem Lernstand automatisch. Auf neuen Geräten: **Admin** wählen und PIN eingeben.
- **Einstellungen → Profile verwalten**: Name und E-Mail-Adresse anlegen.
- **Sammlungen → Sammlungen teilen**: Sammlung und Empfänger bewusst auswählen. Die Kopie enthält keine Bewertungen oder Lernstände.
- Freunde melden sich auf derselben Website mit ihrer freigeschalteten E-Mail an. Keine Schlüssel, Links oder Codes zusätzlich nötig. Die erste Anmeldung benötigt Internet; spätere Nutzung funktioniert auch offline.
- Freunde können ihre Kopien vollständig bearbeiten. Deine späteren Änderungen bleiben privat, bis du sie unter **Änderungen auswählen** gezielt sendest. Unveränderte Empfängereinträge werden automatisch aktualisiert; bei eigenen Änderungen entscheidet der Empfänger über die Übernahme.
- Freunde erhalten beim Start und vor dem Runden-Ergebnis den Cloud-Abgleich. Bei fehlender Verbindung können sie offline fortfahren. Änderungen bleiben gespeichert und werden später übertragen.
- App-Updates werden beim Öffnen geprüft und an einer sicheren Stelle außerhalb laufender Übungen und Bearbeitungsfenster aktiviert.

## Technische Prüfung und Grenzen

`npm test` prüft Rechte, Profiltrennung, bestehende Admin-Daten, Versand nur ausgewählter Änderungen, Wiederholungsversuche, Konflikte und die bisherige Lernlogik. Ein echter End-to-End-Test mit der Google-Bereitstellung und auf dem iPhone steht bis zur Bereitstellung aus.

Die E-Mail-Anmeldung ist wie vereinbart eine Profilauswahl ohne Eigentumsnachweis. Rollen und Datenzugriffe werden trotzdem serverseitig aus der Sitzung bestimmt. PIN-Prüfung und Sitzungsschlüssel liegen im Backend. Der alte Verbindungsschlüssel bleibt für die Migration bestehender Admin-Geräte gültig.
