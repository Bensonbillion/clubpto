/**
 * STRESS TEST — 40 Players, 3 Courts, Full Session Lifecycle
 *
 * Simulates everything that happens on game day:
 * 1. 40 players check in across A/B/C tiers
 * 2. Schedule generates for 3-court mode
 * 3. Games play out with match completions
 * 4. Mid-session: remove a no-show player
 * 5. Mid-session: add a walk-in player not on the roster
 * 6. Mid-session: late arrival pair joins after games started
 * 7. Mid-session: swap a player out of a pair
 * 8. Run all remaining games
 * 9. Playoffs seed and bracket
 * 10. Playoff rounds through to champion
 *
 * Run: npx tsx src/__tests__/stress-test-40-players.ts
 */

// ═══════════════════════ TYPES ═══════════════════════
type SkillTier = "A" | "B" | "C";
interface Player { id: string; name: string; skillLevel: SkillTier; checkedIn: boolean; checkInTime: string | null; wins: number; losses: number; gamesPlayed: number; isActive?: boolean; }
interface Pair { id: string; player1: Player; player2: Player; skillLevel: SkillTier; wins: number; losses: number; }
interface Match { id: string; pair1: Pair; pair2: Pair; skillLevel: SkillTier | "cross"; matchupLabel?: string; status: "pending" | "playing" | "completed"; court: number | null; winner?: Pair; loser?: Pair; completedAt?: string; startedAt?: string; gameNumber?: number; courtPool?: "C" | "AB"; }
interface FixedPair { player1Name: string; player2Name: string; }
interface PlayoffMatch { id: string; round: number; seed1?: number; seed2?: number; pair1?: Pair; pair2?: Pair; winner?: Pair; status: "pending" | "playing" | "completed"; court?: number; }

