// ─── §11.3 — LocalStorage (Read-State) ───────────────────────────────
// Ring-Buffer-Pattern: max 200 IDs werden gespeichert, älteste fallen raus.
// Lesen ist O(N), Schreiben ist O(N) (Array-Operations). Bei N=200 vernachlässigbar.
function _newsLoadSeen(){
  try {
    const raw = localStorage.getItem(NEWS_LS_SEEN);
    if(!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch(e){ return new Set(); }
}
function _newsSaveSeen(set){
  try {
    // Ring-Buffer: bei Überlauf älteste IDs verwerfen (chronologische Reihenfolge
    // = Einfüge-Reihenfolge → Set-Iteration garantiert das in JS).
    let arr = [...set];
    if(arr.length > NEWS_LS_MAX_SEEN) arr = arr.slice(-NEWS_LS_MAX_SEEN);
    localStorage.setItem(NEWS_LS_SEEN, JSON.stringify(arr));
  } catch(e){}
}
function _newsMarkSeen(ids){
  const seen = _newsLoadSeen();
  const list = Array.isArray(ids) ? ids : [ids];
  list.forEach(id => seen.add(id));
  _newsSaveSeen(seen);
}
function _newsMarkAllSeen(){
  const stories = getStoriesCache();
  _newsMarkSeen(stories.map(s => s.id));
}
function newsUnreadCount(){
  const stories = getStoriesCache();
  const seen = _newsLoadSeen();
  return stories.filter(s => !seen.has(s.id)).length;
}

// ─── §11.4 — Header-Badge-Refresh ────────────────────────────────────
// Wird nach loadAll() und nach gezielten UI-Aktionen aufgerufen.
// Stellt das News-Button-Sichtbarkeit und die Unread-Pille korrekt ein.
// Zusätzlich (v8.1): zeigt einmalig den "X neue Stories"-Toast, wenn neue
// Stories vorliegen und der Cooldown abgelaufen ist.
function newsBadgeRefresh(){
  const btn = document.getElementById('newsBtn');
  const badge = document.getElementById('newsBtnBadge');
  if(!btn || !badge) return;
  btn.style.visibility = 'visible';
  // v8.2: erste Aufruf nach Page-Load → Boot-Grace setzen, damit der
  // Toast den Auto-Recaps Vorrang gibt.
  if(!_newsBootGuardSet){
    _newsBootGuardSet = true;
    _newsBootGuardUntil = Date.now() + NEWS_BOOT_GRACE_MS;
    // Nach Ablauf der Grace einmal nachversuchen
    setTimeout(() => { try { _processDeferredNewsToast(); } catch(e){} }, NEWS_BOOT_GRACE_MS + 100);
  }
  let n = 0;
  try { n = newsUnreadCount(); } catch(e){ n = 0; }
  if(n > 0){
    badge.style.display = '';
    badge.textContent = n > 9 ? '9+' : String(n);
    // Toast nur bei "echten" Neuigkeiten (nicht bei jedem Refresh)
    _maybeShowNewsToast(n);
  } else {
    badge.style.display = 'none';
    // Falls alles gelesen → Toast sofort ausblenden (Zustände konsistent) UND
    // einen evtl. für den Sheet-Close gequeuten Toast verwerfen (v9.5-Fix),
    // damit nach „alle gelesen" + schnellem Schließen kein „X neue Stories"
    // mehr aufpoppt.
    _newsToastDeferredCount = 0;
    try { _hideNewsToast(); } catch(e){}
  }
}
// Global verfügbar machen, damit loadAll und onclick-Handler dranzukommen
window.newsBadgeRefresh = newsBadgeRefresh;

// ─── §11.4b — Toast-Logik (v8.1, erweitert v8.2) ─────────────────────
// Cooldown-basierter Hinweis "X neue Stories" unter dem News-Icon.
//
// Defer-Logik (v8.2): Toast darf NICHT erscheinen, solange ein Sheet
// (Saison-/POTW-/POTD-Recap, Profil etc.) offen ist — sonst überdeckt
// das Recap den Toast und der User sieht ihn nie. Stattdessen wird die
// Anzeige gequeued und beim closeSheet() erneut versucht.
//
// Cooldown gegen Spam (zweistufig):
//   1. unread > zuletzt gezeigte Anzahl  → es gibt WIRKLICH mehr Stories
//   2. ODER seit letztem Toast > 6h verstrichen → erneut sanft erinnern
// Auto-hide nach 4s. Tap → Mini-Popup.
let _newsToastHideTimer = null;
let _newsToastDeferredCount = 0; // wartet auf Sheet-Close
// v8.2: Boot-Grace gegen Race-Condition mit Auto-Recaps.
//   Saison-Recap   → 600ms nach loadAll
//   POTW-Recap     → 900ms
//   POTD-Recap     → 1200ms
// → Für 2500ms nach erstem newsBadgeRefresh wird Toast ZURÜCKGESTELLT,
//   damit Recaps Vorrang haben. _processDeferredNewsToast (closeSheet-Hook)
//   holt ihn nach. Das macht Recaps + Toast nacheinander statt überlappend.
let _newsBootGuardSet = false;
let _newsBootGuardUntil = 0;
const NEWS_BOOT_GRACE_MS = 2500;
function _newsLoadToastState(){
  try {
    const raw = localStorage.getItem(NEWS_LS_TOAST);
    if(!raw) return {lastCount: 0, lastTs: 0};
    const o = JSON.parse(raw);
    return {lastCount: o.lastCount|0, lastTs: o.lastTs|0};
  } catch(e){ return {lastCount: 0, lastTs: 0}; }
}
function _newsSaveToastState(state){
  try { localStorage.setItem(NEWS_LS_TOAST, JSON.stringify(state)); } catch(e){}
}
// True, wenn aktuell ein Sheet offen ODER ein Recap in Schutz-Phase
// ODER die Boot-Grace-Period noch läuft. Während Boot-Grace warten wir,
// damit Auto-Recaps (Saison/POTW/POTD) ihre 600-1200ms-Verzögerung sicher
// nutzen können, BEVOR der Toast erscheint.
function _isSheetActive(){
  try {
    // Boot-Grace: Toast erst nach Recap-Trigger-Fenster zulassen
    if(_newsBootGuardUntil && Date.now() < _newsBootGuardUntil) return true;
    const sheet = document.getElementById('sheet');
    if(sheet && sheet.classList.contains('show')) return true;
    // Auch wenn das Sheet gleich auftaucht (Schutz-Phase aktiv) → warten
    if(sheet && sheet._protectedUntil && Date.now() < sheet._protectedUntil) return true;
  } catch(e){}
  return false;
}
function _maybeShowNewsToast(unreadCount){
  const toast = document.getElementById('newsToast');
  const txt = document.getElementById('newsToastTxt');
  if(!toast || !txt || unreadCount <= 0) return;
  const state = _newsLoadToastState();
  const now = Date.now();
  const moreThanBefore = unreadCount > state.lastCount;
  const cooledDown = (now - state.lastTs) > NEWS_TOAST_COOLDOWN_MS;
  if(!moreThanBefore && !cooledDown) return;
  // ── Defer wenn Recap/Sheet aktiv ─────────────────────────────────
  if(_isSheetActive()){
    _newsToastDeferredCount = unreadCount;
    return;
  }
  // Anzeigen
  txt.textContent = unreadCount + (unreadCount === 1 ? ' neue Story' : ' neue Stories');
  _positionNewsToast();
  toast.classList.add('visible');
  // Reflow erzwingen für CSS-Animation
  void toast.offsetWidth;
  toast.classList.add('show');
  _newsSaveToastState({lastCount: unreadCount, lastTs: now});
  _newsToastDeferredCount = 0;
  // Auto-hide nach 4s
  if(_newsToastHideTimer) clearTimeout(_newsToastHideTimer);
  _newsToastHideTimer = setTimeout(() => _hideNewsToast(), 4000);
  // Click → volles Sheet (v8.9, konsistent mit dem News-Button), Toast aus
  toast.onclick = () => {
    _hideNewsToast();
    try { openNewsFeed(); } catch(e){}
  };
}
function _hideNewsToast(){
  const toast = document.getElementById('newsToast');
  if(!toast) return;
  if(_newsToastHideTimer){ clearTimeout(_newsToastHideTimer); _newsToastHideTimer = null; }
  toast.classList.remove('show');
  setTimeout(() => toast.classList.remove('visible'), 300);
}
// v9: Toast dynamisch unter der News-Pille ausrichten (Pfeil zeigt auf die
// Button-Mitte). Nötig, weil die Pille (Idee E) breiter/variabler ist als das
// frühere Icon — der feste right:60px würde daneben zeigen. Wird nur beim
// Anzeigen aufgerufen (billig: zwei getBoundingClientRect).
function _positionNewsToast(){
  const toast = document.getElementById('newsToast');
  const btn = document.getElementById('newsBtn');
  if(!toast || !btn) return;
  const parent = btn.closest('.appbar');
  if(!parent) return;
  const pr = parent.getBoundingClientRect();
  const br = btn.getBoundingClientRect();
  if(!br.width) return; // Button (noch) unsichtbar
  const centerFromRight = pr.right - (br.left + br.width / 2);
  const ARROW = 18, HALF = 5, MINR = 8;
  let toastRight = centerFromRight - ARROW - HALF;
  let arrow = ARROW;
  if(toastRight < MINR){ toastRight = MINR; arrow = Math.max(ARROW, centerFromRight - toastRight - HALF); }
  toast.style.right = toastRight + 'px';
  toast.style.setProperty('--nt-arrow', arrow + 'px');
}
// Wird in closeSheet() aufgerufen — versucht gequeuten Toast nach
// kurzem Delay (User soll Sheet-Close-Animation sehen, bevor der nächste
// Hinweis aufpoppt).
function _processDeferredNewsToast(){
  if(!_newsToastDeferredCount) return;
  setTimeout(() => {
    // erneut prüfen: vielleicht hat sich währenddessen ein neues Sheet geöffnet
    if(_isSheetActive()) return;
    // v9.5-Fix: den Unread-Stand HIER NEU berechnen statt den gemerkten Count
    // zu verwenden. Der gemerkte Count wurde beim Öffnen des Sheets eingefroren;
    // hat der User danach im Sheet Stories (oder „alle") als gelesen markiert
    // und das Sheet schnell geschlossen, war der gemerkte Count veraltet und
    // der Toast poppte mit „X neue Stories" auf, obwohl keine mehr offen sind.
    // Jetzt zeigt der Toast nur, wenn WIRKLICH noch ungelesene Stories da sind.
    let n = 0;
    try { n = newsUnreadCount(); } catch(e){ n = 0; }
    _newsToastDeferredCount = 0;
    if(n <= 0) return;
    // Direkt anzeigen — Cooldown-Check schon im _maybeShowNewsToast wurde
    // bereits beim ersten Aufruf erfüllt; hier zwingen wir die Anzeige.
    const toast = document.getElementById('newsToast');
    const txt = document.getElementById('newsToastTxt');
    if(!toast || !txt) return;
    txt.textContent = n + (n === 1 ? ' neue Story' : ' neue Stories');
    _positionNewsToast();
    toast.classList.add('visible');
    void toast.offsetWidth;
    toast.classList.add('show');
    _newsSaveToastState({lastCount: n, lastTs: Date.now()});
    if(_newsToastHideTimer) clearTimeout(_newsToastHideTimer);
    _newsToastHideTimer = setTimeout(() => _hideNewsToast(), 4000);
    toast.onclick = () => {
      _hideNewsToast();
      try { openNewsFeed(); } catch(e){}
    };
  }, 500);
}
window._processDeferredNewsToast = _processDeferredNewsToast;

// ─── §11.5 — Mini-Popup ──────────────────────────────────────────────
// Klein, kompakt, max 5 Stories. Beim Öffnen: Stories werden NICHT als
// gelesen markiert; das passiert erst beim Schließen/Wechsel zum Vollfeed.
// Ein einzelner Story-Tap markiert nur diese eine Story.
function openNewsPopover(){
  // Falls der "X neue Stories"-Toast gerade läuft, sofort ausblenden —
  // er hat seinen Job (User auf News aufmerksam machen) erfüllt.
  try { _hideNewsToast(); } catch(e){}
  const stories = getStoriesCache();
  const seen = _newsLoadSeen();
  const top = stories.slice(0, 5);
  const nv = document.getElementById('nv');
  const bg = document.getElementById('nvBg');
  if(!nv || !bg) return;
  const newCount = stories.filter(s => !seen.has(s.id)).length;
  const headerSub = newCount > 0
    ? (newCount === 1 ? '1 neue Story' : newCount+' neue Stories')
    : (stories.length ? 'Aktuelles aus der Liga' : 'Noch keine Stories');
  nv.innerHTML = `
    <div class="nv-head">
      <div class="nv-head-ic">${svgI('newspaper')}</div>
      <div style="flex:1;min-width:0">
        <div class="nv-head-title">Liga News</div>
        <div class="nv-head-sub">${esc(headerSub)}</div>
      </div>
      <button class="nv-head-close" id="nvCloseBtn" aria-label="Schließen">×</button>
    </div>
    <div class="nv-list" id="nvList">
      ${top.length
        ? top.map(s => _newsCardHtml(s, seen.has(s.id))).join('')
        : '<div class="nv-empty">Sobald sich etwas in der Liga tut, erscheint es hier.</div>'}
    </div>
    <div class="nv-foot">
      <button class="nv-foot-btn" id="nvOpenFeed">Alle Stories anzeigen<span class="arr">›</span></button>
    </div>`;
  bg.classList.add('show');
  document.getElementById('nvCloseBtn').onclick = closeNewsPopover;
  document.getElementById('nvOpenFeed').onclick = () => {
    closeNewsPopover();
    // Kurz warten bis Popover ausgeblendet ist (vermeidet z-index-Stacking-Glitch)
    setTimeout(openNewsFeed, 180);
  };
  // Story-Click: Detail öffnen, sofort als gelesen markieren, Card visuell updaten
  nv.querySelectorAll('.nv-story[data-sid]').forEach(el => {
    el.onclick = () => {
      const sid = el.dataset.sid;
      _newsMarkSeen(sid);
      el.classList.add('read');
      el.querySelector('.nv-story-dot')?.remove();
      newsBadgeRefresh();
      openNewsDetail(sid);
    };
  });
}
function closeNewsPopover(){
  const bg = document.getElementById('nvBg');
  if(bg) bg.classList.remove('show');
}

// Story-Card-HTML — wird im Popover UND im Vollfeed verwendet
function _newsCardHtml(s, isRead){
  const cat = NEWS_CATEGORIES[s.cat] || NEWS_CATEGORIES.fun;
  return `<div class="nv-story nv-cat-${s.cat} ${isRead?'read':''}" data-sid="${esc(s.id)}">
    <div class="nv-story-ic">${svgI(s.ic || cat.ic)}</div>
    <div class="nv-story-body">
      <div class="nv-story-cat nv-cat-tag ${s.cat}">${esc(cat.descLabel)}</div>
      <div class="nv-story-title">${esc(s.title)}</div>
      <div class="nv-story-desc">${esc(s.desc)}</div>
      <div class="nv-story-when">${esc(_newsWhenLabel(s.when))}</div>
    </div>
    ${!isRead ? '<div class="nv-story-dot"></div>' : ''}
  </div>`;
}

// Datumsformatierung: "Heute, 16:07" / "Gestern, 21:11" / "12.06., 14:30"
function _newsWhenLabel(when){
  const d = new Date(when);
  const now = new Date();
  // Datumskeys in LOKALER Zeit bilden (nicht via toISOString → UTC): sonst zeigt
  // eine Story mit when=heute 00:00 Lokalzeit in Zonen mit positivem UTC-Offset
  // fälschlich „Gestern", obwohl die Uhrzeit lokal (toLocaleTimeString) heute ist.
  const _lkey = x => x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');
  const todayKey = _lkey(now);
  const yest = _lkey(new Date(now.getTime() - 86400000));
  const dKey = _lkey(d);
  const hhmm = d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
  if(dKey === todayKey) return 'Heute, '+hhmm;
  if(dKey === yest) return 'Gestern, '+hhmm;
  return d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'})+', '+hhmm;
}

// Der Kalendertag einer Story, als Überschrift für eine Feed-Gruppe.
// Gleiche Zeitrechnung wie _newsWhenLabel: lokale Datumskeys, kein UTC.
function _newsDayLabel(when){
  const d = new Date(when), now = new Date();
  const k = x => x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');
  if(k(d) === k(now)) return 'Heute';
  if(k(d) === k(new Date(now.getTime() - 86400000))) return 'Gestern';
  return d.toLocaleDateString('de-DE',{weekday:'short',day:'numeric',month:'long'});
}
function _newsDayKey(when){
  const d = new Date(when);
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}

// ─── §11.6 — Voller Feed (im Sheet) mit Filter-Pills ─────────────────
let _newsFeedFilter = 'all'; // 'all' | 'new' | cat-Key
function openNewsFeed(){
  _newsFeedFilter = 'all';
  _renderNewsFeed();
}
// ─── §11.6b — Breaking-Erkennung + M2-Karten (v9) ────────────────────
// „Breaking" ist eine ANZEIGE-Kategorie, kein Generator-Typ: ultra-seltene,
// liga-relevante Ereignisse werden display-seitig hierher promotet (wirkt auf
// bestehende UND neue persistierte Rows, ohne Regenerierung).
function _isBreaking(s){
  const d = (s && s.dataRef) || {};
  // SECHS Regeln, mehr nicht. Breaking soll heißen: das passiert vielleicht
  // einmal im Monat. Gefallen sind `top_clash` (Platz 1 schlägt Platz 2 —
  // kam allein im aktuellen Fenster von 33 Stories vor) und `giant_slayer`
  // (Sieg mit unter 20 % Chance — dafür gibt es die Highlight-Karte).
  // `season_endgame` bleibt, weil es pro Monat höchstens einmal feuert.
  switch(d.type){
    case 'lead_change':     // 1. neuer Spitzenreiter der Liga
    case 'elo_record':      // 2. neuer All-Time-Elo-Rekord
    case 'streak_record':   // 3. längste Siegesserie aller Zeiten
    case 'season_recap':    // 4. der Meister steht fest
    case 'season_endgame':  // 5. Titelentscheidung am Monatsende
      return true;
    case 'badge_unlocked':  // 6. nur legendäre Auszeichnungen
      return d.rarity === 'legendary';
    default:
      return false;
  }
}
// Anzeige-Kategorie: Breaking überschreibt die echte cat NUR fürs Styling.
function _displayCat(s){ return _isBreaking(s) ? 'breaking' : ((s && s.cat) || 'fun'); }
// Wichtige Karten bekommen den farbigen Glow-Rahmen (nur solange ungelesen).
function _isImportant(s){
  const d = (s && s.dataRef) || {};
  return _isBreaking(s) || (s && s.cat === 'highlight') || d.rarity === 'legendary' || d.rarity === 'rare';
}

// ─── Wer kommt in der Geschichte vor? ────────────────────────────────
// Die Spieler-IDs liegen je nach Typ in verschiedenen Feldern — historisch
// gewachsen, und persistierte Rows aus alten Versionen tragen die alten
// Namen. Deshalb wird gesucht statt vorausgesetzt. Höchstens drei: mehr
// Gesichter nebeneinander erkennt auf einer Karte niemand mehr.
function _newsPids(s){
  const d = (s && s.dataRef) || {};
  const raus = [];
  const dazu = v => {
    (Array.isArray(v) ? v : [v]).forEach(id => {
      if(typeof id === 'string' && id.length > 8 && raus.indexOf(id) < 0 && pmap()[id]) raus.push(id);
    });
  };
  ['playerId','ambientPid','pid','championId','a','b','playerIds','ambientPids',
   'breakerIds','victimPid'].forEach(k => { if(d[k] != null) dazu(d[k]); });
  return raus.slice(0, 3);
}

// Das Gesicht links auf der Karte. Vorher stand dort nichts: die News waren
// die einzige Ansicht der App, in der ein Spieler nur ein Name war. Ein
// Spieler bekommt sein Wappen [§C27], ein Duo zwei überlappende Chips —
// ein Duo hat keinen Rang und also auch kein Wappen. Steht niemand in der
// Geschichte (Saisonstart, spielfreie Tage), bleibt die Spalte weg.
function _newsGesichtHtml(s){
  const ids = _newsPids(s);
  if(!ids.length) return '';
  if(ids.length === 1){
    const p = pmap()[ids[0]];
    // Kein Feuer: eine Meldung von vorgestern hat keine laufende Serie [§C26].
    return `<div class="nf-face">${avHtml(p, '', {ins:true, px:48, feuer:0})}</div>`;
  }
  return `<div class="nf-face nf-face-paar">${
    ids.slice(0,2).map(id => avHtml(pmap()[id], '', {})).join('')}${
    ids.length > 2 ? `<span class="av nf-face-mehr">+${ids.length-2}</span>` : ''}</div>`;
}

// Mini-Visual rechts auf der Karte — rein aus dataRef (kein Match-Lookup).
function _newsVisual(s){
  const d = (s && s.dataRef) || {};
  const flames = n => `<div class="nf-v-streak"><span class="fl">${svgI('flame')}</span><span class="fl">${svgI('flame')}</span><span class="fl">${svgI('flame')}</span><span class="n">${n}</span></div>`;
  const chip = (val, label) => `<div class="nf-v"><div class="nf-bigchip">${val}</div>${label?`<span class="nf-vlabel">${label}</span>`:''}</div>`;
  // Prestige-Karten zeigen dasselbe Zeichen wie das Profil [§13.9]. Der Feed
  // wird damit zur Vitrine: Wer im Profil einen neuen Reif bekommt, sieht ihn
  // hier wieder — statt einer Zahl, die dasselbe noch einmal behauptet.
  if(d.prestige && d.ambientPid && typeof insigniumSvg === 'function'){
    try {
      return `<div class="nf-v nf-v-ins">${insigniumSvg(d.ambientPid, {band:false})}`
        + (s.vv ? `<span class="nf-vlabel num">${esc(s.vv)}${s.vl ? ' ' + esc(s.vl) : ''}</span>` : '')
        + `</div>`;
    } catch(e){ /* dann eben der normale Chip */ }
  }
  switch(d.type){
    case 'top_form':    return d.wins!=null   ? `<div class="nf-v">${flames(d.wins+'/10')}</div>` : '';
    case 'win_streak':
    case 'team_streak': return d.streak!=null ? `<div class="nf-v">${flames(d.streak)}</div>` : '';
    case 'team_loss_streak':
    case 'loss_streak': return d.streak!=null ? chip(d.streak+'×','in Folge') : '';
    case 'elo_swing':   return chip(((d.delta||0)>0?'+':'')+(d.delta||0),'Elo');
    case 'jubilee':     return d.total!=null ? chip(d.total+'.','Spiel') : '';
    case 'milestone_wins':
    case 'milestone_goals':
    case 'milestone_elo': {
      const m = String(d.milestone||'').match(/\d+/);
      const lbl = d.type==='milestone_goals' ? 'Tore' : d.type==='milestone_elo' ? 'Elo' : 'Siege';
      return m ? chip(m[0], lbl) : '';
    }
    case 'badge_unlocked':  return `<div class="nf-v"><div class="nf-v-badge">${svgI(s.ic||'trophy')}</div></div>`;
    case 'lead_change':     return `<div class="nf-v"><div class="nf-v-crown">${svgI('crown')}<span class="rk">#1</span></div></div>`;
    case 'top_clash':       return `<div class="nf-v"><div class="nf-v-crown">${svgI('swords')}</div></div>`;
    case 'elo_record':      return d.elo!=null ? chip(d.elo,'Rekord-Elo') : '';
    case 'streak_record':   return d.streak!=null ? `<div class="nf-v">${flames(d.streak)}</div>` : '';
    case 'giant_slayer':    return d.chance!=null ? chip(Math.max(1,Math.round(d.chance*100))+'%','Chance') : '';
    case 'biggest_blowout': return d.diff!=null ? chip('+'+d.diff,'Tore') : '';
    case 'potw':
    case 'potd':            return d.wins!=null ? chip(d.wins,'Siege') : '';
    case 'group':           return Array.isArray(d.playerIds) ? chip(d.playerIds.length+'×','') : '';
    // v9.17: Fun Facts dürfen ihre Kennzahl ebenfalls groß zeigen (vv/vl aus dem
    // Template). Ältere persistierte Rows haben die Felder nicht → kein Chip,
    // Karte sieht aus wie bisher.
    case 'ambient':         return d.vv != null ? chip(esc(String(d.vv)), d.vl ? esc(d.vl) : '') : '';
    default: return '';
  }
}

// M2-Karte: getönt, Kategorie-Pill-Chip, Glow bei wichtigen News, Mini-Visual.
// In der Gruppenansicht steht der Tag schon in der Überschrift — die Karte
// braucht dann nur noch die Uhrzeit, sonst liest man dreimal „Heute".
function _newsUhrzeit(when){
  return new Date(when).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
}

function _newsCardHtmlM2(s, isRead){
  const dcat = _displayCat(s);
  const meta = NEWS_CATEGORIES[dcat] || NEWS_CATEGORIES.fun;
  const vis = _newsVisual(s);
  const imp = (_isImportant(s) && !isRead) ? ' important' : '';
  const face = _newsGesichtHtml(s);
  return `<div class="nf-card nfc-${dcat}${isRead?' read':''}${imp}" data-sid="${esc(s.id)}">
    <div class="nf-top">
      <span class="nf-chip">${svgI(s.ic || meta.ic)} ${esc(meta.descLabel)}</span>
      <span class="nf-when">${esc(_newsUhrzeit(s.when))}${isRead?'':'<span class="nf-dot"></span>'}</span>
    </div>
    <div class="nf-grid${face?' mit-gesicht':''}">
      ${face}
      <div><div class="nf-h">${esc(s.title)}</div><div class="nf-d">${esc(s.desc)}</div></div>
      ${vis}
    </div>
  </div>`;
}

// Breaking-Hero — das Herzstück oben im Sheet, bewusst dramatisch.
// v9.1: etwas längerer, spannenderer Hero-Text je Breaking-Typ — display-seitig
// aus dataRef gebaut (wirkt auch auf bereits persistierte Rows). Bewusst 1–2
// Sätze: soll neugierig machen, aber nicht von den Stories darunter ablenken.
// Fällt auf s.desc zurück, wenn die Datenlage nicht reicht.
function _breakingHeroText(s){
  const d = (s && s.dataRef) || {};
  const pm = (typeof pmap === 'function') ? pmap() : {};
  const nm = id => (pm[id] && pm[id].name) || '?';
  try {
    switch(d.type){
      case 'season_recap': {
        const te = Array.isArray(d.topElo) ? d.topElo : [];
        const champ = nm(d.championId || (te[0] && te[0].id));
        const runner = te[1] && te[1].id ? nm(te[1].id) : null;
        const elo = d.championElo != null ? d.championElo : (te[0] && te[0].elo);
        return `Die Saison ${d.sid || ''} ist Geschichte: ${champ} krönt sich mit ${elo} Elo zum Champion`
          + (runner ? ` — vor ${runner}.` : '.')
          + ` Wer stürzt ${champ} in der neuen Saison vom Thron?`;
      }
      case 'lead_change':
        return `Machtwechsel an der Tabellenspitze: ${nm(d.newLeader)} verdrängt ${nm(d.prevLeader)} und übernimmt die Führung. Das Titelrennen ist wieder völlig offen.`;
      case 'top_clash': {
        // p1/p2 (v9.3): Platz-1- bzw. Platz-2-Spieler namentlich. Fallback auf
        // Sieger-Team für alte, vor v9.3 persistierte Stories.
        const a = d.p1 ? nm(d.p1) : (Array.isArray(d.winners) ? d.winners.map(nm).join(' & ') : '');
        const b = d.p2 ? nm(d.p2) : null;
        return b
          ? `Gipfeltreffen an der Spitze: Tabellenführer ${a} bezwingt Verfolger ${b} im direkten Duell und baut den Vorsprung an der Spitze aus.`
          : `Gipfeltreffen an der Spitze: ${a} setzt sich im Spitzenspiel durch und zieht weiter davon.`;
      }
      case 'season_endgame': {
        const leader = d.leader && d.leader.pid ? nm(d.leader.pid) : '';
        const dl = d.daysLeft;
        const dtxt = dl != null ? `Nur noch ${dl} ${dl === 1 ? 'Tag' : 'Tage'} bis zum Saisonende` : 'Der Saison-Endspurt läuft';
        return `${dtxt}: ${leader} führt`
          + (d.gap != null ? `, doch der Vorsprung von ${d.gap} Elo ist alles andere als sicher.` : '.')
          + ' Jetzt zählt jedes Spiel.';
      }
      case 'badge_unlocked':
        return `${nm(d.playerId)} schnappt sich mit „${d.badgeName || s.title}" eine der seltensten Auszeichnungen der Liga — das gelingt fast niemandem.`;
      case 'elo_record':
        return `${nm(d.pid)} schreibt Liga-Geschichte: Mit ${d.elo} Elo steht kein Spieler jemals höher. Eine neue Bestmarke für die Ewigkeit — wer traut sich, sie anzugreifen?`;
      case 'streak_record':
        return `${nm(d.pid)} stellt einen Liga-Rekord für die Ewigkeit auf: ${d.streak} Siege in Folge — keine Serie war jemals länger. Wer stoppt diesen Lauf?`;
      case 'giant_slayer': {
        const w = Array.isArray(d.winners) ? d.winners.map(nm).join(' & ') : '';
        const l = Array.isArray(d.losers) ? d.losers.map(nm).join(' & ') : 'den Favoriten';
        const pct = d.chance!=null ? Math.max(1, Math.round(d.chance*100)) : null;
        return `Die Sensation des Spieltags: Mit nur ${pct!=null?pct+'%':'minimaler'} Siegchance bezwingt ${w} das Favoriten-Team ${l}. So einen Coup sieht man in der Liga fast nie.`;
      }
    }
  } catch(e){}
  return s.desc || '';
}
function _newsHeroHtml(s){
  const meta = NEWS_CATEGORIES.breaking;
  return `<div class="nf-hero nfc-breaking" data-sid="${esc(s.id)}">
    <div class="nf-hero-bg"></div><div class="nf-hero-spot"></div>
    <div class="nf-hero-wm">${svgI(s.ic || meta.ic)}</div>
    <div class="nf-hero-when">${esc(_newsWhenLabel(s.when))}</div>
    <div class="nf-hero-ct">
      <span class="nf-hero-pill"><span class="pulse"></span>${svgI('bolt')} Breaking News</span>
      <h2>${esc(s.title)}</h2>
      <div class="nf-hero-sub">${esc(_breakingHeroText(s))}</div>
    </div>
  </div>`;
}

function _renderNewsFeed(){
  _sheetSetReopen(()=>_renderNewsFeed());
  const stories = getStoriesCache();
  const seen = _newsLoadSeen();
  // Kuratierte, bewusst KURZE Filter-Liste (v9.1): „Neu"/„Ungelesen"/„Saison"
  // entfernt — der Feed ist ohnehin neueste-zuerst; das reduziert Rauschen.
  const filters = [
    {k:'all',       label:'Alle'},
    {k:'breaking',  label:'Breaking'},
    {k:'highlight', label:'Highlights'},
    {k:'badge',     label:'Awards'},
    {k:'team',      label:'Teams'},
    {k:'fun',       label:'Fun Facts'},
  ];
  const ONE_DAY = 86400000;
  const nowTs = Date.now();
  let filtered = stories;
  if(_newsFeedFilter === 'new'){
    filtered = stories.filter(s => !seen.has(s.id) && (nowTs - new Date(s.when).getTime()) < ONE_DAY);
  } else if(_newsFeedFilter === 'unread'){
    filtered = stories.filter(s => !seen.has(s.id));
  } else if(_newsFeedFilter === 'breaking'){
    filtered = stories.filter(_isBreaking);
  } else if(_newsFeedFilter !== 'all'){
    filtered = stories.filter(s => s.cat === _newsFeedFilter);
  }

  // Breaking-Hero: jüngste Breaking-Story (max. 14 Tage alt). Nur bei „Alle"/
  // „Breaking" und aus der Kartenliste herausgelöst, damit kein Doppel.
  const HERO_MAX_AGE = 14 * ONE_DAY;
  let hero = null;
  if(_newsFeedFilter === 'all' || _newsFeedFilter === 'breaking'){
    hero = filtered.find(s => _isBreaking(s) && (nowTs - new Date(s.when).getTime()) < HERO_MAX_AGE) || null;
  }
  const cards = hero ? filtered.filter(s => s.id !== hero.id) : filtered;

  // Reiter statt Pillen: dieselbe Sprache wie im Awards-Tab. Eine grüne
  // Pille im Filter zog vorher mehr Blick auf sich als jede Schlagzeile.
  const filterBar = `<div class="ui-tabs roll">
    ${filters.map(f => `<button class="${_newsFeedFilter===f.k?'on':''}" data-f="${f.k}">${esc(f.label)}</button>`).join('')}
  </div>`;
  const heroHtml = hero ? _newsHeroHtml(hero) : '';
  // Protokoll statt Halde: die Stories stehen unter dem Tag, an dem sie
  // passiert sind. Ein einzelner Trenner „Aktuelle Stories" über sechzig
  // Karten sagt nichts darüber, wann etwas passiert ist.
  let listHtml;
  if(!cards.length){
    listHtml = hero ? '' : '<div class="nv-empty">Keine Stories in dieser Auswahl.</div>';
  } else {
    const gruppen = [];
    cards.forEach(st => {
      const k = _newsDayKey(st.when);
      const g = gruppen[gruppen.length-1];
      if(g && g.k === k) g.items.push(st);
      else gruppen.push({k, label:_newsDayLabel(st.when), items:[st]});
    });
    listHtml = gruppen.map(g => `
      <div class="nf-daydiv"><span>${esc(g.label)}</span><span class="n num">${g.items.length}</span></div>
      <div class="nf-feed">${g.items.map(st => _newsCardHtmlM2(st, seen.has(st.id))).join('')}</div>`).join('');
  }

  const datum = new Date().toLocaleDateString('de-DE',
    {weekday:'long', day:'numeric', month:'long', year:'numeric'});
  // Der Gelesen-Knopf stand ganz unten hinter allen Karten — dort sucht ihn
  // niemand. Er gehört dorthin, wo auch die Zahl steht, die ihn erklärt: wie
  // viele Stories noch offen sind. Ohne offene Stories fällt beides weg.
  const offen = stories.filter(x => !seen.has(x.id)).length;
  const leiste = offen ? `
    <div class="nf-leiste">
      <span class="nf-offen"><i></i>${offen} ungelesen</span>
      <button class="nf-markall" id="nvMarkAllBtn" type="button">${svgI('check')}<span>Alle gelesen</span></button>
    </div>` : '';
  openSheet(`
    <div class="nf-wrap">
      <div class="nf-kopf">
        <div class="nf-masthead">LIGA NEWS</div>
        <div class="nf-datum">${esc(datum)}</div>
      </div>
      ${leiste}
      ${filterBar}
      ${heroHtml}
    </div>
    <div class="nf-wrap" style="padding-top:0">${listHtml}</div>
  `);

  // Filter-Click → re-render (billig, Daten aus Cache).
  const sheet = document.getElementById('sheet');
  sheet.querySelectorAll('.ui-tabs button[data-f]').forEach(el => {
    el.onclick = () => { _newsFeedFilter = el.dataset.f; _renderNewsFeed(); };
  });
  // „Alle als gelesen markieren" — markiert ALLE Cache-Stories.
  const markBtn = document.getElementById('nvMarkAllBtn');
  if(markBtn){
    markBtn.onclick = () => {
      try { _newsMarkAllSeen(); } catch(e){}
      try { newsBadgeRefresh(); } catch(e){}
      sheet.querySelectorAll('.nf-card, .nf-hero').forEach(el => {
        el.classList.add('read'); el.classList.remove('important');
        el.querySelector('.nf-dot')?.remove();
      });
      // Die Leiste zeigt die Zahl der offenen Stories; nach dem Markieren ist
      // sie null, also gehört sie weg. Neu zeichnen statt den Knopf abblenden.
      _renderNewsFeed();
    };
  }
  // Karten + Hero klickbar → Detail.
  sheet.querySelectorAll('[data-sid]').forEach(el => {
    el.onclick = () => {
      const sid = el.dataset.sid;
      _newsMarkSeen(sid);
      el.classList.add('read'); el.classList.remove('important');
      el.querySelector('.nf-dot')?.remove();
      newsBadgeRefresh();
      openNewsDetail(sid);
    };
  });
}

