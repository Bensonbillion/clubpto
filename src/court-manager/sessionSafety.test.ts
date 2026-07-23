import { describe, expect, it } from "vitest";
import {
  canAdvanceToNextRound,
  canMutateSetup,
  clearTwoCourtSchedule,
  resolveSameDayHardStop,
} from "./sessionSafety";

describe("live-session safety regressions", () => {
  it("blocks setup mutations once a round is under way", () => {
    expect(canMutateSetup("setup")).toBe(true);
    expect(canMutateSetup("rounds")).toBe(false);
    expect(canMutateSetup("playoffs")).toBe(false);
    expect(canMutateSetup("done")).toBe(false);
  });

  it("never advances into a missing or empty round", () => {
    expect(canAdvanceToNextRound([[{ id: "r1" }]], 1)).toBe(false);
    expect(canAdvanceToNextRound([[{ id: "r1" }], [{ id: "r2" }]], 1)).toBe(true);
    expect(canAdvanceToNextRound([[{ id: "r1" }], []], 1)).toBe(false);
  });

  it("keeps a live hard stop on the current day instead of silently moving it to tomorrow", () => {
    const now = new Date("2026-07-22T22:05:00-04:00").getTime();
    const resolved = resolveSameDayHardStop("22:00", now);
    expect(resolved).toBe(new Date("2026-07-22T22:00:00-04:00").getTime());
    expect(resolveSameDayHardStop("", now)).toBeNull();
  });

  it("clears every schedule field while preserving the roster for the next 2-court session", () => {
    const cleared = clearTwoCourtSchedule({
      pairs: [{ id: "pair-1" }],
      currentRound: 3,
      results: [{ gameId: "r1-c1" }],
      voidedGames: ["r1-c2"],
      gameStarts: { "r2-c1": 123 },
      schedule: { rounds: [[{ id: "r1-c1" }]] },
      playoffs: { winners: { semi1: "a" } },
      champion: ["p1", "p2"],
    });

    expect(cleared).toEqual({
      pairs: [],
      currentRound: 0,
      results: [],
      voidedGames: [],
      gameStarts: {},
      schedule: null,
      playoffs: null,
      champion: null,
    });
  });
});
