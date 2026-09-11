// The setup warnings for a night whose numbers bend the third law, and for
// one the laws cannot deal out at all.
//
// Frame 07's notes are sentences the operator reads before anyone plays, so
// they are tested as sentences rather than through a render. The arithmetic
// inside them is not the screen's: engine/rotation.ts forcedMixing prices the
// night with the same oracle the picker uses. The last test plays a night out
// to show the sentence is not merely arithmetic, and that the A's who meet
// the B's twice are the ones the note counted.

import { describe, expect, it } from "vitest";
import type { Match, Player } from "../types";
import { forcedMixing, matchesPlayedBy, nextMatch, unfinishableCourt } from "../engine/rotation";
import { tierOf } from "../engine/tiers";
import type { Tier } from "../engine/tiers";
import { noteWords } from "../screens/setup/model";

let seq = 0;
const P = (tier?: Tier): Player => {
  seq += 1;
  return {
    id: `p${seq}`, name: `P${seq}`, walkIn: false, courtNumber: 1, away: false,
    joinedAtMatchIndex: null, ...(tier ? { tier } : {}),
  };
};
const many = (count: number, tier?: Tier) => Array.from({ length: count }, () => P(tier));
const court = (as: number, bs: number, cs = 0) => {
  seq = 0;
  return [...many(as, "A"), ...many(bs, "B"), ...many(cs, "C")];
};

/** The note the courts step would push for this court, in its own words. */
const words = (players: Player[], target: number, suggested = false): string | null => {
  const bend = forcedMixing(players, 1, target);
  return bend === null ? null : noteWords({
    kind: "capBends",
    courtNumber: 1,
    aCount: bend.aCount,
    target: bend.target,
    suggested,
    seats: bend.seats,
    secondGames: bend.secondGames,
  });
};

