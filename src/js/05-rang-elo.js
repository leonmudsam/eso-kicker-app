// ╔═══ §2.7 ─── RANG-SYSTEM (Durchschnitts-Saison-Elo) ─────────────────╗
//     Spieler-Rang ergibt sich aus dem durchschnittlichen Saison-Elo über
//     alle absolvierten Saisons.
// ╚═════════════════════════════════════════════════════════════════════════╝
const RANKS=[
  {label:'Legende',   icon:'crown',  color:'var(--gold)',   pct:0.10},
  {label:'Elite',     icon:'star',   color:'var(--purple)', pct:0.30},
  {label:'Stark',     icon:'medal',  color:'var(--acid)',   pct:0.60},
  {label:'Solide',    icon:'shield', color:'var(--blue)',   pct:0.85},
  {label:'Einsteiger',icon:'user',   color:'var(--orange)', pct:1.00},
];

function getSeasonAvgElos(){
  // Direkter Lookup aus getGlobalSim — der globale Sim hat bereits Karriere-Elo
  // (gewichteter Durchschnitt aller Saison-End-Elos). Vermeidet Doppelberechnung.
  const sim=getGlobalSim();
  const avgs={};
  players.forEach(p=>{
    avgs[p.id]=sim.careerElo[p.id]!==null && sim.careerElo[p.id]!==undefined
      ? Math.round(sim.careerElo[p.id]) : null;
  });
  return avgs;
}
function getAllPlayerRanks(){
  const key='allRanks_'+matches.length+'_'+_cache.version;
  if(_cache._allRanksKey===key) return _cache._allRanksData;
  const avgs=getSeasonAvgElos();
  const ranked=players
    .filter(p=>!p.hidden&&avgs[p.id]!==null&&avgs[p.id]!==undefined)
    .sort((a,b)=>avgs[b.id]-avgs[a.id]);
  const result={};
  ranked.forEach((p,idx)=>{
    const pct=(idx+1)/ranked.length;
    const rank=RANKS.find(r=>pct<=r.pct)||RANKS[RANKS.length-1];
    result[p.id]={...rank,avg:avgs[p.id]};
  });
  _cache._allRanksKey=key;
  _cache._allRanksData=result;
  return result;
}

function getPlayerRank(id){
  return getAllPlayerRanks()[id]||null;
}

// Das Rangabzeichen. Die Gestaltung steht in 02-ranking.css; hier bleibt nur
// die Farbe, weil sie vom Rang kommt und sonst als fünf Klassen im CSS
// stünde. Vorher trug das Abzeichen seine zehn Angaben im style-Attribut —
// wer die Höhe ändern wollte, musste sie im JavaScript suchen.
function rankBadgeHtml(id, size='sm'){
  const r=getPlayerRank(id); if(!r) return '';
  return `<span class="rangab${size==='lg'?' gross':''}" style="--rc:${r.color}"
    >${svgI(r.icon)}${esc(r.label)}</span>`;
}


// ── Eine Metrikleiste für alle vier Zeiträume [§C28] ─────────────────
// Vorher hatte jeder Reiter im Liga-Tab seine eigene Bedienung: die Saison
// gar keine, Woche und Tag zwei Knöpfe mit der Aufschrift „Nach Siegen" /
// „Nach Elo", die Ewige Tafel fünf mit anderer Aufschrift. Drei Sprachen
// für dieselbe Frage. Jetzt steht überall dieselbe Leiste, und der erste
// Eintrag ist die Leitgröße des Zeitraums: nach ihr wird der Erste
// bestimmt, und nur in ihr steht er als Kopfzeile über der Liste.
// Elo heißt dabei im Zeitraum der Zuwachs, in Saison und Gesamt der Stand —
// beides ist „die Elo dieses Zeitraums", nur einmal als Strecke und einmal
// als Punkt.
const METRIC_LABEL={elo:'Elo',wins:'Siege',winrate:'Siegrate',
  goaldiff:'Tordiff',prestige:'Prestige',games:'Spiele'};
