// ╔═══ §13.8 ─── PRESTIGE & INSIGNIUM ──────────────────────────────────╗
//     Eine Zahl für eine ganze Laufbahn — und ein Zeichen dafür, das um
//     den Avatar liegt. Das Prestige ist KEINE zweite Rangliste: Elo sagt,
//     wie stark jemand gerade ist, Prestige sagt, was er über die Zeit
//     zusammengetragen hat.
//
//     EIN GESETZ ÜBER ALLEN: Wer nichts falsch macht, verliert nichts.
//     Erworbenes bleibt — Auszeichnungen und Monatswertungen können nur
//     dazukommen. Nur die Allzeitwertungen sind eine Aussage über HEUTE:
//     Wer einen Liga-Rekord abgibt, verliert seinen Anteil daran. „Ich
//     halte den Rekord" ist eine Behauptung in der Gegenwart; sie soll
//     nicht dadurch wahr bleiben, dass sie einmal wahr war.
//
//     Vorher galt das nur auf dem Papier. Der Wert eines Eintrags hing an
//     der Zahl seiner heutigen Halter, und die wächst, während die Liga
//     älter wird: Henry stand im Mai bei 197 Punkten aus Auszeichnungen
//     und im August bei 63 — er hatte in der Zwischenzeit welche DAZU
//     gewonnen. Acht von zwölf Spielern liefen rückwärts. Ein Fortschritt,
//     der zurückläuft, während man spielt, ist keiner.
//
//     DREI QUELLEN, und jede hat ihr eigenes Gesetz:
//
//     AUSZEICHNUNGEN [§7] — Wert aus der Seltenheitsklasse, die im Katalog
//     steht und im Badge-Blatt angezeigt wird. Sie ist eine Aussage über
//     die Schwierigkeit, nicht über den heutigen Zensus, und sie steht
//     schon jetzt an jedem Badge. Eine Auszeichnung, die als „Legendary"
//     ausgewiesen ist und drei Punkte bringt, weil inzwischen sechs
//     Spieler sie haben, widerspricht ihrer eigenen Anzeige.
//
//     MONATSWERTUNGEN — ein fester Grundwert nach Art. Ein Monatseintrag
//     ist jeden Monat neu zu holen; dass ihn im Mai einer und im August
//     vier getragen haben, ändert nichts daran, was der im Mai wert war.
//
//     ALLZEITWERTUNGEN — wie bisher: geteilt durch die Zahl der Halter,
//     mit fallenden Erträgen. Sie dürfen wechseln, dafür sind sie da.
//
//     WIEDERHOLUNG. Eine Würde, die höchstens EINMAL JE SAISON zu holen
//     ist und am Können hängt — Meister, Team der Saison, Vize, Dominator,
//     der Award-Sammler — zählt jedes Mal neu, mit langsam fallendem
//     Ertrag (n^-1/4: der fünfte Meistertitel bringt noch zwei Drittel des
//     ersten). Genau das ist der lange, gerade Weg für den, der gut
//     spielt: er kann jede Saison etwas holen, das ihn weiterbringt.
//     Alles andere zählt einmal — sonst gewönne, wer am meisten spielt.
//
//     ART SCHLÄGT ALLES. Ein seltenes Pensum ist trotzdem Pensum.
//     Leistung zählt doppelt, ein Ereignis einfach, eine Schattenseite gar
//     nicht — sie steht im Profil, aber sie zieht nichts ab und bringt
//     nichts ein. Wer schlecht spielt, verliert Elo; er soll nicht
//     zusätzlich am Prestige bluten.
//
//     DIE SCHWELLEN sind an den echten 466 Partien kalibriert [§13.9]:
//     nach vier Monaten Liga trägt niemand den Ordensstern, und der Beste
//     ist noch gut die Hälfte seines bisherigen Lebenswerks davon entfernt.
//     Danach hört es nicht auf: der Stern bekommt je ORDENSSTERN_SCHRITT
//     weiterer Punkte eine Zacke mehr. Es gibt immer einen nächsten
//     Schritt, ohne dass es eine sechste Stufe braucht.
// ╚═════════════════════════════════════════════════════════════════════════╝

// Was eine Art wert ist. Es geht um die Leistung, nicht um die Anwesenheit:
//   leistung — ein Können, das man wieder abrufen kann. Zählt doppelt.
//   ereignis — etwas ist passiert. Der Normalfall, auch ohne Eintrag.
//   pensum   — hängt nur an der Spielzahl. Zählt ein Viertel: wer oft da
//              ist, sammelt das nebenbei ein, ohne dafür besser zu sein.
//   schatten — die Kehrseite. Steht bewusst auf 0 und nicht auf minus.
const PRESTIGE_ART = {leistung:2, ereignis:1, pensum:0.25, schatten:0};

// Wie die vier Arten in der Aufschlüsselung heißen. Ohne Eintrag gilt
// `ereignis` — das ist der Normalfall.
const PRESTIGE_ART_NAME = {leistung:'Leistung', ereignis:'Ereignis',
                           pensum:'Pensum', schatten:'Schatten'};

// Was eine Auszeichnung wert ist — nach ihrer Seltenheitsklasse aus dem
// Badge-Katalog [§7.2], nicht nach der Zahl ihrer heutigen Halter. Die
// Klasse steht am Badge und wird dem Spieler angezeigt; sie ist damit die
// einzige Aussage über Seltenheit, die er überhaupt zu sehen bekommt.
// Gegengeprüft an den echten Daten: die zwölf legendären halten zwischen
// null und sechs Spieler, die vierzehn gewöhnlichen zwischen sechs und
// zwölf. Die Klassen stimmen, der Zensus war nur die falsche Achse.
// Negative Auszeichnungen stehen auf 0 und nicht auf minus — dieselbe
// Begründung wie bei `schatten`.
const PRESTIGE_KLASSE = {legendary:26, rare:10, common:3, negative:0};

// Grundwert einer Monatswertung, bevor die Art darauf wirkt. Ein
// Monatseintrag ist einmal im Monat zu holen und ligaweit einmalig — er
// liegt damit zwischen einer gewöhnlichen und einer legendären
// Auszeichnung.
const PRESTIGE_MONAT = 60;

// Grundwert einer Allzeitwertung, bevor Art und Halterzahl darauf wirken.
// Ein heute gehaltener Liga-Rekord wiegt deutlich schwerer als eine
// Auszeichnung — es gibt ihn nur einmal in der Liga.
const PRESTIGE_REKORD = 36;

// Wie nah ein Rekord sein muss, um noch als Ziel zu gelten: höchstens die
// Hälfte des Bestwerts entfernt. Darüber ist der Hinweis entmutigend
// statt hilfreich.
const PRESTIGE_REICHWEITE = 0.5;

// Die fünf Stufen. `min` ist die Schwelle, ab der die Stufe getragen wird.
//
// EINE REGEL: jede Stufe kostet doppelt so viel wie die vorige. 160, 320,
// 640, 1280 — daraus werden die Schwellen 160, 480, 1120, 2400.
//
// An den echten 466 Partien gemessen stehen damit vier Spieler auf dem Reif,
// fünf auf dem Schildring, drei auf dem Volutenkranz und niemand darüber. Der
// Beste der Liga hat nach vier Monaten gut ein Drittel des Weges zum
// Ordensstern hinter sich; die obere Hälfte der Leiter liegt vor ihm, und das
// soll sie auch. Wer oben ankommt, während die Liga noch jung ist, hat danach
// nichts mehr vor sich.
//
// Die Zahlen sind größer als vorher, weil eine Auszeichnung nicht mehr an
// Wert verliert, sobald ein Zweiter sie holt [§13.8]. Dieselben zwölf
// Spieler, dieselben Partien — nur zählt jetzt, was sie geholt haben, und
// nicht, wie viele es ihnen inzwischen gleichgetan haben.
//
// Die ERSTE Schwelle bleibt niedrig: sie sagt „du bist dabei", nicht „du bist
// gut". Acht von zwölf erreichen sie.
const INSIGNIEN = [
  {key:'reif',    name:'Reif',          min:0},
  {key:'schild',  name:'Schildring',    min:240},
  {key:'volute',  name:'Volutenkranz',  min:720},
  {key:'lorbeer', name:'Lorbeerreif',   min:1680},
  {key:'stern',   name:'Ordensstern',   min:3600},
];
// Innerhalb einer Stufe gibt es drei Grade. Ohne sie sind zwischen zwei
// Schwellen hunderte Punkte, in denen sich am Zeichen nichts tut — und je
// weiter oben, desto länger dauert das. Der Grad ändert die Form nur wenig:
// mehr Kerben, mehr Strahlen, mehr Blätter. Man sieht ihn, wenn man ihn
// sucht, und er verrät auf einen Blick, ob jemand gerade angekommen ist
// oder kurz vor der nächsten Stufe steht.
const INSIGNIUM_GRADE = 3;
const INSIGNIUM_GRAD_NAME = ['I', 'II', 'III'];

// ── Wie ein Grad seine Stufe ausbaut ────────────────────────────────
//     Vorher änderte ein Grad nur die ANZAHL der Elemente: 40, 60, 80
//     Kerben. Auf einem Wappen von 52 px ist das kein Unterschied, den
//     jemand sieht — die halbe Leiter fühlte sich an wie Stillstand.
//     Jetzt wächst mit jedem Grad auch die TIEFE des eigenen Elements:
//     die Kerben werden länger, die Strahlen reichen weiter, der Kranz
//     trägt größere Blätter.
//
//     Was ein Grad NICHT darf: den Gegenstand einer anderen Stufe borgen.
//     Ein Schildring treibt keine Blätter aus, ein Volutenkranz bekommt
//     keine Strahlen. Daran bleibt die Stufe erkennbar, und nur deshalb
//     lässt sich der Umriss überhaupt wachsen lassen [§C30]. tests/zeichen
//     misst, dass zwei Stufen weiter auseinanderstehen als zwei Grade.
//
//     Grad I ist absichtlich kleiner als der alte Einheitswert, Grad III
//     etwa so groß: die Spanne wächst nach unten, nicht nach außen. Sonst
//     stieße das Zeichen an den Rand seiner Zeichenfläche.
const INSIGNIUM_AUSBAU = {
  // Der glatte Reif wächst nicht nach außen — er würde sonst zum Zahnkranz.
  // Er bekommt Nieten, und die sind RUND: acht Rauten auf einem Ring sind
  // acht Spitzen, und Spitzen sind das eine, was diese Leiter nicht sein
  // soll.
  reif:    [{nieten:0,  innen:0},
            {nieten:8,  gr:1,    innen:1},
            {nieten:12, gr:1.25, innen:2}],
  // Die Kette wächst in der Zahl der Kartuschen, nicht in ihrer Größe: acht
  // große Plättchen deckten den halben Reif zu.
  schild:  [{schilde:4, aus:4.2, ein:3.0, hw:5.2, steg:1},
            {schilde:6, aus:4.6, ein:3.1, hw:4.7, steg:1, stein:1},
            {schilde:8, aus:5.0, ein:3.2, hw:4.2, steg:1, stein:1, kopf:1}],
  // Mehr Volutenpaare je Grad, dafür feinere. Kürzere Voluten hätten den
  // Umriss schrumpfen lassen — die dritte Stufe hätte im dritten Grad
  // KLEINER gewirkt als im ersten.
  volute:  [{paare:4, lang:24, dick:3.10, dreh:1.9, konsole:2.2, kopfR:2.4, lilGr:1.02},
            {paare:6, lang:24, dick:2.35, dreh:1.9, konsole:2.5, kopfR:2.7, lilGr:1.08},
            {paare:8, lang:24, dick:2.05, dreh:1.9, konsole:2.8, kopfR:3.0, lilGr:1.14}],
  lorbeer: [{blatt:8,  gr:1.18, kopfR:4.8, lilGr:1.20},
            {blatt:9,  gr:1.23, beeren:1, kopfR:5.2, lilGr:1.26},
            {blatt:11, gr:1.29, beeren:1, endraute:1, kopfR:5.6, lilGr:1.34}],
};
const ORDENSSTERN_START = 8;
const ORDENSSTERN_SCHRITT = 400;

