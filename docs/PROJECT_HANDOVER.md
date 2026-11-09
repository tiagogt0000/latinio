# Latinio – Projektübergabe
## 2.16.0 · Französisch in Blau, gleicher Lösungskasten und vereinfachte Profile
Nutzerauftrag: Französisch als dunkelblaue Latinio-Version wie Englisch, ausschließlich Vokabeln in beiden Richtungen; Lösungskasten mit identischer Typografie und Fläche wie die Frage; pro Nutzer ein standardmäßig ausgeschalteter vereinfachter Modus mit Home/Sammlungen und ohne Einstellungen oder Suche. Anschließend zwei PDFs zum Import nach eindeutig zugeordneten Lernwochen erhalten, ohne doppelte Wiederholungs-Sammlungen.

Französisch verwendet den bestehenden englishTasks-/answerWord-Ablauf und die bestehenden richtungsgetrennten en-de/de-en-Lernkennungen im eigenen French-Journal. Keine neuen Übungsmodi, kein Laden des archivierten french.js oder dessen Demo-/Vocabify-Oberfläche. Subject-Auswahl, Direktlinks, gespeichertes Fach, Rechte-/Freigabeauswahl, Aktivitätsanzeige, Matching, Erinnerungen, Sprachattribute, Blau-Palette und neues natives icon-french.svg sind angebunden. Das Startmenü bietet drei Karten; der bestehende Wortmarkenwechsel verwendet die Fachreihenfolge für beide Richtungen. Französisch hat auch für Admins keine Grammatik-/Tabellenkarten. Die spezifische translation-card-Abweichung wurde entfernt; beide Karten nutzen vollständig dieselbe latin-word-Regel einschließlich schmaler Ansichten und Kontrastmodus.

simplifiedMode ist ein strikt boolesches Profilfeld, fehlend bedeutet false. Nur bestehende Admin-Aktionen profileCreate/profileUpdate setzen es; alte Clients ohne Feld erhalten den bisherigen Wert. Login, whoami und regulärer check geben es zurück. Sync übernimmt Änderungen im vorhandenen Versionsabruf, ohne Extraabfrage oder erneuten Journaldownload. Die Oberfläche aktualisiert die Navigation sicher nach Dialog-/Aktionsabschluss; aktive Übungen und Ergebnisse werden nicht ersetzt. Sichtbare Navigation ist auf Lernen/Sammlungen begrenzt, Suchfelder und Suchschalter fehlen, alte Suchfilter werden geleert und veraltete Einstellungen-/Suchaktionen ignoriert. Admins bleiben vollständig bedienbar. Dies ist eine vereinfachte Ansicht, kein zusätzlicher Berechtigungsmechanismus.

Vokabelquelle: data/french-2026 enthält elf bestehende Latinio-JSON-Importdateien mit 231 Einträgen, geprüft durch zwei unabhängige Extraktionen derselben PDF-Tabellen. Alle 236 Ausgangszeilen stimmen überein; fünf exakte Wiederholungen aus Lernwoche 3 verbleiben ausschließlich in Lernwoche 1. Die ursprünglichen Seiten-/Wochenbereiche wurden mit dem Lernplan abgeglichen. Die reinen Wiederholungsanhänge aus Unités 1–3 und Konjugationsnotizen erzeugen keine neuen Sammlungen oder Aufgaben. Kompakte männliche/weibliche bzw. gebeugte Wörter bleiben je ein Eintrag mit expliziten answerVariants; deutsche Kürzel werden ohne Bedeutungswechsel zu lesbaren Antwortvarianten aufgelöst. Frage und Suche behalten den französischen Originaleintrag. answerWord akzeptiert im Rückweg die Varianten; Import, Validierung und Freigaben erhalten sie. Wenn der Fremdspracheneintrag bearbeitet wird, entfallen die alten Antwortvarianten, damit keine veralteten Antworten gültig bleiben.

server/import-collections.mjs plant additive Änderungen mit stabilen IDs, globaler Wort-Deduplizierung und Konfliktabbruch bei zwischenzeitlich bearbeiteten Importeinträgen. Erneutes Ausführen erzeugt keine Änderungen. Ein normaler authentifizierter Push verwendet maximal 200 Änderungen pro Batch; keine Ersetzung von Datenbanken oder Lernständen. Vor Backendupdate und produktivem Import wurde ein Onlinebackup unter /data/latinio-before-2.16.0-20261109.sqlite angelegt und mit quick_check=ok geprüft. Der Probeimport auf einer Kopie und der produktive Import am 09.11.2026 ergaben jeweils elf neue Sammlungen und 231 neue Wörter in zwei authentifizierten Batches; ein erneuter Plan enthält keine Änderungen. 19.689 bestehende Journalzeilen, alle vorhandenen Lernstände, Fachrechte und Profiloptionen blieben unverändert. Vereinfachter Modus ist bei allen bestehenden Profilen weiterhin aus. Temporärer Wartungszugang wurde anschließend entfernt. Backendimage und installierte Quelldateien sind vor dem Update separat gesichert; API und externe Health-Route antworten nach dem Neustart mit ready=true. Keine produktiven Schülerdaten als Testfixture verändern, keine visuellen Browserchecks gemäß bestehender Präferenz.

Validierung: 607 Node-Tests und sechs Python-Installer-Tests bestanden; 67 JavaScript-Laufzeitdateien und die Google-Skripte syntaktisch geprüft; fünf geänderte Stylesheets ohne Parserwarnungen; alle 71 Service-Worker-Assets vorhanden, Importgraph vollständig gecacht; französisches SVG valide. Kein visueller Browser-/Gerätetest gemäß Nutzerpräferenz.

