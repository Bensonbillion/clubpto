// ============================================================
// Set 01 / Courtside Social tournament types
// ============================================================

export interface Set01Player {
  id: string; // matches players.id from the players table
  display: string;
}

export interface Set01Team {
  id: string; // local team id, e.g. "men-1" or "women-A"
  player1: Set01Player | null;
  player2: Set01Player | null;
  name?: string; // optional team name override
}

// ── Men's tournament ───────────────────────────────────────

export interface MensTeamSlot extends Set01Team {
  initialSeed: number; // 1..16
}

export interface FinalSeed {
  seed: number; // 1..16 (final bracket position)
  originalSeed: number; // points back to MensTeamSlot.initialSeed
}

export interface Stage1Match {
  match: number; // 1..8
  seedA: number; // initial seed of team A
  seedB: number; // initial seed of team B
  scoreA: number | null;
  scoreB: number | null;
}

export type KnockoutRound = "R16" | "QF" | "SF" | "F";

export interface KnockoutMatch {
  id: string; // e.g. "R16-1", "QF1", "SF1", "F"
  round: KnockoutRound;
  // Either explicit seeds (R16) OR pulled from prior winners (QF/SF/F)
  seedA?: number;
  seedB?: number;
  sourceA?: string; // id of match whose winner is teamA
  sourceB?: string;
  scoreA: number | null;
  scoreB: number | null;
  pointsAwarded: boolean;
}

// ── Women's tournament ─────────────────────────────────────

export interface WomensTeamSlot extends Set01Team {
  label: string; // "A".."E"
}

export interface WomensGroupMatch {
  id: string; // "G1".."G5"
  teamA: string; // label "A".."E"
  teamB: string;
  scoreA: number | null;
  scoreB: number | null;
}

export interface WomensKnockoutMatch {
  id: string; // "WSF1", "WSF2", "WF"
  // SF takes labels assigned by user from standings
  teamA: string | null;
  teamB: string | null;
  sourceA?: string;
  sourceB?: string;
  scoreA: number | null;
  scoreB: number | null;
  pointsAwarded: boolean;
}

export interface WomensStanding {
  label: string;
  name: string;
  w: number;
  l: number;
  pf: number;
  pa: number;
  diff: number;
}

// ── Top-level state ────────────────────────────────────────

export interface Set01State {
  mensTeams: MensTeamSlot[]; // length 16
  womensTeams: WomensTeamSlot[]; // length 5
  stage1: Stage1Match[]; // length 8
  finalSeeds: FinalSeed[]; // length 16
  r16: KnockoutMatch[]; // length 8
  qf: KnockoutMatch[]; // length 4
  sf: KnockoutMatch[]; // length 2
  f: KnockoutMatch; // single match
  womensGroup: WomensGroupMatch[]; // length 5
  womensSF: WomensKnockoutMatch[]; // length 2
  womensF: WomensKnockoutMatch;
  // metadata
  startedAt?: string;
  schemaVersion: 1;
}

export const STAGE1_PAIRINGS: Array<[number, number]> = [
  [1, 12],
  [2, 11],
  [3, 10],
  [4, 9],
  [5, 16],
  [6, 15],
  [7, 14],
  [8, 13],
];

export const R16_PAIRINGS: Array<[number, number, string]> = [
  [1, 16, "QF1"],
  [8, 9, "QF1"],
  [4, 13, "QF2"],
  [5, 12, "QF2"],
  [2, 15, "QF3"],
  [7, 10, "QF3"],
  [3, 14, "QF4"],
  [6, 11, "QF4"],
];

export function defaultSet01State(): Set01State {
  return {
    mensTeams: Array.from({ length: 16 }, (_, i) => ({
      id: `men-${i + 1}`,
      initialSeed: i + 1,
      player1: null,
      player2: null,
    })),
    womensTeams: ["A", "B", "C", "D", "E"].map((l) => ({
      id: `women-${l}`,
      label: l,
      player1: null,
      player2: null,
    })),
    stage1: STAGE1_PAIRINGS.map(([a, b], i) => ({
      match: i + 1,
      seedA: a,
      seedB: b,
      scoreA: null,
      scoreB: null,
    })),
    finalSeeds: Array.from({ length: 16 }, (_, i) => ({
      seed: i + 1,
      originalSeed: i + 1,
    })),
    r16: R16_PAIRINGS.map(([a, b, qf], i) => ({
      id: `R16-${i + 1}`,
      round: "R16" as const,
      seedA: a,
      seedB: b,
      scoreA: null,
      scoreB: null,
      pointsAwarded: false,
    })),
    qf: [
      { id: "QF1", round: "QF", sourceA: "R16-1", sourceB: "R16-2", scoreA: null, scoreB: null, pointsAwarded: false },
      { id: "QF2", round: "QF", sourceA: "R16-3", sourceB: "R16-4", scoreA: null, scoreB: null, pointsAwarded: false },
      { id: "QF3", round: "QF", sourceA: "R16-5", sourceB: "R16-6", scoreA: null, scoreB: null, pointsAwarded: false },
      { id: "QF4", round: "QF", sourceA: "R16-7", sourceB: "R16-8", scoreA: null, scoreB: null, pointsAwarded: false },
    ],
    sf: [
      { id: "SF1", round: "SF", sourceA: "QF1", sourceB: "QF2", scoreA: null, scoreB: null, pointsAwarded: false },
      { id: "SF2", round: "SF", sourceA: "QF3", sourceB: "QF4", scoreA: null, scoreB: null, pointsAwarded: false },
    ],
    f: { id: "F", round: "F", sourceA: "SF1", sourceB: "SF2", scoreA: null, scoreB: null, pointsAwarded: false },
    womensGroup: [
      { id: "G1", teamA: "A", teamB: "B", scoreA: null, scoreB: null },
      { id: "G2", teamA: "B", teamB: "C", scoreA: null, scoreB: null },
      { id: "G3", teamA: "C", teamB: "D", scoreA: null, scoreB: null },
      { id: "G4", teamA: "D", teamB: "E", scoreA: null, scoreB: null },
      { id: "G5", teamA: "A", teamB: "E", scoreA: null, scoreB: null },
    ],
    womensSF: [
      { id: "WSF1", teamA: null, teamB: null, scoreA: null, scoreB: null, pointsAwarded: false },
      { id: "WSF2", teamA: null, teamB: null, scoreA: null, scoreB: null, pointsAwarded: false },
    ],
    womensF: {
      id: "WF",
      teamA: null,
      teamB: null,
      sourceA: "WSF1",
      sourceB: "WSF2",
      scoreA: null,
      scoreB: null,
      pointsAwarded: false,
    },
    schemaVersion: 1,
  };
}
