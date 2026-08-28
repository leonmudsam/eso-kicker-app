// ╔═══ §12 ─── BACKUP, EXPORT & WIEDERHERSTELLUNG ──────────────────────╗
//     Matches als echte Excel-Datei (.xlsx) sichern, einen vollständigen
//     Savepoint (.json) herunterladen und beides wieder einspielen — damit
//     die Liga auch dann bestehen bleibt, wenn Supabase ausfällt oder ein
//     Projekt verloren geht.
// ╚═════════════════════════════════════════════════════════════════════════╝
//
// WARUM ZWEI FORMATE
//   • .xlsx  — zum Anschauen und Weitergeben. Öffnet in Excel, Numbers und
//              LibreOffice, enthält lesbare Namen UND die IDs, damit es
//              verlustfrei zurückgelesen werden kann.
//   • .json  — der eigentliche Savepoint. Enthält Spieler, Matches, Saisons
//              und die Formel-Konfiguration in exakt dem Format, in dem sie in
//              der Datenbank stehen. Das ist der Weg für „alles ist weg".
//
// KEINE FREMDBIBLIOTHEK
//   Die App ist eine einzelne HTML-Datei ohne externe Skripte. .xlsx ist ein
//   ZIP aus XML-Dateien, beides ist hier von Hand implementiert:
//     Schreiben → ZIP mit unkomprimierten Einträgen (Methode 0). Das sparen
//                 wir uns nicht aus Faulheit: es braucht keinen Deflate-
//                 Encoder, und Excel/Numbers/LibreOffice lesen es problemlos.
//     Lesen     → ZIP-Zentralverzeichnis parsen; komprimierte Einträge
//                 (Methode 8, so speichert Excel selbst) laufen durch
//                 DecompressionStream('deflate-raw'), das in Safari 16.4+ und
//                 allen aktuellen Browsern eingebaut ist. Fehlt es, greift der
//                 CSV-Weg.
//
// SICHERHEIT BEIM EINSPIELEN
//   Ein Import LÖSCHT NIE etwas. Es werden ausschließlich fehlende Zeilen
//   ergänzt. Vor dem Schreiben zeigt eine Vorschau, was passieren würde, und
//   erst ein bewusster Klick löst es aus.

// ─── §12.1 — Datei speichern (iOS-tauglich) ──────────────────────────
// Auf dem iPhone (und in der installierten PWA) ist ein <a download> unzu-
// verlässig: die Datei landet je nach Kontext im Nirwana oder wird nur
// angezeigt. Das Share-Sheet ist dort der verlässliche Weg — darüber kann man
// „In Dateien sichern", nach iCloud oder in eine Mail. Auf dem Desktop gibt es
// kein Share-Sheet für Dateien, dort greift der klassische Download.
async function _saveFile(blob, filename){
  try{
    if(navigator.canShare && typeof File === 'function'){
      const f = new File([blob], filename, {type: blob.type});
      if(navigator.canShare({files:[f]})){
        await navigator.share({files:[f], title: filename});
        return true;
      }
    }
  }catch(e){
    // Abbruch im Share-Sheet ist kein Fehler — dann einfach nichts tun.
    if(e && (e.name === 'AbortError' || e.name === 'NotAllowedError')) return false;
    // Alles andere: unten den Download-Fallback versuchen.
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 30000);
  return true;
}

// Datei-Auswahl öffnen und Inhalt liefern. accept z.B. '.xlsx,.csv'.
function _pickFile(accept){
  return new Promise(resolve => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = accept || '';
    inp.style.position = 'fixed';
    inp.style.left = '-9999px';
    document.body.appendChild(inp);
    inp.onchange = () => { const f = inp.files && inp.files[0]; inp.remove(); resolve(f || null); };
    // Bricht der Nutzer ab, feuert onchange nie — der Input bleibt liegen und
    // das Promise offen. Das ist unkritisch (kein Timer, keine Sperre), der
    // nächste Versuch legt einfach einen neuen an.
    inp.click();
  });
}

