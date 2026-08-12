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
import { pairKey } from "./generator";

export const GAME_DIFF = {
  "2-0": { win: +2, loss: -2 },
  "2-1": { win: +1, loss: -1 },
} as const;

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
    const d = GAME_DIFF[m.result.score];
    const winners = m.result.winner === "A" ? m.teamA : m.teamB;
    const losers = m.result.winner === "A" ? m.teamB : m.teamA;
    for (const id of winners) { const r = get(id); r.matchesPlayed++; r.wins++; r.gameDiff += d.win; }
    for (const id of losers) { const r = get(id); r.matchesPlayed++; r.losses++; r.gameDiff += d.loss; }
  }
  return out;
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

/** pairKey(a,b) → winning playerId, supplied by the UI after a visible flip. */
export type CoinFlipResolutions = Record<string, string>;

export function computeStandings(
  pool: AmericanoPool,
  players: AmericanoPlayer[],
  coinFlipResolutions: CoinFlipResolutions = {},
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

  // Resolve ties within equal (wins, losses, gameDiff) groups.
  const key = (r: StandingsRow) => `${r.wins}|${r.losses}|${r.gameDiff}`;
  for (let start = 0; start < rows.length; ) {
    let end = start + 1;
    while (end < rows.length && key(rows[end]) === key(rows[start])) end++;
    const size = end - start;
    if (size === 2) {
      const [a, b] = [rows[start], rows[start + 1]];
      const net = headToHead(pool, a.playerId, b.playerId);
      if (net !== 0) {
        if (net < 0) { rows[start] = b; rows[start + 1] = a; }
        rows[start].tiebreakApplied = "h2h";
      } else {
        const resolved = coinFlipResolutions[pairKey(a.playerId, b.playerId)];
        if (resolved === a.playerId || resolved === b.playerId) {
          if (resolved === b.playerId) { rows[start] = b; rows[start + 1] = a; }
          rows[start].tiebreakApplied = "coinflip";
        } else {
          rows[start].requiresCoinFlip = true;
          rows[start + 1].requiresCoinFlip = true;
        }
      }
    } else if (size > 2) {
      // Multi-way tie: apply any pairwise resolutions to adjacent rows until
      // stable; anything still unresolved carries the flag.
      let moved = true;
      let guard = size * size;
      while (moved && guard-- > 0) {
        moved = false;
        for (let i = start; i < end - 1; i++) {
          const resolved = coinFlipResolutions[pairKey(rows[i].playerId, rows[i + 1].playerId)];
          if (resolved === rows[i + 1].playerId) {
            [rows[i], rows[i + 1]] = [rows[i + 1], rows[i]];
            moved = true;
          }
        }
      }
      for (let i = start; i < end; i++) {
        const prevOk = i === start || coinFlipResolutions[pairKey(rows[i - 1].playerId, rows[i].playerId)] !== undefined;
        if (i > start && prevOk) rows[i - 1].tiebreakApplied = rows[i - 1].tiebreakApplied ?? "coinflip";
        if (!prevOk && i > start) { rows[i - 1].requiresCoinFlip = true; rows[i].requiresCoinFlip = true; }
      }
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
