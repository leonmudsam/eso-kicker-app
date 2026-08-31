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
// Deckel für die längste Flammenspitze, in Zeichen-Einheiten ab Avatarmitte.
const ZN_SPITZE = 51;
const _znF = n => (+n).toFixed(1);
// Alles rechnet um den Avatarmittelpunkt (50|60) einer 100er-Box.
const _znPol = (r,a) => [50 + r*Math.cos(a*ZN_RAD), 60 + r*Math.sin(a*ZN_RAD)];

// Eine Flammenzunge. Sie steht NICHT radial vom Avatar ab — sie zieht zur
// Senkrechten, so wie Feuer nach oben schlägt. `bias` sagt, wie stark: bei 0
// zeigt sie nach außen, bei 1 senkrecht nach oben. Die beiden Kontrollpunkte
// sind absichtlich unsymmetrisch, damit die Zunge züngelt statt zu stechen.
function _znZunge(a, h, bias, w, sway){
  // Der Fuß liegt UNTER der Avatarkante (30), nicht daneben: der Avatar
  // deckt ihn zu, also wächst die Zunge sichtbar hinter ihm hervor statt
  // mit einer eigenen Kante daneben anzusetzen.
  const R = 28.5;
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
  // Ab Stufe 3 umschließt die Glut mehr als einen Halbkreis — dann muss das
  // large-arc-Flag stehen, sonst zeichnet der Bogen die kurze Seite.
  const gross = (a1 - a0) > 180 ? 1 : 0;
  return `M${_znF(l0[0])} ${_znF(l0[1])}A${ra} ${ra} 0 ${gross} 1 ${_znF(r0[0])} ${_znF(r0[1])}`
       + `L${_znF(r1[0])} ${_znF(r1[1])}A${ri} ${ri} 0 ${gross} 0 ${_znF(l1[0])} ${_znF(l1[1])}Z`;
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
function _znBild(stufe, frame, kern){
  // Der Bogen ist die eigentliche Stufe. Das kleine Feuer sitzt als Kranz oben
  // auf; das größte greift unter die Waagerechte und schließt den Avatar von
  // hinten ein. Die Höhe wächst mit, ist aber gedeckelt: ein Feuer, das nach
  // oben davonläuft, stünde in der Zeile darüber.
  //
  // Maßstab: 30 Einheiten = halbe Avatarbreite (siehe .zn-fx in 15-zeichen.css).
  // ZN_SPITZE ist die längste erlaubte Spitze ab Mitte. 49 Einheiten sind bei
  // einem 40er Avatar 32,7 px, also 12,7 px über der Avatarkante — und damit
  // innerhalb der 14 px, die eine Ranglistenzeile über dem Avatar hat
  // (13 px Innenabstand plus Rahmen). Nachgemessen wird das am gerenderten
  // Markup, nicht am Zahlenwert.
  const cfg = [null,
    {n:11, h:11.0, w:9.0, bias:0.40, ra:33, von:-153, bis:-27},
    {n:13, h:15.0, w:9.0, bias:0.46, ra:34, von:-172, bis: -8},
    {n:17, h:19.5, w:8.5, bias:0.52, ra:35, von:-196, bis: 16}][stufe];
  const step = (cfg.n>1 ? (cfg.bis-cfg.von)/(cfg.n-1) : 0);
  // Das Glutbett endet GENAU an der Avatarkante (30). Es lag vorher bis zu
  // 33 Einheiten draußen, und an den Bogenenden — dort, wo der Kosinus fast
  // 1 ist — stand es damit seitlich über den Avatar hinaus. Das waren die
  // beiden Hörner links und rechts. Sein Zweck ist ohnehin nur, die Füße der
  // Zungen zu verbinden; die liegen bei 28,5 und damit unter dem Avatar.
  //
  // Der Kern ist dieselbe Zeichnung, nur kürzer: außen die Hülle, innen die
  // hellere Glut. Ein Feuer aus einer einzigen Fläche bleibt eine Silhouette.
  const k = kern ? 0.52 : 1;
  // 29,8 statt glatt 30: ab Stufe 3 läuft der Bogen über die Waagerechte
  // hinweg und berührt damit die Avatarkante exakt — beim Runden steht er
  // dann doch einen Hauch daneben. Das Bett liegt ohnehin unter dem Avatar.
  let d = _znBett(26, 29.8, cfg.von, cfg.bis);
  for(let i=0;i<cfg.n;i++){
    const a = cfg.von + i*step;
    // Die Länge hängt an der STELLE IM BOGEN, nicht am Kosinus: an beiden
    // Enden geht sie gegen null, in der Mitte ist sie voll. Vorher blieb
    // über den Kosinus ein Sockel von 22 % stehen — an den Flanken standen
    // dadurch kurze, waagerechte Zungen neben dem Avatar, die aussahen, als
    // gehörten sie nicht dazu. Jetzt läuft der Kranz aus, und was übrig
    // bleibt, zeigt nach oben.
    const t     = (i + 0.5) / cfg.n;
    const form  = Math.pow(Math.sin(Math.PI * t), 1.05);
    // Stark gestreut und zum Kurzen hin verzerrt: so ragen einzelne Zungen
    // deutlich heraus, statt dass alle gleich lang eine Kuppel bilden.
    const jit   = 0.40 + 1.15*Math.pow(_znRausch(i, frame), 1.5);
    // Auch das Schwanken läuft an den Enden aus — sonst kippt die letzte
    // Zunge nach außen und stellt sich quer.
    const sway  = (_znRausch(i+40, frame) - 0.5) * 24 * form;
    // Zwei Deckel. Der erste ist die Zeilenhöhe (ZN_SPITZE), der zweite die
    // Avatarbreite: eine Zunge bei Winkel a reicht waagerecht bis
    // (28,5 + h)·|cos a|, und mehr als 30 — die halbe Avatarbreite — darf das
    // nie werden. Damit ist „steht seitlich nicht über den Avatar hinaus"
    // eine Eigenschaft der Rechnung und nicht eine Frage der eingestellten
    // Bogenweite. Oben, wo cos gegen 0 geht, greift nur noch ZN_SPITZE.
    const c     = Math.abs(Math.cos(a*ZN_RAD));
    // 29,4 statt 28,5: die Zunge ist keine Linie, sie hat Breite und zwei
    // Kontrollpunkte, die etwas ausbeulen. Der halbe Punkt Zugabe deckt das.
    const breit = c > 1e-3 ? (30/c - 29.4) : Infinity;
    const h     = Math.max(0, Math.min(cfg.h*form*jit, ZN_SPITZE - 31, breit)) * k;
    d += _znZunge(a, h, cfg.bias, cfg.w, sway);
  }
  return d;
}

const ZN_FEUER = (function(){
  const out = [''];
  for(let st=1; st<=3; st++){
    const frames = st>=3 ? 3 : 2;
    let g = '';
    // Erst alle Hüllen, dann alle Kerne — die Malreihenfolge entscheidet,
    // was obenauf liegt. Die Bildklassen bleiben dieselben, damit Hülle und
    // Kern von derselben Stop-Motion geschaltet werden.
    for(let fr=0; fr<frames; fr++) g += `<path class="zf f${fr+1}" d="${_znBild(st, fr, 0)}"/>`;
    for(let fr=0; fr<frames; fr++) g += `<path class="zf zk f${fr+1}" d="${_znBild(st, fr, 1)}"/>`;
    out.push(`<svg class="zn-fx" viewBox="0 0 100 100" aria-hidden="true" focusable="false">${g}</svg>`);
  }
  return out;
})();

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
// Drei Stufen, nicht eine: eine Serie von drei und eine von zehn sind nicht
// dasselbe, und genau das soll man von weitem sehen. Die Stufe steuert Bogen,
// Höhe, Takt und Deckkraft — nachzulesen in _znBild und 15-zeichen.css.
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
// Der Vorlesetext ist an beiden Stellen derselbe.
function _znTitelTxt(t, f, pid){
  return [t ? t + ' Ligatitel' : '',
          f ? znStreak(pid) + ' Siege in Folge' : ''].filter(Boolean).join(' · ');
}

// ─── Der Avatar im Wappen [§C27] ─────────────────────────────────────
// Dieselbe Anatomie wie auf dem Podest der Ewigen Tafel, nur in jeder
// Größe: Feuer hinten, Wappen als Rahmen, Avatar in der Mitte, Sterne
// davor. Das Wappen ohne Band — Schwingen und Schild brauchen Höhe, die
// eine Listenzeile nicht hat; in der Zeile zählt der Reif.
// Alle Maße rechnen in CSS aus --rav, damit ein Wappen in der Zeile
// dieselben Verhältnisse hat wie eines auf dem Podest.
function insAvWrap(pid, innerHtml, opts){
  opts = opts || {};
  const px = opts.px || 52;
  const t = opts.titel !== undefined ? opts.titel : znTitel(pid);
  const f = opts.feuer !== undefined ? opts.feuer : znFeuer(pid);
  const ins = insigniumSvg(pid, {band:false});
  const cls = 'rav zn' + (f ? ' zn-l'+f : '') + (opts.klasse ? ' '+opts.klasse : '');
  return `<span class="${cls}" style="--rav:${px}px"`
    + ` title="${esc(_znTitelTxt(t, f, pid))}">`
    + (f ? ZN_FEUER[f] : '') + ins + innerHtml + _znSterneSvg(t) + '</span>';
}

function znWrap(pid, innerHtml, opts){
  opts = opts || {};
  const px = opts.px || 40;
  if(px < 26) return innerHtml;              // Detail folgt der Größe
  const t  = opts.titel !== undefined ? opts.titel : znTitel(pid);
  const f  = opts.feuer !== undefined ? opts.feuer : znFeuer(pid);
  if(!t && !f) return innerHtml;             // nichts zu erzählen
  const cls = 'zn' + (f ? ' zn-l'+f : '') + (opts.rang ? ' zn-rang' : '')
            + (opts.klasse ? ' '+opts.klasse : '');
  const titel = ` title="${esc(_znTitelTxt(t, f, pid))}"`;
  return `<span class="${cls}"${titel}>${f?ZN_FEUER[f]:''}${innerHtml}${_znSterneSvg(t)}</span>`;
}