## 2.15.2 · Trainingsauswahl, stille Synchronisation und gemerkte Erinnerungswahl
Nutzerauftrag: Abstand zwischen Auswahl/Pfeil und Lektion, stimmigere Knopf-/Schriftgrößen, keine laufende Cloud-Meldung unter der Begrüßung, Fehlerdialog mit Offline-Hinweis/Retry/Ausblenden, ausgeschriebene grüne/rote Latinio-Logos beim Fachwechsel und dauerhaft gemerktes „Später“. Nur Frontend; Server und Lerndaten bleiben unverändert.

Die auf Home begrenzten Regeln in apple-learning.css neutralisieren das globale Textfeld-Padding auf Checkboxen, geben Auswahl und Text 0,75rem Abstand und halten 3rem große Zeilen/Schaltflächen mit 1rem Schrift. Die zusätzliche Zählzeile auf schmalen Geräten entfällt; lange Namen dürfen weiter umbrechen. Ein eigener Details-Pfeil erhält denselben Abstand und behält die native Tastaturbedienung.

cloud-notice.js meldet tatsächliche Fehler/offline einmal pro Störung, wartet bestehende Dialoge, aktive Übungen, Fachwechsel und den initialen Download ab und lässt erneute Hintergrundversuche still. Erneut laden kann einen neuen Fehler melden; erfolgreiche Synchronisation schließt nur den eigenen Hinweis und setzt die Unterdrückung zurück. Ohne lokale Sammlungen wird kein Offline-Lernen versprochen. main.js verbindet Status, Initial-/Hintergrundfehler, Retry und verzögertes Anzeigen; die bisherige Home-Statuszeile entfällt. Leere, bewusst geöffnete Lernoptionen behalten ihren Hinweis zum ersten Download und werden bei dessen Abschluss aktualisiert.

Subject-Transition nutzt brandWord statt App-Icons: beim Wechsel zu Englisch fährt Grün nach links hinaus, Rot von rechts in die Mitte; zurück spiegelbildlich. Nur transform/opacity, 220ms und bestehendes Easing, statischer Blur, bestehende Zeitlimits/Entsorgung; Tastatur, reduzierte Bewegung und Reload-Fortsetzung bleiben ohne Fahrt. „Später“, Ausschalten und explizites Aktivieren speichern die Geräteentscheidung unter latinio-notification-prompt-dismissed. Die Einstellung bleibt fach-/profilübergreifend erhalten, manuelle Freigabe in Einstellungen funktioniert weiterhin; verweigerter Browser-Speicher wird abgefangen.

Prüfung: 594 Node-Tests inklusive echter main.js-Status-/Aktionspfade, verzögertem Fehlerdialog und Retry, anhaltender Erinnerungsauswahl, Wordmark-Richtung, Tastatur/reduced motion und Timer-Fallbacks; 6 Installerprüfungen. Syntax, CSS, Versionsgleichstand und Offline-Assets geprüft. Keine visuellen Browserchecks gemäß bestehender Präferenz, kein reales iPhone geprüft.


## 2.15.1 · Cloud-Bugfix ohne Designänderung
Nutzerauftrag: ausschließlich die weiterhin langsame/leere Cloud beheben, unnötige Abrufe entfernen, früheren funktionierenden Stand vergleichen und aktuellen Lernstand direkt speichern. Bestätigte Regression: refreshStreak verlor in d0124c4 die Versionsprüfung und lud jedes andere Fach alle 60 Sekunden komplett. Jetzt nutzt es den kleinen authentifizierten streak-Abruf; Legacy-Verbindungen prüfen zuerst die Version und laden nur bei Änderung. Versionscache ist nach Fach, Profil und Verbindung getrennt. Berechtigungsprüfungen bleiben bestehen. Keine Änderungen an CSS, Logos oder Gestaltung.
Bestätigter Anzeigefehler: Download bei offenem Dialog wurde in startup/backgroundSync übernommen, aber render übersprungen; closeModal zeichnete nicht nach. pendingCloudRender holt dies nach Dialog-/Aktionsabschluss nach, ohne eine aktive Lernrunde, Ergebnisse, Arbeitsblätter, Adminansicht oder einen neu geöffneten Dialog zu ersetzen. Ein isolierter nichtvisueller DOM-/IndexedDB-Repro scheitert mit dem unveränderten 2.15.0-Code (neue Lektion bleibt unsichtbar) und besteht mit diesem Fix; BroadcastChannel und Wiederöffnen funktionieren. Der konkrete Netzwerkfehler auf dem Nutzergerät ist nicht direkt reproduziert.
Pi: additive SQLite-Tabelle journal_snapshots hält den aktuellen Stand pro Journal, Version und JSON. Bestehende Journale werden einmalig abgeleitet; warme Appends pflegen den Snapshot in derselben Transaktion wie Admin-/Empfängerschreibvorgänge. SQLite-Trigger invalidieren ihn bei historischen Änderungen/Löschungen. Import entfernt abgeleitete Altstände, Backups/Neustart und fehlgeschlagener Fanout sind abgedeckt. notificationSnapshot arbeitet konsistent in einer Transaktion. Bereichslesen verwendet ein SQL-Statement statt eines pro Zeile. Native Sheet-Hooks readState/readLog/operationIds vermeiden Replay für aktuelle Daten; Google behält seine kompatible Ableitung. Pull/Streak-Version stammt aus demselben erfassten Zustand, auch bei parallelem Google-Append.
Opt-in compact:1 + pendingIds liefert version/data/changes/acknowledged/hasHistory. changes enthält die letzte Operation pro verändertem Schlüssel seit since ohne doppelten value; der Client entnimmt Werte/Löschungen dem aktuellen Stand. Separate Acknowledgments bestätigen auch inzwischen überschriebene Uploads. hasHistory verhindert das Wiederbeleben gelöschter Startvokabeln. Alle geänderten Schlüssel bleiben für während des Downloads entstehende lokale Antworten sichtbar. Rebase prüft nochmals im aktuellen Store-Commit. Legacy-pull bleibt unverändert; whoami veröffentlicht separate compactSync/streakSummary-Fähigkeiten, gebunden an die geprüfte Verbindung. Unvollständige kompakte Antworten werden abgewiesen.
HTTP komprimiert große JSON-Antworten asynchron mit gzip Level1 bei passendem Accept-Encoding; no-store/CORS bleiben erhalten, Vary und Content-Length stimmen. Reine Reviews/Sessions/Streak-/Präferenzänderungen lesen keine Freigabeverzeichnisse mehr ein; gemischte Uploads mit Unterrichtsinhalten teilen weiterhin korrekt. Verlauf, Berechtigungen und Lerndaten werden nicht gelöscht.
Prüfung:581 Node-Tests und6 Installerprüfungen bestanden;65 Laufzeitdateien syntaktisch geprüft,69 Offline-Assets/Imports und Versionsgleichstand2.15.1. Neue Fälle umfassen kompakten echten Pi-HTTP-Abgleich, verlorene Uploadantwort, lokale Änderungen während Download/Commit, Tombstones/Bootstrap, alte Server, malformed Antworten, gzip-Roundtrip, Snapshot-Warmup/Neustart/Backup, historische Korrektur und vollständigen Fanout-Rollback. Geschützte isolierte Datenkopien gegen tatsächlichen Code von662660a verglichen: Admin-Latein2.728.516→313.490übertrageneBytes, Englisch1.636.758→169.001Bytes (89/90% weniger); beide Datenstände deepEqual. Auch13 Schüler-Fachstarts exakt gleiche Daten, alle erfolgreich. Lokaler Gesamtabgleich509→410ms bzw219→209ms, keine Messung auf einem iPhone. Temporäre Arbeitskopien gelöscht. Keine visuellen Browserchecks gemäß persistierender Präferenz.



