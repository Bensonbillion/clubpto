import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { getWeeklyLeaderboard, getWeekStartDate, type LeaderboardEntry } from "@/lib/leaderboard";

function WeekSelector({ selected, onChange }: { selected: string; onChange: (w: string) => void }) {
  const weeks: string[] = [];
  const now = new Date();
  for (let i = 0; i < 8; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    weeks.push(getWeekStartDate(d));
  }

  const formatWeekLabel = (weekStart: string) => {
    const d = new Date(weekStart + "T00:00:00");
    const end = new Date(d);
    end.setDate(end.getDate() + 6);
    const fmt = (dt: Date) => dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${fmt(d)} - ${fmt(end)}`;
  };

  return (
    <select
      value={selected}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
    >
      {weeks.map((w) => (
        <option key={w} value={w}>
          {w === weeks[0] ? `This Week (${formatWeekLabel(w)})` : formatWeekLabel(w)}
        </option>
      ))}
    </select>
  );
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-yellow-500/20 text-sm font-bold text-yellow-400">1</span>;
  if (rank === 2)
    return <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-400/20 text-sm font-bold text-gray-300">2</span>;
  if (rank === 3)
    return <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-orange-500/20 text-sm font-bold text-orange-400">3</span>;
  return <span className="inline-flex h-7 w-7 items-center justify-center text-sm font-semibold text-muted-foreground">{rank}</span>;
}

const LeaderboardTab = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [selectedWeek, setSelectedWeek] = useState(getWeekStartDate(new Date()));
  const [loading, setLoading] = useState(true);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    const { data } = await getWeeklyLeaderboard(new Date(selectedWeek + "T00:00:00"));
    setLeaderboard(data || []);
    setLoading(false);
  }, [selectedWeek]);

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 30000);
    return () => clearInterval(interval);
  }, [fetchLeaderboard]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-2xl text-accent">Leaderboard</h2>
          <p className="text-sm text-muted-foreground mt-1">Weekly rankings — auto-refreshes every 30s</p>
        </div>
        <WeekSelector selected={selectedWeek} onChange={setSelectedWeek} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-muted-foreground text-base animate-pulse">Loading leaderboard...</div>
        </div>
      ) : leaderboard.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-14 text-center">
          <p className="text-base text-muted-foreground">No results this week</p>
          <p className="mt-1 text-sm text-muted-foreground/60">Points appear after matches are completed.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-card border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rank</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Player</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Points</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground">Wins</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry, i) => (
                <tr
                  key={entry.playerId}
                  className={`border-b border-border/50 transition-colors hover:bg-muted/20 ${
                    i === 0 ? "bg-accent/5" : ""
                  }`}
                >
                  <td className="px-4 py-3">
                    <RankBadge rank={entry.rank} />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/profile/${entry.playerId}`}
                      className="font-medium text-foreground hover:text-accent transition-colors underline-offset-2 hover:underline"
                    >
                      {entry.playerName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-semibold text-accent">{entry.points}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{entry.wins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LeaderboardTab;
