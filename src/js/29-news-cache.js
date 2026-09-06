// ─── §11.2 — Story-Cache (DB-basiert, v8.3) + Display-Konsolidierung ──
// Stories werden in der Supabase-Tabelle `stories` persistiert. Der
// Generator (_buildStories) läuft weiterhin clientseitig und produziert
// Story-Objekte aus Live-Daten. Die werden idempotent in die DB geschrieben
// (ON CONFLICT DO NOTHING) — erste INSERT-Zeit gewinnt also den Timestamp.
//
// Lese-Pfad ist ausschließlich aus der DB:
//   syncStoriesViaDb() läuft in loadAll → befüllt _cache._stories
//   getStoriesCache() returns _cache._stories synchron
//
// Vorteile:
//   - Story-Timestamps stabil über Geräte und App-Starts
//     ("Heute, 02:10" bleibt "Heute, 02:10", nicht "Heute, 14:30" beim Reload)
//   - Cross-Device-Konsistenz (alle Spieler sehen dieselben Stories)
//   - Historische Stories über 90 Tage erhalten (auch wenn der Generator
//     sie längst nicht mehr produzieren würde)
//
// Fallback: wenn DB-Calls fehlschlagen (Migration noch nicht eingespielt,
// Netzwerk down etc.), läuft _buildStories als rein in-memory Generator
// weiter. Die App ist somit auch OHNE Migration sofort funktional.
function getStoriesCache(){
  // v8.4: _cache._stories hält bis zu 100 Stories (DB-Load + Realtime-Reserve,
  // §11.8). v8.6: vor dem UI-Limit (NEWS_LIMITS.total) werden Match-Event-
  // Doppel zusammengefasst (_consolidateStories). Cache ist newest-first.
  const base = Array.isArray(_cache._stories) ? _cache._stories : [];
  return _consolidateStories(base).slice(0, NEWS_LIMITS.total);
}

// Gemeinsamer, gecachter Per-Spieler-Match-Index (asc). Ein Aufbau pro
// (matches, version) statt je Live-Kennzahl neu — Basis für _liveStreakForm.
function _byPlayerMatches(){
  const key = matches.length + '_' + _cache.version;
  if(_cache._byPlayerKey === key) return _cache._byPlayer;
  const byP = {};
  for(const m of matches){
    const ids = [m.a1, m.a2, m.b1, m.b2];
    for(let i = 0; i < 4; i++){ const pid = ids[i]; if(!pid) continue; (byP[pid] || (byP[pid] = [])).push(m); }
  }
  _cache._byPlayerKey = key;
  _cache._byPlayer = byP;
  return byP;
}

// v9.9: Aktuelle (LEBENDE) Sieges-/Niederlagenserie + Top-Form je Spieler in
// EINEM Pass (vorher 3 separate Funktionen mit je eigenem Index-Aufbau).
// Nötig, weil persistierte „ungeschlagen/Pechvogel/Top-Form"-Stories bis
// expires_at im Feed bleiben und sonst Spieler zeigen, deren Serie/Form längst
// gebrochen ist. Caps (Win 20, Loss 12) exakt wie die jeweiligen Generatoren.
// Rückgabe: { loss:{pid:n}, win:{pid:n}, form:{pid:siege_der_letzten_10} }.
function _liveStreakForm(){
  const key = matches.length + '_' + _cache.version;
  if(_cache._liveSFKey === key) return _cache._liveSF;
  const byP = _byPlayerMatches();
  const loss = {}, win = {}, form = {};
  for(const pid in byP){
    const arr = byP[pid];
    let w = 0; for(let i = arr.length - 1; i >= 0; i--){ if(!won(pid, arr[i])) break; w++; if(w > 20) break; }
    let l = 0; for(let i = arr.length - 1; i >= 0; i--){ if(won(pid, arr[i])) break; l++; if(l > 12) break; }
    win[pid] = w; loss[pid] = l;
    form[pid] = arr.length < 10 ? 0 : arr.slice(-10).filter(m => won(pid, m)).length;
  }
  _cache._liveSFKey = key;
  _cache._liveSF = { loss, win, form };
  return _cache._liveSF;
}

