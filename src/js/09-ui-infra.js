// ╔═══ §4.1 ─── AVATAR COLORS & EMOJIS ─────────────────────────────────╗
//     Hash-basierte Farbzuweisung pro Spieler-ID. Emoji-Avatar überschreibt.
// ╚═════════════════════════════════════════════════════════════════════════╝
const AV_COLORS=['#BEF264','#ff7849','#56b4e8','#f7cf4a','#a78bfa','#4ade80','#f0566a','#22d3ee','#fb923c','#e879f9'];
function avColor(id){let h=0;for(let i=0;i<id.length;i++)h=id.charCodeAt(i)+((h<<5)-h);return AV_COLORS[Math.abs(h)%AV_COLORS.length];}

// 54 Avatar-Optionen (29 Originale + 25 Neue)
const AVATAR_OPTIONS = [
  // Originale 29
  {id:'wolf',     em:'🐺'}, {id:'smiletear', em:'🥲'}, {id:'cloud',   em:'😶‍🌫️'},
  {id:'cold',     em:'🥶'}, {id:'poop',      em:'💩'}, {id:'clown',   em:'🤡'},
  {id:'alien',    em:'👽'}, {id:'eye',       em:'👁'},  {id:'detective',em:'🕵'},
  {id:'ninja',    em:'🥷'}, {id:'wizard',    em:'🧙‍♂️'}, {id:'zombie',  em:'🧟'},
  {id:'monkey',   em:'🐵'}, {id:'raccoon',   em:'🦝'}, {id:'pig',     em:'🐷'},
  {id:'shrimp',   em:'🦐'}, {id:'eggplant',  em:'🍆'}, {id:'coconut', em:'🥥'},
  {id:'brick',    em:'🧱'}, {id:'pumpkin',   em:'🎃'}, {id:'heel',    em:'👠'},
  {id:'unicorn',  em:'🦄'}, {id:'shark',     em:'🦈'}, {id:'eagle',   em:'🦅'},
  {id:'tropicaldrink',    em:'🍹'}, {id:'xray',      em:'🩻'}, {id:'cigarette',em:'🚬'},
  {id:'moai',     em:'🗿'}, {id:'owl',       em:'🦉'},
  // 29 Neue Avatar-Optionen
  {id:'twoface',   em:'🎭'}, {id:'bat',     em:'🦇'}, {id:'champagne',   em:'🍾'},
  {id:'juggle',   em:'🤹🏼‍♂️'}, {id:'biohazard',     em:'☣️'}, {id:'devil',   em:'😈'},
  {id:'ogre',     em:'👹'}, {id:'goblin',    em:'👺'}, {id:'dragon',  em:'🐉'},
  {id:'nuclear',   em:'☢️'}, {id:'crab',    em:'🦀'},
  {id:'frog',     em:'🐸'}, {id:'panda',     em:'🐼'}, {id:'lion',    em:'🦁'},
  {id:'mosquito',      em:'🦟'}, {id:'beer',      em:'🍺'}, {id:'sloth',   em:'🦥'},
  {id:'hedgehog', em:'🦔'}, {id:'swan',      em:'🦢'}, {id:'butterfly',em:'🦋'},
  {id:'scorpion', em:'🦂'}, {id:'burner',    em:'👨🏼‍🏭'}, {id:'snake',   em:'🐍'},
  {id:'lizard',   em:'🦎'}, {id:'gorilla',   em:'🦍'}, 
];

function avatarEmoji(avId){const a=AVATAR_OPTIONS.find(x=>x.id===avId);return a?a.em:null;}
// Rendert das Avatar-Inner (Emoji wenn gesetzt, sonst Initialen)
function avatarInnerHtml(player){
  const em = player && player.avatar_id ? avatarEmoji(player.avatar_id) : null;
  if(em) return `<span class="em">${em}</span>`;
  return initials(player.name);
}
// Zentrale Avatar-Render-Funktion für Ranglisten etc.
// player: das player-Objekt; extraStyle: zusätzliche Inline-Styles;
// opts.ring: Status-Ring (§13.7) mitrendern — bewusst opt-in, damit nicht
// jede Award-Liste und jedes Team-Sheet plötzlich bunt umrandet ist.
function avHtml(player, extraStyle, opts){
  if(!player) return '';
  let cls = '', style = '', attr = '';
  if(opts && opts.ring && typeof _avRingAttrs === 'function'){
    const r = _avRingAttrs(player.id);
    if(r){ cls = r.cls; style = r.style; attr = r.attr; }
  }
  const em = player.avatar_id ? avatarEmoji(player.avatar_id) : null;
  const inner = em
    ? `<span class="av av-emoji${cls}"${attr} style="${style}${extraStyle||''}"><span class="em">${em}</span></span>`
    : `<span class="av${cls}"${attr} style="${style}background:${avColor(player.id)};${extraStyle||''}">${initials(player.name)}</span>`;
  // Das Zeichen [§4.1b] ist opt-in — sonst trügen plötzlich auch die
  // Avatare in Award-Listen und Sheets Sterne und Feuer.
  // `ins` legt zusätzlich das Wappen um den Avatar [§C27]: die Rangliste
  // zeigt damit dieselbe Form wie das Podest der Ewigen Tafel.
  if(opts && opts.ins && typeof insAvWrap === 'function') return insAvWrap(player.id, inner, opts);
  if(opts && opts.zn && typeof znWrap === 'function') return znWrap(player.id, inner, opts);
  return inner;
}
function initials(n){return n.trim().slice(0,2).toUpperCase();}

