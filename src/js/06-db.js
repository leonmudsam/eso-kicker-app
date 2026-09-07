// ╔═══ §3.1 ─── DATENBANK-LAYER ────────────────────────────────────────╗
//     loadAll() lädt Spieler/Matches/Config/Seasons, persistRecalc()
//     schreibt Elos/Deltas atomar zurück. Saison-Archivierung am
//     Monatswechsel via archiveSeasonAndStartNew().
// ╚═════════════════════════════════════════════════════════════════════════╝
function pmap(){
  const key='pmap_'+players.length+'_'+_cache.version;
  if(_cache._pmapKey===key) return _cache._pmapData;
  const m={};
  players.forEach(p=>m[p.id]=p);
  _cache._pmapKey=key;
  _cache._pmapData=m;
  return m;
}

// Nur sichtbare Spieler (für Ranglisten)
function activePlayers(){ return players.filter(p=>!p.hidden); }
function pname(id){const p=pmap()[id];return p?p.name:'?';}
function gamesPlayed(id){return matches.filter(m=>[m.a1,m.a2,m.b1,m.b2].includes(id)).length;}

// v9.15 PERF: Fingerprint des letzten loadAll-Payloads. Der 30s-Auto-Refresh
// (Boot-Intervall) hat bisher bei JEDEM Tick alle Caches invalidiert und die
// komplette View per innerHTML ersetzt — auch wenn sich in der DB nichts
// geändert hatte (99% der Ticks). Das kostete nicht nur Rechenzeit, sondern
// zerstörte alle 30s Scroll-Position/Fokus. Jetzt: unveränderte Daten →
// Early-Return, Globals/Caches/DOM bleiben unangetastet. Ein Tages-Rollover
// erzwingt trotzdem einen vollen Durchlauf (Saison-/POTD-/Recap-Logik).
let _lastLoadFingerprint = null;
let _lastLoadDay = null;
async function loadAll(){
  setConn('verbinde…','load');
  try{
    const [p,m,c,se]=await Promise.all([
      sb.from('players').select('*').order('elo',{ascending:false}),
      sb.from('matches').select('*').order('created_at',{ascending:true}),
      sb.from('config').select('*').eq('id',1).single(),
      sb.from('seasons').select('*').order('start_date',{ascending:false})
    ]);
    if(p.error)throw p.error; if(m.error)throw m.error;
    const _fp = JSON.stringify([p.data, m.data, c.data, se.data]);
    const _today = new Date().toDateString();
    if(_fp === _lastLoadFingerprint && _today === _lastLoadDay){
      // Nichts geändert seit dem letzten Tick → UI in Ruhe lassen.
      setConn(activePlayers().length+' Spieler · '+matches.length+' Matches','ok');
      return;
    }
    _lastLoadFingerprint = _fp;
    _lastLoadDay = _today;
    // Alle Spieler laden (auch hidden) → für Match-Berechnungen nötig
    players=p.data||[];
    // Lokaler Fallback: Wenn DB-Spalte avatar_id nicht existiert,
    // wird Edit aus localStorage übernommen.
    players.forEach(pp=>{
      if(pp.avatar_id==null){
        try{
          const raw=localStorage.getItem('playerEdit_'+pp.id);
          if(raw){
            const e=JSON.parse(raw);
            if(pp.avatar_id==null && e.avatar_id!=null) pp.avatar_id=e.avatar_id;
          }
        }catch(err){}
      }
    });
    matches=m.data||[];
    if(c.data)cfg=c.data;
    // localStorage-Overrides für neue cfg-Felder, die noch nicht in der DB-Spalte existieren
    try{
      const overrides=JSON.parse(localStorage.getItem('cfg_overrides')||'{}');
      Object.keys(overrides).forEach(k=>{
        if(overrides[k]!==undefined && overrides[k]!==null) cfg[k]=overrides[k];
      });
      // Auto-Migration: wenn die DB inzwischen die Spalten kennt, Overrides synchronisieren
      // und localStorage aufräumen. Läuft fire-and-forget im Hintergrund — blockt loadAll nicht.
      const overrideKeys=Object.keys(overrides);
      if(overrideKeys.length){
        (async()=>{
          // Pro Key einzeln updaten: andere bleiben heile wenn einer fehlschlägt
          const remaining={};
          for(const k of overrideKeys){
            try{
              const o={};o[k]=overrides[k];
              const {error}=await sb.from('config').update(o).eq('id',1);
              if(error) remaining[k]=overrides[k];
              // Bei !error: Spalte existiert nun → Override darf raus
            }catch(e){ remaining[k]=overrides[k]; }
          }
          try{
            if(Object.keys(remaining).length) localStorage.setItem('cfg_overrides',JSON.stringify(remaining));
            else localStorage.removeItem('cfg_overrides');
          }catch(e){}
        })();
      }
    }catch(e){}
    seasons=se.data||[];
  // NEU: Alle relevanten Caches invalidieren
  invalidateCache(['global', 'stats', 'awards', 'teams', 'allTeamStats', 'period', 'badges', 'playerSeasonAwards', 'allPastSeasons']);
    // Nur aktive Spieler zählen für Anzeige
    const active=activePlayers();
    setConn(active.length+' Spieler · '+matches.length+' Matches','ok');
    await autoArchiveSeasons();
    if(window._updateRecapBtn) window._updateRecapBtn();
    if(window._updatePosHistBtn) window._updatePosHistBtn();
    render();
    // News-System v8.3: Stories aus DB synchronisieren.
    //   1. Generator erzeugt Story-Objekte aus Live-Daten
    //   2. INSERT ON CONFLICT DO NOTHING in Supabase
    //   3. SELECT der letzten 100 → memory cache
    //   4. Badge refresht aus memory cache
    // Bei DB-Fehler (Tabelle fehlt, Netz down): in-memory Fallback.
    // await blockiert loadAll, aber der vorherige render() ist schon durch
    // — User sieht UI, News-Badge folgt 100-500ms später.
    try {
      await syncStoriesViaDb();
    } catch(e){ console.warn('[news] sync failed', e); }
    try { if(window.newsBadgeRefresh) window.newsBadgeRefresh(); } catch(e){}
    // Automatisch aufpoppen dürfen nur zwei Dinge: der Wochen-Recap (POTW)
    // und der Saison-Abschluss. Der Tages-Recap (POTD) kam an jedem Spieltag
    // hoch — das war schlicht zu oft. Er ist weiterhin über den Button in
    // der Wochenliga erreichbar (showPotdRecap({force:true})).
    setTimeout(autoShowPotwRecap, 900);
  }catch(e){
    console.error(e); setConn('Verbindung fehlgeschlagen','bad');
    document.getElementById('main').innerHTML=`<div class="card"><div class="empty" style="color:var(--red)">
      <div class="ee"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="13"/><circle cx="12" cy="16.5" r=".6" fill="currentColor"/></svg></div>Konnte nicht laden.<br><span class="num" style="font-size:11px">${esc(e.message||e)}</span></div></div>`;
  }
}

