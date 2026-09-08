// ─── §11.7 — Story-Detail (dynamisch je Typ) ─────────────────────────
// Detail-Popover (z-index 140) — kann ÜBER Sheet (100) und nvBg (130)
// liegen und ist unabhängig schließbar.
function openNewsDetail(sid){
  const stories = getStoriesCache();
  const s = stories.find(x => x.id === sid);
  if(!s) return;
  // ── Read-State (Bugfix v8.1) ──
  // Story IMMER hier markieren — egal über welchen Pfad geöffnet wurde
  // (Mini-Popup, Feed-Card, Direkt-Aufruf). _newsMarkSeen ist idempotent
  // (Set-Add), kein Risiko bei mehrfachem Aufruf.
  try {
    _newsMarkSeen(sid);
    newsBadgeRefresh();
    // Sichtbare Cards (Mini-Popup + Feed) visuell synchron halten.
    // CSS.escape ist seit 2015 in allen relevanten Browsern verfügbar; defensiv
    // mit Fallback auf simples Escape für Edge-Cases.
    const escId = (window.CSS && CSS.escape) ? CSS.escape(sid) : sid.replace(/[\\"']/g, '\\$&');
    document.querySelectorAll('.nv-story[data-sid="'+escId+'"], .nf-card[data-sid="'+escId+'"], .nf-hero[data-sid="'+escId+'"]').forEach(el => {
      el.classList.add('read'); el.classList.remove('important');
      el.querySelector('.nv-story-dot')?.remove();
      el.querySelector('.nf-dot')?.remove();
    });
  } catch(e){}
  // v9: Breaking-Stories im Detail ebenfalls in der Breaking-Optik anzeigen.
  const dcat = _displayCat(s);
  const cat = NEWS_CATEGORIES[dcat] || NEWS_CATEGORIES.fun;
  // Body-HTML dynamisch je Typ — nutzt vorhandene Avatar/Stat-Helper
  const body = _newsDetailBody(s);
  const nd = document.getElementById('nd');
  const bg = document.getElementById('ndBg');
  if(!nd || !bg) return;
  // Das Blatt setzt fort, was die Karte angefangen hat: dieselbe Rubrik,
  // dasselbe Motiv, dieselben fetten Akzente [§C27]. Vorher stand oben der
  // Kategorienname aus der Datenbank („Badge & Awards"), den es auf der
  // Karte seit dem Rubrikband nicht mehr gibt.
  const sorte = _newsSorte(s);
  const brk = _isBreaking(s);
  nd.className = 'nd nd-s-' + sorte + (brk ? ' nd-brk' : '');
  nd.innerHTML = `
    ${_newsMotiv(sorte, s)}
    ${brk ? '<div class="nf-brk-band"><span class="nf-brk-punkt"></span>BREAKING</div>' : ''}
    <div class="nd-head">
      <div class="nd-ic nv-cat-${dcat}">${svgI(s.ic || cat.ic)}</div>
      <div class="nd-title-wrap">
        <div class="nd-cat">${esc(_newsRubrik(sorte, s))}</div>
        <div class="nd-title">${esc(s.title)}</div>
        <div class="nd-when">${svgI('clock')}${esc(_newsWhenLabel(s.when))}</div>
      </div>
      <button class="nd-x" id="ndXBtn" aria-label="Schließen">×</button>
    </div>
    <div class="nd-desc">${_newsBetont(s.desc)}</div>
    ${body}
    <button class="nd-close" id="ndCloseBtn">Schließen</button>`;
  bg.classList.add('show');
  document.getElementById('ndCloseBtn').onclick = closeNewsDetail;
  document.getElementById('ndXBtn').onclick = closeNewsDetail;
  // Match-Refs: bei Klick zum Match-Detail springen
  nd.querySelectorAll('[data-mid]').forEach(el => {
    el.onclick = () => {
      const mid = el.dataset.mid;
      closeNewsDetail();
      closeNewsPopover();
      sheetNav(() => { try { showMatchDetail(mid); } catch(e){} }); // über den News-Feed stapeln
    };
  });
  // Player-Refs: zum Spielerprofil
  nd.querySelectorAll('[data-pid]').forEach(el => {
    el.onclick = () => {
      const pid = el.dataset.pid;
      closeNewsDetail();
      closeNewsPopover();
      sheetNav(() => { try { showPlayer(pid); } catch(e){} }); // über den News-Feed stapeln
    };
  });
  // §13: Titel-Plaketten und der „Ganze Tafel"-Button im Saison-Abschluss
  nd.querySelectorAll('[data-tplayer]').forEach(el => {
    el.onclick = () => {
      const pid = el.dataset.tplayer;
      closeNewsDetail(); closeNewsPopover();
      sheetNav(() => { try { showPlayer(pid); } catch(e){} });
    };
  });
  nd.querySelectorAll('[data-season-table]').forEach(el => {
    el.onclick = () => {
      const sid = el.dataset.seasonTable;
      closeNewsDetail(); closeNewsPopover();
      sheetNav(() => { try { showSeasonTable(sid); } catch(e){} });
    };
  });
  nd.querySelectorAll('[data-recap]').forEach(el => {
    el.onclick = (e) => { e.stopPropagation();
      const t = el.dataset.recap;
      sheetNav(() => (t === 'potd' ? showPotdRecap({force:true}) : showPotwRecap({force:true})));
    };
  });
  nd.querySelectorAll('[data-chron]').forEach(el => {
    el.onclick = () => {
      const cid = el.dataset.chron;
      closeNewsDetail(); closeNewsPopover();
      sheetNav(() => { try { showChronicle(cid); } catch(e){} });
    };
  });
}
function closeNewsDetail(){
  const bg = document.getElementById('ndBg');
  if(bg) bg.classList.remove('show');
}

// Detail-Body-HTML — schaltet nach dataRef.type. Für unbekannte Typen
// wird nur die Description angezeigt (Fallback).
//
// v8.1: massiv erweitert. Helper-Funktionen unten liefern wiederverwendbare
// Bausteine (Match-VS-Block, Elo-Delta, Form-Strip), die in mehreren Cases
// gemeinsam genutzt werden. Vermeidet duplizierte Berechnungen.
// Rang, Zeichen und Prestige unter dem Namen im Blatt. Ein Name allein sagt
// nicht, wer da gerade gefeiert wird — und das Wappen daneben zeigt die Stufe,
// ohne sie zu benennen.
function _newsRangZeile(pid){
  try {
    const career = (getGlobalSim() || {}).careerElo || {};
    const ids = Object.keys(career).filter(id => pmap()[id] && !pmap()[id].hidden);
    ids.sort((a, b) => (career[b] ?? 0) - (career[a] ?? 0));
    const rang = ids.indexOf(pid) + 1;
    const P = (typeof prestigeOf === 'function') ? prestigeOf(pid) : null;
    const teile = [];
    // „Rang 6" stand hier als Text UND daneben als Rangabzeichen — dieselbe
    // Aussage zweimal. Das Abzeichen ist das Bauteil [§C27], die Zeile nennt,
    // was es nicht sagt.
    if(rang > 0) teile.push('Platz ' + rang + ' der Liga');
    if(!_ndZeichenUnten){
      if(P && P.insignie) teile.push(P.insignie.name);
      if(P && P.punkte != null) teile.push(P.punkte + ' Prestige');
    }
    return teile.join(' · ');
  } catch(e){ return ''; }
}

// ── Ein Geruest fuer jedes Blatt ────────────────────────────────────
// Es gibt einunddreissig Story-Typen, und jeder brachte sein eigenes Blatt
// mit: mal eine Namenszeile mit Pfeil, mal ein Wert ohne Einordnung, mal gar
// nichts. Wer zwei Blaetter nacheinander oeffnete, fand nichts an derselben
// Stelle. Kopf und Fuss stehen deshalb jetzt an EINER Stelle, und die Cases
// liefern nur noch die Mitte.
//
// Der Kopf zeigt, um wen es geht: ein Wappen wie ueberall sonst [§C27], den
// Namen und darunter Rang, Zeichen und Prestige. Bei einer Partie steht das
// Ergebnis darueber, bei einem Duo stehen zwei Wappen nebeneinander.
function _newsBlattKopf(s){
  const d = s.dataRef || {};
  const pm = pmap();
  const nm = pid => (pm[pid] && pm[pid].name) || '';
  let ids = [];
  try { ids = (_newsPids(s) || []).filter(id => pm[id]); } catch(e){}
  const erg = d.matchId ? _newsBlattErgebnis(d.matchId) : '';
  if(!ids.length) return erg;
  // Ein Duo hat keinen Rang [§C27] — zwei Wappen, zwei Namen, keine Zeile
  // darunter, die es fuer beide gaebe.
  if(ids.length > 1){
    return erg + `<div class="nd-held nd-held-duo">
      <div class="nd-held-av">${ids.slice(0, 2).map(id => avHtml(pm[id], '', {ins:true, px:44, feuer:0})).join('')}</div>
      <div><div class="nd-held-nm">${esc(ids.slice(0, 2).map(nm).join(' und '))}</div>
      <div class="nd-held-un">${esc(ids.length > 2 ? 'und ' + (ids.length - 2) + ' weitere'
        : (_newsSorte(s) === 'duell' ? 'im direkten Duell' : 'als Duo'))}</div></div></div>`;
  }
  const pid = ids[0];
  // Das Rangabzeichen ist ein Bauteil, das die App schon hat [§C27] — im Blatt
  // stand statt seiner die Zeile „Rang 6", also derselbe Rang als nackter Text.
  let ab = ''; try { ab = rankBadgeHtml(pid) || ''; } catch(e){}
  return erg + `<div class="nd-held" data-pid="${esc(pid)}">
    ${avHtml(pm[pid], '', {ins:true, px:54, feuer:0})}
    <div><div class="nd-held-nm">${esc(nm(pid))}</div>
    <div class="nd-held-un">${ab}<span>${esc(_newsRangZeile(pid))}</span></div></div></div>`;
}

// Das Ergebnis der Partie, aus der die Story stammt. Vorher stand es je nach
// Typ mal als Block, mal gar nicht.
function _newsBlattErgebnis(matchId){
  const m = (matches || []).find(x => x.id === matchId);
  if(!m) return '';
  const pm = pmap();
  const seite = ids => ids.filter(id => pm[id])
    .map(id => `<span class="nd-erg-n">${esc(pm[id].name)}</span>`).join('');
  const aWin = m.winner === 'A';
  const dt = new Date(m.created_at).toLocaleDateString('de-DE',
    {weekday:'long', day:'2-digit', month:'2-digit'});
  const uhr = new Date(m.created_at).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
  return `<div class="nd-erg">
    <div class="nd-erg-z">${esc(dt)} um ${esc(uhr)}</div>
    <div class="nd-erg-r">
      <div class="nd-erg-s${aWin?' w':''}">${seite([m.a1, m.a2])}</div>
      <div class="nd-erg-sc"><b class="${aWin?'w':'v'}">${m.score_a}</b><i>:</i><b class="${aWin?'v':'w'}">${m.score_b}</b></div>
      <div class="nd-erg-s re${aWin?'':' w'}">${seite([m.b1, m.b2])}</div>
    </div></div>`;
}

// Der Fuss: der Weg weiter. Zum Profil, zur Partie — die typ-eigenen Knoepfe
// (Rueckblick, Rekord) stehen in der Mitte und bleiben dort.
function _newsBlattFuss(s){
  const d = s.dataRef || {};
  const pm = pmap();
  let ids = [];
  try { ids = (_newsPids(s) || []).filter(id => pm[id]); } catch(e){}
  const knoepfe = [];
  if(ids.length === 1){
    knoepfe.push(`<button class="btn ghost sm" data-pid="${esc(ids[0])}">Profil von ${esc(pm[ids[0]].name)}</button>`);
  }
  if(!knoepfe.length) return '';
  return `<div class="nd-fuss">${knoepfe.join('')}</div>`;
}

// ── Das Medaillon ────────────────────────────────────────────────────
// Eine Auszeichnung ist das Einzige im Feed, das man sich VERDIENT — und sie
// stand als graue Zeile „Seltenheit: Negative" im Blatt. Jetzt trägt sie
// ihr Zeichen in einem Ring, der die Klasse trägt, darunter die Bedingung
// und die Zahl der Halter [§C34]. Die Klasse färbt den Ring, nicht die
// ganze Fläche [§C25].
function _newsMedaillon(ic, rarity, name, bedingung, badgeId){
  const r = rarity || 'common';
  let halter = '';
  try { halter = _newsBadgeHalterText(badgeId); } catch(e){}
  return `<div class="nd-med nd-med-${esc(r)}">
    <div class="nd-med-r">${svgI(ic || 'medal')}</div>
    <div class="nd-med-t">
      <div class="nd-med-n">${esc(name || '')}</div>
      <div class="nd-med-k">${esc(_newsRarityLabel(r))}</div>
      ${bedingung ? `<div class="nd-med-b">${esc(bedingung)}</div>` : ''}
    </div>
    ${halter ? `<div class="nd-med-h">${esc(halter)}</div>` : ''}
  </div>`;
}

// ── Die Verfolger ────────────────────────────────────────────────────
// Ein Rekord ohne Verfolger ist eine Zahl ohne Maßstab. Die drei Besten
// stehen deshalb im Blatt, der Halter oben und in Gold [§C25]. Gelesen wird
// dieselbe Rangfolge, aus der auch der Rekorde-Reiter zeichnet [§C27].
function _newsVerfolger(rekordId){
  if(!rekordId) return '';
  try {
    const rang = chronicleRang(rekordId);
    if(!Array.isArray(rang) || rang.length < 2) return '';
    const pm = pmap();
    const zeilen = rang.slice(0, 3).map((r, i) => {
      const pid = r.pid || r.id;
      if(!pm[pid]) return '';
      return `<div class="nd-vf-z${i === 0 ? ' hat' : ''}" data-pid="${esc(pid)}">
        <span class="nd-vf-n">${i + 1}</span>
        ${avHtml(pm[pid], '', {ins:true, px:30, feuer:0})}
        <span class="nd-vf-nm">${esc(pm[pid].name)}</span>
        <b>${esc(_chronKurz(r.ev))}</b>
      </div>`;
    }).filter(Boolean).join('');
    return zeilen ? `<div class="nd-section">Wer sonst noch vorne steht</div>
      <div class="nd-vf">${zeilen}</div>` : '';
  } catch(e){ return ''; }
}

// Die Partien eines Tages, an denen ein Spieler beteiligt war. „Kein anderer
// holte mehr Siege" ist eine Behauptung — das Blatt zeigt sie jetzt.
function _newsTagPartien(dayKey, pid){
  if(!dayKey) return [];
  try {
    return matches.filter(m => {
      const t = new Date(m.created_at);
      const k = t.getFullYear() + '-' + String(t.getMonth()+1).padStart(2,'0')
              + '-' + String(t.getDate()).padStart(2,'0');
      if(k !== dayKey) return false;
      return !pid || [m.a1, m.a2, m.b1, m.b2].indexOf(pid) >= 0;
    });
  } catch(e){ return []; }
}

// ── Das Insignium im Blatt ───────────────────────────────────────────
// Die Karte „Stefan trägt den Schildring" öffnete ein Blatt mit NULL Zeichen
// Inhalt: kein Zeichen, keine Leiter, keine Punkte. Ausgerechnet die Story,
// die von der Stufe handelt, zeigte sie nicht. Hier steht sie jetzt groß —
// dieselbe Zeichnung wie in der Laufbahn [§C27], daneben, wie weit es zur
// nächsten ist, und darunter die Leiter aus der Karte.
function _newsInsigniumBlock(pid, stufeIdx){
  try {
    const P = prestigeOf(pid);
    if(!P) return '';
    const stufe = (stufeIdx != null && INSIGNIEN[stufeIdx]) ? stufeIdx : (P.stufe || 0);
    const ins = INSIGNIEN[stufe] || INSIGNIEN[0];
    const rangLabel = (getPlayerRank(pid) || {}).label;
    let zeichen = '';
    try { zeichen = insigniumStufeSvg(ins.key, rangLabel, P.zacken, P.grad) || ''; } catch(e){}
    const n = P.naechste;
    // Der Anteil misst die STUFE, nicht die Laufbahn: „62 % geschafft" heißt,
    // wie weit es von dieser Schwelle zur nächsten ist.
    const anteil = n ? Math.max(0, Math.min(100,
      Math.round((P.punkte - ins.min) / Math.max(1, n.min - ins.min) * 100))) : 100;
    return `<div class="nd-ins">
      <div class="nd-ins-z">${zeichen}</div>
      <div class="nd-ins-t">
        <div class="nd-ins-n">${esc(ins.name)}</div>
        <div class="nd-ins-p"><b>${P.punkte}</b> Prestige${P.platz ? ` · Platz ${P.platz} von ${P.von}` : ''}</div>
        ${n ? `<div class="nd-ins-b"><i style="width:${anteil}%"></i></div>
          <div class="nd-ins-r">Noch <b>${P.fehlt}</b> bis zum ${esc(n.name)} · ${anteil} %</div>`
            : `<div class="nd-ins-r">Die letzte Stufe. Der Stern zählt weiter: noch
               <b>${P.naechsteZacke}</b> bis zur nächsten Zacke.</div>`}
      </div>
    </div>${_newsLeiter(pid)}`;
  } catch(e){ return ''; }
}

// Welche Partie steht schon im Kopf? Die Mitte darf sie dann nicht noch
// einmal zeigen: das Blatt trug dieselbe Begegnung zweimal untereinander,
// oben als Ergebnis und darunter als Match-Block.
let _ndKopfMatch = null;
// Steht das Insignium schon als Block in der Mitte? Dann nennt der Kopf es
// nicht noch einmal als Text.
let _ndZeichenUnten = false;

// Kopf, Mitte, Fuss. Die Mitte ist typ-eigen, Kopf und Fuss sind es nie.
function _newsDetailBody(s){
  const d = s.dataRef || {};
  // Die Mitte wird ZUERST gebaut. Nur so weiss der Kopf, ob das Zeichen schon
  // unten steht: sonst nannte er „Reif · 168 Prestige" und der Block darunter
  // sagte dasselbe noch einmal, mit Bild.
  _ndKopfMatch = d.matchId || null;
  let mitte = '';
  try { mitte = _newsDetailMitte(s) || ''; } catch(e){ mitte = ''; }
  _ndKopfMatch = null;
  _ndZeichenUnten = mitte.indexOf('nd-ins') >= 0;
  const kopf = _newsBlattKopf(s);
  _ndZeichenUnten = false;
  return kopf + mitte + _newsBlattFuss(s);
}

function _newsDetailMitte(s){
  const d = s.dataRef || {};
  const pm = pmap();
  const avM = (pid) => (typeof avHtml === 'function' && pm[pid]) ? avHtml(pm[pid]) : '';
  const nameOf = (pid) => (pm[pid] && pm[pid].name) || '?';
  // §13.4b: Chronik-Karten haben keinen eigenen `type` — sie hängen an jeder
  // Story, die eine Chronik nennt, und öffnen deren Liga-Ansicht.
  if(d.chronicle && CHRONICLE_BY_ID[d.chronicle]){
    const def = CHRONICLE_BY_ID[d.chronicle];
    const row = d.ambientPid ? `<div class="nd-stat-row" data-pid="${esc(d.ambientPid)}" style="cursor:pointer">
      <div class="nd-stat-label">Rekordhalter</div><div class="nd-stat-val gold">${esc(nameOf(d.ambientPid))} ›</div></div>` : '';
    return `<div class="nd-section">Liga-Rekord · ${esc(CHRON_KINDS[def.kind].label)}</div>${row}
      <div class="nd-stat-row"><div class="nd-stat-label">Bedingung</div>
        <div class="nd-stat-val">${esc(def.cond)}</div></div>
      <button class="btn ghost sm" data-chron="${esc(def.id)}" style="margin-top:12px;width:100%">Rekord öffnen</button>`;
  }
  try {
    switch(d.type){
      // ── Die Ewige Tafel ─────────────────────────────────────────
      // Der ganze Awards-Reiter hatte im Blatt gar keinen Fall: wer eine
      // Rekord-Karte oeffnete, sah den Kopf und den Satz, den er auf der
      // Karte schon gelesen hatte. Jetzt steht dort der Wert gross, die
      // Bedingung, wem er vorher gehoerte und wer dahinter liegt.
      case 'rekord_geholt': {
        const def = (typeof CHRONICLE_BY_ID !== 'undefined') ? CHRONICLE_BY_ID[d.rekordId] : null;
        const wert = _chronKurz(d.ev);
        const vor = (Array.isArray(d.vorher) ? d.vorher : []).filter(pid => pm[pid]);
        // Der Beleg steht schon im Satz ueber dem Blatt — er stand hier ein
        // zweites Mal, Wort fuer Wort.
        return `<div class="nd-gwert ${d.zufall ? 'metall' : 'gold'}">
            <b>${esc(wert)}</b><span>${esc(d.kammerLabel || 'Bestmarke')}</span></div>
          ${d.cond ? `<div class="nd-stat-row"><div class="nd-stat-label">Bedingung</div>
            <div class="nd-stat-val" style="font-size:11px;text-align:right;max-width:62%">${esc(d.cond)}</div></div>` : ''}
          ${vor.length ? `<div class="nd-stat-row" data-pid="${esc(vor[0])}" style="cursor:pointer">
            <div class="nd-stat-label">Vorher gehalten von</div>
            <div class="nd-stat-val">${esc(vor.map(nameOf).join(' und '))} ›</div></div>` : ''}
          ${_newsVerfolger(d.rekordId)}
          ${def ? `<button class="btn ghost sm" data-chron="${esc(def.id)}" style="margin-top:12px;width:100%">Rekord öffnen</button>` : ''}`;
      }
      // Die Monatschronik ist EINE Karte je Monat [§C33]. Im Blatt stehen
      // deshalb die Traeger, nicht ein einzelner Eintrag.
      case 'chronik_monat': {
        const ids = (Array.isArray(d.playerIds) ? d.playerIds : []).filter(pid => pm[pid]);
        // Neben dem Namen steht die Wertung, die er in diesem Monat haelt —
        // eine leere Spalte sagte gar nichts.
        const titelVon = pid => { try { const t = seasonTitleOf(pid, d.sid);
          return t && t.name ? t.name : ''; } catch(e){ return ''; } };
        return `<div class="nd-gwert gold"><b>${esc(String(d.eintraege != null ? d.eintraege : ids.length))}</b>
            <span>Einträge im ${esc(seasonLabel(d.sid) || '')}</span></div>
          ${ids.length ? `<div class="nd-section">Wer eingetragen ist</div>
          <div class="nd-vf">${ids.slice(0, 5).map(pid => `<div class="nd-vf-z" data-pid="${esc(pid)}">
            ${avHtml(pm[pid], '', {ins:true, px:30, feuer:0})}
            <span class="nd-vf-nm">${esc(nameOf(pid))}</span>
            <b class="nd-vf-t">${esc(titelVon(pid))}</b></div>`).join('')}</div>` : ''}
          <button class="btn ghost sm" data-season-table="${esc(d.sid)}" style="margin-top:12px;width:100%">Ganze Tafel öffnen</button>`;
      }
      // Der erste Eintrag ueberhaupt — der Moment, den ein Spieler aus der
      // unteren Haelfte sonst nie im Feed sieht [§C33]. Er verdient mehr als
      // eine Zeile.
      case 'chronik_erstling': {
        // Der Beleg stand nur im Satz oben. Hier gehoert er hin: was war die
        // Bedingung, und mit welcher Zahl hat er sie erfuellt.
        let t = null; try { t = seasonTitleOf(d.pid, d.sid); } catch(e){}
        const def = (t && typeof SEASON_TITLE_BY_ID !== 'undefined') ? SEASON_TITLE_BY_ID[t.id] : null;
        return `<div class="nd-gwert gold"><b>1.</b><span>Eintrag in der Chronik</span></div>
          <div class="nd-med nd-med-erst">
            <div class="nd-med-r">${svgI((t && t.ic) || (def && def.ic) || 'scroll')}</div>
            <div class="nd-med-t">
              <div class="nd-med-n">${esc((t && t.name) || d.titel || '')}</div>
              <div class="nd-med-k">${esc(seasonLabel(d.sid) || '')}</div>
              ${def && def.cond ? `<div class="nd-med-b">${esc(def.cond)}</div>` : ''}
            </div>
            ${t && t.ev ? `<div class="nd-med-h">${_newsBetont(t.ev)}</div>` : ''}
          </div>
          <button class="btn ghost sm" data-season-table="${esc(d.sid)}" style="margin-top:12px;width:100%">Ganze Tafel öffnen</button>`;
      }
      case 'top_clash': {
        // v9.3: Ränge explizit — Platz 1 (Sieger) & Platz 2 (Verfolger),
        // beide antippbar; darunter das Spitzenspiel als Match-VS-Block.
        const rankRows = (d.p1 && d.p2) ? `
          <div class="nd-stat-row" data-pid="${esc(d.p1)}" style="cursor:pointer"><div class="nd-stat-label">Platz 1</div><div class="nd-stat-val acid">${esc(nameOf(d.p1))} ›</div></div>
          <div class="nd-stat-row" data-pid="${esc(d.p2)}" style="cursor:pointer"><div class="nd-stat-label">Platz 2</div><div class="nd-stat-val">${esc(nameOf(d.p2))} ›</div></div>` : '';
        const matchHtml = d.matchId ? _newsMatchVsBlock(d.matchId) : '';
        return (rankRows ? `<div class="nd-section">Duell an der Spitze</div>${rankRows}` : '')
             + (matchHtml ? `<div class="nd-section">Das Spitzenspiel</div>${matchHtml}` : '');
      }
      case 'elo_record': {
        // v9.4: Rekordhalter (antippbar) + Rekordwert + auslösendes Match.
        const row = d.pid ? `<div class="nd-stat-row" data-pid="${esc(d.pid)}" style="cursor:pointer"><div class="nd-stat-label">Rekordhalter</div><div class="nd-stat-val acid">${esc(nameOf(d.pid))} ›</div></div>` : '';
        const eloRow = d.elo!=null ? `<div class="nd-stat-row"><div class="nd-stat-label">Höchststand</div><div class="nd-stat-val acid">${d.elo} Elo</div></div>` : '';
        const matchHtml = d.matchId ? _newsMatchVsBlock(d.matchId) : '';
        return `<div class="nd-section">Liga-Rekord</div>${row}${eloRow}` + (matchHtml ? `<div class="nd-section">Rekord-Match</div>${matchHtml}` : '');
      }
      case 'streak_record': {
        const row = d.pid ? `<div class="nd-stat-row" data-pid="${esc(d.pid)}" style="cursor:pointer"><div class="nd-stat-label">Rekordhalter</div><div class="nd-stat-val acid">${esc(nameOf(d.pid))} ›</div></div>` : '';
        const sRow = d.streak!=null ? `<div class="nd-stat-row"><div class="nd-stat-label">Siege in Folge</div><div class="nd-stat-val acid">${d.streak}</div></div>` : '';
        return `<div class="nd-section">Liga-Rekord</div>${row}${sRow}`;
      }
      case 'giant_slayer': {
        const pct = d.chance!=null ? `<div class="nd-stat-row"><div class="nd-stat-label">Siegchance</div><div class="nd-stat-val red">${Math.max(1,Math.round(d.chance*100))}%</div></div>` : '';
        const matchHtml = d.matchId ? _newsMatchVsBlock(d.matchId) : '';
        return `<div class="nd-section">Die Sensation</div>${pct}` + (matchHtml ? matchHtml : '');
      }
      case 'group': {
        // v8.8: zusammengefasste Karte ("N Pechvögel: …") — alle Beteiligten
        // tappbar, mit ihrem jeweiligen Wert (frag).
        const pids = Array.isArray(d.playerIds) ? d.playerIds : [];
        const frags = Array.isArray(d.frags) ? d.frags : [];
        const rows = pids.map((pid, i) => {
          const m = (frags[i] || '').match(/\(([^)]*)\)/);
          const val = m ? m[1] : '›';
          return `<div class="nd-stat-row" data-pid="${esc(pid)}" style="cursor:pointer">
            <div class="nd-stat-label">${esc(nameOf(pid))}</div><div class="nd-stat-val">${esc(val)}</div></div>`;
        }).join('');
        return `<div class="nd-section">Beteiligte</div>${rows}`;
      }
      case 'potd': {
        // Der Held gross, darunter sein Rang und sein Zeichen, dann ein Satz
        // mit der Bedingung und erst danach die Zahlen. Vorher stand hier eine
        // Zeile mit dem Namen und ein Pfeil: „4 Siege · 57%" ohne die Angabe,
        // ab wie vielen Partien gewertet wird, liest sich wie eine
        // Karriere-Siegquote.
        const pids = (Array.isArray(d.playerIds) && d.playerIds.length) ? d.playerIds : [d.playerId];
        const wr = d.wr != null ? Math.round(d.wr * 100) : null;
        const nl = (d.wins != null && d.games != null) ? (d.games - d.wins) : null;
        const satz = `<div class="nd-satz">${d.type === 'potw'
            ? 'Gewertet wird die Siegquote der Woche ab fünf Partien.'
            : 'Gewertet wird der Spieltag ab drei Partien. Die Karte kommt um 23:59, wenn keine Partie mehr dazukommen kann.'}</div>`;
        const gitter = `<div class="nd-gitter">
            ${wr != null ? `<div><b class="g">${wr} %</b><span>Siegquote</span></div>` : ''}
            ${d.wins != null ? `<div><b>${d.wins}${nl != null ? ' : ' + nl : ''}</b><span>Siege${nl != null ? ' zu Niederlagen' : ''}</span></div>` : ''}
          </div>`;
        const weitere = pids.length > 1
          ? `<div class="nd-section">Punktgleich</div>` + pids.slice(1).map(pid =>
              `<div class="nd-stat-row" data-pid="${esc(pid)}" style="cursor:pointer">
                <div class="nd-stat-label">${esc(nameOf(pid))}</div><div class="nd-stat-val">›</div></div>`).join('')
          : '';
        // Der volle Rueckblick ist gebaut (`showPotwRecap`/`showPotdRecap`) und
        // oeffnet sich am richtigen Tag von selbst — vom Feed aus war er
        // bisher nicht erreichbar. Wer die Karte drei Tage spaeter liest,
        // kam an die Auswertung nicht mehr heran.
        const knopf = `<button class="btn ghost sm" data-recap="${d.type}"
            style="margin-top:12px;width:100%">Rückblick öffnen</button>`;
        // Die Partien des Tages. „Kein anderer holte mehr Siege" ist eine
        // Behauptung, und das Blatt zeigte sie nicht — jetzt steht darunter,
        // welche Spiele es waren.
        const tag = _newsTagPartien(d.dayKey, pids[0]);
        const spiele = tag.length
          ? `<div class="nd-section">Die Partien an diesem Tag</div>`
            + tag.slice(0, 4).map(m => _newsMatchVsBlock(m.id)).join('')
          : '';
        return satz + gitter + weitere + spiele + knopf;
      }
      // ── Die Woche: sechs Wertungen in einem Blatt ────────────────────
      // Der Wochenrueckblick stand vorher als sechs Karten ueber den Montag
      // verteilt. Jetzt ist er eine Karte, und das Blatt traegt jede Wertung
      // als eigene Zeile mit Gesicht und Zahl — nichts geht verloren, aber der
      // Feed traegt statt sechs Karten eine.
      case 'woche': {
        const teile = Array.isArray(d.teile) ? d.teile : [];
        const kopf = `<div class="nd-stat-row">
            <div class="nd-stat-label">Partien in dieser Woche</div>
            <div class="nd-stat-val acid">${d.spiele || 0} an ${d.tage || 0} ${d.tage === 1 ? 'Tag' : 'Tagen'}</div></div>`;
        const zeilen = teile.map(t => {
          const ids = Array.isArray(t.pids) ? t.pids : [];
          const chips = ids.slice(0, 2).map(pid =>
            `<span class="nw-chip" data-pid="${esc(pid)}">${esc(nameOf(pid))}</span>`).join('');
          return `<div class="nw-zeile">
              <div class="nw-zeile-kopf">
                <span class="nw-label">${esc(t.label || '')}</span>
                <span class="nw-wert">${esc(t.wert || '')}</span>
              </div>
              <div class="nw-satz">${esc(t.satz || '')}</div>
              <div class="nw-chips">${chips}</div>
            </div>`;
        }).join('');
        return `<div class="nd-section">Die Woche</div>${kopf}
          <div class="nw-liste">${zeilen}</div>
          <button class="btn ghost sm" data-recap="potw" style="margin-top:12px;width:100%">Wochen-Rückblick öffnen</button>`;
      }
      // ── Die Sammelkarte: was im selben Moment passiert ist ───────────
      // Der Kopf gehoert dem groessten Ereignis. Was dazugehoert, steht
      // darunter als Liste mit eigenem Beleg, nicht als zweite Schlagzeile.
      case 'sammel': {
        const teile = Array.isArray(d.teile) ? d.teile : [];
        const zeilen = teile.map((t, i) => `<div class="nw-zeile${i === 0 ? ' nw-zeile-kopf-teil' : ''}">
              <div class="nw-zeile-kopf"><span class="nw-label">${esc(t.titel || '')}</span></div>
              <div class="nw-satz">${esc(t.text || '')}</div>
            </div>`).join('');
        const mv = d.matchId ? _newsMatchVsBlock(d.matchId) : '';
        return `<div class="nd-section">${d.quelle === 'tafel' ? 'An der Ewigen Tafel' : 'In dieser Partie'}</div>
          ${mv}<div class="nw-liste">${zeilen}</div>`;
      }
      // Die Stufe IST die Story — und das Blatt war leer.
      case 'insignium_stufe': {
        return `<div class="nd-section">Die neue Stufe</div>`
          + _newsInsigniumBlock(d.pid, d.stufe)
          + (d.oben ? `<div class="nd-satz">Die beiden obersten Stufen erreicht kaum jemand
              — deshalb ist diese Karte Breaking [§C30].</div>` : '');
      }
      case 'ambient': {
        // Vorher stand hier „Im Fokus: Stefan" — ein Wappen mit dem Namen, den
        // der Kopf zwei Zeilen darüber schon zeigt, und sonst NICHTS. Wer eine
        // Prestige-Karte öffnete, sah kein Zeichen, keine Leiter, keine Zahl.
        // Jetzt trägt jede ambiente Karte ihren Wert groß, und wo es ums
        // Prestige geht, steht die Leiter dabei — sie IST die Aussage.
        const wertBlock = (d.vv != null && d.vv !== '')
          ? `<div class="nd-gwert ${d.prestige ? 'gold' : ''}"><b>${esc(String(d.vv))}</b>`
            + `<span>${esc(d.vl || '')}</span></div>` : '';
        if(d.ambientPid && pm[d.ambientPid]){
          return wertBlock
            + (d.prestige ? `<div class="nd-section">Der Stand am Zeichen</div>`
                            + _newsInsigniumBlock(d.ambientPid) : '')
            + (!wertBlock && !d.prestige ? `<div class="nd-section">Im Fokus</div>
              <div class="nd-vs"><div class="nd-vs-p" data-pid="${esc(d.ambientPid)}">
                ${avM(d.ambientPid)}<div class="nd-vs-name">${esc(nameOf(d.ambientPid))}</div>
              </div></div>` : '');
        }
        if(wertBlock && !(Array.isArray(d.ambientPids) && d.ambientPids.length === 2)) return wertBlock;
        if(Array.isArray(d.ambientPids) && d.ambientPids.length === 2 && pm[d.ambientPids[0]] && pm[d.ambientPids[1]]){
          const [pa, pb] = d.ambientPids;
          // v9.17: Paare sind nicht automatisch Gegner. Team-Stories (z.B. die
          // gemeinsame Siegesserie eines Duos) wurden bisher als „Duell … vs …"
          // gerendert, obwohl die beiden ZUSAMMEN spielen. pairKind kommt aus dem
          // Template; für bereits persistierte Rows ohne Feld entscheidet die
          // Kategorie ('team' → Team, sonst Duell).
          const isTeam = d.pairKind === 'team' || (!d.pairKind && s.cat === 'team');
          return `<div class="nd-section">${isTeam ? 'Das Duo' : 'Duell'}</div>
            <div class="nd-vs">
              <div class="nd-vs-p" data-pid="${esc(pa)}">${avM(pa)}<div class="nd-vs-name">${esc(nameOf(pa))}</div></div>
              <div class="nd-vs-mid">${isTeam ? '&amp;' : 'vs'}</div>
              <div class="nd-vs-p" data-pid="${esc(pb)}">${avM(pb)}<div class="nd-vs-name">${esc(nameOf(pb))}</div></div>
            </div>`;
        }
        return '';
      }
      case 'season_endgame': {
        const pA = d.leader, pB = d.second;
        return `<div class="nd-section">Top-2 Stand</div>
          <div class="nd-vs">
            <div class="nd-vs-p" data-pid="${esc(pA.pid)}">
              ${avM(pA.pid)}
              <div class="nd-vs-name">${esc(nameOf(pA.pid))}</div>
              <div class="nd-vs-elo">${pA.elo} Elo</div>
            </div>
            <div class="nd-vs-mid">${d.gap}<div class="nd-vs-mid-sub">Elo Diff</div></div>
            <div class="nd-vs-p" data-pid="${esc(pB.pid)}">
              ${avM(pB.pid)}
              <div class="nd-vs-name">${esc(nameOf(pB.pid))}</div>
              <div class="nd-vs-elo">${pB.elo} Elo</div>
            </div>
          </div>
          <div class="nd-stat-row"><div class="nd-stat-label">Verbleibend</div><div class="nd-stat-val acid">${d.daysLeft} ${d.daysLeft===1?'Tag':'Tage'}</div></div>`;
      }
      case 'lead_change': {
        const matchHtml = d.matchId ? _newsMatchVsBlock(d.matchId) : '';
        const eloChg = d.matchId ? _newsEloDelta(d.newLeader, d.matchId) : null;
        const rankInfo = d.matchId ? _newsRankChange(d.newLeader, d.matchId) : null;
        return `<div class="nd-section">Wechsel an der Spitze</div>
          <div class="nd-vs">
            <div class="nd-vs-p" data-pid="${esc(d.newLeader)}">
              ${avM(d.newLeader)}
              <div class="nd-vs-name">${esc(nameOf(d.newLeader))}</div>
              <div class="nd-vs-elo" style="color:var(--acid)">neuer #1</div>
            </div>
            <div class="nd-vs-mid">↑<div class="nd-vs-mid-sub">übernimmt</div></div>
            <div class="nd-vs-p" data-pid="${esc(d.prevLeader)}">
              ${avM(d.prevLeader)}
              <div class="nd-vs-name">${esc(nameOf(d.prevLeader))}</div>
              <div class="nd-vs-elo">vorher #1</div>
            </div>
          </div>
          ${eloChg !== null ? `<div class="nd-stat-row">
            <div class="nd-stat-label">Elo-Veränderung</div>
            <div class="nd-stat-val ${eloChg>=0?'pos':'neg'}">${eloChg>=0?'+':''}${eloChg}</div>
          </div>` : ''}
          ${rankInfo ? `<div class="nd-stat-row">
            <div class="nd-stat-label">Tabelle</div>
            <div class="nd-stat-val acid">#${rankInfo.pre} → #${rankInfo.post}</div>
          </div>` : ''}
          ${matchHtml ? `<div class="nd-section">Auslösendes Match</div>${matchHtml}` : ''}`;
      }
      case 'top_form': {
        const form = _newsRecentForm(d.pid, 10);
        return `<div class="nd-section">Letzte 10 Matches</div>
          ${form.strip ? `<div class="nd-form-strip">${form.strip}</div>` : ''}
          <div class="nd-stat-row" data-pid="${esc(d.pid)}" style="cursor:pointer">
            <div class="nd-stat-label">${esc(nameOf(d.pid))}</div>
            <div class="nd-stat-val acid">${d.wins}/10 Siege</div></div>
          ${form.currentStreak >= 2 ? `<div class="nd-stat-row">
            <div class="nd-stat-label">Aktuelle Serie</div>
            <div class="nd-stat-val acid">${form.currentStreak}× Sieg</div></div>` : ''}`;
      }
      case 'loss_streak': {
        const form = _newsRecentForm(d.pid, 10);
        return `<div class="nd-section">Die Serie</div>
          ${_newsSerienBand(d.streak, true)}
          <div class="nd-section">Letzte 10 Matches</div>
          ${form.strip ? `<div class="nd-form-strip">${form.strip}</div>` : ''}
          <div class="nd-stat-row" data-pid="${esc(d.pid)}" style="cursor:pointer">
            <div class="nd-stat-label">${esc(nameOf(d.pid))}</div>
            <div class="nd-stat-val neg">${d.streak}× Niederlage in Folge</div></div>`;
      }
      case 'badge_unlocked': {
        // v8.6: bei konsolidierten Karten (mehrere Spieler, gleicher Badge im
        // selben Match) alle Beteiligten listen; sonst der einzelne Spieler.
        const pids = (Array.isArray(d.playerIds) && d.playerIds.length) ? d.playerIds : [d.playerId];
        const matchHtml = d.matchId ? _newsMatchVsBlock(d.matchId) : '';
        const eloChg = (pids.length === 1 && d.matchId) ? _newsEloDelta(pids[0], d.matchId) : null;
        // Das Blatt einer Auszeichnung soll belohnen. Vorher stand dort eine
        // Zeile „Spieler: Leo ›" — obwohl der Kopf schon Leo zeigte —, darunter
        // „Seltenheit: Negative" in Englisch. Jetzt traegt es das Medaillon,
        // die Klasse und die Zahl der Halter: „einer von zwoelf" ist das, was
        // eine Auszeichnung wert macht [§C34].
        const bdef = (typeof BADGES !== 'undefined')
          ? BADGES.find(b => b.id === d.badgeId) : null;
        const medaille = _newsMedaillon(s.ic || (bdef && bdef.ic) || 'medal', d.rarity,
          d.badgeName || (bdef && bdef.name) || '', bdef ? bdef.desc : '', d.badgeId);
        // Mehrere Spieler nur dann als Liste — bei einem steht er im Kopf.
        const playersHtml = pids.length > 1
          ? `<div class="nd-section">${pids.length} Spieler</div>` + pids.map(pid =>
              `<div class="nd-stat-row" data-pid="${esc(pid)}" style="cursor:pointer">
                <div class="nd-stat-label">${esc(nameOf(pid))}</div><div class="nd-stat-val">›</div></div>`).join('')
          : '';
        const nemRow = d.nemesisOppId ? `<div class="nd-stat-row" data-pid="${esc(d.nemesisOppId)}" style="cursor:pointer">
            <div class="nd-stat-label">Gegen wen</div>
            <div class="nd-stat-val neg">${esc(nameOf(d.nemesisOppId))} ›</div></div>` : '';
        return medaille + playersHtml + nemRow
          + (eloChg !== null ? `<div class="nd-stat-row">
            <div class="nd-stat-label">Match-Elo</div>
            <div class="nd-stat-val ${eloChg>=0?'pos':'neg'}">${eloChg>=0?'+':''}${eloChg}</div></div>` : '')
          + (matchHtml ? `<div class="nd-section">Auslösendes Match</div>${matchHtml}` : '');
      }
      case 'rivalry': {
        // Live-Bilanz aus matches berechnen — günstig, da rivalry-Stories selten sind.
        const h2h = _newsH2HRecord(d.a, d.b);
        return `<div class="nd-section">Die Kontrahenten</div>
          <div class="nd-vs">
            <div class="nd-vs-p" data-pid="${esc(d.a)}">
              ${avM(d.a)}
              <div class="nd-vs-name">${esc(nameOf(d.a))}</div>
              <div class="nd-vs-elo">${esc(_newsRangKurz(d.a) || '')}</div>
            </div>
            <div class="nd-vs-mid">VS<div class="nd-vs-mid-sub">${d.n} Duelle</div></div>
            <div class="nd-vs-p" data-pid="${esc(d.b)}">
              ${avM(d.b)}
              <div class="nd-vs-name">${esc(nameOf(d.b))}</div>
              <div class="nd-vs-elo">${esc(_newsRangKurz(d.b) || '')}</div>
            </div>
          </div>
          ${_newsBilanzBalken(d.a, d.b, h2h.aWins, h2h.bWins)}
          ${h2h.lastMatchId ? `<div class="nd-section">Letztes Duell</div>${_newsMatchVsBlock(h2h.lastMatchId)}` : ''}`;
      }
      // Zwei, die zusammen spielen, hatten im Blatt gar keinen Fall: das
      // Duo-Blatt zeigte den Kopf und den Satz von der Karte. Jetzt steht die
      // Serie als Lauf da und darunter, wie oft die beiden ueberhaupt
      // zusammen gespielt haben.
      case 'team_streak':
      case 'team_loss_streak': {
        const verloren = d.type === 'team_loss_streak';
        let tw = null;
        try { tw = teamStatsFromMatches(matches).find(t =>
          (t.ids || []).includes(d.a) && (t.ids || []).includes(d.b)); } catch(e){}
        // Die Zahl der Partien steht schon als Lauf darueber — sie stand hier
        // ein zweites Mal als Ziffer.
        let letzte = null;
        try { letzte = [...matches].reverse().find(m =>
          [m.a1, m.a2].every(x => x === d.a || x === d.b) ||
          [m.b1, m.b2].every(x => x === d.a || x === d.b)); } catch(e){}
        return `<div class="nd-section">${verloren ? 'Die Durststrecke' : 'Die Serie'}</div>
          ${_newsSerienBand(d.streak, verloren)}
          ${tw ? `<div class="nd-stat-row"><div class="nd-stat-label">Gemeinsame Bilanz</div>
            <div class="nd-stat-val">${tw.w}:${tw.g - tw.w}</div></div>
          <div class="nd-stat-row"><div class="nd-stat-label">Siegquote als Duo</div>
            <div class="nd-stat-val ${tw.w * 2 >= tw.g ? 'acid' : 'neg'}">${Math.round(tw.w / tw.g * 100)} %</div></div>
          <div class="nd-stat-row"><div class="nd-stat-label">Tore</div>
            <div class="nd-stat-val">${tw.gf}:${tw.ga}</div></div>` : ''}
          ${letzte && letzte.id !== _ndKopfMatch
            ? `<div class="nd-section">Die letzte gemeinsame Partie</div>${_newsMatchVsBlock(letzte.id)}` : ''}`;
      }
      case 'jubilee': {
        // Karriere-Bilanz nutzen statt nur Total — bestehende Stats-Funktion.
        const stats = _newsPlayerCareer(d.pid);
        return `<div class="nd-section">Karriere</div>
          <div class="nd-stat-row" data-pid="${esc(d.pid)}" style="cursor:pointer">
            <div class="nd-stat-label">${esc(nameOf(d.pid))}</div>
            <div class="nd-stat-val gold">${d.total} Spiele</div></div>
          ${stats ? `<div class="nd-stat-row">
            <div class="nd-stat-label">Siege / Niederlagen</div>
            <div class="nd-stat-val">${stats.wins} / ${stats.losses}</div></div>
          <div class="nd-stat-row">
            <div class="nd-stat-label">Win-Rate</div>
            <div class="nd-stat-val acid">${stats.winRate}%</div></div>` : ''}
          ${d.matchId ? `<div class="nd-section">Jubiläums-Match</div>${_newsMatchVsBlock(d.matchId)}` : ''}`;
      }
      case 'quiet_week': {
        return `<div class="nd-section">Aktivität</div>
          <div class="nd-stat-row"><div class="nd-stat-label">Letzte 7 Tage</div><div class="nd-stat-val">${d.lastWeek} Spiele</div></div>
          <div class="nd-stat-row"><div class="nd-stat-label">4-Wochen-Schnitt</div><div class="nd-stat-val">${d.avg} Spiele</div></div>`;
      }
      case 'season_recap': {
        // Top-3 Aufstellung statt nur Champion
        const top = (d.topElo || []).slice(0,3);
        const rows = top.map((p, i) => p && p.id && pm[p.id] ? `
          <div class="nd-stat-row" data-pid="${esc(p.id)}" style="cursor:pointer">
            <div class="nd-stat-label">${i+1}. ${esc(nameOf(p.id))}</div>
            <div class="nd-stat-val ${i===0?'gold':i===1?'':''}">${p.elo} Elo</div></div>` : '').join('');
        // v9.18: Die komplette Saison-Tafel (§13) hängt an dieser einen Karte.
        // Ältere persistierte Rows haben kein `tafel` → Abschnitt entfällt.
        const tf = d.tafel;
        const tafelHtml = (tf && Array.isArray(tf.list) && tf.list.length)
          ? `<div class="nd-section">Die Chronik der Saison</div>
             <div class="tplates">${tf.list.map(x => _titlePlateHtml(
                 {name:x.n, ic:x.ic, tone:x.tone, pid:x.pid, ev:x.ev})).join('')}</div>
             ${tf.empty ? `<div class="nd-stat-row"><div class="nd-stat-label">Ohne Eintrag</div>
               <div class="nd-stat-val">${tf.empty} Spieler</div></div>` : ''}
             <button class="btn ghost sm" data-season-table="${esc(d.sid)}" style="margin-top:12px;width:100%">Ganze Chronik öffnen</button>`
          : '';
        return `<div class="nd-section">Saison-Top-3</div>
          ${rows}
          <div class="nd-stat-row"><div class="nd-stat-label">Saison</div><div class="nd-stat-val">${esc(d.sid)}</div></div>
          ${tafelHtml}`;
      }
      case 'season_start': {
        return `<div class="nd-section">Aktuelle Saison</div>
          <div class="nd-stat-row"><div class="nd-stat-label">Saison-ID</div><div class="nd-stat-val">${esc(d.sid)}</div></div>`;
      }
      // Neue Typen (Phase 8) hängen sich hier dran an
      case 'milestone_wins':
      case 'milestone_goals':
      case 'milestone_elo': {
        const stats = _newsPlayerCareer(d.pid);
        return `<div class="nd-section">Meilenstein</div>
          <div class="nd-stat-row" data-pid="${esc(d.pid)}" style="cursor:pointer">
            <div class="nd-stat-label">${esc(nameOf(d.pid))}</div>
            <div class="nd-stat-val gold">${esc(d.milestone)}</div></div>
          ${stats ? `<div class="nd-stat-row">
            <div class="nd-stat-label">Karriere-Bilanz</div>
            <div class="nd-stat-val">${stats.wins}W · ${stats.losses}L</div></div>` : ''}
          ${d.matchId ? `<div class="nd-section">Meilenstein-Match</div>${_newsMatchVsBlock(d.matchId)}` : ''}`;
      }
      case 'elo_swing': {
        // Vorher stand hier der Name — den der Kopf zwei Zeilen darueber schon
        // zeigt — und die Zahl, die auf der Karte stand. Jetzt traegt das Blatt
        // den Ausschlag gross und daneben, woher er kommt.
        const form = _newsRecentForm(d.pid, 10);
        let elo = null;
        try { elo = Math.round(((getGlobalSim() || {}).careerElo || {})[d.pid]); } catch(e){}
        return `<div class="nd-gwert ${d.delta >= 0 ? '' : 'rot'}">
            <b>${d.delta >= 0 ? '+' : ''}${d.delta}</b><span>Elo ${esc(d.period || '')}</span></div>
          ${form.strip ? `<div class="nd-section">Die letzten Partien</div>
            <div class="nd-form-strip">${form.strip}</div>` : ''}
          ${elo ? `<div class="nd-stat-row"><div class="nd-stat-label">Stand jetzt</div>
            <div class="nd-stat-val">${elo} Elo</div></div>` : ''}
          ${form.currentStreak >= 2 ? `<div class="nd-stat-row">
            <div class="nd-stat-label">Aktuelle Serie</div>
            <div class="nd-stat-val ${d.delta >= 0 ? 'acid' : 'neg'}">${form.currentStreak}×</div></div>` : ''}`;
      }
      // ── v8.2 Neue Typen ──
      case 'streak_killer': {
        // „Gestoppt von X" und „−7er Serie" standen wortgleich schon im Text
        // der Karte. Das Blatt zeigt stattdessen, was der Satz nicht sagt:
        // wann die Serie begann und wie lange sie gehalten hat.
        const lauf = _newsSerienLauf(d.victimPid, d.matchId, d.streak);
        const gitter = `<div class="nd-gitter">
            <div><b class="g">${d.streak}</b><span>Siege nacheinander</span></div>
            ${lauf.tage != null ? `<div><b>${lauf.tage}</b><span>${lauf.tage === 1 ? 'Tag' : 'Tage'} lang gehalten</span></div>` : ''}
          </div>`;
        const zeit = lauf.von ? `<div class="nd-satz">Die Serie begann am <b>${esc(lauf.von)}</b>`
            + (lauf.bis ? ` und endete am <b>${esc(lauf.bis)}</b>.` : '.') + `</div>` : '';
        return `<div class="nd-section">Die Serie von ${esc(nameOf(d.victimPid))}</div>${gitter}${zeit}`;
      }
      case 'rivalry_milestone': {
        const h2h = _newsH2HRecord(d.a, d.b);
        return `<div class="nd-section">Historische Bilanz</div>
          <div class="nd-vs">
            <div class="nd-vs-p" data-pid="${esc(d.a)}">
              ${avM(d.a)}
              <div class="nd-vs-name">${esc(nameOf(d.a))}</div>
              <div class="nd-vs-elo">${h2h.aWins} Siege</div>
            </div>
            <div class="nd-vs-mid">${d.n}<div class="nd-vs-mid-sub">Duelle</div></div>
            <div class="nd-vs-p" data-pid="${esc(d.b)}">
              ${avM(d.b)}
              <div class="nd-vs-name">${esc(nameOf(d.b))}</div>
              <div class="nd-vs-elo">${h2h.bWins} Siege</div>
            </div>
          </div>
          ${d.matchId ? `<div class="nd-section">Jubiläums-Duell</div>${_newsMatchVsBlock(d.matchId)}` : ''}`;
      }
      case 'win_streak': {
        const form = _newsRecentForm(d.pid, Math.min(d.streak, 10));
        return `<div class="nd-section">Aktuelle Serie</div>
          ${_newsSerienBand(d.streak, false)}
          ${form.strip ? `<div class="nd-form-strip">${form.strip}</div>` : ''}
          <div class="nd-stat-row" data-pid="${esc(d.pid)}" style="cursor:pointer">
            <div class="nd-stat-label">${esc(nameOf(d.pid))}</div>
            <div class="nd-stat-val acid">${d.streak}× Sieg in Folge</div></div>`;
      }
      case 'dry_spell': {
        return `<div class="nd-section">Liga-Pause</div>
          <div class="nd-stat-row">
            <div class="nd-stat-label">Tage ohne Match</div>
            <div class="nd-stat-val gold">${d.daysSince}</div></div>
          ${d.lastMatchId ? `<div class="nd-section">Letztes Match</div>${_newsMatchVsBlock(d.lastMatchId)}` : ''}`;
      }
    }
  } catch(e){ /* defensiv */ }
  return '';
}

// ─── §11.7b — Detail-Body Helper (v8.1) ──────────────────────────────
// Wiederverwendbare Sub-Renderer und Stats-Funktionen für die einzelnen
// Detail-Body-Cases. Alle nutzen bestehende Caches; keine eigenen Walks.

// Wann begann die Serie, die hier endet? Steht nirgends sonst: die Karte
// nennt nur ihre Laenge, und das Blatt wiederholte das bisher.
function _newsSerienLauf(pid, matchId, laenge){
  try {
    const idx = matches.findIndex(m => m.id === matchId);
    if(idx < 0 || !laenge) return {};
    const eigene = [];
    for(let i = idx - 1; i >= 0 && eigene.length < laenge; i--){
      const m = matches[i];
      if([m.a1, m.a2, m.b1, m.b2].indexOf(pid) < 0) continue;
      eigene.push(m);
    }
    if(!eigene.length) return {};
    const erste = eigene[eigene.length - 1];
    const fmt = m => new Date(m.created_at).toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit'});
    const tage = Math.max(1, Math.round(
      (new Date(matches[idx].created_at) - new Date(erste.created_at)) / 86400000));
    return {von: fmt(erste), bis: fmt(matches[idx]), tage};
  } catch(e){ return {}; }
}

// Match-VS-Block: 2v2 Layout mit Spieler-Avataren, Namen, Score und Datum.
// Klickbar (data-mid) → springt zum Match-Detail über den existierenden
// Click-Handler in openNewsDetail.
function _newsMatchVsBlock(matchId){
  try {
    // Steht diese Partie schon als Ergebnis im Kopf des Blatts, entfaellt sie
    // hier. Sonst stuende dieselbe Begegnung zweimal untereinander.
    if(matchId && matchId === _ndKopfMatch) return '';
    const m = matches.find(x => x.id === matchId);
    if(!m) return '';
    const pm = pmap();
    const av = pid => (pm[pid] && typeof avHtml === 'function')
      ? avHtml(pm[pid], '')
      : '<span class="av" style="background:var(--surface)"></span>';
    const nm = pid => (pm[pid] && pm[pid].name) || '?';
    const aWon = m.winner === 'A';
    const dt = new Date(m.created_at);
    const dStr = dt.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'2-digit'});
    return `<div class="nd-match" data-mid="${esc(m.id)}">
      <div class="nd-match-side ${aWon?'won':'lost'}">
        <div class="nd-match-avs">${av(m.a1)}${av(m.a2)}</div>
        <div class="nd-match-names">${esc(nm(m.a1))} & ${esc(nm(m.a2))}</div>
      </div>
      <div class="nd-match-score">
        <div class="nd-match-score-val">${m.score_a}:${m.score_b}</div>
        <div class="nd-match-score-date">${dStr}</div>
      </div>
      <div class="nd-match-side ${!aWon?'won':'lost'}">
        <div class="nd-match-avs">${av(m.b1)}${av(m.b2)}</div>
        <div class="nd-match-names">${esc(nm(m.b1))} & ${esc(nm(m.b2))}</div>
      </div>
    </div>`;
  } catch(e){ return ''; }
}

