// The Set teammate branch (frames 35 to 37): pick partners, play the night
// as teams.
//
// Pairs are the organiser's own, made at the door on frame 30 and fixed for
// the night. The round robin then runs over PAIRS the way the individual
// night runs over players: least-played-first decides who goes on next, and
// opponents vary before any rematch. One draw feeds every court, so nobody
// is assigned anywhere; a tie goes to whichever court is free. No tier law
// runs here, because the organiser's pairing is the balance.
//
// Two rules keep the promise honest on a real night. The picker refuses a
// tie that would leave the remaining games unmatchable, so a pair standing
// on a court with three games still to play is never stranded by the two
// free pairs burning their last games on each other: the court waits
// instead. And a court holds rather than dealing the two pairs that just
// walked off it back on against each other while fresher opponents are
// about to come free, which is the whole night when the pairs are exactly
// twice the courts.
//
// Standings are the individual engine's standings with a pair standing in
// for a player, which is not a trick but the point: points, then score
// difference, then who reached the total first, and the row explains
// itself the same way. The table then ends one of two ways (frame 37):
// crowned as it stands, or seeded into the knockout, first against last.

import type { KnockoutPair, Match } from "../types";
import { fieldedPlayers, type SeededPair } from "./playoff";
import { computeStandings, type PlayedMatch, type StandingsRow } from "./standings";

const NOBODY: ReadonlySet<string> = new Set();

/** A pair's identity for the night: its members, not its draw position. */
export const pairKey = (pair: Pick<KnockoutPair, "playerIds">): string =>
  [...pair.playerIds].sort().join("+");

/** The pair a fielded side was drawn from, or null for a side nobody owns. */
export const pairOfSide = (
  pairs: readonly KnockoutPair[],
  side: readonly string[],
): KnockoutPair | null =>
  pairs.find((p) => side.every((id) => p.playerIds.includes(id))) ?? null;

/** Matches that count: everything not voided. */
const counting = (matches: readonly Match[]): Match[] =>
  matches.filter((m) => m.status !== "voided" && m.stage === null);

/** The members of a pair still here tonight. */
const presentMembers = (pair: KnockoutPair, away: ReadonlySet<string>): string[] =>
  pair.playerIds.filter((id) => !away.has(id));

/**
 * The pairs that can still field two. A pair whose member has left is out
 * of the night: it is dealt no more games and the table ends without it,
 * the way the round robin's queue drops a leaver. A trio with one away
 * still has two and plays on.
 */
export const presentPairs = (
  pairs: readonly KnockoutPair[],
  away: ReadonlySet<string> = NOBODY,
): KnockoutPair[] => pairs.filter((p) => presentMembers(p, away).length >= 2);

/** Games a pair has PLAYED, and games it is standing in right now. */
export function pairCounts(
  pairs: readonly KnockoutPair[],
  matches: readonly Match[],
): Map<string, { played: number; onCourt: number }> {
  const out = new Map(pairs.map((p) => [pairKey(p), { played: 0, onCourt: 0 }]));
  for (const m of counting(matches)) {
    for (const side of [m.teamA, m.teamB]) {
      const p = pairOfSide(pairs, side);
      if (!p) continue;
      const c = out.get(pairKey(p))!;
      if (m.status === "played") c.played += 1;
      if (m.status === "onCourt") c.onCourt += 1;
    }
  }
  return out;
}

/** How many times two pairs have met, played or standing on court now. */
const timesMet = (
  pairs: readonly KnockoutPair[],
  matches: readonly Match[],
  a: KnockoutPair,
  b: KnockoutPair,
): number =>
  counting(matches).filter((m) => {
    const x = pairOfSide(pairs, m.teamA);
    const y = pairOfSide(pairs, m.teamB);
    if (!x || !y) return false;
    const ka = pairKey(a), kb = pairKey(b);
    return (pairKey(x) === ka && pairKey(y) === kb) || (pairKey(x) === kb && pairKey(y) === ka);
  }).length;

/**
 * The most matches a set of remaining deficits can still make. Every match
 * takes one game off two different pairs, so the pairs' deficits are the
 * degrees of a multigraph: the sum halves into matches unless one pair
 * holds more than everyone else together, in which case the others run out
 * first and that pair is left holding games nobody can play.
 */
const capacity = (deficits: readonly number[]): number => {
  const sum = deficits.reduce((a, b) => a + b, 0);
  const max = Math.max(0, ...deficits);
  return Math.min(Math.floor(sum / 2), sum - max);
};

/**
 * The next tie to put on a free court, or null when nothing should go on.
 *
 * Least-played-first over pairs picks who plays; a pair already on a court
 * is not picked twice; a pair at its target is done; a pair whose member
 * has left is out. The opponent is the least-played pair this one has met
 * FEWEST times, so the whole field plays each other before anybody plays
 * anybody twice.
 *
 * Two refusals, in that preference order, falling through to the next
 * candidate each time. A tie that would strand somebody (the remaining
 * deficits could no longer all be matched) is never dealt, so the court
 * waits for a pair still on another court. And a rematch is not dealt
 * while a pair one of them has met fewer times is standing on a court with
 * games still to play: the court waits for that match to end instead of
 * running the same two pairs against each other all night.
 */
