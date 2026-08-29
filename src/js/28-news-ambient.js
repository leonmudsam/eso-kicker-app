// ─── §11.1b — Ambiente Fun-Fact-Stories (v8.5, v9.5) ─────────────────
// Erzeugt Fun Facts / persönliche Nuggets / Rivalitäten / Historie, damit der
// Feed auch OHNE neue Matches lebendig wirkt.
//
// KERNPRINZIP (kein Spam, Cross-Device-konsistent):
//   - RHYTHMUS (v9.7): zwei Fun Facts pro TAG, um 10:00 und 19:00. _isAmbientDay
//     ist immer true; ein Slot entsteht erst ab seiner Uhrzeit.
//   - Story-ID ist tages+stunden-deterministisch: `ambient_<datum>_<stunde>`.
//     → ON CONFLICT DO NOTHING beim Upload: der erste Insert gewinnt den
//       Timestamp, alle Geräte sehen exakt dieselbe Story.
//   - Welchen Fun Fact der Slot zeigt, entscheidet ein aus dem Datum geseedeter
//     Pseudo-Zufall (mulberry32) — „random" fürs Gefühl, aber überall identisch.
//   - COOLDOWN: Fun-Fact-Typen, die in den letzten AMBIENT_COOLDOWN_DAYS Tagen
//     schon liefen, werden gesperrt → Rotation statt vorhersehbarer Reihenfolge,
//     keine schnellen Wiederholungen. Ist alles gesperrt, wird die Sperre gelöst.
//   - Die Inhalte stammen aus echten Daten (allPlayerStats, H2H-Map, Scores) —
//     nichts wird erfunden. Liefert ein Template kein Ergebnis (zu wenig Daten),
//     wird deterministisch das nächste genommen.
function _buildAmbientStories(now, pm, nameOf){
  const out = [];
  if(!Array.isArray(AMBIENT_SLOTS) || !AMBIENT_SLOTS.length) return out;
  // v9.7: täglich, mehrere Slots (10:00 & 19:00). _isAmbientDay ist immer true.
  if(!_isAmbientDay(now)) return out;

  const templates = _ambientTemplatePool(now, pm, nameOf);
  if(!templates.length) return out;

  // v9.18 — NACHSCHUB FÜR VERPASSTE SLOTS
  // Ein Slot entstand bisher nur, wenn jemand die App NACH seiner Uhrzeit und
  // VOR Mitternacht geöffnet hat. Wer abends nicht reinschaut, verliert den
  // 19-Uhr-Slot für immer: am nächsten Morgen läuft der Generator schon auf dem
  // neuen Datum. In der Praxis fehlten dadurch rund die Hälfte der Abend-Slots.
  //
  // Deshalb werden jetzt auch die letzten AMBIENT_BACKFILL_DAYS Tage geprüft und
  // fällige, aber fehlende Slots nachgetragen. Das ist gefahrlos, weil:
  //   • die Story-ID weiterhin aus Datum + Slot-Stunde entsteht — der Nachtrag
  //     bekommt exakt die ID, die er am Tag selbst bekommen hätte, und der
  //     Upload läuft mit ignoreDuplicates. Wer damals doch drin war, gewinnt.
  //   • der Seed derselbe ist (dateKey + '_' + slotHour) → identischer Inhalt,
  //     egal welches Gerät den Nachtrag schreibt.
  //   • `when` auf die echte Slot-Zeit gesetzt wird, die Karte also an ihrem
  //     richtigen Platz im Feed landet und nicht oben aufschlägt.
  // Das Fenster ist bewusst kurz: Die Fun Facts entstehen aus den HEUTIGEN
  // Zahlen. Drei Tage Rückstand sind vernachlässigbar, drei Wochen wären eine
  // Behauptung über einen Stand, den es damals nicht gab.
  //
  // Datum und Uhrzeit kommen ab hier aus DERSELBEN lokalen Zeit. Vorher stand im
  // Schlüssel das UTC-Datum, in `when` aber die lokale Slot-Zeit — zwischen
  // Mitternacht und der UTC-Grenze trug eine Story deshalb ein Datum, das nicht
  // zu ihrem Zeitstempel passte. Für die vorhandenen Zeilen ändert sich nichts:
  // um 10 und 19 Uhr sind lokales und UTC-Datum in dieser Zeitzone gleich.
  const _dayMs = 86400000;
  const dueSlots = [];
  const slotHours = AMBIENT_SLOTS.slice().sort((a, b) => a - b);
  for(let back = AMBIENT_BACKFILL_DAYS; back >= 0; back--){
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    const dk = day.getFullYear() + '-' + String(day.getMonth() + 1).padStart(2, '0')
             + '-' + String(day.getDate()).padStart(2, '0');
    for(const slotHour of slotHours){
      const when = new Date(day.getFullYear(), day.getMonth(), day.getDate(), slotHour, 0, 0, 0);
      if(when.getTime() > now.getTime()) continue;   // Slot ist noch nicht fällig
      dueSlots.push({dateKey: dk, slotHour, when});
    }
  }
  if(!dueSlots.length) return out;

  // Bereits persistierte Ambient-Stories: (a) ein Slot, der schon existiert, wird
  // nicht neu abgeleitet (Daten-Drift-Schutz, er kommt ohnehin aus dem DB-Cache);
  // (b) die der letzten Tage sperren ihren Fun-Fact-Typ bzw. ihre Köpfe.
  const known = (Array.isArray(_cache._stories) ? _cache._stories : [])
    .filter(s => s && typeof s.id === 'string' && s.id.indexOf('ambient_') === 0);
  const knownById = new Map(known.map(s => [s.id, s]));

  // v9.11: Cooldown ist PRO Typ. Standard = AMBIENT_COOLDOWN_DAYS; ein Template
  // darf ihn via `cooldown` verkürzen (z.B. fun_random_stat, dessen Inhalt bei
  // jedem Lauf variiert → darf früher wiederkommen).
  const cooldownDaysOf = {};
  for(const t of templates) cooldownDaysOf[t.key] = t.cooldown || AMBIENT_COOLDOWN_DAYS;
  const pidsOf = dr => !dr ? [] : (Array.isArray(dr.ambientPids) ? dr.ambientPids : (dr.ambientPid ? [dr.ambientPid] : []));

  // Eine gemeinsame Historie aus dem, was schon in der DB liegt. Nachgetragene
  // Slots hängen sich hier an, damit ein Nachtrag von vorgestern den Cooldown
  // für gestern genauso setzt, wie er es damals getan hätte. Ohne das könnte
  // ein Nachschub-Lauf drei Tage hintereinander denselben Fun Fact schreiben.
  const history = [];
  for(const s of known){
    const md = /^ambient_(\d{4}-\d{2}-\d{2})_/.exec(s.id);
    if(!md) continue;
    history.push({day: md[1], ts: new Date(md[1] + 'T00:00:00').getTime(),
                  sub: (s.dataRef && s.dataRef.sub) || null, pids: pidsOf(s.dataRef)});
  }

  for(const slot of dueSlots){
    const slotId = 'ambient_' + slot.dateKey + '_' + slot.slotHour;
    const existing = knownById.get(slotId);
    if(existing) continue;   // steht schon in der DB — nichts nachzutragen

    // Sperren immer aus Sicht des SLOT-TAGES, nicht aus Sicht von jetzt.
    const refMs = new Date(slot.dateKey + 'T00:00:00').getTime();
    // v9.11: Typ-Cooldown — was zuletzt lief, kommt nicht sofort wieder.
    const cooldownKeys = new Set();
    // Innerhalb desselben Tages darf ein Typ nicht zweimal kommen, damit 10:00
    // und 19:00 nie denselben Fun Fact zeigen.
    const usedToday = new Set();
    // v9.10 + v9.14: Same-Player-Sperre, heute (usedPids) und über die letzten
    // AMBIENT_PLAYER_COOLDOWN_DAYS (recentPids). Viele Templates sind „Wer führt
    // bei Stat X?"-Superlative und zeigen bei einem dominanten Spieler alle auf
    // denselben Kopf — ohne die Sperre feiert der Feed tagelang den Platzhirsch.
    const usedPids = new Set();
    const recentPids = new Set();
    for(const h of history){
      if(h.day === slot.dateKey){
        if(h.sub) usedToday.add(h.sub);
        for(const pid of h.pids) usedPids.add(pid);
      }
      const age = refMs - h.ts;
      if(age < 0) continue;   // liegt nach diesem Slot — zählt hier nicht
      if(h.sub && age <= (cooldownDaysOf[h.sub] || AMBIENT_COOLDOWN_DAYS) * _dayMs) cooldownKeys.add(h.sub);
      if(age <= AMBIENT_PLAYER_COOLDOWN_DAYS * _dayMs){ for(const pid of h.pids) recentPids.add(pid); }
    }

    const rng = _ambientRng(_ambientHash(slot.dateKey + '_' + slot.slotHour));
    // Templates in geseedeter Reihenfolge prüfen; erstes passende mit Ergebnis
    // gewinnt → variiert pro Slot/Tag, bleibt aber deterministisch.
    // v9.11: GEWICHTETE Reihenfolge — ein Template mit `weight` > 1 kommt
    // `weight`-fach in den Lostopf und landet dadurch statistisch früher, wird
    // also bei gleicher Eignung öfter gewählt (mehr „Mischung", kein Monopol).
    const bag = [];
    templates.forEach((t, i) => { const w = Math.max(1, t.weight || 1); for(let k = 0; k < w; k++) bag.push(i); });
    const seenIdx = new Set();
    const order = [];
    for(const i of _ambientShuffle(bag, rng)){ if(!seenIdx.has(i)){ seenIdx.add(i); order.push(i); } }
    let chosen = null, chosenKey = null;
    // Pass 0: Typ-Cooldown + heute-schon-genutzter Typ + Same-Player (heute UND
    //         letzte Tage) meiden → ideal frisch.
    // Pass 1: Typ-Cooldown gelockert, Same-Player (heute + letzte Tage) bleibt
    //         gesperrt → Namens-Rotation hat Vorrang vor Typ-Frische.
    // Pass 2: Notnagel — auch Same-Player erlaubt (falls nur der Platzhirsch
    //         überhaupt Templates befüllt), Typ-Sperre des Tages bleibt.
    // PFLICHT-SLOTS gehen vor: Ein Rückblick, der auf ein Datum gehört,
    // darf nicht vom Losverfahren abhängen. Trifft eine Pflicht-Bedingung
    // zu und liefert das Template ein Ergebnis, ist der Slot vergeben.
    let chosenPflicht = null, chosenPflichtKey = null;
    for(const t of templates){
      if(typeof t.pflicht !== 'function') continue;
      if(!t.pflicht(slot.dateKey, slot.slotHour)) continue;
      let res = null;
      try { res = t.make(_ambientRng(_ambientHash(slot.dateKey + '_p'))); } catch(e){ res = null; }
      if(res){ chosenPflicht = res; chosenPflichtKey = t.key; break; }
    }

    // Blickrichtung des Slots: 10:00 schaut nach vorn, 19:00 zurueck [§11.0].
    // In den ersten beiden Durchgaengen zaehlt sie, im dritten nicht mehr —
    // ein leerer Slot waere schlimmer als ein Fun Fact zur falschen Zeit.
    const rolle = _ambientRolleFuerSlot(slot.slotHour);
    for(let pass = 0; pass < 3 && !chosen; pass++){
      for(const idx of order){
        const t = templates[idx];
        if(usedToday.has(t.key)) continue;
        if(pass === 0 && cooldownKeys.has(t.key)) continue;
        if(pass < 2){
          const r = _ambientRolleVon(t.key);
          if(r && r !== rolle) continue;
        }
        let res = null;
        try { res = t.make(rng); } catch(e){ res = null; }
        if(!res) continue;
        if(pass < 2){
          const pids = pidsOf(res.dataRef);
          // Sowohl heute schon gefeierte (usedPids) als auch in den letzten
          // AMBIENT_PLAYER_COOLDOWN_DAYS Tagen gefeierte (recentPids) Köpfe meiden.
          if(pids.length && pids.some(p => usedPids.has(p) || recentPids.has(p))) continue;
        }
        chosen = res; chosenKey = t.key; break;
      }
    }
    if(chosenPflicht){ chosen = chosenPflicht; chosenKey = chosenPflichtKey; }
    if(!chosen) continue;
    // Sofort in die Historie eintragen: der nächste fällige Slot — auch der von
    // morgen im selben Nachschub-Lauf — sieht diesen Eintrag und meidet Typ und
    // Kopf genauso, wie er es getan hätte, wenn die Story damals entstanden wäre.
    history.push({day: slot.dateKey, ts: refMs, sub: chosenKey, pids: pidsOf(chosen.dataRef)});

    out.push({
      id:    slotId,
      cat:   chosen.cat,
      ic:    chosen.ic,
      title: chosen.title,
      desc:  chosen.desc,
      when:  slot.when,
      // Niedrige Prio + KEIN limitierender dataRef.pid (nur ambientPid/-Pids),
      // damit ambiente Stories nicht vom Per-Player-Limit geschluckt werden.
      prio:  chosen.prio || 4,
      // v9.17: vv/vl = optionale Kennzahl für den Mini-Chip rechts auf der Karte
      // (_newsVisual). Fun Facts standen bisher als reiner Text im Feed, während
      // jede andere Story ihre Zahl groß anzeigt — die Kennzahl macht sie auf
      // einen Blick lesbar. Wandert in dataRef, damit sie mitpersistiert wird.
      dataRef: Object.assign({type:'ambient', sub: chosenKey},
                             chosen.dataRef || {},
                             chosen.vv != null ? {vv: String(chosen.vv), vl: chosen.vl || ''} : {})
    });
  }
  return out;
}

