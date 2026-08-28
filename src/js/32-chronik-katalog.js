// ╔═══ §13 ─── SAISON-TITEL & CHRONIK ──────────────────────────────────╗
//     Am Ende jeder Saison vergibt die App automatisch Titel. Kein Menü,
//     keine Auswahl: ein fester Katalog, eine feste Reihenfolge, ein
//     Durchlauf. Ein Titel pro Spieler, jeder Titel höchstens einmal.
//     Erfüllt niemand die Bedingung, bleibt der Titel unvergeben.
//
//     Architektur:
//       SEASON_TITLES[]      — Katalog in Vergabe-Reihenfolge [§13.1]
//       _seasonTitleCtx(sid) — EIN Durchlauf über die Saison-Matches [§13.2]
//       seasonTitles(sid)    — Vergabe, memoisiert [§13.3]
//       _freezeSeasonTitles  — abgeschlossene Saison in seasons.titles [§13.3a]
//       seasonTitleHistory(pid) — Titel-Historie eines Spielers [§13.4]
//       CHRONICLES[]         — Laufbahn-Chroniken, ligaweit [§13.4b]
//       _chronicleCtx()      — EIN Durchlauf über ALLE Matches [§13.4b]
//       allChronicles()      — Vergabe für die ganze Liga [§13.4b]
//       UI: showSeasonTable / showLigaChronik / showChronicle [§13.5]
//       Marken neben dem Namen [§13.6], Avatar-Status-Ring [§13.7]
//
//     KEINE zweite Rechenquelle: Elo kommt aus getGlobalSim (seasonEndElos
//     für abgeschlossene, elo für die laufende Saison), Matches aus
//     matchesInSeason(). Damit kann die Tafel nicht von der Rangliste
//     abweichen.
//
//     GERECHNET WIRD NUR DIE LAUFENDE SAISON. Sobald ein Monat archiviert ist,
//     steht seine Chronik in seasons.titles und wird von dort gelesen (§13.3a).
//     Ein Eingriff in den Katalog verändert also nur noch die Zukunft. Alles Weitere entsteht in genau einem chronologischen
//     Pass über die Saison-Matches — dieselbe Semantik wie playerStats.
//
//     ⚑ HOTSPOT — neue Titel brauchen:
//       - Eintrag in SEASON_TITLES (§13.1) an der richtigen RANG-Stelle
//       - ggf. ein neues Feld im Kontext-Pass (§13.2)
//
//     LEISTUNG VOR PENSUM — die Regel seit v9.20:
//       Beide Kataloge sind in Blöcke geteilt. Vorn steht, was eine QUOTE
//       misst und eine niedrige Einstiegshürde hat: Wer nur an zwei Abenden
//       im Monat spielt, soll dieselbe Chance auf einen Eintrag haben wie der
//       Vielspieler. Dahinter kommt, was an der Spielzahl hängt (Serien,
//       Summen, Anwesenheit), ganz hinten die Schattenseiten. Weil jeder
//       Spieler nur EINEN Eintrag pro Monat trägt und `byPid` den ersten
//       Treffer als seinen wertvollsten zeigt, ist diese Reihenfolge kein
//       Schönheitsdetail: Sie entscheidet, was jemand vorn im Profil sieht.
//
//     KEINE VERBINDUNGEN — ebenfalls seit v9.20:
//       Es gibt keine Einträge mehr, die ein DUO beschreiben („beste Quote
//       mit Partner X", „Angstgegner Y", „meiste Team-of-the-Season-Titel").
//       Wer sie hielt, hatte sie halb dem anderen zu verdanken, und dieselbe
//       Zeile stand am Ende bei zwei Leuten im Profil. Was ein Partner
//       auslöst, wird nur noch als EIGENE Leistung gemessen — „Der Veredler"
//       zählt, wie viel besser die anderen neben ihm sind, und nennt dabei
//       keinen Namen.
//
//     REKORD ODER SCHWELLE — die Regel seit v9.19:
//       Ein Titel pro Spieler heißt, dass ein Eintrag weiterrutscht, wenn der
//       Beste schon etwas trägt. Eine Bedingung darf deshalb nur dann einen
//       Superlativ behaupten, wenn der Eintrag `strict:true` gesetzt hat —
//       dann geht er ausschließlich an einen echten Bestwert-Halter (bei
//       Gleichstand an den ersten freien von ihnen) oder gar nicht. Alle
//       anderen Bedingungen nennen eine SCHWELLE („mindestens 8 Siege am
//       Stück"), nie einen Superlativ. Nur so stimmt jede Zeile der Tafel,
//       egal wer vorher zugegriffen hat.
//     Neue CHRONIKEN brauchen:
//       - Eintrag in CHRONICLES (§13.4b); die Katalog-Reihenfolge entscheidet
//         bei Gleichstand, welche Chronik als Signatur neben dem Namen steht
//       - ggf. ein neues Feld in _chronicleCtx (§13.4b)
//
//     ABGRENZUNG — die wichtigste Regel dieses Abschnitts:
//       Saisontitel beschreiben EINEN Monat, Chroniken eine LAUFBAHN. Eine
//       Chronik, die nur nachzählt, wie oft jemand einen Saisontitel geholt
//       hat, ist eine Doppelung und gehört nicht in den Katalog. Einzige
//       Ausnahme ist „Die Dynastie": drei Meistertitel IN FOLGE ist eine
//       eigene Aussage, die keine Monatstafel je zeigen kann.
//       Die Königs-Quoten (rec_potw/rec_potd) sind KEINE Doppelung: Sie
//       zählen keinen Chronik-Eintrag nach, sondern setzen die Player-of-the-
//       Week-/Day-Auszeichnungen ins Verhältnis zu den Wochen und Tagen, an
//       denen der Spieler überhaupt angetreten ist.
// ╚═════════════════════════════════════════════════════════════════════════╝

