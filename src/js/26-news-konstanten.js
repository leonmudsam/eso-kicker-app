// ╔═══════════════════════════════════════════════════════════════════════╗
// ║  §11  LIGA NEWS / STORY-SYSTEM                                        ║
// ║  ───────────────────────────────────────────────────────────────────  ║
// ║  Erzeugt redaktionelle "Schlagzeilen" aus bestehenden Liga-Daten.     ║
// ║  KEINE neuen Berechnungen — nur Interpretation existierender Caches.  ║
// ║                                                                       ║
// ║   §11.1  Story-Generator (alle Typen)                                 ║
// ║   §11.2  Cache (versionsgebunden an matches.length + _cache.version)  ║
// ║   §11.3  LocalStorage (Read-State, Ring-Buffer max 200)               ║
// ║   §11.4  Header-Badge-Refresh                                         ║
// ║   §11.5  Mini-Popup (newsPopover)                                     ║
// ║   §11.6  Voller Feed mit Filter (newsFeedFull)                        ║
// ║   §11.7  Story-Detail (newsDetail) — dynamisch je Typ                 ║
// ╚═══════════════════════════════════════════════════════════════════════╝

// ─── §11.0 — Konstanten ──────────────────────────────────────────────
// News-Debug-Flag (v8.4): hält console-Logs des News-Systems aus der
// Produktiv-Konsole heraus. Standard: aus. Zur Laufzeit aktivierbar über
// DevTools — KEIN Reload nötig:  window.NEWS_DEBUG = true
// Alle News-Logs laufen über `if(NEWS_DEBUG || window.NEWS_DEBUG) console…`.
const NEWS_DEBUG = false;

// Kategorien (Filter-Pills + CSS-Klassen über `nv-cat-${cat}`).
// label = Anzeige im Filter; descLabel = im Detail- und Story-Header.
const NEWS_CATEGORIES = {
  // v9: „Breaking" ist KEIN eigener Generator-Typ, sondern eine ANZEIGE-Kategorie.
  // _isBreaking() promotet die ultra-seltenen, liga-relevanten Ereignisse
  // (neuer Spitzenreiter, Platz-1-Duell, legendäres Badge, Saison-Klimax)
  // display-seitig hierher — wirkt auf bestehende UND neue persistierte Rows.
  breaking:   {label:'Breaking',    descLabel:'Breaking News',    ic:'bolt'},
  highlight:  {label:'Highlights',  descLabel:'Highlight',        ic:'crown'},
  season:     {label:'Saison',      descLabel:'Saison',           ic:'rocket'},
  badge:      {label:'Awards',      descLabel:'Badge & Awards',   ic:'medalTrio'},
  fun:        {label:'Fun Facts',   descLabel:'Fun Fact',         ic:'thriller'},
  rivalry:    {label:'Rivalität',   descLabel:'Rivalität',        ic:'crossedSwords'},
  team:       {label:'Teams',       descLabel:'Team',             ic:'users'},
  comeback:   {label:'Comebacks',   descLabel:'Comeback',         ic:'comeback'},
  personal:   {label:'Persönlich',  descLabel:'Persönlich',       ic:'trendUp'},
  history:    {label:'Historie',    descLabel:'Historie',         ic:'calendar'},
  misfortune: {label:'Pechvogel',   descLabel:'Pechvogel',        ic:'dramaTear'},
};

// LocalStorage-Keys (versioniert für künftige Migrations)
const NEWS_LS_SEEN  = 'eso_news_seen_v1';
const NEWS_LS_TOAST = 'eso_news_toast_v1';  // v8.1: zeitstempel + count des letzten Toasts
const NEWS_LS_MAX_SEEN = 200; // Ring-Buffer-Limit
const NEWS_TOAST_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6h zwischen identischen Toast-Counts

// Generator-Limits — Schutz gegen zu viele Stories pro Typ
const NEWS_LIMITS = {
  // v9.4: bewusst kleiner → weniger News-Flut direkt nach Matches.
  topForm: 2,       // max Spieler "in Top-Form" gleichzeitig
  lossStreak: 2,
  jubilee: 3,
  badgeUnlocked: 6, // letzte N freigeschalteten Badges
  rivalry: 2,
  total: 50,        // harte Obergrenze des Feeds (nach Prio-Filter)
};

