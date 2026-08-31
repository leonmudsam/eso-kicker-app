// ╔═══ §5.3c ─── TOP-5-LISTEN FÜR STATISTIK-KARTEN (v9.16) ─────────────╗
//     Statistik-/Superlativ-Karten (Team of the Season, Peak-Elo, Bestes
//     Team, Größter Upset …) öffneten bisher direkt das Spieler- bzw.
//     Team-Profil des Siegers. Damit war nicht zu sehen, WER knapp dahinter
//     liegt. Jetzt öffnen sie erst die Rangliste dahinter (Top 5); ein Tap auf
//     eine Zeile führt weiter ins Profil, es geht also keine Navigation
//     verloren. Die Ranking-Helper unten sind bewusst geteilt: vRanking nimmt
//     [0] für die Karte, das Sheet nimmt die ersten 5 — eine Wahrheit,
//     keine doppelte Berechnung.
// ╚═════════════════════════════════════════════════════════════════════════╝
// Teams eines Match-Sets nach gemeinsamem Elo-Zuwachs. minGames filtert
// Zufalls-Duos (Saison-Karte: min. 2 gemeinsame Spiele).
function _teamEloRanking(ms, minGames){
  const T={};
  ms.forEach(m=>{
    [[m.a1,m.a2,m.winner==='A'],[m.b1,m.b2,m.winner==='B']].forEach(([x,y,won])=>{
      const ids=[x,y].sort(), k=ids.join('|');
      if(!T[k]) T[k]={ids, g:0, w:0, elo:0};
      T[k].g++; if(won) T[k].w++;
      T[k].elo += ((m.deltas||{})[x]||0) + ((m.deltas||{})[y]||0);
    });
  });
  return Object.values(T).filter(t=>t.g>=(minGames||1)).sort((a,b)=>b.elo-a.elo||b.g-a.g);
}
// Team of the Season: Elo-Zuwachs aus der Sim (konsistent zur Tabelle),
// Spielzahlen aus den Saison-Matches. Absteigend sortiert.
function _seasonTeamRanking(seasonMs, sid){
  const gsim=getGlobalSim();
  const map=gsim.seasonTeamElo[sid||currentSeason().id]||{};
  const counts={};
  seasonMs.forEach(m=>{
    [[m.a1,m.a2,m.winner==='A'],[m.b1,m.b2,m.winner==='B']].forEach(([x,y,won])=>{
      const k=[x,y].sort().join('|');
      if(!counts[k]) counts[k]={g:0,w:0};
      counts[k].g++; if(won) counts[k].w++;
    });
  });
  return Object.entries(map).map(([k,elo])=>{
    const c=counts[k];
    return c ? {ids:k.split('|'), elo, g:c.g, w:c.w} : null;
  }).filter(t=>t && t.g>=2).sort((a,b)=>b.elo-a.elo||b.g-a.g);
}
// Upsets eines Match-Sets: niedrigste Siegerwartung des Siegers zuerst.
function _upsetRanking(ms){
  return ms.map(m=>{
    const expA=m.exp_a??0.5;
    const we=m.winner==='A'?expA:(1-expA);
    return {m, winPct:Math.round(we*100), sp:1-we};
  }).sort((a,b)=>b.sp-a.sp);
}
// All-Time-Peak-Elo: bester Saison-End-Elo pro Spieler (ein Eintrag je Spieler,
// damit die Top 5 fünf verschiedene Köpfe zeigt statt fünfmal denselben).
function _peakEloRanking(){
  const gsim=getGlobalSim();
  const best={};
  Object.entries(gsim.seasonEndElos||{}).forEach(([sid,eloMap])=>{
    Object.entries(eloMap).forEach(([pid,e])=>{
      if(!best[pid] || e>best[pid].elo) best[pid]={pid, elo:e, sid};
    });
  });
  const pm=pmap();
  return Object.values(best).filter(x=>pm[x.pid]&&!pm[x.pid].hidden)
    .sort((a,b)=>b.elo-a.elo);
}
// Karriere-Siege bzw. -Siegquote (min. 10 Spiele), absteigend.
function _careerWinsRanking(){
  const gsim=getGlobalSim();
  return activePlayers().map(p=>({id:p.id, v:gsim.wins[p.id]||0}))
    .filter(x=>x.v>0).sort((a,b)=>b.v-a.v);
}
function _careerWrRanking(){
  const gsim=getGlobalSim();
  return activePlayers().map(p=>{
    const g=gsim.played[p.id]||0, w=gsim.wins[p.id]||0;
    return {id:p.id, g, w, wr:g?w/g:0};
  }).filter(x=>x.g>=10).sort((a,b)=>b.wr-a.wr||b.g-a.g);
}
// Saison-Titel (Player of the Season) je Spieler aus dem Saison-Archiv.
function _titleRanking(){
  const cur=currentSeason().id;
  const cnt={};
  seasons.forEach(s=>{ if(s.id!==cur && s.player_id) cnt[s.player_id]=(cnt[s.player_id]||0)+1; });
  const pm=pmap();
  return Object.entries(cnt).filter(([pid])=>pm[pid])
    .map(([pid,v])=>({id:pid, v})).sort((a,b)=>b.v-a.v);
}

