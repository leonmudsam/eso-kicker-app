#!/usr/bin/env node
/*
 *  Prüft, was beim Zerlegen in viele Dateien schiefgehen kann — und nur das.
 *
 *    1  Baut das Ergebnis nach und vergleicht es mit dem ausgelieferten
 *       index.html (Versionszeile ausgenommen). Schlägt an, wenn jemand
 *       index.html direkt bearbeitet hat statt src/.
 *    2  Lässt node die zusammengesetzte Logik parsen — ein Syntaxfehler an
 *       einer Dateigrenze fällt sonst erst im Browser auf.
 *    3  Zählt geschweifte Klammern im CSS: eine offene Klammer am Dateiende
 *       frisst sonst still die nächste Datei.
 *    4  Nimmt sich die Bezeichner auf oberster Ebene vor — zweimal
 *       deklariert oder nirgends benutzt. Getrennte Dateien sehen
 *       unabhängig aus, sind es aber nicht: nach dem Zusammensetzen liegen
 *       sie im selben Gültigkeitsbereich. Und was niemand mehr ruft, fällt
 *       in einer IIFE ohne Importe von selbst niemandem auf.
 *    5  Prüft, dass die ausgelieferte Datei die Version trägt, die zu ihrem
 *       Inhalt gehört. Von Hand gepflegt stand sie sechs Veröffentlichungen
 *       lang still — und `checkForUpdate` verglich damit die Version einer
 *       Seite mit sich selbst: kein Gerät erfuhr je von einer neuen Fassung.
 *    6  Vergleicht CLAUDE.md mit der Wirklichkeit: jede Datei in der
 *       Landkarte, jede Zahl im Text. Eine veraltete Arbeitsanweisung ist
 *       schlimmer als keine — sie wird geglaubt.
 */
import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join as pjoin } from 'node:path';

let fehler = 0;
const rot = s => { console.error('  ✗ ' + s); fehler++; };
const ok  = s => console.log('  ✓ ' + s);

// Versionszeile und Zeilenenden bleiben außen vor. Der Arbeitsbaum unter
// Windows trägt CRLF, das Repository und der Prüf-Job unter Linux tragen LF —
// derselbe Inhalt ergab damit zwei Fingerabdrücke, und Wächter 5 schlug nur im
// Job an. Dieselbe Normalisierung steht in build.mjs.
const strip = s => s.replace(/\r\n/g, '\n')
  .replace(/const BUILD_VERSION=['"][^'"]*['"]/, "const BUILD_VERSION='x'");

// ── 1 ─ kein Drift zwischen src/ und index.html ───────────────────────────
// Erst bauen, dann vergleichen. Wer nur dist/index.html liest, prüft im
// Zweifel zwei alte Dateien gegeneinander und bekommt einen grünen Haken
// dafür, dass sich seit dem letzten Build nichts geändert hat — auch wenn
// src/ inzwischen etwas ganz anderes sagt.
execFileSync(process.execPath, ['tools/build.mjs'], { stdio: 'pipe' });
const gebaut  = readFileSync('dist/index.html', 'utf8');
const geliefert = readFileSync('index.html', 'utf8');
if (strip(gebaut) !== strip(geliefert)) {
  rot('index.html weicht von src/ ab — wurde index.html direkt bearbeitet?');
} else ok('index.html entspricht src/');

// ── 2 ─ die Logik parst ───────────────────────────────────────────────────
const scriptMatch = gebaut.match(/<script>\r?\n([\s\S]*)\r?\n<\/script>/);
const skript = scriptMatch ? scriptMatch[1] : '';
const tmp = pjoin(mkdtempSync(pjoin(tmpdir(), 'kicker-')), 'app.js');
writeFileSync(tmp, skript);
try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); ok('JavaScript parst'); }
catch (e) { rot('Syntaxfehler:\n' + String(e.stderr || e.message).trim()); }

