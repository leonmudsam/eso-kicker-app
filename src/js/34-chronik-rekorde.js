// ─── §13.4b DIE CHRONIK: EINE pro Spieler ────────────────────────────
//     Ein Saisontitel beschreibt EINEN Monat und ist jeden Monat neu zu
//     holen. Eine Chronik beschreibt die ganze LAUFBAHN — und davon trägt
//     jeder Spieler genau EINE. Nicht sieben, nicht zwölf: eine.
//
//     Warum genau eine: Wer eine Liste von zwölf Auszeichnungen trägt, hat
//     keine Auszeichnung mehr, sondern einen Lebenslauf. Die eine Chronik
//     ist der Satz, mit dem man diesen Spieler beschreibt — und weil sie
//     ligaweit vergeben wird, hat sie sonst niemand.
//
//     VERGABE — jeder Eintrag geht an den ECHTEN Bestwert (allChronicles),
//     nicht reihum. Dass trotzdem jeder Spieler nur EINEN Eintrag trägt, ist
//     eine reine Anzeige-Regel. Erreichen zwei Spieler exakt denselben Wert,
//     halten sie den Rekord GEMEINSAM — ein Tiebreak nach Siegen oder
//     Tordifferenz würde einem der beiden etwas wegnehmen, das er hat.
//
//     SUMME oder ANTEIL — die Trennlinie dieses Katalogs:
//       Ein Liga-Rekord darf eine SUMME sein, wenn die Summe die Aussage IST:
//       meiste Siege, meiste Tore, meiste Spiele, höchster Elo-Stand. Da ist
//       „viel gespielt" kein Nebeneffekt, sondern der Rekord selbst.
//       Alles, was eine EIGENSCHAFT beschreibt — wie oft jemand im letzten
//       Ball gewinnt, wie oft er zu null gewinnt, wie oft er als Außenseiter
//       gewinnt — muss ein ANTEIL sein. Sonst gewinnt immer der mit den
//       meisten Partien, und der Eintrag sagt nichts über ihn aus. Solche
//       Einträge stehen deshalb unter „Spielweise", nicht unter „Rekorde".
//
//     Reihenfolge = Wertigkeit:
//       1. Liga-Rekorde        — die harten Bestwerte (Summen und Höchststände)
//       2. Schattenseiten      — dasselbe nach unten
//       3. Spielweise          — wie jemand spielt (Anteile)
//       4. Laufbahn            — was über Monate passiert ist
//
//     Es gibt bewusst KEINE Verbindungs-Rekorde mehr („beste Quote mit
//     Partner X", „Angstgegner Y"). Sie beschrieben ein Duo, nicht einen
//     Spieler: Wer sie hielt, hatte sie halb dem anderen zu verdanken, und
//     dieselbe Zeile stand am Ende bei zwei Leuten im Profil. Eine Chronik
//     soll eine Einzelleistung sein.
//
//     Alles entsteht in EINEM Durchlauf über alle Matches (_chronicleCtx).
//     Elo aus getGlobalSim — keine zweite Rechenquelle.
const CHRON_KINDS = {
  record: {label:'Liga-Rekord',   ic:'trophyStar', ord:0},
  mark:   {label:'Bestmarke',     ic:'target',     ord:1},
  shame:  {label:'Schattenseite', ic:'ghost',      ord:2},
};
// Unter dieser Spielzahl bekommt niemand eine Chronik. Eine Laufbahn braucht
// eine Laufbahn — sonst trägt ein Gast nach zwölf Spielen einen Liga-Rekord.
const CHRON_MIN_GAMES = 30;

// Die Allzeit-Wertung jeder Disziplin [§13.1]. Es gibt keinen zweiten
// Katalog mehr: Wer hier steht, steht dort — mit demselben Namen, demselben
// Icon, demselben Ton. Nur die Zeitachse ist eine andere, und deshalb auch
// die Schwelle. So kann die Liste der Rekorde nicht mehr an der Monatstafel
// vorbeidriften, und dieselbe Aussage kann nicht zweimal im Profil landen.
const _chronRoh = DISZIPLINEN.filter(d => d.allzeit).map(d => ({
  id:d.id, name:d.name, short:d.short, ic:d.ic, tone:d.tone, art:d.art,
  kind: d.art === 'schatten' ? 'shame' : d.art === 'ereignis' ? 'mark' : 'record',
  cond:d.allzeit.cond, val:d.allzeit.val, raw:d.allzeit.raw,
  unit:d.allzeit.unit, min:d.allzeit.min, ev:d.allzeit.ev
}));

