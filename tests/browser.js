// Chromium für die Suiten, die einen echten Browser brauchen (Backup/Export
// erzeugt eine ZIP-Datei im Browser — das lässt sich in Node nicht ehrlich
// nachstellen). Auf dem CI-Runner ist weder Playwright noch ein Browser da.
// Statt dort zu scheitern ODER stillschweigend durchzuwinken meldet der
// Helfer `null`; die Suite steigt dann mit Code 2 aus und run.mjs führt sie
// als ÜBERSPRUNGEN — sichtbar, aber nicht rot.
const { execSync } = require('child_process');

function ladeChromium(){
  const versuche = [
    () => require('playwright-core'),
    () => require('playwright'),
    () => require(execSync('npm root -g', {stdio:['ignore','pipe','ignore']})
      .toString().trim() + '/playwright'),
  ];
  for(const v of versuche){
    try { const m = v(); if(m && m.chromium) return m.chromium; } catch(e){ /* nächster */ }
  }
  return null;
}

module.exports = { ladeChromium };
