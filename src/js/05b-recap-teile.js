// ╔═══ §C31 ─── DIE BAUTEILE DER RÜCKBLICKE ────────────────────────────╗
//     Drei Rückblicke: Saison, Woche, Tag. Vorher hatte jeder seinen
//     eigenen Bauplan — der Saison-Rückblick .rcp-*-Klassen, die beiden
//     anderen mehrere hundert Inline-Styles. Derselbe Spieler sah damit in
//     drei Rückblicken dreimal anders aus, und in keinem trug er sein
//     Wappen [§C27].
//
//     Hier steht jedes Bauteil genau einmal. Die Rückblicke unterscheiden
//     sich nur noch in dem, was sie hineinreichen: Zeitraum, Zahlen,
//     Abschnitte. Wer eins von ihnen ändert, ändert alle drei — das ist
//     der Zweck.
// ╚═════════════════════════════════════════════════════════════════════╝

// Eckdaten aus Teilen, die es geben kann oder nicht („12 Matches · 8 Spieler").
function rcpMeta(teile){ return teile.filter(Boolean).join(' · '); }

// Der Kopf. Die Marke ist immer Gold: Saison-Sieger, Spieler der Woche und
// Spieler des Tages sind Titel, und Gold gehört den Titeln [§C25]. Vorher
// war sie zweimal grün und einmal gold — dieselbe Aussage in zwei Farben.
function rcpKopfHtml(o){
  return `<div class="rcp-head">
    <span class="rcp-label">${svgI(o.ic || 'trophy')}${esc(o.marke)}</span>
    <div class="rcp-month">${esc(o.titel)}</div>
    ${o.meta ? `<div class="rcp-meta">${esc(o.meta)}</div>` : ''}
    ${o.extra || ''}
  </div>`;
}

// Der Avatar eines Rückblicks — mit Wappen, wie überall sonst [§C27].
// `pos` und `titel` gehören zum ZEITRAUM und nicht zu heute: der Schild
// zeigt den Platz, den er in DIESEM Zeitraum belegt hat, die Schwingen die
// Titel bis dahin. Ohne die beiden stünde im Mai-Rückblick der Auguststand.
// Kein Feuer: ein abgeschlossener Zeitraum hat keine laufende Serie [§C26].
function rcpAvHtml(pid, px, o){
  o = o || {};
  const p = pmap()[pid];
  if(!p) return `<span class="rcp-av leer" style="--rav:${px}px">?</span>`;
  const em = p.avatar_id ? avatarEmoji(p.avatar_id) : null;
  const inner = em
    ? `<span class="av av-emoji"><span class="em">${em}</span></span>`
    : `<span class="av" style="background:${avColor(pid)}">${esc(initials(p.name))}</span>`;
  // Detail folgt der Größe: unter etwa 48 px bleibt vom Wappen nur ein Rand.
  if(px < 48) return `<span class="rcp-av" style="--rav:${px}px">${inner}</span>`;
  return insAvWrap(pid, inner, {px:px, band:!!o.band, pos:o.pos, titel:o.titel,
                                feuer:0, klasse:o.klasse});
}

// Zwei Avatare als Paar. Ein Duo hat keinen Rang, also auch kein Wappen —
// zwei überlappende Chips, wie in jeder Duo-Tabelle.
function rcpPaarHtml(ids, px){
  return `<span class="rcp-paar" style="--rav:${px}px">${
    ids.slice(0, 3).map(id => rcpAvHtml(id, px, {})).join('')}${
    ids.length > 3 ? `<span class="rcp-av mehr" style="--rav:${px}px">+${ids.length - 3}</span>` : ''
  }</span>`;
}

// Der Held: die eine Person, um die der Rückblick geht. Eine Karte für alle
// drei — vorher war es einmal eine Goldkarte und zweimal eine nackte Spalte.
// `pids` mit mehr als einem Eintrag heißt geteilter Titel: dann das Paar,
// denn ein geteilter Titel gehört keinem allein.
function rcpHeldHtml(o){
  const ids = o.pids && o.pids.length ? o.pids : [o.pid];
  const ein = ids.length === 1;
  // Das Banner (Schwingen und Schild) nur dort, wo Titel und Ligaposition
  // zur Sache gehören — im Saison-Rückblick. In Woche und Tag stünde im
  // Schild eine Ligaposition, die mit dem Zeitraum nichts zu tun hat.
  const band = o.band !== false;
  const av = ein ? rcpAvHtml(ids[0], o.px || 104, {band:band, pos:o.pos, titel:o.titel})
                 : rcpPaarHtml(ids, 64);
  const namen = ids.map(pname).join(' & ');
  const abzeichen = ein ? rankBadgeHtml(ids[0], 'sm') : '';
  return `<div class="rcp-held${ein ? ' klick' : ''}"${
      ein ? ` data-detail="${esc(ids[0])}"` : ''}>
    <div class="rcp-held-label">${esc(o.marke)}</div>
    <div class="rcp-held-av${ein && band ? ' band' : ''}">${av}</div>
    <div class="rcp-held-n">${esc(namen)}</div>
    ${abzeichen ? `<div class="rcp-held-rang">${abzeichen}</div>` : ''}
    ${o.zahlen || ''}
  </div>`;
}

