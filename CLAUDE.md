# Kicker-Liga — Arbeitsanweisung

Deutschsprachige Einzeldatei-PWA für eine 2-gegen-2-Tischkicker-Liga:
Elo, Saisons, Awards, Rekorde, Chronik, News. Backend ist Supabase,
ausgeliefert wird **eine** `index.html` über GitHub Pages.

> **Diese Datei ist Teil des Codes, nicht Begleitmaterial.**
> Wer die Struktur, den Ablauf oder eine Regel ändert, ändert sie hier im
> **selben Commit** mit. Wie genau, steht ganz unten unter
> [Pflege dieser Datei](#pflege-dieser-datei) — der Abschnitt ist
> verbindlich, nicht optional.

---

## 1. Der Bauablauf

`index.html` im Wurzelverzeichnis ist **Build-Ergebnis**, nicht Quelle.
Niemals direkt bearbeiten.

```
1. in src/ ändern
2. node tools/build.mjs            → dist/index.html
3. cp dist/index.html index.html   ← wird am häufigsten vergessen
4. node tools/check.mjs            → sechs Wächter, alle müssen grün sein
5. node tests/run.mjs              → sieben Suiten, alle müssen grün sein
6. committen (deutsche Nachricht, siehe §7)
```

Wächter 1 heißt „index.html entspricht src/" und schlägt genau dann an,
wenn Schritt 3 fehlt. Wer ihn rot sieht, hat fast immer nur das `cp`
vergessen — nicht die Quelle kaputtgemacht.

**Die Version wird nicht von Hand gepflegt.** `build.mjs` vergibt sie: ein
Datum und dahinter ein Hash über genau den ausgelieferten Inhalt. Sie ändert
sich, wenn sich die Auslieferung ändert, und sonst nie — zweimal bauen ergibt
dieselbe Nummer, auf jedem Betriebssystem. Zeilenenden zählen dafür nicht mit:
der Arbeitsbaum unter Windows trägt CRLF, Repository und Prüf-Job tragen LF, und
derselbe Inhalt ergab damit zwei Nummern — Wächter 5 war auf dem Rechner grün
und im Job rot. Von Hand gepflegt stand sie sechs Veröffentlichungen lang
still, und `checkForUpdate` verglich damit die Version einer Seite mit sich
selbst: kein Gerät erfuhr je von einer neuen Fassung. Wächter 5 prüft das
nach. Wer sie doch einmal setzen muss, tut es über `BUILD_STAMP=…`.

Ein Durchlauf ohne Schritt 4 und 5 gilt als nicht erledigt. Kein Commit
mit rotem Wächter oder roter Suite.

---

## 2. Aufbau des Repositories

```
src/index.html        Gerüst mit den Platzhaltern /*@@CSS*/ und /*@@JS*/
src/css/              16 Dateien
src/js/               42 Dateien
tools/build.mjs       hängt src/css/* und src/js/* ALPHABETISCH aneinander
tools/check.mjs       vier Wächter
tests/run.mjs         Testläufer, jede Suite ein eigener Prozess
tests/ziel.js         entscheidet, welche Datei geprüft wird (dist vor Wurzel)
tests/fixtures/       die echten Partien der Liga, gepackt
index.html            das ausgelieferte Ergebnis, mitversioniert
mockup/               Entwürfe. Eigenständige HTML-Seiten ohne Bauablauf,
                      Vorlage für einen Umbau — kein Teil der App
ARCHITEKTUR.md        ausführliche Herleitung, dort steht das Warum
.github/workflows/    pages.yml — Prüf-Job, Veröffentlichung schaltbar
kicker-app-main/      alter Abzug, liegt bewusst brach — nicht anfassen
```

> **Pflegepflicht.** Kommt eine Datei in `src/` dazu, fällt eine weg oder
> wird eine umbenannt, wird dieser Baum und — falls die Datei eine eigene
> Aufgabe hat — die Landkarte in §3 im selben Commit nachgezogen.

### Warum Aneinanderhängen und kein Bundler

Die gesamte Logik ist **eine IIFE**. Kein `import`, kein `export`, nichts
liegt auf `window`. Innerhalb dieser IIFE greifen hunderte Bezeichner quer
durcheinander, ohne jede Deklaration von Abhängigkeiten.

Daraus folgen drei harte Regeln:

1. **Die Zahlen-Präfixe der Dateinamen sind die Reihenfolge.** Wer eine
   Datei umbenennt, verschiebt Code. Neue Dateien bekommen ein Präfix, das
   sie an die richtige Stelle sortiert (`09c-`, `17b-`, `35b-` sind
   Nachzügler zwischen zwei bestehenden Nummern).
2. **Auch die CSS-Reihenfolge trägt Bedeutung.** Später geladene Regeln
   gewinnen bei gleicher Spezifität — `02-ranking.css` muss vor
   `12-insignium.css` stehen, sonst kippt das Wappen in der Ranglistenzeile.
3. **Ein Bezeichner darf nur einmal auf oberster Ebene stehen.** Getrennte
   Dateien sehen unabhängig aus, teilen sich nach dem Zusammensetzen aber
   einen Gültigkeitsbereich. Wächter 4 zählt sie (aktuell **594**) — und schlägt auch an, wenn einer
   davon nirgends mehr gerufen wird.

---

## 3. Landkarte

Die Banner im Code (`[§C6]`, `[§11.7]`, `[§4.1b]`) sagen, wozu ein Block da
ist. Der Dateiname sagt, wo er liegt.

Die Tabelle nennt **jede** Datei aus `src/js/` genau einmal. Das ist keine
Ordnungsliebe: Wächter 6 zählt nach, und eine Datei ohne Zeile hier ist eine
Datei, deren Aufgabe niemand aufgeschrieben hat.

| Bereich | Dateien |
|---|---|
| Rahmen, Zustand, Daten | `00-prolog` (Konstanten, Supabase-Client) · `01-update` (Version, Update-Banner, **aller Zustand**) · `04-cache` · `06-db` (Laden, Speichern, Saison-Rückblick) · `37-boot` |
| Rechnen | `03-saison` · `05-rang-elo` (Ränge, `posWert`, Metrikleiste) · `08-stats` · `10-elo-engine` |
| Ansichten | `11-view-ranking` · `12-view-positionen` · `13-view-awards` · `15-views-rest` (Teams, Verlauf, Einstellungen) · `18-profil` · `22-team-profil` |
| Blätter (Sheets) | `14-top5-listen` · `16-sheet-infra` (Öffnen, Stapel, Wischgeste) · `19-bilanzen` · `21-head-to-head` |
| Rückblicke | `05b-recap-teile` (Baukasten) · `07-positionsverlauf` (Woche, Tag) |
| Zeichen und Wappen | `02-icons` (SVG-Katalog, `lossStreakInline`) · `09c-zeichen` (Feuer, Sterne, `avHtml`) · `17-badges` · `17b-fingerabdruck` · `35b-prestige` (Insignium, Schwinge, Laufbahn) |
| News | `26-news-konstanten` (Kategorien, Limits) · `27-news-generator` (Ereignisse, Ewige Tafel) · `28-news-ambient` · `29-news-cache` (Realtime, Autosync, Entzerrung) · `30-news-ui` (`_isBreaking`) · `31-news-detail` |
| Chronik | `32-chronik-katalog` (`DISZIPLINEN`) · `33-chronik-engine` (Monat) · `34-chronik-rekorde` (Allzeit, `CHRON_KINDS`, `chronicleRang`, `rekordZaehlung`) · `35-chronik-ui` |
| Bedienung | `09-ui-infra` · `20-bind` · `23-match-edit` · `24-lock` · `25-helpers` · `36-backup` |

Bewusst **keine** Zeilenzahlen hier: die veralten bei jeder Änderung.
`wc -l src/js/* src/css/*` beantwortet das in einer Sekunde.

### Zustand

Der veränderliche Zustand der Oberfläche steht gesammelt in
`src/js/01-update.js` (`tab`, `period`, `ligaSeasonId`, `ligaSicht`,
`awView`, `awPeriod`, `awSeasonId`, `rekKammer`, `rankMetric`, …). Neue Zustandsvariablen
gehören dorthin und nirgendwo anders, und sie brauchen einen Rücksetzpunkt:
`09-ui-infra.js` (Tabwechsel), `20-bind.js` (Zeitraumwechsel) und
`24-lock.js` (Klick aufs Logo) setzen zurück.

`rekKammer` gilt **nur** für den Rekorde-Reiter und ist leer für alle vier
Kammern. Sie wird beim Tabwechsel UND beim Reiterwechsel geleert: wer den Tab
verlässt, will beim Zurückkommen die ganze Tafel sehen und nicht den
Ausschnitt von vorhin.

`ligaSeasonId` gilt **nur** für den Liga-Tab — Awards, News und Ambient
rechnen weiter mit `currentSeason()`. Sie wird beim Tabwechsel UND beim
Zeitraumwechsel geleert: die gewählte Saison gehört zur Ansicht „Saison",
und die Saison-Tools darunter (Recap, Positionsverlauf) folgen ihr.

> **Pflegepflicht.** Kommt eine Zustandsvariable dazu, wird sie hier genannt
> und ihr Rücksetzverhalten beschrieben.

### Takt

Zwei Zeitgeber laufen dauerhaft (`37-boot.js`): `_tickDaten` alle dreißig
Sekunden, `_tickVersion` alle fünf Minuten. Beide **ruhen, solange die Seite
versteckt ist**, und holen beim Zurückkommen sofort nach. `loadAll` lädt alle
Spieler und alle Partien; das im Hintergrund zu tun ist Mobilfunk und Akku
für nichts, und ein PWA-Symbol bleibt tagelang offen. Der News-Autosync
(`29-news-cache.js`) befolgt dieselbe Regel seit jeher.

`_tickDaten` lässt außerdem ein offenes Blatt und den Eingabe-Tab in Ruhe:
was man gerade unter den Fingern hat, wird nicht neu gezeichnet. `tests/blatt`
misst alle vier Bedingungen.

> **Pflegepflicht.** Kommt ein Zeitgeber dazu oder ändert seine Bedingung,
> steht das hier.

---

## 4. Die sechs Wächter

| Wächter | fängt ab |
|---|---|
| 1 Drift | `index.html` wurde direkt bearbeitet statt `src/` |
| 2 Parser | Syntaxfehler an einer Dateigrenze — sonst erst im Browser sichtbar |
| 3 CSS-Klammern | eine offene `{` am Dateiende frisst still die nächste Datei |
| 4 Bezeichner | derselbe Name auf oberster Ebene in zwei Dateien — **oder** ein Name, den niemand mehr ruft |
| 5 Fingerabdruck | die Auslieferung trägt eine Version, die nicht zu ihrem Inhalt gehört — dann erfährt kein Gerät von einer neuen Fassung |
| 6 Arbeitsanweisung | diese Datei nennt eine Datei nicht, die es gibt, eine, die es nicht gibt, oder eine Zahl, die nicht stimmt |

Wächter 6 macht die Pflegepflichten dieser Datei prüfbar: Landkarte,
Dateizahlen, Bezeichnerzahl und die Liste der Suiten. Die Zahl der **Checks**
je Suite zählt `tests/run.mjs` nach, weil nur er sie kennt. Ein rotes
Ergebnis dieser Art nennt die richtige Zahl — sie wird übernommen, nicht
weggeklickt.

---

## 5. Die Testsuiten

Geprüft wird immer das **gebaute** Ergebnis (`dist/index.html`), nie die
Quelle: nur so fällt auch ein Fehler auf, der erst beim Zusammensetzen
entsteht. Jede Suite ist ein eigener Prozess, weil die App eine IIFE mit
globalem Zustand ist.

| Suite | prüft | Checks |
|---|---|--:|
| `disziplinen` | Chronik-Katalog, Vergabe, Belege, Insignium-Leiter, Prestige, Katalog-Karten, Rekordlage je Monat, Positionsrekorde, die Fügungen, die Belege | 879 |
| `tafel` | Monatstafel, Liga-Ansichten, Rückblicke, Rekord-Blatt, Invarianten | 165 |
| `ambient` | die 10-/19-Uhr-Slots, Rückblicke, Breaking, die Ewige Tafel im Feed, der Feed | 108 |
| `zeichen` | Feuer, Sterne, Wappen, Insignium-Leiter, Unterlage, Profilkopf — **im echten Browser gemessen** | 75 |
| `blatt` | Wem eine Wischgeste gehört, die Laufbahn-Vitrine, die Verläufe der Wappen, der Takt im Hintergrund, der Rekorde-Reiter — **im echten Browser gemessen** | 21 |
| `archiv` | Einfrieren abgeschlossener Monate | 8 |
| `backup` | Export und Wiederherstellung, braucht Chromium | — |

Ohne Browser steigt `backup` mit Code 2 aus und wird als *übersprungen*
geführt — sichtbar, aber nicht rot.

> **Pflegepflicht.** Ändert sich eine Zahl in dieser Tabelle oder kommt eine
> Suite dazu, wird die Tabelle im selben Commit nachgezogen.

### Wie geprüft wird

- **Geometrische Behauptungen werden gemessen, nicht geschätzt.** „Steht
  nicht über", „ist sichtbar", „liegt innerhalb" gehören in `zeichen` und
  werden dort am gerenderten Markup mit Playwright nachgemessen.
- **Jede neue Zusicherung wird einmal gegengeprüft:** den alten Wert kurz
  wiederherstellen, den Test fallen sehen, zurücknehmen. Ein Test, der noch
  nie rot war, prüft nichts.
- Die Fixtures sind die **echten** Partien der Liga. Schwellen, die auf
  erfundenen Zahlen kalibriert sind, sagen nichts.
- Ändert sich absichtliches Verhalten, wird die Zusicherung an die neue
  Absicht angepasst — nicht das Verhalten an den alten Test.

---

## 6. Gestaltungsgesetze

Diese Regeln stehen als Kommentar im Code und werden dort mit ihrem Kürzel
zitiert. Sie sind nicht Geschmack, sondern Absprache.

- **§C25 Farbgesetz.** Vier Rollen, mehr nicht:
  1. Rangfarbe = „ich"
  2. Gold = Titel und heute gehaltene Rekorde
  3. Grün/Rot = ausschließlich Richtung
  4. Metall = alles Übrige
  Im Rekorde-Reiter heißt das: Können und Bestmarke tragen Gold, die Fügung
  Metall [§C35] — sie zeichnet niemanden aus —, die Schattenseite Rot. Als
  alle fünfunddreißig Karten golden waren, sagte Gold dort nichts mehr.
- **§C27 Ein Bauteil, überall dasselbe.** Derselbe Spieler sieht in
  Rangliste, Positionen, Awards, Team-Blatt, Podest und Profil gleich aus.
  Das Wappen ist `.rav` (`insAvWrap`), das Podest ist `.podest`/`.pod-karte`
  (`_chronPodestHtml` zeichnet es für Monats- und Rekord-Blatt aus derselben
  Reihenfolge — zwei Podeste für dieselbe Aussage wären eins zu viel),
  die Segmentwähler sind `.ui-switch` (äußere Ebene, gerahmt) und `.ui-tabs`
  (innere Ebene, rahmenlos), das Rangabzeichen ist `.rangab`
  (`rankBadgeHtml`). Wer ein zweites Bauteil für dieselbe Aussage baut, hat
  einen Fehler gemacht.
  **Die Kachel misst am Reif, nicht am Gesicht** — der Avatar ist 46 % von
  `--rav`. Wer ein 40-px-Gesicht ersetzt, braucht 87 px Kachel, nicht 40.
  Unter 48 px bleibt vom Zeichen nichts übrig; 52 px sind das Maß der
  Ranglistenzeile und die Untergrenze.
  **Das Banner trägt es nur, wo ein Spieler allein und groß steht:**
  Profilkopf, Podest der Ewigen Tafel, Podest der Award-Sammler, die Karte
  des Spielers der Woche und des Tages, das Podest im Saison-Rückblick.
  Schwinge und Raute erzählen von der LAUFBAHN; in einer Zeile fehlt ihnen
  die Höhe, und in einem Team-Blatt handelt die Seite vom Duo, nicht von
  den Titeln eines Einzelnen.
  Das Insignium hat drei Teile, die in jeder Stufe gleich aussehen: den
  **Reif** (`_insReif`), den **Kopf** auf zwölf Uhr und die **Raute** am
  Fuß (`_insFuss`) — daran bleibt die Familie erkennbar, auch wenn der
  Schmuck dazwischen vollständig wechselt [§C30].
  Der Saisonwähler (`.saisonwahl`, `saisonWaehlerHtml`) ist bewusst **keins**
  von beiden: er wählt weder Ansicht noch Filter, sondern den Zeitpunkt, von
  dem alles darunter handelt. Als `.ui-tabs` stand er zwischen zwei echten
  Reiterstreifen und war von ihnen nicht zu unterscheiden.
- **§C26 Das Zeichen.** Sterne = Ligatitel. **Höchstens fünf, dann die
  Zahl** — in beiden Formen gleich: unter dem Avatar in der Liste
  (`_znSterneSvg`, CSS), über dem Zeichen mit Band (`_insSterne`, im SVG).
  Zwei Formen für dieselbe Zahl wären eine zu viel [§C27]; die Stelle ist
  verschieden, weil mit Band der Fuß der Raute gehört [§C30].
  Mit Band liegen sie auf einem **festen Radius** um die Reifmitte, nicht auf
  dem Zeichen und nicht je Stufe woanders. Sie standen im verkleinerten
  Kasten der Schwinge und landeten damit auf dem Kopf des Insigniums — Gold
  auf Gold, bei neun der fünfzehn Zeichnungen nicht mehr zu zählen.
  Feuer dahinter
  = laufende Siegesserie in drei Stufen (3–4, 5–6, ab 7), Stop-Motion ohne
  JS-Timer — und **nur dort**. Neben dem Namen steht allein die
  Niederlagenserie (`lossStreakInline`, ein bis drei Tropfen bei denselben
  Schwellen 3, 5, 7); für sie brennt am Avatar nichts. Die Siegesserie stand
  dort ein zweites Mal als Flammensymbol und sagte damit dieselbe Zahl in
  einer zweiten Bildsprache.
  Die kleinste Stufe kam in einer 52-px-Zeile keine sechs Pixel über den
  Reif und war auf dem Telefon ein warmer Hauch statt eines Feuers — drei
  Siege in Folge sind aber das, was die meisten überhaupt erreichen. Die
  Leiter beginnt deshalb eine Zeichnung höher und hat oben eine neue,
  größere. Wie weit eine Stufe schlagen darf, sagt `spitze`; sie ist **je
  Stufe** überschreibbar, weil der Deckel die unteren Stufen wirklich
  beschneidet und ein angehobener Deckel sie still hätte mitwachsen lassen.
  Im Profil trägt das Feuer die Rangfarbe. Über dem Zeichen hat der
  Profilkopf nur seinen Innenabstand, und `.pp-header` schneidet ab: für die
  brennenden Stufen rückt er nach unten (`--feuerluft`) — und nur für sie,
  damit neunzehn von zwanzig Profilen dafür nichts zahlen.
  Dieselbe Serie brennt auch in den Formpunkten (`.dot.glut`, `formDotsHtml`)
  — dort aber als zwei Pseudo-Elemente, nicht als SVG: sechzig gezeichnete
  Feuer auf einer Liste sind auf dem Telefon eine Zumutung. Der Punkt bleibt
  grün, die Flamme sitzt darüber.
- **§C33 Im Feed hat jeder ein Gesicht.** Jede Story, die einen Spieler
  nennt, zeigt ihn: ein Einzelner sein Wappen wie überall sonst [§C27], ein
  Duo zwei überlappende Chips. `_newsPids` sucht die Beteiligten in den über
  die Jahre gewachsenen `dataRef`-Feldern; `_newsGesichtHtml` zeichnet sie.
  Der Feed war die einzige Ansicht der App, in der ein Spieler nur ein Name
  war.
  Und er trug elf Kategoriefarben. Jetzt gilt auch hier das Farbgesetz:
  Gold für Titel und Rekorde (`breaking`, `highlight`, `badge`, `comeback`),
  Rot für die Richtung (`misfortune`), Metall für den Rest.
  Vier Regeln gegen Rauschen: **kein Story-Typ steht mehr als zweimal im
  Feed** (`_consolidateStories`, ausgenommen die seltenen Ereignisse),
  **keine zwei Karten tragen dieselbe Schlagzeile** oder **denselben Text**
  („Eine große Rivalität — die Liga liebt's" stand wortgleich unter zwei
  Karten und nannte keine einzige Zahl), und **keine zwei Karten derselben
  Sorte stehen direkt untereinander**. Getauscht wird dabei nur mit dem
  nächsten Nachbarn: der Feed bleibt chronologisch, die Wiederholung steht
  eine Position später.
  **Jedes Gesicht zählt gegen den Deckel**, nicht nur die Hauptfigur. Der
  Generator ließ drei Karten je `pid` zu, zählte aber nur diese eine — wer
  als Partner, Gegner oder Serienbrecher genannt wurde, stand daneben
  beliebig oft im Bild: gemessen auf neun von einunddreißig Karten, während
  ein anderer auf einer stand.

  **Die Ewige Tafel meldet sich.** Der ganze Awards-Reiter kam im Feed nicht
  vor: wer einen Liga-Rekord übernahm, eine Monatschronik holte oder eine
  Insignium-Stufe erreichte, erfuhr es nur, wenn er selbst nachsah. Die
  Kategorie `tafel` sammelt das. Quelle der Rekordmeldungen ist ein
  Zeitschnitt — `allChronicles(bisMs)` vor dem letzten Spieltag gegen heute;
  er kostet einmal ~18 ms und liegt danach im Cache.
  Drei Sorten, drei Aussagen: **erstmals vergeben** (den Rekord hatte vorher
  niemand), **übernommen** (der Halter wechselt) und **ausgebaut**. Das
  Ausbauen ist die schwächste davon und deshalb gedeckelt und an eine
  Bedingung geknüpft: gemeldet wird nur, wenn sich die **angezeigte** Zahl
  ändert. Ein Anteil rückt an fast jedem Spieltag um ein Tausendstel weiter,
  und das ergab neun Karten „X baut seinen Rekord aus" an einem Morgen, auf
  denen dieselbe Zahl stand wie vorher. Schattenseiten meldet der Feed gar
  nicht — die Liga liest ihn gemeinsam.
  Die Monatschronik ist EINE Karte je Monat, nicht eine je Eintrag; die drei
  mit den meisten Einträgen bekommen ihr Gesicht. Dazu eine eigene Karte für
  jeden, der **zum ersten Mal überhaupt** in der Chronik steht — der Moment,
  den ein Spieler aus der unteren Hälfte sonst nie im Feed sieht.

  **Breaking ist das Seltenste, nicht das Lauteste.** Erlaubt sind allein:
  ein legendäres Badge, ein neuer Allzeit-Elo-Rekord, die längste
  Siegesserie aller Zeiten, ein neuer Spitzenreiter, der feststehende
  Meister, ein zum ersten Mal vergebener Liga-Rekord und die beiden obersten
  Insignium-Stufen [§C30]. Gefallen ist `season_endgame`: „Noch fünf Tage"
  ist ein Countdown, kein Ereignis — und stand zeitweise als einzige
  Breaking-Karte im Feed.
  **Eine Karte über einen Spieler soll ihn belohnen.** „Henry gewinnt 39 %
  seiner Spiele" stand als Nachricht da und sagte ihrem Helden, dass er
  unterdurchschnittlich ist. Gesucht wird stattdessen die Kennzahl, in der
  er am weitesten vorne steht, und genannt wird sein Platz darin.

  **Wo ein Rückblick existiert, führt die Karte hin.** `showPotwRecap` und
  `showPotdRecap` sind gebaut und öffnen sich am richtigen Tag von selbst —
  vom Feed aus gab es keinen Weg dorthin, und wer die Karte drei Tage später
  las, kam an die Auswertung nicht mehr heran. Spieler der Woche, Spieler
  des Tages und Team der Woche tragen deshalb einen Knopf ins Blatt.
  Das **Team der Woche** rechnet mit `teamStatsFromMatches` — derselben
  Funktion, aus der auch der Teams-Tab seine Zahlen zieht [§C27]. Es gab
  Team-SERIEN und ein Team der Saison, aber nichts dazwischen. Für den TAG
  gibt es bewusst keins: eine Duo-Karte an jedem Spieltag wäre die
  Wiederholung, die §C33 gerade verhindert.
  `tests/ambient` misst das alles.
- **§C32 Ein Chronik-Eintrag gehört dem, der ihn hält.** Jeder Monatseintrag
  geht an den, der den Bestwert in diesem Monat wirklich hält — oder an
  niemanden. Halten ihn mehrere punktgleich, tragen ihn alle. Genau wie bei
  den Allzeit-Rekorden, und aus demselben Grund.
  Dass ein Spieler in der Chronik-Matrix trotzdem nur EINEN Eintrag je Monat
  zeigt, ist eine reine **Anzeige**-Regel: `seasonTitleOf` liefert den ersten
  in Katalogreihenfolge, und die Katalogreihenfolge ist die Wertigkeit. Die
  volle Tafel (`showSeasonTable`) zeigt alles.
  Vorher galt „ein Eintrag je Spieler" schon bei der Vergabe: wer den
  Bestwert hielt und schon etwas trug, gab ihn an den Nächstbesten ab. Damit
  stand „Der Unaufhaltsame" bei zwölf Siegen in Folge, während einer mit
  dreizehn danebensaß — und in den echten Daten ging ein Drittel aller
  Einträge an jemanden, der nicht der Beste war. Deshalb gibt es die
  Markierung `strict` nicht mehr: sie galt für vier von siebenundzwanzig
  Einträgen, und was für vier richtig ist, ist für alle richtig.
  Ein Monat unter `CHRONIK_MIN_TAGE` Spieltagen bekommt **gar keine**
  Chronik: aus drei Abenden lässt sich kein Monat ablesen.
- **§C31 Drei Rückblicke, ein Baukasten.** Saison, Woche und Tag bauen aus
  denselben Teilen (`05b-recap-teile.js`): `rcpKopfHtml`, `rcpHeldHtml`,
  `rcpZahlenHtml`, `rcpKachelHtml`, `rcpZeileHtml`, `rcpNotizHtml`,
  `rcpAbschnitt`. Wo die App das Bauteil schon hat, wird es benutzt [§C27]:
  das Podest des Saison-Rückblicks ist `.podest`/`.pod-karte` wie in der
  Ewigen Tafel, seine Rangliste ist `.rrow` wie im Liga-Tab.
  **Ein Gold je Blatt.** Die Marke im Kopf und der Sieger — sonst nichts.
  Kacheln und Zeilen sind Metall, Rot bleibt der Richtung [§C25]. Als acht
  Kacheln golden umrandet waren, sagte Gold nichts mehr, und der Sieger
  stach aus nichts mehr heraus.
  Der Saison-Rückblick hat **keine** Heldenkarte: das Podest IST der Held,
  eine Karte darüber sagte dasselbe ein zweites Mal. `rcpHeldHtml` gehört
  Woche und Tag; dort hat der Held kein Banner, weil eine Ligaposition mit
  einer Woche nichts zu tun hat.
  Ein Rückblick zeigt den Stand von DAMALS: `insigniumSvg` nimmt dafür
  `opt.titel` und `opt.pos` entgegen. Der Reif bleibt der heutige — die
  Laufbahn ist eine Karriere und kein Monat.
  Gestaltung gehört ins CSS: ein `style`-Attribut trägt einen berechneten
  Wert (Avatarfarbe, `--rav`, Farbton), nie ein ganzes Bauteil. Vorher
  standen Wochen- und Tages-Rückblick zu großen Teilen als Inline-Style im
  JavaScript, und derselbe Spieler sah in drei Rückblicken dreimal anders
  aus. `tests/tafel` misst beides.
- **§C30 Fünf Stufen, fünf Gegenstände.** Das Insignium hat fünf Stufen
  (`INSIGNIEN`), jede kostet doppelt so viel wie die vorige — 240, 720,
  1680, 3600 —, und jede ist ein eigener GEGENSTAND:
  **Reif** (das blanke Band, ab Grad II mit runden Nieten und einem zweiten
  Ring nach innen) · **Schildring** (Kartuschen quer auf dem Band, durch
  erhabene Stege zu einer Kette verbunden) · **Volutenkranz** (gespiegelte
  Schneckenpaare auf dem Reif, ein Stein am Ansatz, eine Perle im Auge) ·
  **Lorbeerreif** (zwei Zweige, unten zusammenlaufend, oben offen) ·
  **Ordensstern** (eine Glorie feiner Strahlen auf eigenem Kranzring, vier
  Bündel auf den Diagonalen, Steine, Perlenkranz, darüber die Krone).
  Zwischen zwei Schwellen liegen drei Grade (`INSIGNIUM_GRADE`, ausgebaut
  in `INSIGNIUM_AUSBAU`); der Grad baut den Gegenstand aus, die Stufe
  wechselt ihn.
  Vorher waren drei der fünf Stufen dasselbe Bild in anderer Dichte: acht,
  zwölf, sechzehn Zacken auf einem Kreis. Damit lässt sich keine Leiter
  erzählen — und **kein Körper läuft mehr spitz aus**. Wo doch etwas
  zuläuft, sitzt eine Perle darauf: die Zacken der Krone.
  **Oben und unten bleibt ein Platz frei.** Unten die Raute mit der
  Ligaposition (nur mit Band — in der Liste sitzen dort die Titelsterne
  [§C26]), oben der Kopf: ein Stein im Schildring, ab dem Volutenkranz die
  **Lilie**, im Ordensstern die **Krone**. Der Kopf sagt auf einen Blick,
  in welcher Hälfte der Leiter jemand steht. Deshalb steht in keiner Stufe
  ein Körper auf zwölf oder auf sechs Uhr.
  Der Kopf gehört zum Zeichen, die Sterne nicht: sie stehen in einem eigenen
  **Streifen darüber**, auf Radius 72, und die Bandbox reicht dafür sieben
  Einheiten weiter nach oben, als das Zeichen selbst braucht. Das größte
  Zeichen — die Glorie des Ordenssterns — füllt eine Scheibe von 65,6, also
  bleibt zwischen beiden Luft. Das kostet 4,9 % der Kachelhöhe nach oben,
  weniger als jede Karte dort an Innenabstand hat.
  **Jeder Körper hat zwei Flächen an einer harten Kante** — eine helle
  Hälfte, eine dunkle, dazu ein Lichtsteg auf dem Grat. Die Trennkante
  läuft immer durch die Achse des Körpers; schräg gelegt sähe jeder Körper
  aus, als stünde er anders im Licht als sein Nachbar.
  Unter dem Reif liegt die **Unterlage** — ein weicher Schatten, der ihn auf
  die Schwinge setzt. Sie muss über den ganzen Schmuck reichen, sonst laufen
  goldene Ranken und silberne Strahlen ineinander; sie ist deshalb eine
  ELLIPSE. Als Kreis mit demselben Radius ragte sie unten aus der Bandbox,
  und im Profilkopf stand quer unter dem Zeichen eine gerade Kante.
  **Die Verläufe gehören dem Dokument, nicht dem Zeichen.** Sie hängen nur am
  Metall des Rangs und am Glanz der Schwinge — nicht am Spieler, nicht an der
  Stufe. Sie stehen deshalb einmal in einem unsichtbaren `<svg id="insDefs">`
  am Rumpf der Seite, und jedes Wappen verweist nur darauf. Vorher trug jedes
  Wappen seine zwölf Gradienten selbst: das waren rund sechzig der
  siebenundneunzig Knoten eines Zeichens und im Awards-Tab 312 Gradienten für
  ein knappes Dutzend verschiedener Sätze. Der Topf steht **außerhalb von
  `#app` und des Blatts** — darin nähme ihn das nächste `render()` mit, und
  ein Verweis auf einen Verlauf, den es nicht gibt, wirft keinen Fehler: die
  Fläche wird schwarz. `tests/blatt` sieht nach jedem Zeichnen nach.
  Ausgenommen sind `insigniumStufeSvg` und `schwingeStufeSvg`: die elf
  Zeichnungen der Laufbahn tragen ihre Verläufe selbst, damit ein Ergebnis
  für sich steht und sich auch außerhalb des Dokuments rastern lässt — genau
  das tut `tests/zeichen`, wenn es die Leiter nachmisst.
  Dieselbe Zeichnung entsteht nur einmal: gleicher Rang, gleiche Stufe,
  gleiche Titelzahl heißt gleiches Wappen, und das Ergebnis wird gemerkt.

  Gemessen, nicht behauptet: `tests/zeichen` rastert alle fünfzehn
  Zeichnungen und zählt den **Schmuck** — die Bildpunkte, die ein Zeichen
  vom blanken Reif unterscheiden. Von Feld 1 bis 15 fällt er nie, und zwei
  Stufen stehen weiter auseinander als zwei Grade. Reine Deckung taugt
  dafür nicht: eine Niete liegt AUF dem Band und verdeckt keinen Bildpunkt
  zusätzlich, obwohl man sie sieht.
  Der Ordensstern hat keine Grade, er zählt Zacken und hört nicht auf: mit
  jeder Zacke wird die Glorie um vier Strahlen dichter. Länge und Breite
  der Strahlen sind gedeckelt — sonst spränge der Stern aus seiner
  Zeichenfläche.
  Die Laufbahn zeigt die Leiter als Vitrine (`.lb-karus`/`.lb-k`): eine
  Stufe groß in der Mitte, die übrigen schiebt man heran — **oder tippt sie
  an**. Wischen allein hat die letzte Stufe nie erreicht: der Blatt-Zug
  riss jede waagerechte Geste an sich, sobald sie zwölf Pixel nach unten
  driftete. Das ist repariert (`bindSheetSwipe` entscheidet die Richtung
  einmal je Berührung), aber ein Ziel tippt man ohnehin lieber an.
  `tests/blatt` misst beides.
- **§C36 Eine Schwinge, und nur eine.** Die **Rankenschwinge**
  (`INS_SCHWINGE`, `_insRanke`): jeder Stiel rollt sich am Ende zu einer
  Volute ein und trägt einen Knopf im Auge, die Blätter sitzen abwechselnd
  links und rechts, ab fünf Titeln Beeren in den Achseln. Es ist dieselbe
  Linie wie im Volutenkranz — `_insSpiral` zeichnet beide —, nur golden
  und länger. Damit sprechen Insignium und Schwinge dieselbe Sprache und
  sind trotzdem am Werkstoff zu unterscheiden.
  Sechs Ränge, der letzte **ab zehn Titeln**. Danach wächst die Schwinge
  nicht weiter, nur die Zahl neben den fünf Sternen [§C26]: eine Schwinge,
  die immer weiter wächst, sprengt jede Zeile; eine Ziffer kostet nichts.
  Es waren zwei Sternenbögen ab sechs Titeln und drei ab dreizehn. Drei
  Bögen brauchen vierzig Einheiten Luft über dem Zeichen — Platz, den
  neunzehn von zwanzig Spielern nie füllen und der jedem von ihnen die
  Kachel höher macht.
  Der Entwurf greift zweieinhalb Reifradien weit aus. In einer
  Ranglistenzeile misst der Reif 52 px, und ein Zeichen, das dreimal so
  breit ist wie die Zeile hoch, schiebt sich in die Nachbarspalten —
  deshalb nimmt `INS_SCHWINGE_SKALA` das Maß zurück. EIN Faktor, damit die
  Form nicht verzerrt.
  In der Laufbahn stehen ihre sechs Ränge als **zweite Leiter** unter der
  Vitrine (`schwingeStufeSvg`, `.lb-schwingen`): eine Zeile, klein, alle
  sechs in derselben Zeichenfläche (`INS_SCHWINGE_BOX`) — sonst wüchse in
  der Vorschau der Kasten mit und nicht die Schwinge. Klein ist Absicht:
  die Vitrine sammelt man Punkt für Punkt, die Schwinge gewinnt man, und
  zwei gleich laute Leitern auf einer Seite sind keine mehr.
- **§C34 Erworbenes wird addiert, Gehaltenes geteilt.** Das Prestige [§13.8]
  hat drei Quellen und ein Gesetz darüber: wer nichts falsch macht, verliert
  nichts — und wer mehr holt, bekommt mehr, nicht weniger.
  Auszeichnungen zählen nach ihrer Seltenheitsklasse (`PRESTIGE_KLASSE`),
  Monatswertungen nach ihrer Art (`PRESTIGE_MONAT`), beide **voll und
  einzeln addiert**. Nur Liga-Rekorde werden geteilt: durch die Zahl ihrer
  heutigen Halter und danach nach dem Gesetz der fallenden Erträge (der n-te
  zählt 1/√n). Sie sind eine Behauptung über HEUTE und dürfen wechseln.
  Zwei Fehler steckten vorher darin, beide gemessen. Erstens hing der Wert
  einer Auszeichnung an der Zahl ihrer heutigen Halter, und die wächst,
  während die Liga altert: Henry stand im Mai bei 197 Punkten aus
  Auszeichnungen und im August bei 63 — er hatte in der Zwischenzeit welche
  dazugewonnen. Zweitens galt das Stapelgesetz auch für Erworbenes, und dann
  war die fünfte legendäre Auszeichnung ein Viertel der ersten wert: Martin
  bekam für „Meister der Saison" 36,8 Punkte, weil er schon vier andere
  hielt. Beides bestraft genau den, der viel erreicht.
  Wiederholung zählt nur, wo sie etwas heißt: eine **Würde** (`BADGE_WUERDE`
  — höchstens einmal je Saison und am Können gemessen: Meister, Team der
  Saison, Vize, Dominator, Award-Sammler) zählt jedes Mal neu und jedes Mal
  voll, alles andere genau einmal. Der dreißigste Zittersieg zeigt nichts
  Neues; der dritte Meistertitel ist keinen Deut leichter als der erste.
  Weil nichts mehr gestapelt wird, tragen `PRESTIGE_KLASSE`,
  `PRESTIGE_MONAT` und `PRESTIGE_REKORD` die ganze Balance allein. Sie sind
  gegeneinander kalibriert; `tests/disziplinen` spielt die Liga dafür Monat
  für Monat nach.
  Die Seltenheitsklasse (`BADGE_RARITY`) sagt, wie schwer eine Auszeichnung
  zu HOLEN ist. Die Halterzahl ist die Gegenprobe, nicht die Definition: die
  zehn legendären halten null bis fünf der zwölf Spieler, die vierzehn
  seltenen null bis neun, die achtzehn gewöhnlichen sechs bis zwölf. Oben
  überlappen sie, weil eine Würde je Saison neu zu holen ist.
  Gold gehört nicht der Anwesenheit: „Urgestein" (300 Matches) und
  „Siegermaschine" (300 Siege) trugen als legendär denselben goldenen Rahmen
  wie „Meister der Saison", hängen aber an nichts als der Spielzahl. Umgekehrt
  sind „Mauer" und „Player of the Day" selten und nicht gewöhnlich: sie
  belohnen den Vielspieler, aber sie sind besonderer als jedes Common. Wer
  eine Klasse verschiebt, verschiebt Prestige — und zieht `RARITY_META.total`
  mit [§10.1].

- **§C35 Nicht jeder Eintrag darf am Können hängen.** Wer besser spielt,
  gewinnt jede Quote und jede Serie — am Ende liegen alle Liga-Einträge bei
  denselben drei Spielern. Zweiundzwanzig von sechsunddreißig Rekorden
  fragten direkt nach Können, und drei Spieler hielten vierundzwanzig der
  achtunddreißig Haltungen.
  Dagegen steht die Kammer der **Fügungen**: Einträge, die von der Auslosung
  und vom letzten Ball entschieden werden. Sie tragen `zufall` im Katalog,
  stehen als `ereignis` da und wiegen fürs Prestige damit halb so viel wie
  ein Beleg für eine Fähigkeit [§C34] — sie sollen jemandem gehören können,
  nicht jemanden auszeichnen.
  `zufall` sagt zugleich, WIE gemessen wird, und das entscheidet über die
  Zusicherung:
  **`'quote'`** mittelt über eine Laufbahn oder einen Abend („Der schwerste
  Abend", „Die bitterste Pleite", „Der Wiedergänger", „Das Nadelöhr", dazu
  die drei alten). Sie muss erreichbar sein: mindestens die halbe Liga steht
  im Rennen, und vergeben ist sie auch.
  **`'fund'`** ist ein einzelnes Zusammentreffen („Die Punktlandung", „Die
  Achterbahn", „Die kalte Dusche"). Es darf selten sein und sogar unbesetzt
  bleiben — sonst wäre es keins; höchstens die Hälfte der Funde darf leer
  stehen. Eine Quotenschwelle darauf anzuwenden hieße, das Seltene
  abzuschaffen.
  Über beide hinweg gilt: mindestens eine gehört der unteren Hälfte der
  Siegquote, und die drei Besten halten höchstens die Hälfte der Kammer.
  Ohne das hätte man zehn Einträge dazugebaut und nichts verändert.
  Jeder gewertete Spieler trägt mindestens einen Liga-Eintrag.
  `tests/disziplinen` misst das alles nach.
  Was **nicht** in die Kammer gehört: acht Rekorde, die einen Nachbarn
  doppelten — „Der Wochenkönig" neben „Der Platzhirsch", „Der Vollstrecker"
  neben „Der Zerstörer", „Der perfekte Abend" neben „Der makellose Tag".
  Dieselbe Frage in einem anderen Zeitfenster sammelt sich beim selben
  Halter. Vier von ihnen behalten ihre Monatswertung und verlieren nur den
  Liga-Rekord; vier gibt es nicht mehr.
  Billig dürfen Fügungen trotzdem nicht sein: eine Bestmarke, die jeder
  geschenkt bekommt, ist keine mehr.
  Und gemessen wird überall der **Anteil**, nicht die Anzahl — sonst hält den
  Rekord, wer am meisten spielt. Der Beleg muss das auch sagen: er beginnt
  mit dem Wert, nach dem sortiert wird, und nennt die Anzahl erst dahinter.
  „32 seiner 134 Siege waren Kantersiege" las sich als Bestenliste der
  Anzahl, und das Podest zeigte genau diese 32 über der 10 des Spielers, der
  den höheren Anteil hält.
- **Detail folgt der Größe.** Unter 26 px weder Sterne noch Feuer, unter
  etwa 48 px kein Wappen — darunter bleibt vom Gesicht ein Punkt.
- **Ein Duo hat keinen Rang**, also auch kein Wappen: zwei überlappende
  Chips. (Nebeneffekt: 62 Wappen in einer Duo-Tabelle waren eine
  Viertelmillion Zeichen HTML.)
- **Nichts sagt zweimal dasselbe.** Steht eine Zahl schon in der Tabelle,
  gehört sie nicht noch einmal in eine Karte darüber.
- **Keine persönliche Ansprache** in der Oberfläche („du", „meine").
- **Ein leeres Feld liest sich als Fehler.** Nicht vergebene Auszeichnungen
  werden gestrichelt gezeigt, nicht halbdurchsichtig; eine ungerade Kachel
  nimmt die ganze Reihe statt ein Loch zu lassen.

> **Pflegepflicht.** Wird ein Gesetz ergänzt, geändert oder aufgehoben,
> steht das hier — und der Kommentar im Code, der es zitiert, wird
> mitgezogen. Ein Kürzel, das nur noch an einer Stelle steht, ist tot.

---

## 7. Sprache, Ton, Commits

- Oberfläche, Kommentare und Commit-Nachrichten auf **Deutsch**.
- Kommentare erklären das **Warum** und benennen den Fehler, den sie
  verhindern — nicht, was die Zeile tut. Vorbild ist der Bestand.
- Nüchterner Ton, keine Ausrufezeichen, keine Werbesprache.
- Commit-Betreff ist ein Satz, der die Absicht nennt, nicht die Dateiliste
  („Das Feuer soll man sehen", nicht „update css").
- Im Fließtext des Commits steht, was vorher falsch war.
- **Kein Modellname** in Commit-Nachrichten, Code-Kommentaren, PR-Texten
  oder sonstigen Artefakten im Repository.
- Kein `node_modules/` und kein `package-lock.json` einchecken.

---

## 8. Vor dem Anfangen

1. `ARCHITEKTUR.md` lesen.
2. Die Datei, die du ändern willst, **ganz** lesen. Viele Kommentare halten
   Entscheidungen fest, die schon einmal rückgängig gemacht wurden.
3. Prüfen, ob es das Bauteil schon gibt (§C27), bevor du ein neues baust.
4. `node tools/check.mjs` einmal laufen lassen, bevor du etwas änderst —
   dann weißt du, ob ein rotes Ergebnis von dir kommt.

---

## 9. Arbeit mit mehreren Agenten

Die App ist eine IIFE mit gemeinsamem Namensraum, und der Bauablauf schreibt
in zwei Dateien, die allen gehören. Parallele Arbeit ist deshalb möglich,
aber nur nach festen Regeln.

### 9.1 Rollen

- **Ein Koordinator.** Nur er committet, pusht, schreibt `CLAUDE.md`,
  `ARCHITEKTUR.md` und führt den Bauablauf aus §1 aus.
- **Beliebig viele Zuarbeiter.** Sie lesen, suchen, messen, schlagen
  Änderungen vor und dürfen `src/`-Dateien bearbeiten, die ihnen **exklusiv**
  zugewiesen sind.

### 9.2 Was ein Zuarbeiter nie tut

- `tools/build.mjs` ausführen. Der Build schreibt `dist/index.html`; zwei
  gleichzeitige Läufe erzeugen eine Datei, die zu keinem Quellstand passt.
- `index.html` anfassen — auch nicht mit `cp`.
- `CLAUDE.md` oder `ARCHITEKTUR.md` schreiben. Er **meldet** stattdessen
  seinen Änderungsvorschlag als Text an den Koordinator (siehe 9.5).
- Committen oder pushen.
- Eine Datei bearbeiten, die einem anderen Zuarbeiter zugewiesen ist.

### 9.3 Aufteilung, die funktioniert

Schneide Aufgaben **entlang der Dateigrenzen**, nicht entlang der Features —
ein Feature liegt fast immer in mehreren Dateien, und zwei Agenten in
derselben Datei erzeugen Konflikte, die niemand sieht, bis der Build läuft.

Vor dem Start nennt der Koordinator je Zuarbeiter ausdrücklich:
die Dateien, die er ändern darf; die Dateien, die er nur lesen darf; und die
Zusicherung, an der seine Arbeit gemessen wird.

Zwei Dinge lassen sich nicht aufteilen und bleiben beim Koordinator:
**neue Bezeichner auf oberster Ebene** (Wächter 4 sieht nur das Ganze) und
**Änderungen an der CSS-Reihenfolge**.

### 9.4 Zusammenführen

Der Koordinator führt nach jeder Runde den vollständigen Ablauf aus §1 aus.
Er ist der einzige, der weiß, ob das Ganze noch stimmt: ein Zuarbeiter kann
seine Datei für sich fehlerfrei halten und trotzdem einen Namen doppelt
vergeben oder eine Klammer offen lassen.

Bei Rot wird **nicht** der Test angepasst, sondern der Zuarbeiter mit dem
Befund zurückgeschickt.

### 9.5 Meldepflicht für diese Datei

Jeder Zuarbeiter beendet seinen Bericht mit einem der beiden Sätze:

- `CLAUDE.md: keine Änderung nötig.`
- `CLAUDE.md: <Abschnitt> — <was genau geändert werden muss>.`

Der Koordinator arbeitet diese Meldungen ab, **bevor** er committet. Ein
Bericht ohne einen dieser beiden Sätze gilt als unvollständig und wird
zurückgegeben.

## 10. Etwas hinzufügen — und was daran hängt

Auszeichnungen, Monatswertungen und Liga-Rekorde sind nicht nur Listen. Sie
sind die **drei Quellen des Prestiges** [§C34], und das Prestige ist die
Insignium-Leiter. Wer einen Eintrag hinzufügt oder streicht, verschiebt
damit, wer welches Zeichen trägt — auch dann, wenn er die Prestige-Datei gar
nicht geöffnet hat.

Die folgenden Listen nennen jede Stelle, die mitgeht. Sie sind vollständig:
was hier nicht steht, hängt auch nicht daran.

### 10.1 Eine Auszeichnung (Badge)

Alles in `17-badges.js`, außer wo anders genannt.

| Stelle | was | wenn es fehlt |
|---|---|---|
| `BADGES[]` | Eintrag mit `id`, `ic`, `name`, `desc`, `count` | — |
| `BADGE_RARITY` | die Klasse | `rarityOf` liefert still `common`, die billigste — das Badge ist als „Legendary" gedacht und zählt wie ein Zittersieg |
| `RARITY_META.<klasse>.total` | um eins nach | der Zähler im Badge-Blatt („38 von 50") lügt |
| `BADGE_ART` | `leistung`, `pensum` oder `schatten` | es gilt `ereignis` — die Vorgabe, und für die meisten richtig |
| `BADGE_WUERDE` | **nur**, wenn höchstens einmal je Saison zu holen **und** am Können gemessen | nichts; wer aber eine beliebig oft holbare Auszeichnung einträgt, macht das Prestige wieder zur Anwesenheitsliste [§C34] |
| `getBadgeEarnedCache` | `fire('id')` | das Badge erscheint nur im Profil: kein Toast, kein Chip im Match-Review |
| `src/js/02-icons.js` | das Icon aus `ic` | die Kachel bleibt leer |

Die Reihenfolge in `BADGES[]` ist die Anzeige-Reihenfolge im zweispaltigen
Raster — je zwei Einträge sind eine Zeile.

### 10.2 Eine Disziplin (Monatswertung, Liga-Rekord oder beides)

| Stelle | was | wenn es fehlt |
|---|---|---|
| `32-chronik-katalog.js` `DISZIPLINEN[]` | Eintrag **im richtigen Block**: Leistung, dann Ereignis, dann Schatten | ein Spieler zeigt nur EINEN Monatseintrag, und die Katalogreihenfolge entscheidet welchen [§C32] — falsch einsortiert verdrängt eine Schattenseite seinen Titel |
| dort `art` | `leistung`, `ereignis` oder `schatten` — `pensum` gibt es nur bei Auszeichnungen | steuert den Prestige-Wert; ohne gültige Angabe fällt der Eintrag auf `ereignis` und wiegt die Hälfte. `tests/disziplinen` misst es |
| dort `short` | höchstens zehn Zeichen | die Chronik-Zelle bricht; `tests/disziplinen` misst es |
| dort `ic` | ein Icon, das keine andere Disziplin trägt | in einer Zelle von 62 Pixeln ist die Zeichnung das Erste, was man sieht — zwei gleiche sind dort nicht zu unterscheiden. `tests/disziplinen` misst es |
| dort `monat.wie` | ein Satz, was die Zahl im Beleg bedeutet | nur nötig, wenn die Größe nicht selbsterklärend ist. Er steht im Detail-Blatt unter der Bedingung; ohne ihn liest sich „+15 Prozentpunkte" wie Elo oder wie Prestige |
| `33-chronik-engine.js` `_seasonTitleCtx` | das Feld, das `monat:` liest | die Monatstafel bleibt leer |
| `34-chronik-rekorde.js` `_chronicleCtx` | **dasselbe Feld noch einmal** | der häufigste Fehler: die Monatstafel zeigt den Eintrag, der Liga-Rekord bleibt unbesetzt. Zwei getrennte Durchläufe über dieselbe Frage — sie müssen gleich zählen |
| dort `zufall` | `'quote'` oder `'fund'`, **nur** wenn der Eintrag kein Können misst | ohne ihn steht die Fügung in der Kammer „Bestmarken" neben dem höchsten Elo-Stand der Ligageschichte. Der Wert entscheidet, welche Zusicherung in `tests/disziplinen` für ihn gilt [§C35] |
| `allzeit.wie` | ein Satz, was die Zahl bedeutet | nur nötig, wenn die Größe nicht selbsterklärend ist. Er steht im Rekord-Blatt unter der Bedingung; ohne ihn liest sich „27 %" wie eine Siegquote |
| `allzeit.ev` | beginnt mit dem Wert, **nach dem sortiert wird** — die Anzahl steht dahinter | Podest und Verfolgerliste zeigen die erste Zahl des Belegs. Beginnt er mit der Anzahl, steht dort „34" über „10", obwohl der mit 10 den höheren Anteil hält. `tests/disziplinen` rechnet die erste Zahl gegen den Sortierwert zurück und lässt nur eine Umrechnung davon gelten |
| `src/js/02-icons.js` | das Icon aus `ic` | die Zeile bleibt ohne Zeichen |

Ein Eintrag darf **nur `allzeit`** haben, wenn ein Monat zu kurz ist, um die
Größe zu messen — so wie der Positionswert, der Erfahrung mitwiegt: über vier
Wochen entschiede die Spielzahl statt der Leistung. Dann entfällt der Eintrag
in `_seasonTitleCtx`, sonst nichts.

**Misst ein Eintrag etwas, das eine Ansicht schon zeigt, rechnet er es nicht
nach.** Der Positionswert steht an EINER Stelle (`posWert`, [§5.2]) und wird
von der Positions-Rangliste und vom Liga-Rekord darauf benutzt. Zwei
Rechnungen über dieselbe Frage nennen irgendwann zwei verschiedene Beste, und
dann steht in der Chronik ein anderer Name als über der Liste, auf der er ihn
geholt hat. `tests/disziplinen` legt beide nebeneinander.

Eine Disziplin zu **streichen** verändert nur die Zukunft: abgeschlossene
Monate stehen vollständig eingefroren in `seasons.titles` und zeigen weiter,
was damals galt.

Soll der Eintrag ausdrücklich kein Können messen, gilt zusätzlich §C35 — er
wird `ereignis`, und beide Bedingungen dort werden nachgemessen.

### 10.3 Die Balance nachziehen

Der Teil, den man vergisst. Ein neuer Eintrag ist neues Prestige für jeden,
der ihn hält — und für sonst niemanden.

1. **Die Seltenheitsklasse ist eine Messung, keine Absicht.** Sie behauptet,
   wie viele der Spieler das Badge halten [§C34]. Erst zählen, dann
   eintragen: ein „Legendary", das neun von zwölf tragen, ist die teuerste
   Klasse für den häufigsten Eintrag.
2. **`PRESTIGE_KLASSE`, `PRESTIGE_MONAT`, `PRESTIGE_REKORD` bleiben, solange
   das Verhältnis der drei Quellen stimmt.** Sie sind gegeneinander
   kalibriert; wer an einer dreht, dreht an allen dreien.
3. **Die Schwellen in `INSIGNIEN` folgen der Verdopplungsregel** [§C30].
   Kommen viele Einträge dazu, wandert die Spitze nach oben — dann steigen
   die Schwellen, nicht die Erwartung.

Nichts davon wird geschätzt. `tests/disziplinen` misst es an den echten
Partien und fällt, wenn es kippt:

| Zusicherung | fällt, wenn |
|---|---|
| kein Block stellt mehr als die Hälfte des Prestiges | eine Quelle die anderen erdrückt |
| Auszeichnungen wiegen schwerer als Rekorde | der Reif zur Rekordanzeige wird |
| mehr als die halbe Liga hält einen wertenden Rekord | die Einstiegshürden zu hoch sind |
| mehr als die halbe Liga trägt mindestens den Schildring | die erste Sprosse zu hoch hängt |
| der Beste trägt noch keinen Lorbeerreif | der Katalog die Spitze nach oben schiebt |
| der Ordensstern ist von niemandem erreicht | dasselbe, eine Stufe höher |
| jede Stufe kostet mindestens das Doppelte der vorigen | die Verdopplungsregel still aufgegeben wird |
| Prestige aus Auszeichnungen und Monaten fällt nie | ein Wert wieder am heutigen Zensus hängt [§C34] |
| jede Klasse zählt so viele Badges wie `RARITY_META` behauptet | ein Badge dazukommt oder wegfällt und der Zähler stehen bleibt |

Ein roter Wert dieser Art ist eine **Antwort**, keine Störung: er nennt die
Zahl, die nachgezogen werden muss. Angepasst wird die Zusicherung nur, wenn
sich die Absicht geändert hat — nicht, damit sie wieder grün ist.

---

## Pflege dieser Datei

Diese Datei ist die erste, die eine neue Sitzung liest. Was hier falsch
steht, wird geglaubt — eine veraltete Arbeitsanweisung ist schlimmer als
keine.

### Wann sie geändert wird

Immer im **selben Commit** wie die Änderung, die sie auslöst:

| Auslöser | zu ändern |
|---|---|
| Datei in `src/` kommt dazu, fällt weg, wird umbenannt | §2 Baum, §3 Landkarte |
| Schritt im Bauablauf kommt dazu oder fällt weg | §1 |
| Wächter kommt dazu oder ändert seine Bedeutung | §4 |
| Datei in `src/js/` kommt dazu | §3 Landkarte — Wächter 6 besteht darauf |
| Testsuite kommt dazu; Zahl der Checks ändert sich | §5 Tabelle |
| Zahl der Bezeichner ändert sich | §2, letzter Absatz |
| Gestaltungsgesetz kommt dazu, ändert sich, fällt weg | §6 |
| Zustandsvariable kommt dazu oder ändert ihr Zurücksetzen | §3 Zustand |
| Zeitgeber kommt dazu oder ändert seine Bedingung | §3 Takt |
| Gemeinsames Bauteil kommt dazu (`.rav`, `.podest`, …) | §6 §C27 |
| Regel für Agenten ändert sich | §9 |
| Auszeichnung, Disziplin oder Prestige-Konstante ändert sich | §10 |
| Eine Anweisung hier hat sich als falsch erwiesen | die Stelle selbst |

### Wie sie geändert wird

1. **Ersetzen, nicht anhängen.** Kein Änderungsjournal, keine „siehe auch
   neu"-Absätze. Wer eine Regel ändert, überschreibt die alte.
2. **Nur, was zutrifft.** Keine Absicht, keine Planung, keine Vermutung —
   nur der Stand, wie er jetzt ist. Was noch nicht gebaut ist, steht nicht
   hier.
3. **Nichts, was von selbst veraltet.** Keine Zeilenzahlen, keine
   Dateigrößen, keine Datumsangaben. Zahlen, die trotzdem hier stehen
   (Dateizahl, Bezeichnerzahl, Checks je Suite), stehen an genau einer
   Stelle und werden dort nachgezogen.
4. **Jede Regel nennt ihren Grund.** Eine Anweisung ohne Begründung wird
   beim nächsten Zweifel übergangen.
5. **Kürzen, wenn möglich.** Eine Regel, die nirgends mehr greift, wird
   gelöscht, nicht als „historisch" markiert.

### Prüfung vor dem Commit

Der Koordinator beantwortet drei Fragen, bevor er committet:

1. Stimmt jede Zahl in dieser Datei noch mit dem letzten Lauf von
   `tools/check.mjs` und `tests/run.mjs` überein?
2. Nennt §2 und §3 jede Datei, die es in `src/` gibt — und keine, die es
   nicht gibt?
3. Steht in dieser Datei eine Anweisung, die ich in diesem Commit
   umgangen habe? Dann war entweder der Commit falsch oder die Anweisung.
   Beides wird jetzt entschieden, nicht später.
