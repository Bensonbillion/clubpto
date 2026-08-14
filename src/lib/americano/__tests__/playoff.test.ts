// STEP 7 — the playoff module, through the production reducers.
//
// The bracket is locked by the brief, so most of what matters here is what
// the system REFUSES: it will not seed while a coin the bracket depends on is
// unresolved, it will not lock while a round-robin match is still on court,
// and it will not let a semi be rewritten under a final that was played from
// it. Those refusals are the tests.

import { describe, expect, it } from "vitest";
import type {
  AmericanoMatch, AmericanoPlayer, AmericanoPool, AmericanoSession, MatchFormat,
} from "@/types/americano";
import { DEFAULT_FORMAT, resultNotation } from "../format";
import { applyCoinFlip, pendingFlips, poolStandings, unresolvedFlipsAffecting } from "../flips";
import { applyResult, applyVoid, ensureLive } from "../live";
import {
  advanceBracket, awaitingPendingMatch, cancelPlayoff, championTitle, courtBorrowAvailable,
  crownFromBracket, declinePlayoff, eligibility, endCourtIndividual, lockPlayoff,
  playoffBlockers, playoffCorrectionBlock, playoffModeFor, planPlayoff, regressBracket,
  requestPlayoff,
} from "../playoff";
import { PTO_POINTS_V1 } from "@/clubhouse/publish/types";

/* ── fixtures ────────────────────────────────────────────────────── */

const mkPlayers = (n: number, prefix = "p"): AmericanoPlayer[] =>
  Array.from({ length: n }, (_, i) => ({
    playerId: `${prefix}${String(i).padStart(2, "0")}`,
    displayName: `${prefix}${i}`, tier: "B" as const, status: "present" as const,
    joinedAtMatchIndex: null, catchUpUsed: false,
  }));

const mkPool = (
  ids: string[], matches: AmericanoMatch[], format: MatchFormat = DEFAULT_FORMAT,
): AmericanoPool => ({
  id: "court-2", label: "Court 2", playerIds: ids, targetMatches: 3,
  playoffMode: "top8", status: "round_robin", matches, matchFormat: format,
});

const sess = (pool: AmericanoPool, players: AmericanoPlayer[]): AmericanoSession => ({
  id: "n", date: "2026-08-13", sessionName: "", players, pools: [pool],
  defaultMatchFormat: pool.matchFormat, isPractice: true, status: "active",
});

const P = (s: AmericanoSession) => s.pools[0];

/** A finished 16 @ 3 night, results varied so the chain really separates. */
function playedNight(target = 3, n = 16): AmericanoSession {
  const players = mkPlayers(n);
  let s = sess(mkPool(players.map((p) => p.playerId), []), players);
  s = { ...s, pools: [{ ...P(s), targetMatches: target }] };
  let clock = 0;
  for (let step = 0; step < 60; step++) {
    s = ensureLive(s, clock);
    const live = P(s).matches.find((m) => m.status === "active");
    if (!live) break;
    s = applyResult(s, live.id, { winner: step % 3 ? "A" : "B", setsLost: step % 2 }, clock + 60_000);
    clock += 60_000;
  }
  return s;
}

/** A night stopped mid-flow, with a match still on court. */
function partialNight(stopAfter: number, target = 4, n = 16): AmericanoSession {
  const players = mkPlayers(n);
  let s = sess(mkPool(players.map((p) => p.playerId), []), players);
  s = { ...s, pools: [{ ...P(s), targetMatches: target }] };
  let clock = 0;
  for (let step = 0; step < stopAfter; step++) {
    s = ensureLive(s, clock);
    const live = P(s).matches.find((m) => m.status === "active");
    if (!live) break;
    s = applyResult(s, live.id, { winner: step % 3 ? "A" : "B", setsLost: step % 2 }, clock + 60_000);
    clock += 60_000;
  }
  return ensureLive(s, clock + 1_000); // leaves one match ON COURT
}

/** Settle every coin so the gate is clear. */
function settleAll(s: AmericanoSession): AmericanoSession {
  for (let g = 0; g < 60; g++) {
    const pend = pendingFlips(P(s), s.players);
    if (pend.length === 0) break;
    s = applyCoinFlip(s, "court-2", pend[0].a, pend[0].b, pend[0].a, 9_000 + g);
  }
  return s;
}

/* ── eligibility ─────────────────────────────────────────────────── */

