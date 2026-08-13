// PTO Americano v4 — the visible coin flip, as GROUP orders (STEP 6.2).
//
// The flip is the honest last resort, so it is a real EVENT: the admin runs
// it, the room watches it land, and the outcome is persisted. The library
// still never rolls a coin — randomness is injected — and standings are never
// stored, only recomputed.
//
// WHY GROUPS. Resolutions used to be pairwise, and computeStandings could
// only consult them between ADJACENT rows. The moment a third player sorted
// between a flipped pair, the verdict went inert: still stored, still "live",
// silently absent from the sort, with the table showing the loser above the
// winner and no route back (a re-flip was refused as already resolved). A
// group record cannot do that. It names its exact membership and carries the
// tied line that justified it, so it is either live and authoritative for the
// WHOLE group, or it is gone entirely — partial progress included. Cyclic
// verdicts (A>B, B>C, C>A) are unrepresentable, because a record IS a total
// order rather than a bag of pair opinions.
//
// STALENESS, unchanged in spirit: a record is live iff its members are
// exactly a current tied group and its line still matches. Anything else —
// membership grew, shrank, swapped, or the line moved — drops the record. If
// an identical tie reappears later, it is flipped afresh: chance won under
// different circumstances is not chance won under these ones.

import type {
  AmericanoPlayer, AmericanoPool, AmericanoSession, CoinFlipResolution,
  GroupFlipLine, GroupFlipRecord, StandingsRow,
} from "@/types/americano";
import {
  computeRecords, computeStandings, h2hSeparates, strengthOfSchedule, tiedGroup,
} from "./standings";

/* ── who is tied with whom ───────────────────────────────────────── */

/** Canonical identity of a member set — the key everything joins on. */
export function groupKey(members: string[]): string {
  return [...members].sort().join("|");
}

const EMPTY = { matchesPlayed: 0, wins: 0, losses: 0, gameDiff: 0 };

/**
 * The players a coin must order against `playerId`: same W-L-diff record
 * (standings.tiedGroup — the single definition), not separated by
 * head-to-head under the arity rule, and level on strength of schedule.
 * Returns the whole set INCLUDING playerId, canonically sorted. A set of one
 * needs no coin.
 */
export function flipGroupOf(
  pool: AmericanoPool,
  playerId: string,
  players: AmericanoPlayer[] = [],
): string[] {
  const records = computeRecords(pool);
  const group = tiedGroup(pool, playerId, records, players);
  const sos = strengthOfSchedule(pool, playerId);
  const members = group.filter(
    (id) =>
      id === playerId ||
      (strengthOfSchedule(pool, id) === sos &&
        !h2hSeparates(pool, group.length, playerId, id)),
  );
  return [...members].sort();
}

/**
 * A group where nobody has played yet is a BLANK SLATE, not a tie (STEP G).
 *
 * Before the first result every player sits at 0-0-0 with SOS 0, so the whole
 * pool is technically one tied group — and the honest arithmetic of the coin
 * procedure then advertises something like "120 flips to run" on a sixteen
 * player court before a ball is hit. Nothing is tied there; nothing has
 * happened. The predicate is exact: counted matches means W+L > 0, so the
 * blank set is precisely the never-played.
 */
export function isBlankSlate(pool: AmericanoPool, members: string[]): boolean {
  const records = computeRecords(pool);
  return members.every((id) => {
    const r = records.get(id);
    return !r || r.wins + r.losses === 0;
  });
}

/** Every set of two or more players tonight that only a coin can order. */
export function flipGroups(pool: AmericanoPool, players: AmericanoPlayer[]): string[][] {
  const rows = computeStandings(pool, players);
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const row of rows) {
    if (seen.has(row.playerId)) continue;
    const members = flipGroupOf(pool, row.playerId, players);
    for (const id of members) seen.add(id);
    if (members.length >= 2 && !isBlankSlate(pool, members)) out.push(members);
  }
  return out;
}

/** The tied signature of a group as it stands right now. */
export function lineOf(pool: AmericanoPool, members: string[]): GroupFlipLine {
  const records = computeRecords(pool);
  const r = records.get(members[0]) ?? EMPTY;
  return {
    w: r.wins,
    l: r.losses,
    diff: r.gameDiff,
    sos: strengthOfSchedule(pool, members[0]),
  };
}

const sameLine = (a: GroupFlipLine, b: GroupFlipLine) =>
  a.w === b.w && a.l === b.l && a.diff === b.diff && a.sos === b.sos;

