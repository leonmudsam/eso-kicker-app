// ─── §13.5 Anzeigen ──────────────────────────────────────────────────
// Eine Plakette. `hero` = die große Meister-Variante ganz oben auf der Tafel.
function _titlePlateHtml(a, opts){
  const o = opts || {};
  const t = titleTone(a.tone);
  const p = pmap()[a.pid];
  // Die Maße stehen in .tplate-w .av — im style-Attribut waren sie das
  // einzige, was man nicht im CSS fand, wenn die Plakette zu eng aussah.
  const av = p ? avHtml(p) : '';
  const zeig = a.titleId && !o.keinDetail;
  const cls = 'tplate' + (o.hero ? ' hero' : '') + (zeig || a.pid ? ' clickable' : '');
  return `<div class="${cls}" style="--tt:${t.c};--ttr:${t.rgb}"${
    zeig ? ` data-tdisz="${esc(a.titleId)}" data-tsid="${esc(o.sid || '')}"`
         : (a.pid ? ` data-tplayer="${esc(a.pid)}"` : '')}>
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
  // Zuerst nur das, was die Chronik-Matrix auch zeigt: je Spieler der erste
  // Eintrag in Katalogreihenfolge, denn die Reihenfolge IST die Wertigkeit
  // [§C32]. Alles Weitere steht dahinter. Vorher listete das Blatt jeden
  // Eintrag jedes Spielers — in einem starken Monat waren das über zwanzig
  // Karten, von denen sieben demselben Namen gehörten, und der Reiter
  // dahinter zeigte etwas ganz anderes.
  const gesehen = new Set();
  const sichtbar = [], weitere = [];
  T.awarded.forEach(a => {
    if(gesehen.has(a.pid)) weitere.push(a);
    else { gesehen.add(a.pid); sichtbar.push(a); }
  });
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
    <div class="tplates">${sichtbar.map(a => _titlePlateHtml(a, {sid})).join('')}</div>
    ${weitere.length ? `<div class="tplates chron-rest">${weitere.map(a => _titlePlateHtml(a, {sid})).join('')}</div>
    <button class="chron-more" type="button" data-chron-more>
      <span class="tx">Alle anzeigen · ${weitere.length} weitere${weitere.length === 1 ? 'r' : ''}</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
        stroke-linecap="round"><path d="M6 9l6 6 6-6"/></svg>
    </button>` : ''}
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
      return `<div class="chron-one${x.kind === 'shame' ? ' schatten' : ''}" style="--tt:${tt.c};--ttr:${tt.rgb}" data-chron="${esc(x.id)}">
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
      <div class="m num">${earned.length}</div>
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
// ─── §13.5b Eine Monatswertung im Detail ─────────────────────────────
// Ein Klick auf eine Chronik-Karte führte ins Spielerprofil. Dort steht dann
// alles über den Spieler und nichts über die Wertung — nicht, was die Zahl
// daneben bedeutet, und nicht, wer sonst noch nah dran war. Diese Ansicht
// beantwortet genau das: die Bedingung, die Rechnung dahinter und das
// Podest des Monats.
// Das Podest der ersten drei — dasselbe Bauteil im Monats- und im
// Rekord-Blatt [§C27]. Erwartet wird eine Reihenfolge aus {pid, wert, zeit};
// wer weniger als drei hat, bekommt leere Plaetze statt einer Luecke.
function _chronPodestHtml(reihe){
  const METALL = ['gold', 'silber', 'bronze'];
  const platz = (i) => {
    const r = reihe[i];
    const p = r && pmap()[r.pid];
    if(!p) return '<div class="pod-leer"></div>';
    return `<div class="pod-karte ${METALL[i]}${i === 0 ? ' erster' : ''}" data-tplayer="${esc(r.pid)}">
      <div class="pod-platz num">${String(i + 1).padStart(2, '0')}</div>
      ${avHtml(p, '', {ins:true, px:(i === 0 ? 84 : 70), klasse:'pod-av'})}
      <div class="pod-name">${esc(p.name)}</div>
      <div class="pod-sub"><span>${esc(r.wert || '')}</span>${
        r.zeit ? `<span>${esc(String(r.zeit))}</span>` : ''}</div>
    </div>`;
  };
  return `<div class="podest">${platz(1)}${platz(0)}${platz(2)}</div>`;
}

function showDisziplin(tid, sid){
  const def = SEASON_TITLE_BY_ID[tid];
  if(!def) return;
  if(!sid) sid = currentSeason().id;
  _sheetSetReopen(()=>showDisziplin(tid, sid));
  const t = titleTone(def.tone);
  const T = seasonTitles(sid);
  const eigene = T.awarded.filter(a => a.titleId === tid);

  // Ein eingefrorener Monat wird NICHT nachgerechnet [§13.3a]: er lief gegen
  // den Katalog von damals, und die heutige Bedingung ergäbe dort ein
  // anderes Podest als die Tafel daneben zeigt.
  let rang = [], evFuer = null;
  if(!T.frozen){
    try {
      const r = def.pick(_seasonTitleCtx(sid), new Set());
      if(r && r.rang){ rang = r.rang; evFuer = r.evFuer; }
    } catch(e){ rang = []; }
  }

  const podest = _chronPodestHtml(rang.map(pid => {
    let wert = '';
    try { wert = evFuer ? evFuer(pid) : ''; } catch(e){ wert = ''; }
    return {pid, wert};
  }));

  openSheet(`
    <h3>${esc(def.name)}</h3>
    <div class="sheet-sub">Monatswertung · ${esc(seasonLabel(sid))}${T.live ? ' · läuft noch' : ''}</div>
    <div class="chron-hero" style="--tt:${t.c};--ttr:${t.rgb}">
      <span class="ic">${svgI(def.ic)}</span>
      <span class="c">${esc(def.cond)}</span>
    </div>
    ${def.wie ? `<div class="tnote">${esc(def.wie)}</div>` : ''}
    ${rang.length
      ? `<div class="pp-sec-title" style="margin-top:14px"><div class="l"><h4>Dieser Monat</h4></div>
           <div class="m num">${rang.length} erfüllt${rang.length === 1 ? '' : 'en'} die Bedingung</div></div>
         ${podest}`
      : (eigene.length
          ? `<div class="tplates">${eigene.map(a => _titlePlateHtml(a, {keinDetail:true})).join('')}</div>`
          : emptyState('scroll', T.live
              ? 'Diese Bedingung erfüllt in diesem Monat noch niemand.'
              : 'Diese Bedingung hat in diesem Monat niemand erfüllt.'))}
  `);
  _bindChronikClicks(document.getElementById('sheet'));
}

function showChronicle(cid){
  const def = CHRONICLE_BY_ID[cid];
  if(!def) return;
  _sheetSetReopen(()=>showChronicle(cid));
  const t = titleTone(def.tone);
  // Ein Rekord ist ein Wettstreit, also zeigt sein Blatt ein Podest —
  // `.podest`/`.pod-karte` wie in der Ewigen Tafel [§C27]. Vorher stand hier
  // nur der Halter, und wer wie nah dran ist, stand nirgends.
  const rang = chronicleRang(cid);
  const h = chronicleHolders()[cid] || null;
  const halterN = h ? (h.pids || [h.pid]).length : 0;
  const verfolger = rang.slice(3);
  openSheet(`
    <h3>${esc(def.name)}</h3>
    <div class="sheet-sub">${esc(CHRON_KINDS[def.kind].label)}${
      halterN > 1 ? ' · punktgleich zu ' + halterN + '. gehalten' : ''}</div>
    <div class="chron-hero" style="--tt:${t.c};--ttr:${t.rgb}">
      <span class="ic">${svgI(def.ic)}</span>
      <span class="c">${esc(def.cond)}</span>
    </div>
    ${def.wie ? `<div class="tnote">${esc(def.wie)}</div>` : ''}
    ${rang.length
      ? `<div class="pp-sec-title" style="margin-top:14px"><div class="l"><h4>Die Tafel</h4></div>
           <div class="m num">${rang.length} erfüllt${rang.length === 1 ? '' : 'en'} die Bedingung</div></div>
         ${_chronPodestHtml(rang.map(r => ({pid:r.pid, wert:_chronKurz(r.ev), zeit:r.zeit})))}`
      : emptyState('scroll', 'Diesen Rekord hat noch niemand erreicht.')}
    ${verfolger.length ? `<div class="rek-verfolger">${verfolger.map((r, i) => {
      const p = pmap()[r.pid];
      return `<div class="rvf" data-tplayer="${esc(r.pid)}">
        <span class="p num">${i + 4}</span>
        ${p ? avHtml(p, 'width:21px;height:21px;font-size:9px;border-radius:7px') : ''}
        <span class="n">${esc(p ? p.name : '?')}</span>
        <span class="w num">${esc(_chronKurz(r.ev))}</span>
      </div>`;
    }).join('')}</div>` : ''}
  `);
  _bindChronikClicks(document.getElementById('sheet'));
}

// Der Beleg als Zahl: auf dem Podest ist neben einem 44-px-Wappen kein Platz
// für „27 von 49 Spielen um den letzten Ball · 55 %". Genommen wird das erste
// Zahlwort — dieselbe Zahl, die auch die Karte in der Liste groß zeigt.
function _chronKurz(ev){
  const s = String(ev || '').trim();
  const m = s.match(/^([+\u2212-]?\d[^\s]*(?:\s?%)?)/);
  return m ? m[1] : s;
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
// ── Chronik-Bausteine ────────────────────────────────────────────────
// Beide Blöcke gab es nur im Chronik-Blatt. Seit der Awards-Tab eigene
// Reiter für Rekorde und Chronik hat, brauchen zwei Orte dasselbe HTML —
// also steht es einmal hier und nicht zweimal fast gleich.

// Die Liga-Rekorde als Liste. `weit` schaltet auf die große Form für den
// Reiter: eigene Kachel je Rekord mit Beleg und Halter statt einer Zeile.
function ligaRekordeHtml(weit){
  const holders = chronicleHolders();
  const recs = CHRONICLES.filter(d => holders[d.id]);
  if(!recs.length) return '';
  if(!weit) return `
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
      Gleichstand allen, die ihn halten. Tippen zeigt die Bedingung.</div>`;
  // Die große Form: ein Rekord ist ein Besitz, also bekommt er eine Karte
  // mit Halter-Gesicht und Beleg — nicht nur einen Namen am Zeilenende.
  //
  // Vier Kammern statt einer Spalte. Fünfunddreißig Karten sahen alle gleich
  // aus, und „Der Fels" stand neben „Das Scheunentor", als wären es
  // dieselbe Aussage. CHRON_KINDS trennt sie längst — gezeigt wurde es nie:
  //
  //   KÖNNEN        Ein Schnitt, eine Quote über die ganze Laufbahn.
  //                 Er hat keinen Zeitpunkt, er gilt heute.
  //   BESTMARKEN    Ein Ereignis. Eine Serie, ein Elo-Tag, ein Gipfel —
  //                 an einem Datum passiert, und das steht dabei.
  //   FÜGUNGEN      Auslosung und letzter Ball [§C35]. Sie zeichnen
  //                 niemanden aus, sie gehören jemandem.
  //   SCHATTENSEITEN Dasselbe, nur andersherum.
  //
  // Deshalb trägt auch nicht jede Karte einen Zeitpunkt: ein Karrieren-
  // schnitt hat keinen. Eine erfundene Jahreszahl unter jedem Rekord wäre
  // schlechter als keine.
  const karte = (d) => {
    const h = holders[d.id];
    // Ein Rekord, den noch niemand geholt hat, wird GESTRICHELT gezeigt und
    // nicht weggelassen: weggelassen ist er unsichtbar, halbdurchsichtig
    // liest er sich als Fehler.
    if(!h) return `<div class="rek offen" data-chron="${esc(d.id)}">
      <div class="rek-ic">${svgI(d.ic)}</div>
      <div class="rek-b">
        <div class="rek-z1"><span class="rek-nt">${esc(d.name)}</span>
          <span class="rek-h"><span class="rek-hn">noch niemand</span></span></div>
        <div class="rek-ev">${esc(d.cond)}</div>
      </div>
    </div>`;
    const pids = (h.pids || [h.pid]).slice(0, 3);
    // Vier Töne statt der vollen Katalogpalette. Gold gehört Titeln und
    // Rekorden [§C25] — wenn aber fünfunddreißig Karten golden sind, sagt
    // Gold nichts mehr. Eine Fügung trägt deshalb Metall: sie ist kein
    // Können. Eine Schattenseite bleibt rot, die Richtung [§C25].
    const kl = d.kind === 'shame' ? ' schatten' : d.kind === 'fuegung' ? ' fuegung' : '';
    const zeit = h.zeit ? `<span class="rek-zeit">${esc(String(h.zeit))}</span>` : '';
    // Der Beleg beginnt fast immer mit seiner Zahl. Sie ist die Aussage der
    // Karte und stand bisher klein und grau unter dem Namen — als Letztes,
    // was man liest. Jetzt trägt sie die Karte, der Rest bleibt Metall.
    const ev = String(h.ev || '');
    const m = ev.match(/^([+\u2212-]?\d[^\s]*(?:\s?%)?)\s+(.*)$/);
    const beleg = m ? `<span class="rek-w">${esc(m[1])}</span> ${esc(m[2])}` : esc(ev);
    return `<div class="rek${kl}" data-chron="${esc(d.id)}">
      <div class="rek-ic">${svgI(d.ic)}</div>
      <div class="rek-b">
        <div class="rek-z1"><span class="rek-nt">${esc(d.name)}</span>
          <span class="rek-h">
            ${pids.map(pid => { const p = pmap()[pid];
              return p ? avHtml(p, 'width:21px;height:21px;font-size:9px;border-radius:7px') : ''; }).join('')}
            <span class="rek-hn">${esc(_chronHolderNames(h))}</span>
          </span></div>
        <div class="rek-ev num">${beleg}</div>
        ${zeit}
      </div>
    </div>`;
  };

  // ── Wer die Tafel hält ────────────────────────────────────────────
  // Die Frage, für die dieser Reiter da ist — und die er bisher nicht
  // beantwortet hat. Eine Säule je gewertetem Spieler; wer nichts hält,
  // steht gestrichelt da statt zu fehlen.
  const zaehl = rekordZaehlung();
  const maxN = Math.max(1, ...zaehl.map(z => z.n));
  const haltungen = zaehl.reduce((a, z) => a + z.n, 0);
  const leiste = zaehl.length ? `<div class="rek-besitz">
    <div class="rek-bk"><span class="l">Wer die Tafel hält</span>
      <span class="r num">${haltungen} Haltungen · ${recs.length} Rekorde</span></div>
    <div class="rek-saeulen">${zaehl.map(z => {
      const p = pmap()[z.pid];
      return `<span class="rek-sl${z.n ? '' : ' null'}" data-tplayer="${esc(z.pid)}">
        <span class="z num">${z.n}</span>
        <span class="b" style="height:${z.n ? (4 + z.n / maxN * 34).toFixed(1) : 3}px"></span>
        ${p ? avHtml(p, 'width:15px;height:15px;font-size:7px;border-radius:5px') : ''}
      </span>`;
    }).join('')}</div>
  </div>` : '';

  const gruppen = Object.keys(CHRON_KINDS)
    .sort((a, b) => CHRON_KINDS[a].ord - CHRON_KINDS[b].ord)
    .map(k => ({k, def:CHRON_KINDS[k], liste:CHRONICLES.filter(d => d.kind === k)}))
    .filter(g => g.liste.length);
  // Der Kammerfilter ist `.ui-tabs` — die innere Ebene unter dem gerahmten
  // `.ui-switch` des Reiters [§C27]. Ein drittes Bauteil für dieselbe
  // Aussage wäre eines zu viel.
  const filter = `<div class="ui-tabs rek-kammern">
    <button data-rekkammer="" class="${rekKammer ? '' : 'on'}">Alle</button>
    ${gruppen.map(g => `<button data-rekkammer="${esc(g.k)}"
      class="${rekKammer === g.k ? 'on' : ''}">${esc(g.def.kurz)}</button>`).join('')}
  </div>`;
  const sicht = gruppen.filter(g => !rekKammer || g.k === rekKammer);
  return leiste + filter + sicht.map(g => `
    <div class="rek-gruppe ${esc(g.k)}">
      <span class="rek-g-ic">${svgI(g.def.ic)}</span>
      <span class="rek-g-n">${esc(g.def.pl)}</span>
      <span class="rek-g-line"></span>
      <span class="rek-g-z num">${g.liste.length}</span>
    </div>
    <div class="rek-liste">${g.liste.map(karte).join('')}</div>`).join('');
}

// Die Saison-Matrix: Zeilen sind Spieler, Spalten Monate, Zellen Titel.
function ligaChronikMatrixHtml(){
  const all = allSeasonTitles();           // neueste zuerst
  const cols = all.slice(0, 8).reverse();  // älteste links, wie eine Zeitleiste
  if(!cols.length) return '';
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
  return `
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
    <div class="tnote">Gestrichelt = laufende Saison, noch nicht entschieden. Tippen öffnet den Monat.</div>`;
}

// Ans rechte Ende scrollen: die jüngste Saison interessiert am meisten,
// ältere holt man sich durch Wischen nach rechts. Nur bei echtem Überlauf —
// bei vier Saisons passt alles aufs Handy, und ein halb abgeschnittener
// erster Monat sähe nach Fehler aus statt nach Absicht.
function chronikMatrixScrollen(root){
  const lw = (root || document).querySelector('.lchron-wrap');
  if(lw && lw.scrollWidth > lw.clientWidth + 24) lw.scrollLeft = lw.scrollWidth;
}

function showLigaChronik(){
  _sheetSetReopen(()=>showLigaChronik());
  const all = allSeasonTitles();
  const cols = all.slice(0, 8);
  const holders = chronicleHolders();
  const recs = CHRONICLES.filter(d => holders[d.id]);
  const recHtml = ligaRekordeHtml(false);
  const matrix = ligaChronikMatrixHtml();

  if(!matrix){
    openSheet(`<h3>Liga-Chronik</h3>
      <div class="sheet-sub">${recs.length ? recs.length + ' Liga-Rekorde · noch keine Saison mit Chronik' : 'Noch keine Saison mit Chronik'}</div>
      ${recHtml || emptyState('scroll','Sobald ein Monat gespielt ist, füllt sich die Chronik.')}`);
    _bindChronikClicks(document.getElementById('sheet'));
    return;
  }
  const total = cols.reduce((n,T) => n + T.awarded.length, 0);
  openSheet(`
    <h3>Liga-Chronik</h3>
    <div class="sheet-sub num">${cols.length} Saison${cols.length===1?'':'s'} · ${total} Einträge · ${recs.length} Rekorde</div>
    ${matrix}
    ${recHtml}
  `);
  chronikMatrixScrollen(document.getElementById('sheet'));
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
  root.querySelectorAll('[data-tdisz]').forEach(el => {
    el.onclick = (e) => { e.stopPropagation();
      sheetNav(()=>showDisziplin(el.dataset.tdisz, el.dataset.tsid || null)); };
  });
  root.querySelectorAll('[data-chron]').forEach(el => {
    el.onclick = (e) => { e.stopPropagation(); sheetNav(()=>showChronicle(el.dataset.chron)); };
  });
  // Das Insignium im Profilkopf ist selbst der Knopf zur Laufbahn [§13.10].
  root.querySelectorAll('[data-prestige]').forEach(el => {
    el.style.cursor = 'pointer';
    el.onclick = (e) => { e.stopPropagation(); sheetNav(()=>showLaufbahn(el.dataset.prestige)); };
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
// Rendert die Marken: nur Icons im Ton der Auszeichnung, mit leichtem Schein
// und optionaler Anzahl. Kein Kasten, kein Rahmen — neben einem Namen soll das
// wie eine Auszeichnung wirken, nicht wie ein Button. Der laufende Titel
// bekommt einen gestrichelten Ring: noch nicht entschieden.
// opts.ohneChamp — die Meistertitel stehen seit [§C26] als Sterne am Avatar.
// Wo das Zeichen läuft, wäre die Krone daneben dieselbe Aussage zweimal.
// In einer Rangliste steht die Marke ohne Beschriftung neben dem Namen. Dort
// heißt sie nur „hält gerade einen Titel" — und das ist nach dem Farbgesetz
// [§C25] Gold. Der Disziplinton hilft erst dort, wo der Name danebensteht:
// in der Chronik und im Profil. `einfarbig` unterscheidet die beiden Fälle.
function _titleMarkHtml(pid, size, opts){
  let marks = _playerRankMarks(pid);
  if(opts && opts.ohneChamp) marks = marks.filter(b => b.kind !== 'champ');
  if(!marks.length) return '';
  return marks.map(b => {
    // `einfarbig` heißt zwei Töne, nicht einer: in der Rangliste steht kein
    // Name neben der Marke, dort soll sie nur sagen „hält gerade einen
    // Titel". Was für ein Titel, verrät erst das Profil — außer es ist eine
    // Schattenseite. Die trägt Rot, sonst hieße eine Flaute dasselbe wie ein
    // Meistertitel. Der Katalog gibt Schattenseiten durchweg tone:'red'.
    const t = (opts && opts.einfarbig)
      ? (b.tone === 'red' ? TITLE_TONES.red : TITLE_TONES.gold)
      : titleTone(b.tone);
    const cls = 'tmark' + (b.live ? ' live' : '') + (b.n > 2 ? ' honor' : '')
              + (size === 'lg' ? ' lg' : '') + (b.tone === 'red' ? ' schatten' : '');
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
// Der Ring hatte fuenf Farben fuer sieben Zustaende — Gold, Orange, Rot,
// Lila, Blau — und damit keine Aussage: man musste die Legende kennen, um
// ihn zu lesen. Nach dem Farbgesetz [§C25] gibt es hier nur drei:
//   Gold  — eine Auszeichnung, die derjenige HEUTE traegt
//   Gruen — ein Lauf, der gerade gut geht
//   Rot   — ein Lauf, der gerade schlecht geht
// Damit sagt schon die Farbe, ob der Ring ein Lob oder eine Warnung ist.
const AV_RINGS = {
  champ: {prio:92, tone:'gold', ic:'crown',       label:'Titelverteidiger'},
  blaze: {prio:88, tone:'acid', ic:'flameTriple', label:'Siegesserie'},
  abyss: {prio:86, tone:'red',  ic:'dropTriple',  label:'Niederlagenserie'},
  potw:  {prio:80, tone:'gold', ic:'weekKing',    label:'Player of the Week'},
  hot:   {prio:74, tone:'acid', ic:'flame',       label:'Siegesserie'},
  cold:  {prio:72, tone:'red',  ic:'drop',        label:'Niederlagenserie'},
  tots:  {prio:64, tone:'gold', ic:'duo',         label:'Team of the Season'},
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
  // [§C25] Eine Seite, eine Farbe: die Siegesserie trägt im Profil die
  // Rangfarbe, weil dort schon die Flamme in ihr brennt. Gold bleibt den
  // Titeln, Rot der Niederlagenserie — beides sind eigene Aussagen.
  const streak = (r.kind === 'blaze' || r.kind === 'hot');
  const t = streak ? {c:'var(--ak)', rgb:'var(--ak-rgb)'} : titleTone(r.tone);
  return `<div class="pp-ring-chip" style="--tt:${t.c};--ttr:${t.rgb}">
    <span class="i">${svgI(r.ic)}</span>
    <b>${esc(r.label)}</b><span class="s num">${esc(r.sub)}</span>
  </div>`;
}