export function nextTeamTie(
  pairs: readonly KnockoutPair[],
  matches: readonly Match[],
  target: number,
  away: ReadonlySet<string> = NOBODY,
): { a: KnockoutPair; b: KnockoutPair } | null {
  const active = presentPairs(pairs, away);
  const counts = pairCounts(pairs, matches);
  const count = (p: KnockoutPair) => counts.get(pairKey(p))!;
  const deficit = (p: KnockoutPair) => Math.max(0, target - count(p).played - count(p).onCourt);
  const free = active.filter((p) => count(p).onCourt === 0 && deficit(p) > 0);
  if (free.length < 2) return null;

  const before = capacity(active.map(deficit));
  const stillMatchable = (a: KnockoutPair, b: KnockoutPair) =>
    capacity(active.map((p) => deficit(p) - (p === a || p === b ? 1 : 0))) === before - 1;
  const met = (x: KnockoutPair, y: KnockoutPair) => timesMet(pairs, matches, x, y);
  const fresherOnCourt = (a: KnockoutPair, b: KnockoutPair) => {
    const ab = met(a, b);
    if (ab === 0) return false;
    return active.some((p) =>
      count(p).onCourt > 0 && deficit(p) > 0 && (met(a, p) < ab || met(b, p) < ab));
  };

  const played = (p: KnockoutPair) => count(p).played;
  const byPlayed = [...free].sort((x, y) => played(x) - played(y) || x.seed - y.seed);
  for (const a of byPlayed) {
    const others = free
      .filter((p) => pairKey(p) !== pairKey(a))
      .sort((x, y) =>
        met(a, x) - met(a, y)
        || played(x) - played(y)
        || x.seed - y.seed);
    for (const b of others) {
      if (!stillMatchable(a, b)) continue;
      if (fresherOnCourt(a, b)) continue;
      return { a, b };
    }
  }
  return null;
}

/**
 * The pairs off court with games still to play: who is waiting for the
 * next free court, least-played first.
 */
export function waitingPairs(
  pairs: readonly KnockoutPair[],
  matches: readonly Match[],
  target: number,
  away: ReadonlySet<string> = NOBODY,
): KnockoutPair[] {
  const counts = pairCounts(pairs, matches);
  const count = (p: KnockoutPair) => counts.get(pairKey(p))!;
  return presentPairs(pairs, away)
    .filter((p) => count(p).onCourt === 0 && count(p).played < target)
    .sort((x, y) => count(x).played - count(y).played || x.seed - y.seed);
}

/**
 * The night's games are over. Every pair still here has had its target,
 * or nothing is on a court and no tie can go on: a pair that left early
 * can leave the field one game short, and the table ends without waiting
 * for a game nobody can play.
 */
export const teamsComplete = (
  pairs: readonly KnockoutPair[],
  matches: readonly Match[],
  target: number,
  away: ReadonlySet<string> = NOBODY,
): boolean => {
  if (pairs.length === 0) return false;
  const live = counting(matches).some((m) => m.status === "onCourt");
  const anyPlayed = counting(matches).some((m) => m.status === "played");
  return anyPlayed && !live && nextTeamTie(pairs, matches, target, away) == null;
};

/**
 * Targets that make whole matches: every match is two pairs, so the pairs
 * times the target has to be even. Frame 35's own line for five pairs at
 * five: "5 pairs needs an even total."
 */
export const validTeamTargets = (pairCount: number, from = 2, to = 8): number[] =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i)
    .filter((t) => (pairCount * t) % 2 === 0);

/** Frame 35 preselects four. Four when it divides, else the next that does. */
export const suggestTeamTarget = (pairCount: number): number | null => {
  const valid = validTeamTargets(pairCount);
  return valid.includes(4) ? 4 : valid.find((t) => t > 4) ?? valid[0] ?? null;
};

/** Matches on the night for this many pairs at this target. */
export const teamMatchesTotal = (pairCount: number, target: number): number =>
  (pairCount * target) / 2;

/**
 * Which of a pair's games a match is: its first, its second. A played match
 * counts the games landed up to and including it; a live one is the game
 * after everything played. The card's chip, so a result paged back reads
 * as that game rather than tonight's running total.
 */
export function pairGameNumber(
  pairs: readonly KnockoutPair[],
  matches: readonly Match[],
  pair: KnockoutPair,
  matchId: string,
): number {
  const key = pairKey(pair);
  const mine = counting(matches).filter((m) =>
    [m.teamA, m.teamB].some((side) => {
      const p = pairOfSide(pairs, side);
      return p != null && pairKey(p) === key;
    }));
  const at = mine.find((m) => m.id === matchId);
  const playedBefore = (m: Match) => mine.filter((x) =>
    x.status === "played"
    && ((x.completedAt ?? 0) < (m.completedAt ?? 0)
      || ((x.completedAt ?? 0) === (m.completedAt ?? 0) && x.matchIndex < m.matchIndex))).length;
  if (!at || at.status !== "played") return mine.filter((m) => m.status === "played").length + 1;
  return playedBefore(at) + 1;
}

