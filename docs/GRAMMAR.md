# Grammatik lernen · 2.6.0

Der Bereich erscheint auf dem englischen Lernbildschirm nur für Admins. Serverseitig wird jede `grammar*`-Aktion zusätzlich mit dem bestehenden Sitzungstoken und `role === admin` geprüft. Schüler haben auch bei direkten API-Aufrufen keinen Zugriff.

## Inbetriebnahme

1. `Latinio_Update_2.6.0.zip` vollständig entpacken und `Installieren.bat` ausführen. Der Installer erstellt eine geprüfte SQLite-Sicherung und aktualisiert nur `/home/tiago/vokabeltrainer`, Compose-Projekt `vokabeltrainer`, Dienst `api`.
2. Nach erfolgreicher Installation muss `/health` neben den bisherigen Flags `grammarReady:true` melden. Dieses Flag bestätigt das installierte Modul, nicht einen gültigen OVH-Schlüssel.
3. Erst dann den vorbereiteten GitHub-Stand veröffentlichen. Adresse, Manifest und installierte PWAs bleiben erhalten.
4. In Englisch als Admin: **Grammatik lernen → KI-Einstellungen**. OVHcloud-AI-Endpoints-Schlüssel eintragen, speichern, erste Dreierrunde generieren.

Der Schlüssel wird durch den authentifizierten Admin-Request über HTTPS an den Pi übertragen, atomar unter `/data/grammar-ovh.key` mit Modus `0600` geschrieben und niemals zurückgegeben. Er liegt im bestehenden privaten Docker-Volume. Alternativ wird eine bereits gesetzte Umgebungsvariable `OVH_AI_ENDPOINTS_ACCESS_TOKEN` verwendet; dann ist die Eingabe im UI ausgeblendet. Keine Compose-Änderung erforderlich. Browser, Git, ZIP und Logs enthalten keinen echten Schlüssel. Das Eingabefeld wird vor dem asynchronen Speichern geleert. Beim Wiederherstellen allein aus einer SQLite-Sicherung muss ein verlorener Schlüssel erneut eingegeben werden; die SQLite-Sicherung enthält absichtlich keinen Schlüssel.

## OVHcloud

Offizielle Quellen, am 20.10.2026 geprüft:

- https://www.ovhcloud.com/de/public-cloud/ai-endpoints/catalog/llama-3-3-70b-instruct/
- https://docs.ovhcloud.com/en/guides/public-cloud/ai-machine-learning/ai-endpoints-structured-output

Festes Modell `Meta-Llama-3_3-70B-Instruct`, fester HTTPS-Endpunkt `https://oai.endpoints.kepler.ai.cloud.ovh.net/v1/chat/completions`. Kein Modellwechsel, keine benutzerdefinierte Ziel-URL, keine Redirects. Node-eigenes `fetch`, keine zusätzliche Abhängigkeit. Bearer-Authentifizierung, `messages`, `response_format.type=json_schema`, Schema mit Pflichtfeldern und ohne Zusatzfelder. Generierung Temperatur 0,4; Bewertung 0. Das sind Ausgangswerte, keine Qualitätsgarantie. `max_tokens` steigt mit 3/5/10 Aufgaben (Generierung 800+420n, Korrektur 900+650n), `stream:false`. Provider-Timeout 85 s, Browser-Timeout für die drei KI-Aktionen 100 s. Andere Requests behalten ihre bisherigen Timeouts.

`finish_reason` muss `stop` sein. Verweigerungen, abgeschnittenes JSON, unbekannte Felder, fehlende/verdoppelte IDs, falsche Anzahl, Themenwechsel und widersprüchliche Formate werden nicht als Lernleistung gespeichert. Keine automatischen kostenpflichtigen Wiederholungen. Erneut versuchen ist bewusst und innerhalb des Tageslimits möglich. Rohantworten des Providers erscheinen nie in Fehlermeldungen.

## Lernlogik

`server/grammar-content.mjs` enthält das feste Curriculum `english-auxiliaries-v1`, die PDF-Zusammenfassung und getrennte Generierungs-/Korrekturprompts samt Schemas. Grundlage: die vom Nutzer beigefügte `Englisch_Lernverlauf_fuer_Work.pdf` vom 20.10.2026. Die vollständige PDF wird nicht gespeichert oder bei jeder Anfrage übertragen. Die Zusammenfassung enthält Lernmuster und anonymisierte Beispielsätze, keine Zugangsdaten oder Daten anderer Nutzer.

Sechs feste Ziele: do/does, did, be, Modalverben, Fragewortstellung, bejahende Aussagen/Nebensätze. Der Server legt für jede Aufgabe Ziel und ID vor dem Modellaufruf fest. Rund zwei Drittel üben häufige Schwächen, der Rest wiederholt rotierend andere Ziele. Über mindestens zwei Beobachtungen bestätigte Zusatzfehler (Grundform, Continuous, Verbmuster, dritte Person, Nebensatzstellung) dürfen Hilfsverbsätze ergänzen, nicht das Thema ersetzen. Die letzten 30 Runden steuern das Lernprofil. Ein einzelner Fehler stellt nicht das gesamte Programm um. Schwierigkeit 2 erst ab mindestens 20 eindeutigen Zielbewertungen und mindestens 80 Prozent Erfolg.

