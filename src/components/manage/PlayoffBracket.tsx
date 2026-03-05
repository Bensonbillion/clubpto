import { PlayoffMatch, Pair } from "@/types/courtManager";
import { Button } from "@/components/ui/button";
import { Trophy } from "lucide-react";
import { useState } from "react";

interface PlayoffBracketProps {
  playoffMatches: PlayoffMatch[];
  onStart: (matchId: string, court: number) => void;
  onComplete: (matchId: string, winnerPairId: string) => void;
  isAdmin: boolean;
  courtCount?: number;
}

const TeamLabel = ({ pair, seed, isWinner }: { pair: Pair | null; seed?: number; isWinner: boolean }) => {
  if (!pair) return <span className="text-muted-foreground text-sm italic">TBD</span>;
  return (
    <span className={`font-display text-sm ${isWinner ? "text-accent" : "text-foreground"} flex items-center gap-2`}>
      {seed ? <span className="text-accent font-mono text-xs bg-accent/10 rounded px-1.5 py-0.5">#{seed}</span> : null}
      {pair.player1.name} & {pair.player2.name}
      {isWinner && " 🏆"}
    </span>
  );
};

const BracketMatchCard = ({
  match,
  onStart,
  onComplete,
  isAdmin,
  roundLabel,
  courtCount = 2,
}: {
  match: PlayoffMatch;
  onStart: (id: string, court: number) => void;
  onComplete: (id: string, winnerPairId: string) => void;
  isAdmin: boolean;
  roundLabel: string;
  courtCount?: number;
}) => {
  const [selectingWinner, setSelectingWinner] = useState(false);
  const court = (match as any).court as number | undefined;

  const borderClass =
    match.status === "completed"
      ? "border-accent/40 bg-accent/5"
      : match.status === "playing"
      ? "border-accent border-2 bg-card shadow-lg shadow-accent/10"
      : "border-border bg-card";

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${borderClass} min-w-[260px]`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{roundLabel}</span>
        <div className="flex items-center gap-2">
          {court && match.status === "playing" && (
            <span className="text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
              Court {court}
            </span>
          )}
          <span
            className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full ${
              match.status === "playing"
                ? "bg-accent/20 text-accent"
                : match.status === "completed"
                ? "bg-accent/10 text-accent/60"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {match.status}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <div className={`rounded-md px-3 py-2 ${match.winner?.id === match.pair1?.id ? "bg-accent/10 border border-accent/30" : "bg-muted/30"}`}>
          <TeamLabel pair={match.pair1} seed={match.seed1 || undefined} isWinner={match.winner?.id === match.pair1?.id} />
        </div>
        <p className="text-xs text-muted-foreground text-center font-display">VS</p>
        <div className={`rounded-md px-3 py-2 ${match.winner?.id === match.pair2?.id ? "bg-accent/10 border border-accent/30" : "bg-muted/30"}`}>
          <TeamLabel pair={match.pair2} seed={match.seed2 || undefined} isWinner={match.winner?.id === match.pair2?.id} />
        </div>
      </div>

      {isAdmin && match.pair1 && match.pair2 && (
        <>
          {match.status === "pending" && (
            <div className="flex gap-2">
              {Array.from({ length: courtCount }, (_, i) => i + 1).map((c) => (
                <Button key={c} size="sm" variant="outline" className="flex-1 border-accent/40 text-accent hover:bg-accent/10 text-xs"
                  onClick={() => onStart(match.id, c)}>
                  Start Court {c}
                </Button>
              ))}
            </div>
          )}

          {match.status === "playing" && !selectingWinner && (
            <Button size="sm" className="w-full bg-accent text-accent-foreground text-xs" onClick={() => setSelectingWinner(true)}>
              <Trophy className="w-3 h-3 mr-1" /> Game Finished
            </Button>
          )}

          {match.status === "playing" && selectingWinner && (
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground text-center">Who won?</p>
              <button
                onClick={() => { onComplete(match.id, match.pair1!.id); setSelectingWinner(false); }}
                className="w-full text-left text-xs rounded-md border border-border p-2.5 hover:border-accent hover:bg-accent/10 transition-all"
              >
                {match.pair1!.player1.name} & {match.pair1!.player2.name}
              </button>
              <button
                onClick={() => { onComplete(match.id, match.pair2!.id); setSelectingWinner(false); }}
                className="w-full text-left text-xs rounded-md border border-border p-2.5 hover:border-accent hover:bg-accent/10 transition-all"
              >
                {match.pair2!.player1.name} & {match.pair2!.player2.name}
              </button>
              <button onClick={() => setSelectingWinner(false)} className="w-full text-xs text-muted-foreground hover:text-foreground py-1">Cancel</button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const PlayoffBracket = ({ playoffMatches, onStart, onComplete, isAdmin, courtCount = 2 }: PlayoffBracketProps) => {
  if (playoffMatches.length === 0) return null;

  const byRound = playoffMatches.reduce((acc, m) => {
    if (!acc[m.round]) acc[m.round] = [];
    acc[m.round].push(m);
    return acc;
  }, {} as Record<number, PlayoffMatch[]>);

  const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b);
  const allComplete = playoffMatches.every((m) => m.status === "completed");
  const lastRound = rounds[rounds.length - 1];
  const champion = allComplete && lastRound ? byRound[lastRound]?.[0]?.winner : null;

  const getRoundLabel = (round: number) => {
    const totalRounds = rounds.length;
    if (round === rounds[totalRounds - 1]) return "Final";
    if (round === rounds[totalRounds - 2]) return "Semi-Finals";
    if (round === rounds[totalRounds - 3]) return "Quarter-Finals";
    return `Round ${round}`;
  };

  return (
    <div className="space-y-6">
      {champion && (
        <div className="rounded-lg border-2 border-accent bg-accent/10 p-6 text-center space-y-2">
          <Trophy className="w-10 h-10 text-accent mx-auto" />
          <h4 className="font-display text-2xl text-accent">Champions!</h4>
          <p className="font-display text-xl text-foreground">
            {champion.player1.name} & {champion.player2.name}
          </p>
        </div>
      )}

      {/* Bracket layout */}
      <div className="flex gap-6 overflow-x-auto pb-4">
        {rounds.map((round) => (
          <div key={round} className="flex flex-col gap-4 min-w-[280px]">
            <h4 className="font-display text-lg text-accent text-center">{getRoundLabel(round)}</h4>
            <div className="flex flex-col gap-4 justify-around flex-1">
              {byRound[round].map((m) => (
                <BracketMatchCard
                  key={m.id}
                  match={m}
                  onComplete={onComplete}
                  isAdmin={isAdmin}
                  roundLabel={getRoundLabel(round)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PlayoffBracket;
