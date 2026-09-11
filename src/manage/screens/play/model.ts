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

import type { MatchReason, MixingNote } from "../../engine/rotation";

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

/**
 * The first card's sentence, which has to stay true.
 *
 * "They had played the fewest games" was simply true until 2026-09-10. The
 * third law is now allowed to hold a least-played player back a game, so on
 * the draws where it did, the sentence says who was passed over and why
 * rather than claiming something the four does not support. The second
 * sentence is a promise about the whole court, so it is only printed when
 * the court is actually keeping it. A court whose counts have drifted, which
 * takes someone arriving mid-night and being marked away again, gets the
 * first sentence alone. The frame draws no wording for either exception and
 * none is invented beyond its register.
 */
export const leastPlayedWords = (reason: MatchReason): string => {
  const names = joinNames(reason.leastPlayed.map((p) => p.name));
  const held = reason.mixing.heldBack;
  // Who was held back is a counterfactual only the draw itself knows, so
  // this branch comes from the picker's own account of the four and never
  // from a match read back off the log, where the list is empty by design.
  if (held.length > 0) {
    return `${names} are on. ${joinNames(held.map((p) => p.name))} had played fewer, but putting`
      + " them on would have cost an A a second game with the B's, so they wait a round.";
  }
  return `${names} had played the fewest games, so they are on.`
    + (reason.withinOneGame ? " Nobody on this court is ever more than one game behind." : "");
};

/**
 * The fourth card's sentence: what the third law did for this four.
 *
 * Null when there is no A in the match, because the law is then silent and a
 * card that says so is a card the operator reads for nothing. Each wording
 * says only what the reason supports. "pure" knows one thing, that no B is in
 * the match: it does NOT know whether those A's have already had their game,
 * and it cannot count the four either, because a hand-made substitution can
 * put somebody else in one of the seats. So it states the allowance rather
 * than claiming the game is behind them or the four is four A's. "firstBGame"
 * knows every A in the four is on their first. "secondBGame" knows one of
 * them is not, and the honest thing there is the arithmetic: the court's
 * numbers leave the B's more seats across the net than the A's can fill once
 * each, which is the one case the law bends (2026-09-10).
 */
export const mixingWords = (mixing: MixingNote): string | null => {
  const names = joinNames(mixing.aNames);
  switch (mixing.kind) {
    case "noAs":
      return null;
    case "pure":
      return `${names} are in a match with no B in it. One game with the B's a night is the`
        + " whole allowance, so the rest of an A's night is played among the A's.";
    case "firstBGame":
      return `${names} ${mixing.aNames.length === 1 ? "is" : "are"} having their one game`
        + " with the B's.";
    case "secondBGame":
      return `${names} are in with the B's, and for one of them it is a second game.`
        + " The numbers leave more seats across the net than the A's can fill once each,"
        + " so the second games are spread rather than stacked on one A.";
  }
};
