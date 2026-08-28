// Seeding and running a court's playoff.
//
// The bracket is a VERTICAL STAGE LIST, and that is a data decision as much as
// a layout one: a stage is an ordered list of ties, and a tie is two sides. No
// tree, no left/right children, no positional arithmetic.
//
// EVERY PLAYER ON THE COURT IS IN THE PLAYOFF. An earlier version seeded only
// the top four and sent the other half of the court home for the climax, which
// is the opposite of the night the spec describes.
//
// PAIRING SPLITS ADJACENT SEEDS: 1+3, 2+4, 5+7, 6+8, and onwards. Seeds 1 and
// 2 are NEVER partners. Frame 21 puts the reason on screen for the operator:
// pairing the top two builds a superteam and makes the final a coronation,
// while splitting adjacent seeds gives every pair one high seed and one lower,
// so any pair can beat any pair. The rule is stated here as well because the
// obvious "simplification" is to pair 1+2, 3+4 and reintroduce the superteam.
//
// Seeding reads straight off the standings, and standings are total: points,
// then score difference, then who reached the total first. There is no tie
// left over to resolve, so nothing here can ever be "blocked by a tie". Only
// two things block a playoff: not enough players, and matches still owed.

import type { Match, Player, PlayoffStage as StoredStage } from "../types";
import { computeStandings, type PlayedMatch } from "./standings";
import { matchesPlayedBy } from "./rotation";

/**
 * The stages a playoff can have.
 *
 * types.ts owns the stage tag that gets persisted on a Match, and its union
 * had exactly ONE member. That was a real guarantee and it was there for a
 * real bug: a match was once minted tagged "semi" while the bracket looked its
 * row up as "final", so a recorded score never landed on its row and no
 * champion could be crowned. With one spelling in existence, the two could not
 * drift.
 *
 * A bracket with play-ins and semifinals cannot live inside one member, so the
 * union is widened here, on top of the stored one rather than instead of it.
 * What replaces the old guarantee is structural: a Tie carries its own stage,
 * seedPlayoffMatch is the only thing that mints a match and it reads the tag
 * off the tie it was handed, and the same tie identity is what reads the match
 * back. The bracket and the match cannot disagree because neither one spells
 * the stage independently. The test file proves mint-then-read-back for every
 * member of this union, which is the guarantee the compiler used to carry.
 */
export type PlayoffStage = StoredStage;

/** In play order. Exported so tests can walk every stage without a literal list. */
export const PLAYOFF_STAGES: readonly PlayoffStage[] = ["playIn", "semi", "final"];

/**
 * One side of a tie.
 *
 * `playerIds` is an array and not a two-tuple because a side may hold THREE
 * ids. On a nine-player court the odd seed joins the last pair as a rotating
 * trio so that nobody watches the climax from the fence, and pretending that
 * side is a pair is how the ninth player gets quietly dropped.
 */
export interface SeededPair {
  /** 1-based seeds in standings order. Three of them when this side is a trio. */
  seeds: number[];
  /** Player ids, index aligned with `seeds`. */
  playerIds: string[];
}

/** A side that rotates three players through two slots. */
export const isTrio = (side: SeededPair): boolean => side.playerIds.length === 3;

export interface Readiness {
  ready: boolean;
  /** Players eligible to be seeded, in standings order. */
  eligible: string[];
  /** Matches still owed across the court, 0 when the round robin is done. */
  matchesOutstanding: number;
  /**
   * Why it is not ready, or null. Never a tie: standings are total.
   */
  blocker: "notEnoughPlayers" | "matchesOutstanding" | null;
}

/** A playoff needs two sides on court, so a court needs at least four players. */
export const MIN_FOR_PLAYOFF = 4;

export function readiness(
  players: readonly Player[],
  matches: readonly Match[],
  court: number,
  targetMatches: number,
): Readiness {
  const onCourt = players.filter((p) => p.courtNumber === court && !p.away);
  const outstanding = onCourt.reduce(
    (sum, p) => sum + Math.max(0, targetMatches - matchesPlayedBy(matches, p.id)),
    0,
  );
  const eligible = orderedPlayerIds(players, matches, court);

  if (onCourt.length < MIN_FOR_PLAYOFF) {
    return { ready: false, eligible, matchesOutstanding: outstanding, blocker: "notEnoughPlayers" };
  }
  if (outstanding > 0) {
    return { ready: false, eligible, matchesOutstanding: outstanding, blocker: "matchesOutstanding" };
  }
  return { ready: true, eligible, matchesOutstanding: 0, blocker: null };
}

