// STEP 6.2 — group coin resolutions.
//
// The 6.1 review confirmed two high defects with one root cause: resolutions
// and the playoff gate only ever saw ADJACENT rows. A resolution went inert
// the moment a third player sorted between a flipped pair (the table showed
// the loser above the winner, with no route back), and a four-way tie
// straddling the cut cleared the gate after a single coin while alphabetical
// order decided who made the bracket.
//
// Both repros live here as regressions, alongside the procedure, the
// liveness rule, migration equivalence, and a sweep asserting the "inert"
// class is extinct.

import { describe, expect, it } from "vitest";
import type {
  AmericanoMatch, AmericanoPlayer, AmericanoPool, AmericanoScore, AmericanoSession,
} from "@/types/americano";
import { computeRecords, computeStandings, strengthOfSchedule, tiedGroup } from "../standings";
import { migrateAmericanoSession } from "../migrate";
import {
  applyCoinFlip, attemptCoinFlip, completeOrders, flipGroupOf, flipGroups,
  groupKey, isComplete, liveGroupRecords, lineOf, pendingFlips, poolStandings,
  pruneStaleFlips, replayGroup, unresolvedFlipsAffecting,
} from "../flips";

/* ── fixtures ────────────────────────────────────────────────────── */

const mkPlayers = (n: number, prefix = "t"): AmericanoPlayer[] =>
  Array.from({ length: n }, (_, i) => ({
    playerId: `${prefix}${String(i).padStart(2, "0")}`,
    displayName: `${prefix}${i}`, tier: "B" as const, status: "present" as const,
    joinedAtMatchIndex: null, catchUpUsed: false,
  }));

const M = (
  i: number, tA: [string, string], tB: [string, string],
  winner: "A" | "B" = "A", score: AmericanoScore = "2-1",
): AmericanoMatch => ({
  id: `court-2-m${i}`, poolId: "court-2", matchIndex: i, teamA: tA, teamB: tB,
  result: { winner, score }, status: "completed", phase: "round_robin",
  startedAt: i * 100, completedAt: i * 100 + 50,
});

const mkPool = (ids: string[], matches: AmericanoMatch[]): AmericanoPool => ({
  id: "court-2", label: "Court 2", playerIds: ids, targetMatches: 2,
  playoffMode: "top8", status: "round_robin", matches,
});

const sess = (pool: AmericanoPool, players: AmericanoPlayer[]): AmericanoSession => ({
  id: "n", date: "2026-08-12", sessionName: "", players, pools: [pool],
  isPractice: true, status: "active",
});

const P = (s: AmericanoSession) => s.pools[0];
const order = (s: AmericanoSession) => poolStandings(P(s), s.players).map((r) => r.playerId);
const rankOf = (s: AmericanoSession, id: string) => order(s).indexOf(id);

/** Eight players, two matches, team A wins both: t00,t01,t04,t05 form a true
    four-way tie (1W-0L, +1, SOS 0); the four losers form another. */
const fourWay = () => {
  const players = mkPlayers(8);
  const ids = players.map((p) => p.playerId);
  return sess(mkPool(ids, [
    M(1, [ids[0], ids[1]], [ids[2], ids[3]]),
    M(2, [ids[4], ids[5]], [ids[6], ids[7]]),
  ]), players);
};

/** Run every coin a group still needs, always landing on `pick`. */
function settle(s: AmericanoSession, pick: (a: string, b: string) => string): AmericanoSession {
  for (let guard = 0; guard < 40; guard++) {
    const pend = pendingFlips(P(s), s.players);
    if (pend.length === 0) break;
    const { a, b } = pend[0];
    const next = applyCoinFlip(s, "court-2", a, b, pick(a, b), 1_000 + guard);
    expect(next).not.toBe(s); // the offered flip must always be recordable
    s = next;
  }
  return s;
}

/* ── the procedure ───────────────────────────────────────────────── */