// Automatischer Saison-Abschluss: archiviert vergangene Monate
async function autoArchiveSeasons(){
  const past=allPastSeasons(); // alle vergangenen Saison-IDs
  // gSim einmal pro Aufruf für isStale + Archive nutzen → konsistent
  const gSim=getGlobalSim();
  // Erkennt veraltete Archive in drei Fällen:
  //   1. Alle top_elo-Werte == 0 (alter Bug)
  //   2. Archivierte Top-Elo weicht von DB-aggregierter Sim ab → vor Slider-Recalc geschrieben
  //   3. Bestes Team weicht von DB-aggregierter Sim ab
  // → re-archivieren mit aktuellen DB-Werten (= gSim, da DB-First).
  const isStale=(s)=>{
    try{
      const t=typeof s.top_elo==='string'?JSON.parse(s.top_elo):(s.top_elo||[]);
      if(!t.length) return true; // noch nie archiviert
      if(t.every(x=>!x.elo)) return true; // alter Bug
      // Konsistenz-Check: archivierte Top-Elo vs aggregierte gSim
      const snap=gSim.seasonEndElos[s.id]||{};
      for(const entry of t){
        const live=Math.round(snap[entry.id] ?? cfg.start_elo);
        if(live !== entry.elo) return true; // Inkonsistenz → re-archive
      }
      return false;
    }catch{return false;}
  };
  // v9.18: Eine Saison ist erst dann fertig archiviert, wenn auch ihre Chronik
  // eingefroren ist. Saisons, die vor dieser Version archiviert wurden, laufen
  // dadurch genau einmal erneut durch die Schleife und bekommen `titles`.
  const validStored=new Set(seasons.filter(s=>!isStale(s)&&_frozenTitlesOf(s)).map(s=>s.id));
  for(const sid of past){
    if(validStored.has(sid))continue; // schon (korrekt) archiviert
    const ms=matchesInSeason(sid);
    if(!ms.length)continue; // keine Matches → nichts zu archivieren
    const snap=gSim.seasonEndElos[sid]||{};
    const seasonPlayedMap=gSim.seasonPlayed[sid]||{};
    // Wins/Losses pro Spieler in dieser Saison zählen (saison-isoliert)
    const sw={}, sl={};
    ms.forEach(m=>{
      [[m.a1,m.a2,m.winner==='A'],[m.b1,m.b2,m.winner==='B']].forEach(([x,y,won])=>{
        [x,y].forEach(id=>{
          if(won){ sw[id]=(sw[id]||0)+1; }
          else { sl[id]=(sl[id]||0)+1; }
        });
      });
    });
    const top=Object.keys(seasonPlayedMap).filter(id=>seasonPlayedMap[id]>0)
      .map(id=>({id,elo:Math.round(snap[id] ?? cfg.start_elo),wins:sw[id]||0,losses:sl[id]||0}))
      .sort((a,b)=>b.elo-a.elo);
    if(!top.length)continue;
    // Bestes Team: höchster gemeinsamer Elo-Zuwachs, mind. 2 gemeinsame Spiele
    // Spielanzahl pro Duo zählen
    if(!top.length)continue;
    // Bestes Team: höchster gemeinsamer Elo-Zuwachs, mind. 2 gemeinsame Spiele
    // Spielanzahl pro Duo zählen
    const teamGames={};
    ms.forEach(m=>{
      [[m.a1,m.a2],[m.b1,m.b2]].forEach(([x,y])=>{
        const k=[x,y].sort().join('|');
        teamGames[k]=(teamGames[k]||0)+1;
      });
    });
    const seasonTeamMap = gSim.seasonTeamElo[sid] || {};
    const teamEntries=Object.entries(seasonTeamMap)
      .filter(([k,v])=>v>0 && (teamGames[k]||0)>=2)
      .sort((a,b)=>b[1]-a[1]);
    const bestTeam=teamEntries[0]?teamEntries[0][0].split('|'):null;
    const entry={
      id:sid,
      label:seasonLabel(sid),
      start_date:seasonStart(sid).toISOString().slice(0,10),
      end_date:seasonEnd(sid).toISOString().slice(0,10),
      player_id:top[0].id,
      team_p1:bestTeam?bestTeam[0]:null,
      team_p2:bestTeam?bestTeam[1]:null,
      top_elo:JSON.stringify(top.slice(0,3)),
      // v9.18: Die fertige Monats-Chronik wird hier EINGEFROREN. Bis dahin wurde
      // jede vergangene Saison bei jedem Laden neu berechnet — eine Aenderung am
      // Katalog (neue Bedingung, andere Schwelle, geloeschter Eintrag) hat damit
      // rueckwirkend die Geschichte umgeschrieben. Ab jetzt gilt: Was im Mai
      // vergeben wurde, bleibt vergeben. Eingefroren werden auch die
      // Anzeigefelder (name, ic, tone, cond, ev), damit eine alte Saison sich
      // rendern laesst, ohne dass ihr Eintrag im heutigen Katalog noch existiert.
      titles:_freezeSeasonTitles(sid)
    };
    const{error}=await sb.from('seasons').upsert(entry,{onConflict:'id'});
    if(!error){
      const existIdx=seasons.findIndex(s=>s.id===sid);
      if(existIdx>=0) seasons[existIdx]=entry; else seasons.unshift(entry);
      console.log('Saison archiviert:',sid);
      // NEU: playerSeasonAwards und allPastSeasons invalidieren
      invalidateCache(['playerSeasonAwards', 'allPastSeasons']);
    }
    else console.error('Saison archivieren fehlgeschlagen:',sid,error);
  }
  // Recap-Popup: in den ersten 3 Tagen des neuen Monats anzeigen
      if(seasons.length&&new Date().getDate()<=3){
    const last=seasons[0];
// FIX
if(last && last.id !== currentSeason().id
   && !_recapSeen('recap_shown_'+last.id, 'season:'+last.id)){
  _autoRecapSeen.add('season:'+last.id); // Session-Guard: kein Re-Trigger durch 30s-loadAll
  setTimeout(()=>showSeasonRecap(last, {auto:true}),600);
}

  }

}

