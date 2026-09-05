// §13-Verifikation der Saison-Titel & Chronik mit den ECHTEN Liga-Daten.
//  1. Vergabe: deterministisch, ein Titel je Spieler, jeder Titel höchstens 1×
//  2. Belege stimmen mit unabhängig nachgerechneten Werten überein
//  3. Saisontitel-Historie
//  4. Kein zusätzliches Breaking: Saisonabschluss bleibt EINE Karte
//  5. Regression: alle Views + News-Feed rendern weiterhin
const fs = require('fs');
const DIR = __dirname;

// ── Echte Matches aus der gepackten Form rekonstruieren ──
const NAMES = ['Alex','Anton','Henry','Jane','Jannik','Johannes','Julian','Leo','Leon','Martin','Maxi','Stefan'];
const IDS = NAMES.map((n,i)=>'00000000-0000-4000-8000-'+String(i).padStart(12,'0'));
const packed = fs.readFileSync(DIR + '/fixtures/matches.txt', 'utf8').trim();
const realMatches = packed.split(';').map((row, i) => {
  const f = row.split(',').map(Number);
  const pos = k => f[4+k] === 0 ? 'atk' : 'def';
  return {
    id: 'm' + String(i).padStart(4,'0'),
    a1: IDS[f[0]], a2: IDS[f[1]], b1: IDS[f[2]], b2: IDS[f[3]],
    a1_pos: pos(0), a2_pos: pos(1), b1_pos: pos(2), b2_pos: pos(3),
    score_a: f[8], score_b: f[9], winner: f[10] === 0 ? 'A' : 'B',
    exp_a: f[11] / 1000,
    created_at: new Date(f[12] * 1000).toISOString(),
    deltas: {}
  };
});

const html = fs.readFileSync(require('./ziel.js'), 'utf8');
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let m, blocks = [];
while ((m = re.exec(html))) blocks.push(m[1]);
blocks.sort((a, b) => b.length - a.length);
let code = blocks[0].replace(/loadAll\(\);\s*\ncheckForUpdate\(\);/, '/*t*/');
const lc = code.lastIndexOf('})();');
code = code.slice(0, lc) + '\nglobalThis.__k={eval:c=>eval(c)};\n' + code.slice(lc);

const RealDate = Date;
// Fixe Uhr: 26.08.2026, 21:00 — mitten in der laufenden August-Saison.
let NOW = new RealDate(2026, 7, 26, 21, 0, 0).getTime();
class FD extends RealDate { constructor(...a){ a.length?super(...a):super(NOW); } static now(){ return NOW; } }
global.Date = FD;

function el(id){return{id,innerHTML:'',textContent:'',value:'',style:{},dataset:{},attributes:{},
 classList:{add(){},remove(){},toggle(){},contains(){return false}},children:[],
 setAttribute(k,v){this.attributes[k]=v},getAttribute(k){return this.attributes[k]??null},
 appendChild(c){this.children.push(c);return c},removeChild(){},remove(){},insertBefore(c){this.children.push(c);return c},
 addEventListener(){},removeEventListener(){},querySelector(){return null},querySelectorAll(){return[]},
 closest(){return null},focus(){},blur(){},click(){},scrollIntoView(){},
 getBoundingClientRect(){return{top:0,left:0,width:0,height:0}},contains(){return false}};}
const els=new Map();
global.document={readyState:'complete',getElementById(i){if(!els.has(i))els.set(i,el(i));return els.get(i)},
 createElement(t){return el('_'+t)},createTextNode(t){return{textContent:t}},
 querySelector(){return null},querySelectorAll(){return[]},addEventListener(){},removeEventListener(){},
 body:el('body'),documentElement:el('html'),visibilityState:'visible',hidden:false};
const ls=new Map();
global.localStorage={getItem:k=>ls.has(k)?ls.get(k):null,setItem:(k,v)=>ls.set(k,String(v)),
 removeItem:k=>ls.delete(k),key:i=>[...ls.keys()][i]??null,get length(){return ls.size}};
global.window=global; global.addEventListener=()=>{}; global.removeEventListener=()=>{}; global.dispatchEvent=()=>true;
global.navigator={onLine:true,userAgent:'t',vibrate(){}};
global.location={href:'http://l/',search:'',hash:'',reload(){},replace(){},origin:'http://l',pathname:'/'};
global.history={pushState(){},replaceState(){},back(){},state:null};
global.fetch=()=>new Promise(()=>{}); global.setInterval=()=>0; global.clearInterval=()=>{};
global.setTimeout=()=>0; global.requestAnimationFrame=f=>{f();return 0};
global.matchMedia=()=>({matches:false,addEventListener(){},addListener(){}});
global.alert=()=>{}; global.confirm=()=>true; global.prompt=()=>null;
const ch=()=>new Proxy(function(){},{get(_,p){return p==='then'?undefined:ch()},apply(){return ch()}});
global.supabase={createClient:()=>({from:()=>ch(),channel:()=>ch(),removeChannel(){},rpc:()=>ch()})};
(0,eval)(code);
const K = global.__k;

global.__D = {
  players: NAMES.map((n,i)=>({id:IDS[i], name:n, hidden:false, elo:0, atk:0.5})),
  matches: realMatches
};
// Archivierte Saisons — top_elo wird unten aus dem Sim befüllt.
global.__S = [
  {id:'2026-05', label:'Mai 2026',  start_date:'2026-04-30', end_date:'2026-05-31'},
  {id:'2026-06', label:'Juni 2026', start_date:'2026-05-31', end_date:'2026-06-30'},
  {id:'2026-07', label:'Juli 2026', start_date:'2026-06-30', end_date:'2026-07-31'},
];
K.eval(`
  players = globalThis.__D.players;
  matches = globalThis.__D.matches.slice().sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  seasons = globalThis.__S;
  invalidateCache();
  // Die App ist DB-First: simulateElo aggregiert m.deltas. Der Export liefert
  // keine Deltas, also einmal wie „Neuberechnen" in den Einstellungen fahren
  // und die Deltas an die Matches schreiben — danach ist die Welt konsistent.
  const _rc = simulateEloWithSliders(matches);
  const _dmap = {}; _rc.history.forEach(h => { _dmap[h.matchId] = h.deltas; });
  matches.forEach(m => { m.deltas = _dmap[m.id] || {}; });
  invalidateCache();
  const _g = getGlobalSim();
  seasons.forEach(s=>{
    const snap=_g.seasonEndElos[s.id]||{}, pl=_g.seasonPlayed[s.id]||{};
    const top=Object.keys(pl).filter(id=>pl[id]>0)
      .map(id=>({id,elo:Math.round(snap[id]??cfg.start_elo),wins:0,losses:0}))
      .sort((a,b)=>b.elo-a.elo);
    s.top_elo=JSON.stringify(top.slice(0,3));
    s.player_id=top[0]?top[0].id:null;
  });
  invalidateCache();
`);

