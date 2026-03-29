/**
 * CheckIn for Open Mode (/manage2).
 *
 * Key differences from original:
 * - Court mode selector shows [1 COURT] [2 COURTS] instead of [2] [3]
 * - Session name text input (freeform, optional)
 * - VIP dialog shows ALL checked-in players (not tier-filtered)
 * - Cross-tier pairing allowed (hook handles this, UI just shows results)
 * - Tier badges displayed next to player names (reference only)
 * - No odd-player tier decisions (odd player simply becomes sub/waitlist)
 * - Balance warnings: flag <3 or >8 pairs per court, flag odd player
 * - Passcode: 7777
 */
import { useState, useRef, useMemo } from "react";
import { useOpenGameState } from "@/hooks/useOpenGameState";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Check, Clock, Swords, Lock, Unlock, UserPlus, X, Users, AlertTriangle, UserCheck, Ban } from "lucide-react";
import VipPairingDialog, { isVipPlayer } from "@/components/manage/VipPairingDialog";
import PairEditor from "./PairEditor";
import { FixedPair } from "@/types/courtManager";
import { toast } from "sonner";

interface CheckInProps {
  gameState: ReturnType<typeof useOpenGameState>;
  onSwitchToCourtDisplay?: () => void;
  isAdmin?: boolean;
}

const ADMIN_PASSCODE = "7777";

const TIER_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  A: { bg: "bg-yellow-500/20", text: "text-yellow-400", label: "A" },
  B: { bg: "bg-gray-300/20", text: "text-gray-300", label: "B" },
  C: { bg: "bg-amber-700/20", text: "text-amber-600", label: "C" },
};

