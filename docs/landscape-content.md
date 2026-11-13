# Lernlandschaft: Inhalte pflegen

Die Inhalte sind von Lernständen, Sitzungen und Accounts getrennt. Der
bereitgestellte Vokabelexport enthält ausschließlich Sammlungsnamen, stabile
Sammlungs-/Wort-IDs, lateinische Wörter und deutsche Bedeutungsgruppen. Er stammt
aus den tatsächlich vorhandenen 19 Lateinlektionen (480 Wörter), nicht aus dem
älteren Starterpaket. Der Server liest den komprimierten Satzkatalog aus
`server/content/landscape-sentences.json.gz`; dafür ist kein KI-Konto erforderlich.

## Erstellung und Prüfung

`server/content/build-landscape-corpus.py` enthält explizite Flexionsformen,
semantisch eingeschränkte Satzmuster und ausformulierte Aufgaben für schwierige
Funktionswörter. Die Auswahl ist reproduzierbar und führt dieselbe lexikalische
Kernaussage nicht bloß mit einer anderen Zeitform oder einem anderen Adverb
mehrfach innerhalb einer Lektion auf. Ergänzende Wörter stammen nur aus dieser
oder einer früheren Lektion. Der Bericht
`server/content/landscape-content-report.json` zeigt die tatsächliche Abdeckung
und benennt Wörter, die noch keinen passenden Satz erhalten haben. Diese Wörter
bleiben selbstverständlich in den normalen Vokabelübungen verfügbar.

```sh
python3 server/content/build-landscape-corpus.py
node server/landscape-content-cli.mjs validate \
  --file server/content/landscape-sentences.json.gz \
  --vocabulary server/content/landscape-vocabulary.json --minimum 100
```

Die Strukturprüfung kontrolliert IDs, Schwerpunktbezug, eindeutige Sätze,
Präsens/Perfekt, Übersetzungsbausteine und deren Multimengen bei alternativen
Wortstellungen. Sie ist **kein allgemeiner Latein- oder Deutschparser**. Inhaltlich
geprüft werden zusätzlich Argumente und Kasus, natürliche Bedeutung,
Übersetzungsgenauigkeit, Partikelskopus, eingeführte Konstruktionen und faire
Ablenkungen. Eine neue Sammlung darf nicht mit ungeprüften, zufällig kombinierten
Wörtern auf eine Sollzahl aufgefüllt werden.

## Neue Lektion hinzufügen

1. Einen neuen minimalen Vokabelexport mit den vorhandenen stabilen IDs erstellen;
   keine Account-, Sitzungs-, Geräte- oder Lerndaten exportieren.
2. Eine JSON-Datei mit `schema:1`, `collections` und `sentences` erstellen. Jede
   Aufgabe hat `id`, `collectionId`, `latin`, `tokens:[{text,wordId}]`,
   `translations:[string[]]`, `distractors`, `focusWordIds`, `tense` und
   `difficulty`. Eigene IDs vergeben; veröffentlichte Aufgaben nicht heimlich
   unter derselben ID austauschen.
3. Die einzelnen deutschen Bausteine so wählen, dass gültige, vorgesehene
   Wortstellungen dieselben Bausteine verwenden. Alle diese Lösungen speichern.
   Zusätzliche Bausteine dürfen keine gleichfalls richtige Übersetzung bilden.
4. Strukturprüfung und sprachliche Inhaltsprüfung durchführen, dann einen neuen
   Katalog vorbereiten:

```sh
node server/landscape-content-cli.mjs merge \
  --file neue-saetze.json --base server/content/landscape-sentences.json.gz \
  --vocabulary neuer-vokabelexport.json --output work/gepruefter-katalog.json.gz \
  --reviewed
```

Der Befehl ersetzt weder den angegebenen Ausgangskatalog noch die Produktionsdatei.
Die vorbereitete Datei gelangt mit dem üblichen geprüften Backend-Update auf den
Server. Neu hochgeladene Vokabeln sind bereits vor Fertigstellung ihres Satzvorrats
lernbar; der Katalog meldet für diese Sammlung `missing`.

## Endungstabellen

`app/landscape-curriculum.js` ist die Transkription der bereitgestellten Buchseite:
fünf Fälle, vier Deklinationsmuster, Singular/Plural. Die Einführung erfolgt in der
Reihenfolge Nominativ, Akkusativ, Genitiv, Dativ, Ablativ. Der Ablativ behält die
Buchbezeichnung „6. Fall“; ein Vokativ wird nicht ergänzt. Der Nominativ Singular
des senātor-Musters ist eine feste Erklärung und kein Eingabefeld. Die Eingabe
akzeptiert fehlende Längenstriche und einen optionalen Bindestrich, aber keine
anderen Endungen. Kasusfragen und Endungswissen bleiben getrennte Lernziele.
