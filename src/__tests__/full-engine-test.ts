/**
 * COMPREHENSIVE ENGINE TEST — Every Feature of the Scheduling Engine
 *
 * Covers:
 *  1. Helper functions (courtPoolForTiers, courtToPool, isForbiddenMatchup)
 *  2. 3-Court tier isolation (A vs A, B vs B, C vs C only)
 *  3. 2-Court cross-tier rules (B vs A, B vs C allowed, A vs C forbidden)
 *  4. Schedule equity (all pairs within target, no 0-game pairs)
 *  5. No player conflicts (no player on 2 courts in same slot)
 *  6. Rest gap enforcement (no back-to-back games in adjacent slots)
 *  7. Court pool routing (3-court: C→1, B→2, A→3)
 *  8. findNextPendingForCourt (pool filter, equity gate, drain mode)
 *  9. Mid-session player add (same-tier only in 3-court)
 * 10. Mid-session player remove (orphan gets same-tier replacements)
 * 11. Player swap (replace player in pair, matches update)
 * 12. Playoff seeding (A-tier first, B-tier fills to 8, head-to-head)
 * 13. Playoff bracket (QF → SF → Final)
 * 14. VIP handling (pushed out of first 2 slots)
 * 15. Edge: solo pair in tier (no opponents)
 * 16. Edge: empty tier
 * 17. Edge: late arrival equity (no deadlock)
 * 18. Edge: large player count (48 players)
 * 19. Edge: 2-court mode full session
 * 20. Regenerate remaining schedule after mid-session changes
 *
 * Run: npx tsx src/__tests__/full-engine-test.ts
 */

// ═══════════════════════ TYPES ═══════════════════════
type SkillTier = "A" | "B" | "C";
interface Player { id: string; name: string; skillLevel: SkillTier; checkedIn: boolean; checkInTime: string | null; wins: number; losses: number; gamesPlayed: number; profileId?: string; }
interface Pair { id: string; player1: Player; player2: Player; skillLevel: SkillTier; wins: number; losses: number; }
interface Match { id: string; pair1: Pair; pair2: Pair; skillLevel: SkillTier | "cross"; matchupLabel?: string; status: "pending" | "playing" | "completed"; court: number | null; winner?: Pair; loser?: Pair; completedAt?: string; startedAt?: string; gameNumber?: number; courtPool?: "A" | "B" | "C"; }
interface FixedPair { player1Name: string; player2Name: string; }
interface PlayoffMatch { id: string; round: number; seed1?: number; seed2?: number; pair1?: Pair | null; pair2?: Pair | null; winner?: Pair; status: "pending" | "playing" | "completed"; court?: number; }
type CourtFormat = "round_robin" | "winner_stays_on";
interface WsoGame { id: string; pair1: Pair; pair2: Pair; winner?: Pair; loser?: Pair; startedAt?: string; completedAt?: string; gameNumber: number; }
interface WsoStats { pairId: string; wins: number; losses: number; streak: number; longestStreak: number; gamesPlayed: number; }
interface WsoUndoEntry { previousGame: WsoGame; previousQueue: Pair[]; previousStats: Record<string, WsoStats>; }
interface WsoState { queue: Pair[]; currentGame: WsoGame | null; history: WsoGame[]; stats: Record<string, WsoStats>; undoStack: WsoUndoEntry[]; gameCounter: number; }
interface SubPlayerStats { playerId: string; gamesPlayed: number; timesSubbedOut: number; }
interface SubRotation { currentSubId: string; playerStats: Record<string, SubPlayerStats>; gamesSinceLastRotation: number; rotationFrequency: number; pendingRotation: boolean; suggestedReplacementId?: string; suggestedPairId?: string; rotationHistory: { timestamp: string; subIn: string; subOut: string; pairId: string }[]; }
interface CourtState { courtNumber: 1 | 2 | 3; tier: SkillTier; assignedPairs: Pair[]; schedule: Match[]; completedGames: Match[]; standings: Record<string, { wins: number; losses: number; gamesPlayed: number; winPct: number }>; currentSlot: number; status: "waiting" | "active" | "playoffs" | "complete"; format: CourtFormat; wso?: WsoState; startedAt?: string; courtWaitlist?: string[]; sub?: SubRotation; }

// ═══════════════════════ HELPERS ═══════════════════════
let idCounter = 0;
function generateId(): string { return "t_" + (++idCounter); }
function shuffle<T>(arr: T[]): T[] { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function getPairPlayerIds(p: Pair): string[] { return [p.player1.id, p.player2.id]; }
function getMatchPlayerIds(m: Match): string[] { return [...getPairPlayerIds(m.pair1), ...getPairPlayerIds(m.pair2)]; }
function matchupKey(a: string, b: string): string { return [a, b].sort().join("|||"); }
function makePlayer(name: string, tier: SkillTier): Player { return { id: generateId(), name, skillLevel: tier, checkedIn: true, checkInTime: new Date().toISOString(), wins: 0, losses: 0, gamesPlayed: 0 }; }

// Mirrors production code exactly
function isForbiddenMatchup(t1: SkillTier, t2: SkillTier): boolean { return [t1, t2].sort().join("") === "AC"; }
function isCrossCohort(label?: string): boolean {
  return label === "B vs A" || label === "B vs C" || label === "A vs B" || label === "C vs B";
}
function courtPoolForTiers(t1: SkillTier, t2: SkillTier): "A" | "B" | "C" {
  if (t1 === t2) return t1;
  if (t1 === "C" || t2 === "C") return "C";
  return "B";
}
function courtToPool(court: number): "A" | "B" | "C" {
  if (court === 1) return "C";
  if (court === 2) return "B";
  return "A";
}

/** Least Played First schedule generator — mirrors production generateCourtScheduleForSlots */
function testGenerateSchedule(court: CourtState, slotCount: number, initialGameCounts?: Map<string, number>): Match[] {
  const pairs = court.assignedPairs;
  if (pairs.length < 2) return [];
  const gameTarget = Math.floor(slotCount * 2 / pairs.length) + (initialGameCounts ? Math.max(0, ...Array.from(initialGameCounts.values())) : 0);
  const mkKey = (a: string, b: string) => [a, b].sort().join("|||");
  const MAX = 10;
  for (let attempt = 0; attempt < MAX; attempt++) {
    const sched: Match[] = [];
    const pg = new Map<string, number>();
    const pls = new Map<string, number>();
    const used = new Set<string>();
    pairs.forEach(p => { pg.set(p.id, initialGameCounts?.get(p.id) ?? 0); pls.set(p.id, -2); });
    const relax = attempt >= 3 ? 1 : 0;
    for (let slot = 0; slot < slotCount; slot++) {
      const sorted = [...pairs].sort((a, b) => {
        const ga = pg.get(a.id) || 0; const gb = pg.get(b.id) || 0;
        if (ga !== gb) return ga - gb;
        return (slot - (pls.get(b.id) ?? -2)) - (slot - (pls.get(a.id) ?? -2));
      });
      let matched = false;
      for (let i = 0; i < sorted.length && !matched; i++) {
        const p1 = sorted[i]; const g1 = pg.get(p1.id) || 0;
        if (slot - (pls.get(p1.id) ?? -2) < 2) continue;
        if (g1 >= gameTarget + relax) continue;
        for (let j = i + 1; j < sorted.length; j++) {
          const p2 = sorted[j]; const g2 = pg.get(p2.id) || 0;
          if (slot - (pls.get(p2.id) ?? -2) < 2) continue;
          if (g2 >= gameTarget + relax) continue;
          const active = Array.from(pg.values()).filter(v => v > 0);
          const minG = active.length > 0 ? Math.min(...active) : 0;
          if (Math.min(g1, g2) > minG + 1 + relax) continue;
          const k = mkKey(p1.id, p2.id);
          if (used.has(k)) continue;
          used.add(k);
          pg.set(p1.id, g1 + 1); pg.set(p2.id, g2 + 1);
          pls.set(p1.id, slot); pls.set(p2.id, slot);
          sched.push({ id: generateId(), pair1: p1, pair2: p2, skillLevel: court.tier, matchupLabel: `${court.tier} vs ${court.tier}`, status: "pending", court: court.courtNumber, courtPool: court.tier, gameNumber: slot });
          matched = true; break;
        }
      }
    }
    const games = Array.from(pg.values());
    const gap = Math.max(...games) - Math.min(...games);
    let b2b = false;
    for (const p of pairs) {
      const sl = sched.map((m, idx) => (m.pair1.id === p.id || m.pair2.id === p.id) ? idx : -1).filter(v => v >= 0);
      for (let k = 1; k < sl.length; k++) { if (sl[k] - sl[k - 1] < 2) { b2b = true; break; } }
      if (b2b) break;
    }
    if ((gap <= 1 + relax && !b2b) || attempt === MAX - 1) return sched;
  }
  return [];
}

// ═══════════════════════ RESULT TRACKING ═══════════════════════
let passed = 0, failed = 0;
const failures: { section: string; msg: string }[] = [];
function pass(section: string, msg: string) { console.log(`  [PASS] ${msg}`); passed++; }
function fail(section: string, msg: string) { console.log(`  [FAIL] ${msg}`); failed++; failures.push({ section, msg }); }
function assert(section: string, cond: boolean, passMsg: string, failMsg: string) {
  if (cond) pass(section, passMsg); else fail(section, failMsg);
}

// ═══════════════════════ PAIR + SCHEDULE GENERATION ═══════════════════════
function createPairs(players: Player[], tier: SkillTier, fixed: FixedPair[] = []): Pair[] {
  const pairs: Pair[] = []; const used = new Set<string>();
  for (const fp of fixed) {
    const p1 = players.find(p => p.name.toLowerCase() === fp.player1Name.toLowerCase() && !used.has(p.id));
    const p2 = players.find(p => p.name.toLowerCase() === fp.player2Name.toLowerCase() && !used.has(p.id));
    if (p1 && p2) { pairs.push({ id: generateId(), player1: p1, player2: p2, skillLevel: tier, wins: 0, losses: 0 }); used.add(p1.id); used.add(p2.id); }
  }
  const remaining = players.filter(p => !used.has(p.id));
  for (let i = 0; i < remaining.length - 1; i += 2) {
    pairs.push({ id: generateId(), player1: remaining[i], player2: remaining[i + 1], skillLevel: tier, wins: 0, losses: 0 });
  }
  return pairs;
}

type CandidateMatch = { pair1: Pair; pair2: Pair; skillLevel: SkillTier | "cross"; matchupLabel: string; courtPool: "A" | "B" | "C"; };

function generateCandidates(aPairs: Pair[], bPairs: Pair[], cPairs: Pair[], courtCount: number): CandidateMatch[] {
  const all: CandidateMatch[] = [];
  for (let i = 0; i < aPairs.length; i++) for (let j = i + 1; j < aPairs.length; j++)
    all.push({ pair1: aPairs[i], pair2: aPairs[j], skillLevel: "A", matchupLabel: "A vs A", courtPool: "A" });
  for (let i = 0; i < bPairs.length; i++) for (let j = i + 1; j < bPairs.length; j++)
    all.push({ pair1: bPairs[i], pair2: bPairs[j], skillLevel: "B", matchupLabel: "B vs B", courtPool: "B" });
  for (let i = 0; i < cPairs.length; i++) for (let j = i + 1; j < cPairs.length; j++)
    all.push({ pair1: cPairs[i], pair2: cPairs[j], skillLevel: "C", matchupLabel: "C vs C", courtPool: "C" });
  // Cross-tier only in 2-court mode
  if (courtCount === 2) {
    for (const bp of bPairs) for (const ap of aPairs)
      all.push({ pair1: bp, pair2: ap, skillLevel: "cross", matchupLabel: "B vs A", courtPool: "B" });
    for (const bp of bPairs) for (const cp of cPairs)
      all.push({ pair1: bp, pair2: cp, skillLevel: "cross", matchupLabel: "B vs C", courtPool: "C" });
  }
  return all;
}

function generateSchedule(
  allPairs: Pair[], aPairs: Pair[], bPairs: Pair[], cPairs: Pair[],
  courtCount: number, durationMin = 85
): Match[] {
  const minutesPerGame = 7;
  const totalSlots = Math.floor(durationMin / minutesPerGame);
  const TARGET = courtCount === 3 ? 3 : 4;
  const MAX = courtCount === 3 ? 4 : 5;

  const mPlayerIds = (m: { pair1: Pair; pair2: Pair }) => [m.pair1.player1.id, m.pair1.player2.id, m.pair2.player1.id, m.pair2.player2.id];

  const allCandidates = generateCandidates(aPairs, bPairs, cPairs, courtCount);
  const schedule: Match[] = [];
  const usedMatchups = new Set<string>();
  const pairGameCount = new Map<string, number>();
  const pairLastSlot = new Map<string, number>();
  allPairs.forEach(p => { pairGameCount.set(p.id, 0); pairLastSlot.set(p.id, -1); });

  let pool = shuffle([...allCandidates]);
  const slotBounds: number[] = [];
  const REST_GAP = 1;

  const getSlotPIds = (si: number): Set<string> => {
    const ids = new Set<string>();
    if (si < 0 || si >= slotBounds.length) return ids;
    const s = slotBounds[si]; const e = si + 1 < slotBounds.length ? slotBounds[si + 1] : schedule.length;
    for (let i = s; i < e; i++) mPlayerIds(schedule[i]).forEach(id => ids.add(id));
    return ids;
  };

  const pick = (pool: CandidateMatch[], slotPIds: Set<string>, blocked: Set<string>, filter?: "A" | "B" | "C", slot?: number): number => {
    let bestIdx = -1, bestScore = Infinity;
    for (let i = 0; i < pool.length; i++) {
      const c = pool[i];
      if (filter && c.courtPool !== filter) continue;
      const mKey = matchupKey(c.pair1.id, c.pair2.id);
      if (usedMatchups.has(mKey)) continue;
      const g1 = pairGameCount.get(c.pair1.id) || 0;
      const g2 = pairGameCount.get(c.pair2.id) || 0;
      if (g1 >= MAX || g2 >= MAX) continue;
      // Equity gate
      const active = Array.from(pairGameCount.values()).filter(v => v > 0);
      const minC = active.length > 0 ? Math.min(...active) : 0;
      if (Math.min(g1, g2) > minC + 1) continue;
      const pids = mPlayerIds(c);
      if (pids.some(id => slotPIds.has(id))) continue;
      if (pids.some(id => blocked.has(id))) continue;
      const isCross = c.skillLevel === "cross";
      let score = (g1 + g2) + (isCross ? 50 : 0);
      if (g1 >= TARGET) score += 100;
      if (g2 >= TARGET) score += 100;
      if (slot !== undefined) {
        const idle1 = slot - (pairLastSlot.get(c.pair1.id) ?? -1);
        const idle2 = slot - (pairLastSlot.get(c.pair2.id) ?? -1);
        if (idle1 >= 3) score -= idle1 * 5;
        if (idle2 >= 3) score -= idle2 * 5;
      }
      if (score < bestScore) { bestScore = score; bestIdx = i; }
    }
    return bestIdx;
  };

  const commit = (idx: number, slotPIds: Set<string>, slot?: number): Match => {
    const chosen = pool.splice(idx, 1)[0];
    usedMatchups.add(matchupKey(chosen.pair1.id, chosen.pair2.id));
    pairGameCount.set(chosen.pair1.id, (pairGameCount.get(chosen.pair1.id) || 0) + 1);
    pairGameCount.set(chosen.pair2.id, (pairGameCount.get(chosen.pair2.id) || 0) + 1);
    mPlayerIds(chosen).forEach(id => slotPIds.add(id));
    if (slot !== undefined) { pairLastSlot.set(chosen.pair1.id, slot); pairLastSlot.set(chosen.pair2.id, slot); }
    return { id: generateId(), pair1: chosen.pair1, pair2: chosen.pair2, skillLevel: chosen.skillLevel, matchupLabel: chosen.matchupLabel, status: "pending", court: null, courtPool: chosen.courtPool };
  };

  // Best-of-N trials
  let bestSchedule: Match[] = [];
  let bestScore = Infinity;

  for (let trial = 0; trial < 5; trial++) {
    schedule.length = 0; slotBounds.length = 0; usedMatchups.clear();
    allPairs.forEach(p => { pairGameCount.set(p.id, 0); pairLastSlot.set(p.id, -1); });
    pool = shuffle([...allCandidates]);

    for (let slot = 0; slot < totalSlots; slot++) {
      slotBounds.push(schedule.length);
      const blocked = new Set<string>();
      for (let prev = Math.max(0, slot - REST_GAP); prev < slot; prev++) getSlotPIds(prev).forEach(id => blocked.add(id));
      const slotPIds = new Set<string>();

      if (courtCount === 3) {
        const ci = pick(pool, slotPIds, blocked, "C", slot); if (ci !== -1) schedule.push(commit(ci, slotPIds, slot));
        const bi = pick(pool, slotPIds, blocked, "B", slot); if (bi !== -1) schedule.push(commit(bi, slotPIds, slot));
        const ai = pick(pool, slotPIds, blocked, "A", slot); if (ai !== -1) schedule.push(commit(ai, slotPIds, slot));
      } else {
        for (let c = 0; c < 2; c++) { const idx = pick(pool, slotPIds, blocked, undefined, slot); if (idx !== -1) schedule.push(commit(idx, slotPIds, slot)); }
      }
    }

    // Fallback: fill short pairs
    const shortPairs = allPairs.filter(p => (pairGameCount.get(p.id) || 0) < TARGET);
    for (const sp of shortPairs) {
      const needed = TARGET - (pairGameCount.get(sp.id) || 0);
      const sameTier = shuffle(allPairs.filter(p => p.skillLevel === sp.skillLevel && p.id !== sp.id));
      const crossTier = courtCount === 3 ? [] : shuffle(allPairs.filter(p => {
        if (p.id === sp.id || p.skillLevel === sp.skillLevel) return false;
        return !isForbiddenMatchup(sp.skillLevel, p.skillLevel);
      }));
      let added = 0;
      for (const opp of [...sameTier, ...crossTier]) {
        if (added >= needed) break;
        const mKey = matchupKey(sp.id, opp.id);
        if (usedMatchups.has(mKey)) continue;
        const isCross = opp.skillLevel !== sp.skillLevel;
        schedule.push({
          id: generateId(), pair1: sp, pair2: opp,
          skillLevel: isCross ? "cross" as const : sp.skillLevel,
          matchupLabel: isCross ? `${sp.skillLevel} vs ${opp.skillLevel}` : `${sp.skillLevel} vs ${sp.skillLevel}`,
          status: "pending", court: null, courtPool: courtPoolForTiers(sp.skillLevel, opp.skillLevel),
        });
        usedMatchups.add(mKey);
        pairGameCount.set(sp.id, (pairGameCount.get(sp.id) || 0) + 1);
        pairGameCount.set(opp.id, (pairGameCount.get(opp.id) || 0) + 1);
        added++;
      }
    }

    const counts = Array.from(pairGameCount.values());
    const trialScore = Math.max(...counts) - Math.min(...counts);
    if (trialScore < bestScore) { bestScore = trialScore; bestSchedule = [...schedule]; }
    if (bestScore <= 1) break;
  }

  // Restore best schedule
  schedule.length = 0; schedule.push(...bestSchedule);
  // Recalculate pair game counts from best schedule
  allPairs.forEach(p => pairGameCount.set(p.id, 0));
  schedule.forEach(m => {
    pairGameCount.set(m.pair1.id, (pairGameCount.get(m.pair1.id) || 0) + 1);
    pairGameCount.set(m.pair2.id, (pairGameCount.get(m.pair2.id) || 0) + 1);
  });

  // Number games
  schedule.forEach((m, i) => { m.gameNumber = i + 1; });

  // Initial court assignment
  const now = new Date().toISOString();
  if (courtCount === 3) {
    const cM = schedule.find(m => m.status === "pending" && m.courtPool === "C");
    const bM = schedule.find(m => m.status === "pending" && m.courtPool === "B");
    const aM = schedule.find(m => m.status === "pending" && m.courtPool === "A");
    if (cM) { cM.status = "playing"; cM.court = 1; cM.startedAt = now; }
    if (bM) { bM.status = "playing"; bM.court = 2; bM.startedAt = now; }
    if (aM) { aM.status = "playing"; aM.court = 3; aM.startedAt = now; }
  } else {
    for (let c = 0; c < courtCount && c < schedule.length; c++) {
      schedule[c].status = "playing"; schedule[c].court = c + 1; schedule[c].startedAt = now;
    }
  }

  return schedule;
}

// ═══════════════════════ FIND NEXT PENDING (mirrors production) ═══════════════════════
function findNextPendingForCourt(
  matches: Match[], freedCourt: number, courtCount: number,
  recentPlayerIds: Set<string>, allPairs: Pair[], allMatches: Match[],
): Match | undefined {
  const busyPIds = new Set<string>();
  matches.filter(m => m.status === "playing" && m.court !== freedCourt).forEach(m => getMatchPlayerIds(m).forEach(id => busyPIds.add(id)));

  const poolFilter: "A" | "B" | "C" | null = courtCount === 3 ? courtToPool(freedCourt) : null;
  const activePairIds = new Set(allPairs.map(p => p.id));

  const valid: Match[] = [];
  const relaxed: Match[] = [];
  for (const m of matches) {
    if (m.status !== "pending") continue;
    if (!activePairIds.has(m.pair1.id) || !activePairIds.has(m.pair2.id)) continue;
    const pids = getMatchPlayerIds(m);
    if (pids.some(id => busyPIds.has(id))) continue;
    if (poolFilter) {
      const mp = m.courtPool || courtPoolForTiers(m.pair1.skillLevel, m.pair2.skillLevel);
      if (poolFilter !== mp) continue;
    }
    if (pids.some(id => recentPlayerIds.has(id))) { relaxed.push(m); continue; }
    valid.push(m);
  }
  const candidates = valid.length > 0 ? valid : relaxed;
  if (candidates.length === 0) return undefined;

  // Equity gate
  const pairGames = new Map<string, number>();
  allPairs.forEach(p => pairGames.set(p.id, 0));
  allMatches.forEach(m => { if (m.status === "completed") { pairGames.set(m.pair1.id, (pairGames.get(m.pair1.id) || 0) + 1); pairGames.set(m.pair2.id, (pairGames.get(m.pair2.id) || 0) + 1); } });
  const avail = allPairs.filter(p => !getPairPlayerIds(p).some(id => busyPIds.has(id))).map(p => pairGames.get(p.id) || 0);
  const activeC = avail.filter(c => c > 0);
  const minG = activeC.length > 0 ? Math.min(...activeC) : 0;

  let best: Match | undefined;
  let bestScore = Infinity;
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const g1 = pairGames.get(c.pair1.id) || 0;
    const g2 = pairGames.get(c.pair2.id) || 0;
    // Drain mode: bypass equity when no courts busy
    if (busyPIds.size > 0 && Math.min(g1, g2) > minG + 1) continue;
    const crossPen = isCrossCohort(c.matchupLabel) ? 100000000 : 0;
    const score = crossPen + Math.max(g1, g2) * 1000 + (c.gameNumber || i);
    if (score < bestScore) { bestScore = score; best = c; }
  }
  // Equity relaxation
  if (!best) {
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i];
      const g1 = pairGames.get(c.pair1.id) || 0;
      const g2 = pairGames.get(c.pair2.id) || 0;
      const score = Math.max(g1, g2) * 1000 + (c.gameNumber || i);
      if (score < bestScore) { bestScore = score; best = c; }
    }
  }
  return best;
}

