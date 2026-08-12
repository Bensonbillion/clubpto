// STEP 1 unit tests — the divisibility rule and court-match arithmetic.

import { describe, expect, it } from "vitest";
import { courtMatchesNeeded, poolSetupNotices, proposePoolSplit, setupDefaultTarget, validTargets } from "../config";
import type { AmericanoPlayer, AmericanoTier } from "@/types/americano";

describe("validTargets", () => {
  it("rejects 3 for a 14-pool and offers 4", () => {
    const t = validTargets(14);
    expect(t).not.toContain(3);
    expect(t).toContain(4);
    expect(t).toEqual([2, 4, 6]);
  });

  it("offers every target for pools of 12 and 16", () => {
    expect(validTargets(12)).toEqual([2, 3, 4, 5, 6]);
    expect(validTargets(16)).toEqual([2, 3, 4, 5, 6]);
  });

  it("includes 4 for every even size 8–20 (the guarantee)", () => {
    for (let size = 8; size <= 20; size += 2) {
      expect(validTargets(size)).toContain(4);
    }
  });
});

describe("courtMatchesNeeded", () => {
  it("16×3→12, 12×4→12, 14×4→14", () => {
    expect(courtMatchesNeeded(16, 3)).toBe(12);
    expect(courtMatchesNeeded(12, 4)).toBe(12);
    expect(courtMatchesNeeded(14, 4)).toBe(14);
  });
});

describe("proposePoolSplit", () => {
  const mk = (id: string, tier: AmericanoTier): AmericanoPlayer => ({
    playerId: id, displayName: id, tier, status: "present",
    joinedAtMatchIndex: null, catchUpUsed: false,
  });

  it("sends A/B to the premier pool (Court 2) and C to Court 1", () => {
    const players = [
      mk("a1", "A"), mk("c1", "C"), mk("b1", "B"), mk("c2", "C"),
      mk("a2", "A"), mk("b2", "B"), mk("c3", "C"), mk("c4", "C"),
    ];
    const split = proposePoolSplit(players);
    expect(split.court2.sort()).toEqual(["a1", "a2", "b1", "b2"]);
    expect(split.court1.sort()).toEqual(["c1", "c2", "c3", "c4"]);
  });
});

describe("setupDefaultTarget (STEP 3: highest valid ≤ 4)", () => {
  it("picks 4 for 16, 12 and 14; 3 is never the default", () => {
    expect(setupDefaultTarget(16)).toBe(4);
    expect(setupDefaultTarget(12)).toBe(4);
    expect(setupDefaultTarget(14)).toBe(4);
  });
  it("exists for every size ≥ 4 and is null below", () => {
    for (let size = 4; size <= 24; size++) {
      const d = setupDefaultTarget(size);
      expect(d).not.toBeNull();
      expect(d!).toBeLessThanOrEqual(4);
      expect(validTargets(size)).toContain(d!);
    }
    expect(setupDefaultTarget(3)).toBeNull();
  });
});

describe("poolSetupNotices (STEP 3)", () => {
  it("blocks under 4, informs under 8, warns on odd", () => {
    expect(poolSetupNotices(3).map((n) => n.level)).toEqual(["block"]);
    expect(poolSetupNotices(6).map((n) => n.level)).toEqual(["info"]);
    expect(poolSetupNotices(7).map((n) => n.level)).toEqual(["warning", "info"]);
    expect(poolSetupNotices(13).map((n) => n.level)).toEqual(["warning"]);
    expect(poolSetupNotices(16)).toEqual([]);
    expect(poolSetupNotices(14)).toEqual([]);
  });
});
