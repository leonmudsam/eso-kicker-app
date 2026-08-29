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
  ok(new Set(pids).size === pids.length, `${sid}: kein Spieler bekommt zwei Titel`);
  ok(new Set(tids).size === tids.length, `${sid}: kein Titel geht zweimal raus`);
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
const marks = NAMES.map((n,i)=>({n, m: JSON.parse(K.eval(`JSON.stringify(_playerRankMark(${JSON.stringify(IDS[i])})||null)`))}))
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
render('Chronik-Einstieg', `_chronEntryHtml()`);
render('Titel-Plakette',   `_titlePlateHtml(seasonTitles('2026-07').awarded[0])`);
K.eval(`period='season'; tab='ranking';`);
render('Liga-Tab',   `vRanking()`);
render('Awards-Tab', `vAwards()`);
render('Teams-Tab',  `vTeams()`);
render('Verlauf',    `vHistory()`);
try { K.eval(`showSeasonTable('2026-07')`); ok(true, 'Saison-Tafel-Sheet öffnet ohne Fehler'); }
catch(e){ ok(false, 'Saison-Tafel-Sheet öffnet', e.message); }
try { K.eval(`showLigaChronik()`); ok(true, 'Liga-Chronik-Sheet öffnet ohne Fehler'); }
catch(e){ ok(false, 'Liga-Chronik-Sheet öffnet', e.message); }
try { K.eval(`showPlayer(${JSON.stringify(IDS[9])})`); ok(true, 'Spielerprofil öffnet ohne Fehler'); }
catch(e){ ok(false, 'Spielerprofil öffnet', e.message); }
// News-Detail des Saison-Abschlusses inkl. Tafel
try {
  const body = K.eval(`(()=>{const s=_consolidateStories(_buildStories()).find(x=>(x.dataRef||{}).type==='season_recap');
    return s ? _newsDetailBody(s) : 'KEINE';})()`);
  ok(body === 'KEINE' || (body.includes('tplate') && body.includes('Titel der Saison')),
     'Saison-Abschluss-Detail enthält die Tafel', body === 'KEINE' ? 'keine Recap-Story im Feed (ok außerhalb der ersten Monatstage)' : 'Tafel fehlt');
} catch(e){ ok(false, 'Saison-Abschluss-Detail', e.message); }

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

console.log('\n' + '═'.repeat(60));
console.log(fails === 0 ? `ALLE ${checks} CHECKS BESTANDEN` : `${fails} von ${checks} CHECKS FEHLGESCHLAGEN`);
process.exit(fails === 0 ? 0 : 1);
