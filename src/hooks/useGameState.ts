import { useState, useCallback, useEffect } from "react";
import { GameState, DEFAULT_STATE, Player, Pair, Match, GameHistory } from "@/types/courtManager";

const STORAGE_KEY = "clubpto-game-state";

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function useGameState() {
  const [state, setState] = useState<GameState>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_STATE;
    } catch {
      return DEFAULT_STATE;
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const updateState = useCallback((updater: (prev: GameState) => GameState) => {
    setState((prev) => updater(prev));
  }, []);

  // Session config
  const setSessionConfig = useCallback(
    (config: Partial<GameState["sessionConfig"]>) => {
      updateState((s) => ({ ...s, sessionConfig: { ...s.sessionConfig, ...config } }));
    },
    [updateState]
  );

  // Roster
  const addPlayer = useCallback(
    (name: string, skillLevel: "beginner" | "good") => {
      const player: Player = {
        id: generateId(),
        name,
        skillLevel,
        checkedIn: false,
        checkInTime: null,
        wins: 0,
        losses: 0,
        gamesPlayed: 0,
      };
      updateState((s) => ({ ...s, roster: [...s.roster, player] }));
    },
    [updateState]
  );

  const removePlayer = useCallback(
    (id: string) => {
      updateState((s) => ({ ...s, roster: s.roster.filter((p) => p.id !== id) }));
    },
    [updateState]
  );

  const toggleSkillLevel = useCallback(
    (id: string) => {
      updateState((s) => ({
        ...s,
        roster: s.roster.map((p) =>
          p.id === id ? { ...p, skillLevel: p.skillLevel === "beginner" ? "good" : "beginner" } : p
        ),
      }));
    },
    [updateState]
  );

  // Check-in
  const toggleCheckIn = useCallback(
    (id: string) => {
      updateState((s) => ({
        ...s,
        roster: s.roster.map((p) =>
          p.id === id
            ? { ...p, checkedIn: !p.checkedIn, checkInTime: !p.checkedIn ? new Date().toISOString() : null }
            : p
        ),
      }));
    },
    [updateState]
  );

  // Generate pairs from checked-in players
  const generatePairs = useCallback(() => {
    updateState((s) => {
      const checkedIn = s.roster.filter((p) => p.checkedIn);
      const beginners = shuffle(checkedIn.filter((p) => p.skillLevel === "beginner"));
      const good = shuffle(checkedIn.filter((p) => p.skillLevel === "good"));

      const newPairs: Pair[] = [];

      const makePairs = (players: Player[]) => {
        for (let i = 0; i + 1 < players.length; i += 2) {
          newPairs.push({
            id: generateId(),
            player1: players[i],
            player2: players[i + 1],
            skillLevel: players[i].skillLevel,
            wins: 0,
            losses: 0,
          });
        }
      };

      makePairs(beginners);
      makePairs(good);

      return { ...s, pairs: newPairs };
    });
  }, [updateState]);

  // Generate matches from pairs
  const generateMatches = useCallback(() => {
    updateState((s) => {
      const beginnerPairs = shuffle(s.pairs.filter((p) => p.skillLevel === "beginner"));
      const goodPairs = shuffle(s.pairs.filter((p) => p.skillLevel === "good"));

      const newMatches: Match[] = [];

      const makeMatches = (pairs: Pair[]) => {
        for (let i = 0; i + 1 < pairs.length; i += 2) {
          newMatches.push({
            id: generateId(),
            pair1: pairs[i],
            pair2: pairs[i + 1],
            skillLevel: pairs[i].skillLevel,
            status: "pending",
            court: null,
          });
        }
      };

      makeMatches(beginnerPairs);
      makeMatches(goodPairs);

      // Auto-assign first 2 matches to courts
      if (newMatches.length >= 1) {
        newMatches[0].status = "playing";
        newMatches[0].court = 1;
      }
      if (newMatches.length >= 2) {
        newMatches[1].status = "playing";
        newMatches[1].court = 2;
      }

      return { ...s, matches: [...s.matches.filter((m) => m.status === "completed"), ...newMatches] };
    });
  }, [updateState]);

  // Complete match
  const completeMatch = useCallback(
    (matchId: string, winnerPairId: string) => {
      updateState((s) => {
        const matchIdx = s.matches.findIndex((m) => m.id === matchId);
        if (matchIdx === -1) return s;
        const match = s.matches[matchIdx];
        const winnerPair = match.pair1.id === winnerPairId ? match.pair1 : match.pair2;
        const loserPair = match.pair1.id === winnerPairId ? match.pair2 : match.pair1;
        const freedCourt = match.court;

        // Update pairs
        const updatedPairs = s.pairs.map((p) => {
          if (p.id === winnerPair.id) return { ...p, wins: p.wins + 1 };
          if (p.id === loserPair.id) return { ...p, losses: p.losses + 1 };
          return p;
        });

        // Update players
        const winnerIds = [winnerPair.player1.id, winnerPair.player2.id];
        const loserIds = [loserPair.player1.id, loserPair.player2.id];
        const updatedRoster = s.roster.map((p) => {
          if (winnerIds.includes(p.id)) return { ...p, wins: p.wins + 1, gamesPlayed: p.gamesPlayed + 1 };
          if (loserIds.includes(p.id)) return { ...p, losses: p.losses + 1, gamesPlayed: p.gamesPlayed + 1 };
          return p;
        });

        // Update match
        const updatedMatches = [...s.matches];
        updatedMatches[matchIdx] = { ...match, status: "completed", winner: winnerPair, loser: loserPair, completedAt: new Date().toISOString() };

        // Assign next pending match to freed court
        if (freedCourt) {
          const nextPending = updatedMatches.find((m) => m.status === "pending");
          if (nextPending) {
            nextPending.status = "playing";
            nextPending.court = freedCourt;
          }
        }

        const historyEntry: GameHistory = {
          id: generateId(),
          timestamp: new Date().toISOString(),
          court: freedCourt || 0,
          winnerPairId: winnerPair.id,
          loserPairId: loserPair.id,
          winnerNames: `${winnerPair.player1.name} & ${winnerPair.player2.name}`,
          loserNames: `${loserPair.player1.name} & ${loserPair.player2.name}`,
        };

        return {
          ...s,
          pairs: updatedPairs,
          roster: updatedRoster,
          matches: updatedMatches,
          gameHistory: [...s.gameHistory, historyEntry],
        };
      });
    },
    [updateState]
  );

  const startSession = useCallback(() => {
    updateState((s) => ({ ...s, sessionStarted: true }));
  }, [updateState]);

  const resetSession = useCallback(() => {
    setState(DEFAULT_STATE);
  }, []);

  // Derived
  const checkedInPlayers = state.roster.filter((p) => p.checkedIn);
  const playingMatches = state.matches.filter((m) => m.status === "playing");
  const pendingMatches = state.matches.filter((m) => m.status === "pending");
  const completedMatches = state.matches.filter((m) => m.status === "completed");
  const court1Match = playingMatches.find((m) => m.court === 1) || null;
  const court2Match = playingMatches.find((m) => m.court === 2) || null;

  // Waiting players - checked in but not in any pair
  const pairedPlayerIds = state.pairs.flatMap((p) => [p.player1.id, p.player2.id]);
  const waitingPlayers = checkedInPlayers.filter((p) => !pairedPlayerIds.includes(p.id));

  return {
    state,
    setSessionConfig,
    addPlayer,
    removePlayer,
    toggleSkillLevel,
    toggleCheckIn,
    generatePairs,
    generateMatches,
    completeMatch,
    startSession,
    resetSession,
    checkedInPlayers,
    playingMatches,
    pendingMatches,
    completedMatches,
    court1Match,
    court2Match,
    waitingPlayers,
  };
}