describe("the procedure: one visible flip at a time (STEP 6.2)", () => {
  it("a two-group is one coin; a three-group is two or three", () => {
    expect(replayGroup(["a", "b"], []).next).toEqual({ a: "b", b: "a" });
    expect(replayGroup(["a", "b"], [{ a: "b", b: "a", winner: "b", at: 1 }]))
      .toEqual({ order: ["b", "a"], next: null });

    // Three: candidate b flips against a; then c flips down the placed order.
    const one = [{ a: "b", b: "a", winner: "b", at: 1 }];
    expect(replayGroup(["a", "b", "c"], one).next).toEqual({ a: "c", b: "b" });
    // c beats the top on its first coin → settled in two.
    expect(replayGroup(["a", "b", "c"], [...one, { a: "c", b: "b", winner: "c", at: 2 }]))
      .toEqual({ order: ["c", "b", "a"], next: null });
    // c loses twice → exhausts and sits last, still only three coins total.
    const three = [...one, { a: "c", b: "b", winner: "b", at: 2 }, { a: "c", b: "a", winner: "a", at: 3 }];
    expect(replayGroup(["a", "b", "c"], three)).toEqual({ order: ["b", "a", "c"], next: null });
  });

  it("every offered flip is recordable, and settling terminates with a total order", () => {
    let s = fourWay();
    const groups = flipGroups(P(s), s.players);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveLength(4);

    s = settle(s, (a) => a); // always the candidate
    expect(pendingFlips(P(s), s.players)).toEqual([]);
    const rows = poolStandings(P(s), s.players);
    expect(rows.some((r) => r.requiresCoinFlip)).toBe(false);
    for (const rec of liveGroupRecords(P(s), s.players)) {
      expect(isComplete(rec)).toBe(true);
      expect([...rec.order].sort()).toEqual(rec.members);
    }
  });

  it("the badge counts coins remaining, and it falls to zero as they are run", () => {
    let s = fourWay();
    const total = () => pendingFlips(P(s), s.players).reduce((n, f) => n + f.remaining, 0);
    const first = total();
    expect(first).toBeGreaterThanOrEqual(6); // two four-groups, ≥3 coins each
    s = settle(s, (a, b) => b);
    expect(total()).toBe(0);
  });
});

/* ── the 6.1 repros, as regressions ──────────────────────────────── */

describe("REGRESSION 6.1-a: a live resolution can never be contradicted", () => {
  it("a third player joining the tie drops the pair record and re-flags fresh", () => {
    // Six players, one match: t01,t03 win; t04,t05 lose; t00,t02 sit at 0-0-0.
    const players = mkPlayers(6);
    const ids = players.map((p) => p.playerId);
    let s = sess(mkPool(ids, [M(1, [ids[1], ids[3]], [ids[4], ids[5]])]), players);

    const pair = flipGroupOf(P(s), "t00", s.players);
    expect(pair).toEqual(["t00", "t02"]);
    s = applyCoinFlip(s, "court-2", "t00", "t02", "t02", 1_000);
    expect(rankOf(s, "t02")).toBeLessThan(rankOf(s, "t00")); // the coin decides

    // VOID the only match: everyone collapses into one 0-0-0 group.
    const voided: AmericanoSession = {
      ...s,
      pools: s.pools.map((p) => ({
        ...p, matches: p.matches.map((m) => ({ ...m, status: "voided" as const })),
      })),
    };
    const after = pruneStaleFlips(voided);

    // The pair record is GONE — membership grew, so the whole record drops.
    expect(after.pools[0].groupFlipResolutions).toBeUndefined();
    expect(liveGroupRecords(P(after), after.players)).toEqual([]);
    expect(completeOrders(P(after), after.players).size).toBe(0);
    // The six now flag as one fresh group, and a coin is offered again.
    expect(flipGroups(P(after), after.players)[0]).toHaveLength(6);
    expect(pendingFlips(P(after), after.players)).toHaveLength(1);
    // The old verdict never resurrects: t00/t02's order is provisional again.
    expect(poolStandings(P(after), after.players).every((r) => r.requiresCoinFlip)).toBe(true);
  });

  it("at no point does the table show a live resolution's loser above its winner", () => {
    // The invariant, checked across a full settle and then a disruption.
    let s = fourWay();
    const holds = (x: AmericanoSession) => {
      const ranks = order(x);
      for (const rec of liveGroupRecords(P(x), x.players)) {
        for (let i = 0; i < rec.order.length - 1; i++) {
          if (!isComplete(rec)) continue; // incomplete orders are provisional
          expect(ranks.indexOf(rec.order[i])).toBeLessThan(ranks.indexOf(rec.order[i + 1]));
        }
      }
    };
    holds(s);
    for (let i = 0; i < 12; i++) {
      const pend = pendingFlips(P(s), s.players);
      if (pend.length === 0) break;
      s = applyCoinFlip(s, "court-2", pend[0].a, pend[0].b, pend[0].b, 2_000 + i);
      holds(s);
    }
    // Now disturb it: correct a result so one group's line moves.
    const corrected: AmericanoSession = {
      ...s,
      pools: s.pools.map((p) => ({
        ...p,
        matches: p.matches.map((m) =>
          m.id === "court-2-m1" ? { ...m, result: { winner: "A", score: "2-0" as AmericanoScore } } : m,
        ),
      })),
    };
    holds(pruneStaleFlips(corrected));
  });

  it("the converse churn: a trio shrinking to a pair drops the record, no resurrection", () => {
    const players = mkPlayers(6);
    const ids = players.map((p) => p.playerId);
    // t00,t02 and one more all at 0-0-0 initially (nobody has played).
    let s = sess(mkPool(ids, []), players);
    expect(flipGroups(P(s), s.players)[0]).toHaveLength(6);
    s = settle(s, (a) => a);
    expect(pendingFlips(P(s), s.players)).toEqual([]);
    const settledOrder = order(s);

    // A match is played: four players leave the 0-0-0 group entirely.
    const played: AmericanoSession = {
      ...s,
      pools: s.pools.map((p) => ({ ...p, matches: [M(1, [ids[0], ids[1]], [ids[2], ids[3]])] })),
    };
    const after = pruneStaleFlips(played);
    expect(after.pools[0].groupFlipResolutions).toBeUndefined(); // whole record dropped
    // The remaining pair must flip afresh rather than inherit the old order.
    const remaining = flipGroupOf(P(after), ids[4], after.players);
    expect(remaining).toEqual([ids[4], ids[5]]);
    expect(pendingFlips(P(after), after.players).some((f) =>
      groupKey(f.members) === groupKey(remaining))).toBe(true);
    void settledOrder;
  });
});

