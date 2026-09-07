// ─── §11.1 — Story-Generator ─────────────────────────────────────────
// v9.4: All-Time-Ligarekorde für Breaking News (Elo-Höchststand & längste
// Siegesserie), plus der Zeitpunkt (Match), an dem der aktuelle Rekord
// aufgestellt wurde. Ein O(N_matches)-Lauf, gecacht per matches.length+version.
//   • Elo: aus globalSim.history (season-isoliertes eloAfter) — der höchste je
//     erreichte Wert und das Match, das ihn zuletzt neu setzte.
//   • Serie: eigener Karriere-Walk (kein Saison-Reset — „jemals").
function _allTimeRecords(){
  const key = 'allTimeRec_'+matches.length+'_'+_cache.version;
  if(_cache._allTimeRecKey === key) return _cache._allTimeRec;
  const startElo = cfg.start_elo ?? 0;
  let eloRec = null;    // {val, pid, matchId}
  let streakRec = null; // {val, pid, matchId}
  try {
    const sim = getGlobalSim();
    let runMax = startElo;
    for(const h of (sim.history || [])){
      const after = h.eloAfter;
      if(!after) continue;
      for(const pid in after){
        if(after[pid] > runMax + 1e-6){
          runMax = after[pid];
          eloRec = { val: Math.round(after[pid]), pid, matchId: h.matchId };
        }
      }
    }
  } catch(e){}
  try {
    const cur = {};
    let maxStreak = 0;
    for(const m of matches){
      const aWon = m.winner === 'A';
      const sides = [[m.a1, m.a2, aWon], [m.b1, m.b2, !aWon]];
      for(const [x, y, won] of sides){
        for(const id of [x, y]){
          if(!id) continue;
          cur[id] = won ? (cur[id] || 0) + 1 : 0;
          if(cur[id] > maxStreak){ maxStreak = cur[id]; streakRec = { val: cur[id], pid: id, matchId: m.id }; }
        }
      }
    }
  } catch(e){}
  // Zeitstempel des Rekord-Matches nachtragen.
  const mm = {};
  for(const m of matches) mm[m.id] = m;
  if(eloRec && mm[eloRec.matchId]) eloRec.when = mm[eloRec.matchId].created_at;
  if(streakRec && mm[streakRec.matchId]) streakRec.when = mm[streakRec.matchId].created_at;
  const result = { eloRec, streakRec };
  _cache._allTimeRecKey = key;
  _cache._allTimeRec = result;
  return result;
}

// ─── §11.0c — Unbegrenzte Meilenstein-Leiter (v9.5) ──────────────────
// Ersetzt feste Schwellen-Arrays (…, 500, 1000 → ENDE) durch eine Leiter
// nach dem 1–2.5–5 ×10^k-Muster: 10, 25, 50, 100, 250, 500, 1000, 2500,
// 5000, 10000, 25000, 50000, … So laufen Meilensteine bei hohen Zahlen
// sinnvoll weiter, statt an einer Obergrenze zu enden.
//   `_ladderCrossing(before, after, min)` = die höchste Leiter-Marke, die
//   zwischen `before` (exkl.) und `after` (inkl.) NEU überschritten wurde,
//   sonst null. So feuert eine Meilenstein-News genau auf dem Match, das die
//   Marke reißt — idempotent (ID enthält die Marke) und ohne Verlaufs-Backfill.
function _ladderCrossing(before, after, min){
  min = min || 1;
  if(!Number.isFinite(after) || after < min) return null;
  let hit = null, p = 1;
  while(p <= after){
    for(const r of [1, 2.5, 5]){
      const v = r * p;
      if(Number.isInteger(v) && v >= min && v > before && v <= after){
        if(hit === null || v > hit) hit = v;
      }
    }
    p *= 10;
  }
  return hit;
}

// Ambient-Tag (v9.6): Fun Facts erscheinen TÄGLICH (um 19:00). Früher (v9.5)
// nur alle 2 Tage über einen geraden Epoch-Tagesindex — jetzt ist jeder Tag ein
// Ambient-Tag, damit jeden Abend genau 1 Fun Fact kommt. Die Story-ID bleibt
// tages-deterministisch (`ambient_<datum>_19`) → geräteübergreifend identisch.
function _isAmbientDay(d){
  return true;
}

// ─── §11.0d — Persönliche Elo-Meilensteine (v9.5) ────────────────────
// Allzeit-Höchst-Elo eines Spielers überschreitet eine runde 100er-Marke
// (ab Start-Elo + 200, danach unbegrenzt: 1200, 1300, 1400, …). Ein
// O(N)-Walk über die (saison-isolierte) Elo-Historie, gecacht per
// matches.length + _cache.version. Liefert pro (Spieler, Marke) das Match,
// das die Marke erstmals riss — der Generator filtert danach auf „kürzlich".
function _eloMilestones(){
  const key = 'eloMile_'+matches.length+'_'+_cache.version;
  if(_cache._eloMileKey === key) return _cache._eloMile;
  const startElo = cfg.start_elo ?? 1000;
  const floor0 = startElo + 200;          // erste Marke
  const markOf = v => { const m = Math.floor(v/100)*100; return m >= floor0 ? m : null; };
  const out = [];
  try {
    const sim = getGlobalSim();
    const mm = {};
    for(const m of matches) mm[m.id] = m;
    const runMax = {};    // pid → laufendes Allzeit-Peak
    const firedFor = {};  // pid → höchste bereits erfasste Marke
    for(const h of (sim.history || [])){
      const after = h.eloAfter;
      if(!after) continue;
      for(const pid in after){
        const v = after[pid];
        if(v <= (runMax[pid] ?? startElo)) continue;
        runMax[pid] = v;
        const mark = markOf(v);
        if(mark != null && mark > (firedFor[pid] || 0)){
          firedFor[pid] = mark;
          out.push({ pid, mark, matchId: h.matchId, when: mm[h.matchId] ? mm[h.matchId].created_at : null, val: Math.round(v) });
        }
      }
    }
  } catch(e){}
  _cache._eloMileKey = key;
  _cache._eloMile = out;
  return out;
}

