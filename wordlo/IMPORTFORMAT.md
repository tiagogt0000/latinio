# Wordlo · Importformat 1

Die App lernt ausschließlich die eingetragenen Buchantworten. Keine Online-Wörterbücher, automatisch ergänzten Synonyme, Grammatikaufgaben oder fremden Vokabeln. Die Beispieldateien dienen nur als Vorlage und werden nicht automatisch geladen.

## Normale Sammlung

```json
{
  "format": "wordlo-collection",
  "schema": 1,
  "id": "unit-1",
  "name": "Unit 1",
  "words": [
    {
      "id": "unit-1-wohnung",
      "english": [
        {"answers": ["flat"], "region": "UK"},
        {"answers": ["apartment"], "region": "US"}
      ],
      "german": [{"answers": ["Wohnung"]}],
      "context": {"de": "", "en": ""}
    }
  ]
}
```

- `english` und `german` enthalten Bedeutungsgruppen. Jede Gruppe entspricht einer geforderten Antwort im Modus „alle“.
- Innerhalb einer Gruppe stehen in `answers` ausschließlich gleichwertige, im Buch erlaubte Alternativen. Eine davon erfüllt diese Gruppe.
- Britische und amerikanische Varianten stehen in getrennten englischen Gruppen mit `region: "UK"` oder `"US"`. Die App fragt die Zuordnung nach einer richtigen englischen Übersetzung. Im Modus „eine“ nur für die eingegebene Variante.
- Die Reihenfolge der eingegebenen Antworten spielt keine Rolle. Doppelte Antworten erfüllen keine zusätzliche Gruppe.
- `context.de` ist ein optionaler Buchhinweis bei Deutsch → Englisch, `context.en` bei Englisch → Deutsch. Keine lösungsverratenden Hinweise ergänzen.
- Wort- und Gruppenkennungen sind optional. Die App erzeugt fehlende IDs. Stabile IDs sind beim erneuten Verknüpfen hilfreich. Erlaubt sind Buchstaben, Zahlen, Bindestriche und Unterstriche, höchstens 120 Zeichen.
- Kurze Schreibweise: `"english": ["because"], "german": ["weil"]`. Mehrere Strings sind mehrere geforderte Gruppen. `"german": [["beginnen", "anfangen"]]` ist eine Gruppe mit zwei gleichwertigen Antworten.
- Englisch wird einschließlich Groß-/Kleinschreibung geprüft. Leerraum und gerade/typografische Apostrophe werden vereinheitlicht. Deutsche Groß-/Kleinschreibung und ß/ss werden gleichgesetzt. Ein eindeutiger kleiner deutscher Tippfehler ab fünf Zeichen wird toleriert; kurze oder uneindeutige Fälle können manuell zugeordnet werden.
- „Eine richtige reicht“ wird erfüllt, sobald eine hinterlegte Bedeutung erkannt wird. Falsche zusätzliche Antworten werden angezeigt; im Modus „alle“ verhindern sie eine vollständig richtige Bewertung.

## Auffrisch-Datei vom Papier

Dasselbe Format verwenden, aber `"format": "wordlo-refresh"`. Die Datei landet unabhängig vom Import-Einstieg direkt unter Auffrischen.

Vollständige Einträge mit beiden Sprachen werden anhand von Buchantworten, regionalen Markierungen und Kontexthinweisen mit vorhandenen Wörtern verglichen. Bei einer eindeutigen Übereinstimmung bleibt der Lernstand erhalten. Neue Wörter werden direkt der Auffrisch-Sammlung zugeordnet. Mehrdeutige Treffer erfordern eine genaue Wortkennung.

Wenn das Originalwort bereits vorhanden ist, kann die Auswahl auch nur Referenzen enthalten:

```json
{
  "format": "wordlo-refresh",
  "schema": 1,
  "name": "Auf Papier noch unsicher",
  "words": [{"wordId": "unit-1-wohnung"}]
}
```

Eine fehlende Referenz wird mit einer Fehlermeldung abgelehnt. Für portable Dateien deshalb vollständige Einträge verwenden. Der Export einer Auffrisch-Sammlung enthält automatisch vollständige Wörter.

Fotos im Chat: Für eine zuverlässige Datei das Foto der markierten/notierten Wörter zusammen mit dem aktuellen Sammlungsexport oder den passenden Buchseiten bereitstellen. Unleserliche Wörter müssen geklärt und dürfen nicht geraten werden.

## Sicherung

Unter Einstellungen lässt sich der komplette Lernstand exportieren. `wordlo-backup` enthält Vokabeln, Sammlungen, Auffrisch-Listen, Bewertungen und Lerneinstellungen, aber keinen privaten Verbindungsschlüssel. Import übernimmt gleiche Kennungen aus der Sicherung nach einer ausdrücklichen Vorschau. Andere vorhandene Einträge bleiben erhalten. Eine laufende Runde ist gerätegebunden und nicht Teil der Sicherung.