// Display-seitige Konsolidierung gegen Match-Event-Spam (v8.6).
// Bewusst beim ANZEIGEN, nicht beim Erzeugen — Gründe:
//   • Stories sind in der DB persistiert (ON CONFLICT DO NOTHING). Würde man im
//     Generator zusammenfassen, blieben bereits gespeicherte Doppel-Rows im
//     Feed. Display-seitig wirkt es auf bestehende UND neue Rows.
//   • "Welches Match ist DER Upset der Woche" ist zeitabhängig (wandert
//     wöchentlich) und darf nicht fix in die DB gebrannt werden.
// Regeln:
//   (a) Gleicher Badge, im selben Match von MEHREREN Spielern → EINE Karte
//       ("Leo & Maxi: Upset-König") statt einer pro Spieler.
//   (b) Der upset_king GENAU des Matches, das schon als "Upset der Woche"-
//       Highlight läuft → entfällt (sonst dasselbe Ereignis doppelt).
// VERSCHIEDENE Badges desselben Matches (z.B. Legende UND Upset-König) bleiben
// getrennt. Memoisiert per Eingabe-Referenz (billiger O(N)-Lauf).
function _consolidateStories(list){
  if(!Array.isArray(list)) return [];
  if(_cache._consolFrom === list && Array.isArray(_cache._consolList)) return _cache._consolList;
  const pm = (typeof pmap === 'function') ? pmap() : {};
  const nameOf = pid => (pm[pid] && pm[pid].name) || '?';
  const fmtNames = arr => arr.length <= 1 ? (arr[0] || '') : arr.slice(0, -1).join(', ') + ' & ' + arr[arr.length - 1];

  // v9.6: Veraltete „loss_streak"-Stories rausfiltern, BEVOR gruppiert/suppress-
  // iert wird. Eine Story bleibt nur, wenn die AKTUELLE Niederlagenserie des
  // Spielers die genannte Länge noch erreicht. Hat er die Serie durch einen Sieg
  // gebrochen (live=0) oder eine neue, kürzere Serie begonnen, ist die alte Story
  // stale → raus. Sonst zeigt „N Pechvögel" Spieler, die längst nicht mehr in
  // Serie verlieren (z.B. jemand mit 1-0-Bilanz als angeblicher 6er-Pechvogel).
  // v9.9: dieselbe Logik für „ungeschlagen"/win_streak. Eine persistierte
  // Sieges-Serien-Story bleibt nur, wenn die AKTUELLE Serie des Spielers die
  // genannte Länge noch erreicht. Hat er verloren (live=0) oder eine neue,
  // kürzere Serie begonnen, ist die alte Story stale → raus. Verhindert
  // „Leo ungeschlagen (5)", obwohl Leo längst wieder verloren hat.
  // v9.17: dieselbe Stale-Logik für „X Tage ohne Spiel". Die Story wird pro Pause
  // EINMAL persistiert (ID = letztes Match vor der Pause) und blieb danach für
  // immer im Feed stehen — auch wenn längst wieder gespielt wurde. Zwei alte
  // Pausen-Karten nebeneinander („6 Tage ohne Spiel", „4 Tage ohne Spiel") sind
  // dann nicht nur Spam, sondern schlicht falsch. Sie bleibt jetzt nur, solange
  // ihr Referenz-Match noch das jüngste der Liga ist.
  const _lastMatchId = matches.length ? matches[matches.length-1].id : null;
  const { loss: _liveLoss, win: _liveWin, form: _liveForm } = _liveStreakForm();
  const src = list.filter(s => {
    const d = (s && s.dataRef) || {};
    if(d.type === 'loss_streak' && d.pid) return (_liveLoss[d.pid] || 0) >= (d.streak || 0);
    if(d.type === 'win_streak' && d.pid) return (_liveWin[d.pid] || 0) >= (d.streak || 0);
    if(d.type === 'top_form' && d.pid) return (_liveForm[d.pid] || 0) >= (d.wins || 0);
    if(d.type === 'dry_spell' && d.lastMatchId) return d.lastMatchId === _lastMatchId;
    return true;
  });

  // Regel-Tabelle (v8.7): Highlights, die einen Badge inhaltlich ABDECKEN →
  // der Badge entfällt, sonst stünde dasselbe Ereignis doppelt im Feed.
  const HL_COVERS = {
    upset_match:     { badges:['upset_king'],                     by:'matchId' },
    biggest_blowout: { badges:['perfect_win'],                    by:'matchId' },
    // v9.9: streak5 ergänzt — die „ungeschlagen"-Story startet bei ≥5, deckt
    // also das 5er-Serie-Badge inhaltlich ab (sonst dieselbe Aussage doppelt:
    // „2 ungeschlagene Spieler: Leon (5)" + Badge „Leon: 5er Serie").
    win_streak:      { badges:['streak5','streak10','streak15','streak20'], by:'pid' },
    // v9.5: die „Losing Streak"-Badge (losing5) beschreibt exakt dasselbe
    // Ereignis wie die individuelle Niederlagenserie-Story (5 Pleiten in Folge)
    // → Badge entfällt, die reichere „Pechvögel"-Story bleibt.
    loss_streak:     { badges:['losing5'],                        by:'pid'     },
  };
  const suppressMatch = new Set();  // 'badgeId|matchId'
  const suppressPlayer = new Set(); // 'badgeId|playerId'
  // v9.4: Paare, die schon eine „N. Aufeinandertreffen"-Meilenstein-Story haben
  // → die allgemeine „rivalry"-Story (gleiche Paarung) entfällt (sonst doppelt).
  const rivalryMsPairs = new Set();
  const giantSlayerMatches = new Set(); // matchIds mit Giant-Slayer-Breaking
  // v9.5: Spieler mit laufender „Siege in Folge"-Story → deren Top-Form-Story
  // (≥8/10) beschreibt dieselbe heiße Phase und entfällt (kein Doppel).
  const winStreakPids = new Set();
  for(const s of src){
    const d = s.dataRef || {};
    if(d.type === 'rivalry_milestone' && d.a && d.b) rivalryMsPairs.add([d.a, d.b].sort().join('|'));
    if(d.type === 'giant_slayer' && d.matchId) giantSlayerMatches.add(d.matchId);
    if(d.type === 'win_streak' && d.pid) winStreakPids.add(d.pid);
    const rule = HL_COVERS[d.type];
    if(!rule) continue;
    const keyVal = rule.by === 'matchId' ? d.matchId : d.pid;
    if(!keyVal) continue;
    for(const b of rule.badges){
      (rule.by === 'matchId' ? suppressMatch : suppressPlayer).add(b + '|' + keyVal);
    }
  }

  // Gruppierbare Typen (v8.8): mehrere gleichartige Per-Spieler-Stories werden
  // zu EINER Karte zusammengefasst ("3 Pechvögel: Maxi, Alex & Tom") statt
  // einzeln den Feed zu fluten. frag() liefert den Pro-Spieler-Schnipsel.
  const GROUPABLE = {
    loss_streak:     { label:'Pechvögel',           ic:'dropDouble', frag:s=>`${nameOf(s.dataRef.pid)} (${s.dataRef.streak})`, desc:f=>`Niederlagen in Folge: ${f}. Wer dreht es zuerst?` },
    top_form:        { label:'Spieler in Top-Form', ic:'flame',      frag:s=>`${nameOf(s.dataRef.pid)} (${s.dataRef.wins}/10)`, desc:f=>`Überragende letzte 10 Spiele: ${f}.` },
    win_streak:      { label:'ungeschlagene Spieler', ic:'flame',    frag:s=>`${nameOf(s.dataRef.pid)} (${s.dataRef.streak})`, desc:f=>`Siege in Folge: ${f}.` },
    jubilee:         { label:'Jubiläen',            ic:'calendar',   frag:s=>`${nameOf(s.dataRef.pid)} (${s.dataRef.total}.)`, desc:f=>`Spiele-Meilensteine: ${f}.` },
    milestone_wins:  { label:'Sieg-Meilensteine',   ic:'medalTrio',  frag:s=>`${nameOf(s.dataRef.pid)} (${s.dataRef.milestone})`, desc:f=>`Glückwunsch: ${f}.` },
    milestone_goals: { label:'Tor-Meilensteine',    ic:'thriller',   frag:s=>`${nameOf(s.dataRef.pid)} (${s.dataRef.milestone})`, desc:f=>`Glückwunsch: ${f}.` },
    milestone_elo:   { label:'Elo-Meilensteine',    ic:'peak',       frag:s=>`${nameOf(s.dataRef.pid)} (${s.dataRef.milestone})`, desc:f=>`Neue Bestwerte: ${f}.` },
  };

  const badgeGroups = new Map();
  const typeGroups = new Map();
  const slots = [];
  // v9.12: Exakte Inhalts-Doubletten (gleicher Titel + Text) nur EINMAL zeigen.
  // Grund: Ambiente Fun Facts werden pro Slot (10:00/19:00) tageweise persistiert;
  // greift der Typ-Cooldown bei kaltem _cache._stories nicht (Generator läuft in
  // syncStoriesViaDb vor dem DB-Load), landet derselbe Fun Fact an mehreren
  // Slots/Tagen mit IDENTISCHEM Inhalt (z.B. „Leon thront an der Spitze", solange
  // die Elo gleich bleibt). Da Stories persistiert sind, hilft nur Display-seitige
  // Deduplizierung — sie wirkt auf bestehende UND neue Rows. list ist newest-first
  // → die JÜNGSTE Karte bleibt, ältere inhaltsgleiche entfallen. Gilt für
  // ungruppierte Stories (Gruppen dedupen bereits per Spieler/Match).
  const seenContent = new Set();
  for(const s of src){
    const d = s.dataRef || {};
    // v9.4: allgemeine Rivalitäts-Story entfällt, wenn dasselbe Paar bereits
    // eine (spezifischere) Meilenstein-Story hat.
    if(d.type === 'rivalry' && d.a && d.b && rivalryMsPairs.has([d.a, d.b].sort().join('|'))) continue;
    // v9.4: „Upset der Woche" entfällt, wenn dasselbe Match schon als
    // (stärkeres) Giant-Slayer-Breaking läuft.
    if(d.type === 'upset_match' && d.matchId && giantSlayerMatches.has(d.matchId)) continue;
    // v9.5: Top-Form-Story entfällt für Spieler, die ohnehin schon eine
    // (konkretere) „Siege in Folge"-Story haben — sonst steht dieselbe heiße
    // Phase doppelt im Feed.
    if(d.type === 'top_form' && d.pid && winStreakPids.has(d.pid)) continue;
    if(d.type === 'badge_unlocked' && d.badgeId){
      if(d.matchId && suppressMatch.has(d.badgeId + '|' + d.matchId)) continue;
      if(d.playerId && suppressPlayer.has(d.badgeId + '|' + d.playerId)) continue;
      const gk = d.badgeId + '|' + (d.matchId || '');
      let g = badgeGroups.get(gk);
      if(!g){ g = { rep: s, pids: [], seen: new Set() }; badgeGroups.set(gk, g); slots.push({ b: gk }); }
      if(!g.seen.has(d.playerId)){ g.seen.add(d.playerId); g.pids.push(d.playerId); }
    } else if(GROUPABLE[d.type] && d.pid){
      let g = typeGroups.get(d.type);
      if(!g){ g = { rep: s, members: [], seen: new Set() }; typeGroups.set(d.type, g); slots.push({ t: d.type }); }
      // v9.4: pro Spieler nur EINMAL (list ist newest-first → jüngster Stand
      // bleibt). Verhindert Duplikate wie „Maxi, Maxi, Alex … Alex".
      if(!g.seen.has(d.pid)){ g.seen.add(d.pid); g.members.push(s); }
    } else {
      const ck = (s.title || '') + '\u0000' + (s.desc || '');
      if(seenContent.has(ck)) continue;   // inhaltsgleiche Doublette → überspringen
      seenContent.add(ck);
      slots.push({ s });
    }
  }

  const result = [];
  for(const slot of slots){
    if(slot.s){ result.push(slot.s); continue; }
    if(slot.b){
      const g = badgeGroups.get(slot.b);
      if(g.pids.length <= 1){ result.push(g.rep); continue; }
      const rep = g.rep, d = rep.dataRef || {};
      const names = g.pids.map(nameOf).sort((a, b) => a.localeCompare(b, 'de'));
      const bn = d.badgeName || (rep.title.includes(': ') ? rep.title.split(': ').slice(1).join(': ') : 'Badge');
      result.push(Object.assign({}, rep, {
        id: 'badgegrp_' + d.badgeId + '_' + (d.matchId || ''),
        title: `${fmtNames(names)}: ${bn}`,
        dataRef: Object.assign({}, d, { playerIds: g.pids })
      }));
      continue;
    }
    if(slot.t){
      const g = typeGroups.get(slot.t);
      if(g.members.length <= 1){ result.push(g.rep); continue; } // Einzel: Original unverändert
      const cfg = GROUPABLE[slot.t], rep = g.rep;
      const members = g.members.slice().sort((a, b) => (b.prio||0) - (a.prio||0));
      const pids = members.map(m => (m.dataRef||{}).pid).filter(Boolean);
      const names = pids.map(nameOf);
      const frags = members.map(m => cfg.frag(m));
      const when = members.reduce((mx, m) => (m.when > mx ? m.when : mx), members[0].when);
      const prio = members.reduce((mx, m) => ((m.prio||0) > mx ? (m.prio||0) : mx), 0);
      result.push({
        id: 'grp_' + slot.t + '_' + pids.slice().sort().join('-'),
        cat: rep.cat,
        ic: cfg.ic || rep.ic,
        title: `${members.length} ${cfg.label}: ${fmtNames(names)}`,
        desc: cfg.desc(frags.join(', ')),
        when, prio,
        dataRef: { type:'group', sub: slot.t, playerIds: pids, frags }
      });
      continue;
    }
  }
  // ── Die dritte Kachel derselben Sorte erzählt nichts mehr ──────────
  // Drei „X & Y kommen als Team nicht in Tritt" untereinander sind keine
  // drei Nachrichten, sondern eine Nachricht und zwei Wiederholungen. Der
  // Feed behält je Sorte die zwei jüngsten; was darunter liegt, hat die
  // Liga schon zweimal gelesen.
  //
  // Ausgenommen sind die seltenen Ereignisse: einen zweiten Elo-Rekord in
  // derselben Woche zu unterschlagen wäre genau der Fehler, den die Regel
  // verhindern soll. Und `ambient`/`group` sind ohnehin je Slot einzeln.
  const OHNE_DECKEL = new Set(['lead_change','elo_record','streak_record',
                               'season_recap','season_endgame','ambient','group']);
  const NF_DECKEL = 2;
  const gezaehlt = {};
  const entdoppelt = result.filter(s => {
    const t = (s && s.dataRef && s.dataRef.type) || '';
    if(!t || OHNE_DECKEL.has(t)) return true;
    gezaehlt[t] = (gezaehlt[t] || 0) + 1;
    return gezaehlt[t] <= NF_DECKEL;
  });
  // ── Nichts steht zweimal direkt untereinander ──────────────────────
  // Zwei Rivalitäten, zwei „Serie gerissen", zwei Team-Karten in Folge lesen
  // sich als eine Karte mit einem Tippfehler. Getauscht wird nur mit dem
  // NÄCHSTEN Nachbarn und nur, wenn der eine andere Sorte hat — der Feed
  // bleibt damit chronologisch, die Wiederholung steht bloß eine Position
  // später. Ein Umsortieren über mehrere Plätze hinweg wäre keine
  // Auflockerung mehr, sondern eine andere Reihenfolge.
  const entzerrt = entdoppelt.slice();
  const sorteVon = s => (s && s.dataRef && s.dataRef.type) || '';
  for(let i = 1; i < entzerrt.length - 1; i++){
    if(sorteVon(entzerrt[i]) !== sorteVon(entzerrt[i-1])) continue;
    if(sorteVon(entzerrt[i+1]) === sorteVon(entzerrt[i])) continue;
    const t = entzerrt[i]; entzerrt[i] = entzerrt[i+1]; entzerrt[i+1] = t;
  }

  // ── Jeder soll vorkommen können ────────────────────────────────────
  // Der Generator deckelt schon, wie oft jemand HAUPTFIGUR ist [§11.1] — er
  // zählt aber nur `pid`. Wer als Partner, Gegner oder Serienbrecher genannt
  // wird, taucht daneben beliebig oft auf: gemessen stand Maxi auf neun der
  // einunddreißig Karten, Anton auf einer. Gezählt wird deshalb JEDES
  // Gesicht; wer über dem Deckel liegt, rutscht nach hinten statt zu
  // verschwinden — gelöscht wäre die Nachricht weg, verschoben ist sie nur
  // später dran.
  const NF_GESICHT_DECKEL = 4;
  const gesicht = {};
  const vorn = [], hinten = [];
  entzerrt.forEach(s => {
    let ids = [];
    try { ids = (typeof _newsPids === 'function') ? _newsPids(s) : []; } catch(e){ ids = []; }
    const zuOft = ids.length && ids.every(id => (gesicht[id] || 0) >= NF_GESICHT_DECKEL);
    ids.forEach(id => { gesicht[id] = (gesicht[id] || 0) + 1; });
    (zuOft ? hinten : vorn).push(s);
  });
  const fertig = vorn.concat(hinten);
  _cache._consolFrom = list;
  _cache._consolList = fertig;
  return fertig;
}

