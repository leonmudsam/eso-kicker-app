// ╔═══ §5.1 ─── VIEW: RANKING ──────────────────────────────────────────╗
//     Zeigt Saison/Woche/Gesamt-Rangliste, Hall of Fame, POTW/POTD.
// ╚═════════════════════════════════════════════════════════════════════════╝
function vRanking(){ return _vRankingCore() + _seasonToolsHtml(); }
// v9: „Saison-Tools" am Ende der Rangliste — Recap + Positionsverlauf, aus dem
// App-Header hierher verschoben (Idee E). Konditional wie die alten Buttons:
//   • Recap nur wenn eine vergangene Saison existiert
//   • Positionsverlauf nur wenn die aktuelle Saison ≥1 Match hat
// Leichtgewichtig: nur zwei billige Längen-Checks (matchesInSeason ist gecached).
function _seasonToolsHtml(){
  const cur = currentSeason();
  const hasPos = matchesInSeason(cur.id).length > 0;
  const past = seasons.filter(s => s.id !== cur.id);
  const hasRecap = past.length > 0;
  if(!hasPos && !hasRecap) return '';
  const recapIc = `<svg viewBox="0 0 24 24"><path d="M7 4v6a5 5 0 0010 0V4H7zM7 4H4v2a3 3 0 003 3M17 4h3v2a3 3 0 01-3 3M12 15v3M9 21h6"/></svg>`;
  const posIc   = `<svg viewBox="0 0 24 24"><path d="M5 21V11M12 21V7M19 21V3M3 21h18"/></svg>`;
  let cards = '';
  if(hasRecap){
    cards += `<button type="button" class="st-card recap" data-seasontool="recap">
      <span class="st-ic">${recapIc}</span><span class="st-tt">Saison-Recap</span>
      <span class="st-su">${esc(seasonLabel(past[0].id))} ansehen</span></button>`;
  }
  if(hasPos){
    cards += `<button type="button" class="st-card pos" data-seasontool="pos">
      <span class="st-ic">${posIc}</span><span class="st-tt">Positionsverlauf</span>
      <span class="st-su">Saison-Entwicklung</span></button>`;
  }
  const one = (hasRecap && hasPos) ? '' : ' one';
  return `<div class="seasontools"><div class="st-sec">Saison-Tools</div><div class="st-grid${one}">${cards}</div></div>`;
}
function _vRankingCore(){
  // Welche Saison gezeigt wird, steht an EINER Stelle — und nur unter
  // „Saison" gibt es dazu etwas zu wählen. Woche, Tag und Gesamt kennen
  // keine Saison.
  const sid = ligaSaisonId(), laeuft = ligaSaisonLaeuft();
  const saisonArg = period==='season' ? sid : undefined;
  const periodBar=`
    <div class="ui-tabs">
      <button data-period="season" class="${period==='season'?'on':''}">Saison</button>
      <button data-period="week" class="${period==='week'?'on':''}">Woche</button>
      <button data-period="day" class="${period==='day'?'on':''}">Tag</button>
      <button data-period="all" class="${period==='all'?'on':''}">Gesamt</button>
    </div>
    ${period==='season'?saisonWaehlerHtml('ligaSeasonPicker', sid):''}`;

  // ZEITRAUM-ANSICHT (Tag/Woche/Monat)
  if(period!=='all'){
    let ps=periodPlayerStats(period, saisonArg);
    // Match-Liste des Zeitraums einmalig cachen — wird in formDots pro Spieler aufgerufen
    const periodMs=matchesInPeriod(period, saisonArg);
    // Sortierung nach der gewählten Metrik [§C28]. Die Leitgröße steht in
    // PERIOD_METRICS an erster Stelle: Saison die Elo, Woche und Tag die
    // Siege. Die Tie-Breaker bleiben, wie sie waren — sie entscheiden
    // Gleichstände, nicht die Reihenfolge.
    const mQuote=(x)=>x.games?x.wins/x.games:0;
    const metrik=metrikFuer(period);
    const sortierer={
      elo: period==='season'
        ? (a,b)=>b.elo-a.elo||b.wins-a.wins
        : (a,b)=>b.eloNet-a.eloNet||b.wins-a.wins||mQuote(b)-mQuote(a)||b.gd-a.gd,
      wins:     (a,b)=>b.wins-a.wins||mQuote(b)-mQuote(a)||b.gd-a.gd||b.eloNet-a.eloNet,
      winrate:  (a,b)=>mQuote(b)-mQuote(a)||b.wins-a.wins||b.gd-a.gd,
      goaldiff: (a,b)=>b.gd-a.gd||b.wins-a.wins||mQuote(b)-mQuote(a),
      streak:   (a,b)=>b.curStreak-a.curStreak||b.wins-a.wins,
      games:    (a,b)=>b.games-a.games||b.wins-a.wins
    };
    ps.sort(sortierer[metrik]||sortierer.elo);
    // Saison-Champion: höchste Saison-Elo. Woche/Tag: identisch zur POTW/POTD-Badge-Logik.
    const totalMatches=periodMs.length;
    let winner;
    if(period==='season'){
      winner=ps.length&&ps[0].games>0?ps[0]:null;
    } else {
      const minWins = period==='week' ? 5 : period==='day' ? 3 : 1;
      const qual=ps.filter(x=>x.wins>=minWins);
      // ────────────────────────────────────────────────────────────────
      // Tie-Break IDENTISCH zur POTW/POTD-Badge-Logik:
      //   • Woche: WR desc → Siege desc → Elo-Delta desc
      //     (siehe POTW-Recap, Zeile ~3604)
      //   • Tag:   Siege desc → Elo-Delta desc
      //     (siehe showPotdRecap, Zeile ~4015)
      // Wichtig: der Sieger darf NICHT von der gewählten Metrik abhängen — sonst
      // wechselt die Hero-Card je nach "Nach Siegen"/"Nach Elo"-Filter
      // (das war der Bug: zwei Spieler mit 4W-1L 80% wurden je nach
      // Sortierung verschieden als Tagessieger angezeigt).
      // ────────────────────────────────────────────────────────────────
      if(period==='week'){
        winner=qual.length?[...qual].sort((a,b)=>
          (b.wins/b.games)-(a.wins/a.games)
          ||b.wins-a.wins
          ||b.eloNet-a.eloNet
        )[0]:null;
      } else {
        // period==='day' — exakt analog showPotdRecap
        winner=qual.length?[...qual].sort((a,b)=>
          b.wins-a.wins
          ||b.eloNet-a.eloNet
        )[0]:null;
      }
    }
    // ── Eine Zeile, ein Bauplan [§C27] ───────────────────────────────
    // Jede Zeile der Liga hat dieselbe Anatomie: Platzziffer links, Avatar
    // im Wappen, Name mit Zeichen, Zahlen rechts. Vorher waren die ersten
    // drei breiter, trugen eine Metallplakette statt der Ziffer und einen
    // größeren Avatar — drei Ausnahmen für dieselbe Aussage, die der
    // Farbstreifen am linken Rand ohnehin schon macht. Jetzt trägt das
    // Metall nur noch die Ziffer, und der Rest ist überall gleich.
    const RAV = 52;
    // „Der brennt gerade" ist Gegenwart. In einer abgeschlossenen Saison
    // gibt es kein Gerade — dort bleibt der Avatar kalt.
    const feuerAn = period!=='season' || laeuft;
    // Form der letzten 5 Matches (W/L Punkte) — nutzt das gecachte periodMs
    const formDots=(id)=>{
      const ms2=periodMs.filter(m=>[m.a1,m.a2,m.b1,m.b2].includes(id))
        .sort((a,b)=>mts(b)-mts(a)).slice(0,5).reverse();
      return ms2.map(m=>{const onA=(id===m.a1||id===m.a2);
        const w=(onA&&m.winner==='A')||(!onA&&m.winner==='B');
        return `<div class="dot ${w?'w':'l'}"></div>`;}).join('');
    };
    // Niederlagenserien brauchen weiterhin ihr Zeichen neben dem Namen —
    // Siegesserien brennen am Avatar [§C26].
    const streakBadge=(cs)=>{
      if(cs<=-3){
        const drops = cs<=-7 ? 'dropTriple' : cs<=-5 ? 'dropDouble' : 'drop';
        return `<span class="streak-badge fire" title="${-cs}er Niederlagenserie">${svgI(drops)}</span>`;
      }
      return '';
    };
    // Die rechte Spalte spricht die gewählte Metrik. „Elo" heißt im
    // Zeitraum der Zuwachs, in der Saison der Stand.
    const wertVon=(x)=>{
      const wr=x.games?Math.round(x.wins/x.games*100):0;
      if(metrik==='wins')     return {big:x.wins, small:'Siege'};
      if(metrik==='winrate')  return {big:wr+'%', small:x.wins+'–'+x.losses};
      if(metrik==='goaldiff') return {big:(x.gd>=0?'+':'')+x.gd, small:'Tordiff'};
      if(metrik==='streak')   return {big:x.curStreak>0?x.curStreak+'W':x.curStreak<0?(-x.curStreak)+'L':'–',
                                      small:x.curStreak>0?'Siege':x.curStreak<0?'Niederlagen':'neutral'};
      if(metrik==='games')    return {big:x.games, small:'Spiele'};
      return period==='season'
        ? {big:x.elo, small:'Elo'}
        : {big:(x.eloNet>=0?'+':'')+x.eloNet, small:'Elo'};
    };
    // Der Erste bekommt eine Aufschrift — aber nur, wenn nach der Leitgröße
    // sortiert ist. Unter „Tordiff" wäre „Player of the Season" eine
    // Behauptung über eine Tabelle, die etwas anderes zeigt.
    const leitgroesse = (PERIOD_METRICS[period]||PERIOD_METRICS.all)[0];
    const zeigtKopf   = period==='season' && metrik===leitgroesse;
    const zeile=(x,i,kopf)=>{
      const p=pmap()[x.id]; if(!p)return '';
      const w=wertVon(x);
      const wr=x.games?Math.round(x.wins/x.games*100):0;
      const cls=(i<3?' top'+(i+1):'')+(kopf?' held':'');
      const dots=formDots(x.id);
      return `<div class="rrow${cls}" data-detail="${x.id}"${kopf?' id="seasonLeaderCard"':''}>
        <span class="pos num">${i+1}</span>
        ${avHtml(p, '', {ins:true, px:RAV, feuer:feuerAn?undefined:0})}
        <div class="rmid">
          ${kopf?`<div class="held-label">${esc(kopf.label)}${
            kopf.gap?`<span class="held-gap">${esc(kopf.gap)}</span>`:''}</div>`:''}
          <div class="rname">${esc(p.name)}${
            _titleMarkHtml(x.id, i<3?'lg':'', {ohneChamp:true, einfarbig:true})}${
            streakBadge(x.curStreak)}</div>
          <div class="rmeta"><span>${x.wins}–${x.losses}</span>
            <span class="wbar"><i style="width:${wr}%"></i></span><span>${wr}%</span></div>
          ${dots||x.games?`<div class="rzuletzt">
            ${dots?`<div class="form-dots">${dots}</div>`:''}
            ${x.games?`<div class="elo-gain-bar"><span class="gain">+${x.eloGain}</span><span class="loss">${x.eloLoss}</span></div>`:''}
          </div>`:''}
        </div>
        <div class="rval"><div class="big num">${w.big}</div><div class="small">${w.small}</div></div>
      </div>`;
    };

    // Player of the Season: Vorsprung auf Platz 2
    const gap2=ps.length>=2&&winner?Math.round(winner.elo-(ps.find(x=>x.id!==winner.id)||{elo:0}).elo):0;
    const kopfZeile = zeigtKopf && winner && ps.length && ps[0].id===winner.id
      ? {label:'Player of the Season', gap:gap2>0?`+${gap2} vor`:''}
      : null;
    const rows = ps.map((x,i)=>zeile(x,i,i===0?kopfZeile:null)).join('');
    const leerZeile = (period==='season' && laeuft && !winner)
      ? `<div class="rrow held leer"><span class="pos num">1</span>
           <div class="held-av-leer">?</div>
           <div class="rmid"><div class="held-label">Player of the Season</div>
             <div class="rname">noch offen</div>
             <div class="rmeta"><span>Saison läuft</span></div></div>
         </div>` : '';

    // ── Die Nebenwertungen [§C28] ────────────────────────────────────
    // Ein Band über der Tabelle, in jedem Zeitraum an derselben Stelle und
    // in derselben Form: eine breite Karte für die Hauptnebenwertung, dann
    // kleine Kacheln. In der Saison führt das Team der Saison — es stand
    // vorher als schmale Leiste ganz unten unter der Liste, wo es keiner
    // sucht. In Woche und Tag führt der Spieler des Zeitraums: er ist dort
    // kein Tabellenerster, sondern ein Titel mit eigener Regel (Mindestzahl
    // Siege, beste Quote), und gehört deshalb neben die Tabelle, nicht
    // hinein.
    const chipAv=(pid)=>{
      const pp=pmap()[pid];
      if(!pp) return `<div class="sh-chip-av" style="background:var(--surface3);color:var(--muted)">?</div>`;
      const em=pp.avatar_id?avatarEmoji(pp.avatar_id):null;
      if(em) return `<div class="sh-chip-av" style="background:var(--surface3);color:inherit;font-size:13px">${em}</div>`;
      return `<div class="sh-chip-av" style="background:${avColor(pid)}">${esc(initials(pp.name))}</div>`;
    };
    let nebenHtml='';

    if(period==='season'){
      // Team of Season = höchster gemeinsamer Elo-Zuwachs (aus globalSim)
      // sid mitgeben: ohne ihn holt der Helfer die Elo-Zuwächse der LAUFENDEN
      // Saison und zählt die Spiele der gewählten — in einer alten Saison
      // stand dann der August-Zuwachs neben der Juni-Bilanz.
      const teamEntries=_seasonTeamRanking(periodMs, sid);
      const best=teamEntries[0];
      if(best){
        const paar=best.ids.map(id=>{
          const pp=pmap()[id];
          return pp?avHtml(pp,'',{ins:true,px:44,feuer:feuerAn?undefined:0}):'';
        }).join('');
        const g=Math.round(best.elo);
        const neben=teamEntries.slice(1,3).map((t,k)=>`
          <div class="nw-z">
            <span class="p num">${k+2}</span>
            <span class="sh-chip-pair">${chipAv(t.ids[0])}${chipAv(t.ids[1])}</span>
            <span class="n">${esc(t.ids.map(pname).join(' & '))}</span>
            <span class="v num">${Math.round(t.elo)>=0?'+':''}${Math.round(t.elo)}</span>
          </div>`).join('');
        nebenHtml=`
          <div class="nw-hero gold" id="seasonTeamCard" data-toplist="seasonTeam">
            <div class="nw-h"><span class="l">Team der Saison</span>
              <span class="m">${teamEntries.length} Duo${teamEntries.length===1?'':'s'} · Elo-Zuwachs</span></div>
            <div class="nw-body">
              <span class="nw-paar">${paar}</span>
              <div class="nw-mid">
                <div class="nw-name">${esc(best.ids.map(pname).join(' & '))}</div>
                <div class="nw-meta">${best.w} Siege aus ${best.g} gemeinsamen Spielen</div>
              </div>
              <div class="nw-val"><div class="v num">${g>=0?'+':''}${g}</div><div class="l">Elo</div></div>
            </div>
            ${neben?`<div class="nw-neben">${neben}</div>`:''}
          </div>`;
      } else {
        nebenHtml=`
          <div class="nw-hero" id="seasonTeamCard">
            <div class="nw-h"><span class="l">Team der Saison</span><span class="m">noch offen</span></div>
            <div class="nw-leer">min. 2 gemeinsame Spiele</div>
          </div>`;
      }
    }

    if(period==='week'||period==='day'){
      const titelTxt   = period==='day' ? 'Player of the Day' : 'Player of the Week';
      const regelTxt   = period==='day' ? 'min. 3 Siege · meiste Siege'
                                        : 'min. 5 Siege · beste Quote';
      const eloLabel   = period==='day' ? 'Elo Tag' : 'Elo Woche';
      if(winner){
        const wp=pmap()[winner.id];
        const wWr=winner.games?Math.round(winner.wins/winner.games*100):0;
        nebenHtml=`
          <div class="nw-hero gold" data-detail="${winner.id}">
            <div class="nw-h"><span class="l">${titelTxt}</span><span class="m">${regelTxt}</span></div>
            <div class="nw-body">
              ${avHtml(wp,'',{ins:true,px:56})}
              <div class="nw-mid">
                <div class="nw-name">${esc(wp.name)}</div>
                <div class="nw-meta">${winner.wins}–${winner.losses} · ${wWr}% Quote</div>
              </div>
              <div class="nw-val"><div class="v num${winner.eloNet<0?' minus':''}">${
                winner.eloNet>=0?'+':''}${winner.eloNet}</div><div class="l">${eloLabel}</div></div>
            </div>
          </div>`;
      } else {
        nebenHtml=`
          <div class="nw-hero">
            <div class="nw-h"><span class="l">${titelTxt}</span><span class="m">${regelTxt}</span></div>
            <div class="nw-leer">noch offen</div>
          </div>`;
      }

      // Wochen-/Tages-Highlights: Bestes Team / Heißeste Serie / Größter
      // Upset / König. Alle vier aus geteilten Helpern — die Kachel zeigt
      // [0], das Top-5-Sheet (data-toplist) die ersten fünf.
      const bestTeam=_teamEloRanking(periodMs,1).filter(t=>t.elo>0)[0];
      const topStreak=longestStreaks(periodMs)[0];
      const topUpset=_upsetRanking(periodMs)[0];
      const renderHl=(cls,labelTxt,iconKey,nameTxt,detailTxt,clickAttr='')=>{
        if(!nameTxt) return `<div class="wk-hl empty">
          <div class="wk-hl-ic">${svgI(iconKey)}</div>
          <div class="wk-hl-label">${labelTxt}</div>
          <div class="wk-hl-val">–</div>
          <div class="wk-hl-detail">noch keine Daten</div>
        </div>`;
        return `<div class="wk-hl ${cls}" ${clickAttr} style="cursor:pointer">
          <div class="wk-hl-ic">${svgI(iconKey)}</div>
          <div class="wk-hl-label">${labelTxt}</div>
          <div class="wk-hl-val">${esc(nameTxt)}</div>
          <div class="wk-hl-detail">${detailTxt}</div>
        </div>`;
      };
      const upsetWinners=topUpset?(topUpset.m.winner==='A'?[topUpset.m.a1,topUpset.m.a2]:[topUpset.m.b1,topUpset.m.b2]):null;
      const upsetName=upsetWinners?(pname(upsetWinners[0])+' & '+pname(upsetWinners[1])):null;
      const teamName=bestTeam?`${pname(bestTeam.ids[0])} & ${pname(bestTeam.ids[1])}`:null;
      // All-Time POTW-/POTD-König (Award aus dem Awards-Tab). Die Listen
      // stammen aus _awardRankingsUncached('all'); der laufende Zeitraum
      // ist dort schon ausgeschlossen, der Cache verhindert Neuberechnung.
      const _allRanks=getCachedAwardRankings('all');
      const _kingList=period==='week'?(_allRanks.weekKingList||[]):(_allRanks.dayKingList||[]);
      const topKing=_kingList[0]||null;
      nebenHtml+=`
        <div class="wk-highlights">
          ${renderHl('team','Bestes Team','handshake', teamName, bestTeam?`+${Math.round(bestTeam.elo)} Elo`:'', bestTeam?'data-toplist="periodTeam"':'')}
          ${renderHl('streak','Heißeste Serie','flame', topStreak?pname(topStreak.id):null, topStreak?`${topStreak.v} in Folge`:'', topStreak?'data-toplist="periodStreak"':'')}
          ${renderHl('upset','Größter Upset','bolt', upsetName, topUpset?`${topUpset.winPct}% Chance`:'', topUpset?'data-toplist="periodUpset"':'')}
          ${renderHl('king', period==='week'?'Wochenkönig':'Tageskönig', period==='week'?'weekKing':'dayKing',
              topKing?pname(topKing.id):null,
              topKing?`${topKing.v}× ${period==='week'?'Player of Week':'Player of Day'}`:'',
              topKing?'data-toplist="periodKing"':'')}
        </div>`;

      // Der Recap-Knopf zeigt den ABGESCHLOSSENEN Zeitraum — er gehört
      // deshalb unter die Nebenwertungen des laufenden, nicht darüber.
      const recapPeriod = period==='day' ? 'potd' : 'potw';
      const showRecap   = recapPeriod==='potd' ? potdHasData() : potwHasData();
      if(showRecap){
        nebenHtml+=`
          <button id="${recapPeriod==='potd'?'potdRecapDayBtn':'potwRecapWeekBtn'}" class="nw-recap">
            <span class="ic">${svgI(recapPeriod==='potd'?'trophyDay':'weekly')}</span>
            <span class="tx"><b>${recapPeriod==='potd'?'Letzter Tag':'Letzte Woche'}</b>
              <i>Rückblick ansehen</i></span>
            <span class="ch"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
              stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg></span>
          </button>`;
      }
    }

    // ── Der Kontext des Zeitraums ────────────────────────────────────
    // Eine Zeile, die sagt, wovon die Tabelle darunter handelt. In Saison,
    // Woche und Tag ist das der Fortschritt, in der Ewigen Tafel sind es
    // die Allzeit-Rekorde weiter unten.
    const fortschritt=(label,jetzt,gesamt,einheit)=>{
      const pct=Math.max(0,Math.min(100,Math.round(jetzt/gesamt*100)));
      return `
        <div class="season-progress">
          <div class="season-progress-top">
            <span class="season-progress-label">${label}</span>
            <span class="season-progress-days">${einheit} <b>${jetzt}</b> von ${gesamt}</span>
          </div>
          <div class="season-progress-bar"><i style="width:${pct}%"></i></div>
        </div>`;
    };
    let kontextHtml='';
    if(period==='season'){
      if(laeuft){
        const sStart=seasonStart(sid), sEnd=seasonEnd(sid);
        const totalMs=sEnd-sStart;
        const elapsedMs=Math.max(0,Math.min(totalMs,Date.now()-sStart));
        kontextHtml=fortschritt('Saison-Fortschritt',
          Math.max(1,Math.ceil(elapsedMs/86400000)),
          Math.ceil(totalMs/86400000), 'Tag');
      } else {
        // Eine abgeschlossene Saison hat keinen Fortschritt. Der Balken
        // stünde voll da und behauptete, es ginge noch weiter. Statt seiner
        // steht hier, was diese Saison war — und dass sie vorbei ist.
        const meister=ps.length&&ps[0].games>0?ps[0]:null;
        kontextHtml=`<div class="saison-abgeschlossen">
          <span class="sa-l">Abgeschlossen</span>
          <span class="sa-v">${esc(seasonLabel(sid))}</span>
          ${meister?`<span class="sa-m">Meister: ${esc(pname(meister.id))}</span>`:''}
        </div>`;
      }
    } else if(period==='week'){
      const wkStart=periodStart('week');
      const wkEnd=new Date(wkStart); wkEnd.setDate(wkEnd.getDate()+7);
      const el=Math.max(0,Math.min(wkEnd-wkStart,Date.now()-wkStart));
      kontextHtml=fortschritt('Woche läuft',
        Math.max(1,Math.min(7,Math.ceil(el/86400000))), 7, 'Tag');
    } else if(period==='day'){
      const dyStart=periodStart('day');
      const dyEnd=new Date(dyStart); dyEnd.setDate(dyEnd.getDate()+1);
      const el=Math.max(0,Math.min(dyEnd-dyStart,Date.now()-dyStart));
      kontextHtml=fortschritt('Tag läuft',
        Math.max(1,Math.min(24,Math.ceil(el/3600000))), 24, 'Stunde');
    }

    // ── Zwei Ranglisten über denselben Zeitraum [§C29] ───────────────
    // Eine Saison hat zwei Sieger: den besten Spieler und das beste Duo.
    // Das Duo stand bisher nur als Karte über der Tabelle — man sah den
    // Ersten, aber nie den Rest. Beides sind Ranglisten desselben
    // Zeitraums, also gehören sie in denselben Rahmen und werden über
    // einen Reiter gewechselt, nicht über eine zweite Seite.
    const sichtBar = period==='season' ? `
      <div class="ui-tabs">
        <button data-ligasicht="spieler" class="${ligaSicht==='spieler'?'on':''}">Spieler</button>
        <button data-ligasicht="duos" class="${ligaSicht==='duos'?'on':''}">Duos</button>
      </div>` : '';

    if(period==='season' && ligaSicht==='duos'){
      const duos=_seasonTeamRanking(periodMs, sid);
      // Wie bei den Spielern: der Erste steht IN der Tabelle und trägt die
      // Aufschrift — keine Karte über einer Liste, die dieselbe Zeile
      // gleich noch einmal zeigt.
      // Hier trägt KEINE Zeile ein Wappen, anders als in der Spielertabelle.
      // Das Wappen ist die Rangabzeichnung EINES Spielers; ein Duo hat
      // keinen Rang, es hat zwei Hälften. Dazu kommt ein handfester Grund:
      // 31 Duos sind 62 Wappen, und das sind eine Viertelmillion Zeichen
      // HTML für eine Tabelle. Zwei Chips sagen dasselbe in 1 %.
      const duoZeile=(t,i)=>{
        const wr=t.g?Math.round(t.w/t.g*100):0;
        const e=Math.round(t.elo);
        return `<div class="rrow duo${i<3?' top'+(i+1):''}${i===0?' held':''}"
          data-team="${esc(t.ids.slice().sort().join('|'))}">
          <span class="pos num">${i+1}</span>
          <span class="sh-chip-pair">${chipAv(t.ids[0])}${chipAv(t.ids[1])}</span>
          <div class="rmid">
            ${i===0?'<div class="held-label">Team der Saison</div>':''}
            <div class="rname">${esc(t.ids.map(pname).join(' & '))}</div>
            <div class="rmeta"><span>${t.w}–${t.g-t.w}</span>
              <span class="wbar"><i style="width:${wr}%"></i></span><span>${wr}%</span></div>
          </div>
          <div class="rval"><div class="big num">${e>=0?'+':''}${e}</div>
            <div class="small">Elo</div></div>
        </div>`;
      };
      return `
        <div class="view-head"><h2>Liga</h2><p>${periodLabel(period, saisonArg)} · ${
          duos.length} Duo${duos.length===1?'':'s'} · ${totalMatches} Matches</p></div>
        ${periodBar}
        ${kontextHtml}
        ${sichtBar}
        ${duos.length
          ? `<div class="rlist">${duos.map(duoZeile).join('')}</div>`
          : emptyState('handshake','Noch kein Duo mit zwei gemeinsamen Spielen')}`;
    }

    return `
      <div class="view-head"><h2>Liga</h2><p>${periodLabel(period, saisonArg)} · ${ps.length} aktiv · ${totalMatches} Matches</p></div>
      ${periodBar}
      ${kontextHtml}
      ${nebenHtml}
      ${sichtBar}
      ${metrikLeisteHtml(period)}
      ${ps.length||leerZeile?`<div class="rlist">${leerZeile}${rows}</div>`:emptyState('calendar','Keine Matches in diesem Zeitraum')}`;
  }


  // GESAMT-ANSICHT: Karriere-Elo = Durchschnitt der Saison-End-Elos
  const globalSim = getGlobalSim();
  const getGlobalElo = id => Math.round(globalSim.careerElo[id] ?? cfg.start_elo);

  const metrik = metrikFuer('all');
  // Dieselbe „zuletzt"-Zeile wie im Zeitraum [§C27]: die Tabelle soll in
  // jedem Reiter dieselben Dinge über einen Spieler sagen, sonst wechselt
  // mit dem Reiter auch die Zeilenhöhe und die Aufmerksamkeit springt.
  // Einmal über alle Matches laufen, statt je Spieler zu filtern.
  const _letzte={};
  matches.slice().sort((a,b)=>mts(a)-mts(b)).forEach(m=>{
    [[m.a1,'A'],[m.a2,'A'],[m.b1,'B'],[m.b2,'B']].forEach(([id,seite])=>{
      if(!id) return;
      (_letzte[id]||(_letzte[id]=[])).push(m.winner===seite);
      if(_letzte[id].length>5) _letzte[id].shift();
    });
  });
  const _allStats=allPlayerStats();
  let list = activePlayers().map(p => ({p, s:_allStats[p.id]||playerStats(p.id), globalElo:getGlobalElo(p.id)}));

  const sortFn = {
    elo:      (a,b) => b.globalElo - a.globalElo,
    winrate:  (a,b) => b.s.wr - a.s.wr || b.s.games - a.s.games,
    goaldiff: (a,b) => b.s.gd - a.s.gd,
    streak:   (a,b) => b.s.curStreak - a.s.curStreak,
    games:    (a,b) => b.s.games - a.s.games
  }[metrik];
  list.sort(sortFn);

  const top = list.length ? list[0].globalElo : 0;
  // Die Liste ist immer vollständig. Das Podest darüber ist eine
  // Hervorhebung, keine Auslagerung: wer oben steht, steht auch in der
  // Tabelle. Vorher fehlten bei der Elo-Sortierung die ersten drei — die
  // Tabelle begann bei 4 und war damit eine andere Tabelle als unter
  // „Siegrate" daneben.
  const rows = list.map((x,i) => rrow(x.p, x.s, i, metrik, x.globalElo, _letzte[x.p.id])).join('');

  // ═══ DIE EWIGE TAFEL: das Podest ═══
  // Vorher: eine große Heldenkarte für Platz 1 und darunter zwei halbe
  // Karten für 2 und 3 — drei verschiedene Formen für dieselbe Aussage, und
  // die Rangfolge musste man sich aus Anordnung und Beschriftung
  // zusammenreimen. Jetzt stehen die drei nebeneinander in der Reihenfolge,
  // in der ein Podest steht: 2, 1, 3. Die Mitte ist höher und trägt Gold,
  // links Silber, rechts Bronze [§C26].
  const hofList=activePlayers().map(p=>({p, e:getGlobalElo(p.id), s:_allStats[p.id]||playerStats(p.id)})).sort((a,b)=>b.e-a.e);
  const hofTop = hofList.filter(x => x && x.s && x.s.games > 0).slice(0, 3);
  let hofHtml='', hofPodsHtml='';
  if(hofTop.length){
    // Wie viele Saisontitel hat jemand? Player of the Season und Team of the
    // Season zählen getrennt, wie im Profil.
    const titel = pid => seasons.filter(x=>x.id!==currentSeason().id)
      .reduce((n,x)=>n+(x.player_id===pid?1:0)+((x.team_p1===pid||x.team_p2===pid)?1:0),0);
    const METALL = ['gold','silber','bronze'];
    const karte = (entry, platz) => {
      const pp = entry.p;
      // Das Wappen gehört aufs Podest: es ist das, was ein Spieler sich
      // über alle Saisons erarbeitet hat, und genau davon handelt die
      // Ewige Tafel. Es ist dasselbe Bauteil wie in jeder Ranglistenzeile
      // [§C27], nur größer — der Erste bekommt hundert Pixel, die beiden
      // daneben vierundachtzig.
      const avWappen = avHtml(pp, '', {ins:true, px:platz===1?92:76,
                                        klasse:'ewt-av-wrap'});
      const t = titel(pp.id);
      // Ohne Titel steht dort die Spielzahl — ein Strich sieht aus, als
      // fehlte die Zahl, statt zu sagen: dieser Spieler hat noch keinen.
      const sub = t
        ? (t + ' Titel' + (platz===1 ? ' · ' + entry.s.games + ' Sp.' : ''))
        : (entry.s.games + ' Spiele');
      return `
        <div class="ewt-karte ${METALL[platz-1]}${platz===1?' erster':''}" data-detail="${pp.id}">
          <div class="ewt-platz num">${String(platz).padStart(2,'0')}</div>
          ${avWappen}
          <div class="ewt-name">${esc(pp.name)}</div>
          <div class="ewt-elo num">${entry.e}</div>
          <div class="ewt-sub">${esc(sub || '–')}</div>
        </div>`;
    };
    // 2, 1, 3 — die Mitte gehört dem Ersten.
    const folge = [hofTop[1], hofTop[0], hofTop[2]];
    const platz = [2, 1, 3];
    hofHtml = `<div class="ewt-podest">${
      folge.map((e,k) => e ? karte(e, platz[k]) : '<div class="ewt-leer"></div>').join('')
    }</div>`;
  }

  // Peak-Elo, Meiste Siege und Beste Siegrate standen hier als drei Karten
  // über dem Podest — und noch einmal als Kacheln im Awards-Tab. Zweimal
  // dieselbe Zahl auf zwei Seiten heißt: eine davon ist überflüssig, und die
  // Ewige Tafel ist die Rangliste, nicht die Bestenliste. Die Kacheln bleiben
  // dort, wo Bestwerte hingehören.
  // Die Top-5-Blätter (_peakEloRanking & Co.) bleiben erreichbar — sie hängen
  // an data-toplist, und das vergeben die Award-Kacheln.

  return `
    <div class="view-head"><h2>Ewige Tafel</h2><p>Karriere-Elo über ${
      seasons.length} Saison${seasons.length===1?'':'s'} · ${matches.length} Matches</p></div>
    ${periodBar}
    ${hofHtml || `<div class="stat-strip">
      <div class="s"><div class="v num">${activePlayers().length}</div><div class="l">Spieler</div></div>
      <div class="s"><div class="v num">${matches.length}</div><div class="l">Matches</div></div>
      <div class="s"><div class="v num">${top||'–'}</div><div class="l">Top-Elo</div></div>
    </div>`}
    ${hofPodsHtml}
    ${metrikLeisteHtml('all')}
    ${list.length ? `<div class="rlist">${rows}</div>` : emptyState('search','Keine Spieler gefunden')}
    <button class="btn ghost sm" id="addPlayerBtn" style="margin-top:14px">+ Spieler anlegen</button>`;

}
function rrow(p, s, i, metric, globalElo, letzte){
  const elo = globalElo !== undefined ? globalElo : Math.round(p.elo);
  const cls = i<3 ? `top${i+1}` : '';
  let big, small;
    if(metric==='elo'){
    // Die Zahl gehört nach vorn. Vorher stand rechts der Rangname groß und
    // die Elo klein darunter — in einer Rangliste nach Elo ist aber die Elo
    // die Aussage, und „Stark" stand bei acht von zwölf Spielern gleich da.
    const r=getPlayerRank(p.id);
    big=elo;
    small=r?`<span class="ic svg-ic" style="font-size:11px;color:${r.color};margin-right:3px;vertical-align:-1px">${svgI(r.icon)}</span>${r.label}`:'–';
  }

  else if(metric==='winrate'){big=Math.round(s.wr*100)+'%'; small=s.wins+'–'+s.losses;}
  else if(metric==='goaldiff'){big=(s.gd>=0?'+':'')+s.gd; small='Tordiff';}
  else if(metric==='streak'){
    const r=s.curStreak;
    big=(r>0?r+'W':r<0?(-r)+'L':'–');
    small=r>0?'Siege':r<0?'Niederlagen':'neutral';
  }
  else{big=s.games; small='Spiele';}
  const neutral = metric!=='elo' && !(metric==='goaldiff'&&s.gd>=0) && !(metric==='streak'&&s.curStreak>0) ? ' neutral':'';
  const fireTag = streakInline(s.curStreak);
  return `<div class="rrow ${cls}" data-detail="${p.id}">
    <span class="pos num">${i+1}</span>
    ${avHtml(p, '', {ins:true, px:52})}
    <div class="rmid">
              <div class="rname">
        ${esc(p.name)}${_titleMarkHtml(p.id, i<3?'lg':'', {ohneChamp:true, einfarbig:true})}${s.curStreak<0?fireTag:''}
      </div>

      <div class="rmeta">
        <span>${s.wins}–${s.losses}</span>
        <span class="wbar"><i style="width:${Math.round(s.wr*100)}%"></i></span>
        <span>${Math.round(s.wr*100)}%</span>
      </div>
      ${letzte&&letzte.length?`<div class="rzuletzt"><div class="form-dots">${
        letzte.map(w=>`<div class="dot ${w?'w':'l'}"></div>`).join('')}</div></div>`:''}
    </div>
        <div class="rval">
      <div class="big${metric==='elo'?'':neutral} num">${big}</div>
      <div class="small">${small}</div>
    </div>

  </div>`;
}

