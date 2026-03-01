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
}

export interface SessionConfig {
  startTime: string;
  durationMinutes: number;
  checkInLocked: boolean;
  sessionStartedAt?: string;
  courtCount?: 2 | 3;
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
}

export const DEFAULT_STATE: GameState = {
  sessionConfig: {
    startTime: "20:00",
    durationMinutes: 85,
    checkInLocked: false,
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
};
