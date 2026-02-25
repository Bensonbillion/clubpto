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

/** Single source of truth: push master pairs into every match reference */
function syncPairsToMatches(pairs: Pair[], matches: Match[]): Match[] {
  const pairMap = new Map(pairs.map(p => [p.id, p]));
  return matches.map(m => ({
    ...m,
    pair1: pairMap.get(m.pair1.id) || m.pair1,
    pair2: pairMap.get(m.pair2.id) || m.pair2,
    // Also sync winner/loser references for completed matches
    ...(m.winner ? { winner: pairMap.get(m.winner.id) || m.winner } : {}),
    ...(m.loser ? { loser: pairMap.get(m.loser.id) || m.loser } : {}),
  }));
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

  // Subscribe to realtime changes — skip if a save is in progress
  useEffect(() => {
    const channel = supabase
      .channel("game_state_sync")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_state", filter: `id=eq.${ROW_ID}` },
        (payload) => {
          if (savingRef.current) return;
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

  // Polling fallback every 10s — skip if a save is in progress
  useEffect(() => {
    const interval = setInterval(async () => {
      if (savingRef.current) return;
      const { data } = await supabase
        .from("game_state")
        .select("state")
        .eq("id", ROW_ID)
        .single();
      if (data?.state && !savingRef.current) {
        setState(data.state as unknown as GameState);
      }
    }, 10_000);
    return () => clearInterval(interval);
  }, []);

  const persistState = useCallback(async (newState: GameState) => {
    pendingRef.current = newState;
    if (savingRef.current) return;
    savingRef.current = true;

    while (pendingRef.current) {
      const toSave = pendingRef.current;
      pendingRef.current = null;
      await supabase
        .from("game_state")
        .upsert({ id: ROW_ID, state: JSON.parse(JSON.stringify(toSave)), updated_at: new Date().toISOString() });
    }

    savingRef.current = false;
  }, []);

  const updateState = useCallback(
    (updater: (prev: GameState) => GameState) => {
      savingRef.current = true; // Guard realtime/polling immediately
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

    // ── Step 2: Generate ALL unique matchups ──────────────────
    const durationMin = state.sessionConfig.durationMinutes || 85;
    const minutesPerGame = 7;
    const totalSlots = Math.floor(durationMin / minutesPerGame);
    const maxGames = totalSlots * 2; // 2 courts
    const TARGET_GAMES_PER_PAIR = 4;

    // Helper: get all player IDs from a match
    const matchPlayerIds = (m: { pair1: Pair; pair2: Pair }) => [
      m.pair1.player1.id, m.pair1.player2.id,
      m.pair2.player1.id, m.pair2.player2.id,
    ];

    // Helper: canonical matchup key (pair vs pair, order-independent)
    const matchupKey = (p1Id: string, p2Id: string) =>
      [p1Id, p2Id].sort().join("|||");

    // Generate all unique pair-vs-pair matchups for allowed tier rules
    type CandidateMatch = { pair1: Pair; pair2: Pair; skillLevel: SkillTier | "cross"; matchupLabel: string };
    const allCandidates: CandidateMatch[] = [];

    // A vs A
    for (let i = 0; i < aPairs.length; i++) {
      for (let j = i + 1; j < aPairs.length; j++) {
        allCandidates.push({ pair1: aPairs[i], pair2: aPairs[j], skillLevel: "A", matchupLabel: "A vs A" });
      }
    }
    // C vs C
    for (let i = 0; i < cPairs.length; i++) {
      for (let j = i + 1; j < cPairs.length; j++) {
        allCandidates.push({ pair1: cPairs[i], pair2: cPairs[j], skillLevel: "C", matchupLabel: "C vs C" });
      }
    }
    // B vs A (cross)
    for (const bp of bPairs) {
      for (const ap of aPairs) {
        allCandidates.push({ pair1: bp, pair2: ap, skillLevel: "cross", matchupLabel: "B vs A" });
      }
    }
    // B vs C (cross)
    for (const bp of bPairs) {
      for (const cp of cPairs) {
        allCandidates.push({ pair1: bp, pair2: cp, skillLevel: "cross", matchupLabel: "B vs C" });
      }
    }

    // ── Step 3: Schedule into time slots with strict constraints ──
    // Each time slot = 2 games (Court 1 + Court 2)
    // HARD RULES:
    //   1. No player appears in both games of the same slot
    //   2. No player appears in slot N if they were in slot N-1 or N-2
    //   3. No duplicate matchups (same pair vs pair) in entire schedule
    //   4. Max TARGET_GAMES_PER_PAIR games per pair

    const schedule: Match[] = [];
    const usedMatchups = new Set<string>(); // track pair-vs-pair combos used
    const pairGameCount = new Map<string, number>();
    allPairs.forEach((p) => pairGameCount.set(p.id, 0));

    // Build candidate pool — shuffle for variety
    let candidatePool = shuffle([...allCandidates]);

    // Get player IDs in slots for conflict checking
    const getSlotPlayerIds = (slotIndex: number): Set<string> => {
      const ids = new Set<string>();
      const base = slotIndex * 2;
      for (let i = base; i < base + 2 && i < schedule.length; i++) {
        matchPlayerIds(schedule[i]).forEach((id) => ids.add(id));
      }
      return ids;
    };

    const REST_GAP = 2; // Players must rest for at least 2 slots after playing

    for (let slot = 0; slot < totalSlots; slot++) {
      // Collect blocked player IDs from previous REST_GAP slots
      const blockedPlayerIds = new Set<string>();
      for (let prev = Math.max(0, slot - REST_GAP); prev < slot; prev++) {
        getSlotPlayerIds(prev).forEach((id) => blockedPlayerIds.add(id));
      }

      // We need to pick 2 games for this slot with 8 completely different players
      const slotGames: Match[] = [];
      const slotPlayerIds = new Set<string>();

      for (let courtIdx = 0; courtIdx < 2; courtIdx++) {
        // Find best candidate
        let bestIdx = -1;
        let bestScore = Infinity;

        for (let i = 0; i < candidatePool.length; i++) {
          const c = candidatePool[i];
          const mKey = matchupKey(c.pair1.id, c.pair2.id);

          // Rule 3: no duplicate matchups
          if (usedMatchups.has(mKey)) continue;

          // Rule 4: respect per-pair game cap
          const g1 = pairGameCount.get(c.pair1.id) || 0;
          const g2 = pairGameCount.get(c.pair2.id) || 0;
          if (g1 >= TARGET_GAMES_PER_PAIR || g2 >= TARGET_GAMES_PER_PAIR) continue;

          const playerIds = matchPlayerIds(c);

          // Rule 1: no player overlap within this slot
          if (playerIds.some((id) => slotPlayerIds.has(id))) continue;

          // Rule 2: no player from recent slots
          if (playerIds.some((id) => blockedPlayerIds.has(id))) continue;

          // Score: prioritize pairs with fewer games (balance play time)
          const score = g1 + g2;
          if (score < bestScore) {
            bestScore = score;
            bestIdx = i;
          }
        }

        if (bestIdx === -1) continue; // No valid match for this court in this slot

        const chosen = candidatePool.splice(bestIdx, 1)[0];
        const mKey = matchupKey(chosen.pair1.id, chosen.pair2.id);
        usedMatchups.add(mKey);
        pairGameCount.set(chosen.pair1.id, (pairGameCount.get(chosen.pair1.id) || 0) + 1);
        pairGameCount.set(chosen.pair2.id, (pairGameCount.get(chosen.pair2.id) || 0) + 1);

        matchPlayerIds(chosen).forEach((id) => slotPlayerIds.add(id));

        const match: Match = {
          id: generateId(),
          pair1: chosen.pair1,
          pair2: chosen.pair2,
          skillLevel: chosen.skillLevel,
          matchupLabel: chosen.matchupLabel,
          status: "pending",
          court: null,
        };
        slotGames.push(match);
      }

      schedule.push(...slotGames);
    }

    // ── Validation pass ─────────────────────────────────────────
    // Check all constraints; log violations (should be zero with the above logic)
    const violations: string[] = [];
    for (let slot = 0; slot < totalSlots; slot++) {
      const base = slot * 2;
      const g1 = schedule[base];
      const g2 = schedule[base + 1];
      if (g1 && g2) {
        const ids1 = new Set(matchPlayerIds(g1));
        const ids2 = matchPlayerIds(g2);
        for (const id of ids2) {
          if (ids1.has(id)) violations.push(`Slot ${slot + 1}: player ${id} on both courts`);
        }
      }
    }
    if (violations.length > 0) {
      console.error("Schedule violations found:", violations);
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

  // Swap a player GLOBALLY — updates master pairs + syncs to all matches
  const swapPlayer = useCallback(
    (matchId: string, oldPlayerId: string, newPlayerId: string) => {
      updateState((s) => {
        const match = s.matches.find((m) => m.id === matchId);
        if (!match || match.status !== "pending") return s;
        const newPlayer = s.roster.find((p) => p.id === newPlayerId);
        if (!newPlayer) return s;

        // Find which pair contains the old player
        const targetPairId = [match.pair1, match.pair2].find(
          (p) => p.player1.id === oldPlayerId || p.player2.id === oldPlayerId
        )?.id;
        if (!targetPairId) return s;

        // Update the master pairs list
        const updatedPairs = s.pairs.map((pair) => {
          if (pair.id !== targetPairId) return pair;
          if (pair.player1.id === oldPlayerId) return { ...pair, player1: newPlayer };
          if (pair.player2.id === oldPlayerId) return { ...pair, player2: newPlayer };
          return pair;
        });

        // Sync all matches to use updated pairs
        const updatedMatches = syncPairsToMatches(updatedPairs, s.matches);

        return { ...s, pairs: updatedPairs, matches: updatedMatches };
      });
    },
    [updateState]
  );

  // Complete match — updates pair W/L + picks next match avoiding conflicts
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

        // Update pair-level W/L on master pairs
        const updatedPairs = s.pairs.map((p) => {
          if (p.id === winnerPair.id) return { ...p, wins: p.wins + 1 };
          if (p.id === loserPair.id) return { ...p, losses: p.losses + 1 };
          return p;
        });

        let updatedMatches = [...s.matches];
        updatedMatches[matchIdx] = {
          ...match, status: "completed", winner: winnerPair, loser: loserPair, completedAt: new Date().toISOString(),
        };

        // Sync pairs into all matches
        updatedMatches = syncPairsToMatches(updatedPairs, updatedMatches);

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
          pairs: updatedPairs,
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
    updateState(() => ({ ...DEFAULT_STATE, playoffMatches: [], playoffsStarted: false }));
  }, [updateState]);

  const startPlayoffs = useCallback(() => {
    updateState((s) => {
      // Build pair standings from completed matches
      const pairMap = new Map<string, { pair: Pair; wins: number; losses: number; gamesPlayed: number; winPct: number }>();
      for (const match of s.matches.filter((m) => m.status === "completed")) {
        const processPair = (pair: Pair, won: boolean) => {
          const key = [pair.player1.id, pair.player2.id].sort().join("|||");
          if (!pairMap.has(key)) {
            pairMap.set(key, { pair, wins: 0, losses: 0, gamesPlayed: 0, winPct: 0 });
          }
          const st = pairMap.get(key)!;
          st.gamesPlayed++;
          if (won) st.wins++;
          else st.losses++;
          st.winPct = st.gamesPlayed > 0 ? st.wins / st.gamesPlayed : 0;
        };
        if (match.winner && match.loser) {
          processPair(match.winner, true);
          processPair(match.loser, false);
        }
      }

      // B-beats-A and C-beats-B overrides
      const bBeatAPairIds = new Set<string>();
      const cBeatBPairIds = new Set<string>();
      for (const match of s.matches) {
        if (match.status !== "completed" || match.skillLevel !== "cross" || !match.winner || !match.loser) continue;
        if (match.winner.skillLevel === "B" && match.loser.skillLevel === "A") {
          bBeatAPairIds.add([match.winner.player1.id, match.winner.player2.id].sort().join("|||"));
        }
        if (match.winner.skillLevel === "C" && match.loser.skillLevel === "B") {
          cBeatBPairIds.add([match.winner.player1.id, match.winner.player2.id].sort().join("|||"));
        }
      }

      const allStandings = Array.from(pairMap.entries()).map(([key, v]) => ({ key, ...v }));
      const byTier = (tier: SkillTier) => allStandings.filter((p) => p.pair.skillLevel === tier).sort((a, b) => b.winPct !== a.winPct ? b.winPct - a.winPct : b.wins - a.wins);

      const aPairs = byTier("A");
      const bPairsAll = byTier("B");
      const cPairsAll = byTier("C");
      const promotedB = bPairsAll.filter((p) => bBeatAPairIds.has(p.key));
      const normalB = bPairsAll.filter((p) => !bBeatAPairIds.has(p.key));
      const promotedC = cPairsAll.filter((p) => cBeatBPairIds.has(p.key));
      const normalC = cPairsAll.filter((p) => !cBeatBPairIds.has(p.key));

      const ordered = [...aPairs, ...promotedB, ...normalB, ...promotedC, ...normalC];
      const top = ordered.slice(0, 8);

      if (top.length < 2) return { ...s, playoffsStarted: true };

      // Generate bracket
      const seeds = top.map((ps, i) => ({ seed: i + 1, pair: ps.pair, winPct: ps.winPct }));
      const playoffMatches: PlayoffMatch[] = [];
      const numMatches = Math.floor(seeds.length / 2);
      for (let i = 0; i < numMatches; i++) {
        const s1 = seeds[i];
        const s2 = seeds[seeds.length - 1 - i];
        if (!s1 || !s2) continue;
        playoffMatches.push({
          id: generateId(), round: 1, seed1: s1.seed, seed2: s2.seed,
          pair1: s1.pair, pair2: s2.pair, status: "pending",
        });
      }

      // Auto-assign first 2 QF matches to courts (no player overlap)
      const assignedPlayerIds = new Set<string>();
      let courtNum = 1;
      for (const pm of playoffMatches) {
        if (courtNum > 2) break;
        if (!pm.pair1 || !pm.pair2) continue;
        const ids = [pm.pair1.player1.id, pm.pair1.player2.id, pm.pair2.player1.id, pm.pair2.player2.id];
        if (ids.some((id) => assignedPlayerIds.has(id))) continue;
        ids.forEach((id) => assignedPlayerIds.add(id));
        pm.status = "playing";
        (pm as any).court = courtNum;
        courtNum++;
      }

      return { ...s, playoffsStarted: true, playoffMatches };
    });
  }, [updateState]);

  // Remove player mid-session — also removes their pair and syncs
  const removePlayerMidSession = useCallback(
    (playerId: string) => {
      updateState((s) => {
        const player = s.roster.find((p) => p.id === playerId);
        if (!player) return s;

        const updatedRoster = s.roster.map((p) =>
          p.id === playerId ? { ...p, checkedIn: false } : p
        );

        // Find and remove pairs containing this player
        const playerPairIds = new Set<string>();
        s.pairs.forEach((pair) => {
          if (pair.player1.id === playerId || pair.player2.id === playerId) {
            playerPairIds.add(pair.id);
          }
        });

        const updatedPairs = s.pairs.filter((p) => !playerPairIds.has(p.id));

        // Remove all pending matches that include this player's pair
        let updatedMatches = s.matches.filter((m) => {
          if (m.status !== "pending") return true;
          return !playerPairIds.has(m.pair1.id) && !playerPairIds.has(m.pair2.id);
        });

        // Sync remaining pairs
        updatedMatches = syncPairsToMatches(updatedPairs, updatedMatches);
        updatedMatches.forEach((m, i) => { m.gameNumber = i + 1; });

        return {
          ...s,
          roster: updatedRoster,
          pairs: updatedPairs,
          matches: updatedMatches,
          totalScheduledGames: updatedMatches.length,
        };
      });
    },
    [updateState]
  );

  // Correct a game result — updates both player and pair stats, then syncs
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

        // Reverse old pair stats + apply new
        const updatedPairs = s.pairs.map((p) => {
          if (p.id === match.winner!.id) {
            // Was winner, now loser
            return { ...p, wins: Math.max(0, p.wins - 1), losses: p.losses + 1 };
          }
          if (p.id === match.loser!.id) {
            // Was loser, now winner
            return { ...p, losses: Math.max(0, p.losses - 1), wins: p.wins + 1 };
          }
          return p;
        });

        let updatedMatches = [...s.matches];
        updatedMatches[matchIdx] = { ...match, winner: newWinner, loser: newLoser };
        updatedMatches = syncPairsToMatches(updatedPairs, updatedMatches);

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

        return { ...s, roster: updatedRoster, pairs: updatedPairs, matches: updatedMatches, gameHistory: updatedHistory };
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
      updateState((s) => {
        // Don't start if a round-robin match is still playing on this court
        const courtBusy = s.matches.some((m) => m.court === court && m.status === "playing");
        if (courtBusy) return s;
        return {
          ...s,
          playoffMatches: s.playoffMatches.map((m) =>
            m.id === matchId ? { ...m, status: "playing" as const } : m
          ),
        };
      });
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
        const freedCourt = (pm as any).court || null;
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

        // Auto-assign next pending playoff match to the freed court
        if (freedCourt) {
          const playingPlayerIds = new Set<string>();
          updated.filter((m) => m.status === "playing").forEach((m) => {
            if (m.pair1) [m.pair1.player1.id, m.pair1.player2.id].forEach((id) => playingPlayerIds.add(id));
            if (m.pair2) [m.pair2.player1.id, m.pair2.player2.id].forEach((id) => playingPlayerIds.add(id));
          });

          const nextPending = updated.find((m) => {
            if (m.status !== "pending" || !m.pair1 || !m.pair2) return false;
            const ids = [m.pair1.player1.id, m.pair1.player2.id, m.pair2.player1.id, m.pair2.player2.id];
            return !ids.some((id) => playingPlayerIds.has(id));
          });

          if (nextPending) {
            nextPending.status = "playing";
            (nextPending as any).court = freedCourt;
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