// ╔═══ §4.2 ─── AWARD AVATAR HELPER (Hero/Mini/Li) ─────────────────────╗
//     awHeroAv, awMiniAv etc. — einheitliche Avatar-Rendering-Funktionen für
//     Award-Details, Pair-Avatare für Team-Awards.
// ╚═════════════════════════════════════════════════════════════════════════╝
// Kleines Avatar (22px) für Award-Cards.
function awMiniAv(pid){
  const p=pmap()[pid];
  if(!p) return '<div class="aw-mini-av" style="background:var(--surface3);color:var(--muted)">?</div>';
  const em=p.avatar_id?avatarEmoji(p.avatar_id):null;
  if(em) return `<div class="aw-mini-av" style="background:var(--surface3);color:var(--ink);font-size:13px">${em}</div>`;
  return `<div class="aw-mini-av" style="background:${avColor(p.id)}">${esc(initials(p.name))}</div>`;
}
function awMiniPair(p1,p2){
  return `<div class="aw-mini-pair">${awMiniAv(p1)}${awMiniAv(p2)}</div>`;
}
// Podium-Avatar (56px / 64px first) für showAward Sheet.
function awPodAv(pid){
  const p=pmap()[pid];
  if(!p) return '<div class="aw-pod-av" style="background:var(--surface3);color:var(--muted)">?</div>';
  const em=p.avatar_id?avatarEmoji(p.avatar_id):null;
  if(em) return `<div class="aw-pod-av" style="background:var(--surface3);color:var(--ink);font-size:30px">${em}</div>`;
  return `<div class="aw-pod-av" style="background:${avColor(p.id)};font-size:18px">${esc(initials(p.name))}</div>`;
}
function awPodPair(p1,p2){
  return `<div class="aw-pod-pair">${awPodAv(p1)}${awPodAv(p2)}</div>`;
}
// Neue Avatar-Hilfsfunktionen für Award-Listen
// aw-li-av ist 34px, in tied-rows ist sie 30px.
// Für ein Wappen ist das zu klein — bei 34px bliebe vom Gesicht ein Punkt
// von 15px, „Detail folgt der Größe" [§4.1b]. Die SERIE passt trotzdem
// hinein: sie liegt hinter dem Kreis und braucht keine Fläche, nur Rand.
// Damit brennt jemand, der brennt, auch in der Award-Liste.
function awLiAv(pid, isTiedRow = false, schande = false){
  const p=pmap()[pid];
  const px = isTiedRow ? 30 : 34;
  const sizeStyle = isTiedRow ? 'width:30px;height:30px;font-size:16px;' : '';
  if(!p) return `<div class="aw-li-av" style="background:var(--surface3);color:var(--muted);${sizeStyle}">?</div>`;
  const em=p.avatar_id?avatarEmoji(p.avatar_id):null;
  const kreis = em
    ? `<div class="aw-li-av has-emoji" style="background:var(--surface3);color:inherit;${sizeStyle}">${em}</div>`
    : `<div class="aw-li-av" style="background:${avColor(p.id)};${sizeStyle}">${esc(initials(p.name))}</div>`;
  // Auf der Schandtafel brennt nichts: dort ist alles rot, und eine
  // orange Flamme wäre in einer Liste der schlechtesten Quoten ein Lob.
  const f = (!schande && typeof znFeuer === 'function') ? znFeuer(pid) : 0;
  if(!f || typeof znWrap !== 'function') return kreis;
  return znWrap(pid, kreis, {px:px, titel:0, klasse:'aw-li-zn'});
}
// Ein Duo hat keinen Rang und keine gemeinsame Serie — zwei Kreise [§C27].
function awLiPair(p1,p2, isTiedRow = false){
  return `<div class="aw-li-pair">${awLiAv(p1, isTiedRow, true)}${awLiAv(p2, isTiedRow, true)}</div>`;
}

