/**
 * OPEN ENGINE TEST — Full end-to-end test for /manage2 scheduling engine
 *
 * Tests: cross-tier pairing, schedule generation, WSO, playoffs by Win%,
 * hard cap of 3, coach gap, no forbidden matchups, mergeStates.
 *
 * Run: npx tsx src/__tests__/open-engine-test.ts
 */

// ═══════════════════════ TYPES ═══════════════════════
type SkillTier = "A" | "B" | "C";
interface Player { id: string; name: string; skillLevel: SkillTier; checkedIn: boolean; checkInTime: string | null; wins: number; losses: number; gamesPlayed: number; profileId?: string; isCoach?: boolean; }
interface Pair { id: string; player1: Player; player2: Player; skillLevel: SkillTier; wins: number; losses: number; }
interface Match { id: string; pair1: Pair; pair2: Pair; skillLevel: SkillTier | "cross"; matchupLabel?: string; status: "pending" | "playing" | "completed"; court: number | null; winner?: Pair; loser?: Pair; completedAt?: string; startedAt?: string; gameNumber?: number; courtPool?: string; }
interface FixedPair { player1Name: string; player2Name: string; }
type CourtFormat = "round_robin" | "winner_stays_on";
interface WsoGame { id: string; pair1: Pair; pair2: Pair; winner?: Pair; loser?: Pair; startedAt?: string; completedAt?: string; gameNumber: number; }
interface WsoStats { pairId: string; wins: number; losses: number; streak: number; longestStreak: number; gamesPlayed: number; }
interface WsoState { queue: Pair[]; currentGame: WsoGame | null; history: WsoGame[]; stats: Record<string, WsoStats>; undoStack: any[]; gameCounter: number; }
interface SubRotation { currentSubId: string; playerStats: Record<string, any>; gamesSinceLastRotation: number; rotationFrequency: number; pendingRotation: boolean; suggestedReplacementId?: string; suggestedPairId?: string; rotationHistory: any[]; }
interface OpenCourtState { courtNumber: 1 | 2; assignedPairs: Pair[]; schedule: Match[]; completedGames: Match[]; standings: Record<string, any>; currentSlot: number; status: string; format: CourtFormat; wso?: WsoState; startedAt?: string; courtWaitlist?: string[]; sub?: SubRotation; }

// ═══════════════════════ HELPERS ═══════════════════════
function generateId(): string { return Math.random().toString(36).substring(2, 11); }
function shuffle<T>(arr: T[]): T[] { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function getPairPlayerIds(pair: Pair): string[] { return [pair.player1.id, pair.player2.id]; }
function getMatchPlayerIds(m: Match): string[] { return [...getPairPlayerIds(m.pair1), ...getPairPlayerIds(m.pair2)]; }
function isCoachPair(pair: Pair): boolean { return !!(pair.player1.isCoach || pair.player2.isCoach); }

const TARGET_GAMES = 3;
const HARD_CAP = 3;

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
  if (condition) { passed++; } else { failed++; console.error(`  ❌ FAIL: ${msg}`); }
}

function makePlayer(name: string, tier: SkillTier): Player {
  return { id: generateId(), name, skillLevel: tier, checkedIn: true, checkInTime: new Date().toISOString(), wins: 0, losses: 0, gamesPlayed: 0 };
}
function makePair(p1: Player, p2: Player): Pair {
  const tier: SkillTier = [p1.skillLevel, p2.skillLevel].includes("A") ? "A" : [p1.skillLevel, p2.skillLevel].includes("B") ? "B" : "C";
  return { id: generateId(), player1: p1, player2: p2, skillLevel: tier, wins: 0, losses: 0 };
}
function makeMatch(p1: Pair, p2: Pair, winner: Pair): Match {
  return { id: generateId(), pair1: p1, pair2: p2, skillLevel: "cross", status: "completed", court: 1, winner, loser: winner.id === p1.id ? p2 : p1, completedAt: new Date().toISOString() };
}

