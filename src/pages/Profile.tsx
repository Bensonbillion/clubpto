import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";
import { getPlayerProfile, type PlayerProfile as PlayerProfileType } from "@/lib/leaderboard";

function formatReason(reason: string): string {
  const map: Record<string, string> = {
    regular_win: "Regular Win",
    playoff_win: "Playoff Win",
    tournament_win: "Tournament Win",
  };
  return map[reason] || reason;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StatCard({
  label,
  value,
  subtitle,
  rank,
}: {
  label: string;
  value: number;
  subtitle: string;
  rank?: number | null;
}) {
  return (
    <div className="rounded-xl border border-[#0A3A2A]/10 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-[#0A3A2A]/50">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-bold text-[#0A3A2A]">{value}</span>
        <span className="text-sm text-[#0A3A2A]/50">pts</span>
      </div>
      <p className="mt-1 text-sm text-[#0A3A2A]/60">{subtitle}</p>
      {rank != null && (
        <p className="mt-2 inline-block rounded-full bg-[#F4D03F]/20 px-3 py-0.5 text-xs font-semibold text-[#0A3A2A]">
          Rank #{rank}
        </p>
      )}
    </div>
  );
}

interface PointsEntry {
  id: string;
  points: number;
  reason: string;
  earned_at: string;
}

function PointsHistory({ playerId }: { playerId: string }) {
  const [history, setHistory] = useState<PointsEntry[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("points_ledger")
        .select("id, points, reason, earned_at")
        .eq("player_id", playerId)
        .order("earned_at", { ascending: false })
        .limit(10);
      setHistory((data as PointsEntry[]) || []);
    })();
  }, [playerId]);

  if (history.length === 0) {
    return (
      <div className="rounded-xl border border-[#0A3A2A]/10 bg-[#FAF8F3] py-8 text-center">
        <p className="text-sm text-[#0A3A2A]/50">No points earned yet</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[#0A3A2A]/5 overflow-hidden rounded-xl border border-[#0A3A2A]/10 bg-white">
      {history.map((entry) => (
        <li key={entry.id} className="flex items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 min-w-[2rem] items-center justify-center rounded-full bg-[#0A3A2A]/5 text-sm font-bold text-[#0A3A2A]">
              +{entry.points}
            </span>
            <span className="text-sm font-medium text-[#0A3A2A]">{formatReason(entry.reason)}</span>
          </div>
          <span className="text-xs text-[#0A3A2A]/40">{formatDate(entry.earned_at)}</span>
        </li>
      ))}
    </ul>
  );
}

const Profile = () => {
  const { playerId } = useParams<{ playerId: string }>();
  const [profile, setProfile] = useState<PlayerProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ first_name: "", last_name: "", preferred_name: "" });

  const fetchProfile = useCallback(async () => {
    if (!playerId) return;
    const { data } = await getPlayerProfile(playerId);
    if (data) {
      setProfile(data);
      setEditForm({
        first_name: data.firstName,
        last_name: data.lastName,
        preferred_name: data.preferredName || "",
      });
    }
    setLoading(false);
  }, [playerId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSave = async () => {
    if (!playerId) return;
    await supabase
      .from("players")
      .update({
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        preferred_name: editForm.preferred_name || null,
      })
      .eq("id", playerId);
    setIsEditing(false);
    fetchProfile();
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-32">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0A3A2A]/20 border-t-[#0A3A2A]" />
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <div className="py-20 text-center">
          <p className="text-lg text-[#0A3A2A]/50">Player not found</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="py-12 md:py-20">
        <div className="mx-auto max-w-2xl px-4">
          {/* Profile Header */}
          <div className="mb-8 rounded-xl border border-[#0A3A2A]/10 bg-white p-6 shadow-sm">
            {isEditing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[#0A3A2A]/50">
                      First Name
                    </label>
                    <input
                      value={editForm.first_name}
                      onChange={(e) => setEditForm((f) => ({ ...f, first_name: e.target.value }))}
                      className="w-full rounded-lg border border-[#0A3A2A]/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A3A2A]/30"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[#0A3A2A]/50">
                      Last Name
                    </label>
                    <input
                      value={editForm.last_name}
                      onChange={(e) => setEditForm((f) => ({ ...f, last_name: e.target.value }))}
                      className="w-full rounded-lg border border-[#0A3A2A]/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A3A2A]/30"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-[#0A3A2A]/50">
                    Preferred Name (optional)
                  </label>
                  <input
                    value={editForm.preferred_name}
                    onChange={(e) => setEditForm((f) => ({ ...f, preferred_name: e.target.value }))}
                    placeholder="Display name"
                    className="w-full rounded-lg border border-[#0A3A2A]/20 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0A3A2A]/30"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleSave}
                    className="rounded-lg bg-[#0A3A2A] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0A3A2A]/90"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setIsEditing(false)}
                    className="rounded-lg border border-[#0A3A2A]/20 px-5 py-2 text-sm font-medium text-[#0A3A2A] transition-colors hover:bg-[#FAF8F3]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="font-display text-2xl font-bold text-[#0A3A2A] md:text-3xl">
                    {profile.displayName}
                  </h1>
                  {profile.preferredName && (
                    <p className="mt-1 text-sm text-[#0A3A2A]/50">
                      {profile.firstName} {profile.lastName}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setIsEditing(true)}
                  className="rounded-lg border border-[#0A3A2A]/20 px-4 py-2 text-sm font-medium text-[#0A3A2A] transition-colors hover:bg-[#FAF8F3]"
                >
                  Edit
                </button>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="mb-8 grid grid-cols-2 gap-4">
            <StatCard
              label="This Week"
              value={profile.thisWeek.points}
              subtitle={`${profile.thisWeek.wins} wins`}
              rank={profile.thisWeek.rank}
            />
            <StatCard
              label="All Time"
              value={profile.totalPoints}
              subtitle={`${profile.totalWins} wins`}
            />
          </div>

          {/* Recent Points */}
          <div>
            <h2 className="mb-4 font-display text-xl font-bold text-[#0A3A2A]">Recent Points</h2>
            <PointsHistory playerId={playerId!} />
          </div>
        </div>
      </section>
    </Layout>
  );
};

export default Profile;
