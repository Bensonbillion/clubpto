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

// ── Function 1: Award Points ──────────────────────────────

export async function awardPoints(
  playerId: string,
  points: 3 | 5 | 10,
  reason: PointsReason,
  matchId?: string,
): Promise<{ success: boolean; ledgerId?: string; error?: string }> {
  const weekStart = getWeekStartDate(new Date());

  // Use the database function for atomic insert + update + refresh
  const { data, error } = await supabase.rpc("award_points", {
    p_player_id: playerId,
    p_points: points,
    p_reason: reason,
    p_match_id: matchId ?? null,
    p_week_start_date: weekStart,
  });

  if (error) {
    console.error("Failed to award points:", error);
    return { success: false, error: error.message };
  }

  return { success: true, ledgerId: data as string };
}

// ── Function 2: Get Weekly Leaderboard ────────────────────

export async function getWeeklyLeaderboard(
  weekStartDate?: Date,
): Promise<{ data?: LeaderboardEntry[]; error?: string }> {
  const weekStart = weekStartDate
    ? getWeekStartDate(weekStartDate)
    : getWeekStartDate(new Date());

  // Try materialized view first (fast path)
  const { data: viewData, error: viewError } = await supabase
    .from("weekly_leaderboard")
    .select("*")
    .eq("week_start_date", weekStart)
    .order("rank", { ascending: true });

  if (!viewError && viewData && viewData.length > 0) {
    return {
      data: viewData.map((row: any) => ({
        playerId: row.player_id,
        playerName: row.player_name,
        points: row.points,
        wins: row.wins,
        rank: row.rank,
      })),
    };
  }

  // Fallback: compute from points_ledger directly
  const { data: rawData, error } = await supabase
    .from("points_ledger")
    .select(`
      player_id,
      points,
      players!inner (
        first_name,
        last_name,
        preferred_name
      )
    `)
    .eq("week_start_date", weekStart);

  if (error) return { error: error.message };
  if (!rawData || rawData.length === 0) return { data: [] };

  const leaderboard = aggregateAndRank(rawData);
  return { data: leaderboard };
}

export function aggregateAndRank(rawData: any[]): LeaderboardEntry[] {
  const playerMap = new Map<
    string,
    { playerId: string; playerName: string; points: number; wins: number }
  >();

  for (const entry of rawData) {
    const playerId = entry.player_id;
    const player = entry.players;
    const displayName = player.preferred_name || player.first_name;

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
    .select("id, first_name, last_name, preferred_name, total_points, total_wins")
    .gt("total_points", 0)
    .order("total_points", { ascending: false });

  if (error) return { error: error.message };
  if (!data || data.length === 0) return { data: [] };

  return {
    data: data.map((p: any, i: number) => ({
      playerId: p.id,
      playerName: p.preferred_name || p.first_name,
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

  // Current week stats
  const weekStart = getWeekStartDate(new Date());
  const { data: weekStats } = await supabase
    .from("points_ledger")
    .select("points, reason")
    .eq("player_id", playerId)
    .eq("week_start_date", weekStart);

  const weekPoints =
    weekStats?.reduce((sum: number, entry: any) => sum + entry.points, 0) || 0;
  const weekWins = weekStats?.length || 0;

  // Rank from leaderboard
  const { data: leaderboard } = await getWeeklyLeaderboard();
  const rank =
    leaderboard?.find((p) => p.playerId === playerId)?.rank ?? null;

  return {
    data: {
      id: player.id,
      firstName: player.first_name,
      lastName: player.last_name,
      preferredName: player.preferred_name,
      displayName: player.preferred_name || player.first_name,
      email: player.email,
      totalPoints: player.total_points,
      totalWins: player.total_wins,
      createdAt: player.created_at,
      thisWeek: {
        points: weekPoints,
        wins: weekWins,
        rank,
      },
    },
  };
}
