// Shared copy helpers for the `people` slice.
//
// They live here rather than beside a component so every tsx file in the slice
// exports components and nothing else, which is what keeps fast refresh
// working on the screens an operator is most likely to be staring at while
// somebody edits them.

/**
 * A pair, as every v3 frame writes one: "Ayo & Kayode".
 *
 * The ampersand is the frames' choice, not shorthand. It reads as one unit at
 * a glance, which is what a pair is on a match card, where "and" invites the
 * eye to read four separate names.
 */
export const pairName = (pair: readonly [string, string]): string => `${pair[0]} & ${pair[1]}`;

const WORDS = [
  "zero", "one", "two", "three", "four", "five", "six",
  "seven", "eight", "nine", "ten", "eleven", "twelve",
];

/**
 * A small count spelled out, because the frames spell them in sentences:
 * "the seven still here", "Leave it at three".
 *
 * Past twelve it falls back to digits rather than growing an English number
 * speller for counts a padel court cannot hold.
 */
export const countWord = (n: number): string =>
  n >= 0 && n < WORDS.length ? WORDS[n] : String(n);

/**
 * The footer's one sentence for a round robin court.
 *
 * It used to be printed flat, as a promise: counts never drift more than one
 * game apart. Since 2026-09-10 that is not always true. The third law, one
 * game with the B's and never a second, is allowed to hold a least-played
 * player back a game, and a walk-in or a leaver can open a gap of its own.
 * So the sentence is now a reading of the court in front of the operator,
 * and the promise is only made on a court that is keeping it. The spread
 * comes from engine/rotation.ts courtSpread, the same number frame 11 guards
 * its own promise on.
 */
export const roundRobinCounts = (spread: number): string =>
  spread <= 1
    ? "Counts never drift more than one game apart."
    : `Counts are ${countWord(spread)} games apart right now. `
      + "The one game with the B's can hold a player back.";