// Die Reihenfolge ist die Rangfolge: die Liga-Liste zeigt sie von oben nach
// unten, und im Profil steht der erste Rekord, den jemand hält, als sein
// Rekord. Sonst folgt sie dem Katalog — Leistung vor Ereignis vor Schatten,
// weil ein Können schwerer wiegt als ein Ereignis.
//
// Eine Siegesserie ist die Ausnahme. Sie ist zwar ein Ereignis, aber die
// eindrucksvollere Zahl als die beste Bilanz: eine Strecke, kein Schnitt.
// Eine Quote überlebt einen schlechten Abend, eine Serie nicht. Wer hier
// steht, wird vorgezogen — der Rest behält die Katalogfolge.
const CHRON_VORRANG = ['unstoppable'];

const CHRONICLES = CHRON_VORRANG
  .map(id => _chronRoh.find(c => c.id === id)).filter(Boolean)
  .concat(_chronRoh.filter(c => !CHRON_VORRANG.includes(c.id)));
const CHRONICLE_BY_ID = {};
// Einträge mit `raw`+`min` bekommen ihr `val` hier abgeleitet. Der Rohwert
// bleibt erhalten, weil die Fortschritts-Anzeige (nextRecordFor) ihn auch
// dann braucht, wenn ein Spieler die Untergrenze noch gar nicht erreicht.
CHRONICLES.forEach((c, i) => {
  c.ord = i;
  if(!c.val && c.raw){
    const min = c.min || 0;
    c.val = (p, C) => { const v = c.raw(p, C); return (v != null && isFinite(v) && v >= min) ? v : null; };
  }
  CHRONICLE_BY_ID[c.id] = c;
});