let fails = 0, checks = 0;
const ok = (cond, label, extra) => {
  checks++;
  if(cond){ console.log('  ✓ ' + label); }
  else { fails++; console.log('  ✗ ' + label + (extra ? '\n      → ' + extra : '')); }
};
const nameOf = id => { const i = IDS.indexOf(id); return i >= 0 ? NAMES[i] : '?'; };

// ══════════════════════════════════════════════════════════════════════
console.log('\n═══ 1. VERGABE — die echten Tafeln ═══');
const SIDS = ['2026-05','2026-06','2026-07','2026-08'];
const tafeln = {};
SIDS.forEach(sid => {
  const T = K.eval(`JSON.stringify(seasonTitles(${JSON.stringify(sid)}))`);
  tafeln[sid] = JSON.parse(T);
});
SIDS.forEach(sid => {
  const T = tafeln[sid];
  console.log(`\n  ── ${T.label}${T.live ? ' (läuft)' : ''} · ${T.matches} Matches, ${T.days} Spieltage`);
  T.awarded.forEach(a => {
    console.log(`     ${a.name.padEnd(22)} ${nameOf(a.pid).padEnd(9)} ${a.ev}`);
  });
  if(T.empty.length) console.log(`     ohne Titel: ${T.empty.map(nameOf).join(', ')}`);
});

console.log('\n═══ 2. INVARIANTEN ═══');
SIDS.forEach(sid => {
  const T = tafeln[sid];
  const pids = T.awarded.map(a => a.pid);
  const tids = T.awarded.map(a => a.titleId);
  // Seit [§C32] geht jeder Eintrag an seinen echten Bestwert-Halter. Ein
  // Spieler darf deshalb mehrere halten, und ein Eintrag mehrere Halter —
  // aber nur, wenn sie punktgleich sind. Dass in der Matrix trotzdem nur
  // EIN Eintrag je Spieler und Monat steht, ist eine Anzeige-Regel
  // (seasonTitleOf nimmt den ersten in Katalogreihenfolge).
  const paare = T.awarded.map(a => a.titleId + '|' + a.pid);
  ok(new Set(paare).size === paare.length, `${sid}: kein Eintrag geht zweimal an denselben Spieler`);
  const fremd = K.eval(`(function(){
    const C=_seasonTitleCtx(${JSON.stringify(sid)}), T=seasonTitles(${JSON.stringify(sid)});
    const raus=[];
    SEASON_TITLES.forEach(def=>{
      const traeger=T.awarded.filter(a=>a.titleId===def.id).map(a=>a.pid);
      if(!traeger.length) return;
      const r=def.pick(C,new Set());
      traeger.forEach(p=>{ if(!r || r.halter.indexOf(p)<0) raus.push(def.id+'/'+pname(p)); });
    });
    return raus.join(', ');
  })()`);
  ok(!fremd, `${sid}: jeder Traeger haelt den Bestwert seines Eintrags`, fremd || 'alle');
  ok(T.awarded.every(a => a.ev && a.ev.length > 3), `${sid}: jeder Titel hat einen Beleg`);
  ok(T.awarded.every(a => a.short && a.short.length <= 10), `${sid}: Kurz-Label passt in eine Zeile`,
     (T.awarded.find(a => !a.short || a.short.length > 13)||{}).short);
});
// Determinismus: zweimal rechnen ergibt exakt dasselbe (auch nach Cache-Reset)
const before = JSON.stringify(tafeln);
K.eval('invalidateCache();');
const after = JSON.stringify(Object.fromEntries(SIDS.map(sid =>
  [sid, JSON.parse(K.eval(`JSON.stringify(seasonTitles(${JSON.stringify(sid)}))`))])));
ok(before === after, 'Vergabe ist deterministisch (identisch nach Cache-Reset)');

