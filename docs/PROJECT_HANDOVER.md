# Latinio – Projektübergabe

Stand: 15. Oktober 2026. Pi-Backend 2.5.0 und Frontend 2.5.0 produktiv bestätigt; Folge-Frontend 2.5.1.

## 2.5.1 – Korrektur des Markenübergangs und Aktivierungshinweis

Kein Backendupdate nötig. Kooperation: Drei feste Gridspalten 1fr/1px/1fr, identische Spaltenabstände, linker Schriftzug rechtsbündig/rechter linksbündig. Solo-Animationen nutzen gemessene Mittelpunktoffsets. Keine filter-Eigenschaft am App-Root, da diese den containing block des fixierten Startmenüs ändern würde. Transparenter backdrop-filter inklusive -webkit-Präfix erhält dessen echten Hell-/Dunkelhintergrund; Französisch-Auswahl blendet das Startmenü vorher nicht mehr aus. Vocabify-Icon ist jetzt ein geometrisches V, aus frenchHome entfernt.

notificationsUI.maybePrompt zeigt allen nicht angemeldeten Push-Geräten einmal pro Öffnung den Aktivierungshinweis, sobald Synchronisierung abgeschlossen ist und kein Lern-/Modalfluss läuft. Refresh und Ankündigungsabschluss sowie Aktionsabschluss prüfen die Gelegenheit. OK nutzt notification-enable und startet Notification.requestPermission synchron vor dem ersten await. Später bleibt möglich. Bereits blockierte Systemberechtigungen brauchen Geräte-Einstellungen, kein erneuter erzwingbarer Systemdialog. Bestehende Geräteabos werden erhalten. Backend bleibt auf dem zuvor installierten Stand.

2.5.0 wurde nach Nutzerbestätigung installiert und veröffentlicht (main 98b583ed811c3e0b910cf31a4e77101dd2a9b59d); /health bestätigte alle fünf Featureflags.

## Vorbereitet: 2.5.0 – Französisch, Erinnerungen und Tagesfeier

GitHub-Frontend erst nach bestätigter Pi-Installation veröffentlichen! Health benötigt zusätzlich frenchEnabled:true und pushReady:true. Update ausschließlich über ZIP/Installieren.bat; Nutzer möchte keine manuellen SSH-Befehlsblöcke. Bestehende URL, Login-Codes und Elektro Gilbers bleiben erhalten.

French-Integration: app/subjects.js und french.js, eigene IndexedDB latinio-french-{profil}, eigenes Journal Franzoesisch_Änderungen / Franzoesisch_Lernen_{profil}. Vocabify 1.3.1 aus hochgeladener index.html dient als Vorlage; Firebase, dessen Konten und Beispiel-Lerndaten werden nicht verbunden. Aussprache fr-FR, beidseitige Lernaufgaben verwenden intern vorhandene en-de/de-en-Richtungskennungen in getrennten Speichern. Normale Sammlungen und Auffrisch-Sammlungen, automatische Admin-Freigaben und Prüfer gelten auch für Französisch. Die bestehende AutoSharing-Engine braucht keine neue Sonderlogik. Admin bekommt nach dem ersten frischen Französisch-Abgleich einmalig die acht Ma-famille-Startwörter aus der Vorlage, ohne Bewertungen. Bestehende Nutzer erhalten Französisch einmalig zusätzlich zu bisherigen Berechtigungen; später kann Admin es separat einschränken. FRENCH_ENABLED verhindert wiederholte Änderungen. Codes und alte Fachjournale bleiben erhalten.

Streak: Bei celebrate:false wird überhaupt kein streakDemo/mountStreakFinish aufgerufen. Kurzer Abschluss mit round-home. Bei Online-Abschluss reserviert notificationStreakClaim die Feier zusätzlich pro Profil/Tag in SQLite. Offline zählen lokale Ledgertage; zwei komplett offline getrennte Geräte können weiterhin jeweils feiern. refreshStreak vereinigt alle freigegebenen Fächer. Keine visuellen Browserchecks gemäß Nutzerpräferenz.

