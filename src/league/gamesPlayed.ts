// How many games each player has played in one session and division, shown
// beside their name on the admin screen.
//
// It is a count, not a limit. Divisions do not all play the same number of
// games, so there is nothing to cap: the screen reports what has happened
// and the operator decides what happens next.
//
// A game that should not count for one player is entered in the Sheet with
// that player's spot left blank. A blank name counts for nobody, here or in
// the Sheet's standings, while the other three players keep the game. The
// Sheet only takes roster names, so there is no stand-in name for it. Those
// games stay in the Sheet but are not shown in the admin list (Benson,
// Oct 14): they are bookkeeping, not results to read back.

import type { MatchRow } from "@/league/adminApi";

/** True when a match has a blank spot, i.e. it is a game that does not count for someone. */
export const hasBlankSpot = (m: MatchRow): boolean => [...m.teamA, ...m.teamB].some((n) => !n.trim());

/** The scored matches to list in admin: everything except games with a blank spot. */
export const shownMatches = (matches: readonly MatchRow[]): MatchRow[] =>
  matches.filter((m) => m.scoreA !== null && m.scoreB !== null && !hasBlankSpot(m));

/** Games per player name for the division's recorded matches. Blank spots are not counted. */
export const gamesPlayed = (matches: readonly MatchRow[], division: string): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const m of matches) {
    if (m.division !== division || m.scoreA === null || m.scoreB === null) continue;
    for (const name of [...m.teamA, ...m.teamB]) {
      const n = name.trim();
      if (!n) continue;
      out[n] = (out[n] || 0) + 1;
    }
  }
  return out;
};
