// ─── §13.5 Anzeigen ──────────────────────────────────────────────────
// Eine Plakette. `hero` = die große Meister-Variante ganz oben auf der Tafel.
function _titlePlateHtml(a, opts){
  const o = opts || {};
  const t = titleTone(a.tone);
  const p = pmap()[a.pid];
  const av = p ? avHtml(p, 'width:19px;height:19px;font-size:9px;border-radius:7px') : '';
  const cls = 'tplate' + (o.hero ? ' hero' : '') + (a.pid ? ' clickable' : '');
  return `<div class="${cls}" style="--tt:${t.c};--ttr:${t.rgb}"${a.pid ? ` data-tplayer="${esc(a.pid)}"` : ''}>
    <div class="tplate-ic">${svgI(a.ic)}</div>
    <div class="tplate-b">
      <div class="tplate-t">${esc(a.name)}</div>
      <div class="tplate-w">${av}<span>${esc(p ? p.name : '?')}</span></div>
      ${a.ev ? `<div class="tplate-e num">${esc(a.ev)}</div>` : ''}
    </div>
  </div>`;
}

// Die Saison-Tafel als Sheet. Öffnet aus der Chronik, der Liga-Chronik und
// aus dem News-Detail des Saison-Abschlusses.
function showSeasonTable(sid){
  if(!sid) sid = currentSeason().id;
  _sheetSetReopen(()=>showSeasonTable(sid));
  const T = seasonTitles(sid);
  if(!T.awarded.length && !T.champ){
    openSheet(`<h3>${esc(seasonLabel(sid))}</h3>
      <div class="sheet-sub">Noch keine Chronik-Einträge</div>
      ${emptyState('trophy', T.live ? 'Die Saison läuft — noch erfüllt niemand eine Bedingung.' : 'Kein Eintrag in dieser Saison')}`);
    return;
  }
  const emptyNames = T.empty.map(pname).filter(Boolean);
  // „Nicht vergeben" nur für die laufende Saison. Eine eingefrorene Tafel
  // ist gegen den Katalog von DAMALS gelaufen; sie gegen den von heute zu
  // halten würde Einträge als verpasst zeigen, die es damals nicht gab.
  const unawarded = T.live
    ? SEASON_TITLES.filter(t => !T.awarded.some(a => a.titleId === t.id))
    : [];
  // Der Meister steht als eigene Zeile über der Chronik, nicht IN ihr: Platz 1
  // der Elo ist eine Tabellen-Aussage, kein Chronik-Eintrag — und er würde dem
  // Ersten sonst seinen einen Chronik-Platz wegnehmen.
  const gt = titleTone('gold');
  const ch = T.champ;
  openSheet(`
    <h3>Die Chronik der Saison</h3>
    <div class="sheet-sub num">${esc(T.label)} · ${T.matches} Matches an ${T.days} Spieltag${T.days===1?'':'en'}${T.live ? ' · läuft noch' : ''}</div>
    ${T.live ? `<div class="tnote">Stand von heute — bis zum Monatsende kann sich alles noch ändern.</div>` : ''}
    ${ch ? `<div class="chron-one" style="--tt:${gt.c};--ttr:${gt.rgb}" data-tplayer="${esc(ch.pid)}">
        <span class="ic">${svgI('crown')}</span>
        <span class="tx"><span class="n">${esc(pname(ch.pid))} — ${T.live ? 'führt die Saison an' : 'Meister'}</span>
          <span class="e num">${ch.elo} Elo · ${ch.wins} Siege aus ${ch.games} Spielen</span></span>
      </div><div style="height:14px"></div>` : ''}
    <div class="tplates">${T.awarded.map(a => _titlePlateHtml(a)).join('')}</div>
    ${emptyNames.length ? `<div class="pp-sec-title" style="margin-top:16px"><div class="l"><h4>Ohne Eintrag</h4></div></div>
      <div class="tempty">${esc(emptyNames.join(', '))}<span>Keine Bedingung erfüllt — die Saison zählt trotzdem.</span></div>` : ''}
    ${unawarded.length ? `<div class="pp-sec-title" style="margin-top:16px"><div class="l"><h4>Nicht vergeben</h4></div><div class="m">${unawarded.length}</div></div>
      <div class="tunawarded">${unawarded.slice(0, 8).map(t =>
        `<div class="tun"><span class="i">${svgI(t.ic)}</span><span class="n">${esc(t.name)}</span><span class="c">${esc(t.cond)}</span></div>`
      ).join('')}${unawarded.length > 8
        ? `<div class="tun-more">und ${unawarded.length - 8} weitere, die diese Saison niemand erreicht hat</div>` : ''}</div>` : ''}
  `);
  _bindChronikClicks(document.getElementById('sheet'));
}

