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
   einen Gültigkeitsbereich. Wächter 4 zählt sie (aktuell **574**).

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
| `disziplinen` | Chronik-Katalog, Vergabe, Belege, Insignium-Leiter, Prestige, Katalog-Karten, Rekordlage je Monat | 847 |
| `tafel` | Monatstafel, Liga-Ansichten, Rückblicke, Invarianten | 155 |
| `ambient` | die 10-/19-Uhr-Slots, Rückblicke, Breaking, der Feed | 83 |
| `zeichen` | Feuer, Sterne, Wappen, Insignium-Leiter — **im echten Browser gemessen** | 58 |
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
  Das Insignium hat drei Teile, die in jeder Stufe gleich aussehen: den
  **Reif** (`_insReif`), den **Kopf** auf zwölf Uhr und die **Raute** am
  Fuß (`_insFuss`) — daran bleibt die Familie erkennbar, auch wenn der
  Schmuck dazwischen vollständig wechselt [§C30].
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
  **Jeder Körper hat zwei Flächen an einer harten Kante** — eine helle
  Hälfte, eine dunkle, dazu ein Lichtsteg auf dem Grat. Die Trennkante
  läuft immer durch die Achse des Körpers; schräg gelegt sähe jeder Körper
  aus, als stünde er anders im Licht als sein Nachbar.
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
  Stufe groß in der Mitte, die übrigen schiebt man heran.
- **§C36 Eine Schwinge, und nur eine.** Die **Rankenschwinge**
  (`INS_SCHWINGE`, `_insRanke`): jeder Stiel rollt sich am Ende zu einer
  Volute ein und trägt einen Knopf im Auge, die Blätter sitzen abwechselnd
  links und rechts, ab fünf Titeln Beeren in den Achseln. Es ist dieselbe
  Linie wie im Volutenkranz — `_insSpiral` zeichnet beide —, nur golden
  und länger. Damit sprechen Insignium und Schwinge dieselbe Sprache und
  sind trotzdem am Werkstoff zu unterscheiden.
  Sechs Ränge, der letzte **ab zehn Titeln**. Danach wächst die Schwinge
  nicht weiter, nur die Sterne werden mehr (ab sechs in zwei Bögen, ab
  dreizehn in drei): eine Schwinge, die immer weiter wächst, sprengt jede
  Zeile; die Sterne kosten nichts.
  Der Entwurf greift zweieinhalb Reifradien weit aus. In einer
  Ranglistenzeile misst der Reif 52 px, und ein Zeichen, das dreimal so
  breit ist wie die Zeile hoch, schiebt sich in die Nachbarspalten —
  deshalb nimmt `INS_SCHWINGE_SKALA` das Maß zurück. EIN Faktor, damit die
  Form nicht verzerrt.
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
| `33-chronik-engine.js` `_seasonTitleCtx` | das Feld, das `monat:` liest | die Monatstafel bleibt leer |
| `34-chronik-rekorde.js` `_chronicleCtx` | **dasselbe Feld noch einmal** | der häufigste Fehler: die Monatstafel zeigt den Eintrag, der Liga-Rekord bleibt unbesetzt. Zwei getrennte Durchläufe über dieselbe Frage — sie müssen gleich zählen |
| `src/js/02-icons.js` | das Icon aus `ic` | die Zeile bleibt ohne Zeichen |

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
| Testsuite kommt dazu; Zahl der Checks ändert sich | §5 Tabelle |
| Zahl der Bezeichner ändert sich | §2, letzter Absatz |
| Gestaltungsgesetz kommt dazu, ändert sich, fällt weg | §6 |
| Zustandsvariable kommt dazu oder ändert ihr Zurücksetzen | §3 Zustand |
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
