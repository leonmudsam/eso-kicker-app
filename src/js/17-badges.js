// ╔═══ §7 ─── BADGE-SYSTEM (permanente Auszeichnungen) ─────────────────╗
//     ⚑ HOTSPOT — neue Badges benötigen Updates an MEHREREN Stellen.
//
//     Architektur:
//       BADGES[]              — Definitionen [§7.1]
//       BADGE_RARITY{}        — Klassen-Map  [§7.2]
//       RARITY_META{}         — Anzeige-Map  [§7.2]
//       count*-Funktionen     — Aggregat-Counter (für Profil) [§7.3]
//       getBadgeEarnedCache() — Match-Trigger fire() [§7.4]
//
//     Pro Match werden im Cache-Walk inkrementelle States pro Spieler
//     geführt; fire('badge_id') schreibt einen Eintrag. Ohne fire() taucht
//     das Badge NICHT im Match-Review/Achievement-Toast auf — nur im Profil.
// ╚═════════════════════════════════════════════════════════════════════════╝
// Badges sind dauerhafte Achievements, die ein Spieler einmal freischaltet und für immer behält.
// Berechnet clientseitig aus der Match-Historie — kein DB-Umbau nötig.
// Reihenfolge im Array = Anzeige-Reihenfolge im Badge-Sheet (Grid mit 2 Spalten).
// Paare unten: jede Zeile hier = eine Zeile im 2-Spalten-Grid (links/rechts).
// ⚑ HOTSPOT — BADGES-Array. Die vollständige Liste steht in CLAUDE.md §10.1;
//   eine Auszeichnung hängt an mehr als dieser einen Datei:
//   - Eintrag hier (mit ic/name/desc/count), Icon in §1.1
//   - Eintrag in BADGE_RARITY (§7.2) — ohne ihn gilt still `common`, die
//     billigste Klasse, und das Badge zählt fürs Prestige wie ein Zittersieg
//   - RARITY_META.<rarity>.total nachziehen — sonst lügt der Zähler im Blatt
//   - BADGE_ART, falls es keinen Ereignis-Charakter hat, und BADGE_WUERDE nur
//     dann, wenn es höchstens einmal je Saison zu holen ist [§13.8]
//   - ggf. fire('badge_id') in getBadgeEarnedCache (§7.4) — sonst kein
//     Match-Trigger / kein Achievement-Toast / kein Chip im Match-Review
const BADGES=[
  // ══ EINMALIGE BADGES (Karriere-Meilensteine) ══
  // Zeile 1 — Debütant, Stammgast
  {id:'first_match',ic:'egg',name:'Debütant',desc:'Match gespielt',
    multi:true,count:(id,ms)=>countGames(id,ms)>=1?1:0},
  {id:'games25',ic:'controller',name:'Stammgast',desc:'25 Matches gespielt',
    multi:true,count:(id,ms)=>countGames(id,ms)>=25?1:0},
  // Zeile 2 — Legende, Allrounder
  {id:'games150',ic:'diamond',name:'Legende',desc:'150 Matches gespielt',
    multi:true,count:(id,ms)=>countGames(id,ms)>=150?1:0},
  {id:'allrounder',ic:'refresh',name:'Allrounder',desc:'20+ Siege auf jeder Position',
    multi:true,count:(id,ms)=>{const s=playerStats(id,ms);return(s.atkW>=20&&s.defW>=20)?1:0;}},
  // Zeile 2b — Urgestein, Siegermaschine (Langzeit-Meilensteine, v9.17)
  // Bewusst goldene Stufen ÜBER „Legende" (150 Matches): Sie belohnen nicht
  // einen einzelnen guten Tag, sondern jahrelanges Dabeisein bzw. dauerhaften
  // Erfolg. Beide zählen über die vorhandenen Helfer countGames/countWins —
  // dieselbe Quelle wie Profil und Rangliste, damit nichts auseinanderläuft.
  // Die IDs nennen noch die alten Schwellen (250/200). Sie bleiben stehen,
  // weil sie in News-, Toast- und Popover-Zuordnungen stecken; maßgeblich ist
  // allein die Zahl in count/desc — seit v9.18 jeweils 300.
  {id:'games250',ic:'weight',name:'Urgestein',desc:'300 Matches gespielt',
    multi:true,count:(id,ms)=>countGames(id,ms)>=300?1:0},
  {id:'wins200',ic:'unstoppable',name:'Siegermaschine',desc:'300 Siege gesammelt',
    multi:true,count:(id,ms)=>countWins(id,ms)>=300?1:0},
  // Zeile 3 — Abwehrchef, Mittelstürmer
  {id:'def50',ic:'shieldStar',name:'Abwehrchef',desc:'50 Spiele als Abwehrspieler',
    multi:true,count:(id,ms)=>{const s=playerStats(id,ms);return s.defG>=50?1:0;}},
  {id:'atk50',ic:'bolt2',name:'Mittelstürmer',desc:'50 Spiele als Stürmer',
    multi:true,count:(id,ms)=>{const s=playerStats(id,ms);return s.atkG>=50?1:0;}},
  // Zeile 4 — Aufsteiger, Dominator
  // v9.18: JEDE SAISON neu erreichbar. Gezählt wird die Anzahl der Saisons, in
  // denen der Spieler die Marke geknackt hat — nicht, wie oft er die Grenze
  // überquert. Wer im Juni auf 420 steht, im Juli auf 380 fällt und im August
  // wieder auf 410 steigt, hat zwei Dominator-Saisons, nicht drei.
  {id:'climber_100',ic:'climb',name:'Aufsteiger',desc:'In einer Saison 100 Elo erreicht (je Saison zählbar)',
    multi:true,count:(id,ms)=>countSeasonsAtElo(id,100)},
  {id:'dominator_400',ic:'dominator',name:'Dominator',desc:'In einer Saison 400 Elo erreicht (je Saison zählbar)',
    multi:true,count:(id,ms)=>countSeasonsAtElo(id,400)},
  // Zeile 5 — Dynastie, Vize-Meister
  {id:'dynasty_600',ic:'temple',name:'Dynastie',desc:'In einer Saison 600 Elo erreicht (je Saison zählbar)',
    multi:true,count:(id,ms)=>countSeasonsAtElo(id,600)},

    // ══ MEHRFACH-BADGES — gruppiert nach Thema ══
//Reihenfolge überarbeitet / Möglciherweise Abweichung von Namen in //
  {id:'upset_king',ic:'tornado',name:'Upset-König',desc:'Als Underdog gewonnen (<35% Chance)',
    multi:true,count:(id,ms)=>ms.filter(m=>matchOf(id,m)&&won(id,m)&&myExp(id,m)<0.35).length},
  // Zeile 6 — Frühschicht, Unschlagbar (Tages-Patterns)
  {id:'early_bird',ic:'sunrise',name:'Frühschicht',desc:'Erstes Match des Tages gewonnen',
    multi:true,count:(id,ms)=>countEarlyBirdDays(id,ms)},
  {id:'unbeatable',ic:'crownPlus',name:'Unschlagbar',desc:'Ganzer Tag ohne Niederlage (min. 3 Spiele)',
    multi:true,count:(id,ms)=>countUnbeatableDays(id,ms)},
  // Zeile 7 — Comeback-Tag, Revanchist (Wiedergutmachung)
  {id:'comeback_day',ic:'comeback',name:'Comeback-Tag',desc:'Tag mit Niederlage gestartet und mit Sieg beendet (min. 3 Matches an dem Tag)',
    multi:true,count:(id,ms)=>countComebackDays(id,ms)},
  {id:'revanchist',ic:'rematch',name:'Revanchist',desc:'Nach Niederlage gegen ein Team direkt im nächsten Match wieder auf dasselbe Team getroffen und gewonnen',
    multi:true,count:(id,ms)=>countRevenge(id,ms)},
  // Zeile 8 — Klares Ding, Krimi-Reihe (Tordifferenz-Pattern)
  {id:'clear_win',ic:'thumbsUp',name:'Klares Ding',desc:'Sieg mit Tordifferenz ≥ 7',
    multi:true,count:(id,ms)=>countClearWins(id,ms)},
  {id:'krimi',ic:'thriller',name:'Krimi-Reihe',desc:'5 Spiele in Folge mit Tordifferenz ≤ 2 (Sieg oder Niederlage)',
    multi:true,count:(id,ms)=>countKrimiStreaks(id,ms)},
  // Zeile 9 — Wiederholungstäter, Losing Streak
  {id:'repeat_score',ic:'duplicate',name:'Wiederholungstäter',desc:'3 Siege in Folge mit identischem Endstand',
    multi:true,count:(id,ms)=>countRepeatScoreStreaks(id,ms)},
  {id:'losing5',ic:'trendCrash',name:'Losing Streak',desc:'5 Niederlagen in Folge',
    multi:true,count:(id,ms)=>countLossStreakOccurrences(id,ms,5)},
  // Zeile 10 — Absoluter Verlierer, Absoluter Sieger
  {id:'perfect_loss',ic:'dizzy',name:'Absoluter Verlierer',desc:'0:10 Niederlage',
    multi:true,count:(id,ms)=>ms.filter(m=>matchOf(id,m)&&!won(id,m)&&shutout(id,m,0,10)).length},
  {id:'perfect_win',ic:'hundred',name:'Absoluter Sieger',desc:'10:0 Sieg',
    multi:true,count:(id,ms)=>ms.filter(m=>matchOf(id,m)&&won(id,m)&&shutout(id,m,10,0)).length},
  // Zeile 11 — Nerven aus Stahl,  Zittersieg (Score-Spezial)
   {id:'nerves_of_steel',ic:'nerves',name:'Nerven aus Stahl',desc:'3 Zittersiege (10:9) in Folge',
    multi:true,count:(id,ms)=>countNailBiterStreaks(id,ms,3)},
  {id:'nail_biter',ic:'pinch',name:'Zittersieg',desc:'10:9 Sieg',
    multi:true,count:(id,ms)=>ms.filter(m=>matchOf(id,m)&&won(id,m)&&goalsFor(id,m)===10&&goalsAgainst(id,m)===9).length},
  // Zeile 12 — 5er Serie, 10er Serie
  {id:'streak5',ic:'flame',name:'5er Serie',desc:'5 Siege in Folge',
    multi:true,count:(id,ms)=>countStreakOccurrences(id,ms,5)},
  {id:'streak10',ic:'flameDouble',name:'10er Serie',desc:'10 Siege in Folge',
    multi:true,count:(id,ms)=>countStreakOccurrences(id,ms,10)},
  // Zeile 13 — 15er Serie, 30er Serie
  {id:'streak15',ic:'flameTriple',name:'15er Serie',desc:'15 Siege in Folge',
    multi:true,count:(id,ms)=>countStreakOccurrences(id,ms,15)},
  {id:'streak20',ic:'crownFlame',name:'20er Serie',desc:'20 Siege in Folge',
    multi:true,count:(id,ms)=>countStreakOccurrences(id,ms,20)},
  // Zeile 14 — Mauer, Carry
  {id:'wall_badge',ic:'brick',name:'Mauer',desc:'Sieg mit max. 2 Gegentoren als Verteidiger',
    multi:true,count:(id,ms)=>ms.filter(m=>{if(!matchOf(id,m)||!won(id,m))return false;
      const pos=id===m.a1?m.a1_pos:id===m.a2?m.a2_pos:id===m.b1?m.b1_pos:m.b2_pos;
      return pos==='def'&&goalsAgainst(id,m)<=2;}).length},
  {id:'carry',ic:'weightSmall',name:'Carry',desc:'Sieg mit dem schwächsten Spieler im Match als Mate',
    multi:true,count:(id,ms)=>countCarries(id,ms)},
  // Zeile 15 — Meister, Vize-Meister
  // Der Meister hatte bis hierher KEINE Auszeichnung. Der Vize hatte eine.
  // Wer eine Saison gewinnt, hat das Seltenste geholt, was diese Liga zu
  // vergeben hat — einmal je Monat, und nur an einen.
  {id:'champion',ic:'crown',name:'Meister der Saison',desc:'Saison auf Platz 1 beendet',
    multi:true,count:(id,ms)=>countChampion(id)},
  {id:'vice_champion',ic:'medal2',name:'Vize-Meister',desc:'Saison auf Platz 2 beendet',
    multi:true,count:(id,ms)=>countViceChampion(id)},
  // Zeile 15b — Team der Saison
  // Dasselbe für das beste Duo eines Monats. Es stand bisher nur im
  // Rückblick und im Duo-Profil und war für den Spieler selbst nichts wert.
  {id:'team_of_season',ic:'handshake',name:'Team der Saison',desc:'Bestes Duo einer Saison',
    multi:true,count:(id,ms)=>countTeamOfSeason(id)},
  // Zeile 16 — Award-Sammler
  {id:'award_collector',ic:'medalTrio',name:'Award-Sammler',desc:'In einer Saison min. 5 Tagessieger und 2 Wochensieger',
    multi:true,count:(id,ms)=>countAwardCollector(id)},
  // Zeile 17 — POTW, POTD (Perioden-Auszeichnungen, ganz am Ende)
  {id:'potw',ic:'weekly',name:'Player of the Week',desc:'Höchste Quote in einer Kalenderwoche (min. 5 Siege)',
    multi:true,count:(id,ms)=>countPeriodWins(id,ms,'week')},
  {id:'potd',ic:'trophyDay',name:'Player of the Day',desc:'Meiste Siege an einem Tag (min. 3)',
    multi:true,count:(id,ms)=>countDayWins(id,ms)},
  // ── NEUE BADGES v4 ──
  // Thronfäller: Sieg gegen den Top-1 der laufenden Saison-Rangliste (Stand vor dem Match)
  {id:'kingslayer',ic:'kingFall',name:'Thronfäller',desc:'Sieg gegen den Top-1 Spieler der Saison-Rangliste (Stand zum Zeitpunkt des Matches)',
    multi:true,count:(id,ms)=>countKingslayer(id,ms)},
  // Überholmanöver: Sieg gegen einen Spieler, der dadurch in der Saison-Rangliste überholt wurde
  {id:'overtake',ic:'overtake',name:'Überholmanöver',desc:'Spieler im Match besiegt und ihn dadurch in der Saison-Rangliste überholt',
    multi:true,count:(id,ms)=>countOvertake(id,ms)},
  // ── NEUE BADGES v5 ──
  // Pflichterfüller: Sieg gegen mindestens einen Gegner aus den Bottom-2 der
  // Saison-Rangliste (Stand vor dem Match). Erst ab 5 Spielern in der Saison sinnvoll.
  {id:'duty_done',ic:'trophyCheck',name:'Pflichterfüller',desc:'Sieg gegen mind. einen Gegner aus den Bottom-2 der Saison-Rangliste (Stand zum Zeitpunkt des Matches)',
    multi:true,count:(id,ms)=>countBottomTwoMatchWins(id,ms)},
  // Serienbrecher: Direktsieg, der eine laufende Siegesserie (≥4) eines Gegners beendet hat.
  {id:'streak_breaker',ic:'flameBreak',name:'Serienbrecher',desc:'Siegesserie eines Gegners (mind. 4 in Folge) durch direkten Sieg gestoppt',
    multi:true,count:(id,ms)=>countStreakBreaker(id,ms)},
  // ── NEUE NEGATIV-BADGES v6 ──
  // Schwarzer Tag: ein Tag mit mind. 3 absolvierten Spielen, alle verloren.
  {id:'black_day',ic:'blackDay',name:'Schwarzer Tag',desc:'Tag mit mind. 3 Spielen, alle verloren',
    multi:true,count:(id,ms)=>countBlackDays(id,ms)},
  // Krimi-Versager: 3 knappe Niederlagen (Tordifferenz ≤ 2) in Folge.
  {id:'krimi_loser',ic:'dramaTear',name:'Krimi-Versager',desc:'3 knappe Niederlagen (Tordifferenz ≤ 2) in Folge',
    multi:true,count:(id,ms)=>countCloseLossStreaks(id,ms,3)},
  // ── NEUE LEGENDARY-BADGES v7 ──
  // Untouchable: 3 Saisons in Folge unter den Top-3 abgeschlossen.
  {id:'untouchable',ic:'shieldStar',name:'Untouchable',desc:'3 Saisons in Folge unter den Top-3 abgeschlossen',
    multi:true,count:(id,ms)=>countUntouchable(id)},
  // Mr. Perfect: 3× 10:0-Sieg in einer einzigen Saison.
  {id:'mr_perfect',ic:'tripleCup',name:'Mr. Perfect',desc:'3× 10:0-Sieg in einer Saison',
    multi:true,count:(id,ms)=>countMrPerfect(id)},
  // Allwetter: an 5 verschiedenen Wochentagen Player-of-the-Day geworden.
  {id:'allwetter',ic:'weatherMix',name:'Allwetter',desc:'An 5 verschiedenen Wochentagen Player-of-the-Day geworden',
    multi:true,count:(id,ms)=>countAllwetter(id)},
  // Tag der Götter: 3 eigene Spieltage in Folge als POTD gewonnen.
  {id:'godly_streak',ic:'godRay',name:'Tag der Götter',desc:'An 3 Spieltagen in Folge Player-of-the-Day geworden (nur mitgespielte Tage)',
    multi:true,count:(id,ms)=>countGodlyStreak(id)},
  // ── NEUE NEGATIV-BADGES v8 ──
  // Bittere Pille: 9:10-Niederlage (Pendant zu nail_biter / 10:9-Sieg).
  {id:'bitter_loss',ic:'heartBroken',name:'Bittere Pille',desc:'9:10 Niederlage',
    multi:true,count:(id,ms)=>ms.filter(m=>matchOf(id,m)&&!won(id,m)&&goalsFor(id,m)===9&&goalsAgainst(id,m)===10).length},
  // Mr. Disaster: 3× 0:10-Niederlage in einer Saison (Pendant zu mr_perfect).
  {id:'mr_disaster',ic:'tripleCrash',name:'Mr. Disaster',desc:'3× 0:10-Niederlage in einer Saison',
    multi:true,count:(id,ms)=>countMrDisaster(id)},
  // Zusammenbruch: Tag mit Sieg gestartet, mit Niederlage beendet, min. 3 Matches (Pendant zu comeback_day).
  {id:'crash_day',ic:'crashDay',name:'Zusammenbruch',desc:'Tag mit Sieg gestartet und mit Niederlage beendet (min. 3 Matches an dem Tag)',
    multi:true,count:(id,ms)=>countCrashDays(id,ms)},
  // Angstgegner: 5× in Folge gegen denselben Gegner-Spieler verloren (egal in welcher Konstellation).
  {id:'nemesis',ic:'ghost',name:'Angstgegner',desc:'5× in Folge gegen denselben Gegner verloren',
    multi:true,count:(id,ms)=>countNemesis(id,ms)},
];

