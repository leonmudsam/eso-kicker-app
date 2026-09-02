// ╔═══ §13 ─── DISZIPLINEN: MONATSTAFEL & LIGA-REKORDE ─────────────────╗
//     Eine Liga misst dieselben Dinge auf zwei Zeitachsen: Wer war diesen
//     Monat der Beste darin — und wer war es je. Früher waren das zwei
//     Kataloge, und achtzehnmal stand derselbe Gedanke in beiden: „Der
//     Vollstrecker" maß den Anteil 10:0-Siege für einen Monat, „Der Henker"
//     denselben Anteil für die Laufbahn. Zwei Namen, zwei Icons, im Profil
//     zwei Zeilen mit derselben Aussage.
//
//     Es gibt deshalb nur noch EINEN Katalog: DISZIPLINEN [§13.1]. Jede
//     Disziplin hat höchstens eine `monat`- und höchstens eine `allzeit`-
//     Wertung, und beide messen dieselbe Größe.
//
//     Architektur:
//       DISZIPLINEN[]        — der eine Katalog [§13.1]
//       SEASON_TITLES[]      — daraus abgeleitet, die Monatswertungen [§13.1]
//       CHRONICLES[]         — daraus abgeleitet, die Allzeitwertungen [§13.4b]
//       _seasonTitleCtx(sid) — EIN Durchlauf über die Saison-Matches [§13.2]
//       seasonTitles(sid)    — Vergabe, memoisiert [§13.3]
//       _freezeSeasonTitles  — abgeschlossene Saison in seasons.titles [§13.3a]
//       seasonTitleHistory(pid) — Titel-Historie eines Spielers [§13.4]
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
//     GERECHNET WIRD NUR DIE LAUFENDE SAISON. Sobald ein Monat archiviert
//     ist, steht seine Tafel in seasons.titles und wird von dort gelesen
//     [§13.3a] — vollständig, mit Name, Icon, Ton und Beleg. Eine Disziplin
//     zu streichen verändert deshalb nur die Zukunft; alte Monate zeigen
//     weiter, was damals galt, auch wenn es den Eintrag heute nicht mehr gibt.
//
//     ⚑ HOTSPOT — neue Disziplinen brauchen (vollständig: CLAUDE.md §10.2):
//       - Eintrag in DISZIPLINEN [§13.1] an der richtigen Stelle im Block
//       - ein neues Feld in BEIDEN Kontext-Pässen, [§13.2] für `monat` und
//         [§13.4b] für `allzeit`. Nur einer davon ist der häufigste Fehler:
//         die Monatstafel zeigt den Eintrag, der Liga-Rekord bleibt leer
//       - `art` setzen — sie steuert den Prestige-Wert [§13.8], und ein
//         neuer Eintrag verschiebt die Insignium-Leiter mit
//
//     LEISTUNG VOR EREIGNIS VOR SCHATTEN — die Reihenfolge im Katalog:
//       Vorn steht, was eine QUOTE misst und eine niedrige Einstiegshürde
//       hat: Wer nur an zwei Abenden im Monat spielt, soll dieselbe Chance
//       haben wie der Vielspieler. Dahinter kommt, was einmalig passiert
//       ist, ganz hinten die Schattenseiten. Weil jeder Spieler nur EINEN
//       Monatseintrag trägt und `byPid` den ersten Treffer als seinen
//       wertvollsten zeigt, entscheidet diese Reihenfolge, was jemand vorn
//       im Profil sieht.
//
//     KEIN PENSUM MEHR: Einträge, die nur die Spielzahl maßen — Rekord-
//     sieger, Torfabrik, Dauerbrenner, Marathonmann, Unermüdlicher,
//     Allgegenwärtiger, Immerdabei, Malocher, Gründervater, Veteran,
//     längster Tag, Nachtschwärmer, Frühaufsteher — sind gestrichen. Wer
//     oft spielt, sammelt dadurch schon mehr Gelegenheiten; er musste dafür
//     nicht zusätzlich ausgezeichnet werden.
//
//     KEINE VERBINDUNGEN: Es gibt keine Einträge, die ein DUO beschreiben.
//     Wer sie hielt, hatte sie halb dem anderen zu verdanken, und dieselbe
//     Zeile stand am Ende bei zwei Leuten im Profil. Was ein Partner
//     auslöst, wird nur als EIGENE Leistung gemessen — „Der Katalysator"
//     zählt, wie viel besser die anderen neben ihm sind, und nennt dabei
//     keinen Namen.
//
//     JEDER EINTRAG IST EIN BESTWERT [§C32]. Er geht an den, der ihn in
//     diesem Monat wirklich hält — oder an niemanden. Früher durften die
//     meisten Einträge weiterrutschen, wenn der Beste schon etwas trug;
//     dann stand „Der Unaufhaltsame" bei zwölf Siegen in Folge, während
//     einer mit dreizehn danebensaß. Deshalb darf eine Bedingung jetzt
//     auch einen Superlativ nennen. Die Schwellen in den Bedingungen
//     („ab 10 Spielen") bleiben, aber als Zulassung, nicht als Vergabe:
//     sie sagen, wer überhaupt mitzählt.
//
//     DER MEISTER ist KEINE Disziplin. Er ging per Definition an Platz 1
//     der Saison-Elo und sagte damit nichts, was die Rangliste nicht schon
//     zeigt. Er kommt direkt aus seasonChampion() und steht als Krone neben
//     dem Namen. Die Tafel ist für das da, was man an der Tabelle NICHT
//     ablesen kann.
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

