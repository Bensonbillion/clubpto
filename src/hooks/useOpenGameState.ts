import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { query } from "@/lib/turso";
import { OpenGameState, OPEN_DEFAULT_STATE, OpenCourtState, OpenSessionConfig } from "@/types/openCourtManager";
import { Player, Pair, Match, GameHistory, PlayoffMatch, FixedPair, SkillTier, CourtFormat, WsoGame, WsoState, WsoStats, WsoUndoEntry, SubRotation, SubPlayerStats } from "@/types/openCourtManager";
import { awardPoints, type PointsReason } from "@/lib/leaderboard";
import { isSimulationMode, setSimulationMode } from "@/lib/simulationMode";

const VIP_PROFILE_IDS = new Set([
  "08813d60dccf0067907caf3727077d20", // David
  "040263dd01d6128b0df59406d4f9d9e0", // Benson
  "79acebd959da20272f79bfd96f8af281", // Albright
]);
function isVip(_name: string, profileId?: string) { return profileId ? VIP_PROFILE_IDS.has(profileId) : false; }
function matchHasVip(m: Match): boolean {
  return [m.pair1.player1, m.pair1.player2, m.pair2.player1, m.pair2.player2].some(p => isVip(p.name, p.profileId));
}

const ROW_ID = "open_current";

// ─── Realtime Diagnostics ─────────────────────────────────────────────
const DEVICE_ID = (() => {
  try {
    let id = localStorage.getItem("clubpto_open_deviceId");
    if (!id) {
      id = `device-${Math.random().toString(36).substring(2, 11)}`;
      localStorage.setItem("clubpto_open_deviceId", id);
    }
    return id;
  } catch {
    return `device-${Math.random().toString(36).substring(2, 11)}`;
  }
})();
console.log(`🆔 [PTO Open] Device ID: ${DEVICE_ID}`);
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

function isCoachPair(pair: Pair): boolean {
  return !!(pair.player1.isCoach || pair.player2.isCoach);
}

function getMatchPlayerIds(m: Match): string[] {
  return [...getPairPlayerIds(m.pair1), ...getPairPlayerIds(m.pair2)];
}

/** Initialize sub rotation state for a court with an odd player */
function initializeSubRotation(allPlayerIds: string[], subPlayerId: string): SubRotation {
  const playerStats: Record<string, SubPlayerStats> = {};
  allPlayerIds.forEach(pid => {
    playerStats[pid] = { playerId: pid, gamesPlayed: 0, timesSubbedOut: 0 };
  });
  return {
    currentSubId: subPlayerId,
    playerStats,
    gamesSinceLastRotation: 0,
    rotationFrequency: 2,
    pendingRotation: false,
    rotationHistory: [],
  };
}

/** Find the best player to sub out: highest games_played, lowest times_subbed_out */
function findBestSubTarget(sub: SubRotation, courtPairs: Pair[]): { playerId: string; pairId: string } | null {
  const playingPlayerIds = new Set<string>();
  courtPairs.forEach(p => { playingPlayerIds.add(p.player1.id); playingPlayerIds.add(p.player2.id); });

  let best: { playerId: string; pairId: string; games: number; subOuts: number } | null = null;
  for (const [pid, stats] of Object.entries(sub.playerStats)) {
    if (pid === sub.currentSubId) continue;
    if (!playingPlayerIds.has(pid)) continue;
    if (!best ||
        stats.gamesPlayed > best.games ||
        (stats.gamesPlayed === best.games && stats.timesSubbedOut < best.subOuts)) {
      const pair = courtPairs.find(p => p.player1.id === pid || p.player2.id === pid);
      if (pair) {
        best = { playerId: pid, pairId: pair.id, games: stats.gamesPlayed, subOuts: stats.timesSubbedOut };
      }
    }
  }
  return best ? { playerId: best.playerId, pairId: best.pairId } : null;
}

// ─── Open Mode: NO tier-based scheduling ──────────────────────────────
// All pairs are valid opponents. Tiers are display-only.
const TARGET_GAMES = 4;

/**
 * Least Played First schedule generator for a single open court.
 * No tier filtering — all pairs can play all pairs.
 */
function generateCourtScheduleForSlots(court: OpenCourtState, slotCount: number, initialGameCounts?: Map<string, number>): Match[] {
  const pairs = court.assignedPairs;
  if (pairs.length < 2) return [];

  const gameTarget = Math.floor(slotCount * 2 / pairs.length) + (initialGameCounts ? Math.max(0, ...Array.from(initialGameCounts.values())) : 0);
  const matchupKey = (p1Id: string, p2Id: string) => [p1Id, p2Id].sort().join("|||");
  const MAX_ATTEMPTS = 10;

  const pairMinGap = new Map<string, number>();
  const hasCoach = pairs.some(isCoachPair);
  pairs.forEach(p => {
    pairMinGap.set(p.id, isCoachPair(p) ? 4 : 2);
  });

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const schedule: Match[] = [];
    const pairGames = new Map<string, number>();
    const pairLastSlot = new Map<string, number>();
    const usedMatchups = new Set<string>();
    pairs.forEach(p => { pairGames.set(p.id, initialGameCounts?.get(p.id) ?? 0); pairLastSlot.set(p.id, -2); });

    const equityRelax = attempt >= 3 ? 1 : 0;

    if (hasCoach && attempt >= 5) {
      pairs.forEach(p => {
        if (isCoachPair(p) && (pairMinGap.get(p.id) || 2) > 3) {
          pairMinGap.set(p.id, 3);
        }
      });
      if (attempt === 5) {
        console.warn(`[PTO Open Coach] Coach gap reduced to 2 for coach pairs on Court ${court.courtNumber}`);
      }
    }

    for (let slot = 0; slot < slotCount; slot++) {
      const sorted = [...pairs].sort((a, b) => {
        const ga = pairGames.get(a.id) || 0;
        const gb = pairGames.get(b.id) || 0;
        if (ga !== gb) return ga - gb;
        const idleA = slot - (pairLastSlot.get(a.id) ?? -2);
        const idleB = slot - (pairLastSlot.get(b.id) ?? -2);
        return idleB - idleA;
      });

      let matched = false;
      for (let i = 0; i < sorted.length && !matched; i++) {
        const p1 = sorted[i];
        const g1 = pairGames.get(p1.id) || 0;
        const lastSlot1 = pairLastSlot.get(p1.id) ?? -2;
        const minGap1 = pairMinGap.get(p1.id) || 2;
        if (slot - lastSlot1 < minGap1) continue;
        if (g1 >= gameTarget + equityRelax) continue;

        for (let j = i + 1; j < sorted.length; j++) {
          const p2 = sorted[j];
          const g2 = pairGames.get(p2.id) || 0;
          const lastSlot2 = pairLastSlot.get(p2.id) ?? -2;
          const minGap2 = pairMinGap.get(p2.id) || 2;
          if (slot - lastSlot2 < minGap2) continue;
          if (g2 >= gameTarget + equityRelax) continue;

          const activeGames = Array.from(pairGames.values()).filter(v => v > 0);
          const minGames = activeGames.length > 0 ? Math.min(...activeGames) : 0;
          if (Math.min(g1, g2) > minGames + 1 + equityRelax) continue;

          const mKey = matchupKey(p1.id, p2.id);
          if (usedMatchups.has(mKey)) continue;

          usedMatchups.add(mKey);
          pairGames.set(p1.id, g1 + 1);
          pairGames.set(p2.id, g2 + 1);
          pairLastSlot.set(p1.id, slot);
          pairLastSlot.set(p2.id, slot);

          // Open mode: skillLevel based on higher tier of the two pairs (display only)
          const higherTier = [p1.skillLevel, p2.skillLevel].includes("A") ? "A"
            : [p1.skillLevel, p2.skillLevel].includes("B") ? "B" : "C";
          const label = p1.skillLevel === p2.skillLevel
            ? `${p1.skillLevel} vs ${p2.skillLevel}`
            : `${p1.skillLevel} vs ${p2.skillLevel}`;

          schedule.push({
            id: generateId(),
            pair1: p1,
            pair2: p2,
            skillLevel: higherTier,
            matchupLabel: label,
            status: "pending",
            court: court.courtNumber,
            gameNumber: slot,
          });
          matched = true;
          break;
        }
      }
    }

    const games = Array.from(pairGames.values());
    const maxG = Math.max(...games);
    const minG = Math.min(...games);
    const equityGap = maxG - minG;

    let hasBackToBack = false;
    for (const p of pairs) {
      const minGap = pairMinGap.get(p.id) || 2;
      const slots = schedule
        .map((m, idx) => (m.pair1.id === p.id || m.pair2.id === p.id) ? idx : -1)
        .filter(idx => idx >= 0);
      for (let k = 1; k < slots.length; k++) {
        if (slots[k] - slots[k - 1] < minGap) { hasBackToBack = true; break; }
      }
      if (hasBackToBack) break;
    }

    const valid = equityGap <= 1 + equityRelax && !hasBackToBack;
    if (valid || attempt === MAX_ATTEMPTS - 1) {
      console.log(`[PTO Open] Court ${court.courtNumber}: ${schedule.length} games, equity=${equityGap}, slots=${slotCount}, attempt=${attempt + 1}`);
      return schedule;
    }
  }

  return [];
}

/** Initialize WSO state for an open court */
function initializeWsoState(court: OpenCourtState): WsoState {
  const shuffled = shuffle(court.assignedPairs);
  return {
    queue: shuffled.slice(2),
    currentGame: shuffled.length >= 2 ? {
      id: generateId(),
      pair1: shuffled[0],
      pair2: shuffled[1],
      startedAt: new Date().toISOString(),
      gameNumber: 1,
    } : null,
    history: [],
    stats: Object.fromEntries(court.assignedPairs.map(p => [p.id, {
      pairId: p.id, wins: 0, losses: 0, streak: 0, longestStreak: 0, gamesPlayed: 0,
    }])) as Record<string, WsoStats>,
    undoStack: [],
    gameCounter: 1,
  };
}

/** Award leaderboard points to both players on the winning pair. Fire-and-forget. */
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
      try {
        const result = await query(
          'SELECT id FROM players WHERE (preferred_name = ? OR first_name = ?) AND is_deleted = 0 LIMIT 1',
          [player.name, player.name]
        );
        playerId = result.rows.length > 0 ? (result.rows[0] as any).id : undefined;
      } catch (err) {
        console.error(`[PTO Open] Failed to look up player ${player.name}:`, err);
      }
    }
    if (playerId) {
      await awardPoints(playerId, points, reason, matchId).catch((err) =>
        console.error(`[PTO Open] Failed to award points to ${player.name}:`, err),
      );
    }
  }
}

/** Head-to-head result between two pairs across completed matches. */
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

/**
 * Merge local and remote OpenGameState on version conflict.
 * Match completions are IRREVERSIBLE.
 */
function mergeStates(local: OpenGameState, remote: OpenGameState): OpenGameState {
  const statusRank = (s: string) => s === "completed" ? 3 : s === "playing" ? 2 : 1;

  const remoteGen = remote.scheduleGeneration || 0;
  const localGen = local.scheduleGeneration || 0;
  const fullReset = remoteGen > localGen;

  if (fullReset) {
    console.log(`[PTO Open Merge] Schedule generation changed (${localGen} → ${remoteGen}) — using remote as authoritative`);
  }

  const localMatchMap = new Map(local.matches.map(m => [m.id, m]));
  const remoteMatchMap = new Map(remote.matches.map(m => [m.id, m]));

  const mergedMatches = remote.matches.map(rm => {
    const lm = localMatchMap.get(rm.id);
    if (!lm) return rm;
    if (statusRank(lm.status) > statusRank(rm.status)) return lm;
    return rm;
  });

  if (!fullReset) {
    for (const [id, lm] of localMatchMap) {
      if (!remoteMatchMap.has(id)) mergedMatches.push(lm);
    }
  }

  const mergedRoster = remote.roster.map(rp => {
    const lp = local.roster.find(p => p.id === rp.id);
    if (!lp) return rp;
    return {
      ...rp,
      wins: Math.max(rp.wins, lp.wins),
      losses: Math.max(rp.losses, lp.losses),
      gamesPlayed: Math.max(rp.gamesPlayed, lp.gamesPlayed),
      checkedIn: rp.checkedIn || lp.checkedIn,
      checkInTime: rp.checkInTime || lp.checkInTime,
    };
  });

  const historyIds = new Set(remote.gameHistory.map(h => h.id));
  const mergedHistory = [
    ...remote.gameHistory,
    ...local.gameHistory.filter(h => !historyIds.has(h.id)),
  ];

  const remotePairIds = new Set(remote.pairs.map(p => p.id));
  const mergedPairs = [
    ...remote.pairs.map(rp => {
      const lp = local.pairs.find(p => p.id === rp.id);
      if (!lp) return rp;
      return { ...rp, wins: Math.max(rp.wins, lp.wins), losses: Math.max(rp.losses, lp.losses) };
    }),
    ...(fullReset ? [] : local.pairs.filter(p => !remotePairIds.has(p.id))),
  ];

  const mergedWatched: Record<string, number> = { ...(remote.pairGamesWatched || {}) };
  if (!fullReset) {
    for (const [k, v] of Object.entries(local.pairGamesWatched || {})) {
      mergedWatched[k] = Math.max(mergedWatched[k] || 0, v);
    }
  }

  const localPlayoffMap = new Map((local.playoffMatches || []).map(m => [m.id, m]));
  const remotePlayoffMap = new Map((remote.playoffMatches || []).map(m => [m.id, m]));

  const mergedPlayoffs = (remote.playoffMatches || []).map(rm => {
    const lm = localPlayoffMap.get(rm.id);
    if (!lm) return rm;
    if (statusRank(lm.status) > statusRank(rm.status)) return lm;
    return rm;
  });
  if (!fullReset) {
    for (const [id, lm] of localPlayoffMap) {
      if (!remotePlayoffMap.has(id)) mergedPlayoffs.push(lm);
    }
  }

  return {
    ...remote,
    roster: mergedRoster,
    pairs: mergedPairs,
    matches: mergedMatches,
    gameHistory: mergedHistory,
    pairGamesWatched: mergedWatched,
    playoffMatches: mergedPlayoffs,
    playoffsStarted: fullReset ? remote.playoffsStarted : (local.playoffsStarted || remote.playoffsStarted),
    totalScheduledGames: mergedMatches.length,
  };
}

/** Universal guard: returns true if BOTH pairs are under the hard cap */
function canStartMatch(match: Match, allMatches: Match[]): boolean {
  const HARD_CAP = 4;
  let pair1Games = 0;
  let pair2Games = 0;
  for (const m of allMatches) {
    if (m.status !== "completed" && m.status !== "playing") continue;
    if (m.pair1.id === match.pair1.id || m.pair2.id === match.pair1.id) pair1Games++;
    if (m.pair1.id === match.pair2.id || m.pair2.id === match.pair2.id) pair2Games++;
  }
  if (pair1Games >= HARD_CAP || pair2Games >= HARD_CAP) {
    console.warn(`[PTO Open Guard] Blocked match: ${match.pair1.player1.name}&${match.pair1.player2.name} (${pair1Games}) vs ${match.pair2.player1.name}&${match.pair2.player2.name} (${pair2Games}) — hard cap ${HARD_CAP}`);
    return false;
  }
  return true;
}

/**
 * Open mode playoff seedings — purely by Win%, no tier priority.
 * 1-court: top 4. 2-court: top 8.
 */