// Die `art` eines Monatseintrags. Eingefrorene Monate können IDs tragen,
// die es im heutigen Katalog nicht mehr gibt — die galten damals und
// zählen als Ereignis weiter, statt rückwirkend zu verschwinden.
function _prestigeArtVon(titleId){
  const d = DISZIPLINEN.find(x => x.id === titleId);
  return d ? d.art : 'ereignis';
}

// EIN Durchlauf für die ganze Liga. Seltenheit lässt sich nicht für einen
// Spieler allein bestimmen, also wird immer die ganze Tabelle gerechnet
// und memoisiert — wie überall an matches.length + _cache.version gebunden.
function prestigeTabelle(){
  const key = matches.length + '_' + _cache.version;
  if(_cache._prestigeKey === key) return _cache._prestige;

  const aktive = (players || []).filter(p => p && !p.hidden);
  const gesamt = aktive.length || 1;

  // 1. Rohdaten je Spieler einsammeln.
  const roh = {};
  aktive.forEach(p => { roh[p.id] = {badges:[], monat:[], rekord:[]}; });

  // Auszeichnungen — mit ihrer Anzahl. Eine Würde zählt jedes Mal neu,
  // alles andere einmal; welche das sind, sagt BADGE_WUERDE [§7.2].
  aktive.forEach(p => {
    (getCachedBadges(p.id) || []).forEach(b => {
      roh[p.id].badges.push({id:b.id, name:b.name, n:Math.max(1, b.count || 1)});
    });
  });

  // Monatswertungen — die Chronik des Spielers, ein Eintrag je Monat.
  // Bewusst nicht jeder Bestwert, den er in dem Monat hielt: ein
  // dominanter Monat gewinnt acht Quoten auf einmal, und die sagen alle
  // dasselbe über denselben Monat. Gezählt wird, was in der Matrix steht
  // [§C32] — sonst stünde im Profil eine Zahl, die nirgends nachzuzählen ist.
  aktive.forEach(p => {
    (seasonTitleHistory(p.id) || []).forEach(r => {
      if(r.title) roh[p.id].monat.push(
        {id:r.title.titleId, name:r.title.name, label:r.label, sid:r.sid});
    });
  });

  // Allzeitwertungen — was jemand HEUTE hält.
  const A = allChronicles();
  const halterZahl = {};
  CHRONICLES.forEach(d => {
    const e = A.byId[d.id];
    if(!e) return;
    halterZahl[d.id] = e.pids.length;
    e.pids.forEach(pid => { if(roh[pid]) roh[pid].rekord.push({id:d.id, name:d.name, art:d.art}); });
  });

  // 2. Punkte.
  const out = {};
  aktive.forEach(p => {
    const r = roh[p.id];

    // Ein Gesetz für alle drei Quellen: der Wert eines Eintrags fällt nicht,
    // aber der n-te Eintrag trägt nur noch 1/√n zur Laufbahn bei. Ohne das
    // erdrücken die Auszeichnungen alles — es gibt fünfzig von ihnen und vier
    // Monate. Der Sammler stünde über dem Meister, und genau davon wollte
    // dieses System weg. Die Rekorde rechnen schon immer so.
    const stapel = (liste) => {
      let summe = 0;
      liste.sort((a, b) => b.p - a.p).forEach((q, i) => {
        q.voll = q.p;
        q.rang = i + 1;
        q.p = q.voll / Math.sqrt(i + 1);
        summe += q.p;
      });
      return summe;
    };
    // Erworbenes wird ADDIERT, nicht gestapelt. Was einmal geholt ist, behält
    // seinen Wert, auch wenn zehn weitere dazukommen.
    const summe = (liste) => liste.reduce((n, q) => { q.voll = q.p; return n + q.p; }, 0);

    // Auszeichnungen: Klasse × Art, voller Wert, jede einzeln.
    const az = [];
    r.badges.forEach(b => {
      const kl = rarityOf(b.id);
      const art = BADGE_ART[b.id] || 'ereignis';
      const einzeln = (PRESTIGE_KLASSE[kl] ?? 5) * (PRESTIGE_ART[art] ?? 1);
      if(einzeln <= 0) return;
      // Eine Würde zählt jedes Mal neu und jedes Mal VOLL; alles andere
      // einmal. Wer denselben Zittersieg zum dreißigsten Mal holt, hat nichts
      // Neues gezeigt — wer zum dritten Mal Meister wird, schon, und der
      // dritte Titel ist keinen Deut leichter als der erste.
      const wuerde = BADGE_WUERDE.has(b.id);
      const w = einzeln * (wuerde ? b.n : 1);
      az.push({q:'auszeichnung', id:b.id, name:b.name, p:w, klasse:kl, art,
               mal:b.n, wuerde, einzeln});
    });
    const pb = summe(az);

    // Monatswertungen: fester Grundwert nach Art, ebenfalls addiert.
    const mo = [];
    r.monat.slice().sort((a,b) => a.sid < b.sid ? -1 : a.sid > b.sid ? 1 : 0).forEach(m => {
      const art = _prestigeArtVon(m.id);
      const voll = PRESTIGE_MONAT * (PRESTIGE_ART[art] ?? 1);
      if(voll <= 0) return;
      mo.push({q:'monat', id:m.id, name:m.name, label:m.label, p:voll, art});
    });
    const pm = summe(mo);

    // Allzeitwertungen: ein geteilter Rekord zählt geteilt — und dann
    // dasselbe Gesetz wie überall.
    const re = [];
    r.rekord.forEach(x => {
      const voll = PRESTIGE_REKORD * (PRESTIGE_ART[x.art] ?? 1)
                 / Math.max(1, halterZahl[x.id] || 1);
      if(voll <= 0) return;
      re.push({q:'rekord', id:x.id, name:x.name, p:voll, art:x.art,
               halter:halterZahl[x.id] || 1});
    });
    const pr = stapel(re);

    const quellen = az.concat(mo, re);

    const punkte = Math.round(pb + pm + pr);
    out[p.id] = {
      pid:p.id, punkte,
      teile:{auszeichnung:Math.round(pb), monat:Math.round(pm), rekord:Math.round(pr)},
      zahlen:{auszeichnung:az.length, monat:mo.length, rekord:re.length},
      gesamt,
      quellen: quellen.sort((a,b) => b.p - a.p)
    };
  });

  const res = {byPid:out, gesamt, rang:Object.values(out).sort((a,b) => b.punkte - a.punkte).map(x => x.pid)};
  _cache._prestigeKey = key;
  _cache._prestige = res;
  return res;
}

// Der Stand eines Spielers, fertig zum Anzeigen.
function prestigeOf(pid){
  const T = prestigeTabelle();
  const e = T.byPid[pid];
  if(!e) return {punkte:0, stufe:0, insignie:INSIGNIEN[0], naechste:INSIGNIEN[1],
                 fehlt:INSIGNIEN[1].min, zacken:0, grad:0, teile:{auszeichnung:0,monat:0,rekord:0},
                 zahlen:{auszeichnung:0,monat:0,rekord:0}, quellen:[], platz:0, von:T.gesamt};
  let i = 0;
  while(i + 1 < INSIGNIEN.length && e.punkte >= INSIGNIEN[i + 1].min) i++;
  const letzte = i === INSIGNIEN.length - 1;
  // Der Grad ist das Drittel der Stufe, in dem jemand steht. Er wird nach
  // UNTEN begrenzt: die letzte Stufe hat kein Ende, dort zählen die Zacken.
  const spanne = letzte ? 0 : INSIGNIEN[i + 1].min - INSIGNIEN[i].min;
  return Object.assign({}, e, {
    stufe:i,
    insignie:INSIGNIEN[i],
    naechste: letzte ? null : INSIGNIEN[i + 1],
    fehlt: letzte ? 0 : INSIGNIEN[i + 1].min - e.punkte,
    grad: letzte ? 0 : Math.max(0, Math.min(INSIGNIUM_GRADE - 1,
      Math.floor((e.punkte - INSIGNIEN[i].min) / Math.max(1, spanne) * INSIGNIUM_GRADE))),
    // Auf der letzten Stufe wächst der Stern weiter, statt stehenzubleiben.
    zacken: letzte ? ORDENSSTERN_START + Math.floor((e.punkte - INSIGNIEN[i].min) / ORDENSSTERN_SCHRITT) : 0,
    naechsteZacke: letzte
      ? ORDENSSTERN_SCHRITT - ((e.punkte - INSIGNIEN[i].min) % ORDENSSTERN_SCHRITT) : 0,
    platz: T.rang.indexOf(pid) + 1,
    von: T.gesamt
  });
}

// ─── §13.9 Das Zeichen: Insignium und Titelband ──────────────────────
//     Drei Achsen, drei Aussagen, keine doppelt:
//
//     DER REIF um den Avatar ist das Prestige. Fünf Stufen, jede eine
//     eigene Form — glatt, gekerbt, bestrahlt, belaubt, besternt.
//     DAS METALL des Reifs ist der Rang: von stumpfem Grau bis Weißgold.
//     DAS TITELBAND ist die dritte Achse und die einzige in Gold: die
//     Schwinge geht mit jedem Meistertitel weiter auf, bei fünf kommt
//     die Krone. Der Schild darin trägt die Liga-Position — die Zahl,
//     die sich jede Woche ändert, gegenüber den Titeln, die bleiben.
//
//     Gold gibt es NUR im Titelband. Alles andere ist Metall.

// Wie oft jemand Meister war. Nur abgeschlossene Saisons — der laufende
// Monat ist noch nicht entschieden.
function meisterTitel(pid){
  const key = 'meister_' + pid + '_' + matches.length + '_' + _cache.version;
  if(!_cache._meister) _cache._meister = {};
  if(_cache._meister[key] != null) return _cache._meister[key];
  const cur = currentSeason().id;
  let n = 0;
  (allPastSeasons() || []).forEach(sid => {
    if(sid === cur) return;
    if(seasonChampion(sid) === pid) n++;
  });
  _cache._meister[key] = n;
  return n;
}

// Die aktuelle Position in der Liga — dieselbe Quelle wie die Krone des
// Meisters, damit Wappen und Krone einander nie widersprechen.
function ligaPosition(pid){
  try {
    const C = _seasonTitleCtx(currentSeason().id);
    // rankAll und nicht rank: die Position gilt ab der ersten Partie, die
    // Wertungsschwelle TITLE_MIN_GAMES gehört den Monatswertungen [§13.2].
    const i = (C.rankAll || C.rank || []).findIndex(r => r.id === pid);
    return i >= 0 ? i + 1 : 0;
  } catch(e){ return 0; }
}

/* ==INS-GRAFIK-START== */

// ─── §13.9 Das Zeichen ────────────────────────────────────────────────
//     FÜNF STUFEN, FÜNF GEGENSTÄNDE. Nicht fünfmal derselbe Ring mit mehr
//     Zacken daran: acht Zacken, zwölf Zacken, sechzehn Zacken sind
//     dreimal dasselbe Bild, nur feiner — damit lassen sich fünf Stufen
//     nicht auseinanderhalten. Die Stufe wechselt deshalb den Gegenstand,
//     der Grad baut ihn aus [§C30].
//
//     JEDER KÖRPER HAT ZWEI FLÄCHEN an einer harten Kante: eine helle und
//     eine dunkle Hälfte, dazu ein schmaler Lichtsteg auf dem Grat. Das
//     ist der Unterschied zwischen einem Dreieck und einem geschliffenen
//     Stück Metall. Die Trennkante läuft IMMER durch die Achse des
//     Körpers; läge sie schräg, sähe jeder Körper aus, als stünde er
//     anders im Licht als sein Nachbar.
//
//     OBEN UND UNTEN bleibt in allen fünfzehn Feldern ein Platz frei:
//     unten die Raute mit der Ligaposition, oben der Kopf — Stein, Lilie
//     oder Krone. Deshalb steht in keiner Stufe ein Körper auf zwölf oder
//     auf sechs Uhr.

// Zwei Farben mischen. Zu jedem Metall brauchen wir eine hellere Spitze
// und eine dunklere Tiefe — ohne Verlauf wirkt jede Fläche wie Papier.
function _insMix(hex, ziel, f){
  const a = hex.replace('#',''), b = ziel.replace('#','');
  let s = '#';
  for(let i = 0; i < 3; i++){
    const p = parseInt(a.substr(i*2,2),16), q = parseInt(b.substr(i*2,2),16);
    s += Math.round(p + (q - p) * f).toString(16).padStart(2,'0');
  }
  return s;
}
const _n = v => (Math.round(v * 10) / 10);

