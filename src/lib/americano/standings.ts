// PTO Americano v4 — standings (STEP 2, brief §4).
//
// THE CHAIN (STEP 6.3, owner-locked): a win is 3 points, a loss is 0.
//
//   points DESC  →  gameDiff DESC  →  the visible coin
//
// That is the whole system. Losses, head-to-head and strength of schedule are
// GONE as ranking keys: points already carry wins, and the game scores the
// room records at entry (the 7-5s and 7-4s) do the separating that three
// extra tiebreaks used to. Rank is a number people can compute in their head
// while standing on court.
//
// Points are derived, never stored: 3 × wins, and no draws exist.
//
// A consequence worth naming, because it is intended: 4-2 with +16 now
// out-ranks 4-0 with +4. Losing twice while winning big beats an unbeaten
// run of narrow wins. That is the owner's call and the tests assert it by
// name so nobody later "fixes" it.
//
// Exact ties on points AND differential fall through to the 6.1/6.2 group
// coin machinery, unchanged — the library still never rolls a coin.
//
// Standings are computed from COMPLETED round-robin matches only. Voided
// matches count for nothing. Playoff matches decide champions, not ranks.

import type {
  AmericanoMatch, AmericanoPlayer, AmericanoPool, StandingsRow,
} from "@/types/americano";
import { matchFormatOf, resultDiff } from "./format";

// Differential is FORMAT-DEFINED (STEP F): lib/americano/format.ts owns the
// arithmetic, this file only banks the number. At best of 3 it reduces to the
// original +2 / +1, which is why nothing else in the chain had to change.

/** A win is three points; a loss is none; there are no draws. */
export const POINTS_PER_WIN = 3;

const counted = (pool: AmericanoPool): AmericanoMatch[] =>
  pool.matches.filter((m) => m.status === "completed" && m.phase === "round_robin");

export interface PlayerRecord {
  matchesPlayed: number;
  wins: number;
  losses: number;
  gameDiff: number;
}

/** Per-player record from the match log (the generator ranks quartets with it). */
export function computeRecords(pool: AmericanoPool): Map<string, PlayerRecord> {
  const out = new Map<string, PlayerRecord>();
  const get = (id: string): PlayerRecord => {
    let r = out.get(id);
    if (!r) { r = { matchesPlayed: 0, wins: 0, losses: 0, gameDiff: 0 }; out.set(id, r); }
    return r;
  };
  for (const m of counted(pool)) {
    if (!m.result) continue;
    const d = resultDiff(matchFormatOf(pool, m), m.result);
    const winners = m.result.winner === "A" ? m.teamA : m.teamB;
    const losers = m.result.winner === "A" ? m.teamB : m.teamA;
    for (const id of winners) { const r = get(id); r.matchesPlayed++; r.wins++; r.gameDiff += d.win; }
    for (const id of losers) { const r = get(id); r.matchesPlayed++; r.losses++; r.gameDiff += d.loss; }
  }
  return out;
}

/**
 * Strength of schedule (§4, amended): the sum of tonight's WINS of every
 * opponent this player faced — opponents only, never partners, a repeat
 * opponent counted each time faced, completed matches only. Sits between
 * head-to-head and the coin flip so flips stay rare and last-resort.
 */
export function strengthOfSchedule(pool: AmericanoPool, playerId: string): number {
  const records = computeRecords(pool);
  let sos = 0;
  for (const m of counted(pool)) {
    const onA = m.teamA.includes(playerId);
    const onB = m.teamB.includes(playerId);
    if (!onA && !onB) continue;
    const opponents = onA ? m.teamB : m.teamA;
    for (const o of opponents) sos += records.get(o)?.wins ?? 0;
  }
  return sos;
}

/**
 * THE definition of "tied", in one place.
 *
 * Two players are tied when they share a W-L-diff record. Head-to-head then
 * separates them — but ONLY when the tied group is exactly a pair. H2H is not
 * transitive (x beats y beats z beats x is an ordinary Wednesday), so a group
 * of three or more cannot be ordered by it, and the chain falls through to
 * SOS and then the coin.
 *
 * computeStandings, stillTiedPreFlip, pendingFlipPairs and
 * unresolvedFlipsAffecting all consume these two functions. Nothing
 * reimplements the arity rule locally: when the panel and the staleness rule
 * disagreed about who was tied, resolutions evaporated off rows the table
 * still showed as flipped, so this is the bug class that refactor closes.
 */

/** Everyone carrying this exact W-L-diff record, over the pool's full roster. */
export function tiedGroup(
  pool: AmericanoPool,
  playerId: string,
  records: Map<string, PlayerRecord> = computeRecords(pool),
  players: AmericanoPlayer[] = [],
): string[] {
  const EMPTY = { matchesPlayed: 0, wins: 0, losses: 0, gameDiff: 0 };
  const mine = records.get(playerId) ?? EMPTY;
  const ids = new Set<string>(pool.playerIds);
  for (const id of records.keys()) ids.add(id);
  // The same roster computeStandings builds: a player who left without ever
  // playing is in no table, so they are in no tie either. Passing `players`
  // is what keeps the group size — and therefore the head-to-head arity
  // rule — identical on both sides.
  const byId = new Map(players.map((p) => [p.playerId, p] as const));
  for (const id of [...ids]) {
    if (byId.get(id)?.status === "left" && !records.has(id)) ids.delete(id);
  }
  const out: string[] = [];
  for (const id of ids) {
    const r = records.get(id) ?? EMPTY;
    // Tied = same points and same differential. Losses left the chain, so two
    // players on 4-0 and 4-2 with equal diff are now genuinely tied and go to
    // a group order rather than being split by a key nobody ranks on.
    if (r.wins === mine.wins && r.gameDiff === mine.gameDiff) out.push(id);
  }
  return out;
}

