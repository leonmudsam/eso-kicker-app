// DAS BLATT — was ein Sheet mit einer Berührung macht, im echten Browser.
//
// Drei Dinge, die man einer Datei nicht ansieht und die alle schon falsch
// waren:
//
//   1. WEM GEHÖRT EINE GESTE. Das Blatt zieht bei einem Wisch nach unten
//      mit und schließt sich. Dafür ruft es preventDefault — und damit
//      steht jedes waagerechte Scrollen darin still, sobald das Blatt die
//      Geste an sich reißt. Genau so war es: geprüft wurde nur die
//      senkrechte Strecke, und ein Querwisch driftet fast immer ein Stück
//      nach unten. In der Laufbahn-Vitrine sah das aus, als spränge sie
//      zurück.
//
//   2. OB MAN JEDE STUFE ERREICHT. Die Vitrine zeigt fünf Insignien, eine
//      groß in der Mitte. Wischen allein hat die letzte nie erreicht;
//      jetzt ist jede Karte auch ein Ziel zum Antippen.
//
//   3. OB EIN WAPPEN SEINE VERLÄUFE FINDET. Die zwölf Verläufe eines
//      Zeichens hängen nur am Rang und am Glanz der Schwinge, nicht am
//      Spieler. Sie stehen deshalb einmal im Dokument, und jedes Wappen
//      verweist darauf. Ein Verweis auf einen Verlauf, den es nicht gibt,
//      wirft keinen Fehler und färbt nichts rot — die Fläche bleibt
//      einfach schwarz. Genau deshalb wird hier nachgesehen.
//
//   4. OB IM HINTERGRUND GELADEN WIRD. `loadAll` holt alle Spieler und alle
//      Partien, alle dreißig Sekunden — früher auch dann, wenn das Telefon
//      in der Tasche steckte.
//
// Alles vier lässt sich nur gerendert prüfen: es hängt an Ereignissen, an
// scrollLeft und an dem, was nach einem render() noch im Dokument steht.
const fs = require('fs');
const chromium = require('./browser.js').ladeChromium();
if(!chromium){
  console.log('ÜBERSPRUNGEN — kein Chromium verfügbar.');
  console.log('  Eine Geste hat kein Markup; sie lässt sich nur gerendert messen.');
  console.log('  Lokal: npm install --no-save playwright-core');
  process.exit(2);
}

// ── Die echten Partien der Liga, wie in tafel ──
const NAMES = ['Alex','Anton','Henry','Jane','Jannik','Johannes','Julian','Leo','Leon','Martin','Maxi','Stefan'];
const IDS = NAMES.map((n,i) => '00000000-0000-4000-8000-' + String(i).padStart(12,'0'));
const packed = fs.readFileSync(__dirname + '/fixtures/matches.txt', 'utf8').trim();
const MATCHES = packed.split(';').map((row, i) => {
  const f = row.split(',').map(Number);
  const pos = k => f[4+k] === 0 ? 'atk' : 'def';
  return {id:'m' + String(i).padStart(4,'0'),
    a1:IDS[f[0]], a2:IDS[f[1]], b1:IDS[f[2]], b2:IDS[f[3]],
    a1_pos:pos(0), a2_pos:pos(1), b1_pos:pos(2), b2_pos:pos(3),
    score_a:f[8], score_b:f[9], winner:f[10] === 0 ? 'A' : 'B',
    exp_a:f[11]/1000, created_at:new Date(f[12]*1000).toISOString(), deltas:{}};
});
const PLAYERS = NAMES.map((n,i) => ({id:IDS[i], name:n, hidden:false, elo:0, atk:.5,
  avatar_id:null, created_at:'2026-05-01T00:00:00Z'}));
const SEASONS = [
  {id:'2026-05', label:'Mai 2026',    start_date:'2026-04-30', end_date:'2026-05-31'},
  {id:'2026-06', label:'Juni 2026',   start_date:'2026-05-31', end_date:'2026-06-30'},
  {id:'2026-07', label:'Juli 2026',   start_date:'2026-06-30', end_date:'2026-07-31'},
  {id:'2026-08', label:'August 2026', start_date:'2026-07-31', end_date:'2026-08-31'},
];
const NOW = new Date(2026, 7, 26, 21, 0, 0).getTime();

