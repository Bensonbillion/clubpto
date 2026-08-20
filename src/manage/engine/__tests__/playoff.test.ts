// The bracket's shape, the pairing rule, and the readiness gate.
//
// Two failures shaped this file. The first shipped: seeding took only the top
// FOUR players and paired them 1+4 / 2+3, so half the court watched the climax
// and the top two seeds were kept apart by luck of the draw rather than by the
// rule. The second was the four-player bracket emitting a semifinal it could
// never fill. Both have a test below.

import { describe, expect, it } from "vitest";
import type { Match, Player } from "../../types";
import {
  buildStages,
  champion,
  fieldedPlayers,
  isTrio,
  nextTie,
  PLAYOFF_STAGES,
  readiness,
  seedPairs,
  seedPlayoffMatch,
  type PlayoffStage,
  type SeededPair,
  type Stage,
} from "../playoff";

const P = (id: string, over: Partial<Player> = {}): Player => ({
  id, name: id.toUpperCase(), walkIn: false, courtNumber: 1, away: false,
  joinedAtMatchIndex: null, ...over,
});

/** Standings order for a court of `n`: p1 is the top seed. */
const ids = (n: number): string[] => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const seedsOf = (pairs: readonly SeededPair[]) => pairs.map((s) => s.seeds);
const pairsFor = (n: number): SeededPair[] => seedPairs(ids(n))!;

let seq = 0;
const group = (four: string[]): Match => ({
  id: `g${++seq}`, courtNumber: 1, matchIndex: seq,
  teamA: [four[0], four[1]], teamB: [four[2], four[3]],
  scoreA: 2, scoreB: 0, status: "played", startedAt: seq, completedAt: seq, stage: null,
});

const score = (m: Match, a: number, b: number): Match =>
  ({ ...m, scoreA: a, scoreB: b, status: "played", completedAt: (m.startedAt ?? 0) + 1 });

/** Mint the next playable row exactly the way the app does. */
const mintNext = (pairs: readonly SeededPair[], playoffMatches: readonly Match[]) => {
  const stages = buildStages(pairs, playoffMatches);
  const tie = nextTie(stages);
  if (!tie) return null;
  const match = seedPlayoffMatch(
    1, tie, playoffMatches.length + 1, 1_700_000_000_000 + playoffMatches.length, playoffMatches,
  );
  return { stages, tie, match };
};

const tieById = (stages: readonly Stage[], id: string) =>
  stages.flatMap((s) => s.ties).find((t) => t.id === id)!;

describe("pairing splits adjacent seeds", () => {
  it("eight players pair 1+3, 2+4, 5+7, 6+8", () => {
    // The shipped bug: seeding kept only seeds 1 to 4 and paired them 1+4 and
    // 2+3, so seeds 5 to 8 had no playoff at all.
    expect(seedsOf(pairsFor(8))).toEqual([[1, 3], [2, 4], [5, 7], [6, 8]]);
  });

  it("keeps going in blocks of four: 9+11 and 10+12", () => {
    expect(seedsOf(pairsFor(12))).toEqual([[1, 3], [2, 4], [5, 7], [6, 8], [9, 11], [10, 12]]);
  });

  it("seeds 1 and 2 are never partners, at any court size", () => {
    // The superteam. Pairing the top two makes the final a coronation, so this
    // is the property the whole pairing rule exists to guarantee.
    for (let n = 4; n <= 24; n += 1) {
      const together = pairsFor(n).some((s) => s.seeds.includes(1) && s.seeds.includes(2));
      expect({ n, together }).toEqual({ n, together: false });
    }
  });

  it("puts every player on the court into the playoff, once", () => {
    for (let n = 4; n <= 24; n += 1) {
      const placed = pairsFor(n).flatMap((s) => s.playerIds);
      expect(placed.slice().sort()).toEqual(ids(n).slice().sort());
    }
  });

  it("refuses a court that cannot field a match", () => {
    expect(seedPairs(["a", "b", "c"])).toBeNull();
  });
});

