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
      // four. Two A's with three B's at four each used to stand here as
      // the second example and no longer belongs: the ladder in
      // lawForOwedSeats deals that court its five games level, so it is
      // finishable and the screen says nothing about it (2026-09-11).
      // The two ways out are named the way the stranding note names its own.
      const each = `${note.suggested ? "the suggested " : ""}${countWord(note.target)}`;
      return `The balance laws cannot give everyone on Court ${note.courtNumber} exactly`
        + ` ${each} games. Some players finish off target. Change the target, or move`
        + " somebody across.";
    }
  }
};

// ---------------------------------------------------------------------------
// The forward action on frame 07.
//
// The step drew its warnings in red and then offered a fully enabled "Next:
// matches each" underneath them. The audit of 2026-09-15 found that an
// operator setting up at 8:05 with a queue at the desk taps straight past the
// red, and that the symptom on the night is only a player whose name never
// comes up.
//
// So the step ASKS. It does not refuse, and the measurement is the reason.
// Over every A/B/C mix a night of five to twenty-six can take, 303 shapes have
// no court count at all (1, 2 or 3) that clears both warnings, and fourteen of
// them exist at every headcount from eight to twenty-six. One A at a
// beginners' night, 1A/2B/9C, is one of them: that A can never be dealt a
// lawful game at any split, so a disabled Next would stop the night for the
// other eleven people. engine/standings.ts calls the old coin-flip gate "the
// single largest source of 'why is the app stopping me' on a live night", and
// a disabled Next here would have been the second. The app must never be the
// reason a night does not start.
//
// MatchesEach.tsx can safely disable its own Next, and the difference is worth
// holding on to: on that screen a cure always exists, because every court of
// four or more has at least one runnable target. This screen has no such
// guarantee, which is exactly why it asks instead of refusing.
//
// Which notes ask and which stay quiet is the whole of the decision, so it
// lives here as a function over notes, beside the sentences, and is tested as
// one. There is no DOM test environment (vitest.config.ts sets "node"), so a
// decision buried in an onClick would be untestable.

/**
 * The two notes that mean a named person gets no game at all.
 *
 * `stranded` is somebody the balance laws leave with no legal foursome, and
 * `courtTooSmall` is a court of fewer than four that cannot run. Both end the
 * same way for the people involved: their name never comes up.
 */
// Every kind answers, and the compiler makes sure of it. tsconfig.app.json
// runs with "strict": false and no noImplicitReturns, so the obvious spelling,
// a type guard listing two kinds by hand, lets a SEVENTH note kind arrive and
// be silently non-blocking: nothing breaks, nothing warns, and the new warning
// quietly never asks. The `satisfies` below is a real gate whatever the strict
// flags say. Adding a kind to SplitNote stops the build here until somebody
// decides whether it means a person gets no game.
const BLOCKS_THE_NIGHT = {
  tooFewCs: false,
  exactlyThreeCs: false,
  capBends: false,
  capStuck: false,
  courtTooSmall: true,
  stranded: true,
} as const satisfies Record<SplitNote["kind"], boolean>;

// Derived from the record rather than retyped, so the two cannot drift apart.
type BlockingKind = {
  [K in SplitNote["kind"]]: (typeof BLOCKS_THE_NIGHT)[K] extends true ? K : never;
}[SplitNote["kind"]];
type StartBlocker = Extract<SplitNote, { kind: BlockingKind }>;

const isStartBlocker = (note: SplitNote): note is StartBlocker =>
  BLOCKS_THE_NIGHT[note.kind];

/**
 * How many NAMED people this note leaves with nobody to play.
 *
 * Only the stranded are counted, and that is a correctness point rather than a
 * stylistic one. Stranded names come from engine/substitutes.ts
 * strandedPlayers, which deliberately excludes anyone marked away.
 * `courtTooSmall.size` is the chips on the court and includes them. Summing
 * the two would say "three people" about a court of three where one of them
 * went home at nine having played four games, and the headcount is the one
 * claim in this paragraph that cannot afford to be wrong. A court too small
 * is named in its own clause instead, which loses nothing: that clause
 * already quotes the size.
 */
const peopleLeftOut = (note: StartBlocker): number =>
  note.kind === "stranded" ? note.names.length : 0;

