import { describe, expect, it } from "vitest";
import type { MatchRow } from "@/league/adminApi";
import { MAX_GAMES, gamesPlayed } from "@/league/gamesPlayed";

const m = (round: number, a: [string, string], sa: number, sb: number, b: [string, string], division = "M1"): MatchRow => ({
  sessionId: "S01",
  division,
  round,
  court: "",
  teamA: a,
  teamB: b,
  scoreA: sa,
  scoreB: sb,
});

// Atlas, Week 1, as it is in the Sheet: Benson's spot is blank in round 6
// and David's in round 8, so everyone lands on five.
const atlasWeek1: MatchRow[] = [
  m(1, ["Benson E.", "David G"], 2, 0, ["Edgar A.", "Lewis"]),
  m(2, ["Folarin A.", "Tami O."], 2, 0, ["Benson E.", "Lewis"]),
  m(3, ["Benson E.", "Folarin A."], 0, 2, ["David G", "Edgar A."]),
  m(4, ["Lewis", "Tami O."], 0, 2, ["David G", "Folarin A."]),
  m(5, ["David G", "Tami O."], 2, 0, ["Benson E.", "Edgar A."]),
  m(6, ["Folarin A.", "Lewis"], 2, 1, ["", "Tami O."]),
  m(7, ["Edgar A.", "Tami O."], 1, 2, ["David G", "Lewis"]),
  m(8, ["Benson E.", ""], 2, 1, ["Edgar A.", "Folarin A."]),
];

describe("gamesPlayed", () => {
  it("puts every Atlas player on five games, and never counts a blank spot", () => {
    const played = gamesPlayed(atlasWeek1, "M1");
    expect(played).toEqual({
      "Benson E.": MAX_GAMES,
      "David G": MAX_GAMES,
      "Edgar A.": MAX_GAMES,
      "Folarin A.": MAX_GAMES,
      "Tami O.": MAX_GAMES,
      Lewis: MAX_GAMES,
    });
    expect(played[""]).toBeUndefined();
  });

  it("only counts the division asked for, and only scored matches", () => {
    const rows = [...atlasWeek1, m(1, ["Omar", "Ben"], 1, 2, ["Idris", "Demi"], "M2"), { ...m(9, ["Lewis", "Tami O."], 0, 0, ["Benson E.", "Edgar A."]), scoreA: null, scoreB: null }];
    const played = gamesPlayed(rows, "M1");
    expect(played.Omar).toBeUndefined();
    expect(played.Lewis).toBe(5);
  });
});