// Die LIGA-Rangliste ist die Elo-Rangliste — in Saison, Woche und Tag gibt
// es dort nichts zu sortieren. Wer nach Siegrate oder Tordiff schaut, sucht
// keine Rangliste, sondern eine Bestenliste, und die steht im Awards-Tab.
// Nur die EWIGE TAFEL blickt über Saisons hinweg; dort ist die Frage „wer
// hat die beste Quote über drei Saisons" tatsächlich eine andere Frage als
// „wer hat die höchste Karriere-Elo", und nur dort steht die Leiste.
// Ein Zeitraum mit genau einer Metrik zeigt gar keine Leiste — das fällt
// unten in metrikLeisteHtml von selbst heraus.
// Die Ewige Tafel sortierte einmal nach „Serie". Eine laufende Serie ist
// aber eine Aussage über DIESE WOCHE, und sie stand in einer Tabelle, die
// über alle Saisons blickt — drei Siege am Stück brachten dort einen
// Karrierespieler vor jemanden mit dreihundert Partien. Wer die Serien
// sehen will, findet sie im Awards-Tab, wo sie hingehören. An ihrer Stelle
// steht jetzt das Prestige [§C34]: die einzige Zahl, die über die ganze
// Laufbahn geht, und die, die das Zeichen an jedem Avatar erklärt.
const PERIOD_METRICS={
  season:['elo'],
  week:  ['elo'],
  day:   ['elo'],
  all:   ['elo','winrate','goaldiff','prestige','games']
};
// Welche Metrik gilt gerade? rankMetric wird auch vom Positionen-Tab
// benutzt (dort 'atk'/'def'), und nicht jeder Zeitraum kennt jede Metrik.
// Statt das an jeder Lesestelle zu prüfen, fällt es hier einmal auf die
// Leitgröße zurück.
function metrikFuer(per){
  const liste = PERIOD_METRICS[per] || PERIOD_METRICS.all;
  return liste.includes(rankMetric) ? rankMetric : liste[0];
}
// Die Leiste selbst — ein Bauteil. Wo es nichts zu wählen gibt, steht auch
// keine Leiste: ein Umschalter mit einem Eintrag ist eine Behauptung, keine
// Bedienung.
function metrikLeisteHtml(per){
  const liste = PERIOD_METRICS[per] || PERIOD_METRICS.all;
  if(liste.length < 2) return '';
  const jetzt = metrikFuer(per);
  return `<div class="ui-tabs">${liste.map(k =>
    `<button data-metric="${k}" class="${jetzt===k?'on':''}">${METRIC_LABEL[k]}</button>`
  ).join('')}</div>`;
}

// ╔═══ §2.8 ─── ERWEITERTES ELO + AUTO-POSITION ────────────────────────╗
//     K-Faktor + Gewichtung + Score-Spread laut cfg.
// ╚═════════════════════════════════════════════════════════════════════════╝
// Bestehende DB-Felder bleiben gleich. Neu: dynamischer K + Margin-of-Victory,
// rein clientseitig berechnet (kein Schema-Umbau nötig).
function expected(a,b){ return 1/(1+Math.pow(10,(b-a)/400)); }
function posFactor(ps,sw){ return 1+sw*(0.5-ps)*2; }
function riskWeights(hi,lo,rs){ const gap=Math.min(Math.abs(hi-lo)/400,1); const s=rs*gap; return {strong:1-s,weak:1+s}; }

// ─── §2.8a Automatische Position (erwartungsbasiert + Erfahrung) ─────
// Misst NICHT nur rohe Siege, sondern:
//   1) Leistung ÜBER der Erwartung je Position (Performance)
//   2) Wie OFT der Spieler auf der Position spielt (Erfahrung)
// Wer 90% der Spiele in der Abwehr macht, hat dort einen Erfahrungs-Bonus —
// auch wenn die Siegrate schlecht ist. Sonst wird jemand, der 9/10 als Verteidiger
// spielt und dort schlecht abschneidet, fälschlich als "Stürmer" eingestuft.
// ─── Konstanten sind jetzt cfg-getunt (Defaults als Fallback) ───
const POS_MIN_GAMES_DEFAULT = 3;
const EXP_WEIGHT_DEFAULT = 0.5;
const _posMinGames = () => cfg.pos_min_games ?? POS_MIN_GAMES_DEFAULT;
const _expWeight  = () => cfg.exp_weight ?? EXP_WEIGHT_DEFAULT;

