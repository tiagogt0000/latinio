# Latinio – Projektübergabe

Stand: 8. Oktober 2026, Version 2.0.11.

## Stand 2.0.11

Auf Nutzerwunsch rote Hintergrundflächen auf etwa halbe Intensität reduziert (Spitze .46, Abschluss .28). Home-Smart-Buttons wieder mit `--green` wie vor 2.0.6; die dort eingeführte `--green-dark`-Überschreibung war im Dark Mode heller. Keine Backendänderung.

## Stand 2.0.10

Nur Hintergrund der Admin-Streak-Demos erweitert: vier radiale Rotflächen in `streak-backdrop` mit unabhängig bewegten Transform-Ebenen, weichem Intensitätsaufbau und ruhiger Mitte. Bewegung reduziert: statischer Hintergrund. Kein Backendupdate.

## Stand 2.0.9

Animationslabor neu choreografiert: Feuerkreis, Flammenwelle, Sonnenkern. Jede Vorschau beginnt mit Test → Test → Weiter. `mountStreakDemo()` bindet ausschließlich das eigene Formular, stoppt dessen Submit-Bubbling vor den Lernformular-Handlern und steuert die Phasen question → leaving → blank → celebrate. `showStreakDemo()` hängt die Abmeldung aller Listener/Timer und die Wiederherstellung des Scroll-Locks an den bestehenden Dialog-Cleanup. Wiederholen beginnt erneut mit der Testfrage. Keine Store-/Cloud-Abhängigkeiten, echte Streaks weiterhin nicht implementiert.

CSS isoliert die Vorschau vom globalen Dialoglayout (dessen h2-Innenabstand hatte die alte Überschrift verschoben). Flamme und Zahl liegen in einem gemeinsamen zentrierten Raster; Einflug und laufende Flammenbewegungen nutzen getrennte Ebenen. Hell/Dunkel/Wie in der App nur für die Vorschau auswählbar. Tag 1: Zündung; Tag 30: 30 Lichtstriche; Tag 100: Funkenkrone. `prefers-reduced-motion` wird bei Start gelesen und zusätzlich in CSS beachtet. Automatische Tests prüfen Eingabe, Ablauf, Zwischenphase, Doppelklick, Abbruch, Replay und Bewegungsreduktion. Kein visueller Browsercheck gemäß Nutzerpräferenz. Keine Backendänderung.

## Stand 2.0.8

Admin Tests unter Einstellungen öffnen das Animationslabor. `app/streak-demo.js` und `app/streak-demo.css` sind isolierte Vorschauen ohne Store-/Sync-Abhängigkeiten. Die drei Varianten unterstützen Tag 1, 2, 3, 7, 30 und 100. Aufrufaktionen sind zusätzlich mit isAdmin abgesichert. Kein echtes Streak-System implementiert; Home-Blitz unverändert. Bewegungsreduktion wird berücksichtigt. Dateien liegen im Offline-Shell-Cache.

## Stand 2.0.7

Unter Sammlungen startet die Suche geschlossen und öffnet sich über ein Symbol neben der Überschrift. Die Sammlungsreiter bleiben auch auf schmalen Displays in einer Zeile. Nutzeraktionen sind flache Textaktionen mit grüner Linie.

`render()` merkt die Scrollposition bei Aktualisierungen derselben Ansicht und setzt sie nur bei Seitenwechsel zurück. Die Ganzseiten-Einblendung läuft nicht mehr bei jedem Render; Seitenwechsel und Dialoge erhalten unterschiedliche kurze Übergänge. Nach 140 ms zeigen aktive Aktionsknöpfe drei animierte Ladepunkte. `prefers-reduced-motion` wird berücksichtigt. Keine visuelle Browserprüfung (Nutzerwunsch).

Die Google-Apps-Script-kompatible FNV-Funktion für alte Perfekt-Sammlungs-IDs verwendet zwei 32-Bit-Werte statt BigInt-Literalen. Regressionstest deckt 102 lateinische, mehrsprachige und Unicode-Namen ab.

## Stand 2.0.6

Neue Freigabeübersicht in `app/share-access.js` und `app/sharing-ui.js`: alle Sammlungstypen, sichtbare Empfänger, Suche/Filter und Mehrfachbearbeitung. `collectionAccessSet` im Google-Skript verarbeitet einzelne Nutzer/Sammlungen. `shareList.accessSchema === 2` ist Voraussetzung; ältere Backends erhalten einen Update-Hinweis. Beide Google-Dateien müssen separat bereitgestellt werden; der produktive Backendstand wurde nicht verändert.