Push: server/notifications.mjs, web-push 3.6.7 mit festem Lockfile. Schlüssel werden auf dem Pi einmalig generiert und in notification_meta gespeichert. Weitere eigene Tabellen: notification_devices, notification_daily, notification_history, streak_celebrations. Keine neue Datenbank und keine neuen Container/Ports/Volumes. server/http.mjs authentifiziert jede notification-Aktion über bestehendes whoami, Adminaktionen zusätzlich rollenbasiert. Abos auf offizielle Apple/FCM/Mozilla/Windows-Pushendpunkte begrenzt; keine beliebigen ausgehenden URLs. Alte Abos laufen nach 90 Tagen ohne App-Öffnung aus, 404/410 entfernt sie. Der Zeitplan ist dauerhaft pro Profil/Tag reserviert, max. eine Nachricht an alle registrierten Geräte, keine automatische Wiederholung nach unklarem Versandstatus. Unterdrückt nach StreakTag in einem der drei Fächer oder Serverclaim. Maßgeblich ist der Pi-Stand; noch offline liegendes Lernen kann der Pi nicht kennen. TTL 30 Minuten. History bleibt gespeichert und kann in 200er-Seiten nachgeladen werden; sie sagt ausdrücklich Push-Dienst angenommen, nicht Handy zugestellt. 12 editierbare Starttexte, globales Zeitfenster 08–21 Uhr begrenzt, Standard 17–20:30 Uhr. Keine tatsächlichen Nachrichten bei Entwicklungstests versendet.

Frontend: Gerätefreigabe nur per Klick in Einstellungen, vorhandene iOS-Home-Screen-App genügt. Admin unter Nutzer → Erinnerungen. Service Worker zeigt Push an und öffnet ausschließlich die eigene App mit geprüftem Fach; bereits offene Fenster werden nur fokussiert, damit laufende Runden erhalten bleiben; from=reminder wird einmalig konsumiert und überspringt Fächerwahl. Beim Abmelden versucht die App das Gerät abzumelden. Vorschau im Browser nicht verlangt/ausgeführt. Native Windows-/ARM-/iPhone-Push-Prüfung steht bis Nutzerinstallation aus; lokale Tests prüfen Scheduler, HTTP, DB, Verschlüsselungsanfrage und Installer mit simuliertem Docker.

Paketdateien jetzt zusätzlich server/notifications.mjs, server/package.json, server/package-lock.json. Docker installiert nur die privaten Backend-Abhängigkeiten mit npm ci --omit=dev --ignore-scripts. Alle Quelldateien mit 0644, DB-Backup 0600. Vorherige Code-/Image-Rücksetzung bleibt erhalten, keine Datenbank-Rücksetzung.

## Vorbereitet: 2.4.0 – Lernfeedback und automatische Freigaben

Letzte Antwort behält Feedback bis zum expliziten Weiter, auch bei Perfektformen. Fehlerwiederholungen neu gemischt. Ganze in Klammern gesetzte Bedeutungsgruppen sind optional, auch bei allen Bedeutungen; Teilklammern bleiben bisherige alternative Schreibweisen. Direkter Dropdown-Fachwechsel konsumiert ein einmaliges sessionStorage-Flag und überspringt die Startauswahl. Logos mit US-/Vatikan-Flaggen, dezente helle/dunkle Farbverläufe. Zurück-, Umbenennen- und Löschen-Knöpfe der Sammlungsdetails ohne Rahmen.

AutoSharing.gs läuft im Pi-VM-Adapter; start.mjs aktiviert AUTOMATIC_SHARING_ENABLED. Admin-Push verteilt neue/geänderte Lektionen (ohne refreshSource) und lateinische predicateDeck/predicateItem-Inhalte innerhalb derselben SQLite-Transaktion an alle aktiven Profile mit Fachberechtigung. Persönliche Reviews, Sessions, Streaks, Aktivität und Aktiv-Schalter bleiben erhalten. Neue Nutzer erhalten die aktuellen Inhalte. Private Metadaten in _LatinioAutoShares bewahren Ziel-IDs; vorhandene manuelle/alte Prädikatfreigaben werden übernommen. Auffrisch-Sammlungen bleiben manuell.

Freigabe-Prüfer unter Nutzer/Freigaben: frische Pi-Daten beider Fächer, Unterschiede nach Nutzer, selektive Auswahl, maximal 200 Änderungen pro Schritt, fehlende Eltern-Sammlung als Abhängigkeit. Stabile Vergleichs-Hashes verhindern das Anwenden veralteter Prüfergebnisse. Ungeprüfte eigene/offline Änderungen werden nicht behauptet sichtbar zu sein; maßgeblich ist der Pi-Stand. Unbetroffene eigene Nutzerbearbeitungen bleiben bei zukünftigen einzelnen Admin-Wortänderungen erhalten. Eine bewusste Inhaltsänderung oder Sammlungsumbenennung kann zugehörige Inhalte kanonisch angleichen; der Prüfer erlaubt Ausnahmen.

SQLite-Migration braucht keinen Reimport. Vor privatem Backendupdate Online-Sicherung erstellen; Docker-Aufrufe innerhalb Bash-Heredocs unbedingt mit </dev/null, da exec -T sonst restliche Befehle konsumieren kann. Nur vokabeltrainer aktualisieren; Code.gs, Accounts.gs, AutoSharing.gs, database.mjs, start.mjs, http.mjs und Dockerfile austauschen. Health muss autoSharingEnabled:true bestätigen, dann Frontend veröffentlichen. Geschäftliche App unverändert lassen.

