// ╔═══ §3.4 ─── SAISON-POSITIONSVERLAUF (§C21 UI) ──────────────────────╗
//     Bottom-Sheet mit Liniendiagramm der Tabellenpositionen über die
//     Tage der aktuellen Saison. Hervorhebung per Tap auf Linie/Endpunkt-
//     Avatar — Detail-Karte zeigt selektierten Spieler. CSS-Toggle für
//     Highlight, kein Re-Render der SVG-Lines bei jedem Tap.
// ╚═════════════════════════════════════════════════════════════════════════╝

// Avatar-Helper für SVG: liefert ein <g>-Element mit Emoji ODER Initialen-Kreis.
// transform="translate(cx, cy)" wird vom Caller gesetzt; hier nur der innere Markup.
function _posvAvSvg(player, color, dataPid){
  const r = 11;
  if(!player){
    return `<g class="posv-end-av" data-pid="${esc(dataPid)}">
      <circle r="${r}" fill="var(--surface3)" stroke="${color}" stroke-width="1.5"/>
      <text text-anchor="middle" dominant-baseline="central" fill="var(--muted)" font-size="13" font-family="'Archivo Black',sans-serif">?</text>
    </g>`;
  }
  const em = player.avatar_id ? avatarEmoji(player.avatar_id) : null;
  if(em){
    return `<g class="posv-end-av" data-pid="${esc(dataPid)}">
      <circle r="${r}" fill="var(--surface3)" stroke="${color}" stroke-width="1.5"/>
      <text text-anchor="middle" dominant-baseline="central" font-size="14"
        font-family="'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji','Twemoji Mozilla',sans-serif">${em}</text>
    </g>`;
  }
  return `<g class="posv-end-av" data-pid="${esc(dataPid)}">
    <circle r="${r}" fill="${avColor(player.id)}" stroke="${color}" stroke-width="1.5"/>
    <text text-anchor="middle" dominant-baseline="central" fill="#0a0c0b" font-size="10"
      font-family="'Archivo Black',sans-serif">${esc(initials(player.name))}</text>
  </g>`;
}