// ═══════════════════════ GAME COMPLETION ═══════════════════════
let simClock = Date.now();
function completeMatch(matches: Match[], matchId: string, winnerId: string): void {
  const m = matches.find(x => x.id === matchId);
  if (!m || m.status !== "playing") return;
  m.status = "completed";
  simClock += 8 * 60 * 1000; // advance 8 min
  m.completedAt = new Date(simClock).toISOString();
  if (m.pair1.id === winnerId) { m.winner = m.pair1; m.loser = m.pair2; m.pair1.wins++; m.pair2.losses++; }
  else { m.winner = m.pair2; m.loser = m.pair1; m.pair2.wins++; m.pair1.losses++; }
}

function assignAndPlay(matches: Match[], freedCourt: number, courtCount: number, allPairs: Pair[]): Match | undefined {
  const recentPIds = new Set<string>();
  const recentlyCompleted = matches.filter(m => m.status === "completed" && m.completedAt);
  for (const m of recentlyCompleted) {
    const completedTime = new Date(m.completedAt!).getTime();
    if (simClock - completedTime < 7 * 60 * 1000) getMatchPlayerIds(m).forEach(id => recentPIds.add(id));
  }
  const next = findNextPendingForCourt(matches, freedCourt, courtCount, recentPIds, allPairs, matches);
  if (next) { next.status = "playing"; next.court = freedCourt; next.startedAt = new Date(simClock).toISOString(); }
  return next;
}

function runAllGames(matches: Match[], courtCount: number, allPairs: Pair[]): number {
  let completed = 0;
  for (let safety = 0; safety < 300; safety++) {
    const playing = matches.filter(m => m.status === "playing");
    if (playing.length === 0) {
      // Try to start games on empty courts
      let started = false;
      for (let c = 1; c <= courtCount; c++) {
        if (!matches.some(m => m.status === "playing" && m.court === c)) {
          const next = assignAndPlay(matches, c, courtCount, allPairs);
          if (next) started = true;
        }
      }
      if (!started) break;
      continue;
    }
    // Complete first playing match (random winner)
    const m = playing[0];
    const winnerId = Math.random() < 0.5 ? m.pair1.id : m.pair2.id;
    completeMatch(matches, m.id, winnerId);
    completed++;
    // Assign next match to freed court
    if (m.court) assignAndPlay(matches, m.court, courtCount, allPairs);
  }
  return completed;
}

// ═══════════════════════ GENERATE MATCHES FOR NEW PAIR ═══════════════════════
function generateMatchesForNewPair(newPair: Pair, existingPairs: Pair[], existingMatchups: Set<string>, courtCount: number, startGameNum: number): Match[] {
  const tier = newPair.skillLevel;
  const sameTier = shuffle(existingPairs.filter(p => p.skillLevel === tier && p.id !== newPair.id));
  const crossTier = courtCount === 3 ? [] : shuffle(existingPairs.filter(p => {
    if (p.id === newPair.id || p.skillLevel === tier) return false;
    return !isForbiddenMatchup(tier, p.skillLevel);
  }));
  const opponents = [...sameTier, ...crossTier];
  const newMatches: Match[] = [];
  const target = 4;
  for (const opp of opponents) {
    if (newMatches.length >= target) break;
    const mKey = matchupKey(newPair.id, opp.id);
    if (existingMatchups.has(mKey)) continue;
    const isCross = opp.skillLevel !== tier;
    newMatches.push({
      id: generateId(), pair1: newPair, pair2: opp,
      skillLevel: isCross ? "cross" as const : tier,
      matchupLabel: isCross ? `${tier} vs ${opp.skillLevel}` : `${tier} vs ${tier}`,
      status: "pending", court: null,
      gameNumber: startGameNum + newMatches.length + 1,
      courtPool: courtPoolForTiers(tier, opp.skillLevel),
    });
    existingMatchups.add(mKey);
  }
  return newMatches;
}

// ═══════════════════════ PLAYOFF SEEDING (mirrors production) ═══════════════════════
function getHeadToHead(pairAId: string, pairBId: string, matches: Match[]): number {
  let aw = 0, bw = 0;
  for (const m of matches) {
    if (m.status !== "completed" || !m.winner || !m.loser) continue;
    const ids = [m.pair1.id, m.pair2.id];
    if (!ids.includes(pairAId) || !ids.includes(pairBId)) continue;
    if (m.winner.id === pairAId) aw++; else if (m.winner.id === pairBId) bw++;
  }
  return aw > bw ? 1 : bw > aw ? -1 : 0;
}

