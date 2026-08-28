// ─── §11.7 — Story-Detail (dynamisch je Typ) ─────────────────────────
// Detail-Popover (z-index 140) — kann ÜBER Sheet (100) und nvBg (130)
// liegen und ist unabhängig schließbar.
function openNewsDetail(sid){
  const stories = getStoriesCache();
  const s = stories.find(x => x.id === sid);
  if(!s) return;
  // ── Read-State (Bugfix v8.1) ──
  // Story IMMER hier markieren — egal über welchen Pfad geöffnet wurde
  // (Mini-Popup, Feed-Card, Direkt-Aufruf). _newsMarkSeen ist idempotent
  // (Set-Add), kein Risiko bei mehrfachem Aufruf.
  try {
    _newsMarkSeen(sid);
    newsBadgeRefresh();
    // Sichtbare Cards (Mini-Popup + Feed) visuell synchron halten.
    // CSS.escape ist seit 2015 in allen relevanten Browsern verfügbar; defensiv
    // mit Fallback auf simples Escape für Edge-Cases.
    const escId = (window.CSS && CSS.escape) ? CSS.escape(sid) : sid.replace(/[\\"']/g, '\\$&');
    document.querySelectorAll('.nv-story[data-sid="'+escId+'"], .nf-card[data-sid="'+escId+'"], .nf-hero[data-sid="'+escId+'"]').forEach(el => {
      el.classList.add('read'); el.classList.remove('important');
      el.querySelector('.nv-story-dot')?.remove();
      el.querySelector('.nf-dot')?.remove();
    });
  } catch(e){}
  // v9: Breaking-Stories im Detail ebenfalls in der Breaking-Optik anzeigen.
  const dcat = _displayCat(s);
  const cat = NEWS_CATEGORIES[dcat] || NEWS_CATEGORIES.fun;
  // Body-HTML dynamisch je Typ — nutzt vorhandene Avatar/Stat-Helper
  const body = _newsDetailBody(s);
  const nd = document.getElementById('nd');
  const bg = document.getElementById('ndBg');
  if(!nd || !bg) return;
  nd.innerHTML = `
    <div class="nd-head">
      <div class="nd-ic nv-cat-${dcat}">${svgI(s.ic || cat.ic)}</div>
      <div class="nd-title-wrap">
        <div class="nd-cat nv-cat-tag ${dcat}" style="display:inline-block">${esc(cat.descLabel)}</div>
        <div class="nd-title">${esc(s.title)}</div>
        <div class="nd-when">${esc(_newsWhenLabel(s.when))}</div>
      </div>
      <button class="nd-x" id="ndXBtn" aria-label="Schließen">×</button>
    </div>
    <div class="nd-desc">${esc(s.desc)}</div>
    ${body}
    <button class="nd-close" id="ndCloseBtn">Schließen</button>`;
  bg.classList.add('show');
  document.getElementById('ndCloseBtn').onclick = closeNewsDetail;
  document.getElementById('ndXBtn').onclick = closeNewsDetail;
  // Match-Refs: bei Klick zum Match-Detail springen
  nd.querySelectorAll('[data-mid]').forEach(el => {
    el.onclick = () => {
      const mid = el.dataset.mid;
      closeNewsDetail();
      closeNewsPopover();
      sheetNav(() => { try { showMatchDetail(mid); } catch(e){} }); // über den News-Feed stapeln
    };
  });
  // Player-Refs: zum Spielerprofil
  nd.querySelectorAll('[data-pid]').forEach(el => {
    el.onclick = () => {
      const pid = el.dataset.pid;
      closeNewsDetail();
      closeNewsPopover();
      sheetNav(() => { try { showPlayer(pid); } catch(e){} }); // über den News-Feed stapeln
    };
  });
  // §13: Titel-Plaketten und der „Ganze Tafel"-Button im Saison-Abschluss
  nd.querySelectorAll('[data-tplayer]').forEach(el => {
    el.onclick = () => {
      const pid = el.dataset.tplayer;
      closeNewsDetail(); closeNewsPopover();
      sheetNav(() => { try { showPlayer(pid); } catch(e){} });
    };
  });
  nd.querySelectorAll('[data-season-table]').forEach(el => {
    el.onclick = () => {
      const sid = el.dataset.seasonTable;
      closeNewsDetail(); closeNewsPopover();
      sheetNav(() => { try { showSeasonTable(sid); } catch(e){} });
    };
  });
  nd.querySelectorAll('[data-chron]').forEach(el => {
    el.onclick = () => {
      const cid = el.dataset.chron;
      closeNewsDetail(); closeNewsPopover();
      sheetNav(() => { try { showChronicle(cid); } catch(e){} });
    };
  });
}
function closeNewsDetail(){
  const bg = document.getElementById('ndBg');
  if(bg) bg.classList.remove('show');
}

// Detail-Body-HTML — schaltet nach dataRef.type. Für unbekannte Typen
// wird nur die Description angezeigt (Fallback).
//
// v8.1: massiv erweitert. Helper-Funktionen unten liefern wiederverwendbare
// Bausteine (Match-VS-Block, Elo-Delta, Form-Strip), die in mehreren Cases
// gemeinsam genutzt werden. Vermeidet duplizierte Berechnungen.
function _newsDetailBody(s){
  const d = s.dataRef || {};
  const pm = pmap();
  const avM = (pid) => (typeof avHtml === 'function' && pm[pid]) ? avHtml(pm[pid]) : '';
  const nameOf = (pid) => (pm[pid] && pm[pid].name) || '?';
  // §13.4b: Chronik-Karten haben keinen eigenen `type` — sie hängen an jeder
  // Story, die eine Chronik nennt, und öffnen deren Liga-Ansicht.
  if(d.chronicle && CHRONICLE_BY_ID[d.chronicle]){
    const def = CHRONICLE_BY_ID[d.chronicle];
    const row = d.ambientPid ? `<div class="nd-stat-row" data-pid="${esc(d.ambientPid)}" style="cursor:pointer">
      <div class="nd-stat-label">Rekordhalter</div><div class="nd-stat-val gold">${esc(nameOf(d.ambientPid))} ›</div></div>` : '';
    return `<div class="nd-section">Liga-Rekord · ${esc(CHRON_KINDS[def.kind].label)}</div>${row}
      <div class="nd-stat-row"><div class="nd-stat-label">Bedingung</div>
        <div class="nd-stat-val">${esc(def.cond)}</div></div>
      <button class="btn ghost sm" data-chron="${esc(def.id)}" style="margin-top:12px;width:100%">Rekord öffnen</button>`;
  }
  try {
    switch(d.type){
      case 'top_clash': {
        // v9.3: Ränge explizit — Platz 1 (Sieger) & Platz 2 (Verfolger),
        // beide antippbar; darunter das Spitzenspiel als Match-VS-Block.
        const rankRows = (d.p1 && d.p2) ? `
          <div class="nd-stat-row" data-pid="${esc(d.p1)}" style="cursor:pointer"><div class="nd-stat-label">Platz 1</div><div class="nd-stat-val acid">${esc(nameOf(d.p1))} ›</div></div>
          <div class="nd-stat-row" data-pid="${esc(d.p2)}" style="cursor:pointer"><div class="nd-stat-label">Platz 2</div><div class="nd-stat-val">${esc(nameOf(d.p2))} ›</div></div>` : '';
        const matchHtml = d.matchId ? _newsMatchVsBlock(d.matchId) : '';
        return (rankRows ? `<div class="nd-section">Duell an der Spitze</div>${rankRows}` : '')
             + (matchHtml ? `<div class="nd-section">Das Spitzenspiel</div>${matchHtml}` : '');
      }
      case 'elo_record': {
        // v9.4: Rekordhalter (antippbar) + Rekordwert + auslösendes Match.
        const row = d.pid ? `<div class="nd-stat-row" data-pid="${esc(d.pid)}" style="cursor:pointer"><div class="nd-stat-label">Rekordhalter</div><div class="nd-stat-val acid">${esc(nameOf(d.pid))} ›</div></div>` : '';
        const eloRow = d.elo!=null ? `<div class="nd-stat-row"><div class="nd-stat-label">Höchststand</div><div class="nd-stat-val acid">${d.elo} Elo</div></div>` : '';
        const matchHtml = d.matchId ? _newsMatchVsBlock(d.matchId) : '';
        return `<div class="nd-section">Liga-Rekord</div>${row}${eloRow}` + (matchHtml ? `<div class="nd-section">Rekord-Match</div>${matchHtml}` : '');
      }
      case 'streak_record': {
        const row = d.pid ? `<div class="nd-stat-row" data-pid="${esc(d.pid)}" style="cursor:pointer"><div class="nd-stat-label">Rekordhalter</div><div class="nd-stat-val acid">${esc(nameOf(d.pid))} ›</div></div>` : '';
        const sRow = d.streak!=null ? `<div class="nd-stat-row"><div class="nd-stat-label">Siege in Folge</div><div class="nd-stat-val acid">${d.streak}</div></div>` : '';
        return `<div class="nd-section">Liga-Rekord</div>${row}${sRow}`;
      }
      case 'giant_slayer': {
        const pct = d.chance!=null ? `<div class="nd-stat-row"><div class="nd-stat-label">Siegchance</div><div class="nd-stat-val red">${Math.max(1,Math.round(d.chance*100))}%</div></div>` : '';
        const matchHtml = d.matchId ? _newsMatchVsBlock(d.matchId) : '';
        return `<div class="nd-section">Die Sensation</div>${pct}` + (matchHtml ? matchHtml : '');
      }
      case 'group': {
        // v8.8: zusammengefasste Karte ("N Pechvögel: …") — alle Beteiligten
        // tappbar, mit ihrem jeweiligen Wert (frag).
        const pids = Array.isArray(d.playerIds) ? d.playerIds : [];
        const frags = Array.isArray(d.frags) ? d.frags : [];
        const rows = pids.map((pid, i) => {
          const m = (frags[i] || '').match(/\(([^)]*)\)/);
          const val = m ? m[1] : '›';
          return `<div class="nd-stat-row" data-pid="${esc(pid)}" style="cursor:pointer">
            <div class="nd-stat-label">${esc(nameOf(pid))}</div><div class="nd-stat-val">${esc(val)}</div></div>`;
        }).join('');
        return `<div class="nd-section">Beteiligte</div>${rows}`;
      }
      case 'potw':
      case 'potd': {
        // v8.7: Spieler der Woche/des Tages — Sieger als tappbare Chips.
        const pids = (Array.isArray(d.playerIds) && d.playerIds.length) ? d.playerIds : [d.playerId];
        const rows = pids.map(pid => `<div class="nd-stat-row" data-pid="${esc(pid)}" style="cursor:pointer">
            <div class="nd-stat-label">${esc(nameOf(pid))}</div><div class="nd-stat-val">›</div></div>`).join('');
        const wrLine = (d.wins != null && d.wr != null) ? `<div class="nd-stat-row">
            <div class="nd-stat-label">Bilanz</div>
            <div class="nd-stat-val acid">${d.wins} Siege · ${Math.round(d.wr*100)}%</div></div>` : '';
        return `<div class="nd-section">${pids.length > 1 ? 'Sieger' : 'Sieger'}</div>${rows}${wrLine}`;
      }
      case 'ambient': {
        // v8.5: ambiente Tages-Story. Header (Titel/Desc/Zeit) reicht inhaltlich;
        // bei Spieler-/Duell-Bezug zusätzlich tappbare Chips zum Durchspringen.
        if(d.ambientPid && pm[d.ambientPid]){
          return `<div class="nd-section">Im Fokus</div>
            <div class="nd-vs">
              <div class="nd-vs-p" data-pid="${esc(d.ambientPid)}">
                ${avM(d.ambientPid)}
                <div class="nd-vs-name">${esc(nameOf(d.ambientPid))}</div>
              </div>
            </div>`;
        }
        if(Array.isArray(d.ambientPids) && d.ambientPids.length === 2 && pm[d.ambientPids[0]] && pm[d.ambientPids[1]]){
          const [pa, pb] = d.ambientPids;
          // v9.17: Paare sind nicht automatisch Gegner. Team-Stories (z.B. die
          // gemeinsame Siegesserie eines Duos) wurden bisher als „Duell … vs …"
          // gerendert, obwohl die beiden ZUSAMMEN spielen. pairKind kommt aus dem
          // Template; für bereits persistierte Rows ohne Feld entscheidet die
          // Kategorie ('team' → Team, sonst Duell).
          const isTeam = d.pairKind === 'team' || (!d.pairKind && s.cat === 'team');
          return `<div class="nd-section">${isTeam ? 'Das Duo' : 'Duell'}</div>
            <div class="nd-vs">
              <div class="nd-vs-p" data-pid="${esc(pa)}">${avM(pa)}<div class="nd-vs-name">${esc(nameOf(pa))}</div></div>
              <div class="nd-vs-mid">${isTeam ? '&amp;' : 'vs'}</div>
              <div class="nd-vs-p" data-pid="${esc(pb)}">${avM(pb)}<div class="nd-vs-name">${esc(nameOf(pb))}</div></div>
            </div>`;
        }
        return '';
      }
      case 'season_endgame': {
        const pA = d.leader, pB = d.second;
        return `<div class="nd-section">Top-2 Stand</div>
          <div class="nd-vs">
            <div class="nd-vs-p" data-pid="${esc(pA.pid)}">
              ${avM(pA.pid)}
              <div class="nd-vs-name">${esc(nameOf(pA.pid))}</div>
              <div class="nd-vs-elo">${pA.elo} Elo</div>
            </div>
            <div class="nd-vs-mid">${d.gap}<div class="nd-vs-mid-sub">Elo Diff</div></div>
            <div class="nd-vs-p" data-pid="${esc(pB.pid)}">
              ${avM(pB.pid)}
              <div class="nd-vs-name">${esc(nameOf(pB.pid))}</div>
              <div class="nd-vs-elo">${pB.elo} Elo</div>
            </div>
          </div>
          <div class="nd-stat-row"><div class="nd-stat-label">Verbleibend</div><div class="nd-stat-val acid">${d.daysLeft} ${d.daysLeft===1?'Tag':'Tage'}</div></div>`;
      }
      case 'lead_change': {
        const matchHtml = d.matchId ? _newsMatchVsBlock(d.matchId) : '';
        const eloChg = d.matchId ? _newsEloDelta(d.newLeader, d.matchId) : null;
        const rankInfo = d.matchId ? _newsRankChange(d.newLeader, d.matchId) : null;
        return `<div class="nd-section">Wechsel an der Spitze</div>
          <div class="nd-vs">
            <div class="nd-vs-p" data-pid="${esc(d.newLeader)}">
              ${avM(d.newLeader)}
              <div class="nd-vs-name">${esc(nameOf(d.newLeader))}</div>
              <div class="nd-vs-elo" style="color:var(--acid)">neuer #1</div>
            </div>
            <div class="nd-vs-mid">↑<div class="nd-vs-mid-sub">übernimmt</div></div>
            <div class="nd-vs-p" data-pid="${esc(d.prevLeader)}">
              ${avM(d.prevLeader)}
              <div class="nd-vs-name">${esc(nameOf(d.prevLeader))}</div>
              <div class="nd-vs-elo">vorher #1</div>
            </div>
          </div>
          ${eloChg !== null ? `<div class="nd-stat-row">
            <div class="nd-stat-label">Elo-Veränderung</div>
            <div class="nd-stat-val ${eloChg>=0?'pos':'neg'}">${eloChg>=0?'+':''}${eloChg}</div>
          </div>` : ''}
          ${rankInfo ? `<div class="nd-stat-row">
            <div class="nd-stat-label">Tabelle</div>
            <div class="nd-stat-val acid">#${rankInfo.pre} → #${rankInfo.post}</div>
          </div>` : ''}
          ${matchHtml ? `<div class="nd-section">Auslösendes Match</div>${matchHtml}` : ''}`;
      }
      case 'top_form': {
        const form = _newsRecentForm(d.pid, 10);
        return `<div class="nd-section">Letzte 10 Matches</div>
          ${form.strip ? `<div class="nd-form-strip">${form.strip}</div>` : ''}
          <div class="nd-stat-row" data-pid="${esc(d.pid)}" style="cursor:pointer">
            <div class="nd-stat-label">${esc(nameOf(d.pid))}</div>
            <div class="nd-stat-val acid">${d.wins}/10 Siege</div></div>
          ${form.currentStreak >= 2 ? `<div class="nd-stat-row">
            <div class="nd-stat-label">Aktuelle Serie</div>
            <div class="nd-stat-val acid">${form.currentStreak}× Sieg</div></div>` : ''}`;
      }
      case 'loss_streak': {
        const form = _newsRecentForm(d.pid, 10);
        return `<div class="nd-section">Letzte 10 Matches</div>
          ${form.strip ? `<div class="nd-form-strip">${form.strip}</div>` : ''}
          <div class="nd-stat-row" data-pid="${esc(d.pid)}" style="cursor:pointer">
            <div class="nd-stat-label">${esc(nameOf(d.pid))}</div>
            <div class="nd-stat-val neg">${d.streak}× Niederlage in Folge</div></div>`;
      }
      case 'badge_unlocked': {
        // v8.6: bei konsolidierten Karten (mehrere Spieler, gleicher Badge im
        // selben Match) alle Beteiligten listen; sonst der einzelne Spieler.
        const pids = (Array.isArray(d.playerIds) && d.playerIds.length) ? d.playerIds : [d.playerId];
        const matchHtml = d.matchId ? _newsMatchVsBlock(d.matchId) : '';
        const eloChg = (pids.length === 1 && d.matchId) ? _newsEloDelta(pids[0], d.matchId) : null;
        const rarLabel = d.rarity ? (d.rarity[0].toUpperCase()+d.rarity.slice(1)) : '';
        const playersHtml = pids.map(pid => `<div class="nd-stat-row" data-pid="${esc(pid)}" style="cursor:pointer">
            <div class="nd-stat-label">${esc(nameOf(pid))}</div><div class="nd-stat-val">›</div></div>`).join('');
        const nemRow = d.nemesisOppId ? `<div class="nd-stat-row" data-pid="${esc(d.nemesisOppId)}" style="cursor:pointer">
            <div class="nd-stat-label">Angstgegner</div>
            <div class="nd-stat-val neg">${esc(nameOf(d.nemesisOppId))}</div></div>` : '';
        return `<div class="nd-section">${pids.length > 1 ? pids.length + ' Spieler' : 'Spieler'}</div>
          ${playersHtml}
          ${nemRow}
          ${rarLabel ? `<div class="nd-stat-row">
            <div class="nd-stat-label">Seltenheit</div>
            <div class="nd-stat-val ${d.rarity==='legendary'?'gold':d.rarity==='negative'?'neg':'acid'}">${esc(rarLabel)}</div></div>` : ''}
          ${eloChg !== null ? `<div class="nd-stat-row">
            <div class="nd-stat-label">Match-Elo</div>
            <div class="nd-stat-val ${eloChg>=0?'pos':'neg'}">${eloChg>=0?'+':''}${eloChg}</div></div>` : ''}
          ${matchHtml ? `<div class="nd-section">Auslösendes Match</div>${matchHtml}` : ''}`;
      }
      case 'rivalry': {
        // Live-Bilanz aus matches berechnen — günstig, da rivalry-Stories selten sind.
        const h2h = _newsH2HRecord(d.a, d.b);
        return `<div class="nd-section">Die Kontrahenten</div>
          <div class="nd-vs">
            <div class="nd-vs-p" data-pid="${esc(d.a)}">
              ${avM(d.a)}
              <div class="nd-vs-name">${esc(nameOf(d.a))}</div>
              <div class="nd-vs-elo">${h2h.aWins} Siege</div>
            </div>
            <div class="nd-vs-mid">VS<div class="nd-vs-mid-sub">${d.n} Duelle</div></div>
            <div class="nd-vs-p" data-pid="${esc(d.b)}">
              ${avM(d.b)}
              <div class="nd-vs-name">${esc(nameOf(d.b))}</div>
              <div class="nd-vs-elo">${h2h.bWins} Siege</div>
            </div>
          </div>
          ${h2h.lastMatchId ? `<div class="nd-section">Letztes Duell</div>${_newsMatchVsBlock(h2h.lastMatchId)}` : ''}`;
      }
      case 'jubilee': {
        // Karriere-Bilanz nutzen statt nur Total — bestehende Stats-Funktion.
        const stats = _newsPlayerCareer(d.pid);
        return `<div class="nd-section">Karriere</div>
          <div class="nd-stat-row" data-pid="${esc(d.pid)}" style="cursor:pointer">
            <div class="nd-stat-label">${esc(nameOf(d.pid))}</div>
            <div class="nd-stat-val gold">${d.total} Spiele</div></div>
          ${stats ? `<div class="nd-stat-row">
            <div class="nd-stat-label">Siege / Niederlagen</div>
            <div class="nd-stat-val">${stats.wins} / ${stats.losses}</div></div>
          <div class="nd-stat-row">
            <div class="nd-stat-label">Win-Rate</div>
            <div class="nd-stat-val acid">${stats.winRate}%</div></div>` : ''}
          ${d.matchId ? `<div class="nd-section">Jubiläums-Match</div>${_newsMatchVsBlock(d.matchId)}` : ''}`;
      }
      case 'quiet_week': {
        return `<div class="nd-section">Aktivität</div>
          <div class="nd-stat-row"><div class="nd-stat-label">Letzte 7 Tage</div><div class="nd-stat-val">${d.lastWeek} Spiele</div></div>
          <div class="nd-stat-row"><div class="nd-stat-label">4-Wochen-Schnitt</div><div class="nd-stat-val">${d.avg} Spiele</div></div>`;
      }
      case 'season_recap': {
        // Top-3 Aufstellung statt nur Champion
        const top = (d.topElo || []).slice(0,3);
        const rows = top.map((p, i) => p && p.id && pm[p.id] ? `
          <div class="nd-stat-row" data-pid="${esc(p.id)}" style="cursor:pointer">
            <div class="nd-stat-label">${i+1}. ${esc(nameOf(p.id))}</div>
            <div class="nd-stat-val ${i===0?'gold':i===1?'':''}">${p.elo} Elo</div></div>` : '').join('');
        // v9.18: Die komplette Saison-Tafel (§13) hängt an dieser einen Karte.
        // Ältere persistierte Rows haben kein `tafel` → Abschnitt entfällt.
        const tf = d.tafel;
        const tafelHtml = (tf && Array.isArray(tf.list) && tf.list.length)
          ? `<div class="nd-section">Die Chronik der Saison</div>
             <div class="tplates">${tf.list.map(x => _titlePlateHtml(
                 {name:x.n, ic:x.ic, tone:x.tone, pid:x.pid, ev:x.ev})).join('')}</div>
             ${tf.empty ? `<div class="nd-stat-row"><div class="nd-stat-label">Ohne Eintrag</div>
               <div class="nd-stat-val">${tf.empty} Spieler</div></div>` : ''}
             <button class="btn ghost sm" data-season-table="${esc(d.sid)}" style="margin-top:12px;width:100%">Ganze Chronik öffnen</button>`
          : '';
        return `<div class="nd-section">Saison-Top-3</div>
          ${rows}
          <div class="nd-stat-row"><div class="nd-stat-label">Saison</div><div class="nd-stat-val">${esc(d.sid)}</div></div>
          ${tafelHtml}`;
      }
      case 'season_start': {
        return `<div class="nd-section">Aktuelle Saison</div>
          <div class="nd-stat-row"><div class="nd-stat-label">Saison-ID</div><div class="nd-stat-val">${esc(d.sid)}</div></div>`;
      }
      // Neue Typen (Phase 8) hängen sich hier dran an
      case 'milestone_wins':
      case 'milestone_goals':
      case 'milestone_elo': {
        const stats = _newsPlayerCareer(d.pid);
        return `<div class="nd-section">Meilenstein</div>
          <div class="nd-stat-row" data-pid="${esc(d.pid)}" style="cursor:pointer">
            <div class="nd-stat-label">${esc(nameOf(d.pid))}</div>
            <div class="nd-stat-val gold">${esc(d.milestone)}</div></div>
          ${stats ? `<div class="nd-stat-row">
            <div class="nd-stat-label">Karriere-Bilanz</div>
            <div class="nd-stat-val">${stats.wins}W · ${stats.losses}L</div></div>` : ''}
          ${d.matchId ? `<div class="nd-section">Meilenstein-Match</div>${_newsMatchVsBlock(d.matchId)}` : ''}`;
      }
      case 'biggest_blowout': {
        return `<div class="nd-section">Kantersieg</div>
          ${_newsMatchVsBlock(d.matchId)}
          <div class="nd-stat-row">
            <div class="nd-stat-label">Tordifferenz</div>
            <div class="nd-stat-val gold">+${d.diff}</div></div>`;
      }
      case 'elo_swing': {
        return `<div class="nd-section">Spieler</div>
          <div class="nd-stat-row" data-pid="${esc(d.pid)}" style="cursor:pointer">
            <div class="nd-stat-label">${esc(nameOf(d.pid))}</div>
            <div class="nd-stat-val ${d.delta>=0?'pos':'neg'}">${d.delta>=0?'+':''}${d.delta} Elo</div></div>
          <div class="nd-stat-row">
            <div class="nd-stat-label">Zeitraum</div>
            <div class="nd-stat-val">${esc(d.period)}</div></div>`;
      }
      case 'anniversary': {
        return `<div class="nd-section">Vor genau einem Jahr</div>
          ${d.matchId ? _newsMatchVsBlock(d.matchId) : ''}
          <div class="nd-stat-row">
            <div class="nd-stat-label">Damals</div>
            <div class="nd-stat-val">${esc(d.dateLabel || '')}</div></div>`;
      }
      // ── v8.2 Neue Typen ──
      case 'upset_match': {
        return `<div class="nd-section">Underdog-Sieg</div>
          ${_newsMatchVsBlock(d.matchId)}
          <div class="nd-stat-row">
            <div class="nd-stat-label">Sieger-Rang vorher</div>
            <div class="nd-stat-val acid">#${d.winnerRank}</div></div>
          <div class="nd-stat-row">
            <div class="nd-stat-label">Verlierer-Rang vorher</div>
            <div class="nd-stat-val">#${d.loserRank}</div></div>
          <div class="nd-stat-row">
            <div class="nd-stat-label">Klassenunterschied</div>
            <div class="nd-stat-val gold">${d.gap} Plätze</div></div>`;
      }
      case 'streak_killer': {
        const _breakers = Array.isArray(d.breakerIds) ? d.breakerIds.filter(Boolean) : [];
        const _breakerRow = _breakers.length
          ? `<div class="nd-stat-row">
              <div class="nd-stat-label">Gestoppt von</div>
              <div class="nd-stat-val acid">${esc(_breakers.map(nameOf).join(' & '))}</div></div>`
          : '';
        return `<div class="nd-section">Serien-Ende</div>
          ${_newsMatchVsBlock(d.matchId)}
          <div class="nd-stat-row" data-pid="${esc(d.victimPid)}" style="cursor:pointer">
            <div class="nd-stat-label">${esc(nameOf(d.victimPid))}</div>
            <div class="nd-stat-val neg">−${d.streak}er Serie</div></div>
          ${_breakerRow}`;
      }
      case 'thriller_match': {
        return `<div class="nd-section">Knappes Match</div>
          ${_newsMatchVsBlock(d.matchId)}
          <div class="nd-stat-row">
            <div class="nd-stat-label">Tordifferenz</div>
            <div class="nd-stat-val gold">${d.diff} Tor</div></div>
          <div class="nd-stat-row">
            <div class="nd-stat-label">Tore gesamt</div>
            <div class="nd-stat-val">${d.total}</div></div>`;
      }
      case 'rivalry_milestone': {
        const h2h = _newsH2HRecord(d.a, d.b);
        return `<div class="nd-section">Historische Bilanz</div>
          <div class="nd-vs">
            <div class="nd-vs-p" data-pid="${esc(d.a)}">
              ${avM(d.a)}
              <div class="nd-vs-name">${esc(nameOf(d.a))}</div>
              <div class="nd-vs-elo">${h2h.aWins} Siege</div>
            </div>
            <div class="nd-vs-mid">${d.n}<div class="nd-vs-mid-sub">Duelle</div></div>
            <div class="nd-vs-p" data-pid="${esc(d.b)}">
              ${avM(d.b)}
              <div class="nd-vs-name">${esc(nameOf(d.b))}</div>
              <div class="nd-vs-elo">${h2h.bWins} Siege</div>
            </div>
          </div>
          ${d.matchId ? `<div class="nd-section">Jubiläums-Duell</div>${_newsMatchVsBlock(d.matchId)}` : ''}`;
      }
      case 'win_streak': {
        const form = _newsRecentForm(d.pid, Math.min(d.streak, 10));
        return `<div class="nd-section">Aktuelle Serie</div>
          ${form.strip ? `<div class="nd-form-strip">${form.strip}</div>` : ''}
          <div class="nd-stat-row" data-pid="${esc(d.pid)}" style="cursor:pointer">
            <div class="nd-stat-label">${esc(nameOf(d.pid))}</div>
            <div class="nd-stat-val acid">${d.streak}× Sieg in Folge</div></div>`;
      }
      case 'dry_spell': {
        return `<div class="nd-section">Liga-Pause</div>
          <div class="nd-stat-row">
            <div class="nd-stat-label">Tage ohne Match</div>
            <div class="nd-stat-val gold">${d.daysSince}</div></div>
          ${d.lastMatchId ? `<div class="nd-section">Letztes Match</div>${_newsMatchVsBlock(d.lastMatchId)}` : ''}`;
      }
    }
  } catch(e){ /* defensiv */ }
  return '';
}

// ─── §11.7b — Detail-Body Helper (v8.1) ──────────────────────────────
// Wiederverwendbare Sub-Renderer und Stats-Funktionen für die einzelnen
// Detail-Body-Cases. Alle nutzen bestehende Caches; keine eigenen Walks.

// Match-VS-Block: 2v2 Layout mit Spieler-Avataren, Namen, Score und Datum.
// Klickbar (data-mid) → springt zum Match-Detail über den existierenden
// Click-Handler in openNewsDetail.
function _newsMatchVsBlock(matchId){
  try {
    const m = matches.find(x => x.id === matchId);
    if(!m) return '';
    const pm = pmap();
    const av = pid => (pm[pid] && typeof avHtml === 'function')
      ? avHtml(pm[pid], '')
      : '<span class="av" style="background:var(--surface)"></span>';
    const nm = pid => (pm[pid] && pm[pid].name) || '?';
    const aWon = m.winner === 'A';
    const dt = new Date(m.created_at);
    const dStr = dt.toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'2-digit'});
    return `<div class="nd-match" data-mid="${esc(m.id)}">
      <div class="nd-match-side ${aWon?'won':'lost'}">
        <div class="nd-match-avs">${av(m.a1)}${av(m.a2)}</div>
        <div class="nd-match-names">${esc(nm(m.a1))} & ${esc(nm(m.a2))}</div>
      </div>
      <div class="nd-match-score">
        <div class="nd-match-score-val">${m.score_a}:${m.score_b}</div>
        <div class="nd-match-score-date">${dStr}</div>
      </div>
      <div class="nd-match-side ${!aWon?'won':'lost'}">
        <div class="nd-match-avs">${av(m.b1)}${av(m.b2)}</div>
        <div class="nd-match-names">${esc(nm(m.b1))} & ${esc(nm(m.b2))}</div>
      </div>
    </div>`;
  } catch(e){ return ''; }
}

