// ╔═══ §13.11 ─── DER FINGERABDRUCK ────────────────────────────────────╗
//     Sechs Achsen, sechs Perzentile, ein Vieleck. Es beantwortet keine
//     Frage, die eine Zahl beantworten könnte — es beantwortet die eine,
//     die keine Zahl beantworten kann: WIE spielt der eigentlich?
//
//     Jede Achse ist ein Platz im Feld, nicht ein Absolutwert. 62 %
//     Siegquote sagt für sich nichts; „damit liegt er über allen bis auf
//     einen" sagt alles. Deshalb wird die Achse aus der Liga gerechnet
//     und nicht aus einer erfundenen Skala.
//
//     Sturm und Abwehr liegen einander gegenüber (oben rechts / oben
//     links). Wer stürmt, kippt nach rechts; wer hält, nach links. Die
//     Form ist damit schon vor jedem Zahlenlesen eine Aussage.
//
//     Wer zu wenig gespielt hat, bekommt keinen Abdruck. Ein Vieleck aus
//     acht Partien ist ein Zufall, kein Spielstil.
// ╚═════════════════════════════════════════════════════════════════════════╝

const FINGER_MIN_SPIELE = 12;

// Reihenfolge = Position am Sechseck, im Uhrzeigersinn ab oben.
//   oben  Siege · rechts Sturm, Tore · unten Pensum · links Serie, Abwehr
const FINGER_ACHSEN = [
  {id:'wr',     name:'Siege',
   roh: d => d.st.wr,
   zeig: v => Math.round(v * 100) + ' %'},
  {id:'atk',    name:'Sturm',
   roh: d => d.st.atkWr,
   zeig: v => Math.round(v * 100) + ' %'},
  {id:'tore',   name:'Tore',
   roh: d => d.st.games ? d.st.gd / d.st.games : 0,
   zeig: v => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(1).replace('.', ',')},
  {id:'pensum', name:'Pensum',
   roh: d => d.st.games,
   zeig: v => String(Math.round(v))},
  {id:'serie',  name:'Serie',
   roh: d => d.serie,
   zeig: v => Math.round(v) + '×'},
  {id:'def',    name:'Abwehr',
   roh: d => d.st.defWr,
   zeig: v => Math.round(v * 100) + ' %'},
];

// Das ganze Feld einmal rechnen und an der Cache-Version hängen: für die
// Perzentile braucht jede Achse alle Spieler, und `longestPlayerStreakInfo`
// läuft je Spieler einmal durch alle Partien.
function fingerFeld(){
  const key = 'f_' + matches.length + '_' + _cache.version;
  if(_cache._fingerKey === key) return _cache._finger;

  const feld = activePlayers()
    .map(p => ({id:p.id, st:playerStats(p.id), serie:longestPlayerStreakInfo(p.id, matches).best}))
    .filter(d => d.st.games >= FINGER_MIN_SPIELE);

  const achsen = FINGER_ACHSEN.map(a => {
    const werte = {};
    // Wer eine Position nie gespielt hat, hat auf dieser Achse nichts
    // vorzuweisen — die Speiche bleibt kurz. Das ist keine Wertung, das
    // ist der fehlende Nachweis.
    feld.forEach(d => { const v = a.roh(d); werte[d.id] = (v == null || !isFinite(v)) ? 0 : v; });
    const sortiert = feld.map(d => werte[d.id]).sort((x, y) => x - y);
    const n = sortiert.length;
    const median = n ? (n % 2 ? sortiert[(n - 1) / 2]
                              : (sortiert[n / 2 - 1] + sortiert[n / 2]) / 2) : 0;
    return {def:a, werte, sortiert, median};
  });

  _cache._fingerKey = key;
  _cache._finger = {ids:feld.map(d => d.id), achsen};
  return _cache._finger;
}

// Die sechs Achsen eines Spielers — oder null, wenn seine Laufbahn dafür
// noch zu kurz ist.
function fingerabdruck(pid){
  const F = fingerFeld();
  if(F.ids.indexOf(pid) < 0) return null;
  return F.achsen.map(a => {
    const v = a.werte[pid], n = a.sortiert.length;
    const perz = a.sortiert.filter(x => x < v).length / Math.max(1, n - 1);
    return {
      id:a.def.id, name:a.def.name,
      wert:v, text:a.def.zeig(v),
      perz, von:n,
      rang: a.sortiert.filter(x => x > v).length + 1,
      median:a.median, medianText:a.def.zeig(a.median),
      // Alle Plätze im Feld, für den Streifen unter dem Sechseck.
      feld: a.sortiert.map(x => a.sortiert.filter(y => y < x).length / Math.max(1, n - 1)),
    };
  });
}

// ── Die Zeichnung ────────────────────────────────────────────────────
//     Eine Speiche wird nie ganz kurz: bei 22 % Grundlänge bleibt auch
//     der letzte Platz ein Sechseck und wird nicht zum Stern mit einer
//     eingerissenen Ecke.
const FINGER_GRUND = .22;
let _fingerLauf = 0;

