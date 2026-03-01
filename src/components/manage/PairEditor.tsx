import { useState } from "react";
import { Pair, SkillTier, Player } from "@/types/courtManager";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft, Check, X, Edit3 } from "lucide-react";

interface PairEditorProps {
  pairs: Pair[];
  onSwapPlayers: (pairAId: string, playerAId: string, pairBId: string, playerBId: string) => void;
  isAdmin: boolean;
}

const TIER_COLORS: Record<SkillTier, { border: string; text: string; bg: string }> = {
  A: { border: "border-yellow-500/40", text: "text-yellow-400", bg: "bg-yellow-500/10" },
  B: { border: "border-gray-300/40", text: "text-gray-300", bg: "bg-gray-300/10" },
  C: { border: "border-amber-700/40", text: "text-amber-600", bg: "bg-amber-700/10" },
};

const PairEditor = ({ pairs, onSwapPlayers, isAdmin }: PairEditorProps) => {
  const [editing, setEditing] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<{ pairId: string; playerId: string; playerName: string; tier: SkillTier } | null>(null);

  if (!isAdmin || pairs.length === 0) return null;

  const handlePlayerClick = (pairId: string, player: Player, tier: SkillTier) => {
    if (!editing) return;

    if (!selectedPlayer) {
      setSelectedPlayer({ pairId, playerId: player.id, playerName: player.name, tier });
      return;
    }

    // Same player — deselect
    if (selectedPlayer.playerId === player.id) {
      setSelectedPlayer(null);
      return;
    }

    // Different tier — can't swap
    if (selectedPlayer.tier !== tier) {
      setSelectedPlayer(null);
      return;
    }

    // Same pair — can't swap within same pair
    if (selectedPlayer.pairId === pairId) {
      setSelectedPlayer({ pairId, playerId: player.id, playerName: player.name, tier });
      return;
    }

    // Execute swap
    onSwapPlayers(selectedPlayer.pairId, selectedPlayer.playerId, pairId, player.id);
    setSelectedPlayer(null);
  };

  const tierGroups = (["A", "B", "C"] as SkillTier[]).map((tier) => ({
    tier,
    pairs: pairs.filter((p) => p.skillLevel === tier),
  })).filter((g) => g.pairs.length > 0);

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-display text-lg text-accent flex items-center gap-2">
          <Edit3 className="w-4 h-4" /> Edit Pairs
        </h4>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setEditing(!editing); setSelectedPlayer(null); }}
          className={`min-h-[40px] ${editing ? "border-accent text-accent bg-accent/10" : "border-border text-muted-foreground"}`}
        >
          {editing ? <><Check className="w-4 h-4 mr-1.5" /> Done</> : <><ArrowRightLeft className="w-4 h-4 mr-1.5" /> Swap Players</>}
        </Button>
      </div>

      {editing && (
        <p className="text-sm text-muted-foreground">
          {selectedPlayer
            ? `Selected ${selectedPlayer.playerName}. Tap another Tier ${selectedPlayer.tier} player to swap.`
            : "Tap a player, then tap another player in the same tier to swap them between pairs."}
        </p>
      )}

      {tierGroups.map(({ tier, pairs: tierPairs }) => {
        const colors = TIER_COLORS[tier];
        return (
          <div key={tier} className="space-y-2">
            <p className={`text-xs uppercase tracking-widest ${colors.text}`}>Tier {tier}</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {tierPairs.map((pair) => (
                <div key={pair.id} className={`rounded-md border ${colors.border} ${colors.bg} p-3 space-y-1`}>
                  {[pair.player1, pair.player2].map((player) => {
                    const isSelected = selectedPlayer?.playerId === player.id;
                    const isSwappable = editing && selectedPlayer && selectedPlayer.tier === tier && selectedPlayer.pairId !== pair.id;
                    return (
                      <button
                        key={player.id}
                        onClick={() => handlePlayerClick(pair.id, player, tier)}
                        disabled={!editing}
                        className={`w-full text-left px-2 py-1.5 rounded transition-all text-sm font-display ${
                          isSelected
                            ? "bg-accent text-accent-foreground ring-2 ring-accent"
                            : isSwappable
                            ? "hover:bg-accent/20 hover:text-accent cursor-pointer"
                            : editing
                            ? "hover:bg-muted cursor-pointer text-foreground"
                            : "text-foreground cursor-default"
                        }`}
                      >
                        {player.name}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PairEditor;
