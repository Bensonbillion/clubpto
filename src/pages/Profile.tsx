import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { getPlayerProfile, type PlayerProfile as PlayerProfileType } from "@/lib/leaderboard";

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
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-bold text-foreground">{value}</span>
        <span className="text-sm text-muted-foreground">pts</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      {rank != null && (
        <p className="mt-2 inline-block rounded-full bg-accent/20 px-3 py-0.5 text-xs font-semibold text-accent">
          Rank #{rank}
        </p>
      )}
    </div>
  );
}

const Profile = () => {
  const { playerId } = useParams<{ playerId: string }>();
  const [profile, setProfile] = useState<PlayerProfileType | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!playerId) return;
    const { data } = await getPlayerProfile(playerId);
    if (data) setProfile(data);
    setLoading(false);
  }, [playerId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-32">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-accent" />
        </div>
      </Layout>
    );
  }

  if (!profile) {
    return (
      <Layout>
        <div className="py-20 text-center">
          <p className="text-lg text-muted-foreground">Player not found</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <section className="py-12 md:py-20">
        <div className="mx-auto max-w-2xl px-4">
          {/* Profile Header */}
          <div className="mb-8 rounded-xl border border-border bg-card p-6 shadow-sm">
            <h1 className="font-display text-2xl font-bold text-foreground md:text-3xl">
              {profile.displayName}
            </h1>
            {profile.preferredName && (
              <p className="mt-1 text-sm text-muted-foreground">
                {profile.firstName} {profile.lastName}
              </p>
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
        </div>
      </section>
    </Layout>
  );
};

export default Profile;
