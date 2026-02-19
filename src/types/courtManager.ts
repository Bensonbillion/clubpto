export interface Player {
  id: string;
  name: string;
  skillLevel: "beginner" | "good";
  checkedIn: boolean;
  checkInTime: string | null;
  wins: number;
  losses: number;
  gamesPlayed: number;
  consecutiveSitOuts: number;
}

export interface Pair {
  id: string;
  player1: Player;
  player2: Player;
  skillLevel: "beginner" | "good";
  wins: number;
  losses: number;
}

export interface Match {
  id: string;
  pair1: Pair;
  pair2: Pair;
  /** Which skill pool this match belongs to */
  skillLevel: "beginner" | "good";
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
}

export interface GameState {
  sessionConfig: SessionConfig;
  roster: Player[];
  pairs: Pair[];
  matches: Match[];
  gameHistory: GameHistory[];
  sessionStarted: boolean;
  totalScheduledGames: number;
}

export const DEFAULT_STATE: GameState = {
  sessionConfig: {
    startTime: "20:00",
    durationMinutes: 85,
    checkInLocked: false,
  },
  roster: [],
  pairs: [],
  matches: [],
  gameHistory: [],
  sessionStarted: false,
  totalScheduledGames: 0,
};
