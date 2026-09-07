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

  console.log('\n═══ DER REKORDE-REITER ═══');
  // Gemessen statt behauptet — und zwar am gerenderten Reiter mit den
  // echten Partien: vier Kammern, eine Besitzleiste, die dieselben
  // Haltungen zählt wie die Karten, und ein Filter, der genau eine Kammer
  // stehen lässt.
  const CHRONICLES_N = await page.evaluate(() => window.__k.eval('CHRONICLES.length'));
  const rek = await page.evaluate(() => {
    window.__k.eval('tab = "awards"; awView = "rekorde"; rekKammer = ""; render()');
    return {
      karten: document.querySelectorAll('#app .rek').length,
      kammern: [...document.querySelectorAll('#app .rek-g-n')].map(e => e.textContent.trim()),
      saeulen: [...document.querySelectorAll('#app .rek-sl .z')].map(e => +e.textContent),
      offen: [...document.querySelectorAll('#app .rek.offen')].length
    };
  });
  ok(rek.kammern.length === 4, 'der Reiter zeigt vier Kammern', rek.kammern.join(' · '));
  ok(rek.karten === CHRONICLES_N, 'jeder Rekord des Katalogs hat eine Karte',
     rek.karten + ' von ' + CHRONICLES_N);
  // Die Besitzleiste zählt dieselben Haltungen, die die Karten zeigen.
  const haltungen = await page.evaluate(() => window.__k.eval(
    `Object.values(allChronicles().byId).reduce((n, e) => n + e.pids.length, 0)`));
  const summe = rek.saeulen.reduce((a, b) => a + b, 0);
  ok(summe === haltungen, 'die Besitzleiste zählt so viele Haltungen wie die Tafel',
     summe + ' vs ' + haltungen);
  // Ein Rekord, den niemand hält, steht gestrichelt da statt zu fehlen.
  const unbesetzt = await page.evaluate(() => window.__k.eval(
    `(function(){ const h = chronicleHolders();
       return CHRONICLES.filter(c => !h[c.id]).length; })()`));
  ok(rek.offen === unbesetzt, 'jeder unbesetzte Rekord steht gestrichelt in seiner Kammer',
     rek.offen + ' gezeigt, ' + unbesetzt + ' unbesetzt');
  // Der Kammerfilter zeigt genau eine Kammer.
  const gefiltert = await page.evaluate(() => {
    window.__k.eval('rekKammer = "fuegung"; render()');
    const n = document.querySelectorAll('#app .rek-g-n').length;
    const nurFuegung = [...document.querySelectorAll('#app .rek')]
      .every(e => e.classList.contains('fuegung') || e.classList.contains('offen'));
    window.__k.eval('rekKammer = ""; render()');
    return {n, nurFuegung};
  });
  ok(gefiltert.n === 1 && gefiltert.nurFuegung,
     'der Kammerfilter zeigt genau eine Kammer', JSON.stringify(gefiltert));

  console.log('\n═══ DIE TAFEL ═══');
  // Gemessen am gerenderten Feed: ein Tageskopf je Kalendertag, jede Karte
  // unter ihrem eigenen Tag, Filterchips mit Anzahl und ein Gelesen-Knopf,
  // der die Zahl der offenen Karten nennt. Vorher trennte die Tage eine
  // duenne Zeile, die man beim Scrollen uebersah: zwei Spieltage lasen sich
  // als einer.
  const tafel = await page.evaluate(() => {
    // Der Cache wird sonst aus der DB gefuellt; im Harness gibt es keine.
    // Der Generator liefert dieselben Stories, die die App persistiert haette.
    window.__k.eval('_cache._stories = _buildStories().slice().sort((a,b)=>new Date(b.when)-new Date(a.when)); openNewsFeed()');
    const sheet = document.getElementById('sheet');
    const koepfe = sheet ? [...sheet.querySelectorAll('.nf-tag')] : [];
    const gruppen = sheet ? [...sheet.querySelectorAll('.nf-feed')] : [];
    // Wie viele verschiedene Kalendertage tragen die Karten wirklich?
    const tage = window.__k.eval(`(function(){
      const s = getStoriesCache();
      return new Set(s.map(x => _newsDayKey(x.when))).size;
    })()`);
    const chips = (sheet ? [...sheet.querySelectorAll('.nf-chip-f')] : []).map(e => ({
      text: e.textContent.trim(), zahl: e.querySelector('i') ? +e.querySelector('i').textContent : null
    }));
    const knopf = sheet ? sheet.querySelector('.nf-gelesen') : null;
    const offen = window.__k.eval(`getStoriesCache().filter(x => !_newsLoadSeen().has(x.id)).length`);
    // Steht jede Karte unter dem Kopf ihres eigenen Tages?
    let falscherTag = 0;
    koepfe.forEach((k, i) => {
      const datum = (k.querySelector('.nf-tag-dt') || {}).textContent || '';
      const feed = gruppen[i];
      if(!feed) return;
      [...feed.querySelectorAll('.nf-card')].forEach(c => {
        const sid = c.dataset.sid;
        const soll = window.__k.eval(`(function(){
          const s = getStoriesCache().find(x => x.id === ${JSON.stringify(sid)});
          return s ? _newsDayDate(s.when) : '';
        })()`);
        if(soll && soll !== datum.trim()) falscherTag++;
      });
    });
    const k0 = koepfe[0] || null;
    const wt = k0 ? k0.querySelector('.nf-tag-wt') : null;
    const dt = k0 ? k0.querySelector('.nf-tag-dt') : null;
    // Steht im Kopf eine Zeile, die eine Karte darunter wortgleich wiederholt?
    let kopfDoppelt = 0, kopfDoppeltBsp = '';
    koepfe.forEach((k, i) => {
      const zeilen = [...k.querySelectorAll('.nf-tag-b, .nf-tag-h')]
        .map(e => e.textContent.trim()).filter(Boolean);
      const feed = gruppen[i];
      if(!feed) return;
      const titel = [...feed.querySelectorAll('.nf-h')].map(e => e.textContent.trim());
      zeilen.forEach(z => { if(titel.indexOf(z) >= 0){ kopfDoppelt++; kopfDoppeltBsp = z; } });
    });
    // Die Karte des Tages: hoechstens eine je Tag, und sie bleibt an ihrer
    // Uhrzeit stehen. Sie nach oben zu ziehen waere genau die Umsortierung,
    // die der Feed nicht mehr macht.
    let tagesKarten = 0, mehrfach = 0, nichtBeste = 0, tagOhneSpiel = 0;
    gruppen.forEach((feed, i) => {
      // An einem Tag ohne Partie ist nichts passiert, was ihn von einem
      // anderen unterscheidet: dort stand sonst ein Fun Fact gross im Bild.
      const kopf = koepfe[i];
      const hatBilanz = kopf && kopf.querySelector('.nf-tag-b');
      if(!hatBilanz && feed.querySelector('.nf-card.nf-gross')) tagOhneSpiel++;
    });
    gruppen.forEach(feed => {
      const gr = [...feed.querySelectorAll('.nf-card.nf-gross')];
      tagesKarten += gr.length;
      if(gr.length > 1) mehrfach++;
      if(gr.length !== 1) return;
      // Traegt sie wirklich die hoechste Prioritaet ihres Tages?
      const ids = [...feed.querySelectorAll('.nf-card')].map(c => c.dataset.sid);
      const beste = window.__k.eval(`(function(){
        const ids = ${JSON.stringify(ids)};
        const s = getStoriesCache().filter(x => ids.indexOf(x.id) >= 0);
        s.sort((a,b) => ((_isBreaking(b)?1:0)-(_isBreaking(a)?1:0)) || ((b.prio||0)-(a.prio||0)));
        return s.length ? s[0].id : '';
      })()`);
      if(beste && beste !== gr[0].dataset.sid) nichtBeste++;
    });
    return {koepfe: koepfe.length, tage, chips, falscherTag,
            kopfDoppelt, kopfDoppeltBsp, tagesKarten, mehrfach, nichtBeste, tagOhneSpiel,
            knopfText: knopf ? knopf.textContent.trim() : '', offen,
            wochentag: wt ? wt.textContent.trim() : '',
            datum: dt ? dt.textContent.trim() : '',
            roh: k0 ? k0.innerHTML.slice(0, 160) : ('kein Kopf; sheet=' + (!!sheet) + ' html=' + (sheet ? sheet.innerHTML.length : 0))};
  });
  ok(tafel.koepfe === tafel.tage, 'jeder Kalendertag bekommt genau einen Kopf',
     tafel.koepfe + ' Koepfe, ' + tafel.tage + ' Tage');
  ok(tafel.falscherTag === 0, 'jede Karte steht unter dem Kopf ihres Tages',
     tafel.falscherTag + ' daneben');
  ok(/^[A-ZÄÖÜ]+$/.test(tafel.wochentag || '') && /\d{2}\.\d{2}\.\d{2}/.test(tafel.datum || ''),
     'der Kopf nennt Wochentag und Datum', (tafel.wochentag + ' ' + tafel.datum).trim() || tafel.roh);
  ok(tafel.chips.length === 4, 'vier Filterchips, nicht elf Rubriken',
     tafel.chips.map(c => c.text).join(' · '));
  ok(tafel.chips.every(c => c.zahl !== null), 'jeder Chip traegt seine Anzahl',
     tafel.chips.map(c => c.zahl).join(', '));
  ok(!tafel.offen || tafel.knopfText.indexOf(String(tafel.offen)) >= 0,
     'der Gelesen-Knopf nennt die Zahl der offenen Karten',
     tafel.knopfText + ' / ' + tafel.offen);
  ok(tafel.kopfDoppelt === 0,
     'der Tageskopf wiederholt keine Schlagzeile aus seinem Tag',
     tafel.kopfDoppelt + ' doppelt: ' + tafel.kopfDoppeltBsp);
  ok(tafel.tagesKarten > 0 && tafel.mehrfach === 0,
     'hoechstens eine Karte des Tages je Tag',
     tafel.tagesKarten + ' Karten, ' + tafel.mehrfach + ' Tage mit mehreren');
  ok(tafel.nichtBeste === 0, 'die Karte des Tages traegt die hoechste Prioritaet ihres Tages',
     tafel.nichtBeste + ' daneben');
  ok(tafel.tagOhneSpiel === 0, 'an einem Tag ohne Partie gibt es keine Karte des Tages',
     tafel.tagOhneSpiel + ' Tage');

  console.log('\n═══ DIE STORY-BLAETTER ═══');
  // Jedes Blatt hat denselben Bau: Kopf mit Wappen und Rang, dann die Mitte,
  // dann der Weg weiter. Vorher brachte jeder der einunddreissig Typen sein
  // eigenes mit, und wer zwei nacheinander oeffnete, fand nichts an derselben
  // Stelle.
  const blaetter = await page.evaluate(() => {
    const roh = window.__k.eval('JSON.stringify((function(){\n'
      + '  const roh = _buildStories();\n'
      + '  const alle = _consolidateStories(roh.slice().sort((a,b)=>new Date(b.when)-new Date(a.when)));\n'
      + '  const out = [], gesehen = {};\n'
      + '  alle.forEach(s => { const t = (s.dataRef||{}).type || "?";\n'
      + '    if(gesehen[t]) return; gesehen[t] = 1;\n'
      + '    let b = ""; try { b = _newsDetailBody(s); } catch(e){ b = "FEHLER:" + e.message; }\n'
      + '    out.push({typ:t, html:b, pids:(_newsPids(s)||[]).length, matchId:!!(s.dataRef||{}).matchId});\n'
      + '  });\n'
      + '  return out; })())');
    const arr = JSON.parse(roh);
    const box = document.createElement('div');
    let ohneKopf = 0, doppeltesSpiel = 0, fehler = 0, leer = 0;
    arr.forEach(x => {
      if(x.html.indexOf('FEHLER:') === 0){ fehler++; return; }
      if(!x.html.trim()){ leer++; return; }
      box.innerHTML = x.html;
      // Ein Blatt ueber einen Spieler traegt sein Wappen im Kopf.
      if(x.pids === 1 && !box.querySelector('.nd-held')) ohneKopf++;
      // Und die Partie steht hoechstens einmal darin.
      const erg = box.querySelectorAll('.nd-erg').length;
      const vs  = box.querySelectorAll('.nd-match').length;
      if(x.matchId && (erg + vs) > 1) doppeltesSpiel++;
    });
    return {n: arr.length, ohneKopf, doppeltesSpiel, fehler, leer,
            typen: arr.map(x => x.typ).join(', ')};
  });
  ok(blaetter.fehler === 0, 'kein Blatt wirft beim Bauen', blaetter.fehler + ' von ' + blaetter.n);
  ok(blaetter.leer === 0, 'kein Blatt bleibt leer', blaetter.leer + ' von ' + blaetter.n);
  ok(blaetter.ohneKopf === 0, 'jedes Blatt ueber einen Spieler traegt seinen Kopf',
     blaetter.ohneKopf + ' ohne');
  ok(blaetter.doppeltesSpiel === 0, 'die Partie steht hoechstens einmal im Blatt',
     blaetter.doppeltesSpiel + ' doppelt');

  console.log('\n═══ DAS RUBRIKBAND UND DER TAGESKOPF ═══');
  const design = await page.evaluate(() => {
    const sheet = document.getElementById('sheet');
    const karten = [...sheet.querySelectorAll('.nf-card')];
    const koepfe = [...sheet.querySelectorAll('.nf-tag')];
    // Der Tageskopf ist eine Marke auf dem Zeitstrahl, keine Karte: als
    // Kasten mit Rahmen und Fuellung sah er aus wie eine ungeoeffnete Story.
    const kopfStil = koepfe.length ? getComputedStyle(koepfe[0]) : null;
    // Jede Karte traegt genau eine Rubrik, und sie ist leiser als die
    // Schlagzeile darunter.
    let ohneRubrik = 0, zuLaut = 0;
    karten.forEach(c => {
      const r = c.querySelector('.nf-rub');
      const h = c.querySelector('.nf-h');
      if(!r){ if(!c.classList.contains('nf-brk')) ohneRubrik++; return; }
      if(!h) return;
      // Gemessen wird der TEXT der Rubrik, nicht ihr Behaelter: die
      // Schriftgroesse steht am inneren b, und am Behaelter zu messen liesse
      // die Zusicherung eine zu laute Rubrik durchgehen.
      const rt = r.querySelector('b') || r;
      const rs = parseFloat(getComputedStyle(rt).fontSize);
      const hs = parseFloat(getComputedStyle(h).fontSize);
      if(rs >= hs) zuLaut++;
    });
    // Die Tordifferenz steht nicht im Zahlenband, wenn das Ergebnis schon
    // darueber steht.
    let doppelteDiff = 0;
    karten.forEach(c => {
      if(!c.querySelector('.nf-erg')) return;
      [...c.querySelectorAll('.nf-zb span')].forEach(sp => {
        if(/Tore Unterschied/.test(sp.textContent)) doppelteDiff++;
      });
    });
    return {karten: karten.length, ohneRubrik, zuLaut, doppelteDiff,
            kopfRahmen: kopfStil ? kopfStil.borderTopWidth + '|' + kopfStil.borderLeftWidth : '',
            kopfGrund: kopfStil ? kopfStil.backgroundImage : ''};
  });
  ok(design.ohneRubrik === 0, 'jede Karte traegt ihre Rubrik', design.ohneRubrik + ' ohne');
  ok(design.zuLaut === 0, 'die Rubrik ist leiser als die Schlagzeile', design.zuLaut + ' zu laut');
  ok(design.doppelteDiff === 0, 'die Tordifferenz steht nicht neben dem Ergebnis',
     design.doppelteDiff + ' doppelt');
  ok(design.kopfRahmen === '0px|0px' && design.kopfGrund === 'none',
     'der Tageskopf ist keine Karte', design.kopfRahmen + ' / ' + design.kopfGrund);

  console.log('\n═══ MOTIV, WINKEL UND FETTE AKZENTE ═══');
  const schmuck = await page.evaluate(() => {
    const sheet = document.getElementById('sheet');
    const karten = [...sheet.querySelectorAll('.nf-card')];
    let ohneMotiv = 0, ragtRaus = 0, ohneWinkel = 0, winkelUnten = 0, ohneAkzent = 0;
    karten.forEach(c => {
      const m = c.querySelector('.nf-motiv');
      if(!m){ ohneMotiv++; }
      else {
        // Halb angeschnitten sah das Wasserzeichen nach einem Fehler aus.
        const mb = m.getBoundingClientRect(), cb = c.getBoundingClientRect();
        if(mb.right > cb.right + 0.5 || mb.left < cb.left - 0.5) ragtRaus++;
      }
      const w = c.querySelector('.nf-chev');
      if(!w){ ohneWinkel++; }
      else {
        // Der Winkel steht NEBEN dem Satz, nicht darunter: als vierte Zeile
        // waere er eine eigene Zeile Text.
        const t = c.querySelector('.nf-gr-r');
        if(t){
          const wb = w.getBoundingClientRect(), tb = t.getBoundingClientRect();
          if(wb.left < tb.right - 1) winkelUnten++;
        }
      }
      // Steht eine Zahl im Satz, steht sie fett.
      const d = c.querySelector('.nf-d');
      if(d && /\d/.test(d.textContent) && !d.querySelector('b')) ohneAkzent++;
    });
    return {n: karten.length, ohneMotiv, ragtRaus, ohneWinkel, winkelUnten, ohneAkzent};
  });
  ok(schmuck.ohneMotiv === 0, 'jede Karte traegt ihr Motiv', schmuck.ohneMotiv + ' ohne');
  ok(schmuck.ragtRaus === 0, 'das Motiv steht ganz in der Karte', schmuck.ragtRaus + ' ragen raus');
  ok(schmuck.ohneWinkel === 0, 'jede Karte zeigt, dass sie sich oeffnet',
     schmuck.ohneWinkel + ' ohne Winkel');
  ok(schmuck.winkelUnten === 0, 'der Winkel steht neben dem Satz, nicht darunter',
     schmuck.winkelUnten + ' darunter');
  ok(schmuck.ohneAkzent === 0, 'jede Zahl im Kartentext steht fett',
     schmuck.ohneAkzent + ' ohne Akzent');

  console.log('\n═══ ZEHN SORTEN, ZEHN FORMEN ═══');
  const sorten = await page.evaluate(() => {
    const sorte = window.__k.eval('_newsSorte');
    const rubrik = window.__k.eval('_newsRubrik');
    const mach = t => ({dataRef:{type:t, a:'x', b:'y', streak:5, n:60}});
    // Drei Aussagen, drei Sorten: an einem Spieltag standen drei Karten
    // „ZU ZWEIT" untereinander, die von drei verschiedenen Dingen erzaehlten.
    const drei = ['rivalry', 'team_streak', 'team_woche'].map(t => sorte(mach(t)));
    const eindeutig = new Set(drei).size === 3;
    // Und die Rubrik unterscheidet Serie von Durststrecke.
    const sieg = rubrik('serie', mach('team_streak'));
    const pleite = rubrik('serie', mach('team_loss_streak'));
    // Jede Karte im Feed hat eine Sorte, die es im CSS auch gibt.
    const sheet = document.getElementById('sheet');
    const klassen = [...sheet.querySelectorAll('.nf-card')]
      .map(c => [...c.classList].find(k => k.indexOf('nf-s-') === 0) || '');
    return {drei, eindeutig, sieg, pleite, ohneSorte: klassen.filter(k => !k).length,
            verschieden: new Set(klassen).size};
  });
  ok(sorten.eindeutig, 'Rivalitaet, Serie und Duo sind drei verschiedene Sorten',
     sorten.drei.join(','));
  ok(sorten.sieg !== sorten.pleite, 'Siegesserie und Durststrecke tragen nicht dieselbe Rubrik',
     sorten.sieg + ' / ' + sorten.pleite);
  ok(sorten.ohneSorte === 0, 'jede Karte traegt ihre Sorte', sorten.ohneSorte + ' ohne');

  const zeichen = await page.evaluate(() => {
    const icon = window.__k.eval('_newsSorteIcon');
    const sorten = ['spiel','tafel','ins','held','woche','duell','serie','badge','marke','fakt'];
    const namen = sorten.map(so => icon(so, {dataRef:{type:'x'}}));
    const doppelt = namen.filter((n, i) => namen.indexOf(n) !== i);
    return {namen, doppelt};
  });
  ok(zeichen.doppelt.length === 0,
     'keine zwei Rubriken tragen dasselbe Zeichen', zeichen.doppelt.join(', '));

  console.log('\n═══ ROT BLEIBT DER RICHTUNG ═══');
  const richtung = await page.evaluate(() => {
    const bau = window.__k.eval('_newsCardHtmlM2');
    const roh = window.__k.eval('_buildStories()');
    const basis = roh[0];
    const huelle = document.createElement('div');
    document.getElementById('sheet').appendChild(huelle);
    const farbe = typ => {
      huelle.innerHTML = bau(Object.assign({}, basis, {dataRef:
        Object.assign({}, basis.dataRef || {}, {type: typ, a:'x', b:'y', streak:5})}), false, false);
      const r = huelle.querySelector('.nf-rub');
      return r ? getComputedStyle(r).color : '';
    };
    const pleite = farbe('team_loss_streak');
    const sieg = farbe('team_streak');
    huelle.remove();
    return {pleite, sieg, rot: /^rgb\(2[0-9]{2}, *[0-9]{1,3}, *[0-9]{1,3}\)/.test(pleite)};
  });
  ok(richtung.rot, 'die Durststrecke traegt Rot in der Rubrik', richtung.pleite);
  ok(richtung.pleite !== richtung.sieg, 'Serie und Durststrecke tragen nicht dieselbe Farbe',
     richtung.sieg + ' / ' + richtung.pleite);

  console.log('\n═══ KEINE LUECKEN IN DER KARTE ═══');
  const luecken = await page.evaluate(() => {
    const sheet = document.getElementById('sheet');
    const karten = [...sheet.querySelectorAll('.nf-card')];
    let zuHoch = 0, aerger = '';
    karten.forEach(c => {
      const l = c.querySelector('.nf-gr-l'), r = c.querySelector('.nf-gr-r');
      if(!l || !r) return;
      // Gemessen wird der INHALT der Bildzone, nicht ihr gestreckter Kasten:
      // die Spalte steht auf `align-self:stretch` und meldete sonst immer
      // dieselbe Hoehe wie der Text daneben.
      const kinder = [...l.children];
      if(!kinder.length) return;
      const oben = Math.min.apply(null, kinder.map(k => k.getBoundingClientRect().top));
      const unten = Math.max.apply(null, kinder.map(k => k.getBoundingClientRect().bottom));
      const inhalt = unten - oben;
      const text = r.getBoundingClientRect().height;
      if(inhalt > text + 12){ zuHoch++;
        aerger = aerger || (c.className.split(' ')[1] + ' ' + Math.round(inhalt) + '>' + Math.round(text)); }
    });
    // Das Duell traegt seine Wappen im Band ueber dem Text — nicht noch
    // einmal daneben.
    const duelle = [...sheet.querySelectorAll('.nf-s-duell')];
    const duellDoppelt = duelle.filter(c => c.querySelector('.nf-gr-l')).length;
    const duellBand = duelle.filter(c => c.querySelector('.nf-duell-band')).length;
    // Das Serienband sagt, was seine Punkte zaehlen.
    const baender = [...sheet.querySelectorAll('.nf-ser')];
    const ohneLabel = baender.filter(b => !b.querySelector('span')).length;
    return {karten: karten.length, zuHoch, aerger, duelle: duelle.length,
            duellDoppelt, duellBand, baender: baender.length, ohneLabel};
  });
  ok(luecken.zuHoch === 0, 'die Bildzone macht die Karte nicht hoeher als ihr Text',
     luecken.zuHoch + ' zu hoch' + (luecken.aerger ? ' (' + luecken.aerger + ')' : ''));
  ok(luecken.duelle === 0 || luecken.duellBand === luecken.duelle,
     'das Duell traegt sein Band', luecken.duellBand + ' von ' + luecken.duelle);
  ok(luecken.duellDoppelt === 0, 'das Duell zeigt seine Wappen nur einmal',
     luecken.duellDoppelt + ' doppelt');
  ok(luecken.baender === 0 || luecken.ohneLabel === 0,
     'das Serienband nennt, was es zaehlt', luecken.ohneLabel + ' ohne');

  console.log('\n═══ BREAKING BRICHT DIE SPALTE ═══');
  const brk = await page.evaluate(() => {
    // Kein Breaking im Fenster: eines nachbauen und in denselben Feed haengen.
    const sheet = document.getElementById('sheet');
    const feed = sheet.querySelector('.nf-feed');
    if(!feed) return {ok:false};
    const roh = window.__k.eval('_buildStories()');
    const basis = roh[0];
    const fake = Object.assign({}, basis, {dataRef: Object.assign({}, basis.dataRef || {},
      {type:'lead_change'})});
    const html = window.__k.eval('_newsCardHtmlM2')(fake, false, false);
    const huelle = document.createElement('div');
    huelle.innerHTML = html;
    const karte = huelle.firstElementChild;
    feed.appendChild(karte);
    const bb = karte.getBoundingClientRect();
    const andere = [...feed.querySelectorAll('.nf-card:not(.nf-brk)')]
      .map(c => c.getBoundingClientRect().width);
    const band = karte.querySelector('.nf-brk-band');
    const res = {istBrk: karte.classList.contains('nf-brk'), breite: bb.width,
                 maxAndere: Math.max.apply(null, andere), band: !!band,
                 rahmen: getComputedStyle(karte).borderTopStyle};
    karte.remove();
    return res;
  });
  ok(brk.istBrk, 'ein Breaking-Anlass macht die Karte zur Breaking-Karte');
  ok(brk.breite > brk.maxAndere, 'Breaking steht breiter als jede andere Karte',
     brk.breite + ' gegen ' + brk.maxAndere);
  ok(brk.band, 'Breaking traegt seinen Balken');
  ok(brk.rahmen === 'solid', 'Breaking traegt immer den vollen Rahmen', brk.rahmen);

  console.log('\n═══ DER KOPF DES BLATTS ═══');
  const kopf = await page.evaluate(() => {
    const roh = window.__k.eval('_buildStories()');
    const body = window.__k.eval('_newsDetailBody');
    const box = document.createElement('div');
    document.body.appendChild(box);
    let einzel = 0, mitAbzeichen = 0, mitRangText = 0;
    roh.forEach(s => {
      let h = ''; try { h = body(s) || ''; } catch(e){ return; }
      box.innerHTML = h;
      const held = box.querySelector('.nd-held:not(.nd-held-duo)');
      if(!held) return;
      einzel++;
      // Das Rangabzeichen ist ein Bauteil, das die App schon hat [§C27]; im
      // Blatt stand statt seiner die Zeile „Rang 6" als nackter Text.
      if(held.querySelector('.rangab')) mitAbzeichen++;
      // Kein \b vor „Rang": im textContent klebt das Abzeichen davor
      // („SolideRang 10"), und die Wortgrenze fiel damit weg.
      if(/Rang \d/.test(held.textContent)) mitRangText++;
    });
    box.remove();
    return {einzel, mitAbzeichen, mitRangText};
  });
  ok(kopf.einzel === 0 || kopf.mitAbzeichen === kopf.einzel,
     'jeder Blattkopf traegt sein Rangabzeichen',
     kopf.mitAbzeichen + ' von ' + kopf.einzel);
  ok(kopf.mitRangText === 0, 'und nennt den Rang nicht noch einmal als Text',
     kopf.mitRangText + ' doppelt');

  console.log('\n═══ DAS BLATT SCHMUECKT AUS ═══');
  const schmuckBlatt = await page.evaluate(() => {
    const roh = window.__k.eval('_buildStories()');
    const body = window.__k.eval('_newsDetailBody');
    const sorte = window.__k.eval('_newsSorte');
    const box = document.createElement('div');
    document.body.appendChild(box);
    let medaille = 0, badges = 0, namenDoppelt = 0, rekorde = 0, mitVerfolger = 0,
        serien = 0, mitLauf = 0;
    roh.forEach(s => {
      const t = (s.dataRef || {}).type;
      let h = ''; try { h = body(s) || ''; } catch(e){ return; }
      box.innerHTML = h;
      if(t === 'badge_unlocked'){
        badges++;
        if(box.querySelector('.nd-med')) medaille++;
        // Der Name der Auszeichnung steht in der Schlagzeile; im Blatt stand
        // er darunter ein zweites Mal.
        const nm = (s.dataRef || {}).badgeName || '';
        if(nm){
          const treffer = (box.textContent.match(new RegExp(nm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
          if(treffer > 1) namenDoppelt++;
        }
      }
      if(t === 'rekord_geholt'){
        rekorde++;
        if(box.querySelector('.nd-vf')) mitVerfolger++;
      }
      if(t === 'loss_streak' || t === 'win_streak' || t === 'team_streak' || t === 'team_loss_streak'){
        serien++;
        if(box.querySelector('.nf-ser')) mitLauf++;
      }
      if(sorte(s)) { /* jede Sorte hat eine */ }
    });
    box.remove();
    return {medaille, badges, namenDoppelt, rekorde, mitVerfolger, serien, mitLauf};
  });
  ok(schmuckBlatt.badges === 0 || schmuckBlatt.medaille === schmuckBlatt.badges,
     'jedes Auszeichnungs-Blatt traegt sein Medaillon',
     schmuckBlatt.medaille + ' von ' + schmuckBlatt.badges);
  ok(schmuckBlatt.namenDoppelt === 0, 'der Name der Auszeichnung steht nur einmal im Blatt',
     schmuckBlatt.namenDoppelt + ' doppelt');
  ok(schmuckBlatt.rekorde === 0 || schmuckBlatt.mitVerfolger === schmuckBlatt.rekorde,
     'jedes Rekord-Blatt nennt die Verfolger',
     schmuckBlatt.mitVerfolger + ' von ' + schmuckBlatt.rekorde);
  ok(schmuckBlatt.serien === 0 || schmuckBlatt.mitLauf === schmuckBlatt.serien,
     'jedes Serien-Blatt zeigt den Lauf',
     schmuckBlatt.mitLauf + ' von ' + schmuckBlatt.serien);

  console.log('\n' + '═'.repeat(60));
  console.log(fails === 0 ? `ALLE ${checks} CHECKS BESTANDEN` : `${fails} von ${checks} CHECKS FEHLGESCHLAGEN`);
  await browser.close();
  process.exit(fails === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