// Generisches Top-N-Sheet. rows: [{ids:[pid…]|null, matchId?, name, val, detail?}]
// ids mit 1 Element → Spieler-Zeile, 2 Elemente → Team-Zeile, matchId → Match.
function showTopList(c){
  if(!c) return;
  _sheetSetReopen(()=>showTopList(c));
  const rows=(c.rows||[]).slice(0, c.limit||5);
  const items=rows.map((r,i)=>{
    const ids=r.ids||[];
    const isTeam=ids.length===2;
    const av=isTeam?awLiPair(ids[0],ids[1]):(ids.length?awLiAv(ids[0]):'');
    const hook=r.matchId ? `data-li-match="${esc(r.matchId)}"`
      : isTeam ? `data-li-team="${esc(ids.slice().sort().join('|'))}"`
      : ids.length ? `data-li-player="${esc(ids[0])}"` : '';
    return `<div class="aw-li${i===0?' top':''}" ${hook}>
      <div class="aw-li-rank">${i+1}.</div>
      ${av}
      <div class="aw-li-info">
        <div class="aw-li-name">${esc(r.name)}</div>
        ${r.detail?`<div class="aw-li-detail">${esc(r.detail)}</div>`:''}
      </div>
      <div class="aw-li-val">${esc(r.val)}</div>
    </div>`;
  }).join('');
  openSheet(`
    <div class="aw-hero-icon">
      <div class="aw-hero-icon-glow ${c.cls||'gold'}">
        <svg viewBox="0 0 24 24">${ICONS[c.ic||'trophy']||''}</svg>
      </div>
      <div class="aw-hero-title">${esc(c.title||'')}</div>
      <div class="aw-hero-sub">${esc(c.sub||'')}</div>
    </div>
    ${items?`<div class="aw-list-label">${esc(c.listLabel||('Top '+rows.length))}</div>
      <div class="aw-list">${items}</div>`
     :`<div class="empty" style="margin-top:24px">Noch keine Daten</div>`}
    ${c.why?`<div class="aw-why">
      <div class="aw-why-ic"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16v.5"/></svg></div>
      <div class="aw-why-content">
        <div class="aw-why-label">So wird gewertet</div>
        <div class="aw-why-body">${esc(c.why)}</div>
      </div>
    </div>`:''}`);
  // Zeilen weiterverlinken — gleiche Ziele wie vorher die Karte selbst.
  document.querySelectorAll('.aw-li[data-li-player]').forEach(el=>{
    el.onclick=()=>{ sheetNav(()=>showPlayer(el.dataset.liPlayer)); };
  });
  document.querySelectorAll('.aw-li[data-li-team]').forEach(el=>{
    el.onclick=()=>{ const [a,b]=el.dataset.liTeam.split('|'); sheetNav(()=>showTeam(a,b)); };
  });
  document.querySelectorAll('.aw-li[data-li-match]').forEach(el=>{
    el.onclick=()=>{ sheetNav(()=>showMatchDetail(el.dataset.liMatch)); };
  });
}