// Farbwelt der Titel — greift die Rarity-Töne der Badges auf, damit sich
// Tafel, Profil und Rangliste gleich anfühlen.
const TITLE_TONES = {
  gold:   {c:'var(--gold)',   rgb:'247,207,74'},
  silver: {c:'#c3ced9',       rgb:'154,167,181'},
  acid:   {c:'var(--acid)',   rgb:'190,242,100'},
  blue:   {c:'var(--blue)',   rgb:'86,180,232'},
  orange: {c:'var(--orange)', rgb:'255,120,73'},
  purple: {c:'var(--purple)', rgb:'167,139,250'},
  red:    {c:'var(--red)',    rgb:'240,86,106'},
};
function titleTone(tone){ return TITLE_TONES[tone] || TITLE_TONES.acid; }

// Mindest-Spiele, damit ein Spieler in einer Saison überhaupt gewertet wird.
// Wer drei Spiele mitgenommen hat, soll keinen Saisontitel gewinnen können.
const TITLE_MIN_GAMES = 8;

// ─── §13.1 Katalog ───────────────────────────────────────────────────
// Reihenfolge = Vergabe-Reihenfolge. Wer weiter oben steht, greift zuerst zu.
// pick(C, taken) liefert {pid, ev} oder null. `ev` ist der Beleg-Text, der
// überall unter dem Titel steht — er MUSS die Zahl nennen, die den Titel
// ausgelöst hat, sonst ist die Vergabe nicht nachvollziehbar.
const SEASON_TITLES = [
  // ── 1. Der eine echte Bestwert ───────────────────────────────────
  // Er greift zuerst zu, weil `strict` ihn sonst oft gar nicht vergäbe: Wer
  // die beste Bilanz hat, ist meistens auch für vieles andere der Erste.
  // Er greift zuerst zu, weil `strict` ihn sonst oft gar nicht vergibt: Wer
  // die beste Bilanz hat, ist meistens auch für vieles andere der Erste.
  // Ganz oben steht, was eine QUOTE misst und eine niedrige Einstiegshürde
  // hat: zehn Spiele, fünf Spieltage, zwölf Partien als Außenseiter. Wer nur
  // an zwei Abenden im Monat kommt, kann diese Einträge genauso holen wie
  // jemand, der jeden Tag da ist — es zählt, WIE er gespielt hat, nicht wie oft.
  // ── Warum hier kein „Meister" und kein „Kronprinz" steht ──────────
  // Beide gingen per Definition an Platz 1 und Platz 2 der Saison-Elo. Damit
  // war jede Chronik der beiden Besten schon vergeben, bevor der Katalog
  // überhaupt losgelaufen ist — und die Chronik sagte nichts, was die
  // Rangliste nicht ohnehin zeigt. Der Meistertitel bleibt selbstverständlich
  // bestehen, er kommt jetzt direkt aus der Rangliste (seasonChampion) und
  // steht als Krone neben dem Namen. Die Chronik ist für das da, was man an
  // der Tabelle NICHT ablesen kann.
  //
  // ── Quoten statt Summen ────────────────────────────────────────────
  // Zweite Grundregel: Ein Titel darf nicht automatisch an den gehen, der am
  // meisten spielt. „Meiste 10:9-Siege" ist in Wahrheit „meiste Spiele".
  // Deshalb misst fast jeder Titel einen ANTEIL und setzt eine Mindestbasis,
  // damit die Quote belastbar ist. Ausnahmen sind nur die Titel, die das
  // Vielspielen ausdrücklich MEINEN (Unermüdlicher, Marathonmann).
  // ── Der Maßstab steht ganz oben ────────────────────────────────────
  // Er ist der einzige Eintrag, der die schlichteste Frage der Saison
  // beantwortet: Wer hat am häufigsten gewonnen? Zehn Spiele reichen als
  // Grundlage — wer in einem Monat nur kurz auftaucht und dabei alles
  // wegräumt, hat den Monat genauso geprägt wie ein Dauergast. Er ist NICHT
  // der Meister: der zählt Elo, das hier zählt die nackte Bilanz, und die
  // beiden fallen regelmäßig auseinander.
  {id:'best_record', name:'Der Maßstab', short:'Maßstab', ic:'medal2', tone:'gold', strict:true,
    cond:'Beste Bilanz der Saison — höchste Siegquote ab 10 Spielen',
    pick:(C,t)=>_stPickTop(C,t,p=>p.games>=10?p.wins/p.games:null,
      (p,v)=>`${p.wins}–${p.losses} · ${Math.round(v*100)} % aus ${p.games} Spielen`, true)},


  // ── 2. Leistung — selten und stark zuerst ────────────────────────
  // Sortiert nach WERT, nicht nach Alphabet oder Laune. Der Wert ergibt sich
  // aus zwei Dingen: wie selten der Eintrag auf den echten Daten überhaupt
  // erreicht wird, und wie viel seine Aussage taugt. „Der Platzhirsch" holen
  // fünf von 36 Spieler-Monaten, „Der Grenzgänger" vierzehn — also greift der
  // Platzhirsch zuerst zu und der Grenzgänger zuletzt. Was die meisten
  // erreichen, ist weniger wert als das, was fast niemand schafft.
  // Keiner dieser Einträge hängt am Pensum: Sie messen Quoten, und die kann
  // auch holen, wer nur an zwei Abenden im Monat da ist.
  // Ein makelloser Spieltag ist die seltenste Sache in diesem Katalog: vier
  // oder mehr Partien an einem Tag und keine einzige davon verloren. In vier
  // Monaten Liga-Geschichte gab es das ganze sechsmal.
  {id:'daylord', name:'Der Platzhirsch', short:'Revier', ic:'trophyDay', tone:'gold',
    cond:'An mindestens 30 % der eigenen Spieltage Player of the Day, ab 5 Spieltagen',
    pick:(C,t)=>_stPickTop(C,t,p=>(p.days>=5 && p.potd/p.days>=0.30)?p.potd/p.days:null,
      (p,v)=>`Player of the Day an ${p.potd} seiner ${p.days} Spieltage · ${Math.round(v*100)} %`)},

  // Der Gigantentöter zählt die Sensationen, der Bergsteiger die Regel: Wie
  // oft gewinnt jemand, wenn die Rechnung überhaupt gegen ihn steht? Über
  // 50 % heißt, dass die Rechnung ihn unterschätzt.
  {id:'reliable', name:'Der Verlässliche', short:'Konstanz', ic:'shieldCheck', tone:'gold',
    cond:'Mindestens 65 % der eigenen Spieltage mit positiver Bilanz beendet, ab 6 Spieltagen',
    pick:(C,t)=>_stPickTop(C,t,p=>(p.days>=6 && p.posDays/p.days>=0.65)?p.posDays/p.days:null,
      (p,v)=>`${p.posDays} seiner ${p.days} Spieltage mit mehr Siegen als Pleiten · ${Math.round(v*100)} %`)},

  {id:'twoway', name:'Der Doppelbegabte', short:'Beidseitig', ic:'diamond', tone:'gold',
    cond:'Mindestens 60 % Siege vorne UND hinten, je 12 Spiele',
    pick:(C,t)=>_stPickTop(C,t,p=>{
      if(p.atkG<12 || p.defG<12) return null;
      const lo=Math.min(p.atkW/p.atkG, p.defW/p.defG);
      return lo>=0.60?lo:null;
    }, (p)=>`${Math.round(p.atkW/p.atkG*100)} % vorne, ${Math.round(p.defW/p.defG*100)} % hinten`)},

  // Diese Einträge belohnen Anwesenheit und Masse: eine lange Serie braucht
  // viele Spiele, „Der Unermüdliche" ist die Spielzahl selbst. Sie bleiben im
  // Katalog, stehen aber bewusst HINTER allem, was eine Quote misst — sonst
  // holt der Vielspieler die Chronik, bevor der bessere Spieler drankommt.
  {id:'unstoppable', name:'Der Unaufhaltsame', short:'Serie', ic:'flame', tone:'orange', strict:true,
    cond:'Längste Siegesserie der Saison, mindestens 8 Spiele am Stück',
    pick:(C,t)=>_stPickTop(C,t,p=>p.bestStreak>=8?p.bestStreak:null,
      (p,v)=>`${v} Siege in Folge${p.streakSpan?' · '+p.streakSpan:''}`, true)},

  {id:'kingslayer', name:'Der Königsmörder', short:'Königsjagd', ic:'kingFall', tone:'gold',
    cond:'Über 55 % Siege gegen den Saison-Ersten, bei mindestens 15 Duellen',
    pick:(C,t)=>_stPickTop(C,t,p=>(p.vsTopGames>=15 && p.vsTop/p.vsTopGames>0.55)?p.vsTop/p.vsTopGames:null,
      (p,v)=>`${p.vsTop} von ${p.vsTopGames} Duellen gegen den Ersten gewonnen`)},

  {id:'spotless', name:'Der makellose Tag', short:'Makellos', ic:'trophyDay', tone:'gold',
    cond:'Ein voller Spieltag (4+ Partien) ganz ohne Niederlage, bei mindestens 5 solchen Tagen',
    pick:(C,t)=>_stPickTop(C,t,p=>(p.bigDays>=5 && p.perfDays>=1)?p.perfDays/p.bigDays:null,
      (p)=>p.perfDays===1 ? `Ein voller Spieltag ohne eine einzige Niederlage · 1 von ${p.bigDays}`
                          : `${p.perfDays} von ${p.bigDays} vollen Spieltagen ohne Niederlage`)},

  // ── Der Katalysator: die persönlichste Zahl des Katalogs ───────────
  // Er misst nicht, wie gut jemand SELBST ist, sondern was mit den anderen
  // passiert, sobald er neben ihnen steht. Verglichen wird für jeden Partner
  // dessen Quote MIT ihm gegen dessen Quote OHNE ihn. Vielspielen hilft dabei
  // null: Wer alles mitnimmt, hebt niemanden — er zieht den Schnitt mit.
  {id:'catalyst', name:'Der Katalysator', short:'Katalyse', ic:'handshake', tone:'gold',
    cond:'Partner gewinnen an seiner Seite mindestens 14 Prozentpunkte häufiger als ohne ihn',
    pick:(C,t)=>_stPickTop(C,t,p=>(p.upliftMates>=2 && p.uplift!=null && p.uplift>=0.14)?p.uplift:null,
      (p,v)=>`Seine ${p.upliftMates} Partner gewinnen neben ihm ${Math.round(v*100)} Punkte häufiger`)},

  {id:'flawless', name:'Der Perfektionist', short:'Perfektion', ic:'star', tone:'gold',
    cond:'Tordifferenz von mindestens +1,5 pro Spiel, ab 25 Spielen',
    pick:(C,t)=>_stPickTop(C,t,p=>(p.games>=25 && p.gd/p.games>=1.5)?p.gd/p.games:null,
      (p,v)=>`Ø +${v.toFixed(1)} Tore pro Spiel`)},

  // Nicht die Serie nach oben, sondern die fehlende nach unten: Wer nie zwei-
  // oder dreimal am Stück verliert, hat eine Saison ohne Loch gespielt.
  {id:'unbowed', name:'Der Unerschütterliche', short:'Kein Loch', ic:'concreteWall', tone:'blue',
    cond:'Nie mehr als 2 Niederlagen am Stück, bei mindestens 25 Spielen',
    pick:(C,t)=>_stPickTop(C,t,p=>(p.games>=25 && p.worstLoss<=2)?-p.worstLoss:null,
      (p)=>p.worstLoss<=1 ? `Nie zwei Niederlagen hintereinander · ${p.wins}–${p.losses}`
                          : `Nie mehr als 2 Niederlagen am Stück · ${p.wins}–${p.losses}`)},

  // Nicht „spielt beide Positionen", sondern „gewinnt auf beiden". Der
  // Unterschied ist groß: Fast jeder rotiert, aber kaum jemand ist vorne UND
  // hinten überdurchschnittlich.
  // Dieselbe Idee, aber die Quote braucht 20–30 Partien, damit sie etwas
  // aussagt. Deshalb stehen sie hinter Block 1: erreichbar, aber nicht in
  // einem einzigen Abend.
  {id:'executioner', name:'Der Vollstrecker', short:'Zu Null', ic:'hundred', tone:'gold',
    cond:'Mindestens 4 % der eigenen Siege endeten 10:0, ab 20 Siegen',
    pick:(C,t)=>_stPickTop(C,t,p=>(p.wins>=20 && p.perfect/p.wins>=0.04)?p.perfect/p.wins:null,
      (p,v)=>`${p.perfect} seiner ${p.wins} Siege endeten 10:0 · ${Math.round(v*100)} %`)},

  {id:'giant_slayer', name:'Der Gigantentöter', short:'Underdog', ic:'tornado', tone:'acid',
    cond:'Mindestens jedes zehnte Spiel mit unter 35 % Siegchance gewonnen, ab 20 Spielen',
    pick:(C,t)=>_stPickTop(C,t,p=>(p.games>=20 && p.upsets/p.games>=0.10)?p.upsets/p.games:null,
      (p,v)=>`${p.upsets} von ${p.games} Spielen gegen die Wahrscheinlichkeit gewonnen`)},

  {id:'underdog_king', name:'Der Bergsteiger', short:'Bergauf', ic:'underdog', tone:'acid',
    cond:'Mehr als die Hälfte der Partien als Außenseiter gewonnen, ab 12 solchen Partien',
    pick:(C,t)=>_stPickTop(C,t,p=>(p.favG>=12 && p.favW/p.favG>=0.50)?p.favW/p.favG:null,
      (p,v)=>`${p.favW} von ${p.favG} Partien gewonnen, in die er als Außenseiter ging`)},

  {id:'destroyer', name:'Der Zerstörer', short:'Zerstörer', ic:'explosion', tone:'orange',
    cond:'Mindestens ein Viertel der eigenen Siege mit 7+ Toren Vorsprung, ab 20 Siegen',
    pick:(C,t)=>_stPickTop(C,t,p=>(p.wins>=20 && p.blowouts/p.wins>=0.25)?p.blowouts/p.wins:null,
      (p,v)=>`${p.blowouts} seiner ${p.wins} Siege mit 7+ Toren Vorsprung`)},

  // Die Reihenfolge ist an den echten Daten gemessen: ganz vorn steht, was
  // in vier Monaten fast niemand geschafft hat, hinten das, was die meisten
  // erreichen. Ein seltener Eintrag ist mehr wert als ein häufiger, also
  // greift er auch zuerst zu. Keiner dieser Einträge hängt am Pensum — sie
  // messen alle eine Quote, und die kann auch holen, wer selten kommt.
  {id:'rock', name:'Der Fels', short:'Fels', ic:'brick', tone:'blue',
    cond:'Höchstens 6,0 Gegentore pro Spiel als Verteidiger, ab 25 Abwehrspielen',
    pick:(C,t)=>_stPickTop(C,t,p=>(p.defG>=25 && p.defConceded/p.defG<=6.0)?-(p.defConceded/p.defG):null,
      (p,v)=>`Ø ${(-v).toFixed(1)} Gegentore in ${p.defG} Abwehrspielen`)},

  {id:'sniper', name:'Der Torjäger', short:'Torjäger', ic:'ball', tone:'orange',
    cond:'Mindestens 8,8 eigene Tore pro Spiel als Stürmer, ab 25 Sturmspielen',
    pick:(C,t)=>_stPickTop(C,t,p=>(p.atkG>=25 && p.atkGoals/p.atkG>=8.8)?p.atkGoals/p.atkG:null,
      (p,v)=>`Ø ${v.toFixed(1)} Tore in ${p.atkG} Sturmspielen`)},

  {id:'wall', name:'Die Mauer', short:'Mauer', ic:'shieldStar', tone:'blue',
    cond:'Mindestens 65 % Abwehr, 20 Spiele und positive Tordifferenz',
    pick:(C,t)=>_stPickTop(C,t,p=>(p.games>=20 && p.gd>0 && p.defG/p.games>=0.65)?p.defG/p.games:null,
      (p,v)=>`${p.defG} von ${p.games} Spielen hinten · ${p.gd>0?'+':''}${p.gd} Tordifferenz`)},

  // Der Phönix misst nicht, wie hoch jemand steht, sondern wie tief er war.
  // Grundlage ist der größte Einbruch der Saison (Hoch → Tief) und das, was
  // danach wieder aufgeholt wurde. Wer nie eingebrochen ist, kann ihn nicht
  // bekommen — sonst wäre es wieder nur ein Elo-Titel.
  {id:'phoenix', name:'Der Phönix', short:'Phönix', ic:'comeback', tone:'acid',
    cond:'Nach einem Einbruch von 100 Elo wieder mindestens 120 Punkte gutgemacht',
    pick:(C,t)=>_stPickTop(C,t,p=>{
      if(p.maxDD < 100 || p.ddLow == null) return null;
      const back = p.elo - p.ddLow;
      return back >= 120 ? back : null;
    }, (p,v)=>`Von ${Math.round(p.ddLow)} Elo zurück auf ${p.elo} · +${Math.round(v)}`)},

  {id:'climber', name:'Der Aufsteiger', short:'Aufsteiger', ic:'climb', tone:'acid',
    cond:'Mindestens 120 Elo mehr als am Ende der Vorsaison',
    pick:(C,t)=>_stPickTop(C,t,p=>(p.growth!=null && p.growth>=120)?p.growth:null,
      (p,v)=>`+${Math.round(v)} Elo gegenüber der Vorsaison`)},

  {id:'opener', name:'Der Türöffner', short:'Auftakt', ic:'godRay', tone:'acid',
    cond:'Mindestens 60 % der Auftaktspiele eines Spieltags gewonnen, ab 8 solchen Spielen',
    pick:(C,t)=>_stPickTop(C,t,p=>(p.firstG>=8 && p.firstW/p.firstG>=0.60)?p.firstW/p.firstG:null,
      (p,v)=>`${p.firstW} von ${p.firstG} Auftaktspielen gewonnen`)},

  {id:'closer', name:'Der Schlussstrich', short:'Abschluss', ic:'stopwatch', tone:'purple',
    cond:'Mindestens 60 % der Tagesabschlüsse gewonnen, ab 8 solchen Spielen',
    pick:(C,t)=>_stPickTop(C,t,p=>(p.lastG>=8 && p.lastW/p.lastG>=0.60)?p.lastW/p.lastG:null,
      (p,v)=>`${p.lastW} von ${p.lastG} Tagesabschlüssen gewonnen`)},

  {id:'switcher', name:'Der Wandler', short:'Wandler', ic:'refresh', tone:'purple',
    cond:'45–55 % auf beiden Positionen, mindestens 30 Spiele und positive Bilanz',
    pick:(C,t)=>_stPickTop(C,t,p=>{
      if(p.games<30 || p.wins<=p.losses) return null;
      const share=p.defG/p.games;
      if(share<0.45 || share>0.55) return null;
      return -Math.abs(share-0.5); // je ausgeglichener, desto besser
    }, (p)=>`${p.atkG} vorne, ${p.defG} hinten · ${p.wins}–${p.losses}`)},

  {id:'efficient', name:'Der Effiziente', short:'Effizienz', ic:'peak', tone:'acid',
    cond:'Siegquote von mindestens 60 % bei 25 oder mehr Spielen',
    pick:(C,t)=>_stPickTop(C,t,p=>(p.games>=25 && p.wins/p.games>=0.60)?p.wins/p.games:null,
      (p,v)=>`${Math.round(v*100)} % aus ${p.games} Spielen`)},

  {id:'comeback_king', name:'Der Stehaufmann', short:'Comeback', ic:'comeback', tone:'acid',
    cond:'Mindestens 55 % der Spiele direkt nach einer Niederlage gewonnen, ab 20 Gelegenheiten',
    pick:(C,t)=>_stPickTop(C,t,p=>(p.afterLossOpp>=20 && p.afterLoss/p.afterLossOpp>=0.55)?p.afterLoss/p.afterLossOpp:null,
      (p,v)=>`${p.afterLoss} von ${p.afterLossOpp} Antworten nach einer Pleite gewonnen`)},

  {id:'thriller', name:'Der Nervenkitzler', short:'Krimi', ic:'nerves', tone:'purple',
    cond:'Mindestens 15 % der eigenen Siege endeten 10:9, ab 20 Siegen',
    pick:(C,t)=>_stPickTop(C,t,p=>(p.wins>=20 && p.nail/p.wins>=0.15)?p.nail/p.wins:null,
      (p,v)=>`${p.nail} seiner ${p.wins} Siege endeten 10:9 · ${Math.round(v*100)} %`)},

  // Das Gegenstück zum Zerstörer: Wer verliert, verliert — aber manche gehen
  // dabei nie unter. Höchstens jede zehnte Niederlage ein Debakel, das
  // schaffen in dieser Liga zwei Leute.
  {id:'damage_control', name:'Der Schadensbegrenzer', short:'Limit', ic:'blockedShot', tone:'blue',
    cond:'Höchstens jede zehnte Niederlage mit 7+ Toren Rückstand, ab 12 Niederlagen',
    pick:(C,t)=>_stPickTop(C,t,p=>(p.losses>=12 && p.blowL/p.losses<=0.10)?-(p.blowL/p.losses):null,
      (p)=>p.blowL===0 ? `Keine einzige seiner ${p.losses} Niederlagen war ein Debakel`
                       : `Nur ${p.blowL} seiner ${p.losses} Niederlagen gingen deutlich verloren`)},

  {id:'borderline', name:'Der Grenzgänger', short:'Grenzgang', ic:'pinch', tone:'purple',
    cond:'Fast jedes dritte Spiel auf Messers Schneide (max. 2 Tore Unterschied), ab 25 Spielen',
    pick:(C,t)=>_stPickTop(C,t,p=>(p.games>=25 && p.close/p.games>=0.32)?p.close/p.games:null,
      (p,v)=>`${p.close} von ${p.games} Spielen auf Messers Schneide · ${Math.round(v*100)} %`)},


  // ── 3. Was vom Pensum abhängt ─────────────────────────────────────
  // Diese Einträge belohnen Anwesenheit und Masse: „Der Unermüdliche" IST
  // die Spielzahl, „Der Marathonmann" die Spiele eines Tages. Sie bleiben im
  // Katalog, stehen aber hinter allem, was eine Quote misst — sonst holt der
  // Vielspieler die Chronik, bevor der bessere Spieler drankommt.
  {id:'marathon', name:'Der Marathonmann', short:'Marathon', ic:'gamepad', tone:'acid', strict:true,
    cond:'Meiste Spiele an einem einzigen Tag, mindestens 12',
    pick:(C,t)=>_stPickTop(C,t,p=>p.maxDay>=12?p.maxDay:null,
      (p,v)=>`${v} Spiele an einem Tag${p.maxDayLabel?' · '+p.maxDayLabel:''}`, true)},

  {id:'tireless', name:'Der Unermüdliche', short:'Dauergast', ic:'weight', tone:'acid', strict:true,
    cond:'Meiste Spiele der Saison, mindestens das 1,6-fache des Liga-Medians',
    pick:(C,t)=>_stPickTop(C,t,p=>p.games>=C.gamesBar?p.games:null,
      (p,v)=>`${v} Spiele an ${p.days} von ${C.days} Spieltagen`, true)},

  {id:'omnipresent', name:'Der Allgegenwärtige', short:'Immer da', ic:'weekly', tone:'blue',
    cond:'An mindestens 90 % aller Spieltage dabei',
    pick:(C,t)=>_stPickTop(C,t,p=>(C.days>=6 && p.days/C.days>=0.90)?p.days:null,
      (p,v)=>`an ${v} von ${C.days} Spieltagen dabei`)},

  // Diese Einträge belohnen Anwesenheit und Masse: eine lange Serie braucht
  // viele Spiele, „Der Unermüdliche" IST die Spielzahl. Sie bleiben im
  // Katalog, stehen aber hinter allem, was eine Quote misst — sonst holt der
  // Vielspieler die Chronik, bevor der bessere Spieler drankommt.
  {id:'night_owl', name:'Der Nachtschwärmer', short:'Nachteule', ic:'clock', tone:'purple',
    cond:'Deutlich mehr späte Matches als der Liga-Schnitt, mindestens 15 nach 22 Uhr',
    pick:(C,t)=>_stPickTop(C,t,p=>(p.night>=15 && p.games>=20
        && p.night/p.games >= Math.max(0.30, C.nightShare*1.5)) ? p.night/p.games : null,
      (p,v)=>`${p.night} von ${p.games} Matches nach 22 Uhr`)},

  {id:'early_riser', name:'Der Frühaufsteher', short:'Frühstart', ic:'sunrise', tone:'acid',
    cond:'Deutlich mehr Vormittags-Matches als der Liga-Schnitt, mindestens 15 vor 12 Uhr',
    pick:(C,t)=>_stPickTop(C,t,p=>(p.morning>=15 && p.games>=20
        && p.morning/p.games >= Math.max(0.30, C.morningShare*1.5)) ? p.morning/p.games : null,
      (p,v)=>`${p.morning} von ${p.games} Matches vor dem Mittag`)},


  // ── 4. Schattenseiten ─────────────────────────────────────────────
  // „Die Durststrecke" steht vorn, weil sie `strict` ist: Sie gehört dem, der
  // die längste Pleitenserie wirklich hatte, sonst niemandem.
  // ── Schattenseiten ganz zum Schluss ────────────────────────────────
  // Sie greifen erst, wenn für diesen Spieler nichts Besseres mehr frei war.
  // Niemand soll einen Schandtitel bekommen, obwohl er einen guten verdient
  // hätte — deshalb stehen sie hier unten und nicht oben.
  {id:'drought', name:'Die Durststrecke', short:'Flaute', ic:'dropTriple', tone:'red', strict:true,
    cond:'Längste Niederlagenserie der Saison, mindestens 6 Spiele am Stück',
    pick:(C,t)=>_stPickTop(C,t,p=>p.worstLoss>=6?p.worstLoss:null,
      (p,v)=>`${v} Niederlagen in Folge${p.lossSpan?' · '+p.lossSpan:''}`, true)},

  {id:'abyss', name:'Das Fass ohne Boden', short:'Debakel', ic:'dizzy', tone:'red',
    cond:'Mindestens 5 % der eigenen Niederlagen endeten 0:10, ab 20 Niederlagen',
    pick:(C,t)=>_stPickTop(C,t,p=>(p.losses>=20 && p.debacle/p.losses>=0.05)?p.debacle/p.losses:null,
      (p,v)=>`${p.debacle} seiner ${p.losses} Niederlagen endeten 0:10`)},

  {id:'freefall', name:'Der Sturzflug', short:'Sturzflug', ic:'crownFallen', tone:'red',
    cond:'Mindestens 150 Elo unter dem eigenen Saison-Hoch geendet',
    pick:(C,t)=>_stPickTop(C,t,p=>{
      if(p.eloHigh == null) return null;
      const d = p.eloHigh - p.elo;
      return d >= 150 ? d : null;
    }, (p,v)=>`Vom Saison-Hoch bei ${Math.round(p.eloHigh)} Elo auf ${p.elo} zurück`)},

  {id:'punchbag', name:'Der Prügelknabe', short:'Sandsack', ic:'trendCrash', tone:'red',
    cond:'Tordifferenz von höchstens −2,0 pro Spiel, ab 20 Spielen',
    pick:(C,t)=>_stPickTop(C,t,p=>(p.games>=20 && p.gd/p.games<=-2.0)?-(p.gd/p.games):null,
      (p,v)=>`Ø ${(-v).toFixed(1)} Tore pro Spiel · ${p.wins}–${p.losses}`)},

  {id:'hardluck', name:'Der Pechvogel', short:'Pechvogel', ic:'heartBroken', tone:'red',
    cond:'Mindestens 12 % der eigenen Niederlagen endeten 9:10, ab 20 Niederlagen',
    pick:(C,t)=>_stPickTop(C,t,p=>(p.losses>=20 && p.bitter/p.losses>=0.12)?p.bitter/p.losses:null,
      (p,v)=>`${p.bitter} seiner ${p.losses} Niederlagen endeten 9:10 · ${Math.round(v*100)} %`)},
];
const SEASON_TITLE_BY_ID = {};
SEASON_TITLES.forEach(t => { SEASON_TITLE_BY_ID[t.id] = t; });