Privates Backend vor Frontend aktualisiert:5 geänderte Module unter /home/tiago/vokabeltrainer, installierter Ausgangsstand zuvor bytegleich662660a. Onlinebackup /data/latinio-before-2.15.1-20261108.sqlite (0600, quick_check ok), Quellenkopie /home/tiago/.local/share/latinio-backend-backups/2.15.1-20261108 und Image vokabeltrainer-api:before-2.15.1-20261108 gesichert. Nur Compose-Serviceapi neu gebaut/gestartet; alle5 Modulhashes stimmen. Produktivdatenbank quick_check ok,25.938Journal-/Metadatenzeilen unverändert, Snapshot-Tabelle angelegt. Im tatsächlich gebauten Container vollständiger HTTP-Roundtrip mit separater geschützter Backupkopie und synthetischem Token: Legacy/compact exakt gleich, gzip313.490/169.001Bytes; Streak nur166/127Bytes. Testkopie wieder entfernt, Live-Health200/ready. Keine manuellen Nachrichten, keine Änderungen an anderen Projekten.

## 2.15.0 · Zwei Fächer, reagierender Start und Fehlerbehebung

Nutzerauftrag: Französisch entfernen, mobile Navigation ohne sichtbare Texte, Hintergrund durch Header und iPhone-Oberkante, komplette Fehler-/Latenzprüfung mit Schwerpunkt „Mehr Optionen“ und Fachwechsel. SUBJECTS bietet nur Latin/English; alte French-Präferenzen und direkte Marker normalisieren auf Latin. French-Aktionen, Import und Startkarte entfernt, Freigaben und Rechteauswahl auf beide Fächer beschränkt. French-Modul/Icon nicht mehr im Offline-Shell. Alte Lernjournale, Server-Parser und Backwards-Compatibility-Tests bleiben erhalten; keine Datenmigration/Löschung. Alte French-Erinnerungstexte sind ausgeblendet, werden beim Speichern anderer Texte unverändert mitgeführt. Scheduler ignoriert sie und French-only-Profile, auch für „all“ wird nur ein aktives freigegebenes Fach gewählt. Historische French-Streaktage bleiben kompatibel.

Bekannte Konten öffnen ihre lokalen Daten ohne whoami-Wartezeit. Ausgenommen der seltene Online-Fall ohne aktuell freigegebenes Fach: dort gezielt neue Rechte abholen, damit eine inzwischen erteilte Freigabe erreichbar ist. Sync verifiziert Profil-ID und Fähigkeiten vor jedem ersten Zugriff einer Verbindung, einschließlich direkter Reminderaktionen. Parallele whoami-Aufrufe pro Bridge/Fach werden geteilt; explizite spätere Prüfungen bleiben frisch. Credentialwechsel können keine alten Aufträge auf einer neuen Verbindung ausführen. Authentication-required umfasst abgelaufene Tokens und gesperrte Profile auch für Admins. RestBridge unterscheidet Netzfehler, Timeout, Abbruch und ungültige Antworten; Schreibaktionen werden nicht pauschal wiederholt.