describe("the night the numbers bend the rule", () => {
  it("six A's at four each with two B's say so, seats and all", () => {
    // The B's owe eight games, every one of them seats two A's across the
    // net, and six A's cannot fill eight seats once each.
    const players = court(6, 2);
    expect(forcedMixing(players, 1, 4)).toEqual({
      aCount: 6, target: 4, seats: 8, secondGames: 2,
    });
    expect(words(players, 4)).toBe(
      "Six A's at four each on Court 1 need eight seats across the net from the B's."
      + " Two A's meet the B's twice.",
    );
  });

  it("the same eight at three each keep the rule, and say nothing", () => {
    // Three each is twenty-four seats, six games, and the B's six games need
    // only six A-seats. Six A's fill those once each.
    expect(forcedMixing(court(6, 2), 1, 3)).toBeNull();
    expect(words(court(6, 2), 3)).toBeNull();
  });

  it("a lone B counts the A's who sit across the net from them", () => {
    // A lone B by headcount is the free law: the B's three games each hold
    // three A's, so nine seats for seven A's.
    const players = court(7, 1);
    expect(forcedMixing(players, 1, 3)).toEqual({
      aCount: 7, target: 3, seats: 9, secondGames: 2,
    });
    expect(words(players, 3)).toBe(
      "Seven A's at three each on Court 1 need nine seats across the net from the B's."
      + " Two A's meet the B's twice.",
    );
  });

  it("three A's among five B's stops counting and says every A", () => {
    // Four A's are needed for a game of A's, so with three there are none:
    // every game an A plays is a game with the B's.
    const players = court(3, 5);
    const bend = forcedMixing(players, 1, 4);
    expect(bend).toEqual({ aCount: 3, target: 4, seats: 12, secondGames: 9 });
    expect(words(players, 4)).toBe(
      "Three A's at four each on Court 1 need twelve seats across the net from the B's."
      + " Every A meets the B's more than once.",
    );
  });

  it("one A on the court is one A, not every A", () => {
    // A single A among B's is an ordinary split. The first sentence already
    // singularised it, the second did not, so 116 of the 557 courts that
    // emit this note printed "One A ... needs three seats" and then "Every A
    // meets the B's more than once" about the same person. That A takes
    // every seat the sentence just counted, so it says how many.
    const players = court(1, 7);
    expect(forcedMixing(players, 1, 3)).toEqual({
      aCount: 1, target: 3, seats: 3, secondGames: 2,
    });
    expect(words(players, 3)).toBe(
      "One A at three each on Court 1 needs three seats across the net from the B's."
      + " That A meets the B's three times.",
    );
    expect(words(players, 3)).not.toContain("Every A");
  });

  it("names the target as a suggestion while it still is one", () => {
    // The split step comes before the target step, so the number on screen
    // is whatever the split seeded until the operator has chosen.
    expect(words(court(6, 2), 4, true)).toBe(
      "Six A's at the suggested four each on Court 1 need eight seats across the net"
      + " from the B's. Two A's meet the B's twice.",
    );
  });

  it("spells the seat count a big target reaches", () => {
    // The target step offers up to eight games each, so the seats a note
    // counts go well past twelve. Three A's with a lone B at eight each need
    // twenty-four of them, and until 2026-09-11 the sentence spelled "Three
    // A's" and then printed "24 seats" in the same breath.
    const players = court(3, 1);
    expect(forcedMixing(players, 1, 8)).toEqual({
      aCount: 3, target: 8, seats: 24, secondGames: 21,
    });
    expect(words(players, 8)).toBe(
      "Three A's at eight each on Court 1 need twenty-four seats across the net"
      + " from the B's. Every A meets the B's more than once.",
    );
    expect(words(players, 8)).not.toContain("24");
  });

  it("says nothing about the Wednesday roster, which keeps the rule", () => {
    // Twelve A's and eight B's on one court, the night the law was written
    // for. It holds at three and at four each.
    expect(forcedMixing(court(12, 8), 1, 3)).toBeNull();
    expect(forcedMixing(court(12, 8), 1, 4)).toBeNull();
  });

  it("says nothing about a court with no A or no B", () => {
    // Nobody can be charged on either, and the oracle is not asked.
    expect(forcedMixing(court(8, 0), 1, 3)).toBeNull();
    expect(forcedMixing(court(0, 8), 1, 3)).toBeNull();
    expect(forcedMixing(court(4, 4, 3), 1, 4)).toBeNull();
  });
});