// ─── Auto-Recap „schon gezeigt?"-Guard (v9.6) ────────────────────────
// Kombiniert den persistenten localStorage-Marker mit einem In-Memory-Set.
// Grund für den Bug: loadAll() läuft alle 30 s und re-armt die Auto-Show-
// Timeouts (POTW/POTD/Saison). Auf manchen Browsern (Privatmodus, Storage-
// Partitionierung/ITP) persistiert localStorage NICHT — dann greift der
// „_shown"-Check nie und das Recap poppt bei jedem Tick erneut auf. Das Set
// überlebt die loadAll-Ticks der laufenden Session und verhindert die
// Wiederholung auch ohne funktionierendes localStorage. localStorage-Zugriffe
// sind zusätzlich gekapselt, damit ein throwendes setItem den Ablauf nicht bricht.
const _autoRecapSeen = new Set();
function _recapSeen(lsKey, sessKey){
  if(_autoRecapSeen.has(sessKey)) return true;
  try { if(localStorage.getItem(lsKey)) return true; } catch(e){}
  return false;
}
function _recapMarkSeen(lsKey, sessKey){
  _autoRecapSeen.add(sessKey);
  try { localStorage.setItem(lsKey, '1'); } catch(e){}
}

// v9: Kompakte Kurven-Vorschau des Saison-Positionsverlaufs für den Recap.
// Baut ein kleines Multi-Line-SVG (Rang 1 oben) aus getSeasonPositionHistory.
// Gecacht per Saison + matches.length + _cache.version → einmal pro Saison
// gebaut, danach reiner String-Return. Leerer String, wenn zu wenig Daten.
function _recapPosMiniSVG(ph){
  if(!ph || ph.empty) return '';
  const key = 'recapPosMini_'+ph.seasonId+'_'+matches.length+'_'+_cache.version;
  if(_cache._recapPosMiniKey === key) return _cache._recapPosMini;
  const W=78, H=38, padX=3, padY=4;
  const N = ph.activeIds.length, days = ph.lastDay;
  let svg = '';
  if(days >= 2 && N >= 1){
    const xOf = d => padX + (d/(days-1))*(W-2*padX);
    const yOf = rank => padY + ((rank-1)/Math.max(1,N-1))*(H-2*padY); // Rang 1 = oben
    let lines = '';
    for(const pid of ph.activeIds){
      const arr = ph.positionsByDay[pid] || [];
      const pts = [];
      for(let d=0; d<arr.length; d++){ if(arr[d]!=null) pts.push(xOf(d).toFixed(1)+','+yOf(arr[d]).toFixed(1)); }
      if(pts.length < 2) continue;
      const col = (ph.colorOf && ph.colorOf[pid]) || '#94a3b8';
      lines += `<polyline points="${pts.join(' ')}" fill="none" stroke="${col}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.92"/>`;
      const last = pts[pts.length-1].split(',');
      lines += `<circle cx="${last[0]}" cy="${last[1]}" r="1.7" fill="${col}"/>`;
    }
    if(lines) svg = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true">${lines}</svg>`;
  }
  _cache._recapPosMiniKey = key;
  _cache._recapPosMini = svg;
  return svg;
}

