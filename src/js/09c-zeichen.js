// ╔═══ §4.1b ─── DAS ZEICHEN ───────────────────────────────────────────╗
//     Der Avatar trägt genau zwei Aussagen, mehr nicht:
//
//       STERNE UNTEN  — Ligatitel. Ein Stern je gewonnener Saison.
//                       Gold. Bleibt für immer.
//       FEUER HINTEN  — die laufende Siegesserie. Ab 3 Siegen. Es liegt
//                       hinter dem Avatar und schlägt nach oben. Eine
//                       Niederlage löscht es.
//
//     Regeln, die das zusammenhalten:
//       · Der Avatar selbst bleibt, wie er ist — keine Ringfarbe je Rang.
//         Zwölf Spieler wären sonst zwölf Farbentscheidungen in einer Liste.
//       · Das Feuer ist durchscheinend (opacity < 1) und bewegt sich als
//         STOP-MOTION: zwei bzw. drei feste Bilder, die sich abwechseln.
//         Kein Tweening, kein JS-Timer, kein Repaint der Zeile.
//       · Detail folgt der Größe: unter 26 px weder Sterne noch Feuer.
//       · Im Profil trägt das Feuer die Rangfarbe (--ak) statt Orange —
//         dort gilt „eine Seite, eine Farbe" [§C25].
//
//     Die Bilder hängen nicht am Spieler, nur an der Stufe. Deshalb werden
//     sie EINMAL beim Laden gebaut und danach als fertiger String verteilt.
// ╚═════════════════════════════════════════════════════════════════════════╝

const ZN_RAD = Math.PI/180;
const _znF = n => (+n).toFixed(1);
// Alles rechnet um den Avatarmittelpunkt (50|60) einer 100er-Box.
const _znPol = (r,a) => [50 + r*Math.cos(a*ZN_RAD), 60 + r*Math.sin(a*ZN_RAD)];

// Eine Flammenzunge. Sie steht NICHT radial vom Avatar ab — sie zieht zur
// Senkrechten, so wie Feuer nach oben schlägt. `bias` sagt, wie stark: bei 0
// zeigt sie nach außen, bei 1 senkrecht nach oben. Die beiden Kontrollpunkte
// sind absichtlich unsymmetrisch, damit die Zunge züngelt statt zu stechen.
function _znZunge(a, h, bias, w, sway){
  const R = 30;
  const hoch = (-90 - a);
  const b0 = _znPol(R, a - w);
  const b1 = _znPol(R, a + w);
  const t  = _znPol(R + h, a + hoch*bias + sway);
  const c0 = _znPol(R + h*0.66, a - w*1.05 + hoch*bias*0.46);
  const c1 = _znPol(R + h*0.34, a + w*0.42 + hoch*bias*0.78);
  return `M${_znF(b0[0])} ${_znF(b0[1])}`
       + `Q${_znF(c0[0])} ${_znF(c0[1])} ${_znF(t[0])} ${_znF(t[1])}`
       + `Q${_znF(c1[0])} ${_znF(c1[1])} ${_znF(b1[0])} ${_znF(b1[1])}Z`;
}

// Das Bett: ein Band, das den Avatar von hinten umschließt. Ohne das stünden
// die Zungen wie Stacheln einzeln da; damit sitzen sie auf einer Glut.
function _znBett(ri, ra, a0, a1){
  const l0 = _znPol(ra, a0), r0 = _znPol(ra, a1);
  const l1 = _znPol(ri, a0), r1 = _znPol(ri, a1);
  return `M${_znF(l0[0])} ${_znF(l0[1])}A${ra} ${ra} 0 0 1 ${_znF(r0[0])} ${_znF(r0[1])}`
       + `L${_znF(r1[0])} ${_znF(r1[1])}A${ri} ${ri} 0 0 0 ${_znF(l1[0])} ${_znF(l1[1])}Z`;
}

// Deterministisches Rauschen — dieselbe Stufe zeigt bei jedem Aufruf
// dieselben Bilder. Ein Math.random() hier würde die Zeile bei jedem
// Neuzeichnen anders aussehen lassen.
function _znRausch(i, frame){
  const x = Math.sin((i+1)*12.9898 + (frame+1)*78.233) * 43758.5453;
  return x - Math.floor(x);
}

// Ein Einzelbild: das Bett plus n Zungen über dem oberen Bogen, in der Mitte
// am längsten. Die Zungen überlappen sich am Fuß — deshalb w > step/2.
function _znBild(stufe, frame){
  // Der Bogen bleibt bewusst schmal: in einer Ranglistenzeile steht direkt
  // rechts vom Avatar der Name. Ein Feuer, das seitlich ausgreift, läge über
  // der Schrift. Es schlägt deshalb nach oben, nicht in die Breite.
  const cfg = [null,
    {n:7, h:18, w:13, bias:0.42, ra:31},
    {n:8, h:26, w:12, bias:0.48, ra:32},
    {n:9, h:34, w:11, bias:0.54, ra:33}][stufe];
  const von = -152, bis = -28, step = (cfg.n>1 ? (bis-von)/(cfg.n-1) : 0);
  let d = _znBett(22, cfg.ra, -166, -14);
  for(let i=0;i<cfg.n;i++){
    const a = von + i*step;
    // Die Mitte oben brennt am höchsten, die Seiten laufen aus.
    const bogen = 0.40 + 0.60*Math.cos((a+90)*ZN_RAD);
    const jit   = 0.66 + 0.62*_znRausch(i, frame);
    const sway  = (_znRausch(i+40, frame) - 0.5) * 22;
    d += _znZunge(a, cfg.h*bogen*jit, cfg.bias, cfg.w, sway);
  }
  return d;
}

