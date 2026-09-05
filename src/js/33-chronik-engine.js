// ─── §13.2 Kontext: EIN Pass über die Saison ─────────────────────────
// Alles, was die Titel brauchen, entsteht hier — kein Titel rechnet selbst.
function _seasonTitleCtx(sid){
  const cur = currentSeason().id;
  const live = (sid === cur);
  const ms = matchesInSeason(sid).slice().sort((a,b)=>mts(a)-mts(b));
  const gSim = getGlobalSim();
  // Elo-Quelle: abgeschlossene Saison → archivierter End-Stand aus dem Sim,
  // laufende Saison → aktueller Stand. Beides derselbe Sim wie die Rangliste.
  const eloMap = live ? (gSim.elo || {}) : (gSim.seasonEndElos[sid] || {});
  const hidden = new Set(players.filter(p=>p.hidden).map(p=>p.id));
  const P = {};
  const daySet = {};        // pid → Set(dayKey)
  const dayCount = {};      // pid → {dayKey: n}
  const dayWins = {};       // pid → {dayKey: Siege an diesem Tag}
  const allDays = new Set();
  const run = {};           // pid → laufende Siegesserie
  const runStart = {};      // pid → erster Tag der laufenden Serie
  const lrun = {};          // pid → laufende Niederlagenserie
  const lrunStart = {};     // pid → erster Tag der laufenden Pleitenserie
  const lastRes = {};        // pid → letztes Ergebnis (true = Sieg)
  const matesOf = {};        // pid → {mateId: Spiele}
  const gegnerOf = {};       // pid → {gegnerId: {g, w}} — für Bezwinger und Breite
  const bannLauf = {};       // pid|gegner → Niederlagen in Folge gegen diesen
  const nachDebakel = {};    // pid → letzte Partie war ein Debakel?
  const ensure = (id) => P[id] || (P[id] = {
    games:0, wins:0, losses:0, gf:0, ga:0, gd:0,
    atkG:0, atkW:0, defG:0, defW:0, atkGoals:0, defConceded:0,
    bestStreak:0, streakSpan:'', nail:0, bitter:0, perfect:0, debacle:0,
    upsets:0, days:0, maxDay:0, maxDayLabel:'', elo:0, growth:null,
    blowouts:0, afterLoss:0,
    potd:0, posDays:0,           // Player-of-the-Day-Titel / Tage mit positiver Bilanz
    // ── v9.18: Grundlage für quotenbasierte Titel ──
    close:0, closeW:0,           // Partien mit höchstens 2 Toren Unterschied
    worstLoss:0, lossSpan:'',    // längste Niederlagenserie der Saison
    afterLossOpp:0,              // Gelegenheiten, direkt nach einer Pleite zu antworten
    firstG:0, firstW:0,          // erstes Match eines Spieltags
    lastG:0, lastW:0,            // letztes Match eines Spieltags
    // ── v9.19: Kennzahlen, die eine Person beschreiben, nicht ihr Pensum ──
    favG:0, favW:0,              // Partien als Außenseiter (unter 50 % Chance)
    // ── v9.21: der Erwartungswert als Maßstab ──
    // expSum ist die Summe der Siegwahrscheinlichkeiten aus myExp — dieselbe
    // Zahl, die schon für `upsets` berechnet wird, nur aufsummiert. Daraus
    // entsteht das Soll eines Monats, gegen das sich das Ist messen lässt.
    expSum:0,
    favoritG:0, favoritW:0,      // Partien als Favorit (ab 60 % Chance)
    gleichG:0, gleichW:0,        // Partien, die die Rechnung offen sah (45–55 %)
    langG:0, langW:0,            // Partien an Abenden mit 8+ eigenen Spielen
    fruehG:0, fruehW:0,          // die ersten drei Partien eines Abends
    spaetG:0, spaetW:0,          // ab der sechsten Partie eines Abends
    antwortG:0, antwortW:0,      // die Partie direkt nach einem Debakel
    bann:0,                      // Angstgegner nach 12 Pleiten in Folge besiegt
    blowL:0,                     // Niederlagen mit 7+ Toren Rückstand
    bigDays:0, perfDays:0,       // Spieltage mit 4+ Partien / davon ohne Pleite
    uplift:null, upliftMates:0,  // wie viel besser Mitspieler an seiner Seite sind
    // Elo-Verlauf innerhalb der Saison (aus der Sim-History, kein Nachrechnen)
    eloHigh:null
  });
  const dLabel = (key) => {
    const [y,m,d] = key.split('-');
    return d + '.' + m + '.';
  };
  // Letztes Match je Spieltag — ms ist chronologisch, also gewinnt der letzte
  // Durchlauf. Wird für „Der Schlussstrich" gebraucht.
  const lastOfDay = {};
  // Wie viele Partien jemand an einem Tag insgesamt macht, steht erst am Ende
  // fest — „Der Marathon" braucht es aber schon beim ersten Spiel des Abends.
  // Deshalb hier gleich mitgezählt, im ohnehin vorhandenen Durchlauf.
  const tagGesamt = {};
  ms.forEach(m => {
    const d = mdayKey(m);
    lastOfDay[d] = m.id;
    [m.a1, m.a2, m.b1, m.b2].forEach(id => {
      if(!id) return;
      const k = id + '|' + d;
      tagGesamt[k] = (tagGesamt[k] || 0) + 1;
    });
  });
  const daySeen = {};
  // Elo-Stand nach jedem Match — dieselbe Quelle wie Rangliste und Profil.
  let histById = null;
  try { histById = getHistoryByMatchId(); } catch(e){ histById = null; }

  ms.forEach(m => {
    const day = mdayKey(m);
    allDays.add(day);
    const isFirstOfDay = !daySeen[day];
    daySeen[day] = true;
    const isLastOfDay = (lastOfDay[day] === m.id);
    const hEntry = histById ? histById.get(m.id) : null;
    const eloAfter = (hEntry && hEntry.eloAfter) || null;
    const mateOf = id => id===m.a1 ? m.a2 : id===m.a2 ? m.a1 : id===m.b1 ? m.b2 : m.b1;
    [m.a1, m.a2, m.b1, m.b2].forEach(id => {
      if(!id) return;
      const p = ensure(id);
      const onA = (id===m.a1 || id===m.a2);
      const w = (onA && m.winner==='A') || (!onA && m.winner==='B');
      const gf = onA ? m.score_a : m.score_b;
      const ga = onA ? m.score_b : m.score_a;
      const pos = id===m.a1 ? m.a1_pos : id===m.a2 ? m.a2_pos : id===m.b1 ? m.b1_pos : m.b2_pos;
      p.games++; p.gf += gf; p.ga += ga; p.gd += (gf - ga);
      if(w) p.wins++; else p.losses++;
      if(pos === 'atk'){ p.atkG++; p.atkGoals += gf; if(w) p.atkW++; }
      else             { p.defG++; p.defConceded += ga; if(w) p.defW++; }
      if(w && gf===10 && ga===9)  p.nail++;
      if(!w && gf===9 && ga===10) p.bitter++;
      if(w && gf===10 && ga===0)  p.perfect++;
      if(!w && gf===0 && ga===10) p.debacle++;
      const exp = myExp(id, m);
      if(w && exp < 0.35) p.upsets++;
      // Außenseiter-Partien: alles, wo die Rechnung gegen ihn stand. Nicht nur
      // die krassen Fälle (das ist `upsets`), sondern jede Partie, in die er
      // als der Schwächere ging.
      if(exp < 0.50){ p.favG++; if(w) p.favW++; }
      p.expSum += exp;
      if(exp >= 0.60){ p.favoritG++; if(w) p.favoritW++; }
      if(exp >= 0.45 && exp <= 0.55){ p.gleichG++; if(w) p.gleichW++; }
      if(w && gf - ga >= 7) p.blowouts++;
      if(!w && gf - ga <= -7) p.blowL++;
      // Die Antwort auf ein Debakel. Erst auswerten, dann die Marke für die
      // nächste Partie setzen — sonst zählte das Debakel sich selbst als
      // Antwort auf sich.
      if(nachDebakel[id]){ p.antwortG++; if(w) p.antwortW++; }
      nachDebakel[id] = (!w && gf - ga <= -7);
      // Enge Partien: höchstens zwei Tore Unterschied, egal in welche Richtung.
      if(Math.abs(gf - ga) <= 2){ p.close++; if(w) p.closeW++; }
      // Erstes und letztes Match eines Spieltags.
      if(isFirstOfDay){ p.firstG++; if(w) p.firstW++; }
      if(isLastOfDay){ p.lastG++; if(w) p.lastW++; }
      // Sieg direkt nach einer Niederlage — die Reaktion, nicht der Lauf.
      // afterLossOpp zählt die Gelegenheiten, damit daraus eine QUOTE wird und
      // nicht bloß „wer am meisten spielt, verliert am meisten und antwortet
      // am meisten".
      if(lastRes[id] === false){ p.afterLossOpp++; if(w) p.afterLoss++; }
      lastRes[id] = w;
      // Duell-Tabelle je Gegner — dasselbe Muster wie matesOf, nur für die
      // andere Seite des Tisches. Trägt Bezwinger, Breite und den Bann.
      const foes = onA ? [m.b1, m.b2] : [m.a1, m.a2];
      foes.forEach(fid => {
        if(!fid) return;
        if(!gegnerOf[id]) gegnerOf[id] = {};
        if(!gegnerOf[id][fid]) gegnerOf[id][fid] = {g:0, w:0};
        gegnerOf[id][fid].g++;
        const bk = id + '|' + fid;
        if(w){
          gegnerOf[id][fid].w++;
          if((bannLauf[bk] || 0) >= 12) p.bann++;
          bannLauf[bk] = 0;
        } else {
          bannLauf[bk] = (bannLauf[bk] || 0) + 1;
        }
      });
      // Stamm-Partner: mit wem war man am häufigsten in einem Team?
      const mate = mateOf(id);
      if(mate){
        if(!matesOf[id]) matesOf[id] = {};
        if(!matesOf[id][mate]) matesOf[id][mate] = {g:0, w:0};
        matesOf[id][mate].g++;
        if(w) matesOf[id][mate].w++;
      }
      // Spieltage
      if(!daySet[id]) daySet[id] = new Set();
      daySet[id].add(day);
      if(!dayCount[id]) dayCount[id] = {};
      dayCount[id][day] = (dayCount[id][day] || 0) + 1;
      if(dayCount[id][day] > p.maxDay){ p.maxDay = dayCount[id][day]; p.maxDayLabel = dLabel(day); }
      // Der Stand nach dem Hochzählen IST die Nummer der Partie an diesem
      // Abend — kein zweiter Zähler nötig.
      const nrImAbend = dayCount[id][day];
      if(nrImAbend <= 3){ p.fruehG++; if(w) p.fruehW++; }
      if(nrImAbend >= 6){ p.spaetG++; if(w) p.spaetW++; }
      if((tagGesamt[id + '|' + day] || 0) >= 8){ p.langG++; if(w) p.langW++; }
      if(!dayWins[id]) dayWins[id] = {};
      if(w) dayWins[id][day] = (dayWins[id][day] || 0) + 1;
      // Längste Siegesserie inkl. Zeitraum (für den Beleg-Text)
      if(w){
        run[id] = (run[id] || 0) + 1;
        if(run[id] === 1) runStart[id] = day;
        if(run[id] > p.bestStreak){
          p.bestStreak = run[id];
          p.streakSpan = runStart[id] === day ? dLabel(day) : (dLabel(runStart[id]) + '–' + dLabel(day));
        }
      } else {
        run[id] = 0;
      }
      // Längste Niederlagenserie — Spiegelbild, für „Durststrecke" und
      // „Der Unerschütterliche".
      if(!w){
        lrun[id] = (lrun[id] || 0) + 1;
        if(lrun[id] === 1) lrunStart[id] = day;
        if(lrun[id] > p.worstLoss){
          p.worstLoss = lrun[id];
          p.lossSpan = lrunStart[id] === day ? dLabel(day) : (dLabel(lrunStart[id]) + '–' + dLabel(day));
        }
      } else {
        lrun[id] = 0;
      }
      // Saison-Hoch der Elo — die einzige Verlaufszahl, die die Tafel noch
      // braucht. Der Rückfall danach wurde für „Der Phönix" gerechnet; den
      // gibt es nicht mehr.
      if(eloAfter){
        const ea = eloAfter[id];
        if(ea !== undefined && isFinite(ea) && (p.eloHigh === null || ea > p.eloHigh)) p.eloHigh = ea;
      }
    });
  });

  // Elo, Vorsaison-Zuwachs, Spieltage; zu wenig gespielt oder versteckt → raus
  const prevId = _prevSeasonId(sid);
  const prevElos = prevId ? (gSim.seasonEndElos[prevId] || {}) : {};
  const prevPlayed = prevId ? (gSim.seasonPlayed[prevId] || {}) : {};
  Object.keys(P).forEach(id => {
    const p = P[id];
    if(hidden.has(id) || p.games < TITLE_MIN_GAMES || !pmap()[id]){ delete P[id]; return; }
    p.days = daySet[id] ? daySet[id].size : 0;
    p.elo = Math.round(eloMap[id] !== undefined ? eloMap[id] : cfg.start_elo);
    // Zuwachs nur, wenn die Vorsaison überhaupt gespielt wurde — sonst wäre
    // „von 0 auf 300" kein Aufstieg, sondern ein Debüt.
    if(prevId && (prevPlayed[id] || 0) >= 10){
      p.growth = p.elo - Math.round(prevElos[id] !== undefined ? prevElos[id] : cfg.start_elo);
    }
  });

  // Spieltage mit vollem Programm (4+ Partien) und die makellosen darunter.
  // Ein Tag mit zwei Spielen kann kein „makelloser Tag" sein — sonst hätte ihn
  // jeder, der einmal kurz vorbeischaut und beide gewinnt.
  // Ein Spieltag ist ein Tag, kein Monat: Ein Spieler kann jeden einzelnen
  // davon gewinnen oder verlieren. Die Player-of-the-Day-Titel kommen aus
  // derselben Quelle wie das Badge — Tage liegen nie über einem Monatsende,
  // also ist die Saison-Teilmenge hier deckungsgleich mit der Gesamtrechnung.
  const potdOfSeason = _winnerCountsOf(ms, 'day');
  Object.keys(P).forEach(id => {
    const dc = dayCount[id] || {}, dw = dayWins[id] || {};
    let big = 0, perf = 0, pos = 0, bestPerfTag = 0;
    const quoten = [];
    Object.keys(dc).forEach(day => {
      const w = dw[day] || 0;
      if(w > dc[day] - w) pos++;
      // Ein Abend, an dem nichts schiefging — die Zahl der Partien ist das
      // Maß. Ab drei Partien zählt der Tag außerdem für die Schwankung:
      // darunter ist eine Quote von 0 oder 100 % kein Befund, sondern Zufall.
      if(w === dc[day] && dc[day] > bestPerfTag) bestPerfTag = dc[day];
      if(dc[day] >= 3) quoten.push(w / dc[day]);
      if(dc[day] < 4) return;
      big++;
      if(w === dc[day]) perf++;
    });
    P[id].bigDays = big;
    P[id].perfDays = perf;
    P[id].posDays = pos;
    P[id].bestPerfTag = bestPerfTag;
    P[id].tageGewertet = quoten.length;
    // Streuung der Tagesquoten: wie weit liegen die Abende auseinander?
    // Klein heißt gleichmäßig, nicht gut — „Der Gleichmütige" ist eine
    // Eigenart, keine Wertung.
    if(quoten.length >= 4){
      const mw = quoten.reduce((a, b) => a + b, 0) / quoten.length;
      P[id].tagStreuung = Math.sqrt(
        quoten.reduce((a, b) => a + (b - mw) * (b - mw), 0) / quoten.length);
    } else {
      P[id].tagStreuung = null;
    }
    P[id].potd = potdOfSeason[id] || 0;
  });

  // ── Duelle und Partner: was aus gegnerOf und matesOf folgt ──────────────
  // Beide Tabellen entstehen im Hauptlauf. Hier wird nur zusammengefasst,
  // kein Match noch einmal angefasst.
  Object.keys(P).forEach(id => {
    const gg = gegnerOf[id] || {};
    let sweepG = 0, sweepX = '', breiteN = 0, breiteOk = 0;
    Object.keys(gg).forEach(fid => {
      const q = gg[fid];
      // Der Bezwinger: ein ganzer Monat gegen denselben Gegner ohne Pleite.
      if(q.g >= 8 && q.w === q.g && q.g > sweepG){ sweepG = q.g; sweepX = fid; }
      // Die Breite: gegen wie viele regelmäßige Gegner steht er im Plus?
      if(q.g >= 4){ breiteN++; if(q.w * 2 > q.g) breiteOk++; }
    });
    P[id].sweepG = sweepG;
    P[id].sweepX = sweepX;
    P[id].breiteN = breiteN;
    P[id].breiteOk = breiteOk;

    // Der schwächste Partner. Nicht der Schnitt, sondern der Boden: „auch
    // neben dem, mit dem es am wenigsten lief".
    const mm = matesOf[id] || {};
    let pMin = null, pX = '', pN = 0, pW = 0, pG = 0;
    Object.keys(mm).forEach(mid => {
      const r = mm[mid];
      if(r.g < 5) return;
      pN++;
      const q = r.w / r.g;
      if(pMin === null || q < pMin){ pMin = q; pX = mid; pW = r.w; pG = r.g; }
    });
    P[id].partnerMin = pN >= 3 ? pMin : null;
    P[id].partnerX = pX;
    P[id].partnerN = pN;
    P[id].partnerW = pW;
    P[id].partnerG = pG;
  });

  // ── Uplift: was ändert sich an einem Mitspieler, wenn ER daneben steht? ──
  // Für jeden Partner wird verglichen, wie oft dieser Partner MIT ihm gewinnt
  // und wie oft OHNE ihn — der Abstand in Prozentpunkten, gewichtet nach der
  // Zahl gemeinsamer Spiele. Das ist die persönlichste Zahl im ganzen Katalog:
  // Sie misst nicht das eigene Ergebnis, sondern den Effekt auf andere, und
  // sie lässt sich durch Vielspielen nicht erschleichen.
  Object.keys(P).forEach(id => {
    const mm = matesOf[id] || {};
    let num = 0, den = 0, n = 0;
    Object.keys(mm).forEach(mid => {
      const r = mm[mid], M = P[mid];
      if(!M || r.g < 12) return;
      const soloG = M.games - r.g, soloW = M.wins - r.w;
      if(soloG < 15) return;              // ohne Vergleichsbasis kein Vergleich
      num += (r.w / r.g - soloW / soloG) * r.g;
      den += r.g; n++;
    });
    P[id].uplift = den ? num / den : null;
    P[id].upliftMates = n;
  });

  const ids = Object.keys(P);
  const gamesSorted = ids.map(id => P[id].games).sort((a,b)=>a-b);
  const median = gamesSorted.length
    ? (gamesSorted.length % 2
        ? gamesSorted[(gamesSorted.length-1)/2]
        : (gamesSorted[gamesSorted.length/2 - 1] + gamesSorted[gamesSorted.length/2]) / 2)
    : 0;
  const rank = ids.map(id => ({
      id, elo:P[id].elo, games:P[id].games, wins:P[id].wins, losses:P[id].losses
    }))
    .sort((a,b)=> b.elo - a.elo || b.wins - a.wins || (a.id < b.id ? -1 : 1));

  // Siege gegen die Spitze der Saison — zweiter, sehr kurzer Durchlauf, weil
  // die Rangfolge erst nach dem Sortieren feststeht. Derselbe Lauf bedient
  // den Ersten und die besten Drei; ein dritter Durchlauf wäre Verschwendung.
  const top3 = new Set(rank.slice(0, 3).map(r => r.id));
  if(top3.size){
    ids.forEach(id => { P[id].vsTop3Games = 0; P[id].vsTop3 = 0; });
    ms.forEach(m => {
      const aSeite = [m.a1, m.a2], bSeite = [m.b1, m.b2];
      const aTop3 = aSeite.some(x => x && top3.has(x));
      const bTop3 = bSeite.some(x => x && top3.has(x));
      if(!aTop3 && !bTop3) return;
      // Gegen die Spitze gespielt hat, wer auf der anderen Seite stand. Auch
      // ein Erster spielt gegen die anderen beiden — er wird nicht
      // ausgenommen, sonst könnte die Spitze diesen Eintrag nie holen.
      if(bTop3) aSeite.forEach(id => { if(P[id]){
        P[id].vsTop3Games++; if(m.winner === 'A') P[id].vsTop3++; } });
      if(aTop3) bSeite.forEach(id => { if(P[id]){
        P[id].vsTop3Games++; if(m.winner === 'B') P[id].vsTop3++; } });
    });
  }

  return {
    sid, label:seasonLabel(sid), live, P, rank, topId: rank[0] ? rank[0].id : null,
    days: allDays.size,
    matches: ms.length,
    gamesBar: Math.ceil(median * 1.6)
  };
}