CloudGate blockiert nur bei noch fehlenden lokalen Sammlungen. Die Optionen selbst warten nicht auf den Abgleich, sondern zeigen den Zustand mit Retry/Sammlungen-Link. Nach Download werden nur die zuvor leeren Optionsgruppen im bestehenden Dialog aktualisiert, ohne den Dialog neu zu öffnen. Normal gefüllte Dialoge und aktive Lernrunden bleiben bei Hintergrundantworten erhalten. Home zeigt Lade-/Fehlerhinweise. Fachwechsel entfernt das alte settleSync vor location.assign: lokale Änderungen sind bereits journalisiert, der Zielstart umgeht die Startauswahl. beginSubjectTransition liefert sofort Overlay plus entered; animiert grün/rot in220ms, Rückweg umgekehrt, statischer12px-Blur. Eingaben unter dem Übergang werden vor allen Navigations-Sonderpfaden gesperrt. Keyboard/reduced motion ohne Bewegungswartezeit; Reload zeigt statischen Zielstatus bis lokalen Start bzw. entfernt den Schleier vor Login. Animationen haben fail-open/Timeout-Cleanup, auch Interface- und Rundenausgänge. Gewünschte Flammen-/Rundenstaffelung bleibt unverändert.

Jeder synchrone render()-Durchlauf verwendet einen gemeinsamen Store-Snapshot und gibt ihn in finally frei; keine globale Änderung der Store.data-Kopiersemantik. Leere Freigabe-Inbox kopiert keine komplette Historie. predicateProgressIndex scannt Reviews einmal, bewahrt Legacy-Grundform/ID-Zuordnung, stabile Gleichstände und alte defekte Zeitstempel. Queue- und Optionsregeln unverändert. Synthetischer arm64 Node24.22-Vergleich gegen tatsächliches HEAD:500 Formen/2.000 Reviews, deterministische Smart10-Auswahl, Median5Messungen5830,83ms→3,21ms bei deepEqual-Ergebnis. Kein Browser-/Gesamtapp-Benchmark. Anderes-Fach-Streakpull läuft nach lokalem Start im Hintergrund; danach aktualisiert sich nur das Home-Badge.

Header/workspace transparent ohne Linie, statische Hintergrundtönung auf gemeinsamer Seite; Oberkante läuft weich in --bg aus. theme-color/Manifest/HTML stimmen hell#f5f5f7 und dunkel#111114 überein. Keine deprecated black-translucent-Meta: aktuelle WebKit-Empfehlung https://bugs.webkit.org/show_bug.cgi?id=317153#c2. Systemstatusleiste kann keine beliebigen Webinhalte zeichnen; tatsächliches iPhone-Verhalten nicht geprüft. Symbolnavigation behält aria-label/title und visuell verborgene Beschriftung, Desktoptexte bleiben sichtbar. Zweifächer-Start mit Grün/Rot-Karten und Safe-Area-Abständen.

Prüfung:550 Node-Tests plus6 Installerprüfungen bestanden; Syntax aller55 App-/SW-JS-Dateien, geändertes CSS,69 Offline-Assets/Imports, Versionsgleichstand2.15.0 geprüft. Abgedeckt: echter actions()-Fachwechsel mit stockenderCloud/Animation, Cache-Start/fehlendeRechte, echteSync-/GoogleHarness-Races während Lernfortschritt, verloreneUploadantwort mit dedupliziertemReplay, leereDialoge werden nachDownload bedienbar, Restfehler und umfangreiche Prädikatdaten. Öffentlicher Funnel/Health/CORS getrennt vom Tailscale-internen Pfad bestätigt. Konkretes „Load failed“ des Nutzergeräts nicht reproduziert; keine Behauptung eines allgemeinen Backendausfalls. Keine visuellen Browserchecks gemäß persistierender Präferenz und keine reale Geräteprüfung.

Privates Backend nur notifications.mjs unter /home/tiago/vokabeltrainer aktualisiert; installierter Quellstand entsprach vorher HEAD. Geprüftes Onlinebackup /data/latinio-before-2.15.0-20261108.sqlite (0600, quick_check ok), Rückkehrimage vokabeltrainer-api:before-2.15.0-20261108 und alte Quelldatei notifications-before-2.15.0-20261108.mjs gesichert. Nur Compose-Projekt vokabeltrainer, Serviceapi neu gebaut/gestartet. Modulhash b74148ff3f2f7c53c8ee7b1d4aa211511870ea28485e1c1c93d277bee378c538 bestätigt; Health ready/studentCodes/autoSharing/push/grammar true. frenchEnabled bleibt als Kompatibilitätsfähigkeit für archivierte Daten vorhanden, Oberfläche und Versand bieten French nicht an. Keine manuelle Nachricht gesendet, keine produktiven Lerndaten geändert, andere Projekte unverändert.

## 2.14.0 · Glas-Logos, Liquid Glass und gezielte Interaktionsanimationen

Nutzerauftrag: App-Logos an neues Design anpassen, bessere/mehr Animationen und mehr Apple Liquid Glass. Native SVG-Logofamilie erneuert, erkennbare Motive erhalten: Latinio L/Stern in Grün und Rot, Vocabify Buch/Haken in Ocker. Zentrale Zeichen liegen innerhalb des Maskable-Sicherheitskreises; alle drei Hintergründe sind vollflächig. Latinio-PNGs 180/192/512 aus dem SVG mit vorhandenen Systembibliotheken librsvg/Cairo erzeugt, keine neue Produktabhängigkeit. subjects.js, Favicon, Apple-Touch-Icon und Manifest-Icon-URLs haben v=2.14.0; Service Worker ignoriert Suchparameter wie bisher. Unbenutzte Altdateien icon-192.png/icon-512.png nicht verändert.

