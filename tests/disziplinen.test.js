// Prüft das neue Chronik-System (§13.4b) und den Avatar-Ring (§13.7)
// gegen die echten 466 Matches der Liga.
const fs = require('fs');
const DIR = __dirname;
const NAMES = ['Alex','Anton','Henry','Jane','Jannik','Johannes','Julian','Leo','Leon','Martin','Maxi','Stefan'];
const IDS = NAMES.map((n,i)=>'00000000-0000-4000-8000-'+String(i).padStart(12,'0'));
const packed = fs.readFileSync(DIR + '/fixtures/matches.txt', 'utf8').trim();
const realMatches = packed.split(';').map((row, i) => {
  const f = row.split(',').map(Number);
  const pos = k => f[4+k] === 0 ? 'atk' : 'def';
  return { id:'m'+String(i).padStart(4,'0'),
    a1:IDS[f[0]], a2:IDS[f[1]], b1:IDS[f[2]], b2:IDS[f[3]],
    a1_pos:pos(0), a2_pos:pos(1), b1_pos:pos(2), b2_pos:pos(3),
    score_a:f[8], score_b:f[9], winner:f[10]===0?'A':'B',
    exp_a:f[11]/1000, created_at:new Date(f[12]*1000).toISOString(), deltas:{} };
});

const html = fs.readFileSync(require('./ziel.js'), 'utf8');
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let m, blocks = []; while ((m = re.exec(html))) blocks.push(m[1]);
blocks.sort((a,b)=>b.length-a.length);
let code = blocks[0].replace(/loadAll\(\);\s*\ncheckForUpdate\(\);/, '/*t*/');
const lc = code.lastIndexOf('})();');
code = code.slice(0, lc) + '\nglobalThis.__k={eval:c=>eval(c)};\n' + code.slice(lc);

// Fester Zeitpunkt: 27.08.2026, damit August die laufende Saison ist.
const FIXED = new Date('2026-08-27T12:00:00Z').getTime();
const RealDate = Date;
class FakeDate extends RealDate {
  constructor(...a){ if(a.length===0) super(FIXED); else super(...a); }
  static now(){ return FIXED; }
}
globalThis.Date = FakeDate;

const el = () => ({ style:{}, classList:{add(){},remove(){},contains(){return false}},
  addEventListener(){}, removeEventListener(){}, appendChild(){}, remove(){},
  querySelector(){return null}, querySelectorAll(){return []}, setAttribute(){}, getAttribute(){return null},
  insertAdjacentHTML(){}, focus(){}, click(){}, scrollIntoView(){}, dataset:{}, children:[], innerHTML:'', textContent:'' });
globalThis.window = { addEventListener(){}, removeEventListener(){}, location:{href:'',hash:'',reload(){}},
  matchMedia:()=>({matches:false,addEventListener(){},addListener(){}}), navigator:{}, scrollTo(){}, setTimeout, clearTimeout,
  history:{pushState(){},replaceState(){},back(){}}, innerWidth:430, innerHeight:932 };
globalThis.document = { getElementById:()=>el(), querySelector:()=>null, querySelectorAll:()=>[],
  createElement:()=>el(), body:el(), documentElement:el(), addEventListener(){}, removeEventListener(){},
  head:el(), visibilityState:'visible', title:'' };
globalThis.localStorage = { _d:{}, getItem(k){return this._d[k]??null}, setItem(k,v){this._d[k]=String(v)},
  removeItem(k){delete this._d[k]}, clear(){this._d={}} };
globalThis.navigator = { onLine:true, userAgent:'node', serviceWorker:{ register(){return Promise.resolve()} }, clipboard:{writeText(){return Promise.resolve()}} };
globalThis.location = window.location;
globalThis.fetch = () => Promise.resolve({ ok:true, json:()=>Promise.resolve({}), text:()=>Promise.resolve('') });
const ch = () => new Proxy(function(){}, {get(_,p){return p==='then'?undefined:ch()}, apply(){return ch()}});
globalThis.supabase = { createClient: () => ({ from:()=>ch(), channel:()=>ch(), removeChannel(){}, rpc:()=>ch() }) };
globalThis.alert = ()=>{}; globalThis.confirm = ()=>true; globalThis.prompt = ()=>null;
globalThis.requestAnimationFrame = (f)=>setTimeout(f,0);

eval(code);
const K = globalThis.__k;

K.eval(`
  players = ${JSON.stringify(NAMES.map((n,i)=>({id:IDS[i],name:n,hidden:false,elo:0,atk:0.5,avatar_id:null})))};
  matches = ${JSON.stringify(realMatches)};
  matches.sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  seasons = [
    {id:'2026-05',label:'Mai 2026',start_date:'2026-04-30',end_date:'2026-05-31'},
    {id:'2026-06',label:'Juni 2026',start_date:'2026-05-31',end_date:'2026-06-30'},
    {id:'2026-07',label:'Juli 2026',start_date:'2026-06-30',end_date:'2026-07-31'}
  ];
  invalidateCache();
  // DB-First: die App aggregiert m.deltas. Der Export hat keine → einmal
  // mit den Slidern nachrechnen und in die Matches schreiben.
  const _rc = simulateEloWithSliders(matches);
  const _d = {}; _rc.history.forEach(h=>{_d[h.matchId]=h.deltas;});
  matches.forEach(m=>{ m.deltas=_d[m.id]||{}; });
  invalidateCache();
  const _g = getGlobalSim();
  seasons.forEach(s=>{
    const snap=_g.seasonEndElos[s.id]||{}, pl=_g.seasonPlayed[s.id]||{};
    const top=Object.keys(pl).filter(id=>pl[id]>0)
      .map(id=>({id,elo:Math.round(snap[id]??cfg.start_elo),wins:0,losses:0}))
      .sort((a,b)=>b.elo-a.elo);
    s.top_elo=JSON.stringify(top.slice(0,3)); s.player_id=top[0]?top[0].id:null;
  });
  invalidateCache();
  unlocked = true;
`);

let fails = 0, checks = 0;
const ok = (cond, label, extra) => { checks++; if(!cond){ fails++; console.log('  ✗ ' + label + (extra?'  ['+extra+']':'')); } };
const nm = id => NAMES[IDS.indexOf(id)] || id;

console.log('=== 1. KONTEXT ===');
const C = K.eval('_chronicleCtx()');
console.log('gewertete Spieler:', Object.keys(C.P).length, '/', NAMES.length,
  '· Spieltage:', C.totalDays, '· Saisons:', C.seasonCount, '· erster Tag:', C.firstLabel);
ok(Object.keys(C.P).length > 0, 'Kontext hat Spieler');
ok(C.totalDays > 0, 'Spieltage gezählt');

// Unabhängige Nachrechnung direkt auf dem Match-Array
const raw = {};
const ordered = realMatches.slice().sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
const run = {}, runL = {};
ordered.forEach(mm => {
  [mm.a1,mm.a2,mm.b1,mm.b2].forEach(id => {
    const r = raw[id] || (raw[id] = {g:0,w:0,l:0,gf:0,ga:0,ws:0,ls:0,perf:0,deb:0,nail:0,bit:0,close:0,closeW:0,blowW:0});
    const onA = (id===mm.a1||id===mm.a2);
    const w = (onA && mm.winner==='A') || (!onA && mm.winner==='B');
    const gf = onA ? mm.score_a : mm.score_b, ga = onA ? mm.score_b : mm.score_a;
    r.g++; r.gf+=gf; r.ga+=ga; if(w) r.w++; else r.l++;
    if(w&&gf===10&&ga===0) r.perf++;
    if(!w&&gf===0&&ga===10) r.deb++;
    if(w&&gf===10&&ga===9) r.nail++;
    if(!w&&gf===9&&ga===10) r.bit++;
    if(Math.abs(gf-ga)<=2){ r.close++; if(w) r.closeW++; }
    if(w&&gf-ga>=7) r.blowW++;
    if(w){ runL[id]=0; run[id]=(run[id]||0)+1; if(run[id]>r.ws) r.ws=run[id]; }
    else { run[id]=0; runL[id]=(runL[id]||0)+1; if(runL[id]>r.ls) r.ls=runL[id]; }
  });
});
IDS.forEach(id => {
  const p = C.P[id], r = raw[id];
  if(!p || !r) return;
  ok(p.games===r.g,     nm(id)+' Spiele',      p.games+' vs '+r.g);
  ok(p.wins===r.w,      nm(id)+' Siege',       p.wins+' vs '+r.w);
  ok(p.gf===r.gf,       nm(id)+' Tore',        p.gf+' vs '+r.gf);
  ok(p.winStreak===r.ws,nm(id)+' Siegesserie', p.winStreak+' vs '+r.ws);
  ok(p.lossStreak===r.ls,nm(id)+' Pleitenserie',p.lossStreak+' vs '+r.ls);
  ok(p.perfect===r.perf,nm(id)+' 10:0',        p.perfect+' vs '+r.perf);
  ok(p.debacle===r.deb, nm(id)+' 0:10',        p.debacle+' vs '+r.deb);
  ok(p.nail===r.nail,   nm(id)+' 10:9',        p.nail+' vs '+r.nail);
  ok(p.bitter===r.bit,  nm(id)+' 9:10',        p.bitter+' vs '+r.bit);
  ok(p.close===r.close, nm(id)+' enge Spiele', p.close+' vs '+r.close);
  ok(p.blowW===r.blowW, nm(id)+' Kantersiege', p.blowW+' vs '+r.blowW);
});

