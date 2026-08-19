// How a court ends, and the ending that is not a bracket.
//
// Each court decides on the night and the other court is unaffected (frame
// 19). That independence is the whole shape of this module: every function
// here takes one court number, reads only that court, and returns only that
// court's answer. Nothing takes two courts.
//
// THE THING THIS MODULE DELIBERATELY DOES NOT BUILD: a crossover final between
// the two courts' winners. It is not an oversight and it is not a to-do. A
// crossover re-ranks the courts and crowns one court's pair the real champion,
// which is the hierarchy the whole design refuses. Court 1's champion and
// Court 2's champions are equally the story of the night (spec, "The close",
// and frame 25: "Two champions, no crossover final. Neither court outranks the
// other."). If a future change wants a single winner for the room, that is a
// product decision to argue about first, not a function to add here.
//
// The two endings themselves:
//   - The doubles bracket. Four pairs, two semis, a final. That bracket lives
//     in ./playoff; this module only models the CHOICE of it.
//   - One more round. No bracket. The target rises by one, everyone plays
//     once more, and whoever tops the table is the individual champion. One
//     person, not a pair (frame 24).
//
// Pure, and it carries no copy. The wording for both options is drawn on
// frame 19 and belongs to the screen.

import type { CourtNumber, Match, Player } from "../types";
import { readiness } from "./playoff";
import { totalMatches, validTargets } from "./rotation";
import type { StandingsRow } from "./standings";

/** An ending a court has actually picked. */
export type ChosenEnding = "doublesBracket" | "oneMoreRound";

/**
 * What a court has decided, including the state before it has decided
 * anything. "undecided" is a real value rather than a null so a court that has
 * met its targets and a court still playing are never conflated: the first is
 * undecided and may choose, the second is undecided and may not.
 */
export type CourtEnding = ChosenEnding | "undecided";

/** Per court, so one court's decision cannot touch another's. */
export type CourtEndings = Readonly<Record<CourtNumber, CourtEnding>>;

/** A court nobody has decided for yet reads as undecided, not as missing. */
export function endingFor(endings: CourtEndings, court: CourtNumber): CourtEnding {
  return endings[court] ?? "undecided";
}

/**
 * Record one court's choice. Returns a new map with every other court's entry
 * untouched, which is the independence rule made mechanical rather than
 * remembered.
 */
export function chooseEnding(
  endings: CourtEndings,
  court: CourtNumber,
  choice: ChosenEnding,
): CourtEndings {
  return { ...endings, [court]: choice };
}

export interface EndingReadiness {
  /** True once this court's targets are met. */
  mayChoose: boolean;
  /** Matches still owed on this court, 0 when the targets are met. */
  matchesOutstanding: number;
}

/**
 * May this court choose its ending yet?
 *
 * This delegates to the playoff's readiness rather than restating the rule,
 * and that matters: the offer of an ending and the offer of a bracket have to
 * open at the same instant. Two copies of "targets met" drift, and the drift
 * shows up as a screen offering "one more round" on a court that still owes a
 * score, which would then raise the target on an unfinished table.
 */
export function mayChooseEnding(
  players: readonly Player[],
  matches: readonly Match[],
  court: CourtNumber,
  targetMatches: number,
): EndingReadiness {
  const ready = readiness(players, matches, court, targetMatches);
  return { mayChoose: ready.ready, matchesOutstanding: ready.matchesOutstanding };
}

export interface OneMoreRound {
  /** Exactly one more than the target the court has been running. */
  targetMatches: number;
  /** Matches this court adds by playing the extra round. */
  extraMatches: number;
  /**
   * False when the raised target does not divide into fours. Ten a side is
   * the case that bites: ten by four is ten matches, ten by five is twelve and
   * a half, so that court cannot give everyone one more game (frame 26). The
   * frames draw no wording for an unavailable "one more round", so this stays
   * a fact for the screen to phrase, not a sentence invented here.
   */
  possible: boolean;
}

/**
 * What changes when a court chooses one more round.
 *
 * The whole ending is one number: the target goes up by one. Rotation already
 * works in terms of what a player is OWED against the target, so raising it
 * puts every player back in the queue owed exactly one game, with no
 * bookkeeping of who has had their extra match and who has not.
 */
export function oneMoreRoundChange(
  courtSize: number,
  targetMatches: number,
): OneMoreRound {
  const raised = targetMatches + 1;
  const possible = validTargets(courtSize).includes(raised);
  return {
    targetMatches: raised,
    // Only whole when the raise is possible, which is why it is gated. A court
    // where consecutive targets both divide is a court whose size is a
    // multiple of four, so this subtraction never yields a fraction here.
    extraMatches: possible
      ? totalMatches(courtSize, raised) - totalMatches(courtSize, targetMatches)
      : 0,
    possible,
  };
}

export interface RunnerUp {
  playerId: string;
  rank: number;
  points: number;
}

export interface IndividualChampion {
  playerId: string;
  points: number;
  wins: number;
  matchesPlayed: number;
  /** Frame 24 reads "12 points · won all 4", so the screen needs this fact. */
  wonEveryMatch: boolean;
  second: RunnerUp | null;
  third: RunnerUp | null;
  /**
   * What separated second from third, straight off the standings row. Frame
   * 24's closing line, "Chizea second on 9, Timi third on 9 by score
   * difference", is only true when this is "diff", so the screen reads it
   * rather than guessing from the numbers.
   */
  secondFromThird: StandingsRow["separatedBy"];
}

/**
 * The individual champion, from a court's finished table.
 *
 * It is rows[0] and nothing more, because standings are already a total order:
 * points, then score difference, then who reached the total first. A tie for
 * the title is therefore not a case this function has to handle, and there is
 * no coin here for the same reason there is no coin in the table.
 *
 * Null when the court has no finished table to crown from. A court where
 * nobody played has a top row, and crowning it would name a champion who never
 * walked on.
 */
export function individualChampion(
  rows: readonly StandingsRow[],
): IndividualChampion | null {
  const top = rows[0];
  if (!top || top.matchesPlayed === 0) return null;

  const runnerUp = (row: StandingsRow | undefined): RunnerUp | null =>
    row ? { playerId: row.playerId, rank: row.rank, points: row.points } : null;

  return {
    playerId: top.playerId,
    points: top.points,
    wins: top.wins,
    matchesPlayed: top.matchesPlayed,
    wonEveryMatch: top.wins === top.matchesPlayed,
    second: runnerUp(rows[1]),
    third: runnerUp(rows[2]),
    // The row's own discriminator describes the gap to the row below it, so
    // second's is the one that describes second against third.
    secondFromThird: rows[1]?.separatedBy ?? null,
  };
}
