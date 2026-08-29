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
 *    node tools/build.mjs            → dist/index.html, Version unverändert
 *    BUILD_STAMP=2026.09.01.1 node … → dist/index.html mit neuer Version
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync } from 'node:fs';

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

const stamp = process.env.BUILD_STAMP;
if (stamp) {
  const re = /const BUILD_VERSION=['"][^'"]*['"]/;
  if (!re.test(html)) throw new Error('BUILD_VERSION nicht gefunden');
  html = html.replace(re, `const BUILD_VERSION='${stamp}'`);
}

mkdirSync('dist', { recursive: true });
writeFileSync('dist/index.html', html);
copyFileSync('icon.png', 'dist/icon.png');

const v = html.match(/const BUILD_VERSION=['"]([^'"]*)['"]/);
console.log(`dist/index.html — ${(html.length/1024).toFixed(0)} kB, Version ${v ? v[1] : '?'}`);
