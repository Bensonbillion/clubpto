// Shared shapes for the `playoffs` slice (frames 19 to 24).
//
// Presentational only. These are the flattened views the frames consume; the
// caller derives them from src/manage/types.ts, from engine/playoff.ts and from
// the standings order engine/standings.ts already computed (points, then score
// difference, then whoever reached the total first, with no coin anywhere).
//
// Three facts the frames depend on and this file therefore encodes:
//   1. Every playoff surface is scoped to ONE court. Nothing merges, and there
//      is no crossover final between the courts.
//   2. Seeds are per player, paired into sides, and the pairing is STORED
//      (`seedLabel`) rather than recomputed for display, so a row can never
//      show one side's names beside another side's seeds.
//   3. A side may hold THREE players. A court of nine seeds the last side as a
//      rotating trio so nobody watches the climax from the fence, and code that
//      assumes exactly two names drops the ninth player silently.

/** A side in the bracket. Both strings are already composed by the caller. */
export interface PlayoffTeam {
  /** The names as frames 21 to 23 draw them: `Hamid & Tumi`. */
  name: string;
  /** The side's seeds exactly as drawn: `1+3`. Stored, not recomputed. */
  seedLabel: string;
  /**
   * True when this side holds three players who rotate two onto the court
   * each match. An odd seed count makes one (a court of nine or eleven), and
   * the stress script asks for it to be NAMED on the bracket rather than
   * left as three names the operator has to puzzle over.
   */
  trio?: boolean;
}

/**
 * The seeds on one side of a tie, e.g. [1, 3].
 *
 * Not a fixed pair, for the trio reason above.
 */
export type SeedPair = readonly number[];

/** `1+3`, the label frames 20b and 21 both draw. */
export const seedPairLabel = (pair: SeedPair): string => pair.join("+");

/**
 * What an unresolved side of a tie is waiting on, so frame 21 can write
 * "Waits for the second semifinal" rather than a vague placeholder.
 *
 * The caller supplies it because only the caller knows which row of which
 * earlier stage feeds this side.
 */
export interface BracketWaiting {
  /** The singular stage word: `Semifinal`, `Play-in`. */
  stageLabel: string;
  /**
   * Which row of that stage, 1-based. Null when the stage holds one row, where
   * "Waits for the play-in" is the whole truth and an ordinal would be noise.
   */
  position: number | null;
}

/**
 * One side of a bracket row.
 *
 * `team` and `waitsFor` are both nullable rather than a union because a row
 * that is genuinely malformed, no team and nothing to wait for, has to be
 * representable: the screen draws nothing for it instead of asserting.
 */
export interface BracketSide {
  /** Null while the row that feeds this side is unresolved. */
  team: PlayoffTeam | null;
  /** What fills this side later. Read only while `team` is null. */
  waitsFor: BracketWaiting | null;
}

export type BracketMatchStatus = "complete" | "live" | "next" | "pending";

export interface BracketMatch {
  matchId: string;
  sideA: BracketSide;
  sideB: BracketSide;
  /** Null until a score lands. */
  scoreA: number | null;
  scoreB: number | null;
  status: BracketMatchStatus;
  /** Which side won. Dims the LOSING name and the losing numeral. */
  winnerSide: "A" | "B" | null;
  /** Settled without playing. The row writes Walkover instead of numbers. */
  walkover?: boolean;
}

export interface BracketStage {
  /** `Play-in` | `Semifinals` | `Final`, derived from the court size. */
  name: string;
  /** In play order. */
  matches: BracketMatch[];
}

/**
 * A recorded score, as the frames draw it.
 *
 * Bare, not padded: the bracket, the slat and the champion box all read "7"
 * and "5", because a night is played to seven and a leading zero on a
 * single-digit game reads as a clock. The pre-score state is the exception and
 * stays "00", which is the shape frame 10 draws before anything is entered and
 * the only thing that makes an empty slat look empty rather than nil to nil.
 */
export const scoreText = (score: number | null): string =>
  score == null ? "00" : String(score);

/** Which side won, from the recorded numbers. Null until both are in. */
export const winnerFromScores = (
  scoreA: number | null,
  scoreB: number | null,
): "A" | "B" | null => {
  if (scoreA == null || scoreB == null || scoreA === scoreB) return null;
  return scoreA > scoreB ? "A" : "B";
};

/**
 * `Hamid & Tumi`, the way every bracket row, match card and champion line
 * writes a side.
 *
 * The ampersand is the frames' own choice and it is not interchangeable with
 * `joinNames`: an "and" list reads as prose and a side reads as a unit.
 */
export const joinPair = (names: readonly string[]): string => names.join(" & ");

/**
 * `Hamid and Chibuike`, for names inside a sentence. Frame 20a's outstanding
 * match is written this way: "Hamid and Chibuike against Fiyin and David".
 */
export const joinNames = (names: readonly string[]): string => {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
};

// The frames spell counts inside sentences: "All eight played three."
// FLAG: nothing past twelve is drawn, so it falls back to the numeral.
const COUNT_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six",
  "seven", "eight", "nine", "ten", "eleven", "twelve",
];

export const countWord = (n: number): string => COUNT_WORDS[n] ?? `${n}`;

// Frames 19 and 21 both reach for an ordinal in prose: "a fourth match",
// "the second semifinal".
// FLAG: nothing past twelfth is drawn, so it falls back to a numeral suffix.
const ORDINALS = [
  "", "first", "second", "third", "fourth", "fifth", "sixth",
  "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth",
];

export const ordinalWord = (n: number): string => ORDINALS[n] ?? `${n}th`;
