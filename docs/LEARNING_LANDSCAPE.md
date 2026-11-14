# Lernlandschaft · 2.18.0

## Englisch ab 2.19.0
Der Admin kann den Lernweg in Latein und Englisch nutzen. Das Fach wird explizit an UI, Engine, Speicher und API gereicht. Englische Ereignisse tragen `en-de` oder `de-en`; jede Richtung hat eigene Evidenz, Schwierigkeit, Stabilität und Fälligkeit. Deutsch → Englisch nutzt dieselbe Zielwort-/Variantenprüfung wie die klassische englische Abfrage, ohne Tippfehlertoleranz. Wiedererkennen und Hilfen ersetzen keinen eigenständigen schriftlichen Abruf. Englische Satzbausteine ergänzen das Vokabeltraining ungefähr jede achte Runde; lateinische Kasus- und Endungsaufgaben werden in Englisch nicht eingeplant.
Normale Schreibaufgaben verwenden `write-practice.js` gemeinsam mit dem klassischen Modus. Der Rundenadapter bewahrt die eigene Lernplanung, Fehlerwiederholung und Checkpoints. Die ursprünglichen Einzelantwortfelder, Plus-Schaltfläche, Korrekturübung und Bewertungsberichtigung bleiben bedienbar. Eine Berichtigung bleibt als weiteres unveränderliches Ereignis erhalten, ersetzt in der Auswertung aber nur denselben ursprünglichen Versuch. Änderungen eines Vokabeleintrags aktualisieren den aktuellen Aufgabenstand und die zugehörige Bewertung.
Bestehende Latin-Profile bleiben unter ihrem ursprünglichen Datenbankschlüssel; Englisch erhält einen disjunkten internen Profilnamensraum mit einem in externen IDs verbotenen Trennzeichen. Damit bleiben alte lateinische Replay-Hashes und alle Lernereignisse kompatibel. Die lokale IndexedDB ist bereits nach Fach getrennt; zusätzliche Fachmetadaten verhindern ein irrtümliches Vermischen. Inhaltsloader und Importwerkzeuge akzeptieren Latein und Englisch ausdrücklich und weisen andere Fächer zurück.


Die Lernlandschaft ergänzt das klassische Lateintraining und ist zunächst ausschließlich für den Hauptadmin sichtbar. Die API prüft die Rolle unabhängig von der Oberfläche. Englische und französische Lernbereiche bleiben unverändert.

## Oberfläche und Bedienung

Unter Lernen wechseln „Klassisch“ und „Lernlandschaft“ zwischen den Ansichten. Ein Punkt des geschwungenen Weges steht für eine Lernrunde, nicht für eine ganze Sammlung. Abgeschlossene Runden bleiben im Verlauf; unterbrochene Runden sind weiter erreichbar. Die nächste Empfehlung richtet sich nach dem tatsächlichen Lernstand. Es gibt keine Zeitlimits oder Übungsart-Präferenzen.

Unterstützt sind Karteikarten mit Fingerführung und Umdrehen, vollständiges Schreiben, schnelle Abfrage einer Bedeutung, Zuordnen, deutsche Satzbausteine mit Worthilfe, gemischte Fehlerrunden, Endungstabellen und Kasusfragen. Der Schreib-Checkpoint liegt nach der Fehlerkorrektur der ersten Hälfte. Pausieren speichert den Zwischenstand. Bei Karten/Zuordnung bestätigt Wiedererkennen nicht automatisch die vollständige schriftliche Beherrschung.

Die Bewegungsschicht verwendet Pointer Events, CSS und WAAPI. Transform/Opacity-Übergänge sind unterbrechbar; reduzierte Bewegung wird berücksichtigt. Die schnelle Abfrage erhält das native Eingabefeld über Feedback und Aufgabenwechsel hinweg. Die vorhandene Tastatursichtbarkeits-Hilfe berücksichtigt auch die neuen Eingabefelder.

Die vier originalen AAC-Sounds liegen unverändert unter `app/assets/landscape/`. Auswahl, Start, richtige und falsche Antwort besitzen unabhängige Audioquellen. Ein neuer Effekt stoppt keinen vorherigen; auch derselbe Effekt kann mehrfach gleichzeitig klingen. Audiofehler blockieren keine Lernaktion. Es gibt keine Sprachsynthese.

## Lernmodell

`app/landscape-engine.js` leitet den Zustand aus unveränderlichen Ereignissen ab. Felder sind einzelne Bedeutungsgruppen oder Kombinationen aus Kasus, Deklination und Numerus. Erste Antwort, Wiederholung, Hilfe und Übungsart bleiben unterscheidbar. Klassische Reviews werden konservativ gelesen und nicht umgeschrieben.

Die zentralen Parameter stehen in `LANDSCAPE_CONFIG`. Das Modell ist eine dokumentierte, anpassbare Heuristik, kein wissenschaftlich kalibriertes Erinnerungsversprechen. Pro Feld werden Schwierigkeit und Stabilität in Tagen geführt. Die geschätzte Erinnerungswahrscheinlichkeit nimmt über den tatsächlichen Zeitabstand ab. Fehler erhöhen die Schwierigkeit und verkürzen die Stabilität; spätere selbstständige Erfolge vergrößern den Abstand entsprechend ihrer Aussagekraft. Sofortkorrekturen, Hilfen und Wiedererkennen verlängern den Wiederholungsabstand nicht. Die Mindesttrennung unabhängiger erfolgreicher Abrufe verhindert, dass Runden im Abstand weniger Sekunden langfristige Sicherheit vortäuschen.