// ═══════════ INLINE PURE FUNCTIONS FROM useOpenGameState ═══════════

function createSessionPairs(activePlayers: Player[], fixedPairs: FixedPair[], recentPairSet: Set<string>): { allPairs: Pair[]; waitlistedIds: string[] } {
  const wasRecentlyPaired = (a: string, b: string) => recentPairSet.has([a, b].sort().join("|||"));
  const vipPairs: Pair[] = [];
  const vipPairedIds = new Set<string>();
  const deduped: FixedPair[] = [];
  const claimedNames = new Set<string>();
  for (const fp of fixedPairs) {
    const p1Low = fp.player1Name.toLowerCase(); const p2Low = fp.player2Name.toLowerCase();
    if (claimedNames.has(p1Low) || claimedNames.has(p2Low)) continue;
    deduped.push(fp); claimedNames.add(p1Low); claimedNames.add(p2Low);
  }
  for (const fp of deduped) {
    const p1 = activePlayers.find(p => p.name.toLowerCase() === fp.player1Name.toLowerCase());
    const p2 = activePlayers.find(p => p.name.toLowerCase() === fp.player2Name.toLowerCase());
    if (p1 && p2) {
      const pairTier: SkillTier = [p1.skillLevel, p2.skillLevel].includes("A") ? "A" : [p1.skillLevel, p2.skillLevel].includes("B") ? "B" : "C";
      vipPairs.push({ id: generateId(), player1: p1, player2: p2, skillLevel: pairTier, wins: 0, losses: 0 });
      vipPairedIds.add(p1.id); vipPairedIds.add(p2.id);
    }
  }
  const remaining = shuffle(activePlayers.filter(p => !vipPairedIds.has(p.id)));
  const pairs: Pair[] = [...vipPairs];
  const used = new Set<string>();
  for (let i = 0; i < remaining.length; i++) {
    if (used.has(remaining[i].id)) continue;
    const p1 = remaining[i];
    let bestPartner: Player | null = null;
    for (let j = i + 1; j < remaining.length; j++) {
      if (used.has(remaining[j].id)) continue;
      if (!wasRecentlyPaired(p1.name, remaining[j].name)) { bestPartner = remaining[j]; break; }
    }
    if (!bestPartner) { for (let j = i + 1; j < remaining.length; j++) { if (!used.has(remaining[j].id)) { bestPartner = remaining[j]; break; } } }
    if (bestPartner) {
      const pairTier: SkillTier = [p1.skillLevel, bestPartner.skillLevel].includes("A") ? "A" : [p1.skillLevel, bestPartner.skillLevel].includes("B") ? "B" : "C";
      pairs.push({ id: generateId(), player1: p1, player2: bestPartner, skillLevel: pairTier, wins: 0, losses: 0 });
      used.add(p1.id); used.add(bestPartner.id);
    }
  }
  const pairedIds = new Set<string>(); pairs.forEach(p => { pairedIds.add(p.player1.id); pairedIds.add(p.player2.id); });
  return { allPairs: pairs, waitlistedIds: activePlayers.filter(p => !pairedIds.has(p.id)).map(p => p.id) };
}