// ════════════════════════════════════════════════════════════════════
// BADGE-RARITY-SYSTEM — vier Stufen + Negative eigenständig
// ════════════════════════════════════════════════════════════════════
// Neue Klassifizierung (v8): kalibriert auf reale Achievement-Häufigkeit:
//   • LEGENDARY (12) — extrem selten, Karriere-Highlight
//   • RARE      (14) — schwer, brauchen Skill/Konstanz
//   • COMMON    (20) — bei aktivem Spiel oft erreicht
//   • NEGATIVE  (8)  — „Schande", eigenständig (rot, abgesetzt)
// Jeder Bucket hat eine GERADE Anzahl, damit das 2-Spalten-Grid im Sheet
// sauber aufgeht. Total = 50 Badges (= BADGES-Array-Länge).
//
// DIE KLASSEN SIND GEMESSEN, NICHT GESCHÄTZT. Über die 466 echten Partien
// halten die zwölf legendären null bis drei der zwölf Spieler, die zehn
// seltenen zwei bis sechs, die zwanzig gewöhnlichen sechs bis zwölf. Sechs
// Einträge standen vorher in der falschen Klasse — „Player of the Day"
// (9 Halter, 52 mal vergeben) galt als selten, „Klares Ding" (10 Halter,
// 136 mal) ebenfalls. Das war nicht nur eine falsche Anzeige im Blatt: seit
// die Klasse den Prestige-Wert bestimmt [§13.8], hätte sie den Vielspieler
// über den guten Spieler gestellt.
//
// ⚑ Wer eine Klasse ändert, zieht RARITY_META.total nach — die Anzeige
// „3 / 14" im Blatt zählt aus dieser Zahl, nicht aus dem Bucket.
// ═════════════════════════════════════════════════════════════════════
// ⚑ HOTSPOT — BADGE_RARITY: ordnet jeder Badge-ID eine Rarity-Klasse zu.
// MUSS alle IDs aus BADGES (§7.1) abdecken — fehlt eine, fliegt die Badge
// aus der UI (kein Bucket, kein Icon-Wrapper).
const BADGE_RARITY = {
  // -- LEGENDARY (12) -- 0 bis 3 der zwoelf Spieler halten sie --
  champion:        'legendary', // Meister der Saison — einer je Monat
  team_of_season:  'legendary', // Team der Saison — ein Duo je Monat
  games250:        'legendary', // Urgestein (300 Matches) — Langzeit-Meilenstein
  wins200:         'legendary', // Siegermaschine (300 Siege) — Langzeit-Meilenstein
  dynasty_600:     'legendary', // Dynastie (600 Saison-Elo, je Saison zählbar)
  dominator_400:   'legendary', // Dominator (400 Saison-Elo, je Saison zählbar)
  award_collector: 'legendary', // Award-Sammler (5 POTD + 2 POTW)
  streak15:        'legendary', // 15er Serie
  streak20:        'legendary', // 20er Serie
  untouchable:     'legendary', // Untouchable — 3 Saisons in Folge Top-3
  mr_perfect:      'legendary', // Mr. Perfect — 3x 10:0 in einer Saison
  allwetter:       'legendary', // Allwetter — POTD an 5 verschiedenen Wochentagen
  // -- RARE (10) -- 2 bis 6 Halter --
  vice_champion:   'rare',      // Vize-Meister
  godly_streak:    'rare',      // Tag der Götter — 4 Halter, für legendär zu viele
  repeat_score:    'rare',      // Wiederholungstäter
  streak10:        'rare',      // 10er Serie
  krimi:           'rare',      // Krimi-Reihe
  allrounder:      'rare',      // Allrounder
  unbeatable:      'rare',      // Unschlagbar
  nerves_of_steel: 'rare',      // Nerven aus Stahl
  potw:            'rare',      // Player of the Week
  perfect_win:     'rare',      // Absoluter Sieger — 6 Halter, 16 mal vergeben
  // -- COMMON (20) -- 6 bis 12 Halter --
  first_match:     'common',    // Debütant
  games25:         'common',    // Stammgast
  games150:        'common',    // Legende (150 Matches) — reine Wegmarke, 6 Halter
  atk50:           'common',    // Mittelstürmer
  def50:           'common',    // Abwehrchef
  climber_100:     'common',    // Aufsteiger (100 Saison-Elo, je Saison zählbar)
  early_bird:      'common',    // Frühschicht
  comeback_day:    'common',    // Comeback-Tag
  revanchist:      'common',    // Revanchist
  nail_biter:      'common',    // Zittersieg
  carry:           'common',    // Carry
  kingslayer:      'common',    // Thronfäller — Sieg gegen Top-1
  overtake:        'common',    // Überholmanöver — Spieler in Rangliste überholt
  duty_done:       'common',    // Pflichterfüller — Sieg gegen Bottom-3
  streak_breaker:  'common',    // Serienbrecher — Streak >=4 eines Gegners gestoppt
  wall_badge:      'common',    // Mauer — 8 Halter, 37 mal vergeben
  upset_king:      'common',    // Upset-König — 11 Halter, 54 mal vergeben
  clear_win:       'common',    // Klares Ding — 10 Halter, 136 mal vergeben
  streak5:         'common',    // 5er Serie — 8 Halter, 30 mal vergeben
  potd:            'common',    // Player of the Day — 9 Halter, 52 mal vergeben
  // -- NEGATIVE (8) --
  losing5:         'negative',  // Losing Streak
  perfect_loss:    'negative',  // Absoluter Verlierer
  black_day:       'negative',  // Schwarzer Tag — Tag mit 3+ Spielen, alle verloren
  krimi_loser:     'negative',  // Krimi-Versager — 3 knappe Niederlagen in Folge
  bitter_loss:     'negative',  // Bittere Pille — 9:10-Niederlage
  mr_disaster:     'negative',  // Mr. Disaster — 3x 0:10 in einer Saison
  crash_day:       'negative',  // Zusammenbruch — Tag mit Sieg gestartet, mit Niederlage beendet
  nemesis:         'negative',  // Angstgegner — 5x in Folge gegen denselben Spieler verloren
};


