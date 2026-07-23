// Court Manager v2 — domain types.
// Pure data. No React, no Supabase, no side effects (Architectural Law #1).
// See COURT-MANAGER.md for the spec this implements.

export type Tier = "A" | "B" | "C";

export interface Player {
  id: string;
  /** Display label — the player's preferred (first) name. */
  name: string;
  tier: Tier;
  isVip: boolean;
  /** VIP's secret partner pick (same tier only). Pending until partner checks in. */
  vipPartnerId?: string;
  /** Coaches get a widened minimum rest (3 slots) on round-robin courts. */
  isCoach: boolean;
  checkedIn: boolean;
  checkInTime?: number; // epoch ms
  // Contact details (admin-only; never shown player-facing). Imported from CSV.
  lastName?: string;
  email?: string;
  phone?: string;
}

export interface Pair {
  id: string;
  playerIds: [string, string];
  tier: Tier;
  /** True when the pairing is a VIP hard lock — pairing regeneration must preserve it. */
  vipLocked?: boolean;
}

/** A never faces C. There is no "AC". */
export type MatchupType = "AA" | "AB" | "BB" | "BC" | "CC";

export function matchupType(a: Tier, b: Tier): MatchupType | null {
  const key = [a, b].sort().join("");
  if (key === "AC") return null;
  return key as MatchupType;
}

// ---------------------------------------------------------------------------
// Games & rounds (section 6)
// ---------------------------------------------------------------------------
// Results are a single WHO WON tap (§9) — the app never collects scores.
// Point formats (first to 7, win-by-2) are on-court practice, not software.

export interface RoundGame {
  id: string;
  /** 1-based round number. 0 = not round-structured (Sunday LPF courts). */
  round: number;
  /** 1-based court number. */
  court: number;
  /** 1-based slot within the round (Wednesday) or within the court (Sunday). */
  slot: number;
  pairIds: [string, string];
  type: MatchupType;
  /** Set when the round could not avoid a rematch (surfaced, never silent). */
  isRematch?: boolean;
  /**
   * Set when this slot-1 game unavoidably includes a pair from the previous
   * round's final slot (degenerate roster shapes only — surfaced, never silent).
   */
  boundaryClash?: boolean;
}

export interface GameResult {
  gameId: string;
  winnerPairId: string;
  loserPairId: string;
  startedAt: number; // epoch ms
  completedAt: number; // epoch ms
  /** Abandoned game AWARDED to the healthy team (§9) — a real result, labeled honestly. */
  awarded?: boolean;
}

export interface RoundScheduleResult {
  /** rounds[i] = ordered games of round i+1 (court/slot assigned). */
  rounds: RoundGame[][];
  /** round number -> pairIds sitting out that round (odd pair counts). */
  byes: Record<number, string[]>;
  /** Human-readable notes the setup screen must surface (byes, rematches, caps). */
  disclosures: string[];
}

// ---------------------------------------------------------------------------
// Session & courts (sections 3, 5, 7)
// ---------------------------------------------------------------------------

export type CourtFormat = "round_robin" | "winner_stays_on";
export type CourtStatus = "waiting" | "active" | "playoffs" | "done";

export interface CourtConfig {
  court: number;
  /** In isolated 3-court mode: 1=C, 2=B, 3=A. Undefined in 2-court/open mode. */
  tier?: Tier;
  format: CourtFormat;
}

export type SessionMode = "two_court" | "three_court" | "open_1" | "open_2";

export interface SessionConfig {
  mode: SessionMode;
  /** Venue label, e.g. "mississauga" | "north-york" — keys measured pace history. */
  venue: string;
  /** The venue-imposed end, epoch ms. Every projection runs against this. */
  hardStopAt: number;
  /** Assumed avg game duration (ms) until measured data replaces it (section 8). */
  assumedGameMs: number;
  /** Playoff time budget (ms) included in every projection (~20-25 min). */
  playoffBudgetMs: number;
  /** Wednesday target rounds (4) — minimum guarantee is targetRounds - 1. */
  targetRounds: number;
  /** How many leading rounds are pure same-tier (2 in the base plan). */
  sameTierRounds: number;
  courts: CourtConfig[];
  /** Optional WSO streak cap (open product decision — off unless set). */
  wsoStreakCap?: number;
}

// ---------------------------------------------------------------------------
// Least-played-first per-court state (section 7)
// ---------------------------------------------------------------------------

export interface LpfPairState {
  pairId: string;
  gamesPlayed: number;
  /** 999 = never played — max priority (late pairs). */
  slotsSinceLastGame: number;
}

// ---------------------------------------------------------------------------
// Winner Stays On (section 7)
// ---------------------------------------------------------------------------

export interface WsoStats {
  pairId: string;
  wins: number;
  losses: number;
  streak: number;
  longestStreak: number;
}

export interface WsoGame {
  id: string;
  pairIds: [string, string];
  startedAt: number;
}

/** WSO results are a winner tap — no numeric score (unlike RR games). */
export interface WsoResultEntry {
  gameId: string;
  winnerPairId: string;
  loserPairId: string;
  startedAt: number;
  completedAt: number;
}

export interface WsoState {
  currentGame: WsoGame | null;
  /** queue[0] is ON DECK. */
  queue: string[];
  stats: Record<string, WsoStats>;
  history: WsoResultEntry[];
  undoStack: WsoUndoEntry[];
  gameCounter: number;
  /** Optional streak cap (§7 open decision): after N straight, defender rotates. */
  streakCap?: number;
}

export interface WsoUndoEntry {
  currentGame: WsoGame | null;
  queue: string[];
  stats: Record<string, WsoStats>;
  historyLength: number;
}

// ---------------------------------------------------------------------------
// Standings & playoffs (section 10)
// ---------------------------------------------------------------------------

export interface StandingRow {
  /** Player id (Wednesday player bracket) or pair id (per-court brackets). */
  id: string;
  name: string;
  tier: Tier;
  wins: number;
  losses: number;
  winPct: number;
  /** Strength of schedule: combined Win% of opponents faced (§11). */
  sos: number;
  gamesPlayed: number;
  /** Which tiebreaker decided this row's position vs the next ("wins H2H"). */
  tiebreakApplied?: string;
}

export interface PlayoffTeam {
  seedLabel: string; // e.g. "1 & 8"
  /** Player ids (Wednesday unified bracket) or pair ids (per-court brackets). */
  ids: string[];
}

export interface PlayoffMatch {
  id: string;
  stage: "quarter" | "semi" | "final" | "final_challenge";
  court?: number;
  a: PlayoffTeam;
  b: PlayoffTeam;
  result?: GameResult;
}

// ---------------------------------------------------------------------------
// Pace engine (section 8)
// ---------------------------------------------------------------------------

export interface PaceState {
  /** Completed-game durations (ms), this session, in completion order. */
  samples: number[];
  assumedGameMs: number;
  /** Below this many samples the assumed value is used. */
  minSamples: number;
}

export interface PaceProjection {
  avgGameMs: number;
  usingMeasured: boolean;
  projectedFinishAt: number; // epoch ms
  hardStopAt: number;
  /** Positive = past the hard stop. */
  overrunMs: number;
  fits: boolean;
}