// Ein Durchlauf über ALLE Matches. Liefert pro Spieler alles, was die
// Chroniken brauchen, plus die Liga-Eckdaten.
function _chronicleCtx(){
  const key = matches.length + '_' + _cache.version;
  if(_cache._chronCtxKey === key) return _cache._chronCtx;

  const gSim = getGlobalSim();
  const pm = pmap();
  const ms = matches.slice().sort((a,b)=>mts(a)-mts(b));
  const P = {};
  const run = {}, runL = {};              // laufende Sieg-/Niederlagenserie
  const runStart = {}, runLStart = {};
  const noBlow = {}, noBlowStart = {};    // laufende Serie ohne deutliche Pleite
  const daySet = {}, dayCount = {}, dayWins = {};
  const dayElo = {};                      // pid → {Tages-Key: Elo-Summe des Tages}
  const seasonAgg = {};                   // pid → {Saison-ID: {g, w}}
  const weekAgg = {};                     // pid → {Wochen-Key: {g, w}}
  const lastRes = {};                     // pid → letztes Ergebnis (true = Sieg)
  const seasonSet = {};
  const mates = {};
  const allDays = new Set();
  const allSeasons = new Set();
  const dLabel = (k) => { const [y,m,d] = k.split('-'); return d + '.' + m + '.'; };
  const ensure = (id) => P[id] || (P[id] = {
    id, games:0, wins:0, losses:0, gf:0, ga:0, gd:0,
    atkG:0, atkW:0, defG:0, defW:0, atkGoals:0, defConceded:0,
    winStreak:0, winSpan:'', lossStreak:0, lossSpan:'',
    perfect:0, debacle:0, nail:0, bitter:0, close:0, closeW:0,
    blowW:0, blowL:0, upsets:0, days:0, maxDay:0, maxDayLabel:'',
    favG:0, favW:0,                  // Partien als Außenseiter (unter 50 % Chance)
    uplift:null, upliftMates:0,      // Effekt auf die eigenen Mitspieler
    perfDays:0, bigDays:0,           // volle Spieltage / davon ohne Niederlage
    seasons:0, firstDay:'', firstLabel:'', lastDay:'',
    peak:0, potw:0, potd:0, founder:false,
    // ── v9.20: gemessen an dem, was der Spieler selbst bestritten hat ──
    weeks:0, posWeeks:0,             // Kalenderwochen mit Spielen / davon positiv
    afterLoss:0, afterLossOpp:0,     // Antwort auf die eigene letzte Niederlage
    // ── v9.22: einzelne Ausnahmetage und -serien ──
    cleanDay:0, cleanDayLabel:'',    // groesster Spieltag ohne eine einzige Pleite
    dayElo:null, dayEloLabel:'',     // bester Elo-Tag der Laufbahn
    noBlow:0, noBlowSpan:'',         // laengste Serie ohne deutliche Niederlage
    bestMonth:null,                  // {q, g, sid} — der beste Monat seines Lebens
    rise:null, fall:null,
  });

  ms.forEach(m => {
    const day = mdayKey(m);
    allDays.add(day);
    const wd = new Date(m.created_at);
    const wkey = wd.getFullYear() + '-W' + isoWeek(wd);
    const sid = (seasonOf(m.created_at) || {}).id;
    if(sid) allSeasons.add(sid);
    const ids = [m.a1, m.a2, m.b1, m.b2];
    const mateOf = id => id===m.a1 ? m.a2 : id===m.a2 ? m.a1 : id===m.b1 ? m.b2 : m.b1;
    ids.forEach(id => {
      if(!id) return;
      const p = ensure(id);
      const onA = (id===m.a1 || id===m.a2);
      const w = (onA && m.winner==='A') || (!onA && m.winner==='B');
      const gf = onA ? m.score_a : m.score_b;
      const ga = onA ? m.score_b : m.score_a;
      const pos = id===m.a1 ? m.a1_pos : id===m.a2 ? m.a2_pos : id===m.b1 ? m.b1_pos : m.b2_pos;
      const diff = gf - ga;
      p.games++; p.gf += gf; p.ga += ga; p.gd += diff;
      if(w) p.wins++; else p.losses++;
      if(pos === 'atk'){ p.atkG++; p.atkGoals += gf; if(w) p.atkW++; }
      else             { p.defG++; p.defConceded += ga; if(w) p.defW++; }
      if(w && gf===10 && ga===0)  p.perfect++;
      if(!w && gf===0 && ga===10) p.debacle++;
      if(w && gf===10 && ga===9)  p.nail++;
      if(!w && gf===9 && ga===10) p.bitter++;
      if(Math.abs(diff) <= 2){ p.close++; if(w) p.closeW++; }
      if(w && diff >= 7) p.blowW++;
      if(!w && diff <= -7) p.blowL++;
      const exp = myExp(id, m);
      if(w && exp < 0.35) p.upsets++;
      if(exp < 0.50){ p.favG++; if(w) p.favW++; }
      if(!p.firstDay){ p.firstDay = day; p.firstLabel = sid ? seasonLabel(sid) : dLabel(day); }
      p.lastDay = day;
      if(!daySet[id]) daySet[id] = new Set();
      daySet[id].add(day);
      if(!dayCount[id]) dayCount[id] = {};
      dayCount[id][day] = (dayCount[id][day] || 0) + 1;
      if(dayCount[id][day] > p.maxDay){ p.maxDay = dayCount[id][day]; p.maxDayLabel = dLabel(day); }
      if(!dayWins[id]) dayWins[id] = {};
      if(w) dayWins[id][day] = (dayWins[id][day] || 0) + 1;
      if(!weekAgg[id]) weekAgg[id] = {};
      if(!weekAgg[id][wkey]) weekAgg[id][wkey] = {g:0, w:0};
      weekAgg[id][wkey].g++; if(w) weekAgg[id][wkey].w++;
      if(!dayElo[id]) dayElo[id] = {};
      dayElo[id][day] = (dayElo[id][day] || 0) + ((m.deltas && m.deltas[id]) || 0);
      if(sid){
        if(!seasonAgg[id]) seasonAgg[id] = {};
        if(!seasonAgg[id][sid]) seasonAgg[id][sid] = {g:0, w:0};
        seasonAgg[id][sid].g++; if(w) seasonAgg[id][sid].w++;
      }
      // Serie ohne Debakel: ein 7-Tore-Rueckstand setzt zurueck, sonst laeuft
      // sie weiter — Siege und knappe Pleiten zaehlen beide als „unversehrt".
      if(!w && diff <= -7){ noBlow[id] = 0; }
      else {
        noBlow[id] = (noBlow[id] || 0) + 1;
        if(noBlow[id] === 1) noBlowStart[id] = day;
        if(noBlow[id] > p.noBlow){
          p.noBlow = noBlow[id];
          p.noBlowSpan = noBlowStart[id] === day ? dLabel(day)
                       : (dLabel(noBlowStart[id]) + '–' + dLabel(day));
        }
      }
      // Was macht er direkt nach einer Pleite? Gezählt wird die Gelegenheit,
      // nicht das Spiel danach im Kalender — die Reihenfolge ist chronologisch.
      if(lastRes[id] === false){ p.afterLossOpp++; if(w) p.afterLoss++; }
      lastRes[id] = w;
      if(sid){ if(!seasonSet[id]) seasonSet[id] = new Set(); seasonSet[id].add(sid); }
      // Serien in beide Richtungen — die schwarze Serie ist so viel wert
      // wie die goldene, nur eben andersherum.
      if(w){
        runL[id] = 0;
        run[id] = (run[id] || 0) + 1;
        if(run[id] === 1) runStart[id] = day;
        if(run[id] > p.winStreak){
          p.winStreak = run[id];
          p.winSpan = runStart[id] === day ? dLabel(day) : (dLabel(runStart[id]) + '–' + dLabel(day));
        }
      } else {
        run[id] = 0;
        runL[id] = (runL[id] || 0) + 1;
        if(runL[id] === 1) runLStart[id] = day;
        if(runL[id] > p.lossStreak){
          p.lossStreak = runL[id];
          p.lossSpan = runLStart[id] === day ? dLabel(day) : (dLabel(runLStart[id]) + '–' + dLabel(day));
        }
      }
      // Duelle und Partnerschaften
      const mate = mateOf(id);
      if(mate){
        if(!mates[id]) mates[id] = {};
        if(!mates[id][mate]) mates[id][mate] = {g:0, w:0};
        mates[id][mate].g++; if(w) mates[id][mate].w++;
      }
    });
  });

  // Liga-Eckdaten
  const dayKeys = [...allDays].sort();
  const firstDayKey = dayKeys[0] || '';
  const C = {
    P, startElo: cfg.start_elo,
    totalDays: dayKeys.length,
    firstDay: firstDayKey,
    firstLabel: firstDayKey ? (()=>{ const [y,mo,d] = firstDayKey.split('-'); return d + '.' + mo + '.' + y; })() : '',
    seasonCount: allSeasons.size,
  };

  // Zu kurze Laufbahnen und versteckte Spieler fliegen raus, BEVOR die
  // Rekorde vergeben werden — sonst hält ein Gast den Liga-Rekord.
  Object.keys(P).forEach(id => {
    if(!pm[id] || pm[id].hidden || P[id].games < CHRON_MIN_GAMES){ delete P[id]; return; }
  });

  const potwCounts = _winnerCountsOf(matches, 'week');
  const potdCounts = _winnerCountsOf(matches, 'day');

  Object.keys(P).forEach(id => {
    const p = P[id];
    p.days = daySet[id] ? daySet[id].size : 0;
    p.seasons = seasonSet[id] ? seasonSet[id].size : 0;
    // Volle Spieltage (4+ Partien) und die makellosen darunter.
    const dc = dayCount[id] || {}, dw = dayWins[id] || {};
    const de = dayElo[id] || {};
    Object.keys(dc).forEach(day => {
      // Der groesste Tag, an dem er nichts abgegeben hat. Neun Spiele, neun
      // Siege ist eine andere Aussage als zwei Spiele, zwei Siege — deshalb
      // zaehlt hier die GROESSE des makellosen Tages, nicht ihre Anzahl.
      if((dw[day] || 0) === dc[day] && dc[day] > p.cleanDay){
        p.cleanDay = dc[day];
        p.cleanDayLabel = dLabel(day);
      }
      if(p.dayElo == null || de[day] > p.dayElo){ p.dayElo = de[day]; p.dayEloLabel = dLabel(day); }
      if(dc[day] < 4) return;
      p.bigDays++;
      if((dw[day] || 0) === dc[day]) p.perfDays++;
    });
    // Der beste Monat seines Lebens — als Quote, ab 15 Spielen in dem Monat.
    const sa = seasonAgg[id] || {};
    Object.keys(sa).forEach(sd => {
      const r = sa[sd];
      if(r.g < 15) return;
      const q = r.w / r.g;
      if(!p.bestMonth || q > p.bestMonth.q) p.bestMonth = {q, g:r.g, w:r.w, sid:sd};
    });
    p.peak = Math.round(gSim.peakElo[id] || cfg.start_elo);
    p.potw = potwCounts[id] || 0;
    p.potd = potdCounts[id] || 0;
    p.founder = !!(firstDayKey && p.firstDay === firstDayKey);

    // Kalenderwochen: wie viele hat er bestritten, wie viele davon standen
    // am Ende im Plus. Das ist die Bezugsgröße für „Der Wochenkönig".
    const wa = weekAgg[id] || {};
    const wk = Object.keys(wa);
    p.weeks = wk.length;
    p.posWeeks = wk.filter(k => wa[k].w > wa[k].g - wa[k].w).length;

    // Uplift über die ganze Laufbahn: Wie viel häufiger gewinnen seine Partner
    // MIT ihm als OHNE ihn? Gewichtet nach gemeinsamen Spielen. Die Zahl lässt
    // sich nicht durch Fleiß erzeugen — wer alles mitspielt, IST der Schnitt.
    let uNum = 0, uDen = 0, uN = 0;
    Object.keys(mates[id] || {}).forEach(mid => {
      const r = mates[id][mid], M = P[mid];
      if(!M || r.g < 25) return;
      const soloG = M.games - r.g, soloW = M.wins - r.w;
      if(soloG < 40) return;
      uNum += (r.w / r.g - soloW / soloG) * r.g;
      uDen += r.g; uN++;
    });
    p.uplift = uDen ? uNum / uDen : null;
    p.upliftMates = uN;

    // Elo-Sprünge zwischen zwei gespielten Saisons
    const played = [];
    Object.keys(gSim.seasonEndElos || {}).sort().forEach(sid => {
      const g = (gSim.seasonPlayed[sid] || {})[id] || 0;
      if(g >= 10 && gSim.seasonEndElos[sid][id] !== undefined){
        played.push({sid, elo:gSim.seasonEndElos[sid][id]});
      }
    });
    for(let i = 1; i < played.length; i++){
      const d = played[i].elo - played[i-1].elo;
      const rec = {d, from:seasonLabel(played[i-1].sid), to:seasonLabel(played[i].sid)};
      if(!p.rise || d > p.rise.d) p.rise = rec;
      if(!p.fall || d < p.fall.d) p.fall = rec;
    }

    // Früher stand hier eine Titel-Bilanz (champCount, champStreak, …). Kein
    // Rekord hat sie je gelesen — sie war ein Rest aus der Zeit, als Rekorde
    // nachzählten, wie oft jemand einen Saisontitel geholt hat. Genau das ist
    // die Doppelung, die es nicht mehr geben soll (siehe ABGRENZUNG oben).
    // Wegfallen darf sie auch deshalb, weil sie pro Spieler einen
    // seasonTitleHistory-Durchlauf gekostet hat.
  });

  _cache._chronCtxKey = key;
  _cache._chronCtx = C;
  return C;
}

