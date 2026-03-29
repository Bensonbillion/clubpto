/**
 * Types for the Open Court Manager (/manage2).
 * Shares Player, Pair, Match types with the original Court Manager
 * but removes tier-based court assignment and matchup restrictions.
 */
export type { SkillTier, Player, Pair, Match, GameHistory, PlayoffMatch, FixedPair, CourtFormat, WsoGame, WsoStats, WsoUndoEntry, WsoState, SubPlayerStats, SubRotation } from "./courtManager";
import type { SkillTier, Player, Pair, Match, GameHistory, PlayoffMatch, FixedPair, CourtFormat, WsoState, SubRotation } from "./courtManager";

/** Open mode session config — 1 or 2 courts, optional session name */
export interface OpenSessionConfig {
  startTime: string;
  durationMinutes: number;
  checkInLocked: boolean;
  checkInClosed?: boolean;
  sessionStartedAt?: string;
  courtCount?: 1 | 2;
  dynamicMode?: boolean;
  /** Freeform session name — appears in header and summary */
  sessionName?: string;
}

/** Per-court state for open mode — NO tier assignment, just court number */
export interface OpenCourtState {
  courtNumber: 1 | 2;
  assignedPairs: Pair[];
  schedule: Match[];
  completedGames: Match[];
  standings: Record<string, { wins: number; losses: number; gamesPlayed: number; winPct: number }>;
  currentSlot: number;
  status: "waiting" | "active" | "playoffs" | "complete";
  format: CourtFormat;
  wso?: WsoState;
  /** ISO timestamp when this court was started */
  startedAt?: string;
  /** Player IDs waiting for a partner on this court */
  courtWaitlist?: string[];
  /** Sub rotation state — active when court has odd number of players */
  sub?: SubRotation;
}

export interface OpenGameState {
  sessionConfig: OpenSessionConfig;
  roster: Player[];
  pairs: Pair[];
  matches: Match[];
  gameHistory: GameHistory[];
  sessionStarted: boolean;
  playoffsStarted: boolean;
  totalScheduledGames: number;
  playoffMatches: PlayoffMatch[];
  fixedPairs?: FixedPair[];
  waitlistedPlayers?: string[];
  pairsLocked?: boolean;
  /** Pair IDs that were just added via late arrival — for UI highlight */
  newlyAddedPairIds?: string[];
  pairGamesWatched?: Record<string, number>;
  /** Practice mode: syncs across devices, skips leaderboard points */
  practiceMode?: boolean;
  /** Bumped on each full schedule generation */
  scheduleGeneration?: number;
  /** Per-court state — used in both 1-court and 2-court modes */
  courts?: OpenCourtState[];
}

export const OPEN_DEFAULT_STATE: OpenGameState = {
  sessionConfig: {
    startTime: "20:00",
    durationMinutes: 85,
    checkInLocked: false,
    checkInClosed: false,
    courtCount: 1,
    sessionName: "",
  },
  roster: [],
  pairs: [],
  matches: [],
  gameHistory: [],
  sessionStarted: false,
  playoffsStarted: false,
  totalScheduledGames: 0,
  playoffMatches: [],
  fixedPairs: [],
  waitlistedPlayers: [],
  pairsLocked: false,
  newlyAddedPairIds: [],
  pairGamesWatched: {},
  courts: [],
};
