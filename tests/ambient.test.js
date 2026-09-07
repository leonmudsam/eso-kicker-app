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
// Der 10-Uhr-Slot steht an jedem Tag, der 19-Uhr-Slot nur an Tagen ohne
// Partie: keine der 466 Partien hat vor 10 Uhr angefangen, die letzte um
// 18 Uhr. Am Abend eines Spieltags ist alles vom Tag interessanter als eine
// Zahl, die seit Wochen gilt.
const _spieltage = new Set(K.eval('matches.map(m=>{const d=new Date(m.created_at); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");})'));
const _tageImFenster = [];
for(let b = K.eval('AMBIENT_BACKFILL_DAYS'); b >= 0; b--){
  const d = new Date(new Date(NOW).getTime() - b*86400000);
  _tageImFenster.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'));
}
const _erwartet = _tageImFenster.length + _tageImFenster.filter(d => !_spieltage.has(d)).length;
ok(fresh.length === _erwartet,
   'ein 10-Uhr-Slot je Tag, ein 19-Uhr-Slot nur an spielfreien Tagen', fresh.length + ' von ' + _erwartet);
_tageImFenster.filter(d => _spieltage.has(d)).forEach(d =>
  ok(!fresh.some(s => s.id === 'ambient_' + d + '_19'), 'am Spieltag ' + d + ' schweigt der Abend-Slot'));
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
// Der Vergleich muss bei GLEICHER Vorgeschichte laufen. Gegen einen leeren
// Verlauf zu bauen ist etwas anderes: der Nachschub weicht absichtlich aus,
// was zuletzt lief, und trifft dann eine andere — ebenso richtige — Wahl.
// Die Zusage lautet: derselbe Slot, dieselbe Vorgeschichte, derselbe Inhalt.
const _pruefId = (fresh.find(s => /_19$/.test(s.id)) || fresh[0]).id;
const lateSlot = fresh.find(s => s.id === _pruefId);
const ohneDiesen = asStored.filter(s => s.id !== _pruefId);
const sameSlot = build(NOW, ohneDiesen).find(s => s.id === _pruefId);
if(lateSlot && sameSlot){
  ok(lateSlot.sub === sameSlot.sub && lateSlot.title === sameSlot.title,
     'Nachtrag == Original (Typ und Text)', lateSlot.sub + ' / ' + sameSlot.sub);
} else {
  ok(false, 'Slot ' + _pruefId + ' in beiden Laeufen vorhanden');
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
// Am 26.08. wurde gespielt, also gibt es dort keinen Abend-Slot. Nachgetragen
// wird der letzte spielfreie Abend im Fenster.
const _freierAbend = _tageImFenster.filter(d => !_spieltage.has(d) && d < '2026-08-27').pop();
if(_freierAbend) ok(morning.some(s => s.id === 'ambient_' + _freierAbend + '_19'),
  'der Abend-Slot eines spielfreien Vortags wird nachgetragen', _freierAbend);
else ok(!morning.some(s => /2026-08-2[456]_19$/.test(s.id)), 'kein Abend-Slot an Spieltagen');

console.log('\n=== 6. BLICKRICHTUNG DER SLOTS ===');
// 10:00 schaut nach vorn, 19:00 zurueck. Die Rolle ist ein Vorzug, kein
// Verbot — geprueft wird, dass der Vorzug in der Praxis auch greift.
const rolle = k => K.eval(`_ambientRolleVon(${JSON.stringify(k)}) || 'beides'`);
let verkehrt = [];
fresh.forEach(s => {
  const h = +/_(\d+)$/.exec(s.id)[1];
  const r = rolle(s.sub);
  if(r !== 'beides' && r !== (h < 15 ? 'stand' : 'geschichte')) verkehrt.push(s.id + ':' + s.sub);
});
ok(verkehrt.length === 0, 'kein Slot bekommt die falsche Blickrichtung', verkehrt.join(' '));

console.log('\n=== 7. RUECKBLICKE MIT FESTEM TERMIN ===');
// Der Halbzeit-Rueckblick haengt nicht am Losverfahren: am 15. um 19:00
// belegt er den Slot, egal was sonst gezogen haette.
const halb = build('2026-08-15T19:30:00', []).find(s => s.id === 'ambient_2026-08-15_19');
ok(!!halb && halb.sub === 'rueckblick_halbzeit',
   'der 15. um 19:00 gehoert dem Halbzeit-Rueckblick', halb ? halb.sub : 'kein Slot');
ok(!!halb && /Halbzeit im/.test(halb.title), 'und traegt die passende Ueberschrift',
   halb ? halb.title : '');
// Am 14. darf er nicht kommen.
const vorher = build('2026-08-14T19:30:00', []).find(s => s.id === 'ambient_2026-08-14_19');
ok(!vorher || vorher.sub !== 'rueckblick_halbzeit', 'am 14. nicht',
   vorher ? vorher.sub : '—');

console.log('\n=== 8. DIE NEUEN PRESTIGE-KARTEN ===');
const neuKeys = ['prestige_fuehrung','prestige_schwelle','prestige_schritt',
                 'insignium_stand','titelband_stand','rueckblick_halbzeit','rueckblick_jahr'];
const gebaut = JSON.parse(K.eval(`(function(){
  const pm = pmap(), nameOf = pid => (pm[pid]||{}).name || '?';
  const T = _ambientTemplatePool(new Date(), pm, nameOf);
  const rng = _ambientRng(_ambientHash('test'));
  const out = {};
  ${JSON.stringify(neuKeys)}.forEach(k => {
    const t = T.find(x => x.key === k);
    if(!t){ out[k] = {fehlt:true}; return; }
    let r = null, err = null;
    try { r = t.make(rng); } catch(e){ err = e.message; }
    out[k] = r ? {title:r.title, desc:r.desc, ref:r.dataRef||{}} : {leer:true, err};
  });
  return JSON.stringify(out);
})()`));
neuKeys.forEach(k => ok(!gebaut[k].fehlt, 'Template ' + k + ' ist im Pool'));
neuKeys.forEach(k => ok(!gebaut[k].err, 'Template ' + k + ' laeuft ohne Fehler', gebaut[k].err || ''));
// Alle ausser dem Jahresrueckblick muessen auf den echten Daten etwas liefern:
// 2025 hat die Liga noch nicht gespielt, also ist `null` dort das richtige.
neuKeys.filter(k => k !== 'rueckblick_jahr')
  .forEach(k => ok(!gebaut[k].leer, 'Template ' + k + ' liefert eine Karte'));
ok(gebaut.rueckblick_jahr.leer, 'der Jahresrueckblick schweigt ohne Vorjahr');
['prestige_fuehrung','prestige_schwelle','prestige_schritt','titelband_stand']
  .forEach(k => ok(gebaut[k].ref && gebaut[k].ref.prestige === true,
    k + ' zeigt das Insignium als Bild'));
neuKeys.filter(k => !gebaut[k].leer).forEach(k =>
  ok(!/undefined|NaN|\[object/.test(gebaut[k].title + gebaut[k].desc),
     k + ' sauber formuliert', gebaut[k].desc));

console.log('\n=== 9. BREAKING: NUR DAS SELTENSTE ===');
// Breaking heisst: extrem seltene Auszeichnung oder echtes Ereignis. Ein
// Countdown gehoert nicht dazu — `season_endgame` („Noch 5 Tage") war zeitweise
// die EINZIGE Breaking-Karte im Feed und meldete dabei nichts, was passiert war.
const br = t => K.eval(`_isBreaking({dataRef:${JSON.stringify(t)}})`);
[['lead_change'],['elo_record'],['streak_record'],['season_recap'],['rekord_erstmals']]
  .forEach(([t]) => ok(br({type:t}) === true, 'Breaking: ' + t));
ok(br({type:'badge_unlocked', rarity:'legendary'}) === true, 'Breaking: legendaeres Badge');
ok(br({type:'insignium_stufe', oben:true}) === true, 'Breaking: Lorbeerreif und Ordensstern');
ok(br({type:'insignium_stufe', oben:false}) === false, 'die unteren Stufen sind kein Breaking');
ok(br({type:'badge_unlocked', rarity:'rare'}) === false, 'ein seltenes Badge reicht nicht');
ok(br({type:'season_endgame'}) === false, 'ein Countdown ist kein Ereignis');
ok(br({type:'rekord_geholt'}) === false, 'ein Halterwechsel allein ist kein Breaking');
ok(br({type:'chronik_monat'}) === false, 'die Monatschronik ist kein Breaking');
ok(br({type:'top_clash'}) === false, 'top_clash ist kein Breaking mehr');
ok(br({type:'giant_slayer'}) === false, 'giant_slayer ist kein Breaking mehr');
ok(br({type:'potd'}) === false, 'Alltag bleibt Alltag');

console.log('\n=== 9b. DIE EWIGE TAFEL MELDET SICH ===');
// Der ganze Awards-Reiter kam im Feed nicht vor: wer einen Liga-Rekord
// uebernahm, eine Monatschronik holte oder eine Insignium-Stufe erreichte,
// erfuhr es nur, wenn er selbst nachsah.
const _tafel = JSON.parse(K.eval(`JSON.stringify((function(){
  const roh = _buildStories();
  const typ = t => roh.filter(s => (s.dataRef||{}).type === t);
  const rek = roh.filter(s => ((s.dataRef||{}).type || '').indexOf('rekord_') === 0);
  return {
    rekorde: rek.length,
    ausbau: typ('rekord_gesteigert').length,
    // Ein Rekord ist nur dann eine Meldung, wenn sich die ANGEZEIGTE Zahl
    // aendert. Sonst stand neunmal „X baut seinen Rekord aus" mit derselben
    // Zahl wie vorher.
    ausbauStumm: typ('rekord_gesteigert').filter(s => {
      const d = s.dataRef || {}; return !d.ev; }).length,
    kammer: rek.every(s => (s.dataRef||{}).kammer !== 'shame'),
    kat: rek.every(s => s.cat === 'tafel'),
    gesichter: rek.every(s => _newsPids(s).length > 0),
    insignium: typ('insignium_stufe').length,
    insGesicht: typ('insignium_stufe').every(s => _newsPids(s).length > 0),
    chronik: typ('chronik_monat').length + typ('chronik_erstling').length,
    // Jede neue Karte nennt eine Zahl und bleibt ohne Platzhalter.
    sauber: roh.filter(s => s.cat === 'tafel').every(s => {
      const txt = (s.title || '') + ' ' + (s.desc || '');
      const hatZahl = txt.split('').some(c => c >= '0' && c <= '9');
      return hatZahl && txt.indexOf('undefined') < 0 && txt.indexOf('NaN') < 0
          && txt.indexOf('[object') < 0;
    })
  };
})())`));
ok(_tafel.rekorde > 0, 'ein Halterwechsel wird gemeldet', _tafel.rekorde + ' Rekord-Karten');
ok(_tafel.ausbau <= 2, 'hoechstens zwei „ausgebaut" je Lauf', _tafel.ausbau + '');
ok(_tafel.kammer, 'Schattenseiten meldet der Feed nicht');
ok(_tafel.kat, 'Rekorde stehen in der Kammer „Ewige Tafel"');
ok(_tafel.gesichter, 'jede Rekordkarte zeigt ihren Halter [§C33]');
ok(_tafel.insignium > 0, 'eine neue Insignium-Stufe wird gemeldet', _tafel.insignium + '');
ok(_tafel.insGesicht, 'die Insignium-Karte zeigt den Traeger');
ok(_tafel.chronik > 0, 'die Monatschronik wird gemeldet', _tafel.chronik + '');
ok(_tafel.sauber, 'jede Tafel-Karte nennt eine Zahl und traegt keinen Platzhalter');

console.log('\n=== 9c. RUECKBLICKE SIND VOM FEED AUS ERREICHBAR ===');
// `showPotwRecap` und `showPotdRecap` sind gebaut und oeffnen sich am
// richtigen Tag von selbst — vom Feed aus fuehrte kein Weg dorthin. Wer die
// Karte drei Tage spaeter liest, kam an die Auswertung nicht mehr heran.
const _rueck = JSON.parse(K.eval(`JSON.stringify((function(){
  const roh = _buildStories();
  const einer = t => roh.find(s => (s.dataRef||{}).type === t) || null;
  const body = s => { try { return s ? _newsDetailBody(s) : ''; } catch(e){ return 'FEHLER ' + e.message; } };
  // Der Wochenrueckblick steht seit dem Umbau als EINE Karte am Sonntag um
  // 23:00. Spieler der Woche, Team der Woche und die vier Superlative sind
  // ihre Zeilen, keine eigenen Karten mehr.
  const wo = einer('woche');
  const teile = wo ? ((wo.dataRef||{}).teile || []) : [];
  const tw = teile.find(t => t.art === 'team') || null;
  return {
    potw: body(einer('potw')).indexOf('data-recap="potw"') >= 0,
    potd: body(einer('potd')).indexOf('data-recap="potd"') >= 0,
    hatPotw: !!einer('potw'), hatPotd: !!einer('potd'),
    hatWoche: !!wo,
    wocheStunde: wo ? new Date(wo.when).getHours() : -1,
    wocheTag: wo ? new Date(wo.when).getDay() : -1,
    wocheTeile: teile.length,
    wocheArten: teile.map(t => t.art),
    wocheGesicht: wo ? _newsPids(wo).length : 0,
    teamWoche: !!tw,
    // Das Duo kommt aus derselben Rechnung wie der Teams-Tab.
    teamWocheGesicht: tw ? (tw.pids||[]).length : 0,
    wocheRueck: body(wo).indexOf('data-recap="potw"') >= 0
  };
})())`));
ok(!_rueck.hatPotw || _rueck.potw, 'die Karte „Spieler der Woche" fuehrt zum Rueckblick');
ok(!_rueck.hatPotd || _rueck.potd, 'die Karte „Spieler des Tages" fuehrt zum Rueckblick');
ok(_rueck.hatWoche, 'der Wochenrueckblick steht als eine Karte');
ok(!_rueck.hatWoche || _rueck.wocheTag === 0, 'die Wochenkarte steht am Sonntag', _rueck.wocheTag);
ok(!_rueck.hatWoche || _rueck.wocheStunde === 23, 'die Wochenkarte steht um 23:00', _rueck.wocheStunde);
ok(!_rueck.hatWoche || _rueck.wocheTeile >= 2, 'sie traegt mehrere Wertungen',
   _rueck.wocheTeile + ': ' + _rueck.wocheArten.join(', '));
ok(!_rueck.hatWoche || _rueck.wocheGesicht > 0, 'die Wochenkarte zeigt ein Gesicht [§C33]', _rueck.wocheGesicht);
ok(_rueck.teamWoche, 'das Team der Woche ist eine ihrer Zeilen');
ok(!_rueck.teamWoche || _rueck.teamWocheGesicht === 2, 'das Team der Woche zeigt beide Gesichter [§C33]',
   _rueck.teamWocheGesicht + '');
ok(!_rueck.hatWoche || _rueck.wocheRueck, 'die Wochenkarte fuehrt in den Wochen-Rueckblick');

console.log('\n=== 10. DER FEED [§C33] ===');
// Der Feed war die einzige Ansicht der App, in der ein Spieler nur ein Name
// war — kein Gesicht, kein Wappen. Und er trug elf Kategoriefarben, in denen
// Gold nichts Besonderes mehr hiess. Diese vier Zusicherungen halten beides.
const _feed = JSON.parse(K.eval(`JSON.stringify((function(){
  const roh = _buildStories();
  _cache._stories = roh.slice().sort((a,b)=>new Date(b.when)-new Date(a.when));
  _cache._consolFrom = null;
  const sichtbar = getStoriesCache();
  const zaehl = {};
  sichtbar.forEach(s => { const t=(s.dataRef&&s.dataRef.type)||'-'; zaehl[t]=(zaehl[t]||0)+1; });
  return {
    roh: roh.length, sichtbar: sichtbar.length,
    // Wer in der Geschichte vorkommt, bekommt sein Gesicht.
    mitSpieler: sichtbar.filter(s => _newsPids(s).length > 0).length,
    ohneGesicht: sichtbar.filter(s => _newsPids(s).length > 0 && !_newsGesichtHtml(s)).length,
    wappen: sichtbar.filter(s => _newsGesichtHtml(s).indexOf('class="ins"') >= 0).length,
    // Keine Ausrufezeichen [CLAUDE.md §7].
    rufe: roh.filter(s => /!/.test(s.title||'') || /!/.test(s.desc||''))
             .map(s => s.title).slice(0, 5),
    // Kein Typ haeuft sich.
    // Die Typen sammel und woche sind ausgenommen: jede Sammelkarte gehoert zu einer
    // anderen Partie oder einem anderen Tag, und die Wochenkarte gibt es je
    // Woche genau einmal. Sie zu deckeln hiesse, eine Buendelung zu bestrafen.
    haeufung: Object.keys(zaehl).filter(t => zaehl[t] > 2 &&
      ['ambient','group','lead_change','elo_record','streak_record',
       'season_recap','season_endgame','sammel','woche'].indexOf(t) < 0)
      .map(t => t + '×' + zaehl[t]),
    // Doppelte Schlagzeilen: zweimal dieselbe Zeile ist eine Zeile zu viel.
    doppelt: (function(){
      const g = {}; sichtbar.forEach(s => { g[s.title]=(g[s.title]||0)+1; });
      return Object.keys(g).filter(t => g[t] > 1);
    })(),
    // Und zweimal derselbe Text erst recht nicht — „Eine grosse Rivalitaet —
    // die Liga liebt's" stand wortgleich unter zwei Karten untereinander.
    doppelText: (function(){
      const g = {}; sichtbar.forEach(s => { g[s.desc]=(g[s.desc]||0)+1; });
      return Object.keys(g).filter(t => t && g[t] > 1);
    })(),
    // Nichts steht zweimal DIREKT untereinander: zwei gleiche Sorten in Folge
    // lesen sich als eine Karte mit einem Tippfehler.
    // Zwei gleiche Sorten direkt untereinander lesen sich als eine Karte mit
    // einem Tippfehler. Ueber einen TAGESWECHSEL hinweg gilt das nicht: dort
    // steht ein Tageskopf dazwischen, und die Chronologie hat Vorrang vor der
    // Auflockerung — eine Karte, die den Tag wechselt, stuende unter dem
    // falschen Kopf.
    nachbarn: (function(){
      const tg = x => { const d = new Date(x.when);
        return d.getFullYear()+'-'+d.getMonth()+'-'+d.getDate(); };
      let n = 0;
      for(let i = 1; i < sichtbar.length; i++){
        const a = (sichtbar[i-1].dataRef||{}).type, b = (sichtbar[i].dataRef||{}).type;
        if(a && a === b && tg(sichtbar[i-1]) === tg(sichtbar[i])) n++;
      }
      return n;
    })(),
    // Und die Gegenrechnung: der Feed ist wirklich chronologisch.
    ausDerReihe: (function(){
      let n = 0;
      for(let i = 1; i < sichtbar.length; i++){
        if(new Date(sichtbar[i].when) > new Date(sichtbar[i-1].when)) n++;
      }
      return n;
    })(),
    // Wie ungleich sind die Gesichter verteilt? Vorher stand ein Spieler auf
    // neun von einunddreissig Karten und ein anderer auf einer.
    gesichter: (function(){
      const g = {}; sichtbar.forEach(s => _newsPids(s).forEach(id => { g[id]=(g[id]||0)+1; }));
      const w = Object.keys(g).map(k => g[k]).sort((x,y) => y-x);
      // Wer gewertet ist, muss auch vorkommen. Das ist die staerkere Frage als
      // die nach dem Spitzenreiter: der Feed darf jemanden feiern, aber er
      // darf niemanden uebergehen.
      const zahl = {};
      matches.forEach(m => [m.a1,m.a2,m.b1,m.b2].forEach(id => { if(id) zahl[id]=(zahl[id]||0)+1; }));
      const gewertet = Object.keys(zahl).filter(id => pmap()[id] && !pmap()[id].hidden && zahl[id] >= 20);
      return {koepfe: Object.keys(g).length, max: w[0] || 0,
              gewertet: gewertet.length, ohne: gewertet.filter(id => !g[id]).map(id => pmap()[id].name)};
    })(),
    // Kann ein Spieler mit wenigen Partien ueberhaupt vorkommen? Gefragt ist
    // die MOEGLICHKEIT, nicht der Treffer an diesem Tag.
    kleinsteMoeglich: (function(){
      const zahl = {};
      matches.forEach(m => [m.a1,m.a2,m.b1,m.b2].forEach(id => { if(id) zahl[id]=(zahl[id]||0)+1; }));
      const wenig = Object.keys(zahl).filter(id => pmap()[id] && zahl[id] >= 5 && zahl[id] < 30);
      // Der Fun-Fact-Topf verlangt fuenf Partien — mehr nicht.
      return wenig.length ? wenig.every(id => zahl[id] >= 5) : true;
    })()
  };
})())`));

ok(_feed.doppelText.length === 0, 'keine zwei Karten tragen denselben Text',
   _feed.doppelText.slice(0, 2).join(' | ') || 'keine');
ok(_feed.nachbarn === 0, 'keine zwei Karten derselben Sorte am selben Tag direkt untereinander',
   _feed.nachbarn + ' Paare');
ok(_feed.ausDerReihe === 0, 'der Feed steht chronologisch, von neu nach alt',
   _feed.ausDerReihe + ' Karten aus der Reihe');
// Der Feed ist durch die Sammel- und Wochenkarte kuerzer und traegt je Karte
// mehr Gesichter. Ein Viertel war auf einunddreissig Karten kalibriert und
// misst seitdem die Buendelung statt der Verteilung. Gefragt bleibt, ob
// jemand den Feed beherrscht: ein Drittel ist die Grenze.
ok(_feed.gesichter.max <= Math.max(4, Math.ceil(_feed.sichtbar / 3)),
   'kein Spieler steht auf einem Drittel aller Karten',
   _feed.gesichter.max + ' von ' + _feed.sichtbar);
ok(_feed.gesichter.ohne.length === 0,
   'jeder gewertete Spieler kommt im Feed vor',
   _feed.gesichter.ohne.join(', ') || (_feed.gesichter.gewertet + ' gewertet, alle dabei'));
ok(_feed.gesichter.koepfe >= 8, 'der Feed zeigt viele verschiedene Gesichter',
   _feed.gesichter.koepfe + ' Köpfe');
ok(_feed.kleinsteMoeglich === true,
   'auch ein Spieler mit wenigen Partien kann eine Story bekommen');
console.log('  ' + _feed.roh + ' erzeugt, ' + _feed.sichtbar + ' im Feed · '
  + _feed.mitSpieler + ' mit Spieler, davon ' + _feed.wappen + ' mit Wappen');

ok(_feed.ohneGesicht === 0,
   'jede Story mit Spieler traegt sein Gesicht',
   _feed.ohneGesicht + ' ohne');
ok(_feed.wappen > 0,
   'die Einzelspieler-Karten tragen das Wappen wie ueberall sonst',
   _feed.wappen + ' von ' + _feed.mitSpieler);
ok(_feed.rufe.length === 0,
   'keine Ausrufezeichen in Schlagzeile oder Text',
   _feed.rufe.join(' | ') || 'keine');
ok(_feed.haeufung.length === 0,
   'kein Story-Typ steht mehr als zweimal im Feed',
   _feed.haeufung.join(', ') || 'keiner');
ok(_feed.doppelt.length === 0,
   'keine zwei Karten mit derselben Schlagzeile',
   _feed.doppelt.join(' | ') || 'keine');


console.log('\n=== 11. DER TAGESPLAN ===');
// Drei Uhrzeiten haben sich geaendert, alle drei mit einem Grund.
const _plan = JSON.parse(K.eval(`JSON.stringify((function(){
  const roh = _buildStories();
  const s = _consolidateStories(roh.slice().sort((a,b)=>new Date(b.when)-new Date(a.when)));
  const potd = s.filter(x => (x.dataRef||{}).type === 'potd');
  const chr  = s.filter(x => (x.dataRef||{}).type === 'chronik_monat');
  const tagVon = m => { const d = new Date(m.created_at);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
  const spieltage = new Set(matches.map(tagVon));
  const kVon = w => { const d = new Date(w);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
  return {
    // Der Spieler des Tages steht um 23:59 an dem Tag, an dem gespielt wurde.
    potdZeit: potd.map(x => new Date(x.when).getHours()+':'+String(new Date(x.when).getMinutes()).padStart(2,'0')),
    potdAmSpieltag: potd.every(x => spieltage.has(kVon(x.when))),
    // Die Chronik erscheint mit dem Monatswechsel, nicht am Vormittag danach.
    chrZeit: chr.map(x => new Date(x.when).getHours()+':'+new Date(x.when).getMinutes()),
    chrErster: chr.every(x => new Date(x.when).getDate() === 1),
    // Die Sammelkarte muss wirklich buendeln: jede Zeile, die sie traegt,
    // stand vorher als eigene Karte im Feed und darf jetzt nicht mehr daneben
    // stehen. Ohne diese Gegenrechnung misst die Zusicherung nichts.
    sammel: s.filter(x => (x.dataRef||{}).type === 'sammel')
             .map(x => ((x.dataRef||{}).teile||[]).length),
    sammelErsetzt: (function(){
      const titelImFeed = new Set(s.filter(x => (x.dataRef||{}).type !== 'sammel').map(x => x.title));
      let daneben = 0;
      s.filter(x => (x.dataRef||{}).type === 'sammel').forEach(x => {
        ((x.dataRef||{}).teile || []).forEach(t => { if(titelImFeed.has(t.titel)) daneben++; });
      });
      return daneben;
    })(),
    // Wie viele Karten haette der Feed ohne die Buendelung?
    ohneSammel: s.reduce((n, x) => n + ((x.dataRef||{}).type === 'sammel'
      ? (((x.dataRef||{}).teile||[]).length) : 1), 0),
    mitSammel: s.length
  };
})())`));
ok(_plan.potdZeit.every(t => t === '23:59'), 'der Spieler des Tages steht um 23:59',
   _plan.potdZeit.join(', ') || 'keiner');
ok(_plan.potdAmSpieltag, 'und zwar an dem Tag, an dem gespielt wurde');
ok(_plan.chrZeit.every(t => t === '0:0'), 'die Chronik erscheint um 00:00',
   _plan.chrZeit.join(', ') || 'keine');
ok(_plan.chrErster, 'am ersten Tag des Folgemonats');
ok(_plan.sammel.length > 0, 'es gibt Sammelkarten', _plan.sammel.length + '');
ok(_plan.sammel.every(n => n >= 2 && n <= 4), 'eine Sammelkarte traegt zwei bis vier Zeilen',
   _plan.sammel.join(', ') || 'keine');
ok(_plan.sammelErsetzt === 0, 'keine ihrer Zeilen steht daneben noch als eigene Karte',
   _plan.sammelErsetzt + ' doppelt');
ok(_plan.mitSammel < _plan.ohneSammel, 'die Buendelung verkuerzt den Feed',
   _plan.mitSammel + ' statt ' + _plan.ohneSammel);

console.log('\n=== 12. DERSELBE FAKT NICHT ZWEIMAL IM MONAT ===');
// Der Typ-Cooldown (7 Tage) und der Spieler-Cooldown (2 Tage) verhindern die
// Kombination nicht: die Fuehrungs-Typen zeigen strukturell auf denselben Kopf.
// Gemessen wiederholten sich ueber 40 Tage elf Typ-Person-Paare, eines fuenfmal.
const _paare = JSON.parse(K.eval(`JSON.stringify((function(){
  if(!Array.isArray(_cache._stories)) _cache._stories = [];
  const basis = new Date('2026-08-27T23:00:00');
  const zaehl = {}, tag = {};
  for(let d = 39; d >= 0; d--){
    const t = new Date(basis.getTime() - d*86400000);
    [10, 19].forEach(h => {
      const j = new Date(t); j.setHours(h, 5, 0, 0);
      let a = [];
      try { a = _buildAmbientStories(j, pmap(), id => pname(id)) || []; } catch(e){}
      a.filter(x => new Date(x.when).getHours() === h &&
                    new Date(x.when).toDateString() === t.toDateString())
       .forEach(x => {
         _cache._stories.push(x);
         const sub = (x.dataRef||{}).sub, pid = (x.dataRef||{}).ambientPid;
         if(!sub || !pid) return;
         // Pflicht-Slots sind ausgenommen: ein Rueckblick gehoert auf sein
         // Datum und darf nicht vom Losverfahren abhaengen. Wer darin vorkommt,
         // entscheidet der Monat, nicht der Generator.
         if(sub === 'rueckblick_halbzeit' || sub === 'rueckblick_jahr') return;
         const k = sub + '|' + pid;
         const ts = j.getTime();
         if(tag[k] != null && (ts - tag[k]) <= 30*86400000) zaehl[k] = (zaehl[k]||0)+1;
         tag[k] = ts;
       });
    });
  }
  return {verstoesse: Object.keys(zaehl).length, liste: Object.keys(zaehl).slice(0, 4)};
})())`));
ok(_paare.verstoesse === 0, 'kein Fun Fact wiederholt Typ und Person binnen 30 Tagen',
   _paare.liste.join(', ') || 'keiner');

console.log('\n=== 13. DER TEXT KOMMT AUS DEM GENERATOR ===');
// Stories werden persistiert, damit alle Geraete dieselbe Karte sehen. Titel
// und Text waren damit eingefroren: eine ueberarbeitete Formulierung erschien
// nur an Karten, die es noch nicht gab. Der Feed zeigte weiter Saetze, die im
// Quelltext seit dem Umbau nicht mehr stehen.
const _auffr = JSON.parse(K.eval(`JSON.stringify((function(){
  const frisch = _buildStories();
  if(!frisch.length) return {n:0};
  // Eine persistierte Zeile mit ALTEM Wortlaut nachstellen.
  const alt = frisch.map(s => Object.assign({}, s, {
    title: 'ALTER TITEL', desc: 'alter Text mit einem Gedankenstrich — und einer Floskel.'}));
  _cache._stories = alt;
  _cache._consolFrom = null;
  const sicht = getStoriesCache();
  return {
    n: sicht.length,
    nochAlt: sicht.filter(x => x.title === 'ALTER TITEL').length,
    mitStrich: sicht.filter(x => (x.desc||'').indexOf('—') >= 0).length,
    // Zeitpunkt und ID muessen bleiben, sonst springt eine Karte im Feed.
    idsGleich: sicht.every(x => frisch.some(f => f.id === x.id)
                              || (x.dataRef||{}).type === 'sammel'
                              || (x.dataRef||{}).type === 'group')
  };
})())`));
ok(_auffr.n > 0, 'der Feed steht', _auffr.n + ' Karten');
ok(_auffr.nochAlt === 0, 'kein persistierter Titel ueberlebt den Generator',
   _auffr.nochAlt + ' von ' + _auffr.n);
ok(_auffr.mitStrich === 0, 'und kein eingefrorener Gedankenstrich',
   _auffr.mitStrich + ' von ' + _auffr.n);
ok(_auffr.idsGleich, 'ID und Zeitpunkt bleiben, was die Datenbank sagt');

console.log('\n' + (fails ? '✗ ' + fails + ' von ' + checks + ' CHECKS FEHLGESCHLAGEN' : '✓ ALLE ' + checks + ' CHECKS BESTANDEN'));
process.exit(fails ? 1 : 0);
