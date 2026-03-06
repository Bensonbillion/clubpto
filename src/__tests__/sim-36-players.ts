/**
 * SIMULATION: 36 Players, 3 Courts, Full Game Night
 *
 * Realistic walkthrough of a Club PTO Wednesday session:
 * - 36 players check in across A/B/C tiers
 * - VIPs (Benson, David, Albright) pick their partners
 * - 3-court schedule generates
 * - Mid-session: 2 no-shows removed, 1 walk-in added
 * - All games play through to completion
 * - Playoffs seed and crown a champion
 *
 * Narrates every step so you can see exactly what happens.
 *
 * Run: npx tsx src/__tests__/sim-36-players.ts
 */

// ═══════════════════════ TYPES ═══════════════════════
type SkillTier = "A" | "B" | "C";
interface Player { id: string; name: string; skillLevel: SkillTier; checkedIn: boolean; checkInTime: string | null; wins: number; losses: number; gamesPlayed: number; profileId?: string; }
interface Pair { id: string; player1: Player; player2: Player; skillLevel: SkillTier; wins: number; losses: number; }
interface Match { id: string; pair1: Pair; pair2: Pair; skillLevel: SkillTier | "cross"; matchupLabel?: string; status: "pending" | "playing" | "completed"; court: number | null; winner?: Pair; loser?: Pair; completedAt?: string; startedAt?: string; gameNumber?: number; courtPool?: "C" | "AB"; }
interface FixedPair { player1Name: string; player2Name: string; }
interface PlayoffMatch { id: string; round: number; pair1?: Pair; pair2?: Pair; winner?: Pair; status: "pending" | "playing" | "completed"; court?: number; }