describe("the night the laws cannot deal out at all", () => {
  /** The note the courts step would push for a stuck court. */
  const stuckWords = (courtNumber: number, target: number, suggested = false) =>
    noteWords({ kind: "capStuck", courtNumber, target, suggested });

  it("names the court that cannot give everyone the target", () => {
    // Two A's, two B's and two C's at four each. The eight A-seats force
    // four A B against A B games, those use up every game the B's owe, and
    // the C's are left with nobody the laws allow them on court with.
    // validTargets takes it (six at four each is six whole games) and no
    // player is stranded, so nothing else at setup catches it.
    expect(unfinishableCourt(court(2, 2, 2), 1, 4)).toBe(true);
    expect(stuckWords(1, 4)).toBe(
      "The balance laws cannot give everyone on Court 1 exactly four games."
      + " Some players finish off target. Change the target, or move somebody across.",
    );
    expect(stuckWords(2, 3, true)).toBe(
      "The balance laws cannot give everyone on Court 2 exactly the suggested three games."
      + " Some players finish off target. Change the target, or move somebody across.",
    );
  });

  it("misses in the other direction too, which is why it says off target", () => {
    // Two A's and three B's at four each is the shape mixing-sweep.ts carves
    // out: five players, five games' worth of seats, and the engine deals
    // six, the two A's finishing on six games and the three B's on four.
    // Nobody finishes short there, so the sentence says off target.
    expect(unfinishableCourt(court(2, 3), 1, 4)).toBe(true);
    expect(unfinishableCourt(court(3, 2), 1, 4)).toBe(true);
    expect(stuckWords(1, 4)).not.toContain("short");
  });

  it("stays quiet on every court that deals out level", () => {
    // The Wednesday roster at each of its targets, the court the third law
    // bends on, and a court with beginners on it.
    expect(unfinishableCourt(court(12, 8), 1, 3)).toBe(false);
    expect(unfinishableCourt(court(12, 8), 1, 4)).toBe(false);
    expect(unfinishableCourt(court(12, 8), 1, 5)).toBe(false);
    expect(unfinishableCourt(court(6, 2), 1, 4)).toBe(false);
    expect(unfinishableCourt(court(7, 1), 1, 3)).toBe(false);
    expect(unfinishableCourt(court(4, 4, 3), 1, 4)).toBe(false);
  });

  it("says nothing about a court the oracle is not worth asking", () => {
    // No A or no B is the case the oracle has nothing to say about, not a
    // court that is fine, and the picker skips it for the same reason.
    expect(unfinishableCourt(court(8, 0), 1, 3)).toBe(false);
    expect(unfinishableCourt(court(0, 8), 1, 3)).toBe(false);
  });

  it("is the note and the bend, never both", () => {
    // capBends is the law bending on a night that still finishes; capStuck
    // is a night that does not. forcedMixing drops the Infinity price for
    // exactly that reason.
    const stuck = court(2, 2, 2);
    expect(unfinishableCourt(stuck, 1, 4)).toBe(true);
    expect(forcedMixing(stuck, 1, 4)).toBeNull();
    const bends = court(6, 2);
    expect(unfinishableCourt(bends, 1, 4)).toBe(false);
    expect(forcedMixing(bends, 1, 4)).not.toBeNull();
  });

  it("describes a night that really does leave people off target", () => {
    const players = court(2, 2, 2);
    const matches: Match[] = [];
    // Six at four each is six games. The guard turns "the engine never
    // stops" into a finished loop rather than a hung run.
    for (let guard = 0; guard < 30; guard++) {
      const next = nextMatch(players, matches, 1, 4);
      if (!next) break;
      matches.push({
        id: `m${matches.length}`, courtNumber: 1, matchIndex: matches.length + 1,
        teamA: next.teamA, teamB: next.teamB,
        scoreA: 2, scoreB: 0, status: "played", startedAt: 0, completedAt: 0, stage: null,
      });
    }
    const counts = players.map((p) => matchesPlayedBy(matches, p.id));
    expect(counts.some((n) => n !== 4)).toBe(true);
  });
});

describe("the sentence against the night it describes", () => {
  it("six A's at four each meet the B's twice exactly as often as the note says", () => {
    const players = court(6, 2);
    const bend = forcedMixing(players, 1, 4)!;
    const matches: Match[] = [];
    // A court of eight at four each is eight games. The bound turns "the
    // engine never stops" into a failed assertion rather than a hung run.
    for (let guard = 0; guard < 20; guard++) {
      const next = nextMatch(players, matches, 1, 4);
      if (!next) break;
      matches.push({
        id: `m${matches.length}`, courtNumber: 1, matchIndex: matches.length + 1,
        teamA: next.teamA, teamB: next.teamB,
        scoreA: 2, scoreB: 0, status: "played", startedAt: 0, completedAt: 0, stage: null,
      });
    }
    const bGames = new Map<string, number>();
    for (const m of matches) {
      const ids = [...m.teamA, ...m.teamB];
      if (!ids.some((id) => tierOf(players.find((p) => p.id === id)!) === "B")) continue;
      for (const id of ids) {
        if (tierOf(players.find((p) => p.id === id)!) !== "A") continue;
        bGames.set(id, (bGames.get(id) ?? 0) + 1);
      }
    }
    const counts = players
      .filter((p) => tierOf(p) === "A")
      .map((p) => bGames.get(p.id) ?? 0);
    // Everyone finished on target, every A had their game, and the seconds
    // landed on two different A's, which is the note's own last sentence.
    expect(matches).toHaveLength(8);
    expect(counts.filter((n) => n >= 2)).toHaveLength(bend.secondGames);
    expect(Math.max(...counts)).toBe(2);
    expect(Math.min(...counts)).toBe(1);
  });
});
