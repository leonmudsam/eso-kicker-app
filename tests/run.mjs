#!/usr/bin/env node
/*
 *  Laesst alle tests/*.test.js gegen das gebaute dist/index.html laufen.
 *
 *    node tools/build.mjs && node tests/run.mjs
 *
 *  Jede Datei ist ein eigener Prozess: Die App ist eine IIFE mit globalem
 *  Zustand, zwei Suiten im selben Prozess wuerden sich gegenseitig die
 *  Caches umschreiben. Exit-Code 1, sobald eine Suite rot ist.
 *
 *  Zum Schluss wird die Tabelle in CLAUDE.md §5 nachgezaehlt. Die Zahl der
 *  Checks steht dort, damit man sieht, ob eine Suite gewachsen oder still
 *  geschrumpft ist — und eine Zahl, die niemand nachzaehlt, ist nach drei
 *  Aenderungen falsch. Welche Suiten es ueberhaupt gibt, prueft check.mjs.
 */
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const DIR  = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, '..');

if(!existsSync(join(ROOT, 'dist/index.html')) && !existsSync(join(ROOT, 'index.html'))){
  console.error('Nichts zu pruefen — vorher `node tools/build.mjs` laufen lassen.');
  process.exit(1);
}

const suiten = readdirSync(DIR).filter(f => f.endsWith('.test.js')).sort();
let rot = 0, grau = 0;
const zeilen = [];
// Name der Suite → Zahl der Checks, fuer den Abgleich mit CLAUDE.md §5.
const gezaehlt = new Map();

for(const f of suiten){
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [join(DIR, f)], { cwd: ROOT, encoding: 'utf8' });
  const ms = Date.now() - t0;
  const treffer = (r.stdout || '').match(/ALLE (\d+) CHECKS BESTANDEN|(\d+) von (\d+) CHECKS FEHLGESCHLAGEN/);
  // Code 2 = die Suite hat sich selbst übersprungen (z. B. kein Browser da).
  // Das ist weder grün noch rot: es steht sichtbar da, blockiert aber nicht.
  const uebersprungen = r.status === 2;
  const ok = r.status === 0;
  if(!ok && !uebersprungen) rot++;
  if(uebersprungen) grau++;
  const zahl = uebersprungen
    ? 'übersprungen'
    : (treffer ? (treffer[1] ? treffer[1] + ' Checks' : treffer[2] + '/' + treffer[3] + ' rot') : '');
  if(ok && treffer && treffer[1]) gezaehlt.set(f.replace('.test.js', ''), +treffer[1]);
  zeilen.push(`  ${ok ? '✓' : uebersprungen ? '–' : '✗'} ${f.replace('.test.js','').padEnd(14)} ${zahl.padEnd(14)} ${ms} ms`);
  if(uebersprungen){
    (r.stdout || '').split('\n').filter(l => l.trim()).slice(0, 3)
      .forEach(l => zeilen.push('      ' + l));
  }
  if(!ok && !uebersprungen){
    // Bei Rot die Fehlerzeilen zeigen, nicht die ganze Ausgabe.
    const raus = (r.stdout || '').split('\n').filter(l => /✗|FEHLGESCHLAGEN|ABBRUCH/.test(l));
    (raus.length ? raus : [(r.stderr || '').trim().split('\n').slice(0, 12).join('\n')])
      .forEach(l => zeilen.push('      ' + l));
  }
}

// ── Stimmt die Tabelle in CLAUDE.md? ────────────────────────────
// Nur wenn alles gelaufen ist: eine uebersprungene Suite nennt keine Zahl,
// und eine rote Suite hat gerade groessere Sorgen.
if(!rot && !grau){
  const anweisung = readFileSync(join(ROOT, 'CLAUDE.md'), 'utf8');
  const tabelle = anweisung.split('## 5. Die Testsuiten')[1] || '';
  const schief = [];
  for(const [name, zahl] of gezaehlt){
    const m = tabelle.match(new RegExp('^\\| `' + name + '` \\|[^\\n|]*\\|\\s*([\\d—-]+)\\s*\\|', 'm'));
    if(!m){ schief.push(`${name}: keine Zeile in §5`); continue; }
    if(m[1] !== String(zahl)) schief.push(`${name}: dort steht ${m[1]}, gelaufen sind ${zahl}`);
  }
  if(schief.length){
    zeilen.push('');
    schief.forEach(x => zeilen.push('  ✗ CLAUDE.md §5 — ' + x));
    rot++;
  }
}

console.log(zeilen.join('\n'));
const gelaufen = suiten.length - grau;
console.log(rot
  ? `\n${rot} von ${suiten.length} Suiten rot`
  : `\n${gelaufen} Suiten gruen` + (grau ? `, ${grau} uebersprungen` : ''));
process.exit(rot ? 1 : 0);
