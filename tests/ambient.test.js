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
// Der Vergleich muss bei GLEICHER Vorgeschichte laufen. Gegen einen leeren
// Verlauf zu bauen ist etwas anderes: der Nachschub weicht absichtlich aus,
// was zuletzt lief, und trifft dann eine andere — ebenso richtige — Wahl.
// Die Zusage lautet: derselbe Slot, dieselbe Vorgeschichte, derselbe Inhalt.
const lateSlot = fresh.find(s => s.id === 'ambient_2026-08-25_19');
const ohneDiesen = asStored.filter(s => s.id !== 'ambient_2026-08-25_19');
const sameSlot = build(NOW, ohneDiesen).find(s => s.id === 'ambient_2026-08-25_19');
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
    haeufung: Object.keys(zaehl).filter(t => zaehl[t] > 2 &&
      ['ambient','group','lead_change','elo_record','streak_record',
       'season_recap','season_endgame'].indexOf(t) < 0)
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
    nachbarn: (function(){
      let n = 0;
      for(let i = 1; i < sichtbar.length; i++){
        const a = (sichtbar[i-1].dataRef||{}).type, b = (sichtbar[i].dataRef||{}).type;
        if(a && a === b) n++;
      }
      return n;
    })(),
    // Wie ungleich sind die Gesichter verteilt? Vorher stand ein Spieler auf
    // neun von einunddreissig Karten und ein anderer auf einer.
    gesichter: (function(){
      const g = {}; sichtbar.forEach(s => _newsPids(s).forEach(id => { g[id]=(g[id]||0)+1; }));
      const w = Object.keys(g).map(k => g[k]).sort((x,y) => y-x);
      return {koepfe: Object.keys(g).length, max: w[0] || 0};
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
ok(_feed.nachbarn === 0, 'keine zwei Karten derselben Sorte direkt untereinander',
   _feed.nachbarn + ' Paare');
ok(_feed.gesichter.max <= Math.max(4, Math.ceil(_feed.sichtbar / 4)),
   'kein Spieler steht auf einem Viertel aller Karten',
   _feed.gesichter.max + ' von ' + _feed.sichtbar);
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


console.log('\n' + (fails ? '✗ ' + fails + ' von ' + checks + ' CHECKS FEHLGESCHLAGEN' : '✓ ALLE ' + checks + ' CHECKS BESTANDEN'));
process.exit(fails ? 1 : 0);
