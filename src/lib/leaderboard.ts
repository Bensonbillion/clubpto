import { query } from "@/lib/turso";

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

  try {
    // Insert into points_ledger
    await query(
      'INSERT INTO points_ledger (player_id, points, reason, match_id, week_start_date) VALUES (?, ?, ?, ?, ?)',
      [playerId, points, reason, matchId ?? null, weekStart]
    );

    // Update player totals
    await query(
      'UPDATE players SET total_points = total_points + ?, total_wins = total_wins + 1 WHERE id = ?',
      [points, playerId]
    );

    return { success: true };
  } catch (err: any) {
    console.error("Failed to award points:", err);
    return { success: false, error: err.message };
  }
}

// ── Function 2: Get Weekly Leaderboard ────────────────────

export async function getWeeklyLeaderboard(
  weekStartDate?: Date,
): Promise<{ data?: LeaderboardEntry[]; error?: string }> {
  const weekStart = weekStartDate
    ? getWeekStartDate(weekStartDate)
    : getWeekStartDate(new Date());

  try {
    const result = await query(`
      SELECT
        p.id as player_id,
        COALESCE(p.preferred_name, p.first_name) as player_name,
        SUM(pl.points) as points,
        COUNT(*) as wins
      FROM players p
      JOIN points_ledger pl ON p.id = pl.player_id
      WHERE pl.week_start_date = ?
      GROUP BY p.id
      ORDER BY points DESC
    `, [weekStart]);

    const data: LeaderboardEntry[] = result.rows.map((row: any, i: number) => ({
      playerId: row.player_id,
      playerName: row.player_name,
      points: Number(row.points),
      wins: Number(row.wins),
      rank: i + 1,
    }));

    return { data };
  } catch (err: any) {
    return { error: err.message };
  }
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
  try {
    const result = await query(
      'SELECT id, first_name, preferred_name, total_points, total_wins FROM players WHERE total_points > 0 AND is_deleted = 0 ORDER BY total_points DESC'
    );

    return {
      data: result.rows.map((p: any, i: number) => ({
        playerId: p.id,
        playerName: p.preferred_name || p.first_name,
        points: Number(p.total_points),
        wins: Number(p.total_wins),
        rank: i + 1,
      })),
    };
  } catch (err: any) {
    return { error: err.message };
  }
}

// ── Function 4: Get Player Profile with Stats ─────────────

export async function getPlayerProfile(
  playerId: string,
): Promise<{ data?: PlayerProfile; error?: string }> {
  try {
    const playerResult = await query(
      'SELECT * FROM players WHERE id = ?',
      [playerId]
    );

    if (playerResult.rows.length === 0) return { error: "Player not found" };
    const player: any = playerResult.rows[0];

    // Current week stats
    const weekStart = getWeekStartDate(new Date());
    const weekResult = await query(
      'SELECT points, reason FROM points_ledger WHERE player_id = ? AND week_start_date = ?',
      [playerId, weekStart]
    );

    const weekPoints = weekResult.rows.reduce((sum: number, entry: any) => sum + Number(entry.points), 0);
    const weekWins = weekResult.rows.length;

    // Rank from leaderboard
    const { data: leaderboard } = await getWeeklyLeaderboard();
    const rank = leaderboard?.find((p) => p.playerId === playerId)?.rank ?? null;

    return {
      data: {
        id: player.id,
        firstName: player.first_name,
        lastName: player.last_name,
        preferredName: player.preferred_name,
        displayName: player.preferred_name || player.first_name,
        email: player.email || "",
        totalPoints: Number(player.total_points),
        totalWins: Number(player.total_wins),
        createdAt: player.created_at,
        thisWeek: {
          points: weekPoints,
          wins: weekWins,
          rank,
        },
      },
    };
  } catch (err: any) {
    return { error: err.message };
  }
}
