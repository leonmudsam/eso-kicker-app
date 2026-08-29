// §4.1b — DAS ZEICHEN, im echten Browser nachgemessen.
//
// Die beiden Aussagen am Avatar sind Geometrie, und Geometrie kann man nicht
// durch Lesen prüfen: ob die Flamme in ihrer Zeile bleibt, hängt an der Box
// in 15-zeichen.css, am Deckel ZN_SPITZE in 09c-zeichen.js UND am
// Innenabstand von .rrow in 02-ranking.css. Drei Dateien, eine Zusage —
// deshalb wird hier gerendert und gemessen, nicht behauptet.
//
// Was geprüft wird:
//   1. Alle drei Stufen entstehen und sind als Stop-Motion aufgebaut
//   2. Die Flamme bleibt in ihrer Ranglistenzeile — oben, unten, seitlich
//   3. Die Stufen sind der Größe nach getrennt (sonst sagen sie nichts)
//   4. Das Titelband bleibt in der Zeile
//   5. Die drei Metalle stehen an Platz 1, 2, 3
const fs = require('fs');
const chromium = require('./browser.js').ladeChromium();
if(!chromium){
  console.log('ÜBERSPRUNGEN — kein Chromium verfügbar.');
  console.log('  Das Zeichen ist Geometrie; sie lässt sich nur gerendert messen.');
  console.log('  Lokal: npm install --no-save playwright-core');
  process.exit(2);
}

const html = fs.readFileSync(require('./ziel.js'), 'utf8');
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let m, blocks = [];
while ((m = re.exec(html))) blocks.push(m[1]);
blocks.sort((a, b) => b.length - a.length);
let code = blocks[0].replace(/loadAll\(\);\s*\ncheckForUpdate\(\);/, '/*t*/');
const lc = code.lastIndexOf('})();');
code = code.slice(0, lc) + '\nwindow.__k = {eval: c => eval(c)};\n' + code.slice(lc);

// Die Maße hängen am CSS der App — ohne die <style>-Blöcke misst man ein
// Dokument ohne Layout und bekommt grüne Haken für nichts.
// Nur aus dem Kopf: weiter unten steht <styleSheet> in einer JS-Zeichenkette
// (der XLSX-Export), und ein gieriges <style[^>]*> greift auch das ab.
const kopf = html.slice(0, html.indexOf('</head>'));
const styles = (kopf.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || []).join('\n');

const BOOT = `
(function(){
  const stub = () => new Proxy(function(){}, {get(_,p){return p==='then'?undefined:stub()}, apply(){return stub()}});
  window.supabase = {createClient: () => ({from: () => stub(), channel: () => stub(), removeChannel(){}, rpc: () => stub()})};
  window.fetch = () => new Promise(()=>{});
  window.setInterval = () => 0;
})();
`;

