// Welche Datei geprueft wird. Immer das GEBAUTE Ergebnis, nicht die Quelle:
// nur so faellt auch ein Fehler auf, der erst beim Zusammensetzen entsteht.
// KICKER_HTML=... setzt eine andere Datei, etwa fuer einen Vergleichslauf.
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const ziel = [process.env.KICKER_HTML, path.join(ROOT, 'dist/index.html'), path.join(ROOT, 'index.html')]
  .filter(Boolean).find(f => fs.existsSync(f));
if(!ziel) throw new Error('Kein index.html gefunden — vorher `node tools/build.mjs` laufen lassen.');
module.exports = ziel;