function computeOpenPlayoffSeedings(
  matches: Match[],
  pairs: Pair[],
  courtCount: number,
): { seed: number; pair: Pair; winPct: number }[] {
  const pairStandings = new Map<string, { pair: Pair; wins: number; losses: number; gamesPlayed: number; winPct: number }>();

  for (const p of pairs) {
    pairStandings.set(p.id, { pair: p, wins: 0, losses: 0, gamesPlayed: 0, winPct: 0 });
  }

  for (const match of matches) {
    if (match.status !== "completed" || !match.winner || !match.loser) continue;
    const ws = pairStandings.get(match.winner.id);
    if (ws) { ws.wins++; ws.gamesPlayed++; ws.winPct = ws.wins / ws.gamesPlayed; }
    const ls = pairStandings.get(match.loser.id);
    if (ls) { ls.losses++; ls.gamesPlayed++; ls.winPct = ls.wins / ls.gamesPlayed; }
  }

  const allStandings = Array.from(pairStandings.values())
    .filter(s => s.gamesPlayed > 0)
    .sort((a, b) => {
      if (b.winPct !== a.winPct) return b.winPct - a.winPct;
      const h2h = getHeadToHead(a.pair.id, b.pair.id, matches);
      if (h2h !== 0) return -h2h;
      if (b.gamesPlayed !== a.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;
      return b.wins - a.wins;
    });

  const topCount = courtCount === 1 ? 4 : 8;
  const top = allStandings.slice(0, topCount);
  return top.map((ps, i) => ({ seed: i + 1, pair: ps.pair, winPct: ps.winPct }));
}

/**
 * Find the next pending match eligible for a freed court.
 * Open mode: NO pool filter — all matches valid for any court.
 * Still enforces: no player on two courts, rest gap, equity gate, hard cap.
 */
function findNextPendingForCourt(
  matches: Match[],
  freedCourt: number,
  recentPlayerIds: Set<string>,
  allPairs: Pair[],
  allMatches: Match[],
  allowRestRelaxation = false,
): Match | undefined {
  const busyPlayerIds = new Set<string>();
  matches.filter(m => m.status === "playing" && m.court !== freedCourt).forEach(m => {
    getMatchPlayerIds(m).forEach(id => busyPlayerIds.add(id));
  });

  const activePairIds = new Set(allPairs.map(p => p.id));

  const validCandidates: Match[] = [];
  const restRelaxedCandidates: Match[] = [];
  for (const m of matches) {
    if (m.status !== "pending") continue;
    if (!activePairIds.has(m.pair1.id) || !activePairIds.has(m.pair2.id)) continue;
    const playerIds = getMatchPlayerIds(m);
    if (playerIds.some(id => busyPlayerIds.has(id))) continue;
    if (playerIds.some(id => recentPlayerIds.has(id))) {
      restRelaxedCandidates.push(m);
      continue;
    }
    validCandidates.push(m);
  }

  const candidates = validCandidates.length > 0
    ? validCandidates
    : (allowRestRelaxation ? restRelaxedCandidates : []);
  if (candidates.length === 0) return undefined;

  const pairTotalGames = new Map<string, number>();
  for (const p of allPairs) pairTotalGames.set(p.id, 0);
  for (const m of allMatches) {
    if (m.status !== "completed" && m.status !== "playing") continue;
    pairTotalGames.set(m.pair1.id, (pairTotalGames.get(m.pair1.id) || 0) + 1);
    pairTotalGames.set(m.pair2.id, (pairTotalGames.get(m.pair2.id) || 0) + 1);
  }

  const HARD_CAP = 4;

  const availablePairCounts = allPairs
    .filter(p => !getPairPlayerIds(p).some(id => busyPlayerIds.has(id)))
    .map(p => pairTotalGames.get(p.id) || 0);
  const activeCounts = availablePairCounts.filter(c => c > 0);
  const minGamesAcrossAllPairs = activeCounts.length > 0 ? Math.min(...activeCounts) : 0;

  let bestMatch: Match | undefined;
  let bestScore = Infinity;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    const pair1Games = pairTotalGames.get(candidate.pair1.id) || 0;
    const pair2Games = pairTotalGames.get(candidate.pair2.id) || 0;

    if (pair1Games >= HARD_CAP || pair2Games >= HARD_CAP) continue;
    if (busyPlayerIds.size > 0 && Math.min(pair1Games, pair2Games) > minGamesAcrossAllPairs + 1) continue;

    // Open mode: no cross-cohort penalty
    const finalScore = Math.max(pair1Games, pair2Games) * 1000 + (candidate.gameNumber || i);
    if (finalScore < bestScore) {
      bestScore = finalScore;
      bestMatch = candidate;
    }
  }

  if (!bestMatch) {
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      const pair1Games = pairTotalGames.get(candidate.pair1.id) || 0;
      const pair2Games = pairTotalGames.get(candidate.pair2.id) || 0;
      if (pair1Games >= HARD_CAP || pair2Games >= HARD_CAP) continue;
      const finalScore = Math.max(pair1Games, pair2Games) * 1000 + (candidate.gameNumber || i);
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
    if (m.status === "playing") getMatchPlayerIds(m).forEach(id => busyPlayerIds.add(id));
  }

  const pairTotalGames = new Map<string, number>();
  for (const p of pairs) pairTotalGames.set(p.id, 0);
  for (const m of matches) {
    if (m.status !== "completed" && m.status !== "playing") continue;
    pairTotalGames.set(m.pair1.id, (pairTotalGames.get(m.pair1.id) || 0) + 1);
    pairTotalGames.set(m.pair2.id, (pairTotalGames.get(m.pair2.id) || 0) + 1);
  }

  return pairs
    .filter(pair => {
      if (getPairPlayerIds(pair).some(id => busyPlayerIds.has(id))) return false;
      if ((pairTotalGames.get(pair.id) || 0) >= targetGames) return false;
      return true;
    })
    .sort((a, b) => {
      const watchDiff = (pairGamesWatched[b.id] || 0) - (pairGamesWatched[a.id] || 0);
      if (watchDiff !== 0) return watchDiff;
      return (pairTotalGames.get(a.id) || 0) - (pairTotalGames.get(b.id) || 0);
    });
}

/** Generate next dynamic match — open mode: no tier restrictions */
function generateNextMatch(
  availableTeams: Pair[],
  freedCourt: number,
  recentPlayerIds: Set<string>,
  allMatches: Match[],
): Match | undefined {
  if (availableTeams.length < 2) return undefined;

  const playedMatchups = new Map<string, number>();
  for (const m of allMatches) {
    if (m.status === "completed" || m.status === "playing") {
      const key = [m.pair1.id, m.pair2.id].sort().join("|||");
      playedMatchups.set(key, (playedMatchups.get(key) || 0) + 1);
    }
  }

  let best: { pair1: Pair; pair2: Pair; score: number } | undefined;

  for (let i = 0; i < availableTeams.length; i++) {
    for (let j = i + 1; j < availableTeams.length; j++) {
      const p1 = availableTeams[i], p2 = availableTeams[j];
      const allPlayerIds = [...getPairPlayerIds(p1), ...getPairPlayerIds(p2)];
      if (allPlayerIds.some(id => recentPlayerIds.has(id))) continue;

      const mKey = [p1.id, p2.id].sort().join("|||");
      const score = (playedMatchups.get(mKey) || 0) * 10000 + i + j;

      if (!best || score < best.score) {
        best = { pair1: p1, pair2: p2, score };
      }
    }
  }

  if (!best) return undefined;
  const higherTier = [best.pair1.skillLevel, best.pair2.skillLevel].includes("A") ? "A"
    : [best.pair1.skillLevel, best.pair2.skillLevel].includes("B") ? "B" : "C";
  return {
    id: generateId(),
    pair1: best.pair1,
    pair2: best.pair2,
    skillLevel: higherTier,
    matchupLabel: `${best.pair1.skillLevel} vs ${best.pair2.skillLevel}`,
    status: "pending",
    court: null,
  };
}

/**
 * Open mode createSessionPairs — no tier split.
 * All players shuffled together and paired regardless of tier.
 */
function createSessionPairs(
  activePlayers: Player[],
  fixedPairs: FixedPair[],
  recentPairSet: Set<string>,
): { allPairs: Pair[]; waitlistedIds: string[] } {
  const wasRecentlyPaired = (a: string, b: string) =>
    recentPairSet.has([a, b].sort().join("|||"));

  // Step 0: Create VIP fixed pairs
  console.log("[PTO Open VIP] createSessionPairs called with", fixedPairs.length, "fixedPairs:", fixedPairs.map(fp => `${fp.player1Name} + ${fp.player2Name}`).join(", ") || "(none)");
  console.log("[PTO Open VIP] activePlayers:", activePlayers.map(p => `${p.name}(${p.skillLevel})`).join(", "));
  const vipPairs: Pair[] = [];
  const vipPairedIds = new Set<string>();

  const deduped: FixedPair[] = [];
  const claimedNames = new Set<string>();
  for (const fp of fixedPairs) {
    const p1Low = fp.player1Name.toLowerCase();
    const p2Low = fp.player2Name.toLowerCase();
    if (claimedNames.has(p1Low) || claimedNames.has(p2Low)) {
      console.warn(`[PTO Open] Fixed pair conflict: ${fp.player1Name} + ${fp.player2Name} — one is already claimed, skipping`);
      continue;
    }
    deduped.push(fp);
    claimedNames.add(p1Low);
    claimedNames.add(p2Low);
  }

  for (const fp of deduped) {
    const p1 = activePlayers.find(p => p.name.toLowerCase() === fp.player1Name.toLowerCase());
    const p2 = activePlayers.find(p => p.name.toLowerCase() === fp.player2Name.toLowerCase());
    if (p1 && p2) {
      console.log(`[PTO Open VIP] ✅ Fixed pair: ${p1.name}(${p1.skillLevel}) + ${p2.name}(${p2.skillLevel})`);
      // Skill level = higher of the two (display only)
      const pairTier: SkillTier = [p1.skillLevel, p2.skillLevel].includes("A") ? "A"
        : [p1.skillLevel, p2.skillLevel].includes("B") ? "B" : "C";
      vipPairs.push({
        id: generateId(), player1: p1, player2: p2, skillLevel: pairTier, wins: 0, losses: 0,
      });
      vipPairedIds.add(p1.id);
      vipPairedIds.add(p2.id);
    } else {
      console.warn(`[PTO Open VIP] ❌ Fixed pair failed: ${fp.player1Name} + ${fp.player2Name} — p1=${p1?.name || "NOT FOUND"}, p2=${p2?.name || "NOT FOUND"}`);
    }
  }

  // Step 1: Shuffle ALL remaining players (cross-tier) and pair them
  const remaining = shuffle(activePlayers.filter(p => !vipPairedIds.has(p.id)));
  const pairs: Pair[] = [...vipPairs];
  const used = new Set<string>();

  for (let i = 0; i < remaining.length; i++) {
    if (used.has(remaining[i].id)) continue;
    const p1 = remaining[i];

    let bestPartner: Player | null = null;
    for (let j = i + 1; j < remaining.length; j++) {
      if (used.has(remaining[j].id)) continue;
      if (!wasRecentlyPaired(p1.name, remaining[j].name)) {
        bestPartner = remaining[j];
        break;
      }
    }
    if (!bestPartner) {
      for (let j = i + 1; j < remaining.length; j++) {
        if (!used.has(remaining[j].id)) { bestPartner = remaining[j]; break; }
      }
    }

    if (bestPartner) {
      // Skill level = higher of the two (display only)
      const pairTier: SkillTier = [p1.skillLevel, bestPartner.skillLevel].includes("A") ? "A"
        : [p1.skillLevel, bestPartner.skillLevel].includes("B") ? "B" : "C";
      pairs.push({
        id: generateId(), player1: p1, player2: bestPartner, skillLevel: pairTier, wins: 0, losses: 0,
      });
      used.add(p1.id);
      used.add(bestPartner.id);
    }
  }

  const pairedPlayerIds = new Set<string>();
  pairs.forEach(p => { pairedPlayerIds.add(p.player1.id); pairedPlayerIds.add(p.player2.id); });
  const waitlistedIds = activePlayers.filter(p => !pairedPlayerIds.has(p.id)).map(p => p.id);

  return { allPairs: pairs, waitlistedIds };
}