`liquid-glass.css` liegt nach apple-learning.css und vor apple-motion.css. Sichtbare Materialträger: innere mobile Navigationspille, Sidebar-Navigation, Fachwahlknopf/-menü, gewöhnliche Dialoge, Toast sowie Fachauswahlkarten. Positionierende Wrapper und Header tragen keinen Blur, Header bleibt im Dokumentfluss. Glas hat statische Lichtkanten und Verläufe, 18px Blur mit Safari-Präfix und deckende Fallbacks; höhere Transparenzreduktion/Kontrastwünsche schalten den Effekt aus. Lernfelder, Tabellen und Antworten bleiben deckend. Home-Karten und Primärknöpfe erhalten nur statische Lichtkanten. Menü-Altregeln mit !important gezielt aufgelöst, Streak-Flächen ausgespart. Bisheriger Fullscreenblur beim Markenwechsel ist auf die begrenzte Partnerschaftskapsel verlegt; Dauer und Bewegungsablauf dieses bewussten Markenwechsels unverändert. Untere Navigation hat Safe-Area-Abstand, lange Beschriftungen dürfen umbrechen, Toastabstand ist angepasst.

`interface-motion.js` steuert vorhandene DOM-Flächen per WAAPI ohne Bibliothek. Klick-Kontext entscheidet über Pointer vs. Tastatur; Keyboardereignisse und ein Wechsel zu reduced motion beenden laufende Animationen. Nur echte Seitenwechsel: 220ms Richtungsbewegung, auf Home überlappende Karten mit 0/35/60/75ms Startversatz (Ende spätestens 295ms). Details nur nach bewusstem Öffnen per Pointer; gespeicherte offene Bereiche und erneutes Rendern bleiben statisch. Menüs transformieren von rechts oben, Listen 160ms; Dialoge bewegen eine Oberfläche ohne zusätzliche Elterneinblendung. Ersetzen/Schließen räumt auf, keine Exit-Sperre. Häufige Lernantworten unverändert statisch. Fachauswahl-Exit jetzt 220ms transform/opacity statt animiertem Blur; Tastatur überspringt ihn. Start-/Antwortlogik und Streak unberührt.

Prüfung: 482 Node-Tests bestanden, darunter Pointer/Keyboard, Richtungswechsel, Wiederherstellung, Hintergrund-Render, Streak-Ausnahme, Abbruch und Reduced-Motion-Wechsel. Syntax aller 55 JavaScript-Dateien und geänderter CSS-Dateien geprüft, 71 Offline-Assets samt Imports/Iconpfaden und Versionsgleichstand validiert. Logo-XML, PNG-Abmessungen/Deckkraft, Maskable-Sicherheitszone und statische Familienvorschau geprüft. Berechnete Kontraste der mobilen Glasbeschriftung über 5,4:1 und der glänzenden Primärknöpfe über 4,6:1 auch an ungünstigen Stellen. Diese Prüfungen sind keine Browser-/GPU-/Touchprüfung. Gemäß Präferenz keine visuellen Browserchecks, kein reales Gerät geprüft. Kein Backendupdate oder produktiver Datenzugriff.



## 2.13.0 · Apple-Design und reagierende Lernoptionen

Nutzerauftrag: Apple-Design jetzt ohne weitere Rückfrage umsetzen und nicht reagierendes „Mehr Optionen“ beheben. Ergänzend installiert: apple-design, emil-design-eng, animate, review-animations, animation-performance, remove-animations, find-animation-opportunities, gestures und pick-ui-library aus emilkowalski/skills unter /home/tiago/.codex/skills. Die relevanten Design-, Mobile-, Gesten- und Motion-Regeln wurden angewendet; keine neue UI-Bibliothek oder Laufzeitabhängigkeit nötig.

Drei abschließende Stylesheets: `apple-design.css` für gemeinsame Typografie, Fachfarben, Navigation, Steuerelemente, Sammlungen, Einstellungen und Dialoge; `apple-learning.css` für Lernkarten, Antworten, Tabellen, Präfixe und Grammatik; `apple-motion.css` für Druckrückmeldung, gelegentliche Dialogeinblendung und das Entfernen doppelter Startanimationen. Die Reihenfolge steht in index.html und alle Dateien sind offline verfügbar. Opaque Lernflächen, Material nur auf der Navigation, Systemschrift und rem-Abstände. Rot/Grün/Ocker bleiben Fachfarben; Erfolg ist fachübergreifend semantisch grün. Reduced transparency und mehr Kontrast haben eigene Regeln. Der Header bleibt im Dokumentfluss: Sticky würde Tabellen-/Grammatikfelder verdecken, die der Sichtbarkeitshelfer bisher am Viewportrand misst. Die mobile Navigation und der Viewport-Meta behalten ihre bisherige Positionierungsweise.

„Mehr Optionen“ war angebunden, blockierte aber vor Anzeige: für jede lateinische Vokabel wurden der gesamte Store und der Verlauf mehrfach gelesen. `training-options.js` nimmt einen Snapshot, indexiert Reviews einmal und bewahrt Richtungsfilter, Auffrisch-Mitgliedschaften, Korrekturwiederholungen und Lernstatus. Lokaler synthetischer Vergleich: 300 Wörter/1.200 Reviews, vorher 601 vollständige Datenlesevorgänge und ca. 1.457 ms; danach ein Snapshot und ca. 6 ms. Dies ist eine lokale Messung, keine Garantie für jedes Gerät. Prädikatoptionen lesen ebenfalls einen gemeinsamen Snapshot. Tests vergleichen 256 Auswahl-/Richtungskombinationen gegen die bestehenden Engines und prüfen die tatsächlichen Smart-/Options-Klickpfade in allen Fächern sowie späte Sync-Antworten.

