import { useState } from "react";
import { useGameState } from "@/hooks/useGameState";
import { Button } from "@/components/ui/button";
import { Check, Clock, Swords, Lock, Unlock, UserPlus } from "lucide-react";
import VipPairingDialog, { getCheckedInVips } from "./VipPairingDialog";
import { FixedPair } from "@/types/courtManager";

interface CheckInProps {
  gameState: ReturnType<typeof useGameState>;
  onSwitchToCourtDisplay?: () => void;
  isAdmin?: boolean;
}

const CheckIn = ({ gameState, onSwitchToCourtDisplay, isAdmin = false }: CheckInProps) => {
  const { state, toggleCheckIn, checkedInPlayers, generateFullSchedule, addLatePlayersToSchedule, lockCheckIn } = gameState;
  const [generated, setGenerated] = useState(false);
  const [showVipDialog, setShowVipDialog] = useState(false);

  const formatTime = (iso: string | null) => {
    if (!iso) return "";
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleGenerateClick = () => {
    const vips = getCheckedInVips(state.roster);
    if (vips) {
      setShowVipDialog(true);
    } else {
      doGenerate(null);
    }
  };

  const doGenerate = async (fixedPair: FixedPair | null) => {
    setShowVipDialog(false);
    await generateFullSchedule(fixedPair ? [fixedPair] : []);
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
        <h3 className="font-display text-2xl text-accent">Player Check-In</h3>
        <div className="flex items-center gap-4">
          {isAdmin && (
            <>
              <Button
                variant="outline"
                size="default"
                onClick={() => lockCheckIn(!isLocked)}
                className={`min-h-[48px] px-5 ${isLocked ? "border-destructive text-destructive" : "border-accent text-accent"}`}
              >
                {isLocked ? <Lock className="w-4 h-4 mr-1.5" /> : <Unlock className="w-4 h-4 mr-1.5" />}
                {isLocked ? "Locked" : "Lock Check-In"}
              </Button>
              <span className="text-base text-muted-foreground">
                {checkedInPlayers.length} of {state.roster.length} checked in
              </span>
            </>
          )}
        </div>
      </div>

      {isLocked && !isAdmin && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center">
          <p className="text-base text-destructive">Check-in is closed.</p>
        </div>
      )}

      {state.roster.length === 0 ? (
        <p className="text-muted-foreground text-center text-lg py-12">No players have been added yet.</p>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {sortedRoster.map((player) => (
            <button
              key={player.id}
              onClick={() => toggleCheckIn(player.id)}
              disabled={isLocked && !isAdmin}
              className={`
                relative rounded-lg border-2 p-6 text-center transition-all duration-300 min-h-[100px]
                ${isLocked && !isAdmin ? "cursor-not-allowed" : "active:scale-95"}
                ${
                  player.checkedIn
                    ? "bg-primary/20 border-accent shadow-lg shadow-primary/10"
                    : "bg-card/40 border-border/50 opacity-60 hover:opacity-80 hover:border-primary/40"
                }
              `}
            >
              {player.checkedIn && (
                <div className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-accent flex items-center justify-center">
                  <Check className="w-4 h-4 text-accent-foreground" />
                </div>
              )}
              <p className="font-display text-xl text-foreground">{player.name}</p>
              {/* Skill level only visible to admin */}
              {isAdmin && (
                <p className="text-xs uppercase tracking-widest text-accent mt-1.5">{player.skillLevel}</p>
              )}
              <div className="mt-2.5 text-sm text-muted-foreground flex items-center justify-center gap-1.5">
                {player.checkedIn ? (
                  <>
                    <Clock className="w-3.5 h-3.5" /> {formatTime(player.checkInTime)}
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
        <div className="sticky bottom-4 rounded-lg border border-accent/30 bg-card/95 backdrop-blur-sm p-5 flex items-center justify-between gap-4 shadow-lg">
          <p className="text-accent text-base">
            ✦ {checkedInPlayers.length} players ready{state.matches.length > 0 ? " — schedule generated!" : ""}
          </p>
          <div className="flex items-center gap-3">
            {state.matches.length > 0 && (
              <Button onClick={addLatePlayersToSchedule} variant="outline" className="border-accent text-accent hover:bg-accent/10 shrink-0 min-h-[48px] px-6 text-base">
                <UserPlus className="w-5 h-5 mr-2" /> Add Late Players
              </Button>
            )}
            {state.matches.length === 0 && (
              <Button onClick={handleGenerateClick} className="bg-accent text-accent-foreground hover:bg-accent/80 shrink-0 min-h-[48px] px-6 text-base">
                <Swords className="w-5 h-5 mr-2" /> Generate Games
              </Button>
            )}
          </div>
        </div>
      )}
      {isAdmin && !state.sessionStarted && (
        <div className="sticky bottom-4 rounded-lg border border-border bg-card/95 backdrop-blur-sm p-5 text-center shadow-lg">
          <p className="text-base text-muted-foreground">Start session in Admin Setup before generating games.</p>
        </div>
      )}
      {showVipDialog && (
        <VipPairingDialog
          open={showVipDialog}
          onClose={() => setShowVipDialog(false)}
          onConfirm={(fp) => doGenerate(fp)}
          vipNames={getCheckedInVips(state.roster) || []}
        />
      )}
    </div>
  );
};

export default CheckIn;