// Wird in loadAll() aufgerufen. Generator → DB-Upsert → DB-Read → Cache.
// Vollständig in try/catch gewrappt — Failures degradieren auf Fallback.
async function syncStoriesViaDb(){
  let generated = [];
  try { generated = _buildStories() || []; }
  catch(e){ if(NEWS_DEBUG || window.NEWS_DEBUG) console.warn('[news] generator failed', e); }

  // Versuch 1: DB-Pfad
  try {
    await _cleanupExpiredStoriesInDb();        // 1× pro Sync, idempotent
    await _uploadNewStoriesToDb(generated);    // INSERT ON CONFLICT DO NOTHING
    const fromDb = await _loadStoriesFromDb(); // SELECT die letzten 100
    if(Array.isArray(fromDb)){
      _cache._stories = fromDb;
      _ensureStoriesRealtime(); // v8.4: Realtime erst nach erstem erfolgreichen DB-Sync
      _startNewsAutoSync();     // v8.5: ambiente Tages-Stories ohne Reload erscheinen lassen
      return;
    }
  } catch(e){
    // Migration evtl. noch nicht eingespielt → Tabelle fehlt → 42P01
    // oder Netzfehler. Defensiv: in-memory Fallback nutzen, App bleibt nutzbar.
    if(NEWS_DEBUG || window.NEWS_DEBUG) console.warn('[news] DB sync failed, falling back to in-memory', e?.message || e);
  }

  // Versuch 2: in-memory Fallback (alter Zustand)
  _cache._stories = generated;
}
window.syncStoriesViaDb = syncStoriesViaDb;