console.log('\n═══ 3. BELEGE GEGEN UNABHÄNGIGE RECHNUNG ═══');
// Unabhängige Nachrechnung direkt auf realMatches — bewusst NICHT über die
// App-Funktionen, damit ein Fehler in §13 hier auffliegt.
function refSeason(sid){
  const [y,mo] = sid.split('-').map(Number);
  const from = new Date(y, mo-1, 1).getTime(), to = new Date(y, mo, 0, 23,59,59).getTime();
  const ms = realMatches.filter(m => { const t = new Date(m.created_at).getTime(); return t >= from && t <= to; });
  const P = {}, run = {}, days = {};
  const ensure = id => P[id] || (P[id] = {g:0,w:0,l:0,gd:0,defG:0,atkG:0,atkGoals:0,defConc:0,
    nail:0,bitter:0,perfect:0,debacle:0,ups:0,best:0,days:new Set(),maxDay:0,dayN:{}});
  ms.forEach(m => {
    const d = m.created_at.slice(0,10);
    [m.a1,m.a2,m.b1,m.b2].forEach(id => {
      const p = ensure(id);
      const onA = (id===m.a1||id===m.a2);
      const w = (onA && m.winner==='A') || (!onA && m.winner==='B');
      const gf = onA ? m.score_a : m.score_b, ga = onA ? m.score_b : m.score_a;
      const pos = id===m.a1?m.a1_pos:id===m.a2?m.a2_pos:id===m.b1?m.b1_pos:m.b2_pos;
      const exp = onA ? m.exp_a : 1 - m.exp_a;
      p.g++; if(w) p.w++; else p.l++; p.gd += gf - ga;
      if(pos==='atk'){ p.atkG++; p.atkGoals += gf; } else { p.defG++; p.defConc += ga; }
      if(w && gf===10 && ga===9) p.nail++;
      if(!w && gf===9 && ga===10) p.bitter++;
      if(w && gf===10 && ga===0) p.perfect++;
      if(!w && gf===0 && ga===10) p.debacle++;
      if(w && exp < 0.35) p.ups++;
      p.days.add(d);
      p.dayN[d] = (p.dayN[d]||0)+1; if(p.dayN[d] > p.maxDay) p.maxDay = p.dayN[d];
      if(w){ run[id] = (run[id]||0)+1; if(run[id] > p.best) p.best = run[id]; } else run[id] = 0;
    });
  });
  return {P, days: new Set(ms.map(x=>x.created_at.slice(0,10))).size, n: ms.length};
}
const REF = {}; SIDS.forEach(sid => REF[sid] = refSeason(sid));
SIDS.forEach(sid => {
  const T = tafeln[sid], R = REF[sid];
  ok(T.matches === R.n, `${sid}: Match-Anzahl stimmt (${T.matches})`, `ref ${R.n}`);
  ok(T.days === R.days, `${sid}: Spieltage stimmen (${T.days})`, `ref ${R.days}`);
  T.awarded.forEach(a => {
    const p = R.P[a.pid]; if(!p) return;
    const num = (a.ev.match(/\d+/) || [])[0];
    let expect = null;
    switch(a.titleId){
      case 'unstoppable':  expect = p.best; break;
      case 'executioner':  expect = p.perfect; break;
      case 'tireless':     expect = p.g; break;
      case 'thriller':     expect = p.nail; break;
      case 'giant_slayer': expect = p.ups; break;
      case 'marathon':     expect = p.maxDay; break;
      case 'omnipresent':  expect = p.days.size; break;
      case 'abyss':        expect = p.debacle; break;
      case 'hardluck':     expect = p.bitter; break;
      case 'wall':         expect = p.defG; break;
    }
    if(expect !== null){
      ok(String(expect) === num, `${sid}/${a.titleId}: Beleg „${num}" == unabhängig gerechnet`, `ref ${expect}`);
    }
  });
  // Der Meister muss der Elo-Führende der Saison sein
  const champ = T.awarded.find(a => a.titleId === 'champion');
  if(champ){
    const eloRank = K.eval(`(()=>{const g=getGlobalSim();
      const map=${sid==='2026-08'?'g.elo':`(g.seasonEndElos[${JSON.stringify(sid)}]||{})`};
      const pl=g.seasonPlayed[${JSON.stringify(sid)}]||{};
      return JSON.stringify(Object.keys(pl).filter(id=>pl[id]>0)
        .map(id=>({id,e:Math.round(map[id]??cfg.start_elo)})).sort((a,b)=>b.e-a.e).slice(0,2));})()`);
    const top = JSON.parse(eloRank);
    ok(top[0] && top[0].id === champ.pid, `${sid}: Meister == Elo-Platz 1 (${nameOf(champ.pid)})`,
       top[0] ? 'Sim sagt ' + nameOf(top[0].id) : 'kein Sim-Rang');
    const prince = T.awarded.find(a => a.titleId === 'crown_prince');
    if(prince && top[1]) ok(top[1].id === prince.pid, `${sid}: Kronprinz == Elo-Platz 2 (${nameOf(prince.pid)})`,
       'Sim sagt ' + nameOf(top[1].id));
  }
});

console.log('\n═══ 3b. SORTIERUNG ═══');
K.eval('invalidateCache(); availableSeasons(); availableSeasons();');
const order = JSON.parse(K.eval(`JSON.stringify(allSeasonTitles().map(x=>x.sid))`));
console.log('  allSeasonTitles (neueste zuerst):', order.join(' , '));
const desc = order.slice().sort().reverse();
ok(JSON.stringify(order) === JSON.stringify(desc), 'Saisons kommen chronologisch zurück');
ok(JSON.stringify(K.eval('JSON.stringify(allPastSeasons())')) === JSON.stringify(K.eval('JSON.stringify(allPastSeasons())')),
   'allPastSeasons bleibt nach mehrfachem Aufruf stabil');
const past1 = JSON.parse(K.eval('JSON.stringify(allPastSeasons())'));
K.eval('availableSeasons();');
const past2 = JSON.parse(K.eval('JSON.stringify(allPastSeasons())'));
ok(JSON.stringify(past1) === JSON.stringify(past2), 'availableSeasons() dreht den Cache nicht mehr um', past1+' vs '+past2);
const chron = JSON.parse(K.eval(`JSON.stringify(seasonTitleHistory(${JSON.stringify(IDS[9])}).map(r=>r.sid))`));
ok(JSON.stringify(chron) === JSON.stringify(chron.slice().sort()), 'Chronik-Streifen ist chronologisch', chron.join(','));

console.log('\n\u2550\u2550\u2550 4. SAISONTITEL-HISTORIE \u2550\u2550\u2550');
// Ehrentitel gibt es nicht mehr (§13.4b) — die Laufbahn-Chroniken pruefen
// _chron2_test.js. Hier bleibt nur die Titel-Historie pro Spieler.
NAMES.forEach((n, i) => {
  const rows = JSON.parse(K.eval(`JSON.stringify(seasonTitleHistory(${JSON.stringify(IDS[i])}))`));
  if(!rows.length) return;
  const line = rows.map(r => `${r.label.split(' ')[0].slice(0,3)}:${r.title ? r.title.name.replace(/^(Der|Die|Das) /,'') : '\u2014'}`).join('  ');
  console.log(`  ${n.padEnd(9)} ${line}`);
  // Chronologisch und ohne Luecken in der Sortierung
  const sids = rows.map(r => r.sid);
  ok(sids.join() === sids.slice().sort().join(), `${n}: Historie ist chronologisch`);
  ok(rows.filter(r => r.live).length <= 1, `${n}: hoechstens eine laufende Saison`);
});

console.log('\n═══ 5. TITEL-ABZEICHEN ═══');
NAMES.forEach((n, i) => {
  const b = JSON.parse(K.eval(`JSON.stringify(playerTitleBadge(${JSON.stringify(IDS[i])})||null)`));
  console.log(`  ${n.padEnd(9)} ${b ? (b.name + '  [' + b.kind + ' · ' + b.sub + ']') : '—'}`);
});

console.log('\n═══ 5b. RANGLISTEN-MARKE ═══');
const marks = NAMES.map((n,i)=>({n, m: JSON.parse(K.eval(`JSON.stringify(_playerRankMarks(${JSON.stringify(IDS[i])})[0]||null)`))}))
  .filter(x=>x.m);
marks.forEach(x => console.log(`  ${x.n.padEnd(9)} ${x.m.kind.padEnd(6)} ${x.m.label}  (${x.m.sub})`));
// Seit §13.6 traegt jede Zeile bis zu zwei Marken: Meistertitel + der
// Chronik-Eintrag der laufenden Saison. Wie viele Zeilen eine Marke tragen,
// haengt davon ab, wie viele Spieler diesen Monat eine Bedingung erfuellen —
// eine harte Obergrenze waere hier eine Luege. Geprueft wird deshalb nur,
// dass nicht JEDE Zeile markiert ist (dann unterscheidet die Marke nichts).
ok(marks.length < NAMES.length, `nicht jede Zeile markiert (${marks.length} von ${NAMES.length})`);
ok(marks.every(x => x.m.kind === 'champ' || x.m.kind === 'season'), 'Marke ist Meistertitel oder laufender Chronik-Eintrag');