// Die Zahlenleiste. `ton` färbt einen Wert — und zwar nur dann, wenn die
// Farbe eine Richtung meint (Elo-Zuwachs grün, Verlust rot) oder einen
// Titel (gold). Alles andere bleibt Metall [§C25].
function rcpZahlenHtml(zellen){
  return `<div class="rcp-z">${zellen.filter(Boolean).map(z =>
    `<div class="rcp-z-s"><div class="rcp-z-v${z.ton ? ' ' + z.ton : ''} num">${
      esc(String(z.v))}</div><div class="rcp-z-l">${esc(z.l)}</div></div>`).join('')}</div>`;
}

// Eine Abschnittsüberschrift. `n` ist die Zahl rechts — nur setzen, wenn sie
// etwas sagt, das die Liste darunter nicht schon zeigt.
function rcpAbschnitt(t, n){
  return `<div class="rcp-section">${esc(t)}${
    n ? `<span class="rcp-section-n num">${esc(String(n))}</span>` : ''}</div>`;
}

// Eine Kachel: Auszeichnung, Höhepunkt, Rekord. `leer` zeigt sie gestrichelt
// statt halbdurchsichtig — ein leeres Feld liest sich sonst als Fehler.
function rcpKachelHtml(o){
  if(o.leer) return `<div class="rcp-aw leer">
    <div class="rcp-aw-ic">${svgI(o.ic || 'trophy')}</div>
    <div class="rcp-aw-info">
      <div class="rcp-aw-label">${esc(o.label)}</div>
      <div class="rcp-aw-name">–</div>
      <div class="rcp-aw-val">keine Daten</div>
    </div>
  </div>`;
  return `<div class="rcp-aw ${o.ton || 'gold'}${o.attr ? ' klick' : ''}" ${o.attr || ''}>
    <div class="rcp-aw-ic">${svgI(o.ic || 'trophy')}</div>
    <div class="rcp-aw-info">
      <div class="rcp-aw-label">${esc(o.label)}</div>
      <div class="rcp-aw-name">${esc(o.name)}</div>
      <div class="rcp-aw-val">${esc(o.wert || '')}</div>
    </div>
  </div>`;
}

// Eine Spielerzeile: Platz, Avatar, Name, zwei Zahlen. Die Rangliste unter
// dem Podest besteht daraus, und die Rekordliste ebenso.
function rcpZeileHtml(o){
  return `<div class="rcp-rest-row${o.attr ? ' klick' : ''}" ${o.attr || ''}>
    ${o.rang !== undefined ? `<div class="rcp-rest-rank num">${esc(String(o.rang))}</div>` : ''}
    ${rcpAvHtml(o.pid, o.px || 32, {})}
    <div class="rcp-rest-tx">
      <div class="rcp-rest-name">${esc(o.name !== undefined ? o.name : pname(o.pid))}</div>
      ${o.sub ? `<div class="rcp-rest-sub">${esc(o.sub)}</div>` : ''}
    </div>
    <div class="rcp-rest-stats">
      ${o.links ? `<div class="rcp-rest-wl num">${esc(o.links)}</div>` : ''}
      ${o.rechts ? `<div class="rcp-rest-elo num">${esc(o.rechts)}</div>` : ''}
    </div>
  </div>`;
}

// Ein Hinweisstreifen unter dem Helden: die Serie, der Positionsverlauf.
// Eine Zeile, ein Symbol, ein Satz — mehr trägt die Stelle nicht.
// Der Pfeil ist CSS (.klick::after) und kein Symbol: er sagt „hier geht es
// weiter", nicht „hier steht etwas". Als Icon hätte er in jeder Kachel und
// jeder Zeile einzeln gepflegt werden müssen.
function rcpNotizHtml(o){
  return `<div class="rcp-notiz${o.attr ? ' klick' : ''}" ${o.attr || ''}>
    <span class="rcp-notiz-ic">${svgI(o.ic)}</span>
    <span class="rcp-notiz-tx">${o.text}</span>
  </div>`;
}