// Baut das komplette SVG für den Positionsverlauf. Eine Funktion, ein String —
// kein DOM-Build aus Performance-Gründen. Highlight wird via CSS-Klassen-Toggle
// nachträglich angewendet.
function _buildPositionChartSvg(data){
  const VB_W = 360, VB_H = 280;
  const ML = 24, MR = 92, MT = 10, MB = 30;
  const PW = VB_W - ML - MR;
  const PH = VB_H - MT - MB;
  const N = data.activeIds.length; // Anzahl Positions-Slots
  const D = data.lastDay;

  // Edge: nur 1 Spieler → Linie wäre konstant Position 1, kaum sinnvoll, aber rendern wir
  // Edge: lastDay=1 → ein einzelner Punkt pro Spieler, X-Mitte
  const xOf = day => ML + (D <= 1 ? PW/2 : (day-1)/(D-1) * PW);
  const yOf = pos => MT + (N <= 1 ? PH/2 : (pos-1)/(N-1) * PH);

  // ── Grid: horizontale Linie pro Position
  let grid = '';
  for(let p=1; p<=N; p++){
    const y = yOf(p);
    grid += `<line x1="${ML}" y1="${y}" x2="${ML+PW}" y2="${y}"/>`;
  }
  // ── Y-Achse Ticks: jede Position
  let yTicks = '';
  for(let p=1; p<=N; p++){
    yTicks += `<text class="posv-y-tick" x="${ML-7}" y="${yOf(p)}">${p}</text>`;
  }
  // ── X-Achse Ticks: smart spacing — bei ≤7 Tagen jeder Tag, sonst 1,5,10,15,…
  let xTicks = '';
  const tickDays = [];
  if(D <= 7){
    for(let d=1; d<=D; d++) tickDays.push(d);
  } else {
    tickDays.push(1);
    for(let d=5; d<=D; d+=5) tickDays.push(d);
    if(tickDays[tickDays.length-1] !== D) tickDays.push(D); // Endpunkt immer
  }
  // Dedup
  const seenTicks = new Set();
  tickDays.filter(d => !seenTicks.has(d) && seenTicks.add(d)).forEach(d => {
    xTicks += `<text class="posv-x-tick" x="${xOf(d)}" y="${MT+PH+18}">${d}</text>`;
  });
  // X-Achsen-Caption "Tag" links unten
  const xCap = `<text class="posv-axis-cap" x="0" y="${MT+PH+18}">Tag</text>`;

  // ── Linien + Dots + Endpunkte pro Spieler
  // Sortierung: Endpunkt-Position aufsteigend (Position 1 oben zuerst) — verhindert
  // dass Avatar-Labels sich willkürlich überdecken; oben startet die Reihenfolge.
  const playersByEndPos = data.activeIds
    .map(id => {
      // Letzter nicht-null Wert im positionsByDay-Array
      const arr = data.positionsByDay[id];
      let lastVal = null, lastDayIdx = -1;
      for(let i=arr.length-1; i>=0; i--){
        if(arr[i] !== null){ lastVal = arr[i]; lastDayIdx = i; break; }
      }
      return {id, lastPos: lastVal, lastDayIdx};
    })
    .filter(o => o.lastPos !== null)
    .sort((a,b)=> a.lastPos - b.lastPos);

  let lines = '', hits = '', dots = '', ends = '';
  const pm = pmap();
  for(const o of playersByEndPos){
    const pid = o.id;
    const color = data.colorOf[pid] || '#888';
    const arr = data.positionsByDay[pid];
    // Pfad bauen: nur nicht-null-Punkte verbinden
    const pts = [];
    for(let i=0; i<arr.length; i++){
      if(arr[i] !== null){
        pts.push({x: xOf(i+1), y: yOf(arr[i])});
      }
    }
    if(pts.length === 0) continue;
    let d;
    if(pts.length === 1){
      // Single point — Mini-Strich für Sichtbarkeit
      d = `M ${pts[0].x-2} ${pts[0].y} L ${pts[0].x+2} ${pts[0].y}`;
    } else {
      d = 'M ' + pts.map(p => `${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' L ');
    }
    // Visible line
    lines += `<path class="posv-line" data-pid="${esc(pid)}" d="${d}" stroke="${color}"/>`;
    // Hit area (transparent, breit für Touch)
    hits  += `<path class="posv-line-hit" data-pid="${esc(pid)}" d="${d}"/>`;
    // Dots an jedem Datenpunkt — klein, am Endpunkt größer
    for(let i=0; i<pts.length; i++){
      const r = (i === pts.length-1) ? 3.2 : 2;
      dots += `<circle class="posv-dot" data-pid="${esc(pid)}" cx="${pts[i].x.toFixed(1)}" cy="${pts[i].y.toFixed(1)}" r="${r}" fill="${color}"/>`;
    }
    // Endpunkt: Avatar + Name. Avatar bei xEnd+12, Name dahinter.
    const xEnd = pts[pts.length-1].x;
    const yEnd = pts[pts.length-1].y;
    const avX = Math.min(xEnd + 16, VB_W - 72); // nicht ins Right-Margin reinrennen
    const labelX = avX + 14;
    const p = pm[pid];
    const name = p ? p.name : '?';
    ends += `<g transform="translate(${avX.toFixed(1)},${yEnd.toFixed(1)})">${_posvAvSvg(p, color, pid)}</g>`;
    // Name-Text nach rechts; clipt am Right-Edge via maxlength
    const shortName = name.length > 8 ? name.slice(0,8)+'…' : name;
    ends += `<text class="posv-end-label" data-pid="${esc(pid)}" x="${labelX.toFixed(1)}" y="${yEnd.toFixed(1)}">${esc(shortName)}</text>`;
  }

  return `<svg class="posv-svg" viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMinYMin meet" xmlns="http://www.w3.org/2000/svg">
    <g class="posv-grid">${grid}</g>
    ${yTicks}
    ${xCap}${xTicks}
    <g>${hits}</g>
    <g>${lines}</g>
    <g>${dots}</g>
    <g>${ends}</g>
  </svg>`;
}

// Detail-Karte unten: zeigt entweder Empty-State oder Stats des hervorgehobenen
// Spielers. innerHTML-Update, kein Sheet-Re-Render.
function _renderPosvDetail(el, data, hlId){
  const stats = getSeasonPlayerStats(data.seasonId);
  if(!hlId){
    el.classList.add('empty');
    el.innerHTML = `<div class="posv-detail-empty-text">Tippe auf eine Linie oder einen Avatar,<br>um Details zu sehen.</div>`;
    return;
  }
  el.classList.remove('empty');
  const p = pmap()[hlId];
  const arr = data.positionsByDay[hlId] || [];
  // Aktuelle Position = letzter nicht-null Wert
  let curPos = '–';
  for(let i=arr.length-1; i>=0; i--){ if(arr[i] !== null){ curPos = arr[i]; break; } }
  const elo = data.finalElo[hlId];
  const eloStr = (elo===undefined) ? '–' : Math.round(elo);
  const s = stats[hlId] || {wins:0,losses:0,games:0};
  const balance = `${s.wins}–${s.losses}`;
  const quote = s.games ? Math.round(s.wins/s.games*100)+'%' : '–';
  const color = data.colorOf[hlId] || '#888';

  let avInner;
  if(p && p.avatar_id){
    const em = avatarEmoji(p.avatar_id);
    avInner = `<span class="em">${em}</span>`;
  } else if(p){
    avInner = esc(initials(p.name));
  } else {
    avInner = '?';
  }
  const avBg = p && p.avatar_id ? 'var(--surface3)' : (p ? avColor(p.id) : 'var(--surface3)');

  el.innerHTML = `
    <div class="posv-detail-head">
      <div class="posv-detail-av" style="background:${avBg};border-color:${color}">${avInner}</div>
      <div class="posv-detail-name-wrap">
        <div class="posv-detail-name">${esc(p ? p.name : '?')}</div>
        <span class="posv-detail-dot" style="background:${color}"></span>
      </div>
    </div>
    <div class="posv-detail-stats">
      <div class="posv-detail-stat">
        <div class="posv-detail-stat-label">Position</div>
        <div class="posv-detail-stat-val">${curPos}.</div>
      </div>
      <div class="posv-detail-stat">
        <div class="posv-detail-stat-label">Elo</div>
        <div class="posv-detail-stat-val">${eloStr}</div>
      </div>
      <div class="posv-detail-stat">
        <div class="posv-detail-stat-label">Bilanz</div>
        <div class="posv-detail-stat-val">${balance}</div>
      </div>
      <div class="posv-detail-stat">
        <div class="posv-detail-stat-label">Quote</div>
        <div class="posv-detail-stat-val">${quote}</div>
      </div>
    </div>
  `;
}

// Highlight-Logik: zentraler Click-Handler auf das Sheet-Root via Event-Delegation,
// damit wir keine pro-Element-Listener leaken müssen und SVG-Elemente innerhalb
// nachträglich gewechselt werden können.
function _attachPosvHighlight(rootEl, data){
  const chartHost = rootEl.querySelector('.posv-chart-host');
  const detailEl  = rootEl.querySelector('#posvDetail');
  let curHl = null;

  function applyHl(pid){
    if(pid && pid === curHl) pid = null; // gleiche Linie nochmal → reset
    curHl = pid;
    // Highlight-Klassen toggeln
    chartHost.classList.toggle('posv-dim', !!pid);
    chartHost.querySelectorAll('.hl').forEach(el => el.classList.remove('hl'));
    if(pid){
      chartHost.querySelectorAll(`[data-pid="${CSS.escape(pid)}"]`)
        .forEach(el => el.classList.add('hl'));
    }
    _renderPosvDetail(detailEl, data, pid);
  }

  rootEl.addEventListener('click', (e) => {
    // Erstes Element mit data-pid in Aufstiegskette (für SVG-Click-Targets innerhalb von <g>)
    let target = e.target;
    let pid = null;
    while(target && target !== rootEl){
      if(target.dataset && target.dataset.pid){ pid = target.dataset.pid; break; }
      target = target.parentNode;
    }
    if(pid){
      e.stopPropagation();
      applyHl(pid);
      return;
    }
    // Click auf leeren Chart-Bereich → reset
    if(curHl && chartHost.contains(e.target)){
      applyHl(null);
    }
  });
}

// Hauptfunktion: öffnet das Sheet. Saison-Argument optional (default: aktuelle).
function showPositionHistory(seasonId){
  if(!seasonId) seasonId = currentSeason().id;
  _sheetSetReopen(()=>showPositionHistory(seasonId));
  const data = getSeasonPositionHistory(seasonId);
  const sLabel = seasonLabel(seasonId);

  // Empty-State: keine Saison-Matches
  if(data.empty || data.activeIds.length === 0 || data.lastDay === 0){
    openSheet(`
      <div class="posv-empty">
        <div class="posv-empty-title">Noch kein Verlauf</div>
        <div>Sobald in dieser Saison die ersten Matches gespielt sind,<br>siehst du hier die Entwicklung der Tabellenpositionen.</div>
      </div>
    `);
    return;
  }

  const headerDate = new Date().toLocaleString('de-DE',{hour:'2-digit',minute:'2-digit'});
  const subInfo = data.isCurrent
    ? `${sLabel} · Tag ${data.lastDay} von ${data.totalDays}`
    : `${sLabel} · Saison abgeschlossen`;

  openSheet(`
    <div style="padding:6px 4px 8px">
      <h2 style="font-family:'Archivo Black',sans-serif;font-size:22px;letter-spacing:-.02em;margin-bottom:4px">Saison-Positionsverlauf</h2>
      <div style="color:var(--muted);font-size:12px;margin-bottom:14px">Entwicklung der Tabellenplatzierungen während der Saison</div>

      <div class="posv-info-pill">
        <div class="posv-info-ic">
          <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
        </div>
        <div class="posv-info-text">
          <div class="posv-info-title">${data.isCurrent ? 'Aktuelle Saison' : 'Vergangene Saison'}</div>
          <div class="posv-info-sub">${esc(subInfo)}</div>
        </div>
      </div>

      <div class="posv-chart-host" id="posvChartHost">
        <div class="posv-chart-axislabel">Position</div>
        ${_buildPositionChartSvg(data)}
      </div>

      <div class="posv-hint">Tippe auf einen Spieler, um ihn hervorzuheben</div>

      <div class="posv-detail empty" id="posvDetail">
        <div class="posv-detail-empty-text">Tippe auf eine Linie oder einen Avatar,<br>um Details zu sehen.</div>
      </div>

      <div class="posv-update">
        <span>Letztes Update: Heute, ${headerDate}</span>
        <button class="posv-refresh" id="posvRefreshBtn" title="Aktualisieren">
          <svg viewBox="0 0 24 24"><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.3L3 16M3 21v-5h5"/></svg>
        </button>
      </div>
    </div>
  `);

  const sheet = document.getElementById('sheet');
  _attachPosvHighlight(sheet, data);

  // Refresh: kurze Spin-Animation + Sheet neu rendern (Cache wird nicht hart
  // invalidiert — neuer Build via aktualisiertem Zeitstempel reicht, alle Daten
  // sind durch invalidateCache(['global', …]) nach jedem Match eh schon frisch).
  const refreshBtn = sheet.querySelector('#posvRefreshBtn');
  if(refreshBtn){
    refreshBtn.onclick = (e) => {
      e.stopPropagation();
      refreshBtn.classList.add('spin');
      setTimeout(()=>{
        refreshBtn.classList.remove('spin');
        showPositionHistory(seasonId);
      }, 380);
    };
  }
}


// HIER BEGINNT DER KORRIGIERTE showPotwRecap FUNKTIONSBLOCK
// opts.auto=true → Schutz-Phase aktiv (gegen versehentliches Schließen beim
// Auto-Trigger am Wochenanfang). Beim manuellen Aufruf via Hall-of-Fame-Button
// bleibt opts.auto leer → keine Schutz-Phase, sofort schließbar.
function showPotwRecap(opts){
  opts = opts || {};
  _sheetSetReopen(()=>showPotwRecap());
  try{
    const {start:weekStart, end:weekEnd}=_potwLastWeekRange();
    const ms=_potwMatchesInRange(weekStart,weekEnd);
    const wkKey=_potwKeyOf(weekStart);
    if(!ms.length){ toast('Letzte Woche keine Spiele','info'); return; }

    // Spieler-Stats für die Woche (inkl. längster Serie innerhalb der Woche)
    const ps={}; // player stats
    const run={}; // current streak
    const defStats={}; // defender stats for 'Eiserne Abwehr'
    const teamGames={}; // for Team of the Week
    const teamWins={};
    const teamEloDeltaRaw={}; // raw Elo delta for teams in this week

    const pm=pmap(); // Player map for quick lookup

    const orderedMatchesForWeek = [...ms].sort((a,b)=>mts(a)-mts(b));

    // Cache-Schlüssel: pro Woche + Match-Count + Cache-Version
    const weekSimKey = 'potwSim_'+wkKey+'_'+matches.length+'_'+_cache.version;
    let weekSim;
    if(_cache._potwSim && _cache._potwSimKey === weekSimKey){
      weekSim = _cache._potwSim;
    } else {
      // Temporäre Elo-Simulation für die Woche, um Team-Elo-Deltas zu erhalten
      // Starte von einem neutralen Zustand, da wir nur die Elo-Änderungen *innerhalb* der Woche wollen
      weekSim = simulateElo(orderedMatchesForWeek, {
        initialState: {
          elo: Object.fromEntries(players.map(p => [p.id, cfg.start_elo])),
          played: Object.fromEntries(players.map(p => [p.id, 0])),
          playedSeason: Object.fromEntries(players.map(p => [p.id, 0])),
          wins: Object.fromEntries(players.map(p => [p.id, 0])),
          losses: Object.fromEntries(players.map(p => [p.id, 0])),
          curStreak: Object.fromEntries(players.map(p => [p.id, 0])),
          bestStreak: Object.fromEntries(players.map(p => [p.id, 0])),
          eloGain: Object.fromEntries(players.map(p => [p.id, 0])),
          eloLoss: Object.fromEntries(players.map(p => [p.id, 0])),
          gd: Object.fromEntries(players.map(p => [p.id, 0])),
          teamElo: {},
          seasonTeamElo: {},
          history: [],
          seasonEndElos: {},
          seasonPlayed: {},
          careerElo: {},
          posTracker: {}, 
          curSeason: null
        },
        startElo: cfg.start_elo
      });
      _cache._potwSim = weekSim;
      _cache._potwSimKey = weekSimKey;
    }

    // History-Lookup einmalig für O(1) Zugriff (statt history.find pro Match)
    const weekHistById = new Map();
    for(let i=0; i<weekSim.history.length; i++){
      weekHistById.set(weekSim.history[i].matchId, weekSim.history[i]);
    }

    orderedMatchesForWeek.forEach(m=>{
      const aWon=m.winner==='A';
      // Player stats
      [m.a1,m.a2,m.b1,m.b2].forEach(id=>{
        if(!ps[id]) ps[id]={wins:0,losses:0,gf:0,ga:0,eloDelta:0,bestStreak:0,defG:0,defGa:0};
        if(run[id]===undefined) run[id]=0;
        const onA=(id===m.a1||id===m.a2);
        const won=(onA&&aWon)||(!onA&&!aWon);
        const gf=onA?m.score_a:m.score_b, ga=onA?m.score_b:m.score_a;
        const d=(m.deltas&&m.deltas[id])||0; // Original delta aus DB
        ps[id].gf+=gf; ps[id].ga+=ga; ps[id].eloDelta+=d;
        if(won){ ps[id].wins++; run[id]=run[id]>=0?run[id]+1:1; }
        else  { ps[id].losses++; run[id]=run[id]<=0?run[id]-1:-1; }
        if(run[id]>ps[id].bestStreak) ps[id].bestStreak=run[id];

        // Defender-Stats
        const pos=id===m.a1?m.a1_pos:id===m.a2?m.a2_pos:id===m.b1?m.b1_pos:m.b2_pos;
        if(pos==='def'){
          if(!defStats[id]) defStats[id]={games:0,goalsAgainst:0};
          defStats[id].games++;
          defStats[id].goalsAgainst+=ga;
        }
      });

      // Team-Stats
      [[m.a1,m.a2,m.winner==='A'],[m.b1,m.b2,m.winner==='B']]
      .forEach(([p1,p2,wonTeam])=>{
        const k=[p1,p2].sort().join('|');
        if(!teamGames[k]) teamGames[k]=0;
        if(!teamWins[k]) teamWins[k]=0;
        if(!teamEloDeltaRaw[k]) teamEloDeltaRaw[k]=0;

        teamGames[k]++;
        if(wonTeam) teamWins[k]++;

        const matchHistoryEntry = weekHistById.get(m.id);
        if (matchHistoryEntry) {
            teamEloDeltaRaw[k] += (matchHistoryEntry.deltas[p1] || 0) + (matchHistoryEntry.deltas[p2] || 0);
        }
      });
    });

    // POTW ermitteln — gleiche Regel wie Achievement (countPeriodWins):
    // Min 5 Siege in der Woche, höchste Winrate gewinnt.
    // Tiebreaker bei Gleichstand auf Winrate: mehr absolute Siege, dann mehr Elo-Delta.
    const POTW_MIN_WINS = 5;
    const candidates = Object.entries(ps)
      .filter(([id,s]) => s.wins >= POTW_MIN_WINS && pm[id] && !pm[id].hidden)
      .map(([id,s]) => {
        const games = s.wins + s.losses;
        return [id, s, games ? s.wins/games : 0];
      })
      .sort((a,b) => {
        if(b[2] !== a[2]) return b[2] - a[2];               // winrate desc
        if(b[1].wins !== a[1].wins) return b[1].wins - a[1].wins;
        return b[1].eloDelta - a[1].eloDelta;
      });

    let potwWinners = [];
    if (candidates.length > 0) {
      const topWr = candidates[0][2];
      // Geteilte POTW: jeder mit ≥ Min-Siegen und gleicher Winrate (mit kleinem Epsilon
      // gegen Floating-Point-Rundungsfehler — analog zu countPeriodWins).
      potwWinners = candidates.filter(c => Math.abs(c[2] - topWr) < 0.001);
    }
    
    if (!potwWinners.length) { toast('Kein POTW in Vorwoche', 'info'); return; }

    const mainPotwPlayerId = potwWinners[0][0];
    const mainPotwStats = potwWinners[0][1];
    const mainPotwPlayer = pm[mainPotwPlayerId];
    if (!mainPotwPlayer) { toast('Kein POTW in Vorwoche', 'info'); return; }

    const weekLabel='KW '+isoWeek(weekStart);
    const sundayDate=new Date(weekEnd);
    const dateRange=weekStart.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})
      +'–'+sundayDate.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'});
    const games=mainPotwStats.wins+mainPotwStats.losses;
    const winrate=games?Math.round((mainPotwStats.wins/games)*100):0;
    const eloDelta=Math.round(mainPotwStats.eloDelta);
    const eloDeltaStr=(eloDelta>=0?'+':'')+eloDelta;

    const uniquePlayers=new Set();
    ms.forEach(m=>[m.a1,m.a2,m.b1,m.b2].forEach(id=>uniquePlayers.add(id)));
    const totalGoals=ms.reduce((a,m)=>a+(m.score_a||0)+(m.score_b||0),0);

    // Mini-Highlights
    const wkAtk={};
    ms.forEach(m=>{
      const strikersInA = [];
      if (m.a1_pos === 'atk') strikersInA.push(m.a1);
      if (m.a2_pos === 'atk') strikersInA.push(m.a2);

      const strikersInB = [];
      if (m.b1_pos === 'atk') strikersInB.push(m.b1);
      if (m.b2_pos === 'atk') strikersInB.push(m.b2);

      strikersInA.forEach(id => {
          if (!wkAtk[id]) wkAtk[id] = { g: 0, goals: 0 };
          wkAtk[id].g++; wkAtk[id].goals += m.score_a;
      });
      strikersInB.forEach(id => {
          if (!wkAtk[id]) wkAtk[id] = { g: 0, goals: 0 };
          wkAtk[id].g++; wkAtk[id].goals += m.score_b;
      });
    });

    const scorerArr=Object.entries(wkAtk).filter(([,v])=>v.g>=1)
      .map(([id,x])=>({id,gf:x.goals,g:x.g,avg:x.goals/x.g})).sort((a,b)=>b.avg-a.avg||b.gf-a.gf);
    const topScorer=scorerArr[0] && scorerArr[0].gf>0 ? scorerArr[0] : null;

    const bestDefenderArr=Object.entries(defStats)
      .filter(([,s])=>s.games>=2)
      .map(([id,s])=>({id,games:s.games,goalsAgainst:s.goalsAgainst,avg:s.goalsAgainst/s.games}))
      .sort((a,b)=>a.avg-b.avg||a.goalsAgainst-b.goalsAgainst);
    const bestDefender=bestDefenderArr[0];

    const biggestEloGainArr=Object.entries(ps)
      .filter(([id,s])=>s.wins+s.losses > 0 && pm[id] && !pm[id].hidden)
      .sort((a,b)=>b[1].eloDelta-a[1].eloDelta);
    const biggestEloGain=biggestEloGainArr[0];

    let topUpset=null;
    for(const m of ms){
      const sp=m.exp_a==null?0.5:m.exp_a;
      const winSp=m.winner==='A'?sp:(1-sp);
      if(winSp<0.45 && (!topUpset || winSp<topUpset.sp)) topUpset={m,sp:winSp};
    }
    const upsetNames=topUpset?
      (topUpset.m.winner==='A'?[pname(topUpset.m.a1),pname(topUpset.m.a2)]:[pname(topUpset.m.b1),pname(topUpset.m.b2)])
      :null;

    const totwCandidates = Object.entries(teamEloDeltaRaw)
      .filter(([k,v]) => {
        const ids = k.split('|');
        return teamGames[k] >= 2 && pm[ids[0]] && !pm[ids[0]].hidden && pm[ids[1]] && !pm[ids[1]].hidden;
      })
      .map(([k,v]) => ({ ids: k.split('|'), eloDelta: v, games: teamGames[k], wins: teamWins[k] }))
      .sort((a,b) => b.eloDelta - a.eloDelta || (b.wins/b.games) - (a.wins/a.games));
    const teamOfTheWeek = totwCandidates[0];

    // ─── Darstellung [§C31] ──────────────────────────────────────────
    // Dieselben Bauteile wie im Saison- und im Tages-Rückblick. Vorher
    // stand die ganze Gestaltung hier als Inline-Style: ein eigener Kopf,
    // zwei Avatar-Varianten, vier Zahlenkacheln und eine eigene Kachelform
    // — alles Dinge, die es nebenan schon gab, nur anders aussehend.
    const wkStartMs = weekStart.getTime();
    const hlKacheln = [];
    const hl = (ic, label, name, wert, attr) => hlKacheln.push(rcpKachelHtml(
      name ? {ic, label, name, wert, ton:'gold', attr} : {ic, label, leer:true}));

    hl('handshake', 'Team der Woche',
       teamOfTheWeek ? pname(teamOfTheWeek.ids[0])+' & '+pname(teamOfTheWeek.ids[1]) : null,
       teamOfTheWeek ? teamOfTheWeek.games+' Spiele · '
         +Math.round(teamOfTheWeek.wins/teamOfTheWeek.games*100)+'%' : null,
       `data-potw-award="mvt" data-potw-week="${wkStartMs}"`);
    hl('chartUp', 'Elo-Aufstieg',
       biggestEloGain ? pname(biggestEloGain[0]) : null,
       biggestEloGain ? '+'+Math.round(biggestEloGain[1].eloDelta)+' Elo' : null,
       biggestEloGain ? `data-potw-player="${esc(biggestEloGain[0])}"` : '');
    hl('ball', 'Top-Tor', topScorer ? pname(topScorer.id) : null,
       topScorer ? 'Ø '+topScorer.avg.toFixed(1)+' Tore' : null,
       `data-potw-award="scorer" data-potw-week="${wkStartMs}"`);
    hl('shieldCheck', 'Eiserne Abwehr', bestDefender ? pname(bestDefender.id) : null,
       bestDefender ? 'Ø '+bestDefender.avg.toFixed(1)+' Gegentore' : null,
       `data-potw-award="wall" data-potw-week="${wkStartMs}"`);
    hl('bolt', 'Größter Upset', (topUpset && upsetNames) ? upsetNames.join(' & ') : null,
       (topUpset && upsetNames) ? Math.round(topUpset.sp*100)+'% Chance' : null,
       `data-potw-award="upset" data-potw-week="${wkStartMs}"`);

    const serieHtml = mainPotwStats.bestStreak >= 3
      ? rcpNotizHtml({ic:'flame',
          text:`Siegesserie von <b class="num">${mainPotwStats.bestStreak}</b> Spielen am Stück`,
          attr:`data-potw-player="${esc(mainPotwPlayerId)}"`})
      : '';

    const geteilt = potwWinners.length > 1;
    openSheet(
      rcpKopfHtml({ic:'weekly', titel:weekLabel,
        marke: geteilt ? 'Players of the Week' : 'Player of the Week',
        meta: rcpMeta([dateRange, ms.length+' Matches', uniquePlayers.size+' Spieler',
                       totalGoals ? totalGoals+' Tore' : ''])})
      + rcpHeldHtml({
          pid: mainPotwPlayerId,
          pids: geteilt ? potwWinners.map(w => w[0]) : null,
          // Ohne Banner: im Schild stünde die Ligaposition von heute, und die
          // hat mit dieser Woche nichts zu tun. Der Reif bleibt — er ist die
          // Laufbahn und gehört zur Person [§C31].
          band:false, px:104, marke:'Spieler der Woche',
          zahlen: rcpZahlenHtml([
            {v:mainPotwStats.wins,   l:'Siege',       ton:'gruen'},
            {v:mainPotwStats.losses, l:'Niederlagen', ton:'rot'},
            {v:winrate+'%',          l:'Quote'},
            {v:eloDeltaStr,          l:'Elo', ton:eloDelta>=0 ? 'gruen' : 'rot'}
          ])})
      + serieHtml
      + rcpAbschnitt('Höhepunkte der Woche')
      + `<div class="rcp-awards${hlKacheln.length%2 ? ' ungerade' : ''}">${hlKacheln.join('')}</div>`
      + `<button id="closePotwBtn" class="recap-done-btn">Verstanden</button>`,
      {protectMs: opts.auto ? 2500 : 0});

    const _grab = document.getElementById('sheetGrab');
    if(_grab) _grab.classList.add('grab-pulse');
    _recapMarkSeen('potw_shown_'+wkKey, 'potw:'+wkKey);

    const wurzel = document.getElementById('sheet');
    const zu = document.getElementById('closePotwBtn');
    if(zu) zu.onclick = () => closeSheet();
    wurzel.querySelectorAll('[data-detail]').forEach(el => {
      el.onclick = () => sheetNav(()=>showPlayer(el.dataset.detail));
    });
    // Die Kacheln öffnen das Award-Detail FÜR DIESE WOCHE. Ein inline-onclick
    // ginge nicht: der ganze Code liegt in einer IIFE, showAward steht dort
    // nicht im globalen Namensraum.
    wurzel.querySelectorAll('[data-potw-award]').forEach(el => {
      el.onclick = () => sheetNav(()=>{
        awPeriod = 'week';
        awWeekStart = new Date(+el.dataset.potwWeek);
        showAward(el.dataset.potwAward);
      });
    });
    wurzel.querySelectorAll('[data-potw-player]').forEach(el => {
      el.onclick = () => sheetNav(()=>showPlayer(el.dataset.potwPlayer));
    });
  } catch(e){
    console.error('POTW Recap Fehler:',e);
  }
}
// HIER ENDET DER showPotwRecap FUNKTIONSBLOCK

// Auto-Trigger: an Mo/Di der neuen Woche einmal pro Gerät
function autoShowPotwRecap(){
  try{
    const now=new Date();
    const wd=(now.getDay()+6)%7; // 0=Mo
    if(wd>=2) return;            // nur Mo/Di
    if(!matches.length) return;
    const {start}=_potwLastWeekRange();
    const wkKey=_potwKeyOf(start);
    if(_recapSeen('potw_shown_'+wkKey, 'potw:'+wkKey)) return;
    // Sheet bereits offen?
    const sheetEl=document.getElementById('sheet');
    if(sheetEl && sheetEl.classList.contains('show')) return;
    // Saison-Recap hat Vorrang
    if(seasons.length && now.getDate()<=3){
      const last=seasons[0];
      if(last && last.id!==currentSeason().id && !_recapSeen('recap_shown_'+last.id, 'season:'+last.id)) return;
    }
    if(!potwHasData()) return;
    _autoRecapSeen.add('potw:'+wkKey); // Session-Guard gegen Wiederholung im selben Load
    showPotwRecap({auto:true});
  } catch(e){ console.error('POTW auto:',e); }
}

// Ermittelt den letzten Spieltag VOR heute, der einen POTD-Kandidaten hatte (min. 3 Siege).
// Wird sowohl vom Auto-Recap als auch vom manuellen "Letzten Tag ansehen"-Button genutzt.
// Kein eigener Cache nötig — Aufruf ist nur 1× pro Render, der Hot-Path ist Profil/Sheet.
function _potdLastDayData(){
  if(!matches.length) return null;
  const now=new Date();
  const todayStart=new Date(now); todayStart.setHours(0,0,0,0);
  const byDay={};
  for(const m of matches){
    const d=new Date(m.created_at);
    if(d>=todayStart) continue;
    const dk=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    if(!byDay[dk]) byDay[dk]=[];
    byDay[dk].push(m);
  }
  const days=Object.keys(byDay).sort().reverse();
  if(!days.length) return null;
  // Erstes Datum mit qualifiziertem Kandidat (min. 3 Siege)
  const pm=pmap();
  for(const dk of days){
    const dms=byDay[dk];
    const wins={};
    dms.forEach(m=>[m.a1,m.a2,m.b1,m.b2].forEach(id=>{
      const onA=(id===m.a1||id===m.a2);
      const w=(onA&&m.winner==='A')||(!onA&&m.winner==='B');
      if(!wins[id]) wins[id]=0;
      if(w) wins[id]++;
    }));
    const qualified=Object.entries(wins).some(([id,w])=>w>=3 && pm[id] && !pm[id].hidden);
    if(qualified) return {dayKey:dk, dayMatches:dms};
  }
  return null;
}

// True wenn es einen abgeschlossenen Spieltag mit ≥3-Siegen-Kandidat gibt (für Button-Sichtbarkeit)
function potdHasData(){ return _potdLastDayData()!==null; }

// Player-of-the-Day Recap: zeigt einmal pro Tag pro Gerät den Sieger des letzten Spieltags.
// Mit opts.force=true (vom "Letzten Tag ansehen"-Button) wird der localStorage-Check und
// das Setzen des "shown"-Flags übersprungen, damit der manuelle Aufruf den Auto-Trigger
// für heute nicht unterdrückt. Zusätzlich wird beim Force-Aufruf die Schutz-Phase
// (protectMs) deaktiviert → manueller Aufruf ist sofort per Backdrop-Klick schließbar.
function showPotdRecap(opts){
  opts = opts || {};
  _sheetSetReopen(()=>showPotdRecap());
  try{
    const now=new Date();
    if(!matches.length){ if(opts.force) toast('Keine Matches vorhanden','info'); return; }

    // v9.15 BUGFIX: Der "gesehen"-Guard hing am HEUTIGEN Datum statt am
    // recappten Spieltag. Folge: Gab es dazwischen spielfreie Tage, bekam
    // jeder neue Tag einen frischen Key und derselbe Recap (z.B. "Player of
    // the Day: Dienstag") erschien am Mittwoch UND am Donnerstag erneut.
    // Jetzt ist der Spieltag selbst der Key (analog POTW, das die recappte
    // Woche keyed) → einmal gesehen = nie wieder, egal wie viele spielfreie
    // Tage folgen. Dafür muss der letzte Spieltag VOR dem Guard ermittelt
    // werden (zentral via _potdLastDayData, identisch zum Auto-Trigger).
    const _guardDay=_potdLastDayData();
    if(!_guardDay){ if(opts.force) toast('Kein qualifizierter Spieltag','info'); return; }
    if(!opts.force && _recapSeen('potd_shown_'+_guardDay.dayKey, 'potd:'+_guardDay.dayKey)) return;

    // Konflikte vermeiden: nicht zeigen wenn ein Sheet offen ist
    // oder der Saison-Recap heute noch ansteht (Vorrang Saison-Recap).
    // Beim manuellen Force-Aufruf werden diese Auto-Trigger-Konflikte übersprungen.
    if(!opts.force){
      const sheetEl=document.getElementById('sheet');
      if(sheetEl && sheetEl.classList.contains('show')) return;
      if(seasons.length && now.getDate()<=3){
        const last=seasons[0];
        if(last && last.id!==currentSeason().id && !_recapSeen('recap_shown_'+last.id, 'season:'+last.id)) return;
      }
      // POTW hat Vorrang am Mo/Di der neuen Woche
      {
        const wd=(now.getDay()+6)%7;
        if(wd<2 && potwHasData()){
          const {start}=_potwLastWeekRange();
          if(!_recapSeen('potw_shown_'+_potwKeyOf(start), 'potw:'+_potwKeyOf(start))) return;
        }
      }
    }

    // Letzter Spieltag mit Kandidat — oben bereits ermittelt (Guard).
    const lastDay=_guardDay;
    const lastDayKey=lastDay.dayKey;
    const dayMatches=lastDay.dayMatches;

    // Spieler-Stats für diesen Tag (inkl. längster Serie innerhalb des Tages)
    const ps={};
    const run={};
    const ordered=[...dayMatches].sort((a,b)=>mts(a)-mts(b));
    ordered.forEach(m=>{
      const aWon=m.winner==='A';
      [m.a1,m.a2,m.b1,m.b2].forEach(id=>{
        if(!ps[id]) ps[id]={wins:0,losses:0,gf:0,ga:0,eloDelta:0,bestStreak:0};
        if(run[id]===undefined) run[id]=0;
        const onA=(id===m.a1||id===m.a2);
        const won=(onA&&aWon)||(!onA&&!aWon);
        const gf=onA?m.score_a:m.score_b, ga=onA?m.score_b:m.score_a;
        const d=(m.deltas&&m.deltas[id])||0;
        ps[id].gf+=gf; ps[id].ga+=ga; ps[id].eloDelta+=d;
        if(won){ ps[id].wins++; run[id]=run[id]>=0?run[id]+1:1; }
        else  { ps[id].losses++; run[id]=run[id]<=0?run[id]-1:-1; }
        if(run[id]>ps[id].bestStreak) ps[id].bestStreak=run[id];
      });
    });

    // Player of the Day: min. 3 Siege, Tiebreak via Elo-Delta des Tages.
    const pm=pmap();
    const candidates=Object.entries(ps)
      .filter(([id,s])=> s.wins>=3 && pm[id] && !pm[id].hidden)
      .sort((a,b)=>{
        if(b[1].wins!==a[1].wins) return b[1].wins-a[1].wins;
        return b[1].eloDelta-a[1].eloDelta;
      });
    if(!candidates.length) return;

    const potdId=candidates[0][0];
    const s=candidates[0][1];
    const player=pm[potdId];
    if(!player) return;

    // Datum sprachlich aufbereiten
    const [yy,mm,dd]=lastDayKey.split('-').map(Number);
    const dt=new Date(yy,mm-1,dd);
    const dayStr=dt.toLocaleDateString('de-DE',{weekday:'long',day:'numeric',month:'long'});

    // Anzeige-Werte
    const games=s.wins+s.losses;
    const winrate=games?Math.round((s.wins/games)*100):0;
    const eloDelta=Math.round(s.eloDelta);
    const eloDeltaStr=(eloDelta>=0?'+':'')+eloDelta;

    const uniquePlayers=new Set();
    dayMatches.forEach(m=>[m.a1,m.a2,m.b1,m.b2].forEach(id=>uniquePlayers.add(id)));

    // ─── Höhepunkte des Spieltags ────────────────────────────────────
    // Der Tages-Rückblick zeigte bisher nur den Sieger und vier Zahlen.
    // Ein Spieltag hat aber dieselben Geschichten wie eine Woche, nur
    // kürzer — dieselben drei Kacheln, aus denselben Daten gerechnet.
    const tagAtk = {};
    dayMatches.forEach(m => {
      [[m.a1,m.a1_pos,m.score_a],[m.a2,m.a2_pos,m.score_a],
       [m.b1,m.b1_pos,m.score_b],[m.b2,m.b2_pos,m.score_b]].forEach(([id,pos,tore]) => {
        if(pos !== 'atk') return;
        if(!tagAtk[id]) tagAtk[id] = {g:0, goals:0};
        tagAtk[id].g++; tagAtk[id].goals += tore;
      });
    });
    const tagScorer = Object.keys(tagAtk)
      .map(id => ({id, g:tagAtk[id].g, goals:tagAtk[id].goals, avg:tagAtk[id].goals/tagAtk[id].g}))
      .filter(x => x.goals > 0 && pm[x.id] && !pm[x.id].hidden)
      .sort((a,b) => b.avg - a.avg || b.goals - a.goals)[0];

    const tagAufstieg = Object.keys(ps)
      .filter(id => pm[id] && !pm[id].hidden && ps[id].eloDelta > 0)
      .map(id => ({id, d:Math.round(ps[id].eloDelta)}))
      .sort((a,b) => b.d - a.d)[0];

    let tagUpset = null;
    for(const m of dayMatches){
      const sp = m.exp_a == null ? 0.5 : m.exp_a;
      const chance = m.winner === 'A' ? sp : (1 - sp);
      if(chance < 0.45 && (!tagUpset || chance < tagUpset.chance)) tagUpset = {m, chance};
    }
    const upsetSieger = tagUpset
      ? (tagUpset.m.winner === 'A' ? [tagUpset.m.a1, tagUpset.m.a2] : [tagUpset.m.b1, tagUpset.m.b2])
      : null;

    const tagKacheln = [];
    const tagHl = (ic, label, name, wert, attr) => tagKacheln.push(rcpKachelHtml(
      name ? {ic, label, name, wert, ton:'gold', attr} : {ic, label, leer:true}));
    tagHl('ball', 'Top-Tor', tagScorer ? pname(tagScorer.id) : null,
          tagScorer ? 'Ø '+tagScorer.avg.toFixed(1)+' Tore' : null,
          tagScorer ? `data-potd-player="${esc(tagScorer.id)}"` : '');
    tagHl('chartUp', 'Elo-Aufstieg', tagAufstieg ? pname(tagAufstieg.id) : null,
          tagAufstieg ? '+'+tagAufstieg.d+' Elo' : null,
          tagAufstieg ? `data-potd-player="${esc(tagAufstieg.id)}"` : '');
    tagHl('bolt', 'Größter Upset', upsetSieger ? pname(upsetSieger[0])+' & '+pname(upsetSieger[1]) : null,
          tagUpset ? Math.round(tagUpset.chance*100)+'% Chance' : null,
          upsetSieger ? `data-potd-team="${esc(upsetSieger.slice().sort().join('|'))}"` : '');

    const serieHtml = s.bestStreak >= 3
      ? rcpNotizHtml({ic:'flame',
          text:`Siegesserie von <b class="num">${s.bestStreak}</b> Spielen am Stück`})
      : '';

    openSheet(
      rcpKopfHtml({ic:'trophyDay', marke:'Player of the Day', titel:dayStr,
        meta: rcpMeta([dayMatches.length+' Matches', uniquePlayers.size+' Spieler'])})
      + rcpHeldHtml({pid:potdId, band:false, px:104, marke:'Spieler des Tages',
          zahlen: rcpZahlenHtml([
            {v:s.wins,      l:'Siege',       ton:'gruen'},
            {v:s.losses,    l:'Niederlagen', ton:'rot'},
            {v:winrate+'%', l:'Quote'},
            {v:eloDeltaStr, l:'Elo', ton:eloDelta>=0 ? 'gruen' : 'rot'}
          ])})
      + serieHtml
      + rcpAbschnitt('Höhepunkte des Tages')
      + `<div class="rcp-awards${tagKacheln.length%2 ? ' ungerade' : ''}">${tagKacheln.join('')}</div>`
      + `<button id="closePotdBtn" class="recap-done-btn">Verstanden</button>`,
      {protectMs: opts.force ? 0 : 2500});

    const _grab = document.getElementById('sheetGrab');
    if(_grab) _grab.classList.add('grab-pulse');

    // Flag SOFORT setzen — sonst löst Wegwischen beim nächsten Laden erneut
    // aus. Beim manuellen Aufruf („Letzten Tag ansehen") NICHT, damit der
    // automatische Rückblick für heute später noch kommen darf.
    if(!opts.force) _recapMarkSeen('potd_shown_'+lastDayKey, 'potd:'+lastDayKey);
    const wurzel = document.getElementById('sheet');
    const zu = document.getElementById('closePotdBtn');
    if(zu) zu.onclick = () => closeSheet();
    wurzel.querySelectorAll('[data-detail],[data-potd-player]').forEach(el => {
      el.onclick = () => sheetNav(()=>showPlayer(el.dataset.detail || el.dataset.potdPlayer));
    });
    wurzel.querySelectorAll('[data-potd-team]').forEach(el => {
      const paar = el.dataset.potdTeam.split('|');
      el.onclick = () => sheetNav(()=>showTeam(paar[0], paar[1]));
    });
  } catch(e){
    console.error('POTD Recap Fehler:',e);
  }
}

function setConn(t,c){document.getElementById('connText').textContent=t;document.getElementById('connDot').className='dot '+c;}
function allPlayerStats(){
  const key='allStats_'+matches.length+'_'+_cache.version;
  if(_cache._allStatsKey===key) return _cache._allStatsData;
  
  const stats={};
  const run={};
  
  // Initialisierung: nur aktive Spieler (verringert die Anzahl der zu verarbeitenden IDs)
  const activeIds = new Set(players.filter(p=>!p.hidden).map(p=>p.id));
  activeIds.forEach(id=>{
    stats[id]={games:0,wins:0,losses:0,gf:0,ga:0,
      atkG:0,atkW:0,defG:0,defW:0,
      atkGoals:0,defConceded:0, // Ø Tore (Sturm) / Ø Gegentore (Abwehr) — Basis für Rollen-Donuts und Positionen-Tab
      mates:{},opps:{},best:-1e9,worst:1e9,curStreak:0};
    run[id]=0;
  });
  
  // Single-Pass durch die Matches, sortiert nach Zeit
  const ordered=[...matches].sort((a,b)=>mts(a)-mts(b));
  for(let i=0; i<ordered.length; i++){
    const m = ordered[i];
    const d_a = m.deltas || {}; // Match-Deltas für alle Spieler im Match
    
    // Team A Spieler verarbeiten
    const teamA_players = [m.a1, m.a2];
    const teamA_won = m.winner === 'A';
    const teamA_gf = m.score_a;
    const teamA_ga = m.score_b;

    for(let j=0; j<2; j++){
      const id = teamA_players[j];
      const s = stats[id];
      if(!s) continue; // Überspringen, wenn Spieler nicht aktiv oder nicht existiert
      
      const won = teamA_won;
      const gf = teamA_gf;
      const ga = teamA_ga;
      const pos = (id === m.a1) ? m.a1_pos : m.a2_pos;
      const delta = d_a[id] || 0;
      
      s.games++;
      s.gf += gf;
      s.ga += ga;
      if(won){ s.wins++; run[id] = run[id]>=0 ? run[id]+1 : 1; }
      else   { s.losses++; run[id] = run[id]<=0 ? run[id]-1 : -1; }
      
      if(pos==='atk'){ s.atkG++; if(won) s.atkW++; s.atkGoals += gf; }
      else            { s.defG++; if(won) s.defW++; s.defConceded += ga; }
      
      const mate = (id === m.a1) ? m.a2 : m.a1;
      if(!s.mates[mate]) s.mates[mate]={g:0,w:0};
      s.mates[mate].g++;
      if(won) s.mates[mate].w++;
      
      const opp1=m.b1, opp2=m.b2;
      if(!s.opps[opp1]) s.opps[opp1]={g:0,w:0};
      s.opps[opp1].g++;
      if(won) s.opps[opp1].w++;
      if(!s.opps[opp2]) s.opps[opp2]={g:0,w:0};
      s.opps[opp2].g++;
      if(won) s.opps[opp2].w++;
      
      if(delta > s.best) s.best = delta;
      if(delta < s.worst) s.worst = delta;
    }
    
    // Team B Spieler verarbeiten (analog zu Team A)
    const teamB_players = [m.b1, m.b2];
    const teamB_won = m.winner === 'B';
    const teamB_gf = m.score_b;
    const teamB_ga = m.score_a;
    
    for(let j=0; j<2; j++){
      const id = teamB_players[j];
      const s = stats[id];
      if(!s) continue; // Überspringen, wenn Spieler nicht aktiv oder nicht existiert
      
      const won = teamB_won;
      const gf = teamB_gf;
      const ga = teamB_ga;
      const pos = (id === m.b1) ? m.b1_pos : m.b2_pos;
      const delta = d_a[id] || 0;
      
      s.games++;
      s.gf += gf;
      s.ga += ga;
      if(won){ s.wins++; run[id] = run[id]>=0 ? run[id]+1 : 1; }
      else   { s.losses++; run[id] = run[id]<=0 ? run[id]-1 : -1; }
      
      if(pos==='atk'){ s.atkG++; if(won) s.atkW++; s.atkGoals += gf; }
      else            { s.defG++; if(won) s.defW++; s.defConceded += ga; }
      
      const mate = (id === m.b1) ? m.b2 : m.b1;
      if(!s.mates[mate]) s.mates[mate]={g:0,w:0};
      s.mates[mate].g++;
      if(won) s.mates[mate].w++;
      
      const opp1=m.a1, opp2=m.a2;
      if(!s.opps[opp1]) s.opps[opp1]={g:0,w:0};
      s.opps[opp1].g++;
      if(won) s.opps[opp1].w++;
      if(!s.opps[opp2]) s.opps[opp2]={g:0,w:0};
      s.opps[opp2].g++;
      if(won) s.opps[opp2].w++;
      
      if(delta > s.best) s.best = delta;
      if(delta < s.worst) s.worst = delta;
    }
  }
  
  // Finalisierung der Statistiken (z.B. Winrate, Tordifferenz)
  activeIds.forEach(id=>{
    const s = stats[id];
    s.curStreak = run[id];
    s.wr = s.games ? s.wins/s.games : 0;
    s.atkWr = s.atkG ? s.atkW/s.atkG : null;
    s.defWr = s.defG ? s.defW/s.defG : null;
    s.gd = s.gf - s.ga;
  });
  
  _cache._allStatsKey=key;
  _cache._allStatsData=stats;
  return stats;
}