// Iteriert genau einmal über bestehende Caches. Gibt ein Array von
// Story-Objekten {id, cat, ic, title, desc, when, prio, dataRef} zurück.
// Performance: O(N_matches) — dominante Kosten durch top-form-Filterung,
// die aber auf die letzten 10 Matches pro Spieler eingeschränkt ist.
function _buildStories(){
  const stories = [];
  const now = new Date();
  const pm = pmap();
  const nameOf = pid => (pm[pid] && pm[pid].name) || '?';
  const sortedMatches = [...matches].sort((a,b)=>mts(b)-mts(a)); // neueste zuerst

  // ── ISO-Wochen-Helper (v8.3) ──
  // Liefert "2026-W26" als stabile Pro-Woche-Kennung. Vermeidet, dass
  // "Ruhige Woche"-Stories täglich neu erzeugt werden. ISO-Wochen starten
  // Montag → eine Woche ergibt EINE Story, nicht sieben.
  const isoWeek = (d) => {
    const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil((((t - yearStart) / 86400000) + 1) / 7);
    return t.getUTCFullYear() + '-W' + String(weekNum).padStart(2, '0');
  };
  const todayKey = now.toISOString().slice(0,10);
  const weekKey  = isoWeek(now);

  // ── Abgeschlossene Zeiträume (v9.5) ──
  // Superlativ-Stories ("größter Elo-Gewinner/-Verlierer", "höchster Sieg",
  // "Krimi", "Upset" … der Woche/des Tages) dürfen sich NUR auf einen bereits
  // ABGESCHLOSSENEN Zeitraum beziehen. Sonst ist die Aussage nicht belastbar —
  // mitten am Tag/in der Woche kann sich der „Gewinner" noch ändern. Wir
  // rechnen deshalb auf „gestern" (voller Kalendertag) bzw. die „vergangene
  // Woche" (letzte abgeschlossene ISO-Woche, Mo–So).
  const _dayMs = 86400000;
  const _startOfToday     = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const _startOfYesterday = _startOfToday - _dayMs;
  const _weekStartOf = (ts) => { const x = new Date(ts); x.setHours(0,0,0,0); x.setDate(x.getDate() - ((x.getDay()+6)%7)); return x.getTime(); };
  const _thisWeekStart = _weekStartOf(now.getTime());
  const _prevWeekStart = _thisWeekStart - 7*_dayMs;
  const _yesterdayKey  = new Date(_startOfYesterday).toISOString().slice(0,10);
  let   _lastWeekKey   = isoWeek(new Date(_prevWeekStart));

  // ── Der Wochenrückblick: EINE Karte, Sonntag 23:00 ───────────────────
  // Vorher standen sechs Wertungen als sechs eigene Karten über den Montag
  // verteilt (09, 10, 12, 15, 18, 20 Uhr). Gemessen trug ein Montag damit zehn
  // Karten, neun davon zwischen 09 und 20 Uhr — und der Montag ist der
  // Spieltag: die vergangene Woche verdeckte, was gerade passierte.
  // Jetzt sammeln die sechs Blöcke ihre Wertung in `_wochenTeile`, und daraus
  // entsteht am Sonntag um 23:00 eine einzige Karte. Jede Wertung behält ihre
  // Zahl, ihr Gesicht und ihren Weg ins Blatt.
  // Die Grenzen kommen aus _potwLastWeekRange, damit Rückblick, POTW-Karte und
  // Wochenkarte über dasselbe Fenster reden [§C27].
  const _wr = (typeof _potwLastWeekRange === 'function') ? _potwLastWeekRange() : null;
  const _wocheStart = _wr ? _wr.start.getTime() : _prevWeekStart;
  const _wocheEnde  = _wr ? (_wr.end.getTime() + 1) : _thisWeekStart;
  const _wocheSlotTs = _wocheEnde - 3600000;          // Sonntag 23:00
  const _wocheDue = now.getTime() >= _wocheSlotTs;
  _lastWeekKey = isoWeek(new Date(_wocheStart));
  const _wochenTeile = [];

  // ── Memoization (v8.4) ──
  // _buildStories ist teuer (~67ms @1k×12 Spieler, ~244ms @10k×20). Solange
  // sich weder Match-Zahl noch _cache.version noch ISO-Woche noch Tag ändern,
  // liefert der Generator dasselbe Ergebnis → Cache zurückgeben, Generator
  // KOMPLETT überspringen. Bei Match-Insert ändert sich matches.length, bei
  // Recalc/Config _cache.version → Key bricht automatisch.
  // Explizite Invalidierung zusätzlich über invalidateCache(['news']) in §3.
  // Slot-Signatur (v8.5): wie viele Ambient-Slots heute schon "offen" sind.
  // Steigt über den Tag (z.B. 0→1 um 12:00, 1→2 um 19:00) und bricht so den
  // Memo-Key, sobald ein neuer Slot fällig wird — auch ohne neues Match.
  // v9.7: zwei Fun-Fact-Slots (10:00 & 19:00) sind täglich offen. Die Signatur
  // zählt, wie viele Slots heute schon fällig sind (0→1 um 10:00, 1→2 um 19:00)
  // und bricht den Memo-Key, sobald ein neuer Slot fällig wird — ohne neues Match.
  // v9.18: Der Nachschub darf den Memo-Key nicht sprengen — sonst liefe der
  // Generator bei jedem Aufruf neu. Die Signatur bleibt deshalb die Anzahl der
  // heute fälligen Slots; nachgetragene Slots sind ohnehin einmalig: Nach dem
  // ersten Sync stehen sie in der DB und `known` filtert sie beim nächsten Lauf
  // wieder heraus.
  const _ambientSlotSig = _isAmbientDay(now) ? AMBIENT_SLOTS.filter(h => now.getHours() >= h).length : 0;
  // Morgen-Slot (07:00): POTW/POTD-Stories dürfen erst AB 07:00 erscheinen (nicht
  // schon nachts um 00:xx). Die Signatur kippt 0→1 um 07:00 und bricht dann den
  // Memo-Key, damit die Story ohne neues Match / ohne Reload auftaucht — analog
  // zum 19:00-Slot.
  // Der Spieler des Tages erscheint um 23:59 desselben Tages, nicht mehr um
  // 07:00 des Folgetags. Vorher stand die Karte in der Tafel unter einem Datum,
  // an dem gar nicht gespielt wurde. Die Signatur kippt um 23:59 und bricht
  // dann den Memo-Key, damit die Karte ohne Reload erscheint.
  const _morningSlotSig = (now.getHours() * 60 + now.getMinutes()) >= (23 * 60 + 59) ? 1 : 0;
  // Dasselbe für den Wochenrückblick: der Schalter kippt am Sonntag um 23:00
  // und bricht den Memo-Key, sonst erschiene die Karte erst nach dem nächsten
  // Match oder Reload.
  const _weekSlotSig = _wocheDue ? 1 : 0;
  const _buildStoriesKey = matches.length + '_' + _cache.version + '_' + weekKey + '_' + todayKey + '_' + _ambientSlotSig + '_' + _morningSlotSig + '_' + _weekSlotSig;
  if(_cache._buildStoriesKey === _buildStoriesKey && Array.isArray(_cache._buildStoriesResult)){
    return _cache._buildStoriesResult;
  }

  // ── Helper-Refs einmalig (v8.4) ──
  // getHistoryByMatchId() und getRankSnapshots() sind bereits gecached, aber
  // jeder Aufruf prüft den Cache-Key neu. Einmal pro Generator-Lauf
  // referenzieren spart wiederholten Lookup-Overhead — mehrere Story-Typen
  // (elo_swing_week, elo_swing_day, upset_match, Führungswechsel) brauchen sie.
  const histMap = getHistoryByMatchId();
  const snaps   = getRankSnapshots();

  // ── Pre-Group: matches pro Spieler ──
  // O(N) statt O(N × N_players) für jeden späteren filter()-Aufruf.
  // matches ist asc-sortiert (loadAll) → byPlayer[pid] ist ebenfalls asc.
  // Bei 100k Matches × 50 Spielern: ~400k push-ops vs ~50M filter-ops.
  const byPlayer = {};
  matches.forEach(m => {
    const ids = [m.a1, m.a2, m.b1, m.b2];
    for(let i=0; i<4; i++){
      const pid = ids[i];
      if(!byPlayer[pid]) byPlayer[pid] = [];
      byPlayer[pid].push(m);
    }
  });

  // ── 1. Saison-Endspurt ──
  // Letzte 7 Tage einer Saison + min. 2 Spieler im Saison-Top mit kleinem Abstand.
  try {
    const daysLeft = seasonDaysLeft();
    if(daysLeft > 0 && daysLeft <= 7){
      const sid = currentSeason().id;
      const sim = getGlobalSim();
      const endElos = sim.elo || {};
      const playedMap = (sim.seasonPlayed && sim.seasonPlayed[sid]) || {};
      const rankList = Object.keys(endElos)
        .filter(pid => pm[pid] && !pm[pid].hidden && (playedMap[pid]||0) > 0)
        .map(pid => ({pid, elo: Math.round(endElos[pid])}))
        .sort((a,b)=>b.elo-a.elo);
      if(rankList.length >= 2){
        const gap = rankList[0].elo - rankList[1].elo;
        stories.push({
          id: 'season_endspurt_'+sid,
          cat: 'highlight',
          ic: 'rocket',
          title: `Noch ${daysLeft} ${daysLeft===1?'Tag':'Tage'}`,
          desc: gap <= 50
            ? `Die Top 2 trennen nur ${gap} Elo. Das wird knapp.`
            : `Saison-Endspurt: ${nameOf(rankList[0].pid)} führt mit ${gap} Elo Vorsprung.`,
          when: now,
          prio: gap <= 15 ? 10 : (gap <= 50 ? 9 : 7),
          dataRef: {type:'season_endgame', sid, leader:rankList[0], second:rankList[1], daysLeft, gap}
        });
      }
    }
  } catch(e){ /* defensiv */ }

  // ── 2. Saisonstart ──
  // Aktuelle Saison startete in den letzten 3 Tagen.
  try {
    const sStart = seasonStart();
    const ageDays = Math.floor((now - sStart) / 86400000);
    if(ageDays >= 0 && ageDays <= 3){
      stories.push({
        id: 'season_start_'+currentSeason().id,
        cat: 'season',
        ic: 'rocket',
        title: ageDays === 0 ? 'Die neue Saison läuft' : `Saison läuft seit ${ageDays} ${ageDays===1?'Tag':'Tagen'}`,
        desc: `Die Saison ${currentSeason().label} beginnt. Alle Spieler starten wieder bei ${cfg.start_elo} Elo.`,
        when: sStart,
        prio: ageDays === 0 ? 8 : 5,
        dataRef: {type:'season_start', sid: currentSeason().id}
      });
    }
  } catch(e){}

  // ── 3. Führungswechsel ──
  // Vergleicht aktuellen Top-1 der Saison mit dem Top-1 vor 10 Matches.
  try {
    const sid = currentSeason().id;
    const seasonMs = matchesInSeason(sid);
    if(seasonMs.length >= 4){
      // Aktueller Top-1
      const sim = getGlobalSim();
      const endElos = sim.elo || {};
      const playedMap = (sim.seasonPlayed && sim.seasonPlayed[sid]) || {};
      const cur = Object.keys(endElos)
        .filter(pid => pm[pid] && !pm[pid].hidden && (playedMap[pid]||0) > 0)
        .map(pid => ({pid, elo: Math.round(endElos[pid])}))
        .sort((a,b)=>b.elo-a.elo);
      // Letztes Match → preRank des letzten Matches (= "Stand vor dem letzten Spiel")
      // Top-1 davor: aus preRank des letzten Matches der Saison
      const lastSeasonMatch = [...seasonMs].sort((a,b)=>mts(b)-mts(a))[0];
      const snap = lastSeasonMatch && snaps[lastSeasonMatch.id];
      if(cur.length && snap && snap.preRank){
        let prevTop = null;
        for(const pid in snap.preRank){
          if(snap.preRank[pid] === 1){ prevTop = pid; break; }
        }
        if(prevTop && prevTop !== cur[0].pid && pm[prevTop] && pm[cur[0].pid]){
          stories.push({
            id: 'lead_change_'+sid+'_'+lastSeasonMatch.id,
            cat: 'highlight',
            ic: 'kingClass',
            title: `Neuer Spitzenreiter: ${nameOf(cur[0].pid)}`,
            desc: `${nameOf(cur[0].pid)} steht nach dem letzten Spiel an der Spitze. ${nameOf(prevTop)} war vorher dort.`,
            when: new Date(lastSeasonMatch.created_at),
            prio: 10,
            dataRef: {type:'lead_change', newLeader: cur[0].pid, prevLeader: prevTop, matchId: lastSeasonMatch.id}
          });
        }
      }
    }
  } catch(e){}

  // ── 3b. Team-News: gemeinsame Siegesserie eines Duos (v9.1, v9.5) ──
  // Match-getriggert (when = Match-Zeit) → erscheint direkt „nach Spielen".
  // Nur bei Meilenstein-Serienlängen, damit es nicht nach jedem Sieg spammt.
  // v9.5: erst ab 5 gemeinsamen Siegen (vorher 3) — 3 war zu schnell erreicht.
  // Ein Pass über alle Matches (matches ist asc-sortiert) → O(N).
  try {
    const TEAM_STREAK_MS = new Set([5,7,10,15,20]);
    const tstate = {}; // teamKey → {cur, ids, lastT}
    for(const m of matches){
      const sides = [[m.a1,m.a2,m.winner==='A'],[m.b1,m.b2,m.winner==='B']];
      for(const [x,y,won] of sides){
        if(!x || !y) continue;
        const ids = [x,y].sort(), k = ids.join('|');
        if(!tstate[k]) tstate[k] = {cur:0, ids};
        tstate[k].cur = won ? tstate[k].cur + 1 : 0;
        tstate[k].lastT = new Date(m.created_at);
      }
    }
    const teamCands = Object.values(tstate).filter(t =>
      TEAM_STREAK_MS.has(t.cur) &&
      pm[t.ids[0]] && pm[t.ids[1]] && !pm[t.ids[0]].hidden && !pm[t.ids[1]].hidden);
    teamCands.sort((a,b) => b.cur - a.cur || b.lastT - a.lastT);
    teamCands.slice(0, 3).forEach(t => {
      stories.push({
        id: 'team_streak_'+t.ids.join('_')+'_'+t.cur,
        cat: 'team',
        ic: 'unstoppable',
        title: `${nameOf(t.ids[0])} & ${nameOf(t.ids[1])} sind als Team nicht zu stoppen`,
        desc: `${nameOf(t.ids[0])} und ${nameOf(t.ids[1])} haben ${t.cur} Spiele nacheinander zusammen gewonnen.`,
        when: t.lastT,
        prio: t.cur >= 7 ? 9 : 8,
        dataRef: {type:'team_streak', a:t.ids[0], b:t.ids[1], streak:t.cur}
      });
    });
  } catch(e){}

  // ── 3c. Team-News: gemeinsame Niederlagenserie eines Duos (v9.5) ──
  // Pendant zu 3b, aber ab 3 gemeinsamen Niederlagen in Folge. Gleiche
  // Mechanik (Match-getriggert, Meilenstein-Serienlängen, O(N)).
  try {
    const TEAM_LOSS_MS = new Set([3,5,7,10]);
    const lstate = {}; // teamKey → {cur, ids, lastT}
    for(const m of matches){
      const sides = [[m.a1,m.a2,m.winner==='A'],[m.b1,m.b2,m.winner==='B']];
      for(const [x,y,won] of sides){
        if(!x || !y) continue;
        const ids = [x,y].sort(), k = ids.join('|');
        if(!lstate[k]) lstate[k] = {cur:0, ids};
        lstate[k].cur = won ? 0 : lstate[k].cur + 1;
        // Wann die Serie begann — ohne das Datum sagt die Karte für jedes Duo
        // wortwörtlich dasselbe.
        if(lstate[k].cur === 1) lstate[k].firstT = new Date(m.created_at);
        lstate[k].lastT = new Date(m.created_at);
      }
    }
    const lossCands = Object.values(lstate).filter(t =>
      TEAM_LOSS_MS.has(t.cur) &&
      pm[t.ids[0]] && pm[t.ids[1]] && !pm[t.ids[0]].hidden && !pm[t.ids[1]].hidden);
    lossCands.sort((a,b) => b.cur - a.cur || b.lastT - a.lastT);
    lossCands.slice(0, 3).forEach(t => {
      stories.push({
        id: 'team_loss_streak_'+t.ids.join('_')+'_'+t.cur,
        cat: 'team',
        ic: 'trendCrash',
        title: `${nameOf(t.ids[0])} & ${nameOf(t.ids[1])} kommen als Team nicht in Tritt`,
        // Der Satz war für jedes Duo derselbe und stand damit wortgleich
        // zweimal im Feed. Jetzt trägt er die Namen und den Zeitraum.
        desc: `${nameOf(t.ids[0])} und ${nameOf(t.ids[1])} verlieren seit dem `
            + `${new Date(t.firstT || t.lastT).toLocaleDateString('de-DE', {day:'2-digit', month:'2-digit'})} `
            + `jede gemeinsame Partie. ${t.cur} am Stück.`,
        when: t.lastT,
        prio: t.cur >= 7 ? 7 : 6,
        dataRef: {type:'team_loss_streak', a:t.ids[0], b:t.ids[1], streak:t.cur}
      });
    });
  } catch(e){}

  // ── 4. Top-Form (≥8/10 letzte Spiele) ──
  // Iteriert über aktive Spieler, schaut letzte 10 Matches → Win-Rate.
  // O(N_players × min(10, matches_per_player)) — sehr günstig.
  try {
    const candidates = [];
    activePlayers().forEach(p => {
      // byPlayer ist asc-sortiert (=ältestes first). Letzte 10 = slice(-10), für Recency desc reversen.
      const arr = byPlayer[p.id] || [];
      if(arr.length < 10) return;
      const last10 = arr.slice(-10);
      const wins = last10.filter(m => won(p.id, m)).length;
      if(wins >= 9){ // v8.8: 8→9 — nur noch echte Top-Form (9-10/10) ist News
        candidates.push({pid: p.id, wins, when: new Date(last10[last10.length-1].created_at)});
      }
    });
    candidates.sort((a,b) => b.wins - a.wins || b.when - a.when);
    candidates.slice(0, NEWS_LIMITS.topForm).forEach(c => {
      stories.push({
        id: 'top_form_'+c.pid+'_'+c.when.toISOString().slice(0,10),
        cat: 'highlight',
        ic: 'flame',
        title: `${nameOf(c.pid)} in Top-Form`,
        desc: `${c.wins} von 10 Partien gewonnen. Keiner hat in diesem Zeitraum eine bessere Bilanz.`,
        when: c.when,
        prio: c.wins === 10 ? 8 : (c.wins === 9 ? 7 : 6),
        dataRef: {type:'top_form', pid: c.pid, wins: c.wins}
      });
    });
  } catch(e){}

  // ── 5. Niederlagenserie (≥5 in Folge, aktuell laufend) ──
  // Nur Spieler, deren JÜNGSTES Match Niederlage war + Serie ≥ 5.
  try {
    const candidates = [];
    activePlayers().forEach(p => {
      // byPlayer asc → von hinten iterieren = neueste zuerst. Frühzeitig brechen.
      const arr = byPlayer[p.id] || [];
      if(!arr.length) return;
      let streak = 0;
      for(let i = arr.length - 1; i >= 0; i--){
        if(won(p.id, arr[i])) break;
        streak++;
        if(streak > 12) break; // Schutz
      }
      if(streak >= 5){
        candidates.push({pid: p.id, streak, when: new Date(arr[arr.length-1].created_at)});
      }
    });
    candidates.sort((a,b) => b.streak - a.streak);
    candidates.slice(0, NEWS_LIMITS.lossStreak).forEach(c => {
      stories.push({
        id: 'loss_streak_'+c.pid+'_'+c.when.toISOString().slice(0,10),
        cat: 'misfortune',
        ic: c.streak >= 7 ? 'dropTriple' : 'dropDouble',
        title: `${nameOf(c.pid)} im Pleiten-Modus`,
        desc: `${c.streak} Niederlagen nacheinander. Der letzte Sieg liegt ${c.streak} Partien zurück.`,
        when: c.when,
        prio: c.streak >= 8 ? 6 : 4,
        dataRef: {type:'loss_streak', pid: c.pid, streak: c.streak}
      });
    });
  } catch(e){}

  // ── 6. Badge freigeschaltet (letzte 7 Tage) ──
  // Tap-Quelle: getBadgeEarnedCache. Wir zeigen die NEUSTEN N freigeschalteten,
  // Dubletten pro Spieler+Badge dedupliziert.
  try {
    const cutoff = now.getTime() - 7*86400000;
    const bMap = getBadgeEarnedCache();
    const events = [];
    for(const mid in bMap){
      const arr = bMap[mid];
      if(!arr || !arr.length) continue;
      const matchObj = matches.find(m => m.id === mid);
      if(!matchObj) continue;
      const t = mts(matchObj);
      if(t < cutoff) continue;
      arr.forEach(e => events.push({...e, when: new Date(matchObj.created_at), matchId: mid}));
    }
    // Pro (Spieler, Badge-ID): nur das jüngste Event
    const dedupe = {};
    events.forEach(ev => {
      const k = ev.playerId+'|'+ev.badge.id;
      if(!dedupe[k] || dedupe[k].when < ev.when) dedupe[k] = ev;
    });
    // v9.5: Whitelist-Filter ZUERST, dann limitieren. Vorher wurde erst auf die
    // 6 jüngsten Events geschnitten und danach gefiltert — häufige Common-Badges
    // konnten so news-würdige (rare/negative) Badges aus dem Budget verdrängen.
    // Jetzt zählt das Limit nur echte News, damit gewünschte Auszeichnungen
    // (Nerven aus Stahl, 10er Serie, Losing Streak …) zuverlässig erscheinen.
    // v8.1: nur seltene/besondere Badges erzeugen News (Common wäre Spam).
    // v8.7: ALLE goldenen (legendary) und lilanen (rare) Badges sind News-würdig;
    // zusätzlich die explizit gewhitelisteten Specials (seltene negative Badges).
    const _rarRank = {legendary:4, rare:3, negative:2, common:1};
    const whitelisted = Object.values(dedupe)
      .filter(ev => {
        if(!pm[ev.playerId]) return false;
        const rar = (typeof rarityOf === 'function') ? rarityOf(ev.badge.id) : 'common';
        return rar === 'legendary' || rar === 'rare' || NEWS_BADGE_WHITELIST.has(ev.badge.id);
      });
    // v9.7: pro Match nur EIN Badge-THEMA als News. Mehrere verschiedene Badges
    // aus demselben Spiel (z.B. „Klares Ding" + „Mauer") sagen im Grunde
    // dasselbe über dieses eine Match aus → wir behalten nur das prominenteste
    // (höchste Rarity, dann jüngstes) und vermeiden fast identische Doppel-News.
    //
    // v9.17 BUGFIX: Vorher wurde pro Match genau EIN EVENT behalten. Bei
    // Team-Badges verdient aber das ganze Siegerteam dieselbe Auszeichnung —
    // ein 10:0 schaltet „Absoluter Sieger" für BEIDE Sieger frei. Das zweite
    // Event flog raus, die News nannte nur einen Namen. Jetzt wird pro Match nur
    // die Badge-ID gewählt; ALLE Events dieser Badge-ID bleiben erhalten und
    // _consolidateStories (§11.2) fasst sie zu EINER Karte mit beiden Spielern
    // zusammen (die Gruppierung dort läuft über badgeId|matchId und kann das
    // längst — ihr fehlte nur das zweite Event).
    const _perMatch = {};       // matchId → {badgeId, _r, when}
    whitelisted.forEach(ev => {
      const mid = ev.matchId;
      const r = _rarRank[(typeof rarityOf === 'function') ? rarityOf(ev.badge.id) : 'common'] || 1;
      const cur = _perMatch[mid];
      if(!cur || r > cur._r || (r === cur._r && ev.when > cur.when)){
        _perMatch[mid] = {badgeId: ev.badge.id, _r: r, when: ev.when};
      }
    });
    // Limit zählt EREIGNISSE (matchId|badgeId), nicht Spieler — ein Team-Badge
    // mit zwei Siegern darf das Budget nicht doppelt verbrauchen.
    const list = [];
    const _budget = new Set();
    whitelisted
      .filter(ev => { const w = _perMatch[ev.matchId]; return w && w.badgeId === ev.badge.id; })
      .sort((a,b) => b.when - a.when)
      .forEach(ev => {
        const gk = ev.matchId + '|' + ev.badge.id;
        if(!_budget.has(gk)){
          if(_budget.size >= NEWS_LIMITS.badgeUnlocked) return;
          _budget.add(gk);
        }
        list.push(ev);
      });
    list.forEach(ev => {
      const rar = (typeof rarityOf === 'function') ? rarityOf(ev.badge.id) : 'common';
      // Legendary erzwingt Top-Prio (Bucket >=9 im Final-Sort), damit echte
      // Achievements zuverlässig ganz oben im Feed landen.
      // v9.1: Badges bewusst niedriger priorisiert (außer legendär), damit bei
      // gleichem Zeitstempel Team-News/Fun Facts nach Spielen auch mal oben stehen.
      const rarPrio = {legendary:10, rare:5, common:3, negative:4}[rar] || 3;
      // v9.7: Angstgegner-News benennt den Gegner (aus fire()-Meta durchgereicht).
      const _nemOpp = (ev.badge.id === 'nemesis' && ev.meta && ev.meta.oppId) ? ev.meta.oppId : null;
      // v9.17: Die Langzeit-Auszeichnungen bekommen einen eigenen Text mit dem
      // ECHTEN Karrierestand statt der nüchternen Badge-Beschreibung — dieselbe
      // Quelle wie das Profil (countGames/countWins), also keine Abweichung.
      let _bdesc;
      if(_nemOpp){
        // Der Name der Auszeichnung steht schon in der Schlagzeile; er stand
        // hier ein zweites Mal, gleich darunter.
        _bdesc = `Fünf Pleiten in Folge gegen ${nameOf(_nemOpp)}.`;
      } else if(ev.badge.id === 'games250' && typeof countGames === 'function'){
        _bdesc = `300 Partien am Kicker. ${nameOf(ev.playerId)} steht jetzt bei ${countGames(ev.playerId, matches)} Spielen.`;
      } else if(ev.badge.id === 'wins200' && typeof countWins === 'function'){
        _bdesc = `300 Siege in der Karriere. ${nameOf(ev.playerId)} hält aktuell bei ${countWins(ev.playerId, matches)}.`;
      } else {
        _bdesc = ev.badge.desc || 'Neues Badge freigeschaltet.';
      }
      stories.push({
        id: 'badge_'+ev.playerId+'_'+ev.badge.id+'_'+ev.matchId,
        cat: 'badge',
        ic: ev.badge.ic || 'trophy',
        title: `${nameOf(ev.playerId)}: ${ev.badge.name}`,
        desc: _bdesc,
        when: ev.when,
        prio: rarPrio,
        dataRef: {type:'badge_unlocked', playerId: ev.playerId, badgeId: ev.badge.id, badgeName: ev.badge.name, matchId: ev.matchId, rarity: rar, nemesisOppId: _nemOpp || undefined}
      });
    });
  } catch(e){}

  // ── 7. Rivalität (≥50 H2H-Duelle) ──
  // H2H = wie oft 2 Spieler in irgendeinem Match GEGENEINANDER waren (egal welcher Mate).
  // Iteriere matches 1×, baue Counter-Map auf.
  try {
    const pairCnt = {}; // "minId|maxId" → {n, lastDate}
    matches.forEach(m => {
      const A = [m.a1, m.a2], B = [m.b1, m.b2];
      A.forEach(a => B.forEach(b => {
        if(a === b) return;
        const k = a < b ? a+'|'+b : b+'|'+a;
        if(!pairCnt[k]) pairCnt[k] = {n:0, last:m.created_at, aw:0};
        pairCnt[k].n++;
        // Wer führt? Ohne diese Zahl sagte die Karte nur, dass es die
        // Paarung gibt. `aw` zählt aus Sicht des kleineren Ids.
        const ersterAufA = (a < b ? a : b) === a;
        const aGewinnt = ersterAufA ? m.winner === 'A' : m.winner === 'B';
        if(aGewinnt) pairCnt[k].aw++;
        if(m.created_at > pairCnt[k].last) pairCnt[k].last = m.created_at;
      }));
    });
    const ranked = Object.entries(pairCnt)
      .filter(([k,v]) => v.n >= 50)
      .map(([k,v]) => {
        const [a,b] = k.split('|');
        return {a, b, n: v.n, aw: v.aw, when: new Date(v.last)};
      })
      .filter(r => pm[r.a] && pm[r.b] && !pm[r.a].hidden && !pm[r.b].hidden)
      .sort((a,b) => b.n - a.n)
      .slice(0, NEWS_LIMITS.rivalry);
    ranked.forEach(r => {
      const tier = r.n >= 200 ? 'legendäre' : r.n >= 100 ? 'große' : 'wachsende';
      stories.push({
        id: 'rivalry_'+r.a+'_'+r.b,
        cat: 'rivalry',
        ic: 'crossedSwords',
        title: `${r.n} Duelle. Eine ${tier} Rivalität`,
        // „Eine große Rivalität — die Liga liebt's" stand wortgleich unter
        // zwei Karten untereinander und nannte keine einzige Zahl.
        desc: (() => { const va = r.aw, vb = r.n - r.aw;
          return va === vb
            ? `${nameOf(r.a)} und ${nameOf(r.b)} stehen nach ${r.n} Duellen exakt bei ${va}:${vb}.`
            : `${nameOf(va > vb ? r.a : r.b)} führt mit ${Math.max(va, vb)}:${Math.min(va, vb)} gegen ${nameOf(va > vb ? r.b : r.a)}.`;
        })(),
        when: r.when,
        prio: r.n >= 200 ? 7 : r.n >= 100 ? 5 : 3,
        dataRef: {type:'rivalry', a: r.a, b: r.b, n: r.n}
      });
    });
  } catch(e){}

  // ── 8. Jubiläum (Spiele-Meilensteine, unbegrenzte Leiter ab 10) ──
  // Trigger NUR wenn das jüngste Match dieses Spielers genau die Schwelle reißt.
  // → keine Wiederholung in späteren Generator-Läufen (ID enthält Match-ID).
  try {
    const candidates = [];
    activePlayers().forEach(p => {
      // byPlayer ist bereits asc-sortiert (matches asc → push behält Reihenfolge).
      // Keine zusätzliche Filterung/Sortierung nötig.
      const arr = byPlayer[p.id] || [];
      const total = arr.length;
      if(!total) return;
      // v9.5: unbegrenzte Leiter (10, 25, 50, 100, 250, 500, 1000, 2500 …).
      // Spiele wachsen um genau 1 pro Match → das jüngste Match reißt die Marke.
      const mark = _ladderCrossing(total - 1, total, 10);
      if(mark){
        const last = arr[arr.length-1];
        candidates.push({pid: p.id, total: mark, when: new Date(last.created_at), matchId: last.id});
      }
    });
    candidates.sort((a,b) => b.when - a.when).slice(0, NEWS_LIMITS.jubilee).forEach(c => {
      stories.push({
        id: 'jubilee_'+c.pid+'_'+c.total,
        cat: 'history',
        ic: 'calendar',
        title: `${nameOf(c.pid)} feiert ${c.total}. Spiel`,
        desc: `${c.total} Partien stehen jetzt in der Bilanz von ${nameOf(c.pid)}.`,
        when: c.when,
        prio: c.total >= 1000 ? 9 : c.total >= 250 ? 6 : 4,
        dataRef: {type:'jubilee', pid: c.pid, total: c.total, matchId: c.matchId}
      });
    });
  } catch(e){}

  // ── 9. Stille Woche (Aktivitäts-Fun-Fact) ──
  // Vergleicht Spielzahl letzte 7 Tage mit Schnitt der vorangegangenen 4 Wochen.
  try {
    const wk = 7 * 86400000;
    const tsNow = now.getTime();
    const lastWeek = matches.filter(m => {
      const t = mts(m);
      return t > tsNow - wk && t <= tsNow;
    }).length;
    const prev4w = matches.filter(m => {
      const t = mts(m);
      return t > tsNow - 5*wk && t <= tsNow - wk;
    }).length;
    const avg = prev4w / 4;
    if(avg >= 20 && lastWeek <= avg * 0.5){
      stories.push({
        id: 'quiet_week_'+weekKey,
        cat: 'fun',
        ic: 'clock',
        title: 'Ruhige Woche',
        desc: `Nur ${lastWeek} Spiele in den letzten 7 Tagen. Normal wären ${Math.round(avg)}.`,
        when: now,
        prio: 2,
        dataRef: {type:'quiet_week', lastWeek, avg: Math.round(avg)}
      });
    }
  } catch(e){}

  // ── 10. Saisonende-Recap (Saison gerade zu Ende) ──
  // Wenn aktuelle Saison weniger als 2 Tage alt ist UND es eine archivierte
  // Vorgängersaison gibt → kurzer Verweis auf den Champion.
  try {
    const sStart = seasonStart();
    const ageDays = (now - sStart) / 86400000;
    if(ageDays <= 2 && seasons && seasons.length){
      // v9-Fix: NUR die unmittelbar vorige Saison (Vormonat der aktuellen)
      // recap'en. Vorher wurde blind „die höchste vorhandene id" genommen —
      // war das seasons-Array noch nicht voll synchronisiert (die gerade
      // beendete Saison fehlte), wählte das die VORLETZTE Saison und
      // persistierte eine dauerhaft falsche „Saison-Champion"-Story mit
      // when = aktueller Saisonstart, die als Breaking-Hero konkurrierte.
      // Jetzt matchen wir exakt den erwarteten Vormonat; fehlt er → nichts.
      const _prevSeasonId = (curId) => {
        const mm = /^(\d{4})-(\d{2})$/.exec(String(curId||''));
        if(!mm) return null;
        let yy = +mm[1], mo = +mm[2] - 1;
        if(mo < 1){ mo = 12; yy--; }
        return yy + '-' + String(mo).padStart(2,'0');
      };
      const prevId = _prevSeasonId(currentSeason().id);
      const lastArchived = prevId ? seasons.find(s => s.id === prevId) : null;
      if(lastArchived){
        const topElo = (typeof lastArchived.top_elo === 'string')
          ? JSON.parse(lastArchived.top_elo || '[]')
          : (lastArchived.top_elo || []);
        if(topElo.length && topElo[0] && topElo[0].id && pm[topElo[0].id]){
          // v9.18: Die Saison-Tafel (§13) reist in DIESER Story mit — bewusst
          // KEINE eigene Breaking-Meldung pro Titel und keine extra Karte für
          // Ehrentitel. Ein Saisonabschluss = eine Breaking News, sonst wäre
          // der 1. des Monats zugespammt. Details stehen im Sheet.
          let _tafel = null;
          try {
            const T = seasonTitles(lastArchived.id);
            if(T && T.awarded.length){
              _tafel = {
                n: T.awarded.length,
                empty: T.empty.length,
                list: T.awarded.map(a => ({t:a.titleId, n:a.name, ic:a.ic, tone:a.tone, pid:a.pid, ev:a.ev}))
              };
            }
          } catch(e){}
          const _extra = _tafel
            ? ` ${_tafel.n} Chronik-Einträge vergeben${_tafel.empty ? `, ${_tafel.empty} Spieler gehen leer aus` : ''}.`
            : '';
          stories.push({
            id: 'season_recap_'+lastArchived.id,
            cat: 'season',
            ic: 'crown',
            title: `${nameOf(topElo[0].id)} ist Saison-Champion`,
            desc: `Die Saison ${lastArchived.id} ist abgeschlossen. ${nameOf(topElo[0].id)} mit ${topElo[0].elo} Elo an der Spitze.${_extra}`,
            when: sStart,
            prio: 9,
            dataRef: {type:'season_recap', sid: lastArchived.id, championId: topElo[0].id, championElo: topElo[0].elo, topElo, tafel: _tafel}
          });
        }
      }
    }
  } catch(e){}

  // ── 11. Persönliche Sieg-Milestones (unbegrenzte Leiter ab 100) ──
  // Nutzt byPlayer + bestehendes won(). Trigger nur, wenn das JÜNGSTE Match
  // (ein Sieg) eine Leiter-Marke reißt → stabil & einmalig (ID enthält Marke).
  try {
    activePlayers().forEach(p => {
      const arr = byPlayer[p.id] || [];
      if(!arr.length) return;
      let wins = 0;
      for(let i = 0; i < arr.length; i++) if(won(p.id, arr[i])) wins++;
      const last = arr[arr.length-1];
      const lastWon = won(p.id, last);
      // v9.5: 100, 250, 500, 1000, 2500, 5000, … statt fixem Ende bei 1000.
      const mark = _ladderCrossing(wins - (lastWon ? 1 : 0), wins, 100);
      if(mark){
        stories.push({
          id: 'milestone_wins_'+p.id+'_'+mark,
          cat: 'personal',
          ic: 'trophy',
          title: `${nameOf(p.id)}: Sieg Nummer ${mark}`,
          desc: `${nameOf(p.id)} feiert den ${mark}. Sieg.`,
          when: new Date(last.created_at),
          prio: mark >= 500 ? 9 : mark >= 250 ? 7 : 5,
          dataRef: {type:'milestone_wins', pid: p.id, milestone: mark+'. Sieg', matchId: last.id}
        });
      }
    });
  } catch(e){}

  // ── 12. Elo-Anstieg der VERGANGENEN Woche (größter Aufsteiger) ──
  // v9.5: abgeschlossene ISO-Woche statt rollende 7 Tage — der „größte
  // Anstieg" steht erst fest, wenn die Woche vorbei ist (belastbar/final).
  try {
    const gains = {};
    for(let i = 0; i < matches.length; i++){
      const m = matches[i];
      const t = mts(m);
      if(t < _wocheStart || t >= _wocheEnde) continue;
      const hist = histMap.get(m.id);
      if(!hist || !hist.deltas) continue;
      for(const pid in hist.deltas){
        gains[pid] = (gains[pid] || 0) + hist.deltas[pid];
      }
    }
    let topPid = null, topGain = 0;
    for(const pid in gains){
      if(!pm[pid] || pm[pid].hidden) continue;
      if(gains[pid] > topGain){ topGain = gains[pid]; topPid = pid; }
    }
    if(topPid && topGain >= 50){
      const delta = Math.round(topGain);
      _wochenTeile.push({
        art: 'riser', ic: 'trendUp', label: 'Größter Aufwind',
        pids: [topPid], wert: '+' + delta,
        satz: `${nameOf(topPid)} hat in dieser Woche ${delta} Elo gutgemacht. Das ist der größte Anstieg der Liga.`
      });
    }
  } catch(e){}

  // ── 13. Härtester Elo-Verlust von GESTERN (Pechvogel) ──
  // v9.5: voller Kalendertag „gestern" statt rollende 24 h — nur ein
  // abgeschlossener Tag liefert einen endgültigen „größten Verlust".
  try {
    const losses = {};
    for(let i = 0; i < matches.length; i++){
      const m = matches[i];
      const t = mts(m);
      if(t < _startOfYesterday || t >= _startOfToday) continue;
      const hist = histMap.get(m.id);
      if(!hist || !hist.deltas) continue;
      for(const pid in hist.deltas){
        losses[pid] = (losses[pid] || 0) + hist.deltas[pid];
      }
    }
    let worstPid = null, worstDelta = 0;
    for(const pid in losses){
      if(!pm[pid] || pm[pid].hidden) continue;
      if(losses[pid] < worstDelta){ worstDelta = losses[pid]; worstPid = pid; }
    }
    if(worstPid && worstDelta <= -25){ // v8.8: -20→-25 — nur echte Pech-Tage
      const delta = Math.round(worstDelta);
      stories.push({
        id: 'elo_swing_day_'+worstPid+'_'+_yesterdayKey,
        cat: 'misfortune',
        ic: 'dropDouble',
        title: `${nameOf(worstPid)} mit hartem Tag`,
        desc: `${delta} Elo. Der größte Verlust von gestern.`,
        when: new Date(_startOfToday),
        prio: 5,
        dataRef: {type:'elo_swing', pid: worstPid, delta, period: 'Gestern'}
      });
    }
  } catch(e){}

  // ── 14. Größter Kantersieg der VERGANGENEN Woche ──
  // v9.5: abgeschlossene Woche — der „höchste Sieg" steht erst nach Wochenende
  // fest. Tordifferenz ≥ 8, Story verweist aufs Match.
  try {
    let biggest = null;
    for(let i = 0; i < matches.length; i++){
      const m = matches[i];
      const t = mts(m);
      if(t < _wocheStart || t >= _wocheEnde) continue;
      const diff = Math.abs((m.score_a||0) - (m.score_b||0));
      if(!biggest || diff > biggest.diff){
        biggest = {m, diff, t};
      }
    }
    if(biggest && biggest.diff >= 8){
      const _sg = (biggest.m.winner === 'A' ? [biggest.m.a1, biggest.m.a2] : [biggest.m.b1, biggest.m.b2]).filter(Boolean);
      _wochenTeile.push({
        art: 'blowout', ic: 'thriller', label: 'Klarster Sieg',
        pids: _sg, wert: biggest.m.score_a + ':' + biggest.m.score_b, matchId: biggest.m.id,
        satz: `${_sg.map(nameOf).join(' und ')} gewinnen mit ${biggest.diff} Toren Unterschied. Kein Sieg dieser Woche war deutlicher.`
      });
    }
  } catch(e){}

  // ── Gestrichen: „Vor genau einem Jahr" ───────────────────────────────
  // Der Typ suchte ein Match von vor 365 Tagen. Die Liga läuft seit 66 Tagen,
  // die Karte hat also noch nie erscheinen können — und ihr Text lautete nur
  // „Damals stand es 10:8", ohne Spieler und ohne Grund.

  // ── 16. Upset der Woche (Underdog schlägt Top-Spieler) ──
  // Sucht in der vergangenen Woche das Match mit dem größten preRank-Vorteil
  // des Verlierers (= Sieger war schwächer rangiert). Nutzt getRankSnapshots.
  // v9.5: abgeschlossene Woche — der „größte Upset" ist erst nach Wochenende final.
  try {
    let bestUpset = null;
    for(let i = 0; i < matches.length; i++){
      const m = matches[i];
      const t = mts(m);
      if(t < _wocheStart || t >= _wocheEnde) continue;
      const snap = snaps[m.id];
      if(!snap || !snap.preRank) continue;
      const winners = m.winner === 'A' ? [m.a1, m.a2] : [m.b1, m.b2];
      const losers  = m.winner === 'A' ? [m.b1, m.b2] : [m.a1, m.a2];
      // beste preRank der Sieger (niedrigste Zahl = besser)
      // beste preRank der Verlierer
      const winnerBest = Math.min(...winners.map(p => snap.preRank[p] || 99));
      const loserBest  = Math.min(...losers.map(p  => snap.preRank[p] || 99));
      // Upset: Sieger waren SCHLECHTER (höhere Zahl) als Verlierer
      const gap = winnerBest - loserBest;
      if(gap >= 3 && (!bestUpset || gap > bestUpset.gap)){
        bestUpset = {m, gap, t, winners, losers, winnerBest, loserBest};
      }
    }
    if(bestUpset){
      const m = bestUpset.m;
      _wochenTeile.push({
        art: 'upset', ic: 'thriller', label: 'Größte Überraschung',
        pids: bestUpset.winners.slice(0, 2), wert: 'Platz ' + bestUpset.winnerBest, matchId: m.id,
        satz: `${bestUpset.winners.map(nameOf).join(' und ')} stehen auf Platz ${bestUpset.winnerBest} und schlagen Platz ${bestUpset.loserBest}. Der größte Sprung dieser Woche.`
      });
    }
  } catch(e){}

  // ── 16b. Gipfeltreffen: Platz 1 bezwingt Platz 2 (v8.8, v9.3) ──
  // Sucht in den letzten 7 Tagen das JÜNGSTE Match, in dem das Team des
  // Pre-Rank-#1 gegen das Team des #2 antrat und der #1 gewann.
  // v9.3: Am SAISONANFANG unterdrückt — dann haben erst wenige Spieler gespielt
  // und die Ränge sind instabil; ein „Gipfeltreffen" wirkt verfrüht. Solange
  // bleibt der Champion der Vorsaison (season_recap) im Breaking-Rampenlicht.
  try {
    const _clashSeasonAge = (now - seasonStart()) / 86400000;
    const _clashSeasonMs  = matchesInSeason(currentSeason().id);
    const _clashPlayers   = new Set();
    _clashSeasonMs.forEach(m => [m.a1,m.a2,m.b1,m.b2].forEach(id => _clashPlayers.add(id)));
    const _seasonMature   = _clashSeasonAge >= 8 && _clashSeasonMs.length >= 12 && _clashPlayers.size >= 5;
    if(_seasonMature){
      const wk = 7 * 86400000;
      const tsNow = now.getTime();
      let best = null;
      for(let i = matches.length - 1; i >= 0; i--){
        const m = matches[i];
        const t = mts(m);
        if(t > tsNow) continue;
        if(t < tsNow - wk) break; // matches asc → ab hier nur noch älter
        const snap = snaps[m.id];
        if(!snap || !snap.preRank) continue;
        const winners = m.winner === 'A' ? [m.a1, m.a2] : [m.b1, m.b2];
        const losers  = m.winner === 'A' ? [m.b1, m.b2] : [m.a1, m.a2];
        const winnerBest = Math.min(...winners.map(p => snap.preRank[p] || 99));
        const loserBest  = Math.min(...losers.map(p  => snap.preRank[p] || 99));
        if(winnerBest === 1 && loserBest === 2){
          const p1 = winners.find(p => (snap.preRank[p]||99) === 1); // Platz-1-Spieler (Sieger-Team)
          const p2 = losers.find(p  => (snap.preRank[p]||99) === 2); // Platz-2-Spieler (Verlierer-Team)
          if(p1 && p2 && pm[p1] && pm[p2] && !pm[p1].hidden && !pm[p2].hidden){
            best = {m, t, winners, losers, p1, p2}; break;
          }
        }
      }
      if(best){
        const m = best.m;
        stories.push({
          id: 'top_clash_'+m.id,
          cat: 'highlight',
          ic: 'kingClass',
          title: `Gipfeltreffen: ${nameOf(best.p1)} bezwingt ${nameOf(best.p2)}`,
          desc: `Tabellenführer ${nameOf(best.p1)} setzt sich im direkten Duell gegen Verfolger ${nameOf(best.p2)} durch und baut den Vorsprung an der Spitze aus.`,
          when: new Date(best.t),
          prio: 9,
          dataRef: {type:'top_clash', matchId: m.id, winners: best.winners, losers: best.losers, p1: best.p1, p2: best.p2,
                    playerIds:[best.p1, best.p2]}
        });
      }
    }
  } catch(e){}

  // ── 16c. Breaking: All-Time-Rekorde & Giant Slayer (v9.4) ──
  try {
    const rec = _allTimeRecords();
    const RECENT = 14 * 86400000;
    const nowTs = now.getTime();
    const startElo = cfg.start_elo ?? 0;
    const mature = matches.length >= 30; // erst bei genug Liga-Historie

    // Neuer Elo-Rekord: höchster je erreichter Elo-Stand der Liga
    if(mature && rec.eloRec && rec.eloRec.when){
      const pid = rec.eloRec.pid;
      if((nowTs - new Date(rec.eloRec.when).getTime()) < RECENT && pm[pid] && !pm[pid].hidden && rec.eloRec.val >= startElo + 40){
        stories.push({
          id: 'elo_record_'+rec.eloRec.matchId,
          cat: 'highlight', ic: 'peak',
          title: `Neuer Elo-Rekord: ${nameOf(pid)}`,
          desc: `${nameOf(pid)} schraubt die Bestmarke auf ${rec.eloRec.val} Elo. So hoch stand in der Liga noch nie jemand.`,
          when: new Date(rec.eloRec.when), prio: 10,
          dataRef: {type:'elo_record', pid, elo: rec.eloRec.val, matchId: rec.eloRec.matchId}
        });
      }
    }

    // Längste Siegesserie aller Zeiten
    if(mature && rec.streakRec && rec.streakRec.when && rec.streakRec.val >= 6){
      const pid = rec.streakRec.pid;
      if((nowTs - new Date(rec.streakRec.when).getTime()) < RECENT && pm[pid] && !pm[pid].hidden){
        stories.push({
          id: 'streak_record_'+rec.streakRec.matchId,
          cat: 'highlight', ic: 'crownFlame',
          title: `Serien-Rekord: ${nameOf(pid)}`,
          desc: `${rec.streakRec.val} Siege am Stück. Die längste Siegesserie, die die Liga je gesehen hat.`,
          when: new Date(rec.streakRec.when), prio: 10,
          dataRef: {type:'streak_record', pid, streak: rec.streakRec.val, matchId: rec.streakRec.matchId}
        });
      }
    }

    // Giant Slayer: ein Team gewinnt mit unter 20% Siegchance (letzte 7 Tage,
    // das extremste Match). Suppress-Regel gegen Upset-Doppel siehe Consolidation.
    {
      const wk = 7 * 86400000;
      let gs = null;
      for(let i = matches.length - 1; i >= 0; i--){
        const m = matches[i];
        const t = mts(m);
        if(t > nowTs) continue;
        if(t < nowTs - wk) break;
        const expA = (m.exp_a == null) ? 0.5 : m.exp_a;
        const winnerChance = m.winner === 'A' ? expA : (1 - expA);
        if(winnerChance < 0.20){
          const winners = m.winner === 'A' ? [m.a1, m.a2] : [m.b1, m.b2];
          const losers  = m.winner === 'A' ? [m.b1, m.b2] : [m.a1, m.a2];
          if(winners.every(p => pm[p] && !pm[p].hidden) && (!gs || winnerChance < gs.chance)){
            gs = { m, chance: winnerChance, winners, losers };
          }
        }
      }
      if(gs){
        const wNames = gs.winners.map(nameOf).join(' & ');
        const lNames = gs.losers.map(nameOf).join(' & ');
        const pct = Math.max(1, Math.round(gs.chance * 100));
        stories.push({
          id: 'giant_slayer_'+gs.m.id,
          cat: 'highlight', ic: 'giantSlayer',
          title: `Giant Slayer: ${wNames}`,
          desc: `Nur ${pct}% Siegchance. Und trotzdem gewonnen: ${wNames} zwingen ${lNames} in einer echten Sensation in die Knie.`,
          when: new Date(gs.m.created_at), prio: 10,
          dataRef: {type:'giant_slayer', matchId: gs.m.id, winners: gs.winners, losers: gs.losers, chance: gs.chance}
        });
      }
    }
  } catch(e){}

  // ── 17. Serienkiller (Match beendete ≥4er Sieges-Streak des Gegners) ──
  // Nutzt getStreakSnapshots — pro Match {pid: streak_VOR_match}. v9.7: Schwelle
  // von 6 auf 4 gesenkt; zusätzlich merken wir uns das Sieger-Team (wer die
  // Serie gestoppt hat), damit die News zeigt, welches Team welchen Spieler
  // gebremst hat.
  // v9.8: Serien ≥7 werden IMMER als eigene News getriggert (jede einzelne).
  // Für kleinere Unterbrechungen (4–6) bleibt es bei der EINEN prominentesten,
  // damit der Feed bei vielen 4er-Serien nicht zuspammt.
  try {
    const wk = 14 * 86400000;
    const tsNow = now.getTime();
    const streakSnaps = (typeof getStreakSnapshots === 'function') ? getStreakSnapshots() : {};
    const kills = [];
    for(let i = 0; i < matches.length; i++){
      const m = matches[i];
      const t = mts(m);
      if(t < tsNow - wk || t > tsNow) continue;
      const snap = streakSnaps[m.id];
      if(!snap) continue;
      const losers  = m.winner === 'A' ? [m.b1, m.b2] : [m.a1, m.a2];
      const winners = m.winner === 'A' ? [m.a1, m.a2] : [m.b1, m.b2];
      // Höchste laufende Streak unter den Verlierern VOR diesem Match
      let maxLoserStreak = 0, victimPid = null;
      losers.forEach(pid => {
        const s = snap[pid] || 0;
        if(s > maxLoserStreak){ maxLoserStreak = s; victimPid = pid; }
      });
      if(maxLoserStreak >= 4){
        kills.push({m, streak: maxLoserStreak, victimPid, winners, t});
      }
    }
    // ≥7 immer (alle), 4–6 nur die prominenteste (falls es keine ≥7 gab bzw.
    // zusätzlich als „ruhige-Phase"-Fallback, wenn gar keine große Serie fiel).
    const big = kills.filter(k => k.streak >= 7);
    const small = kills.filter(k => k.streak < 7).sort((a, b) => b.streak - a.streak || b.t - a.t);
    const chosen = big.slice();
    if(!big.length && small.length) chosen.push(small[0]);
    chosen.forEach(kill => {
      const m = kill.m;
      const breakerIds = (kill.winners || []).filter(Boolean);
      const breakerNames = breakerIds.map(nameOf).join(' & ');
      stories.push({
        id: 'streak_killer_'+m.id,
        cat: 'highlight',
        ic: 'crossedSwords',
        title: `Serie gerissen: ${nameOf(kill.victimPid)}`,
        desc: `${breakerNames} stoppen die Serie nach ${kill.streak} Siegen am Stück.`,
        when: new Date(kill.t),
        prio: kill.streak >= 10 ? 9 : 7,
        dataRef: {type:'streak_killer', matchId: m.id, streak: kill.streak, victimPid: kill.victimPid, breakerIds}
      });
    });
  } catch(e){}

  // ── 18. Krimi der VERGANGENEN Woche (knappstes Match, Tordifferenz = 1) ──
  // v9.5: abgeschlossene Woche — der „knappste Sieg" ist erst final, wenn die
  // Woche vorbei ist.
  try {
    let thriller = null;
    for(let i = 0; i < matches.length; i++){
      const m = matches[i];
      const t = mts(m);
      if(t < _wocheStart || t >= _wocheEnde) continue;
      const diff = Math.abs((m.score_a||0) - (m.score_b||0));
      // Nur 1-Tor-Krimis ab Score ≥ 8 (anders sind 1:0 oder 2:1 wenig spannend)
      if(diff !== 1) continue;
      const totalScore = (m.score_a||0) + (m.score_b||0);
      if(totalScore < 17) continue;
      if(!thriller || totalScore > thriller.totalScore){
        thriller = {m, totalScore, t};
      }
    }
    if(thriller){
      const m = thriller.m;
      const _tg = (m.winner === 'A' ? [m.a1, m.a2] : [m.b1, m.b2]).filter(Boolean);
      _wochenTeile.push({
        art: 'thriller', ic: 'thriller', label: 'Krimi der Woche',
        pids: _tg, wert: m.score_a + ':' + m.score_b, matchId: m.id,
        satz: `${_tg.map(nameOf).join(' und ')} entscheiden das Spiel mit dem letzten Tor. ${thriller.totalScore} Tore fielen, mehr als in jeder anderen Partie dieser Woche.`
      });
    }
  } catch(e){}

  // ── 19. Rivalitäts-Meilenstein (50/100/200/500 H2H-Duelle ERREICHT) ──
  // Im Gegensatz zu Story 7 (Rivalry) triggert das nur, wenn das jüngste
  // Match der Paarung gerade eine Schwelle riss → "100. Aufeinandertreffen!".
  try {
    const pairThresholds = [50, 100, 200, 500];
    const pairCnt = {};
    matches.forEach(m => {
      const A = [m.a1, m.a2], B = [m.b1, m.b2];
      A.forEach(a => B.forEach(b => {
        if(a === b) return;
        const k = a < b ? a+'|'+b : b+'|'+a;
        if(!pairCnt[k]) pairCnt[k] = {n:0, lastId:null, lastTs:0};
        pairCnt[k].n++;
        const ts = mts(m);
        if(ts > pairCnt[k].lastTs){ pairCnt[k].lastTs = ts; pairCnt[k].lastId = m.id; }
      }));
    });
    Object.entries(pairCnt).forEach(([k, v]) => {
      if(!pairThresholds.includes(v.n)) return;
      const [a, b] = k.split('|');
      if(!pm[a] || !pm[b] || pm[a].hidden || pm[b].hidden) return;
      stories.push({
        id: 'rivalry_milestone_'+k+'_'+v.n,
        cat: 'rivalry',
        ic: 'crossedSwords',
        title: `${v.n}. Duell: ${nameOf(a)} vs ${nameOf(b)}`,
        desc: `Das ${v.n}. Aufeinandertreffen dieser beiden.`,
        when: new Date(v.lastTs),
        prio: v.n >= 200 ? 9 : v.n >= 100 ? 8 : 6,
        dataRef: {type:'rivalry_milestone', a, b, n: v.n, matchId: v.lastId}
      });
    });
  } catch(e){}

  // ── 20. Tor-Meilensteine (unbegrenzte Leiter ab 500 Karriere-Tore) ──
  try {
    activePlayers().forEach(p => {
      const arr = byPlayer[p.id] || [];
      if(!arr.length) return;
      let goals = 0;
      for(let i = 0; i < arr.length; i++){
        const m = arr[i];
        const onA = (p.id===m.a1||p.id===m.a2);
        goals += onA ? (m.score_a||0) : (m.score_b||0);
      }
      // v9.5: das jüngste Match liefert die letzten Tore → prüfen, ob damit eine
      // Leiter-Marke gerissen wurde (500, 1000, 2500, 5000, 10000, …).
      const last = arr[arr.length-1];
      const lastGoals = (p.id===last.a1||p.id===last.a2) ? (last.score_a||0) : (last.score_b||0);
      const mark = _ladderCrossing(goals - lastGoals, goals, 500);
      if(mark){
        stories.push({
          id: 'milestone_goals_'+p.id+'_'+mark,
          cat: 'personal',
          ic: 'target',
          title: `${nameOf(p.id)}: ${mark}. Tor`,
          desc: `${goals} Tore stehen jetzt in der Karriere-Bilanz von ${nameOf(p.id)}.`,
          when: new Date(last.created_at),
          prio: mark >= 1000 ? 8 : 6,
          dataRef: {type:'milestone_goals', pid: p.id, milestone: mark+'. Tor', matchId: last.id}
        });
      }
    });
  } catch(e){}

  // ── 20b. Persönliche Elo-Meilensteine (unbegrenzt, v9.5) ──
  // Allzeit-Höchst-Elo überschreitet eine runde 100er-Marke (ab Start-Elo+200).
  // Nur „frische" Marken (Rekord-Match ≤ 14 Tage alt) werden zur News — sonst
  // würde beim ersten Lauf die gesamte Historie nachträglich einfließen.
  try {
    const RECENT = 14 * _dayMs;
    const nowTs = now.getTime();
    _eloMilestones().forEach(e => {
      if(!e.when || !pm[e.pid] || pm[e.pid].hidden) return;
      if(nowTs - new Date(e.when).getTime() > RECENT) return;
      stories.push({
        id: 'milestone_elo_'+e.pid+'_'+e.mark,
        cat: 'personal',
        ic: 'peak',
        title: `${nameOf(e.pid)} knackt ${e.mark} Elo`,
        desc: `${e.mark} Elo zum ersten Mal überschritten. Das ist der höchste Stand der Laufbahn.`,
        when: new Date(e.when),
        prio: e.mark >= (cfg.start_elo ?? 1000) + 500 ? 8 : 6,
        dataRef: {type:'milestone_elo', pid: e.pid, milestone: e.mark+' Elo', mark: e.mark, matchId: e.matchId}
      });
    });
  } catch(e){}

  // ── 21. Aktive Sieges-Streak (≥5 in Folge, läuft noch) ──
  // Pendant zu loss_streak. Spieler dessen jüngstes Match Sieg war und
  // davor noch ≥4 weitere Siege.
  try {
    const candidates = [];
    activePlayers().forEach(p => {
      const arr = byPlayer[p.id] || [];
      if(!arr.length) return;
      let streak = 0;
      for(let i = arr.length - 1; i >= 0; i--){
        if(!won(p.id, arr[i])) break;
        streak++;
        if(streak > 20) break;
      }
      if(streak >= 5){
        candidates.push({pid: p.id, streak, when: new Date(arr[arr.length-1].created_at)});
      }
    });
    candidates.sort((a,b) => b.streak - a.streak);
    // v9.17 FORMULIERUNG: Bis zu 3 Spieler bekamen denselben Satz „aktuell
    // heißeste Form der Liga" — das kann nur auf den Führenden zutreffen. Der
    // Superlativ hängt jetzt an der tatsächlichen Bestmarke, alle anderen
    // bekommen den Abstand dazu.
    const _topStreak = candidates[0].streak;
    candidates.slice(0, 3).forEach(c => {
      const gap = _topStreak - c.streak;
      stories.push({
        id: 'win_streak_'+c.pid+'_'+c.when.toISOString().slice(0,10),
        cat: 'highlight',
        ic: 'flame',
        title: `${nameOf(c.pid)} ungeschlagen`,
        desc: gap === 0
          ? `${c.streak} Siege in Folge. Aktuell die längste laufende Serie der Liga.`
          : `${c.streak} Siege in Folge. Nur noch ${gap} ${gap === 1 ? 'Sieg' : 'Siege'} bis zur längsten laufenden Serie.`,
        when: c.when,
        prio: c.streak >= 10 ? 9 : c.streak >= 7 ? 7 : 6,
        dataRef: {type:'win_streak', pid: c.pid, streak: c.streak}
      });
    });
  } catch(e){}

  // ── 22. Längste Pause (kein Spielbetrieb in den letzten X Tagen) ──
  // Story zeigt sich erst, wenn die aktuelle "Stille" ≥3 Tage andauert.
  // v9.17 FORMULIERUNG: Der Text behauptete pauschal „Längste Pause seit Langem"
  // — ungeprüft und bei einer 3-Tage-Lücke schlicht falsch. Jetzt wird die
  // längste Pause der Liga-Historie mitgerechnet (eine Schleife über die bereits
  // aufsteigend sortierten Matches) und nur dann als Rekord benannt, wenn sie es
  // auch ist. Sonst gibt es die ehrliche Einordnung gegen die Bestmarke.
  try {
    if(matches.length){
      const lastMatchTs = mts(matches[matches.length-1]);
      const sinceLastDays = Math.floor((now.getTime() - lastMatchTs) / 86400000);
      if(sinceLastDays >= 3){
        let maxGapDays = 0;
        for(let i = 1; i < matches.length; i++){
          const gap = Math.floor((mts(matches[i]) - mts(matches[i-1])) / 86400000);
          if(gap > maxGapDays) maxGapDays = gap;
        }
        const isRecord = sinceLastDays > maxGapDays;
        stories.push({
          // Pro Pause genau 1 Story (lastMatchId bleibt stabil bis zum
          // nächsten Match) — kein täglicher Spam mehr.
          id: 'dry_spell_'+matches[matches.length-1].id,
          cat: 'fun',
          ic: 'clock',
          title: `${sinceLastDays} Tage ohne Spiel`,
          desc: isRecord
            ? `So lange stand der Kicker noch nie still.`
            : `Die längste Pause der Liga waren ${maxGapDays} Tage.`,
          when: now,
          prio: 3,
          dataRef: {type:'dry_spell', daysSince: sinceLastDays, lastMatchId: matches[matches.length-1].id, maxGapDays}
        });
      }
    }
  } catch(e){}

  // ── Spieler der Woche (POTW) der Vorwoche (v8.7) ──
  // Persistente News zu Wochenbeginn (Mo früh), analog zum POTW-Recap-Sheet.
  // Deterministische ID pro Woche → kein Doppel, Cross-Device-stabil.
  try {
    if(typeof _potwLastWeekRange === 'function' && typeof _potwKeyOf === 'function'){
      const range = _potwLastWeekRange();
      // Derselbe Ausschnitt wie im Rückblick [§C27]: der Filter stand hier
      // ein zweites Mal, Zeile für Zeile dieselbe — und zwei Rechnungen über
      // dieselbe Frage nennen irgendwann zwei verschiedene Beste.
      const wm = _potwMatchesInRange(range.start, range.end);
      const res = _newsPeriodWinner(wm, 5, 'wr'); // Wochen-Regel = höchste Quote
      if(res){
        const main = res.main;
        const names = res.winners.map(w => nameOf(w.id));
        _wochenTeile.unshift({
          art: 'potw', ic: 'weekKing', label: 'Spieler der Woche', held: true,
          pids: res.winners.map(w => w.id), wert: Math.round(main.wr*100) + ' %',
          satz: `${names.join(' und ')} gewinnt ${main.wins} von ${main.wins + main.losses} Partien. Das ist die beste Quote der Woche.`,
          potw: {weekKey: _potwKeyOf(range.start), playerId: main.id,
                 playerIds: res.winners.map(w => w.id), wins: main.wins, wr: main.wr}
        });
      }
    }
  } catch(e){}

  // ── Spieler des Tages (POTD) des letzten Spieltags (v8.7) ──
  // Persistente News am Folgetag (früh), analog zum POTD-Recap-Sheet.
  try {
    if(typeof _potdLastDayData === 'function'){
      const data = _potdLastDayData(); // {dayKey, dayMatches} | null
      if(data){
        // v9.17: Tages-Regel = meiste Siege (Tiebreak Elo-Delta) — identisch zu
        // showPotdRecap und zum Badge-Zähler countDayWins.
        const res = _newsPeriodWinner(data.dayMatches, 3, 'wins');
        if(res){
          // Die Karte erscheint um 23:59 DESSELBEN Tages, nicht mehr um 07:00
          // des Folgetags. Um 23:59 kann keine Partie mehr dazukommen (die
          // späteste der Liga hat um 18 Uhr angefangen), und die Karte steht
          // damit unter dem Datum, an dem gespielt wurde.
          const rep = new Date(data.dayKey + 'T00:00:00'); rep.setHours(23, 59, 0, 0);
          if(now.getTime() >= rep.getTime()){
            const main = res.main;
            const names = res.winners.map(w => nameOf(w.id));
            const titleNames = names.length > 1 ? names.slice(0, -1).join(', ') + ' & ' + names[names.length-1] : names[0];
            const p = data.dayKey.split('-');
            const dLabel = p[2] + '.' + p[1] + '.';
            stories.push({
              id: 'potd_' + data.dayKey,
              cat: 'highlight',
              ic: 'dayKing',
              title: names.length > 1 ? `${titleNames}: Spieler des Tages` : `${titleNames} ist Spieler des Tages`,
              // v9.17: Die Siegquote steht NICHT mehr vorn — der Titel wird über
              // die absoluten Tagessiege vergeben (siehe _newsPeriodWinner). Die
              // Quote bleibt als Kontext, damit die Zahl einordbar ist.
              desc: `${main.wins} von ${main.wins + main.losses} Partien gewonnen, ${Math.round(main.wr*100)} % Siegquote. Kein anderer holte am ${dLabel} mehr Siege.`,
              when: rep,
              prio: 7,
              dataRef: {type:'potd', dayKey: data.dayKey, playerId: main.id, playerIds: res.winners.map(w => w.id),
                        wins: main.wins, games: main.wins + main.losses, wr: main.wr}
            });
          }
        }
      }
    }
  } catch(e){}

  // Hinweis (v8.6): Die Konsolidierung gegen Match-Event-Spam (mehrere fast
  // identische Karten pro Match) passiert bewusst NICHT hier im Generator,
  // sondern beim Anzeigen (_consolidateStories, §11.2) — siehe Begründung dort.

  // ── Das Team der Woche ───────────────────────────────────────────────
  // Es gab Team-SERIEN („7 Siege am Stück") und ein Team der Saison, aber
  // nichts dazwischen: die beste Paarung einer Woche kam im Feed nicht vor,
  // obwohl der Spieler der Woche seit jeher eine Karte hat. Gerechnet wird
  // mit `teamStatsFromMatches` — derselben Funktion, aus der auch der
  // Teams-Tab seine Zahlen zieht [§C27]; eine zweite Rechnung über dieselbe
  // Frage nennt irgendwann ein anderes Duo als die Ansicht daneben.
  try {
    {
      const wochenMs = matches.filter(m => {
        const t = mts(m); return t >= _wocheStart && t < _wocheEnde;
      });
      if(wochenMs.length){
        const duos = teamStatsFromMatches(wochenMs)
          .filter(t => t.g >= 4 && t.ids.every(id => pm[id] && !pm[id].hidden))
          // Quote zuerst, dann die Zahl der Partien: ein 4:0 ist stärker als
          // ein 9:3, aber bei gleicher Quote zählt, wer öfter angetreten ist.
          .sort((a, b) => (b.w/b.g) - (a.w/a.g) || b.g - a.g || (b.gf-b.ga) - (a.gf-a.ga));
        const best = duos[0];
        if(best && best.w > best.g - best.w){
          const q = Math.round(best.w / best.g * 100);
          _wochenTeile.push({
            art: 'team', ic: 'duo', label: 'Team der Woche', duo: true,
            pids: best.ids, wert: q + ' %',
            satz: `${nameOf(best.ids[0])} und ${nameOf(best.ids[1])} gewinnen ${best.w} der ${best.g} gemeinsamen Partien, bei ${best.gf}:${best.ga} Toren.`
                + (duos[1]
                    ? ` Dahinter ${nameOf(duos[1].ids[0])} und ${nameOf(duos[1].ids[1])} mit ${Math.round(duos[1].w/duos[1].g*100)} %.`
                    : ' Kein zweites Duo kam auf vier gemeinsame Partien.'),
            team: {playerIds:best.ids, wins:best.w, games:best.g, gf:best.gf, ga:best.ga}
          });
        }
      }
    }
  } catch(e){ if(NEWS_DEBUG || window.NEWS_DEBUG) console.warn('[news] team der woche', e); }

  // ── Die Woche: sechs Wertungen in einer Karte ────────────────────────
  // Sie steht am Sonntag um 23:00, wenn die Woche vorbei ist und der Montag als
  // Spieltag noch nicht angefangen hat. Erscheint gar nicht, wenn die Woche
  // keine Partie hatte: ein Wochenrückblick ohne Woche ist ein Kalendereintrag.
  try {
    if(_wocheDue && _wochenTeile.length >= 2){
      const _wHeld = _wochenTeile.find(t => t.held) || _wochenTeile[0];
      const _wSpiele = matches.filter(m => { const t = mts(m); return t >= _wocheStart && t < _wocheEnde; });
      const _wTage = new Set(_wSpiele.map(m => new Date(m.created_at).toDateString())).size;
      const _wName = _wHeld.pids.map(nameOf).join(' und ');
      const _wSchluss = new Date(_wocheSlotTs);
      stories.push({
        id: 'woche_' + _lastWeekKey,
        cat: 'season',
        ic: 'weekKing',
        title: _wHeld.art === 'potw' ? `Die Woche gehört ${_wName}` : `Die Woche der Liga`,
        desc: `${_wSpiele.length} Partien an ${_wTage} ${_wTage === 1 ? 'Tag' : 'Tagen'}. `
            + _wHeld.satz,
        when: _wSchluss,
        prio: 9,
        dataRef: {type:'woche', woche:_lastWeekKey, spiele:_wSpiele.length, tage:_wTage,
                  playerIds: _wHeld.pids.slice(0, 2),
                  teile: _wochenTeile.map(t => ({art:t.art, ic:t.ic, label:t.label, pids:t.pids,
                                                 wert:t.wert, satz:t.satz, duo:!!t.duo,
                                                 matchId:t.matchId || null}))}
      });
    }
  } catch(e){ if(NEWS_DEBUG || window.NEWS_DEBUG) console.warn('[news] wochenkarte', e); }

  // ── §11.8 Die Ewige Tafel meldet sich ────────────────────────────────
  // Der ganze Awards-Reiter kam im Feed nicht vor. Wer einen Liga-Rekord
  // übernahm, eine Monatschronik holte oder eine Insignium-Stufe erreichte,
  // erfuhr davon nur, wenn er selbst nachsah — und genau das hätte eine
  // Liga-Zeitung zu melden.
  //
  // Die Quelle ist ein Zeitschnitt: der Rekordstand VOR dem letzten Spieltag
  // gegen den von heute. `allChronicles(bisMs)` kostet einmal ~18 ms und liegt
  // danach in `_chronCtxBis`; der Generator selbst ist ohnehin memoisiert.
  try {
    const _letzteMs = matches.length ? mts(matches[matches.length-1]) : 0;
    if(_letzteMs){
      const _tag0 = new Date(_letzteMs); _tag0.setHours(0, 0, 0, 0);
      const _jetzt = allChronicles().byId;
      const _vorher = allChronicles(_tag0.getTime() - 1).byId;
      const _kammer = k => (CHRON_KINDS[k] && CHRON_KINDS[k].label) || 'Liga-Rekord';
      let _rekAusbau = 0;
      CHRONICLES.forEach(def => {
        const n = _jetzt[def.id];
        if(!n) return;
        // Schattenseiten meldet der Feed nicht. „Neuer Bestwert im Verlieren"
        // ist keine Nachricht, sondern eine Ohrfeige — und die Liga liest
        // den Feed gemeinsam [§C33].
        if(def.kind === 'shame') return;
        const a = _vorher[def.id];
        let art = '';
        if(!a) art = 'erstmals';
        else if(a.pids.join(',') !== n.pids.join(',')) art = 'geholt';
        // „Ausgebaut" nur, wenn man es SIEHT. Ein Anteil rückt an fast jedem
        // Spieltag um ein Tausendstel weiter; das ergab neun Karten „X baut
        // seinen Rekord aus" an einem Morgen, auf denen dieselbe Zahl stand
        // wie vorher. Verglichen wird deshalb der angezeigte Wert — dieselbe
        // Zahl, die auch das Podest zeigt.
        else if(_chronKurz(a.ev) !== _chronKurz(n.ev)) art = 'gesteigert';
        if(!art) return;
        const neuN = n.pids.map(nameOf);
        const namen = neuN.length > 1
          ? neuN.slice(0, -1).join(', ') + ' & ' + neuN[neuN.length-1] : neuN[0];
        // Im Vergleich steht nur die ZAHL, nicht der ganze Beleg. Zwei volle
        // Belege nebeneinander („20 % seiner 25 Siege endeten 10:9 · 5 —
        // Jane stand bei 18 % seiner 55 Siege endeten 10:9 · 10") sind kein
        // Satz mehr. Der Beleg steht dahinter, die Bedingung erklärt ihn.
        const wertNeu = _chronKurz(n.ev), wertAlt = a ? _chronKurz(a.ev) : '';
        let title, desc;
        if(art === 'erstmals'){
          title = `Erstmals vergeben: ${def.name}`;
          desc = `${n.ev}. Vor ${neuN.length > 1 ? 'ihnen' : 'ihm'} hat diesen Rekord niemand gehalten.`;
        } else if(art === 'geholt'){
          const altN = (a.pids || []).map(nameOf).join(' & ') || 'der bisherige Halter';
          title = `${namen} übernimmt „${def.name}"`;
          desc = `${n.ev}. ${altN} stand bei ${wertAlt}.`;
        } else {
          title = `${namen} baut „${def.name}" aus`;
          desc = `${n.ev}. Vorher ${wertAlt}.`;
        }
        if(art === 'gesteigert' && ++_rekAusbau > NEWS_LIMITS.rekordAusbau) return;
        stories.push({
          id: `rek_${def.id}_${art}_${n.pids.join('-')}_${Math.round(n.val * 1e4)}`,
          cat: 'tafel',
          ic: def.ic,
          title, desc,
          when: _letzteMs,
          prio: art === 'erstmals' ? 92 : art === 'geholt' ? 84 : 70,
          dataRef: {type:'rekord_' + art, rekordId:def.id, kammer:def.kind,
                    zufall:def.zufall || '', playerIds:n.pids.slice(0, 3),
                    vorher:(a && a.pids) || [], wert:n.val, ev:n.ev, cond:def.cond,
                    kammerLabel:_kammer(def.kind)}
        });
      });
    }
  } catch(e){ if(NEWS_DEBUG || window.NEWS_DEBUG) console.warn('[news] rekorde', e); }

  // ── Die Chronik eines abgeschlossenen Monats ─────────────────────────
  // EINE Karte je Monat statt einer je Eintrag: dreiundzwanzig Einträge
  // wären dreiundzwanzig Karten an einem Morgen. Die drei mit den meisten
  // Einträgen bekommen ihr Gesicht [§C33], den Rest zeigt die Tafel.
  try {
    const _vorSid = _prevSeasonId(currentSeason().id);
    if(_vorSid){
      const T = seasonTitles(_vorSid);
      if(T && T.awarded && T.awarded.length){
        const proSpieler = {};
        T.awarded.forEach(x => { proSpieler[x.pid] = (proSpieler[x.pid] || 0) + 1; });
        const rang = Object.keys(proSpieler).sort((x, y) => proSpieler[y] - proSpieler[x]);
        const spitze = rang.slice(0, 3);
        // Die Karte erscheint mit dem Monatswechsel um 00:00 am Monatsersten.
        // Vorher stand sie um 09:00 und damit mitten im nächsten Tag; um
        // Mitternacht steht sie an der Spitze des neuen Monats, und wer nachts
        // aufs Telefon schaut, sieht den Wechsel sofort.
        // seasonEnd endet auf 23:59:59 des Vormonats. Gemeint ist der erste
        // Moment des neuen Monats, deshalb der nächste Tag um 00:00.
        const _mEnde = seasonEnd(_vorSid);
        const wann = new Date(_mEnde.getFullYear(), _mEnde.getMonth(), _mEnde.getDate() + 1, 0, 0, 0, 0).getTime();
        if(now.getTime() >= wann){
          stories.push({
            id: 'chronik_' + _vorSid,
            cat: 'tafel',
            ic: 'scroll',
            title: `Die Chronik für ${seasonLabel(_vorSid)} steht`,
            desc: `${T.awarded.length} Einträge gehen an ${rang.length} Spieler. Vorn steht `
                + spitze.map(pid => `${nameOf(pid)} mit ${proSpieler[pid]}`).join(', ')
                + '.',
            when: wann,
            prio: 88,
            dataRef: {type:'chronik_monat', sid:_vorSid, playerIds:spitze,
                      eintraege:T.awarded.length, traeger:rang.length}
          });
          // Wer zum ERSTEN Mal überhaupt einen Monatseintrag holt, bekommt
          // eine eigene Karte. Das ist der Moment, den ein Neuling oder ein
          // Spieler aus der unteren Hälfte sonst nie im Feed sieht.
          T.awarded.forEach(x => {
            let frueher = 0;
            try { frueher = (seasonTitleHistory(x.pid) || [])
              .filter(r => r.title && r.sid !== _vorSid && r.sid < _vorSid).length; } catch(e){ frueher = 1; }
            if(frueher > 0) return;
            stories.push({
              id: 'chronik_erst_' + x.pid + '_' + _vorSid,
              cat: 'tafel',
              ic: x.ic || 'scroll',
              title: `${nameOf(x.pid)} steht zum ersten Mal in der Chronik`,
              desc: `„${x.name}" im ${seasonLabel(_vorSid)} ist der erste Monatseintrag überhaupt.`
                  + (x.ev ? ` ${x.ev}.` : ''),
              when: wann + 60000,
              prio: 90,
              dataRef: {type:'chronik_erstling', sid:_vorSid, pid:x.pid, titel:x.name}
            });
          });
        }
      }
    }
  } catch(e){ if(NEWS_DEBUG || window.NEWS_DEBUG) console.warn('[news] chronik', e); }

  // ── Eine neue Stufe am Insignium ─────────────────────────────────────
  // Es gibt keinen „Stand von gestern" fürs Prestige — ein zweiter voller
  // Lauf wäre zu teuer. Das Gedächtnis ist stattdessen der Feed selbst: die
  // Story-ID trägt Spieler und Stufe, und persistierte Stories werden nie
  // doppelt eingefügt. Gemeldet wird nur, wer die Schwelle GERADE erst
  // überschritten hat (weniger als ein Viertel darüber) — sonst stünden
  // beim ersten Lauf alle zwölf Stufen auf einmal im Feed.
  try {
    (players || []).filter(p => p && !p.hidden).forEach(p => {
      const P = prestigeOf(p.id);
      if(!P || P.stufe < 1) return;
      const schwelle = INSIGNIEN[P.stufe].min;
      if(P.punkte >= schwelle * 1.25) return;
      const oben = P.stufe >= 3;   // Lorbeerreif und Ordensstern
      stories.push({
        id: 'ins_' + p.id + '_' + INSIGNIEN[P.stufe].key,
        cat: 'tafel',
        ic: 'award',
        title: `${p.name} trägt den ${INSIGNIEN[P.stufe].name}`,
        desc: `${P.teile.auszeichnung} aus Auszeichnungen, ${P.teile.monat} aus Monaten, `
            + `${P.teile.rekord} aus Rekorden.`
            + (P.naechste ? ` Bis zum ${P.naechste.name} fehlen ${P.fehlt}.` : ''),
        when: matches.length ? mts(matches[matches.length-1]) : now.getTime(),
        prio: oben ? 95 : 76,
        dataRef: {type:'insignium_stufe', pid:p.id, stufe:P.stufe,
                  stufeName:INSIGNIEN[P.stufe].name, punkte:P.punkte, oben}
      });
    });
  } catch(e){ if(NEWS_DEBUG || window.NEWS_DEBUG) console.warn('[news] insignium', e); }

  // ── Ambiente Tages-Stories (v8.5) ──
  // Zeitlich verteilte Fun Facts / Nuggets, damit der Feed auch ohne neue
  // Matches lebt. Tages-deterministisch → kein Cross-Device-Spam.
  try {
    const amb = _buildAmbientStories(now, pm, nameOf);
    for(const a of amb) stories.push(a);
  } catch(e){ if(NEWS_DEBUG || window.NEWS_DEBUG) console.warn('[news] ambient build failed', e); }

  // ── Final-Sort + Limit ──
  // v8.2: PURE Chronologie (User-Wunsch). Neueste Story zuerst, älteste
  // zuletzt — in ALLEN Views (Mini-Popup, Feed, Filter) konsistent.
  // Wichtige Stories landen ohnehin oben, weil ihre `when`-Werte meist
  // "jetzt" sind (saison_endspurt, anniversary, elo_swing*). Bei gleichem
  // Timestamp dient Prio als deterministischer Tiebreaker.
  stories.sort((a,b) => {
    const dt = b.when - a.when;
    if(dt !== 0) return dt;
    return b.prio - a.prio;
  });

  // ── Anti-Spam: Per-Player-Limit (v8.1) ──
  // Verhindert, dass ein einzelner Spieler den Feed dominiert. Nach dem
  // Sort sind die wichtigsten Stories pro Spieler bereits zuerst — wir nehmen
  // also die ersten N und kappen den Rest. Stories ohne Spieler-Bezug
  // (saison_endgame, season_recap, quiet_week, biggest_blowout, anniversary)
  // sind nicht limitiert.
  // v9.24: Gezählt wird JEDES Gesicht, nicht nur die Hauptfigur. Vorher stand
  // hier `d.pid || d.playerId` — wer als Partner, Gegner oder Serienbrecher
  // genannt wurde, tauchte daneben beliebig oft auf. Gemessen stand Maxi auf
  // neun von einunddreißig Karten und Stefan auf einer, obwohl der Deckel
  // formal bei drei lag.
  const PER_PLAYER_LIMIT = 3;
  const NEBENROLLEN_LIMIT = 5;   // dazu höchstens so oft im Bild
  const perPlayer = {};
  const imBild = {};
  const deduped = [];
  for(const s of stories){
    const d = s.dataRef || {};
    const pid = d.pid || d.playerId || d.newLeader || null;
    // Wer sonst noch auf der Karte steht. `_newsPids` ist die einzige Stelle,
    // die weiß, in welchem Feld die Ids je Typ liegen [§C33].
    let gesichter = [];
    try { gesichter = (typeof _newsPids === 'function') ? _newsPids(s) : []; } catch(e){ gesichter = []; }
    if(pid && d.rarity !== 'legendary' && gesichter.length
       && gesichter.every(id => (imBild[id] || 0) >= NEBENROLLEN_LIMIT)) continue;
    // v9.17: Goldene (legendary) Auszeichnungen sind vom Limit ausgenommen. Sonst
    // konnte ein aktiver Spieler sein Budget mit Alltags-Stories aufbrauchen und
    // ausgerechnet das Karriere-Highlight fiel raus — und bei Team-Badges (10:0)
    // fehlte dann einer der beiden Namen in der zusammengefassten Karte.
    if(!pid || d.rarity === 'legendary'){
      gesichter.forEach(id => { imBild[id] = (imBild[id] || 0) + 1; });
      deduped.push(s);
      continue;
    }
    if(!perPlayer[pid]) perPlayer[pid] = 0;
    if(perPlayer[pid] >= PER_PLAYER_LIMIT) continue;
    perPlayer[pid]++;
    gesichter.forEach(id => { imBild[id] = (imBild[id] || 0) + 1; });
    deduped.push(s);
  }
  // Ergebnis memoisieren (v8.4) — siehe Memoization-Guard oben.
  const _result = deduped.slice(0, NEWS_LIMITS.total);
  _cache._buildStoriesKey = _buildStoriesKey;
  _cache._buildStoriesResult = _result;
  return _result;
}

