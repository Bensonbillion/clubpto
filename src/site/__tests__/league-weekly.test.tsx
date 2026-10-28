// @vitest-environment jsdom
// Benson, Oct 28 2026: "make the ranking also show on a weekly basis as we
// may want to post them individually on social but show it from the
// website ... where each week you can click into it and show the ranking".
//
// Rules: a week's table has only that Sunday's games. A player is in the
// division they played that day (Kalid played Riviera in Weeks 1 and 2 and
// moved to Atlas for Week 3). A blank seat still counts for nobody. Each
// week has its own address (/league?week=3) so it can be linked from a post.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import {
  byDivision,
  computeStandings,
  weeklyStandings,
  weeksWithTables,
  type LeagueSnapshot,
  type SheetMatch,
  type SheetPlayer,
} from "@/site/leagueLive";

const players: SheetPlayer[] = [
  { id: "M01", name: "David G", division: "M1", status: "Active" },
  { id: "M02", name: "Benson E.", division: "M1", status: "Active" },
  { id: "M03", name: "Edgar A.", division: "M1", status: "Active" },
  { id: "M09", name: "Kalid", division: "M1", status: "Active" }, // moved from Riviera on Oct 25
  { id: "M07", name: "Omar", division: "M2", status: "Active" },
  { id: "M10", name: "Ben", division: "M2", status: "Active" },
  { id: "M12", name: "Idris", division: "M2", status: "Active" },
];

const m = (sessionId: string, division: string, a: [string, string], sa: number, sb: number, b: [string, string]): SheetMatch => ({
  sessionId,
  division,
  round: 1,
  court: "",
  teamA: a,
  teamB: b,
  scoreA: sa,
  scoreB: sb,
});

const matches: SheetMatch[] = [
  // Week 1: Atlas and Riviera
  m("S01", "M1", ["David G", "Benson E."], 2, 0, ["Edgar A.", ""]),
  m("S01", "M2", ["Kalid", "Omar"], 2, 1, ["Ben", "Idris"]),
  // Week 2: Riviera only
  m("S02", "M2", ["Ben", "Idris"], 3, 0, ["Kalid", "Omar"]),
  // Week 3: Kalid in Atlas now
  m("S03", "M1", ["Kalid", "Edgar A."], 2, 0, ["David G", "Benson E."]),
];

const days = [
  { id: "S01", week: 1, date: "2026-10-11", status: "Played" },
  { id: "S02", week: 2, date: "2026-10-18", status: "Played" },
  { id: "S03", week: 3, date: "2026-10-25", status: "Played" },
  { id: "S04", week: 4, date: "2026-11-01", status: "Scheduled" },
];

describe("weekly tables", () => {
  const weeks = weeklyStandings(players, matches);

  it("has one table per Sunday, from that Sunday's games only", () => {
    expect(Object.keys(weeks).sort()).toEqual(["S01", "S02", "S03"]);
    const w3 = byDivision(weeks.S03, "M1");
    expect(w3.map((r) => [r.player, r.wins, r.losses, r.leaguePoints, r.diff])).toEqual([
      ["Edgar A.", 1, 0, 3, 2],
      ["Kalid", 1, 0, 3, 2],
      ["Benson E.", 0, 1, 0, -2],
      ["David G", 0, 1, 0, -2],
    ]);
  });

  it("puts a player in the division they played that week", () => {
    expect(weeks.S01.find((r) => r.player === "Kalid")?.division).toBe("M2");
    expect(weeks.S02.find((r) => r.player === "Kalid")?.division).toBe("M2");
    expect(weeks.S03.find((r) => r.player === "Kalid")?.division).toBe("M1");
    // The season table still follows the Players tab.
    expect(computeStandings(players, matches).find((r) => r.player === "Kalid")?.division).toBe("M1");
  });

  it("leaves out anyone who didn't play that week, and a blank seat counts for nobody", () => {
    expect(weeks.S02.map((r) => r.player).sort()).toEqual(["Ben", "Idris", "Kalid", "Omar"]);
    expect(weeks.S02.some((r) => r.division === "M1")).toBe(false);
    const edgar = weeks.S01.find((r) => r.player === "Edgar A.");
    expect(edgar).toMatchObject({ matches: 1, losses: 1, pointsFor: 0, pointsAgainst: 2 });
    expect(weeks.S01.filter((r) => r.division === "M1")).toHaveLength(3);
  });

  it("lists only the weeks that have a table, in week order", () => {
    const snap: LeagueSnapshot = { standings: [], matchdays: [days[2], days[0], days[3], days[1]], weeks };
    expect(weeksWithTables(snap).map((d) => d.week)).toEqual([1, 2, 3]);
    expect(weeksWithTables({ standings: [], matchdays: days })).toEqual([]);
  });
});

// The League page's table, with a copy of the league already in this browser
// so nothing is fetched.
const Where = () => {
  const { search } = useLocation();
  return <output data-testid="search">{search}</output>;
};

const page = async (path: string) => {
  const { Standings } = await import("@/site/ui/LeagueLive");
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/league"
          element={
            <>
              <Standings />
              <Where />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
};

describe("the League page table, by week", () => {
  beforeEach(async () => {
    vi.resetModules();
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const live = await import("@/site/leagueLive");
    const data: LeagueSnapshot = {
      standings: live.computeStandings(players, matches),
      matchdays: days,
      weeks: live.weeklyStandings(players, matches),
    };
    localStorage.setItem("pto-league-live-v4", JSON.stringify({ at: Date.now(), data }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const names = () =>
    within(screen.getByRole("table"))
      .getAllByRole("row")
      .slice(1)
      .map((r) => r.querySelector(".s-name")?.textContent);

  it("opens on the season, with a button for every played week", async () => {
    await page("/league");
    expect(screen.getByRole("heading", { name: "The table" })).toBeTruthy();
    const tabs = within(screen.getByRole("tablist", { name: "Season or one week" })).getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual(["Season", "Week 1", "Week 2", "Week 3"]);
  });

  it("shows only that week's games when a week is picked, and puts the week in the address", async () => {
    await page("/league");
    fireEvent.click(screen.getByRole("tab", { name: "Week 3" }));
    expect(screen.getByRole("heading", { name: "Week 3 table" })).toBeTruthy();
    expect(names()).toEqual(["Edgar A.", "Kalid", "Benson E.", "David G."]);
    expect(screen.getByTestId("search").textContent).toBe("?week=3");
    expect(screen.getByText(/Week 3 only/)).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Season" }));
    expect(screen.getByRole("heading", { name: "The table" })).toBeTruthy();
    expect(screen.getByTestId("search").textContent).toBe("");
  });

  it("opens straight on a week from its link", async () => {
    await page("/league?week=1");
    expect(screen.getByRole("heading", { name: "Week 1 table" })).toBeTruthy();
    expect(names()).toEqual(["Benson E.", "David G.", "Edgar A."]);
  });

  it("opens a week from its played matchday card", async () => {
    await page("/league");
    fireEvent.click(screen.getByRole("button", { name: "Week 2 table" }));
    expect(screen.getByRole("heading", { name: "Week 2 table" })).toBeTruthy();
    // Week 2 had no Atlas games, so the card opens on Riviera.
    expect(names()).toEqual(["Ben", "Idris", "Kalid", "Omar"]);
  });

  it("ignores a week that has no table", async () => {
    await page("/league?week=4");
    expect(screen.getByRole("heading", { name: "The table" })).toBeTruthy();
  });
});
