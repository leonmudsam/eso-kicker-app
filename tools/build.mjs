#!/usr/bin/env node
/*
 *  Baut aus src/ die eine Datei, die ausgeliefert wird.
 *
 *  Kein Bundler, keine Module: die App ist eine einzige IIFE mit tausenden
 *  impliziten Bezügen zwischen ihren Teilen. Die Teile werden deshalb in
 *  alphabetischer Reihenfolge wieder aneinandergehängt — genau die
 *  Reihenfolge, in der sie vorher in index.html standen. Darum die
 *  Nummern-Präfixe der Dateinamen: sie SIND die Reihenfolge.
 *
 *    node tools/build.mjs            → dist/index.html
 *    BUILD_STAMP=2026.09.01.1 node … → dist/index.html mit fester Version
 *
 *  DIE VERSION IST EIN FINGERABDRUCK DES AUSGELIEFERTEN INHALTS, keine von
 *  Hand gepflegte Nummer. Von Hand gepflegt stand sie sechs Veröffentlichungen
 *  lang still, und `checkForUpdate` verglich die Version einer Seite mit sich
 *  selbst: auf jedem Gerät, das die App offen hatte, kam nie ein Hinweis auf
 *  eine neue Fassung. Der Fingerabdruck kann das nicht — er ändert sich genau
 *  dann, wenn sich die Auslieferung ändert.
 *
 *  Das Datum davor ist Lesbarkeit, nicht Inhalt: es kommt aus dem Tag, an dem
 *  sich der Inhalt zuletzt geändert hat. Bleibt der Fingerabdruck gleich,
 *  bleibt auch das Datum stehen — sonst bekäme ein Bauen ohne Änderung am
 *  nächsten Tag eine neue Nummer und alle Geräte ein Update, das keines ist.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync,
         existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

// Der Fingerabdruck zählt den Inhalt OHNE die Versionszeile — sonst hängt er
// von sich selbst ab. Dieselbe Normalisierung benutzt Wächter 1.
const OHNE_VERSION = /const BUILD_VERSION=['"][^'"]*['"]/;
const fingerabdruck = t => createHash('sha256')
  .update(t.replace(OHNE_VERSION, "const BUILD_VERSION='x'"))
  .digest('hex').slice(0, 8);

const join = dir => readdirSync(`src/${dir}`)
  .filter(f => !f.startsWith('.'))
  .sort()
  .map(f => {
    const s = readFileSync(`src/${dir}/${f}`, 'utf8');
    return s.endsWith('\n') ? s : s + '\n';   // fehlende Schlusszeile verklebt sonst zwei Dateien
  })
  .join('');

let html = readFileSync('src/index.html', 'utf8')
  .replace(/\/\*@@CSS\*\/\r?\n/, () => join('css'))
  .replace(/\/\*@@JS\*\/\r?\n/,  () => join('js'));

if (html.includes('/*@@')) throw new Error('Platzhalter in src/index.html nicht ersetzt');

if (!OHNE_VERSION.test(html)) throw new Error('BUILD_VERSION nicht gefunden');
const fp = fingerabdruck(html);
let version = process.env.BUILD_STAMP;
if (!version) {
  // Trägt die letzte Auslieferung denselben Inhalt, behält sie ihre Nummer.
  const alt = existsSync('index.html') ? readFileSync('index.html', 'utf8') : '';
  const alteV = (alt.match(/const BUILD_VERSION=['"]([^'"]*)['"]/) || [])[1];
  // Geprüft wird, ob die alte Nummer DIESEN Inhalt behauptet — nicht, ob der
  // Inhalt derselbe ist. Sonst hätte eine von Hand vergebene Nummer den
  // Fingerabdruck überlebt, und sie ist genau das, was ersetzt werden soll.
  version = (alteV && alteV.endsWith('.' + fp))
    ? alteV
    : new Date().toISOString().slice(0, 10).replace(/-/g, '.') + '.' + fp;
}
html = html.replace(OHNE_VERSION, `const BUILD_VERSION='${version}'`);

mkdirSync('dist', { recursive: true });
writeFileSync('dist/index.html', html);
copyFileSync('icon.png', 'dist/icon.png');

console.log(`dist/index.html — ${(html.length/1024).toFixed(0)} kB, Version ${version}`);
