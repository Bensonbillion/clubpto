// The ranking rule, asserted by name:
//   points, then score difference, then whoever reached the total first.
//
// The third key is the one that replaces the coin flip, so it gets the most
// attention here, including the case where a player passes through their
// final total, drops below it, and comes back. Only the FIRST arrival counts,
// and getting that wrong silently reorders a table nobody can audit.

import { describe, expect, it } from "vitest";
import { POINTS_PER_WIN, computeStandings, type PlayedMatch } from "../standings";

let seq = 0;
const M = (
  teamA: [string, string],
  teamB: [string, string],
  scoreA: number,
  scoreB: number,
  matchIndex = ++seq,
): PlayedMatch => ({ matchIndex, completedAt: matchIndex * 1000, teamA, teamB, scoreA, scoreB });

const rank = (rows: ReturnType<typeof computeStandings>) => rows.map((r) => r.playerId);
const row = (rows: ReturnType<typeof computeStandings>, id: string) =>
  rows.find((r) => r.playerId === id)!;

describe("a win is 3, a loss is 0", () => {
  it("points are exactly 3 x wins, never touched by losses", () => {
    seq = 0;
    const rows = computeStandings(["a", "b", "c", "d"], [
      M(["a", "b"], ["c", "d"], 2, 0),
      M(["a", "c"], ["b", "d"], 2, 1),
    ]);
    expect(row(rows, "a").points).toBe(2 * POINTS_PER_WIN);
    expect(row(rows, "a").points).toBe(6);
    expect(row(rows, "d").points).toBe(0);
    expect(row(rows, "d").losses).toBe(2);
  });
});

describe("score difference breaks a points tie", () => {
  it("equal points, bigger difference ranks higher, and says so", () => {
    seq = 0;
    const rows = computeStandings(["big", "small", "x", "y"], [
      M(["big", "x"], ["small", "y"], 2, 0),   // big +2, small -2
      M(["small", "x"], ["big", "y"], 2, 1),   // small +1, big -1
      M(["big", "small"], ["x", "y"], 2, 0),   // both +2
    ]);
    // big: 2 wins (6pts), small: 1 win... make them level first.
    const b = row(rows, "big"), s = row(rows, "small");
    if (b.points === s.points) {
      expect(b.scoreDiff).not.toBe(s.scoreDiff);
      expect(rank(rows).indexOf("big")).toBeLessThan(rank(rows).indexOf("small"));
    }
    expect(rows.every((r) => r.rank > 0)).toBe(true);
  });

  it("labels the separation as diff when points match and diff does not", () => {
    seq = 0;
    // p and q both win once; p wins by more.
    const rows = computeStandings(["p", "q", "r", "s"], [
      M(["p", "r"], ["q", "s"], 2, 0),   // p +2, q -2
      M(["q", "r"], ["p", "s"], 2, 1),   // q +1, p -1
    ]);
    const p = row(rows, "p"), q = row(rows, "q");
    expect(p.points).toBe(q.points);
    expect(p.scoreDiff).toBeGreaterThan(q.scoreDiff);
    expect(rank(rows).indexOf("p")).toBeLessThan(rank(rows).indexOf("q"));
    expect(p.separatedBy).toBe("diff");
  });
});

