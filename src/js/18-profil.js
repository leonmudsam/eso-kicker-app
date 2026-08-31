// Ermittelt alle Awards, die ein Spieler aktuell hält (Platz 1–3)
function playerAwards(id){
  // Cache pro Spieler — wird beim Profil-Öffnen UND von showPlayerAwards aufgerufen.
  // Key bindet an matches.length + cache.version → invalidiert automatisch bei
  // neuem Match oder Sim-Reset.
  const _pawKey = 'paw_'+id+'_'+matches.length+'_'+_cache.version;
  if(!_cache._playerAwards) _cache._playerAwards = {};
  if(_cache._playerAwards[_pawKey]) return _cache._playerAwards[_pawKey];
  const R=awardRankings('all');
  const found=[];

  // Hilfsfunktion: Rang eines Spielers in einem Array berechnen
  // berücksichtigt geteilte Plätze
  const getRank=(arr,valFn,checkFn)=>{
    if(!arr||!arr.length) return -1;
    const topVal=valFn(arr[0]);
    let rank=1;
    for(let i=0;i<Math.min(arr.length,10);i++){
      const val=valFn(arr[i]);
      if(i>0 && val!==valFn(arr[i-1])) rank=i+1;
      if(rank>3) break;
      if(checkFn(arr[i])) return rank-1; // 0-basiert für Kompatibilität
    }
    return -1;
  };

  // Einzel-Awards
  const singleKeys={
    wins:R.winsList, streaks:R.streaks, scorer:R.scorer, wall:R.wall,
    perfect:R.perfect, grinder:R.grinder, worstWr:R.worstWr,
    worstAtk:R.worstAtk, worstDef:R.worstDef,
    clutch:R.clutchList, carryKing:R.carryList,
    onFire:R.onFire, coldStreak:R.coldStreak, lossStreaks:R.lossStreaks,
    solo:R.soloList, formtief:R.formtief, showmaster:R.showmasterList,
    ice:R.iceList, peakElo:R.peakEloList,
    weekKing:R.weekKingList, dayKing:R.dayKingList,
    // ── NEUE AWARDS v3 ──
    plusMinus:R.plusMinusList, underdog:R.underdogList, pechvogel:R.pechvogelList,
    // ── NEUE NEGATIV-AWARDS v6 ──
    favoriteLoser:R.favoriteLoserList
  };
  const singleValFns={
    wins:x=>x.v, streaks:x=>x.v, scorer:x=>Math.round(x.avg*10),
    wall:x=>-Math.round(x.v/x.g*10), // weniger = besser → negieren
    perfect:x=>Math.round(x.wr*100), grinder:x=>x.v,
    worstWr:x=>-Math.round(x.wr*100), // weniger = "besser" für Schandtafel → negieren
    worstAtk:x=>-Math.round(x.v/x.g*10),
    worstDef:x=>Math.round(x.v/x.g*10),
    clutch:x=>Math.round(x.wr*100),
    carryKing:x=>x.v, onFire:x=>x.v, coldStreak:x=>x.v,
    lossStreaks:x=>x.v, solo:x=>Math.round(x.wr*100),
    formtief:x=>Math.round(x.drop), showmaster:x=>x.v, ice:x=>x.v,
    peakElo:x=>x.v,
    weekKing:x=>x.v, dayKing:x=>x.v,
    // ── NEUE AWARDS v3 ──
    plusMinus:x=>Math.round(x.v*10), // höchster Tor-Saldo gewinnt
    underdog:x=>x.v,                  // meiste Underdog-Siege gewinnt
    pechvogel:x=>Math.round(x.pct*1000),  // höchstes Pct an knappen Niederlagen = Top-1
    // ── NEUE NEGATIV-AWARDS v6 ──
    favoriteLoser:x=>Math.round(x.v*1000) // rate-basiert (v = Quote)
  };

  // Display-Werte für die Trophäen-Anzeige im Spieler-Awards-Sheet.
  // Format ist konsistent mit den Card-Aufrufen in vAwards (Awards-Tab).
  const singleDisplayFns={
    wins:x=>x.v, streaks:x=>x.v+'er', scorer:x=>x.avg.toFixed(1),
    wall:x=>(x.v/x.g).toFixed(1), perfect:x=>Math.round(x.wr*100)+'%', grinder:x=>x.v,
    worstWr:x=>Math.round(x.wr*100)+'%',
    worstAtk:x=>(x.v/x.g).toFixed(1), worstDef:x=>(x.v/x.g).toFixed(1),
    clutch:x=>Math.round(x.wr*100)+'%',
    carryKing:x=>x.v, onFire:x=>x.v+'er', coldStreak:x=>x.v+'er',
    lossStreaks:x=>x.v+'er', solo:x=>Math.round(x.wr*100)+'%',
    formtief:x=>'-'+Math.round(x.drop), showmaster:x=>x.v, ice:x=>x.v,
    peakElo:x=>x.v, weekKing:x=>x.v, dayKing:x=>x.v,
    plusMinus:x=>(x.v>=0?'+':'')+x.v.toFixed(1), underdog:x=>x.v,
    pechvogel:x=>Math.round(x.pct*100)+'%',
    // ── NEUE NEGATIV-AWARDS v6 ──
    favoriteLoser:x=>Math.round(x.v*100)+'%'
  };

  Object.entries(singleKeys).forEach(([key,arr])=>{
    if(!arr||!arr.length) return;
    const valFn=singleValFns[key]||(x=>x.v);
    const rank=getRank(arr,valFn,x=>x.id===id);
    if(rank>=0 && rank<=2){
      const entry=arr.find(x=>x.id===id);
      const dispFn=singleDisplayFns[key]||(x=>x.v);
      found.push({key,rank,val:entry?String(dispFn(entry)):''});
    }
  });

  // Team-Awards (2 Spieler)
  const teamKeys={
    mvt:R.mvt, bestDuo:R.bestDuo, worstTeam:R.worstTeam,
    endgegner:R.endgegner,
    zirkus:R.zirkusList, baustelle:R.baustelleList,
    // ── NEUE TEAM-AWARDS v4 ──
    unstoppable:R.unstoppableList, concreteWall:R.concreteWallList,
    luckyCharm:R.luckyCharmList, giantSlayer:R.giantSlayerList,
    favoritenschreck:R.favoritenschreckList,
    // ── NEUE NEGATIV-AWARDS v6 ──
    cheesePlatter:R.cheesePlatterList
  };
  const teamValFns={
    mvt:x=>Math.round(x.v), bestDuo:x=>x.g,
    worstTeam:x=>-Math.round(x.w/x.g*100),
    endgegner:x=>Math.round(x.pct*1000),       // rate-basiert
    zirkus:x=>Math.round(x.pct*1000),          // rate-basiert
    baustelle:x=>x.best,
    // ── NEUE TEAM-AWARDS v4 ──
    unstoppable:x=>x.v,
    concreteWall:x=>-Math.round(x.v*100),      // niedriger = besser → negieren
    luckyCharm:x=>Math.round(x.v*1000),        // rate-basiert (v = Quote)
    giantSlayer:x=>Math.round(x.v*1000),       // rate-basiert (v = Quote)
    favoritenschreck:x=>x.v,
    // ── NEUE NEGATIV-AWARDS v6 ──
    cheesePlatter:x=>Math.round(x.v*100)       // höher = schlechter, direkt sortieren
  };
  const teamDisplayFns={
    mvt:x=>(x.v>=0?'+':'')+Math.round(x.v), bestDuo:x=>x.g+' Sp.',
    worstTeam:x=>Math.round(x.w/x.g*100)+'%',
    endgegner:x=>Math.round(x.pct*100)+'%',
    zirkus:x=>Math.round(x.pct*100)+'%',
    baustelle:x=>x.best+'er',
    // ── NEUE TEAM-AWARDS v4 ──
    unstoppable:x=>x.v+'er',
    concreteWall:x=>x.v.toFixed(2),
    luckyCharm:x=>Math.round(x.v*100)+'%',
    giantSlayer:x=>Math.round(x.v*100)+'%',
    favoritenschreck:x=>x.v+' Elo',
    // ── NEUE NEGATIV-AWARDS v6 ──
    cheesePlatter:x=>x.v.toFixed(2)
  };
  Object.entries(teamKeys).forEach(([key,arr])=>{
    if(!arr||!arr.length) return;
    const valFn=teamValFns[key]||(x=>x.v);
    const rank=getRank(arr,valFn,x=>x.ids&&x.ids.includes(id));
    if(rank>=0 && rank<=2){
      const entry=arr.find(x=>x.ids&&x.ids.includes(id));
      const partner=entry?entry.ids.find(x=>x!==id):null;
      const dispFn=teamDisplayFns[key]||(x=>x.v);
      found.push({key,rank,partner,val:entry?String(dispFn(entry)):''});
    }
  });

  // Rivalry-Award (4 Spieler) — alle 4 erhalten den Award.
  // Partner-Anzeige: das jeweils andere Team ("vs X & Y")
  if(R.rivalryList && R.rivalryList.length){
    const rArr = R.rivalryList;
    const valFn = x => Math.round(x.pct*1000); // rate-basiert
    const rank = getRank(rArr, valFn, x => [...x.idsA, ...x.idsB].includes(id));
    if(rank>=0 && rank<=2){
      const entry = rArr.find(x => [...x.idsA, ...x.idsB].includes(id));
      if(entry){
        const onA = entry.idsA.includes(id);
        const opponentIds = onA ? entry.idsB : entry.idsA;
        const partnerLabel = pname(opponentIds[0])+' & '+pname(opponentIds[1]);
        // partner=null signalisiert dem Renderer "Spezial-Label statt Avatar-Plaque"
        found.push({key:'rivalry', rank, partner:null, partnerLabel:'vs '+partnerLabel, val:Math.round(entry.pct*100)+'%'});
      }
    }
  }

  // Match-Awards
  // ⚠ BUG-FIX: Match-Awards (upset/biggest) gelten NUR für das Gewinner-Team.
  // Vorher hat .includes(id) ALLE 4 Spieler des Matches erkannt — auch die
  // Verlierer haben "Größte Überraschung" als positiven Award bekommen.
  // Konsistent mit vAwards()/_addColl und showAward(), die jeweils die
  // Avatare des Gewinner-Teams (m.winner) zeigen.
  const matchKeys={upset:R.upsets, biggest:R.biggest};
  const matchValFns={upset:x=>Math.round(x.sp*100), biggest:x=>x.diff};
  const matchDisplayFns={upset:x=>Math.round(x.sp*100)+'%', biggest:x=>x.diff+' Tore'};
  const winnerIds = x => x.m.winner === 'A' ? [x.m.a1, x.m.a2] : [x.m.b1, x.m.b2];
  Object.entries(matchKeys).forEach(([key,arr])=>{
    if(!arr||!arr.length) return;
    const valFn=matchValFns[key];
    const rank=getRank(arr,valFn,x=>winnerIds(x).includes(id));
    if(rank>=0 && rank<=2){
      const entry=arr.find(x=>winnerIds(x).includes(id));
      const dispFn=matchDisplayFns[key];
      found.push({key,rank,val:entry?String(dispFn(entry)):''});
    }
  });

  _cache._playerAwards[_pawKey] = found;
  return found;
}