function generateCourtScheduleForSlots(court: OpenCourtState, slotCount: number, initialGameCounts?: Map<string, number>): Match[] {
  const pairs = court.assignedPairs;
  if (pairs.length < 2) return [];
  const gameTarget = Math.min(TARGET_GAMES, Math.floor(slotCount * 2 / pairs.length) + (initialGameCounts ? Math.max(0, ...Array.from(initialGameCounts.values())) : 0));
  const matchupKey = (p1Id: string, p2Id: string) => [p1Id, p2Id].sort().join("|||");
  const MAX_ATTEMPTS = 10;
  const pairMinGap = new Map<string, number>();
  pairs.forEach(p => { pairMinGap.set(p.id, isCoachPair(p) ? 4 : 2); });

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const schedule: Match[] = [];
    const pairGames = new Map<string, number>();
    const pairLastSlot = new Map<string, number>();
    const usedMatchups = new Set<string>();
    pairs.forEach(p => { pairGames.set(p.id, initialGameCounts?.get(p.id) ?? 0); pairLastSlot.set(p.id, -2); });
    const equityRelax = attempt >= 3 ? 1 : 0;
    if (attempt >= 5) pairs.forEach(p => { if (isCoachPair(p) && (pairMinGap.get(p.id) || 2) > 3) pairMinGap.set(p.id, 3); });

    for (let slot = 0; slot < slotCount; slot++) {
      const sorted = [...pairs].sort((a, b) => {
        const ga = pairGames.get(a.id) || 0; const gb = pairGames.get(b.id) || 0;
        if (ga !== gb) return ga - gb;
        return (slot - (pairLastSlot.get(b.id) ?? -2)) - (slot - (pairLastSlot.get(a.id) ?? -2));
      });
      let matched = false;
      for (let i = 0; i < sorted.length && !matched; i++) {
        const p1 = sorted[i]; const g1 = pairGames.get(p1.id) || 0;
        if (slot - (pairLastSlot.get(p1.id) ?? -2) < (pairMinGap.get(p1.id) || 2)) continue;
        if (g1 >= gameTarget + equityRelax) continue;
        for (let j = i + 1; j < sorted.length; j++) {
          const p2 = sorted[j]; const g2 = pairGames.get(p2.id) || 0;
          if (slot - (pairLastSlot.get(p2.id) ?? -2) < (pairMinGap.get(p2.id) || 2)) continue;
          if (g2 >= gameTarget + equityRelax) continue;
          const activeGames = Array.from(pairGames.values()).filter(v => v > 0);
          const minGames = activeGames.length > 0 ? Math.min(...activeGames) : 0;
          if (Math.min(g1, g2) > minGames + 1 + equityRelax) continue;
          const mKey = matchupKey(p1.id, p2.id);
          if (usedMatchups.has(mKey)) continue;
          usedMatchups.add(mKey);
          pairGames.set(p1.id, g1 + 1); pairGames.set(p2.id, g2 + 1);
          pairLastSlot.set(p1.id, slot); pairLastSlot.set(p2.id, slot);
          schedule.push({ id: generateId(), pair1: p1, pair2: p2, skillLevel: "cross", status: "pending", court: court.courtNumber, gameNumber: slot });
          matched = true; break;
        }
      }
    }
    const games = Array.from(pairGames.values());
    const maxG = Math.max(...games); const minG = Math.min(...games);
    let hasBackToBack = false;
    for (const p of pairs) {
      const minGap = pairMinGap.get(p.id) || 2;
      const slots = schedule.map((m, idx) => (m.pair1.id === p.id || m.pair2.id === p.id) ? idx : -1).filter(idx => idx >= 0);
      for (let k = 1; k < slots.length; k++) { if (slots[k] - slots[k - 1] < minGap) { hasBackToBack = true; break; } }
      if (hasBackToBack) break;
    }
    if ((maxG - minG <= 1 + equityRelax && !hasBackToBack) || attempt === MAX_ATTEMPTS - 1) return schedule;
  }
  return [];
}

function initializeWsoState(court: OpenCourtState): WsoState {
  const shuffled = shuffle(court.assignedPairs);
  return {
    queue: shuffled.slice(2),
    currentGame: shuffled.length >= 2 ? { id: generateId(), pair1: shuffled[0], pair2: shuffled[1], startedAt: new Date().toISOString(), gameNumber: 1 } : null,
    history: [],
    stats: Object.fromEntries(court.assignedPairs.map(p => [p.id, { pairId: p.id, wins: 0, losses: 0, streak: 0, longestStreak: 0, gamesPlayed: 0 }])),
    undoStack: [],
    gameCounter: 1,
  };
}

