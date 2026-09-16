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

import type { Match } from "../types";

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

/**
 * Read one court's night out of the stored matches: the rows that count, in
 * the order their results were recorded, renumbered 1..n so the matchIndex
 * above means what it says.
 *
 * This is the only correct way to build this file's input from a Match[], and
 * it lives here because the renumbering is a fact about how standings read a
 * night rather than a detail of any one screen.
 *
 * WHY IT RENUMBERS AT ALL. A Match's matchIndex is its SLOT in the card, not
 * the order the night ran in (types.ts, Match.matchIndex). Frame 12b lets the
 * operator step past the four standing on court and play a different row, and
 * the slot numbers stay put, which is the point of them. The third tie-break
 * is "whoever reached the total first", decided by the order results were
 * recorded, so it is handed exactly that. Feeding it slot numbers instead
 * would let a game scored at nine o'clock rank as though it had been played
 * first because it happened to sit in row two.
 *
 * WHY IT IS ONE FUNCTION. Because it used to be two. useSession.ts groupPlayed
 * renumbered and engine/playoff.ts orderedPlayerIds did not, so the standings
 * table on the wall and the bracket seeded off that table read the same night
 * through two different ladders the moment anything was played out of card
 * order. Found 2026-09-15 on two games with card order and recorded order
 * reversed: the table said p3 and p4 on top, the bracket seeded p1 and p2, and
 * nothing in the app reconciled them. Two sorts that must agree, sitting in
 * two files with no link between them, is how that happened. One function is
 * the link, and a caller cannot now get half of it right.
 *
 * engine/teams.ts builds its own list and is deliberately left alone: it ranks
 * PAIRS rather than players, takes no court, and drops any match whose two
 * sides are not both known pairs. Its flatMap index comes from the pre-drop
 * sorted array, so its numbering can skip (1, 2, 4). That is harmless, because
 * computeStandings needs the order to be monotonic and never needs it to be
 * contiguous, and it is worth knowing before anybody "fixes" the skip.
 *
 * If the type-only Match import here ever becomes a problem, the alternative
 * is a helper over readonly PlayedMatch[] that only renumbers, which keeps
 * this file free of imports at the cost of every caller owning its own filter
 * again. That is the weaker shape: the filter is the half a caller got wrong.
 *
 * Playoff ties are excluded: a bracket result never feeds the round-robin
 * table it was seeded from.
 */
export function groupPlayedInOrder(
  matches: readonly Match[],
  court: number,
): PlayedMatch[] {
  return matches
    .filter((m) => m.courtNumber === court && m.status === "played" && m.stage === null)
    .sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0) || a.matchIndex - b.matchIndex)
    .map((m, i) => ({
      matchIndex: i + 1,
      completedAt: m.completedAt,
      teamA: m.teamA,
      teamB: m.teamB,
      scoreA: m.scoreA ?? 0,
      scoreB: m.scoreB ?? 0,
    }));
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
  separatedBy: "points" | "diff" | "reachedFirst" | null;
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

  rows.forEach((row, i) => {
    row.rank = i + 1;
    const next = rows[i + 1];
    row.separatedBy = !next
      ? null
      : row.points !== next.points
        ? "points"
        : row.scoreDiff !== next.scoreDiff
          ? "diff"
          : "reachedFirst";
  });

  return rows;
}