describe("REGRESSION 6.1-b: the gate blocks until the group is ORDERED", () => {
  it("a four-way tie straddling the cut keeps blocking after one coin", () => {
    let s = fourWay();
    const winners = flipGroups(P(s), s.players)[0];
    expect(winners).toHaveLength(4);

    // Cut at 2 puts the four-way group across the line.
    const gate0 = unresolvedFlipsAffecting(P(s), s.players, 2);
    expect(gate0).toHaveLength(1);
    expect(gate0[0].reason).toBe("cut_line");

    // Run ONE coin — the old pairwise gate went empty here.
    const first = pendingFlips(P(s), s.players)[0];
    s = applyCoinFlip(s, "court-2", first.a, first.b, first.b, 5_000);
    const gate1 = unresolvedFlipsAffecting(P(s), s.players, 2);
    expect(gate1).toHaveLength(1);
    expect(gate1[0].reason).toBe("cut_line");

    // Only a COMPLETE order clears it.
    s = settle(s, (a, b) => b);
    expect(unresolvedFlipsAffecting(P(s), s.players, 2)).toEqual([]);
  });

  it("wholly-inside groups read seed_order; wholly-below groups never block", () => {
    const s = fourWay();
    const atFour = unresolvedFlipsAffecting(P(s), s.players, 4);
    expect(atFour).toHaveLength(1);
    expect(atFour[0].reason).toBe("seed_order"); // the winners' group only
    expect(unresolvedFlipsAffecting(P(s), s.players, 8).length).toBe(2);
    expect(unresolvedFlipsAffecting(P(s), s.players, 0)).toEqual([]);
  });
});

/* ── liveness, refusals, migration ───────────────────────────────── */