// ─── §12.2 — ZIP (schreiben & lesen), ohne Bibliothek ────────────────
let _crcTable = null;
function _crc32(buf){
  if(!_crcTable){
    _crcTable = new Uint32Array(256);
    for(let n = 0; n < 256; n++){
      let c = n;
      for(let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      _crcTable[n] = c >>> 0;
    }
  }
  let c = 0xFFFFFFFF;
  for(let i = 0; i < buf.length; i++) c = _crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// files: [{name, data:Uint8Array}] → Uint8Array eines ZIP-Archivs.
// Komprimiert wird mit CompressionStream('deflate-raw'), wenn der Browser es
// kann — bei einer Liga mit ein paar hundert Matches sind das aus 600 KB rund
// 60 KB, und auf dem Handy zählt jedes MB. Fehlt CompressionStream (oder wird
// eine Datei durch Deflate nicht kleiner), landet der Eintrag unkomprimiert im
// Archiv. Beides ist gültiges ZIP, Excel liest je Eintrag das, was drinsteht.
async function _zipBuild(files){
  const enc = new TextEncoder();
  const parts = [];        // Reihenfolge der Rohdaten
  const central = [];
  let offset = 0;
  const canDeflate = (typeof CompressionStream === 'function');
  for(const f of files){
    const nameBytes = enc.encode(f.name);
    const crc = _crc32(f.data);   // CRC gilt IMMER für die unkomprimierten Daten
    const size = f.data.length;
    let payload = f.data, method = 0;
    if(canDeflate && size > 256){
      try{
        const cs = new CompressionStream('deflate-raw');
        const buf = await new Response(new Blob([f.data]).stream().pipeThrough(cs)).arrayBuffer();
        const packed = new Uint8Array(buf);
        if(packed.length < size){ payload = packed; method = 8; }
      }catch(e){ /* unkomprimiert weiter */ }
    }
    const compSize = payload.length;
    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true); // Signatur lokaler Header
    lv.setUint16(4, 20, true);         // benötigte Version 2.0
    lv.setUint16(6, 0, true);          // Flags
    lv.setUint16(8, method, true);     // 0 = gespeichert, 8 = deflate
    lv.setUint16(10, 0, true);         // Uhrzeit
    lv.setUint16(12, 0x21, true);      // Datum (1980-01-01, ohne Bedeutung)
    lv.setUint32(14, crc, true);
    lv.setUint32(18, compSize, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);         // Extra-Feld-Länge
    local.set(nameBytes, 30);
    parts.push(local, payload);

    const cen = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true); // Signatur Zentralverzeichnis
    cv.setUint16(4, 20, true);         // erzeugende Version
    cv.setUint16(6, 20, true);         // benötigte Version
    cv.setUint16(8, 0, true);
    cv.setUint16(10, method, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x21, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, compSize, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint16(30, 0, true);         // Extra
    cv.setUint16(32, 0, true);         // Kommentar
    cv.setUint16(34, 0, true);         // Startdiskette
    cv.setUint16(36, 0, true);         // interne Attribute
    cv.setUint32(38, 0, true);         // externe Attribute
    cv.setUint32(42, offset, true);    // Offset des lokalen Headers
    cen.set(nameBytes, 46);
    central.push(cen);
    offset += local.length + compSize;
  }
  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(4, 0, true);
  ev.setUint16(6, 0, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  ev.setUint16(20, 0, true);
  const all = [...parts, ...central, eocd];
  const total = all.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for(const p of all){ out.set(p, o); o += p.length; }
  return out;
}

// ZIP lesen → Map(name → Uint8Array). Unterstützt gespeicherte (0) und
// deflate-komprimierte (8) Einträge; letztere über DecompressionStream.
async function _zipRead(buffer){
  const u8 = new Uint8Array(buffer);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  // EOCD von hinten suchen (max. 64 KB Kommentar).
  let eocd = -1;
  const minPos = Math.max(0, u8.length - 65557);
  for(let i = u8.length - 22; i >= minPos; i--){
    if(dv.getUint32(i, true) === 0x06054b50){ eocd = i; break; }
  }
  if(eocd < 0) throw new Error('Keine gültige ZIP-/Excel-Datei.');
  const count = dv.getUint16(eocd + 10, true);
  let ptr = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out = new Map();
  for(let n = 0; n < count; n++){
    if(dv.getUint32(ptr, true) !== 0x02014b50) throw new Error('ZIP-Verzeichnis beschädigt.');
    const method   = dv.getUint16(ptr + 10, true);
    const compSize = dv.getUint32(ptr + 20, true);
    const nameLen  = dv.getUint16(ptr + 28, true);
    const extraLen = dv.getUint16(ptr + 30, true);
    const cmtLen   = dv.getUint16(ptr + 32, true);
    const localOff = dv.getUint32(ptr + 42, true);
    const name = dec.decode(u8.subarray(ptr + 46, ptr + 46 + nameLen));
    // Datenbeginn steht im LOKALEN Header — dessen Extra-Feld kann von dem im
    // Zentralverzeichnis abweichen, deshalb dort neu auslesen.
    const lNameLen  = dv.getUint16(localOff + 26, true);
    const lExtraLen = dv.getUint16(localOff + 28, true);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const raw = u8.subarray(dataStart, dataStart + compSize);
    if(method === 0){
      out.set(name, raw.slice());
    } else if(method === 8){
      if(typeof DecompressionStream !== 'function'){
        throw new Error('Diese Excel-Datei ist komprimiert und der Browser kann sie nicht entpacken. Bitte als CSV exportieren und die CSV hochladen.');
      }
      const ds = new DecompressionStream('deflate-raw');
      const stream = new Blob([raw]).stream().pipeThrough(ds);
      const buf = await new Response(stream).arrayBuffer();
      out.set(name, new Uint8Array(buf));
    } else {
      throw new Error('Unbekanntes Kompressionsverfahren in der Datei (' + method + ').');
    }
    ptr += 46 + nameLen + extraLen + cmtLen;
  }
  return out;
}

// ─── §12.3 — XLSX schreiben ──────────────────────────────────────────
function _xesc(v){
  return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]))
                  // Steuerzeichen sind in XML 1.0 nicht erlaubt und würden die
                  // Datei für Excel unlesbar machen.
                  .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
}
// Spaltenindex (0-basiert) → Excel-Buchstaben (A, B, … Z, AA, …)
function _xcol(i){
  let s = '';
  i += 1;
  while(i > 0){ const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); }
  return s;
}
// Excel-Blattnamen: max. 31 Zeichen, ohne : \ / ? * [ ]
function _xsheetName(n){ return String(n).replace(/[\\\/\?\*\[\]:]/g, '-').slice(0, 31) || 'Blatt'; }

