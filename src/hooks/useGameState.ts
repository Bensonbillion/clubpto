import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GameState, DEFAULT_STATE, Player, Pair, Match, GameHistory, PlayoffMatch, FixedPair, SkillTier } from "@/types/courtManager";

const VIP_NAMES = ["david", "benson", "albright"];
function isVip(name: string) { return VIP_NAMES.includes(name.toLowerCase()); }
function matchHasVip(m: Match): boolean {
  return [m.pair1.player1, m.pair1.player2, m.pair2.player1, m.pair2.player2].some(p => isVip(p.name));
}

const ROW_ID = "current"; // stable ID for game state row

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

  // Polling fallback every 10s for projected screens (realtime may drop)
  useEffect(() => {
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from("game_state")
        .select("state")
        .eq("id", ROW_ID)
        .single();
      if (data?.state) {
        setState(data.state as unknown as GameState);
      }
    }, 10_000);
    return () => clearInterval(interval);
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
    (name: string, skillLevel: SkillTier): boolean => {
      let added = false;
      updateState((s) => {
        if (s.roster.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
          return s;
        }
        added = true;
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
        return { ...s, roster: [...s.roster, player] };
      });
      return added;
    },
    [updateState]
  );

  const setAllSkillLevels = useCallback(
    (skillLevel: SkillTier) => {
      updateState((s) => ({
        ...s,
        roster: s.roster.map((p) => (p.skillLevel !== skillLevel ? { ...p, skillLevel } : p)),
      }));
    },
    [updateState]
  );

  const removePlayer = useCallback(
    (id: string) => {
      updateState((s) => ({ ...s, roster: s.roster.filter((p) => p.id !== id) }));
    },
    [updateState]
  );

  const setPlayerSkillLevel = useCallback(
    (id: string, skillLevel: SkillTier) => {
      updateState((s) => ({
        ...s,
        roster: s.roster.map((p) =>
          p.id === id ? { ...p, skillLevel } : p
        ),
      }));
    },
    [updateState]
  );

  // Legacy toggle — cycles A -> B -> C -> A
  const toggleSkillLevel = useCallback(
    (id: string) => {
      updateState((s) => ({
        ...s,
        roster: s.roster.map((p) => {
          if (p.id !== id) return p;
          const cycle: Record<string, SkillTier> = { A: "B", B: "C", C: "A" };
          const next = cycle[p.skillLevel] || "C";
          return { ...p, skillLevel: next };
        }),
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
   * 3-Tier round-robin schedule generator.
   *
   * Rules:
   * - Tier A pairs ONLY vs Tier A pairs.
   * - Tier C pairs ONLY vs Tier C pairs.
   * - Tier B pairs play cross-tier: vs A pairs and vs C pairs (roughly equal split). B never vs B.
   * - No player plays back-to-back slots (at least 1 slot rest).
   * - No player sits out more than 3 consecutive slots.
   * - Players with fewer games are prioritised.
   * - Avoids repeat pairings from the last 14 days.
   * - Each player gets min 3 games, ideally 4-5.
   */
  const generateFullSchedule = useCallback(async (fixedPairs: FixedPair[] = []) => {
    // Auto-check-in any locked teammates who haven't checked in yet
    let roster = [...state.roster];
    fixedPairs.forEach((fp) => {
      const teammate = roster.find(
        (p) => p.name.toLowerCase() === fp.player2Name.toLowerCase() && !p.checkedIn
      );
      if (teammate) {
        roster = roster.map((p) =>
          p.id === teammate.id ? { ...p, checkedIn: true, checkInTime: new Date().toISOString() } : p
        );
      }
    });

    const checkedIn = roster.filter((p) => p.checkedIn);
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
    const tierA = shuffle(checkedIn.filter((p) => p.skillLevel === "A"));
    const tierB = shuffle(checkedIn.filter((p) => p.skillLevel === "B"));
    const tierC = shuffle(checkedIn.filter((p) => p.skillLevel === "C"));

    const durationMin = state.sessionConfig.durationMinutes || 85;
    const minutesPerGame = 7;
    const gamesPerCourt = Math.floor(durationMin / minutesPerGame);
    const totalSlots = gamesPerCourt;

    // --- Generate same-tier matches for a pool ---
    const generatePoolMatches = (
      players: Player[],
      skill: SkillTier,
      lockedPairs: FixedPair[]
    ): Match[] => {
      if (players.length < 4) return [];

      const resolvedLocked: [Player, Player][] = [];
      lockedPairs.forEach((fp) => {
        const p1 = players.find((p) => p.name.toLowerCase() === fp.player1Name.toLowerCase());
        const p2 = players.find((p) => p.name.toLowerCase() === fp.player2Name.toLowerCase());
        if (p1 && p2) resolvedLocked.push([p1, p2]);
      });

      const gameCount = new Map<string, number>();
      players.forEach((p) => gameCount.set(p.id, 0));

      const matches: Match[] = [];
      const targetGamesPerPlayer = 5;
      const maxMatches = Math.ceil((players.length * targetGamesPerPlayer) / 4);
      const usedPairKeys = new Set<string>();
      const makePairKey = (a: string, b: string) => [a, b].sort().join("|||");
      const makeMatchKey = (p1Id: string, p2Id: string, p3Id: string, p4Id: string) => {
        const team1 = makePairKey(p1Id, p2Id);
        const team2 = makePairKey(p3Id, p4Id);
        return [team1, team2].sort().join("---");
      };

      const label = `${skill} vs ${skill}`;

      for (let m = 0; m < maxMatches; m++) {
        const sorted = [...players].sort((a, b) => {
          const ga = gameCount.get(a.id) || 0;
          const gb = gameCount.get(b.id) || 0;
          return ga - gb;
        });

        const lastPoolMatchPlayers = matches.length > 0
          ? new Set([
              matches[matches.length - 1].pair1.player1.id,
              matches[matches.length - 1].pair1.player2.id,
              matches[matches.length - 1].pair2.player1.id,
              matches[matches.length - 1].pair2.player2.id,
            ])
          : new Set<string>();

        const eligible = sorted.filter((p) => !lastPoolMatchPlayers.has(p.id));
        const fallback = sorted;

        const pick4 = (list: Player[]): Player[] | null => {
          if (list.length < 4) return null;
          return list.slice(0, 4);
        };

        let four = pick4(eligible);
        if (!four) four = pick4(fallback);
        if (!four) break;

        let p1: Player, p2: Player, p3: Player, p4: Player;

        const lockedInFour = resolvedLocked.find(
          ([a, b]) => four!.some((p) => p.id === a.id) && four!.some((p) => p.id === b.id)
        );

        if (lockedInFour) {
          p1 = lockedInFour[0];
          p2 = lockedInFour[1];
          const remaining = four.filter((p) => p.id !== p1.id && p.id !== p2.id);
          p3 = remaining[0];
          p4 = remaining[1];
        } else {
          p1 = four[0];
          const partnerCandidates = four.slice(1);
          const bestPartner = partnerCandidates.find((c) => !wasRecentlyPaired(p1.name, c.name)) || partnerCandidates[0];
          p2 = bestPartner;
          const remaining = four.filter((p) => p.id !== p1.id && p.id !== p2.id);
          p3 = remaining[0];
          p4 = remaining[1];
        }

        let matchKey = makeMatchKey(p1.id, p2.id, p3.id, p4.id);
        if (usedPairKeys.has(matchKey) && !lockedInFour) {
          const alts: [Player, Player, Player, Player][] = [
            [four[0], four[2], four[1], four[3]],
            [four[0], four[3], four[1], four[2]],
          ];
          for (const alt of alts) {
            const altKey = makeMatchKey(alt[0].id, alt[1].id, alt[2].id, alt[3].id);
            if (!usedPairKeys.has(altKey)) {
              [p1, p2, p3, p4] = alt;
              matchKey = altKey;
              break;
            }
          }
        }
        usedPairKeys.add(matchKey);

        const team1: Pair = {
          id: generateId(), player1: p1, player2: p2, skillLevel: skill, wins: 0, losses: 0,
        };
        const team2: Pair = {
          id: generateId(), player1: p3, player2: p4, skillLevel: skill, wins: 0, losses: 0,
        };

        matches.push({
          id: generateId(), pair1: team1, pair2: team2, skillLevel: skill,
          matchupLabel: label, status: "pending", court: null,
        });

        four.forEach((p) => { gameCount.set(p.id, (gameCount.get(p.id) || 0) + 1); });
      }

      return matches;
    };

    // --- Generate cross-tier matches for B players vs A/C pairs ---
    const generateCrossTierMatches = (
      bPlayers: Player[],
      opponentPool: Player[],
      opponentTier: SkillTier
    ): Match[] => {
      if (bPlayers.length < 2 || opponentPool.length < 2) return [];

      const gameCount = new Map<string, number>();
      [...bPlayers, ...opponentPool].forEach((p) => gameCount.set(p.id, 0));

      const matches: Match[] = [];
      const targetGamesPerBPlayer = 3; // aim for ~2-3 games vs each opponent tier
      const maxMatches = Math.ceil((bPlayers.length * targetGamesPerBPlayer) / 2);
      const label = `B vs ${opponentTier}`;

      for (let m = 0; m < maxMatches; m++) {
        // Pick 2 B players with fewest games
        const sortedB = [...bPlayers].sort((a, b) => (gameCount.get(a.id) || 0) - (gameCount.get(b.id) || 0));
        if (sortedB.length < 2) break;

        // Avoid back-to-back
        const lastPlayers = matches.length > 0
          ? new Set([
              matches[matches.length - 1].pair1.player1.id,
              matches[matches.length - 1].pair1.player2.id,
              matches[matches.length - 1].pair2.player1.id,
              matches[matches.length - 1].pair2.player2.id,
            ])
          : new Set<string>();

        const eligibleB = sortedB.filter((p) => !lastPlayers.has(p.id));
        const pickB = (eligibleB.length >= 2 ? eligibleB : sortedB).slice(0, 2);

        // Pick 2 opponent players with fewest games
        const sortedOpp = [...opponentPool].sort((a, b) => (gameCount.get(a.id) || 0) - (gameCount.get(b.id) || 0));
        const eligibleOpp = sortedOpp.filter((p) => !lastPlayers.has(p.id));
        const pickOpp = (eligibleOpp.length >= 2 ? eligibleOpp : sortedOpp).slice(0, 2);

        if (pickB.length < 2 || pickOpp.length < 2) break;

        const bPair: Pair = {
          id: generateId(), player1: pickB[0], player2: pickB[1], skillLevel: "B", wins: 0, losses: 0,
        };
        const oppPair: Pair = {
          id: generateId(), player1: pickOpp[0], player2: pickOpp[1], skillLevel: opponentTier, wins: 0, losses: 0,
        };

        matches.push({
          id: generateId(), pair1: bPair, pair2: oppPair, skillLevel: "cross",
          matchupLabel: label, status: "pending", court: null,
        });

        [pickB[0], pickB[1], pickOpp[0], pickOpp[1]].forEach((p) => {
          gameCount.set(p.id, (gameCount.get(p.id) || 0) + 1);
        });
      }

      return matches;
    };

    // Generate all match pools
    const aMatches = generatePoolMatches(tierA, "A", fixedPairs);
    const cMatches = generatePoolMatches(tierC, "C", fixedPairs);
    const bVsAMatches = generateCrossTierMatches(tierB, tierA, "A");
    const bVsCMatches = generateCrossTierMatches(tierB, tierC, "C");

    // --- Interleave matches across time slots ---
    // Start with A games on both courts first, then mix in all pools
    const allPoolMatches = [
      ...shuffle(aMatches),
      ...shuffle(bVsAMatches),
      ...shuffle(bVsCMatches),
      ...shuffle(cMatches),
    ];

    // Interleave: try to spread A, cross, C matches evenly
    const schedule: Match[] = [];
    const queues = {
      A: [...aMatches],
      bVsA: [...bVsAMatches],
      bVsC: [...bVsCMatches],
      C: [...cMatches],
    };

    // Order: Start with A, then alternate
    const poolOrder = ["A", "bVsA", "C", "bVsC"] as const;
    let poolIdx = 0;
    let gameNumber = 0;
    const maxGames = totalSlots * 2; // 2 courts per slot

    // Simple round-robin pull from each queue
    let emptyCount = 0;
    while (schedule.length < maxGames && emptyCount < poolOrder.length) {
      const key = poolOrder[poolIdx % poolOrder.length];
      const q = queues[key];
      if (q.length > 0) {
        const m = q.shift()!;
        gameNumber++;
        m.gameNumber = gameNumber;
        schedule.push(m);
        emptyCount = 0;
      } else {
        emptyCount++;
      }
      poolIdx++;
    }

    // If we still have matches left in any queue, append them
    for (const key of poolOrder) {
      while (queues[key].length > 0 && schedule.length < maxGames) {
        const m = queues[key].shift()!;
        gameNumber++;
        m.gameNumber = gameNumber;
        schedule.push(m);
      }
    }

    // --- Push VIP matches out of the first 2 slots ---
    for (let i = 0; i < Math.min(2, schedule.length); i++) {
      if (matchHasVip(schedule[i])) {
        const swapIdx = schedule.findIndex((m, idx) => idx > 1 && !matchHasVip(m));
        if (swapIdx !== -1) {
          [schedule[i], schedule[swapIdx]] = [schedule[swapIdx], schedule[i]];
        }
      }
    }

    // Re-number games after reorder
    schedule.forEach((m, idx) => { m.gameNumber = idx + 1; });

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
      roster: roster,
      pairs: allPairs,
      matches: schedule,
      totalScheduledGames: schedule.length,
    }));
  }, [state.roster, state.sessionConfig, updateState]);

  /**
   * Add late-arriving players into the existing schedule.
   */
  const addLatePlayersToSchedule = useCallback(() => {
    updateState((s) => {
      if (s.matches.length === 0) return s;

      const scheduledPlayerIds = new Set<string>();
      s.matches.forEach((m) => {
        [m.pair1.player1.id, m.pair1.player2.id, m.pair2.player1.id, m.pair2.player2.id].forEach((id) =>
          scheduledPlayerIds.add(id)
        );
      });

      const latePlayers = s.roster.filter((p) => p.checkedIn && !scheduledPlayerIds.has(p.id));
      if (latePlayers.length === 0) return s;

      const existingPlayers = s.roster.filter((p) => p.checkedIn && scheduledPlayerIds.has(p.id));
      const newMatches: Match[] = [];
      let gameNum = s.totalScheduledGames;

      const buildMatchesForGroup = (newPlayers: Player[], pool: Player[], skill: SkillTier) => {
        if (newPlayers.length === 0) return;
        const existingPool = pool.filter((p) => p.skillLevel === skill).sort((a, b) => a.gamesPlayed - b.gamesPlayed);
        const allAvailable = [...shuffle(newPlayers), ...existingPool];

        const newPlayerGameCount = new Map<string, number>();
        newPlayers.forEach((p) => newPlayerGameCount.set(p.id, 0));

        const targetGames = 3;
        let attempts = 0;
        const maxAttempts = newPlayers.length * targetGames * 2;

        while (attempts < maxAttempts) {
          attempts++;
          const needsGames = newPlayers.find((p) => (newPlayerGameCount.get(p.id) || 0) < targetGames);
          if (!needsGames) break;

          const candidates = allAvailable.filter((p) => p.id !== needsGames.id);
          if (candidates.length < 3) break;

          const lastMatch = newMatches[newMatches.length - 1];
          const lastIds = lastMatch
            ? new Set([lastMatch.pair1.player1.id, lastMatch.pair1.player2.id, lastMatch.pair2.player1.id, lastMatch.pair2.player2.id])
            : new Set<string>();

          const eligible = candidates.filter((p) => !lastIds.has(p.id));
          const pickFrom = eligible.length >= 3 ? eligible : candidates;

          const three = pickFrom.slice(0, 3);
          const four = [needsGames, ...three];

          const team1: Pair = {
            id: generateId(), player1: four[0], player2: four[1], skillLevel: skill, wins: 0, losses: 0,
          };
          const team2: Pair = {
            id: generateId(), player1: four[2], player2: four[3], skillLevel: skill, wins: 0, losses: 0,
          };

          gameNum++;
          newMatches.push({
            id: generateId(), pair1: team1, pair2: team2, skillLevel: skill,
            matchupLabel: `${skill} vs ${skill}`, status: "pending", court: null, gameNumber: gameNum,
          });

          four.forEach((p) => {
            if (newPlayerGameCount.has(p.id)) {
              newPlayerGameCount.set(p.id, (newPlayerGameCount.get(p.id) || 0) + 1);
            }
          });
        }
      };

      // Group late players by tier
      const lateA = latePlayers.filter((p) => p.skillLevel === "A");
      const lateB = latePlayers.filter((p) => p.skillLevel === "B");
      const lateC = latePlayers.filter((p) => p.skillLevel === "C");

      buildMatchesForGroup(lateA, existingPlayers, "A");
      buildMatchesForGroup(lateB, existingPlayers, "B");
      buildMatchesForGroup(lateC, existingPlayers, "C");

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

  // Skip a playing match
  const skipMatch = useCallback(
    (matchId: string) => {
      updateState((s) => {
        const matchIdx = s.matches.findIndex((m) => m.id === matchId);
        if (matchIdx === -1) return s;
        const match = s.matches[matchIdx];
        if (match.status !== "playing") return s;

        const freedCourt = match.court;
        const updatedMatches = [...s.matches];

        updatedMatches[matchIdx] = {
          ...match, status: "pending", court: null, startedAt: undefined,
        };

        const [skipped] = updatedMatches.splice(matchIdx, 1);
        updatedMatches.push(skipped);

        if (freedCourt) {
          const nextPending = updatedMatches.find((m) => m.status === "pending");
          if (nextPending) {
            nextPending.status = "playing";
            nextPending.court = freedCourt;
            nextPending.startedAt = new Date().toISOString();
          }
        }

        let num = 0;
        updatedMatches.forEach((m) => { num++; m.gameNumber = num; });

        return { ...s, matches: updatedMatches };
      });
    },
    [updateState]
  );

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
          ...match, status: "completed", winner: winnerPair, loser: loserPair, completedAt: new Date().toISOString(),
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

  const setFixedPairs = useCallback(
    (pairs: FixedPair[]) => {
      updateState((s) => ({ ...s, fixedPairs: pairs }));
    },
    [updateState]
  );

  const startSession = useCallback(() => {
    updateState((s) => ({
      ...s,
      sessionStarted: true,
      sessionConfig: { ...s.sessionConfig, sessionStartedAt: new Date().toISOString() },
    }));
  }, [updateState]);

  const resetSession = useCallback(() => {
    const fresh = { ...DEFAULT_STATE, playoffMatches: [], playoffsStarted: false };
    setState(fresh);
    persistState(fresh);
  }, [persistState]);

  // Start playoffs manually
  const startPlayoffs = useCallback(() => {
    updateState((s) => ({ ...s, playoffsStarted: true }));
  }, [updateState]);

  // Remove player mid-session: remove from future pending matches, replace with resting players
  const removePlayerMidSession = useCallback(
    (playerId: string) => {
      updateState((s) => {
        const player = s.roster.find((p) => p.id === playerId);
        if (!player) return s;

        // Mark player as not checked in
        const updatedRoster = s.roster.map((p) =>
          p.id === playerId ? { ...p, checkedIn: false } : p
        );

        // Find all players currently in playing matches
        const playingIds = new Set<string>();
        s.matches.filter((m) => m.status === "playing").forEach((m) => {
          [m.pair1.player1.id, m.pair1.player2.id, m.pair2.player1.id, m.pair2.player2.id].forEach((id) => playingIds.add(id));
        });

        // Get resting checked-in players (excluding the removed one)
        const allScheduledIds = new Set<string>();
        s.matches.filter((m) => m.status !== "completed").forEach((m) => {
          [m.pair1.player1.id, m.pair1.player2.id, m.pair2.player1.id, m.pair2.player2.id].forEach((id) => allScheduledIds.add(id));
        });

        const restingPlayers = updatedRoster.filter(
          (p) => p.checkedIn && p.id !== playerId && !playingIds.has(p.id)
        );

        // Remove player from pending matches or replace them
        const updatedMatches = s.matches.map((m) => {
          if (m.status !== "pending") return m;
          const hasPlayer = [m.pair1.player1.id, m.pair1.player2.id, m.pair2.player1.id, m.pair2.player2.id].includes(playerId);
          if (!hasPlayer) return m;

          // Try to find a replacement from resting players
          const matchPlayerIds = new Set([m.pair1.player1.id, m.pair1.player2.id, m.pair2.player1.id, m.pair2.player2.id]);
          const replacement = restingPlayers.find((p) => !matchPlayerIds.has(p.id));

          if (replacement) {
            const replaceInPair = (pair: typeof m.pair1) => {
              if (pair.player1.id === playerId) return { ...pair, player1: replacement };
              if (pair.player2.id === playerId) return { ...pair, player2: replacement };
              return pair;
            };
            return { ...m, pair1: replaceInPair(m.pair1), pair2: replaceInPair(m.pair2) };
          }

          // No replacement available — remove match
          return null;
        }).filter(Boolean) as typeof s.matches;

        // Renumber
        updatedMatches.forEach((m, i) => { m.gameNumber = i + 1; });

        return {
          ...s,
          roster: updatedRoster,
          matches: updatedMatches,
          totalScheduledGames: updatedMatches.length,
        };
      });
    },
    [updateState]
  );

  // Correct a game result — flip winner/loser and recalculate stats
  const correctGameResult = useCallback(
    (matchId: string, newWinnerPairId: string) => {
      updateState((s) => {
        const matchIdx = s.matches.findIndex((m) => m.id === matchId);
        if (matchIdx === -1) return s;
        const match = s.matches[matchIdx];
        if (match.status !== "completed" || !match.winner || !match.loser) return s;

        // If already the winner, no change needed
        if (match.winner.id === newWinnerPairId) return s;

        const newWinner = match.pair1.id === newWinnerPairId ? match.pair1 : match.pair2;
        const newLoser = match.pair1.id === newWinnerPairId ? match.pair2 : match.pair1;
        const oldWinnerIds = [match.winner.player1.id, match.winner.player2.id];
        const oldLoserIds = [match.loser.player1.id, match.loser.player2.id];

        // Recalculate roster stats: reverse old result, apply new
        const updatedRoster = s.roster.map((p) => {
          let { wins, losses } = p;
          // Undo old
          if (oldWinnerIds.includes(p.id)) { wins--; losses++; }
          if (oldLoserIds.includes(p.id)) { losses--; wins++; }
          return { ...p, wins: Math.max(0, wins), losses: Math.max(0, losses) };
        });

        const updatedMatches = [...s.matches];
        updatedMatches[matchIdx] = { ...match, winner: newWinner, loser: newLoser };

        // Update game history entry
        const updatedHistory = s.gameHistory.map((h) => {
          if (h.winnerPairId === match.winner!.id && h.loserPairId === match.loser!.id && h.timestamp === match.completedAt) {
            return {
              ...h,
              winnerPairId: newWinner.id,
              loserPairId: newLoser.id,
              winnerNames: `${newWinner.player1.name} & ${newWinner.player2.name}`,
              loserNames: `${newLoser.player1.name} & ${newLoser.player2.name}`,
            };
          }
          return h;
        });

        return { ...s, roster: updatedRoster, matches: updatedMatches, gameHistory: updatedHistory };
      });
    },
    [updateState]
  );

  // Playoff management
  const generatePlayoffMatches = useCallback(
    (seeds: { seed: number; player: Player; winPct: number }[]) => {
      if (seeds.length < 4) return;
      const matches: PlayoffMatch[] = [];
      const numMatches = Math.floor(seeds.length / 4);
      for (let i = 0; i < numMatches; i++) {
        const s1 = seeds[i * 2];
        const s2 = seeds[seeds.length - 1 - i * 2];
        const s3 = seeds[i * 2 + 1];
        const s4 = seeds[seeds.length - 2 - i * 2];
        if (!s1 || !s2 || !s3 || !s4) continue;
        const pair1: Pair = {
          id: generateId(), player1: s1.player, player2: s2.player,
          skillLevel: "A", wins: 0, losses: 0,
        };
        const pair2: Pair = {
          id: generateId(), player1: s3.player, player2: s4.player,
          skillLevel: "A", wins: 0, losses: 0,
        };
        matches.push({
          id: generateId(), round: 1, seed1: s1.seed, seed2: s2.seed,
          pair1, pair2, status: "pending",
        });
      }
      updateState((s) => ({ ...s, playoffMatches: matches }));
    },
    [updateState]
  );

  const startPlayoffMatch = useCallback(
    (matchId: string, court: number) => {
      updateState((s) => ({
        ...s,
        playoffMatches: s.playoffMatches.map((m) =>
          m.id === matchId ? { ...m, status: "playing" as const } : m
        ),
        matches: s.matches.map((m) =>
          m.court === court && m.status === "playing" ? { ...m, status: "completed" as const, court: null } : m
        ),
      }));
    },
    [updateState]
  );

  const completePlayoffMatch = useCallback(
    (matchId: string, winnerPairId: string) => {
      updateState((s) => {
        const pmIdx = s.playoffMatches.findIndex((m) => m.id === matchId);
        if (pmIdx === -1) return s;
        const pm = s.playoffMatches[pmIdx];
        const winner = pm.pair1?.id === winnerPairId ? pm.pair1 : pm.pair2;
        const updated = [...s.playoffMatches];
        updated[pmIdx] = { ...pm, status: "completed", winner: winner || undefined };
        
        const currentRound = pm.round;
        const roundMatches = updated.filter((m) => m.round === currentRound);
        const allComplete = roundMatches.every((m) => m.status === "completed");
        
        if (allComplete) {
          const winners = roundMatches.map((m) => m.winner).filter(Boolean) as Pair[];
          if (winners.length >= 2) {
            const nextRound = currentRound + 1;
            for (let i = 0; i < Math.floor(winners.length / 2); i++) {
              updated.push({
                id: generateId(),
                round: nextRound,
                seed1: 0, seed2: 0,
                pair1: winners[i * 2],
                pair2: winners[i * 2 + 1],
                status: "pending",
              });
            }
          }
        }
        
        return { ...s, playoffMatches: updated };
      });
    },
    [updateState]
  );

  // Derived
  const checkedInPlayers = state.roster.filter((p) => p.checkedIn);
  const playingMatches = state.matches.filter((m) => m.status === "playing");
  const pendingMatches = state.matches.filter((m) => m.status === "pending");
  const completedMatches = state.matches.filter((m) => m.status === "completed");
  const court1Match = playingMatches.find((m) => m.court === 1) || null;
  const court2Match = playingMatches.find((m) => m.court === 2) || null;

  const upNextMatches = pendingMatches.slice(0, 2);
  const onDeckMatches = pendingMatches.slice(2, 4);

  const playingPlayerIds = playingMatches.flatMap((m) => [
    m.pair1.player1.id, m.pair1.player2.id,
    m.pair2.player1.id, m.pair2.player2.id,
  ]);
  const waitingPlayers = checkedInPlayers.filter((p) => !playingPlayerIds.includes(p.id));

  return {
    state,
    loading,
    setSessionConfig,
    setFixedPairs,
    addPlayer,
    removePlayer,
    toggleSkillLevel,
    setPlayerSkillLevel,
    setAllSkillLevels,
    toggleCheckIn,
    lockCheckIn,
    generateFullSchedule,
    addLatePlayersToSchedule,
    swapPlayer,
    skipMatch,
    completeMatch,
    startSession,
    resetSession,
    startPlayoffs,
    removePlayerMidSession,
    correctGameResult,
    generatePlayoffMatches,
    startPlayoffMatch,
    completePlayoffMatch,
    checkedInPlayers,
    playingMatches,
    pendingMatches,
    completedMatches,
    court1Match,
    court2Match,
    waitingPlayers,
    upNextMatches,
    onDeckMatches,
  };
}
