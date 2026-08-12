// STEP 6 / 6.2 — the visible coin flip against a REAL night. Driven by the
// Scenario 1 seed (same as the sim suite) so the ties under test are the ones
// a real night produces, not synthetic ones chosen to be convenient.
//
// The group model's own machinery — the procedure, liveness, the gate, the
// 6.1 regressions, migration, the sweep — lives in groupflips.test.ts. This
// file owns the real-night behaviour: panel/printout agreement, staleness
// across a correction, and the honest decline.

import { describe, expect, it } from "vitest";
import type {
  AmericanoMatch, AmericanoPlayer, AmericanoPool, AmericanoScore, AmericanoSession,
  AmericanoTier,
} from "@/types/americano";
import { generateNextMatch, pairKey } from "../generator";
import { computeStandings, strengthOfSchedule } from "../standings";
import {
  applyCoinFlip, attemptCoinFlip, flipGroupOf, flipPhase, liveGroupRecords,
  pendingFlips, pickFlipWinner, poolStandings, pruneStaleFlips,
} from "../flips";

/* ── the Scenario 1 seed, verbatim from simulate.test.ts ─────────── */

const MATCH_MS = 9 * 60_000;
const RESULT_SALT = "#1";
const TIER_STRENGTH: Record<AmericanoTier, number> = { A: 40, B: 20, C: 0 };

function hash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(h, 31) + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const mkPlayers = (n: number, prefix = "p"): AmericanoPlayer[] =>
  Array.from({ length: n }, (_, i) => ({
    playerId: `${prefix}${String(i).padStart(2, "0")}`,
    displayName: `${prefix}${i}`,
    tier: (i < n / 3 ? "A" : i < (2 * n) / 3 ? "B" : "C") as AmericanoTier,
    status: "present" as const,
    joinedAtMatchIndex: null,
    catchUpUsed: false,
  }));

/** Plays the Scenario 1 night to completion and returns its session. */
function scenarioOne(): { session: AmericanoSession; players: AmericanoPlayer[] } {
  const players = mkPlayers(16);
  const pool: AmericanoPool = {
    id: "court-2", label: "Court 2", playerIds: players.map((p) => p.playerId),
    targetMatches: 3, playoffMode: "top8", status: "round_robin", matches: [],
  };
  const strengthOf = (id: string) => {
    const p = players.find((x) => x.playerId === id)!;
    return TIER_STRENGTH[p.tier] + (hash(id + RESULT_SALT) % 19) + 5;
  };
  let clock = 0;
  for (let i = 0; i < 200; i++) {
    const gen = generateNextMatch(pool, players);
    if ("blocked" in gen) break;
    for (const id of gen.meta.catchUpPlayerIds) {
      players.find((x) => x.playerId === id)!.catchUpUsed = true;
    }
    const { teamA, teamB } = gen.match;
    const a = teamA.reduce((s, id) => s + strengthOf(id), 0);
    const b = teamB.reduce((s, id) => s + strengthOf(id), 0);
    const key = teamA.join() + "|" + teamB.join() + RESULT_SALT;
    const winner = hash(key) % (a + b) < a ? "A" : "B";
    const margin = winner === "A" ? a - b : b - a;
    const score: AmericanoScore =
      (hash(key + "s") % 24) < 8 + Math.max(-6, Math.min(12, margin)) ? "2-0" : "2-1";
    const match: AmericanoMatch = {
      id: `court-2-m${pool.matches.length + 1}`, poolId: pool.id,
      matchIndex: pool.matches.length + 1, teamA, teamB,
      result: { winner, score }, status: "completed", phase: "round_robin",
      startedAt: clock, completedAt: clock + MATCH_MS,
    };
    clock += MATCH_MS;
    pool.matches.push(match);
  }
  return {
    session: {
      id: "night-s1", date: "2026-08-12", sessionName: "Scenario 1",
      players, pools: [pool], isPractice: true, status: "active",
    },
    players,
  };
}

const pool0 = (s: AmericanoSession) => s.pools[0];
const rowOf = (s: AmericanoSession, id: string) =>
  poolStandings(pool0(s), s.players).find((r) => r.playerId === id)!;

/** The exact line the sim printout emits — panel and printout must agree. */
const printLine = (
  pool: AmericanoPool, players: AmericanoPlayer[], r: ReturnType<typeof poolStandings>[number],
) => {
  const name = players.find((p) => p.playerId === r.playerId)!.displayName;
  return `${String(r.rank).padStart(2)}. ${name}  ${r.wins}W-${r.losses}L  diff ${r.gameDiff >= 0 ? "+" : ""}${r.gameDiff}  sos ${strengthOfSchedule(pool, r.playerId)}${r.tiebreakApplied ? `  (${r.tiebreakApplied})` : ""}${r.requiresCoinFlip ? "  [flip]" : ""}`;
};