// ═══════════════════════ HELPERS ═══════════════════════
let idCounter = 0;
function generateId(): string { return "stress_" + (++idCounter); }
function shuffle<T>(arr: T[]): T[] { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function getPairPlayerIds(p: Pair): string[] { return [p.player1.id, p.player2.id]; }
function getMatchPlayerIds(m: Match): string[] { return [...getPairPlayerIds(m.pair1), ...getPairPlayerIds(m.pair2)]; }
function matchupKey(a: string, b: string): string { return [a, b].sort().join("|||"); }
function makePlayer(name: string, tier: SkillTier): Player { return { id: generateId(), name, skillLevel: tier, checkedIn: true, checkInTime: new Date().toISOString(), wins: 0, losses: 0, gamesPlayed: 0, isActive: true }; }
function isForbiddenMatchup(t1: SkillTier, t2: SkillTier): boolean { return [t1, t2].sort().join("") === "AC"; }

// ═══════════════════════ RESULT TRACKING ═══════════════════════
let passed = 0, failed = 0;
const failures: { phase: string; msg: string; severity: "CRITICAL" | "HIGH" | "LOW" }[] = [];
function pass(phase: string, msg: string) { console.log(`  ✅ ${msg}`); passed++; }
function fail(phase: string, msg: string, sev: "CRITICAL" | "HIGH" | "LOW" = "HIGH") { console.log(`  ❌ ${msg}`); failed++; failures.push({ phase, msg, severity: sev }); }
function assert(phase: string, cond: boolean, passMsg: string, failMsg: string, sev: "CRITICAL" | "HIGH" | "LOW" = "HIGH") { if (cond) pass(phase, passMsg); else fail(phase, failMsg, sev); }

// ═══════════════════════ PAIR GENERATION ═══════════════════════
function createPairsForTier(players: Player[], skill: SkillTier, fixedPairs: FixedPair[]): { pairs: Pair[]; unpaired: Player[] } {
  const pairs: Pair[] = []; const used = new Set<string>();
  for (const fp of fixedPairs) {
    const p1 = players.find(p => p.name.toLowerCase() === fp.player1Name.toLowerCase() && !used.has(p.id));
    const p2 = players.find(p => p.name.toLowerCase() === fp.player2Name.toLowerCase() && !used.has(p.id));
    if (p1 && p2) { pairs.push({ id: generateId(), player1: p1, player2: p2, skillLevel: skill, wins: 0, losses: 0 }); used.add(p1.id); used.add(p2.id); }
  }
  const remaining = players.filter(p => !used.has(p.id));
  for (let i = 0; i < remaining.length - 1; i += 2) {
    pairs.push({ id: generateId(), player1: remaining[i], player2: remaining[i + 1], skillLevel: skill, wins: 0, losses: 0 });
  }
  const pairedIds = new Set<string>(); pairs.forEach(p => { pairedIds.add(p.player1.id); pairedIds.add(p.player2.id); });
  return { pairs, unpaired: players.filter(p => !pairedIds.has(p.id)) };
}

// ═══════════════════════ SCHEDULE GENERATION (mirrors useGameState.ts) ═══════════════════════
type CandidateMatch = { pair1: Pair; pair2: Pair; skillLevel: SkillTier | "cross"; matchupLabel: string; courtPool: "C" | "AB"; };

function generateSchedule(allPairs: Pair[], aPairs: Pair[], bPairs: Pair[], cPairs: Pair[], courtCount: 2 | 3) {
  const totalSlots = 12; // ~85 min / 7 min
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
        // Only block if BOTH pairs are ahead — allow catch-up matches
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

    // Score trial
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

  // 3-court: assign first matches by pool
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

// ═══════════════════════ RUNTIME: findNextPendingForCourt (mirrors useGameState.ts) ═══════════════════════
function findNextPendingForCourt(matches: Match[], freedCourt: number, courtCount: number, recentPlayerIds: Set<string>, allPairs: Pair[]): Match | undefined {
  const busy = new Set<string>();
  matches.filter(m => m.status === "playing" && m.court !== freedCourt).forEach(m => getMatchPlayerIds(m).forEach(id => busy.add(id)));

  const poolFilter: "C" | "AB" | null = courtCount === 3 ? (freedCourt === 1 ? "C" : "AB") : null;

  const valid: Match[] = [];
  for (const m of matches) {
    if (m.status !== "pending") continue;
    const pids = getMatchPlayerIds(m);
    if (pids.some(id => busy.has(id))) continue;
    if (pids.some(id => recentPlayerIds.has(id))) continue;
    if (poolFilter) {
      const mp = m.courtPool || ((m.skillLevel === "C" || m.matchupLabel === "B vs C" || m.matchupLabel === "C vs B") ? "C" : "AB");
      if (poolFilter !== mp) continue;
    }
    valid.push(m);
  }
  if (valid.length === 0) return undefined;

  const pgc = new Map<string, number>();
  allPairs.forEach(p => pgc.set(p.id, 0));
  matches.filter(m => m.status === "completed").forEach(m => {
    pgc.set(m.pair1.id, (pgc.get(m.pair1.id) || 0) + 1);
    pgc.set(m.pair2.id, (pgc.get(m.pair2.id) || 0) + 1);
  });

  // Equity gate: exclude 0-game pairs from minimum
  const allCounts = allPairs.map(p => pgc.get(p.id) || 0);
  const active = allCounts.filter(c => c > 0);
  const minG = active.length > 0 ? Math.min(...active) : 0;

  let best: Match | undefined;
  let bestScore = Infinity;
  for (let i = 0; i < valid.length; i++) {
    const c = valid[i];
    const g1 = pgc.get(c.pair1.id) || 0;
    const g2 = pgc.get(c.pair2.id) || 0;
    // Only block if BOTH pairs are ahead — allow catch-up matches
    if (Math.min(g1, g2) > minG + 1) continue;
    const cross = (c.matchupLabel === "B vs A" || c.matchupLabel === "B vs C") ? 100000000 : 0;
    const score = cross + Math.max(g1, g2) * 1000 + (c.gameNumber || i);
    if (score < bestScore) { bestScore = score; best = c; }
  }
  return best;
}

// ═══════════════════════ RUNTIME: completeMatch ═══════════════════════
// Simulated clock — advances ~8 min per game to replicate real session timing
let simClock = Date.now();
const SIM_GAME_DURATION = 8 * 60 * 1000; // 8 minutes per game
const REST_WINDOW = 420000; // 7 minutes — must match real engine

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

  if (freedCourt) {
    // Only treat players from recently-completed matches as resting (within REST_WINDOW)
    const recentIds = new Set<string>();
    for (const m of updated) {
      if (m.status === "completed" && m.completedAt && (now - Date.parse(m.completedAt)) < REST_WINDOW) {
        getMatchPlayerIds(m).forEach(id => recentIds.add(id));
      }
    }

    const next = findNextPendingForCourt(updated, freedCourt, courtCount, recentIds, pairs);
    if (next) {
      const ni = updated.findIndex(m => m.id === next.id);
      if (ni !== -1) {
        updated[ni] = { ...next, status: "playing", court: freedCourt, startedAt: new Date(now).toISOString() };
      }
    }
  }
  return updated;
}

// ═══════════════════════ RUNTIME: removePlayerMidSession ═══════════════════════
function removePlayerMidSession(matches: Match[], pairs: Pair[], playerId: string, courtCount: number): { matches: Match[]; pairs: Pair[]; removed: number } {
  const playerPairIds = new Set<string>();
  pairs.forEach(p => { if (p.player1.id === playerId || p.player2.id === playerId) playerPairIds.add(p.id); });

  const updatedPairs = pairs.filter(p => !playerPairIds.has(p.id));

  // Auto-forfeit playing matches
  let updatedMatches = matches.map(m => {
    if (m.status !== "playing") return m;
    const p1R = playerPairIds.has(m.pair1.id);
    const p2R = playerPairIds.has(m.pair2.id);
    if (!p1R && !p2R) return m;
    const w = p1R ? m.pair2 : m.pair1;
    const l = p1R ? m.pair1 : m.pair2;
    return { ...m, status: "completed" as const, winner: w, loser: l, completedAt: new Date().toISOString() };
  });

  // Collect orphaned opponents
  const orphans = new Set<string>();
  matches.forEach(m => {
    if (m.status !== "pending" && m.status !== "playing") return;
    if (playerPairIds.has(m.pair1.id)) orphans.add(m.pair2.id);
    if (playerPairIds.has(m.pair2.id)) orphans.add(m.pair1.id);
  });

  // Remove pending matches with removed pair
  const before = updatedMatches.filter(m => m.status === "pending").length;
  updatedMatches = updatedMatches.filter(m => {
    if (m.status !== "pending") return true;
    return !playerPairIds.has(m.pair1.id) && !playerPairIds.has(m.pair2.id);
  });
  const removed = before - updatedMatches.filter(m => m.status === "pending").length;

  // Generate replacements for orphans
  const existingMU = new Set<string>();
  updatedMatches.forEach(m => existingMU.add(matchupKey(m.pair1.id, m.pair2.id)));

  let gameNum = updatedMatches.length;
  for (const oid of orphans) {
    if (playerPairIds.has(oid)) continue;
    const orphanPair = updatedPairs.find(p => p.id === oid);
    if (!orphanPair) continue;
    const tier = orphanPair.skillLevel;
    const pending = updatedMatches.filter(m => m.status === "pending" && (m.pair1.id === oid || m.pair2.id === oid)).length;
    const needed = Math.max(0, 3 - pending);
    const opponents = shuffle(updatedPairs.filter(p => {
      if (p.id === oid) return false;
      if (isForbiddenMatchup(tier, p.skillLevel)) return false;
      const t = [tier, p.skillLevel].sort().join("");
      if (t === "BC" && courtCount === 3) return false;
      return true;
    }));
    let added = 0;
    for (const opp of opponents) {
      if (added >= needed) break;
      const mk = matchupKey(oid, opp.id);
      if (existingMU.has(mk)) continue;
      const isCross = opp.skillLevel !== tier;
      const pool: "C" | "AB" = (tier === "C" || opp.skillLevel === "C") ? "C" : "AB";
      gameNum++;
      updatedMatches.push({
        id: generateId(), pair1: orphanPair, pair2: opp,
        skillLevel: isCross ? "cross" : tier, matchupLabel: isCross ? `${tier} vs ${opp.skillLevel}` : `${tier} vs ${tier}`,
        status: "pending", court: null, gameNumber: gameNum, courtPool: pool,
      });
      existingMU.add(mk);
      added++;
    }
  }

  return { matches: updatedMatches, pairs: updatedPairs, removed };
}

// ═══════════════════════ RUNTIME: addLatePair ═══════════════════════
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

// ═══════════════════════ PLAYOFF BRACKET ═══════════════════════
function buildStandings(matches: Match[]): { id: string; pair: Pair; wins: number; losses: number; gp: number; pct: number }[] {
  const m = new Map<string, { pair: Pair; wins: number; losses: number; gp: number }>();
  for (const match of matches) {
    if (match.status !== "completed" || !match.winner || !match.loser) continue;
    const proc = (p: Pair, won: boolean) => {
      if (!m.has(p.id)) m.set(p.id, { pair: p, wins: 0, losses: 0, gp: 0 });
      const s = m.get(p.id)!; s.gp++; if (won) s.wins++; else s.losses++;
    };
    proc(match.winner, true); proc(match.loser, false);
  }
  return Array.from(m.entries()).map(([id, v]) => ({ id, ...v, pct: v.gp > 0 ? v.wins / v.gp : 0 }));
}

function runPlayoffs(standings: { id: string; pair: Pair; wins: number; pct: number }[]): { champion: Pair; rounds: PlayoffMatch[][] } {
  const sorted = [...standings].sort((a, b) => b.pct - a.pct || b.wins - a.wins);
  const top = sorted.slice(0, 8);
  const rounds: PlayoffMatch[][] = [];

  // QF
  const qf: PlayoffMatch[] = [];
  const numQF = Math.floor(top.length / 2);
  for (let i = 0; i < numQF; i++) {
    const s1 = top[i], s2 = top[top.length - 1 - i];
    qf.push({ id: generateId(), round: 1, seed1: i + 1, seed2: top.length - i, pair1: s1.pair, pair2: s2.pair, status: "pending" });
  }
  // Simulate QF — higher seed wins
  qf.forEach(m => { m.winner = m.pair1; m.status = "completed"; });
  rounds.push(qf);

  // SF
  if (qf.length >= 2) {
    const sf: PlayoffMatch[] = [];
    for (let i = 0; i < qf.length; i += 2) {
      if (i + 1 < qf.length) {
        sf.push({ id: generateId(), round: 2, pair1: qf[i].winner, pair2: qf[i + 1].winner, status: "pending" });
      }
    }
    sf.forEach(m => { m.winner = m.pair1; m.status = "completed"; });
    rounds.push(sf);

    // Final
    if (sf.length >= 2) {
      const final: PlayoffMatch = { id: generateId(), round: 3, pair1: sf[0].winner, pair2: sf[1].winner, status: "pending" };
      final.winner = final.pair1; final.status = "completed";
      rounds.push([final]);
      return { champion: final.winner!, rounds };
    } else if (sf.length === 1) {
      return { champion: sf[0].winner!, rounds };
    }
  }

  return { champion: qf[0]?.winner || top[0].pair, rounds };
}

// ═══════════════════════ 40-PLAYER ROSTER ═══════════════════════
const A_NAMES = ["Ade", "Benson", "David", "Albright", "Chizea", "Elvis", "Tami", "Donnell", "Timi", "Folarin", "Marcus", "Jerome", "Kwame", "Idris"];
const B_NAMES = ["Duke", "Fiyin", "Jaidan", "Ossai", "Dynamite", "Tumi", "Kolade", "Segun", "Yinka", "Dayo", "Nonso", "Fela"];
const C_NAMES = ["Shana", "Samuel", "Tofunmi", "Temitope", "Emmanuel", "Kayode", "Ese", "Deborah", "Chioma", "Amaka", "Funmi", "Bola", "Ngozi", "Aisha"];
const VIP_PAIRS: FixedPair[] = [{ player1Name: "Benson", player2Name: "Albright" }, { player1Name: "David", player2Name: "Ade" }];

// ═══════════════════════════════════════════════════════════════
//  PHASE 1: INITIAL SETUP — 40 Players, 3 Courts
// ═══════════════════════════════════════════════════════════════
console.log("\n══════════════════════════════════════════════════════");
console.log("  STRESS TEST: 40 Players, 3 Courts, Full Session");
console.log("══════════════════════════════════════════════════════\n");

console.log("── PHASE 1: Setup & Schedule Generation ──");
const tA = A_NAMES.map(n => makePlayer(n, "A")); // 14 A-tier
const tB = B_NAMES.map(n => makePlayer(n, "B")); // 12 B-tier
const tC = C_NAMES.map(n => makePlayer(n, "C")); // 14 C-tier
const allPlayers = [...tA, ...tB, ...tC];
console.log(`  Players: ${tA.length}A + ${tB.length}B + ${tC.length}C = ${allPlayers.length} total`);
assert("setup", allPlayers.length === 40, "40 players created", `Expected 40 players, got ${allPlayers.length}`, "CRITICAL");

const aRes = createPairsForTier(shuffle(tA), "A", VIP_PAIRS);
const bRes = createPairsForTier(shuffle(tB), "B", []);
const cRes = createPairsForTier(shuffle(tC), "C", []);
let allPairs = [...aRes.pairs, ...bRes.pairs, ...cRes.pairs];
const totalUnpaired = aRes.unpaired.length + bRes.unpaired.length + cRes.unpaired.length;
console.log(`  Pairs: ${aRes.pairs.length}A + ${bRes.pairs.length}B + ${cRes.pairs.length}C = ${allPairs.length} pairs, ${totalUnpaired} unpaired`);
assert("setup", allPairs.length === 20, "20 pairs (40 players / 2)", `Expected 20 pairs, got ${allPairs.length}`, "CRITICAL");
assert("setup", totalUnpaired === 0, "No unpaired players", `${totalUnpaired} unpaired players`, "CRITICAL");

const { schedule, slotBoundaries, pairGameCount } = generateSchedule(allPairs, aRes.pairs, bRes.pairs, cRes.pairs, 3);
let matches = schedule;
console.log(`  Schedule: ${matches.length} games in ${slotBoundaries.length} slots`);
assert("schedule", matches.length >= 30, `Generated ${matches.length} games (>= 30)`, `Only ${matches.length} games generated — too few for 20 pairs`, "HIGH");

// Validate: no A vs C matches
const aVsC = matches.filter(m => {
  const t = [m.pair1.skillLevel, m.pair2.skillLevel].sort().join("");
  return t === "AC";
});
assert("schedule", aVsC.length === 0, "No A vs C matches", `${aVsC.length} A vs C matches found!`, "CRITICAL");

// Validate: no B vs C in 3-court mode
const bVsC = matches.filter(m => {
  const t = [m.pair1.skillLevel, m.pair2.skillLevel].sort().join("");
  return t === "BC";
});
assert("schedule", bVsC.length === 0, "No B vs C matches in 3-court mode", `${bVsC.length} B vs C matches found!`, "CRITICAL");

// Validate: initial court assignments correct
const playing = matches.filter(m => m.status === "playing");
assert("schedule", playing.length === 3, "3 matches assigned to courts", `${playing.length} matches playing`, "CRITICAL");
const c1 = playing.find(m => m.court === 1);
assert("schedule", !!c1 && c1.courtPool === "C", "Court 1 = C-pool match", c1 ? `Court 1 has ${c1.courtPool} match` : "No Court 1 match", "CRITICAL");
const c2 = playing.find(m => m.court === 2);
const c3 = playing.find(m => m.court === 3);
assert("schedule", !!c2 && c2.courtPool === "AB", "Court 2 = AB-pool match", c2 ? `Court 2 has ${c2.courtPool}` : "No Court 2", "CRITICAL");
assert("schedule", !!c3 && c3.courtPool === "AB", "Court 3 = AB-pool match", c3 ? `Court 3 has ${c3.courtPool}` : "No Court 3", "CRITICAL");

// Validate: no cross-court conflicts in playing matches
const playingPids = new Set<string>();
let crossConflict = false;
playing.forEach(m => {
  getMatchPlayerIds(m).forEach(id => {
    if (playingPids.has(id)) crossConflict = true;
    playingPids.add(id);
  });
});
assert("schedule", !crossConflict, "No cross-court conflicts in initial assignment", "Cross-court conflict in initial matches!", "CRITICAL");

// Validate: all matches have courtPool set
const noPool = matches.filter(m => !m.courtPool);
assert("schedule", noPool.length === 0, "All matches have courtPool", `${noPool.length} matches missing courtPool`, "HIGH");

// ═══════════════════════════════════════════════════════════════
//  PHASE 2: PLAY FIRST 6 GAMES (2 full slots)
// ═══════════════════════════════════════════════════════════════
console.log("\n── PHASE 2: Play First 6 Games ──");
let gamesCompleted = 0;
for (let round = 0; round < 6; round++) {
  const playingNow = matches.filter(m => m.status === "playing");
  if (playingNow.length === 0) { console.log("  ⚠️  No playing matches — courts stalled!"); break; }
  const m = playingNow[0];
  // Random winner
  const winnerId = Math.random() > 0.5 ? m.pair1.id : m.pair2.id;
  matches = completeMatch(matches, allPairs, m.id, winnerId, 3);
  gamesCompleted++;
}
assert("phase2", gamesCompleted === 6, `Completed ${gamesCompleted} games`, `Only ${gamesCompleted}/6 games completed — courts stalled!`, "CRITICAL");

// Check courts aren't stuck
const stillPlaying = matches.filter(m => m.status === "playing");
assert("phase2", stillPlaying.length >= 2, `${stillPlaying.length} courts active after 6 games`, "Courts stalled after phase 2!", "CRITICAL");

// ═══════════════════════════════════════════════════════════════
//  PHASE 3: REMOVE A NO-SHOW PLAYER
// ═══════════════════════════════════════════════════════════════
console.log("\n── PHASE 3: Remove No-Show Player (Folarin) ──");
const folarin = tA.find(p => p.name === "Folarin")!;
const folarinPair = allPairs.find(p => p.player1.id === folarin.id || p.player2.id === folarin.id);
const folarinPartner = folarinPair ? (folarinPair.player1.id === folarin.id ? folarinPair.player2 : folarinPair.player1) : null;
console.log(`  Removing: ${folarin.name} (A-tier), partner: ${folarinPartner?.name}`);

const removeResult = removePlayerMidSession(matches, allPairs, folarin.id, 3);
matches = removeResult.matches;
allPairs = removeResult.pairs;
console.log(`  Games voided: ${removeResult.removed}, remaining pairs: ${allPairs.length}`);

assert("remove", allPairs.length === 19, "19 pairs after removal", `${allPairs.length} pairs`, "CRITICAL");
assert("remove", !allPairs.find(p => p.player1.id === folarin.id || p.player2.id === folarin.id), "Folarin's pair removed", "Pair still exists!", "CRITICAL");

// Check no pending matches reference removed pair
const ghostMatches = matches.filter(m => m.status === "pending" && (
  getMatchPlayerIds(m).includes(folarin.id)
));
assert("remove", ghostMatches.length === 0, "No ghost matches with removed player", `${ghostMatches.length} matches still reference ${folarin.name}`, "CRITICAL");

// Check orphan partner got replacement matches
if (folarinPartner) {
  const partnerNewPair = allPairs.find(p => p.player1.id === folarinPartner.id || p.player2.id === folarinPartner.id);
  // Partner's pair was removed, they should NOT have a pair anymore (they're unpaired now)
  // But orphaned opponents of their OLD pair should have replacement matches
  const orphanedOpponents = matches.filter(m => m.status === "pending" && folarinPair && (
    (m.pair1.id !== folarinPair.id && m.pair2.id !== folarinPair.id) // only non-removed pair matches
  ));
  console.log(`  Orphan partner ${folarinPartner.name}: pair removed, ${orphanedOpponents.length} matches remain for other pairs`);
}

// Play 3 more games to confirm schedule isn't stuck after removal
let postRemoveGames = 0;
for (let i = 0; i < 3; i++) {
  const p = matches.filter(m => m.status === "playing");
  if (p.length === 0) break;
  const m = p[0];
  matches = completeMatch(matches, allPairs, m.id, m.pair1.id, 3);
  postRemoveGames++;
}
assert("remove", postRemoveGames === 3, `${postRemoveGames} games after removal`, "Courts stalled after player removal!", "CRITICAL");

// ═══════════════════════════════════════════════════════════════
//  PHASE 4: ADD A WALK-IN PLAYER (not on original roster)
// ═══════════════════════════════════════════════════════════════
console.log("\n── PHASE 4: Add Walk-In Player (Zara + Priya, C-tier) ──");
const zara = makePlayer("Zara", "C");
const priya = makePlayer("Priya", "C");
const walkInPair: Pair = { id: generateId(), player1: zara, player2: priya, skillLevel: "C", wins: 0, losses: 0 };
allPairs = [...allPairs, walkInPair];
matches = addLatePair(matches, allPairs, walkInPair, 3);
const zaraMatches = matches.filter(m => m.pair1.id === walkInPair.id || m.pair2.id === walkInPair.id);
console.log(`  New pair: ${zara.name} & ${priya.name} — ${zaraMatches.length} games scheduled`);
assert("walkin", zaraMatches.length >= 3, `Walk-in pair got ${zaraMatches.length} games`, `Only ${zaraMatches.length} games for walk-ins`, "HIGH");

// Check walk-in matches have correct courtPool
const walkInBadPool = zaraMatches.filter(m => m.courtPool !== "C");
assert("walkin", walkInBadPool.length === 0, "All walk-in C-tier matches are C-pool", `${walkInBadPool.length} walk-in matches have wrong pool`, "HIGH");

// ═══════════════════════════════════════════════════════════════
//  PHASE 5: LATE ARRIVAL (B-tier pair after games started)
// ═══════════════════════════════════════════════════════════════
console.log("\n── PHASE 5: Late B-tier Arrival (Tunde & Kola) ──");
const tunde = makePlayer("Tunde", "B");
const kola = makePlayer("Kola", "B");
const latePair: Pair = { id: generateId(), player1: tunde, player2: kola, skillLevel: "B", wins: 0, losses: 0 };
allPairs = [...allPairs, latePair];
matches = addLatePair(matches, allPairs, latePair, 3);
const lateMatches = matches.filter(m => m.pair1.id === latePair.id || m.pair2.id === latePair.id);
console.log(`  Late pair: ${tunde.name} & ${kola.name} — ${lateMatches.length} games scheduled`);
assert("late", lateMatches.length >= 3, `Late B-pair got ${lateMatches.length} games`, `Only ${lateMatches.length} games`, "HIGH");

// Check late B matches are AB-pool
const lateBadPool = lateMatches.filter(m => m.courtPool !== "AB");
assert("late", lateBadPool.length === 0, "All late B-tier matches are AB-pool", `${lateBadPool.length} late matches have wrong pool`, "HIGH");

// Play 3 games — check equity gate doesn't deadlock with new 0-game pair
let lateGames = 0;
for (let i = 0; i < 3; i++) {
  const p = matches.filter(m => m.status === "playing");
  if (p.length === 0) break;
  const m = p[0];
  matches = completeMatch(matches, allPairs, m.id, m.pair2.id, 3);
  lateGames++;
}
assert("late", lateGames === 3, `${lateGames} games after late arrival`, "Courts deadlocked after late arrival (equity gate bug)!", "CRITICAL");

// ═══════════════════════════════════════════════════════════════
//  PHASE 6: SWAP PLAYER IN EXISTING PAIR
// ═══════════════════════════════════════════════════════════════
console.log("\n── PHASE 6: Swap Player in Pair (replace Segun with Adebayo) ──");
const segun = tB.find(p => p.name === "Segun")!;
const segunPair = allPairs.find(p => p.player1.id === segun.id || p.player2.id === segun.id);
if (segunPair) {
  // Check Segun isn't currently playing
  const segunPlaying = matches.some(m => m.status === "playing" && getMatchPlayerIds(m).includes(segun.id));
  if (segunPlaying) {
    console.log("  Segun is currently playing — complete his match first");
    const segunMatch = matches.find(m => m.status === "playing" && getMatchPlayerIds(m).includes(segun.id))!;
    matches = completeMatch(matches, allPairs, segunMatch.id, segunMatch.pair1.id, 3);
  }

  const adebayo = makePlayer("Adebayo", "B");
  // Replace Segun with Adebayo in the pair
  const updatedPair = segunPair.player1.id === segun.id
    ? { ...segunPair, player1: adebayo }
    : { ...segunPair, player2: adebayo };
  allPairs = allPairs.map(p => p.id === segunPair.id ? updatedPair : p);

  // Update all non-completed matches referencing this pair
  matches = matches.map(m => {
    if (m.status === "completed") return m;
    if (m.pair1.id === segunPair.id) return { ...m, pair1: updatedPair };
    if (m.pair2.id === segunPair.id) return { ...m, pair2: updatedPair };
    return m;
  });

  // Verify swap
  const segunStill = allPairs.some(p => p.player1.id === segun.id || p.player2.id === segun.id);
  const adebayoIn = allPairs.some(p => p.player1.id === adebayo.id || p.player2.id === adebayo.id);
  assert("swap", !segunStill, "Segun no longer in any pair", "Segun still in a pair!", "HIGH");
  assert("swap", adebayoIn, "Adebayo now in a pair", "Adebayo not found in pairs!", "HIGH");
  console.log(`  Swapped: ${segun.name} → ${adebayo.name} in pair with ${segunPair.player1.id === segun.id ? segunPair.player2.name : segunPair.player1.name}`);
} else {
  console.log("  ⚠️  Could not find Segun's pair (may have been disrupted by removal)");
}

// ═══════════════════════════════════════════════════════════════
//  PHASE 7: RUN ALL REMAINING GAMES
// ═══════════════════════════════════════════════════════════════
console.log("\n── PHASE 7: Complete All Remaining Games ──");
let totalCompleted = matches.filter(m => m.status === "completed").length;
let stallCount = 0;
let maxIterations = 200;
while (maxIterations-- > 0) {
  const playing = matches.filter(m => m.status === "playing");
  const pending = matches.filter(m => m.status === "pending");
  if (playing.length === 0 && pending.length === 0) break;
  if (playing.length === 0 && pending.length > 0) {
    stallCount++;
    if (stallCount > 3) {
      fail("runall", `Courts permanently stalled with ${pending.length} pending matches`, "CRITICAL");
      break;
    }
    // Try to assign pending matches to free courts
    for (let court = 1; court <= 3; court++) {
      const next = findNextPendingForCourt(matches, court, 3, new Set(), allPairs);
      if (next) {
        const ni = matches.findIndex(m => m.id === next.id);
        if (ni !== -1) matches[ni] = { ...next, status: "playing", court, startedAt: new Date().toISOString() };
      }
    }
    continue;
  }
  stallCount = 0;
  const m = playing[0];
  const winnerId = Math.random() > 0.5 ? m.pair1.id : m.pair2.id;
  matches = completeMatch(matches, allPairs, m.id, winnerId, 3);
  totalCompleted++;
}

const finalCompleted = matches.filter(m => m.status === "completed").length;
const finalPending = matches.filter(m => m.status === "pending").length;
const finalPlaying = matches.filter(m => m.status === "playing").length;
console.log(`  Completed: ${finalCompleted}, Pending: ${finalPending}, Playing: ${finalPlaying}`);
assert("runall", finalPending === 0 && finalPlaying === 0, "All games completed", `${finalPending} pending + ${finalPlaying} playing remain`, "CRITICAL");
assert("runall", finalCompleted >= 30, `${finalCompleted} total games completed`, `Only ${finalCompleted} games`, "HIGH");

// Check game distribution — no pair should have 0 completed games (except removed pair)
const pairGames = new Map<string, number>();
allPairs.forEach(p => pairGames.set(p.id, 0));
matches.filter(m => m.status === "completed").forEach(m => {
  pairGames.set(m.pair1.id, (pairGames.get(m.pair1.id) || 0) + 1);
  pairGames.set(m.pair2.id, (pairGames.get(m.pair2.id) || 0) + 1);
});
const zeroPairs = allPairs.filter(p => (pairGames.get(p.id) || 0) === 0);
assert("runall", zeroPairs.length === 0, "All pairs played at least 1 game", `${zeroPairs.length} pairs with 0 games: ${zeroPairs.map(p => p.player1.name + " & " + p.player2.name).join(", ")}`, "CRITICAL");

const gamesList = allPairs.map(p => ({ name: `${p.player1.name} & ${p.player2.name}`, games: pairGames.get(p.id) || 0 }));
gamesList.sort((a, b) => a.games - b.games);
const minPG = gamesList[0]?.games || 0;
const maxPG = gamesList[gamesList.length - 1]?.games || 0;
console.log(`  Game range: min=${minPG}, max=${maxPG}`);
console.log(`  Lowest: ${gamesList.slice(0, 3).map(g => `${g.name}(${g.games})`).join(", ")}`);
console.log(`  Highest: ${gamesList.slice(-3).map(g => `${g.name}(${g.games})`).join(", ")}`);
assert("runall", maxPG - minPG <= 3, `Equity gap ${maxPG - minPG} (<= 3)`, `Equity gap ${maxPG - minPG} is too large`, "HIGH");

// ═══════════════════════════════════════════════════════════════
//  PHASE 8: 3-COURT ROUTING VALIDATION
// ═══════════════════════════════════════════════════════════════
console.log("\n── PHASE 8: 3-Court Pool Routing Validation ──");
const completedMatches = matches.filter(m => m.status === "completed");
let courtRouteErrors = 0;
// We can't check runtime court assignment directly (since we simplified completeMatch),
// but we can verify no C-pool match was ever assigned to Court 2/3 and vice versa
for (const m of completedMatches) {
  if (!m.court) continue;
  const pool = m.courtPool || ((m.skillLevel === "C" || m.matchupLabel === "B vs C") ? "C" : "AB");
  if (m.court === 1 && pool !== "C") courtRouteErrors++;
  if ((m.court === 2 || m.court === 3) && pool !== "AB") courtRouteErrors++;
}
assert("routing", courtRouteErrors === 0, "All court assignments match pool routing", `${courtRouteErrors} court-pool mismatches`, "CRITICAL");

// ═══════════════════════════════════════════════════════════════
//  PHASE 9: PLAYOFFS
// ═══════════════════════════════════════════════════════════════
console.log("\n── PHASE 9: Playoff Seeding & Bracket ──");
const standings = buildStandings(matches);
assert("playoffs", standings.length >= 8, `${standings.length} pairs have standings`, "Fewer than 8 pairs with stats", "HIGH");

const playoffResult = runPlayoffs(standings);
const { champion, rounds } = playoffResult;
console.log(`  Rounds: ${rounds.length}`);
rounds.forEach((r, i) => {
  console.log(`  Round ${i + 1}: ${r.length} match(es)`);
  r.forEach(m => {
    const p1 = m.pair1 ? `${m.pair1.player1.name}&${m.pair1.player2.name}` : "BYE";
    const p2 = m.pair2 ? `${m.pair2.player1.name}&${m.pair2.player2.name}` : "BYE";
    const w = m.winner ? `${m.winner.player1.name}&${m.winner.player2.name}` : "TBD";
    console.log(`    ${p1} vs ${p2} → Winner: ${w}`);
  });
});
assert("playoffs", !!champion, `Champion: ${champion.player1.name} & ${champion.player2.name}`, "No champion determined!", "CRITICAL");
assert("playoffs", rounds.length >= 2, `${rounds.length} playoff rounds`, "Fewer than 2 rounds", "HIGH");

// ═══════════════════════════════════════════════════════════════
//  PHASE 10: EDGE CASES
// ═══════════════════════════════════════════════════════════════
console.log("\n── PHASE 10: Edge Cases ──");

// 10a: Remove player who is currently playing
console.log("  10a: Attempt remove on playing player");
// Create a fresh playing scenario
let edgeMatches: Match[] = [{
  id: generateId(), pair1: allPairs[0], pair2: allPairs[1],
  skillLevel: allPairs[0].skillLevel, matchupLabel: `${allPairs[0].skillLevel} vs ${allPairs[1].skillLevel}`,
  status: "playing", court: 2, courtPool: "AB", startedAt: new Date().toISOString(),
}];
const playingPlayer = allPairs[0].player1;
const edgeResult = removePlayerMidSession(edgeMatches, allPairs, playingPlayer.id, 3);
// Should auto-forfeit
const forfeitedMatch = edgeResult.matches.find(m => m.status === "completed" && m.winner);
assert("edge", !!forfeitedMatch, "Auto-forfeited playing match on removal", "Playing match not forfeited!", "CRITICAL");
if (forfeitedMatch) {
  assert("edge", forfeitedMatch.winner!.id !== allPairs[0].id, "Opponent won by forfeit", "Wrong forfeit winner", "HIGH");
}

// 10b: Double removal
console.log("  10b: Double removal of same player");
const doubleResult = removePlayerMidSession(edgeResult.matches, edgeResult.pairs, playingPlayer.id, 3);
assert("edge", doubleResult.pairs.length === edgeResult.pairs.length, "Double removal is idempotent", "Pairs changed on double removal!", "HIGH");

// 10c: Add pair with 0 existing same-tier opponents
console.log("  10c: Add pair to empty tier");
const lonely1 = makePlayer("Lonely1", "C");
const lonely2 = makePlayer("Lonely2", "C");
const lonelyPair: Pair = { id: generateId(), player1: lonely1, player2: lonely2, skillLevel: "C", wins: 0, losses: 0 };
const emptyTierPairs = [lonelyPair]; // only pair in "C" for this test
const lonelyMatches = addLatePair([], emptyTierPairs, lonelyPair, 3);
assert("edge", lonelyMatches.length === 0, "No matches for solo pair (no opponents)", `Got ${lonelyMatches.length} matches`, "LOW");

// 10d: Massive pair count — 21 pairs equity gate
console.log("  10d: Equity gate with 21 pairs");
const megaPairs: Pair[] = [];
for (let i = 0; i < 21; i++) {
  megaPairs.push({
    id: generateId(),
    player1: makePlayer(`MegaA${i}`, "A"),
    player2: makePlayer(`MegaB${i}`, "A"),
    skillLevel: "A", wins: 0, losses: 0,
  });
}
const megaSched = generateSchedule(megaPairs, megaPairs, [], [], 2);
assert("edge", megaSched.schedule.length > 0, `21-pair schedule: ${megaSched.schedule.length} games`, "0 games for 21 pairs!", "CRITICAL");
const megaCounts = Array.from(megaSched.pairGameCount.values());
const megaMin = Math.min(...megaCounts);
const megaMax = Math.max(...megaCounts);
assert("edge", megaMax - megaMin <= 2, `21-pair equity: min=${megaMin} max=${megaMax}`, `Equity gap ${megaMax - megaMin}`, "HIGH");

// 10e: Remove all C-tier pairs, check AB courts still work
console.log("  10e: All C pairs finish, Courts 2-3 should still assign");
let cExhaust: Match[] = [
  { id: generateId(), pair1: allPairs.find(p => p.skillLevel === "A")!, pair2: allPairs.filter(p => p.skillLevel === "A")[1], skillLevel: "A", matchupLabel: "A vs A", status: "pending", court: null, courtPool: "AB" },
  { id: generateId(), pair1: allPairs.filter(p => p.skillLevel === "A")[2], pair2: allPairs.filter(p => p.skillLevel === "A")[3], skillLevel: "A", matchupLabel: "A vs A", status: "pending", court: null, courtPool: "AB" },
];
const cExhaustPairs = allPairs.filter(p => p.skillLevel === "A").slice(0, 4);
// Free court 2, should find an AB match
const nextAB = findNextPendingForCourt(cExhaust, 2, 3, new Set(), cExhaustPairs);
assert("edge", !!nextAB, "Court 2 finds AB match when C-pool empty", "Court 2 stalled!", "HIGH");
// Free court 1, should find nothing (no C matches)
const nextC = findNextPendingForCourt(cExhaust, 1, 3, new Set(), cExhaustPairs);
assert("edge", !nextC, "Court 1 correctly idles when no C matches", "Court 1 found non-C match!", "HIGH");

// ═══════════════════════════════════════════════════════════════
//  RESULTS
// ═══════════════════════════════════════════════════════════════
console.log("\n══════════════════════════════════════════════════════");
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log("══════════════════════════════════════════════════════");

if (failures.length > 0) {
  console.log("\n  FAILURES:");
  const critical = failures.filter(f => f.severity === "CRITICAL");
  const high = failures.filter(f => f.severity === "HIGH");
  const low = failures.filter(f => f.severity === "LOW");
  if (critical.length) { console.log(`\n  🔴 CRITICAL (${critical.length}):`); critical.forEach(f => console.log(`     [${f.phase}] ${f.msg}`)); }
  if (high.length) { console.log(`\n  🟡 HIGH (${high.length}):`); high.forEach(f => console.log(`     [${f.phase}] ${f.msg}`)); }
  if (low.length) { console.log(`\n  🔵 LOW (${low.length}):`); low.forEach(f => console.log(`     [${f.phase}] ${f.msg}`)); }
}

console.log("\n  Session summary:");
console.log(`  • ${allPlayers.length} players checked in`);
console.log(`  • ${allPairs.length} pairs (after adds/removes)`);
console.log(`  • ${finalCompleted} round-robin games completed`);
console.log(`  • ${rounds.reduce((a, r) => a + r.length, 0)} playoff games`);
console.log(`  • Champion: ${champion.player1.name} & ${champion.player2.name}`);
console.log("");

process.exit(failed > 0 ? 1 : 0);
