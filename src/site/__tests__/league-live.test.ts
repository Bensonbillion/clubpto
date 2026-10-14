// The live league table: name tidying, table order and the next matchday.
import { describe, expect, it } from "vitest";
import { displayName, hasResults, leaders, nextMatchday, sortTable, type StandingRow } from "@/site/leagueLive";

const row = (over: Partial<StandingRow>): StandingRow => ({
  rank: 1,
  playerId: "M01",
  player: "Someone",
  division: "M1",
  matches: 0,
  wins: 0,
  losses: 0,
  winPct: null,
  pointsFor: 0,
  pointsAgainst: 0,
  diff: 0,
  leaguePoints: 0,
  ...over,
});

describe("league live", () => {
  it("adds the missing full stop to a last initial and leaves the rest", () => {
    expect(displayName("David G")).toBe("David G.");
    expect(displayName("Benson E.")).toBe("Benson E.");
    expect(displayName("Saga")).toBe("Saga");
    expect(displayName("  Evelyn   A ")).toBe("Evelyn A.");
  });

  it("orders by points, then point difference, then wins, then name", () => {
    const t = sortTable([
      row({ playerId: "a", player: "Zed", leaguePoints: 6, diff: 2, wins: 2 }),
      row({ playerId: "b", player: "Amy", leaguePoints: 6, diff: 5, wins: 2 }),
      row({ playerId: "c", player: "Bo", leaguePoints: 9, diff: -1, wins: 3 }),
      row({ playerId: "d", player: "Cy", leaguePoints: 0 }),
      row({ playerId: "e", player: "Ann", leaguePoints: 0 }),
    ]);
    expect(t.map((r) => r.playerId)).toEqual(["c", "b", "a", "e", "d"]);
  });

  it("knows when no scores are in, and names no leaders then", () => {
    const rows = [row({}), row({ playerId: "M02" })];
    expect(hasResults(rows)).toBe(false);
    expect(leaders(rows)).toEqual([]);
    const played = [row({ matches: 2, wins: 2, leaguePoints: 6, player: "Omar" })];
    expect(hasResults(played)).toBe(true);
    expect(leaders(played)[0]).toMatchObject({ player: "Omar", value: "6 pts" });
  });

  it("picks the next unplayed matchday from today", () => {
    const days = [
      { id: "S01", week: 1, date: "2026-10-11", status: "Played" },
      { id: "S02", week: 2, date: "2026-10-18", status: "Scheduled" },
      { id: "S03", week: 3, date: "2026-10-25", status: "Scheduled" },
    ];
    expect(nextMatchday(days, "2026-10-14")?.id).toBe("S02");
    expect(nextMatchday(days, "2026-10-18")?.id).toBe("S02");
    expect(nextMatchday(days, "2026-10-19")?.id).toBe("S03");
    expect(nextMatchday(days, "2026-11-01")).toBeUndefined();
  });
});

describe("division names and the manual Week 1 table", async () => {
  const { DIVISIONS, MANUAL_STANDINGS, mergeManual, manualAsOf, byDivision, divisionHasResults } = await import(
    "@/site/leagueLive"
  );

  it("names the three divisions Atlas, Riviera and Venus", () => {
    expect(DIVISIONS.map((d) => d.label)).toEqual(["Atlas Division", "Riviera Division", "Venus Division"]);
  });

  it("stands Benson's Atlas table in while the Sheet has no Atlas scores, in his order", () => {
    const sheet = [row({ playerId: "M01", player: "David G" }), row({ playerId: "M07", player: "Omar", division: "M2" })];
    const merged = mergeManual(sheet);
    expect(byDivision(merged, "M1").map((r) => r.player)).toEqual([
      "David G",
      "Folarin A.",
      "Tami O.",
      "Lewis",
      "Benson E.",
      "Edgar A.",
    ]);
    expect(divisionHasResults(merged, "M1")).toBe(true);
    expect(divisionHasResults(merged, "M2")).toBe(false);
    expect(manualAsOf(sheet, "M1")).toBe("After Week 1");
  });

  it("lets the Sheet win as soon as Atlas has scores there", () => {
    const sheet = [row({ playerId: "M01", player: "David G", matches: 7, wins: 7, leaguePoints: 21 })];
    expect(byDivision(mergeManual(sheet), "M1")).toHaveLength(1);
    expect(manualAsOf(sheet, "M1")).toBeNull();
    expect(MANUAL_STANDINGS.M1.rows).toHaveLength(6);
  });
});