const nextFlip = (s: AmericanoSession) => pendingFlips(pool0(s), s.players)[0];

describe("the Scenario 1 night produces real, flaggable ties (STEP 6)", () => {
  it("flags true W-L-diff-SOS groups and nothing else", () => {
    const { session } = scenarioOne();
    const pool = pool0(session);
    expect(pool.matches).toHaveLength(12);
    const pending = pendingFlips(pool, session.players);
    expect(pending.length).toBeGreaterThan(0);
    for (const f of pending) {
      // Every offered coin is between members of one genuine tied group.
      expect(flipGroupOf(pool, f.a, session.players)).toContain(f.b);
    }

    // The panel's data IS the printout's data — same rows, same annotations.
    const rows = poolStandings(pool, session.players);
    expect(rows).toHaveLength(16);
    expect(rows.map((r) => printLine(pool, session.players, r)).join("\n"))
      .toBe(computeStandings(pool, session.players)
        .map((r) => printLine(pool, session.players, r)).join("\n"));
  });
});

describe("recording a coin on a real night (STEP 6.2)", () => {
  it("a completed group order reorders the table and annotates COIN", () => {
    const { session } = scenarioOne();
    const f = nextFlip(session);
    const before = poolStandings(pool0(session), session.players);
    const idx = before.findIndex((r) => r.playerId === f.a);
    expect(before[idx].requiresCoinFlip).toBe(true);

    // Scenario 1's groups are pairs, so one coin settles this one.
    const next = applyCoinFlip(session, "court-2", f.a, f.b, f.b, 1_000);
    const rec = pool0(next).groupFlipResolutions!;
    expect(rec).toHaveLength(1);
    expect(rec[0].members).toEqual([f.a, f.b].sort());
    expect(rec[0].order).toEqual([f.b, f.a]);

    const after = poolStandings(pool0(next), next.players);
    expect(after.findIndex((r) => r.playerId === f.b))
      .toBeLessThan(after.findIndex((r) => r.playerId === f.a));
    expect(after.find((r) => r.playerId === f.b)!.tiebreakApplied).toBe("coinflip");
    expect(after.find((r) => r.playerId === f.b)!.requiresCoinFlip).toBe(false);
    expect(after.find((r) => r.playerId === f.a)!.requiresCoinFlip).toBe(false);
    expect(after.map((r) => r.rank)).toEqual(after.map((_, i) => i + 1));
    expect(JSON.parse(JSON.stringify(next))).toEqual(next);
  });

  it("landing on the leading name records the coin without moving anyone", () => {
    const { session } = scenarioOne();
    const f = nextFlip(session);
    const next = applyCoinFlip(session, "court-2", f.a, f.b, f.a, 1_000);
    const after = poolStandings(pool0(next), next.players);
    const i = after.findIndex((r) => r.playerId === f.a);
    expect(after[i + 1].playerId).toBe(f.b);
    expect(after[i].tiebreakApplied).toBe("coinflip");
  });
});

describe("the staleness rule on a real night (STEP 6.2)", () => {
  it("a correction that breaks the tie DROPS the record; undoing it re-flags fresh", () => {
    const { session } = scenarioOne();
    const pool = pool0(session);
    const f = nextFlip(session);
    const flipped = applyCoinFlip(session, "court-2", f.a, f.b, f.b, 1_000);
    expect(liveGroupRecords(pool0(flipped), flipped.players)).toHaveLength(1);

    const target = pool.matches.find(
      (m) => m.teamA.includes(f.a) || m.teamB.includes(f.a),
    )!;
    const corrected: AmericanoSession = {
      ...flipped,
      pools: flipped.pools.map((p) => ({
        ...p,
        matches: p.matches.map((m) =>
          m.id === target.id
            ? { ...m, result: { winner: m.result!.winner === "A" ? "B" as const : "A" as const, score: m.result!.score } }
            : m,
        ),
      })),
    };
    expect(liveGroupRecords(pool0(corrected), corrected.players)).toHaveLength(0);
    const pruned = pruneStaleFlips(corrected);
    expect(pool0(pruned).groupFlipResolutions).toBeUndefined();

    // Undo it. The identical tie is back — and must be flipped AFRESH.
    const restored: AmericanoSession = {
      ...pruned,
      pools: pruned.pools.map((p) => ({
        ...p, matches: p.matches.map((m) => (m.id === target.id ? target : m)),
      })),
    };
    expect(pool0(restored).groupFlipResolutions).toBeUndefined(); // no resurrection
    const again = pendingFlips(pool0(restored), restored.players);
    expect(again.some((x) => [x.a, x.b].sort().join() === [f.a, f.b].sort().join())).toBe(true);
    const row = poolStandings(pool0(restored), restored.players)
      .find((r) => r.playerId === f.a)!;
    expect(row.requiresCoinFlip).toBe(true);
  });

  it("a void that breaks the tie drops it too; an untouched night keeps it", () => {
    const { session } = scenarioOne();
    const f = nextFlip(session);
    const flipped = applyCoinFlip(session, "court-2", f.a, f.b, f.b, 1_000);
    const played = pool0(session).matches.find(
      (m) => m.teamA.includes(f.a) || m.teamB.includes(f.a),
    )!;
    const voided: AmericanoSession = {
      ...flipped,
      pools: flipped.pools.map((p) => ({
        ...p,
        matches: p.matches.map((m) => (m.id === played.id ? { ...m, status: "voided" as const } : m)),
      })),
    };
    expect(pruneStaleFlips(voided).pools[0].groupFlipResolutions).toBeUndefined();
    expect(pruneStaleFlips(flipped)).toBe(flipped); // nothing moved, nothing dropped
  });
});