const CheckIn = ({ gameState, onSwitchToCourtDisplay, isAdmin = false }: CheckInProps) => {
  const {
    state, toggleCheckIn, toggleCoach, checkedInPlayers, generateFullSchedule,
    addLatePlayersToSchedule, handleLateCheckIn, closeCheckIn, lockCheckIn,
    startSession, swapPlayersInPairs, swapWaitlistPlayer, lockPairs, setSessionConfig,
  } = gameState;

  const [generated, setGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [vipDialogFor, setVipDialogFor] = useState<string | null>(null);
  const [vipFixedPairs, setVipFixedPairs] = useState<FixedPair[]>([]);
  const vipsDismissedRef = useRef<Set<string>>(new Set());
  const [showPasscodeModal, setShowPasscodeModal] = useState(false);
  const [passcodeInput, setPasscodeInput] = useState("");
  const [passcodeError, setPasscodeError] = useState(false);
  const [lateVipPlayerId, setLateVipPlayerId] = useState<string | null>(null);

  const sessionActive = state.matches.length > 0 || (state.courts || []).length > 0;
  const checkInClosed = state.sessionConfig.checkInClosed;
  const courtCount = (state.sessionConfig.courtCount as 1 | 2) || 2;
  const sessionName = (state.sessionConfig as { sessionName?: string }).sessionName || "";

  const formatTime = (iso: string | null) => {
    if (!iso) return "";
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const handleCheckIn = (playerId: string) => {
    const player = state.roster.find((p) => p.id === playerId);
    if (!player) return;

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

    toggleCheckIn(playerId);

    // If session is already active, handle late arrival flow
    if (sessionActive) {
      if (isVipPlayer(player.name, player.profileId) && !vipsDismissedRef.current.has(player.name.toLowerCase())) {
        setLateVipPlayerId(playerId);
        setTimeout(() => setVipDialogFor(player.name), 100);
      } else {
        setTimeout(() => {
          const result = handleLateCheckIn(playerId);
          if (result.paired) {
            toast.success(`${player.name} + ${result.partnerName} added to schedule — first game in ~${result.estimatedMinutes || 7} minutes`);
          } else {
            toast.info(`${player.name} added as late player — waiting for a partner`);
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
    if (lateVipPlayerId && sessionActive) {
      const player = state.roster.find((p) => p.id === lateVipPlayerId);
      const result = handleLateCheckIn(lateVipPlayerId);
      if (result.paired && player) {
        toast.success(`${player.name} + ${result.partnerName} added to schedule`);
      } else if (player) {
        toast.info(`${player.name} added as late player — waiting for a partner`);
      }
    }
    setVipDialogFor(null);
    setLateVipPlayerId(null);
  };

  const handleVipConfirm = (teammateName: string | null) => {
    if (vipDialogFor) {
      vipsDismissedRef.current.add(vipDialogFor.toLowerCase());

      if (lateVipPlayerId && sessionActive) {
        const player = state.roster.find((p) => p.id === lateVipPlayerId);
        const result = handleLateCheckIn(lateVipPlayerId, teammateName || undefined);
        if (result.paired && player) {
          toast.success(`${player.name} + ${result.partnerName} added to schedule`);
        } else if (player) {
          toast.info(`${player.name} added as late player — waiting for a partner`);
        }
        setLateVipPlayerId(null);
      } else if (teammateName) {
        setVipFixedPairs((prev) => [
          ...prev.filter((fp) => fp.player1Name.toLowerCase() !== vipDialogFor!.toLowerCase()),
          { player1Name: vipDialogFor!, player2Name: teammateName },
        ]);
      }
    }
    setVipDialogFor(null);
  };

  const handleGenerateClick = async () => {
    setGenerating(true);
    try {
      await generateFullSchedule(vipFixedPairs);
      setGenerated(true);
      onSwitchToCourtDisplay?.();
    } catch (err) {
      console.error("[PTO OPEN] Generate failed:", err);
      toast.error("Failed to generate schedule — try again");
    } finally {
      setGenerating(false);
    }
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

  // VIP partner dialog — show ALL checked-in players (not tier-filtered) in open mode
  const vipPlayer = vipDialogFor ? state.roster.find((p) => p.name.toLowerCase() === vipDialogFor.toLowerCase()) : null;
  const claimedPartners = new Set(
    vipFixedPairs
      .filter((fp) => fp.player1Name.toLowerCase() !== (vipDialogFor || "").toLowerCase())
      .map((fp) => fp.player2Name.toLowerCase())
  );
  const vipsWithPartners = new Set(vipFixedPairs.map((fp) => fp.player1Name.toLowerCase()));
  const availableForVip = vipDialogFor
    ? state.roster
        .filter((p) => {
          if (p.name.toLowerCase() === (vipDialogFor || "").toLowerCase()) return false;
          if (claimedPartners.has(p.name.toLowerCase())) return false;
          if (vipsWithPartners.has(p.name.toLowerCase())) return false;
          // Open mode: no tier restriction
          if (sessionActive) {
            const isPaired = state.pairs.some((pair) => pair.player1.id === p.id || pair.player2.id === p.id);
            const isWaitlisted = (state.waitlistedPlayers || []).includes(p.id);
            return !isPaired || isWaitlisted;
          }
          return true;
        })
        .map((p) => p.name)
    : [];

  // Balance warnings
  const balanceWarnings = useMemo(() => {
    const warnings: string[] = [];
    if (state.pairs.length > 0) {
      const cc = courtCount;
      const pairsPerCourt = Math.ceil(state.pairs.length / cc);
      if (pairsPerCourt < 3) warnings.push(`Only ${pairsPerCourt} pair${pairsPerCourt !== 1 ? "s" : ""} per court — consider fewer courts or more players`);
      if (pairsPerCourt > 8) warnings.push(`${pairsPerCourt} pairs per court — consider adding a court`);
    }
    const waitlisted = (state.waitlistedPlayers || []).length;
    if (waitlisted > 0) warnings.push(`${waitlisted} player${waitlisted !== 1 ? "s" : ""} on waitlist — needs a partner`);
    return warnings;
  }, [state.pairs.length, courtCount, state.waitlistedPlayers]);

  // Waitlisted players
  const waitlistedPlayers = useMemo(() => {
    return (state.waitlistedPlayers || [])
      .map((id) => state.roster.find((p) => p.id === id))
      .filter(Boolean);
  }, [state.waitlistedPlayers, state.roster]);

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="font-display text-2xl text-accent">Player Check-In</h3>
        <div className="flex items-center gap-4">
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

      {/* Session config — court count + session name */}
      {isAdmin && !sessionActive && (
        <div className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h4 className="font-display text-base text-accent">Session Setup</h4>

          {/* Session name */}
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Session Name (optional)</label>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionConfig({ sessionName: e.target.value } as Parameters<typeof setSessionConfig>[0])}
              placeholder="e.g. Tuesday Night Open"
              className="w-full rounded-md border border-border bg-muted/30 px-4 py-3 text-base text-foreground focus:border-accent focus:outline-none"
            />
          </div>

          {/* Court count selector */}
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Court Mode</label>
            <div className="flex gap-2">
              {([1, 2] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => setSessionConfig({ courtCount: n })}
                  className={`flex-1 px-4 py-3 rounded-md border text-base font-display transition-all ${
                    courtCount === n
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-muted-foreground hover:border-accent/40"
                  }`}
                >
                  {n} {n === 1 ? "COURT" : "COURTS"}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-widest text-muted-foreground">Session Duration (minutes)</label>
            <input
              type="number"
              value={state.sessionConfig.durationMinutes}
              onChange={(e) => setSessionConfig({ durationMinutes: Number(e.target.value) })}
              min={30}
              max={180}
              className="w-full rounded-md border border-border bg-muted/30 px-4 py-3 text-base text-foreground focus:border-accent focus:outline-none"
            />
          </div>
        </div>
      )}

      {/* Waitlisted players */}
      {sessionActive && waitlistedPlayers.length > 0 && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <span className="text-base text-foreground font-display">Waitlisted</span>
          </div>
          <div className="flex items-center gap-2">
            {waitlistedPlayers.map((p) => (
              <span key={p!.id} className="text-sm bg-primary/20 text-primary px-3 py-1 rounded">
                {p!.name} <span className="opacity-60 text-xs">{p!.skillLevel}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Close check-in toggle */}
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

      {/* Balance warnings */}
      {balanceWarnings.length > 0 && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-1">
          {balanceWarnings.map((w, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-yellow-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {w}
            </div>
          ))}
        </div>
      )}

      {state.roster.length === 0 ? (
        <p className="text-muted-foreground text-center text-lg py-12">No players have been added yet.</p>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {sortedRoster.map((player) => {
            const badge = TIER_BADGE[player.skillLevel];
            return (
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
                {/* Coach toggle */}
                {isAdmin && (
                  <div
                    className={`absolute top-2.5 left-2.5 w-6 h-6 rounded-full flex items-center justify-center cursor-pointer transition-all ${
                      player.isCoach ? "bg-blue-500 text-white" : "bg-muted/50 text-muted-foreground opacity-40 hover:opacity-80"
                    }`}
                    onClick={(e) => { e.stopPropagation(); toggleCoach(player.id); }}
                    title={player.isCoach ? "Coach (3-slot gap)" : "Set as Coach"}
                  >
                    <span className="text-xs">🏃</span>
                  </div>
                )}
                <p className="font-display text-xl text-foreground">{player.name}</p>
                {/* Tier badge */}
                <span className={`inline-block mt-1.5 text-xs px-1.5 py-0.5 rounded ${badge.bg} ${badge.text} font-mono`}>
                  {badge.label}
                </span>
                {player.isCoach && <p className="text-xs text-blue-400 mt-0.5">Coach</p>}

                <div className="mt-2 text-sm text-muted-foreground flex items-center justify-center gap-1.5">
                  {player.checkedIn ? (
                    <>
                      <Clock className="w-3.5 h-3.5" /> {formatTime(player.checkInTime)}
                    </>
                  ) : (
                    "Tap to check in"
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Pair editor — shown after schedule generation */}
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

      {/* Bottom action bar */}
      {state.sessionStarted && checkedInPlayers.length >= 4 && (
        <div className="sticky bottom-4 rounded-lg border border-accent/30 bg-card/95 backdrop-blur-sm p-5 flex items-center justify-between gap-4 shadow-lg">
          <p className="text-accent text-base">
            {sessionActive
              ? `✦ ${checkedInPlayers.length} players — session running`
              : `✦ ${checkedInPlayers.length} players ready`}
          </p>
          <div className="flex items-center gap-3">
            {isAdmin && sessionActive && (
              <Button
                onClick={() => { addLatePlayersToSchedule(); onSwitchToCourtDisplay?.(); }}
                variant="outline"
                className="border-accent text-accent hover:bg-accent/10 shrink-0 min-h-[48px] px-6 text-base"
              >
                <UserPlus className="w-5 h-5 mr-2" /> Add Late Players
              </Button>
            )}
            <Button
              onClick={handleGenerateWithPasscode}
              disabled={generating}
              className="bg-accent text-accent-foreground hover:bg-accent/80 shrink-0 min-h-[48px] px-6 text-base"
            >
              {!isAdmin && <Lock className="w-4 h-4 mr-2" />}
              <Swords className="w-5 h-5 mr-2" />
              {generating ? "Generating..." : sessionActive ? "Regenerate Games" : "Generate Games"}
            </Button>
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

      {!isAdmin && !state.sessionStarted && (
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <p className="text-base text-muted-foreground">Waiting for admin to start session.</p>
        </div>
      )}

      {/* Passcode modal */}
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
                    i < passcodeInput.length ? "bg-accent border-accent scale-110" : "border-muted-foreground/40"
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

      {/* VIP pairing dialog — available players not tier-filtered */}
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
