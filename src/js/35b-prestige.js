// ╔═══ §13.8 ─── PRESTIGE & INSIGNIUM ──────────────────────────────────╗
//     Eine Zahl für eine ganze Laufbahn — und ein Zeichen dafür, das um
//     den Avatar liegt. Das Prestige ist KEINE zweite Rangliste: Elo sagt,
//     wie stark jemand gerade ist, Prestige sagt, was er über die Zeit
//     zusammengetragen hat.
//
//     Auszeichnungen und Monatswertungen sind unverlierbar — was einmal
//     passiert ist, bleibt passiert. Die Allzeitwertungen dagegen sind eine
//     Aussage über HEUTE: Wer einen Liga-Rekord abgibt, verliert seinen
//     Anteil daran. Das ist Absicht. „Ich halte den Rekord" ist eine
//     Behauptung in der Gegenwart; sie soll nicht dadurch wahr bleiben,
//     dass sie einmal wahr war.
//
//     DREI QUELLEN, und alle drei liegen schon vor:
//       Auszeichnungen  — die Badges [§7]
//       Monatswertungen — was jemand je in einer Monatstafel getragen hat
//       Allzeitwertungen— die Liga-Rekorde, die er heute hält
//
//     SELTENHEIT SCHLÄGT ANZAHL. Der Grundwert eines Eintrags hängt daran,
//     wie viele der gewerteten Spieler ihn überhaupt halten — gemessen an
//     den echten Daten, nicht behauptet. Was fast alle haben, ist fast
//     nichts wert; was einer hat, ist viel wert. Wächst die Liga, wächst
//     die Skala mit, weil sie mit ANTEILEN rechnet, nicht mit Köpfen.
//
//     ART SCHLÄGT SELTENHEIT. Ein seltenes Pensum ist trotzdem Pensum.
//     Leistung zählt doppelt, ein Ereignis einfach, eine Schattenseite gar
//     nicht — sie steht im Profil, aber sie zieht nichts ab und bringt
//     nichts ein. Wer schlecht spielt, verliert Elo; er soll nicht
//     zusätzlich am Prestige bluten.
//
//     FALLENDE ERTRÄGE. Der zweite Rekord ist weniger wert als der erste,
//     der zehnte weniger als der zweite (1/√n). Ohne das gewinnt am Ende,
//     wer am längsten dabei ist — genau das, was der Katalog gerade
//     losgeworden ist.
//
//     DIE SCHWELLEN sind an den echten 466 Partien kalibriert [§13.9]:
//     nach vier Monaten Liga trägt niemand den Ordensstern, und der Beste
//     ist noch gut die Hälfte seines bisherigen Lebenswerks davon entfernt.
//     Danach hört es nicht auf: der Stern bekommt je ORDENSSTERN_SCHRITT
//     weiterer Punkte eine Zacke mehr. Es gibt immer einen nächsten
//     Schritt, ohne dass es eine sechste Stufe braucht.
// ╚═════════════════════════════════════════════════════════════════════════╝

// Was eine Art wert ist. `schatten` steht bewusst auf 0 und nicht auf minus.
const PRESTIGE_ART = {leistung:2, ereignis:1, schatten:0};

// Grundwert einer Allzeitwertung, bevor Art und Halterzahl darauf wirken.
// Ein heute gehaltener Liga-Rekord wiegt deutlich schwerer als eine
// Auszeichnung — es gibt ihn nur einmal in der Liga.
const PRESTIGE_REKORD = 22;

// Die fünf Stufen. `min` ist die Schwelle, ab der die Stufe getragen wird.
const INSIGNIEN = [
  {key:'reif',    name:'Reif',          min:0},
  {key:'kerben',  name:'Kerbring',      min:70},
  {key:'strahl',  name:'Strahlenkranz', min:170},
  {key:'lorbeer', name:'Lorbeerreif',   min:350},
  {key:'stern',   name:'Ordensstern',   min:700},
];
// Der Ordensstern startet mit acht Zacken und bekommt je so vieler
// weiterer Punkte eine dazu.
const ORDENSSTERN_START = 8;
const ORDENSSTERN_SCHRITT = 125;