// Jede Zeichnung braucht eigene Verlaufs-IDs, sonst greift auf einer
// Seite mit mehreren Zeichen das erste <defs> für alle.
let _insLauf = 0;

const INS_R = 40;                    // Radius des Reifs
const INS_BREIT = 5.0;               // Breite des Bands
const INS_RA = INS_R + INS_BREIT / 2;  // Außenkante

const _insPt = (a, r) => [50 + Math.cos(a) * r, 50 + Math.sin(a) * r];
const _insK = ([x, y]) => _n(x) + ' ' + _n(y);
// Der Fuß bleibt unten frei: dort sitzt in jedem Feld die Raute. Bei
// gerader Zahl um einen halben Schritt versetzt, bei ungerader nicht — so
// fällt in beiden Fällen nichts auf +90 Grad.
const _insAng = (i, n) => -Math.PI/2 + (i + (n % 2 ? 0 : .5)) / n * Math.PI * 2;

// Viele kleine Kreise in EINEM Pfad. Perlen waren sonst je ein <circle>,
// und davon stehen zwanzig auf einem Zeichen und zwölf Zeichen in einer
// Rangliste.
function _insPunkte(liste, r){
  return liste.map(([x, y]) =>
    'M' + _n(x - r) + ' ' + _n(y) + 'a' + r + ' ' + r + ' 0 1 0 ' + (r*2) + ' 0'
    + 'a' + r + ' ' + r + ' 0 1 0 ' + (-r*2) + ' 0Z').join('');
}
function _insBogen(r, a0, a1){
  const [x0,y0] = _insPt(a0, r), [x1,y1] = _insPt(a1, r);
  return 'M' + _n(x0) + ' ' + _n(y0) + 'A' + _n(r) + ' ' + _n(r) + ' 0 '
       + ((a1 - a0) > Math.PI ? 1 : 0) + ' 1 ' + _n(x1) + ' ' + _n(y1);
}

// Metallfarbe je Rang. Von stumpf nach hell — und mit einem Hauch der
// Rangfarbe darin, damit Zeichen und Seite aus demselben Material sind.
// Ein Hauch, kein Anstrich: es bleibt Metall.
//
// Die LEGENDE bleibt bewusst Weissmetall. Ihre Rangfarbe ist Gold, und
// Gold gehört im Zeichen den Titeln: eine goldene Schwinge auf einem
// goldenen Reif ist keine Auszeichnung mehr, sondern ein Fleck.
const INS_METALL_ROH = {
  Einsteiger:'#606870', Solide:'#7D858D', Stark:'#9AA2AA',
  Elite:'#C2C9D0', Legende:'#EEF3F8',
};
const INS_RANGFARBE = {
  Einsteiger:'#ff7849', Solide:'#56b4e8', Stark:'#BEF264',
  Elite:'#a78bfa', Legende:'#f7cf4a',
};
const INS_METALL = {};
Object.keys(INS_METALL_ROH).forEach(k => {
  INS_METALL[k] = k === 'Legende' ? INS_METALL_ROH[k]
    : _insMix(INS_METALL_ROH[k], INS_RANGFARBE[k], .26);
});
// Die Rangfarbe als Ton [§13.1]: dieselbe Farbe, die der Rang in der
// Rangliste trägt — als Paar aus CSS-Farbe und rgb-Tripel für rgba().
// Sie ist der Anker des Farbgesetzes [§C25]: eine Seite, eine Farbe.
const RANG_TON = {Legende:'gold', Elite:'purple', Stark:'acid',
                  Solide:'blue', Einsteiger:'orange'};
function rangTon(pid){
  return titleTone(RANG_TON[(getPlayerRank(pid) || {}).label] || 'blue');
}

const INS_GOLD = '#E8C25E';
const INS_GOLD_TIEF = '#6E4A0E';     // die Trennkante zwischen zwei Blättern

// Der Farbsatz eines Zeichens. Alles rechnet sich aus dem Metall und der
// Rangfarbe des Trägers — es gibt keine zweite Stelle, an der eine Farbe
// des Zeichens steht.
function _insSatz(rang){
  const l = INS_METALL[rang] ? rang : 'Solide';
  const m = INS_METALL[l];
  return {m, rf:INS_RANGFARBE[l],
    hell:_insMix(m,'#FFFFFF',.70), tief:_insMix(m,'#05080B',.48),
    glanz:_insMix(m,'#FFFFFF',.96), kante:_insMix(m,'#05080B',.78), unter:'#04070A'};
}

function _insDefs(id, c, glanzGold){
  const gl = glanzGold === undefined ? .3 : glanzGold;
  const gHell = _insMix('#DFBE79', '#FFF9E2', gl);
  const gMitt = _insMix('#BE9034', '#F2CE72', gl);
  const gTief = _insMix('#6E4A0E', '#A97A1E', gl);
  const st = (o, col, op) => `<stop offset="${o}" stop-color="${col}"`
    + (op !== undefined ? ` stop-opacity="${op}"` : '') + `/>`;
  const lin = (nm, x1,y1,x2,y2, stops) =>
    `<linearGradient id="${id}${nm}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient>`;
  return `<defs>`
    + lin('gd', 0,0,'.2',1, st(0,gHell) + st('.28',_insMix(gHell,gMitt,.45)) + st('.62',gMitt) + st(1,gTief))
    + lin('gt', 0,0,'.2',1, st(0,_insMix(gMitt,gHell,.30)) + st('.48',gMitt) + st(1,_insMix(gTief,'#000000',.28)))
    // Der Reif: die Röhre. Licht oben links, Kern in der Mitte, tiefer
    // Schatten unten rechts. Ohne diesen Verlauf ist das Band ein Strich.
    + lin('mt', 0,0,'.30',1, st(0,c.glanz) + st('.22',c.hell) + st('.52',c.m)
        + st('.80',c.tief) + st(1,c.kante))
    // Die HELLE Hälfte eines Körpers und die DUNKLE. Zwei Verläufe, nicht
    // zwei Volltöne: eine flache dunkle Fläche neben einer flachen hellen
    // sieht aus wie Papier, nicht wie Metall.
    + lin('kp', 0,0,'.35',1, st(0,c.glanz) + st('.40',c.hell) + st(1,c.m))
    + lin('kt', 0,0,'.35',1, st(0,c.m) + st('.45',c.tief) + st(1,c.kante))
    + lin('bl', 0,0,1,'.30', st(0,_insMix(c.hell,'#FFFFFF',.35)) + st('.50',c.hell) + st(1,c.m))
    + lin('bt', 0,0,1,'.30', st(0,c.m) + st('.52',c.tief) + st(1,c.kante))
    // Die Rangfarbe als geschliffener Stein: hell an der Lichtkante, satt
    // in der Mitte, fast schwarz im Schatten.
    + lin('rg', 0,0,'.25',1, st(0,_insMix(c.rf,'#FFFFFF',.62)) + st('.34',_insMix(c.rf,'#FFFFFF',.15))
        + st('.72',c.rf) + st(1,_insMix(c.rf,'#000000',.52)))
    + lin('rt', 0,0,'.25',1, st(0,_insMix(c.rf,'#000000',.24)) + st('.55',_insMix(c.rf,'#000000',.52))
        + st(1,_insMix(c.rf,'#000000',.76)))
    // Der Schatten setzt das Zeichen AUF die Schwinge. Er muss über den
    // ganzen Schmuck reichen, nicht nur über den Reif: sonst laufen goldene
    // Ranken und silberne Strahlen ineinander, weil beide auf demselben
    // Radius liegen.
    // Er fängt aber früher an auszulaufen, als er es tat: mit einem harten
    // Kern über vier Fünfteln seiner Fläche stand im Profilkopf eine dunkle
    // Scheibe hinter dem Zeichen, und die war größer als das Zeichen selbst.
    + `<radialGradient id="${id}sd">`
      + st('.44','#000000','.58') + st('.74','#000000','.24') + st(1,'#000000','0') + `</radialGradient>`
    + `<radialGradient id="${id}gg">`
      + st(0,'#FFE9A8','.24') + st('.45','#E8C25E','.09') + st(1,'#E8C25E','0') + `</radialGradient>`
    + `<radialGradient id="${id}pl" cx=".38" cy=".32" r=".85">`
      + st(0,'#1e242b') + st('.55','#141920') + st(1,'#090d11') + `</radialGradient>`
    + `</defs>`;
}

// Die vier Flächen eines Steins, einmal in Rangfarbe und einmal in
// Metall. Ein flach gefärbtes Dreieck sieht neben geschliffenem Metall
// aus wie ein Aufkleber.
function _insAkzent(id, c){
  return {fill:`url(#${id}rg)`, tief:`url(#${id}rt)`,
    hell:_insMix(c.rf,'#FFFFFF',.52), mitt:c.rf,
    mitt2:_insMix(c.rf,'#000000',.42), kante:_insMix(c.rf,'#000000',.72)};
}
function _insStahl(id, c){
  return {fill:`url(#${id}kp)`, tief:`url(#${id}kt)`,
    hell:_insMix(c.m,'#FFFFFF',.72), mitt:c.hell, mitt2:c.m, kante:c.kante};
}

/* ── Die Bausteine ───────────────────────────────────────────────────
   Niete, Schild, Volute, Blatt, Strahl. Jeder liefert die helle Hälfte,
   die dunkle und den Lichtsteg. KEIN KÖRPER LÄUFT SPITZ AUS — wo doch
   etwas zuläuft, sitzt eine Perle darauf: die Zacken der Krone. */

// Nieten: runde Köpfe auf dem Band. Vorher waren es kleine Rauten — und
// acht Rauten auf einem Ring sind acht Spitzen, also genau das, was diese
// Leiter nicht sein soll. Ein Nietkopf kann gar nicht stechen.
function _insNieten(liste, r, c){
  return `<path d="${_insPunkte(liste, r)}" fill="${c.m}" stroke="${c.kante}"
      stroke-width=".55"/>`
    + `<path d="${_insPunkte(liste.map(([x,y]) => [x - r*.30, y - r*.30]), r*.42)}"
      fill="${c.glanz}" opacity=".70"/>`;
}

// Schild: ein gekapptes Achteck, das QUER auf dem Band liegt — die
// Kartusche einer Ordenskette. Außen weiter als innen: gleich weit nach
// beiden Seiten sah es aus wie eine Klammer, die den Reif greift, statt
// wie ein Plättchen, das auf ihm liegt.
function _insSchildchen(a, aus, ein, hw, ch){
  const [cx,cy] = _insPt(a, INS_R);
  const ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
  const P = (r,t) => [cx + ux*r + vx*t, cy + uy*r + vy*t];
  const seite = sp => 'M' + _insK(P(aus,0))
    + 'L' + _insK(P(aus, sp*(hw-ch))) + 'L' + _insK(P(aus-ch, sp*hw))
    + 'L' + _insK(P(-ein+ch*.7, sp*hw)) + 'L' + _insK(P(-ein, sp*(hw-ch*.7)))
    + 'L' + _insK(P(-ein,0)) + 'Z';
  return { h: seite(-1), d: seite(1),
    g: 'M' + _insK(P(aus-ch*.8, -hw*.26)) + 'L' + _insK(P(aus-ch*.8, -hw*.68))
       + 'L' + _insK(P(-ein+ch, -hw*.56)) + 'L' + _insK(P(-ein+ch, -hw*.22)) + 'Z' };
}

