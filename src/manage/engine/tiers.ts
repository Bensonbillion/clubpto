// The balance laws, and who is allowed on court together.
//
// The whole design in one line: the round robin is long, so that is where
// people need protecting, and the playoff is short, earned and partnered, so
// that is where everyone mixes. Nothing in this file applies to a playoff.
// Seeding comes off the standings and from there tier is irrelevant.
//
// THE LAWS. The first two are the same shape, one at each end of the room;
// the third arrived on 2026-09-10 and stands on its own:
//
//   1. If a match holds both A's and B's, the two teams have the same make-up:
//      an A and a B on each side. Never AB against BB, never AA against AB.
//      The club's own words for it: it is either B B B B or A B A B. (Four
//      A's is fine too; the law is about mixing.) Found on a Wednesday with
//      twelve A's and eight B's on one court, where "a B on each team" let
//      three of fifteen games run an A and a B against two B's.
//
//   2. If a match holds any C, there is no A anywhere in it, a C stands on
//      each team, and at most one B is allowed in. So a legal C match is
//      exactly two shapes: four C's, or three C's plus one B.
//
// And the B in that second law is THE SAME PERSON ALL NIGHT. One designated B
// rides with the beginner group for the whole session, so the C's see one
// consistent stronger face instead of a rotating cast, and nobody ends up
// having played with a parade of different B's.
//
//   3. An A plays ONE game with the B's a night, and never a second. The
//      owner's words, 2026-09-10, after the Wednesday of 2026-09-09 dealt
//      A's a second and a third: "An A should not get more than one B game
//      throughout the whole session, whether it's three games, four or five.
//      They should never get more than one B game. I know the math is
//      confusing, it's always a weird number, but this is highly important
//      for our business." A B game is any game with a B in it, counted per
//      session across courts. Wherever the seats can still be finished with
//      no A meeting the B's twice, that is a hard cap, and it is the one
//      thing allowed to hold a least-played player back a game. Where the
//      seats cannot (fewer than four A's, a lone B, six A's and two B's at
//      four each), the night still finishes on target and the second games
//      are spread, never stacked on one A. And where the seats allow it every
//      A GIVES their one game: among equally fair fours, one that spends an
//      unused ticket beats a pure game, which is also what keeps the
//      Wednesday roster AT THREE EACH from meeting the same person three
//      times. That qualifier is a measurement rather than modesty: the same
//      twenty at four each and at five each meet somebody a third time
//      whatever this preference does, because twenty and twenty-five games
//      among twenty people leave no room not to (2026-09-11). The law above
//      covers all three targets; this consequence of it covers three each.
//      Some courts have no room for the one game at all, and there the law
//      is a ceiling rather than a promise: six A's and six B's at four each
//      fit two mixed games, so two of those A's never meet the B's at all.
//
// Three consequences of the third law worth knowing before a night.
// Unassessed players count as B (see tierOf), so after one game an assessed A
// is walled off from every unassessed player on the court for the rest of the
// night. A court of exactly four A's plays the same four A's more than once
// after their one B game, which is accepted, the partners still rotate. And a
// B who walks in late plays only B's: the Wednesday roster at three each with
// a B arriving before game nine finds all twelve A's have spent their ticket,
// and the cap walls every one of them off, so the night gives that B three
// games and never an A in any of them.

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
  /**
   * How hard the first law holds on this court tonight. "strict" is the
   * club's rule, A B against A B and nothing else. "soft" is the older
   * shape, a B on each side, which lets an odd A or an odd B play rather
   * than sit while the others play twice. "free" adds the one four that
   * cannot put a B on each side, a lone B among A's, and adds nothing else:
   * every law arranges a four the same way. Absent means strict.
   *
   * abLawFor answers it off the headcount, which is what the setup screen
   * and anything judging a lineup on its own get. lawfulFour then answers it
   * again for each draw off the seats still owed (lawForOwedSeats), because
   * the headcount does not know what the night has left to deal: a court can
   * hold the club's rule for four games and then have no strict game left in
   * it.
   *
   * THE PER-DRAW ANSWER GOES BOTH WAYS. It usually loosens, and that is
   * what it was written for, but the headcount reads soft the moment either
   * tier is odd and the seats can be stricter than that: three A's and
   * three B's at four each is twelve seats each side and every one of them
   * fits an A and a B against an A and a B, so the ladder says strict where
   * the headcount said soft. Over the courts the fixed sweep walks, one to
   * twelve of each tier at every target, 100 start the night with the
   * ladder stricter than the headcount law and one starts looser, three A's
   * and two B's at four each, which needs the lone B among A's twice
   * (2026-09-12). A court whose HEADCOUNT law is free is never asked, so
   * free is never tightened away mid-night.
   */
  abLaw?: "strict" | "soft" | "free";
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
  | "bNotOnEachTeam"
  /** A's and B's mixed, and the two teams are not the same make-up. */
  | "sidesUnequal";

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
  //
  // The law says two separate things, and until 2026-09-11 the free rung
  // switched both off at once. Which SHAPES a night may deal is the half
  // that loosens: soft adds one A among three B's, free adds its mirror,
  // one B among three A's. How a four already chosen is ARRANGED does not
  // loosen, because there is only one thing to say about it under any law.
  // Every team has a B, and the only four that cannot give each side one is
  // the four holding exactly one B, which is the shape the free law exists
  // to allow. Read as "free means no rule at all", free also let two A's
  // stand against two B's, the game law one was written to prevent. A fixed
  // roster never reaches the free rung, but a walk-in, a leaver or an
  // extended target reaches it at once: 441 games of two A's against two
  // B's over 379 of the 5,224 mid-night nights the sweep walks, against
  // none before the rung existed and none now (2026-09-12).
  const law = ctx.abLaw ?? "strict";
  if (as > 0 && bs > 0) {
    // The lone B among A's. Only the free law deals that shape at all, so
    // under strict and soft a team without a B is illegal as it always was.
    const loneB = law === "free" && bs === 1;
    if (!loneB) {
      if (!a.some((id) => ctx.tierById(id) === "B")) return "bNotOnEachTeam";
      if (!b.some((id) => ctx.tierById(id) === "B")) return "bNotOnEachTeam";
    }
    // The same make-up on each side: A B against A B, and nothing else.
    if (law === "strict") {
      const shape = (side: string[]) => side.map(ctx.tierById).sort().join("");
      if (shape(a) !== shape(b)) return "sidesUnequal";
    }
  }
  return null;
}

