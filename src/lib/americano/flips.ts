// PTO Americano v4 — the visible coin flip (STEP 6, brief §4).
//
// The flip is the honest last resort, so it is a real EVENT, not a hidden
// sort order: the admin runs it, the room watches it land, and the outcome is
// persisted per pool. The library still never rolls a coin — randomness is
// injected — and standings are never stored, only recomputed.
//
// The rule that keeps a flip honest is STALENESS: a resolution applies only
// while its pair is still tied on the WHOLE pre-flip chain (wins, losses,
// diff, head-to-head, SOS). Correct or void a result that breaks the tie and
// the resolution is dropped — not merely ignored. If a later change recreates
// the identical tie, the pair flips AGAIN, because chance won under different
// circumstances is not chance won under these ones.

import type {
  AmericanoPlayer, AmericanoPool, AmericanoSession, CoinFlipResolution,
  StandingsRow,
} from "@/types/americano";
import { pairKey } from "./generator";
import {
  computeRecords, computeStandings, h2hSeparates, strengthOfSchedule, tiedGroup,
  type CoinFlipResolutions,
} from "./standings";

/**
 * Is this pair STILL tied on everything the chain checks before a flip?
 * Equal wins, equal losses, equal diff, no head-to-head separation, equal SOS
 * — the moment any earlier link separates them, the flip that once decided
 * them has nothing left to decide.
 *
 * The record grouping and the head-to-head arity rule come from
 * standings.ts (tiedGroup / h2hSeparates) — the SAME functions
 * computeStandings uses. This module deliberately owns no second opinion
 * about who is tied.
 */
export function stillTiedPreFlip(pool: AmericanoPool, a: string, b: string): boolean {
  const records = computeRecords(pool);
  const group = tiedGroup(pool, a, records);
  if (!group.includes(b)) return false; // different W-L-diff record entirely
  if (h2hSeparates(pool, group.length, a, b)) return false;
  return strengthOfSchedule(pool, a) === strengthOfSchedule(pool, b);
}

/** The stored flips that still decide something, newest-wins per pair. */
export function liveFlips(pool: AmericanoPool): CoinFlipResolution[] {
  const stored = pool.coinFlipResolutions ?? [];
  const byPair = new Map<string, CoinFlipResolution>();
  for (const r of stored) {
    if (!stillTiedPreFlip(pool, r.a, r.b)) continue;
    const k = pairKey(r.a, r.b);
    const prev = byPair.get(k);
    if (!prev || r.at >= prev.at) byPair.set(k, r);
  }
  return [...byPair.values()];
}

/** The injected map computeStandings consumes — live resolutions only. */
export function flipResolutionMap(pool: AmericanoPool): CoinFlipResolutions {
  const out: CoinFlipResolutions = {};
  for (const r of liveFlips(pool)) out[pairKey(r.a, r.b)] = r.winner;
  return out;
}

/** The pool's standings as the screen shows them: live flips applied. */
export function poolStandings(
  pool: AmericanoPool,
  players: AmericanoPlayer[],
): StandingsRow[] {
  return computeStandings(pool, players, flipResolutionMap(pool));
}

/**
 * Drop resolutions whose tie no longer exists. Called on every result entry,
 * correction and void — the drop must be a real deletion, because a merely
 * ignored resolution would spring back to life the moment an identical tie
 * reappeared, silently reusing a coin toss from another set of facts.
 */
export function pruneStaleFlips(s: AmericanoSession): AmericanoSession {
  let changed = false;
  const pools = s.pools.map((pool) => {
    const stored = pool.coinFlipResolutions;
    if (!stored || stored.length === 0) return pool;
    const kept = stored.filter((r) => stillTiedPreFlip(pool, r.a, r.b));
    if (kept.length === stored.length) return pool;
    changed = true;
    const next = { ...pool };
    if (kept.length > 0) next.coinFlipResolutions = kept;
    else delete next.coinFlipResolutions;
    return next;
  });
  return changed ? { ...s, pools } : s;
}

export type FlipRefusal =
  | "bad_winner"      // the coin landed on someone who is not in the pair
  | "unknown_pool"
  | "tie_changed"     // a correction or void separated them while we animated
  | "already_resolved";

export type FlipAttempt =
  | { accepted: true; session: AmericanoSession; winner: string }
  | { accepted: false; reason: FlipRefusal };

/**
 * Record a flip that just happened in the room — with an EXPLICIT verdict.
 *
 * The overlay needs to know the difference between "recorded" and "declined",
 * because a visible coin toss that quietly changes nothing is worse than no
 * toss at all: the room watched a name win and the table disagrees. So the
 * refusal is a value, not a silently-identical state.
 *
 * Refused when the pair is no longer tied (someone corrected or voided a
 * result underneath us — another tab, a background sync) or when the pair
 * already holds a live resolution: the result is the result, and the only
 * route to a new flip is genuine staleness.
 */