// Vergabe für alle Spieler auf einmal — Liga-Rekorde brauchen ohnehin das
// ganze Feld, und der Profilaufruf wird damit zum reinen Lookup.
// Vergabe für die ganze Liga in EINEM Durchlauf.
//
// EIN REKORD = EIN BESTWERT. Jeder Rekord geht an den, der ihn wirklich hält.
// Kein Reihum-Verfahren: Wer 221 Siege hat, ist der Rekordsieger, auch wenn
// er schon den höchsten Elo-Gipfel hält. Alles andere wäre kein Rekord.
// Und wer denselben Bestwert erreicht hat, hält denselben Rekord: bei exaktem
// Gleichstand tragen ihn alle Gleichauf-Halter (entry.pids/entry.holders).
//
// Dass jeder Spieler trotzdem nur EINE Auszeichnung trägt, ist eine reine
// ANZEIGE-Regel: `byPid` behält je Spieler den wertvollsten seiner Rekorde
// (Katalog-Reihenfolge = Wertigkeit). `byId` bleibt vollständig — die
// Liga-Liste zeigt jeden Rekord mit seinem echten Halter.
function allChronicles(){
  const key = matches.length + '_' + _cache.version;
  if(_cache._chronAllKey === key) return _cache._chronAll;
  const C = _chronicleCtx();
  const byPid = {}, byId = {};
  CHRONICLES.forEach(def => {
    // Bestwert — und ALLE, die ihn halten. Ein Rekord wird nicht per
    // Tiebreak zugeteilt: Wer denselben Wert erreicht hat, hat denselben
    // Rekord. Bei exaktem Gleichstand tragen ihn beide.
    let bv = -Infinity;
    const vals = {};
    Object.keys(C.P).forEach(id => {
      const v = def.val(C.P[id], C);
      if(v == null || !isFinite(v)) return;
      vals[id] = v;
      if(v > bv) bv = v;
    });
    const pids = Object.keys(vals).filter(id => Math.abs(vals[id] - bv) <= 1e-9)
      // Nur noch die ANZEIGE-Reihenfolge, keine Auswahl mehr.
      .sort((a, b) => C.P[b].wins - C.P[a].wins || C.P[b].gd - C.P[a].gd || (a < b ? -1 : 1));
    if(!pids.length) return;
    const holders = pids.map(id => ({pid:id, ev:def.ev(C.P[id], bv, C)}));
    const entry = {
      id:def.id, name:def.name, ic:def.ic, tone:def.tone, kind:def.kind,
      cond:def.cond, ord:def.ord, pid:pids[0], pids, holders,
      shared:pids.length > 1, val:bv, ev:holders[0].ev
    };
    byId[def.id] = entry;
    // Jeder Halter bekommt den Eintrag mit SEINEM Beleg — bei geteilten
    // Rekorden steht bei jedem die eigene Zahl, nicht die des anderen.
    holders.forEach(h => {
      if(byPid[h.pid]) return;        // erster Treffer = wertvollster
      byPid[h.pid] = Object.assign({}, entry, {ev:h.ev, mine:h.pid});
    });
  });
  const res = {byPid, byId, rated:Object.keys(C.P).length};
  _cache._chronAllKey = key;
  _cache._chronAll = res;
  return res;
}

