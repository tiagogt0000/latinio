# Englisch: kurze Satzanwendungen

Englisch verwendet einen eigenen Satzkatalog und denselben überprüfbaren
Bausteinvergleich. Satzaufgaben ergänzen das Vokabellernen gelegentlich; sie
bilden keinen eigenständigen Pflichtkurs. Die häufigen Lernaufgaben bleiben
Vokabeln in beiden Richtungen. Die Satzanwendungen zeigen einen deutschen
Ausgangssatz und verlangen englische Bausteine.

## Bestand

Der kanonische Englischbestand des Admins wurde lesend aus dem vollständigen
Englischjournal rekonstruiert. Der minimale Export enthält nur
`collections:{id,name}` und `words:{id,collectionId,latin,meanings}`. Weder
Account-/Sitzungsdaten noch Lernergebnisse sind enthalten. Die acht vorhandenen
Sammlungen LW 2–LW 9 enthalten 189 Einträge.

Es gibt 193 einzeln formulierte Aufgaben: 24 für jede Sammlung, 25 für LW 3.
Alle 189 Einträge kommen mindestens einmal als Schwerpunkt vor. Nomen und
Adjektive werden in einfachen Beschreibungen und Alltagssituationen angewendet;
die vorhandenen Wendungen erhalten passende kurze Beispiele. Allgemeine
Grundwörter und Satzgrammatik bilden den Rahmen. Diese Grundwörter werden nicht
als neu hochgeladene Vokabeln bewertet oder mit erfundenen Vokabel-IDs versehen.

Die Autorendatei `server/content/build-english-landscape.mjs` enthält die
deutschen Sätze, markierte Vokabelbezüge, englische Antworten und ausdrücklich
ausgewählte falsche Bausteine. Beispielsweise werden `quay` und `wharf`, die beide
„Kai“ bedeuten können, nicht als gegenseitig falsche Antworten angeboten.
Mehrdeutige oder gleichbedeutende Alternativen gehören nicht in die Ablenkungen.

## Dateien und Vertrag

- `server/content/landscape-english-sentences.json.gz`: Laufzeitkatalog.
- `server/content/landscape-english-vocabulary.json`: minimaler Wortbestand für
  Inhaltspflege und Validierung.
- `server/content/landscape-english-content-report.json`: Anzahl und Abdeckung.

Die vorhandenen Lateindateien bleiben unverändert. Der Server unterscheidet die
Kataloge durch eine feste Fachliste und getrennte Caches. Die bestehenden
Funktionsaufrufe behalten Latein als Standard:

```js
getSentenceCatalogue(collections, 'english');
getCollectionSentences(collectionId, 'english');
readSentenceCatalogue('english');
validateSentenceCatalogue(catalogue, vocabulary, {
  subject: 'english', minimumPerCollection: 20,
});
```

Eine Englischaufgabe trägt `subject:'english'`, `direction:'de-en'`,
`promptLanguage:'de'` und `answerLanguage:'en'`. `prompt` enthält den deutschen
Satz; `latin` ist ausschließlich dessen rückwärtskompatibles Anzeigefeld.
`translations` enthält akzeptierte englische Bausteinreihenfolgen. Markierte
deutsche Wörter oder kurze Wortgruppen verweisen mit `wordId` auf den passenden
englischen Eintrag. Normale Satzwörter haben `wordId:null,kind:'glue'` und keinen
Vokabelhinweis. Die Oberfläche zeigt für sie kein anklickbares Wörterbuch an.

## Prüfung und Erweiterung

```sh
node server/content/build-english-landscape.mjs
node server/landscape-content-cli.mjs validate \
  --subject english --minimum 20 \
  --file server/content/landscape-english-sentences.json.gz \
  --vocabulary server/content/landscape-english-vocabulary.json
node --test tests/landscape-content.test.mjs tests/landscape-english-content.test.mjs
```

Die Strukturprüfung kontrolliert Fach/Richtung, IDs, Hinweise, Schwerpunktbezüge,
Sprachen, eindeutige Sätze und übereinstimmende Bausteine alternativer Lösungen.
Sie ersetzt keine sprachliche Prüfung von Bedeutung, Grammatik und falschen
Antworten. Neue Sammlungen können sofort als Vokabeln gelernt werden; ein noch
fehlender Satzvorrat wird als `missing` gemeldet und sperrt sie nicht. Derselbe
CLI-Prozess kann nach Inhaltsprüfung einen neuen englischen Katalog vorbereiten;
ein Zusammenführen mit Latein wird abgewiesen. Für Erstellung und Nutzung ist
keine kostenpflichtige KI-Verbindung erforderlich.
