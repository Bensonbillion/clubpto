// Who plays next.
//
// The frames state the rule in one line: "Whoever is owed a game is at the
// top." Everything here is that sentence made precise.
//
// A player is OWED the difference between the court's target and the games
// they have actually had. That framing matters more than "least played":
// someone who arrives at match 9 is owed as much as everyone else, so the
// queue pulls them in immediately rather than making them wait out the
// backlog they were never part of. It is also what makes an extended target
// (frame 15) work without special-casing — raise the target and everyone is
// owed one more.
//
// Pure. No clock, no randomness, no IO: the same court in the same state
// always produces the same next four, which is what makes a mis-tap
// recoverable and the whole thing testable.

import type { Match, Player, QueueEntry } from "../types";

const isPlayable = (p: Player, court: number) =>
  p.courtNumber === court && !p.away;

/** Completed matches only — a match on court has not been "had" yet. */
const countsAsPlayed = (m: Match) => m.status === "played";

export function matchesPlayedBy(matches: readonly Match[], playerId: string): number {
  return matches.filter(
    (m) => countsAsPlayed(m) && [...m.teamA, ...m.teamB].includes(playerId),
  ).length;
}

/**
 * The court's queue, most-owed first. Ties break on the player's position in
 * the roster so the order never wobbles between renders — a queue that
 * reshuffles itself while someone reads it is worse than a wrong queue.
 */
export function buildQueue(
  players: readonly Player[],
  matches: readonly Match[],
  court: number,
  targetMatches: number,
): QueueEntry[] {
  return players
    .filter((p) => isPlayable(p, court))
    .map((p, i) => {
      const played = matchesPlayedBy(matches, p.id);
      return {
        playerId: p.id,
        name: p.name,
        matchesPlayed: played,
        owed: Math.max(0, targetMatches - played),
        _seat: i,
      };
    })
    .sort((a, b) => b.owed - a.owed || a.matchesPlayed - b.matchesPlayed || a._seat - b._seat)
    .map(({ _seat, ...entry }) => entry);
}

export interface NextMatch {
  teamA: [string, string];
  teamB: [string, string];
}

/**
 * The next four off the queue, split into pairs.
 *
 * Pairing is 1+4 / 2+3 rather than 1+2 / 3+4: taking the top four by need and
 * then splitting them evenly keeps one court from becoming "the good pair
 * versus the other two" every single round. It is the cheapest fairness that
 * does not require tracking partner history, and the frames never promise
 * more than that.
 *
 * Returns null when fewer than four are available — the caller shows the
 * bench/empty state rather than inventing a three-player game.
 */
export function nextMatch(
  players: readonly Player[],
  matches: readonly Match[],
  court: number,
  targetMatches: number,
): NextMatch | null {
  // Nobody owed a game means the round robin is over. Without this the court
  // happily drew a fifth round of a four-round night — the queue always has
  // four names in it, so "are there four people" is not the question. The
  // question is whether anyone is still owed.
  if (courtComplete(players, matches, court, targetMatches)) return null;
  const queue = buildQueue(players, matches, court, targetMatches);
  if (queue.length < 4) return null;
  const [a, b, c, d] = queue.slice(0, 4).map((q) => q.playerId);
  return { teamA: [a, d], teamB: [b, c] };
}

/** Is every playable player on this court at or past the target? */
export function courtComplete(
  players: readonly Player[],
  matches: readonly Match[],
  court: number,
  targetMatches: number,
): boolean {
  const playable = players.filter((p) => isPlayable(p, court));
  if (playable.length === 0) return false;
  return playable.every((p) => matchesPlayedBy(matches, p.id) >= targetMatches);
}

/**
 * Targets that divide the room evenly.
 *
 * Every game needs four players, so a court of N running a target of T plays
 * N*T/4 matches — and that has to be a whole number or somebody ends the
 * night one game short. The setup screen (frame 08) offers only these.
 */
export function validTargets(courtSize: number): number[] {
  const out: number[] = [];
  for (let t = 2; t <= 8; t++) if ((courtSize * t) % 4 === 0) out.push(t);
  return out;
}

/** Matches a court will play in total at this size and target. */
export function totalMatches(courtSize: number, targetMatches: number): number {
  return (courtSize * targetMatches) / 4;
}