const html = fs.readFileSync(require('./ziel.js'), 'utf8');
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let m, blocks = [];
while ((m = re.exec(html))) blocks.push(m[1]);
blocks.sort((a, b) => b.length - a.length);
let code = blocks[0].replace(/loadAll\(\);\s*\ncheckForUpdate\(\);/, '/*t*/');
const lc = code.lastIndexOf('})();');
code = code.slice(0, lc) + '\nwindow.__k = {eval: c => eval(c)};\n' + code.slice(lc);
// Ohne die Stile der App misst man ein Dokument ohne Layout — und ein
// Karussell ohne overflow-x hat keinen Scrollbereich.
const kopf = html.slice(0, html.indexOf('</head>')).replace(/<!--[\s\S]*?-->/g, '');
const styles = (kopf.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || []).join('\n');
const bodyStart = html.indexOf('<body', html.indexOf('</head>'));
const bodyHtml = html.slice(bodyStart, html.indexOf('<script', bodyStart))
  .replace(/<script[\s\S]*?<\/script>/gi, '');

const BOOT = `
(function(){
  const stub = () => new Proxy(function(){}, {get(_,p){return p==='then'?undefined:stub()}, apply(){return stub()}});
  window.supabase = {createClient: () => ({from: () => stub(), channel: () => stub(), removeChannel(){}, rpc: () => stub()})};
  window.fetch = () => new Promise(()=>{});
  window.setInterval = () => 0;
  const RD = Date, N = ${NOW};
  window.Date = class extends RD { constructor(...a){ a.length?super(...a):super(N); } static now(){ return N; } };
})();
`;