describe("eligibility: leader − 1 (STEP 7)", () => {
  it("a full night excludes nobody", () => {
    const s = playedNight();
    const e = eligibility(P(s), s.players);
    expect(e.leaderMatches).toBe(3);
    expect(e.minimum).toBe(2);
    expect(e.excluded).toEqual([]);
    expect(e.eligible).toHaveLength(16);
  });

  it("a very late arrival is excluded, and named with their count", () => {
    const s = playedNight();
    // A late arrival with a single match, added after the night ran.
    const late: AmericanoPlayer = {
      playerId: "late", displayName: "Late", tier: "B", status: "present",
      joinedAtMatchIndex: 10, catchUpUsed: false,
    };
    const withLate: AmericanoSession = {
      ...s,
      players: [...s.players, late],
      pools: [{ ...P(s), playerIds: [...P(s).playerIds, "late"] }],
    };
    const e = eligibility(P(withLate), withLate.players);
    expect(e.excluded.map((x) => x.playerId)).toContain("late");
    expect(e.excluded.find((x) => x.playerId === "late")!.matchesPlayed).toBe(0);
    expect(e.eligible.some((r) => r.playerId === "late")).toBe(false);
  });

  it("scales: 12+ eligible runs top 8, 8-11 runs top 4, fewer runs neither", () => {
    expect(playoffModeFor(16)).toBe("top8");
    expect(playoffModeFor(12)).toBe("top8");
    expect(playoffModeFor(11)).toBe("top4");
    expect(playoffModeFor(9)).toBe("top4");
    expect(playoffModeFor(8)).toBe("top4");
    expect(playoffModeFor(7)).toBeNull();
  });
});

/* ── the gate ────────────────────────────────────────────────────── */

describe("the gate: seeds cannot lock over an unresolved coin (STEP 7)", () => {
  it("a four-way tie straddling the cut blocks until its order COMPLETES", () => {
    // The 6.2 scenario, now guarding a bracket: eight players, two matches,
    // the four winners are one tied group and the cut at 4 runs through them.
    const players = mkPlayers(8, "t");
    const ids = players.map((p) => p.playerId);
    const M = (i: number, a: [string, string], b: [string, string]): AmericanoMatch => ({
      id: `court-2-m${i}`, poolId: "court-2", matchIndex: i, teamA: a, teamB: b,
      result: { winner: "A", setsLost: 1 }, status: "completed", phase: "round_robin",
      startedAt: i * 100, completedAt: i * 100 + 50,
    });
    let s = sess(mkPool(ids, [
      M(1, [ids[0], ids[1]], [ids[2], ids[3]]),
      M(2, [ids[4], ids[5]], [ids[6], ids[7]]),
    ]), players);

    // Eight eligible → top 4, so the cut runs through the four winners.
    const plan0 = planPlayoff(P(s), s.players, 1_000);
    expect(plan0.status).toBe("blocked_by_flips");
    expect(plan0.status === "ready" ? [] : plan0.blockers).not.toHaveLength(0);
    expect(lockPlayoff(s, "court-2", 1_000)).toBe(s); // refuses to write

    // One coin is not enough — the group's order must COMPLETE.
    const first = pendingFlips(P(s), s.players)[0];
    s = applyCoinFlip(s, "court-2", first.a, first.b, first.b, 2_000);
    expect(playoffBlockers(P(s), s.players, "top4").length).toBeGreaterThan(0);

    s = settleAll(s);
    expect(planPlayoff(P(s), s.players, 3_000).status).toBe("ready");
  });

  it("blank-slate groups never block a bracket", () => {
    // Nobody has played: there is no tie, so the gate is silent — it is the
    // eligibility count that refuses, not a phantom coin.
    const players = mkPlayers(16);
    const s = sess(mkPool(players.map((p) => p.playerId), []), players);
    expect(unresolvedFlipsAffecting(P(s), s.players, 8)).toEqual([]);
    expect(playoffBlockers(P(s), s.players, "top8")).toEqual([]);
  });

  it("a settled night plans cleanly, with SOS- and coin-decided seeds recorded", () => {
    const s = settleAll(playedNight());
    const plan = planPlayoff(P(s), s.players, 5_000);
    if (plan.status !== "ready") throw new Error("expected a ready plan");
    const rows = poolStandings(P(s), s.players);
    // The seeds ARE the standings, annotation and all — the audit trail.
    expect(plan.snapshot.seeds.map((x) => x.playerId)).toEqual(rows.slice(0, 8).map((r) => r.playerId));
    expect(plan.snapshot.seeds.map((x) => x.seed)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const seed of plan.snapshot.seeds) {
      const row = rows.find((r) => r.playerId === seed.playerId)!;
      expect(seed.tiebreakApplied).toBe(row.tiebreakApplied);
    }
    expect(plan.snapshot.seeds.some((x) => x.tiebreakApplied !== null)).toBe(true);
  });
});

