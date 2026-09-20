# Latinio · Version 1.3.0

## Neu: kompakte Verwaltung und eigene Auffrisch-Sammlungen

- Numerische Lektionssortierung (1, 2, 10), einklappbare Aktiv-Auswahl und Werkzeuge, Sammlungs-Dropdown und begrenzte Listenhöhe statt langer Chip-Liste.
- Eigener Reiter „Auffrisch-Sammlungen“. Persönliche Listen speichern nur Wort-IDs und Aufnahmezeitpunkte in den synchronisierten Einstellungen. Originale werden weder kopiert noch in Unterricht/Sammlungssuche verdoppelt. Änderungen am Original gelten auch in der Übungsliste; gelöschte Originale werden ausgefiltert.
- Auffrischungschecks für eine oder mehrere Lektionen sowie bestehende Auffrisch-Sammlungen. Danach Ziel-Liste wählen oder neu benennen; Fehler/Teilwissen sind vorausgewählt, weitere Wörter frei hinzufügbar. Bisherige unsichere Wörter lassen sich übernehmen.
- Aktivierte Auffrisch-Sammlungen erscheinen im normalen Training, auch wenn ihre Originallektion inaktiv ist. Mehrfach enthaltene Wort-IDs kommen nur einmal in die Runde. Vollständig richtige erste Antworten nach Aufnahme erledigen ein Wort; Rundenwiederholungen löschen den ersten Fehler nicht. „Erneut üben“ startet einen neuen Durchgang, ohne die Lernhistorie zu löschen.
- Manuell hinzufügen, Mitgliedschaft bearbeiten, umbenennen, aktivieren/deaktivieren und Listen löschen. Originalwörter und Lernstände bleiben beim Löschen der Liste erhalten.
- Grün, Ozeanblau, Violett und Beere; weiches oder schlichtes Design; kompakte oder großzügige Abstände. Einstellungen bleiben je Profil synchronisiert. Bewertungsfarben bleiben unabhängig vom Farbthema.
- Kein Apps-Script-Update für 1.3.0 nötig. Push-Erinnerungen bleiben zurückgestellt: verlässlicher Versand bei geschlossener App benötigt zusätzliche serverseitige Web-Push-Infrastruktur ([WebKit](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)).

Validierung: 73 automatisierte Tests; Syntax und Offline-Manifest geprüft. Die lokale visuelle Browserprüfung wurde durch ERR_BLOCKED_BY_CLIENT verhindert.

## Neu: aktive Sammlungen und Auffrischungscheck

Unter Sammlungen steuert jeder Nutzer seine eigene Aktiv-Auswahl. Bestehende Sammlungen sind zunächst aktiv. Inaktive bleiben im Unterricht und in der Verwaltung sichtbar, fehlen aber in Home, Smart/Alle/Lernen/Auffrischen und automatischen Verwechslungsrunden. Die Auswahl synchronisiert als persönliche Einstellung und wird nicht geteilt.

Das ⋯-Menü bietet „Kann ich schon“ und einen vollständigen Auffrischungscheck. Manuelles Markieren erhält die Historie und zählt nicht als heute trainierte Antwort. Der Check fragt jedes Wort einmal. Nicht vollständig gewusste Wörter aus inaktiven Sammlungen sammeln sich in „Inaktive Vokabeln auffrischen“. Eine spätere vollständige erste Antwort entfernt sie; Wiederholungen innerhalb derselben Runde löschen den ursprünglichen Fehler nicht. Reaktivierte Sammlungen gehen zurück ins normale Training.

