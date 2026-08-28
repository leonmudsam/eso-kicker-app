// ─── §13.4b DIE CHRONIK: EINE pro Spieler ────────────────────────────
//     Ein Saisontitel beschreibt EINEN Monat und ist jeden Monat neu zu
//     holen. Eine Chronik beschreibt die ganze LAUFBAHN — und davon trägt
//     jeder Spieler genau EINE. Nicht sieben, nicht zwölf: eine.
//
//     Warum genau eine: Wer eine Liste von zwölf Auszeichnungen trägt, hat
//     keine Auszeichnung mehr, sondern einen Lebenslauf. Die eine Chronik
//     ist der Satz, mit dem man diesen Spieler beschreibt — und weil sie
//     ligaweit vergeben wird, hat sie sonst niemand.
//
//     VERGABE — jeder Eintrag geht an den ECHTEN Bestwert (allChronicles),
//     nicht reihum. Dass trotzdem jeder Spieler nur EINEN Eintrag trägt, ist
//     eine reine Anzeige-Regel. Erreichen zwei Spieler exakt denselben Wert,
//     halten sie den Rekord GEMEINSAM — ein Tiebreak nach Siegen oder
//     Tordifferenz würde einem der beiden etwas wegnehmen, das er hat.
//
//     SUMME oder ANTEIL — die Trennlinie dieses Katalogs:
//       Ein Liga-Rekord darf eine SUMME sein, wenn die Summe die Aussage IST:
//       meiste Siege, meiste Tore, meiste Spiele, höchster Elo-Stand. Da ist
//       „viel gespielt" kein Nebeneffekt, sondern der Rekord selbst.
//       Alles, was eine EIGENSCHAFT beschreibt — wie oft jemand im letzten
//       Ball gewinnt, wie oft er zu null gewinnt, wie oft er als Außenseiter
//       gewinnt — muss ein ANTEIL sein. Sonst gewinnt immer der mit den
//       meisten Partien, und der Eintrag sagt nichts über ihn aus. Solche
//       Einträge stehen deshalb unter „Spielweise", nicht unter „Rekorde".
//
//     Reihenfolge = Wertigkeit:
//       1. Liga-Rekorde        — die harten Bestwerte (Summen und Höchststände)
//       2. Schattenseiten      — dasselbe nach unten
//       3. Spielweise          — wie jemand spielt (Anteile)
//       4. Laufbahn            — was über Monate passiert ist
//
//     Es gibt bewusst KEINE Verbindungs-Rekorde mehr („beste Quote mit
//     Partner X", „Angstgegner Y"). Sie beschrieben ein Duo, nicht einen
//     Spieler: Wer sie hielt, hatte sie halb dem anderen zu verdanken, und
//     dieselbe Zeile stand am Ende bei zwei Leuten im Profil. Eine Chronik
//     soll eine Einzelleistung sein.
//
//     Alles entsteht in EINEM Durchlauf über alle Matches (_chronicleCtx).
//     Elo aus getGlobalSim — keine zweite Rechenquelle.
const CHRON_KINDS = {
  record: {label:'Liga-Rekord',   ic:'trophyStar', ord:0},
  shame:  {label:'Schattenseite', ic:'ghost',      ord:1},
  trait:  {label:'Spielweise',    ic:'target',     ord:3},
  arc:    {label:'Laufbahn',      ic:'climb',      ord:4},
};
// Unter dieser Spielzahl bekommt niemand eine Chronik. Eine Laufbahn braucht
// eine Laufbahn — sonst trägt ein Gast nach zwölf Spielen einen Liga-Rekord.
const CHRON_MIN_GAMES = 30;

