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
// fünf auf dem Kerbring, drei auf dem Strahlenkranz und niemand darüber. Der
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
  {key:'kerben',  name:'Kerbring',      min:240},
  {key:'strahl',  name:'Strahlenkranz', min:720},
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
//     Was ein Grad NICHT darf: das Element einer anderen Stufe borgen.
//     Ein Kerbring treibt keine Blätter aus, ein Strahlenkranz bekommt
//     keine Nieten. Daran bleibt die Stufe erkennbar, und nur deshalb
//     lässt sich der Umriss überhaupt wachsen lassen [§C30].
//
//     Grad I ist absichtlich kleiner als der alte Einheitswert, Grad III
//     etwa so groß: die Spanne wächst nach unten, nicht nach außen. Sonst
//     stieße das Zeichen an den Rand seiner Zeichenfläche.
const INSIGNIUM_AUSBAU = {
  // Der glatte Reif wächst nicht nach außen — er würde sonst zum Zahnkranz.
  // Er wächst in die TIEFE: erst eine Haarlinie innen, dann ein zweites
  // volles Band. Nieten allein reichten nicht: acht Nieten von 1,6 Einheiten
  // sind auf 52 px vier Bildpunkte, gemessen in tests/zeichen.
  reif:    [{nieten:0,  innen:0}, {nieten:8, innen:1}, {nieten:16, innen:2}],
  kerben:  [{n:40, kurz:2.6, lang:3.8}, {n:56, kurz:3.4, lang:5.0}, {n:72, kurz:4.2, lang:6.4}],
  strahl:  [{n:12, lang:12, kurz:6.0}, {n:16, lang:16, kurz:8.0}, {n:24, lang:20, kurz:10}],
  lorbeer: [{bl:5, gr:.86, beeren:0}, {bl:7, gr:1.00, beeren:0}, {bl:9, gr:1.14, beeren:1}],
};
// Der Ordensstern startet mit acht Zacken und bekommt je so vieler
// weiterer Punkte eine dazu. Er braucht keine Grade — die Zacken sind
// bereits die feine Abstufung, und zwar eine ohne Ende.
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

function _insDefs(id, metall){
  const mH = _insMix(metall, '#FFFFFF', .60);
  const mM = metall;
  const mT = _insMix(metall, '#080B0E', .52);
  const st = (o, c, op) => `<stop offset="${o}" stop-color="${c}"${op ? ` stop-opacity="${op}"` : ''}/>`;
  const lin = (n, x1,y1,x2,y2, stops) =>
    `<linearGradient id="${id}${n}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient>`;
  return `<defs>`
    // Gold der oberen Federn: helle Spitze, satte Tiefe.
    + lin('gd', 0,0,'.15',1, st(0,'#FFF6D2') + st('.26','#F5D27C') + st('.60','#DCAA42') + st(1,'#9A6A1A'))
    // Gold der unteren Federn — dunkler, damit sich die Lagen trennen.
    + lin('gt', 0,0,'.15',1, st(0,'#E5BC61') + st('.45','#C4922F') + st(1,'#7A5210'))
    // Metall, quer beleuchtet.
    + lin('mt', 0,0,'.35',1, st(0,mH) + st('.42',mM) + st(1,mT))
    // Metall, längs — für Strahlen und Sternzacken.
    + lin('ml', 0,0,0,1, st(0,mH) + st('.55',mM) + st(1,mT))
    // Der Schildkörper: fast schwarz, oben eine Spur heller.
    + lin('sc', 0,0,0,1, st(0,'#333A42') + st('.42','#171C23') + st(1,'#070A0D'))
    // Strahlen: hell an der Wurzel, ausklingend an der Spitze.
    + `<radialGradient id="${id}sr" gradientUnits="userSpaceOnUse" cx="50" cy="50" r="56">`
      + st('.60', mH) + st('.74', mM) + st('.92', mM, '.55') + st(1, mM, '0') + `</radialGradient>`
    + `</defs>`;
}

// Metallfarbe je Rang. Von stumpf nach hell — und mit einem Hauch der
// Rangfarbe darin, damit Zeichen und Seite aus demselben Material sind.
// Ein Hauch, kein Anstrich: es bleibt Metall.
//
// Die LEGENDE bleibt bewusst Weissmetall. Ihre Rangfarbe ist Gold, und
// Gold gehoert im Zeichen den Titeln: eine goldene Schwinge auf einem
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
const INS_GOLD_TIEF = '#6E4A0E';     // die Trennkante zwischen zwei Federn

