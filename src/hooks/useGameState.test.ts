import { describe, it, expect } from "vitest";
import { _testExports, getHeadToHead } from "./useGameState";
import type { Pair, Match, SkillTier } from "@/types/courtManager";

const {
  getAvailableTeams,
  generateNextMatch,
  findNextPendingForCourt,
  isForbiddenMatchup,
  isCrossCohort,
  getPairPlayerIds,
  getMatchPlayerIds,
} = _testExports;

// ─── Helpers: test data factories ──────────────────────────

let idCounter = 0;
function makePlayer(name: string, skill: SkillTier = "B") {
  return {
    id: `player-${++idCounter}`,
    name,
    skillLevel: skill,
    checkedIn: true,
    checkInTime: new Date().toISOString(),
    wins: 0,
    losses: 0,
    gamesPlayed: 0,
  };
}

function makePair(
  name1: string,
  name2: string,
  skill: SkillTier = "B",
  pairId?: string,
): Pair {
  return {
    id: pairId || `pair-${++idCounter}`,
    player1: makePlayer(name1, skill),
    player2: makePlayer(name2, skill),
    skillLevel: skill,
    wins: 0,
    losses: 0,
  };
}

function makeMatch(
  pair1: Pair,
  pair2: Pair,
  overrides: Partial<Match> = {},
): Match {
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

// ─── isForbiddenMatchup ────────────────────────────────────

describe("isForbiddenMatchup", () => {
  it("forbids A vs C", () => {
    expect(isForbiddenMatchup("A", "C")).toBe(true);
    expect(isForbiddenMatchup("C", "A")).toBe(true);
  });

  it("allows A vs A", () => {
    expect(isForbiddenMatchup("A", "A")).toBe(false);
  });

  it("allows A vs B", () => {
    expect(isForbiddenMatchup("A", "B")).toBe(false);
    expect(isForbiddenMatchup("B", "A")).toBe(false);
  });

  it("allows B vs C", () => {
    expect(isForbiddenMatchup("B", "C")).toBe(false);
    expect(isForbiddenMatchup("C", "B")).toBe(false);
  });

  it("allows B vs B", () => {
    expect(isForbiddenMatchup("B", "B")).toBe(false);
  });

  it("allows C vs C", () => {
    expect(isForbiddenMatchup("C", "C")).toBe(false);
  });
});

// ─── isCrossCohort ─────────────────────────────────────────

describe("isCrossCohort", () => {
  it("detects B vs A as cross-cohort", () => {
    expect(isCrossCohort("B vs A")).toBe(true);
    expect(isCrossCohort("A vs B")).toBe(true);
  });

  it("detects B vs C as cross-cohort", () => {
    expect(isCrossCohort("B vs C")).toBe(true);
    expect(isCrossCohort("C vs B")).toBe(true);
  });

  it("returns false for same-cohort", () => {
    expect(isCrossCohort("A vs A")).toBe(false);
    expect(isCrossCohort("B vs B")).toBe(false);
    expect(isCrossCohort("C vs C")).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isCrossCohort(undefined)).toBe(false);
  });
});

// ─── getPairPlayerIds / getMatchPlayerIds ──────────────────

describe("getPairPlayerIds", () => {
  it("returns both player IDs from a pair", () => {
    const pair = makePair("Alice", "Bob");
    const ids = getPairPlayerIds(pair);
    expect(ids).toHaveLength(2);
    expect(ids).toContain(pair.player1.id);
    expect(ids).toContain(pair.player2.id);
  });
});

describe("getMatchPlayerIds", () => {
  it("returns all 4 player IDs from a match", () => {
    const p1 = makePair("A", "B");
    const p2 = makePair("C", "D");
    const m = makeMatch(p1, p2);
    const ids = getMatchPlayerIds(m);
    expect(ids).toHaveLength(4);
  });
});

// ─── getHeadToHead ─────────────────────────────────────────