const CHRONICLES = [
  // ── 1. Leistungs-Rekorde, nach Seltenheit ─────────────────────────
  // Quoten und Höchststände: Sie sagen, WIE gut jemand war. Innerhalb des
  // Blocks steht vorn, was am wenigsten Spieler überhaupt erfüllen — ein
  // seltener Rekord ist mehr wert als ein häufiger. Der Block steht ganz
  // oben, weil `byPid` je Spieler den ERSTEN Treffer als seinen wertvollsten
  // zeigt, und das soll eine Leistung sein, keine Spielzahl.
  // Quoten und Höchststände: Sie sagen, WIE gut jemand war. Sie stehen vorn,
  // weil `byPid` je Spieler den ERSTEN Treffer als seinen wertvollsten zeigt —
  // und das soll eine Leistung sein, keine Spielzahl und keine Pleitenserie.
  // `raw` liefert den Rohwert, `min` die Untergrenze, ab der ein Wert
  // überhaupt ein Rekord sein darf (sonst hielte in Woche 1 jemand den
  // Rekord mit drei Siegen). `unit` schaltet die Fortschritts-Anzeige frei:
  // nur bei zählbaren Rekorden lässt sich sagen „noch X bis dahin".
  {id:'rec_peak', name:'Der höchste Gipfel', ic:'peak', tone:'gold', kind:'record',
    cond:'Höchster Elo-Stand, den je ein Spieler erreicht hat',
    unit:'Elo', min:350, raw:p => p.peak,
    ev:(p,v) => `${Math.round(v)} Elo — nie stand jemand höher`},

  // Der Kern dieser beiden: nicht WIE OFT jemand eine Woche oder einen Tag
  // beherrscht hat, sondern WIE OFT VON DENEN, an denen er überhaupt antrat.
  // Wer 15 Wochen spielt und 4 gewinnt, steht über dem, der 15 spielt und 4
  // gewinnt — aber unter dem, der 13 spielt und 4 gewinnt. Genau so gehört es.
  {id:'rec_potw', name:'Der Wochenkönig', ic:'weekKing', tone:'gold', kind:'record',
    cond:'Höchster Anteil eigener Spielwochen als Player of the Week, ab 10 Wochen und mindestens 20 %',
    val:p => (p.weeks >= 10 && p.potw/p.weeks >= 0.20) ? p.potw/p.weeks : null,
    ev:(p,v) => `${p.potw} von ${p.weeks} Wochen, in denen er gespielt hat · ${Math.round(v*100)} %`},

  {id:'rec_potd', name:'Der Tagesherrscher', ic:'trophyDay', tone:'gold', kind:'record',
    cond:'Höchster Anteil eigener Spieltage als Player of the Day, ab 20 Spieltagen und mindestens 25 %',
    val:p => (p.days >= 20 && p.potd/p.days >= 0.25) ? p.potd/p.days : null,
    ev:(p,v) => `${p.potd} von ${p.days} eigenen Spieltagen beherrscht · ${Math.round(v*100)} %`},

  // ── Einzelne Ausnahmetage (v9.22) ─────────────────────────────────
  // Was hier zaehlt, ist EIN Tag oder EIN Monat, nicht die Summe einer
  // Laufbahn. Neun Spiele an einem Tag und keine einzige Niederlage schafft
  // man nicht nebenbei und nicht durch Fleiss — man schafft es einmal.
  {id:'rec_cleanday', name:'Der unantastbare Tag', ic:'trophyDay', tone:'gold', kind:'record',
    cond:'Meiste Spiele an einem einzigen Tag, ohne eine einzige Niederlage',
    unit:'Siege an einem Tag', min:4, raw:p => p.cleanDay,
    ev:(p,v) => `${v} Spiele, ${v} Siege${p.cleanDayLabel ? ' · ' + p.cleanDayLabel : ''}`},

  {id:'rec_bestmonth', name:'Der beste Monat', ic:'star', tone:'gold', kind:'record',
    cond:'Höchste Siegquote, die je jemand in einem Monat gespielt hat, ab 15 Spielen',
    val:p => (p.bestMonth && p.bestMonth.q >= 0.60) ? p.bestMonth.q : null,
    ev:(p,v) => `${Math.round(v*100)} % aus ${p.bestMonth.g} Spielen · ${seasonLabel(p.bestMonth.sid)}`},

  {id:'rec_eloday', name:'Der große Sprung', ic:'bolt2', tone:'acid', kind:'record',
    cond:'Größter Elo-Gewinn an einem einzigen Tag',
    unit:'Elo an einem Tag', min:100, raw:p => p.dayElo == null ? null : Math.round(p.dayElo),
    ev:(p,v) => `+${v} Elo an einem Tag${p.dayEloLabel ? ' · ' + p.dayEloLabel : ''}`},

  {id:'trait_answer', name:'Die Antwort', ic:'comeback', tone:'acid', kind:'trait',
    cond:'Stärkster Sprung nach oben direkt nach einer Niederlage, ab 60 Gelegenheiten und mindestens 6 Prozentpunkte',
    val:p => {
      if(p.afterLossOpp < 60) return null;
      const d = p.afterLoss/p.afterLossOpp - p.wins/p.games;
      return d >= 0.06 ? d : null;
    },
    ev:(p,v) => `${Math.round(p.afterLoss/p.afterLossOpp*100)} % direkt nach einer Pleite · +${Math.round(v*100)} Punkte`},

  {id:'trait_clutch', name:'Die ruhige Hand', ic:'nerves', tone:'gold', kind:'trait',
    cond:'Stärkster Sprung nach oben in engen Spielen, mindestens 9 Prozentpunkte',
    val:p => {
      if(p.close < 20 || p.close < p.games * 0.2) return null;
      const d = (p.closeW/p.close) - (p.wins/p.games);
      return d >= 0.09 ? d : null;
    },
    ev:(p,v) => `${Math.round(p.closeW/p.close*100)} % in engen Spielen · +${Math.round(v*100)} Punkte`},

  {id:'trait_bully', name:'Der Kantersieger', ic:'explosion', tone:'orange', kind:'trait',
    cond:'Höchster Anteil Kantersiege, ab 50 Siegen und mindestens 22 %',
    val:p => (p.wins >= 50 && p.blowW/p.wins >= 0.22) ? p.blowW/p.wins : null,
    ev:p => `${p.blowW} seiner ${p.wins} Siege waren Kantersiege`},

  {id:'rec_perfect', name:'Der Henker', ic:'hundred', tone:'gold', kind:'trait',
    cond:'Höchster Anteil 10:0-Siege an allen eigenen Siegen, ab 60 Siegen',
    val:p => (p.wins >= 60 && p.perfect/p.wins >= 0.03) ? p.perfect/p.wins : null,
    ev:(p,v) => `${p.perfect} seiner ${p.wins} Siege endeten 10:0`},

  {id:'rec_upset', name:'Der Riesenjäger', ic:'giantSlayer', tone:'acid', kind:'trait',
    cond:'Höchster Anteil Siege mit unter 35 % Siegchance, ab 100 Spielen',
    val:p => (p.games >= 100 && p.upsets/p.games >= 0.04) ? p.upsets/p.games : null,
    ev:(p,v) => `${p.upsets} von ${p.games} Spielen gegen die Wahrscheinlichkeit gewonnen`},

  {id:'trait_twoway', name:'Der Komplettspieler', ic:'diamond', tone:'gold', kind:'trait',
    cond:'Auf beiden Positionen stark — höchste schwächere der beiden Siegquoten, ab 40 Spielen je Position',
    val:p => {
      if(p.atkG < 40 || p.defG < 40) return null;
      const lo = Math.min(p.atkW/p.atkG, p.defW/p.defG);
      return lo >= 0.55 ? lo : null;
    },
    ev:p => `${Math.round(p.atkW/p.atkG*100)} % vorne, ${Math.round(p.defW/p.defG*100)} % hinten — beides über dem Schnitt`},

  // ── Ersatz für die Verbindungs-Rekorde (v9.20) ────────────────────
  // Dieselbe Idee wie die Königs-Quoten oben, nur über andere Einheiten:
  // gemessen wird immer an dem, was der Spieler selbst bestritten hat.
  {id:'trait_steady', name:'Die verlässliche Woche', ic:'shieldCheck', tone:'blue', kind:'trait',
    cond:'Höchster Anteil eigener Spielwochen mit positiver Bilanz, ab 10 Wochen und mindestens 70 %',
    val:p => (p.weeks >= 10 && p.posWeeks/p.weeks >= 0.70) ? p.posWeeks/p.weeks : null,
    ev:(p,v) => `${p.posWeeks} von ${p.weeks} Wochen mit mehr Siegen als Pleiten · ${Math.round(v*100)} %`},

  // ── Die drei schwersten Einträge des Katalogs (v9.19) ──────────────
  // Sie messen nichts, was man sich erspielen kann, indem man oft antritt.
  // „Der Veredler" misst sogar ausschließlich fremde Ergebnisse.
  {id:'trait_catalyst', name:'Der Veredler', ic:'handshake', tone:'gold', kind:'trait',
    cond:'Seine Partner gewinnen an seiner Seite am deutlichsten häufiger als ohne ihn — mindestens 3 Partner, je 25 gemeinsame Spiele',
    val:p => (p.upliftMates >= 3 && p.uplift != null && p.uplift >= 0.10) ? p.uplift : null,
    ev:(p,v) => `Seine ${p.upliftMates} Partner gewinnen neben ihm ${Math.round(v*100)} Punkte häufiger als ohne ihn`},

  {id:'trait_armor', name:'Die harte Schale', ic:'blockedShot', tone:'blue', kind:'trait',
    cond:'Niedrigster Anteil deutlicher Niederlagen (7+ Tore Rückstand), ab 60 Niederlagen',
    val:p => (p.losses >= 60 && p.blowL/p.losses <= 0.12) ? -(p.blowL/p.losses) : null,
    ev:p => `Nur ${p.blowL} seiner ${p.losses} Niederlagen gingen deutlich verloren · ${Math.round(p.blowL/p.losses*100)} %`},

  {id:'arc_rise', name:'Die Wiederauferstehung', ic:'climb', tone:'acid', kind:'arc',
    cond:'Größter Elo-Sprung von einer Saison zur nächsten, mindestens +150',
    val:p => (p.rise && p.rise.d >= 150) ? p.rise.d : null,
    ev:p => `+${Math.round(p.rise.d)} Elo von ${p.rise.from} auf ${p.rise.to}`},

  {id:'trait_perfday', name:'Die weiße Weste', ic:'trophyDay', tone:'gold', kind:'trait',
    cond:'Höchster Anteil voller Spieltage (4+ Partien) ohne eine einzige Niederlage, ab 15 solchen Tagen',
    val:p => (p.bigDays >= 15 && p.perfDays >= 1) ? p.perfDays/p.bigDays : null,
    ev:p => `${p.perfDays} von ${p.bigDays} vollen Spieltagen ohne eine einzige Niederlage`},

  // Diese drei standen früher als „Rekord" (meiste 10:9-Siege, meiste 10:0,
  // meiste Upsets) im Katalog. Das war in Wahrheit eine Rangliste der
  // Vielspieler: Wer 460 Partien hat, sammelt zwangsläufig mehr 10:9 als
  // jemand mit 120 — ohne dass er es öfter schafft. Als ANTEIL sagen sie
  // etwas über die Spielweise, und genau dorthin gehören sie. Die IDs bleiben
  // (`rec_*`), damit bestehende News-Verweise nicht ins Leere zeigen.
  {id:'rec_nail', name:'Der Herzensbrecher', ic:'thriller', tone:'purple', kind:'trait',
    cond:'Höchster Anteil 10:9-Siege an allen eigenen Siegen, ab 60 Siegen',
    val:p => (p.wins >= 60 && p.nail/p.wins >= 0.08) ? p.nail/p.wins : null,
    ev:(p,v) => `${p.nail} seiner ${p.wins} Siege endeten 10:9 · ${Math.round(v*100)} %`},

  {id:'trait_keeper', name:'Der geborene Verteidiger', ic:'concreteWall', tone:'blue', kind:'trait',
    cond:'Höchster Abwehr-Anteil, ab 100 Spielen und mindestens 80 %',
    val:p => (p.games >= 100 && p.defG/p.games >= 0.80) ? p.defG/p.games : null,
    ev:p => `${p.defG} von ${p.games} Spielen hinten`},

  {id:'trait_striker', name:'Der geborene Stürmer', ic:'ball', tone:'orange', kind:'trait',
    cond:'Höchster Sturm-Anteil, ab 100 Spielen und mindestens 80 %',
    val:p => (p.games >= 100 && p.atkG/p.games >= 0.80) ? p.atkG/p.games : null,
    ev:p => `${p.atkG} von ${p.games} Spielen vorne`},

  {id:'trait_both', name:'Der Beidfüßige', ic:'refresh', tone:'purple', kind:'trait',
    cond:'Ausgeglichenste Verteilung auf beide Positionen, ab 100 Spielen',
    val:p => {
      if(p.games < 100) return null;
      const s = p.defG/p.games;
      return (s >= 0.43 && s <= 0.57) ? -Math.abs(s-0.5) : null;
    },
    ev:p => `${p.atkG} vorne, ${p.defG} hinten — beides sein Zuhause`},


  // ── 2. Summen-Rekorde ─────────────────────────────────────────────
  // Die harten Bestwerte der Liga-Geschichte. Sie sind echte Rekorde, hängen
  // aber am Pensum: Wer 350 Spiele hat, sammelt zwangsläufig mehr Tore als
  // jemand mit 90. Deshalb stehen sie hinter allem, was eine Quote misst.
  // `raw` liefert den Rohwert, `min` die Untergrenze, ab der ein Wert
  // überhaupt ein Rekord sein darf. `unit` schaltet die Fortschritts-Anzeige
  // frei: nur bei zählbaren Rekorden lässt sich sagen „noch X bis dahin".
  // Die harten Bestwerte der Liga-Geschichte. Sie sind echte Rekorde, hängen
  // aber am Pensum: Wer 350 Spiele hat, sammelt zwangsläufig mehr Tore als
  // jemand mit 90. Deshalb stehen sie hinter allem, was eine Quote misst.
  // `raw` liefert den Rohwert, `min` die Untergrenze, ab der ein Wert
  // überhaupt ein Rekord sein darf. `unit` schaltet die Fortschritts-Anzeige
  // frei: nur bei zählbaren Rekorden lässt sich sagen „noch X bis dahin".
  {id:'rec_streak', name:'Die längste Serie', ic:'flameTriple', tone:'orange', kind:'record',
    cond:'Längste Siegesserie der Liga-Geschichte',
    unit:'Siege in Folge', min:8, raw:p => p.winStreak,
    ev:(p,v) => `${v} Siege in Folge${p.winSpan ? ' · ' + p.winSpan : ''}`},

  {id:'rec_unscathed', name:'Ohne eine Schramme', ic:'blockedShot', tone:'blue', kind:'record',
    cond:'Längste Serie ohne eine deutliche Niederlage (7+ Tore Rückstand)',
    unit:'Spiele ohne Debakel', min:40, raw:p => p.noBlow,
    ev:(p,v) => `${v} Spiele am Stück ohne Debakel${p.noBlowSpan ? ' · ' + p.noBlowSpan : ''}`},

  {id:'rec_wins', name:'Der Rekordsieger', ic:'trophy', tone:'gold', kind:'record',
    cond:'Meiste Siege der Liga-Geschichte',
    unit:'Siege', min:80, raw:p => p.wins,
    ev:(p,v) => `${v} Siege aus ${p.games} Spielen`},

  {id:'rec_goals', name:'Die Torfabrik', ic:'ball', tone:'orange', kind:'record',
    cond:'Meiste eigene Tore der Liga-Geschichte',
    unit:'Tore', min:500, raw:p => p.gf,
    ev:(p,v) => `${v} Tore · Ø ${(v/p.games).toFixed(1)} pro Spiel`},

  {id:'rec_games', name:'Der Dauerbrenner', ic:'gamepad', tone:'blue', kind:'record',
    cond:'Meiste Spiele der Liga-Geschichte',
    unit:'Spiele', min:150, raw:p => p.games,
    ev:(p,v) => `${v} Spiele seit ${p.firstLabel}`},

  {id:'rec_day', name:'Der längste Tag', ic:'stopwatch', tone:'acid', kind:'record',
    cond:'Meiste Spiele an einem einzigen Tag',
    unit:'Spiele an einem Tag', min:10, raw:p => p.maxDay,
    ev:(p,v) => `${v} Spiele an einem Tag${p.maxDayLabel ? ' · ' + p.maxDayLabel : ''}`},

  {id:'rec_always', name:'Der Immerdabei', ic:'weekly', tone:'blue', kind:'record',
    cond:'An den meisten Spieltagen der Liga dabei',
    unit:'Spieltage', min:25, raw:p => p.days,
    ev:(p,v,C) => `an ${v} von ${C.totalDays} Spieltagen dabei`},

  {id:'trait_workhorse', name:'Der Malocher', ic:'weight', tone:'acid', kind:'trait',
    cond:'Meiste Spiele pro Spieltag, ab 20 Spieltagen und Ø 7',
    val:p => (p.days >= 20 && p.games/p.days >= 7) ? p.games/p.days : null,
    ev:(p,v) => `Ø ${v.toFixed(1)} Spiele an jedem seiner ${p.days} Spieltage`},

  {id:'trait_founder', name:'Der Gründervater', ic:'egg', tone:'gold', kind:'trait',
    cond:'Beim allerersten Spieltag der Liga dabei — und mit den meisten Spielen seither',
    val:p => (p.founder && p.games >= 50) ? p.games : null,
    ev:(p,v,C) => `Seit dem ersten Spieltag am ${C.firstLabel} · ${v} Spiele`},

  {id:'arc_veteran', name:'Der Veteran', ic:'calendar', tone:'blue', kind:'arc',
    cond:'In den meisten Saisons gespielt, mindestens 6',
    min:6, raw:p => p.seasons,
    ev:(p,v,C) => `${v} von ${C.seasonCount} Saisons mitgespielt`},


  // ── 3. Schattenseiten ─────────────────────────────────────────────
  // Bewusst OHNE `unit`: „noch drei 0:10-Niederlagen bis zum Bodenlosen"
  // wäre ein Ziel, das niemand haben will.
  // Bewusst OHNE `unit`: „noch drei 0:10-Niederlagen bis zum Bodenlosen"
  // wäre ein Ziel, das niemand haben will.
  // Bewusst OHNE `unit`: „noch drei 0:10-Niederlagen bis zum Bodenlosen"
  // wäre ein Ziel, das niemand haben will.
  {id:'rec_lossstreak', name:'Die schwarze Serie', ic:'dropTriple', tone:'red', kind:'shame',
    cond:'Längste Niederlagenserie der Liga-Geschichte',
    min:7, raw:p => p.lossStreak,
    ev:(p,v) => `${v} Niederlagen${p.lossSpan ? ' · ' + p.lossSpan : ''}`},

  // Anteil statt Summe: Wer am längsten dabei ist, hat zwangsläufig die meisten
  // 0:10 kassiert. Interessant ist, wie oft es ihn erwischt, WENN er verliert.
  {id:'rec_debacle', name:'Der Bodenlose', ic:'meltDown', tone:'red', kind:'shame',
    cond:'Höchster Anteil 0:10-Niederlagen an allen eigenen Niederlagen, ab 60 Niederlagen',
    val:p => (p.losses >= 60 && p.debacle/p.losses >= 0.03) ? p.debacle/p.losses : null,
    ev:(p,v) => `${p.debacle} seiner ${p.losses} Niederlagen endeten 0:10`},

  {id:'rec_bitter', name:'Der ewige Pechvogel', ic:'heartBroken', tone:'red', kind:'shame',
    cond:'Höchster Anteil 9:10-Niederlagen an allen eigenen Niederlagen, ab 60 Niederlagen',
    val:p => (p.losses >= 60 && p.bitter/p.losses >= 0.08) ? p.bitter/p.losses : null,
    ev:(p,v) => `${p.bitter} seiner ${p.losses} Niederlagen endeten 9:10 · ${Math.round(v*100)} %`},

  {id:'rec_sieve', name:'Das Scheunentor', ic:'hole', tone:'red', kind:'shame',
    cond:'Meiste Gegentore pro Spiel in der Abwehr, ab 60 Abwehrspielen',
    val:p => (p.defG >= 60 && p.defConceded/p.defG >= 6.0) ? p.defConceded/p.defG : null,
    ev:(p,v) => `Ø ${v.toFixed(1)} Gegentore in ${p.defG} Abwehrspielen`},

  {id:'trait_choker', name:'Die zittrige Hand', ic:'iceCube', tone:'red', kind:'trait',
    cond:'Stärkster Einbruch in engen Spielen, mindestens 9 Prozentpunkte',
    val:p => {
      if(p.close < 20 || p.close < p.games * 0.2) return null;
      const d = (p.wins/p.games) - (p.closeW/p.close);
      return d >= 0.09 ? d : null;
    },
    ev:(p,v) => `Nur ${Math.round(p.closeW/p.close*100)} % in engen Spielen · −${Math.round(v*100)} Punkte`},

  {id:'arc_fall', name:'Der freie Fall', ic:'trendCrash', tone:'red', kind:'arc',
    cond:'Größter Elo-Absturz von einer Saison zur nächsten, mindestens −150',
    val:p => (p.fall && p.fall.d <= -150) ? -p.fall.d : null,
    ev:p => `${Math.round(p.fall.d)} Elo von ${p.fall.from} auf ${p.fall.to}`},
];
const CHRONICLE_BY_ID = {};
// Einträge mit `raw`+`min` bekommen ihr `val` hier abgeleitet. Der Rohwert
// bleibt erhalten, weil die Fortschritts-Anzeige (nextRecordFor) ihn auch
// dann braucht, wenn ein Spieler die Untergrenze noch gar nicht erreicht.
CHRONICLES.forEach((c, i) => {
  c.ord = i;
  if(!c.val && c.raw){
    const min = c.min || 0;
    c.val = (p, C) => { const v = c.raw(p, C); return (v != null && isFinite(v) && v >= min) ? v : null; };
  }
  CHRONICLE_BY_ID[c.id] = c;
});