// ─── Main Hook ────────────────────────────────────────────────────────
export function useOpenGameState(options?: { simulate?: boolean }) {
  const simulate = options?.simulate ?? false;
  const [state, setState] = useState<OpenGameState>(OPEN_DEFAULT_STATE);
  const [loading, setLoading] = useState(!simulate);
  const savingRef = useRef(false);
  const pendingRef = useRef<OpenGameState | null>(null);
  const localMutationRef = useRef(false);
  const mutationCounterRef = useRef(0);
  const lastAppliedUpdatedAtRef = useRef<number>(0);
  // No version column in DB — using updated_at timestamp guard instead
  const realtimeConnectedRef = useRef(false);
  const simulateRef = useRef(simulate);

  useEffect(() => {
    if (simulate) {
      setSimulationMode(true);
      return () => { setSimulationMode(false); };
    } else {
      setSimulationMode(false);
    }
  }, [simulate]);

  // Load initial state from DB
  useEffect(() => {
    if (simulate) return;
    const load = async () => {
      const { data, error } = await supabase
        .from("game_state")
        .select("state, updated_at")
        .eq("id", ROW_ID)
        .single();

      if (error || !data) {
        // Row doesn't exist yet — create it
        console.log(`📦 [PTO Open] No row found for "${ROW_ID}" (${error?.message || 'null'}) — creating initial row`);
        const { error: upsertErr } = await supabase
          .from("game_state")
          .upsert({ id: ROW_ID, state: JSON.parse(JSON.stringify(OPEN_DEFAULT_STATE)), updated_at: new Date().toISOString() })
          .select()
          .single();
        if (upsertErr) console.error(`❌ [PTO Open] Failed to create row:`, upsertErr);
        setLoading(false);
        return;
      }

      if (data?.state) {
        const raw = data.state as unknown as OpenGameState;
        // Validate: if state is missing critical fields, merge with defaults
        const loaded: OpenGameState = {
          ...OPEN_DEFAULT_STATE,
          ...raw,
          sessionConfig: { ...OPEN_DEFAULT_STATE.sessionConfig, ...(raw.sessionConfig || {}) },
          roster: raw.roster || [],
          pairs: raw.pairs || [],
          matches: raw.matches || [],
          gameHistory: raw.gameHistory || [],
          playoffMatches: raw.playoffMatches || [],
          courts: raw.courts || [],
        };
        console.log(`📦 [PTO Open] Loaded initial state — ${loaded.roster.length} players in roster`);

        const serverUpdatedAt = (data as any).updated_at as string | undefined;
        if (serverUpdatedAt) {
          const ts = Date.parse(serverUpdatedAt);
          if (Number.isFinite(ts)) lastAppliedUpdatedAtRef.current = ts;
        }

        // Restore courtCount from localStorage
        const savedCourtCount = localStorage.getItem("clubpto_open_courtCount");
        if (savedCourtCount && loaded.sessionConfig) {
          loaded.sessionConfig = { ...loaded.sessionConfig, courtCount: Number(savedCourtCount) as 1 | 2 };
        }

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

  // Subscribe to realtime changes
  useEffect(() => {
    if (simulate) return;
    const channel = supabase
      .channel("open_game_state_sync")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "game_state", filter: `id=eq.${ROW_ID}` },
        (payload) => {
          const now = new Date().toISOString();
          const updatedAt = (payload.new as any)?.updated_at as string | undefined;

          console.log(`🔥 [PTO Open] REALTIME UPDATE @ ${now}`, {
            updatedAt,
            blocked: { saving: savingRef.current, pending: !!pendingRef.current, localMutation: localMutationRef.current },
          });

          if (savingRef.current || pendingRef.current || localMutationRef.current) {
            console.warn("⚠️ [PTO Open] Realtime update BLOCKED by refs");
            return;
          }
          const nextState = (payload.new as any)?.state as OpenGameState | undefined;
          if (!nextState) { console.warn("⚠️ [PTO Open] Realtime payload missing state"); return; }
          if (!shouldApplyRemote(updatedAt)) {
            console.warn("⚠️ [PTO Open] Realtime update REJECTED by timestamp guard");
            return;
          }
          console.log(`✅ [PTO Open] Merging remote state`);
          setState(prev => mergeStates(prev, nextState));
        }
      )
      .subscribe((status, err) => {
        realtimeConnectedRef.current = status === "SUBSCRIBED";
        console.log(`📡 [PTO Open] SUBSCRIPTION STATUS: ${status} @ ${new Date().toISOString()}`);
        if (err) console.error("📡 [PTO Open] Subscription error:", err);
      });

    return () => { supabase.removeChannel(channel); };
  }, [shouldApplyRemote, simulate]);

  // Polling fallback every 10s
  useEffect(() => {
    if (simulate) return;
    const interval = setInterval(async () => {
      if (realtimeConnectedRef.current) return;
      if (savingRef.current || pendingRef.current || localMutationRef.current) {
        console.log("🔄 [PTO Open] Poll skipped — refs active");
        return;
      }
      console.log("🔄 [PTO Open] Realtime disconnected — polling fallback");
      const { data } = await supabase
        .from("game_state")
        .select("state, updated_at")
        .eq("id", ROW_ID)
        .single();

      const nextState = data?.state as unknown as OpenGameState | undefined;
      const updatedAt = (data as any)?.updated_at as string | undefined;

      if (nextState && !savingRef.current && !pendingRef.current && !localMutationRef.current) {
        if (!shouldApplyRemote(updatedAt)) return;
        console.log(`🔄 [PTO Open] Poll — merging from DB`);
        setState(prev => mergeStates(prev, nextState));
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
        console.log(`💾 [PTO Open] Saving state @ ${updatedAt} from ${DEVICE_ID}`);

        const { error } = await supabase
          .from("game_state")
          .update({
            state: JSON.parse(JSON.stringify(toSave)),
            updated_at: updatedAt,
          })
          .eq("id", ROW_ID);

        if (!error) {
          retries = 0;
          console.log(`✅ [PTO Open] Save succeeded`);
          const ts = Date.parse(updatedAt);
          if (Number.isFinite(ts)) lastAppliedUpdatedAtRef.current = Math.max(lastAppliedUpdatedAtRef.current, ts);
          continue;
        }

        retries++;
        console.error(`❌ [PTO Open] Save failed (attempt ${retries}/${MAX_RETRIES}):`, error);
        await new Promise(r => setTimeout(r, 500));
        if (!pendingRef.current) pendingRef.current = toSave;
      }

      if (retries >= MAX_RETRIES) {
        console.error(`❌ [PTO Open] Gave up after ${MAX_RETRIES} retries. Fetching remote state for merge-reset.`);
        const { data: reset } = await supabase
          .from("game_state")
          .select("state, updated_at")
          .eq("id", ROW_ID)
          .single();
        if (reset) {
          const resetTs = Date.parse((reset as any).updated_at);
          if (Number.isFinite(resetTs)) lastAppliedUpdatedAtRef.current = Math.max(lastAppliedUpdatedAtRef.current, resetTs);
          const remoteState = reset.state as unknown as OpenGameState;
          setState(prev => {
            const merged = mergeStates(prev, remoteState);
            pendingRef.current = merged;
            queueMicrotask(() => drainSave());
            return merged;
          });
        }
      }
    } finally {
      savingRef.current = false;
      localMutationRef.current = false;
      console.log(`🔓 [PTO Open] Save complete — localMutationRef → false (mutation #${mutationCounterRef.current})`);
    }
  }, []);

  const updateState = useCallback(
    (updater: (prev: OpenGameState) => OpenGameState) => {
      localMutationRef.current = true;
      mutationCounterRef.current += 1;
      const counterSnapshot = mutationCounterRef.current;
      console.log(`🖊️ [PTO Open] updateState called — mutation #${counterSnapshot}`);
      setState(prev => {
        const next = updater(prev);
        pendingRef.current = next;
        queueMicrotask(() => drainSave());
        return next;
      });
      setTimeout(() => {
        if (mutationCounterRef.current === counterSnapshot && localMutationRef.current && !savingRef.current) {
          console.warn(`⏰ [PTO Open] Force-clearing localMutationRef after 30s (mutation #${counterSnapshot})`);
          localMutationRef.current = false;
        }
      }, 30000);
    },
    [drainSave]
  );

  // Self-heal: keep courts occupied during active round-robin
  useEffect(() => {
    if (loading) return;
    if (!state.sessionStarted || state.playoffsStarted) return;

    const courtCount = state.sessionConfig.courtCount || 1;
    const playingMatches = state.matches.filter(m => m.status === "playing");
    const pendingMatches = state.matches.filter(m => m.status === "pending");
    if (pendingMatches.length === 0) return;

    const occupiedCourts = new Set<number>(
      playingMatches.map(m => m.court).filter((c): c is number => typeof c === "number")
    );

    const idleCourts: number[] = [];
    for (let c = 1; c <= courtCount; c++) {
      if (!occupiedCourts.has(c)) idleCourts.push(c);
    }
    if (idleCourts.length === 0) return;

    updateState(s => {
      const liveCourtCount = s.sessionConfig.courtCount || 1;
      const playing = s.matches.filter(m => m.status === "playing");
      const pending = s.matches.filter(m => m.status === "pending");
      if (pending.length === 0) return s;

      const occupied = new Set<number>(
        playing.map(m => m.court).filter((c): c is number => typeof c === "number")
      );

      const toFill: number[] = [];
      for (let c = 1; c <= liveCourtCount; c++) {
        if (!occupied.has(c)) toFill.push(c);
      }
      if (toFill.length === 0) return s;

      let updatedMatches = [...s.matches];
      let changed = false;

      const completedByTime = updatedMatches
        .filter(m => m.status === "completed" && m.completedAt)
        .sort((a, b) => Date.parse(b.completedAt!) - Date.parse(a.completedAt!));
      const recentPlayerIds = new Set<string>();
      const restWindow = liveCourtCount;
      for (let i = 0; i < Math.min(restWindow, completedByTime.length); i++) {
        getMatchPlayerIds(completedByTime[i]).forEach(id => recentPlayerIds.add(id));
      }

      for (const court of toFill) {
        let nextPending = findNextPendingForCourt(updatedMatches, court, recentPlayerIds, s.pairs, updatedMatches, false);
        if (!nextPending) {
          nextPending = findNextPendingForCourt(updatedMatches, court, recentPlayerIds, s.pairs, updatedMatches, true);
        }
        if (!nextPending) continue;
        if (!canStartMatch(nextPending, updatedMatches)) continue;
        const idx = updatedMatches.findIndex(m => m.id === nextPending!.id);
        if (idx === -1) continue;
        updatedMatches[idx] = { ...nextPending, status: "playing", court, startedAt: new Date().toISOString() };
        changed = true;
      }

      return changed ? { ...s, matches: updatedMatches } : s;
    });
  }, [loading, state.matches, state.playoffsStarted, state.sessionConfig.courtCount, state.sessionStarted, updateState]);

  // ─── Session Config ────────────────────────────────────────────
  const setSessionConfig = useCallback(
    (config: Partial<OpenSessionConfig>) => {
      if (config.courtCount !== undefined) {
        localStorage.setItem("clubpto_open_courtCount", String(config.courtCount));
      }
      updateState(s => ({ ...s, sessionConfig: { ...s.sessionConfig, ...config } }));
    },
    [updateState]
  );

  // ─── Roster ────────────────────────────────────────────────────
  const addPlayer = useCallback(
    (name: string, skillLevel: SkillTier, profileId?: string): boolean => {
      let added = false;
      updateState(s => {
        if (s.roster.some(p => p.name.toLowerCase() === name.toLowerCase())) return s;
        added = true;
        const player: Player = {
          id: generateId(), name, skillLevel, checkedIn: false, checkInTime: null,
          wins: 0, losses: 0, gamesPlayed: 0, profileId,
        };
        return { ...s, roster: [...s.roster, player] };
      });
      return added;
    },
    [updateState]
  );

  const setAllSkillLevels = useCallback(
    (skillLevel: SkillTier) => {
      updateState(s => ({
        ...s,
        roster: s.roster.map(p => p.skillLevel !== skillLevel ? { ...p, skillLevel } : p),
      }));
    },
    [updateState]
  );

  const removePlayer = useCallback(
    (id: string) => {
      updateState(s => {
        if (s.matches.length > 0) {
          const isPlaying = s.matches.some(m => m.status === "playing" && getMatchPlayerIds(m).includes(id));
          if (isPlaying) return s;

          const playerPairIds = new Set<string>();
          s.pairs.forEach(pair => {
            if (pair.player1.id === id || pair.player2.id === id) playerPairIds.add(pair.id);
          });

          const updatedPairs = s.pairs.filter(p => !playerPairIds.has(p.id));
          let updatedMatches = s.matches.filter(m => {
            if (m.status !== "pending") return true;
            return !playerPairIds.has(m.pair1.id) && !playerPairIds.has(m.pair2.id);
          });

          const activePairIds = new Set(updatedPairs.map(p => p.id));
          updatedMatches = updatedMatches.filter(m => {
            if (m.status === "completed") return true;
            return activePairIds.has(m.pair1.id) && activePairIds.has(m.pair2.id);
          });

          updatedMatches = updatedMatches.map((m, i) =>
            m.gameNumber !== i + 1 ? { ...m, gameNumber: i + 1 } : m
          );

          return {
            ...s,
            roster: s.roster.filter(p => p.id !== id),
            pairs: updatedPairs,
            matches: updatedMatches,
            totalScheduledGames: updatedMatches.length,
          };
        }
        return { ...s, roster: s.roster.filter(p => p.id !== id) };
      });
    },
    [updateState]
  );

  const setPlayerSkillLevel = useCallback(
    (id: string, skillLevel: SkillTier) => {
      updateState(s => ({
        ...s,
        roster: s.roster.map(p => p.id === id ? { ...p, skillLevel } : p),
      }));
    },
    [updateState]
  );

  const toggleSkillLevel = useCallback(
    (id: string) => {
      updateState(s => ({
        ...s,
        roster: s.roster.map(p => {
          if (p.id !== id) return p;
          const cycle: Record<string, SkillTier> = { A: "B", B: "C", C: "A" };
          return { ...p, skillLevel: cycle[p.skillLevel] || "C" };
        }),
      }));
    },
    [updateState]
  );

  const toggleCoach = useCallback(
    (id: string) => {
      updateState(s => ({
        ...s,
        roster: s.roster.map(p => p.id === id ? { ...p, isCoach: !p.isCoach } : p),
      }));
    },
    [updateState]
  );

  // ─── Check-in ──────────────────────────────────────────────────
  const toggleCheckIn = useCallback(
    (id: string) => {
      updateState(s => {
        if (s.sessionConfig.checkInLocked) return s;
        return {
          ...s,
          roster: s.roster.map(p =>
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
      updateState(s => ({ ...s, sessionConfig: { ...s.sessionConfig, checkInLocked: locked } }));
    },
    [updateState]
  );

  const closeCheckIn = useCallback(
    (closed: boolean) => {
      updateState(s => ({ ...s, sessionConfig: { ...s.sessionConfig, checkInClosed: closed } }));
    },
    [updateState]
  );

  const setFixedPairs = useCallback(
    (pairs: FixedPair[]) => {
      updateState(s => ({ ...s, fixedPairs: pairs }));
    },
    [updateState]
  );

  const startSession = useCallback(() => {
    updateState(s => ({
      ...s,
      sessionStarted: true,
      sessionConfig: { ...s.sessionConfig, sessionStartedAt: new Date().toISOString() },
    }));
  }, [updateState]);

  // ─── generateFullSchedule (Open Mode) ─────────────────────────
  const generateFullSchedule = useCallback(async (fixedPairs: FixedPair[] = []) => {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    console.log("[PTO Open] generateFullSchedule: fetching pair history...");
    const historyResult = await query(
      'SELECT player1_name, player2_name FROM pair_history WHERE session_date >= ?',
      [twoWeeksAgo.toISOString().split("T")[0]]
    ).catch(err => { console.warn("[PTO Open] Pair history fetch failed:", err); return { rows: [] }; });
    const history = historyResult.rows as any[];
    console.log("[PTO Open] generateFullSchedule: history fetched, entering scheduling...");

    updateState(s => {
      const _t0 = performance.now();
      let roster = [...s.roster];

      // Auto-check-in VIP partners
      fixedPairs.forEach(fp => {
        const teammate = roster.find(p => p.name.toLowerCase() === fp.player2Name.toLowerCase() && !p.checkedIn);
        if (teammate) {
          roster = roster.map(p => p.id === teammate.id ? { ...p, checkedIn: true, checkInTime: new Date().toISOString() } : p);
        }
      });

      const checkedIn = roster.filter(p => p.checkedIn);
      if (checkedIn.length < 4) return s;

      const recentPairs = new Set<string>();
      (history || []).forEach((h: { player1_name: string; player2_name: string }) => {
        recentPairs.add([h.player1_name, h.player2_name].sort().join("|||"));
      });

      // Open mode: pair ALL players cross-tier
      const pairingResult = createSessionPairs(checkedIn, fixedPairs, recentPairs);
      const allPairs = pairingResult.allPairs;
      const waitlistedIds = [...pairingResult.waitlistedIds];

      const courtCount = s.sessionConfig.courtCount || 1;

      // Create CourtState(s) — courts start in "waiting"
      let courts: OpenCourtState[];
      if (courtCount === 1) {
        courts = [{
          courtNumber: 1,
          assignedPairs: allPairs,
          schedule: [],
          completedGames: [],
          standings: Object.fromEntries(allPairs.map(p => [p.id, { wins: 0, losses: 0, gamesPlayed: 0, winPct: 0 }])),
          currentSlot: 0,
          status: "waiting",
          format: "round_robin",
        }];
      } else {
        // Split pairs evenly across 2 courts (random split)
        const shuffledPairs = shuffle(allPairs);
        const half = Math.ceil(shuffledPairs.length / 2);
        const court1Pairs = shuffledPairs.slice(0, half);
        const court2Pairs = shuffledPairs.slice(half);
        courts = [
          {
            courtNumber: 1,
            assignedPairs: court1Pairs,
            schedule: [],
            completedGames: [],
            standings: Object.fromEntries(court1Pairs.map(p => [p.id, { wins: 0, losses: 0, gamesPlayed: 0, winPct: 0 }])),
            currentSlot: 0,
            status: "waiting",
            format: "round_robin",
          },
          {
            courtNumber: 2,
            assignedPairs: court2Pairs,
            schedule: [],
            completedGames: [],
            standings: Object.fromEntries(court2Pairs.map(p => [p.id, { wins: 0, losses: 0, gamesPlayed: 0, winPct: 0 }])),
            currentSlot: 0,
            status: "waiting",
            format: "round_robin",
          },
        ];
      }

      // Save pairs to history (fire-and-forget)
      if (!isSimulationMode() && !s.practiceMode) {
        const historyRows = allPairs.map(p => ({ player1_name: p.player1.name, player2_name: p.player2.name }));
        if (historyRows.length > 0) {
          Promise.all(historyRows.map(r =>
            query('INSERT INTO pair_history (player1_name, player2_name) VALUES (?, ?)', [r.player1_name, r.player2_name])
          )).catch(() => {});
        }
      }

      const _t1 = performance.now();
      console.log(`[PTO Open] generateFullSchedule done in ${(_t1 - _t0).toFixed(1)}ms — ${allPairs.length} pairs, ${courtCount} court(s), waitlisted: ${waitlistedIds.length}`);
      courts.forEach(c => console.log(`[PTO Open] Court ${c.courtNumber}: ${c.assignedPairs.length} pairs`));

      return {
        ...s,
        roster,
        pairs: allPairs,
        matches: [],
        totalScheduledGames: 0,
        waitlistedPlayers: waitlistedIds,
        sessionStarted: true,
        sessionConfig: { ...s.sessionConfig, sessionStartedAt: new Date().toISOString() },
        scheduleGeneration: (s.scheduleGeneration || 0) + 1,
        courts,
      };
    });
  }, [updateState]);

  // ─── Court Start Actions ───────────────────────────────────────
  const startCourt = useCallback(
    (courtNumber: number) => {
      updateState(s => {
        if (!s.courts) return s;
        const sessionStart = s.sessionConfig.sessionStartedAt;
        if (!sessionStart) return s;
        const durationMin = s.sessionConfig.durationMinutes || 85;
        const now = Date.now();
        const elapsed = (now - new Date(sessionStart).getTime()) / 60000;
        const remainingMin = Math.max(0, durationMin - elapsed);
        const availableSlots = Math.floor(remainingMin / 7);

        const courts = s.courts.map(c => {
          if (c.courtNumber !== courtNumber || c.status !== "waiting") return c;
          const startedAt = new Date().toISOString();
          if (c.format === "winner_stays_on") {
            return { ...c, status: "active" as const, startedAt, wso: initializeWsoState(c) };
          } else {
            const schedule = generateCourtScheduleForSlots(c, availableSlots);
            return {
              ...c,
              status: schedule.length > 0 ? "active" as const : "waiting" as const,
              startedAt,
              schedule,
            };
          }
        });

        const totalScheduled = courts.reduce((sum, c) => sum + c.schedule.length, 0);
        return { ...s, courts, totalScheduledGames: totalScheduled };
      });
    },
    [updateState]
  );

  const startAllCourts = useCallback(
    () => {
      updateState(s => {
        if (!s.courts) return s;
        const sessionStart = s.sessionConfig.sessionStartedAt;
        if (!sessionStart) return s;
        const durationMin = s.sessionConfig.durationMinutes || 85;
        const now = Date.now();
        const elapsed = (now - new Date(sessionStart).getTime()) / 60000;
        const remainingMin = Math.max(0, durationMin - elapsed);
        const availableSlots = Math.floor(remainingMin / 7);

        const courts = s.courts.map(c => {
          if (c.status !== "waiting") return c;
          const startedAt = new Date().toISOString();
          if (c.format === "winner_stays_on") {
            return { ...c, status: "active" as const, startedAt, wso: initializeWsoState(c) };
          } else {
            const schedule = generateCourtScheduleForSlots(c, availableSlots);
            return {
              ...c,
              status: schedule.length > 0 ? "active" as const : "waiting" as const,
              startedAt,
              schedule,
            };
          }
        });

        const totalScheduled = courts.reduce((sum, c) => sum + c.schedule.length, 0);
        return { ...s, courts, totalScheduledGames: totalScheduled };
      });
    },
    [updateState]
  );

  const setCourtFormat = useCallback(
    (courtNumber: 1 | 2, format: CourtFormat) => {
      updateState(s => {
        if (!s.courts) return s;
        const courts = s.courts.map(c => {
          if (c.courtNumber !== courtNumber) return c;
          if (c.status !== "waiting") return c;
          if (format === "winner_stays_on") {
            return { ...c, format, schedule: [], wso: undefined };
          } else {
            return { ...c, format: "round_robin" as const, wso: undefined, schedule: [] };
          }
        });
        return { ...s, courts };
      });
    },
    [updateState]
  );

  // ─── Freeze line helper ────────────────────────────────────────
  const getFreezeLine = useCallback((matches: Match[], courtCount: number): number => {
    let pendingCount = 0;
    const frozenPendingCount = courtCount * 2;
    for (let i = 0; i < matches.length; i++) {
      if (matches[i].status === "pending") {
        pendingCount++;
        if (pendingCount >= frozenPendingCount) return i + 1;
      }
    }
    return matches.length;
  }, []);

  // ─── generateMatchesForNewPair (Open mode) ─────────────────────
  const generateMatchesForNewPair = useCallback((
    newPair: Pair,
    existingPairs: Pair[],
    existingMatchups: Set<string>,
    startGameNum: number,
  ): Match[] => {
    // Open mode: any pair is a valid opponent
    const opponents = shuffle(existingPairs.filter(p => p.id !== newPair.id));
    const newMatches: Match[] = [];

    for (const opp of opponents) {
      if (newMatches.length >= TARGET_GAMES) break;
      const mKey = [newPair.id, opp.id].sort().join("|||");
      if (existingMatchups.has(mKey)) continue;

      const pairTier: SkillTier = [newPair.skillLevel, opp.skillLevel].includes("A") ? "A"
        : [newPair.skillLevel, opp.skillLevel].includes("B") ? "B" : "C";
      newMatches.push({
        id: generateId(),
        pair1: newPair,
        pair2: opp,
        skillLevel: pairTier,
        matchupLabel: `${newPair.skillLevel} vs ${opp.skillLevel}`,
        status: "pending" as const,
        court: null,
        gameNumber: startGameNum + newMatches.length + 1,
      });
      existingMatchups.add(mKey);
    }

    if (newMatches.length < TARGET_GAMES) {
      console.warn(`[PTO Open NewPair] ${newPair.player1.name} & ${newPair.player2.name} only got ${newMatches.length} unique games`);
      for (const opp of opponents) {
        if (newMatches.length >= TARGET_GAMES) break;
        const mKey = [newPair.id, opp.id].sort().join("|||");
        if (existingMatchups.has(mKey)) continue;
        const pairTier: SkillTier = [newPair.skillLevel, opp.skillLevel].includes("A") ? "A"
          : [newPair.skillLevel, opp.skillLevel].includes("B") ? "B" : "C";
        newMatches.push({
          id: generateId(),
          pair1: newPair,
          pair2: opp,
          skillLevel: pairTier,
          matchupLabel: `${newPair.skillLevel} vs ${opp.skillLevel}`,
          status: "pending" as const,
          court: null,
          gameNumber: startGameNum + newMatches.length + 1,
        });
        existingMatchups.add(mKey);
      }
    }

    return newMatches;
  }, []);

  // ─── insertMatchesAfterFreezeLine ─────────────────────────────
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

    const getPlayerIds = (m: Match) => [
      m.pair1.player1.id, m.pair1.player2.id, m.pair2.player1.id, m.pair2.player2.id,
    ];

    const getSlotPlayerIds = (allMatches: Match[], slotNum: number): Set<string> => {
      const ids = new Set<string>();
      const start = slotNum * courtCount;
      const end = start + courtCount;
      for (let i = start; i < end && i < allMatches.length; i++) {
        getPlayerIds(allMatches[i]).forEach(id => ids.add(id));
      }
      return ids;
    };

    const combined = [...mutable];
    for (const nm of newMatches) {
      const nmPlayerIds = getPlayerIds(nm);
      let inserted = false;

      for (let insertPos = 0; insertPos <= combined.length; insertPos++) {
        const tentative = [...frozen, ...combined.slice(0, insertPos), nm, ...combined.slice(insertPos)];
        const absoluteIdx = frozen.length + insertPos;
        const slot = Math.floor(absoluteIdx / courtCount);

        const sameSlotConflict = nmPlayerIds.some(id => {
          const start = slot * courtCount;
          const end = Math.min(start + courtCount, tentative.length);
          let count = 0;
          for (let i = start; i < end; i++) {
            if (getPlayerIds(tentative[i]).includes(id)) count++;
          }
          return count > 1;
        });
        if (sameSlotConflict) continue;

        let restGapViolation = false;
        for (const adjSlot of [slot - 1, slot + 1]) {
          if (adjSlot < 0) continue;
          const adjIds = getSlotPlayerIds(tentative, adjSlot);
          if (nmPlayerIds.some(id => adjIds.has(id))) { restGapViolation = true; break; }
        }
        if (restGapViolation) continue;

        combined.splice(insertPos, 0, nm);
        inserted = true;
        break;
      }

      if (!inserted) combined.push(nm);
    }

    const result = [...frozen, ...combined];
    return result.map((m, i) => m.gameNumber !== i + 1 ? { ...m, gameNumber: i + 1 } : m);
  }, []);

  // ─── handleLateCheckIn (Open mode) ─────────────────────────────
  // Any tier player can partner with any tier player on waitlist
  const handleLateCheckIn = useCallback(
    (playerId: string, fixedPartnerName?: string): { paired: boolean; partnerName?: string; estimatedMinutes?: number } => {
      let result: { paired: boolean; partnerName?: string; estimatedMinutes?: number } = { paired: false };

      updateState(s => {
        if (s.matches.length === 0) return s;
        if (s.sessionConfig.checkInClosed) return s;

        const player = s.roster.find(p => p.id === playerId);
        if (!player) return s;

        const currentWaitlist = s.waitlistedPlayers || [];
        const courtCount = s.sessionConfig.courtCount || 1;

        let partner: Player | undefined;

        if (fixedPartnerName) {
          partner = s.roster.find(p => p.name.toLowerCase() === fixedPartnerName.toLowerCase() && p.id !== playerId);
          if (partner && currentWaitlist.includes(partner.id)) {
            // good
          } else if (partner && !s.pairs.some(pair => pair.player1.id === partner!.id || pair.player2.id === partner!.id)) {
            // good
          } else {
            partner = undefined;
          }
        }

        // Open mode: find ANY waitlisted player (no tier restriction)
        if (!partner) {
          const waitlistPartnerIdx = currentWaitlist.findIndex(wId => {
            if (wId === playerId) return false;
            const wp = s.roster.find(p => p.id === wId);
            return wp && wp.checkedIn;
          });
          if (waitlistPartnerIdx !== -1) {
            partner = s.roster.find(p => p.id === currentWaitlist[waitlistPartnerIdx]);
          }
        }

        if (!partner) {
          result = { paired: false };
          return {
            ...s,
            waitlistedPlayers: [...currentWaitlist.filter(id => id !== playerId), playerId],
          };
        }

        // Skill level = higher tier of the two (display only)
        const pairTier: SkillTier = [player.skillLevel, partner.skillLevel].includes("A") ? "A"
          : [player.skillLevel, partner.skillLevel].includes("B") ? "B" : "C";

        const newPair: Pair = {
          id: generateId(), player1: player, player2: partner, skillLevel: pairTier, wins: 0, losses: 0,
        };

        const existingMatchups = new Set<string>();
        s.matches.forEach(m => existingMatchups.add([m.pair1.id, m.pair2.id].sort().join("|||")));

        const newMatches = generateMatchesForNewPair(newPair, s.pairs, existingMatchups, s.matches.length);
        const updatedMatches = insertMatchesAfterFreezeLine(s.matches, newMatches, courtCount);
        const updatedWaitlist = currentWaitlist.filter(id => id !== playerId && id !== partner!.id);

        const firstNewMatch = updatedMatches.find(m => m.pair1.id === newPair.id || m.pair2.id === newPair.id);
        const currentPlaying = updatedMatches.filter(m => m.status === "playing");
        const firstNewIdx = firstNewMatch ? updatedMatches.indexOf(firstNewMatch) : -1;
        const currentIdx = currentPlaying.length > 0
          ? Math.max(...currentPlaying.map(m => updatedMatches.indexOf(m)))
          : 0;
        const slotsAway = Math.max(0, Math.ceil((firstNewIdx - currentIdx) / courtCount));
        const estimatedMinutes = slotsAway * 7;

        result = { paired: true, partnerName: partner.name, estimatedMinutes };

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

  // ─── regenerateRemainingSchedule (Open mode) ───────────────────
  const regenerateRemainingSchedule = useCallback(() => {
    updateState(s => {
      if (s.matches.length === 0) return s;

      const courtCount = s.sessionConfig.courtCount || 1;
      const frozenPendingCount = courtCount * 2;

      const frozen: Match[] = [];
      const mutable: Match[] = [];
      let pendingCount = 0;
      for (const m of s.matches) {
        if (m.status !== "pending") {
          frozen.push(m);
        } else {
          pendingCount++;
          if (pendingCount <= frozenPendingCount) frozen.push(m);
          else mutable.push(m);
        }
      }

      const usedMatchups = new Set<string>();
      frozen.forEach(m => usedMatchups.add([m.pair1.id, m.pair2.id].sort().join("|||")));

      const pairGameCount = new Map<string, number>();
      s.pairs.forEach(p => pairGameCount.set(p.id, 0));
      frozen.forEach(m => {
        pairGameCount.set(m.pair1.id, (pairGameCount.get(m.pair1.id) || 0) + 1);
        pairGameCount.set(m.pair2.id, (pairGameCount.get(m.pair2.id) || 0) + 1);
      });

      // Open mode: all pair-vs-pair matchups are valid
      type CandidateMatch = { pair1: Pair; pair2: Pair };
      const allCandidates: CandidateMatch[] = [];
      for (let i = 0; i < s.pairs.length; i++) {
        for (let j = i + 1; j < s.pairs.length; j++) {
          const mKey = [s.pairs[i].id, s.pairs[j].id].sort().join("|||");
          if (!usedMatchups.has(mKey)) {
            allCandidates.push({ pair1: s.pairs[i], pair2: s.pairs[j] });
          }
        }
      }

      const MAX_GAMES = 4;
      const durationMin = s.sessionConfig.durationMinutes || 85;
      const totalSlots = Math.floor(durationMin / 7);
      const frozenSlots = Math.ceil(frozen.length / courtCount);
      const remainingSlots = Math.max(0, totalSlots - frozenSlots);

      let candidatePool = shuffle([...allCandidates]);
      const matchupKey = (p1Id: string, p2Id: string) => [p1Id, p2Id].sort().join("|||");
      const matchPlayerIds2 = (m: CandidateMatch) => [
        m.pair1.player1.id, m.pair1.player2.id, m.pair2.player1.id, m.pair2.player2.id,
      ];

      let regenMinCount = 0;
      let regenEquityDirty = true;
      const recomputeRegenEquityMin = () => {
        let min = Infinity;
        for (const v of pairGameCount.values()) { if (v > 0 && v < min) min = v; }
        regenMinCount = min === Infinity ? 0 : min;
        regenEquityDirty = false;
      };

      const regenerated: Match[] = [];
      const regenSlotBoundaries: number[] = [];
      const REST_GAP = 1;

      const getSlotPlayerIds2 = (slotIndex: number): Set<string> => {
        const ids = new Set<string>();
        if (slotIndex < 0 || slotIndex >= regenSlotBoundaries.length) return ids;
        const start = regenSlotBoundaries[slotIndex];
        const end = slotIndex + 1 < regenSlotBoundaries.length ? regenSlotBoundaries[slotIndex + 1] : regenerated.length;
        for (let i = start; i < end; i++) {
          matchPlayerIds2(regenerated[i] as CandidateMatch).forEach(id => ids.add(id));
        }
        return ids;
      };

      const pickBest = (
        pool: CandidateMatch[],
        slotPlayerIds: Set<string>,
        blockedPlayerIds: Set<string>,
      ): number => {
        let bestIdx = -1;
        let bestScore = Infinity;
        if (regenEquityDirty) recomputeRegenEquityMin();
        for (let i = 0; i < pool.length; i++) {
          const c = pool[i];
          const mKey = matchupKey(c.pair1.id, c.pair2.id);
          if (usedMatchups.has(mKey)) continue;
          const g1 = pairGameCount.get(c.pair1.id) || 0;
          const g2 = pairGameCount.get(c.pair2.id) || 0;
          if (g1 >= MAX_GAMES || g2 >= MAX_GAMES) continue;
          if (Math.min(g1, g2) > regenMinCount + 1) continue;
          const playerIds = matchPlayerIds2(c);
          if (playerIds.some(id => slotPlayerIds.has(id))) continue;
          if (playerIds.some(id => blockedPlayerIds.has(id))) continue;
          const score = (g1 + g2);
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
        regenEquityDirty = true;
        matchPlayerIds2(chosen).forEach(id => slotPlayerIds.add(id));
        const pairTier: SkillTier = [chosen.pair1.skillLevel, chosen.pair2.skillLevel].includes("A") ? "A"
          : [chosen.pair1.skillLevel, chosen.pair2.skillLevel].includes("B") ? "B" : "C";
        return {
          id: generateId(), pair1: chosen.pair1, pair2: chosen.pair2,
          skillLevel: pairTier,
          matchupLabel: `${chosen.pair1.skillLevel} vs ${chosen.pair2.skillLevel}`,
          status: "pending" as const, court: null,
        };
      };

      for (let slot = 0; slot < remainingSlots; slot++) {
        regenSlotBoundaries.push(regenerated.length);
        const blockedPlayerIds = new Set<string>();
        for (let prev = Math.max(0, slot - REST_GAP); prev < slot; prev++) {
          getSlotPlayerIds2(prev).forEach(id => blockedPlayerIds.add(id));
        }
        if (slot < REST_GAP) {
          const lastFrozenSlot = frozenSlots - 1;
          for (let prev = Math.max(0, lastFrozenSlot - (REST_GAP - slot - 1)); prev <= lastFrozenSlot; prev++) {
            const base = prev * courtCount;
            for (let i = base; i < base + courtCount && i < frozen.length; i++) {
              getMatchPlayerIds(frozen[i]).forEach(id => blockedPlayerIds.add(id));
            }
          }
        }

        const slotPlayerIds = new Set<string>();
        for (let ci = 0; ci < courtCount; ci++) {
          const idx = pickBest(candidatePool, slotPlayerIds, blockedPlayerIds);
          if (idx !== -1) regenerated.push(commitCandidate(idx, slotPlayerIds));
        }
      }

      // Fallback: fill short pairs
      const shortPairs = s.pairs.filter(p => (pairGameCount.get(p.id) || 0) < TARGET_GAMES);
      if (shortPairs.length > 0) {
        console.warn(`[PTO Open Regen] Fallback: ${shortPairs.length} pairs below target`);
        for (const sp of shortPairs) {
          const needed = TARGET_GAMES - (pairGameCount.get(sp.id) || 0);
          const opponents = shuffle(s.pairs.filter(p => p.id !== sp.id));
          let added = 0;
          for (const opp of opponents) {
            if (added >= needed) break;
            if ((pairGameCount.get(opp.id) || 0) >= MAX_GAMES) continue;
            const mKey = matchupKey(sp.id, opp.id);
            if (usedMatchups.has(mKey)) continue;
            const pairTier: SkillTier = [sp.skillLevel, opp.skillLevel].includes("A") ? "A"
              : [sp.skillLevel, opp.skillLevel].includes("B") ? "B" : "C";
            regenerated.push({
              id: generateId(), pair1: sp, pair2: opp,
              skillLevel: pairTier,
              matchupLabel: `${sp.skillLevel} vs ${opp.skillLevel}`,
              status: "pending" as const, court: null,
            });
            usedMatchups.add(mKey);
            pairGameCount.set(sp.id, (pairGameCount.get(sp.id) || 0) + 1);
            pairGameCount.set(opp.id, (pairGameCount.get(opp.id) || 0) + 1);
            added++;
          }
        }
      }

      const finalMatches = [...frozen, ...regenerated].map((m, i) =>
        m.gameNumber !== i + 1 ? { ...m, gameNumber: i + 1 } : m
      );

      return { ...s, matches: finalMatches, totalScheduledGames: finalMatches.length };
    });
  }, [updateState]);

  const addLatePlayersToSchedule = useCallback(() => {
    updateState(s => {
      if (s.matches.length === 0) return s;

      const scheduledPlayerIds = new Set<string>();
      s.pairs.forEach(p => { scheduledPlayerIds.add(p.player1.id); scheduledPlayerIds.add(p.player2.id); });

      const latePlayers = s.roster.filter(p => p.checkedIn && !scheduledPlayerIds.has(p.id));
      if (latePlayers.length < 2) return s;

      const courtCount = s.sessionConfig.courtCount || 1;
      const existingMatchups = new Set<string>();
      s.matches.forEach(m => existingMatchups.add([m.pair1.id, m.pair2.id].sort().join("|||")));

      const newPairs: Pair[] = [];
      // Open mode: just pair them in order regardless of tier
      const shuffled = shuffle(latePlayers);
      for (let i = 0; i + 1 < shuffled.length; i += 2) {
        const p1 = shuffled[i], p2 = shuffled[i + 1];
        const pairTier: SkillTier = [p1.skillLevel, p2.skillLevel].includes("A") ? "A"
          : [p1.skillLevel, p2.skillLevel].includes("B") ? "B" : "C";
        newPairs.push({ id: generateId(), player1: p1, player2: p2, skillLevel: pairTier, wins: 0, losses: 0 });
      }

      if (newPairs.length === 0) return s;

      let allNewMatches: Match[] = [];
      for (const newPair of newPairs) {
        const matches = generateMatchesForNewPair(
          newPair,
          [...s.pairs, ...newPairs.filter(p => p.id !== newPair.id)],
          existingMatchups,
          s.matches.length + allNewMatches.length,
        );
        allNewMatches = [...allNewMatches, ...matches];
      }

      const updatedMatches = insertMatchesAfterFreezeLine(s.matches, allNewMatches, courtCount);

      return {
        ...s,
        pairs: [...s.pairs, ...newPairs],
        matches: updatedMatches,
        totalScheduledGames: updatedMatches.length,
        newlyAddedPairIds: newPairs.map(p => p.id),
      };
    });
  }, [updateState, generateMatchesForNewPair, insertMatchesAfterFreezeLine]);

  // ─── Skip / Swap / Replace / Player ops ───────────────────────
  const skipMatch = useCallback(
    (matchId: string) => {
      updateState(s => {
        const matchIdx = s.matches.findIndex(m => m.id === matchId);
        if (matchIdx === -1) return s;
        const match = s.matches[matchIdx];
        if (match.status !== "playing") return s;

        const freedCourt = match.court;
        const updatedMatches = [...s.matches];
        updatedMatches[matchIdx] = { ...match, status: "pending", court: null, startedAt: undefined };

        const [skipped] = updatedMatches.splice(matchIdx, 1);
        updatedMatches.push(skipped);

        if (freedCourt) {
          const recentPlayerIds = new Set<string>();
          const now = Date.now();
          for (const m of updatedMatches) {
            if (m.status === "completed" && m.completedAt && (now - Date.parse(m.completedAt)) < 420000) {
              getMatchPlayerIds(m).forEach(id => recentPlayerIds.add(id));
            }
          }
          getMatchPlayerIds(skipped).forEach(id => recentPlayerIds.add(id));
          const courtCount = s.sessionConfig.courtCount || 1;

          const nextPending = findNextPendingForCourt(updatedMatches, freedCourt, recentPlayerIds, s.pairs, updatedMatches, true);
          if (nextPending && canStartMatch(nextPending, updatedMatches)) {
            const idx = updatedMatches.findIndex(m => m.id === nextPending.id);
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

  const swapPlayersInPairs = useCallback(
    (pairAId: string, playerAId: string, pairBId: string, playerBId: string) => {
      updateState(s => {
        const pairA = s.pairs.find(p => p.id === pairAId);
        const pairB = s.pairs.find(p => p.id === pairBId);
        if (!pairA || !pairB) return s;
        // Open mode: allow cross-tier swaps

        const playerA = pairA.player1.id === playerAId ? pairA.player1 : pairA.player2;
        const playerB = pairB.player1.id === playerBId ? pairB.player1 : pairB.player2;

        const updatedPairs = s.pairs.map(p => {
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

  const swapWaitlistPlayer = useCallback(
    (pairId: string, displacedPlayerId: string, waitlistPlayer: Player) => {
      updateState(s => {
        const pair = s.pairs.find(p => p.id === pairId);
        if (!pair) return s;
        // Open mode: no tier restriction on swaps

        const isPlaying = s.matches.some(m => m.status === "playing" && getMatchPlayerIds(m).includes(displacedPlayerId));
        if (isPlaying) return s;

        const updatedPlayer: Player = { ...waitlistPlayer, checkedIn: true, checkInTime: new Date().toISOString() };
        const updatedPairs = s.pairs.map(p => {
          if (p.id !== pairId) return p;
          if (p.player1.id === displacedPlayerId) return { ...p, player1: updatedPlayer };
          if (p.player2.id === displacedPlayerId) return { ...p, player2: updatedPlayer };
          return p;
        });

        const updatedMatches = s.matches.map(m => {
          if (m.status === "completed") return m;
          const pairMap = new Map(updatedPairs.map(p => [p.id, p]));
          return { ...m, pair1: pairMap.get(m.pair1.id) || m.pair1, pair2: pairMap.get(m.pair2.id) || m.pair2 };
        });

        const currentWaitlist = s.waitlistedPlayers || [];
        const updatedWaitlist = [...currentWaitlist.filter(id => id !== waitlistPlayer.id), displacedPlayerId];

        return { ...s, pairs: updatedPairs, matches: updatedMatches, waitlistedPlayers: updatedWaitlist };
      });
    },
    [updateState]
  );

  const lockPairs = useCallback(
    () => { updateState(s => ({ ...s, pairsLocked: !s.pairsLocked })); },
    [updateState]
  );

  const replacePlayerInPair = useCallback(
    (oldPlayerId: string, newPlayerId: string) => {
      updateState(s => {
        const oldPlayer = s.roster.find(p => p.id === oldPlayerId);
        const newPlayer = s.roster.find(p => p.id === newPlayerId);
        if (!oldPlayer || !newPlayer) return s;

        const isPlaying = s.matches.some(m => m.status === "playing" && getMatchPlayerIds(m).includes(oldPlayerId));
        if (isPlaying) return s;

        const targetPair = s.pairs.find(p => p.player1.id === oldPlayerId || p.player2.id === oldPlayerId);
        if (!targetPair) return s;

        const updatedPairs = s.pairs.map(pair => {
          if (pair.id !== targetPair.id) return pair;
          if (pair.player1.id === oldPlayerId) return { ...pair, player1: newPlayer };
          if (pair.player2.id === oldPlayerId) return { ...pair, player2: newPlayer };
          return pair;
        });

        const updatedMatches = s.matches.map(m => {
          if (m.status === "completed") return m;
          const pairMap = new Map(updatedPairs.map(p => [p.id, p]));
          return { ...m, pair1: pairMap.get(m.pair1.id) || m.pair1, pair2: pairMap.get(m.pair2.id) || m.pair2 };
        });

        const updatedRoster = s.roster.map(p => {
          if (p.id === oldPlayerId) return { ...p, checkedIn: false };
          if (p.id === newPlayerId) return { ...p, checkedIn: true, checkInTime: new Date().toISOString() };
          return p;
        });

        return { ...s, roster: updatedRoster, pairs: updatedPairs, matches: updatedMatches };
      });
    },
    [updateState]
  );

  const swapPlayer = useCallback(
    (matchId: string, oldPlayerId: string, newPlayerId: string) => {
      updateState(s => {
        const match = s.matches.find(m => m.id === matchId);
        if (!match || match.status !== "pending") return s;
        const newPlayer = s.roster.find(p => p.id === newPlayerId);
        if (!newPlayer) return s;

        const targetPairId = [match.pair1, match.pair2].find(
          p => p.player1.id === oldPlayerId || p.player2.id === oldPlayerId
        )?.id;
        if (!targetPairId) return s;

        const updatedPairs = s.pairs.map(pair => {
          if (pair.id !== targetPairId) return pair;
          if (pair.player1.id === oldPlayerId) return { ...pair, player1: newPlayer };
          if (pair.player2.id === oldPlayerId) return { ...pair, player2: newPlayer };
          return pair;
        });

        const updatedMatches = syncPairsToMatches(updatedPairs, s.matches);
        return { ...s, pairs: updatedPairs, matches: updatedMatches };
      });
    },
    [updateState]
  );

  // ─── completeMatch ─────────────────────────────────────────────
  const completeMatch = useCallback(
    (matchId: string, winnerPairId: string) => {
      const match = state.matches.find(m => m.id === matchId);
      if (match && match.status === "playing") {
        const winnerPair = match.pair1.id === winnerPairId ? match.pair1 : match.pair2;
        awardMatchPoints(winnerPair, 3, "regular_win", matchId, state.practiceMode);
      }

      updateState(s => {
        const matchIdx = s.matches.findIndex(m => m.id === matchId);
        if (matchIdx === -1) return s;
        const match = s.matches[matchIdx];
        if (match.status !== "playing") {
          console.warn("[PTO Open] completeMatch skipped — match", matchId, "is", match.status, "not playing");
          return s;
        }
        const winnerPair = match.pair1.id === winnerPairId ? match.pair1 : match.pair2;
        const loserPair = match.pair1.id === winnerPairId ? match.pair2 : match.pair1;
        const freedCourt = match.court;

        const winnerIds = [winnerPair.player1.id, winnerPair.player2.id];
        const loserIds = [loserPair.player1.id, loserPair.player2.id];
        const updatedRoster = s.roster.map(p => {
          if (winnerIds.includes(p.id)) return { ...p, wins: p.wins + 1, gamesPlayed: p.gamesPlayed + 1 };
          if (loserIds.includes(p.id)) return { ...p, losses: p.losses + 1, gamesPlayed: p.gamesPlayed + 1 };
          return p;
        });

        const updatedPairs = s.pairs.map(p => {
          if (p.id === winnerPair.id) return { ...p, wins: p.wins + 1 };
          if (p.id === loserPair.id) return { ...p, losses: p.losses + 1 };
          return p;
        });

        let updatedMatches = [...s.matches];
        updatedMatches[matchIdx] = {
          ...match, status: "completed", winner: winnerPair, loser: loserPair, completedAt: new Date().toISOString(),
        };
        updatedMatches = syncPairsToMatches(updatedPairs, updatedMatches);

        const prevWatched = { ...(s.pairGamesWatched || {}) };
        const completedPairIds = new Set([match.pair1.id, match.pair2.id]);
        for (const pair of updatedPairs) {
          if (completedPairIds.has(pair.id)) prevWatched[pair.id] = 0;
          else prevWatched[pair.id] = (prevWatched[pair.id] || 0) + 1;
        }

        if (freedCourt) {
          const courtCount = s.sessionConfig.courtCount || 1;
          const completedByTime = updatedMatches
            .filter(m => m.status === "completed" && m.completedAt)
            .sort((a, b) => Date.parse(b.completedAt!) - Date.parse(a.completedAt!));
          const recentPlayerIds = new Set<string>();
          for (let i = 0; i < Math.min(courtCount, completedByTime.length); i++) {
            getMatchPlayerIds(completedByTime[i]).forEach(id => recentPlayerIds.add(id));
          }

          if (s.sessionConfig.dynamicMode) {
            const available = getAvailableTeams(updatedPairs, updatedMatches, prevWatched, TARGET_GAMES);
            const nextMatch = generateNextMatch(available, freedCourt, recentPlayerIds, updatedMatches);
            if (nextMatch && canStartMatch(nextMatch, updatedMatches)) {
              updatedMatches = [...updatedMatches, { ...nextMatch, status: "playing", court: freedCourt, startedAt: new Date().toISOString(), gameNumber: updatedMatches.length + 1 }];
            }
          } else {
            let nextPending = findNextPendingForCourt(updatedMatches, freedCourt, recentPlayerIds, updatedPairs, updatedMatches, false);
            if (!nextPending) nextPending = findNextPendingForCourt(updatedMatches, freedCourt, recentPlayerIds, updatedPairs, updatedMatches, true);
            if (nextPending && canStartMatch(nextPending, updatedMatches)) {
              const idx = updatedMatches.findIndex(m => m.id === nextPending!.id);
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
          pairGamesWatched: prevWatched,
        };
      });
    },
    [updateState, state.matches]
  );

  // ─── WSO Actions ───────────────────────────────────────────────
  const recordWsoWinner = useCallback(
    (courtNumber: number, winnerPairId: string) => {
      updateState(s => {
        if (!s.courts) return s;
        const courtState = s.courts.find(c => c.courtNumber === courtNumber);
        if (!courtState || courtState.format !== "winner_stays_on" || !courtState.wso?.currentGame) return s;

        const game = courtState.wso.currentGame;
        const winnerPair = game.pair1.id === winnerPairId ? game.pair1 : game.pair2;
        const loserPair = game.pair1.id === winnerPairId ? game.pair2 : game.pair1;

        const courts = s.courts.map(c => {
          if (c.courtNumber !== courtNumber || !c.wso?.currentGame) return c;

          const undoEntry: WsoUndoEntry = {
            previousGame: { ...c.wso.currentGame },
            previousQueue: [...c.wso.queue],
            previousStats: JSON.parse(JSON.stringify(c.wso.stats)),
          };

          const stats = JSON.parse(JSON.stringify(c.wso.stats)) as Record<string, WsoStats>;
          const ws = stats[winnerPair.id];
          if (ws) { ws.wins += 1; ws.streak += 1; ws.longestStreak = Math.max(ws.longestStreak, ws.streak); ws.gamesPlayed += 1; }
          const ls = stats[loserPair.id];
          if (ls) { ls.losses += 1; ls.streak = 0; ls.gamesPlayed += 1; }

          const newQueue = [...c.wso.queue, loserPair];
          const nextChallenger = newQueue.shift();
          const nextGameNumber = c.wso.gameCounter + 1;

          const completedGame: WsoGame = { ...game, winner: winnerPair, loser: loserPair, completedAt: new Date().toISOString() };
          const nextGame: WsoGame | null = nextChallenger ? {
            id: generateId(), pair1: winnerPair, pair2: nextChallenger,
            startedAt: new Date().toISOString(), gameNumber: nextGameNumber,
          } : null;

          let updatedSub = c.sub;
          if (c.sub) {
            const playingIds = [...getPairPlayerIds(game.pair1), ...getPairPlayerIds(game.pair2)];
            const updatedStats = { ...c.sub.playerStats };
            playingIds.forEach(pid => {
              if (updatedStats[pid]) updatedStats[pid] = { ...updatedStats[pid], gamesPlayed: updatedStats[pid].gamesPlayed + 1 };
            });
            const newGamesSince = c.sub.gamesSinceLastRotation + 1;
            const shouldRotate = newGamesSince >= c.sub.rotationFrequency;
            const target = shouldRotate ? findBestSubTarget({ ...c.sub, playerStats: updatedStats }, c.assignedPairs) : null;
            updatedSub = {
              ...c.sub, playerStats: updatedStats, gamesSinceLastRotation: newGamesSince,
              pendingRotation: shouldRotate, suggestedReplacementId: target?.playerId, suggestedPairId: target?.pairId,
            };
          }

          return {
            ...c, sub: updatedSub, wso: {
              ...c.wso, queue: newQueue, currentGame: nextGame,
              history: [...c.wso.history, completedGame], stats,
              undoStack: [...c.wso.undoStack, undoEntry].slice(-20),
              gameCounter: nextGameNumber,
            },
          };
        });

        const winnerIds = [winnerPair.player1.id, winnerPair.player2.id];
        const loserIds = [loserPair.player1.id, loserPair.player2.id];
        const updatedRoster = s.roster.map(p => {
          if (winnerIds.includes(p.id)) return { ...p, wins: p.wins + 1, gamesPlayed: p.gamesPlayed + 1 };
          if (loserIds.includes(p.id)) return { ...p, losses: p.losses + 1, gamesPlayed: p.gamesPlayed + 1 };
          return p;
        });
        const updatedPairs = s.pairs.map(p => {
          if (p.id === winnerPair.id) return { ...p, wins: p.wins + 1 };
          if (p.id === loserPair.id) return { ...p, losses: p.losses + 1 };
          return p;
        });
        const historyEntry: GameHistory = {
          id: generateId(), timestamp: new Date().toISOString(), court: courtNumber,
          winnerPairId: winnerPair.id, loserPairId: loserPair.id,
          winnerNames: `${winnerPair.player1.name} & ${winnerPair.player2.name}`,
          loserNames: `${loserPair.player1.name} & ${loserPair.player2.name}`,
        };

        return { ...s, courts, roster: updatedRoster, pairs: updatedPairs, gameHistory: [...s.gameHistory, historyEntry] };
      });
    },
    [updateState]
  );

  const undoWsoResult = useCallback(
    (courtNumber: number) => {
      updateState(s => {
        if (!s.courts) return s;
        const courtState = s.courts.find(c => c.courtNumber === courtNumber);
        if (!courtState || !courtState.wso || courtState.wso.undoStack.length === 0) return s;

        const lastUndo = courtState.wso.undoStack[courtState.wso.undoStack.length - 1];
        const lastHistory = courtState.wso.history[courtState.wso.history.length - 1];

        const courts = s.courts.map(c => {
          if (c.courtNumber !== courtNumber || !c.wso) return c;
          return {
            ...c, wso: {
              ...c.wso, currentGame: lastUndo.previousGame, queue: lastUndo.previousQueue,
              stats: lastUndo.previousStats, history: c.wso.history.slice(0, -1),
              undoStack: c.wso.undoStack.slice(0, -1), gameCounter: c.wso.gameCounter - 1,
            },
          };
        });

        if (!lastHistory?.winner || !lastHistory?.loser) return { ...s, courts };
        const wIds = [lastHistory.winner.player1.id, lastHistory.winner.player2.id];
        const lIds = [lastHistory.loser.player1.id, lastHistory.loser.player2.id];
        const updatedRoster = s.roster.map(p => {
          if (wIds.includes(p.id)) return { ...p, wins: Math.max(0, p.wins - 1), gamesPlayed: Math.max(0, p.gamesPlayed - 1) };
          if (lIds.includes(p.id)) return { ...p, losses: Math.max(0, p.losses - 1), gamesPlayed: Math.max(0, p.gamesPlayed - 1) };
          return p;
        });
        const updatedPairs = s.pairs.map(p => {
          if (p.id === lastHistory.winner!.id) return { ...p, wins: Math.max(0, p.wins - 1) };
          if (p.id === lastHistory.loser!.id) return { ...p, losses: Math.max(0, p.losses - 1) };
          return p;
        });

        const lastGH = [...s.gameHistory].reverse().find(h => h.court === courtNumber);
        const gameHistory = lastGH ? s.gameHistory.filter(h => h.id !== lastGH.id) : s.gameHistory;

        return { ...s, courts, roster: updatedRoster, pairs: updatedPairs, gameHistory };
      });
    },
    [updateState]
  );

  const reorderWsoQueue = useCallback(
    (courtNumber: number, newQueue: Pair[]) => {
      updateState(s => {
        if (!s.courts) return s;
        const courts = s.courts.map(c => {
          if (c.courtNumber !== courtNumber || !c.wso) return c;
          return { ...c, wso: { ...c.wso, queue: newQueue } };
        });
        return { ...s, courts };
      });
    },
    [updateState]
  );

  // ─── Sub Rotation ──────────────────────────────────────────────
  const executeSubRotation = useCallback(
    (courtNumber: number, playerToSitOutId: string) => {
      updateState(s => {
        if (!s.courts) return s;
        const courtIdx = s.courts.findIndex(c => c.courtNumber === courtNumber);
        if (courtIdx === -1) return s;
        const court = s.courts[courtIdx];
        if (!court.sub) return s;
        const sub = court.sub;
        const subPlayerId = sub.currentSubId;

        const targetPair = court.assignedPairs.find(p =>
          p.player1.id === playerToSitOutId || p.player2.id === playerToSitOutId
        );
        if (!targetPair) return s;

        const subPlayer = s.roster.find(p => p.id === subPlayerId);
        if (!subPlayer) return s;

        const updatedPairs = court.assignedPairs.map(p => {
          if (p.id !== targetPair.id) return p;
          if (p.player1.id === playerToSitOutId) return { ...p, player1: subPlayer };
          return { ...p, player2: subPlayer };
        });

        const updatedGlobalPairs = s.pairs.map(p => {
          if (p.id !== targetPair.id) return p;
          if (p.player1.id === playerToSitOutId) return { ...p, player1: subPlayer };
          return { ...p, player2: subPlayer };
        });

        const updatedSubStats = { ...sub.playerStats };
        if (updatedSubStats[playerToSitOutId]) {
          updatedSubStats[playerToSitOutId] = {
            ...updatedSubStats[playerToSitOutId],
            timesSubbedOut: updatedSubStats[playerToSitOutId].timesSubbedOut + 1,
          };
        }

        const updatedSub: SubRotation = {
          ...sub, currentSubId: playerToSitOutId, playerStats: updatedSubStats,
          gamesSinceLastRotation: 0, pendingRotation: false,
          suggestedReplacementId: undefined, suggestedPairId: undefined,
          rotationHistory: [
            ...sub.rotationHistory,
            { timestamp: new Date().toISOString(), subIn: subPlayerId, subOut: playerToSitOutId, pairId: targetPair.id },
          ],
        };

        const updatedSchedule = court.schedule.map(m => {
          if (m.status === "completed") return m;
          const updatePairInMatch = (pair: Pair): Pair => {
            if (pair.id !== targetPair.id) return pair;
            if (pair.player1.id === playerToSitOutId) return { ...pair, player1: subPlayer };
            if (pair.player2.id === playerToSitOutId) return { ...pair, player2: subPlayer };
            return pair;
          };
          return { ...m, pair1: updatePairInMatch(m.pair1), pair2: updatePairInMatch(m.pair2) };
        });

        let updatedWso = court.wso;
        if (court.format === "winner_stays_on" && court.wso) {
          const updateWsoPair = (pair: Pair): Pair => {
            if (pair.id !== targetPair.id) return pair;
            if (pair.player1.id === playerToSitOutId) return { ...pair, player1: subPlayer };
            if (pair.player2.id === playerToSitOutId) return { ...pair, player2: subPlayer };
            return pair;
          };
          updatedWso = {
            ...court.wso,
            queue: court.wso.queue.map(updateWsoPair),
            currentGame: court.wso.currentGame ? {
              ...court.wso.currentGame,
              pair1: updateWsoPair(court.wso.currentGame.pair1),
              pair2: updateWsoPair(court.wso.currentGame.pair2),
            } : null,
          };
        }

        const updatedCourt: OpenCourtState = {
          ...court, assignedPairs: updatedPairs, schedule: updatedSchedule, sub: updatedSub, wso: updatedWso,
        };

        const courts = s.courts.map((c, idx) => idx === courtIdx ? updatedCourt : c);
        return { ...s, courts, pairs: updatedGlobalPairs };
      });
    },
    [updateState]
  );

  const confirmSubRotationAction = useCallback(
    (courtNumber: number) => {
      updateState(s => {
        if (!s.courts) return s;
        const court = s.courts.find(c => c.courtNumber === courtNumber);
        if (!court?.sub?.pendingRotation || !court.sub.suggestedReplacementId) return s;

        const courtIdx = s.courts.findIndex(c => c.courtNumber === courtNumber);
        const sub = court.sub;
        const playerToSitOutId = sub.suggestedReplacementId!;
        const subPlayerId = sub.currentSubId;

        const targetPair = court.assignedPairs.find(p =>
          p.player1.id === playerToSitOutId || p.player2.id === playerToSitOutId
        );
        if (!targetPair) return s;

        const subPlayer = s.roster.find(p => p.id === subPlayerId);
        if (!subPlayer) return s;

        const updatedPairs = court.assignedPairs.map(p => {
          if (p.id !== targetPair.id) return p;
          if (p.player1.id === playerToSitOutId) return { ...p, player1: subPlayer };
          return { ...p, player2: subPlayer };
        });

        const updatedGlobalPairs = s.pairs.map(p => {
          if (p.id !== targetPair.id) return p;
          if (p.player1.id === playerToSitOutId) return { ...p, player1: subPlayer };
          return { ...p, player2: subPlayer };
        });

        const updatedSubStats = { ...sub.playerStats };
        if (updatedSubStats[playerToSitOutId]) {
          updatedSubStats[playerToSitOutId] = {
            ...updatedSubStats[playerToSitOutId],
            timesSubbedOut: updatedSubStats[playerToSitOutId].timesSubbedOut + 1,
          };
        }

        const updatedSub: SubRotation = {
          ...sub, currentSubId: playerToSitOutId, playerStats: updatedSubStats,
          gamesSinceLastRotation: 0, pendingRotation: false,
          suggestedReplacementId: undefined, suggestedPairId: undefined,
          rotationHistory: [
            ...sub.rotationHistory,
            { timestamp: new Date().toISOString(), subIn: subPlayerId, subOut: playerToSitOutId, pairId: targetPair.id },
          ],
        };

        const updatedSchedule = court.schedule.map(m => {
          if (m.status === "completed") return m;
          const updatePairInMatch = (pair: Pair): Pair => {
            if (pair.id !== targetPair.id) return pair;
            if (pair.player1.id === playerToSitOutId) return { ...pair, player1: subPlayer };
            if (pair.player2.id === playerToSitOutId) return { ...pair, player2: subPlayer };
            return pair;
          };
          return { ...m, pair1: updatePairInMatch(m.pair1), pair2: updatePairInMatch(m.pair2) };
        });

        let updatedWso = court.wso;
        if (court.format === "winner_stays_on" && court.wso) {
          const updateWsoPair = (pair: Pair): Pair => {
            if (pair.id !== targetPair.id) return pair;
            if (pair.player1.id === playerToSitOutId) return { ...pair, player1: subPlayer };
            if (pair.player2.id === playerToSitOutId) return { ...pair, player2: subPlayer };
            return pair;
          };
          updatedWso = {
            ...court.wso,
            queue: court.wso.queue.map(updateWsoPair),
            currentGame: court.wso.currentGame ? {
              ...court.wso.currentGame,
              pair1: updateWsoPair(court.wso.currentGame.pair1),
              pair2: updateWsoPair(court.wso.currentGame.pair2),
            } : null,
          };
        }

        const updatedCourt: OpenCourtState = {
          ...court, assignedPairs: updatedPairs, schedule: updatedSchedule, sub: updatedSub, wso: updatedWso,
        };

        const courts = s.courts.map((c, idx) => idx === courtIdx ? updatedCourt : c);
        return { ...s, courts, pairs: updatedGlobalPairs };
      });
    },
    [updateState]
  );

  const skipSubRotation = useCallback(
    (courtNumber: number) => {
      updateState(s => {
        if (!s.courts) return s;
        const courts = s.courts.map(c => {
          if (c.courtNumber !== courtNumber || !c.sub?.pendingRotation) return c;
          return {
            ...c, sub: {
              ...c.sub, pendingRotation: false, gamesSinceLastRotation: 0,
              suggestedReplacementId: undefined, suggestedPairId: undefined,
            },
          };
        });
        return { ...s, courts };
      });
    },
    [updateState]
  );

  // ─── addLatePlayerToCourt (Open mode) ─────────────────────────
  const addLatePlayerToCourt = useCallback(
    (name: string, tier: SkillTier, courtNumber?: number): { success: boolean; paired: boolean; courtNumber: number | null } => {
      let result: { success: boolean; paired: boolean; courtNumber: number | null } = { success: false, paired: false, courtNumber: null };
      updateState(s => {
        if (!s.courts || s.courts.length === 0) return s;
        if (s.roster.some(p => p.name.toLowerCase() === name.toLowerCase())) return s;

        // Open mode: pick target court by specified courtNumber, or default to court 1
        const targetCourtNum = courtNumber || 1;
        const courtIdx = s.courts.findIndex(c => c.courtNumber === targetCourtNum);
        if (courtIdx === -1) return s;
        const court = s.courts[courtIdx];

        const newPlayer: Player = {
          id: generateId(), name, skillLevel: tier, checkedIn: true, checkInTime: new Date().toISOString(),
          wins: 0, losses: 0, gamesPlayed: 0,
        };

        const updatedRoster = [...s.roster, newPlayer];

        // If court has a sub, pair with the sub
        if (court.sub) {
          const subPlayerId = court.sub.currentSubId;
          const subPlayer = updatedRoster.find(p => p.id === subPlayerId);
          if (subPlayer) {
            const pairTier: SkillTier = [newPlayer.skillLevel, subPlayer.skillLevel].includes("A") ? "A"
              : [newPlayer.skillLevel, subPlayer.skillLevel].includes("B") ? "B" : "C";
            const newPair: Pair = { id: generateId(), player1: newPlayer, player2: subPlayer, skillLevel: pairTier, wins: 0, losses: 0 };
            const updatedAssignedPairs = [...court.assignedPairs, newPair];
            let finalCourt: OpenCourtState = { ...court, assignedPairs: updatedAssignedPairs, sub: undefined };

            if (court.format === "winner_stays_on" && court.wso) {
              finalCourt.wso = {
                ...court.wso,
                queue: [...court.wso.queue, newPair],
                stats: {
                  ...court.wso.stats,
                  [newPair.id]: { pairId: newPair.id, wins: 0, losses: 0, streak: 0, longestStreak: 0, gamesPlayed: 0 },
                },
              };
            } else if (court.status === "active") {
              const sessionStart = s.sessionConfig.sessionStartedAt;
              const durationMin = s.sessionConfig.durationMinutes || 85;
              const now = Date.now();
              const elapsed = sessionStart ? (now - new Date(sessionStart).getTime()) / 60000 : 0;
              const remainingMin = Math.max(0, durationMin - elapsed);
              const totalAvailableSlots = Math.floor(remainingMin / 7);
              const lockThreshold = court.currentSlot + 2;
              const lockedGames = court.schedule.filter(m => {
                if (m.status === "completed" || m.status === "playing") return true;
                return (m.gameNumber ?? 0) < lockThreshold;
              });
              const remainingSlots = Math.max(0, totalAvailableSlots - lockedGames.length);
              const initialGameCounts = new Map<string, number>();
              updatedAssignedPairs.forEach(p => initialGameCounts.set(p.id, 0));
              lockedGames.forEach(m => {
                initialGameCounts.set(m.pair1.id, (initialGameCounts.get(m.pair1.id) || 0) + 1);
                initialGameCounts.set(m.pair2.id, (initialGameCounts.get(m.pair2.id) || 0) + 1);
              });
              const tempCourt: OpenCourtState = { ...finalCourt, schedule: [], completedGames: [], currentSlot: 0, standings: {} };
              const futureGames = generateCourtScheduleForSlots(tempCourt, remainingSlots, initialGameCounts);
              const renumbered = futureGames.map((m, idx) => ({ ...m, gameNumber: lockThreshold + idx }));
              finalCourt.schedule = [...lockedGames, ...renumbered];
            }

            const updatedCourts = s.courts.map((c, idx) => idx === courtIdx ? finalCourt : c);
            const totalScheduled = updatedCourts.reduce((sum, c) => sum + c.schedule.length, 0);
            result = { success: true, paired: true, courtNumber: targetCourtNum };
            return {
              ...s, roster: updatedRoster, pairs: [...s.pairs, newPair],
              courts: updatedCourts, totalScheduledGames: totalScheduled,
              newlyAddedPairIds: [...(s.newlyAddedPairIds || []), newPair.id],
            };
          }
        }

        // Check court waitlist for a partner
        const waitlist = court.courtWaitlist || [];
        const partnerPlayerId = waitlist.find(pid => updatedRoster.find(p => p.id === pid));

        if (!partnerPlayerId) {
          const updatedCourts = s.courts.map((c, idx) => {
            if (idx !== courtIdx) return c;
            return { ...c, courtWaitlist: [...waitlist, newPlayer.id] };
          });
          result = { success: true, paired: false, courtNumber: targetCourtNum };
          return { ...s, roster: updatedRoster, courts: updatedCourts };
        }

        const partner = updatedRoster.find(p => p.id === partnerPlayerId)!;
        const pairTier: SkillTier = [newPlayer.skillLevel, partner.skillLevel].includes("A") ? "A"
          : [newPlayer.skillLevel, partner.skillLevel].includes("B") ? "B" : "C";
        const newPair: Pair = { id: generateId(), player1: newPlayer, player2: partner, skillLevel: pairTier, wins: 0, losses: 0 };
        const newWaitlist = waitlist.filter(pid => pid !== partnerPlayerId);
        const updatedAssignedPairs = [...court.assignedPairs, newPair];
        const updatedCourt: OpenCourtState = { ...court, assignedPairs: updatedAssignedPairs, courtWaitlist: newWaitlist };

        if (court.format === "winner_stays_on" && court.wso) {
          const updatedWso: WsoState = {
            ...court.wso,
            queue: [...court.wso.queue, newPair],
            stats: { ...court.wso.stats, [newPair.id]: { pairId: newPair.id, wins: 0, losses: 0, streak: 0, longestStreak: 0, gamesPlayed: 0 } },
          };
          const finalCourt: OpenCourtState = { ...updatedCourt, wso: updatedWso };
          const updatedCourts = s.courts.map((c, idx) => idx === courtIdx ? finalCourt : c);
          result = { success: true, paired: true, courtNumber: targetCourtNum };
          return {
            ...s, roster: updatedRoster, pairs: [...s.pairs, newPair],
            courts: updatedCourts, newlyAddedPairIds: [...(s.newlyAddedPairIds || []), newPair.id],
          };
        } else if (court.status === "active") {
          const currentSlot = court.currentSlot;
          const lockThreshold = currentSlot + 2;
          const lockedGames = court.schedule.filter(m => {
            if (m.status === "completed" || m.status === "playing") return true;
            return (m.gameNumber ?? 0) < lockThreshold;
          });
          const sessionStart = s.sessionConfig.sessionStartedAt;
          const durationMin = s.sessionConfig.durationMinutes || 85;
          const now = Date.now();
          const elapsed = sessionStart ? (now - new Date(sessionStart).getTime()) / 60000 : 0;
          const remainingMin = Math.max(0, durationMin - elapsed);
          const totalAvailableSlots = Math.floor(remainingMin / 7);
          const remainingSlots = Math.max(0, totalAvailableSlots - lockedGames.length);
          const initialGameCounts = new Map<string, number>();
          updatedAssignedPairs.forEach(p => initialGameCounts.set(p.id, 0));
          lockedGames.forEach(m => {
            initialGameCounts.set(m.pair1.id, (initialGameCounts.get(m.pair1.id) || 0) + 1);
            initialGameCounts.set(m.pair2.id, (initialGameCounts.get(m.pair2.id) || 0) + 1);
          });
          const tempCourt: OpenCourtState = { ...updatedCourt, assignedPairs: updatedAssignedPairs, schedule: [], completedGames: [], currentSlot: 0, standings: {} };
          const futureGames = generateCourtScheduleForSlots(tempCourt, remainingSlots, initialGameCounts);
          const renumbered = futureGames.map((m, idx) => ({ ...m, gameNumber: lockThreshold + idx }));
          const finalSchedule = [...lockedGames, ...renumbered];
          const finalCourt: OpenCourtState = { ...updatedCourt, schedule: finalSchedule };
          const updatedCourts = s.courts.map((c, idx) => idx === courtIdx ? finalCourt : c);
          const totalScheduled = updatedCourts.reduce((sum, c) => sum + c.schedule.length, 0);
          result = { success: true, paired: true, courtNumber: targetCourtNum };
          return {
            ...s, roster: updatedRoster, pairs: [...s.pairs, newPair],
            courts: updatedCourts, totalScheduledGames: totalScheduled,
            newlyAddedPairIds: [...(s.newlyAddedPairIds || []), newPair.id],
          };
        } else {
          const updatedCourts = s.courts.map((c, idx) => idx === courtIdx ? updatedCourt : c);
          result = { success: true, paired: true, courtNumber: targetCourtNum };
          return {
            ...s, roster: updatedRoster, pairs: [...s.pairs, newPair],
            courts: updatedCourts, newlyAddedPairIds: [...(s.newlyAddedPairIds || []), newPair.id],
          };
        }
      });
      return result;
    },
    [updateState]
  );

  // ─── removePlayerMidSession (Open mode) ───────────────────────
  const removePlayerMidSession = useCallback(
    (playerId: string): { success: boolean; affected: number } => {
      let result = { success: false, affected: 0 };
      updateState(s => {
        const player = s.roster.find(p => p.id === playerId);
        if (!player) return s;

        const updatedRoster = s.roster.map(p =>
          p.id === playerId ? { ...p, checkedIn: false, isActive: false } : p
        );

        const playerPairIds = new Set<string>();
        s.pairs.forEach(pair => {
          if (pair.player1.id === playerId || pair.player2.id === playerId) playerPairIds.add(pair.id);
        });

        const updatedPairs = s.pairs.filter(p => !playerPairIds.has(p.id));

        let updatedMatches = s.matches.map(m => {
          if (m.status !== "playing") return m;
          const pair1Removed = playerPairIds.has(m.pair1.id);
          const pair2Removed = playerPairIds.has(m.pair2.id);
          if (!pair1Removed && !pair2Removed) return m;
          const winnerPair = pair1Removed ? m.pair2 : m.pair1;
          const loserPair = pair1Removed ? m.pair1 : m.pair2;
          return { ...m, status: "completed" as const, winner: winnerPair, loser: loserPair, completedAt: new Date().toISOString() };
        });

        // Find orphaned opponents
        const orphanedPairIds = new Set<string>();
        s.matches.forEach(m => {
          if (m.status !== "pending" && m.status !== "playing") return;
          if (playerPairIds.has(m.pair1.id)) orphanedPairIds.add(m.pair2.id);
          if (playerPairIds.has(m.pair2.id)) orphanedPairIds.add(m.pair1.id);
        });

        const beforeCount = updatedMatches.filter(m => m.status === "pending").length;
        updatedMatches = updatedMatches.filter(m => {
          if (m.status !== "pending") return true;
          return !playerPairIds.has(m.pair1.id) && !playerPairIds.has(m.pair2.id);
        });
        const afterCount = updatedMatches.filter(m => m.status === "pending").length;
        const affected = beforeCount - afterCount;

        const existingMatchups = new Set<string>();
        updatedMatches.forEach(m => existingMatchups.add([m.pair1.id, m.pair2.id].sort().join("|||")));

        let gameNum = updatedMatches.length;
        const replacementMatches: Match[] = [];

        for (const orphanId of orphanedPairIds) {
          if (playerPairIds.has(orphanId)) continue;
          const orphanPair = updatedPairs.find(p => p.id === orphanId);
          if (!orphanPair) continue;

          const pendingGames = updatedMatches.filter(
            m => m.status === "pending" && (m.pair1.id === orphanId || m.pair2.id === orphanId)
          ).length;

          // Open mode: all pairs are valid opponents
          const opponents = shuffle(updatedPairs.filter(p => p.id !== orphanId));
          const targetTotal = 3;
          const needed = Math.max(0, targetTotal - pendingGames);
          let added = 0;

          for (const opp of opponents) {
            if (added >= needed) break;
            const mKey = [orphanId, opp.id].sort().join("|||");
            if (existingMatchups.has(mKey)) continue;
            const pairTier: SkillTier = [orphanPair.skillLevel, opp.skillLevel].includes("A") ? "A"
              : [orphanPair.skillLevel, opp.skillLevel].includes("B") ? "B" : "C";
            gameNum++;
            replacementMatches.push({
              id: generateId(), pair1: orphanPair, pair2: opp,
              skillLevel: pairTier,
              matchupLabel: `${orphanPair.skillLevel} vs ${opp.skillLevel}`,
              status: "pending", court: null, gameNumber: gameNum,
            });
            existingMatchups.add(mKey);
            added++;
          }
        }

        updatedMatches = [...updatedMatches, ...replacementMatches];
        updatedMatches = syncPairsToMatches(updatedPairs, updatedMatches);

        const activePairIds = new Set(updatedPairs.map(p => p.id));
        updatedMatches = updatedMatches.filter(m => {
          if (m.status === "completed") return true;
          return activePairIds.has(m.pair1.id) && activePairIds.has(m.pair2.id);
        });
        updatedMatches = updatedMatches.map((m, i) => m.gameNumber !== i + 1 ? { ...m, gameNumber: i + 1 } : m);

        result = { success: true, affected };
        return { ...s, roster: updatedRoster, pairs: updatedPairs, matches: updatedMatches, totalScheduledGames: updatedMatches.length };
      });
      return result;
    },
    [updateState]
  );

  const swapPlayerMidSession = useCallback(
    (oldPlayerId: string, newPlayerName: string, tier: SkillTier): { success: boolean; affected: number } => {
      let result = { success: false, affected: 0 };
      updateState(s => {
        const oldPlayer = s.roster.find(p => p.id === oldPlayerId);
        if (!oldPlayer) return s;

        const isPlaying = s.matches.some(m => m.status === "playing" && getMatchPlayerIds(m).includes(oldPlayerId));
        if (isPlaying) return s;

        const newPlayer: Player = {
          id: generateId(), name: newPlayerName, skillLevel: tier, checkedIn: true,
          checkInTime: new Date().toISOString(), wins: 0, losses: 0, gamesPlayed: 0,
        };

        const targetPair = s.pairs.find(p => p.player1.id === oldPlayerId || p.player2.id === oldPlayerId);
        if (!targetPair) return s;

        const updatedPairs = s.pairs.map(pair => {
          if (pair.id !== targetPair.id) return pair;
          if (pair.player1.id === oldPlayerId) return { ...pair, player1: newPlayer };
          if (pair.player2.id === oldPlayerId) return { ...pair, player2: newPlayer };
          return pair;
        });

        let affected = 0;
        const updatedMatches = s.matches.map(m => {
          if (m.status === "completed") return m;
          const pairMap = new Map(updatedPairs.map(p => [p.id, p]));
          const involves = m.pair1.id === targetPair.id || m.pair2.id === targetPair.id;
          if (involves) affected++;
          return { ...m, pair1: pairMap.get(m.pair1.id) || m.pair1, pair2: pairMap.get(m.pair2.id) || m.pair2 };
        });

        const updatedRoster = [
          ...s.roster.map(p => p.id === oldPlayerId ? { ...p, checkedIn: false, isActive: false } : p),
          newPlayer,
        ];

        result = { success: true, affected };
        return { ...s, roster: updatedRoster, pairs: updatedPairs, matches: updatedMatches };
      });
      return result;
    },
    [updateState]
  );

  const addPlayerMidSession = useCallback(
    (name: string, tier: SkillTier): { success: boolean; affected: number } => {
      let result = { success: false, affected: 0 };
      updateState(s => {
        if (s.roster.some(p => p.name.toLowerCase() === name.toLowerCase())) return s;

        const newPlayer: Player = {
          id: generateId(), name, skillLevel: tier, checkedIn: true,
          checkInTime: new Date().toISOString(), wins: 0, losses: 0, gamesPlayed: 0,
        };

        const updatedRoster = [...s.roster, newPlayer];

        const pairedPlayerIds = new Set<string>();
        s.pairs.forEach(p => { pairedPlayerIds.add(p.player1.id); pairedPlayerIds.add(p.player2.id); });

        // Open mode: find ANY unpaired checked-in player
        const unpairedPartner = updatedRoster.find(
          p => p.checkedIn && !pairedPlayerIds.has(p.id) && p.id !== newPlayer.id
        );

        if (!unpairedPartner) {
          result = { success: true, affected: 0 };
          return { ...s, roster: updatedRoster };
        }

        const pairTier: SkillTier = [newPlayer.skillLevel, unpairedPartner.skillLevel].includes("A") ? "A"
          : [newPlayer.skillLevel, unpairedPartner.skillLevel].includes("B") ? "B" : "C";
        const newPair: Pair = { id: generateId(), player1: newPlayer, player2: unpairedPartner, skillLevel: pairTier, wins: 0, losses: 0 };

        const existingMatchups = new Set<string>();
        s.matches.forEach(m => existingMatchups.add([m.pair1.id, m.pair2.id].sort().join("|||")));

        const newMatches: Match[] = [];
        let gameNum = s.totalScheduledGames;
        const opponents = shuffle(s.pairs);

        for (const opp of opponents) {
          if (newMatches.length >= TARGET_GAMES) break;
          const mKey = [newPair.id, opp.id].sort().join("|||");
          if (existingMatchups.has(mKey)) continue;
          const oppTier: SkillTier = [newPair.skillLevel, opp.skillLevel].includes("A") ? "A"
            : [newPair.skillLevel, opp.skillLevel].includes("B") ? "B" : "C";
          gameNum++;
          newMatches.push({
            id: generateId(), pair1: newPair, pair2: opp, skillLevel: oppTier,
            matchupLabel: `${newPair.skillLevel} vs ${opp.skillLevel}`,
            status: "pending", court: null, gameNumber: gameNum,
          });
          existingMatchups.add(mKey);
        }

        result = { success: true, affected: newMatches.length };
        return {
          ...s, roster: updatedRoster, pairs: [...s.pairs, newPair],
          matches: [...s.matches, ...newMatches], totalScheduledGames: gameNum,
        };
      });
      return result;
    },
    [updateState]
  );

  const correctGameResult = useCallback(
    (matchId: string, newWinnerPairId: string) => {
      updateState(s => {
        const matchIdx = s.matches.findIndex(m => m.id === matchId);
        if (matchIdx === -1) return s;
        const match = s.matches[matchIdx];
        if (match.status !== "completed" || !match.winner || !match.loser) return s;
        if (match.winner.id === newWinnerPairId) return s;

        const newWinner = match.pair1.id === newWinnerPairId ? match.pair1 : match.pair2;
        const newLoser = match.pair1.id === newWinnerPairId ? match.pair2 : match.pair1;
        const oldWinnerIds = [match.winner.player1.id, match.winner.player2.id];
        const oldLoserIds = [match.loser.player1.id, match.loser.player2.id];

        const updatedRoster = s.roster.map(p => {
          let { wins, losses } = p;
          if (oldWinnerIds.includes(p.id)) { wins--; losses++; }
          if (oldLoserIds.includes(p.id)) { losses--; wins++; }
          return { ...p, wins: Math.max(0, wins), losses: Math.max(0, losses) };
        });

        const updatedPairs = s.pairs.map(p => {
          if (p.id === match.winner!.id) return { ...p, wins: Math.max(0, p.wins - 1), losses: p.losses + 1 };
          if (p.id === match.loser!.id) return { ...p, losses: Math.max(0, p.losses - 1), wins: p.wins + 1 };
          return p;
        });

        let updatedMatches = [...s.matches];
        updatedMatches[matchIdx] = { ...match, winner: newWinner, loser: newLoser };
        updatedMatches = syncPairsToMatches(updatedPairs, updatedMatches);

        const updatedHistory = s.gameHistory.map(h => {
          if (h.winnerPairId === match.winner!.id && h.loserPairId === match.loser!.id && h.timestamp === match.completedAt) {
            return {
              ...h, winnerPairId: newWinner.id, loserPairId: newLoser.id,
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

  // ─── Session reset ──────────────────────────────────────────────
  const resetSession = useCallback((keepRoster = false) => {
    updateState(prev => {
      if (keepRoster && prev.roster.length > 0) {
        const freshRoster = prev.roster.map(p => ({
          ...p, checkedIn: false, checkInTime: null, wins: 0, losses: 0, gamesPlayed: 0,
        }));
        return { ...OPEN_DEFAULT_STATE, roster: freshRoster, playoffMatches: [], playoffsStarted: false };
      }
      return { ...OPEN_DEFAULT_STATE, playoffMatches: [], playoffsStarted: false };
    });
  }, [updateState]);

  // ─── Playoffs ───────────────────────────────────────────────────
  const startPlayoffs = useCallback(() => {
    updateState(s => {
      const courtCount = s.sessionConfig.courtCount || 1;
      // Gather all matches including WSO history from courts
      const allMatches: Match[] = [...s.matches];
      if (s.courts) {
        s.courts.forEach(c => {
          if (c.wso) {
            c.wso.history.forEach(g => {
              if (g.winner && g.loser) {
                allMatches.push({
                  id: g.id, pair1: g.pair1, pair2: g.pair2,
                  skillLevel: "B", matchupLabel: "WSO", status: "completed",
                  court: c.courtNumber, winner: g.winner, loser: g.loser,
                });
              }
            });
          }
        });
      }
      const seeds = computeOpenPlayoffSeedings(allMatches, s.pairs, courtCount);
      if (seeds.length < 2) return { ...s, playoffsStarted: true };

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

      // Auto-assign first round matches to courts
      const assignedPlayerIds = new Set<string>();
      let courtNum = 1;
      for (const pm of playoffMatches) {
        if (courtNum > courtCount) break;
        if (pm.round !== 1 || !pm.pair1 || !pm.pair2) continue;
        const ids = [pm.pair1.player1.id, pm.pair1.player2.id, pm.pair2.player1.id, pm.pair2.player2.id];
        if (ids.some(id => assignedPlayerIds.has(id))) continue;
        ids.forEach(id => assignedPlayerIds.add(id));
        pm.status = "playing";
        pm.court = courtNum;
        courtNum++;
      }

      return { ...s, playoffsStarted: true, playoffMatches };
    });
  }, [updateState]);

  const generatePlayoffMatches = useCallback(
    (seeds: { seed: number; pair: Pair; winPct: number }[]) => {
      if (seeds.length < 2) return;
      const matches: PlayoffMatch[] = [];
      const numMatches = Math.floor(seeds.length / 2);
      for (let i = 0; i < numMatches; i++) {
        const s1 = seeds[i];
        const s2 = seeds[seeds.length - 1 - i];
        if (!s1 || !s2) continue;
        matches.push({ id: generateId(), round: 1, seed1: s1.seed, seed2: s2.seed, pair1: s1.pair, pair2: s2.pair, status: "pending" });
      }
      updateState(s => ({ ...s, playoffMatches: matches }));
    },
    [updateState]
  );

  const startPlayoffMatch = useCallback(
    (matchId: string, court: number) => {
      updateState(s => {
        const courtBusy = s.matches.some(m => m.court === court && m.status === "playing");
        if (courtBusy) return s;
        const playoffCourtBusy = s.playoffMatches.some(m => m.court === court && m.status === "playing");
        if (playoffCourtBusy) return s;
        return {
          ...s,
          playoffMatches: s.playoffMatches.map(m => m.id === matchId ? { ...m, status: "playing" as const, court } : m),
        };
      });
    },
    [updateState]
  );

  const completePlayoffMatch = useCallback(
    (matchId: string, winnerPairId: string) => {
      const pm = state.playoffMatches.find(m => m.id === matchId);
      if (pm && pm.status === "playing") {
        const winnerPair = pm.pair1?.id === winnerPairId ? pm.pair1 : pm.pair2;
        if (winnerPair) {
          const roundMatches = state.playoffMatches.filter(m => m.round === pm.round);
          const isFinal = roundMatches.length === 1;
          const pts: 5 | 10 = isFinal ? 10 : 5;
          const reason: PointsReason = isFinal ? "tournament_win" : "playoff_win";
          awardMatchPoints(winnerPair, pts, reason, matchId, state.practiceMode);
        }
      }

      updateState(s => {
        const pmIdx = s.playoffMatches.findIndex(m => m.id === matchId);
        if (pmIdx === -1) return s;
        const pm = s.playoffMatches[pmIdx];
        if (pm.status !== "playing") return s;

        const winner = pm.pair1?.id === winnerPairId ? pm.pair1 : pm.pair2;
        const freedCourt = pm.court || null;
        const updated = [...s.playoffMatches];
        updated[pmIdx] = { ...pm, status: "completed", winner: winner || undefined };

        const currentRound = pm.round;
        const roundMatches = updated.filter(m => m.round === currentRound);
        const allComplete = roundMatches.every(m => m.status === "completed");

        if (allComplete) {
          const winners = roundMatches.map(m => m.winner).filter(Boolean) as Pair[];
          if (winners.length >= 2) {
            const nextRound = currentRound + 1;
            for (let i = 0; i < Math.floor(winners.length / 2); i++) {
              updated.push({
                id: generateId(), round: nextRound, seed1: 0, seed2: 0,
                pair1: winners[i * 2], pair2: winners[i * 2 + 1], status: "pending",
              });
            }
          }
        }

        if (freedCourt) {
          const playingPlayerIds = new Set<string>();
          updated.filter(m => m.status === "playing").forEach(m => {
            if (m.pair1) [m.pair1.player1.id, m.pair1.player2.id].forEach(id => playingPlayerIds.add(id));
            if (m.pair2) [m.pair2.player1.id, m.pair2.player2.id].forEach(id => playingPlayerIds.add(id));
          });
          const nextPending = updated.find(m => {
            if (m.status !== "pending" || !m.pair1 || !m.pair2) return false;
            const ids = [m.pair1.player1.id, m.pair1.player2.id, m.pair2.player1.id, m.pair2.player2.id];
            return !ids.some(id => playingPlayerIds.has(id));
          });
          if (nextPending) {
            const nIdx = updated.indexOf(nextPending);
            if (nIdx !== -1) updated[nIdx] = { ...nextPending, status: "playing", court: freedCourt };
          }
        }

        return { ...s, playoffMatches: updated };
      });
    },
    [updateState, state.playoffMatches]
  );

  // ─── Derived values ─────────────────────────────────────────────
  const checkedInPlayers = state.roster.filter(p => p.checkedIn);
  const playingMatches = state.matches.filter(m => m.status === "playing");
  const pendingMatches = state.matches.filter(m => m.status === "pending");
  const completedMatches = state.matches.filter(m => m.status === "completed");
  const court1Match = playingMatches.find(m => m.court === 1) || null;
  const court2Match = playingMatches.find(m => m.court === 2) || null;
  const openCourtCount = state.sessionConfig.courtCount || 1;
  const busyPlayerIdSet = new Set(playingMatches.flatMap(m => getMatchPlayerIds(m)));
  const eligiblePending = pendingMatches.filter(m => {
    const pids = getMatchPlayerIds(m);
    return !pids.some(id => busyPlayerIdSet.has(id));
  });
  const upNextMatches = eligiblePending.slice(0, openCourtCount);
  const onDeckMatches = eligiblePending.slice(openCourtCount, openCourtCount * 2);
  const playingPlayerIds = playingMatches.flatMap(m => getMatchPlayerIds(m));
  const waitingPlayers = checkedInPlayers.filter(p => !playingPlayerIds.includes(p.id));

  return {
    state,
    loading,
    setSessionConfig,
    setFixedPairs,
    addPlayer,
    removePlayer,
    toggleSkillLevel,
    toggleCoach,
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
    setCourtFormat,
    recordWsoWinner,
    undoWsoResult,
    reorderWsoQueue,
    executeSubRotation,
    confirmSubRotationAction,
    skipSubRotation,
    startCourt,
    startAllCourts,
    resetSession,
    startPlayoffs,
    removePlayerMidSession,
    swapPlayerMidSession,
    addPlayerMidSession,
    addLatePlayerToCourt,
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
    court3Match: null,
    waitingPlayers,
    upNextMatches,
    onDeckMatches,
    practiceMode: !!state.practiceMode,
    togglePracticeMode: () => { updateState(s => ({ ...s, practiceMode: !s.practiceMode })); },
  };
}

// ── Test-only exports ────────────────────────────────────────────────
export const _testExports = {
  getAvailableTeams,
  generateNextMatch,
  findNextPendingForCourt,
  getPairPlayerIds,
  getMatchPlayerIds,
  generateId,
  syncPairsToMatches,
  canStartMatch,
  mergeStates,
  computeOpenPlayoffSeedings,
  createSessionPairs,
  generateCourtScheduleForSlots,
  initializeWsoState,
};
