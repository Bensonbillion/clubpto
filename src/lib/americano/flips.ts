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
  computeRecords, computeStandings, strengthOfSchedule,
  type CoinFlipResolutions,
} from "./standings";

const EMPTY: PlayerRecordLike = { wins: 0, losses: 0, gameDiff: 0 };
interface PlayerRecordLike { wins: number; losses: number; gameDiff: number }

/** Net wins of `a` over `b` when they faced each other tonight (completed,
    non-voided). Mirrors standings.ts — kept private there, so recomputed. */
function headToHeadNet(pool: AmericanoPool, a: string, b: string): number {
  let net = 0;
  for (const m of pool.matches) {
    if (m.status !== "completed" || m.phase !== "round_robin" || !m.result) continue;
    const aA = m.teamA.includes(a), aB = m.teamB.includes(a);
    const bA = m.teamA.includes(b), bB = m.teamB.includes(b);
    if ((aA && bB) || (aB && bA)) {
      const aWon = (aA && m.result.winner === "A") || (aB && m.result.winner === "B");
      net += aWon ? 1 : -1;
    }
  }
  return net;
}

/**
 * Is this pair STILL tied on everything the chain checks before a flip?
 * Equal wins, equal losses, equal diff, no head-to-head separation, equal SOS
 * — the moment any earlier link separates them, the flip that once decided
 * them has nothing left to decide.
 *
 * Head-to-head is applied EXACTLY where computeStandings applies it: only when
 * the tied group is a pair. In a three-way tie the engine cannot use H2H (it
 * is not transitive — x beats y beats z beats x is an ordinary Wednesday), so
 * neither may this predicate. Mirroring the engine is the whole point: if the
 * staleness rule and the table ever disagreed about who is tied, resolutions
 * would evaporate off rows the panel still shows as flipped.
 */
export function stillTiedPreFlip(pool: AmericanoPool, a: string, b: string): boolean {
  const records = computeRecords(pool);
  const ra = records.get(a) ?? EMPTY;
  const rb = records.get(b) ?? EMPTY;
  if (ra.wins !== rb.wins || ra.losses !== rb.losses || ra.gameDiff !== rb.gameDiff) return false;

  // The group that shares this exact W-L-diff record, over everyone with a
  // record here plus every pool member (matching computeStandings' roster).
  const ids = new Set<string>(pool.playerIds);
  for (const id of records.keys()) ids.add(id);
  let groupSize = 0;
  for (const id of ids) {
    const r = records.get(id) ?? EMPTY;
    if (r.wins === ra.wins && r.losses === ra.losses && r.gameDiff === ra.gameDiff) groupSize++;
  }
  if (groupSize === 2 && headToHeadNet(pool, a, b) !== 0) return false;

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

/**
 * Record a flip that just happened in the room. Rejected (identity) unless
 * the pair is genuinely tied and unresolved — the result is the result, so
 * there is no re-flipping a live resolution; the only route to a new flip is
 * genuine staleness.
 */
export function applyCoinFlip(
  s: AmericanoSession,
  poolId: string,
  a: string,
  b: string,
  winner: string,
  at: number,
): AmericanoSession {
  if (winner !== a && winner !== b) return s;
  const pool = s.pools.find((p) => p.id === poolId);
  if (!pool) return s;
  if (!stillTiedPreFlip(pool, a, b)) return s;
  const k = pairKey(a, b);
  if (liveFlips(pool).some((r) => pairKey(r.a, r.b) === k)) return s;
  const resolution: CoinFlipResolution = { a, b, winner, at };
  return {
    ...s,
    pools: s.pools.map((p) =>
      p.id === poolId
        ? { ...p, coinFlipResolutions: [...(p.coinFlipResolutions ?? []), resolution] }
        : p,
    ),
  };
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