describe("getHeadToHead", () => {
  it("returns 0 when pairs never met", () => {
    expect(getHeadToHead("p1", "p2", [])).toBe(0);
  });

  it("returns 1 when pairA has more wins", () => {
    const p1 = makePair("A", "B", "B", "pair-a");
    const p2 = makePair("C", "D", "B", "pair-b");
    const matches: Match[] = [
      makeMatch(p1, p2, { status: "completed", winner: p1, loser: p2 }),
    ];
    expect(getHeadToHead("pair-a", "pair-b", matches)).toBe(1);
  });

  it("returns -1 when pairB has more wins", () => {
    const p1 = makePair("A", "B", "B", "pa");
    const p2 = makePair("C", "D", "B", "pb");
    const matches: Match[] = [
      makeMatch(p1, p2, { status: "completed", winner: p2, loser: p1 }),
    ];
    expect(getHeadToHead("pa", "pb", matches)).toBe(-1);
  });

  it("returns 0 when tied", () => {
    const p1 = makePair("A", "B", "B", "px");
    const p2 = makePair("C", "D", "B", "py");
    const matches: Match[] = [
      makeMatch(p1, p2, { status: "completed", winner: p1, loser: p2 }),
      makeMatch(p1, p2, { status: "completed", winner: p2, loser: p1 }),
    ];
    expect(getHeadToHead("px", "py", matches)).toBe(0);
  });
});

// ─── getAvailableTeams ─────────────────────────────────────

describe("getAvailableTeams", () => {
  it("returns all pairs when none are busy and under target", () => {
    const pairs = [makePair("A", "B"), makePair("C", "D"), makePair("E", "F")];
    const result = getAvailableTeams(pairs, [], {}, 4);
    expect(result).toHaveLength(3);
  });

  it("excludes pairs with a player currently playing", () => {
    const p1 = makePair("A", "B");
    const p2 = makePair("C", "D");
    const p3 = makePair("E", "F");
    const playingMatch = makeMatch(p1, p2, { status: "playing", court: 1 });
    const result = getAvailableTeams([p1, p2, p3], [playingMatch], {}, 4);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(p3.id);
  });

  it("excludes pairs at or above target games", () => {
    const p1 = makePair("A", "B");
    const p2 = makePair("C", "D");
    // p1 has 2 completed games
    const m1 = makeMatch(p1, p2, { status: "completed" });
    const m2 = makeMatch(p1, p2, { status: "completed" });
    const result = getAvailableTeams([p1, p2], [m1, m2], {}, 2);
    // Both pairs have 2 completed games and target is 2, so both excluded
    expect(result).toHaveLength(0);
  });

  it("sorts by pairGamesWatched descending (longest wait first)", () => {
    const p1 = makePair("A", "B");
    const p2 = makePair("C", "D");
    const p3 = makePair("E", "F");
    const watched = { [p1.id]: 1, [p2.id]: 5, [p3.id]: 3 };
    const result = getAvailableTeams([p1, p2, p3], [], watched, 4);
    expect(result[0].id).toBe(p2.id); // watched 5
    expect(result[1].id).toBe(p3.id); // watched 3
    expect(result[2].id).toBe(p1.id); // watched 1
  });

  it("breaks tie by fewer completed games first", () => {
    const p1 = makePair("A", "B");
    const p2 = makePair("C", "D");
    const p3 = makePair("E", "F");
    // p1 has 1 completed game, p2 has 0, same watch count
    const m1 = makeMatch(p1, p3, { status: "completed" });
    const watched = { [p1.id]: 2, [p2.id]: 2 };
    const result = getAvailableTeams([p1, p2, p3], [m1], watched, 4);
    // p2 has 0 games, p1 has 1 game, both watched 2 → p2 comes first
    const p1Idx = result.findIndex((p) => p.id === p1.id);
    const p2Idx = result.findIndex((p) => p.id === p2.id);
    expect(p2Idx).toBeLessThan(p1Idx);
  });
});

// ─── generateNextMatch ─────────────────────────────────────