console.log('\n=== 2. REKORDE SIND ECHTE BESTWERTE ===');
const A = K.eval('allChronicles()');
const CX = K.eval('_chronicleCtx()');
const defs = K.eval("CHRONICLES.map(c=>({id:c.id,name:c.name,kind:c.kind,cond:c.cond,unit:c.unit||null,min:c.min||0}))");
// Der harte Test: fuer JEDEN vergebenen Rekord darf kein anderer gewerteter
// Spieler einen besseren Wert haben. Nachgerechnet ueber die App-Bedingung.
defs.forEach(d => {
  const h = A.byId[d.id];
  if(!h) return;
  let worse = [];
  Object.keys(CX.P).forEach(id => {
    const v = K.eval(`CHRONICLE_BY_ID[${JSON.stringify(d.id)}].val(_chronicleCtx().P[${JSON.stringify(id)}], _chronicleCtx())`);
    if(v == null || !isFinite(v)) return;
    if(v > h.val + 1e-9) worse.push(nm(id) + '=' + v);
  });
  ok(worse.length === 0, '„' + d.name + '" haelt wirklich den Bestwert', worse.join(', '));
});
// Zaehlbare Rekorde zusaetzlich gegen den Rohwert gegengerechnet.
// Nur noch die ECHTEN Volumen-/Höchststand-Rekorde. rec_perfect, rec_nail und
// rec_upset messen seit v9.18 einen ANTEIL und gehoeren zu „Spielweise" —
// bei ihnen waere ein Rohwert-Vergleich genau der Fehler, den sie beheben:
// wer am meisten spielt, sammelt zwangsläufig die meisten 10:9-Siege.
const rawChecks = {unstoppable:'winStreak', peak:'peak'};
Object.keys(rawChecks).forEach(cid => {
  const h = A.byId[cid]; if(!h) return;
  const f = rawChecks[cid];
  // Bestwert ermitteln; bei Gleichstand gilt der dokumentierte Tiebreak
  // (mehr Siege → bessere Tordifferenz → ID), deshalb reicht der Vergleich
  // des WERTES, nicht der Person.
  let topV = -Infinity;
  Object.keys(CX.P).forEach(id => { if(CX.P[id][f] > topV) topV = CX.P[id][f]; });
  ok(CX.P[h.pid][f] === topV, '„' + CHRONICLE_BY_ID_name(cid) + '" haelt den Rohwert-Bestwert',
     nm(h.pid) + ': ' + CX.P[h.pid][f] + ' vs Best ' + topV);
  const tied = Object.keys(CX.P).filter(id => CX.P[id][f] === topV);
  if(tied.length > 1){
    const win = tied.slice().sort((a,b) =>
      CX.P[b].wins - CX.P[a].wins || CX.P[b].gd - CX.P[a].gd || (a < b ? -1 : 1))[0];
    ok(h.pid === win, '„' + CHRONICLE_BY_ID_name(cid) + '" Gleichstand korrekt gebrochen',
       tied.map(nm).join('/') + ' → ' + nm(h.pid));
  }
});
function CHRONICLE_BY_ID_name(cid){ return (defs.find(d=>d.id===cid)||{}).name || cid; }

console.log('\n  Halter je Rekord:');
defs.forEach(d => {
  const h = A.byId[d.id];
  console.log('  ' + d.name.padEnd(30), h ? nm(h.pid).padEnd(9) + h.ev : '— nicht vergeben');
});
console.log('\n  Angezeigte Auszeichnung je Spieler (wertvollster Rekord):');
let held = 0, without = [];
IDS.forEach(id => {
  const c = A.byPid[id];
  if(c){ held++; console.log('  ' + nm(id).padEnd(9), c.name); }
  else without.push(nm(id));
});
console.log('  → ' + held + ' von ' + NAMES.length + ' zeigen einen · ohne: ' + (without.join(', ')||'—'));
IDS.forEach(id => {
  const c = A.byPid[id];
  // Seit v9.19 kann ein Rekord punktgleich geteilt sein — dann steht der
  // Spieler in pids, nicht zwingend an erster Stelle.
  if(c) ok((A.byId[c.id].pids || [A.byId[c.id].pid]).includes(id),
           nm(id) + ': angezeigter Rekord gehoert ihm auch wirklich');
});

console.log('\n=== 2b. FORTSCHRITT FUER SPIELER OHNE REKORD ===');
IDS.forEach(id => {
  const nx = K.eval(`nextRecordFor(${JSON.stringify(id)})`);
  if(A.byPid[id]){ ok(nx === null, nm(id) + ' hat einen Rekord → kein Hinweis'); return; }
  if(!CX.P[id]){ console.log('  ' + nm(id).padEnd(9), '(zu wenige Spiele)'); return; }
  console.log('  ' + nm(id).padEnd(9), nx ? nx.name.padEnd(24) + nx.txt : '— kein Vorschlag');
  ok(!!nx, nm(id) + ' bekommt einen naechsten Rekord vorgeschlagen');
  if(nx){
    ok(nx.need > 0, nm(id) + ': Abstand ist positiv', String(nx.need));
    ok(nx.have < nx.target, nm(id) + ': liegt wirklich darunter', nx.have + ' < ' + nx.target);
    ok(!/undefined|NaN/.test(nx.txt), nm(id) + ': Hinweistext sauber', nx.txt);
    const d = defs.find(x => x.id === nx.id);
    ok(d && d.kind !== 'shame', nm(id) + ': kein Schattenseiten-Ziel', nx.id);
    ok(d && d.unit, nm(id) + ': Ziel ist zaehlbar');
  }
});

