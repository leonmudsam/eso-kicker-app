// ╔═══ §5.4 ─── VIEW: TEAMS ────────────────────────────────────────────╗
//     Team-Tab mit Team-Statistiken und Top-Teams.
// ╚═════════════════════════════════════════════════════════════════════════╝
function vTeams(){
  const T=teamStats().filter(t=>t.g>=4);
  if(!T.length)return `<div class="view-head"><h2>Teams</h2><p>Min. 4 gemeinsame Spiele</p></div>${emptyState('handshake','Noch nicht genug Daten')}`;
  const showBest=teamView!=='worst';
  
  // ═══ SORTIERUNG BASIEREND AUF teamSort VARIABLE ═══
  let sorted;
  if(teamSort==='wr'){
    // Standard: Nach Winrate
    sorted=[...T].sort((a,b)=>(b.w/b.g)-(a.w/a.g)||(b.gf-b.ga)-(a.gf-a.ga)||b.g-a.g);
  } else if(teamSort==='gd'){
    // Nach Tordifferenz
    sorted=[...T].sort((a,b)=>(b.gf-b.ga)-(a.gf-a.ga)||(b.w/b.g)-(a.w/a.g)||b.g-a.g);
  } else if(teamSort==='elo'){
    // Nach gesamtem Elo-Zuwachs (über alle Saisons hinweg)
    const gSim=getGlobalSim();
    sorted=[...T].sort((a,b)=>{
      const keyA=[a.ids[0],a.ids[1]].sort().join('|');
      const keyB=[b.ids[0],b.ids[1]].sort().join('|');
      const eloA=gSim.teamElo[keyA]||0;
      const eloB=gSim.teamElo[keyB]||0;
      return eloB-eloA || (b.w/b.g)-(a.w/a.g) || (b.gf-b.ga)-(a.gf-a.ga);
    });
  }
 else {
    // Fallback
    sorted=[...T].sort((a,b)=>(b.w/b.g)-(a.w/a.g)||(b.gf-b.ga)-(a.gf-a.ga)||b.g-a.g);
  }
  
  const arr=showBest?sorted:[...sorted].reverse();


  // Top-3 Akzente (Gold/Silber/Bronze) — Border + Rang-Kachel-Hintergrund
  const TOP=[
    {border:'rgba(247,207,74,.45)', bg:'#f7cf4a', fg:'#1d1700'},
    {border:'rgba(200,208,203,.35)',bg:'#c8d0cb', fg:'#1a1f1c'},
    {border:'rgba(255,120,73,.3)',  bg:'#ff7849', fg:'#2a1108'}
  ];

  const pm=pmap();
  const avPair=(idA,idB)=>{
    const a=pm[idA], b=pm[idB];
    const one=(p,offset)=>{
      if(!p) return `<div style="width:32px;height:32px;border-radius:50%;background:var(--surface3);border:2px solid var(--surface);${offset?'margin-left:-9px':''}"></div>`;
      const em=p.avatar_id?avatarEmoji(p.avatar_id):null;
      if(em) return `<div style="width:32px;height:32px;border-radius:50%;background:var(--surface3);display:grid;place-items:center;font-size:15px;border:2px solid var(--surface);${offset?'margin-left:-9px':''}">${em}</div>`;
      return `<div style="width:32px;height:32px;border-radius:50%;background:${avColor(p.id)};display:grid;place-items:center;font-size:11px;font-family:'Archivo Black',sans-serif;color:#0a0c0b;border:2px solid var(--surface);${offset?'margin-left:-9px':''}">${esc(initials(p.name))}</div>`;
    };
    return `<div style="display:flex;align-items:center;flex-shrink:0">${one(a,false)}${one(b,true)}</div>`;
  };

  const gSim=getGlobalSim();
  const seasonTeamMap=gSim.seasonTeamElo[currentSeason().id]||{};

  // Dezente Team-/Spieler-Suche: filtert das aktuelle (sortierte) Feld nach
  // Spielername ODER kombiniertem Team-Namen. Beim Suchen keine Top-3-Medaillen.
  const _tq = (teamSearch||'').trim().toLowerCase();
  // Tokenisierte Suche: „&" und Leerzeichen trennen die Terme, Reihenfolge egal.
  // Dadurch findet „Leon & Martin", „Martin & Leon", „Leon Martin" und „Martin Leon"
  // dasselbe Duo. Jeder Term muss auf mind. einen der beiden Spielernamen passen.
  const _tqTokens = _tq.split(/[\s&]+/).filter(Boolean);
  const arrF = _tqTokens.length
    ? arr.filter(t => {
        const names = t.ids.map(id => ((pm[id]&&pm[id].name)||'').toLowerCase());
        return _tqTokens.every(tok => names.some(nm => nm.includes(tok)));
      })
    : arr;

  const rows=arrF.map((t,i)=>{
    const wr=Math.round(t.w/t.g*100);
    const gd=t.gf-t.ga;
    const keyTeam=[t.ids[0],t.ids[1]].sort().join('|');
    const eloGain=Math.round(seasonTeamMap[keyTeam]||0);
    
    // ═══ DYNAMISCHE HAUPTMETRIK BASIEREND AUF teamSort ═══
    let mainValue, mainLabel, mainColor;
    if(teamSort==='wr'){
      mainValue=wr+'%';
      mainLabel='WR';
      mainColor='var(--acid)';
    } else if(teamSort==='gd'){
      mainValue=(gd>=0?'+':'')+gd;
      mainLabel='TD';
      mainColor=gd>=0?'var(--acid)':'var(--red)';
    } else if(teamSort==='elo'){
      const eloGainTotal=Math.round(gSim.teamElo[keyTeam]||0);
      mainValue=(eloGainTotal>=0?'+':'')+eloGainTotal;
      mainLabel='Elo';
      mainColor=eloGainTotal>=0?'var(--acid)':'var(--red)';
    }

    
    const isTop=showBest&&i<3&&!_tq;
    const top=isTop?TOP[i]:null;
    const borderColor=top?top.border:'var(--line)';
    const rankBlock=top
      ? `<div style="width:24px;height:24px;border-radius:8px;background:${top.bg};color:${top.fg};display:grid;place-items:center;font-family:'Archivo Black',sans-serif;font-size:12px;flex-shrink:0">${i+1}</div>`
      : `<div style="width:24px;text-align:center;font-family:'Archivo Black',sans-serif;font-size:14px;color:var(--faint);flex-shrink:0">${i+1}</div>`;
    
    return `<div class="rrow" data-team="${esc(t.ids.join('|'))}" style="background:var(--surface);border:1px solid ${borderColor};border-radius:18px;padding:13px 15px;display:block">
      <div style="display:flex;align-items:center;gap:12px">
        ${rankBlock}
        ${avPair(t.ids[0],t.ids[1])}
        <div style="flex:1;min-width:0">
          <div style="font-family:'Archivo Black',sans-serif;font-size:14px;letter-spacing:-.01em;line-height:1.1">${esc(t.ids.map(pname).join(' & '))}</div>
          <div class="num" style="margin-top:4px;font-size:10.5px;color:var(--muted)">${t.w}–${t.g-t.w} · TD ${gd>=0?'+':''}${gd}</div>
        </div>
        <div style="font-family:'Archivo Black',sans-serif;font-size:20px;color:${mainColor};line-height:1;flex-shrink:0">${mainValue}</div>
      </div>
    </div>`;
  }).join('');


  return `
    <div class="view-head"><h2>Teams</h2><p>${arrF.length} Duo${arrF.length===1?'':'s'}${_tq?' gefunden':' mit min. 4 gemeinsamen Spielen'}</p></div>
    <div class="search">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
        <circle cx="11" cy="11" r="7"/><path d="M21 21l-4-4"/>
      </svg>
      <input type="text" id="teamSearch" placeholder="Spieler oder Team suchen…" value="${esc(teamSearch)}">
    </div>
    <div class="seg accent">
      <button data-teamtoggle="best" class="${showBest?'on':''}">▲ Beste</button>
      <button data-teamtoggle="worst" class="${!showBest?'on':''}">▼ Schlechteste</button>
    </div>
    <div class="seg" style="margin-bottom:14px">
      <button data-teamsort="wr" class="${teamSort==='wr'?'on':''}">Winrate</button>
      <button data-teamsort="gd" class="${teamSort==='gd'?'on':''}">Tordiff</button>
      <button data-teamsort="elo" class="${teamSort==='elo'?'on':''}">Elo-Zuwachs</button>
    </div>
    ${arrF.length ? `<div class="rlist">${rows}</div>` : emptyState('search','Keine Teams gefunden')}`;
}


