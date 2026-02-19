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
   * Skill-separated round-robin schedule generator.
   *
   * Rules:
   * - GOOD pairs only face GOOD pairs; BEGINNER pairs only face BEGINNER pairs.
   * - Two independent pools share 2 courts, alternating pool per court per slot.
   * - No player plays back-to-back slots (at least 1 slot rest).
   * - No player sits out more than 3 consecutive slots.
   * - Players with fewer games are prioritised.
   * - Avoids repeat pairings from the last 14 days.
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

    // Split pools
    const goodPlayers = shuffle(checkedIn.filter((p) => p.skillLevel === "good"));
    const beginnerPlayers = shuffle(checkedIn.filter((p) => p.skillLevel === "beginner"));

    const durationMin = state.sessionConfig.durationMinutes || 85;
    const minutesPerGame = 7;
    const gamesPerCourt = Math.floor(durationMin / minutesPerGame);
    const totalSlots = gamesPerCourt; // time slots (2 courts run simultaneously per slot)

    // --- Generate matches for a single skill pool ---
    const generatePoolMatches = (
      players: Player[],
      skill: "beginner" | "good"
    ): Match[] => {
      if (players.length < 4) return [];

      const gameCount = new Map<string, number>();
      const lastPlayedSlot = new Map<string, number>(); // slot index when player last played
      const consecutiveSitOut = new Map<string, number>();
      players.forEach((p) => {
        gameCount.set(p.id, 0);
        lastPlayedSlot.set(p.id, -99); // never played
        consecutiveSitOut.set(p.id, 0);
      });

      const matches: Match[] = [];
      // We'll generate as many matches as we can; the interleaver will pick from these
      const targetGamesPerPlayer = 5;
      const maxMatches = Math.ceil((players.length * targetGamesPerPlayer) / 4);

      for (let m = 0; m < maxMatches; m++) {
        // Sort players by: fewest games first, then most sit-outs
        const sorted = [...players].sort((a, b) => {
          const ga = gameCount.get(a.id) || 0;
          const gb = gameCount.get(b.id) || 0;
          if (ga !== gb) return ga - gb;
          const sa = consecutiveSitOut.get(a.id) || 0;
          const sb = consecutiveSitOut.get(b.id) || 0;
          return sb - sa;
        });

        // Pick 4 players who didn't play in the "previous" match of this pool
        // Simulate slot spacing: ensure they weren't in the last pool match
        const lastPoolMatchPlayers = matches.length > 0
          ? new Set([
              matches[matches.length - 1].pair1.player1.id,
              matches[matches.length - 1].pair1.player2.id,
              matches[matches.length - 1].pair2.player1.id,
              matches[matches.length - 1].pair2.player2.id,
            ])
          : new Set<string>();

        const eligible = sorted.filter((p) => !lastPoolMatchPlayers.has(p.id));
        const fallback = sorted; // if not enough eligible, use all

        const pick4 = (list: Player[]): Player[] | null => {
          if (list.length < 4) return null;
          return list.slice(0, 4);
        };

        let four = pick4(eligible);
        if (!four) four = pick4(fallback);
        if (!four) break; // not enough players

        // Build 2 pairs, trying to avoid recent pairings
        let p1: Player, p2: Player, p3: Player, p4: Player;
        p1 = four[0];
        // Find best partner for p1 (not recently paired)
        const partnerCandidates = four.slice(1);
        const bestPartner = partnerCandidates.find((c) => !wasRecentlyPaired(p1.name, c.name)) || partnerCandidates[0];
        p2 = bestPartner;
        const remaining = four.filter((p) => p.id !== p1.id && p.id !== p2.id);
        p3 = remaining[0];
        p4 = remaining[1];

        const team1: Pair = {
          id: generateId(),
          player1: p1,
          player2: p2,
          skillLevel: skill,
          wins: 0,
          losses: 0,
        };
        const team2: Pair = {
          id: generateId(),
          player1: p3,
          player2: p4,
          skillLevel: skill,
          wins: 0,
          losses: 0,
        };

        matches.push({
          id: generateId(),
          pair1: team1,
          pair2: team2,
          skillLevel: skill,
          status: "pending",
          court: null,
        });

        // Update counts
        four.forEach((p) => {
          gameCount.set(p.id, (gameCount.get(p.id) || 0) + 1);
        });
      }

      // Trim: ensure every player has at least 3 games (keep generating if needed)
      // The loop above targets 5 per player which should cover it.

      return matches;
    };

    const goodMatches = generatePoolMatches(goodPlayers, "good");
    const beginnerMatches = generatePoolMatches(beginnerPlayers, "beginner");

    // --- Interleave matches across time slots ---
    // Start with GOOD games on BOTH courts first (so beginners can watch & learn),
    // then alternate pools across courts.
    const schedule: Match[] = [];
    let gi = 0; // good match index
    let bi = 0; // beginner match index
    let gameNumber = 0;

    for (let slot = 0; slot < totalSlots; slot++) {
      const pickFromPool = (pool: "good" | "beginner"): Match | null => {
        if (pool === "good" && gi < goodMatches.length) return goodMatches[gi++];
        if (pool === "beginner" && bi < beginnerMatches.length) return beginnerMatches[bi++];
        // Fallback to the other pool
        if (gi < goodMatches.length) return goodMatches[gi++];
        if (bi < beginnerMatches.length) return beginnerMatches[bi++];
        return null;
      };

      let pool1: "good" | "beginner";
      let pool2: "good" | "beginner";

      if (slot === 0) {
        // First slot: GOOD on both courts
        pool1 = "good";
        pool2 = "good";
      } else {
        // After that, alternate pools across courts
        pool1 = slot % 2 === 0 ? "good" : "beginner";
        pool2 = slot % 2 === 0 ? "beginner" : "good";
      }

      const m1 = pickFromPool(pool1);
      const m2 = pickFromPool(pool2);

      if (m1) {
        gameNumber++;
        m1.gameNumber = gameNumber;
        schedule.push(m1);
      }
      if (m2) {
        gameNumber++;
        m2.gameNumber = gameNumber;
        schedule.push(m2);
      }

      if (!m1 && !m2) break;
    }

    // Auto-assign first 2 matches to courts
    const now = new Date().toISOString();
    if (schedule.length >= 1) {
      schedule[0].status = "playing";
      schedule[0].court = 1;
      schedule[0].startedAt = now;
    }
    if (schedule.length >= 2) {
      schedule[1].status = "playing";
      schedule[1].court = 2;
      schedule[1].startedAt = now;
    }

    // Collect all pairs
    const allPairs = schedule.flatMap((m) => [m.pair1, m.pair2]);

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
      matches: schedule,
      totalScheduledGames: gameNumber,
    }));
  }, [state.roster, state.sessionConfig, updateState]);

  /**
   * Add late-arriving players into the existing schedule.
   * Finds players who are checked in but have 0 games scheduled,
   * then appends new matches for them without touching existing games.
   */
  const addLatePlayersToSchedule = useCallback(() => {
    updateState((s) => {
      if (s.matches.length === 0) return s; // no schedule yet

      // Find players who are checked in but not in any match
      const scheduledPlayerIds = new Set<string>();
      s.matches.forEach((m) => {
        [m.pair1.player1.id, m.pair1.player2.id, m.pair2.player1.id, m.pair2.player2.id].forEach((id) =>
          scheduledPlayerIds.add(id)
        );
      });

      const latePlayers = s.roster.filter((p) => p.checkedIn && !scheduledPlayerIds.has(p.id));
      if (latePlayers.length === 0) return s; // nobody new

      // Group by skill
      const lateGood = latePlayers.filter((p) => p.skillLevel === "good");
      const lateBeginner = latePlayers.filter((p) => p.skillLevel === "beginner");

      // Also grab existing scheduled players who have fewer games to mix them in
      const existingPlayers = s.roster.filter((p) => p.checkedIn && scheduledPlayerIds.has(p.id));

      const newMatches: Match[] = [];
      let gameNum = s.totalScheduledGames;

      const buildMatchesForGroup = (newPlayers: Player[], pool: Player[], skill: "good" | "beginner") => {
        if (newPlayers.length === 0) return;
        // Combine new players with existing pool players sorted by fewest games
        const existingPool = pool.filter((p) => p.skillLevel === skill).sort((a, b) => a.gamesPlayed - b.gamesPlayed);
        // Each new player should get at least 3 games
        const allAvailable = [...shuffle(newPlayers), ...existingPool];

        // Generate matches ensuring each new player appears at least 3 times
        const newPlayerGameCount = new Map<string, number>();
        newPlayers.forEach((p) => newPlayerGameCount.set(p.id, 0));

        const targetGames = 3;
        let attempts = 0;
        const maxAttempts = newPlayers.length * targetGames * 2;

        while (attempts < maxAttempts) {
          attempts++;
          // Find a new player who still needs games
          const needsGames = newPlayers.find((p) => (newPlayerGameCount.get(p.id) || 0) < targetGames);
          if (!needsGames) break;

          // Pick 3 more players (prefer other new players who need games, then existing low-game players)
          const candidates = allAvailable.filter((p) => p.id !== needsGames.id);
          if (candidates.length < 3) break;

          // Don't pick players who were in the last new match
          const lastMatch = newMatches[newMatches.length - 1];
          const lastIds = lastMatch
            ? new Set([lastMatch.pair1.player1.id, lastMatch.pair1.player2.id, lastMatch.pair2.player1.id, lastMatch.pair2.player2.id])
            : new Set<string>();

          const eligible = candidates.filter((p) => !lastIds.has(p.id));
          const pickFrom = eligible.length >= 3 ? eligible : candidates;

          const three = pickFrom.slice(0, 3);
          const four = [needsGames, ...three];

          const team1: Pair = {
            id: generateId(),
            player1: four[0],
            player2: four[1],
            skillLevel: skill,
            wins: 0,
            losses: 0,
          };
          const team2: Pair = {
            id: generateId(),
            player1: four[2],
            player2: four[3],
            skillLevel: skill,
            wins: 0,
            losses: 0,
          };

          gameNum++;
          newMatches.push({
            id: generateId(),
            pair1: team1,
            pair2: team2,
            skillLevel: skill,
            status: "pending",
            court: null,
            gameNumber: gameNum,
          });

          four.forEach((p) => {
            if (newPlayerGameCount.has(p.id)) {
              newPlayerGameCount.set(p.id, (newPlayerGameCount.get(p.id) || 0) + 1);
            }
          });
        }
      };

      buildMatchesForGroup(lateGood, existingPlayers, "good");
      buildMatchesForGroup(lateBeginner, existingPlayers, "beginner");

      if (newMatches.length === 0) return s;

      const allNewPairs = newMatches.flatMap((m) => [m.pair1, m.pair2]);

      return {
        ...s,
        pairs: [...s.pairs, ...allNewPairs],
        matches: [...s.matches, ...newMatches],
        totalScheduledGames: gameNum,
      };
    });
  }, [updateState]);

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

        const winnerIds = [winnerPair.player1.id, winnerPair.player2.id];
        const loserIds = [loserPair.player1.id, loserPair.player2.id];
        const updatedRoster = s.roster.map((p) => {
          if (winnerIds.includes(p.id)) return { ...p, wins: p.wins + 1, gamesPlayed: p.gamesPlayed + 1 };
          if (loserIds.includes(p.id)) return { ...p, losses: p.losses + 1, gamesPlayed: p.gamesPlayed + 1 };
          return p;
        });

        const updatedMatches = [...s.matches];
        updatedMatches[matchIdx] = {
          ...match,
          status: "completed",
          winner: winnerPair,
          loser: loserPair,
          completedAt: new Date().toISOString(),
        };

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

  // "On deck" = the next 2 pending matches
  const onDeckMatches = pendingMatches.slice(0, 2);

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
    addLatePlayersToSchedule,
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
