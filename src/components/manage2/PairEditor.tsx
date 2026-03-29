/**
 * PairEditor for Open Mode — same as original but CROSS-TIER SWAPS ALLOWED.
 * Any player can swap to any pair regardless of tier.
 */
import { useState } from "react";
import { Pair, SkillTier, Player } from "@/types/courtManager";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft, Check, Edit3, Lock, Unlock, UserPlus, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface PairEditorProps {
  pairs: Pair[];
  waitlistedPlayers?: Player[];
  onSwapPlayers: (pairAId: string, playerAId: string, pairBId: string, playerBId: string) => void;
  onSwapWaitlistPlayer?: (pairId: string, displacedPlayerId: string, waitlistPlayer: Player) => void;
  isAdmin: boolean;
  sessionStarted?: boolean;
  hasCompletedGames?: boolean;
  onLockPairs?: () => void;
  pairsLocked?: boolean;
}

const TIER_COLORS: Record<SkillTier, { border: string; text: string; bg: string }> = {
  A: { border: "border-yellow-500/40", text: "text-yellow-400", bg: "bg-yellow-500/10" },
  B: { border: "border-gray-300/40", text: "text-gray-300", bg: "bg-gray-300/10" },
  C: { border: "border-amber-700/40", text: "text-amber-600", bg: "bg-amber-700/10" },
};

type Selection = {
  type: "pair";
  pairId: string;
  playerId: string;
  playerName: string;
  tier: SkillTier;
} | {
  type: "waitlist";
  player: Player;
  tier: SkillTier;
};