function posPerfFrom(id, matchSubset){
  if (!matchSubset || matchSubset === matches) {
    const sim = getGlobalSim();
    const t = sim.posTracker[id];
    if (t) {
      return {
        aG: t.aG, aW: t.aW, dG: t.dG, dW: t.dW,
        aWr: t.aG ? t.aW / t.aG : null,
        dWr: t.dG ? t.dW / t.dG : null,
        aPerfAvg: t.aG ? t.aPerf / t.aG : null,
        dPerfAvg: t.dG ? t.dPerf / t.dG : null
      };
    }
  }
  let aG=0,aW=0,dG=0,dW=0, aPerf=0, dPerf=0;
  for(const m of matchSubset){
    const onA=(id===m.a1||id===m.a2), onB=(id===m.b1||id===m.b2);
    if(!onA&&!onB) continue;
    const won=(onA&&m.winner==='A')||(onB&&m.winner==='B');
    const pos=id===m.a1?m.a1_pos:id===m.a2?m.a2_pos:id===m.b1?m.b1_pos:m.b2_pos;
    const myExp = onA ? (m.exp_a!=null?m.exp_a:0.5) : (m.exp_a!=null?1-m.exp_a:0.5);
    const score = won?1:0;
    const perf = score - myExp;  // >0 = über Erwartung, <0 = darunter
    if(pos==='atk'){aG++; if(won)aW++; aPerf+=perf;} else {dG++; if(won)dW++; dPerf+=perf;}
  }
  return {aG,aW,dG,dW,
    aWr:aG?aW/aG:null, dWr:dG?dW/dG:null,
    aPerfAvg:aG?aPerf/aG:null, dPerfAvg:dG?dPerf/dG:null};
}

// ─── Der Positionswert [§5.2] ────────────────────────────────────────
// Die eine Zahl, nach der die Positions-Rangliste sortiert und die dort
// als „Wert" rechts steht. Sie wiegt vier Dinge gegeneinander:
//   Siegquote auf der Position — die Hauptsache
//   Leistung gegen die Erwartung — berücksichtigt Mate- und Gegnerstärke
//   Rollenbeitrag — vorne die eigenen Tore, hinten die zugelassenen
//   Erfahrung — wächst asymptotisch, ab etwa 25 Spielen praktisch voll
// Baseline: 5 Tore/Spiel sind neutral, 10 exzellent, 0 katastrophal.
//
// Sie steht hier und nicht in der Ansicht, weil zwei Stellen sie brauchen:
// die Positions-Rangliste und der Liga-Rekord darauf [§13.1]. Zwei getrennte
// Rechnungen über dieselbe Frage driften auseinander, und dann stünde in der
// Chronik ein anderer Bester als in der Liste.
function posWert(pos, g, w, goalsAvg, perfAvg){
  if(!g) return 0;
  const expWeight = 1 - Math.exp(-g/5);
  const perfBonus = (perfAvg || 0) * 0.25;
  const roleBonus = pos === 'atk'
    ? Math.max(0, Math.min(1, goalsAvg/10)) * 0.2
    : Math.max(0, Math.min(1, (10-goalsAvg)/10)) * 0.2;
  return (w/g + perfBonus + roleBonus) * expWeight;
}

// Sturm-Anteil 0..1, kombiniert Performance + Erfahrung.
// Performance wird GEWICHTET nach Spielanzahl auf der Position (mehr Spiele = höheres Vertrauen).
// Erfahrung (wie oft auf der Position) fließt als eigener Faktor ein.
function atkStrengthFrom(id, matchSubset){
  const p=posPerfFrom(id,matchSubset);
  const total = p.aG + p.dG;
  const minG = _posMinGames();
  const aOk = p.aG>=minG, dOk = p.dG>=minG;
  if(!aOk && !dOk) return 0.5;

  // ── Faktor 1: Spielanzahl-gewichtete Performance ──
  // Statt perfAtk = aPerfAvg vs dPerfAvg direkt zu vergleichen (was bei ungleicher
  // Spielanzahl verzerrt), gewichten wir jede Performance mit der Spielanzahl.
  // So hat eine Position mit 9 Spielen 3x so viel Einfluss wie eine mit 3.
  let perfAtk;
  if(aOk && dOk){
    // Gewichteter Vergleich: perf*games normalisiert
    const aScore = p.aPerfAvg * p.aG;  // Gesamt-Überperformance im Sturm
    const dScore = p.dPerfAvg * p.dG;  // Gesamt-Überperformance in Abwehr
    // Positiv = Sturm-Spieler, Negativ = Abwehr-Spieler
    // Normalisiert auf [-1,1] durch Division durch total
    const diff = (aScore - dScore) / total;
    perfAtk = 0.5 + diff * 0.5;
  } else if(aOk) {
    perfAtk = 0.5 + p.aPerfAvg * 0.3;  // Nur Sturm-Daten: gedämpft
  } else {
    perfAtk = 0.5 - p.dPerfAvg * 0.3;  // Nur Abwehr-Daten: gedämpft
  }

  // ── Faktor 2: Erfahrung (wie oft auf der Position) ──
  const expAtk = total>0 ? p.aG/total : 0.5;

  // ── Kombination ──
  // exp_weight steuert den Mix. Bei 0.4: 60% gewichtete Performance, 40% Erfahrung.
  const ew = _expWeight();
  const combined = (1-ew)*perfAtk + ew*expAtk;
  return Math.max(0.1, Math.min(0.9, combined));
}
// Live-Stärke aus allen aktuellen Matches (für Anzeige & Vorschau)
function atkStrength(id){ return atkStrengthFrom(id, matches); }