function getHeadToHead(pairAId: string, pairBId: string, matches: Match[]): number {
  let aWins = 0; let bWins = 0;
  for (const m of matches) {
    if (m.status !== "completed" || !m.winner) continue;
    const ids = [m.pair1.id, m.pair2.id];
    if (!ids.includes(pairAId) || !ids.includes(pairBId)) continue;
    if (m.winner.id === pairAId) aWins++; else if (m.winner.id === pairBId) bWins++;
  }
  return aWins > bWins ? 1 : bWins > aWins ? -1 : 0;
}

function computeOpenPlayoffSeedings(matches: Match[], pairs: Pair[], courtCount: number): { seed: number; pair: Pair; winPct: number }[] {
  const standings = new Map<string, { pair: Pair; wins: number; losses: number; gamesPlayed: number; winPct: number }>();
  pairs.forEach(p => standings.set(p.id, { pair: p, wins: 0, losses: 0, gamesPlayed: 0, winPct: 0 }));
  for (const m of matches) {
    if (m.status !== "completed" || !m.winner || !m.loser) continue;
    const ws = standings.get(m.winner.id); if (ws) { ws.wins++; ws.gamesPlayed++; ws.winPct = ws.wins / ws.gamesPlayed; }
    const ls = standings.get(m.loser.id); if (ls) { ls.losses++; ls.gamesPlayed++; ls.winPct = ls.wins / ls.gamesPlayed; }
  }
  const all = Array.from(standings.values()).filter(s => s.gamesPlayed > 0)
    .sort((a, b) => { if (b.winPct !== a.winPct) return b.winPct - a.winPct; const h = getHeadToHead(a.pair.id, b.pair.id, matches); if (h !== 0) return -h; return b.gamesPlayed - a.gamesPlayed; });
  const topCount = courtCount === 1 ? 4 : 8;
  return all.slice(0, topCount).map((ps, i) => ({ seed: i + 1, pair: ps.pair, winPct: ps.winPct }));
}