describe("liveness and refusals (STEP 6.2)", () => {
  it("a moved line drops the record even when the membership is identical", () => {
    let s = fourWay();
    s = settle(s, (a) => a);
    const rec = liveGroupRecords(P(s), s.players)[0];
    const stale: AmericanoSession = {
      ...s,
      pools: s.pools.map((p) => ({
        ...p,
        groupFlipResolutions: (p.groupFlipResolutions ?? []).map((r) =>
          groupKey(r.members) === groupKey(rec.members)
            ? { ...r, line: { ...r.line, sos: r.line.sos + 1 } }
            : r,
        ),
      })),
    };
    expect(liveGroupRecords(P(stale), stale.players).length)
      .toBe((stale.pools[0].groupFlipResolutions ?? []).length - 1);
    expect(pruneStaleFlips(stale).pools[0].groupFlipResolutions?.length)
      .toBe((stale.pools[0].groupFlipResolutions ?? []).length - 1);
  });

  it("refuses a coin that is not the one the procedure is asking for", () => {
    const s = fourWay();
    const [g] = flipGroups(P(s), s.players);
    const next = pendingFlips(P(s), s.players)[0];
    const bystander = g.find((id) => id !== next.a && id !== next.b)!;

    expect(attemptCoinFlip(s, "court-2", next.a, bystander, next.a, 1))
      .toMatchObject({ accepted: false, reason: "not_the_next_flip" });
    expect(attemptCoinFlip(s, "court-2", next.a, next.b, "nobody", 1))
      .toMatchObject({ accepted: false, reason: "bad_winner" });
    expect(attemptCoinFlip(s, "nope", next.a, next.b, next.a, 1))
      .toMatchObject({ accepted: false, reason: "unknown_pool" });

    const settled = settle(s, (a) => a);
    const done = flipGroups(P(settled), settled.players)[0];
    expect(attemptCoinFlip(settled, "court-2", done[0], done[1], done[0], 9))
      .toMatchObject({ accepted: false, reason: "already_resolved" });
  });
});

describe("migration from pairwise resolutions (STEP 6.2)", () => {
  it("a legacy pair becomes a two-member group and orders identically", () => {
    const players = mkPlayers(6);
    const ids = players.map((p) => p.playerId);
    const pool = mkPool(ids, [M(1, [ids[1], ids[3]], [ids[4], ids[5]])]);
    // A v7 envelope: the old pairwise shape, t02 beat t00 on the coin.
    const legacy = {
      ...sess(pool, players),
      pools: [{ ...pool, coinFlipResolutions: [{ a: "t00", b: "t02", winner: "t02", at: 42 }] }],
    };
    const healed = migrateAmericanoSession(legacy, "2026-08-12")!;
    const rec = healed.pools[0].groupFlipResolutions!;
    expect(healed.pools[0].coinFlipResolutions).toBeUndefined();
    expect(rec).toHaveLength(1);
    expect(rec[0].members).toEqual(["t00", "t02"]);
    expect(rec[0].order).toEqual(["t02", "t00"]);
    expect(rec[0].flips).toEqual([{ a: "t00", b: "t02", winner: "t02", at: 42 }]);

    // Byte-equivalent behaviour: live, complete, and ordering the table the
    // way the old pairwise model did.
    expect(liveGroupRecords(healed.pools[0], healed.players)).toHaveLength(1);
    expect(isComplete(rec[0])).toBe(true);
    const rows = poolStandings(healed.pools[0], healed.players);
    expect(rows.findIndex((r) => r.playerId === "t02"))
      .toBeLessThan(rows.findIndex((r) => r.playerId === "t00"));
    expect(rows.find((r) => r.playerId === "t02")!.tiebreakApplied).toBe("coinflip");
    // Only THIS pair is settled — the winners and losers of match 1 are their
    // own tied groups and still await their own coins.
    expect(rows.find((r) => r.playerId === "t02")!.requiresCoinFlip).toBe(false);
    expect(rows.find((r) => r.playerId === "t00")!.requiresCoinFlip).toBe(false);
    // And it round-trips.
    expect(JSON.parse(JSON.stringify(healed))).toEqual(healed);
  });

  it("a legacy pair whose tie has since dissolved simply drops", () => {
    const players = mkPlayers(6);
    const ids = players.map((p) => p.playerId);
    const pool = mkPool(ids, [M(1, [ids[0], ids[1]], [ids[2], ids[3]])]);
    const legacy = {
      ...sess(pool, players),
      pools: [{ ...pool, coinFlipResolutions: [{ a: ids[0], b: ids[2], winner: ids[2], at: 7 }] }],
    };
    const healed = migrateAmericanoSession(legacy, "2026-08-12")!;
    // t00 won and t02 lost — they are not tied, so nothing is live.
    expect(liveGroupRecords(healed.pools[0], healed.players)).toEqual([]);
    expect(pruneStaleFlips(healed).pools[0].groupFlipResolutions).toBeUndefined();
  });
});