// ── DB-Helper ──
// Storage-Form ⇄ Runtime-Form Konversion. Story-Objekte des Generators
// haben `when` als Date; in der DB lebt das als `event_at` TIMESTAMPTZ.
function _storyToRow(s){
  return {
    id:          s.id,
    type:        (s.dataRef && s.dataRef.type) || s.id.split('_')[0] || 'unknown',
    category:    s.cat,
    icon:        s.ic || null,
    title:       s.title,
    description: s.desc,
    data_ref:    s.dataRef || {},
    priority:    s.prio | 0,
    event_at:    (s.when instanceof Date ? s.when : new Date(s.when)).toISOString(),
  };
}
function _rowToStory(r){
  return {
    id:       r.id,
    cat:      r.category,
    ic:       r.icon || undefined,
    title:    r.title,
    desc:     r.description,
    dataRef:  r.data_ref || {},
    prio:     r.priority | 0,
    when:     new Date(r.event_at),
  };
}

// Batch-INSERT mit ON CONFLICT DO NOTHING. PostgREST/Supabase macht das per
// `upsert(...,{ignoreDuplicates:true})` — der spannende Teil ist: WIR verändern
// vorhandene Zeilen nicht (kein UPDATE), damit `event_at`/`created_at` der
// ersten Generation erhalten bleiben.
async function _uploadNewStoriesToDb(stories){
  if(!stories || !stories.length) return;
  const rows = stories.map(_storyToRow);
  // In Batches → schützt vor Payload-Limits bei großen Datensätzen. (v8.4)
  // Realistisch sind ~30 Stories pro Sync → ein einziger Batch. 200 deckt auch
  // den Erststart nach langer Pause ab (Postgres erlaubt 1000+ Rows/INSERT).
  const BATCH_SIZE = 200;
  for(let i = 0; i < rows.length; i += BATCH_SIZE){
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const { error } = await sb.from('stories').upsert(chunk, {
      onConflict: 'id',
      ignoreDuplicates: true,
    });
    if(error) throw error;
  }
}

