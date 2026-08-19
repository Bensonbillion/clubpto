// The bracket's shape, and the readiness gate.
//
// The case that matters is the smallest one: four players seed into two pairs,
// and two pairs play each other ONCE. Emitting a semi as well leaves the final
// waiting on a second semi-final that can never happen, so the bracket cannot
// be finished even though the winner is already known. That is the bug this
// file exists to keep out.

import { describe, expect, it } from "vitest";
import type { Match, Player } from "../../types";
import { buildStages, champion, readiness, seedPairs, seedPlayoffMatch } from "../playoff";

const P = (id: string, over: Partial<Player> = {}): Player => ({
  id, name: id.toUpperCase(), walkIn: false, courtNumber: 1, away: false,
  joinedAtMatchIndex: null, ...over,
});

let seq = 0;
const group = (ids: string[]): Match => ({
  id: `g${++seq}`, courtNumber: 1, matchIndex: seq,
  teamA: [ids[0], ids[1]], teamB: [ids[2], ids[3]],
  scoreA: 2, scoreB: 0, status: "played", startedAt: seq, completedAt: seq, stage: null,
});

const playoff = (a: [string, string], b: [string, string],
                 scoreA: number | null, scoreB: number | null): Match => ({
  id: `p-final-${++seq}`, courtNumber: 1, matchIndex: seq,
  teamA: a, teamB: b, scoreA, scoreB,
  status: scoreA == null ? "onCourt" : "played",
  startedAt: seq, completedAt: scoreA == null ? null : seq, stage: "final",
});

const four = () => ["a", "b", "c", "d"].map((x) => P(x));

describe("four players is a final, not a semi", () => {
  it("emits ONE stage, and it is the final", () => {
    const pairs = seedPairs(["a", "b", "c", "d"])!;
    expect(pairs).toHaveLength(2);
    const stages = buildStages(pairs, []);
    expect(stages).toHaveLength(1);
    expect(stages[0].key).toBe("final");
    expect(stages[0].ties).toHaveLength(1);
  });

  it("both pairs are on that tie from the start — nothing is waiting", () => {
    const pairs = seedPairs(["a", "b", "c", "d"])!;
    const [final] = buildStages(pairs, [])[0].ties;
    expect(final.sideA).not.toBeNull();
    expect(final.sideB).not.toBeNull();
  });

  it("scoring it crowns a champion — the bracket can actually be finished", () => {
    const pairs = seedPairs(["a", "b", "c", "d"])!;
    seq = 0;
    const stages = buildStages(pairs, [
      playoff(pairs[0].playerIds, pairs[1].playerIds, 21, 15),
    ]);
    expect(champion(stages)).toEqual(pairs[0].playerIds);
  });

  it("the regression: a spurious semi left the final unfinishable", () => {
    // With a semi emitted too, the final's sides came from semi winners and the
    // SECOND semi never existed, so one side stayed null forever. There is now
    // no stage but the final, and PlayoffStage has one member so no other tag
    // can be written — the compiler carries the rest of this guarantee.
    const stages = buildStages(seedPairs(["a", "b", "c", "d"])!, []);
    expect(stages.map((st) => st.key)).toEqual(["final"]);
    expect(stages[0].ties[0].sideB).not.toBeNull();
  });
});

describe("seeding", () => {
  it("pairs 1+4 and 2+3, so the top two seeds cannot meet early", () => {
    const pairs = seedPairs(["s1", "s2", "s3", "s4"])!;
    expect(pairs[0].playerIds).toEqual(["s1", "s4"]);
    expect(pairs[1].playerIds).toEqual(["s2", "s3"]);
  });

  it("refuses rather than fielding a half bracket", () => {
    expect(seedPairs(["a", "b", "c"])).toBeNull();
  });
});

describe("readiness is never blocked by a tie", () => {
  it("blocks while matches are still owed", () => {
    seq = 0;
    const r = readiness(four(), [], 1, 2);
    expect(r.ready).toBe(false);
    expect(r.blocker).toBe("matchesOutstanding");
  });

  it("blocks a court that cannot field four", () => {
    const r = readiness([P("a"), P("b")], [], 1, 1);
    expect(r.ready).toBe(false);
    expect(r.blocker).toBe("notEnoughPlayers");
  });

  it("is ready once everyone has had their games — ties settle themselves", () => {
    seq = 0;
    // Every player finishes level on points AND difference: under the old
    // engine this is exactly the state that demanded a coin. Here it seeds.
    const r = readiness(four(), [group(["a", "b", "c", "d"])], 1, 1);
    expect(r.ready).toBe(true);
    expect(r.blocker).toBeNull();
    expect(seedPairs(r.eligible)).not.toBeNull();
  });
});

describe("the seeded match and the bracket row are the same match", () => {
  // The regression: seedPlayoff wrote the match tagged `semi` while the bracket
  // looked the final's tie up by `stage === "final"`. Both existed, both looked
  // right on screen, and the score simply never landed on the row — the final
  // sat at 00-00 with a result already recorded and no champion could be
  // crowned. One stage name, produced in one place, is the fix.
  it("the match seeding puts on court is the one the bracket reads back", () => {
    seq = 0;
    const pairs = seedPairs(["a", "b", "c", "d"])!;
    // Exactly what the app does: mint it, then read it back through the bracket.
    const onCourt = seedPlayoffMatch(1, pairs, 5, 1_700_000_000_000);
    const tie = buildStages(pairs, [onCourt])[0].ties[0];
    expect(tie.sideA).toEqual(pairs[0].playerIds);
    expect(tie.sideB).toEqual(pairs[1].playerIds);
    expect(tie.settled).toBe(false);
  });

  it("scoring that same match settles the tie and crowns a champion", () => {
    seq = 0;
    const pairs = seedPairs(["a", "b", "c", "d"])!;
    const onCourt = seedPlayoffMatch(1, pairs, 5, 1_700_000_000_000);
    const played: Match = { ...onCourt, scoreA: 21, scoreB: 9, status: "played", completedAt: 1 };
    const stages = buildStages(pairs, [played]);
    expect(stages[0].ties[0].scoreA).toBe(21);
    expect(stages[0].ties[0].settled).toBe(true);
    expect(champion(stages)).toEqual(pairs[0].playerIds);
  });
});