// Baut das passende Top-5-Sheet für eine Statistik-Karte (data-toplist="<kind>").
// Berechnet erst beim Klick — die Views tragen nur das Attribut.
function openTopList(kind){
  const teamRow=t=>({ids:t.ids, name:t.ids.map(pname).join(' & '),
    val:(t.elo>=0?'+':'')+Math.round(t.elo)+' Elo', detail:t.w+'/'+t.g+' Siege'});
  if(kind==='seasonTeam'){
    // Die Blätter folgen der Saison, die der Liga-Tab gerade zeigt — sonst
    // öffnet die Karte einer alten Saison die Liste der laufenden.
    return showTopList({title:'Team of the Season', sub:periodLabel('season', ligaSaisonId()),
      ic:'handshake', cls:'blue',
      rows:_seasonTeamRanking(matchesInPeriod('season', ligaSaisonId()), ligaSaisonId()).map(teamRow),
      why:'Duo mit dem höchsten gemeinsamen Elo-Zuwachs in dieser Saison. Min. 2 gemeinsame Spiele.'});
  }
  if(kind==='periodTeam'){
    return showTopList({title:'Bestes Team', sub:periodLabel(period),
      ic:'handshake', cls:'blue', rows:_teamEloRanking(matchesInPeriod(period),1).filter(t=>t.elo>0).map(teamRow),
      why:'Duo mit dem höchsten gemeinsamen Elo-Zuwachs in diesem Zeitraum.'});
  }
  if(kind==='periodStreak'){
    return showTopList({title:'Heißeste Serie', sub:periodLabel(period),
      ic:'flame', cls:'acid',
      rows:longestStreaks(matchesInPeriod(period)).map(s=>({ids:[s.id], name:pname(s.id), val:s.v+'×', detail:'Siege in Folge'})),
      why:'Längste Siegesserie innerhalb dieses Zeitraums. Min. 2 Siege in Folge.'});
  }
  if(kind==='periodUpset'){
    return showTopList({title:'Größter Upset', sub:periodLabel(period),
      ic:'bolt', cls:'blue',
      rows:_upsetRanking(matchesInPeriod(period)).map(u=>{
        const w=u.m.winner==='A'?[u.m.a1,u.m.a2]:[u.m.b1,u.m.b2];
        return {ids:w, matchId:u.m.id, name:w.map(pname).join(' & '),
          val:u.winPct+'%', detail:u.m.score_a+':'+u.m.score_b+' · '+dateStr(u.m.created_at)};
      }),
      why:'Sieg mit der niedrigsten Siegerwartung. Je kleiner die Chance, desto größer der Upset.'});
  }
  if(kind==='periodKing'){
    const isWeek=period==='week';
    const list=(getCachedAwardRankings('all')[isWeek?'weekKingList':'dayKingList'])||[];
    return showTopList({title:isWeek?'Wochenkönig':'Tageskönig', sub:'All-Time',
      ic:isWeek?'weekKing':'dayKing', cls:'gold',
      rows:list.map(k=>({ids:[k.id], name:pname(k.id), val:k.v+'×',
        detail:isWeek?'Player of the Week':'Player of the Day'})),
      why:isWeek
        ? 'Wie oft ein Spieler eine abgeschlossene Woche als Bester beendet hat (min. 5 Siege).'
        : 'Wie oft ein Spieler einen Spieltag als Bester beendet hat (min. 3 Siege).'});
  }
  if(kind==='defender'){
    return showTopList({title:'Saison-Titel', sub:'Player of the Season · All-Time',
      ic:'crown', cls:'purple',
      rows:_titleRanking().map(t=>({ids:[t.id], name:pname(t.id), val:t.v+'×', detail:'Saison-Titel'})),
      why:'Abgeschlossene Saisons, die ein Spieler als Bester der Liga beendet hat.'});
  }
  if(kind==='peakElo'){
    const fmt=sid=>{ if(!sid)return ''; const [y,mo]=sid.split('-');
      return ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'][parseInt(mo,10)-1]+" '"+y.slice(2); };
    return showTopList({title:'Peak-Elo', sub:'All-Time', ic:'trendUp', cls:'gold',
      rows:_peakEloRanking().map(x=>({ids:[x.pid], name:pname(x.pid),
        val:String(Math.round(x.elo)), detail:fmt(x.sid)})),
      why:'Höchster Saison-End-Elo, den ein Spieler je erreicht hat — pro Spieler sein bester Wert.'});
  }
  if(kind==='mostWins'){
    return showTopList({title:'Meiste Siege', sub:'Karriere', ic:'trophyStar', cls:'gold',
      rows:_careerWinsRanking().map(x=>({ids:[x.id], name:pname(x.id), val:String(x.v), detail:'Siege'})),
      why:'Summe aller Siege über die gesamte Liga-Historie.'});
  }
  if(kind==='bestWr'){
    return showTopList({title:'Beste Siegquote', sub:'Karriere · min. 10 Spiele',
      ic:'target', cls:'blue',
      rows:_careerWrRanking().map(x=>({ids:[x.id], name:pname(x.id),
        val:Math.round(x.wr*100)+'%', detail:x.w+'/'+x.g+' Spiele'})),
      why:'Höchste Siegquote über die gesamte Karriere. Min. 10 Spiele.'});
  }
}

function showAward(key){
  const R=awardRankings(awPeriod); const pl=awPeriodLabel(); const meta=AWARD_META[key]; if(!meta)return;
  _sheetSetReopen(()=>showAward(key));
  const tn=ids=>ids.map(pname).join(' & ');
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

  // ── NEUE TEAM-AWARDS v4 ──
  // favoritenschreck verhält sich wie ein Match-Award (zeigt ein konkretes Spiel),
  // gewinner/verlierer sind aber TEAMS — daher haben wir ein eigenes Layout unten.
  // rivalry ist ein 4-Spieler-Award mit Sonderlayout (Team A vs Team B).
  const MATCH_AWARDS = new Set(['upset','biggest']);
  const TEAM_AWARDS = new Set([
    'mvt','bestDuo','endgegner','worstTeam','zirkus','baustelle',
    'unstoppable','concreteWall','luckyCharm','giantSlayer',
    // ── NEUE NEGATIV-AWARDS v6 ──
    'cheesePlatter'
  ]);
  const RIVALRY_AWARDS = new Set(['rivalry']);
  const FAVS_AWARDS = new Set(['favoritenschreck']);
  const NEG_KEYS = new Set(['worstWr','worstAtk','worstDef','worstTeam','formtief','coldStreak','lossStreaks','zirkus','baustelle','pechvogel','favoritenschreck','cheesePlatter','favoriteLoser']);

  let bodyHtml='';

  if(MATCH_AWARDS.has(key)){
    const arr = key==='upset' ? R.upsets : R.biggest;
    if(arr&&arr.length){
      const top = arr[0];
      const m = top.m;
      const winnerSide = m.winner;
      const isUpsetVariant = key==='upset';
      const upsetWinPct = isUpsetVariant ? Math.round((1-top.sp)*100) : null;
      const diffStr = key==='biggest' ? '+'+top.diff+' Tore' : 'Siegchance nur '+upsetWinPct+'%';
      bodyHtml = `
        <div class="aw-match${isUpsetVariant?' upset':''}">
          <div class="aw-match-score">${m.score_a} : ${m.score_b}</div>
          <div class="aw-match-meta">${dateStr(m.created_at)} · ${diffStr}</div>
          <div class="aw-match-teams">
            <div class="aw-match-team">
              ${winnerSide==='A'?'<div class="aw-match-winner">Gewinner</div>':''}
              ${awMiniPair(m.a1,m.a2)}
              <div class="aw-match-team-name">${esc(pname(m.a1)+' & '+pname(m.a2))}</div>
            </div>
            <div class="aw-match-vs">vs</div>
            <div class="aw-match-team">
              ${winnerSide==='B'?'<div class="aw-match-winner">Gewinner</div>':''}
              ${awMiniPair(m.b1,m.b2)}
              <div class="aw-match-team-name">${esc(pname(m.b1)+' & '+pname(m.b2))}</div>
            </div>
          </div>
        </div>`;
    } else {
      bodyHtml = `<div class="empty" style="margin-top:24px">Keine Daten</div>`;
    }
  } else if(FAVS_AWARDS.has(key)){
    // Favoritenschreck: Match-Detail aus dem Top-Eintrag der Liste rendern.
    // Wie biggest/upset zeigen wir das konkrete Spiel mit Score + Teams. Zusätzlich
    // wird die überwundene Team-Elo-Differenz oben prominent dargestellt.
    const arr = R.favoritenschreckList;
    if(arr && arr.length){
      const top = arr[0];
      const m = top.m;
      const winnerSide = m.winner;
      bodyHtml = `
        <div class="aw-match upset">
          <div class="aw-match-score">${m.score_a} : ${m.score_b}</div>
          <div class="aw-match-meta">${dateStr(m.created_at)} · ${top.v} Elo überwunden</div>
          <div class="aw-match-teams">
            <div class="aw-match-team">
              ${winnerSide==='A'?'<div class="aw-match-winner">Sieger</div>':''}
              ${awMiniPair(m.a1,m.a2)}
              <div class="aw-match-team-name">${esc(pname(m.a1)+' & '+pname(m.a2))}</div>
            </div>
            <div class="aw-match-vs">vs</div>
            <div class="aw-match-team">
              ${winnerSide==='B'?'<div class="aw-match-winner">Sieger</div>':''}
              ${awMiniPair(m.b1,m.b2)}
              <div class="aw-match-team-name">${esc(pname(m.b1)+' & '+pname(m.b2))}</div>
            </div>
          </div>
        </div>`;
      // Weitere Plätze als kompakte Liste — andere Teams mit ihren best-Coups
      if(arr.length > 1){
        const rest = arr.slice(1, 7);
        const items = rest.map((e, idx) => {
          const teamName = pname(e.ids[0]) + ' & ' + pname(e.ids[1]);
          return `<div class="aw-li" data-li-team="${esc(e.ids.slice().sort().join('|'))}">
            <div class="aw-li-rank">${idx+2}.</div>
            ${awLiPair(e.ids[0], e.ids[1])}
            <div class="aw-li-info"><div class="aw-li-name">${esc(teamName)}</div></div>
            <div class="aw-li-val">${e.v} Elo</div>
          </div>`;
        }).join('');
        bodyHtml += `<div class="aw-list-label">Weitere Coups</div><div class="aw-list">${items}</div>`;
      }
    } else {
      bodyHtml = `<div class="empty" style="margin-top:24px">Keine Daten</div>`;
    }
  } else if(RIVALRY_AWARDS.has(key)){
    // Erzfeinde: Team-Paar mit zwei Bilanz-Boxen (Team A | Team B) + Torverhältnis.
    const arr = R.rivalryList;
    if(arr && arr.length){
      const top = arr[0];
      const teamAName = pname(top.idsA[0]) + ' & ' + pname(top.idsA[1]);
      const teamBName = pname(top.idsB[0]) + ' & ' + pname(top.idsB[1]);
      const aLeading = top.wA > top.wB;
      const bLeading = top.wB > top.wA;
      bodyHtml = `
        <div class="aw-match">
          <div class="aw-match-score">${Math.round(top.pct*100)}%</div>
          <div class="aw-match-meta">${top.g} direkte Duelle · ${top.gfA}:${top.gfB} Tore gesamt</div>
          <div class="aw-match-teams">
            <div class="aw-match-team" data-li-team="${esc(top.idsA.slice().sort().join('|'))}" style="cursor:pointer">
              ${aLeading?'<div class="aw-match-winner">Führt</div>':''}
              ${awMiniPair(top.idsA[0],top.idsA[1])}
              <div class="aw-match-team-name">${esc(teamAName)}</div>
              <div class="aw-match-team-name" style="margin-top:4px;font-family:'Sometype Mono',monospace;font-size:10px;color:var(--muted)">${top.wA} S · ${top.gA} Sp.</div>
            </div>
            <div class="aw-match-vs">vs</div>
            <div class="aw-match-team" data-li-team="${esc(top.idsB.slice().sort().join('|'))}" style="cursor:pointer">
              ${bLeading?'<div class="aw-match-winner">Führt</div>':''}
              ${awMiniPair(top.idsB[0],top.idsB[1])}
              <div class="aw-match-team-name">${esc(teamBName)}</div>
              <div class="aw-match-team-name" style="margin-top:4px;font-family:'Sometype Mono',monospace;font-size:10px;color:var(--muted)">${top.wB} S · ${top.gB} Sp.</div>
            </div>
          </div>
        </div>`;
      // Weitere Rivalitäten
      if(arr.length > 1){
        const rest = arr.slice(1, 7);
        const items = rest.map((e, idx) => {
          const aN = pname(e.idsA[0]) + ' & ' + pname(e.idsA[1]);
          const bN = pname(e.idsB[0]) + ' & ' + pname(e.idsB[1]);
          return `<div class="aw-li">
            <div class="aw-li-rank">${idx+2}.</div>
            <div class="aw-li-info" style="min-width:0">
              <div class="aw-li-name" style="font-size:12px">${esc(aN)}</div>
              <div class="aw-li-name" style="font-size:9.5px;color:var(--muted);letter-spacing:.06em;text-transform:uppercase;margin-top:2px">vs ${esc(bN)}</div>
            </div>
            <div class="aw-li-val">${Math.round(e.pct*100)}% · ${e.g}×</div>
          </div>`;
        }).join('');
        bodyHtml += `<div class="aw-list-label">Weitere Rivalitäten</div><div class="aw-list">${items}</div>`;
      }
    } else {
      bodyHtml = `<div class="empty" style="margin-top:24px">Keine Daten</div>`;
    }
  } else {
    const arr = (() => {
      switch(key){
        case 'wins':       return R.winsList.map(x=>({ids:[x.id],name:pname(x.id),val:x.v+' Siege',sort:x.v}));
        case 'mvt':        return R.mvt.map(x=>({ids:x.ids,name:tn(x.ids),val:(x.v>=0?'+':'')+Math.round(x.v)+' Elo',sort:Math.round(x.v)}));
        case 'streaks':    return R.streaks.map(x=>({ids:[x.id],name:pname(x.id),val:x.v+'er Serie',sort:x.v}));
        case 'scorer':     return R.scorer.map(x=>({ids:[x.id],name:pname(x.id),val:'Ø '+x.avg.toFixed(1)+' Tore',sort:Math.round(x.avg*10)}));
        case 'wall':       return R.wall.map(x=>({ids:[x.id],name:pname(x.id),val:(x.v/x.g).toFixed(1)+' /Sp.',sort:-Math.round(x.v/x.g*10)}));
        case 'perfect':    return R.perfect.map(x=>({ids:[x.id],name:pname(x.id),val:Math.round(x.wr*100)+'%',sort:Math.round(x.wr*100)}));
        case 'grinder':    return R.grinder.map(x=>({ids:[x.id],name:pname(x.id),val:x.v+' Spiele',sort:x.v}));
        case 'worstWr':    return R.worstWr.map(x=>({ids:[x.id],name:pname(x.id),val:Math.round(x.wr*100)+'%',sort:-Math.round(x.wr*100)}));
        case 'worstAtk':   return R.worstAtk.map(x=>({ids:[x.id],name:pname(x.id),val:(x.v/x.g).toFixed(1)+' Tore/Sp.',sort:-Math.round(x.v/x.g*10)}));
        case 'worstDef':   return R.worstDef.map(x=>({ids:[x.id],name:pname(x.id),val:(x.v/x.g).toFixed(1)+' Gegen/Sp.',sort:Math.round(x.v/x.g*10)}));
        case 'endgegner':  return R.endgegner.map(x=>({ids:x.ids,name:tn(x.ids),val:Math.round(x.pct*100)+'% ('+x.g+'×)',sort:Math.round(x.pct*1000)}));
        case 'clutch':     return R.clutchList.map(x=>({ids:[x.id],name:pname(x.id),val:Math.round(x.wr*100)+'%',sort:Math.round(x.wr*100)}));
        case 'ice':        return R.iceList.map(x=>({ids:[x.id],name:pname(x.id),val:x.v+'× Zu-Null',sort:x.v}));
        case 'worstTeam':  return R.worstTeam.map(x=>({ids:x.ids,name:tn(x.ids),val:Math.round(x.w/x.g*100)+'%',sort:-Math.round(x.w/x.g*100)}));
        case 'bestDuo':    return R.bestDuo.map(x=>({ids:x.ids,name:tn(x.ids),val:x.g+' Spiele',sort:x.g}));
        case 'onFire':     return R.onFire.map(x=>({ids:[x.id],name:pname(x.id),val:x.v+'er Serie',sort:x.v}));
        case 'coldStreak': return R.coldStreak.map(x=>({ids:[x.id],name:pname(x.id),val:x.v+'er Niederlagen',sort:x.v}));
        case 'lossStreaks':return R.lossStreaks.map(x=>({ids:[x.id],name:pname(x.id),val:x.v+'er Serie',sort:x.v}));
        case 'carryKing':  return R.carryList.map(x=>({ids:[x.id],name:pname(x.id),val:x.v+' Carries',sort:x.v}));
        case 'showmaster': return R.showmasterList.map(x=>({ids:[x.id],name:pname(x.id),val:x.v+'× 10:0',sort:x.v}));
        case 'solo':       return R.soloList.map(x=>({ids:[x.id],name:pname(x.id),val:Math.round(x.wr*100)+'%',sort:Math.round(x.wr*100)}));
        case 'formtief':   return R.formtief.map(x=>({ids:[x.id],name:pname(x.id),val:'-'+Math.round(x.drop)+' Elo',sort:Math.round(x.drop)}));
        case 'zirkus':     return R.zirkusList.map(x=>({ids:x.ids,name:tn(x.ids),val:Math.round(x.pct*100)+'% ('+x.v+'/'+x.g+')',sort:Math.round(x.pct*1000)}));
        case 'baustelle':  return R.baustelleList.map(x=>({ids:x.ids,name:tn(x.ids),val:x.best+'er Serie',sort:x.best}));
        case 'peakElo':    return (R.peakEloList||[]).map(x=>({ids:[x.id],name:pname(x.id),val:x.v+' Elo',sort:x.v}));
        case 'weekKing':   return (R.weekKingList||[]).map(x=>({ids:[x.id],name:pname(x.id),val:x.v+'× POTW',sort:x.v}));
        case 'dayKing':    return (R.dayKingList||[]).map(x=>({ids:[x.id],name:pname(x.id),val:x.v+'× POTD',sort:x.v}));
        // ── NEUE AWARDS v3 ──
        case 'plusMinus':  return R.plusMinusList.map(x=>({ids:[x.id],name:pname(x.id),val:(x.v>=0?'+':'')+x.v.toFixed(1)+' /Sp.',sort:Math.round(x.v*10)}));
        case 'underdog':   return R.underdogList.map(x=>({ids:[x.id],name:pname(x.id),val:x.v+'× Underdog-Sieg',sort:x.v}));
        case 'pechvogel':  return R.pechvogelList.map(x=>({ids:[x.id],name:pname(x.id),val:Math.round(x.pct*100)+'% knapp verloren ('+x.v+'/'+x.g+')',sort:Math.round(x.pct*1000)}));
        // ── NEUE TEAM-AWARDS v4 ──
        case 'unstoppable':  return R.unstoppableList.map(x=>({ids:x.ids,name:tn(x.ids),val:x.v+' Siege in Folge',sort:x.v}));
        case 'concreteWall': return R.concreteWallList.map(x=>({ids:x.ids,name:tn(x.ids),val:x.v.toFixed(2)+' Gegentore/Sp.',sort:-Math.round(x.v*100)}));
        case 'luckyCharm':   return R.luckyCharmList.map(x=>({ids:x.ids,name:tn(x.ids),val:Math.round(x.v*100)+'% ('+x.wins+'/'+x.games+')',sort:Math.round(x.v*1000)}));
        case 'giantSlayer':  return R.giantSlayerList.map(x=>({ids:x.ids,name:tn(x.ids),val:Math.round(x.v*100)+'% ('+x.wins+'/'+x.games+')',sort:Math.round(x.v*1000)}));
        // ── NEUE NEGATIV-AWARDS v6 ──
        case 'cheesePlatter': return R.cheesePlatterList.map(x=>({ids:x.ids,name:tn(x.ids),val:x.v.toFixed(2)+' Gegentore/Sp.',sort:Math.round(x.v*100)}));
        case 'favoriteLoser': return R.favoriteLoserList.map(x=>({ids:[x.id],name:pname(x.id),val:Math.round(x.v*100)+'% ('+x.losses+'/'+x.games+')',sort:Math.round(x.v*1000)}));
        default: return [];
      }
    })();

    // Hero (#1) + Liste der weiteren Plätze
    if(!arr.length){
      bodyHtml = `<div class="empty" style="margin-top:24px">Keine Daten</div>`;
    } else {
      const isTeamAward = TEAM_AWARDS.has(key);
      const isNeg = NEG_KEYS.has(key);
      // meta.cls → RGB für Hero-Akzentfarbe
      const CLS_RGB = {gold:'247,207,74',acid:'190,242,100',blue:'86,180,232',orange:'255,120,73',purple:'167,139,250',red:'240,86,106'};
      const heroRgb = CLS_RGB[meta.cls] || CLS_RGB.gold;

      // ─── Hero (#1) – alle bei sort=arr[0].sort sind geteilte #1 ───
      const topGroup = arr.filter(x => x.sort === arr[0].sort);
      const isShared = topGroup.length > 1;
      const top = arr[0];
      // Wert (für Hero – alle teilen denselben Wert)
      const heroVal = (() => {
        const v = top.val;
        const m = v.match(/^([+\-]?\d+(?:[.,]\d+)?)/);
        return m ? `<b>${esc(m[1])}</b>${esc(v.slice(m[1].length))}` : esc(v);
      })();

      let heroHtml;
      if(!isShared){
        // ─── Single Hero (#1) ───
        const heroClick = isTeamAward
          ? `data-li-team="${esc(top.ids.slice().sort().join('|'))}"`
          : `data-li-player="${esc(top.ids[0])}"`;
        const heroAv = isTeamAward ? awHeroPair(top.ids[0], top.ids[1]) : awHeroAv(top.ids[0], isNeg);
        const heroMarker = isNeg
          ? `<div class="aw-winner-marker"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS.skull}</svg></div>`
          : `<div class="aw-winner-crown">${svgI('crown')}</div>`;
        const heroBadge = isNeg
          ? `<span class="aw-winner-badge">Schandfleck · #1</span>`
          : `<span class="aw-winner-badge"><svg viewBox="0 0 24 24"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0z"/></svg> Best · #1</span>`;

        heroHtml = `
          <div class="aw-winner ${isNeg?'shame':''}" style="--c:${heroRgb}" ${heroClick}>
            ${heroBadge}
            <div class="aw-winner-av-wrap">
              ${heroMarker}
              ${heroAv}
            </div>
            <div class="aw-winner-name">${esc(top.name)}</div>
            <div class="aw-winner-val">${heroVal}</div>
          </div>`;
      } else {
        // ─── Shared Hero: mehrere Spieler/Teams teilen sich #1 ───
        const sharedBadge = isNeg
          ? `<span class="aw-winner-badge">Geteilt · #1 · ${topGroup.length} ${isTeamAward?'Teams':'Sünder'}</span>`
          : `<span class="aw-winner-badge"><svg viewBox="0 0 24 24"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0z"/></svg> Geteilt · #1 · ${topGroup.length} ${isTeamAward?'Teams':'Spieler'}</span>`;
        const sharedMarker = isNeg
          ? `<div class="aw-winner-shared-marker shame"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS.skull}</svg></div>`
          : `<div class="aw-winner-shared-marker">${svgI('crown')}</div>`;
        const entries = topGroup.map(e => {
          const av = isTeamAward
            ? `<div class="aw-winner-tied-pair">${awLiAv(e.ids[0],false,true)}${awLiAv(e.ids[1],false,true)}</div>`
            : awLiAv(e.ids[0], false, isNeg);
          const click = isTeamAward
            ? `data-li-team="${esc(e.ids.slice().sort().join('|'))}"`
            : `data-li-player="${esc(e.ids[0])}"`;
          return `<div class="aw-winner-tied-entry" ${click}>
            ${av}
            <div class="aw-winner-tied-name">${esc(e.name)}</div>
          </div>`;
        }).join('');

        heroHtml = `
          <div class="aw-winner shared ${isNeg?'shame':''}" style="--c:${heroRgb}">
            ${sharedBadge}
            ${sharedMarker}
            <div class="aw-winner-shared-grid">${entries}</div>
            <div class="aw-winner-val">${heroVal}</div>
          </div>`;
      }

      // ─── Liste (Plätze ab nach allen #1-Geteilten) ───
      // Olympische Ränge: Position des ersten Eintrags mit gleichem sort + 1
      const rankOf = (i) => {
        for(let j=0; j<=i; j++) if(arr[j].sort === arr[i].sort) return j+1;
        return i+1;
      };
      const MAX_LIST = 6;
      const byRank = {};
      const orderRanks = [];
      // Bei geteiltem #1 starten wir die Liste hinter allen geteilten Plätzen
      const listStart = topGroup.length;
      for(let i=listStart; i<arr.length; i++){
        const rk = rankOf(i);
        if(!byRank[rk]){ byRank[rk] = []; orderRanks.push(rk); }
        byRank[rk].push(arr[i]);
        if(Object.values(byRank).reduce((a,b)=>a+b.length,0) >= MAX_LIST) break;
      }

      const listItems = [];
      const shameCls = isNeg ? 'shame' : '';
      for(const rk of orderRanks){
        const entries = byRank[rk];
        if(entries.length === 1){
          const e = entries[0];
          const avHtml = isTeamAward ? awLiPair(e.ids[0],e.ids[1]) : awLiAv(e.ids[0], false, isNeg);
          const clickAttr = isTeamAward
            ? `data-li-team="${esc(e.ids.slice().sort().join('|'))}"`
            : `data-li-player="${esc(e.ids[0])}"`;
          listItems.push(`
            <div class="aw-li ${shameCls}" ${clickAttr}>
              <div class="aw-li-rank">${rk}.</div>
              ${avHtml}
              <div class="aw-li-info">
                <div class="aw-li-name">${esc(e.name)}</div>
              </div>
              <div class="aw-li-val">${esc(e.val)}</div>
            </div>
          `);
        } else {
          const tiedRows = entries.map(e => {
            const avHtml = isTeamAward ? awLiPair(e.ids[0],e.ids[1],true) : awLiAv(e.ids[0], true, isNeg);
            const clickAttr = isTeamAward
              ? `data-li-team="${esc(e.ids.slice().sort().join('|'))}"`
              : `data-li-player="${esc(e.ids[0])}"`;
            return `
              <div class="aw-li-tied-row" ${clickAttr}>
                ${avHtml}
                <div class="aw-li-info">
                  <div class="aw-li-name">${esc(e.name)}</div>
                </div>
              </div>`;
          }).join('');
          listItems.push(`
            <div class="aw-li tied ${shameCls}">
              <div class="aw-li-rank">${rk}.</div>
              <div class="aw-li-tied-stack">
                ${tiedRows}
                <span class="aw-li-tie-badge">Geteilt · ${entries.length} ${isTeamAward?'Teams':'Spieler'}</span>
              </div>
              <div class="aw-li-val">${esc(entries[0].val)}</div>
            </div>`);
        }
      }

      const listLabel = isNeg ? 'Weitere Sünder' : 'Weitere Plätze';
      bodyHtml = heroHtml + (listItems.length
        ? `<div class="aw-list-label">${listLabel}</div><div class="aw-list">${listItems.join('')}</div>`
        : '');
    }
  }

  const heroCls = meta.cls || 'gold';

  openSheet(`
    <div class="aw-hero-icon">
      <div class="aw-hero-icon-glow ${heroCls}">
        <svg viewBox="0 0 24 24">${ICONS[AW_IC[key]||'trophy']||''}</svg>
      </div>
      <div class="aw-hero-title">${meta.title}</div>
      <div class="aw-hero-sub">${pl}</div>
    </div>
    ${bodyHtml}
    <div class="aw-why">
      <div class="aw-why-ic"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16v.5"/></svg></div>
      <div class="aw-why-content">
        <div class="aw-why-label">So wird gewertet</div>
        <div class="aw-why-body">${meta.why}</div>
      </div>
    </div>`);

  // Match-Card klickbar
  if(MATCH_AWARDS.has(key)){
    const arr = key==='upset' ? R.upsets : R.biggest;
    if(arr&&arr.length){
      const el = document.querySelector('.aw-match');
      if(el){ el.style.cursor='pointer'; el.onclick=()=>{ sheetNav(()=>showMatchDetail(arr[0].m.id)); }; }
    }
  }
  // Favoritenschreck: Hauptkarte führt zum Match-Detail
  if(FAVS_AWARDS.has(key)){
    const arr = R.favoritenschreckList;
    if(arr && arr.length){
      const el = document.querySelector('.aw-match');
      if(el){ el.style.cursor='pointer'; el.onclick=()=>{ sheetNav(()=>showMatchDetail(arr[0].m.id)); }; }
    }
  }
  // Erzfeinde: die zwei Team-Boxen tragen data-li-team und werden durch den
  // generischen Team-Handler unten (querySelectorAll[data-li-team]) klickbar.

  // Listen-Einträge klickbar
  document.querySelectorAll('.aw-li[data-li-player], .aw-li-tied-row[data-li-player], .aw-winner[data-li-player], .aw-winner-tied-entry[data-li-player]').forEach(el=>{
    el.style.cursor='pointer';
    el.onclick=()=>{ const pid=el.dataset.liPlayer; sheetNav(()=>showPlayer(pid)); };
  });
  document.querySelectorAll('.aw-li[data-li-team], .aw-li-tied-row[data-li-team], .aw-winner[data-li-team], .aw-winner-tied-entry[data-li-team], .aw-match-team[data-li-team]').forEach(el=>{
    el.style.cursor='pointer';
    el.onclick=(ev)=>{ ev.stopPropagation(); const [a,b]=el.dataset.liTeam.split('|'); sheetNav(()=>showTeam(a,b)); };
  });
}


function dedupeBy(arr,keyFn){const seen=new Set(),out=[];for(const x of arr){const k=keyFn(x);if(seen.has(k))continue;seen.add(k);out.push(x);}return out;}
function mscoreLabel(m){return m.score_a+':'+m.score_b;}