// Elo-Delta für einen Spieler in einem bestimmten Match. Nutzt bestehenden
// getHistoryByMatchId-Cache (Map<matchId, {deltas, eloBefore, eloAfter}>).
function _newsEloDelta(pid, matchId){
  try {
    const hist = getHistoryByMatchId();
    const entry = hist.get(matchId);
    if(!entry || !entry.deltas) return null;
    const d = entry.deltas[pid];
    if(d === undefined || d === null) return null;
    return Math.round(d);
  } catch(e){ return null; }
}

// Pre/Post-Rank für einen Spieler an einem Match. Nutzt getRankSnapshots-Cache.
function _newsRankChange(pid, matchId){
  try {
    const snaps = getRankSnapshots();
    const snap = snaps[matchId];
    if(!snap || !snap.preRank || !snap.postRank) return null;
    const pre = snap.preRank[pid];
    const post = snap.postRank[pid];
    if(!pre || !post) return null;
    return {pre, post};
  } catch(e){ return null; }
}

// Form-Strip + Win-Streak der letzten N Matches. Walks die filter()-Variante
// nur über matches (gesamt) — wird im Detail aufgerufen, also einmalig.
function _newsRecentForm(pid, n){
  const arr = [];
  for(let i = matches.length - 1; i >= 0 && arr.length < n; i--){
    if(matchOf(pid, matches[i])) arr.unshift(matches[i]);
  }
  if(!arr.length) return {strip:'', currentStreak:0};
  const strip = arr.map(m => {
    const w = won(pid, m);
    return `<div class="nd-form-dot ${w?'w':'l'}" title="${w?'Sieg':'Niederlage'}"></div>`;
  }).join('');
  // Aktuelle Sieges-Streak (von hinten zählen)
  let curStreak = 0;
  for(let i = arr.length - 1; i >= 0; i--){
    if(won(pid, arr[i])) curStreak++;
    else break;
  }
  return {strip, currentStreak: curStreak};
}