/** Standings order for one court, as player ids. */
export function orderedPlayerIds(
  players: readonly Player[],
  matches: readonly Match[],
  court: number,
): string[] {
  const ids = players.filter((p) => p.courtNumber === court && !p.away).map((p) => p.id);
  const played: PlayedMatch[] = matches
    .filter((m) => m.courtNumber === court && m.status === "played" && m.stage === null)
    .map((m) => ({
      matchIndex: m.matchIndex,
      completedAt: m.completedAt,
      teamA: m.teamA,
      teamB: m.teamB,
      scoreA: m.scoreA ?? 0,
      scoreB: m.scoreB ?? 0,
    }));
  return computeStandings(ids, played).map((r) => r.playerId);
}

/** Seeds are walked four at a time, and each block of four makes two sides. */
const BLOCK = 4;

/**
 * Seed the whole court.
 *
 * Walk the standings order in blocks of four consecutive seeds. Within each
 * block [a,b,c,d] emit (a,c) and (b,d), which gives 1+3, 2+4, 5+7, 6+8, 9+11,
 * 10+12 and so on. Adjacent seeds are split, so seeds 1 and 2 can only meet
 * across the net.
 *
 * The leftovers are the awkward headcounts the spec names:
 *   - two left over (ten on a court) become their own fifth side, 9+10, and
 *     the bracket then owes a play-in.
 *   - one left over (nine on a court) joins the LAST side as a rotating trio,
 *     so the ninth player is in the climax rather than watching it.
 *   - three left over is not a headcount the spec draws. It is handled as one
 *     trio side of those three, derived from the nine-player rule: whenever a
 *     single seed cannot be paired, it rotates through a side rather than
 *     sitting out.
 *
 * Returns null below four players, because the caller should show the
 * readiness frame rather than a half bracket.
 */
export function seedPairs(orderedIds: readonly string[]): SeededPair[] | null {
  if (orderedIds.length < MIN_FOR_PLAYOFF) return null;

  const side = (...seeds: number[]): SeededPair => ({
    seeds,
    playerIds: seeds.map((s) => orderedIds[s - 1]),
  });

  const pairs: SeededPair[] = [];
  const paired = Math.floor(orderedIds.length / BLOCK) * BLOCK;
  for (let a = 1; a <= paired; a += BLOCK) {
    pairs.push(side(a, a + 2));
    pairs.push(side(a + 1, a + 3));
  }

  const rest: number[] = [];
  for (let s = paired + 1; s <= orderedIds.length; s += 1) rest.push(s);

  if (rest.length === 2 || rest.length === 3) {
    pairs.push(side(...rest));
  } else if (rest.length === 1) {
    const last = pairs[pairs.length - 1];
    pairs[pairs.length - 1] = side(...last.seeds, rest[0]);
  }
  return pairs;
}

/**
 * Which two of a side are actually on court for one match.
 *
 * A pair fields both. A trio rotates: the seat-out moves on every appearance,
 * so across a three match bracket all three play. `appearance` is how many
 * playoff matches this side has already played.
 *
 * The rotation starts at the TOP of the side, which means the seed who joined
 * last is on court for the side's first match. A trio that loses its first
 * match plays no others, and putting the odd seed on for it is the whole
 * reason they were folded into a side instead of left watching.
 */
export function fieldedPlayers(side: SeededPair, appearance: number): [string, string] {
  if (side.playerIds.length < 3) return [side.playerIds[0], side.playerIds[1]];
  const out = ((appearance % 3) + 3) % 3;
  const on = side.playerIds.filter((_, i) => i !== out);
  return [on[0], on[1]];
}

export interface Tie {
  /** Stable across renders and rebuilds, e.g. "semi-2". */
  id: string;
  /** The tag the minted match carries. Written here, read back from here. */
  stage: PlayoffStage;
  /** Null while the stage that feeds this side is unresolved. */
  sideA: SeededPair | null;
  sideB: SeededPair | null;
  scoreA: number | null;
  scoreB: number | null;
  /** The match bound to this row, so scoring lands on the row that shows it. */
  matchId: string | null;
  /** On court now. Frame 21 draws the "Live" chip from this. */
  live: boolean;
  settled: boolean;
  /** Settled without playing: the named side advanced. Scores stay null. */
  walkover: "A" | "B" | null;
}

/** A tie whose sides are both known, so a match can be minted for it. */
export interface PlayableTie extends Tie {
  sideA: SeededPair;
  sideB: SeededPair;
}