// ─── §13.1 Der Disziplinen-Katalog ───────────────────────────────────
// EIN Eintrag, ZWEI Wertungen. Vorher standen dieselben Gedanken zweimal
// im System: „Der Vollstrecker" maß den Anteil 10:0-Siege für einen Monat,
// „Der Henker" denselben Anteil für die Laufbahn. Achtzehnmal dasselbe
// Muster, zwei Namen, zwei Icons, zwei Schwellen — und im Profil zwei
// Zeilen, die dasselbe sagten.
//
// Eine Disziplin hat deshalb höchstens eine `monat`- und höchstens eine
// `allzeit`-Wertung. Beide messen DIESELBE Größe, nur auf verschiedenen
// Zeitachsen, und sie teilen sich Name, Icon und Ton. Wer eine Doppelung
// bauen will, muss dafür jetzt einen zweiten Eintrag anlegen — und sieht
// dabei, dass er es tut.
//
//   monat   → Saison-Tafel. pick(C, taken) liefert {pid, ev} oder null.
//             Ein Eintrag pro Spieler, Reihenfolge = Vergabe-Reihenfolge.
//   allzeit → Liga-Rekord. val(p, C) oder raw(p, C)+min liefert die Zahl,
//             den Bestwert halten alle, die ihn erreichen.
//
// `art` steuert, was ein Eintrag für das Prestige wert ist [§13.8]:
//   leistung — eine Quote, ein Können. Zählt doppelt.
//   ereignis — etwas ist passiert, oft einmalig. Zählt einfach.
//   schatten — die Kehrseite. Zählt nicht, verschwindet aber auch nicht.
// Es gibt keine `pensum`-Art mehr: Einträge, die nur die Spielzahl maßen
// (Rekordsieger, Torfabrik, Dauerbrenner, Marathonmann, Unermüdlicher,
// Allgegenwärtiger, Immerdabei, Malocher, Gründervater, Veteran, längster
// Tag, Nachtschwärmer, Frühaufsteher …) sind ersatzlos gestrichen. Wer
// oft spielt, sammelt dadurch schon mehr Gelegenheiten; er musste dafür
// nicht zusätzlich ausgezeichnet werden.
//
// REIHENFOLGE gilt für BEIDE Wertungen: Leistung vor Ereignis vor
// Schatten, innerhalb der Blöcke selten vor häufig. Sie entscheidet in
// der Monatstafel, wer zuerst zugreift, und im Profil, welche Zeile oben
// steht.
//
// Sie entscheidet NICHT mehr, wer zuerst zugreift: das tut der Vorsprung
// [§C32]. Wer mehrere Bestwerte hält, trägt den, bei dem er am
// deutlichsten vorn liegt.
//
// Ein Monat mit weniger als CHRONIK_MIN_TAGE Spieltagen bekommt gar keine
// Chronik: aus drei Abenden lässt sich kein Monat ablesen, und eine
// Siegquote aus zwölf Spielen ist ein Zufall, kein Maßstab.
const CHRONIK_MIN_TAGE = 5;