let fails = 0, checks = 0;
const ok = (c, msg, det) => {
  checks++; if(!c) fails++;
  console.log((c ? '  ok  ' : '  FAIL') + '  ' + msg + (!c && det ? ' → ' + det : ''));
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({viewport: {width: 390, height: 844}, hasTouch: true});
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.stack || e)));
  await page.setContent('<!doctype html><html><head><meta charset="utf-8">' + styles
    + '</head>' + bodyHtml + '</body></html>');
  await page.addScriptTag({content: BOOT});
  await page.addScriptTag({content: code});
  const K = async src => page.evaluate(s => window.__k.eval(s), src);
  ok(errors.length === 0, 'Skript lädt ohne Fehler', errors[0]);

  await K(`
    players = ${JSON.stringify(PLAYERS)};
    matches = ${JSON.stringify(MATCHES)};
    seasons = ${JSON.stringify(SEASONS)};
    invalidateCache();
    const _rc = simulateEloWithSliders(matches);
    const _d = {}; _rc.history.forEach(h => { _d[h.matchId] = h.deltas; });
    matches.forEach(m => { m.deltas = _d[m.id] || {}; });
    invalidateCache();
    const _g = getGlobalSim();
    seasons.forEach(s => {
      const snap = _g.seasonEndElos[s.id] || {}, pl = _g.seasonPlayed[s.id] || {};
      const top = Object.keys(pl).filter(id => pl[id] > 0)
        .map(id => ({id, elo:Math.round(snap[id] ?? cfg.start_elo), wins:0, losses:0}))
        .sort((a,b) => b.elo - a.elo);
      s.top_elo = JSON.stringify(top.slice(0,3));
      s.player_id = top[0] ? top[0].id : null;
    });
    invalidateCache();
    bindSheetSwipe();
    'bereit'`);

  console.log('\n═══ 1. EINE GESTE GEHÖRT EINEM ═══');
  // Gewischt wird mit echten Touch-Ereignissen. Gemessen werden die beiden
  // Dinge, die der Blatt-Zug tut: preventDefault rufen (damit steht das
  // waagerechte Scrollen still) und das Blatt verschieben.
  await K(`showLaufbahn(${JSON.stringify(IDS[8])})`);
  await page.waitForTimeout(400);
  const gesten = await page.evaluate(() => {
    const sheet = document.getElementById('sheet');
    const ziel = document.querySelector('.lb-k') || sheet;
    const feuern = (typ, x, y) => {
      const T = new Touch({identifier:1, target:ziel, clientX:x, clientY:y});
      const leer = typ === 'touchend';
      const ev = new TouchEvent(typ, {touches: leer ? [] : [T], changedTouches:[T],
        targetTouches: leer ? [] : [T], bubbles:true, cancelable:true});
      ziel.dispatchEvent(ev);
      return ev;
    };
    const wisch = (dx, dy) => {
      sheet.style.transform = '';
      feuern('touchstart', 200, 300);
      let verhindert = false;
      for(let i = 1; i <= 10; i++)
        if(feuern('touchmove', 200 + dx*i/10, 300 + dy*i/10).defaultPrevented) verhindert = true;
      const zug = sheet.style.transform;
      feuern('touchend', 200 + dx, 300 + dy);
      sheet.style.transform = '';
      return {verhindert, gezogen: /translateY\([^0]/.test(zug)};
    };
    return {
      // Ein Querwisch driftet fast immer nach unten — 22 px auf 140 sind
      // eine ruhige Hand, 40 auf 160 eine normale.
      quer:      wisch(-140, 22),
      querStark: wisch(-160, 40),
      querZurueck: wisch(150, 30),
      // Und das Blatt muss weiter zuziehen, sonst hat der Schutz zu viel
      // verboten.
      runter:    wisch(8, 120),
      schraeg:   wisch(60, 110)
    };
  });
  ['quer','querStark','querZurueck'].forEach(k => {
    ok(!gesten[k].verhindert && !gesten[k].gezogen,
       `waagerecht (${k}): das Blatt lässt die Geste in Ruhe`,
       JSON.stringify(gesten[k]));
  });
  ['runter','schraeg'].forEach(k => {
    ok(gesten[k].verhindert && gesten[k].gezogen,
       `senkrecht (${k}): das Blatt zieht mit`,
       JSON.stringify(gesten[k]));
  });

  console.log('\n═══ 2. DIE VITRINE IST EIN ZIEL ═══');
  // Fünf Stufen, und jede muss man ansehen können. Wischen allein hat die
  // letzte nicht erreicht — die Geste gehörte dem Blatt. Antippen ist der
  // zweite Weg, und der geht immer.
  const vitrine = await page.evaluate(async () => {
    const d = document.getElementById('lbLeiter');
    if(!d) return {fehlt:true};
    const k = [...d.querySelectorAll('.lb-k')];
    const warte = ms => new Promise(r => setTimeout(r, ms));
    const out = {karten:k.length, schritte:[]};
    // Rückwärts, damit auch der Sprung über die ganze Breite dabei ist.
    for(const i of [4, 0, 3, 1, 2]){
      k[i].click();
      await warte(700);
      const mitte = d.scrollLeft + d.clientWidth / 2;
      out.schritte.push({i,
        fokus: k.findIndex(x => x.classList.contains('fokus')),
        // Wie weit die Karte von der Mitte des Fensters weg liegt.
        ab: Math.round(Math.abs(k[i].offsetLeft + k[i].offsetWidth/2 - mitte))});
    }
    return out;
  });
  ok(!vitrine.fehlt && vitrine.karten === 5,
     'die Vitrine steht mit allen fünf Stufen', JSON.stringify(vitrine));
  if(!vitrine.fehlt){
    const daneben = vitrine.schritte.filter(s => s.fokus !== s.i);
    ok(daneben.length === 0, 'jede angetippte Stufe wird die gewählte',
       daneben.map(s => s.i + '→' + s.fokus).join(' '));
    // Nicht nur „irgendwie hin", sondern MITTIG: die Karte in der Mitte ist
    // die große, und eine halb angeschobene Karte ist keine Auswahl.
    const schief = vitrine.schritte.filter(s => s.ab > 2);
    ok(schief.length === 0, 'und liegt danach in der Mitte',
       schief.map(s => s.i + ': ' + s.ab + ' px daneben').join(' '));
  }

  console.log('\n═══ 3. JEDES WAPPEN FINDET SEINE VERLÄUFE ═══');
  // Geprüft wird nach JEDEM Tabwechsel und jedem Blatt, denn genau daran
  // hängt es: render() ersetzt #app, openSheet ersetzt das Blatt — der Topf
  // mit den Verläufen steht außerhalb von beidem. Stünde er darin, wäre er
  // beim ersten Tabwechsel weg und jedes Metall danach schwarz.
  const verweise = [];
  for(const t of ['ranking', 'positions', 'awards', 'teams', 'history']){
    verweise.push(await page.evaluate(async (tab) => {
      const K = window.__k.eval.bind(window.__k);
      K('tab = ' + JSON.stringify(tab) + '; render()');
      await new Promise(r => requestAnimationFrame(r));
      const offen = new Set();
      document.querySelectorAll('svg *').forEach(e => {
        ['fill', 'stroke'].forEach(a => {
          const m = (e.getAttribute(a) || '').match(/^url\(#([^)]+)\)$/);
          if(m && !document.getElementById(m[1])) offen.add(m[1]);
        });
      });
      const t = document.getElementById('insDefs');
      return {tab, topf: !!t && !t.closest('#app') && !t.closest('.sheet'),
              wappen: document.querySelectorAll('svg.ins').length,
              offen: [...offen].slice(0, 5)};
    }, t));
  }
  for(const ruf of ['showPlayer(players[8].id)', 'showLaufbahn(players[8].id)']){
    verweise.push(await page.evaluate(async (src) => {
      const K = window.__k.eval.bind(window.__k);
      K(src);
      await new Promise(r => requestAnimationFrame(r));
      const offen = new Set();
      document.querySelectorAll('svg *').forEach(e => {
        ['fill', 'stroke'].forEach(a => {
          const m = (e.getAttribute(a) || '').match(/^url\(#([^)]+)\)$/);
          if(m && !document.getElementById(m[1])) offen.add(m[1]);
        });
      });
      const t = document.getElementById('insDefs');
      return {tab: src.split('(')[0], topf: !!t && !t.closest('#app') && !t.closest('.sheet'),
              wappen: document.querySelectorAll('svg.ins').length,
              offen: [...offen].slice(0, 5)};
    }, ruf));
  }
  console.log('  Wappen je Ansicht: '
    + verweise.map(v => v.tab + '→' + v.wappen).join('  '));
  const ohneTopf = verweise.filter(v => !v.topf);
  // Er muss AUSSERHALB von #app und dem Blatt stehen, nicht nur irgendwo:
  // darin nimmt ihn das nächste render() mit, und dann hängt jedes Metall
  // daran, dass ihn zufällig jemand neu anlegt.
  ok(ohneTopf.length === 0,
     'der Topf mit den Verläufen steht außerhalb von #app und dem Blatt',
     ohneTopf.map(v => v.tab).join(', '));
  const gezeigt = verweise.filter(v => v.wappen > 0);
  ok(gezeigt.length >= 4, 'es werden überhaupt Wappen gezeichnet',
     verweise.map(v => v.tab + ':' + v.wappen).join(' '));
  const kaputt = verweise.filter(v => v.offen.length);
  ok(kaputt.length === 0, 'kein Verweis zeigt auf einen Verlauf, den es nicht gibt',
     kaputt.map(v => v.tab + ': ' + v.offen.join(', ')).join(' | '));

  console.log('\n═══ 4. IM HINTERGRUND WIRD NICHT GELADEN ═══');
  // Der Takt ruft nicht mehr blind. Geprüft wird an der Stelle, an der es
  // zählt: wie oft `loadAll` wirklich gerufen wird.
  const takt = await page.evaluate(() => {
    const K = window.__k.eval.bind(window.__k);
    K('globalThis.__ALT_LOAD = loadAll; globalThis.__RUFE = 0;'
      + ' loadAll = () => { globalThis.__RUFE++; };');
    const zeig = v => Object.defineProperty(document, 'hidden',
      {configurable:true, get:() => v});
    const zahl = () => K('globalThis.__RUFE');
    const blatt = document.getElementById('sheet');
    blatt.classList.remove('show');
    K('tab = "ranking"');

    zeig(true);  K('_tickDaten()');
    const versteckt = zahl();
    zeig(false); K('_tickDaten()');
    const sichtbar = zahl();
    // Zurück aus dem Hintergrund: sofort, nicht erst beim nächsten Takt.
    document.dispatchEvent(new Event('visibilitychange'));
    const zurueck = zahl();
    // Ein offenes Blatt wird nicht unter den Fingern neu gezeichnet —
    // diese Bedingung stand schon im alten Takt und muss bleiben.
    blatt.classList.add('show'); K('_tickDaten()');
    const mitBlatt = zahl();
    blatt.classList.remove('show');
    // Und der Eingabe-Tab auch nicht.
    K('tab = "match"'); K('_tickDaten()');
    const imMatch = zahl();

    K('tab = "ranking"; loadAll = globalThis.__ALT_LOAD;');
    delete document.hidden;
    return {versteckt, sichtbar, zurueck, mitBlatt, imMatch};
  });
  ok(takt.versteckt === 0, 'versteckt: kein Laden',
     takt.versteckt + ' Aufrufe');
  ok(takt.sichtbar === 1, 'sichtbar: der Takt lädt',
     takt.sichtbar + ' Aufrufe');
  ok(takt.zurueck === 2, 'zurück aus dem Hintergrund: sofort, nicht erst in 30 Sekunden',
     takt.zurueck + ' Aufrufe');
  ok(takt.mitBlatt === 2 && takt.imMatch === 2,
     'offenes Blatt und Eingabe-Tab bleiben in Ruhe',
     'Blatt ' + takt.mitBlatt + ', Match ' + takt.imMatch);

  console.log('\n' + '═'.repeat(60));
  console.log(fails === 0 ? `ALLE ${checks} CHECKS BESTANDEN` : `${fails} von ${checks} CHECKS FEHLGESCHLAGEN`);
  await browser.close();
  process.exit(fails === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
