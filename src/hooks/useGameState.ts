import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { query } from "@/lib/turso";
import { GameState, DEFAULT_STATE, Player, Pair, Match, GameHistory, PlayoffMatch, FixedPair, SkillTier, OddPlayerDecision } from "@/types/courtManager";
import { awardPoints, type PointsReason } from "@/lib/leaderboard";
import { isSimulationMode, setSimulationMode } from "@/lib/simulationMode";

const VIP_PROFILE_IDS = new Set([
  "08813d60dccf0067907caf3727077d20", // David
  "040263dd01d6128b0df59406d4f9d9e0", // Benson
  "79acebd959da20272f79bfd96f8af281", // Albright
]);
function isVip(name: string, profileId?: string) { return profileId ? VIP_PROFILE_IDS.has(profileId) : false; }
function matchHasVip(m: Match): boolean {
  return [m.pair1.player1, m.pair1.player2, m.pair2.player1, m.pair2.player2].some(p => isVip(p.name, p.profileId));
}

const ROW_ID = "current";

// ─── Realtime Diagnostics ─────────────────────────────────────────────
const DEVICE_ID = (() => {
  try {
    let id = localStorage.getItem("clubpto_deviceId");
    if (!id) {
      id = `device-${Math.random().toString(36).substring(2, 11)}`;
      localStorage.setItem("clubpto_deviceId", id);
    }
    return id;
  } catch {
    return `device-${Math.random().toString(36).substring(2, 11)}`;
  }
})();
console.log(`🆔 [PTO] Device ID: ${DEVICE_ID}`);
// ──────────────────────────────────────────────────────────────────────

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

function isCrossCohort(matchupLabel?: string): boolean {
  return matchupLabel === "B vs A" || matchupLabel === "B vs C" ||
         matchupLabel === "A vs B" || matchupLabel === "C vs B";
}

/** Returns true if two tiers are forbidden from playing each other (A vs C). */
function isForbiddenMatchup(tier1: SkillTier, tier2: SkillTier): boolean {
  const sorted = [tier1, tier2].sort().join("");
  return sorted === "AC";
}

/** Court pool for a match based on tiers.
 *  3-court mode: each tier has its own court (A=Court3, B=Court2, C=Court1).
 *  2-court mode: routes by lower tier (C-pool if any C, else B-pool). */
function courtPoolForTiers(tier1: SkillTier, tier2: SkillTier): "A" | "B" | "C" {
  if (tier1 === tier2) return tier1;
  // Cross-tier (only possible in 2-court mode): route by lower tier
  if (tier1 === "C" || tier2 === "C") return "C";
  return "B";
}

/** Court number → pool filter for 3-court mode. Court 1=C, Court 2=B, Court 3=A */
function courtToPool(court: number): "A" | "B" | "C" {
  if (court === 1) return "C";
  if (court === 2) return "B";
  return "A";
}

/** Award leaderboard points to both players on the winning pair.
 *  Looks up players by name in the `players` table. Fire-and-forget. */
async function awardMatchPoints(
  winnerPair: Pair,
  points: 3 | 5 | 10,
  reason: PointsReason,
  matchId: string,
  practiceMode?: boolean,
): Promise<void> {
  if (isSimulationMode() || practiceMode) return;
  const players = [winnerPair.player1, winnerPair.player2];
  for (const player of players) {
    let playerId = player.profileId;
    if (!playerId) {
      // Fallback: look up by name if no profileId linked
      try {
        const result = await query(
          'SELECT id FROM players WHERE (preferred_name = ? OR first_name = ?) AND is_deleted = 0 LIMIT 1',
          [player.name, player.name]
        );
        playerId = result.rows.length > 0 ? (result.rows[0] as any).id : undefined;
      } catch (err) {
        console.error(`Failed to look up player ${player.name}:`, err);
      }
    }
    if (playerId) {
      await awardPoints(playerId, points, reason, matchId).catch((err) =>
        console.error(`Failed to award points to ${player.name}:`, err),
      );
    }
  }
}

/** Head-to-head result between two pairs across completed matches.
 *  Returns 1 if pairA beat pairB more often, -1 if pairB beat pairA, 0 if tied/never met. */
export function getHeadToHead(pairAId: string, pairBId: string, matches: Match[]): number {
  let aWins = 0;
  let bWins = 0;
  for (const m of matches) {
    if (m.status !== "completed" || !m.winner || !m.loser) continue;
    const ids = [m.pair1.id, m.pair2.id];
    if (!ids.includes(pairAId) || !ids.includes(pairBId)) continue;
    if (m.winner.id === pairAId) aWins++;
    else if (m.winner.id === pairBId) bWins++;
  }
  if (aWins > bWins) return 1;
  if (bWins > aWins) return -1;
  return 0;
}

/** Single source of truth: push master pairs into every match reference */
function syncPairsToMatches(pairs: Pair[], matches: Match[]): Match[] {
  const pairMap = new Map(pairs.map(p => [p.id, p]));
  return matches.map(m => {
    if (m.status === "completed") return m;
    return {
      ...m,
      pair1: pairMap.get(m.pair1.id) || m.pair1,
      pair2: pairMap.get(m.pair2.id) || m.pair2,
    };
  });
}

/** Find the next pending match eligible for a freed court, enforcing:
 *  - No player currently on another court
 *  - Rest gap: no player who just completed a match (recentPlayerIds)
 *  - 3-court routing: Court 1 = C, Court 2 = B, Court 3 = A (tier-isolated)
 *  - Equity-based scoring: pairs with fewer games get priority
 *  - Hard equity gate: no pair plays more than minGames+1 ahead */
function findNextPendingForCourt(
  matches: Match[],
  freedCourt: number,
  courtCount: number,
  recentPlayerIds: Set<string>,
  allPairs: Pair[],
  allMatches: Match[],
  allowRestRelaxation = false,
): Match | undefined {
  // 1. Collect all currently playing player IDs (excluding the freed court)
  const busyPlayerIds = new Set<string>();
  matches.filter((m) => m.status === "playing" && m.court !== freedCourt).forEach((m) => {
    getMatchPlayerIds(m).forEach((id) => busyPlayerIds.add(id));
  });

  // Court pool filter for 3-court mode: Court 1=C, Court 2=B, Court 3=A
  const poolFilter: "A" | "B" | "C" | null = courtCount === 3
    ? courtToPool(freedCourt)
    : null;

  // Build set of active pair IDs for ghost-player validation
  const activePairIds = new Set(allPairs.map((p) => p.id));

  // 2. Filter pending matches to those valid for this court
  const validCandidates: Match[] = [];
  const restRelaxedCandidates: Match[] = []; // fallback: skip rest-gap filter
  for (const m of matches) {
    if (m.status !== "pending") continue;
    // Ghost-player guard: skip matches referencing removed pairs
    if (!activePairIds.has(m.pair1.id) || !activePairIds.has(m.pair2.id)) continue;
    const playerIds = getMatchPlayerIds(m);
    if (playerIds.some((id) => busyPlayerIds.has(id))) continue;
    if (poolFilter) {
      const matchPool = m.courtPool || courtPoolForTiers(m.pair1.skillLevel, m.pair2.skillLevel);
      if (poolFilter !== matchPool) continue;
    }
    // Rest-gap is preferred but not mandatory
    if (playerIds.some((id) => recentPlayerIds.has(id))) {
      restRelaxedCandidates.push(m);
      continue;
    }
    validCandidates.push(m);
  }

  // Fall back to rest-relaxed candidates only when explicitly allowed
  const candidates = validCandidates.length > 0
    ? validCandidates
    : (allowRestRelaxation ? restRelaxedCandidates : []);
  if (candidates.length === 0) return undefined;

  // 3. Compute total game counts (completed + playing) for each pair
  const pairTotalGames = new Map<string, number>();
  for (const p of allPairs) {
    pairTotalGames.set(p.id, 0);
  }
  for (const m of allMatches) {
    if (m.status !== "completed" && m.status !== "playing") continue;
    pairTotalGames.set(m.pair1.id, (pairTotalGames.get(m.pair1.id) || 0) + 1);
    pairTotalGames.set(m.pair2.id, (pairTotalGames.get(m.pair2.id) || 0) + 1);
  }

  // Hard cap: reject any candidate where either pair is at or above 4 total games
  const HARD_CAP = 4;

  // 4. HARD EQUITY GATE: compute minGames across available pairs.
  //    Filter out busy pairs (on court) AND 0-game pairs (late arrivals)
  //    so neither artificially drags the minimum to 0 and deadlocks scheduling.
  const availablePairCounts = allPairs
    .filter((p) => !getPairPlayerIds(p).some((id) => busyPlayerIds.has(id)))
    .map((p) => pairTotalGames.get(p.id) || 0);
  const activeCounts = availablePairCounts.filter((c) => c > 0);
  const minGamesAcrossAllPairs = activeCounts.length > 0 ? Math.min(...activeCounts) : 0;

  // 5. Score remaining candidates
  let bestMatch: Match | undefined;
  let bestScore = Infinity;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const pair1Games = pairTotalGames.get(candidate.pair1.id) || 0;
    const pair2Games = pairTotalGames.get(candidate.pair2.id) || 0;

    // Hard cap: never schedule a pair past 4 games
    if (pair1Games >= HARD_CAP || pair2Games >= HARD_CAP) continue;

    // Reject only if BOTH pairs are far ahead — allow catch-up matches for underserved pairs.
    // Skip equity gate entirely when no other courts are busy (drain mode) — just finish remaining games.
    if (busyPlayerIds.size > 0 && Math.min(pair1Games, pair2Games) > minGamesAcrossAllPairs + 1) continue;

    const crossPenalty = isCrossCohort(candidate.matchupLabel) ? 100000000 : 0;
    const finalScore = crossPenalty + Math.max(pair1Games, pair2Games) * 1000 + (candidate.gameNumber || i);
    if (finalScore < bestScore) {
      bestScore = finalScore;
      bestMatch = candidate;
    }
  }

  // If equity gate blocked everything, relax it and try again (but still respect hard cap)
  if (!bestMatch) {
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const pair1Games = pairTotalGames.get(candidate.pair1.id) || 0;
      const pair2Games = pairTotalGames.get(candidate.pair2.id) || 0;
      if (pair1Games >= HARD_CAP || pair2Games >= HARD_CAP) continue;
      const crossPenalty = isCrossCohort(candidate.matchupLabel) ? 100000000 : 0;
      const finalScore = crossPenalty + Math.max(pair1Games, pair2Games) * 1000 + (candidate.gameNumber || i);
      if (finalScore < bestScore) {
        bestScore = finalScore;
        bestMatch = candidate;
      }
    }
  }

  return bestMatch;
}

function getAvailableTeams(
  pairs: Pair[],
  matches: Match[],
  pairGamesWatched: Record<string, number>,
  targetGames: number,
): Pair[] {
  const busyPlayerIds = new Set<string>();
  for (const m of matches) {
    if (m.status === "playing") {
      getMatchPlayerIds(m).forEach((id) => busyPlayerIds.add(id));
    }
  }

  // Count completed + playing as total games (prevents exceeding cap)
  const pairTotalGames = new Map<string, number>();
  for (const p of pairs) pairTotalGames.set(p.id, 0);
  for (const m of matches) {
    if (m.status !== "completed" && m.status !== "playing") continue;
    pairTotalGames.set(m.pair1.id, (pairTotalGames.get(m.pair1.id) || 0) + 1);
    pairTotalGames.set(m.pair2.id, (pairTotalGames.get(m.pair2.id) || 0) + 1);
  }

  return pairs
    .filter((pair) => {
      if (getPairPlayerIds(pair).some((id) => busyPlayerIds.has(id))) return false;
      if ((pairTotalGames.get(pair.id) || 0) >= targetGames) return false;
      return true;
    })
    .sort((a, b) => {
      const watchDiff = (pairGamesWatched[b.id] || 0) - (pairGamesWatched[a.id] || 0);
      if (watchDiff !== 0) return watchDiff;
      return (pairTotalGames.get(a.id) || 0) - (pairTotalGames.get(b.id) || 0);
    });
}

function generateNextMatch(
  availableTeams: Pair[],
  freedCourt: number,
  courtCount: number,
  recentPlayerIds: Set<string>,
  allMatches: Match[],
): Match | undefined {
  if (availableTeams.length < 2) return undefined;

  const poolFilter: "A" | "B" | "C" | null = courtCount === 3
    ? courtToPool(freedCourt) : null;

  const playedMatchups = new Map<string, number>();
  for (const m of allMatches) {
    if (m.status === "completed" || m.status === "playing") {
      const key = [m.pair1.id, m.pair2.id].sort().join("|||");
      playedMatchups.set(key, (playedMatchups.get(key) || 0) + 1);
    }
  }

  let best: { pair1: Pair; pair2: Pair; skillLevel: SkillTier | "cross"; matchupLabel: string; score: number } | undefined;

  for (let i = 0; i < availableTeams.length; i++) {
    for (let j = i + 1; j < availableTeams.length; j++) {
      const p1 = availableTeams[i], p2 = availableTeams[j];
      if (isForbiddenMatchup(p1.skillLevel, p2.skillLevel)) continue;
      // 3-court: only same-tier matchups allowed
      if (courtCount === 3 && p1.skillLevel !== p2.skillLevel) continue;
      const matchPool = courtPoolForTiers(p1.skillLevel, p2.skillLevel);
      if (poolFilter && poolFilter !== matchPool) continue;
      const allPlayerIds = [...getPairPlayerIds(p1), ...getPairPlayerIds(p2)];
      if (allPlayerIds.some((id) => recentPlayerIds.has(id))) continue;

      const isCross = p1.skillLevel !== p2.skillLevel;
      const mKey = [p1.id, p2.id].sort().join("|||");
      const score = (playedMatchups.get(mKey) || 0) * 10000 + (isCross ? 1000 : 0) + i + j;

      if (!best || score < best.score) {
        best = { pair1: p1, pair2: p2, skillLevel: isCross ? "cross" : p1.skillLevel, matchupLabel: `${p1.skillLevel} vs ${p2.skillLevel}`, score };
      }
    }
  }

  if (!best) return undefined;
  const pool = courtPoolForTiers(best.pair1.skillLevel, best.pair2.skillLevel);
  return { id: generateId(), pair1: best.pair1, pair2: best.pair2, skillLevel: best.skillLevel, matchupLabel: best.matchupLabel, status: "pending", court: null, courtPool: pool };
}

export function useGameState(options?: { simulate?: boolean }) {
  const simulate = options?.simulate ?? false;
  const [state, setState] = useState<GameState>(DEFAULT_STATE);
  const [loading, setLoading] = useState(!simulate);
  const savingRef = useRef(false);
  const pendingRef = useRef<GameState | null>(null);
  const localMutationRef = useRef(false); // blocks sync overwrite after local changes
  const mutationCounterRef = useRef(0); // tracks mutation generations to prevent stale timeout clears
  const lastAppliedUpdatedAtRef = useRef<number>(0); // guards against out-of-order remote updates causing UI "reverts"
  const versionRef = useRef<number>(0); // optimistic lock — tracks DB version
  const realtimeConnectedRef = useRef(false); // tracks if realtime subscription is alive
  const simulateRef = useRef(simulate); // stable ref for drainSave closure

  // Set/clear the global simulation flag on mount/unmount
  // Also force-clear when simulate=false, in case a prior page left it stuck
  useEffect(() => {
    if (simulate) {
      setSimulationMode(true);
      return () => { setSimulationMode(false); };
    } else {
      setSimulationMode(false);
    }
  }, [simulate]);

  // Load initial state from DB (skip in simulation)
  useEffect(() => {
    if (simulate) return;
    const load = async () => {
      const { data } = await supabase
        .from("game_state")
        .select("state, updated_at, version")
        .eq("id", ROW_ID)
        .single();

      if (data?.state) {
        const loaded = data.state as unknown as GameState;

        const serverVersion = (data as any).version as number | undefined;
        if (typeof serverVersion === "number") versionRef.current = serverVersion;
        console.log(`📦 [PTO] Loaded initial state — version ${versionRef.current}`);

        const serverUpdatedAt = (data as any).updated_at as string | undefined;
        if (serverUpdatedAt) {
          const ts = Date.parse(serverUpdatedAt);
          if (Number.isFinite(ts)) lastAppliedUpdatedAtRef.current = ts;
        }

        // Restore courtCount from localStorage if Supabase doesn't have it yet
        const savedCourtCount = localStorage.getItem("clubpto_courtCount");
        if (savedCourtCount && loaded.sessionConfig) {
          loaded.sessionConfig = { ...loaded.sessionConfig, courtCount: Number(savedCourtCount) as 2 | 3 };
        }

        // Guard: don't overwrite if a local mutation happened during load
        if (!localMutationRef.current && !pendingRef.current) {
          setState(loaded);
        }
      }
      setLoading(false);
    };
    load();
  }, [simulate]);

  const shouldApplyRemote = useCallback((updatedAt?: string | null) => {
    const ts = updatedAt ? Date.parse(updatedAt) : Date.now();
    if (!Number.isFinite(ts)) return false;
    if (ts <= lastAppliedUpdatedAtRef.current) return false;
    lastAppliedUpdatedAtRef.current = ts;
    return true;
  }, []);

  // Subscribe to realtime changes — skip if a save is in progress or pending (or simulation)
  useEffect(() => {
    if (simulate) return;
    const channel = supabase
      .channel("game_state_sync")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_state", filter: `id=eq.${ROW_ID}` },
        (payload) => {
          const now = new Date().toISOString();
          const updatedBy = (payload.new as any)?.updated_by as string | undefined;
          const updatedAt = (payload.new as any)?.updated_at as string | undefined;
          const isOwnUpdate = updatedBy === DEVICE_ID;

          const remoteVersion = (payload.new as any)?.version as number | undefined;

          console.log(`🔥 [PTO] REALTIME UPDATE RECEIVED @ ${now}`, {
            updatedBy: updatedBy ?? "(no device tag)",
            updatedAt,
            isOwnUpdate,
            remoteVersion,
            localVersion: versionRef.current,
            blocked: {
              saving: savingRef.current,
              pending: !!pendingRef.current,
              localMutation: localMutationRef.current,
            },
          });

          if (savingRef.current || pendingRef.current || localMutationRef.current) {
            console.warn("⚠️ [PTO] Realtime update BLOCKED by refs:", {
              saving: savingRef.current,
              pending: !!pendingRef.current,
              localMutation: localMutationRef.current,
            });
            return;
          }
          const nextState = (payload.new as any)?.state as GameState | undefined;
          if (!nextState) { console.warn("⚠️ [PTO] Realtime payload missing state"); return; }
          if (typeof remoteVersion === "number" && remoteVersion <= versionRef.current) {
            console.warn(`⚠️ [PTO] Realtime update REJECTED — stale version (remote v${remoteVersion} <= local v${versionRef.current})`);
            return;
          }
          if (!shouldApplyRemote(updatedAt)) {
            console.warn("⚠️ [PTO] Realtime update REJECTED by timestamp guard (stale/duplicate)", {
              remote: updatedAt,
              lastApplied: lastAppliedUpdatedAtRef.current,
            });
            return;
          }
          if (typeof remoteVersion === "number") versionRef.current = remoteVersion;
          console.log(`✅ [PTO] Applying remote state v${versionRef.current}. Playing:`,
            nextState.matches?.filter((m: any) => m.status === "playing").length,
            "Pending:",
            nextState.matches?.filter((m: any) => m.status === "pending").length,
          );
          setState(nextState);
        }
      )
      .subscribe((status, err) => {
        realtimeConnectedRef.current = status === "SUBSCRIBED";
        console.log(`📡 [PTO] SUBSCRIPTION STATUS: ${status} @ ${new Date().toISOString()}`);
        if (err) console.error("📡 [PTO] Subscription error:", err);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [shouldApplyRemote, simulate]);

  // Polling fallback every 10s — ONLY when realtime is disconnected
  useEffect(() => {
    if (simulate) return;
    const interval = setInterval(async () => {
      if (realtimeConnectedRef.current) return; // realtime is alive, no need to poll
      if (savingRef.current || pendingRef.current || localMutationRef.current) {
        console.log("🔄 [PTO] Poll skipped — refs active:", {
          saving: savingRef.current,
          pending: !!pendingRef.current,
          localMutation: localMutationRef.current,
        });
        return;
      }
      console.log("🔄 [PTO] Realtime disconnected — polling fallback");
      const { data } = await supabase
        .from("game_state")
        .select("state, updated_at, version")
        .eq("id", ROW_ID)
        .single();

      const nextState = data?.state as unknown as GameState | undefined;
      const updatedAt = (data as any)?.updated_at as string | undefined;
      const remoteVersion = (data as any)?.version as number | undefined;

      if (nextState && !savingRef.current && !pendingRef.current && !localMutationRef.current) {
        if (typeof remoteVersion === "number" && remoteVersion <= versionRef.current) return;
        if (!shouldApplyRemote(updatedAt)) return;
        if (typeof remoteVersion === "number") versionRef.current = remoteVersion;
        console.log(`🔄 [PTO] Poll — applying v${versionRef.current} from DB`);
        setState(nextState);
      }
    }, 10_000);
    return () => clearInterval(interval);
  }, [shouldApplyRemote, simulate]);

  const drainSave = useCallback(async () => {
    if (simulateRef.current || isSimulationMode()) { pendingRef.current = null; localMutationRef.current = false; return; }
    if (savingRef.current) return;
    savingRef.current = true;

    let retries = 0;
    const MAX_RETRIES = 5;

    try {
      while (pendingRef.current && retries < MAX_RETRIES) {
        const toSave = pendingRef.current;
        pendingRef.current = null;

        const updatedAt = new Date().toISOString();
        const expectedVersion = versionRef.current;
        const nextVersion = expectedVersion + 1;
        console.log(`💾 [PTO] Saving state v${expectedVersion}→v${nextVersion} @ ${updatedAt} from ${DEVICE_ID}`, {
          playing: toSave.matches?.filter((m: any) => m.status === "playing").length,
          pending: toSave.matches?.filter((m: any) => m.status === "pending").length,
          completed: toSave.matches?.filter((m: any) => m.status === "completed").length,
        });

        // Optimistic lock: only update if version matches what we expect
        const { data, error } = await supabase
          .from("game_state")
          .update({
            state: JSON.parse(JSON.stringify(toSave)),
            updated_at: updatedAt,
            updated_by: DEVICE_ID,
            version: nextVersion,
          })
          .eq("id", ROW_ID)
          .eq("version", expectedVersion)
          .select("version")
          .single();

        if (!error && data) {
          versionRef.current = nextVersion;
          retries = 0; // reset on success
          console.log(`✅ [PTO] Save succeeded — now v${nextVersion}`);
          const ts = Date.parse(updatedAt);
          if (Number.isFinite(ts)) lastAppliedUpdatedAtRef.current = Math.max(lastAppliedUpdatedAtRef.current, ts);
          continue;
        }

        // Version conflict — another device wrote first. Re-queue with fresh version and retry.
        if (!error && !data) {
          retries++;
          console.warn(`⚠️ [PTO] Version conflict (attempt ${retries}/${MAX_RETRIES})! Fetching latest version...`);
          const { data: fresh } = await supabase
            .from("game_state")
            .select("state, updated_at, version")
            .eq("id", ROW_ID)
            .single();
          if (fresh) {
            const freshVersion = (fresh as any).version as number;
            versionRef.current = freshVersion;
            const freshTs = Date.parse((fresh as any).updated_at);
            if (Number.isFinite(freshTs)) lastAppliedUpdatedAtRef.current = Math.max(lastAppliedUpdatedAtRef.current, freshTs);
          }
          // Re-queue our local state so the while loop retries with the fresh version
          if (!pendingRef.current) pendingRef.current = toSave;
          await new Promise((r) => setTimeout(r, 200));
          continue;
        }

        // Real error (network, etc.) — retry once with fresh version
        retries++;
        console.error(`❌ [PTO] Save failed (attempt ${retries}/${MAX_RETRIES}):`, error);
        await new Promise((r) => setTimeout(r, 500));
        // Re-read version in case it changed
        const { data: freshForRetry } = await supabase
          .from("game_state")
          .select("version")
          .eq("id", ROW_ID)
          .single();
        if (freshForRetry) {
          versionRef.current = (freshForRetry as any).version as number;
        }
        if (!pendingRef.current) pendingRef.current = toSave;
      }
      if (retries >= MAX_RETRIES) {
        console.error(`❌ [PTO] Gave up after ${MAX_RETRIES} retries. Fetching remote state as hard reset.`);
        const { data: reset } = await supabase
          .from("game_state")
          .select("state, updated_at, version")
          .eq("id", ROW_ID)
          .single();
        if (reset) {
          versionRef.current = (reset as any).version as number;
          const resetTs = Date.parse((reset as any).updated_at);
          if (Number.isFinite(resetTs)) lastAppliedUpdatedAtRef.current = Math.max(lastAppliedUpdatedAtRef.current, resetTs);
          setState(reset.state as unknown as GameState);
          pendingRef.current = null;
        }
      }
    } finally {
      savingRef.current = false;
      localMutationRef.current = false;
      console.log(`🔓 [PTO] Save complete — localMutationRef → false (mutation #${mutationCounterRef.current})`);
    }
  }, []);

  const updateState = useCallback(
    (updater: (prev: GameState) => GameState) => {
      localMutationRef.current = true;
      mutationCounterRef.current += 1;
      const counterSnapshot = mutationCounterRef.current;
      console.log(`🖊️ [PTO] updateState called — mutation #${counterSnapshot}, localMutationRef → true`);
      setState((prev) => {
        const next = updater(prev);
        // Queue the state for saving and kick off the drain loop
        pendingRef.current = next;
        // Use queueMicrotask so the drain starts after setState completes
        queueMicrotask(() => drainSave());
        return next;
      });
      // Safety net: force-clear localMutationRef after 30s, but only if save isn't in-flight
      setTimeout(() => {
        if (mutationCounterRef.current === counterSnapshot && localMutationRef.current && !savingRef.current) {
          console.warn(`⏰ [PTO] Force-clearing localMutationRef after 30s safety timeout (mutation #${counterSnapshot})`);
          localMutationRef.current = false;
        }
      }, 30000);
    },
    [drainSave]
  );

  // Self-heal: keep all courts occupied during active round-robin play
  useEffect(() => {
    if (loading) return;
    if (!state.sessionStarted || state.playoffsStarted) return;

    const courtCount = state.sessionConfig.courtCount || 2;
    const playingMatches = state.matches.filter((m) => m.status === "playing");
    const pendingMatches = state.matches.filter((m) => m.status === "pending");
    if (pendingMatches.length === 0) return;

    const occupiedCourts = new Set<number>(
      playingMatches
        .map((m) => m.court)
        .filter((c): c is number => typeof c === "number")
    );

    const idleCourts: number[] = [];
    for (let c = 1; c <= courtCount; c++) {
      if (!occupiedCourts.has(c)) idleCourts.push(c);
    }
    if (idleCourts.length === 0) return;

    updateState((s) => {
      const liveCourtCount = s.sessionConfig.courtCount || 2;
      const playing = s.matches.filter((m) => m.status === "playing");
      const pending = s.matches.filter((m) => m.status === "pending");
      if (pending.length === 0) return s;

      const occupied = new Set<number>(
        playing
          .map((m) => m.court)
          .filter((c): c is number => typeof c === "number")
      );

      const toFill: number[] = [];
      for (let c = 1; c <= liveCourtCount; c++) {
        if (!occupied.has(c)) toFill.push(c);
      }
      if (toFill.length === 0) return s;

      let updatedMatches = [...s.matches];
      let changed = false;

      // Use completion-order rest gap: players in the last N completed matches are "resting"
      // where N = number of courts. This prevents back-to-back regardless of match speed.
      const completedByTime = updatedMatches
        .filter((m) => m.status === "completed" && m.completedAt)
        .sort((a, b) => Date.parse(b.completedAt!) - Date.parse(a.completedAt!));
      const recentPlayerIds = new Set<string>();
      const restWindow = liveCourtCount; // rest for at least 1 round of court completions
      for (let i = 0; i < Math.min(restWindow, completedByTime.length); i++) {
        getMatchPlayerIds(completedByTime[i]).forEach((id) => recentPlayerIds.add(id));
      }

      for (const court of toFill) {
        const nextPending = findNextPendingForCourt(updatedMatches, court, liveCourtCount, recentPlayerIds, s.pairs, updatedMatches, false);
        if (!nextPending) continue;
        const idx = updatedMatches.findIndex((m) => m.id === nextPending.id);
        if (idx === -1) continue;
        updatedMatches[idx] = {
          ...nextPending,
          status: "playing",
          court,
          startedAt: new Date().toISOString(),
        };
        changed = true;
      }

      return changed ? { ...s, matches: updatedMatches } : s;
    });
  }, [loading, state.matches, state.playoffsStarted, state.sessionConfig.courtCount, state.sessionStarted, updateState]);

  // Session config
  const setSessionConfig = useCallback(
    (config: Partial<GameState["sessionConfig"]>) => {
      if (config.courtCount !== undefined) {
        localStorage.setItem("clubpto_courtCount", String(config.courtCount));
      }
      updateState((s) => ({ ...s, sessionConfig: { ...s.sessionConfig, ...config } }));
    },
    [updateState]
  );

  // Roster
  const addPlayer = useCallback(
    (name: string, skillLevel: SkillTier, profileId?: string): boolean => {
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
          profileId,
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
      updateState((s) => {
        // If session has matches, clean up matches + pairs (not just roster)
        if (s.matches.length > 0) {
          // Block removal if player is currently on court
          const isPlaying = s.matches.some(
            (m) => m.status === "playing" && getMatchPlayerIds(m).includes(id)
          );
          if (isPlaying) return s;

          // Find and remove pairs containing this player
          const playerPairIds = new Set<string>();
          s.pairs.forEach((pair) => {
            if (pair.player1.id === id || pair.player2.id === id) {
              playerPairIds.add(pair.id);
            }
          });

          const updatedPairs = s.pairs.filter((p) => !playerPairIds.has(p.id));

          // Remove pending matches involving this player's pair(s)
          let updatedMatches = s.matches.filter((m) => {
            if (m.status !== "pending") return true;
            return !playerPairIds.has(m.pair1.id) && !playerPairIds.has(m.pair2.id);
          });

          // Defensive: remove any non-completed match still referencing a removed pair
          const activePairIds = new Set(updatedPairs.map((p) => p.id));
          updatedMatches = updatedMatches.filter((m) => {
            if (m.status === "completed") return true;
            return activePairIds.has(m.pair1.id) && activePairIds.has(m.pair2.id);
          });

          updatedMatches = updatedMatches.map((m, i) =>
            m.gameNumber !== i + 1 ? { ...m, gameNumber: i + 1 } : m
          );

          return {
            ...s,
            roster: s.roster.filter((p) => p.id !== id),
            pairs: updatedPairs,
            matches: updatedMatches,
            totalScheduledGames: updatedMatches.length,
          };
        }

        // Pre-session: just remove from roster
        return { ...s, roster: s.roster.filter((p) => p.id !== id) };
      });
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
   * FIXED-PAIR schedule generator with strict same-cohort priority.
   *
   * 1. Create FIXED pairs from checked-in players. Each pair stays together the ENTIRE session.
   * 2. Schedule matches with strict same-cohort priority:
   *    - Same-cohort matches (A vs A, B vs B, C vs C) are always scheduled first
   *    - Cross-cohort (B vs A, B vs C) only fills remaining slots when same-cohort is exhausted
   *    - A vs C is strictly forbidden
   *    - B vs C is only allowed in 2-court mode
   * 3. Prevent court conflicts: no pair plays back-to-back in the schedule.
   *    In 3-court mode: Court 1 = C, Court 2 = B, Court 3 = A (tier-isolated).
   */
  const generateFullSchedule = useCallback(async (fixedPairs: FixedPair[] = []) => {
    // Fetch pair history BEFORE entering updateState (only async part)
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const historyResult = await query(
      'SELECT player1_name, player2_name FROM pair_history WHERE session_date >= ?',
      [twoWeeksAgo.toISOString().split("T")[0]]
    ).catch(() => ({ rows: [] }));
    const history = historyResult.rows as any[];

    // All state reads happen inside updateState to avoid stale closures
    updateState((s) => {
    let roster = [...s.roster];
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
    if (checkedIn.length < 4) return s;

    // Handle odd player decisions
    const decisions = s.oddPlayerDecisions || [];
    const sitOutIds = new Set(decisions.filter((d) => d.decision === "sit_out").map((d) => d.playerId));
    const crossPairDecisions = decisions.filter((d) => d.decision === "cross_pair");
    const waitlistedIds = [...sitOutIds];

    // Remove sit-out players from the active pool
    const activePlayers = checkedIn.filter((p) => !sitOutIds.has(p.id));

    const recentPairs = new Set<string>();
    (history || []).forEach((h: { player1_name: string; player2_name: string }) => {
      recentPairs.add([h.player1_name, h.player2_name].sort().join("|||"));
    });
    const wasRecentlyPaired = (a: string, b: string) =>
      recentPairs.has([a, b].sort().join("|||"));

    // Split by tier — cross-pair players join their target tier for pairing
    const getEffectiveTier = (p: Player): SkillTier => {
      const cpd = crossPairDecisions.find((d) => d.playerId === p.id);
      return cpd?.crossPairTier || p.skillLevel;
    };
    const tierA = shuffle(activePlayers.filter((p) => getEffectiveTier(p) === "A"));
    const tierB = shuffle(activePlayers.filter((p) => getEffectiveTier(p) === "B"));
    const tierC = shuffle(activePlayers.filter((p) => getEffectiveTier(p) === "C"));

    // ── Step 1: Create FIXED pairs ──────────────────────────────
    const createFixedPairsForTier = (players: Player[], skill: SkillTier): Pair[] => {
      const pairs: Pair[] = [];
      const used = new Set<string>();

      // Deduplicate fixedPairs: if two VIPs claimed the same partner, first one wins.
      // Also remove mutual selections (A→B + B→A) — just keep the first.
      const deduped: FixedPair[] = [];
      const claimedNames = new Set<string>();
      for (const fp of fixedPairs) {
        const p1Low = fp.player1Name.toLowerCase();
        const p2Low = fp.player2Name.toLowerCase();
        if (claimedNames.has(p1Low) || claimedNames.has(p2Low)) {
          console.warn(`[PTO] Fixed pair conflict: ${fp.player1Name} + ${fp.player2Name} — one is already claimed, skipping`);
          continue;
        }
        deduped.push(fp);
        claimedNames.add(p1Low);
        claimedNames.add(p2Low);
      }

      // First, honor any admin-set fixed pairs
      for (const fp of deduped) {
        const p1 = players.find((p) => p.name.toLowerCase() === fp.player1Name.toLowerCase() && !used.has(p.id));
        const p2 = players.find((p) => p.name.toLowerCase() === fp.player2Name.toLowerCase() && !used.has(p.id));
        if (p1 && p2) {
          pairs.push({
            id: generateId(), player1: p1, player2: p2, skillLevel: skill, wins: 0, losses: 0,
          });
          used.add(p1.id);
          used.add(p2.id);
        } else {
          console.warn(`[PTO] Fixed pair failed: ${fp.player1Name} + ${fp.player2Name} — player not found in ${skill} tier or already used`);
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

    // Auto-waitlist any checked-in players who didn't get paired (odd count in a tier)
    const pairedPlayerIds = new Set<string>();
    allPairs.forEach(p => { pairedPlayerIds.add(p.player1.id); pairedPlayerIds.add(p.player2.id); });
    const unpairedPlayers = activePlayers.filter(p => !pairedPlayerIds.has(p.id));
    if (unpairedPlayers.length > 0) {
      waitlistedIds.push(...unpairedPlayers.map(p => p.id));
    }

    // ── Step 2: Generate ALL unique matchups ──────────────────
    const durationMin = s.sessionConfig.durationMinutes || 85;
    const minutesPerGame = 7;
    const totalSlots = Math.floor(durationMin / minutesPerGame);
    const courtCount = s.sessionConfig.courtCount || 2;
    const maxGames = totalSlots * courtCount;
    const TARGET_GAMES_PER_PAIR = courtCount === 3 ? 3 : 4;
    const MAX_GAMES = 4; // Hard cap: no pair plays more than 4 games before playoffs

    const baseTierTargets: Record<SkillTier, { vsA: number; vsB: number; vsC: number }> = courtCount === 3
      ? { A: { vsA: 3, vsB: 0, vsC: 0 }, B: { vsA: 0, vsB: 3, vsC: 0 }, C: { vsA: 0, vsB: 0, vsC: 3 } }
      : { A: { vsA: 3, vsB: 1, vsC: 0 }, B: { vsA: 1, vsB: 2, vsC: 1 }, C: { vsA: 0, vsB: 1, vsC: 3 } };

    // Adaptive targets: when a tier has fewer opponents than the base target,
    // cap same-tier games at available opponents and redistribute surplus to cross-tier.
    // Priority: maximize same-tier games first, then fill with cross-tier (B only).
    const tierTargets: Record<SkillTier, { vsA: number; vsB: number; vsC: number }> = (() => {
      if (courtCount === 3) return baseTierTargets; // 3-court: strict tier isolation, no adaptation
      const aCount = aPairs.length;
      const bCount = bPairs.length;
      const cCount = cPairs.length;
      const adapt = (tier: SkillTier): { vsA: number; vsB: number; vsC: number } => {
        const base = { ...baseTierTargets[tier] };
        const maxOpponents = (oTier: SkillTier) =>
          Math.max(0, oTier === tier ? (oTier === "A" ? aCount : oTier === "B" ? bCount : cCount) - 1 : (oTier === "A" ? aCount : oTier === "B" ? bCount : cCount));
        // Cap each target at available opponents
        const capA = Math.min(base.vsA, maxOpponents("A"));
        const capB = Math.min(base.vsB, maxOpponents("B"));
        const capC = Math.min(base.vsC, maxOpponents("C"));
        let surplus = (base.vsA - capA) + (base.vsB - capB) + (base.vsC - capC);
        const result = { vsA: capA, vsB: capB, vsC: capC };
        // Redistribute surplus: same-tier first (if room), then cross-tier via B bridge
        if (surplus > 0 && tier !== "B") {
          // A or C tier: overflow goes to vsB (the only allowed cross-tier partner)
          const bRoom = maxOpponents("B") - result.vsB;
          const toBAdd = Math.min(surplus, bRoom);
          result.vsB += toBAdd;
          surplus -= toBAdd;
        }
        if (surplus > 0 && tier === "B") {
          // B tier: overflow goes to same-tier first, then A, then C
          const bRoom = maxOpponents("B") - result.vsB;
          const toBAdd = Math.min(surplus, bRoom);
          result.vsB += toBAdd;
          surplus -= toBAdd;
          if (surplus > 0) {
            const aRoom = maxOpponents("A") - result.vsA;
            const toAAdd = Math.min(surplus, aRoom);
            result.vsA += toAAdd;
            surplus -= toAAdd;
          }
          if (surplus > 0) {
            const cRoom = maxOpponents("C") - result.vsC;
            const toCAdd = Math.min(surplus, cRoom);
            result.vsC += toCAdd;
            surplus -= toCAdd;
          }
        }
        return result;
      };
      return { A: adapt("A"), B: adapt("B"), C: adapt("C") };
    })();

    const pairOpponentStats = new Map<string, { vsA: number; vsB: number; vsC: number }>();
    allPairs.forEach((p) => pairOpponentStats.set(p.id, { vsA: 0, vsB: 0, vsC: 0 }));

    // Helper: get all player IDs from a match
    const matchPlayerIds = (m: { pair1: Pair; pair2: Pair }) => [
      m.pair1.player1.id, m.pair1.player2.id,
      m.pair2.player1.id, m.pair2.player2.id,
    ];

    // Helper: canonical matchup key (pair vs pair, order-independent)
    const matchupKey = (p1Id: string, p2Id: string) =>
      [p1Id, p2Id].sort().join("|||");

    // Generate all unique pair-vs-pair matchups for allowed tier rules
    type CandidateMatch = { pair1: Pair; pair2: Pair; skillLevel: SkillTier | "cross"; matchupLabel: string; courtPool?: "A" | "B" | "C" };
    const allCandidates: CandidateMatch[] = [];

    // A vs A
    for (let i = 0; i < aPairs.length; i++) {
      for (let j = i + 1; j < aPairs.length; j++) {
        allCandidates.push({ pair1: aPairs[i], pair2: aPairs[j], skillLevel: "A", matchupLabel: "A vs A", courtPool: "A" });
      }
    }
    // C vs C
    for (let i = 0; i < cPairs.length; i++) {
      for (let j = i + 1; j < cPairs.length; j++) {
        allCandidates.push({ pair1: cPairs[i], pair2: cPairs[j], skillLevel: "C", matchupLabel: "C vs C", courtPool: "C" });
      }
    }
    // B vs B
    for (let i = 0; i < bPairs.length; i++) {
      for (let j = i + 1; j < bPairs.length; j++) {
        allCandidates.push({ pair1: bPairs[i], pair2: bPairs[j], skillLevel: "B", matchupLabel: "B vs B", courtPool: "B" });
      }
    }
    // B vs A (cross) — only in 2-court mode
    if (courtCount === 2) {
      for (const bp of bPairs) {
        for (const ap of aPairs) {
          allCandidates.push({ pair1: bp, pair2: ap, skillLevel: "cross", matchupLabel: "B vs A", courtPool: "B" });
        }
      }
    }
    // B vs C (cross) — only in 2-court mode
    if (courtCount === 2) {
      for (const bp of bPairs) {
        for (const cp of cPairs) {
          allCandidates.push({ pair1: bp, pair2: cp, skillLevel: "cross", matchupLabel: "B vs C", courtPool: "C" });
        }
      }
    }

    // ── Step 3: Schedule into time slots with strict constraints ──
    const schedule: Match[] = [];
    const usedMatchups = new Set<string>();
    const pairGameCount = new Map<string, number>();
    const pairLastSlot = new Map<string, number>();
    allPairs.forEach((p) => { pairGameCount.set(p.id, 0); pairLastSlot.set(p.id, -1); });

    let candidatePool = shuffle([...allCandidates]);

    // Track which matches belong to each slot (handles variable-size slots)
    const slotBoundaries: number[] = []; // index into schedule where each slot starts

    const getSlotPlayerIds = (slotIndex: number): Set<string> => {
      const ids = new Set<string>();
      if (slotIndex < 0 || slotIndex >= slotBoundaries.length) return ids;
      const start = slotBoundaries[slotIndex];
      const end = slotIndex + 1 < slotBoundaries.length ? slotBoundaries[slotIndex + 1] : schedule.length;
      for (let i = start; i < end; i++) {
        matchPlayerIds(schedule[i]).forEach((id) => ids.add(id));
      }
      return ids;
    };

    // REST_GAP=1: block players from the immediately preceding slot.
    // Guarantees minimum 1 full slot rest between any player's games.
    const REST_GAP = 1;

    const pickBestCandidate = (
      pool: CandidateMatch[],
      slotPlayerIds: Set<string>,
      blockedPlayerIds: Set<string>,
      courtPoolFilter?: "A" | "B" | "C",
      currentSlot?: number
    ): number => {
      let bestIdx = -1;
      let bestScore = Infinity;

      for (let i = 0; i < pool.length; i++) {
        const c = pool[i];
        if (courtPoolFilter && c.courtPool !== courtPoolFilter) continue;

        const mKey = matchupKey(c.pair1.id, c.pair2.id);
        if (usedMatchups.has(mKey)) continue;

        const g1 = pairGameCount.get(c.pair1.id) || 0;
        const g2 = pairGameCount.get(c.pair2.id) || 0;
        if (g1 >= MAX_GAMES || g2 >= MAX_GAMES) continue;

        // Equity gate: no pair schedules more than 1 game ahead of the least-scheduled pair
        // Exclude 0-game pairs so late additions don't drag the minimum to 0 and deadlock
        const pgcValues = Array.from(pairGameCount.values());
        const activeValues = pgcValues.filter((c2) => c2 > 0);
        const minCount = activeValues.length > 0 ? Math.min(...activeValues) : 0;
        // Only block if BOTH pairs are ahead — allow catch-up matches
        if (Math.min(g1, g2) > minCount + 1) continue;

        const playerIds = matchPlayerIds(c);
        if (playerIds.some((id) => slotPlayerIds.has(id))) continue;
        if (playerIds.some((id) => blockedPlayerIds.has(id))) continue;

        // Distribution-aware scoring
        const t1 = c.pair1.skillLevel;
        const t2 = c.pair2.skillLevel;
        const stats1 = pairOpponentStats.get(c.pair1.id)!;
        const stats2 = pairOpponentStats.get(c.pair2.id)!;
        const tgt1 = tierTargets[t1];
        const tgt2 = tierTargets[t2];
        const vsCount = (s: typeof stats1, t: SkillTier) => t === "A" ? s.vsA : t === "B" ? s.vsB : s.vsC;
        const vsTarget = (tgt: typeof tgt1, t: SkillTier) => t === "A" ? tgt.vsA : t === "B" ? tgt.vsB : tgt.vsC;
        const deficit1 = vsTarget(tgt1, t2) - vsCount(stats1, t2);
        const deficit2 = vsTarget(tgt2, t1) - vsCount(stats2, t1);
        const d1 = deficit1 >= 0 ? deficit1 : deficit1 * 5;
        const d2 = deficit2 >= 0 ? deficit2 : deficit2 * 5;
        let score = -(d1 + d2) * 10 + (g1 + g2);
        if (g1 >= TARGET_GAMES_PER_PAIR) score += 100;
        if (g2 >= TARGET_GAMES_PER_PAIR) score += 100;
        // Cross-tier once target met: hard-block in 3-court (enough same-tier), soft penalty in 2-court
        if (c.skillLevel === "cross" && (deficit1 <= 0 || deficit2 <= 0)) {
          if (courtCount === 3) continue;
          score += 200;
        }
        // Starvation bonus: prioritize pairs that haven't played in 3+ slots
        if (currentSlot !== undefined) {
          const idle1 = currentSlot - (pairLastSlot.get(c.pair1.id) ?? -1);
          const idle2 = currentSlot - (pairLastSlot.get(c.pair2.id) ?? -1);
          if (idle1 >= 3) score -= idle1 * 5;
          if (idle2 >= 3) score -= idle2 * 5;
        }
        if (score < bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }
      return bestIdx;
    };

    const commitCandidate = (idx: number, slotPlayerIds: Set<string>, currentSlot?: number): Match => {
      const chosen = candidatePool.splice(idx, 1)[0];
      const mKey = matchupKey(chosen.pair1.id, chosen.pair2.id);
      usedMatchups.add(mKey);
      pairGameCount.set(chosen.pair1.id, (pairGameCount.get(chosen.pair1.id) || 0) + 1);
      pairGameCount.set(chosen.pair2.id, (pairGameCount.get(chosen.pair2.id) || 0) + 1);
      matchPlayerIds(chosen).forEach((id) => slotPlayerIds.add(id));
      if (currentSlot !== undefined) {
        pairLastSlot.set(chosen.pair1.id, currentSlot);
        pairLastSlot.set(chosen.pair2.id, currentSlot);
      }

      // Track opponent tiers for distribution-aware scheduling
      const oppT1 = chosen.pair2.skillLevel;
      const oppT2 = chosen.pair1.skillLevel;
      const st1 = pairOpponentStats.get(chosen.pair1.id)!;
      const st2 = pairOpponentStats.get(chosen.pair2.id)!;
      if (oppT1 === "A") st1.vsA++; else if (oppT1 === "B") st1.vsB++; else st1.vsC++;
      if (oppT2 === "A") st2.vsA++; else if (oppT2 === "B") st2.vsB++; else st2.vsC++;

      return {
        id: generateId(),
        pair1: chosen.pair1,
        pair2: chosen.pair2,
        skillLevel: chosen.skillLevel,
        matchupLabel: chosen.matchupLabel,
        status: "pending",
        court: null,
        courtPool: chosen.courtPool,
      };
    };

    // Multi-trial: run scheduler with different shuffles, keep the one with smallest max gap
    let bestTrialSchedule: Match[] = [];
    let bestTrialBoundaries: number[] = [];
    let bestTrialMaxGap = Infinity;

    for (let trial = 0; trial < 8; trial++) {
      // Reset state for this trial
      schedule.length = 0;
      slotBoundaries.length = 0;
      usedMatchups.clear();
      allPairs.forEach((p) => { pairGameCount.set(p.id, 0); pairLastSlot.set(p.id, -1); });
      allPairs.forEach((p) => pairOpponentStats.set(p.id, { vsA: 0, vsB: 0, vsC: 0 }));
      candidatePool = shuffle([...allCandidates]);

    for (let slot = 0; slot < totalSlots; slot++) {
      slotBoundaries.push(schedule.length);

      const blockedPlayerIds = new Set<string>();
      for (let prev = Math.max(0, slot - REST_GAP); prev < slot; prev++) {
        getSlotPlayerIds(prev).forEach((id) => blockedPlayerIds.add(id));
      }

      const slotGames: Match[] = [];
      const slotPlayerIds = new Set<string>();

      if (courtCount === 3) {
        // 3-court mode: Court 1 = C, Court 2 = B, Court 3 = A (each tier isolated)
        const cIdx = pickBestCandidate(candidatePool, slotPlayerIds, blockedPlayerIds, "C", slot);
        if (cIdx !== -1) slotGames.push(commitCandidate(cIdx, slotPlayerIds, slot));

        const bIdx = pickBestCandidate(candidatePool, slotPlayerIds, blockedPlayerIds, "B", slot);
        if (bIdx !== -1) slotGames.push(commitCandidate(bIdx, slotPlayerIds, slot));

        const aIdx = pickBestCandidate(candidatePool, slotPlayerIds, blockedPlayerIds, "A", slot);
        if (aIdx !== -1) slotGames.push(commitCandidate(aIdx, slotPlayerIds, slot));
      } else {
        // 2-court mode: any matchup on any court
        for (let courtIdx = 0; courtIdx < 2; courtIdx++) {
          const idx = pickBestCandidate(candidatePool, slotPlayerIds, blockedPlayerIds, undefined, slot);
          if (idx !== -1) slotGames.push(commitCandidate(idx, slotPlayerIds, slot));
        }
      }

      schedule.push(...slotGames);
    }

    // ── Fallback pass: fill short pairs with random unplayed matchups ─────
    const shortPairs = allPairs.filter(p => (pairGameCount.get(p.id) || 0) < TARGET_GAMES_PER_PAIR);
    if (shortPairs.length > 0) {
      console.warn("[PTO Schedule] Fallback: " + shortPairs.length + " pairs below target (" + TARGET_GAMES_PER_PAIR + "), finding unplayed matchups");
      for (const sp of shortPairs) {
        const needed = TARGET_GAMES_PER_PAIR - (pairGameCount.get(sp.id) || 0);
        // Any unplayed opponent, never A vs C, same-cohort first
        // In 3-court mode, only same-tier opponents allowed
        const sameCohort = shuffle(allPairs.filter(p => p.skillLevel === sp.skillLevel && p.id !== sp.id));
        const crossCohort = courtCount === 3 ? [] : shuffle(allPairs.filter(p => {
          if (p.id === sp.id) return false;
          if (p.skillLevel === sp.skillLevel) return false;
          if (isForbiddenMatchup(sp.skillLevel, p.skillLevel)) return false;
          return true;
        }));
        const fallbackOpponents = [...sameCohort, ...crossCohort];
        let added = 0;
        for (const opp of fallbackOpponents) {
          if (added >= needed) break;
          // Don't push opponent past MAX_GAMES
          if ((pairGameCount.get(opp.id) || 0) >= MAX_GAMES) continue;
          const mKey = matchupKey(sp.id, opp.id);
          if (usedMatchups.has(mKey)) continue;
          const isCross = opp.skillLevel !== sp.skillLevel;
          const fbPool = courtPoolForTiers(sp.skillLevel, opp.skillLevel);
          schedule.push({
            id: generateId(),
            pair1: sp,
            pair2: opp,
            skillLevel: isCross ? "cross" as const : sp.skillLevel,
            matchupLabel: isCross ? `${sp.skillLevel} vs ${opp.skillLevel}` : `${sp.skillLevel} vs ${sp.skillLevel}`,
            status: "pending",
            court: null,
            courtPool: fbPool,
          });
          usedMatchups.add(mKey);
          pairGameCount.set(sp.id, (pairGameCount.get(sp.id) || 0) + 1);
          pairGameCount.set(opp.id, (pairGameCount.get(opp.id) || 0) + 1);
          added++;
        }
        if (added < needed) {
          console.error("[PTO Schedule] WARNING: Could not fill " + (needed - added) + " games for " + sp.player1.name + " & " + sp.player2.name + " — all valid opponents already played");
        }
      }
    }

    // ── Push VIP matches out of first 2 slots (conflict-safe) ──
    const vipSlotSize = courtCount;
    for (let i = 0; i < Math.min(vipSlotSize * 2, schedule.length); i++) {
      if (matchHasVip(schedule[i])) {
        // Find a swap candidate that won't create a cross-court conflict
        const iSlot = Math.floor(i / courtCount);
        for (let swapIdx = vipSlotSize * 2; swapIdx < schedule.length; swapIdx++) {
          if (matchHasVip(schedule[swapIdx])) continue;
          const swapSlot = Math.floor(swapIdx / courtCount);

          // Check: after swap, would slot `iSlot` have conflicts?
          const slotIMatches = schedule.filter((_, idx) => Math.floor(idx / courtCount) === iSlot && idx !== i);
          const slotIPlayerIds = new Set<string>();
          slotIMatches.forEach((m) => matchPlayerIds(m).forEach((id) => slotIPlayerIds.add(id)));
          const candidateForI = schedule[swapIdx];
          if (matchPlayerIds(candidateForI).some((id) => slotIPlayerIds.has(id))) continue;

          // Check: after swap, would slot `swapSlot` have conflicts?
          const slotSwapMatches = schedule.filter((_, idx) => Math.floor(idx / courtCount) === swapSlot && idx !== swapIdx);
          const slotSwapPlayerIds = new Set<string>();
          slotSwapMatches.forEach((m) => matchPlayerIds(m).forEach((id) => slotSwapPlayerIds.add(id)));
          const candidateForSwap = schedule[i];
          if (matchPlayerIds(candidateForSwap).some((id) => slotSwapPlayerIds.has(id))) continue;

          // Court pool check: in 3-court mode, don't swap across pools
          if (courtCount === 3) {
            const pI = schedule[i].courtPool || courtPoolForTiers(schedule[i].pair1.skillLevel, schedule[i].pair2.skillLevel);
            const pS = schedule[swapIdx].courtPool || courtPoolForTiers(schedule[swapIdx].pair1.skillLevel, schedule[swapIdx].pair2.skillLevel);
            if (pI !== pS) continue;
          }

          // Rest-gap check: tentatively swap, verify no back-to-back, undo if violated
          [schedule[i], schedule[swapIdx]] = [schedule[swapIdx], schedule[i]];
          const slotTotal = Math.ceil(schedule.length / courtCount);
          let hasBackToBack = false;
          for (const checkIdx of [i, swapIdx]) {
            const checkSlot = Math.floor(checkIdx / courtCount);
            for (let adj = Math.max(0, checkSlot - REST_GAP); adj <= Math.min(slotTotal - 1, checkSlot + REST_GAP); adj++) {
              if (adj === checkSlot) continue;
              for (let mi = adj * courtCount; mi < (adj + 1) * courtCount && mi < schedule.length; mi++) {
                if (matchPlayerIds(schedule[checkIdx]).some((pid) => matchPlayerIds(schedule[mi]).includes(pid))) {
                  hasBackToBack = true;
                }
              }
              if (hasBackToBack) break;
            }
            if (hasBackToBack) break;
          }
          if (hasBackToBack) {
            // Undo swap — this swap would introduce a back-to-back
            [schedule[i], schedule[swapIdx]] = [schedule[swapIdx], schedule[i]];
            continue;
          }
          break;
        }
      }
    }

    // ── Post-generation validation pass ─────────────────────────
    // Uses slotBoundaries for accurate slot detection (slots can have variable sizes)
    const validateSchedule = (sched: Match[]): string[] => {
      const violations: string[] = [];
      for (let slot = 0; slot < slotBoundaries.length; slot++) {
        const start = slotBoundaries[slot];
        const end = slot + 1 < slotBoundaries.length ? slotBoundaries[slot + 1] : sched.length;
        if (start >= sched.length) break; // empty trailing slots
        const slotMatches = sched.slice(start, end);
        const allIds = new Set<string>();
        for (const m of slotMatches) {
          for (const id of matchPlayerIds(m)) {
            if (allIds.has(id)) {
              const player = roster.find((p) => p.id === id);
              violations.push(`Slot ${slot + 1}: ${player?.name || id} on multiple courts`);
            }
            allIds.add(id);
          }
        }

        // Back-to-back check: compare this slot's players with the next non-empty slot
        if (slot + 1 < slotBoundaries.length) {
          const nextStart = slotBoundaries[slot + 1];
          const nextEnd = slot + 2 < slotBoundaries.length ? slotBoundaries[slot + 2] : sched.length;
          if (nextStart < sched.length) {
            const nextMatches = sched.slice(nextStart, nextEnd);
            for (const nm of nextMatches) {
              for (const id of matchPlayerIds(nm)) {
                if (allIds.has(id)) {
                  const player = roster.find((p) => p.id === id);
                  violations.push(`Slots ${slot + 1}-${slot + 2}: ${player?.name || id} back-to-back`);
                }
              }
            }
          }
        }
      }
      return violations;
    };

    // Hard block — remove forbidden matchups that slipped through
    for (let i = schedule.length - 1; i >= 0; i--) {
      const tiers = [schedule[i].pair1.skillLevel, schedule[i].pair2.skillLevel].sort().join("v");
      if (tiers === "AvC") {
        console.error("[PTO Schedule] FATAL: Removing A vs C match:", schedule[i].pair1.player1.name, "&", schedule[i].pair1.player2.name, "vs", schedule[i].pair2.player1.name, "&", schedule[i].pair2.player2.name);
        schedule.splice(i, 1);
      } else if (tiers === "BvC" && courtCount === 3) {
        console.error("[PTO Schedule] FATAL: Removing B vs C match in 3-court mode:", schedule[i].pair1.player1.name, "&", schedule[i].pair1.player2.name, "vs", schedule[i].pair2.player1.name, "&", schedule[i].pair2.player2.name);
        schedule.splice(i, 1);
      }
    }

    // ── Starvation repair: reduce max idle gaps by swapping matches between slots ──
    const MAX_IDLE = 3; // max consecutive idle slots before we try to repair
    const getSlotForIndex = (idx: number): number => {
      for (let s = slotBoundaries.length - 1; s >= 0; s--) {
        if (idx >= slotBoundaries[s]) return s;
      }
      return 0;
    };
    const getSlotRange = (slot: number): [number, number] => {
      const start = slotBoundaries[slot];
      const end = slot + 1 < slotBoundaries.length ? slotBoundaries[slot + 1] : schedule.length;
      return [start, end];
    };
    const getSlotPlayerIdSet = (slot: number): Set<string> => {
      const ids = new Set<string>();
      const [start, end] = getSlotRange(slot);
      for (let i = start; i < end && i < schedule.length; i++) {
        matchPlayerIds(schedule[i]).forEach(id => ids.add(id));
      }
      return ids;
    };
    // Check if swapping schedule[idxA] and schedule[idxB] would create conflicts
    const canSwap = (idxA: number, idxB: number): boolean => {
      const slotA = getSlotForIndex(idxA);
      const slotB = getSlotForIndex(idxB);
      const matchA = schedule[idxA];
      const matchB = schedule[idxB];
      const pidsA = matchPlayerIds(matchA);
      const pidsB = matchPlayerIds(matchB);
      // Check matchA in slotB: no cross-court conflict with other games in slotB
      const [startB, endB] = getSlotRange(slotB);
      for (let i = startB; i < endB && i < schedule.length; i++) {
        if (i === idxB) continue;
        if (matchPlayerIds(schedule[i]).some(id => pidsA.includes(id))) return false;
      }
      // Check matchB in slotA: no cross-court conflict with other games in slotA
      const [startA, endA] = getSlotRange(slotA);
      for (let i = startA; i < endA && i < schedule.length; i++) {
        if (i === idxA) continue;
        if (matchPlayerIds(schedule[i]).some(id => pidsB.includes(id))) return false;
      }
      // Check back-to-back: matchA in slotB must not conflict with adjacent slots
      for (const adjSlot of [slotB - 1, slotB + 1]) {
        if (adjSlot < 0 || adjSlot >= slotBoundaries.length || adjSlot === slotA) continue;
        const adjIds = getSlotPlayerIdSet(adjSlot);
        if (pidsA.some(id => adjIds.has(id))) return false;
      }
      // Check back-to-back: matchB in slotA must not conflict with adjacent slots
      for (const adjSlot of [slotA - 1, slotA + 1]) {
        if (adjSlot < 0 || adjSlot >= slotBoundaries.length || adjSlot === slotB) continue;
        const adjIds = getSlotPlayerIdSet(adjSlot);
        if (pidsB.some(id => adjIds.has(id))) return false;
      }
      // Check 3-court pool routing
      if (courtCount === 3) {
        const poolA = matchA.courtPool || courtPoolForTiers(matchA.pair1.skillLevel, matchA.pair2.skillLevel);
        const poolB = matchB.courtPool || courtPoolForTiers(matchB.pair1.skillLevel, matchB.pair2.skillLevel);
        if (poolA !== poolB) return false; // don't swap across court pools
      }
      return true;
    };

    for (let attempt = 0; attempt < 20; attempt++) {
      // Build player → slot activity map
      const playerSlots = new Map<string, number[]>();
      for (let i = 0; i < schedule.length; i++) {
        const slot = getSlotForIndex(i);
        for (const id of matchPlayerIds(schedule[i])) {
          if (!playerSlots.has(id)) playerSlots.set(id, []);
          const slots = playerSlots.get(id)!;
          if (!slots.includes(slot)) slots.push(slot);
        }
      }
      // Find the worst gap across all players (including trailing gaps)
      let worstPlayer = "";
      let worstGap = 0;
      let worstGapIdx = 0;
      let isTrailingGap = false;
      for (const [playerId, slots] of playerSlots) {
        slots.sort((a, b) => a - b);
        for (let i = 0; i < slots.length - 1; i++) {
          const gap = slots[i + 1] - slots[i];
          if (gap > worstGap) { worstGap = gap; worstPlayer = playerId; worstGapIdx = i; isTrailingGap = false; }
        }
        const trailing = (totalSlots - 1) - slots[slots.length - 1];
        if (trailing > worstGap) { worstGap = trailing; worstPlayer = playerId; worstGapIdx = slots.length - 1; isTrailingGap = true; }
      }
      if (worstGap <= MAX_IDLE) break;
      const slots = playerSlots.get(worstPlayer)!;
      slots.sort((a, b) => a - b);
      let swapped = false;
      let targetSlot: number;
      let srcIdx: number;
      if (isTrailingGap) {
        // Trailing gap: move last game to a later slot
        targetSlot = slots[worstGapIdx] + Math.floor(worstGap / 2);
        if (targetSlot >= slotBoundaries.length) continue;
        const [srcStart, srcEnd] = getSlotRange(slots[worstGapIdx]);
        srcIdx = -1;
        for (let si = srcStart; si < srcEnd && si < schedule.length; si++) {
          if (matchPlayerIds(schedule[si]).includes(worstPlayer)) { srcIdx = si; break; }
        }
      } else {
        // Interior gap: move match from end of gap to middle
        targetSlot = slots[worstGapIdx] + Math.floor(worstGap / 2);
        if (targetSlot >= slotBoundaries.length) continue;
        const [srcStart, srcEnd] = getSlotRange(slots[worstGapIdx + 1]);
        srcIdx = -1;
        for (let si = srcStart; si < srcEnd && si < schedule.length; si++) {
          if (matchPlayerIds(schedule[si]).includes(worstPlayer)) { srcIdx = si; break; }
        }
      }
      if (srcIdx === -1) continue;
      // Try swapping with any match in or near the target slot
      for (let offset = 0; offset <= 3; offset++) {
        for (const tSlot of [targetSlot, targetSlot - offset, targetSlot + offset]) {
          if (tSlot < 0 || tSlot >= slotBoundaries.length || swapped) continue;
          const [tgtStart, tgtEnd] = getSlotRange(tSlot);
          for (let ti = tgtStart; ti < tgtEnd && ti < schedule.length; ti++) {
            if (canSwap(srcIdx, ti)) {
              [schedule[srcIdx], schedule[ti]] = [schedule[ti], schedule[srcIdx]];
              swapped = true;
              break;
            }
          }
        }
        if (swapped) break;
      }
    }

      // Compute max gap for this trial
      const trialPlayerSlots = new Map<string, number[]>();
      for (let i = 0; i < schedule.length; i++) {
        const s = getSlotForIndex(i);
        for (const id of matchPlayerIds(schedule[i])) {
          if (!trialPlayerSlots.has(id)) trialPlayerSlots.set(id, []);
          const sl = trialPlayerSlots.get(id)!;
          if (!sl.includes(s)) sl.push(s);
        }
      }
      let trialScore = 0;
      for (const [, pSlots] of trialPlayerSlots) {
        pSlots.sort((a, b) => a - b);
        for (let i = 0; i < pSlots.length - 1; i++) trialScore = Math.max(trialScore, pSlots[i + 1] - pSlots[i]);
        trialScore = Math.max(trialScore, (totalSlots - 1) - pSlots[pSlots.length - 1]);
      }
      // Penalize bad distribution or empty courts
      if (courtCount === 2) {
        for (const bp of bPairs) { const st = pairOpponentStats.get(bp.id); if (st && st.vsC === 0) trialScore += 10; }
      }
      for (let s = 0; s < slotBoundaries.length; s++) {
        const st = slotBoundaries[s]; const en = s + 1 < slotBoundaries.length ? slotBoundaries[s + 1] : schedule.length;
        if (en - st < courtCount) trialScore += 5;
      }
      if (trialScore < bestTrialMaxGap) {
        bestTrialMaxGap = trialScore;
        bestTrialSchedule = [...schedule];
        bestTrialBoundaries = [...slotBoundaries];
      }
      if (bestTrialMaxGap <= MAX_IDLE) break; // good enough
    } // end trial loop

    // Restore best trial result
    schedule.length = 0;
    schedule.push(...bestTrialSchedule);
    slotBoundaries.length = 0;
    slotBoundaries.push(...bestTrialBoundaries);
    // Recalculate pairGameCount from best schedule
    allPairs.forEach((p) => pairGameCount.set(p.id, 0));
    schedule.forEach((m) => {
      pairGameCount.set(m.pair1.id, (pairGameCount.get(m.pair1.id) || 0) + 1);
      pairGameCount.set(m.pair2.id, (pairGameCount.get(m.pair2.id) || 0) + 1);
    });

    // Re-declare validateSchedule in this scope (originally inside trial loop)
    const validateScheduleFinal = (sched: Match[]): string[] => {
      const violations: string[] = [];
      for (let slot = 0; slot < slotBoundaries.length; slot++) {
        const start = slotBoundaries[slot];
        const end = slot + 1 < slotBoundaries.length ? slotBoundaries[slot + 1] : sched.length;
        if (start >= sched.length) break;
        const slotMatches = sched.slice(start, end);
        const allIds = new Set<string>();
        for (const m of slotMatches) {
          for (const id of matchPlayerIds(m)) {
            if (allIds.has(id)) {
              const player = roster.find((p) => p.id === id);
              violations.push(`Slot ${slot + 1}: ${player?.name || id} on multiple courts`);
            }
            allIds.add(id);
          }
        }
      }
      return violations;
    };
    const violations = validateScheduleFinal(schedule);
    if (violations.length > 0) {
      console.error("Schedule conflicts detected, attempting repair:", violations);
      // Repair: for each conflicting slot, remove the later match and try to fill it with a non-conflicting one
      const slotCount = Math.ceil(schedule.length / courtCount);
      for (let slot = 0; slot < slotCount; slot++) {
        const base = slot * courtCount;
        const slotPlayerIds = new Set<string>();
        for (let ci = base; ci < base + courtCount && ci < schedule.length; ci++) {
          const pids = matchPlayerIds(schedule[ci]);
          if (pids.some((id) => slotPlayerIds.has(id))) {
            // Conflict — remove this match and push to end
            const [conflicting] = schedule.splice(ci, 1);
            schedule.push(conflicting);
            ci--; // re-check this index
          } else {
            pids.forEach((id) => slotPlayerIds.add(id));
          }
        }
      }
      // Re-validate
      const remaining = validateScheduleFinal(schedule);
      if (remaining.length > 0) {
        console.error("Could not fully resolve conflicts:", remaining);
      }
    }

    // Number games
    schedule.forEach((m, idx) => { m.gameNumber = idx + 1; });

    // Auto-assign first matches to courts
    // In 3-court mode: Court 1 = C, Court 2 = B, Court 3 = A (each tier isolated)
    const now = new Date().toISOString();
    if (courtCount === 3) {
      const cMatch = schedule.find((m) => m.status === "pending" && m.courtPool === "C");
      const bMatch = schedule.find((m) => m.status === "pending" && m.courtPool === "B");
      const aMatch = schedule.find((m) => m.status === "pending" && m.courtPool === "A");
      if (cMatch) { cMatch.status = "playing"; cMatch.court = 1; cMatch.startedAt = now; }
      if (bMatch) { bMatch.status = "playing"; bMatch.court = 2; bMatch.startedAt = now; }
      if (aMatch) { aMatch.status = "playing"; aMatch.court = 3; aMatch.startedAt = now; }
    } else {
      for (let c = 0; c < courtCount && c < schedule.length; c++) {
        schedule[c].status = "playing";
        schedule[c].court = c + 1;
        schedule[c].startedAt = now;
      }
    }

    // ── Schedule validation logging ──────────────────────────────
    const pairSummary = allPairs.map(p => {
      const count = pairGameCount.get(p.id) || 0;
      return p.player1.name + " & " + p.player2.name + " (" + p.skillLevel + "): " + count + " games";
    }).join(", ");

    const counts = Array.from(pairGameCount.values());
    const minG = counts.length > 0 ? Math.min(...counts) : 0;
    const maxG = counts.length > 0 ? Math.max(...counts) : 0;
    const aCount = aPairs.length;
    const bCount = bPairs.length;
    const cCount = cPairs.length;

    const matchupBreakdown = { AvA: 0, BvB: 0, BvA: 0, CvC: 0, BvC: 0 };
    schedule.forEach(m => {
      if (m.matchupLabel === "A vs A") matchupBreakdown.AvA++;
      else if (m.matchupLabel === "B vs B") matchupBreakdown.BvB++;
      else if (m.matchupLabel === "B vs A") matchupBreakdown.BvA++;
      else if (m.matchupLabel === "C vs C") matchupBreakdown.CvC++;
      else if (m.matchupLabel === "B vs C") matchupBreakdown.BvC++;
    });

    console.log("[PTO Schedule] A=" + aCount + " B=" + bCount + " C=" + cCount + " | " + schedule.length + " games | Target=" + TARGET_GAMES_PER_PAIR + " | AvA=" + matchupBreakdown.AvA + " BvB=" + matchupBreakdown.BvB + " BvA=" + matchupBreakdown.BvA + " CvC=" + matchupBreakdown.CvC + " | Min=" + minG + " Max=" + maxG);
    console.log("[PTO Schedule] Per pair:", pairSummary);

    if (maxG - minG > 1) {
      console.warn("[PTO Schedule] WARNING: Equity gap of " + (maxG - minG) + " between pairs");
    }

    const zeroPairs = allPairs.filter(p => (pairGameCount.get(p.id) || 0) === 0);
    if (zeroPairs.length > 0) {
      console.error("[PTO Schedule] ERROR: " + zeroPairs.length + " pairs have 0 games: " + zeroPairs.map(p => p.player1.name + " & " + p.player2.name).join(", "));
    }

    // Save pairs to history (fire-and-forget, outside state update)
    if (!isSimulationMode() && !state.practiceMode) {
      const historyRows = allPairs.map((p) => ({
        player1_name: p.player1.name,
        player2_name: p.player2.name,
      }));
      if (historyRows.length > 0) {
        Promise.all(historyRows.map((r) =>
          query('INSERT INTO pair_history (player1_name, player2_name) VALUES (?, ?)', [r.player1_name, r.player2_name])
        )).catch(() => {});
      }
    }

    return {
      ...s,
      roster: roster,
      pairs: allPairs,
      matches: schedule,
      totalScheduledGames: schedule.length,
      waitlistedPlayers: waitlistedIds,
    };
    }); // end updateState
  }, [updateState]);

  /**
   * Find the "freeze line" — the index after which pending matches can be modified.
   * Frozen: all completed, all playing, plus the first `courtCount` pending matches (Up Next).
   * On Deck (next `courtCount` pending) are also frozen to avoid surprising players already told they're next.
   */
  const getFreezeLine = useCallback((matches: Match[], courtCount: number): number => {
    let pendingCount = 0;
    const frozenPendingCount = courtCount * 2; // Up Next + On Deck
    for (let i = 0; i < matches.length; i++) {
      if (matches[i].status === "pending") {
        pendingCount++;
        if (pendingCount >= frozenPendingCount) return i + 1;
      }
    }
    return matches.length; // Everything is frozen
  }, []);

  /**
   * Generate candidate matchups for a new pair against existing pairs, respecting tier rules.
   */
  const generateMatchesForNewPair = useCallback((
    newPair: Pair,
    existingPairs: Pair[],
    existingMatchups: Set<string>,
    courtCount: number,
    startGameNum: number,
  ): Match[] => {
    const tier = newPair.skillLevel;
    // Same-cohort opponents first, then cross-cohort as filler (2-court only)
    const sameCohortOpponents = existingPairs.filter((p) => p.skillLevel === tier && p.id !== newPair.id);
    let crossCohortOpponents: Pair[];
    if (courtCount === 3) {
      // 3-court: strictly same-tier only
      crossCohortOpponents = [];
    } else if (tier === "B") {
      crossCohortOpponents = existingPairs.filter((p) => p.skillLevel === "A" || p.skillLevel === "C");
    } else if (tier === "A") {
      crossCohortOpponents = existingPairs.filter((p) => p.skillLevel === "B");
    } else {
      crossCohortOpponents = existingPairs.filter((p) => p.skillLevel === "B");
    }
    const opponents = [...shuffle(sameCohortOpponents), ...shuffle(crossCohortOpponents)];

    const newMatches: Match[] = [];
    const targetGames = 4;
    for (const opp of opponents) {
      if (newMatches.length >= targetGames) break;
      const mKey = [newPair.id, opp.id].sort().join("|||");
      if (existingMatchups.has(mKey)) continue;

      const isCross = opp.skillLevel !== tier;
      const matchSkill = isCross ? "cross" as const : tier;
      const label = isCross ? `${tier} vs ${opp.skillLevel}` : `${tier} vs ${tier}`;
      const cpPool = courtPoolForTiers(tier, opp.skillLevel);
      newMatches.push({
        id: generateId(),
        pair1: newPair,
        pair2: opp,
        skillLevel: matchSkill,
        matchupLabel: label,
        status: "pending" as const,
        court: null,
        gameNumber: startGameNum + newMatches.length + 1,
        courtPool: cpPool,
      });
      existingMatchups.add(mKey);
    }

    // Fallback: if still short, try any unplayed valid opponent
    if (newMatches.length < targetGames) {
      console.warn("[PTO NewPair] Fallback: " + newPair.player1.name + " & " + newPair.player2.name + " only got " + newMatches.length + " unique games, finding unplayed matchups");
      const allValid = shuffle(existingPairs.filter(p => {
        if (p.id === newPair.id) return false;
        if (isForbiddenMatchup(tier, p.skillLevel)) return false;
        if (courtCount === 3 && p.skillLevel !== tier) return false;
        return true;
      }));
      for (const opp of allValid) {
        if (newMatches.length >= targetGames) break;
        const mKey = [newPair.id, opp.id].sort().join("|||");
        if (existingMatchups.has(mKey)) continue;
        const isCross = opp.skillLevel !== tier;
        newMatches.push({
          id: generateId(),
          pair1: newPair,
          pair2: opp,
          skillLevel: isCross ? "cross" as const : tier,
          matchupLabel: isCross ? `${tier} vs ${opp.skillLevel}` : `${tier} vs ${tier}`,
          status: "pending" as const,
          court: null,
          gameNumber: startGameNum + newMatches.length + 1,
          courtPool: courtPoolForTiers(tier, opp.skillLevel),
        });
        existingMatchups.add(mKey);
      }
    }

    return newMatches;
  }, []);

  /**
   * Insert new matches into the schedule after the freeze line,
   * prioritizing the new pair to play within 2-3 slots.
   */
  const insertMatchesAfterFreezeLine = useCallback((
    currentMatches: Match[],
    newMatches: Match[],
    courtCount: number,
  ): Match[] => {
    const freezeLine = (() => {
      let pendingCount = 0;
      const frozenPendingCount = courtCount * 2;
      for (let i = 0; i < currentMatches.length; i++) {
        if (currentMatches[i].status === "pending") {
          pendingCount++;
          if (pendingCount >= frozenPendingCount) return i + 1;
        }
      }
      return currentMatches.length;
    })();

    const frozen = currentMatches.slice(0, freezeLine);
    const mutable = [...currentMatches.slice(freezeLine)];

    // Insert new matches into the mutable portion using slot-aware placement
    // to avoid cross-court player conflicts
    const combined = [...mutable];
    const getMatchPlayerIds = (m: Match) => [
      m.pair1.player1.id, m.pair1.player2.id, m.pair2.player1.id, m.pair2.player2.id,
    ];

    // Helper: collect all player IDs in a given slot of the full schedule
    const getSlotPlayerIds = (allMatches: Match[], slotNum: number): Set<string> => {
      const ids = new Set<string>();
      const start = slotNum * courtCount;
      const end = start + courtCount;
      for (let i = start; i < end && i < allMatches.length; i++) {
        getMatchPlayerIds(allMatches[i]).forEach((id) => ids.add(id));
      }
      return ids;
    };

    for (const nm of newMatches) {
      const nmPlayerIds = getMatchPlayerIds(nm);
      let inserted = false;

      // Try to insert, checking each slot for same-slot conflicts AND rest-gap
      for (let insertPos = 0; insertPos <= combined.length; insertPos++) {
        // Build a temporary full schedule to check slot assignments
        const tentative = [...frozen, ...combined.slice(0, insertPos), nm, ...combined.slice(insertPos)];
        const absoluteIdx = frozen.length + insertPos;
        const slot = Math.floor(absoluteIdx / courtCount);

        // Check same-slot conflict (no player on two courts simultaneously)
        const slotIds = getSlotPlayerIds(tentative, slot);
        // Remove own players to re-add them (they're already counted)
        nmPlayerIds.forEach((id) => slotIds.delete(id));
        // Re-check: does any player in this match appear elsewhere in the slot?
        const sameSlotConflict = nmPlayerIds.some((id) => {
          // Count how many times this id appears in the slot
          const start = slot * courtCount;
          const end = Math.min(start + courtCount, tentative.length);
          let count = 0;
          for (let i = start; i < end; i++) {
            if (getMatchPlayerIds(tentative[i]).includes(id)) count++;
          }
          return count > 1;
        });
        if (sameSlotConflict) continue;

        // Check rest-gap: no player should appear in adjacent slot
        let restGapViolation = false;
        for (const adjSlot of [slot - 1, slot + 1]) {
          if (adjSlot < 0) continue;
          const adjIds = getSlotPlayerIds(tentative, adjSlot);
          if (nmPlayerIds.some((id) => adjIds.has(id))) {
            restGapViolation = true;
            break;
          }
        }
        if (restGapViolation) continue;

        combined.splice(insertPos, 0, nm);
        inserted = true;
        break;
      }

      // Fallback: append at end
      if (!inserted) {
        combined.push(nm);
      }
    }

    const result = [...frozen, ...combined];
    return result.map((m, i) => m.gameNumber !== i + 1 ? { ...m, gameNumber: i + 1 } : m);
  }, []);

  /**
   * Handle a single late-arriving player:
   * - If a same-tier player is on the waitlist, auto-pair them and insert matches
   * - Otherwise add to waitlist
   * Returns { paired: boolean, pairId?: string, partnerName?: string, firstGameSlot?: number }
   */
  const handleLateCheckIn = useCallback(
    (playerId: string, fixedPartnerName?: string): { paired: boolean; partnerName?: string; estimatedMinutes?: number } => {
      let result: { paired: boolean; partnerName?: string; estimatedMinutes?: number } = { paired: false };

      updateState((s) => {
        if (s.matches.length === 0) return s; // Session not started yet
        if (s.sessionConfig.checkInClosed) return s;

        const player = s.roster.find((p) => p.id === playerId);
        if (!player) return s;

        const tier = player.skillLevel;
        const currentWaitlist = s.waitlistedPlayers || [];
        const courtCount = s.sessionConfig.courtCount || 2;

        // Check if there's a fixed partner (VIP selection)
        let partner: Player | undefined;
        if (fixedPartnerName) {
          partner = s.roster.find(
            (p) => p.name.toLowerCase() === fixedPartnerName.toLowerCase() && p.id !== playerId
          );
          // If partner is on waitlist, remove them
          if (partner && currentWaitlist.includes(partner.id)) {
            // Good — use this partner
          } else if (partner && !s.pairs.some((pair) => pair.player1.id === partner!.id || pair.player2.id === partner!.id)) {
            // Partner exists, not paired yet — use them
          } else {
            partner = undefined; // Can't use this partner
          }
        }

        // If no fixed partner, check waitlist for same-tier player
        if (!partner) {
          const waitlistPartnerIdx = currentWaitlist.findIndex((wId) => {
            if (wId === playerId) return false;
            const wp = s.roster.find((p) => p.id === wId);
            return wp && wp.skillLevel === tier && wp.checkedIn;
          });

          if (waitlistPartnerIdx !== -1) {
            partner = s.roster.find((p) => p.id === currentWaitlist[waitlistPartnerIdx]);
          }
        }

        // No partner available — add to waitlist
        if (!partner) {
          result = { paired: false };
          return {
            ...s,
            waitlistedPlayers: [...currentWaitlist.filter((id) => id !== playerId), playerId],
          };
        }

        // Create new pair
        const newPair: Pair = {
          id: generateId(),
          player1: player,
          player2: partner,
          skillLevel: tier,
          wins: 0,
          losses: 0,
        };

        // Build existing matchup set
        const existingMatchups = new Set<string>();
        s.matches.forEach((m) => {
          existingMatchups.add([m.pair1.id, m.pair2.id].sort().join("|||"));
        });

        // Generate matches for the new pair
        const newMatches = generateMatchesForNewPair(
          newPair, s.pairs, existingMatchups, courtCount, s.matches.length,
        );

        // Insert matches into schedule after freeze line
        const updatedMatches = insertMatchesAfterFreezeLine(
          s.matches, newMatches, courtCount,
        );

        // Remove both players from waitlist
        const updatedWaitlist = currentWaitlist.filter(
          (id) => id !== playerId && id !== partner!.id
        );

        // Estimate minutes to first game
        const firstNewMatch = updatedMatches.find(
          (m) => m.pair1.id === newPair.id || m.pair2.id === newPair.id
        );
        const currentPlaying = updatedMatches.filter((m) => m.status === "playing");
        const firstNewIdx = firstNewMatch ? updatedMatches.indexOf(firstNewMatch) : -1;
        const currentIdx = currentPlaying.length > 0
          ? Math.max(...currentPlaying.map((m) => updatedMatches.indexOf(m)))
          : 0;
        const slotsAway = Math.max(0, Math.ceil((firstNewIdx - currentIdx) / courtCount));
        const estimatedMinutes = slotsAway * 7;

        result = { paired: true, partnerName: partner.name, estimatedMinutes };

        // Save pair history
        if (!isSimulationMode() && !s.practiceMode) {
          query('INSERT INTO pair_history (player1_name, player2_name) VALUES (?, ?)', [player.name, partner.name]).catch(() => {});
        }

        return {
          ...s,
          pairs: [...s.pairs, newPair],
          matches: updatedMatches,
          totalScheduledGames: updatedMatches.length,
          waitlistedPlayers: updatedWaitlist,
          newlyAddedPairIds: [newPair.id],
        };
      });

      return result;
    },
    [updateState, generateMatchesForNewPair, insertMatchesAfterFreezeLine]
  );

  /**
   * Regenerate the remaining schedule (everything after On Deck) using all current pairs.
   * Preserves completed, playing, Up Next, and On Deck matches.
   */
  const regenerateRemainingSchedule = useCallback(() => {
    updateState((s) => {
      if (s.matches.length === 0) return s;

      const courtCount = s.sessionConfig.courtCount || 2;
      const frozenPendingCount = courtCount * 2;

      // Split frozen vs mutable
      const frozen: Match[] = [];
      const mutable: Match[] = [];
      let pendingCount = 0;
      for (const m of s.matches) {
        if (m.status !== "pending") {
          frozen.push(m);
        } else {
          pendingCount++;
          if (pendingCount <= frozenPendingCount) {
            frozen.push(m);
          } else {
            mutable.push(m);
          }
        }
      }

      // Collect existing matchups from frozen matches
      const usedMatchups = new Set<string>();
      frozen.forEach((m) => {
        usedMatchups.add([m.pair1.id, m.pair2.id].sort().join("|||"));
      });

      // Count games per pair from frozen matches
      const pairGameCount = new Map<string, number>();
      s.pairs.forEach((p) => pairGameCount.set(p.id, 0));
      frozen.forEach((m) => {
        pairGameCount.set(m.pair1.id, (pairGameCount.get(m.pair1.id) || 0) + 1);
        pairGameCount.set(m.pair2.id, (pairGameCount.get(m.pair2.id) || 0) + 1);
      });

      // Generate all candidate matchups
      type CandidateMatch = { pair1: Pair; pair2: Pair; skillLevel: SkillTier | "cross"; matchupLabel: string; courtPool: "A" | "B" | "C" };
      const allCandidates: CandidateMatch[] = [];
      const aPairs = s.pairs.filter((p) => p.skillLevel === "A");
      const bPairs = s.pairs.filter((p) => p.skillLevel === "B");
      const cPairs = s.pairs.filter((p) => p.skillLevel === "C");

      for (let i = 0; i < aPairs.length; i++) {
        for (let j = i + 1; j < aPairs.length; j++) {
          const mKey = [aPairs[i].id, aPairs[j].id].sort().join("|||");
          if (!usedMatchups.has(mKey)) allCandidates.push({ pair1: aPairs[i], pair2: aPairs[j], skillLevel: "A", matchupLabel: "A vs A", courtPool: "A" });
        }
      }
      for (let i = 0; i < cPairs.length; i++) {
        for (let j = i + 1; j < cPairs.length; j++) {
          const mKey = [cPairs[i].id, cPairs[j].id].sort().join("|||");
          if (!usedMatchups.has(mKey)) allCandidates.push({ pair1: cPairs[i], pair2: cPairs[j], skillLevel: "C", matchupLabel: "C vs C", courtPool: "C" });
        }
      }
      // B vs B
      for (let i = 0; i < bPairs.length; i++) {
        for (let j = i + 1; j < bPairs.length; j++) {
          const mKey = [bPairs[i].id, bPairs[j].id].sort().join("|||");
          if (!usedMatchups.has(mKey)) allCandidates.push({ pair1: bPairs[i], pair2: bPairs[j], skillLevel: "B", matchupLabel: "B vs B", courtPool: "B" });
        }
      }
      // B vs A (cross) — only in 2-court mode
      if (courtCount === 2) {
        for (const bp of bPairs) {
          for (const ap of aPairs) {
            const mKey = [bp.id, ap.id].sort().join("|||");
            if (!usedMatchups.has(mKey)) allCandidates.push({ pair1: bp, pair2: ap, skillLevel: "cross", matchupLabel: "B vs A", courtPool: "B" });
          }
        }
      }
      // B vs C (cross) — only in 2-court mode
      if (courtCount === 2) {
        for (const bp of bPairs) {
          for (const cp of cPairs) {
            const mKey = [bp.id, cp.id].sort().join("|||");
            if (!usedMatchups.has(mKey)) allCandidates.push({ pair1: bp, pair2: cp, skillLevel: "cross", matchupLabel: "B vs C", courtPool: "C" });
          }
        }
      }

      // Schedule remaining using pickBestCandidate pattern
      const TARGET_GAMES_PER_PAIR = courtCount === 3 ? 3 : 4;
      const MAX_GAMES = 4; // Hard cap: no pair plays more than 4 games before playoffs

      const tierTargets: Record<SkillTier, { vsA: number; vsB: number; vsC: number }> = courtCount === 3
        ? { A: { vsA: 3, vsB: 0, vsC: 0 }, B: { vsA: 0, vsB: 3, vsC: 0 }, C: { vsA: 0, vsB: 0, vsC: 3 } }
        : { A: { vsA: 3, vsB: 1, vsC: 0 }, B: { vsA: 1, vsB: 2, vsC: 1 }, C: { vsA: 0, vsB: 1, vsC: 3 } };

      const pairOpponentStats = new Map<string, { vsA: number; vsB: number; vsC: number }>();
      s.pairs.forEach((p) => pairOpponentStats.set(p.id, { vsA: 0, vsB: 0, vsC: 0 }));
      frozen.forEach((m) => {
        const s1 = pairOpponentStats.get(m.pair1.id);
        const s2 = pairOpponentStats.get(m.pair2.id);
        if (s1) { if (m.pair2.skillLevel === "A") s1.vsA++; else if (m.pair2.skillLevel === "B") s1.vsB++; else s1.vsC++; }
        if (s2) { if (m.pair1.skillLevel === "A") s2.vsA++; else if (m.pair1.skillLevel === "B") s2.vsB++; else s2.vsC++; }
      });

      const durationMin = s.sessionConfig.durationMinutes || 85;
      const minutesPerGame = 7;
      const totalSlots = Math.floor(durationMin / minutesPerGame);
      const frozenSlots = Math.ceil(frozen.length / courtCount);
      const remainingSlots = Math.max(0, totalSlots - frozenSlots);

      let candidatePool = shuffle([...allCandidates]);
      const matchupKey = (p1Id: string, p2Id: string) => [p1Id, p2Id].sort().join("|||");
      const matchPlayerIds = (m: { pair1: Pair; pair2: Pair }) => [
        m.pair1.player1.id, m.pair1.player2.id, m.pair2.player1.id, m.pair2.player2.id,
      ];

      const regenerated: Match[] = [];
      const regenSlotBoundaries: number[] = [];
      const REST_GAP = 1;

      const getSlotPlayerIds = (slotIndex: number): Set<string> => {
        const ids = new Set<string>();
        if (slotIndex < 0 || slotIndex >= regenSlotBoundaries.length) return ids;
        const start = regenSlotBoundaries[slotIndex];
        const end = slotIndex + 1 < regenSlotBoundaries.length ? regenSlotBoundaries[slotIndex + 1] : regenerated.length;
        for (let i = start; i < end; i++) {
          matchPlayerIds(regenerated[i]).forEach((id) => ids.add(id));
        }
        return ids;
      };

      const pickBest = (
        pool: CandidateMatch[],
        slotPlayerIds: Set<string>,
        blockedPlayerIds: Set<string>,
        courtPoolFilter?: "A" | "B" | "C"
      ): number => {
        let bestIdx = -1;
        let bestScore = Infinity;
        for (let i = 0; i < pool.length; i++) {
          const c = pool[i];
          if (courtPoolFilter && c.courtPool !== courtPoolFilter) continue;
          const mKey = matchupKey(c.pair1.id, c.pair2.id);
          if (usedMatchups.has(mKey)) continue;
          const g1 = pairGameCount.get(c.pair1.id) || 0;
          const g2 = pairGameCount.get(c.pair2.id) || 0;
          if (g1 >= MAX_GAMES || g2 >= MAX_GAMES) continue;
          // Equity gate: no pair schedules more than 1 game ahead of the least-scheduled pair
          // Exclude 0-game pairs so late additions don't drag the minimum to 0 and deadlock
          const pgcVals = Array.from(pairGameCount.values());
          const activeVals = pgcVals.filter((c2) => c2 > 0);
          const minCount = activeVals.length > 0 ? Math.min(...activeVals) : 0;
          // Only block if BOTH pairs are ahead — allow catch-up matches
          if (Math.min(g1, g2) > minCount + 1) continue;
          const playerIds = matchPlayerIds(c);
          if (playerIds.some((id) => slotPlayerIds.has(id))) continue;
          if (playerIds.some((id) => blockedPlayerIds.has(id))) continue;
          // Distribution-aware scoring
          const t1 = c.pair1.skillLevel;
          const t2 = c.pair2.skillLevel;
          const stats1 = pairOpponentStats.get(c.pair1.id)!;
          const stats2 = pairOpponentStats.get(c.pair2.id)!;
          const tgt1 = tierTargets[t1];
          const tgt2 = tierTargets[t2];
          const vsCount = (st: typeof stats1, t: SkillTier) => t === "A" ? st.vsA : t === "B" ? st.vsB : st.vsC;
          const vsTarget = (tgt: typeof tgt1, t: SkillTier) => t === "A" ? tgt.vsA : t === "B" ? tgt.vsB : tgt.vsC;
          const deficit1 = vsTarget(tgt1, t2) - vsCount(stats1, t2);
          const deficit2 = vsTarget(tgt2, t1) - vsCount(stats2, t1);
          const d1 = deficit1 >= 0 ? deficit1 : deficit1 * 5;
          const d2 = deficit2 >= 0 ? deficit2 : deficit2 * 5;
          let score = -(d1 + d2) * 10 + (g1 + g2);
          if (g1 >= TARGET_GAMES_PER_PAIR) score += 100;
          if (g2 >= TARGET_GAMES_PER_PAIR) score += 100;
          if (c.skillLevel === "cross" && (deficit1 <= 0 || deficit2 <= 0)) {
            if (courtCount === 3) continue;
            score += 200;
          }
          if (score < bestScore) { bestScore = score; bestIdx = i; }
        }
        return bestIdx;
      };

      const commitCandidate = (idx: number, slotPlayerIds: Set<string>): Match => {
        const chosen = candidatePool.splice(idx, 1)[0];
        const mKey = matchupKey(chosen.pair1.id, chosen.pair2.id);
        usedMatchups.add(mKey);
        pairGameCount.set(chosen.pair1.id, (pairGameCount.get(chosen.pair1.id) || 0) + 1);
        pairGameCount.set(chosen.pair2.id, (pairGameCount.get(chosen.pair2.id) || 0) + 1);
        matchPlayerIds(chosen).forEach((id) => slotPlayerIds.add(id));

        // Track opponent tiers for distribution-aware scheduling
        const oppT1 = chosen.pair2.skillLevel;
        const oppT2 = chosen.pair1.skillLevel;
        const st1 = pairOpponentStats.get(chosen.pair1.id)!;
        const st2 = pairOpponentStats.get(chosen.pair2.id)!;
        if (oppT1 === "A") st1.vsA++; else if (oppT1 === "B") st1.vsB++; else st1.vsC++;
        if (oppT2 === "A") st2.vsA++; else if (oppT2 === "B") st2.vsB++; else st2.vsC++;

        return {
          id: generateId(), pair1: chosen.pair1, pair2: chosen.pair2,
          skillLevel: chosen.skillLevel, matchupLabel: chosen.matchupLabel,
          status: "pending" as const, court: null,
          courtPool: chosen.courtPool,
        };
      };

      for (let slot = 0; slot < remainingSlots; slot++) {
        regenSlotBoundaries.push(regenerated.length);

        const blockedPlayerIds = new Set<string>();
        for (let prev = Math.max(0, slot - REST_GAP); prev < slot; prev++) {
          getSlotPlayerIds(prev).forEach((id) => blockedPlayerIds.add(id));
        }
        // Also block players from the last few frozen matches
        if (slot < REST_GAP) {
          const lastFrozenSlot = frozenSlots - 1;
          for (let prev = Math.max(0, lastFrozenSlot - (REST_GAP - slot - 1)); prev <= lastFrozenSlot; prev++) {
            const base = prev * courtCount;
            for (let i = base; i < base + courtCount && i < frozen.length; i++) {
              matchPlayerIds(frozen[i]).forEach((id) => blockedPlayerIds.add(id));
            }
          }
        }

        const slotPlayerIds = new Set<string>();
        if (courtCount === 3) {
          const cIdx = pickBest(candidatePool, slotPlayerIds, blockedPlayerIds, "C");
          if (cIdx !== -1) regenerated.push(commitCandidate(cIdx, slotPlayerIds));
          const bIdx = pickBest(candidatePool, slotPlayerIds, blockedPlayerIds, "B");
          if (bIdx !== -1) regenerated.push(commitCandidate(bIdx, slotPlayerIds));
          const aIdx = pickBest(candidatePool, slotPlayerIds, blockedPlayerIds, "A");
          if (aIdx !== -1) regenerated.push(commitCandidate(aIdx, slotPlayerIds));
        } else {
          for (let ci = 0; ci < 2; ci++) {
            const idx = pickBest(candidatePool, slotPlayerIds, blockedPlayerIds);
            if (idx !== -1) regenerated.push(commitCandidate(idx, slotPlayerIds));
          }
        }
      }

      // Fallback: fill short pairs with random unplayed matchups
      const shortPairs = s.pairs.filter(p => (pairGameCount.get(p.id) || 0) < TARGET_GAMES_PER_PAIR);
      if (shortPairs.length > 0) {
        console.warn("[PTO Regen] Fallback: " + shortPairs.length + " pairs below target, finding unplayed matchups");
        for (const sp of shortPairs) {
          const needed = TARGET_GAMES_PER_PAIR - (pairGameCount.get(sp.id) || 0);
          const sameCohort = shuffle(s.pairs.filter(p => p.skillLevel === sp.skillLevel && p.id !== sp.id));
          const crossCohort = courtCount === 3 ? [] : shuffle(s.pairs.filter(p => {
            if (p.id === sp.id) return false;
            if (p.skillLevel === sp.skillLevel) return false;
            if (isForbiddenMatchup(sp.skillLevel, p.skillLevel)) return false;
            return true;
          }));
          const fallbackOpponents = [...sameCohort, ...crossCohort];
          let added = 0;
          for (const opp of fallbackOpponents) {
            if (added >= needed) break;
            const mKey = matchupKey(sp.id, opp.id);
            if (usedMatchups.has(mKey)) continue;
            const isCross = opp.skillLevel !== sp.skillLevel;
            const regenPool = courtPoolForTiers(sp.skillLevel, opp.skillLevel);
            regenerated.push({
              id: generateId(), pair1: sp, pair2: opp,
              skillLevel: isCross ? "cross" as const : sp.skillLevel,
              matchupLabel: isCross ? `${sp.skillLevel} vs ${opp.skillLevel}` : `${sp.skillLevel} vs ${sp.skillLevel}`,
              status: "pending" as const, court: null,
              courtPool: regenPool,
            });
            usedMatchups.add(mKey);
            pairGameCount.set(sp.id, (pairGameCount.get(sp.id) || 0) + 1);
            pairGameCount.set(opp.id, (pairGameCount.get(opp.id) || 0) + 1);
            added++;
          }
          if (added < needed) {
            console.error("[PTO Regen] WARNING: Could not fill " + (needed - added) + " games for " + sp.player1.name + " & " + sp.player2.name + " — all valid opponents already played");
          }
        }
      }

      // Hard block — remove forbidden matchups that slipped through
      for (let i = regenerated.length - 1; i >= 0; i--) {
        const tiers = [regenerated[i].pair1.skillLevel, regenerated[i].pair2.skillLevel].sort().join("v");
        if (tiers === "AvC") {
          console.error("[PTO Regen] FATAL: Removing A vs C match:", regenerated[i].pair1.player1.name, "vs", regenerated[i].pair2.player1.name);
          regenerated.splice(i, 1);
        } else if (tiers === "BvC" && courtCount === 3) {
          console.error("[PTO Regen] FATAL: Removing B vs C match in 3-court mode:", regenerated[i].pair1.player1.name, "vs", regenerated[i].pair2.player1.name);
          regenerated.splice(i, 1);
        }
      }

      const finalMatches = [...frozen, ...regenerated].map((m, i) =>
        m.gameNumber !== i + 1 ? { ...m, gameNumber: i + 1 } : m
      );

      return {
        ...s,
        matches: finalMatches,
        totalScheduledGames: finalMatches.length,
      };
    });
  }, [updateState]);

  /**
   * Close check-in — no more late arrivals accepted.
   */
  const closeCheckIn = useCallback(
    (closed: boolean) => {
      updateState((s) => ({
        ...s,
        sessionConfig: { ...s.sessionConfig, checkInClosed: closed },
      }));
    },
    [updateState]
  );

  /**
   * Legacy addLatePlayersToSchedule — now delegates to handleLateCheckIn for each unscheduled player.
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
      if (latePlayers.length < 2) return s;

      const courtCount = s.sessionConfig.courtCount || 2;
      const existingMatchups = new Set<string>();
      s.matches.forEach((m) => {
        existingMatchups.add([m.pair1.id, m.pair2.id].sort().join("|||"));
      });

      // Group by tier and pair them
      const newPairs: Pair[] = [];
      const tiers: SkillTier[] = ["A", "B", "C"];
      for (const tier of tiers) {
        const tierPlayers = latePlayers.filter((p) => p.skillLevel === tier);
        for (let i = 0; i + 1 < tierPlayers.length; i += 2) {
          newPairs.push({
            id: generateId(),
            player1: tierPlayers[i],
            player2: tierPlayers[i + 1],
            skillLevel: tier,
            wins: 0, losses: 0,
          });
        }
      }

      if (newPairs.length === 0) return s;

      let allNewMatches: Match[] = [];
      for (const newPair of newPairs) {
        const matches = generateMatchesForNewPair(
          newPair, [...s.pairs, ...newPairs.filter((p) => p.id !== newPair.id)],
          existingMatchups, courtCount, s.matches.length + allNewMatches.length,
        );
        allNewMatches = [...allNewMatches, ...matches];
      }

      const updatedMatches = insertMatchesAfterFreezeLine(
        s.matches, allNewMatches, courtCount,
      );

      return {
        ...s,
        pairs: [...s.pairs, ...newPairs],
        matches: updatedMatches,
        totalScheduledGames: updatedMatches.length,
        newlyAddedPairIds: newPairs.map((p) => p.id),
      };
    });
  }, [updateState, generateMatchesForNewPair, insertMatchesAfterFreezeLine]);

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

        // Find next pending match for the freed court
        // Both teams from the skipped match should rest — add them to recentPlayerIds
        if (freedCourt) {
          // Global rest tracking: scan ALL matches completed within last 7 minutes
          const recentPlayerIds = new Set<string>();
          const now = Date.now();
          for (const m of updatedMatches) {
            if (m.status === "completed" && m.completedAt && (now - Date.parse(m.completedAt)) < 420000) {
              getMatchPlayerIds(m).forEach((id) => recentPlayerIds.add(id));
            }
          }
          // Add skipped match players so neither team is immediately reassigned
          getMatchPlayerIds(skipped).forEach((id) => recentPlayerIds.add(id));
          const courtCount = s.sessionConfig.courtCount || 2;

          const nextPending = findNextPendingForCourt(updatedMatches, freedCourt, courtCount, recentPlayerIds, s.pairs, updatedMatches, true);
          if (nextPending) {
            const idx = updatedMatches.findIndex((m) => m.id === nextPending.id);
            if (idx !== -1) {
              updatedMatches[idx] = { ...nextPending, status: "playing", court: freedCourt, startedAt: new Date().toISOString() };
            }
          }
        }

        const renumbered = updatedMatches.map((m, i) => m.gameNumber !== i + 1 ? { ...m, gameNumber: i + 1 } : m);

        return { ...s, matches: renumbered };
      });
    },
    [updateState]
  );

  // Swap two players between different pairs (same tier) — for pair editing
  const swapPlayersInPairs = useCallback(
    (pairAId: string, playerAId: string, pairBId: string, playerBId: string) => {
      updateState((s) => {
        const pairA = s.pairs.find((p) => p.id === pairAId);
        const pairB = s.pairs.find((p) => p.id === pairBId);
        if (!pairA || !pairB) return s;
        if (pairA.skillLevel !== pairB.skillLevel) return s;

        const playerA = pairA.player1.id === playerAId ? pairA.player1 : pairA.player2;
        const playerB = pairB.player1.id === playerBId ? pairB.player1 : pairB.player2;

        const updatedPairs = s.pairs.map((p) => {
          if (p.id === pairAId) {
            if (p.player1.id === playerAId) return { ...p, player1: playerB };
            return { ...p, player2: playerB };
          }
          if (p.id === pairBId) {
            if (p.player1.id === playerBId) return { ...p, player1: playerA };
            return { ...p, player2: playerA };
          }
          return p;
        });

        const updatedMatches = syncPairsToMatches(updatedPairs, s.matches);
        return { ...s, pairs: updatedPairs, matches: updatedMatches };
      });
    },
    [updateState]
  );

  // Swap a waitlisted player into a pair, displacing one player to the waitlist
  const swapWaitlistPlayer = useCallback(
    (pairId: string, displacedPlayerId: string, waitlistPlayer: Player) => {
      updateState((s) => {
        const pair = s.pairs.find((p) => p.id === pairId);
        if (!pair) return s;
        if (pair.skillLevel !== waitlistPlayer.skillLevel) return s;

        // Block if displaced player is currently playing
        const isPlaying = s.matches.some(
          (m) => m.status === "playing" && getMatchPlayerIds(m).includes(displacedPlayerId)
        );
        if (isPlaying) return s;

        // Update pair: replace displaced player with waitlist player
        const updatedPlayer: Player = { ...waitlistPlayer, checkedIn: true, checkInTime: new Date().toISOString() };
        const updatedPairs = s.pairs.map((p) => {
          if (p.id !== pairId) return p;
          if (p.player1.id === displacedPlayerId) return { ...p, player1: updatedPlayer };
          if (p.player2.id === displacedPlayerId) return { ...p, player2: updatedPlayer };
          return p;
        });

        // Sync only non-completed matches
        const updatedMatches = s.matches.map((m) => {
          if (m.status === "completed") return m;
          const pairMap = new Map(updatedPairs.map((p) => [p.id, p]));
          return {
            ...m,
            pair1: pairMap.get(m.pair1.id) || m.pair1,
            pair2: pairMap.get(m.pair2.id) || m.pair2,
          };
        });

        // Update waitlist: remove incoming player, add displaced player
        const currentWaitlist = s.waitlistedPlayers || [];
        const updatedWaitlist = [
          ...currentWaitlist.filter((id) => id !== waitlistPlayer.id),
          displacedPlayerId,
        ];

        return { ...s, pairs: updatedPairs, matches: updatedMatches, waitlistedPlayers: updatedWaitlist };
      });
    },
    [updateState]
  );

  // Lock/unlock pairs
  const lockPairs = useCallback(
    () => {
      updateState((s) => ({ ...s, pairsLocked: !s.pairsLocked }));
    },
    [updateState]
  );
  const replacePlayerInPair = useCallback(
    (oldPlayerId: string, newPlayerId: string) => {
      updateState((s) => {
        const oldPlayer = s.roster.find((p) => p.id === oldPlayerId);
        let newPlayer = s.roster.find((p) => p.id === newPlayerId);
        if (!oldPlayer || !newPlayer) return s;

        // Block if the old player is currently playing
        const isPlaying = s.matches.some(
          (m) => m.status === "playing" && getMatchPlayerIds(m).includes(oldPlayerId)
        );
        if (isPlaying) return s;

        // Find which pair contains the old player
        const targetPair = s.pairs.find(
          (p) => p.player1.id === oldPlayerId || p.player2.id === oldPlayerId
        );
        if (!targetPair) return s;

        // Update the master pairs list
        const updatedPairs = s.pairs.map((pair) => {
          if (pair.id !== targetPair.id) return pair;
          if (pair.player1.id === oldPlayerId) return { ...pair, player1: newPlayer! };
          if (pair.player2.id === oldPlayerId) return { ...pair, player2: newPlayer! };
          return pair;
        });

        // Sync only non-completed matches
        const updatedMatches = s.matches.map((m) => {
          if (m.status === "completed") return m;
          const pairMap = new Map(updatedPairs.map((p) => [p.id, p]));
          return {
            ...m,
            pair1: pairMap.get(m.pair1.id) || m.pair1,
            pair2: pairMap.get(m.pair2.id) || m.pair2,
          };
        });

        // Mark old player as checked out, new player as checked in
        const updatedRoster = s.roster.map((p) => {
          if (p.id === oldPlayerId) return { ...p, checkedIn: false };
          if (p.id === newPlayerId) return { ...p, checkedIn: true, checkInTime: new Date().toISOString() };
          return p;
        });

        return { ...s, roster: updatedRoster, pairs: updatedPairs, matches: updatedMatches };
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
      // Award leaderboard points (fire-and-forget, outside state updater)
      const match = state.matches.find((m) => m.id === matchId);
      if (match) {
        const winnerPair = match.pair1.id === winnerPairId ? match.pair1 : match.pair2;
        awardMatchPoints(winnerPair, 3, "regular_win", matchId, state.practiceMode);
      }

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

        // Update pairGamesWatched (always, regardless of mode)
        const prevWatched = { ...(s.pairGamesWatched || {}) };
        const completedPairIds = new Set([match.pair1.id, match.pair2.id]);
        for (const pair of updatedPairs) {
          if (completedPairIds.has(pair.id)) {
            prevWatched[pair.id] = 0;
          } else {
            prevWatched[pair.id] = (prevWatched[pair.id] || 0) + 1;
          }
        }
        const updatedPairGamesWatched = prevWatched;

        if (freedCourt) {
          const courtCount = s.sessionConfig.courtCount || 2;
          // Completion-order rest gap: players in last N completed matches are resting
          const completedByTime = updatedMatches
            .filter((m) => m.status === "completed" && m.completedAt)
            .sort((a, b) => Date.parse(b.completedAt!) - Date.parse(a.completedAt!));
          const recentPlayerIds = new Set<string>();
          const restWindow = courtCount; // rest for 1 full round of court completions
          for (let i = 0; i < Math.min(restWindow, completedByTime.length); i++) {
            getMatchPlayerIds(completedByTime[i]).forEach((id) => recentPlayerIds.add(id));
          }

          if (s.sessionConfig.dynamicMode) {
            const TARGET = courtCount === 3 ? 3 : 4;
            const available = getAvailableTeams(updatedPairs, updatedMatches, updatedPairGamesWatched, TARGET);
            const nextMatch = generateNextMatch(available, freedCourt, courtCount, recentPlayerIds, updatedMatches);
            if (nextMatch) {
              updatedMatches = [...updatedMatches, { ...nextMatch, status: "playing", court: freedCourt, startedAt: new Date().toISOString(), gameNumber: updatedMatches.length + 1 }];
            }
          } else {
            const nextPending = findNextPendingForCourt(updatedMatches, freedCourt, courtCount, recentPlayerIds, updatedPairs, updatedMatches, false);
            if (nextPending) {
              const idx = updatedMatches.findIndex((m) => m.id === nextPending.id);
              if (idx !== -1) {
                updatedMatches[idx] = { ...nextPending, status: "playing", court: freedCourt, startedAt: new Date().toISOString() };
              }
            }
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
          pairGamesWatched: updatedPairGamesWatched,
        };
      });
    },
    [updateState, state.matches]
  );

  const setOddPlayerDecisions = useCallback(
    (decisions: OddPlayerDecision[]) => {
      updateState((s) => ({ ...s, oddPlayerDecisions: decisions }));
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

  const resetSession = useCallback((keepRoster = false) => {
    updateState((prev) => {
      if (keepRoster && prev.roster.length > 0) {
        const freshRoster = prev.roster.map(p => ({
          ...p,
          checkedIn: false,
          checkInTime: null,
          wins: 0,
          losses: 0,
          gamesPlayed: 0,
        }));
        return { ...DEFAULT_STATE, roster: freshRoster, playoffMatches: [], playoffsStarted: false };
      }
      return { ...DEFAULT_STATE, playoffMatches: [], playoffsStarted: false };
    });
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

      const allStandings = Array.from(pairMap.entries()).map(([key, v]) => ({ key, ...v }));
      const byTier = (tier: SkillTier) => allStandings.filter((p) => p.pair.skillLevel === tier).sort((a, b) => {
        if (b.winPct !== a.winPct) return b.winPct - a.winPct;
        // Head-to-head tiebreaker
        const h2h = getHeadToHead(a.pair.id, b.pair.id, s.matches);
        if (h2h !== 0) return -h2h; // positive means a wins, so a should rank higher (lower index)
        if (b.gamesPlayed !== a.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;
        return b.wins - a.wins;
      });

      // Playoff seeding: A-tier pairs first (by win%), then B-tier fills remaining to 8.
      // Override: if a B pair beat a specific A pair in round-robin AND has >= win%,
      // the B pair leapfrogs that A pair in seeding.
      const aPairsRanked = byTier("A");
      const bPairsRanked = byTier("B");
      const spotsForB = Math.max(0, 8 - aPairsRanked.length);
      const seeding = [...aPairsRanked]; // start with all A pairs
      const bCandidates = bPairsRanked.slice(0, spotsForB);
      for (const bEntry of bCandidates) {
        let insertIdx = seeding.length; // default: after all current entries
        // Check each A pair from top to bottom — find highest A pair this B can leapfrog
        for (let i = 0; i < seeding.length; i++) {
          if (seeding[i].pair.skillLevel !== "A") continue;
          const h2h = getHeadToHead(bEntry.pair.id, seeding[i].pair.id, s.matches);
          // h2h > 0 means B won the head-to-head against this A pair
          if (h2h > 0 && bEntry.winPct >= seeding[i].winPct) {
            insertIdx = i; // leapfrog above this A pair
            break; // take the highest earned position
          }
        }
        seeding.splice(insertIdx, 0, bEntry);
      }
      const top = seeding.slice(0, 8);

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
        pm.court = courtNum;
        courtNum++;
      }

      return { ...s, playoffsStarted: true, playoffMatches };
    });
  }, [updateState]);

  // Remove player mid-session — also removes their pair, generates replacement matches for orphaned opponents
  // Returns { success, affected } for UI feedback
  const removePlayerMidSession = useCallback(
    (playerId: string): { success: boolean; affected: number } => {
      let result = { success: false, affected: 0 };
      updateState((s) => {
        const player = s.roster.find((p) => p.id === playerId);
        if (!player) return s;

        const updatedRoster = s.roster.map((p) =>
          p.id === playerId ? { ...p, checkedIn: false, isActive: false } : p
        );

        // Find and remove pairs containing this player
        const playerPairIds = new Set<string>();
        s.pairs.forEach((pair) => {
          if (pair.player1.id === playerId || pair.player2.id === playerId) {
            playerPairIds.add(pair.id);
          }
        });

        const updatedPairs = s.pairs.filter((p) => !playerPairIds.has(p.id));

        // Auto-forfeit any playing match involving this player's pair
        // The opponent wins by forfeit so their stats are updated correctly
        let updatedMatches = s.matches.map((m) => {
          if (m.status !== "playing") return m;
          const pair1Removed = playerPairIds.has(m.pair1.id);
          const pair2Removed = playerPairIds.has(m.pair2.id);
          if (!pair1Removed && !pair2Removed) return m;
          // Forfeit: opponent wins
          const winnerPair = pair1Removed ? m.pair2 : m.pair1;
          const loserPair = pair1Removed ? m.pair1 : m.pair2;
          return { ...m, status: "completed" as const, winner: winnerPair, loser: loserPair, completedAt: new Date().toISOString() };
        });

        // Find orphaned opponents (pairs that lose pending/forfeited games due to removal)
        const orphanedPairIds = new Set<string>();
        s.matches.forEach((m) => {
          if (m.status !== "pending" && m.status !== "playing") return;
          if (playerPairIds.has(m.pair1.id)) orphanedPairIds.add(m.pair2.id);
          if (playerPairIds.has(m.pair2.id)) orphanedPairIds.add(m.pair1.id);
        });

        // Count and remove pending matches that include this player's pair
        const beforeCount = updatedMatches.filter((m) => m.status === "pending").length;
        updatedMatches = updatedMatches.filter((m) => {
          if (m.status !== "pending") return true;
          return !playerPairIds.has(m.pair1.id) && !playerPairIds.has(m.pair2.id);
        });
        const afterCount = updatedMatches.filter((m) => m.status === "pending").length;
        const affected = beforeCount - afterCount;

        // Generate replacement matches for orphaned pairs
        const existingMatchups = new Set<string>();
        updatedMatches.forEach((m) => {
          existingMatchups.add([m.pair1.id, m.pair2.id].sort().join("|||"));
        });

        const courtCount = s.sessionConfig.courtCount || 2;
        let gameNum = updatedMatches.length;
        const replacementMatches: Match[] = [];

        for (const orphanId of orphanedPairIds) {
          if (playerPairIds.has(orphanId)) continue; // Skip if orphan is also being removed
          const orphanPair = updatedPairs.find((p) => p.id === orphanId);
          if (!orphanPair) continue;

          // Count how many games this pair still has pending
          const pendingGames = updatedMatches.filter(
            (m) => m.status === "pending" && (m.pair1.id === orphanId || m.pair2.id === orphanId)
          ).length;

          // Find eligible opponents: same-cohort first, then cross-cohort as filler (2-court only)
          const tier = orphanPair.skillLevel;
          const sameCohort = updatedPairs.filter((p) => p.skillLevel === tier && p.id !== orphanId);
          let crossCohort: Pair[];
          if (courtCount === 3) {
            // 3-court: strictly same-tier only
            crossCohort = [];
          } else if (tier === "B") {
            crossCohort = updatedPairs.filter((p) => (p.skillLevel === "A" || p.skillLevel === "C") && p.id !== orphanId);
          } else if (tier === "A") {
            crossCohort = updatedPairs.filter((p) => p.skillLevel === "B" && p.id !== orphanId);
          } else {
            crossCohort = updatedPairs.filter((p) => p.skillLevel === "B" && p.id !== orphanId);
          }
          const opponents = [...shuffle(sameCohort), ...shuffle(crossCohort)];

          const targetTotal = 3; // Aim for minimum games
          const needed = Math.max(0, targetTotal - pendingGames);
          let added = 0;

          for (const opp of opponents) {
            if (added >= needed) break;
            const mKey = [orphanId, opp.id].sort().join("|||");
            if (existingMatchups.has(mKey)) continue;

            const isCross = opp.skillLevel !== tier;
            const matchSkill = isCross ? "cross" as const : tier;
            const label = isCross ? `${tier} vs ${opp.skillLevel}` : `${tier} vs ${tier}`;
            gameNum++;
            replacementMatches.push({
              id: generateId(),
              pair1: orphanPair,
              pair2: opp,
              skillLevel: matchSkill,
              matchupLabel: label,
              status: "pending",
              court: null,
              gameNumber: gameNum,
              courtPool: courtPoolForTiers(tier, opp.skillLevel),
            });
            existingMatchups.add(mKey);
            added++;
          }

          // Fallback: if still short, try any unplayed valid opponent
          if (added < needed) {
            console.warn("[PTO Remove] Fallback: " + orphanPair.player1.name + " & " + orphanPair.player2.name + " only got " + added + "/" + needed + " unique replacements, finding unplayed matchups");
            const allValid = shuffle(updatedPairs.filter(p => {
              if (p.id === orphanId) return false;
              if (isForbiddenMatchup(tier, p.skillLevel)) return false;
              if (courtCount === 3 && p.skillLevel !== tier) return false;
              return true;
            }));
            for (const opp of allValid) {
              if (added >= needed) break;
              const mKey2 = [orphanId, opp.id].sort().join("|||");
              if (existingMatchups.has(mKey2)) continue;
              const isCross2 = opp.skillLevel !== tier;
              gameNum++;
              replacementMatches.push({
                id: generateId(),
                pair1: orphanPair,
                pair2: opp,
                skillLevel: isCross2 ? "cross" as const : tier,
                matchupLabel: isCross2 ? `${tier} vs ${opp.skillLevel}` : `${tier} vs ${tier}`,
                status: "pending",
                court: null,
                gameNumber: gameNum,
                courtPool: courtPoolForTiers(tier, opp.skillLevel),
              });
              existingMatchups.add(mKey2);
              added++;
            }
          }
        }

        updatedMatches = [...updatedMatches, ...replacementMatches];

        // Sync remaining pairs (only updates non-completed matches)
        updatedMatches = syncPairsToMatches(updatedPairs, updatedMatches);

        // Defensive: remove any non-completed match that still references a removed pair
        const activePairIds = new Set(updatedPairs.map((p) => p.id));
        updatedMatches = updatedMatches.filter((m) => {
          if (m.status === "completed") return true;
          return activePairIds.has(m.pair1.id) && activePairIds.has(m.pair2.id);
        });

        // Renumber without mutating — create new objects
        updatedMatches = updatedMatches.map((m, i) => m.gameNumber !== i + 1 ? { ...m, gameNumber: i + 1 } : m);

        result = { success: true, affected };

        return {
          ...s,
          roster: updatedRoster,
          pairs: updatedPairs,
          matches: updatedMatches,
          totalScheduledGames: updatedMatches.length,
        };
      });
      return result;
    },
    [updateState]
  );

  // Swap a player out of the session and replace with a new named player
  // The new player inherits the old player's pair and remaining schedule
  const swapPlayerMidSession = useCallback(
    (oldPlayerId: string, newPlayerName: string, tier: SkillTier): { success: boolean; affected: number } => {
      let result = { success: false, affected: 0 };
      updateState((s) => {
        const oldPlayer = s.roster.find((p) => p.id === oldPlayerId);
        if (!oldPlayer) return s;

        // Block if the old player is currently playing
        const isPlaying = s.matches.some(
          (m) => m.status === "playing" && getMatchPlayerIds(m).includes(oldPlayerId)
        );
        if (isPlaying) return s;

        // Create the new player
        const newPlayer: Player = {
          id: generateId(),
          name: newPlayerName,
          skillLevel: tier,
          checkedIn: true,
          checkInTime: new Date().toISOString(),
          wins: 0,
          losses: 0,
          gamesPlayed: 0,
        };

        // Find which pair contains the old player
        const targetPair = s.pairs.find(
          (p) => p.player1.id === oldPlayerId || p.player2.id === oldPlayerId
        );
        if (!targetPair) return s;

        // Update the master pairs list — replace old player with new
        const updatedPairs = s.pairs.map((pair) => {
          if (pair.id !== targetPair.id) return pair;
          if (pair.player1.id === oldPlayerId) return { ...pair, player1: newPlayer };
          if (pair.player2.id === oldPlayerId) return { ...pair, player2: newPlayer };
          return pair;
        });

        // Sync only non-completed matches
        let affected = 0;
        const updatedMatches = s.matches.map((m) => {
          if (m.status === "completed") return m;
          const pairMap = new Map(updatedPairs.map((p) => [p.id, p]));
          const involves = m.pair1.id === targetPair.id || m.pair2.id === targetPair.id;
          if (involves) affected++;
          return {
            ...m,
            pair1: pairMap.get(m.pair1.id) || m.pair1,
            pair2: pairMap.get(m.pair2.id) || m.pair2,
          };
        });

        // Update roster: mark old player inactive, add new player
        const updatedRoster = [
          ...s.roster.map((p) =>
            p.id === oldPlayerId ? { ...p, checkedIn: false, isActive: false } : p
          ),
          newPlayer,
        ];

        result = { success: true, affected };

        return { ...s, roster: updatedRoster, pairs: updatedPairs, matches: updatedMatches };
      });
      return result;
    },
    [updateState]
  );

  // Add a player mid-session — creates pair with another unpaired same-tier player or solo
  const addPlayerMidSession = useCallback(
    (name: string, tier: SkillTier): { success: boolean; affected: number } => {
      let result = { success: false, affected: 0 };
      updateState((s) => {
        // Check for duplicate name
        if (s.roster.some((p) => p.name.toLowerCase() === name.toLowerCase())) return s;

        const newPlayer: Player = {
          id: generateId(),
          name,
          skillLevel: tier,
          checkedIn: true,
          checkInTime: new Date().toISOString(),
          wins: 0,
          losses: 0,
          gamesPlayed: 0,
        };

        const updatedRoster = [...s.roster, newPlayer];

        // Find an unpaired same-tier player (checked in but not in any active pair)
        const pairedPlayerIds = new Set<string>();
        s.pairs.forEach((p) => {
          pairedPlayerIds.add(p.player1.id);
          pairedPlayerIds.add(p.player2.id);
        });

        const unpairedSameTier = updatedRoster.filter(
          (p) => p.checkedIn && p.skillLevel === tier && !pairedPlayerIds.has(p.id) && p.id !== newPlayer.id
        );

        if (unpairedSameTier.length === 0) {
          // No partner available — add to roster but can't schedule yet
          result = { success: true, affected: 0 };
          return { ...s, roster: updatedRoster };
        }

        const partner = unpairedSameTier[0];
        const newPair: Pair = {
          id: generateId(),
          player1: newPlayer,
          player2: partner,
          skillLevel: tier,
          wins: 0,
          losses: 0,
        };

        // Generate matches for the new pair against existing pairs
        const courtCount = s.sessionConfig.courtCount || 2;
        const newMatches: Match[] = [];
        let gameNum = s.totalScheduledGames;

        // Find opponent pairs: same-cohort first, then cross-cohort as filler
        const sameCohort = s.pairs.filter((p) => p.skillLevel === tier && p.id !== newPair.id);
        let crossCohort: Pair[];
        if (courtCount === 3) {
          // 3-court: strictly same-tier only
          crossCohort = [];
        } else if (tier === "B") {
          crossCohort = s.pairs.filter((p) => p.skillLevel === "A" || p.skillLevel === "C");
        } else if (tier === "A") {
          crossCohort = s.pairs.filter((p) => p.skillLevel === "B");
        } else {
          crossCohort = s.pairs.filter((p) => p.skillLevel === "B");
        }
        const opponents = [...shuffle(sameCohort), ...shuffle(crossCohort)];

        // Existing matchup keys to avoid duplicates
        const existingMatchups = new Set<string>();
        s.matches.forEach((m) => {
          existingMatchups.add([m.pair1.id, m.pair2.id].sort().join("|||"));
        });

        const targetGames = 4;
        for (let g = 0; g < opponents.length && newMatches.length < targetGames; g++) {
          const opp = opponents[g];
          const mKey = [newPair.id, opp.id].sort().join("|||");
          if (existingMatchups.has(mKey)) continue;

          const isCross = opp.skillLevel !== tier;
          const matchSkill = isCross ? "cross" as const : tier;
          const label = isCross ? `${tier} vs ${opp.skillLevel}` : `${tier} vs ${tier}`;
          gameNum++;
          newMatches.push({
            id: generateId(),
            pair1: newPair,
            pair2: opp,
            skillLevel: matchSkill,
            matchupLabel: label,
            status: "pending",
            court: null,
            gameNumber: gameNum,
            courtPool: courtPoolForTiers(tier, opp.skillLevel),
          });
        }

        // Fallback: if still short, try any unplayed valid opponent
        if (newMatches.length < targetGames) {
          console.warn("[PTO AddMid] Fallback: " + newPair.player1.name + " & " + newPair.player2.name + " only got " + newMatches.length + " unique games, finding unplayed matchups");
          const allValid = shuffle(s.pairs.filter(p => {
            if (p.id === newPair.id) return false;
            if (isForbiddenMatchup(tier, p.skillLevel)) return false;
            if (courtCount === 3 && p.skillLevel !== tier) return false;
            return true;
          }));
          for (const opp of allValid) {
            if (newMatches.length >= targetGames) break;
            const mKey2 = [newPair.id, opp.id].sort().join("|||");
            if (existingMatchups.has(mKey2)) continue;
            const isCross2 = opp.skillLevel !== tier;
            gameNum++;
            newMatches.push({
              id: generateId(),
              pair1: newPair,
              pair2: opp,
              skillLevel: isCross2 ? "cross" as const : tier,
              matchupLabel: isCross2 ? `${tier} vs ${opp.skillLevel}` : `${tier} vs ${tier}`,
              status: "pending",
              court: null,
              gameNumber: gameNum,
              courtPool: courtPoolForTiers(tier, opp.skillLevel),
            });
            existingMatchups.add(mKey2);
          }
        }

        result = { success: true, affected: newMatches.length };

        return {
          ...s,
          roster: updatedRoster,
          pairs: [...s.pairs, newPair],
          matches: [...s.matches, ...newMatches],
          totalScheduledGames: gameNum,
        };
      });
      return result;
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
        // Also check if another playoff match is already on this court
        const playoffCourtBusy = s.playoffMatches.some((m) => m.court === court && m.status === "playing");
        if (playoffCourtBusy) return s;
        return {
          ...s,
          playoffMatches: s.playoffMatches.map((m) =>
            m.id === matchId ? { ...m, status: "playing" as const, court } : m
          ),
        };
      });
    },
    [updateState]
  );

  const completePlayoffMatch = useCallback(
    (matchId: string, winnerPairId: string) => {
      // Award leaderboard points (fire-and-forget, outside state updater)
      const pm = state.playoffMatches.find((m) => m.id === matchId);
      if (pm) {
        const winnerPair = pm.pair1?.id === winnerPairId ? pm.pair1 : pm.pair2;
        if (winnerPair) {
          // Final = only 1 match in this round → tournament_win (10pts)
          // Otherwise → playoff_win (5pts)
          const roundMatches = state.playoffMatches.filter((m) => m.round === pm.round);
          const isFinal = roundMatches.length === 1;
          const pts: 5 | 10 = isFinal ? 10 : 5;
          const reason: PointsReason = isFinal ? "tournament_win" : "playoff_win";
          awardMatchPoints(winnerPair, pts, reason, matchId, state.practiceMode);
        }
      }

      updateState((s) => {
        const pmIdx = s.playoffMatches.findIndex((m) => m.id === matchId);
        if (pmIdx === -1) return s;
        const pm = s.playoffMatches[pmIdx];
        const winner = pm.pair1?.id === winnerPairId ? pm.pair1 : pm.pair2;
        const freedCourt = pm.court || null;
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
            const nIdx = updated.indexOf(nextPending);
            if (nIdx !== -1) {
              updated[nIdx] = { ...nextPending, status: "playing", court: freedCourt };
            }
          }
        }

        return { ...s, playoffMatches: updated };
      });
    },
    [updateState, state.playoffMatches]
  );

  // Derived
  const checkedInPlayers = state.roster.filter((p) => p.checkedIn);
  const playingMatches = state.matches.filter((m) => m.status === "playing");
  const pendingMatches = state.matches.filter((m) => m.status === "pending");
  const completedMatches = state.matches.filter((m) => m.status === "completed");
  const court1Match = playingMatches.find((m) => m.court === 1) || null;
  const court2Match = playingMatches.find((m) => m.court === 2) || null;
  const court3Match = playingMatches.find((m) => m.court === 3) || null;

  const courtCount = state.sessionConfig.courtCount || 2;

  // Filter pending matches to only those whose players aren't currently on court
  const busyPlayerIdSet = new Set(playingMatches.flatMap((m) => getMatchPlayerIds(m)));
  const eligiblePending = pendingMatches.filter((m) => {
    const pids = getMatchPlayerIds(m);
    return !pids.some((id) => busyPlayerIdSet.has(id));
  });
  const upNextMatches = eligiblePending.slice(0, courtCount);
  const onDeckMatches = eligiblePending.slice(courtCount, courtCount * 2);

  const playingPlayerIds = playingMatches.flatMap((m) => getMatchPlayerIds(m));
  const waitingPlayers = checkedInPlayers.filter((p) => !playingPlayerIds.includes(p.id));

  return {
    state,
    loading,
    setSessionConfig,
    setFixedPairs,
    setOddPlayerDecisions,
    addPlayer,
    removePlayer,
    toggleSkillLevel,
    setPlayerSkillLevel,
    setAllSkillLevels,
    toggleCheckIn,
    lockCheckIn,
    generateFullSchedule,
    addLatePlayersToSchedule,
    handleLateCheckIn,
    regenerateRemainingSchedule,
    closeCheckIn,
    swapPlayer,
    swapPlayersInPairs,
    swapWaitlistPlayer,
    lockPairs,
    replacePlayerInPair,
    skipMatch,
    completeMatch,
    startSession,
    resetSession,
    startPlayoffs,
    removePlayerMidSession,
    swapPlayerMidSession,
    addPlayerMidSession,
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
    court3Match,
    waitingPlayers,
    upNextMatches,
    onDeckMatches,
    practiceMode: !!state.practiceMode,
    togglePracticeMode: () => { updateState((s) => ({ ...s, practiceMode: !s.practiceMode })); },
  };
}

// ── Test-only exports (pure functions, no side effects) ───
export const _testExports = {
  getAvailableTeams,
  generateNextMatch,
  findNextPendingForCourt,
  isForbiddenMatchup,
  isCrossCohort,
  getPairPlayerIds,
  getMatchPlayerIds,
  generateId,
  syncPairsToMatches,
};
