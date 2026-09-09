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
// Standings are the individual engine's standings with a pair standing in
// for a player, which is not a trick but the point: points, then score
// difference, then who reached the total first, and the row explains
// itself the same way. The table then ends one of two ways (frame 37):
// crowned as it stands, or seeded into the knockout, first against last.

import type { KnockoutPair, Match } from "../types";
import { fieldedPlayers, type SeededPair } from "./playoff";
import { computeStandings, type PlayedMatch, type StandingsRow } from "./standings";

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
 * The next tie to put on a free court, or null when nothing can go on.
 *
 * Least-played-first over pairs picks who plays; a pair already on a court
 * is not picked twice; a pair at its target is done. The opponent is the
 * least-played pair this one has met FEWEST times, so the whole field
 * plays each other before anybody plays anybody twice.
 */
export function nextTeamTie(
  pairs: readonly KnockoutPair[],
  matches: readonly Match[],
  target: number,
): { a: KnockoutPair; b: KnockoutPair } | null {
  const counts = pairCounts(pairs, matches);
  const free = pairs.filter((p) => {
    const c = counts.get(pairKey(p))!;
    return c.onCourt === 0 && c.played + c.onCourt < target;
  });
  if (free.length < 2) return null;
  const played = (p: KnockoutPair) => counts.get(pairKey(p))!.played;
  const [a] = [...free].sort((x, y) => played(x) - played(y) || x.seed - y.seed);
  const others = free
    .filter((p) => pairKey(p) !== pairKey(a))
    .sort((x, y) =>
      timesMet(pairs, matches, a, x) - timesMet(pairs, matches, a, y)
      || played(x) - played(y)
      || x.seed - y.seed);
  return others[0] ? { a, b: others[0] } : null;
}

/** Every pair has had its games. The table can end. */
export const teamsComplete = (
  pairs: readonly KnockoutPair[],
  matches: readonly Match[],
  target: number,
): boolean =>
  pairs.length > 0 && pairs.every((p) => pairCounts(pairs, matches).get(pairKey(p))!.played >= target);

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

/**
 * Mint one team match. A trio fields two and rotates, exactly as the
 * knockout's trio does, because it is the same side machinery.
 */
export function mintTeamMatch(
  courtNumber: number,
  a: KnockoutPair,
  b: KnockoutPair,
  matchIndex: number,
  now: number,
  matches: readonly Match[],
): Match {
  const appearances = (p: KnockoutPair) =>
    counting(matches).filter((m) =>
      [m.teamA, m.teamB].some((side) => side.every((id) => p.playerIds.includes(id)))).length;
  const side = (p: KnockoutPair): SeededPair => ({ seeds: [p.seed], playerIds: [...p.playerIds] });
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
