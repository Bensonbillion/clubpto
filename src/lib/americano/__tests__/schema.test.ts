// STEP 4 addendum — the self-enforcing schema-version guard + phase-aware
// healing.
//
// THE RULE: never edit an existing session.vN.json fixture. A change to the
// persisted AmericanoSession shape requires a NEW fixture at a BUMPED
// AMERICANO_SCHEMA_VERSION — this suite fails until both move together, so
// the load-unmigrated white-screen class cannot recur silently.

import { describe, expect, it } from "vitest";
import type { AmericanoMatch, AmericanoPlayer, AmericanoSession } from "@/types/americano";
import {
  AMERICANO_SCHEMA_VERSION, canonicalSession, migrateAmericanoSession,
} from "../migrate";
import v2 from "../__fixtures__/session.v2.json";
import v3 from "../__fixtures__/session.v3.json";
import v4 from "../__fixtures__/session.v4.json";
import v5 from "../__fixtures__/session.v5.json";
import v6 from "../__fixtures__/session.v6.json";
import v7 from "../__fixtures__/session.v7.json";
import v8 from "../__fixtures__/session.v8.json";
import v9 from "../__fixtures__/session.v9.json";

const TODAY = "2026-09-01";

function assertValid(healed: AmericanoSession | null): AmericanoSession {
  expect(healed).not.toBeNull();
  const s = healed!;
  expect(s.pools.map((p) => p.id).sort()).toEqual(["court-1", "court-2"]);
  expect(Array.isArray(s.players)).toBe(true);
  expect(s.date).not.toBe("");
  expect(s.id).not.toBe("");
  return s;
}

describe("schema-version guard", () => {
  it("the current fixture matches the live canonical serialization AND version", () => {
    expect(v9.schemaVersion).toBe(AMERICANO_SCHEMA_VERSION);
    expect(v9.state).toEqual(JSON.parse(JSON.stringify(canonicalSession())));
  });

  it("a current-version fixture named for an older version cannot exist", () => {
    // The naming convention IS the guard: session.vN.json ↔ version N.
    for (const [fixture, version] of [[v2, 2], [v3, 3], [v4, 4], [v5, 5], [v6, 6], [v7, 7], [v8, 8], [v9, 9]] as const) {
      expect(fixture.schemaVersion).toBe(version);
    }
    expect(AMERICANO_SCHEMA_VERSION).toBe(9);
  });

  it("every historical fixture round-trips through migrate, healed and valid", () => {
    for (const fixture of [v2, v3, v4, v5, v6, v7, v8]) {
      const healed = assertValid(migrateAmericanoSession(fixture.state, TODAY));
      // A second pass is a no-op — healing is idempotent.
      expect(migrateAmericanoSession(healed, TODAY)).toEqual(healed);
    }
    // v3 fixture's orphans re-seat by the split rule (setup phase).
    const healedV3 = migrateAmericanoSession(v3.state, TODAY)!;
    expect(healedV3.pools.find((p) => p.id === "court-2")!.playerIds).toContain("pa");
    expect(healedV3.pools.find((p) => p.id === "court-1")!.playerIds).toContain("pc");
    // v4 fixture (active, with matches) passes through membership untouched.
    const healedV4 = migrateAmericanoSession(v4.state, TODAY)!;
    expect(healedV4.pools.find((p) => p.id === "court-2")!.playerIds).toEqual(["p1", "p2", "p3", "p4"]);
    expect(healedV4.integrityErrors).toBeUndefined();
  });
});

describe("phase-aware healing (STEP 4 addendum)", () => {
  const P = (id: string, tier: "A" | "B" | "C" = "B"): AmericanoPlayer => ({
    playerId: id, displayName: id.toUpperCase(), tier, status: "present",
    joinedAtMatchIndex: null, catchUpUsed: false,
  });
  const M = (teamA: [string, string], teamB: [string, string]): AmericanoMatch => ({
    id: "hm1", poolId: "court-2", matchIndex: 1, teamA, teamB,
    result: { winner: "A", setsLost: 0 }, status: "completed",
    phase: "round_robin", startedAt: 10, completedAt: 20,
  });
  const activeSession = (players: AmericanoPlayer[], court2Ids: string[], matches: AmericanoMatch[]) => ({
    id: "night-x", date: "2026-08-13", sessionName: "", players,
    pools: [
      { id: "court-2", label: "Court 2" as const, playerIds: court2Ids, targetMatches: 3, playoffMode: "top8" as const, status: "round_robin" as const, matches },
      { id: "court-1", label: "Court 1" as const, playerIds: [], targetMatches: 4, playoffMode: "undecided" as const, status: "setup" as const, matches: [] },
    ],
    isPractice: false, status: "active" as const,
  });

  it("(i) an orphaned MATCHLESS player heals into the split-rule pool", () => {
    const players = [P("p1"), P("p2"), P("p3"), P("p4"), P("orphanC", "C")];
    const s = activeSession(players, ["p1", "p2", "p3", "p4"], [M(["p1", "p4"], ["p2", "p3"])]);
    const healed = assertValid(migrateAmericanoSession(s, TODAY));
    expect(healed.pools.find((p) => p.id === "court-1")!.playerIds).toContain("orphanC");
    expect(healed.integrityErrors).toBeUndefined();
  });

  it("(ii) an orphaned player WITH match history is a surfaced hard error; membership untouched", () => {
    // p4 played match 1 but was dropped from every pool's membership.
    const players = [P("p1"), P("p2"), P("p3"), P("p4")];
    const s = activeSession(players, ["p1", "p2", "p3"], [M(["p1", "p4"], ["p2", "p3"])]);
    const healed = assertValid(migrateAmericanoSession(s, TODAY));
    expect(healed.integrityErrors?.length).toBe(1);
    expect(healed.integrityErrors![0]).toContain("P4");
    for (const pool of healed.pools) {
      expect(pool.playerIds).not.toContain("p4"); // never silently re-seated
    }
    // Re-migrating the already-healed state is IDEMPOTENT — the unresolved
    // orphan's error must not stack a duplicate on every load.
    const again = migrateAmericanoSession(healed, TODAY)!;
    expect(again.integrityErrors).toEqual(healed.integrityErrors);

    // A VOIDED appearance counts as history too.
    const voided = { ...M(["p1", "p4"], ["p2", "p3"]), status: "voided" as const };
    const s2 = activeSession(players, ["p1", "p2", "p3"], [voided]);
    const healed2 = assertValid(migrateAmericanoSession(s2, TODAY));
    expect(healed2.integrityErrors?.length).toBe(1);
  });
});
