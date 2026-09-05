# Herleitung

> **Was hier NICHT steht:** Ablauf, Regeln, Wächter, Testsuiten, Landkarte,
> und überhaupt jede Zahl. Das steht in `CLAUDE.md`, dort an genau einer
> Stelle, und Wächter 6 zählt es nach. Dieses Dokument beantwortet nur die
> Fragen, die eine Anweisung nicht beantwortet: **warum** das Repository so
> geschnitten ist.
>
> Beides doppelt zu führen war der frühere Zustand. Das Ergebnis: hier stand
> „sechs Suiten", während es sieben waren, und ein Arbeitsablauf in einer
> anderen Reihenfolge als der verbindliche. Wer zwei Anweisungen findet,
> befolgt die falsche.

## Warum eine ausgelieferte Datei

Die Liga ist ein Dutzend Leute und ein Tischkicker. Es gibt keinen Server,
kein Deployment-Fenster und niemanden, der eine Build-Kette betreut.
GitHub Pages liefert eine Datei aus, und ein neuer Stand ist ein `git push`.

Der Preis dafür ist, dass die Datei alles enthält: Stile, Logik, Ansichten.
Sie ist deshalb groß — aber sie wird einmal geladen und danach aus dem
Cache bedient, und die Alternative wäre eine Werkzeugkette, die niemand
wartet.

## Warum Aneinanderhängen und kein Bundler

Die gesamte Logik ist eine einzige IIFE. Innerhalb davon greifen hunderte
Bezeichner quer durcheinander, ohne jede Deklaration von Abhängigkeiten.
Sie in `import`/`export` zu übersetzen wäre ein eigenes Projekt mit eigenem
Risiko und ohne sichtbaren Gewinn — die App liefe danach genauso.

`build.mjs` hängt die Dateien deshalb in alphabetischer Reihenfolge wieder
aneinander. Daraus folgt die einzige Regel, die man beim Anlegen einer Datei
kennen muss: **die Nummern-Präfixe sind die Reihenfolge.** Wer umbenennt,
verschiebt Code.

Das kostet etwas, und man sollte wissen, was: es gibt keine Kapselung. Jede
Datei sieht jede andere, ein Name ist einmal im ganzen Projekt vergeben, und
eine Funktion, die niemand mehr ruft, fällt niemandem auf. Genau dagegen
prüft Wächter 4 — er ersetzt, was ein Modulsystem geschenkt hätte.

## Warum die Version ein Fingerabdruck ist

`BUILD_VERSION` steht im ausgelieferten Code, und `checkForUpdate` holt sich
alle fünf Minuten die veröffentlichte Datei, um die beiden zu vergleichen.
Ist die entfernte Version neuer, erscheint das Banner.

Von Hand gepflegt stand diese Nummer sechs Veröffentlichungen lang still.
Die Folge war nicht sichtbar, sondern das Gegenteil: jedes Gerät, das die
App offen hatte, verglich die Version mit sich selbst und blieb auf einem
Stand von vor Tagen. Ein PWA-Symbol auf einem Telefon wird nicht neu
geladen, wenn niemand es dazu auffordert.

Deshalb vergibt `build.mjs` die Nummer und nicht der Mensch: sie endet auf
einem Hash über genau den Inhalt, der ausgeliefert wird. Sie ändert sich,
wenn sich die Auslieferung ändert, und sonst nie — ein Bauen ohne Änderung
darf kein Update auslösen. Das Datum davor ist nur Lesbarkeit und bleibt
stehen, solange der Hash steht. Wächter 5 prüft, dass die ausgelieferte
Datei die Nummer trägt, die zu ihrem Inhalt gehört.

## Warum die Tests im Browser messen

Ein Teil der Zusicherungen ist Geometrie: ob eine Flamme in ihrer Zeile
bleibt, ob ein Zeichen von einer Kartenkante abgeschnitten wird, ob eine
Wischgeste beim richtigen Element ankommt. Solche Sätze lassen sich nicht
durch Lesen prüfen, und ein Test, der sie behauptet statt sie zu messen,
ist ein grüner Haken für nichts.

Die Suiten, die das tun, brauchen deshalb einen echten Browser. Ohne ihn
steigen sie mit Code 2 aus und werden als *übersprungen* geführt — sichtbar,
aber nicht rot, damit ein Rechner ohne Chromium nicht die ganze Prüfung
blockiert. Lokal: `npm install --no-save playwright-core`.

## Veröffentlichung

Heute: Pages liefert `index.html` direkt aus dem `main`-Branch aus. Der
Stand im Repository IST der Stand im Netz; deshalb wird `index.html`
mitversioniert und deshalb prüft Wächter 1, dass sie zu `src/` passt.

`.github/workflows/pages.yml` liegt bereit und läuft schon mit — vorerst nur
der Prüf-Job. Zum Umschalten:

1. Settings › Pages › Source: **GitHub Actions**
2. Settings › Secrets and variables › Actions › Variables:
   `PAGES_VIA_ACTIONS` = `true`

Ab dann wird bei jedem Push auf `main` gebaut, geprüft und veröffentlicht.
Zurück geht es genauso schnell: Variable löschen, Source wieder auf den
Branch — `index.html` liegt weiterhin im Wurzelverzeichnis.
