// ╔═══ §13.8 ─── PRESTIGE & INSIGNIUM ──────────────────────────────────╗
//     Eine Zahl für eine ganze Laufbahn — und ein Zeichen dafür, das um
//     den Avatar liegt. Das Prestige ist KEINE zweite Rangliste: Elo sagt,
//     wie stark jemand gerade ist, Prestige sagt, was er über die Zeit
//     zusammengetragen hat.
//
//     Auszeichnungen und Monatswertungen sind unverlierbar — was einmal
//     passiert ist, bleibt passiert. Die Allzeitwertungen dagegen sind eine
//     Aussage über HEUTE: Wer einen Liga-Rekord abgibt, verliert seinen
//     Anteil daran. Das ist Absicht. „Ich halte den Rekord" ist eine
//     Behauptung in der Gegenwart; sie soll nicht dadurch wahr bleiben,
//     dass sie einmal wahr war.
//
//     DREI QUELLEN, und alle drei liegen schon vor:
//       Auszeichnungen  — die Badges [§7]
//       Monatswertungen — was jemand je in einer Monatstafel getragen hat
//       Allzeitwertungen— die Liga-Rekorde, die er heute hält
//
//     SELTENHEIT SCHLÄGT ANZAHL. Der Grundwert eines Eintrags hängt daran,
//     wie viele der gewerteten Spieler ihn überhaupt halten — gemessen an
//     den echten Daten, nicht behauptet. Was fast alle haben, ist fast
//     nichts wert; was einer hat, ist viel wert. Wächst die Liga, wächst
//     die Skala mit, weil sie mit ANTEILEN rechnet, nicht mit Köpfen.
//
//     ART SCHLÄGT SELTENHEIT. Ein seltenes Pensum ist trotzdem Pensum.
//     Leistung zählt doppelt, ein Ereignis einfach, eine Schattenseite gar
//     nicht — sie steht im Profil, aber sie zieht nichts ab und bringt
//     nichts ein. Wer schlecht spielt, verliert Elo; er soll nicht
//     zusätzlich am Prestige bluten.
//
//     FALLENDE ERTRÄGE. Der zweite Rekord ist weniger wert als der erste,
//     der zehnte weniger als der zweite (1/√n). Ohne das gewinnt am Ende,
//     wer am längsten dabei ist — genau das, was der Katalog gerade
//     losgeworden ist.
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

// Grundwert einer Allzeitwertung, bevor Art und Halterzahl darauf wirken.
// Ein heute gehaltener Liga-Rekord wiegt deutlich schwerer als eine
// Auszeichnung — es gibt ihn nur einmal in der Liga.
const PRESTIGE_REKORD = 22;
// Wie nah ein Rekord sein muss, um noch als Ziel zu gelten: höchstens die
// Hälfte des Bestwerts entfernt. Darüber ist der Hinweis entmutigend
// statt hilfreich.
const PRESTIGE_REICHWEITE = 0.5;

// Die fünf Stufen. `min` ist die Schwelle, ab der die Stufe getragen wird.
const INSIGNIEN = [
  {key:'reif',    name:'Reif',          min:0},
  {key:'kerben',  name:'Kerbring',      min:70},
  {key:'strahl',  name:'Strahlenkranz', min:170},
  {key:'lorbeer', name:'Lorbeerreif',   min:350},
  {key:'stern',   name:'Ordensstern',   min:700},
];
// Der Ordensstern startet mit acht Zacken und bekommt je so vieler
// weiterer Punkte eine dazu.
const ORDENSSTERN_START = 8;
const ORDENSSTERN_SCHRITT = 125;

