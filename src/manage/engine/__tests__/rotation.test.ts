// "Whoever is owed a game is at the top" — the queue rule, asserted by name.
//
// The cases that matter are the ones where "owed" and "least played" diverge:
// a late arrival, an extended target, and a player marked away. Those are the
// three things that happen on a real Wednesday and the three that a naive
// least-played sort gets wrong.

import { describe, expect, it } from "vitest";
import type { Match, Player } from "../../types";
import {
  buildQueue, courtComplete, nextMatch, totalMatches, validTargets,
} from "../rotation";

const P = (id: string, over: Partial<Player> = {}): Player => ({
  id, name: id.toUpperCase(), walkIn: false, courtNumber: 1, away: false,
  joinedAtMatchIndex: null, ...over,
});

let seq = 0;
const played = (ids: string[]): Match => ({
  id: `m${++seq}`, courtNumber: 1, matchIndex: seq,
  teamA: [ids[0], ids[1]], teamB: [ids[2], ids[3]],
  scoreA: 2, scoreB: 0, status: "played", startedAt: seq, completedAt: seq, stage: null,
});

const eight = () => ["a", "b", "c", "d", "e", "f", "g", "h"].map((x) => P(x));

describe("the queue puts whoever is owed a game at the top", () => {
  it("with nobody played, everyone is owed the same and roster order holds", () => {
    seq = 0;
    const q = buildQueue(eight(), [], 1, 4);
    expect(q).toHaveLength(8);
    expect(q.every((x) => x.owed === 4)).toBe(true);
    expect(q.map((x) => x.playerId)).toEqual(["a", "b", "c", "d", "e", "f", "g", "h"]);
  });

  it("players who have had games drop below those who have not", () => {
    seq = 0;
    const q = buildQueue(eight(), [played(["a", "b", "c", "d"])], 1, 4);
    expect(q.slice(0, 4).map((x) => x.playerId)).toEqual(["e", "f", "g", "h"]);
    expect(q[0].owed).toBe(4);
    expect(q[7].owed).toBe(3);
  });

  it("A LATE ARRIVAL goes straight to the top — they are owed the most", () => {
    seq = 0;
    // Eight players have each had two games; a ninth walks in at match 5.
    const ms = [
      played(["a", "b", "c", "d"]), played(["e", "f", "g", "h"]),
      played(["a", "b", "c", "d"]), played(["e", "f", "g", "h"]),
    ];
    const roster = [...eight(), P("late", { joinedAtMatchIndex: 5 })];
    const q = buildQueue(roster, ms, 1, 4);
    expect(q[0].playerId).toBe("late");
    expect(q[0].owed).toBe(4);
    // …and they are actually put on court, not left to wait out the backlog.
    expect(nextMatch(roster, ms, 1, 4)!.teamA.concat(nextMatch(roster, ms, 1, 4)!.teamB))
      .toContain("late");
  });

  it("EXTENDING the target owes everyone one more, with no special case", () => {
    seq = 0;
    const ms = [played(["a", "b", "c", "d"]), played(["e", "f", "g", "h"])];
    const before = buildQueue(eight(), ms, 1, 1);
    expect(before.every((x) => x.owed === 0)).toBe(true);
    const after = buildQueue(eight(), ms, 1, 2);
    expect(after.every((x) => x.owed === 1)).toBe(true);
  });

  it("someone marked AWAY leaves the queue but keeps their results", () => {
    seq = 0;
    const roster = eight().map((p) => (p.id === "a" ? { ...p, away: true } : p));
    const q = buildQueue(roster, [played(["a", "b", "c", "d"])], 1, 4);
    expect(q.map((x) => x.playerId)).not.toContain("a");
    expect(q).toHaveLength(7);
  });

  it("players on another court are never queued — they stay put all night", () => {
    seq = 0;
    const roster = [...eight(), P("other", { courtNumber: 2 })];
    expect(buildQueue(roster, [], 1, 4).map((x) => x.playerId)).not.toContain("other");
  });
});

describe("the next four", () => {
  it("splits the top four as 1+4 against 2+3", () => {
    seq = 0;
    const m = nextMatch(eight(), [], 1, 4)!;
    expect(m.teamA).toEqual(["a", "d"]);
    expect(m.teamB).toEqual(["b", "c"]);
  });

  it("returns null rather than inventing a three-player game", () => {
    seq = 0;
    const three = [P("a"), P("b"), P("c")];
    expect(nextMatch(three, [], 1, 4)).toBeNull();
  });

  it("STOPS at the target — a four-round night never draws a fifth", () => {
    seq = 0;
    // Four players, target 2, both rounds played: everyone is owed nothing.
    const ms = [played(["a", "b", "c", "d"]), played(["a", "c"].concat(["b", "d"]))];
    const four = ["a", "b", "c", "d"].map((x) => P(x));
    expect(courtComplete(four, ms, 1, 2)).toBe(true);
    expect(nextMatch(four, ms, 1, 2)).toBeNull();
    // …and raising the target puts them straight back on.
    expect(nextMatch(four, ms, 1, 3)).not.toBeNull();
  });

  it("is deterministic — same court, same state, same four", () => {
    seq = 0;
    const ms = [played(["a", "b", "c", "d"])];
    expect(nextMatch(eight(), ms, 1, 4)).toEqual(nextMatch(eight(), ms, 1, 4));
  });
});

describe("targets have to divide the room", () => {
  it("only offers targets where every game has four players", () => {
    expect(validTargets(8)).toEqual([2, 3, 4, 5, 6, 7, 8]);
    expect(validTargets(9)).toEqual([4, 8]);
    expect(validTargets(10)).toEqual([2, 4, 6, 8]);
    expect(validTargets(6)).toEqual([2, 4, 6, 8]);
  });

  it("every offered target yields a whole number of matches", () => {
    for (const size of [4, 6, 8, 9, 10, 11, 12, 16]) {
      for (const t of validTargets(size)) {
        expect(Number.isInteger(totalMatches(size, t))).toBe(true);
      }
    }
  });
});

describe("a court is complete when everyone has had their games", () => {
  it("is false while anyone is short, true when nobody is", () => {
    seq = 0;
    const ms = [played(["a", "b", "c", "d"])];
    expect(courtComplete(eight(), ms, 1, 1)).toBe(false);
    const all = [...ms, played(["e", "f", "g", "h"])];
    expect(courtComplete(eight(), all, 1, 1)).toBe(true);
  });

  it("an empty court is not 'complete' — it has not started", () => {
    expect(courtComplete([], [], 1, 4)).toBe(false);
  });
});