// ── 3 ─ CSS-Klammern gehen auf ────────────────────────────────────────────
// Eigener Zähler: vorher hing die Meldung an `fehler`, also verschwand sie,
// sobald irgendein anderer Wächter angeschlagen hatte — dann sah es aus, als
// wäre die Prüfung gar nicht gelaufen.
let cssSchief = 0;
for (const f of readdirSync('src/css').sort()) {
  const s = readFileSync(`src/css/${f}`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const auf = (s.match(/\{/g) || []).length, zu = (s.match(/\}/g) || []).length;
  if (auf !== zu) { rot(`src/css/${f}: ${auf} × { gegen ${zu} × }`); cssSchief++; }
}
if (!cssSchief) ok('CSS-Klammern ausgeglichen');

// ── 4 ─ keine doppelten Deklarationen auf oberster Ebene ──────────────────
const DEKL = /^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/;
const wo = new Map();
let jsGanz = '';
for (const f of readdirSync('src/js').sort()) {
  const txt = readFileSync(`src/js/${f}`, 'utf8');
  jsGanz += '\n' + txt;
  txt.split('\n').forEach((z, i) => {
    const m = DEKL.exec(z);
    if (!m) return;
    const name = m[1];
    if (!wo.has(name)) wo.set(name, []);
    wo.get(name).push(`${f}:${i + 1}`);
  });
}
const doppelt = [...wo].filter(([, v]) => v.length > 1);
if (doppelt.length) {
  for (const [name, v] of doppelt) rot(`${name} zweimal deklariert — ${v.join(', ')}`);
} else ok(`${wo.size} Bezeichner auf oberster Ebene, alle eindeutig`);

// Und keiner davon ist tot. In einer IIFE ohne Importe sagt nichts, dass eine
// Funktion niemanden mehr hat — sie steht einfach weiter da. `METRICS` tat das
// und führte dabei eine Metrik auf, die es seit zwei Veröffentlichungen nicht
// mehr gab: wer sie liest, glaubt sie.
// Kommentare fallen vorher weg, sonst zählt eine Erwähnung im Fließtext als
// Benutzung. Was nur aus HTML oder CSS gerufen wird, gilt als benutzt.
// Die Tests zählen bewusst NICHT mit: was nur eine Suite ruft, ist im
// Bundle auf jedem Telefon totes Gewicht. Wer hier rot wird, weil ein Test
// den einzigen Aufrufer stellt, ändert den Test — er soll ohnehin den Weg
// prüfen, den die App wirklich nimmt.
const ohneKommentar = jsGanz
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');
const gerueste = readFileSync('src/index.html', 'utf8')
  + readdirSync('src/css').map(f => readFileSync(`src/css/${f}`, 'utf8')).join('\n');
const tot = [];
for (const [name, v] of wo) {
  const wort = new RegExp('\\b' + name.replace(/\$/g, '\\$') + '\\b', 'g');
  if ((ohneKommentar.match(wort) || []).length <= 1 && !wort.test(gerueste))
    tot.push(`${name} (${v[0]})`);
}
if (tot.length) rot('nur an ihrer Deklaration erwähnt: ' + tot.join(', '));
else ok('kein Bezeichner ohne Verwendung');

// ── 5 ─ die Auslieferung trägt ihren Fingerabdruck ────────────────────
// BUILD_VERSION endet auf einem Hash über genau den Inhalt, der ausgeliefert
// wird (build.mjs vergibt ihn). Eine Version, die nicht zu ihrem Inhalt
// passt, heißt: irgendwo steht eine Nummer von Hand — und dann erfährt kein
// Gerät mehr von einer neuen Fassung.
const fp = createHash('sha256').update(strip(geliefert)).digest('hex').slice(0, 8);
const gelieferteV = (geliefert.match(/const BUILD_VERSION=['"]([^'"]*)['"]/) || [])[1];
if (!gelieferteV) rot('index.html hat keine BUILD_VERSION');
else if (!gelieferteV.endsWith('.' + fp))
  rot(`index.html trägt Version ${gelieferteV}, der Inhalt ergibt ….${fp}`
    + ' — neu bauen und kopieren');
else ok(`Version ${gelieferteV} passt zum ausgelieferten Inhalt`);

// ── 6 ─ die Arbeitsanweisung stimmt ───────────────────────────────
// CLAUDE.md ist die erste Datei, die eine neue Sitzung liest. Was hier falsch
// steht, wird geglaubt — und niemand merkt es, weil eine Prosa-Zeile nicht
// rot wird. Also wird sie hier rot.
const anweisung = readFileSync('CLAUDE.md', 'utf8');
const jsDateien  = readdirSync('src/js').filter(f => f.endsWith('.js')).sort();
const cssDateien = readdirSync('src/css').filter(f => f.endsWith('.css')).sort();
const suiten = readdirSync('tests').filter(f => f.endsWith('.test.js')).sort();
let anwSchief = 0;
const schief = m => { rot('CLAUDE.md: ' + m); anwSchief++; };

// (a) Die Landkarte nennt jede Datei aus src/js — und keine, die es nicht gibt.
const karteRoh = anweisung.split('## 3. Landkarte')[1];
if (!karteRoh) schief('§3 Landkarte nicht gefunden');
else {
  const karte = karteRoh.split('### Zustand')[0];
  const genannt = new Set((karte.match(/`(\d\d[a-z]?-[a-z0-9-]+)`/g) || [])
    .map(x => x.slice(1, -1)));
  const stamm = jsDateien.map(f => f.replace(/\.js$/, ''));
  const fehlend = stamm.filter(n => !genannt.has(n));
  const zuviel  = [...genannt].filter(n => !stamm.includes(n));
  if (fehlend.length) schief('§3 nennt diese Dateien nicht: ' + fehlend.join(', '));
  if (zuviel.length)  schief('§3 nennt Dateien, die es nicht gibt: ' + zuviel.join(', '));
}

// (b) Die Zahlen. Jede steht an genau einer Stelle und wird hier nachgezählt.
const zahl = (re, was, ist) => {
  const m = anweisung.match(re);
  if (!m) return schief(`${was} steht nicht mehr im Text (Muster geändert?)`);
  if (+m[1] !== ist) schief(`${was}: dort steht ${m[1]}, gezählt sind ${ist}`);
};
zahl(/Wächter 4 zählt sie \(aktuell \*\*(\d+)\*\*\)/, '§2 Bezeichnerzahl', wo.size);
zahl(/^src\/css\/\s+(\d+) Dateien$/m, '§2 Zahl der CSS-Dateien', cssDateien.length);
zahl(/^src\/js\/\s+(\d+) Dateien$/m,  '§2 Zahl der JS-Dateien',  jsDateien.length);

// (c) Die Suiten: jede Datei eine Zeile in der Tabelle, keine Zeile zuviel.
const tabelle = anweisung.split('## 5. Die Testsuiten')[1] || '';
const genannteSuiten = new Set((tabelle.match(/^\| `([a-z]+)` \|/gm) || [])
  .map(x => x.split('`')[1]));
const echteSuiten = suiten.map(f => f.replace('.test.js', ''));
const suiteFehlt = echteSuiten.filter(n => !genannteSuiten.has(n));
const suiteZuviel = [...genannteSuiten].filter(n => !echteSuiten.includes(n));
if (suiteFehlt.length)  schief('§5 nennt diese Suiten nicht: ' + suiteFehlt.join(', '));
if (suiteZuviel.length) schief('§5 nennt Suiten, die es nicht gibt: ' + suiteZuviel.join(', '));

if (!anwSchief) ok('CLAUDE.md nennt jede Datei und jede Zahl richtig');

process.exit(fehler ? 1 : 0);
