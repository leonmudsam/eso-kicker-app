# Aufbau des Repositories

> Die verbindliche Arbeitsanweisung steht in `CLAUDE.md` — Ablauf, Regeln
> und die aktuellen Zahlen. Dieses Dokument erklärt die Herleitung: warum
> das Repository so geschnitten ist, wie es geschnitten ist.

Die App wird als **eine** HTML-Datei ausgeliefert — daran ändert sich nichts.
Bearbeitet wird sie aber nicht mehr als eine Datei, sondern als 58 kleine.

```
src/index.html          Gerüst: <head>, <body>, zwei Platzhalter
src/css/                geschnitten an den [§Cn]-Bannern
src/js/                 geschnitten an den [§N.M]-Bannern
tools/build.mjs         setzt src/ zu dist/index.html zusammen
tools/check.mjs         vier Wächter (siehe unten)
index.html              das ausgelieferte Ergebnis, mitversioniert
icon.png                App-Icon
```

## Warum Aneinanderhängen und kein Bundler

Die gesamte Logik ist eine einzige IIFE. Innerhalb davon greifen hunderte
Bezeichner quer durcheinander, ohne jede Deklaration von Abhängigkeiten.
Sie in `import`/`export` zu übersetzen wäre ein eigenes Projekt mit eigenem
Risiko und ohne sichtbaren Gewinn.

`build.mjs` hängt die Dateien deshalb einfach in alphabetischer Reihenfolge
wieder aneinander — exakt die Reihenfolge, in der sie vorher in `index.html`
standen. **Die Nummern-Präfixe der Dateinamen sind die Reihenfolge.** Wer eine
Datei umbenennt, verschiebt Code.

Das Ergebnis ist byteweise identisch mit dem, was vorher im Repository lag:

```
node tools/build.mjs && diff index.html dist/index.html
```

## Arbeitsablauf

```
1. in src/ ändern
2. node tools/build.mjs      → dist/index.html
3. node tools/check.mjs      → vier Wächter
4. node tests/run.mjs        → sechs Suiten
5. cp dist/index.html index.html
6. committen
```

Schritt 5 fällt weg, sobald Pages über Actions läuft.

## Die vier Wächter

| Wächter | Fängt ab |
|---|---|
| Drift | jemand hat `index.html` direkt bearbeitet statt `src/` |
| Parser | Syntaxfehler an einer Dateigrenze — sonst erst im Browser sichtbar |
| CSS-Klammern | eine offene `{` am Dateiende frisst still die nächste Datei |
| Doppelte Namen | derselbe Bezeichner auf oberster Ebene in zwei Dateien; getrennte Dateien sehen unabhängig aus, teilen sich nach dem Zusammensetzen aber einen Gültigkeitsbereich |

## Die Testsuiten

`tests/*.test.js` laufen gegen die echten 466 Partien der Liga
(`tests/fixtures/`), nicht gegen erfundene Daten — Schwellen, die auf
Fantasiezahlen kalibriert sind, sagen nichts. Jede Datei ist ein eigener
Prozess, weil die App eine IIFE mit globalem Zustand ist.

```
node tools/build.mjs && node tests/run.mjs
```

Geprüft wird immer `dist/index.html`, nie die Quelle: nur so fällt auch ein
Fehler auf, der erst beim Zusammensetzen entsteht.

| Suite | prüft |
|---|--:|
| `disziplinen` | Katalog, Vergabe, Belege, Reihenfolge |
| `tafel` | Monatstafel, Liga-Ansichten, Invarianten |
| `ambient` | die 10-/19-Uhr-Slots, Rückblicke, Breaking |
| `zeichen` | Feuer, Sterne, Wappen — im echten Browser gemessen |
| `archiv` | Einfrieren abgeschlossener Monate |
| `backup` | Export und Wiederherstellung — braucht einen Browser |

Die Backup-Suite prüft eine ZIP-Datei, die im Browser entsteht; das lässt
sich in Node nicht ehrlich nachstellen. Ohne Chromium steigt sie mit Code 2
aus und wird als **übersprungen** geführt — sichtbar, aber nicht rot. Lokal
mitlaufen lassen: `npm install --no-save playwright-core`.

## Veröffentlichung

Heute: Pages liefert `index.html` direkt aus dem `main`-Branch aus.

`.github/workflows/pages.yml` liegt bereit und läuft schon mit — vorerst nur
der Prüf-Job. Zum Umschalten:

1. Settings › Pages › Source: **GitHub Actions**
2. Settings › Secrets and variables › Actions › Variables:
   `PAGES_VIA_ACTIONS` = `true`

Ab dann wird bei jedem Push auf `main` gebaut, geprüft und veröffentlicht,
und `BUILD_VERSION` bekommt automatisch einen Stempel aus Datum und
Lauf-Nummer. Zurück geht es genauso schnell: Variable löschen, Source wieder
auf den Branch — `index.html` liegt weiterhin im Wurzelverzeichnis.

## Orientierung

Die Banner (`[§C5]`, `[§11.7]`) stehen weiterhin im Code. Was sich ändert:
man muss nicht mehr danach suchen, der Dateiname sagt es schon.

Die größte Datei hat gut 1700 statt 22 956 Zeilen. Eine Tabelle mit
Zeilenzahlen stand hier einmal; sie veraltet mit jeder Änderung, und
`wc -l src/js/* src/css/*` beantwortet dieselbe Frage in einer Sekunde.
Welche Datei wofür zuständig ist, steht in `CLAUDE.md` unter „Landkarte".
