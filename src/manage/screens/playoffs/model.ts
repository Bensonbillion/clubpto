// Shared shapes for the `playoffs` slice (frames 19a, 19b, 20, 21, 22).
//
// Presentational only. These are the flattened views the five frames consume;
// the caller derives them from src/manage/types.ts and the standings order that
// engine/standings.ts already computed (points, then score difference, then
// whoever reached the total first — there is no coin flip and nothing here
// waits on one).
//
// Two facts the frames depend on and this file therefore encodes:
//   1. Every playoff surface is scoped to ONE court. Nothing merges.
//   2. Seeds are per player, paired into teams, and the pairing is STORED
//      (`seedLabel`, `seedPairs`) rather than recomputed for display — the
//      bracket rows, the match frame and the intro line all read the same one.

/** A pair in the bracket. Both strings are already composed by the caller. */
export interface PlayoffTeam {
  /** The two names joined with the word "and": `Ade and Ayo`. Never an ampersand. */
  name: string;
  /** The pair's seeds exactly as drawn: `1+3`. Stored, not recomputed. */
  seedLabel: string;
}

/** Two player seeds combined into one team, e.g. `[1, 3]`. */
export type SeedPair = readonly [number, number];

export type BracketMatchStatus = "complete" | "live" | "next" | "pending";

export interface BracketMatch {
  matchId: string;
  /** Null while the stage that feeds this side is unresolved. */
  teamA: PlayoffTeam | null;
  teamB: PlayoffTeam | null;
  /** Null until a score lands. A live row renders null as 00. */
  scoreA: number | null;
  scoreB: number | null;
  status: BracketMatchStatus;
  /** Which side won. Dims the LOSING NAME on a completed row. */
  winnerSide: "A" | "B" | null;
}

export interface BracketStage {
  /** `Quarterfinals` | `Semifinals` | `Final`, derived from the court size. */
  name: string;
  /** In play order. */
  matches: BracketMatch[];
}

/** Scores render two digits: 21, 09, and 00 before anything is entered. */
export const padScore = (score: number | null): string =>
  String(score ?? 0).padStart(2, "0");

/** Which side won, from the recorded numbers. Null until both are in. */
export const winnerFromScores = (
  scoreA: number | null,
  scoreB: number | null,
): "A" | "B" | null => {
  if (scoreA == null || scoreB == null || scoreA === scoreB) return null;
  return scoreA > scoreB ? "A" : "B";
};

/** `Timi and Tumi`. One name passes through untouched. */
export const joinNames = (names: readonly string[]): string => {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  // FLAG: only the one-name and two-name forms are drawn. The comma list for
  // three or more owed players is not in either wireframe.
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
};

// FLAG: frame 21 spells the count in its sentence (`the other four are on the
// second court`) while the spec writes the template as `{n}`. The word list is
// the same one the standings slice uses; anything past twelve is not drawn.
const COUNT_WORDS = [
  "zero", "one", "two", "three", "four", "five", "six",
  "seven", "eight", "nine", "ten", "eleven", "twelve",
];

export const countWord = (n: number): string =>
  n >= 0 && n < COUNT_WORDS.length ? COUNT_WORDS[n] : `${n}`;

/**
 * The pairs the bracket's intro line names.
 *
 * The drawn sentence reads `Seeds pair 1+3 and 2+4.` on an 8-player court whose
 * row-ordered pairs are `[[1,3],[6,8],[2,4],[5,7]]` — it states the rule using
 * the top half of the draw and leaves the mirrored bottom half implied.
 *
 * FLAG: only the 8-player sentence is drawn. A 16-player court yields four
 * pairs here and no wireframe shows how that sentence reads.
 */
export const topHalfSeedPairs = (pairs: readonly SeedPair[]): SeedPair[] =>
  [...pairs]
    .sort((a, b) => Math.min(a[0], a[1]) - Math.min(b[0], b[1]))
    .slice(0, Math.ceil(pairs.length / 2));