describe("generateNextMatch", () => {
  it("returns undefined with fewer than 2 teams", () => {
    const p1 = makePair("A", "B");
    expect(generateNextMatch([p1], 1, 2, new Set(), [])).toBeUndefined();
    expect(generateNextMatch([], 1, 2, new Set(), [])).toBeUndefined();
  });

  it("generates a match between two available B-tier teams", () => {
    const p1 = makePair("A", "B");
    const p2 = makePair("C", "D");
    const result = generateNextMatch([p1, p2], 1, 2, new Set(), []);
    expect(result).toBeDefined();
    expect(result!.status).toBe("pending");
    expect(result!.pair1).toBeDefined();
    expect(result!.pair2).toBeDefined();
  });

  it("forbids A vs C matchups", () => {
    const pA = makePair("A1", "A2", "A");
    const pC = makePair("C1", "C2", "C");
    const result = generateNextMatch([pA, pC], 1, 2, new Set(), []);
    expect(result).toBeUndefined();
  });

  it("forbids B vs C in 3-court mode", () => {
    const pB = makePair("B1", "B2", "B");
    const pC = makePair("C1", "C2", "C");
    const result = generateNextMatch([pB, pC], 2, 3, new Set(), []);
    expect(result).toBeUndefined();
  });

  it("allows B vs C in 2-court mode", () => {
    const pB = makePair("B1", "B2", "B");
    const pC = makePair("C1", "C2", "C");
    const result = generateNextMatch([pB, pC], 1, 2, new Set(), []);
    expect(result).toBeDefined();
  });

  it("skips players in recentPlayerIds (back-to-back avoidance)", () => {
    const p1 = makePair("A", "B");
    const p2 = makePair("C", "D");
    const p3 = makePair("E", "F");
    // p1's players are "recent" — can't play
    const recentIds = new Set(getPairPlayerIds(p1));
    const result = generateNextMatch([p1, p2, p3], 1, 2, recentIds, []);
    expect(result).toBeDefined();
    // Result should be p2 vs p3 (p1 excluded)
    const matchPairIds = [result!.pair1.id, result!.pair2.id];
    expect(matchPairIds).not.toContain(p1.id);
    expect(matchPairIds).toContain(p2.id);
    expect(matchPairIds).toContain(p3.id);
  });

  it("penalizes repeat matchups (prefers unplayed)", () => {
    const p1 = makePair("A", "B");
    const p2 = makePair("C", "D");
    const p3 = makePair("E", "F");
    // p1 vs p2 already played
    const prevMatch = makeMatch(p1, p2, { status: "completed" });
    const result = generateNextMatch([p1, p2, p3], 1, 2, new Set(), [prevMatch]);
    expect(result).toBeDefined();
    const matchPairIds = [result!.pair1.id, result!.pair2.id].sort();
    // Should prefer an unplayed matchup (p1-p3 or p2-p3) over p1-p2
    const isRepeat =
      matchPairIds.join(",") === [p1.id, p2.id].sort().join(",");
    expect(isRepeat).toBe(false);
  });

  it("prefers same-cohort over cross-cohort", () => {
    const pA1 = makePair("A1", "A2", "A");
    const pA2 = makePair("A3", "A4", "A");
    const pB = makePair("B1", "B2", "B");
    // pA1 and pA2 can play same-cohort, pA1 vs pB is cross-cohort
    const result = generateNextMatch([pA1, pA2, pB], 1, 2, new Set(), []);
    expect(result).toBeDefined();
    expect(result!.skillLevel).not.toBe("cross");
    expect(result!.pair1.skillLevel).toBe("A");
    expect(result!.pair2.skillLevel).toBe("A");
  });

  it("3-court routing: court 1 only gets C-pool matches", () => {
    const pC1 = makePair("C1", "C2", "C");
    const pC2 = makePair("C3", "C4", "C");
    const pA1 = makePair("A1", "A2", "A");
    const pA2 = makePair("A3", "A4", "A");

    // Court 1 → should get C pool only
    const court1 = generateNextMatch([pC1, pC2, pA1, pA2], 1, 3, new Set(), []);
    expect(court1).toBeDefined();
    expect(court1!.pair1.skillLevel).toBe("C");
    expect(court1!.pair2.skillLevel).toBe("C");
  });

  it("3-court routing: court 2 = B-pool, court 3 = A-pool", () => {
    const pB1 = makePair("B1", "B2", "B");
    const pB2 = makePair("B3", "B4", "B");
    const pA1 = makePair("A1", "A2", "A");
    const pA2 = makePair("A3", "A4", "A");

    // Court 2 → should get B pool only
    const court2 = generateNextMatch([pB1, pB2, pA1, pA2], 2, 3, new Set(), []);
    expect(court2).toBeDefined();
    expect(court2!.pair1.skillLevel).toBe("B");
    expect(court2!.pair2.skillLevel).toBe("B");

    // Court 3 → should get A pool only
    const court3 = generateNextMatch([pB1, pB2, pA1, pA2], 3, 3, new Set(), []);
    expect(court3).toBeDefined();
    expect(court3!.pair1.skillLevel).toBe("A");
    expect(court3!.pair2.skillLevel).toBe("A");
  });

  it("sets matchupLabel correctly for same-cohort", () => {
    const p1 = makePair("A", "B", "B");
    const p2 = makePair("C", "D", "B");
    const result = generateNextMatch([p1, p2], 1, 2, new Set(), []);
    expect(result!.matchupLabel).toBe("B vs B");
    expect(result!.skillLevel).toBe("B");
  });

  it("sets matchupLabel correctly for cross-cohort", () => {
    const pA = makePair("A1", "A2", "A");
    const pB = makePair("B1", "B2", "B");
    const result = generateNextMatch([pA, pB], 1, 2, new Set(), []);
    expect(result).toBeDefined();
    expect(result!.skillLevel).toBe("cross");
  });
});

