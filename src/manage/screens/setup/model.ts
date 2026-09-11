// Shared copy for the `setup` slice.
//
// Frames 05 Which night, 06 Who is here, 07 Split the courts, 08 Matches each,
// 09 Ready.
//
// The string builders live here rather than in a component file so that the
// slice's tsx files export components and nothing else, which is what keeps
// fast refresh working on them, and so the sentences can be read in a test
// without rendering a screen. The same reason the `play` slice has one.

import type { SplitNote } from "../../engine/split";

/**
 * "Kate", "Kate and Sam", "Kate, Sam and Priya". A stranding warning has to
 * NAME who is stuck, because a sentence that only counts them sends the
 * operator hunting through the chips for the person it means.
 */
const listNames = (names: readonly string[]): string =>
  names.length <= 1
    ? names[0] ?? ""
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

/**
 * A small count spelled out, because the notes are sentences and the frames
 * spell counts inside a sentence.
 *
 * It stopped at twelve until 2026-09-11, on the grounds that a night does not
 * reach further. The cap notes do: the target step offers up to eight games
 * each, and three A's with a lone B at eight each need twenty-four seats
 * across the net, so the note read "need 24 seats" in a sentence that had
 * just spelled "Three A's". Twenty-four is the largest number either note can
 * quote on a court of twenty-four, so the list runs to there and the digits
 * are left as a fallback nothing is expected to reach.
 */
const NUMBER_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six",
  "seven", "eight", "nine", "ten", "eleven", "twelve",
  "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen",
  "nineteen", "twenty", "twenty-one", "twenty-two", "twenty-three", "twenty-four",
];
const countWord = (n: number): string =>
  n >= 0 && n < NUMBER_WORDS.length ? NUMBER_WORDS[n] : String(n);
const startsSentence = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/**
 * The words for one setup warning.
 *
 * The frames draw no exact wording for any of these, so the sentences are
 * the spec's facts kept in the frames' register: short and declarative, the
 * consequence stated rather than the maths hidden.
 *
 * The wording is the whole point of a warning, so it is checked as a string
 * in a test rather than through a render.
 */
export const noteWords = (note: SplitNote): string => {
  switch (note.kind) {
    case "tooFewCs":
      return `Only ${note.cCount === 1 ? "one C" : "two C's"} tonight, so no legal C match can form. `
        + "They play among the B's, still never with an A.";
    case "exactlyThreeCs":
      return `Three C's tonight, so every C match on Court ${note.courtNumber} needs the designated B. `
        + "That B plays more games than their own target.";
    case "courtTooSmall":
      return `Only ${note.size === 1 ? "one player" : note.size === 2 ? "two players" : "three players"}`
        + ` on Court ${note.courtNumber}, and a match needs four. It cannot run until someone moves.`;
    case "stranded":
      // The shell derives this one after every drag (see engine/substitutes.ts):
      // a second B dragged onto the C court, or a C left among A's, has nobody
      // the laws allow them on court with, and the honest moment to say so is
      // now, before the night starts, not in round two when their name never
      // comes up. FLAG: no frame draws wording for it, so the sentence is
      // invented in the same register as the notes above.
      return `${listNames(note.names)} ${note.names.length === 1 ? "has" : "have"} no legal game`
        + ` on Court ${note.courtNumber}: the balance laws leave them nobody to play with.`
        + " Move them, or bring company across.";
    case "capBends": {
      // The third law bending, said as a consequence rather than as maths.
      // The arithmetic is the operator's own: this many A's owing this many
      // games each leaves the B's needing that many seats across the net,
      // and there are not enough A's to fill them once each. The target is
      // named because it is the number that makes the difference, and it is
      // named as a suggestion while it still is one: this step comes before
      // the target step, so the number on screen is whatever the split
      // seeded until the operator has chosen.
      const each = `at ${note.suggested ? "the suggested " : ""}${countWord(note.target)} each`;
      const who = note.aCount === 1
        ? `One A ${each} on Court ${note.courtNumber} needs`
        : `${startsSentence(countWord(note.aCount))} A's ${each} on Court ${note.courtNumber} need`;
      // One A on the court is an ordinary split, not a corner, and "Every A"
      // about one person reads as a template showing through. That A takes
      // every seat the note just counted, so the sentence says how many
      // rather than how many of them there are (2026-09-11).
      const bend = note.aCount === 1
        ? note.seats === 2
          ? "That A meets the B's twice."
          : `That A meets the B's ${countWord(note.seats)} times.`
        : note.secondGames <= note.aCount
          ? `${startsSentence(countWord(note.secondGames))} `
            + `${note.secondGames === 1 ? "A meets" : "A's meet"} the B's twice.`
          : "Every A meets the B's more than once.";
      return `${who} ${countWord(note.seats)} seats across the net from the B's. ${bend}`;
    }
    case "capStuck": {
      // Not a bend of the third law, a court that cannot be dealt out level
      // at all. "Off target" rather than "short", because the court misses
      // in both directions: two A's and two B's with two C's at four each
      // stalls the two A's on one game while the B's and C's play on past
      // four, and two A's with three B's at four each finishes the two on
      // six while the three finish on four.
      // The two ways out are named the way the stranding note names its own.
      const each = `${note.suggested ? "the suggested " : ""}${countWord(note.target)}`;
      return `The balance laws cannot give everyone on Court ${note.courtNumber} exactly`
        + ` ${each} games. Some players finish off target. Change the target, or move`
        + " somebody across.";
    }
  }
};