// Was eine Auszeichnung für das Prestige wert ist [§13.8]. Ohne Eintrag
// gilt `ereignis` — das ist der Normalfall: etwas ist passiert.
//   leistung — ein Können, das man wieder abrufen kann. Zählt doppelt.
//   pensum   — hängt nur an der Spielzahl. Zählt ein Viertel.
//   schatten — die Kehrseite. Zählt nicht, zieht aber auch nichts ab.
const BADGE_ART = {
  // Pensum — reine Wegmarken
  first_match:'pensum', games25:'pensum', games150:'pensum', games250:'pensum',
  wins200:'pensum', def50:'pensum', atk50:'pensum',

  // Leistung — wiederholbares Können
  allrounder:'leistung', climber_100:'leistung', dominator_400:'leistung',
  dynasty_600:'leistung', nerves_of_steel:'leistung', streak10:'leistung',
  streak15:'leistung', streak20:'leistung', untouchable:'leistung',
  mr_perfect:'leistung', allwetter:'leistung', godly_streak:'leistung',
  award_collector:'leistung', carry:'leistung', streak_breaker:'leistung',
  potw:'leistung', potd:'leistung', unbeatable:'leistung', wall_badge:'leistung',
  // Vier Nachzügler. Sie fielen bisher durch das Raster und galten über die
  // Vorgabe als 'ereignis' — also halb so viel wert wie ein Können. Alle vier
  // sind aber genau das: gegen Favoriten gewinnen, eine Reihe enger Spiele
  // durchziehen, fünf am Stück gewinnen, eine ganze Saison auf Platz zwei
  // stehen. Sie sind nichts, was einem einmal zustößt.
  upset_king:'leistung', krimi:'leistung', streak5:'leistung',
  vice_champion:'leistung', champion:'leistung', team_of_season:'leistung',

  // Schatten
  losing5:'schatten', perfect_loss:'schatten', black_day:'schatten',
  krimi_loser:'schatten', bitter_loss:'schatten', mr_disaster:'schatten',
  crash_day:'schatten', nemesis:'schatten',
};

// Die Würden [§13.8]: höchstens EINMAL JE SAISON zu holen, und am Können
// gemessen. Nur sie zählen jedes Mal neu — der zweite Meistertitel bringt
// wieder Prestige, der zweihundertste Zittersieg nicht. Wer eine
// Auszeichnung hier einträgt, die sich beliebig oft holen lässt, macht das
// Prestige wieder zu einer Anwesenheitsliste.
//
// `untouchable` (drei Saisons in Folge Top-3) steht bewusst nicht hier: sie
// zählt Saisons, aber überlappend — die vierte Saison in Folge wäre eine
// zweite Auszeichnung für dasselbe.
const BADGE_WUERDE = new Set([
  'champion', 'team_of_season', 'vice_champion',
  'climber_100', 'dominator_400', 'dynasty_600',
  'award_collector', 'mr_perfect',
]);

const RARITY_META = {
  legendary: {label:'Legendary', color:'var(--gold)',   total:12},
  rare:      {label:'Rare',      color:'var(--purple)', total:10},
  common:    {label:'Common',    color:'var(--acid)',   total:20},
  negative:  {label:'Schande',   color:'var(--red)',    total:8},
};
const RARITY_ORDER = ['legendary','rare','common','negative'];

// Liefert die Rarity eines Badges (Default: common falls jemand neu hinzukommt
// und vergisst BADGE_RARITY zu erweitern — verhindert undefined-Bugs).
function rarityOf(badgeId){ return BADGE_RARITY[badgeId] || 'common'; }

// ─── §7.3 Count-Funktionen für die neuen Badges ──────────────────────
// Höchststand je Saison und Spieler: {sid → {pid → Elo}}. Leitet sich aus dem
// vorhandenen Sim-Verlauf ab (eloAfter je Match) — keine zweite Rechenquelle,
// und weil die Elo bei jedem Monatswechsel zurückgesetzt wird, ist der
// Höchststand innerhalb einer Saison genau das, was „400 Elo in einer Saison
// erreicht" meint. Memoisiert am selben Schlüssel wie der Sim.
function seasonPeakElos(){
  const key='speak_'+matches.length+'_'+_cache.version;
  if(_cache._seasonPeakKey===key) return _cache._seasonPeak;
  const hist=getHistoryByMatchId();
  const out={};
  matches.forEach(m=>{
    const h=hist.get(m.id);
    if(!h||!h.eloAfter) return;
    const sid=(seasonOf(m.created_at)||{}).id;
    if(!sid) return;
    const s=out[sid]||(out[sid]={});
    [m.a1,m.a2,m.b1,m.b2].forEach(id=>{
      if(!id) return;
      const e=h.eloAfter[id];
      if(e===undefined) return;
      if(s[id]===undefined||e>s[id]) s[id]=e;
    });
  });
  _cache._seasonPeakKey=key; _cache._seasonPeak=out;
  return out;
}

// In wie vielen Saisons hat der Spieler die Marke erreicht? Einmal pro Saison —
// wer innerhalb einer Saison unter die Marke fällt und wieder darüber klettert,
// zählt trotzdem nur einmal.
function countSeasonsAtElo(id, mark){
  try {
    const sp=seasonPeakElos();
    let n=0;
    Object.keys(sp).forEach(sid=>{ if((sp[sid][id]??-Infinity)>=mark) n++; });
    return n;
  } catch(e){ return 0; }
}

// Anzahl abgeschlossener Saisons, in denen der Spieler Meister wurde.
// Quelle ist seasonChampion — dieselbe wie Krone, Titelband und Saison-Tafel,
// damit die Auszeichnung dem Zeichen nie widerspricht.
function countChampion(id){
  try {
    const cur = currentSeason().id;
    let n = 0;
    (allPastSeasons() || []).forEach(sid => {
      if(sid === cur) return;
      if(seasonChampion(sid) === id) n++;
    });
    return n;
  } catch(e){ return 0; }
}

// Das beste Duo einer Saison: höchster gemeinsamer Elo-Zuwachs, mindestens
// zwei gemeinsame Spiele — dieselbe Regel, nach der die Saison archiviert
// wird [§4.1b]. Die archivierte Zeile hat Vorrang, damit ein abgeschlossener
// Monat sein Duo behält, auch wenn sich die Rechnung später ändert; ohne sie
// wird es aus dem Sim abgeleitet.
function seasonTeamOf(sid){
  const row = (seasons || []).find(s => s.id === sid);
  if(row && row.team_p1 && row.team_p2) return [row.team_p1, row.team_p2];
  try {
    const gSim = getGlobalSim();
    const map = (gSim.seasonTeamElo || {})[sid] || {};
    const spiele = {};
    matchesInSeason(sid).forEach(m => {
      [[m.a1,m.a2],[m.b1,m.b2]].forEach(([x,y]) => {
        if(!x || !y) return;
        const k = [x,y].sort().join('|');
        spiele[k] = (spiele[k] || 0) + 1;
      });
    });
    const best = Object.entries(map).filter(([k,v]) => v > 0 && (spiele[k]||0) >= 2)
      .sort((a,b) => b[1] - a[1])[0];
    return best ? best[0].split('|') : null;
  } catch(e){ return null; }
}

// In wie vielen abgeschlossenen Saisons war der Spieler Teil des besten Duos?
function countTeamOfSeason(id){
  try {
    const cur = currentSeason().id;
    let n = 0;
    (allPastSeasons() || []).forEach(sid => {
      if(sid === cur) return;
      const t = seasonTeamOf(sid);
      if(t && (t[0] === id || t[1] === id)) n++;
    });
    return n;
  } catch(e){ return 0; }
}

// Anzahl abgeschlossener Saisons, in denen der Spieler auf Platz 2 endete.
// Nutzt die archivierten seasons (top_elo enthält die Top-3 als JSON-Array).
function countViceChampion(id){
  if(!seasons||!seasons.length) return 0;
  const curId=currentSeason().id;
  let c=0;
  seasons.forEach(s=>{
    if(s.id===curId) return; // laufende Saison zählt nicht
    let top=s.top_elo;
    if(typeof top==='string'){ try{ top=JSON.parse(top); }catch(e){ top=[]; } }
    if(Array.isArray(top) && top[1] && top[1].id===id) c++;
  });
  return c;
}

// Tage, an denen der Spieler beim chronologisch ersten Match des Tages
// dabei war und es gewonnen hat. Max. 1 pro Tag (durch die Logik garantiert).
function countEarlyBirdDays(id,ms){
  const byDay={};
  ms.forEach(m=>{
    const day=mdayKey(m);
    if(!byDay[day]||mts(m)<mts(byDay[day])) byDay[day]=m;
  });
  let c=0;
  Object.values(byDay).forEach(first=>{
    if(matchOf(id,first)&&won(id,first)) c++;
  });
  return c;
}