// Elo-Delta für einen Spieler in einem bestimmten Match. Nutzt bestehenden
// getHistoryByMatchId-Cache (Map<matchId, {deltas, eloBefore, eloAfter}>).
function _newsEloDelta(pid, matchId){
  try {
    const hist = getHistoryByMatchId();
    const entry = hist.get(matchId);
    if(!entry || !entry.deltas) return null;
    const d = entry.deltas[pid];
    if(d === undefined || d === null) return null;
    return Math.round(d);
  } catch(e){ return null; }
}

// Pre/Post-Rank für einen Spieler an einem Match. Nutzt getRankSnapshots-Cache.
function _newsRankChange(pid, matchId){
  try {
    const snaps = getRankSnapshots();
    const snap = snaps[matchId];
    if(!snap || !snap.preRank || !snap.postRank) return null;
    const pre = snap.preRank[pid];
    const post = snap.postRank[pid];
    if(!pre || !post) return null;
    return {pre, post};
  } catch(e){ return null; }
}

// Form-Strip + Win-Streak der letzten N Matches. Walks die filter()-Variante
// nur über matches (gesamt) — wird im Detail aufgerufen, also einmalig.
function _newsRecentForm(pid, n){
  const arr = [];
  for(let i = matches.length - 1; i >= 0 && arr.length < n; i--){
    if(matchOf(pid, matches[i])) arr.unshift(matches[i]);
  }
  if(!arr.length) return {strip:'', currentStreak:0};
  const strip = arr.map(m => {
    const w = won(pid, m);
    return `<div class="nd-form-dot ${w?'w':'l'}" title="${w?'Sieg':'Niederlage'}"></div>`;
  }).join('');
  // Aktuelle Sieges-Streak (von hinten zählen)
  let curStreak = 0;
  for(let i = arr.length - 1; i >= 0; i--){
    if(won(pid, arr[i])) curStreak++;
    else break;
  }
  return {strip, currentStreak: curStreak};
}

