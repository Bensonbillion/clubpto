// The site works the league table out from the Sheet's Matches tab. This
// replays Week 1 exactly as the Sheet had it on 2026-10-14 (from
// `type=players` and `type=matches`) and expects the same table the Sheet's
// own Standings tab showed that day, division by division.
//
// The bug this guards: the site used to read `type=standings`, which still
// mapped the Standings tab's old columns after the Sheet was rebuilt, so
// every row came back with a number where the division should be and the
// site filtered all three divisions out.
import { afterEach, describe, expect, it, vi } from "vitest";
import { DIVISIONS, byDivision, computeStandings, loadLeague, type SheetMatch, type SheetPlayer } from "@/site/leagueLive";

const players: SheetPlayer[] = [
  ["M01", "David G", "M1"],
  ["M02", "Benson E.", "M1"],
  ["M03", "Edgar A.", "M1"],
  ["M04", "Saga", "M1"],
  ["M05", "Folarin A.", "M1"],
  ["M06", "Tami O.", "M1"],
  ["M07", "Omar", "M2"],
  ["M08", "Lewis", "M1"],
  ["M09", "Kalid", "M2"],
  ["M10", "Ben", "M2"],
  ["M11", "Taiwo", "M2"],
  ["M12", "Idris", "M2"],
  ["M13", "Demi", "M2"],
  ["M14", "Dami", "M2"],
  ["M15", "Kola", "M2"],
  ["M16", "Layi", "M2"],
  ["W01", "Evelyn A", "W"],
  ["W02", "Albright G", "W"],
  ["W03", "Paola I", "W"],
  ["W04", "Onome", "W"],
  ["W05", "Samia", "W"],
  ["M17", "Manny", "M2"],
].map(([id, name, division]) => ({ id, name, division, status: "Active" }));

const m = (division: string, round: number, a: [string, string], sa: number, sb: number, b: [string, string]): SheetMatch => ({
  sessionId: "S01",
  division,
  round,
  court: "",
  teamA: a,
  teamB: b,
  scoreA: sa,
  scoreB: sb,
});

const week1: SheetMatch[] = [
  m("M2", 1, ["Omar", "Ben"], 1, 2, ["Idris", "Demi"]),
  m("M2", 2, ["Ben", "Idris"], 2, 1, ["Kalid", "Taiwo"]),
  m("M2", 3, ["Omar", "Demi"], 0, 2, ["Taiwo", "Idris"]),
  m("M2", 4, ["Kalid", "Ben"], 0, 2, ["Idris", "Omar"]),
  m("M2", 5, ["Demi", "Taiwo"], 0, 2, ["Omar", "Kalid"]),
  m("M2", 6, ["Ben", "Demi"], 0, 2, ["Kalid", "Idris"]),
  m("M2", 7, ["Taiwo", "Omar"], 2, 1, ["Demi", "Kalid"]),
  m("W", 1, ["Evelyn A", "Albright G"], 4, 0, ["Onome", "Samia"]),
  m("W", 2, ["Evelyn A", "Onome"], 4, 0, ["Albright G", "Samia"]),
  m("W", 3, ["Evelyn A", "Samia"], 3, 4, ["Albright G", "Onome"]),
  // Atlas. Benson and David each played a sixth game; Benson asked for it
  // to count as five each (Benson 2-3, David 5-0), so the Sheet has their
  // spot blank in round 6 (Benson's loss) and round 8 (David's win).
  m("M1", 1, ["Benson E.", "David G"], 2, 0, ["Edgar A.", "Lewis"]),
  m("M1", 2, ["Folarin A.", "Tami O."], 2, 0, ["Benson E.", "Lewis"]),
  m("M1", 3, ["Benson E.", "Folarin A."], 0, 2, ["David G", "Edgar A."]),
  m("M1", 4, ["Lewis", "Tami O."], 0, 2, ["David G", "Folarin A."]),
  m("M1", 5, ["David G", "Tami O."], 2, 0, ["Benson E.", "Edgar A."]),
  m("M1", 6, ["Folarin A.", "Lewis"], 2, 1, ["", "Tami O."]),
  m("M1", 7, ["Edgar A.", "Tami O."], 1, 2, ["David G", "Lewis"]),
  m("M1", 8, ["Benson E.", ""], 2, 1, ["Edgar A.", "Folarin A."]),
];