let fails = 0, checks = 0;
const ok = (c, msg, det) => {
  checks++; if(!c) fails++;
  console.log((c ? '  ok  ' : '  FAIL') + '  ' + msg + (!c && det ? ' → ' + det : ''));
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({viewport: {width: 360, height: 1200}});
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.stack || e)));
  // Der Rumpf beginnt beim ERSTEN <body> nach dem Kopf; weiter unten steht
  // '<body' noch einmal in einer JS-Zeichenkette.
  const bodyStart = html.indexOf('<body', html.indexOf('</head>'));
  const bodyHtml = html.slice(bodyStart, html.indexOf('<script', bodyStart))
    .replace(/<script[\s\S]*?<\/script>/gi, '');
  await page.setContent('<!doctype html><html><head><meta charset="utf-8">' + styles
    + '</head>' + bodyHtml + '</body></html>');
  ok(styles.length > 10000, 'die Stile der App sind geladen', styles.length + ' Zeichen');
  await page.addScriptTag({content: BOOT});
  await page.addScriptTag({content: code});
  ok(errors.length === 0, 'Skript lädt ohne Fehler', errors[0]);

  const K = async src => page.evaluate(s => window.__k.eval(s), src);

  console.log('\n═══ 1. DIE DREI STUFEN ═══');
  const bau = await K(`ZN_FEUER.map(s => s ? {
    bilder: s.split('class="zf ').length - 1,
    kerne:  s.split('class="zf zk ').length - 1,
    box:    s.indexOf('class="zn-fx"') >= 0
  } : null)`);
  ok(bau.length === 4 && bau[0] === null, 'Stufe 0 zeichnet nichts');
  // bilder zählt Hüllen UND Kerne, kerne nur die Kerne — je Bild eines von beiden.
  ok(bau[1] && bau[1].bilder === 4 && bau[1].kerne === 2, 'Stufe 1: zwei Bilder, je Hülle und Kern',
     JSON.stringify(bau[1]));
  ok(bau[2] && bau[2].bilder === 4 && bau[2].kerne === 2, 'Stufe 2: zwei Bilder, je Hülle und Kern',
     JSON.stringify(bau[2]));
  ok(bau[3] && bau[3].bilder === 6 && bau[3].kerne === 3, 'Stufe 3: drei Bilder, je Hülle und Kern',
     JSON.stringify(bau[3]));

  // Dieselbe Stufe muss bei jedem Aufruf dasselbe Bild liefern — sonst
  // flackert eine Zeile bei jedem Neuzeichnen anders.
  const gleich = await K(`_znBild(3,1,0) === _znBild(3,1,0) && _znBild(2,0,0) === _znBild(2,0,0)`);
  ok(gleich, 'die Bilder sind deterministisch (kein Math.random)');
  const verschieden = await K(`_znBild(3,0,0) !== _znBild(3,1,0)`);
  ok(verschieden, 'aufeinanderfolgende Bilder unterscheiden sich');

  console.log('\n═══ 2. DIE FLAMME BLEIBT IN IHRER ZEILE ═══');
  // Eine echte Ranglistenzeile aus dem echten CSS, je Stufe eine.
  await page.evaluate(() => {
    const K = window.__k.eval.bind(window.__k);
    const F = K('ZN_FEUER'), S = n => K('_znSterneSvg(' + n + ')');
    document.body.innerHTML = '<div id="app"><main style="padding:14px 15px">'
      + '<div class="rlist">' + [1,2,3].map(st =>
        '<div class="rrow"><span class="pos">' + st + '</span>'
        + '<span class="zn zn-l' + st + '">' + F[st]
        + '<span class="av" style="background:#56b4e8">AB</span>' + S(st) + '</span>'
        + '<div style="flex:1"><div class="rname">Stufe ' + st + '</div></div>'
        + '<div class="rval"><div class="big num">100</div></div></div>').join('')
      + '</div></main></div>';
  });
  await page.waitForTimeout(120);

  const mass = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.zn').forEach((zn, i) => {
      const zeile = zn.closest('.rrow').getBoundingClientRect();
      const av = zn.querySelector('.av').getBoundingClientRect();
      let bb = null;
      zn.querySelectorAll('.zn-fx path').forEach(p => {
        const r = p.getBoundingClientRect();
        bb = bb ? {t: Math.min(bb.t, r.top), b: Math.max(bb.b, r.bottom),
                   l: Math.min(bb.l, r.left), r: Math.max(bb.r, r.right)}
                : {t: r.top, b: r.bottom, l: r.left, r: r.right};
      });
      const ti = zn.querySelector('.zn-ti');
      const tr = ti ? ti.getBoundingClientRect() : null;
      out.push({
        stufe: i + 1,
        ueberZeile:  +(zeile.top - bb.t).toFixed(1),   // > 0 heißt: läuft oben raus
        unterZeile:  +(bb.b - zeile.bottom).toFixed(1),
        linksRaus:   +(zeile.left - bb.l).toFixed(1),
        rechtsRaus:  +(bb.r - zeile.right).toFixed(1),
        ueberAvatar: +(av.top - bb.t).toFixed(1),      // wie hoch sie schlägt
        bandRaus:    tr ? +(tr.bottom - zeile.bottom).toFixed(1) : null,
        // Alle Sterne stecken in EINEM Pfad; je Stern ein M-Befehl.
        sterne:      (((zn.querySelector('.zn-ti .zs')||{}).getAttribute
                       ? zn.querySelector('.zn-ti .zs').getAttribute('d') : '')
                      .match(/M/g) || []).length
      });
    });
    return out;
  });

  mass.forEach(x => {
    ok(x.ueberZeile < 0 && x.unterZeile < 0 && x.linksRaus < 0 && x.rechtsRaus < 0,
       `Stufe ${x.stufe}: Flamme bleibt in der Zeile`,
       `oben ${x.ueberZeile} unten ${x.unterZeile} links ${x.linksRaus} rechts ${x.rechtsRaus}`);
    ok(x.bandRaus !== null && x.bandRaus < 0,
       `Stufe ${x.stufe}: Titelband bleibt in der Zeile`, 'unten ' + x.bandRaus);
  });

  console.log('\n═══ 3. DIE STUFEN SIND UNTERSCHEIDBAR ═══');
  console.log(`  Höhe über der Avatarkante: ${mass.map(x => x.stufe + '→' + x.ueberAvatar + 'px').join('  ')}`);
  ok(mass[0].ueberAvatar < mass[1].ueberAvatar && mass[1].ueberAvatar < mass[2].ueberAvatar,
     'jede Stufe schlägt höher als die davor');
  ok(mass[2].ueberAvatar - mass[0].ueberAvatar >= 3,
     'zwischen kleinster und größter Stufe liegen mind. 3 px',
     (mass[2].ueberAvatar - mass[0].ueberAvatar) + ' px');
  // Der Bogen ist der eigentliche Unterschied: Stufe 3 umschließt den Avatar,
  // Stufe 1 sitzt ihm nur oben auf.
  const breiten = await page.evaluate(() => [...document.querySelectorAll('.zn')].map(zn => {
    const av = zn.querySelector('.av').getBoundingClientRect();
    let l = Infinity, r = -Infinity;
    zn.querySelectorAll('.zn-fx path').forEach(p => {
      const b = p.getBoundingClientRect(); l = Math.min(l, b.left); r = Math.max(r, b.right);
    });
    return +((av.left - l) + (r - av.right)).toFixed(1);
  }));
  console.log(`  seitlicher Griff um den Avatar: ${breiten.map((b,i) => (i+1) + '→' + b + 'px').join('  ')}`);
  ok(breiten[0] < breiten[1] && breiten[1] <= breiten[2],
     'jede Stufe greift weiter um den Avatar als die davor', JSON.stringify(breiten));

  console.log('\n═══ 4. DAS TITELBAND ═══');
  ok(mass[0].sterne === 1 && mass[1].sterne === 2 && mass[2].sterne === 3,
     'ein Stern je Titel', JSON.stringify(mass.map(x => x.sterne)));
  const viele = await K(`[6,9].map(n => ({
    sterne: (_znSterneSvg(n).split('class="zs" d="')[1]||'').split('M').length - 1,
    ziffer: _znSterneSvg(n).indexOf('zn-ti-n') >= 0
  }))`);
  ok(viele.every(v => v.sterne === 5 && v.ziffer),
     'ab sechs Titeln fünf Sterne plus Ziffer', JSON.stringify(viele));
  ok(await K(`_znSterneSvg(0) === ''`), 'ohne Titel kein Band');

  console.log('\n═══ 5. DIE DREI METALLE ═══');
  // Am gebauten CSS, nicht am gerenderten Knoten: Chromium liefert für dieses
  // zusammengesetzte Dokument keine :root-Regel zurück, und ein Test, dessen
  // Messung man nicht erklären kann, ist keine Zusage.
  const cssText = styles;
  const metalle = {gold: /--gold:\s*#f7cf4a/i.test(cssText),
                   silber: /--silber:\s*#C2C9D0/i.test(cssText),
                   bronze: /--bronze:\s*#C08457/i.test(cssText)};
  ok(metalle.gold && metalle.silber && metalle.bronze,
     'alle drei Metalle sind Tokens', JSON.stringify(metalle));
  const raeder = {
    top1: /\.rrow\.top1::before\{background:var\(--gold\)\}/.test(cssText),
    top2: /\.rrow\.top2::before\{background:var\(--silber\)\}/.test(cssText),
    top3: /\.rrow\.top3::before\{background:var\(--bronze\)\}/.test(cssText)
  };
  ok(raeder.top1 && raeder.top2 && raeder.top3,
     'Platz 1, 2, 3 tragen Gold, Silber, Bronze', JSON.stringify(raeder));
  // Kein Nachzügler: Silber und Bronze dürfen nirgends mehr als Rohwert stehen.
  const alteToene = (cssText.match(/#c8d0cb|#cd7f32|#c0c0c0|#cdd5d0|#d49158/gi) || []);
  ok(alteToene.length === 0, 'keine alten Silber-/Bronzetöne mehr im CSS',
     alteToene.join(' '));

  console.log('\n' + '═'.repeat(60));
  console.log(fails === 0 ? `ALLE ${checks} CHECKS BESTANDEN` : `${fails} von ${checks} CHECKS FEHLGESCHLAGEN`);
  await browser.close();
  process.exit(fails === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