// H2H-Bilanz Spieler A vs Spieler B (egal welche Teamkonstellation).
// Iteriert einmal über matches; bei großen Datensätzen kann das auf
// getPairsCache umgestellt werden — derzeit aber günstig genug.
// H2H-Lazy-Cache (v8.4): Statt für jedes Detail ALLE matches zu walken
// (O(N) pro Lookup → bei 100k Matches teuer), wird beim ersten H2H-Lookup
// EINE Map über alle Spieler-Paarungen gebaut und gecached. Danach ist jeder
// _newsH2HRecord-Lookup O(1). Build-Kosten: einmalig O(N × 4) (4 Kreuz-Paare
// pro Match), amortisiert über alle Detail-Aufrufe.
// Key bindet an matches.length + _cache.version → invalidateCache(['news'])
// (§3) löscht _h2hMap/_h2hKey, der Version-Tick bricht den Key zusätzlich.
function _ensureH2HMap(){
  const key = 'h2h_' + matches.length + '_' + _cache.version;
  if(_cache._h2hKey === key && _cache._h2hMap) return _cache._h2hMap;
  const map = new Map();
  for(let i = 0; i < matches.length; i++){
    const m = matches[i];
    const sideA = [m.a1, m.a2], sideB = [m.b1, m.b2];
    const ts = mts(m);
    const aWon = m.winner === 'A';
    // Alle 4 Kreuz-Paare (je 1 Spieler aus A gegen 1 aus B) sind H2H-Gegner.
    for(let x = 0; x < 2; x++){
      for(let y = 0; y < 2; y++){
        const pa = sideA[x], pb = sideB[y];
        if(!pa || !pb) continue;
        const k = pa < pb ? pa + '|' + pb : pb + '|' + pa;
        let e = map.get(k);
        if(!e){ e = {wins:{}, lastMatchId:null, lastTs:0}; map.set(k, e); }
        const winnerPid = aWon ? pa : pb;
        e.wins[winnerPid] = (e.wins[winnerPid] || 0) + 1;
        if(ts > e.lastTs){ e.lastTs = ts; e.lastMatchId = m.id; }
      }
    }
  }
  _cache._h2hKey = key;
  _cache._h2hMap = map;
  return map;
}
function _newsH2HRecord(aPid, bPid){
  const map = _ensureH2HMap();
  const k = aPid < bPid ? aPid + '|' + bPid : bPid + '|' + aPid;
  const e = map.get(k);
  if(!e) return {aWins:0, bWins:0, lastMatchId:null};
  // aWins/bWins richten sich nach der Aufruf-Reihenfolge (nicht nach dem
  // kanonischen Map-Key) → korrekt unabhängig von der Argument-Sortierung.
  return {aWins: e.wins[aPid] || 0, bWins: e.wins[bPid] || 0, lastMatchId: e.lastMatchId};
}

