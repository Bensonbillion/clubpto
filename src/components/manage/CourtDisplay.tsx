import { useState } from "react";
import { useGameState } from "@/hooks/useGameState";
import { Match, Pair } from "@/types/courtManager";
import { Trophy, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CourtDisplayProps {
  gameState: ReturnType<typeof useGameState>;
}

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
      <h3 className="font-display text-2xl text-accent text-center">Select Winner</h3>
      <div className="space-y-3">
        <button
          onClick={() => onSelect(match.pair1.id)}
          className="w-full rounded-lg border-2 border-border bg-muted p-4 text-center hover:border-accent hover:bg-accent/10 transition-all"
        >
          <p className="font-display text-lg text-foreground">{match.pair1.player1.name} & {match.pair1.player2.name}</p>
        </button>
        <button
          onClick={() => onSelect(match.pair2.id)}
          className="w-full rounded-lg border-2 border-border bg-muted p-4 text-center hover:border-accent hover:bg-accent/10 transition-all"
        >
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
  pendingMatches,
  onFinish,
}: {
  courtNum: number;
  match: Match | null;
  pendingMatches: Match[];
  onFinish: (match: Match) => void;
}) => (
  <div className="rounded-lg border border-border bg-card p-6 space-y-5 flex-1">
    <div className="flex items-center justify-between">
      <h3 className="font-display text-2xl text-accent">Court {courtNum}</h3>
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

    {match ? (
      <div className="space-y-4">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Now Playing</p>
        <div className="flex items-center gap-4">
          <div className="flex-1 text-center space-y-1">
            <p className="font-display text-lg text-foreground">{match.pair1.player1.name}</p>
            <p className="font-display text-lg text-foreground">{match.pair1.player2.name}</p>
          </div>
          <div className="font-display text-2xl text-accent">VS</div>
          <div className="flex-1 text-center space-y-1">
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

    {/* Queue */}
    {pendingMatches.length > 0 && (
      <div className="space-y-2 pt-2 border-t border-border">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Up Next</p>
        {pendingMatches.slice(0, 3).map((m, i) => (
          <div key={m.id} className="text-sm text-foreground/80 border-l-2 border-primary/30 pl-3 py-1">
            Match {i + 1}: {m.pair1.player1.name} & {m.pair1.player2.name} vs {m.pair2.player1.name} & {m.pair2.player2.name}
          </div>
        ))}
      </div>
    )}
  </div>
);

const CourtDisplay = ({ gameState }: CourtDisplayProps) => {
  const { court1Match, court2Match, pendingMatches, waitingPlayers, completeMatch } = gameState;
  const [finishingMatch, setFinishingMatch] = useState<Match | null>(null);

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex flex-col md:flex-row gap-4">
        <CourtCard courtNum={1} match={court1Match} pendingMatches={pendingMatches} onFinish={setFinishingMatch} />
        <CourtCard courtNum={2} match={court2Match} pendingMatches={pendingMatches} onFinish={setFinishingMatch} />
      </div>

      {/* Waiting Area */}
      {waitingPlayers.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-6 space-y-3">
          <h3 className="font-display text-lg text-accent">Waiting Area</h3>
          <div className="flex flex-wrap gap-2">
            {waitingPlayers.map((p) => (
              <span key={p.id} className="rounded-full border border-accent/40 bg-accent/5 px-4 py-1 text-sm text-foreground">
                {p.name}
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