// Read: neueste 100 nicht-abgelaufene Stories, sortiert nach event_at desc.
// Die Anzeige-Limits (NEWS_LIMITS.total = 50) werden weiterhin im UI greifen.
async function _loadStoriesFromDb(){
  const { data, error } = await sb.from('stories')
    .select('*')
    .gt('expires_at', new Date().toISOString())
    .order('event_at', { ascending: false })
    .limit(100);
  if(error) throw error;
  return (data || []).map(_rowToStory);
}

// Cleanup: löscht alle abgelaufenen Stories. Idempotent, 1× pro Sync.
// Die RLS-Policy "stories_delete_old" erlaubt nur DELETE WHERE expires_at < NOW().
async function _cleanupExpiredStoriesInDb(){
  const { error } = await sb.from('stories')
    .delete()
    .lt('expires_at', new Date().toISOString());
  if(error){
    // 42P01 = Tabelle existiert nicht → Migration nicht eingespielt
    // → bubblen, syncStoriesViaDb fällt auf in-memory zurück
    throw error;
  }
}

// ─── §11.8 — Realtime-Subscription auf `stories` (v8.4) ──────────────
// Wenn ein ANDERES Gerät neue Stories inserted (via syncStoriesViaDb auf der
// Gegenstelle), bekommt dieses Gerät das ohne App-Reload mit. Der Channel wird
// EINMAL beim ersten erfolgreichen DB-Sync aufgebaut und danach
// wiederverwendet — loadAll re-subscribed NICHT (Guard über _storiesChannel).
//
// VORAUSSETZUNG (Dashboard, einmalig): Replication muss für `stories` aktiv
// sein — Database → Replication → supabase_realtime → stories. Ist sie NICHT
// aktiv, liefert subscribe() trotzdem 'SUBSCRIBED', es kommen aber keine
// Events. Das ist clientseitig nicht erkennbar → hier nur dokumentiert.
//
// Graceful degradation: schlägt der Channel fehl (CHANNEL_ERROR/TIMED_OUT),
// läuft die App mit dem bestehenden loadAll-basierten Sync normal weiter —
// kein UI-Block, nur console.warn (hinter NEWS_DEBUG).
let _storiesChannel = null;

