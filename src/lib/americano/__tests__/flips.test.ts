// STEP 6 — the visible coin flip: resolution storage, the staleness rule, and
// the playoff gate. Driven by the REAL Scenario 1 night (same seed as the sim
// suite) so the flips under test are the ones a real night produces, not
// synthetic ties chosen to be convenient.

import { describe, expect, it } from "vitest";
import type {
  AmericanoMatch, AmericanoPlayer, AmericanoPool, AmericanoScore, AmericanoSession,
  AmericanoTier,
} from "@/types/americano";
import { generateNextMatch, pairKey } from "../generator";
import { computeStandings, strengthOfSchedule } from "../standings";
import {
  applyCoinFlip, attemptCoinFlip, flipPhase, flipResolutionMap, liveFlips,
  pendingFlipPairs, pickFlipWinner, poolStandings, pruneStaleFlips,
  stillTiedPreFlip, unresolvedFlipsAffecting,
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

describe("the Scenario 1 night produces real, flaggable flips (STEP 6)", () => {
  it("flags true W-L-diff-SOS twins and nothing else", () => {
    const { session } = scenarioOne();
    const pool = pool0(session);
    expect(pool.matches).toHaveLength(12);
    const pending = pendingFlipPairs(pool, session.players);
    expect(pending.length).toBeGreaterThan(0);
    for (const { a, b } of pending) expect(stillTiedPreFlip(pool, a, b)).toBe(true);

    // The panel's data IS the printout's data — same rows, same annotations.
    const rows = poolStandings(pool, session.players);
    expect(rows).toHaveLength(16);
    expect(rows.map((r) => printLine(pool, session.players, r)).join("\n"))
      .toBe(computeStandings(pool, session.players, {})
        .map((r) => printLine(pool, session.players, r)).join("\n"));
  });
});

describe("resolution storage + injection (STEP 6)", () => {
  it("a recorded flip reorders the table and annotates the row COIN", () => {
    const { session } = scenarioOne();
    const [{ a, b }] = pendingFlipPairs(pool0(session), session.players);
    const before = poolStandings(pool0(session), session.players);
    const beforeIdx = before.findIndex((r) => r.playerId === a);
    expect(before[beforeIdx].requiresCoinFlip).toBe(true);

    // Land the flip on the player the provisional order put SECOND.
    const next = applyCoinFlip(session, "court-2", a, b, b, 1_000);
    expect(pool0(next).coinFlipResolutions).toEqual([{ a, b, winner: b, at: 1_000 }]);

    const after = poolStandings(pool0(next), next.players);
    expect(after[beforeIdx].playerId).toBe(b); // the flip actually moved them
    expect(after[beforeIdx + 1].playerId).toBe(a);
    expect(after[beforeIdx].tiebreakApplied).toBe("coinflip");
    expect(after[beforeIdx].requiresCoinFlip).toBe(false);
    expect(after[beforeIdx + 1].requiresCoinFlip).toBe(false);

    // Ranks stay a clean 1..n after the swap.
    expect(after.map((r) => r.rank)).toEqual(after.map((_, i) => i + 1));
    // Survives persistence byte-for-byte.
    expect(JSON.parse(JSON.stringify(next))).toEqual(next);
  });

  it("landing on the leading name records the flip without moving anyone", () => {
    const { session } = scenarioOne();
    const [{ a, b }] = pendingFlipPairs(pool0(session), session.players);
    const next = applyCoinFlip(session, "court-2", a, b, a, 1_000);
    const after = poolStandings(pool0(next), next.players);
    const idx = after.findIndex((r) => r.playerId === a);
    expect(after[idx + 1].playerId).toBe(b);
    expect(after[idx].tiebreakApplied).toBe("coinflip");
    expect(after[idx].requiresCoinFlip).toBe(false);
  });

  it("refuses a re-flip of a live resolution, and refuses untied or bogus pairs", () => {
    const { session } = scenarioOne();
    const [{ a, b }] = pendingFlipPairs(pool0(session), session.players);
    const once = applyCoinFlip(session, "court-2", a, b, a, 1_000);

    // The result is the result: no second flip while the resolution lives.
    expect(applyCoinFlip(once, "court-2", a, b, b, 2_000)).toBe(once);
    // A winner who is not in the pair, an unknown pool, and an untied pair.
    expect(applyCoinFlip(session, "court-2", a, b, "p99", 2_000)).toBe(session);
    expect(applyCoinFlip(session, "nope", a, b, a, 2_000)).toBe(session);
    const leader = poolStandings(pool0(session), session.players)[0].playerId;
    const last = poolStandings(pool0(session), session.players).at(-1)!.playerId;
    expect(stillTiedPreFlip(pool0(session), leader, last)).toBe(false);
    expect(applyCoinFlip(session, "court-2", leader, last, leader, 2_000)).toBe(session);
  });
});

describe("multi-way ties resolve ONE visible flip at a time (STEP 6)", () => {
  /** Four players tied on W-L-diff AND SOS — a run of three adjacent pairs. */
  const fourWayRun = (): { pool: AmericanoPool; players: AmericanoPlayer[] } => {
    const players = mkPlayers(8, "t").map((p) => ({ ...p, tier: "B" as const }));
    const ids = players.map((p) => p.playerId);
    const m = (i: number, tA: [string, string], tB: [string, string]): AmericanoMatch => ({
      id: `court-2-m${i}`, poolId: "court-2", matchIndex: i, teamA: tA, teamB: tB,
      result: { winner: "A", score: "2-1" }, status: "completed", phase: "round_robin",
      startedAt: i * 100, completedAt: i * 100 + 50,
    });
    return {
      pool: {
        id: "court-2", label: "Court 2", playerIds: ids, targetMatches: 1,
        playoffMode: "top8", status: "round_robin",
        matches: [m(1, [ids[0], ids[1]], [ids[2], ids[3]]), m(2, [ids[4], ids[5]], [ids[6], ids[7]])],
      },
      players,
    };
  };

  it("a resolved pair is NEVER offered again, even when the reorder puts them back side by side", () => {
    const { pool, players } = fourWayRun();
    let s: AmericanoSession = {
      id: "n", date: "2026-08-12", sessionName: "", players, pools: [pool],
      isPractice: true, status: "active",
    };
    // Two runs of four (the winners, then the losers) → three adjacent pairs
    // each. The winners' middle pair is index 1.
    const pending0 = pendingFlipPairs(pool, players);
    expect(pending0.length).toBe(6);

    // Resolve the MIDDLE pair, landing on the lower name so the group reorders
    // around them — the case where both keep a flag against a new neighbour.
    const mid = pending0[1];
    s = applyCoinFlip(s, "court-2", mid.a, mid.b, mid.b, 1_000);
    expect(liveFlips(pool0(s))).toHaveLength(1);

    const pending1 = pendingFlipPairs(pool0(s), s.players);
    expect(pending1.some((x) => pairKey(x.a, x.b) === pairKey(mid.a, mid.b))).toBe(false);
    // …and the flip that WAS run is honoured in the order.
    const rows = poolStandings(pool0(s), s.players);
    expect(rows.findIndex((r) => r.playerId === mid.b))
      .toBeLessThan(rows.findIndex((r) => r.playerId === mid.a));

    // Every pair still offered is one a flip would actually decide.
    for (const p of pending1) {
      const before = poolStandings(pool0(s), s.players).map((r) => r.playerId).join();
      const next = applyCoinFlip(s, "court-2", p.a, p.b, p.b, 2_000);
      expect(next).not.toBe(s); // never a silent no-op
      expect(poolStandings(pool0(next), next.players).map((r) => r.playerId).join())
        .not.toBe(before);
    }
  });

  it("the badge counts flips OFFERED, not flagged rows halved (6.1 review finding)", () => {
    // A run of four flags four rows but offers three flips; the panel used to
    // show round(4/2) = 2. It now reads pendingFlipPairs, which is the truth.
    const { pool, players } = fourWayRun();
    const flagged = poolStandings(pool, players).filter((r) => r.requiresCoinFlip);
    const offered = pendingFlipPairs(pool, players);
    expect(flagged.length).toBe(8);   // two runs of four
    expect(offered.length).toBe(6);   // three adjacent pairs in each run
    expect(offered.length).not.toBe(Math.round(flagged.length / 2));
  });

  it("flipping down the run terminates with a fully ordered top group", () => {
    const { pool, players } = fourWayRun();
    let s: AmericanoSession = {
      id: "n", date: "2026-08-12", sessionName: "", players, pools: [pool],
      isPractice: true, status: "active",
    };
    for (let guard = 0; guard < 20; guard++) {
      const pending = pendingFlipPairs(pool0(s), s.players);
      if (pending.length === 0) break;
      const { a, b } = pending[0];
      const next = applyCoinFlip(s, "court-2", a, b, b, 1_000 + guard);
      expect(next).not.toBe(s);
      s = next;
    }
    expect(pendingFlipPairs(pool0(s), s.players)).toEqual([]);
    expect(poolStandings(pool0(s), s.players).some((r) => r.requiresCoinFlip)).toBe(false);
    expect(unresolvedFlipsAffecting(pool0(s), s.players, 4)).toEqual([]);
  });
});

describe("the staleness rule (STEP 6)", () => {
  it("a correction that breaks the tie DROPS the resolution; undoing it re-flags a FRESH flip", () => {
    const { session } = scenarioOne();
    const pool = pool0(session);
    const [{ a, b }] = pendingFlipPairs(pool, session.players);
    const flipped = applyCoinFlip(session, "court-2", a, b, b, 1_000);
    expect(liveFlips(pool0(flipped))).toHaveLength(1);

    // Find a completed match involving `a` and flip its winner — that changes
    // a's W-L-diff and breaks the tie the coin was tossed to settle.
    const target = pool.matches.find(
      (m) => m.teamA.includes(a) || m.teamB.includes(a),
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
    expect(stillTiedPreFlip(pool0(corrected), a, b)).toBe(false);
    expect(liveFlips(pool0(corrected))).toHaveLength(0); // ignored immediately…

    const pruned = pruneStaleFlips(corrected);
    expect(pool0(pruned).coinFlipResolutions).toBeUndefined(); // …and really deleted
    expect(flipResolutionMap(pool0(pruned))).toEqual({});

    // Undo the correction. The identical tie is back — and because the old
    // resolution was DELETED rather than parked, the pair must flip again.
    const restored: AmericanoSession = {
      ...pruned,
      pools: pruned.pools.map((p) => ({
        ...p,
        matches: p.matches.map((m) => (m.id === target.id ? target : m)),
      })),
    };
    expect(stillTiedPreFlip(pool0(restored), a, b)).toBe(true);
    expect(pool0(restored).coinFlipResolutions).toBeUndefined(); // no resurrection
    const pair = pendingFlipPairs(pool0(restored), restored.players);
    expect(pair.some((p) => pairKey(p.a, p.b) === pairKey(a, b))).toBe(true);
    expect(rowOf(restored, a).requiresCoinFlip).toBe(true);
    expect(rowOf(restored, b).requiresCoinFlip).toBe(true);
  });

  it("a void that breaks the tie drops it too; an unrelated correction leaves it alone", () => {
    const { session } = scenarioOne();
    const pool = pool0(session);
    const [{ a, b }] = pendingFlipPairs(pool, session.players);
    const flipped = applyCoinFlip(session, "court-2", a, b, b, 1_000);

    const played = pool.matches.find((m) => m.teamA.includes(a) || m.teamB.includes(a))!;
    const voided: AmericanoSession = {
      ...flipped,
      pools: flipped.pools.map((p) => ({
        ...p,
        matches: p.matches.map((m) => (m.id === played.id ? { ...m, status: "voided" as const } : m)),
      })),
    };
    expect(pool0(pruneStaleFlips(voided)).coinFlipResolutions).toBeUndefined();

    // A match touching NEITHER of the pair, and no one they played, must not
    // disturb the resolution. (SOS reaches further than W-L, so this asserts
    // the honest thing: pruning is driven by the real chain, not by a guess.)
    const untouched = pruneStaleFlips(flipped);
    expect(pool0(untouched).coinFlipResolutions).toHaveLength(1);
    expect(liveFlips(pool0(untouched))).toHaveLength(1);
    expect(rowOf(untouched, b).tiebreakApplied).toBe("coinflip");
  });

  it("pruning is idempotent and leaves a clean night completely alone", () => {
    const { session } = scenarioOne();
    expect(pruneStaleFlips(session)).toBe(session); // no flips, no copy
    const [{ a, b }] = pendingFlipPairs(pool0(session), session.players);
    const flipped = applyCoinFlip(session, "court-2", a, b, a, 1_000);
    expect(pruneStaleFlips(flipped)).toBe(flipped);
    expect(pruneStaleFlips(pruneStaleFlips(flipped))).toBe(flipped);
  });
});

describe("persistence mid-overlay (STEP 6)", () => {
  it("a refresh while the overlay is open records NOTHING and keeps the flags", () => {
    const { session } = scenarioOne();
    const [{ a, b }] = pendingFlipPairs(pool0(session), session.players);
    // The overlay is UI state only: opening it never touches the session, so
    // the persisted envelope is byte-identical to the pre-open one.
    const persisted: AmericanoSession = JSON.parse(JSON.stringify(session));
    expect(persisted).toEqual(session);
    expect(pool0(persisted).coinFlipResolutions).toBeUndefined();
    expect(rowOf(persisted, a).requiresCoinFlip).toBe(true);
    expect(rowOf(persisted, b).requiresCoinFlip).toBe(true);

    // And the flip still lands normally after the reload.
    const after = applyCoinFlip(persisted, "court-2", a, b, b, 5_000);
    expect(liveFlips(pool0(after))).toHaveLength(1);
    expect(JSON.parse(JSON.stringify(after))).toEqual(after);
  });
});

describe("unresolvedFlipsAffecting — Step 7's gate (STEP 6)", () => {
  /** Build a pool whose standings tie exactly where the test needs. */
  const tiedNight = (): { pool: AmericanoPool; players: AmericanoPlayer[] } => {
    const players = mkPlayers(8, "t").map((p) => ({ ...p, tier: "B" as const }));
    const ids = players.map((p) => p.playerId);
    const m = (i: number, tA: [string, string], tB: [string, string], winner: "A" | "B"): AmericanoMatch => ({
      id: `court-2-m${i}`, poolId: "court-2", matchIndex: i, teamA: tA, teamB: tB,
      result: { winner, score: "2-1" }, status: "completed", phase: "round_robin",
      startedAt: i * 100, completedAt: i * 100 + 50,
    });
    // Everyone plays once; four winners, four losers — a 4/4 split with
    // identical diffs, so ties sit exactly on a cutSize-4 line.
    const pool: AmericanoPool = {
      id: "court-2", label: "Court 2", playerIds: ids, targetMatches: 1,
      playoffMode: "top8", status: "round_robin",
      matches: [
        m(1, [ids[0], ids[1]], [ids[2], ids[3]], "A"),
        m(2, [ids[4], ids[5]], [ids[6], ids[7]], "A"),
      ],
    };
    return { pool, players };
  };

  it("a tie inside the top group blocks as seed_order; the same tie below the line does not block", () => {
    const { pool, players } = tiedNight();
    const rows = poolStandings(pool, players);
    // Winners (1W-0L, +1) occupy 1-4; losers (0W-1L, −1) occupy 5-8.
    expect(rows.slice(0, 4).every((r) => r.wins === 1)).toBe(true);
    expect(rows.slice(4).every((r) => r.wins === 0)).toBe(true);

    // Cut at 4: every unresolved flip among the winners decides seeding; the
    // losers' ties decide nothing a bracket reads.
    const atFour = unresolvedFlipsAffecting(pool, players, 4);
    expect(atFour.length).toBeGreaterThan(0);
    expect(atFour.every((f) => f.reason === "seed_order")).toBe(true);
    const winners = new Set(rows.slice(0, 4).map((r) => r.playerId));
    for (const f of atFour) {
      expect(winners.has(f.a) && winners.has(f.b)).toBe(true);
    }

    // Cut at 8 (everyone in): the losers' ties now decide seeding too.
    expect(unresolvedFlipsAffecting(pool, players, 8).length)
      .toBeGreaterThan(atFour.length);
  });

  it("a tie straddling the cut blocks as cut_line", () => {
    const { pool, players } = tiedNight();
    // Cut at 2 puts ranks 2 and 3 — tied winners — on opposite sides.
    const atTwo = unresolvedFlipsAffecting(pool, players, 2);
    expect(atTwo.some((f) => f.reason === "cut_line")).toBe(true);
    const rows = poolStandings(pool, players);
    const rank = new Map(rows.map((r) => [r.playerId, r.rank] as const));
    for (const f of atTwo.filter((x) => x.reason === "cut_line")) {
      const inside = [rank.get(f.a)!, rank.get(f.b)!].filter((r) => r <= 2).length;
      expect(inside).toBe(1); // exactly one side of the line
    }
  });

  it("mid-table ties alone return none, and resolving a blocker clears the gate", () => {
    const { pool, players } = tiedNight();
    // cutSize 0 — nothing is seeded, so nothing can be blocked.
    expect(unresolvedFlipsAffecting(pool, players, 0)).toEqual([]);

    // Resolve every blocking flip at cut 4; the gate empties.
    let s: AmericanoSession = {
      id: "n", date: "2026-08-12", sessionName: "", players,
      pools: [pool], isPractice: true, status: "active",
    };
    for (let guard = 0; guard < 16; guard++) {
      const blocking = unresolvedFlipsAffecting(pool0(s), s.players, 4);
      if (blocking.length === 0) break;
      const { a, b } = blocking[0];
      s = applyCoinFlip(s, "court-2", a, b, a, 1_000 + guard);
    }
    expect(unresolvedFlipsAffecting(pool0(s), s.players, 4)).toEqual([]);
    expect(poolStandings(pool0(s), s.players).slice(0, 4).some((r) => r.requiresCoinFlip)).toBe(false);
  });
});

describe("the coin itself (STEP 6)", () => {
  it("is an even, unbiased split over the injected entropy", () => {
    // Deterministic sweep: every parity lands where it should, and neither
    // name is favoured by position.
    expect(pickFlipWinner("x", "y", () => 0)).toBe("x");
    expect(pickFlipWinner("x", "y", () => 1)).toBe("y");
    let xs = 0;
    for (let i = 0; i < 1000; i++) {
      if (pickFlipWinner("x", "y", () => i) === "x") xs++;
    }
    expect(xs).toBe(500);
  });
});

describe("the overlay declines honestly (STEP 6.1)", () => {
  /** Every refusal path, as a value the UI can act on. */
  it("names why it refused instead of silently changing nothing", () => {
    const { session } = scenarioOne();
    const [{ a, b }] = pendingFlipPairs(pool0(session), session.players);

    expect(attemptCoinFlip(session, "court-2", a, b, "nobody", 1).accepted).toBe(false);
    expect(attemptCoinFlip(session, "court-2", a, b, "nobody", 1))
      .toMatchObject({ reason: "bad_winner" });
    expect(attemptCoinFlip(session, "no-such-pool", a, b, a, 1))
      .toMatchObject({ accepted: false, reason: "unknown_pool" });

    const once = applyCoinFlip(session, "court-2", a, b, a, 1_000);
    expect(attemptCoinFlip(once, "court-2", a, b, b, 2_000))
      .toMatchObject({ accepted: false, reason: "already_resolved" });
  });

  it("a tie broken DURING the animation is refused as tie_changed, and writes nothing", () => {
    const { session } = scenarioOne();
    const pool = pool0(session);
    const [{ a, b }] = pendingFlipPairs(pool, session.players);

    // The overlay opened on a live tie… then another tab corrected a result.
    const target = pool.matches.find((m) => m.teamA.includes(a) || m.teamB.includes(a))!;
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

    const attempt = attemptCoinFlip(changed, "court-2", a, b, a, 3_000);
    expect(attempt).toMatchObject({ accepted: false, reason: "tie_changed" });
    // Nothing recorded, anywhere.
    expect(applyCoinFlip(changed, "court-2", a, b, a, 3_000)).toBe(changed);
    expect(pool0(changed).coinFlipResolutions).toBeUndefined();
  });

  it("the overlay NEVER lands on a winner it did not record", () => {
    // flipPhase is the whole rule: a winner is shown only in "landed".
    expect(flipPhase({ animationDone: false, outcome: null })).toBe("flipping");
    expect(flipPhase({ animationDone: true, outcome: null })).toBe("recording");
    expect(flipPhase({ animationDone: true, outcome: { accepted: true } })).toBe("landed");
    expect(flipPhase({ animationDone: true, outcome: { accepted: false } })).toBe("declined");
    // A refused attempt can never produce the phase that crowns someone.
    const { session } = scenarioOne();
    const [{ a, b }] = pendingFlipPairs(pool0(session), session.players);
    const refused = attemptCoinFlip(session, "court-2", a, b, "nobody", 1);
    expect(flipPhase({ animationDone: true, outcome: { accepted: refused.accepted } }))
      .toBe("declined");
  });

  it("an accepted attempt returns the session to commit, with the flip recorded once", () => {
    const { session } = scenarioOne();
    const [{ a, b }] = pendingFlipPairs(pool0(session), session.players);
    const attempt = attemptCoinFlip(session, "court-2", a, b, b, 4_000);
    expect(attempt.accepted).toBe(true);
    if (!attempt.accepted) return;
    expect(attempt.winner).toBe(b);
    expect(attempt.session.pools[0].coinFlipResolutions)
      .toEqual([{ a, b, winner: b, at: 4_000 }]);
    expect(attempt.session).not.toBe(session); // the original is untouched
    expect(pool0(session).coinFlipResolutions).toBeUndefined();
  });
});