// Vormonat einer Saison-ID ('2026-07' → '2026-06'). Null bei Unsinn.
function _prevSeasonId(sid){
  const mm = /^(\d{4})-(\d{2})$/.exec(String(sid||''));
  if(!mm) return null;
  let y = +mm[1], m = +mm[2] - 1;
  if(m < 1){ m = 12; y--; }
  return y + '-' + String(m).padStart(2,'0');
}

// ─── §13.3a Einfrieren ───────────────────────────────────────────────
//     Eine abgeschlossene Saison darf sich nicht mehr ändern. Vorher wurde
//     jede vergangene Saison bei jedem Laden neu gerechnet — wer den Katalog
//     anfasst, schrieb damit rückwirkend die Geschichte um: Ein Eintrag, den
//     jemand im Mai geholt hat, konnte im August verschwinden, weil eine
//     Schwelle anders steht.
//
//     Deshalb wandert die fertige Chronik beim Archivieren in seasons.titles.
//     Eingefroren wird ALLES, was zum Rendern nötig ist (name, ic, tone, cond,
//     ev) — nicht nur die IDs. Nur so lässt sich eine alte Saison auch dann noch
//     anzeigen, wenn ihr Eintrag im heutigen Katalog gar nicht mehr existiert.
//
//     `v` ist die Formatmarke: fehlt sie, gilt die Saison als nicht eingefroren
//     und der nächste Archivlauf trägt es nach. Eine Saison ohne einen einzigen
//     Eintrag ist damit unterscheidbar von einer, die noch nie eingefroren wurde.
const SEASON_TITLES_FREEZE_V = 1;

