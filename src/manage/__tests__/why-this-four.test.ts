// Frame 11's sentences, and the roster footer's one.
//
// Both are copy the operator reads out to a player who asked why they are
// sitting, so both are tested as strings rather than through a render. The
// rule at issue is the third law (2026-09-10): an A plays one game with the
// B's a night and never a second, which is allowed to hold a least-played
// player back a game. That makes two sentences that used to be flat true
// conditional, and a screen that keeps saying them is the bug.
//
// Half of these drive the engine rather than hand-building a reason. A card
// that reads correctly off a made-up note and wrongly off a real draw is the
// failure this file exists to catch: until 2026-09-11 frame 11 called
// explainMatch, which handed back an empty heldBack whatever the picker had
// done, so the held-back sentence was tested here and unreachable in the app.

import { describe, expect, it } from "vitest";
import type { Match, Player } from "../types";
import type { MatchReason } from "../engine/rotation";
import { courtSpread, explainMatch, nextMatch } from "../engine/rotation";
import { leastPlayedWords, mixingWords } from "../screens/play/model";
import { roundRobinCounts } from "../screens/people/model";

const reasonOf = (over: Partial<MatchReason> = {}): MatchReason => ({
  leastPlayed: ["Benson", "Timi", "Ade", "Sam"].map((name, i) => ({
    playerId: `p${i}`, name, matchesPlayed: 1,
  })),
  courtSpread: 0,
  withinOneGame: true,
  balance: { kind: "noAssessedC", cPlayers: [], swap: null },
  mixing: { kind: "noAs", aPlayers: [], heldBack: [] },
  ...over,
});

/** An A and B court on one court, with names the assertions can read. */
const roster = (as: number, bs: number): Player[] => [
  ...Array.from({ length: as }, (_, i) => ({
    id: `a${i + 1}`, name: `A${i + 1}`, walkIn: false, courtNumber: 1, away: false,
    joinedAtMatchIndex: null, tier: "A" as const,
  })),
  ...Array.from({ length: bs }, (_, i) => ({
    id: `b${i + 1}`, name: `B${i + 1}`, walkIn: false, courtNumber: 1, away: false,
    joinedAtMatchIndex: null, tier: "B" as const,
  })),
];

/**
 * Play the night out, stopping at the first draw the caller is looking for,
 * and hand back the reason FRAME 11 would show: explainMatch over the match
 * sitting on court, exactly as ManageApp builds it.
 */
const frameElevenAt = (
  players: Player[],
  target: number,
  wanted: (reason: MatchReason) => boolean,
): MatchReason | null => {
  const played: Match[] = [];
  for (let n = 1; n <= 60; n += 1) {
    const drawn = nextMatch(players, played, 1, target);
    if (!drawn) return null;
    const live: Match = {
      id: `m${n}`, courtNumber: 1, matchIndex: n, teamA: drawn.teamA, teamB: drawn.teamB,
      scoreA: null, scoreB: null, status: "onCourt", startedAt: 0, completedAt: null, stage: null,
    };
    const shown = explainMatch(players, [...played, live], 1, drawn.teamA, drawn.teamB, target);
    if (wanted(shown)) return shown;
    played.push({ ...live, status: "played", scoreA: 2, scoreB: 0, completedAt: 0 });
  }
  return null;
};

