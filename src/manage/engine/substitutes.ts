// Who can step into a seat, and who has nobody to stand with at all.
//
// Two questions, both judged by the laws in ./tiers and nothing else. The
// laws decide who MAY share a court; this module only enumerates the cases
// and asks. Reimplementing the shapes here is the failure this file refuses:
// two copies of "at most one B in a C match" drift, and the drift shows up as
// a substitute list offering a player the next match would then refuse.
//
// The first question is STRANDING. A stranded player is one for whom no legal
// foursome exists among the players on their court, in any arrangement. The
// laws create exactly two ways to manufacture one, and the operator's own
// drag is how both happen:
//
//   - A second B dragged onto a C court. Only the designated B may join C
//     matches, and two B's alone cannot form a B match of four, so the spare
//     B waits all night for a game the laws can never deal.
//
//   - One or two C's dragged onto a court of A's with no B's. Below three C's
//     the court runs relaxed, so those C's could play among B's, but there
//     are no B's here and the wall against A's never moves under any
//     headcount. The C's have nobody legal to stand with.
//
// The second question is SUBSTITUTION: a live match, one player coming out,
// and the seat to be filled from the bench without moving the other three.
// The same laws answer it, applied to the one lineup the swap would create.

import type { Match, Player } from "../types";
import { isLegal, type LawContext, type Lineup } from "./tiers";
import { lawContextFor } from "./rotation";

/**
 * The three ways to split one foursome across a net. These are arrangements
 * of four names, not a restatement of any law: both laws are about which side
 * of the net someone stands on, so a foursome is only truly impossible when
 * every one of its three pairings fails, and checking fewer than three would
 * call a player stranded whose legal arrangement was simply not the first.
 */
const PAIRINGS: readonly (readonly [number, number, number, number])[] = [
  [0, 1, 2, 3],
  [0, 2, 1, 3],
  [0, 3, 1, 2],
];

/** Can these exact four stand on court together in ANY arrangement? */
const someLegalArrangement = (ids: readonly string[], ctx: LawContext): boolean =>
  PAIRINGS.some(([a, b, c, d]) => {
    const lineup: Lineup = { teamA: [ids[a], ids[b]], teamB: [ids[c], ids[d]] };
    return isLegal(lineup, ctx);
  });

/**
 * Does at least one legal foursome containing this player exist on the court?
 *
 * Brute force over every three-companion combination, all three arrangements
 * each, and deliberately so: a court holds at most about sixteen people, so
 * the worst case is C(15,3) = 455 foursomes at three arrangements apiece,
 * around fourteen hundred constant-time judgements. Anything cleverer would
 * be re-deriving the laws' shapes by hand, which is the drift this module
 * exists to avoid.
 */
function hasLegalFoursome(
  candidateId: string,
  courtIds: readonly string[],
  ctx: LawContext,
): boolean {
  const others = courtIds.filter((id) => id !== candidateId);
  for (let i = 0; i < others.length; i++) {
    for (let j = i + 1; j < others.length; j++) {
      for (let k = j + 1; k < others.length; k++) {
        if (someLegalArrangement([candidateId, others[i], others[j], others[k]], ctx)) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Everyone on this court who has no legal foursome at all.
 *
 * Judged against the court AS IT STANDS, which is why this takes the roster
 * and a court number rather than a frozen context: stranding is created and
 * cured by drags, so the answer is only worth anything computed live. The
 * whole Player comes back rather than an id, because the caller is a warning
 * sentence and a warning that cannot say WHO is stranded sends the operator
 * hunting through chips.
 *
 * Away players are out on both sides of the question: an away player takes no
 * new games, so they cannot be stranded, and they cannot rescue anybody by
 * being counted as company they will never actually be.
 *
 * A court of fewer than four players strands everyone on it by this
 * definition, truthfully: no foursome of any kind exists there. The split's
 * courtTooSmall note already covers that case in its own words, so a caller
 * showing both should prefer that note for tiny courts.
 */
export function strandedPlayers(players: readonly Player[], court: number): Player[] {
  const ctx = lawContextFor(players, court);
  const onCourt = players.filter((p) => p.courtNumber === court && !p.away);
  const courtIds = onCourt.map((p) => p.id);
  return onCourt.filter((p) => !hasLegalFoursome(p.id, courtIds, ctx));
}

/** One team with one seat's occupant replaced. No match, so no side to lose. */
const replaceSeat = (
  team: readonly [string, string],
  outId: string,
  inId: string,
): [string, string] => [
  team[0] === outId ? inId : team[0],
  team[1] === outId ? inId : team[1],
];

/**
 * The bench players who can legally take this seat.
 *
 * The other three stay exactly where they stand, so the question is one
 * lineup per candidate: the match's own sides with `outId` replaced. That is
 * what keeps the answer honest about sides. A match holding two B's has a B
 * on EACH side by law, so swapping one B out must offer only players who keep
 * a B on that side, and judging the four names without their sides would
 * offer an A who then stands exactly where the hunted B was.
 *
 * The bench is this court's players who are not away and not already in the
 * match. `ctx` is passed in rather than derived, because a live swap belongs
 * to the same context the match was dealt under, and the caller
 * (lawContextFor) already owns that derivation.
 *
 * An `outId` that is not in the match returns an empty list rather than
 * throwing: a mis-tapped seat offers nobody, and nothing crashes mid-night.
 */
export function legalSubstitutes(
  match: Match,
  outId: string,
  players: readonly Player[],
  ctx: LawContext,
): Player[] {
  const inMatch = new Set<string>([...match.teamA, ...match.teamB]);
  if (!inMatch.has(outId)) return [];
  return players
    .filter((p) => p.courtNumber === match.courtNumber && !p.away && !inMatch.has(p.id))
    .filter((p) => {
      const lineup: Lineup = {
        teamA: replaceSeat(match.teamA, outId, p.id),
        teamB: replaceSeat(match.teamB, outId, p.id),
      };
      return isLegal(lineup, ctx);
    });
}

/**
 * The match with one seat's occupant replaced, same side, nothing else moved.
 *
 * A new object every time, never a mutation: the screens hold the previous
 * match while the new one renders, and a swap written in place would change a
 * lineup the operator is still reading. Scores, status and identity all ride
 * through untouched, because the seat changed and the match did not.
 *
 * An `outId` that is not in the match hands the lineup back unchanged, the
 * same posture as legalSubstitutes: a mis-tap changes nothing rather than
 * corrupting a team.
 */
export function swapIntoMatch(match: Match, outId: string, inId: string): Match {
  return {
    ...match,
    teamA: replaceSeat(match.teamA, outId, inId),
    teamB: replaceSeat(match.teamB, outId, inId),
  };
}