export function attemptCoinFlip(
  s: AmericanoSession,
  poolId: string,
  a: string,
  b: string,
  winner: string,
  at: number,
): FlipAttempt {
  if (winner !== a && winner !== b) return { accepted: false, reason: "bad_winner" };
  const pool = s.pools.find((p) => p.id === poolId);
  if (!pool) return { accepted: false, reason: "unknown_pool" };
  if (!stillTiedPreFlip(pool, a, b)) return { accepted: false, reason: "tie_changed" };
  const k = pairKey(a, b);
  if (liveFlips(pool).some((r) => pairKey(r.a, r.b) === k)) {
    return { accepted: false, reason: "already_resolved" };
  }
  const resolution: CoinFlipResolution = { a, b, winner, at };
  return {
    accepted: true,
    winner,
    session: {
      ...s,
      pools: s.pools.map((p) =>
        p.id === poolId
          ? { ...p, coinFlipResolutions: [...(p.coinFlipResolutions ?? []), resolution] }
          : p,
      ),
    },
  };
}

/** The identity-on-refusal form, for callers that only need the new state. */
export function applyCoinFlip(
  s: AmericanoSession,
  poolId: string,
  a: string,
  b: string,
  winner: string,
  at: number,
): AmericanoSession {
  const attempt = attemptCoinFlip(s, poolId, a, b, winner, at);
  return attempt.accepted ? attempt.session : s;
}

/** What the flip overlay is showing right now. Pure, so the component holds
    no logic and the "never land on a winner we did not record" rule is
    testable without a DOM. */
export type FlipPhase = "flipping" | "recording" | "landed" | "declined";

export function flipPhase(args: {
  animationDone: boolean;
  outcome: { accepted: boolean } | null;
}): FlipPhase {
  if (!args.animationDone) return "flipping";
  if (args.outcome === null) return "recording";
  return args.outcome.accepted ? "landed" : "declined";
}

/** Adjacent pairs the table still cannot separate — what [FLIP] badges.
 *
 * Three conditions, and all three earn their place:
 *  1. both rows flagged — the row-level flag means "still in an unresolved
 *     tie", which is about the ROW, not about this particular neighbour;
 *  2. genuinely tied with each other — two flagged rows can sit next to each
 *     other while belonging to different tie groups (the last unresolved row
 *     of one group above the first of the next), and the chain already
 *     separated those two;
 *  3. not ALREADY resolved between themselves. In a run of three or more,
 *     resolving the middle pair reorders the group, and the two players who
 *     just flipped can land adjacent again while each stays flagged against
 *     a DIFFERENT neighbour. Offering that pair again would show a [FLIP]
 *     that animates and records nothing (applyCoinFlip rightly refuses to
 *     re-flip a live resolution) — a coin toss with no consequence, which is
 *     the one thing a visible flip must never be.
 */
export function pendingFlipPairs(
  pool: AmericanoPool,
  players: AmericanoPlayer[],
): { a: string; b: string }[] {
  const rows = poolStandings(pool, players);
  const resolved = flipResolutionMap(pool);
  const out: { a: string; b: string }[] = [];
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i], b = rows[i + 1];
    if (
      a.requiresCoinFlip && b.requiresCoinFlip &&
      resolved[pairKey(a.playerId, b.playerId)] === undefined &&
      stillTiedPreFlip(pool, a.playerId, b.playerId)
    ) {
      out.push({ a: a.playerId, b: b.playerId });
    }
  }
  return out;
}

export interface BlockingFlip {
  a: string;
  b: string;
  /** Whether the tie decides WHO is in, or the order of those already in. */
  reason: "cut_line" | "seed_order";
}

/**
 * STEP 7's gate: unresolved flips that the bracket's seeding actually depends
 * on. A tie straddling the cut decides who plays at all; a tie inside the top
 * group decides who meets whom (1v8 is not 4v5). A tie below the line decides
 * nothing a bracket reads, so it never blocks the playoff — the admin can
 * leave mid-table order provisional all night.
 *
 * Takes `players` alongside the pool because standings need player status to
 * decide who still belongs in the table; the pool alone cannot say.
 */
export function unresolvedFlipsAffecting(
  pool: AmericanoPool,
  players: AmericanoPlayer[],
  cutSize: number,
): BlockingFlip[] {
  const rows = poolStandings(pool, players);
  const rankOf = new Map(rows.map((r) => [r.playerId, r.rank] as const));
  const out: BlockingFlip[] = [];
  for (const { a, b } of pendingFlipPairs(pool, players)) {
    const ra = rankOf.get(a) ?? Infinity;
    const rb = rankOf.get(b) ?? Infinity;
    const aIn = ra <= cutSize, bIn = rb <= cutSize;
    if (aIn && bIn) out.push({ a, b, reason: "seed_order" });
    else if (aIn !== bIn) out.push({ a, b, reason: "cut_line" });
    // Both out: decides nothing the bracket reads.
  }
  return out;
}

/**
 * The coin itself. The library stays deterministic — the caller injects the
 * entropy (the UI passes crypto.getRandomValues) — but the fairness lives
 * here, where it can be tested: an even split, no bias toward the first name.
 */
export function pickFlipWinner(a: string, b: string, randomUint32: () => number): string {
  return randomUint32() % 2 === 0 ? a : b;
}