function _ensureStoriesRealtime(){
  if(_storiesChannel) return;                       // bereits abonniert
  if(typeof sb === 'undefined' || !sb || !sb.channel) return;
  try {
    // Sofort referenzieren → verhindert doppeltes subscribe bei zwei schnell
    // aufeinanderfolgenden loadAll, bevor der async subscribe-Callback feuert.
    _storiesChannel = sb.channel('stories_changes')
      .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'stories' },
          (payload) => { try { _onStoryRealtimeInsert(payload.new); }
                         catch(e){ if(NEWS_DEBUG || window.NEWS_DEBUG) console.warn('[news] realtime insert failed', e); } })
      .on('postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'stories' },
          (payload) => { try { _onStoryRealtimeDelete(payload.old); }
                         catch(e){ if(NEWS_DEBUG || window.NEWS_DEBUG) console.warn('[news] realtime delete failed', e); } })
      .subscribe((status) => {
        if(NEWS_DEBUG || window.NEWS_DEBUG) console.log('[news] realtime status:', status);
        if(status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED'){
          // Channel verwerfen → ein späterer syncStoriesViaDb darf neu versuchen.
          if(NEWS_DEBUG || window.NEWS_DEBUG) console.warn('[news] realtime inactive ('+status+') — loadAll-Sync bleibt aktiv');
          _storiesChannel = null;
        }
      });
  } catch(e){
    if(NEWS_DEBUG || window.NEWS_DEBUG) console.warn('[news] realtime subscribe failed', e);
    _storiesChannel = null;
  }
}

