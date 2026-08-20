// The two balance laws, and who is allowed on court together.
//
// The whole design in one line: the round robin is long, so that is where
// people need protecting, and the playoff is short, earned and partnered, so
// that is where everyone mixes. Nothing in this file applies to a playoff.
// Seeding comes off the standings and from there tier is irrelevant.
//
// THE LAWS, same shape, one at each end of the room:
//
//   1. If a match holds both A's and B's, each team has a B. No B is ever the
//      lone weaker player being hunted.
//
//   2. If a match holds any C, there is no A anywhere in it, a C stands on
//      each team, and at most one B is allowed in. So a legal C match is
//      exactly two shapes: four C's, or three C's plus one B.
//
// And the B in that second law is THE SAME PERSON ALL NIGHT. One designated B
// rides with the beginner group for the whole session, so the C's see one
// consistent stronger face instead of a rotating cast, and nobody ends up
// having played with a parade of different B's.

import type { Player } from "../types";

export type Tier = "A" | "B" | "C";

/**
 * A player's tier for scheduling purposes.
 *
 * UNASSESSED COUNTS AS B, and that is load-bearing rather than a shortcut. B
 * is the only tier with no restriction on it: an A cannot share a match with a
 * C, and a C cannot play outside the two legal shapes, but a B can go
 * anywhere. Several hundred players on the roster have never been assessed, so
 * whatever they default to is a guess made at scale. Defaulting them to the
 * bridge is the least damaging wrong guess available: a mislabelled B is
 * merely in the wrong game, while a mislabelled A walls someone off from the
 * beginners' court and a mislabelled C drags an A out of a match they should
 * have been in.
 */
export const tierOf = (player: Player): Tier => player.tier ?? "B";

/** Ids on each side of a proposed match. */
export interface Lineup {
  teamA: readonly [string, string];
  teamB: readonly [string, string];
}

export interface LawContext {
  tierById: (playerId: string) => Tier;
  /**
   * The one B who rides with the beginner group. Null when this court has no
   * B to spare, in which case the only legal C shape left is four C's.
   */
  designatedB: string | null;
  /**
   * True when this court cannot field a legal C match at all, because fewer
   * than three C's turned up. The C-on-each-team and one-B rules relax so the
   * C's can play among the B's, and the setup screen says so before the night
   * starts rather than letting it be discovered in round two.
   *
   * What NEVER relaxes is the wall: no A is in a match with a C, under any
   * headcount. That is the whole promise being made to a beginner.
   */
  relaxed: boolean;
  /**
   * How many C's are on this court at all.
   *
   * Needed because "do not leave a newcomer alone" is only a preference worth
   * having when a second newcomer exists to pair them with. On a court with
   * exactly one C, preferring matches without a lone C means preferring
   * matches without that player, and they would sit out the night being
   * protected from a game.
   */
  cCount: number;
}

export type Illegality =
  /** An A and a C in the same match. The one rule with no exception. */
  | "aWithC"
  /** A C match where one team has no C, so that side is a pair of minders. */
  | "cNotOnEachTeam"
  /** More than one B in a C match, which turns it into a B match with guests. */
  | "tooManyBInCMatch"
  /** A B in a C match who is not the one riding with the group all night. */
  | "notTheDesignatedB"
  /** A's and B's mixed, but a team has no B, so that B is being hunted. */
  | "bNotOnEachTeam";

const countBy = (tiers: readonly Tier[], t: Tier) => tiers.filter((x) => x === t).length;

/**
 * Why this lineup is not allowed, or null when it is.
 *
 * Takes the ARRANGEMENT, not just the four names, because both laws are about
 * which side of the net someone stands on. "Two B's are present" is not the
 * same claim as "each team has a B", and the second is the one that protects
 * anybody.
 */