function showPlayer(id){
  const p=pmap()[id];if(!p)return;
  _sheetSetReopen(()=>showPlayer(id));
  const allStats = allPlayerStats(); // Hole den globalen Cache einmal
  const s = allStats[id] || playerStats(id); // Nutze Cache, Fallback für versteckte Spieler
  const {best,worst}=bestWorstMate(id, s); // Übergebe 's'
  const {nemesis:nem,favorite:fav}=nemesis(id, s); // Übergebe 's'
  const wr=Math.round(s.wr*100);
  const atkWr=s.atkWr!==null?Math.round(s.atkWr*100):null;
  const defWr=s.defWr!==null?Math.round(s.defWr*100):null;
  // Saison-Platzierung: nur Spieler mit Spielen IN DIESER SAISON werden gerankt.
  // Wer 0 Saison-Spiele hat, bekommt keinen #-Badge.
  // Sortierung: Saison-Elo (gSim.elo enthält nach Saison-Reset die aktuelle Saison-Elo).
  const gSim=getGlobalSim();
  const rankedSeason=activePlayers()
    .filter(x=>(gSim.playedSeason[x.id]||0)>0)
    .sort((a,b)=>(gSim.elo[b.id]??cfg.start_elo)-(gSim.elo[a.id]??cfg.start_elo));
  const rank=rankedSeason.findIndex(x=>x.id===id)+1;
  const streak=s.curStreak;
  const autoAtk=atkStrength(id);
  const atkPct=Math.round(autoAtk*100);
  const defPct=100-atkPct;
  const _streakInfo=longestPlayerStreakInfo(id,matches);
  const longestStr=_streakInfo.best;
  // Peak-Datum als kompakter "Monat Jahr"-String (dezent), z.B. "Mai 2026"
  const longestPeakLabel = _streakInfo.peakDate
    ? new Date(_streakInfo.peakDate).toLocaleDateString('de-DE',{month:'long',year:'numeric'})
    : '';
  // Letzte 15 Spiele (chronologisch alt→neu) für die "Aktuelle Serie"-Card.
  // Ergänzt den bisherigen "letzte 5"-Form-Trail oben, der in der Header-Sektion bleibt.
  const _last15 = matches.filter(m=>[m.a1,m.a2,m.b1,m.b2].includes(id))
    .sort((a,b)=>mts(b)-mts(a))
    .slice(0,15).reverse();
  const last15DotsHtml = _last15.map(m=>{
    const onA=(id===m.a1||id===m.a2);
    const w=(onA&&m.winner==='A')||(!onA&&m.winner==='B');
    return `<i class="${w?'':'l'}"></i>`;
  }).join('');

  // Form: letzte 5 Matches
  const formMs=matches.filter(m=>[m.a1,m.a2,m.b1,m.b2].includes(id))
    .sort((a,b)=>mts(b)-mts(a)).slice(0,5).reverse();
  const formHtml=formMs.map(m=>{const onA=(id===m.a1||id===m.a2);
    const w=(onA&&m.winner==='A')||(!onA&&m.winner==='B');
    return `<div class="pd ${w?'w':'l'}"></div>`;}).join('');

  // Elo-Sparkline für die aktuelle Saison (zeigt Saison-Verlauf)
  let sparkHtml='';
  {
    const seasonMs=matchesInSeason().filter(m=>[m.a1,m.a2,m.b1,m.b2].includes(id))
      .sort((a,b)=>mts(a)-mts(b));
    if(seasonMs.length>=2){
      // FIX: Spark-Trace aus der echten Sim-History bauen, NICHT aus m.deltas (DB).
      // m.deltas kann durch Algo-Tweaks vs. live-Sim divergieren → Anzeige zeigt 222 Elo,
      // Spark zeigt aber +221 weil die Summe der DB-Deltas leicht abweicht.
      // Mit sim.history.eloAfter[id] endet die Linie exakt auf dem angezeigten Elo-Wert.
      const histById = getHistoryByMatchId();
      let eloTrace = cfg.start_elo;
      const series = [eloTrace];
      for(const m of seasonMs){
        const h = histById.get(m.id);
        if(h && h.eloAfter && h.eloAfter[id] !== undefined){
          eloTrace = h.eloAfter[id];
        } else {
          // Fallback (z.B. Match liegt außerhalb der Sim wegen versteckter Spieler):
          // DB-Delta verwenden, damit die Linie weiterläuft
          eloTrace += (m.deltas||{})[id] || 0;
        }
        series.push(eloTrace);
      }
      const minE=Math.min(...series), maxE=Math.max(...series);
      const range=Math.max(20, maxE-minE); // mind. 20 Elo-Range für Sichtbarkeit
      const W=300, H=42, pad=4;
      const usableH=H-2*pad;
      const points=series.map((e,i)=>{
        const x=(i/(series.length-1))*W;
        const y=pad+(1-(e-minE)/range)*usableH;
        return [x,y];
      });
      const linePath='M'+points.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' L');
      const fillPath=linePath+` L${W},${H} L0,${H} Z`;
      const last=points[points.length-1];
      // Konsistenz mit der Elo-Anzeige: gerundete Endsumme minus gerundeter Start
      const net=Math.round(series[series.length-1])-Math.round(series[0]);
      const netCls=net>=0?'pos':'neg';
      const netTxt=(net>=0?'+':'')+net;
      // [§C25] Regel 1: Die eigene Elo-Kurve heißt „ich" — sie trägt die
      // Rangfarbe, nicht Grün oder Rot. Die Richtung steht als Vorzeichen
      // im Fuß darunter, wo Regel 3 gilt.
      const lineCol='var(--ak)';
      const gradId='ppspark-'+id;
      sparkHtml=`
        <div class="pp-spark">
          <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
            <defs>
              <linearGradient id="${esc(gradId)}" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="${lineCol}" stop-opacity=".35"/>
                <stop offset="100%" stop-color="${lineCol}" stop-opacity="0"/>
              </linearGradient>
            </defs>
            <path d="${fillPath}" fill="url(#${esc(gradId)})"/>
            <path d="${linePath}" fill="none" stroke="${lineCol}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="2.5" fill="${lineCol}"/>
          </svg>
        </div>
        <div class="pp-spark-foot">
          <span>Elo · ${esc(seasonLabel(currentSeason().id))}</span>
          <span class="delta ${netCls}">${netTxt}</span>
        </div>`;
    }
  }

  const streakBadge = streakInline(streak);
  const _posCls = posClassify(autoAtk);
  const posIcon = svgI(_posCls.icon);
  const posLabel = _posCls.label;

  // ── Peak-Elo (Saison + Allzeit) für die Trinity-Box ──
  // Peak Saison: höchster Stand in der LAUFENDEN Saison — aus History rekonstruiert
  // Peak Allzeit: höchster je erreichter Saison-Elo (saison-übergreifend, aus globalSim)
  // Zusätzlich: Saison-Label des Allzeit-Peaks als Sub-Text ("Mai 2026")
  let peakSeason = null, peakAlltime = null, peakAlltimeSeason = '';
  {
    const histByMatch = getHistoryByMatchId();
    // Peak Saison: über alle Saison-Matches des Spielers in chronologischer Reihenfolge
    const seasonMsForPeak = matchesInSeason()
      .filter(m=>[m.a1,m.a2,m.b1,m.b2].includes(id))
      .sort((a,b)=>mts(a)-mts(b));
    if(seasonMsForPeak.length){
      let v = cfg.start_elo, mx = v;
      for(const m of seasonMsForPeak){
        const h = histByMatch.get(m.id);
        if(h && h.eloAfter && h.eloAfter[id]!==undefined) v = h.eloAfter[id];
        else v += (m.deltas||{})[id] || 0;
        if(v > mx) mx = v;
      }
      peakSeason = Math.round(mx);
    }
    // Peak Allzeit: bevorzugt aus globalSim.peakElo, sonst über alle Matches scannen
    const peakV = gSim.peakElo ? gSim.peakElo[id] : undefined;
    if(peakV !== undefined){
      peakAlltime = Math.round(peakV);
      // Saison-Label des Peak-Matches finden (höchster eloAfter[id] über alle Matches).
      // Einmaliger O(n)-Scan beim Öffnen des Profils — getHistoryByMatchId ist gecached.
      let bestMatch = null, bestVal = -Infinity;
      for(const m of matches){
        if(![m.a1,m.a2,m.b1,m.b2].includes(id)) continue;
        const h = histByMatch.get(m.id);
        if(!h || !h.eloAfter || h.eloAfter[id] === undefined) continue;
        if(h.eloAfter[id] > bestVal){
          bestVal = h.eloAfter[id];
          bestMatch = m;
        }
      }
      if(bestMatch){
        const sn = seasonOf(bestMatch.created_at);
        peakAlltimeSeason = sn.label;
      }
    }
  }

  // Awards: NUR Platz 1
  const awards=playerAwards(id).filter(a=>a.rank===0);
  const awardCount=awards.length;

  // Awards-Kategorisierung: jede Award gehört zu GENAU EINER Kategorie (exklusiv).
  // Aufteilung in 3 thematische Cluster für klare Übersicht.
  // Positive: rein individuelle Leistung + (positive) Rollen-Awards (Torjäger, Abwehr, Eiskalt).
  // Team:     alle Awards, die ein DUO/Team ausmachen (mvt, bestDuo, endgegner, neue Team-Awards
  //           inkl. Erzfeinde/Rivalry).
  // Negative: Schandtafel + negative Rollen-Awards (Zahnloser Stürmer, Löchrigste Abwehr).
  const POSITIVE_KEYS = new Set([
    'wins','perfect','clutch','carryKing','solo',
    'grinder','showmaster','onFire','streaks','peakElo',
    'weekKing','dayKing',
    // Rollen-Awards (positiv)
    'scorer','wall','ice',
    // ── NEUE AWARDS v3 ──
    'plusMinus','underdog'
  ]);
  const TEAM_KEYS = new Set([
    'mvt','bestDuo','endgegner',
    // Match-Awards sind Team-Leistungen — Sieg/Coup eines konkreten Duos.
    'upset','biggest',
    // ── NEUE TEAM-AWARDS v4 ──
    'unstoppable','concreteWall','luckyCharm','giantSlayer','rivalry'
  ]);
  const NEGATIVE_KEYS = new Set([
    'worstWr','coldStreak','lossStreaks','formtief','worstTeam','zirkus','baustelle',
    'worstAtk','worstDef',
    // ── NEUE AWARDS v3 ──
    'pechvogel',
    // ── NEUE TEAM-AWARDS v4 ──
    'favoritenschreck',
    // ── NEUE NEGATIV-AWARDS v6 ──
    'cheesePlatter','favoriteLoser'
  ]);

  const cnt = (set) => awards.filter(a => set.has(a.key)).length;
  const awCats = [
    {ic:'star',      nm:'Positive<br>Awards', n: cnt(POSITIVE_KEYS)},
    {ic:'handshake', nm:'Team<br>Awards',     n: cnt(TEAM_KEYS)},
    {ic:'skull',     nm:'Negative<br>Awards', n: cnt(NEGATIVE_KEYS)},
  ];

  const badges=getCachedBadges(id);
  const badgeTotal=badges.reduce((sum,b)=>sum+b.count,0);

  const sa = playerSeasonAwards(id);
  const seasonHistory = computeSeasonHistory(id, 5);
  // Saison-Trend: vergleicht jüngste mit älteren Platzierungen
  const seasonTrend = (() => {
    if(!seasonHistory || seasonHistory.length < 2) return null;
    const places = seasonHistory.map(h => h.place).filter(p => p > 0);
    if(places.length < 2) return null;
    const half = Math.ceil(places.length / 2);
    const recent = places.slice(0, half);
    const older = places.slice(half);
    if(!older.length) return null;
    const recentAvg = recent.reduce((a,b)=>a+b, 0) / recent.length;
    const olderAvg  = older.reduce((a,b)=>a+b, 0) / older.length;
    if(recentAvg < olderAvg - 0.5) return {arrow:'↗', cls:'', text:'Form steigend'};
    if(recentAvg > olderAvg + 0.5) return {arrow:'↘', cls:'neg', text:'Form fallend'};
    const avg = places.reduce((a,b)=>a+b, 0) / places.length;
    if(avg <= 3) return {arrow:'→', cls:'', text:'stabil top 3'};
    if(avg <= 5) return {arrow:'→', cls:'neutral', text:'stabil top 5'};
    return {arrow:'→', cls:'neutral', text:'Ø Platz '+Math.round(avg)};
  })();

  const rInfo = getPlayerRank(id);
  const tierClass = rInfo ? ('pp-tier-' + rInfo.label.toLowerCase()
    .replace('ä','a').replace('ö','o').replace('ü','u')) : '';

  // Perzentil-Berechnung
  let percentileTxt = '', percentilePct = 0;
  if(rInfo){
    const avgs = getSeasonAvgElos();
    const ranked = players.filter(pp=>!pp.hidden && avgs[pp.id]!==null)
      .sort((a,b)=>avgs[b.id]-avgs[a.id]);
    const idx = ranked.findIndex(x=>x.id===id);
    if(idx>=0){
      const pct = ((idx+1)/ranked.length)*100;
      percentileTxt = 'Top ' + Math.ceil(pct) + '%';
      percentilePct = pct;
    }
  }

  // Avatar
  const avInner = avatarInnerHtml(p);
  const hasEmoji = !!(p.avatar_id && avatarEmoji(p.avatar_id));
  // Kein inline-Grund mehr: die Scheibe hinter dem Buchstaben war eine
  // aus der Spieler-ID gewürfelte Hashfarbe. Im Profil kommt sie jetzt
  // aus dem Rang [§C25] — überall sonst bleibt avColor() unberührt.
  const avBg = '';
  const avClass = hasEmoji ? 'pp-av-inner icon-av' : 'pp-av-inner';

  // Eine Karte pro Auszeichnung (chronologisch, neueste zuerst)
  // Wenn ein Spieler in einer Saison sowohl Player als auch Team-Champion war,
  // bekommt er beide Karten separat.
  const trophies = [];
  sa.forEach(s=>{
    if(s.player_id===id){
      trophies.push({type:'player', label:s.label||'', date:s.id||s.start_date||''});
    }
    if(s.team_p1===id||s.team_p2===id){
      const mate = s.team_p1===id ? s.team_p2 : s.team_p1;
      trophies.push({type:'team', label:s.label||'', date:s.id||s.start_date||'', mate});
    }
  });
  // Sortierung: neueste zuerst (Saison-ID ist 'YYYY-MM', String-Sort = chronologisch)
  trophies.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
  const trophyHtml = `
    <div class="pp-trophies">
      ${trophies.map(t=>{
        if(t.type==='player') return `
        <div class="pp-tr">
          <span class="ic svg-ic">${svgI('trophy')}</span>
          <div class="ti">Player of<br>the Season</div>
          <div class="su">${esc(t.label)}</div>
        </div>`;
        const teamAttr = t.mate ? ` data-team="${esc([id,t.mate].sort().join('|'))}"` : '';
        return `
        <div class="pp-tr team"${teamAttr}>
          <span class="ic svg-ic">${svgI('handshake')}</span>
          <div class="ti">Team of<br>the Season</div>
          <div class="su">${esc(t.label)}</div>
        </div>`;
      }).join('')}
    </div>`;

  const seasonRailHtml = seasonHistory.length ? `
    <div class="pp-seasons" id="ppSeasonsRail">
      ${seasonHistory.map(sn=>{
        const cls = sn.place===1?'gold':sn.place===2?'silver':sn.place===3?'bronze':'';
        const medal = sn.place>=1&&sn.place<=3 ? medalB(sn.place-1) : '';
        const eloCls = sn.eloDelta>=0?'pos':'neg';
        const eloTxt = (sn.eloDelta>=0?'+':'')+sn.eloDelta;
        return `<div class="pp-sn ${cls}">
          <div class="mo">${esc(sn.label)}</div>
          <div class="pl"><span class="n big">${sn.place||'–'}.</span></div>
          <div class="el ${eloCls}">${eloTxt}</div>
          <div class="rc">${sn.wins}–${sn.losses}</div>
        </div>`;
      }).join('')}
    </div>` : '';

  // Karriere-Rang als Hero-Card: prominenter Tier-Name + Ø Saison-Elo + Journey-Bar.
  // Die Tier-Farbvariablen (--pp-tier-1/2/glow) werden vom Parent-Element (pp-sec.{tier})
  // vererbt — daher färben sich Icon, Label, Glow, Strahl automatisch nach Tier.
  const _activeIdxRaw = rInfo ? RANKS.findIndex(rank => rank.label === rInfo.label) : -1;
  const _activeIdx = _activeIdxRaw >= 0 ? (RANKS.length - 1 - _activeIdxRaw) : -1;
  const _ranksReversed = RANKS.slice().reverse();
  const _journeyTier = rInfo
    ? ('pp-tier-'+rInfo.label.toLowerCase().replace('ä','a').replace('ö','o').replace('ü','u'))
    : '';
  const _fillPct = _activeIdx >= 0 ? _activeIdx * 25 : 0;
  const _tierIcon = rInfo && rInfo.icon ? ICONS[rInfo.icon] : ICONS.chartBar;