// Eine Bahn, deren Krümmung nach außen zunimmt: am Ansatz fast gerade, am
// Ende eine enge Schnecke. Aus ihr sind die Volutenpaare der dritten Stufe
// und die Ranken der Schwinge gemacht — dieselbe Linie, einmal auf dem
// Reif und einmal daneben.
//
// Mit den Kontrollpunkten einer Bézier ging das nicht: entweder wurde der
// Ansatz krumm oder die Schnecke ein Bogen. `spitz` sagt, WIE SPÄT die
// Bahn einbiegt — hoch heißt lange fast gerade, dann ein enger Haken.
function _insSpiral(sx, sy, th0, L, dreh, N, spitz){
  const ds = L/N, bahn = [], e = spitz || 2.1;
  let x = sx, y = sy, th = th0;
  for(let i = 0; i <= N; i++){
    bahn.push([x, y, th]);
    th += dreh * (0.16 + 3.9 * Math.pow(i/N, e)) / N;
    x += Math.cos(th)*ds; y += Math.sin(th)*ds;
  }
  return bahn;
}
// Aus der Bahn ein Band, das sich verjüngt. Als Strich gezeichnet war die
// Volute überall gleich dick und sah aus wie Draht.
function _insBand(bahn, w0, w1){
  const N = bahn.length - 1;
  let vor = ''; const zur = [];
  bahn.forEach(([px,py,pth], i) => {
    const w = w0 + (w1 - w0) * (i/N);
    const nx = -Math.sin(pth)*w, ny = Math.cos(pth)*w;
    vor += (i ? 'L' : 'M') + _n(px+nx) + ' ' + _n(py+ny);
    zur.push(_n(px-nx) + ' ' + _n(py-ny));
  });
  return vor + 'L' + zur.reverse().join('L') + 'Z';
}
// Dieselbe Bahn in zwei Hälften, geteilt durch ihre Achse. Als ganz helles
// und ganz dunkles Band nebeneinander sahen zwei gespiegelte Voluten aus
// wie zwei verschiedene Ornamente.
function _insBandHalb(bahn, w0, w1){
  const N = bahn.length - 1;
  const mitte = [], oben = [], unten = [];
  bahn.forEach(([px,py,pth], i) => {
    const w = w0 + (w1 - w0) * (i/N);
    const nx = -Math.sin(pth)*w, ny = Math.cos(pth)*w;
    mitte.push(_n(px) + ' ' + _n(py));
    oben.push(_n(px+nx) + ' ' + _n(py+ny));
    unten.push(_n(px-nx) + ' ' + _n(py-ny));
  });
  return { h: 'M' + oben.join('L') + 'L' + mitte.slice().reverse().join('L') + 'Z',
           d: 'M' + mitte.join('L') + 'L' + unten.slice().reverse().join('L') + 'Z', g: '' };
}

// Strahl: ein feiner, sich verjüngender Span mit GEKAPPTER Spitze. Die
// Glorie des Ordenssterns besteht aus vier Dutzend davon.
//
// Der Unterschied zur alten Zacke ist nicht die Form, sondern das
// Verhältnis: eine Zacke war so breit wie ein Lorbeerblatt und stand zu
// acht auf dem Reif — ein Sägeblatt. Ein Strahl ist ein Haarstrich und
// steht zu vierzig; vierzig Haarstriche sind Licht, keine Zacken.
function _insStrahl(a, r0, L, w){
  const F0 = _insPt(a - w, r0), F1 = _insPt(a + w, r0);
  const S0 = _insPt(a - w*.22, r0 + L), S1 = _insPt(a + w*.22, r0 + L);
  return 'M'+_insK(F0)+'L'+_insK(S0)+'L'+_insK(S1)+'L'+_insK(F1)+'Z';
}

// Lorbeerblatt: lanzettlich, an der Mittelrippe in zwei Hälften geteilt.
// Vorher war es eine gefüllte Ellipse mit einem Strich darin — das las
// sich auf 52 px als Wimper. Die Teilung in zwei Flächen ist es, die ein
// Blatt zum Blatt macht.
function _insLaub(x, y, dreh, L, W){
  const c = Math.cos(dreh), s = Math.sin(dreh);
  const P = (t, o) => [x + o*c + L*t*s, y + o*s - L*t*c];
  const seite = sp => 'M' + _insK(P(1,0))
    + 'C' + _insK(P(.62, sp*W*.82)) + ' ' + _insK(P(.06, sp*W)) + ' ' + _insK(P(-.42, sp*W*.56))
    + 'C' + _insK(P(-.76, sp*W*.28)) + ' ' + _insK(P(-.94, sp*W*.10)) + ' ' + _insK(P(-1,0)) + 'Z';
  return { h: seite(-1), d: seite(1),
           g: 'M' + _insK(P(.86,0)) + 'C' + _insK(P(.52,-W*.52)) + ' ' + _insK(P(.02,-W*.62))
              + ' ' + _insK(P(-.34,-W*.34)) + 'C' + _insK(P(-.04,-W*.14)) + ' ' + _insK(P(.44,-W*.10))
              + ' ' + _insK(P(.86,0)) + 'Z' };
}

// Eine Raute mit VIER Flächen statt zwei — erkennbar ein geschliffener
// Stein, kein Dreieckspaar.
function _insRaute(cx, cy, h, w, f){
  const T = [cx, cy - h], B = [cx, cy + h], L = [cx - w, cy], R = [cx + w, cy], M = [cx, cy];
  const p = (a,b) => 'M' + _insK(a) + 'L' + _insK(b) + 'L' + _insK(M) + 'Z';
  return `<path d="${p(T,L)}" fill="${f.hell}"/>`
    + `<path d="${p(T,R)}" fill="${f.mitt}"/>`
    + `<path d="${p(L,B)}" fill="${f.mitt2}"/>`
    + `<path d="${p(R,B)}" fill="${f.tief}"/>`
    + `<path d="M${_insK(T)}L${_insK(L)}L${_insK(B)}L${_insK(R)}Z" fill="none"
      stroke="${f.kante}" stroke-width=".5" stroke-linejoin="round"/>`;
}

// Die Krone über dem Ordensstern: fünf Zacken auf einem Reif, jede mit
// einer Perle darauf, dazu ein Stein in der Mitte des Reifs. Die Perlen
// sind kein Schmuck, sondern der Grund, warum die Zacken nicht stechen.
function _insKrone(r0, gr, akz, c){
  const [cx,cy] = _insPt(-Math.PI/2, r0);
  const b = 8.6*gr, h = 8.4*gr, sb = 2.6*gr;
  const X = t => cx + t*b, Y = t => cy - t*h;
  const zack = [[-.86,.52],[-.44,.80],[0,1],[.44,.80],[.86,.52]];
  let d = 'M' + _n(X(-1)) + ' ' + _n(cy);
  zack.forEach(([t,hh], i) => {
    if(i) d += 'L' + _n(X((zack[i-1][0]+t)/2)) + ' ' + _n(Y(hh*.16));
    d += 'L' + _n(X(t)) + ' ' + _n(Y(hh));
  });
  d += 'L' + _n(X(1)) + ' ' + _n(cy) + 'Z';
  return `<path d="${d}" fill="${akz.fill}" stroke="${akz.kante}"
      stroke-width=".45" stroke-linejoin="round"/>`
    + `<path d="M${_n(X(-1.06))} ${_n(cy)}H${_n(X(1.06))}V${_n(cy + sb)}H${_n(X(-1.06))}Z"
      fill="${akz.tief}" stroke="${akz.kante}" stroke-width=".45" stroke-linejoin="round"/>`
    + `<path d="${_insPunkte(zack.map(([t,hh]) => [X(t), Y(hh) - .3*gr]), 1.5*gr)}"
      fill="${c.hell}" stroke="${c.kante}" stroke-width=".45"/>`
    + _insRaute(cx, cy + sb*.5, 2.2*gr, 1.6*gr, c.metallStein);
}

// Die Lilie auf zwölf Uhr. Ab der dritten Stufe steht sie dort, wo darunter
// nur ein Stein sitzt: drei Blätter auf einem Band. Sie ist der Kopf des
// Zeichens und der Gegenpol zur Raute am Fuß — und sie sagt auf einen
// Blick, dass hier die obere Hälfte der Leiter beginnt.
function _insLilie(r0, gr, akz){
  const [cx,cy] = _insPt(-Math.PI/2, r0);
  const w = 5.0*gr, h = 8.6*gr;
  const P = (x,y) => _n(cx + x*w) + ' ' + _n(cy - y*h);
  const mitte = 'M' + P(0,1) + 'C' + P(.40,.56) + ' ' + P(.30,.24) + ' ' + P(.26,.02)
    + 'L' + P(-.26,.02) + 'C' + P(-.30,.24) + ' ' + P(-.40,.56) + ' ' + P(0,1) + 'Z';
  const seite = sp => 'M' + P(sp*.24,.30) + 'C' + P(sp*.86,.44) + ' ' + P(sp*1.02,.04)
    + ' ' + P(sp*.66,-.34) + 'C' + P(sp*.92,.02) + ' ' + P(sp*.62,.10) + ' ' + P(sp*.24,.04) + 'Z';
  const fuss = 'M' + P(-.20,-.18) + 'C' + P(-.30,-.46) + ' ' + P(-.16,-.66) + ' ' + P(0,-.72)
    + 'C' + P(.16,-.66) + ' ' + P(.30,-.46) + ' ' + P(.20,-.18) + 'Z';
  return `<path d="${mitte + seite(1) + seite(-1) + fuss}" fill="${akz.fill}"
      stroke="${akz.kante}" stroke-width=".45" stroke-linejoin="round"/>`
    + `<path d="M${P(-.54,.06)}L${P(.54,.06)}L${P(.54,-.16)}L${P(-.54,-.16)}Z"
      fill="${akz.tief}" stroke="${akz.kante}" stroke-width=".4"/>`;
}

// Die drei Pfade eines Körpersatzes werden gesammelt und in EINEM Zug
// gezeichnet: sonst hätte eine Rangliste mit zwölf Zeichen einige hundert
// Pfade.
//
// Die UNTERLAGE — derselbe Umriss noch einmal mit dickem dunklem Strich —
// steht nur dann darunter, wenn eine Schwinge dahinterliegt. Dort trennt
// sie Gold und Metall, die sonst ineinanderlaufen. Ohne Schwinge ist sie
// ein fetter Rand um jeden Körper und macht aus einem geschliffenen
// Zeichen einen Aufkleber.
function _insKoerper(hell, dunkel, licht, c, fH, fD, unterBreit){
  if(!hell && !dunkel) return '';
  return (c.unterlage ? `<path d="${hell + dunkel}" fill="none" stroke="${c.unter}"
      stroke-width="${unterBreit || 2.2}" stroke-linejoin="round" opacity=".92"/>` : '')
    + `<path d="${hell}" fill="${fH}" stroke="${c.kante}" stroke-width=".4"
      stroke-linejoin="round"/>`
    + `<path d="${dunkel}" fill="${fD}" stroke="${c.kante}" stroke-width=".4"
      stroke-linejoin="round"/>`
    + (licht ? `<path d="${licht}" fill="${c.glanz}" opacity=".55"/>` : '');
}

// Der Reif. Er ist in allen fünfzehn Feldern derselbe — die Fassung, nicht
// der Schmuck. Fünf Striche machen aus einem Kreis eine Röhre: dunkle
// Außenkante, das Band mit dem Verlauf, ein breiter Lichtsteg oben links,
// ein schmales Rückenlicht unten rechts (die Reflexion des Grunds, ohne
// die jeder Ring unten ausfranst) und die dunkle Innenkante. Mehr nicht:
// als hier zusätzlich ein Schattenbogen lag, sah das Band nicht gewölbt
// aus, sondern gescheckt.
function _insReif(id, c){
  const br = INS_BREIT;
  return `<circle cx="50" cy="50" r="${_n(INS_RA + .5)}" fill="none" stroke="${c.unter}"
      stroke-width="1"/>`
    + `<circle cx="50" cy="50" r="${INS_R}" fill="none" stroke="url(#${id}mt)"
      stroke-width="${_n(br)}"/>`
    + `<path d="${_insBogen(INS_R - br*.24, -2.95, -1.15)}" fill="none" stroke="${c.glanz}"
      stroke-width="${_n(br*.30)}" stroke-linecap="round" opacity=".92"/>`
    + `<path d="${_insBogen(INS_R + br*.30, .30, 1.85)}" fill="none" stroke="${c.hell}"
      stroke-width="${_n(br*.16)}" stroke-linecap="round" opacity=".45"/>`
    + `<circle cx="50" cy="50" r="${_n(INS_R - br/2 - .45)}" fill="none" stroke="${c.unter}"
      stroke-width=".9"/>`;
}