describe("persistence mid-overlay (STEP 6)", () => {
  it("a refresh while the overlay is open records NOTHING and keeps the flags", () => {
    const { session } = scenarioOne();
    const f = nextFlip(session);
    const persisted: AmericanoSession = JSON.parse(JSON.stringify(session));
    expect(persisted).toEqual(session);
    expect(pool0(persisted).groupFlipResolutions).toBeUndefined();
    expect(poolStandings(pool0(persisted), persisted.players)
      .find((r) => r.playerId === f.a)!.requiresCoinFlip).toBe(true);
    const after = applyCoinFlip(persisted, "court-2", f.a, f.b, f.b, 5_000);
    expect(liveGroupRecords(pool0(after), after.players)).toHaveLength(1);
  });
});

describe("the overlay declines honestly (STEP 6.1, group reducer)", () => {
  it("names why it refused instead of silently changing nothing", () => {
    const { session } = scenarioOne();
    const f = nextFlip(session);
    expect(attemptCoinFlip(session, "court-2", f.a, f.b, "nobody", 1))
      .toMatchObject({ accepted: false, reason: "bad_winner" });
    expect(attemptCoinFlip(session, "no-such-pool", f.a, f.b, f.a, 1))
      .toMatchObject({ accepted: false, reason: "unknown_pool" });
    const once = applyCoinFlip(session, "court-2", f.a, f.b, f.a, 1_000);
    expect(attemptCoinFlip(once, "court-2", f.a, f.b, f.b, 2_000))
      .toMatchObject({ accepted: false, reason: "already_resolved" });
  });

  it("a tie broken DURING the animation is refused, and writes nothing", () => {
    const { session } = scenarioOne();
    const pool = pool0(session);
    const f = nextFlip(session);
    const target = pool.matches.find((m) => m.teamA.includes(f.a) || m.teamB.includes(f.a))!;
    const changed: AmericanoSession = {
      ...session,
      pools: session.pools.map((p) => ({
        ...p,
        matches: p.matches.map((m) =>
          m.id === target.id
            ? { ...m, result: { winner: m.result!.winner === "A" ? "B" as const : "A" as const, score: m.result!.score } }
            : m,
        ),
      })),
    };
    const attempt = attemptCoinFlip(changed, "court-2", f.a, f.b, f.a, 3_000);
    expect(attempt.accepted).toBe(false);
    expect(applyCoinFlip(changed, "court-2", f.a, f.b, f.a, 3_000)).toBe(changed);
    expect(pool0(changed).groupFlipResolutions).toBeUndefined();
  });

  it("the overlay NEVER lands on a winner it did not record", () => {
    expect(flipPhase({ animationDone: false, outcome: null })).toBe("flipping");
    expect(flipPhase({ animationDone: true, outcome: null })).toBe("recording");
    expect(flipPhase({ animationDone: true, outcome: { accepted: true } })).toBe("landed");
    expect(flipPhase({ animationDone: true, outcome: { accepted: false } })).toBe("declined");
    const { session } = scenarioOne();
    const f = nextFlip(session);
    const refused = attemptCoinFlip(session, "court-2", f.a, f.b, "nobody", 1);
    expect(flipPhase({ animationDone: true, outcome: { accepted: refused.accepted } }))
      .toBe("declined");
  });
});

describe("the coin itself (STEP 6)", () => {
  it("is an even, unbiased split over the injected entropy", () => {
    expect(pickFlipWinner("x", "y", () => 0)).toBe("x");
    expect(pickFlipWinner("x", "y", () => 1)).toBe("y");
    let xs = 0;
    for (let i = 0; i < 1000; i++) if (pickFlipWinner("x", "y", () => i) === "x") xs++;
    expect(xs).toBe(500);
  });
});