// Großer Hero-Avatar (82px) für die Winner/Schandfleck-Box
// schande=true lässt das Wappen weg: eine Schandtafel-Karte ist absichtlich
// grau und rot, ein glänzender Reif mit brennender Serie wäre dort eine
// Auszeichnung. Sonst trägt der Held dasselbe Zeichen wie überall [§C27].
function awHeroAv(pid, schande){
  const p=pmap()[pid];
  if(!p) return '<div class="aw-winner-av" style="background:var(--surface3);color:var(--muted)">?</div>';
  if(!schande) return avHtml(p, '', {ins:true, px:96, klasse:'aw-winner-rav'});
  const em=p.avatar_id?avatarEmoji(p.avatar_id):null;
  if(em) return `<div class="aw-winner-av has-emoji">${em}</div>`;
  return `<div class="aw-winner-av" style="background:${avColor(p.id)}">${esc(initials(p.name))}</div>`;
}
// Ein Duo hat keinen Rang, also kein Wappen — zwei überlappende Kreise
// sagen „diese beiden zusammen" [§C27].
function awHeroPair(p1,p2){
  return `<div class="aw-winner-pair">${awHeroAv(p1,true)}${awHeroAv(p2,true)}</div>`;
}


// ╔═══ §4.3 ─── NAVIGATION (Tabs/Filter/History-State) ─────────────────╗
//     setTab() ist die zentrale Wechsel-Funktion. tab + period + filterPos +
//     filterPlayer steuern, was render() zeichnet.
// ╚═════════════════════════════════════════════════════════════════════════╝
const NAV=[
  ['ranking','Liga',`<path d="M3 13h4v7H3zM10 4h4v16h-4zM17 9h4v11h-4z"/>`],
  ['positions','Positionen',`<circle cx="12" cy="8" r="4"/><path d="M5 21v-1a7 7 0 0114 0v1"/>`],
  ['awards','Awards',`<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0zM5 9a2 2 0 01-2-2V5h4M19 9a2 2 0 002-2V5h-4"/>`],
  ['teams','Teams',`<circle cx="9" cy="7" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20v-1a6 6 0 0112 0v1M15 20v-1a5 5 0 015-1"/>`],
  ['history','Verlauf',`<path d="M3 3v6h6M3 9a9 9 0 109-6"/><path d="M12 7v5l3 2"/>`]
];
function renderNav(){
  document.getElementById('botnav').innerHTML=NAV.map(([id,lb,ic])=>
    `<button data-nav="${id}" class="${tab===id?'on':''}">
      <span class="ic"><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ic}</svg></span>
      <span class="lb">${lb}</span></button>`).join('');
  // Beim Tabwechsel zurück auf heute: wer den Liga-Tab neu betritt, will den
  // aktuellen Stand sehen und nicht den Juni, den er vor zehn Minuten
  // nachgeschlagen hat. Dasselbe gilt für die Duo-Ansicht.
  // awPeriod muss hier mit zurück: 'all' ist kein Reiter mehr, kann aber
  // als Wert im Zustand stehen, wenn vorher ein Award-Blatt aus einem
  // Team-Profil offen war. Ohne das Zurücksetzen stünde der Awards-Tab auf
  // einem Zeitraum, für den es keinen Knopf gibt — und keiner der beiden
  // Reiter sähe eingeschaltet aus.
  document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{
    tab=b.dataset.nav;teamSearch='';ligaSeasonId=null;ligaSicht='spieler';
    awPeriod='season';awSeasonId=null;awWeekStart=null;
    window.scrollTo(0,0);render();});
  // FAB nur außerhalb des Match-Tabs sinnvoll
  document.getElementById('fab').style.display = 'grid';
}

function render(){
  renderNav();
  const v={ranking:vRanking,positions:vPositions,awards:vAwards,teams:vTeams,history:vHistory,match:vMatch,settings:vSettings}[tab];
  document.getElementById('main').innerHTML=`<section class="view active">${v()}</section>`;
  bind();
}

