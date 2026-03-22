export type SkillTier = "A" | "B" | "C";

export interface Player {
  id: string;
  name: string;
  skillLevel: SkillTier;
  checkedIn: boolean;
  checkInTime: string | null;
  wins: number;
  losses: number;
  gamesPlayed: number;
  /** Supabase players table ID — links roster player to their DB profile */
  profileId?: string;
}

export interface Pair {
  id: string;
  player1: Player;
  player2: Player;
  skillLevel: SkillTier;
  wins: number;
  losses: number;
}

export interface Match {
  id: string;
  pair1: Pair;
  pair2: Pair;
  /** Which skill pool this match belongs to, or "cross" for B vs A/C */
  skillLevel: SkillTier | "cross";
  /** Describes the matchup type, e.g. "A vs A", "B vs A", "B vs C" */
  matchupLabel?: string;
  status: "pending" | "playing" | "completed";
  court: number | null;
  winner?: Pair;
  loser?: Pair;
  completedAt?: string;
  startedAt?: string;
  /** 1-indexed game number in the full schedule */
  gameNumber?: number;
  /** Court pool routing for 3-court mode: Court 1 = C, Court 2 = B, Court 3 = A */
  courtPool?: "A" | "B" | "C";
}

export interface GameHistory {
  id: string;
  timestamp: string;
  court: number;
  winnerPairId: string;
  loserPairId: string;
  winnerNames: string;
  loserNames: string;
}

export interface PlayoffMatch {
  id: string;
  round: number;
  seed1: number;
  seed2: number;
  pair1: Pair | null;
  pair2: Pair | null;
  winner?: Pair;
  status: "pending" | "playing" | "completed";
  court?: number;
}

export interface SessionConfig {
  startTime: string;
  durationMinutes: number;
  checkInLocked: boolean;
  checkInClosed?: boolean;
  sessionStartedAt?: string;
  courtCount?: 2 | 3;
  dynamicMode?: boolean;
}

export interface FixedPair {
  player1Name: string;
  player2Name: string;
}

export interface OddPlayerDecision {
  playerId: string;
  playerName: string;
  tier: SkillTier;
  decision: "sit_out" | "cross_pair" | "waiting";
  crossPairTier?: SkillTier;
}

export type CourtFormat = "round_robin" | "winner_stays_on";

export interface WsoGame {
  id: string;
  pair1: Pair;
  pair2: Pair;
  winner?: Pair;
  loser?: Pair;
  startedAt?: string;
  completedAt?: string;
  gameNumber: number;
}

export interface WsoStats {
  pairId: string;
  wins: number;
  losses: number;
  streak: number;
  longestStreak: number;
  gamesPlayed: number;
}

export interface WsoUndoEntry {
  previousGame: WsoGame;
  previousQueue: Pair[];
  previousStats: Record<string, WsoStats>;
}

export interface WsoState {
  queue: Pair[];
  currentGame: WsoGame | null;
  history: WsoGame[];
  stats: Record<string, WsoStats>;
  undoStack: WsoUndoEntry[];
  gameCounter: number;
}

export interface SubPlayerStats {
  playerId: string;
  gamesPlayed: number;
  timesSubbedOut: number;
}

export interface SubRotation {
  /** Current sub player ID */
  currentSubId: string;
  /** Per-player tracking for this court */
  playerStats: Record<string, SubPlayerStats>;
  /** Games completed since last rotation */
  gamesSinceLastRotation: number;
  /** Rotation frequency (every N completed games) */
  rotationFrequency: number;
  /** Whether a rotation prompt is currently pending */
  pendingRotation: boolean;
  /** Suggested player to replace (auto-calculated) */
  suggestedReplacementId?: string;
  /** Suggested pair to modify */
  suggestedPairId?: string;
  /** History of rotations */
  rotationHistory: { timestamp: string; subIn: string; subOut: string; pairId: string }[];
}

/** Per-court state for 3-court mode — each court is fully independent */
export interface CourtState {
  courtNumber: 1 | 2 | 3;
  tier: SkillTier;
  assignedPairs: Pair[];
  schedule: Match[];
  completedGames: Match[];
  standings: Record<string, { wins: number; losses: number; gamesPlayed: number; winPct: number }>;
  currentSlot: number;
  status: "waiting" | "active" | "playoffs" | "complete";
  format: CourtFormat;
  wso?: WsoState;
  /** ISO timestamp when this court was started (may differ from session start) */
  startedAt?: string;
  /** Player IDs waiting for a partner on this court */
  courtWaitlist?: string[];
  /** Sub rotation state — active when court has odd number of players */
  sub?: SubRotation;
}

export interface GameState {
  sessionConfig: SessionConfig;
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
  oddPlayerDecisions?: OddPlayerDecision[];
  pairsLocked?: boolean;
  /** Pair IDs that were just added via late arrival — for UI highlight */
  newlyAddedPairIds?: string[];
  pairGamesWatched?: Record<string, number>;
  /** Practice mode: syncs across devices, skips leaderboard points */
  practiceMode?: boolean;
  /** Bumped on each full schedule generation — mergeStates uses this to avoid union-merging stale pairs/matches */
  scheduleGeneration?: number;
  /** Per-court state for 3-court mode — each court runs independently */
  courts?: CourtState[];
}

export const DEFAULT_STATE: GameState = {
  sessionConfig: {
    startTime: "20:00",
    durationMinutes: 85,
    checkInLocked: false,
    checkInClosed: false,
    courtCount: 2,
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
  oddPlayerDecisions: [],
  pairsLocked: false,
  newlyAddedPairIds: [],
  pairGamesWatched: {},
  courts: [],
};
