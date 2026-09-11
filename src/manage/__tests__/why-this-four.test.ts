// Frame 11's sentences, and the roster footer's one.
//
// Both are copy the operator reads out to a player who asked why they are
// sitting, so both are tested as strings rather than through a render. The
// rule at issue is the third law (2026-09-10): an A plays one game with the
// B's a night and never a second, which is allowed to hold a least-played
// player back a game. That makes two sentences that used to be flat true
// conditional, and a screen that keeps saying them is the bug.

import { describe, expect, it } from "vitest";
import type { Match, Player } from "../types";
import type { MatchReason } from "../engine/rotation";
import { courtSpread, nextMatch } from "../engine/rotation";
import { leastPlayedWords, mixingWords } from "../screens/play/model";
import { roundRobinCounts } from "../screens/people/model";

const reasonOf = (over: Partial<MatchReason> = {}): MatchReason => ({
  leastPlayed: ["Benson", "Timi", "Ade", "Sam"].map((name, i) => ({
    playerId: `p${i}`, name, matchesPlayed: 1,
  })),
  courtSpread: 0,
  withinOneGame: true,
  balance: { kind: "noAssessedC", cPlayers: [], swap: null },
  mixing: { kind: "noAs", aNames: [], heldBack: [] },
  ...over,
});

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
      mixing: { kind: "pure", aNames: ["Benson", "Timi", "Ade", "Sam"], heldBack: [{ name: "Ese" }] },
    });
    expect(leastPlayedWords(held)).toBe(
      "Benson, Timi, Ade and Sam are on. Ese had played fewer, but putting them on would"
      + " have cost an A a second game with the B's, so they wait a round.",
    );
    expect(leastPlayedWords(held)).not.toContain("had played the fewest games");
  });
});

describe("the fourth card, one game with the B's", () => {
  it("is absent when there is no A in the match", () => {
    expect(mixingWords({ kind: "noAs", aNames: [], heldBack: [] })).toBeNull();
  });

  it("states the allowance for a match with no B, and claims nothing about their night", () => {
    // "pure" knows the four holds no B. It does NOT know whether these A's
    // have already had their one game, so the card does not say they have.
    const words = mixingWords({
      kind: "pure", aNames: ["Benson", "Timi", "Ade", "Sam"], heldBack: [],
    });
    expect(words).toBe(
      "Benson, Timi, Ade and Sam are in a match with no B in it. One game with the B's a"
      + " night is the whole allowance, so the rest of an A's night is played among the A's.",
    );
    expect(words).not.toContain("have had their game");
  });

  it("names the one game when these A's are having it", () => {
    expect(mixingWords({ kind: "firstBGame", aNames: ["Benson", "Timi"], heldBack: [] })).toBe(
      "Benson and Timi are having their one game with the B's.",
    );
    expect(mixingWords({ kind: "firstBGame", aNames: ["Benson"], heldBack: [] })).toBe(
      "Benson is having their one game with the B's.",
    );
  });

  it("says the numbers plainly when the law bends", () => {
    expect(mixingWords({ kind: "secondBGame", aNames: ["Benson", "Timi"], heldBack: [] })).toBe(
      "Benson and Timi are in with the B's, and for one of them it is a second game."
      + " The numbers leave more seats across the net than the A's can fill once each,"
      + " so the second games are spread rather than stacked on one A.",
    );
  });

  it("reads a real draw: the first four out on an A and B court are having their game", () => {
    const players: Player[] = ["a1", "a2", "a3", "a4", "b1", "b2", "b3", "b4"].map((id) => ({
      id, name: id.toUpperCase(), walkIn: false, courtNumber: 1, away: false,
      joinedAtMatchIndex: null, tier: id.startsWith("a") ? ("A" as const) : ("B" as const),
    }));
    const first = nextMatch(players, [], 1, 4)!;
    expect(first.reason.mixing.kind).toBe("firstBGame");
    expect(mixingWords(first.reason.mixing)).toContain("having their one game with the B's");
  });
});

describe("the roster footer reads the court", () => {
  it("keeps the old promise while the counts keep it", () => {
    expect(roundRobinCounts(0)).toBe("Counts never drift more than one game apart.");
    expect(roundRobinCounts(1)).toBe("Counts never drift more than one game apart.");
  });

  it("says the gap instead, once the cap has opened one", () => {
    expect(roundRobinCounts(2)).toBe(
      "Counts are two games apart right now. The one game with the B's can hold a player back.",
    );
    expect(roundRobinCounts(3)).toContain("three games apart");
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