export interface Stage {
  key: PlayoffStage;
  label: string;
  /**
   * The singular stage word for one row of this stage: "Quarterfinal",
   * "Play-in", "Semifinal", "Final". It lives here rather than in a key-to-word
   * map in the shell because the first stage's name depends on the SHAPE, not
   * the key: eight pairs open with quarterfinals, six with play-ins, and both
   * store their matches under the key "playIn".
   */
  word: string;
  ties: Tie[];
}

/**
 * Read a stored stage tag as a bracket stage.
 *
 * No cast: types.ts's union is a subset of this file's, so the widening is an
 * ordinary assignment today and stays one when types.ts widens. If types.ts
 * ever grows a stage this file does not know about, this line stops compiling,
 * which is exactly the warning that should be loud.
 */
const stageOf = (m: Match): PlayoffStage | null => m.stage;

/** Every id the match put on court comes from this side. */
const drawnFrom = (team: readonly string[], side: SeededPair): boolean =>
  team.every((id) => side.playerIds.includes(id));

/**
 * The match belonging to a row.
 *
 * Bound by stage plus who is on court rather than by array position, so it
 * does not matter which order the operator scores two semifinals in. Sides are
 * disjoint (a player is in exactly one side), so at most one row can claim a
 * match. Membership is a subset test, not equality, because a trio puts two of
 * its three on court.
 */
function boundMatch(
  stage: PlayoffStage,
  sideA: SeededPair | null,
  sideB: SeededPair | null,
  matches: readonly Match[],
): Match | null {
  if (!sideA || !sideB) return null;
  const hits = matches.filter(
    (m) => stageOf(m) === stage && drawnFrom(m.teamA, sideA) && drawnFrom(m.teamB, sideB),
  );
  // A voided row gets re-minted, so the newest match is the live truth.
  return hits.length === 0
    ? null
    : hits.reduce((newest, m) => (m.matchIndex >= newest.matchIndex ? m : newest));
}

export function makeTie(
  stage: PlayoffStage,
  index: number,
  sideA: SeededPair | null,
  sideB: SeededPair | null,
  matches: readonly Match[],
): Tie {
  const m = boundMatch(stage, sideA, sideB, matches);
  return {
    id: `${stage}-${index + 1}`,
    stage,
    sideA: sideA ?? null,
    sideB: sideB ?? null,
    scoreA: m?.scoreA ?? null,
    scoreB: m?.scoreB ?? null,
    matchId: m?.id ?? null,
    live: m?.status === "onCourt",
    settled: m?.status === "played",
    walkover: m?.walkover ?? null,
  };
}

/**
 * Who won a row, or null while it is unfinished.
 *
 * A dead heat also returns null: the next row keeps waiting rather than being
 * handed a winner nobody played for.
 */
export function winnerOf(tie: Tie): SeededPair | null {
  if (!tie.settled) return null;
  // A walkover names its winner without any numbers to compare.
  if (tie.walkover) return tie.walkover === "A" ? tie.sideA : tie.sideB;
  if (tie.scoreA == null || tie.scoreB == null) return null;
  if (tie.scoreA === tie.scoreB) return null;
  return tie.scoreA > tie.scoreB ? tie.sideA : tie.sideB;
}

/**
 * The bracket as the frames draw it: an ordered list of stages, each a list of
 * full width ties, top of the list played first.
 *
 * Shapes, all of them crossing top against bottom so the leaders meet last:
 *   - 2 sides: the FINAL only. Two sides play each other once, and emitting a
 *     semifinal as well leaves the final waiting on a second semifinal that
 *     can never be played, so the bracket cannot be finished even though the
 *     winner is known. That was a real bug and there is a test for it.
 *   - 3 sides: play-in (P2 v P3), then the final against P1. The wireframes do
 *     not draw this one. It is derived from the five-side rule rather than
 *     invented: the surplus sides play down to the round size, and here the
 *     round after the play-in is a final of two.
 *   - 4 sides: semifinals (P1 v P4, P2 v P3), then the final.
 *   - 5 sides: play-in (P4 v P5), then semifinals (P1 v the play-in winner,
 *     P2 v P3), then the final. The play-in winner takes the last seat, which
 *     is why it meets P1.
 *   - 6 or more sides: the same rule generalised. The bottom 2n sides play n
 *     play-ins, crossed within their own block, until four remain.
 *
 * `playoffMatches` is one court's playoff matches. Nothing here reads the
 * round robin, and nothing merges two courts: each court has its own bracket
 * and its own champion, with no crossover final between them.
 */
