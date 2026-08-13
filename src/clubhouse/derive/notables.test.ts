import { describe, expect, it } from "vitest";
import { notableLines } from "./notables";
import type { PublishBundle } from "../publish/types";

// Minimal bundle builder for story-beat tests.
function bundle(overrides: Partial<PublishBundle> & { sessionId: string; date: string }): PublishBundle {
  return {
    session: {
      sessionId: overrides.sessionId,
      date: overrides.date,
      venue: "District Padel Club",
      attendanceCount: 4,
    },
    players: [],
    pairs: [],
    results: [],
    champions: [],
    finalists: [],
    practiceOnly: false,
    ...overrides,
  };
}

const pairAB = { pairId: "p1", players: [{ id: "a", displayName: "Ada" }, { id: "b", displayName: "Ben" }] as [any, any] };
const pairCD = { pairId: "p2", players: [{ id: "c", displayName: "Cy" }, { id: "d", displayName: "Dee" }] as [any, any] };

describe("notable lines (REC-2)", () => {
  it("celebrates a first career title", () => {
    const s = bundle({
      sessionId: "s1",
      date: "2026-08-05",
      pairs: [pairAB, pairCD],
      champions: [{ title: "Champion of the Week", points: 100, pair: pairAB }],
    });
    const lines = notableLines(s, []);
    expect(lines.some((l) => l.kind === "first-title" && l.text.includes("Ada"))).toBe(true);
    expect(lines.some((l) => l.text.includes("Ben"))).toBe(true);
  });

  it("does not repeat first-title for repeat champions", () => {
    const earlier = bundle({
      sessionId: "s1",
      date: "2026-08-01",
      pairs: [pairAB],
      champions: [{ title: "Champion of the Week", points: 100, pair: pairAB }],
    });
    const again = bundle({
      sessionId: "s2",
      date: "2026-08-05",
      pairs: [pairAB],
      champions: [{ title: "Champion of the Week", points: 100, pair: pairAB }],
    });
    expect(notableLines(again, [earlier]).filter((l) => l.kind === "first-title")).toHaveLength(0);
  });

  it("spots an undefeated night (2+ games, all wins)", () => {
    const s = bundle({
      sessionId: "s1",
      date: "2026-08-05",
      pairs: [pairAB, pairCD],
      results: [
        { gameId: "g1", winnerPairId: "p1", loserPairId: "p2", completedAt: 1 },
        { gameId: "g2", winnerPairId: "p1", loserPairId: "p2", completedAt: 2 },
      ],
    });
    const lines = notableLines(s, []);
    expect(lines.some((l) => l.kind === "undefeated" && l.text.includes("Ada"))).toBe(true);
    // Losers get NO line of any kind — positive framing only (DASH-3).
    expect(lines.some((l) => l.text.includes("Cy") || l.text.includes("Dee"))).toBe(false);
  });

  it("announces a milestone club crossing", () => {
    // Nine prior sessions attended -> the tenth crosses into The 10 Club.
    const history = Array.from({ length: 9 }, (_, i) =>
      bundle({ sessionId: `h${i}`, date: `2026-06-${String(i + 1).padStart(2, "0")}`, pairs: [pairAB] })
    );
    const tenth = bundle({ sessionId: "s10", date: "2026-08-05", pairs: [pairAB] });
    const lines = notableLines(tenth, history);
    expect(lines.some((l) => l.kind === "milestone" && l.text.includes("The 10 Club") && l.text.includes("Ada"))).toBe(true);
  });

  it("publishes nothing for practice sessions and never names hidden players", () => {
    const practice = bundle({
      sessionId: "s1",
      date: "2026-08-05",
      practiceOnly: true,
      pairs: [pairAB],
      champions: [{ title: "Champion of the Week", points: 100, pair: pairAB }],
    });
    expect(notableLines(practice, [])).toHaveLength(0);

    const hiddenPair = { pairId: "p3", players: [{ displayName: "Club member" }, { id: "b", displayName: "Ben" }] as [any, any] };
    const s = bundle({
      sessionId: "s2",
      date: "2026-08-06",
      pairs: [hiddenPair],
      champions: [{ title: "Champion of the Week", points: 100, pair: hiddenPair }],
    });
    const lines = notableLines(s, []);
    expect(lines.some((l) => l.text.includes("Club member"))).toBe(false);
    expect(lines.some((l) => l.text.includes("Ben"))).toBe(true);
  });

  it("caps at four lines", () => {
    const manyPairs = Array.from({ length: 4 }, (_, i) => ({
      pairId: `mp${i}`,
      players: [
        { id: `x${i}`, displayName: `X${i}` },
        { id: `y${i}`, displayName: `Y${i}` },
      ] as [any, any],
    }));
    const s = bundle({
      sessionId: "s1",
      date: "2026-08-05",
      pairs: manyPairs,
      champions: manyPairs.slice(0, 3).map((p, i) => ({ title: `Title ${i}`, points: 40, pair: p })),
    });
    expect(notableLines(s, []).length).toBeLessThanOrEqual(4);
  });
});
