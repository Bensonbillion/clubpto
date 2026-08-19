// Shared prop shapes and copy helpers for the `play` slice.
//
// Frames 10 Court view, 11 Balance rule, 12 Score entry, 12b Schedule,
// 13 Both courts one device.
//
// Presentational only. These are the flattened views the frames consume; the
// caller derives them from the domain model in src/manage/types.ts. The string
// builders live here rather than in a component file so that the slice's tsx
// files export components and nothing else, which is what keeps fast refresh
// working on them.

/** One side of the match. `pairLabel` is the two names as the frames write
 *  them, joined with an ampersand: "Chizea & Ayo". */
export interface PairSide {
  pairLabel: string;
  /** Null until a result is recorded. The slat renders null as 00. */
  score: number | null;
}

/** A player on the bench for this court, in queue order. */
export interface WaitingPlayer {
  playerId: string;
  name: string;
}

/**
 * A court as the header chip row shows it (frames 10 and 12).
 *
 * The dot is the whole point of the chip row. Both courts run at once on one
 * phone, so the operator has to be able to see, without leaving the court they
 * are standing on, that the other one has finished a match and is waiting on a
 * number. One terracotta dot says that.
 */
export interface CourtChip {
  number: number;
  /** That court has a finished match with no score in it. */
  scoreDue: boolean;
}

/**
 * What a court is doing, spelled out for frame 13's sheet.
 *
 * The chip row can only carry a dot. The sheet has room for the sentence, and
 * frame 13 spends it saying which court is mid-match and which is waiting on a
 * score, each with the round it is on.
 */
export type CourtActivity =
  /** Four are on court and nothing has been recorded yet. */
  | { kind: "midMatch"; round: number }
  /** The match finished and the score has not been entered. */
  | { kind: "scoreDue"; round: number };

export interface CourtSummary {
  number: number;
  /** Omitted for a court with nobody on it. Frame 13 draws no wording for
   *  that court, so the row renders its number and no status line. */
  activity?: CourtActivity;
}

/**
 * A row of frame 12b's schedule.
 *
 * Every match of the night is drawn up front and nothing has to happen in
 * order, so a row's status is not a position in a list: "skipped" is a real
 * state a match sits in until the operator comes back to it, and it is why
 * this is a union rather than a played flag.
 */
export type ScheduleRowStatus = "played" | "live" | "skipped" | "upNext" | "waiting";

export interface ScheduleRow {
  matchId: string;
  /** 1-based, in schedule order. Frame 12b prints it down the left. */
  number: number;
  pairA: string;
  pairB: string;
  /** Both null until the match is played. */
  scoreA: number | null;
  scoreB: number | null;
  status: ScheduleRowStatus;
}

/** Two-digit zero padding, for the score slat only. An empty slat reads 00. */
export const padScore = (score: number | null): string =>
  String(score ?? 0).padStart(2, "0");

/** Frame 13's status line, in the frame's own two sentences. */
export const courtActivityLine = (activity: CourtActivity): string =>
  activity.kind === "midMatch"
    ? `Mid match, round ${activity.round}`
    : `Round ${activity.round} finished, score not in`;

/** "Chizea, Ayo, Abiola and Timi", the way frame 11 lists the four. */
export const joinNames = (names: readonly string[]): string => {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
};
