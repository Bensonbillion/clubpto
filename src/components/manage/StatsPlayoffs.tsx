import { useGameState } from "@/hooks/useGameState";
import { Pair } from "@/types/courtManager";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Trophy, Medal } from "lucide-react";

interface StatsPlayoffsProps {
  gameState: ReturnType<typeof useGameState>;
}

const StatsPlayoffs = ({ gameState }: StatsPlayoffsProps) => {
  const { state, checkedInPlayers, completedMatches } = gameState;
  const [playoffBracket, setPlayoffBracket] = useState<Pair[]>([]);

  const beginnerPairs = [...state.pairs.filter((p) => p.skillLevel === "beginner")].sort((a, b) => b.wins - a.wins);
  const goodPairs = [...state.pairs.filter((p) => p.skillLevel === "good")].sort((a, b) => b.wins - a.wins);

  const generatePlayoffs = () => {
    const topBeginners = beginnerPairs.slice(0, 2);
    const remainingSpots = 8 - topBeginners.length;
    const topGood = goodPairs.slice(0, remainingSpots);
    setPlayoffBracket([...topBeginners, ...topGood]);
  };

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Session Overview */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h3 className="font-display text-xl text-accent mb-4">Session Overview</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="font-display text-3xl text-foreground">{checkedInPlayers.length}</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Players</p>
          </div>
          <div>
            <p className="font-display text-3xl text-foreground">{completedMatches.length}</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Games Played</p>
          </div>
          <div>
            <p className="font-display text-3xl text-foreground">{state.pairs.length}</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Active Pairs</p>
          </div>
        </div>
      </div>

      {/* Leaderboards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <LeaderboardCard title="Top Pairs — Beginners" pairs={beginnerPairs} />
        <LeaderboardCard title="Top Pairs — Good" pairs={goodPairs} />
      </div>

      {/* Playoffs */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="font-display text-xl text-accent">Playoff Qualification</h3>
        <p className="text-sm text-muted-foreground">
          Top 2 beginner pairs + remaining spots filled by good players (prioritized regardless of record).
        </p>
        <Button onClick={generatePlayoffs} disabled={state.pairs.length < 2} className="bg-accent text-accent-foreground hover:bg-accent/80">
          <Trophy className="w-4 h-4 mr-1" /> Generate Playoff Bracket
        </Button>

        {playoffBracket.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            {playoffBracket.map((pair, i) => (
              <div key={pair.id} className="flex items-center gap-3 rounded-md border border-border bg-muted p-3">
                <span className="font-display text-2xl text-accent w-8 text-center">{i + 1}</span>
                <div className="flex-1">
                  <p className="font-display text-foreground">{pair.player1.name} & {pair.player2.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="uppercase tracking-widest text-accent">{pair.skillLevel}</span>
                    <span>•</span>
                    <span>{pair.wins}W - {pair.losses}L</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const LeaderboardCard = ({ title, pairs }: { title: string; pairs: Pair[] }) => (
  <div className="rounded-lg border border-border bg-card p-6 space-y-3">
    <h4 className="font-display text-lg text-accent">{title}</h4>
    {pairs.length === 0 ? (
      <p className="text-sm text-muted-foreground text-center py-4">No pairs yet.</p>
    ) : (
      <div className="space-y-2">
        {pairs.map((pair, i) => (
          <div key={pair.id} className="flex items-center gap-3">
            <span className="font-display text-xl text-accent w-6 text-center">{i + 1}</span>
            <div className="flex-1">
              <p className="text-sm text-foreground">{pair.player1.name} & {pair.player2.name}</p>
            </div>
            <span className="text-xs text-muted-foreground">{pair.wins}W - {pair.losses}L</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default StatsPlayoffs;
