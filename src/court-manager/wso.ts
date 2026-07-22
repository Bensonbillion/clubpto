// Court Manager v2 — Winner Stays On (§7). Pure state transitions.
//
// No schedule — a live queue. Winner stays, loser to the back, ON DECK steps
// up. Admin taps the winner; UNDO exists for misclicks; queue is reorderable.
// The optional streak cap (open product decision) is a deliberate setting:
// after N straight, the defender rotates to the back with their streak
// preserved on the stats board.

import type { WsoResultEntry, WsoState, WsoStats } from "./types";

const UNDO_DEPTH = 20;

function freshStats(pairId: string): WsoStats {
  return { pairId, wins: 0, losses: 0, streak: 0, longestStreak: 0 };
}

export function createWsoState(pairIds: string[], nowMs: number, streakCap?: number): WsoState {
  if (pairIds.length < 2) {
    throw new Error(`WSO needs at least 2 pairs (got ${pairIds.length}).`);
  }
  const [p1, p2, ...queue] = pairIds;
  const stats: Record<string, WsoStats> = {};
  for (const id of pairIds) stats[id] = freshStats(id);
  return {
    currentGame: { id: "wso1", pairIds: [p1, p2], startedAt: nowMs },
    queue,
    stats,
    history: [],
    undoStack: [],
    gameCounter: 1,
    streakCap,
  };
}

/** Admin taps the winner. Returns the next state; throws on an invalid tap. */
export function recordWsoWinner(state: WsoState, winnerPairId: string, nowMs: number): WsoState {
  const game = state.currentGame;
  if (!game) throw new Error("No game in progress on this WSO court.");
  if (!game.pairIds.includes(winnerPairId)) {
    throw new Error(`Pair ${winnerPairId} is not in the current game.`);
  }
  const loserPairId = game.pairIds[0] === winnerPairId ? game.pairIds[1] : game.pairIds[0];

  const undoEntry = {
    currentGame: game,
    queue: [...state.queue],
    stats: Object.fromEntries(Object.entries(state.stats).map(([k, v]) => [k, { ...v }])),
    historyLength: state.history.length,
  };

  const stats = { ...state.stats };
  const w = { ...(stats[winnerPairId] ?? freshStats(winnerPairId)) };
  const l = { ...(stats[loserPairId] ?? freshStats(loserPairId)) };
  w.wins += 1;
  w.streak += 1;
  w.longestStreak = Math.max(w.longestStreak, w.streak);
  l.losses += 1;
  l.streak = 0;
  stats[winnerPairId] = w;
  stats[loserPairId] = l;

  const entry: WsoResultEntry = {
    gameId: game.id,
    winnerPairId,
    loserPairId,
    startedAt: game.startedAt,
    completedAt: nowMs,
  };

  const queue = [...state.queue];
  const capHit = state.streakCap !== undefined && w.streak >= state.streakCap;

  let nextPairIds: [string, string] | null = null;
  if (capHit) {
    // Defender rotates to the back (ahead of the loser — they earned it);
    // streak stays on the stats board. Next game comes from the queue.
    queue.push(winnerPairId, loserPairId);
    if (queue.length >= 2) {
      nextPairIds = [queue.shift() as string, queue.shift() as string];
    }
  } else {
    queue.push(loserPairId);
    if (queue.length >= 1) {
      nextPairIds = [winnerPairId, queue.shift() as string];
    }
  }

  const gameCounter = state.gameCounter + 1;
  return {
    ...state,
    currentGame: nextPairIds
      ? { id: `wso${gameCounter}`, pairIds: nextPairIds, startedAt: nowMs }
      : null,
    queue,
    stats,
    history: [...state.history, entry],
    undoStack: [...state.undoStack, undoEntry].slice(-UNDO_DEPTH),
    gameCounter,
  };
}

/** Undo the last winner tap (misclicks happen courtside). */
export function undoWsoResult(state: WsoState): WsoState {
  const undo = state.undoStack[state.undoStack.length - 1];
  if (!undo) return state;
  return {
    ...state,
    currentGame: undo.currentGame,
    queue: [...undo.queue],
    stats: Object.fromEntries(Object.entries(undo.stats).map(([k, v]) => [k, { ...v }])),
    history: state.history.slice(0, undo.historyLength),
    undoStack: state.undoStack.slice(0, -1),
    gameCounter: state.gameCounter - 1,
  };
}

/** Reorder the waiting queue (same members, new order). */
export function reorderWsoQueue(state: WsoState, newQueue: string[]): WsoState {
  const a = [...state.queue].sort().join("|");
  const b = [...newQueue].sort().join("|");
  if (a !== b) throw new Error("Reorder must keep exactly the same pairs in the queue.");
  return { ...state, queue: [...newQueue] };
}

/** Late pair appends to the queue (§11). */
export function addWsoPair(state: WsoState, pairId: string): WsoState {
  if (state.stats[pairId]) return state;
  return {
    ...state,
    queue: [...state.queue, pairId],
    stats: { ...state.stats, [pairId]: freshStats(pairId) },
  };
}

/** Standings by wins (streak as tiebreak, then longest streak). */
export function wsoStandings(state: WsoState): WsoStats[] {
  return Object.values(state.stats).sort(
    (a, b) => b.wins - a.wins || b.streak - a.streak || b.longestStreak - a.longestStreak,
  );
}

/**
 * Final Challenge (§10): top 2 by wins play one decider. Returns null when
 * fewer than 2 pairs have stats (crown the current leader instead).
 */
export function wsoFinalChallenge(state: WsoState): { a: string; b: string } | null {
  const top = wsoStandings(state);
  if (top.length < 2) return null;
  return { a: top[0].pairId, b: top[1].pairId };
}

/** "Crown current leader" — the short-on-time alternative to the Final Challenge. */
export function wsoLeader(state: WsoState): string | null {
  return wsoStandings(state)[0]?.pairId ?? null;
}