// ── Die Schwinge ─────────────────────────────────────────────────────
//     Eine Schwinge ist keine Reihe gleicher Klingen. Sie hat zwei
//     Lagen: lange Schwungfedern, die sich fächern, und darüber kurze
//     Deckfedern, die die Ansätze verdecken. Erst die zweite Lage macht
//     aus einem Kamm einen Flügel.
//
//     Von 1 zu 5 Titeln wächst deshalb nicht die Größe, sondern der
//     BAU: mehr Federn, mehr Deckung, mehr Spreizung, mehr Aufschwung.
//     Eine bloß breiter skalierte Form liest sich als „dasselbe, näher
//     dran" — vier statt sieben Federn liest sich als ein anderer Rang.

const INS_SCHWINGE = [
  // p = Schwungfedern, d = Deckfedern, L = Spannweite,
  // sp = Fächerwinkel in Grad, hub = wie weit die Schwinge aufsteigt.
  {p:4, d:3, L:40, sp:24, hub:.32},   // 1 Titel — knapp, fast angelegt
  {p:5, d:3, L:49, sp:28, hub:.50},   // 2
  {p:6, d:4, L:58, sp:33, hub:.67},   // 3
  {p:6, d:4, L:66, sp:38, hub:.84},   // 4
  {p:7, d:5, L:74, sp:43, hub:1},     // 5 — voll aufgestellt
];

// Wo die Schwinge am Wappen ansetzt. Alle Federn kommen aus dieser
// Schulter, sonst schwebt die Lage neben dem Zeichen statt daran.
const INS_SCHULTER = {x:38.2, y:1.5};

// Eine Feder: von der Wurzel zur Spitze, oben bauchig, unten flach, mit
// stumpfem Ende — eine Feder läuft nicht spitz aus, sie rundet ab.
//
// `bogen` zieht die Oberkante zur Spitze hin nach oben und macht aus dem
// geraden Blatt eine Sichel. Der Bogen wächst MONOTON (t^1.4): eine
// Sinuswölbung fiele an der Spitze auf null zurück und schnitte dort
// eine sichtbare Kerbe in die Silhouette.
function _insBlatt(sx, sy, a, L, w, bogen){
  const dx = -Math.cos(a), dy = -Math.sin(a);
  const nx = -dy, ny = dx;
  const P = (t, o) => [sx + dx * L * t + nx * o, sy + dy * L * t + ny * o];
  const b = t => bogen * L * .20 * Math.pow(t, 1.4);
  const K = ([x, y]) => _n(x) + ' ' + _n(y);
  return `M${K(P(0, -w * .34))}`
    + `C${K(P(.32, w * 1.00 + b(.32)))} ${K(P(.80, w * .70 + b(.80)))} ${K(P(.995, w * .24 + b(1)))}`
    + `C${K(P(1.02, w * .02 + b(1)))} ${K(P(1.02, -w * .16 + b(1)))} ${K(P(.985, -w * .30 + b(1)))}`
    + `C${K(P(.74, -w * .60 + b(.74)))} ${K(P(.26, -w * .90 + b(.26)))} ${K(P(0, -w * .34))}Z`;
}

