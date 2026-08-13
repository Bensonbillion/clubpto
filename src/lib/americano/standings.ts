// PTO Americano v4 — standings (STEP 2, brief §4).
//
// Chain, locked: wins DESC → losses ASC → gameDiff DESC → head-to-head (only
// when EXACTLY two players are tied and they met tonight) → coin flip.
// The coin flip is returned as a FLAG (requiresCoinFlip) with a provisional
// playerId order — the admin runs a VISIBLE flip and the UI injects the
// outcome via coinFlipResolutions. The library never rolls one.
//
// 'losses ASC' is inert on a completed even night and exists to make EARLY
// playoff cuts fair: k vs k+1 matches → 2W-0L outranks 2W-1L.
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
    if (r.wins === mine.wins && r.losses === mine.losses && r.gameDiff === mine.gameDiff) {
      out.push(id);
    }
  }
  return out;
}

/** Does head-to-head separate this pair? The arity rule lives HERE, once. */
export function h2hSeparates(
  pool: AmericanoPool,
  groupSize: number,
  a: string,
  b: string,
): boolean {
  return groupSize === 2 && headToHead(pool, a, b) !== 0;
}

/** Net wins of `a` over `b` when they were on opposing teams tonight. */
function headToHead(pool: AmericanoPool, a: string, b: string): number {
  let net = 0;
  for (const m of counted(pool)) {
    if (!m.result) continue;
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
      gameDiff: r.gameDiff,
      rank: 0,
      tiebreakApplied: null,
      requiresCoinFlip: false,
    };
  });

  // Base chain + provisional playerId order.
  rows.sort(
    (a, b) =>
      b.wins - a.wins ||
      a.losses - b.losses ||
      b.gameDiff - a.gameDiff ||
      (a.playerId < b.playerId ? -1 : 1),
  );

  // Resolve ties within equal (wins, losses, gameDiff) groups:
  // H2H (exactly two, and they met) → SOS DESC → the visible coin flip.
  const sosOf = new Map<string, number>();
  const sos = (id: string) => {
    let v = sosOf.get(id);
    if (v === undefined) { v = strengthOfSchedule(pool, id); sosOf.set(id, v); }
    return v;
  };
  const key = (r: StandingsRow) => `${r.wins}|${r.losses}|${r.gameDiff}`;
  for (let start = 0; start < rows.length; ) {
    let end = start + 1;
    while (end < rows.length && key(rows[end]) === key(rows[start])) end++;
    const size = end - start;
    // size >= 2 guards the neighbour read; h2hSeparates owns the arity rule.
    if (size >= 2 && h2hSeparates(pool, size, rows[start].playerId, rows[start + 1].playerId)) {
      const [a, b] = [rows[start], rows[start + 1]];
      if (headToHead(pool, a.playerId, b.playerId) < 0) {
        rows[start] = b;
        rows[start + 1] = a;
      }
      rows[start].tiebreakApplied = "h2h";
      start = end;
      continue;
    }
    if (size >= 2) {
      // Order the tied group by SOS DESC, provisional playerId within equal
      // SOS. Each equal-SOS RUN inside it is a flip group: a coin-decided
      // order is applied WHOLESALE or not at all — never pair by pair, which
      // is how a resolution used to go inert once a third player sorted
      // between a flipped pair.
      const group = rows.slice(start, end).sort(
        (a, b) => sos(b.playerId) - sos(a.playerId) || (a.playerId < b.playerId ? -1 : 1),
      );
      for (let i = 0; i < group.length; ) {
        let j = i + 1;
        while (j < group.length && sos(group[j].playerId) === sos(group[i].playerId)) j++;
        if (j - i >= 2) {
          const run = group.slice(i, j);
          // A run where nobody has played is a BLANK SLATE, not a tie (STEP G):
          // before the first result the whole pool shares 0-0-0 and SOS 0, and
          // flagging that would ask the room to flip coins over nothing.
          const blank = run.every((r) => r.wins + r.losses === 0);
          const key = run.map((r) => r.playerId).sort().join("|");
          const order = groupOrders.get(key);
          if (blank) {
            // nothing to order, nothing to flag
          } else if (order && order.length === run.length) {
            const byId = new Map(run.map((r) => [r.playerId, r] as const));
            for (let k = 0; k < order.length; k++) group[i + k] = byId.get(order[k])!;
            for (let k = 0; k < order.length - 1; k++) {
              group[i + k].tiebreakApplied = group[i + k].tiebreakApplied ?? "coinflip";
            }
          } else {
            for (let k = i; k < j; k++) group[k].requiresCoinFlip = true;
          }
        }
        i = j;
      }
      for (let i = 0; i < group.length - 1; i++) {
        if (sos(group[i].playerId) > sos(group[i + 1].playerId)) {
          group[i].tiebreakApplied = group[i].tiebreakApplied ?? "sos";
        }
      }
      for (let i = 0; i < group.length; i++) rows[start + i] = group[i];
    }
    start = end;
  }

  // Ranks + the cross-group annotations (what placed a row above the next).
  for (let i = 0; i < rows.length; i++) rows[i].rank = i + 1;
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i], b = rows[i + 1];
    if (a.tiebreakApplied || a.requiresCoinFlip) continue; // in-group already set
    if (a.wins !== b.wins) continue;                        // wins is the headline
    if (a.losses !== b.losses) a.tiebreakApplied = "losses";
    else if (a.gameDiff !== b.gameDiff) a.tiebreakApplied = "diff";
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