Automatische Tests plus isolierter Test am historischen Export: 5 Profile, 122 Differenzen vollständig angeglichen, danach 0 Differenzen; persönliche Lern-/Aktivitätsdaten unverändert. Dies war ausschließlich eine temporäre lokale Kopie, keine Änderung produktiver Daten. Keine visuellen Browserchecks auf Nutzerwunsch.

## Stand 2.3.0 – Schüler-Zugangscodes und Startauswahl

Pi-Start erzwingt persönliche vierstellige Schüler-Codes statt E-Mail-Anmeldung. Admin-PIN und Admin-Sitzungen unverändert. Admin erzeugt/ersetzt pro Nutzer einen eindeutigen Code, einmalige Anzeige; gesalzene Hashes, fünf Fehlversuche sperren Schüler-Anmeldung fünf Minuten. Neuer Code widerruft alte Sitzungen. Bestehende Schüler-Sitzungen aus der E-Mail-Zeit müssen sich neu anmelden; lokale Daten und Journale bleiben erhalten. Code allein identifiziert den Nutzer. Codes sind wiederverwendbare Zugangsdaten, keine Einmal-Links.

Startauswahl bei jedem Laden: neutrale Schwarz-/Weiß-Fläche nach Gerätemodus, grüne/rote Original-Logos für Latein/Englisch, weicher Austritt und Eintritt, reduzierte Bewegung berücksichtigt. Fächerberechtigungen weiter serverseitig geprüft.

Vor Veröffentlichung Backend-Dateien Code.gs, Accounts.gs, database.mjs, start.mjs und http.mjs im separaten Vokabel-Projekt aktualisieren, SQLite sichern, nur vokabeltrainer bauen/neustarten. Health muss ready:true und studentCodesRequired:true melden. Danach Frontend veröffentlichen; Admin verteilt Codes. Keine Änderung im Elektro-Projekt, kein Reimport, kein Tailscale-Update und kein Google-Deployment nötig. Sicherheitsbedingt können Altversionen nicht mehr mit E-Mail oder alten Sitzungen auf den Pi zugreifen. Legacy-E-Mail-Pfad bleibt ausschließlich für Offline-Domainfixtures ohne STUDENT_CODES_REQUIRED; der produktive Pi-Start aktiviert die Pflicht immer.

## Stand 2.2.2

Cloud-Symbol und zugehörigen Klickpfad aus der oberen Leiste auf Nutzerwunsch entfernt. Automatischer Pi-Abgleich und Admin-Statusbereich in den Einstellungen bleiben aktiv. Kein Backendupdate.

## Stand 2.2.1

Safari meldete nach der Pi-Umstellung „Can only call Window.fetch on instances of Window“. RestBridge ruft natives fetch jetzt ausdrücklich über globalThis auf; der injizierbare Testtransport bleibt erhalten. Regressionstest prüft den erforderlichen Empfänger. Keine Änderung am Pi oder an gespeicherten Daten.

## Stand 2.2.0 – Pi-Speicher aktiviert

Frontend und PWA-Ursprung bleiben bei GitHub Pages. REST-Endpunkt: https://elektrogilbersserver.tail7c7157.ts.net:8443/api. Eigener Compose-Stack vokabeltrainer, localhost:8081, SQLite-Volume; Elektro-Projekt unverändert.

Finalen Export vom 11. Oktober 00:12 Uhr übernommen: 17 Tabellen, 5 Profilzeilen, 11474 Datenzeilen; alle zuvor importierten Journale unverändert enthalten. Import erstellt Sicherung und ersetzt ausschließlich die gestoppte Vokabel-Datenbank. Nutzer bestätigt beide Container healthy und Health ready. finishPiMigration um 00:18:56 erfolgreich; Frontend 2.2.0 danach veröffentlicht und Pages-Version, Endpunkt und Service Worker geprüft.

Alte zwischengespeicherte PWAs nutzen vorübergehend die Google-Weiterleitung; keine Google-Schreibzugriffe nach Umschaltung. Google noch nicht deaktivieren. Keine Rückschaltung auf den veralteten Google-Datenstand. Benutzerprüfung der Synchronisierung nach Safari-Korrektur noch ausstehend.

## Stand 2.1.5

Die Streak-Zahl ist um Karten-Innenabstand und Randbreite eingerückt und endet auf dem Handy bündig mit dem Buchsymbol. Karten und Tagesanzeige verwenden denselben responsiven Innenabstand (24 px, unter 560 px 20 px).

## Stand 2.1.4

