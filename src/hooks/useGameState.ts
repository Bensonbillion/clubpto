import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GameState, DEFAULT_STATE, Player, Pair, Match, GameHistory, PlayoffMatch, FixedPair, SkillTier } from "@/types/courtManager";

const VIP_NAMES = ["david", "benson", "albright"];
function isVip(name: string) { return VIP_NAMES.includes(name.toLowerCase()); }
function matchHasVip(m: Match): boolean {
  return [m.pair1.player1, m.pair1.player2, m.pair2.player1, m.pair2.player2].some(p => isVip(p.name));
}

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

function getPairPlayerIds(pair: Pair): string[] {
  return [pair.player1.id, pair.player2.id];
}

function getMatchPlayerIds(m: Match): string[] {
  return [...getPairPlayerIds(m.pair1), ...getPairPlayerIds(m.pair2)];
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

  // Polling fallback every 10s
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
   * FIXED-PAIR schedule generator.
   *
   * 1. Create FIXED pairs from checked-in players. Each pair stays together the ENTIRE session.
   * 2. Schedule matches between pairs following tier rules:
   *    - A pairs vs A pairs only
   *    - C pairs vs C pairs only
   *    - B pairs play cross-tier vs A or C pairs (never B vs B)
   * 3. Prevent court conflicts: no pair plays back-to-back in the schedule
   *    (since we have 2 courts, non-adjacent slots = no conflict).
   */
  const generateFullSchedule = useCallback(async (fixedPairs: FixedPair[] = []) => {
    let roster = [...state.roster];
    // Auto-check-in any locked teammates
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

    // Fetch pair history from last 2 weeks to avoid repeat pairings
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

    // Split by tier
    const tierA = shuffle(checkedIn.filter((p) => p.skillLevel === "A"));
    const tierB = shuffle(checkedIn.filter((p) => p.skillLevel === "B"));
    const tierC = shuffle(checkedIn.filter((p) => p.skillLevel === "C"));

    // ── Step 1: Create FIXED pairs ──────────────────────────────
    const createFixedPairsForTier = (players: Player[], skill: SkillTier): Pair[] => {
      const pairs: Pair[] = [];
      const used = new Set<string>();

      // First, honor any admin-set fixed pairs
      for (const fp of fixedPairs) {
        const p1 = players.find((p) => p.name.toLowerCase() === fp.player1Name.toLowerCase() && !used.has(p.id));
        const p2 = players.find((p) => p.name.toLowerCase() === fp.player2Name.toLowerCase() && !used.has(p.id));
        if (p1 && p2) {
          pairs.push({
            id: generateId(), player1: p1, player2: p2, skillLevel: skill, wins: 0, losses: 0,
          });
          used.add(p1.id);
          used.add(p2.id);
        }
      }

      // Pair remaining players, avoiding recent pairings
      const remaining = players.filter((p) => !used.has(p.id));
      const remainingUsed = new Set<string>();

      for (let i = 0; i < remaining.length; i++) {
        if (remainingUsed.has(remaining[i].id)) continue;
        const p1 = remaining[i];

        // Find best partner: prefer someone not recently paired
        let bestPartner: Player | null = null;
        for (let j = i + 1; j < remaining.length; j++) {
          if (remainingUsed.has(remaining[j].id)) continue;
          if (!wasRecentlyPaired(p1.name, remaining[j].name)) {
            bestPartner = remaining[j];
            break;
          }
        }
        // Fallback: just take the next available
        if (!bestPartner) {
          for (let j = i + 1; j < remaining.length; j++) {
            if (!remainingUsed.has(remaining[j].id)) {
              bestPartner = remaining[j];
              break;
            }
          }
        }

        if (bestPartner) {
          pairs.push({
            id: generateId(), player1: p1, player2: bestPartner, skillLevel: skill, wins: 0, losses: 0,
          });
          remainingUsed.add(p1.id);
          remainingUsed.add(bestPartner.id);
        }
        // If odd player out, they don't get a pair (sit out)
      }

      return pairs;
    };

    const aPairs = createFixedPairsForTier(tierA, "A");
    const bPairs = createFixedPairsForTier(tierB, "B");
    const cPairs = createFixedPairsForTier(tierC, "C");
    const allPairs = [...aPairs, ...bPairs, ...cPairs];

    // ── Step 2: Generate matches between fixed pairs ────────────
    const durationMin = state.sessionConfig.durationMinutes || 85;
    const minutesPerGame = 7;
    const totalSlots = Math.floor(durationMin / minutesPerGame);
    const maxGames = totalSlots * 2; // 2 courts

    // Same-tier matches: round-robin between pairs in the same tier
    const generateSameTierMatches = (pairs: Pair[], skill: SkillTier): Match[] => {
      if (pairs.length < 2) return [];
      const matches: Match[] = [];
      const label = `${skill} vs ${skill}`;
      const pairGameCount = new Map<string, number>();
      pairs.forEach((p) => pairGameCount.set(p.id, 0));
      const targetGamesPerPair = 5;

      // Generate round-robin combinations
      const combos: [Pair, Pair][] = [];
      for (let i = 0; i < pairs.length; i++) {
        for (let j = i + 1; j < pairs.length; j++) {
          combos.push([pairs[i], pairs[j]]);
        }
      }

      // Repeat combos if needed to reach target games
      let attempts = 0;
      const maxAttempts = pairs.length * targetGamesPerPair;
      let comboIdx = 0;
      const shuffledCombos = shuffle(combos);

      while (attempts < maxAttempts) {
        const [p1, p2] = shuffledCombos[comboIdx % shuffledCombos.length];
        comboIdx++;
        attempts++;

        const g1 = pairGameCount.get(p1.id) || 0;
        const g2 = pairGameCount.get(p2.id) || 0;
        if (g1 >= targetGamesPerPair && g2 >= targetGamesPerPair) continue;

        matches.push({
          id: generateId(), pair1: p1, pair2: p2, skillLevel: skill,
          matchupLabel: label, status: "pending", court: null,
        });
        pairGameCount.set(p1.id, g1 + 1);
        pairGameCount.set(p2.id, g2 + 1);

        // Check if all pairs have enough games
        const allDone = pairs.every((p) => (pairGameCount.get(p.id) || 0) >= targetGamesPerPair);
        if (allDone) break;
      }

      return matches;
    };

    // Cross-tier matches: B pairs vs A or C pairs
    const generateCrossTierMatches = (bPairsList: Pair[], oppPairs: Pair[], oppTier: SkillTier): Match[] => {
      if (bPairsList.length === 0 || oppPairs.length === 0) return [];
      const matches: Match[] = [];
      const label = `B vs ${oppTier}`;
      const targetGamesPerBPair = 3;
      const pairGameCount = new Map<string, number>();
      bPairsList.forEach((p) => pairGameCount.set(p.id, 0));

      let attempts = 0;
      const maxAttempts = bPairsList.length * targetGamesPerBPair * 2;

      while (attempts < maxAttempts) {
        attempts++;
        // Pick B pair with fewest games
        const sortedB = [...bPairsList].sort((a, b) => (pairGameCount.get(a.id) || 0) - (pairGameCount.get(b.id) || 0));
        const bPair = sortedB[0];
        if ((pairGameCount.get(bPair.id) || 0) >= targetGamesPerBPair) break;

        // Pick opponent pair (round-robin style)
        const oppIdx = (pairGameCount.get(bPair.id) || 0) % oppPairs.length;
        const oppPair = oppPairs[oppIdx];

        matches.push({
          id: generateId(), pair1: bPair, pair2: oppPair, skillLevel: "cross",
          matchupLabel: label, status: "pending", court: null,
        });
        pairGameCount.set(bPair.id, (pairGameCount.get(bPair.id) || 0) + 1);
      }

      return matches;
    };

    const aMatches = generateSameTierMatches(aPairs, "A");
    const cMatches = generateSameTierMatches(cPairs, "C");
    const bVsAMatches = generateCrossTierMatches(bPairs, aPairs, "A");
    const bVsCMatches = generateCrossTierMatches(bPairs, cPairs, "C");

    // ── Step 3: Interleave & prevent conflicts ──────────────────
    // A conflict occurs when the same pair appears in adjacent schedule slots
    // (since 2 courts run simultaneously, slots are pairs of matches: [0,1], [2,3], etc.)
    const allPoolMatches = [
      ...shuffle(aMatches),
      ...shuffle(bVsAMatches),
      ...shuffle(bVsCMatches),
      ...shuffle(cMatches),
    ];

    // Greedy conflict-free scheduling:
    // Place matches so no pair plays in two consecutive time slots
    const schedule: Match[] = [];
    const remaining = [...allPoolMatches];

    // Each "time slot" has 2 matches (one per court)
    // A pair can't appear in consecutive time slots
    while (remaining.length > 0 && schedule.length < maxGames) {
      // Determine which pairs played in the current time slot so far
      const slotStart = schedule.length % 2 === 0 ? schedule.length : schedule.length - 1;
      const currentSlotPairIds = new Set<string>();
      for (let i = slotStart; i < schedule.length; i++) {
        currentSlotPairIds.add(schedule[i].pair1.id);
        currentSlotPairIds.add(schedule[i].pair2.id);
      }

      // Also get pairs from previous time slot (for back-to-back prevention)
      const prevSlotPairIds = new Set<string>();
      if (slotStart >= 2) {
        for (let i = slotStart - 2; i < slotStart; i++) {
          if (schedule[i]) {
            prevSlotPairIds.add(schedule[i].pair1.id);
            prevSlotPairIds.add(schedule[i].pair2.id);
          }
        }
      }

      // Find a match where neither pair is in the current or previous slot
      let bestIdx = -1;
      for (let i = 0; i < remaining.length; i++) {
        const m = remaining[i];
        const p1 = m.pair1.id;
        const p2 = m.pair2.id;
        if (!currentSlotPairIds.has(p1) && !currentSlotPairIds.has(p2) &&
            !prevSlotPairIds.has(p1) && !prevSlotPairIds.has(p2)) {
          bestIdx = i;
          break;
        }
      }

      // Fallback: find match that at least doesn't conflict with current slot
      if (bestIdx === -1) {
        for (let i = 0; i < remaining.length; i++) {
          const m = remaining[i];
          if (!currentSlotPairIds.has(m.pair1.id) && !currentSlotPairIds.has(m.pair2.id)) {
            bestIdx = i;
            break;
          }
        }
      }

      // Last resort: just take the first match
      if (bestIdx === -1) {
        bestIdx = 0;
      }

      schedule.push(remaining.splice(bestIdx, 1)[0]);
    }

    // ── Push VIP matches out of first 2 slots ───────────────────
    for (let i = 0; i < Math.min(2, schedule.length); i++) {
      if (matchHasVip(schedule[i])) {
        const swapIdx = schedule.findIndex((m, idx) => idx > 1 && !matchHasVip(m));
        if (swapIdx !== -1) {
          [schedule[i], schedule[swapIdx]] = [schedule[swapIdx], schedule[i]];
        }
      }
    }

    // Number games
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
   * Add late-arriving players into the existing schedule (creates new fixed pairs).
   */
  const addLatePlayersToSchedule = useCallback(() => {
    updateState((s) => {
      if (s.matches.length === 0) return s;

      const scheduledPlayerIds = new Set<string>();
      s.pairs.forEach((p) => {
        scheduledPlayerIds.add(p.player1.id);
        scheduledPlayerIds.add(p.player2.id);
      });

      const latePlayers = s.roster.filter((p) => p.checkedIn && !scheduledPlayerIds.has(p.id));
      if (latePlayers.length < 2) return s; // Need at least 2 to form a pair

      // Create new fixed pairs from late players
      const newPairs: Pair[] = [];
      for (let i = 0; i < latePlayers.length - 1; i += 2) {
        const skill = latePlayers[i].skillLevel; // Use first player's tier
        newPairs.push({
          id: generateId(),
          player1: latePlayers[i],
          player2: latePlayers[i + 1],
          skillLevel: skill,
          wins: 0, losses: 0,
        });
      }

      if (newPairs.length === 0) return s;

      // Generate matches for new pairs against existing pairs of matching tier
      const newMatches: Match[] = [];
      let gameNum = s.totalScheduledGames;

      for (const newPair of newPairs) {
        const skill = newPair.skillLevel;
        // Find existing pairs of same tier (or cross-tier for B)
        let opponents: Pair[];
        if (skill === "B") {
          opponents = s.pairs.filter((p) => p.skillLevel === "A" || p.skillLevel === "C");
        } else {
          opponents = s.pairs.filter((p) => p.skillLevel === skill);
        }

        const targetGames = 3;
        for (let g = 0; g < Math.min(targetGames, opponents.length); g++) {
          const opp = opponents[g % opponents.length];
          const matchSkill = skill === "B" || opp.skillLevel !== skill ? "cross" as const : skill;
          const label = skill === "B" ? `B vs ${opp.skillLevel}` : `${skill} vs ${skill}`;
          gameNum++;
          newMatches.push({
            id: generateId(), pair1: newPair, pair2: opp, skillLevel: matchSkill,
            matchupLabel: label, status: "pending", court: null, gameNumber: gameNum,
          });
        }
      }

      if (newMatches.length === 0) return s;

      return {
        ...s,
        pairs: [...s.pairs, ...newPairs],
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

        // Find next pending match that doesn't conflict with the other court
        if (freedCourt) {
          const otherCourtMatch = updatedMatches.find(
            (m) => m.status === "playing" && m.court !== freedCourt
          );
          const otherPairIds = new Set<string>();
          if (otherCourtMatch) {
            otherPairIds.add(otherCourtMatch.pair1.id);
            otherPairIds.add(otherCourtMatch.pair2.id);
          }

          const nextPending = updatedMatches.find(
            (m) => m.status === "pending" &&
            !otherPairIds.has(m.pair1.id) && !otherPairIds.has(m.pair2.id)
          );
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

  // Swap a player in a pending match (replaces within the pair)
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

  // Complete match — picks next match avoiding pair conflicts
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

        // Find next pending match that doesn't conflict with the other court
        if (freedCourt) {
          const otherCourtMatch = updatedMatches.find(
            (m) => m.status === "playing" && m.court !== freedCourt
          );
          const otherPairIds = new Set<string>();
          if (otherCourtMatch) {
            otherPairIds.add(otherCourtMatch.pair1.id);
            otherPairIds.add(otherCourtMatch.pair2.id);
          }

          const nextPending = updatedMatches.find(
            (m) => m.status === "pending" &&
            !otherPairIds.has(m.pair1.id) && !otherPairIds.has(m.pair2.id)
          );
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

  const startPlayoffs = useCallback(() => {
    updateState((s) => ({ ...s, playoffsStarted: true }));
  }, [updateState]);

  // Remove player mid-session
  const removePlayerMidSession = useCallback(
    (playerId: string) => {
      updateState((s) => {
        const player = s.roster.find((p) => p.id === playerId);
        if (!player) return s;

        const updatedRoster = s.roster.map((p) =>
          p.id === playerId ? { ...p, checkedIn: false } : p
        );

        // Remove all pending matches that include this player's pair
        const playerPairIds = new Set<string>();
        s.pairs.forEach((pair) => {
          if (pair.player1.id === playerId || pair.player2.id === playerId) {
            playerPairIds.add(pair.id);
          }
        });

        const updatedMatches = s.matches.filter((m) => {
          if (m.status !== "pending") return true;
          return !playerPairIds.has(m.pair1.id) && !playerPairIds.has(m.pair2.id);
        });

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

  // Correct a game result
  const correctGameResult = useCallback(
    (matchId: string, newWinnerPairId: string) => {
      updateState((s) => {
        const matchIdx = s.matches.findIndex((m) => m.id === matchId);
        if (matchIdx === -1) return s;
        const match = s.matches[matchIdx];
        if (match.status !== "completed" || !match.winner || !match.loser) return s;
        if (match.winner.id === newWinnerPairId) return s;

        const newWinner = match.pair1.id === newWinnerPairId ? match.pair1 : match.pair2;
        const newLoser = match.pair1.id === newWinnerPairId ? match.pair2 : match.pair1;
        const oldWinnerIds = [match.winner.player1.id, match.winner.player2.id];
        const oldLoserIds = [match.loser.player1.id, match.loser.player2.id];

        const updatedRoster = s.roster.map((p) => {
          let { wins, losses } = p;
          if (oldWinnerIds.includes(p.id)) { wins--; losses++; }
          if (oldLoserIds.includes(p.id)) { losses--; wins++; }
          return { ...p, wins: Math.max(0, wins), losses: Math.max(0, losses) };
        });

        const updatedMatches = [...s.matches];
        updatedMatches[matchIdx] = { ...match, winner: newWinner, loser: newLoser };

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

  // Playoff management — uses FIXED PAIRS, not individual players
  const generatePlayoffMatches = useCallback(
    (seeds: { seed: number; pair: Pair; winPct: number }[]) => {
      if (seeds.length < 2) return;
      const matches: PlayoffMatch[] = [];

      // NBA-style bracket: #1 vs #last, #2 vs #second-last, etc.
      const numMatches = Math.floor(seeds.length / 2);
      for (let i = 0; i < numMatches; i++) {
        const s1 = seeds[i];
        const s2 = seeds[seeds.length - 1 - i];
        if (!s1 || !s2) continue;

        matches.push({
          id: generateId(), round: 1, seed1: s1.seed, seed2: s2.seed,
          pair1: s1.pair, pair2: s2.pair, status: "pending",
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

  const playingPlayerIds = playingMatches.flatMap((m) => getMatchPlayerIds(m));
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