// Namen aller Halter eines Rekords, fertig für die Anzeige („Leon & Martin").
// Alle Liga-Rekorde, die ein Spieler haelt — in Katalog-Reihenfolge, also
// wertvollster zuerst. `chronicleOf` liefert davon nur den ersten; das Profil
// zeigt den Rest hinter „Mehr anzeigen".
function chroniclesOfPlayer(pid){
  let all;
  try { all = allChronicles(); } catch(e){ return []; }
  const out = [];
  CHRONICLES.forEach(def => {
    const e = all.byId[def.id];
    if(!e) return;
    const h = (e.holders || [{pid:e.pid, ev:e.ev}]).find(x => x.pid === pid);
    if(!h) return;
    out.push(Object.assign({}, e, {ev:h.ev, mine:pid}));
  });
  return out;
}

function _chronHolderNames(entry){
  if(!entry) return '';
  const names = (entry.pids || [entry.pid]).map(id => { const p = pmap()[id]; return p ? p.name : '?'; });
  return names.length > 1 ? names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1] : names[0];
}

// Was fehlt einem Spieler ohne Rekord bis zum nächstgelegenen? Nur zählbare
// Rekorde kommen infrage (`unit`) — und keine Schattenseiten: „noch drei
// 0:10-Niederlagen" wäre ein Ziel, das niemand haben will.
// Gewählt wird der RELATIV nächste, damit nicht immer derselbe Rekord mit
// der kleinsten absoluten Zahl vorschlägt.
function nextRecordFor(pid){
  let C, all;
  try { C = _chronicleCtx(); all = allChronicles(); } catch(e){ return null; }
  const p = C.P[pid];
  if(!p || all.byPid[pid]) return null;
  let best = null;
  CHRONICLES.forEach(def => {
    if(!def.unit || def.kind === 'shame') return;
    const mine = def.raw(p, C);
    if(mine == null || !isFinite(mine)) return;
    const lead = all.byId[def.id];
    // Ohne Halter reicht die Untergrenze, sonst muss der Bestwert fallen.
    const target = lead ? lead.val : (def.min || 0);
    const need = lead ? Math.floor(target - mine) + 1 : Math.ceil(target - mine);
    if(need <= 0) return;
    const rel = need / Math.max(1, target);
    if(!best || rel < best.rel){
      best = {def, rel, need, mine, lead,
              holder: lead ? _chronHolderNames(lead) : null, target};
    }
  });
  if(!best) return null;
  return {
    id:best.def.id, name:best.def.name, ic:best.def.ic, tone:best.def.tone,
    cond:best.def.cond, need:best.need, unit:best.def.unit,
    have:Math.round(best.mine), target:Math.round(best.target),
    holder:best.holder,
    txt: `Noch ${best.need} ${best.def.unit}` +
         (best.holder ? ` — ${best.holder} hält ${Math.round(best.target)}`
                      : ` bis zur Untergrenze von ${Math.round(best.target)}`)
  };
}