// ╔═══ §5.5 ─── VIEW: HISTORY (Match-Liste mit Filter) ─────────────────╗
//     Filterbar nach Spieler. Zeigt Badge-Chips pro Match.
// ╚═════════════════════════════════════════════════════════════════════════╝
function vHistory(){
  if(!matches.length)return `<div class="view-head"><h2>Verlauf</h2></div>${emptyState('scroll','Noch keine Matches')}`;
  let list=[...matches].reverse();
  if(histFilter!=='all')
    list=list.filter(m=>[m.a1,m.a2,m.b1,m.b2].includes(histFilter));
  
  // ═══ PAGINIERUNGSLOGIK ═══
  const ITEMS_PER_PAGE = 20; // Anzahl der Matches pro Seite
  const currentPage = _histPage; // Nutze die globale Variable
  const totalPages = Math.ceil(list.length / ITEMS_PER_PAGE);
  const paginatedList = list.slice(currentPage * ITEMS_PER_PAGE, (currentPage + 1) * ITEMS_PER_PAGE);
  
  const opts=`<option value="all">Alle Spieler</option>`+
    [...players].sort((a,b)=>a.name.localeCompare(b.name)).map(p=>`<option value="${p.id}" ${histFilter===p.id?'selected':''}>${esc(p.name)}</option>`).join('');
  
  const rows=paginatedList.map(m=>{
    const aWon=m.winner==='A';
    const tA=`${pname(m.a1)} & ${pname(m.a2)}`, tB=`${pname(m.b1)} & ${pname(m.b2)}`;
    const dl=ids=>ids.map(id=>{const d=(m.deltas||{})[id]||0;
      return `<span><b>${esc(pname(id))}</b> <span class="${d>=0?'delta-v pos':'delta-v neg'}" style="font-size:11px">${d>=0?'+':''}${Math.round(d)}</span></span>`;}).join('');
    // Kompakte Badge-Icons für errungene Auszeichnungen
    const earned=badgesEarnedInMatch(m.id);
    const badgeChips=earned.length?`<div style="display:flex;gap:3px;align-items:center;margin-top:4px;flex-wrap:wrap">${earned.map(e=>
      `<span style="font-size:11px;background:var(--surface3);padding:2px 6px;border-radius:7px;display:inline-flex;align-items:center;gap:4px;color:var(--ink2)">${badgeIc(e.badge,'12px')}<span style="font-size:10px">${esc(pname(e.playerId).split(' ')[0])}</span></span>`
    ).join('')}</div>`:'';
    return `<div class="mrow" data-match="${m.id}">
      <div class="mrow-top">
        <div class="mteam ${aWon?'won':'lost'}">${esc(tA)}</div>
        <div class="mscore num">${m.score_a}:${m.score_b}</div>
        <div class="mteam r ${!aWon?'won':'lost'}">${esc(tB)}</div>
      </div>
      <div class="mrow-bot"><div class="mdeltas">${dl([m.a1,m.a2,m.b1,m.b2])}</div></div>
      ${badgeChips}
      <div class="mrow-bot" style="margin-top:6px"><span>${dateStr(m.created_at)}</span>
        <span data-delmatch="${m.id}" style="color:var(--acid2);display:inline-flex;align-items:center;gap:5px">${svgI('edit')} bearbeiten</span></div>
    </div>`;
  }).join('');

  // ═══ PAGINIERUNGS-CONTROLS ═══
  const paginationControls = totalPages > 1 ? `
    <div style="display:flex;align-items:center;gap:8px;margin-top:16px;padding-bottom:20px;width:100%">
      <button class="btn ghost sm" id="prevPageBtn" style="flex:1;min-width:0;padding:10px 8px;white-space:nowrap" ${currentPage===0?'disabled':''}>← Vorher</button>
      <div style="flex-shrink:0;color:var(--muted);font-size:11px;font-family:'Sometype Mono',monospace;text-align:center;padding:0 2px;white-space:nowrap">
        <b style="color:var(--ink)">${currentPage+1}</b> / <b style="color:var(--ink)">${totalPages}</b>
      </div>
      <button class="btn ghost sm" id="nextPageBtn" style="flex:1;min-width:0;padding:10px 8px;white-space:nowrap" ${currentPage>=(totalPages-1)?'disabled':''}>Weiter →</button>
    </div>
  ` : '';

  return `
    <div class="view-head"><h2>Verlauf</h2><p>${list.length} Matches</p></div>
    <div class="search" style="margin-bottom:14px">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M22 3H2l8 9.5V19l4 2v-8.5L22 3z"/></svg>
      <select id="histSel" style="padding-left:40px">${opts}</select>
    </div>
    ${list.length?`<div class="mlist">${rows}</div>${paginationControls}`:emptyState('search','Keine Matches für diesen Filter')}`;
}