// Grundwert nach gemessener Seltenheit. `anteil` = Halter / gewertete Spieler.
function prestigeGrundwert(halter, gesamt){
  if(halter <= 0) return 0;
  const anteil = halter / Math.max(1, gesamt);
  if(anteil <= 0.10) return 25;
  if(anteil <= 0.20) return 20;
  if(anteil <= 0.45) return 8;
  if(anteil <= 0.80) return 3;
  return 1;
}

// Die `art` eines Monatseintrags. Eingefrorene Monate können IDs tragen,
// die es im heutigen Katalog nicht mehr gibt — die galten damals und
// zählen als Ereignis weiter, statt rückwirkend zu verschwinden.
function _prestigeArtVon(titleId){
  const d = DISZIPLINEN.find(x => x.id === titleId);
  return d ? d.art : 'ereignis';
}

// EIN Durchlauf für die ganze Liga. Seltenheit lässt sich nicht für einen
// Spieler allein bestimmen, also wird immer die ganze Tabelle gerechnet
// und memoisiert — wie überall an matches.length + _cache.version gebunden.
function prestigeTabelle(){
  const key = matches.length + '_' + _cache.version;
  if(_cache._prestigeKey === key) return _cache._prestige;

  const aktive = (players || []).filter(p => p && !p.hidden);
  const gesamt = aktive.length || 1;

  // 1. Rohdaten je Spieler einsammeln.
  const roh = {};
  aktive.forEach(p => { roh[p.id] = {badges:[], monat:[], rekord:[]}; });

  // Auszeichnungen
  const badgeArt = {}, badgeName = {};
  BADGES.forEach(b => { badgeArt[b.id] = BADGE_ART[b.id] || 'ereignis'; badgeName[b.id] = b.name; });
  aktive.forEach(p => {
    (getCachedBadges(p.id) || []).forEach(b => roh[p.id].badges.push(b.id));
  });

  // Monatswertungen — jeder je getragene Eintrag, auch aus alten Monaten.
  aktive.forEach(p => {
    (seasonTitleHistory(p.id) || []).forEach(r => {
      if(r.title) roh[p.id].monat.push({id:r.title.titleId, name:r.title.name, label:r.label});
    });
  });

  // Allzeitwertungen — was jemand HEUTE hält.
  const A = allChronicles();
  const halterZahl = {};
  CHRONICLES.forEach(d => {
    const e = A.byId[d.id];
    if(!e) return;
    halterZahl[d.id] = e.pids.length;
    e.pids.forEach(pid => { if(roh[pid]) roh[pid].rekord.push({id:d.id, name:d.name, art:d.art}); });
  });

  // 2. Halterzahlen für Auszeichnungen und Monatseinträge zählen.
  const badgeHalter = {}, monatHalter = {};
  aktive.forEach(p => {
    new Set(roh[p.id].badges).forEach(id => { badgeHalter[id] = (badgeHalter[id]||0) + 1; });
    new Set(roh[p.id].monat.map(m => m.id)).forEach(id => { monatHalter[id] = (monatHalter[id]||0) + 1; });
  });

  // 3. Punkte. Auszeichnungen zählen einmal je Badge — ihre Seltenheit
  //    steckt schon in der Halterzahl, die Anzahl der Wiederholungen
  //    würde nur wieder das Pensum belohnen.
  const out = {};
  aktive.forEach(p => {
    const r = roh[p.id];
    const quellen = [];

    let pb = 0;
    new Set(r.badges).forEach(id => {
      const w = prestigeGrundwert(badgeHalter[id], gesamt) * (PRESTIGE_ART[badgeArt[id]] ?? 1);
      if(w > 0){ pb += w; quellen.push({q:'auszeichnung', id, name:badgeName[id]||id, p:w}); }
    });

    // Monatswertungen: nach Wert absteigend, dann fallende Erträge.
    const mw = r.monat.map(m => ({
      m, w: prestigeGrundwert(monatHalter[m.id], gesamt) * (PRESTIGE_ART[_prestigeArtVon(m.id)] ?? 1)
    })).filter(x => x.w > 0).sort((a,b) => b.w - a.w);
    let pm = 0;
    mw.forEach((x, i) => {
      const w = x.w / Math.sqrt(i + 1);
      pm += w;
      quellen.push({q:'monat', id:x.m.id, name:x.m.name, label:x.m.label, p:w});
    });

    // Allzeitwertungen: ein geteilter Rekord zählt geteilt.
    const rw = r.rekord.map(x => ({
      x, w: PRESTIGE_REKORD * (PRESTIGE_ART[x.art] ?? 1) / Math.max(1, halterZahl[x.id] || 1)
    })).filter(x => x.w > 0).sort((a,b) => b.w - a.w);
    let pr = 0;
    rw.forEach((x, i) => {
      const w = x.w / Math.sqrt(i + 1);
      pr += w;
      quellen.push({q:'rekord', id:x.x.id, name:x.x.name, p:w});
    });

    const punkte = Math.round(pb + pm + pr);
    out[p.id] = {
      pid:p.id, punkte,
      teile:{auszeichnung:Math.round(pb), monat:Math.round(pm), rekord:Math.round(pr)},
      zahlen:{auszeichnung:new Set(r.badges).size, monat:mw.length, rekord:rw.length},
      quellen: quellen.sort((a,b) => b.p - a.p)
    };
  });

  const res = {byPid:out, gesamt, rang:Object.values(out).sort((a,b) => b.punkte - a.punkte).map(x => x.pid)};
  _cache._prestigeKey = key;
  _cache._prestige = res;
  return res;
}