// Die eine Chronik eines Spielers — oder null.
function chronicleOf(pid){
  try { return allChronicles().byPid[pid] || null; } catch(e){ return null; }
}

// Wer hält welche Chronik? Für die Liga-Ansicht. {chronId → Chronik}
function chronicleHolders(){
  try { return allChronicles().byId; } catch(e){ return {}; }
}

// Der Titel, der im Profil unter dem Namen steht: laufender Saisontitel vor
// letztem abgeschlossenem. Ehrentitel gibt es bewusst nicht mehr — sie waren
// nur eine zweite Anzeige derselben Aussage.
function playerTitleBadge(pid){
  const rows = seasonTitleHistory(pid);
  const cur = rows.find(r => r.live && r.title);
  if(cur) return {kind:'season', name:cur.title.name, ic:cur.title.ic, tone:cur.title.tone,
                  sub:cur.label + ' · läuft', live:true, sid:cur.sid, ev:cur.title.ev};
  for(let i = rows.length - 1; i >= 0; i--){
    if(!rows[i].live && rows[i].title){
      const r = rows[i];
      return {kind:'season', name:r.title.name, ic:r.title.ic, tone:r.title.tone,
              sub:r.label, live:false, sid:r.sid, ev:r.title.ev};
    }
  }
  return null;
}

// ─── §13.4c Titelrennen der laufenden Saison ─────────────────────────
// Wer führt gerade bei welchem Titel — und wie klar? Genutzt vom
// „Tafel im Entstehen"-Block und von der Fun-Fact-Vorlage.
// Nutzt denselben Durchlauf, nur auf die laufende Saison angewendet.
function seasonTitleRace(sid){
  if(!sid) sid = currentSeason().id;
  const t = seasonTitles(sid);
  const C = _seasonTitleCtx(sid);
  const takenNow = new Set(t.awarded.map(a => a.pid));
  return SEASON_TITLES.map(def => {
    const held = t.awarded.find(a => a.titleId === def.id);
    if(held){
      // Verfolger: bester freier Spieler, der die Bedingung ebenfalls erfüllt
      const chase = def.pick(C, new Set([...takenNow].filter(x => x !== held.pid).concat([held.pid])));
      return {titleId:def.id, name:def.name, ic:def.ic, tone:def.tone, cond:def.cond,
              pid:held.pid, ev:held.ev, chaser:chase || null};
    }
    return {titleId:def.id, name:def.name, ic:def.ic, tone:def.tone, cond:def.cond,
            pid:null, ev:null, chaser:null};
  });
}