// ╔═══ §5.6 ─── VIEW: MATCH-EINGABE ────────────────────────────────────╗
//     Spieler-Auswahl + Score-Eingabe für neues Match.
// ╚═════════════════════════════════════════════════════════════════════════╝
let M={A1:'',A2:'',B1:'',B2:'',pA1:'atk',pA2:'def',pB1:'atk',pB2:'def',sa:0,sb:0};
function vMatch(){
  const pos=k=>`<select data-pos="${k}"><option value="atk" ${M['p'+k]==='atk'?'selected':''}>↑ Sturm</option><option value="def" ${M['p'+k]==='def'?'selected':''}>↓ Abwehr</option></select>`;
  const slot=(t,n)=>{
    const key=t+n;
    const sel=M[key]?pmap()[M[key]]:null;
    return `<div class="slot"><div class="psel"><div class="combo">
      <input type="text" data-combo="${key}" placeholder="Spieler tippen…" autocomplete="off"
        value="${sel?esc(sel.name):''}" class="${sel?'filled':''}">
      <div class="combo-list" data-combolist="${key}"></div>
    </div></div><div class="possel">${pos(key)}</div></div>`;
  };
  return `
    <div class="view-head"><h2>Match</h2><p>Aufstellen, Tore eintragen, speichern</p></div>
    <div class="builder">
      <div class="team-block A"><div class="team-label">Team A <span class="tag" id="avgA"></span></div>${slot('A',1)}${slot('A',2)}</div>
      <div class="vs-mid"><span class="line"></span><span class="vs">VS</span><span class="line"></span></div>
      <div class="team-block B"><div class="team-label">Team B <span class="tag" id="avgB"></span></div>${slot('B',1)}${slot('B',2)}</div>
    </div>
    <div class="score-board" style="margin-top:12px">
      <div class="score-col A"><div class="cl">Team A</div>
        <div class="stepper"><button data-step="sa,-1">−</button><span class="sval num" id="svA" data-scoreedit="sa">${M.sa}</span><button data-step="sa,1">+</button></div></div>
      <div class="score-sep">:</div>
      <div class="score-col B"><div class="cl">Team B</div>
        <div class="stepper"><button data-step="sb,-1">−</button><span class="sval num" id="svB" data-scoreedit="sb">${M.sb}</span><button data-step="sb,1">+</button></div></div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin:-4px 0 10px">
      <span style="font-size:10.5px;color:var(--muted)">Tipp: auf die Zahl tippen (0–10)</span>
      <button class="btn ghost" id="shuffleBtn" style="padding:8px 14px;font-size:11px;border-radius:10px">Mischen</button>
    </div>
    <div id="previewSlot"></div>
    <div class="btn-row" style="margin-top:4px">
      <button class="btn ghost sm" id="clearM" style="flex:0 0 38%">Reset</button>
      <button class="btn" id="saveM" disabled>Speichern</button>
    </div>`;
}