/**
 * groupKey (members sorted, joined by "|") → the coin-decided total order for
 * that exact tied set. Supplied by flips.ts, which only ever hands over
 * orders that are LIVE and COMPLETE. The library still never rolls a coin.
 */
export type GroupOrders = Map<string, string[]>;

export function computeStandings(
  pool: AmericanoPool,
  players: AmericanoPlayer[],
  groupOrders: GroupOrders = new Map(),
): StandingsRow[] {
  const records = computeRecords(pool);
  // Every pool member plus anyone who earned a record here (moved/left players
  // keep what they earned — the record stays where it was earned).
  const ids = new Set<string>(pool.playerIds);
  for (const id of records.keys()) ids.add(id);
  const byId = new Map(players.map((p) => [p.playerId, p] as const));
  for (const id of [...ids]) {
    if (byId.get(id)?.status === "left" && !records.has(id)) ids.delete(id);
  }

  const rows: StandingsRow[] = [...ids].map((playerId) => {
    const r = records.get(playerId) ?? { matchesPlayed: 0, wins: 0, losses: 0, gameDiff: 0 };
    return {
      playerId,
      matchesPlayed: r.matchesPlayed,
      wins: r.wins,
      losses: r.losses,
      points: POINTS_PER_WIN * r.wins,
      gameDiff: r.gameDiff,
      rank: 0,
      tiebreakApplied: null,
      requiresCoinFlip: false,
    };
  });

  // points DESC → gameDiff DESC → provisional playerId order.
  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.gameDiff - a.gameDiff ||
      (a.playerId < b.playerId ? -1 : 1),
  );

  // A run of equal (points, gameDiff) is a tie the chain cannot separate, so
  // it goes straight to the coin — no SOS layer, no head-to-head. A
  // coin-decided order is applied WHOLESALE or not at all (6.2): never pair
  // by pair, which is how a resolution used to go inert once a third player
  // sorted between a flipped pair.
  const key = (r: StandingsRow) => `${r.points}|${r.gameDiff}`;
  for (let start = 0; start < rows.length; ) {
    let end = start + 1;
    while (end < rows.length && key(rows[end]) === key(rows[start])) end++;
    if (end - start >= 2) {
      const run = rows.slice(start, end).sort((a, b) => (a.playerId < b.playerId ? -1 : 1));
      // A run where nobody has played is a BLANK SLATE, not a tie (STEP G):
      // before the first result the whole pool shares 0-0-0, and flagging
      // that would ask the room to flip coins over nothing.
      const blank = run.every((r) => r.wins + r.losses === 0);
      const groupId = run.map((r) => r.playerId).sort().join("|");
      const order = groupOrders.get(groupId);
      if (blank) {
        // nothing to order, nothing to flag
      } else if (order && order.length === run.length) {
        const byRunId = new Map(run.map((r) => [r.playerId, r] as const));
        for (let k = 0; k < order.length; k++) run[k] = byRunId.get(order[k])!;
        for (let k = 0; k < order.length - 1; k++) {
          run[k].tiebreakApplied = run[k].tiebreakApplied ?? "coinflip";
        }
      } else {
        for (const r of run) r.requiresCoinFlip = true;
      }
      for (let i = 0; i < run.length; i++) rows[start + i] = run[i];
    }
    start = end;
  }

  // Ranks + the cross-group annotations (what placed a row above the next).
  for (let i = 0; i < rows.length; i++) rows[i].rank = i + 1;
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i], b = rows[i + 1];
    if (a.tiebreakApplied || a.requiresCoinFlip) continue; // in-group already set
    if (a.points !== b.points) continue;                    // points is the headline
    if (a.gameDiff !== b.gameDiff) a.tiebreakApplied = "diff";
  }
  return rows;
}

/** Bracket eligibility: within one match of the pool's most-played player. */
export function playoffEligible(row: StandingsRow, standings: StandingsRow[]): boolean {
  const leader = Math.max(0, ...standings.map((r) => r.matchesPlayed));
  return row.matchesPlayed >= leader - 1;
}

/** The exact data the START PLAYOFF confirm screen shows (brief §6). */
export function earlyCutSummary(
  pool: AmericanoPool,
  players: AmericanoPlayer[],
): { atTarget: number; below: { playerId: string; matches: number }[] } {
  const byId = new Map(players.map((p) => [p.playerId, p] as const));
  const present = pool.playerIds.filter((id) => byId.get(id)?.status === "present");
  const records = computeRecords(pool);
  const below: { playerId: string; matches: number }[] = [];
  let atTarget = 0;
  for (const id of present) {
    const m = records.get(id)?.matchesPlayed ?? 0;
    if (m >= pool.targetMatches) atTarget++;
    else below.push({ playerId: id, matches: m });
  }
  return { atTarget, below };
}