// Die Raute am Fuß. Sie trägt die Ligaposition — vorher hing dafür ein
// eigenes Wappenschild unter dem Zeichen, ein zweiter Körper für dieselbe
// Aufgabe.
//
// Sie steht deshalb nur dort, wo eine Position steht: mit Band. In der
// Liste sitzen am Fuß des Reifs die Titelsterne [§C26], und zwei Zeichen
// auf demselben Platz sind eines zuviel.
function _insFuss(c, pos, akz){
  const a = Math.PI/2, r0 = INS_R, zahl = pos > 0;
  const lang = zahl ? 15.0 : 11.5, tief = zahl ? 7.0 : 6.6;
  const brei = zahl ? .205 : .150, mitte = zahl ? 3.9 : 2.2;
  const T = _insPt(a, r0 + lang), B = _insPt(a, r0 - tief);
  const L = _insPt(a - brei, r0 + mitte), R = _insPt(a + brei, r0 + mitte);
  const M = _insPt(a, r0 + mitte);
  const f = akz || c.metallStein;
  const p = (x,y) => 'M' + _insK(x) + 'L' + _insK(y) + 'L' + _insK(M) + 'Z';
  let s = (c.unterlage ? `<path d="M${_insK(T)}L${_insK(L)}L${_insK(B)}L${_insK(R)}Z"
      fill="none" stroke="${c.unter}" stroke-width="2.2" stroke-linejoin="round"
      opacity=".92"/>` : '')
    + `<path d="${p(T,L)}" fill="${f.hell}"/>`
    + `<path d="${p(T,R)}" fill="${f.mitt}"/>`
    + `<path d="${p(L,B)}" fill="${f.mitt2}"/>`
    + `<path d="${p(R,B)}" fill="${f.tief}"/>`
    + `<path d="M${_insK(T)}L${_insK(L)}L${_insK(B)}L${_insK(R)}Z" fill="none"
      stroke="${f.kante}" stroke-width=".5" stroke-linejoin="round"/>`;
  if(zahl){
    // Ein dunkles Feld unter der Ziffer: auf blankem Metall ist eine dunkle
    // Zahl nicht zu lesen, und eine helle erst recht nicht.
    const fl = 5.0, y0 = 50 + r0 + mitte;
    s += `<path d="M50 ${_n(y0 - fl*1.55)}L${_n(50 + fl*1.18)} ${_n(y0 + fl*.15)}
        L50 ${_n(y0 + fl*1.85)}L${_n(50 - fl*1.18)} ${_n(y0 + fl*.15)}Z"
        fill="#0a0e12" opacity=".9"/>`
      + `<text x="50" y="${_n(y0 + fl*.74)}" text-anchor="middle" font-size="8"
        font-family="'Archivo Black',sans-serif" font-weight="700"
        fill="${_insMix(c.m, '#FFFFFF', .6)}">${pos}</text>`;
  }
  return s;
}

/* ── Die fünf Stufen ─────────────────────────────────────────────────
     Stufe 1  Reif          Das blanke Band. Ab Grad II Nieten darauf.
     Stufe 2  Schildring    Kartuschen liegen quer auf dem Band, erhabene
                            Stege verbinden sie zu einer Kette.
     Stufe 3  Volutenkranz  Gespiegelte Schneckenpaare sitzen auf dem
                            Reif, ein Stein am Ansatz, eine Perle im Auge.
     Stufe 4  Lorbeerreif   Zwei Zweige, unten zusammenlaufend, oben offen.
     Stufe 5  Ordensstern   Eine Glorie feiner Strahlen auf eigenem
                            Kranzring, vier Bündel auf den Diagonalen,
                            Steine, Perlenkranz und die Krone.

   DER SPRUNG ÜBER DIE STUFENGRENZE MUSS GRÖSSER SEIN ALS DER VON GRAD ZU
   GRAD: Stufe 2 Grad III bleibt schwächer als Stufe 3 Grad I. Das hält
   nur, solange die Stufe den GEGENSTAND wechselt und der Grad ihn
   ausbaut. tests/zeichen misst es. */

// `grad` ist das Drittel der Stufe, in dem der Träger steht (0–2). Was er
// ändert, steht in INSIGNIUM_AUSBAU. Der Ordensstern hat keine Grade
// [§C30] — er zählt Zacken, und jede Zacke macht die Glorie um vier
// Strahlen dichter.
function _insStufe(key, c, zacken, id, grad){
  const R = INS_R, rA = INS_RA;
  const g = Math.max(0, Math.min(INSIGNIUM_GRADE - 1, grad || 0));
  const A = (INSIGNIUM_AUSBAU[key] || [])[g] || {};
  const akz = c.akz;
  let h = '', d = '', l = '', vorn = '', hinten = '', aufDemBand = '';
  // Zwei Sätze: was RADIAL vom Reif absteht, liegt dahinter; was AUF dem
  // Band sitzt, liegt davor. Läge alles dahinter, deckte der Reif jedem
  // Körper auf dem Band die Mitte weg — von Niete wie Schild bliebe außen
  // und innen ein Splitter stehen.
  let oH = '', oD = '', oL = '';
  const nimm = f => { h += f.h; d += f.d; l += f.g; };
  const aufBand = f => { oH += f.h; oD += f.d; oL += f.g; };
  const stein = (a, r0, hh, ww) => {
    const [x,y] = _insPt(a, r0);
    vorn += _insRaute(x, y, hh, ww, akz);
  };

  // ── Stufe 1: das blanke Band, ab Grad II mit Nieten ───────────────
  if(key === 'reif'){
    const gr = A.gr || 1, p = [];
    for(let i = 0; i < (A.nieten || 0); i++) p.push(_insPt(_insAng(i, A.nieten), R));
    // Der glatte Reif wächst nach INNEN — außen würde er zum Zahnkranz, und
    // Nieten allein verschieben den Umriss um keinen Bildpunkt. Erst eine
    // Haarlinie, dann ein zweites volles Band: ausgerechnet die Stufe, auf
    // der man am längsten steht, hätte sonst als einzige keinen sichtbaren
    // Fortschritt.
    hinten = A.innen
      ? `<circle cx="50" cy="50" r="${R - 8.5}" fill="none" stroke="${c.hell}"
           stroke-width="${A.innen === 2 ? 1.1 : .7}" opacity=".72"/>`
      : '';
    aufDemBand = p.length ? _insNieten(p, 2.1*gr, c) : '';
  }

  // ── Stufe 2: Schilde auf dem Band, durch Stege verbunden ──────────
  if(key === 'schild'){
    const n = A.schilde, hw = A.hw;
    let stege = '';
    for(let i = 0; i < n; i++){
      const a = _insAng(i,n);
      aufBand(_insSchildchen(a, A.aus, A.ein, hw, 1.8));
      // Der Steg setzt dicht an der Schildkante an. Mit Spalt schwebten
      // acht Plättchen einzeln auf dem Reif, statt eine Kette zu bilden —
      // und die Kette ist der Gegenstand dieser Stufe.
      if(A.steg) stege += _insBogen(R, a + hw/R*1.25, _insAng(i+1,n) - hw/R*1.25);
      if(A.stein) stein(a, R, 2.6, 1.8);
    }
    // Dunkle Unterlage, helles Band, schmaler Grat: dieselben drei Striche
    // wie am Reif. Nur heller gefärbt verschwand der Steg im Band.
    aufDemBand = stege
      ? `<path d="${stege}" fill="none" stroke="${c.kante}" stroke-width="2"
          stroke-linecap="round"/>`
      + `<path d="${stege}" fill="none" stroke="url(#${id}kp)" stroke-width="1.4"
          stroke-linecap="round"/>`
      + `<path d="${stege}" fill="none" stroke="${c.glanz}" stroke-width=".8"
          stroke-linecap="round" opacity=".55"/>`
      : '';
  }

  // ── Stufe 3: gespiegelte Volutenpaare auf dem Reif ────────────────
  if(key === 'volute'){
    const n = A.paare, augen = [];
    for(let i = 0; i < n; i++){
      const a = _insAng(i,n);
      // Ein PAAR, an der Radialen gespiegelt: eine einzelne Volute sitzt
      // schief auf dem Reif, zwei gespiegelte bilden eine Konsole. Der
      // Ansatz sitzt auf der AUSSENKANTE und zeigt schräg nach außen —
      // tangential angesetzt klebte die Volute auf dem Band.
      [1,-1].forEach(sp => {
        const [sx,sy] = _insPt(a, rA - .6);
        const bahn = _insSpiral(sx, sy, a + sp*(Math.PI/2 - .30), A.lang,
          -sp*A.dreh, 20, 3.4);
        const v = _insBandHalb(bahn, A.dick, A.dick*.26);
        // Die Lichtseite liegt immer links: sp spiegelt die Volute, nicht
        // die Beleuchtung. Sonst leuchtete die rechte von rechts.
        nimm(sp > 0 ? v : {h:v.d, d:v.h, g:''});
        augen.push([bahn[20][0], bahn[20][1]]);
      });
      // Der Stein sitzt genau dort, wo die beiden Voluten ansetzen. Ohne
      // ihn standen zwei Haken nebeneinander statt einer Konsole.
      stein(a, R, A.konsole, A.konsole*.70);
    }
    // Die Perle im Auge der Schnecke. Ohne sie lief die Volute dünner und
    // dünner ins Nichts aus, statt einen Abschluss zu haben.
    vorn += _insNieten(augen, 1.4, c);
  }

  // ── Stufe 4: zwei Zweige, oben offen ──────────────────────────────
  if(key === 'lorbeer'){
    let bH = '', bD = '', bG = '', zweig = '';
    const beeren = [];
    const rB = rA + .4;
    [1,-1].forEach(sp => {
      const a0 = Math.PI/2 - sp*0.44, a1 = Math.PI/2 - sp*2.58;
      zweig += 'M' + _insK(_insPt(a0,rB)) + 'A' + _n(rB) + ' ' + _n(rB) + ' 0 0 '
        + (sp > 0 ? 0 : 1) + ' ' + _insK(_insPt(a1,rB));
      for(let i = 0; i < A.blatt; i++){
        const t = (i + .5) / A.blatt;
        // Am Zweigansatz kleiner, in der Mitte am größten, zur Spitze wieder
        // kleiner — so läuft der Kranz aus, statt abzubrechen.
        const gr = (0.74 + 0.32 * Math.sin(Math.PI * Math.min(1, t*1.04))) * A.gr;
        const a = a0 + (a1 - a0) * t;
        const Ln = 8.6*gr, W = Ln*.34;
        // Die Blätter stehen nicht radial, sondern legen sich dem Zweig nach
        // oben an — daran erkennt man einen Lorbeer und keinen Igel.
        const [x,y] = _insPt(a, rB + Ln*.80);
        const b = _insLaub(x, y, a + Math.PI/2 - sp*0.72, Ln, W);
        // Die Lichtseite liegt immer links: sp dreht das Blatt, nicht die
        // Beleuchtung. Sonst leuchtete der linke Zweig von rechts.
        if(sp > 0){ bH += b.h; bD += b.d; bG += b.g; }
        else { bH += b.d; bD += b.h; }
        if(A.beeren && i % 3 === 1) beeren.push(_insPt(a - sp*.04, rB + 2.0));
      }
    });
    hinten = (c.unterlage ? `<path d="${bH + bD}" fill="none" stroke="${c.unter}"
        stroke-width="2.4" stroke-linejoin="round" opacity=".92"/>` : '')
      + `<path d="${zweig}" fill="none" stroke="${_insMix(c.m,'#05080B',.46)}"
        stroke-width="1.7" stroke-linecap="round"/>`
      + `<path d="${bH}" fill="url(#${id}bl)" stroke="${c.kante}" stroke-width=".42"
        stroke-linejoin="round"/>`
      + `<path d="${bD}" fill="url(#${id}bt)" stroke="${c.kante}" stroke-width=".42"
        stroke-linejoin="round"/>`
      + `<path d="${bG}" fill="${c.glanz}" opacity=".38"/>`
      + (beeren.length ? `<path d="${_insPunkte(beeren, 1.6)}" fill="${c.hell}"
        stroke="${c.kante}" stroke-width=".42"/>` : '');
    if(A.endraute) [-1,1].forEach(sp => stein(Math.PI/2 - sp*0.40, rB + 4.6, 3.6, 2.5));
  }

  // ── Stufe 5: Glorie, Steine, Krone ────────────────────────────────
  if(key === 'stern'){
    // Der Ordensstern hat keine Grade. Jede Zacke macht die Glorie um vier
    // Strahlen dichter — dieselbe Rechnung wie vorher, nur dass aus acht
    // groben Zacken vier Dutzend Haarstriche geworden sind.
    const z = Math.max(ORDENSSTERN_START, zacken || ORDENSSTERN_START);
    // Die Zahl der Strahlen wächst ohne Ende, ihre Länge nur bis zu einer
    // Grenze: sonst spränge der Stern irgendwann aus seiner Zeichenfläche.
    // Nur mehr Strahlen allein wäre trotzdem zu wenig gewesen — mit jedem
    // Schritt verschiebt sich auch das Raster, und die Zeichnung wurde
    // abwechselnd voller und dünner statt stetig heller.
    // Mehr Strahlen ALLEIN reicht nicht: an der Spitze ist ein Strahl
    // schmaler als ein Bildpunkt, und die Zeichnung wurde abwechselnd
    // voller und dünner statt stetig heller. Mit jeder Zacke werden die
    // Strahlen deshalb auch etwas länger und breiter.
    const zz = z - ORDENSSTERN_START;
    // Die Länge ist gedeckelt, sonst spränge der Stern irgendwann aus
    // seiner Zeichenfläche: der längste Strahl darf den Bündelarm nicht
    // überholen. Was ohne Deckel weiterwächst, ist die ZAHL der Strahlen
    // — und der Kranzring, aus dem sie springen, wird breiter.
    const glorie = 4 * z;
    const kurzL = 19 + Math.min(2.5, zz * .4);
    const kurzW = .030 + Math.min(.014, zz * .004);
    const r0 = rA + .4, kr = 5.0 + Math.min(2.4, zz * .40);
    let kurz = '', hell = '';
    // Der Grundkranz lässt vor jeder HAUPTRICHTUNG eine Lücke: dadurch
    // stehen die vier Bündel als Arme eines Sterns da und nicht als
    // Ausreißer in einer gleichmäßigen Sonne. Oben und unten sind die
    // Lücken ohnehin nötig — dort sitzen Krone und Raute.
    for(let i = 0; i < glorie; i++){
      const a = _insAng(i, glorie);
      const ab = Math.abs(((a*180/Math.PI + 405) % 90) - 45);
      if(ab > 34) continue;
      // Innen am längsten, zur Lücke hin kürzer, und jeder zweite kürzer
      // als sein Nachbar: der Arm läuft aus UND hat eine Textur.
      kurz += _insStrahl(a, r0, kurzL * (1.30 - .55*(ab/34)) * (i % 2 ? .64 : 1), kurzW);
    }
    [28,22,15,11,8].forEach((L, k) => {
      const w = .022 - k*.002;
      for(let i = 0; i < 4; i++){
        const a0 = -Math.PI/4 + i*Math.PI/2;
        if(k === 0) hell += _insStrahl(a0, r0, L, w);
        else [1,-1].forEach(sp => hell += _insStrahl(a0 + sp*k*.115, r0, L, w));
      }
    });
    // Ein schmaler Kranzring, aus dem die Strahlen springen. Ohne ihn saßen
    // vierzig Strahlen einzeln auf dem Reif und sahen aufgesprüht aus statt
    // gefasst — und OHNE Kontur: ein Strahl ist zwei Einheiten breit, eine
    // Kontur von drei Zehnteln je Seite frisst ein Drittel davon, und aus
    // der Glorie werden graue Stecknadeln.
    hinten = (c.unterlage ? `<path d="${kurz + hell}" fill="none" stroke="${c.unter}"
        stroke-width="2.2" stroke-linejoin="round" opacity=".92"/>` : '')
      + `<path d="${kurz}" fill="url(#${id}kp)" opacity=".78"/>`
      + `<path d="${hell}" fill="url(#${id}kp)"/>`
      + `<circle cx="50" cy="50" r="${_n(r0)}" fill="none" stroke="url(#${id}mt)"
        stroke-width="${_n(kr)}"/>`
      + `<circle cx="50" cy="50" r="${_n(r0 + kr*.62)}" fill="none" stroke="${c.unter}"
        stroke-width=".6"/>`;
    for(let i = 0; i < 4; i++) stein(-Math.PI/4 + i*Math.PI/2, R, 3.2, 2.2);
    for(let i = 0; i < 8; i++) stein(_insAng(i,8), R, 2.0, 1.4);
    const p = [];
    for(let i = 0; i < 16; i++) p.push(_insPt(_insAng(i,16), R));
    aufDemBand += _insNieten(p, 1.4, c);
  }

  // Der Kopf auf zwölf Uhr: der Gegenpol zur Raute am Fuß. Stein, Lilie
  // oder Krone — er sagt auf einen Blick, in welcher Hälfte der Leiter man
  // steht. Vorher stand dort ein einzelner Strahl, eine Nadel an genau der
  // Stelle, an der das Zeichen seinen Kopf haben soll.
  if(key === 'schild' && A.kopf) stein(-Math.PI/2, rA + 4.4, 4.4, 3.0);
  if(key === 'volute') vorn += _insLilie(rA + A.kopfR, A.lilGr, akz);
  if(key === 'lorbeer') vorn += _insLilie(rA + A.kopfR, A.lilGr, akz);
  if(key === 'stern') vorn += _insKrone(rA + 4.4, 1.15, akz, c);

  return hinten
    + _insKoerper(h, d, l, c, `url(#${id}kp)`, `url(#${id}kt)`, key === 'lorbeer' ? 2.8 : 2.4)
    + _insReif(id, c)
    + aufDemBand
    + _insKoerper(oH, oD, oL, c, `url(#${id}kp)`, `url(#${id}kt)`, 2.0)
    + vorn;
}