const PairEditor = ({
  pairs,
  waitlistedPlayers = [],
  onSwapPlayers,
  onSwapWaitlistPlayer,
  isAdmin,
  sessionStarted = false,
  hasCompletedGames = false,
  onLockPairs,
  pairsLocked = false,
}: PairEditorProps) => {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [showLockConfirm, setShowLockConfirm] = useState(false);

  if (!isAdmin || pairs.length === 0) return null;

  const handleEnterEdit = () => {
    if (pairsLocked && hasCompletedGames) {
      setShowLockConfirm(true);
      return;
    }
    setEditing(true);
    setSelected(null);
  };

  const handleConfirmEdit = () => {
    setShowLockConfirm(false);
    setEditing(true);
    setSelected(null);
  };

  const handlePlayerClick = (pairId: string, player: Player, tier: SkillTier) => {
    if (!editing) return;

    if (!selected) {
      setSelected({ type: "pair", pairId, playerId: player.id, playerName: player.name, tier });
      return;
    }

    // Deselect same player
    if (selected.type === "pair" && selected.playerId === player.id) {
      setSelected(null);
      return;
    }

    // Waitlist player selected first → swap into this pair slot
    // Open mode: cross-tier allowed
    if (selected.type === "waitlist") {
      onSwapWaitlistPlayer?.(pairId, player.id, selected.player);
      toast.success(`Swapped ${player.name} → late players, ${selected.player.name} → pair`);
      setSelected(null);
      return;
    }

    // Same pair → reselect
    if (selected.pairId === pairId) {
      setSelected({ type: "pair", pairId, playerId: player.id, playerName: player.name, tier });
      return;
    }

    // Open mode: cross-tier swaps ALLOWED — no tier check
    onSwapPlayers(selected.pairId, selected.playerId, pairId, player.id);
    toast.success(`Swapped ${selected.playerName} ↔ ${player.name}`);
    setSelected(null);
  };

  const handleWaitlistClick = (player: Player) => {
    if (!editing) return;

    if (selected?.type === "waitlist" && selected.player.id === player.id) {
      setSelected(null);
      return;
    }

    // If a paired player is selected, swap them with this waitlisted player
    // Open mode: cross-tier allowed
    if (selected?.type === "pair") {
      const pairedPlayer = pairs
        .flatMap((p) => [{ pair: p, player: p.player1 }, { pair: p, player: p.player2 }])
        .find((x) => x.player.id === selected.playerId);
      if (pairedPlayer) {
        onSwapWaitlistPlayer?.(pairedPlayer.pair.id, selected.playerId, player);
        toast.success(`Swapped ${selected.playerName} → waitlist, ${player.name} → pair`);
      }
      setSelected(null);
      return;
    }

    setSelected({ type: "waitlist", player, tier: player.skillLevel });
  };

  const isPlayerSelected = (id: string) =>
    (selected?.type === "pair" && selected.playerId === id) ||
    (selected?.type === "waitlist" && selected.player.id === id);

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h4 className="font-display text-lg text-accent flex items-center gap-2">
          <Edit3 className="w-4 h-4" /> Edit Pairs
        </h4>
        <div className="flex items-center gap-2">
          {onLockPairs && !editing && (
            <Button
              variant="outline"
              size="sm"
              onClick={onLockPairs}
              className={`min-h-[44px] ${pairsLocked ? "border-accent/40 text-accent" : "border-border text-muted-foreground"}`}
            >
              {pairsLocked ? <><Lock className="w-4 h-4 mr-1.5" /> Locked</> : <><Unlock className="w-4 h-4 mr-1.5" /> Lock Pairs</>}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (editing) {
                setEditing(false);
                setSelected(null);
              } else {
                handleEnterEdit();
              }
            }}
            className={`min-h-[44px] ${editing ? "border-accent text-accent bg-accent/10" : "border-border text-muted-foreground"}`}
          >
            {editing
              ? <><Check className="w-4 h-4 mr-1.5" /> Done</>
              : <><ArrowRightLeft className="w-4 h-4 mr-1.5" /> Swap Players</>
            }
          </Button>
        </div>
      </div>

      {/* Lock confirmation dialog */}
      {showLockConfirm && (
        <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-display text-yellow-400">Pairs are locked</p>
              <p className="text-sm text-muted-foreground mt-1">
                Editing pairs will regenerate remaining games. Completed results will be preserved. Continue?
              </p>
            </div>
          </div>
          <div className="flex gap-2 ml-8">
            <Button size="sm" onClick={handleConfirmEdit} className="bg-accent text-accent-foreground hover:bg-accent/80 min-h-[40px]">
              Yes, Edit Pairs
            </Button>
            <Button size="sm" variant="outline" onClick={() => setShowLockConfirm(false)} className="min-h-[40px]">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Instructions */}
      {editing && (
        <p className="text-sm text-muted-foreground">
          {selected
            ? selected.type === "pair"
              ? `Selected ${selected.playerName}. Tap any other player to swap. Cross-tier swaps are allowed in Open mode.`
              : `Selected ${selected.player.name} (waitlist). Tap any player in a pair to replace them.`
            : "Tap a player, then tap another player to swap them between pairs. Any tier combination is allowed."}
        </p>
      )}

      {/* All pairs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {pairs.map((pair) => {
          const colors = TIER_COLORS[pair.skillLevel];
          return (
            <div key={pair.id} className={`rounded-md border ${colors.border} ${colors.bg} p-3 space-y-1`}>
              {[pair.player1, pair.player2].map((player) => {
                const isSel = isPlayerSelected(player.id);
                const isSwappable = editing && selected && selected.type === "pair" && selected.pairId !== pair.id;
                return (
                  <button
                    key={player.id}
                    onClick={() => handlePlayerClick(pair.id, player, pair.skillLevel)}
                    disabled={!editing}
                    className={`w-full text-left px-2 py-1.5 rounded transition-all text-sm font-display min-h-[36px] ${
                      isSel
                        ? "bg-accent text-accent-foreground ring-2 ring-accent"
                        : isSwappable
                        ? "hover:bg-accent/20 hover:text-accent cursor-pointer"
                        : editing
                        ? "hover:bg-muted cursor-pointer text-foreground"
                        : "text-foreground cursor-default"
                    }`}
                  >
                    <span>{player.name}</span>
                    {" "}
                    <span className={`text-xs ${colors.text}`}>{player.skillLevel}</span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Late Players / Waitlist */}
      {editing && waitlistedPlayers.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-border">
          <p className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <UserPlus className="w-3.5 h-3.5" /> Late Players
          </p>
          <div className="flex flex-wrap gap-2">
            {waitlistedPlayers.map((player) => {
              const colors = TIER_COLORS[player.skillLevel];
              const isSel = isPlayerSelected(player.id);
              return (
                <button
                  key={player.id}
                  onClick={() => handleWaitlistClick(player)}
                  className={`px-3 py-2 rounded-md border text-sm font-display min-h-[44px] transition-all ${
                    isSel
                      ? "bg-accent text-accent-foreground ring-2 ring-accent border-accent"
                      : `${colors.border} ${colors.bg} ${colors.text} hover:bg-accent/20 hover:text-accent cursor-pointer`
                  }`}
                >
                  {player.name} <span className="text-xs opacity-60">{player.skillLevel}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default PairEditor;
