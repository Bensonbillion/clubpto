// Court Manager v3 — live-session safety guards (2-court focus).
//
// Pure predicates, unit-tested in sessionSafety.test.ts. They exist to make a
// class of "one stray tap wipes the night" bugs structurally impossible:
//   - setup-only actions (START SESSION, GENERATE PAIRS, config, demo roster)
//     must be inert once a round is under way;
//   - the board must never advance into a round the scheduler never generated;
//   - clearing the schedule must wipe every derived field but keep the roster.

export type SessionPhaseLike = "setup" | "rounds" | "playoffs" | "done";

/** Setup-phase-only actions (re-pair, restart, court/round config) are inert after kickoff. */
export function canMutateSetup(phase: SessionPhaseLike): boolean {
  return phase === "setup";
}

/**
 * Is there a real next round to advance into? `currentRound` is 1-based, so the
 * next round is `rounds[currentRound]`. False when it doesn't exist or is empty
 * — advancing into an empty round hard-stalls the board (nothing to complete,
 * every button dead, reset the only escape).
 */
export function canAdvanceToNextRound<T>(rounds: T[][] | null | undefined, currentRound: number): boolean {
  const next = rounds?.[currentRound];
  return Array.isArray(next) && next.length > 0;
}

export interface TwoCourtScheduleFields {
  pairs: unknown[];
  currentRound: number;
  results: unknown[];
  voidedGames: unknown[];
  gameStarts: Record<string, unknown>;
  schedule: unknown;
  playoffs: unknown;
  champion: unknown;
}

/**
 * Cleared shape uses `never[]` / `null` so the result spreads cleanly into any
 * concretely-typed session state (never[] ⊆ Pair[], null ⊆ T | null).
 */
export interface ClearedTwoCourtSchedule {
  pairs: never[];
  currentRound: number;
  results: never[];
  voidedGames: never[];
  gameStarts: Record<string, never>;
  schedule: null;
  playoffs: null;
  champion: null;
}

/**
 * Clear every schedule-derived field for a fresh 2-court session while
 * preserving the roster (handled by the caller). Single source of truth for
 * "clear the schedule" so reset and re-generate can't drift apart.
 */
export function clearTwoCourtSchedule(_state: TwoCourtScheduleFields): ClearedTwoCourtSchedule {
  return {
    pairs: [],
    currentRound: 0,
    results: [],
    voidedGames: [],
    gameStarts: {},
    schedule: null,
    playoffs: null,
    champion: null,
  };
}
