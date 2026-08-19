// Who the match log is holding on to.
//
// This is one predicate, and it lives in the engine rather than in a screen
// because it is the rule the writer enforces, not a hint the UI offers. Every
// surface that names a player reads ids back out of match rows: the live match
// card, the standings table, the bracket, the end-of-night summary. Remove a
// player and none of those rows change, so the id stays and the name it used
// to resolve to does not.

import type { Match } from "../types";

/**
 * True when this player is in any match that still counts.
 *
 * Deliberately not `matchesPlayedBy`, which counts completed matches only.
 * That version would let somebody be deleted while they are standing on court
 * mid-rally, and the card in front of the room would start rendering their raw
 * id. A voided match is the other direction: it counts for nothing, so it
 * holds nobody in the night.
 *
 * Equality on ids, never a substring test. The roster carries `p-timi` and
 * `p-timi-olaoye` as two different people on purpose.
 */
export const appearsInAMatch = (
  matches: readonly Match[],
  playerId: string,
): boolean =>
  matches.some(
    (m) =>
      m.status !== "voided" &&
      (m.teamA.includes(playerId) || m.teamB.includes(playerId)),
  );