// sheets: [{name, rows: [[zelle, …], …]}] → Uint8Array (.xlsx)
// Strings werden als inlineStr geschrieben; das spart die sharedStrings-Tabelle
// und bleibt für jeden Reader eindeutig.
async function _xlsxBuild(sheets){
  const enc = new TextEncoder();
  const sheetXml = rows => {
    const body = rows.map((row, r) => {
      const st = r === 0 ? ' s="1"' : ''; // Kopfzeile fett hervorheben
      const cells = row.map((val, c) => {
        const ref = _xcol(c) + (r + 1);
        if(val === null || val === undefined || val === '') return '';
        if(typeof val === 'number' && isFinite(val)) return `<c r="${ref}"${st}><v>${val}</v></c>`;
        return `<c r="${ref}"${st} t="inlineStr"><is><t xml:space="preserve">${_xesc(val)}</t></is></c>`;
      }).join('');
      return `<row r="${r + 1}">${cells}</row>`;
    }).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
  };
  const files = [];
  const push = (name, text) => files.push({name, data: enc.encode(text)});

  push('[Content_Types].xml',
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('\n')}
</Types>`);

  push('_rels/.rels',
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);

  push('xl/workbook.xml',
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>
${sheets.map((s, i) => `<sheet name="${_xesc(_xsheetName(s.name))}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('\n')}
</sheets></workbook>`);

  push('xl/_rels/workbook.xml.rels',
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets.map((_, i) => `<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('\n')}
<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);

  // Zwei Formate: 0 = normal, 1 = fette Kopfzeile mit grauem Hintergrund.
  // Der benannte Stil „Normal" muss drin sein, sonst meckern Excel und
  // openpyxl über eine Mappe ohne Standardformat.
  push('xl/styles.xml',
`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8ECEA"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);

  sheets.forEach((s, i) => push(`xl/worksheets/sheet${i+1}.xml`, sheetXml(s.rows)));
  return await _zipBuild(files);
}

// ─── §12.4 — XLSX lesen ──────────────────────────────────────────────
// Gibt {blattname: [[zelle, …], …]} zurück. Alle Werte kommen als String —
// die Fachlogik konvertiert selbst, das vermeidet Überraschungen bei IDs, die
// wie Zahlen aussehen.
async function _xlsxParse(buffer){
  const zip = await _zipRead(buffer);
  const dec = new TextDecoder();
  const xml = name => {
    const d = zip.get(name);
    if(!d) return null;
    const doc = new DOMParser().parseFromString(dec.decode(d), 'application/xml');
    if(doc.querySelector('parsererror')) throw new Error('Die Datei enthält beschädigtes XML.');
    return doc;
  };
  const wb = xml('xl/workbook.xml');
  if(!wb) throw new Error('Das ist keine Excel-Arbeitsmappe (xl/workbook.xml fehlt).');

  // rId → Ziel-Datei
  const relsDoc = xml('xl/_rels/workbook.xml.rels');
  const rels = {};
  if(relsDoc){
    for(const r of relsDoc.getElementsByTagName('Relationship')){
      let t = r.getAttribute('Target') || '';
      if(t.startsWith('/')) t = t.slice(1);
      else if(!t.startsWith('xl/')) t = 'xl/' + t.replace(/^\.\//, '');
      rels[r.getAttribute('Id')] = t;
    }
  }

  // sharedStrings (schreibt Excel beim Speichern selbst)
  const ssDoc = xml('xl/sharedStrings.xml');
  const shared = [];
  if(ssDoc){
    for(const si of ssDoc.getElementsByTagName('si')){
      // Ein <si> kann aus mehreren <t> bestehen (Rich Text) → zusammenfügen,
      // aber <rPh> (phonetische Hinweise) auslassen.
      let s = '';
      for(const t of si.getElementsByTagName('t')){
        if(t.parentNode && t.parentNode.nodeName === 'rPh') continue;
        s += t.textContent;
      }
      shared.push(s);
    }
  }

  const refCol = ref => {
    const m = /^([A-Z]+)/.exec(ref || '');
    if(!m) return -1;
    let n = 0;
    for(const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  };

  const out = {};
  const sheetEls = wb.getElementsByTagName('sheet');
  for(let i = 0; i < sheetEls.length; i++){
    const el = sheetEls[i];
    const name = el.getAttribute('name') || ('Blatt' + (i + 1));
    const rid = el.getAttribute('r:id') || el.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    const target = rels[rid] || ('xl/worksheets/sheet' + (i + 1) + '.xml');
    const doc = xml(target);
    if(!doc){ out[name] = []; continue; }
    const rows = [];
    for(const rowEl of doc.getElementsByTagName('row')){
      const row = [];
      for(const c of rowEl.getElementsByTagName('c')){
        const idx = refCol(c.getAttribute('r'));
        const type = c.getAttribute('t');
        let val = '';
        if(type === 'inlineStr'){
          const is = c.getElementsByTagName('is')[0];
          if(is) for(const t of is.getElementsByTagName('t')) val += t.textContent;
        } else {
          const v = c.getElementsByTagName('v')[0];
          const raw = v ? v.textContent : '';
          if(type === 's'){ val = shared[parseInt(raw, 10)] ?? ''; }
          else if(type === 'b'){ val = raw === '1' ? 'true' : 'false'; }
          else { val = raw; }
        }
        if(idx >= 0){ while(row.length < idx) row.push(''); row[idx] = val; }
        else row.push(val);
      }
      const r = parseInt(rowEl.getAttribute('r') || '0', 10);
      if(r > 0){ while(rows.length < r - 1) rows.push([]); rows[r - 1] = row; }
      else rows.push(row);
    }
    out[name] = rows;
  }
  return out;
}

// ─── §12.5 — CSV (schreiben & lesen) ─────────────────────────────────
// Trennzeichen ist Semikolon: deutsches Excel erwartet das, und Kommata
// kommen in Namen häufiger vor. Das BOM sorgt dafür, dass Excel die Datei als
// UTF-8 erkennt und Umlaute nicht zerschießt.
function _csvBuild(rows){
  const cell = v => {
    const s = (v === null || v === undefined) ? '' : String(v);
    return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  return '﻿' + rows.map(r => r.map(cell).join(';')).join('\r\n');
}
function _csvParse(text){
  if(text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  // Trennzeichen aus der Kopfzeile raten (Semikolon oder Komma).
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const sep = (firstLine.split(';').length >= firstLine.split(',').length) ? ';' : ',';
  const rows = [];
  let row = [], cur = '', q = false;
  for(let i = 0; i < text.length; i++){
    const ch = text[i];
    if(q){
      if(ch === '"'){
        if(text[i+1] === '"'){ cur += '"'; i++; }
        else q = false;
      } else cur += ch;
      continue;
    }
    if(ch === '"'){ q = true; continue; }
    if(ch === sep){ row.push(cur); cur = ''; continue; }
    if(ch === '\r'){ continue; }
    if(ch === '\n'){ row.push(cur); rows.push(row); row = []; cur = ''; continue; }
    cur += ch;
  }
  if(cur !== '' || row.length){ row.push(cur); rows.push(row); }
  return rows.filter(r => r.some(c => String(c).trim() !== ''));
}

// ─── §12.6 — Tabellen-Aufbau (Export-Format) ─────────────────────────
// Die Spaltenköpfe sind zugleich der Vertrag für den Import: gelesen wird nach
// KOPFNAME, nicht nach Position. Man darf also Spalten umsortieren oder reine
// Anzeigespalten löschen, solange die Pflichtspalten stehen bleiben.
const BACKUP_POS_LABEL = {atk:'Sturm', def:'Abwehr'};
// Beim Lesen akzeptieren wir beide Schreibweisen plus die Rohwerte.
function _backupPos(v){
  const s = String(v || '').trim().toLowerCase();
  if(s === 'atk' || s === 'sturm' || s === 'angriff' || s === 's') return 'atk';
  if(s === 'def' || s === 'abwehr' || s === 'verteidigung' || s === 'a') return 'def';
  return null;
}
const BACKUP_MATCH_HEADER = [
  'Match-ID','Datum (ISO)','Datum (lesbar)',
  'A1 Name','A1 Position','A2 Name','A2 Position',
  'B1 Name','B1 Position','B2 Name','B2 Position',
  'Tore A','Tore B','Sieger','Erwartung A','Elo-Deltas (JSON)',
  'A1 ID','A2 ID','B1 ID','B2 ID'
];
function _backupMatchRows(){
  const pm = pmap();
  const nm = id => (pm[id] && pm[id].name) || '';
  const rows = [BACKUP_MATCH_HEADER];
  // matches ist aufsteigend sortiert (loadAll) — genau die Reihenfolge, in der
  // man sie auch in der Tabelle erwartet.
  for(const m of matches){
    rows.push([
      m.id,
      m.created_at,
      new Date(m.created_at).toLocaleString('de-DE'),
      nm(m.a1), BACKUP_POS_LABEL[m.a1_pos] || m.a1_pos,
      nm(m.a2), BACKUP_POS_LABEL[m.a2_pos] || m.a2_pos,
      nm(m.b1), BACKUP_POS_LABEL[m.b1_pos] || m.b1_pos,
      nm(m.b2), BACKUP_POS_LABEL[m.b2_pos] || m.b2_pos,
      Number(m.score_a) || 0, Number(m.score_b) || 0,
      m.winner,
      m.exp_a == null ? '' : Number(m.exp_a),
      JSON.stringify(m.deltas || {}),
      m.a1, m.a2, m.b1, m.b2
    ]);
  }
  return rows;
}
function _backupPlayerRows(){
  const rows = [['Spieler-ID','Name','Elo','Angriffs-Wert','Avatar','Ausgeblendet','Erstellt']];
  for(const p of players){
    rows.push([p.id, p.name, Number(p.elo) || 0, Number(p.atk) || 0,
               p.avatar_id || '', p.hidden ? 'ja' : 'nein', p.created_at || '']);
  }
  return rows;
}
function _backupSeasonRows(){
  const pm = pmap();
  const rows = [['Saison-ID','Titel','Start','Ende','Champion','Champion-ID','Team-Spieler 1','Team-Spieler 2','Top-Elo (JSON)']];
  for(const s of seasons){
    rows.push([s.id, s.label || '', s.start_date || '', s.end_date || '',
               (pm[s.player_id] && pm[s.player_id].name) || '', s.player_id || '',
               s.team_p1 || '', s.team_p2 || '',
               JSON.stringify(s.top_elo || [])]);
  }
  return rows;
}

// Dateiname mit Datum — sortiert sich im Dateimanager von selbst.
function _backupStamp(){
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth()+1) + '-' + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes());
}

// ─── §12.7 — Export-Aktionen ─────────────────────────────────────────
async function exportMatchesXlsx(){
  if(!matches.length){ toast('Keine Matches zum Exportieren','info'); return; }
  try{
    const data = await _xlsxBuild([
      {name:'Matches', rows:_backupMatchRows()},
      {name:'Spieler', rows:_backupPlayerRows()},
      {name:'Saisons', rows:_backupSeasonRows()}
    ]);
    const blob = new Blob([data], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    await _saveFile(blob, 'kicker-liga_' + _backupStamp() + '.xlsx');
    toast(matches.length + ' Matches als Excel exportiert','ok');
  }catch(e){
    toast('Export fehlgeschlagen: ' + e.message, true);
  }
}
async function exportMatchesCsv(){
  if(!matches.length){ toast('Keine Matches zum Exportieren','info'); return; }
  try{
    const blob = new Blob([_csvBuild(_backupMatchRows())], {type:'text/csv;charset=utf-8'});
    await _saveFile(blob, 'kicker-matches_' + _backupStamp() + '.csv');
    toast(matches.length + ' Matches als CSV exportiert','ok');
  }catch(e){
    toast('Export fehlgeschlagen: ' + e.message, true);
  }
}
// Vollständiger Savepoint: exakt die Datenbank-Zeilen, damit ein Rückweg
// verlustfrei möglich ist (inklusive Elo-Deltas und Formel-Konfiguration).
function _buildSavepoint(){
  return {
    app: 'kicker-liga',
    kind: 'savepoint',
    schema: 1,
    build: BUILD_VERSION,
    createdAt: new Date().toISOString(),
    counts: {players: players.length, matches: matches.length, seasons: seasons.length},
    players, matches, seasons,
    config: cfg
  };
}
async function exportSavepoint(){
  try{
    const json = JSON.stringify(_buildSavepoint(), null, 1);
    const blob = new Blob([json], {type:'application/json'});
    await _saveFile(blob, 'kicker-savepoint_' + _backupStamp() + '.json');
    toast('Savepoint gesichert · ' + matches.length + ' Matches','ok');
  }catch(e){
    toast('Savepoint fehlgeschlagen: ' + e.message, true);
  }
}

// ─── §12.8 — Import: Datei einlesen und prüfen ───────────────────────
// Liefert {matchRows, playerRows, seasonRows, savepoint} — je nachdem, was in
// der Datei steckt. Wirft mit einer verständlichen Meldung, wenn nicht.
async function _readBackupFile(file){
  const lower = (file.name || '').toLowerCase();
  if(lower.endsWith('.json')){
    const sp = JSON.parse(await file.text());
    if(!sp || sp.kind !== 'savepoint' || !Array.isArray(sp.matches)){
      throw new Error('Die JSON-Datei ist kein Savepoint dieser App.');
    }
    return {savepoint: sp};
  }
  if(lower.endsWith('.csv')){
    return {matchRows: _csvParse(await file.text())};
  }
  if(lower.endsWith('.xlsx')){
    const sheets = await _xlsxParse(await file.arrayBuffer());
    const pick = re => { const k = Object.keys(sheets).find(n => re.test(n)); return k ? sheets[k] : null; };
    const matchRows = pick(/^match/i) || sheets[Object.keys(sheets)[0]];
    return {matchRows, playerRows: pick(/^spieler|^player/i), seasonRows: pick(/^saison|^season/i)};
  }
  throw new Error('Bitte eine .xlsx-, .csv- oder .json-Datei wählen.');
}

// Kopfzeile → {normalisierter Name: Spaltenindex}
function _headerIndex(headerRow){
  const idx = {};
  (headerRow || []).forEach((h, i) => {
    const key = String(h || '').trim().toLowerCase();
    if(key && !(key in idx)) idx[key] = i;
  });
  return idx;
}
// Erste passende Spalte aus mehreren Kandidaten.
function _col(row, idx, ...names){
  for(const n of names){
    const i = idx[n.toLowerCase()];
    if(i !== undefined && row[i] !== undefined) return String(row[i]).trim();
  }
  return '';
}

// Prüft die Zeilen und bereitet die einzufügenden Match-Objekte vor.
// Rückgabe: {neu:[row…], vorhanden:n, fehler:[{zeile, grund}], fehlendeSpieler:[name…]}
function _analyseMatchRows(rows, opts){
  opts = opts || {};
  const extraPlayers = opts.extraPlayers || {}; // name(lower) → id, für Savepoint-Restore
  const res = {neu: [], vorhanden: 0, fehler: [], fehlendeSpieler: new Set()};
  if(!rows || rows.length < 2){ res.fehler.push({zeile: 0, grund: 'Die Datei enthält keine Datenzeilen.'}); return res; }
  const idx = _headerIndex(rows[0]);
  if(idx['match-id'] === undefined && idx['tore a'] === undefined){
    res.fehler.push({zeile: 1, grund: 'Kopfzeile nicht erkannt — erwartet werden die Spalten aus dem Export.'});
    return res;
  }
  const pm = pmap();
  const haveIds = new Set(matches.map(m => m.id));
  const byName = {};
  for(const p of players) byName[String(p.name).trim().toLowerCase()] = p.id;
  const seenInFile = new Set();

  const resolve = (id, name) => {
    if(id && pm[id]) return id;
    const key = String(name || '').trim().toLowerCase();
    if(key && byName[key]) return byName[key];
    if(key && extraPlayers[key]) return extraPlayers[key];
    if(name) res.fehlendeSpieler.add(String(name).trim());
    return null;
  };

  for(let r = 1; r < rows.length; r++){
    const row = rows[r];
    const zeile = r + 1; // 1-basiert wie in Excel
    const id = _col(row, idx, 'Match-ID', 'id');
    if(id && haveIds.has(id)){ res.vorhanden++; continue; }
    if(id && seenInFile.has(id)){ res.fehler.push({zeile, grund: 'Match-ID kommt in der Datei doppelt vor.'}); continue; }

    const seats = [['a1','A1'],['a2','A2'],['b1','B1'],['b2','B2']];
    const pids = {}; let bad = null;
    for(const [key, label] of seats){
      const pid = resolve(_col(row, idx, label + ' ID'), _col(row, idx, label + ' Name', label));
      if(!pid){ bad = 'Spieler ' + label + ' nicht gefunden.'; break; }
      pids[key] = pid;
    }
    if(bad){ res.fehler.push({zeile, grund: bad}); continue; }
    if(new Set(Object.values(pids)).size !== 4){ res.fehler.push({zeile, grund: 'Ein Spieler steht mehrfach im selben Match.'}); continue; }

    const pos = {};
    for(const [key, label] of seats){
      const p = _backupPos(_col(row, idx, label + ' Position'));
      if(!p){ bad = 'Position für ' + label + ' fehlt oder ist unbekannt (Sturm/Abwehr).'; break; }
      pos[key] = p;
    }
    if(bad){ res.fehler.push({zeile, grund: bad}); continue; }
    if(pos.a1 === pos.a2 || pos.b1 === pos.b2){
      res.fehler.push({zeile, grund: 'Jedes Team braucht genau einmal Sturm und einmal Abwehr.'}); continue;
    }

    const sa = parseInt(_col(row, idx, 'Tore A', 'score_a'), 10);
    const sbv = parseInt(_col(row, idx, 'Tore B', 'score_b'), 10);
    if(!isFinite(sa) || !isFinite(sbv) || sa < 0 || sbv < 0){ res.fehler.push({zeile, grund: 'Tore fehlen oder sind keine Zahl.'}); continue; }
    if(sa === sbv){ res.fehler.push({zeile, grund: 'Unentschieden gibt es in dieser Liga nicht.'}); continue; }

    // Sieger wird aus den Toren abgeleitet — steht etwas anderes in der Datei,
    // gewinnen die Tore. Das verhindert widersprüchliche Zeilen in der DB.
    const winner = sa > sbv ? 'A' : 'B';

    const dateRaw = _col(row, idx, 'Datum (ISO)', 'Datum', 'created_at');
    let created = null;
    if(dateRaw){
      const t = new Date(dateRaw);
      if(!isNaN(t.getTime())) created = t.toISOString();
    }
    if(!created){ res.fehler.push({zeile, grund: 'Datum fehlt oder ist unlesbar (erwartet ISO wie 2026-07-30T11:49:22Z).'}); continue; }

    let deltas = {};
    const dRaw = _col(row, idx, 'Elo-Deltas (JSON)', 'deltas');
    if(dRaw){ try{ const d = JSON.parse(dRaw); if(d && typeof d === 'object') deltas = d; }catch(e){ /* leer lassen */ } }
    const expRaw = _col(row, idx, 'Erwartung A', 'exp_a');
    const expA = expRaw === '' ? 0.5 : parseFloat(String(expRaw).replace(',', '.'));

    if(id) seenInFile.add(id);
    res.neu.push({
      row: Object.assign(
        id ? {id} : {},
        {
          a1: pids.a1, a1_pos: pos.a1, a2: pids.a2, a2_pos: pos.a2,
          b1: pids.b1, b1_pos: pos.b1, b2: pids.b2, b2_pos: pos.b2,
          score_a: sa, score_b: sbv, winner,
          deltas, exp_a: isFinite(expA) ? expA : 0.5,
          created_at: created
        }),
      zeile
    });
  }
  res.fehlendeSpieler = [...res.fehlendeSpieler];
  return res;
}

// ─── §12.9 — Import-Vorschau + Schreiben ─────────────────────────────
let _pendingImport = null; // {kind, analyse, savepoint}

async function startBackupImport(){
  const file = await _pickFile('.xlsx,.csv,.json');
  if(!file) return;
  toast('Datei wird gelesen …','info');
  let parsed;
  try{ parsed = await _readBackupFile(file); }
  catch(e){ toast(e.message, true); return; }

  if(parsed.savepoint){
    const sp = parsed.savepoint;
    const haveM = new Set(matches.map(m => m.id));
    const haveP = new Set(players.map(p => p.id));
    const haveS = new Set(seasons.map(s => s.id));
    _pendingImport = {
      kind: 'savepoint',
      savepoint: sp,
      neuM: sp.matches.filter(m => m.id && !haveM.has(m.id)),
      neuP: (sp.players || []).filter(p => p.id && !haveP.has(p.id)),
      neuS: (sp.seasons || []).filter(s => s.id && !haveS.has(s.id))
    };
    _showImportPreview(file.name);
    return;
  }

  // Excel/CSV: erst die Spieler aus der Datei bekannt machen (nur virtuell —
  // angelegt wird erst beim Bestätigen), damit die Analyse nicht an fehlenden
  // Spielern scheitert, die im selben Backup mitgeliefert werden.
  const extra = {};
  const neueSpieler = [];
  if(parsed.playerRows && parsed.playerRows.length > 1){
    const pidx = _headerIndex(parsed.playerRows[0]);
    const haveP = new Set(players.map(p => p.id));
    const haveN = new Set(players.map(p => String(p.name).trim().toLowerCase()));
    for(let r = 1; r < parsed.playerRows.length; r++){
      const row = parsed.playerRows[r];
      const pid = _col(row, pidx, 'Spieler-ID', 'id');
      const nm  = _col(row, pidx, 'Name');
      if(!nm) continue;
      if((pid && haveP.has(pid)) || haveN.has(nm.toLowerCase())) continue;
      const entry = {
        id: pid || undefined, name: nm,
        elo: parseFloat(_col(row, pidx, 'Elo')) || cfg.start_elo,
        atk: parseFloat(_col(row, pidx, 'Angriffs-Wert', 'atk')) || 0.5,
        avatar_id: _col(row, pidx, 'Avatar', 'avatar_id') || null,
        hidden: /^(ja|true|1)$/i.test(_col(row, pidx, 'Ausgeblendet', 'hidden'))
      };
      neueSpieler.push(entry);
      if(pid) extra[nm.toLowerCase()] = pid;
    }
  }
  const analyse = _analyseMatchRows(parsed.matchRows, {extraPlayers: extra});
  // Rohzeilen aufheben: falls beim Bestätigen erst noch Spieler angelegt
  // werden, muss die Zuordnung danach mit den ECHTEN IDs neu laufen.
  _pendingImport = {kind: 'table', analyse, neueSpieler, rawMatchRows: parsed.matchRows};
  _showImportPreview(file.name);
}

function _showImportPreview(filename){
  const p = _pendingImport;
  if(!p) return;
  const line = (label, val, color) =>
    `<div class="nd-stat-row"><div class="nd-stat-label">${esc(label)}</div>
     <div class="nd-stat-val"${color?` style="color:${color}"`:''}>${esc(String(val))}</div></div>`;

  let body = '', canApply = false;
  if(p.kind === 'savepoint'){
    const sp = p.savepoint;
    canApply = (p.neuM.length + p.neuP.length + p.neuS.length) > 0;
    body = `
      <div class="nd-section">Savepoint</div>
      ${line('Erstellt', new Date(sp.createdAt).toLocaleString('de-DE'))}
      ${line('App-Version', sp.build || '—')}
      ${line('Enthält', `${(sp.players||[]).length} Spieler · ${sp.matches.length} Matches`)}
      <div class="nd-section">Wird ergänzt</div>
      ${line('Neue Spieler', p.neuP.length, p.neuP.length ? 'var(--acid)' : '')}
      ${line('Neue Saisons', p.neuS.length, p.neuS.length ? 'var(--acid)' : '')}
      ${line('Neue Matches', p.neuM.length, p.neuM.length ? 'var(--acid)' : '')}
      ${line('Bereits vorhanden', sp.matches.length - p.neuM.length)}`;
  } else {
    const a = p.analyse;
    canApply = a.neu.length > 0 || p.neueSpieler.length > 0;
    const fehlerListe = a.fehler.slice(0, 8).map(f =>
      `<div style="font-size:11px;color:var(--ink2);padding:6px 0;border-bottom:1px solid var(--line)">
         <b style="color:var(--red)">Zeile ${f.zeile}</b> — ${esc(f.grund)}</div>`).join('');
    body = `
      <div class="nd-section">Gefunden</div>
      ${line('Neue Matches', a.neu.length, a.neu.length ? 'var(--acid)' : '')}
      ${p.neueSpieler.length ? line('Neue Spieler', p.neueSpieler.length, 'var(--acid)') : ''}
      ${line('Bereits vorhanden', a.vorhanden)}
      ${line('Übersprungen', a.fehler.length, a.fehler.length ? 'var(--red)' : '')}
      ${a.fehlendeSpieler.length ? `<div class="nd-section">Unbekannte Spieler</div>
        <p style="font-size:11.5px;color:var(--ink2);line-height:1.6">
          ${esc(a.fehlendeSpieler.slice(0,10).join(', '))}${a.fehlendeSpieler.length>10?' …':''}<br>
          Lege sie zuerst an oder nimm ein Backup mit Spieler-Blatt.</p>` : ''}
      ${a.fehler.length ? `<div class="nd-section">Warum übersprungen</div>${fehlerListe}
        ${a.fehler.length > 8 ? `<div style="font-size:11px;color:var(--muted);padding-top:6px">+ ${a.fehler.length - 8} weitere</div>` : ''}` : ''}`;
  }

  openSheet(`
    <h3>Wiederherstellen</h3>
    <div class="sheet-sub">${esc(filename)}</div>
    <div style="margin-top:14px">${body}</div>
    <p style="font-size:11.5px;color:var(--muted);line-height:1.6;margin-top:14px">
      Es wird nichts gelöscht und nichts überschrieben — nur fehlende Einträge werden ergänzt.
      Danach berechnet die App die Rangliste neu.
    </p>
    <button class="btn" id="impApply" style="margin-top:14px;width:100%"${canApply ? '' : ' disabled'}>
      ${canApply ? 'Jetzt ergänzen' : 'Nichts zu ergänzen'}</button>
    <button class="btn ghost sm" id="impCancel" style="margin-top:8px;width:100%">Abbrechen</button>
  `);
  const cancel = document.getElementById('impCancel');
  if(cancel) cancel.onclick = () => { _pendingImport = null; closeSheet(); };
  const apply = document.getElementById('impApply');
  if(apply && canApply) apply.onclick = () => _applyBackupImport();
}

async function _applyBackupImport(){
  const p = _pendingImport;
  if(!p) return;
  const btn = document.getElementById('impApply');
  if(btn){ btn.disabled = true; btn.textContent = 'Wird geschrieben …'; }
  try{
    let addedP = 0, addedS = 0, addedM = 0;
    if(p.kind === 'savepoint'){
      // Reihenfolge ist Pflicht: Matches verweisen per Fremdschlüssel auf
      // Spieler, Saisons ebenfalls.
      if(p.neuP.length){
        const {error} = await sb.from('players').insert(p.neuP);
        if(error) throw new Error('Spieler: ' + error.message);
        addedP = p.neuP.length;
      }
      if(p.neuM.length){
        addedM = await _insertMatchChunks(p.neuM);
      }
      if(p.neuS.length){
        const {error} = await sb.from('seasons').upsert(p.neuS, {onConflict:'id'});
        if(error) throw new Error('Saisons: ' + error.message);
        addedS = p.neuS.length;
      }
    } else {
      if(p.neueSpieler.length){
        const {error} = await sb.from('players').insert(p.neueSpieler);
        if(error) throw new Error('Spieler: ' + error.message);
        addedP = p.neueSpieler.length;
        // Frisch angelegte Spieler haben jetzt echte IDs — neu einlesen und die
        // Zeilen ein zweites Mal zuordnen, sonst zeigen die Matches ins Leere.
        invalidateCache();
        await loadAll();
        p.analyse = _analyseMatchRows(p.rawMatchRows, {});
      }
      addedM = await _insertMatchChunks(p.analyse.neu.map(x => x.row));
    }
    _pendingImport = null;
    closeSheet();
    invalidateCache();
    await loadAll();
    const parts = [];
    if(addedM) parts.push(addedM + ' Matches');
    if(addedP) parts.push(addedP + ' Spieler');
    if(addedS) parts.push(addedS + ' Saisons');
    toast(parts.length ? (parts.join(' · ') + ' ergänzt') : 'Nichts zu ergänzen', 'ok');
  }catch(e){
    if(btn){ btn.disabled = false; btn.textContent = 'Jetzt ergänzen'; }
    toast('Import fehlgeschlagen: ' + e.message, true);
  }
}

// In Blöcken schreiben — ein einzelnes INSERT mit hunderten Zeilen läuft je
// nach Verbindung ins Timeout.
async function _insertMatchChunks(rows){
  const SIZE = 100;
  let n = 0;
  for(let i = 0; i < rows.length; i += SIZE){
    const chunk = rows.slice(i, i + SIZE);
    const {error} = await sb.from('matches').insert(chunk);
    if(error) throw new Error('Matches ab Zeile ' + (i + 1) + ': ' + error.message);
    n += chunk.length;
  }
  return n;
}

