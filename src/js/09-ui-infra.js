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
  if(em){
    return `<span class="av av-emoji${cls}"${attr} style="${style}${extraStyle||''}"><span class="em">${em}</span></span>`;
  }
  return `<span class="av${cls}"${attr} style="${style}background:${avColor(player.id)};${extraStyle||''}">${initials(player.name)}</span>`;
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
// aw-li-av ist 34px, in tied-rows ist sie 30px
function awLiAv(pid, isTiedRow = false){
  const p=pmap()[pid];
  const sizeStyle = isTiedRow ? 'width:30px;height:30px;font-size:16px;' : '';
  if(!p) return `<div class="aw-li-av" style="background:var(--surface3);color:var(--muted);${sizeStyle}">?</div>`;
  const em=p.avatar_id?avatarEmoji(p.avatar_id):null;
  if(em) return `<div class="aw-li-av has-emoji" style="background:var(--surface3);color:inherit;${sizeStyle}">${em}</div>`;
  return `<div class="aw-li-av" style="background:${avColor(p.id)};${sizeStyle}">${esc(initials(p.name))}</div>`;
}
function awLiPair(p1,p2, isTiedRow = false){
  return `<div class="aw-li-pair">${awLiAv(p1, isTiedRow)}${awLiAv(p2, isTiedRow)}</div>`;
}

// Großer Hero-Avatar (82px) für die Winner/Schandfleck-Box
function awHeroAv(pid){
  const p=pmap()[pid];
  if(!p) return '<div class="aw-winner-av" style="background:var(--surface3);color:var(--muted)">?</div>';
  const em=p.avatar_id?avatarEmoji(p.avatar_id):null;
  if(em) return `<div class="aw-winner-av has-emoji">${em}</div>`;
  return `<div class="aw-winner-av" style="background:${avColor(p.id)}">${esc(initials(p.name))}</div>`;
}
function awHeroPair(p1,p2){
  return `<div class="aw-winner-pair">${awHeroAv(p1)}${awHeroAv(p2)}</div>`;
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
  document.querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{tab=b.dataset.nav;teamSearch='';window.scrollTo(0,0);render();});
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
function matchesInPeriod(period){
  const key='mperiod_'+period+'_'+matches.length+'_'+_cache.version;
  if(!_cache._mperiod) _cache._mperiod={};
  if(_cache._mperiod[key]) return _cache._mperiod[key];
  let result;
  if(period==='season') result=matchesInSeason(currentSeason().id);
  else{
    const start=periodStart(period);
    result=start?matches.filter(m=>new Date(m.created_at)>=start):matches;
  }
  _cache._mperiod[key]=result;
  return result;
}

function periodLabel(period){
  const now=new Date();
  if(period==='season'){ return seasonLabel(currentSeason().id); }
  if(period==='week'){ const s=periodStart('week');
    return 'KW '+isoWeek(now)+' · ab '+s.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'}); }
  if(period==='day'){ const s=periodStart('day');
    return s.toLocaleDateString('de-DE',{weekday:'long',day:'2-digit',month:'2-digit'}); }
  return 'Gesamte Liga';
}
function isoWeek(d){
  const date=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));
  const dayNum=(date.getUTCDay()+6)%7; date.setUTCDate(date.getUTCDate()-dayNum+3);
  const firstThu=new Date(Date.UTC(date.getUTCFullYear(),0,4));
  const fd=(firstThu.getUTCDay()+6)%7; firstThu.setUTCDate(firstThu.getUTCDate()-fd+3);
  return 1+Math.round((date-firstThu)/(7*24*3600*1000));
}