// Wie oft eine Serie von n aufeinanderfolgenden 10:n-Siegen erreicht wurde.
// Nach Erreichen Serie zurücksetzen (analog zu countStreakOccurrences).
// Unterbrochen wird die Serie durch jede Niederlage UND durch jeden Sieg ohne 10:9.
function countNailBiterStreaks(id,ms,n){
  // Zählt wie oft n Zittersiege in Folge erreicht wurden — nur knappe Partien (9:10/10:9)
  // werden überhaupt betrachtet. Klare Siege oder klare Niederlagen sind irrelevant
  // und werden übersprungen, ohne die Serie zu unterbrechen. Nur eine knappe Niederlage
  // (9:10) bricht die Serie.
  const ordered=[...ms].filter(m=>matchOf(id,m))
    .sort((a,b)=>mts(a)-mts(b));
  let cur=0,count=0;
  ordered.forEach(m=>{
    const gf=goalsFor(id,m), ga=goalsAgainst(id,m);
    const isClose=(gf===10&&ga===9)||(gf===9&&ga===10);
    if(!isClose) return; // nicht-knappe Partien ignorieren
    if(won(id,m)){
      cur++;
      if(cur>=n){count++;cur=0;}
    } else {
      cur=0; // knappe Niederlage bricht die Serie
    }
  });
  return count;
}

// Hilfsfunktion: Badge → SVG-Icon-HTML (mit Fallback auf Emoji)
function badgeIc(b, size){
  size = size || 'inherit';
  if(!b) return '';
  const key = b.ic || null;
  if(key && ICONS[key]) {
    return `<span class="ic svg-ic" style="font-size:${size}"><svg viewBox="0 0 24 24">${ICONS[key]}</svg></span>`;
  }
  return '';
}

// Badge-Hilfsfunktionen
function matchOf(id,m){return [m.a1,m.a2,m.b1,m.b2].includes(id);}
function won(id,m){const onA=(id===m.a1||id===m.a2);return (onA&&m.winner==='A')||(!onA&&m.winner==='B');}
function goalsFor(id,m){return (id===m.a1||id===m.a2)?m.score_a:m.score_b;}
function goalsAgainst(id,m){return (id===m.a1||id===m.a2)?m.score_b:m.score_a;}
function shutout(id,m,myG,theirG){return goalsFor(id,m)===myG&&goalsAgainst(id,m)===theirG;}
function myExp(id,m){const onA=(id===m.a1||id===m.a2);return onA?(m.exp_a||0.5):(1-(m.exp_a||0.5));}
function countGames(id,ms){return ms.filter(m=>matchOf(id,m)).length;}
function countWins(id,ms){return ms.filter(m=>matchOf(id,m)&&won(id,m)).length;}

// v9.15 PERF: countPeriodWins/countDayWins wurden PRO SPIELER aufgerufen,
// rechneten aber jedes Mal die komplette spielerUNabhängige Perioden-Sieger-
// Aggregation neu (O(Spieler × Matches)). Jetzt: EINE Aggregation pro
// Match-Array — als {pid → Titel-Anzahl}-Map an der Array-IDENTITÄT memoisiert
// (WeakMap). Die Aufrufer mappen über dasselbe gecachte Array → ab dem zweiten
// Spieler nur noch ein Lookup. Frische Arrays (nach invalidateCache/loadAll)
// invalidieren die Memo automatisch, curKey im Slot-Key fängt Tages-/Wochen-
// Rollover innerhalb einer Session ab. Logik & Tiebreaks unverändert.
const _winnerCountsMemo = new WeakMap(); // msArray → { '<kind>_<curKey>': {pid: count} }
// Roh-Ergebnis: {Perioden-Key → Sieger-ID}. Die Zählung (_winnerCountsOf)
// leitet sich daraus ab, und der Avatar-Ring (§13.7) fragt hier gezielt nach
// dem Sieger EINER Periode — deshalb steht die Sieger-Ermittlung genau einmal
// im Code und kann zwischen Zählung und Ring nicht auseinanderlaufen.
function _periodWinnerMap(allMs, kind){
  const now=new Date();
  let curKey;
  if(kind==='week')       curKey=now.getFullYear()+'-W'+isoWeek(now);
  else if(kind==='month') curKey=now.getFullYear()+'-'+now.getMonth();
  else                    curKey=''; // day: kein Ausschluss des laufenden Tages (wie bisher)
  let slot=_winnerCountsMemo.get(allMs);
  if(!slot){ slot={}; _winnerCountsMemo.set(allMs, slot); }
  const slotKey='win_'+kind+'_'+curKey;
  if(slot[slotKey]) return slot[slotKey];

  // Buckets bilden (Woche / Monat / Tag)
  const buckets={};
  allMs.forEach(m=>{
    let key;
    if(kind==='week'){
      const d=new Date(m.created_at);
      key=d.getFullYear()+'-W'+isoWeek(d);
    } else if(kind==='month'){
      const d=new Date(m.created_at);
      key=d.getFullYear()+'-'+d.getMonth();
    } else {
      key=mdayKey(m);
    }
    if(!buckets[key])buckets[key]=[];
    buckets[key].push(m);
  });

  const winners={};
  Object.entries(buckets).forEach(([key,ms])=>{
    if(kind!=='day' && key===curKey)return; // laufende Woche/Monat noch offen
    if(ms.length<2)return;                  // min. 2 Spiele im Zeitraum
    const winsById={}, gamesById={}, eloById={};
    ms.forEach(m=>[m.a1,m.a2,m.b1,m.b2].forEach(pid=>{
      if(!winsById[pid])winsById[pid]=0;
      if(!gamesById[pid])gamesById[pid]=0;
      if(!eloById[pid])eloById[pid]=0;
      gamesById[pid]++;
      const onA=(pid===m.a1||pid===m.a2);
      if((onA&&m.winner==='A')||(!onA&&m.winner==='B'))winsById[pid]++;
      eloById[pid] += (m.deltas && m.deltas[pid]) || 0;
    }));
    let winner=null;
    if(kind==='day'){
      const maxW=Math.max(...Object.values(winsById));
      if(maxW<3)return;
      // Tiebreak: bei gleichen max-Siegen gewinnt höchstes eloDelta
      const candidates=Object.keys(winsById).filter(pid=>winsById[pid]===maxW);
      candidates.sort((a,b)=>eloById[b]-eloById[a]);
      winner=candidates[0];
    } else {
      const minW=kind==='week'?5:10;
      // ⚠ Tiebreak-Konsistenz zum Pop-Up (showPotwRecap):
      // 1. Höchste Siegrate, dann 2. mehr absolute Siege, dann 3. höheres Elo-Delta.
      // Nur DIESER Spieler bekommt das Badge — analog zum Pop-Up "mainPotwPlayerId".
      const qual=Object.keys(winsById).filter(pid=>winsById[pid]>=minW);
      if(!qual.length)return;
      qual.sort((a,b)=>{
        const wrA=winsById[a]/(gamesById[a]||1);
        const wrB=winsById[b]/(gamesById[b]||1);
        if(Math.abs(wrA-wrB)>0.001) return wrB-wrA;
        if(winsById[a]!==winsById[b]) return winsById[b]-winsById[a];
        return eloById[b]-eloById[a];
      });
      winner=qual[0];
    }
    if(winner!=null) winners[key]=winner;
  });
  slot[slotKey]=winners;
  return winners;
}
// Zählt, wie oft jeder Spieler eine Periode gewonnen hat.
function _winnerCountsOf(allMs, kind){
  const winners=_periodWinnerMap(allMs, kind);
  let slot=_winnerCountsMemo.get(allMs);
  if(!slot){ slot={}; _winnerCountsMemo.set(allMs, slot); }
  const slotKey='cnt_'+kind+'_'+Object.keys(winners).length;
  if(slot[slotKey]) return slot[slotKey];
  const counts={};
  Object.values(winners).forEach(pid=>{ counts[pid]=(counts[pid]||0)+1; });
  slot[slotKey]=counts;
  return counts;
}
// Zählt in wie vielen abgeschlossenen Wochen/Monaten der Spieler die meisten Siege hatte
function countPeriodWins(id,allMs,periodType){
  return _winnerCountsOf(allMs, periodType==='week'?'week':'month')[id]||0;
}
// Player of the Day: zählt Tage an denen dieser Spieler den POTD-Titel
// erringen würde (analog zur Recap-Pop-Up-Logik in showPotdRecap).
// ⚠ Tiebreak-Konsistenz: Bei gleichem Maximum von Tagessiegen gewinnt
// das höhere Elo-Delta des Tages — exakt wie das Pop-Up sortiert. Nur DIESER
// Spieler bekommt das Badge (vorher: alle Spieler mit max wins → mehrfach).
function countDayWins(id,allMs){
  return _winnerCountsOf(allMs,'day')[id]||0;
}

// ─── Krimi-Reihe: 5 Spiele in Folge mit Tordifferenz ≤ 2 (Sieg ODER Niederlage) ───
// Sobald 5 erreicht, wird die Serie zurückgesetzt → mehrfach erreichbar.
function countKrimiStreaks(id,ms){
  const ordered=[...ms].filter(m=>matchOf(id,m))
    .sort((a,b)=>mts(a)-mts(b));
  let cur=0,count=0;
  ordered.forEach(m=>{
    const diff=Math.abs(m.score_a-m.score_b);
    if(diff<=2){
      cur++;
      if(cur>=5){count++; cur=0;}
    } else {
      cur=0;
    }
  });
  return count;
}

// ─── Klares Ding: Sieg mit Tordifferenz ≥ 7 ───
function countClearWins(id,ms){
  return ms.filter(m=>matchOf(id,m)&&won(id,m)
    &&Math.abs(m.score_a-m.score_b)>=7).length;
}

// ─── Wiederholungstäter: 3 Siege in Folge mit identischem Endstand ───
// Niederlagen oder Siege mit anderem Score brechen die Serie.
function countRepeatScoreStreaks(id,ms){
  const ordered=[...ms].filter(m=>matchOf(id,m))
    .sort((a,b)=>mts(a)-mts(b));
  let lastScore=null,cur=0,count=0;
  ordered.forEach(m=>{
    if(!won(id,m)){cur=0; lastScore=null; return;}
    const score=goalsFor(id,m)+':'+goalsAgainst(id,m);
    if(score===lastScore){
      cur++;
      if(cur>=3){count++; cur=0; lastScore=null;}
    } else {
      cur=1; lastScore=score;
    }
  });
  return count;
}

// ─── Comeback-Tag: Tag mit Niederlage gestartet, mit Sieg beendet, min. 3 Matches ───
function countComebackDays(id,ms){
  const mine=ms.filter(m=>matchOf(id,m))
    .sort((a,b)=>mts(a)-mts(b));
  const byDay={};
  mine.forEach(m=>{
    const d=mdayKey(m);
    if(!byDay[d]) byDay[d]=[];
    byDay[d].push(m);
  });
  let count=0;
  Object.values(byDay).forEach(dayMs=>{
    if(dayMs.length<3) return;
    const first=dayMs[0], last=dayMs[dayMs.length-1];
    if(!won(id,first) && won(id,last)) count++;
  });
  return count;
}

// ─── Revanchist: nach Niederlage gegen Team X im direkt folgenden Match Sieg gegen X ───
// Strikt: das unmittelbar nächste Match muss gegen das gleiche Gegner-Team sein.
function countRevenge(id,ms){
  const mine=ms.filter(m=>matchOf(id,m))
    .sort((a,b)=>mts(a)-mts(b));
  const oppKey=(m)=>{
    const onA=(id===m.a1||id===m.a2);
    return (onA?[m.b1,m.b2]:[m.a1,m.a2]).slice().sort().join('|');
  };
  let count=0;
  for(let i=0;i<mine.length-1;i++){
    if(won(id,mine[i])) continue; // M_i muss Niederlage sein
    if(!won(id,mine[i+1])) continue; // M_{i+1} muss Sieg sein
    if(oppKey(mine[i])===oppKey(mine[i+1])) count++;
  }
  return count;
}