// Gewinner einer Periode (POTW/POTD) — MUSS dieselbe Regel benutzen wie das
// jeweilige Recap-Sheet und der Badge-Zähler, sonst nennt die News einen
// anderen Spieler als Pop-up und Auszeichnung.
//
// v9.17 BUGFIX: Es gab nur EINE Regel (Siegquote zuerst) — die gilt aber nur
// für den Spieler der WOCHE. Der Spieler des TAGES wird sowohl im Pop-up
// (showPotdRecap) als auch im Badge-Zähler (_winnerCountsOf, kind='day') über
// die ABSOLUTEN Tagessiege bestimmt, Tiebreak Elo-Delta — die Siegquote spielt
// keine Rolle. Ergebnis: „Spieler des Tages" in den News konnte jemand anderes
// sein als im Pop-up und im Profil (z.B. 3 Siege bei 100% statt 7 bei 88%).
// Darum jetzt zwei Modi:
//   mode 'wins' (POTD) → Siege ↓, Elo-Delta ↓        (= showPotdRecap / kind 'day')
//   mode 'wr'   (POTW) → Quote ↓, Siege ↓, Elo ↓     (= showPotwRecap / kind 'week')
// Geteilter Sieg nur bei Gleichstand über ALLE Kriterien des Modus.
// Liefert {winners:[…], main} oder null. (v8.7, v9.17)
function _newsPeriodWinner(rangeMatches, minWins, mode){
  if(!Array.isArray(rangeMatches) || !rangeMatches.length) return null;
  const byWins = mode !== 'wr'; // Default = Tages-Regel (absolute Siege)
  const ps = {};
  for(const m of rangeMatches){
    const aWon = m.winner === 'A';
    [m.a1, m.a2, m.b1, m.b2].forEach(id => {
      if(!ps[id]) ps[id] = {wins:0, losses:0, eloDelta:0};
      const onA = (m.a1 === id || m.a2 === id);
      const won = (onA && aWon) || (!onA && !aWon);
      ps[id].eloDelta += (m.deltas && m.deltas[id]) || 0;
      if(won) ps[id].wins++; else ps[id].losses++;
    });
  }
  const pm = pmap();
  const cand = Object.entries(ps)
    .filter(([id, s]) => s.wins >= minWins && pm[id] && !pm[id].hidden)
    .map(([id, s]) => { const g = s.wins + s.losses; return {id, wins: s.wins, losses: s.losses, eloDelta: s.eloDelta, wr: g ? s.wins/g : 0}; })
    .sort((a, b) => {
      if(byWins){
        if(b.wins !== a.wins) return b.wins - a.wins;
        return b.eloDelta - a.eloDelta;
      }
      if(Math.abs(b.wr - a.wr) > 0.001) return b.wr - a.wr;
      if(b.wins !== a.wins) return b.wins - a.wins;
      return b.eloDelta - a.eloDelta;
    });
  if(!cand.length) return null;
  const top = cand[0];
  const tied = byWins
    ? cand.filter(c => c.wins === top.wins && Math.abs(c.eloDelta - top.eloDelta) < 0.001)
    : cand.filter(c => Math.abs(c.wr - top.wr) < 0.001);
  return { winners: tied, main: top };
}