// ╔═══ §4.4 ─── ZEITRÄUME (Saison/Woche/Gesamt) ────────────────────────╗
//     periodBounds() liefert {from,to} für die aktuelle Periode.
//     periodMatches() filtert matches[] entsprechend.
// ╚═════════════════════════════════════════════════════════════════════════╝
function periodStart(period){
  const now=new Date();
  if(period==='season') return seasonStart();
  if(period==='week'){ const d=new Date(now); d.setHours(0,0,0,0);
    const wd=(d.getDay()+6)%7; d.setDate(d.getDate()-wd); return d; }
  if(period==='day'){ const d=new Date(now); d.setHours(0,0,0,0); return d; }
  return null; // all
}
// seasonId ist optional und gilt nur für period==='season': damit kann der
// Liga-Tab eine ABGESCHLOSSENE Saison zeigen, ohne dass Awards, News oder
// Ambient etwas davon mitbekommen. Ohne Angabe bleibt alles wie bisher —
// die laufende Saison. Die Saison gehört in den Cache-Schlüssel, sonst
// liefert der zweite Aufruf die Matches der ersten Saison zurück.
function matchesInPeriod(period, seasonId){
  const sid=period==='season'?(seasonId||currentSeason().id):'';
  const key='mperiod_'+period+'_'+sid+'_'+matches.length+'_'+_cache.version;
  if(!_cache._mperiod) _cache._mperiod={};
  if(_cache._mperiod[key]) return _cache._mperiod[key];
  let result;
  if(period==='season') result=matchesInSeason(sid);
  else{
    const start=periodStart(period);
    result=start?matches.filter(m=>new Date(m.created_at)>=start):matches;
  }
  _cache._mperiod[key]=result;
  return result;
}

function periodLabel(period, seasonId){
  const now=new Date();
  if(period==='season'){ return seasonLabel(seasonId||currentSeason().id); }
  if(period==='week'){ const s=periodStart('week');
    return 'KW '+isoWeek(now)+' · ab '+s.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'}); }
  if(period==='day'){ const s=periodStart('day');
    return s.toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'2-digit'}); }
  return 'Gesamte Liga';
}
// ── Der Saisonwähler ──────────────────────────────────────────────────
// Ein Bauteil für Awards und Liga: dieselbe Liste, dieselbe Beschriftung,
// dieselbe Kennzeichnung der laufenden Saison. Gibt es nur eine Saison,
// gibt es auch nichts zu wählen und nichts anzuzeigen.
//
// Die Saisons stehen in einer Reihe, links die laufende, nach rechts zurück:
// die aktuelle interessiert am häufigsten, und links fängt das Lesen an.
// Ein <select> konnte das nie — es zeigte immer nur einen Eintrag, und wie
// viele Saisons es überhaupt gibt, erfuhr man erst nach dem Antippen.
//
// Die Reihe ist NICHT der Filterstreifen der App: sie wählt keine Ansicht und
// filtert auch nicht innerhalb einer, sie verschiebt den Zeitpunkt, von dem
// alles darunter handelt. Als .ui-tabs stand sie zwischen zwei echten
// Reiterstreifen und war von ihnen nicht zu unterscheiden — drei gleich
// aussehende Zeilen übereinander, und keine sagte mehr, wofür sie zuständig
// ist. Davor war sie eine Zeitleiste mit Knoten und Verbindungsstrich, die
// aussah wie ein Diagramm und nicht wie etwas, das man antippt.
//
// `id` bleibt erhalten, weil zwei Ansichten dasselbe Bauteil einsetzen und
// 20-bind.js die Auswahl je Einsatzort auf eine andere Zustandsvariable legt.
// opts.liste  — andere Auswahl als „alle Saisons" (der Rückblick kennt nur
//               abgeschlossene Monate; der laufende hat keinen).
// opts.attr   — anderer Datenname, damit die Bindung im Liga-Tab nicht auch
//               den Wähler in einem offenen Blatt umschaltet.
function saisonWaehlerHtml(id, gewaehlt, opts){
  opts=opts||{};
  const liste=opts.liste||availableSeasons();
  if(liste.length<2) return '';
  const attr=opts.attr||'saisonwahl';
  const cur=currentSeason().id;
  const sel=gewaehlt||cur;
  return `<div class="saisonwahl" id="${id}" role="tablist" aria-label="Saison wählen">${
    liste.map(sid=>{
      // „September 2026" → „Sep 26": in einem Segment ist Platz für einen
      // Monat, nicht für einen Satz. Der volle Name steht im title.
      const teil=String(seasonLabel(sid)).split(' ');
      const kurz=teil[0].slice(0,3)+' '+String(teil[1]||'').slice(-2);
      return `<button type="button" class="${sid===sel?'on':''}" role="tab"
        aria-selected="${sid===sel}" data-${attr}="${esc(sid)}"
        title="${esc(seasonLabel(sid))}${sid===cur?' · läuft':''}">${
        sid===cur?'<i class="sw-live"></i>':''}${esc(kurz)}</button>`;
    }).join('')}</div>`;
}

function isoWeek(d){
  const date=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
  const dayNum=(date.getUTCDay()+6)%7; date.setUTCDate(date.getUTCDate()-dayNum+3);
  const firstThu=new Date(Date.UTC(date.getUTCFullYear(),0,4));
  const fd=(firstThu.getUTCDay()+6)%7; firstThu.setUTCDate(firstThu.getUTCDate()-fd+3);
  return 1+Math.round((date-firstThu)/(7*24*3600*1000));
}