/* ── the sweep ───────────────────────────────────────────────────── */

describe("SWEEP: the inert-resolution class is extinct (STEP 6.2)", () => {
  it("no reachable state has a live resolution failing to determine its order", () => {
    const rng = (seed: number) => {
      let x = seed >>> 0;
      return () => { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; return x / 4294967296; };
    };
    let checked = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const r = rng(seed);
      const players = mkPlayers(12, "s");
      const ids = players.map((p) => p.playerId);
      const matches: AmericanoMatch[] = [];
      for (let i = 1; i <= 6; i++) {
        const pick = [...ids].sort(() => r() - 0.5).slice(0, 4);
        matches.push(M(i, [pick[0], pick[1]], [pick[2], pick[3]],
          r() < 0.5 ? "A" : "B", r() < 0.5 ? "2-0" : "2-1"));
      }
      let s = sess(mkPool(ids, matches), players);
      s = settle(s, (a, b) => (r() < 0.5 ? a : b));

      // Disturb every way a night can be disturbed, then assert the invariant.
      for (const m of P(s).matches) {
        for (const mutate of ["void", "flip"] as const) {
          const changed: AmericanoSession = {
            ...s,
            pools: s.pools.map((p) => ({
              ...p,
              matches: p.matches.map((x) =>
                x.id !== m.id ? x
                  : mutate === "void" ? { ...x, status: "voided" as const }
                  : { ...x, result: { winner: x.result!.winner === "A" ? "B" as const : "A" as const, score: x.result!.score } },
              ),
            })),
          };
          const pruned = pruneStaleFlips(changed);
          const ranks = order(pruned);
          for (const rec of liveGroupRecords(P(pruned), pruned.players)) {
            if (!isComplete(rec)) continue;
            // A live, complete record MUST determine its group's order.
            for (let i = 0; i < rec.order.length - 1; i++) {
              expect(ranks.indexOf(rec.order[i]))
                .toBeLessThan(ranks.indexOf(rec.order[i + 1]));
            }
            // …and its members must still be exactly a current group.
            expect(flipGroups(P(pruned), pruned.players).map(groupKey))
              .toContain(groupKey(rec.members));
            checked++;
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(50); // the sweep actually exercised records
  });
});

describe("computeStandings ignores an order that does not cover its group", () => {
  it("a partial order is refused at the boundary, not applied half-way", () => {
    // completeOrders() only ever hands over finished orders, but the contract
    // belongs to computeStandings: a half-built order must never reshuffle a
    // group, or a group mid-flip would show a provisional verdict as final.
    const s = fourWay();
    const members = flipGroups(P(s), s.players)[0];
    const provisional = computeStandings(P(s), s.players).map((r) => r.playerId);
    const partial = new Map([[groupKey(members), [members[3], members[0]]]]);
    const withPartial = computeStandings(P(s), s.players, partial).map((r) => r.playerId);
    expect(withPartial).toEqual(provisional);

    // The complete order for the same group IS applied.
    const full = new Map([[groupKey(members), [...members].reverse()]]);
    const applied = computeStandings(P(s), s.players, full).map((r) => r.playerId);
    expect(applied.slice(0, 4)).toEqual([...members].reverse());
  });
});

/* ── 6.1's pin still holds ───────────────────────────────────────── */

describe("the shared tie predicate is still the single definition", () => {
  it("flipGroupOf agrees with tiedGroup + SOS + the arity rule", () => {
    const s = fourWay();
    for (const members of flipGroups(P(s), s.players)) {
      const records = computeRecords(P(s));
      for (const id of members) {
        expect(tiedGroup(P(s), members[0], records, s.players)).toContain(id);
        expect(strengthOfSchedule(P(s), id)).toBe(strengthOfSchedule(P(s), members[0]));
      }
      expect(lineOf(P(s), members).sos).toBe(strengthOfSchedule(P(s), members[0]));
    }
  });
});