/**
 * One blocker, said as the fact it is.
 *
 * Shorter than the same note's `noteWords`, deliberately. The operator has
 * already read the long version in red on the screen behind the sheet; what
 * the sheet owes them is the names and the courts, not the advice a second
 * time in a smaller box.
 */
const blockerClause = (note: StartBlocker): string => {
  switch (note.kind) {
    case "stranded":
      return `${listNames(note.names)} ${note.names.length === 1 ? "has" : "have"}`
        + ` no legal game on Court ${note.courtNumber}.`;
    case "courtTooSmall":
      return `Court ${note.courtNumber} has ${countWord(note.size)}`
        + ` ${note.size === 1 ? "player" : "players"} and a match needs four.`;
    default: {
      // The other half of the gate above: a kind marked true in
      // BLOCKS_THE_NIGHT with no sentence written for it fails to compile here
      // rather than reaching a sheet with a hole in its paragraph.
      const unwritten: never = note;
      return unwritten;
    }
  }
};

/**
 * The notes that mean somebody will not get a game, in the order they arrived.
 *
 * Input order IS the stable order, on purpose: ManageApp builds `splitNotes`
 * court by court and Courts.tsx draws them in that order, so the sheet reads
 * down in the same sequence as the red lines the operator was just looking at.
 * Re-sorting here would make the sheet a second, differently ordered list of
 * the same complaints, which is how an operator ends up thinking there are
 * four problems when there are two.
 *
 * `capStuck` is NOT here, though the courts step draws it in the same red. Its
 * own sentence ends "Change the target, or move somebody across", and the
 * target step comes AFTER this one, so asking about it here would bounce the
 * operator between two screens to answer one question. `tooFewCs`,
 * `exactlyThreeCs` and `capBends` are not here either: all three describe a
 * night that runs and finishes everyone on target.
 */
export const startBlockers = (notes: readonly SplitNote[]): SplitNote[] =>
  notes.filter(isStartBlocker);

/**
 * The confirm sheet's paragraph, or null when the night can start in silence.
 *
 * Frame 26's rule, quoted at the top of screens/summary-states/confirm-sheet.tsx,
 * is that every destructive action names exactly what will be lost, and that
 * is the bar this sentence is written to: the people by name where the note
 * knows their names, the court by number where it does not, and then the
 * consequence as a headcount, so the operator can weigh it in one glance
 * against the queue at the desk.
 *
 * "As the courts stand" rather than "if you start now", because Next goes to
 * the target step rather than starting anything, and a sentence that said
 * "start" two screens early would be the sheet lying about its own button.
 *
 * The two kinds never count the same person twice: ManageApp only asks
 * strandedPlayers about a court of four or more, and only emits courtTooSmall
 * about a court of fewer than four, so no court can raise both.
 */
export const startBlockerWords = (notes: readonly SplitNote[]): string | null => {
  const blockers = notes.filter(isStartBlocker);
  if (blockers.length === 0) return null;
  const people = blockers.reduce((sum, note) => sum + peopleLeftOut(note), 0);
  const deadCourts = blockers.filter((note) => note.kind === "courtTooSmall");
  // "As the courts stand" rather than "if you start now", and "has no game to
  // play" rather than "plays no games at all tonight". The wizard is reachable
  // mid-night, so a paragraph that talks about starting, or about a whole
  // evening, is false on the visit where somebody has already played four
  // games and a drag has just stranded them. What is true on every visit is
  // the split as it sits on the screen behind the sheet.
  //
  // countWord runs out at twenty-four and falls back to digits. Reaching that
  // needs a twenty-fifth stranded person on one night, which no split of a
  // roster this manager runs can produce, so the fallback stays theoretical.
  //
  // Both halves are said when both are present. Counting only the stranded
  // and stopping there would undercount the other way: a court of three is
  // three more people with no game, and a tail that says "one person" under a
  // clause about Court 2 reads as though the app had not noticed the court.
  const counted = people === 1
    ? "one person has no game to play"
    : `${countWord(people)} people have no game to play`;
  const dead = deadCourts.length === 1 ? "that court cannot run" : "those courts cannot run";
  const tail = people > 0 && deadCourts.length > 0
    ? `As the courts stand, ${counted}, and ${dead}.`
    : people > 0
      ? `As the courts stand, ${counted}.`
      : `As the courts stand, ${dead}.`;
  return `${blockers.map(blockerClause).join(" ")} ${tail}`;
};