export function judge(lineup: Lineup, ctx: LawContext): Illegality | null {
  const a = [...lineup.teamA];
  const b = [...lineup.teamB];
  const all = [...a, ...b];
  const tiers = all.map(ctx.tierById);

  const cs = countBy(tiers, "C");
  const as = countBy(tiers, "A");
  const bs = countBy(tiers, "B");

  if (cs > 0) {
    // The wall. Never relaxed, at any headcount, in any mode.
    if (as > 0) return "aWithC";

    if (!ctx.relaxed) {
      // A C on each team, so no side is two minders against two beginners.
      if (a.filter((id) => ctx.tierById(id) === "C").length === 0) return "cNotOnEachTeam";
      if (b.filter((id) => ctx.tierById(id) === "C").length === 0) return "cNotOnEachTeam";
      // Four C's, or three C's and one B. Nothing else.
      if (bs > 1) return "tooManyBInCMatch";
      if (bs === 1) {
        const theB = all.find((id) => ctx.tierById(id) === "B")!;
        if (ctx.designatedB !== null && theB !== ctx.designatedB) return "notTheDesignatedB";
      }
    }
    return null;
  }

  // No C in the match, so the second law is silent and the first speaks.
  if (as > 0 && bs > 0) {
    if (!a.some((id) => ctx.tierById(id) === "B")) return "bNotOnEachTeam";
    if (!b.some((id) => ctx.tierById(id) === "B")) return "bNotOnEachTeam";
  }
  return null;
}

export const isLegal = (lineup: Lineup, ctx: LawContext): boolean => judge(lineup, ctx) === null;

/**
 * Can this court ever field a legal C match?
 *
 * Three C's is the floor, because the smaller legal shape is three C's plus
 * one B. Below that the court runs relaxed and the operator is told at setup.
 */
export const MIN_CS_FOR_A_C_MATCH = 3;

export function canFieldACMatch(tiers: readonly Tier[]): boolean {
  return countBy(tiers, "C") >= MIN_CS_FOR_A_C_MATCH;
}

/**
 * The B who rides with the beginner group, chosen the same way every time.
 *
 * Derived rather than stored, and deliberately NOT "whoever has played least".
 * The law is that the C's see one consistent face all night, so the choice has
 * to be stable against everything that changes during a night. Seat order is
 * the only thing on a court that does not move.
 *
 * Returns null when the court has no B at all, which leaves four C's as the
 * only legal shape.
 */
export function designateB(
  players: readonly Player[],
  court: number,
): string | null {
  const onCourt = players.filter((p) => p.courtNumber === court && !p.away);
  if (!onCourt.some((p) => tierOf(p) === "C")) return null;
  return onCourt.find((p) => tierOf(p) === "B")?.id ?? null;
}

/**
 * The three ways to split four players across a net, house pairing first.
 *
 * The four arrive in queue order, most owed a game first, so [0,3,1,2] puts
 * the most owed with the least owed and the two in the middle together. That
 * is the fairest split when nothing else constrains it, and it is what the
 * court did before the laws existed. The other two orders exist only so a law
 * has somewhere to go: a C match that needs its Cs on opposite sides, or an
 * A-and-B match that needs a B on each team, will find its arrangement here.
 */
const SPLITS: readonly (readonly [number, number, number, number])[] = [
  [0, 3, 1, 2],
  [0, 1, 2, 3],
  [0, 2, 1, 3],
];

export interface Chosen {
  lineup: Lineup;
  /** Queue positions of the four, so a caller can say who was passed over. */
  positions: number[];
}

/**
 * How badly a legal lineup still fails the spirit of the second law.
 *
 * Only reachable on a relaxed court. With three or more C's the shape rules
 * are hard and an unbalanced C match is simply illegal, so nothing here fires.
 * Below three C's no legal C match exists at all and the C's play among the
 * B's, which is what the spec asks for. But frame A11 still promises "never
 * the only newcomer", and a court with two C's can usually honour that for
 * free by putting them on opposite sides.
 *
 * So this is a PREFERENCE, not a law, and it is applied only to separate
 * lineups that are already equal on fairness. It can never push somebody down
 * the queue.
 */
function softPenalty(lineup: Lineup, ctx: LawContext): number {
  const a = [...lineup.teamA];
  const b = [...lineup.teamB];
  const cs = [...a, ...b].filter((id) => ctx.tierById(id) === "C");
  if (cs.length === 0) return 0;
  // One newcomer alone against three others is the game the rule exists to
  // prevent, so it is the worse of the two shapes. But only when the court
  // could actually do better: with a single C on the whole court there is no
  // second one to bring, and penalising it would just keep them off court.
  if (cs.length === 1) return ctx.cCount >= 2 ? 2 : 0;
  const aHasC = a.some((id) => ctx.tierById(id) === "C");
  const bHasC = b.some((id) => ctx.tierById(id) === "C");
  return aHasC && bHasC ? 0 : 1;
}