// ─── findNextPendingForCourt ───────────────────────────────

describe("findNextPendingForCourt", () => {
  it("returns undefined when no pending matches", () => {
    const result = findNextPendingForCourt([], 1, 2, new Set(), [], []);
    expect(result).toBeUndefined();
  });

  it("picks a pending match for the freed court", () => {
    const p1 = makePair("A", "B");
    const p2 = makePair("C", "D");
    const m = makeMatch(p1, p2, { status: "pending" });
    const result = findNextPendingForCourt([m], 1, 2, new Set(), [p1, p2], [m]);
    expect(result).toBeDefined();
    expect(result!.id).toBe(m.id);
  });

  it("skips matches where players are busy on another court", () => {
    const p1 = makePair("A", "B");
    const p2 = makePair("C", "D");
    const p3 = makePair("E", "F");
    const playing = makeMatch(p1, p3, { status: "playing", court: 2 });
    const pending = makeMatch(p1, p2, { status: "pending" });
    const result = findNextPendingForCourt(
      [playing, pending],
      1,
      2,
      new Set(),
      [p1, p2, p3],
      [playing, pending],
    );
    // p1 is busy on court 2, so pending match (which needs p1) should be skipped
    expect(result).toBeUndefined();
  });

  it("skips matches with recent players (rest gap)", () => {
    const p1 = makePair("A", "B");
    const p2 = makePair("C", "D");
    const m = makeMatch(p1, p2, { status: "pending" });
    const recentIds = new Set(getPairPlayerIds(p1));
    const result = findNextPendingForCourt(
      [m],
      1,
      2,
      recentIds,
      [p1, p2],
      [m],
    );
    expect(result).toBeUndefined();
  });

  it("respects 3-court pool routing (court 1 = C pool)", () => {
    const pA1 = makePair("A1", "A2", "A");
    const pA2 = makePair("A3", "A4", "A");
    const pC1 = makePair("C1", "C2", "C");
    const pC2 = makePair("C3", "C4", "C");
    const abMatch = makeMatch(pA1, pA2, { status: "pending" });
    const cMatch = makeMatch(pC1, pC2, { status: "pending" });

    // Court 1 in 3-court mode → should pick C-pool match only
    const result = findNextPendingForCourt(
      [abMatch, cMatch],
      1,
      3,
      new Set(),
      [pA1, pA2, pC1, pC2],
      [abMatch, cMatch],
    );
    expect(result).toBeDefined();
    expect(result!.id).toBe(cMatch.id);
  });

  it("prefers pairs with fewer completed games (equity)", () => {
    const p1 = makePair("A", "B");
    const p2 = makePair("C", "D");
    const p3 = makePair("E", "F");
    const p4 = makePair("G", "H");

    // p1 has 3 completed games, p3 has 0
    const completed1 = makeMatch(p1, p2, { status: "completed" });
    const completed2 = makeMatch(p1, p2, { status: "completed" });
    const completed3 = makeMatch(p1, p2, { status: "completed" });

    const pendingHigh = makeMatch(p1, p4, { status: "pending", gameNumber: 1 });
    const pendingLow = makeMatch(p3, p4, { status: "pending", gameNumber: 2 });

    const allMatches = [completed1, completed2, completed3, pendingHigh, pendingLow];
    const allPairs = [p1, p2, p3, p4];

    const result = findNextPendingForCourt(
      allMatches,
      1,
      2,
      new Set(),
      allPairs,
      allMatches,
    );
    expect(result).toBeDefined();
    // p3 has fewer games so pendingLow should be preferred
    expect(result!.id).toBe(pendingLow.id);
  });

  it("skips both teams when their players are in recentPlayerIds (skip-match scenario)", () => {
    const p1 = makePair("A", "B");
    const p2 = makePair("C", "D");
    const p3 = makePair("E", "F");
    const p4 = makePair("G", "H");

    // Pending match between p1 vs p2 — but both teams' players are "recent" (skipped)
    const pendingSkipped = makeMatch(p1, p2, { status: "pending", gameNumber: 1 });
    // Another pending match with fresh teams
    const pendingFresh = makeMatch(p3, p4, { status: "pending", gameNumber: 2 });

    // Mark all players from the skipped match as recent
    const recentIds = new Set([
      ...getPairPlayerIds(p1),
      ...getPairPlayerIds(p2),
    ]);

    const allMatches = [pendingSkipped, pendingFresh];
    const allPairs = [p1, p2, p3, p4];

    const result = findNextPendingForCourt(
      allMatches,
      1,
      2,
      recentIds,
      allPairs,
      allMatches,
    );
    expect(result).toBeDefined();
    // Should pick the fresh match, not the one with recently-skipped players
    expect(result!.id).toBe(pendingFresh.id);
  });

  it("does not pick a match involving one skipped team when both teams are marked recent", () => {
    const p1 = makePair("A", "B");
    const p2 = makePair("C", "D");
    const p3 = makePair("E", "F");

    // p1 vs p3 is pending, but p1 was just skipped
    const pending1 = makeMatch(p1, p3, { status: "pending", gameNumber: 1 });
    // p2 vs p3 is also pending, p3 is unrelated to skip
    const pending2 = makeMatch(p2, p3, { status: "pending", gameNumber: 2 });

    // Only p1 and p2 were in the skipped match
    const recentIds = new Set([
      ...getPairPlayerIds(p1),
      ...getPairPlayerIds(p2),
    ]);

    const allMatches = [pending1, pending2];
    const allPairs = [p1, p2, p3];

    const result = findNextPendingForCourt(
      allMatches,
      1,
      2,
      recentIds,
      allPairs,
      allMatches,
      false, // strict — no rest relaxation
    );
    // Both pending matches involve a recent player (p1 or p2), so none should be picked
    expect(result).toBeUndefined();
  });
});

