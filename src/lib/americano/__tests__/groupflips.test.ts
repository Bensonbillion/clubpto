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
import { DEFAULT_FORMAT } from "../format";
import type {
  AmericanoMatch, AmericanoPlayer, AmericanoPool, AmericanoSession,
} from "@/types/americano";
import { computeRecords, computeStandings, strengthOfSchedule, tiedGroup } from "../standings";
import { migrateAmericanoSession } from "../migrate";
import {
  applyCoinFlip, attemptCoinFlip, completeOrders, flipGroupOf, flipGroups,
  groupKey, isBlankSlate, isComplete, liveGroupRecords, lineOf, pendingFlips, poolStandings,
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
  winner: "A" | "B" = "A", setsLost = 1,
): AmericanoMatch => ({
  id: `court-2-m${i}`, poolId: "court-2", matchIndex: i, teamA: tA, teamB: tB,
  result: { winner, setsLost }, status: "completed", phase: "round_robin",
  startedAt: i * 100, completedAt: i * 100 + 50,
});

const mkPool = (ids: string[], matches: AmericanoMatch[]): AmericanoPool => ({
  id: "court-2", label: "Court 2", playerIds: ids, targetMatches: 2,
  playoffMode: "top8", status: "round_robin", matches, matchFormat: DEFAULT_FORMAT,
});