/* ── Die Schwinge ────────────────────────────────────────────────────
   Die Rankenschwinge, und nur sie: jeder Stiel rollt sich am Ende zu einer
   Volute ein und trägt einen Knopf im Auge — dieselbe Linie wie im
   Volutenkranz der dritten Stufe, nur golden und länger. Damit sprechen
   Insignium und Schwinge dieselbe Sprache und sind trotzdem am Werkstoff
   zu unterscheiden.

   Sechs Ränge, der letzte ab ZEHN Titeln. Danach wächst die Schwinge
   nicht weiter, nur die Sterne werden mehr: eine Schwinge, die immer
   weiter wächst, sprengt irgendwann jede Zeile; die Sterne kosten nichts. */
const INS_SCHWINGE = [
  {ab:1,  n:5,  L:66,  hub:.15, glanz:.36},
  {ab:2,  n:6,  L:74,  hub:.30, glanz:.50},
  {ab:3,  n:7,  L:82,  hub:.45, glanz:.64},
  {ab:5,  n:8,  L:89,  hub:.62, glanz:.78},
  {ab:8,  n:9,  L:95,  hub:.82, glanz:.91},
  {ab:10, n:11, L:102, hub:1,   glanz:1},
];
// Die Schwinge des Entwurfs greift zweieinhalb Reifradien weit aus. Das
// ist die Spannweite einer Studie bei 400 px; in einer Ranglistenzeile
// misst der Reif 52 px, und ein Zeichen, das dann dreimal so breit ist wie
// die Zeile hoch, schiebt sich in die Nachbarspalten. Der Bau bleibt, das
// Maß wird zurückgenommen — EIN Faktor, damit die Form nicht verzerrt.
const INS_SCHWINGE_SKALA = .78;
function _insSchwingenRang(titel){
  let r = -1;
  INS_SCHWINGE.forEach((s, i) => { if(titel >= s.ab) r = i; });
  return r;
}
// Wo die Schwinge ansetzt. Ein Flügel hat einen ARM, keinen Mittelpunkt:
// die Ansätze sitzen auf einer Strecke, sonst ist es ein Fächer.
const INS_SCHULTER = {x:45, y:49};

// Eine Blattklinge: lanzettlich wie das Lorbeerblatt, nur länger.
function _insRankenblatt(sx, sy, a, L, w){
  const dx = -Math.cos(a), dy = -Math.sin(a), nx = -dy, ny = dx;
  const P = (t, o) => [sx + dx*L*t + nx*o, sy + dy*L*t + ny*o];
  return 'M' + _insK(P(0,0))
    + 'C' + _insK(P(.24, w*.90)) + ' ' + _insK(P(.66, w*.72)) + ' ' + _insK(P(1,0))
    + 'C' + _insK(P(.66, -w*.72)) + ' ' + _insK(P(.24, -w*.90)) + ' ' + _insK(P(0,0)) + 'Z';
}

// Eine Ranke: ein Stiel, dessen Krümmung nach außen zunimmt und der in
// einer Volute ausrollt; die Blätter sitzen abwechselnd links und rechts
// und werden zur Spitze hin kleiner.
//
// Vorher war die Schwinge ein Fächer aus Federn. Eine Ranke ROLLT SICH
// EIN; daran erkennt man sie auf einen Blick.
function _insRanke(sx, sy, th0, L, dreh, w0, blattL, anzB, mitBeeren){
  const N = 24;
  const bahn = _insSpiral(sx, sy, th0, L, dreh, N);
  let blatt = '';
  const beeren = [];
  for(let j = 0; j < anzB; j++){
    const u = .12 + .74 * (anzB > 1 ? j/(anzB-1) : .5);
    const [px,py,pth] = bahn[Math.round(u*N)];
    const sp = j % 2 ? 1 : -1, Ln = blattL * (1 - .46*u);
    blatt += _insRankenblatt(px, py, pth + sp*0.95 + Math.PI, Ln, Ln*.40);
    if(mitBeeren && j % 2 === 0)
      beeren.push([px + Math.sin(pth)*sp*w0*2.2, py - Math.cos(pth)*sp*w0*2.2]);
  }
  // Der Knopf im Auge der Volute. Ohne ihn lief die Spirale dünner und
  // dünner ins Nichts aus, statt einen Abschluss zu haben.
  beeren.push([bahn[N][0], bahn[N][1]]);
  return {stiel:_insBand(bahn, w0, w0*.14), blatt, beere:_insPunkte(beeren, 2.0)};
}

function _insSchwingen(rang, id){
  if(rang < 0) return '';
  const S = INS_SCHWINGE[rang], G = Math.PI / 180;
  // Weit aufgefächert statt aufrecht: aufrecht standen zwei goldene Kränze
  // neben dem silbernen, und drei Kränze auf einem Zeichen sind zwei zuviel.
  const auf = 16 + 10*S.hub, sp = 66 + 20*S.hub;
  const armA = (auf - sp*.40) * G, armL = .40 * S.L;
  const anz = Math.max(3, Math.round(S.n * .68));
  let st = '', bl = '', be = '';
  for(let i = 0; i < anz; i++){
    const u = anz > 1 ? i/(anz-1) : 0, t = 1 - u;
    const r = _insRanke(INS_SCHULTER.x - Math.cos(armA)*armL*t,
                        INS_SCHULTER.y - Math.sin(armA)*armL*t,
                        (auf - u*sp) * G + Math.PI,
                        S.L * (1.12 - .22*Math.pow(u, 1.2)),
                        1.55 + .55*S.hub, 4.6 + 1.4*S.hub, 17 + 6*S.hub,
                        3 + Math.round(2*S.hub), rang >= 2);
    st += r.stiel; bl += r.blatt; be += r.beere;
  }
  const fl = `<path d="${st}" fill="url(#${id}gt)" stroke="${INS_GOLD_TIEF}"
      stroke-width=".5" stroke-linejoin="round"/>`
    + `<path d="${bl}" fill="url(#${id}gd)" stroke="${INS_GOLD_TIEF}"
      stroke-width=".5" stroke-linejoin="round"/>`
    + `<path d="${be}" fill="#FFF1C4" stroke="${INS_GOLD_TIEF}" stroke-width=".45"/>`;
  return `<g>${fl}</g><g transform="translate(100,0) scale(-1,1)">${fl}</g>`;
}
// Schwinge und Sterne gehören zusammen und werden gemeinsam verkleinert:
// Sterne in Originalgröße auf einer zurückgenommenen Schwinge säßen zu
// weit außen und rissen die Zeichenfläche wieder auf.
function _insBandGruppe(inhalt){
  return `<g transform="translate(50,50) scale(${INS_SCHWINGE_SKALA}) translate(-50,-50)">`
    + inhalt + `</g>`;
}