export const isLegal = (lineup: Lineup, ctx: LawContext): boolean => judge(lineup, ctx) === null;

/**
 * How hard the first law can hold with these people on the court. See
 * LawContext.abLaw for the three answers and why.
 */
export function abLawFor(tiers: readonly Tier[]): "strict" | "soft" | "free" {
  const as = countBy(tiers, "A");
  const bs = countBy(tiers, "B");
  if (as === 0 || bs === 0) return "strict";
  if (as < 2 || bs < 2) return "free";
  return as % 2 === 0 && bs % 2 === 0 ? "strict" : "soft";
}

/**
 * The seats one game spends, as (A seats, B seats), under each law.
 *
 * Strict is the club's rule: four A's, four B's, or an A and a B against an
 * A and a B. Soft adds the one shape a B on each side still allows, an A
 * among three B's. Free adds the mirror of that one, a B among three A's,
 * the one four that cannot put a B on each side of the net. Free is a
 * LONGER LIST, not the absence of one: two A's against two B's is no more
 * legal under it than under the other two, and judge() says why.
 */
const STRICT_SHAPES = [[4, 0], [0, 4], [2, 2]] as const;
const SOFT_SHAPES = [...STRICT_SHAPES, [1, 3]] as const;
const FREE_SHAPES = [...SOFT_SHAPES, [3, 1]] as const;

