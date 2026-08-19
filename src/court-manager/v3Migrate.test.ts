import { describe, expect, it } from "vitest";
import { migrateSession } from "./react/useSessionV2";

// The live cm_v3_session row holds 449 players. It is not a night — it is the
// club's whole roster, and it is what v4 reads names from too
// (fetchSharedRoster in src/lib/americano/storage.ts points at this row).
//
// The header on migrateSession says the v3 bump once dropped the roster and
// that the class of loss is banned. Bumping 5 -> 6 for publishedId re-runs
// this function over that row on the next load, so it is worth proving rather
// than reasoning about.
const roster = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    id: `pl-${i}`,
    name: `Player${i}`,
    tier: (i % 3 === 0 ? "A" : i % 3 === 1 ? "B" : "C") as "A" | "B" | "C",
    isVip: false,
    isCoach: false,
    checkedIn: false,
  }));

describe("the 5 -> 6 bump, over the live roster row", () => {
  const v5 = { players: roster(449), pairs: [], results: [] };

  it("keeps every one of the 449", () => {
    const out = migrateSession(v5, 5)!;
    expect(out).not.toBeNull();
    expect(out.players).toHaveLength(449);
    expect(out.players[0].id).toBe("pl-0");
    expect(out.players[448].id).toBe("pl-448");
  });

  it("keeps their names and tiers untouched", () => {
    const out = migrateSession(v5, 5)!;
    for (const [i, p] of out.players.entries()) {
      expect(p.name).toBe(`Player${i}`);
      expect(p.tier).toBe(v5.players[i].tier);
    }
  });

  it("adds publishedId as absent rather than inventing one", () => {
    const out = migrateSession(v5, 5)!;
    // Absent means "never published", which is the truth about an old row.
    expect(out.publishedId ?? null).toBeNull();
  });

  it("is idempotent, so a second load changes nothing", () => {
    const once = migrateSession(v5, 5)!;
    expect(migrateSession(once, 6)).toEqual(once);
  });

  it("still refuses a shape with no players array", () => {
    expect(migrateSession({ pairs: [] }, 5)).toBeNull();
    expect(migrateSession(null, 5)).toBeNull();
  });
});