// Die drei Stufen als fertige SVG-Strings. Die Bilder hängen nicht am
// Spieler, nur an der Stufe — deshalb einmal beim Laden bauen und danach
// als fertigen String verteilen. Frame 1 ist zugleich das Standbild für
// prefers-reduced-motion.
const ZN_FEUER = (function(){
  const out = [''];
  for(let st=1; st<=3; st++){
    const frames = st>=3 ? 3 : 2;
    let g = '';
    for(let fr=0; fr<frames; fr++){
      g += `<path class="zf f${fr+1}" d="${_znBild(st, fr)}"/>`;
    }
    out.push(`<svg class="zn-fx" viewBox="0 0 100 100" aria-hidden="true" focusable="false">${g}</svg>`);
  }
  return out;
})();

// Ein Stern, um (cx|cy) mit Außenradius r.
function _znStern(cx, cy, r){
  let d = '';
  for(let i=0;i<10;i++){
    const rr = i%2 ? r*0.45 : r, a = -90 + i*36;
    d += (i?'L':'M') + _znF(cx + rr*Math.cos(a*ZN_RAD)) + ' ' + _znF(cy + rr*Math.sin(a*ZN_RAD));
  }
  return d + 'Z';
}

// Das Titelband: n Sterne in einer Reihe, unterhalb des Avatars.
// Ab sechs Titeln wird nicht weitergezählt — fünf Sterne plus Ziffer.
const _ZN_STERNE_CACHE = {};
function _znSterneSvg(n){
  if(n <= 0) return '';
  if(_ZN_STERNE_CACHE[n]) return _ZN_STERNE_CACHE[n];
  const zeig = Math.min(n, 5);
  const w = 9, r = 3.6, h = 10;
  let d = '';
  for(let i=0;i<zeig;i++) d += _znStern(w/2 + i*w, h/2, r);
  const breite = zeig*w + (n>5 ? 11 : 0);
  const zahl = n>5
    ? `<text x="${zeig*w+1}" y="${h/2+2.6}" class="zn-ti-n">${n}</text>` : '';
  const svg = `<span class="zn-ti" aria-hidden="true"><svg viewBox="0 0 ${breite} ${h}"
    width="${breite}" height="${h}" focusable="false"><path class="zs-k" d="${d}"/>
    <path class="zs" d="${d}"/>${zahl}</svg></span>`;
  _ZN_STERNE_CACHE[n] = svg;
  return svg;
}

// ─── Die beiden Zahlen, aus denen ein Zeichen entsteht ───────────────
// Ligatitel: abgeschlossene Saisons, die dieser Spieler gewonnen hat.
// Die laufende Saison zählt nicht — sie ist noch nicht gewonnen.
// Eine Liga-Meisterschaft ist Platz 1 einer ABGESCHLOSSENEN Saison — dieselbe
// Quelle, aus der die Krone neben dem Namen kam [§13.7]. Einmal für die ganze
// Liga gezählt und gecacht: die Rangliste fragt pro Zeile.
function _znTitelMap(){
  const key = matches.length + '_' + _cache.version;
  if(_cache._znTitelKey === key) return _cache._znTitel;
  const out = {};
  try {
    const cur = currentSeason().id;
    seasons.forEach(s => {
      if(s.id === cur) return;
      const c = seasonChampion(s.id);
      if(c) out[c] = (out[c] || 0) + 1;
    });
  } catch(e){ /* Sterne sind Zierde — sie dürfen die Liste nie kippen. */ }
  _cache._znTitelKey = key;
  _cache._znTitel = out;
  return out;
}
function znTitel(pid){
  try { return _znTitelMap()[pid] || 0; } catch(e){ return 0; }
}
// Feuerstufe: 3–4 Glut, 5–6 Flamme, ab 7 Lodern.
function znFeuer(pid){
  try {
    const cs = getGlobalSim().curStreak[pid] || 0;
    return cs >= 7 ? 3 : cs >= 5 ? 2 : cs >= 3 ? 1 : 0;
  } catch(e){ return 0; }
}
function znStreak(pid){
  try { return getGlobalSim().curStreak[pid] || 0; } catch(e){ return 0; }
}

// ─── Die Hülle ───────────────────────────────────────────────────────
// innerHtml ist der fertige Avatar (`.av …`). Wir legen nur Feuer davor
// und Sterne darunter — beide absolut positioniert, damit sich am Layout
// der Zeile nichts ändert.
//   opts.px     — Kantenlänge des Avatars in px (steuert Detailstufe)
//   opts.titel  — Titelzahl überschreiben (Recaps zeigen historische Stände)
//   opts.feuer  — Feuerstufe überschreiben
//   opts.rang   — true: Feuer in Rangfarbe (--ak) statt Orange
function znWrap(pid, innerHtml, opts){
  opts = opts || {};
  const px = opts.px || 40;
  if(px < 26) return innerHtml;              // Detail folgt der Größe
  const t  = opts.titel !== undefined ? opts.titel : znTitel(pid);
  const f  = opts.feuer !== undefined ? opts.feuer : znFeuer(pid);
  if(!t && !f) return innerHtml;             // nichts zu erzählen
  const cls = 'zn' + (f ? ' zn-l'+f : '') + (opts.rang ? ' zn-rang' : '')
            + (opts.klasse ? ' '+opts.klasse : '');
  const titel = ` title="${esc(
      [t ? t + (t===1?' Ligatitel':' Ligatitel') : '',
       f ? znStreak(pid) + ' Siege in Folge' : ''].filter(Boolean).join(' · '))}"`;
  return `<span class="${cls}"${titel}>${f?ZN_FEUER[f]:''}${innerHtml}${_znSterneSvg(t)}</span>`;
}
