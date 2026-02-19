import { useGameState } from "@/hooks/useGameState";
import { Player } from "@/types/courtManager";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Trophy, Medal } from "lucide-react";

interface StatsPlayoffsProps {
  gameState: ReturnType<typeof useGameState>;
}

interface PlayoffSeed {
  seed: number;
  player: Player;
  winPct: number;
}

const StatsPlayoffs = ({ gameState }: StatsPlayoffsProps) => {
  const { state, checkedInPlayers, completedMatches } = gameState;
  const [playoffSeeds, setPlayoffSeeds] = useState<PlayoffSeed[]>([]);

  // Player leaderboard sorted by Win%, then Wins
  const playerStandings = [...state.roster]
    .filter((p) => p.checkedIn)
    .map((p) => ({
      ...p,
      winPct: p.gamesPlayed > 0 ? p.wins / p.gamesPlayed : 0,
    }))
    .sort((a, b) => {
      if (b.winPct !== a.winPct) return b.winPct - a.winPct;
      return b.wins - a.wins;
    });

  const generatePlayoffSeeds = () => {
    // Separate by skill
    const good = playerStandings.filter((p) => p.skillLevel === "good");
    const beginners = playerStandings.filter((p) => p.skillLevel === "beginner");

    // GOOD seeded first by Win%, then BEGINNER by Win%
    const seeded: PlayoffSeed[] = [];
    let seed = 1;
    good.forEach((p) => {
      seeded.push({ seed: seed++, player: p, winPct: p.winPct });
    });
    beginners.forEach((p) => {
      seeded.push({ seed: seed++, player: p, winPct: p.winPct });
    });

    setPlayoffSeeds(seeded);
  };

  const roundRobinComplete = state.matches.length > 0 && state.matches.every((m) => m.status === "completed");

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Session Overview */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="font-display text-xl text-accent mb-4">Session Overview</h3>
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <p className="font-display text-3xl text-foreground">{checkedInPlayers.length}</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Players</p>
          </div>
          <div>
            <p className="font-display text-3xl text-foreground">{completedMatches.length}</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Completed</p>
          </div>
          <div>
            <p className="font-display text-3xl text-foreground">{state.totalScheduledGames}</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Total Games</p>
          </div>
          <div>
            <p className="font-display text-3xl text-foreground">
              {state.matches.filter((m) => m.status === "pending").length}
            </p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Remaining</p>
          </div>
        </div>
      </div>

      {/* Live Leaderboard */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-3">
        <h4 className="font-display text-xl text-accent">Live Leaderboard</h4>
        {playerStandings.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No games played yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 pr-2 text-xs uppercase tracking-widest text-muted-foreground w-8">#</th>
                  <th className="py-2 pr-2 text-xs uppercase tracking-widest text-muted-foreground">Player</th>
                  <th className="py-2 px-2 text-xs uppercase tracking-widest text-muted-foreground text-center">W</th>
                  <th className="py-2 px-2 text-xs uppercase tracking-widest text-muted-foreground text-center">L</th>
                  <th className="py-2 px-2 text-xs uppercase tracking-widest text-muted-foreground text-center">GP</th>
                  <th className="py-2 pl-2 text-xs uppercase tracking-widest text-muted-foreground text-right">Win%</th>
                </tr>
              </thead>
              <tbody>
                {playerStandings.map((p, i) => (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-muted/50">
                    <td className="py-2.5 pr-2">
                      <span className="font-display text-accent">{i + 1}</span>
                    </td>
                    <td className="py-2.5 pr-2">
                      <span className="font-display text-foreground">{p.name}</span>
                    </td>
                    <td className="py-2.5 px-2 text-center text-foreground">{p.wins}</td>
                    <td className="py-2.5 px-2 text-center text-foreground">{p.losses}</td>
                    <td className="py-2.5 px-2 text-center text-muted-foreground">{p.gamesPlayed}</td>
                    <td className="py-2.5 pl-2 text-right">
                      <span className="font-mono text-accent">{(p.winPct * 100).toFixed(0)}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Playoff Seeding */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="font-display text-xl text-accent">Playoff Seeding</h3>
        <p className="text-sm text-muted-foreground">
          GOOD players seeded first by Win%, then BEGINNER players by Win%. Single-elimination bracket with doubles teams.
        </p>
        {roundRobinComplete && (
          <div className="rounded-md border border-accent/30 bg-accent/5 p-3 text-sm text-accent">
            ✦ Round-robin complete! Generate playoff seeds below.
          </div>
        )}
        <Button
          onClick={generatePlayoffSeeds}
          disabled={playerStandings.length < 4}
          className="bg-accent text-accent-foreground hover:bg-accent/80"
        >
          <Trophy className="w-4 h-4 mr-1" /> Generate Playoff Seeds
        </Button>

        {playoffSeeds.length > 0 && (
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {playoffSeeds.map((s) => (
                <div key={s.player.id} className="flex items-center gap-3 rounded-md border border-border bg-muted p-3">
                  <span className="font-display text-2xl text-accent w-8 text-center">{s.seed}</span>
                  <div className="flex-1">
                    <p className="font-display text-foreground">{s.player.name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="uppercase tracking-widest text-accent">{s.player.skillLevel}</span>
                      <span>•</span>
                      <span>{s.player.wins}W - {s.player.losses}L</span>
                      <span>•</span>
                      <span className="font-mono">{(s.winPct * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                  {s.seed <= 3 && (
                    <Medal className={`w-5 h-5 ${s.seed === 1 ? "text-yellow-400" : s.seed === 2 ? "text-gray-300" : "text-amber-600"}`} />
                  )}
                </div>
              ))}
            </div>

            {/* Bracket Preview */}
            {playoffSeeds.length >= 4 && (
              <div className="rounded-lg border border-accent/20 bg-accent/5 p-4 space-y-2">
                <h4 className="font-display text-lg text-accent">Bracket Preview (Doubles)</h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Seeds paired together: 1 & {playoffSeeds.length} vs 2 & {playoffSeeds.length - 1}, etc.
                </p>
                {Array.from({ length: Math.floor(playoffSeeds.length / 4) }, (_, i) => {
                  const s1 = playoffSeeds[i * 2];
                  const s2 = playoffSeeds[playoffSeeds.length - 1 - i * 2];
                  const s3 = playoffSeeds[i * 2 + 1];
                  const s4 = playoffSeeds[playoffSeeds.length - 2 - i * 2];
                  if (!s1 || !s2 || !s3 || !s4) return null;
                  return (
                    <div key={i} className="flex items-center gap-3 text-sm border-l-2 border-accent/30 pl-3 py-1">
                      <span className="text-accent font-display">R1-{i + 1}:</span>
                      <span className="text-foreground">
                        #{s1.seed} {s1.player.name} & #{s2.seed} {s2.player.name}
                      </span>
                      <span className="text-muted-foreground">vs</span>
                      <span className="text-foreground">
                        #{s3.seed} {s3.player.name} & #{s4.seed} {s4.player.name}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsPlayoffs;
