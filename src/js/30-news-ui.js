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
// Der Tageskopf trägt den Wochentag ausgeschrieben und das Datum daneben.
// Vorher stand dort „Mi, 26. August" in einer Zeile mit der Anzahl; wer scrollte,
// übersah den Tageswechsel und las zwei Spieltage als einen. Heute und gestern
// behalten ihr Wort, weil man an ihnen kein Datum nachschlagen will.
function _newsDayLabel(when){
  const d = new Date(when), now = new Date();
  const k = x => x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');
  if(k(d) === k(now)) return 'HEUTE';
  if(k(d) === k(new Date(now.getTime() - 86400000))) return 'GESTERN';
  return d.toLocaleDateString('de-DE',{weekday:'long'}).toUpperCase();
}
// Das Datum unter dem Wochentag. Bei „Heute" und „Gestern" steht es trotzdem
// da: sonst weiß man beim Zurückblättern nicht, wo man ist.
function _newsDayDate(when){
  const d = new Date(when);
  return d.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'2-digit'});
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
  // Breaking heißt: das passiert vielleicht einmal im Monat. Erlaubt sind
  // ausschließlich extrem seltene Auszeichnungen und echte EREIGNISSE —
  // etwas, das vorher noch nie da war oder die Spitze der Liga verschiebt.
  // Gefallen sind `top_clash` (Platz 1 schlägt Platz 2 — kam allein in einem
  // Fenster von 33 Stories vor), `giant_slayer` (dafür gibt es die
  // Highlight-Karte) und `season_endgame`: „Noch 5 Tage" ist ein Countdown,
  // kein Ereignis, und es stand als einzige Breaking-Karte im Feed.
  switch(d.type){
    case 'lead_change':      // neuer Spitzenreiter der Liga
    case 'elo_record':       // neuer Allzeit-Elo-Rekord
    case 'streak_record':    // längste Siegesserie aller Zeiten
    case 'season_recap':     // der Meister steht fest
    case 'rekord_erstmals':  // ein Liga-Rekord wird zum ersten Mal vergeben
      return true;
    case 'badge_unlocked':   // nur legendäre Auszeichnungen
      return d.rarity === 'legendary';
    case 'insignium_stufe':  // nur Lorbeerreif und Ordensstern [§C30]
      return !!d.oben;
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

// Das Mini-Visual rechts auf der Karte ist entfallen. Es zeigte je Typ ein
// Symbol oder eine Zahl an derselben Stelle, egal worum es ging — die Sorte
// war daran nicht zu erkennen. Diese Aufgabe tragen jetzt die acht
// Bauformen: das Ergebnisband, der große Wert, die Leiter, das Zahlenband.

function _newsUhrzeit(when){
  return new Date(when).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
}

function _newsCardHtmlM2(s, isRead, istTagesKarte){
  const dcat = _displayCat(s);
  const meta = NEWS_CATEGORIES[dcat] || NEWS_CATEGORIES.fun;
  const d = s.dataRef || {};
  const sorte = _newsSorte(s);
  const brk = _isBreaking(s);
  const imp = (_isImportant(s) && !isRead) ? ' important' : '';
  // Die Karte des Tages steht groß, mit einem Streifen darüber. Vorher stand
  // ihre Schlagzeile im Tageskopf und gleich darunter noch einmal auf der
  // Karte selbst.
  const gross = istTagesKarte && !brk;
  // Breaking sprang bisher als Hero an den Kopf des Feeds und damit aus der
  // Chronologie. Es bleibt jetzt an seinem Platz und trägt stattdessen einen
  // roten Kopfbalken mit Punkt und Zeitstempel [§11.6b].
  const balken = brk
    ? `<div class="nf-brk-band"><span class="nf-brk-punkt"></span>BREAKING`
      + `<span class="nf-brk-zeit">${esc(_newsWhenLabel(s.when))}</span></div>`
    : '';

  // ── Je Sorte ein eigener Kopf und ein eigener Fuß ──────────────────
  // Vorher unterschied die Sorten nur eine Randfarbe, und zehn Karten
  // untereinander sahen alle gleich aus.
  let kopf = '', fuss = '', gesicht = '';
  const pm = pmap();
  const av = (pid, px) => (pm[pid] ? avHtml(pm[pid], '', {ins:true, px:px||44, feuer:0}) : '');

  if(sorte === 'spiel'){
    kopf = _newsErgebnisBand(d.matchId);
    fuss = _newsZahlband(_newsSpielZahlen(s));
  } else if(sorte === 'tafel'){
    const w = _newsTafelWert(s);
    gesicht = `<div class="nf-gr-l">${w ? _newsWertBlock(w.v, w.l, 'gold') : _newsGesichtHtml(s)}</div>`;
  } else if(sorte === 'ins'){
    gesicht = `<div class="nf-gr-l">${av(d.pid, 48)}</div>`;
    fuss = _newsLeiter(d.pid);
  } else if(sorte === 'held'){
    const pid = d.playerId || (Array.isArray(d.playerIds) ? d.playerIds[0] : null);
    gesicht = `<div class="nf-gr-l">${av(pid, 52)}</div>`;
    fuss = _newsZahlband([
      {v: d.wr != null ? Math.round(d.wr * 100) + ' %' : null, l:'Siegquote', f:'g'},
      {v: (d.wins != null && d.games != null) ? d.wins + ' : ' + (d.games - d.wins) : null,
       l:'Siege zu Niederlagen'},
      {v: _newsRangKurz(pid), l:'in der Liga'}
    ]);
  } else if(sorte === 'woche'){
    const teile = Array.isArray(d.teile) ? d.teile : [];
    fuss = `<div class="nf-wl">${teile.slice(0, 3).map(t =>
      `<div class="nf-wl-z"><span>${esc(t.label || '')}</span>`
      + `<i>${esc((t.pids || []).map(p => (pm[p] || {}).name || '').filter(Boolean).join(' und '))}</i>`
      + `<b>${esc(t.wert || '')}</b></div>`).join('')}`
      + (teile.length > 3 ? `<div class="nf-wl-m">und ${teile.length - 3} weitere Wertungen</div>` : '')
      + `</div>`;
  } else if(sorte === 'duo'){
    gesicht = `<div class="nf-gr-l nf-duo">${[d.a, d.b].filter(Boolean).map(p => av(p, 34)).join('')
      || (Array.isArray(d.playerIds) ? d.playerIds.slice(0, 2).map(p => av(p, 34)).join('') : '')}</div>`;
    if(d.streak) fuss = _newsZahlband([{v: d.streak, l:'Partien nacheinander', f: d.type === 'team_loss_streak' ? 'r' : 'g'}]);
    else if(d.n) fuss = _newsZahlband([{v: d.n, l:'direkte Duelle'}]);
  } else if(sorte === 'badge'){
    gesicht = `<div class="nf-gr-l">${av(d.playerId, 44)}</div>`;
    fuss = `<div class="nf-bd"><span class="nf-bd-ic nf-bd-${esc(d.rarity || 'common')}">${svgI(s.ic || 'trophyStar')}</span>`
         + `<span class="nf-bd-t"><b>${esc(d.badgeName || '')}</b>`
         + `<i>${esc(_newsRarityLabel(d.rarity))}</i></span></div>`;
  } else if(sorte === 'marke'){
    gesicht = `<div class="nf-gr-l">${av(d.pid, 44)}</div>`;
    const wert = d.delta != null ? (d.delta > 0 ? '+' + d.delta : String(d.delta))
               : (d.streak != null ? String(d.streak) : (d.milestone || null));
    if(wert) fuss = _newsZahlband([{v: wert,
      l: d.delta != null ? 'Elo' : (d.streak != null ? 'in Folge' : 'erreicht'),
      f: d.type === 'loss_streak' ? 'r' : (d.delta > 0 ? 'gr' : '')}]);
  } else {
    // Fun Fact: die Zahl links, der Satz rechts. Bewusst der leiseste Bau.
    if(d.vv != null && d.vv !== '') gesicht = `<div class="nf-gr-l">${_newsWertBlock(d.vv, d.vl, 'metall')}</div>`;
    else gesicht = `<div class="nf-gr-l">${_newsGesichtHtml(s)}</div>`;
  }
  if(!gesicht && sorte !== 'spiel' && sorte !== 'woche'){
    const g = _newsGesichtHtml(s);
    if(g) gesicht = `<div class="nf-gr-l">${g}</div>`;
  }

  return `<div class="nf-card nf-s-${sorte} nfc-${dcat}${brk?' nf-brk':''}${gross?' nf-gross':''}${isRead?' read':''}${imp}" data-sid="${esc(s.id)}">
    ${gross ? '<div class="nf-gross-band">DIE KARTE DES TAGES</div>' : ''}
    ${balken}
    ${kopf}
    <div class="nf-top">
      <span class="nf-chip">${svgI(s.ic || meta.ic)} ${esc(meta.descLabel)}</span>
      <span class="nf-when">${esc(_newsUhrzeit(s.when))}${isRead?'':'<span class="nf-dot"></span>'}</span>
    </div>
    <div class="nf-gr${gesicht?' mit-l':''}">
      ${gesicht}
      <div class="nf-gr-r"><div class="nf-h">${esc(s.title)}</div><div class="nf-d">${esc(s.desc)}</div></div>
    </div>
    ${fuss}
    ${brk ? `<div class="nf-brk-sub">${esc(_breakingHeroText(s))}</div>` : ''}
  </div>`;
}

// Die Zahlen einer Spieltags-Karte. Sie stehen im Fuß, damit der Satz sie
// nicht wiederholen muss.
function _newsSpielZahlen(s){
  const d = s.dataRef || {};
  const m = (matches || []).find(x => x.id === d.matchId);
  const diff = m ? Math.abs((m.score_a||0) - (m.score_b||0)) : null;
  const out = [];
  if(d.streak) out.push({v: d.streak, l:'Siege, jetzt beendet', f:'g'});
  if(d.gap) out.push({v: 'Platz ' + (d.winnerRank || d.gap), l:'schlägt Platz ' + (d.loserRank || '')});
  if(d.chance != null) out.push({v: Math.max(1, Math.round(d.chance*100)) + ' %', l:'Siegchance vorher'});
  if(diff != null && out.length < 3) out.push({v: diff, l:'Tore Unterschied'});
  return out;
}

// Der große Wert einer Tafel-Karte. Ein Rekord lebt von seiner Zahl, nicht
// vom Satz darüber.
function _newsTafelWert(s){
  const d = s.dataRef || {};
  if(d.eintraege != null) return {v: d.eintraege, l:'Einträge'};
  if(d.teile && d.teile.length) return {v: d.teile.length, l:'Wechsel'};
  const m = String(s.desc || '').match(/(\d+[.,]?\d*\s?%|\d+)/);
  return m ? {v: m[1], l:'Bestwert'} : null;
}

// Der Rang eines Spielers als kurze Angabe fürs Zahlenband.
function _newsRangKurz(pid){
  try {
    const career = (getGlobalSim() || {}).careerElo || {};
    const ids = Object.keys(career).filter(id => pmap()[id] && !pmap()[id].hidden);
    ids.sort((a, b) => (career[b] ?? 0) - (career[a] ?? 0));
    const r = ids.indexOf(pid) + 1;
    return r > 0 ? 'Rang ' + r : null;
  } catch(e){ return null; }
}

// Wie selten die Auszeichnung ist, in Worten.
function _newsRarityLabel(r){
  return r === 'legendary' ? 'Legendär' : r === 'rare' ? 'Selten' : 'Gewöhnlich';
}

// Acht Sorten, acht Bauformen. Eine Karte soll man an der FORM erkennen,
// bevor man den ersten Satz gelesen hat. Vorher unterschied die Sorten nur
// eine Randfarbe, und zehn Karten untereinander sahen alle gleich aus.
// Die Farben folgen dem Farbgesetz [§C25]: Gold trägt, was Titel und Rekord
// ist, Rot bleibt der Richtung, Metall ist alles Übrige.
function _newsSorte(s){
  const d = (s && s.dataRef) || {};
  const t = d.type || '';
  if(t === 'woche') return 'woche';                       // Zeilen der Wertungen
  if(t === 'insignium_stufe') return 'ins';               // die Leiter
  if(t === 'ambient') return 'fakt';                      // leise, eine Zahl
  if(t === 'potd' || t === 'potw') return 'held';         // Wappen groß, Zahlenband
  if(t === 'badge_unlocked') return 'badge';              // das Zeichen der Auszeichnung
  if(t === 'sammel') return d.quelle === 'tafel' ? 'tafel' : 'spiel';
  if((s && s.cat) === 'tafel' || t.indexOf('rekord_') === 0 || t.indexOf('chronik_') === 0) return 'tafel';
  if(t === 'team_streak' || t === 'team_loss_streak' || t === 'team_woche'
     || t === 'rivalry' || t === 'rivalry_milestone') return 'duo';
  if(d.matchId) return 'spiel';                           // Ergebnisband
  if(d.pid) return 'marke';                               // ein Wappen, ein Wert
  return 'fakt';
}

// Das Ergebnisband: vier Wappen und der Endstand über der Schlagzeile. Wer
// nur scrollt, sieht schon, wer gegen wen gespielt hat und wie es ausging.
function _newsErgebnisBand(matchId){
  if(!matchId) return '';
  const m = (matches || []).find(x => x.id === matchId);
  if(!m) return '';
  const pm = pmap();
  const wappen = ids => ids.filter(id => pm[id])
    .map(id => avHtml(pm[id], '', {ins:true, px:30, feuer:0})).join('');
  const aWin = m.winner === 'A';
  return `<div class="nf-erg">
    <div class="nf-erg-s">${wappen([m.a1, m.a2])}</div>
    <div class="nf-erg-sc"><b class="${aWin?'w':'v'}">${m.score_a}</b>`
    + `<i>:</i><b class="${aWin?'v':'w'}">${m.score_b}</b></div>
    <div class="nf-erg-s re">${wappen([m.b1, m.b2])}</div>
  </div>`;
}

// Der große Wert links, daneben wofür er steht. Bei einem Rekord ist die Zahl
// die Hauptsache, nicht der Satz darüber.
function _newsWertBlock(wert, label, farbe){
  if(!wert) return '';
  return `<div class="nf-wert ${farbe || ''}"><b>${esc(String(wert))}</b>`
       + (label ? `<span>${esc(label)}</span>` : '') + `</div>`;
}

// Die Insignium-Leiter: fünf Punkte, die erreichten hell, der neue umrandet.
// Damit sieht man auf einen Blick, wo jemand steht und wie weit es noch ist.
function _newsLeiter(pid){
  try {
    const P = prestigeOf(pid);
    if(!P) return '';
    const stufe = P.stufe || 0;
    const punkte = INSIGNIEN.map((ins, i) =>
      `<span class="nf-lt-p st-${ins.key}${i <= stufe ? ' hat' : ''}${i === stufe ? ' jetzt' : ''}"></span>`).join('');
    const rest = P.naechste ? `${P.punkte} / ${P.naechste.min}` : `${P.punkte}`;
    return `<div class="nf-leiter">${punkte}<span class="nf-lt-t">${esc(rest)}</span></div>`;
  } catch(e){ return ''; }
}

// Das Zahlenband im Fuß: bis zu drei Werte mit ihrer Bezeichnung. Es steht
// dort, wo die Karte sonst aufhört, und trägt das, was der Satz nicht sagen
// muss.
function _newsZahlband(werte){
  const w = (werte || []).filter(x => x && x.v != null && x.v !== '');
  if(!w.length) return '';
  return `<div class="nf-zb">${w.slice(0, 3).map(x =>
    `<div><b class="${x.f || ''}">${esc(String(x.v))}</b><span>${esc(x.l || '')}</span></div>`).join('')}</div>`;
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
          + (runner ? `. Vor ${runner}.` : '.')
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
        return `${nm(d.playerId)} schnappt sich mit „${d.badgeName || s.title}" eine der seltensten Auszeichnungen der Liga. Das gelingt fast niemandem.`;
      case 'elo_record':
        return `${nm(d.pid)} schreibt Liga-Geschichte: Mit ${d.elo} Elo steht kein Spieler jemals höher. Eine neue Bestmarke für die Ewigkeit. Wer traut sich, sie anzugreifen?`;
      case 'streak_record':
        return `${nm(d.pid)} stellt einen Liga-Rekord für die Ewigkeit auf: ${d.streak} Siege in Folge. Keine Serie war jemals länger. Wer stoppt diesen Lauf?`;
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
// Der Tageskopf trug zuerst die Schlagzeile der wichtigsten Karte — und die
// stand damit zweimal untereinander, im Kopf und als erste Karte darunter.
// Er nennt jetzt die Bilanz des Tages: wie viel gespielt wurde und von wem.
// Das steht sonst nirgends im Feed und wiederholt keine Karte.
function _newsTagBilanz(dayKey){
  try {
    const tag = [];
    (matches || []).forEach(m => {
      const d = new Date(m.created_at);
      const k = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0')
              + '-' + String(d.getDate()).padStart(2,'0');
      if(k === dayKey) tag.push(m);
    });
    if(!tag.length) return '';
    const koepfe = new Set();
    tag.forEach(m => [m.a1, m.a2, m.b1, m.b2].forEach(id => { if(id) koepfe.add(id); }));
    return tag.length + (tag.length === 1 ? ' Partie' : ' Partien')
         + ' · ' + koepfe.size + ' Spieler';
  } catch(e){ return ''; }
}

// Welche Karte ist die Karte des Tages? Breaking zuerst, dann die höchste
// Priorität. Sie wird darunter groß gezeigt, statt im Kopf noch einmal
// aufgeschrieben zu werden.
//
// Es gibt sie **nur an Spieltagen**. An einem Tag ohne Partie ist nichts
// passiert, was ein Tag von einem anderen unterscheidet: dort standen sonst
// ein Fun Fact oder eine Zufallsstatistik groß im Bild, die mit diesem Tag
// nichts zu tun haben und gestern genauso dagestanden hätten.
function _newsTagKarte(items, dayKey){
  if(!Array.isArray(items) || items.length < 2) return null;
  if(!_newsTagBilanz(dayKey)) return null;   // an diesem Tag wurde nicht gespielt
  const OHNE = new Set(['ambient', 'dry_spell', 'season_endgame', 'quiet_week', 'season_start']);
  const kandidaten = items.filter(x => !OHNE.has((x.dataRef || {}).type));
  if(!kandidaten.length) return null;
  const beste = kandidaten.sort((a, b) => {
    const ba = _isBreaking(a) ? 1 : 0, bb = _isBreaking(b) ? 1 : 0;
    return (bb - ba) || ((b.prio || 0) - (a.prio || 0));
  })[0];
  return beste ? beste.id : null;
}
// Die Gesichter des Tages, höchstens vier. Ab 26 Pixeln abwärts bleibt vom
// Zeichen nichts übrig [§C26], deshalb stehen hier Wappen und keine Punkte.
function _newsTagGesichter(items){
  const ids = [];
  (items || []).forEach(st => {
    let p = [];
    try { p = _newsPids(st) || []; } catch(e){}
    p.forEach(id => { if(ids.indexOf(id) < 0) ids.push(id); });
  });
  if(!ids.length) return '';
  const zeig = ids.slice(0, 4).map(id => avHtml(pmap()[id], '', {ins:true, px:26, feuer:0})).join('');
  const rest = ids.length - 4;
  return zeig + (rest > 0 ? `<span class="nf-tag-mehr">und ${rest} weitere</span>` : '');
}

function _renderNewsFeed(){
  _sheetSetReopen(()=>_renderNewsFeed());
  const stories = getStoriesCache();
  const seen = _newsLoadSeen();
  // Vier Chips, nicht elf. Elf Rubriken sind eine Sortierhilfe für den, der
  // sie gebaut hat, nicht für den, der liest. Jeder Chip trägt seine Anzahl,
  // damit man vorher sieht, ob sich das Tippen lohnt.
  const _istTafel   = s => s.cat === 'tafel' || (s.dataRef||{}).quelle === 'tafel';
  const _istSpieltag = s => {
    const d = s.dataRef || {};
    if(d.type === 'ambient') return false;
    return !!(d.matchId || d.type === 'potd' || d.type === 'woche' ||
              (d.type === 'sammel' && d.quelle === 'spiel'));
  };
  const filters = [
    {k:'all',      label:'Alle',     test:() => true},
    {k:'breaking', label:'Breaking', test:_isBreaking},
    {k:'tafel',    label:'Tafel',    test:_istTafel},
    {k:'spieltag', label:'Spieltag', test:_istSpieltag},
  ];
  const aktiv = filters.find(f => f.k === _newsFeedFilter) || filters[0];
  const cards = _newsFeedFilter === 'all' ? stories : stories.filter(aktiv.test);

  const filterBar = `<div class="nf-chips">
    ${filters.map(f => {
      const n = f.k === 'all' ? stories.length : stories.filter(f.test).length;
      return `<button class="nf-chip-f${_newsFeedFilter===f.k?' on':''}${f.k==='breaking'?' brk':''}" data-f="${f.k}">`
           + `${esc(f.label)}<i>${n}</i></button>`;
    }).join('')}
  </div>`;

  // Die Tafel: ein Tageskopf, darunter alle Karten dieses Tages. Breaking
  // bleibt an seinem Platz in der Chronologie und wird nicht nach oben
  // gezogen — es trägt stattdessen einen roten Kopfbalken.
  let listHtml;
  if(!cards.length){
    listHtml = '<div class="nv-empty">Keine Stories in dieser Auswahl.</div>';
  } else {
    const gruppen = [];
    cards.forEach(st => {
      const k = _newsDayKey(st.when);
      const g = gruppen[gruppen.length-1];
      if(g && g.k === k) g.items.push(st);
      else gruppen.push({k, label:_newsDayLabel(st.when), datum:_newsDayDate(st.when), items:[st]});
    });
    listHtml = gruppen.map(g => {
      const neu = g.items.filter(st => !seen.has(st.id)).length;
      const bilanz = _newsTagBilanz(g.k);
      const gesichter = _newsTagGesichter(g.items);
      const tagesKarte = _newsTagKarte(g.items, g.k);
      return `<div class="nf-tag">
        <div class="nf-tag-z1"><span class="nf-tag-wt">${esc(g.label)}</span>`
        + `<span class="nf-tag-dt">${esc(g.datum)}</span>`
        + `<span class="nf-tag-n${neu?' neu':''}">${neu ? neu + ' NEU' : g.items.length + (g.items.length===1?' KARTE':' KARTEN')}</span></div>`
        + (bilanz ? `<div class="nf-tag-b">${esc(bilanz)}</div>` : '')
        + (gesichter ? `<div class="nf-tag-ges">${gesichter}</div>` : '')
        + `</div>
        <div class="nf-feed">${g.items.map(st =>
            _newsCardHtmlM2(st, seen.has(st.id), st.id === tagesKarte)).join('')}</div>`;
    }).join('');
  }

  const datum = new Date().toLocaleDateString('de-DE',
    {weekday:'long', day:'numeric', month:'long', year:'numeric'});
  // Der Gelesen-Knopf steht dort, wo auch die Zahl steht, die ihn erklärt.
  // Ohne offene Stories fällt beides weg.
  const offen = stories.filter(x => !seen.has(x.id)).length;
  const gelesenKnopf = offen
    ? `<button class="nf-gelesen" id="nvMarkAllBtn" type="button">ALLES GELESEN <b>${offen}</b></button>`
    : '';
  openSheet(`
    <div class="nf-wrap">
      <div class="nf-kopf nf-kopf-tafel">
        <div><div class="nf-masthead">LIGA NEWS</div>
        <div class="nf-datum">${esc(datum)}</div></div>
        ${gelesenKnopf}
      </div>
      ${filterBar}
    </div>
    <div class="nf-wrap" style="padding-top:0">${listHtml}</div>
  `);

  // Filter-Click → re-render (billig, Daten aus Cache).
  const sheet = document.getElementById('sheet');
  sheet.querySelectorAll('.nf-chips button[data-f]').forEach(el => {
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

