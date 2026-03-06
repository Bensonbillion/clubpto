import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { query } from "@/lib/turso";
import { Lock, Archive, Trash2, Check, AlertTriangle, Download, ChevronDown, ChevronUp } from "lucide-react";
import type { GameState, Match, Pair, SkillTier } from "@/types/courtManager";
import { getHeadToHead } from "@/hooks/useGameState";

const PASSCODE = "9999";

// ── Build standings from matches (same logic as StatsPlayoffs) ──
function buildStandings(matches: Match[], tier?: SkillTier) {
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

const SeasonReset = () => {
  const [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(false);

  // Current state
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [pointsLedger, setPointsLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Flow state
  const [step, setStep] = useState<"preview" | "archiving" | "resetting" | "done">("preview");
  const [sessionLabel, setSessionLabel] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  // ── Passcode ────────────────────────────────────────────
  const handleDigit = (d: string) => {
    const next = code + d;
    setCodeError(false);
    if (next.length === 4) {
      if (next === PASSCODE) setUnlocked(true);
      else { setCodeError(true); setCode(""); }
    } else setCode(next);
  };

  // ── Load current data ──────────────────────────────────
  useEffect(() => {
    if (!unlocked) return;
    (async () => {
      try {
        // Load game state from Supabase
        const { data } = await supabase
          .from("game_state")
          .select("state")
          .eq("id", "current")
          .single();
        if (data?.state) setGameState(data.state as unknown as GameState);

        // Load points ledger from Turso
        const ledgerResult = await query(
          `SELECT pl.player_id, pl.points, pl.reason, pl.week_start_date, pl.earned_at,
                  COALESCE(p.preferred_name, p.first_name) as player_name
           FROM points_ledger pl
           JOIN players p ON p.id = pl.player_id
           ORDER BY pl.earned_at DESC`,
        );
        setPointsLedger(ledgerResult.rows || []);

        // Default label
        setSessionLabel(new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }));
      } catch (err: any) {
        console.error("Failed to load data:", err);
        setError("Failed to load current session data: " + err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [unlocked]);

  // ── Archive & Reset ────────────────────────────────────
  const addLog = (msg: string) => setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()} — ${msg}`]);

  const doArchiveAndReset = async () => {
    if (!gameState) return;
    setStep("archiving");
    setError("");

    try {
      // 1. Build standings
      addLog("Building session standings...");
      const standingsA = buildStandings(gameState.matches, "A");
      const standingsB = buildStandings(gameState.matches, "B");
      const standingsC = buildStandings(gameState.matches, "C");
      const allStandings = { A: standingsA, B: standingsB, C: standingsC };

      // 2. Build points snapshot
      addLog("Snapshotting points ledger (" + pointsLedger.length + " entries)...");
      const pointsSnapshot = pointsLedger.map((r: any) => ({
        playerId: r.player_id,
        playerName: r.player_name,
        points: r.points,
        reason: r.reason,
        weekStart: r.week_start_date,
        earnedAt: r.earned_at,
      }));

      // 3. Ensure session_archives table exists in Turso
      addLog("Ensuring archive table exists...");
      await query(`CREATE TABLE IF NOT EXISTS session_archives (
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
      )`);

      // 4. Archive to Turso
      addLog("Saving session archive...");
      const sessionDate = gameState.sessionConfig.sessionStartedAt
        ? new Date(gameState.sessionConfig.sessionStartedAt).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0];

      await query(
        `INSERT INTO session_archives (session_date, session_label, roster, pairs, matches, standings, playoff_bracket, game_history, court_count, duration_minutes, dynamic_mode, points_awarded, archived_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          sessionDate,
          sessionLabel || null,
          JSON.stringify(gameState.roster),
          JSON.stringify(gameState.pairs),
          JSON.stringify(gameState.matches),
          JSON.stringify(allStandings),
          JSON.stringify(gameState.playoffMatches || []),
          JSON.stringify(gameState.gameHistory || []),
          gameState.sessionConfig.courtCount || 2,
          gameState.sessionConfig.durationMinutes || 85,
          gameState.sessionConfig.dynamicMode ? 1 : 0,
          JSON.stringify(pointsSnapshot),
          "admin",
        ]
      );
      addLog("Session archived successfully.");

      // 4. Reset leaderboard
      setStep("resetting");
      addLog("Resetting player points and wins...");
      await query("UPDATE players SET total_points = 0, total_wins = 0 WHERE total_points > 0 OR total_wins > 0");
      addLog("Player totals reset to 0.");

      addLog("Clearing points ledger...");
      await query("DELETE FROM points_ledger WHERE 1=1");
      addLog("Points ledger cleared.");

      // 5. Reset game state
      addLog("Resetting game state...");
      const freshState = {
        sessionConfig: {
          startTime: "20:00",
          durationMinutes: 85,
          checkInLocked: false,
          checkInClosed: false,
          courtCount: gameState.sessionConfig.courtCount || 2,
        },
        roster: [],
        pairs: [],
        matches: [],
        gameHistory: [],
        sessionStarted: false,
        playoffsStarted: false,
        totalScheduledGames: 0,
        playoffMatches: [],
        fixedPairs: [],
        waitlistedPlayers: [],
        oddPlayerDecisions: [],
        pairsLocked: false,
        newlyAddedPairIds: [],
        pairGamesWatched: {},
      };
      const { error: resetErr } = await supabase
        .from("game_state")
        .upsert({ id: "current", state: freshState, updated_at: new Date().toISOString() });

      if (resetErr) throw new Error("Game state reset failed: " + resetErr.message);
      addLog("Game state reset.");

      // 6. Refresh materialized view
      addLog("Refreshing leaderboard view...");
      try {
        await (supabase.rpc as any)("refresh_weekly_leaderboard");
        addLog("Leaderboard view refreshed.");
      } catch {
        addLog("Note: Materialized view refresh skipped (may need manual refresh).");
      }

      addLog("All done! Session archived and leaderboard wiped.");
      setStep("done");
    } catch (err: any) {
      setError(err.message);
      addLog("ERROR: " + err.message);
    }
  };

  // ── Export archive as JSON (backup) ────────────────────
  const exportBackup = () => {
    if (!gameState) return;
    const data = {
      exportedAt: new Date().toISOString(),
      sessionLabel,
      gameState,
      pointsLedger: pointsLedger.map((r: any) => ({ ...r })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pto-session-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Passcode screen ────────────────────────────────────
  if (!unlocked) {
    return (
      <div className="min-h-screen bg-[#1A1A1A] flex flex-col items-center justify-center">
        <Lock className="w-10 h-10 text-[#C9A84C] mb-4" />
        <h2 className="font-serif text-2xl text-[#C9A84C] mb-2">Season Reset</h2>
        <p className="text-[#A8A29E] text-sm mb-6">Enter admin passcode</p>
        <div className="flex gap-3 mb-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`w-4 h-4 rounded-full border-2 transition-all ${i < code.length ? "bg-[#C9A84C] border-[#C9A84C]" : "border-[#A8A29E]/40"} ${codeError ? "border-red-500 bg-red-500/30" : ""}`} />
          ))}
        </div>
        {codeError && <p className="text-red-400 text-sm mb-3">Incorrect</p>}
        <div className="grid grid-cols-3 gap-3 max-w-[240px]">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", ""].map((d, i) =>
            d === "" ? <div key={i} /> : (
              <button key={d} onClick={() => handleDigit(d)} className="w-16 h-16 rounded-lg border border-[#2D2D2D] bg-[#2D2D2D] text-[#F5F0EB] text-xl hover:border-[#C9A84C]/40 transition-all active:scale-95">{d}</button>
            ),
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center">
        <p className="text-[#A8A29E] animate-pulse">Loading session data...</p>
      </div>
    );
  }

  // ── Summary stats ──────────────────────────────────────
  const completedMatches = gameState?.matches.filter((m) => m.status === "completed").length || 0;
  const totalPlayers = gameState?.roster.filter((p) => p.checkedIn).length || 0;
  const totalPairs = gameState?.pairs.length || 0;
  const totalPoints = pointsLedger.reduce((sum: number, r: any) => sum + Number(r.points), 0);
  const uniquePointPlayers = new Set(pointsLedger.map((r: any) => r.player_id)).size;

  return (
    <div className="min-h-screen bg-[#1A1A1A] text-[#F5F0EB]">
      <header className="border-b border-[#2D2D2D] px-4 md:px-6 py-4">
        <h1 className="font-serif text-2xl text-[#C9A84C]">Archive Session & Reset Leaderboard</h1>
        <p className="text-xs text-[#A8A29E] mt-1">
          Save the current session results, then wipe the leaderboard for a fresh start
        </p>
      </header>

      <main className="max-w-2xl mx-auto px-4 md:px-6 py-6 space-y-6">
        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-sm text-red-400 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Current session summary */}
        <div className="rounded-lg border border-[#2D2D2D] p-5 space-y-4">
          <h2 className="font-serif text-lg">Current Session</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            <StatBox label="Players" value={totalPlayers} />
            <StatBox label="Pairs" value={totalPairs} />
            <StatBox label="Matches" value={completedMatches} />
            <StatBox label="Points Awarded" value={totalPoints} sub={`${uniquePointPlayers} players`} />
          </div>

          {/* Preview toggle */}
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2 text-xs text-[#A8A29E] hover:text-[#C9A84C] transition-colors"
          >
            {showPreview ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showPreview ? "Hide" : "Preview"} what gets archived
          </button>

          {showPreview && gameState && (
            <div className="space-y-3 text-xs">
              {(["A", "B", "C"] as SkillTier[]).map((tier) => {
                const standings = buildStandings(gameState.matches, tier);
                if (standings.length === 0) return null;
                return (
                  <div key={tier}>
                    <p className="font-medium text-[#C9A84C] mb-1">Tier {tier} Standings</p>
                    {standings.map((s, i) => (
                      <div key={s.pair.id} className="flex justify-between py-0.5 text-[#A8A29E]">
                        <span>#{i + 1} {s.player1Name} & {s.player2Name}</span>
                        <span>{s.wins}W-{s.losses}L ({(s.winPct * 100).toFixed(0)}%)</span>
                      </div>
                    ))}
                  </div>
                );
              })}
              {(gameState.playoffMatches || []).length > 0 && (
                <div>
                  <p className="font-medium text-[#C9A84C] mb-1">Playoff Bracket ({gameState.playoffMatches.length} matches)</p>
                  <p className="text-[#A8A29E]">Will be saved in full.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Session label */}
        {step === "preview" && (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-[#A8A29E] block mb-1">Session Label (optional)</label>
              <input
                type="text"
                value={sessionLabel}
                onChange={(e) => setSessionLabel(e.target.value)}
                placeholder="e.g. Week 1, March 5 Session"
                className="w-full bg-[#2D2D2D] border border-[#2D2D2D] rounded px-3 py-2 text-sm text-[#F5F0EB] outline-none focus:border-[#C9A84C]/50"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={exportBackup}
                className="flex-1 flex items-center justify-center gap-2 py-3 border border-[#2D2D2D] text-[#A8A29E] rounded hover:border-[#C9A84C]/40 hover:text-[#C9A84C] transition-colors text-sm"
              >
                <Download className="w-4 h-4" />
                Download Backup JSON
              </button>
            </div>

            <div className="p-4 rounded-lg border border-red-500/20 bg-red-500/5 space-y-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-400">This will:</p>
                  <ul className="text-xs text-[#A8A29E] mt-1 space-y-1 list-disc list-inside">
                    <li>Save the current session (matches, standings, points) to the archive</li>
                    <li>Reset ALL player points and wins to 0</li>
                    <li>Clear the entire points ledger</li>
                    <li>Reset the court manager to a fresh state</li>
                  </ul>
                </div>
              </div>

              <button
                onClick={doArchiveAndReset}
                className="w-full py-3 bg-red-500/20 border border-red-500/40 text-red-400 rounded font-medium hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2"
              >
                <Archive className="w-4 h-4" />
                Archive Session & Reset Everything
              </button>
            </div>
          </div>
        )}

        {/* Progress log */}
        {step !== "preview" && (
          <div className="rounded-lg border border-[#2D2D2D] p-4 space-y-3">
            <h3 className="font-serif text-sm text-[#C9A84C]">
              {step === "done" ? "Complete" : "In Progress..."}
            </h3>
            <div className="space-y-1 font-mono text-xs">
              {logs.map((log, i) => (
                <div key={i} className={`flex items-start gap-2 ${log.includes("ERROR") ? "text-red-400" : log.includes("done") ? "text-green-400" : "text-[#A8A29E]"}`}>
                  {log.includes("ERROR") ? (
                    <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  ) : log.includes("done") || log.includes("successfully") || log.includes("cleared") || log.includes("reset") || log.includes("refreshed") ? (
                    <Check className="w-3 h-3 mt-0.5 shrink-0 text-green-400" />
                  ) : (
                    <span className="w-3 text-center shrink-0">-</span>
                  )}
                  <span>{log}</span>
                </div>
              ))}
            </div>

            {step === "done" && (
              <div className="pt-3 border-t border-[#2D2D2D] space-y-2">
                <p className="text-sm text-green-400 flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Session archived and leaderboard reset. Ready for a fresh start.
                </p>
                <a
                  href="/manage"
                  className="block text-center py-2 border border-[#C9A84C] text-[#C9A84C] rounded text-sm hover:bg-[#C9A84C] hover:text-[#1A1A1A] transition-colors"
                >
                  Go to Court Manager
                </a>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

const StatBox = ({ label, value, sub }: { label: string; value: number; sub?: string }) => (
  <div className="p-3 rounded bg-[#2D2D2D]/50 border border-[#2D2D2D]">
    <div className="text-xl font-mono font-bold text-[#F5F0EB]">{value}</div>
    <div className="text-[10px] text-[#A8A29E] uppercase tracking-wider">{label}</div>
    {sub && <div className="text-[10px] text-[#A8A29E]/60 mt-0.5">{sub}</div>}
  </div>
);

export default SeasonReset;
