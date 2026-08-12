// STEP 4 — the live-screen lib helpers: nextSelectionPreview and poolPace.

import { describe, expect, it } from "vitest";
import { DEFAULT_FORMAT } from "../format";
import type {
  AmericanoMatch, AmericanoPlayer, AmericanoPool, AmericanoTier,
} from "@/types/americano";
import { generateNextMatch, nextSelectionPreview, type GeneratedMatch } from "../generator";
import { poolPace } from "../pace";

const mkPlayers = (n: number): AmericanoPlayer[] =>
  Array.from({ length: n }, (_, i) => ({
    playerId: `p${String(i).padStart(2, "0")}`,
    displayName: `p${i}`,
    tier: (i < n / 3 ? "A" : i < (2 * n) / 3 ? "B" : "C") as AmericanoTier,
    status: "present" as const,
    joinedAtMatchIndex: null,
    catchUpUsed: false,
  }));

const mkPool = (players: AmericanoPlayer[], target: number): AmericanoPool => ({
  id: "court-2", label: "Court 2", playerIds: players.map((p) => p.playerId),
  targetMatches: target, playoffMode: "top8", status: "round_robin", matches: [], matchFormat: DEFAULT_FORMAT,
});

describe("nextSelectionPreview (STEP 4)", () => {
  it("equals the actual next selection for BOTH possible results, all night (16@3)", () => {
    const players = mkPlayers(16);
    const pool = mkPool(players, 3);
    let clock = 0;

    for (let step = 0; step < 40; step++) {
      const gen = generateNextMatch(pool, players);
      if ("blocked" in gen) {
        expect(gen.blocked).toBe("all_at_target");
        expect(nextSelectionPreview(pool, players)).toBeNull();
        break;
      }
      // Put the generated match on court (active, no result yet).
      const active: AmericanoMatch = {
        id: `m${step}`, poolId: pool.id, matchIndex: pool.matches.length + 1,
        teamA: gen.match.teamA, teamB: gen.match.teamB, result: null,
        status: "active", phase: "round_robin", startedAt: clock, completedAt: null,
      };
      pool.matches.push(active);

      const preview = nextSelectionPreview(pool, players);

      // Complete the active match BOTH ways on clones; the actual selection
      // must match the preview regardless of who won.
      for (const [winner, setsLost] of [["A", 0], ["B", 1]] as ["A" | "B", number][]) {
        const clone: AmericanoPool = {
          ...pool,
          matches: pool.matches.map((m) =>
            m.id === active.id
              ? { ...m, status: "completed" as const, result: { winner, setsLost }, completedAt: clock + 1 }
              : m,
          ),
        };
        const actual = generateNextMatch(clone, players);
        if (preview === null) {
          expect("blocked" in actual).toBe(true);
        } else {
          expect("blocked" in actual).toBe(false);
          expect([...(actual as GeneratedMatch).meta.quartet].sort()).toEqual(preview);
        }
      }

      // Commit one real result and roll on.
      active.status = "completed";
      active.result = { winner: "A", setsLost: 1 };
      active.completedAt = clock + 1;
      clock += 10;
    }
    expect(pool.matches.length).toBe(12); // the full 16@3 night ran
  });

  it("returns null when the pool is blocked below four present", () => {
    const players = mkPlayers(16).map((p, i) => (i > 2 ? { ...p, status: "left" as const } : p));
    const pool = mkPool(players, 3);
    expect(nextSelectionPreview(pool, players)).toBeNull();
  });
});

describe("poolPace (STEP 4)", () => {
  // Seat REAL players, four at a time round-robin over the pool: `total` is
  // the outstanding need of the people present (STEP 5), so a fixture with
  // invented ids would credit nobody and inflate the projection.
  let seat = 0;
  const four = (players: AmericanoPlayer[]): [string, string, string, string] => {
    const ids = [0, 1, 2, 3].map((k) => players[(seat + k) % players.length].playerId);
    seat += 4;
    return ids as [string, string, string, string];
  };
  const done = (
    id: string, startedAt: number, completedAt: number, players: AmericanoPlayer[],
  ): AmericanoMatch => {
    const [a, b, c, d] = four(players);
    return {
      id, poolId: "court-2", matchIndex: 0, teamA: [a, b], teamB: [c, d],
      result: { winner: "A", setsLost: 1 }, status: "completed",
      phase: "round_robin", startedAt, completedAt,
    };
  };

  it("hides until two completions, then averages the last five intervals", () => {
    seat = 0;
    const players = mkPlayers(16);
    const pool = mkPool(players, 3);
    const M = 60_000;
    pool.matches.push({ ...done("m1", 0, 8 * M, players) });
    expect(poolPace(pool, players, 10 * M).avgMs).toBeNull();

    pool.matches.push(done("m2", 8 * M, 14 * M, players)); // intervals: 8m (from anchor 0), 6m
    const p2 = poolPace(pool, players, 14 * M);
    expect(p2.done).toBe(2);
    expect(p2.total).toBe(12);
    expect(p2.avgMs).toBe(7 * M);
    expect(p2.projectedEndMs).toBe(14 * M + 10 * (7 * M));

    // Seven completions: only the LAST FIVE intervals count.
    const times = [20, 26, 32, 38, 44].map((t) => t * M);
    let prev = 14 * M;
    for (const t of times) { pool.matches.push(done(`mx${t}`, prev, t, players)); prev = t; }
    const p7 = poolPace(pool, players, 44 * M);
    expect(p7.done).toBe(7);
    expect(p7.avgMs).toBe(6 * M); // last five are all 6-minute gaps
  });

  it("voided matches contribute nothing to count or intervals", () => {
    seat = 0;
    const players = mkPlayers(16);
    const pool = mkPool(players, 3);
    pool.matches.push(done("m1", 0, 5_000, players));
    pool.matches.push({ ...done("m2", 5_000, 400_000, players), status: "voided" });
    pool.matches.push(done("m3", 6_000, 10_000, players));
    const p = poolPace(pool, players, 10_000);
    expect(p.done).toBe(2);
    expect(p.avgMs).toBe((5_000 + 5_000) / 2); // 0→5s, 5s→10s; the void is invisible
  });
});
