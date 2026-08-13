// STEP 6.3 — the scoring system, asserted by name.
//
// A win is 3 points, a loss is 0, rank by points, ties break on the game
// scores already recorded at entry. Losses, head-to-head and strength of
// schedule are gone from the chain.
//
// These tests exist so nobody later "fixes" the deliberate consequences.

import { describe, expect, it } from "vitest";
import type {
  AmericanoMatch, AmericanoPlayer, AmericanoPool, AmericanoSession, MatchFormat,
} from "@/types/americano";
import { DEFAULT_FORMAT } from "../format";
import { POINTS_PER_WIN, computeStandings, tiedGroup } from "../standings";
import {
  applyCoinFlip, flipGroupOf, isBlankSlate, pendingFlips, poolStandings,
  unresolvedFlipsAffecting,
} from "../flips";
import { applyCorrection, applyVoid } from "../live";

const P = (id: string): AmericanoPlayer => ({
  playerId: id, displayName: id.toUpperCase(), tier: "B", status: "present",
  joinedAtMatchIndex: null, catchUpUsed: false,
});

let seq = 0;
const M = (
  teamA: [string, string], teamB: [string, string],
  winner: "A" | "B", setsLost: number, id?: string,
): AmericanoMatch => ({
  id: id ?? `m${++seq}`, poolId: "court-2", matchIndex: ++seq,
  teamA, teamB, result: { winner, setsLost }, status: "completed",
  phase: "round_robin", startedAt: seq * 10, completedAt: seq * 10 + 5,
});

const mkPool = (ids: string[], matches: AmericanoMatch[], format: MatchFormat = DEFAULT_FORMAT): AmericanoPool => ({
  id: "court-2", label: "Court 2", playerIds: ids, targetMatches: 6,
  playoffMode: "top8", status: "round_robin", matches, matchFormat: format,
});

const sess = (pool: AmericanoPool, players: AmericanoPlayer[]): AmericanoSession => ({
  id: "n", date: "2026-08-13", sessionName: "", players, pools: [pool],
  defaultMatchFormat: pool.matchFormat, isPractice: true, status: "active",
});

/* ── the headline consequence ────────────────────────────────────── */

describe("4-2 with +16 OUT-RANKS 4-0 with +4 (STEP 6.3, deliberate)", () => {
  it("differential replaces losses — losing twice while winning big wins", () => {
    // BIG wins four 2-0s (+8) and loses two 0-2s (-4)… we need +16, so give
    // the pool a single-game format where margins are large.
    const g11: MatchFormat = { kind: "singleGame", targetPoints: 11 };
    const players = ["big", "clean", "f1", "f2", "f3", "f4"].map(P);
    const R = (
      teamA: [string, string], teamB: [string, string],
      winner: "A" | "B", loserPoints: number,
    ): AmericanoMatch => ({
      id: `x${++seq}`, poolId: "court-2", matchIndex: seq, teamA, teamB,
      result: { winner, loserPoints }, status: "completed", phase: "round_robin",
      startedAt: seq, completedAt: seq + 1,
    });

    const pool = mkPool(players.map((p) => p.playerId), [
      // BIG: four crushing wins (+11 each … 11-0) and two narrow losses (-1).
      R(["big", "f1"], ["f2", "f3"], "A", 0),
      R(["big", "f2"], ["f1", "f3"], "A", 0),
      R(["big", "f3"], ["f1", "f2"], "A", 0),
      R(["big", "f4"], ["f1", "f2"], "A", 0),
      R(["f1", "f2"], ["big", "f3"], "A", 10),
      R(["f1", "f3"], ["big", "f2"], "A", 10),
      // CLEAN: four narrow wins (+1 each), no losses.
      R(["clean", "f1"], ["f2", "f4"], "A", 10),
      R(["clean", "f2"], ["f1", "f4"], "A", 10),
      R(["clean", "f3"], ["f1", "f4"], "A", 10),
      R(["clean", "f4"], ["f1", "f2"], "A", 10),
    ], g11);

    const rows = computeStandings(pool, players);
    const big = rows.find((r) => r.playerId === "big")!;
    const clean = rows.find((r) => r.playerId === "clean")!;

    expect(big.wins).toBe(4);
    expect(big.losses).toBe(2);
    expect(big.points).toBe(12);
    expect(big.gameDiff).toBe(4 * 11 - 2 * 1); // +42
    expect(clean.wins).toBe(4);
    expect(clean.losses).toBe(0);
    expect(clean.points).toBe(12);
    expect(clean.gameDiff).toBe(4 * 1);        // +4

    // SAME points, and differential decides — the unbeaten record loses.
    expect(big.points).toBe(clean.points);
    expect(big.rank).toBeLessThan(clean.rank);
    expect(big.tiebreakApplied).toBe("diff");
  });
});