Die Home-Tagesanzeige endet mit der Zahl am rechten Inhaltsrand, bündig zu den Trainingskarten auf dem Handy. Das zusätzliche Tag/Tage-Wort entfällt; die zugängliche Beschreibung bleibt erhalten. Mehrstellige Zahlen wachsen nach links, lange Begrüßungen dürfen umbrechen.

## Stand 2.1.3

`.streak-badge` setzt explizit `background:transparent` und `box-shadow:none`, damit die geerbte `.daily-badge`-Hintergrundfarbe keinen Kasten hinter Flamme und Zahl erzeugt.

## Stand 2.1.2

Home-Badge als zweifarbige SVG-Flamme nach der Nutzervorlage: breite abgerundete Außenform und innerer Tropfen. Graue Flächen inaktiv, orange/gelb aktiv. Nur `streakBadgeFlame()` und Badge-Farben angepasst; Animationsgrafik und Streak-Logik unverändert. Kein neues Asset und keine Google-Skript-Änderung.

## Stand 2.1.1

Auf Nutzerwunsch Ergebnisfelder vollständig aus dem Streak-Abschluss entfernt. `finishControls(live)` ist derselbe rahmenlose Weiter-Knopf für Admin-Test und echten Abschluss; Ziele sind Admin-Auswahl bzw. Home. Keine Wiederholen-/Andere-Variante-Knöpfe mehr im Demo-Abschluss. Gemeinsame Grafikgröße und Position. Home-Begrüßung als Raster mit Badge in der h1-Zeile; Flamme besteht aus einer einfarbigen Konturfläche. Latein-Smart-Knöpfe 15 % dunkler gemischt, Englischfarbe unverändert. Streak- und Fehlerlogik bleibt bestehen.

## Stand 2.1.0

Echte Streaks und Rundenabschluss statt alter Ergebnisseite. `app/streak.js`: unveränderliche settings-Records `streak_day_YYYY-MM-DD`, lokale Kalendergrenzen, Vereinigung statt Zähler, profilbezogener Cache über die Fächer und Web Lock gegen doppelte lokale Claims. Alte Sessiondaten werden nicht rückwirkend zu Streak-Tagen. Pause/Abbruch und Admin Tests verdienen keine Tage. Ein Claim erfolgt erst beim bewussten Ende bzw. fehlerfreiem Abschluss. Bei Save-Fehlern bleibt ein erneuter Versuch möglich.

`round-completion.js` hält den Ausgangs-Lernstand fest; `completionRoot` wird durch `createErrorRetry` getragen. Richtig/falsch stammen aus den ursprünglichen Reviews, neu sicher aus dem aktuellen Stand minus Anfangsstand. Englisch wertet Lernrichtungen separat aus. Perfektformen nutzen ihren vorhandenen predicateProgress-Status und einen eigenen Rundenausgangspunkt. Der letzte Submit öffnet sofort den Fehlerdialog oder Abschluss; es gibt keinen zusätzlichen Weiter-Schritt dazwischen. Automatisches Verwechslungs-Matching wird beim Abschluss nicht mehr vorgeschaltet; der separate Übungsbereich bleibt verfügbar.

`screen=round-end` schützt die letzte Abfrage vor Hintergrund-Re-Renders. Fehlerdialog ohne Schließen-X, Wiederholen ohne Tagesclaim; Beenden: speichern, gestaffelt ausblenden (`round-transition.js`), gemeinsame Grafik (`streak-demo.js` mit live-Option), Statistik/Weiter. Danach Home. Weitere Tagesrunden haben statische Grafik statt erneuter Feier. Die drei Varianten rotieren mit der Tageszahl. Echte Tage sind nicht auf die Admin-Demo-Auswahl beschränkt.

`Sync.request` kann explizit check/pull im anderen freigegebenen Fach lesen (keine fachfremden Writes). Der fremde Lernstand wird nur bei Versionsänderung geladen, daraus werden ausschließlich Streak-Tage im Profilcache vereinigt. Abgleich im vorhandenen Start-Gate sowie im Hintergrund, höchstens ein Versionscheck pro Minute. Tagesereignisse werden beim nächsten Abschluss ins aktuelle Fachjournal gespiegelt. Offline lernen bleibt möglich. Zwei gleichzeitig offline arbeitende Geräte können jeweils feiern; ihre Tagesereignisse zählen nach Sync nur einmal. Kein Backendupdate.

Neue Tests decken Tageswechsel, DST, Lücken, Profil-/Fachtrennung, Wiederholungen, Erstversuche, echte neu-sicher-Zahlen, Speicherausfall, Google-Kompatibilität und den Abschlussfluss ab. Kein visueller Browsercheck gemäß Nutzerwunsch.

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