/**
 * Can the games these two tiers still owe be dealt out in these shapes
 * alone, with this many of each tier on the court?
 *
 * Seats and headcounts, and nothing else. A shape is only available where
 * the court holds the players it seats, so a tier of three can never field
 * its own pure game and every seat it owes has to come out of a mixed one.
 * What this deliberately does NOT model is who owes what: four A seats owed
 * by one A is arithmetic no pure game can fill either, and this answers yes
 * there. Saying yes is the safe way to be wrong. A yes leaves the law where
 * the parity reading already had it, so every court this cannot see all of
 * deals the games it dealt yesterday, and it is a no that moves a court.
 */
function finishExists(
  shapes: readonly (readonly [number, number])[],
  owedA: number,
  owedB: number,
  aCount: number,
  bCount: number,
): boolean {
  const here = shapes.filter(([sa, sb]) => sa <= aCount && sb <= bCount);
  // Every total the shapes can reach, built up from nothing. The grid is the
  // seats still owed, which is a court's headcount times its target.
  const reached = new Set<number>([0]);
  const key = (a: number, b: number) => a * (owedB + 1) + b;
  for (let a = 0; a <= owedA; a++) {
    for (let b = 0; b <= owedB; b++) {
      if (a === 0 && b === 0) continue;
      for (const [sa, sb] of here) {
        if (sa > a || sb > b) continue;
        if (reached.has(key(a - sa, b - sb))) { reached.add(key(a, b)); break; }
      }
    }
  }
  return reached.has(key(owedA, owedB));
}

/**
 * The strictest mixing law the seats still owed can be finished under.
 *
 * This is the question lawfulFour has to answer before it holds a court to
 * the strict law for another draw, and until 2026-09-11 it read as parity:
 * strict while both tiers owed an even number of games. Parity is NECESSARY
 * for an all-strict night, because every strict shape spends A seats and B
 * seats in twos and fours. It is not sufficient, and two courts of five
 * showed it. Two A's and three B's at four each owe eight seats and twelve;
 * neither tier can field a pure game, so every seat has to come out of a
 * mixed one, and four strict games spend the A's while the B's still owe
 * four. The card dealt a sixth game to finish the B's and the two A's ended
 * the night on six games against the other three's four. The night that fits
 * is three strict games and two of one A among three B's, which is the soft
 * law. Three A's and two B's is the mirror, and soft cannot deal it: with
 * two B's a game with a B on each side is always an A and a B against an A
 * and a B, so the mirror needs the one shape only the free law allows, a B
 * among three A's, twice.
 *
 * So the ladder, rather than a parity test: hold the club's rule wherever
 * the seats can still be finished under it, drop one rung where they cannot,
 * and drop to free only where nothing else deals the night out level. The
 * alternative on those two courts is not a stricter night, it is two players
 * finishing two games ahead of the other three.
 *
 * C's are not in this, and the caller is the one that knows. A C game spends
 * B seats too (three C's and the bridge, or two or three B's on a relaxed
 * court), and how many of them the night spends is not fixed until the
 * finish is chosen, so an answer read off the A and B totals alone would be
 * answering a question it cannot see all of. lawfulFour asks this only where
 * there are no C's on the court.
 */
export function lawForOwedSeats(
  owedA: number,
  owedB: number,
  aCount: number,
  bCount: number,
): "strict" | "soft" | "free" {
  if (finishExists(STRICT_SHAPES, owedA, owedB, aCount, bCount)) return "strict";
  if (finishExists(SOFT_SHAPES, owedA, owedB, aCount, bCount)) return "soft";
  if (finishExists(FREE_SHAPES, owedA, owedB, aCount, bCount)) return "free";
  // The floor. Nothing on the ladder finishes these seats, because they are
  // not a multiple of four: every shape spends four, so a card that grew for
  // a walk-in or shrank for a leaver, and every extended target, lands here
  // at once. Returning free then handed those courts the loosest law in the
  // book for the rest of the night on the strength of a question none of the
  // rungs could answer. So the floor answers the way the parity reading did
  // before the ladder existed, and a card nothing can finish keeps the law
  // it had rather than losing it (2026-09-11).
  return owedA % 2 === 0 && owedB % 2 === 0 ? "strict" : "soft";
}