/* ── the pending match ───────────────────────────────────────────── */

describe("early trigger with a match still on court (STEP 7)", () => {
  it("the pending match finishes and counts before seeds can lock", () => {
    // Eight matches in, one still on court — the real early-valve moment.
    let s = partialNight(8);
    const live = P(s).matches.find((m) => m.status === "active")!;
    s = requestPlayoff(s, "court-2");
    expect(P(s).status).toBe("playoff_pending");
    expect(awaitingPendingMatch(P(s))).toBe(true);
    // No new round-robin matches: ensureLive must not generate for this pool.
    const beforeCount = P(s).matches.length;
    s = ensureLive(s, 501_000);
    expect(P(s).matches).toHaveLength(beforeCount);
    // And seeds cannot lock yet.
    expect(lockPlayoff(s, "court-2", 502_000)).toBe(s);

    // The match finishes and COUNTS.
    s = applyResult(s, live.id, { winner: "A", setsLost: 0 }, 503_000);
    expect(awaitingPendingMatch(P(s))).toBe(false);
    expect(P(s).matches.find((m) => m.id === live.id)!.status).toBe("completed");
    s = settleAll(s);
    const locked = lockPlayoff(s, "court-2", 504_000);
    expect(locked.pools[0].playoff).toBeDefined();
  });

  it("refuses to lock while a match is on court, EVEN with every coin settled", () => {
    // Isolates the pending-match guard: with the gate clear, the only thing
    // left standing between the trigger and the bracket is the live match.
    let s = settleAll(partialNight(8));
    expect(playoffBlockers(P(s), s.players, "top8")).toEqual([]);
    expect(P(s).matches.some((m) => m.status === "active")).toBe(true);
    expect(planPlayoff(P(s), s.players, 1).status).toBe("ready"); // the plan is fine…
    expect(lockPlayoff(s, "court-2", 600_000)).toBe(s);    // …the write is not

    // Finish it and the same call succeeds.
    const live = P(s).matches.find((m) => m.status === "active")!;
    s = applyResult(s, live.id, { winner: "A", setsLost: 0 }, 601_000);
    s = settleAll(s);
    expect(lockPlayoff(s, "court-2", 602_000).pools[0].playoff).toBeDefined();
  });

  it("the trigger is reversible while nothing is locked", () => {
    let s = partialNight(6);
    s = requestPlayoff(s, "court-2");
    expect(P(s).status).toBe("playoff_pending");
    s = cancelPlayoff(s, "court-2");
    expect(P(s).status).toBe("round_robin");
  });
});

/* ── the locked bracket ──────────────────────────────────────────── */

