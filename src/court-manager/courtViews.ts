// Court Manager — per-court queue views (pure functions, Architectural Law #1).
//
// The board must always answer "who's playing, and who are the NEXT TWO games
// on this court?" A court that sits idle while everyone works out who's up is
// the single biggest source of lost minutes on the night — players warm up and
// get to the gate on time only when they can SEE their game coming. So besides
// the current round's queue, each view carries the next round's games for that
// court: when the current round has fewer than two games left here, the UI
// fills the lookahead from the next round.

import type { GameResult, RoundGame, RoundScheduleResult } from "./types";

export interface CourtView {
  court: number;
  nowPlaying: RoundGame | null;
  onDeck: RoundGame | null;
  /** Remaining games on this court in the current round, in slot order. */
  upcoming: RoundGame[];
  /**
   * The NEXT round's games on this court, in slot order. Empty past the final
   * round. Shown so the court always has at least two future matchups visible
   * — including while a finished court waits on the round boundary.
   */
  nextRound: RoundGame[];
}

/** The slice of session state the views are derived from (structural). */
export interface CourtViewSession {
  config: { courts: number };
  schedule: RoundScheduleResult | null;
  currentRound: number;
  results: GameResult[];
  voidedGames: string[];
}

export function buildCourtViews(s: CourtViewSession): CourtView[] {
  const done = new Set<string>([...s.results.map((r) => r.gameId), ...s.voidedGames]);
  const games = (round: number): RoundGame[] => s.schedule?.rounds[round - 1] ?? [];
  const onCourt = (round: number, court: number) =>
    games(round)
      .filter((g) => g.court === court)
      .sort((a, b) => a.slot - b.slot);

  const views: CourtView[] = [];
  for (let court = 1; court <= s.config.courts; court++) {
    const pending = onCourt(s.currentRound, court).filter((g) => !done.has(g.id));
    views.push({
      court,
      nowPlaying: pending[0] ?? null,
      onDeck: pending[1] ?? null,
      upcoming: pending.slice(2),
      nextRound: onCourt(s.currentRound + 1, court),
    });
  }
  return views;
}
