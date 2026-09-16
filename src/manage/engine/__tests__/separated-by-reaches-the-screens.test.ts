// The label is fixed in standings.test.ts. This file is about the other half:
// the screens that ACT on it.
//
// `separatedBy` drives a reason line on frame 17, which rows are tappable,
// which pair frame 18 opens on, the runner-up clause on frame 24 and the
// WhatsApp paste on frame 25. A correct engine that leaves a screen printing
// the old sentence has fixed nothing the operator can see, so the funnel every
// screen reads through is pinned here, and so is the one screen whose output
// is plain text and can therefore be asserted without a DOM.
//
// There is no DOM test environment (vitest.config.ts is "node"), so the React
// screens are covered by the typecheck and by inspection. buildWhatsAppPayload
// is not: it is a pure function over rows, it is what lands in the club's chat,
// and it is where a false "(first to score)" outlives the night.

import { describe, expect, it } from "vitest";
import { computeStandings, sayableSeparation, type PlayedMatch } from "../standings";
import { buildWhatsAppPayload } from "../../screens/summary-states/SessionSummary";

const M = (
  matchIndex: number,
  teamA: [string, string],
  teamB: [string, string],
  scoreA: number,
  scoreB: number,
): PlayedMatch => ({ matchIndex, completedAt: matchIndex * 1000, teamA, teamB, scoreA, scoreB });

describe("the funnel every screen reads separatedBy through", () => {
  it("hands back the three real keys and nothing else", () => {
    expect(sayableSeparation("points")).toBe("points");
    expect(sayableSeparation("diff")).toBe("diff");
    expect(sayableSeparation("reachedFirst")).toBe("reachedFirst");
  });

  it("says nothing for a pair nothing separated, and nothing for the last row", () => {
    // These two are the same answer on purpose. "level" means no key of the
    // night put one above the other; null means there is no row below. In both
    // cases a screen that prints a reason is inventing one.
    expect(sayableSeparation("level")).toBeNull();
    expect(sayableSeparation(null)).toBeNull();
  });
});

describe("the WhatsApp paste, which is the record of the night that survives", () => {
  const paste = (playerIds: string[], matches: PlayedMatch[]) =>
    buildWhatsAppPayload({
      dayLabel: "Sunday",
      playersIn: playerIds.length,
      champions: [],
      standingsByCourt: [{
        courtNumber: 1,
        rows: computeStandings(playerIds, matches).map((r) => ({
          rank: r.rank,
          playerName: r.playerId,
          points: r.points,
          diff: r.scoreDiff,
          separatedBy: r.matchesPlayed > 0 ? r.separatedBy : null,
        })),
      }],
    });

  it("claims nothing about two partners who won a game together", () => {
    // One game, the shape every court produces after every result.
    const text = paste(
      ["kate", "sam", "ben", "priya"],
      [M(1, ["kate", "sam"], ["ben", "priya"], 6, 2)],
    );
    expect(text).not.toContain("first to score");
    expect(text).toContain("1 kate 3, 2 sam 3, 3 ben 0, 4 priya 0");
  });

  it("still says it where somebody really did get to the total first", () => {
    // The guard. early and late finish level on points and difference, and
    // early got there two matches earlier. That is a true sentence and the
    // paste keeps it.
    const text = paste(["early", "late", "x", "y"], [
      M(1, ["early", "x"], ["late", "y"], 2, 0),
      M(2, ["x", "y"], ["early", "late"], 2, 0),
      M(3, ["late", "x"], ["early", "y"], 2, 0),
    ]);
    expect(text).toContain("(first to score)");
  });
});