export function buildStages(
  pairs: readonly SeededPair[],
  playoffMatches: readonly Match[],
): Stage[] {
  if (pairs.length < 2) return [];
  // Voided matches count for nothing anywhere else in the app, and a voided
  // playoff row is one the operator is about to replay.
  const matches = playoffMatches.filter((m) => m.status !== "voided");

  const stages: Stage[] = [];
  // Four sides make semifinals. Fewer than four can only be played down to a
  // final of two.
  const roundSize = pairs.length >= BLOCK ? 4 : 2;
  const surplus = Math.max(0, pairs.length - roundSize);
  const seededThrough = pairs.length - surplus * 2;

  let field: (SeededPair | null)[] = pairs.slice(0, seededThrough);

  if (surplus > 0) {
    const block = pairs.slice(seededThrough);
    const ties = block
      .slice(0, surplus)
      .map((top, i) => makeTie("playIn", i, top, block[block.length - 1 - i], matches));
    // When nobody is seeded through, every pair enters here and the round is
    // not a play-in at all: eight pairs opening 1v8, 2v7, 3v6, 4v5 are
    // quarterfinals, and a live walk caught the card calling them a play-in.
    // The key stays "playIn" either way, because minted matches are stored
    // under it and renaming the key would orphan a bracket in flight.
    const quarterfinals = seededThrough === 0 && ties.length === 4;
    stages.push({
      key: "playIn",
      label: quarterfinals ? "Quarterfinals" : ties.length > 1 ? "Play-ins" : "Play-in",
      word: quarterfinals ? "Quarterfinal" : "Play-in",
      ties,
    });
    field = [...field, ...ties.map(winnerOf)];
  }

  if (field.length === 4) {
    // Cross top against bottom: first meets last, second meets third.
    const ties = [
      makeTie("semi", 0, field[0], field[3], matches),
      makeTie("semi", 1, field[1], field[2], matches),
    ];
    stages.push({ key: "semi", label: "Semifinals", word: "Semifinal", ties });
    field = ties.map(winnerOf);
  }

  stages.push({
    key: "final",
    label: "Final",
    word: "Final",
    ties: [makeTie("final", 0, field[0], field[1], matches)],
  });
  return stages;
}

/**
 * The next row that can go on court: sides known, not already live, not
 * settled. Null when the bracket is waiting on a result, which is what keeps
 * the final from being seeded before both semifinals are in.
 */
export function nextTie(stages: readonly Stage[]): PlayableTie | null {
  const resolved = (tie: Tie): tie is PlayableTie => tie.sideA !== null && tie.sideB !== null;
  for (const stage of stages) {
    for (const tie of stage.ties) {
      if (!tie.live && !tie.settled && resolved(tie)) return tie;
    }
  }
  return null;
}

/**
 * How many playoff matches this side has already played, which is what moves a
 * trio's seat along. Counted over ONE court's playoff matches; sides are
 * disjoint, so any id appearing is this side appearing.
 */
const appearances = (side: SeededPair, matches: readonly Match[]): number =>
  matches.filter(
    (m) =>
      m.status !== "voided" &&
      [...m.teamA, ...m.teamB].some((id) => side.playerIds.includes(id)),
  ).length;

/**
 * Build the match a playoff row puts on court.
 *
 * This is the ONLY place a playoff match is minted, and the stage tag comes
 * off the tie rather than being spelled at the call site. The tag was once
 * written as "semi" here while the bracket read the row back as "final": the
 * match was created, the score was recorded, and the row it belonged to stayed
 * at 00-00 with no champion. Nothing on screen looked broken, which is what
 * made it expensive. One mint, one tag, read back through the same tie.
 *
 * `playoffMatches` is this court's playoff history so far. It is read only to
 * work out where a trio's rotation has got to.
 */
export function seedPlayoffMatch(
  courtNumber: number,
  tie: PlayableTie,
  matchIndex: number,
  now: number,
  playoffMatches: readonly Match[] = [],
): Match {
  return {
    id: `po-${courtNumber}-${tie.id}-${now.toString(36)}`,
    courtNumber,
    matchIndex,
    teamA: fieldedPlayers(tie.sideA, appearances(tie.sideA, playoffMatches)),
    teamB: fieldedPlayers(tie.sideB, appearances(tie.sideB, playoffMatches)),
    scoreA: null,
    scoreB: null,
    status: "onCourt",
    startedAt: now,
    completedAt: null,
    stage: tie.stage,
  };
}

/** The crowned side, or null while the final is unplayed. May be a trio. */
export function champion(stages: readonly Stage[]): SeededPair | null {
  const final = stages.find((s) => s.key === "final")?.ties[0];
  return final ? winnerOf(final) : null;
}