function _insSchwingeEin(t, id){
  const S = INS_SCHWINGE[Math.min(5, Math.max(1, t)) - 1];
  const G = Math.PI / 180;
  const oben = (13 + 24 * S.hub) * G;             // Winkel der obersten Feder
  let sf = '', df = '';

  // Schwungfedern, von unten nach oben gezeichnet, damit die längste
  // Feder obenauf liegt und die Silhouette von ihr bestimmt wird.
  for(let i = S.p - 1; i >= 0; i--){
    const u = i / (S.p - 1);                      // 0 oben … 1 unten
    const a  = oben - u * S.sp * G;
    const L  = S.L * (1 - .36 * Math.pow(u, 1.20));
    const w  = (3.9 + 1.5 * S.hub) * (1 - .18 * u);
    const sx = INS_SCHULTER.x - u * 1.4;
    const sy = INS_SCHULTER.y + u * (2.6 - .7 * S.hub);
    sf += `<path d="${_insBlatt(sx, sy, a, L, w, S.hub)}"
        fill="url(#${id}${i % 2 ? 'gt' : 'gd'})" stroke="${INS_GOLD_TIEF}"
        stroke-width=".5" stroke-linejoin="round" stroke-opacity=".85"/>`
      // Der helle Grat auf der Oberkante — daran erkennt man die Feder.
      + `<path d="${_insBlatt(sx, sy, a, L * .93, w * .26, S.hub)}"
        fill="#FFF8DE" opacity="${(.26 - i * .028).toFixed(2)}"/>`;
  }

  // Deckfedern: kurz, rund, überlappend. Sie verdecken alle Ansätze —
  // ohne sie sieht man den Fächerpunkt und die Lage fällt auseinander.
  for(let i = S.d - 1; i >= 0; i--){
    const u = i / Math.max(1, S.d - 1);
    const a  = (oben - 5 * G) - u * (S.sp - 10) * G;
    const L  = S.L * (.30 - .05 * u);
    const w  = 3.4 + 1.0 * S.hub;
    const sx = INS_SCHULTER.x + 1.8 - u * .6;
    const sy = INS_SCHULTER.y - 1.2 + u * 2.8;
    df += `<path d="${_insBlatt(sx, sy, a, L, w, S.hub * .5)}"
        fill="url(#${id}gd)" stroke="${INS_GOLD_TIEF}"
        stroke-width=".55" stroke-linejoin="round"/>`
      + `<path d="${_insBlatt(sx, sy, a, L * .86, w * .28, S.hub * .5)}"
        fill="#FFFCEE" opacity=".26"/>`;
  }
  return sf + df;
}

// Ohne Titel bleibt die Schwinge da, aber sie ist Metall und tritt
// zurück: gefüllt UND umrandet, damit die Federn zu einer ruhigen
// Silhouette verschmelzen statt sich als Gekritzel zu überlagern.
function _insSchwingeLeer(metall){
  const S = INS_SCHWINGE[0], G = Math.PI / 180;
  const oben = (13 + 24 * S.hub) * G;
  let l = '';
  for(let i = S.p - 1; i >= 0; i--){
    const u = i / (S.p - 1);
    l += `<path d="${_insBlatt(INS_SCHULTER.x - u * 1.4, INS_SCHULTER.y + u * 2.4,
        oben - u * S.sp * G, S.L * (1 - .36 * Math.pow(u, 1.20)), 3.8 * (1 - .18 * u), S.hub)}"
      fill="${_insMix(metall, '#05070A', .74)}" stroke="${metall}"
      stroke-width=".8" stroke-opacity=".62" stroke-linejoin="round"/>`;
  }
  return l;
}

function _insSchwingen(titel, metall, id){
  const t = Math.min(titel, 5);
  const l = t === 0 ? _insSchwingeLeer(metall) : _insSchwingeEin(t, id);
  return `<g>${l}</g><g transform="translate(100,0) scale(-1,1)">${l}</g>`;
}

// ── Das Wappen ───────────────────────────────────────────────────────
//     Es trägt die LIGA-POSITION, nicht die Titelzahl: die Zahl, die sich
//     jede Woche ändert, gegenüber den Titeln, die bleiben. Es ist immer
//     gefüllt und immer lesbar — nie ein leerer Umriss, der wie ein
//     verrutschtes Kästchen aussieht. Der Rand ist Metall, solange keine
//     Titel da sind, und wird golden, sobald welche da sind.

const INS_WAPPEN = 'M37.6 -13.2H62.4V2.8C62.4 12.6 56.5 19.4 50 23.2C43.5 19.4 37.6 12.6 37.6 2.8Z';

// Die Titel stehen als Sterne über dem Wappen — die Schwinge zeigt, DASS
// da etwas ist, die Sterne sagen, wie viel. Bis vier wird gezählt, ab
// fünf übernimmt die Krone: dann ist die Reihe voll und die Zahl egal.
//
// Sie sitzen auf einem flachen Bogen, nicht in einer Reihe: derselbe
// Griff, mit dem Vereinswappen ihre Meisterschaften tragen. Der Bogen
// hat seinen Mittelpunkt tief unter dem Wappen, deshalb ist er kaum
// gekrümmt — gerade genug, dass die Reihe nicht wie ein Lineal wirkt.
const INS_STERN_M = {x:50, y:8}, INS_STERN_R = 29.5, INS_STERN_SCHRITT = 15.5;