const rankProgHtml = rInfo ? `
  <div class="pp-rank-card ${_journeyTier}" id="ppRanksBtn" style="cursor:pointer">
    <div class="pp-rank-hero">
      <div class="pp-rank-tier-block">
        <div class="pp-rank-icon">
          <svg viewBox="0 0 24 24">${_tierIcon||''}</svg>
        </div>
        <div class="pp-rank-tier-text">
          <div class="pp-rank-label">${esc(rInfo.label)}</div>
          <div class="pp-rank-sub">${percentileTxt||'—'}</div>
        </div>
      </div>
      <div class="pp-rank-elo-block">
        <div class="pp-rank-elo">${rInfo.avg}</div>
        <div class="pp-rank-elo-lbl">Ø Saison-Elo</div>
      </div>
    </div>
    <div class="pp-ranks-journey">
      <div class="pp-rj-track"></div>
      <div class="pp-rj-fill-track"><div class="pp-rj-fill" style="width:${_fillPct}%"></div></div>
      <div class="pp-rj-tiers">
        ${_ranksReversed.map((r, i) => {
          const state = _activeIdx < 0 ? '' : (i < _activeIdx ? 'done' : (i === _activeIdx ? 'active' : ''));
          return `<div class="pp-rj-tier ${state}">
            <div class="pp-rj-dot"></div>
            <div class="pp-rj-lbl">${esc(r.label)}</div>
          </div>`;
        }).join('')}
      </div>
    </div>
  </div>` : `
  <div class="pp-rank-card" id="ppRanksBtn" style="cursor:pointer">
    <div class="pp-rank-empty">Noch keine Saison-Daten</div>
  </div>`;

  // ── Das Farbgesetz [§C25] und die Stufe ──────────────────────────
  //     Die ganze Seite bekommt EINE Farbe — die des Rangs — und EIN
  //     Muster — das der Prestige-Stufe. Beides hängt am Wurzelelement,
  //     damit jede Karte darunter sich daran bedienen kann, statt ihre
  //     eigene Farbe mitzubringen.
  const _ton = rangTon(id);
  const _stufe = 'st-' + prestigeOf(id).insignie.key;

  openSheet(`
   <div class="pp-root ${_stufe}" style="--ak:${_ton.c};--ak-rgb:${_ton.rgb}">
    <header class="pp-header ${tierClass}">
      <button class="pp-edit-btn" id="ppEditBtn" title="Profil bearbeiten">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
      </button>
      ${(()=>{
        // Der Fingerabdruck [§13.11] als Wasserzeichen: dieselbe Form,
        // die im Laufbahn-Sheet groß und beschriftet steht, hier nur als
        // Silhouette hinter dem Kopf. Sie erklärt nichts — sie ist da.
        const _wz = fingerWasserzeichenSvg(id);
        return _wz ? `<div class="pp-fa-wz">${_wz}</div>` : '';
      })()}
      ${(()=>{
        // Status-Ring (§13.7): derselbe Ring wie in der Rangliste, nur groß.
        // Er legt sich als zweiter Kreis um den Tier-Ring, statt ihn zu
        // ersetzen — Rang und Zustand sind zwei verschiedene Aussagen.
        // Der Serienring war grün, die Flamme ist rangfarben, die Chip-Zeile
        // sagt dieselbe Zahl noch einmal: dreimal dieselbe Nachricht in zwei
        // Farben. Wo die Flamme brennt, entfällt der Ring — sie IST der Ring.
        const _rRoh = avRingOf(id);
        const _r = (_rRoh && (_rRoh.kind === 'blaze' || _rRoh.kind === 'hot')) ? null : _rRoh;
        const _rt = _r ? titleTone(_r.tone) : null;
        // Das Insignium [§13.9] liegt HINTER dem Avatar: Stufe als Form,
        // Rang als Material, Meistertitel als Schwinge. Die Liga-Position
        // steht im Schild — die alte Ecken-Zahl und die Legenden-Krone
        // sind damit doppelt und fallen weg.
        // Die Siegesserie brennt auch hier [§C26] — aber in der Rangfarbe
        // und ganz hinten, hinter dem Insignium. Sie soll die Seite wärmen,
        // nicht mit ihr streiten.
        const _fu = znFeuer(id);
        return `<div class="pp-av-wrap${_r ? ' has-ring' : ''}${_fu ? ' zn-rang zn-l'+_fu : ''}"${_rt ? ` style="--tt:${_rt.c};--ttr:${_rt.rgb}"` : ''}
          data-prestige="${esc(id)}" title="${esc(prestigeOf(id).insignie.name + ' · ' + prestigeOf(id).punkte + ' Prestige')}">
        ${_fu ? ZN_FEUER_GROSS[_fu] : ''}
        ${insigniumSvg(id)}
        <div class="pp-av-ring">
          <div class="${avClass}" ${avBg}>${avInner}</div>
        </div>
        ${_r ? `<span class="pp-av-mark">${svgI(_r.ic)}</span>` : ''}
      </div>`;
      })()}
      <h1 class="pp-name">${esc(p.name)}${streakBadge?` ${streakBadge}`:''}</h1>
      ${_titlePillHtml(id)}
      ${_avRingChipHtml(id)}

      <div class="pp-pills">
        ${rInfo?`<span class="pp-pill tier">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[rInfo.icon]||''}</svg>
          ${esc(rInfo.label)}
        </span>`:''}
        <span class="pp-pill">${posIcon}${esc(posLabel)}</span>
      </div>

      ${(()=>{
        // ── SIGNATURE: Peak-Elo-Trinity ──
        // Drei zusammenhängende Werte: Aktuell (acid) | Peak Saison | Peak Allzeit (tier-getönt)
        const games=gSim.playedSeason[id]||0;
        const curElo = games>0 ? Math.round(gSim.elo[id]) : '—';
        const ps = peakSeason !== null ? peakSeason : '—';
        const pa = peakAlltime !== null ? peakAlltime : '—';
        const paSub = peakAlltimeSeason ? esc(peakAlltimeSeason) : 'saison-übergreifend';
        return `<div class="pp-elo-trinity">
          <div class="pp-et-col now">
            <div class="label">Aktuell</div>
            <div class="val">${curElo}</div>
            <div class="sub">Saison</div>
          </div>
          <div class="pp-et-col peak">
            <div class="label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS['peak']||''}</svg> Peak</div>
            <div class="val">${ps}</div>
            <div class="sub">diese Saison</div>
          </div>
          <div class="pp-et-col alltime">
            <div class="label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS['star']||''}</svg> Allzeit</div>
            <div class="val">${pa}</div>
            <div class="sub">${paSub}</div>
          </div>
        </div>`;
      })()}

      ${(sparkHtml || formHtml) ? `<div class="pp-spark-row">
        ${sparkHtml}
        ${formHtml?`<div class="pp-form">${formHtml}</div>`:''}
      </div>` : ''}
    </header>

    ${(()=>{
      // Chronik (§13): Saisontitel als Streifen, direkt unter dem Kopf — sie
      // beschreibt, WER jemand ist, und gehört damit vor die Detail-Statistik.
      const strip = _chronStripHtml(id);
      return strip ? `<div class="pp-sec" style="animation-delay:.28s">${strip}</div>` : '';
    })()}

    <div class="pp-sec" style="animation-delay:.3s">
      ${(()=>{
        // Rollen-Performance: zwei Donut-Diagramme (orange = Sturm, blau = Abwehr).
        // Ring zeigt die Win-Rate visuell, Zahl in der Mitte konkret. Subtext zeigt
        // Tor/Gegentor-Schnitt — passt zu den Awards Torjäger / Eiserne Abwehr
        // und zum Positionen-Tab. Werte kommen aus playerStats: s.atkGoals und
        // s.defConceded (positions-spezifisch akkumuliert).
        const tot = s.atkG + s.defG;
        if(tot === 0){
          return `<div class="pp-pos-combined">
            <div class="head"><div class="t">Rollen-Performance</div></div>
            <div class="pp-roles-empty">Keine Spiele</div>
          </div>`;
        }
        const donut = (cls, lbl, icon, wr, w, g, valLbl, valNum, color) => {
          if(g === 0) return `
            <div class="pp-rd ${cls}">
              <div class="pp-rd-ring" style="background:var(--surface3)">
                <div class="pp-rd-inner"><div class="pp-rd-wr" style="color:var(--muted)">–</div></div>
              </div>
              <div class="pp-rd-lbl"><span class="ic">${svgI(icon)}</span>${lbl}</div>
              <div class="pp-rd-empty">noch keine Spiele</div>
            </div>`;
          return `
            <div class="pp-rd ${cls}">
              <div class="pp-rd-ring" style="background:conic-gradient(${color} ${wr}%, var(--surface3) 0)">
                <div class="pp-rd-inner"><div class="pp-rd-wr">${wr}<small>%</small></div></div>
              </div>
              <div class="pp-rd-lbl"><span class="ic">${svgI(icon)}</span>${lbl}</div>
              <div class="pp-rd-meta"><b>${w}</b>/<b>${g}</b> Spiele<br>Ø <b>${valNum}</b> ${valLbl}</div>
            </div>`;
        };
        const atkAvg = s.atkG ? (s.atkGoals/s.atkG).toFixed(1) : '–';
        const defAvg = s.defG ? (s.defConceded/s.defG).toFixed(1) : '–';
        return `<div class="pp-pos-combined">
          <div class="head"><div class="t">Rollen-Performance</div></div>
          <div class="pp-roles-donuts">
            ${donut('atk','Sturm','bolt',atkWr,s.atkW,s.atkG,'Tore/Sp.',atkAvg,'var(--orange)')}
            ${donut('def','Abwehr','shield',defWr,s.defW,s.defG,'Gegentore/Sp.',defAvg,'var(--blue)')}
          </div>
        </div>`;
      })()}
    </div>

    <div class="pp-sec" style="animation-delay:.35s">
      <div class="pp-sec-title">
        <div class="l"><span class="ic svg-ic">${svgI('chartBar')}</span><h4>Gesamt-Stats</h4></div>
        <div class="m">${s.games} Spiele</div>
      </div>
      <div class="pp-kpi">
        <div class="pp-k"><div class="v">${s.wins}</div><div class="l">Siege</div></div>
        <div class="pp-k f"><div class="v">${wr}%</div><div class="l">Siegrate</div></div>
        <div class="pp-k ${s.gd>=0?'pos':'neg'}"><div class="v">${s.gd>=0?'+':''}${s.gd}</div><div class="l">Tordiff</div></div>
      </div>
    </div>

    <div class="pp-sec" style="animation-delay:.4s">
      <div class="pp-sec-title">
        <div class="l"><span class="ic svg-ic">${svgI('flame')}</span><h4>Siegesserien</h4></div>
      </div>
      <div class="pp-streaks">
        <div class="pp-st">
          <div class="l">Aktuelle Serie</div>
          <div class="v ${streak===0?'empty':''}">${streak>0?streak+' Siege':streak<0?(-streak)+' Niederlagen':'–'}</div>
          ${_last15.length?`<div class="dots mixed">${last15DotsHtml}</div>`:''}
        </div>
        <div class="pp-st">
          <div class="l">Längste Serie</div>
          <div class="v ${longestStr<2?'empty':''}">${longestStr>=2?longestStr+' Siege':'–'}</div>
          ${longestStr>=2&&longestPeakLabel?`<div class="pp-st-sub">${esc(longestPeakLabel)}</div>`:''}
        </div>
      </div>
    </div>

    ${badgeTotal?(()=>{
      // ─── Auszeichnungen-Card (Variante 4): Strip seltenster Achievements + Tier-Bar ───
      // Strip: max 8 freigeschaltete Badges, sortiert nach Rarität (Legendary→Common),
      // innerhalb jeder Gruppe in BADGES-Reihenfolge. Mini-Icons bekommen Tier-Border.
      // Dünne Bar darunter zeigt segmentiert den Gesamt-Fortschritt nach Tier.
      const _STRIP_MAX = 8;
      const _byRarity = {legendary:[], rare:[], common:[], negative:[]};
      badges.forEach(b => { const r = rarityOf(b.id); if(_byRarity[r]) _byRarity[r].push(b); });
      const _strip = [];
      RARITY_ORDER.forEach(r => _byRarity[r].forEach(b => _strip.push({b, r})));
      const _visible = _strip.slice(0, _STRIP_MAX);
      const _rest = Math.max(0, _strip.length - _visible.length);
      const _stripHtml = _visible.map(({b,r}) => {
        const ic = ICONS[b.ic] ? `<svg viewBox="0 0 24 24">${ICONS[b.ic]}</svg>` : '';
        return `<div class="pp-bmini ${r}">${ic}</div>`;
      }).join('') + (_rest ? `<span class="pp-bcard-rest">+${_rest}</span>` : '');
      // Bar-Segmente: ein Stück pro Tier-Count, Rest dunkel
      const _seg = (r) => _byRarity[r].length;
      const _have = _seg('legendary')+_seg('rare')+_seg('common')+_seg('negative');
      const _missing = BADGES.length - _have;
      const _barHtml = `
        <div class="pp-bcard-bar">
          ${_seg('legendary')?`<div class="seg legendary" style="flex:${_seg('legendary')}"></div>`:''}
          ${_seg('rare')?`<div class="seg rare" style="flex:${_seg('rare')}"></div>`:''}
          ${_seg('common')?`<div class="seg common" style="flex:${_seg('common')}"></div>`:''}
          ${_seg('negative')?`<div class="seg negative" style="flex:${_seg('negative')}"></div>`:''}
          ${_missing?`<div class="seg" style="flex:${_missing};background:var(--surface3);opacity:.5"></div>`:''}
        </div>`;
      return `
    <div class="pp-sec" style="animation-delay:.425s">
      <div class="pp-sec-title">
        <div class="l">${svgI('star')}<h4>Auszeichnungen</h4></div>
        <div class="m">${_have} / ${BADGES.length}</div>
      </div>
      <div class="pp-bcard" id="ppBadgesBtn">
        <div class="pp-bcard-row">
          <div class="pp-bcard-strip">${_stripHtml}</div>
          <span class="pp-bcard-chev">
            <svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
          </span>
        </div>
        ${_barHtml}
      </div>
    </div>`;
    })():''}
    
    ${sa.length?`
    <div class="pp-sec" style="animation-delay:.435s">
      <div class="pp-sec-title">
        <div class="l">${svgI('trophy')}<h4>Liga Titel</h4></div>
        <div class="m">${(()=>{let n=0;sa.forEach(s=>{if(s.player_id===id)n++;if(s.team_p1===id||s.team_p2===id)n++;});return n;})()} Titel</div>
      </div>
      ${trophyHtml}
    </div>`:''}
    
    <div class="pp-sec" style="animation-delay:.45s">
      <div class="pp-sec-title">
        <div class="l"><span class="ic svg-ic">${svgI('users')}</span><h4>Beziehungen</h4></div>
      </div>
      <div class="pp-rel-grid">
  
        ${(()=>{
          // Hilfsfunktion: Mate-/Gegner-Avatar (34 px)
          const relAv=(pid)=>{
            const pp=pmap()[pid];
            if(!pp) return `<div class="av empty">?</div>`;
            const em=pp.avatar_id?avatarEmoji(pp.avatar_id):null;
            if(em) return `<div class="av" style="background:var(--surface3);color:inherit">${em}</div>`;
            return `<div class="av" style="background:${avColor(pid)}">${esc(initials(pp.name))}</div>`;
          };
          // Eine Karte mit Avatar links + Info rechts
          const card=(cls, attr, icKey, label, name, wr, w, g)=>{
            const empty = !name;
            return `<div class="pp-r-rich ${cls}"${attr}>
              ${empty?`<div class="av empty">–</div>`:relAv(name.id)}
              <div class="info">
                <div class="l">${svgI(icKey)}${label}</div>
                <div class="name">${empty?'–':esc(name.label)}</div>
                <div class="stat">${empty?'':`<span class="v">${Math.round(wr*100)}%</span> <span class="g">(${Math.round(wr*g)}/${g})</span>`}</div>
              </div>
            </div>`;
          };
          // Bester Mate
          const bestAttr  = best?` data-team="${esc([id,best.mid].sort().join('|'))}"`:'';
          const bestCard  = best
            ? card('good', bestAttr, 'handshake', 'Bester Mate', {id:best.mid,label:pname(best.mid)}, best.wr, Math.round(best.wr*best.g), best.g)
            : card('good', '', 'handshake', 'Bester Mate', null);
          // Schlechtester Mate (nur wenn ≠ Bester)
          const worstAttr = worst&&best&&worst.mid!==best.mid?` data-team="${esc([id,worst.mid].sort().join('|'))}"`:'';
          const worstCard = worst&&best&&worst.mid!==best.mid
            ? card('bad', worstAttr, 'chartDown', 'Schlecht. Mate', {id:worst.mid,label:pname(worst.mid)}, worst.wr, Math.round(worst.wr*worst.g), worst.g)
            : card('bad', '', 'chartDown', 'Schlecht. Mate', null);
          // Lieblingsgegner → klickbar zum Gegnerprofil
          const favAttr  = fav?` data-detail="${esc(fav.oid)}"`:'';
          const favCard  = fav
            ? card('fav', favAttr, 'target', 'Lieblingsgegner', {id:fav.oid,label:pname(fav.oid)}, fav.wr, Math.round(fav.wr*fav.g), fav.g)
            : card('fav', '', 'target', 'Lieblingsgegner', null);
          // Angstgegner (nur wenn ≠ Liebling)
          const nemAttr  = nem&&fav&&nem.oid!==fav.oid?` data-detail="${esc(nem.oid)}"`:'';
          const nemCard  = nem&&fav&&nem.oid!==fav.oid
            ? card('nem', nemAttr, 'crown', 'Angstgegner', {id:nem.oid,label:pname(nem.oid)}, nem.wr, Math.round(nem.wr*nem.g), nem.g)
            : card('nem', '', 'crown', 'Angstgegner', null);
          return bestCard + worstCard + favCard + nemCard;
        })()}
      </div>
    </div>

    ${(()=>{
      // ─── BILANZEN-CARD (kompakt): Strip aus Mitspieler-Avataren + Chevron ───
      // Komplette Card ist klickbar (id=ppH2HBtn → showPlayerH2HList). Die
      // Mini-Avatare zeigen die TOP-Mitspieler nach gemeinsamer Häufigkeit;
      // im Sheet erscheint die volle, scrollbare Liste mit T/G-Bilanz pro Zeile.
      const h2hList = playerH2HList(id, 3);
      if(h2hList.length < 2) return '';
      const pmL = pmap();
      // 5 Mini-Avatare im Strip; bei mehr Mitspielern zusätzlich "+N" Chip.
      const STRIP_MAX = 5;
      const stripItems = h2hList.slice(0, STRIP_MAX).map(x=>{
        const pp = pmL[x.oid]; if(!pp) return '';
        const em = pp.avatar_id ? avatarEmoji(pp.avatar_id) : null;
        if(em) return `<div style="width:26px;height:26px;border-radius:50%;background:var(--surface3);display:grid;place-items:center;font-size:14px;border:1.5px solid var(--surface);flex-shrink:0">${em}</div>`;
        return `<div style="width:26px;height:26px;border-radius:50%;background:${avColor(pp.id)};display:grid;place-items:center;font-size:9px;font-family:'Archivo Black',sans-serif;color:#0a0c0b;border:1.5px solid var(--surface);flex-shrink:0">${esc(initials(pp.name))}</div>`;
      }).join('');
      const overflow = h2hList.length > STRIP_MAX
        ? `<div style="height:26px;display:grid;place-items:center;padding:0 8px;border-radius:13px;background:var(--surface3);font-size:10px;font-weight:700;color:var(--ink2);font-family:'Sometype Mono',monospace;flex-shrink:0">+${h2hList.length-STRIP_MAX}</div>`
        : '';
      return `
    <div class="pp-sec" style="animation-delay:.5s">
      <div class="pp-badges-card" id="ppH2HBtn">
        <div class="pp-badges-strip" style="align-items:center">
          ${stripItems}${overflow}
        </div>
        <span class="chev">
          <svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>
        </span>
      </div>
    </div>`;
    })()}



    ${awardCount?`
    <div class="pp-sec" style="animation-delay:.65s">
      <div class="pp-sec-title">
        <div class="l">${svgI('medal')}<h4>Awards</h4></div>
        <div class="m">${awardCount} erreicht</div>
      </div>
      <div class="pp-awards" id="ppAwardsGrid">
        ${awCats.map(c=>`
          <div class="pp-aw ${c.n===0?'empty':''}">
            <span class="ic svg-ic">${svgI(c.ic)}</span>
            <div class="nm">${c.nm}</div>
            <div class="num">${c.n}</div>
          </div>`).join('')}
      </div>
    </div>`:''}

    ${seasonHistory.length?`
    <div class="pp-sec" style="animation-delay:.7s">
      <div class="pp-sec-title">
        <div class="l">${svgI('calendar')}<h4>Saisonverlauf <span style="color:var(--muted);font-weight:500;letter-spacing:.02em;text-transform:none">(letzte ${seasonHistory.length})</span></h4></div>
        <div class="m">${seasonTrend ? `<span class="trend ${seasonTrend.cls}">${seasonTrend.arrow} ${esc(seasonTrend.text)}</span>` : seasonHistory.length+' Saisons'}</div>
      </div>
      ${seasonRailHtml}
    </div>`:''}

    <div class="pp-sec ${tierClass}" style="animation-delay:.75s">
      <div class="pp-sec-title">
        <div class="l">${svgI('chartBar')}<h4>Karriere-Rang</h4></div>
      </div>
      ${rankProgHtml}
    </div>

    <div class="pp-sec" style="animation-delay:.8s">
      <div class="pp-sec-title">
        <div class="l">${svgI('target')}<h4>Positions-Profil</h4></div>
        <div class="m">${posLabel}</div>
      </div>
      <div class="pp-posprof ${_posCls.tone==='def'?'def-seite':''}" style="--atk:${atkPct}%">
        <div class="pph">
          <span class="lf">${svgI('bolt')}Sturm</span>
          <span><span class="pct">${atkPct}%</span> / <span class="pct">${defPct}%</span></span>
          <span class="rt">Abwehr${svgI('shield')}</span>
        </div>
        <div class="pp-slider">
          <div class="pp-fill" style="width:${atkPct}%"></div>
          <span class="pp-thumb" style="left:${atkPct}%"></span>
        </div>
        <div class="ppf">Eingestuft als <span class="lab" style="display:inline-flex;align-items:center;gap:4px">${posIcon}${posLabel}</span></div>
      </div>
    </div>

    <div class="pp-del">
      <button id="delPlayer">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/>
        </svg>
        Spieler löschen
      </button>
    </div>
   </div>
  `);

  // Click-Handler
  const eb=document.getElementById('ppEditBtn');
  if(eb) eb.onclick=()=>{ sheetNav(()=>showEditPlayer(id)); };
  const ag=document.getElementById('ppAwardsGrid');
  if(ag) ag.onclick=()=>{ sheetNav(()=>showPlayerAwards(id,awards)); };
  const bb=document.getElementById('ppBadgesBtn');
  if(bb) bb.onclick=()=>{ sheetNav(()=>showPlayerBadges(id)); };
  const h2hb=document.getElementById('ppH2HBtn');
  if(h2hb) h2hb.onclick=()=>{ sheetNav(()=>showPlayerH2HList(id)); };
  const sr=document.getElementById('ppSeasonsRail');
  if(sr) sr.onclick=()=>{ sheetNav(()=>showPlayerSeasons(id)); };
  const rk=document.getElementById('ppRanksBtn');
  if(rk) rk.onclick=()=>{ sheetNav(()=>showRangSystem()); };
  const tp=document.getElementById('ppTrPlayer');
  if(tp) tp.onclick=()=>{ sheetNav(()=>showPlayerSeasons(id)); };
  const tt=document.getElementById('ppTrTeam');
  if(tt) tt.onclick=()=>{ sheetNav(()=>showPlayerSeasons(id)); };
  document.querySelectorAll('.pp-trophies .pp-tr').forEach(el=>{
    el.onclick=()=>{ sheetNav(()=>showPlayerSeasons(id)); };
  });
  // Mate-Karten öffnen das Team-Profil (Spieler + Mate)
  document.querySelectorAll('[data-team]').forEach(el=>{
    el.onclick=()=>{
      const [a,b]=el.dataset.team.split('|');
      if(!a||!b) return;
      sheetNav(()=>showTeam(a,b));
    };
  });
  // Bilanzen-Zeilen öffnen das H2H-Sheet (Reihenfolge bewahren — Profil-Spieler zuerst)
  document.querySelectorAll('[data-h2h]').forEach(el=>{
    el.onclick=()=>{
      const [a,b]=el.dataset.h2h.split('|');
      if(!a||!b) return;
      sheetNav(()=>showH2H(a,b));
    };
  });
  // Lieblings-/Angstgegner-Karten öffnen das Gegner-Profil
  document.querySelectorAll('.pp-r-rich[data-detail]').forEach(el=>{
    el.onclick=()=>{
      const oid=el.dataset.detail;
      if(!oid) return;
      sheetNav(()=>showPlayer(oid));
    };
  });
  // Chronik-Zellen öffnen die Saison-Tafel (§13)
  _bindChronikClicks(document.getElementById('sheet'));

  // Delete-Handler – identisch zur Original-Logik
  const dp=document.getElementById('delPlayer');
  if(dp) dp.onclick=async()=>{
    const inMatches=matches.some(m=>[m.a1,m.a2,m.b1,m.b2].includes(id));
    if(inMatches){
      _pushCurrentSheet(); // Spielerprofil stapeln → „Zurück" möglich
      openSheet(`
        <h3>Spieler entfernen</h3>
        <div class="sheet-sub">${esc(p.name)} · ${gamesPlayed(id)} Matches</div>
        <div style="margin-top:20px;display:flex;flex-direction:column;gap:10px">
          <button class="btn ghost" id="hidePlayerBtn" style="text-align:left;padding:16px">
            <div style="font-weight:700">Aus Rangliste ausblenden</div>
            <div style="font-size:11px;color:var(--muted);margin-top:4px;font-weight:400">
              Spieler verschwindet aus der Rangliste.<br>
              Matches, Awards & Badges bleiben vollständig erhalten.
            </div>
          </button>
          <button class="btn ghost" id="deletePlayerBtn" style="text-align:left;padding:16px;color:var(--red);border-color:rgba(240,86,106,.3)">
            <div style="font-weight:700">Komplett löschen</div>
            <div style="font-size:11px;color:var(--muted);margin-top:4px;font-weight:400">
              Spieler wird gelöscht. Matches bleiben aber<br>
              Namen erscheinen als "?" in der Historie.
            </div>
          </button>
          <button class="btn ghost sm" id="cancelDelBtn">Abbrechen</button>
        </div>
      `);
      document.getElementById('hidePlayerBtn').onclick=async()=>{
        await sb.from('players').update({hidden:true}).eq('id',id);
        closeSheet(true); toast(esc(p.name)+' ausgeblendet'); await loadAll();
      };
      document.getElementById('deletePlayerBtn').onclick=async()=>{
        if(!confirm('Wirklich komplett löschen? Namen erscheinen dann als "?" in allen Matches.')) return;
        await sb.from('players').delete().eq('id',id);
        closeSheet(true); toast('Gelöscht'); await loadAll();
      };
      document.getElementById('cancelDelBtn').onclick=()=>{
        closeSheet(); // zurück zum Spielerprofil (Stack-Pop)
      };
    } else {
      if(!confirm(`Spieler "${p.name}" löschen?`)) return;
      await sb.from('players').delete().eq('id',id);
      closeSheet(true); toast('Gelöscht'); await loadAll();
    }
  };
}