`resourceShare` und `resourceEntry` speichern sammlungsgenaue Auffrisch-/Perfektfreigaben samt Vergleichsständen. Bisherige globale Perfektfreigaben werden beim Bearbeiten migriert; IDs und Reviews bleiben erhalten. Empfängerbearbeitungen werden als `incomingShare` angeboten statt überschrieben. Widerruf entfernt keine Kopien. Normale Lektionen verwenden weiterhin ihre bestehenden Freigabeoperationen.

Sprachwahl und Sammlungstabs ohne Kästen, Verwechslungen eigener Reiter, zentrierte Suche und flache Startbuttons. Service Worker enthält das neue Modul. Tests laufen ausschließlich lokal gegen simuliertes Apps Script; kein visueller Browsercheck.

Die folgenden 2.0.5-Abschnitte sind historisch; insbesondere die dort genannte globale Perfektfreigabe wurde ersetzt.

## Projekt und Arbeitsweise

- Repository: https://github.com/tiagogt0000/latinio, Branch `main`.
- App: https://tiagogt0000.github.io/latinio/ (GitHub Pages, statische PWA).
- Der vorherige lange Entwicklungschat endete während einer neuen Aufgabe. Bei Übernahme war `99a8f41b8358b12e2b4b61af89b339ed1c70930f` (2.0.4) der letzte Commit auf main. Die letzte angefragte Überarbeitung war dort noch nicht enthalten. Nicht veröffentlichte Änderungen in einer alten Chatsitzung sind hier nicht überprüfbar.
- Nutzer erlaubt Änderungen an diesem App-Repository und den zugehörigen Google-Drive-/Apps-Script-Ressourcen. Keine visuellen Browserchecks gewünscht. Nicht erneut nach pauschaler Bearbeitungserlaubnis fragen.
- Bestehende Funktionen und Lerndaten erhalten. Nur notwendige Prüfungen. Keine fremden Apps (z. B. Wordlo) ändern.

## Architektur

Vanilla JavaScript mit ES-Modulen, ohne Buildschritt und ohne npm-Abhängigkeiten. `index.html` lädt `app/main.js`. CSS liegt in `app/style.css`.

- `app/main.js`: Navigation, Lernrunden, Einstellungen, Import, Eventbehandlung und Bootstrap.
- `app/core.js`: Datenoperationen, Bewertung und Vokabel-Lernlogik.
- `app/store.js`: profil- und fachbezogene IndexedDB, lokale Änderungen, Lernrunden und Änderungsjournal.
- `app/sync.js`: authentifizierte Google-Bridge über eingebettetes iframe, Cloud-Versionen, Journal-Push/Pull und Zusammenführung.
- `app/multiuser-sync.js`: gemeinsamer Abgleich, Übernahme geteilter Änderungen, einmaliger Hintergrund-Startabgleich und Ladepunkte am angeklickten Lernstart.
- `app/accounts.js`, `app/sharing-ui.js`: Konten, Nutzerverwaltung und Freigaben. „Letzte Aktivität“ nutzt das bestehende sprachübergreifende Aktivitätsprotokoll, keine Anwesenheitsmessung.
- `app/refresh-*`: Auffrisch-Sammlungen, Import und Karteikarten.
- `app/predicates.js`, `app/predicate-ui.js`: separate Perfektformen, deren Sammlungen, Lernstand und Bearbeitungsoberfläche.
- `google/Code.gs`, `google/Accounts.gs`, `google/Bridge.html`: Google-Apps-Script-Backend; `google/UPDATE.md` beschreibt die bestehende Bereitstellung.
- `app/updates.js`, `version.json`, `sw.js`, `package.json`: Versionsnummer immer gemeinsam erhöhen. Neue Laufzeitmodule zusätzlich in `sw.js` aufnehmen.

Latein und Englisch haben getrennte Datenbereiche. Die letzte Sprachwahl bleibt lokal. Adminbegrüßung „Hallo Tiago“. Englisch nutzt rote Akzente. Perfektformen gehören nur zum Lateinbereich.