// INSERT: neue Story eines anderen Geräts in den Memory-Cache übernehmen.
function _onStoryRealtimeInsert(row){
  if(!row || !row.id) return;
  if(!Array.isArray(_cache._stories)) _cache._stories = [];
  // Eigener Insert / Duplikat → ignorieren.
  if(_cache._stories.some(s => s.id === row.id)) return;
  const story = _rowToStory(row);
  // Einsortieren (newest-first nach event_at) + auf 100 kürzen (Reserve, §11.2).
  // NEUE Array-Referenz → Konsolidierungs-Memo (§11.2) bricht sauber.
  const next = _cache._stories.concat([story]);
  next.sort((a, b) => b.when - a.when);
  _cache._stories = next.slice(0, 100);
  // Badge + Toast + offene Views aktualisieren (Story-Detail #ndBg bleibt unberührt).
  _refreshOpenNewsViews();
}

// DELETE: abgelaufene/gelöschte Story aus dem Memory-Cache entfernen.
function _onStoryRealtimeDelete(row){
  if(!row || !row.id) return;
  if(!Array.isArray(_cache._stories)) return;
  const before = _cache._stories.length;
  _cache._stories = _cache._stories.filter(s => s.id !== row.id);
  if(_cache._stories.length === before) return; // war nicht im Cache → nichts tun
  // Feed re-rendern (Karte verschwindet). Badge NICHT anfassen — newsBadgeRefresh
  // zählt beim nächsten Lauf ohnehin nur noch vorhandene Stories.
  try { if(_isNewsFeedOpen()) _renderNewsFeed(); } catch(e){}
}