// ─── Spieler bearbeiten: Spitzname + Avatar wählen ───
function showEditPlayer(id){
  const p=pmap()[id]; if(!p) return;
  _sheetSetReopen(()=>showEditPlayer(id));
  let selectedAvatar = p.avatar_id || null;

  const avPickerHtml = `
    <div class="av-picker" id="avPicker">
      <div class="av-opt initials ${!selectedAvatar?'selected':''}" data-av="">
        <span class="em">${initials(p.name)}</span>
      </div>
      ${AVATAR_OPTIONS.map(o=>`
        <div class="av-opt ${selectedAvatar===o.id?'selected':''}" data-av="${o.id}">
          <span class="em">${o.em}</span>
        </div>`).join('')}
    </div>`;

  openSheet(`
    <h3>Profil bearbeiten</h3>
    <div class="sheet-sub">${esc(p.name)}</div>

    <div class="field-label">Profilbild</div>
    ${avPickerHtml}

    <div class="btn-row" style="margin-top:20px">
      <button class="btn ghost" id="editCancel">Abbrechen</button>
      <button class="btn" id="editSave">Speichern</button>
    </div>
  `);

  const picker = document.getElementById('avPicker');
  if(picker){
    picker.querySelectorAll('.av-opt').forEach(el=>{
      el.onclick=()=>{
        picker.querySelectorAll('.av-opt').forEach(x=>x.classList.remove('selected'));
        el.classList.add('selected');
        selectedAvatar = el.dataset.av || null;
      };
    });
  }

  document.getElementById('editCancel').onclick=()=>{
    closeSheet(); // zurück zum Spielerprofil (Stack-Pop)
  };

  document.getElementById('editSave').onclick=async()=>{
    const updates = { avatar_id: selectedAvatar || null };
    // Lokales Update sofort
    p.avatar_id = updates.avatar_id;
    // DB-Update versuchen
    const {error} = await sb.from('players').update(updates).eq('id',id);
    if(error){
      // Spalte existiert evtl. nicht in DB – lokaler Fallback via localStorage
      console.warn('DB-Update fehlgeschlagen, localStorage-Fallback:', error.message);
      try{
        localStorage.setItem('playerEdit_'+id, JSON.stringify(updates));
        toast('Gespeichert (lokal)','ok');
      }catch(e){
        toast('Lokal gespeichert');
      }
    } else {
      toast('Gespeichert','ok');
    }
    closeSheet(); // zurück zum Spielerprofil (Stack-Pop, zeigt aktualisiertes Avatar)
  };
}