// ╔═══ §5.7 ─── VIEW: SETTINGS ─────────────────────────────────────────╗
//     Spieler verwalten, Saison-Recap, App-Reset (hinter Passwort-Lock).
// ╚═════════════════════════════════════════════════════════════════════════╝
function vSettings(){
  const sl=(id,name,val,min,max,suf)=>`<div class="slider-wrap">
    <div class="sh"><span class="sn">${name}</span><span class="sv"><span id="${id}v">${val}</span>${suf||''}</span></div>
    <input type="range" id="${id}" min="${min}" max="${max}" value="${val}"></div>`;
  // Aktuelle Werte für Erklärungen (mit Fallbacks)
  const c = {
    k:          Math.round(cfg.k_factor),
    risk:       Math.round((cfg.risk_split ?? 0.6)*100),
    pos:        Math.round((cfg.pos_swing ?? 0.45)*100),
    winBoost:   Math.round((cfg.win_boost ?? 1.12)*100),
    movDamp:    Math.round((cfg.mov_loss_damp ?? 0.5)*100),
    bonus:      ((cfg.match_bonus ?? 1.5)).toFixed(1),
    startElo:   Math.round(cfg.start_elo ?? 0),
    posMin:     Math.round(cfg.pos_min_games ?? 3),
    expW:       Math.round((cfg.exp_weight ?? 0.5)*100),
    npMult:     Math.round((cfg.new_player_mult ?? 1.5)*100),
    npMidMult:  Math.round((cfg.new_player_mid_mult ?? 1.2)*100),
    vetDamp:    Math.round((cfg.veteran_damp ?? 0.85)*100),
    movMax:     Math.round((cfg.mov_max_boost ?? 0.4)*100),
    expProt:    Math.round((cfg.exp_protect_max ?? 0.1)*100),
    udElo:      Math.round((cfg.underdog_elo_max ?? 0.15)*100),
    udGames:    Math.round((cfg.underdog_games_max ?? 0.05)*100),
    lowDamp:    Math.round((cfg.low_elo_loss_damp ?? 0)*100),
  };
  return `
    <div class="view-head"><h2>Formel</h2><p>Feintuning der Elo-Berechnung</p></div>

    <div class="cfg-section-title">Grundparameter</div>
    <div class="card">
      ${sl('cfgK','K-Faktor (Tempo)',c.k,8,64,'')}
      ${sl('cfgStartElo','Start-Elo pro Saison',c.startElo,0,1000,'')}
    </div>

    <div class="cfg-section-title">Spielerlast & Position</div>
    <div class="card">
      ${sl('cfgRisk','Risiko-Split (schwacher Mate)',c.risk,0,100,'%')}
      ${sl('cfgPos','Positions-Swing',c.pos,0,100,'%')}
      ${sl('cfgExpW','Positions-Erfahrungs-Gewicht',c.expW,0,100,'%')}
      ${sl('cfgPosMin','Min. Spiele für Positions-Wertung',c.posMin,1,10,'')}
    </div>

    <div class="cfg-section-title">Sieg & Niederlage</div>
    <div class="card">
      ${sl('cfgWinBoost','Sieg-Boost',c.winBoost,100,140,'%')}
      ${sl('cfgMovDamp','MoV-Dämpfung Niederlage',c.movDamp,0,100,'%')}
      ${sl('cfgMovMax','MoV-Max-Boost (Kantersieg)',c.movMax,0,100,'%')}
      ${sl('cfgLowEloLossDamp','Low-Elo Verlustschutz',c.lowDamp,0,100,'%')}
    </div>

    <div class="cfg-section-title">Bonus-System</div>
    <div class="card">
      ${sl('cfgBonus','Spielbonus pro Match',Math.round((cfg.match_bonus ?? 1.5)*10),0,50,)}
      ${sl('cfgExpProt','Erfahrungs-Schutz Maximum',c.expProt,0,30,'%')}
      ${sl('cfgUdElo','Underdog-Boost (Elo-Gap)',c.udElo,0,100,'%')}
      ${sl('cfgUdGames','Underdog-Boost (Spiele-Gap)',c.udGames,0,100,'%')}
    </div>

    <div class="cfg-section-title">K-Faktor-Dynamik</div>
    <div class="card">
      ${sl('cfgNpMult','Neuling-Multi (&lt;5 Spiele)',c.npMult,100,200,'%')}
      ${sl('cfgNpMidMult','Anfänger-Multi (&lt;15 Spiele)',c.npMidMult,100,200,'%')}
      ${sl('cfgVetDamp','Veteran-Elogewinn (&gt;Start+400 Elo)',c.vetDamp,0,100,'%')}
    </div>

    <div class="card">
      <div class="mini-label">Mechaniken</div>
      <div style="font-size:12px;color:var(--ink2);line-height:1.8">
        <b style="color:var(--acid)">K-Faktor</b> — Wie stark einzelne Matches die Elo verändern. Hoch = schnelle Änderungen, niedrig = stabile Elo.<br>
        <b style="color:var(--acid)">Start-Elo</b> — Der Wert auf den jeder Spieler zu Saisonbeginn zurückgesetzt wird. Höhere Werte machen Verluste in den ersten Matches "weniger schmerzhaft".<br>
        <b style="color:var(--acid)">Risiko-Split</b> — Wie viel Last der schwächere Mitspieler trägt. Bei ${c.risk}% verlierst du weniger Elo wenn dein Mate deutlich schlechter ist.<br>
        <b style="color:var(--acid)">Positions-Swing</b> — Bonus für Siege auf der schwachen Position. Ein Abwehr-Spieler der im Sturm gewinnt bekommt extra Elo.<br>
        <b style="color:var(--acid)">Positions-Erfahrungs-Gewicht</b> — Mischverhältnis bei der automatischen Positions-Erkennung. ${c.expW}% bedeutet: ${c.expW}% Häufigkeit der Position, ${100-c.expW}% Performance. Hoch = wer oft Abwehr spielt gilt als Verteidiger, egal wie gut. Niedrig = nur Über-Erwartungs-Performance zählt.<br>
        <b style="color:var(--acid)">Min. Spiele Position</b> — Erst ab ${c.posMin} Spielen auf einer Position fließt sie in die Positions-Wertung ein. Schützt vor Zufalls-Einstufung nach 1 Spiel.<br>
        <b style="color:var(--acid)">Sieg-Boost</b> — Siege bringen ${c.winBoost-100}% mehr als Niederlagen kosten. Sorgt für langfristigen Aufwärtstrend.<br>
        <b style="color:var(--acid)">MoV-Dämpfung</b> — Tordifferenz bei Niederlagen nur ${c.movDamp}% so stark wie bei Siegen. Eine 0:10 Niederlage bestraft so nicht 3× so hart wie 5:10.<br>
        <b style="color:var(--acid)">MoV-Max-Boost</b> — Maximaler Multiplikator durch Tordifferenz bei einem Kantersieg. ${c.movMax}% heißt: ein 10:0 zählt bis zu ${(100+c.movMax)}% des normalen Werts.<br>
        <b style="color:var(--acid)">Low-Elo Verlustschutz</b> — Spieler unter dem Match-Durchschnitts-Elo verlieren bei Niederlagen bis zu ${c.lowDamp}% weniger Elo (tanh-skaliert nach 200 Elo Abstand zum Match-Durchschnitt). Symmetrisch zum Underdog-Boost — schützt schwache Spieler vor Elo-Absturz, aber nur wenn sie tatsächlich schwächer als der Schnitt im Match sind.<br>
        <b style="color:var(--acid)">Spielbonus</b> — +${c.bonus} Elo pro Match, egal ob Sieg oder Niederlage. Belohnt aktive Spieler.<br>
        <b style="color:var(--acid)">Erfahrungs-Schutz Max</b> — Erfahrene Spieler verlieren bei Niederlagen bis zu ${c.expProt}% weniger Elo (linear ab 5 bis 30 Saison-Matches). Schützt vor Absturz durch Pech-Serien.<br>
        <b style="color:var(--acid)">Underdog-Boost (Elo-Gap)</b> — Schwächere Spieler bekommen bis zu ${c.udElo}% Bonus bei Siegen gegen stärkere Gegner (tanh-skaliert nach 400 Elo-Differenz). Wirkt nur als Belohnung, nie als Bestrafung.<br>
        <b style="color:var(--acid)">Underdog-Boost (Spiele-Gap)</b> — Spieler mit weniger Matches bekommen bis zu ${c.udGames}% zusätzlichen Boost (tanh-skaliert nach 30 Spiele-Differenz). Hilft Neueinsteigern beim Aufholen. Veteranen werden nicht bestraft — beide Komponenten wirken unabhängig.<br>
        <b style="color:var(--acid)">Neuling-Multi</b> — In den ersten 5 Saison-Spielen wirkt K-Faktor um ${c.npMult}% verstärkt. Neue Spieler finden so schnell ihr Niveau.<br>
        <b style="color:var(--acid)">Anfänger-Multi</b> — Zwischen 5–14 Saison-Spielen wirkt K-Faktor um ${c.npMidMult}% verstärkt. Sanfter Übergang zur Normal-Bewertung.<br>
        <b style="color:var(--acid)">Veteran-Dämpfung</b> — Sehr starke Spieler (&gt; Start+400 Elo) bewegen sich um ${c.vetDamp}% des K-Faktors. Verhindert dass Top-Spieler durch Pflicht-Siege ewig weiter wachsen.<br>
        <b style="color:var(--acid)">Saison-Reset</b> — Jeden Monatswechsel werden alle Elo-Werte auf den Start-Wert zurückgesetzt. Karriere-Elo = gewichteter Durchschnitt der Saison-End-Elos.
      </div>
    </div>
    <div class="card" style="margin-top:14px;border:1px solid rgba(190,242,100,.18);background:linear-gradient(155deg,rgba(190,242,100,.06),var(--surface) 80%)">
      <div class="mini-label" style="color:var(--acid);display:flex;align-items:center;gap:6px">${svgI('info')}Slider-Verhalten</div>
      <p style="font-size:12px;color:var(--ink2);line-height:1.55;margin-top:8px">
        Slider-Änderungen wirken <b style="color:var(--acid)">nur auf neue Matches</b>.
        Vergangene Matches behalten ihre damaligen Elo-Werte — abgeschlossene Saisons bleiben stabil,
        Awards &amp; Achievements ändern sich nicht.
      </p>
      <p style="font-size:11px;color:var(--muted);line-height:1.55;margin-top:6px">
        Falls du die Slider <b>rückwirkend</b> auf die gesamte Historie anwenden willst, kannst du alle
        Matches neu berechnen lassen. <b style="color:var(--red)">Achtung:</b> dabei werden alle bisher
        gespeicherten Match-Deltas überschrieben.
      </p>
      <button class="btn" id="recalcBtn" style="margin-top:14px;width:100%;display:inline-flex;align-items:center;justify-content:center;gap:8px">${svgI('cycle')} Alle Matches rückwirkend neu berechnen</button>
    </div>

    <div class="card" style="margin-top:14px">
      <div class="mini-label">Backup &amp; Export</div>
      <p style="font-size:11.5px;color:var(--ink2);line-height:1.6;margin-top:10px">
        Die Liga lebt in einer Datenbank in der Cloud. Damit sie auch dann nicht verloren geht,
        wenn dort etwas passiert, kannst du hier jederzeit eine eigene Kopie ziehen.
      </p>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">
        <button class="btn ghost" id="expXlsxBtn" style="width:100%;display:inline-flex;align-items:center;justify-content:center;gap:8px">${svgI('scroll')} Matches als Excel (.xlsx)</button>
        <button class="btn ghost" id="expSaveBtn" style="width:100%;display:inline-flex;align-items:center;justify-content:center;gap:8px">${svgI('shieldCheck')} Savepoint sichern (.json)</button>
        <button class="btn ghost sm" id="expCsvBtn" style="width:100%;font-size:11px">Stattdessen als CSV</button>
      </div>
      <p style="font-size:11px;color:var(--muted);line-height:1.6;margin-top:12px">
        <b style="color:var(--acid)">Excel</b> — alle ${matches.length} Matches mit Namen, Positionen und Ergebnissen,
        dazu je ein Blatt für Spieler und Saisons. Zum Anschauen, Auswerten und Weitergeben.<br>
        <b style="color:var(--acid)">Savepoint</b> — die vollständige Kopie inklusive Elo-Deltas und Formel-Einstellungen.
        Das ist die Datei, mit der sich die Liga im Ernstfall wieder aufbauen lässt.
      </p>
      <div style="height:1px;background:var(--line);margin:14px 0"></div>
      <button class="btn" id="impBackupBtn" style="width:100%;display:inline-flex;align-items:center;justify-content:center;gap:8px">${svgI('refresh')} Datei einspielen</button>
      <p style="font-size:11px;color:var(--muted);line-height:1.6;margin-top:10px">
        Nimmt .xlsx, .csv und .json. Vor dem Schreiben siehst du eine Vorschau, was ergänzt würde.
        <b style="color:var(--acid)">Es wird nie etwas gelöscht oder überschrieben</b> — nur fehlende Matches kommen dazu.
      </p>
    </div>

    <div class="card" style="margin-top:14px">
      <div class="mini-label">App-Version</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;gap:10px">
        <div style="font-size:12px;color:var(--ink2);font-family:'Sometype Mono',monospace">${BUILD_VERSION}</div>
        <button class="btn ghost sm" id="forceReloadBtn" style="padding:7px 12px;font-size:11px;flex-shrink:0">Cache leeren &amp; neu laden</button>
      </div>
      <p style="font-size:11px;color:var(--muted);line-height:1.55;margin-top:10px">
        Falls neue Features nicht erscheinen, ist meist der iOS-PWA-/Browser-Cache schuld. Der Button erzwingt einen Frischen Load. Außerdem checkt die App im Hintergrund auf neue Versionen und blendet oben einen Banner ein.
      </p>
    </div>
    ${players.filter(p=>p.hidden).length?`
    <div class="card" style="margin-top:14px">
      <div class="mini-label">Ausgeblendete Spieler</div>
      <div style="display:flex;flex-direction:column;gap:4px;margin-top:10px">
        ${players.filter(p=>p.hidden).map(p=>`
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line)">
            <div style="display:flex;align-items:center;gap:10px">
              ${avHtml(p,'width:32px;height:32px;border-radius:9px;font-size:11px')}
              <span style="font-weight:600">${esc(p.name)}</span>
            </div>
            <button data-unhide="${p.id}" class="btn ghost sm" style="padding:7px 12px;font-size:11px">Einblenden</button>
          </div>`).join('')}
      </div>
    </div>`:''}

    `;
}