// Liest die eingefrorene Chronik einer Saison — aus dem seasons-Eintrag, egal
// ob die Spalte als Objekt oder als JSON-Text ankommt. null = nicht eingefroren.
function _frozenTitlesOf(season){
  if(!season) return null;
  let t = season.titles;
  if(typeof t === 'string'){ try { t = JSON.parse(t); } catch(e){ return null; } }
  if(!t || typeof t !== 'object' || !t.v || !Array.isArray(t.awarded)) return null;
  return t;
}

// Baut den einzufrierenden Datensatz. Läuft nur beim Archivieren, also einmal
// pro Saison — der teure Kontext-Pass ist hier kein Thema.
function _freezeSeasonTitles(sid){
  try {
    const T = seasonTitles(sid);
    return {
      v: SEASON_TITLES_FREEZE_V,
      frozen_at: new Date().toISOString(),
      days: T.days, matches: T.matches,
      champ: T.champ || null,
      awarded: T.awarded.map(a => ({titleId:a.titleId, name:a.name, short:a.short,
                                    ic:a.ic, tone:a.tone, cond:a.cond, pid:a.pid, ev:a.ev})),
      empty: T.empty.slice()
    };
  } catch(e){ return null; }
}

// ─── §13.3 Vergabe ───────────────────────────────────────────────────
// Liefert [{titleId, name, ic, tone, pid, ev}] in Katalog-Reihenfolge.
// Memoisiert pro Saison — der Kontext-Pass läuft nur einmal je Cache-Stand.
function seasonTitles(sid){
  if(!sid) sid = currentSeason().id;
  const key = sid + '_' + matches.length + '_' + _cache.version;
  if(!_cache._seasonTitles) _cache._seasonTitles = {};
  const hit = _cache._seasonTitles[key];
  if(hit) return hit;
  if(Object.keys(_cache._seasonTitles).length > 60) _cache._seasonTitles = {};

  // Eingefrorene Saison → gelesen statt gerechnet. Die laufende Saison ist
  // ausgenommen: sie ändert sich bis zum Monatsende bei jedem Match.
  if(sid !== currentSeason().id){
    const frozen = _frozenTitlesOf((seasons || []).find(x => x && x.id === sid));
    if(frozen){
      const res = {sid, label:seasonLabel(sid), live:false,
                   days:frozen.days || 0, matches:frozen.matches || 0,
                   champ:frozen.champ || null,
                   awarded:frozen.awarded, empty:frozen.empty || [], frozen:true};
      _cache._seasonTitles[key] = res;
      return res;
    }
  }

  const C = _seasonTitleCtx(sid);
  const out = [];
  if(Object.keys(C.P).length){
    const taken = new Set();
    SEASON_TITLES.forEach(t => {
      const r = t.pick(C, taken);
      if(!r || !r.pid || taken.has(r.pid)) return;
      taken.add(r.pid);
      out.push({titleId:t.id, name:t.name, short:t.short||t.name, ic:t.ic,
                tone:t.tone, cond:t.cond, pid:r.pid, ev:r.ev});
    });
  }
  const res = {sid, label:C.label, live:C.live, days:C.days, matches:C.matches,
               // Der Meister ist KEIN Chronik-Eintrag mehr (er stand per
               // Definition immer dem Ersten zu und sagte nichts, was die
               // Rangliste nicht schon zeigt). Er hängt trotzdem hier mit
               // drin, weil dieser Aufruf ohnehin memoisiert ist und Krone,
               // Avatar-Ring und Saison-Tafel dieselbe Quelle brauchen.
               champ: C.rank[0] ? {pid:C.rank[0].id, elo:C.rank[0].elo,
                                   wins:C.rank[0].wins, games:C.rank[0].games} : null,
               awarded:out, empty:Object.keys(C.P).filter(id => !out.some(o => o.pid === id))};
  _cache._seasonTitles[key] = res;
  return res;
}