// ─── Saison-Verlauf berechnen (letzte N) ───
function computeSeasonHistory(playerId, limit){
  // v9.16: Reihenfolge EXPLIZIT statt implizit. Vorher wurde auf die
  // aufsteigende Reihenfolge von allPastSeasons() vertraut, per slice(-limit)
  // gekürzt und am Ende reverse()'t — kam die ID-Liste je Gerät/Cache-Zustand
  // in anderer Reihenfolge, stand im Rail plötzlich Juli, Mai, Juni. Jetzt wird
  // absteigend nach Saison-ID (YYYY-MM, lexikografisch = chronologisch)
  // sortiert und danach gekürzt → links immer die neueste, rechts die älteste.
  const allSeasonIds = [...new Set([...allPastSeasons(), currentSeason().id])]
    .sort((a,b)=> a<b?1:a>b?-1:0);
  const last = allSeasonIds.slice(0, limit);
  return last.map(sid=>{
    const sMatches = matchesInSeason(sid).filter(m=>[m.a1,m.a2,m.b1,m.b2].includes(playerId));
    if(!sMatches.length) return null;
    let w=0, l=0;
    sMatches.forEach(m=>{
      const onA=(playerId===m.a1||playerId===m.a2);
      const won=(onA&&m.winner==='A')||(!onA&&m.winner==='B');
      if(won) w++; else l++;
    });
    const gSim = getGlobalSim();
    const snapshot = gSim.seasonEndElos[sid] || {};
    const seasonPlayedMap = gSim.seasonPlayed[sid] || {};
    const startElo = cfg.start_elo;
    const endElo = snapshot[playerId] ?? startElo;
    const eloDelta = Math.round(endElo - startElo);
    const playersInSeason = players.filter(pp=>!pp.hidden);
    const seasonRanking = playersInSeason.map(pp=>({
      id:pp.id, e: (snapshot[pp.id] ?? startElo), g: (seasonPlayedMap[pp.id]||0)
    })).filter(x=>x.g>0).sort((a,b)=>b.e-a.e);
    const place = seasonRanking.findIndex(x=>x.id===playerId)+1;
    return {
      id:sid, label:seasonLabel(sid),
      wins:w, losses:l, eloDelta,
      place: place>0?place:null,
    };
  }).filter(Boolean); // bereits absteigend sortiert (neueste zuerst)
}