Die Auswahl berücksichtigt neue Uploads, Fehleranteil, Fälligkeit, lange ungeprüfte Inhalte, letzte Runden und Prüfungsschwerpunkte. Eine neue Sammlung bleibt während der Einführung im Zusammenhang Karteikarten → Zuordnen → Schreiben. Wenige Fehler werden gezielt mitgeführt; viele Fehler führen zu zusätzlicher Unterstützung. Die gemeinsame Bestandsaufnahme unterscheidet schon vorhandene Sammlungen von späteren Uploads auch auf anderen Geräten.

Prüfungsvorbereitung speichert Sammlungen und Datum. Die Annäherung an den Termin erhöht deren Auswahlpriorität; die Bewertung der Antworten bleibt unverändert. Nach Ablauf oder Beendigung entfällt der zeitweilige Schwerpunkt, die Lernerkenntnisse bleiben erhalten.

## Endungen und Sätze

`app/landscape-curriculum.js` enthält die fünf Fälle der gelieferten Buchvorlage mit vier Deklinationsgruppen und zwei Numerusspalten. Die dritte Gruppe folgt ausdrücklich dem senātor-Muster. Der Nominativ Singular bleibt als Grundform erklärt und ist kein falsches „-or“-Eingabefeld. Längenstriche werden gezeigt; ihre Eingabe ist nicht erforderlich. Die Lernphase blendet nacheinander Feldpaare aus; erst danach wird die gesamte abfragbare Tabelle leer. Gezielte oder vollständige Hilfe kann wieder hinzukommen.

Die automatische Grammatikempfehlung richtet sich nach dem Kalendertag in der Nutzerzeitzone. Zusätzliche freiwillige Runden sind jederzeit möglich. Kasusfragen haben einen eigenen Lernstand; frühere Fälle bleiben neben neu eingeführten Fällen in der Wiederholung.

Der geprüfte Inhaltsstand und seine Wortabdeckung werden in `server/content/landscape-content-report.json` dokumentiert. Der Laufzeitkatalog liegt gzip-komprimiert in `server/content/landscape-sentences.json.gz`; das Backend liefert ihn ausschließlich über authentifizierte Landschaftsaktionen. Der Inhalt verwendet vorhandene kanonische Wort-IDs, Präsens und Perfekt sowie vorbereitete deutsche Bausteinlösungen. Die laufende Antwortprüfung verwendet keine KI. Die Inhaltswerkzeuge dokumentieren Erstellung und Validierung für spätere Ergänzungen. Neue Vokabelübungen funktionieren unabhängig davon, ob für ihre Sammlung bereits Satzinhalte vorliegen.

## Speicherung und API

Die lokale Erweiterung liegt in `doc.landscape` im vorhandenen IndexedDB-Store. Klassische `shadow`-/`pending`-Daten bleiben getrennt. Abgeschlossene Runden ergänzen reguläre `streakDay`-Einträge; es werden keine fingierten klassischen Vokabelreviews erzeugt.

`server/landscape.mjs` legt ausschließlich additive `landscape_*`-Tabellen an. Ereignis-IDs sind idempotent und inhaltlich unveränderlich. Geräte synchronisieren ausstehende Ereignisse, Runden, Prüfungsziele und die gemeinsame Bestandsaufnahme über Cursor. Gleichzeitige Fortsetzungen derselben Runde erhalten beide Arbeitsstände als erkennbare Zweige. Ein verspäteter Serverbeleg überschreibt keinen neueren lokalen Entwurf. Idempotenzbelege enthalten Hash und kompakte Bestätigung, keine mehrfachen Kopien sämtlicher Aufgaben.

Die HTTP-Schicht authentifiziert `landscape*`-Aktionen über das vorhandene Konto; der Dienst prüft Rolle und Fach zusätzlich. Schüler dürfen auch mit selbst konstruierten direkten Anfragen keine Landschaftsdaten lesen oder schreiben. `landscapeCatalogue` und `landscapeSentences` liefern Inhalte; `landscapePull` und `landscapeSync` übertragen Fortschritt. Das Health-Ergebnis enthält `landscapeReady`.

## Veröffentlichung und Rückweg

Zuerst das Backend mit dem erweiterten Installer aktualisieren, anschließend die Oberfläche veröffentlichen. Das Paket enthält die beiden neuen Servermodule und den komprimierten Satzkatalog. Der Installer erstellt eine Online-SQLite-Sicherung, sichert den Quellstand und das bisherige Containerimage und verändert ausschließlich das separate Vokabelprojekt auf Port 8081. Bei einem Installationsfehler stellt er Code/Container wieder her; er setzt die Datenbank nicht unbemerkt zurück.

Die vorhandenen Tabellen und Journale bleiben beim Update erhalten. Ein späteres Entfernen der Oberfläche erfordert kein Löschen neuer Lernereignisse. Eine Freigabe für weitere Nutzer ist eine eigene spätere Änderung; diese Version schaltet sie nicht frei.