/** "Name P W-L +/- Pts", the columns the site shows. */
const line = (r: { player: string; matches: number; wins: number; losses: number; diff: number; leaguePoints: number }) =>
  `${r.player} ${r.matches} ${r.wins}-${r.losses} ${r.diff > 0 ? "+" : ""}${r.diff} ${r.leaguePoints}`;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("league table from the Matches tab", () => {
  const rows = computeStandings(players, week1, 3, 0);

  it("matches the Sheet's Atlas table: five games each, Benson 2-3, David 5-0", () => {
    expect(byDivision(rows, "M1").map(line)).toEqual([
      "David G 5 5-0 +9 15",
      "Folarin A. 5 3-2 +2 9",
      "Tami O. 5 2-3 0 6",
      "Benson E. 5 2-3 -3 6",
      "Lewis 5 2-3 -4 6",
      "Edgar A. 5 1-4 -4 3",
      "Saga 0 0-0 0 0",
    ]);
  });

  it("matches the Sheet's Riviera table, breaking 6-point ties on points for", () => {
    expect(byDivision(rows, "M2").map(line)).toEqual([
      "Idris 5 5-0 +8 15",
      "Omar 5 3-2 +2 9",
      "Kalid 5 2-3 0 6",
      "Taiwo 4 2-2 0 6",
      "Ben 4 1-3 -4 3",
      "Demi 5 1-4 -6 3",
      "Dami 0 0-0 0 0",
      "Kola 0 0-0 0 0",
      "Layi 0 0-0 0 0",
      "Manny 0 0-0 0 0",
    ]);
  });

  it("matches the Sheet's Venus table, with Albright and Onome sharing second", () => {
    const venus = byDivision(rows, "W");
    expect(venus.map(line)).toEqual([
      "Evelyn A 3 2-1 +7 6",
      "Albright G 3 2-1 +1 6",
      "Onome 3 2-1 +1 6",
      "Paola I 0 0-0 0 0",
      "Samia 3 0-3 -9 0",
    ]);
    expect(venus.map((r) => r.rank)).toEqual([1, 2, 2, 4, 5]);
  });

  it("credits a blank spot to nobody, and skips unscored or tied rows", () => {
    const extra = [
      ...week1,
      { ...m("M1", 9, ["Benson E.", "David G"], 0, 0, ["Edgar A.", "Lewis"]), scoreA: null, scoreB: null },
      m("M1", 10, ["Benson E.", "David G"], 2, 2, ["Edgar A.", "Lewis"]),
      m("M1", 11, ["", ""], 2, 0, ["", ""]),
    ];
    const again = byDivision(computeStandings(players, extra), "M1");
    expect(again.map(line)).toEqual(byDivision(rows, "M1").map(line));
    expect(again.every((r) => r.matches <= 5)).toBe(true);
  });

  it("uses the Sheet's points per win and per loss", () => {
    const one = computeStandings(players, week1, 2, 1);
    const david = one.find((r) => r.player === "David G");
    const benson = one.find((r) => r.player === "Benson E.");
    expect(david?.leaguePoints).toBe(10);
    expect(benson?.leaguePoints).toBe(7);
  });

  it("loads all three divisions from the web app, even with type=standings out of date", async () => {
    // What the web app answered on 2026-10-14. Standings is the broken one:
    // a name in playerId, "1" in player, "5" in division.
    const answers: Record<string, unknown> = {
      players,
      matches: week1,
      sessions: [
        { id: "S01", week: 1, date: "2026-10-11", status: "Played" },
        { id: "S02", week: 2, date: "2026-10-18", status: "Scheduled" },
      ],
      config: { pointsPerWin: 3, pointsPerLoss: 0 },
      standings: [{ rank: 1, playerId: "David G", player: "1", division: "5", matches: 1, wins: 10, leaguePoints: 0 }],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const type = new URL(url).searchParams.get("type") || "";
        return new Response(JSON.stringify({ ok: true, data: answers[type] }));
      }),
    );
    const snap = await loadLeague();
    for (const d of DIVISIONS) {
      expect(byDivision(snap.standings, d.code).filter((r) => r.matches > 0).length, d.label).toBeGreaterThan(0);
    }
    expect(byDivision(snap.standings, "M1")[0]).toMatchObject({ player: "David G", wins: 5, losses: 0, leaguePoints: 15 });
  });

  it("matches names however the Sheet spaces or cases them", () => {
    const messy = [m("M1", 1, [" david g ", "BENSON  E."], 2, 0, ["Edgar A.", "Lewis"])];
    const t = computeStandings(players, messy);
    expect(t.find((r) => r.playerId === "M01")?.wins).toBe(1);
    expect(t.find((r) => r.playerId === "M02")?.wins).toBe(1);
  });
});