`refresh-cards.js`: direkte 1:1-Pointerbewegung ohne Rotation, 10px Achsenentscheidung, unterbrochene Rückkehr beginnt am aktuellen sichtbaren Wert. Ein kleiner kritisch gedämpfter Rücklauf mit response 0.4 s übernimmt nur aktuelle Loslassgeschwindigkeit, endet spätestens nach 1 s und stoppt bei Entfernung/reduced motion. Bewertungsgrenze weiterhin 60 px neu gezogene Strecke; übernommene Position/Geschwindigkeit zählen nicht als Antwort. Abbruch, verlorener Capture und vertikales Scrollen bewerten nicht. Bestehender Tagesabschluss mit Flamme und bewusst gestaffeltem Rundenausgang bleibt erhalten.

Browser-theme-color folgt dem tatsächlichen hellen/dunklen Header bereits bei Auswahl/Anmeldung und beim Systemwechsel. Manifest und Startfarbe passen zur Oberfläche; Fachwechsel verwendet dieselbe Metadatenfunktion.

Prüfung: 472 Node-Tests bestanden, Syntax aller 54 JavaScript-Dateien und CSS mit esbuild geprüft. 69 Offline-Assets einschließlich aller Modulimporte validiert; Versionsdateien gemeinsam 2.13.0. Primärknopf-Kontraste hell mindestens 5.27:1, dunkel mindestens 8.25:1; zusätzliche Text-/Ergebnisfarben geprüft. Keine visuellen Browserchecks gemäß Nutzerpräferenz, keine reale Geräteprüfung; mögliche Darstellungseffekte bleiben dort zu beurteilen. Keine produktiven Lern-/Nutzerdaten und kein Backend verändert.


## 2.12.0 · Mobile Eingaben, robuste Gesten und ruhigeres Lernen

`input-visibility.js` berücksichtigt jetzt Vokabel-, Prädikat-, Tabellen-/Präfix- und Grammatikantworten; `main.js` aktiviert den Guard in den passenden vier Ansichten. Horizontale Sichtbarkeit wird im Viewport und in scrollbaren Vorfahren geprüft. Nur verdeckte Felder werden mit nearest sichtbar gemacht; readonly/disabled/entfernte Felder und Fokuswechsel geben den Tastaturinset frei. Pinch-Zoom löst weder Tastaturinset noch automatisches Nachpannen aus. CSS reserviert den zusätzlichen Raum jeweils einmal in Test-, Tabellen- oder Grammatik-Shells und setzt die Touch-Schriftuntergrenze auf 16px. Der bestehende Viewport-Meta bleibt unverändert: `interactive-widget=resizes-content` würde die feste mobile Navigation über die Android-Tastatur heben, ohne dass die Eingabehilfe diese Überdeckung berücksichtigt.

Tabellen-Ziehgesten halten genau einen Pointer, nutzen Capture und räumen bei cancel/lost capture oder entferntem Ausgangselement auf. `main.js` leitet lostpointercapture weiter. Inaktive Schnipsel blockieren das Scrollen nicht mehr. Kleine Layoutkorrekturen betreffen Umbruch, Filter-Tippflächen und den schmalen Scrollhinweis; keine neue Tabellenstruktur. Einzahl-/Mehrzahltexte stimmen für eine Form. Lernengine, Inhalt und 2→4→5-Fallgruppen unverändert.

Häufig neu gerenderte Wort-/Antwortbereiche und die Matching-Fläche bleiben ruhig. `round-transition.js` entfernt untergeordnete und doppelte Animationsziele, während die absichtlich gestaffelten 400ms-Ausgänge mit 0/140/280ms Versatz erhalten bleiben. `streak-demo.js` zeigt bei reduced motion Szene, Status und Weiter sofort ohne dekorative Timer. Normaler Tagesabschluss behält Flamme, rote Atmosphäre, Meilensteine und bestehende Zeitfolge. `refresh-cards.js` markiert direktes Ziehen mit is-dragging, ohne Transform-Tween; Rückkehr 160ms cubic-bezier(0.23,1,0.32,1). Abbruch und verlorener Capture ändern keine Bewertung und blockieren spätere Tastaturaktivierung nicht.

Verwendete Leitlinien: emilkowalski/skills mobile-native, break-ui, improve-animations und choreograph. Diese sowie prototype sind unter /home/tiago/.codex/skills installiert; Variantenvergleich und größeres Apple-Design sind für später vorgesehen.

Prüfung: 458 automatisierte Tests bestanden, einschließlich neuer Tastatur-/Fokus-, Multitouch-/Abbruch-, Wisch- und Reduced-Motion-Regressionen. Isolierter 40-Formen-Belastungstest mit 300 Zeichen, Unicode, HTML-Zeichen, leerem Feld, Wiederherstellung und gezielter Fehlerwiederholung bestanden. Keine produktiven Nutzer-/Lerndaten verändert. Kein Backendupdate und keine neuen Runtime-Abhängigkeiten. Keine visuellen Browserchecks gemäß Projektpräferenz; reale iOS-/Android-Tastatur und Touchwirkung bleiben am Gerät zu prüfen.


## 2.11.0 · Fälle in wachsenden Gruppen

Kasusübungen führen höchstens zwei ausgewählte Fälle auf einmal ein, in Buchreihenfolge Nominativ/Genitiv/Dativ/Akkusativ/Ablativ. Die Schritte sind Anschauen + Zuordnen für die ersten zwei, Anschauen + Zuordnen für die ersten vier, anschließend gegebenenfalls alle fünf. Jede nächste Gruppe enthält sämtliche zuvor eingeführten Formen. Erst nach erfolgreichem Zuordnen aller ausgewählten Fälle folgen die bestehenden Schreibstufen (Hälfte, drei Viertel, alle Lücken). Bei bis zu zwei Fällen sowie Präfixen und Dehnungsperfekt bleibt der bisherige Ablauf. Direkte Abfragen verwenden weiterhin sofort die gesamte Auswahl.