// Offen-Zustände (DOM): Feed lebt im #sheet (enthält .nv-list-flat), Mini-Popup
// im #nvBg (Klasse 'show'). Story-Detail (#ndBg) wird bewusst nicht live verändert.
function _isNewsFeedOpen(){
  const sheet = document.getElementById('sheet');
  return !!(sheet && sheet.classList.contains('show') && sheet.querySelector('.nv-list-flat'));
}
function _isNewsPopoverOpen(){
  const bg = document.getElementById('nvBg');
  return !!(bg && bg.classList.contains('show'));
}

// Cleanup beim App-Close: sauberer Realtime-Disconnect.
window.addEventListener('beforeunload', () => {
  try { if(_storiesChannel) _storiesChannel.unsubscribe(); } catch(e){}
});

// Offene News-Views konsistent aktualisieren (Badge/Toast + Feed + Mini-Popup).
// Story-Detail (#ndBg) wird bewusst NICHT angefasst (User liest gerade etwas).
function _refreshOpenNewsViews(){
  try { if(typeof newsBadgeRefresh === 'function') newsBadgeRefresh(); } catch(e){}
  try { if(_isNewsFeedOpen()) _renderNewsFeed(); } catch(e){}
  try { if(_isNewsPopoverOpen()) openNewsPopover(); } catch(e){}
}

// ─── §11.9 — Periodischer News-Auto-Sync (v8.5) ──────────────────────
// Lässt ambiente Fun-Fact-Stories (§11.1b) OHNE Reload erscheinen: alle paar
// Minuten neu synchronisieren. Pausiert bei verstecktem Tab (spart Requests)
// und holt beim Wieder-Sichtbarwerden sofort nach (verpasster 19-Uhr-Slot).
// Spamfrei: Inserts sind tages-deterministisch (ON CONFLICT) → max. 1 neue
// Ambient-Row alle 2 Tage, egal wie oft der Tick läuft.
let _newsAutoSyncTimer = null;
let _newsAutoSyncRunning = false;
async function _newsAutoSyncTick(){
  if(_newsAutoSyncRunning) return;                       // kein Overlap
  if(typeof document !== 'undefined' && document.hidden) return; // Tab im Hintergrund
  if(typeof syncStoriesViaDb !== 'function') return;
  _newsAutoSyncRunning = true;
  try {
    await syncStoriesViaDb();   // Generator (memo) → ggf. neuer Slot → Upload → Reload
    _refreshOpenNewsViews();
  } catch(e){ if(NEWS_DEBUG || window.NEWS_DEBUG) console.warn('[news] auto-sync failed', e); }
  finally { _newsAutoSyncRunning = false; }
}
function _startNewsAutoSync(){
  if(_newsAutoSyncTimer) return;                         // nur einmal starten
  if(typeof setInterval !== 'function') return;
  _newsAutoSyncTimer = setInterval(_newsAutoSyncTick, NEWS_AUTOSYNC_MS);
  if(typeof document !== 'undefined'){
    document.addEventListener('visibilitychange', () => { if(!document.hidden) _newsAutoSyncTick(); });
  }
}