// ╔═══ §2.9 ─── POSITIONS-KLASSIFIZIERUNG (7 Stufen) ───────────────────╗
//     Reine Sturm-Spieler -> "Stürmer", reine Abwehr -> "Verteidiger",
//     Mischformen -> 5 Zwischenstufen.
// ╚═════════════════════════════════════════════════════════════════════════╝
// Wandelt atkStrength (0.1 - 0.9) in ein Label + Icon um.
// Feingranular: 60/40-Splits sollen NICHT als reines "Flex" durchrutschen.
function posClassify(autoAtk){
  const a = autoAtk;
  if(a >= 0.78) return {label:'Reiner Stürmer',     icon:'bolt2',       tone:'atk'};
  if(a >= 0.60) return {label:'Stürmer',            icon:'bolt',        tone:'atk'};
  if(a >= 0.54) return {label:'Sturm-Flex',         icon:'bolt',        tone:'atk'};
  if(a >  0.46) return {label:'Flex',               icon:'cycle',       tone:'flex'};
  if(a >  0.40) return {label:'Abwehr-Flex',        icon:'shield',      tone:'def'};
  if(a >  0.22) return {label:'Verteidiger',        icon:'shield',      tone:'def'};
  return                {label:'Reiner Verteidiger', icon:'shieldCheck', tone:'def'};
}


// Margin-of-Victory Multiplikator (klares Ergebnis zählt mehr, knappes weniger)
function movMult(sa,sb){
  const diff=Math.abs(sa-sb), total=Math.max(sa+sb,1);
  // 1.0 bei knapp, bis ~1+mov_max_boost bei Kantersieg; logarithmisch gedämpft
  const maxBoost = cfg.mov_max_boost ?? 0.4;
  return 1 + maxBoost*(diff/(total)) * (Math.log(diff+1)/Math.log(11));
}

// computeMatch nutzt jetzt DIESELBE Engine wie der Recalc (simulateElo),
// damit die beim Speichern erzeugten Deltas exakt dem entsprechen, was nach
// einer späteren Neuberechnung in der DB steht. Es gibt nur noch EINE Wahrheit.
//
// Vorgehen: Wir bauen ein hypothetisches Match-Objekt, hängen es chronologisch
// an die aktuelle Saison-Matchliste an und lassen simulateElo darüber laufen.
// Die Deltas/exp_a des hypothetischen Matches lesen wir aus dem History-Eintrag.
function computeMatch(teamA, teamB, winner, sa, sb){
  // Optimierung: Wir starten vom End-State des gecachten globalen Sim und simulieren
  // nur das eine hypothetische Match darauf. Bei großen Match-Historien ~100× schneller.
  const HYPO_ID = '__hypo__';
  const hypo = {
    id: HYPO_ID,
    a1: teamA[0].id, a1_pos: teamA[0].pos,
    a2: teamA[1].id, a2_pos: teamA[1].pos,
    b1: teamB[0].id, b1_pos: teamB[0].pos,
    b2: teamB[1].id, b2_pos: teamB[1].pos,
    score_a: sa, score_b: sb, winner,
    created_at: new Date().toISOString()
  };

  const globalSim = getGlobalSim();
  const sim = simulateEloWithSliders([hypo], {
    initialState: globalSim,
    initialCurSeason: globalSim.curSeason
  });
  const entry = sim.history.find(h => h.matchId === HYPO_ID);
  const res = entry ? {...entry.deltas} : {};
  const expA = entry ? entry.expA : 0.5;

  // mov nur für die Anzeige ("Kantersieg ×…") — identische Formel wie in der Engine.
  const rawMov = movMult(sa, sb);
  return {res, expA, mov: rawMov};
}