Die erste Fassung verwendet deutsche Übersetzungsaufgaben mit optionaler Vokabelhilfe. Jede Aufgabe wird einzeln beantwortet; eine abschließende Übersicht erlaubt Änderungen. Erst ausdrückliches Absenden erzeugt eine gemeinsame KI-Korrektur.

Die vier Dimensionen Zielgrammatik, sonstige Grammatik, Wortwahl und Inhalt bleiben getrennt. Rechtschreibung, Großschreibung und reine Zeichensetzung sind keine Bewertungskriterien. Echtes Tempus darf nicht weg-normalisiert werden. `like swimming`/`like to swim`, betontes `did play`, `did played` als Fehler, be versus do, Modalverben, although und nicht erzwingendes `today` sind ausdrücklich im Prüfvertrag enthalten. Das Gesamturteil wird serverseitig aus den Dimensionen berechnet. Eine leere Antwort ist `not_answered`; unklare Antworten oder widersprechende Nachprüfungen zählen nicht zum Lernprofil. Wortwahlfehler erzeugen keinen Hilfsverbfehler.

Bis zu zwei unabhängige Nachprüfungen pro Runde. Alle Auswertungen bleiben erhalten. Weicht eine Nachprüfung in irgendeiner Dimension von der ursprünglichen Bewertung ab, erhält die Aufgabe `uncertain`; keine zusätzliche Fortschrittsbuchung. Die semantische Korrektheit einer Modellantwort lässt sich nicht durch JSON-Validierung garantieren. Die Schaltfläche „Bewertung erneut prüfen“ und die getrennten Dimensionen bleiben deshalb sichtbar.

Grammatik hat einen eigenen Lernverlauf. Bestehende Vokabelreviews, Sammlungen und Streak-Datensätze werden durch das Modul nicht verändert.

## Daten und Wiederaufnahme

Eigene Tabellen in derselben privaten SQLite-Datei: `grammar_rounds`, `grammar_operations`, `grammar_usage`, `grammar_config`. Bestehende Online-Sicherungen erfassen sie automatisch; kein Reimport, keine Datenbank-Rücksetzung, keine fremden Volumes. Musterlösungen werden vor der Korrektur nicht an den Browser gesendet.

Antworten werden sofort profilbezogen im Browser zwischengespeichert und nach 1,2 Sekunden beziehungsweise beim Weitergehen mit Versionsprüfung zum Pi übertragen. Lokal geladene Aufgaben sind offline beantwortbar. Generierung und Bewertung brauchen Internet. Konflikte zwischen zwei Geräten erfordern einen expliziten Vergleich; vor einer Entscheidung wird der lokale Entwurf als zusätzliche lokale Sicherung abgelegt. Bereits ausgewertete Antworten sind unveränderlich. Im Verlauf können auch ältere offene Runden fortgesetzt werden (30 Einträge pro Seite).

Persistente Anfrage-IDs und Hashes verhindern doppelte generierte Runden und doppelte Auswertungen, einschließlich paralleler Klicks und Antwortverlust nach erfolgreicher Serververarbeitung. Ein Neustart markiert offene KI-Aufträge als unterbrochen. Ein Statusabruf nach dem Öffnen liefert fertige Ergebnisse ohne erneuten Modellaufruf. Nur eine Modellanfrage gleichzeitig; die normalen Vokabel-API-Aufrufe bleiben während externer KI-Wartezeit verfügbar. Transaktionen umfassen keine Netzwerk-Wartezeit.

Standardlimit: 40 Modellaufrufe und 200.000 Tokens je Kalendertag Europe/Berlin. Im Adminbereich anpassbar (2–200 Aufrufe, 20.000–2.000.000 Tokens). Vor jeder Anfrage werden Eingabe-Bytes plus maximales Ausgabetokenbudget konservativ reserviert. Liefert OVH die Verbrauchszahlen, ersetzt der echte Verbrauch die Reservierung. Bei unbekanntem Verbrauch nach Abbruch bleibt die Schätzung erhalten. Anzeige ist keine Rechnung. Fehlgeschlagene Anfragen dürfen nicht durch Neustarts aus dem Budget verschwinden.

## Prüfungen und Grenzen

Tests decken den realen SQLite-/HTTP-Pfad, Rollenprüfung, sichere Schlüsselspeicherung, Rundengrößen, Eingabeerhalt, Replays, Neustarts, Geräte-Konflikte, Modellfehler, Tokenlimits, 20 adaptive Runden sowie Frontend-Steuerung einschließlich Offline-Wiederaufnahme ab. Der Providertransport ist simuliert, es wurden keine echten OVH-Aufrufe abgesetzt. Die fachlichen Prüffälle sichern Prompt und Bewertungsregeln; sie beweisen nicht, dass das reale Modell jede Schülerantwort richtig beurteilt. Erster echter Modelltest erfolgt nach Einrichtung des Nutzerschlüssels. Keine visuellen Browserchecks gemäß Projektpräferenz; Windows-Installer und ARM-Installation werden bis zur Nutzerinstallation nicht als nativ getestet behauptet.

Elektro Gilbers, Betriebssystem, Tailscale, Port 8080, dessen Container und Volumes werden nicht verändert. Der Installer vergleicht den Geschäftscontainer nur lesend vor und nach dem privaten Update.
