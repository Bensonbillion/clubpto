// Shared prop shapes for the `play` slice (frames 10, 11, 12).
//
// Presentational only. These are the flattened views the three frames consume;
// the caller derives them from the domain model in src/manage/types.ts.

/** One side of the match card. `pairLabel` is the two names joined with " and ". */
export interface PairSide {
  pairLabel: string;
  /** Null until a result is recorded. The slat renders null as 00. */
  score: number | null;
}

/** A player on the bench for this court, in queue order. */
export interface WaitingPlayer {
  playerId: string;
  name: string;
  /** True when this player is in the next draw on this court. */
  isOnNext: boolean;
}

/** The status strings the court strip is allowed to render. */
export type CourtStatus = "Mid-match" | "Waiting on a score" | "Nobody assigned";

export interface CourtSummary {
  number: number;
  /** Undefined while the status has not loaded. The card then shows the number only. */
  status?: CourtStatus;
  scoreDue: boolean;
}

/** Two-digit zero padding for the score slat. A match with no result reads 00. */
export const padScore = (score: number | null): string =>
  String(score ?? 0).padStart(2, "0");