async function persistNewMatch(newMatchId) {
  // Ein neues Match am Ende ändert nie vorherige Match-Deltas.
  // → Nur schreiben: dieses Match + Spieler-Stats (atk + Saison-Elo)
  // O(Spieler) statt O(alle Matches) DB-Writes.
  const sim = getGlobalSim(); // nutzt bereits das neue Match (cache invalidiert)
  const entry = sim.history.find(h => h.matchId === newMatchId);

  const writes = [];
  if(entry) {
    writes.push(
      sb.from('matches').update({ deltas: entry.deltas, exp_a: entry.expA })
        .eq('id', newMatchId)
    );
  }
  players.forEach(p => {
    const atk = atkStrengthFrom(p.id, matches);
    writes.push(sb.from('players').update({ atk }).eq('id', p.id));
  });

  const BATCH = 25;
  for(let i = 0; i < writes.length; i += BATCH) {
    await Promise.all(writes.slice(i, i + BATCH));
  }
  await syncSeasonEloToDB();
  // NEU: Zusätzliche Caches invalidieren, die durch ein neues Match beeinflusst werden
  invalidateCache(['global', 'stats', 'awards', 'badges', 'allTeamStats', 'allPastSeasons']);
}
// Schreibt eine neu berechnete Historie in die DB (Spieler-Elos + atk + Match-Deltas).
// WICHTIG: invalidiert auch die archivierten Saison-Snapshots (seasons.top_elo),
// damit das Recap-Podium nach Recalc konsistent zu der frischen Berechnung ist.
// Updates laufen in Batches parallel, um Rate-Limits zu respektieren (Supabase ~100 req/s).
async function persistRecalc(matchList){
  const BATCH_SIZE = 25;
  const runBatch = async (promises) => {
    for(let i=0; i<promises.length; i+=BATCH_SIZE){
      await Promise.all(promises.slice(i, i+BATCH_SIZE));
    }
  };
  // Positions-Stärke neu berechnen
  const atkUpdates = players.map(p=>{
    const atk = atkStrengthFrom(p.id, matchList);
    return sb.from('players').update({atk}).eq('id', p.id);
  });
  // Match-Deltas/exp_a aktualisieren (Slider-basiert)
  const{matchPatches} = recalcHistory(matchList);
  const matchUpdates = matchPatches.map(patch =>
    sb.from('matches').update({
      deltas: patch.deltas,
      exp_a: patch.exp_a
    }).eq('id', patch.id)
  );
  await runBatch([...atkUpdates, ...matchUpdates]);
  // Lokale Matches mit neuen Deltas updaten, damit die nachfolgende Archivierung
  // die frischen Werte sieht
  const patchById = {};
  matchPatches.forEach(p => { patchById[p.id] = p; });
  matches.forEach(m => {
    const p = patchById[m.id];
    if(p){ m.deltas = p.deltas; m.exp_a = p.exp_a; }
  });
  invalidateCache();
  // Archivierte Saison-Snapshots invalidieren → autoArchiveSeasons wird sie neu schreiben
  // (mit den frisch berechneten DB-Deltas → konsistent zu Profil/Recap).
  const pastIds = allPastSeasons();
  // `titles` muss mit: Die eingefrorene Chronik steht auf der alten Elo-Kurve.
  // Nach einem Recalc waeren „+148 Elo gegenueber der Vorsaison" oder „Von -65
  // zurueck auf 195" Behauptungen ueber Zahlen, die es nicht mehr gibt.
  const wipeArchives = pastIds.map(sid =>
    sb.from('seasons').update({top_elo: JSON.stringify([]), titles: null}).eq('id', sid)
  );
  await runBatch(wipeArchives);
  // Lokal: top_elo leeren, damit autoArchiveSeasons sie als stale erkennt
  seasons.forEach(s => {
    if(pastIds.includes(s.id)){ s.top_elo = JSON.stringify([]); s.titles = null; }
  });
  // Saison-Elo in DB synchronisieren
  await syncSeasonEloToDB();
  // Saisons neu archivieren mit den frischen Werten
  await autoArchiveSeasons();
}

