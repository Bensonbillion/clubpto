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
  const [showGeneratePrompt, setShowGeneratePrompt] = useState(false);
  const [generated, setGenerated] = useState(false);

  const formatTime = (iso: string | null) => {
    if (!iso) return "";
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleCheckIn = (id: string) => {
    toggleCheckIn(id);
    // After toggling, check if we should show the generate prompt
    // We check current state + toggle logic
    const player = state.roster.find((p) => p.id === id);
    const willBeCheckedIn = player ? !player.checkedIn : false;
    const newCount = willBeCheckedIn ? checkedInPlayers.length + 1 : checkedInPlayers.length - 1;
    if (newCount >= 4 && newCount % 4 === 0 && willBeCheckedIn && !generated) {
      setShowGeneratePrompt(true);
    }
  };

  const handleGenerate = () => {
    generatePairs();
    setTimeout(() => {
      generateMatches();
      setGenerated(true);
      setShowGeneratePrompt(false);
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
              onClick={() => handleCheckIn(player.id)}
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

      {/* Always show generate button when 4+ checked in */}
      {checkedInPlayers.length >= 4 && (
        <div className="rounded-lg border border-accent/30 bg-accent/5 p-4 text-center space-y-3">
          <p className="text-accent text-sm">
            ✦ {checkedInPlayers.length} players checked in — {generated ? "games generated!" : "ready to generate games!"}
          </p>
          {!generated && (
            <Button onClick={handleGenerate} className="bg-accent text-accent-foreground hover:bg-accent/80">
              <Swords className="w-4 h-4 mr-1" /> Generate Games
            </Button>
          )}
        </div>
      )}

      {/* Generate popup */}
      {showGeneratePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in" onClick={() => setShowGeneratePrompt(false)}>
          <div className="bg-card border border-border rounded-lg p-8 max-w-sm w-full mx-4 text-center space-y-5" onClick={(e) => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center mx-auto">
              <Swords className="w-7 h-7 text-accent" />
            </div>
            <h3 className="font-display text-2xl text-accent">{checkedInPlayers.length + 1} Players Ready!</h3>
            <p className="text-sm text-muted-foreground">
              Enough players have checked in. Generate pairs and start matches?
            </p>
            <div className="flex gap-3">
              <Button onClick={() => setShowGeneratePrompt(false)} variant="outline" className="flex-1 border-border text-muted-foreground">
                Not Yet
              </Button>
              <Button onClick={handleGenerate} className="flex-1 bg-accent text-accent-foreground hover:bg-accent/80">
                Generate Games
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CheckIn;