## Stand 2.0.7\n\nSammlungssuche startet eingeklappt über ein Suchsymbol. Sammlungsreiter sind immer einzeilig. Nutzeraktionslink ist flach. `render()` bewahrt bei Re-Renders auf derselben Seite `window.scrollY` und setzt Scroll nur bei Seitenwechsel zurück. Daueranimation der gesamten `.content`-Fläche wurde durch bereichsspezifische kurze Übergänge nur beim Wechsel ersetzt. Buttons, die länger als 140 ms laden, zeigen drei Punkte. Dialoge und Antwortfeedback erhalten jeweils passende Einblendungen; `prefers-reduced-motion` wird eingehalten. Kein visueller Browsercheck (Nutzerpräferenz).\n\nDie vorherigen Stände folgen.\n\n## Stand 2.0.5

Die letzte Nutzeranfrage wurde umgesetzt: gleiche Home-Lernkarten, Perfekt-Sammlungsreiter und Bearbeitung, zentraler JSON-Import, Nutzersymbol, flache Sprachoptionen und Hintergrund-Synchronisierung ohne Cloud-Startbildschirm. Startknöpfe warten nur auf den ersten noch laufenden Abgleich. Weiteres Navigieren ist möglich; ein durch Navigation verlassener Start wird verworfen. Spätere Hintergrundabgleiche überschreiben keine Eingaben einer laufenden Runde.

Perfektformen verbleiben als `predicateItem` in `settings`; sie werden nicht zu gewöhnlichen Vokabeln. Sammlungsmetadaten sind `predicateDeck`-Datensätze, Ergebnisse `predicateReview`. Alte Einträge werden über ihren bisherigen Namen zu stabilen virtuellen Sammlungen gruppiert, ohne ihre Schlüssel zu ändern. Neue Einträge tragen `deckId`; Namen reisen zusätzlich mit dem Eintrag durch den vorhandenen Freigabe-Endpunkt. Wiederholter Import derselben benannten Sammlung aktualisiert passende Formen und erhält ihre IDs. Derselbe Infinitiv darf in verschiedenen Sammlungen unterschiedliche Zielantworten haben. Neue Bewertungen sind über `itemId` getrennt; frühere Bewertungen werden über die Grundform weiter berücksichtigt.

Smart-Lernen priorisiert neue/unsichere Formen und begrenzt die Runde auf die eingestellte Aufgabenzahl. Weitere Optionen: sichere Formen auffrischen, unsichere Formen, alle ausgewählten Formen. Diese Optionen haben kein Tageslimit.

Die Anzeige aktiver Prädikatfreigaben wurde repariert: Sie muss `predicateShares` statt der normalen Sammlungsliste auswerten.

## Cloud und bekannte Grenzen

Für 2.0.5 wurde das Google-Skript nicht geändert. Die bestehenden allgemeinen settings-Operationen reichen aus. Die seit 2.0.4 vorhandene Prädikatfreigabe benötigt weiterhin dessen Apps-Script-Endpunkt; ob genau dieser Stand live bereitgestellt wurde, wurde nicht geprüft. Keine produktiven Schülerdaten für Tests verändern.

Perfektfreigaben gelten weiterhin für den gesamten Formenbereich je Nutzer. Beim erneuten Speichern einer Freigabe werden Änderungen erneut übertragen. Geteilte Formen behalten ihre Sammlungsgruppierung; individuelle Aktivschalter/Lernstände sind empfängerseitig. Leere Sammlungen ohne Formen werden vom bisherigen Freigabe-Endpunkt nicht übertragen. Das Entziehen einer Freigabe löscht bereits übertragene Inhalte nicht (bestehende Semantik).

## Prüfung und Veröffentlichung

`npm test` führt die Node-Tests aus. Google-Tests verwenden eine simulierte Apps-Script-Umgebung (`tests/google-harness.mjs`), keine produktiven Konten. Neue Regressionen prüfen Altbestände, Import-IDs, Sammlungstrennung, Smart-Auswahl, Google-Freigabekompatibilität, verzögerten/offline Start, Ladepunkte, Navigation während des Abgleichs und korrekte Freigabe-Häkchen.

Vor Veröffentlichung Syntax, vollständige Tests und Service-Worker-Dateiliste prüfen; anschließend Änderungen auf main übertragen und GitHub-Pages-Deployment sowie ausgelieferte Versionsdatei prüfen. Kein visueller Browsercheck.