// ╔═══ §5.8 ─── MATCH PREVIEW & SAVE-LOGIK ─────────────────────────────╗
//     Live-Preview der Elo-Deltas + doSaveMatch() schreibt Match und zeigt
//     Achievement-Toasts (Badge-Trigger via getBadgeEarnedCache).
// ╚═════════════════════════════════════════════════════════════════════════╝
function readM(){
  document.querySelectorAll('[data-p]').forEach(s=>M[s.dataset.p]=s.value);
  document.querySelectorAll('[data-pos]').forEach(s=>M['p'+s.dataset.pos]=s.value);
}
function validM(){const ids=[M.A1,M.A2,M.B1,M.B2];
  return !ids.some(x=>!x)&&new Set(ids).size===4&&M.sa!==M.sb
    &&M.pA1!==M.pA2&&M.pB1!==M.pB2;}
function teamsFromM(){return{teamA:[{id:M.A1,pos:M.pA1},{id:M.A2,pos:M.pA2}],teamB:[{id:M.B1,pos:M.pB1},{id:M.B2,pos:M.pB2}]};}
function updatePreview(){
  const slot = document.getElementById('previewSlot');
  const save = document.getElementById('saveM');
  if(!slot) return;
  const P = pmap();
  const gSim = getGlobalSim();
  const seasonElo = id => gSim.elo[id] ?? cfg.start_elo;

  const setAvg = (el,a,b) => {
    const e = document.getElementById(el);
    if(e && P[a] && P[b]) e.textContent = 'Ø '+Math.round((seasonElo(a)+seasonElo(b))/2)+' (Saison)';
    else if(e) e.textContent = '';
  };
  setAvg('avgA', M.A1, M.A2); setAvg('avgB', M.B1, M.B2);

  const ids = [M.A1,M.A2,M.B1,M.B2].filter(Boolean);
  if(new Set(ids).size !== ids.length){
    slot.innerHTML = `<div class="preview" style="color:var(--red);font-size:12px;text-align:center">Ein Spieler steht doppelt.</div>`;
    save.disabled = true; return;
  }
  // Beide Spieler eines Teams müssen unterschiedliche Positionen haben
  const allFour = ids.length === 4;
  if(allFour && (M.pA1===M.pA2 || M.pB1===M.pB2)){
    slot.innerHTML = `<div class="preview" style="color:var(--red);font-size:12px;text-align:center">Jedes Team braucht Sturm + Abwehr.</div>`;
    save.disabled = true; return;
  }
  if(!validM()){slot.innerHTML=''; save.disabled=true; return;}

  const winner = M.sa > M.sb ? 'A' : 'B';
  const{teamA, teamB} = teamsFromM();
  const c = computeMatch(teamA, teamB, winner, M.sa, M.sb);
  const pA = Math.round(c.expA*100), pB = 100-pA;
  const line = s => {
    const d = c.res[s.id];
    return `<div class="delta-row">
      <span class="dn">${esc(P[s.id].name)}
        <span class="chip ${s.pos}">${s.pos==='atk'?'STU':'ABW'}</span>
      </span>
      <span class="delta-v ${d>=0?'pos':'neg'}">${d>=0?'+':''}${Math.round(d)}</span>
    </div>`;
  };
  slot.innerHTML = `<div class="preview">
    <div class="prob">
      <div class="pa" style="width:${pA}%">${pA}%</div>
      <div class="pb" style="width:${pB}%">${pB}%</div>
    </div>
    <div class="prob-cap">Siegchance (Saison-Elo) · Team ${winner} gewinnt ${M.sa}:${M.sb}
      ${c.mov>1.08?' · Kantersieg ×'+c.mov.toFixed(2):''}
    </div>
    <div class="delta-list">
      ${line(teamA[0])}${line(teamA[1])}
      <div class="delta-div"></div>
      ${line(teamB[0])}${line(teamB[1])}
    </div>
  </div>`;
  save.disabled = false;
}

