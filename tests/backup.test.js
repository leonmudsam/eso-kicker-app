// Backup/Export/Import-Verifikation IM ECHTEN BROWSER (Chromium via Playwright).
// Nötig, weil DOMParser, DecompressionStream, Blob und TextEncoder gebraucht
// werden — die gibt es in Node so nicht bzw. nicht identisch.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const chromium = require('./browser.js').ladeChromium();
if(!chromium){
  console.log('ÜBERSPRUNGEN — kein Chromium verfügbar.');
  console.log('  Die Backup-Suite prüft eine ZIP-Datei, die der Browser erzeugt.');
  console.log('  Lokal: npm install --no-save playwright-core');
  process.exit(2);
}

const DIR = __dirname;
const realMatches = JSON.parse(fs.readFileSync(DIR + '/fixtures/matches.json', 'utf8'));
const html = fs.readFileSync(require('./ziel.js'), 'utf8');
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
let m, blocks = [];
while ((m = re.exec(html))) blocks.push(m[1]);
blocks.sort((a, b) => b.length - a.length);
let code = blocks[0].replace(/loadAll\(\);\s*\ncheckForUpdate\(\);/, '/*t*/');
const lc = code.lastIndexOf('})();');
code = code.slice(0, lc) + '\nwindow.__k = {eval: c => eval(c)};\n' + code.slice(lc);

const PLAYERS = [
 {id:"b96ef8d7-d4bc-4878-bb99-35a586bcea8c",name:"Leon",hidden:false,elo:415,atk:0.6,avatar_id:"a1",created_at:"2026-05-01T00:00:00Z"},
 {id:"296cd2ec-f013-4694-8e86-e90f1c8c2caf",name:"Julian",hidden:false,elo:411,atk:0.5,avatar_id:null,created_at:"2026-05-01T00:00:00Z"},
 {id:"ab20b1c8-40d8-4d05-9f79-24426ae3e6ef",name:"Martin",hidden:false,elo:344,atk:0.4,avatar_id:null,created_at:"2026-05-01T00:00:00Z"},
 {id:"c8d926c7-480d-4673-a7ae-310a186d390c",name:"Leo",hidden:false,elo:230,atk:0.5,avatar_id:null,created_at:"2026-05-01T00:00:00Z"},
 {id:"d01fd2af-ce1e-4595-8c4b-e524bd01a46a",name:"Maxi",hidden:false,elo:217,atk:0.5,avatar_id:null,created_at:"2026-05-01T00:00:00Z"},
 {id:"2be90a36-4634-4c2b-893c-ced7f83df1b2",name:"Johannes",hidden:false,elo:166,atk:0.5,avatar_id:null,created_at:"2026-05-01T00:00:00Z"},
 {id:"5bfb685d-8dbc-42f5-b07b-cdffbd1dfb1b",name:"Jannik",hidden:false,elo:162,atk:0.5,avatar_id:null,created_at:"2026-05-01T00:00:00Z"},
 {id:"6b048252-b694-45ee-b10a-a0b8b549e709",name:"Jane",hidden:false,elo:111,atk:0.5,avatar_id:null,created_at:"2026-05-01T00:00:00Z"},
 {id:"e175ba7c-caed-4a05-b4be-c40ef432df6b",name:"Stefan",hidden:false,elo:85,atk:0.5,avatar_id:null,created_at:"2026-05-01T00:00:00Z"},
 {id:"61dcf039-dd10-4622-82e7-46b2c3eabfd0",name:"Henry",hidden:false,elo:84,atk:0.5,avatar_id:null,created_at:"2026-05-01T00:00:00Z"},
 {id:"69638f55-5c25-4f63-9b73-52011bd5db02",name:"Anton",hidden:true,elo:0,atk:0.5,avatar_id:null,created_at:"2026-05-01T00:00:00Z"},
 {id:"96374328-c22b-4dae-a257-a5467b2f9594",name:"Alex; \"Sonder\" & <Zeichen>",hidden:false,elo:-108,atk:0.5,avatar_id:null,created_at:"2026-05-01T00:00:00Z"}];