// ─── Königsklasse: Sieg gegen mind. 1 Gegner aus den Top 3 der Saison-Endrangliste ───

// ─── Pflichtaufgabe: Sieg gegen mind. 1 Gegner aus den Bottom 3 der Saison-Endrangliste ───

// ─── Thronfäller: Sieg gegen den Top-1 der laufenden Saison-Rangliste ───
// Top-1 = der Spieler mit dem höchsten Saison-Elo zum Zeitpunkt VOR dem Match
// (aus getRankSnapshots, das den live-Stand pro Match aus den Sim-Deltas
// aufbaut). Pflicht: Top-1 darf nicht der Spieler selbst sein und muss im
// gegnerischen Team stehen. Hidden-Spieler werden NICHT ausgeschlossen,
// weil der Match selbst stattfand — die Rangliste-Logik basiert auf realem
// Elo-Stand, nicht auf Visibility.
function countKingslayer(id,ms){
  const snaps = getRankSnapshots();
  let count = 0;
  for(let i=0; i<ms.length; i++){
    const m = ms[i];
    if(!matchOf(id,m) || !won(id,m)) continue;
    const snap = snaps[m.id]; if(!snap) continue;
    // Wer war Top-1 in der Saison-Rangliste VOR dem Match?
    let top1 = null;
    for(const pid in snap.preRank){
      if(snap.preRank[pid] === 1){ top1 = pid; break; }
    }
    if(!top1 || top1 === id) continue;
    // War Top-1 ein direkter Gegner?
    const onA = (id===m.a1||id===m.a2);
    const opps = onA ? [m.b1,m.b2] : [m.a1,m.a2];
    if(opps.includes(top1)) count++;
  }
  return count;
}

// ─── Überholmanöver: Sieg gegen einen Spieler, der dadurch in der ───
// ─── Saison-Rangliste überholt wurde ─────────────────────────────────
// Pro überholtem Gegner zählt 1× (also wenn man im 2v2 beide Gegner
// überholt, zählt das als 2 Treffer für dieses Match).
// Bedingungen pro Gegner Y:
//   • X war vor Match unter Y in der Rangliste (rank_X > rank_Y)
//   • X ist nach Match über Y (rank_X < rank_Y)
//   • → +1 für X
function countOvertake(id,ms){
  const snaps = getRankSnapshots();
  let count = 0;
  for(let i=0; i<ms.length; i++){
    const m = ms[i];
    if(!matchOf(id,m) || !won(id,m)) continue;
    const snap = snaps[m.id]; if(!snap) continue;
    const preX = snap.preRank[id], postX = snap.postRank[id];
    if(!preX || !postX) continue; // X muss schon einen Rang gehabt haben
    const onA = (id===m.a1||id===m.a2);
    const opps = onA ? [m.b1,m.b2] : [m.a1,m.a2];
    for(const opId of opps){
      const preY = snap.preRank[opId], postY = snap.postRank[opId];
      if(!preY || !postY) continue;
      // X war unter Y (höherer Rangzahl = schlechter), jetzt drüber
      if(preX > preY && postX < postY) count++;
    }
  }
  return count;
}

// ─── Award-Sammler: in einer Saison min. 5 POTD UND min. 2 POTW Auszeichnungen ───
// Pro qualifizierter Saison vergeben (mehrfach über Karriere).
function countAwardCollector(id){
  const bySeason=getMatchesBySeason();
  let count=0;
  Object.values(bySeason).forEach(seasonMs=>{
    const potd=countDayWins(id,seasonMs);
    if(potd<5) return; // billiger Vorab-Filter
    const potw=countPeriodWins(id,seasonMs,'week');
    if(potw>=2) count++;
  });
  return count;
}

// ═══ LEGENDARY-BADGES v7 ════════════════════════════════════════════════════
// Saison-/Karriere-aggregierte Counter. Werden in computeBadges() pro Profil
// lazy berechnet — kein Match-Trigger, weil sie nicht an einen Einzelmatch
// gebunden sind (analog award_collector / potd / potw).
// ═══════════════════════════════════════════════════════════════════════════

// Untouchable: 3 Saisons IN FOLGE Top-3 abgeschlossen.
// "In Folge" bezieht sich auf chronologische Reihenfolge ABGESCHLOSSENER
// Saisons. Die laufende Saison wird ausgeschlossen. Sids haben das Format
// "YYYY-MM" und sind damit lexikographisch chronologisch sortierbar.
// Counter steigt um 1 pro überlappungsfreier Drei-Saisons-Strecke (also bei
// 6 Saisons in Folge in Top-3 → counter = 2). Implementation analog zu
// countStreakOccurrences (separate Serien).
function countUntouchable(id){
  const rk = getSeasonRankingsCache();
  const curId = currentSeason().id;
  const sids = Object.keys(rk).filter(s => s !== curId).sort();
  let cur = 0, count = 0;
  for(const sid of sids){
    if(rk[sid] && rk[sid].top3 && rk[sid].top3.has(id)){
      cur++;
      if(cur >= 3){ count++; cur = 0; }  // separate Drei-Strecken
    } else {
      cur = 0;
    }
  }
  return count;
}

// Mr. Perfect: 3× 10:0-Sieg in EINER Saison.
// Counter = Anzahl Saisons, in denen der Spieler ≥3 Mal 10:0 gewonnen hat.
// Auch die laufende Saison wird gezählt (zur Toast-Konsistenz mit dem
// Match-Trigger weiter unten in getBadgeEarnedCache).
function countMrPerfect(id){
  const bySeason = getMatchesBySeason();
  let count = 0;
  Object.values(bySeason).forEach(seasonMs => {
    let perfect = 0;
    for(const m of seasonMs){
      if(!matchOf(id,m) || !won(id,m)) continue;
      const gf = goalsFor(id,m), ga = goalsAgainst(id,m);
      if(gf === 10 && ga === 0) perfect++;
      if(perfect >= 3) break; // billiger Early-Exit
    }
    if(perfect >= 3) count++;
  });
  return count;
}

// Allwetter: an mind. 5 verschiedenen Wochentagen je mind. 1× POTD geworden.
// Karriere-Stat — sobald 5 erreicht, bleibt das Badge dauerhaft erreicht.
// Counter ist deshalb max. 1 (entweder erreicht oder nicht).
function countAllwetter(id){
  // POTD-Logik 1:1 aus countDayWins. Statt eines Counters: Wochentage sammeln.
  const byDay = {};
  matches.forEach(m => {
    const day = mdayKey(m);
    if(!byDay[day]) byDay[day] = { ms: [], jsDate: new Date(m.created_at) };
    byDay[day].ms.push(m);
  });
  const today = new Date().toISOString().slice(0,10);
  const weekdays = new Set();
  Object.entries(byDay).forEach(([day, info]) => {
    if(day === today) return;       // laufender Tag (noch nicht abgeschlossen)
    if(info.ms.length < 2) return;  // POTD benötigt min. 2 Spiele am Tag
    const winsById = {};
    info.ms.forEach(m => [m.a1,m.a2,m.b1,m.b2].forEach(pid => {
      if(!winsById[pid]) winsById[pid] = 0;
      const onA = (pid===m.a1||pid===m.a2);
      if((onA && m.winner==='A') || (!onA && m.winner==='B')) winsById[pid]++;
    }));
    const maxW = Math.max(...Object.values(winsById));
    if(maxW < 3) return;
    if((winsById[id]||0) === maxW){
      weekdays.add(info.jsDate.getDay()); // 0=Sonntag, 1=Montag, …, 6=Samstag
    }
  });
  return weekdays.size >= 5 ? 1 : 0;
}

// Tag der Götter: 3 aufeinanderfolgende EIGENE Spieltage als POTD gewonnen.
// "Eigene Spieltage" = Tage, an denen der Spieler beteiligt war. Tage, an
// denen die Liga ohne ihn spielte, BRECHEN die Serie NICHT — sie werden
// übersprungen. Karriere-aggregiert (separate Drei-Strecken zählen einzeln).
function countGodlyStreak(id){
  // Einmalig nach Tag gruppieren (über alle Matches, nicht nur die des Spielers).
  const byDay = {};
  matches.forEach(m => {
    const day = mdayKey(m);
    if(!byDay[day]) byDay[day] = [];
    byDay[day].push(m);
  });
  const today = new Date().toISOString().slice(0,10);
  const sortedDays = Object.keys(byDay).filter(d => d !== today).sort();
  let cur = 0, count = 0;
  for(const day of sortedDays){
    const dayMs = byDay[day];
    const involved = dayMs.some(m => [m.a1,m.a2,m.b1,m.b2].includes(id));
    if(!involved) continue;             // Tag ohne Spieler → SKIP (kein Reset)
    if(dayMs.length < 2){ cur = 0; continue; }
    const winsById = {};
    dayMs.forEach(m => [m.a1,m.a2,m.b1,m.b2].forEach(pid => {
      if(!winsById[pid]) winsById[pid] = 0;
      const onA = (pid===m.a1||pid===m.a2);
      if((onA && m.winner==='A') || (!onA && m.winner==='B')) winsById[pid]++;
    }));
    const maxW = Math.max(...Object.values(winsById));
    if(maxW < 3){ cur = 0; continue; }
    if((winsById[id]||0) === maxW){
      cur++;
      if(cur >= 3){ count++; cur = 0; } // separate Drei-Strecken zählen
    } else {
      cur = 0;
    }
  }
  return count;
}

