# Wordlo 1.0.0

Eigenständige Englisch-Vokabel-App mit einem persönlichen Lernstand. Vanilla HTML/CSS/JavaScript, ohne Build-Schritt oder kostenpflichtige API. Eigenes Logo, Dunkelblau/Lavendel/Apricot, responsiv für iPhone, iPad und Desktop; automatische dunkle Darstellung und reduzierte Animationen.

## Funktionen

- Deutsch → Englisch, Englisch → Deutsch und adaptiver Mix; Fehler, Teilwissen, tatsächliche Bedeutungen und Sprachvarianten separat gespeichert.
- Vor jeder Runde frei wählen: eine richtige Bedeutung oder alle Buchbedeutungen. Wechsel auf „alle“ macht unbekannte Bedeutungen nicht automatisch sicher.
- Plus-Antwortfelder, unabhängige Antwortreihenfolge, hinterlegte Alternativen innerhalb einer Bedeutungsgruppe.
- Deutsch: Tastaturkorrektur erlaubt, vorsichtige automatische Tippfehlererkennung und manuelle Zuordnung zur gemeinten Buchbedeutung. Englisch: Korrektur/Prüfung abgeschaltet, strikte Schreibweise einschließlich Groß-/Kleinschreibung; keine manuelle Tippfehler-Freigabe.
- Nur gespeicherte Buchantworten. Keine externen Synonyme, Wörterbuchabfragen oder Grammatikaufgaben.
- UK/US-Kennzeichnung im Wortdatensatz; nach richtiger englischer Übersetzung eigene Zuordnungsaufgabe. Im Ein-Bedeutungs-Modus nur zur tatsächlich eingegebenen Variante. Übersetzung und Zuordnung getrennt bewertet.
- Eigene Sammlungen, Worteditor, Suche, Aktivierung, Export und JSON-Import mit Vorschau.
- Auffrisch-Listen manuell, aus einem Test oder direkt aus JSON. Vorhandene Wörter werden verknüpft, neue Papierwörter können ohne normale Sammlung direkt in der Auffrisch-Liste liegen.
- Smarte Wiederholung mit Abständen, schwächere Richtung häufiger, Fehler einmal in derselben Runde wiederholen; Wiederholungen löschen den ersten Fehler nicht. Kein Tageslimit.
- Lokaler IndexedDB-Speicher, gespeicherte pausierte Runde, Backup-Export/-Import, PWA und Offline-Dateien.
- Eigener Google-Apps-Script-Backendcode: Änderungsjournal, erwartete Basisversion, idempotente Operationen, automatische geräteübergreifende Zusammenführung unabhängiger Änderungen und manuelle Wahl bei Konflikten. Keine Benutzerverwaltung oder Freigaben.

## Bereitstellung

Alle Dateien können unverändert in ein eigenes GitHub-Pages-Repository oder einen Unterordner gelegt werden. Relative Pfade, eigener Service-Worker-Bereich, eigener Cache-Präfix `wordlo-` und Datenbank `wordlo-v1`. Keine bestehende Latinio-Konfiguration oder Lerndaten werden übernommen.

Die App startet bewusst ohne Buchvokabeln. Die Inhalte des Englischbuchs wurden nicht bereitgestellt. Unter `examples/` stehen ausdrücklich gekennzeichnete Importvorlagen, keine vorinstallierten Trainingsdaten.

Für Google die Schritte in [EINRICHTUNG.html](EINRICHTUNG.html) ausführen. Ohne eingerichtete Bereitstellung funktioniert die App lokal. Ein mitgeliefertes Skript ist noch keine aktivierte Cloud-Verbindung. Live-Synchronisierung muss nach der einmaligen Google-Freigabe auf zwei Geräten geprüft werden.

## Entwicklung und Tests

Statischer Server, z. B. `python -m http.server 8000`. Logik- und Backendtests: `npm test` (Node 20+). Keine Installation von Laufzeitpaketen notwendig.

Tests prüfen sprachabhängige Schreibweise, manuelle deutsche Korrekturen, Bedeutungsmoduswechsel, getrennte Richtungen, UK/US-Fragen, Papierimport, Duplikate, Wiederholungen, Konflikte und die atomare/idempotente Backend-Verarbeitung. Der Apps-Script-Test verwendet einen isolierten Spreadsheet-Harness und ersetzt keine echte Google-Bereitstellung.

Tastatureinstellungen sind HTML-Empfehlungen an Browser/OS. Das konkrete Verhalten von iOS-Tastaturen muss auf einem echten iPhone geprüft werden. Die Oberfläche fordert beim englischen Antworten explizit `autocorrect=off`, `autocomplete=off`, `autocapitalize=none` und `spellcheck=false` an.