// Der Stand eines Spielers, fertig zum Anzeigen.
function prestigeOf(pid){
  const T = prestigeTabelle();
  const e = T.byPid[pid];
  if(!e) return {punkte:0, stufe:0, insignie:INSIGNIEN[0], naechste:INSIGNIEN[1],
                 fehlt:INSIGNIEN[1].min, zacken:0, teile:{auszeichnung:0,monat:0,rekord:0},
                 zahlen:{auszeichnung:0,monat:0,rekord:0}, quellen:[], platz:0, von:T.gesamt};
  let i = 0;
  while(i + 1 < INSIGNIEN.length && e.punkte >= INSIGNIEN[i + 1].min) i++;
  const letzte = i === INSIGNIEN.length - 1;
  return Object.assign({}, e, {
    stufe:i,
    insignie:INSIGNIEN[i],
    naechste: letzte ? null : INSIGNIEN[i + 1],
    fehlt: letzte ? 0 : INSIGNIEN[i + 1].min - e.punkte,
    // Auf der letzten Stufe wächst der Stern weiter, statt stehenzubleiben.
    zacken: letzte ? ORDENSSTERN_START + Math.floor((e.punkte - INSIGNIEN[i].min) / ORDENSSTERN_SCHRITT) : 0,
    naechsteZacke: letzte
      ? ORDENSSTERN_SCHRITT - ((e.punkte - INSIGNIEN[i].min) % ORDENSSTERN_SCHRITT) : 0,
    platz: T.rang.indexOf(pid) + 1,
    von: T.gesamt
  });
}

// ─── §13.9 Das Insignium: ein Zeichen statt einer Zahl ───────────────
//     Der Ring um den Avatar zeigt die Stufe als FORM, nicht als Zahl.
//     Man muss nichts lesen, um zu sehen, dass jemand weiter ist:
//
//       Reif          ein glatter Reif
//       Kerbring      derselbe Reif, gekerbt
//       Strahlenkranz Strahlen nach außen
//       Lorbeerreif   Lorbeer auf dem Reif
//       Ordensstern   ein Stern hinter dem Reif, der weiterwächst
//
//     Das MATERIAL kommt vom Rang, nicht von der Stufe: dieselbe Form in
//     dunklem Grau oder in hellem Weißmetall. Zwei Achsen, zwei Aussagen —
//     wie gut jemand gerade ist, und was er zusammengetragen hat.
//
//     DAS TITELBAND ist die dritte Achse und die einzige in Gold: je
//     Meistertitel klappt links und rechts eine Feder aus, der Schild trägt
//     die Zahl, bei fünf Titeln kommt die Krone. Ohne Titel stehen die
//     Federn als feine Umrisse da — man sieht von Anfang an, wohin es geht.
//     Gold gibt es NUR hier. Alles andere ist Metall.

