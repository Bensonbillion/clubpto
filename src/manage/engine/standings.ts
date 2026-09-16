// Standings for the rebuilt Court Manager.
//
// THE RULE, as the wireframes state it (frames 17 and 18):
//   "A win is 3, a loss is 0, ranked by points, then score difference,
//    then whoever reached the total first."
//
// The third key is the point of this rewrite. The old engine broke a
// (points, diff) tie with a visible coin flip: an overlay, a recorded verdict,
// a group-ordering procedure, and a gate that stopped the playoff until every
// coin inside the cut had been run. It worked, and it was the single largest
// source of "why is the app stopping me" on a live night.
//
// "Reached the total first" replaces all of that with something already
// sitting in the data: the moment each player arrived at their final points.
// Two players level on points and difference are separated by who got there
// earlier. No coin, no overlay, no gate, nothing to explain to the room, and
// it is deterministic, so the same night always produces the same table.

export const POINTS_PER_WIN = 3;

export interface PlayedMatch {
  /** Order the night ran in. Lower is earlier. */
  matchIndex: number;
  /** Set when the result was recorded; breaks ties on matchIndex. */
  completedAt: number | null;
  teamA: readonly string[];
  teamB: readonly string[];
  /** Games won by each side, the "score difference" input. */
  scoreA: number;
  scoreB: number;
}

export interface StandingsRow {
  playerId: string;
  rank: number;
  wins: number;
  losses: number;
  matchesPlayed: number;
  points: number;
  scoreDiff: number;
  /**
   * The matchIndex at which this player FIRST reached their final points
   * total, or null if they have not played. This is the third sort key, and
   * it is why the table needs no coin: it is a fact about the night, not a
   * decision someone has to make.
   */
  reachedAt: number | null;
  /** What separated this row from the one directly below it. */
  separatedBy: SeparatedBy;
}

/**
 * What separated one row from the one directly below it.
 *
 * Named here, and exported, so that no screen has to keep its own copy of the
 * list. SessionSummary kept one by hand, and a copy is exactly how a new
 * answer gets added to the engine and silently missed by a screen.
 *
 * "level" arrived on 2026-09-15. The comment over the labelling loop in
 * computeStandings says what it is and why the other three could not cover it.
 */
export type SeparatedBy = "points" | "diff" | "reachedFirst" | "level" | null;

/** The keys a screen may name out loud, because one of them really did decide. */
export type RealSeparation = "points" | "diff" | "reachedFirst";

/**
 * The key a screen is allowed to say separated two rows, or null when none of
 * them did.
 *
 * Every reader of `separatedBy` that prints a sentence or opens a screen comes
 * through here: the reason line and the tappable rows on frame 17, the pair
 * frame 18's explainer opens on, the runner-up line on frame 24, and the
 * WhatsApp paste on frame 25. Two things follow. A grep for this function
 * lists every screen that acts on the value, and the switch below is
 * exhaustive, so a fifth answer added to SeparatedBy fails to compile here
 * until somebody decides out loud whether it is a thing the app may say.
 *
 * "level" and null both come back null, for the same reason: nothing separated
 * the two rows, or there is no row below them. Saying nothing is the honest
 * answer. Inventing a reason is the bug this replaced.
 */
export function sayableSeparation(value: SeparatedBy): RealSeparation | null {
  switch (value) {
    case "points":
    case "diff":
    case "reachedFirst":
      return value;
    case "level":
    case null:
      return null;
    default: {
      const unhandled: never = value;
      return unhandled;
    }
  }
}

const onTeamA = (m: PlayedMatch, id: string) => m.teamA.includes(id);
const won = (m: PlayedMatch, id: string) =>
  onTeamA(m, id) ? m.scoreA > m.scoreB : m.scoreB > m.scoreA;
const diffFor = (m: PlayedMatch, id: string) =>
  onTeamA(m, id) ? m.scoreA - m.scoreB : m.scoreB - m.scoreA;

/**
 * Rank a pool. `matches` may arrive in any order; it is sorted here so
 * "reached it first" is computed against the night's real sequence rather
 * than whatever order the caller happened to be holding.
 */
export function computeStandings(
  playerIds: readonly string[],
  matches: readonly PlayedMatch[],
): StandingsRow[] {
  const played = [...matches].sort(
    (a, b) => a.matchIndex - b.matchIndex || (a.completedAt ?? 0) - (b.completedAt ?? 0),
  );

  const rows: StandingsRow[] = playerIds.map((playerId) => {
    const mine = played.filter(
      (m) => m.teamA.includes(playerId) || m.teamB.includes(playerId),
    );
    const wins = mine.filter((m) => won(m, playerId)).length;
    const points = wins * POINTS_PER_WIN;

    // Walk the night forward and note the FIRST moment the running total hit
    // the final one. A player who wins, loses, then wins again passes through
    // 3 before ending on 6, only the arrival at 6 counts, and only the first
    // one. Someone still on zero reached zero at their first match.
    let running = 0;
    let reachedAt: number | null = null;
    if (points === 0) {
      reachedAt = mine.length > 0 ? mine[0].matchIndex : null;
    } else {
      for (const m of mine) {
        if (won(m, playerId)) running += POINTS_PER_WIN;
        if (running === points) { reachedAt = m.matchIndex; break; }
      }
    }

    return {
      playerId,
      rank: 0,
      wins,
      losses: mine.length - wins,
      matchesPlayed: mine.length,
      points,
      scoreDiff: mine.reduce((sum, m) => sum + diffFor(m, playerId), 0),
      reachedAt,
      separatedBy: null,
    };
  });

  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.scoreDiff - a.scoreDiff ||
      // null sorts last: someone who has not played has not reached anything.
      (a.reachedAt ?? Number.MAX_SAFE_INTEGER) - (b.reachedAt ?? Number.MAX_SAFE_INTEGER) ||
      // Final backstop so the table is never non-deterministic.
      (a.playerId < b.playerId ? -1 : 1),
  );

  // The label has to name the key that ACTUALLY separated the two rows, and
  // the sort above has FOUR keys, not three: points, then score difference,
  // then reachedAt, then the playerId backstop that keeps the table
  // deterministic. The label only ever had three answers, so whenever the
  // backstop decided, the row claimed "reachedFirst" anyway.
  //
  // That fired on every court after every game (found 2026-09-15). Two
  // partners who win a game together are level on all three real keys by
  // construction: same wins, same score difference, same match they reached
  // their total in. So both winners were told one of them got there first, and
  // so were both losers, and tapping either of them opened frame 18, a full
  // screen explaining a tie that does not exist, with the SAME clock time
  // printed against both halves of it.
  //
  // "level" is the fourth answer. Nothing in the night separated these two.
  // Their order is the backstop's doing, nobody should be told a story about
  // it, and every screen reads the value through sayableSeparation and says
  // nothing at all.
  //
  // Two nulls on reachedAt land on "level" too, and deliberately: players who
  // have not walked on have not reached anything, so neither of them reached
  // it first. Frame 17 and the summary already refused to explain a row with
  // no matches played; this is the engine agreeing with them rather than
  // leaving the screens to patch a claim the table should not have made.
  rows.forEach((row, i) => {
    row.rank = i + 1;
    const next = rows[i + 1];
    row.separatedBy = !next
      ? null
      : row.points !== next.points
        ? "points"
        : row.scoreDiff !== next.scoreDiff
          ? "diff"
          : row.reachedAt !== next.reachedAt
            ? "reachedFirst"
            : "level";
  });

  return rows;
}