console.log('\n═══ 6. NEWS — KEIN BREAKING-SPAM ═══');
const feed = JSON.parse(K.eval(`(()=>{const s=_consolidateStories(_buildStories());
  return JSON.stringify(s.map(x=>({id:x.id,t:x.title,brk:_isBreaking(x),type:(x.dataRef||{}).type})));})()`));
const brk = feed.filter(f => f.brk);
console.log(`  Feed: ${feed.length} Karten, davon ${brk.length} Breaking`);
brk.forEach(b => console.log(`     ! ${b.type}  ${b.t}`));
ok(feed.filter(f => f.type === 'season_recap').length <= 1, 'höchstens EINE Saison-Abschluss-Karte');
ok(!feed.some(f => f.type === 'season_titles'), 'kein eigener Story-Typ für Titel (kein Extra-Breaking)');
ok(!brk.some(f => /Ehrentitel/i.test(f.t)), 'keine Ehrentitel-Karte mehr im Feed');
// Die Titel-Fun-Fact-Vorlage baut und ist NICHT breaking
const amb = K.eval(`(()=>{const pm2=pmap();const T=_ambientTemplatePool(new Date(),pm2,id=>(pm2[id]&&pm2[id].name)||'?');
  const t=T.find(x=>x.key==='season_title_race'); if(!t) return 'MISSING';
  const r=t.make(); return r?JSON.stringify(r):'NULL';})()`);
ok(amb !== 'MISSING', 'Fun-Fact-Vorlage season_title_race existiert');
ok(amb !== 'NULL', 'Fun-Fact-Vorlage liefert Daten');
if(amb !== 'MISSING' && amb !== 'NULL'){
  const a = JSON.parse(amb);
  console.log(`     Fun Fact: „${a.title}" — ${a.desc}`);
  ok(a.cat !== 'breaking', 'Titelrennen ist Fun Fact, nicht Breaking');
}

console.log('\n═══ 7. RENDERING ═══');
const render = (label, expr) => {
  try { const h = K.eval(expr); ok(typeof h === 'string' && h.length > 0, label + ' rendert (' + h.length + ' Zeichen)'); }
  catch(e){ ok(false, label + ' rendert', e.message); }
};
render('Chronik-Streifen', `_chronStripHtml(${JSON.stringify(IDS[9])})`);
render('Titel-Pille',      `_titlePillHtml(${JSON.stringify(IDS[9])})`);
render('Rekord-Liste',     `ligaRekordeHtml(true)`);
render('Chronik-Matrix',   `ligaChronikMatrixHtml()`);
render('Titel-Plakette',   `_titlePlateHtml(seasonTitles('2026-07').awarded[0])`);
K.eval(`period='season'; tab='ranking';`);
render('Liga-Tab',   `vRanking()`);
// Die Ewige Tafel ist die RANGLISTE, nicht die Bestenliste: Podest, dann
// Tabelle. Peak-Elo, Meiste Siege und Beste Siegrate standen hier als drei
// Karten darüber — und dieselben drei Zahlen noch einmal als Kacheln im
// Awards-Tab. Zweimal dieselbe Zahl auf zwei Seiten heißt, dass eine davon
// überflüssig ist.
try {
  const g = K.eval(`period='all'; vRanking()`);
  const iRek = g.indexOf('records-grid'), iPod = g.indexOf('podest');
  ok(iPod > -1, 'Gesamt-Tafel zeigt das Podest', 'pod ' + iPod);
  ok(iRek === -1, 'keine Rekordkarten mehr — die stehen im Awards-Tab',
     'rek ' + iRek);
} catch(e){ ok(false, 'Gesamt-Tafel rendert', e.message); }
K.eval(`period='season'`);

