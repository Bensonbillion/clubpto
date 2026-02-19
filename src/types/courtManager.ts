export interface Player {
  id: string;
  name: string;
  skillLevel: "beginner" | "good";
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
  skillLevel: "beginner" | "good";
  wins: number;
  losses: number;
}

export interface Match {
  id: string;
  pair1: Pair;
  pair2: Pair;
  skillLevel: "beginner" | "good";
  status: "pending" | "playing" | "completed";
  court: number | null;
  winner?: Pair;
  loser?: Pair;
  completedAt?: string;
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

export interface SessionConfig {
  startTime: string;
  durationMinutes: number;
}

export interface GameState {
  sessionConfig: SessionConfig;
  roster: Player[];
  pairs: Pair[];
  matches: Match[];
  gameHistory: GameHistory[];
  sessionStarted: boolean;
}

export const DEFAULT_STATE: GameState = {
  sessionConfig: {
    startTime: "20:00",
    durationMinutes: 120,
  },
  roster: [],
  pairs: [],
  matches: [],
  gameHistory: [],
  sessionStarted: false,
};