// H2H-Bilanz Spieler A vs Spieler B (egal welche Teamkonstellation).
// Iteriert einmal über matches; bei großen Datensätzen kann das auf
// getPairsCache umgestellt werden — derzeit aber günstig genug.
// H2H-Lazy-Cache (v8.4): Statt für jedes Detail ALLE matches zu walken
// (O(N) pro Lookup → bei 100k Matches teuer), wird beim ersten H2H-Lookup
// EINE Map über alle Spieler-Paarungen gebaut und gecached. Danach ist jeder
// _newsH2HRecord-Lookup O(1). Build-Kosten: einmalig O(N × 4) (4 Kreuz-Paare
// pro Match), amortisiert über alle Detail-Aufrufe.
// Key bindet an matches.length + _cache.version → invalidateCache(['news'])
// (§3) löscht _h2hMap/_h2hKey, der Version-Tick bricht den Key zusätzlich.
function _ensureH2HMap(){
  const key = 'h2h_' + matches.length + '_' + _cache.version;
  if(_cache._h2hKey === key && _cache._h2hMap) return _cache._h2hMap;
  const map = new Map();
  for(let i = 0; i < matches.length; i++){
    const m = matches[i];
    const sideA = [m.a1, m.a2], sideB = [m.b1, m.b2];
    const ts = mts(m);
    const aWon = m.winner === 'A';
    // Alle 4 Kreuz-Paare (je 1 Spieler aus A gegen 1 aus B) sind H2H-Gegner.
    for(let x = 0; x < 2; x++){
      for(let y = 0; y < 2; y++){
        const pa = sideA[x], pb = sideB[y];
        if(!pa || !pb) continue;
        const k = pa < pb ? pa + '|' + pb : pb + '|' + pa;
        let e = map.get(k);
        if(!e){ e = {wins:{}, lastMatchId:null, lastTs:0}; map.set(k, e); }
        const winnerPid = aWon ? pa : pb;
        e.wins[winnerPid] = (e.wins[winnerPid] || 0) + 1;
        if(ts > e.lastTs){ e.lastTs = ts; e.lastMatchId = m.id; }
      }
    }
  }
  _cache._h2hKey = key;
  _cache._h2hMap = map;
  return map;
}
function _newsH2HRecord(aPid, bPid){
  const map = _ensureH2HMap();
  const k = aPid < bPid ? aPid + '|' + bPid : bPid + '|' + aPid;
  const e = map.get(k);
  if(!e) return {aWins:0, bWins:0, lastMatchId:null};
  // aWins/bWins richten sich nach der Aufruf-Reihenfolge (nicht nach dem
  // kanonischen Map-Key) → korrekt unabhängig von der Argument-Sortierung.
  return {aWins: e.wins[aPid] || 0, bWins: e.wins[bPid] || 0, lastMatchId: e.lastMatchId};
}