const DISZIPLINEN = [

  // ══ LEISTUNG ══════════════════════════════════════════════════════
  // Quoten und Können. Wer nur an zwei Abenden im Monat spielt, kann
  // jeden dieser Einträge genauso holen wie der Vielspieler.

  {id:'best_record', name:'Der Maßstab', short:'Maßstab', ic:'medal2', tone:'gold', art:'leistung',
    monat:{
      cond:'Beste Bilanz des Monats — höchste Siegquote ab 10 Spielen',
      // Zehn reichen: einen dünnen Monat fängt die Spieltag-Grenze ab
      // (CHRONIK_MIN_TAGE), nicht diese Schwelle. Sie sagt nur, ab wann
      // eine Quote überhaupt eine Quote ist.
      pick:(C,t)=>_stPickTop(C,t,p=>p.games>=10?p.wins/p.games:null,
        (p,v)=>`${p.wins}–${p.losses} · ${Math.round(v*100)} % aus ${p.games} Spielen`)},
    allzeit:{
      cond:'Höchste Siegquote, die je jemand in einem Monat gespielt hat, ab 15 Spielen',
      val:p => (p.bestMonth && p.bestMonth.q >= 0.60) ? p.bestMonth.q : null,
      ev:(p,v) => `${Math.round(v*100)} % aus ${p.bestMonth.g} Spielen`,
      zeit:p => p.bestMonth ? seasonLabel(p.bestMonth.sid) : ''}},

  {id:'daylord', name:'Der Platzhirsch', short:'Revier', ic:'trophyDay', tone:'gold', art:'leistung',
    monat:{
      cond:'An mindestens 30 % der eigenen Spieltage Player of the Day, ab 5 Spieltagen',
      pick:(C,t)=>_stPickTop(C,t,p=>(p.days>=5 && p.potd/p.days>=0.30)?p.potd/p.days:null,
        (p,v)=>`Player of the Day an ${p.potd} seiner ${p.days} Spieltage · ${Math.round(v*100)} %`)},
    allzeit:{
      cond:'Höchster Anteil eigener Spieltage als Player of the Day, ab 12 Spieltagen und mindestens 25 %',
      val:p => (p.days >= 12 && p.potd/p.days >= 0.25) ? p.potd/p.days : null,
      ev:(p,v) => `${p.potd} von ${p.days} eigenen Spieltagen beherrscht · ${Math.round(v*100)} %`}},

  {id:'weekking', name:'Der Wochenkönig', short:'Woche', ic:'weekKing', tone:'gold', art:'leistung',
    // Kein Monats-Pendant: ein Monat hat vier Wochen, daraus lässt sich
    // keine Quote bauen, die etwas aussagt.
    allzeit:{
      cond:'Höchster Anteil eigener Spielwochen als Player of the Week, ab 8 Wochen und mindestens 20 %',
      val:p => (p.weeks >= 8 && p.potw/p.weeks >= 0.20) ? p.potw/p.weeks : null,
      ev:(p,v) => `${p.potw} von ${p.weeks} Wochen, in denen er gespielt hat · ${Math.round(v*100)} %`}},

  {id:'reliable', name:'Der Verlässliche', short:'Konstanz', ic:'shieldCheck', tone:'gold', art:'leistung',
    monat:{
      cond:'Mindestens 65 % der eigenen Spieltage mit positiver Bilanz beendet, ab 6 Spieltagen',
      pick:(C,t)=>_stPickTop(C,t,p=>(p.days>=6 && p.posDays/p.days>=0.65)?p.posDays/p.days:null,
        (p,v)=>`${p.posDays} seiner ${p.days} Spieltage mit mehr Siegen als Pleiten · ${Math.round(v*100)} %`)},
    allzeit:{
      cond:'Höchster Anteil eigener Spielwochen mit positiver Bilanz, ab 8 Wochen und mindestens 70 %',
      val:p => (p.weeks >= 8 && p.posWeeks/p.weeks >= 0.70) ? p.posWeeks/p.weeks : null,
      ev:(p,v) => `${p.posWeeks} von ${p.weeks} Wochen mit mehr Siegen als Pleiten · ${Math.round(v*100)} %`}},

  {id:'twoway', name:'Der Doppelbegabte', short:'Beidseitig', ic:'diamond', tone:'gold', art:'leistung',
    monat:{
      cond:'Mindestens 60 % Siege vorne UND hinten, je 12 Spiele',
      pick:(C,t)=>_stPickTop(C,t,p=>{
        if(p.atkG<12 || p.defG<12) return null;
        const lo=Math.min(p.atkW/p.atkG, p.defW/p.defG);
        return lo>=0.60?lo:null;
      }, (p)=>`${Math.round(p.atkW/p.atkG*100)} % vorne, ${Math.round(p.defW/p.defG*100)} % hinten`)},
    allzeit:{
      cond:'Auf beiden Positionen stark — höchste schwächere der beiden Siegquoten, ab 25 Spielen je Position',
      val:p => {
        if(p.atkG < 25 || p.defG < 25) return null;
        const lo = Math.min(p.atkW/p.atkG, p.defW/p.defG);
        return lo >= 0.55 ? lo : null;
      },
      ev:p => `${Math.round(p.atkW/p.atkG*100)} % vorne, ${Math.round(p.defW/p.defG*100)} % hinten — beides über dem Schnitt`}},

  {id:'spotless', name:'Der makellose Tag', short:'Makellos', ic:'trophyDay', tone:'gold', art:'leistung',
    monat:{
      cond:'Ein voller Spieltag (4+ Partien) ganz ohne Niederlage, bei mindestens 5 solchen Tagen',
      pick:(C,t)=>_stPickTop(C,t,p=>(p.bigDays>=5 && p.perfDays>=1)?p.perfDays/p.bigDays:null,
        (p)=>p.perfDays===1 ? `Ein voller Spieltag ohne eine einzige Niederlage · 1 von ${p.bigDays}`
                            : `${p.perfDays} von ${p.bigDays} vollen Spieltagen ohne Niederlage`)},
    allzeit:{
      cond:'Höchster Anteil voller Spieltage (4+ Partien) ohne eine einzige Niederlage, ab 8 solchen Tagen',
      val:p => (p.bigDays >= 8 && p.perfDays >= 1) ? p.perfDays/p.bigDays : null,
      ev:p => `${p.perfDays} von ${p.bigDays} vollen Spieltagen ohne eine einzige Niederlage`}},

  {id:'catalyst', name:'Der Katalysator', short:'Katalyse', ic:'handshake', tone:'gold', art:'leistung',
    monat:{
      cond:'Partner gewinnen an seiner Seite mindestens 14 Prozentpunkte häufiger als ohne ihn',
      pick:(C,t)=>_stPickTop(C,t,p=>(p.upliftMates>=2 && p.uplift!=null && p.uplift>=0.14)?p.uplift:null,
        (p,v)=>`Seine ${p.upliftMates} Partner gewinnen neben ihm ${Math.round(v*100)} Punkte häufiger`)},
    allzeit:{
      cond:'Seine Partner gewinnen an seiner Seite am deutlichsten häufiger als ohne ihn — mindestens 3 Partner, je 25 gemeinsame Spiele',
      val:p => (p.upliftMates >= 3 && p.uplift != null && p.uplift >= 0.10) ? p.uplift : null,
      ev:(p,v) => `Seine ${p.upliftMates} Partner gewinnen neben ihm ${Math.round(v*100)} Punkte häufiger als ohne ihn`}},

  {id:'clutch', name:'Die ruhige Hand', short:'Nerven', ic:'nerves', tone:'gold', art:'leistung',
    monat:{
      cond:'In engen Spielen deutlich stärker als sonst — mindestens 10 Prozentpunkte, ab 12 engen Spielen',
      pick:(C,t)=>_stPickTop(C,t,p=>{
        if(p.close < 12) return null;
        const d = (p.closeW/p.close) - (p.wins/p.games);
        return d >= 0.10 ? d : null;
      }, (p,v)=>`${Math.round(p.closeW/p.close*100)} % in ${p.close} engen Spielen · +${Math.round(v*100)} Punkte`)},
    allzeit:{
      cond:'Stärkster Sprung nach oben in engen Spielen, mindestens 9 Prozentpunkte',
      val:p => {
        if(p.close < 14 || p.close < p.games * 0.2) return null;
        const d = (p.closeW/p.close) - (p.wins/p.games);
        return d >= 0.09 ? d : null;
      },
      ev:(p,v) => `${Math.round(p.closeW/p.close*100)} % in engen Spielen · +${Math.round(v*100)} Punkte`}},

  {id:'executioner', name:'Der Vollstrecker', short:'Zu Null', ic:'hundred', tone:'gold', art:'leistung',
    monat:{
      cond:'Mindestens 4 % der eigenen Siege endeten 10:0, ab 20 Siegen',
      pick:(C,t)=>_stPickTop(C,t,p=>(p.wins>=20 && p.perfect/p.wins>=0.04)?p.perfect/p.wins:null,
        (p,v)=>`${p.perfect} seiner ${p.wins} Siege endeten 10:0 · ${Math.round(v*100)} %`)},
    allzeit:{
      cond:'Höchster Anteil 10:0-Siege an allen eigenen Siegen, ab 25 Siegen',
      val:p => (p.wins >= 25 && p.perfect/p.wins >= 0.03) ? p.perfect/p.wins : null,
      ev:(p,v) => `${p.perfect} seiner ${p.wins} Siege endeten 10:0 · ${Math.round(v*100)} %`}},

  {id:'giant_slayer', name:'Der Gigantentöter', short:'Underdog', ic:'tornado', tone:'acid', art:'leistung',
    monat:{
      cond:'Mindestens jedes zehnte Spiel mit unter 35 % Siegchance gewonnen, ab 20 Spielen',
      pick:(C,t)=>_stPickTop(C,t,p=>(p.games>=20 && p.upsets/p.games>=0.10)?p.upsets/p.games:null,
        (p,v)=>`${p.upsets} von ${p.games} Spielen gegen die Wahrscheinlichkeit gewonnen`)},
    allzeit:{
      cond:'Höchster Anteil Siege mit unter 35 % Siegchance, ab 60 Spielen',
      val:p => (p.games >= 60 && p.upsets/p.games >= 0.04) ? p.upsets/p.games : null,
      ev:(p,v) => `${p.upsets} von ${p.games} Spielen gegen die Wahrscheinlichkeit gewonnen`}},

  {id:'destroyer', name:'Der Zerstörer', short:'Zerstörer', ic:'explosion', tone:'orange', art:'leistung',
    monat:{
      cond:'Mindestens ein Viertel der eigenen Siege mit 7+ Toren Vorsprung, ab 20 Siegen',
      pick:(C,t)=>_stPickTop(C,t,p=>(p.wins>=20 && p.blowouts/p.wins>=0.25)?p.blowouts/p.wins:null,
        (p,v)=>`${p.blowouts} seiner ${p.wins} Siege mit 7+ Toren Vorsprung`)},
    allzeit:{
      cond:'Höchster Anteil Kantersiege, ab 22 Siegen und mindestens 22 %',
      val:p => (p.wins >= 22 && p.blowW/p.wins >= 0.22) ? p.blowW/p.wins : null,
      ev:p => `${p.blowW} seiner ${p.wins} Siege waren Kantersiege`}},

  // Die beiden Positionen als GANZES, nicht als Einzelmaß. „Der Fels" zählt
  // nur Gegentore, „Der Torjäger" nur eigene — beides sagt nichts darüber,
  // ob jemand seine Spiele auch gewinnt. Gewertet wird deshalb genau der
  // Wert, nach dem die Positions-Rangliste sortiert (posWert, [§5.2]):
  // Siegquote, Leistung gegen die Erwartung, Rollenbeitrag, Erfahrung.
  // Damit gehört der Erste dieser Liste sichtbar etwas — die Positions-
  // Rangliste war die einzige Rangliste der App, auf der es nichts zu holen
  // gab.
  //
  // Nur allzeit: der Wert wiegt Erfahrung mit ein, und ein Monat hat davon
  // zu wenig. Über vier Wochen entschiede die Spielzahl statt der Leistung.
  {id:'atk_ace', name:'Der komplette Stürmer', short:'Sturm', ic:'bolt', tone:'orange', art:'leistung',
    allzeit:{
      cond:'Höchster Sturmwert der Positions-Rangliste — Siegquote, Leistung gegen die Erwartung und Ø Tore, ab 50 Sturmspielen',
      val:p => (p.atkG >= 50)
        ? posWert('atk', p.atkG, p.atkW, p.atkGoals/p.atkG, p.atkPerf/p.atkG) : null,
      ev:(p,v) => `Wert ${Math.round(v*100)} · ${p.atkW}–${p.atkG-p.atkW} in ${p.atkG} Sturmspielen`}},

  {id:'def_ace', name:'Der komplette Verteidiger', short:'Abwehr', ic:'shield', tone:'blue', art:'leistung',
    allzeit:{
      cond:'Höchster Abwehrwert der Positions-Rangliste — Siegquote, Leistung gegen die Erwartung und Ø Gegentore, ab 50 Abwehrspielen',
      val:p => (p.defG >= 50)
        ? posWert('def', p.defG, p.defW, p.defConceded/p.defG, p.defPerf/p.defG) : null,
      ev:(p,v) => `Wert ${Math.round(v*100)} · ${p.defW}–${p.defG-p.defW} in ${p.defG} Abwehrspielen`}},

  {id:'rock', name:'Der Fels', short:'Fels', ic:'brick', tone:'blue', art:'leistung',
    monat:{
      cond:'Höchstens 6,0 Gegentore pro Spiel als Verteidiger, ab 25 Abwehrspielen',
      pick:(C,t)=>_stPickTop(C,t,p=>(p.defG>=25 && p.defConceded/p.defG<=6.0)?-(p.defConceded/p.defG):null,
        (p,v)=>`Ø ${(-v).toFixed(1)} Gegentore in ${p.defG} Abwehrspielen`)},
    allzeit:{
      cond:'Wenigste Gegentore pro Spiel in der Abwehr, ab 50 Abwehrspielen',
      val:p => (p.defG >= 50) ? -(p.defConceded/p.defG) : null,
      ev:(p,v) => `Ø ${(-v).toFixed(1)} Gegentore in ${p.defG} Abwehrspielen`}},

  {id:'sniper', name:'Der Torjäger', short:'Torjäger', ic:'ball', tone:'orange', art:'leistung',
    monat:{
      cond:'Mindestens 8,8 eigene Tore pro Spiel als Stürmer, ab 25 Sturmspielen',
      pick:(C,t)=>_stPickTop(C,t,p=>(p.atkG>=25 && p.atkGoals/p.atkG>=8.8)?p.atkGoals/p.atkG:null,
        (p,v)=>`Ø ${v.toFixed(1)} Tore in ${p.atkG} Sturmspielen`)},
    allzeit:{
      cond:'Meiste eigene Tore pro Spiel im Sturm, ab 50 Sturmspielen',
      val:p => (p.atkG >= 50) ? p.atkGoals/p.atkG : null,
      ev:(p,v) => `Ø ${v.toFixed(1)} Tore in ${p.atkG} Sturmspielen`}},

  {id:'climber', name:'Der Aufsteiger', short:'Aufsteiger', ic:'climb', tone:'acid', art:'leistung',
    monat:{
      cond:'Mindestens 120 Elo mehr als am Ende der Vorsaison',
      pick:(C,t)=>_stPickTop(C,t,p=>(p.growth!=null && p.growth>=120)?p.growth:null,
        (p,v)=>`+${Math.round(v)} Elo gegenüber der Vorsaison`)},
    allzeit:{
      cond:'Größter Elo-Sprung von einer Saison zur nächsten, mindestens +150',
      val:p => (p.rise && p.rise.d >= 150) ? p.rise.d : null,
      ev:p => `+${Math.round(p.rise.d)} Elo von ${p.rise.from} auf ${p.rise.to}`}},

  {id:'comeback_king', name:'Der Stehaufmann', short:'Comeback', ic:'comeback', tone:'acid', art:'leistung',
    monat:{
      cond:'Mindestens 55 % der Spiele direkt nach einer Niederlage gewonnen, ab 20 Gelegenheiten',
      pick:(C,t)=>_stPickTop(C,t,p=>(p.afterLossOpp>=20 && p.afterLoss/p.afterLossOpp>=0.55)?p.afterLoss/p.afterLossOpp:null,
        (p,v)=>`${p.afterLoss} von ${p.afterLossOpp} Antworten nach einer Pleite gewonnen`)},
    allzeit:{
      cond:'Stärkster Sprung nach oben direkt nach einer Niederlage, ab 60 Gelegenheiten und mindestens 6 Prozentpunkte',
      val:p => {
        if(p.afterLossOpp < 60) return null;
        const d = p.afterLoss/p.afterLossOpp - p.wins/p.games;
        return d >= 0.06 ? d : null;
      },
      ev:(p,v) => `${Math.round(p.afterLoss/p.afterLossOpp*100)} % direkt nach einer Pleite · +${Math.round(v*100)} Punkte`}},

  {id:'thriller', name:'Der Nervenkitzler', short:'Krimi', ic:'thriller', tone:'purple', art:'leistung',
    monat:{
      cond:'Mindestens 15 % der eigenen Siege endeten 10:9, ab 20 Siegen',
      pick:(C,t)=>_stPickTop(C,t,p=>(p.wins>=20 && p.nail/p.wins>=0.15)?p.nail/p.wins:null,
        (p,v)=>`${p.nail} seiner ${p.wins} Siege endeten 10:9 · ${Math.round(v*100)} %`)},
    allzeit:{
      cond:'Höchster Anteil 10:9-Siege an allen eigenen Siegen, ab 25 Siegen',
      val:p => (p.wins >= 25 && p.nail/p.wins >= 0.08) ? p.nail/p.wins : null,
      ev:(p,v) => `${p.nail} seiner ${p.wins} Siege endeten 10:9 · ${Math.round(v*100)} %`}},

  {id:'damage_control', name:'Der Schadensbegrenzer', short:'Limit', ic:'blockedShot', tone:'blue', art:'leistung',
    monat:{
      cond:'Höchstens jede zehnte Niederlage mit 7+ Toren Rückstand, ab 12 Niederlagen',
      pick:(C,t)=>_stPickTop(C,t,p=>(p.losses>=12 && p.blowL/p.losses<=0.10)?-(p.blowL/p.losses):null,
        (p)=>p.blowL===0 ? `Keine einzige seiner ${p.losses} Niederlagen war ein Debakel`
                         : `Nur ${p.blowL} seiner ${p.losses} Niederlagen gingen deutlich verloren`)},
    allzeit:{
      cond:'Niedrigster Anteil deutlicher Niederlagen (7+ Tore Rückstand), ab 25 Niederlagen',
      val:p => (p.losses >= 25 && p.blowL/p.losses <= 0.12) ? -(p.blowL/p.losses) : null,
      ev:p => `Nur ${p.blowL} seiner ${p.losses} Niederlagen gingen deutlich verloren · ${Math.round(p.blowL/p.losses*100)} %`}},

  {id:'unbowed', name:'Der Unerschütterliche', short:'Kein Loch', ic:'concreteWall', tone:'blue', art:'leistung',
    monat:{
      cond:'Nie mehr als 2 Niederlagen am Stück, bei mindestens 25 Spielen',
      pick:(C,t)=>_stPickTop(C,t,p=>(p.games>=25 && p.worstLoss<=2)?-p.worstLoss:null,
        (p)=>p.worstLoss<=1 ? `Nie zwei Niederlagen hintereinander · ${p.wins}–${p.losses}`
                            : `Nie mehr als 2 Niederlagen am Stück · ${p.wins}–${p.losses}`)},
    allzeit:{
      cond:'Kürzeste Niederlagenserie, die je jemand über seine ganze Laufbahn zugelassen hat, ab 80 Spielen',
      val:p => (p.games >= 80 && p.lossStreak > 0) ? -p.lossStreak : null,
      ev:(p,v) => `Nie mehr als ${-v} Niederlagen am Stück in ${p.games} Spielen`}},

  // Die Außenseiter-Quote misst NICHT, wie oft jemand Außenseiter ist —
  // das sagt nur, wie schwach er ist. Gemessen wird der Abstand zwischen
  // dem, was er in diesen Partien geholt hat, und dem, was die Quoten ihm
  // zugestanden haben. Ein starker Spieler ist selten Außenseiter, dann
  // aber mit 45 % Chance; ein schwacher ständig und mit 25 %. Beide können
  // die Erwartung um dieselben zehn Punkte übertreffen — und genau darum
  // ist dieser Eintrag für jeden erreichbar.
  {id:'longshot', name:'Der Außenseiter', short:'Trotz', ic:'underdog', tone:'purple', art:'leistung',
    monat:{
      cond:'Als Außenseiter mehr geholt, als die Quoten hergaben — mindestens 10 Prozentpunkte über der Erwartung, ab 10 solchen Partien',
      pick:(C,t)=>_stPickTop(C,t,p=>{
        if(p.favG < 10) return null;
        const d = (p.favW/p.favG) - (p.favExp/p.favG);
        return d >= 0.10 ? d : null;
      }, (p,v)=>`${p.favW} von ${p.favG} als Außenseiter · +${Math.round(v*100)} über der Erwartung`)},
    allzeit:{
      cond:'Größter Abstand zur eigenen Siegerwartung in Partien als Außenseiter, ab 30 solchen Partien',
      val:p => {
        if(p.favG < 30) return null;
        const d = (p.favW/p.favG) - (p.favExp/p.favG);
        return d >= 0.06 ? d : null;
      },
      ev:(p,v) => `${p.favW} von ${p.favG} als Außenseiter · +${Math.round(v*100)} über der Erwartung`}},

  // Nicht „wie oft gewinnt er", sondern „wie selten wird er auseinander-
  // genommen". Wer wenig spielt und selten gewinnt, kann trotzdem der
  // sein, den nie jemand vorführt — und dafür gibt es hier einen Eintrag.
  // Nur allzeit: eine Serie über eine ganze Laufbahn ist die Aussage, ein
  // Monatsausschnitt davon wäre nur ein Zufallsfenster.
  {id:'unbroken', name:'Der Zähe', short:'Zäh', ic:'brick', tone:'blue', art:'leistung',
    allzeit:{
      cond:'Längste Serie ohne eine deutliche Niederlage (7+ Tore Rückstand), ab 25 Spielen',
      unit:'Spiele ohne Debakel', min:25, raw:p => p.noBlow,
      ev:(p,v) => `${v} Partien am Stück ohne deutliche Niederlage`,
      zeit:p => p.noBlowSpan || ''}},

  // ══ EREIGNIS ══════════════════════════════════════════════════════
  // Etwas ist passiert. Oft einmalig, oft ein Bestwert — aber kein
  // Beleg für eine Fähigkeit, die man jeden Monat wieder abrufen kann.

  {id:'unstoppable', name:'Der Unaufhaltsame', short:'Serie', ic:'flame', tone:'orange', art:'ereignis',
    monat:{
      cond:'Längste Siegesserie des Monats, mindestens 8 Spiele am Stück',
      pick:(C,t)=>_stPickTop(C,t,p=>p.bestStreak>=8?p.bestStreak:null,
        (p,v)=>`${v} Siege in Folge${p.streakSpan?' · '+p.streakSpan:''}`)},
    allzeit:{
      cond:'Längste Siegesserie der Liga-Geschichte',
      unit:'Siege in Folge', min:8, raw:p => p.winStreak,
      ev:(p,v) => `${v} Siege in Folge`,
      zeit:p => p.winSpan || ''}},

  // Ein Abend, an dem alles saß. Braucht weder eine Laufbahn noch eine
  // Quote — nur einen guten Tag, und den kann jeder haben. Deshalb steht
  // er unter EREIGNIS und nicht unter LEISTUNG.
  {id:'flawless_night', name:'Der perfekte Abend', short:'Abend', ic:'godRay', tone:'gold', art:'ereignis',
    allzeit:{
      cond:'Meiste Partien an einem einzigen Spieltag, ohne eine einzige Niederlage',
      unit:'Partien ohne Pleite', min:4, raw:p => p.cleanDay,
      ev:(p,v) => `${v} Partien an einem Abend, keine verloren`,
      zeit:p => p.cleanDayLabel || ''}},

  {id:'peak', name:'Der höchste Gipfel', short:'Gipfel', ic:'peak', tone:'gold', art:'ereignis',
    allzeit:{
      cond:'Höchster Elo-Stand, den je ein Spieler erreicht hat',
      unit:'Elo', min:350, raw:p => p.peak,
      ev:(p,v) => `${Math.round(v)} Elo — nie stand jemand höher`}},

  {id:'eloday', name:'Der große Sprung', short:'Sprung', ic:'bolt2', tone:'acid', art:'ereignis',
    allzeit:{
      cond:'Größter Elo-Gewinn an einem einzigen Tag',
      unit:'Elo an einem Tag', min:100, raw:p => p.dayElo == null ? null : Math.round(p.dayElo),
      ev:(p,v) => `+${v} Elo an einem Tag`,
      zeit:p => p.dayEloLabel || ''}},

  {id:'kingslayer', name:'Der Königsmörder', short:'Königsjagd', ic:'kingFall', tone:'gold', art:'ereignis',
    // Nur Monat: „der Erste" ist eine Momentaufnahme der laufenden Saison.
    // Über die ganze Laufbahn gerechnet wäre der Gegner ein anderer.
    monat:{
      cond:'Über 55 % Siege gegen den Monats-Ersten, bei mindestens 15 Duellen',
      pick:(C,t)=>_stPickTop(C,t,p=>(p.vsTopGames>=15 && p.vsTop/p.vsTopGames>0.55)?p.vsTop/p.vsTopGames:null,
        (p,v)=>`${p.vsTop} von ${p.vsTopGames} Duellen gegen den Ersten gewonnen`)}},

  {id:'wall', name:'Die Mauer', short:'Mauer', ic:'shieldStar', tone:'blue', art:'ereignis',
    monat:{
      cond:'Mindestens 65 % Abwehr, 20 Spiele und positive Tordifferenz',
      pick:(C,t)=>_stPickTop(C,t,p=>(p.games>=20 && p.gd>0 && p.defG/p.games>=0.65)?p.defG/p.games:null,
        (p,v)=>`${p.defG} von ${p.games} Spielen hinten · ${p.gd>0?'+':''}${p.gd} Tordifferenz`)},
    allzeit:{
      cond:'Höchster Abwehr-Anteil, ab 60 Spielen und mindestens 80 %',
      val:p => (p.games >= 60 && p.defG/p.games >= 0.80) ? p.defG/p.games : null,
      ev:p => `${p.defG} von ${p.games} Spielen hinten`}},

  {id:'switcher', name:'Der Wandler', short:'Wandler', ic:'refresh', tone:'purple', art:'ereignis',
    monat:{
      cond:'45–55 % auf beiden Positionen, mindestens 30 Spiele und positive Bilanz',
      pick:(C,t)=>_stPickTop(C,t,p=>{
        if(p.games<30 || p.wins<=p.losses) return null;
        const share=p.defG/p.games;
        if(share<0.45 || share>0.55) return null;
        return -Math.abs(share-0.5); // je ausgeglichener, desto besser
      }, (p)=>`${p.atkG} vorne, ${p.defG} hinten · ${p.wins}–${p.losses}`)},
    allzeit:{
      cond:'Ausgeglichenste Verteilung auf beide Positionen, ab 60 Spielen',
      val:p => {
        if(p.games < 60) return null;
        const s = p.defG/p.games;
        return (s >= 0.43 && s <= 0.57) ? -Math.abs(s-0.5) : null;
      },
      ev:p => `${p.atkG} vorne, ${p.defG} hinten — beides sein Zuhause`}},

  // ── GLÜCK ─────────────────────────────────────────────
  // Drei Einträge, die kein Können messen. Ohne sie liegen am Ende alle
  // Rekorde bei denselben drei Spielern: wer besser spielt, gewinnt jede
  // Quote und jede Serie. Eine Münze gewinnt er nicht.
  //
  // Sie sind absichtlich `ereignis` und nicht `leistung` — sie sollen
  // jemandem gehören können, nicht jemanden auszeichnen, und fürs Prestige
  // halb so viel wiegen wie ein Beleg für eine Fähigkeit [§13.8]. Und sie
  // sind absichtlich nicht billig: eine Bestmarke, die jeder geschenkt
  // bekommt, ist keine mehr.

  {id:'sundaychild', name:'Das Sonntagskind', short:'Glück', ic:'clover', tone:'acid', art:'ereignis',
    monat:{
      cond:'Höchster Anteil gewonnener Ein-Tor-Spiele (10:9 oder 9:10), ab 6 solchen Partien',
      pick:(C,t)=>_stPickTop(C,t,p=>{
        const n = p.nail + p.bitter;
        return n >= 6 ? p.nail / n : null;
      }, (p,v)=>`${p.nail} von ${p.nail+p.bitter} Spielen um den letzten Ball · ${Math.round(v*100)} %`)},
    allzeit:{
      // Der letzte Ball eines 10:9 ist das Nächste, was diese Liga an einem
      // Münzwurf zu bieten hat. Wer ihn häufiger auf seiner Seite hatte, hat
      // nichts bewiesen — aber er hatte ihn.
      cond:'Höchster Anteil gewonnener Ein-Tor-Spiele der Laufbahn, ab 12 solchen Partien',
      val:p => (p.nail + p.bitter) >= 12 ? p.nail / (p.nail + p.bitter) : null,
      ev:(p,v) => `${p.nail} von ${p.nail+p.bitter} Spielen um den letzten Ball · ${Math.round(v*100)} %`}},

  {id:'seesaw', name:'Das Wechselbad', short:'Wechsel', ic:'cycle', tone:'purple', art:'ereignis',
    monat:{
      cond:'Längste Serie aus abwechselnd Sieg und Niederlage, mindestens 6 Partien',
      pick:(C,t)=>_stPickTop(C,t,p=>p.alt>=6?p.alt:null,
        (p,v)=>`${v} Partien lang immer abwechselnd${p.altSpan?' · '+p.altSpan:''}`)},
    allzeit:{
      cond:'Längste Serie aus abwechselnd Sieg und Niederlage der Liga-Geschichte',
      unit:'Partien im Wechsel', min:7, raw:p => p.alt,
      ev:(p,v) => `${v} Partien lang immer abwechselnd`,
      zeit:p => p.altSpan || ''}},

  {id:'fluke', name:'Der Sonntagsschuss', short:'Coup', ic:'surprise', tone:'orange', art:'ereignis',
    monat:{
      cond:'Der unwahrscheinlichste Sieg des Monats — höchstens 35 % Siegchance',
      pick:(C,t)=>_stPickTop(C,t,p=>(p.flukeExp!=null && p.flukeExp<=0.35)?1-p.flukeExp:null,
        (p,v)=>`Sieg mit ${Math.round((1-v)*100)} % Siegchance${p.flukeLabel?' · '+p.flukeLabel:''}`)},
    allzeit:{
      // Eine einzige Partie genügt, und die Rechnung stand gegen ihn. Der
      // schwächste Spieler der Liga hat die meisten Gelegenheiten dazu —
      // das ist hier kein Fehler, sondern der Zweck.
      cond:'Der unwahrscheinlichste Sieg, den je jemand geholt hat — höchstens 30 % Siegchance',
      val:p => (p.flukeExp != null && p.flukeExp <= 0.30) ? 1 - p.flukeExp : null,
      ev:(p,v) => `Sieg mit ${Math.round((1-v)*100)} % Siegchance`,
      zeit:p => p.flukeLabel || ''}},

  // ══ SCHATTEN ══════════════════════════════════════════════════════
  // Die Kehrseite. Sie steht in der Tafel und im Profil, aber sie zählt
  // fürs Prestige nicht — weder positiv noch negativ [§13.8].

  {id:'drought', name:'Die Durststrecke', short:'Flaute', ic:'dropTriple', tone:'red', art:'schatten',
    monat:{
      cond:'Längste Niederlagenserie des Monats, mindestens 6 Spiele am Stück',
      pick:(C,t)=>_stPickTop(C,t,p=>p.worstLoss>=6?p.worstLoss:null,
        (p,v)=>`${v} Niederlagen in Folge${p.lossSpan?' · '+p.lossSpan:''}`)},
    allzeit:{
      cond:'Längste Niederlagenserie der Liga-Geschichte',
      min:7, raw:p => p.lossStreak,   // kein `unit`: Schatten sind kein Fortschrittsziel
      ev:(p,v) => `${v} Niederlagen am Stück`,
      zeit:p => p.lossSpan || ''}},

  {id:'abyss', name:'Das Fass ohne Boden', short:'Debakel', ic:'dizzy', tone:'red', art:'schatten',
    monat:{
      cond:'Mindestens 5 % der eigenen Niederlagen endeten 0:10, ab 20 Niederlagen',
      pick:(C,t)=>_stPickTop(C,t,p=>(p.losses>=20 && p.debacle/p.losses>=0.05)?p.debacle/p.losses:null,
        (p,v)=>`${p.debacle} seiner ${p.losses} Niederlagen endeten 0:10`)},
    allzeit:{
      cond:'Höchster Anteil 0:10-Niederlagen an allen eigenen Niederlagen, ab 25 Niederlagen',
      val:p => (p.losses >= 25 && p.debacle/p.losses >= 0.03) ? p.debacle/p.losses : null,
      ev:(p,v) => `${p.debacle} seiner ${p.losses} Niederlagen endeten 0:10`}},

  {id:'hardluck', name:'Der Pechvogel', short:'Pechvogel', ic:'heartBroken', tone:'red', art:'schatten',
    monat:{
      cond:'Mindestens 12 % der eigenen Niederlagen endeten 9:10, ab 20 Niederlagen',
      pick:(C,t)=>_stPickTop(C,t,p=>(p.losses>=20 && p.bitter/p.losses>=0.12)?p.bitter/p.losses:null,
        (p,v)=>`${p.bitter} seiner ${p.losses} Niederlagen endeten 9:10 · ${Math.round(v*100)} %`)},
    allzeit:{
      cond:'Höchster Anteil 9:10-Niederlagen an allen eigenen Niederlagen, ab 25 Niederlagen',
      val:p => (p.losses >= 25 && p.bitter/p.losses >= 0.08) ? p.bitter/p.losses : null,
      ev:(p,v) => `${p.bitter} seiner ${p.losses} Niederlagen endeten 9:10 · ${Math.round(v*100)} %`}},

  {id:'freefall', name:'Der Sturzflug', short:'Sturzflug', ic:'crownFallen', tone:'red', art:'schatten',
    monat:{
      cond:'Mindestens 150 Elo unter dem eigenen Monats-Hoch geendet',
      pick:(C,t)=>_stPickTop(C,t,p=>{
        if(p.eloHigh == null) return null;
        const d = p.eloHigh - p.elo;
        return d >= 150 ? d : null;
      }, (p,v)=>`Vom Monats-Hoch bei ${Math.round(p.eloHigh)} Elo auf ${p.elo} zurück`)},
    allzeit:{
      cond:'Größter Elo-Absturz von einer Saison zur nächsten, mindestens −150',
      val:p => (p.fall && p.fall.d <= -150) ? -p.fall.d : null,
      ev:p => `${Math.round(p.fall.d)} Elo von ${p.fall.from} auf ${p.fall.to}`}},

  {id:'sieve', name:'Das Scheunentor', short:'Sieb', ic:'hole', tone:'red', art:'schatten',
    monat:{
      cond:'Mindestens 8,0 Gegentore pro Spiel als Verteidiger, ab 20 Abwehrspielen',
      pick:(C,t)=>_stPickTop(C,t,p=>(p.defG>=20 && p.defConceded/p.defG>=8.0)?p.defConceded/p.defG:null,
        (p,v)=>`Ø ${v.toFixed(1)} Gegentore in ${p.defG} Abwehrspielen`)},
    allzeit:{
      cond:'Meiste Gegentore pro Spiel in der Abwehr, ab 30 Abwehrspielen',
      val:p => (p.defG >= 30 && p.defConceded/p.defG >= 6.0) ? p.defConceded/p.defG : null,
      ev:(p,v) => `Ø ${v.toFixed(1)} Gegentore in ${p.defG} Abwehrspielen`}},
];