// ─── Integration: full dynamic flow ────────────────────────

describe("dynamic mode flow (getAvailableTeams → generateNextMatch)", () => {
  it("produces a valid match from available teams with wait-time priority", () => {
    const p1 = makePair("A", "B");
    const p2 = makePair("C", "D");
    const p3 = makePair("E", "F");
    const p4 = makePair("G", "H");

    // p3 has been waiting longest (5 games watched)
    const watched = { [p1.id]: 1, [p2.id]: 1, [p3.id]: 5, [p4.id]: 3 };

    const available = getAvailableTeams([p1, p2, p3, p4], [], watched, 4);
    expect(available[0].id).toBe(p3.id); // highest watch count

    const match = generateNextMatch(available, 1, 2, new Set(), []);
    expect(match).toBeDefined();
    // p3 should be in the generated match (it was first in sorted order)
    const matchPairIds = [match!.pair1.id, match!.pair2.id];
    expect(matchPairIds).toContain(p3.id);
  });

  it("returns no match when all pairs at target", () => {
    const p1 = makePair("A", "B");
    const p2 = makePair("C", "D");
    // 2 completed games each, target = 2
    const m1 = makeMatch(p1, p2, { status: "completed" });
    const m2 = makeMatch(p1, p2, { status: "completed" });
    const available = getAvailableTeams([p1, p2], [m1, m2], {}, 2);
    expect(available).toHaveLength(0);
    const match = generateNextMatch(available, 1, 2, new Set(), []);
    expect(match).toBeUndefined();
  });

  it("handles 3-court routing end-to-end", () => {
    const pC1 = makePair("C1", "C2", "C");
    const pC2 = makePair("C3", "C4", "C");
    const pA1 = makePair("A1", "A2", "A");
    const pA2 = makePair("A3", "A4", "A");
    const allPairs = [pC1, pC2, pA1, pA2];

    const available = getAvailableTeams(allPairs, [], {}, 4);
    expect(available).toHaveLength(4);

    // Court 1 → C pool
    const court1Match = generateNextMatch(available, 1, 3, new Set(), []);
    expect(court1Match).toBeDefined();
    expect(court1Match!.pair1.skillLevel).toBe("C");
    expect(court1Match!.pair2.skillLevel).toBe("C");

    // Court 3 → A pool
    const court3Match = generateNextMatch(available, 3, 3, new Set(), []);
    expect(court3Match).toBeDefined();
    expect(court3Match!.pair1.skillLevel).toBe("A");
    expect(court3Match!.pair2.skillLevel).toBe("A");
  });
});