// Wählt den besten noch freien Spieler. score(p, pid) liefert eine Zahl
// (größer = besser) oder null, wenn die Bedingung nicht erfüllt ist.
// Gleichstand bricht: mehr Siege → bessere Tordifferenz → Spieler-ID.
// Damit ist die Vergabe deterministisch — dieselbe Saison ergibt immer
// dieselbe Tafel, unabhängig von Objekt-Reihenfolgen.
//
// `strict` (v9.19) ist der Unterschied zwischen einem Titel und einem REKORD:
// Ein Eintrag, dessen Bedingung wirklich „der beste der Saison" behauptet, darf
// nicht an den Zweitbesten rutschen, nur weil der Erste diesen Monat schon
// etwas anderes trägt. Bei strict wird der Bestwert über ALLE gewerteten
// Spieler gesucht; den Titel bekommt nur, wer diesen Wert auch wirklich hält.
// Halten ihn mehrere punktgleich, greift der erste freie von ihnen — auch er
// hält ja den Bestwert. Ist keiner der Bestwert-Halter mehr frei, bleibt der
// Eintrag leer: lieber kein Eintrag als ein Rekord, der keiner ist.
//
// Alle anderen Einträge nennen in ihrer Bedingung eine SCHWELLE statt eines
// Superlativs („Siegesserie von mindestens 9" statt „längste Siegesserie").
// Sie dürfen deshalb weiterrutschen, ohne etwas Falsches zu behaupten — und
// genau das hält die Tafel abwechslungsreich.
function _stPickTop(C, taken, score, ev, strict){
  let bp = null, bv = -Infinity;
  const tied = [];
  Object.keys(C.P).forEach(pid => {
    if(!strict && taken.has(pid)) return;
    const p = C.P[pid];
    const v = score(p, pid);
    if(v == null || !isFinite(v)) return;
    if(v > bv + 1e-9){ bv = v; bp = pid; tied.length = 0; tied.push(pid); return; }
    if(Math.abs(v - bv) > 1e-9 || !bp) return;
    tied.push(pid);
    const b = C.P[bp];
    const better = p.wins !== b.wins ? p.wins > b.wins
                 : p.gd    !== b.gd  ? p.gd    > b.gd
                 : pid < bp;
    if(better) bp = pid;
  });
  if(!bp) return null;
  if(strict && taken.has(bp)){
    // Punktgleiche Halter derselben Bestmarke, in derselben festen Ordnung.
    const free = tied.filter(id => !taken.has(id))
      .sort((a, b) => C.P[b].wins - C.P[a].wins || C.P[b].gd - C.P[a].gd || (a < b ? -1 : 1));
    if(!free.length) return null;
    bp = free[0];
  }
  return {pid: bp, ev: ev(C.P[bp], bv, C)};
}

