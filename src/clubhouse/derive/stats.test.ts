import { describe, expect, it } from "vitest";
import {
  detectRivalries,
  isoWeekKey,
  milestoneClubName,
  milestoneStatus,
  playerTotals,
  topN,
  weeklyStreaks,
} from "./stats";
import { buildPublishBundle } from "../publish/transform";
import type { PublishSessionInput } from "../publish/types";

const POINTS = { "Champion of the Week": 100 };

function session(id: string, date: string, winner: "pairA" | "pairB", games = 1): PublishSessionInput {
  return {
    sessionId: id,
    date,
    venue: "District Padel Club",
    players: [
      { id: "p1", name: "Benson", tier: "A" },
      { id: "p2", name: "Duke", tier: "A" },
      { id: "p3", name: "Maya", tier: "B" },
      { id: "p4", name: "Sam", tier: "B" },
    ],
    pairs: [
      { id: "pairA", playerIds: ["p1", "p2"], tier: "A" },
      { id: "pairB", playerIds: ["p3", "p4"], tier: "B" },
    ],
    results: Array.from({ length: games }, (_, i) => ({
      gameId: `${id}-g${i}`,
      winnerPairId: winner,
      loserPairId: winner === "pairA" ? "pairB" : "pairA",
      completedAt: i,
    })),
    champions: winner === "pairA" ? [{ title: "Champion of the Week", pairId: "pairA" }] : [],
  };
}

describe("milestones", () => {
  it("tracks earned clubs and distance to the next", () => {
    expect(milestoneStatus(0)).toEqual({ earned: [], next: 10, toNext: 10 });
    expect(milestoneStatus(23)).toEqual({ earned: [10], next: 25, toNext: 2 });
    expect(milestoneStatus(100)).toEqual({ earned: [10, 25, 50, 100], next: null, toNext: null });
    expect(milestoneClubName(50)).toBe("The 50 Club");
  });
});

describe("weekly streaks", () => {
  it("computes ISO week keys", () => {
    expect(isoWeekKey("2026-08-05")).toBe(isoWeekKey("2026-08-09")); // Wed + Sun, same week
    expect(isoWeekKey("2026-08-05")).not.toBe(isoWeekKey("2026-08-10")); // next Monday
  });

  it("counts consecutive attended weeks, twice-a-week counts once", () => {
    const dates = ["2026-07-22", "2026-07-26", "2026-07-29", "2026-08-05"];
    expect(weeklyStreaks(dates)).toEqual({ current: 3, best: 3 });
  });

  it("a missed week resets current but keeps best", () => {
    const dates = ["2026-06-03", "2026-06-10", "2026-06-17", "2026-07-08"];
    expect(weeklyStreaks(dates)).toEqual({ current: 1, best: 3 });
  });

  it("handles empty history", () => {
    expect(weeklyStreaks([])).toEqual({ current: 0, best: 0 });
  });
});

describe("rivalries and totals", () => {
  const bundles = [
    buildPublishBundle(session("s1", "2026-07-22", "pairA"), { pointsConfig: POINTS }),
    buildPublishBundle(session("s2", "2026-07-29", "pairB"), { pointsConfig: POINTS }),
    buildPublishBundle(session("s3", "2026-08-05", "pairA"), { pointsConfig: POINTS }),
  ];

  it("detects a series after three meetings with correct head-to-head", () => {
    const rivalries = detectRivalries(bundles);
    const benVsMaya = rivalries.find((r) => r.playerA === "p1" && r.playerB === "p3");
    expect(benVsMaya).toEqual({ playerA: "p1", playerB: "p3", meetings: 3, winsA: 2, winsB: 1 });
  });

  it("computes totals, win streaks, and sessions", () => {
    const totals = playerTotals(bundles);
    const benson = totals.get("p1")!;
    expect(benson.sessions).toBe(3);
    expect(benson.games).toBe(3);
    expect(benson.wins).toBe(2);
    expect(benson.longestWinStreak).toBe(1); // won s1, lost s2, won s3
    expect(benson.ptoPoints).toBe(200); // two Champion of the Week titles

    const maya = totals.get("p3")!;
    expect(maya.wins).toBe(1);
    expect(maya.losses).toBe(2);
  });

  it("topN never returns more than the cap (the only ranked view allowed)", () => {
    const totals = [...playerTotals(bundles).values()];
    expect(topN(totals, (t) => t.wins, 2)).toHaveLength(2);
  });

  it("ignores practice sessions for results but counts attendance", () => {
    const practice = buildPublishBundle(
      { ...session("s4", "2026-08-09", "pairA"), isPractice: true },
      { pointsConfig: POINTS }
    );
    const totals = playerTotals([...bundles, practice]);
    expect(totals.get("p1")!.sessions).toBe(4);
    expect(totals.get("p1")!.games).toBe(3);
  });
});