describe("the awkward headcounts", () => {
  it("ten players make five pairs, with 9+10 last, and the bracket owes a play-in", () => {
    // Frame 26: seeds 1 to 8 pair normally, 9+10 form the fifth pair, and
    // pairs four and five play one play-in for the last semifinal slot.
    const pairs = pairsFor(10);
    expect(seedsOf(pairs)).toEqual([[1, 3], [2, 4], [5, 7], [6, 8], [9, 10]]);

    const stages = buildStages(pairs, []);
    expect(stages.map((s) => s.key)).toEqual(["playIn", "semi", "final"]);
    expect(stages[0].ties).toHaveLength(1);
    expect(stages[0].ties[0].sideA!.seeds).toEqual([6, 8]);
    expect(stages[0].ties[0].sideB!.seeds).toEqual([9, 10]);
    // The play-in winner takes the last seat, so it meets the top seed.
    expect(stages[1].ties[0].sideA!.seeds).toEqual([1, 3]);
    expect(stages[1].ties[0].sideB).toBeNull();
    expect(stages[1].ties[1].sideA!.seeds).toEqual([2, 4]);
    expect(stages[1].ties[1].sideB!.seeds).toEqual([5, 7]);
  });

  it("nine players give a trio containing seed 9, and nobody is dropped", () => {
    // The ninth seed used to fall out of the bracket entirely. It joins the
    // fourth pair instead, and the side honestly holds three ids.
    const pairs = pairsFor(9);
    expect(seedsOf(pairs)).toEqual([[1, 3], [2, 4], [5, 7], [6, 8, 9]]);
    const last = pairs[3];
    expect(isTrio(last)).toBe(true);
    expect(last.playerIds).toEqual(["p6", "p8", "p9"]);
    expect(pairs.flatMap((s) => s.playerIds)).toHaveLength(9);
  });

  it("a trio fields two at a time and the seat rotates", () => {
    // Two of three are on court for any one match, and the seed who joined
    // last plays first, which is the point of joining them at all.
    const trio = pairsFor(9)[3];
    expect(fieldedPlayers(trio, 0)).toEqual(["p8", "p9"]);
    expect(fieldedPlayers(trio, 1)).toEqual(["p6", "p9"]);
    expect(fieldedPlayers(trio, 2)).toEqual(["p6", "p8"]);
    expect(fieldedPlayers(trio, 3)).toEqual(["p8", "p9"]);
  });

  it("the trio's minted match still puts exactly two ids on each side", () => {
    const pairs = pairsFor(9);
    const first = mintNext(pairs, [])!;
    expect(first.match.teamA).toHaveLength(2);
    expect(first.match.teamB).toEqual(["p8", "p9"]);
  });
});

describe("the bracket is a vertical list that crosses top against bottom", () => {
  it("four pairs: semifinals P1 v P4 and P2 v P3, then the final", () => {
    const pairs = pairsFor(8);
    const stages = buildStages(pairs, []);
    expect(stages.map((s) => s.key)).toEqual(["semi", "final"]);
    expect(stages[0].ties[0].sideA!.seeds).toEqual([1, 3]);
    expect(stages[0].ties[0].sideB!.seeds).toEqual([6, 8]);
    expect(stages[0].ties[1].sideA!.seeds).toEqual([2, 4]);
    expect(stages[0].ties[1].sideB!.seeds).toEqual([5, 7]);
    // The final waits on both semifinals, so both of its sides start empty.
    expect(stages[1].ties[0].sideA).toBeNull();
    expect(stages[1].ties[0].sideB).toBeNull();
  });

  it("two pairs is the FINAL only, with both sides on it from the start", () => {
    // The regression. With a semifinal emitted as well, the final's sides came
    // from semifinal winners and the SECOND semifinal never existed, so one
    // side stayed null forever and the bracket could not be finished even
    // though the winner was already known.
    const pairs = pairsFor(4);
    const stages = buildStages(pairs, []);
    expect(stages.map((s) => s.key)).toEqual(["final"]);
    expect(stages[0].ties).toHaveLength(1);
    expect(stages[0].ties[0].sideA!.seeds).toEqual([1, 3]);
    expect(stages[0].ties[0].sideB!.seeds).toEqual([2, 4]);
  });

  it("three pairs: a play-in, then the final against the top pair", () => {
    // Not drawn in the wireframes. Derived from the five-pair rule rather than
    // invented: the surplus pairs play down to the size of the next round,
    // and with three pairs that next round is a final of two.
    const pairs = pairsFor(6);
    expect(pairs).toHaveLength(3);
    const stages = buildStages(pairs, []);
    expect(stages.map((s) => s.key)).toEqual(["playIn", "final"]);
    expect(stages[0].ties[0].sideA!.seeds).toEqual([2, 4]);
    expect(stages[0].ties[0].sideB!.seeds).toEqual([5, 6]);
    expect(stages[1].ties[0].sideA!.seeds).toEqual([1, 3]);
    expect(stages[1].ties[0].sideB).toBeNull();
  });

  it("nothing can be put on court while a row is waiting on a result", () => {
    const pairs = pairsFor(8);
    const semi1 = mintNext(pairs, [])!;
    // The final is unplayable until both semifinals are in, so the next row
    // offered is the other semifinal and never the final.
    const next = mintNext(pairs, [score(semi1.match, 16, 11)])!;
    expect(next.tie.id).toBe("semi-2");
  });
});