/* ── the procedure: one visible flip at a time ───────────────────── */

/**
 * Replay a group's coins into a placement. INSERTION by provisional order:
 * members are considered in playerId order, and each new candidate is
 * compared down the already-placed order until it wins one or exhausts them
 * all. Every comparison is exactly one visible coin, which is what makes a
 * 2-group one flip and a 3-group two or three.
 *
 * Returns the order built so far and, when the group is not yet settled, the
 * single next flip the room must run.
 */
export function replayGroup(
  members: string[],
  flips: CoinFlipResolution[],
): { order: string[]; next: { a: string; b: string } | null } {
  const candidates = [...members].sort();
  const placed: string[] = [];
  let fi = 0;
  for (const cand of candidates) {
    if (placed.length === 0) {
      placed.push(cand); // nothing to compare against yet
      continue;
    }
    let idx = 0;
    let won = false;
    while (idx < placed.length) {
      const f = flips[fi];
      if (!f) return { order: placed, next: { a: cand, b: placed[idx] } };
      fi++;
      if (f.winner === cand) { won = true; break; }
      idx++;
    }
    placed.splice(idx, 0, cand); // won here, or exhausted and sits last
    void won;
  }
  return { order: placed, next: null };
}

export const isComplete = (r: GroupFlipRecord) => r.order.length === r.members.length;

/* ── liveness ────────────────────────────────────────────────────── */

/** Records that still describe a real, unchanged tie. */
export function liveGroupRecords(
  pool: AmericanoPool,
  players: AmericanoPlayer[],
): GroupFlipRecord[] {
  const stored = pool.groupFlipResolutions ?? [];
  if (stored.length === 0) return [];
  const current = new Map(flipGroups(pool, players).map((m) => [groupKey(m), m] as const));
  const out: GroupFlipRecord[] = [];
  for (const rec of stored) {
    const key = groupKey(rec.members);
    const members = current.get(key);
    if (!members) continue;                       // membership grew/shrank/swapped
    if (!sameLine(rec.line, lineOf(pool, members))) continue; // the line moved
    out.push(rec);
  }
  return out;
}

/**
 * Drop every record whose tie no longer exists exactly as recorded. The drop
 * is a real deletion: a merely ignored record would spring back the moment an
 * identical tie reappeared, silently reusing coins from other facts.
 */
export function pruneStaleFlips(s: AmericanoSession): AmericanoSession {
  let changed = false;
  const pools = s.pools.map((pool) => {
    const stored = pool.groupFlipResolutions;
    if (!stored || stored.length === 0) return pool;
    const kept = liveGroupRecords(pool, s.players);
    if (kept.length === stored.length) return pool;
    changed = true;
    const next = { ...pool };
    if (kept.length > 0) next.groupFlipResolutions = kept;
    else delete next.groupFlipResolutions;
    return next;
  });
  return changed ? { ...s, pools } : s;
}

/* ── standings, with live COMPLETE orders applied wholesale ──────── */

/** groupKey → the coin-decided order, for groups that are fully settled. */
export function completeOrders(
  pool: AmericanoPool,
  players: AmericanoPlayer[],
): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const rec of liveGroupRecords(pool, players)) {
    if (isComplete(rec)) out.set(groupKey(rec.members), rec.order);
  }
  return out;
}

/** The pool's standings as the screen shows them. */
export function poolStandings(
  pool: AmericanoPool,
  players: AmericanoPlayer[],
): StandingsRow[] {
  return computeStandings(pool, players, completeOrders(pool, players));
}

/* ── what the UI offers ──────────────────────────────────────────── */

export interface PendingFlip {
  members: string[];
  a: string;
  b: string;
  /** Coins still to toss before this group is ordered. */
  remaining: number;
}

/** How many more coins a group needs, worst case, from where it stands. */
function remainingFlips(members: string[], flips: CoinFlipResolution[]): number {
  let count = 0;
  const probe = [...flips];
  for (let guard = 0; guard < members.length * members.length + 4; guard++) {
    const { next } = replayGroup(members, probe);
    if (!next) break;
    // Assume the candidate loses — the longest path to a settled order.
    probe.push({ a: next.a, b: next.b, winner: next.b, at: 0 });
    count++;
  }
  return count;
}

/**
 * Exactly the next coin each unsettled group needs — never a list of pairs
 * the admin could run in any order, because the procedure is an insertion and
 * each answer decides what is asked next.
 */