function _fingerPunkt(m, r, i){
  const w = i / 6 * Math.PI * 2 - Math.PI / 2;
  return [m + Math.cos(w) * r, m + Math.sin(w) * r];
}
function _fingerPfad(A, m, R){
  return A.map((a, i) => (i ? 'L' : 'M')
    + _fingerPunkt(m, R * (FINGER_GRUND + (1 - FINGER_GRUND) * a.perz), i)
      .map(v => v.toFixed(1)).join(' ')).join('') + 'Z';
}

// Das Wasserzeichen hinter dem Profilkopf. Keine Beschriftung, keine
// Achsen, kein Raster — nur eine Silhouette, die sonst niemand hat. Nach
// unten läuft sie aus, damit sie nicht in den Namen hineinragt.
function fingerWasserzeichenSvg(pid){
  const A = fingerabdruck(pid);
  if(!A) return '';
  const id = 'fw' + (++_fingerLauf);
  return `<svg class="fa-wz" viewBox="0 0 340 340" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="1"/>
      <stop offset=".62" stop-color="#fff" stop-opacity=".55"/>
      <stop offset=".92" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <mask id="${id}m"><rect width="340" height="340" fill="url(#${id})"/></mask></defs>
    <g mask="url(#${id}m)">
      <path d="${_fingerPfad(A, 170, 150)}" fill="currentColor" fill-opacity=".07"
        stroke="currentColor" stroke-opacity=".22" stroke-width="1.2" stroke-linejoin="round"/>
    </g>
  </svg>`;
}

// Das große Sechseck in der Laufbahn: mit Raster, mit Achsen, mit der
// Liga als gestricheltem Vergleich dahinter. Die Beschriftung sitzt an
// der Speiche, nicht in einer Legende — dann muss niemand zuordnen.
function fingerRadarSvg(pid){
  const A = fingerabdruck(pid);
  if(!A) return '';
  const M = 150, R = 96;                       // Mitte und Radius im Raster
  const P = (r, i) => _fingerPunkt(M, r, i).map(v => v.toFixed(1)).join(' ');
  const ring = f => [0,1,2,3,4,5].map((i, k) => (k ? 'L' : 'M') + P(R * f, i)).join('') + 'Z';

  // Raster: drei Ringe, sechs Speichen.
  let g = [.34, .67, 1].map(f =>
    `<path d="${ring(f)}" fill="none" stroke="var(--line2)" stroke-width="${f === 1 ? 1 : .7}"
      stroke-opacity="${f === 1 ? .9 : .5}"/>`).join('');
  g += [0,1,2,3,4,5].map(i => {
    const [x, y] = _fingerPunkt(M, R, i);
    return `<line x1="${M}" y1="${M}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"
      stroke="var(--line2)" stroke-width=".7" stroke-opacity=".5"/>`;
  }).join('');

  // Die Mitte der Liga als gestrichelter Bezug: das Vieleck, das jemand
  // hätte, der auf jeder Achse genau in der Mitte des Feldes steht.
  // Alles, was darüber hinausragt, ist Vorsprung.
  g += `<path d="${_fingerPfad(A.map(() => ({perz:.5})), M, R)}" fill="none"
    stroke="var(--muted)" stroke-width="1" stroke-opacity=".55" stroke-dasharray="3 4"/>`;

  // Der Abdruck selbst, mit einem Knoten auf jeder Speiche.
  g += `<path d="${_fingerPfad(A, M, R)}" fill="currentColor" fill-opacity=".16"
    stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>`;
  g += A.map((a, i) => {
    const [x, y] = _fingerPunkt(M, R * (FINGER_GRUND + (1 - FINGER_GRUND) * a.perz), i);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.2" fill="currentColor"/>`;
  }).join('');

  // Beschriftung: Name über Wert, an der Speiche statt in einer Legende.
  const anker = ['middle','start','start','middle','end','end'];
  const dy    = [-14, -4, 4, 6, 4, -4];
  g += A.map((a, i) => {
    const [x, y] = _fingerPunkt(M, R + 14, i);
    return `<text x="${x.toFixed(1)}" y="${(y + dy[i]).toFixed(1)}" text-anchor="${anker[i]}"
        class="fa-ax">${esc(a.name.toUpperCase())}</text>
      <text x="${x.toFixed(1)}" y="${(y + dy[i] + 13).toFixed(1)}" text-anchor="${anker[i]}"
        class="fa-vl">${esc(a.text)}</text>`;
  }).join('');

  return `<svg class="fa-radar" viewBox="0 0 300 300" aria-hidden="true">${g}</svg>`;
}

// Woher die Form kommt: je Achse das ganze Feld als Punktreihe, der
// eigene Punkt darin hervorgehoben. Man sieht die Speiche entstehen,
// ohne dass ein Satz sie erklärt.
function fingerFeldZeilen(pid){
  const A = fingerabdruck(pid);
  if(!A) return '';
  return `<div class="fa-feld">${A.map(a => {
    const punkte = a.feld.map(p =>
      `<i style="left:${(p * 100).toFixed(1)}%"></i>`).join('');
    return `<div class="fa-row">
      <span class="fa-n">${esc(a.name)}</span>
      <span class="fa-tr">${punkte}<b style="left:${(a.perz * 100).toFixed(1)}%"></b></span>
      <span class="fa-v num">${esc(a.text)}</span>
      <span class="fa-r num">${a.rang}.</span>
    </div>`;
  }).join('')}</div>`;
}
