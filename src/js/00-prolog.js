/* ════════════════════════════════════════════════════════════════════════════
 *  JAVASCRIPT — WO WAS LIEGT
 *  Eine Datei je Sektion in src/js/. Die Reihenfolge der Nummern-Präfixe
 *  IST die Ladereihenfolge; alles liegt nach dem Zusammensetzen in einer
 *  einzigen IIFE, also in einem gemeinsamen Gültigkeitsbereich.
 *  Die [§N.M]-Anker stehen weiterhin im Code.
 * ════════════════════════════════════════════════════════════════════════════
 *
 *  GRUNDLAGE
 *    00-prolog             §0.1     Supabase-Zugangsdaten, IIFE-Start
 *    01-update             §0.2     Build-Version & Update-Check
 *    02-icons              §1.1     SVG-Library              ⚑ HOTSPOT
 *    03-saison             §1.2     Saison-System (monatlich, automatisch)
 *
 *  ENGINE
 *    04-cache              §2.1–2.6 Performance-Caches, Sim-Maps, Snapshots
 *    05-rang-elo           §2.7–2.9 Rang-System, erweitertes Elo, Positionen
 *    06-db                 §3.1,3.3 loadAll, persistRecalc, POTW/POTD-Recap
 *    07-positionsverlauf   §3.4     Saison-Positionsverlauf (§C21-Sheet)
 *    08-stats              §3.4     Stats Engine (winRate, atkW/defW)
 *    09-ui-infra           §4.1–4.4 Avatare, Navigation, Zeiträume
 *    10-elo-engine         §3.5,3.6 simulateElo + Slider-Berechnung
 *
 *  ANSICHTEN
 *    11-view-ranking       §5.1     Rangliste (Saison/Woche/Gesamt)
 *    12-view-positionen    §5.2     Positions-Rangliste
 *    13-view-awards        §5.3     Awards-View              ⚑ HOTSPOT
 *    14-top5-listen        §5.3c    Top-5-Listen der Statistik-Karten
 *    15-views-rest         §5.4–5.8 Teams, History, Eingabe, Settings, Save
 *    16-sheet-infra        §6.1     openSheet/closeSheet
 *
 *  AUSZEICHNUNGEN & PROFIL
 *    17-badges             §7       BADGES, Rarity, Count-Fns, Earned-Cache
 *                                                            ⚑ HOTSPOT
 *    18-profil             §8       playerAwards, showPlayer, Award-Sheets
 *    19-bilanzen           §9.1     Bilanzen-Sheet (Mitspieler-Liste)
 *    20-bind               §10.1    globaler Click-Dispatcher
 *    21-head-to-head       §9.2     Head-to-Head-Profil
 *    22-team-profil        §9.3     Team-Profil
 *    23-match-edit         §9.4     Match bearbeiten
 *    24-lock               §10.2    Settings-Passwort
 *    25-helpers            §10.3    Achievement-Toasts, Utils
 *
 *  LIGA-NEWS                                                 ⚑ HOTSPOT
 *    26-news-konstanten    §11.0    Kategorien, Limits, Badge-Whitelist
 *    27-news-generator     §11.1    Story-Generator + Meilenstein-Leitern
 *    28-news-ambient       §11.1b   Ambiente Fun-Facts (10-/19-Uhr-Slots)
 *    29-news-cache         §11.2,.8,.9  Cache, Realtime, Auto-Sync
 *    30-news-ui            §11.3–11.6b  Read-State, Badge, Toast, Popup, Feed
 *    31-news-detail        §11.7    Story-Detail je Typ
 *
 *  DISZIPLINEN, PRESTIGE & ABSCHLUSS
 *    32-chronik-katalog    §13,13.1 DISZIPLINEN → SEASON_TITLES
 *    33-chronik-engine     §13.2–13.4  Kontext-Pass, Einfrieren, Vergabe
 *    34-chronik-rekorde    §13.4b,c DISZIPLINEN → CHRONICLES, Titelrennen
 *    35-chronik-ui         §13.5–13.7  Anzeige, Marken, Avatar-Ring
 *    35b-prestige          §13.8–13.10 Prestige, Insignium, Laufbahn
 *                                                          ⚑ HOTSPOT
 *    36-backup             §12      Backup, Export & Wiederherstellung
 *    37-boot               §10.4    Initialisierung
 *
 *  HINWEIS: Die Nummerierung der §-Anker ist historisch gewachsen und folgt
 *  nicht der Ladereihenfolge — §11 lädt vor §13, §10.1 zwischen §9.1 und
 *  §9.2, §10.4 ganz zuletzt. Maßgeblich ist die Dateinummer, nicht die §.
 * ════════════════════════════════════════════════════════════════════════════
 *  MAINTENANCE-REGELN
 * ════════════════════════════════════════════════════════════════════════════
 *  Mit ⚑ HOTSPOT markierte Stellen erfordern parallele Updates an mehreren
 *  Orten. Beim Hinzufügen eines neuen Awards oder Badges:
 *
 *    NEUES AWARD
 *      1. ICONS — neues SVG-Icon hinzufügen (falls nötig)         [§1.1]
 *      2. awardRankings — Berechnung + Hidden-Filter + Return     [§3.2]
 *      3. AW_IC — Icon-Mapping (3×! in vAwards/showAward/         [§5.3, §8.3,
 *         showPlayerAwards)                                        §8.4]
 *      4. AWARD_META — Titel + Klasse + Erklärung                 [§5.3]
 *      5. vAwards — Card im richtigen Section-Block               [§5.3]
 *      6. showAward — TEAM_AWARDS/MATCH_AWARDS-Set + switch-case  [§8.3]
 *      7. playerAwards — teamKeys/teamValFns/teamDisplayFns       [§8.1]
 *      8. showPlayer — POSITIVE_KEYS/TEAM_KEYS/NEGATIVE_KEYS      [§8.2]
 *
 *    NEUES BADGE
 *      1. ICONS — neues SVG-Icon hinzufügen                       [§1.1]
 *      2. Count-Funktion implementieren (falls aggregiert)        [§7.3]
 *      3. BADGES-Array — neues Objekt mit ic/name/desc/count      [§7.1]
 *      4. BADGE_RARITY + RARITY_META.total                        [§7.2]
 *      5. getBadgeEarnedCache — fire('badge_id') für Match-       [§7.4]
 *         Trigger (sonst kein Eintrag im Match-Review!)
 *
 *    NEUE SEKTION
 *      → Banner-Format: "// ╔ §N.M ─── NAME ────────────────"
 *      → Hier oben im Inhaltsverzeichnis MIT EINTRAGEN
 *      → Bei Hotspot ggf. ⚑ markieren
 *
 *  Inkonsistenzen sind die Regel, nicht die Ausnahme — die App ist gewachsen
 *  und nicht alle Banner haben das neue Format. Bei Aufräum-Touren Section-IDs
 *  schrittweise nachziehen.
 * ════════════════════════════════════════════════════════════════════════════ */

// ╔═══ §0.1 ────────────────────────────────────────────────────────────────╗
//     ZUGANGSDATEN
// ╚═════════════════════════════════════════════════════════════════════════╝
const SUPABASE_URL = "https://aravpsynckgzradserxs.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFyYXZwc3luY2tnenJhZHNlcnhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzODU1NzMsImV4cCI6MjA5NDk2MTU3M30.HKylQnVlSimk1sCFBlw4vRqfzRnLH7r7kqWd4h-lmR8";
// ════════════════════════════════════════════════════════════

(function(){
"use strict";
if(SUPABASE_URL.startsWith("HIER")||SUPABASE_KEY.startsWith("HIER")){
  document.getElementById('setupGate').style.display='block'; return;
}
document.getElementById('app').style.display='block';
document.getElementById('botnav').style.display='flex';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