// Die Titel als Sterne über dem Reif — die Schwinge zeigt, DASS da etwas
// ist, die Sterne sagen, wie viel. Sie hören nicht auf zu wachsen, auch
// wenn die Schwinge bei zehn Titeln stehen bleibt: ab sechs bricht die
// Reihe in zwei Bögen, ab dreizehn in drei. Zwölf nebeneinander sind keine
// Zahl mehr, die man auf einen Blick liest.
function _insSternPfad(cx, cy, r){
  let d = '';
  for(let i = 0; i < 10; i++){
    const a = i/10*Math.PI*2 - Math.PI/2;
    const rr = i % 2 ? r*.44 : r;
    d += (i ? 'L' : 'M') + _n(cx + Math.cos(a)*rr) + ' ' + _n(cy + Math.sin(a)*rr);
  }
  return d + 'Z';
}
function _insSterne(n, id){
  if(n <= 0) return '';
  const z = n <= 5 ? 1 : n <= 12 ? 2 : 3;
  const reihen = [];
  let rest = n;
  for(let r = 0; r < z; r++){ const k = Math.ceil(rest/(z-r)); reihen.push(k); rest -= k; }
  let d = '';
  reihen.forEach((k, r) => {
    const rad = 32 + r*8.5, gr = 3.2 - r*.35;
    for(let i = 0; i < k; i++){
      const w = (i - (k-1)/2) * 13 * Math.PI/180;
      d += _insSternPfad(50 + Math.sin(w)*rad, 14 - Math.cos(w)*rad, gr);
    }
  });
  return `<path d="${d}" fill="url(#${id}gd)" stroke="${INS_GOLD_TIEF}"
    stroke-width=".55" stroke-linejoin="round"/>`;
}

// Die Zeichenfläche ohne Schwinge ist QUADRATISCH und auf den
// Reifmittelpunkt zentriert: das SVG wird mit translate(-50%,-50%)
// gesetzt, also muss der Reifmittelpunkt der Boxmittelpunkt sein. Sonst
// sitzt der Avatar höher als seine Fassung. Sie ist so eng gelegt, dass
// der Avatar den Reif innen fast füllt und nur ein schmaler dunkler Sitz
// bleibt.
const INS_BOX = '-22 -22 144 144';
// Mit Schwinge: dieselbe Reifgröße, aber Platz für Ranken und Sterne. Die
// Box ist waagerecht auf den Reif zentriert, damit translate(-50%) stimmt;
// senkrecht liegen 72 der 130 Einheiten über der Reifmitte und 58 darunter.
// Gemessen an der Breite OHNE Band (144) sind das 50 % und 40,3 % — das
// Zeichen bleibt also in seiner Kachel und ragt nur seitlich heraus.
const INS_BAND_BOX = '-40 -22 180 130';

// Das ganze Zeichen. `band:false` lässt Schwinge und Sterne weg (Listen,
// Feed). `pos` überschreibt die Zahl in der Raute — auf dem Podest der
// Ewigen Tafel wäre die Ligaposition eine zweite Rangfolge auf derselben
// Karte, und zwei Zahlen, die sich widersprechen, sind schlimmer als
// keine. `titel` überschreibt die Zahl der Sterne, aus demselben Grund:
// ein Rückblick auf den Mai darf nicht die Titel tragen, die im August
// dazugekommen sind. Der REIF bleibt dabei der heutige — die Laufbahn ist
// eine Karriere und kein Monat.
function insigniumSvg(pid, opt){
  opt = opt || {};
  const P = prestigeOf(pid);
  const c = _insSatz((getPlayerRank(pid) || {}).label);
  const id = 'i' + (++_insLauf) + '_';
  const band = opt.band !== false;
  const titel = band ? (opt.titel !== undefined ? opt.titel : meisterTitel(pid)) : 0;
  const rang = band ? _insSchwingenRang(titel) : -1;
  c.unterlage = rang >= 0;
  c.akz = _insAkzent(id, c);
  c.metallStein = _insStahl(id, c);
  let s = `<svg viewBox="${band ? INS_BAND_BOX : INS_BOX}" class="ins" aria-hidden="true">`
    + _insDefs(id, c, rang >= 0 ? INS_SCHWINGE[rang].glanz : .3);
  if(rang >= 0){
    // Der goldene Hof beim höchsten Rang. Er liegt UNTER der Schwinge und
    // wird mit ihr verkleinert, sonst stünde ein Schein um ein Zeichen, das
    // ihn gar nicht mehr ausfüllt.
    if(rang === INS_SCHWINGE.length - 1)
      s += _insBandGruppe(`<ellipse cx="50" cy="55" rx="122" ry="52" fill="url(#${id}gg)"/>`);
    // Eine ELLIPSE, kein Kreis: die Bandbox reicht 58 Einheiten unter die
    // Reifmitte, ein Kreis mit dem nötigen Radius 72,5 aber 72,5 — sein
    // unteres Viertel schnitt der Browser lautlos ab, und im Profilkopf
    // stand quer unter dem Zeichen eine gerade Kante. Waagerecht darf er
    // weit ausgreifen, dort ist Platz, senkrecht bleibt er in der Box.
    s += _insBandGruppe(_insSchwingen(rang, id))
      + `<ellipse cx="50" cy="50" rx="${_n(INS_RA + 30)}" ry="${_n(INS_RA + 13.5)}"
         fill="url(#${id}sd)"/>`;
  }
  // Ein dunkler Sitz unter dem Bildrand: der Avatar soll IN der Fassung
  // liegen, nicht davor.
  s += `<circle cx="50" cy="50" r="${_n(INS_RA + .4)}" fill="url(#${id}pl)"/>`
    + `<circle cx="50" cy="50" r="${_n(INS_R - INS_BREIT/2 - 1.6)}" fill="none"
       stroke="#000000" stroke-width="2.4" opacity=".38"/>`
    + _insStufe(P.insignie.key, c, P.zacken, id, P.grad)
    + (opt.inner ? `<g>${opt.inner}</g>` : '')
    + (band ? _insFuss(c, opt.pos !== undefined ? opt.pos : ligaPosition(pid), c.akz) : '')
    + (band ? _insBandGruppe(_insSterne(titel, id)) : '')
    + `</svg>`;
  return s;
}

// Ein Insignium OHNE Spieler: nur die Form EINER Stufe, ohne Schwinge und
// ohne Sterne. Die Laufbahn-Vitrine stellt die fünf Stufen nebeneinander,
// und dort geht es um die Stufe selbst — nicht darum, wer sie gerade
// trägt. Der Rang kommt trotzdem vom Spieler: er soll sehen, wie das
// Zeichen bei IHM aussähe.
function insigniumStufeSvg(key, rangLabel, zacken, grad){
  const id = 'i' + (++_insLauf) + '_';
  const c = _insSatz(rangLabel);
  c.unterlage = false;
  c.akz = _insAkzent(id, c);
  c.metallStein = _insStahl(id, c);
  return `<svg viewBox="${INS_BOX}" class="ins" aria-hidden="true">`
    + _insDefs(id, c)
    + `<circle cx="50" cy="50" r="${_n(INS_RA + .4)}" fill="url(#${id}pl)"/>`
    + _insStufe(key, c, zacken || 0, id, grad || 0)
    + `</svg>`;
}

/* ==INS-GRAFIK-ENDE== */
// Rundet eine Liste so, dass die Summe der gerundeten Werte EXAKT die
// vorgegebene Summe ergibt: erst abrunden, dann die Reste in der Reihenfolge
// der größten Nachkommaanteile verteilen. Ohne das driftet eine Liste aus
// 21 Posten um bis zu einen Punkt gegen ihre eigene Kopfzeile — und dann ist
// die Aufschlüsselung keine Rechnung mehr, sondern nur noch eine Behauptung.
function _prestigeRunden(werte, ziel, schritt){
  const e = Math.round(1 / schritt);            // 1 = ganze Zahlen, 10 = Zehntel
  const roh = werte.map(w => w * e);
  const aus = roh.map(Math.floor);
  let rest = Math.round(ziel * e) - aus.reduce((a, b) => a + b, 0);
  // Nur Posten, die es wirklich gibt, dürfen einen Rest abbekommen.
  const kand = roh.map((w, i) => i).filter(i => roh[i] > 0)
    .sort((a, b) => (roh[b] - aus[b]) - (roh[a] - aus[a]));
  for(let k = 0; rest > 0 && kand.length; k++, rest--) aus[kand[k % kand.length]]++;
  for(let k = 0; rest < 0 && kand.length; k++, rest++) aus[kand[kand.length - 1 - (k % kand.length)]]--;
  return aus.map(v => v / e);
}

// ─── §13.10 Die Laufbahn: wo stehe ich, und was fehlt ────────────────
//     Ein Tipp auf den eigenen Avatar. Kein Menüpunkt, keine Erklärseite —
//     das Zeichen selbst ist der Knopf. Drei Fragen, in dieser Reihenfolge:
//     Wo stehe ich? Woher kommt das? Was ist der nächste Schritt?
//
//     Die nächsten Schritte werden GERECHNET, nicht behauptet: aus den
//     eigenen Zahlen, mit der echten Distanz zum Bestwert bzw. zur
//     Untergrenze, und mit dem Prestige, das dabei herausspringt.

// Bis zu `n` erreichbare nächste Schritte, die günstigsten zuerst.
function prestigeSchritte(pid, n){
  n = n || 3;
  const out = [];
  const P = prestigeOf(pid);

  // 1. Allzeitwertungen, die der Spieler noch nicht hält.
  try {
    const C = _chronicleCtx(), A = allChronicles(), p = C.P[pid];
    if(p){
      CHRONICLES.forEach(def => {
        if(def.art === 'schatten') return;
        const halte = A.byId[def.id];
        if(halte && halte.pids.includes(pid)) return;
        let mein = null, ziel = null;
        if(def.unit && def.raw){
          mein = def.raw(p, C);
          ziel = halte ? halte.val : (def.min || 0);
        } else if(def.val){
          mein = def.val(p, C);
          ziel = halte ? halte.val : null;
        }
        if(mein == null || !isFinite(mein) || ziel == null || mein >= ziel) return;
        const rel = (ziel - mein) / Math.max(1e-9, Math.abs(ziel));
        const gewinn = PRESTIGE_REKORD * (PRESTIGE_ART[def.art] ?? 1)
          / Math.max(1, (halte ? halte.pids.length + 1 : 1))
          / Math.sqrt(P.zahlen.rekord + 1);
        out.push({
          art:'rekord', id:def.id, name:def.name, ic:def.ic, tone:def.tone, rel,
          gewinn:Math.round(gewinn),
          txt: def.unit
            ? `Noch ${Math.max(1, Math.ceil(ziel - mein))} ${def.unit}` +
              (halte ? ` — ${_chronHolderNames(halte)} hält ${Math.round(ziel)}` : '')
            : (halte ? `${_chronHolderNames(halte)} hält den Bestwert` : def.cond)
        });
      });
    }
  } catch(e){ /* Kontext noch nicht da — dann eben ohne Rekorde */ }

  // 2. Monatswertungen der laufenden Saison, die noch offen sind.
  try {
    const T = seasonTitles(currentSeason().id);
    if(!T.awarded.some(a => a.pid === pid)){
      seasonTitleRace(currentSeason().id).forEach(r => {
        if(!r || r.pid === pid) return;
        const d = DISZIPLINEN.find(x => x.id === r.id);
        if(!d || d.art === 'schatten') return;
        out.push({
          art:'monat', id:r.id, name:r.name || (d && d.name), ic:d.ic, tone:d.tone,
          rel: 0.55,          // ein offener Monatseintrag ist immer „diesen Monat noch"
          gewinn: Math.round(PRESTIGE_MONAT * (PRESTIGE_ART[d.art] ?? 1)
                             / Math.sqrt(P.zahlen.monat + 1)),
          txt: r.pid ? `${pname(r.pid)} führt — ${r.ev || d.monat.cond}` : d.monat.cond
        });
      });
    }
  } catch(e){ /* dito */ }

  // Ein Rekord, der weit weg ist, ist kein Schritt, sondern eine Absage.
  // Wer wenig hält, bekommt sonst zwangsläufig die teuersten Ziele
  // vorgeschlagen — es ist ja nichts Näheres da. Lieber gar nichts sagen.
  return out.filter(x => x.gewinn > 0 && (x.art !== 'rekord' || x.rel <= PRESTIGE_REICHWEITE))
    .sort((a, b) => a.rel - b.rel || b.gewinn - a.gewinn)
    .slice(0, n);
}