describe("the seeded match and the bracket row are the same match", () => {
  // The expensive one: a match was minted tagged "semi" while the bracket read
  // its row back as "final". Both existed, both looked right on screen, and
  // the score simply never landed on the row. PlayoffStage used to have one
  // member so the compiler carried this; it has three now, so the guarantee is
  // structural (the tie carries the tag, one function mints it) and this test
  // is what proves it, for every stage there is.
  it("mint then read back binds the row, at every stage", () => {
    const pairs = pairsFor(10); // Ten reaches all three stages: play-in, semi, final.
    const seen: PlayoffStage[] = [];
    let playoffMatches: Match[] = [];

    for (let guard = 0; guard < 10; guard += 1) {
      const step = mintNext(pairs, playoffMatches);
      if (!step) break;
      seen.push(step.tie.stage);

      // Read the freshly minted match back through the bracket.
      const onCourt = buildStages(pairs, [...playoffMatches, step.match]);
      const row = tieById(onCourt, step.tie.id);
      expect(row.matchId).toBe(step.match.id);
      expect(row.live).toBe(true);
      expect(row.settled).toBe(false);
      expect(step.match.stage).toBe(step.tie.stage);

      // Score it, and the same row settles rather than some other row.
      playoffMatches = [...playoffMatches, score(step.match, 16, 11)];
      const settled = tieById(buildStages(pairs, playoffMatches), step.tie.id);
      expect(settled.matchId).toBe(step.match.id);
      expect(settled.scoreA).toBe(16);
      expect(settled.settled).toBe(true);
    }

    expect(seen).toHaveLength(4); // one play-in, two semifinals, one final
    for (const stage of PLAYOFF_STAGES) expect(seen).toContain(stage);
  });

  it("a voided playoff match is replaced by its replay, not read alongside it", () => {
    const pairs = pairsFor(4);
    const first = mintNext(pairs, [])!;
    const voided: Match = { ...score(first.match, 21, 9), status: "voided" };
    const replay = mintNext(pairs, [voided])!;
    expect(replay.tie.id).toBe("final-1");
    const row = tieById(buildStages(pairs, [voided, score(replay.match, 15, 21)]), "final-1");
    expect(row.matchId).toBe(replay.match.id);
    expect(row.scoreA).toBe(15);
  });
});

describe("a champion is crowned through a full eight-player bracket", () => {
  it("three matches, and the winner of the final is the champion", () => {
    const pairs = pairsFor(8);
    let playoffMatches: Match[] = [];
    const played: string[] = [];

    for (let guard = 0; guard < 5; guard += 1) {
      const step = mintNext(pairs, playoffMatches);
      if (!step) break;
      played.push(step.tie.id);
      // Side A wins every row, so P1 and P2 meet in the final and P1 wins it.
      playoffMatches = [...playoffMatches, score(step.match, 21, 12)];
    }

    expect(played).toEqual(["semi-1", "semi-2", "final-1"]);
    const stages = buildStages(pairs, playoffMatches);
    expect(champion(stages)!.seeds).toEqual([1, 3]);
    expect(champion(stages)!.playerIds).toEqual(["p1", "p3"]);
  });

  it("no champion while the final is unplayed", () => {
    expect(champion(buildStages(pairsFor(8), []))).toBeNull();
  });
});

describe("readiness is never blocked by a tie", () => {
  const four = () => ids(4).map((x) => P(x));

  it("blocks while matches are still owed", () => {
    seq = 0;
    const r = readiness(four(), [], 1, 2);
    expect(r.ready).toBe(false);
    expect(r.blocker).toBe("matchesOutstanding");
  });

  it("blocks a court that cannot field four", () => {
    const r = readiness([P("p1"), P("p2")], [], 1, 1);
    expect(r.ready).toBe(false);
    expect(r.blocker).toBe("notEnoughPlayers");
  });

  it("is ready once everyone has had their games, because ties settle themselves", () => {
    seq = 0;
    // Every player finishes level on points AND difference: under the old
    // engine this is exactly the state that demanded a coin. Here it seeds.
    const r = readiness(four(), [group(ids(4))], 1, 1);
    expect(r.ready).toBe(true);
    expect(r.blocker).toBeNull();
    expect(seedPairs(r.eligible)).not.toBeNull();
  });
});

describe("a full first round is quarterfinals, not play-ins", () => {
  it("sixteen players, eight pairs: the first stage says Quarterfinals", () => {
    // Found on a live walk: the ending card offered a court of sixteen
    // "Eight pairs, a play-in, two semis". With eight pairs nobody has a
    // bye, so 1v8, 2v7, 3v6, 4v5 is a quarterfinal round and every surface
    // that names the stage should say so. The stored key stays "playIn" so
    // a bracket already minted keeps claiming its matches.
    const stages = buildStages(pairsFor(16), []);
    expect(stages.map((s) => s.key)).toEqual(["playIn", "semi", "final"]);
    expect(stages[0].ties).toHaveLength(4);
    expect(stages[0].label).toBe("Quarterfinals");
    expect(stages.map((s) => s.word)).toEqual(["Quarterfinal", "Semifinal", "Final"]);
  });

  it("a first round with byes keeps the play-in name, counted honestly", () => {
    // Ten players: one play-in, seeds one to three wait. Fourteen players,
    // seven pairs: three play-ins, only the top pair waits. Both are real
    // play-ins because somebody enters the bracket a round late.
    const ten = buildStages(pairsFor(10), []);
    expect(ten[0].label).toBe("Play-in");
    expect(ten[0].word).toBe("Play-in");
    const fourteen = buildStages(pairsFor(14), []);
    expect(fourteen[0].label).toBe("Play-ins");
    expect(fourteen[0].ties).toHaveLength(3);
    expect(fourteen[0].word).toBe("Play-in");
  });
});
