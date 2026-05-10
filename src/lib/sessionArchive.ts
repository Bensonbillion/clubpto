import { query } from "@/lib/turso";
import { getHeadToHead } from "@/hooks/useGameState";
import type { GameState, Match, Pair, SkillTier } from "@/types/courtManager";

/** Build standings from completed matches, optionally filtered by tier */
export function buildStandings(matches: Match[], tier?: SkillTier) {
  const pairMap = new Map<string, {
    pair: Pair; player1Name: string; player2Name: string;
    wins: number; losses: number; gamesPlayed: number; winPct: number; skillLevel: SkillTier;
  }>();

  for (const m of matches) {
    if (m.status !== "completed" || !m.winner || !m.loser) continue;
    const process = (pair: Pair, won: boolean) => {
      if (tier && pair.skillLevel !== tier) return;
      const key = [pair.player1.id, pair.player2.id].sort().join("|||");
      if (!pairMap.has(key)) {
        pairMap.set(key, {
          pair, player1Name: pair.player1.name, player2Name: pair.player2.name,
          wins: 0, losses: 0, gamesPlayed: 0, winPct: 0, skillLevel: pair.skillLevel,
        });
      }
      const s = pairMap.get(key)!;
      s.gamesPlayed++;
      if (won) s.wins++; else s.losses++;
      s.winPct = s.gamesPlayed > 0 ? s.wins / s.gamesPlayed : 0;
    };
    process(m.winner, true);
    process(m.loser, false);
  }

  return Array.from(pairMap.values()).sort((a, b) => {
    if (b.winPct !== a.winPct) return b.winPct - a.winPct;
    const h2h = getHeadToHead(a.pair.id, b.pair.id, matches);
    if (h2h !== 0) return -h2h;
    if (b.gamesPlayed !== a.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;
    return b.wins - a.wins;
  });
}

const ENSURE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS session_archives (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  session_date TEXT NOT NULL,
  session_label TEXT,
  roster TEXT NOT NULL DEFAULT '[]',
  pairs TEXT NOT NULL DEFAULT '[]',
  matches TEXT NOT NULL DEFAULT '[]',
  standings TEXT NOT NULL DEFAULT '[]',
  playoff_bracket TEXT NOT NULL DEFAULT '[]',
  game_history TEXT NOT NULL DEFAULT '[]',
  court_count INTEGER NOT NULL DEFAULT 2,
  duration_minutes INTEGER NOT NULL DEFAULT 85,
  dynamic_mode INTEGER NOT NULL DEFAULT 0,
  points_awarded TEXT NOT NULL DEFAULT '[]',
  archived_at TEXT NOT NULL DEFAULT (datetime('now')),
  archived_by TEXT
)`;

/**
 * Archive the current game state to the session_archives table.
 * Returns the new archive row ID.
 */
export async function archiveSession(
  gameState: GameState,
  options?: { label?: string; pointsSnapshot?: any[] }
): Promise<{ id: string }> {
  const standingsA = buildStandings(gameState.matches, "A");
  const standingsB = buildStandings(gameState.matches, "B");
  const standingsC = buildStandings(gameState.matches, "C");
  const allStandings = { A: standingsA, B: standingsB, C: standingsC };

  await query(ENSURE_TABLE_SQL);

  const sessionDate = gameState.sessionConfig.sessionStartedAt
    ? new Date(gameState.sessionConfig.sessionStartedAt).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  const result = await query(
    `INSERT INTO session_archives (session_date, session_label, roster, pairs, matches, standings, playoff_bracket, game_history, court_count, duration_minutes, dynamic_mode, points_awarded, archived_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING id`,
    [
      sessionDate,
      options?.label || null,
      JSON.stringify(gameState.roster),
      JSON.stringify(gameState.pairs),
      JSON.stringify(gameState.matches),
      JSON.stringify(allStandings),
      JSON.stringify(gameState.playoffMatches || []),
      JSON.stringify(gameState.gameHistory || []),
      gameState.sessionConfig.courtCount || 2,
      gameState.sessionConfig.durationMinutes || 85,
      gameState.sessionConfig.dynamicMode ? 1 : 0,
      JSON.stringify(options?.pointsSnapshot || []),
      "admin",
    ]
  );

  const id = result.rows?.[0]?.id || "";
  return { id };
}