function longestPlayerStreak(id,ms){
  const ordered=[...ms].filter(m=>matchOf(id,m)).sort((a,b)=>mts(a)-mts(b));
  let cur=0,best=0;
  ordered.forEach(m=>{if(won(id,m)){cur++;if(cur>best)best=cur;}else cur=0;});
  return best;
}
// Erweiterte Variante: liefert auch das Datum des Match, das die längste
// Siegesserie abgeschlossen hat (also den Peak-Match). Bei mehreren Serien
// mit demselben Maximum wird die NEUESTE genommen — analog zum Verhalten
// im Awards-Tab (jüngere Leistungen sind salient).
function longestPlayerStreakInfo(id,ms){
  const ordered=[...ms].filter(m=>matchOf(id,m)).sort((a,b)=>mts(a)-mts(b));
  let cur=0,best=0,peakMatch=null;
  ordered.forEach(m=>{
    if(won(id,m)){
      cur++;
      if(cur>=best){ best=cur; peakMatch=m; } // ≥ → neueste gleichlange Serie gewinnt
    } else {
      cur=0;
    }
  });
  return {best, peakDate: peakMatch ? peakMatch.created_at : null};
}
// Zählt wie oft eine Siegesserie der Länge >= n erreicht wurde (separate Serien)
function countStreakOccurrences(id,ms,n){
  const ordered=[...ms].filter(m=>matchOf(id,m)).sort((a,b)=>mts(a)-mts(b));
  let cur=0,count=0,awarded=false;
  ordered.forEach(m=>{
    if(won(id,m)){cur++;if(cur>=n&&!awarded){count++;awarded=true;}}
    else {cur=0;awarded=false;}
  });
  return count;
}
// Zählt wie oft eine Niederlagenserie >= n erreicht wurde
function countLossStreakOccurrences(id,ms,n){
  const ordered=[...ms].filter(m=>matchOf(id,m)).sort((a,b)=>mts(a)-mts(b));
  let cur=0,count=0,awarded=false;
  ordered.forEach(m=>{if(!won(id,m)){cur++;if(cur>=n&&!awarded){count++;awarded=true;}}else{cur=0;awarded=false;}});
  return count;
}
// Carry: Sieg wenn dein Mate der schwächste der 4 Spieler im Match war
// Nutzt globalen Elo-History-Cache für historische Elo-Stände
function countCarries(id,ms){
  const snapMap=getSnapMap();
  return ms.filter(m=>{
    if(!matchOf(id,m)||!won(id,m))return false;
    const snap=snapMap[m.id]; if(!snap)return false;
    const allFour=[m.a1,m.a2,m.b1,m.b2];
    if(allFour.some(x=>snap[x]===undefined))return false;
    const weakest=allFour.reduce((a,b)=>(snap[a] ?? cfg.start_elo)<=(snap[b] ?? cfg.start_elo)?a:b);
    const onA=(id===m.a1||id===m.a2);
    const mate=onA?(id===m.a1?m.a2:m.a1):(id===m.b1?m.b2:m.b1);
    return mate===weakest;
  }).length;
}
// Zählt Tage an denen der Spieler min. 3 Spiele hatte und keines verloren hat
function countUnbeatableDays(id,ms){
  const mine=ms.filter(m=>matchOf(id,m));
  const byDay={};
  mine.forEach(m=>{const d=mdayKey(m);
    if(!byDay[d])byDay[d]={games:0,losses:0}; byDay[d].games++; if(!won(id,m))byDay[d].losses++;});
  return Object.values(byDay).filter(d=>d.games>=3&&d.losses===0).length;
}
// ─── Pflichterfüller: Sieg gegen mind. 1 Gegner aus Bottom-2 der ─────
// ─── Saison-Rangliste zum Zeitpunkt des Matches ──────────────────────
// Unterschied zur bestehenden countBottomThreeWins-Funktion (Saison-END-
// Rangliste): hier wird der live-Stand der Saison-Rangliste VOR dem Match
// verwendet (getRankSnapshots → preRank). Bottom-2 = die letzten zwei Plätze.
// Erst sinnvoll ab 5 Spielern in der Rangliste — sonst überlappt Top und
// Bottom (und der Award würde trivial fallen). Hidden-Spieler werden NICHT
// ausgeschlossen, weil das Match stattfand und der Rangzeitpunkt real ist.
function countBottomTwoMatchWins(id,ms){
  const snaps = getRankSnapshots();
  let count = 0;
  for(let i=0; i<ms.length; i++){
    const m = ms[i];
    if(!matchOf(id,m) || !won(id,m)) continue;
    const snap = snaps[m.id]; if(!snap || !snap.preRank) continue;
    const ranks = snap.preRank;
    const N = Object.keys(ranks).length;
    if(N < 5) continue; // Bottom-2 ist erst ab 5 Spielern in der Rangliste sinnvoll
    const onA = (id===m.a1||id===m.a2);
    const opps = onA ? [m.b1,m.b2] : [m.a1,m.a2];
    // Mind. ein Gegner mit Rang im Bottom-2 (rank >= N-1)
    const hit = opps.some(oId => ranks[oId] && ranks[oId] >= N-1);
    if(hit) count++;
  }
  return count;
}

// ─── Serienbrecher: Sieg, der eine laufende Siegesserie (≥4) eines ───
// ─── Gegners gestoppt hat ────────────────────────────────────────────
// Nutzt getStreakSnapshots, das pro Match den live-Streak-Stand aller
// 4 Spieler liefert. Ein Sieg zählt pro Match nur EINMAL — auch wenn beide
// Gegner gerade eine 4er+ Serie laufen hatten (kommt praktisch kaum vor,
// vermeidet aber doppelte Belohnung).
function countStreakBreaker(id,ms){
  const snaps = getStreakSnapshots();
  let count = 0;
  for(let i=0; i<ms.length; i++){
    const m = ms[i];
    if(!matchOf(id,m) || !won(id,m)) continue;
    const snap = snaps[m.id]; if(!snap) continue;
    const onA = (id===m.a1||id===m.a2);
    const opps = onA ? [m.b1,m.b2] : [m.a1,m.a2];
    if(opps.some(oId => (snap[oId]||0) >= 4)) count++;
  }
  return count;
}

// ─── Schwarzer Tag: Tag mit mind. 3 Spielen, alle verloren ───────────
// Gruppiert die Matches eines Spielers nach Datum (YYYY-MM-DD) und zählt,
// an wie vielen Tagen mind. 3 Matches stattfanden, die ALLE verloren wurden.
function countBlackDays(id,ms){
  const byDay={}; // day → {g, l}
  for(let i=0; i<ms.length; i++){
    const m=ms[i];
    if(!matchOf(id,m)) continue;
    const day=mdayKey(m);
    if(!byDay[day]) byDay[day]={g:0, l:0};
    byDay[day].g++;
    if(!won(id,m)) byDay[day].l++;
  }
  let count=0;
  for(const day in byDay){
    const d=byDay[day];
    if(d.g >= 3 && d.l === d.g) count++;
  }
  return count;
}

// ─── Krimi-Versager: n knappe Niederlagen (Tordiff. ≤ 2) in Folge ────
// Spiegel zu countLossStreakOccurrences, aber gefiltert auf "knappe" Niederlagen.
// Ein Sieg ODER eine deutliche Niederlage (>2 Tore Diff) bricht die Serie.
function countCloseLossStreaks(id,ms,n){
  const ordered=[...ms].filter(m=>matchOf(id,m))
    .sort((a,b)=>mts(a)-mts(b));
  let cur=0, count=0, awarded=false;
  ordered.forEach(m=>{
    const isLoss = !won(id,m);
    const diff = Math.abs(m.score_a - m.score_b);
    if(isLoss && diff <= 2){
      cur++;
      if(cur>=n && !awarded){ count++; awarded=true; }
    } else {
      cur=0; awarded=false;
    }
  });
  return count;
}

// ─── Mr. Disaster: 3× 0:10-Niederlage in einer Saison ────────────────
// Spiegel zu countMrPerfect (3× 10:0-Sieg). Pro Saison getrennt zählen;
// sobald 3 erreicht → Saison qualifiziert, count++.
function countMrDisaster(id){
  const bySeason = getMatchesBySeason();
  let count = 0;
  Object.values(bySeason).forEach(seasonMs => {
    let disasters = 0;
    for(const m of seasonMs){
      if(!matchOf(id,m) || won(id,m)) continue;
      if(goalsFor(id,m) === 0 && goalsAgainst(id,m) === 10) disasters++;
      if(disasters >= 3) break; // billiger Early-Exit
    }
    if(disasters >= 3) count++;
  });
  return count;
}

// ─── Zusammenbruch: Tag mit Sieg gestartet, mit Niederlage beendet, ──
// ─── min. 3 Matches ──────────────────────────────────────────────────
// Spiegel zu countComebackDays. Strikt: erstes Match Sieg, letztes Niederlage,
// ≥3 Matches an dem Tag. Pro Tag max. 1 Eintrag (siehe Match-Trigger).
function countCrashDays(id,ms){
  const mine=ms.filter(m=>matchOf(id,m))
    .sort((a,b)=>mts(a)-mts(b));
  const byDay={};
  mine.forEach(m=>{
    const d=mdayKey(m);
    if(!byDay[d]) byDay[d]=[];
    byDay[d].push(m);
  });
  let count=0;
  Object.values(byDay).forEach(dayMs=>{
    if(dayMs.length<3) return;
    const first=dayMs[0], last=dayMs[dayMs.length-1];
    if(won(id,first) && !won(id,last)) count++;
  });
  return count;
}

// ─── Angstgegner: 5× in Folge gegen denselben Gegner-SPIELER verloren ─
// Jeder Gegner wird einzeln getrackt (Mate-Wechsel egal). Bei Sieg gegen
// einen Gegner → dessen Counter wird zurückgesetzt; bei Niederlage gegen
// ihn → Counter +1. Erreicht der Counter 5 → +1 zum Gesamt-Count, danach
// muss erst ein Sieg gegen diesen Gegner kommen, bevor erneut gezählt wird.
// Konsistent zum Match-Trigger: pro Match max. 1 Eintrag, selbst wenn
// beide Gegner gleichzeitig die Schwelle erreichen (selten).
function countNemesis(id,ms){
  const mine=ms.filter(m=>matchOf(id,m))
    .sort((a,b)=>mts(a)-mts(b));
  const vsStreak={};  // opponentId → aktueller Niederlagen-Streak
  const fired={};     // opponentId → schon gefeuert (wartet auf Reset durch Sieg)
  let count=0;
  mine.forEach(m=>{
    const onA=(id===m.a1||id===m.a2);
    const w=(onA && m.winner==='A')||(!onA && m.winner==='B');
    const opps=onA?[m.b1,m.b2]:[m.a1,m.a2];
    if(w){
      opps.forEach(oId=>{ vsStreak[oId]=0; fired[oId]=false; });
    } else {
      let firedThisMatch=false;
      opps.forEach(oId=>{
        vsStreak[oId]=(vsStreak[oId]||0)+1;
        if(vsStreak[oId]>=5 && !fired[oId]){
          fired[oId]=true;
          if(!firedThisMatch){ count++; firedThisMatch=true; }
        }
      });
    }
  });
  return count;
}

function getCachedBadges(id){
  const key='badges_'+id+'_'+matches.length+'_'+_cache.version;
  if(!_cache._badges) _cache._badges={};
  if(_cache._badges[key]) return _cache._badges[key];
  const r=computeBadges(id);
  _cache._badges[key]=r;
  return r;
}

// Berechnet alle freigeschalteten Badges für einen Spieler (mit Anzahl für multi-Badges)
function computeBadges(id){
  const result=[];
  BADGES.forEach(b=>{
    const c=b.count(id,matches);
    if(c>0) result.push({id:b.id,em:b.em,ic:b.ic,name:b.name,desc:b.desc,count:c});
  });
  return result;
}