// Karriere-Bilanz (wins, losses, winRate) eines Spielers. Nutzt bestehende
// playerStats falls verfügbar, sonst einmaliger walk.
function _newsPlayerCareer(pid){
  try {
    if(typeof playerStats === 'function'){
      const st = playerStats(pid);
      if(st && (st.wins !== undefined || st.gp !== undefined)){
        const wins = st.wins || 0;
        const losses = st.losses || ((st.gp || 0) - wins);
        const total = wins + losses;
        const winRate = total ? Math.round((wins/total)*100) : 0;
        return {wins, losses, winRate};
      }
    }
  } catch(e){}
  // Fallback: schneller direkter walk
  let wins = 0, losses = 0;
  for(let i = 0; i < matches.length; i++){
    if(!matchOf(pid, matches[i])) continue;
    if(won(pid, matches[i])) wins++; else losses++;
  }
  const total = wins + losses;
  return {wins, losses, winRate: total ? Math.round((wins/total)*100) : 0};
}

// ─── Hookup: News-Button-Click + Backdrop-Close ──────────────────────
(function attachNewsHandlers(){
  const ready = () => {
    const btn = document.getElementById('newsBtn');
    if(btn && !btn._newsBound){
      btn._newsBound = true;
      // v8.9 (User-Wunsch): Klick öffnet direkt das volle Sheet statt des
      // kleinen Vorschau-Popovers. openNewsPopover bleibt für interne Reuse
      // (z.B. Toast-Tap, _refreshOpenNewsViews) erhalten.
      btn.onclick = openNewsFeed;
    }
    // Backdrop-Bindings:
    //   nvBg (Mini-Popup): Backdrop-Click schließt — ist nur ein Vorschau-Layer.
    //   ndBg (Story-Detail): KEIN Backdrop-Close mehr (User-Wunsch v8.1):
    //     Stories sollen bewusst konsumiert werden → nur X-Button oder
    //     "Schließen"-Button unten beenden den Detail-View.
    const nvBg = document.getElementById('nvBg');
    if(nvBg && !nvBg._newsBound){
      nvBg._newsBound = true;
      nvBg.addEventListener('click', (e) => {
        if(e.target === nvBg) closeNewsPopover();
      });
    }
    const ndBg = document.getElementById('ndBg');
    if(ndBg && !ndBg._newsBound){
      ndBg._newsBound = true;
      // Backdrop-Click schließt das Detail NICHT mehr — bewusstes Schließen
      // erfolgt nur via X-Button oder Schließen-Button.
    }
  };
  if(document.readyState !== 'loading') ready();
  else document.addEventListener('DOMContentLoaded', ready);
})();

