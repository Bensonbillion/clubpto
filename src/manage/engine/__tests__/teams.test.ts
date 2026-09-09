// The Set teammate branch (frames 35 to 37).

import { describe, expect, it } from "vitest";
import type { KnockoutPair, Match } from "../../types";
import {
  mintTeamMatch, nextTeamTie, pairCounts, seedByTable, suggestTeamTarget,
  teamMatchesTotal, teamStandings, teamsComplete, validTeamTargets,
} from "../teams";

const pairs = (n: number): KnockoutPair[] =>
  Array.from({ length: n }, (_, i) => ({ seed: i + 1, playerIds: [`a${i + 1}`, `b${i + 1}`] }));

let idn = 0;
const played = (a: KnockoutPair, b: KnockoutPair, sa: number, sb: number): Match => ({
  id: `m${++idn}`, courtNumber: 1, matchIndex: idn,
  teamA: [a.playerIds[0], a.playerIds[1]], teamB: [b.playerIds[0], b.playerIds[1]],
  scoreA: sa, scoreB: sb, status: "played", startedAt: 1, completedAt: idn, stage: null,
});

describe("frame 35: games per pair", () => {
  it("five pairs: four divides, five does not, six does", () => {
    expect(validTeamTargets(5)).toEqual([2, 4, 6, 8]);
    expect(suggestTeamTarget(5)).toBe(4);
    expect(teamMatchesTotal(5, 4)).toBe(10);
    expect(teamMatchesTotal(5, 6)).toBe(15);
  });

  it("an even number of pairs takes any target", () => {
    expect(validTeamTargets(4)).toEqual([2, 3, 4, 5, 6, 7, 8]);
  });
});

describe("who goes on next", () => {
  it("least-played-first over pairs, and opponents vary before any rematch", () => {
    const P = pairs(4);
    // Pair 1 has played pair 2. The next tie for pair 1's side must not be
    // pair 2 again while pairs 3 and 4 are unmet and equally played.
    const m = [played(P[0], P[1], 7, 5)];
    const tie = nextTeamTie(P, m, 3)!;
    // Least played are pairs 3 and 4 (zero games): they meet each other.
    expect([tie.a.seed, tie.b.seed]).toEqual([3, 4]);
    // With those two on court, nobody else can go on (pairs 1 and 2 are
    // the only free pair, and a pair does not play itself).
    const live: Match = { ...played(P[2], P[3], 0, 0), status: "onCourt", scoreA: null, scoreB: null };
    const next = nextTeamTie(P, [...m, live], 3)!;
    expect([next.a.seed, next.b.seed]).toEqual([1, 2]);
  });

  it("prefers an unmet opponent over a rematch", () => {
    const P = pairs(3);
    const m = [played(P[0], P[1], 7, 5), played(P[0], P[2], 7, 5)];
    // Pairs 2 and 3 are on one game each and have not met: they play.
    const tie = nextTeamTie(P, m, 4)!;
    expect([tie.a.seed, tie.b.seed].sort()).toEqual([2, 3]);
  });

  it("a pair at its target is done, and the night completes when all are", () => {
    const P = pairs(2);
    const m = [played(P[0], P[1], 7, 5), played(P[1], P[0], 6, 7)];
    expect(nextTeamTie(P, m, 2)).toBeNull();
    expect(teamsComplete(P, m, 2)).toBe(true);
    expect(teamsComplete(P, m, 3)).toBe(false);
    expect(pairCounts(P, m).get("a1+b1")!.played).toBe(2);
  });
});

describe("frame 36: the table over pairs", () => {
  it("ranks pairs on points, then score difference, in the individual engine's own words", () => {
    const P = pairs(3);
    const m = [played(P[0], P[1], 7, 3), played(P[2], P[1], 7, 6), played(P[0], P[2], 5, 7)];
    const rows = teamStandings(P, m);
    // Pair 3 won both of theirs (6), pair 1 won one (3), pair 2 none.
    expect(rows.map((r) => r.playerId)).toEqual(["a3+b3", "a1+b1", "a2+b2"]);
    expect(rows[0].points).toBe(6);
    expect(rows[1].points).toBe(3);
  });
});

describe("frame 37: seed the bracket from the table", () => {
  it("table position becomes draw position, first against last", () => {
    const P = pairs(3);
    const m = [played(P[2], P[0], 7, 3), played(P[2], P[1], 7, 3), played(P[1], P[0], 7, 3)];
    const rows = teamStandings(P, m);
    const draw = seedByTable(P, rows);
    expect(draw.map((p) => p.playerIds[0])).toEqual(["a3", "a2", "a1"]);
    expect(draw.map((p) => p.seed)).toEqual([1, 2, 3]);
  });
});

describe("minting", () => {
  it("a trio fields two and rotates, like the knockout's trio", () => {
    const trio: KnockoutPair = { seed: 1, playerIds: ["x", "y", "z"] };
    const other: KnockoutPair = { seed: 2, playerIds: ["p", "q"] };
    const first = mintTeamMatch(1, trio, other, 1, 1000, []);
    expect(first.teamA).toHaveLength(2);
    const second = mintTeamMatch(1, trio, other, 2, 2000, [{ ...first, status: "played", scoreA: 7, scoreB: 5 }]);
    expect(second.teamA).not.toEqual(first.teamA);
    expect(first.stage).toBeNull();
  });
});