console.log('\n=== 3. BELEGE ===');
Object.values(A.byId).forEach(c => {
  ok(/\d/.test(c.ev), '„'+c.name+'" nennt eine Zahl', c.ev);
  ok(c.ev.length < 70, '„'+c.name+'" Beleg passt in eine Zeile', c.ev.length+'');
  ok(!/undefined|NaN|\[object/.test(c.ev), '„'+c.name+'" sauber', c.ev);
});

console.log('\n=== 4. KATALOG ===');
console.log('  ' + defs.length + ' Rekorde, ' + Object.keys(A.byId).length + ' vergeben');
const catIds = defs.map(d=>d.id);
ok(new Set(catIds).size === catIds.length, 'keine doppelte Rekord-ID');
// Seit dem Disziplinen-Merge ist Namensgleichheit kein Fehler mehr, sondern
// die Regel: Monats- und Allzeitwertung derselben Disziplin heißen gleich.
// Was NICHT vorkommen darf, ist derselbe Name unter verschiedenen IDs — dann
// wären es doch wieder zwei Einträge, die dasselbe behaupten.
const stById = JSON.parse(K.eval('JSON.stringify(SEASON_TITLES.map(t=>({id:t.id,name:t.name})))'));
const nameToId = {}; stById.forEach(t => { nameToId[t.name] = t.id; });
defs.forEach(d => ok(!(d.name in nameToId) || nameToId[d.name] === d.id,
  '„'+d.name+'" trägt in beiden Wertungen dieselbe ID'));
const dz = JSON.parse(K.eval('JSON.stringify(DISZIPLINEN.map(d=>({id:d.id,name:d.name,art:d.art,m:!!d.monat,a:!!d.allzeit})))'));
ok(dz.every(d => d.m || d.a), 'jede Disziplin hat mindestens eine Wertung');
ok(new Set(dz.map(d=>d.name)).size === dz.length, 'kein Name zweimal im Katalog');
ok(dz.every(d => ['leistung','ereignis','schatten'].includes(d.art)), 'jede Disziplin hat eine gültige art');
console.log('  ' + dz.length + ' Disziplinen · ' + dz.filter(d=>d.m).length + ' mit Monatswertung · '
  + dz.filter(d=>d.a).length + ' mit Allzeitwertung · ' + dz.filter(d=>d.m&&d.a).length + ' mit beidem');
// Schattenseiten duerfen nie als Ziel vorgeschlagen werden.
defs.filter(d=>d.kind==='shame').forEach(d => ok(!d.unit, '„'+d.name+'" ist kein Fortschrittsziel'));

console.log('\n=== 5. CHRONIK: JEDE SAISON NEU ===');
const sids = K.eval("allSeasonTitles().map(T=>T.sid)");
sids.forEach(sid => {
  const T = K.eval(`seasonTitles(${JSON.stringify(sid)})`);
  const pids = T.awarded.map(a=>a.pid);
  // Ein Spieler DARF mehrere Einträge halten [§C32] — er zeigt nur einen.
  // Was nicht sein darf: derselbe Eintrag zweimal an denselben Spieler.
  const paare = T.awarded.map(a=>a.titleId+'|'+a.pid);
  ok(new Set(paare).size === paare.length, sid+': kein Eintrag geht zweimal an denselben Spieler');
  // Und: in der Matrix steht je Spieler genau einer — seasonTitleOf nimmt
  // den ersten in Katalogreihenfolge, und die IST die Wertigkeit.
  const gezeigt = [...new Set(pids)].map(pid =>
    K.eval(`seasonTitleOf(${JSON.stringify(pid)}, ${JSON.stringify(sid)})`));
  ok(gezeigt.every(x => x && x.titleId), sid+': jeder Traeger hat genau einen Eintrag in der Matrix');
  console.log('  ' + sid, String(T.awarded.length).padStart(2) + ' Eintraege ·',
    T.awarded.map(a=>nm(a.pid)+':'+(a.short||a.name)).join('  '));
});

console.log('\n=== 6. AVATAR-RING ===');
const rings = K.eval('avatarRings()');
const ringed = Object.keys(rings);
console.log('  Spieler mit Ring:', ringed.length, '/', NAMES.length);
ringed.forEach(id => {
  const r = rings[id];
  console.log('  ' + nm(id).padEnd(9), r.kind.padEnd(6), r.label.padEnd(22), r.sub);
  ok(r.label && r.sub, nm(id)+' Ring hat Text');
  ok(!/undefined|NaN/.test(r.sub), nm(id)+' Ring-Text sauber', r.sub);
});
ok(ringed.length <= NAMES.length, 'Ringe nicht mehr als Spieler');
ok(ringed.every(id => Object.keys(rings[id]).length), 'jeder Ring vollständig');

console.log('\n=== 7. MARKEN NEBEN DEM NAMEN ===');
let rowsMarked = 0, liveMarks = 0;
IDS.forEach(id => {
  const ms = K.eval(`_playerRankMarks(${JSON.stringify(id)})`);
  if(ms.length){ rowsMarked++;
    console.log('  ' + nm(id).padEnd(9), ms.map(x=>(x.live?'⌐ ':'')+x.label+' ('+x.sub+')').join('  |  ')); }
  ok(ms.length <= 2, nm(id)+' hat hoechstens zwei Marken', ms.length+'');
  // Genau eine Sorte je Marke: Meistertitel massiv, laufender Eintrag gestrichelt.
  ok(ms.every(x => x.kind === 'champ' || x.kind === 'season'), nm(id)+' Markensorte gueltig');
  ok(ms.filter(x=>x.live).length <= 1, nm(id)+' hoechstens eine laufende Marke');
  liveMarks += ms.filter(x=>x.live).length;
  // Kein Rekord darf sich in die Rangliste schleichen.
  ok(!ms.some(x => x.kind === 'chron'), nm(id)+' traegt keinen Rekord in der Liste');
});
console.log('  → ' + rowsMarked + ' von ' + NAMES.length + ' Zeilen markiert, ' + liveMarks + ' davon laufend');

console.log('\n=== 8. HTML RENDERT ===');
const h1 = K.eval(`_chronStripHtml(${JSON.stringify(IDS[8])})`);
ok(h1.includes('chron-one'), 'Profil zeigt genau eine Rekord-Karte');
// Sichtbar ist genau eine Karte; alles Weitere steckt eingeklappt in
// .chron-rest und kommt erst auf „Mehr anzeigen" (v9.22).
ok(((h1.split('class="chron-rest"')[0]).match(/chron-one/g)||[]).length === 1,
   'genau EINE Rekord-Karte offen im Profil');
ok(h1.includes('chron-strip'), 'Profil zeigt weiter den Saison-Streifen');
ok(!/undefined|NaN/.test(h1), 'Profil-Chronik ohne undefined');
let sheetOk = true;
try { K.eval('showLigaChronik()'); } catch(e){ sheetOk = false; console.log('    showLigaChronik:', e.message); }
ok(sheetOk, 'Liga-Chronik laeuft ohne Fehler');
const defId = defs.find(d=>d.uniq && (by[d.id]||[]).length);
if(defId){
  let cOk = true;
  try { K.eval(`showChronicle(${JSON.stringify(defId.id)})`); } catch(e){ cOk=false; console.log('    showChronicle:', e.message); }
  ok(cOk, 'Chronik-Sheet laeuft ohne Fehler');
}
let stOk = true;
try { K.eval("showSeasonTable('2026-07')"); } catch(e){ stOk=false; console.log('    showSeasonTable:', e.message); }
ok(stOk, 'Saison-Tafel laeuft ohne Fehler');
const h4 = K.eval(`_avRingChipHtml(${JSON.stringify(ringed[0]||IDS[0])})`);
ok(!/undefined|NaN/.test(h4), 'Ring-Chip ohne undefined');
const h5 = K.eval(`avHtml(pmap()[${JSON.stringify(ringed[0]||IDS[0])}], '', {ring:true})`);
console.log('  Avatar mit Ring (nur Profil):', h5);
ok(h5.includes('class="av'), 'Avatar-HTML intakt');
const h6 = K.eval(`avHtml(pmap()[${JSON.stringify(ringed[0]||IDS[0])}], '')`);
ok(!h6.includes('avring'), 'ohne opts.ring kein Ring — Rangliste bleibt ruhig');

console.log('\n=== 9. NEWS ===');
const stories = K.eval('_consolidateStories(_buildStories())');
const breaking = stories.filter(s => K.eval('_isBreaking')(s));
console.log('  Stories:', stories.length, '· davon Breaking:', breaking.length);
breaking.forEach(s => console.log('    ! ' + s.title));
ok(breaking.length <= 3, 'Breaking bleibt sparsam', breaking.length+'');
ok(!stories.some(s => /Ehrentitel/.test(s.title + s.desc)), 'Keine Ehrentitel-Story mehr');
const spot = K.eval(`(function(){
  const T=_ambientTemplatePool(new Date(), pmap(), id=>pname(id));
  const t=T.find(x=>x.key==='chronicle_spotlight');
  return t? t.make(Math.random) : null;
})()`);
if(spot){ console.log('  Chronik-Spotlight:', spot.title, '—', spot.desc); }
ok(spot && spot.title, 'Chronik-Spotlight liefert eine Karte');

console.log('\n=== 10. CHRONIK OHNE MEISTER/KRONPRINZ ===');
const stIds = K.eval('SEASON_TITLES.map(t=>t.id)');
ok(!stIds.includes('champion'), 'Kein Chronik-Eintrag „Der Meister" mehr');
ok(!stIds.includes('crown_prince'), 'Kein Chronik-Eintrag „Der Kronprinz" mehr');
ok(new Set(stIds).size === stIds.length, 'keine doppelten Chronik-IDs');
// Namensgleichheit ist seit dem Merge erwuenscht — geprueft wird oben,
// dass gleiche Namen auch dieselbe ID tragen.
ok(K.eval("SEASON_TITLES.every(t=>t.short && t.short.length<=10)"), 'jedes Kurz-Label passt');
// Der Meistertitel haengt nicht mehr am Katalog, sondern an der Rangliste.
['2026-05','2026-06','2026-07','2026-08'].forEach(sid => {
  const champ = K.eval(`seasonChampion(${JSON.stringify(sid)})`);
  const rank1 = K.eval(`(function(){const C=_seasonTitleCtx(${JSON.stringify(sid)});return C.rank[0]?C.rank[0].id:null;})()`);
  ok(champ === rank1, sid + ': seasonChampion ist Platz 1 der Saison-Elo');
  const T = K.eval(`seasonTitles(${JSON.stringify(sid)})`);
  ok(!T.awarded.some(a => a.pid === champ && false), sid + ': Meister blockiert keinen Chronik-Platz');
});
const leonMarks = K.eval(`JSON.stringify(_playerRankMarks(${JSON.stringify(IDS[NAMES.indexOf('Leon')])}))`);
ok(/"kind":"champ"/.test(leonMarks), 'Krone neben dem Namen kommt weiterhin an');

console.log('\n=== 11. QUOTEN STATT SUMMEN ===');
// Genau die Beschwerde aus der Praxis: Wer die meisten Spiele hat, darf einen
// Anteils-Eintrag nicht automatisch bekommen.
[['thriller','nail','wins'], ['executioner','perfect','wins'], ['giant_slayer','upsets','games']].forEach(([cid, num, den]) => {
  const h = A.byId[cid]; if(!h) return;
  const share = id => CX.P[id][den] ? CX.P[id][num]/CX.P[id][den] : 0;
  let bestId = null;
  Object.keys(CX.P).forEach(id => {
    const v = K.eval(`CHRONICLE_BY_ID[${JSON.stringify(cid)}].val(_chronicleCtx().P[${JSON.stringify(id)}], _chronicleCtx())`);
    if(v == null) return;
    if(bestId === null || share(id) > share(bestId)) bestId = id;
  });
  ok(h.pid === bestId, '„' + CHRONICLE_BY_ID_name(cid) + '" haelt die beste QUOTE',
     nm(h.pid) + ' ' + Math.round(share(h.pid)*100) + '% vs ' + nm(bestId) + ' ' + Math.round(share(bestId)*100) + '%');
  // Die Kind-Taxonomie kommt seit dem Merge aus `art`: leistung->record,
  // ereignis->mark, schatten->shame. Eine Quote ist eine Leistung.
  ok(K.eval(`CHRONICLE_BY_ID[${JSON.stringify(cid)}].art`) === 'leistung',
     '„' + CHRONICLE_BY_ID_name(cid) + '" ist eine Leistung, kein Ereignis');
});
// Volumen-Rekorde gibt es nicht mehr: kein Eintrag darf noch an der reinen
// Spielzahl haengen.
const mostGames = Object.keys(CX.P).reduce((a,b)=>CX.P[a].games>=CX.P[b].games?a:b);

console.log('\n=== 12. AUSZEICHNUNGEN ===');
const bdefs = K.eval("BADGES.filter(b=>['games250','wins200','climber_100','dominator_400','dynasty_600'].includes(b.id)).map(b=>({id:b.id,desc:b.desc,multi:b.multi}))");
const byBid = {}; bdefs.forEach(b=>byBid[b.id]=b);
ok(/300 Matches/.test(byBid.games250.desc), 'Urgestein steht auf 300 Spielen', byBid.games250.desc);
ok(/300 Siege/.test(byBid.wins200.desc), 'Siegermaschine steht auf 300 Siegen', byBid.wins200.desc);
['climber_100','dominator_400','dynasty_600'].forEach(id => {
  ok(byBid[id].multi === true, id + ' ist mehrfach zaehlbar');
  ok(/je Saison/.test(byBid[id].desc), id + ' sagt „je Saison" in der Beschreibung');
});
// Zaehlung gegen eine unabhaengige Rechnung ueber die Saison-Peaks.
const peaks = K.eval('JSON.stringify(seasonPeakElos())');
const PK = JSON.parse(peaks);
[[100,'climber_100'],[400,'dominator_400'],[600,'dynasty_600']].forEach(([mark, bid]) => {
  NAMES.forEach((n,i) => {
    const want = Object.keys(PK).filter(sid => (PK[sid][IDS[i]] ?? -1e9) >= mark).length;
    const got = K.eval(`countSeasonsAtElo(${JSON.stringify(IDS[i])}, ${mark})`);
    ok(got === want, bid + ' zaehlt fuer ' + n + ' richtig', got + ' statt ' + want);
  });
});
// Und: nie mehr als die Anzahl gespielter Saisons.
NAMES.forEach((n,i) => {
  const seasonsPlayed = Object.keys(PK).filter(sid => PK[sid][IDS[i]] !== undefined).length;
  ok(K.eval(`countSeasonsAtElo(${JSON.stringify(IDS[i])}, 100)`) <= seasonsPlayed,
     'Aufsteiger fuer ' + n + ' hoechstens einmal pro gespielter Saison');
});
const domCount = NAMES.map((n,i)=>[n, K.eval(`countSeasonsAtElo(${JSON.stringify(IDS[i])}, 400)`)]).filter(x=>x[1]);
console.log('  Dominator-Saisons:', domCount.map(x=>x[0]+'×'+x[1]).join(', ') || '(keine)');

console.log('\n=== 13. CHRONIK EINFRIEREN ===');
// Vor dem Einfrieren: was der Katalog heute fuer Juli sagt.
const julyLive = K.eval("JSON.stringify(seasonTitles('2026-07'))");
const frozen = K.eval("JSON.stringify(_freezeSeasonTitles('2026-07'))");
const F = JSON.parse(frozen), JL = JSON.parse(julyLive);
ok(F && F.v === 1, 'Formatmarke v=1 gesetzt');
ok(Array.isArray(F.awarded) && F.awarded.length === JL.awarded.length,
   'alle Eintraege eingefroren', F.awarded.length + '/' + JL.awarded.length);
ok(F.awarded.every(a => a.titleId && a.name && a.ic && a.tone && a.cond && a.pid && a.ev),
   'Anzeigefelder mit eingefroren (name/ic/tone/cond/ev)');
ok(F.champ && F.champ.pid === JL.champ.pid, 'Meister mit eingefroren', nm(F.champ.pid));
ok(F.days === JL.days && F.matches === JL.matches, 'Spieltage und Matches mit eingefroren');

// Einfrieren, Cache brechen, wieder lesen.
K.eval(`
  const s = seasons.find(x => x.id === '2026-07');
  s.titles = ${JSON.stringify(frozen)};   // absichtlich als JSON-TEXT, so kommt es aus manchen Clients
  invalidateCache();
`);
const julyRead = JSON.parse(K.eval("JSON.stringify(seasonTitles('2026-07'))"));
ok(julyRead.frozen === true, 'eingefrorene Saison wird gelesen, nicht gerechnet');
ok(JSON.stringify(julyRead.awarded) === JSON.stringify(F.awarded), 'gelesene Eintraege identisch');
ok(K.eval("seasonChampion('2026-07')") === F.champ.pid, 'seasonChampion liest den eingefrorenen Meister');
ok(K.eval("_frozenTitlesOf({titles:'{\"kaputt\":1}'})") === null, 'kaputtes JSON gilt als nicht eingefroren');
ok(K.eval("_frozenTitlesOf({titles:null})") === null, 'NULL gilt als nicht eingefroren');
ok(K.eval("_frozenTitlesOf({titles:{v:1,awarded:[]}})") !== null, 'leere, aber eingefrorene Chronik zaehlt als eingefroren');

// Der eigentliche Punkt: Katalog aendern darf die Vergangenheit nicht anfassen.
const junLiveBefore = JSON.parse(K.eval("JSON.stringify(seasonTitles('2026-06').awarded.map(a=>a.titleId))"));
K.eval("globalThis.__savedCat = SEASON_TITLES.splice(0, SEASON_TITLES.length); invalidateCache();");
const julyAfter = JSON.parse(K.eval("JSON.stringify(seasonTitles('2026-07'))"));
const junAfter = JSON.parse(K.eval("JSON.stringify(seasonTitles('2026-06'))"));
ok(JSON.stringify(julyAfter.awarded) === JSON.stringify(F.awarded),
   'Juli ueberlebt einen komplett geleerten Katalog', julyAfter.awarded.length + ' Eintraege');
ok(junAfter.awarded.length === 0 && junLiveBefore.length > 0,
   'Juni (nicht eingefroren) verliert alles — genau der Schaden, den das Einfrieren verhindert',
   junLiveBefore.length + ' -> ' + junAfter.awarded.length);
// Und die laufende Saison darf NIE aus einem Einfrierer kommen.
K.eval(`
  const cs = currentSeason().id;
  let s = seasons.find(x => x.id === cs);
  if(!s){ s = {id:cs, label:seasonLabel(cs)}; seasons.push(s); }
  s.titles = {v:1, awarded:[], empty:[], champ:null, days:0, matches:0};
  invalidateCache();
`);
const liveAfter = JSON.parse(K.eval("JSON.stringify(seasonTitles(currentSeason().id))"));
ok(!liveAfter.frozen, 'laufende Saison wird trotz gesetzter titles gerechnet');
K.eval("SEASON_TITLES.push(...globalThis.__savedCat); invalidateCache();");
ok(K.eval('SEASON_TITLES.length') === stIds.length, 'Katalog wiederhergestellt');


// ── 14. v9.19: geteilte Rekorde, strikte Superlative, neue Eintraege ──
console.log('\n=== 14. GETEILTE REKORDE UND STRIKTE SUPERLATIVE ===');
const A2 = JSON.parse(K.eval("JSON.stringify(allChronicles().byId)"));
Object.keys(A2).forEach(cid => {
  const e = A2[cid];
  ok(Array.isArray(e.pids) && e.pids.length >= 1 && e.pids[0] === e.pid,
     cid + ': pids[] gesetzt, pid ist der erste Halter');
  ok(e.holders.length === e.pids.length && e.holders.every(h => h.ev),
     cid + ': jeder Halter hat einen eigenen Beleg');
  ok(e.shared === (e.pids.length > 1), cid + ': shared-Flag passt zur Halterzahl');
});
// Jeder Halter eines geteilten Rekords muss exakt denselben Wert haben.
const shared = Object.keys(A2).filter(c => A2[c].shared);
ok(shared.length >= 1, 'in den echten Daten gibt es mindestens einen geteilten Rekord',
   shared.map(c => A2[c].name + ' (' + A2[c].pids.length + ')').join(', ') || '—');
shared.forEach(cid => {
  const vals = K.eval(`(function(){
    const C=_chronicleCtx(), d=CHRONICLE_BY_ID['${cid}'];
    return JSON.stringify(${JSON.stringify(A2[cid].pids)}.map(id=>d.val(C.P[id],C)));
  })()`);
  const v = JSON.parse(vals);
  ok(v.every(x => Math.abs(x - v[0]) <= 1e-9), cid + ': alle Halter haben exakt denselben Wert', vals);
});
// Kein Spieler steht faelschlich als Halter da, obwohl ein anderer besser ist.
Object.keys(A2).forEach(cid => {
  const best = K.eval(`(function(){
    const C=_chronicleCtx(), d=CHRONICLE_BY_ID['${cid}'];
    let bv=-Infinity; Object.keys(C.P).forEach(id=>{const v=d.val(C.P[id],C);
      if(v!=null&&isFinite(v)&&v>bv)bv=v;});
    return bv;
  })()`);
  const mine = K.eval(`(function(){
    const C=_chronicleCtx(), d=CHRONICLE_BY_ID['${cid}'];
    return d.val(C.P['${A2[cid].pid}'],C);
  })()`);
  ok(Math.abs(mine - best) <= 1e-9, cid + ': Halter haelt wirklich den Bestwert');
});
ok(K.eval("_chronHolderNames({pids:IDSX})".replace('IDSX', JSON.stringify([IDS[8], IDS[9]]))) === 'Leon & Martin',
   '_chronHolderNames verbindet zwei Halter mit &');

// [§C32] JEDER Eintrag ist ein Bestwert: er geht an den, der ihn wirklich
// hält, oder an niemanden. Früher galt das nur für vier als `strict`
// markierte Einträge; alle anderen durften an den Nächstbesten
// weiterrutschen. Deshalb gibt es die Markierung nicht mehr — und deshalb
// darf jede Bedingung auch einen Superlativ nennen.
ok(K.eval("SEASON_TITLES.every(t=>t.strict===undefined)"),
   'die Unterscheidung strikt/nicht-strikt gibt es nicht mehr');
JSON.parse(K.eval("JSON.stringify(SEASON_TITLES.map(t=>t.id))")).forEach(tid => {
  ['2026-06','2026-07','2026-08'].forEach(sid => {
    const res = K.eval(`(function(){
      const C=_seasonTitleCtx('${sid}'), T=seasonTitles('${sid}');
      const traeger=T.awarded.filter(x=>x.titleId==='${tid}').map(x=>x.pid);
      if(!traeger.length) return 'leer';
      const r=SEASON_TITLE_BY_ID['${tid}'].pick(C,new Set());
      if(!r) return 'FALSCH: vergeben, aber niemand erfuellt die Bedingung';
      const fremd=traeger.filter(p=>r.halter.indexOf(p)<0);
      return fremd.length ? 'FALSCH: ' + fremd.map(pname).join(', ') : 'best';
    })()`);
    ok(String(res).indexOf('FALSCH') < 0,
       sid + '/' + tid + ': der Eintrag haelt den echten Bestwert', res);
  });
});


// Neue Eintraege sind vorhanden und liefern in den echten Daten Belege.
['best_record','catalyst','spotless','twoway','clutch','damage_control']
  .forEach(id => ok(K.eval(`!!SEASON_TITLE_BY_ID['${id}']`), 'neuer Saison-Eintrag ' + id + ' im Katalog'));
['catalyst','twoway','damage_control']
  .forEach(id => ok(K.eval(`!!CHRONICLE_BY_ID['${id}']`), 'neuer Liga-Rekord ' + id + ' im Katalog'));
ok(K.eval("SEASON_TITLES.every(t=>t.short && t.short.length<=10)"),
   'alle Kurznamen passen in eine Chronik-Zelle');
ok(K.eval("new Set(SEASON_TITLES.map(t=>t.id)).size") === K.eval("SEASON_TITLES.length"),
   'keine doppelten Saison-IDs');
ok(K.eval("new Set(CHRONICLES.map(c=>c.id)).size") === K.eval("CHRONICLES.length"),
   'keine doppelten Rekord-IDs');

// Der Maßstab ist wirklich die beste Bilanz der Saison.
['2026-05','2026-06','2026-07','2026-08'].forEach(sid => {
  const r = K.eval(`(function(){
    const C=_seasonTitleCtx('${sid}'), T=seasonTitles('${sid}');
    const a=T.awarded.find(x=>x.titleId==='best_record');
    if(!a) return 'leer';
    const mine=C.P[a.pid].wins/C.P[a.pid].games;
    let best=-1; Object.keys(C.P).forEach(id=>{const p=C.P[id];
      if(p.games>=10) best=Math.max(best,p.wins/p.games);});
    return Math.abs(mine-best)<=1e-9 ? 'ok' : 'FALSCH';
  })()`);
  ok(r !== 'FALSCH', sid + ': „Der Maßstab" haelt die beste Bilanz ab 10 Spielen', r);
});

// Chronik-Streifen im Profil: neueste Saison links.
const stripOrder = K.eval(`(function(){
  const html=_chronStripHtml('${IDS[8]}');
  const out=[]; const rx=/data-season-table="([0-9-]+)"/g; let m;
  while((m=rx.exec(html))) out.push(m[1]);
  return out.join(',');
})()`);
const stripArr = stripOrder.split(',').filter(Boolean);
ok(stripArr.length >= 2, 'Profil-Streifen zeigt mehrere Saisons', stripOrder);
ok(stripArr.join(',') === stripArr.slice().sort().reverse().join(','),
   'neueste Saison steht links', stripOrder);

// ─── 15. v9.20: keine Team-Chroniken, Leistung vor Pensum ───────────
console.log('\n=== 15. EINZELLEISTUNGEN STATT VERBINDUNGEN ===');

ok(K.eval("!CHRON_KINDS.bond"), 'die Kategorie „Verbindung" gibt es nicht mehr');
ok(K.eval("CHRONICLES.every(c=>!!CHRON_KINDS[c.kind])"), 'jeder Rekord hat eine gueltige Kategorie');
['bond_brothers','bond_prey','bond_shadow','bond_nemesis','bond_marriage','rec_tots']
  .forEach(id => ok(K.eval(`!CHRONICLE_BY_ID['${id}']`), 'Team-Rekord ' + id + ' ist raus'));
['social','shadow'].forEach(id =>
  ok(K.eval(`!SEASON_TITLE_BY_ID['${id}']`), 'partnerbasierter Saison-Eintrag ' + id + ' ist raus'));

// Kein Beleg nennt noch einen zweiten Spieler beim Namen.
ok(K.eval(`(function(){
  const C=_chronicleCtx(), A=allChronicles();
  const names=Object.values(pmap()).map(p=>p.name);
  const hits=[];
  Object.values(A.byId).forEach(e=>{
    const mine=(pmap()[e.pid]||{}).name;
    (e.holders||[]).forEach(h=>{
      const own=(pmap()[h.pid]||{}).name;
      names.forEach(n=>{ if(n!==own && String(h.ev).indexOf(n)>=0) hits.push(e.id+':'+n); });
    });
  });
  return hits.join(',');
})()`) === '', 'kein Rekord-Beleg nennt einen anderen Spieler');

// Neue Eintraege sind da und haengen an den neuen Kennzahlen.
['daylord','reliable'].forEach(id =>
  ok(K.eval(`!!SEASON_TITLE_BY_ID['${id}']`), 'neuer Saison-Eintrag ' + id + ' im Katalog'));
['weekking','daylord','reliable','spotless','comeback_king'].forEach(id =>
  ok(K.eval(`!!CHRONICLE_BY_ID['${id}']`), 'neuer Liga-Rekord ' + id + ' im Katalog'));

const ctxFields = K.eval(`(function(){
  const C=_chronicleCtx(); const p=C.P[Object.keys(C.P)[0]];
  return ['weeks','posWeeks','afterLoss','afterLossOpp','potw','potd']
    .filter(f=>typeof p[f]!=='number').join(',');
})()`);
ok(ctxFields === '', 'Laufbahn-Kontext liefert die neuen Kennzahlen', ctxFields);

const sctxFields = K.eval(`(function(){
  const C=_seasonTitleCtx('2026-07'); const p=C.P[Object.keys(C.P)[0]];
  return ['potd','posDays','days'].filter(f=>typeof p[f]!=='number').join(',');
})()`);
ok(sctxFields === '', 'Saison-Kontext liefert potd und posDays', sctxFields);

// Wochen-Bezugsgroesse stimmt: potw kann nie ueber den gespielten Wochen liegen.
ok(K.eval(`(function(){
  const C=_chronicleCtx();
  return Object.keys(C.P).filter(id=>{const p=C.P[id];
    return p.potw>p.weeks || p.potd>p.days || p.posWeeks>p.weeks || p.afterLoss>p.afterLossOpp;
  }).length;
})()`) === 0, 'Quoten-Zaehler bleiben unter ihrer Bezugsgroesse');

// Der Wochenkoenig haelt wirklich die beste Quote, nicht die meisten Titel.
ok(K.eval(`(function(){
  const C=_chronicleCtx(), h=allChronicles().byId['rec_potw'];
  if(!h) return 'leer';
  let best=-1; Object.keys(C.P).forEach(id=>{const p=C.P[id];
    if(p.weeks>=10) best=Math.max(best,p.potw/p.weeks);});
  return Math.abs(h.val-best)<=1e-9 ? 'ok' : 'FALSCH';
})()`) !== 'FALSCH', '„Der Wochenkoenig" haelt die beste Quote ab 10 Wochen');

// Leistung vor Ereignis vor Schatten — beide Listen stammen aus derselben
// Katalog-Reihenfolge. Bei den Rekorden duerfen einzelne Eintraege bewusst
// vorgezogen sein (CHRON_VORRANG); der Rest muss die Ordnung halten.
// Pensum-Eintraege gibt es nicht mehr; geprueft wird, dass keiner zurueckkommt.
const RANG = {leistung:0, ereignis:1, schatten:2};
const VOR = JSON.parse(K.eval('JSON.stringify(CHRON_VORRANG)'));
['SEASON_TITLES','CHRONICLES'].forEach(liste => {
  const alle = JSON.parse(K.eval(`JSON.stringify(${liste}.map(x=>({id:x.id,art:x.art})))`));
  const arts = alle.filter(x => !VOR.includes(x.id)).map(x => x.art);
  const sortiert = arts.every((a,i) => i === 0 || RANG[arts[i-1]] <= RANG[a]);
  ok(sortiert, liste + ': Leistung vor Ereignis vor Schatten', arts.join(','));
  ok(alle.every(x => x.art !== 'pensum'), liste + ': kein Pensum-Eintrag mehr');
});
// Die Siegesserie ist die eine gewollte Ausnahme: sie steht vor der besten
// Bilanz, obwohl sie ein Ereignis ist und die Bilanz eine Leistung.
const iSerie = K.eval("CHRONICLES.findIndex(c=>c.id==='unstoppable')");
const iMass  = K.eval("CHRONICLES.findIndex(c=>c.id==='best_record')");
ok(iSerie >= 0 && iMass >= 0 && iSerie < iMass,
   'die Siegesserie steht vor dem Massstab', iSerie + ' vs ' + iMass);
ok(VOR.every(id => K.eval(`CHRONICLES.some(c=>c.id===${JSON.stringify(id)})`)),
   'jeder Vorrang-Eintrag existiert auch im Katalog');
const weg = ['rec_wins','rec_goals','rec_games','rec_day','rec_always','trait_workhorse',
             'trait_founder','arc_veteran','marathon','tireless','omnipresent',
             'night_owl','early_riser','efficient','flawless','rec_cleanday'];
weg.forEach(id => ok(K.eval(`!DISZIPLINEN.some(d=>d.id==='${id}')`),
  'gestrichen und nicht zurueckgekehrt: ' + id));
ok(K.eval(`(function(){
  const i = CHRONICLES.findIndex(c=>c.kind==='shame');
  return i > 0 && CHRONICLES.slice(i).every(c=>c.kind==='shame');
})()`), 'die Schattenseiten stehen geschlossen am Ende');

// Streifen: Monate ohne Eintrag tauchen gar nicht mehr auf.
const stripCells = K.eval(`(function(){
  const pid='${IDS[8]}';
  const rows=seasonTitleHistory(pid);
  const html=_chronStripHtml(pid);
  const cells=(html.match(/class="chron-cell/g)||[]).length;
  return cells + '/' + rows.filter(r=>r.title).length + '/' + rows.length;
})()`);
const sc = stripCells.split('/').map(Number);
ok(sc[0] === sc[1], 'der Streifen zeigt genau so viele Zellen wie Eintraege', stripCells);
ok(!K.eval(`_chronStripHtml('${IDS[8]}').includes('class="dash"')`),
   'kein Strich-Platzhalter mehr im Streifen');
ok(K.eval(`(function(){
  // Ein Spieler ohne einen einzigen Eintrag bekommt einen Satz statt Striche.
  const pid=Object.keys(pmap()).find(id=>seasonTitleHistory(id).length && !seasonTitleHistory(id).some(r=>r.title));
  if(!pid) return 'kein solcher Spieler';
  const h=_chronStripHtml(pid);
  return h.includes('chron-cell') ? 'FALSCH' : 'ok';
})()`) !== 'FALSCH', 'ohne Eintrag zeigt der Streifen keine leeren Zellen');

// ─── 16. v9.21: echte Bestwerte, Wert vor Haeufigkeit ───────────────
console.log('\n=== 16. ECHTE BESTWERTE, WERT VOR HAEUFIGKEIT ===');

// Die Serie ist der Pruefstein: sie behauptet einen Superlativ, und ihr
// Traeger muss ihn halten. Vorher blieb sie in drei von vier Monaten leer,
// weil der Halter der laengsten Serie schon einen anderen Eintrag trug.
const SUP = {unstoppable:'bestStreak', drought:'worstLoss'};
['2026-05','2026-06','2026-07','2026-08'].forEach(sid => {
  Object.keys(SUP).forEach(id => {
    const r = K.eval(`(function(){
      const C=_seasonTitleCtx('${sid}'), T=seasonTitles('${sid}');
      const a=T.awarded.find(x=>x.titleId==='${id}');
      if(!a) return 'leer';
      const f='${SUP[id]}';
      let best=-Infinity; Object.keys(C.P).forEach(pid=>{ best=Math.max(best, C.P[pid][f]); });
      return C.P[a.pid][f] === best ? 'ok' : 'FALSCH ' + C.P[a.pid][f] + ' statt ' + best;
    })()`);
    ok(String(r).indexOf('FALSCH') < 0, sid + ': ' + id + ' haelt wirklich den Bestwert', r);
  });
});

// Ein Monat mit zu wenigen Spieltagen bekommt gar keine Chronik: aus drei
// Abenden laesst sich kein Monat ablesen, und eine Siegquote aus zwoelf
// Spielen ist ein Zufall. Der Mai der Liga hatte drei.
const _mai = JSON.parse(K.eval(`JSON.stringify((function(){
  const C=_seasonTitleCtx('2026-05');
  return {tage:C.days, vergeben:seasonTitles('2026-05').awarded.length, grenze:CHRONIK_MIN_TAGE};
})())`));
ok(_mai.tage < _mai.grenze && _mai.vergeben === 0,
   'ein Monat unter der Spieltag-Grenze bekommt keine Chronik',
   _mai.tage + ' Spieltage, Grenze ' + _mai.grenze + ', vergeben ' + _mai.vergeben);

// Wert vor Haeufigkeit: was viele erreichen, greift zuletzt zu.
const iS = id => K.eval(`SEASON_TITLES.findIndex(t=>t.id==='${id}')`);
// unstoppable und kingslayer sind seit dem Merge Ereignisse und stehen
// deshalb hinter ALLEN Leistungen — sie gehoeren nicht in diesen Vergleich.
const selten = ['daylord','reliable','twoway','spotless','catalyst'];
const haeufig = ['comeback_king','thriller','damage_control'];
ok(Math.max(...selten.map(iS)) < Math.min(...haeufig.map(iS)),
   'seltene Eintraege greifen vor den leicht erreichten zu');
ok(iS('damage_control') === Math.max(...['damage_control','thriller','comeback_king'].map(iS)),
   'der am haeufigsten erreichte Eintrag steht zuletzt in seinem Block');

// Profil: die Meta-Zeile neben „Liga-Rekord" ist weg.
const profHtml = K.eval(`_chronStripHtml('${IDS[8]}')`);
ok(profHtml.indexOf('nur einmal vergeben') < 0, 'kein „nur einmal vergeben" mehr im Profil');
ok(profHtml.indexOf('geteilt mit') < 0, 'kein „geteilt mit X" mehr im Profil');
// Wer im Profil einen GETEILTEN Rekord zeigt, bekommt die Marke am Namen —
// und nur der. Wessen angezeigter Rekord ihm allein gehoert, sieht nichts.
ok(K.eval(`(function(){
  const bad=[];
  Object.keys(pmap()).forEach(pid=>{
    const mine=chroniclesOfPlayer(pid); if(!mine.length) return;
    const soll=mine.filter(x=>x.shared).length;
    const ist=((_chronStripHtml(pid).match(/class="shared"/g)||[]).length);
    if(soll!==ist) bad.push((pmap()[pid]||{}).name+':'+ist+'/'+soll);
  });
  return bad.join(',');
})()`) === '', 'die Geteilt-Marke steht genau bei geteilten Rekorden');

// ─── 17. v9.22: Ausnahmetage und alle Rekorde im Profil ─────────────
console.log('\n=== 17. AUSNAHMETAGE UND ALLE REKORDE IM PROFIL ===');

['best_record','eloday','peak','clutch'].forEach(id =>
  ok(K.eval(`!!CHRONICLE_BY_ID['${id}']`), 'neuer Ausnahme-Rekord ' + id + ' im Katalog'));

// Jeder dieser Rekorde haelt wirklich das Maximum seiner Kennzahl.
[['eloday','dayElo'],['peak','peak']].forEach(([id,f]) => {
  ok(K.eval(`(function(){
    const C=_chronicleCtx(), h=allChronicles().byId['${id}'];
    if(!h) return 'leer';
    let best=-Infinity; Object.keys(C.P).forEach(pid=>{
      const v=C.P[pid]['${f}']; if(v!=null) best=Math.max(best,v); });
    return Math.abs(Math.round(C.P[h.pid]['${f}']) - Math.round(best))<=0 ? 'ok'
         : 'FALSCH ' + C.P[h.pid]['${f}'] + ' statt ' + best;
  })()`).indexOf('FALSCH') < 0, id + ' haelt das echte Maximum');
});
ok(K.eval(`(function(){
  const C=_chronicleCtx(), h=allChronicles().byId['best_record'];
  if(!h) return 'leer';
  let best=-1; Object.keys(C.P).forEach(pid=>{
    const b=C.P[pid].bestMonth; if(b) best=Math.max(best,b.q); });
  return Math.abs(h.val-best)<=1e-9 ? 'ok' : 'FALSCH';
})()`) !== 'FALSCH', '„Der Massstab" haelt die beste Monatsquote');

// Der unantastbare Tag ist wirklich makellos: an dem Tag keine Niederlage.
ok(K.eval(`(function(){
  const C=_chronicleCtx();
  return Object.keys(C.P).filter(id=>{
    const p=C.P[id];
    return p.cleanDay > 0 && (p.cleanDay > p.maxDay || p.cleanDay > p.wins);
  }).length;
})()`) === 0, 'ein makelloser Tag ist nie groesser als der laengste Tag');

// chroniclesOfPlayer deckt sich mit byId — kein Rekord faellt unter den Tisch.
ok(K.eval(`(function(){
  const A=allChronicles(); const bad=[];
  Object.keys(pmap()).forEach(pid=>{
    const mine=chroniclesOfPlayer(pid).map(x=>x.id).sort().join(',');
    const soll=Object.values(A.byId).filter(e=>(e.pids||[e.pid]).includes(pid))
      .map(e=>e.id).sort().join(',');
    if(mine!==soll) bad.push((pmap()[pid]||{}).name);
  });
  return bad.join(',');
})()`) === '', 'chroniclesOfPlayer listet genau die Rekorde des Spielers');
ok(K.eval(`(function(){
  const A=allChronicles(); const bad=[];
  Object.keys(pmap()).forEach(pid=>{
    const mine=chroniclesOfPlayer(pid);
    if(!mine.length) return;
    const first=(A.byPid[pid]||{}).id;
    if(mine[0].id!==first) bad.push((pmap()[pid]||{}).name);
  });
  return bad.join(',');
})()`) === '', 'der erste Rekord der Liste ist der im Profil gezeigte');

// „Mehr anzeigen" erscheint genau dann, wenn es mehr als einen Rekord gibt.
ok(K.eval(`(function(){
  const bad=[];
  Object.keys(pmap()).forEach(pid=>{
    const n=chroniclesOfPlayer(pid).length;
    const h=_chronStripHtml(pid);
    const more=h.indexOf('data-chron-more')>=0;
    const next=h.indexOf('chron-one next')>=0;
    if(more !== (n>1)) bad.push((pmap()[pid]||{}).name+':more');
    if(n>0 && next) bad.push((pmap()[pid]||{}).name+':nextTrotzRekord');
  });
  return bad.join(',');
})()`) === '', 'Mehr-anzeigen nur bei mehreren Rekorden, Fortschritt nur ohne Rekord');
ok(K.eval(`(function(){
  // Wer mehrere haelt, hat auch alle Karten im HTML — nur eingeklappt.
  const pid=Object.keys(pmap()).find(id=>chroniclesOfPlayer(id).length>2);
  if(!pid) return 'kein Spieler mit 3+ Rekorden';
  const h=_chronStripHtml(pid);
  const n=chroniclesOfPlayer(pid).length;
  // Schattenseiten tragen zusaetzlich die Klasse "schatten" — mitzaehlen.
  const cards=(h.match(/class="chron-one[^"]*"/g)||[]).length;
  return cards===n && h.indexOf('class="chron-rest"')>=0 ? 'ok' : 'FALSCH ' + cards + '/' + n;
})()`).indexOf('FALSCH') < 0, 'alle Rekorde stecken im Profil-HTML');

// ══════════════════════════════════════════════════════════════════════
console.log('\n═══ PRESTIGE: BREITE STATT REKORDJAGD ═══');
// Drei Zusicherungen an das Insignium, alle an den echten 466 Partien
// gemessen. Sie hingen bisher an nichts — und genau deshalb konnte der
// Katalog wachsen, ohne dass jemand merkte, was er mit dem Reif macht.
const _prG = JSON.parse(K.eval(`JSON.stringify((function(){
  const T = prestigeTabelle();
  let a=0, m=0, r=0;
  const stufen={}, mitRekord=[];
  T.rang.forEach(pid=>{
    const e=T.byPid[pid], P=prestigeOf(pid);
    a+=e.teile.auszeichnung; m+=e.teile.monat; r+=e.teile.rekord;
    stufen[P.insignie.key]=(stufen[P.insignie.key]||0)+1;
    if(e.zahlen.rekord>0) mitRekord.push(pid);
  });
  return {a, m, r, stufen, spieler:T.rang.length, mitRekord:mitRekord.length,
          hoechste:T.byPid[T.rang[0]].punkte,
          sternAb:INSIGNIEN[INSIGNIEN.length-1].min};
})())`));
const _prSum = _prG.a + _prG.m + _prG.r;
console.log(`  Auszeichnungen ${Math.round(_prG.a/_prSum*100)} % · Monat ${Math.round(_prG.m/_prSum*100)} % · Rekorde ${Math.round(_prG.r/_prSum*100)} %`);
console.log(`  Stufen: ${Object.entries(_prG.stufen).map(([k,v])=>k+' '+v).join(' · ')}`);
console.log(`  Spieler mit mindestens einem Rekord: ${_prG.mitRekord} von ${_prG.spieler}`);

// 1. Rekorde dürfen das Insignium nicht allein tragen. Wer Rekorde hält,
//    hält meist auch viele Auszeichnungen — wenn die Rekorde trotzdem den
//    größten Block stellen, ist der Reif eine Rekordanzeige geworden.
ok(_prG.r < _prG.a,
   'Auszeichnungen wiegen schwerer als Rekorde',
   `Auszeichnungen ${_prG.a}, Rekorde ${_prG.r}`);
// 2. Kein Block dominiert. Bei drei Quellen wäre ein Drittel gleichmäßig;
//    45 % lassen Spielraum, ohne dass eine Quelle die anderen erdrückt.
ok(Math.max(_prG.a, _prG.m, _prG.r) / _prSum <= 0.50,
   'kein Block stellt mehr als die Hälfte des Prestiges der Liga',
   `größter Block ${Math.round(Math.max(_prG.a,_prG.m,_prG.r)/_prSum*100)} %`);
// 3. Rekorde müssen erreichbar sein. Vor dem Senken der Mindest-Spielzahlen
//    hielten 5 von 12 Spielern einen wertenden Rekord — die anderen sieben
//    spielten zu wenig, um überhaupt in die Wertung zu kommen („ab 100
//    Spielen", „ab 60 Siegen"). Eine Bestenliste, an der die halbe Liga gar
//    nicht teilnehmen darf, misst das Pensum und nicht das Können.
//    Jetzt sind es 7 von 12. Die Schwelle steht auf „mehr als die Hälfte":
//    das ist der Stand, der wirklich erreicht ist, und nicht der, den man
//    gern hätte. Schattenseiten zählen hier nicht mit — sie tragen kein
//    Prestige, also sagen sie über die Erreichbarkeit nichts.
ok(_prG.mitRekord > _prG.spieler / 2,
   'mehr als die halbe Liga hält einen wertenden Rekord',
   `${_prG.mitRekord} von ${_prG.spieler}`);
// 4. Der Ordensstern bleibt außer Reichweite, solange ihn niemand erspielt
//    hat. Er darf nicht dadurch fallen, dass der Katalog wächst.
ok(_prG.hoechste < _prG.sternAb,
   'der Ordensstern ist noch von niemandem erreicht',
   `bester Stand ${_prG.hoechste}, Schwelle ${_prG.sternAb}`);


// ══════════════════════════════════════════════════════════════════════
console.log('\n═══ DIE LEITER DES INSIGNIUMS ═══');
// Nach vier Monaten Liga trugen zehn von zwölf Spielern mindestens den
// Kerbring, sechs den Strahlenkranz und drei schon den Lorbeerreif — die
// vierte von fünf Stufen. Wer oben ankommt, während die Liga noch jung ist,
// hat danach nichts mehr vor sich. Diese vier Zusicherungen halten die
// Leiter steil, und zwar an den echten Partien gemessen.
const _lb = JSON.parse(K.eval(`JSON.stringify((function(){
  const T = prestigeTabelle();
  const stufen = INSIGNIEN.map(()=>0);
  const grade = {};
  T.rang.forEach(pid=>{ const P=prestigeOf(pid);
    stufen[P.stufe]++; grade[P.grad]=(grade[P.grad]||0)+1; });
  const m = '#c2c9d0';
  return {
    min: INSIGNIEN.map(x=>x.min),
    namen: INSIGNIEN.map(x=>x.name),
    stufen, grade,
    spieler: T.rang.length,
    hoechste: T.byPid[T.rang[0]].punkte,
    erstStufe: T.rang.filter(pid=>prestigeOf(pid).stufe >= 1).length,
    // Ändert der Grad die Zeichnung überhaupt? Gefragt ist die Form, nicht
    // die Farbe — deshalb dasselbe Metall, nur ein anderer Grad.
    formen: INSIGNIEN.slice(0,4).map(x=>({key:x.key,
      a: insigniumStufeSvg(x.key, m, 0, 0).length,
      b: insigniumStufeSvg(x.key, m, 0, 1).length,
      c: insigniumStufeSvg(x.key, m, 0, 2).length}))
  };
})())`));
console.log('  Schwellen: ' + _lb.min.join(' · '));
console.log('  Getragen:  ' + _lb.namen.map((n,i)=>n+' '+_lb.stufen[i]).join(' · '));
console.log('  Bester Stand: ' + _lb.hoechste);

// 1. Jede Stufe kostet mindestens doppelt so viel wie die vorige. Das ist die
//    Regel, aus der die Schwellen kommen — steht sie nicht im Test, wird sie
//    beim nächsten Nachjustieren still aufgegeben.
const _spannen = _lb.min.slice(1).map((v,i)=>v - _lb.min[i]);
let _steil = true;
for(let i=1;i<_spannen.length;i++) if(_spannen[i] < _spannen[i-1]*2) _steil = false;
ok(_steil,
   'jede Stufe kostet mindestens das Doppelte der vorigen',
   'Spannen ' + _spannen.join(' · '));

// 2. Der Beste der Liga hat die obere Hälfte der Leiter noch vor sich. Ohne
//    diese Grenze wandert die Spitze nach oben, sobald der Katalog wächst —
//    und dann trägt jemand den Lorbeerreif, weil neue Rekorde dazukamen und
//    nicht, weil er besser geworden wäre.
ok(_lb.hoechste < _lb.min[3],
   'der Beste der Liga trägt noch keinen Lorbeerreif',
   `bester Stand ${_lb.hoechste}, Schwelle ${_lb.min[3]}`);

// 3. Die ERSTE Stufe bleibt erreichbar. Sie sagt „du bist dabei", nicht „du
//    bist gut" — eine Leiter, auf der die halbe Liga nicht einmal die
//    unterste Sprosse erreicht, motiviert niemanden.
ok(_lb.erstStufe > _lb.spieler / 2,
   'mehr als die halbe Liga trägt mindestens den Kerbring',
   `${_lb.erstStufe} von ${_lb.spieler}`);

// 4. Der Grad muss man SEHEN. Zwischen zwei Schwellen liegen hunderte
//    Punkte; täte sich am Zeichen nichts, wäre die halbe Laufbahn ein
//    Stillstand. Geprüft wird jede Stufe außer dem Ordensstern — der zählt
//    Zacken statt Grade.
const _stumm = _lb.formen.filter(f => f.a === f.b || f.b === f.c);
ok(_stumm.length === 0,
   'jeder Grad zeichnet ein anderes Insignium',
   _stumm.length ? _stumm.map(f=>f.key).join(', ') + ' ändern sich nicht'
                 : _lb.formen.map(f=>f.key).join(', '));


// ══════════════════════════════════════════════════════════════════════
console.log('\n═══ REKORDE ZUM STAND EINES MONATS ═══');
// „Neue Rekorde dieser Saison" gibt es nur, wenn die Rekordlage von DAMALS
// rekonstruierbar ist. Wer die heutige Liste in den Mai-Rückblick legt,
// zeigt Bestwerte, die im Juli aufgestellt wurden. Der Schnitt muss beide
// Quellen treffen: die Matchliste UND die Elo-Simulation. Diese vier
// Zusicherungen prüfen genau das, an den echten Partien gemessen.
const _sr = JSON.parse(K.eval(`JSON.stringify((function(){
  const sids = allPastSeasons();
  const proSaison = sids.map(s => saisonRekorde(s));
  const ersten = {};
  proSaison.forEach(L => L.forEach(r => { if(r.art === 'neu') ersten[r.id] = (ersten[r.id]||0)+1; }));
  const stand = sids.map(s => {
    const C = allChronicles(seasonEnd(s).getTime());
    return {sid:s, rekorde:Object.keys(C.byId).length, bewertet:C.rated};
  });
  const h = allChronicles();
  // Der höchste Elo-Stand kommt NICHT aus der Matchliste, sondern aus der
  // Simulation. Er ist deshalb die einzige Zahl, an der man sieht, ob auch
  // sie geschnitten wurde.
  const C6 = _chronicleCtx(seasonEnd(sids[1]).getTime()), H = _chronicleCtx();
  const gipfel = Object.keys(C6.P).map(id => ({
    n:pname(id), damals:C6.P[id].peak, heute:H.P[id] ? H.P[id].peak : null}));
  return {
    sids, stand, zahlen: proSaison.map(L => L.length),
    heute: {rekorde:Object.keys(h.byId).length, bewertet:h.rated},
    mehrfachErstmals: Object.keys(ersten).filter(k => ersten[k] > 1),
    schatten: proSaison.reduce((n,L) => n + L.filter(r => r.kind === 'shame').length, 0),
    hoeher: gipfel.filter(g => g.damals > g.heute).map(g => g.n),
    niedriger: gipfel.filter(g => g.damals < g.heute).map(g => g.n)
  };
})())`));
console.log('  Bewegte Rekorde je Saison: ' + _sr.sids.map((s,i)=>s+' '+_sr.zahlen[i]).join(' · '));
console.log('  Rekordlage am Monatsende:  '
  + _sr.stand.map(s=>s.sid+' '+s.rekorde+'/'+s.bewertet).join(' · ')
  + ' · heute ' + _sr.heute.rekorde + '/' + _sr.heute.bewertet);

// 1. Am Ende des ERSTEN Monats hält niemand einen Rekord: nach vier Wochen
//    hat noch keiner die 30 Spiele beisammen, die eine Laufbahn ausmachen.
//    Steht hier die volle Zahl, kommt die Liste aus der Gegenwart.
ok(_sr.stand[0].rekorde === 0 && _sr.stand[0].bewertet === 0,
   'am Ende des ersten Monats hält niemand einen Rekord',
   _sr.stand[0].rekorde + ' Rekorde, ' + _sr.stand[0].bewertet + ' bewertete Spieler');

// 2. Der höchste Elo-Stand von damals darf den heutigen nie übertreffen —
//    und mindestens einer muss darunter liegen, sonst rechnet die
//    Simulation weiter mit allen Partien und der Schnitt greift nur halb.
ok(_sr.hoeher.length === 0 && _sr.niedriger.length > 0,
   'auch die Elo-Simulation endet am Monatsende',
   _sr.niedriger.length + ' Spieler standen damals tiefer'
   + (_sr.hoeher.length ? ', aber ' + _sr.hoeher.join(', ') + ' höher' : ''));

// 3. Ein Rekord wird genau einmal zum ersten Mal aufgestellt. Zweimal hieße,
//    dass er zwischendurch verschwunden ist — also dass das Fenster wandert.
ok(_sr.mehrfachErstmals.length === 0,
   'kein Rekord wird in zwei Monaten zum ersten Mal aufgestellt',
   _sr.mehrfachErstmals.join(', ') || 'keiner');

// 4. Keine Schattenseite im Rückblick. „Die längste Durststrecke" ist keine
//    Nachricht, sondern eine Ohrfeige — und die Liga liest ihn gemeinsam.
ok(_sr.schatten === 0, 'keine Schattenseite in den Rekorden einer Saison',
   _sr.schatten + ' gefunden');

console.log('\n' + (fails ? '✗ ' + fails + ' von ' + checks + ' CHECKS FEHLGESCHLAGEN' : '✓ ALLE ' + checks + ' CHECKS BESTANDEN'));
process.exit(fails ? 1 : 0);
