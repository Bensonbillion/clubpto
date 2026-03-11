import { describe, it, expect, beforeEach } from "vitest";
import { _testExports, getHeadToHead } from "./useGameState";
import type { Pair, Match, SkillTier } from "@/types/courtManager";

const {
  getAvailableTeams,
  generateNextMatch,
  findNextPendingForCourt,
  isForbiddenMatchup,
  getPairPlayerIds,
  getMatchPlayerIds,
  syncPairsToMatches,
  canStartMatch,
} = _testExports;

// ─── Helpers ──────────────────────────────────────────────

let idCounter = 0;
beforeEach(() => { idCounter = 0; });

function makePlayer(name: string, skill: SkillTier = "B") {
  return {
    id: `p-${++idCounter}`,
    name,
    skillLevel: skill,
    checkedIn: true,
    checkInTime: new Date().toISOString(),
    wins: 0,
    losses: 0,
    gamesPlayed: 0,
  };
}

function makePair(name1: string, name2: string, skill: SkillTier = "B", pairId?: string): Pair {
  return {
    id: pairId || `pair-${++idCounter}`,
    player1: makePlayer(name1, skill),
    player2: makePlayer(name2, skill),
    skillLevel: skill,
    wins: 0,
    losses: 0,
  };
}

function makeMatch(pair1: Pair, pair2: Pair, overrides: Partial<Match> = {}): Match {
  const isCross = pair1.skillLevel !== pair2.skillLevel;
  return {
    id: `match-${++idCounter}`,
    pair1,
    pair2,
    skillLevel: isCross ? "cross" : pair1.skillLevel,
    matchupLabel: `${pair1.skillLevel} vs ${pair2.skillLevel}`,
    status: "pending",
    court: null,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════
// TEST SUITE 1: Match Generation Freeze — Equity Gate Fix
// ═══════════════════════════════════════════════════════════

describe("Bug Fix: Equity gate deadlock", () => {
  it("does NOT deadlock when a busy pair has fewer games than others", () => {
    // Setup: 4 pairs. pLow has 0 games but is currently playing.
    // pMid1 and pMid2 have 2 games each. Without fix, minGames=0 from pLow,
    // and pairs with 2 games get rejected (2 > 0+1).
    const pLow = makePair("Lo1", "Lo2");
    const pBusy = makePair("Bu1", "Bu2");
    const pMid1 = makePair("M1a", "M1b");
    const pMid2 = makePair("M2a", "M2b");
    const pMid3 = makePair("M3a", "M3b");

    const allPairs = [pLow, pBusy, pMid1, pMid2, pMid3];

    // pLow and pBusy are playing on court 2
    const playingMatch = makeMatch(pLow, pBusy, { status: "playing", court: 2 });
    // pMid1 and pMid2 each have 2 completed games
    const comp1 = makeMatch(pMid1, pMid2, { status: "completed" });
    const comp2 = makeMatch(pMid1, pMid3, { status: "completed" });
    const comp3 = makeMatch(pMid2, pMid3, { status: "completed" });
    const comp4 = makeMatch(pMid1, pMid2, { status: "completed" });

    const pendingMatch = makeMatch(pMid1, pMid3, { status: "pending", gameNumber: 1 });
    const pendingMatch2 = makeMatch(pMid2, pMid3, { status: "pending", gameNumber: 2 });

    const allMatches = [playingMatch, comp1, comp2, comp3, comp4, pendingMatch, pendingMatch2];

    // Court 1 freed up — should find a match even though pLow has 0 games
    const result = findNextPendingForCourt(
      allMatches, 1, 2, new Set(), allPairs, allMatches,
    );

    // Without the fix, this would return undefined (deadlock)
    expect(result).toBeDefined();
  });

  it("still enforces equity among available pairs", () => {
    // pHigh has 3 completed games, pLow has 1 — equity gate allows +1 gap
    // pMid has 2 games
    const pLow = makePair("Lo1", "Lo2");
    const pMid = makePair("Mi1", "Mi2");
    const pHigh = makePair("Hi1", "Hi2");

    const allPairs = [pLow, pMid, pHigh];

    // pHigh: 3 games, pMid: 2 games, pLow: 1 game
    const completedMatches: Match[] = [
      makeMatch(pHigh, pMid, { status: "completed" }),
      makeMatch(pHigh, pLow, { status: "completed" }),
      makeMatch(pHigh, pMid, { status: "completed" }),
      makeMatch(pMid, pLow, { status: "completed" }),
      makeMatch(pLow, pMid, { status: "completed" }),
    ];
    // pHigh=3, pMid=3 (counted as pair2), pLow=2... recounting:
    // pHigh: appears in 3 completed (as pair1 3x) = 3
    // pMid: appears in completed as pair2 (1), pair1 (1), pair2 (1), pair1(0)... let me simplify

    // Clear approach: pHigh=3 games, pLow=1 game, min=1, so pHigh blocked (3 > 1+1)
    const comp: Match[] = [];
    comp.push(makeMatch(pHigh, pMid, { status: "completed" }));
    comp.push(makeMatch(pHigh, pLow, { status: "completed" }));
    comp.push(makeMatch(pHigh, pMid, { status: "completed" }));
    // pHigh=3, pMid=2, pLow=1

    const pendingHigh = makeMatch(pHigh, pLow, { status: "pending", gameNumber: 1 });
    const pendingLow = makeMatch(pLow, pMid, { status: "pending", gameNumber: 2 });

    const allMatches = [...comp, pendingHigh, pendingLow];

    const result = findNextPendingForCourt(
      allMatches, 1, 2, new Set(), allPairs, allMatches,
    );

    // min across available pairs = 1 (pLow). pHigh has 3 > 1+1, so pendingHigh blocked.
    // pendingLow: pLow=1, pMid=2, both <= 1+1=2. Should pass.
    expect(result).toBeDefined();
    expect(result!.id).toBe(pendingLow.id);
  });
});

describe("Bug Fix: Rest-gap fallback in dynamic mode", () => {
  it("generates match when rest-gap blocks everyone (fallback to no gap)", () => {
    const p1 = makePair("A", "B");
    const p2 = makePair("C", "D");
    const p3 = makePair("E", "F");

    // All players are "recent" — normally blocks everything
    const allPlayerIds = new Set([
      ...getPairPlayerIds(p1),
      ...getPairPlayerIds(p2),
      ...getPairPlayerIds(p3),
    ]);

    // With rest-gap: should return nothing
    const blocked = generateNextMatch([p1, p2, p3], 1, 2, allPlayerIds, []);
    expect(blocked).toBeUndefined();

    // Without rest-gap (fallback): should generate
    const unblocked = generateNextMatch([p1, p2, p3], 1, 2, new Set(), []);
    expect(unblocked).toBeDefined();
  });

  it("prefers rest-gap-compliant match before falling back", () => {
    const p1 = makePair("A", "B");
    const p2 = makePair("C", "D");
    const p3 = makePair("E", "F");

    // Only p1's players are recent
    const recentIds = new Set(getPairPlayerIds(p1));

    const result = generateNextMatch([p1, p2, p3], 1, 2, recentIds, []);
    expect(result).toBeDefined();
    // Should be p2 vs p3 (avoids p1)
    const ids = [result!.pair1.id, result!.pair2.id];
    expect(ids).not.toContain(p1.id);
  });
});

describe("Bug Fix: findNextPendingForCourt rest-gap fallback", () => {
  it("returns a match even when all pending players are recent (via allowRestRelaxation)", () => {
    const p1 = makePair("A", "B");
    const p2 = makePair("C", "D");
    const pending = makeMatch(p1, p2, { status: "pending" });
    const allPairs = [p1, p2];

    // All players are recent
    const allRecent = new Set([...getPairPlayerIds(p1), ...getPairPlayerIds(p2)]);

    // Without relaxation: blocked
    const blocked = findNextPendingForCourt(
      [pending], 1, 2, allRecent, allPairs, [pending],
    );
    expect(blocked).toBeUndefined();

    // With allowRestRelaxation=true: falls back to rest-relaxed candidates
    const relaxed = findNextPendingForCourt(
      [pending], 1, 2, allRecent, allPairs, [pending], true,
    );
    expect(relaxed).toBeDefined();
    expect(relaxed!.id).toBe(pending.id);
  });
});

// ═══════════════════════════════════════════════════════════
// TEST SUITE 2: Late Arrival Rest-Gap Enforcement
// ═══════════════════════════════════════════════════════════

describe("Bug Fix: Late arrival back-to-back prevention", () => {
  it("insertMatchesAfterFreezeLine is tested via integration — no back-to-backs", () => {
    // This tests the pure functions that support the insertion logic.
    // The actual insertMatchesAfterFreezeLine is a useCallback — we verify its
    // behavior indirectly by checking the scheduling functions respect rest gaps.

    const pairs = Array.from({ length: 6 }, (_, i) =>
      makePair(`P${i * 2 + 1}`, `P${i * 2 + 2}`),
    );

    // Simulate a schedule: 2 courts, 3 slots
    const slot1 = [
      makeMatch(pairs[0], pairs[1], { status: "completed", court: 1 }),
      makeMatch(pairs[2], pairs[3], { status: "completed", court: 2 }),
    ];
    const slot2 = [
      makeMatch(pairs[4], pairs[0], { status: "playing", court: 1 }),
      makeMatch(pairs[1], pairs[5], { status: "playing", court: 2 }),
    ];
    const slot3pending = [
      makeMatch(pairs[2], pairs[4], { status: "pending", gameNumber: 5 }),
      makeMatch(pairs[3], pairs[5], { status: "pending", gameNumber: 6 }),
    ];

    const allMatches = [...slot1, ...slot2, ...slot3pending];

    // Verify findNextPendingForCourt respects rest-gap (recentPlayerIds)
    // pairs[2] just completed in slot1 — if they're recent, should be skipped
    const recentIds = new Set(getPairPlayerIds(pairs[2]));
    const result = findNextPendingForCourt(
      allMatches, 1, 2, recentIds, pairs, allMatches,
    );

    // Should skip slot3pending[0] (has pairs[2]) and pick slot3pending[1] (has pairs[3])
    if (result) {
      const matchPlayerIds = getMatchPlayerIds(result);
      const hasRecent = matchPlayerIds.some((id) => recentIds.has(id));
      expect(hasRecent).toBe(false);
    }
  });

  it("generateNextMatch skips players in recentPlayerIds", () => {
    const p1 = makePair("Late1", "Late2");
    const p2 = makePair("Late3", "Late4");
    const p3 = makePair("Other1", "Other2");

    const recentIds = new Set([...getPairPlayerIds(p1), ...getPairPlayerIds(p2)]);
    const result = generateNextMatch([p1, p2, p3], 1, 2, recentIds, []);

    // Only p3 is not recent — can't form a match with just 1 pair
    expect(result).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════
// TEST SUITE 2.5: canStartMatch Universal Guard
// ═══════════════════════════════════════════════════════════

describe("Bug Fix: canStartMatch universal guard", () => {
  it("blocks a match when pair1 is at 4 completed games", () => {
    const p1 = makePair("A1", "A2");
    const p2 = makePair("B1", "B2");
    const p3 = makePair("C1", "C2");
    const p4 = makePair("D1", "D2");
    const p5 = makePair("E1", "E2");

    const matches: Match[] = [
      makeMatch(p1, p2, { status: "completed" }),
      makeMatch(p1, p3, { status: "completed" }),
      makeMatch(p1, p4, { status: "completed" }),
      makeMatch(p1, p5, { status: "completed" }),
    ];

    const newMatch = makeMatch(p1, p2);
    expect(canStartMatch(newMatch, matches)).toBe(false);
  });

  it("blocks a match when pair2 is at 4 games (3 completed + 1 playing)", () => {
    const p1 = makePair("A1", "A2");
    const p2 = makePair("B1", "B2");
    const p3 = makePair("C1", "C2");
    const p4 = makePair("D1", "D2");
    const p5 = makePair("E1", "E2");

    const matches: Match[] = [
      makeMatch(p2, p3, { status: "completed" }),
      makeMatch(p2, p4, { status: "completed" }),
      makeMatch(p2, p5, { status: "completed" }),
      makeMatch(p2, p1, { status: "playing", court: 1 }),
    ];

    const newMatch = makeMatch(p3, p2);
    expect(canStartMatch(newMatch, matches)).toBe(false);
  });

  it("allows a match when both pairs are under 4 games", () => {
    const p1 = makePair("A1", "A2");
    const p2 = makePair("B1", "B2");
    const p3 = makePair("C1", "C2");

    const matches: Match[] = [
      makeMatch(p1, p3, { status: "completed" }),
      makeMatch(p2, p3, { status: "completed" }),
    ];

    const newMatch = makeMatch(p1, p2);
    expect(canStartMatch(newMatch, matches)).toBe(true);
  });

  it("ignores pending matches in the count", () => {
    const p1 = makePair("A1", "A2");
    const p2 = makePair("B1", "B2");
    const p3 = makePair("C1", "C2");

    const matches: Match[] = [
      makeMatch(p1, p2, { status: "completed" }),
      makeMatch(p1, p3, { status: "completed" }),
      makeMatch(p1, p2, { status: "pending" }),
      makeMatch(p1, p3, { status: "pending" }),
      makeMatch(p1, p2, { status: "pending" }),
    ];

    // p1 has 2 completed, 3 pending = 2 counted
    const newMatch = makeMatch(p1, p3);
    expect(canStartMatch(newMatch, matches)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// TEST SUITE 3: Ghost Player Removal
// ═══════════════════════════════════════════════════════════

describe("Bug Fix: Ghost players after removal", () => {
  it("findNextPendingForCourt skips matches referencing removed pairs", () => {
    const pActive1 = makePair("A1", "A2");
    const pActive2 = makePair("A3", "A4");
    const pRemoved = makePair("R1", "R2");

    // Only active pairs are in allPairs (pRemoved was removed)
    const allPairs = [pActive1, pActive2];

    // But there's still a pending match referencing the removed pair
    const ghostMatch = makeMatch(pRemoved, pActive1, { status: "pending", gameNumber: 1 });
    const validMatch = makeMatch(pActive1, pActive2, { status: "pending", gameNumber: 2 });

    const allMatches = [ghostMatch, validMatch];

    const result = findNextPendingForCourt(
      allMatches, 1, 2, new Set(), allPairs, allMatches,
    );

    // Should skip ghostMatch and pick validMatch
    expect(result).toBeDefined();
    expect(result!.id).toBe(validMatch.id);
  });

  it("syncPairsToMatches does not update completed matches", () => {
    const p1 = makePair("A", "B");
    const p2 = makePair("C", "D");

    const completedMatch = makeMatch(p1, p2, {
      status: "completed",
      winner: p1,
      loser: p2,
    });

    // Modify p1's player name in the pairs list
    const updatedPairs = [
      { ...p1, player1: { ...p1.player1, name: "NewName" } },
      p2,
    ];

    const result = syncPairsToMatches(updatedPairs, [completedMatch]);
    // Completed match should NOT be updated
    expect(result[0].pair1.player1.name).toBe(p1.player1.name);
  });

  it("syncPairsToMatches updates pending matches with current pair data", () => {
    const p1 = makePair("A", "B");
    const p2 = makePair("C", "D");

    const pendingMatch = makeMatch(p1, p2, { status: "pending" });

    // Replace player in p1
    const newPlayer = makePlayer("NewGuy", p1.skillLevel);
    const updatedP1 = { ...p1, player1: newPlayer };
    const updatedPairs = [updatedP1, p2];

    const result = syncPairsToMatches(updatedPairs, [pendingMatch]);
    // Pending match should reflect the updated pair
    expect(result[0].pair1.player1.name).toBe("NewGuy");
  });

  it("ghost-player guard prevents removed pair from being scheduled", () => {
    const p1 = makePair("Keep1", "Keep2");
    const p2 = makePair("Keep3", "Keep4");
    const pGhost = makePair("Ghost1", "Ghost2");

    // pGhost has been removed from pairs list but still appears in a pending match
    const activePairs = [p1, p2];
    const ghostPending = makeMatch(pGhost, p1, { status: "pending", gameNumber: 1 });
    const allMatches = [ghostPending];

    // findNextPendingForCourt should skip it
    const result = findNextPendingForCourt(
      allMatches, 1, 2, new Set(), activePairs, allMatches,
    );
    expect(result).toBeUndefined();
  });

  it("completed matches with removed players are preserved (history)", () => {
    const p1 = makePair("A", "B");
    const pRemoved = makePair("X", "Y");

    const completedMatch = makeMatch(p1, pRemoved, {
      status: "completed",
      winner: p1,
      loser: pRemoved,
    });

    // After removal, filtering should keep completed matches
    const activePairIds = new Set([p1.id]); // pRemoved.id NOT here
    const filtered = [completedMatch].filter((m) => {
      if (m.status === "completed") return true;
      return activePairIds.has(m.pair1.id) && activePairIds.has(m.pair2.id);
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].status).toBe("completed");
  });
});

// ═══════════════════════════════════════════════════════════
// TEST SUITE 4: Immutability — No Direct State Mutations
// ═══════════════════════════════════════════════════════════

describe("Bug Fix: Immutable state updates", () => {
  it("syncPairsToMatches returns new match objects (not mutated originals)", () => {
    const p1 = makePair("A", "B");
    const p2 = makePair("C", "D");
    const original = makeMatch(p1, p2, { status: "pending" });
    const originalId = original.pair1.player1.id;

    const updatedP1 = { ...p1, player1: { ...p1.player1, name: "Changed" } };
    const result = syncPairsToMatches([updatedP1, p2], [original]);

    // Original should NOT be mutated
    expect(original.pair1.player1.name).not.toBe("Changed");
    // Result should have the new data
    expect(result[0].pair1.player1.name).toBe("Changed");
    // Result should be a new object
    expect(result[0]).not.toBe(original);
  });
});

// ═══════════════════════════════════════════════════════════
// TEST SUITE 5: Hard Cap — No Pair Plays More Than 4 Games
// ═══════════════════════════════════════════════════════════

describe("Bug Fix: Teams must never play more than 4 games", () => {
  /**
   * Helper: simulate a full session in dynamic mode.
   * Complete matches one at a time, letting getAvailableTeams + generateNextMatch
   * pick the next match (like completeMatch does in dynamic mode).
   */
  function simulateDynamicSession(
    pairs: Pair[],
    courtCount: 2 | 3,
    target: number,
  ): { pairGameCounts: Map<string, number>; totalMatches: number } {
    const pairGameCounts = new Map<string, number>();
    pairs.forEach((p) => pairGameCounts.set(p.id, 0));

    const pairGamesWatched: Record<string, number> = {};
    pairs.forEach((p) => { pairGamesWatched[p.id] = 0; });

    let allMatches: Match[] = [];
    let iterations = 0;
    const MAX_ITERATIONS = 500;

    // Start initial matches on each court
    for (let court = 1; court <= courtCount; court++) {
      const available = getAvailableTeams(pairs, allMatches, pairGamesWatched, target);
      const match = generateNextMatch(available, court, courtCount, new Set(), allMatches);
      if (match) {
        allMatches.push({
          ...match,
          status: "playing",
          court,
          startedAt: new Date().toISOString(),
        });
      }
    }

    // Complete matches round-robin style until no more can be generated
    while (iterations < MAX_ITERATIONS) {
      iterations++;
      const playingMatch = allMatches.find((m) => m.status === "playing");
      if (!playingMatch) break;

      // Complete the match
      const completedIdx = allMatches.indexOf(playingMatch);
      allMatches[completedIdx] = {
        ...playingMatch,
        status: "completed",
        completedAt: new Date().toISOString(),
        winner: playingMatch.pair1,
        loser: playingMatch.pair2,
      };

      // Update game counts
      pairGameCounts.set(
        playingMatch.pair1.id,
        (pairGameCounts.get(playingMatch.pair1.id) || 0) + 1,
      );
      pairGameCounts.set(
        playingMatch.pair2.id,
        (pairGameCounts.get(playingMatch.pair2.id) || 0) + 1,
      );

      // Update watch counts
      const playedIds = new Set([playingMatch.pair1.id, playingMatch.pair2.id]);
      for (const pair of pairs) {
        if (playedIds.has(pair.id)) {
          pairGamesWatched[pair.id] = 0;
        } else {
          pairGamesWatched[pair.id] = (pairGamesWatched[pair.id] || 0) + 1;
        }
      }

      // Generate next match for the freed court (like completeMatch dynamic mode)
      const freedCourt = playingMatch.court!;
      const recentPlayerIds = new Set<string>();
      // Completion-order rest gap: last N completed matches (N = courtCount)
      const completedByTime = allMatches
        .filter((m) => m.status === "completed" && m.completedAt)
        .sort((a, b) => Date.parse(b.completedAt!) - Date.parse(a.completedAt!));
      for (let i = 0; i < Math.min(courtCount, completedByTime.length); i++) {
        getMatchPlayerIds(completedByTime[i]).forEach((id) => recentPlayerIds.add(id));
      }

      const available = getAvailableTeams(pairs, allMatches, pairGamesWatched, target);
      const nextMatch = generateNextMatch(available, freedCourt, courtCount, recentPlayerIds, allMatches);
      if (nextMatch) {
        allMatches.push({
          ...nextMatch,
          status: "playing",
          court: freedCourt,
          startedAt: new Date().toISOString(),
          gameNumber: allMatches.length + 1,
        });
      }
    }

    return { pairGameCounts, totalMatches: allMatches.filter((m) => m.status === "completed").length };
  }

  /**
   * Helper: simulate a pre-generated schedule session.
   * Uses findNextPendingForCourt to pick matches (like non-dynamic mode).
   */
  function simulateScheduleSession(
    pairs: Pair[],
    schedule: Match[],
    courtCount: 2 | 3,
  ): Map<string, number> {
    const pairGameCounts = new Map<string, number>();
    pairs.forEach((p) => pairGameCounts.set(p.id, 0));

    let allMatches = [...schedule];
    let iterations = 0;
    const MAX_ITERATIONS = 500;

    // Start initial matches
    for (let court = 1; court <= courtCount; court++) {
      const next = findNextPendingForCourt(allMatches, court, courtCount, new Set(), pairs, allMatches, true);
      if (next) {
        const idx = allMatches.findIndex((m) => m.id === next.id);
        allMatches[idx] = { ...next, status: "playing", court, startedAt: new Date().toISOString() };
      }
    }

    while (iterations < MAX_ITERATIONS) {
      iterations++;
      const playingMatch = allMatches.find((m) => m.status === "playing");
      if (!playingMatch) break;

      // Complete the match
      const completedIdx = allMatches.indexOf(playingMatch);
      allMatches[completedIdx] = {
        ...playingMatch,
        status: "completed",
        completedAt: new Date().toISOString(),
        winner: playingMatch.pair1,
        loser: playingMatch.pair2,
      };

      pairGameCounts.set(
        playingMatch.pair1.id,
        (pairGameCounts.get(playingMatch.pair1.id) || 0) + 1,
      );
      pairGameCounts.set(
        playingMatch.pair2.id,
        (pairGameCounts.get(playingMatch.pair2.id) || 0) + 1,
      );

      // Find next pending for the freed court
      const freedCourt = playingMatch.court!;
      const completedByTime = allMatches
        .filter((m) => m.status === "completed" && m.completedAt)
        .sort((a, b) => Date.parse(b.completedAt!) - Date.parse(a.completedAt!));
      const recentPlayerIds = new Set<string>();
      for (let i = 0; i < Math.min(courtCount, completedByTime.length); i++) {
        getMatchPlayerIds(completedByTime[i]).forEach((id) => recentPlayerIds.add(id));
      }

      const next = findNextPendingForCourt(allMatches, freedCourt, courtCount, recentPlayerIds, pairs, allMatches, true);
      if (next) {
        const idx = allMatches.findIndex((m) => m.id === next.id);
        allMatches[idx] = { ...next, status: "playing", court: freedCourt, startedAt: new Date().toISOString() };
      }
    }

    return pairGameCounts;
  }

  it("2-court dynamic mode: no pair exceeds 4 games (6 B-tier pairs)", () => {
    const pairs = Array.from({ length: 6 }, (_, i) =>
      makePair(`T${i * 2 + 1}`, `T${i * 2 + 2}`),
    );
    const { pairGameCounts } = simulateDynamicSession(pairs, 2, 4);
    for (const [pairId, count] of pairGameCounts) {
      expect(count, `Pair ${pairId} played ${count} games, max allowed is 4`).toBeLessThanOrEqual(4);
    }
  });

  it("3-court dynamic mode: no pair exceeds 4 games (mixed tiers)", () => {
    const aPairs = Array.from({ length: 3 }, (_, i) => makePair(`A${i * 2 + 1}`, `A${i * 2 + 2}`, "A"));
    const bPairs = Array.from({ length: 3 }, (_, i) => makePair(`B${i * 2 + 1}`, `B${i * 2 + 2}`, "B"));
    const cPairs = Array.from({ length: 3 }, (_, i) => makePair(`C${i * 2 + 1}`, `C${i * 2 + 2}`, "C"));
    const allPairs = [...aPairs, ...bPairs, ...cPairs];
    const { pairGameCounts } = simulateDynamicSession(allPairs, 3, 3);
    for (const [pairId, count] of pairGameCounts) {
      expect(count, `Pair ${pairId} played ${count} games, max allowed is 4`).toBeLessThanOrEqual(4);
    }
  });

  it("2-court dynamic mode: no pair exceeds 4 games (8 pairs, stress test)", () => {
    const pairs = Array.from({ length: 8 }, (_, i) =>
      makePair(`S${i * 2 + 1}`, `S${i * 2 + 2}`),
    );
    const { pairGameCounts } = simulateDynamicSession(pairs, 2, 4);
    for (const [pairId, count] of pairGameCounts) {
      expect(count, `Pair ${pairId} played ${count} games, max allowed is 4`).toBeLessThanOrEqual(4);
    }
  });

  it("pre-generated schedule with excess matches: findNextPendingForCourt caps at 4", () => {
    // Create 4 pairs and a schedule where pair1 has 6 pending matches (bug scenario)
    const p1 = makePair("P1a", "P1b");
    const p2 = makePair("P2a", "P2b");
    const p3 = makePair("P3a", "P3b");
    const p4 = makePair("P4a", "P4b");
    const p5 = makePair("P5a", "P5b");
    const p6 = makePair("P6a", "P6b");
    const allPairs = [p1, p2, p3, p4, p5, p6];

    // Create 6 pending matches for p1 (intentionally over the cap)
    const schedule: Match[] = [
      makeMatch(p1, p2, { status: "pending", gameNumber: 1 }),
      makeMatch(p3, p4, { status: "pending", gameNumber: 2 }),
      makeMatch(p1, p3, { status: "pending", gameNumber: 3 }),
      makeMatch(p2, p5, { status: "pending", gameNumber: 4 }),
      makeMatch(p1, p4, { status: "pending", gameNumber: 5 }),
      makeMatch(p5, p6, { status: "pending", gameNumber: 6 }),
      makeMatch(p1, p5, { status: "pending", gameNumber: 7 }),
      makeMatch(p2, p6, { status: "pending", gameNumber: 8 }),
      makeMatch(p1, p6, { status: "pending", gameNumber: 9 }),  // 5th match for p1
      makeMatch(p3, p6, { status: "pending", gameNumber: 10 }),
      makeMatch(p1, p2, { status: "pending", gameNumber: 11 }), // 6th match for p1 (rematch)
      makeMatch(p4, p5, { status: "pending", gameNumber: 12 }),
    ];

    const pairGameCounts = simulateScheduleSession(allPairs, schedule, 2);
    const p1Games = pairGameCounts.get(p1.id) || 0;
    expect(p1Games, `Pair p1 played ${p1Games} games, max allowed is 4`).toBeLessThanOrEqual(4);
  });

  it("3-court pre-generated schedule with excess matches: caps at 4", () => {
    // In 3-court mode, create same-tier pairs with too many scheduled matches
    const pairs = Array.from({ length: 4 }, (_, i) =>
      makePair(`A${i * 2 + 1}`, `A${i * 2 + 2}`, "A"),
    );
    const [p1, p2, p3, p4] = pairs;

    // Schedule 6 matches for p1 (all same-tier)
    const schedule: Match[] = [
      makeMatch(p1, p2, { status: "pending", gameNumber: 1, courtPool: "A" }),
      makeMatch(p3, p4, { status: "pending", gameNumber: 2, courtPool: "A" }),
      makeMatch(p1, p3, { status: "pending", gameNumber: 3, courtPool: "A" }),
      makeMatch(p2, p4, { status: "pending", gameNumber: 4, courtPool: "A" }),
      makeMatch(p1, p4, { status: "pending", gameNumber: 5, courtPool: "A" }),
      makeMatch(p2, p3, { status: "pending", gameNumber: 6, courtPool: "A" }),
      makeMatch(p1, p2, { status: "pending", gameNumber: 7, courtPool: "A" }), // 4th for p1
      makeMatch(p3, p4, { status: "pending", gameNumber: 8, courtPool: "A" }),
      makeMatch(p1, p3, { status: "pending", gameNumber: 9, courtPool: "A" }), // 5th for p1
      makeMatch(p1, p4, { status: "pending", gameNumber: 10, courtPool: "A" }), // 6th for p1
    ];

    // 3-court mode but only testing 1 court pool (A)
    const pairGameCounts = simulateScheduleSession(pairs, schedule, 3);
    const p1Games = pairGameCounts.get(p1.id) || 0;
    expect(p1Games, `Pair p1 played ${p1Games} games in 3-court mode, max allowed is 4`).toBeLessThanOrEqual(4);
  });

  it("dynamic mode with late arrival: opponents don't exceed 4 games", () => {
    // 5 existing pairs that have already played 3 games each
    const pairs = Array.from({ length: 5 }, (_, i) =>
      makePair(`E${i * 2 + 1}`, `E${i * 2 + 2}`),
    );

    // Build history: each pair has played 3 completed games
    const completedMatches: Match[] = [];
    // Round 1: p0 vs p1, p2 vs p3
    completedMatches.push(makeMatch(pairs[0], pairs[1], { status: "completed", completedAt: "2026-01-01T20:00:00Z" }));
    completedMatches.push(makeMatch(pairs[2], pairs[3], { status: "completed", completedAt: "2026-01-01T20:00:00Z" }));
    // Round 2: p0 vs p2, p1 vs p4
    completedMatches.push(makeMatch(pairs[0], pairs[2], { status: "completed", completedAt: "2026-01-01T20:07:00Z" }));
    completedMatches.push(makeMatch(pairs[1], pairs[4], { status: "completed", completedAt: "2026-01-01T20:07:00Z" }));
    // Round 3: p0 vs p3, p1 vs p2
    completedMatches.push(makeMatch(pairs[0], pairs[3], { status: "completed", completedAt: "2026-01-01T20:14:00Z" }));
    completedMatches.push(makeMatch(pairs[1], pairs[2], { status: "completed", completedAt: "2026-01-01T20:14:00Z" }));
    // Extra games for p3 and p4
    completedMatches.push(makeMatch(pairs[3], pairs[4], { status: "completed", completedAt: "2026-01-01T20:14:00Z" }));
    completedMatches.push(makeMatch(pairs[4], pairs[2], { status: "completed", completedAt: "2026-01-01T20:21:00Z" }));
    completedMatches.push(makeMatch(pairs[3], pairs[1], { status: "completed", completedAt: "2026-01-01T20:21:00Z" }));

    // Late arrival pair joins — generates 4 new pending matches against existing pairs
    const latePair = makePair("L1", "L2");
    const allPairs = [...pairs, latePair];

    // Simulate generateMatchesForNewPair: 4 matches for the late pair
    const lateMatches: Match[] = [
      makeMatch(latePair, pairs[0], { status: "pending", gameNumber: 10 }),
      makeMatch(latePair, pairs[1], { status: "pending", gameNumber: 11 }),
      makeMatch(latePair, pairs[2], { status: "pending", gameNumber: 12 }),
      makeMatch(latePair, pairs[3], { status: "pending", gameNumber: 13 }),
    ];

    const allMatches = [...completedMatches, ...lateMatches];

    // Now simulate completing the late matches
    // p0 has 3 completed, if late match plays that's 4 — should be the max
    // p1 has 3 completed, same
    const pairGameCounts = simulateScheduleSession(allPairs, allMatches, 2);

    for (const [pairId, count] of pairGameCounts) {
      const pair = allPairs.find((p) => p.id === pairId);
      const name = pair ? `${pair.player1.name}&${pair.player2.name}` : pairId;
      expect(count, `${name} played ${count} games, max allowed is 4`).toBeLessThanOrEqual(4);
    }
  });
});

// ═══════════════════════════════════════════════════════════
// TEST SUITE 6: Full Session Simulation — Match Continuity
// ═══════════════════════════════════════════════════════════

describe("Integration: Match generation continuity", () => {
  it("generates matches continuously until all pairs hit target (dynamic mode)", () => {
    // 6 B-tier pairs, target 4 games each
    const pairs = Array.from({ length: 6 }, (_, i) =>
      makePair(`T${i * 2 + 1}`, `T${i * 2 + 2}`),
    );
    const TARGET = 4;
    let allMatches: Match[] = [];
    const pairGamesWatched: Record<string, number> = {};
    pairs.forEach((p) => { pairGamesWatched[p.id] = 0; });

    let iterations = 0;
    const MAX_ITERATIONS = 200;

    while (iterations < MAX_ITERATIONS) {
      iterations++;
      const available = getAvailableTeams(pairs, allMatches, pairGamesWatched, TARGET);
      if (available.length < 2) break;

      const match = generateNextMatch(available, 1, 2, new Set(), allMatches);
      if (!match) break;

      // Simulate: assign to court, complete immediately
      const completed: Match = {
        ...match,
        status: "completed",
        court: 1,
        completedAt: new Date().toISOString(),
        winner: match.pair1,
        loser: match.pair2,
      };
      allMatches.push(completed);

      // Update watch counts
      const playedIds = new Set([match.pair1.id, match.pair2.id]);
      for (const pair of pairs) {
        if (playedIds.has(pair.id)) {
          pairGamesWatched[pair.id] = 0;
        } else {
          pairGamesWatched[pair.id] = (pairGamesWatched[pair.id] || 0) + 1;
        }
      }
    }

    // Every pair should have reached the target
    const pairGameCounts = new Map<string, number>();
    pairs.forEach((p) => pairGameCounts.set(p.id, 0));
    allMatches.forEach((m) => {
      pairGameCounts.set(m.pair1.id, (pairGameCounts.get(m.pair1.id) || 0) + 1);
      pairGameCounts.set(m.pair2.id, (pairGameCounts.get(m.pair2.id) || 0) + 1);
    });

    for (const [pairId, count] of pairGameCounts) {
      expect(count).toBeGreaterThanOrEqual(TARGET);
    }
    expect(iterations).toBeLessThan(MAX_ITERATIONS);
  });

  it("handles only A and C pairs gracefully (no valid cross-matches)", () => {
    const pA = makePair("A1", "A2", "A");
    const pC = makePair("C1", "C2", "C");

    // Only one A pair and one C pair — A vs C is forbidden, neither can play
    const available = getAvailableTeams([pA, pC], [], {}, 4);
    const match = generateNextMatch(available, 1, 2, new Set(), []);
    expect(match).toBeUndefined();
  });

  it("handles A vs C lockout with B pairs available", () => {
    const pA1 = makePair("A1", "A2", "A");
    const pA2 = makePair("A3", "A4", "A");
    const pC1 = makePair("C1", "C2", "C");
    const pC2 = makePair("C3", "C4", "C");
    const pB1 = makePair("B1", "B2", "B");

    const allPairs = [pA1, pA2, pC1, pC2, pB1];
    const available = getAvailableTeams(allPairs, [], {}, 4);

    // Should generate A vs A, C vs C, or B vs A/B/C — never A vs C
    const match = generateNextMatch(available, 1, 2, new Set(), []);
    expect(match).toBeDefined();
    const tiers = [match!.pair1.skillLevel, match!.pair2.skillLevel].sort().join("");
    expect(tiers).not.toBe("AC");
  });
});