const sess = (pool: AmericanoPool, players: AmericanoPlayer[]): AmericanoSession => ({
  id: "n", date: "2026-08-12", sessionName: "", players, pools: [pool],
  defaultMatchFormat: DEFAULT_FORMAT, isPractice: true, status: "active",
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

describe("blank-slate groups are not ties (STEP G, Part 0)", () => {
  it("a sixteen-player court offers ZERO coins before anyone has played", () => {
    const players = mkPlayers(16);
    const pool = mkPool(players.map((p) => p.playerId), []);
    // Everyone is 0-0-0 with SOS 0 — technically one enormous tied group.
    // Nothing has happened, so nothing is tied.
    expect(isBlankSlate(pool, players.map((p) => p.playerId))).toBe(true);
    expect(flipGroups(pool, players)).toEqual([]);
    expect(pendingFlips(pool, players)).toEqual([]);
    expect(computeStandings(pool, players).some((r) => r.requiresCoinFlip)).toBe(false);
    expect(unresolvedFlipsAffecting(pool, players, 8)).toEqual([]);
  });

  it("late arrivals still at 0-0-0 mid-night are never flagged", () => {
    // Six have played; two walked in and have not. The played six tie among
    // themselves as usual; the two arrivals are a blank set, not a tie.
    const players = mkPlayers(8);
    const ids = players.map((p) => p.playerId);
    const pool = mkPool(ids, [
      M(1, [ids[0], ids[1]], [ids[2], ids[3]]),
      M(2, [ids[4], ids[5]], [ids[2], ids[3]]),
    ]);
    expect(isBlankSlate(pool, [ids[6], ids[7]])).toBe(true);
    const groups = flipGroups(pool, players).map(groupKey);
    expect(groups).not.toContain(groupKey([ids[6], ids[7]]));
    const rows = computeStandings(pool, players, completeOrders(pool, players));
    for (const id of [ids[6], ids[7]]) {
      expect(rows.find((r) => r.playerId === id)!.requiresCoinFlip).toBe(false);
    }
    // …and a coin cannot be forced onto them.
    const s = sess(pool, players);
    expect(attemptCoinFlip(s, "court-2", ids[6], ids[7], ids[6], 1))
      .toMatchObject({ accepted: false, reason: "blank_slate" });
  });

  it("one played match is enough to make a group real again", () => {
    const players = mkPlayers(8);
    const ids = players.map((p) => p.playerId);
    const pool = mkPool(ids, [M(1, [ids[0], ids[1]], [ids[2], ids[3]])]);
    // The four who played form two genuine groups; the four who did not are
    // still blank.
    expect(isBlankSlate(pool, [ids[0], ids[1]])).toBe(false);
    expect(isBlankSlate(pool, [ids[4], ids[5], ids[6], ids[7]])).toBe(true);
    const keys = flipGroups(pool, players).map(groupKey);
    expect(keys).toContain(groupKey([ids[0], ids[1]]));
    expect(keys).not.toContain(groupKey([ids[4], ids[5], ids[6], ids[7]]));
  });
});

/* ── the 6.1 repros, as regressions ──────────────────────────────── */

describe("REGRESSION 6.1-a: a live resolution can never be contradicted", () => {
  it("a third player joining the tie drops the pair record and re-flags fresh", () => {
    // Six players, two matches. t00 and t02 end 1W-1L +0 with equal SOS and a
    // split head-to-head — a genuine two-group WITH history (a blank 0-0-0
    // set is no longer a tie at all, STEP G Part 0).
    const players = mkPlayers(6);
    const ids = players.map((p) => p.playerId);
    let s = sess(mkPool(ids, [
      M(1, [ids[0], ids[1]], [ids[2], ids[3]]),  // t00,t01 beat t02,t03
      M(2, [ids[2], ids[4]], [ids[0], ids[5]]),  // t02,t04 beat t00,t05
    ]), players);

    const pair = flipGroupOf(P(s), "t00", s.players);
    expect(pair).toEqual(["t00", "t02"]);
    expect(pendingFlips(P(s), s.players).some((f) =>
      groupKey(f.members) === groupKey(pair))).toBe(true);
    s = applyCoinFlip(s, "court-2", "t00", "t02", "t02", 1_000);
    expect(rankOf(s, "t02")).toBeLessThan(rankOf(s, "t00")); // the coin decides
    expect(liveGroupRecords(P(s), s.players)).toHaveLength(1);

    // VOID match 1: both of them land in DIFFERENT groups, each with a third
    // player who never flipped against anyone.
    const voided: AmericanoSession = {
      ...s,
      pools: s.pools.map((p) => ({
        ...p,
        matches: p.matches.map((m) =>
          m.id === "court-2-m1" ? { ...m, status: "voided" as const } : m),
      })),
    };
    const after = pruneStaleFlips(voided);

    // The pair record is GONE — membership moved, so the whole record drops.
    expect(after.pools[0].groupFlipResolutions).toBeUndefined();
    expect(liveGroupRecords(P(after), after.players)).toEqual([]);
    expect(completeOrders(P(after), after.players).size).toBe(0);
    expect(flipGroupOf(P(after), "t00", after.players)).not.toContain("t02");
    // The old verdict never resurrects: fresh coins are offered instead.
    expect(pendingFlips(P(after), after.players).length).toBeGreaterThan(0);
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
          m.id === "court-2-m1" ? { ...m, result: { winner: "A" as const, setsLost: 0 } } : m,
        ),
      })),
    };
    holds(pruneStaleFlips(corrected));
  });

  it("the converse churn: a trio shrinking to a pair drops the record, no resurrection", () => {
    // Eight players, two matches: the four winners are one tied group of four
    // (WITH history). Settle it, then break the tie so the group shrinks.
    let s = fourWay();
    s = settle(s, (a) => a);
    expect(pendingFlips(P(s), s.players)).toEqual([]);
    const before = liveGroupRecords(P(s), s.players);
    expect(before.length).toBeGreaterThan(0);

    // Correct match 1 to a 2-0: its two winners move to a different diff, so
    // the four-group becomes two-and-two and every record covering it dies.
    const corrected: AmericanoSession = {
      ...s,
      pools: s.pools.map((p) => ({
        ...p,
        matches: p.matches.map((m) =>
          m.id === "court-2-m1" ? { ...m, result: { winner: "A" as const, setsLost: 0 } } : m),
      })),
    };
    const after = pruneStaleFlips(corrected);
    const survivors = after.pools[0].groupFlipResolutions ?? [];
    expect(survivors.some((r) => r.members.length === 4)).toBe(false);
    // The smaller groups must flip AFRESH rather than inherit the old order.
    for (const members of flipGroups(P(after), after.players)) {
      const rec = liveGroupRecords(P(after), after.players)
        .find((r) => groupKey(r.members) === groupKey(members));
      if (!rec) {
        expect(pendingFlips(P(after), after.players)
          .some((f) => groupKey(f.members) === groupKey(members))).toBe(true);
      }
    }
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
  it("a moved line (points or diff) drops the record even when membership is identical", () => {
    let s = fourWay();
    s = settle(s, (a) => a);
    const rec = liveGroupRecords(P(s), s.players)[0];
    const stale: AmericanoSession = {
      ...s,
      pools: s.pools.map((p) => ({
        ...p,
        groupFlipResolutions: (p.groupFlipResolutions ?? []).map((r) =>
          groupKey(r.members) === groupKey(rec.members)
            ? { ...r, line: { ...r.line, diff: r.line.diff + 1 } }
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
    const pool = mkPool(ids, [
      M(1, [ids[0], ids[1]], [ids[2], ids[3]]),
      M(2, [ids[2], ids[4]], [ids[0], ids[5]]),
    ]);
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
          r() < 0.5 ? "A" : "B", r() < 0.5 ? 0 : 1));
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
                  : { ...x, result: { winner: x.result!.winner === "A" ? "B" as const : "A" as const, setsLost: (x.result as { setsLost: number }).setsLost } },
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

/* ── the close-out walk's defect ─────────────────────────────────── */

describe("the offered coin is keyed by CANDIDATE, never by table adjacency", () => {
  // Walk repro: a live record {c0,c1,c11} with order ["c0","c1"] still owed a
  // coin — c11 against c0 — but c1 sorted BETWEEN them, so a UI that only drew
  // the button when the opponent was the next row rendered nothing. The badge
  // read "2 flips to run" with no way to run them and the playoff gate, which
  // waits on the same records, could never clear.
  it("a group strands if the offer needs the opponent on the next row", () => {
    let s = fourWay();
    const members = flipGroups(P(s), s.players)[0];
    expect(members.length).toBeGreaterThanOrEqual(3);

    let sawNonAdjacent = false;
    for (let guard = 0; guard < 40; guard++) {
      const pend = pendingFlips(P(s), s.players);
      if (pend.length === 0) break;

      const rows = poolStandings(P(s), s.players).map((r) => r.playerId);
      for (const { a, b } of pend) {
        // The FIX: one offer per candidate, so the button always has a home.
        expect(rows).toContain(a);
        expect(rows).toContain(b);
        if (Math.abs(rows.indexOf(a) - rows.indexOf(b)) !== 1) {
          sawNonAdjacent = true;
          // …and here is the defect itself: the old rule drew the button only
          // on the row directly above its partner, so this coin had no button.
          const drawnByOldRule = rows.some((id, i) =>
            (id === a && rows[i + 1] === b) || (id === b && rows[i + 1] === a));
          expect(drawnByOldRule).toBe(false);
        }
      }
      // Candidates are unique, so a candidate-keyed map never loses an offer.
      expect(new Set(pend.map((p) => p.a)).size).toBe(pend.length);

      // Insert the candidate BELOW its opponent — this is what pushes a later
      // opponent away from the adjacent row.
      s = applyCoinFlip(s, "court-2", pend[0].a, pend[0].b, pend[0].b, 2_000 + guard);
    }

    // The stranding case is real, not hypothetical: at least one offered coin
    // named an opponent that was not the neighbouring row.
    expect(sawNonAdjacent).toBe(true);
    // And the group still resolves all the way to a complete order.
    expect(pendingFlips(P(s), s.players)).toEqual([]);
    for (const rec of liveGroupRecords(P(s), s.players)) expect(isComplete(rec)).toBe(true);
  });
});