// Ein Durchlauf über ALLE Matches. Liefert pro Spieler alles, was die
// Chroniken brauchen, plus die Liga-Eckdaten.
function _chronicleCtx(){
  const key = matches.length + '_' + _cache.version;
  if(_cache._chronCtxKey === key) return _cache._chronCtx;

  const gSim = getGlobalSim();
  const pm = pmap();
  const ms = matches.slice().sort((a,b)=>mts(a)-mts(b));
  const P = {};
  const run = {}, runL = {};              // laufende Sieg-/Niederlagenserie
  const runStart = {}, runLStart = {};
  const noBlow = {}, noBlowStart = {};    // laufende Serie ohne deutliche Pleite
  const daySet = {}, dayCount = {}, dayWins = {};
  const dayElo = {};                      // pid → {Tages-Key: Elo-Summe des Tages}
  const seasonAgg = {};                   // pid → {Saison-ID: {g, w}}
  const weekAgg = {};                     // pid → {Wochen-Key: {g, w}}
  const lastRes = {};                     // pid → letztes Ergebnis (true = Sieg)
  const seasonSet = {};
  const mates = {};
  const allDays = new Set();
  const allSeasons = new Set();
  const dLabel = (k) => { const [y,m,d] = k.split('-'); return d + '.' + m + '.'; };
  const ensure = (id) => P[id] || (P[id] = {
    id, games:0, wins:0, losses:0, gf:0, ga:0, gd:0,
    atkG:0, atkW:0, defG:0, defW:0, atkGoals:0, defConceded:0,
    winStreak:0, winSpan:'', lossStreak:0, lossSpan:'',
    perfect:0, debacle:0, nail:0, bitter:0, close:0, closeW:0,
    blowW:0, blowL:0, upsets:0, days:0, maxDay:0, maxDayLabel:'',
    favG:0, favW:0,                  // Partien als Außenseiter (unter 50 % Chance)
    uplift:null, upliftMates:0,      // Effekt auf die eigenen Mitspieler
    perfDays:0, bigDays:0,           // volle Spieltage / davon ohne Niederlage
    seasons:0, firstDay:'', firstLabel:'', lastDay:'',
    peak:0, potw:0, potd:0, founder:false,
    // ── v9.20: gemessen an dem, was der Spieler selbst bestritten hat ──
    weeks:0, posWeeks:0,             // Kalenderwochen mit Spielen / davon positiv
    afterLoss:0, afterLossOpp:0,     // Antwort auf die eigene letzte Niederlage
    // ── v9.22: einzelne Ausnahmetage und -serien ──
    cleanDay:0, cleanDayLabel:'',    // groesster Spieltag ohne eine einzige Pleite
    dayElo:null, dayEloLabel:'',     // bester Elo-Tag der Laufbahn
    noBlow:0, noBlowSpan:'',         // laengste Serie ohne deutliche Niederlage
    bestMonth:null,                  // {q, g, sid} — der beste Monat seines Lebens
    rise:null, fall:null,
  });

  ms.forEach(m => {
    const day = mdayKey(m);
    allDays.add(day);
    const wd = new Date(m.created_at);
    const wkey = wd.getFullYear() + '-W' + isoWeek(wd);
    const sid = (seasonOf(m.created_at) || {}).id;
    if(sid) allSeasons.add(sid);
    const ids = [m.a1, m.a2, m.b1, m.b2];
    const mateOf = id => id===m.a1 ? m.a2 : id===m.a2 ? m.a1 : id===m.b1 ? m.b2 : m.b1;
    ids.forEach(id => {
      if(!id) return;
      const p = ensure(id);
      const onA = (id===m.a1 || id===m.a2);
      const w = (onA && m.winner==='A') || (!onA && m.winner==='B');
      const gf = onA ? m.score_a : m.score_b;
      const ga = onA ? m.score_b : m.score_a;
      const pos = id===m.a1 ? m.a1_pos : id===m.a2 ? m.a2_pos : id===m.b1 ? m.b1_pos : m.b2_pos;
      const diff = gf - ga;
      p.games++; p.gf += gf; p.ga += ga; p.gd += diff;
      if(w) p.wins++; else p.losses++;
      if(pos === 'atk'){ p.atkG++; p.atkGoals += gf; if(w) p.atkW++; }
      else             { p.defG++; p.defConceded += ga; if(w) p.defW++; }
      if(w && gf===10 && ga===0)  p.perfect++;
      if(!w && gf===0 && ga===10) p.debacle++;
      if(w && gf===10 && ga===9)  p.nail++;
      if(!w && gf===9 && ga===10) p.bitter++;
      if(Math.abs(diff) <= 2){ p.close++; if(w) p.closeW++; }
      if(w && diff >= 7) p.blowW++;
      if(!w && diff <= -7) p.blowL++;
      const exp = myExp(id, m);
      if(w && exp < 0.35) p.upsets++;
      if(exp < 0.50){ p.favG++; if(w) p.favW++; }
      if(!p.firstDay){ p.firstDay = day; p.firstLabel = sid ? seasonLabel(sid) : dLabel(day); }
      p.lastDay = day;
      if(!daySet[id]) daySet[id] = new Set();
      daySet[id].add(day);
      if(!dayCount[id]) dayCount[id] = {};
      dayCount[id][day] = (dayCount[id][day] || 0) + 1;
      if(dayCount[id][day] > p.maxDay){ p.maxDay = dayCount[id][day]; p.maxDayLabel = dLabel(day); }
      if(!dayWins[id]) dayWins[id] = {};
      if(w) dayWins[id][day] = (dayWins[id][day] || 0) + 1;
      if(!weekAgg[id]) weekAgg[id] = {};
      if(!weekAgg[id][wkey]) weekAgg[id][wkey] = {g:0, w:0};
      weekAgg[id][wkey].g++; if(w) weekAgg[id][wkey].w++;
      if(!dayElo[id]) dayElo[id] = {};
      dayElo[id][day] = (dayElo[id][day] || 0) + ((m.deltas && m.deltas[id]) || 0);
      if(sid){
        if(!seasonAgg[id]) seasonAgg[id] = {};
        if(!seasonAgg[id][sid]) seasonAgg[id][sid] = {g:0, w:0};
        seasonAgg[id][sid].g++; if(w) seasonAgg[id][sid].w++;
      }
      // Serie ohne Debakel: ein 7-Tore-Rueckstand setzt zurueck, sonst laeuft
      // sie weiter — Siege und knappe Pleiten zaehlen beide als „unversehrt".
      if(!w && diff <= -7){ noBlow[id] = 0; }
      else {
        noBlow[id] = (noBlow[id] || 0) + 1;
        if(noBlow[id] === 1) noBlowStart[id] = day;
        if(noBlow[id] > p.noBlow){
          p.noBlow = noBlow[id];
          p.noBlowSpan = noBlowStart[id] === day ? dLabel(day)
                       : (dLabel(noBlowStart[id]) + '–' + dLabel(day));
        }
      }
      // Was macht er direkt nach einer Pleite? Gezählt wird die Gelegenheit,
      // nicht das Spiel danach im Kalender — die Reihenfolge ist chronologisch.
      if(lastRes[id] === false){ p.afterLossOpp++; if(w) p.afterLoss++; }
      lastRes[id] = w;
      if(sid){ if(!seasonSet[id]) seasonSet[id] = new Set(); seasonSet[id].add(sid); }
      // Serien in beide Richtungen — die schwarze Serie ist so viel wert
      // wie die goldene, nur eben andersherum.
      if(w){
        runL[id] = 0;
        run[id] = (run[id] || 0) + 1;
        if(run[id] === 1) runStart[id] = day;
        if(run[id] > p.winStreak){
          p.winStreak = run[id];
          p.winSpan = runStart[id] === day ? dLabel(day) : (dLabel(runStart[id]) + '–' + dLabel(day));
        }
      } else {
        run[id] = 0;
        runL[id] = (runL[id] || 0) + 1;
        if(runL[id] === 1) runLStart[id] = day;
        if(runL[id] > p.lossStreak){
          p.lossStreak = runL[id];
          p.lossSpan = runLStart[id] === day ? dLabel(day) : (dLabel(runLStart[id]) + '–' + dLabel(day));
        }
      }
      // Duelle und Partnerschaften
      const mate = mateOf(id);
      if(mate){
        if(!mates[id]) mates[id] = {};
        if(!mates[id][mate]) mates[id][mate] = {g:0, w:0};
        mates[id][mate].g++; if(w) mates[id][mate].w++;
      }
    });
  });

  // Liga-Eckdaten
  const dayKeys = [...allDays].sort();
  const firstDayKey = dayKeys[0] || '';
  const C = {
    P, startElo: cfg.start_elo,
    totalDays: dayKeys.length,
    firstDay: firstDayKey,
    firstLabel: firstDayKey ? (()=>{ const [y,mo,d] = firstDayKey.split('-'); return d + '.' + mo + '.' + y; })() : '',
    seasonCount: allSeasons.size,
  };

  // Zu kurze Laufbahnen und versteckte Spieler fliegen raus, BEVOR die
  // Rekorde vergeben werden — sonst hält ein Gast den Liga-Rekord.
  Object.keys(P).forEach(id => {
    if(!pm[id] || pm[id].hidden || P[id].games < CHRON_MIN_GAMES){ delete P[id]; return; }
  });

  const potwCounts = _winnerCountsOf(matches, 'week');
  const potdCounts = _winnerCountsOf(matches, 'day');

  Object.keys(P).forEach(id => {
    const p = P[id];
    p.days = daySet[id] ? daySet[id].size : 0;
    p.seasons = seasonSet[id] ? seasonSet[id].size : 0;
    // Volle Spieltage (4+ Partien) und die makellosen darunter.
    const dc = dayCount[id] || {}, dw = dayWins[id] || {};
    const de = dayElo[id] || {};
    Object.keys(dc).forEach(day => {
      // Der groesste Tag, an dem er nichts abgegeben hat. Neun Spiele, neun
      // Siege ist eine andere Aussage als zwei Spiele, zwei Siege — deshalb
      // zaehlt hier die GROESSE des makellosen Tages, nicht ihre Anzahl.
      if((dw[day] || 0) === dc[day] && dc[day] > p.cleanDay){
        p.cleanDay = dc[day];
        p.cleanDayLabel = dLabel(day);
      }
      if(p.dayElo == null || de[day] > p.dayElo){ p.dayElo = de[day]; p.dayEloLabel = dLabel(day); }
      if(dc[day] < 4) return;
      p.bigDays++;
      if((dw[day] || 0) === dc[day]) p.perfDays++;
    });
    // Der beste Monat seines Lebens — als Quote, ab 15 Spielen in dem Monat.
    const sa = seasonAgg[id] || {};
    Object.keys(sa).forEach(sd => {
      const r = sa[sd];
      if(r.g < 15) return;
      const q = r.w / r.g;
      if(!p.bestMonth || q > p.bestMonth.q) p.bestMonth = {q, g:r.g, w:r.w, sid:sd};
    });
    p.peak = Math.round(gSim.peakElo[id] || cfg.start_elo);
    p.potw = potwCounts[id] || 0;
    p.potd = potdCounts[id] || 0;
    p.founder = !!(firstDayKey && p.firstDay === firstDayKey);

    // Kalenderwochen: wie viele hat er bestritten, wie viele davon standen
    // am Ende im Plus. Das ist die Bezugsgröße für „Der Wochenkönig".
    const wa = weekAgg[id] || {};
    const wk = Object.keys(wa);
    p.weeks = wk.length;
    p.posWeeks = wk.filter(k => wa[k].w > wa[k].g - wa[k].w).length;

    // Uplift über die ganze Laufbahn: Wie viel häufiger gewinnen seine Partner
    // MIT ihm als OHNE ihn? Gewichtet nach gemeinsamen Spielen. Die Zahl lässt
    // sich nicht durch Fleiß erzeugen — wer alles mitspielt, IST der Schnitt.
    let uNum = 0, uDen = 0, uN = 0;
    Object.keys(mates[id] || {}).forEach(mid => {
      const r = mates[id][mid], M = P[mid];
      if(!M || r.g < 25) return;
      const soloG = M.games - r.g, soloW = M.wins - r.w;
      if(soloG < 40) return;
      uNum += (r.w / r.g - soloW / soloG) * r.g;
      uDen += r.g; uN++;
    });
    p.uplift = uDen ? uNum / uDen : null;
    p.upliftMates = uN;

    // Elo-Sprünge zwischen zwei gespielten Saisons
    const played = [];
    Object.keys(gSim.seasonEndElos || {}).sort().forEach(sid => {
      const g = (gSim.seasonPlayed[sid] || {})[id] || 0;
      if(g >= 10 && gSim.seasonEndElos[sid][id] !== undefined){
        played.push({sid, elo:gSim.seasonEndElos[sid][id]});
      }
    });
    for(let i = 1; i < played.length; i++){
      const d = played[i].elo - played[i-1].elo;
      const rec = {d, from:seasonLabel(played[i-1].sid), to:seasonLabel(played[i].sid)};
      if(!p.rise || d > p.rise.d) p.rise = rec;
      if(!p.fall || d < p.fall.d) p.fall = rec;
    }

    // Früher stand hier eine Titel-Bilanz (champCount, champStreak, …). Kein
    // Rekord hat sie je gelesen — sie war ein Rest aus der Zeit, als Rekorde
    // nachzählten, wie oft jemand einen Saisontitel geholt hat. Genau das ist
    // die Doppelung, die es nicht mehr geben soll (siehe ABGRENZUNG oben).
    // Wegfallen darf sie auch deshalb, weil sie pro Spieler einen
    // seasonTitleHistory-Durchlauf gekostet hat.
  });

  _cache._chronCtxKey = key;
  _cache._chronCtx = C;
  return C;
}