const SEASONS = [
 {id:"2026-06",label:"Juni 2026",start_date:"2026-05-31",end_date:"2026-06-30",player_id:PLAYERS[0].id,team_p1:PLAYERS[0].id,team_p2:PLAYERS[1].id,top_elo:[{id:PLAYERS[0].id,elo:400}]},
 {id:"2026-05",label:"Mai 2026",start_date:"2026-04-30",end_date:"2026-05-31",player_id:PLAYERS[0].id,team_p1:null,team_p2:null,top_elo:[]}];

const BOOT = `
window.__D = ${JSON.stringify({players: PLAYERS, matches: realMatches, seasons: SEASONS})};
(function(){
  const stub = () => new Proxy(function(){}, {get(_,p){return p==='then'?undefined:stub()}, apply(){return stub()}});
  window.supabase = {createClient: () => ({from: () => stub(), channel: () => stub(), removeChannel(){}, rpc: () => stub()})};
  window.fetch = () => new Promise(()=>{});
  window.__origSetInterval = window.setInterval;
  window.setInterval = () => 0;
})();
`;

let fails = 0;
const ok = (c, msg) => { console.log((c ? '  ok  ' : '  FAIL') + '  ' + msg); if (!c) fails++; };

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.stack || e)));
  // Echtes Markup der App verwenden — die Boot-Routine fasst viele Elemente an.
  // Der Rumpf beginnt beim ERSTEN '<body' NACH dem Kopf: davor steht es im
  // Doku-Banner, danach in einer JS-Zeichenkette und in Kommentaren. Die
  // letzte Fundstelle zu nehmen ging so lange gut, bis ein Kommentar im Code
  // das Wort erwähnte — dann war der Ausschnitt leer, #app fehlte, und die
  // Suite starb an einer Zeile, die mit Backup nichts zu tun hat.
  const rumpfStart = html.indexOf('<body', html.indexOf('</head>'));
  const bodyHtml = html.slice(rumpfStart, html.indexOf('<script', rumpfStart))
    .replace(/<script[\s\S]*?<\/script>/gi, '');
  await page.setContent('<!doctype html><html>' + bodyHtml + '</body></html>');
  await page.addScriptTag({content: BOOT});
  await page.addScriptTag({content: code});
  ok(errors.length === 0, 'Skript lädt ohne Fehler' + (errors.length ? ' → ' + errors[0] : ''));

  const K = async src => page.evaluate(s => window.__k.eval(s), src);
  await K('players = __D.players; matches = __D.matches; seasons = __D.seasons; invalidateCache();');

  console.log('\n1) Export-Tabellen');
  const mrows = await K('_backupMatchRows()');
  ok(mrows.length === realMatches.length + 1, `Matches-Blatt: ${mrows.length - 1} Datenzeilen (erwartet ${realMatches.length})`);
  ok(mrows[0][0] === 'Match-ID' && mrows[0].length === 20, 'Kopfzeile mit 20 Spalten');
  const prows = await K('_backupPlayerRows()');
  const srows = await K('_backupSeasonRows()');
  ok(prows.length === PLAYERS.length + 1 && srows.length === SEASONS.length + 1,
     `Spieler-Blatt ${prows.length - 1}, Saisons-Blatt ${srows.length - 1}`);
  ok(mrows[1][4] === 'Sturm' || mrows[1][4] === 'Abwehr', 'Positionen lesbar: ' + mrows[1][4]);

  console.log('\n2) XLSX schreiben');
  const xlsxB64 = await K(`(async function(){
    const u8 = await _xlsxBuild([{name:'Matches',rows:_backupMatchRows()},{name:'Spieler',rows:_backupPlayerRows()},{name:'Saisons',rows:_backupSeasonRows()}]);
    let s=''; for(let i=0;i<u8.length;i++) s+=String.fromCharCode(u8[i]);
    return btoa(s);
  })()`);
  const xlsxBuf = Buffer.from(xlsxB64, 'base64');
  const outFile = path.join(DIR, 'roundtrip.xlsx');
  fs.writeFileSync(outFile, xlsxBuf);
  ok(xlsxBuf.length > 1000, `Datei erzeugt: ${(xlsxBuf.length/1024).toFixed(1)} KB`);
  ok(xlsxBuf.slice(0,2).toString() === 'PK', 'beginnt mit PK (ZIP-Signatur)');

  // Gegenprobe mit einem UNABHÄNGIGEN ZIP-Leser (Pythons zipfile), damit wir
  // nicht nur unseren eigenen Leser gegen unseren eigenen Schreiber testen.
  const { execFileSync } = require('child_process');
  // Unter Windows ist `python3` nur ein Store-Platzhalter, der beim Aufruf
  // abbricht — dann heisst der echte Interpreter `python`. Ohne diese Suche
  // faellt die Suite dort rot aus, obwohl am Code nichts falsch ist.
  const PY = (() => {
    for(const c of ['python3','python','py']){
      try { execFileSync(c, ['-c','import zipfile,zlib'], {stdio:'ignore'}); return c; } catch(e){ /* naechster */ }
    }
    return null;
  })();
  if(!PY){
    console.log('UEBERSPRUNGEN — kein Python fuer die ZIP-Gegenprobe gefunden.');
    process.exit(2);
  }
  const py = `
import zipfile, sys, json
z = zipfile.ZipFile(${JSON.stringify(outFile)})
bad = z.testzip()
names = z.namelist()
wb = z.read('xl/workbook.xml').decode()
sheet1 = z.read('xl/worksheets/sheet1.xml').decode()
print(json.dumps({'bad': bad, 'names': names, 'sheets': wb.count('<sheet '), 'rows': sheet1.count('<row ')}))
`;
  const pyOut = JSON.parse(execFileSync(PY, ['-c', py]).toString());
  ok(pyOut.bad === null, 'CRC-Prüfung durch fremden ZIP-Leser bestanden');
  ok(pyOut.names.includes('xl/workbook.xml') && pyOut.names.includes('xl/worksheets/sheet3.xml'),
     'Paketstruktur vollständig (' + pyOut.names.length + ' Einträge)');
  ok(pyOut.sheets === 3, pyOut.sheets + ' Blätter in der Arbeitsmappe');
  ok(pyOut.rows === realMatches.length + 1, pyOut.rows + ' Zeilen im Matches-Blatt');

  // Härtester Test: eine echte Tabellenkalkulations-Bibliothek (openpyxl) muss
  // die Datei öffnen und dieselben Werte sehen wie wir.
  const pyXl = `
import openpyxl, json
wb = openpyxl.load_workbook(${JSON.stringify(outFile)}, read_only=True)
ws = wb['Matches']
rows = list(ws.iter_rows(values_only=True))
sp = wb['Spieler']
srows = list(sp.iter_rows(values_only=True))
print(json.dumps({
  'sheets': wb.sheetnames,
  'n': len(rows),
  'header': [str(c) if c is not None else '' for c in rows[0]],
  'first': [str(c) if c is not None else '' for c in rows[1]],
  'last':  [str(c) if c is not None else '' for c in rows[-1]],
  'sonder': [str(r[1]) for r in srows[1:] if r[1] and 'Sonder' in str(r[1])],
}))
`;
  const xl = JSON.parse(execFileSync(PY, ['-c', pyXl]).toString());
  ok(xl.sheets.join(',') === 'Matches,Spieler,Saisons', 'openpyxl sieht die Blätter: ' + xl.sheets.join(', '));
  ok(xl.n === realMatches.length + 1, 'openpyxl liest ' + (xl.n - 1) + ' Datenzeilen');
  ok(JSON.stringify(xl.header) === JSON.stringify(mrows[0].map(String)), 'openpyxl: Kopfzeile identisch');
  ok(xl.first[0] === realMatches[0].id && xl.last[0] === realMatches[realMatches.length-1].id,
     'openpyxl: erste und letzte Match-ID identisch');
  ok(xl.sonder.length === 1 && xl.sonder[0].includes('"Sonder"'),
     'openpyxl: Sonderzeichen im Namen korrekt (' + (xl.sonder[0] || '—') + ')');

  console.log('\n3) XLSX zurücklesen (eigener Leser, unkomprimiert)');
  const parsed = await page.evaluate(async b64 => {
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const sheets = await window.__k.eval('_xlsxParse')(u8.buffer);
    return {names: Object.keys(sheets), matches: sheets['Matches'].length, first: sheets['Matches'][1], header: sheets['Matches'][0]};
  }, xlsxB64);
  ok(parsed.names.join(',') === 'Matches,Spieler,Saisons', 'Blattnamen: ' + parsed.names.join(', '));
  ok(parsed.matches === realMatches.length + 1, parsed.matches - 1 + ' Datenzeilen zurückgelesen');
  ok(JSON.stringify(parsed.header) === JSON.stringify(mrows[0]), 'Kopfzeile identisch');
  ok(parsed.first[0] === realMatches[0].id, 'erste Match-ID identisch');

  console.log('\n4) XLSX zurücklesen (von Excel neu gepackt = deflate)');
  // Wir packen dieselben Teile mit DEFLATE neu — genau das, was Excel beim
  // Speichern macht. Unser Leser muss das über DecompressionStream schaffen.
  const pyDeflate = `
import zipfile, base64, io
src = zipfile.ZipFile(${JSON.stringify(outFile)})
buf = io.BytesIO()
out = zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED)
for n in src.namelist():
    out.writestr(n, src.read(n))
out.close()
print(base64.b64encode(buf.getvalue()).decode())
`;
  const deflB64 = execFileSync(PY, ['-c', pyDeflate]).toString().trim();
  const deflParsed = await page.evaluate(async b64 => {
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    try {
      const sheets = await window.__k.eval('_xlsxParse')(u8.buffer);
      return {ok: true, names: Object.keys(sheets), rows: sheets['Matches'].length, first: sheets['Matches'][1]};
    } catch (e) { return {ok: false, err: e.message}; }
  }, deflB64);
  ok(deflParsed.ok, 'komprimierte Datei lesbar' + (deflParsed.ok ? '' : ' → ' + deflParsed.err));
  if (deflParsed.ok) {
    ok(deflParsed.rows === realMatches.length + 1, deflParsed.rows - 1 + ' Datenzeilen aus der komprimierten Datei');
    ok(deflParsed.first[0] === realMatches[0].id, 'erste Match-ID identisch');
  }

  console.log('\n5) Round-Trip: Export → Import ergibt dieselben Matches');
  const rt = await page.evaluate(async b64 => {
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const sheets = await window.__k.eval('_xlsxParse')(u8.buffer);
    // So tun, als wäre die Datenbank leer → alle Zeilen müssen als "neu" gelten.
    const orig = window.__k.eval('matches');
    window.__k.eval('matches = []; invalidateCache();');
    window.__RT = sheets['Matches'];
    const res = window.__k.eval('_analyseMatchRows(window.__RT, {})');
    window.__k.eval('matches = __D.matches; invalidateCache();');
    return {
      neu: res.neu.length, vorhanden: res.vorhanden,
      fehler: res.fehler.slice(0, 5), fehlerN: res.fehler.length,
      fehlendeSpieler: res.fehlendeSpieler,
      rows: res.neu.map(x => x.row)
    };
  }, xlsxB64);
  ok(rt.fehlerN === 0, `keine Zeile abgelehnt${rt.fehlerN ? ' → ' + JSON.stringify(rt.fehler) : ''}`);
  ok(rt.neu === realMatches.length, `${rt.neu} von ${realMatches.length} Matches erkannt`);
  ok(rt.fehlendeSpieler.length === 0, 'alle Spieler aufgelöst');

  // Feldweiser Vergleich gegen das Original
  const FIELDS = ['id','a1','a1_pos','a2','a2_pos','b1','b1_pos','b2','b2_pos','score_a','score_b','winner'];
  let diff = null, deltaDiff = 0, dateDiff = 0;
  for (let i = 0; i < realMatches.length && !diff; i++) {
    const o = realMatches[i], n = rt.rows[i];
    for (const f of FIELDS) {
      if (String(o[f]) !== String(n[f])) { diff = `${f}: "${o[f]}" != "${n[f]}" (Zeile ${i+1})`; break; }
    }
    if (JSON.stringify(o.deltas || {}) !== JSON.stringify(n.deltas || {})) deltaDiff++;
    if (new Date(o.created_at).getTime() !== new Date(n.created_at).getTime()) dateDiff++;
  }
  ok(!diff, 'alle Pflichtfelder identisch' + (diff ? ' → ' + diff : ''));
  ok(deltaDiff === 0, `Elo-Deltas verlustfrei (${deltaDiff} Abweichungen)`);
  ok(dateDiff === 0, `Zeitstempel verlustfrei (${dateDiff} Abweichungen)`);

  console.log('\n6) Vorhandene Matches werden erkannt, nicht doppelt eingefügt');
  const dup = await page.evaluate(async b64 => {
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const sheets = await window.__k.eval('_xlsxParse')(u8.buffer);
    window.__RT = sheets['Matches'];
    const r = window.__k.eval('_analyseMatchRows(window.__RT, {})');
    return {neu: r.neu.length, vorhanden: r.vorhanden};
  }, xlsxB64);
  ok(dup.neu === 0 && dup.vorhanden === realMatches.length,
     `zweiter Import: ${dup.neu} neu, ${dup.vorhanden} bereits vorhanden`);

  console.log('\n7) CSV-Weg');
  const csvRt = await K(`(function(){
    const rows = _backupMatchRows();
    const text = _csvBuild(rows);
    const back = _csvParse(text);
    const orig = matches;
    matches = []; invalidateCache();
    const res = _analyseMatchRows(back, {});
    matches = orig; invalidateCache();
    return {zeilen: back.length, neu: res.neu.length, fehler: res.fehler.length,
            sonderzeichen: back.find(r => String(r[3]).indexOf('"Sonder"') >= 0 || String(r[5]).indexOf('"Sonder"') >= 0
              || String(r[7]).indexOf('"Sonder"') >= 0 || String(r[9]).indexOf('"Sonder"') >= 0) ? true : false,
            bom: text.charCodeAt(0) === 0xFEFF, sep: text.split('\\n')[0].indexOf(';') >= 0};
  })()`);
  ok(csvRt.bom && csvRt.sep, 'CSV mit BOM und Semikolon (deutsches Excel)');
  ok(csvRt.zeilen === realMatches.length + 1, csvRt.zeilen - 1 + ' Datenzeilen');
  ok(csvRt.neu === realMatches.length && csvRt.fehler === 0, `CSV-Round-Trip: ${csvRt.neu} Matches, ${csvRt.fehler} Fehler`);
  ok(csvRt.sonderzeichen, 'Semikolon/Anführungszeichen im Spielernamen überstehen den Round-Trip');

  console.log('\n8) Fehlerhafte Zeilen werden sauber abgelehnt');
  const bad = await K(`(function(){
    const h = BACKUP_MATCH_HEADER;
    const good = _backupMatchRows()[1].slice();
    const mk = (mut) => { const r = good.slice(); mut(r); return r; };
    const iso = new Date().toISOString();
    const rows = [h,
      mk(r => { r[0] = 'neu-1'; r[11] = 5; r[12] = 5; r[1] = iso; }),          // Unentschieden
      mk(r => { r[0] = 'neu-2'; r[3] = 'Gibtsnicht'; r[16] = ''; r[1] = iso; }),// unbekannter Spieler
      mk(r => { r[0] = 'neu-3'; r[4] = 'Sturm'; r[6] = 'Sturm'; r[1] = iso; }), // zweimal Sturm im Team A
      mk(r => { r[0] = 'neu-4'; r[1] = 'kein datum'; }),                        // kaputtes Datum
      mk(r => { r[0] = 'neu-5'; r[18] = r[16]; r[7] = r[3]; r[1] = iso; }),     // Spieler doppelt
      mk(r => { r[0] = 'neu-6'; r[11] = ''; r[1] = iso; })                      // Tore fehlen
    ];
    const orig = matches; matches = []; invalidateCache();
    const res = _analyseMatchRows(rows, {});
    matches = orig; invalidateCache();
    return {neu: res.neu.length, fehler: res.fehler.map(f => f.zeile + ': ' + f.grund)};
  })()`);
  ok(bad.neu === 0, bad.neu + ' fehlerhafte Zeilen durchgelassen (erwartet 0)');
  ok(bad.fehler.length === 6, bad.fehler.length + ' von 6 Zeilen mit Begründung abgelehnt');
  bad.fehler.forEach(f => console.log('        ' + f));

  console.log('\n9) Sieger folgt immer den Toren');
  const win = await K(`(function(){
    const h = BACKUP_MATCH_HEADER;
    const good = _backupMatchRows()[1].slice();
    good[0] = 'win-1'; good[11] = 3; good[12] = 9; good[13] = 'A'; // widersprüchlich
    good[1] = new Date().toISOString();
    const orig = matches; matches = []; invalidateCache();
    const res = _analyseMatchRows([h, good], {});
    matches = orig; invalidateCache();
    return res.neu.length ? res.neu[0].row.winner : null;
  })()`);
  ok(win === 'B', 'widersprüchlicher Sieger korrigiert auf ' + win + ' (3:9)');

  console.log('\n10) Savepoint');
  const sp = await K(`(function(){ const s = _buildSavepoint(); return {kind:s.kind, schema:s.schema, p:s.players.length, m:s.matches.length, se:s.seasons.length, hasCfg: !!s.config, counts:s.counts}; })()`);
  ok(sp.kind === 'savepoint' && sp.schema === 1, 'Kopfdaten korrekt');
  ok(sp.p === PLAYERS.length && sp.m === realMatches.length && sp.se === SEASONS.length && sp.hasCfg,
     `enthält ${sp.p} Spieler, ${sp.m} Matches, ${sp.se} Saisons, Konfiguration`);
  const spSize = await K('JSON.stringify(_buildSavepoint()).length');
  console.log('        Savepoint-Größe:', (spSize/1024).toFixed(0), 'KB');

  console.log('\n11) Einstellungs-Karte + Handler');
  const ui = await K(`(function(){ period='season'; tab='settings'; const h = vSettings();
    return {xlsx:h.includes('id="expXlsxBtn"'), csv:h.includes('id="expCsvBtn"'),
            save:h.includes('id="expSaveBtn"'), imp:h.includes('id="impBackupBtn"'), len:h.length}; })()`);
  ok(ui.xlsx && ui.csv && ui.save && ui.imp, 'alle vier Buttons in den Einstellungen');
  const fns = await K(`['exportMatchesXlsx','exportMatchesCsv','exportSavepoint','startBackupImport','_saveFile','_pickFile','_xlsxBuild','_xlsxParse','_zipBuild','_zipRead','_csvBuild','_csvParse','_analyseMatchRows','_buildSavepoint','_showImportPreview','_applyBackupImport','_insertMatchChunks'].filter(n => typeof eval(n) !== 'function')`);
  ok(fns.length === 0, 'alle Backup-Funktionen definiert' + (fns.length ? ' → fehlt: ' + fns.join(', ') : ''));

  console.log('\n12) Import-Vorschau rendert');
  const prev = await page.evaluate(async b64 => {
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    const sheets = await window.__k.eval('_xlsxParse')(u8.buffer);
    window.__RT = sheets['Matches'];
    window.__k.eval(`
      matches = []; invalidateCache();
      _pendingImport = {kind:'table', analyse:_analyseMatchRows(window.__RT,{}), neueSpieler:[], rawMatchRows:window.__RT};
      _showImportPreview('test.xlsx');
      matches = __D.matches; invalidateCache();
    `);
    const s = document.getElementById('sheet');
    return {html: s.innerHTML, hasApply: !!document.getElementById('impApply'), hasCancel: !!document.getElementById('impCancel')};
  }, xlsxB64);
  ok(prev.hasApply && prev.hasCancel, 'Vorschau mit Bestätigen- und Abbrechen-Button');
  ok(/Neue Matches/.test(prev.html) && /Es wird nichts gelöscht/.test(prev.html), 'Vorschau nennt Anzahl und Sicherheitshinweis');

  console.log('\n13) Keine Laufzeitfehler insgesamt');
  ok(errors.length === 0, errors.length ? errors.join(' | ') : 'sauber');

  await browser.close();
  fs.unlinkSync(outFile);
  console.log('\n' + (fails ? 'FEHLER: ' + fails : 'ALLE CHECKS BESTANDEN'));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('ABBRUCH:', e); process.exit(1); });
