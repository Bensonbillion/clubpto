import { useState } from "react";
import { useGameState } from "@/hooks/useGameState";
import { GameHistory, Match } from "@/types/courtManager";
import { Button } from "@/components/ui/button";
import { History, RotateCcw, Check } from "lucide-react";

interface GameHistoryLogProps {
  gameState: ReturnType<typeof useGameState>;
}

const GameHistoryLog = ({ gameState }: GameHistoryLogProps) => {
  const { state, correctGameResult } = gameState;
  const [editingId, setEditingId] = useState<string | null>(null);

  const completedMatches = state.matches.filter((m) => m.status === "completed" && m.winner && m.loser);

  const handleFlip = (match: Match) => {
    if (!match.loser) return;
    correctGameResult(match.id, match.loser.id);
    setEditingId(null);
  };

  const formatTime = (iso?: string) => {
    if (!iso) return "";
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-5 md:p-8 space-y-4">
      <div className="flex items-center gap-2">
        <History className="w-5 h-5 text-accent" />
        <h3 className="font-display text-xl text-accent">Game History</h3>
        <span className="text-sm text-muted-foreground ml-auto">{completedMatches.length} games</span>
      </div>

      {completedMatches.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">No completed games yet.</p>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {[...completedMatches].reverse().map((match) => (
            <div
              key={match.id}
              className="rounded-md border border-border/60 bg-muted/30 p-3 space-y-2"
            >
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Game #{match.gameNumber} • Court {match.court || "?"}
                </span>
                <span>{formatTime(match.completedAt)}</span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <p className={`text-sm font-display ${match.winner?.id === match.pair1.id ? "text-accent" : "text-foreground/60"}`}>
                    {match.pair1.player1.name} & {match.pair1.player2.name}
                    {match.winner?.id === match.pair1.id && " 🏆"}
                  </p>
                  <p className="text-xs text-muted-foreground text-center my-0.5">vs</p>
                  <p className={`text-sm font-display ${match.winner?.id === match.pair2.id ? "text-accent" : "text-foreground/60"}`}>
                    {match.pair2.player1.name} & {match.pair2.player2.name}
                    {match.winner?.id === match.pair2.id && " 🏆"}
                  </p>
                </div>

                {editingId === match.id ? (
                  <div className="flex flex-col gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-accent text-accent"
                      onClick={() => handleFlip(match)}
                    >
                      <RotateCcw className="w-3 h-3 mr-1" /> Flip Result
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs text-muted-foreground"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs text-muted-foreground hover:text-accent"
                    onClick={() => setEditingId(match.id)}
                  >
                    Edit
                  </Button>
                )}
              </div>

              {match.matchupLabel && (
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                  {match.matchupLabel}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GameHistoryLog;
