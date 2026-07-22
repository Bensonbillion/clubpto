// Court Manager v2 — edge-case logic (§11): sub rotation and score correction.
//
// Late arrivals and removals live in the schedulers (regenerateFromRound /
// addLpfPair / removeLpfPair / addWsoPair); tier moves compose removal +
// late-arrival on the destination court. This module holds the rest.

import type { GameResult } from "./types";

// ---------------------------------------------------------------------------
// Sub rotation — PROPOSES only. There is NO auto-confirm: a machine benching a
// player who then walks onto court is socially unacceptable. The UI escalates
// the prompt until a human answers confirm / pick different / skip.
// ---------------------------------------------------------------------------

export interface SubRotationState {
  subPlayerId: string;
  /** Games completed by the sub's pair since the sub last rotated in/out. */
  gamesSinceRotation: number;
  timesSubbedOut: Record<string, number>;
}

export interface SubPlayerStats {
  playerId: string;
  gamesPlayed: number;
}

export const SUB_SITS_GAMES = 2;

export interface SubProposal {
  outPlayerId: string;
  inPlayerId: string;
  reason: string;
}

export function createSubRotation(subPlayerId: string): SubRotationState {
  return { subPlayerId, gamesSinceRotation: 0, timesSubbedOut: {} };
}

/** Call after each completed game on the sub's court. */
export function tickSubRotation(state: SubRotationState): SubRotationState {
  return { ...state, gamesSinceRotation: state.gamesSinceRotation + 1 };
}

/**
 * After the sub sits SUB_SITS_GAMES games, propose swapping them in for the
 * candidate with the most games played and the fewest times subbed out.
 * Returns null while no rotation is due.
 */
export function proposeSubRotation(
  state: SubRotationState,
  candidates: SubPlayerStats[],
): SubProposal | null {
  if (state.gamesSinceRotation < SUB_SITS_GAMES) return null;
  const eligible = candidates.filter((c) => c.playerId !== state.subPlayerId);
  if (eligible.length === 0) return null;
  const pick = [...eligible].sort(
    (a, b) =>
      b.gamesPlayed - a.gamesPlayed ||
      (state.timesSubbedOut[a.playerId] ?? 0) - (state.timesSubbedOut[b.playerId] ?? 0) ||
      (a.playerId < b.playerId ? -1 : 1),
  )[0];
  return {
    outPlayerId: pick.playerId,
    inPlayerId: state.subPlayerId,
    reason: `${pick.playerId} has the most games (${pick.gamesPlayed}) and fewest sits (${state.timesSubbedOut[pick.playerId] ?? 0}).`,
  };
}

/** Human confirmed (possibly with a different pick). The replaced player becomes the new sub. */
export function applySubRotation(state: SubRotationState, outPlayerId: string): SubRotationState {
  return {
    subPlayerId: outPlayerId,
    gamesSinceRotation: 0,
    timesSubbedOut: {
      ...state.timesSubbedOut,
      [outPlayerId]: (state.timesSubbedOut[outPlayerId] ?? 0) + 1,
    },
  };
}

/** Human skipped this rotation — ask again after the next game, not in 2. */
export function skipSubRotation(state: SubRotationState): SubRotationState {
  return { ...state, gamesSinceRotation: SUB_SITS_GAMES - 1 };
}

// ---------------------------------------------------------------------------
// Result correction (§9): tap any completed game, flip the winner.
// Standings/seedings are always DERIVED from the results list, so a correction
// is just an edit — everything downstream recalculates automatically.
// ---------------------------------------------------------------------------

export function correctResult(results: GameResult[], gameId: string, winnerPairId: string): GameResult[] {
  return results.map((r) => {
    if (r.gameId !== gameId) return r;
    if (winnerPairId !== r.winnerPairId && winnerPairId !== r.loserPairId) {
      throw new Error(`Pair ${winnerPairId} did not play game ${gameId}.`);
    }
    if (winnerPairId === r.winnerPairId) return r;
    return { ...r, winnerPairId, loserPairId: r.winnerPairId };
  });
}