`table-learning.js` hält die vollständige Auswahl in session.itemIds und liefert über learningStep die aktive Gruppe für Darstellung und Bewertung. Zukünftige Fälle dürfen weder als Schnipsel noch als Ziele verwendet werden. Gruppendefinitionen werden beim Erstellen und Wiederherstellen aus den kanonischen Inhalten abgeleitet. Laufende alte Zuordnungs-/Schreibentwürfe werden auf die entsprechende Stufe mit vollständiger Auswahl übernommen; eine alte reine Anschauphase beginnt mit der ersten Gruppe. Ein Neustart beginnt stets bei den ersten höchstens zwei Fällen. Tabellenansicht zeigt die aktiven Fälle und welche neu hinzugekommen sind.

Frontend und Offline-Shell 2.11.0. Kein Backendupdate und keine Datenmigration im Server. 438 automatisierte Tests bestanden, zusätzlich 310 Fall-/Filterkombinationen geprüft. Syntax und 65 Offline-Dateien einschließlich vollständiger Importabdeckung validiert. Regressionen für Gruppenwachstum, Auswahlfilter, Fehlerwiederholung, Entwürfe und bestehende Lernmodi; keine visuellen Browserchecks gemäß Projektpräferenz.

## 2.10.0 · Sammlung öffnen, Substantive und Lernstand

`collection-opening.js` zeigt am Sammlungsstift sofort Ladepunkte und lässt sie vor der lokalen Darstellung zeichnen. Mehrfachklicks und veraltete Navigation werden abgefangen; andere Navigation bleibt verfügbar. `collection-words.js` gruppiert Bewertungen einmal pro Wortliste, berücksichtigt Suchfilter und Sprachrichtung und trennt globale Sicherheit vom Auffrischstatus Offen/Erledigt. `allWords` liest den Store einmal statt ihn für jede Vokabel vollständig zu klonen. Keine neue Serverabhängigkeit.

Tabellenkatalog ohne Beispiel-Badges, Fortsetzen-Links oder Tabellen/Präfix-Umschalter. Entwürfe werden weiterhin gespeichert. Neue Tabelle `nouns` mit 40 Formen aus dem sechsten Buchfoto; Dimension `declensions` mit vier Spalten (a, o-m, o-n, third). Alle fünf fotografierten Fälle; keine zusätzliche Vokativtabelle. Vollständige Formen, optionale Längenzeichen und die fotografierten Ablativpräpositionen werden akzeptiert.

`review-history.js` vereinheitlicht Reihenfolge (numerischer Aufgabencursor bei gleicher Zeit) und Erkennung richtiger Korrekturwiederholungen. Fehler/Teilantworten setzen Sicherheit zurück; richtige Fehlerwiederholungen fördern den Status nicht. Die anfängliche Inaktiv-/Selbsteinschätzung bleibt möglich, nach einem Fehler braucht es wieder reguläre richtige Antworten; explizite manuelle Einstufungen und Bewertungskorrekturen bleiben möglich. „Eine Bedeutung genügt“ akzeptiert weiterhin fehlende weitere Bedeutungen, aber keine tatsächlich falschen Zusätze. Reviews speichern repeat und retryStage auch für wiederaufgenommene Runden. Vorhandene Historie bleibt unverändert.

Frontend und Offline-Shell 2.10.0, drei neue Runtime-Module im Cache. Kein Backendupdate und keine Änderung produktiver Nutzer- oder Freigabedaten. 421 automatisierte Tests bestanden, Syntax aller App-Module geprüft und 65 Offline-Dateien einschließlich vollständiger Importabdeckung validiert; Regressionen für Ladefeedback, Navigation, Verlaufsauswertung, Tabellen und Lernstatus; keine visuellen Browserchecks gemäß Projektpräferenz.

## 2.9.0 · Eingabe, Auswahl und Adminnavigation

Leeres Enter wird im Tastaturhandler abgefangen; `hasAnswerContent` schützt zusätzlich die direkte Bewertung, explizites „Weiß ich noch nicht“ bleibt möglich. Neues `input-visibility.js` scrollt fokussierte Antwortfelder minimal sichtbar, berücksichtigt visualViewport und reserviert iOS-Tastaturraum per CSS-Variable. `view-state.js` erhält bei derselben Ansicht auch verschachtelte Scrollcontainer und Fokus, statt nur window.scrollY. Gemeinsame Modalfokusverwaltung verwendet preventScroll und erhält den ursprünglichen Auslöser bei Dialogwechseln.

Lokale Navigation umgeht laufende Serveraktionen und asynchrone Moduldispatches. Adminbereiche laden mit Statusanzeige; späte Ergebnisse dürfen verlassene Ansichten nicht wieder öffnen. Freigabe-Prüfer als eigener checks-Tab mit drei Fächern und wiederholbaren Fehlerzuständen; manuelle Freigaben senden nur tatsächliche Auswahländerungen. Keine produktiven Freigaben oder Konten zum Testen geändert. Tabellen-/Fallauswahl jetzt vertikale Listen, sekundäre Filter im Dialog und Üben/Abfragen nach Weiter. Vorhandene Lernentwürfe und Lernstände bleiben erhalten.

Frontendversion und Offline-Shell 2.9.0, kein Backendupdate. Automatisierte Eingabe-, View-State-, Modal-, Navigations-, Tabellen- und Adminregressionen; keine visuellen Browserchecks gemäß Projektpräferenz.