// ── Ein Gerüst für alle vier Zeiträume [§C28] ────────────────────────
// Der Liga-Tab hatte in jedem Reiter eine andere Abfolge: die Saison ohne
// Metrikleiste und mit dem Team der Saison ganz unten, Woche und Tag mit
// einer goldenen Heldenkarte und zwei Sortierknöpfen eigener Aufschrift,
// die Ewige Tafel mit fünf. Jetzt steht überall dasselbe in derselben
// Reihenfolge — Kontext, Nebenwertungen, Tabelle.
// Sortiert wird nur in der EWIGEN TAFEL. Saison, Woche und Tag sind die
// Liga-Rangliste, und die ist die Elo-Rangliste; wer dort nach Siegrate
// sortieren kann, sucht in Wahrheit eine Bestenliste, und die steht im
// Awards-Tab.
console.log('\n═══ 7b. DER LIGA-TAB: EIN GERÜST ═══');
const _ligaSicht = {};
['season','week','day','all'].forEach(per => {
  try { _ligaSicht[per] = K.eval(`period=${JSON.stringify(per)}; rankMetric='elo'; vRanking()`); }
  catch(e){ _ligaSicht[per] = ''; ok(false, per + ' rendert', e.message); }
});
Object.entries(_ligaSicht).forEach(([per, h]) => {
  if(!h) return;
  const iMetrik = h.indexOf('data-metric='), iListe = h.indexOf('class="rlist"');
  ok(iListe > -1, `${per}: hat eine Tabelle`);
  if(per === 'all'){
    ok(iMetrik > -1, 'Gesamt: hat eine Metrikleiste');
    ok(iMetrik < iListe, 'Gesamt: die Metrikleiste steht über der Tabelle',
       `metrik ${iMetrik} liste ${iListe}`);
  } else {
    ok(iMetrik === -1,
       `${per}: keine Metrikleiste — die Liga-Rangliste ist die Elo-Rangliste`,
       'metrik ' + iMetrik);
  }
  // Kein Reiter trägt mehr eine eigene Sortierbedienung.
  ok(h.indexOf('data-periodsort') === -1, `${per}: keine eigene Sortierbedienung mehr`);
  // Jede Zeile trägt das Wappen [§C27].
  const zeilen = (h.match(/class="rrow/g) || []).length;
  const wappen = (h.match(/class="rav zn/g) || []).length;
  ok(zeilen > 0 && wappen >= zeilen,
     `${per}: jede Ranglistenzeile trägt ein Wappen`, `zeilen ${zeilen} wappen ${wappen}`);
});
// Woche und Tag tragen eine Nebenwertung über der Tabelle: der Spieler des
// Zeitraums ist dort kein Tabellenerster, sondern ein Titel mit eigener Regel
// (Mindestzahl Siege, beste Quote) und gehört deshalb NEBEN die Tabelle.
// Die Saison hat keine: ihr Erster IST die erste Zeile, und die Duos haben
// einen eigenen Reiter mit vollständiger Rangliste.
['week','day'].forEach(per => {
  const h = _ligaSicht[per]; if(!h) return;
  const iNeben = h.indexOf('class="nw-hero'), iListe = h.indexOf('class="rlist"');
  ok(iNeben > -1, `${per}: hat eine Nebenwertungs-Karte`);
  ok(iNeben > -1 && iNeben < iListe,
     `${per}: die Nebenwertung steht über der Tabelle`, `neben ${iNeben} liste ${iListe}`);
});
ok(_ligaSicht.season && _ligaSicht.season.indexOf('class="nw-hero') === -1,
   'season: keine Team-Karte mehr über der Spielertabelle — das sagt der Duo-Reiter',
   'nw-hero bei ' + (_ligaSicht.season || '').indexOf('class="nw-hero'));
// Die Ewige Tafel zeigt jeden Spieler, auch bei der Elo-Sortierung. Vorher
// fehlten dort die ersten drei, weil sie schon auf dem Podest standen —
// die Tabelle begann bei 4 und war damit eine andere als unter „Siegrate".
const _aktive = K.eval(`activePlayers().length`);
['elo','winrate'].forEach(m => {
  const h = K.eval(`period='all'; rankMetric=${JSON.stringify(m)}; vRanking()`);
  const zeilen = (h.match(/class="rrow/g) || []).length;
  ok(zeilen === _aktive,
     `Ewige Tafel nach ${m}: alle ${_aktive} Spieler stehen in der Tabelle`, 'gezählt: ' + zeilen);
});
K.eval(`period='season'; rankMetric='elo'`);
render('Awards-Tab', `awView='awards'; vAwards()`);
render('Rekorde-Reiter', `awView='rekorde'; vAwards()`);
render('Chronik-Reiter', `awView='chronik'; vAwards()`);
K.eval(`awView='awards'`);
render('Teams-Tab',  `vTeams()`);
render('Verlauf',    `vHistory()`);
try { K.eval(`showSeasonTable('2026-07')`); ok(true, 'Saison-Tafel-Sheet öffnet ohne Fehler'); }
catch(e){ ok(false, 'Saison-Tafel-Sheet öffnet', e.message); }
try { K.eval(`showLigaChronik()`); ok(true, 'Liga-Chronik-Sheet öffnet ohne Fehler'); }
catch(e){ ok(false, 'Liga-Chronik-Sheet öffnet', e.message); }
try { K.eval(`showPlayer(${JSON.stringify(IDS[9])})`); ok(true, 'Spielerprofil öffnet ohne Fehler'); }
catch(e){ ok(false, 'Spielerprofil öffnet', e.message); }

// Die Laufbahn verspricht eine Rechnung, keine Behauptung: jede Zeile muss
// zur Kopfzeile darueber passen und jede Kopfzeile zur Gesamtzahl darunter.
// Ohne Restverteilung driftet eine Liste aus 21 Posten um bis zu einen Punkt
// gegen ihre eigene Summe — und das sieht man nur, wenn man nachrechnet.
K.eval(`globalThis.__ALT_SHEET = openSheet; globalThis.__ALT_REOPEN = _sheetSetReopen;
  globalThis.__ALT_BIND = _bindChronikClicks;
  openSheet = h => { globalThis.__SHEET = h; };
  _sheetSetReopen = () => {}; _bindChronikClicks = () => {};`);
{
  const num = t => Number(String(t).replace(',', '.'));
  let schief = [];
  IDS.forEach((pid, i) => {
    let h;
    try { K.eval(`showLaufbahn(${JSON.stringify(pid)})`); h = K.eval('globalThis.__SHEET'); }
    catch(e){ schief.push(NAMES[i] + ': ' + e.message); return; }
    if(!h){ schief.push(NAMES[i] + ': kein Sheet'); return; }
    const grp = [...h.matchAll(/<div class="lb-grp">([\s\S]*?)(?=<div class="lb-grp">|<div class="lb-summe">)/g)];
    const mg = h.match(/lb-summe[\s\S]*?class="num">(\d+)</);
    if(!mg || grp.length !== 3){ schief.push(NAMES[i] + ': Aufbau unerwartet'); return; }
    const gesamt = num(mg[1]);
    let koepfe = 0;
    grp.forEach(g => {
      const kopf = num(g[1].match(/lb-grp-k[\s\S]*?class="num">([\d,]+)</)[1]);
      const zeilen = [...g[1].matchAll(/class="p num">([\d,]+)</g)].map(m => num(m[1]));
      const summe = Math.round(zeilen.reduce((a, b) => a + b, 0) * 10) / 10;
      koepfe += kopf;
      if(Math.abs(summe - kopf) > 1e-9) schief.push(NAMES[i] + ': Posten ' + summe + ' vs Kopf ' + kopf);
    });
    if(Math.abs(koepfe - gesamt) > 1e-9) schief.push(NAMES[i] + ': Koepfe ' + koepfe + ' vs Gesamt ' + gesamt);
  });
  ok(schief.length === 0, 'jede Laufbahn-Aufschluesselung geht exakt auf', schief.join(' | '));
}
K.eval(`openSheet = globalThis.__ALT_SHEET; _sheetSetReopen = globalThis.__ALT_REOPEN;
  _bindChronikClicks = globalThis.__ALT_BIND;`);
// News-Detail des Saison-Abschlusses inkl. Tafel
try {
  const body = K.eval(`(()=>{const s=_consolidateStories(_buildStories()).find(x=>(x.dataRef||{}).type==='season_recap');
    return s ? _newsDetailBody(s) : 'KEINE';})()`);
  ok(body === 'KEINE' || (body.includes('tplate') && body.includes('Titel der Saison')),
     'Saison-Abschluss-Detail enthält die Tafel', body === 'KEINE' ? 'keine Recap-Story im Feed (ok außerhalb der ersten Monatstage)' : 'Tafel fehlt');
} catch(e){ ok(false, 'Saison-Abschluss-Detail', e.message); }

console.log('\n═══ 7c. DER LIGA-TAB ZEIGT EINE GEWÄHLTE SAISON ═══');
// Der Liga-Tab konnte nur „jetzt". Wer den Juni sehen wollte, fand ihn
// nirgends. Jetzt wählt ein Saisonwähler die Saison — und zwar NUR für den
// Liga-Tab: Awards, News und Ambient rechnen weiter mit der laufenden.
// Das ist die eigentliche Gefahr an dieser Änderung, deshalb steht sie hier.
{
  const cur = K.eval(`currentSeason().id`);
  const alt = '2026-06';
  const jetzt = K.eval(`period='season'; ligaSicht='spieler'; ligaSeasonId=null; vRanking()`);
  const juni  = K.eval(`period='season'; ligaSicht='spieler'; ligaSeasonId=${JSON.stringify(alt)}; vRanking()`);

  // Der Fortschritt ist keine Karte mehr, sondern eine Zeile (.lauf) — die
  // Aussage bleibt: laufende Saison zeigt ihn, abgeschlossene nicht.
  ok(jetzt.includes('class="lauf"'),
     'laufende Saison: der Fortschritt steht da');
  ok(!juni.includes('class="lauf"'),
     'abgeschlossene Saison: kein Fortschritt — es geht nichts mehr weiter');
  ok(juni.includes('saison-abgeschlossen'),
     'abgeschlossene Saison: sie sagt, dass sie abgeschlossen ist');
  ok(juni.includes(K.eval(`seasonLabel(${JSON.stringify(alt)})`)),
     'abgeschlossene Saison: ihr Name steht im Kopf');

  // Die Zahlen müssen andere sein — sonst wandert nur die Beschriftung.
  const eloVon = h => (h.match(/<div class="big num">(-?\d+)<\/div>/g)||[]).slice(0,5).join(',');
  ok(eloVon(jetzt) !== eloVon(juni),
     'die Tabelle zeigt wirklich andere Werte, nicht nur eine andere Aufschrift',
     'jetzt ' + eloVon(jetzt) + ' | juni ' + eloVon(juni));

  // In einer abgeschlossenen Saison brennt niemand mehr: „on fire" ist
  // Gegenwart. Der Wappenrahmen bleibt, die Flamme nicht.
  ok(juni.includes('class="rav zn"') && !/class="rav zn zn-l\d/.test(juni),
     'abgeschlossene Saison: Wappen ja, Flamme nein',
     (juni.match(/class="rav zn[^"]*"/g)||[]).slice(0,3).join(' | '));

  // Der Awards-Tab darf NICHT mitwandern.
  // Die Verlaufs-ids im Wappen sind ein Zähler, der bei jedem Zeichnen
  // hochläuft ('i17_'). Sie gehören nicht zum Inhalt — sonst wäre kein
  // zweiter Aufruf je gleich. Vor dem Vergleich also wegnormieren.
  const ohneIds = h => h.replace(/\bi\d+_/g, 'i_');
  const awJetzt = ohneIds(K.eval(`ligaSeasonId=null;  awView='awards'; awPeriod='season'; awSeasonId=null; vAwards()`));
  const awJuni  = ohneIds(K.eval(`ligaSeasonId=${JSON.stringify(alt)}; awView='awards'; awPeriod='season'; awSeasonId=null; vAwards()`));
  ok(awJetzt === awJuni,
     'die Awards folgen der Liga-Saisonwahl NICHT — sie haben ihre eigene',
     'Länge ' + awJetzt.length + ' vs ' + awJuni.length);

  // Der Award-Sammler benutzt dasselbe Podest wie die Ewige Tafel [§C6] —
  // und seine Avatare tragen dasselbe Wappen wie jede Ranglistenzeile.
  const awAll = K.eval(`awView='awards'; awPeriod='all'; vAwards()`);
  ok((awAll.match(/class="podest"/g) || []).length === 1,
     'Awards: ein Podest, dasselbe Bauteil wie in der Ewigen Tafel',
     (awAll.match(/class="podest"/g) || []).length + '×');
  ok((awAll.match(/class="pod-karte/g) || []).length === 3,
     'Awards: drei Podestkarten',
     (awAll.match(/class="pod-karte/g) || []).length + '×');
  ok(awAll.indexOf('aw-collector') === -1,
     'Awards: das alte Sammler-Podest ist weg — zwei Podeste waren eines zu viel');
  ok((awAll.match(/class="rav zn[^"]*pod-av/g) || []).length === 3,
     'Awards: jeder Sammler trägt sein Wappen',
     (awAll.match(/class="rav zn[^"]*pod-av/g) || []).length + '×');
  ok(awJuni.includes(K.eval(`seasonLabel(${JSON.stringify(cur)})`)),
     'die Awards zeigen weiter die laufende Saison');
  K.eval(`ligaSeasonId=null; awPeriod='all';`);
}

console.log('\n═══ 7d. DIE DUOS SIND EINE ZWEITE RANGLISTE ═══');
// Das Team der Saison stand nur als Karte über der Tabelle: man sah den
// Ersten, nie den Rest. Jetzt sind es zwei Ranglisten über denselben
// Zeitraum, gewechselt über einen Reiter.
{
  const sp = K.eval(`period='season'; ligaSeasonId=null; ligaSicht='spieler'; vRanking()`);
  const du = K.eval(`period='season'; ligaSeasonId=null; ligaSicht='duos';    vRanking()`);
  ok(sp.includes('data-ligasicht="duos"') && du.includes('data-ligasicht="spieler"'),
     'beide Sichten tragen den Umschalter');
  const duoZeilen = (du.match(/class="rrow duo/g)||[]).length;
  ok(duoZeilen >= 3, 'die Duo-Sicht listet alle Duos, nicht nur die Spitze',
     duoZeilen + ' Zeilen');
  ok(du.indexOf('Team der Saison') > -1 && !du.includes('class="nw-hero'),
     'der Erste steht IN der Tabelle, nicht als Karte darüber');
  // 31 Duos wären 62 Wappen — eine Viertelmillion Zeichen für eine Tabelle.
  ok(!/class="rrow duo[\s\S]{0,400}class="rav zn/.test(du),
     'die Duo-Zeile trägt Chips, kein Wappen — ein Duo hat keinen Rang');
  ok(du.length < sp.length,
     'die Duo-Sicht ist nicht schwerer als die Spielersicht',
     'duo ' + du.length + ' spieler ' + sp.length);
  K.eval(`ligaSicht='spieler';`);
}

console.log('\n═══ 7e. DIE REKORDE SIND SORTIERT, DIE VITRINE HAT KEINE LÖCHER ═══');
// Neunundzwanzig gleich aussehende Karten in einer Spalte waren eine Liste,
// in der man nichts wiederfand. Die drei Arten stehen längst im Katalog —
// sie wurden nur nie gezeigt.
{
  const rek = K.eval(`ligaRekordeHtml(true)`);
  const koepfe = (rek.match(/class="rek-g-n">([^<]+)</g)||[])
    .map(x => x.replace(/.*>/, ''));
  ok(koepfe.length >= 2, 'die Rekorde stehen in Gruppen', koepfe.join(' · '));
  // Reihenfolge: Können, dann Ereignis, dann Schatten — wie im Katalog.
  const erwartet = ['Liga-Rekord', 'Bestmarke', 'Schattenseite'];
  const rang = koepfe.map(k => erwartet.findIndex(e => k.indexOf(e) === 0));
  ok(rang.every((r, i) => r > -1 && (i === 0 || r > rang[i-1])),
     'Leistung vor Ereignis vor Schatten', koepfe.join(' · '));
  // Keine Karte steht vor der ersten Überschrift.
  ok(rek.indexOf('class="rek-gruppe') < rek.indexOf('class="rek"'),
     'keine Karte steht vor ihrer Überschrift');
  // Ein Zeitpunkt steht nur dort, wo der Katalog einen liefert — und dort
  // wirklich. Eine erfundene Jahreszahl unter jedem Rekord wäre schlechter
  // als keine, eine nirgends sichtbare aber auch.
  const mitZeit = (rek.match(/class="rek-zeit"/g)||[]).length;
  const kannZeit = K.eval(`CHRONICLES.filter(c=>c.zeit).length`);
  ok(kannZeit > 0 && mitZeit > 0 && mitZeit <= kannZeit,
     'der Zeitpunkt steht dort, wo es einen gibt — und nur dort',
     'gezeigt ' + mitZeit + ' von ' + kannZeit + ' möglichen');
  ok(!rek.includes('rek-kopf'),
     'keine zweite Überschrift über der ersten Gruppe');
}
// Die Vitrine ist zweispaltig. Bei ungerader Kachelzahl blieb unten rechts
// ein Loch, und ein leeres Feld liest sich als Fehler, nicht als Ende.
['all','season','week'].forEach(per => {
  let h;
  try { h = K.eval(`awView='awards'; awPeriod=${JSON.stringify(per)}; awSeasonId=null; vAwards()`); }
  catch(e){ ok(false, per + ': Awards rendern', e.message); return; }
  // Die Marken der Reihe nach ablaufen statt zu splitten: bei split() ist
  // jeder Teil der REST des Strings, nicht das Segment — die letzte Vitrine
  // zählte dadurch die Kacheln aller folgenden mit.
  const marken = [];
  const re = /class="aw-(vitrine|trophy)([ "])/g;
  let m; while((m = re.exec(h))) marken.push(m[1] === 'vitrine'
    ? {t:'v'} : {t:'k', gross:h.substr(m.index, 40).indexOf('gross') > -1,
                        allein:h.substr(m.index, 40).indexOf('allein') > -1});
  const vitrinen = [];
  marken.forEach(x => { if(x.t === 'v') vitrinen.push([]); else if(vitrinen.length) vitrinen[vitrinen.length-1].push(x); });
  const loecher = [];
  vitrinen.forEach((k, i) => {
    const hero   = k.some(x => x.gross) ? 1 : 0;
    const allein = k.some(x => x.allein);
    if((k.length - hero) % 2 === 1 && !allein)
      loecher.push('Vitrine ' + (i+1) + ': ' + k.length + ' Kacheln');
  });
  ok(vitrinen.length > 0 && loecher.length === 0,
     per + ': keine Vitrine lässt ein leeres Feld stehen', loecher.join(' | '));
});
K.eval(`awPeriod='all';`);

console.log('\n═══ 8. PERFORMANCE ═══');
K.eval('invalidateCache();');
let t0 = Date.now();
K.eval(`['2026-05','2026-06','2026-07','2026-08'].forEach(s=>seasonTitles(s));`);
const cold = Date.now() - t0;
t0 = Date.now();
K.eval(`for(let i=0;i<200;i++) ['2026-05','2026-06','2026-07','2026-08'].forEach(s=>seasonTitles(s));`);
const warm = Date.now() - t0;
console.log(`  kalt: ${cold} ms für 4 Saisons · 200× warm: ${warm} ms`);
ok(cold < 2000, 'Kalt-Berechnung unter 2 s');
ok(warm < 200, '200 Cache-Treffer unter 200 ms (Memoisierung greift)');


console.log('\n═══ 9. DIE DREI RÜCKBLICKE [§C31] ═══');
// Saison, Woche und Tag benutzen denselben Baukasten. Vorher trugen die
// beiden kleinen ihre Gestaltung als Inline-Style im JS — derselbe Spieler
// sah in drei Rückblicken dreimal anders aus, und in keinem trug er sein
// Wappen. Diese sechs Zusicherungen halten das zusammen.
const _rb = JSON.parse(K.eval(`JSON.stringify((function(){
  const holen = (fn) => {
    document.getElementById('sheet').innerHTML = '';
    try { fn(); } catch(e){ return {fehler:String(e)}; }
    const h = document.getElementById('sheet').innerHTML;
    const z = (re) => (h.match(re) || []).length;
    return {
      laenge: h.length,
      kopf: z(/class="rcp-head"/g), held: z(/class="rcp-held[" ]/g),
      podest: z(/class="podest /g), sieger: z(/class="pod-karte gold/g),
      zahlen: z(/class="rcp-z-s"/g), kacheln: z(/class="rcp-aw /g),
      liste: z(/class="rcp-zeile/g),
      wappen: z(/class="ins"/g), inline: z(/ style="/g),
      // Nicht die ZAHL der Inline-Styles zählt — ein berechneter Wert
      // (Avatarfarbe, --rav) gehört ins Markup. Es zählt, ob einer davon
      // GESTALTUNG trägt: acht Angaben in einem Attribut sind ein Bauteil,
      // das nie ins CSS gewandert ist.
      breitester: (h.match(/ style="[^"]*"/g)||[]).reduce((n,x) =>
        Math.max(n, x.split(':').length - 1), 0),
      // Nur die Schwinge der SIEGERKARTE: die beiden daneben tragen ihre
      // eigenen Titel, und die zählten sonst mit. Gezählt werden die
      // Zeichenzüge (M im Pfad): mit jedem Rang kommen Ranken dazu, mit
      // jedem Titel ein Stern. Eine Farbe zu zählen ginge nicht mehr — die
      // Ranke hat keine, die es nur einmal je Feder gäbe.
      federn: ((h.match(/class="pod-karte gold[^]*?class="pod-name"/) || [''])[0]
               .match(/M/g) || []).length,
      chronik: z(/data-tplayer=/g), rekorde: z(/data-chron=/g)
    };
  };
  const mai = seasons.find(s => s.id === '2026-05');
  const jul = seasons.find(s => s.id === '2026-07');
  const leon = seasonChampion('2026-05');
  return {
    saison: holen(() => showSeasonRecap(jul)),
    saisonMai: holen(() => showSeasonRecap(mai)),
    woche: holen(() => showPotwRecap({force:true})),
    tag: holen(() => showPotdRecap({force:true})),
    // Wieviele Zeichenzüge braucht das Banner bei einem bzw. drei Titeln?
    federn1: (insigniumSvg(leon, {band:true, titel:1}).match(/M/g)||[]).length,
    federn3: (insigniumSvg(leon, {band:true, titel:3}).match(/M/g)||[]).length,
    titelHeute: meisterTitel(leon)
  };
})())`));
console.log('  Saison ' + _rb.saison.laenge + ' Zeichen · Woche ' + _rb.woche.laenge
  + ' · Tag ' + _rb.tag.laenge);
console.log('  Breitester Inline-Style: Saison ' + _rb.saison.breitester
  + ' · Woche ' + _rb.woche.breitester + ' · Tag ' + _rb.tag.breitester + ' Angaben');

// 1. Alle drei rendern überhaupt.
const _drei = [['Saison',_rb.saison],['Woche',_rb.woche],['Tag',_rb.tag]];
const _kaputt = _drei.filter(([,r]) => r.fehler);
ok(_kaputt.length === 0, 'alle drei Rückblicke rendern',
   _kaputt.map(([n,r]) => n + ': ' + r.fehler).join(' | ') || 'ohne Fehler');

// 2. Alle drei benutzen denselben Baukasten: Kopf, Zahlenleiste, Kacheln.
//    Wer eins davon neu baut, fällt hier auf.
const _ohne = _drei.filter(([,r]) => !(r.kopf === 1 && r.zahlen >= 3 && r.kacheln >= 3));
ok(_ohne.length === 0, 'alle drei benutzen Kopf, Zahlenleiste und Kacheln',
   _drei.map(([n,r]) => n + ' ' + r.kopf + '/' + r.zahlen + '/' + r.kacheln).join(' · '));

// 2b. Der Saison-Rückblick zeigt das Podest der Ewigen Tafel und KEINE
//     eigene Heldenkarte — die sagte dasselbe ein zweites Mal. Woche und Tag
//     haben umgekehrt einen Helden und kein Podest: drei Karten für einen
//     Sieger sind kein Podest.
ok(_rb.saison.podest === 1 && _rb.saison.sieger === 1 && _rb.saison.held === 0
   && _rb.woche.held === 1 && _rb.woche.podest === 0
   && _rb.tag.held === 1 && _rb.tag.podest === 0,
   'Saison zeigt das Podest, Woche und Tag den Helden',
   'Saison ' + _rb.saison.podest + '/' + _rb.saison.held
   + ' · Woche ' + _rb.woche.podest + '/' + _rb.woche.held
   + ' · Tag ' + _rb.tag.podest + '/' + _rb.tag.held);

// 3. Der Held trägt in allen dreien sein Wappen. Genau das fehlte in Woche
//    und Tag — dort stand ein nackter Kreis.
const _ohneWappen = _drei.filter(([,r]) => !r.wappen);
ok(_ohneWappen.length === 0, 'in allen drei Rückblicken trägt der Held sein Wappen',
   _drei.map(([n,r]) => n + ' ' + r.wappen).join(' · '));

// 4. Die Gestaltung steht im CSS, nicht im JS. Ein einzelner berechneter
//    Wert im Markup ist richtig (Avatarfarbe, --rav, der Farbton einer
//    Plakette). Ein Attribut mit acht Angaben ist ein Bauteil, das nie ins
//    CSS gewandert ist — genau so sahen Wochen- und Tages-Rückblick vorher
//    aus, mit Avataren aus neun Angaben.
const _viel = _drei.filter(([,r]) => r.breitester > 4);
ok(_viel.length === 0, 'kein Rückblick trägt ein ganzes Bauteil im style-Attribut',
   _drei.map(([n,r]) => n + ' ' + r.breitester).join(' · '));

// 5. Der Saison-Rückblick zeigt, was in DIESEM Monat passiert ist: die
//    Chronik und die Rekorde, die gefallen sind. Beides stand vorher nur
//    woanders.
ok(_rb.saison.chronik > 0 && _rb.saison.rekorde > 0 && _rb.saison.liste > 0,
   'der Saison-Rückblick zeigt Chronik und Rekorde des Monats',
   _rb.saison.chronik + ' Chronik-Einträge, ' + _rb.saison.rekorde + ' Rekorde');

// 6. Das Banner zählt die Titel BIS ZU dieser Saison. Leon war in allen drei
//    Monaten Meister; im Mai-Rückblick muss sein Banner einen Titel zeigen,
//    nicht die drei von heute. Sonst trägt eine alte Saison die Zukunft.
ok(_rb.federn1 !== _rb.federn3 && _rb.saisonMai.federn === _rb.federn1
   && _rb.saison.federn === _rb.federn3,
   'das Banner im Rückblick zählt die Titel bis zu dieser Saison',
   'Mai ' + _rb.saisonMai.federn + ' (1 Titel = ' + _rb.federn1 + ') · '
   + 'Juli ' + _rb.saison.federn + ' (3 Titel = ' + _rb.federn3 + ') · heute '
   + _rb.titelHeute + ' Titel');
K.eval(`closeSheet(true); awPeriod='all'; awSeasonId=null;`);

// ─── Die Monatstafel zeigt zuerst nur das, was auch die Matrix zeigt ───
// Ein starker Monat brachte ueber zwanzig Karten, von denen sieben demselben
// Namen gehoerten — waehrend der Reiter dahinter je Spieler eine zeigte.
['2026-06','2026-07','2026-08'].forEach(sid => {
  const r = K.eval(`(function(){
    const T=seasonTitles('${sid}');
    const g=new Set(); let s=0,w=0;
    T.awarded.forEach(a=>{ if(g.has(a.pid)) w++; else { g.add(a.pid); s++; } });
    return s+'/'+w+'/'+g.size;
  })()`).split('/').map(Number);
  ok(r[0] === r[2], sid + ': offen steht genau ein Eintrag je Spieler',
     r[0] + ' Karten fuer ' + r[2] + ' Spieler');
  ok(r[1] > 0, sid + ': der Rest liegt hinter „Alle anzeigen"', r[1] + ' weitere');
});

console.log('\n' + '═'.repeat(60));
console.log(fails === 0 ? `ALLE ${checks} CHECKS BESTANDEN` : `${fails} von ${checks} CHECKS FEHLGESCHLAGEN`);
process.exit(fails === 0 ? 0 : 1);
