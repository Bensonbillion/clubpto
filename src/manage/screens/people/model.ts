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