// Ermittelt welche Badges durch ein bestimmtes Match NEU freigeschaltet / erneut erreicht wurden
function getBadgeEarnedCache(){
  const key='badgeEarned_'+matches.length+'_'+_cache.version;
  if(_cache._badgeEarnedKey===key) return _cache._badgeEarnedMap;

  const map={};
  const ordered=[...matches].sort((a,b)=>mts(a)-mts(b));

  // Globale Sim für Carry (historische Elo-Stände vor jedem Match) — gecached
  const snapMap=getSnapMap();
  // History-Map für eloAfter-Lookup (Saison-Peak-Tracking pro Match)
  const histById=getHistoryByMatchId();
  // Rangliste-Snapshots pro Match (für Thronfäller + Überholmanöver + Pflichterfüller)
  const rankSnaps=getRankSnapshots();
  // Siegesserien-Snapshots pro Match (für Serienbrecher — Streak des Gegners VOR dem Match)
  const streakSnaps=getStreakSnapshots();
  // Tages-Tracker (global, nicht per-player): welcher Tag hatte schon sein erstes Match?
  const firstOfDaySeen={};

  // Inkrementeller State pro Spieler
  const st={};
  players.forEach(p=>{
    st[p.id]={
      games:0, wins:0,
      atkG:0, atkW:0,
      defG:0, defW:0,
      curStreak:0, curLoss:0,
      // Streak-Awards: werden zurückgesetzt wenn Serie bricht
      sa5:false, sa10:false, sa15:false, sa20:false,
      // Loss-Streak-Award: wird zurückgesetzt wenn Sieg kommt
      la5:false,
      // Tages-Tracker für Unbeatable
      days:{}, // "YYYY-MM-DD" → { g, l }
      // ── Neue Badges ──
      // Elo-Schwellen — seit v9.18 JE SAISON erreichbar. Deshalb wird der Peak
      // pro Saison geführt und beim Saisonwechsel zurückgesetzt; die Fired-Maps
      // sind nach sid geschlüsselt, damit ein Rückfall und erneutes Überschreiten
      // INNERHALB derselben Saison nicht doppelt zählt.
      eloSeason: null, seasonPeakElo: cfg.start_elo,
      eloFired: {},           // "climber_100:2026-06" → true
      // 10:9-Serien-Counter (resettet bei Nicht-10:9 oder Niederlage)
      nailStreak: 0,
      // Krimi-Reihe: aufeinanderfolgende Spiele mit Tordifferenz ≤ 2
      krimiCur: 0,
      // ── NEUE NEGATIV-BADGES v6 ──
      // Krimi-Versager: aufeinanderfolgende knappe Niederlagen (Diff ≤ 2)
      krimiLossCur: 0, krimiLossFired: false,
      // Schwarzer Tag: pro Tag merken, ob schon gefeuert wurde
      blackDayFired: {},   // "YYYY-MM-DD" → true (schon gefeuert für diesen Tag)
      // ── NEUE LEGENDARY-BADGES v7 ──
      // Mr. Perfect: pro Saison 10:0-Siege zählen + bei ≥3 einmalig feuern
      mrPerfectPerSeason: {}, // sid → Anzahl 10:0-Siege in dieser Saison
      mrPerfectFired: {},     // sid → true (schon gefeuert)
      // ── NEUE NEGATIV-BADGES v8 ──
      // Mr. Disaster: pro Saison 0:10-Niederlagen zählen + bei ≥3 einmalig feuern
      // (Spiegel zu mrPerfect — Saison-Reset implizit durch sid-Wechsel)
      mrDisasterPerSeason: {},
      mrDisasterFired: {},
      // Zusammenbruch: pro Tag merken, ob schon gefeuert wurde
      crashFired: {},         // "YYYY-MM-DD" → true
      // Angstgegner: pro Gegner-Spieler aktueller Niederlagen-Streak + Fired-Flag
      // Reset des Counters bei Sieg gegen denselben Gegner; Fired-Flag wird
      // ebenfalls zurückgesetzt, sobald wieder ein Sieg gegen X gelingt.
      nemesisVs: {},          // oppId → Streak
      nemesisFired: {},       // oppId → schon gefeuert (wartet auf Reset)
      // Wiederholungstäter: letzter Sieg-Score und aktueller Counter
      lastWinScore: null, wtCur: 0,
      // Comeback-Tag: erstes Match-Ergebnis pro Tag + Trigger-Flag
      firstResOfDay: {},   // "YYYY-MM-DD" → 'W' | 'L'
      comebackFired: {},   // "YYYY-MM-DD" → true (schon gefeuert)
      // ⚠ Unbeatable-Tracking: Match-ID pro Tag, an dem unbeatable gefeuert wurde
      // — wird bei einer Niederlage am selben Tag rückwirkend gelöscht (Bug-Fix).
      unbeatableMatchIdByDay: {},
      // Revanchist: letztes verlorenes Gegner-Team (sortierter String "p1|p2")
      lastLossOpp: null,
    };
  });

  ordered.forEach(m=>{
    const earned=[];
    const ids=[m.a1,m.a2,m.b1,m.b2];
    const day=mdayKey(m);
    // Ist dies das erste Match dieses Tages? (Global, eine Frage pro Match)
    const isFirstOfDay = !firstOfDaySeen[day];
    if(isFirstOfDay) firstOfDaySeen[day]=true;
    // Saison-Peak-Tracking nutzt die Sim-History (Elo-Stand nach diesem Match)
    const hist=histById.get(m.id);
    const eloAfter=(hist&&hist.eloAfter)||{};

    ids.forEach(id=>{
      if(!st[id]) return;
      const s=st[id];
      const onA=(id===m.a1||id===m.a2);
      const w=(onA&&m.winner==='A')||(!onA&&m.winner==='B');
      const gf=onA?m.score_a:m.score_b;
      const ga=onA?m.score_b:m.score_a;
      const pos=id===m.a1?m.a1_pos:id===m.a2?m.a2_pos:id===m.b1?m.b1_pos:m.b2_pos;
      const myExp=onA?(m.exp_a||0.5):(1-(m.exp_a||0.5));

      // Werte VOR diesem Match sichern (für Schwellen-Checks)
      const pg=s.games, pw=s.wins, pAtkW=s.atkW, pDefW=s.defW, pAtkG=s.atkG, pDefG=s.defG;
      const prevAllrounder=pAtkW>=20&&pDefW>=20;

      // ── State updaten ──
      s.games++;
      if(w) s.wins++;
      if(pos==='atk'){s.atkG++;if(w)s.atkW++;}
      else            {s.defG++;if(w)s.defW++;}

      if(w){
        s.curStreak=s.curStreak>0?s.curStreak+1:1;
        s.curLoss=0;
        s.la5=false;
      } else {
        s.curLoss=s.curLoss>0?s.curLoss+1:1;
        s.curStreak=0;
        s.sa5=false; s.sa10=false; s.sa15=false; s.sa20=false;
      }

      if(!s.days[day]) s.days[day]={g:0,l:0};
      s.days[day].g++;
      if(!w){
        s.days[day].l++;
        // ⚠ Bug-Fix: wenn heute schon unbeatable gefeuert wurde (3 saubere Siege),
        // ist es durch diese Niederlage hinfällig — Eintrag aus dem map des
        // ursprünglichen Match-Buckets entfernen, damit das Match-Review es
        // nicht mehr anzeigt. Toast war bereits geflogen (irreversibel), aber
        // visuell verschwindet das Badge konsistent.
        const ubMid = s.unbeatableMatchIdByDay[day];
        if(ubMid){
          const arr = map[ubMid];
          if(arr){
            const idx = arr.findIndex(e => e.playerId === id && e.badge.id === 'unbeatable');
            if(idx >= 0) arr.splice(idx, 1);
          }
          s.unbeatableMatchIdByDay[day] = null;
        }
      }

      // ── Helper ──
      const fire=(bid, meta)=>{
        const b=BADGES.find(x=>x.id===bid);
        if(b) earned.push(meta ? {playerId:id,badge:b,meta} : {playerId:id,badge:b});
      };

      // ── Einfache Schwellen-Badges ──
      if(pg===0)                                    fire('first_match');
      if(pg<25   && s.games>=25)                    fire('games25');
      if(pg<150  && s.games>=150)                   fire('games150');
      // v9.17: goldene Langzeit-Meilensteine. Gleiches Schwellen-Muster wie oben
      // (Wert VOR dem Match < Ziel, danach ≥ Ziel) → feuert genau einmal, in dem
      // Match, das die Marke reißt. pw ist der Siegzähler vor diesem Match.
      if(pg<300  && s.games>=300)                   fire('games250');
      if(pw<300  && s.wins>=300)                    fire('wins200');
      if(!prevAllrounder && s.atkW>=20 && s.defW>=20) fire('allrounder');
      if(pDefG<50 && s.defG>=50)                    fire('def50');
      if(pAtkG<50 && s.atkG>=50)                    fire('atk50');

      // ── Match-Ergebnis-Badges ──
      if(w  && gf===10 && ga===0)                   fire('perfect_win');
      if(!w && gf===0  && ga===10)                  fire('perfect_loss');
      if(w  && gf===10 && ga===9)                   fire('nail_biter');
      if(!w && gf===9  && ga===10)                  fire('bitter_loss');
      if(w  && pos==='def' && ga<=2)                fire('wall_badge');
      if(w  && myExp<0.35)                          fire('upset_king');

      // ── Mr. Perfect: 3× 10:0-Sieg in DERSELBEN Saison ──
      // Saison-IDs per seasonOf() bestimmen (sid-Format YYYY-MM). Counter pro
      // Saison; einmal gefeuert wird kein weiterer Toast für die selbe Saison
      // ausgelöst — aber der count() sieht alle qualifizierten Saisons.
      if(w && gf===10 && ga===0){
        const sid = seasonOf(m.created_at).id;
        s.mrPerfectPerSeason[sid] = (s.mrPerfectPerSeason[sid]||0) + 1;
        if(s.mrPerfectPerSeason[sid] >= 3 && !s.mrPerfectFired[sid]){
          s.mrPerfectFired[sid] = true;
          fire('mr_perfect');
        }
      }

      // ── Mr. Disaster: 3× 0:10-Niederlage in DERSELBEN Saison ──
      // Spiegel zu mr_perfect. Counter ist saison-lokal (sid-Format YYYY-MM)
      // → automatischer Reset bei Saisonwechsel ohne expliziten Reset-Pfad.
      if(!w && gf===0 && ga===10){
        const sid = seasonOf(m.created_at).id;
        s.mrDisasterPerSeason[sid] = (s.mrDisasterPerSeason[sid]||0) + 1;
        if(s.mrDisasterPerSeason[sid] >= 3 && !s.mrDisasterFired[sid]){
          s.mrDisasterFired[sid] = true;
          fire('mr_disaster');
        }
      }

      // ── Streak-Badges (nur wenn Schwelle NEU in dieser Serie) ──
      if(w && s.curStreak>=5  && !s.sa5)  { s.sa5=true;  fire('streak5');  }
      if(w && s.curStreak>=10 && !s.sa10) { s.sa10=true; fire('streak10'); }
      if(w && s.curStreak>=15 && !s.sa15) { s.sa15=true; fire('streak15'); }
      if(w && s.curStreak>=20 && !s.sa20) { s.sa20=true; fire('streak20'); }

      // ── Loss-Streak-Badge ──
      if(!w && s.curLoss>=5 && !s.la5)   { s.la5=true;  fire('losing5');  }

      // ── Carry ──
      const snap=snapMap[m.id];
      if(w && snap){
        const allFour=[m.a1,m.a2,m.b1,m.b2];
        if(allFour.every(x=>snap[x]!==undefined)){
          const weakest=allFour.reduce((a,b)=>
            (snap[a]??cfg.start_elo)<=(snap[b]??cfg.start_elo)?a:b);
          const mate=onA?(id===m.a1?m.a2:m.a1):(id===m.b1?m.b2:m.b1);
          if(mate===weakest) fire('carry');
        }
      }

      // ── Unbeatable Day ──
      // Feuert genau wenn der 3. saubere Sieg an einem Tag erreicht wird.
      // Match-ID wird gemerkt — bei späterer Niederlage am selben Tag
      // wird das Badge oben revoked (siehe Day-Tracking).
      const d=s.days[day];
      if(d.g===3 && d.l===0){
        fire('unbeatable');
        s.unbeatableMatchIdByDay[day] = m.id;
      }

      // ── Frühschicht: Sieg im chronologisch ersten Match des Tages ──
      // isFirstOfDay ist für ALLE 4 Spieler dieses Matches identisch true,
      // garantiert max. 1 Trigger pro Spieler+Tag (mehr als 1 erstes Match gibt's nicht).
      if(isFirstOfDay && w) fire('early_bird');

      // ── Nerven aus Stahl: 3 Zittersiege in Folge — nur knappe Partien zählen ──
      // Nicht-knappe Partien (klare Siege/Niederlagen) sind irrelevant und ändern die
      // Serie nicht. Nur eine knappe Niederlage (9:10) bricht die Serie.
      // Bei Erreichen wird der Counter zurückgesetzt → mehrfach erreichbar.
      const isClose=(gf===10&&ga===9)||(gf===9&&ga===10);
      if(isClose){
        if(w){
          s.nailStreak++;
          if(s.nailStreak>=3){ fire('nerves_of_steel'); s.nailStreak=0; }
        } else {
          s.nailStreak=0;
        }
      }
      // sonst: nicht-knappe Partie → nailStreak bleibt unverändert

      // ── Saison-Elo-Schwellen (je Saison einmal) ──
      // Nutzt den Elo-Stand nach diesem Match aus der zentralen Sim-History.
      // Die Elo wird zum Monatswechsel ohnehin auf start_elo zurückgesetzt —
      // der Peak wird hier genauso zurückgesetzt, damit „400 Elo in einer
      // Saison" wirklich diese Saison meint. Die Fired-Map je sid verhindert,
      // dass ein Zickzack um die Marke mehrfach zählt.
      const myEloAfter=eloAfter[id];
      if(myEloAfter!==undefined){
        const esid=seasonOf(m.created_at).id;
        if(s.eloSeason!==esid){ s.eloSeason=esid; s.seasonPeakElo=cfg.start_elo; }
        if(myEloAfter>s.seasonPeakElo){
          s.seasonPeakElo=myEloAfter;
          [['climber_100',100],['dominator_400',400],['dynasty_600',600]].forEach(([bid,mark])=>{
            const k=bid+':'+esid;
            if(s.seasonPeakElo>=mark && !s.eloFired[k]){ s.eloFired[k]=true; fire(bid); }
          });
        }
      }

      // ── Klares Ding: Sieg mit Tordifferenz ≥ 7 ──
      const goalDiff=Math.abs(gf-ga);
      if(w && goalDiff>=7) fire('clear_win');

      // ── Krimi-Reihe: 5 Spiele in Folge mit Tordifferenz ≤ 2 ──
      // Egal ob Sieg oder Niederlage; sobald 5 erreicht → Counter-Reset.
      if(goalDiff<=2){
        s.krimiCur++;
        if(s.krimiCur>=5){ fire('krimi'); s.krimiCur=0; }
      } else {
        s.krimiCur=0;
      }

      // ── NEUE NEGATIV-BADGES v6 ──
      // ── Krimi-Versager: 3 knappe Niederlagen (Diff ≤ 2) in Folge ──
      // Sieg ODER deutliche Niederlage (Diff > 2) bricht die Serie. Feuert beim
      // Erreichen der 3, dann erst wieder nach Reset (krimiLossFired-Flag).
      if(!w && goalDiff<=2){
        s.krimiLossCur++;
        if(s.krimiLossCur>=3 && !s.krimiLossFired){
          fire('krimi_loser');
          s.krimiLossFired=true;
        }
      } else {
        s.krimiLossCur=0;
        s.krimiLossFired=false;
      }

      // ── Schwarzer Tag: Tag mit mind. 3 Spielen, alle verloren ──
      // s.days[day] wurde bereits oben aktualisiert (g/l). Wir prüfen nach dem
      // Update: g>=3 und l===g → alle verloren. Pro Tag nur EIN Toast — über
      // blackDayFired-Tag-Set. Trigger nur bei Niederlage (sonst kann's eh nicht
      // sein) — und feuert beim Übergang von 2 auf 3 Niederlagen (oder höher,
      // falls vorher schon entgangen).
      if(!w && s.days[day] && s.days[day].g >= 3 && s.days[day].l === s.days[day].g
         && !s.blackDayFired[day]){
        fire('black_day');
        s.blackDayFired[day] = true;
      }

      // ── Wiederholungstäter: 3 Siege in Folge mit identischem Endstand ──
      // Niederlagen oder Siege mit anderem Score brechen die Serie.
      if(w){
        const score=gf+':'+ga;
        if(score===s.lastWinScore){
          s.wtCur++;
          if(s.wtCur>=3){ fire('repeat_score'); s.wtCur=0; s.lastWinScore=null; }
        } else {
          s.wtCur=1; s.lastWinScore=score;
        }
      } else {
        s.wtCur=0; s.lastWinScore=null;
      }

      // ── Comeback-Tag: Tag mit Niederlage gestartet, mit Sieg beendet, min. 3 Matches ──
      // Erstes Match des Tages für diesen Spieler? → Ergebnis als Tag-Start merken.
      if(s.days[day].g===1){
        s.firstResOfDay[day] = w ? 'W' : 'L';
      }
      // Aktueller Sieg + Tag startete mit Niederlage + min. 3 Matches + noch nicht gefeuert
      if(w && s.days[day].g>=3 && s.firstResOfDay[day]==='L' && !s.comebackFired[day]){
        s.comebackFired[day]=true;
        fire('comeback_day');
      }

      // ── Zusammenbruch: Tag mit Sieg gestartet, mit Niederlage beendet, min. 3 Matches ──
      // Spiegel zu comeback_day. firstResOfDay wird oben bereits gesetzt (erstes
      // Match-Ergebnis pro Tag). Triggert beim Übergang ≥3 Matches, wenn der
      // aktuelle (letzte) Trigger eine Niederlage ist.
      if(!w && s.days[day].g>=3 && s.firstResOfDay[day]==='W' && !s.crashFired[day]){
        s.crashFired[day]=true;
        fire('crash_day');
      }

      // ── Angstgegner: 5× in Folge gegen denselben Gegner-SPIELER verloren ──
      // Pro Gegner-Spieler aus diesem Match: bei Niederlage Counter +1, bei
      // Sieg Reset. Max. 1 fire pro Match (analog streak_breaker), auch wenn
      // beide Gegner gleichzeitig die Schwelle erreichen sollten.
      const oppPair = onA?[m.b1,m.b2]:[m.a1,m.a2];
      if(w){
        oppPair.forEach(oId=>{ s.nemesisVs[oId]=0; s.nemesisFired[oId]=false; });
      } else {
        let nemFired=false;
        oppPair.forEach(oId=>{
          s.nemesisVs[oId] = (s.nemesisVs[oId]||0) + 1;
          if(s.nemesisVs[oId]>=5 && !s.nemesisFired[oId]){
            s.nemesisFired[oId]=true;
            // oId = der Gegner-Spieler, gegen den zum 5. Mal in Folge verloren
            // wurde → als Meta mitgeben, damit die News den Angstgegner benennt.
            if(!nemFired){ fire('nemesis', {oppId: oId}); nemFired=true; }
          }
        });
      }

      // ── Revanchist: Sieg gegen das Team, gegen das man im direkt vorigen Match verloren hat ──
      // Strikt: das unmittelbar nächste Match nach einer Niederlage muss gegen X sein.
      const currentOpp=(onA?[m.b1,m.b2]:[m.a1,m.a2]).slice().sort().join('|');
      if(s.lastLossOpp){
        if(currentOpp===s.lastLossOpp && w){
          fire('revanchist');
        }
        // Egal ob Revanche gelang oder nicht: Counter resetten (nicht mehr "direkt nächstes Match")
        s.lastLossOpp=null;
      }
      // Wenn aktuelles Match Niederlage: setze lastLossOpp für nächstes Match
      if(!w) s.lastLossOpp=currentOpp;

      // ── Königsklasse / Pflichtaufgabe: Sieg gegen Top-3 / Bottom-3 der Saison-Endrangliste ──
      // Cache ist nach erstem Aufruf für alle weiteren Matches verfügbar.
      if(w){
        const rk=getSeasonRankingsCache();
        const r=rk[seasonOf(m.created_at).id];
        if(r){
          const opps=onA?[m.b1,m.b2]:[m.a1,m.a2];
          if(r.top3.size && opps.some(oId=>r.top3.has(oId))) fire('koenigsklasse');
          if(r.bottom3.size && opps.some(oId=>r.bottom3.has(oId))) fire('pflichtaufgabe');
        }
      }

      // ── Thronfäller: Sieg gegen den Top-1 der Saison-Rangliste (Stand vor Match) ──
      // ── Überholmanöver: Sieg gegen Gegner, der dadurch in der Rangliste überholt wurde ──
      // ── Pflichterfüller: Sieg gegen mind. einen Bottom-2-Gegner (preRank-Stand vor Match) ──
      // Alle drei nutzen rankSnaps (preRank/postRank pro Match aus globalSim-Deltas).
      // Match-Trigger feuert je Badge maximal 1× pro Spieler pro Match — auch wenn
      // 2 Gegner überholt werden, gibts nur 1 Toast/Eintrag im Match-Review.
      // Der Counter (countOvertake) zählt die tatsächlichen 2 Überholungen für
      // das Profil-Aggregat — die beiden Pfade sind absichtlich getrennt.
      if(w){
        const rs=rankSnaps[m.id];
        if(rs && rs.preRank && rs.postRank){
          const opps=onA?[m.b1,m.b2]:[m.a1,m.a2];
          // Thronfäller: Wer war Top-1 in der Saison vor dem Match?
          let top1=null;
          for(const pid in rs.preRank){
            if(rs.preRank[pid]===1){ top1=pid; break; }
          }
          if(top1 && top1!==id && opps.includes(top1)) fire('kingslayer');
          // Überholmanöver: Hat X mindestens einen Gegner überholt?
          const preX=rs.preRank[id], postX=rs.postRank[id];
          if(preX && postX){
            const overtook=opps.some(oId=>{
              const preY=rs.preRank[oId], postY=rs.postRank[oId];
              return preY && postY && preX>preY && postX<postY;
            });
            if(overtook) fire('overtake');
          }
          // Pflichterfüller: Bottom-2-Gegner (rank >= N-1), ab 5 Spielern in der Saison
          const N = Object.keys(rs.preRank).length;
          if(N >= 5){
            const hit = opps.some(oId => rs.preRank[oId] && rs.preRank[oId] >= N-1);
            if(hit) fire('duty_done');
          }
        }
      }

      // ── Serienbrecher: Sieg, der eine Siegesserie (≥4) eines Gegners beendet hat ──
      // Nutzt den globalen streakSnaps-Cache (Stand der Streaks VOR dem Match) —
      // damit ist die Logik konsistent mit countStreakBreaker im Profil und unabhängig
      // davon, in welcher Reihenfolge die 4 Spieler im inneren Loop verarbeitet werden.
      if(w){
        const ss=streakSnaps[m.id];
        if(ss){
          const opps=onA?[m.b1,m.b2]:[m.a1,m.a2];
          if(opps.some(oId=>(ss[oId]||0)>=4)) fire('streak_breaker');
        }
      }

      // potw / potd / award_collector: erfordern Vergleich aller Spieler am Periodenende →
      // zu komplex für inkrementell, werden in computeBadges() lazy berechnet
      // vice_champion: Saison-End-Event, nicht an ein einzelnes Match gebunden →
      // wird ebenfalls in computeBadges() aus dem seasons-Archiv ermittelt
      // untouchable / allwetter / godly_streak: Saison-/Karriere-aggregiert →
      // ebenfalls nur via count-Funktion (kein Live-Trigger, kein Toast).
    });

    map[m.id]=earned;
  });

  _cache._badgeEarnedKey=key;
  _cache._badgeEarnedMap=map;
  return map;
}

function badgesEarnedInMatch(matchId){
  return getBadgeEarnedCache()[matchId]||[];
}