## 2.8.0 · Schrittweise Tabellen- und Präfixübungen

Tabellen öffnen zuerst einen Katalog mit fünf Karten. Nach Auswahl folgen abgerundete Fall-/Formenoptionen und die getrennten Modi Üben / Abfragen; Präfixe bieten dieselbe Moduswahl. Üben führt durch Anschauen, Zuordnen mit Schnipseln, wachsende Schreibanteile (ca. Hälfte, drei Viertel, alles) und einen Abschluss. Eine Stufe wird nur nach vollständig richtiger Lösung verlassen; Fehler führen über eine Lösungsansicht zur Wiederholung derselben Stufe. Gleiche Formen sind beim Zuordnen austauschbar. Maus-Drag-and-drop, Touch-/Stiftziehen und antippbare Schnipsel/Ziele verwenden dieselbe Logik.

Neue reine Engine `app/table-learning.js`; UI und Styles weiterhin in `table-practice.js/.css`. Separate profilbezogene Übungs-/Abfrageentwürfe für Tabellen und Präfixe; v1-Entwürfe werden übernommen. Alle Inhalte offline im Service-Worker-Shell, Frontendversion 2.8.0, kein Backendupdate oder Datenimport. Kein zusätzlicher Streak-Claim. Automatisierte Engine-, UI- und Integrationstests; keine visuellen Browserchecks gemäß Projektpräferenz.

## 2.7.0 · Tabellen und Präfixe

Neue statische Lernmodule `app/table-content.js` und `app/table-practice.js/.css`, erreichbar für alle Lateinprofile über zwei Home-Karten. Inhalt aus fünf bereitgestellten Fotos: vier Kasustabellen (110 Formen), Dehnungsperfekt (9 Stamm-/Perfektaufgaben), elf Präfixe. Alle Fälle und passende weitere Dimensionen frei wählbar. Arbeitsblatt mit gemeinsamer Auswertung, Lösungen und Fehlerwiederholung; Präfixe als linke Spalte plus rechte Eingabefelder.

Lokale, profilbezogene Entwürfe; keine neue Cloudstruktur, keine bestehenden Lernstände geändert und kein zusätzlicher Streak-Claim. `tables` ist vor automatischem Update und Hintergrund-Re-Rendering geschützt. Neue Module und Styles stehen im Service-Worker-Shell; Versionsdateien gemeinsam auf 2.7.0 erhöht. Kein Backendupdate erforderlich. Vor Beginn live 2.6.0 und lokales Health einschließlich `grammarReady:true` bestätigt. Veröffentlichung vom Nutzer ausdrücklich autorisiert. Keine visuellen Browserchecks gemäß bestehender Projektpräferenz.

## Vorbereitet: 2.6.0 · Admin-Grammatik mit OVHcloud

Stand 20.10.2026: Backend und Frontend implementiert, Veröffentlichung erst nach privater Pi-Installation via ZIP/Installieren.bat. Live bleibt vorerst Frontend 2.5.2 (main 834d38a8829c15b20229125b80c9931045070945), Backend zuletzt bestätigt 2.5.0. Health muss nach Installation zusätzlich grammarReady:true melden. Kein echter OVH-Schlüssel hier verfügbar; Nutzer hinterlegt ihn nach Veröffentlichung unter Englisch → Grammatik lernen → KI-Einstellungen. Keine manuellen SSH-Befehlsblöcke erforderlich.

Details in docs/GRAMMAR.md. Neue Serverdateien grammar.mjs und grammar-content.mjs im Installer-Manifest; keine Compose- oder Abhängigkeitsänderung. Eigene Tabellen im privaten SQLite-Volume, API-Key separat unter /data/grammar-ovh.key (0600, bleibt bei Containerupdates erhalten). Geschützte admin-only grammar*-API, HTTP-Schicht authentifiziert selbst statt Körperangaben zu vertrauen. REST-Timeout nur für Generierung/Bewertung/Nachprüfung auf 100 s erhöht. Kein Datenimport. Keine Änderung an Elektro, Tailscale oder Betriebssystem.

app/grammar.js/.css isolieren den Adminbereich. 3/5/10 Übersetzungsaufgaben mit finaler Antwortübersicht und gemeinsamer Auswertung. Alle Antworten bleiben bei KI-Fehlern bestehen. Lokaler Entwurf und Pi-Version erkennen Geräte-Konflikte. Serverreservierte Anfrage-IDs plus Statusabfrage erlauben Wiederaufnahme ohne zusätzliche Modellkosten nach verloren gegangener Antwort. Unsichere oder widersprüchliche Nachbewertungen beeinflussen das Lernprofil nicht. Fester Hilfsverb-Lehrplan aus der beigefügten PDF; Nebenfehler dürfen Themenziele nicht verdrängen. Keine Änderungen an bestehenden Vokabel-/Streak-Daten.

OVH offiziell geprüft: Modell Meta-Llama-3_3-70B-Instruct, Chat Completions, json_schema; Temperatur 0,4/0 als Ausgangswerte. Tests mit simuliertem Provider, echter lokaler SQLite-/HTTP-Verarbeitung und simuliertem Docker-Installer. Kein echter Modell- oder visueller Browsertest. Das Paket ist erst nach erfolgreichem Pi-Update live schaltbar.

Stand: 15. Oktober 2026. Pi-Backend 2.5.0, Frontend 2.5.2. In 2.5.2 auf ausdrücklichen Nutzerwunsch das Vocabify-Buch-/Häkchen-Icon aus 2.5.0 wiederhergestellt; alle anderen 2.5.1-Korrekturen bleiben bestehen. Kein Pi-Update.

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
