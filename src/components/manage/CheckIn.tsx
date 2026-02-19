import { useState } from "react";
import { useGameState } from "@/hooks/useGameState";
import { Button } from "@/components/ui/button";
import { Check, Clock, Swords, Lock, Unlock, UserPlus } from "lucide-react";

interface CheckInProps {
  gameState: ReturnType<typeof useGameState>;
  onSwitchToCourtDisplay?: () => void;
  isAdmin?: boolean;
}

const CheckIn = ({ gameState, onSwitchToCourtDisplay, isAdmin = false }: CheckInProps) => {
  const { state, toggleCheckIn, checkedInPlayers, generateFullSchedule, addLatePlayersToSchedule, lockCheckIn } = gameState;
  const [generated, setGenerated] = useState(false);

  const formatTime = (iso: string | null) => {
    if (!iso) return "";
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleGenerate = async () => {
    await generateFullSchedule();
    setGenerated(true);
    onSwitchToCourtDisplay?.();
  };

  // Sort: checked-in first, then alphabetical
  const sortedRoster = [...state.roster].sort((a, b) => {
    if (a.checkedIn !== b.checkedIn) return a.checkedIn ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const isLocked = state.sessionConfig.checkInLocked;

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-xl text-accent">Player Check-In</h3>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => lockCheckIn(!isLocked)}
                className={isLocked ? "border-destructive text-destructive" : "border-accent text-accent"}
              >
                {isLocked ? <Lock className="w-3.5 h-3.5 mr-1" /> : <Unlock className="w-3.5 h-3.5 mr-1" />}
                {isLocked ? "Locked" : "Lock Check-In"}
              </Button>
              <span className="text-sm text-muted-foreground">
                {checkedInPlayers.length} of {state.roster.length} checked in
              </span>
            </>
          )}
        </div>
      </div>

      {isLocked && !isAdmin && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center">
          <p className="text-sm text-destructive">Check-in is closed.</p>
        </div>
      )}

      {state.roster.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">No players have been added yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {sortedRoster.map((player) => (
            <button
              key={player.id}
              onClick={() => toggleCheckIn(player.id)}
              disabled={isLocked && !isAdmin}
              className={`
                relative rounded-lg border-2 p-5 text-center transition-all duration-300
                ${isLocked && !isAdmin ? "cursor-not-allowed" : ""}
                ${
                  player.checkedIn
                    ? "bg-primary/20 border-accent shadow-lg shadow-primary/10"
                    : "bg-card/40 border-border/50 opacity-60 hover:opacity-80 hover:border-primary/40"
                }
              `}
            >
              {player.checkedIn && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                  <Check className="w-3 h-3 text-accent-foreground" />
                </div>
              )}
              <p className="font-display text-lg text-foreground">{player.name}</p>
              {/* Skill level only visible to admin */}
              {isAdmin && (
                <p className="text-xs uppercase tracking-widest text-accent mt-1">{player.skillLevel}</p>
              )}
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

      {/* Sticky bottom generate bar — admin only, session started, 4+ checked in */}
      {isAdmin && state.sessionStarted && checkedInPlayers.length >= 4 && (
        <div className="sticky bottom-4 rounded-lg border border-accent/30 bg-card/95 backdrop-blur-sm p-4 flex items-center justify-between gap-4 shadow-lg">
          <p className="text-accent text-sm">
            ✦ {checkedInPlayers.length} players ready{state.matches.length > 0 ? " — schedule generated!" : ""}
          </p>
          <div className="flex items-center gap-2">
            {state.matches.length > 0 && (
              <Button onClick={addLatePlayersToSchedule} variant="outline" className="border-accent text-accent hover:bg-accent/10 shrink-0">
                <UserPlus className="w-4 h-4 mr-1" /> Add Late Players
              </Button>
            )}
            {state.matches.length === 0 && (
              <Button onClick={handleGenerate} className="bg-accent text-accent-foreground hover:bg-accent/80 shrink-0">
                <Swords className="w-4 h-4 mr-1" /> Generate Games
              </Button>
            )}
          </div>
        </div>
      )}
      {isAdmin && !state.sessionStarted && (
        <div className="sticky bottom-4 rounded-lg border border-border bg-card/95 backdrop-blur-sm p-4 text-center shadow-lg">
          <p className="text-sm text-muted-foreground">Start session in Admin Setup before generating games.</p>
        </div>
      )}
    </div>
  );
};

export default CheckIn;
