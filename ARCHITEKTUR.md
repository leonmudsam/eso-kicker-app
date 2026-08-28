# Aufbau des Repositories

Die App wird als **eine** HTML-Datei ausgeliefert — daran ändert sich nichts.
Bearbeitet wird sie aber nicht mehr als eine Datei, sondern als 50 kleine.

```
src/index.html          Gerüst: <head>, <body>, zwei Platzhalter
src/css/                12 Dateien, geschnitten an den [§Cn]-Bannern
src/js/                 38 Dateien, geschnitten an den [§N.M]-Bannern
tools/build.mjs         setzt src/ zu dist/index.html zusammen
tools/check.mjs         vier Wächter (siehe unten)
index.html              das ausgelieferte Ergebnis, mitversioniert
icon.png                App-Icon
```

## Warum Aneinanderhängen und kein Bundler

Die gesamte Logik ist eine einzige IIFE. Innerhalb davon greifen 446
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
4. cp dist/index.html index.html
5. committen
```

Schritt 4 fällt weg, sobald Pages über Actions läuft.

## Die vier Wächter

| Wächter | Fängt ab |
|---|---|
| Drift | jemand hat `index.html` direkt bearbeitet statt `src/` |
| Parser | Syntaxfehler an einer Dateigrenze — sonst erst im Browser sichtbar |
| CSS-Klammern | eine offene `{` am Dateiende frisst still die nächste Datei |
| Doppelte Namen | derselbe Bezeichner auf oberster Ebene in zwei Dateien; getrennte Dateien sehen unabhängig aus, teilen sich nach dem Zusammensetzen aber einen Gültigkeitsbereich |

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

| Datei | Zeilen | | Datei | Zeilen |
|---|--:|---|---|--:|
| `js/00-prolog` | 148 | | `js/19-bilanzen` | 144 |
| `js/01-update` | 57 | | `js/20-bind` | 329 |
| `js/02-icons` | 266 | | `js/21-head-to-head` | 178 |
| `js/03-saison` | 125 | | `js/22-team-profil` | 617 |
| `js/04-cache` | 445 | | `js/23-match-edit` | 72 |
| `js/05-rang-elo` | 305 | | `js/24-lock` | 88 |
| `js/06-db` | 629 | | `js/25-helpers` | 64 |
| `js/07-positionsverlauf` | 1096 | | `js/26-news-konstanten` | 120 |
| `js/08-stats` | 507 | | `js/27-news-generator` | 1484 |
| `js/09-ui-infra` | 181 | | `js/28-news-ambient` | 979 |
| `js/10-elo-engine` | 560 | | `js/29-news-cache` | 483 |
| `js/11-view-ranking` | 699 | | `js/30-news-ui` | 564 |
| `js/12-view-positionen` | 70 | | `js/31-news-detail` | 654 |
| `js/13-view-awards` | 1364 | | `js/32-chronik-katalog` | 447 |
| `js/14-top5-listen` | 618 | | `js/33-chronik-engine` | 417 |
| `js/15-views-rest` | 517 | | `js/34-chronik-rekorde` | 738 |
| `js/16-sheet-infra` | 335 | | `js/35-chronik-ui` | 463 |
| `js/17-badges` | 1481 | | `js/36-backup` | 878 |
| `js/18-profil` | 1723 | | `js/37-boot` | 7 |

Die größte Datei hat jetzt 1723 statt 22 956 Zeilen.