// Chronik fürs Profil: EINE Karte. Nicht mehr eine Liste — genau die eine
// Auszeichnung, die diesen Spieler von allen anderen unterscheidet. Darunter
// der Saison-Streifen: was er Monat für Monat geholt hat.
function _chronStripHtml(pid){
  const rows = seasonTitleHistory(pid);
  const c = chronicleOf(pid);
  if(!rows.length && !c) return '';

  let chronBlock = '';
  if(c){
    // Wer mehr als einen Rekord haelt, soll auch alle sehen koennen. Sichtbar
    // ist der wertvollste; der Rest kommt auf Tippen. Andersherum waere die
    // Karte bei Leon zehn Zeilen lang, bevor irgendetwas anderes im Profil kommt.
    const mine = chroniclesOfPlayer(pid);
    const card = (x) => {
      const tt = titleTone(x.tone);
      return `<div class="chron-one" style="--tt:${tt.c};--ttr:${tt.rgb}" data-chron="${esc(x.id)}">
      <span class="ic">${svgI(x.ic)}</span>
      <span class="tx">
        <span class="n">${esc(x.name)}${x.shared
          ? `<span class="shared">zu ${x.pids.length}. gehalten</span>` : ''}</span>
        <span class="e num">${esc(x.ev)}</span>
      </span>
      <span class="go"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2.5" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg></span>
    </div>`;
    };
    const rest = mine.slice(1);
    chronBlock = `
    <div class="pp-sec-title">
      <div class="l"><span class="ic svg-ic">${svgI('trophyStar')}</span><h4>Liga-Rekord${
        mine.length > 1 ? 'e' : ''}</h4></div>
      ${mine.length > 1 ? `<div class="m num">${mine.length}</div>` : ''}
    </div>
    ${card(mine[0] || c)}
    ${rest.length ? `<div class="chron-rest">${rest.map(card).join('')}</div>
    <button class="chron-more" type="button" data-chron-more>
      <span class="tx">Mehr anzeigen · ${rest.length} weitere${rest.length === 1 ? 'r' : ''}</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
        stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
    </button>` : ''}`;
  } else {
    // Kein Rekord? Dann zeigt die Karte, welcher am nächsten liegt und was
    // dafür noch fehlt. Eine leere Zeile motiviert niemanden, eine Zahl schon.
    const nx = nextRecordFor(pid);
    if(nx){
      const t = titleTone(nx.tone);
      const pct = nx.target ? Math.max(3, Math.min(100, Math.round(nx.have / nx.target * 100))) : 0;
      chronBlock = `
    <div class="pp-sec-title">
      <div class="l"><span class="ic svg-ic">${svgI('trophyStar')}</span><h4>Liga-Rekord</h4></div>
      <div class="m">noch keiner</div>
    </div>
    <div class="chron-one next" style="--tt:${t.c};--ttr:${t.rgb}" data-chron="${esc(nx.id)}">
      <span class="ic">${svgI(nx.ic)}</span>
      <span class="tx">
        <span class="n">${esc(nx.name)}</span>
        <span class="e num">${esc(nx.txt)}</span>
        <span class="bar"><i style="width:${pct}%"></i></span>
      </span>
      <span class="go"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="2.5" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg></span>
    </div>`;
    } else {
      chronBlock = `
    <div class="pp-sec-title">
      <div class="l"><span class="ic svg-ic">${svgI('trophyStar')}</span><h4>Liga-Rekord</h4></div>
    </div>
    <div class="chrows-empty">Noch keiner. Jeder Rekord gehört dem, der ihn
      wirklich hält — und jeder Spieler zeigt seinen wertvollsten.</div>`;
    }
  }

  // Nur Monate mit Eintrag. Ein leeres Kästchen mit Strich sagt nichts, was
  // der Zähler daneben nicht schon sagt — es macht den Streifen nur länger
  // und lenkt vom Erreichten ab.
  const earned = rows.filter(r => r.title);
  // Neueste Saison links: der Streifen wird von links gelesen, und was gerade
  // läuft ist interessanter als der erste Monat der Liga-Geschichte.
  const cells = earned.slice(-12).reverse().map(r => {
    const t = r.title;
    const tone = titleTone(t.tone);
    const mon = String(r.label).split(' ')[0].slice(0,3);
    return `<div class="chron-cell${r.live ? ' live' : ''}"
      style="--tt:${tone.c};--ttr:${tone.rgb}" data-season-table="${esc(r.sid)}">
      <div class="m">${esc(mon)}</div>
      <div class="i">${svgI(t.ic)}</div>
      <div class="n">${esc(t.short || t.name)}</div>
    </div>`;
  }).join('');
  const stripBlock = rows.length ? `
    <div class="pp-sec-title" style="margin-top:18px">
      <div class="l"><span class="ic svg-ic">${svgI('scroll')}</span><h4>Chronik</h4></div>
      <div class="m">${earned.length} aus ${rows.length} Saisons</div>
    </div>
    ${earned.length
      ? `<div class="chron-strip">${cells}</div>`
      : `<div class="chrows-empty">Noch kein Monat mit Eintrag. Jede Saison
          fängt bei null an — die Chronik auch.</div>`}` : '';

  // Reihenfolge: erst die Chronik (jeden Monat neu erreichbar, das ist das
  // Spannende), dann der eine Liga-Rekord der ganzen Laufbahn.
  return stripBlock + (stripBlock ? '<div style="height:18px"></div>' : '') + chronBlock;
}