// Grundwert nach gemessener Seltenheit. `anteil` = Halter / gewertete Spieler.
function prestigeGrundwert(halter, gesamt){
  if(halter <= 0) return 0;
  const anteil = halter / Math.max(1, gesamt);
  if(anteil <= 0.10) return 25;
  if(anteil <= 0.20) return 20;
  if(anteil <= 0.45) return 8;
  if(anteil <= 0.80) return 3;
  return 1;
}

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

  // Auszeichnungen
  const badgeArt = {}, badgeName = {};
  BADGES.forEach(b => { badgeArt[b.id] = BADGE_ART[b.id] || 'ereignis'; badgeName[b.id] = b.name; });
  aktive.forEach(p => {
    (getCachedBadges(p.id) || []).forEach(b => roh[p.id].badges.push(b.id));
  });

  // Monatswertungen — jeder je getragene Eintrag, auch aus alten Monaten.
  aktive.forEach(p => {
    (seasonTitleHistory(p.id) || []).forEach(r => {
      if(r.title) roh[p.id].monat.push({id:r.title.titleId, name:r.title.name, label:r.label});
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

  // 2. Halterzahlen für Auszeichnungen und Monatseinträge zählen.
  const badgeHalter = {}, monatHalter = {};
  aktive.forEach(p => {
    new Set(roh[p.id].badges).forEach(id => { badgeHalter[id] = (badgeHalter[id]||0) + 1; });
    new Set(roh[p.id].monat.map(m => m.id)).forEach(id => { monatHalter[id] = (monatHalter[id]||0) + 1; });
  });

  // 3. Punkte. Auszeichnungen zählen einmal je Badge — ihre Seltenheit
  //    steckt schon in der Halterzahl, die Anzahl der Wiederholungen
  //    würde nur wieder das Pensum belohnen.
  const out = {};
  aktive.forEach(p => {
    const r = roh[p.id];
    const quellen = [];

    let pb = 0;
    new Set(r.badges).forEach(id => {
      const w = prestigeGrundwert(badgeHalter[id], gesamt) * (PRESTIGE_ART[badgeArt[id]] ?? 1);
      if(w > 0){ pb += w; quellen.push({q:'auszeichnung', id, name:badgeName[id]||id, p:w,
        halter:badgeHalter[id], art:badgeArt[id]}); }
    });

    // Monatswertungen: nach Wert absteigend, dann fallende Erträge.
    const mw = r.monat.map(m => ({
      m, w: prestigeGrundwert(monatHalter[m.id], gesamt) * (PRESTIGE_ART[_prestigeArtVon(m.id)] ?? 1)
    })).filter(x => x.w > 0).sort((a,b) => b.w - a.w);
    let pm = 0;
    mw.forEach((x, i) => {
      const w = x.w / Math.sqrt(i + 1);
      pm += w;
      quellen.push({q:'monat', id:x.m.id, name:x.m.name, label:x.m.label, p:w,
        halter:monatHalter[x.m.id], art:_prestigeArtVon(x.m.id), rang:i + 1, voll:x.w});
    });

    // Allzeitwertungen: ein geteilter Rekord zählt geteilt.
    const rw = r.rekord.map(x => ({
      x, w: PRESTIGE_REKORD * (PRESTIGE_ART[x.art] ?? 1) / Math.max(1, halterZahl[x.id] || 1)
    })).filter(x => x.w > 0).sort((a,b) => b.w - a.w);
    let pr = 0;
    rw.forEach((x, i) => {
      const w = x.w / Math.sqrt(i + 1);
      pr += w;
      quellen.push({q:'rekord', id:x.x.id, name:x.x.name, p:w,
        halter:halterZahl[x.x.id] || 1, art:x.x.art, rang:i + 1, voll:x.w});
    });

    const punkte = Math.round(pb + pm + pr);
    out[p.id] = {
      pid:p.id, punkte,
      teile:{auszeichnung:Math.round(pb), monat:Math.round(pm), rekord:Math.round(pr)},
      zahlen:{auszeichnung:new Set(r.badges).size, monat:mw.length, rekord:rw.length},
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
                 fehlt:INSIGNIEN[1].min, zacken:0, teile:{auszeichnung:0,monat:0,rekord:0},
                 zahlen:{auszeichnung:0,monat:0,rekord:0}, quellen:[], platz:0, von:T.gesamt};
  let i = 0;
  while(i + 1 < INSIGNIEN.length && e.punkte >= INSIGNIEN[i + 1].min) i++;
  const letzte = i === INSIGNIEN.length - 1;
  return Object.assign({}, e, {
    stufe:i,
    insignie:INSIGNIEN[i],
    naechste: letzte ? null : INSIGNIEN[i + 1],
    fehlt: letzte ? 0 : INSIGNIEN[i + 1].min - e.punkte,
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
    const i = (C.rank || []).findIndex(r => r.id === pid);
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

function _insStufe(key, metall, zacken, id){
  const R = INS_R;
  const kante = _insMix(metall, '#080B0E', .68);
  const pt = (a, r) => [50 + Math.cos(a) * r, 50 + Math.sin(a) * r];
  const um = (k, f) => { let s = ''; for(let i = 0; i < k; i++) s += f(i, i / k * Math.PI * 2 - Math.PI/2); return s; };

  if(key === 'kerben'){
    // Geriffelte Außenkante wie bei einer geprägten Münze: viele feine
    // Striche, nicht wenige grobe Zähne. Jeder fünfte etwas kräftiger,
    // damit die Riffelung einen Takt bekommt.
    return um(60, (i, a) => {
      const gross = i % 5 === 0;
      const [x1,y1] = pt(a, R + 1.6), [x2,y2] = pt(a, R + (gross ? 4.6 : 3.2));
      return `<line x1="${_n(x1)}" y1="${_n(y1)}" x2="${_n(x2)}" y2="${_n(y2)}"
        stroke="${metall}" stroke-width="${gross ? 1.4 : .85}"
        opacity="${gross ? .85 : .45}" stroke-linecap="round"/>`;
    }) + _insReif(id, metall);
  }

  if(key === 'strahl'){
    // Licht, kein Blech. Schlanke Schlieren ohne Kontur, die nach außen
    // ausklingen — sobald ein Strahl eine dunkle Kante bekommt, ist er
    // ein Dorn. Zwei Längen im Wechsel geben dem Kranz einen Takt.
    return um(20, (i, a) => {
      const lang = i % 2 === 0;
      const r2 = R + (lang ? 17 : 8.5), w = lang ? .030 : .020;
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
      for(let i = 0; i < 7; i++){
        const t = (i + .5) / 7;
        const a = a0 + (a1 - a0) * t;
        // Groß in der Mitte des Zweigs, klein an beiden Enden.
        const gr = 0.66 + 0.52 * Math.sin(Math.PI * Math.min(1, t * 1.14));
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

  return _insReif(id, metall);   // reif
}

// Das ganze Zeichen. `band:false` lässt das Titelband weg (Listen, Feed).
// `pos` überschreibt die Zahl im Schild. Das Schild zeigt sonst die Position
// der laufenden Saison — auf dem Podest der Ewigen Tafel wäre das eine zweite
// Rangfolge auf derselben Karte („02" in der Ecke, „1" im Schild), und zwei
// Zahlen, die sich widersprechen, sind schlimmer als keine.
function insigniumSvg(pid, opt){
  opt = opt || {};
  const P = prestigeOf(pid);
  const rang = (getPlayerRank(pid) || {}).label;
  const metall = INS_METALL[rang] || INS_METALL.Solide;
  const band = opt.band !== false;
  const titel = band ? meisterTitel(pid) : 0;
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
    + _insStufe(P.insignie.key, metall, P.zacken, id)
    + (opt.inner ? `<g>${opt.inner}</g>` : '')
    + (band ? _insSchild(opt.pos !== undefined ? opt.pos : ligaPosition(pid),
                          titel, metall, id) : '')
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
          gewinn: Math.round(8 * (PRESTIGE_ART[d.art] ?? 1) / Math.sqrt(P.zahlen.monat + 1)),
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
  const pct = Math.max(2, Math.min(100, Math.round(drin / Math.max(1, spanne) * 100)));

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

  // Warum dieser Posten so viel wiegt. Die Seltenheit steht immer dabei,
  // der Abschlag nur, wenn es ihn gibt.
  const grund = q => {
    const teile = [];
    if(q.q === 'rekord'){
      teile.push(q.halter <= 1 ? 'allein gehalten' : `zu ${q.halter}. geteilt`);
    } else {
      if(q.label) teile.push(q.label);
      teile.push(`${q.halter} von ${P.gesamt}`);
    }
    if(q.art) teile.push(PRESTIGE_ART_NAME[q.art] || 'Ereignis');
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

    <div class="lb-hero" style="--tt:${t.c};--ttr:${t.rgb}">
      <div class="lb-ins">${insigniumSvg(pid)}</div>
      <div class="lb-h-tx">
        <div class="lb-h-stufe">${esc(P.insignie.name)}</div>
        <div class="lb-h-pts num">${P.punkte} Prestige</div>
        ${P.naechste
          ? `<div class="lb-h-next num">Noch ${P.fehlt} bis ${esc(P.naechste.name)}</div>`
          : `<div class="lb-h-next num">${P.zacken} Zacken · noch ${P.naechsteZacke} bis zur nächsten</div>`}
      </div>
    </div>
    <div class="lb-bar"><div class="lb-bar-fill" style="width:${pct}%;background:${t.c}"></div></div>

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
}