// Metallfarbe je Rang. Von stumpf nach hell.
const INS_METALL = {
  Einsteiger:'#5A6166', Solide:'#767D83', Stark:'#969DA3',
  Elite:'#BAC1C6', Legende:'#EDF2F5',
};
const INS_GOLD = '#E0B54A';

// Wie oft jemand Meister war. Nur abgeschlossene Saisons — der laufende
// Monat ist noch nicht entschieden.
function meisterTitel(pid){
  const key = 'meister_' + pid + '_' + matches.length + '_' + _cache.version;
  if(!_cache._meister) _cache._meister = {};
  if(_cache._meister[key] != null) return _cache._meister[key];
  const cur = currentSeason().id;
  let n = 0;
  (allPastSeasons() || []).forEach(sid => {
    if(sid === cur) return;
    if(seasonChampion(sid) === pid) n++;
  });
  _cache._meister[key] = n;
  return n;
}

// Die aktuelle Position in der Liga — dieselbe Quelle wie die Krone des
// Meisters, damit Schild und Krone nie widersprechen.
function ligaPosition(pid){
  try {
    const C = _seasonTitleCtx(currentSeason().id);
    const i = (C.rank || []).findIndex(r => r.id === pid);
    return i >= 0 ? i + 1 : 0;
  } catch(e){ return 0; }
}

// EINE Feder der Schwinge. i=0 ist die oberste und längste. `f` ist die
// Entfaltung: 0 bei keinem Titel, 1 bei fünf. Die Schwinge wird nicht
// gezählt, sie geht auf — Spannweite und Anstellung wachsen mit jedem Titel.
function _insFeder(i, f, offen, metall){
  const y  = -6 + i * 4.8;                        // Wurzel an der Schildflanke
  const L  = 13 + (29 - i * 4.2) * f;             // Spannweite — waechst sichtbar
  const h  = 2.7 - i * 0.36;
  const steig = (5.8 - i * 1.15) * (0.45 + 1.05 * f);  // Anstellung nach aussen
  const x0 = 41.5, x1 = x0 - L;
  const ty = y - steig;
  const d = `M${x0} ${y-h}`
    + `Q${(x0-L*0.42).toFixed(1)} ${(y-h-steig*0.8-1.2).toFixed(1)} ${x1.toFixed(1)} ${ty.toFixed(1)}`
    + `Q${(x0-L*0.52).toFixed(1)} ${(ty+h*2.1+steig*0.3).toFixed(1)} ${x0} ${y+h}Z`;
  return offen
    ? `<path d="${d}" fill="${INS_GOLD}" opacity="${(1 - i*0.09).toFixed(2)}"/>`
    : `<path d="${d}" fill="none" stroke="${metall}" stroke-width=".5" opacity=".18"/>`;
}

function _insSchwingen(titel, metall){
  const f = Math.min(titel, 5) / 5;
  const offen = titel > 0;
  let l = '';
  for(let i = 0; i < 4; i++) l += _insFeder(i, f, offen, metall);
  return `<g>${l}</g><g transform="translate(100,0) scale(-1,1)">${l}</g>`;
}