// Eine einzelne Chronik ligaweit: wer hält sie, wer hielte sie sonst.
function showChronicle(cid){
  const def = CHRONICLE_BY_ID[cid];
  if(!def) return;
  _sheetSetReopen(()=>showChronicle(cid));
  const h = chronicleHolders()[cid] || null;
  const t = titleTone(def.tone);
  // Bei Gleichstand hält den Rekord mehr als einer — dann steht hier auch
  // mehr als eine Zeile, jede mit ihrem eigenen Beleg.
  const holders = h ? (h.holders || [{pid:h.pid, ev:h.ev}]) : [];
  openSheet(`
    <h3>${esc(def.name)}</h3>
    <div class="sheet-sub">${esc(CHRON_KINDS[def.kind].label === 'Liga-Rekord'
      ? 'Liga-Rekord' : 'Liga-Rekord · ' + CHRON_KINDS[def.kind].label)}${
      holders.length > 1 ? ' · punktgleich zu ' + holders.length + '. gehalten' : ''}</div>
    <div class="chron-hero" style="--tt:${t.c};--ttr:${t.rgb}">
      <span class="ic">${svgI(def.ic)}</span>
      <span class="c">${esc(def.cond)}</span>
    </div>
    ${holders.length
      ? holders.map(x => {
          const p = pmap()[x.pid];
          return `<div class="chron-one" style="--tt:${t.c};--ttr:${t.rgb};margin-bottom:8px" data-tplayer="${esc(x.pid)}">
          <span class="ic av">${p ? avHtml(p, 'width:30px;height:30px;font-size:12px;border-radius:10px') : ''}</span>
          <span class="tx"><span class="n">${esc(p ? p.name : '?')}</span>
            <span class="e num">${esc(x.ev)}</span></span>
        </div>`;
        }).join('')
      : emptyState('scroll', 'Diese Chronik hat noch niemand erreicht.')}
  `);
  _bindChronikClicks(document.getElementById('sheet'));
}