/**
 * Pick the least-played legal four, and arrange them.
 *
 * `queue` is already least-played-first, and that ordering is what actually
 * keeps the night fair: the laws decide who MAY play together, never who is
 * owed a game. So this walks combinations in queue order and takes the first
 * legal one by total queue position, which is the most least-played-respecting
 * arrangement the laws permit.
 *
 * The window exists because the full combination set is unbounded on a large
 * court and pointless past the first dozen: anybody further down the queue is
 * by definition further ahead on games, so reaching for them to satisfy a law
 * would break the ordering the law was meant to serve.
 */
export function chooseFour(
  queue: readonly string[],
  ctx: LawContext,
  options: {
    windowSize?: number;
    playedBy?: (playerId: string) => number;
    /**
     * How many times two players have already been PARTNERS tonight. Ranked
     * below fairness and below the laws, above queue position: on a court of
     * four the queue re-sorts to the same order after every match, so without
     * this the house split dealt the identical teams all night, while the
     * Ready screen promised that partners rotate every round. With it, a court
     * of four at target three plays exactly the three distinct splits.
     */
    partnered?: (a: string, b: string) => number;
  } = {},
): Chosen | null {
  const { windowSize = 12, playedBy, partnered } = options;
  const window = queue.slice(0, Math.max(4, windowSize));
  let best: Chosen | null = null;
  // Ranked in this order, and the order is the whole fairness argument:
  //   1. games already played, so the people owed a game go on;
  //   2. the soft C preference, which only ever separates equals;
  //   3. repeated partnerships, so the same two are not dealt together again
  //      while an untried split costs nothing in fairness;
  //   4. queue position, so the result is deterministic.
  // The fairness key is the four players' played counts SORTED, compared
  // lexicographically, not their sum. A sum lets [0,0,3,3] tie with [1,1,2,2],
  // which would put somebody on their fourth game while somebody else was
  // still on their first: exactly the drift the court is supposed to prevent.
  // Sorted-and-lexicographic makes "the least played four" precise, and any
  // other four with the same vector is equally fair by definition.
  let bestKey: { played: number[]; penalty: number; repeats: number; position: number } | null = null;
  const games = playedBy ?? (() => 0);
  const together = partnered ?? (() => 0);
  const better = (
    k: { played: number[]; penalty: number; repeats: number; position: number },
    b: typeof bestKey,
  ): boolean => {
    if (!b) return true;
    for (let n = 0; n < k.played.length; n++) {
      if (k.played[n] !== b.played[n]) return k.played[n] < b.played[n];
    }
    if (k.penalty !== b.penalty) return k.penalty < b.penalty;
    if (k.repeats !== b.repeats) return k.repeats < b.repeats;
    return k.position < b.position;
  };

  for (let i = 0; i < window.length; i++) {
    for (let j = i + 1; j < window.length; j++) {
      for (let k = j + 1; k < window.length; k++) {
        for (let l = k + 1; l < window.length; l++) {
          const ids = [window[i], window[j], window[k], window[l]];
          const played = ids.map(games).sort((m, n) => m - n);
          const position = i + j + k + l;
          for (const [x, y, z, w] of SPLITS) {
            const lineup: Lineup = { teamA: [ids[x], ids[y]], teamB: [ids[z], ids[w]] };
            if (!isLegal(lineup, ctx)) continue;
            const key = {
              played,
              penalty: softPenalty(lineup, ctx),
              repeats: together(lineup.teamA[0], lineup.teamA[1])
                + together(lineup.teamB[0], lineup.teamB[1]),
              position,
            };
            if (better(key, bestKey)) {
              best = { lineup, positions: [i, j, k, l] };
              bestKey = key;
            }
            // Every split is scored, not just the first legal one. Breaking
            // here took whichever arrangement happened to come first, which on
            // a relaxed court meant two newcomers could end up partners while
            // a legal split that separated them sat one line further down.
          }
        }
      }
    }
  }
  return best;
}