describe("the first card stays true", () => {
  it("promises the court only while the court is keeping the promise", () => {
    expect(leastPlayedWords(reasonOf())).toBe(
      "Benson, Timi, Ade and Sam had played the fewest games, so they are on."
      + " Nobody on this court is ever more than one game behind.",
    );
    expect(leastPlayedWords(reasonOf({ courtSpread: 2, withinOneGame: false }))).toBe(
      "Benson, Timi, Ade and Sam had played the fewest games, so they are on.",
    );
  });

  it("says who was passed over rather than claiming these four played fewest", () => {
    // The cap held somebody back, so "they had played the fewest games" is
    // not true of this four and the sentence does not say it.
    const held = reasonOf({
      mixing: {
        kind: "pure",
        aPlayers: ["Benson", "Timi", "Ade", "Sam"].map((name) => ({ name, bGames: 1 })),
        heldBack: [{ name: "Ese" }],
      },
    });
    expect(leastPlayedWords(held)).toBe(
      "Benson, Timi, Ade and Sam are on. Ese had played fewer, but putting them on would"
      + " have cost an A a second game with the B's, so they wait a round.",
    );
    expect(leastPlayedWords(held)).not.toContain("had played the fewest games");
  });

  it("names the other reason a four is passed over, when the four leaves nothing dealable", () => {
    // The cost has two terms. Usually the fairer four charges an A a second
    // game with the B's, now or later, and the sentence says so. Sometimes
    // it prices higher only because the seats it leaves cannot be dealt out
    // into whole lawful games, and somebody would finish short. Naming the
    // third law there tells a player the wrong rule. Reached on the walk-in
    // and leaver sweep, 47 draws of about five hundred held-back ones.
    const held = reasonOf({
      mixing: {
        kind: "pure",
        aPlayers: ["Benson", "Timi", "Ade", "Sam"].map((name) => ({ name, bGames: 1 })),
        heldBack: [{ name: "Ese" }],
        heldBackBy: "unfinished",
      },
    });
    expect(leastPlayedWords(held)).toBe(
      "Benson, Timi, Ade and Sam are on. Ese had played fewer, but putting them on would"
      + " have left somebody short of their games, so they wait a round.",
    );
    expect(leastPlayedWords(held)).not.toContain("second game with the B's");
  });

  it("the two lists on the screen name the same four in the same order", () => {
    // Frame 11's first card reads `leastPlayed` and its fourth reads the
    // A's off the mixing note. Both are on one screen, so a four listed
    // "A3, A4, A5 and A6" up top and "A3, A6, A4 and A5" underneath reads
    // as arbitrary. The picker built its list from the lineup until
    // 2026-09-11; it is the queue's order now, which is what the first
    // card uses.
    const shown = frameElevenAt(roster(6, 2), 4, (r) => r.mixing.aPlayers.length >= 3);
    expect(shown).not.toBeNull();
    const upTop = shown!.leastPlayed.map((p) => p.name)
      .filter((n) => shown!.mixing.aPlayers.some((a) => a.name === n));
    expect(shown!.mixing.aPlayers.map((a) => a.name)).toEqual(upTop);
  });

  it("reaches the screen: a real held-back draw read back through explainMatch", () => {
    // Six A's and six B's at four each. The third game is the first the cap
    // reorders: two B's on no games at all wait a round, because dealing
    // them would have cost an A a second game with the B's. Frame 11 opens
    // on the match ON COURT, so this is the path that used to print "had
    // played the fewest games" over a four that had not.
    const shown = frameElevenAt(roster(6, 6), 4, (r) => r.mixing.heldBack.length > 0);
    expect(shown).not.toBeNull();
    expect(shown!.mixing.heldBack.map((h) => h.name)).toEqual(["B5", "B6"]);
    const words = leastPlayedWords(shown!);
    expect(words).not.toContain("had played the fewest games");
    expect(words).toContain("B5 and B6 had played fewer");
    expect(words).toContain("so they wait a round");
  });

  it("claims nothing for a four it cannot match to a draw", () => {
    // A hand-arranged four, or a card played out of order, is not a draw
    // this engine made. explainMatch falls back to what the log supports
    // and the frame prints its ordinary sentence.
    const players = roster(6, 6);
    const shown = explainMatch(players, [], 1, ["a1", "b1"], ["a2", "b2"], 4);
    expect(shown.mixing.heldBack).toEqual([]);
    // With no target at all the replay is never attempted, which is what
    // keeps nextMatch from drawing every row of the card twice.
    expect(explainMatch(players, [], 1, ["a1", "b1"], ["a2", "b2"]).mixing.heldBack).toEqual([]);
  });
});