// Titel-Pille unter dem Namen im Profilkopf.
function _titlePillHtml(pid){
  const b = playerTitleBadge(pid);
  if(!b) return '';
  const t = titleTone(b.tone);
  return `<div class="pp-title-row">
    <span class="pp-title-pill${b.live ? ' live' : ''}" style="--tt:${t.c};--ttr:${t.rgb}">
      <span class="i">${svgI(b.ic)}</span>${esc(b.name)}</span>
    <span class="pp-title-sub num">${esc(b.sub)}</span>
  </div>`;
}

// Liga-Chronik: oben die Rekorde (wer hält was), darunter die Saison-Titel
// als Spieler × Saison-Matrix. Zwei Ebenen derselben Geschichte — Laufbahn
// und Monat — bewusst getrennt statt vermischt.
function showLigaChronik(){
  _sheetSetReopen(()=>showLigaChronik());
  const all = allSeasonTitles();           // neueste zuerst
  const cols = all.slice(0, 8).reverse();  // älteste links, wie eine Zeitleiste

  // Die Chroniken stehen bewusst UNTEN. Wichtiger ist, was Monat für Monat
  // erreichbar ist — die Saison-Matrix. Die Chronik-Liste ist Nachschlagewerk,
  // kein Aufmacher, und deshalb bewusst schmal: Icon, Name, Halter.
  const holders = chronicleHolders();
  const recs = CHRONICLES.filter(d => holders[d.id]);
  const recHtml = recs.length ? `
    <div class="pp-sec-title" style="margin-top:20px">
      <div class="l"><span class="ic svg-ic">${svgI('trophyStar')}</span><h4>Liga-Rekorde</h4></div>
      <div class="m">${recs.length} von ${CHRONICLES.length}</div>
    </div>
    <div class="chlist">${recs.map(d => {
      const h = holders[d.id];
      const t = titleTone(d.tone);
      return `<div class="chline" style="--tt:${t.c};--ttr:${t.rgb}" data-chron="${esc(d.id)}">
        <span class="ic">${svgI(d.ic)}</span>
        <span class="n">${esc(d.name)}</span>
        <span class="hd">${esc(_chronHolderNames(h))}</span>
      </div>`;
    }).join('')}</div>
    <div class="tnote">Jeder Rekord gehört dem, der ihn wirklich hält — bei exaktem
      Gleichstand allen, die ihn halten. Tippen zeigt die Bedingung.</div>` : '';

  if(!cols.length){
    openSheet(`<h3>Liga-Chronik</h3>
      <div class="sheet-sub">${recs.length ? recs.length + ' Liga-Rekorde · noch keine Saison mit Chronik' : 'Noch keine Saison mit Chronik'}</div>
      ${recHtml || emptyState('scroll','Sobald ein Monat gespielt ist, füllt sich die Chronik.')}`);
    _bindChronikClicks(document.getElementById('sheet'));
    return;
  }
  // Zeilen: alle Spieler, die in einer der Spalten-Saisons gewertet wurden.
  // Sortiert nach Titel-Anzahl, dann Name — wer viel geholt hat, steht oben.
  const seen = {};
  cols.forEach(T => {
    T.awarded.forEach(a => { seen[a.pid] = (seen[a.pid] || 0) + 1; });
    T.empty.forEach(pid => { if(seen[pid] === undefined) seen[pid] = 0; });
  });
  const rows = Object.keys(seen)
    .filter(pid => pmap()[pid])
    .sort((a,b) => seen[b] - seen[a] || pname(a).localeCompare(pname(b)));
  const total = cols.reduce((n,T) => n + T.awarded.length, 0);
  openSheet(`
    <h3>Liga-Chronik</h3>
    <div class="sheet-sub num">${cols.length} Saison${cols.length===1?'':'s'} · ${total} Einträge · ${recs.length} Rekorde</div>
    <div class="lchron-wrap">
      <table class="lchron">
        <thead><tr><th>Spieler</th>${cols.map(T =>
          `<th data-season-table="${esc(T.sid)}">${esc(String(T.label).split(' ')[0].slice(0,3))}</th>`
        ).join('')}</tr></thead>
        <tbody>
          ${rows.map(pid => `<tr>
            <td class="who" data-tplayer="${esc(pid)}"><div class="w">${avHtml(pmap()[pid],'width:18px;height:18px;font-size:8px;border-radius:6px')}<span>${esc(pname(pid))}</span></div></td>
            ${cols.map(T => {
              const a = T.awarded.find(x => x.pid === pid);
              if(!a) return `<td><span class="lc-dash">—</span></td>`;
              const t = titleTone(a.tone);
              return `<td><span class="lc-cell${T.live?' live':''}" style="--tt:${t.c};--ttr:${t.rgb}"
                data-season-table="${esc(T.sid)}">
                <span class="i">${svgI(a.ic)}</span>
                <span class="n">${esc(a.short || a.name)}</span></span></td>`;
            }).join('')}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="tnote">Gestrichelt = laufende Saison, noch nicht entschieden. Tippen öffnet den Monat.</div>
    ${recHtml}
  `);
  // Ans rechte Ende scrollen: die jüngste Saison interessiert am meisten,
  // ältere holt man sich durch Wischen nach rechts.
  const _lw = document.querySelector('#sheet .lchron-wrap');
  // Nur bei echtem Überlauf ans rechte Ende springen — bei vier Saisons passt
  // alles aufs Handy, und ein halb abgeschnittener erster Monat sähe nach
  // Fehler aus statt nach Absicht.
  if(_lw && _lw.scrollWidth > _lw.clientWidth + 24) _lw.scrollLeft = _lw.scrollWidth;
  _bindChronikClicks(document.getElementById('sheet'));
}

// Klick-Verdrahtung für Chronik-Elemente. `data-tplayer` statt `data-detail`,
// damit die globalen [data-detail]-Handler die Zellen nicht doppelt belegen.
function _bindChronikClicks(root){
  if(!root) return;
  root.querySelectorAll('[data-season-table]').forEach(el => {
    el.onclick = (e) => { e.stopPropagation(); sheetNav(()=>showSeasonTable(el.dataset.seasonTable)); };
  });
  root.querySelectorAll('[data-tplayer]').forEach(el => {
    el.onclick = (e) => { e.stopPropagation(); sheetNav(()=>showPlayer(el.dataset.tplayer)); };
  });
  root.querySelectorAll('[data-chron]').forEach(el => {
    el.onclick = (e) => { e.stopPropagation(); sheetNav(()=>showChronicle(el.dataset.chron)); };
  });
  root.querySelectorAll('[data-chron-more]').forEach(el => {
    el.onclick = (e) => {
      e.stopPropagation();
      const rest = el.previousElementSibling;
      if(!rest) return;
      const open = rest.classList.toggle('open');
      el.classList.toggle('open', open);
      const n = rest.children.length;
      const tx = el.querySelector('.tx');
      if(tx) tx.textContent = open ? 'Weniger anzeigen'
                                   : ('Mehr anzeigen · ' + n + ' weitere' + (n === 1 ? 'r' : ''));
    };
  });
}

// ─── §13.6 Marken neben dem Namen (Rangliste) ────────────────────────
// Genau zwei Dinge stehen neben einem Namen, und beide sagen etwas, das
// sonst nirgends in der Zeile steht:
//   1. Meistertitel mit Anzahl — das Lebenswerk. Gold, massiv.
//   2. Der Saisontitel, den er GERADE in dieser Saison hält — gestrichelt,
//      weil er bis zum Monatsende noch kippen kann.
// Die Chronik kommt hier bewusst NICHT vor: sie steht im Profil, und in
// einer 12er-Liga trüge sonst jeder eine Marke — das unterscheidet nichts.
function _playerRankMarks(pid){
  const out = [];
  let rows = [];
  try { rows = seasonTitleHistory(pid) || []; } catch(e){ rows = []; }
  // Meistertitel kommen seit v9.18 direkt aus der Rangliste (seasonChampion),
  // nicht mehr aus der Chronik: Platz 1 ist keine Chronik-Bedingung mehr.
  const champLabels = [];
  rows.forEach(r => { if(!r.live && seasonChampion(r.sid) === pid) champLabels.push(r.label); });
  if(champLabels.length){
    out.push({ic:'crown', tone:'gold', kind:'champ', n:champLabels.length, live:false,
              label: champLabels.length > 1 ? `${champLabels.length}× Meister` : 'Der Meister',
              sub: champLabels.join(', ')});
  }
  const cur = rows.find(r => r.live && r.title);
  if(cur) out.push({ic:cur.title.ic, tone:cur.title.tone, kind:'season', n:1, live:true,
                    label:cur.title.name, sub:`${cur.label} · Stand heute`});
  return out;
}
// Rückwärtskompatibel: einige Aufrufer wollen nur die eine Hauptmarke.
function _playerRankMark(pid){ return _playerRankMarks(pid)[0] || null; }

// Rendert die Marken: nur Icons im Ton der Auszeichnung, mit leichtem Schein
// und optionaler Anzahl. Kein Kasten, kein Rahmen — neben einem Namen soll das
// wie eine Auszeichnung wirken, nicht wie ein Button. Der laufende Titel
// bekommt einen gestrichelten Ring: noch nicht entschieden.
function _titleMarkHtml(pid, size){
  const marks = _playerRankMarks(pid);
  if(!marks.length) return '';
  return marks.map(b => {
    const t = titleTone(b.tone);
    const cls = 'tmark' + (b.live ? ' live' : '') + (b.n > 2 ? ' honor' : '')
              + (size === 'lg' ? ' lg' : '');
    const cnt = b.n > 1 ? `<i>${b.n}</i>` : '';
    return `<span class="${cls}" style="--tt:${t.c};--ttr:${t.rgb}" title="${esc(b.label + ' · ' + b.sub)}">${svgI(b.ic)}${cnt}</span>`;
  }).join('');
}

// ─── §13.7 Avatar-Ring: der Zustand von JETZT ────────────────────────
//     Ein farbiger Ring um den Avatar sagt in der Liste sofort, wer gerade
//     brennt, wer abstürzt, wer amtierender Meister ist. Anders als Titel
//     und Chroniken ist er FLÜCHTIG — er kann nächste Woche weg sein, und
//     genau das macht ihn spannend.
//
//     Jeder Spieler bekommt höchstens EINEN Ring: den mit der höchsten
//     Priorität. Sonst wäre wieder jeder Avatar bunt und nichts hieße etwas.
//     Alles wird in einem Rutsch für die ganze Liga berechnet und gecacht —
//     die Rangliste ruft das pro Zeile auf.
const AV_RINGS = {
  champ: {prio:92, tone:'gold',   ic:'crown',       label:'Titelverteidiger'},
  blaze: {prio:88, tone:'orange', ic:'flameTriple', label:'Siegesserie'},
  abyss: {prio:86, tone:'red',    ic:'dropTriple',  label:'Niederlagenserie'},
  potw:  {prio:80, tone:'purple', ic:'weekKing',    label:'Player of the Week'},
  hot:   {prio:74, tone:'orange', ic:'flame',       label:'Siegesserie'},
  cold:  {prio:72, tone:'red',    ic:'drop',        label:'Niederlagenserie'},
  tots:  {prio:64, tone:'blue',   ic:'duo',         label:'Team of the Season'},
};
function avatarRings(){
  const key = matches.length + '_' + _cache.version;
  if(_cache._avRingKey === key) return _cache._avRing;
  const out = {};
  const put = (pid, kind, sub) => {
    if(!pid) return;
    const def = AV_RINGS[kind];
    if(!def) return;
    if(out[pid] && out[pid].prio >= def.prio) return;
    out[pid] = {kind, prio:def.prio, tone:def.tone, ic:def.ic, label:def.label, sub};
  };
  try {
    const gSim = getGlobalSim();
    const pm = pmap();
    const curSid = currentSeason().id;

    // Amtierender Meister = Meistertitel der letzten abgeschlossenen Saison.
    const prevSid = _prevSeasonId(curSid);
    if(prevSid && matchesInSeason(prevSid).length){
      const champPid = seasonChampion(prevSid);
      if(champPid) put(champPid, 'champ', 'Meister ' + seasonLabel(prevSid));
    }

    // Team of the Season der laufenden Saison — beide Hälften.
    const team = _seasonTeamRanking(matchesInSeason(curSid), curSid)[0];
    if(team) team.ids.forEach(id => put(id, 'tots',
      'mit ' + pname(team.ids.find(x => x !== id) || id)));

    // Player of the Week der letzten abgeschlossenen Woche.
    const wk = _periodWinnerMap(matches, 'week');
    const wkKeys = Object.keys(wk).sort();
    if(wkKeys.length) put(wk[wkKeys[wkKeys.length-1]], 'potw',
      'Woche ' + wkKeys[wkKeys.length-1].split('-W')[1]);

    // Serien zuletzt — sie überschreiben alles außer dem Titelverteidiger,
    // wenn sie lang genug sind. Eine 9er-Serie ist die Nachricht des Tages.
    Object.keys(pm).forEach(id => {
      if(pm[id].hidden) return;
      const cs = gSim.curStreak[id] || 0;
      if(cs >= 8)      put(id, 'blaze', cs + ' Siege in Folge');
      else if(cs >= 5) put(id, 'hot',   cs + ' Siege in Folge');
      else if(cs <= -8) put(id, 'abyss', (-cs) + ' Niederlagen in Folge');
      else if(cs <= -5) put(id, 'cold',  (-cs) + ' Niederlagen in Folge');
    });
  } catch(e){ /* Ring ist Zierde — er darf die Rangliste nie kippen. */ }
  _cache._avRingKey = key;
  _cache._avRing = out;
  return out;
}
function avRingOf(pid){
  try { return avatarRings()[pid] || null; } catch(e){ return null; }
}

// Zusatz-Attribute für einen Avatar mit Ring — von avHtml() eingesetzt.
// Der Ring liegt als box-shadow auf dem Avatar selbst: kein zusätzliches
// Element, kein Einfluss auf das Layout der Zeile.
function _avRingAttrs(pid){
  const r = avRingOf(pid);
  if(!r) return null;
  const t = titleTone(r.tone);
  return {
    cls: ' avring r-' + r.kind,
    style: `--tt:${t.c};--ttr:${t.rgb};`,
    attr: ` title="${esc(r.label + ' · ' + r.sub)}"`
  };
}

// Erklär-Zeile für den Profilkopf: welcher Ring, warum.
function _avRingChipHtml(pid){
  const r = avRingOf(pid);
  if(!r) return '';
  const t = titleTone(r.tone);
  return `<div class="pp-ring-chip" style="--tt:${t.c};--ttr:${t.rgb}">
    <span class="i">${svgI(r.ic)}</span>
    <b>${esc(r.label)}</b><span class="s num">${esc(r.sub)}</span>
  </div>`;
}