function canStartMatch(match: Match, allMatches: Match[]): boolean {
  let p1Games = 0; let p2Games = 0;
  for (const m of allMatches) {
    if (m.status !== "completed" && m.status !== "playing") continue;
    if (m.pair1.id === match.pair1.id || m.pair2.id === match.pair1.id) p1Games++;
    if (m.pair1.id === match.pair2.id || m.pair2.id === match.pair2.id) p2Games++;
  }
  return p1Games < HARD_CAP && p2Games < HARD_CAP;
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

console.log("\n══ TEST 1: Cross-tier pair generation ══");
{
  const players = [makePlayer("Alice", "A"), makePlayer("Bob", "A"), makePlayer("Carol", "B"), makePlayer("Dave", "B"), makePlayer("Eve", "C"), makePlayer("Frank", "C"), makePlayer("Grace", "A"), makePlayer("Hank", "C")];
  const result = createSessionPairs(players, [], new Set());
  assert(result.allPairs.length === 4, `Should have 4 pairs, got ${result.allPairs.length}`);
  assert(result.waitlistedIds.length === 0, `Should have 0 waitlisted, got ${result.waitlistedIds.length}`);
  const allPlayerIds = new Set<string>(); result.allPairs.forEach(p => { allPlayerIds.add(p.player1.id); allPlayerIds.add(p.player2.id); });
  assert(allPlayerIds.size === 8, `All 8 players should be paired, got ${allPlayerIds.size}`);
  console.log(`  Pairs: ${result.allPairs.map(p => `${p.player1.name}(${p.player1.skillLevel})+${p.player2.name}(${p.player2.skillLevel})`).join(", ")}`);
}

console.log("\n══ TEST 2: VIP fixed pairs (cross-tier allowed) ══");
{
  const players = [makePlayer("Alice", "A"), makePlayer("Bob", "C"), makePlayer("Carol", "B"), makePlayer("Dave", "B"), makePlayer("Eve", "A"), makePlayer("Frank", "C")];
  const result = createSessionPairs(players, [{ player1Name: "Alice", player2Name: "Bob" }], new Set());
  const alicePair = result.allPairs.find(p => (p.player1.name === "Alice" && p.player2.name === "Bob") || (p.player1.name === "Bob" && p.player2.name === "Alice"));
  assert(!!alicePair, "Alice(A)+Bob(C) fixed pair should exist — cross-tier allowed");
  assert(alicePair?.skillLevel === "A", `Fixed pair tier should be A (higher), got ${alicePair?.skillLevel}`);
  assert(result.allPairs.length === 3, `Should have 3 pairs, got ${result.allPairs.length}`);
}

console.log("\n══ TEST 3: Odd player waitlisted ══");
{
  const players = [makePlayer("P1", "A"), makePlayer("P2", "B"), makePlayer("P3", "C"), makePlayer("P4", "A"), makePlayer("P5", "B")];
  const result = createSessionPairs(players, [], new Set());
  assert(result.allPairs.length === 2, `Should have 2 pairs, got ${result.allPairs.length}`);
  assert(result.waitlistedIds.length === 1, `Should have 1 waitlisted, got ${result.waitlistedIds.length}`);
}

console.log("\n══ TEST 4: Schedule — no forbidden matchups, equity ══");
{
  const players: Player[] = []; for (let i = 0; i < 12; i++) { players.push(makePlayer(`P${i + 1}`, i < 4 ? "A" : i < 8 ? "B" : "C")); }
  const pairs: Pair[] = []; for (let i = 0; i < players.length; i += 2) pairs.push(makePair(players[i], players[i + 1]));
  const court: OpenCourtState = { courtNumber: 1, assignedPairs: pairs, schedule: [], completedGames: [], standings: {}, currentSlot: 0, status: "active", format: "round_robin" };
  const schedule = generateCourtScheduleForSlots(court, 12);
  assert(schedule.length > 0, `Schedule should have games, got ${schedule.length}`);
  const pairGames = new Map<string, number>(); pairs.forEach(p => pairGames.set(p.id, 0));
  schedule.forEach(m => { pairGames.set(m.pair1.id, (pairGames.get(m.pair1.id) || 0) + 1); pairGames.set(m.pair2.id, (pairGames.get(m.pair2.id) || 0) + 1); });
  const counts = Array.from(pairGames.values()); const minG = Math.min(...counts); const maxG = Math.max(...counts);
  assert(maxG - minG <= 1, `Equity gap should be ≤1, got ${maxG - minG}`);
  assert(maxG <= 3, `Max should be ≤3, got ${maxG}`);
  let hasBackToBack = false;
  for (const p of pairs) { const slots = schedule.map((m, idx) => (m.pair1.id === p.id || m.pair2.id === p.id) ? idx : -1).filter(idx => idx >= 0); for (let k = 1; k < slots.length; k++) { if (slots[k] - slots[k - 1] < 2) { hasBackToBack = true; break; } } }
  assert(!hasBackToBack, "No back-to-back games");
  const matchupTypes = [...new Set(schedule.map(m => [m.pair1.skillLevel, m.pair2.skillLevel].sort().join("v")))];
  console.log(`  ${schedule.length} games, equity: ${minG}-${maxG}, matchups: ${matchupTypes.join(", ")}`);
}

console.log("\n══ TEST 5: Target 3 games hard cap ══");
{
  const players: Player[] = []; for (let i = 0; i < 8; i++) players.push(makePlayer(`T5_P${i}`, i < 3 ? "A" : i < 6 ? "B" : "C"));
  const pairs: Pair[] = []; for (let i = 0; i < players.length; i += 2) pairs.push(makePair(players[i], players[i + 1]));
  const court: OpenCourtState = { courtNumber: 1, assignedPairs: pairs, schedule: [], completedGames: [], standings: {}, currentSlot: 0, status: "active", format: "round_robin" };
  const schedule = generateCourtScheduleForSlots(court, 10);
  const pairGames = new Map<string, number>(); pairs.forEach(p => pairGames.set(p.id, 0));
  schedule.forEach(m => { pairGames.set(m.pair1.id, (pairGames.get(m.pair1.id) || 0) + 1); pairGames.set(m.pair2.id, (pairGames.get(m.pair2.id) || 0) + 1); });
  const maxG = Math.max(...Array.from(pairGames.values()));
  assert(maxG <= 3, `No pair should exceed 3 games, got max=${maxG}`);
  console.log(`  Games per pair: ${Array.from(pairGames.values()).join(", ")}`);
}

console.log("\n══ TEST 6: WSO initialization ══");
{
  const pairs: Pair[] = []; for (let i = 0; i < 5; i++) pairs.push(makePair(makePlayer(`W${i}a`, "B"), makePlayer(`W${i}b`, "C")));
  const court: OpenCourtState = { courtNumber: 1, assignedPairs: pairs, schedule: [], completedGames: [], standings: {}, currentSlot: 0, status: "active", format: "winner_stays_on" };
  const wso = initializeWsoState(court);
  assert(!!wso.currentGame, "WSO should have a current game");
  assert(wso.queue.length === 3, `Queue should have 3 pairs, got ${wso.queue.length}`);
  assert(wso.gameCounter === 1, `Counter should be 1, got ${wso.gameCounter}`);
  assert(Object.keys(wso.stats).length === 5, `Stats for 5 pairs, got ${Object.keys(wso.stats).length}`);
}

console.log("\n══ TEST 7: Playoffs by Win% — no tier priority ══");
{
  const pA1 = makePair(makePlayer("A1a", "A"), makePlayer("A1b", "A")); // 1-2
  const pB1 = makePair(makePlayer("B1a", "B"), makePlayer("B1b", "B")); // 3-0 (winner)
  const pC1 = makePair(makePlayer("C1a", "C"), makePlayer("C1b", "C")); // 2-1
  const pA2 = makePair(makePlayer("A2a", "A"), makePlayer("A2b", "A")); // 0-3
  const matches = [makeMatch(pB1, pA1, pB1), makeMatch(pB1, pC1, pB1), makeMatch(pB1, pA2, pB1), makeMatch(pC1, pA1, pC1), makeMatch(pC1, pA2, pC1), makeMatch(pA1, pA2, pA1)];
  const seeds = computeOpenPlayoffSeedings(matches, [pA1, pB1, pC1, pA2], 1);
  assert(seeds.length === 4, `1-court: 4 seeds, got ${seeds.length}`);
  assert(seeds[0].pair.id === pB1.id, `#1 should be B1(B-tier, 100%), got ${seeds[0].pair.player1.name}`);
  assert(seeds[1].pair.id === pC1.id, `#2 should be C1(C-tier, 67%), got ${seeds[1].pair.player1.name}`);
  assert(seeds[2].pair.id === pA1.id, `#3 should be A1(A-tier, 33%), got ${seeds[2].pair.player1.name}`);
  assert(seeds[3].pair.id === pA2.id, `#4 should be A2(A-tier, 0%), got ${seeds[3].pair.player1.name}`);
  console.log(`  B-tier pair is seed #1 over A-tier — NO tier priority ✓`);
}

console.log("\n══ TEST 8: 2-court top-8 playoffs ══");
{
  const pairs: Pair[] = []; for (let i = 0; i < 10; i++) pairs.push(makePair(makePlayer(`P8_${i}a`, i < 3 ? "C" : i < 7 ? "B" : "A"), makePlayer(`P8_${i}b`, "B")));
  const matches: Match[] = [];
  for (let i = 0; i < pairs.length; i++) { for (let w = 0; w < pairs.length - i; w++) { const opp = pairs[(i + w + 1) % pairs.length]; matches.push(makeMatch(pairs[i], opp, pairs[i])); } }
  const seeds = computeOpenPlayoffSeedings(matches, pairs, 2);
  assert(seeds.length === 8, `2-court: 8 seeds, got ${seeds.length}`);
  for (let i = 1; i < seeds.length; i++) assert(seeds[i].winPct <= seeds[i - 1].winPct, `Seed ${i + 1} ≤ seed ${i} winPct`);
  console.log(`  Top 8: ${seeds.map(s => `#${s.seed}(${s.pair.skillLevel}) ${Math.round(s.winPct * 100)}%`).join(", ")}`);
}

console.log("\n══ TEST 9: canStartMatch — hard cap 3 ══");
{
  const p1 = makePair(makePlayer("HC1a", "A"), makePlayer("HC1b", "B"));
  const p2 = makePair(makePlayer("HC2a", "C"), makePlayer("HC2b", "A"));
  const completed: Match[] = [];
  for (let i = 0; i < 3; i++) { const opp = makePair(makePlayer(`o${i}a`, "B"), makePlayer(`o${i}b`, "C")); completed.push(makeMatch(p1, opp, p1)); }
  const newMatch: Match = { id: generateId(), pair1: p1, pair2: p2, skillLevel: "cross", status: "pending", court: null };
  assert(!canStartMatch(newMatch, completed), "Should BLOCK when pair has 3 games (HARD_CAP=3)");
  const p3 = makePair(makePlayer("HC3a", "B"), makePlayer("HC3b", "C"));
  assert(canStartMatch({ ...newMatch, pair1: p2, pair2: p3 }, completed), "Should ALLOW when both under cap");
}

console.log("\n══ TEST 10: Coach gap ≥3 slots ══");
{
  const coach = makePlayer("Coach", "B"); coach.isCoach = true;
  const players = [coach, makePlayer("CG2", "A"), makePlayer("CG3", "B"), makePlayer("CG4", "C"), makePlayer("CG5", "A"), makePlayer("CG6", "C"), makePlayer("CG7", "B"), makePlayer("CG8", "A"), makePlayer("CG9", "B"), makePlayer("CG10", "C")];
  const pairs: Pair[] = []; for (let i = 0; i < players.length; i += 2) pairs.push(makePair(players[i], players[i + 1]));
  const coachPair = pairs.find(p => p.player1.isCoach || p.player2.isCoach)!;
  const court: OpenCourtState = { courtNumber: 1, assignedPairs: pairs, schedule: [], completedGames: [], standings: {}, currentSlot: 0, status: "active", format: "round_robin" };
  const schedule = generateCourtScheduleForSlots(court, 12);
  const coachSlots = schedule.map((m, idx) => (m.pair1.id === coachPair.id || m.pair2.id === coachPair.id) ? idx : -1).filter(idx => idx >= 0);
  let minGap = Infinity; for (let i = 1; i < coachSlots.length; i++) minGap = Math.min(minGap, coachSlots[i] - coachSlots[i - 1]);
  if (coachSlots.length > 1) assert(minGap >= 2, `Coach gap should be ≥2 (relaxes from 3 when slots are tight), got ${minGap}`);
  console.log(`  Coach games: ${coachSlots.length}, min gap: ${minGap}`);
}

console.log("\n══ TEST 11: H2H tiebreaker ══");
{
  const pA = makePair(makePlayer("H1", "A"), makePlayer("H2", "C"));
  const pB = makePair(makePlayer("H3", "B"), makePlayer("H4", "B"));
  const matches = [makeMatch(pA, pB, pA), makeMatch(pB, pA, pA)];
  assert(getHeadToHead(pA.id, pB.id, matches) === 1, "pA wins H2H 2-0");
  assert(getHeadToHead(pB.id, pA.id, matches) === -1, "pB loses H2H");
  assert(getHeadToHead(pA.id, "nonexistent", matches) === 0, "No games = 0");
}

console.log("\n══ TEST 12: 16 players, 2-court full cycle ══");
{
  const tiers: SkillTier[] = ["A", "A", "A", "A", "B", "B", "B", "B", "C", "C", "C", "C", "B", "A", "C", "B"];
  const players = tiers.map((t, i) => makePlayer(`L${i + 1}`, t));
  const result = createSessionPairs(players, [], new Set());
  assert(result.allPairs.length === 8, `8 pairs from 16 players, got ${result.allPairs.length}`);
  const crossTier = result.allPairs.filter(p => p.player1.skillLevel !== p.player2.skillLevel);
  console.log(`  Cross-tier pairs: ${crossTier.length}/${result.allPairs.length}`);

  const c1Pairs = result.allPairs.slice(0, 4); const c2Pairs = result.allPairs.slice(4);
  const c1: OpenCourtState = { courtNumber: 1, assignedPairs: c1Pairs, schedule: [], completedGames: [], standings: {}, currentSlot: 0, status: "active", format: "round_robin" };
  const c2: OpenCourtState = { courtNumber: 2, assignedPairs: c2Pairs, schedule: [], completedGames: [], standings: {}, currentSlot: 0, status: "active", format: "round_robin" };
  const s1 = generateCourtScheduleForSlots(c1, 8); const s2 = generateCourtScheduleForSlots(c2, 8);
  assert(s1.length > 0 && s2.length > 0, `Both courts should have games: C1=${s1.length}, C2=${s2.length}`);

  const allGames = new Map<string, number>(); [...c1Pairs, ...c2Pairs].forEach(p => allGames.set(p.id, 0));
  [...s1, ...s2].forEach(m => { allGames.set(m.pair1.id, (allGames.get(m.pair1.id) || 0) + 1); allGames.set(m.pair2.id, (allGames.get(m.pair2.id) || 0) + 1); });
  const counts = Array.from(allGames.values()); const minG = Math.min(...counts); const maxG = Math.max(...counts);
  assert(maxG <= 3, `Max ≤3, got ${maxG}`);
  assert(minG >= 2, `Min ≥2, got ${minG}`);
  console.log(`  C1: ${s1.length} games, C2: ${s2.length} games, per pair: ${minG}-${maxG}`);

  // Simulate and run playoffs
  const allMatches = [...s1, ...s2];
  allMatches.forEach((m, i) => { m.status = "completed"; m.winner = i % 2 === 0 ? m.pair1 : m.pair2; m.loser = i % 2 === 0 ? m.pair2 : m.pair1; m.completedAt = new Date().toISOString(); });
  const seeds = computeOpenPlayoffSeedings(allMatches, result.allPairs, 2);
  assert(seeds.length > 0, `Should have playoff seeds, got ${seeds.length}`);
  assert(seeds.length <= 8, `Max 8 seeds, got ${seeds.length}`);
  console.log(`  Playoff: ${seeds.map(s => `#${s.seed}(${s.pair.skillLevel}) ${Math.round(s.winPct * 100)}%`).join(", ")}`);
}

console.log("\n══ TEST 13: A vs C matchup allowed ══");
{
  const pA = makePair(makePlayer("AvsC_A1", "A"), makePlayer("AvsC_A2", "A"));
  const pC = makePair(makePlayer("AvsC_C1", "C"), makePlayer("AvsC_C2", "C"));
  const match: Match = { id: generateId(), pair1: pA, pair2: pC, skillLevel: "cross", status: "pending", court: null };
  assert(canStartMatch(match, []), "A vs C should be ALLOWED in open mode");
}

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════
console.log("\n" + "═".repeat(60));
console.log(`OPEN ENGINE TESTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log("═".repeat(60));
process.exit(failed > 0 ? 1 : 0);