// Awards-Sheet für einen Spieler: listet alle gehaltenen Awards auf, jeweils anklickbar
function showRangSystem(){
  _sheetSetReopen(()=>showRangSystem());
  const avgs=getSeasonAvgElos();
  const ranked=players.filter(p=>!p.hidden&&avgs[p.id]!==null)
    .sort((a,b)=>avgs[b.id]-avgs[a.id]);
  const rows=RANKS.map((r,i)=>{
    const prev=RANKS[i-1];
    const fromPct=prev?Math.round(prev.pct*100):0;
    const toPct=Math.round(r.pct*100);
    const label=i===0?'Top '+toPct+'%':fromPct+'% – '+toPct+'%';
    const inRank=ranked.filter((_,idx)=>{
      const pct=(idx+1)/ranked.length;
      const prevR=RANKS[i-1];
      return pct<=(r.pct+0.001)&&(!prevR||pct>(prevR.pct+0.001));
    });
    return `<div style="background:var(--surface);border:1px solid var(--line);
      border-radius:var(--r-sm);padding:10px 12px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${inRank.length?'8px':'0'}">
        <span style="font-weight:700;color:${r.color};display:inline-flex;align-items:center;gap:6px">
          <span class="ic svg-ic" style="font-size:14px;color:${r.color}"><svg viewBox="0 0 24 24">${ICONS[r.icon]||''}</svg></span>${r.label}
        </span>
        <span style="font-size:11px;color:var(--muted)">${label} der Spieler</span>
      </div>
      ${inRank.length?`<div style="display:flex;flex-direction:column;gap:4px">
        ${inRank.map(p=>`<div style="display:flex;justify-content:space-between;
          align-items:center;font-size:12px;padding:4px 0;border-top:1px solid var(--line)">
          <div style="display:flex;align-items:center;gap:8px">
            ${avHtml(p,'width:24px;height:24px;border-radius:7px;font-size:9px')}
            <span>${esc(p.name)}</span>
          </div>
          <span style="font-family:'Sometype Mono',monospace;font-size:11px;color:${r.color}">
            Ø ${avgs[p.id]}
          </span>
        </div>`).join('')}
      </div>`:''}    </div>`;
  }).join('');
  openSheet(`
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
      <span class="emoji svg-ic" style="width:48px;height:48px;border-radius:14px;display:grid;place-items:center;background:var(--surface2);color:var(--ink2)"><svg viewBox="0 0 24 24" style="width:24px;height:24px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round">${ICONS['crown']||''}</svg></span>
      <div><h3>Rang-System</h3><div class="sheet-sub">Basiert auf Ø Saison-Elo</div></div>
    </div>
    ${rows}
  `);
}
function showPlayerAwards(playerId, awards){
  const p=pmap()[playerId]; if(!p)return;
  _sheetSetReopen(()=>showPlayerAwards(playerId, awards));
  // Mapping wie in vAwards/AW_IC für konsistente Icons
  // ⚑ HOTSPOT — Spiegel von AW_IC aus §5.3 (vAwards). Bei neuen Awards HIER
  //  und in den anderen 2 AW_IC-Definitionen gleichzeitig erweitern.
  const AW_IC = {
    wins:'trophyStar',     onFire:'flame',       perfect:'star',          streaks:'flameTriple',
    showmaster:'award',    mvt:'handshake',      bestDuo:'duo',           scorer:'ball',
    wall:'shieldCheck',    ice:'snowflake',      endgegner:'skull',       clutch:'target',
    carryKing:'weight',    solo:'lonewolf',      upset:'surprise',        biggest:'explosion',
    grinder:'gamepad',     worstWr:'ghost',      coldStreak:'iceCube',    lossStreaks:'trendCrash',
    formtief:'meltDown',   worstAtk:'blockedShot',worstDef:'hole',        worstTeam:'brokenHeart',
    zirkus:'circus',       baustelle:'cone',     peakElo:'peak',
    weekKing:'weekKing',   dayKing:'dayKing',
    plusMinus:'plusMinus', underdog:'underdog',  pechvogel:'rainCloud',
    // ── NEUE TEAM-AWARDS v4 ──
    unstoppable:'unstoppable', concreteWall:'concreteWall', luckyCharm:'clover',
    giantSlayer:'giantSlayer', favoritenschreck:'devilMask', rivalry:'crossedSwords',
    // ── NEUE NEGATIV-AWARDS v6 ──
    cheesePlatter:'cheese', favoriteLoser:'crownFallen'
  };
  const ic = key => `<svg viewBox="0 0 24 24">${ICONS[AW_IC[key]||'trophy']||''}</svg>`;

  // Award-Trophäe für das Sheet: gleiche Optik wie im Awards-Tab.
  // Plakette: bei Team-Awards zeigen wir den Partner-NAMEN als reinen Text
  // (kein Profilbild) — konsistent zum Wunsch des Users und sauber für den
  // 4-Spieler-Award "Erzfeinde" (a.partnerLabel statt a.partner).
  const trophy = (a) => {
    const m = AWARD_META[a.key]; if(!m) return '';
    const valDisplay = a.val ? esc(a.val) : '#1';
    let plaqueContent;
    if(a.partnerLabel){
      // Rivalry / 4-Spieler: keine Partner-Plaque, sondern Beschriftung "vs X & Y"
      plaqueContent = `<span class="aw-trophy-plaque-name" style="font-size:10px">${esc(a.partnerLabel)}</span>`;
    } else if(a.partner){
      // Team-Award (2 Spieler): Partner-Name ohne Avatar/Initial-Bubble
      plaqueContent = `<span class="aw-trophy-plaque-name" style="font-size:10.5px">mit ${esc(pname(a.partner))}</span>`;
    } else {
      plaqueContent = `<span class="aw-trophy-plaque-name" style="color:var(--muted);font-size:9.5px;letter-spacing:.1em;text-transform:uppercase">Top-1</span>`;
    }
    return `<div class="aw-trophy ${m.cls}" data-paward2="${esc(a.key)}">
      <div class="aw-trophy-cup">${ic(a.key)}</div>
      <div class="aw-trophy-lbl">${esc(m.title)}</div>
      <div class="aw-trophy-val">${valDisplay}</div>
      <div class="aw-trophy-plaque">${plaqueContent}</div>
    </div>`;
  };

  const body = awards.length
    ? `<div class="aw-vitrine" style="margin-top:16px">${awards.map(trophy).join('')}</div>`
    : `<div class="empty" style="margin-top:24px;text-align:center;color:var(--muted)">
        <div class="ee svg-ic" style="color:var(--faint);margin-bottom:6px">${svgI('trophy')}</div>
        Noch keine Top-1-Auszeichnungen
       </div>`;

  openSheet(`
    <div style="display:flex;align-items:center;gap:14px">
      ${avHtml(p,"width:48px;height:48px;border-radius:14px;font-size:18px")}
      <div>
        <h3>Awards</h3>
        <div class="sheet-sub">${esc(p.name)} · ${awards.length} Top-1-Auszeichnung${awards.length===1?'':'en'}</div>
      </div>
    </div>
    ${body}
    <button class="btn ghost sm" id="backToPlayer" style="margin-top:14px;width:100%">← Zurück zum Profil</button>
  `);
  document.querySelectorAll('[data-paward2]').forEach(el=>el.onclick=()=>{
    sheetNav(()=>showAward(el.dataset.paward2));
  });
  const back=document.getElementById('backToPlayer');
  if(back) back.onclick=()=>closeSheet();
}

