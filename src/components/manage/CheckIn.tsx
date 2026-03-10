import { useState, useRef, useMemo } from "react";
import { useGameState } from "@/hooks/useGameState";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Check, Clock, Swords, Lock, Unlock, UserPlus, X, Users, AlertTriangle, UserCheck, Ban } from "lucide-react";
import VipPairingDialog, { isVipPlayer } from "./VipPairingDialog";
import OddPlayerAlert from "./OddPlayerAlert";
import PairEditor from "./PairEditor";
import { FixedPair, SkillTier, OddPlayerDecision } from "@/types/courtManager";
import { toast } from "sonner";

interface CheckInProps {
  gameState: ReturnType<typeof useGameState>;
  onSwitchToCourtDisplay?: () => void;
  isAdmin?: boolean;
}

const CheckIn = ({ gameState, onSwitchToCourtDisplay, isAdmin = false }: CheckInProps) => {
  const { state, toggleCheckIn, checkedInPlayers, generateFullSchedule, addLatePlayersToSchedule, handleLateCheckIn, closeCheckIn, lockCheckIn, startSession, setOddPlayerDecisions, swapPlayersInPairs, swapWaitlistPlayer, lockPairs } = gameState;
  const [generated, setGenerated] = useState(false);
  const [vipDialogFor, setVipDialogFor] = useState<string | null>(null);
  const [vipFixedPairs, setVipFixedPairs] = useState<FixedPair[]>([]);
  const vipsDismissedRef = useRef<Set<string>>(new Set());
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [passcodeError, setPasscodeError] = useState(false);
  const [lateVipPlayerId, setLateVipPlayerId] = useState<string | null>(null);
  const ADMIN_PASSCODE = "9999";

  const sessionActive = state.matches.length > 0;
  const checkInClosed = state.sessionConfig.checkInClosed;

  const formatTime = (iso: string | null) => {
    if (!iso) return "";
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleCheckIn = (playerId: string) => {
    const player = state.roster.find((p) => p.id === playerId);
    if (!player) return;

    // Block if check-in is closed and this is a late check-in
    if (checkInClosed && !player.checkedIn) {
      toast.error("Check-in is closed. No more players can be added.");
      return;
    }

    if (player.checkedIn) {
      toggleCheckIn(playerId);
      if (isVipPlayer(player.name, player.profileId)) {
        vipsDismissedRef.current.delete(player.name.toLowerCase());
        setVipFixedPairs((prev) =>
          prev.filter((fp) => fp.player1Name.toLowerCase() !== player.name.toLowerCase())
        );
      }
      return;
    }

    // Check in the player
    toggleCheckIn(playerId);

    // Dynamic mode: auto-trigger schedule when 4+ players checked in
    if (state.sessionConfig.dynamicMode && !sessionActive && state.sessionStarted) {
      const afterCheckInCount = checkedInPlayers.length + 1;
      if (afterCheckInCount >= 4) {
        setTimeout(async () => {
          await generateFullSchedule(vipFixedPairs);
          setGenerated(true);
          onSwitchToCourtDisplay?.();
        }, 300);
        return;
      }
    }

    // If session is already active, handle late arrival flow
    if (sessionActive) {
      if (isVipPlayer(player.name, player.profileId) && !vipsDismissedRef.current.has(player.name.toLowerCase())) {
        // VIP late arrival — show partner selection dialog
        setLateVipPlayerId(playerId);
        setTimeout(() => setVipDialogFor(player.name), 100);
      } else {
        // Non-VIP late arrival — auto-pair or waitlist
        setTimeout(() => {
          const result = handleLateCheckIn(playerId);
          if (result.paired) {
            toast.success(`${player.name} + ${result.partnerName} added to schedule — first game in ~${result.estimatedMinutes || 7} minutes`);
          } else {
            toast.info(`${player.name} added as late player — waiting for a same-tier partner`);
          }
        }, 100);
      }
      return;
    }

    // Pre-session VIP handling
    if (isVipPlayer(player.name, player.profileId) && !vipsDismissedRef.current.has(player.name.toLowerCase())) {
      setTimeout(() => setVipDialogFor(player.name), 100);
    }
  };

  const handleVipClose = () => {
    if (vipDialogFor) {
      vipsDismissedRef.current.add(vipDialogFor.toLowerCase());
    }
    // If this was a late VIP, still handle late check-in without a partner
    if (lateVipPlayerId && sessionActive) {
      const player = state.roster.find((p) => p.id === lateVipPlayerId);
      const result = handleLateCheckIn(lateVipPlayerId);
      if (result.paired && player) {
        toast.success(`${player.name} + ${result.partnerName} added to schedule — first game in ~${result.estimatedMinutes || 7} minutes`);
      } else if (player) {
        toast.info(`${player.name} added as late player — waiting for a same-tier partner`);
      }
    }
    setVipDialogFor(null);
    setLateVipPlayerId(null);
  };

  const handleVipConfirm = (teammateName: string | null) => {
    if (vipDialogFor) {
      vipsDismissedRef.current.add(vipDialogFor.toLowerCase());

      if (lateVipPlayerId && sessionActive) {
        // Late VIP — use handleLateCheckIn with fixed partner
        const player = state.roster.find((p) => p.id === lateVipPlayerId);
        const result = handleLateCheckIn(lateVipPlayerId, teammateName || undefined);
        if (result.paired && player) {
          toast.success(`${player.name} + ${result.partnerName} added to schedule — first game in ~${result.estimatedMinutes || 7} minutes`);
        } else if (player) {
          toast.info(`${player.name} added as late player — waiting for a same-tier partner`);
        }
        setLateVipPlayerId(null);
      } else if (teammateName) {
        // Pre-session VIP
        setVipFixedPairs((prev) => [
          ...prev.filter((fp) => fp.player1Name.toLowerCase() !== vipDialogFor!.toLowerCase()),
          { player1Name: vipDialogFor!, player2Name: teammateName },
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

  // Filter VIP partner selection to same-tier players only, excluding already-claimed partners
  const vipPlayer = vipDialogFor ? state.roster.find((p) => p.name.toLowerCase() === vipDialogFor.toLowerCase()) : null;
  const claimedPartners = new Set(
    vipFixedPairs
      .filter((fp) => fp.player1Name.toLowerCase() !== (vipDialogFor || "").toLowerCase())
      .map((fp) => fp.player2Name.toLowerCase())
  );
  // Also exclude other VIPs who already have a partner locked (they shouldn't be selectable)
  const vipsWithPartners = new Set(
    vipFixedPairs.map((fp) => fp.player1Name.toLowerCase())
  );
  const availableForVip = vipDialogFor && vipPlayer
    ? state.roster
        .filter((p) => {
          if (p.name.toLowerCase() === vipDialogFor.toLowerCase()) return false;
          if (p.skillLevel !== vipPlayer.skillLevel) return false;
          // Don't show players already claimed by another VIP
          if (claimedPartners.has(p.name.toLowerCase())) return false;
          // Don't show other VIPs who already have a locked partner
          if (vipsWithPartners.has(p.name.toLowerCase())) return false;
          // If session is active, only show unpaired or waitlisted players
          if (sessionActive) {
            const isPaired = state.pairs.some(
              (pair) => pair.player1.id === p.id || pair.player2.id === p.id
            );
            const isWaitlisted = (state.waitlistedPlayers || []).includes(p.id);
            return !isPaired || isWaitlisted;
          }
          return true;
        })
        .map((p) => p.name)
    : [];

  // Detect odd player counts per tier
  const oddTiers = useMemo(() => {
    const tiers: SkillTier[] = ["A", "B", "C"];
    const result: { tier: SkillTier; players: typeof checkedInPlayers }[] = [];
    for (const tier of tiers) {
      const tierPlayers = checkedInPlayers.filter((p) => p.skillLevel === tier);
      if (tierPlayers.length > 0 && tierPlayers.length % 2 !== 0) {
        result.push({ tier, players: tierPlayers });
      }
    }
    return result;
  }, [checkedInPlayers]);

  const adjacentTiers: Record<SkillTier, SkillTier | null> = { A: "B", B: "A", C: "B" };

  const handleOddPlayerDecisions = (decisions: OddPlayerDecision[]) => {
    setOddPlayerDecisions(decisions);
  };

  // Pending check-ins by tier (players in roster but not checked in)
  const pendingByTier = useMemo(() => {
    const unchecked = state.roster.filter((p) => !p.checkedIn);
    const a = unchecked.filter((p) => p.skillLevel === "A").length;
    const b = unchecked.filter((p) => p.skillLevel === "B").length;
    const c = unchecked.filter((p) => p.skillLevel === "C").length;
    return { a, b, c, total: a + b + c };
  }, [state.roster]);

  // Waitlisted players
  const waitlistedPlayers = useMemo(() => {
    return (state.waitlistedPlayers || [])
      .map((id) => state.roster.find((p) => p.id === id))
      .filter(Boolean);
  }, [state.waitlistedPlayers, state.roster]);

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

      {/* Pending check-ins indicator (admin only, session active) */}
      {isAdmin && sessionActive && pendingByTier.total > 0 && (
        <div className="rounded-lg border border-accent/30 bg-accent/5 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-accent" />
            <span className="text-base text-foreground font-display">Pending Check-ins</span>
          </div>
          <div className="flex items-center gap-3">
            {pendingByTier.a > 0 && <span className="text-sm bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">{pendingByTier.a} A</span>}
            {pendingByTier.b > 0 && <span className="text-sm bg-gray-400/20 text-gray-300 px-2 py-1 rounded">{pendingByTier.b} B</span>}
            {pendingByTier.c > 0 && <span className="text-sm bg-orange-500/20 text-orange-400 px-2 py-1 rounded">{pendingByTier.c} C</span>}
          </div>
        </div>
      )}

      {/* Waitlisted players indicator */}
      {sessionActive && waitlistedPlayers.length > 0 && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <span className="text-base text-foreground font-display">Waitlisted</span>
          </div>
          <div className="flex items-center gap-2">
            {waitlistedPlayers.map((p) => (
              <span key={p!.id} className="text-sm bg-primary/20 text-primary px-3 py-1 rounded">
                {p!.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Close check-in toggle (admin, session active) */}
      {isAdmin && sessionActive && (
        <div className="rounded-lg border border-border bg-card p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ban className="w-5 h-5 text-muted-foreground" />
            <span className="text-base text-foreground">Close Check-in</span>
            <span className="text-sm text-muted-foreground">— Stop accepting new players</span>
          </div>
          <Switch
            checked={!!checkInClosed}
            onCheckedChange={(checked) => closeCheckIn(checked)}
          />
        </div>
      )}

      {isLocked && !isAdmin && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center">
          <p className="text-base text-destructive">Check-in is closed.</p>
        </div>
      )}

      {checkInClosed && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center">
          <p className="text-base text-destructive">Check-in is closed — no more players can be added.</p>
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
              disabled={(isLocked && !isAdmin) || (checkInClosed && !player.checkedIn)}
              className={`
                relative rounded-lg border-2 p-6 text-center transition-all duration-300 min-h-[100px]
                ${(isLocked && !isAdmin) || (checkInClosed && !player.checkedIn) ? "cursor-not-allowed" : "active:scale-95"}
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

      {/* Odd tier warning */}
      {isAdmin && oddTiers.length > 0 && state.matches.length === 0 && state.sessionStarted && !state.sessionConfig.dynamicMode && (
        <OddPlayerAlert
          oddTiers={oddTiers}
          onDecisionsConfirmed={handleOddPlayerDecisions}
          adjacentTiers={adjacentTiers}
        />
      )}

      {/* Pair editor — shown after schedule generation, admin only */}
      {isAdmin && state.pairs.length > 0 && (
        <PairEditor
          pairs={state.pairs}
          waitlistedPlayers={state.roster.filter(
            (p) => p.checkedIn && (state.waitlistedPlayers || []).includes(p.id)
          )}
          onSwapPlayers={swapPlayersInPairs}
          onSwapWaitlistPlayer={swapWaitlistPlayer}
          isAdmin={isAdmin}
          sessionStarted={state.sessionStarted}
          hasCompletedGames={state.matches.some((m) => m.status === "completed")}
          onLockPairs={lockPairs}
          pairsLocked={state.pairsLocked}
        />
      )}

      {state.sessionStarted && state.sessionConfig.dynamicMode && !sessionActive && checkedInPlayers.length < 4 && (
        <div className="sticky bottom-4 rounded-lg border border-accent/30 bg-card/95 backdrop-blur-sm p-5 flex items-center justify-between gap-4 shadow-lg">
          <p className="text-accent text-base">
            ✦ Dynamic mode — {4 - checkedInPlayers.length} more player{4 - checkedInPlayers.length !== 1 ? "s" : ""} needed to auto-start
          </p>
          <Button onClick={handleGenerateWithPasscode} disabled={checkedInPlayers.length < 4} className="bg-accent text-accent-foreground hover:bg-accent/80 shrink-0 min-h-[48px] px-6 text-base">
            {!isAdmin && <Lock className="w-4 h-4 mr-2" />}
            <Swords className="w-5 h-5 mr-2" /> Force Generate
          </Button>
        </div>
      )}
      {state.sessionStarted && checkedInPlayers.length >= 4 && (
        <div className="sticky bottom-4 rounded-lg border border-accent/30 bg-card/95 backdrop-blur-sm p-5 flex items-center justify-between gap-4 shadow-lg">
          <p className="text-accent text-base">
            {state.sessionConfig.dynamicMode && state.matches.length > 0
              ? "✦ Dynamic mode — new players auto-added"
              : `✦ ${checkedInPlayers.length} players ready${state.matches.length > 0 ? " — schedule generated!" : ""}`}
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