// Die beiden Wertungen als eigene Listen — die Engines darunter bleiben
// unverändert. Wer eine Disziplin ohne `monat` anlegt, taucht in der
// Saison-Tafel nicht auf; wer keine `allzeit` hat, hat keinen Rekord.
const SEASON_TITLES = DISZIPLINEN.filter(d => d.monat).map(d => ({
  id:d.id, name:d.name, short:d.short, ic:d.ic, tone:d.tone, art:d.art,
  cond:d.monat.cond, pick:d.monat.pick
}));
const SEASON_TITLE_BY_ID = {};
SEASON_TITLES.forEach(t => { SEASON_TITLE_BY_ID[t.id] = t; });

// ─── [§C32] Ein Eintrag gehört dem, der ihn hält ─────────────────────
// score(p, pid) liefert eine Zahl (größer = besser) oder null, wenn die
// Bedingung nicht erfüllt ist. Ermittelt wird der Bestwert über ALLE
// gewerteten Spieler — unabhängig davon, wer schon einen Eintrag trägt.
//
// Früher durften die meisten Einträge weiterrutschen: wer den Bestwert hielt
// und schon etwas anderes trug, gab den Eintrag an den Nächstbesten ab.
// Damit stand „Der Unaufhaltsame" bei jemandem mit zwölf Siegen in Folge,
// während einer mit dreizehn danebensaß — und in der Praxis ging ein Drittel
// aller Einträge an jemanden, der nicht der Beste war. Das macht die Tafel
// nicht abwechslungsreicher, sondern unwahr.
//
// Zurückgegeben wird deshalb die ganze Lage, nicht nur ein Name:
//   halter     alle, die den Bestwert punktgleich halten
//   evVon(id)  der Beleg für einen dieser Halter
// Alle Halter bekommen den Eintrag — dass ein Spieler in der Matrix nur
// einen zeigt, ist eine reine Anzeige-Regel (seasonTitleOf).
//
// `pid`/`ev` bleiben der beste noch FREIE Spieler — das braucht das
// Titelrennen für den Verfolger, und sonst niemand.
function _stPickTop(C, taken, score, ev){
  let bv = -Infinity;
  const werte = {};
  Object.keys(C.P).forEach(pid => {
    const v = score(C.P[pid], pid);
    if(v == null || !isFinite(v)) return;
    werte[pid] = v;
    if(v > bv) bv = v;
  });
  const ids = Object.keys(werte);
  if(!ids.length) return null;
  // Gleichstand bricht: mehr Siege → bessere Tordifferenz → Spieler-ID.
  // Damit ist die Vergabe deterministisch — dieselbe Saison ergibt immer
  // dieselbe Tafel, unabhängig von Objekt-Reihenfolgen.
  const ordnung = (a, b) => C.P[b].wins - C.P[a].wins || C.P[b].gd - C.P[a].gd || (a < b ? -1 : 1);
  const halter = ids.filter(id => Math.abs(werte[id] - bv) <= 1e-9).sort(ordnung);
  const frei = ids.filter(id => !taken.has(id))
    .sort((a, b) => werte[b] - werte[a] || ordnung(a, b))[0];
  return {pid: frei || null, ev: frei ? ev(C.P[frei], werte[frei], C) : null,
          halter, evVon: id => ev(C.P[id], bv, C)};
}