/**
 * The table over pairs. The individual engine does the arithmetic with a
 * pair standing in for a player, so the sort keys and the row's reason are
 * exactly frame 17's.
 */
export function teamStandings(
  pairs: readonly KnockoutPair[],
  matches: readonly Match[],
): StandingsRow[] {
  const played: PlayedMatch[] = matches
    .filter((m) => m.stage === null && m.status === "played" && m.scoreA != null && m.scoreB != null)
    .sort((a, b) => (a.completedAt ?? 0) - (b.completedAt ?? 0) || a.matchIndex - b.matchIndex)
    .flatMap((m, i) => {
      const a = pairOfSide(pairs, m.teamA);
      const b = pairOfSide(pairs, m.teamB);
      if (!a || !b) return [];
      return [{
        matchIndex: i + 1,
        completedAt: m.completedAt,
        teamA: [pairKey(a)],
        teamB: [pairKey(b)],
        scoreA: m.scoreA!,
        scoreB: m.scoreB!,
      }];
    });
  return computeStandings(pairs.map(pairKey), played);
}

/**
 * Frame 37's "Seed the bracket": the knockout draw straight off the table,
 * first against last. Position in the table becomes position in the draw,
 * and the knockout engine crosses top against bottom from there.
 */
export function seedByTable(
  pairs: readonly KnockoutPair[],
  rows: readonly StandingsRow[],
): KnockoutPair[] {
  const byKey = new Map(pairs.map((p) => [pairKey(p), p]));
  return rows
    .map((r) => byKey.get(r.playerId))
    .filter((p): p is KnockoutPair => p != null)
    .map((p, i) => ({ seed: i + 1, playerIds: [...p.playerIds] }));
}

const ORDINAL = [
  "", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth",
  "ninth", "tenth", "eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth", "sixteenth",
];
const WORD = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight",
  "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen",
];
const ROUND_NAME: Record<number, string> = {
  16: "the round of 16", 8: "quarterfinals", 4: "semifinals", 2: "the final",
};

/**
 * Frame 37's line under "Seed the bracket", in table positions, because on
 * this screen the draw order IS the table: "With 5 pairs: a play-in between
 * fourth and fifth, byes to the top three." The crossing is the knockout
 * engine's own (top against bottom, the bottom of the draw plays the
 * play-ins), stated rather than recomputed.
 */
export function tableShape(pairCount: number): string | null {
  if (pairCount < 2 || pairCount > 16) return null;
  const base = 2 ** Math.floor(Math.log2(pairCount));
  const surplus = pairCount - base;
  const seededThrough = pairCount - surplus * 2;
  const o = (n: number) => ORDINAL[n];
  const lead = `With ${pairCount} pairs:`;
  if (surplus === 0) {
    if (base === 2) return `${lead} the final, first against second.`;
    const crossing = base === 4
      ? `first against fourth and second against third`
      : `first against ${o(base)} down to ${o(base / 2)} against ${o(base / 2 + 1)}`;
    return `${lead} ${ROUND_NAME[base]} straight away, ${crossing}.`;
  }
  const byes = seededThrough === 1
    ? "a bye for the top pair"
    : `byes to the top ${WORD[seededThrough]}`;
  const top = seededThrough + 1;
  const playIns = surplus === 1
    ? `a play-in between ${o(top)} and ${o(pairCount)}`
    : surplus === 2
      ? `play-ins, ${o(top)} against ${o(pairCount)} and ${o(top + 1)} against ${o(pairCount - 1)}`
      : `play-ins, ${o(top)} against ${o(pairCount)} down to ${o(top + surplus - 1)} against ${o(pairCount - surplus + 1)}`;
  return `${lead} ${playIns}, ${byes}.`;
}

/**
 * Mint one team match. A trio fields two and rotates, exactly as the
 * knockout's trio does, because it is the same side machinery. A member
 * who has left is never fielded: a trio with one away fields its two.
 */
export function mintTeamMatch(
  courtNumber: number,
  a: KnockoutPair,
  b: KnockoutPair,
  matchIndex: number,
  now: number,
  matches: readonly Match[],
  away: ReadonlySet<string> = NOBODY,
): Match {
  const appearances = (p: KnockoutPair) =>
    counting(matches).filter((m) =>
      [m.teamA, m.teamB].some((side) => side.every((id) => p.playerIds.includes(id)))).length;
  const side = (p: KnockoutPair): SeededPair =>
    ({ seeds: [p.seed], playerIds: presentMembers(p, away) });
  return {
    id: `tm-${courtNumber}-${now.toString(36)}`,
    courtNumber,
    matchIndex,
    teamA: fieldedPlayers(side(a), appearances(a)),
    teamB: fieldedPlayers(side(b), appearances(b)),
    scoreA: null,
    scoreB: null,
    status: "onCourt",
    startedAt: now,
    completedAt: null,
    stage: null,
  };
}
