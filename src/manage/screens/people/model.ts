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
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen",
  "nineteen", "twenty", "twenty-one", "twenty-two", "twenty-three", "twenty-four",
];

/**
 * A small count spelled out, because the frames spell them in sentences:
 * "the seven still here", "Leave it at three".
 *
 * It stopped at twelve until 2026-09-11, which a court does hold: twenty on
 * one court is the Wednesday roster, and "13 still here" sat in a sentence
 * the rest of which spelled its numbers. Past twenty-four it falls back to
 * digits rather than growing an English number speller for a room no court
 * takes.
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
 *
 * The gap is stated and the cause is NOT (2026-09-11). This function is
 * handed one number and nothing else, so it cannot know which of the three
 * opened the gap, and a court three games apart is certainly not the cap,
 * which is allowed to cost exactly one game. It briefly named the cap for
 * any gap at all, which told a player who had just walked in something
 * untrue about the rule. Frame 11 names a cause only where the picker's own
 * account supports it; so does this.
 */
export const roundRobinCounts = (spread: number): string =>
  spread <= 1
    ? "Counts never drift more than one game apart."
    : `Counts are ${countWord(spread)} games apart right now.`;