describe("pairing and the crossed bracket are LOCKED (STEP 7)", () => {
  it("top 8: pairs 1+3, 2+4, 5+7, 6+8 and SF1 = (1+3) v (6+8)", () => {
    const s = settleAll(playedNight());
    const locked = lockPlayoff(s, "court-2", 6_000);
    const pool = locked.pools[0];
    const snap = pool.playoff!;
    expect(snap.mode).toBe("top8");
    expect(snap.pairs.map((p) => p.seeds)).toEqual([[1, 3], [2, 4], [5, 7], [6, 8]]);

    const seedOf = new Map(snap.seeds.map((x) => [x.seed, x.playerId] as const));
    const sf1 = pool.matches.find((m) => m.phase === "playoff_sf1")!;
    const sf2 = pool.matches.find((m) => m.phase === "playoff_sf2")!;
    expect(sf1.teamA).toEqual([seedOf.get(1), seedOf.get(3)]);
    expect(sf1.teamB).toEqual([seedOf.get(6), seedOf.get(8)]);  // crossed
    expect(sf2.teamA).toEqual([seedOf.get(2), seedOf.get(4)]);
    expect(sf2.teamB).toEqual([seedOf.get(5), seedOf.get(7)]);
    expect(pool.status).toBe("playoff");
    expect(JSON.parse(JSON.stringify(locked))).toEqual(locked); // round-trips
  });

  it("nine eligible scales to top 4: one final, 1+3 versus 2+4", () => {
    // Nine players at target 2 — a small pool that still finishes cleanly.
    const players = mkPlayers(9, "q");
    let s = sess(mkPool(players.map((p) => p.playerId), []), players);
    s = { ...s, pools: [{ ...P(s), targetMatches: 2 }] };
    let clock = 0;
    for (let step = 0; step < 40; step++) {
      s = ensureLive(s, clock);
      const live = P(s).matches.find((m) => m.status === "active");
      if (!live) break;
      s = applyResult(s, live.id, { winner: step % 2 ? "A" : "B", setsLost: step % 2 }, clock + 60_000);
      clock += 60_000;
    }
    s = settleAll(s);
    const e = eligibility(P(s), s.players);
    expect(playoffModeFor(e.eligible.length)).toBe("top4");
    const locked = lockPlayoff(s, "court-2", 7_000);
    const snap = locked.pools[0].playoff!;
    expect(snap.mode).toBe("top4");
    expect(snap.pairs.map((p) => p.seeds)).toEqual([[1, 3], [2, 4]]);
    const bracket = locked.pools[0].matches.filter((m) => m.phase.startsWith("playoff"));
    expect(bracket).toHaveLength(1);
    expect(bracket[0].phase).toBe("playoff_final");
  });

  it("the bracket carries its own format, and renders in that notation", () => {
    const s = settleAll(playedNight());
    const override: MatchFormat = { kind: "singleGame", targetPoints: 11 };
    const locked = lockPlayoff(s, "court-2", 8_000, override);
    const pool = locked.pools[0];
    expect(pool.playoff!.format).toEqual(override);
    for (const m of pool.matches.filter((x) => x.phase.startsWith("playoff"))) {
      expect(m.format).toEqual(override);
      expect(resultNotation(m.format!, { winner: "A", loserPoints: 4 })).toBe("11–4");
    }
    // The round robin behind it still reads in ITS format.
    const rr = pool.matches.find((m) => m.phase === "round_robin")!;
    expect(resultNotation(pool.matchFormat, rr.result!)).toMatch(/^2–[01]$/);
  });
});

/* ── running it ──────────────────────────────────────────────────── */

describe("bracket play, corrections and the champion (STEP 7)", () => {
  const toFinal = () => {
    const s = settleAll(playedNight());
    let locked = lockPlayoff(s, "court-2", 10_000);
    locked = advanceBracket(locked, 10_100);
    const sf1 = locked.pools[0].matches.find((m) => m.phase === "playoff_sf1")!;
    const sf2 = locked.pools[0].matches.find((m) => m.phase === "playoff_sf2")!;
    locked = applyResult(locked, sf1.id, { winner: "A", setsLost: 1 }, 11_000);
    locked = applyResult(locked, sf2.id, { winner: "B", setsLost: 0 }, 12_000);
    return advanceBracket(locked, 12_100);
  };

  it("winners advance automatically into the final", () => {
    const s = toFinal();
    const pool = s.pools[0];
    const sf1 = pool.matches.find((m) => m.phase === "playoff_sf1")!;
    const sf2 = pool.matches.find((m) => m.phase === "playoff_sf2")!;
    const fin = pool.matches.find((m) => m.phase === "playoff_final")!;
    expect(fin.teamA).toEqual(sf1.teamA);   // SF1 winner (A)
    expect(fin.teamB).toEqual(sf2.teamB);   // SF2 winner (B)
    expect(fin.status).toBe("active");
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });

  it("a semi is correctable BEFORE the final, and blocked after it is played", () => {
    let s = toFinal();
    const sf1 = s.pools[0].matches.find((m) => m.phase === "playoff_sf1")!;
    expect(playoffCorrectionBlock(s.pools[0], sf1.id).blocked).toBe(false);

    const fin = s.pools[0].matches.find((m) => m.phase === "playoff_final")!;
    s = applyResult(s, fin.id, { winner: "A", setsLost: 1 }, 13_000);
    const block = playoffCorrectionBlock(s.pools[0], sf1.id);
    expect(block.blocked).toBe(true);
    expect(block.message).toContain("Void the final first");
  });

  it("voiding a semi regresses the bracket cleanly", () => {
    let s = toFinal();
    const sf1 = s.pools[0].matches.find((m) => m.phase === "playoff_sf1")!;
    s = applyVoid(s, sf1.id);
    s = regressBracket(s, "court-2");
    const fin = s.pools[0].matches.find((m) => m.phase === "playoff_final")!;
    expect(fin.teamA).toEqual(["", ""]);
    expect(fin.status).toBe("pending");
    expect(s.pools[0].champion).toBeUndefined();
  });

  it("the final crowns the pair with the court's own title", () => {
    let s = toFinal();
    const fin = s.pools[0].matches.find((m) => m.phase === "playoff_final")!;
    s = applyResult(s, fin.id, { winner: "A", setsLost: 0 }, 14_000);
    s = crownFromBracket(s, 14_100);
    const champ = s.pools[0].champion!;
    expect(champ.kind).toBe("pair");
    expect(champ.playerIds).toEqual(fin.teamA);
    expect(champ.title).toBe("PTO Champion of the Week");
    expect(s.pools[0].status).toBe("complete");
    expect(crownFromBracket(s, 14_200)).toBe(s); // idempotent
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });

  // C6: this asserted "Court 1 Champion", singular, which is not a key of
  // PTO_POINTS_V1 — so the whole court published at zero points and its
  // finalists at floor(0/2). The test agreed with the bug, which is how it
  // survived. Every title has to be PRICED, not merely spelled.
  it("Court 1's title differs, and is a title the club has a price for", () => {
    const pool = { ...mkPool([], []), id: "court-1", label: "Court 1" as const };
    expect(championTitle(pool)).toBe("Court 1 Champions");
    expect(PTO_POINTS_V1[championTitle(pool)]).toBe(40);
  });

  // The permanent guard. A title the engine can emit but the club cannot
  // price is worth zero points and says nothing about it.
  it("every title this engine can produce has a price", () => {
    for (const label of ["Court 1", "Court 2"] as const) {
      const pool = { ...mkPool([], []), id: `court-${label === "Court 1" ? 1 : 2}`, label };
      const title = championTitle(pool);
      expect(Object.keys(PTO_POINTS_V1)).toContain(title);
      expect(PTO_POINTS_V1[title]).toBeGreaterThan(0);
    }
  });

  it("Court 2 keeps the 100-point title, not the 60-point one", () => {
    const pool = { ...mkPool([], []), id: "court-2", label: "Court 2" as const };
    // Renaming this to COURT_2_CHAMPIONS would look tidier and silently
    // reprice the premier Sunday title from 100 to 60.
    expect(PTO_POINTS_V1[championTitle(pool)]).toBe(100);
  });
});

