import { useGameState } from "@/hooks/useGameState";
import { Player, PlayoffMatch } from "@/types/courtManager";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Trophy, Medal, Play } from "lucide-react";

interface StatsPlayoffsProps {
  gameState: ReturnType<typeof useGameState>;
}

interface PlayoffSeed {
  seed: number;
  player: Player;
  winPct: number;
}

const PlayerLeaderboard = ({ title, players }: { title: string; players: (Player & { winPct: number })[] }) => (
  <div className="rounded-lg border border-border bg-card p-6 space-y-3">
    <h4 className="font-display text-lg text-accent">{title}</h4>
    {players.length === 0 ? (
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
            {players.map((p, i) => (
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
);

const PlayoffMatchCard = ({
  match,
  onStart,
  onComplete,
}: {
  match: PlayoffMatch;
  onStart: (id: string, court: number) => void;
  onComplete: (id: string, winnerPairId: string) => void;
}) => {
  const [selectingWinner, setSelectingWinner] = useState(false);

  if (!match.pair1 || !match.pair2) {
    return (
      <div className="rounded-md border border-border/50 bg-muted/30 p-3 text-sm text-muted-foreground text-center">
        Waiting for teams…
      </div>
    );
  }

  const team1Label = `${match.pair1.player1.name} & ${match.pair1.player2.name}`;
  const team2Label = `${match.pair2.player1.name} & ${match.pair2.player2.name}`;

  return (
    <div className={`rounded-md border p-3 space-y-2 ${
      match.status === "completed" ? "border-accent/30 bg-accent/5" :
      match.status === "playing" ? "border-accent border-2 bg-card" :
      "border-border bg-card"
    }`}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Round {match.round}</span>
        <span className={`uppercase tracking-widest ${
          match.status === "playing" ? "text-accent" : 
          match.status === "completed" ? "text-accent/60" : ""
        }`}>{match.status}</span>
      </div>
      <div className="space-y-1">
        <p className={`text-sm font-display ${match.winner?.id === match.pair1.id ? "text-accent" : "text-foreground"}`}>
          {team1Label} {match.winner?.id === match.pair1.id && "🏆"}
        </p>
        <p className="text-xs text-muted-foreground text-center">vs</p>
        <p className={`text-sm font-display ${match.winner?.id === match.pair2.id ? "text-accent" : "text-foreground"}`}>
          {team2Label} {match.winner?.id === match.pair2.id && "🏆"}
        </p>
      </div>

      {match.status === "pending" && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="flex-1 text-xs border-accent text-accent" onClick={() => onStart(match.id, 1)}>
            <Play className="w-3 h-3 mr-1" /> Court 1
          </Button>
          <Button size="sm" variant="outline" className="flex-1 text-xs border-accent text-accent" onClick={() => onStart(match.id, 2)}>
            <Play className="w-3 h-3 mr-1" /> Court 2
          </Button>
        </div>
      )}

      {match.status === "playing" && !selectingWinner && (
        <Button size="sm" className="w-full bg-accent text-accent-foreground text-xs" onClick={() => setSelectingWinner(true)}>
          <Trophy className="w-3 h-3 mr-1" /> Game Finished
        </Button>
      )}

      {match.status === "playing" && selectingWinner && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground text-center">Who won?</p>
          <button onClick={() => { onComplete(match.id, match.pair1!.id); setSelectingWinner(false); }}
            className="w-full text-left text-xs rounded border border-border p-2 hover:border-accent hover:bg-accent/10 transition-all">
            {team1Label}
          </button>
          <button onClick={() => { onComplete(match.id, match.pair2!.id); setSelectingWinner(false); }}
            className="w-full text-left text-xs rounded border border-border p-2 hover:border-accent hover:bg-accent/10 transition-all">
            {team2Label}
          </button>
        </div>
      )}
    </div>
  );
};

const StatsPlayoffs = ({ gameState }: StatsPlayoffsProps) => {
  const { state, checkedInPlayers, completedMatches, generatePlayoffMatches, startPlayoffMatch, completePlayoffMatch } = gameState;
  const [playoffSeeds, setPlayoffSeeds] = useState<PlayoffSeed[]>([]);

  const withWinPct = (players: Player[]) =>
    players
      .filter((p) => p.checkedIn)
      .map((p) => ({
        ...p,
        winPct: p.gamesPlayed > 0 ? p.wins / p.gamesPlayed : 0,
      }))
      .sort((a, b) => {
        if (b.winPct !== a.winPct) return b.winPct - a.winPct;
        return b.wins - a.wins;
      });

  const goodStandings = withWinPct(state.roster.filter((p) => p.skillLevel === "good"));
  const beginnerStandings = withWinPct(state.roster.filter((p) => p.skillLevel === "beginner"));

  const handleGeneratePlayoffSeeds = () => {
    const seeded: PlayoffSeed[] = [];
    let seed = 1;
    goodStandings.forEach((p) => {
      seeded.push({ seed: seed++, player: p, winPct: p.winPct });
    });
    beginnerStandings.forEach((p) => {
      seeded.push({ seed: seed++, player: p, winPct: p.winPct });
    });
    setPlayoffSeeds(seeded);
    generatePlayoffMatches(seeded);
  };

  const roundRobinComplete = state.matches.length > 0 && state.matches.every((m) => m.status === "completed");
  const playoffMatchesByRound = (state.playoffMatches || []).reduce((acc, m) => {
    if (!acc[m.round]) acc[m.round] = [];
    acc[m.round].push(m);
    return acc;
  }, {} as Record<number, PlayoffMatch[]>);
  const rounds = Object.keys(playoffMatchesByRound).map(Number).sort((a, b) => a - b);

  // Find the champion
  const allPlayoffComplete = (state.playoffMatches || []).length > 0 && (state.playoffMatches || []).every((m) => m.status === "completed");
  const lastRound = rounds[rounds.length - 1];
  const champion = allPlayoffComplete && lastRound ? playoffMatchesByRound[lastRound]?.[0]?.winner : null;

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

      {/* Separate Leaderboards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <PlayerLeaderboard title="Standings — Group A" players={goodStandings} />
        <PlayerLeaderboard title="Standings — Group B" players={beginnerStandings} />
      </div>

      {/* Playoff Section */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="font-display text-xl text-accent">Playoffs</h3>

        {champion && (
          <div className="rounded-lg border-2 border-accent bg-accent/10 p-6 text-center space-y-2">
            <Trophy className="w-10 h-10 text-accent mx-auto" />
            <h4 className="font-display text-2xl text-accent">Champions!</h4>
            <p className="font-display text-xl text-foreground">
              {champion.player1.name} & {champion.player2.name}
            </p>
          </div>
        )}

        {(state.playoffMatches || []).length === 0 ? (
          <>
            <p className="text-sm text-muted-foreground">
              Players seeded by Win%. Single-elimination bracket with doubles teams.
            </p>
            {roundRobinComplete && (
              <div className="rounded-md border border-accent/30 bg-accent/5 p-3 text-sm text-accent">
                ✦ Round-robin complete! Generate playoff bracket below.
              </div>
            )}
            <Button
              onClick={handleGeneratePlayoffSeeds}
              disabled={goodStandings.length + beginnerStandings.length < 4}
              className="bg-accent text-accent-foreground hover:bg-accent/80"
            >
              <Trophy className="w-4 h-4 mr-1" /> Generate Playoff Bracket
            </Button>

            {/* Preview seeds */}
            {playoffSeeds.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                {playoffSeeds.map((s) => (
                  <div key={s.player.id} className="flex items-center gap-3 rounded-md border border-border bg-muted p-3">
                    <span className="font-display text-2xl text-accent w-8 text-center">{s.seed}</span>
                    <div className="flex-1">
                      <p className="font-display text-foreground">{s.player.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
            )}
          </>
        ) : (
          /* Interactive Bracket */
          <div className="space-y-6">
            {rounds.map((round) => (
              <div key={round} className="space-y-3">
                <h4 className="font-display text-lg text-accent">
                  {rounds.length === 1 ? "Final" : 
                   round === rounds[rounds.length - 1] ? "Final" :
                   round === 1 ? "Semi-Finals" : `Round ${round}`}
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {playoffMatchesByRound[round].map((m) => (
                    <PlayoffMatchCard
                      key={m.id}
                      match={m}
                      onStart={startPlayoffMatch}
                      onComplete={completePlayoffMatch}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsPlayoffs;