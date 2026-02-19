import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GameState, DEFAULT_STATE, Player, Pair, Match, GameHistory, PlayoffMatch, FixedPair } from "@/types/courtManager";

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
    (name: string, skillLevel: "beginner" | "good"): boolean => {
      let added = false;
      updateState((s) => {
        // Duplicate name check (case-insensitive)
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
    (skillLevel: "beginner" | "good") => {
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
  const generateFullSchedule = useCallback(async (fixedPairs: FixedPair[] = []) => {
    // Auto-check-in any locked teammates who haven't checked in yet
    let roster = [...state.roster];
    const autoCheckInIds: string[] = [];
    fixedPairs.forEach((fp) => {
      const teammate = roster.find(
        (p) => p.name.toLowerCase() === fp.player2Name.toLowerCase() && !p.checkedIn
      );
      if (teammate) {
        autoCheckInIds.push(teammate.id);
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
    const goodPlayers = shuffle(checkedIn.filter((p) => p.skillLevel === "good"));
    const beginnerPlayers = shuffle(checkedIn.filter((p) => p.skillLevel === "beginner"));

    const durationMin = state.sessionConfig.durationMinutes || 85;
    const minutesPerGame = 7;
    const gamesPerCourt = Math.floor(durationMin / minutesPerGame);
    const totalSlots = gamesPerCourt; // time slots (2 courts run simultaneously per slot)

    // --- Generate matches for a single skill pool ---
    const generatePoolMatches = (
      players: Player[],
      skill: "beginner" | "good",
      lockedPairs: FixedPair[]
    ): Match[] => {
      if (players.length < 4) return [];

      // Identify locked pairs within this pool
      const resolvedLocked: [Player, Player][] = [];
      lockedPairs.forEach((fp) => {
        const p1 = players.find((p) => p.name.toLowerCase() === fp.player1Name.toLowerCase());
        const p2 = players.find((p) => p.name.toLowerCase() === fp.player2Name.toLowerCase());
        if (p1 && p2) resolvedLocked.push([p1, p2]);
      });

      const gameCount = new Map<string, number>();
      const lastPlayedSlot = new Map<string, number>();
      const consecutiveSitOut = new Map<string, number>();
      players.forEach((p) => {
        gameCount.set(p.id, 0);
        lastPlayedSlot.set(p.id, -99);
        consecutiveSitOut.set(p.id, 0);
      });

      const matches: Match[] = [];
      const targetGamesPerPlayer = 5;
      const maxMatches = Math.ceil((players.length * targetGamesPerPlayer) / 4);

      // Track used pair keys to avoid identical pairings in consecutive matches
      const usedPairKeys = new Set<string>();
      const makePairKey = (a: string, b: string) => [a, b].sort().join("|||");
      const makeMatchKey = (p1Id: string, p2Id: string, p3Id: string, p4Id: string) => {
        const team1 = makePairKey(p1Id, p2Id);
        const team2 = makePairKey(p3Id, p4Id);
        return [team1, team2].sort().join("---");
      };

      for (let m = 0; m < maxMatches; m++) {
        const sorted = [...players].sort((a, b) => {
          const ga = gameCount.get(a.id) || 0;
          const gb = gameCount.get(b.id) || 0;
          if (ga !== gb) return ga - gb;
          const sa = consecutiveSitOut.get(a.id) || 0;
          const sb = consecutiveSitOut.get(b.id) || 0;
          return sb - sa;
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

        // Check if any locked pair members are in the four — if so, ensure they're paired together
        let p1: Player, p2: Player, p3: Player, p4: Player;

        const lockedInFour = resolvedLocked.find(
          ([a, b]) => four!.some((p) => p.id === a.id) && four!.some((p) => p.id === b.id)
        );

        if (lockedInFour) {
          // Force the locked pair together
          p1 = lockedInFour[0];
          p2 = lockedInFour[1];
          const remaining = four.filter((p) => p.id !== p1.id && p.id !== p2.id);
          p3 = remaining[0];
          p4 = remaining[1];
        } else if (resolvedLocked.length > 0) {
          // A locked pair member is in four but not both — try to bring their partner in
          const partialLock = resolvedLocked.find(
            ([a, b]) => four!.some((p) => p.id === a.id) || four!.some((p) => p.id === b.id)
          );
          if (partialLock) {
            const inFour = four.find((p) => p.id === partialLock[0].id || p.id === partialLock[1].id)!;
            const partner = partialLock[0].id === inFour.id ? partialLock[1] : partialLock[0];
            // Swap the last non-locked player for the partner
            const others = four.filter((p) => p.id !== inFour.id);
            if (others.length >= 3) {
              others[others.length - 1] = partner; // replace least priority
            }
            p1 = inFour;
            p2 = partner;
            const remaining = others.filter((p) => p.id !== partner.id).slice(0, 2);
            if (remaining.length < 2) {
              // Fallback to default
              p1 = four[0];
              const partnerCandidates = four.slice(1);
              const bestPartner = partnerCandidates.find((c) => !wasRecentlyPaired(p1.name, c.name)) || partnerCandidates[0];
              p2 = bestPartner;
              const rest = four.filter((p) => p.id !== p1.id && p.id !== p2.id);
              p3 = rest[0];
              p4 = rest[1];
            } else {
              p3 = remaining[0];
              p4 = remaining[1];
            }
          } else {
            // Default pairing
            p1 = four[0];
            const partnerCandidates = four.slice(1);
            const bestPartner = partnerCandidates.find((c) => !wasRecentlyPaired(p1.name, c.name)) || partnerCandidates[0];
            p2 = bestPartner;
            const remaining = four.filter((p) => p.id !== p1.id && p.id !== p2.id);
            p3 = remaining[0];
            p4 = remaining[1];
          }
        } else {
          // No locked pairs — default logic
          p1 = four[0];
          const partnerCandidates = four.slice(1);
          const bestPartner = partnerCandidates.find((c) => !wasRecentlyPaired(p1.name, c.name)) || partnerCandidates[0];
          p2 = bestPartner;
          const remaining = four.filter((p) => p.id !== p1.id && p.id !== p2.id);
          p3 = remaining[0];
          p4 = remaining[1];
        }

        // Check if this exact pairing was already used — if so, rotate teammates
        let matchKey = makeMatchKey(p1.id, p2.id, p3.id, p4.id);
        if (usedPairKeys.has(matchKey) && !lockedInFour) {
          // Try alternative pairings: (0,2 vs 1,3) and (0,3 vs 1,2)
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

        four.forEach((p) => {
          gameCount.set(p.id, (gameCount.get(p.id) || 0) + 1);
        });
      }

      return matches;
    };

    const goodMatches = generatePoolMatches(goodPlayers, "good", fixedPairs);
    const beginnerMatches = generatePoolMatches(beginnerPlayers, "beginner", fixedPairs);

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

    // --- Push VIP matches out of the first 2 slots ---
    // VIPs should not play in game 1 or 2 so they can onboard beginners
    for (let i = 0; i < Math.min(2, schedule.length); i++) {
      if (matchHasVip(schedule[i])) {
        // Find the first non-VIP match after position 1
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
      roster: roster, // persist auto-check-ins
      pairs: allPairs,
      matches: schedule,
      totalScheduledGames: schedule.length,
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

  // Skip a playing match — move it back to pending at end of queue, pull next match onto freed court
  const skipMatch = useCallback(
    (matchId: string) => {
      updateState((s) => {
        const matchIdx = s.matches.findIndex((m) => m.id === matchId);
        if (matchIdx === -1) return s;
        const match = s.matches[matchIdx];
        if (match.status !== "playing") return s;

        const freedCourt = match.court;
        const updatedMatches = [...s.matches];

        // Reset the skipped match to pending and remove court/timing
        updatedMatches[matchIdx] = {
          ...match,
          status: "pending",
          court: null,
          startedAt: undefined,
        };

        // Move it to end of the list
        const [skipped] = updatedMatches.splice(matchIdx, 1);
        updatedMatches.push(skipped);

        // Pull the next pending match onto the freed court
        if (freedCourt) {
          const nextPending = updatedMatches.find((m) => m.status === "pending");
          if (nextPending) {
            nextPending.status = "playing";
            nextPending.court = freedCourt;
            nextPending.startedAt = new Date().toISOString();
          }
        }

        // Re-number game numbers
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

  const setFixedPairs = useCallback(
    (pairs: FixedPair[]) => {
      updateState((s) => ({ ...s, fixedPairs: pairs }));
    },
    [updateState]
  );

  const startSession = useCallback(() => {
    updateState((s) => ({ ...s, sessionStarted: true }));
  }, [updateState]);

  const resetSession = useCallback(() => {
    const fresh = { ...DEFAULT_STATE, playoffMatches: [] };
    setState(fresh);
    persistState(fresh);
  }, [persistState]);

  // Playoff management
  const generatePlayoffMatches = useCallback(
    (seeds: { seed: number; player: Player; winPct: number }[]) => {
      if (seeds.length < 4) return;
      const matches: PlayoffMatch[] = [];
      // Build first-round matches: seed 1&last vs seed 2&(last-1), etc.
      const numMatches = Math.floor(seeds.length / 4);
      for (let i = 0; i < numMatches; i++) {
        const s1 = seeds[i * 2];
        const s2 = seeds[seeds.length - 1 - i * 2];
        const s3 = seeds[i * 2 + 1];
        const s4 = seeds[seeds.length - 2 - i * 2];
        if (!s1 || !s2 || !s3 || !s4) continue;
        const pair1: Pair = {
          id: generateId(), player1: s1.player, player2: s2.player,
          skillLevel: "good", wins: 0, losses: 0,
        };
        const pair2: Pair = {
          id: generateId(), player1: s3.player, player2: s4.player,
          skillLevel: "good", wins: 0, losses: 0,
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
        // Also clear the court of any round-robin match
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
        
        // Check if all current round matches are complete — generate next round
        const currentRound = pm.round;
        const roundMatches = updated.filter((m) => m.round === currentRound);
        const allComplete = roundMatches.every((m) => m.status === "completed");
        
        if (allComplete) {
          const winners = roundMatches.map((m) => m.winner).filter(Boolean) as Pair[];
          if (winners.length >= 2) {
            // Generate next round
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

  // "Up Next" = first 2 pending (going on court next)
  const upNextMatches = pendingMatches.slice(0, 2);
  // "On Deck" = the 2 matches AFTER "Up Next" (so those players can get ready)
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