// Saison-Rückblick. Der ausführlichste der drei: er erzählt einen ganzen
// Monat. Die Reihenfolge ist die Erzählung — erst wer oben stand, dann das
// ganze Feld, dann was in diesem Monat entschieden wurde.
//
// Er baut aus den Bauteilen, die es in der App schon gibt [§C27]: das Podest
// ist `.podest`/`.pod-karte` wie in der Ewigen Tafel, die Rangliste ist
// `.rrow` wie im Liga-Tab. Vorher hatte er ein eigenes Podest mit farbigen
// Balken und eine eigene Listenform — beides sah neben dem Rest der
// Oberfläche gebastelt aus, und der Sieger stand zweimal da: einmal als
// Heldenkarte, einmal als erste Podestsäule.
//
// opts.auto=true  → Schutz-Phase (protectMs) gegen versehentliches Schließen,
//                   nur beim automatischen Auftauchen am Monatsanfang.
function showSeasonRecap(season, opts){
  opts = opts || {};
  _sheetSetReopen(()=>showSeasonRecap(season));
  const sid = season.id;
  const ms = matchesInSeason(sid);
  const spielerImMonat = new Set();
  ms.forEach(m=>[m.a1,m.a2,m.b1,m.b2].forEach(id=>spielerImMonat.add(id)));
  const tore = ms.reduce((s,m)=>s+(m.score_a||0)+(m.score_b||0),0);
  const tage = new Set(ms.map(mdayKey)).size;

  // ─── Die Rangliste der Saison — EINE Quelle für alles darunter ──────
  // Podest, Liste und der Schild im Wappen ziehen ihren Platz von hier.
  // Vorher rechnete das Podest aus season.top_elo und die Liste aus dem
  // Simulator: zwei Reihenfolgen, die bei Gleichstand auseinanderliefen.
  const gSim = getGlobalSim();
  const stand = gSim.seasonEndElos[sid] || {};
  const gespielt = gSim.seasonPlayed[sid] || {};
  // Die dritte Zahl der Zeile ist die Tordifferenz. Vorher stand dort der
  // Elo-Zuwachs des Monats — und der ist die Saison-Elo selbst: der
  // Simulator setzt zu jedem Monatsbeginn auf den Startwert zurück. In
  // jeder Zeile stand damit zweimal dieselbe Zahl.
  const sw = {}, sl = {}, gf = {}, ga = {};
  ms.forEach(m=>{
    [[m.a1,m.a2,m.winner==='A',m.score_a,m.score_b],
     [m.b1,m.b2,m.winner==='B',m.score_b,m.score_a]].forEach(([x,y,won,f,g])=>{
      [x,y].forEach(id=>{
        if(won) sw[id]=(sw[id]||0)+1; else sl[id]=(sl[id]||0)+1;
        gf[id]=(gf[id]||0)+(f||0); ga[id]=(ga[id]||0)+(g||0);
      });
    });
  });
  const rang = Object.keys(gespielt).filter(id=>gespielt[id]>0 && pmap()[id])
    .map(id=>({id, elo:Math.round(stand[id] ?? cfg.start_elo),
               wins:sw[id]||0, losses:sl[id]||0, diff:(gf[id]||0)-(ga[id]||0)}))
    .sort((a,b)=>b.elo-a.elo);

  // ─── Podest ────────────────────────────────────────────────────────
  // Dasselbe Bauteil wie in der Ewigen Tafel [§C27]: drei Karten, der Erste
  // höher und wärmer, das Wappen mit Banner. Die Zahl im Schild ist der
  // Platz dieser Saison, die Schwingen zählen die Titel bis zu ihr — ein
  // Rückblick auf den Mai darf nicht die Titel vom August tragen [§C26].
  let podestHtml = '';
  if(rang.length){
    const METALL = ['gold','silber','bronze'];
    const karte = (e, platz) => {
      const p = pmap()[e.id];
      const titelBis = seasons.filter(x => x.id <= sid && seasonChampion(x.id) === e.id).length;
      const av = avHtml(p, '', {ins:true, band:true, pos:platz, titel:titelBis, feuer:0,
                                px:platz===1?92:78, klasse:'pod-av'});
      // Ohne Titel steht dort die Spielzahl — ein Strich sieht aus, als
      // fehlte die Zahl, statt zu sagen: dieser Spieler hat noch keinen.
      const sub = titelBis
        ? titelBis + (titelBis === 1 ? ' Titel' : ' Titel')
        : (e.wins + e.losses) + ' Spiele';
      return `<div class="pod-karte ${METALL[platz-1]}${platz===1?' erster':''}" data-detail="${esc(e.id)}">
        <div class="pod-platz num">${String(platz).padStart(2,'0')}</div>
        ${av}
        <div class="pod-name">${esc(p.name)}</div>
        <div class="pod-wert num">${e.elo}</div>
        <div class="pod-sub num">${esc(sub)}</div>
      </div>`;
    };
    const folge = [rang[1], rang[0], rang[2]], plaetze = [2,1,3];
    podestHtml = `<div class="podest rcp-podest">${
      folge.map((e,k)=> e ? karte(e, plaetze[k]) : '<div class="pod-leer"></div>').join('')}</div>`;
  }

  // ─── Team der Saison ───────────────────────────────────────────────
  let teamHtml='';
  if(season.team_p1 && season.team_p2){
    const a=season.team_p1, b=season.team_p2;
    let tg=0, tw=0;
    ms.forEach(m=>{
      const aufA=(m.a1===a||m.a2===a)&&(m.a1===b||m.a2===b);
      const aufB=(m.b1===a||m.b2===a)&&(m.b1===b||m.b2===b);
      if(aufA){ tg++; if(m.winner==='A')tw++; }
      else if(aufB){ tg++; if(m.winner==='B')tw++; }
    });
    teamHtml = `<div class="rcp-tos klick" data-team="${esc([a,b].sort().join('|'))}">
      <div class="rcp-tos-pair">${rcpPaarHtml([a,b],40)}</div>
      <div class="rcp-tos-info">
        <div class="rcp-tos-label">Team der Saison</div>
        <div class="rcp-tos-name">${esc(pname(a)+' & '+pname(b))}</div>
        <div class="rcp-tos-detail num">${tg?tg+' Spiele · '+Math.round(tw/tg*100)+'% Siegrate':'–'}</div>
      </div>
    </div>`;
  }

  // ─── Rangliste 1.–x. ───────────────────────────────────────────────
  // Dieselbe Zeile wie im Liga-Tab [§C27], nur ohne Formpunkte: die letzten
  // fünf Spiele sind eine Aussage über HEUTE und haben in einem
  // abgeschlossenen Monat nichts zu suchen.
  let listeHtml='';
  if(rang.length){
    listeHtml = rcpAbschnitt('Rangliste', rang.length) + `<div class="rlist">${
      rang.map((e,i)=>{
        const p = pmap()[e.id];
        const sp = e.wins + e.losses;
        const wr = sp ? Math.round(e.wins/sp*100) : 0;
        return `<div class="rrow${i<3?' top'+(i+1):''}" data-detail="${esc(e.id)}">
          <span class="pos num">${i+1}</span>
          ${avHtml(p, '', {ins:true, px:52, feuer:0})}
          <div class="rmid">
            <div class="rname">${esc(p.name)}</div>
            <div class="rmeta"><span>${e.wins}–${e.losses}</span>
              <span class="wbar"><i style="width:${wr}%"></i></span><span>${wr}%</span></div>
          </div>
          <div class="rval"><div class="big num">${e.elo}</div>
            <div class="small num ${e.diff>=0?'plus':'minus'}">${e.diff>=0?'+':''}${e.diff} Tore</div></div>
        </div>`;
      }).join('')}</div>`;
  }

  // ─── Positionsverlauf ──────────────────────────────────────────────
  let verlaufHtml='';
  try {
    const mini = _recapPosMiniSVG(getSeasonPositionHistory(sid));
    if(mini){
      verlaufHtml = `<button type="button" class="rcp-posmini" data-poshist="${esc(sid)}">
        <span class="rcp-posmini-chart">${mini}</span>
        <span class="rcp-posmini-tx"><span class="rcp-posmini-tt">Positionsverlauf</span><span class="rcp-posmini-su">Wer wann wo stand</span></span>
      </button>`;
    }
  } catch(err){}

  // ─── Chronik der Saison ────────────────────────────────────────────
  // Als Zeilen, nicht als Plaketten: sechs Plaketten waren allein 547 px
  // und sechs verschiedene Farbtöne. Die volle Tafel ist einen Tipp weit
  // weg, und dort gehören die Plaketten hin.
  let chronikHtml='';
  try {
    const T = seasonTitles(sid);
    if(T.awarded.length){
      chronikHtml = rcpAbschnitt('Chronik der Saison', T.awarded.length) + `<div class="rcp-liste">${
        T.awarded.slice(0,5).map(a=>rcpZeileHtml({pid:a.pid, px:38,
          ic:a.ic, ton:a.tone, name:a.name, sub:pname(a.pid),
          attr:`data-tplayer="${esc(a.pid)}"`})).join('')}</div>`
        + `<div class="rcp-mehr klick" data-stafel="${esc(sid)}">${
            T.awarded.length>5 ? 'Alle '+T.awarded.length+' Einträge' : 'Die ganze Tafel'}</div>`;
    }
  } catch(err){}

  // ─── Rekorde, die in diesem Monat gefallen sind ────────────────────
  // Nicht die Rekordliste von heute, sondern der Unterschied zwischen dem
  // Stand am Monatsende und dem am Ende des Vormonats — siehe saisonRekorde.
  let rekordHtml='';
  try {
    const REK = saisonRekorde(sid);
    if(REK.length){
      const wort = {neu:'zum ersten Mal', geholt:'übernommen', gesteigert:'verbessert'};
      rekordHtml = rcpAbschnitt('Rekorde dieser Saison', REK.length) + `<div class="rcp-liste">${
        REK.slice(0,5).map(r=>rcpZeileHtml({pid:r.pid, px:38,
          ic:r.ic, ton:r.tone, name:r.name, sub:pname(r.pid)+' · '+wort[r.art],
          rechts:r.zeit || '', attr:`data-chron="${esc(r.id)}"`})).join('')}</div>`
        + (REK.length>5 ? `<div class="rcp-mehr klick" data-ligarek="1">und ${REK.length-5} weitere</div>` : '');
    }
  } catch(err){}

  // ─── Auszeichnungen der Saison ─────────────────────────────────────
  const vorherAw = awSeasonId;
  awSeasonId = sid;
  const R = awardRankings('season');
  awSeasonId = vorherAw;
  const eins = (x)=> x && x[0];
  const kacheln = [];
  const scorer=eins(R.scorer), wall=eins(R.wall), streak=eins(R.streaks), upset=eins(R.upsets);
  const grinder=eins(R.grinder), perfect=eins(R.perfect);
  const weekKing=eins(R.weekKingList), dayKing=eins(R.dayKingList);
  const worstWr=eins(R.worstWr), pechvogel=eins(R.pechvogelList);
  // Metall, nicht Gold. Gold gehört den Titeln [§C25] — und wenn acht
  // Kacheln golden umrandet sind, sagt Gold nichts mehr. Auf dieser Seite
  // trägt es das Podest, sonst nichts.
  const kachel=(ic,label,name,wert,key)=>kacheln.push(rcpKachelHtml({
    ic, label, name, wert, ton:'metall', attr:`data-award="${key}"`}));
  if(scorer)  kachel('ball','Torjäger',pname(scorer.id),'Ø '+scorer.avg.toFixed(1)+' Tore','scorer');
  if(wall)    kachel('shieldCheck','Eiserne Abwehr',pname(wall.id),(wall.v/wall.g).toFixed(1)+' Gegen/Sp.','wall');
  if(streak)  kachel('flame','Heißeste Serie',pname(streak.id),streak.v+' in Folge','streaks');
  if(perfect) kachel('star','Beste Bilanz',pname(perfect.id),Math.round(perfect.wr*100)+'% Siegrate','perfect');
  if(weekKing)kachel('crown','Wochenkönig',pname(weekKing.id),weekKing.v+'× POTW','weekKing');
  if(dayKing) kachel('crown','Tageskönig',pname(dayKing.id),dayKing.v+'× POTD','dayKing');
  if(grinder) kachel('gamepad','Vielspieler',pname(grinder.id),grinder.v+' Spiele','grinder');
  if(upset){
    const sieger = upset.m.winner==='A'?[upset.m.a1,upset.m.a2]:[upset.m.b1,upset.m.b2];
    kachel('bolt','Größter Upset',pname(sieger[0])+' & '+pname(sieger[1]),
           Math.round((1-upset.sp)*100)+'% Chance','upset');
  }
  // Die Schattenseiten stehen hinten und in Rot — Rot sagt hier die
  // Richtung, nicht die Wichtigkeit [§C25].
  if(worstWr) kacheln.push(rcpKachelHtml({ic:'ghost',label:'Schlechtester',
    name:pname(worstWr.id),wert:Math.round(worstWr.wr*100)+'% Siegrate',ton:'red',
    attr:'data-award="worstWr"'}));
  if(pechvogel) kacheln.push(rcpKachelHtml({ic:'ghost',label:'Pechvogel',
    name:pname(pechvogel.id),wert:Math.round(pechvogel.pct*100)+'% knapp verloren',ton:'red',
    attr:'data-award="pechvogel"'}));
  // Eine ungerade Kachel nimmt die ganze Reihe, statt ein Loch zu lassen.
  const awardsHtml = kacheln.length
    ? rcpAbschnitt('Auszeichnungen', kacheln.length)
      + `<div class="rcp-awards${kacheln.length%2?' ungerade':''}">${kacheln.join('')}</div>` : '';

  // ─── Saison-Wähler im Kopf ─────────────────────────────────────────
  // Dasselbe Bauteil wie im Liga-Tab [§C27]. Der laufende Monat fehlt, er
  // hat keinen Rückblick.
  const vergangene = seasons.filter(s => s.id !== currentSeason().id)
    .map(s => s.id).sort().reverse();

  openSheet(
    rcpKopfHtml({ic:'trophy', marke:'Saison beendet', titel:season.label,
      extra:saisonWaehlerHtml('rcpSaisonwahl', sid, {liste:vergangene, attr:'rcpsaison'})})
    // Die Eckdaten als Streifen statt als Textzeile: vier Zahlen in einer
    // Zeile Fließtext liest niemand, vier Felder schon.
    + rcpZahlenHtml([
        {v:ms.length, l:'Matches'}, {v:tage, l:'Spieltage'},
        {v:spielerImMonat.size, l:'Spieler'}, {v:tore, l:'Tore'}])
    + rcpAbschnitt('Podest') + podestHtml + teamHtml
    + listeHtml + verlaufHtml + chronikHtml + rekordHtml + awardsHtml
    + `<button class="recap-done-btn" id="closeRecapBtn">Verstanden</button>`,
    {protectMs: opts.auto ? 2500 : 0});

  // Grab-Hint: kurz pulsieren, signalisiert „wegziehen geht auch"
  const _grab = document.getElementById('sheetGrab');
  if(_grab) _grab.classList.add('grab-pulse');

  const merken = () => _recapMarkSeen('recap_shown_'+sid, 'season:'+sid);
  document.getElementById('closeRecapBtn').onclick = () => { merken(); closeSheet(); };
  const wurzel = document.getElementById('sheet');
  wurzel.querySelectorAll('[data-rcpsaison]').forEach(b => b.onclick = () => {
    const s = seasons.find(x => x.id === b.dataset.rcpsaison);
    if(s) showSeasonRecap(s);
  });
  const binden = (sel, fn) => wurzel.querySelectorAll(sel).forEach(el => {
    el.onclick = () => { merken(); fn(el); };
  });
  binden('[data-detail],[data-tplayer]', el =>
    sheetNav(()=>showPlayer(el.dataset.detail || el.dataset.tplayer)));
  binden('.rcp-tos[data-team]', el => {
    const paar = el.dataset.team.split('|');
    if(paar[0]&&paar[1]) sheetNav(()=>showTeam(paar[0],paar[1]));
  });
  binden('[data-award]', el => {
    awPeriod='season'; awSeasonId=sid;
    sheetNav(()=>showAward(el.dataset.award));
  });
  binden('[data-poshist]', el => sheetNav(()=>showPositionHistory(el.dataset.poshist)));
  binden('[data-stafel]', el => sheetNav(()=>showSeasonTable(el.dataset.stafel)));
  binden('[data-chron]', el => sheetNav(()=>showChronicle(el.dataset.chron)));
  binden('[data-ligarek]', () => sheetNav(()=>showLigaChronik()));
}