// Karriere-Bilanz (wins, losses, winRate) eines Spielers. Nutzt bestehende
// playerStats falls verfügbar, sonst einmaliger walk.
function _newsPlayerCareer(pid){
  try {
    if(typeof playerStats === 'function'){
      const st = playerStats(pid);
      if(st && (st.wins !== undefined || st.gp !== undefined)){
        const wins = st.wins || 0;
        const losses = st.losses || ((st.gp || 0) - wins);
        const total = wins + losses;
        const winRate = total ? Math.round((wins/total)*100) : 0;
        return {wins, losses, winRate};
      }
    }
  } catch(e){}
  // Fallback: schneller direkter walk
  let wins = 0, losses = 0;
  for(let i = 0; i < matches.length; i++){
    if(!matchOf(pid, matches[i])) continue;
    if(won(pid, matches[i])) wins++; else losses++;
  }
  const total = wins + losses;
  return {wins, losses, winRate: total ? Math.round((wins/total)*100) : 0};
}

// ─── Hookup: News-Button-Click + Backdrop-Close ──────────────────────
(function attachNewsHandlers(){
  const ready = () => {
    const btn = document.getElementById('newsBtn');
    if(btn && !btn._newsBound){
      btn._newsBound = true;
      // v8.9 (User-Wunsch): Klick öffnet direkt das volle Sheet statt des
      // kleinen Vorschau-Popovers. openNewsPopover bleibt für interne Reuse
      // (z.B. Toast-Tap, _refreshOpenNewsViews) erhalten.
      btn.onclick = openNewsFeed;
    }
    // Backdrop-Bindings:
    //   nvBg (Mini-Popup): Backdrop-Click schließt — ist nur ein Vorschau-Layer.
    //   ndBg (Story-Detail): KEIN Backdrop-Close mehr (User-Wunsch v8.1):
    //     Stories sollen bewusst konsumiert werden → nur X-Button oder
    //     "Schließen"-Button unten beenden den Detail-View.
    const nvBg = document.getElementById('nvBg');
    if(nvBg && !nvBg._newsBound){
      nvBg._newsBound = true;
      nvBg.addEventListener('click', (e) => {
        if(e.target === nvBg) closeNewsPopover();
      });
    }
    const ndBg = document.getElementById('ndBg');
    if(ndBg && !ndBg._newsBound){
      ndBg._newsBound = true;
      // Backdrop-Click schließt das Detail NICHT mehr — bewusstes Schließen
      // erfolgt nur via X-Button oder Schließen-Button.
    }
  };
  if(document.readyState !== 'loading') ready();
  else document.addEventListener('DOMContentLoaded', ready);
})();