async function doSaveMatch(){
  readM(); if(!validM()){toast('Match unvollständig',true);return;}
  const winner = M.sa > M.sb ? 'A' : 'B';
  const{teamA, teamB} = teamsFromM();

  // players.elo = Saison-Elo → direkt nutzen
  const c = computeMatch(teamA, teamB, winner, M.sa, M.sb);

  const row = {
    a1:M.A1, a1_pos:M.pA1, a2:M.A2, a2_pos:M.pA2,
    b1:M.B1, b1_pos:M.pB1, b2:M.B2, b2_pos:M.pB2,
    score_a:M.sa, score_b:M.sb, winner, deltas:c.res, exp_a:c.expA
  };
  // insert(...).select() gibt die erzeugte Zeile inkl. id + created_at zurück,
  // damit die lokale Kopie exakt der DB entspricht (created_at wird für die
  // Saison-Filterung in matchesInSeason zwingend gebraucht).
  const{data:inserted, error} = await sb.from('matches').insert(row).select().single();
  if(error){toast('Fehler: '+error.message,true);return;}

  // Fallback: falls select() nicht greift, created_at lokal setzen,
  // sonst fiele das frische Match aus matchesInSeason heraus.
  const savedRow = inserted || {...row, created_at:new Date().toISOString()};

  // Lokal updaten, dann über die EINE kanonische Engine neu berechnen.
  // persistRecalc schreibt atk, Match-Deltas und Saison-Elos konsistent.
  matches = [...matches, savedRow];
  invalidateCache(['global', 'stats', 'awards', 'badges']);
  await persistNewMatch(savedRow.id);

  // ─── ACHIEVEMENT-TOASTS ───────────────────────────────────────────
  // Nach dem persist+invalidate liefert badgesEarnedInMatch genau die in
  // DIESEM Match neu erreichten Badges (Pre-State-Vergleich → echte Neu-
  // erreichungen, keine Wiederholungen). Sequenzielle Queue zeigt sie der
  // Reihe nach, jeder Toast 2.6s. Spielername aus pname() konsistent zur
  // gesamten App.
  //
  // ⚠ Common-Badges (grün) werden NICHT als Toast gezeigt, weil sie zu
  // häufig feuern und sonst eine Toast-Kaskade von 5+ PopUps entsteht.
  // Sie bleiben im Match-Review sichtbar und zählen im Profil weiter.
  const newBadges = badgesEarnedInMatch(savedRow.id);
  const toastWorthy = newBadges.filter(e => rarityOf(e.badge.id) !== 'common');
  if(toastWorthy.length){
    toastWorthy.forEach(e => showAchievementToast(pname(e.playerId), e.badge));
  } else {
    toast('Match gespeichert', 'ok');
  }
  M = {A1:'',A2:'',B1:'',B2:'',pA1:'atk',pA2:'def',pB1:'atk',pB2:'def',sa:0,sb:0};
  tab = 'ranking'; await loadAll();
}