/* ── the no-playoff path ─────────────────────────────────────────── */

describe("the Court 1 no-playoff toggle (STEP 7)", () => {
  it("declining raises the cap by one and keeps the court rolling", () => {
    let s = settleAll(playedNight());
    const before = P(s).targetMatches;
    s = declinePlayoff(s, "court-2");
    expect(P(s).targetMatches).toBe(before + 1);
    expect(P(s).playoffMode).toBe("none");
    expect(P(s).status).toBe("round_robin");
    // …and the generator picks straight back up.
    s = ensureLive(s, 20_000);
    expect(P(s).matches.some((m) => m.status === "active")).toBe(true);
  });

  it("ending the court crowns the standings leader — but not over a live coin", () => {
    const played = playedNight();
    // Unsettled: if rank 1 is genuinely tied, ending must refuse.
    const blockers = unresolvedFlipsAffecting(P(played), played.players, 1);
    const attempt = endCourtIndividual(played, "court-2", 30_000);
    if (blockers.length > 0) {
      expect(attempt.blocked.length).toBeGreaterThan(0);
      expect(attempt.session).toBe(played);
    }
    // Settled: the leader is crowned as an individual.
    const settled = settleAll(played);
    const ok = endCourtIndividual(settled, "court-2", 31_000);
    expect(ok.blocked).toEqual([]);
    const champ = ok.session.pools[0].champion!;
    expect(champ.kind).toBe("individual");
    expect(champ.playerIds).toEqual([poolStandings(P(settled), settled.players)[0].playerId]);
    expect(ok.session.pools[0].status).toBe("complete");
  });
});

/* ── the court borrow ────────────────────────────────────────────── */

describe("the optional court borrow (STEP 7)", () => {
  it("is offered only when the other court is genuinely idle", () => {
    const s = settleAll(playedNight());
    const other: AmericanoPool = {
      ...mkPool(["x1", "x2"], []), id: "court-1", label: "Court 1", status: "round_robin",
    };
    const two: AmericanoSession = { ...s, pools: [P(s), other] };
    // Court 1 has nobody on court → idle → offered.
    expect(courtBorrowAvailable(two, "court-2")).toBe(true);
    // Give Court 1 a live match → no longer idle.
    const busy: AmericanoSession = {
      ...two,
      pools: [P(two), { ...other, matches: [{
        id: "court-1-m1", poolId: "court-1", matchIndex: 1,
        teamA: ["x1", "x2"], teamB: ["x3", "x4"], result: null, status: "active",
        phase: "round_robin", startedAt: 1, completedAt: null,
      }] }],
    };
    expect(courtBorrowAvailable(busy, "court-2")).toBe(false);
  });
});