// Schild mit der LIGA-POSITION — nicht mit der Titelzahl. Die Titel stehen
// in der Schwinge, die Position ist das, was sich jede Woche ändert.
// Ab fünf Titeln sitzt die Krone obenauf: volle Entfaltung.
function _insSchild(pos, titel, metall){
  const schild = 'M40.5 -14H59.5V1.5C59.5 9.4 54.6 14.8 50 17C45.4 14.8 40.5 9.4 40.5 1.5Z';
  const krone = [[42.4,-17.5],[45.4,-25.5],[47.7,-19.5],[50,-27.5],[52.3,-19.5],[54.6,-25.5],[57.6,-17.5]]
    .map(p => p.join(' ')).join(' L');
  const offen = titel > 0;
  return (titel >= 5 ? `<path d="M${krone}Z" fill="${INS_GOLD}" opacity=".92"/>` : '')
    + `<path d="${schild}" fill="${offen ? INS_GOLD : 'none'}" fill-opacity="${offen ? .95 : 0}"
         stroke="${offen ? INS_GOLD : metall}" stroke-width="1.2" stroke-opacity="${offen ? 1 : .32}"
         stroke-linejoin="round"/>`
    + (pos > 0 ? `<text x="50" y="6.5" text-anchor="middle" font-size="14" font-weight="700"
         font-family="'Archivo Black',sans-serif"
         fill="${offen ? '#14171A' : metall}" fill-opacity="${offen ? 1 : .7}">${pos}</text>` : '');
}