// FNV-1a-Hash → 32-bit Seed (deterministisch, schnell).
function _ambientHash(str){
  let h = 2166136261 >>> 0;
  for(let i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
// mulberry32 PRNG → reproduzierbare Pseudo-Zufallszahlen [0,1).
function _ambientRng(seed){
  let a = seed >>> 0;
  return function(){
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Fisher-Yates mit geseedetem rng (verändert das Original nicht).
function _ambientShuffle(arr, rng){
  const a = arr.slice();
  for(let i = a.length - 1; i > 0; i--){
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

// Template-Pool: jede make()-Funktion liefert {cat, ic, title, desc, prio?,
// dataRef?} aus ECHTEN Daten — oder null, wenn die Datenlage nicht reicht.
// Icons sind bewusst auf die in NEWS_CATEGORIES bekannten beschränkt.
function _ambientTemplatePool(now, pm, nameOf){
  const stats = (typeof allPlayerStats === 'function') ? (allPlayerStats() || {}) : {};
  const activePids = Object.keys(pm).filter(pid => pm[pid] && !pm[pid].hidden);
  const withStats = activePids.filter(pid => stats[pid] && stats[pid].games > 0);
  const T = [];

  // ── v9.13: Zeitbasierte "Form"-Aggregation der letzten 14 Tage ──
  // EINMALIG (lazy + memoisiert) über nur die jüngsten Matches. `matches` ist
  // aufsteigend nach created_at sortiert → wir laufen von hinten und brechen ab,
  // sobald ein Match älter als das Fenster ist (O(Fenster) statt O(alle)).
  // Positionen (atk/def), enge Spiele (Tordiff ≤ 2) und 1-Tor-Siege werden
  // gleich mitgezählt, damit ALLE Form-Templates diese eine Schleife teilen —
  // pro Pool-Aufbau wird sie höchstens einmal ausgeführt.
  const RECENT_DAYS = 14;
  let _recentMemo;
  const recentAgg = () => {
    if(_recentMemo) return _recentMemo;
    const cutoff = now.getTime() - RECENT_DAYS * 86400000;
    const agg = {};
    let count = 0;
    for(let i = matches.length - 1; i >= 0; i--){
      const m = matches[i];
      if(mts(m) < cutoff) break; // asc-sortiert → alles davor ist älter
      count++;
      const diff = Math.abs((m.score_a||0) - (m.score_b||0));
      const aWon = m.winner === 'A';
      const seats = [[m.a1, m.a1_pos, true], [m.a2, m.a2_pos, true], [m.b1, m.b1_pos, false], [m.b2, m.b2_pos, false]];
      for(const [id, pos, onA] of seats){
        if(!id || !pm[id] || pm[id].hidden) continue;
        const won = onA ? aWon : !aWon;
        const gf = onA ? (m.score_a||0) : (m.score_b||0);
        const ga = onA ? (m.score_b||0) : (m.score_a||0);
        let a = agg[id];
        if(!a) a = agg[id] = { g:0, w:0, aG:0, aGoals:0, aW:0, dG:0, dGa:0, cg:0, cw:0, c1w:0 };
        a.g++; if(won) a.w++;
        if(pos === 'atk'){ a.aG++; a.aGoals += gf; if(won) a.aW++; }
        else if(pos === 'def'){ a.dG++; a.dGa += ga; }
        if(diff <= 2){ a.cg++; if(won) a.cw++; }
        if(won && diff === 1) a.c1w++;
      }
    }
    _recentMemo = { agg, count };
    return _recentMemo;
  };
  // Deterministischer "Bester nach Metrik"-Picker (Gleichstand → kleinere pid).
  const _formPick = (elig, metric) => {
    let best = null;
    for(const pid of elig){
      const v = metric(pid);
      if(v == null) continue;
      if(!best || v > best.v || (v === best.v && pid < best.pid)) best = { pid, v };
    }
    return best;
  };

  // ── Fun Fact: Tore insgesamt ──
  T.push({ key:'fun_goals', make: () => {
    if(matches.length < 5) return null;
    let g = 0; for(const m of matches) g += (m.score_a||0) + (m.score_b||0);
    return { cat:'fun', ic:'thriller', prio:3,
      title:'Tor-Bilanz der Liga',
      desc:`Insgesamt fielen ${g} Tore in ${matches.length} Spielen — Ø ${(g/matches.length).toFixed(1)} pro Match.`,
      vv: g, vl:'Tore' };
  }});

  // ── Fun Fact: aktivster Wochentag ──
  T.push({ key:'fun_weekday', make: () => {
    if(matches.length < 8) return null;
    const wd = [0,0,0,0,0,0,0];
    for(const m of matches){ wd[new Date(m.created_at).getDay()]++; }
    let bi = 0; for(let i = 1; i < 7; i++) if(wd[i] > wd[bi]) bi = i;
    if(!wd[bi]) return null;
    const names = ['sonntags','montags','dienstags','mittwochs','donnerstags','freitags','samstags'];
    return { cat:'fun', ic:'calendar', prio:3,
      title:'Kicker-Tag der Liga',
      desc:`Am häufigsten wird ${names[bi]} gekickt — ${wd[bi]} Spiele bisher.`,
      vv: wd[bi], vl:'Spiele' };
  }});

  // ── Fun Fact: Liga in Zahlen ──
  T.push({ key:'fun_numbers', make: () => {
    if(matches.length < 3) return null;
    return { cat:'fun', ic:'users', prio:2,
      title:'Liga in Zahlen',
      desc:`${matches.length} Duelle, ${activePids.length} aktive Spieler — und es werden mehr.`,
      vv: matches.length, vl:'Duelle' };
  }});

  // ── Persönlich: Siegquoten-Führer (min. 5 Spiele) ──
  T.push({ key:'personal_wr', make: () => {
    const elig = withStats.filter(pid => stats[pid].games >= 5);
    if(!elig.length) return null;
    elig.sort((a,b) => stats[b].wr - stats[a].wr);
    const pid = elig[0], st = stats[pid];
    return { cat:'personal', ic:'crown', prio:4,
      // v9.17: Der Filter ist „ab 5 Spielen" — das gehört auch in den Text,
      // sonst behauptet die News eine Liga-Bestmarke, die sie gar nicht prüft.
      title:`${nameOf(pid)} gewinnt einfach`,
      desc:`Beste Siegquote der Liga (ab 5 Spielen): ${Math.round(st.wr*100)}% aus ${st.games} Partien.`,
      vv: Math.round(st.wr*100)+'%', vl:'Siegquote',
      dataRef:{ ambientPid: pid } };
  }});

  // ── Persönlich: Vielspieler ──
  T.push({ key:'personal_grinder', make: () => {
    if(!withStats.length) return null;
    const pid = withStats.slice().sort((a,b) => stats[b].games - stats[a].games)[0];
    if(stats[pid].games < 10) return null;
    return { cat:'personal', ic:'medalTrio', prio:3,
      title:`${nameOf(pid)} ist Dauergast`,
      desc:`Niemand spielt mehr: ${stats[pid].games} Partien auf dem Konto.`,
      vv: stats[pid].games, vl:'Spiele',
      dataRef:{ ambientPid: pid } };
  }});

  // ── Persönlich: heißeste aktuelle Serie ──
  T.push({ key:'personal_streak', make: () => {
    if(!withStats.length) return null;
    const pid = withStats.slice().sort((a,b) => (stats[b].curStreak||0) - (stats[a].curStreak||0))[0];
    const cs = stats[pid].curStreak || 0;
    if(cs < 3) return null;
    return { cat:'personal', ic:'trendUp', prio:5,
      title:`${nameOf(pid)} läuft heiß`,
      desc:`${cs} Siege in Folge — aktuell die heißeste Serie der Liga.`,
      vv: cs+'×', vl:'in Folge',
      dataRef:{ ambientPid: pid } };
  }});

  // ── Persönlich: Torjäger (Ø Tore/Spiel, min. 5) ──
  T.push({ key:'personal_scorer', make: () => {
    const elig = withStats.filter(pid => stats[pid].games >= 5);
    if(!elig.length) return null;
    elig.sort((a,b) => (stats[b].gf/stats[b].games) - (stats[a].gf/stats[a].games));
    const pid = elig[0], avg = stats[pid].gf / stats[pid].games;
    if(avg <= 0) return null;
    return { cat:'personal', ic:'thriller', prio:3,
      title:`${nameOf(pid)} trifft am laufenden Band`,
      desc:`Ø ${avg.toFixed(1)} Tore pro Spiel — Bestwert der Liga.`,
      vv: avg.toFixed(1), vl:'Ø Tore',
      dataRef:{ ambientPid: pid } };
  }});

  // ── Rivalität: meistgespieltes Duell ──
  T.push({ key:'rivalry_most', make: () => {
    const map = (typeof _ensureH2HMap === 'function') ? _ensureH2HMap() : null;
    if(!map || !map.size) return null;
    let best = null;
    for(const [k, e] of map){
      const [pa, pb] = k.split('|');
      if(!pm[pa] || !pm[pb] || pm[pa].hidden || pm[pb].hidden) continue;
      const wa = e.wins[pa]||0, wb = e.wins[pb]||0, total = wa + wb;
      if(total < 3) continue;
      if(!best || total > best.total) best = { pa, pb, total, wa, wb };
    }
    if(!best) return null;
    return { cat:'rivalry', ic:'crossedSwords', prio:4,
      title:`Duell der Liga: ${nameOf(best.pa)} vs ${nameOf(best.pb)}`,
      desc:`${best.total} direkte Duelle — Siege: ${nameOf(best.pa)} ${best.wa}, ${nameOf(best.pb)} ${best.wb}.`,
      vv: best.total, vl:'Duelle',
      dataRef:{ ambientPids:[best.pa, best.pb], pairKind:'duel' } };
  }});

  // ── Rivalität: engste Bilanz (min. 4) ──
  T.push({ key:'rivalry_close', make: () => {
    const map = (typeof _ensureH2HMap === 'function') ? _ensureH2HMap() : null;
    if(!map || !map.size) return null;
    let best = null;
    for(const [k, e] of map){
      const [pa, pb] = k.split('|');
      if(!pm[pa] || !pm[pb] || pm[pa].hidden || pm[pb].hidden) continue;
      const wa = e.wins[pa]||0, wb = e.wins[pb]||0, total = wa + wb;
      if(total < 4) continue;
      const diff = Math.abs(wa - wb);
      if(!best || diff < best.diff || (diff === best.diff && total > best.total)) best = { pa, pb, wa, wb, total, diff };
    }
    if(!best) return null;
    return { cat:'rivalry', ic:'crossedSwords', prio:4,
      title:`Kopf-an-Kopf: ${nameOf(best.pa)} & ${nameOf(best.pb)}`,
      desc:`${best.total} direkte Duelle, ${best.diff === 0 ? 'absolut ausgeglichen' : 'nur ' + best.diff + ' Sieg' + (best.diff === 1 ? '' : 'e') + ' Unterschied'}: ${nameOf(best.pa)} ${best.wa} – ${best.wb} ${nameOf(best.pb)}.`,
      vv: best.wa+':'+best.wb, vl:'Bilanz',
      dataRef:{ ambientPids:[best.pa, best.pb], pairKind:'duel' } };
  }});

  // ── Historie: Liga-Alter ──
  T.push({ key:'history_age', make: () => {
    if(!matches.length) return null;
    const first = new Date(matches[0].created_at); // matches ist asc-sortiert (loadAll)
    const days = Math.floor((now - first) / 86400000);
    if(days < 14) return null;
    const dd = String(first.getDate()).padStart(2,'0');
    const mm = String(first.getMonth()+1).padStart(2,'0');
    return { cat:'history', ic:'calendar', prio:2,
      title:'Die Liga lebt',
      desc:`Seit ${days} Tagen wird gekickt — das erste Match war am ${dd}.${mm}.${first.getFullYear()}.`,
      vv: days, vl:'Tage' };
  }});

  // ── Fun Fact: Torschützenkönig (meiste Karriere-Tore, v8.8) ──
  // v9.17: Der Mindestspiele-Filter ist hier raus. Die Aussage lautet „kein
  // Spieler hat mehr erzielt" — eine Gesamtsumme braucht keine Mindestanzahl,
  // und mit Filter wäre der Satz streng genommen nicht belegt.
  T.push({ key:'fun_top_scorer', make: () => {
    const elig = withStats.filter(pid => stats[pid].gf > 0);
    if(!elig.length) return null;
    const sorted = elig.slice().sort((a,b) => stats[b].gf - stats[a].gf);
    const pid = sorted[0];
    const runnerUp = sorted[1] ? stats[pid].gf - stats[sorted[1]].gf : null;
    return { cat:'personal', ic:'thriller', prio:3,
      title:`${nameOf(pid)} ist Torschützenkönig`,
      desc: runnerUp != null
        ? `${stats[pid].gf} Tore insgesamt — ${runnerUp} mehr als ${nameOf(sorted[1])} dahinter.`
        : `${stats[pid].gf} Tore insgesamt — kein Spieler hat mehr erzielt.`,
      vv: stats[pid].gf, vl:'Tore',
      dataRef:{ ambientPid: pid } };
  }});

  // ── Fun Fact: aktueller Spitzenreiter (Elo-#1, v8.8) ──
  // v9.17 KONSISTENZ: Der Spitzenreiter kam aus getGlobalSim().elo, gefiltert
  // nach KARRIERE-Spielen ≥3. Die Rangliste (§5.1) zeigt dagegen die
  // SAISON-Tabelle aus periodPlayerStats('season') — wer in der laufenden Saison
  // noch nicht gespielt hat, steht dort gar nicht drin. Direkt nach einem
  // Saison-Reset stehen zudem alle auf dem Startwert, und die News kürte einen
  // beliebigen „Spitzenreiter" mit 0 Punkten Vorsprung. Jetzt dieselbe Quelle
  // und dieselbe Sortierung wie die Rangliste — eine Wahrheit, keine Abweichung.
  T.push({ key:'fun_leader', make: () => {
    if(typeof periodPlayerStats !== 'function') return null;
    const ranked = periodPlayerStats('season')
      .filter(r => pm[r.id] && !pm[r.id].hidden)
      .slice()
      .sort((a,b) => b.elo - a.elo || b.wins - a.wins);
    if(ranked.length < 2) return null;
    const lead = ranked[0].elo - ranked[1].elo;
    if(lead <= 0) return null; // Gleichstand an der Spitze → kein „thront"
    return { cat:'personal', ic:'crown', prio:4,
      title:`${nameOf(ranked[0].id)} thront an der Spitze`,
      desc:`${ranked[0].elo} Elo in dieser Saison — ${lead} Punkte vor ${nameOf(ranked[1].id)}.`,
      vv: ranked[0].elo, vl:'Elo',
      dataRef:{ ambientPid: ranked[0].id } };
  }});

  // ── Fun Fact: höchster Sieg aller Zeiten (v8.8) ──
  T.push({ key:'fun_biggest_win', make: () => {
    if(matches.length < 5) return null;
    let best = null;
    for(const m of matches){
      const hi = Math.max(m.score_a||0, m.score_b||0), lo = Math.min(m.score_a||0, m.score_b||0);
      const diff = hi - lo;
      if(!best || diff > best.diff) best = {diff, hi, lo, m};
    }
    if(!best || best.diff < 6) return null;
    const dt = new Date(best.m.created_at);
    return { cat:'fun', ic:'thriller', prio:3,
      title:'Klarste Klatsche der Liga',
      desc:`Höchster Sieg aller Zeiten: ${best.hi}:${best.lo} am ${String(dt.getDate()).padStart(2,'0')}.${String(dt.getMonth()+1).padStart(2,'0')}.`,
      vv: best.hi+':'+best.lo, vl:'Rekord' };
  }});

  // ── Fun Fact: aktivster Spieltag (v8.8) ──
  T.push({ key:'fun_busiest_day', make: () => {
    if(matches.length < 8) return null;
    const byDay = {};
    for(const m of matches){
      const d = new Date(m.created_at);
      const dk = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
      byDay[dk] = (byDay[dk] || 0) + 1;
    }
    let bk = null, bn = 0;
    for(const dk in byDay){ if(byDay[dk] > bn){ bn = byDay[dk]; bk = dk; } }
    if(bn < 5) return null;
    const p = bk.split('-');
    return { cat:'fun', ic:'calendar', prio:2,
      title:'Rekord-Spieltag',
      desc:`Meiste Spiele an einem Tag: ${bn} Partien am ${p[2]}.${p[1]}.${p[0]}.`,
      vv: bn, vl:'Spiele' };
  }});

  // ══ Neue lebendige Fun Facts (v9.1) ══
  const _gsim = () => (typeof getGlobalSim === 'function') ? (getGlobalSim() || {}) : {};

  // ── Fun Fact: Random Top-1 eines Awards/Rankings ──
  T.push({ key:'fun_award_leader', make: (rng) => {
    const career = _gsim().careerElo || {};
    const elig = withStats.filter(pid => stats[pid].games >= 5);
    if(elig.length < 2) return null;
    // v9.17: Kumulative Kennzahlen (Siege, Tore, Tordifferenz) werden über ALLE
    // Spieler mit Spielen ermittelt — eine Gesamtsumme braucht keine
    // Mindestanzahl. Nur die Karriere-Elo (eine Wertung, keine Summe) behält den
    // 5-Spiele-Filter, und der steht dann auch im Text.
    const cats = [
      { noun:'Meiste Siege',         ic:'trophy',  pool:withStats, val: pid => stats[pid].wins,               fmt: v => v+' Siege' },
      { noun:'Bestes Torverhältnis', ic:'chartUp', pool:withStats, val: pid => stats[pid].gf - stats[pid].ga, fmt: v => (v>0?'+':'')+v+' Tordifferenz' },
      { noun:'Meiste Tore',          ic:'ball',    pool:withStats, val: pid => stats[pid].gf,                 fmt: v => v+' Tore' },
      { noun:'Höchste Karriere-Elo', ic:'crown',   pool:elig,      val: pid => Math.round(career[pid]||0),    fmt: v => v+' Elo', qual:' (ab 5 Spielen)' },
    ];
    const c = cats[Math.floor(rng()*cats.length)];
    let best = null, second = null;
    for(const pid of c.pool){
      const v = c.val(pid);
      if(best === null || v > best.v){ second = best; best = {pid, v}; }
      else if(second === null || v > second.v){ second = {pid, v}; }
    }
    if(!best) return null;
    return { cat:'personal', ic:c.ic, prio:5,
      title:`${c.noun}: ${nameOf(best.pid)} führt`,
      desc: second
        ? `${c.fmt(best.v)} — Liga-Bestwert${c.qual||''}, vor ${nameOf(second.pid)} mit ${c.fmt(second.v)}.`
        : `${nameOf(best.pid)} hält den Liga-Bestwert${c.qual||''} — ${c.fmt(best.v)}.`,
      vv: best.v, vl: c.noun.replace(/^(Meiste|Bestes|Höchste)\s+/, ''),
      dataRef:{ ambientPid: best.pid } };
  }});

  // ── Fun Fact: Random Stat zu random Spieler ──
  // v9.11: bewusst höher gewichtet (weight 3) + kürzerer Cooldown (3 statt 7
  // Tage). Dieser Typ hat die größte inhaltliche Variabilität (zufälliger
  // Spieler × zufällige Kennzahl), darf also vergleichsweise öfter kommen, ohne
  // zu langweilen — Standard-Cooldown wäre sonst die harte Frequenz-Obergrenze.
  T.push({ key:'fun_random_stat', weight:3, cooldown:3, make: (rng) => {
    const elig = withStats.filter(pid => stats[pid].games >= 5);
    if(!elig.length) return null;
    const pid = elig[Math.floor(rng()*elig.length)];
    const st = stats[pid];
    const wrPct = st.games ? Math.round(st.wins/st.games*100) : 0;
    const facts = [
      `hat bereits ${st.games} Partien bestritten.`,
      `gewinnt ${wrPct}% seiner Spiele.`,
      `hat insgesamt ${st.gf} Tore erzielt.`,
      `steht bei ${st.wins} Siegen und ${st.losses} Niederlagen.`,
      `trifft im Schnitt ${(st.gf/st.games).toFixed(1)}× pro Spiel.`,
    ];
    return { cat:'personal', ic:'chartBar', prio:4,
      title:'Übrigens',
      desc:`${nameOf(pid)} ${facts[Math.floor(rng()*facts.length)]}`,
      dataRef:{ ambientPid: pid } };
  }});

  // ── Fun Fact: Platzierung in der ewigen Gesamt-Rangliste (random Spieler) ──
  T.push({ key:'fun_overall_rank', make: (rng) => {
    // v9.17 KONSISTENZ: gleiche Grundmenge und Sortierung wie der Gesamt-Tab
    // der Rangliste (§5.1: alle aktiven Spieler, Karriere-Elo mit Startwert als
    // Fallback, absteigend). Vorher wurde zusätzlich nach ≥3 Spielen gefiltert →
    // die genannte Platzierung passte nicht zu der, die man in der App sieht.
    const career = _gsim().careerElo || {};
    const eloOf = pid => career[pid] ?? cfg.start_elo;
    const ranked = activePids.slice().sort((a,b) => eloOf(b) - eloOf(a));
    if(ranked.length < 3) return null;
    // bewusst nicht #1 (langweilig) → aus dem Rest ziehen
    const idx = 1 + Math.floor(rng()*(ranked.length-1));
    const pid = ranked[idx];
    return { cat:'personal', ic:'medalTrio', prio:4,
      title:`${nameOf(pid)} auf Platz ${idx+1}`,
      desc:`In der ewigen Rangliste steht ${nameOf(pid)} auf Rang ${idx+1} von ${ranked.length} — ${Math.round(eloOf(pid))} Karriere-Elo, ${Math.round(eloOf(ranked[idx-1]) - eloOf(pid))} hinter ${nameOf(ranked[idx-1])}.`,
      vv: '#'+(idx+1), vl:'All-Time',
      dataRef:{ ambientPid: pid } };
  }});

  // ── Fun Fact: längste gemeinsame Team-Serie ──
  // v9.17 FORMULIERUNG: Hieß pauschal „Rekord-Duo", zog aber ein ZUFÄLLIGES Duo
  // mit ≥3 gemeinsamen Siegen in Serie — das ist per Definition kein Rekord und
  // „einer der besten Läufe der Liga" war schlicht ungeprüft. Jetzt wird die
  // Bestmarke der Liga mitberechnet: nur das tatsächlich führende Duo heißt
  // „Rekord-Duo", alle anderen bekommen eine ehrliche Einordnung (Platz + Abstand
  // zur Bestmarke). Die Zufallsauswahl bleibt — sie sorgt für die Abwechslung.
  T.push({ key:'fun_team_record', make: (rng) => {
    const rec = {}; // teamKey → {ids, best, cur}
    for(const m of matches){
      const sides = [[m.a1,m.a2,m.winner==='A'],[m.b1,m.b2,m.winner==='B']];
      for(const [x,y,won] of sides){
        if(!x || !y) continue;
        const ids = [x,y].sort(), k = ids.join('|');
        if(!rec[k]) rec[k] = {ids, best:0, cur:0};
        rec[k].cur = won ? rec[k].cur + 1 : 0;
        if(rec[k].cur > rec[k].best) rec[k].best = rec[k].cur;
      }
    }
    const cands = Object.values(rec).filter(t =>
      t.best >= 3 && pm[t.ids[0]] && pm[t.ids[1]] && !pm[t.ids[0]].hidden && !pm[t.ids[1]].hidden);
    if(!cands.length) return null;
    // Bestmarke + Rang aus derselben Liste — keine zweite Berechnung.
    const ranked = cands.slice().sort((a,b) => b.best - a.best || (a.ids[0] < b.ids[0] ? -1 : 1));
    const topBest = ranked[0].best;
    const t = cands[Math.floor(rng()*cands.length)];
    const rank = ranked.findIndex(x => x.ids[0] === t.ids[0] && x.ids[1] === t.ids[1]) + 1;
    const isRecord = t.best === topBest;
    const nm = `${nameOf(t.ids[0])} & ${nameOf(t.ids[1])}`;
    return { cat:'team', ic:'unstoppable', prio:isRecord ? 5 : 4,
      title: isRecord ? `Rekord-Duo: ${nm}` : `Eingespielt: ${nm}`,
      desc: isRecord
        ? `${t.best} gemeinsame Siege in Serie — kein Duo der Liga war je länger unschlagbar.`
        : `${t.best} gemeinsame Siege in Serie — Platz ${rank} von ${ranked.length} Duos, ${topBest - t.best} hinter der Bestmarke.`,
      vv: t.best, vl:'in Serie',
      dataRef:{ ambientPids:[t.ids[0], t.ids[1]], pairKind:'team' } };
  }});

  // ══ Zeitbasierte Form-Fakten (v9.13) — Momentaufnahme der letzten 14 Tage ══
  // Diese Typen leben von der aktuellen Form: das Fenster rollt täglich weiter,
  // die Bestenlisten ändern sich also von allein und bringen Abwechslung — ein
  // Mittelfeldspieler kann kurzfristig heiß laufen, auch wenn seine Karriere-Werte
  // unauffällig sind. Alle teilen recentAgg() (eine einzige Schleife, s.o.) und
  // greifen auf bereits vorhandene Konventionen zurück (Positionen atk/def,
  // enge Spiele Tordiff ≤ 2 = wie Clutch-Award, 1-Tor-Sieg = Zittersieg).

  // ── Beste Siegquote der letzten 14 Tage ──
  T.push({ key:'form_best_wr', make: () => {
    const { agg, count } = recentAgg();
    if(count < 6) return null;
    const elig = Object.keys(agg).filter(id => agg[id].g >= 4);
    const best = _formPick(elig, id => agg[id].w / agg[id].g);
    if(!best || best.v <= 0) return null;
    const a = agg[best.pid];
    return { cat:'personal', ic:'trendUp', prio:5,
      title:`${nameOf(best.pid)} ist in Topform`,
      desc:`Beste Siegquote der letzten 14 Tage: ${Math.round(best.v*100)}% aus ${a.g} Spielen.`,
      vv: Math.round(best.v*100)+'%', vl:'14 Tage',
      dataRef:{ ambientPid: best.pid } };
  }});

  // ── Aktuell bester Stürmer (Ø Tore + Siegquote im Sturm, letzte 14 Tage) ──
  T.push({ key:'form_striker', make: () => {
    const { agg, count } = recentAgg();
    if(count < 6) return null;
    const elig = Object.keys(agg).filter(id => agg[id].aG >= 3);
    const best = _formPick(elig, id => agg[id].aGoals / agg[id].aG);
    if(!best || best.v <= 0) return null;
    const a = agg[best.pid];
    const wrAtk = Math.round(a.aW / a.aG * 100);
    return { cat:'personal', ic:'bolt', prio:5,
      title:`${nameOf(best.pid)} ist der Sturm-Chef`,
      desc:`Bester Stürmer der letzten 14 Tage: Ø ${best.v.toFixed(1)} Tore und ${wrAtk}% Siege im Sturm.`,
      vv: best.v.toFixed(1), vl:'Ø Tore',
      dataRef:{ ambientPid: best.pid } };
  }});

  // ── Aktuell bester Abwehrspieler (wenigste Gegentore als Abwehr, 14 Tage) ──
  T.push({ key:'form_defender', make: () => {
    const { agg, count } = recentAgg();
    if(count < 6) return null;
    const elig = Object.keys(agg).filter(id => agg[id].dG >= 3);
    // Wenigste Gegentore/Spiel = am besten → Negativ-Metrik maximieren.
    const best = _formPick(elig, id => -(agg[id].dGa / agg[id].dG));
    if(!best) return null;
    const a = agg[best.pid];
    return { cat:'personal', ic:'shieldCheck', prio:5,
      title:`${nameOf(best.pid)} macht die Bude dicht`,
      desc:`Bester Abwehrspieler der letzten 14 Tage: nur Ø ${(a.dGa/a.dG).toFixed(1)} Gegentore in ${a.dG} Abwehr-Spielen.`,
      vv: (a.dGa/a.dG).toFixed(1), vl:'Ø Gegentore',
      dataRef:{ ambientPid: best.pid } };
  }});

  // ── Clutch: höchste Siegquote in engen Spielen (Tordiff ≤ 2, 14 Tage) ──
  T.push({ key:'form_clutch', make: () => {
    const { agg, count } = recentAgg();
    if(count < 6) return null;
    const elig = Object.keys(agg).filter(id => agg[id].cg >= 3);
    const best = _formPick(elig, id => agg[id].cw / agg[id].cg);
    if(!best || best.v <= 0) return null;
    const a = agg[best.pid];
    return { cat:'personal', ic:'target', prio:5,
      title:`${nameOf(best.pid)} hat Nerven aus Stahl`,
      desc:`Gewinnt aktuell ${Math.round(best.v*100)}% der engen Spiele (Tordiff ≤ 2) — ${a.cw} von ${a.cg} in 14 Tagen.`,
      vv: Math.round(best.v*100)+'%', vl:'eng gewonnen',
      dataRef:{ ambientPid: best.pid } };
  }});

  // ── Knappe Siege: höchster Anteil 1-Tor-Siege an allen Spielen (14 Tage) ──
  T.push({ key:'form_close_wins', make: () => {
    const { agg, count } = recentAgg();
    if(count < 6) return null;
    const elig = Object.keys(agg).filter(id => agg[id].g >= 4 && agg[id].c1w >= 2);
    const best = _formPick(elig, id => agg[id].c1w / agg[id].g);
    if(!best || best.v <= 0) return null;
    const a = agg[best.pid];
    return { cat:'personal', ic:'nerves', prio:4,
      title:`${nameOf(best.pid)} zittert sich durch`,
      desc:`${Math.round(best.v*100)}% seiner Spiele der letzten 14 Tage waren 1-Tor-Siege — ${a.c1w} Zittersiege.`,
      vv: a.c1w, vl:'Zittersiege',
      dataRef:{ ambientPid: best.pid } };
  }});

  // ── Aktivster Spieler der letzten 14 Tage ──
  T.push({ key:'form_most_active', make: () => {
    const { agg, count } = recentAgg();
    if(count < 8) return null;
    const best = _formPick(Object.keys(agg), id => agg[id].g);
    if(!best || best.v < 4) return null;
    return { cat:'personal', ic:'medalTrio', prio:3,
      title:`${nameOf(best.pid)} gibt Vollgas`,
      desc:`Aktivster Spieler der letzten 14 Tage: ${best.v} Partien in zwei Wochen.`,
      vv: best.v, vl:'Spiele',
      dataRef:{ ambientPid: best.pid } };
  }});

  // ══ Award-Fokus (v9.17) ═══════════════════════════════════════════════
  // Wunsch: die Top-1-Spieler der Auszeichnungen sollen in den 10-und-19-Uhr-
  // News deutlich öfter vorkommen. Diese Typen sind darum höher gewichtet
  // (weight 2) — der Spieler-Cooldown (AMBIENT_PLAYER_COOLDOWN_DAYS) sorgt
  // weiterhin dafür, dass nicht tagelang derselbe Kopf gefeiert wird.
  //
  // WICHTIG: Alle Zahlen kommen aus den BESTEHENDEN Zählern (countDayWins,
  // countPeriodWins, getCachedBadges/rarityOf) — exakt die Werte, die auch im
  // Spielerprofil und im Auszeichnungen-Sheet stehen. Keine zweite Berechnung,
  // also auch keine Abweichung.

  // Kleiner Helfer: Rangliste über einen Award-Zähler, absteigend, Gleichstand
  // deterministisch nach pid. Liefert [{pid, v}] ohne Nullwerte.
  const _awardRank = (pids, val) => pids
    .map(pid => ({ pid, v: val(pid) || 0 }))
    .filter(x => x.v > 0)
    .sort((a, b) => b.v - a.v || (a.pid < b.pid ? -1 : 1));
  // Bei Gleichstand an der Spitze darf kein Einzelner als Bestwert-Halter
  // ausgerufen werden („Bestwert, X folgt mit 3" bei 3:3 liest sich falsch).
  // Liefert alle Spieler mit dem Höchstwert.
  const _awardLeaders = rank => rank.filter(x => x.v === rank[0].v);
  const _namesOf = arr => arr.length <= 1 ? nameOf(arr[0].pid)
    : arr.slice(0, -1).map(x => nameOf(x.pid)).join(', ') + ' & ' + nameOf(arr[arr.length-1].pid);

  // ── Award: meiste „Spieler des Tages"-Titel ──
  T.push({ key:'award_potd_leader', weight:2, make: () => {
    if(typeof countDayWins !== 'function') return null;
    const rank = _awardRank(activePids, pid => countDayWins(pid, matches));
    if(!rank.length) return null;
    const lead = _awardLeaders(rank), top = rank[0], nxt = rank[lead.length];
    if(lead.length > 1){
      return { cat:'badge', ic:'trophyDay', prio:5,
        title:`Kopf-an-Kopf um die Tagessiege`,
        desc:`${_namesOf(lead)} stehen gleichauf bei je ${top.v}× Spieler des Tages.`,
        vv: top.v + '×', vl:'Tagessiege',
        dataRef:{ ambientPids: lead.slice(0,2).map(x=>x.pid), pairKind:'duel' } };
    }
    return { cat:'badge', ic:'trophyDay', prio:5,
      title:`${nameOf(top.pid)} ist der Tageskönig`,
      desc: nxt
        ? `${top.v}× Spieler des Tages — mehr als alle anderen, ${nxt.v}× hat ${nameOf(nxt.pid)}.`
        : `${top.v}× Spieler des Tages — bislang der Einzige mit diesem Titel.`,
      vv: top.v + '×', vl:'Tagessiege',
      dataRef:{ ambientPid: top.pid } };
  }});

  // ── Award: meiste „Spieler der Woche"-Titel ──
  T.push({ key:'award_potw_leader', weight:2, make: () => {
    if(typeof countPeriodWins !== 'function') return null;
    const rank = _awardRank(activePids, pid => countPeriodWins(pid, matches, 'week'));
    if(!rank.length) return null;
    const lead = _awardLeaders(rank), top = rank[0], nxt = rank[lead.length];
    if(lead.length > 1){
      return { cat:'badge', ic:'weekKing', prio:5,
        title:`Geteilte Macht über die Wochen`,
        desc:`${_namesOf(lead)} liegen gleichauf: je ${top.v}× Spieler der Woche.`,
        vv: top.v + '×', vl:'Wochensiege',
        dataRef:{ ambientPids: lead.slice(0,2).map(x=>x.pid), pairKind:'duel' } };
    }
    return { cat:'badge', ic:'weekKing', prio:5,
      title:`${nameOf(top.pid)} beherrscht die Wochen`,
      desc: nxt
        ? `${top.v}× Spieler der Woche — Bestwert der Liga, ${nameOf(nxt.pid)} folgt mit ${nxt.v}.`
        : `${top.v}× Spieler der Woche — bisher hat das sonst niemand geschafft.`,
      vv: top.v + '×', vl:'Wochensiege',
      dataRef:{ ambientPid: top.pid } };
  }});

  // ── Award: meiste goldene Auszeichnungen ──
  T.push({ key:'award_gold_leader', weight:2, make: () => {
    if(typeof getCachedBadges !== 'function' || typeof rarityOf !== 'function') return null;
    const goldOf = pid => getCachedBadges(pid).filter(b => rarityOf(b.id) === 'legendary').length;
    const rank = _awardRank(activePids, goldOf);
    if(!rank.length) return null;
    const lead = _awardLeaders(rank), top = rank[0];
    if(lead.length > 1){
      return { cat:'badge', ic:'trophyStar', prio:6,
        title:`Wettrüsten in Gold`,
        desc:`${_namesOf(lead)} halten je ${top.v} goldene ${top.v === 1 ? 'Auszeichnung' : 'Auszeichnungen'} — niemand hat mehr.`,
        vv: top.v, vl:'Gold',
        dataRef:{ ambientPids: lead.slice(0,2).map(x=>x.pid), pairKind:'duel' } };
    }
    const gold = getCachedBadges(top.pid).filter(b => rarityOf(b.id) === 'legendary');
    const names = gold.map(b => b.name);
    return { cat:'badge', ic:'trophyStar', prio:6,
      title:`${nameOf(top.pid)} sammelt Gold`,
      desc:`${top.v} goldene ${top.v === 1 ? 'Auszeichnung' : 'Auszeichnungen'} — ${names.join(', ')}.`,
      vv: top.v, vl:'Gold',
      dataRef:{ ambientPid: top.pid } };
  }});

  // ── Award: die zuletzt vergebene goldene Auszeichnung ──
  T.push({ key:'award_latest_gold', weight:2, make: () => {
    if(typeof getBadgeEarnedCache !== 'function' || typeof rarityOf !== 'function') return null;
    const bMap = getBadgeEarnedCache();
    // Match-Index einmal aufbauen statt pro Badge-Event über alle Matches zu
    // suchen (O(Badges × Matches) → O(Matches + Badges)).
    const byId = new Map();
    for(const mm of matches) byId.set(mm.id, mm);
    let latest = null;
    for(const mid in bMap){
      const mObj = byId.get(mid);
      if(!mObj) continue;
      const t = mts(mObj);
      for(const ev of (bMap[mid] || [])){
        if(rarityOf(ev.badge.id) !== 'legendary') continue;
        if(!pm[ev.playerId] || pm[ev.playerId].hidden) continue;
        if(!latest || t > latest.t) latest = { t, pid: ev.playerId, badge: ev.badge, mid };
      }
    }
    if(!latest) return null;
    const days = Math.floor((now.getTime() - latest.t) / 86400000);
    return { cat:'badge', ic: latest.badge.ic || 'trophyStar', prio:5,
      title:`Zuletzt in Gold: ${nameOf(latest.pid)}`,
      desc:`„${latest.badge.name}" (${latest.badge.desc}) — ${days === 0 ? 'heute' : days === 1 ? 'gestern' : 'vor ' + days + ' Tagen'} freigeschaltet.`,
      dataRef:{ ambientPid: latest.pid } };
  }});

  // ── Award: die meisten Auszeichnungen insgesamt ──
  T.push({ key:'award_total_leader', make: () => {
    if(typeof getCachedBadges !== 'function') return null;
    const rank = _awardRank(activePids, pid => getCachedBadges(pid).length);
    if(rank.length < 2) return null;
    const lead = _awardLeaders(rank), top = rank[0], nxt = rank[lead.length];
    if(lead.length > 1 || !nxt) return null; // Gleichstand → kein „hat die volle Vitrine"
    return { cat:'badge', ic:'medalTrio', prio:4,
      title:`${nameOf(top.pid)} hat die volle Vitrine`,
      desc:`${top.v} verschiedene Auszeichnungen freigeschaltet — ${nameOf(nxt.pid)} kommt auf ${nxt.v}.`,
      vv: top.v, vl:'Awards',
      dataRef:{ ambientPid: top.pid } };
  }});

  // ══ Persönliche Nuggets (v9.17) ═══════════════════════════════════════
  // Weniger Liga-Superlative, mehr Geschichten über EINEN Kopf — das ist es,
  // was einen Fun Fact persönlich macht. Alle Werte stammen aus allPlayerStats
  // bzw. der H2H-Map, beide bereits gecached.

  // ── Persönlich: Lieblingsgegner (höchste Siegquote im direkten Duell) ──
  T.push({ key:'personal_favourite_opp', weight:2, make: (rng) => {
    const map = (typeof _ensureH2HMap === 'function') ? _ensureH2HMap() : null;
    if(!map || !map.size) return null;
    const cands = [];
    for(const [k, e] of map){
      const [pa, pb] = k.split('|');
      if(!pm[pa] || !pm[pb] || pm[pa].hidden || pm[pb].hidden) continue;
      const wa = e.wins[pa]||0, wb = e.wins[pb]||0, total = wa + wb;
      if(total < 6) continue;
      if(wa >= wb && wa / total >= 0.7) cands.push({ pid: pa, opp: pb, w: wa, l: wb, total });
      if(wb >  wa && wb / total >= 0.7) cands.push({ pid: pb, opp: pa, w: wb, l: wa, total });
    }
    if(!cands.length) return null;
    const c = cands[Math.floor(rng()*cands.length)];
    return { cat:'rivalry', ic:'devilMask', prio:4,
      title:`${nameOf(c.opp)} ist ${nameOf(c.pid)}s Lieblingsgegner`,
      desc:`${c.w}:${c.l} aus ${c.total} direkten Duellen — diese Paarung geht fast immer gleich aus.`,
      vv: c.w + ':' + c.l, vl:'Duelle',
      dataRef:{ ambientPids:[c.pid, c.opp], pairKind:'duel' } };
  }});

  // ── Persönlich: Lieblings-Mate (bestes gemeinsames Team) ──
  T.push({ key:'personal_best_mate', weight:2, make: (rng) => {
    const cands = [];
    for(const pid of withStats){
      const mates = stats[pid].mates || {};
      for(const mid in mates){
        const g = mates[mid].g, w = mates[mid].w;
        if(g < 6 || !pm[mid] || pm[mid].hidden) continue;
        if(w / g < 0.65) continue;
        // Nur einmal pro Paar (kleinere pid führt), sonst doppelte Kandidaten.
        if(pid > mid) continue;
        cands.push({ pid, mate: mid, g, w, wr: w/g });
      }
    }
    if(!cands.length) return null;
    const c = cands[Math.floor(rng()*cands.length)];
    return { cat:'team', ic:'duo', prio:4,
      title:`Beste Freunde: ${nameOf(c.pid)} & ${nameOf(c.mate)}`,
      desc:`Zusammen ${c.w} von ${c.g} Spielen gewonnen — ${Math.round(c.wr*100)}% als Duo.`,
      vv: Math.round(c.wr*100) + '%', vl:'als Duo',
      dataRef:{ ambientPids:[c.pid, c.mate], pairKind:'team' } };
  }});

  // ── Persönlich: Lieblingsposition (Sturm vs. Abwehr) ──
  T.push({ key:'personal_position', weight:2, make: (rng) => {
    const elig = withStats.filter(pid => stats[pid].atkG >= 5 && stats[pid].defG >= 5);
    if(!elig.length) return null;
    const pid = elig[Math.floor(rng()*elig.length)];
    const st = stats[pid];
    const atkWr = st.atkW / st.atkG, defWr = st.defW / st.defG;
    const diff = Math.abs(atkWr - defWr);
    if(diff < 0.1) {
      return { cat:'personal', ic:'refresh', prio:3,
        title:`${nameOf(pid)} ist beidfüßig`,
        desc:`Im Sturm ${Math.round(atkWr*100)}%, in der Abwehr ${Math.round(defWr*100)}% — dem ist die Position egal.`,
        dataRef:{ ambientPid: pid } };
    }
    const strong = atkWr > defWr;
    return { cat:'personal', ic: strong ? 'bolt2' : 'shieldStar', prio:4,
      title:`${nameOf(pid)} gehört ${strong ? 'nach vorn' : 'nach hinten'}`,
      desc: strong
        ? `Im Sturm ${Math.round(atkWr*100)}% Siege (${st.atkG} Spiele), in der Abwehr nur ${Math.round(defWr*100)}%.`
        : `In der Abwehr ${Math.round(defWr*100)}% Siege (${st.defG} Spiele), im Sturm nur ${Math.round(atkWr*100)}%.`,
      vv: Math.round((strong ? atkWr : defWr)*100) + '%', vl: strong ? 'im Sturm' : 'in Abwehr',
      dataRef:{ ambientPid: pid } };
  }});

  // ── Fun Fact: häufigstes Endergebnis der Liga ──
  T.push({ key:'fun_common_score', make: () => {
    if(matches.length < 10) return null;
    const cnt = {};
    for(const m of matches){
      const hi = Math.max(m.score_a||0, m.score_b||0), lo = Math.min(m.score_a||0, m.score_b||0);
      const k = hi + ':' + lo;
      cnt[k] = (cnt[k] || 0) + 1;
    }
    let bk = null, bn = 0;
    for(const k in cnt) if(cnt[k] > bn){ bn = cnt[k]; bk = k; }
    if(!bk || bn < 3) return null;
    return { cat:'fun', ic:'duplicate', prio:3,
      title:`${bk} ist das Ergebnis der Liga`,
      desc:`${bn} von ${matches.length} Partien endeten genau so — ${Math.round(bn/matches.length*100)}% aller Spiele.`,
      vv: bk, vl:'am häufigsten' };
  }});

  // ── Saison-Titel: das Rennen um die laufende Tafel (§13, v9.18) ──────
  // Die Tafel wird erst am Monatsende vergeben. Damit der Monat trotzdem
  // Spannung hat, greift dieser Fun Fact den aktuellen Stand auf — als
  // normale Karte, NICHT als Breaking News. Der Saisonabschluss selbst
  // bleibt die einzige Breaking-Meldung des Titel-Systems.
  T.push({ key:'season_title_race', weight:2, make: () => {
    if(typeof seasonTitles !== 'function') return null;
    let T2 = null;
    try { T2 = seasonTitles(currentSeason().id); } catch(e){ return null; }
    if(!T2 || !T2.awarded.length) return null;
    const cur = T2.awarded.filter(a => pm[a.pid]);
    if(!cur.length) return null;
    // Bewusst deterministisch (kein Zufall), damit die memoisierte Story bei
    // gleichem Datenstand stabil bleibt. Den Tabellenführer muss hier niemand
    // mehr aussortieren: Platz 1 ist seit v9.18 kein Chronik-Eintrag mehr,
    // die Spitze bespielt die Saison-Endspurt-Story.
    const a = cur[0];
    const held = T2.awarded.length, open = SEASON_TITLES.length - held;
    return { cat:'season', ic:a.ic, prio:5,
      title:`${nameOf(a.pid)} führt bei „${a.name}"`,
      desc:`${a.ev} — Stand heute. ${held} von ${SEASON_TITLES.length} Chronik-Einträgen sind vergeben, ${open} noch offen.`,
      vv:held+'/'+SEASON_TITLES.length, vl:'Einträge',
      dataRef:{ ambientPid:a.pid, seasonTable:T2.sid } };
  }});

  // ── Chronik: ein Liga-Rekord im Rampenlicht (§13.4b) ────────────────
  // Chroniken ändern sich selten — deshalb genau eine ruhige Karte, keine
  // Breaking News. Der Eintrag rotiert über den Tag im Slot, damit über die
  // Wochen alle Rekorde einmal drankommen.
  T.push({ key:'chronicle_spotlight', weight:2, make: () => {
    if(typeof chronicleHolders !== 'function') return null;
    let by = null;
    try { by = chronicleHolders(); } catch(e){ return null; }
    const recs = CHRONICLES.filter(d => by[d.id] && pm[by[d.id].pid]);
    if(!recs.length) return null;
    // Deterministisch aus dem Tag gewählt: gleicher Tag → gleiche Karte.
    const day = Math.floor(now.getTime() / 86400000);
    const d = recs[day % recs.length];
    const h = by[d.id];
    return { cat:'fun', ic:d.ic, prio:4,
      title:`${h.shared ? _chronHolderNames(h) + ' halten' : nameOf(h.pid) + ' hält'} „${d.name}"`,
      desc:`${h.ev}. Bedingung: ${d.cond}. ${h.shared
        ? 'Diesen Liga-Rekord halten sie punktgleich gemeinsam.'
        : 'Diesen Liga-Rekord trägt sonst niemand.'}`,
      vv:'1', vl:'Rekordhalter',
      dataRef:{ ambientPid:h.pid, chronicle:d.id } };
  }});


  // ── Prestige & Insignium (§13.8/§13.9) ──────────────────────────────
  // Fünf Karten, die das neue System sichtbar machen. Drei schauen nach
  // vorn (10:00), zwei zurück (19:00) — die Zuordnung steht in
  // AMBIENT_SLOT_ROLLE [§11.0]. `dataRef.prestige` sagt der Karte, dass
  // sie das Insignium des Spielers als Bild zeigen soll [§11.6b].

  T.push({ key:'prestige_fuehrung', weight:2, make: () => {
    if(typeof prestigeTabelle !== 'function') return null;
    let P = null; try { P = prestigeTabelle(); } catch(e){ return null; }
    const rang = P.rang.filter(id => pm[id]);
    if(rang.length < 2) return null;
    const a = P.byPid[rang[0]], b = P.byPid[rang[1]];
    if(!a || !b || a.punkte <= 0) return null;
    const e = prestigeOf(rang[0]);
    return { cat:'highlight', ic:'trophyStar', prio:5,
      title:`${nameOf(rang[0])} führt das Prestige an`,
      desc:`${a.punkte} Punkte, ${a.punkte - b.punkte} mehr als ${nameOf(rang[1])}. `
        + `Getragen wird der ${e.insignie.name}`
        + (e.naechste ? ` — noch ${e.fehlt} bis zum ${e.naechste.name}.` : `.`),
      vv:String(a.punkte), vl:'Prestige',
      dataRef:{ ambientPid:rang[0], prestige:true } };
  }});

  T.push({ key:'prestige_schwelle', weight:2, make: () => {
    if(typeof prestigeTabelle !== 'function') return null;
    let P = null; try { P = prestigeTabelle(); } catch(e){ return null; }
    // Wer ist der nächsten Stufe am nächsten? Wer schon auf der letzten
    // steht, zählt hier nicht — für ihn gibt es die Zacken-Karte nicht.
    let best = null;
    Object.keys(P.byPid).forEach(pid => {
      if(!pm[pid]) return;
      const e = prestigeOf(pid);
      if(!e.naechste || e.punkte <= 0) return;
      if(!best || e.fehlt < best.fehlt) best = e;
    });
    if(!best) return null;
    const spanne = best.naechste.min - best.insignie.min;
    return { cat:'season', ic:'peak', prio:5,
      title:`${nameOf(best.pid)} steht kurz vor dem ${best.naechste.name}`,
      desc:`${best.punkte} Prestige — noch ${best.fehlt} Punkte, `
        + `${Math.round((1 - best.fehlt / spanne) * 100)} % der Stufe sind geschafft. `
        + `Danach wechselt der Reif um seinen Avatar die Form.`,
      vv:String(best.fehlt), vl:'fehlen',
      dataRef:{ ambientPid:best.pid, prestige:true } };
  }});

  T.push({ key:'prestige_schritt', weight:2, make: (rng) => {
    if(typeof prestigeSchritte !== 'function') return null;
    const kandidaten = activePids.filter(pid => {
      try { return prestigeSchritte(pid, 1).length > 0; } catch(e){ return false; }
    });
    if(!kandidaten.length) return null;
    const pid = kandidaten[Math.floor(rng() * kandidaten.length)] || kandidaten[0];
    const s = prestigeSchritte(pid, 1)[0];
    if(!s) return null;
    return { cat:'personal', ic:s.ic, prio:5,
      title:`${nameOf(pid)} liegt „${s.name}" am nächsten`,
      desc:`${s.txt}. Holt er ihn, bringt das ${s.gewinn} Prestige — `
        + `von allem, was für ihn offen ist, ist das der kürzeste Weg.`,
      vv:'+' + s.gewinn, vl:'Prestige',
      dataRef:{ ambientPid:pid, prestige:true } };
  }});

  T.push({ key:'insignium_stand', make: () => {
    if(typeof prestigeTabelle !== 'function' || typeof INSIGNIEN === 'undefined') return null;
    let P = null; try { P = prestigeTabelle(); } catch(e){ return null; }
    const zahl = INSIGNIEN.map(() => 0);
    let n = 0;
    Object.keys(P.byPid).forEach(pid => {
      if(!pm[pid]) return;
      zahl[prestigeOf(pid).stufe]++; n++;
    });
    if(!n) return null;
    const hoechste = zahl.reduce((acc, v, i) => v > 0 ? i : acc, 0);
    const oben = INSIGNIEN[hoechste];
    const leer = INSIGNIEN.length - 1 - hoechste;
    return { cat:'history', ic:'medalTrio', prio:4,
      title:`Die Liga trägt ${zahl.filter(v => v > 0).length} verschiedene Insignien`,
      desc: INSIGNIEN.map((s, i) => `${s.name}: ${zahl[i]}`).join(' · ')
        + `. Höchste getragene Stufe ist der ${oben.name}`
        + (leer > 0 ? `, darüber ${leer === 1 ? 'liegt noch eine Stufe' : 'liegen noch ' + leer + ' Stufen'}, die niemand erreicht hat.` : '.'),
      vv:String(n), vl:'gewertet',
      dataRef:{ ambientPids:[] } };
  }});

  T.push({ key:'titelband_stand', make: () => {
    if(typeof meisterTitel !== 'function') return null;
    const mit = activePids.map(pid => ({pid, n:meisterTitel(pid)}))
      .filter(x => x.n > 0).sort((a, b) => b.n - a.n);
    if(!mit.length) return null;
    const top = mit[0];
    const gesamt = mit.reduce((a, x) => a + x.n, 0);
    return { cat:'history', ic:'crown', prio:4,
      title:`${nameOf(top.pid)} trägt die breiteste Schwinge`,
      desc:`${top.n} Meistertitel von ${gesamt}, die die Liga bisher vergeben hat. `
        + (mit.length === 1
            ? `Sonst hat noch niemand einen Monat gewonnen — bei allen anderen steht das Titelband als leerer Umriss.`
            : `${mit.length} Spieler haben überhaupt schon einen geholt.`)
        + (top.n >= 5 ? ` Ab fünf Titeln sitzt die Krone obenauf — die hat er.` : ''),
      vv:String(top.n), vl:'Titel',
      dataRef:{ ambientPid:top.pid, prestige:true } };
  }});


  // ── Rückblicke mit festem Termin (§11.1c) ───────────────────────────
  // Woche und Monat hat der Generator schon: der gestaffelte Montags-Block
  // [§11.1] und der season_recap beim Archivieren. Was fehlte, waren die
  // beiden langen Blicke — Monatshalbzeit und Jahreswechsel. Sie hängen
  // NICHT am Losverfahren: `pflicht` belegt den Slot direkt, damit ein
  // Rückblick nie ausfällt, weil an dem Tag zufällig etwas anderes zog.

  T.push({ key:'rueckblick_halbzeit',
    pflicht: (tag, stunde) => stunde >= 15 && Number(tag.slice(8, 10)) === 15,
    make: () => {
      if(typeof seasonTitles !== 'function') return null;
      let T2 = null, sid = null;
      try { sid = currentSeason().id; T2 = seasonTitles(sid); } catch(e){ return null; }
      if(!T2) return null;
      const offen = SEASON_TITLES.length - T2.awarded.length;
      const fuehrend = T2.champ && pm[T2.champ.pid] ? T2.champ : null;
      const ohne = (T2.empty || []).filter(id => pm[id]).length;
      return { cat:'season', ic:'stopwatch', prio:6,
        title:`Halbzeit im ${seasonLabel(sid)}`,
        desc: `${T2.matches} Partien an ${T2.days} Spieltagen. `
          + (fuehrend ? `${nameOf(fuehrend.pid)} führt mit ${fuehrend.elo} Elo aus ${fuehrend.games} Spielen. ` : '')
          + `${T2.awarded.length} von ${SEASON_TITLES.length} Monatswertungen sind vergeben, ${offen} noch offen`
          + (ohne ? `, ${ohne} Spieler ${ohne === 1 ? 'trägt' : 'tragen'} noch keine.` : '.')
          + ` Die zweite Monatshälfte entscheidet.`,
        vv:String(offen), vl:'noch offen',
        dataRef:{ ambientPid: fuehrend ? fuehrend.pid : null, seasonTable:sid } };
    }});

  T.push({ key:'rueckblick_jahr',
    pflicht: (tag, stunde) => stunde >= 10 && tag.slice(5) === '01-01',
    make: () => {
      if(typeof prestigeTabelle !== 'function') return null;
      const jahr = now.getFullYear() - 1;
      const imJahr = matches.filter(m => new Date(m.created_at).getFullYear() === jahr);
      if(!imJahr.length) return null;
      const tage = new Set(imJahr.map(m => String(m.created_at).slice(0, 10))).size;
      const tore = imJahr.reduce((a, m) => a + (m.score_a || 0) + (m.score_b || 0), 0);
      let P = null; try { P = prestigeTabelle(); } catch(e){ P = null; }
      const spitze = P && P.rang.find(id => pm[id]);
      let meister = [];
      try {
        meister = (allPastSeasons() || []).filter(sid => sid.slice(0, 4) === String(jahr))
          .map(sid => seasonChampion(sid)).filter(pid => pid && pm[pid]);
      } catch(e){ /* dann eben ohne */ }
      const zaehler = {};
      meister.forEach(pid => { zaehler[pid] = (zaehler[pid] || 0) + 1; });
      const bester = Object.keys(zaehler).sort((a, b) => zaehler[b] - zaehler[a])[0];
      return { cat:'history', ic:'calendar', prio:7,
        title:`${jahr} in Zahlen`,
        desc: `${imJahr.length} Partien an ${tage} Spieltagen, ${tore} Tore. `
          + (bester ? `${nameOf(bester)} holte ${zaehler[bester]} von ${meister.length} Meistertiteln. ` : '')
          + (spitze ? `Im Prestige steht ${nameOf(spitze)} vorn — ${prestigeOf(spitze).punkte} Punkte, ${prestigeOf(spitze).insignie.name}.` : ''),
        vv:String(imJahr.length), vl:'Partien',
        dataRef:{ ambientPid: spitze || null, prestige: !!spitze } };
    }});

  return T;
}

