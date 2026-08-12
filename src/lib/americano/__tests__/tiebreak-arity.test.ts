// STEP 6.1 — the exactly-two head-to-head rule, pinned from every consumer.
//
// H2H orders a tie ONLY when the tied group is a pair. It is not transitive,
// so a group of three or more cannot be ordered by it and the chain falls
// through to SOS and then the coin. That rule now lives in exactly one place —
// standings.h2hSeparates — and computeStandings, stillTiedPreFlip,
// pendingFlipPairs and unresolvedFlipsAffecting all read it from there.
//
// These fixtures exist because a mutation check found the rule UNPINNED:
// flipping `groupSize === 2` to `=== 3` left all 52 tests green. Both
// directions are now asserted, from the standings side and the flips side, so
// altering the predicate in its one home fails every consumer together.

import { describe, expect, it } from "vitest";
import type {
  AmericanoMatch, AmericanoPlayer, AmericanoPool, AmericanoScore, AmericanoSession,
} from "@/types/americano";
import {
  computeStandings, h2hSeparates, strengthOfSchedule, tiedGroup,
} from "../standings";
import { pendingFlipPairs, stillTiedPreFlip, unresolvedFlipsAffecting } from "../flips";

const IDS = ["a", "b", "c", "d", "e", "f", "g", "h"];

const players: AmericanoPlayer[] = IDS.map((id) => ({
  playerId: id, displayName: id.toUpperCase(), tier: "B",
  status: "present", joinedAtMatchIndex: null, catchUpUsed: false,
}));

type Spec = { a: [string, string]; b: [string, string]; w: "A" | "B"; s: AmericanoScore };

const mkPool = (specs: Spec[]): AmericanoPool => ({
  id: "court-2", label: "Court 2", playerIds: IDS, targetMatches: 2,
  playoffMode: "top8", status: "round_robin",
  matches: specs.map((m, i): AmericanoMatch => ({
    id: `court-2-m${i + 1}`, poolId: "court-2", matchIndex: i + 1,
    teamA: m.a, teamB: m.b, result: { winner: m.w, score: m.s },
    status: "completed", phase: "round_robin",
    startedAt: i * 100, completedAt: i * 100 + 50,
  })),
});

const sess = (pool: AmericanoPool): AmericanoSession => ({
  id: "n", date: "2026-08-12", sessionName: "", players, pools: [pool],
  isPractice: true, status: "active",
});

/* ── fixture 1: a PAIR, separated by head-to-head ────────────────── */
// a and d both finish 1W-1L +0 with equal SOS (6). They met once, in m1,
// and a won — so H2H applies and there is nothing left for a coin to decide.
const PAIR = mkPool([
  { a: ["d", "f"], b: ["a", "e"], w: "B", s: "2-0" }, // a beats d
  { a: ["b", "e"], b: ["f", "h"], w: "A", s: "2-1" },
  { a: ["a", "b"], b: ["e", "f"], w: "B", s: "2-0" },
  { a: ["b", "f"], b: ["d", "h"], w: "B", s: "2-0" },
]);

/* ── fixture 2: a TRIO, where head-to-head must stay silent ──────── */
// a, d and e all finish 1W-1L +0. a beat d in m1 and their SOS is equal (4),
// but the group is three, so H2H cannot order it: the pair stays flip-tied.
const TRIO = mkPool([
  { a: ["a", "f"], b: ["d", "g"], w: "A", s: "2-1" }, // a beats d
  { a: ["c", "d"], b: ["b", "e"], w: "A", s: "2-1" },
  { a: ["e", "f"], b: ["a", "b"], w: "A", s: "2-1" },
]);

describe("the fixtures really are what the tests assume", () => {
  it("PAIR: a and d are a two-group with equal SOS and a decisive meeting", () => {
    expect(tiedGroup(PAIR, "a").sort()).toEqual(["a", "d"]);
    expect(strengthOfSchedule(PAIR, "a")).toBe(strengthOfSchedule(PAIR, "d"));
    expect(h2hSeparates(PAIR, 2, "a", "d")).toBe(true);
  });

  it("TRIO: a, d and e are a three-group; a and d met and share SOS", () => {
    expect(tiedGroup(TRIO, "a").sort()).toEqual(["a", "d", "e"]);
    expect(strengthOfSchedule(TRIO, "a")).toBe(strengthOfSchedule(TRIO, "d"));
    // The meeting exists, but the group's size is what decides its relevance.
    expect(h2hSeparates(TRIO, 2, "a", "d")).toBe(true);
    expect(h2hSeparates(TRIO, 3, "a", "d")).toBe(false);
  });
});

describe("consumer 1 — computeStandings", () => {
  it("uses H2H on a pair: the winner ranks higher and the row reads h2h", () => {
    const rows = computeStandings(PAIR, players);
    const a = rows.find((r) => r.playerId === "a")!;
    const d = rows.find((r) => r.playerId === "d")!;
    expect(a.rank).toBeLessThan(d.rank);
    expect(a.tiebreakApplied).toBe("h2h");
    expect(a.requiresCoinFlip).toBe(false);
    expect(d.requiresCoinFlip).toBe(false);
  });

  it("refuses H2H on a trio: the tie survives to the coin", () => {
    const rows = computeStandings(TRIO, players);
    const a = rows.find((r) => r.playerId === "a")!;
    const d = rows.find((r) => r.playerId === "d")!;
    expect(a.tiebreakApplied).not.toBe("h2h");
    expect(d.tiebreakApplied).not.toBe("h2h");
    expect(rows.filter((r) => r.requiresCoinFlip).length).toBeGreaterThan(0);
  });
});

describe("consumer 2 — stillTiedPreFlip", () => {
  it("a pair separated by H2H is NOT flip-tied", () => {
    expect(stillTiedPreFlip(PAIR, "a", "d")).toBe(false);
  });

  it("the same meeting inside a trio leaves the pair flip-tied", () => {
    expect(stillTiedPreFlip(TRIO, "a", "d")).toBe(true);
  });
});

describe("consumers 3 and 4 — pendingFlipPairs and unresolvedFlipsAffecting", () => {
  it("no flip is offered for an H2H-separated pair", () => {
    const offered = pendingFlipPairs(PAIR, players);
    expect(offered.some((p) => [p.a, p.b].sort().join() === "a,d")).toBe(false);
    expect(unresolvedFlipsAffecting(PAIR, players, 8)
      .some((f) => [f.a, f.b].sort().join() === "a,d")).toBe(false);
  });

  it("the trio's members are offered a flip, and the gate sees it", () => {
    const offered = pendingFlipPairs(TRIO, players);
    expect(offered.length).toBeGreaterThan(0);
    const trio = new Set(["a", "d", "e"]);
    expect(offered.some((p) => trio.has(p.a) && trio.has(p.b))).toBe(true);
    // Cut at 8 seats everyone, so every unresolved tie orders the bracket.
    expect(unresolvedFlipsAffecting(TRIO, players, 8).length).toBeGreaterThan(0);
  });

  it("the whole chain agrees: a table row flagged for a flip is a flip-tied pair", () => {
    for (const pool of [PAIR, TRIO]) {
      for (const { a, b } of pendingFlipPairs(pool, players)) {
        expect(stillTiedPreFlip(pool, a, b)).toBe(true);
        const group = tiedGroup(pool, a);
        expect(group).toContain(b);
        expect(h2hSeparates(pool, group.length, a, b)).toBe(false);
      }
      expect(sess(pool).pools[0].coinFlipResolutions).toBeUndefined();
    }
  });
});