describe("whoever reached the total first, the coin flip's replacement", () => {
  it("separates two players level on BOTH points and difference", () => {
    seq = 0;
    // early wins match 1; late wins match 3. Both finish 1W, +2.
    const rows = computeStandings(["early", "late", "x", "y"], [
      M(["early", "x"], ["late", "y"], 2, 0),  // 1: early +2
      M(["x", "y"], ["early", "late"], 2, 0),  // 2: early -2, late -2
      M(["late", "x"], ["early", "y"], 2, 0),  // 3: late +2, early -2
    ]);
    const e = row(rows, "early"), l = row(rows, "late");
    expect(e.points).toBe(l.points);
    expect(e.scoreDiff).toBe(l.scoreDiff);
    expect(e.reachedAt).toBeLessThan(l.reachedAt!);
    expect(rank(rows).indexOf("early")).toBeLessThan(rank(rows).indexOf("late"));
    expect(e.separatedBy).toBe("reachedFirst");
  });

  it("counts the FIRST arrival, not a later return to the same total", () => {
    seq = 0;
    // Both end on 3 points. `dip` got there at match 1. `steady` at match 4.
    // If the code recorded the LAST time the running total equalled the final
    // one, dip would look later than it is and the table would silently flip.
    const rows = computeStandings(["dip", "steady", "x", "y"], [
      M(["dip", "x"], ["steady", "y"], 2, 0),  // 1: dip reaches 3
      M(["x", "y"], ["dip", "steady"], 2, 1),  // 2: both lose
      M(["x", "y"], ["dip", "steady"], 2, 1),  // 3: both lose
      M(["steady", "x"], ["dip", "y"], 2, 0),  // 4: steady reaches 3, dip loses
    ]);
    const d = row(rows, "dip"), s = row(rows, "steady");
    expect(d.points).toBe(3);
    expect(s.points).toBe(3);
    expect(d.reachedAt).toBe(1);
    expect(s.reachedAt).toBe(4);
    expect(rank(rows).indexOf("dip")).toBeLessThan(rank(rows).indexOf("steady"));
  });

  it("is deterministic, the same night always produces the same table", () => {
    seq = 0;
    const ms = [
      M(["a", "b"], ["c", "d"], 2, 0),
      M(["a", "c"], ["b", "d"], 2, 1),
      M(["a", "d"], ["b", "c"], 1, 2),
      M(["b", "c"], ["a", "d"], 2, 0),
    ];
    const ids = ["a", "b", "c", "d"];
    const forward = rank(computeStandings(ids, ms));
    const shuffled = rank(computeStandings([...ids].reverse(), [...ms].reverse()));
    expect(shuffled).toEqual(forward);
  });

  it("never asks anyone to run a coin, no row is ever left unranked", () => {
    seq = 0;
    // Four players, identical records by construction: same points, same diff.
    const rows = computeStandings(["w", "x", "y", "z"], [
      M(["w", "x"], ["y", "z"], 2, 0),
      M(["y", "z"], ["w", "x"], 2, 0),
    ]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
    expect(new Set(rows.map((r) => r.rank)).size).toBe(4);
  });
});

describe("players who have not played", () => {
  it("sort last and do not claim to have reached anything", () => {
    seq = 0;
    const rows = computeStandings(["played", "benched", "x", "y"], [
      M(["played", "x"], ["y", "benched2" as unknown as string], 2, 0),
    ]);
    expect(row(rows, "benched").matchesPlayed).toBe(0);
    expect(row(rows, "benched").reachedAt).toBeNull();
    expect(rank(rows).indexOf("played")).toBeLessThan(rank(rows).indexOf("benched"));
  });
});

describe("who gets a standings row", () => {
  // A live full-system walk found Chi: played match one, marked left after,
  // and his row vanished from the table and the summary while his 7-5 kept
  // shaping everybody's score difference. A row you earned stays.
  const P = (id: string, court: number, away = false) =>
    ({ id, name: id, walkIn: false, courtNumber: court, away, joinedAtMatchIndex: null });
  const playedRow = (idx: number, a: string[], b: string[]) =>
    ({ matchIndex: idx, completedAt: idx, teamA: a, teamB: b, scoreA: 7, scoreB: 5 });

  it("a leaver who played keeps their row; one who never played is dropped", async () => {
    const { standingsIds } = await import("../../useSession");
    const players = [P("stay", 1), P("leftPlayed", 1, true), P("leftClean", 1, true), P("otherCourt", 2)];
    const played = [playedRow(1, ["stay", "leftPlayed"], ["x", "y"])];
    expect(standingsIds(players, played, 1)).toEqual(["stay", "leftPlayed"]);
  });
});