/* ── points ──────────────────────────────────────────────────────── */

describe("points = 3 × wins (STEP 6.3)", () => {
  it("holds at equal AND unequal match counts, and orders exactly like wins", () => {
    const players = ["a", "b", "c", "d", "e", "f"].map(P);
    const pool = mkPool(players.map((p) => p.playerId), [
      M(["a", "b"], ["c", "d"], "A", 1),
      M(["a", "c"], ["b", "e"], "A", 1),
      M(["a", "d"], ["e", "f"], "A", 1),   // a: 3 wins; e,f fewer matches
      M(["b", "c"], ["d", "e"], "A", 1),
    ]);
    const rows = computeStandings(pool, players);
    for (const r of rows) {
      expect(r.points).toBe(POINTS_PER_WIN * r.wins);
      expect(r.points).toBe(3 * r.wins);
    }
    // Match counts genuinely differ across the table…
    expect(new Set(rows.map((r) => r.matchesPlayed)).size).toBeGreaterThan(1);
    // …and the points order is exactly the wins order.
    const byPoints = [...rows].map((r) => r.playerId);
    const byWins = [...rows].sort((x, y) => y.wins - x.wins || y.gameDiff - x.gameDiff ||
      (x.playerId < y.playerId ? -1 : 1)).map((r) => r.playerId);
    expect(byPoints).toEqual(byWins);
  });

  it("a row's annotation is only ever null, diff, or coinflip", () => {
    const players = ["a", "b", "c", "d", "e", "f"].map(P);
    const pool = mkPool(players.map((p) => p.playerId), [
      M(["a", "b"], ["c", "d"], "A", 0),
      M(["a", "c"], ["b", "d"], "A", 1),
      M(["e", "f"], ["c", "d"], "B", 1),
    ]);
    for (const r of computeStandings(pool, players)) {
      expect([null, "diff", "coinflip"]).toContain(r.tiebreakApplied);
    }
  });
});

/* ── the widened tie ─────────────────────────────────────────────── */