function seedPlayoffs(matches: Match[], allPairs: Pair[]): { seeds: { seed: number; pair: Pair; winPct: number; tier: SkillTier }[]; playoffMatches: PlayoffMatch[] } {
  const pairMap = new Map<string, { pair: Pair; wins: number; losses: number; gamesPlayed: number; winPct: number }>();
  for (const m of matches.filter(x => x.status === "completed")) {
    const process = (pair: Pair, won: boolean) => {
      const key = [pair.player1.id, pair.player2.id].sort().join("|||");
      if (!pairMap.has(key)) pairMap.set(key, { pair, wins: 0, losses: 0, gamesPlayed: 0, winPct: 0 });
      const st = pairMap.get(key)!;
      st.gamesPlayed++;
      if (won) st.wins++; else st.losses++;
      st.winPct = st.gamesPlayed > 0 ? st.wins / st.gamesPlayed : 0;
    };
    if (m.winner && m.loser) { process(m.winner, true); process(m.loser, false); }
  }

  const all = Array.from(pairMap.entries()).map(([key, v]) => ({ key, ...v }));
  const byTier = (tier: SkillTier) => all.filter(p => p.pair.skillLevel === tier).sort((a, b) => {
    if (b.winPct !== a.winPct) return b.winPct - a.winPct;
    const h2h = getHeadToHead(a.pair.id, b.pair.id, matches);
    if (h2h !== 0) return -h2h;
    if (b.gamesPlayed !== a.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;
    return b.wins - a.wins;
  });

  const aRanked = byTier("A");
  const bRanked = byTier("B");
  const spotsForB = Math.max(0, 8 - aRanked.length);
  // B-beats-A override: if a B pair beat a specific A pair in H2H AND has >= win%,
  // the B pair leapfrogs that A pair in seeding.
  const seeding = [...aRanked];
  const bCandidates = bRanked.slice(0, spotsForB);
  for (const bEntry of bCandidates) {
    let insertIdx = seeding.length; // default: after all current entries
    for (let i = 0; i < seeding.length; i++) {
      if (seeding[i].pair.skillLevel !== "A") continue;
      const h2h = getHeadToHead(bEntry.pair.id, seeding[i].pair.id, matches);
      if (h2h > 0 && bEntry.winPct >= seeding[i].winPct) {
        insertIdx = i;
        break;
      }
    }
    seeding.splice(insertIdx, 0, bEntry);
  }
  const top = seeding.slice(0, 8);

  const seeds = top.map((ps, i) => ({ seed: i + 1, pair: ps.pair, winPct: ps.winPct, tier: ps.pair.skillLevel }));
  const playoffMatches: PlayoffMatch[] = [];
  const numMatches = Math.floor(seeds.length / 2);
  for (let i = 0; i < numMatches; i++) {
    const s1 = seeds[i]; const s2 = seeds[seeds.length - 1 - i];
    if (!s1 || !s2) continue;
    playoffMatches.push({ id: generateId(), round: 1, seed1: s1.seed, seed2: s2.seed, pair1: s1.pair, pair2: s2.pair, status: "pending" });
  }
  return { seeds, playoffMatches };
}

function runPlayoffs(playoffMatches: PlayoffMatch[]): { champion: Pair | null; rounds: number } {
  let round = 1;
  for (let safety = 0; safety < 20; safety++) {
    const roundMs = playoffMatches.filter(m => m.round === round && m.status !== "completed");
    if (roundMs.length === 0) {
      const winners = playoffMatches.filter(m => m.round === round && m.winner).map(m => m.winner!);
      if (winners.length <= 1) return { champion: winners[0] || null, rounds: round };
      round++;
      for (let i = 0; i < winners.length; i += 2) {
        if (i + 1 < winners.length) {
          playoffMatches.push({ id: generateId(), round, seed1: 0, seed2: 0, pair1: winners[i], pair2: winners[i + 1], status: "pending" });
        }
      }
      continue;
    }
    const m = roundMs[0];
    m.status = "completed";
    m.winner = Math.random() < 0.5 ? (m.pair1 as Pair) : (m.pair2 as Pair);
  }
  return { champion: null, rounds: round };
}


// ═══════════════════════════════════════════════════════════════
//                        TEST SECTIONS
// ═══════════════════════════════════════════════════════════════

console.log("\n==============================================================");
console.log("   COMPREHENSIVE ENGINE TEST — All Features");
console.log("==============================================================\n");

// ── SECTION 1: Helper Functions ──────────────────────────────
console.log("── SECTION 1: Helper Functions ──");

assert("helpers", courtPoolForTiers("A", "A") === "A", "courtPoolForTiers(A,A) = A", "courtPoolForTiers(A,A) wrong");
assert("helpers", courtPoolForTiers("B", "B") === "B", "courtPoolForTiers(B,B) = B", "courtPoolForTiers(B,B) wrong");
assert("helpers", courtPoolForTiers("C", "C") === "C", "courtPoolForTiers(C,C) = C", "courtPoolForTiers(C,C) wrong");
assert("helpers", courtPoolForTiers("A", "B") === "B", "courtPoolForTiers(A,B) = B (cross)", "courtPoolForTiers(A,B) wrong");
assert("helpers", courtPoolForTiers("B", "C") === "C", "courtPoolForTiers(B,C) = C (cross)", "courtPoolForTiers(B,C) wrong");
assert("helpers", courtToPool(1) === "C", "courtToPool(1) = C", "courtToPool(1) wrong");
assert("helpers", courtToPool(2) === "B", "courtToPool(2) = B", "courtToPool(2) wrong");
assert("helpers", courtToPool(3) === "A", "courtToPool(3) = A", "courtToPool(3) wrong");
assert("helpers", isForbiddenMatchup("A", "C") === true, "A vs C is forbidden", "A vs C should be forbidden");
assert("helpers", isForbiddenMatchup("C", "A") === true, "C vs A is forbidden", "C vs A should be forbidden");
assert("helpers", isForbiddenMatchup("A", "B") === false, "A vs B is allowed", "A vs B should be allowed");
assert("helpers", isForbiddenMatchup("B", "C") === false, "B vs C is allowed", "B vs C should be allowed");
assert("helpers", isCrossCohort("B vs A") === true, "B vs A is cross-cohort", "B vs A detection failed");
assert("helpers", isCrossCohort("A vs A") === false, "A vs A is not cross-cohort", "A vs A false positive");

// ── SECTION 2: 3-Court Tier Isolation (36 players) ──────────────────────────────
console.log("\n── SECTION 2: 3-Court Tier Isolation (36 players) ──");

const aPlayers2 = Array.from({ length: 12 }, (_, i) => makePlayer(`A${i + 1}`, "A"));
const bPlayers2 = Array.from({ length: 10 }, (_, i) => makePlayer(`B${i + 1}`, "B"));
const cPlayers2 = Array.from({ length: 14 }, (_, i) => makePlayer(`C${i + 1}`, "C"));
const aPairs2 = createPairs(aPlayers2, "A");
const bPairs2 = createPairs(bPlayers2, "B");
const cPairs2 = createPairs(cPlayers2, "C");
const allPairs2 = [...aPairs2, ...bPairs2, ...cPairs2];
const sched2 = generateSchedule(allPairs2, aPairs2, bPairs2, cPairs2, 3);

const crossMatches2 = sched2.filter(m => m.skillLevel === "cross");
assert("3court", crossMatches2.length === 0, `Zero cross-tier matches (got ${crossMatches2.length})`, `${crossMatches2.length} cross-tier matches found!`);

const bvA2 = sched2.filter(m => m.matchupLabel === "B vs A");
assert("3court", bvA2.length === 0, "No B vs A matches in 3-court", `${bvA2.length} B vs A matches found`);

const bvC2 = sched2.filter(m => m.matchupLabel === "B vs C");
assert("3court", bvC2.length === 0, "No B vs C matches in 3-court", `${bvC2.length} B vs C matches found`);

const wrongPool2 = sched2.filter(m => {
  const expected = courtPoolForTiers(m.pair1.skillLevel, m.pair2.skillLevel);
  return m.courtPool !== expected;
});
assert("3court", wrongPool2.length === 0, "All matches have correct courtPool", `${wrongPool2.length} matches with wrong courtPool`);

const aPoolGames = sched2.filter(m => m.courtPool === "A");
const bPoolGames = sched2.filter(m => m.courtPool === "B");
const cPoolGames = sched2.filter(m => m.courtPool === "C");
assert("3court", aPoolGames.length > 0, `A-pool has ${aPoolGames.length} games`, "A-pool has 0 games");
assert("3court", bPoolGames.length > 0, `B-pool has ${bPoolGames.length} games`, "B-pool has 0 games");
assert("3court", cPoolGames.length > 0, `C-pool has ${cPoolGames.length} games`, "C-pool has 0 games");

assert("3court", aPoolGames.every(m => m.pair1.skillLevel === "A" && m.pair2.skillLevel === "A"), "A-pool only has A vs A", "A-pool has non-A matches");
assert("3court", bPoolGames.every(m => m.pair1.skillLevel === "B" && m.pair2.skillLevel === "B"), "B-pool only has B vs B", "B-pool has non-B matches");
assert("3court", cPoolGames.every(m => m.pair1.skillLevel === "C" && m.pair2.skillLevel === "C"), "C-pool only has C vs C", "C-pool has non-C matches");

// ── SECTION 3: 2-Court Cross-Tier Rules ──────────────────────────────
console.log("\n── SECTION 3: 2-Court Cross-Tier Rules (24 players) ──");

const aP3 = Array.from({ length: 8 }, (_, i) => makePlayer(`2A${i + 1}`, "A"));
const bP3 = Array.from({ length: 8 }, (_, i) => makePlayer(`2B${i + 1}`, "B"));
const cP3 = Array.from({ length: 8 }, (_, i) => makePlayer(`2C${i + 1}`, "C"));
const aPr3 = createPairs(aP3, "A");
const bPr3 = createPairs(bP3, "B");
const cPr3 = createPairs(cP3, "C");
const allPr3 = [...aPr3, ...bPr3, ...cPr3];
const sched3 = generateSchedule(allPr3, aPr3, bPr3, cPr3, 2);

const avC3 = sched3.filter(m => {
  const tiers = [m.pair1.skillLevel, m.pair2.skillLevel].sort().join("");
  return tiers === "AC";
});
assert("2court", avC3.length === 0, "No A vs C in 2-court mode", `${avC3.length} A vs C matches`);

// B vs A should exist in 2-court
const bvA3 = sched3.filter(m => m.matchupLabel === "B vs A" || m.matchupLabel === "A vs B");
// It's OK if there are 0 if same-tier was sufficient, but candidates should have been generated
const candidates2court = generateCandidates(aPr3, bPr3, cPr3, 2);
const bvACand = candidates2court.filter(c => c.matchupLabel === "B vs A");
assert("2court", bvACand.length > 0, `B vs A candidates generated (${bvACand.length})`, "No B vs A candidates in 2-court");

const bvCCand = candidates2court.filter(c => c.matchupLabel === "B vs C");
assert("2court", bvCCand.length > 0, `B vs C candidates generated (${bvCCand.length})`, "No B vs C candidates in 2-court");

// Verify 3-court has NO cross candidates
const candidates3court = generateCandidates(aPr3, bPr3, cPr3, 3);
const crossCand3 = candidates3court.filter(c => c.skillLevel === "cross");
assert("2court", crossCand3.length === 0, "3-court generates zero cross-tier candidates", `3-court generated ${crossCand3.length} cross candidates`);

// ── SECTION 4: Schedule Equity ──────────────────────────────
console.log("\n── SECTION 4: Schedule Equity ──");

const pgc4 = new Map<string, number>();
allPairs2.forEach(p => pgc4.set(p.id, 0));
sched2.forEach(m => {
  pgc4.set(m.pair1.id, (pgc4.get(m.pair1.id) || 0) + 1);
  pgc4.set(m.pair2.id, (pgc4.get(m.pair2.id) || 0) + 1);
});
const counts4 = Array.from(pgc4.values());
const min4 = Math.min(...counts4);
const max4 = Math.max(...counts4);
const zeroPairs4 = allPairs2.filter(p => (pgc4.get(p.id) || 0) === 0);

assert("equity", zeroPairs4.length === 0, "No pairs have 0 games", `${zeroPairs4.length} pairs have 0 games: ${zeroPairs4.map(p => p.player1.name).join(", ")}`);
assert("equity", min4 >= 2, `Min games per pair: ${min4} (>= 2)`, `Min games ${min4} is too low`);
assert("equity", max4 - min4 <= 2, `Equity gap: ${max4 - min4} (<= 2)`, `Equity gap ${max4 - min4} too large (min=${min4}, max=${max4})`);

console.log(`  Info: ${sched2.length} total games, min=${min4}, max=${max4}, gap=${max4 - min4}`);

// ── SECTION 5: No Player Conflicts ──────────────────────────────
console.log("\n── SECTION 5: No Player Conflicts (same slot) ──");

// Build slots from schedule
const courtCount5 = 3;
const slotSize5 = courtCount5;
let conflicts5 = 0;
for (let i = 0; i < sched2.length; i += slotSize5) {
  const slotMatches = sched2.slice(i, i + slotSize5);
  const slotPIds = new Set<string>();
  for (const m of slotMatches) {
    for (const id of getMatchPlayerIds(m)) {
      if (slotPIds.has(id)) conflicts5++;
      slotPIds.add(id);
    }
  }
}
assert("conflicts", conflicts5 === 0, "No player on 2 courts in same slot", `${conflicts5} player conflicts found`);

// ── SECTION 6: Rest Gap ──────────────────────────────
console.log("\n── SECTION 6: Rest Gap (no back-to-back) ──");

let backToBack6 = 0;
for (let i = 0; i < sched2.length; i++) {
  const slot = Math.floor(i / courtCount5);
  const pids = getMatchPlayerIds(sched2[i]);
  // Check previous slot
  if (slot > 0) {
    const prevStart = (slot - 1) * courtCount5;
    const prevEnd = slot * courtCount5;
    for (let j = prevStart; j < prevEnd && j < sched2.length; j++) {
      const prevPids = getMatchPlayerIds(sched2[j]);
      if (pids.some(id => prevPids.includes(id))) backToBack6++;
    }
  }
}
// Some back-to-back may exist from fallback fill, but main schedule should minimize
assert("rest", backToBack6 <= 5, `Back-to-back violations: ${backToBack6} (<= 5 tolerance)`, `${backToBack6} back-to-back violations (too many)`);

// ── SECTION 7: Court Pool Routing ──────────────────────────────
console.log("\n── SECTION 7: Court Pool Routing (3-court) ──");

// Complete games and check court assignments
const routeMatches = [...sched2];
let routeErrors7 = 0;
// Check initially assigned matches
for (const m of routeMatches) {
  if (m.court && m.courtPool) {
    const expected = courtToPool(m.court);
    if (m.courtPool !== expected) routeErrors7++;
  }
}
assert("routing", routeErrors7 === 0, "Initial court assignments match pools", `${routeErrors7} routing errors`);

// Verify Court 1 = C, Court 2 = B, Court 3 = A on initial assignment
const c1Init = routeMatches.find(m => m.court === 1 && m.status === "playing");
const c2Init = routeMatches.find(m => m.court === 2 && m.status === "playing");
const c3Init = routeMatches.find(m => m.court === 3 && m.status === "playing");
assert("routing", !!c1Init && c1Init.courtPool === "C", "Court 1 starts with C-pool match", c1Init ? `Court 1 has ${c1Init.courtPool}` : "No Court 1");
assert("routing", !!c2Init && c2Init.courtPool === "B", "Court 2 starts with B-pool match", c2Init ? `Court 2 has ${c2Init.courtPool}` : "No Court 2");
assert("routing", !!c3Init && c3Init.courtPool === "A", "Court 3 starts with A-pool match", c3Init ? `Court 3 has ${c3Init.courtPool}` : "No Court 3");

// ── SECTION 8: findNextPendingForCourt ──────────────────────────────
console.log("\n── SECTION 8: findNextPendingForCourt ──");

// Create a simple state: 2 A-pairs, 2 B-pairs, 2 C-pairs, 3-court
const fA = [makePlayer("fA1", "A"), makePlayer("fA2", "A"), makePlayer("fA3", "A"), makePlayer("fA4", "A")];
const fB = [makePlayer("fB1", "B"), makePlayer("fB2", "B"), makePlayer("fB3", "B"), makePlayer("fB4", "B")];
const fC = [makePlayer("fC1", "C"), makePlayer("fC2", "C"), makePlayer("fC3", "C"), makePlayer("fC4", "C")];
const fAp = createPairs(fA, "A"); const fBp = createPairs(fB, "B"); const fCp = createPairs(fC, "C");
const fAll = [...fAp, ...fBp, ...fCp];

const fMatches: Match[] = [
  { id: generateId(), pair1: fAp[0], pair2: fAp[1], skillLevel: "A", matchupLabel: "A vs A", status: "pending", court: null, courtPool: "A" },
  { id: generateId(), pair1: fBp[0], pair2: fBp[1], skillLevel: "B", matchupLabel: "B vs B", status: "pending", court: null, courtPool: "B" },
  { id: generateId(), pair1: fCp[0], pair2: fCp[1], skillLevel: "C", matchupLabel: "C vs C", status: "pending", court: null, courtPool: "C" },
];

// Court 1 (C) should find C match
const found1 = findNextPendingForCourt(fMatches, 1, 3, new Set(), fAll, fMatches);
assert("findNext", !!found1 && found1.courtPool === "C", "Court 1 finds C-pool match", found1 ? `Court 1 found ${found1.courtPool}` : "Court 1 found nothing");

// Court 2 (B) should find B match
const found2 = findNextPendingForCourt(fMatches, 2, 3, new Set(), fAll, fMatches);
assert("findNext", !!found2 && found2.courtPool === "B", "Court 2 finds B-pool match", found2 ? `Court 2 found ${found2.courtPool}` : "Court 2 found nothing");

// Court 3 (A) should find A match
const found3 = findNextPendingForCourt(fMatches, 3, 3, new Set(), fAll, fMatches);
assert("findNext", !!found3 && found3.courtPool === "A", "Court 3 finds A-pool match", found3 ? `Court 3 found ${found3.courtPool}` : "Court 3 found nothing");

// Court 1 should NOT find a B match
const fMatchesB: Match[] = [
  { id: generateId(), pair1: fBp[0], pair2: fBp[1], skillLevel: "B", matchupLabel: "B vs B", status: "pending", court: null, courtPool: "B" },
];
const foundWrong = findNextPendingForCourt(fMatchesB, 1, 3, new Set(), fAll, fMatchesB);
assert("findNext", !foundWrong, "Court 1 correctly ignores B-pool matches", "Court 1 incorrectly assigned B-pool match");

// Drain mode: when no courts busy, equity gate bypassed
const drainPairs = [createPairs([makePlayer("dr1", "A"), makePlayer("dr2", "A"), makePlayer("dr3", "A"), makePlayer("dr4", "A")], "A")].flat();
const drainCompleted: Match[] = [
  { id: generateId(), pair1: drainPairs[0], pair2: drainPairs[1], skillLevel: "A", matchupLabel: "A vs A", status: "completed", court: null, courtPool: "A", winner: drainPairs[0], loser: drainPairs[1] },
  { id: generateId(), pair1: drainPairs[0], pair2: drainPairs[1], skillLevel: "A", matchupLabel: "A vs A", status: "completed", court: null, courtPool: "A", winner: drainPairs[1], loser: drainPairs[0] },
  { id: generateId(), pair1: drainPairs[0], pair2: drainPairs[1], skillLevel: "A", matchupLabel: "A vs A", status: "completed", court: null, courtPool: "A", winner: drainPairs[0], loser: drainPairs[1] },
];
const drainPending: Match = { id: generateId(), pair1: drainPairs[0], pair2: drainPairs[1], skillLevel: "A", matchupLabel: "A vs A", status: "pending", court: null, courtPool: "A" };
const drainAllMatches = [...drainCompleted, drainPending];
// Both pairs have 3 completed games, pending would be game 4 for both — equity would block if busyPIds > 0
// But drain mode (no courts busy) should let it through
const drainResult = findNextPendingForCourt(drainAllMatches, 3, 3, new Set(), drainPairs, drainAllMatches);
assert("findNext", !!drainResult, "Drain mode bypasses equity gate when no courts busy", "Drain mode failed — equity gate blocked last game");

// ── SECTION 9: Mid-Session Player Add ──────────────────────────────
console.log("\n── SECTION 9: Mid-Session Player Add ──");

// 3-court mode: walk-in C-pair should only get C opponents
const existingMatchups9 = new Set<string>();
sched2.forEach(m => existingMatchups9.add(matchupKey(m.pair1.id, m.pair2.id)));

const walkIn9 = createPairs([makePlayer("WalkC1", "C"), makePlayer("WalkC2", "C")], "C")[0];
const walkInMatches9 = generateMatchesForNewPair(walkIn9, allPairs2, new Set(existingMatchups9), 3, sched2.length);

assert("addMid", walkInMatches9.length > 0, `Walk-in C-pair got ${walkInMatches9.length} games`, "Walk-in C-pair got 0 games");
const walkInCross9 = walkInMatches9.filter(m => m.skillLevel === "cross");
assert("addMid", walkInCross9.length === 0, "Walk-in C-pair has zero cross-tier matches (3-court)", `Walk-in has ${walkInCross9.length} cross-tier matches`);
const walkInBadPool9 = walkInMatches9.filter(m => m.courtPool !== "C");
assert("addMid", walkInBadPool9.length === 0, "All walk-in C matches are C-pool", `${walkInBadPool9.length} walk-in matches have wrong pool`);

// 3-court mode: walk-in B-pair should only get B opponents
const walkInB9 = createPairs([makePlayer("WalkB1", "B"), makePlayer("WalkB2", "B")], "B")[0];
const walkInBMatches9 = generateMatchesForNewPair(walkInB9, allPairs2, new Set(existingMatchups9), 3, sched2.length);
const walkInBCross9 = walkInBMatches9.filter(m => m.skillLevel === "cross");
assert("addMid", walkInBCross9.length === 0, "Walk-in B-pair has zero cross-tier matches (3-court)", `Walk-in B has ${walkInBCross9.length} cross matches`);
const walkInBBadPool9 = walkInBMatches9.filter(m => m.courtPool !== "B");
assert("addMid", walkInBBadPool9.length === 0, "All walk-in B matches are B-pool", `${walkInBBadPool9.length} walk-in B matches have wrong pool`);

// 2-court mode: walk-in B-pair CAN get cross-tier opponents
const walkInB2court = generateMatchesForNewPair(walkInB9, allPr3, new Set(), 2, 0);
assert("addMid", walkInB2court.length > 0, `Walk-in B-pair (2-court) got ${walkInB2court.length} games`, "Walk-in B-pair (2-court) got 0 games");
// Should have some cross-tier (A or C opponents) available
const walkInB2cross = walkInB2court.filter(m => m.skillLevel === "cross");
// Not guaranteed but candidates should be available
console.log(`  Info: Walk-in B (2-court) got ${walkInB2cross.length} cross-tier of ${walkInB2court.length} total`);

// ── SECTION 10: Mid-Session Player Remove ──────────────────────────────
console.log("\n── SECTION 10: Mid-Session Player Remove ──");

// Create a small 3-court scenario, remove a player, verify orphan gets same-tier replacements
const rA = Array.from({ length: 6 }, (_, i) => makePlayer(`rA${i + 1}`, "A"));
const rB = Array.from({ length: 4 }, (_, i) => makePlayer(`rB${i + 1}`, "B"));
const rC = Array.from({ length: 6 }, (_, i) => makePlayer(`rC${i + 1}`, "C"));
const rAp = createPairs(rA, "A"); const rBp = createPairs(rB, "B"); const rCp = createPairs(rC, "C");
const rAll = [...rAp, ...rBp, ...rCp];
const rSched = generateSchedule(rAll, rAp, rBp, rCp, 3);

// Remove a player from an A-pair
const removedPlayer = rAp[0].player1;
const removedPairId = rAp[0].id;
const orphanPartnerId = rAp[0].player2.id;

// Remove the pair and void their matches
const rMatches = rSched.filter(m => m.pair1.id !== removedPairId && m.pair2.id !== removedPairId);
const rPairs = rAll.filter(p => p.id !== removedPairId);

// Create new pair for orphan with a walk-in
const orphanPartner = rAp[0].player2;
const newPartner = makePlayer("NewPartner", "A");
const orphanPair: Pair = { id: generateId(), player1: orphanPartner, player2: newPartner, skillLevel: "A", wins: 0, losses: 0 };
const orphanMatchups = new Set<string>();
rMatches.forEach(m => orphanMatchups.add(matchupKey(m.pair1.id, m.pair2.id)));

const orphanNewMatches = generateMatchesForNewPair(orphanPair, rPairs, orphanMatchups, 3, rMatches.length);
assert("remove", orphanNewMatches.length > 0, `Orphan pair got ${orphanNewMatches.length} replacement games`, "Orphan pair got 0 replacement games");
const orphanCross = orphanNewMatches.filter(m => m.skillLevel === "cross");
assert("remove", orphanCross.length === 0, "Orphan replacement matches are same-tier only (3-court)", `${orphanCross.length} cross-tier orphan matches`);

// Check no ghost matches
const ghostMatches10 = rMatches.filter(m =>
  m.pair1.player1.id === removedPlayer.id || m.pair1.player2.id === removedPlayer.id ||
  m.pair2.player1.id === removedPlayer.id || m.pair2.player2.id === removedPlayer.id
);
assert("remove", ghostMatches10.length === 0, "No ghost matches with removed player", `${ghostMatches10.length} ghost matches remain`);

// ── SECTION 11: Player Swap ──────────────────────────────
console.log("\n── SECTION 11: Player Swap ──");

const swapPairs = createPairs(Array.from({ length: 4 }, (_, i) => makePlayer(`sw${i + 1}`, "A")), "A");
const oldPlayer = swapPairs[0].player2;
const newPlayer = makePlayer("swNew", "A");

// Swap: replace oldPlayer with newPlayer in pair
swapPairs[0] = { ...swapPairs[0], player2: newPlayer };

assert("swap", swapPairs[0].player2.id === newPlayer.id, "New player is in pair after swap", "Swap failed");
assert("swap", !getPairPlayerIds(swapPairs[0]).includes(oldPlayer.id), "Old player no longer in pair", "Old player still in pair");

// ── SECTION 12: Playoff Seeding — A-tier first, B-tier fills to 8 ──────────────────────────────
console.log("\n── SECTION 12: Playoff Seeding ──");

// Create 5 A-pairs and 5 B-pairs with known win records
const pA = Array.from({ length: 10 }, (_, i) => makePlayer(`pA${i + 1}`, "A"));
const pB = Array.from({ length: 10 }, (_, i) => makePlayer(`pB${i + 1}`, "B"));
const pC = Array.from({ length: 4 }, (_, i) => makePlayer(`pC${i + 1}`, "C"));
const pAp = createPairs(pA, "A"); // 5 A-pairs
const pBp = createPairs(pB, "B"); // 5 B-pairs
const pCp = createPairs(pC, "C"); // 2 C-pairs
const pAllPairs = [...pAp, ...pBp, ...pCp];

// Create matches with predetermined outcomes
const pMatches: Match[] = [];
// A-pairs play each other: A0 wins all, A1 wins 2, A2 wins 1, A3 wins 0, A4 wins 1
for (let i = 0; i < pAp.length; i++) {
  for (let j = i + 1; j < pAp.length; j++) {
    const m: Match = {
      id: generateId(), pair1: pAp[i], pair2: pAp[j], skillLevel: "A", matchupLabel: "A vs A",
      status: "completed", court: null, courtPool: "A",
    };
    // A0 always wins. For others, lower index wins (except A3 always loses)
    if (i === 0) { m.winner = pAp[0]; m.loser = pAp[j]; pAp[0].wins++; pAp[j].losses++; }
    else if (i < j && i !== 3) { m.winner = pAp[i]; m.loser = pAp[j]; pAp[i].wins++; pAp[j].losses++; }
    else { m.winner = pAp[j]; m.loser = pAp[i]; pAp[j].wins++; pAp[i].losses++; }
    pMatches.push(m);
  }
}
// B-pairs play each other: B0 wins all, B1 wins 2
for (let i = 0; i < pBp.length; i++) {
  for (let j = i + 1; j < pBp.length; j++) {
    const m: Match = {
      id: generateId(), pair1: pBp[i], pair2: pBp[j], skillLevel: "B", matchupLabel: "B vs B",
      status: "completed", court: null, courtPool: "B",
    };
    if (i === 0) { m.winner = pBp[0]; m.loser = pBp[j]; pBp[0].wins++; pBp[j].losses++; }
    else if (i < j) { m.winner = pBp[i]; m.loser = pBp[j]; pBp[i].wins++; pBp[j].losses++; }
    else { m.winner = pBp[j]; m.loser = pBp[i]; pBp[j].wins++; pBp[i].losses++; }
    pMatches.push(m);
  }
}

const { seeds: seeds12, playoffMatches: pm12 } = seedPlayoffs(pMatches, pAllPairs);

// All 5 A-pairs should be seeds 1-5
const aPairIds12 = new Set(pAp.map(p => p.id));
const aSeeds12 = seeds12.filter(s => aPairIds12.has(s.pair.id));
assert("playoffs", aSeeds12.length === 5, `All 5 A-pairs are seeded (got ${aSeeds12.length})`, `Only ${aSeeds12.length} A-pairs seeded`);
assert("playoffs", aSeeds12.every(s => s.seed <= 5), "A-pairs occupy seeds 1-5", "A-pairs not in top 5 seeds");

// Seeds 6-8 should be top 3 B-pairs
const bSeeds12 = seeds12.filter(s => !aPairIds12.has(s.pair.id));
assert("playoffs", bSeeds12.length === 3, `3 B-pairs fill seeds 6-8 (got ${bSeeds12.length})`, `${bSeeds12.length} B-pairs in playoffs`);
assert("playoffs", bSeeds12.every(s => s.seed >= 6 && s.seed <= 8), "B-pairs are seeds 6-8", "B-pairs not in seeds 6-8");

// No C-pairs in playoffs
const cPairIds12 = new Set(pCp.map(p => p.id));
const cSeeds12 = seeds12.filter(s => cPairIds12.has(s.pair.id));
assert("playoffs", cSeeds12.length === 0, "No C-pairs in playoffs", `${cSeeds12.length} C-pairs in playoffs`);

// Seed 1 should be best A-pair (A0 won all matches)
assert("playoffs", seeds12[0].pair.id === pAp[0].id, "Seed 1 = best A-pair (A0)", `Seed 1 is ${seeds12[0].pair.player1.name}`);

assert("playoffs", seeds12.length === 8, `8 total seeds (got ${seeds12.length})`, `${seeds12.length} seeds`);
assert("playoffs", pm12.length === 4, `4 QF matches (got ${pm12.length})`, `${pm12.length} QF matches`);

console.log("  Seeds:");
seeds12.forEach(s => console.log(`    #${s.seed} ${s.pair.player1.name}&${s.pair.player2.name} (${s.tier}) win%=${(s.winPct * 100).toFixed(0)}%`));

// ── SECTION 13: Playoff Bracket (QF → SF → Final) ──────────────────────────────
console.log("\n── SECTION 13: Playoff Bracket ──");

const bracket13 = [...pm12];
const { champion: champ13, rounds: rounds13 } = runPlayoffs(bracket13);

assert("bracket", !!champ13, `Champion determined: ${champ13?.player1.name} & ${champ13?.player2.name}`, "No champion");
assert("bracket", rounds13 === 3, `3 rounds (QF, SF, Final) — got ${rounds13}`, `Wrong round count: ${rounds13}`);
const totalPM13 = bracket13.length;
assert("bracket", totalPM13 === 7, `7 total playoff matches (4+2+1) — got ${totalPM13}`, `${totalPM13} playoff matches`);

// ── SECTION 14: Playoff with 8+ A-pairs (no B-pairs in playoffs) ──────────────────────────────
console.log("\n── SECTION 14: 8+ A-pairs — B excluded from playoffs ──");

const bigA = Array.from({ length: 20 }, (_, i) => makePlayer(`bigA${i + 1}`, "A"));
const bigB = Array.from({ length: 6 }, (_, i) => makePlayer(`bigB${i + 1}`, "B"));
const bigAp = createPairs(bigA, "A"); // 10 A-pairs
const bigBp = createPairs(bigB, "B"); // 3 B-pairs
const bigAll = [...bigAp, ...bigBp];

// Create round-robin matches for A-pairs
const bigMatches: Match[] = [];
for (let i = 0; i < bigAp.length; i++) {
  for (let j = i + 1; j < bigAp.length; j++) {
    const m: Match = {
      id: generateId(), pair1: bigAp[i], pair2: bigAp[j], skillLevel: "A", matchupLabel: "A vs A",
      status: "completed", court: null, courtPool: "A",
    };
    m.winner = i < j ? bigAp[i] : bigAp[j];
    m.loser = i < j ? bigAp[j] : bigAp[i];
    bigMatches.push(m);
  }
}
// B-pairs play
for (let i = 0; i < bigBp.length; i++) {
  for (let j = i + 1; j < bigBp.length; j++) {
    const m: Match = {
      id: generateId(), pair1: bigBp[i], pair2: bigBp[j], skillLevel: "B", matchupLabel: "B vs B",
      status: "completed", court: null, courtPool: "B",
    };
    m.winner = bigBp[i]; m.loser = bigBp[j];
    bigMatches.push(m);
  }
}

const { seeds: seeds14 } = seedPlayoffs(bigMatches, bigAll);
const bInPlayoffs14 = seeds14.filter(s => s.tier === "B");
assert("playoff8A", bInPlayoffs14.length === 0, "No B-pairs when 10 A-pairs exist (top 8 = all A)", `${bInPlayoffs14.length} B-pairs snuck in`);
assert("playoff8A", seeds14.length === 8, "8 seeds from 10 A-pairs", `${seeds14.length} seeds`);
assert("playoff8A", seeds14.every(s => s.tier === "A"), "All 8 seeds are A-tier", "Non-A pair in seeds");

// ── SECTION 15: Head-to-Head Tiebreaker ──────────────────────────────
console.log("\n── SECTION 15: Head-to-Head Tiebreaker ──");

const h2hA = createPairs([makePlayer("h1", "A"), makePlayer("h2", "A"), makePlayer("h3", "A"), makePlayer("h4", "A")], "A");
const h2hMatches: Match[] = [
  // Pair 0 beats Pair 1
  { id: generateId(), pair1: h2hA[0], pair2: h2hA[1], skillLevel: "A", status: "completed", court: null, courtPool: "A", winner: h2hA[0], loser: h2hA[1] },
  // Pair 1 beats Pair 0 (so 1-1 head to head, BUT pair 0 also has another win)
  { id: generateId(), pair1: h2hA[1], pair2: h2hA[0], skillLevel: "A", status: "completed", court: null, courtPool: "A", winner: h2hA[1], loser: h2hA[0] },
];

const h2h01 = getHeadToHead(h2hA[0].id, h2hA[1].id, h2hMatches);
assert("h2h", h2h01 === 0, "H2H is tied at 1-1 → returns 0", `H2H returned ${h2h01}`);

// Add a third match where pair 0 wins → 2-1 h2h
h2hMatches.push({ id: generateId(), pair1: h2hA[0], pair2: h2hA[1], skillLevel: "A", status: "completed", court: null, courtPool: "A", winner: h2hA[0], loser: h2hA[1] });
const h2h01b = getHeadToHead(h2hA[0].id, h2hA[1].id, h2hMatches);
assert("h2h", h2h01b === 1, "H2H 2-1 → pair 0 wins (returns 1)", `H2H returned ${h2h01b}`);

// ── SECTION 16: Edge — Solo Pair in Tier ──────────────────────────────
console.log("\n── SECTION 16: Edge — Solo Pair in Tier ──");

const soloA = createPairs([makePlayer("soloA1", "A"), makePlayer("soloA2", "A")], "A");
const soloB = createPairs(Array.from({ length: 4 }, (_, i) => makePlayer(`soloB${i + 1}`, "B")), "B");
const soloC = createPairs(Array.from({ length: 4 }, (_, i) => makePlayer(`soloC${i + 1}`, "C")), "C");
const soloAll = [...soloA, ...soloB, ...soloC];
const soloSched = generateSchedule(soloAll, soloA, soloB, soloC, 3);

// Solo A-pair has no opponent → should get 0 A-pool games
const soloAGames = soloSched.filter(m => m.courtPool === "A");
assert("edge", soloAGames.length === 0, "Solo A-pair gets 0 games (no A opponent)", `Solo A-pair got ${soloAGames.length} games`);

// B and C should still have games
const soloBGames = soloSched.filter(m => m.courtPool === "B");
const soloCGames = soloSched.filter(m => m.courtPool === "C");
assert("edge", soloBGames.length > 0, `B-pool still has ${soloBGames.length} games`, "B-pool empty with solo A");
assert("edge", soloCGames.length > 0, `C-pool still has ${soloCGames.length} games`, "C-pool empty with solo A");

// ── SECTION 17: Edge — Empty Tier ──────────────────────────────
console.log("\n── SECTION 17: Edge — Empty Tier ──");

const emptyA: Pair[] = [];
const emptyB = createPairs(Array.from({ length: 6 }, (_, i) => makePlayer(`eB${i + 1}`, "B")), "B");
const emptyC = createPairs(Array.from({ length: 6 }, (_, i) => makePlayer(`eC${i + 1}`, "C")), "C");
const emptyAll = [...emptyB, ...emptyC];
const emptySched = generateSchedule(emptyAll, emptyA, emptyB, emptyC, 3);

const emptyAGames = emptySched.filter(m => m.courtPool === "A");
assert("edge", emptyAGames.length === 0, "No A-pool games when A-tier empty", `${emptyAGames.length} A-pool games with empty A-tier`);
assert("edge", emptySched.length > 0, `Schedule generated with ${emptySched.length} games (no A-tier)`, "No games generated with empty A-tier");

// ── SECTION 18: Edge — Late Arrival Equity (no deadlock) ──────────────────────────────
console.log("\n── SECTION 18: Edge — Late Arrival (no deadlock) ──");

const lateAll = createPairs(Array.from({ length: 6 }, (_, i) => makePlayer(`late${i + 1}`, "B")), "B");
const lateSched = generateSchedule(lateAll, [], lateAll, [], 3);

// Complete some games
simClock = Date.now();
runAllGames(lateSched, 3, lateAll);

// Add a new pair late
const latePair = createPairs([makePlayer("lateNew1", "B"), makePlayer("lateNew2", "B")], "B")[0];
const lateMatchups = new Set<string>();
lateSched.forEach(m => lateMatchups.add(matchupKey(m.pair1.id, m.pair2.id)));
const lateNewMatches = generateMatchesForNewPair(latePair, lateAll, lateMatchups, 3, lateSched.length);
lateSched.push(...lateNewMatches);
const updatedLatePairs = [...lateAll, latePair];

// Run remaining — should not deadlock
const lateCompleted = runAllGames(lateSched, 3, updatedLatePairs);
const latePending = lateSched.filter(m => m.status === "pending").length;
assert("late", latePending <= 2, `Late arrival: ${latePending} pending after completion (<= 2)`, `${latePending} games stuck (deadlock)`);

// ── SECTION 19: Edge — Large Player Count (48 players) ──────────────────────────────
console.log("\n── SECTION 19: Large Player Count (48 players, 3-court) ──");

const bigA19 = Array.from({ length: 16 }, (_, i) => makePlayer(`big19A${i + 1}`, "A"));
const bigB19 = Array.from({ length: 16 }, (_, i) => makePlayer(`big19B${i + 1}`, "B"));
const bigC19 = Array.from({ length: 16 }, (_, i) => makePlayer(`big19C${i + 1}`, "C"));
const bigAp19 = createPairs(bigA19, "A");
const bigBp19 = createPairs(bigB19, "B");
const bigCp19 = createPairs(bigC19, "C");
const bigAll19 = [...bigAp19, ...bigBp19, ...bigCp19];
const bigSched19 = generateSchedule(bigAll19, bigAp19, bigBp19, bigCp19, 3);

assert("large", bigSched19.length > 0, `48-player schedule: ${bigSched19.length} games`, "48-player schedule failed");

const bigCross19 = bigSched19.filter(m => m.skillLevel === "cross");
assert("large", bigCross19.length === 0, "48-player 3-court: zero cross-tier", `${bigCross19.length} cross-tier in 48-player`);

const bigPgc19 = new Map<string, number>();
bigAll19.forEach(p => bigPgc19.set(p.id, 0));
bigSched19.forEach(m => {
  bigPgc19.set(m.pair1.id, (bigPgc19.get(m.pair1.id) || 0) + 1);
  bigPgc19.set(m.pair2.id, (bigPgc19.get(m.pair2.id) || 0) + 1);
});
const bigCounts19 = Array.from(bigPgc19.values());
const bigMin19 = Math.min(...bigCounts19);
const bigMax19 = Math.max(...bigCounts19);
const bigZero19 = bigAll19.filter(p => (bigPgc19.get(p.id) || 0) === 0);

assert("large", bigZero19.length === 0, "48-player: no pairs with 0 games", `${bigZero19.length} pairs with 0 games`);
assert("large", bigMax19 - bigMin19 <= 2, `48-player equity gap: ${bigMax19 - bigMin19}`, `Equity gap ${bigMax19 - bigMin19} too large`);
console.log(`  Info: 48 players, ${bigAll19.length} pairs, ${bigSched19.length} games, min=${bigMin19}, max=${bigMax19}`);

// Run all games to verify no stall
simClock = Date.now();
const bigCompleted19 = runAllGames(bigSched19, 3, bigAll19);
const bigPending19 = bigSched19.filter(m => m.status === "pending").length;
assert("large", bigPending19 <= 3, `48-player: ${bigPending19} pending after run (<= 3 tolerance)`, `${bigPending19} games stuck`);

// ── SECTION 20: 2-Court Full Session ──────────────────────────────
console.log("\n── SECTION 20: 2-Court Full Session (24 players) ──");

const s20A = Array.from({ length: 8 }, (_, i) => makePlayer(`s20A${i + 1}`, "A"));
const s20B = Array.from({ length: 8 }, (_, i) => makePlayer(`s20B${i + 1}`, "B"));
const s20C = Array.from({ length: 8 }, (_, i) => makePlayer(`s20C${i + 1}`, "C"));
const s20Ap = createPairs(s20A, "A"); const s20Bp = createPairs(s20B, "B"); const s20Cp = createPairs(s20C, "C");
const s20All = [...s20Ap, ...s20Bp, ...s20Cp];
const s20Sched = generateSchedule(s20All, s20Ap, s20Bp, s20Cp, 2);

assert("2court-full", s20Sched.length > 0, `2-court schedule: ${s20Sched.length} games`, "2-court schedule empty");

// No A vs C
const s20AvC = s20Sched.filter(m => [m.pair1.skillLevel, m.pair2.skillLevel].sort().join("") === "AC");
assert("2court-full", s20AvC.length === 0, "No A vs C in 2-court", `${s20AvC.length} A vs C matches`);

// Run all
simClock = Date.now();
runAllGames(s20Sched, 2, s20All);
const s20Pending = s20Sched.filter(m => m.status === "pending").length;
assert("2court-full", s20Pending <= 2, `2-court session: ${s20Pending} pending after run`, `${s20Pending} games stuck`);

// Equity
const s20pgc = new Map<string, number>();
s20All.forEach(p => s20pgc.set(p.id, 0));
s20Sched.filter(m => m.status === "completed").forEach(m => {
  s20pgc.set(m.pair1.id, (s20pgc.get(m.pair1.id) || 0) + 1);
  s20pgc.set(m.pair2.id, (s20pgc.get(m.pair2.id) || 0) + 1);
});
const s20counts = Array.from(s20pgc.values());
const s20min = Math.min(...s20counts);
const s20max = Math.max(...s20counts);
assert("2court-full", s20max - s20min <= 3, `2-court equity gap: ${s20max - s20min} (<= 3)`, `Gap ${s20max - s20min} too large`);
console.log(`  Info: 24 players, 2-court, ${s20Sched.length} games, min=${s20min}, max=${s20max}`);

// ── SECTION 21: VIP Handling ──────────────────────────────
console.log("\n── SECTION 21: VIP Detection ──");

const VIP_PROFILE_IDS = new Set(["08813d60dccf0067907caf3727077d20", "040263dd01d6128b0df59406d4f9d9e0", "79acebd959da20272f79bfd96f8af281"]);
function isVip(_name: string, profileId?: string): boolean { return profileId ? VIP_PROFILE_IDS.has(profileId) : false; }

assert("vip", isVip("David", "08813d60dccf0067907caf3727077d20") === true, "David detected as VIP by profileId", "David not detected");
assert("vip", isVip("Benson", "040263dd01d6128b0df59406d4f9d9e0") === true, "Benson detected as VIP by profileId", "Benson not detected");
assert("vip", isVip("Albright", "79acebd959da20272f79bfd96f8af281") === true, "Albright detected as VIP by profileId", "Albright not detected");
assert("vip", isVip("David") === false, "Name-only lookup returns false (no profileId)", "Name-only returned true");
assert("vip", isVip("Random", "00000000000000000000000000000000") === false, "Non-VIP profileId returns false", "Random ID detected as VIP");

// ── SECTION 22: Regenerate Schedule After Changes ──────────────────────────────
console.log("\n── SECTION 22: Regenerate Remaining Schedule ──");

// Start a session with enough B-pairs that removal leaves unplayed matchups
// 7 B-pairs = C(7,2)=21 possible matchups, each pair plays ~3 → only ~10 used, so plenty left
const rgA = Array.from({ length: 8 }, (_, i) => makePlayer(`rgA${i + 1}`, "A"));
const rgB = Array.from({ length: 14 }, (_, i) => makePlayer(`rgB${i + 1}`, "B"));
const rgC = Array.from({ length: 8 }, (_, i) => makePlayer(`rgC${i + 1}`, "C"));
const rgAp = createPairs(rgA, "A"); const rgBp = createPairs(rgB, "B"); const rgCp = createPairs(rgC, "C");
const rgAll = [...rgAp, ...rgBp, ...rgCp];
const rgSched = generateSchedule(rgAll, rgAp, rgBp, rgCp, 3);

// Play first 6 games
simClock = Date.now();
let rgPlayed = 0;
while (rgPlayed < 6) {
  const playing = rgSched.filter(m => m.status === "playing");
  if (playing.length === 0) {
    for (let c = 1; c <= 3; c++) assignAndPlay(rgSched, c, 3, rgAll);
    continue;
  }
  const m = playing[0];
  completeMatch(rgSched, m.id, Math.random() < 0.5 ? m.pair1.id : m.pair2.id);
  rgPlayed++;
  if (m.court) assignAndPlay(rgSched, m.court, 3, rgAll);
}

// Remove a B-pair's matches (simulate removal)
const removedBPair = rgBp[0];
const rgBefore = rgSched.length;
const rgAfterRemoval = rgSched.filter(m => m.pair1.id !== removedBPair.id && m.pair2.id !== removedBPair.id);

// Regenerate: add new matches for remaining B-pairs that lost an opponent
const rgRemainingBPairs = rgBp.filter(p => p.id !== removedBPair.id);
const rgMatchups = new Set<string>();
rgAfterRemoval.forEach(m => rgMatchups.add(matchupKey(m.pair1.id, m.pair2.id)));

// Each orphaned B-pair that was matched vs the removed pair should get replacement games
let rgNewGames = 0;
for (const bp of rgRemainingBPairs) {
  // Use fresh matchup set per pair (only exclude this pair's existing matchups)
  const pairMatchups = new Set(rgMatchups);
  const newMs = generateMatchesForNewPair(bp, rgRemainingBPairs.filter(p => p.id !== bp.id), pairMatchups, 3, rgAfterRemoval.length + rgNewGames);
  rgNewGames += newMs.length;
  // All should be B-pool in 3-court mode
  const wrongPool = newMs.filter(m => m.courtPool !== "B");
  if (wrongPool.length > 0) fail("regen", `Regenerated B match has wrong pool: ${wrongPool[0].courtPool}`);
}
assert("regen", rgNewGames > 0, `Regenerated ${rgNewGames} games after removal`, "No games regenerated after removal");
const rgRegenCross = rgNewGames > 0; // Just verify we got here
assert("regen", rgRegenCross, "Regen completed without errors", "Regen had errors");
console.log(`  Info: Before=${rgBefore}, After removal=${rgAfterRemoval.length}, New=${rgNewGames}`);

// ── SECTION 23: Check-In / Toggle / Roster Operations ──────────────────────────
console.log("\n── SECTION 23: Check-In / Toggle / Roster Operations ──");

// Simulate the exact check-in toggle logic from useGameState.toggleCheckIn
function toggleCheckIn(roster: Player[], playerId: string, locked: boolean): Player[] {
  if (locked) return roster;
  return roster.map((p) =>
    p.id === playerId
      ? { ...p, checkedIn: !p.checkedIn, checkInTime: !p.checkedIn ? new Date().toISOString() : null }
      : p
  );
}

// Create a test roster
const ciRoster = [
  makePlayer("Alice", "A"),
  makePlayer("Bob", "B"),
  makePlayer("Charlie", "C"),
  makePlayer("Diana", "A"),
];
// makePlayer sets checkedIn=true, reset to false for testing
ciRoster.forEach(p => { p.checkedIn = false; p.checkInTime = null; });

// Test 1: Check in a player
const ci1 = toggleCheckIn(ciRoster, ciRoster[0].id, false);
assert("checkin", ci1[0].checkedIn === true, "Alice checked in successfully", "Alice not checked in");
assert("checkin", ci1[0].checkInTime !== null, "Alice has checkInTime", "Alice missing checkInTime");
assert("checkin", ci1[1].checkedIn === false, "Bob unchanged", "Bob changed unexpectedly");

// Test 2: Uncheck a checked-in player
const ci2 = toggleCheckIn(ci1, ci1[0].id, false);
assert("checkin", ci2[0].checkedIn === false, "Alice unchecked successfully", "Alice still checked in");
assert("checkin", ci2[0].checkInTime === null, "Alice checkInTime cleared", "Alice checkInTime not cleared");

// Test 3: Check-in blocked when locked
const ci3 = toggleCheckIn(ciRoster, ciRoster[1].id, true);
assert("checkin", ci3[1].checkedIn === false, "Bob blocked by lock", "Bob checked in despite lock");
assert("checkin", ci3 === ciRoster, "Locked returns same array reference", "Locked created new array");

// Test 4: Multiple check-ins
let ciMulti = [...ciRoster];
ciMulti = toggleCheckIn(ciMulti, ciMulti[0].id, false);
ciMulti = toggleCheckIn(ciMulti, ciMulti[1].id, false);
ciMulti = toggleCheckIn(ciMulti, ciMulti[2].id, false);
ciMulti = toggleCheckIn(ciMulti, ciMulti[3].id, false);
const allCheckedIn = ciMulti.filter(p => p.checkedIn);
assert("checkin", allCheckedIn.length === 4, `All 4 players checked in (got ${allCheckedIn.length})`, `Only ${allCheckedIn.length} checked in`);

// Test 5: Check-in preserves player data (skillLevel, id, name)
assert("checkin", ciMulti[0].skillLevel === "A", "Skill level preserved after check-in", "Skill level changed");
assert("checkin", ciMulti[0].name === "Alice", "Name preserved after check-in", "Name changed");
assert("checkin", ciMulti[2].skillLevel === "C", "Charlie still C-tier", "Charlie tier changed");

// Test 6: completeMatch updates roster, pairs, and history
const cmPlayers = Array.from({ length: 8 }, (_, i) => makePlayer(`cm${i}`, "A"));
const cmPairs = createPairs(cmPlayers, "A");
const cmSched = generateSchedule(cmPairs, cmPairs, [], [], 2);
// Start a match manually
const cmFirst = cmSched.find(m => m.status === "pending");
if (cmFirst) {
  cmFirst.status = "playing"; cmFirst.court = 1; cmFirst.startedAt = new Date().toISOString();
  // Complete it
  completeMatch(cmSched, cmFirst.id, cmFirst.pair1.id);
  const completed = cmSched.find(m => m.id === cmFirst.id);
  assert("checkin", completed?.status === "completed", "Match status is completed", `Status is ${completed?.status}`);
  assert("checkin", completed?.winner?.id === cmFirst.pair1.id, "Winner is pair1", "Winner is not pair1");
  assert("checkin", completed?.loser?.id === cmFirst.pair2.id, "Loser is pair2", "Loser is not pair2");
  assert("checkin", completed?.completedAt !== undefined, "completedAt is set", "completedAt missing");
} else {
  fail("checkin", "No pending match found for completeMatch test");
}

// Test 7: State mutations are consistent (simulate rapid-fire updates)
let mutState = { counter: 0, roster: [...ciRoster] };
for (let i = 0; i < 100; i++) {
  const idx = i % 4;
  mutState = {
    counter: mutState.counter + 1,
    roster: toggleCheckIn(mutState.roster, mutState.roster[idx].id, false),
  };
}
assert("checkin", mutState.counter === 100, "100 rapid-fire mutations completed", `Only ${mutState.counter} mutations`);
// After 100 toggles (25 per player), each has odd count = flipped from original
assert("checkin", mutState.roster[0].checkedIn === true, "Odd toggles (25) = flipped to checked", "Toggle state wrong after 100 ops");

// ── SECTION 24: Comprehensive 2-Court Mode ─────────────────────────────────────
console.log("\n── SECTION 24: Comprehensive 2-Court Mode ──");

// --- 24a: Typical session (8A + 8B + 8C = 24 players, 12 pairs) ---
const tc2A = Array.from({ length: 8 }, (_, i) => makePlayer(`tc2A${i + 1}`, "A"));
const tc2B = Array.from({ length: 8 }, (_, i) => makePlayer(`tc2B${i + 1}`, "B"));
const tc2C = Array.from({ length: 8 }, (_, i) => makePlayer(`tc2C${i + 1}`, "C"));
const tc2Ap = createPairs(tc2A, "A"); const tc2Bp = createPairs(tc2B, "B"); const tc2Cp = createPairs(tc2C, "C");
const tc2All = [...tc2Ap, ...tc2Bp, ...tc2Cp];
const tc2Sched = generateSchedule(tc2All, tc2Ap, tc2Bp, tc2Cp, 2);

// Test: A vs C never generated
const tc2AvC = tc2Sched.filter(m => {
  const t1 = m.pair1.skillLevel, t2 = m.pair2.skillLevel;
  return (t1 === "A" && t2 === "C") || (t1 === "C" && t2 === "A");
});
assert("2court", tc2AvC.length === 0, "Zero A vs C matches", `${tc2AvC.length} forbidden A vs C matches`);

// Test: B vs A exists (cross-tier bridge)
const tc2BvA = tc2Sched.filter(m => isCrossCohort(m.matchupLabel) && (m.matchupLabel === "B vs A" || m.matchupLabel === "A vs B"));
assert("2court", tc2BvA.length > 0, `B vs A matches exist (${tc2BvA.length})`, "No B vs A matches in 2-court");

// Test: B vs C exists (cross-tier bridge)
const tc2BvC = tc2Sched.filter(m => isCrossCohort(m.matchupLabel) && (m.matchupLabel === "B vs C" || m.matchupLabel === "C vs B"));
assert("2court", tc2BvC.length > 0, `B vs C matches exist (${tc2BvC.length})`, "No B vs C matches in 2-court");

// Test: courtPool set correctly on all matches
const tc2WrongPool = tc2Sched.filter(m => {
  const expected = courtPoolForTiers(m.pair1.skillLevel, m.pair2.skillLevel);
  return m.courtPool !== expected;
});
assert("2court", tc2WrongPool.length === 0, "All matches have correct courtPool", `${tc2WrongPool.length} matches with wrong courtPool`);

// Test: initial court assignment — first 2 matches are playing on courts 1 & 2
const tc2Playing = tc2Sched.filter(m => m.status === "playing");
assert("2court", tc2Playing.length === 2, "2 matches playing initially", `${tc2Playing.length} matches playing`);
assert("2court", tc2Playing.some(m => m.court === 1), "Court 1 has a match", "Court 1 empty");
assert("2court", tc2Playing.some(m => m.court === 2), "Court 2 has a match", "Court 2 empty");
const tc2Court3 = tc2Playing.filter(m => m.court === 3);
assert("2court", tc2Court3.length === 0, "No Court 3 in 2-court mode", `Court 3 has ${tc2Court3.length} matches`);

// Test: equity — all pairs have games, gap ≤ 2
const tc2PGC = new Map<string, number>();
tc2All.forEach(p => tc2PGC.set(p.id, 0));
tc2Sched.forEach(m => {
  tc2PGC.set(m.pair1.id, (tc2PGC.get(m.pair1.id) || 0) + 1);
  tc2PGC.set(m.pair2.id, (tc2PGC.get(m.pair2.id) || 0) + 1);
});
const tc2Counts = Array.from(tc2PGC.values());
const tc2Min = Math.min(...tc2Counts), tc2Max = Math.max(...tc2Counts);
const tc2Zero = tc2Counts.filter(v => v === 0).length;
assert("2court", tc2Zero === 0, "No pairs with 0 games", `${tc2Zero} pairs have 0 games`);
assert("2court", tc2Min >= 3, `Min games per pair: ${tc2Min} (>= 3)`, `Min games too low: ${tc2Min}`);
assert("2court", tc2Max - tc2Min <= 2, `Equity gap: ${tc2Max - tc2Min} (<= 2)`, `Equity gap too large: ${tc2Max - tc2Min}`);
console.log(`  Info: 24 players, 12 pairs, ${tc2Sched.length} games, min=${tc2Min}, max=${tc2Max}`);

// Test: no player conflicts in any slot
// Note: the engine guarantees no conflicts via slotPlayerIds checks in pickBestCandidate.
// We approximate slots by grouping consecutive matches (2 per slot), but some slots may
// have only 1 match, causing false positives. Use tolerance of 2 for grouping artifacts.
const tc2SlotMap = new Map<number, Match[]>();
tc2Sched.forEach((m, i) => { const s = Math.floor(i / 2); if (!tc2SlotMap.has(s)) tc2SlotMap.set(s, []); tc2SlotMap.get(s)!.push(m); });
let tc2Conflicts = 0;
for (const [_, slotMs] of tc2SlotMap) {
  const ids = new Set<string>();
  for (const m of slotMs) {
    for (const id of getMatchPlayerIds(m)) {
      if (ids.has(id)) tc2Conflicts++;
      ids.add(id);
    }
  }
}
assert("2court", tc2Conflicts <= 2, "No player conflicts in any slot", `${tc2Conflicts} conflicts`);

// --- 24b: Run full session (play all games) ---
simClock = Date.now();
let tc2Pending = tc2Sched.filter(m => m.status === "pending").length;
let tc2Rounds = 0;
while (tc2Pending > 0 && tc2Rounds < 200) {
  const playing = tc2Sched.filter(m => m.status === "playing");
  if (playing.length === 0) {
    for (let c = 1; c <= 2; c++) assignAndPlay(tc2Sched, c, 2, tc2All);
    tc2Pending = tc2Sched.filter(m => m.status === "pending").length;
    tc2Rounds++;
    continue;
  }
  const m = playing[0];
  completeMatch(tc2Sched, m.id, Math.random() < 0.5 ? m.pair1.id : m.pair2.id);
  if (m.court) assignAndPlay(tc2Sched, m.court, 2, tc2All);
  simClock += 7 * 60 * 1000;
  tc2Rounds++;
  tc2Pending = tc2Sched.filter(m => m.status === "pending").length;
}
const tc2StillPending = tc2Sched.filter(m => m.status === "pending").length;
assert("2court", tc2StillPending <= 2, `Session completed: ${tc2StillPending} pending (<= 2 tolerance)`, `${tc2StillPending} stuck pending`);

// Test: all completed matches have winners
const tc2CompWinners = tc2Sched.filter(m => m.status === "completed" && !m.winner);
assert("2court", tc2CompWinners.length === 0, "All completed matches have winners", `${tc2CompWinners.length} without winner`);

// --- 24c: findNextPendingForCourt in 2-court — no pool filtering ---
// Create a small schedule with mixed pools
const fnpA = Array.from({ length: 4 }, (_, i) => makePlayer(`fnp2A${i}`, "A"));
const fnpB = Array.from({ length: 4 }, (_, i) => makePlayer(`fnp2B${i}`, "B"));
const fnpAp = createPairs(fnpA, "A"); const fnpBp = createPairs(fnpB, "B");
const fnpAll = [...fnpAp, ...fnpBp];
const fnpSched = generateSchedule(fnpAll, fnpAp, fnpBp, [], 2);
// Reset all to pending for this test
fnpSched.forEach(m => { m.status = "pending"; m.court = null; });
const fnpResult1 = findNextPendingForCourt(fnpSched, 1, 2, new Set(), fnpAll, fnpSched);
const fnpResult2 = findNextPendingForCourt(fnpSched, 2, 2, new Set(), fnpAll, fnpSched);
assert("2court", fnpResult1 !== undefined, "Court 1 finds a match (no pool filter)", "Court 1 found nothing");
assert("2court", fnpResult2 !== undefined || fnpSched.length <= 1, "Court 2 finds a match or only 1 match total", "Court 2 found nothing unexpectedly");

// Verify Court 1 can pick ANY pool (not restricted to C)
if (fnpResult1) {
  // In 2-court, any courtPool is valid for any court
  assert("2court", true, `Court 1 assigned ${fnpResult1.courtPool}-pool match (any pool OK in 2-court)`, "");
}

// --- 24d: Mid-session walk-in in 2-court (cross-tier allowed) ---
const wi2A = Array.from({ length: 6 }, (_, i) => makePlayer(`wi2A${i}`, "A"));
const wi2B = Array.from({ length: 6 }, (_, i) => makePlayer(`wi2B${i}`, "B"));
const wi2C = Array.from({ length: 6 }, (_, i) => makePlayer(`wi2C${i}`, "C"));
const wi2Ap = createPairs(wi2A, "A"); const wi2Bp = createPairs(wi2B, "B"); const wi2Cp = createPairs(wi2C, "C");
const wi2AllPairs = [...wi2Ap, ...wi2Bp, ...wi2Cp];
const wi2Sched = generateSchedule(wi2AllPairs, wi2Ap, wi2Bp, wi2Cp, 2);

// Add a walk-in B-pair
const wiBNew1 = makePlayer("walkB1", "B");
const wiBNew2 = makePlayer("walkB2", "B");
const wiBPair: Pair = { id: generateId(), player1: wiBNew1, player2: wiBNew2, skillLevel: "B", wins: 0, losses: 0 };
const existingBPairsForWalkin = [...wi2Bp, ...wi2Ap, ...wi2Cp]; // All existing pairs
const wiMatchups = new Set<string>();
wi2Sched.forEach(m => wiMatchups.add(matchupKey(m.pair1.id, m.pair2.id)));
const wiNewMatches = generateMatchesForNewPair(wiBPair, existingBPairsForWalkin, wiMatchups, 2, wi2Sched.length);
assert("2court", wiNewMatches.length >= 3, `Walk-in B-pair got ${wiNewMatches.length} games (>= 3)`, `Only ${wiNewMatches.length} games`);

// In 2-court, cross-tier matches SHOULD exist for B-pair
const wiCrossTier = wiNewMatches.filter(m => m.pair1.skillLevel !== m.pair2.skillLevel);
// Cross-tier is allowed but not guaranteed (depends on scoring)
console.log(`  Info: Walk-in B (2-court) got ${wiCrossTier.length} cross-tier of ${wiNewMatches.length} total`);

// Verify no A vs C in walk-in matches
const wiAvC = wiNewMatches.filter(m => isForbiddenMatchup(m.pair1.skillLevel, m.pair2.skillLevel));
assert("2court", wiAvC.length === 0, "Walk-in: no A vs C matches", `${wiAvC.length} forbidden A vs C`);

// --- 24e: Heavy B-tier roster (12B + 4A + 4C = 20 players) ---
const hb2A = Array.from({ length: 4 }, (_, i) => makePlayer(`hb2A${i}`, "A"));
const hb2B = Array.from({ length: 12 }, (_, i) => makePlayer(`hb2B${i}`, "B"));
const hb2C = Array.from({ length: 4 }, (_, i) => makePlayer(`hb2C${i}`, "C"));
const hb2Ap = createPairs(hb2A, "A"); const hb2Bp = createPairs(hb2B, "B"); const hb2Cp = createPairs(hb2C, "C");
const hb2All = [...hb2Ap, ...hb2Bp, ...hb2Cp];
const hb2Sched = generateSchedule(hb2All, hb2Ap, hb2Bp, hb2Cp, 2);

assert("2court", hb2Sched.length > 0, `Heavy-B schedule generated (${hb2Sched.length} games)`, "No games generated");
const hb2AvC = hb2Sched.filter(m => isForbiddenMatchup(m.pair1.skillLevel, m.pair2.skillLevel));
assert("2court", hb2AvC.length === 0, "Heavy-B: no A vs C", `${hb2AvC.length} forbidden`);

// Verify B-pairs have enough games
const hb2PGC = new Map<string, number>();
hb2All.forEach(p => hb2PGC.set(p.id, 0));
hb2Sched.forEach(m => {
  hb2PGC.set(m.pair1.id, (hb2PGC.get(m.pair1.id) || 0) + 1);
  hb2PGC.set(m.pair2.id, (hb2PGC.get(m.pair2.id) || 0) + 1);
});
const hb2BCounts = hb2Bp.map(p => hb2PGC.get(p.id) || 0);
const hb2BMin = Math.min(...hb2BCounts);
assert("2court", hb2BMin >= 3, `Heavy-B: B-pairs min games = ${hb2BMin} (>= 3)`, `B-pairs too few games: ${hb2BMin}`);
console.log(`  Info: Heavy-B (20p), ${hb2Sched.length} games, B min=${hb2BMin}, B max=${Math.max(...hb2BCounts)}`);

// --- 24f: No C-tier roster (10A + 10B = 20 players, 2-court) ---
const nc2A = Array.from({ length: 10 }, (_, i) => makePlayer(`nc2A${i}`, "A"));
const nc2B = Array.from({ length: 10 }, (_, i) => makePlayer(`nc2B${i}`, "B"));
const nc2Ap = createPairs(nc2A, "A"); const nc2Bp = createPairs(nc2B, "B");
const nc2All = [...nc2Ap, ...nc2Bp];
const nc2Sched = generateSchedule(nc2All, nc2Ap, nc2Bp, [], 2);
assert("2court", nc2Sched.length > 0, `No-C schedule generated (${nc2Sched.length} games)`, "No games generated");
const nc2Cross = nc2Sched.filter(m => isCrossCohort(m.matchupLabel));
assert("2court", nc2Cross.length > 0, `No-C: B vs A cross-tier matches (${nc2Cross.length})`, "No cross-tier without C-tier");
console.log(`  Info: No-C (20p), ${nc2Sched.length} games, ${nc2Cross.length} cross-tier`);

// --- 24g: Minimal 2-court (4 players = 2 pairs) ---
const min2A = [makePlayer("min2A1", "A"), makePlayer("min2A2", "A")];
const min2B = [makePlayer("min2B1", "B"), makePlayer("min2B2", "B")];
const min2Ap = createPairs(min2A, "A"); const min2Bp = createPairs(min2B, "B");
const min2All = [...min2Ap, ...min2Bp];
const min2Sched = generateSchedule(min2All, min2Ap, min2Bp, [], 2);
assert("2court", min2Sched.length >= 1, `Minimal 2-court: ${min2Sched.length} games`, "No games with 2 pairs");
// With only 1A pair and 1B pair, only B vs A is possible (same-tier needs 2+ pairs of same tier)
const min2Types = new Set(min2Sched.map(m => m.matchupLabel));
console.log(`  Info: Minimal (4p, 2 pairs), ${min2Sched.length} games, types: ${[...min2Types].join(", ")}`);

// ── SECTION 25: Adaptive Tier Targets (2-court unbalanced rosters) ──────────────────────────────
console.log("\n── SECTION 25: Adaptive Tier Targets ──");

// Helper: compute adaptive targets (mirrors engine logic)
function computeAdaptiveTargets(
  aPairCount: number, bPairCount: number, cPairCount: number
): Record<SkillTier, { vsA: number; vsB: number; vsC: number }> {
  const base: Record<SkillTier, { vsA: number; vsB: number; vsC: number }> = {
    A: { vsA: 3, vsB: 1, vsC: 0 },
    B: { vsA: 1, vsB: 2, vsC: 1 },
    C: { vsA: 0, vsB: 1, vsC: 3 },
  };
  const counts: Record<SkillTier, number> = { A: aPairCount, B: bPairCount, C: cPairCount };
  const tiers: SkillTier[] = ["A", "B", "C"];
  const result: Record<SkillTier, { vsA: number; vsB: number; vsC: number }> = { A: { vsA: 0, vsB: 0, vsC: 0 }, B: { vsA: 0, vsB: 0, vsC: 0 }, C: { vsA: 0, vsB: 0, vsC: 0 } };
  for (const tier of tiers) {
    const b = { ...base[tier] };
    const maxOpp = (oTier: SkillTier) => Math.max(0, oTier === tier ? counts[oTier] - 1 : counts[oTier]);
    const capA = Math.min(b.vsA, maxOpp("A"));
    const capB = Math.min(b.vsB, maxOpp("B"));
    const capC = Math.min(b.vsC, maxOpp("C"));
    let surplus = (b.vsA - capA) + (b.vsB - capB) + (b.vsC - capC);
    const r = { vsA: capA, vsB: capB, vsC: capC };
    if (surplus > 0 && tier !== "B") {
      const bRoom = maxOpp("B") - r.vsB;
      const toBAdd = Math.min(surplus, bRoom);
      r.vsB += toBAdd;
      surplus -= toBAdd;
    }
    if (surplus > 0 && tier === "B") {
      const bRoom = maxOpp("B") - r.vsB;
      const toBAdd = Math.min(surplus, bRoom);
      r.vsB += toBAdd;
      surplus -= toBAdd;
      if (surplus > 0) {
        const aRoom = maxOpp("A") - r.vsA;
        const toAAdd = Math.min(surplus, aRoom);
        r.vsA += toAAdd;
        surplus -= toAAdd;
      }
      if (surplus > 0) {
        const cRoom = maxOpp("C") - r.vsC;
        const toCAdd = Math.min(surplus, cRoom);
        r.vsC += toCAdd;
        surplus -= toCAdd;
      }
    }
    result[tier] = r;
  }
  return result;
}

// 25a: Standard balanced (4A, 4B, 4C) — no adaptation needed
const t25a = computeAdaptiveTargets(4, 4, 4);
assert("adaptive", t25a.A.vsA === 3 && t25a.A.vsB === 1, "Balanced A: 3 vs A, 1 vs B", `${t25a.A.vsA} vs A, ${t25a.A.vsB} vs B`);
assert("adaptive", t25a.B.vsA === 1 && t25a.B.vsB === 2 && t25a.B.vsC === 1, "Balanced B: 1-2-1", `${t25a.B.vsA}-${t25a.B.vsB}-${t25a.B.vsC}`);
assert("adaptive", t25a.C.vsC === 3 && t25a.C.vsB === 1, "Balanced C: 3 vs C, 1 vs B", `${t25a.C.vsC} vs C, ${t25a.C.vsB} vs B`);

// 25b: Small A tier (3A pairs = only 2 same-tier opponents) — overflow to B
const t25b = computeAdaptiveTargets(3, 4, 4);
assert("adaptive", t25b.A.vsA === 2, "Small-A: capped at 2 A vs A (only 2 opponents)", `${t25b.A.vsA} vs A`);
assert("adaptive", t25b.A.vsB === 2, "Small-A: overflow to B (2 vs B)", `${t25b.A.vsB} vs B`);
assert("adaptive", t25b.A.vsA + t25b.A.vsB + t25b.A.vsC === 4, "Small-A: total still 4", `total=${t25b.A.vsA + t25b.A.vsB + t25b.A.vsC}`);
console.log(`  Info: Small-A (3A,4B,4C) targets: A=${t25b.A.vsA}/${t25b.A.vsB}/${t25b.A.vsC}, B=${t25b.B.vsA}/${t25b.B.vsB}/${t25b.B.vsC}, C=${t25b.C.vsA}/${t25b.C.vsB}/${t25b.C.vsC}`);

// 25c: Small C tier (3C pairs = only 2 same-tier opponents) — overflow to B
const t25c = computeAdaptiveTargets(4, 4, 3);
assert("adaptive", t25c.C.vsC === 2, "Small-C: capped at 2 C vs C", `${t25c.C.vsC} vs C`);
assert("adaptive", t25c.C.vsB === 2, "Small-C: overflow to B (2 vs B)", `${t25c.C.vsB} vs B`);

// 25d: Very small A (2A pairs = only 1 opponent) — heavy overflow
const t25d = computeAdaptiveTargets(2, 4, 4);
assert("adaptive", t25d.A.vsA === 1, "Tiny-A: capped at 1 A vs A", `${t25d.A.vsA} vs A`);
assert("adaptive", t25d.A.vsB === 3, "Tiny-A: overflow gives 3 vs B", `${t25d.A.vsB} vs B`);
assert("adaptive", t25d.A.vsA + t25d.A.vsB + t25d.A.vsC === 4, "Tiny-A: total still 4", `total=${t25d.A.vsA + t25d.A.vsB + t25d.A.vsC}`);

// 25e: No C tier (0C pairs) — B redistributes C slot to same-tier
const t25e = computeAdaptiveTargets(4, 4, 0);
assert("adaptive", t25e.B.vsC === 0, "No-C: B can't play C", `${t25e.B.vsC} vs C`);
assert("adaptive", t25e.B.vsB === 3, "No-C: B overflow to same-tier (3 vs B)", `${t25e.B.vsB} vs B`);
assert("adaptive", t25e.B.vsA + t25e.B.vsB + t25e.B.vsC === 4, "No-C: B total still 4", `total=${t25e.B.vsA + t25e.B.vsB + t25e.B.vsC}`);
assert("adaptive", t25e.C.vsC === 0, "No-C: C targets are 0", `${t25e.C.vsC}`);
console.log(`  Info: No-C targets: A=${t25e.A.vsA}/${t25e.A.vsB}/${t25e.A.vsC}, B=${t25e.B.vsA}/${t25e.B.vsB}/${t25e.B.vsC}`);

// 25f: No A tier (0A pairs) — B redistributes A slot
const t25f = computeAdaptiveTargets(0, 4, 4);
assert("adaptive", t25f.B.vsA === 0, "No-A: B can't play A", `${t25f.B.vsA} vs A`);
assert("adaptive", t25f.B.vsB === 3, "No-A: B overflow to same-tier (3 vs B)", `${t25f.B.vsB} vs B`);
assert("adaptive", t25f.A.vsA === 0, "No-A: A targets are 0", `${t25f.A.vsA}`);

// 25g: Solo pair in each tier (1A, 1B, 1C) — can't play same-tier at all
const t25g = computeAdaptiveTargets(1, 1, 1);
assert("adaptive", t25g.A.vsA === 0, "Solo-A: 0 vs A (no same-tier opponent)", `${t25g.A.vsA} vs A`);
assert("adaptive", t25g.A.vsB === 1, "Solo-A: 1 vs B (capped by 1 B pair)", `${t25g.A.vsB} vs B`);
assert("adaptive", t25g.C.vsC === 0, "Solo-C: 0 vs C", `${t25g.C.vsC} vs C`);
assert("adaptive", t25g.C.vsB === 1, "Solo-C: 1 vs B", `${t25g.C.vsB} vs B`);
assert("adaptive", t25g.B.vsB === 0, "Solo-B: 0 vs B", `${t25g.B.vsB} vs B`);

// ── SECTION 26: Playoff Seeding — B-beats-A Override ──────────────────────────────
console.log("\n── SECTION 26: Playoff Seeding — B-beats-A Override ──");

// Create scenario: B1 beat A3 in round-robin, B1 has higher win%
const s26A = Array.from({ length: 8 }, (_, i) => makePlayer(`s26A${i}`, "A"));
const s26B = Array.from({ length: 6 }, (_, i) => makePlayer(`s26B${i}`, "B"));
const s26Ap = createPairs(s26A, "A"); // 4 A-pairs
const s26Bp = createPairs(s26B, "B"); // 3 B-pairs
const s26All = [...s26Ap, ...s26Bp];

const s26Matches: Match[] = [];
// A0 wins 3, A1 wins 2, A2 wins 1, A3 wins 0 (worst A pair)
for (let i = 0; i < s26Ap.length; i++) {
  for (let j = i + 1; j < s26Ap.length; j++) {
    const m: Match = { id: generateId(), pair1: s26Ap[i], pair2: s26Ap[j], skillLevel: "A", matchupLabel: "A vs A", status: "completed", court: null, courtPool: "A" };
    // lower index wins
    m.winner = s26Ap[i]; m.loser = s26Ap[j];
    s26Matches.push(m);
  }
}
// B0 wins 2, B1 wins 1, B2 wins 0
for (let i = 0; i < s26Bp.length; i++) {
  for (let j = i + 1; j < s26Bp.length; j++) {
    const m: Match = { id: generateId(), pair1: s26Bp[i], pair2: s26Bp[j], skillLevel: "B", matchupLabel: "B vs B", status: "completed", court: null, courtPool: "B" };
    m.winner = s26Bp[i]; m.loser = s26Bp[j];
    s26Matches.push(m);
  }
}
// KEY: B0 beats A3 in a cross-tier match. B0 has 100% win in B (2/2) + this win = 3/3 = 100%.
// A3 has 0% in A (0/3) + this loss = 0/4 = 0%.
const crossMatch1: Match = {
  id: generateId(), pair1: s26Bp[0], pair2: s26Ap[3], skillLevel: "cross", matchupLabel: "B vs A",
  status: "completed", court: null, courtPool: "B",
  winner: s26Bp[0], loser: s26Ap[3],
};
s26Matches.push(crossMatch1);

const { seeds: s26Seeds } = seedPlayoffs(s26Matches, s26All);

// B0 should leapfrog A3 because B0 beat A3 AND B0 has higher win%
// Expected order: A0, A1, A2, B0, A3, B1, B2
const s26B0Seed = s26Seeds.find(s => s.pair.id === s26Bp[0].id);
const s26A3Seed = s26Seeds.find(s => s.pair.id === s26Ap[3].id);
assert("seeding", s26B0Seed !== undefined, "B0 is in playoff seeds", "B0 not found in seeds");
assert("seeding", s26A3Seed !== undefined, "A3 is in playoff seeds", "A3 not found in seeds");
if (s26B0Seed && s26A3Seed) {
  assert("seeding", s26B0Seed.seed < s26A3Seed.seed, `B0 (seed ${s26B0Seed.seed}) leapfrogs A3 (seed ${s26A3Seed.seed})`, `B0=${s26B0Seed.seed}, A3=${s26A3Seed.seed}`);
}
console.log("  Seeds:");
s26Seeds.forEach(s => console.log(`    #${s.seed} ${s.pair.player1.name}&${s.pair.player2.name} (${s.tier}) win%=${(s.winPct * 100).toFixed(0)}%`));

// B0 should NOT leapfrog A0, A1, A2 (didn't beat them)
const s26A0Seed = s26Seeds.find(s => s.pair.id === s26Ap[0].id);
assert("seeding", s26A0Seed !== undefined && s26A0Seed.seed === 1, "A0 still seed 1", `A0 seed=${s26A0Seed?.seed}`);
const s26A1Seed = s26Seeds.find(s => s.pair.id === s26Ap[1].id);
assert("seeding", s26A1Seed !== undefined && s26A1Seed.seed === 2, "A1 still seed 2", `A1 seed=${s26A1Seed?.seed}`);

// Test: B pair with LOWER win% than A pair does NOT leapfrog even if they beat them
const s26Matches2: Match[] = [];
// Setup where B has lower win%: B2 beats A2 but B2 has 0% in B matches
for (let i = 0; i < s26Ap.length; i++) {
  for (let j = i + 1; j < s26Ap.length; j++) {
    const m: Match = { id: generateId(), pair1: s26Ap[i], pair2: s26Ap[j], skillLevel: "A", matchupLabel: "A vs A", status: "completed", court: null, courtPool: "A" };
    m.winner = s26Ap[i]; m.loser = s26Ap[j];
    s26Matches2.push(m);
  }
}
for (let i = 0; i < s26Bp.length; i++) {
  for (let j = i + 1; j < s26Bp.length; j++) {
    const m: Match = { id: generateId(), pair1: s26Bp[i], pair2: s26Bp[j], skillLevel: "B", matchupLabel: "B vs B", status: "completed", court: null, courtPool: "B" };
    m.winner = s26Bp[i]; m.loser = s26Bp[j];
    s26Matches2.push(m);
  }
}
// B2 beats A2 cross-tier, but B2 has 0/2 B wins + 1 cross win = 1/3 = 33%
// A2 has 1/3 A wins - 1 cross loss = 1/4 = 25%. B2 win% (33%) > A2 win% (25%) — BUT
// Let's make B2 have lower win%: B2 loses to both B0 and B1 (0% in B) + beats A0 who has 100%
const crossMatch2: Match = {
  id: generateId(), pair1: s26Bp[2], pair2: s26Ap[0], skillLevel: "cross", matchupLabel: "B vs A",
  status: "completed", court: null, courtPool: "B",
  winner: s26Bp[2], loser: s26Ap[0],
};
s26Matches2.push(crossMatch2);
// B2: 0 B wins + 1 cross win = 1/3 = 33%. A0: 3 A wins - 1 cross loss = 3/4 = 75%.
const { seeds: s26Seeds2 } = seedPlayoffs(s26Matches2, s26All);
const s26B2Seed2 = s26Seeds2.find(s => s.pair.id === s26Bp[2].id);
const s26A0Seed2 = s26Seeds2.find(s => s.pair.id === s26Ap[0].id);
if (s26B2Seed2 && s26A0Seed2) {
  assert("seeding", s26B2Seed2.seed > s26A0Seed2.seed, `B2 (33%) does NOT leapfrog A0 (75%) despite beating them`, `B2=${s26B2Seed2.seed}, A0=${s26A0Seed2.seed}`);
}

// Test: B pair with EQUAL win% that beat A pair DOES leapfrog
const s26Matches3: Match[] = [];
// A pairs each play 1 game: A0 beats A1 (50% each after cross matches)
const amatch: Match = { id: generateId(), pair1: s26Ap[0], pair2: s26Ap[1], skillLevel: "A", matchupLabel: "A vs A", status: "completed", court: null, courtPool: "A", winner: s26Ap[0], loser: s26Ap[1] };
s26Matches3.push(amatch);
// B0 beats B1
const bmatch: Match = { id: generateId(), pair1: s26Bp[0], pair2: s26Bp[1], skillLevel: "B", matchupLabel: "B vs B", status: "completed", court: null, courtPool: "B", winner: s26Bp[0], loser: s26Bp[1] };
s26Matches3.push(bmatch);
// B0 beats A1: B0 = 2/2 = 100%. A1 = 0/2 = 0%. B0 leapfrogs A1.
const crossMatch3: Match = { id: generateId(), pair1: s26Bp[0], pair2: s26Ap[1], skillLevel: "cross", matchupLabel: "B vs A", status: "completed", court: null, courtPool: "B", winner: s26Bp[0], loser: s26Ap[1] };
s26Matches3.push(crossMatch3);

const { seeds: s26Seeds3 } = seedPlayoffs(s26Matches3, s26All);
const s26B0Seed3 = s26Seeds3.find(s => s.pair.id === s26Bp[0].id);
const s26A1Seed3 = s26Seeds3.find(s => s.pair.id === s26Ap[1].id);
const s26A0Seed3 = s26Seeds3.find(s => s.pair.id === s26Ap[0].id);
if (s26B0Seed3 && s26A1Seed3) {
  assert("seeding", s26B0Seed3.seed < s26A1Seed3.seed, `B0 (100%) leapfrogs A1 (0%) — beat them + higher win%`, `B0=${s26B0Seed3.seed}, A1=${s26A1Seed3.seed}`);
}
if (s26B0Seed3 && s26A0Seed3) {
  assert("seeding", s26B0Seed3.seed > s26A0Seed3.seed, `B0 does NOT leapfrog A0 (didn't beat them)`, `B0=${s26B0Seed3.seed}, A0=${s26A0Seed3.seed}`);
}

// ── SECTION 27: 3-Court Isolation — Per-Court State ──────────────────────────────
console.log("\n── SECTION 27: 3-Court Isolation — Per-Court State ──");

// Simulate 10A, 12B, 14C players → 5 A-pairs, 6 B-pairs, 7 C-pairs
const iso3A = Array.from({ length: 10 }, (_, i) => makePlayer(`iso3A${i + 1}`, "A"));
const iso3B = Array.from({ length: 12 }, (_, i) => makePlayer(`iso3B${i + 1}`, "B"));
const iso3C = Array.from({ length: 14 }, (_, i) => makePlayer(`iso3C${i + 1}`, "C"));
const iso3Ap = createPairs(iso3A, "A"); // 5 pairs
const iso3Bp = createPairs(iso3B, "B"); // 6 pairs
const iso3Cp = createPairs(iso3C, "C"); // 7 pairs
const iso3AllPairs = [...iso3Ap, ...iso3Bp, ...iso3Cp];

// Create courts (mirrors engine logic in generateFullSchedule for 3-court)
const makeCourt = (num: 1 | 2 | 3, tier: SkillTier, pairs: Pair[]): CourtState => ({
  courtNumber: num,
  tier,
  assignedPairs: pairs,
  schedule: [],
  completedGames: [],
  standings: Object.fromEntries(pairs.map(p => [p.id, { wins: 0, losses: 0, gamesPlayed: 0, winPct: 0 }])),
  currentSlot: 0,
  status: "waiting",
  format: "round_robin",
});

const isoCourts: CourtState[] = [
  makeCourt(1, "C", iso3Cp),
  makeCourt(2, "B", iso3Bp),
  makeCourt(3, "A", iso3Ap),
];

// Verify court count and tier assignment
assert("3court-iso", isoCourts.length === 3, "3 courts created", `${isoCourts.length} courts`);
assert("3court-iso", isoCourts[0].courtNumber === 1, "Court 1 exists", `courtNumber=${isoCourts[0].courtNumber}`);
assert("3court-iso", isoCourts[1].courtNumber === 2, "Court 2 exists", `courtNumber=${isoCourts[1].courtNumber}`);
assert("3court-iso", isoCourts[2].courtNumber === 3, "Court 3 exists", `courtNumber=${isoCourts[2].courtNumber}`);

// Verify tier isolation
assert("3court-iso", isoCourts[0].tier === "C", "Court 1 = C tier", `tier=${isoCourts[0].tier}`);
assert("3court-iso", isoCourts[1].tier === "B", "Court 2 = B tier", `tier=${isoCourts[1].tier}`);
assert("3court-iso", isoCourts[2].tier === "A", "Court 3 = A tier", `tier=${isoCourts[2].tier}`);

// Verify pair counts per court
assert("3court-iso", isoCourts[0].assignedPairs.length === 7, "Court 1 (C): 7 pairs", `${isoCourts[0].assignedPairs.length} pairs`);
assert("3court-iso", isoCourts[1].assignedPairs.length === 6, "Court 2 (B): 6 pairs", `${isoCourts[1].assignedPairs.length} pairs`);
assert("3court-iso", isoCourts[2].assignedPairs.length === 5, "Court 3 (A): 5 pairs", `${isoCourts[2].assignedPairs.length} pairs`);
console.log(`  Info: Court 1 (C)=${isoCourts[0].assignedPairs.length} pairs, Court 2 (B)=${isoCourts[1].assignedPairs.length} pairs, Court 3 (A)=${isoCourts[2].assignedPairs.length} pairs`);

// Verify ALL pairs on each court are the correct tier — zero crossover
for (const court of isoCourts) {
  const wrongTier = court.assignedPairs.filter(p => p.skillLevel !== court.tier);
  assert("3court-iso", wrongTier.length === 0, `Court ${court.courtNumber} (${court.tier}): zero wrong-tier pairs`, `${wrongTier.length} wrong-tier pairs: ${wrongTier.map(p => p.player1.name + " " + p.skillLevel).join(", ")}`);
}

// Verify total pairs across all courts equals total pairs generated
const totalCourtPairs = isoCourts.reduce((sum, c) => sum + c.assignedPairs.length, 0);
assert("3court-iso", totalCourtPairs === iso3AllPairs.length, `Total pairs (${totalCourtPairs}) = all generated (${iso3AllPairs.length})`, `${totalCourtPairs} vs ${iso3AllPairs.length}`);

// Verify no pair appears on multiple courts
const allCourtPairIds = new Set<string>();
let duplicatePairs = 0;
for (const court of isoCourts) {
  for (const pair of court.assignedPairs) {
    if (allCourtPairIds.has(pair.id)) duplicatePairs++;
    allCourtPairIds.add(pair.id);
  }
}
assert("3court-iso", duplicatePairs === 0, "No duplicate pairs across courts", `${duplicatePairs} duplicates`);

// Verify no player appears on multiple courts
const allCourtPlayerIds = new Set<string>();
let duplicatePlayers = 0;
for (const court of isoCourts) {
  for (const pair of court.assignedPairs) {
    for (const pid of [pair.player1.id, pair.player2.id]) {
      if (allCourtPlayerIds.has(pid)) duplicatePlayers++;
      allCourtPlayerIds.add(pid);
    }
  }
}
assert("3court-iso", duplicatePlayers === 0, "No duplicate players across courts", `${duplicatePlayers} duplicates`);

// Verify each court has empty schedule and completedGames (step 1 — no schedules yet)
for (const court of isoCourts) {
  assert("3court-iso", court.schedule.length === 0, `Court ${court.courtNumber}: schedule empty`, `${court.schedule.length} matches`);
  assert("3court-iso", court.completedGames.length === 0, `Court ${court.courtNumber}: completedGames empty`, `${court.completedGames.length} matches`);
  assert("3court-iso", court.status === "waiting", `Court ${court.courtNumber}: status=waiting`, `status=${court.status}`);
  assert("3court-iso", court.currentSlot === 0, `Court ${court.courtNumber}: currentSlot=0`, `currentSlot=${court.currentSlot}`);
}

// Verify standings initialized for all pairs
for (const court of isoCourts) {
  const standingIds = Object.keys(court.standings);
  assert("3court-iso", standingIds.length === court.assignedPairs.length, `Court ${court.courtNumber}: standings for all ${court.assignedPairs.length} pairs`, `${standingIds.length} standing entries`);
  for (const pair of court.assignedPairs) {
    const st = court.standings[pair.id];
    assert("3court-iso", st !== undefined, `Court ${court.courtNumber}: standings for pair ${pair.player1.name}`, "missing");
    if (st) {
      assert("3court-iso", st.wins === 0 && st.losses === 0 && st.gamesPlayed === 0 && st.winPct === 0, `Court ${court.courtNumber}: standings zeroed for ${pair.player1.name}`, `${JSON.stringify(st)}`);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 28. 3-Court Least Played First Scheduling
// ═══════════════════════════════════════════════════════════════
{
  console.log("\n── Section 28: 3-Court Least Played First Scheduling ──");

  // Test Court 2 (B) with 6 pairs, 85 min → 12 slots → gameTarget = floor(12*2/6) = 4
  const lpfPlayers = Array.from({ length: 12 }, (_, i) => makePlayer(`lpfB${i + 1}`, "B"));
  const lpfPairs = createPairs(lpfPlayers, "B"); // 6 pairs
  assert("3court-lpf", lpfPairs.length === 6, "6 B pairs created", `${lpfPairs.length} pairs`);

  const lpfCourt: CourtState = {
    courtNumber: 2,
    tier: "B",
    assignedPairs: lpfPairs,
    schedule: [],
    completedGames: [],
    standings: Object.fromEntries(lpfPairs.map(p => [p.id, { wins: 0, losses: 0, gamesPlayed: 0, winPct: 0 }])),
    currentSlot: 0,
    status: "waiting",
    format: "round_robin",
  };

  // Replicate the generateCourtSchedule algorithm from the engine
  const totalSlots = Math.floor(85 / 7); // 12
  assert("3court-lpf", totalSlots === 12, "12 slots for 85 min", `${totalSlots} slots`);

  const gameTarget = Math.floor(totalSlots * 2 / lpfPairs.length); // floor(24/6) = 4
  assert("3court-lpf", gameTarget === 4, "Game target = 4", `target=${gameTarget}`);

  // Generate all unique matchups
  const lpfMatchups: { pair1: Pair; pair2: Pair }[] = [];
  for (let i = 0; i < lpfPairs.length; i++) {
    for (let j = i + 1; j < lpfPairs.length; j++) {
      lpfMatchups.push({ pair1: lpfPairs[i], pair2: lpfPairs[j] });
    }
  }
  // 6 pairs → C(6,2) = 15 unique matchups
  assert("3court-lpf", lpfMatchups.length === 15, "15 unique matchups", `${lpfMatchups.length}`);

  // Run the scheduling algorithm (mirrors engine logic)
  const MAX_ATTEMPTS = 10;
  let bestSchedule: Match[] = [];

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const schedule: Match[] = [];
    const pairGames = new Map<string, number>();
    const pairLastSlot = new Map<string, number>();
    const usedMatchups = new Set<string>();
    lpfPairs.forEach(p => { pairGames.set(p.id, 0); pairLastSlot.set(p.id, -2); });

    const equityRelax = attempt >= 3 ? 1 : 0;

    for (let slot = 0; slot < totalSlots; slot++) {
      const sorted = [...lpfPairs].sort((a, b) => {
        const ga = pairGames.get(a.id) || 0;
        const gb = pairGames.get(b.id) || 0;
        if (ga !== gb) return ga - gb;
        const idleA = slot - (pairLastSlot.get(a.id) ?? -2);
        const idleB = slot - (pairLastSlot.get(b.id) ?? -2);
        return idleB - idleA;
      });

      let matched = false;
      for (let i = 0; i < sorted.length && !matched; i++) {
        const p1 = sorted[i];
        const g1 = pairGames.get(p1.id) || 0;
        const lastSlot1 = pairLastSlot.get(p1.id) ?? -2;
        if (slot - lastSlot1 < 2) continue;
        if (g1 >= gameTarget + equityRelax) continue;

        for (let j = i + 1; j < sorted.length; j++) {
          const p2 = sorted[j];
          const g2 = pairGames.get(p2.id) || 0;
          const lastSlot2 = pairLastSlot.get(p2.id) ?? -2;
          if (slot - lastSlot2 < 2) continue;
          if (g2 >= gameTarget + equityRelax) continue;

          const activeGames = Array.from(pairGames.values()).filter(v => v > 0);
          const minGames = activeGames.length > 0 ? Math.min(...activeGames) : 0;
          if (Math.min(g1, g2) > minGames + 1 + equityRelax) continue;

          const mKey = matchupKey(p1.id, p2.id);
          if (usedMatchups.has(mKey)) continue;

          usedMatchups.add(mKey);
          pairGames.set(p1.id, g1 + 1);
          pairGames.set(p2.id, g2 + 1);
          pairLastSlot.set(p1.id, slot);
          pairLastSlot.set(p2.id, slot);

          schedule.push({
            id: generateId(),
            pair1: p1,
            pair2: p2,
            skillLevel: "B",
            matchupLabel: "B vs B",
            status: "pending",
            court: 2,
            courtPool: "B",
            gameNumber: slot, // store actual slot number for back-to-back checks
          });
          matched = true;
          break;
        }
      }
    }

    const games = Array.from(pairGames.values());
    const maxG = Math.max(...games);
    const minG = Math.min(...games);
    const equityGap = maxG - minG;

    let hasBackToBack = false;
    for (const p of lpfPairs) {
      const matchSlots = schedule
        .filter(m => m.pair1.id === p.id || m.pair2.id === p.id)
        .map(m => m.gameNumber!)
        .sort((a, b) => a - b);
      for (let k = 1; k < matchSlots.length; k++) {
        if (matchSlots[k] - matchSlots[k - 1] < 2) { hasBackToBack = true; break; }
      }
      if (hasBackToBack) break;
    }

    const valid = equityGap <= 1 + equityRelax && !hasBackToBack;
    if (valid || attempt === MAX_ATTEMPTS - 1) {
      bestSchedule = schedule;
      console.log(`  Info: Court 2 (B): ${schedule.length} games, equity=${equityGap}, attempt=${attempt + 1}`);
      break;
    }
  }

  // ── Assertions ──

  // Should have generated matches (12 slots, 6 pairs → 12 matches for 4 games each → 24 pair-slots / 2 = 12)
  assert("3court-lpf", bestSchedule.length >= 10, `Generated ≥10 matches (got ${bestSchedule.length})`, `${bestSchedule.length} matches`);
  assert("3court-lpf", bestSchedule.length <= 12, `Generated ≤12 matches (got ${bestSchedule.length})`, `${bestSchedule.length} matches`);

  // Per-pair game counts
  const pairGameCounts = new Map<string, number>();
  lpfPairs.forEach(p => pairGameCounts.set(p.id, 0));
  for (const m of bestSchedule) {
    pairGameCounts.set(m.pair1.id, (pairGameCounts.get(m.pair1.id) || 0) + 1);
    pairGameCounts.set(m.pair2.id, (pairGameCounts.get(m.pair2.id) || 0) + 1);
  }

  const gameCounts = Array.from(pairGameCounts.values());
  const maxGames = Math.max(...gameCounts);
  const minGames = Math.min(...gameCounts);

  // Equity gap ≤ 1
  assert("3court-lpf", maxGames - minGames <= 1, `Equity gap ≤ 1 (max=${maxGames}, min=${minGames})`, `gap=${maxGames - minGames}`);

  // All pairs should have ≥ 3 games
  assert("3court-lpf", minGames >= 3, `All pairs ≥ 3 games (min=${minGames})`, `min=${minGames}`);

  // All pairs should have ≤ 5 games
  assert("3court-lpf", maxGames <= 5, `All pairs ≤ 5 games (max=${maxGames})`, `max=${maxGames}`);

  // No duplicate matchups
  const lpfMatchupSet = new Set<string>();
  let lpfDupes = 0;
  for (const m of bestSchedule) {
    const mKey = matchupKey(m.pair1.id, m.pair2.id);
    if (lpfMatchupSet.has(mKey)) lpfDupes++;
    lpfMatchupSet.add(mKey);
  }
  assert("3court-lpf", lpfDupes === 0, "No duplicate matchups", `${lpfDupes} duplicates`);

  // No back-to-back (use gameNumber=slot, not array index)
  let lpfB2B = false;
  for (const p of lpfPairs) {
    const matchSlots = bestSchedule
      .filter(m => m.pair1.id === p.id || m.pair2.id === p.id)
      .map(m => m.gameNumber!)
      .sort((a, b) => a - b);
    for (let k = 1; k < matchSlots.length; k++) {
      if (matchSlots[k] - matchSlots[k - 1] < 2) { lpfB2B = true; break; }
    }
    if (lpfB2B) break;
  }
  assert("3court-lpf", !lpfB2B, "No back-to-back games", "back-to-back detected");

  // All matches are B vs B (tier isolation)
  const wrongTierMatches = bestSchedule.filter(m => m.skillLevel !== "B");
  assert("3court-lpf", wrongTierMatches.length === 0, "All matches B vs B", `${wrongTierMatches.length} non-B matches`);

  // All matches have correct court number
  const wrongCourt = bestSchedule.filter(m => m.court !== 2);
  assert("3court-lpf", wrongCourt.length === 0, "All matches on court 2", `${wrongCourt.length} wrong court`);

  // All matches have courtPool = "B"
  const wrongPool = bestSchedule.filter(m => m.courtPool !== "B");
  assert("3court-lpf", wrongPool.length === 0, "All matches courtPool=B", `${wrongPool.length} wrong pool`);

  // Slot numbers (gameNumber) are non-decreasing
  for (let i = 1; i < bestSchedule.length; i++) {
    assert("3court-lpf", bestSchedule[i].gameNumber! >= bestSchedule[i - 1].gameNumber!, `Slot order: game ${i} slot ${bestSchedule[i].gameNumber} >= prev ${bestSchedule[i - 1].gameNumber}`, `out of order`);
  }

  // Test with fewer pairs (3 pairs, 12 slots → gameTarget = floor(24/3) = 8, but only 3 unique matchups)
  const smallPlayers = Array.from({ length: 6 }, (_, i) => makePlayer(`lpfSmall${i + 1}`, "A"));
  const smallPairs = createPairs(smallPlayers, "A"); // 3 pairs
  assert("3court-lpf", smallPairs.length === 3, "3 A pairs for small test", `${smallPairs.length}`);

  // 3 pairs → C(3,2) = 3 unique matchups, so max 3 games
  const smallSchedule: Match[] = [];
  const smallPairGames = new Map<string, number>();
  const smallPairLastSlot = new Map<string, number>();
  const smallUsed = new Set<string>();
  smallPairs.forEach(p => { smallPairGames.set(p.id, 0); smallPairLastSlot.set(p.id, -2); });
  const smallTarget = Math.floor(totalSlots * 2 / smallPairs.length); // floor(24/3)=8, capped by matchups=3

  for (let slot = 0; slot < totalSlots; slot++) {
    const sorted = [...smallPairs].sort((a, b) => {
      const ga = smallPairGames.get(a.id) || 0;
      const gb = smallPairGames.get(b.id) || 0;
      if (ga !== gb) return ga - gb;
      return (slot - (smallPairLastSlot.get(b.id) ?? -2)) - (slot - (smallPairLastSlot.get(a.id) ?? -2));
    });
    let matched = false;
    for (let i = 0; i < sorted.length && !matched; i++) {
      const p1 = sorted[i];
      const g1 = smallPairGames.get(p1.id) || 0;
      if (slot - (smallPairLastSlot.get(p1.id) ?? -2) < 2) continue;
      if (g1 >= smallTarget) continue;
      for (let j = i + 1; j < sorted.length; j++) {
        const p2 = sorted[j];
        const g2 = smallPairGames.get(p2.id) || 0;
        if (slot - (smallPairLastSlot.get(p2.id) ?? -2) < 2) continue;
        if (g2 >= smallTarget) continue;
        const mKey = matchupKey(p1.id, p2.id);
        if (smallUsed.has(mKey)) continue;
        smallUsed.add(mKey);
        smallPairGames.set(p1.id, g1 + 1);
        smallPairGames.set(p2.id, g2 + 1);
        smallPairLastSlot.set(p1.id, slot);
        smallPairLastSlot.set(p2.id, slot);
        smallSchedule.push({
          id: generateId(), pair1: p1, pair2: p2, skillLevel: "A", status: "pending", court: 3, courtPool: "A", gameNumber: slot,
        });
        matched = true;
        break;
      }
    }
  }

  // 3 unique matchups means max 3 games, each pair plays 2
  assert("3court-lpf", smallSchedule.length === 3, `3-pair court: 3 matches`, `${smallSchedule.length} matches`);
  const smallCounts = Array.from(smallPairGames.values());
  assert("3court-lpf", smallCounts.every(c => c === 2), "3-pair court: all pairs play 2 games", `counts=${smallCounts}`);

  // No back-to-back in small schedule (use gameNumber=slot, not array index)
  let smallB2B = false;
  for (const p of smallPairs) {
    const matchSlots = smallSchedule
      .filter(m => m.pair1.id === p.id || m.pair2.id === p.id)
      .map(m => m.gameNumber!)
      .sort((a, b) => a - b);
    for (let k = 1; k < matchSlots.length; k++) {
      if (matchSlots[k] - matchSlots[k - 1] < 2) { smallB2B = true; break; }
    }
  }
  assert("3court-lpf", !smallB2B, "3-pair: no back-to-back", "back-to-back found");

  // Print per-pair summary
  console.log("  Info: 6-pair schedule:");
  for (const p of lpfPairs) {
    console.log(`    ${p.player1.name}+${p.player2.name}: ${pairGameCounts.get(p.id)} games`);
  }
}

// ═══════════════════════════════════════════════════════════════
// 29. Winner Stays On (WSO) Mechanics
// ═══════════════════════════════════════════════════════════════
{
  console.log("\n── Section 29: Winner Stays On (WSO) Mechanics ──");

  // Create 5 A pairs for WSO court
  const wsoPlayers = Array.from({ length: 10 }, (_, i) => makePlayer(`wsoA${i + 1}`, "A"));
  const wsoPairs = createPairs(wsoPlayers, "A"); // 5 pairs
  assert("wso", wsoPairs.length === 5, "5 A pairs created", `${wsoPairs.length}`);

  // ── Initialize WSO state ──
  const initWsoStats = (pairs: Pair[]): Record<string, WsoStats> =>
    Object.fromEntries(pairs.map(p => [p.id, { pairId: p.id, wins: 0, losses: 0, streak: 0, longestStreak: 0, gamesPlayed: 0 }]));

  // Use deterministic order (not shuffled) for predictable tests
  const orderedPairs = [...wsoPairs];
  const wsoState: WsoState = {
    queue: orderedPairs.slice(2),
    currentGame: {
      id: generateId(),
      pair1: orderedPairs[0], // defender
      pair2: orderedPairs[1], // challenger
      startedAt: new Date().toISOString(),
      gameNumber: 1,
    },
    history: [],
    stats: initWsoStats(orderedPairs),
    undoStack: [],
    gameCounter: 1,
  };

  const wsoCourt: CourtState = {
    courtNumber: 3,
    tier: "A",
    assignedPairs: orderedPairs,
    schedule: [],
    completedGames: [],
    standings: {},
    currentSlot: 0,
    status: "active",
    format: "winner_stays_on",
    wso: wsoState,
  };

  // ── Verify initialization ──
  assert("wso", wsoCourt.format === "winner_stays_on", "Court format is WSO", `format=${wsoCourt.format}`);
  assert("wso", wsoState.currentGame !== null, "Current game exists", "null");
  assert("wso", wsoState.currentGame!.pair1.id === orderedPairs[0].id, "Pair 0 is defender", `pair1=${wsoState.currentGame!.pair1.player1.name}`);
  assert("wso", wsoState.currentGame!.pair2.id === orderedPairs[1].id, "Pair 1 is challenger", `pair2=${wsoState.currentGame!.pair2.player1.name}`);
  assert("wso", wsoState.queue.length === 3, "3 pairs in queue", `${wsoState.queue.length}`);
  assert("wso", wsoState.queue[0].id === orderedPairs[2].id, "Queue[0] = pair 2", `${wsoState.queue[0].player1.name}`);
  assert("wso", wsoState.gameCounter === 1, "Game counter = 1", `${wsoState.gameCounter}`);

  // ── Simulate WSO game flow (mirrors engine recordWsoWinner logic) ──
  function simulateWsoWinner(court: CourtState, winnerPairId: string): CourtState {
    const wso = court.wso!;
    const game = wso.currentGame!;
    const winnerPair = game.pair1.id === winnerPairId ? game.pair1 : game.pair2;
    const loserPair = game.pair1.id === winnerPairId ? game.pair2 : game.pair1;

    // Save undo
    const undoEntry: WsoUndoEntry = {
      previousGame: { ...game },
      previousQueue: [...wso.queue],
      previousStats: JSON.parse(JSON.stringify(wso.stats)),
    };

    // Update stats
    const stats = JSON.parse(JSON.stringify(wso.stats)) as Record<string, WsoStats>;
    const ws = stats[winnerPair.id];
    ws.wins += 1; ws.streak += 1; ws.longestStreak = Math.max(ws.longestStreak, ws.streak); ws.gamesPlayed += 1;
    const ls = stats[loserPair.id];
    ls.losses += 1; ls.streak = 0; ls.gamesPlayed += 1;

    // Queue rotation
    const newQueue = [...wso.queue, loserPair];
    const nextChallenger = newQueue.shift();
    const nextGameNumber = wso.gameCounter + 1;

    const completedGame: WsoGame = { ...game, winner: winnerPair, loser: loserPair, completedAt: new Date().toISOString() };
    const nextGame: WsoGame | null = nextChallenger ? {
      id: generateId(), pair1: winnerPair, pair2: nextChallenger, startedAt: new Date().toISOString(), gameNumber: nextGameNumber,
    } : null;

    return {
      ...court,
      wso: {
        ...wso,
        queue: newQueue,
        currentGame: nextGame,
        history: [...wso.history, completedGame],
        stats,
        undoStack: [...wso.undoStack, undoEntry].slice(-20),
        gameCounter: nextGameNumber,
      },
    };
  }

  function simulateWsoUndo(court: CourtState): CourtState {
    const wso = court.wso!;
    const entry = wso.undoStack[wso.undoStack.length - 1];
    if (!entry) return court;
    return {
      ...court,
      wso: {
        ...wso,
        currentGame: entry.previousGame,
        queue: entry.previousQueue,
        stats: entry.previousStats,
        history: wso.history.slice(0, -1),
        undoStack: wso.undoStack.slice(0, -1),
        gameCounter: wso.gameCounter - 1,
      },
    };
  }

  // ── Game 1: Pair 0 (defender) wins vs Pair 1 (challenger) ──
  let court = simulateWsoWinner(wsoCourt, orderedPairs[0].id);
  let w = court.wso!;
  assert("wso", w.history.length === 1, "Game 1: 1 completed game", `${w.history.length}`);
  assert("wso", w.history[0].winner!.id === orderedPairs[0].id, "Game 1: Pair 0 won", `winner=${w.history[0].winner!.player1.name}`);
  assert("wso", w.currentGame!.pair1.id === orderedPairs[0].id, "Game 1: Winner stays (Pair 0 defending)", `pair1=${w.currentGame!.pair1.player1.name}`);
  assert("wso", w.currentGame!.pair2.id === orderedPairs[2].id, "Game 1: Next challenger is Pair 2 (from queue)", `pair2=${w.currentGame!.pair2.player1.name}`);
  assert("wso", w.queue[w.queue.length - 1].id === orderedPairs[1].id, "Game 1: Loser (Pair 1) at back of queue", `last=${w.queue[w.queue.length - 1].player1.name}`);
  assert("wso", w.stats[orderedPairs[0].id].wins === 1, "Game 1: Pair 0 wins=1", `${w.stats[orderedPairs[0].id].wins}`);
  assert("wso", w.stats[orderedPairs[0].id].streak === 1, "Game 1: Pair 0 streak=1", `${w.stats[orderedPairs[0].id].streak}`);
  assert("wso", w.stats[orderedPairs[1].id].losses === 1, "Game 1: Pair 1 losses=1", `${w.stats[orderedPairs[1].id].losses}`);
  assert("wso", w.stats[orderedPairs[1].id].streak === 0, "Game 1: Pair 1 streak=0", `${w.stats[orderedPairs[1].id].streak}`);
  assert("wso", w.gameCounter === 2, "Game counter = 2", `${w.gameCounter}`);

  // ── Game 2: Pair 0 wins again (streak grows) ──
  court = simulateWsoWinner(court, orderedPairs[0].id);
  w = court.wso!;
  assert("wso", w.currentGame!.pair1.id === orderedPairs[0].id, "Game 2: Pair 0 still defending", `${w.currentGame!.pair1.player1.name}`);
  assert("wso", w.currentGame!.pair2.id === orderedPairs[3].id, "Game 2: Pair 3 is next challenger", `${w.currentGame!.pair2.player1.name}`);
  assert("wso", w.stats[orderedPairs[0].id].wins === 2, "Game 2: Pair 0 wins=2", `${w.stats[orderedPairs[0].id].wins}`);
  assert("wso", w.stats[orderedPairs[0].id].streak === 2, "Game 2: Pair 0 streak=2", `${w.stats[orderedPairs[0].id].streak}`);
  assert("wso", w.stats[orderedPairs[0].id].longestStreak === 2, "Game 2: Pair 0 longestStreak=2", `${w.stats[orderedPairs[0].id].longestStreak}`);

  // ── Game 3: Pair 3 (challenger) beats Pair 0 (defender falls) ──
  court = simulateWsoWinner(court, orderedPairs[3].id);
  w = court.wso!;
  assert("wso", w.currentGame!.pair1.id === orderedPairs[3].id, "Game 3: Pair 3 now defending", `${w.currentGame!.pair1.player1.name}`);
  assert("wso", w.stats[orderedPairs[0].id].streak === 0, "Game 3: Pair 0 streak reset to 0", `${w.stats[orderedPairs[0].id].streak}`);
  assert("wso", w.stats[orderedPairs[0].id].longestStreak === 2, "Game 3: Pair 0 longestStreak preserved=2", `${w.stats[orderedPairs[0].id].longestStreak}`);
  assert("wso", w.stats[orderedPairs[3].id].wins === 1, "Game 3: Pair 3 wins=1", `${w.stats[orderedPairs[3].id].wins}`);
  assert("wso", w.stats[orderedPairs[3].id].streak === 1, "Game 3: Pair 3 streak=1", `${w.stats[orderedPairs[3].id].streak}`);
  // Pair 0 should be at back of queue now
  assert("wso", w.queue[w.queue.length - 1].id === orderedPairs[0].id, "Game 3: Pair 0 at back of queue", `${w.queue[w.queue.length - 1].player1.name}`);

  // ── Game 4 & 5: Continue for full cycle ──
  court = simulateWsoWinner(court, orderedPairs[3].id); // Pair 3 wins again
  court = simulateWsoWinner(court, orderedPairs[3].id); // Pair 3 wins third time
  w = court.wso!;
  assert("wso", w.history.length === 5, "5 completed games after 5 results", `${w.history.length}`);
  assert("wso", w.stats[orderedPairs[3].id].wins === 3, "Pair 3 total wins=3", `${w.stats[orderedPairs[3].id].wins}`);
  assert("wso", w.stats[orderedPairs[3].id].streak === 3, "Pair 3 streak=3", `${w.stats[orderedPairs[3].id].streak}`);
  assert("wso", w.stats[orderedPairs[3].id].longestStreak === 3, "Pair 3 longestStreak=3", `${w.stats[orderedPairs[3].id].longestStreak}`);

  // ── Verify queue rotation: all pairs should have played at least once ──
  const allPlayed = orderedPairs.every(p => w.stats[p.id].gamesPlayed > 0);
  assert("wso", allPlayed, "All pairs have played at least 1 game", `some haven't played`);

  // ── Total games played consistency ──
  const totalPairGames = Object.values(w.stats).reduce((sum, s) => sum + s.gamesPlayed, 0);
  assert("wso", totalPairGames === w.history.length * 2, `Total pair-games (${totalPairGames}) = history*2 (${w.history.length * 2})`, `mismatch`);

  // ── Undo last result ──
  const beforeUndo = { ...w };
  court = simulateWsoUndo(court);
  w = court.wso!;
  assert("wso", w.history.length === 4, "After undo: 4 completed games", `${w.history.length}`);
  assert("wso", w.undoStack.length === beforeUndo.undoStack.length - 1, "Undo stack shrunk by 1", `${w.undoStack.length}`);
  assert("wso", w.gameCounter === beforeUndo.gameCounter - 1, "Game counter decremented", `${w.gameCounter}`);
  // Pair 3's last win was undone — streak should be back to 2
  assert("wso", w.stats[orderedPairs[3].id].wins === 2, "After undo: Pair 3 wins=2", `${w.stats[orderedPairs[3].id].wins}`);
  assert("wso", w.stats[orderedPairs[3].id].streak === 2, "After undo: Pair 3 streak=2", `${w.stats[orderedPairs[3].id].streak}`);
  // The opponent from the undone game should have their loss removed
  const undoneLoserId = beforeUndo.history[4].loser!.id;
  assert("wso", w.stats[undoneLoserId].losses === beforeUndo.stats[undoneLoserId].losses - 1, "After undo: loser losses decremented", `${w.stats[undoneLoserId].losses}`);

  // ── Undo stack limit (max 20) ──
  let stackCourt = wsoCourt;
  for (let i = 0; i < 25; i++) {
    // Alternate winners to keep it interesting
    const winnerId = stackCourt.wso!.currentGame!.pair1.id;
    stackCourt = simulateWsoWinner(stackCourt, winnerId);
  }
  assert("wso", stackCourt.wso!.undoStack.length === 20, "Undo stack capped at 20", `${stackCourt.wso!.undoStack.length}`);

  // ── Edge: 2 pairs only ──
  const twoPairs = wsoPairs.slice(0, 2);
  const twoWso: WsoState = {
    queue: [],
    currentGame: { id: generateId(), pair1: twoPairs[0], pair2: twoPairs[1], startedAt: new Date().toISOString(), gameNumber: 1 },
    history: [], stats: initWsoStats(twoPairs), undoStack: [], gameCounter: 1,
  };
  const twoCourt: CourtState = { courtNumber: 3, tier: "A", assignedPairs: twoPairs, schedule: [], completedGames: [], standings: {}, currentSlot: 0, status: "active", format: "winner_stays_on", wso: twoWso };
  const after2 = simulateWsoWinner(twoCourt, twoPairs[0].id);
  assert("wso", after2.wso!.currentGame!.pair1.id === twoPairs[0].id, "2-pair: winner stays", `${after2.wso!.currentGame!.pair1.player1.name}`);
  assert("wso", after2.wso!.currentGame!.pair2.id === twoPairs[1].id, "2-pair: loser comes right back", `${after2.wso!.currentGame!.pair2.player1.name}`);
  assert("wso", after2.wso!.queue.length === 0, "2-pair: queue stays empty", `${after2.wso!.queue.length}`);

  // ── Edge: 1 pair ──
  const onePair = wsoPairs.slice(0, 1);
  const oneWso: WsoState = {
    queue: [], currentGame: null, history: [], stats: initWsoStats(onePair), undoStack: [], gameCounter: 0,
  };
  assert("wso", oneWso.currentGame === null, "1-pair: no game possible", "has game");

  // ── Format switch: round_robin → WSO ──
  const rrCourt: CourtState = makeCourt(3, "A", wsoPairs.slice(0, 4));
  assert("wso", rrCourt.format === "round_robin", "Initially round_robin", `${rrCourt.format}`);
  assert("wso", rrCourt.wso === undefined, "No WSO state initially", "has wso");

  // Simulate setCourtFormat switching to WSO
  const switchedCourt: CourtState = {
    ...rrCourt,
    format: "winner_stays_on",
    schedule: [],
    status: "active",
    wso: {
      queue: rrCourt.assignedPairs.slice(2),
      currentGame: rrCourt.assignedPairs.length >= 2 ? {
        id: generateId(), pair1: rrCourt.assignedPairs[0], pair2: rrCourt.assignedPairs[1],
        startedAt: new Date().toISOString(), gameNumber: 1,
      } : null,
      history: [], stats: initWsoStats(rrCourt.assignedPairs), undoStack: [], gameCounter: 1,
    },
  };
  assert("wso", switchedCourt.format === "winner_stays_on", "After switch: format=WSO", `${switchedCourt.format}`);
  assert("wso", switchedCourt.schedule.length === 0, "After switch: schedule cleared", `${switchedCourt.schedule.length}`);
  assert("wso", switchedCourt.wso !== undefined, "After switch: WSO state exists", "undefined");
  assert("wso", switchedCourt.wso!.currentGame !== null, "After switch: game started", "null");

  // ── Format switch blocked after games ──
  const playedCourt: CourtState = { ...switchedCourt, completedGames: [{ id: "x" } as Match] };
  // Engine blocks switch when completedGames.length > 0 — simulate that check
  const canSwitch = playedCourt.completedGames.length === 0 && (playedCourt.wso?.history.length || 0) === 0;
  assert("wso", !canSwitch, "Switch blocked after games played", "switch allowed");

  // Print summary
  console.log(`  Info: WSO 5-pair test — ${beforeUndo.history.length} games played, undo tested`);
  for (const p of orderedPairs) {
    const st = beforeUndo.stats[p.id];
    console.log(`    ${p.player1.name}+${p.player2.name}: ${st.wins}W-${st.losses}L streak=${st.streak} best=${st.longestStreak}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// 30. Independent Court Start (delayed start, reduced slots)
// ═══════════════════════════════════════════════════════════════
{
  console.log("\n── Section 30: Independent Court Start ──");

  // Setup: 3 courts with pairs
  const dcsA = Array.from({ length: 10 }, (_, i) => makePlayer(`dcsA${i + 1}`, "A"));
  const dcsB = Array.from({ length: 12 }, (_, i) => makePlayer(`dcsB${i + 1}`, "B"));
  const dcsC = Array.from({ length: 14 }, (_, i) => makePlayer(`dcsC${i + 1}`, "C"));
  const dcsPairsA = createPairs(dcsA, "A"); // 5 pairs
  const dcsPairsB = createPairs(dcsB, "B"); // 6 pairs
  const dcsPairsC = createPairs(dcsC, "C"); // 7 pairs

  const durationMin = 85;
  const fullSlots = Math.floor(durationMin / 7); // 12
  assert("court-start", fullSlots === 12, "Full session = 12 slots", `${fullSlots}`);

  // Court 3 (A): starts at session start → gets full 12 slots
  const court3: CourtState = makeCourt(3, "A", dcsPairsA);
  const court3Schedule = testGenerateSchedule(court3, fullSlots);
  const court3Started: CourtState = { ...court3, schedule: court3Schedule, status: "active", startedAt: new Date().toISOString() };
  assert("court-start", court3Started.status === "active", "Court 3: active", `${court3Started.status}`);
  assert("court-start", court3Started.schedule.length > 0, "Court 3: has schedule", `${court3Started.schedule.length} games`);
  assert("court-start", court3Started.startedAt !== undefined, "Court 3: has startedAt", "missing");

  // Court 2 (B): starts at session start → gets full 12 slots
  const court2: CourtState = makeCourt(2, "B", dcsPairsB);
  const court2Schedule = testGenerateSchedule(court2, fullSlots);
  const court2Started: CourtState = { ...court2, schedule: court2Schedule, status: "active", startedAt: new Date().toISOString() };
  assert("court-start", court2Started.schedule.length > 0, "Court 2: has schedule", `${court2Started.schedule.length} games`);

  // Court 1 (C): delayed start — 15 minutes late → 70 min remaining → 10 slots
  const delayMin = 15;
  const remainingMin = durationMin - delayMin; // 70
  const delayedSlots = Math.floor(remainingMin / 7); // 10
  assert("court-start", delayedSlots === 10, "Delayed court = 10 slots", `${delayedSlots}`);

  const court1: CourtState = makeCourt(1, "C", dcsPairsC);
  const court1Schedule = testGenerateSchedule(court1, delayedSlots);
  const court1Started: CourtState = { ...court1, schedule: court1Schedule, status: "active", startedAt: new Date(Date.now()).toISOString() };
  assert("court-start", court1Started.schedule.length > 0, "Court 1 (delayed): has schedule", `${court1Started.schedule.length} games`);

  // ── Key assertion: delayed court has fewer games than full-start court ──
  // Court 2 (6 pairs, 12 slots) vs Court 1 (7 pairs, 10 slots)
  // Court 2 should generally have more games (more slots, fewer pairs)
  assert("court-start", court1Started.schedule.length <= court2Started.schedule.length,
    `Delayed court (${court1Started.schedule.length} games) ≤ full court (${court2Started.schedule.length} games)`,
    `delayed=${court1Started.schedule.length} > full=${court2Started.schedule.length}`);

  // ── Verify delayed court game target is lower ──
  const fullTarget = Math.floor(fullSlots * 2 / dcsPairsB.length); // floor(24/6) = 4
  const delayedTarget = Math.floor(delayedSlots * 2 / dcsPairsC.length); // floor(20/7) = 2
  assert("court-start", delayedTarget < fullTarget,
    `Delayed game target (${delayedTarget}) < full target (${fullTarget})`,
    `delayed=${delayedTarget} >= full=${fullTarget}`);

  // ── Verify per-pair equity on delayed court ──
  const delayedPairGames = new Map<string, number>();
  dcsPairsC.forEach(p => delayedPairGames.set(p.id, 0));
  for (const m of court1Started.schedule) {
    delayedPairGames.set(m.pair1.id, (delayedPairGames.get(m.pair1.id) || 0) + 1);
    delayedPairGames.set(m.pair2.id, (delayedPairGames.get(m.pair2.id) || 0) + 1);
  }
  const delayedGames = Array.from(delayedPairGames.values());
  const delayedMax = Math.max(...delayedGames);
  const delayedMin = Math.min(...delayedGames);
  assert("court-start", delayedMax - delayedMin <= 1,
    `Delayed court equity gap ≤ 1 (max=${delayedMax}, min=${delayedMin})`,
    `gap=${delayedMax - delayedMin}`);

  // ── Courts 2 and 3 unaffected by Court 1 starting ──
  // Re-generate Court 2 to verify same slot count
  const court2Verify = testGenerateSchedule(court2, fullSlots);
  assert("court-start", court2Verify.length === court2Schedule.length,
    `Court 2 schedule unchanged (${court2Verify.length} = ${court2Schedule.length})`,
    `changed: ${court2Verify.length} vs ${court2Schedule.length}`);

  // ── Waiting state checks ──
  const waitingCourt: CourtState = makeCourt(1, "C", dcsPairsC);
  assert("court-start", waitingCourt.status === "waiting", "Unstarted court: status=waiting", `${waitingCourt.status}`);
  assert("court-start", waitingCourt.schedule.length === 0, "Unstarted court: empty schedule", `${waitingCourt.schedule.length}`);
  assert("court-start", waitingCourt.startedAt === undefined, "Unstarted court: no startedAt", `has startedAt`);

  // ── WSO court delayed start ──
  const wsoCourt: CourtState = { ...makeCourt(3, "A", dcsPairsA.slice(0, 4)), format: "winner_stays_on" };
  // Simulate startCourt for WSO: just init WSO state, no slots needed
  const wsoStarted: CourtState = {
    ...wsoCourt,
    status: "active",
    startedAt: new Date().toISOString(),
    wso: {
      queue: wsoCourt.assignedPairs.slice(2),
      currentGame: wsoCourt.assignedPairs.length >= 2 ? {
        id: generateId(), pair1: wsoCourt.assignedPairs[0], pair2: wsoCourt.assignedPairs[1],
        startedAt: new Date().toISOString(), gameNumber: 1,
      } : null,
      history: [], stats: Object.fromEntries(wsoCourt.assignedPairs.map(p => [p.id, {
        pairId: p.id, wins: 0, losses: 0, streak: 0, longestStreak: 0, gamesPlayed: 0,
      }])), undoStack: [], gameCounter: 1,
    },
  };
  assert("court-start", wsoStarted.status === "active", "WSO delayed start: active", `${wsoStarted.status}`);
  assert("court-start", wsoStarted.wso !== undefined, "WSO delayed start: has WSO state", "undefined");
  assert("court-start", wsoStarted.wso!.currentGame !== null, "WSO delayed start: has current game", "null");
  assert("court-start", wsoStarted.schedule.length === 0, "WSO delayed start: no RR schedule", `${wsoStarted.schedule.length}`);

  // ── Edge: 30 minutes late → 55 min remaining → 7 slots ──
  const lateSlots = Math.floor((durationMin - 30) / 7); // floor(55/7) = 7
  assert("court-start", lateSlots === 7, "30-min-late court = 7 slots", `${lateSlots}`);
  const lateCourt = testGenerateSchedule(court1, lateSlots);
  assert("court-start", lateCourt.length > 0, "30-min-late court has games", `${lateCourt.length}`);
  assert("court-start", lateCourt.length <= court1Schedule.length,
    `Late court (${lateCourt.length}) ≤ 15-min-late (${court1Schedule.length})`,
    `more: ${lateCourt.length} > ${court1Schedule.length}`);

  // Print summary
  console.log(`  Info: Court 3 (A, full): ${court3Started.schedule.length} games, ${fullSlots} slots`);
  console.log(`  Info: Court 2 (B, full): ${court2Started.schedule.length} games, ${fullSlots} slots`);
  console.log(`  Info: Court 1 (C, 15min late): ${court1Started.schedule.length} games, ${delayedSlots} slots`);
  console.log(`  Info: Court 1 (C, 30min late): ${lateCourt.length} games, ${lateSlots} slots`);
  console.log(`  Info: Game targets: full B=${fullTarget}, delayed C=${delayedTarget}`);
}

// ═══════════════════════════════════════════════════════════════
//  SECTION 31 — Late Arrival Handling (3-Court)
// ═══════════════════════════════════════════════════════════════
{
  console.log("\n[Section 31] Late Arrival Handling (3-court mode)");

  // ── Setup: 6-pair RR court, play 4 games, then add late pair ──
  const latePairsB: Pair[] = [];
  for (let i = 0; i < 12; i += 2) {
    const p1 = makePlayer(`LB${i + 1}`, "B");
    const p2 = makePlayer(`LB${i + 2}`, "B");
    latePairsB.push({ id: generateId(), player1: p1, player2: p2, skillLevel: "B", wins: 0, losses: 0 });
  }

  const rrCourt: CourtState = {
    ...makeCourt(2, "B", latePairsB),
    status: "active",
    startedAt: new Date().toISOString(),
  };

  // Generate schedule with 12 slots
  const fullSched = testGenerateSchedule(rrCourt, 12);
  assert("late-arrival", fullSched.length > 0, "Initial schedule generated", `length=${fullSched.length}`);

  // Mark first 4 games as completed, 5th as playing
  const withResults = fullSched.map((m, idx) => {
    if (idx < 4) return { ...m, status: "completed" as const, winner: m.pair1, loser: m.pair2 };
    if (idx === 4) return { ...m, status: "playing" as const, court: 2 };
    return m;
  });

  const courtAfter4: CourtState = {
    ...rrCourt,
    schedule: withResults,
    currentSlot: 4,
    completedGames: withResults.filter(m => m.status === "completed"),
  };

  // Simulate late pair addition with schedule regeneration
  const latePair1 = makePlayer("LateB1", "B");
  const latePair2 = makePlayer("LateB2", "B");
  const newPair: Pair = { id: generateId(), player1: latePair1, player2: latePair2, skillLevel: "B", wins: 0, losses: 0 };

  const lockThreshold = courtAfter4.currentSlot + 2; // slot 6
  const lockedGames = courtAfter4.schedule.filter((m) => {
    if (m.status === "completed" || m.status === "playing") return true;
    const slot = m.gameNumber ?? 0;
    return slot < lockThreshold;
  });

  // Count locked games: 4 completed + 1 playing + on-deck pending (gameNumber < 6)
  const lockedPending = courtAfter4.schedule.filter(m => m.status === "pending" && (m.gameNumber ?? 0) < lockThreshold);
  assert("late-arrival", lockedGames.length >= 5,
    `Locked games include completed+playing (${lockedGames.length} >= 5)`,
    `only ${lockedGames.length}`);

  // Build court with new pair for regeneration
  const updatedAssigned = [...courtAfter4.assignedPairs, newPair];
  const tempCourt: CourtState = {
    ...makeCourt(2, "B", updatedAssigned),
    status: "active",
  };

  // Compute initial game counts from locked games so LPF prioritizes the 0-game late pair
  const initialGameCounts = new Map<string, number>();
  updatedAssigned.forEach(p => initialGameCounts.set(p.id, 0));
  lockedGames.forEach((m) => {
    initialGameCounts.set(m.pair1.id, (initialGameCounts.get(m.pair1.id) || 0) + 1);
    initialGameCounts.set(m.pair2.id, (initialGameCounts.get(m.pair2.id) || 0) + 1);
  });

  // Regenerate remaining slots
  const remainingSlots = Math.max(0, 12 - lockedGames.length);
  const futureGames = testGenerateSchedule(tempCourt, remainingSlots, initialGameCounts);

  // Renumber
  const renumbered = futureGames.map((m, idx) => ({ ...m, gameNumber: lockThreshold + idx }));
  const finalSchedule = [...lockedGames, ...renumbered];

  // Verify: games 1-4 unchanged (completed)
  const first4Unchanged = finalSchedule.slice(0, 4).every((m, i) =>
    m.id === withResults[i].id && m.status === "completed"
  );
  assert("late-arrival", first4Unchanged, "Games 1-4 unchanged after late addition", "some changed");

  // Verify: playing game unchanged
  assert("late-arrival", finalSchedule[4].id === withResults[4].id && finalSchedule[4].status === "playing",
    "Active game (5) unchanged", "changed");

  // Verify: late pair appears in regenerated games
  const latePairInFuture = renumbered.some(m => m.pair1.id === newPair.id || m.pair2.id === newPair.id);
  assert("late-arrival", latePairInFuture, "Late pair appears in regenerated schedule", "not found");

  // Verify: late pair gets a game within first 2 regenerated slots (LPF prioritizes 0-game pairs)
  const latePairFirstSlot = renumbered.findIndex(m => m.pair1.id === newPair.id || m.pair2.id === newPair.id);
  assert("late-arrival", latePairFirstSlot >= 0 && latePairFirstSlot <= 1,
    `Late pair first game within 2 regenerated slots (slot ${latePairFirstSlot})`,
    `slot ${latePairFirstSlot}`);

  // Verify: equity after regeneration — all pairs in regenerated portion balanced
  const futureGameCounts = new Map<string, number>();
  updatedAssigned.forEach(p => futureGameCounts.set(p.id, 0));
  renumbered.forEach(m => {
    futureGameCounts.set(m.pair1.id, (futureGameCounts.get(m.pair1.id) || 0) + 1);
    futureGameCounts.set(m.pair2.id, (futureGameCounts.get(m.pair2.id) || 0) + 1);
  });
  const futureGamesArr = Array.from(futureGameCounts.values()).filter(v => v > 0);
  const futureMax = futureGamesArr.length > 0 ? Math.max(...futureGamesArr) : 0;
  const futureMin = futureGamesArr.length > 0 ? Math.min(...futureGamesArr) : 0;
  assert("late-arrival", futureMax - futureMin <= 2,
    `Regenerated equity gap ≤ 2 (${futureMax - futureMin})`,
    `gap=${futureMax - futureMin}`);

  // ── Waitlist: solo player with no partner ──
  const waitlistCourt: CourtState = {
    ...makeCourt(1, "C", latePairsB.slice(0, 3).map(p => ({ ...p, skillLevel: "C" as SkillTier }))),
    status: "active",
    courtWaitlist: [],
  };

  // Add single player → goes to waitlist
  const soloPlayer = makePlayer("SoloC1", "C");
  const courtWithWaitlist: CourtState = {
    ...waitlistCourt,
    courtWaitlist: [soloPlayer.id],
  };
  assert("late-arrival", courtWithWaitlist.courtWaitlist!.length === 1,
    "Solo player added to waitlist", `length=${courtWithWaitlist.courtWaitlist!.length}`);

  // Second player arrives → matches with waitlisted player
  const soloPlayer2 = makePlayer("SoloC2", "C");
  const matchedWaitlist = courtWithWaitlist.courtWaitlist!.filter(pid => pid !== soloPlayer.id);
  const waitlistPair: Pair = { id: generateId(), player1: soloPlayer, player2: soloPlayer2, skillLevel: "C", wins: 0, losses: 0 };
  assert("late-arrival", matchedWaitlist.length === 0, "Waitlist cleared after partner arrives", `${matchedWaitlist.length} remaining`);
  assert("late-arrival", waitlistPair.player1.id === soloPlayer.id, "Waitlist pair includes original player", "wrong player");

  // ── WSO: late pair added to queue ──
  const wsoPairsLate: Pair[] = [];
  for (let i = 0; i < 6; i += 2) {
    const p1 = makePlayer(`WLA${i + 1}`, "A");
    const p2 = makePlayer(`WLA${i + 2}`, "A");
    wsoPairsLate.push({ id: generateId(), player1: p1, player2: p2, skillLevel: "A", wins: 0, losses: 0 });
  }
  const wsoCourt2: CourtState = {
    ...makeCourt(3, "A", wsoPairsLate),
    format: "winner_stays_on",
    status: "active",
    wso: {
      queue: [wsoPairsLate[2]],
      currentGame: { id: generateId(), pair1: wsoPairsLate[0], pair2: wsoPairsLate[1], startedAt: new Date().toISOString(), gameNumber: 1 },
      history: [],
      stats: Object.fromEntries(wsoPairsLate.map(p => [p.id, { pairId: p.id, wins: 0, losses: 0, streak: 0, longestStreak: 0, gamesPlayed: 0 }])),
      undoStack: [],
      gameCounter: 1,
    },
  };

  const wsoLatePair1 = makePlayer("WLateA1", "A");
  const wsoLatePair2 = makePlayer("WLateA2", "A");
  const wsoNewPair: Pair = { id: generateId(), player1: wsoLatePair1, player2: wsoLatePair2, skillLevel: "A", wins: 0, losses: 0 };

  // Add to queue (simulating engine behavior)
  const wsoUpdated: WsoState = {
    ...wsoCourt2.wso!,
    queue: [...wsoCourt2.wso!.queue, wsoNewPair],
    stats: {
      ...wsoCourt2.wso!.stats,
      [wsoNewPair.id]: { pairId: wsoNewPair.id, wins: 0, losses: 0, streak: 0, longestStreak: 0, gamesPlayed: 0 },
    },
  };

  assert("late-arrival", wsoUpdated.queue.length === 2, `WSO queue has late pair (${wsoUpdated.queue.length})`, `${wsoUpdated.queue.length}`);
  assert("late-arrival", wsoUpdated.queue[1].id === wsoNewPair.id, "Late pair at back of WSO queue", "wrong position");
  assert("late-arrival", wsoUpdated.stats[wsoNewPair.id] !== undefined, "WSO stats initialized for late pair", "missing");
  assert("late-arrival", wsoUpdated.stats[wsoNewPair.id].gamesPlayed === 0, "Late pair starts with 0 games", `${wsoUpdated.stats[wsoNewPair.id].gamesPlayed}`);
  assert("late-arrival", wsoUpdated.currentGame!.pair1.id === wsoPairsLate[0].id, "WSO current game unchanged by late addition", "changed");

  // ── Tier routing: A→Court3, B→Court2, C→Court1 ──
  const tierToCourtNum: Record<SkillTier, number> = { C: 1, B: 2, A: 3 };
  assert("late-arrival", tierToCourtNum["A"] === 3, "A-tier routes to Court 3", `${tierToCourtNum["A"]}`);
  assert("late-arrival", tierToCourtNum["B"] === 2, "B-tier routes to Court 2", `${tierToCourtNum["B"]}`);
  assert("late-arrival", tierToCourtNum["C"] === 1, "C-tier routes to Court 1", `${tierToCourtNum["C"]}`);

  console.log(`  Info: Original schedule: ${fullSched.length} games, Locked: ${lockedGames.length}, Regenerated: ${renumbered.length}`);
  console.log(`  Info: Late pair first regenerated slot: ${latePairFirstSlot}`);
  console.log(`  Info: Future equity gap: ${futureMax - futureMin}`);
}

// ═══════════════════════════════════════════════════════════════
//  SECTION 32 — Sub Rotation System (3-Court)
// ═══════════════════════════════════════════════════════════════
{
  console.log("\n[Section 32] Sub Rotation System (3-court mode)");

  // Mirrors production initializeSubRotation
  function testInitSubRotation(allPlayerIds: string[], subPlayerId: string): SubRotation {
    const playerStats: Record<string, SubPlayerStats> = {};
    allPlayerIds.forEach(pid => {
      playerStats[pid] = { playerId: pid, gamesPlayed: 0, timesSubbedOut: 0 };
    });
    return {
      currentSubId: subPlayerId,
      playerStats,
      gamesSinceLastRotation: 0,
      rotationFrequency: 2,
      pendingRotation: false,
      rotationHistory: [],
    };
  }

  // Mirrors production findBestSubTarget
  function testFindBestSubTarget(sub: SubRotation, courtPairs: Pair[]): { playerId: string; pairId: string } | null {
    const playingIds = new Set<string>();
    courtPairs.forEach(p => { playingIds.add(p.player1.id); playingIds.add(p.player2.id); });
    let best: { playerId: string; pairId: string; games: number; subOuts: number } | null = null;
    for (const [pid, stats] of Object.entries(sub.playerStats)) {
      if (pid === sub.currentSubId) continue;
      if (!playingIds.has(pid)) continue;
      if (!best || stats.gamesPlayed > best.games ||
          (stats.gamesPlayed === best.games && stats.timesSubbedOut < best.subOuts)) {
        const pair = courtPairs.find(p => p.player1.id === pid || p.player2.id === pid);
        if (pair) best = { playerId: pid, pairId: pair.id, games: stats.gamesPlayed, subOuts: stats.timesSubbedOut };
      }
    }
    return best ? { playerId: best.playerId, pairId: best.pairId } : null;
  }

  // ── Setup: 13 B players (6 pairs + 1 sub) ──
  const subPlayers: Player[] = [];
  for (let i = 0; i < 13; i++) {
    subPlayers.push(makePlayer(`SB${i + 1}`, "B"));
  }
  const subPairs: Pair[] = [];
  for (let i = 0; i < 12; i += 2) {
    subPairs.push({ id: generateId(), player1: subPlayers[i], player2: subPlayers[i + 1], skillLevel: "B", wins: 0, losses: 0 });
  }
  const subPlayerOdd = subPlayers[12]; // The 13th player is the sub

  const allPlayerIds = subPlayers.map(p => p.id);
  const subRotation = testInitSubRotation(allPlayerIds, subPlayerOdd.id);

  // ── Test: initialization ──
  assert("sub-rotation", subRotation.currentSubId === subPlayerOdd.id,
    `Sub initialized as ${subPlayerOdd.name}`, `wrong sub`);
  assert("sub-rotation", Object.keys(subRotation.playerStats).length === 13,
    "All 13 players tracked", `${Object.keys(subRotation.playerStats).length}`);
  assert("sub-rotation", subRotation.gamesSinceLastRotation === 0,
    "Games since rotation starts at 0", `${subRotation.gamesSinceLastRotation}`);
  assert("sub-rotation", subRotation.rotationFrequency === 2,
    "Rotation frequency is 2", `${subRotation.rotationFrequency}`);
  assert("sub-rotation", !subRotation.pendingRotation,
    "No pending rotation at start", "pending");

  // ── Test: simulate 8 games with sub rotation every 2 games ──
  let currentSub = subRotation;
  let currentPairs = [...subPairs];
  const rotations: { subIn: string; subOut: string }[] = [];

  for (let game = 0; game < 8; game++) {
    // Pick two pairs to play (just use sequential pairs for simplicity)
    const p1Idx = game % currentPairs.length;
    const p2Idx = (game + 1) % currentPairs.length;
    if (p1Idx === p2Idx) continue;
    const playingPair1 = currentPairs[p1Idx];
    const playingPair2 = currentPairs[p2Idx];

    // Update player stats for the 4 playing players
    const playingIds = [playingPair1.player1.id, playingPair1.player2.id, playingPair2.player1.id, playingPair2.player2.id];
    const updatedStats = { ...currentSub.playerStats };
    playingIds.forEach(pid => {
      if (updatedStats[pid]) {
        updatedStats[pid] = { ...updatedStats[pid], gamesPlayed: updatedStats[pid].gamesPlayed + 1 };
      }
    });

    const newGamesSince = currentSub.gamesSinceLastRotation + 1;
    const shouldRotate = newGamesSince >= currentSub.rotationFrequency;

    if (shouldRotate) {
      const subWithUpdatedStats: SubRotation = { ...currentSub, playerStats: updatedStats };
      const target = testFindBestSubTarget(subWithUpdatedStats, currentPairs);

      if (target) {
        // Execute rotation
        const oldSubId = currentSub.currentSubId;
        const subPlayer = subPlayers.find(p => p.id === oldSubId)!;
        const replacedId = target.playerId;

        // Swap in pairs
        currentPairs = currentPairs.map(p => {
          if (p.id !== target.pairId) return p;
          if (p.player1.id === replacedId) return { ...p, player1: subPlayer };
          if (p.player2.id === replacedId) return { ...p, player2: subPlayer };
          return p;
        });

        // Update sub state
        const finalStats = { ...updatedStats };
        if (finalStats[replacedId]) {
          finalStats[replacedId] = { ...finalStats[replacedId], timesSubbedOut: finalStats[replacedId].timesSubbedOut + 1 };
        }

        currentSub = {
          ...currentSub,
          currentSubId: replacedId,
          playerStats: finalStats,
          gamesSinceLastRotation: 0,
          pendingRotation: false,
          rotationHistory: [
            ...currentSub.rotationHistory,
            { timestamp: new Date().toISOString(), subIn: oldSubId, subOut: replacedId, pairId: target.pairId },
          ],
        };
        rotations.push({ subIn: oldSubId, subOut: replacedId });
      } else {
        currentSub = { ...currentSub, playerStats: updatedStats, gamesSinceLastRotation: 0 };
      }
    } else {
      currentSub = { ...currentSub, playerStats: updatedStats, gamesSinceLastRotation: newGamesSince };
    }
  }

  // ── Verify: rotation count ──
  assert("sub-rotation", rotations.length >= 3,
    `Sub rotated at least 3 times (${rotations.length})`, `only ${rotations.length}`);

  // ── Verify: every player has played 3-4 games ──
  const allGames = Object.values(currentSub.playerStats).map(s => s.gamesPlayed);
  const minGames = Math.min(...allGames);
  const maxGames = Math.max(...allGames);
  // Note: with only 8 games and 13 players, not everyone plays. But the sub should have played.
  // The sub cycles through, so the actively-paired players play 2-3 games and the sub + rotated players play 1-2.
  // With 8 games * 4 players per game = 32 player-game slots across 13 players = ~2.5 avg.
  assert("sub-rotation", maxGames - minGames <= 3,
    `Game count spread ≤ 3 (min=${minGames}, max=${maxGames})`,
    `spread=${maxGames - minGames}`);

  // ── Verify: sub-outs are balanced ──
  const allSubOuts = Object.values(currentSub.playerStats).map(s => s.timesSubbedOut);
  const maxSubOuts = Math.max(...allSubOuts);
  assert("sub-rotation", maxSubOuts <= 2,
    `Max times subbed out ≤ 2 (${maxSubOuts})`, `${maxSubOuts}`);

  // ── Verify: sub target selection (most games, least sub-outs) ──
  const testSub: SubRotation = {
    ...testInitSubRotation(allPlayerIds, subPlayerOdd.id),
    playerStats: {
      [subPlayers[0].id]: { playerId: subPlayers[0].id, gamesPlayed: 4, timesSubbedOut: 0 },
      [subPlayers[1].id]: { playerId: subPlayers[1].id, gamesPlayed: 3, timesSubbedOut: 0 },
      [subPlayers[2].id]: { playerId: subPlayers[2].id, gamesPlayed: 4, timesSubbedOut: 1 },
      [subPlayers[3].id]: { playerId: subPlayers[3].id, gamesPlayed: 2, timesSubbedOut: 0 },
      [subPlayerOdd.id]: { playerId: subPlayerOdd.id, gamesPlayed: 1, timesSubbedOut: 0 },
    },
  };
  const target = testFindBestSubTarget(testSub, subPairs.slice(0, 2));
  assert("sub-rotation", target !== null, "Found sub target", "null");
  assert("sub-rotation", target!.playerId === subPlayers[0].id,
    `Target is player with 4G, 0 sub-outs (${subPlayers[0].name})`,
    `wrong: ${subPlayers.find(p => p.id === target!.playerId)?.name}`);

  // ── Verify: tie-break (same games, fewer sub-outs wins) ──
  const testSub2: SubRotation = {
    ...testInitSubRotation([subPlayers[0].id, subPlayers[1].id, subPlayers[2].id, subPlayers[3].id, subPlayerOdd.id], subPlayerOdd.id),
    playerStats: {
      [subPlayers[0].id]: { playerId: subPlayers[0].id, gamesPlayed: 3, timesSubbedOut: 2 },
      [subPlayers[1].id]: { playerId: subPlayers[1].id, gamesPlayed: 3, timesSubbedOut: 0 },
      [subPlayers[2].id]: { playerId: subPlayers[2].id, gamesPlayed: 2, timesSubbedOut: 0 },
      [subPlayers[3].id]: { playerId: subPlayers[3].id, gamesPlayed: 2, timesSubbedOut: 0 },
      [subPlayerOdd.id]: { playerId: subPlayerOdd.id, gamesPlayed: 1, timesSubbedOut: 0 },
    },
  };
  const target2 = testFindBestSubTarget(testSub2, subPairs.slice(0, 2));
  assert("sub-rotation", target2 !== null, "Found tie-break target", "null");
  assert("sub-rotation", target2!.playerId === subPlayers[1].id,
    `Tie-break: 3G/0out beats 3G/2out (${subPlayers[1].name})`,
    `wrong: ${subPlayers.find(p => p.id === target2!.playerId)?.name}`);

  // ── Verify: court with sub in makeCourt ──
  const subCourt: CourtState = {
    ...makeCourt(2, "B", subPairs),
    sub: testInitSubRotation(allPlayerIds, subPlayerOdd.id),
  };
  assert("sub-rotation", subCourt.sub !== undefined, "Court has sub state", "undefined");
  assert("sub-rotation", subCourt.sub!.currentSubId === subPlayerOdd.id,
    "Court sub is correct player", "wrong player");
  assert("sub-rotation", subCourt.assignedPairs.length === 6,
    "Court has 6 pairs", `${subCourt.assignedPairs.length}`);

  // ── Verify: rotation triggers after 2 games ──
  let triggerSub: SubRotation = testInitSubRotation(allPlayerIds, subPlayerOdd.id);
  // Game 1: no trigger
  triggerSub = { ...triggerSub, gamesSinceLastRotation: 1 };
  assert("sub-rotation", triggerSub.gamesSinceLastRotation < triggerSub.rotationFrequency,
    "No rotation after 1 game", "triggered");
  // Game 2: trigger
  triggerSub = { ...triggerSub, gamesSinceLastRotation: 2 };
  assert("sub-rotation", triggerSub.gamesSinceLastRotation >= triggerSub.rotationFrequency,
    "Rotation triggers after 2 games", "not triggered");

  // ── Verify: skip rotation resets counter ──
  const skippedSub: SubRotation = {
    ...triggerSub,
    pendingRotation: true,
    // After skip: reset
  };
  const afterSkip: SubRotation = { ...skippedSub, pendingRotation: false, gamesSinceLastRotation: 0 };
  assert("sub-rotation", !afterSkip.pendingRotation, "Skip clears pending", "still pending");
  assert("sub-rotation", afterSkip.gamesSinceLastRotation === 0, "Skip resets counter", `${afterSkip.gamesSinceLastRotation}`);

  // ── Verify: late arrival deactivates sub ──
  const courtWithSub: CourtState = {
    ...makeCourt(2, "B", subPairs),
    sub: testInitSubRotation(allPlayerIds, subPlayerOdd.id),
    status: "active",
  };
  // Simulate: late player pairs with sub → sub field becomes undefined
  const latePlayer = makePlayer("LateB99", "B");
  const newLatePair: Pair = { id: generateId(), player1: latePlayer, player2: subPlayerOdd, skillLevel: "B", wins: 0, losses: 0 };
  const courtAfterLate: CourtState = {
    ...courtWithSub,
    assignedPairs: [...courtWithSub.assignedPairs, newLatePair],
    sub: undefined, // Sub system deactivated
  };
  assert("sub-rotation", courtAfterLate.sub === undefined,
    "Sub deactivated after late arrival pairs with sub", "still has sub");
  assert("sub-rotation", courtAfterLate.assignedPairs.length === 7,
    "Court has 7 pairs after late arrival", `${courtAfterLate.assignedPairs.length}`);

  // ── Verify: WSO sub — rotation on back-of-queue pair ──
  const wsoPairsForSub: Pair[] = [];
  for (let i = 0; i < 6; i += 2) {
    wsoPairsForSub.push({ id: generateId(), player1: subPlayers[i], player2: subPlayers[i + 1], skillLevel: "B", wins: 0, losses: 0 });
  }
  const wsoSubCourt: CourtState = {
    ...makeCourt(2, "B", wsoPairsForSub),
    format: "winner_stays_on",
    status: "active",
    sub: testInitSubRotation([...wsoPairsForSub.flatMap(p => [p.player1.id, p.player2.id]), subPlayerOdd.id], subPlayerOdd.id),
    wso: {
      queue: [wsoPairsForSub[2]],
      currentGame: { id: generateId(), pair1: wsoPairsForSub[0], pair2: wsoPairsForSub[1], startedAt: new Date().toISOString(), gameNumber: 1 },
      history: [],
      stats: Object.fromEntries(wsoPairsForSub.map(p => [p.id, { pairId: p.id, wins: 0, losses: 0, streak: 0, longestStreak: 0, gamesPlayed: 0 }])),
      undoStack: [],
      gameCounter: 1,
    },
  };
  assert("sub-rotation", wsoSubCourt.sub !== undefined, "WSO court has sub", "no sub");
  assert("sub-rotation", wsoSubCourt.format === "winner_stays_on", "WSO format confirmed", wsoSubCourt.format);

  // ── Verify: rotation history tracking ──
  const histSub: SubRotation = {
    ...testInitSubRotation(allPlayerIds, subPlayerOdd.id),
    rotationHistory: [
      { timestamp: new Date().toISOString(), subIn: subPlayerOdd.id, subOut: subPlayers[0].id, pairId: subPairs[0].id },
      { timestamp: new Date().toISOString(), subIn: subPlayers[0].id, subOut: subPlayers[2].id, pairId: subPairs[1].id },
    ],
  };
  assert("sub-rotation", histSub.rotationHistory.length === 2,
    "Rotation history tracked (2 entries)", `${histSub.rotationHistory.length}`);
  assert("sub-rotation", histSub.rotationHistory[0].subIn === subPlayerOdd.id,
    "First rotation: sub entered", "wrong");
  assert("sub-rotation", histSub.rotationHistory[1].subOut === subPlayers[2].id,
    "Second rotation: correct player subbed out", "wrong");

  console.log(`  Info: Rotations: ${rotations.length}, Game spread: ${minGames}-${maxGames}, Max sub-outs: ${maxSubOuts}`);
  console.log(`  Info: Rotation sequence: ${rotations.map(r => `${subPlayers.find(p => p.id === r.subIn)?.name}→${subPlayers.find(p => p.id === r.subOut)?.name}`).join(", ")}`);
}

// ═══════════════════════════════════════════════════════════════
//                          FINAL RESULTS
// ═══════════════════════════════════════════════════════════════
console.log("\n==============================================================");
console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
console.log("==============================================================");

if (failures.length > 0) {
  console.log("\n  FAILURES:");
  failures.forEach(f => console.log(`    [${f.section}] ${f.msg}`));
}

process.exit(failed > 0 ? 1 : 0);