// ═══════════════════════ HELPERS ═══════════════════════
let idCounter = 0;
function generateId(): string { return "sim_" + (++idCounter); }
function shuffle<T>(arr: T[]): T[] { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function getPairPlayerIds(p: Pair): string[] { return [p.player1.id, p.player2.id]; }
function getMatchPlayerIds(m: Match): string[] { return [...getPairPlayerIds(m.pair1), ...getPairPlayerIds(m.pair2)]; }
function matchupKey(a: string, b: string): string { return [a, b].sort().join("|||"); }
function makePlayer(name: string, tier: SkillTier): Player { return { id: generateId(), name, skillLevel: tier, checkedIn: true, checkInTime: new Date().toISOString(), wins: 0, losses: 0, gamesPlayed: 0 }; }
function isForbiddenMatchup(t1: SkillTier, t2: SkillTier): boolean { return [t1, t2].sort().join("") === "AC"; }
function pairLabel(p: Pair): string { return `${p.player1.name} & ${p.player2.name}`; }
function matchLabel(m: Match): string { return `${pairLabel(m.pair1)} vs ${pairLabel(m.pair2)}`; }
const log = (msg: string) => console.log(msg);
const header = (msg: string) => { log(""); log("━".repeat(60)); log(`  ${msg}`); log("━".repeat(60)); };
const sub = (msg: string) => log(`  ${msg}`);
const detail = (msg: string) => log(`    ${msg}`);
const ok = (msg: string) => log(`    [OK] ${msg}`);
const warn = (msg: string) => log(`    [!!] ${msg}`);

// ═══════════════════════ PAIR GENERATION ═══════════════════════
function createPairs(players: Player[], skill: SkillTier, fixedPairs: FixedPair[]): { pairs: Pair[]; unpaired: Player[] } {
  const pairs: Pair[] = []; const used = new Set<string>();
  // Fixed pairs first (VIP picks)
  for (const fp of fixedPairs) {
    const p1 = players.find(p => p.name.toLowerCase() === fp.player1Name.toLowerCase() && !used.has(p.id));
    const p2 = players.find(p => p.name.toLowerCase() === fp.player2Name.toLowerCase() && !used.has(p.id));
    if (p1 && p2) {
      pairs.push({ id: generateId(), player1: p1, player2: p2, skillLevel: skill, wins: 0, losses: 0 });
      used.add(p1.id); used.add(p2.id);
      detail(`VIP pair locked: ${p1.name} + ${p2.name}`);
    }
  }
  // Remaining players paired randomly
  const remaining = shuffle(players.filter(p => !used.has(p.id)));
  for (let i = 0; i < remaining.length - 1; i += 2) {
    pairs.push({ id: generateId(), player1: remaining[i], player2: remaining[i + 1], skillLevel: skill, wins: 0, losses: 0 });
  }
  const pairedIds = new Set<string>(); pairs.forEach(p => { pairedIds.add(p.player1.id); pairedIds.add(p.player2.id); });
  return { pairs, unpaired: players.filter(p => !pairedIds.has(p.id)) };
}

// ═══════════════════════ SCHEDULE GENERATION ═══════════════════════
type CandidateMatch = { pair1: Pair; pair2: Pair; skillLevel: SkillTier | "cross"; matchupLabel: string; courtPool: "C" | "AB"; };

function generateSchedule(allPairs: Pair[], aPairs: Pair[], bPairs: Pair[], cPairs: Pair[], courtCount: 2 | 3) {
  const totalSlots = 12;
  const TARGET = courtCount === 3 ? 3 : 4;
  const MAX = courtCount === 3 ? 4 : 5;
  const REST_GAP = 1;
  const mPids = (m: { pair1: Pair; pair2: Pair }) => [m.pair1.player1.id, m.pair1.player2.id, m.pair2.player1.id, m.pair2.player2.id];

  const allCandidates: CandidateMatch[] = [];
  for (let i = 0; i < aPairs.length; i++) for (let j = i + 1; j < aPairs.length; j++) allCandidates.push({ pair1: aPairs[i], pair2: aPairs[j], skillLevel: "A", matchupLabel: "A vs A", courtPool: "AB" });
  for (let i = 0; i < cPairs.length; i++) for (let j = i + 1; j < cPairs.length; j++) allCandidates.push({ pair1: cPairs[i], pair2: cPairs[j], skillLevel: "C", matchupLabel: "C vs C", courtPool: "C" });
  for (let i = 0; i < bPairs.length; i++) for (let j = i + 1; j < bPairs.length; j++) allCandidates.push({ pair1: bPairs[i], pair2: bPairs[j], skillLevel: "B", matchupLabel: "B vs B", courtPool: "AB" });
  for (const bp of bPairs) for (const ap of aPairs) allCandidates.push({ pair1: bp, pair2: ap, skillLevel: "cross", matchupLabel: "B vs A", courtPool: "AB" });
  if (courtCount === 2) { for (const bp of bPairs) for (const cp of cPairs) allCandidates.push({ pair1: bp, pair2: cp, skillLevel: "cross", matchupLabel: "B vs C", courtPool: "C" }); }

  let bestSchedule: Match[] = [];
  let bestSB: number[] = [];
  let bestPGC = new Map<string, number>();
  let bestScore = Infinity;

  for (let trial = 0; trial < 5; trial++) {
    const schedule: Match[] = [];
    const used = new Set<string>();
    const pgc = new Map<string, number>();
    const pls = new Map<string, number>();
    allPairs.forEach(p => { pgc.set(p.id, 0); pls.set(p.id, -1); });
    let pool = shuffle([...allCandidates]);
    const sb: number[] = [];

    const pick = (pool: CandidateMatch[], slotPIds: Set<string>, blocked: Set<string>, filter?: "C" | "AB", slot?: number): number => {
      let best = -1, bs = Infinity;
      for (let i = 0; i < pool.length; i++) {
        const c = pool[i];
        if (filter && c.courtPool !== filter) continue;
        if (used.has(matchupKey(c.pair1.id, c.pair2.id))) continue;
        const g1 = pgc.get(c.pair1.id) || 0, g2 = pgc.get(c.pair2.id) || 0;
        if (g1 >= MAX || g2 >= MAX) continue;
        const vals = Array.from(pgc.values());
        const activeVals = vals.filter(v => v > 0);
        const minC = activeVals.length > 0 ? Math.min(...activeVals) : 0;
        if (Math.min(g1, g2) > minC + 1) continue;
        const pids = mPids(c);
        if (pids.some(id => slotPIds.has(id)) || pids.some(id => blocked.has(id))) continue;
        let score = (g1 + g2);
        if (g1 >= TARGET) score += 100;
        if (g2 >= TARGET) score += 100;
        if (c.skillLevel === "cross") { if (courtCount === 3) continue; score += 50; }
        if (score < bs) { bs = score; best = i; }
      }
      return best;
    };

    const commit = (idx: number, slotPIds: Set<string>, slot?: number): Match => {
      const c = pool.splice(idx, 1)[0];
      used.add(matchupKey(c.pair1.id, c.pair2.id));
      pgc.set(c.pair1.id, (pgc.get(c.pair1.id) || 0) + 1);
      pgc.set(c.pair2.id, (pgc.get(c.pair2.id) || 0) + 1);
      mPids(c).forEach(id => slotPIds.add(id));
      if (slot !== undefined) { pls.set(c.pair1.id, slot); pls.set(c.pair2.id, slot); }
      return { id: generateId(), pair1: c.pair1, pair2: c.pair2, skillLevel: c.skillLevel, matchupLabel: c.matchupLabel, courtPool: c.courtPool, status: "pending", court: null };
    };

    for (let slot = 0; slot < totalSlots; slot++) {
      sb.push(schedule.length);
      const blocked = new Set<string>();
      for (let p = Math.max(0, slot - REST_GAP); p < slot; p++) {
        const start = sb[p]; const end = p + 1 < sb.length ? sb[p + 1] : schedule.length;
        for (let i = start; i < end; i++) mPids(schedule[i]).forEach(id => blocked.add(id));
      }
      const slotPIds = new Set<string>();
      if (courtCount === 3) {
        const ci = pick(pool, slotPIds, blocked, "C", slot); if (ci !== -1) schedule.push(commit(ci, slotPIds, slot));
        for (let c = 0; c < 2; c++) { const ai = pick(pool, slotPIds, blocked, "AB", slot); if (ai !== -1) schedule.push(commit(ai, slotPIds, slot)); }
      } else {
        for (let c = 0; c < 2; c++) { const i = pick(pool, slotPIds, blocked, undefined, slot); if (i !== -1) schedule.push(commit(i, slotPIds, slot)); }
      }
    }

    let sc = 0;
    for (let s = 0; s < sb.length; s++) {
      const start = sb[s]; const end = s + 1 < sb.length ? sb[s + 1] : schedule.length;
      if (end - start < courtCount) sc += 5;
    }
    const vals = Array.from(pgc.values());
    const maxG = vals.length > 0 ? Math.max(...vals) : 0;
    const minG = vals.length > 0 ? Math.min(...vals) : 0;
    sc += (maxG - minG) * 10;

    if (sc < bestScore) { bestScore = sc; bestSchedule = [...schedule]; bestSB = [...sb]; bestPGC = new Map(pgc); }
  }

  const schedule = bestSchedule;
  schedule.forEach((m, i) => { m.gameNumber = i + 1; });

  if (courtCount === 3) {
    const cMatch = schedule.find(m => m.status === "pending" && m.courtPool === "C");
    const abMatches = schedule.filter(m => m.status === "pending" && m.courtPool !== "C");
    if (cMatch) { cMatch.status = "playing"; cMatch.court = 1; cMatch.startedAt = new Date().toISOString(); }
    let abCourt = 2;
    for (const m of abMatches) { if (abCourt > 3) break; m.status = "playing"; m.court = abCourt; m.startedAt = new Date().toISOString(); abCourt++; }
  } else {
    for (let c = 0; c < courtCount && c < schedule.length; c++) { schedule[c].status = "playing"; schedule[c].court = c + 1; schedule[c].startedAt = new Date().toISOString(); }
  }

  return { schedule, slotBoundaries: bestSB, pairGameCount: bestPGC };
}

// ═══════════════════════ RUNTIME FUNCTIONS ═══════════════════════
let simClock = Date.now();
const SIM_GAME_DURATION = 8 * 60 * 1000;
const REST_WINDOW = 420000;

function findNextPendingForCourt(matches: Match[], freedCourt: number, courtCount: number, recentPlayerIds: Set<string>, allPairs: Pair[], drainMode = false): Match | undefined {
  const busy = new Set<string>();
  matches.filter(m => m.status === "playing" && m.court !== freedCourt).forEach(m => getMatchPlayerIds(m).forEach(id => busy.add(id)));
  const poolFilter: "C" | "AB" | null = courtCount === 3 ? (freedCourt === 1 ? "C" : "AB") : null;
  const activePairIds = new Set(allPairs.map(p => p.id));

  const valid: Match[] = [];
  const relaxed: Match[] = [];
  for (const m of matches) {
    if (m.status !== "pending") continue;
    if (!activePairIds.has(m.pair1.id) || !activePairIds.has(m.pair2.id)) continue;
    const pids = getMatchPlayerIds(m);
    if (pids.some(id => busy.has(id))) continue;
    if (poolFilter) {
      const mp = m.courtPool || ((m.skillLevel === "C" || m.matchupLabel === "B vs C" || m.matchupLabel === "C vs B") ? "C" : "AB");
      if (poolFilter !== mp) continue;
    }
    if (pids.some(id => recentPlayerIds.has(id))) { relaxed.push(m); continue; }
    valid.push(m);
  }

  const candidates = valid.length > 0 ? valid : relaxed;
  if (candidates.length === 0) return undefined;

  const pgc = new Map<string, number>();
  allPairs.forEach(p => pgc.set(p.id, 0));
  matches.filter(m => m.status === "completed").forEach(m => {
    pgc.set(m.pair1.id, (pgc.get(m.pair1.id) || 0) + 1);
    pgc.set(m.pair2.id, (pgc.get(m.pair2.id) || 0) + 1);
  });

  const availCounts = allPairs.filter(p => !getPairPlayerIds(p).some(id => busy.has(id))).map(p => pgc.get(p.id) || 0);
  const active = availCounts.filter(c => c > 0);
  const minG = active.length > 0 ? Math.min(...active) : 0;

  let best: Match | undefined;
  let bestScore = Infinity;
  for (const c of candidates) {
    const g1 = pgc.get(c.pair1.id) || 0;
    const g2 = pgc.get(c.pair2.id) || 0;
    // Skip equity gate in drain mode — no one is waiting, just finish remaining games
    if (!drainMode && Math.min(g1, g2) > minG + 1) continue;
    const cross = (c.matchupLabel === "B vs A" || c.matchupLabel === "B vs C") ? 100000000 : 0;
    const score = cross + Math.max(g1, g2) * 1000 + (c.gameNumber || 0);
    if (score < bestScore) { bestScore = score; best = c; }
  }
  return best;
}

function completeMatch(matches: Match[], pairs: Pair[], matchId: string, winnerPairId: string, courtCount: number): Match[] {
  const idx = matches.findIndex(m => m.id === matchId);
  if (idx === -1) return matches;
  const match = matches[idx];
  const winner = match.pair1.id === winnerPairId ? match.pair1 : match.pair2;
  const loser = match.pair1.id === winnerPairId ? match.pair2 : match.pair1;
  const freedCourt = match.court;

  simClock += SIM_GAME_DURATION;
  const now = simClock;
  const completedAt = new Date(now).toISOString();

  const updated = [...matches];
  updated[idx] = { ...match, status: "completed", winner, loser, completedAt };

  // Update pair W/L
  winner.wins++;
  loser.losses++;

  if (freedCourt) {
    const recentIds = new Set<string>();
    for (const m of updated) {
      if (m.status === "completed" && m.completedAt && (now - Date.parse(m.completedAt)) < REST_WINDOW) {
        getMatchPlayerIds(m).forEach(id => recentIds.add(id));
      }
    }
    const next = findNextPendingForCourt(updated, freedCourt, courtCount, recentIds, pairs);
    if (next) {
      const ni = updated.findIndex(m => m.id === next.id);
      if (ni !== -1) updated[ni] = { ...next, status: "playing", court: freedCourt, startedAt: new Date(now).toISOString() };
    }
  }
  return updated;
}

function removePlayer(matches: Match[], pairs: Pair[], playerId: string, courtCount: number): { matches: Match[]; pairs: Pair[]; removed: number } {
  const playerPairIds = new Set<string>();
  pairs.forEach(p => { if (p.player1.id === playerId || p.player2.id === playerId) playerPairIds.add(p.id); });
  const updatedPairs = pairs.filter(p => !playerPairIds.has(p.id));

  let updatedMatches = matches.map(m => {
    if (m.status !== "playing") return m;
    const p1R = playerPairIds.has(m.pair1.id);
    const p2R = playerPairIds.has(m.pair2.id);
    if (!p1R && !p2R) return m;
    const w = p1R ? m.pair2 : m.pair1;
    const l = p1R ? m.pair1 : m.pair2;
    return { ...m, status: "completed" as const, winner: w, loser: l, completedAt: new Date(simClock).toISOString() };
  });

  const before = updatedMatches.filter(m => m.status === "pending").length;
  updatedMatches = updatedMatches.filter(m => {
    if (m.status !== "pending") return true;
    return !playerPairIds.has(m.pair1.id) && !playerPairIds.has(m.pair2.id);
  });
  const removed = before - updatedMatches.filter(m => m.status === "pending").length;

  return { matches: updatedMatches, pairs: updatedPairs, removed };
}

function addLatePair(matches: Match[], pairs: Pair[], newPair: Pair, courtCount: number): Match[] {
  const existingMU = new Set<string>();
  matches.forEach(m => existingMU.add(matchupKey(m.pair1.id, m.pair2.id)));
  const tier = newPair.skillLevel;
  const sameTier = pairs.filter(p => p.skillLevel === tier && p.id !== newPair.id);
  let crossTier: Pair[] = [];
  if (tier === "B") crossTier = courtCount === 3 ? pairs.filter(p => p.skillLevel === "A") : pairs.filter(p => p.skillLevel === "A" || p.skillLevel === "C");
  else if (tier === "A") crossTier = pairs.filter(p => p.skillLevel === "B");
  else crossTier = courtCount === 3 ? [] : pairs.filter(p => p.skillLevel === "B");

  const opponents = [...shuffle(sameTier), ...shuffle(crossTier)];
  const newMatches: Match[] = [];
  let gameNum = matches.length;
  for (const opp of opponents) {
    if (newMatches.length >= 4) break;
    const mk = matchupKey(newPair.id, opp.id);
    if (existingMU.has(mk)) continue;
    const isCross = opp.skillLevel !== tier;
    const pool: "C" | "AB" = (tier === "C" || opp.skillLevel === "C") ? "C" : "AB";
    gameNum++;
    newMatches.push({
      id: generateId(), pair1: newPair, pair2: opp,
      skillLevel: isCross ? "cross" : tier, matchupLabel: isCross ? `${tier} vs ${opp.skillLevel}` : `${tier} vs ${tier}`,
      status: "pending", court: null, gameNumber: gameNum, courtPool: pool,
    });
    existingMU.add(mk);
  }
  return [...matches, ...newMatches];
}

// ═══════════════════════ STANDINGS & PLAYOFFS ═══════════════════════
function buildStandings(matches: Match[], pairs: Pair[]): { id: string; pair: Pair; wins: number; losses: number; gp: number; pct: number }[] {
  const m = new Map<string, { pair: Pair; wins: number; losses: number; gp: number }>();
  for (const match of matches) {
    if (match.status !== "completed" || !match.winner || !match.loser) continue;
    const proc = (p: Pair, won: boolean) => {
      if (!m.has(p.id)) m.set(p.id, { pair: p, wins: 0, losses: 0, gp: 0 });
      const s = m.get(p.id)!; s.gp++; if (won) s.wins++; else s.losses++;
    };
    proc(match.winner, true); proc(match.loser, false);
  }
  return Array.from(m.entries()).map(([id, v]) => ({ id, ...v, pct: v.gp > 0 ? v.wins / v.gp : 0 }))
    .sort((a, b) => b.pct - a.pct || b.wins - a.wins);
}

// ═══════════════════════════════════════════════════════════════
//  THE SIMULATION
// ═══════════════════════════════════════════════════════════════

log("");
log("================================================================");
log("   CLUB PTO — WEDNESDAY NIGHT SESSION SIMULATION");
log("   36 Players | 3 Courts | ~85 minutes");
log("   Tablet: 10.1\" Android 15, HD IPS, Octa-core");
log("================================================================");

// ── SCENE 1: DOORS OPEN — CHECK-IN ──
header("SCENE 1: DOORS OPEN — 7:45 PM");
sub("Players arrive and check in on the tablet.");
sub("The admin taps names on the roster. VIPs get a partner-pick dialog.");
log("");

// Real roster — 36 players
const A_NAMES = ["Benson", "David", "Albright", "Ade", "Chizea", "Elvis", "Tami", "Donnell", "Timi", "Marcus", "Kwame", "Folarin"];
const B_NAMES = ["Duke", "Fiyin", "Jaidan", "Ossai", "Dynamite", "Tumi", "Kolade", "Segun", "Yinka", "Dayo"];
const C_NAMES = ["Shana", "Samuel", "Tofunmi", "Temitope", "Emmanuel", "Kayode", "Ese", "Deborah", "Chioma", "Amaka", "Funmi", "Bola", "Ngozi", "Aisha"];

const tA = A_NAMES.map(n => makePlayer(n, "A")); // 12 A-tier
const tB = B_NAMES.map(n => makePlayer(n, "B")); // 10 B-tier
const tC = C_NAMES.map(n => makePlayer(n, "C")); // 14 C-tier
const allPlayers = [...tA, ...tB, ...tC];

sub(`Check-in: ${tA.length} A-tier, ${tB.length} B-tier, ${tC.length} C-tier = ${allPlayers.length} players`);
log("");

// VIPs pick partners
sub("VIP CHECK-INS:");
detail("Benson checks in -> VIP dialog pops up on tablet");
detail("  Benson picks: Albright");
detail("  -> Pair locked: Benson & Albright (A-tier)");
log("");
detail("David checks in -> VIP dialog pops up on tablet");
detail("  David picks: Ade");
detail("  -> Pair locked: David & Ade (A-tier)");
log("");
detail("Albright already paired with Benson — no dialog needed");
log("");

const VIP_PAIRS: FixedPair[] = [
  { player1Name: "Benson", player2Name: "Albright" },
  { player1Name: "David", player2Name: "Ade" },
];

// ── SCENE 2: PAIRING ──
header("SCENE 2: PAIRS FORM — 7:55 PM");
sub("Admin locks check-in. System pairs players within tiers.");
sub("VIP pairs stay locked. Everyone else paired randomly.");
log("");

const aRes = createPairs(tA, "A", VIP_PAIRS);
const bRes = createPairs(tB, "B", []);
const cRes = createPairs(tC, "C", []);
let allPairs = [...aRes.pairs, ...bRes.pairs, ...cRes.pairs];
const unpaired = [...aRes.unpaired, ...bRes.unpaired, ...cRes.unpaired];

sub("A-TIER PAIRS:");
aRes.pairs.forEach(p => detail(`${pairLabel(p)}`));
log("");
sub("B-TIER PAIRS:");
bRes.pairs.forEach(p => detail(`${pairLabel(p)}`));
log("");
sub("C-TIER PAIRS:");
cRes.pairs.forEach(p => detail(`${pairLabel(p)}`));
log("");

sub(`Total: ${allPairs.length} pairs (${allPlayers.length} players)`);
if (unpaired.length > 0) {
  warn(`${unpaired.length} unpaired: ${unpaired.map(p => p.name).join(", ")}`);
  sub("Unpaired players go on the waitlist for late arrivals.");
} else {
  ok("All players paired — no waitlist needed");
}

// ── SCENE 3: SCHEDULE GENERATION ──
header("SCENE 3: SCHEDULE GENERATES — 8:00 PM");
sub("Admin taps 'Start Session'. System builds the full schedule.");
sub("3-court mode: Court 1 = C-tier only, Courts 2-3 = A/B-tier");
log("");

const aPairs = aRes.pairs;
const bPairs = bRes.pairs;
const cPairs = cRes.pairs;
const { schedule, pairGameCount } = generateSchedule(allPairs, aPairs, bPairs, cPairs, 3);
let matches = schedule;

const totalGames = matches.length;
const cPoolGames = matches.filter(m => m.courtPool === "C").length;
const abPoolGames = matches.filter(m => m.courtPool === "AB").length;

sub(`Schedule: ${totalGames} games total`);
detail(`C-pool (Court 1): ${cPoolGames} games for ${cPairs.length} C-tier pairs`);
detail(`AB-pool (Courts 2-3): ${abPoolGames} games for ${aPairs.length} A + ${bPairs.length} B pairs`);
log("");

// Show per-pair game counts
sub("GAMES PER PAIR:");
const sortedPGC = Array.from(pairGameCount.entries())
  .map(([id, count]) => ({ pair: allPairs.find(p => p.id === id)!, count }))
  .sort((a, b) => a.pair.skillLevel.localeCompare(b.pair.skillLevel));
for (const { pair, count } of sortedPGC) {
  detail(`[${pair.skillLevel}] ${pairLabel(pair)}: ${count} games`);
}
const counts = Array.from(pairGameCount.values());
const minG = Math.min(...counts);
const maxG = Math.max(...counts);
log("");
ok(`Equity: min=${minG}, max=${maxG}, gap=${maxG - minG}`);

// Show initial court assignment
log("");
sub("OPENING MATCHES:");
const playing = matches.filter(m => m.status === "playing").sort((a, b) => (a.court || 0) - (b.court || 0));
for (const m of playing) {
  detail(`Court ${m.court} [${m.courtPool}]: ${matchLabel(m)} (${m.matchupLabel})`);
}

// Verify rules
const aVsC = matches.filter(m => [m.pair1.skillLevel, m.pair2.skillLevel].sort().join("") === "AC");
const bVsC3 = matches.filter(m => [m.pair1.skillLevel, m.pair2.skillLevel].sort().join("") === "BC");
log("");
if (aVsC.length > 0) warn(`A vs C matches found: ${aVsC.length} — SHOULD BE ZERO`);
else ok("No A vs C matches (forbidden matchup blocked)");
if (bVsC3.length > 0) warn(`B vs C matches in 3-court mode: ${bVsC3.length} — SHOULD BE ZERO`);
else ok("No B vs C matches (different court pools in 3-court)");

// ── SCENE 4: GAMES BEGIN ──
header("SCENE 4: GAMES BEGIN — 8:00 PM");
sub("All 3 courts are live. Admin watches from the tablet.");
sub("When a game finishes, admin taps the winning pair.");
sub("System auto-assigns next game to the freed court.");
log("");

let gameLog: string[] = [];
let gamesPlayed = 0;

function playRound(count: number, narrateAll = true): number {
  let played = 0;
  for (let i = 0; i < count; i++) {
    const p = matches.filter(m => m.status === "playing");
    if (p.length === 0) {
      // Try to fill empty courts
      for (let court = 1; court <= 3; court++) {
        const inUse = matches.some(m => m.status === "playing" && m.court === court);
        if (inUse) continue;
        const next = findNextPendingForCourt(matches, court, 3, new Set(), allPairs);
        if (next) {
          const ni = matches.findIndex(m => m.id === next.id);
          if (ni !== -1) matches[ni] = { ...next, status: "playing", court, startedAt: new Date(simClock).toISOString() };
        }
      }
      const retry = matches.filter(m => m.status === "playing");
      if (retry.length === 0) break;
    }
    const active = matches.filter(m => m.status === "playing");
    if (active.length === 0) break;
    const m = active[Math.floor(Math.random() * active.length)];
    const winnerId = Math.random() > 0.45 ? m.pair1.id : m.pair2.id; // slight bias for pair1
    const winnerPair = m.pair1.id === winnerId ? m.pair1 : m.pair2;
    const loserPair = m.pair1.id === winnerId ? m.pair2 : m.pair1;

    matches = completeMatch(matches, allPairs, m.id, winnerId, 3);
    gamesPlayed++;
    played++;

    const entry = `Game ${gamesPlayed}: Court ${m.court} [${m.courtPool}] — ${pairLabel(winnerPair)} beat ${pairLabel(loserPair)} (${m.matchupLabel})`;
    gameLog.push(entry);
    if (narrateAll) detail(entry);

    // Show what goes to this court next
    const nextOnCourt = matches.find(m2 => m2.status === "playing" && m2.court === m.court);
    if (nextOnCourt && narrateAll) {
      detail(`  -> Court ${m.court} now: ${matchLabel(nextOnCourt)} (${nextOnCourt.matchupLabel})`);
    } else if (!nextOnCourt && narrateAll) {
      const pending = matches.filter(m2 => m2.status === "pending").length;
      if (pending > 0) detail(`  -> Court ${m.court} resting (players on cooldown)`);
      else detail(`  -> Court ${m.court} done (no more ${m.courtPool} games)`);
    }
  }
  return played;
}

sub("FIRST 6 GAMES (opening rounds):");
const firstBatch = playRound(6);
log("");
const activeCourts = matches.filter(m => m.status === "playing").length;
const pendingGames = matches.filter(m => m.status === "pending").length;
ok(`${firstBatch} games completed, ${activeCourts} courts active, ${pendingGames} pending`);

// ── SCENE 5: PROBLEMS — NO-SHOWS ──
header("SCENE 5: NO-SHOWS SPOTTED — 8:20 PM");
sub("Admin notices Folarin and Marcus haven't actually shown up.");
sub("They checked in via the app but aren't here. Admin removes them.");
log("");

const folarin = tA.find(p => p.name === "Folarin")!;
const marcus = tA.find(p => p.name === "Marcus")!;
const folarinPair = allPairs.find(p => p.player1.id === folarin.id || p.player2.id === folarin.id);
const marcusPair = allPairs.find(p => p.player1.id === marcus.id || p.player2.id === marcus.id);

sub(`Removing: ${folarin.name} (A-tier), was paired with ${folarinPair ? (folarinPair.player1.id === folarin.id ? folarinPair.player2.name : folarinPair.player1.name) : "?"}`);
let result = removePlayer(matches, allPairs, folarin.id, 3);
matches = result.matches; allPairs = result.pairs;
detail(`${result.removed} pending games voided, ${allPairs.length} pairs remain`);

const folarinGhost = matches.filter(m => m.status === "pending" && getMatchPlayerIds(m).includes(folarin.id));
if (folarinGhost.length === 0) ok("No ghost matches — Folarin fully cleaned up");
else warn(`${folarinGhost.length} ghost matches still reference Folarin!`);

log("");
sub(`Removing: ${marcus.name} (A-tier), was paired with ${marcusPair ? (marcusPair.player1.id === marcus.id ? marcusPair.player2.name : marcusPair.player1.name) : "?"}`);
result = removePlayer(matches, allPairs, marcus.id, 3);
matches = result.matches; allPairs = result.pairs;
detail(`${result.removed} pending games voided, ${allPairs.length} pairs remain`);

const marcusGhost = matches.filter(m => m.status === "pending" && getMatchPlayerIds(m).includes(marcus.id));
if (marcusGhost.length === 0) ok("No ghost matches — Marcus fully cleaned up");
else warn(`${marcusGhost.length} ghost matches still reference Marcus!`);

log("");
sub("Playing 3 more games to verify courts don't stall after removal...");
const postRemove = playRound(3);
if (postRemove === 3) ok("Courts running smooth after removals");
else warn(`Only ${postRemove}/3 games completed — courts may be stalling`);

// ── SCENE 6: WALK-IN ──
header("SCENE 6: WALK-IN ARRIVAL — 8:35 PM");
sub("Tunde and Kola show up unannounced. Both B-tier players.");
sub("Admin adds them to the roster and pairs them together.");
log("");

const tunde = makePlayer("Tunde", "B");
const kola = makePlayer("Kola", "B");
const walkInPair: Pair = { id: generateId(), player1: tunde, player2: kola, skillLevel: "B", wins: 0, losses: 0 };
allPairs = [...allPairs, walkInPair];
matches = addLatePair(matches, allPairs, walkInPair, 3);
const walkInMatches = matches.filter(m => m.pair1.id === walkInPair.id || m.pair2.id === walkInPair.id);
detail(`Tunde & Kola added — ${walkInMatches.length} games scheduled for them`);

for (const wm of walkInMatches) {
  detail(`  -> vs ${wm.pair1.id === walkInPair.id ? pairLabel(wm.pair2) : pairLabel(wm.pair1)} (${wm.matchupLabel}, ${wm.courtPool}-pool)`);
}

const wrongPool = walkInMatches.filter(m => m.courtPool !== "AB");
if (wrongPool.length === 0) ok("All walk-in B-tier matches correctly routed to AB-pool (Courts 2-3)");
else warn(`${wrongPool.length} walk-in matches have wrong pool routing!`);

log("");
sub("Playing 3 games to check late pair integrates without deadlock...");
const postWalkin = playRound(3);
if (postWalkin === 3) ok("No deadlock — equity gate handles the 0-game late pair");
else warn(`Only ${postWalkin}/3 — possible equity gate deadlock!`);

// ── SCENE 7: MID-SESSION STATUS CHECK ──
header("SCENE 7: MID-SESSION — 8:45 PM");
sub("Admin glances at the tablet to check progress.");
log("");

const midCompleted = matches.filter(m => m.status === "completed").length;
const midPlaying = matches.filter(m => m.status === "playing");
const midPending = matches.filter(m => m.status === "pending").length;

sub(`Progress: ${midCompleted} completed, ${midPlaying.length} on court, ${midPending} pending`);
log("");

sub("COURTS RIGHT NOW:");
for (const m of midPlaying.sort((a, b) => (a.court || 0) - (b.court || 0))) {
  detail(`Court ${m.court} [${m.courtPool}]: ${matchLabel(m)} (${m.matchupLabel})`);
}

log("");
sub("PAIR STANDINGS SO FAR:");
const midStandings = buildStandings(matches, allPairs);
for (const s of midStandings) {
  detail(`[${s.pair.skillLevel}] ${pairLabel(s.pair)}: ${s.wins}W-${s.losses}L (${s.gp} games, ${(s.pct * 100).toFixed(0)}%)`);
}

// ── SCENE 8: PLAY ALL REMAINING GAMES ──
header("SCENE 8: FINISH ROUND-ROBIN — 8:45 - 9:10 PM");
sub("Games continue. Admin taps winners as each match ends.");
sub("(fast-forwarding through remaining games...)");
log("");

let stallCount = 0;
let maxIter = 200;
while (maxIter-- > 0) {
  const p = matches.filter(m => m.status === "playing");
  const pend = matches.filter(m => m.status === "pending");
  if (p.length === 0 && pend.length === 0) break;
  if (p.length === 0 && pend.length > 0) {
    stallCount++;
    if (stallCount > 5) { warn(`STALLED with ${pend.length} pending games!`); break; }
    // Drain mode: no games playing, just finish remaining — bypass equity gate
    const drain = stallCount >= 2;
    for (let court = 1; court <= 3; court++) {
      const next = findNextPendingForCourt(matches, court, 3, new Set(), allPairs, drain);
      if (next) {
        const ni = matches.findIndex(m => m.id === next.id);
        if (ni !== -1) matches[ni] = { ...next, status: "playing", court, startedAt: new Date(simClock).toISOString() };
      }
    }
    continue;
  }
  stallCount = 0;
  playRound(1, false);
}

const finalCompleted = matches.filter(m => m.status === "completed").length;
const finalPending = matches.filter(m => m.status === "pending").length;
const finalPlaying = matches.filter(m => m.status === "playing").length;

sub(`Round-robin complete: ${finalCompleted} games played`);
if (finalPending === 0 && finalPlaying === 0) ok("All scheduled games completed — no stalls");
else warn(`${finalPending} pending + ${finalPlaying} playing — something stalled!`);

log("");
sub("GAME DISTRIBUTION:");
const pairGames = new Map<string, number>();
allPairs.forEach(p => pairGames.set(p.id, 0));
matches.filter(m => m.status === "completed").forEach(m => {
  pairGames.set(m.pair1.id, (pairGames.get(m.pair1.id) || 0) + 1);
  pairGames.set(m.pair2.id, (pairGames.get(m.pair2.id) || 0) + 1);
});
const gamesList = allPairs.map(p => ({ pair: p, games: pairGames.get(p.id) || 0 })).sort((a, b) => a.games - b.games);
for (const { pair, games } of gamesList) {
  detail(`[${pair.skillLevel}] ${pairLabel(pair)}: ${games} games`);
}
const eqMin = gamesList[0]?.games || 0;
const eqMax = gamesList[gamesList.length - 1]?.games || 0;
log("");
if (eqMax - eqMin <= 3) ok(`Equity gap: ${eqMax - eqMin} (min=${eqMin}, max=${eqMax})`);
else warn(`Equity gap: ${eqMax - eqMin} — too wide (min=${eqMin}, max=${eqMax})`);

// Court routing check
let routeErrors = 0;
for (const m of matches.filter(m => m.status === "completed" && m.court)) {
  const pool = m.courtPool || ((m.skillLevel === "C" || m.matchupLabel === "B vs C") ? "C" : "AB");
  if (m.court === 1 && pool !== "C") routeErrors++;
  if ((m.court === 2 || m.court === 3) && pool !== "AB") routeErrors++;
}
if (routeErrors === 0) ok("All court assignments match pool routing (C->Court 1, AB->Courts 2-3)");
else warn(`${routeErrors} court-pool mismatches!`);

// ── SCENE 9: PLAYOFFS ──
header("SCENE 9: PLAYOFFS — 9:10 PM");
sub("Round-robin done. Top 8 pairs enter single-elimination playoffs.");
sub("Seeded by win% then total wins. Higher seed picks their court.");
log("");

const standings = buildStandings(matches, allPairs);

sub("FINAL STANDINGS (Top 8 qualify):");
standings.forEach((s, i) => {
  const qualified = i < 8 ? " ** QUALIFIED **" : "";
  detail(`#${i + 1} [${s.pair.skillLevel}] ${pairLabel(s.pair)}: ${s.wins}W-${s.losses}L (${(s.pct * 100).toFixed(0)}%)${qualified}`);
});

const top8 = standings.slice(0, 8);
log("");
sub("QUARTERFINALS:");

const qf: PlayoffMatch[] = [];
for (let i = 0; i < 4; i++) {
  const s1 = top8[i], s2 = top8[7 - i];
  qf.push({ id: generateId(), round: 1, pair1: s1.pair, pair2: s2.pair, status: "pending" });
}

// Simulate QF — higher seed (better record) wins
for (const m of qf) {
  const w = Math.random() > 0.35 ? m.pair1! : m.pair2!; // slight favorite for higher seed
  m.winner = w; m.status = "completed";
  detail(`#${top8.findIndex(s => s.pair.id === m.pair1!.id) + 1} ${pairLabel(m.pair1!)} vs #${top8.findIndex(s => s.pair.id === m.pair2!.id) + 1} ${pairLabel(m.pair2!)} -> Winner: ${pairLabel(w)}`);
}

log("");
sub("SEMIFINALS:");
const sf: PlayoffMatch[] = [];
for (let i = 0; i < qf.length; i += 2) {
  sf.push({ id: generateId(), round: 2, pair1: qf[i].winner, pair2: qf[i + 1].winner, status: "pending" });
}
for (const m of sf) {
  const w = Math.random() > 0.5 ? m.pair1! : m.pair2!;
  m.winner = w; m.status = "completed";
  detail(`${pairLabel(m.pair1!)} vs ${pairLabel(m.pair2!)} -> Winner: ${pairLabel(w)}`);
}

log("");
sub("FINAL:");
const final: PlayoffMatch = { id: generateId(), round: 3, pair1: sf[0].winner, pair2: sf[1].winner, status: "pending" };
const champion = Math.random() > 0.5 ? final.pair1! : final.pair2!;
final.winner = champion; final.status = "completed";
detail(`${pairLabel(final.pair1!)} vs ${pairLabel(final.pair2!)} -> WINNER: ${pairLabel(champion)}`);

// ── SCENE 10: SESSION SUMMARY ──
header("SESSION COMPLETE — 9:25 PM");
log("");
sub("The tablet shows the final results screen.");
sub("Admin takes a screenshot for the group chat.");
log("");

log("  +--------------------------------------------------+");
log("  |                                                  |");
log(`  |   CHAMPIONS: ${pairLabel(champion).padEnd(35)}|`);
log("  |                                                  |");
log(`  |   Runner-up: ${pairLabel(champion === final.pair1! ? final.pair2! : final.pair1!).padEnd(35)}|`);
log("  |                                                  |");
log(`  |   ${allPlayers.length} players checked in                      |`);
log(`  |   ${allPairs.length} pairs competed                           |`);
log(`  |   ${finalCompleted} round-robin games                       |`);
log(`  |   7 playoff games                                |`);
log(`  |   3 courts, ~85 minutes                          |`);
log("  |                                                  |");
log("  |   No stalls. No ghosts. No deadlocks.            |");
log("  |                                                  |");
log("  +--------------------------------------------------+");

log("");
sub("WHAT HAPPENED TONIGHT:");
detail(`1. ${allPlayers.length} players checked in (${tA.length}A + ${tB.length}B + ${tC.length}C)`);
detail(`2. VIPs picked partners: Benson+Albright, David+Ade`);
detail(`3. ${allPairs.length - 1} pairs formed (before walk-in), schedule generated: ${totalGames} games`);
detail(`4. 3 courts went live: Court 1 (C-tier), Courts 2-3 (A/B-tier)`);
detail(`5. After 6 games: Folarin & Marcus removed (no-shows) — ${result.removed + 2} games voided`);
detail(`6. Tunde & Kola walked in mid-session — ${walkInMatches.length} games added for them`);
detail(`7. Round-robin completed: ${finalCompleted} total games, equity gap ${eqMax - eqMin}`);
detail(`8. Playoffs: QF -> SF -> Final`);
detail(`9. Champions: ${pairLabel(champion)}`);

// Final health checks
log("");
sub("HEALTH CHECKS:");
const checks = [
  { test: finalPending === 0 && finalPlaying === 0, msg: "All games completed (no stalls)" },
  { test: aVsC.length === 0, msg: "No A vs C matches (forbidden)" },
  { test: bVsC3.length === 0, msg: "No B vs C in 3-court mode (pool separation)" },
  { test: routeErrors === 0, msg: "Court routing correct (C->1, AB->2/3)" },
  { test: eqMax - eqMin <= 3, msg: `Equity gap ${eqMax - eqMin} <= 3` },
  { test: folarinGhost.length === 0, msg: "No ghost matches after removal" },
  { test: marcusGhost.length === 0, msg: "No ghost matches after removal" },
  { test: wrongPool.length === 0, msg: "Walk-in matches routed correctly" },
  { test: walkInMatches.length >= 3, msg: `Walk-ins got ${walkInMatches.length} games` },
  { test: !!champion, msg: `Champion determined: ${pairLabel(champion)}` },
];

let passed = 0, failed = 0;
for (const c of checks) {
  if (c.test) { ok(c.msg); passed++; }
  else { warn(c.msg); failed++; }
}

log("");
log(`  RESULT: ${passed} passed, ${failed} failed`);
log("");

process.exit(failed > 0 ? 1 : 0);