// Das Sheet. Aufgerufen vom Avatar im Profilkopf.
function showLaufbahn(pid){
  const p = (pmap() || {})[pid];
  if(!p) return;
  _sheetSetReopen(() => showLaufbahn(pid));
  const P = prestigeOf(pid);
  // Eine Seite, eine Farbe [§C25]. Die Stufe hatte hier ihre eigene
  // Leiter (blau → acid → gold); zusammen mit der Rangfarbe des
  // Fingerabdrucks waren das zwei Aussagen in einem Sheet. Die Stufe
  // steht ohnehin im Zeichen und in der Abschnittskante.
  const t = rangTon(pid);
  const spanne = P.naechste ? P.naechste.min - P.insignie.min : ORDENSSTERN_SCHRITT;
  const drin = P.naechste ? P.punkte - P.insignie.min
                          : (P.punkte - P.insignie.min) % ORDENSSTERN_SCHRITT;
  const anteil = Math.max(0, Math.min(1, drin / Math.max(1, spanne)));

  // ── Die Vitrine [§13.10] ───────────────────────────────────────────
  //     Vorher stand hier eine Fortschrittsstange mit einer Beschriftung,
  //     danach eine Leiter aus fünf gleich kleinen Stationen. Beide zeigten
  //     das Zeichen so klein, dass man von der Form nichts sah — dabei ist
  //     die Form der ganze Punkt: dafür sammelt man.
  //     Jetzt liegt eine Stufe groß in der Mitte, und man schiebt die
  //     anderen heran. Die eigene steht beim Öffnen da; nach rechts kommt,
  //     was noch aussteht, nach links, was man hinter sich hat.
  const _rangL = (getPlayerRank(pid) || {}).label;
  const _letzteI = INSIGNIEN.length - 1;
  const karten = INSIGNIEN.map((ins, i) => {
    const zustand = i < P.stufe ? 'erreicht' : i === P.stufe ? 'jetzt' : 'offen';
    // Nur die getragene Stufe zeigt die Zacken, die dieser Spieler wirklich
    // hat. Bei den anderen wäre das eine Behauptung über einen Stand, den es
    // nicht gibt.
    const zacken = (i === _letzteI && i === P.stufe) ? P.zacken : 0;
    // Eine durchlaufene Stufe hat man ganz durchlaufen — sie steht im
    // höchsten Grad. Eine offene zeigt ihren ersten: so sieht man beim
    // Weiterschieben, wie das Zeichen ANFÄNGT, nicht wie es endet.
    const grad = i < P.stufe ? INSIGNIUM_GRADE - 1 : i === P.stufe ? P.grad : 0;
    // Die Grade als drei Marken. Der Ordensstern hat keine — dort zählen
    // die Zacken, und die haben kein Ende.
    const unten = i === _letzteI
      ? `<span class="lb-k-z num">${i === P.stufe
            ? P.zacken + ' Zacken'
            : 'je ' + ORDENSSTERN_SCHRITT + ' eine Zacke'}</span>`
      : `<span class="lb-k-grad">${INSIGNIUM_GRAD_NAME.map((gn, gi) =>
            `<i class="${zustand !== 'offen' && gi <= grad ? 'an' : ''}">${gn}</i>`).join('')}</span>`;
    return `<div class="lb-k ${zustand}" data-lbstufe="${i}">
      <span class="lb-k-ins">${insigniumStufeSvg(ins.key, _rangL, zacken, grad)}</span>
      <span class="lb-k-n">${esc(ins.name)}</span>
      <span class="lb-k-p num">${i === 0 ? 'Start' : 'ab ' + ins.min}</span>
      ${unten}
    </div>`;
  }).join('');

  const teil = (lab, n, pt, sub) => `<div class="lb-teil">
      <div class="lb-t-n num">${pt}</div>
      <div class="lb-t-l">${esc(lab)}</div>
      <div class="lb-t-s num">${n} ${esc(sub)}</div>
    </div>`;

  // ── Die Aufschlüsselung ────────────────────────────────────────────
  //     Vorschläge waren hier das Falsche: wer wenig hält, bekommt
  //     zwangsläufig die teuersten Ziele vorgeschlagen, weil nichts
  //     Näheres da ist — „noch 10 Siege in Folge" ist kein Schritt,
  //     das ist eine Absage. Was fehlt, ist nicht der Rat, sondern die
  //     Rechnung: jeder Posten mit dem Grund, warum er so viel wiegt.
  const gruppen = [
    {q:'auszeichnung', kopf:'Auszeichnungen', leer:'noch keine erhalten', lab:'Stück'},
    {q:'monat',        kopf:'Monatswertungen', leer:'noch keine getragen', lab:'getragen'},
    {q:'rekord',       kopf:'Rekorde',         leer:'noch keinen gehalten', lab:'gehalten'},
  ];
  const posten = gruppen.map(g => P.quellen.filter(q => q.q === g.q));
  // Erst die drei Gruppensummen auf die Gesamtzahl abstimmen, dann in jeder
  // Gruppe die Posten auf ihre Gruppensumme. So passt jede Zeile zu der
  // Zahl über ihr und alles zusammen zur Zahl darunter.
  const summen = _prestigeRunden(posten.map(qs => qs.reduce((a, q) => a + q.p, 0)), P.punkte, 1);
  const werte  = posten.map((qs, i) => _prestigeRunden(qs.map(q => q.p), summen[i], 0.1));

  // Zahlen mit einer Nachkommastelle, aber ohne die überflüssige Null:
  // die Posten müssen sichtbar zur Summe passen, sonst ist es keine
  // Aufschlüsselung, sondern nur eine zweite Liste.
  const zahl = v => {
    const r = Math.round(v * 10) / 10;
    return (Number.isInteger(r) ? String(r) : r.toFixed(1)).replace('.', ',');
  };

  // Warum dieser Posten so viel wiegt. Vorher stand hier „2 von 12" — die
  // Zahl der heutigen Halter. Sie erklärte den Wert nicht, sie war der
  // Grund, warum er fiel. Jetzt steht da, was den Wert wirklich bestimmt:
  // die Klasse der Auszeichnung, der Monat des Eintrags, die Art — und der
  // Abschlag nur dort, wo es ihn gibt.
  const grund = q => {
    const teile = [];
    if(q.q === 'rekord') teile.push(q.halter <= 1 ? 'allein gehalten' : `zu ${q.halter}. geteilt`);
    else if(q.q === 'auszeichnung') teile.push((RARITY_META[q.klasse] || {}).label || 'Common');
    else if(q.label) teile.push(q.label);
    if(q.art) teile.push(PRESTIGE_ART_NAME[q.art] || 'Ereignis');
    if(q.q === 'auszeichnung' && q.mal > 1) teile.push(`${q.mal}× geholt`);
    if(q.rang > 1) teile.push(`${q.rang}. Eintrag · ${zahl(q.voll)} ÷ ${zahl(Math.sqrt(q.rang))}`);
    return teile.join(' · ');
  };


  // ── Der Fingerabdruck [§13.11] ─────────────────────────────────────
  //     Das Prestige sagt, WAS jemand zusammengetragen hat. Der Abdruck
  //     sagt, WIE er spielt. Beides gehört auf dieselbe Seite, und beides
  //     trägt hier dieselbe Farbe: die des Rangs.
  const _fa = fingerabdruck(pid);
  const _faTon = rangTon(pid);

  const zeile = (q, w) => `<div class="lb-q"${q.q === 'rekord' ? ` data-chron="${esc(q.id)}"` : ''}>
      <span class="n">${esc(q.name)}<em>${esc(grund(q))}</em></span>
      <span class="p num">${zahl(w)}</span>
    </div>`;

  const SICHTBAR = 4;
  const block = (g, gi) => {
    const qs = posten[gi], w = werte[gi];
    const rest = qs.slice(SICHTBAR).map((q, i) => zeile(q, w[SICHTBAR + i]));
    return `<div class="lb-grp">
      <div class="lb-grp-k"><span>${esc(g.kopf)}</span><span class="num">${zahl(summen[gi])}</span></div>
      ${qs.length ? qs.slice(0, SICHTBAR).map((q, i) => zeile(q, w[i])).join('')
                  : `<div class="lb-q leer">${g.leer}</div>`}
      ${rest.length ? `<div class="chron-rest">${rest.join('')}</div>
        <button class="chron-more" type="button" data-chron-more>
          <span class="tx">Mehr anzeigen · ${rest.length} weitere${rest.length === 1 ? 'r' : ''}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
            stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
        </button>` : ''}
    </div>`;
  };

  openSheet(`
   <div class="pp-root lb-root st-${P.insignie.key}" style="--ak:${t.c};--ak-rgb:${t.rgb}">
    <h3>Die Laufbahn</h3>
    <div class="sheet-sub num">${esc(p.name)} · Platz ${P.platz} von ${P.von} im Prestige</div>

    <div class="lb-karus" id="lbLeiter">
      <div class="lb-k-band">${karten}</div>
    </div>
    <div class="lb-stand">
      <span class="lb-st-p num">${P.punkte}</span>
      <span class="lb-st-l">Prestige</span>
      <span class="lb-st-n num">${P.naechste
        ? 'noch ' + P.fehlt + ' bis ' + esc(P.naechste.name)
        : P.zacken + ' Zacken · noch ' + P.naechsteZacke + ' bis zur nächsten'}</span>
    </div>
    <div class="lb-spur"><i style="width:${Math.round(anteil * 100)}%"></i></div>

    ${_fa ? `<div class="pp-sec-title" style="margin-top:18px">
      <div class="l"><h4>Der Fingerabdruck</h4></div>
      <div class="m num">${_fa[0].von} im Feld</div></div>
    <div class="fa-karte" style="--tt:${_faTon.c};--ttr:${_faTon.rgb}">
      ${fingerRadarSvg(pid)}
      ${fingerFeldZeilen(pid)}
    </div>` : ''}

    <div class="pp-sec-title" style="margin-top:18px"><div class="l"><h4>Woher es kommt</h4></div></div>
    <div class="lb-teile">
      ${gruppen.map((g, i) => teil(g.kopf, P.zahlen[g.q], summen[i], g.lab)).join('')}
    </div>

    <div class="pp-sec-title" style="margin-top:18px"><div class="l"><h4>Posten für Posten</h4></div>
      <div class="m num">${P.quellen.length}</div></div>
    <div class="lb-buch">
      ${gruppen.map(block).join('')}
      <div class="lb-summe"><span>Gesamt</span><span class="num">${P.punkte}</span></div>
    </div>
   </div>
  `);
  _bindChronikClicks(document.getElementById('sheet'));

  // ── Die Vitrine bedienen ───────────────────────────────────────────
  //     Welche Karte in der Mitte liegt, kann CSS nicht wissen: eine
  //     Position im Scrollbereich lässt sich nicht abfragen. Also setzt der
  //     Ablauf die Marke — und zwar bei jedem Schieben, sonst bliebe die
  //     getragene Stufe groß, während man längst eine andere ansieht.
  const _ld = document.getElementById('lbLeiter');
  if(_ld){
    const _lk = Array.prototype.slice.call(_ld.querySelectorAll('.lb-k'));
    const _fokus = () => {
      const m = _ld.scrollLeft + _ld.clientWidth / 2;
      let best = 0, bd = Infinity;
      _lk.forEach((k, i) => {
        const d = Math.abs(k.offsetLeft + k.offsetWidth / 2 - m);
        if(d < bd){ bd = d; best = i; }
      });
      _lk.forEach((k, i) => k.classList.toggle('fokus', i === best));
    };
    // Bei jedem Pixel neu rechnen wäre Arbeit ohne Wirkung — ein Bild reicht,
    // und genau ein Bild ist requestAnimationFrame.
    let _wart = 0;
    _ld.addEventListener('scroll', () => {
      if(_wart) return;
      _wart = requestAnimationFrame(() => { _wart = 0; _fokus(); });
    }, {passive:true});
    // Angefangen wird bei der eigenen Stufe, nicht links bei „Reif": wer weit
    // gekommen ist, sähe sonst ausgerechnet sein eigenes Zeichen nicht.
    const _lj = _lk[P.stufe];
    if(_lj) _ld.scrollLeft = Math.max(0,
      _lj.offsetLeft + _lj.offsetWidth / 2 - _ld.clientWidth / 2);
    _fokus();
  }
}