// Badges-Sheet: zeigt alle Badges (freigeschaltet vs. gesperrt)
function showPlayerBadges(playerId){
  const p = pmap()[playerId]; if(!p) return;
  _sheetSetReopen(()=>showPlayerBadges(playerId));
  const earned = getCachedBadges(playerId);
  const earnedIds = new Map(earned.map(b => [b.id, b.count]));
  // ONCE_ONLY: Badges, die man nur einmal erreicht (keine Wiederholung als ×N)
  // — werden in der Sortierung VOR den mehrfach-erreichbaren angezeigt.
  const ONCE_ONLY = new Set(['first_match','games25','games150','games250','wins200','allrounder','def50','atk50',
    'allwetter']);

  // ─── Aggregation pro Tier ───
  // Pro Rarity: BADGES-Array in Reihenfolge durchgehen, in Buckets sortieren.
  // Innerhalb des Buckets: ZUERST einmalig erreichbare ("Freigeschaltet"-Style),
  // DANACH mehrfach erreichbare (×N-Counter) — sortiert nur die ANZEIGE, keine
  // neue Kategorie. Stabil: relative Reihenfolge im BADGES-Array bleibt erhalten.
  const buckets = {legendary:[], rare:[], common:[], negative:[]};
  BADGES.forEach(b => {
    const r = rarityOf(b.id);
    if(buckets[r]) buckets[r].push(b);
  });
  Object.keys(buckets).forEach(r => {
    buckets[r].sort((a,b) => {
      const aOnce = ONCE_ONLY.has(a.id) ? 0 : 1;
      const bOnce = ONCE_ONLY.has(b.id) ? 0 : 1;
      return aOnce - bOnce; // stabile Sort: nur Once-vs-Multi neu ordnen
    });
  });
  const have = (r) => buckets[r].filter(b => earnedIds.has(b.id)).length;
  const haveTotal = have('legendary')+have('rare')+have('common')+have('negative');
  const trigCount = earned.reduce((s,b)=>s+b.count,0);

  // ─── Tier-Counter-Bar (oben im Sheet) ───
  const pill = (r) => {
    const meta = RARITY_META[r];
    const h = have(r);
    const dim = h===0 ? 'dim' : '';
    return `<span class="tc-pill ${r} ${dim}"><span class="dot"></span><span class="n">${h} / ${meta.total}</span></span>`;
  };
  const counterHtml = `
    <div class="bsh-counter">
      ${pill('legendary')}
      ${pill('rare')}
      ${pill('common')}
      <span class="tc-sep"></span>
      ${pill('negative')}
    </div>`;

  // ─── Card-Renderer (eine Badge → eine Card) ───
  const renderCard = (b, r) => {
    const cnt = earnedIds.get(b.id) || 0;
    const unlocked = cnt > 0;
    const isRepeatable = !ONCE_ONLY.has(b.id);
    if(!unlocked){
      // Locked: neutral grau, Lock-Icon zentral, winziger Tier-Dot oben links
      return `<div class="bsh-card locked ${r}" data-bid="${esc(b.id)}">
        <span class="tier-dot"></span>
        <div class="bsh-card-ic">${svgI('lock')}</div>
        <div class="bsh-card-name">${esc(b.name)}</div>
        <div class="bsh-card-desc">${esc(b.desc)}</div>
      </div>`;
    }
    // Unlocked: Tier-Farbe + Akzent-Strich oben (per CSS)
    const meta = isRepeatable
      ? `<div class="bsh-card-count">×${cnt}</div>`
      : `<div class="bsh-card-once">Freigeschaltet</div>`;
    return `<div class="bsh-card unlocked ${r}" data-bid="${esc(b.id)}">
      <div class="bsh-card-ic">${badgeIc(b,'30px')}</div>
      <div class="bsh-card-name">${esc(b.name)}</div>
      <div class="bsh-card-desc">${esc(b.desc)}</div>
      ${meta}
    </div>`;
  };

  // Positive Tiers (Legendary → Rare → Common) zusammengefasst in einem Grid
  const positiveCards = ['legendary','rare','common']
    .flatMap(r => buckets[r].map(b => renderCard(b, r)))
    .join('');

  // Negative-Block separat mit Schande-Trennlinie
  const negativeCards = buckets.negative.map(b => renderCard(b, 'negative')).join('');
  const negativeBlock = negativeCards ? `
    <div class="bsh-neg-divider">
      <div class="bsh-neg-divider-line"></div>
      <div class="bsh-neg-divider-label"><span class="dot"></span>Schande</div>
      <div class="bsh-neg-divider-line"></div>
    </div>
    <div class="bsh-grid">${negativeCards}</div>` : '';

  openSheet(`
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
      ${avHtml(p,"width:48px;height:48px;border-radius:14px;font-size:18px")}
      <div>
        <h3>Auszeichnungen</h3>
        <div class="sheet-sub">${esc(p.name)} · <b style="color:var(--acid)">${haveTotal}</b> von ${BADGES.length} · ${trigCount}× ausgelöst</div>
      </div>
    </div>
    ${counterHtml}
    <div class="bsh-grid">${positiveCards}</div>
    ${negativeBlock}
    <button class="btn ghost sm" id="backToPlayer2" style="margin-top:18px">← Zurück zum Profil</button>
  `);
  const back = document.getElementById('backToPlayer2');
  if(back) back.onclick = () => closeSheet();
  // Badge-Card-Click → öffnet Detail-Popover ÜBER dem Sheet (Sheet bleibt offen!)
  document.querySelectorAll('.bsh-card[data-bid]').forEach(el => {
    el.onclick = () => showBadgePopover(el.dataset.bid, playerId);
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// BADGE-DETAIL-POPOVER
// ═══════════════════════════════════════════════════════════════════════════
// Layer ÜBER dem Auszeichnungen-Sheet (z-index 120+ > Sheet 100/101).
// Zwei Modi:
//   • Erreicht  → zeigt die Matches, in denen das Badge ausgelöst wurde
//                 (aus getBadgeEarnedCache). Jeder Match-Eintrag ist klickbar:
//                 schließt Popover UND Sheet, öffnet das Match-Detail.
//   • Locked    → zeigt Fortschritt für die wichtigsten quantifizierbaren
//                 Badges (Spiele, Streaks, Elo-Schwellen, Positions-Spiele).
//                 Für saison-/karriere-aggregierte Badges (POTD, POTW,
//                 award_collector, untouchable etc.) gibt's einen knappen
//                 "Noch nicht erreicht"-Hinweis statt Balken.
//
// Schließen: Backdrop-Click, ✕ Button, ESC. KEIN closeSheet — das darunter
// liegende Auszeichnungen-Sheet bleibt scrollbar und sucht-fähig.
// ═══════════════════════════════════════════════════════════════════════════

// Helper: Matches, in denen das Badge für DIESEN Spieler gefeuert wurde.
// Nutzt den globalen Badge-Earned-Cache (chronologischer Walk in §7.4).
// Für saison-/karriere-aggregierte Badges (kein fire-Trigger) ist die Liste
// leer — wir zeigen dann den count ohne Match-Liste.
function _badgeFireMatches(playerId, badgeId){
  const map = getBadgeEarnedCache();
  const hits = [];
  for(const mid in map){
    if(map[mid].some(e => e.playerId === playerId && e.badge.id === badgeId)){
      const mObj = matches.find(m => m.id === mid);
      if(mObj) hits.push(mObj);
    }
  }
  return hits.sort((a,b) => mts(b)-mts(a));
}

// Helper: Fortschritt für quantifizierbare Locked-Badges. Returnt
// {cur, tgt, label} oder null wenn kein einfacher Fortschritt definierbar ist.
function _badgeProgress(badgeId, playerId){
  const playerMs = matches.filter(m => matchOf(playerId, m));
  switch(badgeId){
    case 'first_match':
      return {cur: Math.min(playerMs.length, 1), tgt: 1, label: 'Spiele'};
    case 'games25':
      return {cur: Math.min(playerMs.length, 25), tgt: 25, label: 'Spiele'};
    case 'games150':
      return {cur: Math.min(playerMs.length, 150), tgt: 150, label: 'Spiele'};
    // v9.17: einsehbarer Zähler für die goldenen Langzeit-Auszeichnungen.
    // playerMs ist bereits „alle Matches dieses Spielers" (= countGames), die
    // Siege kommen aus derselben Menge (= countWins) — keine zweite Rechnung.
    case 'games250':
      return {cur: Math.min(playerMs.length, 300), tgt: 300, label: 'Spiele'};
    case 'wins200': {
      const w = playerMs.filter(m => won(playerId, m)).length;
      return {cur: Math.min(w, 300), tgt: 300, label: 'Siege'};
    }
    case 'def50': {
      const def = playerMs.filter(m => {
        const slot=m.a1===playerId?'a1':m.a2===playerId?'a2':m.b1===playerId?'b1':'b2';
        return m[slot+'_pos']==='def';
      }).length;
      return {cur: Math.min(def, 50), tgt: 50, label: 'Abwehr-Spiele'};
    }
    case 'atk50': {
      const atk = playerMs.filter(m => {
        const slot=m.a1===playerId?'a1':m.a2===playerId?'a2':m.b1===playerId?'b1':'b2';
        return m[slot+'_pos']==='atk';
      }).length;
      return {cur: Math.min(atk, 50), tgt: 50, label: 'Sturm-Spiele'};
    }
    case 'streak5':
    case 'streak10':
    case 'streak15':
    case 'streak20': {
      const best = longestPlayerStreak(playerId, matches);
      const tgts = {streak5:5, streak10:10, streak15:15, streak20:20};
      const tgt = tgts[badgeId];
      return {cur: Math.min(best, tgt), tgt, label: 'längste Serie'};
    }
    case 'climber_100':
    case 'dominator_400':
    case 'dynasty_600': {
      // v9.18: Die Marke ist jede Saison neu erreichbar — der Balken zeigt
      // deshalb den Höchststand der LAUFENDEN Saison, nicht den Allzeit-Peak.
      // start_elo abziehen, damit "0/100" intuitiv ist (nicht "1000/1100").
      let curPeak = 0;
      try {
        const sp = seasonPeakElos()[currentSeason().id] || {};
        if(sp[playerId] != null) curPeak = Math.round(sp[playerId] - cfg.start_elo);
      } catch(e){}
      const tgts = {climber_100:100, dominator_400:400, dynasty_600:600};
      const tgt = tgts[badgeId];
      return {cur: Math.max(0, Math.min(curPeak, tgt)), tgt, label: 'Saison-Elo über Start'};
    }
    case 'allrounder': {
      // 20 Siege als Sturm UND 20 als Abwehr — wir zeigen den kleineren Wert
      const stats = playerStats(playerId);
      const atkW = stats.atkW || 0, defW = stats.defW || 0;
      const cur = Math.min(atkW, defW, 20);
      return {cur, tgt: 20, label: 'min. Sturm- & Abwehr-Siege'};
    }
    case 'mr_disaster': {
      // Aktuelle Saison: wie viele 0:10-Niederlagen hat der Spieler bereits?
      // Spiegel zu mr_perfect-Fortschritt (würde gleich aussehen).
      const sid = currentSeason().id;
      const seasonMs = matchesInSeason(sid);
      const disasters = seasonMs.filter(m => matchOf(playerId,m) && !won(playerId,m)
        && goalsFor(playerId,m)===0 && goalsAgainst(playerId,m)===10).length;
      return {cur: Math.min(disasters, 3), tgt: 3, label: '0:10 in aktueller Saison'};
    }
    // nemesis: siehe _badgeStreakState — dort als „Aktueller Lauf" (locked + unlocked).
  }
  return null;
}

// Aktueller (laufender) Zähler für Kontext-/Serien-Badges, der sich je nach
// Spielverlauf wieder zurücksetzt (z. B. „Zittersiege in Folge"). Anders als
// _badgeProgress (kumulativer Rekord/Bestwert) zeigt das den LEBENDEN Stand
// bis zum letzten Match — also wie nah der Spieler an der nächsten Auslösung ist.
// Reused die Loop-Logik der jeweiligen count*-Funktion, gibt aber den End-Wert
// des laufenden Zählers zurück statt der Anzahl der Auslösungen.
// Läuft nur beim Öffnen des Badge-Popovers (Klick) → keine Render-Hotpath-Kosten.
// Rückgabe: {cur, tgt, label, hint} · für Wochentag-Badges {weekdays:Set, tgt,
// label, kind:'weekday'} · sonst null (Badge hat keinen resettbaren Zähler).
function _badgeStreakState(badgeId, playerId){
  if(badgeId === 'award_collector'){
    // Reset pro Saison: laufender Stand der AKTUELLEN Saison (5 Tagessiege UND
    // 2 Wochensiege nötig). Wiederverwendung von countDayWins/countPeriodWins auf
    // den (bereits gecachten) Saison-Matches — beide schließen den laufenden Tag
    // bzw. die laufende Woche aus, zählen also nur abgeschlossene Perioden.
    const sid = currentSeason().id;
    const key = 'awColl_'+playerId+'_'+sid+'_'+matches.length+'_'+_cache.version;
    if(!_cache._awColl) _cache._awColl = {};
    let res = _cache._awColl[key];
    if(!res){
      const seasonMs = matchesInSeason(sid);
      res = { potd: countDayWins(playerId, seasonMs), potw: countPeriodWins(playerId, seasonMs, 'week') };
      _cache._awColl[key] = res;
    }
    return {
      kind:'dual',
      metrics:[
        {cur:res.potd, tgt:5, label:'Tagessiege'},
        {cur:res.potw, tgt:2, label:'Wochensiege'}
      ],
      hint:'Zählt nur die laufende Saison — beide Ziele nötig, Reset zu Saisonbeginn.'
    };
  }
  if(badgeId === 'allwetter'){
    // Wochentage, an denen bereits Player-of-the-Day — 1:1 aus countAllwetter,
    // aber wir behalten das Set (statt nur size≥5) für die Chip-Anzeige.
    const byDay = {};
    matches.forEach(m => {
      const day = mdayKey(m);
      if(!byDay[day]) byDay[day] = { ms: [], jsDate: new Date(m.created_at) };
      byDay[day].ms.push(m);
    });
    const today = new Date().toISOString().slice(0,10);
    const weekdays = new Set();
    Object.entries(byDay).forEach(([day, info]) => {
      if(day === today) return;       // laufender Tag zählt nicht
      if(info.ms.length < 2) return;  // POTD braucht min. 2 Spiele am Tag
      const winsById = {};
      info.ms.forEach(m => [m.a1,m.a2,m.b1,m.b2].forEach(pid => {
        if(!winsById[pid]) winsById[pid] = 0;
        const onA = (pid===m.a1||pid===m.a2);
        if((onA && m.winner==='A') || (!onA && m.winner==='B')) winsById[pid]++;
      }));
      const maxW = Math.max(...Object.values(winsById));
      if(maxW < 3) return;
      if((winsById[playerId]||0) === maxW) weekdays.add(info.jsDate.getDay());
    });
    return {weekdays, tgt:5, label:'Wochentage als Tagessieger', kind:'weekday'};
  }

  // Alle übrigen Fälle laufen chronologisch durch die Matches des Spielers.
  const ordered = matches.filter(m => matchOf(playerId,m))
    .sort((a,b) => mts(a)-mts(b));

  switch(badgeId){
    case 'nerves_of_steel': {
      // Zittersiege (10:9) in Folge — nicht-knappe Partien überspringen die Serie
      // ohne sie zu brechen; nur eine knappe Niederlage (9:10) setzt zurück.
      let cur = 0;
      ordered.forEach(m => {
        const gf=goalsFor(playerId,m), ga=goalsAgainst(playerId,m);
        const isClose=(gf===10&&ga===9)||(gf===9&&ga===10);
        if(!isClose) return;
        cur = won(playerId,m) ? cur+1 : 0;
      });
      return {cur, tgt:3, label:'Zittersiege in Folge', hint:'Setzt bei knapper Niederlage (9:10) zurück'};
    }
    case 'krimi': {
      // Partien mit Tordifferenz ≤ 2 in Folge — ein klares Ergebnis bricht die Serie.
      let cur = 0;
      ordered.forEach(m => {
        cur = Math.abs(m.score_a-m.score_b) <= 2 ? cur+1 : 0;
      });
      return {cur, tgt:5, label:'Krimis in Folge (Tordiff ≤ 2)', hint:'Setzt bei klarem Ergebnis (Tordiff > 2) zurück'};
    }
    case 'repeat_score': {
      // Siege mit identischem Endstand in Folge — Niederlage oder anderer Score bricht.
      let lastScore=null, cur=0;
      ordered.forEach(m => {
        if(!won(playerId,m)){cur=0;lastScore=null;return;}
        const score=goalsFor(playerId,m)+':'+goalsAgainst(playerId,m);
        if(score===lastScore) cur++; else {cur=1;lastScore=score;}
      });
      return {cur, tgt:3, label:'Siege mit gleichem Endstand in Folge', hint:'Setzt bei Niederlage oder anderem Ergebnis zurück'};
    }
    case 'losing5': {
      let cur=0;
      ordered.forEach(m => { cur = won(playerId,m) ? 0 : cur+1; });
      return {cur, tgt:5, label:'Niederlagen in Folge', hint:'Setzt bei einem Sieg zurück'};
    }
    case 'streak5': case 'streak10': case 'streak15': case 'streak20': {
      const tgts={streak5:5,streak10:10,streak15:15,streak20:20};
      let cur=0;
      ordered.forEach(m => { cur = won(playerId,m) ? cur+1 : 0; });
      return {cur, tgt:tgts[badgeId], label:'Siege in Folge', hint:'Setzt bei einer Niederlage zurück'};
    }
    case 'nemesis': {
      // Aktueller Niederlagen-Streak gegen denselben Gegner (max. über alle Gegner).
      const vs = {};
      ordered.forEach(m => {
        const onA = (playerId===m.a1||playerId===m.a2);
        const w = (onA && m.winner==='A') || (!onA && m.winner==='B');
        const opps = onA ? [m.b1,m.b2] : [m.a1,m.a2];
        if(w) opps.forEach(o => { vs[o] = 0; });
        else  opps.forEach(o => { vs[o] = (vs[o]||0) + 1; });
      });
      const cur = Object.values(vs).reduce((a,b) => a>b?a:b, 0);
      return {cur, tgt:5, label:'Niederlagen gg. denselben Gegner in Folge', hint:'Setzt bei einem Sieg gegen diesen Gegner zurück'};
    }
  }
  return null;
}

// Rendert den „Aktueller Lauf"-Abschnitt für ein Kontext-/Serien-Badge.
// Gibt '' zurück, wenn das Badge keinen resettbaren Zähler hat.
const _WEEKDAY_ABBR = ['Mo','Di','Mi','Do','Fr','Sa','So']; // Index = (getDay()+6)%7
function _badgeStreakSectionHtml(badgeId, playerId, rarity){
  const st = _badgeStreakState(badgeId, playerId);
  if(!st) return '';
  if(st.kind === 'dual'){
    // Zwei parallele Ziele (z. B. Award-Sammler: Tagessiege + Wochensiege).
    const bars = st.metrics.map(mt => {
      const done = mt.cur >= mt.tgt;
      const pct = Math.round(Math.min(mt.cur / mt.tgt, 1) * 100);
      return `
      <div class="bp-prog">
        <div class="bp-prog-bar"><div class="bp-prog-fill ${rarity}" style="width:${pct}%"></div></div>
        <div class="bp-prog-label">
          <span>${mt.cur} / ${mt.tgt} <span class="bp-prog-target">${esc(mt.label)}</span></span>
          <span>${done?'✓':pct+'%'}</span>
        </div>
      </div>`;
    }).join('');
    return `
      <div class="bp-section">Aktuelle Saison</div>
      ${bars}
      <div class="bp-run-hint">${esc(st.hint)}</div>`;
  }
  if(st.kind === 'weekday'){
    const have = st.weekdays.size;
    const chips = _WEEKDAY_ABBR.map((abbr, i) => {
      // i = (getDay()+6)%7 → 0=Mo … 6=So; zurückrechnen auf getDay()
      const jsDay = (i + 1) % 7;
      const on = st.weekdays.has(jsDay);
      return `<div class="bp-wd ${on?'on':''}">${abbr}</div>`;
    }).join('');
    return `
      <div class="bp-section">Wochentage gesammelt</div>
      <div class="bp-weekdays">${chips}</div>
      <div class="bp-run-label"><span>${have} / ${st.tgt} <span class="bp-prog-target">${esc(st.label)}</span></span></div>`;
  }
  const cur = st.cur || 0;
  const pct = Math.round(Math.min(cur / st.tgt, 1) * 100);
  return `
    <div class="bp-section">Aktueller Lauf</div>
    <div class="bp-prog">
      <div class="bp-prog-bar"><div class="bp-prog-fill ${rarity}" style="width:${pct}%"></div></div>
      <div class="bp-prog-label">
        <span>${cur} / ${st.tgt} <span class="bp-prog-target">${esc(st.label)}</span></span>
        <span>${pct}%</span>
      </div>
    </div>
    <div class="bp-run-hint">${esc(st.hint)}</div>`;
}

function showBadgePopover(badgeId, playerId){
  const b = BADGES.find(x => x.id === badgeId); if(!b) return;
  const r = rarityOf(b.id);
  const rarityLabel = (RARITY_META[r] && RARITY_META[r].label) || '';
  const earned = getCachedBadges(playerId);
  const cnt = (earned.find(e => e.id === badgeId)||{}).count || 0;
  const unlocked = cnt > 0;
  const ONCE_ONLY = new Set(['first_match','games25','games150','games250','wins200','allrounder','def50','atk50',
    'allwetter']);
  const isRepeatable = !ONCE_ONLY.has(b.id);

  // ─── Body je nach Modus ───
  let bodyHtml;
  if(unlocked){
    // Match-Liste (für fire-basierte Badges)
    const hits = _badgeFireMatches(playerId, badgeId);
    if(hits.length){
      const maxShow = 8;
      const shown = hits.slice(0, maxShow);
      const rowsHtml = shown.map(m => {
        const date = new Date(m.created_at);
        const dateStr = date.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'2-digit'});
        const onA = (playerId===m.a1||playerId===m.a2);
        const myGf = onA?m.score_a:m.score_b;
        const myGa = onA?m.score_b:m.score_a;
        const won = (onA&&m.winner==='A')||(!onA&&m.winner==='B');
        const col = won ? 'var(--acid)' : 'var(--red)';
        return `<div class="bp-match" data-mid="${esc(m.id)}">
          <div class="bp-match-date">${dateStr}</div>
          <div class="bp-match-score" style="color:${col}">${myGf} : ${myGa}</div>
          <div class="bp-match-arr">›</div>
        </div>`;
      }).join('');
      const moreHint = hits.length > maxShow
        ? `<div class="bp-more">+ ${hits.length - maxShow} weitere</div>` : '';
      bodyHtml = `
        <div class="bp-section">Ausgelöst in ${hits.length} ${hits.length===1?'Match':'Matches'}</div>
        ${rowsHtml}${moreHint}`;
    } else {
      // Saison-/Karriere-aggregierte Badges ohne fire-Trigger.
      // Wir zeigen einen kurzen Hinweis statt einer Liste.
      bodyHtml = `
        <div class="bp-section">Status</div>
        <div class="bp-locked-hint">
          Diese Auszeichnung wird über Saison-/Karriere-Daten ermittelt und
          ist nicht an ein einzelnes Match gebunden.
          ${isRepeatable
            ? `<br><br><span class="bp-locked-em">${cnt}×</span> bisher erreicht.`
            : `<br><br><span class="bp-locked-em">Freigeschaltet.</span>`}
        </div>`;
    }
  } else {
    // Locked — Fortschritt oder Hinweis
    const prog = _badgeProgress(badgeId, playerId);
    if(prog){
      const pct = Math.round(prog.cur / prog.tgt * 100);
      bodyHtml = `
        <div class="bp-section">Fortschritt</div>
        <div class="bp-prog">
          <div class="bp-prog-bar"><div class="bp-prog-fill ${r}" style="width:${Math.min(pct,100)}%"></div></div>
          <div class="bp-prog-label">
            <span>${prog.cur} / ${prog.tgt} <span class="bp-prog-target">${esc(prog.label)}</span></span>
            <span>${pct}%</span>
          </div>
        </div>`;
    } else {
      // Kein Fortschritt definierbar — knapper Hinweis
      bodyHtml = `
        <div class="bp-section">Status</div>
        <div class="bp-locked-hint">
          Noch <span class="bp-locked-em">nicht erreicht</span>.<br>
          Erfüll die Voraussetzung im nächsten Spiel oder über die Saison hinweg.
        </div>`;
    }
  }

  // Kontext-/Serien-Badges: laufender Zähler (resettet je nach Spielverlauf).
  // Erscheint zusätzlich zur Match-Liste/zum Fortschritt — sowohl locked als
  // auch unlocked, damit man sieht, wie nah man an der nächsten Auslösung ist.
  bodyHtml += _badgeStreakSectionHtml(badgeId, playerId, r);

  // Status-Pill rechts oben in der Card (×N oder "Freigeschaltet")
  const statusHtml = unlocked
    ? (isRepeatable
        ? `<div class="bp-status"><div class="bp-status-count" style="color:${{legendary:'var(--gold)',rare:'var(--purple)',common:'var(--acid)',negative:'var(--red)'}[r]||'var(--ink)'}">×${cnt}</div><div class="bp-status-label">erreicht</div></div>`
        : `<div class="bp-status"><div class="bp-status-count" style="color:${{legendary:'var(--gold)',rare:'var(--purple)',common:'var(--acid)',negative:'var(--red)'}[r]||'var(--ink)'}">✓</div><div class="bp-status-label">freigeschaltet</div></div>`)
    : '';

  const bp = document.getElementById('bp');
  const bpBg = document.getElementById('bpBg');
  bp.innerHTML = `
    <div class="bp-head">
      <div class="bp-ic ${unlocked?r:'locked'}">${unlocked ? badgeIc(b, '24px') : svgI('lock')}</div>
      <div style="flex:1;min-width:0">
        <div class="bp-title">${esc(b.name)}</div>
        <div class="bp-desc">${esc(b.desc)}</div>
        <div class="bp-rarity">${esc(rarityLabel)}</div>
      </div>
      ${statusHtml}
    </div>
    ${bodyHtml}
    <button class="bp-close" id="bpCloseBtn">Schließen</button>
  `;
  bpBg.classList.add('show');
  bp.scrollTop = 0;
  // Match-Click: schließt POPOVER und SHEET, öffnet Match-Detail
  bp.querySelectorAll('.bp-match[data-mid]').forEach(el => {
    el.onclick = () => {
      const mid = el.dataset.mid;
      closeBadgePopover();
      sheetNav(() => showMatchDetail(mid)); // Match-Detail über das aktuelle Sheet stapeln
    };
  });
  document.getElementById('bpCloseBtn').onclick = closeBadgePopover;
}

function closeBadgePopover(){
  const bpBg = document.getElementById('bpBg');
  if(bpBg) bpBg.classList.remove('show');
}

