// How many games each player has played in one session and division, for
// the admin screen. Everyone plays five on a league Sunday; anyone who has
// reached five is greyed out so a sixth game is not recorded by mistake.
//
// A game that should not count for one player (a sixth game) is entered in
// the Sheet with that player's spot left blank. A blank name counts for
// nobody, here or in the Sheet's standings, while the other three players
// keep the game. The Sheet only takes roster names, so there is no stand-in
// name for it.

import type { MatchRow } from "@/league/adminApi";

export const MAX_GAMES = 5;

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