// Vergabe für alle Spieler auf einmal — Liga-Rekorde brauchen ohnehin das
// ganze Feld, und der Profilaufruf wird damit zum reinen Lookup.
// Vergabe für die ganze Liga in EINEM Durchlauf.
//
// EIN REKORD = EIN BESTWERT. Jeder Rekord geht an den, der ihn wirklich hält.
// Kein Reihum-Verfahren: Wer 221 Siege hat, ist der Rekordsieger, auch wenn
// er schon den höchsten Elo-Gipfel hält. Alles andere wäre kein Rekord.
// Und wer denselben Bestwert erreicht hat, hält denselben Rekord: bei exaktem
// Gleichstand tragen ihn alle Gleichauf-Halter (entry.pids/entry.holders).
//
// Dass jeder Spieler trotzdem nur EINE Auszeichnung trägt, ist eine reine
// ANZEIGE-Regel: `byPid` behält je Spieler den wertvollsten seiner Rekorde
// (Katalog-Reihenfolge = Wertigkeit). `byId` bleibt vollständig — die
// Liga-Liste zeigt jeden Rekord mit seinem echten Halter.
function allChronicles(){
  const key = matches.length + '_' + _cache.version;
  if(_cache._chronAllKey === key) return _cache._chronAll;
  const C = _chronicleCtx();
  const byPid = {}, byId = {};
  CHRONICLES.forEach(def => {
    // Bestwert — und ALLE, die ihn halten. Ein Rekord wird nicht per
    // Tiebreak zugeteilt: Wer denselben Wert erreicht hat, hat denselben
    // Rekord. Bei exaktem Gleichstand tragen ihn beide.
    let bv = -Infinity;
    const vals = {};
    Object.keys(C.P).forEach(id => {
      const v = def.val(C.P[id], C);
      if(v == null || !isFinite(v)) return;
      vals[id] = v;
      if(v > bv) bv = v;
    });
    const pids = Object.keys(vals).filter(id => Math.abs(vals[id] - bv) <= 1e-9)
      // Nur noch die ANZEIGE-Reihenfolge, keine Auswahl mehr.
      .sort((a, b) => C.P[b].wins - C.P[a].wins || C.P[b].gd - C.P[a].gd || (a < b ? -1 : 1));
    if(!pids.length) return;
    const holders = pids.map(id => ({pid:id, ev:def.ev(C.P[id], bv, C)}));
    const entry = {
      id:def.id, name:def.name, ic:def.ic, tone:def.tone, kind:def.kind,
      cond:def.cond, ord:def.ord, pid:pids[0], pids, holders,
      shared:pids.length > 1, val:bv, ev:holders[0].ev
    };
    byId[def.id] = entry;
    // Jeder Halter bekommt den Eintrag mit SEINEM Beleg — bei geteilten
    // Rekorden steht bei jedem die eigene Zahl, nicht die des anderen.
    holders.forEach(h => {
      if(byPid[h.pid]) return;        // erster Treffer = wertvollster
      byPid[h.pid] = Object.assign({}, entry, {ev:h.ev, mine:h.pid});
    });
  });
  const res = {byPid, byId, rated:Object.keys(C.P).length};
  _cache._chronAllKey = key;
  _cache._chronAll = res;
  return res;
}

