// ╔═══ §10.4 ─── BOOT (Initialisierung) ────────────────────────────────╗
// Im Hintergrund wird nicht geladen. `loadAll` holt ALLE Spieler, ALLE
// Partien, die Konfiguration und die Saisons — bei fünfhundert Partien ist
// das jedes Mal ein sechsstelliger Betrag an Bytes, und das alle dreißig
// Sekunden auch dann, wenn das Telefon in der Tasche steckt. Ein PWA-Symbol
// bleibt tagelang offen; das ist Mobilfunk und Akku für nichts.
// Dafür wird beim Zurückkommen SOFORT geholt: wer die App wieder ansieht,
// will den Stand von jetzt, nicht den in bis zu dreißig Sekunden.
// Dieselbe Regel befolgt der News-Autosync schon [§9.6].
function _tickDaten(){
  if(document.hidden) return;
  // Ein offenes Blatt und der Eingabe-Tab werden nicht unter den Fingern
  // neu gezeichnet — diese Bedingung stand schon immer im Takt.
  if(document.getElementById('sheet').classList.contains('show')) return;
  if(tab === 'match') return;
  loadAll();
}
function _tickVersion(){ if(!document.hidden) checkForUpdate(); }

loadAll();
checkForUpdate();
setInterval(_tickVersion, 5*60*1000);
setInterval(_tickDaten, 30000);
document.addEventListener('visibilitychange', () => {
  if(document.hidden) return;
  _tickDaten();
  _tickVersion();
});
})();
