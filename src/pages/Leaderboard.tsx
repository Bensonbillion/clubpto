import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import Layout from "@/components/Layout";
import { getWeeklyLeaderboard, getWeekStartDate, type LeaderboardEntry } from "@/lib/leaderboard";

function WeekSelector({ selected, onChange }: { selected: string; onChange: (w: string) => void }) {
  // Generate last 8 weeks of Mondays
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
    const fmt = (dt: Date) =>
      dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    return `${fmt(d)} - ${fmt(end)}`;
  };

  return (
    <select
      value={selected}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-[#0A3A2A]/20 bg-white px-4 py-2 text-sm font-medium text-[#0A3A2A] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0A3A2A]/30"
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
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-yellow-500 text-sm font-bold text-yellow-900 shadow">
        1
      </span>
    );
  if (rank === 2)
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-gray-200 to-gray-400 text-sm font-bold text-gray-700 shadow">
        2
      </span>
    );
  if (rank === 3)
    return (
      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-orange-300 to-orange-500 text-sm font-bold text-orange-900 shadow">
        3
      </span>
    );
  return <span className="inline-flex h-8 w-8 items-center justify-center text-sm font-semibold text-[#0A3A2A]/60">{rank}</span>;
}

const Leaderboard = () => {
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
    <Layout>
      <section className="py-12 md:py-20">
        <div className="mx-auto max-w-3xl px-4">
          {/* Header */}
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold text-[#0A3A2A] md:text-4xl">
                Leaderboard
              </h1>
              <p className="mt-1 text-sm text-[#0A3A2A]/60">Weekly rankings</p>
            </div>
            <WeekSelector selected={selectedWeek} onChange={setSelectedWeek} />
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0A3A2A]/20 border-t-[#0A3A2A]" />
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="rounded-xl border border-[#0A3A2A]/10 bg-[#FAF8F3] py-16 text-center">
              <p className="text-lg font-medium text-[#0A3A2A]/50">No results this week</p>
              <p className="mt-1 text-sm text-[#0A3A2A]/40">Points will show up after matches are played.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[#0A3A2A]/10 shadow-sm">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-[#0A3A2A] text-[#FAF8F3]">
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider sm:px-6">
                      Rank
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider sm:px-6">
                      Player
                    </th>
                    <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider sm:px-6">
                      Points
                    </th>
                    <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider sm:px-6">
                      Wins
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry, i) => (
                    <tr
                      key={entry.playerId}
                      className={`border-b border-[#0A3A2A]/5 transition-colors hover:bg-[#FAF8F3] ${
                        i === 0 ? "bg-[#F4D03F]/5" : "bg-white"
                      }`}
                    >
                      <td className="px-4 py-3.5 sm:px-6">
                        <RankBadge rank={entry.rank} />
                      </td>
                      <td className="px-4 py-3.5 font-medium sm:px-6">
                        <Link
                          to={`/profile/${entry.playerId}`}
                          className="text-[#0A3A2A] underline-offset-2 hover:underline"
                        >
                          {entry.playerName}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 text-right sm:px-6">
                        <span className="font-semibold text-[#0A3A2A]">{entry.points}</span>
                      </td>
                      <td className="px-4 py-3.5 text-right text-[#0A3A2A]/60 sm:px-6">
                        {entry.wins}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
};

export default Leaderboard;
