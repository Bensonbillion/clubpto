import { supabase } from "@/integrations/supabase/client";

// ── Types ──────────────────────────────────────────────────

export type PointsReason = "regular_win" | "playoff_win" | "tournament_win";

export interface LeaderboardEntry {
  playerId: string;
  playerName: string;
  points: number;
  wins: number;
  rank: number;
}

export interface PlayerProfile {
  id: string;
  firstName: string;
  lastName: string;
  preferredName: string | null;
  displayName: string;
  email: string;
  totalPoints: number;
  totalWins: number;
  createdAt: string;
  thisWeek: {
    points: number;
    wins: number;
    rank: number | null;
  };
}

// ── Helpers ────────────────────────────────────────────────

/** Returns the Monday (start of ISO week) for the given date, as YYYY-MM-DD. */
export function getWeekStartDate(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split("T")[0];
}

// ── Function 1: Award Points (stub — points_ledger table not yet created) ──

export async function awardPoints(
  _playerId: string,
  _points: 3 | 5 | 10,
  _reason: PointsReason,
  _matchId?: string,
): Promise<{ success: boolean; ledgerId?: string; error?: string }> {
  // TODO: implement when points_ledger table & award_points RPC are created
  return { success: false, error: "Points system not yet configured" };
}

// ── Function 2: Get Weekly Leaderboard (stub) ─────────────

export async function getWeeklyLeaderboard(
  _weekStartDate?: Date,
): Promise<{ data?: LeaderboardEntry[]; error?: string }> {
  // TODO: implement when weekly_leaderboard view is created
  return { data: [] };
}

export function aggregateAndRank(rawData: any[]): LeaderboardEntry[] {
  const playerMap = new Map<
    string,
    { playerId: string; playerName: string; points: number; wins: number }
  >();

  for (const entry of rawData) {
    const playerId = entry.player_id;
    const player = entry.players;
    const displayName = player?.preferred_name || player?.name || "Unknown";

    if (!playerMap.has(playerId)) {
      playerMap.set(playerId, {
        playerId,
        playerName: displayName,
        points: 0,
        wins: 0,
      });
    }

    const acc = playerMap.get(playerId)!;
    acc.points += entry.points;
    acc.wins += 1;
  }

  return Array.from(playerMap.values())
    .sort((a, b) => b.points - a.points)
    .map((player, index) => ({
      ...player,
      rank: index + 1,
    }));
}

// ── Function 3: Get All-Time Leaderboard ──────────────────

export async function getAllTimeLeaderboard(): Promise<{ data?: LeaderboardEntry[]; error?: string }> {
  const { data, error } = await supabase
    .from("players")
    .select("id, name, preferred_name, total_points, total_wins")
    .gt("total_points", 0)
    .order("total_points", { ascending: false });

  if (error) return { error: error.message };
  if (!data || data.length === 0) return { data: [] };

  return {
    data: data.map((p: any, i: number) => ({
      playerId: p.id,
      playerName: p.preferred_name || p.name,
      points: p.total_points,
      wins: p.total_wins,
      rank: i + 1,
    })),
  };
}

// ── Function 4: Get Player Profile with Stats ─────────────

export async function getPlayerProfile(
  playerId: string,
): Promise<{ data?: PlayerProfile; error?: string }> {
  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("*")
    .eq("id", playerId)
    .single();

  if (playerError) return { error: playerError.message };

  return {
    data: {
      id: player.id,
      firstName: player.first_name || player.name || "",
      lastName: player.last_name || "",
      preferredName: player.preferred_name,
      displayName: player.preferred_name || player.first_name || player.name || "",
      email: player.email || "",
      totalPoints: player.total_points,
      totalWins: player.total_wins,
      createdAt: player.created_at,
      thisWeek: {
        points: 0,
        wins: 0,
        rank: null,
      },
    },
  };
}