// Namen aller Halter eines Rekords, fertig für die Anzeige („Leon & Martin").
// Alle Liga-Rekorde, die ein Spieler haelt — in Katalog-Reihenfolge, also
// wertvollster zuerst. `chronicleOf` liefert davon nur den ersten; das Profil
// zeigt den Rest hinter „Mehr anzeigen".
function chroniclesOfPlayer(pid){
  let all;
  try { all = allChronicles(); } catch(e){ return []; }
  const out = [];
  CHRONICLES.forEach(def => {
    const e = all.byId[def.id];
    if(!e) return;
    const h = (e.holders || [{pid:e.pid, ev:e.ev}]).find(x => x.pid === pid);
    if(!h) return;
    out.push(Object.assign({}, e, {ev:h.ev, mine:pid}));
  });
  return out;
}

function _chronHolderNames(entry){
  if(!entry) return '';
  const names = (entry.pids || [entry.pid]).map(id => { const p = pmap()[id]; return p ? p.name : '?'; });
  return names.length > 1 ? names.slice(0, -1).join(', ') + ' & ' + names[names.length - 1] : names[0];
}

// Was fehlt einem Spieler ohne Rekord bis zum nächstgelegenen? Nur zählbare
// Rekorde kommen infrage (`unit`) — und keine Schattenseiten: „noch drei
// 0:10-Niederlagen" wäre ein Ziel, das niemand haben will.
// Gewählt wird der RELATIV nächste, damit nicht immer derselbe Rekord mit
// der kleinsten absoluten Zahl vorschlägt.
function nextRecordFor(pid){
  let C, all;
  try { C = _chronicleCtx(); all = allChronicles(); } catch(e){ return null; }
  const p = C.P[pid];
  if(!p || all.byPid[pid]) return null;
  let best = null;
  CHRONICLES.forEach(def => {
    if(!def.unit || def.kind === 'shame') return;
    const mine = def.raw(p, C);
    if(mine == null || !isFinite(mine)) return;
    const lead = all.byId[def.id];
    // Ohne Halter reicht die Untergrenze, sonst muss der Bestwert fallen.
    const target = lead ? lead.val : (def.min || 0);
    const need = lead ? Math.floor(target - mine) + 1 : Math.ceil(target - mine);
    if(need <= 0) return;
    const rel = need / Math.max(1, target);
    if(!best || rel < best.rel){
      best = {def, rel, need, mine, lead,
              holder: lead ? _chronHolderNames(lead) : null, target};
    }
  });
  if(!best) return null;
  return {
    id:best.def.id, name:best.def.name, ic:best.def.ic, tone:best.def.tone,
    cond:best.def.cond, need:best.need, unit:best.def.unit,
    have:Math.round(best.mine), target:Math.round(best.target),
    holder:best.holder,
    txt: `Noch ${best.need} ${best.def.unit}` +
         (best.holder ? ` — ${best.holder} hält ${Math.round(best.target)}`
                      : ` bis zur Untergrenze von ${Math.round(best.target)}`)
  };
}