JSON-Wörter dürfen optional `"forms": ["vocem", "vocibus"]` enthalten. Diese Such-Aliasse bleiben im Training verborgen und lassen sich im Vokabeleditor pflegen. Zusätzlich liefert eine begrenzte Offline-Heuristik mögliche gebeugte Formen. Sie ist keine vollständige Morphologie oder kontextabhängige Übersetzung; die Anzeige nennt weiterhin die gespeicherten Grundbedeutungen. Grammatische Grundlage: [Allen & Greenough, Konjugationen](https://dcc.dickinson.edu/grammar/latin/four-conjugations) und [Deklination](https://dcc.dickinson.edu/grammar/latin/rules-noun-declension).

Die Lernfunktionen funktionieren mit dem bestehenden Mehrbenutzer-Backend. Damit explizite Such-Aliasse auch beim Teilen an andere Nutzer übertragen werden, `google/Accounts.gs` ersetzen und die vorhandene Apps-Script-Bereitstellung als neue Version veröffentlichen. Kein neuer Schlüssel und keine erneute Einrichtung erforderlich.

Private Latein-Lernapp für iPhone, iPad und Desktop. Installierbare, statische PWA, vorbereitet für GitHub Pages. Keine kostenpflichtigen Laufzeitbibliotheken, keine KI-API und kein Apple-Entwicklerabo erforderlich.

## Enthalten

- 46 Vokabeln von den zwei bereitgestellten Fotos in der Sammlung „Lektion 1–10“.
- Ausschließlich Latein → Deutsch. Alle angegebenen Nomenformen werden angezeigt.
- Eine Bedeutung pro Antwortfeld; weitere Felder über Plus. Die Zahl der erwarteten Bedeutungen bleibt verborgen.
- Vollständig richtig, teilweise richtig (bestanden), falsch; falsche Zusatzbedeutungen werden markiert.
- Optionale Klammerteile; akzeptierte Synonyme innerhalb eines Bedeutungsfeldes mit `/`.
- Vorsichtige Tippfehlererkennung: ab fünf Zeichen genau ein Editierfehler oder eine benachbarte Vertauschung, nur bei einer eindeutigen Bedeutungsgruppe. Keine automatische semantische KI-Bewertung. Beide manuellen Korrekturrichtungen verfügbar.
- Lernplan mit wachsenden Abständen (1, 3, 7, 14, 30, 60, 90 Tage). Teilwissen: 1 Tag; Fehler: 12 Stunden. Fällige Wörter vor neuen Wörtern. Freies Üben aller ausgewählten Wörter.
- Fehler und Teilwissen einmal am Ende derselben Runde wiederholen. Der erste Fehler bleibt im Lernplan; keine endlose Wiederholungsschleife.
- Vokabeln im Test bearbeiten; die aktuelle Bewertung wird danach neu berechnet. Sammlungen und Wörter anlegen, bearbeiten und löschen.
- JSON-Import mit Vorschau, Prüfung und Erkennung von Dubletten innerhalb der Importdatei. Ein bereits vorhandenes Paket wird nicht überschrieben. Gleiche Wörter in verschiedenen Paketen dürfen vorkommen.
- Tagesziel, Hell-/Dunkel-/Systemmodus. Lokale Datenbank, Wiederaufnahme unterbrochener Runden, PWA-Offline-Dateien.
- Automatisches Hochladen von Änderungen nach Google, Versionsstatus, bewusster Download neuer Cloud-Stände und Konfliktauswahl.

## Start und Veröffentlichung

Siehe **ANLEITUNG.html** für die Einrichtung von GitHub Pages und Google Apps Script. `index.html` muss über HTTPS ausgeliefert werden; Doppelklick auf eine lokale Datei ersetzt kein Website-Hosting. Alle Pfade sind relativ und funktionieren auch unter einem GitHub-Projektpfad.

Für lokale Entwicklung genügt ein statischer HTTP-Server. Das Projekt braucht keinen Build-Schritt. Syntax-/Logikprüfung: `npm test` (Node.js 20 oder neuer, ohne Installation).

## Datenversionen: bestätigter Stand und ausstehende Änderungen

**App-Version** (0.1.0) und **Datenversion** (v1, v2, v3 …) sind verschieden. Datenversionen sind ganze Zahlen, keine Dezimalzahlen. Das vermeidet die Verwechslung zwischen 0.10 und 0.1.

Die Cloud vergibt für jede erfolgreich geschriebene Änderung unter einer Sperre genau eine fortlaufende Version. Jeder lokale Vorgang hat zusätzlich eine UUID, eine Gerätekennung und einen lokalen Zähler. Ein Gerät zeigt z. B. „Bestätigt v50, 2 lokale Änderungen“. Erst nach bestätigtem Upload zeigt es v52. Bei einem nicht erreichten Server darf keine neue Cloud-Version behauptet werden.

Beim Öffnen, Wieder-online-Gehen und während geöffneter App etwa jede Minute wird geprüft. Nach Änderungen wird kurz gebündelt hochgeladen. Vor jedem Upload prüft der Server die erwartete Basisversion. Bei Abweichung schreibt er nichts. Die App fordert zum Laden der neueren Cloud-Version auf. Unterschiedliche Einträge werden zusammengeführt; Bearbeitungen desselben Eintrags müssen ausgewählt werden. Wiederholte Übertragungen derselben Änderungs-ID werden nur einmal gespeichert.

Antworten werden beim Prüfen lokal samt Bewertung gespeichert. Korrekturen ändern dieselbe Bewertung; die Versionshistorie bewahrt die Operationen. Beim Weitergehen wird der Rundencursor lokal gespeichert. Noch ungeprüfte Texte und die aktuelle Navigation sind Bedienzustand, keine neue Cloud-Datenversion. Beim bewussten Pausieren bleiben auch die Eingabefelder lokal erhalten. Runden werden pro Gerät fortgesetzt; beantwortete Wörter, Lernstand und abgeschlossene Runden werden synchronisiert.

Cloud-Übertragung läuft parallel zur Oberfläche, solange der Browser sie ausführt. Nach Sperren/Schließen des iPhones kann sie unterbrochen sein. Die Warteschlange bleibt in IndexedDB und wird erneut gesendet. „Alles hochgeladen“ erscheint erst nach einer Serverbestätigung. Auf einem neuen Gerät sind Skript-Adresse und privater Verbindungsschlüssel einmal nötig; keine Vokabeldatei muss manuell importiert werden.

## Google-Teil

`google/Code.gs`, `google/Bridge.html` und `google/appsscript.json` werden in einem an eine private Google-Tabelle gebundenen Apps-Script-Projekt verwendet. Das Skript erstellt das Blatt „Änderungen“. Das Journal enthält jede Datenänderung mit Versionsnummer; daraus rekonstruiert der Server den Stand. Werte in der Tabelle nicht manuell überschreiben. Eine Änderung am Lernmaterial erfolgt über die App.

Die öffentliche Skript-Web-App ist durch einen langen privaten Verbindungsschlüssel geschützt. Der Server speichert dessen SHA-256-Hash in ScriptProperties; der Klartextschlüssel liegt nur auf den gekoppelten Geräten. Herkunft und zufällige Kanal-ID schützen die Nachrichtenbrücke. Keine Schlüssel in GitHub, URL-Abfrageparametern oder Quelltext eintragen. Das Skript verwendet eine iframe-Nachrichtenbrücke und `google.script.run`, um Cross-Origin-Fetch-Probleme zu vermeiden.

Die Einrichtung erzeugt bei erneuter Ausführung einen neuen Schlüssel; die Geräte müssen danach den neuen Schlüssel erhalten. Die bestehenden Daten bleiben bestehen. Ein Wechsel zu einer anderen Cloud-Adresse bei bereits bestätigten Daten wird absichtlich nicht automatisch ausgeführt.

## Aufbau für spätere Erweiterungen

| Datei | Aufgabe |
| --- | --- |
| `app/vocabulary.js` | Originale Sammlung |
| `app/core.js` | Antwortprüfung, Wiederholungsplan, Import, Datenkonflikte |
| `app/store.js` | IndexedDB und lokale Änderungswarteschlange |
| `app/sync.js` | Nachrichtenbrücke und Synchronisierung |
| `app/main.js` | Oberfläche und Bedienabläufe |
| `app/style.css` | Helles/dunkles, responsives Design |
| `google/` | Privates Google-Backend |
| `tests/` | Gezielte Logik- und Backendtests |

Neue Übungsarten können auf denselben Daten- und Synchronisierungsmechanismen aufbauen. Bei zukünftigen Änderungen die App-Version und den Cache-Namen in `sw.js` erhöhen. Ein neuer Service Worker wird nach Schließen der alten App-Ansichten aktiv. App-Datenbank und Lernstände werden bei normalen Quellcodeupdates nicht gelöscht.

## Prüfstand dieser Lieferung

Die automatisierten Prüfungen decken Antwortbewertung, Klammern, Tippfehlerkorrektur, Wiederholungsabstände, Import und die Google-Versionslogik mit nachgebildeten Google-Diensten ab. Sie ersetzen keine Prüfung am echten iPhone und keine Live-Prüfung des bereitgestellten Google-Skripts. Die Cloud-Verbindung ist erst nach Einrichtung und erfolgreichem Abgleich tatsächlich aktiv. Ohne Konfiguration zeigt die App ausdrücklich „Cloud noch nicht verbunden“ und speichert lokal.

## Update 0.1.1

Beim Start und bei Rückkehr in die App sperrt ein zentraler Cloud-Dialog die Bedienung, bis der Abgleich abgeschlossen ist. Ein neuerer Stand muss zuerst geladen werden. Bei einem Verbindungsfehler stehen „Erneut versuchen“ und „Offline fortfahren“ zur Verfügung. Ohne eingerichtete Cloud bleibt die Einrichtung zugänglich. Das Google-Skript und das Datenformat bleiben unverändert.

## Update 0.1.2

Einstellungen bieten eine explizite Suche und Aktivierung von App-Updates. Der Service Worker ersetzt nur den App-Cache; IndexedDB und Cloud-Zugang bleiben erhalten. Neue Versionen müssen weiterhin eine neue Cache-Kennung und APP_VERSION erhalten.

Antworten werden direkt grün/rot markiert. Fehlende Bedeutungen erscheinen als Lösungsfelder, falsche Antworten durchgestrichen mit einer möglichen Lösung. Die Rückmeldung bleibt kompakt; manuelle Anerkennung eines Tippfehlers und Bearbeitung der Vokabel bleiben verfügbar. Lernbewertung und Wiederholungsplan ändern sich nicht.

## Update 0.2.0 – Verwechslungen

Falsche Antworten werden mit den Bedeutungen anderer aktiver Vokabeln verglichen (inklusive optionaler Klammern). Erst nach Bestätigung wird ein Wortpaar gespeichert. Unter Sammlungen lassen sich Paare manuell anlegen, entfernen und üben.

Nach einer Vokabelrunde wird bei fälligen Paaren aus der Runde eine Zuordnungsrunde mit zwei bis vier Wörtern angeboten. Richtige Runden verlängern die Abstände auf 1, 3, 7, 14 und 30 Tage; Fehler führen nach 12 Stunden zur nächsten Wiederholung. Manuelles Üben ist jederzeit möglich. Abgebrochene Zuordnungsrunden zählen nicht als Erfolg.

Paare und einzelne Trainingsresultate werden als getrennte, typisierte Datensätze im bestehenden settings-Bereich synchronisiert; general bleibt unverändert. Das Google-Skript braucht kein Update. Die laufende Zuordnungsrunde wird lokal gespeichert, abgeschlossene Resultate werden synchronisiert.

## Update 0.2.1

Der Bearbeitungsstift im Test bietet jetzt Verwechslungsgefahr und Vokabeleintrag als separate Aktionen. Bei der Verwechslung ist das aktuelle Wort vorausgewählt; die laufende Aufgabe bleibt erhalten. Sanfte Animationen begleiten Navigation, Dialoge, Feedback und Karten; reduzierte Bewegung schaltet sie ab. Das neue App-Symbol greift das kleine l und den Stern des Schriftzugs auf, mit eigenen Apple-Touch- und Manifest-Dateien.

## Update 0.2.2

Deutsche Antwortfelder erlauben wieder die geräteeigene Autokorrektur und Rechtschreibprüfung. Nach jeder Auswertung erscheint unter der Lateinkarte eine zweite Karte mit allen deutschen Übersetzungen, durch Kommas getrennt. Die Antwortzeilen zeigen nur noch die eigenen Eingaben; falsche bleiben durchgestrichen. Zusätzliche Lösungs- oder Fehlte-Felder entfallen.

## Update 0.2.3

Nach den geplanten Aufgaben bietet das Training unbegrenztes Weiterüben: alle ausgewählten Vokabeln, nur noch nicht sichere Wörter oder sichere Wörter auffrischen. Das Tagesziel ist keine Sperre. Auffrischen ist auch direkt auf der Startseite verfügbar. Auswahl und Ergebnisse verwenden die bestehende Bewertungshistorie; beim gezielten Üben kommen die am längsten nicht abgefragten Wörter zuerst. Das normale Training mischt zusätzlich zu fälligen Wiederholungen täglich ein sicheres Wort ein, sofern heute noch keines aus der Auswahl wiederholt wurde.
