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
const ok = (c, l, x) => { checks++; if(!c){ fails++; console.log('  ✗ ' + l + (x?'  ['+x+']':'')); } else console.log('  ok    ' + l + (x?'  ('+x+')':'')); };
const nm = id => NAMES[IDS.indexOf(id)] || id;

// Hilfsfunktion: Ambient-Stories fuer einen gegebenen Zeitpunkt bauen, mit
// einem vorgegebenen Bestand an schon persistierten Stories.
function build(iso, existing){
  return K.eval(`(function(){
    _cache._stories = ${JSON.stringify(existing || [])}.map(s => Object.assign({}, s, {when:new Date(s.when)}));
    return _buildAmbientStories(new Date(${JSON.stringify(iso)}), pmap(), id=>pname(id))
      .map(s => ({id:s.id, when:s.when.toISOString(), sub:s.dataRef.sub, title:s.title,
                  pids:(s.dataRef.ambientPids||(s.dataRef.ambientPid?[s.dataRef.ambientPid]:[]))}));
  })()`);
}

console.log('=== 1. NACHSCHUB FUELLT LUECKEN ===');
const NOW = '2026-08-27T20:30:00Z';   // nach beiden Slots des Tages (lokal)
const fresh = build(NOW, []);
console.log('  Slots aus leerem Bestand: ' + fresh.length);
fresh.forEach(s => console.log('    ' + s.id + '  ' + s.when.slice(0,16) + '  ' + s.sub));
ok(fresh.length === (K.eval('AMBIENT_BACKFILL_DAYS') + 1) * 2,
   'genau (BACKFILL_DAYS+1) × 2 Slots', fresh.length + '');
ok(new Set(fresh.map(s=>s.id)).size === fresh.length, 'keine doppelten IDs');
ok(fresh.every(s => /^ambient_\d{4}-\d{2}-\d{2}_(10|19)$/.test(s.id)), 'ID-Schema unveraendert');

console.log('\n=== 2. WHEN LIEGT AUF DEM ECHTEN SLOT ===');
fresh.forEach(s => {
  const m = /^ambient_(\d{4}-\d{2}-\d{2})_(\d+)$/.exec(s.id);
  const d = new Date(s.when);
  ok(d.getHours() === +m[2], s.id + ': when trifft die Slot-Stunde', d.toISOString());
  ok(d.getTime() <= new Date(NOW).getTime(), s.id + ': liegt nicht in der Zukunft');
});
const sorted = fresh.map(s=>new Date(s.when).getTime());
ok(sorted.every((t,i)=>i===0||t>=sorted[i-1]), 'chronologisch aufsteigend erzeugt');

console.log('\n=== 3. IDEMPOTENZ ===');
// Was schon persistiert ist, wird nicht noch einmal erzeugt.
const asStored = fresh.map(s => ({id:s.id, when:s.when, dataRef:{type:'ambient', sub:s.sub,
  ambientPids:s.pids}}));
const second = build(NOW, asStored);
ok(second.length === 0, 'zweiter Lauf erzeugt nichts mehr', second.length + '');
// Nur der Abend-Slot von vorgestern fehlt → genau der kommt nach.
const gapId = fresh[fresh.length-3] ? fresh[fresh.length-3].id : null;
const withGap = asStored.filter(s => s.id !== gapId);
const filled = build(NOW, withGap);
ok(filled.length === 1 && filled[0].id === gapId, 'einzelne Luecke wird gezielt gefuellt',
   filled.map(s=>s.id).join(','));

console.log('\n=== 4. DETERMINISMUS ===');
// Derselbe Slot muss denselben Inhalt liefern, egal ob er am Tag selbst oder
// drei Tage spaeter nachgetragen wird.
const dayOf = build('2026-08-25T19:30:00', []);
const lateSlot = fresh.find(s => s.id === 'ambient_2026-08-25_19');
const sameSlot = dayOf.find(s => s.id === 'ambient_2026-08-25_19');
if(lateSlot && sameSlot){
  ok(lateSlot.sub === sameSlot.sub && lateSlot.title === sameSlot.title,
     'Nachtrag == Original (Typ und Text)', lateSlot.sub + ' / ' + sameSlot.sub);
} else {
  ok(false, 'Slot 2026-08-25_19 in beiden Laeufen vorhanden');
}
const again = build(NOW, []);
ok(JSON.stringify(again) === JSON.stringify(fresh), 'zwei identische Laeufe, identisches Ergebnis');

console.log('\n=== 5. ROTATION BLEIBT ===');
const subs = fresh.map(s=>s.sub);
ok(new Set(subs).size === subs.length, 'kein Fun-Fact-Typ zweimal im Nachschub',
   subs.join(', '));
const perDay = {};
fresh.forEach(s => { const d = s.id.slice(8,18); (perDay[d] = perDay[d] || []).push(s.sub); });
Object.keys(perDay).forEach(d => ok(new Set(perDay[d]).size === perDay[d].length,
  d + ': 10 und 19 Uhr zeigen verschiedene Typen'));
const heads = {};
fresh.forEach(s => s.pids.forEach(p => heads[p] = (heads[p]||0)+1));
const worst = Object.keys(heads).sort((a,b)=>heads[b]-heads[a])[0];
console.log('  Koepfe: ' + Object.keys(heads).map(p=>nm(p)+'×'+heads[p]).join(', '));
ok(!worst || heads[worst] <= 2, 'kein Spieler dominiert den Nachschub',
   worst ? nm(worst)+'×'+heads[worst] : '—');

console.log('\n=== 6. ZUKUENFTIGE SLOTS BLEIBEN ZU ===');
const morning = build('2026-08-27T11:30:00Z', []);   // nach 10:00, vor 19:00 lokal
ok(!morning.some(s => s.id === 'ambient_2026-08-27_19'), 'der heutige 19-Uhr-Slot wartet noch');
ok(morning.some(s => s.id === 'ambient_2026-08-27_10'), 'der heutige 10-Uhr-Slot ist da');
ok(morning.some(s => s.id === 'ambient_2026-08-26_19'), 'der gestrige 19-Uhr-Slot wird nachgetragen');

console.log('\n' + (fails ? '✗ ' + fails + ' von ' + checks + ' CHECKS FEHLGESCHLAGEN' : '✓ ALLE ' + checks + ' CHECKS BESTANDEN'));
process.exit(fails ? 1 : 0);