// Ambiente Fun-Fact-Stories (v8.5, v9.5) — Fun Facts / persönliche Nuggets,
// damit der Feed auch ohne neue Matches lebt.
//   RHYTHMUS (v9.7): TÄGLICH zwei Fun Facts — um 10:00 (Vormittag) und um
//                    19:00 (Feierabend). Früher (v9.6) nur abends einer.
//                    _isAmbientDay ist immer true → jeder Tag hat die Slots.
//   AMBIENT_SLOTS  = die Slot-Stunden; je Slot erscheint eine eigene Story,
//                    jeweils erst ab dieser Uhrzeit.
//   Anti-Spam:     IDs sind tages+stunden-deterministisch (`ambient_<datum>_<stunde>`)
//                  → ON CONFLICT DO NOTHING → keine Doppel über Geräte/Syncs.
//                  Die beiden Slots eines Tages zeigen nie denselben Typ.
//   Auswahl:       tages-seeded gezogen (Pseudo-Zufall, überall identisch) plus
//                  COOLDOWN: zuletzt (letzte AMBIENT_COOLDOWN_DAYS Tage)
//                  verwendete Fun-Fact-Typen werden gesperrt → Rotation statt
//                  vorhersehbarer Reihenfolge, keine schnellen Wiederholungen.
const AMBIENT_SLOTS = [10, 19];
// v9.18: Wie viele Tage zurück verpasste Slots nachgetragen werden. Ein Slot
// entstand bisher nur, wenn jemand die App zwischen seiner Uhrzeit und
// Mitternacht geöffnet hat — wer abends nicht reinschaut, verlor den 19-Uhr-Slot
// endgültig. Drei Tage sind der Kompromiss: Löcher im Feed verschwinden, aber
// die Fun Facts (die aus den HEUTIGEN Zahlen entstehen) bleiben nah genug am
// Zeitpunkt, den sie behaupten.
const AMBIENT_BACKFILL_DAYS = 3;
// Cooldown-Fenster (Tage): so lange wird ein bereits gezeigter Fun-Fact-Typ
// nicht erneut gewählt. Bei 2 Fun Facts / Tag sperrt das die letzten ~14 Typen
// (der Pool hat 18) → genug Rotation, keine schnellen Wiederholungen.
const AMBIENT_COOLDOWN_DAYS = 7;
// v9.14: Spieler-Cooldown (Tage). Der Typ-Cooldown verhindert nur gleiche
// TYPEN — bei einem dominanten Spieler zeigen aber viele VERSCHIEDENE
// Superlative (Sturm-Chef, Elo-Leader, Torschützenkönig …) auf denselben Kopf,
// sodass tagelang derselbe Name erscheint. Ein zuletzt gefeierter Spieler wird
// darum für dieses Fenster gemieden (Notnagel-Pass erlaubt ihn nur, wenn sonst
// kein Template Daten liefert) → echte Namens-Rotation.
const AMBIENT_PLAYER_COOLDOWN_DAYS = 2;
// Auto-Sync-Intervall, damit neue Slots ohne Reload auftauchen (ms).
const NEWS_AUTOSYNC_MS = 10 * 60 * 1000;

// ─── §11.0b — Badge-Whitelist (v8.1) ─────────────────────────────────
// Nur seltene & besondere Badges erzeugen News. Common-Badges sind in der
// Liga zu häufig und würden den Feed verstopfen ("Achievement-Spam").
// Negative: nur die wirklich krassen (perfect_loss, mr_disaster, nemesis),
// nicht die alltäglichen wie bitter_loss/krimi_loser.
//
// PFLEGEHINWEIS: bei neuen Badges (§7.1) hier ergänzen, wenn sie als News
// auftauchen sollen. Default: nicht-newsworthy (bewusste Entscheidung).
const NEWS_BADGE_WHITELIST = new Set([
  // Legendary — alle 10 sind News-würdig
  'dynasty_600','dominator_400','award_collector','perfect_win','streak15','streak20',
  'untouchable','mr_perfect','allwetter','godly_streak',
  // Rare — kuratierte Auswahl: nur die mit besonderer Story
  'wall_badge','upset_king','unbeatable','streak10','vice_champion','potw','krimi',
  'games150', // "Legende" (150 Matches) — Karriere-Meilenstein, v8.6 ergänzt
  // Negative — nur die seltenen, "krassen" Niederlagen
  'mr_disaster','nemesis','perfect_loss',
  // v9.5: explizit als News gewünscht (negativ, aber „immer newsworthy")
  'krimi_loser', // Krimi-Versager — 3 knappe Niederlagen in Folge
  'losing5',     // Losing Streak — 5 Niederlagen in Folge
  // Hinweis: Die gewünschten POSITIVEN Auszeichnungen (Nerven aus Stahl,
  // Wiederholungstäter, Krimi-Reihe, 10er Serie) sind bereits 'rare' und
  // laufen daher ohnehin über die generische Badge-News-Regel unten.
]);