/**
 * Can the seats still owed be dealt out into whole lawful games at all,
 * under any of the three laws?
 *
 * The ladder's own question, asked as a yes or no. lawForOwedSeats answers
 * a law and has to answer one even where nothing finishes, so it floors to
 * the parity reading; this is how a caller tells that floor from a real
 * finish. Seats and headcounts only, with the same deliberate blind spot:
 * it does not model who owes what, so it says yes to four A seats owed by
 * one A. Yes is the safe way to be wrong here as well.
 */
export function seatsFinishable(
  owedA: number,
  owedB: number,
  aCount: number,
  bCount: number,
): boolean {
  return finishExists(FREE_SHAPES, owedA, owedB, aCount, bCount);
}

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
    /**
     * How many times two players have already shared a MATCH tonight, on
     * either side of the net. Ranked above partnerships: the same four back
     * on court with the partners swapped is the game everybody remembers as
     * a repeat. Found on a Wednesday with twenty on one court, where the
     * first four were the fifteenth four.
     */
    met?: (a: string, b: string) => number;
    /**
     * True while a C on this court is still owed a game. The designated B
     * is then kept for the beginners' matches: a B match that borrows the
     * bridge costs the bridge a game later, because every C match needs
     * them, and the variety preference would otherwise reach for the one B
     * who has not mixed with the others yet. Ranked with the soft C
     * preference, below fairness, so it never holds anybody's game back.
     */
    bridgeBusy?: boolean;
    /**
     * How many mixed games (an A and a B on each side) a player has had.
     * A mixed game goes to whoever has had fewest, so the same four B's do
     * not take every mixed game and leave the other four to play each
     * other again at the end. Ranked below fairness and familiarity.
     */
    mixed?: (playerId: string) => number;
    /**
     * How many times these exact four have shared a court tonight. Ranked
     * straight after fairness: the same four again is the game everybody
     * remembers, and it is never dealt while another four as fair exists.
     */
    sameFour?: (ids: readonly string[]) => number;
    /**
     * Groups who play only each other from here. The first is the players
     * on the lowest played count who are still owed a game, the band the
     * next games are dealt from; with the cap on, the A's in that band who
     * have had their game with the B's are a band of their own, and so are
     * the B's when no A in the band can still mix. With eight in a group,
     * the four not chosen now are the four dealt next, and if THEY have
     * already played together, or met, the repeat is being dealt one game
     * early; that is charged here too. Found on the Wednesday roster under
     * the cap, where the last pure game of A's was whoever the two before
     * it happened to leave, and twice it was two pairs on their third
     * meeting.
     */
    bands?: readonly (readonly string[])[];
    /**
     * The third law's price for dealing these four: what this game charges
     * the A's in it (their k-th game with the B's costs k-1) plus the
     * smallest charge any lawful finish of the rest of the night carries
     * after it. Zero means the cap still holds; a positive number means
     * these four force somebody's second B game, now or later. Ranked
     * FIRST.
     *
     * Absent for two reasons, not one. On a court with no A or no B it is
     * 0 for every four and not worth asking. And since 2026-09-11 it is
     * absent on a BLIND court, which has both: one whose seats the
     * picker's own law can finish while the oracle, reading the law off
     * the parities, prices every finish at Infinity. lawfulFour says at
     * length what that costs.
     */
    cost?: (ids: readonly string[]) => number;
    /**
     * This game's own part of `cost`: the sum of the B games the A's in it
     * have already had, when the four holds a B. Read separately so a game
     * that gives A's their FIRST game with the B's (charge 0) can be told
     * from one that only avoids the B's.
     *
     * Absent exactly where `cost` is, and it means the same thing: nobody
     * is counting. The ticket key below then says nothing about any four,
     * rather than calling every mixed four a first game. Read through a
     * fallback of zero it inverted: every four that mixed looked like an
     * A's one game with the B's and every pure four like a repeat, on the
     * one kind of draw where no count of crossings is kept (2026-09-12).
     */
    charge?: (ids: readonly string[]) => number;
  } = {},
): Chosen | null {
  const { windowSize = 12, playedBy, partnered, met, bridgeBusy = false, mixed, sameFour, bands = [], cost, charge } = options;
  const mixedGames = mixed ?? (() => 0);
  const repeatOf = sameFour ?? (() => 0);
  const priceOf = cost ?? (() => 0);
  const chargeOf = charge ?? (() => 0);
  const window = queue.slice(0, Math.max(4, windowSize));
  let best: Chosen | null = null;
  // Ranked in this order, and the order is the whole fairness argument:
  //   1. the third law's cost, so no A is dealt a second game with the B's
  //      while a four that avoids one exists. This is the ONE key above
  //      fairness, by the owner's word on 2026-09-10 ("highly important for
  //      our business"), and it is what it sounds like: the cap can hold a
  //      least-played player back a game. Measured on the Wednesday roster,
  //      the spread touches 2 (never 3) on about half of A-and-B nights
  //      and stays at 1 on the rest. Where the seats force second games the
  //      cost still ranks, so they are spread over different A's;
  //   2. games already played, so the people owed a game go on;
  //   3. the same four again, now or as the game this choice leaves last;
  //   4. the soft C preference, which only ever separates equals;
  //   5. spending an unused ticket: among fours as fair as each other, one
  //      that gives A's their one game with the B's beats a pure game, so
  //      every A gives that game rather than the B's being mixed as little
  //      as the seats allow. That is also what keeps the Wednesday roster
  //      AT THREE EACH from meeting the same person three times: with only
  //      the mixed games the seats force, the A's fill seven pure games
  //      among twelve. At three each and no further. The same twenty at
  //      four and at five meet somebody a third time however this key
  //      ranks, because fifteen games leave room for it and twenty and
  //      twenty-five do not (2026-09-11). The key is SILENT on every draw
  //      the cost key is off for, because what it asks is whether these
  //      A's have crossed the net yet and nothing there is counting;
  //   6. the even mixed shape, two and two, over the lone A among B's and
  //      the lone B among A's. The even one is the club's own shape, A B
  //      against A B; the other two are what the ladder allows where the
  //      seats cannot be finished without them, so among fours as fair as
  //      each other the concession is left for the draw that needs it
  //      (2026-09-12);
  //   7. who has met whom, so the same four does not come round again;
  //   8. mixed games had, so the same B's do not take every mixed game;
  //   9. repeated partnerships, so the same two are not dealt together again
  //      while an untried split costs nothing in fairness;
  //  10. queue position, so the result is deterministic.
  // The fairness key is the four players' played counts SORTED, compared
  // lexicographically, not their sum. A sum lets [0,0,3,3] tie with [1,1,2,2],
  // which would put somebody on their fourth game while somebody else was
  // still on their first: exactly the drift the court is supposed to prevent.
  // Sorted-and-lexicographic makes "the least played four" precise, and any
  // other four with the same vector is equally fair by definition.
  type Key = { cost: number; played: number[]; exact: number; penalty: number;
               spend: number; shape: number; familiar: number; mixedSum: number;
               repeats: number; position: number };
  let bestKey: Key | null = null;
  const games = playedBy ?? (() => 0);
  const together = partnered ?? (() => 0);
  const shared = met ?? (() => 0);
  const metAmong = (ids: readonly string[]) => {
    let sum = 0;
    for (let x = 0; x < ids.length; x++) for (let y = x + 1; y < ids.length; y++) sum += shared(ids[x], ids[y]);
    return sum;
  };
  const better = (k: Key, b: Key | null): boolean => {
    if (!b) return true;
    if (k.cost !== b.cost) return k.cost < b.cost;
    for (let n = 0; n < k.played.length; n++) {
      if (k.played[n] !== b.played[n]) return k.played[n] < b.played[n];
    }
    if (k.exact !== b.exact) return k.exact < b.exact;
    if (k.penalty !== b.penalty) return k.penalty < b.penalty;
    if (k.spend !== b.spend) return k.spend < b.spend;
    if (k.shape !== b.shape) return k.shape < b.shape;
    if (k.familiar !== b.familiar) return k.familiar < b.familiar;
    if (k.mixedSum !== b.mixedSum) return k.mixedSum < b.mixedSum;
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
          // Every pair among the four: how often they have shared a court.
          let familiar = metAmong(ids);
          // The same four again, now or as the game this choice leaves last.
          let exact = repeatOf(ids);
          // A band of eight makes the four not chosen the next four, so
          // what they would repeat is charged to this choice as well.
          const band = bands.find((b) => b.length === 8 && ids.every((id) => b.includes(id)));
          if (band) {
            const left = band.filter((id) => !ids.includes(id));
            exact += repeatOf(left);
            familiar += metAmong(left);
          }
          // A mixed game counts against whoever has already had one.
          const tiersHere = ids.map(ctx.tierById);
          const isMixed = tiersHere.includes("A") && tiersHere.includes("B");
          // How lopsided a mixed four is: 0 for two and two, 2 for the
          // lone A among B's and the lone B among A's. The even shape is
          // preferred among fours as fair as each other, because it is the
          // shape the club wrote down, A B against A B. The other two are
          // concessions the ladder makes where the seats cannot be
          // finished without them, so a draw that does not need one does
          // not spend one.
          //
          // It is NOT that the even shape spends the scarcer tier faster,
          // which is what this said until 2026-09-12. On a court with more
          // A's than B's and three B's or more, five A's and three B's at
          // four each for instance, the uneven four on offer is one A
          // among three B's, and that spends the scarce tier three seats
          // at a time where the even one spends two. The argument ran the
          // wrong way round; the preference itself is worth having.
          //
          // Measured on 2026-09-12 over the mid-night sweep, against the
          // same tree with this key taken out: 6,082 uneven mixed games
          // where there were 6,882, the lone B among three A's on a bound
          // law down from 81 to 49, and three of the six nights that gave
          // an A an extra game with the B's for main's exact finish stop
          // doing it. Three still do it: three A's with five B's and an A
          // arriving before game seven, with seven B's before game nine,
          // and with eight B's before game ten.
          const shape = isMixed
            ? Math.abs(tiersHere.filter((t) => t === "A").length
              - tiersHere.filter((t) => t === "B").length)
            : 0;
          const mixedSum = isMixed ? ids.reduce((sum, id) => sum + mixedGames(id), 0) : 0;
          // The third law's price, asked once per four and only of a four
          // with a lawful split, so the oracle behind it is never run for
          // a game that could not be dealt anyway.
          let price: { cost: number; spend: number } | null = null;
          for (const [x, y, z, w] of SPLITS) {
            const lineup: Lineup = { teamA: [ids[x], ids[y]], teamB: [ids[z], ids[w]] };
            if (!isLegal(lineup, ctx)) continue;
            if (!price) {
              // A ticket is spent when the four mixes and no A in it has
              // met the B's yet: these A's are having their one game. With
              // no charge to read the key says NOTHING, rather than saying
              // it of every mixed four: on a blind draw chargeOf falls back
              // to zero, which read every mixed four as a first game and
              // every pure one as a repeat, on exactly the draws where
              // nothing is counting how many times those A's have already
              // crossed the net (2026-09-12).
              price = {
                cost: priceOf(ids),
                spend: charge === undefined ? 0 : isMixed && chargeOf(ids) === 0 ? 0 : 1,
              };
            }
            const borrowsBridge = bridgeBusy && ctx.designatedB !== null
              && ids.includes(ctx.designatedB)
              && !ids.some((id) => ctx.tierById(id) === "C");
            const key: Key = {
              cost: price.cost,
              played,
              exact,
              penalty: softPenalty(lineup, ctx) + (borrowsBridge ? 1 : 0),
              spend: price.spend,
              shape,
              familiar,
              mixedSum,
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
