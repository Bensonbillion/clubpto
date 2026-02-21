import { useState, useRef } from "react";
import { useGameState } from "@/hooks/useGameState";
import { Button } from "@/components/ui/button";
import { Check, Clock, Swords, Lock, Unlock, UserPlus, X, Users } from "lucide-react";
import VipPairingDialog, { isVipPlayer } from "./VipPairingDialog";
import { FixedPair } from "@/types/courtManager";

interface CheckInProps {
  gameState: ReturnType<typeof useGameState>;
  onSwitchToCourtDisplay?: () => void;
  isAdmin?: boolean;
}

const CheckIn = ({ gameState, onSwitchToCourtDisplay, isAdmin = false }: CheckInProps) => {
  const { state, toggleCheckIn, checkedInPlayers, generateFullSchedule, addLatePlayersToSchedule, lockCheckIn, startSession } = gameState;
  const [generated, setGenerated] = useState(false);
  const [vipDialogFor, setVipDialogFor] = useState<string | null>(null);
  const [vipFixedPairs, setVipFixedPairs] = useState<FixedPair[]>([]);
  const vipsDismissedRef = useRef<Set<string>>(new Set());
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [passcodeError, setPasscodeError] = useState(false);
  const ADMIN_PASSCODE = "9999";

  const formatTime = (iso: string | null) => {
    if (!iso) return "";
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleCheckIn = (playerId: string) => {
    const player = state.roster.find((p) => p.id === playerId);
    if (!player) return;

    if (player.checkedIn) {
      toggleCheckIn(playerId);
      if (isVipPlayer(player.name)) {
        vipsDismissedRef.current.delete(player.name.toLowerCase());
        setVipFixedPairs((prev) =>
          prev.filter((fp) => fp.player1Name.toLowerCase() !== player.name.toLowerCase())
        );
      }
      return;
    }

    toggleCheckIn(playerId);

    if (isVipPlayer(player.name) && !vipsDismissedRef.current.has(player.name.toLowerCase())) {
      setTimeout(() => setVipDialogFor(player.name), 100);
    }
  };

  const handleVipClose = () => {
    if (vipDialogFor) {
      vipsDismissedRef.current.add(vipDialogFor.toLowerCase());
    }
    setVipDialogFor(null);
  };

  const handleVipConfirm = (teammateName: string | null) => {
    if (vipDialogFor) {
      vipsDismissedRef.current.add(vipDialogFor.toLowerCase());
      if (teammateName) {
        setVipFixedPairs((prev) => [
          ...prev.filter((fp) => fp.player1Name.toLowerCase() !== vipDialogFor.toLowerCase()),
          { player1Name: vipDialogFor, player2Name: teammateName },
        ]);
      }
    }
    setVipDialogFor(null);
  };

  const handleGenerateClick = async () => {
    await generateFullSchedule(vipFixedPairs);
    setGenerated(true);
    onSwitchToCourtDisplay?.();
  };

  const handleGenerateWithPasscode = () => {
    if (isAdmin) {
      handleGenerateClick();
    } else {
      setPasscodeInput("");
      setPasscodeError(false);
      setShowPasscodeModal(true);
    }
  };

  const handlePasscodeDigit = (d: string) => {
    const next = passcodeInput + d;
    setPasscodeError(false);
    if (next.length === 4) {
      if (next === ADMIN_PASSCODE) {
        setShowPasscodeModal(false);
        setPasscodeInput("");
        handleGenerateClick();
      } else {
        setPasscodeError(true);
        setPasscodeInput("");
      }
    } else {
      setPasscodeInput(next);
    }
  };

  const handlePasscodeDelete = () => {
    setPasscodeInput((c) => c.slice(0, -1));
    setPasscodeError(false);
  };

  // Sort: checked-in first, then alphabetical
  const sortedRoster = [...state.roster].sort((a, b) => {
    if (a.checkedIn !== b.checkedIn) return a.checkedIn ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const isLocked = state.sessionConfig.checkInLocked;

  const availableForVip = vipDialogFor
    ? state.roster.filter((p) => p.name.toLowerCase() !== vipDialogFor.toLowerCase()).map((p) => p.name)
    : [];

  // Tier style helper — only used in admin mode
  const getTierBadge = (tier: string) => {
    const styles: Record<string, string> = {
      A: "bg-yellow-500/15 border-yellow-500/40 text-yellow-400",
      B: "bg-gray-300/15 border-gray-300/40 text-gray-300",
      C: "bg-amber-700/15 border-amber-700/40 text-amber-600",
    };
    return styles[tier] || styles.C;
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-2xl text-accent">Player Check-In</h3>
        <div className="flex items-center gap-4">
          {/* Player count — visible to everyone */}
          <span className="text-base text-muted-foreground flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            {checkedInPlayers.length} of {state.roster.length} checked in
          </span>
          {isAdmin && (
            <Button
              variant="outline"
              size="default"
              onClick={() => lockCheckIn(!isLocked)}
              className={`min-h-[48px] px-5 ${isLocked ? "border-destructive text-destructive" : "border-accent text-accent"}`}
            >
              {isLocked ? <Lock className="w-4 h-4 mr-1.5" /> : <Unlock className="w-4 h-4 mr-1.5" />}
              {isLocked ? "Locked" : "Lock Check-In"}
            </Button>
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
              onClick={() => handleCheckIn(player.id)}
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
              
              {/* Tier badge — admin only */}
              {isAdmin && (
                <span className={`inline-block mt-1.5 text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full border ${getTierBadge(player.skillLevel)}`}>
                  {player.skillLevel}
                </span>
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

      {state.sessionStarted && checkedInPlayers.length >= 4 && (
        <div className="sticky bottom-4 rounded-lg border border-accent/30 bg-card/95 backdrop-blur-sm p-5 flex items-center justify-between gap-4 shadow-lg">
          <p className="text-accent text-base">
            ✦ {checkedInPlayers.length} players ready{state.matches.length > 0 ? " — schedule generated!" : ""}
          </p>
          <div className="flex items-center gap-3">
            {isAdmin && state.matches.length > 0 && (
              <Button onClick={() => { addLatePlayersToSchedule(); onSwitchToCourtDisplay?.(); }} variant="outline" className="border-accent text-accent hover:bg-accent/10 shrink-0 min-h-[48px] px-6 text-base">
                <UserPlus className="w-5 h-5 mr-2" /> Add Late Players
              </Button>
            )}
            {state.matches.length === 0 && (
              <Button onClick={handleGenerateWithPasscode} className="bg-accent text-accent-foreground hover:bg-accent/80 shrink-0 min-h-[48px] px-6 text-base">
                {!isAdmin && <Lock className="w-4 h-4 mr-2" />}
                <Swords className="w-5 h-5 mr-2" /> Generate Games
              </Button>
            )}
          </div>
        </div>
      )}
      {isAdmin && !state.sessionStarted && (
        <div className="sticky bottom-4 rounded-lg border border-accent/30 bg-card/95 backdrop-blur-sm p-5 flex items-center justify-between gap-4 shadow-lg">
          <p className="text-base text-muted-foreground">Start the session to enable game generation.</p>
          <Button onClick={startSession} className="bg-accent text-accent-foreground hover:bg-accent/80 shrink-0 min-h-[48px] px-6 text-base">
            Start Session
          </Button>
        </div>
      )}

      {/* Passcode modal for Generate Games */}
      {showPasscodeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in" onClick={() => setShowPasscodeModal(false)}>
          <div className="bg-card border border-border rounded-lg p-8 max-w-sm w-full mx-4 space-y-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl text-accent">Enter Passcode</h3>
              <button onClick={() => setShowPasscodeModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex gap-4 justify-center">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-5 h-5 rounded-full border-2 transition-all duration-200 ${
                    i < passcodeInput.length
                      ? "bg-accent border-accent scale-110"
                      : "border-muted-foreground/40"
                  } ${passcodeError ? "border-destructive bg-destructive/30 animate-pulse-soft" : ""}`}
                />
              ))}
            </div>
            {passcodeError && <p className="text-sm text-destructive text-center">Incorrect passcode</p>}
            <div className="grid grid-cols-3 gap-3 max-w-[240px] mx-auto">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "←"].map((d) =>
                d === "" ? (
                  <div key="empty" />
                ) : (
                  <button
                    key={d}
                    onClick={() => (d === "←" ? handlePasscodeDelete() : handlePasscodeDigit(d))}
                    className="w-16 h-16 rounded-lg border border-border bg-card text-foreground font-display text-xl hover:bg-muted hover:border-accent/40 transition-all active:scale-95"
                  >
                    {d}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {vipDialogFor && (
        <VipPairingDialog
          open={!!vipDialogFor}
          onClose={handleVipClose}
          onConfirm={handleVipConfirm}
          vipName={vipDialogFor}
          availablePlayers={availableForVip}
        />
      )}
    </div>
  );
};

export default CheckIn;