// Die eine Chronik eines Spielers — oder null.
function chronicleOf(pid){
  try { return allChronicles().byPid[pid] || null; } catch(e){ return null; }
}

// Wer hält welche Chronik? Für die Liga-Ansicht. {chronId → Chronik}
function chronicleHolders(){
  try { return allChronicles().byId; } catch(e){ return {}; }
}

// Der Titel, der im Profil unter dem Namen steht: laufender Saisontitel vor
// letztem abgeschlossenem. Ehrentitel gibt es bewusst nicht mehr — sie waren
// nur eine zweite Anzeige derselben Aussage.
function playerTitleBadge(pid){
  const rows = seasonTitleHistory(pid);
  const cur = rows.find(r => r.live && r.title);
  if(cur) return {kind:'season', name:cur.title.name, ic:cur.title.ic, tone:cur.title.tone,
                  sub:cur.label + ' · läuft', live:true, sid:cur.sid, ev:cur.title.ev};
  for(let i = rows.length - 1; i >= 0; i--){
    if(!rows[i].live && rows[i].title){
      const r = rows[i];
      return {kind:'season', name:r.title.name, ic:r.title.ic, tone:r.title.tone,
              sub:r.label, live:false, sid:r.sid, ev:r.title.ev};
    }
  }
  return null;
}

// ─── §13.4c Titelrennen der laufenden Saison ─────────────────────────
// Wer führt gerade bei welchem Titel — und wie klar? Genutzt vom
// „Tafel im Entstehen"-Block und von der Fun-Fact-Vorlage.
// Nutzt denselben Durchlauf, nur auf die laufende Saison angewendet.
function seasonTitleRace(sid){
  if(!sid) sid = currentSeason().id;
  const t = seasonTitles(sid);
  const C = _seasonTitleCtx(sid);
  const takenNow = new Set(t.awarded.map(a => a.pid));
  return SEASON_TITLES.map(def => {
    const held = t.awarded.find(a => a.titleId === def.id);
    if(held){
      // Verfolger: bester freier Spieler, der die Bedingung ebenfalls erfüllt
      const chase = def.pick(C, new Set([...takenNow].filter(x => x !== held.pid).concat([held.pid])));
      return {titleId:def.id, name:def.name, ic:def.ic, tone:def.tone, cond:def.cond,
              pid:held.pid, ev:held.ev, chaser:chase || null};
    }
    return {titleId:def.id, name:def.name, ic:def.ic, tone:def.tone, cond:def.cond,
            pid:null, ev:null, chaser:null};
  });
}