function _insSternPfad(cx, cy, r){
  let d = '';
  for(let i = 0; i < 10; i++){
    const a = i / 10 * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * .44 : r;
    d += (i ? 'L' : 'M') + _n(cx + Math.cos(a) * rr) + ' ' + _n(cy + Math.sin(a) * rr);
  }
  return d + 'Z';
}

function _insSterne(n, id){
  let s = '';
  for(let i = 0; i < n; i++){
    const w = (i - (n - 1) / 2) * INS_STERN_SCHRITT * Math.PI / 180;
    const cx = INS_STERN_M.x + Math.sin(w) * INS_STERN_R;
    const cy = INS_STERN_M.y - Math.cos(w) * INS_STERN_R;
    s += `<path d="${_insSternPfad(cx, cy, 3.4)}" fill="url(#${id}gd)"
      stroke="${INS_GOLD_TIEF}" stroke-width=".55" stroke-linejoin="round"/>`;
  }
  return s;
}

function _insSchild(pos, titel, metall, id){
  const rand = titel > 0 ? INS_GOLD : _insMix(metall, '#FFFFFF', .25);
  const kante = titel > 0 ? INS_GOLD_TIEF : _insMix(metall, '#080B0E', .6);
  let s = '';
  if(titel > 0 && titel < 5) s += _insSterne(titel, id);
  if(titel >= 5){
    // Volle Entfaltung: die Krone kommt obenauf, die Sterne treten ab.
    const zack = [[38.8,-14],[40.8,-25.8],[45.4,-19.4],[50,-30.2],[54.6,-19.4],[59.2,-25.8],[61.2,-14]]
      .map(p => p.join(' ')).join('L');
    s += `<path d="M${zack}Z" fill="url(#${id}gd)" stroke="${INS_GOLD_TIEF}"
        stroke-width=".6" stroke-linejoin="round"/>`
      + [[40.8,-27.1],[50,-31.5],[59.2,-27.1]]
        .map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="1.9" fill="url(#${id}gd)"
          stroke="${INS_GOLD_TIEF}" stroke-width=".5"/>`).join('');
  }
  s += `<path d="${INS_WAPPEN}" fill="url(#${id}sc)" stroke="${rand}" stroke-width="1.6"
      stroke-linejoin="round" stroke-opacity="${titel > 0 ? 1 : .72}"/>`
    // Außenkante dunkel absetzen, damit das Wappen vor der Schwinge steht.
    + `<path d="${INS_WAPPEN}" fill="none" stroke="${kante}" stroke-width=".6"
      stroke-linejoin="round" opacity=".9"
      transform="translate(50,5) scale(1.09) translate(-50,-5)"/>`
    // Innenkante: ein Haarstrich, der dem Wappen Tiefe gibt.
    + `<path d="${INS_WAPPEN}" fill="none" stroke="${rand}" stroke-width=".5"
      stroke-linejoin="round" opacity=".30"
      transform="translate(50,5) scale(.84) translate(-50,-5)"/>`;
  if(pos > 0){
    s += `<text x="50" y="8" text-anchor="middle" font-size="16.5"
      font-family="'Archivo Black',sans-serif" font-weight="700"
      fill="${titel > 0 ? '#FFF3C4' : _insMix(metall,'#FFFFFF',.5)}">${pos}</text>`;
  }
  return s;
}

// ── Der Reif: fünf Stufen ────────────────────────────────────────────
//     Immer derselbe Doppelring als Grundkörper, damit alle fünf Stufen
//     als eine Familie lesbar bleiben. Der Schmuck kommt außen dazu —
//     die Mitte gehört dem Avatar.
//
//       Reif          ein glatter Reif
//       Kerbring      derselbe Reif, geriffelt wie eine geprägte Münze
//       Strahlenkranz Strahlen nach außen
//       Lorbeerreif   ein Kranz, der die Flanken hinaufläuft
//       Ordensstern   ein Stern hinter dem Reif, der weiterwächst

const INS_R = 40;

function _insReif(id, metall){
  const kante = _insMix(metall, '#080B0E', .70);
  return `<circle cx="50" cy="50" r="${INS_R + 1.5}" fill="none" stroke="${kante}" stroke-width=".8"/>`
    + `<circle cx="50" cy="50" r="${INS_R}" fill="none" stroke="url(#${id}mt)" stroke-width="2.8"/>`
    + `<circle cx="50" cy="50" r="${INS_R - 1.6}" fill="none" stroke="${kante}" stroke-width=".7"/>`
    + `<circle cx="50" cy="50" r="${INS_R - 5}" fill="none" stroke="${metall}"
        stroke-width="1.1" opacity=".5"/>`;
}

// `grad` ist das Drittel der Stufe, in dem der Träger steht (0–2). Was er
// ändert, steht in INSIGNIUM_AUSBAU — und warum, ebenfalls dort.
function _insStufe(key, metall, zacken, id, grad){
  const R = INS_R;
  const g = Math.max(0, Math.min(INSIGNIUM_GRADE - 1, grad || 0));
  const A = (INSIGNIUM_AUSBAU[key] || [])[g] || {};
  const kante = _insMix(metall, '#080B0E', .68);
  const pt = (a, r) => [50 + Math.cos(a) * r, 50 + Math.sin(a) * r];
  const um = (k, f) => { let s = ''; for(let i = 0; i < k; i++) s += f(i, i / k * Math.PI * 2 - Math.PI/2); return s; };

  if(key === 'kerben'){
    // Geriffelte Außenkante wie bei einer geprägten Münze: viele feine
    // Striche, nicht wenige grobe Zähne. Jeder fünfte etwas kräftiger,
    // damit die Riffelung einen Takt bekommt.
    // Der Grad macht die Riffelung feiner: 40, 60, 80 Kerben. Ein Vielfaches
    // von fünf, sonst verliert der Takt seinen Schlag.
    return um(A.n, (i, a) => {
      const gross = i % 5 === 0;
      const [x1,y1] = pt(a, R + 1.6), [x2,y2] = pt(a, R + (gross ? A.lang : A.kurz));
      return `<line x1="${_n(x1)}" y1="${_n(y1)}" x2="${_n(x2)}" y2="${_n(y2)}"
        stroke="${metall}" stroke-width="${gross ? 1.4 : .85}"
        opacity="${gross ? .85 : .45}" stroke-linecap="round"/>`;
    }) + _insReif(id, metall);
  }

  if(key === 'strahl'){
    // Licht, kein Blech. Schlanke Schlieren ohne Kontur, die nach außen
    // ausklingen — sobald ein Strahl eine dunkle Kante bekommt, ist er
    // ein Dorn. Zwei Längen im Wechsel geben dem Kranz einen Takt.
    // Der Grad gibt Licht dazu: 12, 16, 20 Strahlen. Immer gerade, sonst
    // stoßen am Kreisschluss zwei lange aufeinander.
    return um(A.n, (i, a) => {
      const lang = i % 2 === 0;
      const r2 = R + (lang ? A.lang : A.kurz), w = lang ? .030 : .020;
      const [ax,ay] = pt(a - w, R + .5), [bx,by] = pt(a + w, R + .5), [cx,cy] = pt(a, r2);
      return `<path d="M${_n(ax)} ${_n(ay)}L${_n(cx)} ${_n(cy)}L${_n(bx)} ${_n(by)}Z"
        fill="url(#${id}sr)" opacity="${lang ? .95 : .55}"/>`;
    }) + _insReif(id, metall);
  }

  if(key === 'lorbeer'){
    // Ein echter Kranz: zwei Zweige, die unten am Knoten zusammenlaufen
    // und auf zehn und zwei Uhr auslaufen — oben bleibt die Schwinge frei.
    // Die Blätter LIEGEN am Reif an, sie strahlen nicht von ihm weg: das
    // ist der Unterschied zwischen einem Kranz und einer Wimpernreihe.
    const zweig = sp => {                            // sp = +1 rechts, -1 links
      const a0 = Math.PI/2 - sp * 0.14, a1 = Math.PI/2 - sp * 1.78;
      const rB = R + 2.6;
      const [sx,sy] = pt(a0, rB), [ex,ey] = pt(a1, rB);
      let s = `<path d="M${_n(sx)} ${_n(sy)}A${rB} ${rB} 0 0 ${sp > 0 ? 0 : 1} ${_n(ex)} ${_n(ey)}"
        fill="none" stroke="${kante}" stroke-width="1.6" stroke-linecap="round"/>`;
      // Der Grad lässt den Kranz austreiben: mehr Blätter, und größere.
      // Der Zweig bleibt gleich lang — er ist der Umriss der Stufe.
      const bl = A.bl;
      for(let i = 0; i < bl; i++){
        const t = (i + .5) / bl;
        const a = a0 + (a1 - a0) * t;
        // Groß in der Mitte des Zweigs, klein an beiden Enden.
        const gr = (0.66 + 0.52 * Math.sin(Math.PI * Math.min(1, t * 1.14))) * A.gr;
        const [x,y] = pt(a, rB + 2.6 * gr);
        // Tangential plus eine Neigung zur Spitze hin — so überlappen die
        // Blätter wie Schuppen statt zu strahlen.
        const dreh = a * 180 / Math.PI - sp * 30;
        const dr = `rotate(${_n(dreh)} ${_n(x)} ${_n(y)})`;
        s += `<ellipse cx="${_n(x)}" cy="${_n(y)}" rx="${_n(2.7*gr)}" ry="${_n(7.2*gr)}"
            transform="${dr}" fill="url(#${id}mt)" stroke="${kante}" stroke-width=".6"/>`
          + `<path d="M${_n(x)} ${_n(y-6.2*gr)}L${_n(x)} ${_n(y+6.2*gr)}" transform="${dr}"
            stroke="${kante}" stroke-width=".55" opacity=".8"/>`;
      }
      // Der höchste Grad trägt Beeren: drei Kugeln am Ansatz jedes Zweigs.
      // Sie liegen INNERHALB des Kranzes, verschieben den Umriss also nicht.
      if(A.beeren){
        for(let i = 0; i < 3; i++){
          const a = a0 - sp * (0.10 + i * 0.115);
          const [x,y] = pt(a, rB - 2.2 + (i % 2) * 1.6);
          s += `<circle cx="${_n(x)}" cy="${_n(y)}" r="1.35"
              fill="url(#${id}mt)" stroke="${kante}" stroke-width=".45"/>`;
        }
      }
      return s;
    };
    const [kx,ky] = pt(Math.PI/2, R + 5.4);
    return zweig(1) + zweig(-1)
      + `<path d="M${_n(kx)} ${_n(ky-4.2)}L${_n(kx+3.6)} ${_n(ky)}L${_n(kx)} ${_n(ky+4.2)}L${_n(kx-3.6)} ${_n(ky)}Z"
          fill="url(#${id}mt)" stroke="${kante}" stroke-width=".6" stroke-linejoin="round"/>`
      + _insReif(id, metall);
  }

  if(key === 'stern'){
    // Ein Ordensstern hat Facetten: jede Zacke aus einer hellen und einer
    // dunklen Hälfte, mit einem Grat dazwischen. Wenige große Zacken —
    // viele kleine ergäben einen Morgenstern statt eines Ordens. Der
    // Kranz darunter fasst sie zusammen, damit keine Zacke frei schwebt.
    const k = Math.max(8, zacken || 8);
    const mH = _insMix(metall, '#FFFFFF', .55), mT = _insMix(metall, '#080B0E', .18);
    const rB = R - 2.5;
    let s = `<circle cx="50" cy="50" r="${R + 1}" fill="none" stroke="${kante}"
      stroke-width="3" opacity=".45"/>`;
    for(let i = 0; i < k; i++){
      const a = i / k * Math.PI * 2 - Math.PI/2, w = Math.PI / k * .78;
      const [sx,sy] = pt(a, R + 14);
      const [lx,ly] = pt(a - w, rB), [rx,ry] = pt(a + w, rB), [bx,by] = pt(a, rB);
      s += `<path d="M${_n(sx)} ${_n(sy)}L${_n(lx)} ${_n(ly)}L${_n(bx)} ${_n(by)}Z"
          fill="${mH}" stroke="${kante}" stroke-width=".4" stroke-linejoin="round"/>`
        + `<path d="M${_n(sx)} ${_n(sy)}L${_n(rx)} ${_n(ry)}L${_n(bx)} ${_n(by)}Z"
          fill="${mT}" stroke="${kante}" stroke-width=".4" stroke-linejoin="round"/>`;
    }
    return s + _insReif(id, metall);
  }

  // Der glatte Reif. Auch er darf wachsen, sonst wäre die erste Stufe die
  // einzige ohne sichtbaren Fortschritt — ausgerechnet die, auf der man am
  // längsten steht, bevor überhaupt etwas passiert. Sechs, dann zwölf Nieten
  // auf dem Reif, im höchsten Grad dazu ein zweiter Ring innen. Alles liegt
  // IM Reif und nicht darüber hinaus, damit ein Reif ein Reif bleibt und
  // kein Zahnkranz wird.
  // Die Nieten kommen NACH dem Reif: der Reif ist ein 2,8 breiter Strich auf
  // demselben Radius und würde sie sonst zudecken.
  const innen = A.innen === 2
    ? `<circle cx="50" cy="50" r="${R - 9}" fill="none" stroke="url(#${id}mt)"
         stroke-width="2.2"/>
       <circle cx="50" cy="50" r="${R - 10.5}" fill="none" stroke="${kante}" stroke-width=".7"/>
       <circle cx="50" cy="50" r="${R - 7.5}" fill="none" stroke="${kante}" stroke-width=".7"/>`
    : A.innen === 1
    ? `<circle cx="50" cy="50" r="${R - 9}" fill="none" stroke="${metall}"
         stroke-width="1.1" opacity=".72"/>`
    : '';
  return _insReif(id, metall) + innen
    + (A.nieten ? um(A.nieten, (i, a) => {
        const [x,y] = pt(a, R);
        return `<circle cx="${_n(x)}" cy="${_n(y)}" r="1.7" fill="${metall}"
          stroke="${kante}" stroke-width=".5"/>`;
      }) : '');
}

// Das ganze Zeichen. `band:false` lässt das Titelband weg (Listen, Feed).
// `pos` überschreibt die Zahl im Schild. Das Schild zeigt sonst die Position
// der laufenden Saison — auf dem Podest der Ewigen Tafel wäre das eine zweite
// Rangfolge auf derselben Karte („02" in der Ecke, „1" im Schild), und zwei
// Zahlen, die sich widersprechen, sind schlimmer als keine.
// `titel` überschreibt die Zahl der Schwingen, aus demselben Grund wie `pos`:
// Ein Rückblick auf den Mai darf nicht die Titel tragen, die im August
// dazugekommen sind. Der REIF bleibt dabei der heutige — die Laufbahn ist
// eine Karriere und kein Monat, und sie rückwirkend zu rechnen hieße, eine
// zweite Prestige-Tabelle je Saison zu führen.
function insigniumSvg(pid, opt){
  opt = opt || {};
  const P = prestigeOf(pid);
  const rang = (getPlayerRank(pid) || {}).label;
  const metall = INS_METALL[rang] || INS_METALL.Solide;
  const band = opt.band !== false;
  const titel = band ? (opt.titel !== undefined ? opt.titel : meisterTitel(pid)) : 0;
  const id = 'i' + (++_insLauf) + '_';
  // Die neue Schwinge traegt weiter nach oben und aussen als die alte.
  // Der Rahmen waechst mit, sonst schneidet er bei fuenf Titeln die
  // oberste Feder ab. Der Reifmittelpunkt (50,50) sitzt darin bei 50 %
  // der Breite und 108/162 = 66,67 % der Hoehe — daraus folgt der
  // Versatz in [§C23], mit dem der Avatar mittig im Reif liegt.
  const box = band ? '-22 -58 144 162' : '-16 -16 132 132';
  return `<svg viewBox="${box}" class="ins" aria-hidden="true">`
    + _insDefs(id, metall)
    + (band ? _insSchwingen(titel, metall, id) : '')
    + _insStufe(P.insignie.key, metall, P.zacken, id, P.grad)
    + (opt.inner ? `<g>${opt.inner}</g>` : '')
    + (band ? _insSchild(opt.pos !== undefined ? opt.pos : ligaPosition(pid),
                          titel, metall, id) : '')
    + `</svg>`;
}

// Ein Insignium OHNE Spieler: nur die Form EINER Stufe, ohne Band und ohne
// Schild. Die Laufbahn-Leiste stellt die fünf Stufen nebeneinander, und dort
// geht es um die Stufe selbst — nicht darum, wer sie gerade trägt. Das Metall
// kommt trotzdem vom Spieler: er soll sehen, wie das Zeichen bei IHM aussähe.
function insigniumStufeSvg(key, metall, zacken, grad){
  const id = 'i' + (++_insLauf) + '_';
  return `<svg viewBox="-16 -16 132 132" class="ins" aria-hidden="true">`
    + _insDefs(id, metall)
    + _insStufe(key, metall, zacken || 0, id, grad || 0)
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
  const _metall = INS_METALL[(getPlayerRank(pid) || {}).label] || INS_METALL.Solide;
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
      <span class="lb-k-ins">${insigniumStufeSvg(ins.key, _metall, zacken, grad)}</span>
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