// Player-of-the-Day Recap: zeigt einmal pro Tag pro Gerät den Sieger des letzten Spieltags.
// ─── §3.3 Player-of-the-Week / Player-of-the-Day Recap ───────────────
// Helfer: Bereich der zuletzt abgeschlossenen Woche (Mo 00:00 – So 23:59:59.999)
function _potwLastWeekRange(){
  const now=new Date();
  const monday=new Date(now); monday.setHours(0,0,0,0);
  const wd=(monday.getDay()+6)%7;       // 0=Mo
  monday.setDate(monday.getDate()-wd);  // Montag DIESER Woche
  // Eine Woche gilt ab Sonntag 23:00 als abgeschlossen, nicht erst ab Montag
  // 00:00. Der Wochenrückblick stand vorher über den Montag verteilt in sechs
  // Karten und verdeckte damit den Spieltag, um den es gerade ging. Die letzte
  // Stunde kostet nichts: keine der 466 Partien hat nach 18 Uhr angefangen.
  const abschluss=new Date(monday); abschluss.setDate(abschluss.getDate()+6); abschluss.setHours(23,0,0,0);
  if(now.getTime() < abschluss.getTime()) monday.setDate(monday.getDate()-7);
  const end=new Date(monday); end.setDate(end.getDate()+7); end.setMilliseconds(-1);
  return {start:monday, end};
}
function _potwKeyOf(monday){
  return monday.getFullYear()+'-'+String(monday.getMonth()+1).padStart(2,'0')+'-'+String(monday.getDate()).padStart(2,'0');
}
function _potwMatchesInRange(start,end){
  return matches.filter(m=>{const d=new Date(m.created_at); return d>=start && d<=end;});
}
// True wenn die Vorwoche mindestens 1 Match hatte (für Button-Sichtbarkeit)
function potwHasData(){
  const {start,end}=_potwLastWeekRange();
  return _potwMatchesInRange(start,end).length>0;
}

