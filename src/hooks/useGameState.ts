import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GameState, DEFAULT_STATE, Player, Pair, Match, GameHistory } from "@/types/courtManager";

const ROW_ID = "current";

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
  const [state, setState] = useState<GameState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const savingRef = useRef(false);
  const pendingRef = useRef<GameState | null>(null);

  // Load initial state from DB
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("game_state")
        .select("state")
        .eq("id", ROW_ID)
        .single();
      if (data?.state) {
        setState(data.state as unknown as GameState);
      }
      setLoading(false);
    };
    load();
  }, []);

  // Subscribe to realtime changes
  useEffect(() => {
    const channel = supabase
      .channel("game_state_sync")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_state", filter: `id=eq.${ROW_ID}` },
        (payload) => {
          if (payload.new && (payload.new as any).state) {
            setState((payload.new as any).state as GameState);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Persist state to DB (debounced, non-blocking)
  const persistState = useCallback(async (newState: GameState) => {
    if (savingRef.current) {
      pendingRef.current = newState;
      return;
    }
    savingRef.current = true;
    await supabase
      .from("game_state")
      .update({ state: JSON.parse(JSON.stringify(newState)), updated_at: new Date().toISOString() })
      .eq("id", ROW_ID);
    savingRef.current = false;

    // If there was a queued update, flush it
    if (pendingRef.current) {
      const queued = pendingRef.current;
      pendingRef.current = null;
      persistState(queued);
    }
  }, []);

  const updateState = useCallback(
    (updater: (prev: GameState) => GameState) => {
      setState((prev) => {
        const next = updater(prev);
        persistState(next);
        return next;
      });
    },
    [persistState]
  );

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

  // Generate pairs from checked-in players, avoiding recent repeat pairings
  const generatePairs = useCallback(async () => {
    // Fetch pair history from last 2 weeks
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const { data: history } = await supabase
      .from("pair_history")
      .select("player1_name, player2_name")
      .gte("session_date", twoWeeksAgo.toISOString().split("T")[0]);

    // Build a set of recent pair keys for fast lookup
    const recentPairs = new Set<string>();
    (history || []).forEach((h: { player1_name: string; player2_name: string }) => {
      const key = [h.player1_name, h.player2_name].sort().join("|||");
      recentPairs.add(key);
    });

    const pairKey = (a: string, b: string) => [a, b].sort().join("|||");
    const wasRecentlyPaired = (a: string, b: string) => recentPairs.has(pairKey(a, b));

    // Smart pairing: try to avoid recent pairs, fall back to random if impossible
    const smartPair = (players: Player[]): Pair[] => {
      const shuffled = shuffle(players);
      const used = new Set<string>();
      const pairs: Pair[] = [];

      // First pass: pair players who haven't been together recently
      for (let i = 0; i < shuffled.length; i++) {
        if (used.has(shuffled[i].id)) continue;
        for (let j = i + 1; j < shuffled.length; j++) {
          if (used.has(shuffled[j].id)) continue;
          if (!wasRecentlyPaired(shuffled[i].name, shuffled[j].name)) {
            pairs.push({
              id: generateId(),
              player1: shuffled[i],
              player2: shuffled[j],
              skillLevel: shuffled[i].skillLevel,
              wins: 0,
              losses: 0,
            });
            used.add(shuffled[i].id);
            used.add(shuffled[j].id);
            break;
          }
        }
      }

      // Second pass: pair any remaining players (fallback — everyone was recently paired)
      const remaining = shuffled.filter((p) => !used.has(p.id));
      for (let i = 0; i + 1 < remaining.length; i += 2) {
        pairs.push({
          id: generateId(),
          player1: remaining[i],
          player2: remaining[i + 1],
          skillLevel: remaining[i].skillLevel,
          wins: 0,
          losses: 0,
        });
      }

      return pairs;
    };

    updateState((s) => {
      const checkedIn = s.roster.filter((p) => p.checkedIn);
      const beginners = checkedIn.filter((p) => p.skillLevel === "beginner");
      const good = checkedIn.filter((p) => p.skillLevel === "good");

      const newPairs = [...smartPair(beginners), ...smartPair(good)];

      // Save new pairs to history (fire and forget)
      const historyRows = newPairs.map((p) => ({
        player1_name: p.player1.name,
        player2_name: p.player2.name,
      }));
      if (historyRows.length > 0) {
        supabase.from("pair_history").insert(historyRows).then(() => {});
      }

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
    const fresh = { ...DEFAULT_STATE };
    setState(fresh);
    persistState(fresh);
  }, [persistState]);

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
    loading,
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
