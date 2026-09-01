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
4. node tools/check.mjs            → vier Wächter, alle müssen grün sein
5. node tests/run.mjs              → sechs Suiten, alle müssen grün sein
6. committen (deutsche Nachricht, siehe §7)
```

Wächter 1 heißt „index.html entspricht src/" und schlägt genau dann an,
wenn Schritt 3 fehlt. Wer ihn rot sieht, hat fast immer nur das `cp`
vergessen — nicht die Quelle kaputtgemacht.

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
   einen Gültigkeitsbereich. Wächter 4 zählt sie (aktuell **553**).

---

## 3. Landkarte

Die Banner im Code (`[§C6]`, `[§11.7]`, `[§4.1b]`) sagen, wozu ein Block da
ist. Der Dateiname sagt, wo er liegt.

| Bereich | Dateien |
|---|---|
| Rahmen, Zustand, Daten | `00-prolog`, `01-update`, `04-cache`, `06-db`, `37-boot` |
| Rechnen | `05-rang-elo`, `08-stats`, `10-elo-engine`, `03-saison` |
| Ansichten | `11-view-ranking`, `12-view-positionen`, `13-view-awards`, `15-views-rest`, `18-profil`, `22-team-profil` |
| Blätter (Sheets) | `14-top5-listen`, `16-sheet-infra`, `21-head-to-head`, `19-bilanzen` |
| Rückblicke | `05b-recap-teile` (Baukasten), `06-db` (Saison), `07-positionsverlauf` (Woche, Tag) |
| Zeichen und Wappen | `09c-zeichen`, `35b-prestige`, `17-badges`, `17b-fingerabdruck` |
| News und Chronik | `26`–`31-news-*`, `32`–`35-chronik-*` |
| Bedienung | `09-ui-infra`, `20-bind`, `23-match-edit`, `24-lock`, `25-helpers`, `36-backup` |

Bewusst **keine** Zeilenzahlen hier: die veralten bei jeder Änderung.
`wc -l src/js/* src/css/*` beantwortet das in einer Sekunde.

### Zustand

Der veränderliche Zustand der Oberfläche steht gesammelt in
`src/js/01-update.js` (`tab`, `period`, `ligaSeasonId`, `ligaSicht`,
`awView`, `awPeriod`, `awSeasonId`, `rankMetric`, …). Neue Zustandsvariablen
gehören dorthin und nirgendwo anders, und sie brauchen einen Rücksetzpunkt:
`09-ui-infra.js` (Tabwechsel), `20-bind.js` (Zeitraumwechsel) und
`24-lock.js` (Klick aufs Logo) setzen zurück.

`ligaSeasonId` gilt **nur** für den Liga-Tab — Awards, News und Ambient
rechnen weiter mit `currentSeason()`. Sie wird beim Tabwechsel UND beim
Zeitraumwechsel geleert: die gewählte Saison gehört zur Ansicht „Saison",
und die Saison-Tools darunter (Recap, Positionsverlauf) folgen ihr.

> **Pflegepflicht.** Kommt eine Zustandsvariable dazu, wird sie hier genannt
> und ihr Rücksetzverhalten beschrieben.

---

## 4. Die vier Wächter

| Wächter | fängt ab |
|---|---|
| Drift | `index.html` wurde direkt bearbeitet statt `src/` |
| Parser | Syntaxfehler an einer Dateigrenze — sonst erst im Browser sichtbar |
| CSS-Klammern | eine offene `{` am Dateiende frisst still die nächste Datei |
| Doppelte Namen | derselbe Bezeichner auf oberster Ebene in zwei Dateien |

---

## 5. Die Testsuiten

Geprüft wird immer das **gebaute** Ergebnis (`dist/index.html`), nie die
Quelle: nur so fällt auch ein Fehler auf, der erst beim Zusammensetzen
entsteht. Jede Suite ist ein eigener Prozess, weil die App eine IIFE mit
globalem Zustand ist.

| Suite | prüft | Checks |
|---|---|--:|
| `disziplinen` | Chronik-Katalog, Vergabe, Belege, Insignium-Leiter, Prestige, Rekordlage je Monat | 841 |
| `tafel` | Monatstafel, Liga-Ansichten, Rückblicke, Invarianten | 155 |
| `ambient` | die 10-/19-Uhr-Slots, Rückblicke, Breaking, der Feed | 83 |
| `zeichen` | Feuer, Sterne, Wappen, Insignium-Grade — **im echten Browser gemessen** | 58 |
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
- **§C27 Ein Bauteil, überall dasselbe.** Derselbe Spieler sieht in
  Rangliste, Podest, Awards und Profil gleich aus. Das Wappen ist `.rav`
  (`insAvWrap`), das Podest ist `.podest`/`.pod-karte`, die Segmentwähler
  sind `.ui-switch` (äußere Ebene, gerahmt) und `.ui-tabs` (innere Ebene,
  rahmenlos), das Rangabzeichen ist `.rangab` (`rankBadgeHtml`). Wer ein
  zweites Bauteil für dieselbe Aussage baut, hat einen Fehler gemacht.
  Der Saisonwähler (`.saisonwahl`, `saisonWaehlerHtml`) ist bewusst **keins**
  von beiden: er wählt weder Ansicht noch Filter, sondern den Zeitpunkt, von
  dem alles darunter handelt. Als `.ui-tabs` stand er zwischen zwei echten
  Reiterstreifen und war von ihnen nicht zu unterscheiden.
- **§C26 Das Zeichen.** Sterne unter dem Avatar = Ligatitel. Feuer dahinter
  = laufende Siegesserie in drei Stufen (3–4 Glut, 5–6 Flamme, ab 7 Lodern),
  Stop-Motion ohne JS-Timer. Im Profil trägt das Feuer die Rangfarbe.
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
  Zwei Regeln gegen Rauschen: **kein Story-Typ steht mehr als zweimal im
  Feed** (`_consolidateStories`, ausgenommen die seltenen Ereignisse), und
  **keine zwei Karten tragen dieselbe Schlagzeile** — „Siegesserie beendet"
  stand zweimal untereinander, seit dort der Name des Getroffenen steht,
  nicht mehr. `tests/ambient` misst alles vier.
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
- **§C30 Das Insignium wächst zweistufig.** Fünf Stufen (`INSIGNIEN`), und
  jede kostet doppelt so viel wie die vorige — 160, 480, 1120, 2400. Zwischen
  zwei Schwellen liegen drei Grade (`INSIGNIUM_GRADE`, ausgebaut in
  `INSIGNIUM_AUSBAU`). Ein Grad baut das EIGENE Element seiner Stufe aus —
  in der Anzahl **und** in der Tiefe: mehr Kerben und längere, mehr Strahlen
  und weitere, mehr Blätter und größere; der glatte Reif wächst nach innen,
  weil er außen zum Zahnkranz würde.
  Was ein Grad nie darf: sich das Zeichen einer anderen Stufe borgen. Ein
  Kerbring treibt keine Blätter aus. Daran bleibt die Stufe erkennbar, und
  nur deshalb darf ein Grad den Umriss überhaupt bewegen.
  Beides wird gemessen, nicht behauptet: `tests/zeichen` rastert jede der
  fünfzehn Zeichnungen auf 52 px und misst, wie weit sie um den Reif greift.
  Mehr Elemente allein zählen nicht — vierzig gegen achtzig Kerben gleicher
  Länge tauschen zwar acht Prozent der Bildpunkte, sehen aber aus wie
  dieselbe Riffelung. Und acht Nieten von 1,6 Einheiten sind auf einem
  Wappen dieser Größe vier Bildpunkte. Genau so war es vorher, und die
  halbe Leiter fühlte sich an wie Stillstand.
  Der Ordensstern hat keine Grade, er zählt Zacken und hört nicht auf. Die
  Laufbahn zeigt die Leiter als Vitrine (`.lb-karus`/`.lb-k`): eine Stufe
  groß in der Mitte, die übrigen schiebt man heran.
- **§C34 Erworbenes fällt nicht, Gehaltenes schon.** Das Prestige [§13.8]
  hat drei Quellen und ein Gesetz darüber: wer nichts falsch macht, verliert
  nichts. Auszeichnungen zählen nach ihrer Seltenheitsklasse
  (`PRESTIGE_KLASSE`), Monatswertungen nach ihrer Art — beides Zahlen, die
  sich ohne Zutun des Spielers nicht ändern. Nur Liga-Rekorde dürfen
  wechseln; sie sind eine Behauptung über HEUTE.
  Vorher hing der Wert an der Zahl der HEUTIGEN Halter, und die wächst,
  während die Liga altert: Henry stand nach dem Mai bei 197 Punkten aus
  Auszeichnungen und nach dem August bei 63 — er hatte in der Zwischenzeit
  welche dazugewonnen. Acht von zwölf Spielern liefen rückwärts.
  Wiederholung zählt nur, wo sie etwas heißt: eine **Würde**
  (`BADGE_WUERDE` — höchstens einmal je Saison und am Können gemessen:
  Meister, Team der Saison, Vize, Dominator, Award-Sammler) zählt jedes Mal
  neu mit langsam fallendem Ertrag, alles andere genau einmal. Der
  dreißigste Zittersieg zeigt nichts Neues.
  Darüber liegt dasselbe Gesetz, das die Rekorde schon immer tragen: der
  n-te Eintrag einer Quelle zählt 1/√n. Ohne das erdrücken fünfzig
  Auszeichnungen vier Monatswertungen, und der Sammler stünde über dem
  Meister. `tests/disziplinen` spielt die Liga dafür Monat für Monat nach.
  Die Seltenheitsklassen (`BADGE_RARITY`) sind deshalb selbst eine Messung:
  die zwölf legendären halten null bis drei der zwölf Spieler, die zehn
  seltenen zwei bis sechs, die zwanzig gewöhnlichen sechs bis zwölf. Wer
  eine Klasse verschiebt, verschiebt Prestige — und zieht
  `RARITY_META.total` mit.
- **§C35 Nicht jeder Eintrag darf am Können hängen.** Wer besser spielt,
  gewinnt jede Quote und jede Serie — am Ende liegen alle Liga-Einträge bei
  denselben drei Spielern. Drei Bestmarken messen deshalb Glück statt
  Können: „Das Sonntagskind" (der letzte Ball eines 10:9), „Das Wechselbad"
  (abwechselnd Sieg und Pleite) und „Der Sonntagsschuss" (ein Sieg gegen die
  Rechnung). Sie stehen als `ereignis` im Katalog und wiegen fürs Prestige
  damit halb so viel wie ein Beleg für eine Fähigkeit [§C34] — sie sollen
  jemandem gehören können, nicht jemanden auszeichnen.
  Zwei Bedingungen, beide gemessen: bei jedem ist mindestens die halbe Liga
  im Rennen, und mindestens einer gehört jemandem aus der unteren Hälfte der
  Siegquote. Ohne sie hielt Maxi nach 348 Partien keinen einzigen
  Liga-Eintrag; jetzt trägt jeder gewertete Spieler mindestens einen.
  `tests/disziplinen` zählt beides nach.
  Billig dürfen sie trotzdem nicht sein: eine Bestmarke, die jeder geschenkt
  bekommt, ist keine mehr.
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
| Testsuite kommt dazu; Zahl der Checks ändert sich | §5 Tabelle |
| Zahl der Bezeichner ändert sich | §2, letzter Absatz |
| Gestaltungsgesetz kommt dazu, ändert sich, fällt weg | §6 |
| Zustandsvariable kommt dazu oder ändert ihr Zurücksetzen | §3 Zustand |
| Gemeinsames Bauteil kommt dazu (`.rav`, `.podest`, …) | §6 §C27 |
| Regel für Agenten ändert sich | §9 |
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
