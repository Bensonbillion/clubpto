import { useState } from "react";
import { useGameState } from "@/hooks/useGameState";
import { Button } from "@/components/ui/button";
import { Check, Clock, Swords } from "lucide-react";

interface CheckInProps {
  gameState: ReturnType<typeof useGameState>;
  onSwitchToCourtDisplay?: () => void;
}

const CheckIn = ({ gameState, onSwitchToCourtDisplay }: CheckInProps) => {
  const { state, toggleCheckIn, checkedInPlayers, generatePairs, generateMatches } = gameState;
  const [generated, setGenerated] = useState(false);

  const formatTime = (iso: string | null) => {
    if (!iso) return "";
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleGenerate = async () => {
    await generatePairs();
    setTimeout(() => {
      generateMatches();
      setGenerated(true);
      onSwitchToCourtDisplay?.();
    }, 100);
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl text-accent">Player Check-In</h3>
        <span className="text-sm text-muted-foreground">
          {checkedInPlayers.length} / {state.roster.length} checked in
        </span>
      </div>

      {state.roster.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">Add players in Admin Setup first.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {state.roster.map((player) => (
            <button
              key={player.id}
              onClick={() => toggleCheckIn(player.id)}
              className={`
                relative rounded-lg border-2 p-5 text-center transition-all duration-300 
                ${
                  player.checkedIn
                    ? "bg-primary/20 border-accent shadow-lg shadow-primary/10"
                    : "bg-card border-border hover:border-primary/40"
                }
              `}
            >
              {player.checkedIn && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                  <Check className="w-3 h-3 text-accent-foreground" />
                </div>
              )}
              <p className="font-display text-lg text-foreground">{player.name}</p>
              <p className="text-xs uppercase tracking-widest text-accent mt-1">{player.skillLevel}</p>
              <div className="mt-2 text-xs text-muted-foreground flex items-center justify-center gap-1">
                {player.checkedIn ? (
                  <>
                    <Clock className="w-3 h-3" /> {formatTime(player.checkInTime)}
                  </>
                ) : (
                  "Tap to check in"
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Sticky bottom generate bar — always visible when 4+ checked in */}
      {checkedInPlayers.length >= 4 && (
        <div className="sticky bottom-4 rounded-lg border border-accent/30 bg-card/95 backdrop-blur-sm p-4 flex items-center justify-between gap-4 shadow-lg">
          <p className="text-accent text-sm">
            ✦ {checkedInPlayers.length} players ready{generated ? " — games generated!" : ""}
          </p>
          {!generated && (
            <Button onClick={handleGenerate} className="bg-accent text-accent-foreground hover:bg-accent/80 shrink-0">
              <Swords className="w-4 h-4 mr-1" /> Generate Games
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default CheckIn;
