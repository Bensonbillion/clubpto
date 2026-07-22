// Court Manager v2 — Sunday least-played-first per-court generation (§7).
//
// Each isolated court is a self-contained world. Slots are generated one at a
// time from live per-pair state; late pairs enter with max priority (999).
// Guarantees: counts never differ by more than 1 on a court; late pairs play
// within 1–2 slots; max sit-out 3 slots (4 with 7+ pairs).

import type { LpfPairState } from "../types";
import { matchKey } from "./rounds";

export interface LpfCourt {
  courtNumber: number;
  pairIds: string[];
  states: Record<string, LpfPairState>;
  /** Matchups already played on this court (matchKey set). */
  played: Set<string>;
  /** Slots generated so far (for stats/inspection). */
  slotLog: (readonly [string, string] | null)[];
}

export interface LpfOptions {
  /** Minimum slots of rest between a pair's games (normal 1; coaches 3). */
  restGapFor?: (pairId: string) => number;
}

const NEVER_PLAYED = 999;

export function createLpfCourt(courtNumber: number, pairIds: string[]): LpfCourt {
  const states: Record<string, LpfPairState> = {};
  for (const id of pairIds) {
    states[id] = { pairId: id, gamesPlayed: 0, slotsSinceLastGame: NEVER_PLAYED };
  }
  return { courtNumber, pairIds: [...pairIds], states, played: new Set(), slotLog: [] };
}

/** Late pair joins mid-session with max priority — first game within 1–2 slots. */
export function addLpfPair(court: LpfCourt, pairId: string): void {
  if (court.states[pairId]) return;
  court.pairIds.push(pairId);
  court.states[pairId] = { pairId, gamesPlayed: 0, slotsSinceLastGame: NEVER_PLAYED };
}

/** Removal voids only this pair's future; everything played stays played. */
export function removeLpfPair(court: LpfCourt, pairId: string): void {
  court.pairIds = court.pairIds.filter((id) => id !== pairId);
  delete court.states[pairId];
}

function sortedByPriority(court: LpfCourt): LpfPairState[] {
  // games_played ASC, then slots_since_last_game DESC (999 = never → front).
  return court.pairIds
    .map((id) => court.states[id])
    .sort((a, b) => a.gamesPlayed - b.gamesPlayed || b.slotsSinceLastGame - a.slotsSinceLastGame);
}

/**
 * Pick the next slot's game. Team A = first sorted pair not violating rest;
 * Team B = next sorted pair excluding prior opponents of Team A. Relax the
 * game-count equity by 1 if stuck; leave the slot EMPTY rather than force an
 * invalid game. Advances all per-pair state.
 */
export function nextLpfSlot(court: LpfCourt, opts: LpfOptions = {}): readonly [string, string] | null {
  const restGap = opts.restGapFor ?? (() => 1);
  const sorted = sortedByPriority(court);
  const rested = sorted.filter((s) => s.slotsSinceLastGame >= restGap(s.pairId));
  const minGames = sorted.length > 0 ? Math.min(...sorted.map((s) => s.gamesPlayed)) : 0;

  let game: readonly [string, string] | null = null;

  outer: for (const equitySlack of [1, 2]) {
    for (const a of rested) {
      if (a.gamesPlayed > minGames + equitySlack - 1) continue;
      for (const b of rested) {
        if (b.pairId === a.pairId) continue;
        if (b.gamesPlayed > minGames + equitySlack) continue;
        if (court.played.has(matchKey(a.pairId, b.pairId))) continue;
        game = [a.pairId, b.pairId] as const;
        break outer;
      }
    }
  }
  // No valid new matchup among rested pairs → empty slot, never a forced repeat.

  for (const id of court.pairIds) {
    const s = court.states[id];
    if (game && (id === game[0] || id === game[1])) {
      s.gamesPlayed += 1;
      s.slotsSinceLastGame = 0;
    } else if (s.slotsSinceLastGame !== NEVER_PLAYED) {
      s.slotsSinceLastGame += 1;
    }
  }
  if (game) court.played.add(matchKey(game[0], game[1]));
  court.slotLog.push(game);
  return game;
}