/* ── voiding the final ───────────────────────────────────────────── */

describe("a wrong final can be taken back (the run-of-show's recovery)", () => {
  /** Lock a bracket and play it to a crowned champion. */
  function crowned(): AmericanoSession {
    let s = settleAll(playedNight());
    s = requestPlayoff(s, "court-2");
    s = lockPlayoff(s, "court-2", 2_000);
    let clock = 3_000;
    for (let step = 0; step < 6; step++) {
      s = advanceBracket(s, clock);
      const live = P(s).matches.find(
        (m) => m.phase.startsWith("playoff") && m.status === "active",
      );
      if (!live) break;
      s = applyResult(s, live.id, { winner: "A", setsLost: 0 }, clock);
      s = crownFromBracket(advanceBracket(s, clock), clock);
      clock += 1_000;
    }
    return s;
  }

  it("the champion is crowned from the final, as expected", () => {
    const s = crowned();
    expect(P(s).champion).toBeDefined();
    expect(P(s).champion!.kind).toBe("pair");
    expect(P(s).status).toBe("complete");
  });

  it("VOIDING THE FINAL clears the champion and lets it be re-recorded", () => {
    // The room heard the wrong pair announced. The correction sheet's own
    // instruction is "Void the final first" — so voiding it must actually
    // take the champion back down, or the phone keeps showing a pair that
    // did not win and there is no way back short of resetting the night.
    const s = crowned();
    const wrong = P(s).champion!.playerIds.join();
    const finalMatch = P(s).matches.find((m) => m.phase === "playoff_final")!;

    let after = applyVoid(s, finalMatch.id);
    after = regressBracket(after, "court-2");

    expect(P(after).champion).toBeUndefined();
    expect(P(after).status).toBe("playoff");

    // …and the final is genuinely re-playable: it stands ready with the two
    // semi winners on it, so the right result can be entered.
    after = advanceBracket(after, 20_000);
    const replay = P(after).matches.find(
      (m) => m.phase === "playoff_final" && m.status === "active",
    );
    expect(replay).toBeDefined();

    after = applyResult(after, replay!.id, { winner: "B", setsLost: 1 }, 21_000);
    after = crownFromBracket(advanceBracket(after, 21_000), 21_000);
    expect(P(after).champion).toBeDefined();
    expect(P(after).champion!.playerIds.join()).not.toBe(wrong);
  });
});

describe("the same recovery in a top4 bracket (8-11 eligible — the likely night)", () => {
  it("top4 is the final alone, and voiding it also takes the champion down", () => {
    // A top4 bracket has no semis, so the old regress path — which only ever
    // looked at top8 — could not have helped here at all.
    let s = settleAll(playedNight(3, 8));
    expect(playoffModeFor(eligibility(P(s), s.players).eligible.length)).toBe("top4");

    s = requestPlayoff(s, "court-2");
    s = lockPlayoff(s, "court-2", 2_000);
    expect(P(s).playoff!.mode).toBe("top4");

    const theFinal = P(s).matches.find((m) => m.phase === "playoff_final")!;
    s = applyResult(s, theFinal.id, { winner: "A", setsLost: 0 }, 3_000);
    s = crownFromBracket(advanceBracket(s, 3_000), 3_000);
    const wrong = P(s).champion!.playerIds.join();
    expect(P(s).status).toBe("complete");

    s = regressBracket(applyVoid(s, theFinal.id), "court-2");
    expect(P(s).champion).toBeUndefined();
    expect(P(s).status).toBe("playoff");

    // The same two pairs are still on it — a top4 final is not rebuilt from
    // anything, so re-recording must work off the seeds it locked with.
    const replay = P(s).matches.find((m) => m.phase === "playoff_final")!;
    expect(replay.status).toBe("active");
    expect(replay.result).toBeNull();
    expect(replay.teamA.join()).toBe(theFinal.teamA.join());

    s = applyResult(s, replay.id, { winner: "B", setsLost: 1 }, 4_000);
    s = crownFromBracket(advanceBracket(s, 4_000), 4_000);
    expect(P(s).champion!.playerIds.join()).not.toBe(wrong);
  });
});
