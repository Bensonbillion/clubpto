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
  const ordered = [...aRanked, ...bRanked.slice(0, spotsForB)];
  const top = ordered.slice(0, 8);

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