describe("the fourth card, one game with the B's", () => {
  it("is absent when there is no A in the match", () => {
    expect(mixingWords({ kind: "noAs", aPlayers: [], heldBack: [] })).toBeNull();
  });

  it("states the allowance for a match with no B, and names who has not spent it", () => {
    // "pure" knows the four holds no B, and now knows each A's count. It
    // does NOT say the missing game is coming: six A's and six B's at four
    // each have room for two mixed games, so two A's never meet the B's.
    const words = mixingWords({
      kind: "pure",
      aPlayers: [
        { name: "Benson", bGames: 1 }, { name: "Timi", bGames: 1 },
        { name: "Ade", bGames: 0 }, { name: "Sam", bGames: 0 },
      ],
      heldBack: [],
    });
    expect(words).toBe(
      "Benson, Timi, Ade and Sam are in a match with no B in it. One game with the B's a"
      + " night is the whole allowance, and Ade and Sam have not had theirs.",
    );
    expect(words).not.toContain("still to come");
  });

  it("says the game is behind them only when it is behind all four", () => {
    expect(mixingWords({
      kind: "pure",
      aPlayers: ["Benson", "Timi", "Ade", "Sam"].map((name) => ({ name, bGames: 1 })),
      heldBack: [],
    })).toBe(
      "Benson, Timi, Ade and Sam have had their game with the B's already. One game a night"
      + " is the whole allowance, so this one is among the A's.",
    );
    expect(mixingWords({
      kind: "pure", aPlayers: [{ name: "Benson", bGames: 2 }], heldBack: [],
    })).toBe(
      "Benson has had their game with the B's already. One game a night is the whole"
      + " allowance, so this one is among the A's.",
    );
  });

  it("names the one game when these A's are having it", () => {
    expect(mixingWords({
      kind: "firstBGame",
      aPlayers: [{ name: "Benson", bGames: 0 }, { name: "Timi", bGames: 0 }],
      heldBack: [],
    })).toBe("Benson and Timi are having their one game with the B's.");
    expect(mixingWords({
      kind: "firstBGame", aPlayers: [{ name: "Benson", bGames: 0 }], heldBack: [],
    })).toBe("Benson is having their one game with the B's.");
  });

  it("counts the repeat rather than calling every repeat a second", () => {
    expect(mixingWords({
      kind: "secondBGame",
      aPlayers: [{ name: "Benson", bGames: 0 }, { name: "Timi", bGames: 1 }],
      heldBack: [],
    })).toBe(
      "Benson and Timi are in with the B's. Timi meets them for the second time."
      + " One game with the B's a night is the allowance, and this four is past it.",
    );
    // A third, which the old wording called a second.
    expect(mixingWords({
      kind: "secondBGame",
      aPlayers: [{ name: "Benson", bGames: 0 }, { name: "Timi", bGames: 2 }],
      heldBack: [],
    })).toContain("Timi meets them for the third time.");
    // Two charged A's on the same count, and on different ones.
    expect(mixingWords({
      kind: "secondBGame",
      aPlayers: [{ name: "Benson", bGames: 1 }, { name: "Timi", bGames: 1 }],
      heldBack: [],
    })).toContain("Benson and Timi meet them for the second time.");
    expect(mixingWords({
      kind: "secondBGame",
      aPlayers: [{ name: "Benson", bGames: 1 }, { name: "Timi", bGames: 2 }],
      heldBack: [],
    })).toContain("Benson meets them for the second time, Timi for the third.");
  });

  it("speaks of one A in the singular, and claims no spreading on a lone-A court", () => {
    const words = mixingWords({
      kind: "secondBGame", aPlayers: [{ name: "Benson", bGames: 1 }], heldBack: [],
    });
    expect(words).toBe(
      "Benson is in with the B's. Benson meets them for the second time. One game with the"
      + " B's a night is the allowance, and this four is past it.",
    );
    expect(words).not.toContain("are in with");
    expect(words).not.toContain("one of them");
    expect(words).not.toContain("spread rather than stacked");
  });

  it("reads a real draw: the first four out on an A and B court are having their game", () => {
    const players = roster(4, 4);
    const first = nextMatch(players, [], 1, 4)!;
    expect(first.reason.mixing.kind).toBe("firstBGame");
    expect(mixingWords(first.reason.mixing)).toContain("having their one game with the B's");
  });

  it("reads a real draw: one A on a court of B's meets them a third time, and is told so", () => {
    // One A and three B's at four each. The A has nobody to hand the seats
    // to, so every game is theirs and the card counts them up.
    const third = frameElevenAt(roster(1, 3), 4, (r) =>
      r.mixing.aPlayers.some((a) => a.bGames === 2));
    expect(third).not.toBeNull();
    expect(mixingWords(third!.mixing)).toBe(
      "A1 is in with the B's. A1 meets them for the third time. One game with the B's a"
      + " night is the allowance, and this four is past it.",
    );
  });
});

describe("the roster footer reads the court", () => {
  it("keeps the old promise while the counts keep it", () => {
    expect(roundRobinCounts(0)).toBe("Counts never drift more than one game apart.");
    expect(roundRobinCounts(1)).toBe("Counts never drift more than one game apart.");
  });

  it("says the gap and names no cause for it", () => {
    // The cap can cost exactly one game, so a court three apart is a walk-in
    // or a leaver rather than the rule, and a court two apart can simply be
    // three games into a fresh deal. One number cannot tell them apart, so
    // the sentence stops at the number.
    expect(roundRobinCounts(2)).toBe("Counts are two games apart right now.");
    expect(roundRobinCounts(3)).toBe("Counts are three games apart right now.");
    expect(roundRobinCounts(4)).not.toContain("one game with the B's");
    expect(roundRobinCounts(4)).not.toContain("hold a player back");
  });

  it("takes its number from the same place frame 11 takes its promise", () => {
    // One game played by four of the eight, so the court sits a game apart
    // and the promise still holds.
    const players: Player[] = ["a", "b", "c", "d", "e", "f", "g", "h"].map((id) => ({
      id, name: id.toUpperCase(), walkIn: false, courtNumber: 1, away: false,
      joinedAtMatchIndex: null,
    }));
    const one: Match[] = [{
      id: "m1", courtNumber: 1, matchIndex: 1, teamA: ["a", "b"], teamB: ["c", "d"],
      scoreA: 2, scoreB: 0, status: "played", startedAt: 0, completedAt: 0, stage: null,
    }];
    expect(courtSpread(players, one, 1)).toBe(1);
    expect(roundRobinCounts(courtSpread(players, one, 1)))
      .toBe("Counts never drift more than one game apart.");
    expect(courtSpread(players, [], 1)).toBe(0);
  });
});