// Meister einer Saison = Platz 1 der Saison-Elo. Einzige Quelle für die Krone
// neben dem Namen, den Titelverteidiger-Ring und die Saison-Tafel.
function seasonChampion(sid){
  try { const t = seasonTitles(sid); return t.champ ? t.champ.pid : null; }
  catch(e){ return null; }
}

// Alle Saisons mit Titeln, neueste zuerst (inkl. laufender).
function allSeasonTitles(){
  const cur = currentSeason().id;
  const ids = allPastSeasons().slice();
  if(!ids.includes(cur) && matchesInSeason(cur).length) ids.push(cur);
  // Explizit nach Saison-ID sortieren statt der Aufrufer-Reihenfolge zu
  // vertrauen: 'YYYY-MM' sortiert als String korrekt chronologisch.
  ids.sort();
  return ids.map(seasonTitles).filter(x => x.awarded.length || x.live)
            .sort((a,b) => a.sid < b.sid ? 1 : -1); // neueste zuerst
}

// Titel eines Spielers in einer Saison (oder null).
function seasonTitleOf(pid, sid){
  const t = seasonTitles(sid);
  return t.awarded.find(a => a.pid === pid) || null;
}

// ─── §13.4 Saisontitel-Historie eines Spielers ───────────────────────
// Chronik = ein Eintrag je Saison, in der der Spieler gespielt hat.
// `title` ist null, wenn er leer ausging — die Lücke gehört dazu.
function seasonTitleHistory(pid){
  const key = pid + '_' + matches.length + '_' + _cache.version;
  if(!_cache._chronicle) _cache._chronicle = {};
  const hit = _cache._chronicle[key];
  if(hit) return hit;
  if(Object.keys(_cache._chronicle).length > 80) _cache._chronicle = {};

  const cur = currentSeason().id;
  const ids = allPastSeasons().slice();
  if(!ids.includes(cur)) ids.push(cur);
  ids.sort(); // chronologisch, unabhängig davon wie der Aufrufer sortiert hat
  const rows = [];
  ids.forEach(sid => {
    const played = matchesInSeason(sid).some(m => m.a1===pid||m.a2===pid||m.b1===pid||m.b2===pid);
    if(!played) return;
    rows.push({sid, label:seasonLabel(sid), live:(sid===cur), title:seasonTitleOf(pid, sid)});
  });
  _cache._chronicle[key] = rows;
  return rows;
}

