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
// UND: erst die HTML-Kommentare weg. Ganz oben steht ein Banner, das die
// Dateistruktur beschreibt und dabei den Text „<style>(CSS)" enthält. Wer
// darauf greift, bekommt ein CSS, das mit Banner-Müll beginnt — der Parser
// sucht dann die erste { und findet die von :root, verwirft deren Rumpf als
// kaputte Regel und damit sämtliche Design-Tokens. Alles rendert farblos,
// aber der Test wird grün, weil Maße davon nicht abhängen.
const kopf = html.slice(0, html.indexOf('</head>')).replace(/<!--[\s\S]*?-->/g, '');
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
  // Eine echte Ranglistenzeile aus dem echten CSS, je Stufe eine — und
  // zwar mit dem echten Bauteil: seit [§C27] sitzt in jeder Zeile der
  // Avatar im Wappen, und die runde Form, an der die Glut ansetzt, ist
  // nicht mehr der Avatar, sondern der Metallreif.
  await page.evaluate(() => {
    const K = window.__k.eval.bind(window.__k);
    const av = '<span class="av" style="background:#56b4e8">AB</span>';
    document.body.innerHTML = '<div id="app"><main style="padding:14px 15px">'
      + '<div class="rlist">' + [1,2,3].map(st =>
        '<div class="rrow"><span class="pos num">' + st + '</span>'
        + K('insAvWrap("zn-test", ' + JSON.stringify(av)
            + ', {px:52, feuer:' + st + ', titel:' + st + '})')
        + '<div class="rmid"><div class="rname">Stufe ' + st + '</div></div>'
        + '<div class="rval"><div class="big num">100</div></div></div>').join('')
      + '</div></main></div>';
  });
  await page.waitForTimeout(120);

  const mass = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.rav').forEach((zn, i) => {
      const zeile = zn.closest('.rrow').getBoundingClientRect();
      let ring = null;
      for(const c of zn.querySelectorAll('svg.ins circle')){
        if(Math.abs(+c.getAttribute('r') - 40) < .01){ ring = c.getBoundingClientRect(); break; }
      }
      let bb = null;
      zn.querySelectorAll('.zn-fx path').forEach(p => {
        const r = p.getBoundingClientRect();
        if(r.width === 0) return;
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
        ueberReif:   +(ring.top - bb.t).toFixed(1),    // wie hoch sie schlägt
        // > 0 hieße: die Flamme steht seitlich über den Reif hinaus.
        linksNebenReif:  +(ring.left - bb.l).toFixed(2),
        rechtsNebenReif: +(bb.r - ring.right).toFixed(2),
        griff:       +((ring.left - bb.l) + (bb.r - ring.right)).toFixed(1),
        bandRaus:    tr ? +(tr.bottom - zeile.bottom).toFixed(1) : null,
        // Alle Sterne stecken in EINEM Pfad; je Stern ein M-Befehl.
        sterne:      (((zn.querySelector('.zn-ti .zs')||{}).getAttribute
                       ? zn.querySelector('.zn-ti .zs').getAttribute('d') : '')
                      .match(/M/g) || []).length
      });
    });
    return out;
  });

  ok(mass.length === 3, 'drei Zeilen mit Wappen gerendert', 'gefunden: ' + mass.length);
  mass.forEach(x => {
    ok(x.ueberZeile < 0 && x.unterZeile < 0 && x.linksRaus < 0 && x.rechtsRaus < 0,
       `Stufe ${x.stufe}: Flamme bleibt in der Zeile`,
       `oben ${x.ueberZeile} unten ${x.unterZeile} links ${x.linksRaus} rechts ${x.rechtsRaus}`);
    ok(x.bandRaus !== null && x.bandRaus < 0,
       `Stufe ${x.stufe}: Titelband bleibt in der Zeile`, 'unten ' + x.bandRaus);
    // Das Feuer kommt oben heraus und sonst nirgends. Vorher stand das
    // Glutbett an den Bogenenden waagerecht neben der runden Form — zwei
    // kurze Hörner, die aussahen, als gehörten sie nicht dazu.
    ok(x.linksNebenReif <= 0 && x.rechtsNebenReif <= 0,
       `Stufe ${x.stufe}: Flamme steht seitlich nicht über den Reif hinaus`,
       `links ${x.linksNebenReif} rechts ${x.rechtsNebenReif}`);
    ok(x.ueberReif > 2,
       `Stufe ${x.stufe}: Flamme kommt oben heraus`, 'oben ' + x.ueberReif);
  });

  console.log('\n═══ 3. DIE STUFEN SIND UNTERSCHEIDBAR ═══');
  console.log(`  Höhe über der Reifkante: ${mass.map(x => x.stufe + '→' + x.ueberReif + 'px').join('  ')}`);
  ok(mass[0].ueberReif < mass[1].ueberReif && mass[1].ueberReif < mass[2].ueberReif,
     'jede Stufe schlägt höher als die davor',
     JSON.stringify(mass.map(x => x.ueberReif)));
  ok(mass[2].ueberReif - mass[0].ueberReif >= 2,
     'zwischen kleinster und größter Stufe liegen mind. 2 px',
     (mass[2].ueberReif - mass[0].ueberReif) + ' px');
  // Der Bogen ist der eigentliche Unterschied: Stufe 3 umschließt die
  // runde Form, Stufe 1 sitzt ihr nur oben auf.
  console.log(`  seitlicher Griff um den Reif: ${mass.map(x => x.stufe + '→' + x.griff + 'px').join('  ')}`);
  ok(mass[0].griff <= mass[1].griff && mass[1].griff <= mass[2].griff,
     'jede Stufe greift mindestens so weit um den Reif wie die davor',
     JSON.stringify(mass.map(x => x.griff)));

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
  // Erst am gerenderten Knoten — genau dieser Check war lange nicht möglich,
  // weil das Banner-Kommentar die :root-Regel gefressen hat (siehe oben).
  const geleseneToken = await page.evaluate(() => {
    const c = getComputedStyle(document.documentElement);
    return {gold: c.getPropertyValue('--gold').trim(),
            silber: c.getPropertyValue('--silber').trim(),
            bronze: c.getPropertyValue('--bronze').trim(),
            ink: c.getPropertyValue('--ink').trim()};
  });
  ok(geleseneToken.gold && geleseneToken.silber
     && geleseneToken.bronze && geleseneToken.ink,
     'die Tokens kommen im Browser an', JSON.stringify(geleseneToken));
  // Und dann am Quelltext, damit die Werte selbst festgenagelt sind.
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

  console.log('\n═══ 6. DIE MASKE LEBT ═══');
  // Der Ausblender ist das, was den Unterschied zwischen „Flamme" und
  // „abgeschnittener Zackenkranz" macht. Er stand lange als
  // radial-gradient(circle 52% ...) im CSS — ein circle darf laut Spec keinen
  // Prozentradius tragen, Chromium verwirft die ganze Deklaration, und
  // mask-image wird none. Malflächen ändern sich davon nicht, also lief der
  // Fehler unter allen bisherigen Checks durch. Darum hier direkt gemessen.
  const maske = await page.evaluate(() => {
    const fx = document.querySelector('.zn-fx');
    if(!fx) return {fehlt: true};
    const c = getComputedStyle(fx);
    return {wert: c.maskImage || c.webkitMaskImage};
  });
  ok(!maske.fehlt, 'im Dokument steht ein Feuer', JSON.stringify(maske));
  ok(maske.wert && maske.wert !== 'none',
     'die Maske ist gültiges CSS und wird angewandt', JSON.stringify(maske));
  ok(!/\bcircle\s+[\d.]+%/.test(cssText),
     'kein circle mit Prozentradius mehr im CSS',
     (cssText.match(/circle\s+[\d.]+%/g) || []).join(' '));

  console.log('\n═══ 7. DAS FEUER AM INSIGNIUM ═══');
  // Die runde Form, an der die Glut ansetzt, ist NICHT der Avatar, sobald
  // ein Wappen um ihn liegt. Welche es ist, hängt von der Größe ab — und
  // beide Antworten sind hier festgenagelt, weil jede von ihnen schon
  // einmal falsch war:
  //
  //   PODEST (92 px)   — der Metallreif. Der Kranz ist bei dieser Größe nur
  //                      ein Blätterrand; setzt die Glut an ihm an, steht
  //                      sie als gezackter Kragen um das ganze Wappen und
  //                      stößt oben an den Kartenrand. Sie gehört auf den
  //                      Reif, und nur die Zungen steigen darüber hinaus.
  //
  //   PROFILKOPF (242 px) — der Kranz. Am Reif liegt das ganze Feuer unter
  //                      Blättern und Schwingen; sichtbar bleibt ein
  //                      Streifen von neun Einheiten, und nach dem
  //                      Weichzeichnen ist davon nichts mehr übrig. Genau
  //                      so war die Serie im Profil unsichtbar.
  //                      Am Kranz muss dafür das Bett weggeschnitten sein —
  //                      der Kranz ist keine Scheibe, er hat Lücken, und
  //                      durch die stand das Bett früher als Kragen.
  //
  // Gemeinsam bleibt: seitlich steht nichts über die Bezugsform hinaus,
  // oben kommen die Zungen sichtbar heraus.
  // Der Kranz misst 51 der 144 Einheiten, der Reif 40 — der Kranzradius ist
  // also das 1,275-fache des Reifradius.
  const insMass = await page.evaluate(() => {
    const K = window.__k.eval.bind(window.__k);
    const F = K('ZN_FEUER');
    // Der Profilkopf nimmt den zweiten Satz: dieselben Zungen ohne Glutbett.
    const G = K('ZN_FEUER_GROSS');
    const av = '<span class="av" style="background:#56b4e8">AB</span>';
    const mit = K('insigniumSvg("zn-test")');
    document.body.innerHTML = '<div id="app"><main style="padding:14px 15px">'
      + '<div class="podest"><div class="pod-karte gold erster">'
      +   '<div class="pod-platz num">01</div>'
      +   K('insAvWrap("zn-test", ' + JSON.stringify(av)
            + ', {px:92, band:true, pos:1, feuer:1, titel:1, klasse:"pod-av"})')
      +   '<div class="pod-name">Test</div><div class="pod-wert num">400</div>'
      + '</div></div>'
      + '<div class="pp-av-wrap zn-rang zn-l1">'
      +   G[1] + mit
      +   '<div class="pp-av-ring"><div class="av" style="width:108px;height:108px">AB</div></div>'
      + '</div></main></div>';
    const messen = (wrapSel) => {
      const wrap = document.querySelector(wrapSel);
      if(!wrap) return null;
      let ring = null;
      for(const c of wrap.querySelectorAll('svg.ins circle')){
        if(Math.abs(+c.getAttribute('r') - 40) < .01){ ring = c.getBoundingClientRect(); break; }
      }
      let bb = null;
      wrap.querySelectorAll('.zn-fx path').forEach(p => {
        const r = p.getBoundingClientRect();
        if(r.width === 0) return;
        bb = bb ? {t: Math.min(bb.t, r.top), l: Math.min(bb.l, r.left), r: Math.max(bb.r, r.right)}
                : {t: r.top, l: r.left, r: r.right};
      });
      if(!ring || !bb) return null;
      const karte = wrap.closest('.pod-karte');
      const rr = ring.width / 2, cx = ring.left + rr, kr = rr * 1.275;
      const st = getComputedStyle(wrap.querySelector('.zn-fx'));
      return {
        // > 0 hieße: die Glut steht seitlich über den Reif hinaus.
        linksNebenReif:  +(ring.left - bb.l).toFixed(2),
        rechtsNebenReif: +(bb.r - ring.right).toFixed(2),
        ueberReif:       +(ring.top - bb.t).toFixed(1),
        // Dasselbe gegen den Lorbeerkranz — die Bezugsform im Profilkopf.
        linksNebenKranz:  +((cx - kr) - bb.l).toFixed(2),
        rechtsNebenKranz: +(bb.r - (cx + kr)).toFixed(2),
        ueberKranz:       +(((ring.top + rr) - kr) - bb.t).toFixed(1),
        // > 0 hieße: sie läuft oben aus der Karte heraus.
        ausKarte: karte ? +(karte.getBoundingClientRect().top - bb.t).toFixed(1) : null,
        weich: (st.filter || '').includes('blur'),
        // Das Glutbett ist der EINZIGE Bogen in der Zeichnung (_znBett zieht
        // zwei A-Kommandos, die Zungen nur Q-Kurven). Steht kein A im d, gibt
        // es kein Bett — und ohne Bett braucht es keine Maske, die es
        // wegschneidet, und ohne diese Maske keine kreisrunde Kante.
        bogen: [...wrap.querySelectorAll('.zn-fx path')]
          .some(p => /A\s*\d/.test(p.getAttribute('d') || '')),
        maskeAus: (st.maskImage || st.webkitMaskImage || 'none') === 'none'
      };
    };
    return {podest: messen('.pod-av'), profil: messen('.pp-av-wrap')};
  });
  await page.waitForTimeout(60);

  const P = insMass.podest, Q = insMass.profil;
  ok(P !== null, 'Podest: Reif und Flamme sind messbar', JSON.stringify(P));
  ok(Q !== null, 'Profilkopf: Reif und Flamme sind messbar', JSON.stringify(Q));

  if(P){
    ok(P.linksNebenReif <= 0 && P.rechtsNebenReif <= 0,
       'Podest: die Glut liegt auf dem Reif, nicht als Kragen darum',
       `links ${P.linksNebenReif} rechts ${P.rechtsNebenReif}`);
    ok(P.ueberReif > 2, 'Podest: die Zungen steigen oben aus dem Reif heraus',
       'oben ' + P.ueberReif);
    ok(P.weich, 'Podest: die Zungen sind weichgezeichnet (sonst harte Dreiecke)');
    ok(P.bogen,
       'Podest: das Glutbett verbindet die Füße der Zungen — ohne es stehen sie als Stacheln da',
       'Bogen im Pfad: ' + P.bogen);
  }
  if(Q){
    // Zwei Pixel Zugabe: der Weichzeichner trägt die Kante ein Stück nach außen.
    ok(Q.linksNebenKranz <= 2 && Q.rechtsNebenKranz <= 2,
       'Profilkopf: die Glut steht seitlich nicht über den Kranz hinaus',
       `links ${Q.linksNebenKranz} rechts ${Q.rechtsNebenKranz}`);
    ok(Q.ueberKranz > 8,
       'Profilkopf: die Zungen steigen deutlich über den Kranz — sonst ist die Serie unsichtbar',
       'oben ' + Q.ueberKranz);
    ok(!Q.bogen,
       'Profilkopf: kein Glutbett gezeichnet — es stand als Scheibe hinter dem Kranz',
       'Bogen im Pfad: ' + Q.bogen);
    ok(Q.maskeAus,
       'Profilkopf: keine Maske — eine radiale Maske hinterlässt genau die runde Kante um den Kopf',
       'maskImage gesetzt');
    ok(Q.weich, 'Profilkopf: die Zungen sind weichgezeichnet (sonst harte Dreiecke)');
  }
  // Nicht nur „drin", sondern mit Luft: bei der alten Größe endete die
  // Spitze exakt auf der Kartenkante, und der Rahmen lief quer durch sie.
  ok(insMass.podest && insMass.podest.ausKarte !== null && insMass.podest.ausKarte < -4,
     'Podest: zwischen Flammenspitze und Kartenrand bleibt Luft',
     insMass.podest ? 'oben ' + insMass.podest.ausKarte : 'nicht gemessen');

  console.log('\n' + '═'.repeat(60));
  console.log(fails === 0 ? `ALLE ${checks} CHECKS BESTANDEN` : `${fails} von ${checks} CHECKS FEHLGESCHLAGEN`);
  await browser.close();
  process.exit(fails === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
