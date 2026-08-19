// Seeding and running a court's playoff.
//
// The bracket is a VERTICAL STAGE LIST, and that is a data decision as much as
// a layout one: a stage is an ordered list of ties, and a tie is two pairs. No
// tree, no left/right children, no positional arithmetic. Frame 20 renders
// exactly this shape, which is why it can render a semi and a final with the
// same row component.
//
// Seeding reads straight off the standings, and standings are now total:
// points, then score difference, then who reached the total first. There is no
// tie left over to resolve, so nothing here can ever be "blocked by a tie" —
// the only thing that blocks a playoff is not having played enough yet.

import type { Match, Player } from "../types";
import { computeStandings, type PlayedMatch } from "./standings";
import { matchesPlayedBy } from "./rotation";

/** Pairs are seeded 1+4 and 2+3, so the top two seeds cannot meet before the final. */
export const PAIR_SEEDS: ReadonlyArray<readonly [number, number]> = [
  [1, 4],
  [2, 3],
];

export interface SeededPair {
  seeds: [number, number];
  playerIds: [string, string];
}

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

/** A playoff needs four seeded players, so a court needs at least four. */
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

/**
 * Seed the top four into two pairs. Returns null when the court cannot field
 * them — the caller shows the readiness frame rather than a half bracket.
 */
export function seedPairs(orderedIds: readonly string[]): SeededPair[] | null {
  if (orderedIds.length < MIN_FOR_PLAYOFF) return null;
  return PAIR_SEEDS.map(([x, y]) => ({
    seeds: [x, y] as [number, number],
    playerIds: [orderedIds[x - 1], orderedIds[y - 1]] as [string, string],
  }));
}

export interface Tie {
  /** Stable within a stage, so a row keeps its identity across renders. */
  id: string;
  sideA: [string, string] | null;
  sideB: [string, string] | null;
  scoreA: number | null;
  scoreB: number | null;
  settled: boolean;
}

export interface Stage {
  key: "semi" | "final";
  label: string;
  ties: Tie[];
}

const winnerOf = (t: Tie): [string, string] | null => {
  if (!t.settled || t.scoreA == null || t.scoreB == null) return null;
  return t.scoreA > t.scoreB ? t.sideA : t.sideB;
};

/**
 * The bracket as the frames draw it: an ordered list of stages, each a list of
 * full-width ties. The final's sides stay null until both semis are settled,
 * which is exactly what the "waiting" row in frame 20 renders.
 */
export function buildStages(
  pairs: readonly SeededPair[],
  playoffMatches: readonly Match[],
): Stage[] {
  const find = (stage: "semi" | "final", i: number) =>
    playoffMatches.filter((m) => m.stage === stage).sort((a, b) => a.matchIndex - b.matchIndex)[i];

  const semiTies: Tie[] = pairs.length === 2
    ? [{
        id: "semi-1",
        sideA: pairs[0].playerIds,
        sideB: pairs[1].playerIds,
        scoreA: find("semi", 0)?.scoreA ?? null,
        scoreB: find("semi", 0)?.scoreB ?? null,
        settled: find("semi", 0)?.status === "played",
      }]
    : [];

  // With one semi the "final" IS that tie, so a four-player court plays a
  // single match. Larger fields add semis; the shape does not change.
  const semiWinner = semiTies[0] ? winnerOf(semiTies[0]) : null;
  const finalMatch = find("final", 0);
  const finalTie: Tie = {
    id: "final-1",
    sideA: semiWinner,
    sideB: null,
    scoreA: finalMatch?.scoreA ?? null,
    scoreB: finalMatch?.scoreB ?? null,
    settled: finalMatch?.status === "played",
  };

  return [
    { key: "semi", label: "Semi-final", ties: semiTies },
    { key: "final", label: "Final", ties: [finalTie] },
  ];
}

/** The crowned pair, or null while the final is unplayed. */
export function champion(stages: readonly Stage[]): [string, string] | null {
  const final = stages.find((s) => s.key === "final")?.ties[0];
  return final ? winnerOf(final) : null;
}
