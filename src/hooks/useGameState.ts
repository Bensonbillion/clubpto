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
        consecutiveSitOuts: 0,
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
      updateState((s) => {
        if (s.sessionConfig.checkInLocked) return s;
        return {
          ...s,
          roster: s.roster.map((p) =>
            p.id === id
              ? { ...p, checkedIn: !p.checkedIn, checkInTime: !p.checkedIn ? new Date().toISOString() : null }
              : p
          ),
        };
      });
    },
    [updateState]
  );

  const lockCheckIn = useCallback(
    (locked: boolean) => {
      updateState((s) => ({ ...s, sessionConfig: { ...s.sessionConfig, checkInLocked: locked } }));
    },
    [updateState]
  );

  /**
   * Generate a full round-robin schedule:
   * - 85 min session, ~7 min/game, 2 courts = ~24 game slots total
   * - Mix GOOD + BEGINNER per team for competitive balance
   * - Each player gets min 3 games, ideally 4-5
   * - No player sits out more than 2 consecutive slots
   * - Avoids recent repeat pairings from pair_history
   */
  const generateFullSchedule = useCallback(async () => {
    const checkedIn = state.roster.filter((p) => p.checkedIn);
    if (checkedIn.length < 4) return;

    // Fetch pair history from last 2 weeks
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const { data: history } = await supabase
      .from("pair_history")
      .select("player1_name, player2_name")
      .gte("session_date", twoWeeksAgo.toISOString().split("T")[0]);

    const recentPairs = new Set<string>();
    (history || []).forEach((h: { player1_name: string; player2_name: string }) => {
      recentPairs.add([h.player1_name, h.player2_name].sort().join("|||"));
    });
    const wasRecentlyPaired = (a: string, b: string) =>
      recentPairs.has([a, b].sort().join("|||"));

    // Calculate game slots
    const durationMin = state.sessionConfig.durationMinutes || 85;
    const minutesPerGame = 7;
    const gamesPerCourt = Math.floor(durationMin / minutesPerGame);
    const totalGameSlots = gamesPerCourt * 2; // 2 courts
    const numPlayers = checkedIn.length;
    const minGamesPerPlayer = 3;

    // Separate by skill for team-building
    const goodPlayers = shuffle(checkedIn.filter((p) => p.skillLevel === "good"));
    const beginnerPlayers = shuffle(checkedIn.filter((p) => p.skillLevel === "beginner"));

    // Build teams: pair 1 GOOD + 1 BEGINNER where possible
    const buildTeam = (
      players: Player[],
      gameCount: Map<string, number>,
      sitOutCount: Map<string, number>,
      usedThisSlot: Set<string>
    ): Pair | null => {
      // Sort by fewest games played, then most consecutive sit-outs
      const available = players
        .filter((p) => !usedThisSlot.has(p.id))
        .sort((a, b) => {
          const gamesA = gameCount.get(a.id) || 0;
          const gamesB = gameCount.get(b.id) || 0;
          if (gamesA !== gamesB) return gamesA - gamesB;
          const sitA = sitOutCount.get(a.id) || 0;
          const sitB = sitOutCount.get(b.id) || 0;
          return sitB - sitA; // prioritize those sitting out longer
        });

      if (available.length < 2) return null;

      const p1 = available[0];
      // Try to find a partner not recently paired
      let p2 = available.slice(1).find((p) => !wasRecentlyPaired(p1.name, p.name));
      if (!p2) p2 = available[1]; // fallback

      usedThisSlot.add(p1.id);
      usedThisSlot.add(p2.id);

      return {
        id: generateId(),
        player1: p1,
        player2: p2,
        skillLevel: p1.skillLevel, // not used for round-robin separation
        wins: 0,
        losses: 0,
      };
    };

    const allPlayers = shuffle(checkedIn);
    const gameCount = new Map<string, number>();
    const sitOutCount = new Map<string, number>();
    allPlayers.forEach((p) => {
      gameCount.set(p.id, 0);
      sitOutCount.set(p.id, 0);
    });

    const allMatches: Match[] = [];
    const allPairs: Pair[] = [];
    let gameNumber = 0;

    // Generate games in pairs of 2 (one per court per time slot)
    for (let slot = 0; slot < gamesPerCourt; slot++) {
      const usedThisSlot = new Set<string>();

      // Build 2 matches (one per court) for this time slot
      for (let court = 1; court <= 2; court++) {
        // Build 2 teams for this match, mixing skill levels
        const availableGood = goodPlayers.filter((p) => !usedThisSlot.has(p.id));
        const availableBeg = beginnerPlayers.filter((p) => !usedThisSlot.has(p.id));
        const availableAll = allPlayers.filter((p) => !usedThisSlot.has(p.id));

        let team1: Pair | null = null;
        let team2: Pair | null = null;

        // Try to build mixed teams (1 good + 1 beginner each)
        if (availableGood.length >= 2 && availableBeg.length >= 2) {
          // Sort each pool by game count
          const sortedGood = [...availableGood].sort(
            (a, b) => (gameCount.get(a.id) || 0) - (gameCount.get(b.id) || 0)
          );
          const sortedBeg = [...availableBeg].sort(
            (a, b) => (gameCount.get(a.id) || 0) - (gameCount.get(b.id) || 0)
          );

          const g1 = sortedGood[0];
          const b1 = sortedBeg[0];
          const g2 = sortedGood[1];
          const b2 = sortedBeg[1];

          usedThisSlot.add(g1.id);
          usedThisSlot.add(b1.id);
          usedThisSlot.add(g2.id);
          usedThisSlot.add(b2.id);

          team1 = {
            id: generateId(),
            player1: g1,
            player2: b1,
            skillLevel: "good",
            wins: 0,
            losses: 0,
          };
          team2 = {
            id: generateId(),
            player1: g2,
            player2: b2,
            skillLevel: "good",
            wins: 0,
            losses: 0,
          };
        } else if (availableAll.length >= 4) {
          // Fallback: just pick 4 players sorted by least games
          team1 = buildTeam(availableAll, gameCount, sitOutCount, usedThisSlot);
          team2 = buildTeam(
            availableAll.filter((p) => !usedThisSlot.has(p.id)),
            gameCount,
            sitOutCount,
            usedThisSlot
          );
        }

        if (team1 && team2) {
          gameNumber++;
          const match: Match = {
            id: generateId(),
            pair1: team1,
            pair2: team2,
            skillLevel: "good",
            status: "pending",
            court: null,
            gameNumber,
          };
          allMatches.push(match);
          allPairs.push(team1, team2);

          // Update game counts
          [team1.player1, team1.player2, team2.player1, team2.player2].forEach((p) => {
            gameCount.set(p.id, (gameCount.get(p.id) || 0) + 1);
          });
        }
      }

      // Update sit-out counts
      allPlayers.forEach((p) => {
        if (usedThisSlot.has(p.id)) {
          sitOutCount.set(p.id, 0);
        } else {
          sitOutCount.set(p.id, (sitOutCount.get(p.id) || 0) + 1);
          // If sitting out too long, force them into next slot
        }
      });

      // Ensure no one exceeds 2 consecutive sit-outs — covered by priority sort
    }

    // Ensure minimum games: if any player has < minGamesPerPlayer, add extra matches
    const underserved = allPlayers.filter(
      (p) => (gameCount.get(p.id) || 0) < minGamesPerPlayer
    );
    if (underserved.length >= 4) {
      const usedExtra = new Set<string>();
      for (let i = 0; i + 3 < underserved.length; i += 4) {
        const four = underserved.slice(i, i + 4);
        four.forEach((p) => usedExtra.add(p.id));
        const t1: Pair = {
          id: generateId(),
          player1: four[0],
          player2: four[1],
          skillLevel: "good",
          wins: 0,
          losses: 0,
        };
        const t2: Pair = {
          id: generateId(),
          player1: four[2],
          player2: four[3],
          skillLevel: "good",
          wins: 0,
          losses: 0,
        };
        gameNumber++;
        allMatches.push({
          id: generateId(),
          pair1: t1,
          pair2: t2,
          skillLevel: "good",
          status: "pending",
          court: null,
          gameNumber,
        });
        allPairs.push(t1, t2);
      }
    }

    // Auto-assign first 2 matches to courts with startedAt
    const now = new Date().toISOString();
    if (allMatches.length >= 1) {
      allMatches[0].status = "playing";
      allMatches[0].court = 1;
      allMatches[0].startedAt = now;
    }
    if (allMatches.length >= 2) {
      allMatches[1].status = "playing";
      allMatches[1].court = 2;
      allMatches[1].startedAt = now;
    }

    // Save pairs to history
    const historyRows = allPairs.map((p) => ({
      player1_name: p.player1.name,
      player2_name: p.player2.name,
    }));
    if (historyRows.length > 0) {
      supabase.from("pair_history").insert(historyRows).then(() => {});
    }

    updateState((s) => ({
      ...s,
      pairs: allPairs,
      matches: allMatches,
      totalScheduledGames: gameNumber,
    }));
  }, [state.roster, state.sessionConfig, updateState]);

  // Swap a player in a pending match
  const swapPlayer = useCallback(
    (matchId: string, oldPlayerId: string, newPlayerId: string) => {
      updateState((s) => {
        const match = s.matches.find((m) => m.id === matchId);
        if (!match || match.status !== "pending") return s;
        const newPlayer = s.roster.find((p) => p.id === newPlayerId);
        if (!newPlayer) return s;

        const replaceInPair = (pair: Pair): Pair => {
          if (pair.player1.id === oldPlayerId) return { ...pair, player1: newPlayer };
          if (pair.player2.id === oldPlayerId) return { ...pair, player2: newPlayer };
          return pair;
        };

        return {
          ...s,
          matches: s.matches.map((m) =>
            m.id === matchId
              ? { ...m, pair1: replaceInPair(m.pair1), pair2: replaceInPair(m.pair2) }
              : m
          ),
        };
      });
    },
    [updateState]
  );

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
        updatedMatches[matchIdx] = {
          ...match,
          status: "completed",
          winner: winnerPair,
          loser: loserPair,
          completedAt: new Date().toISOString(),
        };

        // Assign next pending match to freed court
        if (freedCourt) {
          const nextPending = updatedMatches.find((m) => m.status === "pending");
          if (nextPending) {
            nextPending.status = "playing";
            nextPending.court = freedCourt;
            nextPending.startedAt = new Date().toISOString();
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

  // "On deck" = the next 2 pending matches (players who should get ready)
  const onDeckMatches = pendingMatches.slice(0, 2);

  // Waiting players - checked in but not currently playing
  const playingPlayerIds = playingMatches.flatMap((m) => [
    m.pair1.player1.id, m.pair1.player2.id,
    m.pair2.player1.id, m.pair2.player2.id,
  ]);
  const waitingPlayers = checkedInPlayers.filter((p) => !playingPlayerIds.includes(p.id));

  return {
    state,
    loading,
    setSessionConfig,
    addPlayer,
    removePlayer,
    toggleSkillLevel,
    toggleCheckIn,
    lockCheckIn,
    generateFullSchedule,
    swapPlayer,
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
    onDeckMatches,
  };
}