export function pendingFlips(
  pool: AmericanoPool,
  players: AmericanoPlayer[],
): PendingFlip[] {
  const live = new Map(liveGroupRecords(pool, players).map((r) => [groupKey(r.members), r]));
  const out: PendingFlip[] = [];
  for (const members of flipGroups(pool, players)) {
    const rec = live.get(groupKey(members));
    const flips = rec?.flips ?? [];
    const { next } = replayGroup(members, flips);
    if (!next) continue; // settled
    out.push({ members, a: next.a, b: next.b, remaining: remainingFlips(members, flips) });
  }
  return out;
}

/* ── recording a coin ────────────────────────────────────────────── */

export type FlipRefusal =
  | "bad_winner"
  | "unknown_pool"
  | "tie_changed"
  | "blank_slate"
  | "group_changed"
  | "not_the_next_flip"
  | "already_resolved";

export type FlipAttempt =
  | { accepted: true; session: AmericanoSession; winner: string }
  | { accepted: false; reason: FlipRefusal };

/**
 * Record a coin the room just watched land — with an EXPLICIT verdict, because
 * a visible toss that quietly changes nothing is worse than no toss at all.
 * Refused when the pair is not the flip the procedure is currently asking
 * for, when the group has changed underneath us, or when the group is already
 * settled.
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

  const members = flipGroupOf(pool, a, s.players);
  if (members.length < 2) return { accepted: false, reason: "tie_changed" };
  if (!members.includes(b)) return { accepted: false, reason: "tie_changed" };
  // Nobody has played: there is nothing for a coin to decide yet.
  if (isBlankSlate(pool, members)) return { accepted: false, reason: "blank_slate" };

  const key = groupKey(members);
  const stored = pool.groupFlipResolutions ?? [];
  const live = liveGroupRecords(pool, s.players);
  const rec = live.find((r) => groupKey(r.members) === key);

  // A stored record for this key that is NOT live means the group moved under
  // an in-flight flip; the honest answer is that it changed, not that it is
  // resolved.
  if (!rec && stored.some((r) => groupKey(r.members) === key)) {
    return { accepted: false, reason: "group_changed" };
  }

  const flips = rec?.flips ?? [];
  const { next } = replayGroup(members, flips);
  if (!next) return { accepted: false, reason: "already_resolved" };
  if (!(next.a === a && next.b === b) && !(next.a === b && next.b === a)) {
    return { accepted: false, reason: "not_the_next_flip" };
  }

  const nextFlips = [...flips, { a, b, winner, at }];
  const replayed = replayGroup(members, nextFlips);
  const updated: GroupFlipRecord = {
    members,
    line: rec?.line ?? lineOf(pool, members),
    order: replayed.order,
    flips: nextFlips,
  };
  return {
    accepted: true,
    winner,
    session: {
      ...s,
      pools: s.pools.map((p) =>
        p.id === poolId
          ? {
              ...p,
              groupFlipResolutions: [
                ...stored.filter((r) => groupKey(r.members) !== key),
                updated,
              ],
            }
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
    no logic and "never land on a winner we did not record" is testable
    without a DOM. */
export type FlipPhase = "flipping" | "recording" | "landed" | "declined";

export function flipPhase(args: {
  animationDone: boolean;
  outcome: { accepted: boolean } | null;
}): FlipPhase {
  if (!args.animationDone) return "flipping";
  if (args.outcome === null) return "recording";
  return args.outcome.accepted ? "landed" : "declined";
}

/* ── Step 7's gate ───────────────────────────────────────────────── */

export interface BlockingFlip {
  members: string[];
  /** Whether the tie decides WHO is in, or the order of those already in. */
  reason: "cut_line" | "seed_order";
}

/**
 * Groups the bracket's seeding depends on that are not yet ordered. A group
 * straddling the cut decides who plays at all; a group inside the top decides
 * who meets whom (1v8 is not 4v5). A group entirely below the line decides
 * nothing a bracket reads, so it never blocks — mid-table order can stay
 * provisional all night.
 *
 * Group-based, so a four-way tie across the cut keeps blocking until its
 * order is COMPLETE; the old pairwise gate cleared after a single flip and
 * let alphabetical order decide who made the bracket.
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
  const settled = completeOrders(pool, players);
  const out: BlockingFlip[] = [];
  for (const members of flipGroups(pool, players)) {
    if (settled.has(groupKey(members))) continue;
    const inside = members.filter((id) => (rankOf.get(id) ?? Infinity) <= cutSize).length;
    if (inside === 0) continue;                       // decides nothing seeded
    out.push({ members, reason: inside === members.length ? "seed_order" : "cut_line" });
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