// Die fünf Stufen als Form. R ist der Radius des Reifs.
function _insStufe(key, metall, zacken){
  const R = 40, mid = 50;
  const reif = `<circle cx="${mid}" cy="${mid}" r="${R}" fill="none" stroke="${metall}" stroke-width="2.4"/>`;
  const um = (n, f) => { let s = ''; for(let i = 0; i < n; i++) s += f(i, i / n * Math.PI * 2 - Math.PI/2); return s; };
  const pt = (a, r) => [mid + Math.cos(a)*r, mid + Math.sin(a)*r];

  if(key === 'kerben'){
    return reif + um(28, (i, a) => {
      const [x1,y1] = pt(a, R - 3.4), [x2,y2] = pt(a, R + 3.4);
      return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
        stroke="${metall}" stroke-width="1.5" opacity=".75"/>`;
    });
  }
  if(key === 'strahl'){
    return reif + um(36, (i, a) => {
      const lang = i % 3 === 0;
      const [x1,y1] = pt(a, R + 1.5), [x2,y2] = pt(a, R + (lang ? 8 : 4.5));
      return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
        stroke="${metall}" stroke-width="${lang ? 1.6 : 1}" opacity="${lang ? .85 : .5}" stroke-linecap="round"/>`;
    });
  }
  if(key === 'lorbeer'){
    return reif + um(22, (i, a) => {
      const [x,y] = pt(a, R);
      const dreh = (a * 180 / Math.PI + 90).toFixed(1);
      return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="2.1" ry="5.4"
        transform="rotate(${dreh} ${x.toFixed(1)} ${y.toFixed(1)})"
        fill="${metall}" opacity=".8"/>`;
    });
  }
  if(key === 'stern'){
    const n = Math.max(8, zacken || 8);
    let d = '';
    for(let i = 0; i < n * 2; i++){
      const a = i / (n * 2) * Math.PI * 2 - Math.PI/2;
      const [x,y] = pt(a, i % 2 ? R - 6 : R + 11);
      d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    // Nur Kontur: die Mitte gehört dem Avatar, nicht dem Zeichen.
    return `<path d="${d}Z" fill="none" stroke="${metall}" stroke-width="1.3"
      stroke-linejoin="round" opacity=".9"/>` + reif;
  }
  return reif;   // reif
}

// Das ganze Zeichen. `band:false` lässt das Titelband weg (Listen, Feed).
function insigniumSvg(pid, opt){
  opt = opt || {};
  const P = prestigeOf(pid);
  const rang = (getPlayerRank(pid) || {}).label;
  const metall = INS_METALL[rang] || INS_METALL.Solide;
  const band = opt.band !== false;
  const titel = band ? meisterTitel(pid) : 0;
  const inner = opt.inner || '';
  const box = band ? '0 -28 100 128' : '0 0 100 100';
  return `<svg viewBox="${box}" class="ins" aria-hidden="true">`
    + (band ? _insSchwingen(titel, metall) : '')
    + _insStufe(P.insignie.key, metall, P.zacken)
    + (inner ? `<g>${inner}</g>` : '')
    + (band ? _insSchild(ligaPosition(pid), titel, metall) : '')
    + `</svg>`;
}

// ─── §13.10 Die Laufbahn: wo stehe ich, und was fehlt ────────────────
//     Ein Tipp auf den eigenen Avatar. Kein Menüpunkt, keine Erklärseite —
//     das Zeichen selbst ist der Knopf. Drei Fragen, in dieser Reihenfolge:
//     Wo stehe ich? Woher kommt das? Was ist der nächste Schritt?
//
//     Die nächsten Schritte werden GERECHNET, nicht behauptet: aus den
//     eigenen Zahlen, mit der echten Distanz zum Bestwert bzw. zur
//     Untergrenze, und mit dem Prestige, das dabei herausspringt.

// Bis zu `n` erreichbare nächste Schritte, die günstigsten zuerst.
function prestigeSchritte(pid, n){
  n = n || 3;
  const out = [];
  const P = prestigeOf(pid);

  // 1. Allzeitwertungen, die der Spieler noch nicht hält.
  try {
    const C = _chronicleCtx(), A = allChronicles(), p = C.P[pid];
    if(p){
      CHRONICLES.forEach(def => {
        if(def.art === 'schatten') return;
        const halte = A.byId[def.id];
        if(halte && halte.pids.includes(pid)) return;
        let mein = null, ziel = null;
        if(def.unit && def.raw){
          mein = def.raw(p, C);
          ziel = halte ? halte.val : (def.min || 0);
        } else if(def.val){
          mein = def.val(p, C);
          ziel = halte ? halte.val : null;
        }
        if(mein == null || !isFinite(mein) || ziel == null || mein >= ziel) return;
        const rel = (ziel - mein) / Math.max(1e-9, Math.abs(ziel));
        const gewinn = PRESTIGE_REKORD * (PRESTIGE_ART[def.art] ?? 1)
          / Math.max(1, (halte ? halte.pids.length + 1 : 1))
          / Math.sqrt(P.zahlen.rekord + 1);
        out.push({
          art:'rekord', id:def.id, name:def.name, ic:def.ic, tone:def.tone, rel,
          gewinn:Math.round(gewinn),
          txt: def.unit
            ? `Noch ${Math.max(1, Math.ceil(ziel - mein))} ${def.unit}` +
              (halte ? ` — ${_chronHolderNames(halte)} hält ${Math.round(ziel)}` : '')
            : (halte ? `${_chronHolderNames(halte)} hält den Bestwert` : def.cond)
        });
      });
    }
  } catch(e){ /* Kontext noch nicht da — dann eben ohne Rekorde */ }

  // 2. Monatswertungen der laufenden Saison, die noch offen sind.
  try {
    const T = seasonTitles(currentSeason().id);
    if(!T.awarded.some(a => a.pid === pid)){
      seasonTitleRace(currentSeason().id).forEach(r => {
        if(!r || r.pid === pid) return;
        const d = DISZIPLINEN.find(x => x.id === r.id);
        if(!d || d.art === 'schatten') return;
        out.push({
          art:'monat', id:r.id, name:r.name || (d && d.name), ic:d.ic, tone:d.tone,
          rel: 0.55,          // ein offener Monatseintrag ist immer „diesen Monat noch"
          gewinn: Math.round(8 * (PRESTIGE_ART[d.art] ?? 1) / Math.sqrt(P.zahlen.monat + 1)),
          txt: r.pid ? `${pname(r.pid)} führt — ${r.ev || d.monat.cond}` : d.monat.cond
        });
      });
    }
  } catch(e){ /* dito */ }

  return out.filter(x => x.gewinn > 0)
    .sort((a, b) => a.rel - b.rel || b.gewinn - a.gewinn)
    .slice(0, n);
}

// Das Sheet. Aufgerufen vom Avatar im Profilkopf.
function showLaufbahn(pid){
  const p = (pmap() || {})[pid];
  if(!p) return;
  _sheetSetReopen(() => showLaufbahn(pid));
  const P = prestigeOf(pid);
  const t = titleTone(P.stufe >= 3 ? 'gold' : P.stufe >= 1 ? 'acid' : 'blue');
  const spanne = P.naechste ? P.naechste.min - P.insignie.min : ORDENSSTERN_SCHRITT;
  const drin = P.naechste ? P.punkte - P.insignie.min
                          : (P.punkte - P.insignie.min) % ORDENSSTERN_SCHRITT;
  const pct = Math.max(2, Math.min(100, Math.round(drin / Math.max(1, spanne) * 100)));

  const teil = (lab, n, pt, sub) => `<div class="lb-teil">
      <div class="lb-t-n num">${pt}</div>
      <div class="lb-t-l">${esc(lab)}</div>
      <div class="lb-t-s num">${n} ${esc(sub)}</div>
    </div>`;

  const schritte = prestigeSchritte(pid, 3);
  const quellen = P.quellen.slice(0, 8);

  openSheet(`
    <h3>Die Laufbahn</h3>
    <div class="sheet-sub num">${esc(p.name)} · Platz ${P.platz} von ${P.von} im Prestige</div>

    <div class="lb-hero" style="--tt:${t.c};--ttr:${t.rgb}">
      <div class="lb-ins">${insigniumSvg(pid)}</div>
      <div class="lb-h-tx">
        <div class="lb-h-stufe">${esc(P.insignie.name)}</div>
        <div class="lb-h-pts num">${P.punkte} Prestige</div>
        ${P.naechste
          ? `<div class="lb-h-next num">Noch ${P.fehlt} bis ${esc(P.naechste.name)}</div>`
          : `<div class="lb-h-next num">${P.zacken} Zacken · noch ${P.naechsteZacke} bis zur nächsten</div>`}
      </div>
    </div>
    <div class="lb-bar"><div class="lb-bar-fill" style="width:${pct}%;background:${t.c}"></div></div>

    <div class="pp-sec-title" style="margin-top:18px"><div class="l"><h4>Woher es kommt</h4></div></div>
    <div class="lb-teile">
      ${teil('Auszeichnungen', P.zahlen.auszeichnung, P.teile.auszeichnung, 'Stück')}
      ${teil('Monatswertungen', P.zahlen.monat, P.teile.monat, 'getragen')}
      ${teil('Rekorde', P.zahlen.rekord, P.teile.rekord, 'gehalten')}
    </div>

    ${schritte.length ? `
      <div class="pp-sec-title" style="margin-top:18px"><div class="l"><h4>Der nächste Schritt</h4></div>
        <div class="m">${schritte.length}</div></div>
      <div class="lb-steps">
        ${schritte.map(s => {
          const st = titleTone(s.tone);
          return `<div class="lb-step" style="--tt:${st.c};--ttr:${st.rgb}"${
            s.art === 'rekord' ? ` data-chron="${esc(s.id)}"` : ''}>
            <span class="ic">${svgI(s.ic)}</span>
            <span class="tx"><span class="n">${esc(s.name)}</span>
              <span class="e">${esc(s.txt)}</span></span>
            <span class="pl num">+${s.gewinn}</span>
          </div>`;
        }).join('')}
      </div>` : ''}

    ${quellen.length ? `
      <div class="pp-sec-title" style="margin-top:18px"><div class="l"><h4>Die schwersten Posten</h4></div>
        <div class="m">${P.quellen.length}</div></div>
      <div class="lb-quellen">
        ${quellen.map(q => `<div class="lb-q">
          <span class="k">${q.q === 'rekord' ? 'Rekord' : q.q === 'monat' ? 'Monat' : 'Auszeichnung'}</span>
          <span class="n">${esc(q.name)}${q.label ? ` <em>${esc(q.label)}</em>` : ''}</span>
          <span class="p num">${Math.round(q.p)}</span>
        </div>`).join('')}
      </div>` : ''}

    <div class="tnote">Seltenheit schlägt Anzahl, Leistung schlägt Seltenheit.
      Jeder weitere Eintrag derselben Art zählt etwas weniger als der davor —
      sonst gewinnt am Ende, wer am längsten dabei ist.</div>
  `);
  _bindChronikClicks(document.getElementById('sheet'));
}
