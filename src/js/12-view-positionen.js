// ╔═══ §5.2 ─── VIEW: POSITIONS-RANGLISTE ──────────────────────────────╗
//     Spezial-View für Sturm/Abwehr-Rangliste.
// ╚═════════════════════════════════════════════════════════════════════════╝
function vPositions(){
  function posList(pos){
    const statsMap = allPlayerStats();
    return activePlayers().map(p=>{
      const s = statsMap[p.id] || playerStats(p.id);
      const g  = pos==='atk' ? s.atkG       : s.defG;
      const w  = pos==='atk' ? s.atkW       : s.defW;
      // Positionsspezifische Tor-Stats — kommen aus playerStats (atkGoals, defConceded)
      const goalsSum = pos==='atk' ? (s.atkGoals||0)  : (s.defConceded||0);
      const goalsAvg = g ? goalsSum/g : 0;
      const perf=posPerfFrom(p.id,matches);
      const pAvg=pos==='atk'?perf.aPerfAvg:perf.dPerfAvg;
      const wr=g?w/g:0;
      // Die Rechnung steht in posWert [§5.2] — sie gehoert nicht in eine
      // Ansicht, weil der Liga-Rekord auf dieser Position dieselbe Zahl
      // braucht [§13.1]. Zwei Rechnungen, zwei Beste.
      const score=posWert(pos,g,w,goalsAvg,pAvg);
      return {p,g,w,wr,pAvg:pAvg||0,goalsAvg,score};
    }).filter(x=>x.g>0)
      // Sortierung: Positions-Score (kombiniert WR, Performance, Tor-Bilanz, Erfahrung)
      .sort((a,b)=> b.score-a.score || b.pAvg-a.pAvg || b.wr-a.wr);
  }

  const atk=posList('atk'), def=posList('def');
  const block=(arr,pos)=>{
    if(!arr.length)return emptyState(pos==='atk'?'bolt':'shield','Noch keine Spiele auf dieser Position');
    const valLbl = pos==='atk' ? 'Tore/Sp.' : 'Geg./Sp.';
    return `<div class="rlist">${arr.map((x,i)=>{
      const perfChip = x.pAvg>0.08?'<span class="perf-up">▲</span>':x.pAvg<-0.08?'<span class="perf-dn">▼</span>':'';
      const goalsTxt = x.goalsAvg.toFixed(1);
      // Die Liste sortiert nach `score`, zeigte als große Zahl aber Ø Tore —
      // dadurch stand 8.8 über 8.9 und die Reihenfolge widersprach sich
      // selbst. Jetzt steht rechts der Wert, nach dem tatsächlich sortiert
      // wird; die Ø-Tore bekommen ihre eigene ruhige Spalte in der Meta-Zeile.
      const wert = Math.round(x.score*100);
      return `<div class="rrow ${i<3?'top'+(i+1):''}" data-detail="${x.p.id}">
        <span class="pos num">${i+1}</span>
        ${avHtml(x.p, '', {ins:true, px:52})}
        <div class="rmid">
          <div class="rname">${esc(x.p.name)} ${perfChip}</div>
          <div class="rmeta">
            <span>${x.w}–${x.g-x.w}</span>
            <span class="wbar"><i style="width:${Math.round(x.wr*100)}%"></i></span>
            <span>${Math.round(x.wr*100)}%</span>
            <span class="rmeta-sep">Ø ${goalsTxt} ${valLbl}</span>
          </div>
        </div>
        <div class="rval"><div class="big num">${wert}</div><div class="small">Wert</div></div>
      </div>`;}).join('')}</div>`;
  };
  const which = rankMetric==='def'?'def':'atk';
  const subLbl = which==='atk' ? 'Performance · Erfahrung · Ø Tore' : 'Performance · Erfahrung · Ø Gegentore';
  return `
    <div class="view-head"><h2>Positionen</h2><p>Beste Spieler je Position · ${subLbl}</p></div>
    <div class="ui-switch">
      <button data-postoggle="atk" class="${which==='atk'?'on':''}"><span class="pos-chip atk">${svgI('bolt')}Sturm</span></button>
      <button data-postoggle="def" class="${which==='def'?'on':''}"><span class="pos-chip def">${svgI('shield')}Abwehr</span></button>
    </div>
    <div class="mini-label">▲ über Erwartung · ▼ unter Erwartung (berücksichtigt Mate- & Gegnerstärke)</div>
    ${which==='atk'?block(atk,'atk'):block(def,'def')}`;
}