describe("equal points and diff at UNEQUAL losses is now a real tie (STEP 6.3)", () => {
  const build = () => {
    // p and q both finish on 3 points and +2, but q played (and lost) more.
    const players = ["p", "q", "r", "s", "t", "u"].map(P);
    const pool = mkPool(players.map((x) => x.playerId), [
      M(["p", "r"], ["s", "t"], "A", 0, "mp"),   // p: 1W +2
      M(["q", "r"], ["s", "u"], "A", 0, "mq"),   // q: 1W +2
      M(["q", "s"], ["r", "u"], "B", 0, "mq2"),  // q: +1 loss, -2 … so q = +0
    ]);
    return { players, pool };
  };

  it("the pair is tied, flagged, and only a coin can order them", () => {
    // Craft the exact case: give q a compensating win so diff matches again.
    const players = ["p", "q", "r", "s", "t", "u"].map(P);
    const pool = mkPool(players.map((x) => x.playerId), [
      M(["p", "r"], ["s", "t"], "A", 1, "n1"),   // p: 1W, +1
      M(["q", "r"], ["s", "u"], "A", 1, "n2"),   // q: 1W, +1
      M(["q", "t"], ["p", "u"], "B", 1, "n3"),   // q loses (−1), p wins (+1) → p = +2
      M(["q", "u"], ["s", "t"], "A", 0, "n4"),   // q wins 2-0 (+2) → q = +2
    ]);
    const rows = computeStandings(pool, players);
    const p = rows.find((r) => r.playerId === "p")!;
    const q = rows.find((r) => r.playerId === "q")!;
    expect(p.points).toBe(q.points);
    expect(p.gameDiff).toBe(q.gameDiff);
    expect(p.losses).not.toBe(q.losses);          // the widening, by name
    expect(tiedGroup(pool, "p", undefined, players)).toContain("q");
    expect(p.requiresCoinFlip).toBe(true);
    expect(q.requiresCoinFlip).toBe(true);

    // …and it resolves through the UNCHANGED 6.2 group machinery: one visible
    // coin at a time until the group's order is COMPLETE.
    let s = sess(pool, players);
    expect(pendingFlips(pool, players).length).toBeGreaterThan(0);
    for (let g = 0; g < 20; g++) {
      const pend = pendingFlips(s.pools[0], s.players);
      if (pend.length === 0) break;
      s = applyCoinFlip(s, "court-2", pend[0].a, pend[0].b, pend[0].a, 1_000 + g);
    }
    const after = poolStandings(s.pools[0], s.players);
    expect(after.some((r) => r.tiebreakApplied === "coinflip")).toBe(true);
    expect(after.some((r) => r.requiresCoinFlip)).toBe(false);
    void build;
  });

  it("a blank-slate group is still never tied, and still never blocks", () => {
    const players = ["a", "b", "c", "d"].map(P);
    const pool = mkPool(players.map((p) => p.playerId), []);
    expect(isBlankSlate(pool, players.map((p) => p.playerId))).toBe(true);
    expect(pendingFlips(pool, players)).toEqual([]);
    expect(unresolvedFlipsAffecting(pool, players, 4)).toEqual([]);
    expect(computeStandings(pool, players).some((r) => r.requiresCoinFlip)).toBe(false);
  });

  it("flipGroupOf now asks only points and diff — no SOS, no head-to-head", () => {
    const players = ["a", "b", "c", "d", "e", "f"].map(P);
    // a and b meet head to head and split nothing: a beats b, yet they end
    // level on points and diff, so they are STILL tied (H2H left the chain).
    const pool = mkPool(players.map((p) => p.playerId), [
      M(["a", "c"], ["b", "d"], "A", 1, "h1"),   // a +1, b -1
      M(["b", "c"], ["e", "f"], "A", 1, "h2"),   // b +1 → b: 1W-1L, 0
      M(["a", "d"], ["e", "f"], "B", 1, "h3"),   // a -1 → a: 1W-1L, 0
    ]);
    const rows = computeStandings(pool, players);
    const a = rows.find((r) => r.playerId === "a")!;
    const b = rows.find((r) => r.playerId === "b")!;
    expect(a.points).toBe(b.points);
    expect(a.gameDiff).toBe(b.gameDiff);
    expect(flipGroupOf(pool, "a", players)).toContain("b");
    expect(a.requiresCoinFlip).toBe(true);
  });
});

/* ── corrections and voids ───────────────────────────────────────── */

describe("corrections and voids recompute points and diff (STEP 6.3)", () => {
  const base = () => {
    const players = ["a", "b", "c", "d"].map(P);
    const pool = mkPool(players.map((p) => p.playerId), [
      M(["a", "b"], ["c", "d"], "A", 0, "c1"),
      M(["a", "c"], ["b", "d"], "A", 1, "c2"),
    ]);
    return sess(pool, players);
  };

  it("a correction moves both numbers", () => {
    let s = base();
    const before = poolStandings(s.pools[0], s.players).find((r) => r.playerId === "a")!;
    expect(before.points).toBe(6);
    expect(before.gameDiff).toBe(3); // +2 then +1

    s = applyCorrection(s, "c2", { winner: "B", setsLost: 0 });
    const after = poolStandings(s.pools[0], s.players).find((r) => r.playerId === "a")!;
    expect(after.points).toBe(3);          // one win gone
    expect(after.gameDiff).toBe(0);        // +2 then −2
  });

  it("a void removes the match from both numbers entirely", () => {
    let s = base();
    s = applyVoid(s, "c1");
    const a = poolStandings(s.pools[0], s.players).find((r) => r.playerId === "a")!;
    expect(a.points).toBe(3);
    expect(a.gameDiff).toBe(1);
    expect(a.matchesPlayed).toBe(1);
  });
});
