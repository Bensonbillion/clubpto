import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useGameState } from "@/hooks/useGameState";
import { Match } from "@/types/courtManager";
import { Trophy, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CourtDisplayProps {
  gameState: ReturnType<typeof useGameState>;
}

const GameTimer = ({ startedAt }: { startedAt?: string }) => {
  const [elapsed, setElapsed] = useState("0:00");

  useEffect(() => {
    if (!startedAt) return;
    const start = new Date(startedAt).getTime();
    const tick = () => {
      const diff = Math.floor((Date.now() - start) / 1000);
      const m = Math.floor(diff / 60);
      const s = diff % 60;
      setElapsed(`${m}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Timer className="w-3.5 h-3.5" />
      <span className="font-mono">{elapsed}</span>
    </div>
  );
};


const WinnerModal = ({
  match,
  onSelect,
  onClose,
}: {
  match: Match;
  onSelect: (pairId: string) => void;
  onClose: () => void;
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose}>
    <div className="bg-card border border-border rounded-lg p-8 max-w-md w-full mx-4 space-y-6" onClick={(e) => e.stopPropagation()}>
      <h3 className="font-display text-2xl text-accent text-center">Which team won?</h3>
      <div className="space-y-3">
        <button
          onClick={() => onSelect(match.pair1.id)}
          className="w-full rounded-lg border-2 border-border bg-muted p-4 text-center hover:border-accent hover:bg-accent/10 transition-all"
        >
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Team A</p>
          <p className="font-display text-lg text-foreground">{match.pair1.player1.name} & {match.pair1.player2.name}</p>
        </button>
        <button
          onClick={() => onSelect(match.pair2.id)}
          className="w-full rounded-lg border-2 border-border bg-muted p-4 text-center hover:border-accent hover:bg-accent/10 transition-all"
        >
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Team B</p>
          <p className="font-display text-lg text-foreground">{match.pair2.player1.name} & {match.pair2.player2.name}</p>
        </button>
      </div>
      <button onClick={onClose} className="w-full text-muted-foreground text-sm hover:text-foreground transition-colors">
        Cancel
      </button>
    </div>
  </div>
);

const CourtCard = ({
  courtNum,
  match,
  totalGames,
  onFinish,
}: {
  courtNum: number;
  match: Match | null;
  totalGames: number;
  onFinish: (match: Match) => void;
}) => (
  <div className="rounded-lg border border-border bg-card p-6 space-y-5 flex-1">
    <div className="flex items-center justify-between">
      <div className="space-y-1">
        <h3 className="font-display text-2xl text-accent">Court {courtNum}</h3>
        {match?.gameNumber && totalGames > 0 && (
          <p className="text-xs text-muted-foreground">
            Game {match.gameNumber} of {totalGames}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        {match && <GameTimer startedAt={match.startedAt} />}
        {match ? (
          <span className="text-xs uppercase tracking-widest bg-accent/20 text-accent px-3 py-1 rounded-full border border-accent/30">
            Playing
          </span>
        ) : (
          <span className="text-xs uppercase tracking-widest bg-primary/20 text-primary px-3 py-1 rounded-full border border-primary/30">
            Waiting
          </span>
        )}
      </div>
    </div>

    {match ? (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1 text-center space-y-1 rounded-md bg-muted/50 p-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Team A</p>
            <p className="font-display text-lg text-foreground">{match.pair1.player1.name}</p>
            <p className="font-display text-lg text-foreground">{match.pair1.player2.name}</p>
          </div>
          <div className="font-display text-2xl text-accent">VS</div>
          <div className="flex-1 text-center space-y-1 rounded-md bg-muted/50 p-3">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Team B</p>
            <p className="font-display text-lg text-foreground">{match.pair2.player1.name}</p>
            <p className="font-display text-lg text-foreground">{match.pair2.player2.name}</p>
          </div>
        </div>
        <Button onClick={() => onFinish(match)} className="w-full bg-accent text-accent-foreground hover:bg-accent/80">
          <Trophy className="w-4 h-4 mr-1" /> Game Finished
        </Button>
      </div>
    ) : (
      <p className="text-muted-foreground text-center py-8">No active match</p>
    )}
  </div>
);

const CourtDisplay = ({ gameState }: CourtDisplayProps) => {
  const { state, court1Match, court2Match, pendingMatches, onDeckMatches, completeMatch } = gameState;
  const [finishingMatch, setFinishingMatch] = useState<Match | null>(null);
  const [searchParams] = useSearchParams();
  const courtFilter = searchParams.get("court");

  const showCourt1 = !courtFilter || courtFilter === "1";
  const showCourt2 = !courtFilter || courtFilter === "2";
  const totalGames = state.totalScheduledGames;

  // "On deck" players
  const onDeckPlayers = onDeckMatches.flatMap((m) => [
    m.pair1.player1.name,
    m.pair1.player2.name,
    m.pair2.player1.name,
    m.pair2.player2.name,
  ]);

  return (
    <div className="space-y-6 animate-fade-up">
      {courtFilter && (
        <p className="text-xs text-muted-foreground text-center uppercase tracking-widest">
          Showing Court {courtFilter} only
        </p>
      )}
      <div className={`flex flex-col ${!courtFilter ? "md:flex-row" : ""} gap-4`}>
        {showCourt1 && <CourtCard courtNum={1} match={court1Match} totalGames={totalGames} onFinish={setFinishingMatch} />}
        {showCourt2 && <CourtCard courtNum={2} match={court2Match} totalGames={totalGames} onFinish={setFinishingMatch} />}
      </div>

      {/* Up Next */}
      {pendingMatches.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-6 space-y-3">
          <h3 className="font-display text-lg text-accent">Up Next</h3>
          {pendingMatches.slice(0, 3).map((m) => (
            <div key={m.id} className="flex items-center gap-2 text-sm text-foreground/80 border-l-2 border-primary/30 pl-3 py-1">
              {m.gameNumber && <span className="text-accent font-display">#{m.gameNumber}</span>}
              <span>
                {m.pair1.player1.name} & {m.pair1.player2.name} vs {m.pair2.player1.name} & {m.pair2.player2.name}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* On Deck */}
      {onDeckPlayers.length > 0 && (
        <div className="rounded-lg border border-accent/20 bg-accent/5 p-6 space-y-3">
          <h3 className="font-display text-lg text-accent">🏓 On Deck — Get Ready!</h3>
          <div className="flex flex-wrap gap-2">
            {[...new Set(onDeckPlayers)].map((name) => (
              <span key={name} className="rounded-full border border-accent/40 bg-accent/10 px-4 py-1.5 text-sm font-display text-foreground">
                {name}
              </span>
            ))}
          </div>
        </div>
      )}

      {finishingMatch && (
        <WinnerModal
          match={finishingMatch}
          onSelect={(pairId) => {
            completeMatch(finishingMatch.id, pairId);
            setFinishingMatch(null);
          }}
          onClose={() => setFinishingMatch(null)}
        />
      )}
    </div>
  );
};

export default CourtDisplay;
