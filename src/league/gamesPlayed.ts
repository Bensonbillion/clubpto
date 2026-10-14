// How many games each player has played in one session and division, for
// the admin screen. Everyone plays five on a league Sunday; anyone who has
// reached five is greyed out so a sixth game is not recorded by mistake.
//
// "Sub" stands in for a player whose extra game should not count. It is
// not on the roster, so the Sheet's standings never count it for anyone,
// while the other three players in that match keep the game.

import type { MatchRow } from "@/league/adminApi";

export const MAX_GAMES = 5;
export const SUB = "Sub";

export const isSub = (name: string): boolean => name.trim().toLowerCase() === SUB.toLowerCase();

/** Games per player name for the division's recorded matches. Subs are not counted. */
export const gamesPlayed = (matches: readonly MatchRow[], division: string): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const m of matches) {
    if (m.division !== division || m.scoreA === null || m.scoreB === null) continue;
    for (const name of [...m.teamA, ...m.teamB]) {
      const n = name.trim();
      if (!n || isSub(n)) continue;
      out[n] = (out[n] || 0) + 1;
    }
  }
  return out;
};
