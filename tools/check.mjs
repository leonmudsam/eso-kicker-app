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
 *    4  Sucht Bezeichner, die in zwei Dateien auf oberster Ebene deklariert
 *       werden. Getrennte Dateien sehen unabhängig aus, sind es aber nicht:
 *       nach dem Zusammensetzen liegen sie im selben Gültigkeitsbereich.
 */
import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join as pjoin } from 'node:path';

let fehler = 0;
const rot = s => { console.error('  ✗ ' + s); fehler++; };
const ok  = s => console.log('  ✓ ' + s);

const strip = s => s.replace(/const BUILD_VERSION=['"][^'"]*['"]/, "const BUILD_VERSION='x'");

// ── 1 ─ kein Drift zwischen src/ und index.html ───────────────────────────
const gebaut  = readFileSync('dist/index.html', 'utf8');
const geliefert = readFileSync('index.html', 'utf8');
if (strip(gebaut) !== strip(geliefert)) {
  rot('index.html weicht von src/ ab — wurde index.html direkt bearbeitet?');
} else ok('index.html entspricht src/');

// ── 2 ─ die Logik parst ───────────────────────────────────────────────────
const skript = gebaut.slice(gebaut.indexOf('<script>\n') + 9, gebaut.lastIndexOf('</script>'));
const tmp = pjoin(mkdtempSync(pjoin(tmpdir(), 'kicker-')), 'app.js');
writeFileSync(tmp, skript);
try { execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' }); ok('JavaScript parst'); }
catch (e) { rot('Syntaxfehler:\n' + String(e.stderr || e.message).trim()); }

// ── 3 ─ CSS-Klammern gehen auf ────────────────────────────────────────────
for (const f of readdirSync('src/css').sort()) {
  const s = readFileSync(`src/css/${f}`, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const auf = (s.match(/\{/g) || []).length, zu = (s.match(/\}/g) || []).length;
  if (auf !== zu) rot(`src/css/${f}: ${auf} × { gegen ${zu} × }`);
}
if (!fehler) ok('CSS-Klammern ausgeglichen');

// ── 4 ─ keine doppelten Deklarationen auf oberster Ebene ──────────────────
const DEKL = /^(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/;
const wo = new Map();
for (const f of readdirSync('src/js').sort()) {
  const zeilen = readFileSync(`src/js/${f}`, 'utf8').split('\n');
  zeilen.forEach((z, i) => {
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

process.exit(fehler ? 1 : 0);
