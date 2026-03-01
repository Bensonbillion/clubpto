import { useState } from "react";
import { AlertTriangle, UserMinus, ArrowRightLeft, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SkillTier, OddPlayerDecision, Player } from "@/types/courtManager";

interface OddTier {
  tier: SkillTier;
  players: Player[];
}

interface OddPlayerAlertProps {
  oddTiers: OddTier[];
  onDecisionsConfirmed: (decisions: OddPlayerDecision[]) => void;
  adjacentTiers: Record<SkillTier, SkillTier | null>;
}

const TIER_LABELS: Record<SkillTier, string> = { A: "A", B: "B", C: "C" };
const TIER_COLORS: Record<SkillTier, string> = {
  A: "text-yellow-400 border-yellow-500/40",
  B: "text-gray-300 border-gray-300/40",
  C: "text-amber-600 border-amber-700/40",
};

const OddPlayerAlert = ({ oddTiers, onDecisionsConfirmed, adjacentTiers }: OddPlayerAlertProps) => {
  // Track which player the admin selected as the odd one out per tier
  const [selectedPlayers, setSelectedPlayers] = useState<Record<SkillTier, string>>(() => {
    const init: Record<string, string> = {};
    oddTiers.forEach((ot) => {
      // Default to last player but admin can change
      init[ot.tier] = ot.players[ot.players.length - 1].id;
    });
    return init as Record<SkillTier, string>;
  });

  const [decisions, setDecisions] = useState<Record<string, OddPlayerDecision>>(() => {
    const init: Record<string, OddPlayerDecision> = {};
    oddTiers.forEach((ot) => {
      const oddPlayer = ot.players[ot.players.length - 1];
      init[ot.tier] = {
        playerId: oddPlayer.id,
        playerName: oddPlayer.name,
        tier: ot.tier,
        decision: "waiting",
      };
    });
    return init;
  });

  const selectOddPlayer = (tier: SkillTier, playerId: string) => {
    const ot = oddTiers.find((o) => o.tier === tier);
    if (!ot) return;
    const player = ot.players.find((p) => p.id === playerId);
    if (!player) return;
    setSelectedPlayers((prev) => ({ ...prev, [tier]: playerId }));
    setDecisions((prev) => ({
      ...prev,
      [tier]: {
        ...prev[tier],
        playerId: player.id,
        playerName: player.name,
      },
    }));
  };

  const setDecision = (tier: SkillTier, decision: OddPlayerDecision["decision"], crossPairTier?: SkillTier) => {
    setDecisions((prev) => ({
      ...prev,
      [tier]: { ...prev[tier], decision, crossPairTier },
    }));
  };

  const handleConfirm = () => {
    onDecisionsConfirmed(Object.values(decisions));
  };

  return (
    <div className="rounded-lg border-2 border-yellow-500/40 bg-yellow-500/5 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-5 h-5 text-yellow-400" />
        <h4 className="font-display text-lg text-yellow-400">Uneven Tier Check-ins</h4>
      </div>
      <p className="text-sm text-muted-foreground">
        Some tiers have an odd number of players. Select which player sits out and choose how to handle them:
      </p>

      <div className="space-y-4">
        {oddTiers.map((ot) => {
          const d = decisions[ot.tier];
          const adj = adjacentTiers[ot.tier];
          const selectedId = selectedPlayers[ot.tier];
          return (
            <div key={ot.tier} className="rounded-md border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className={`text-xs uppercase tracking-widest ${TIER_COLORS[ot.tier].split(" ")[0]}`}>
                    Tier {TIER_LABELS[ot.tier]}
                  </span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {ot.players.length} players (odd)
                  </span>
                </div>
              </div>

              {/* Player selection - admin picks who sits out */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Select player to sit out:</p>
                <div className="flex flex-wrap gap-2">
                  {ot.players.map((player) => (
                    <Button
                      key={player.id}
                      variant={selectedId === player.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => selectOddPlayer(ot.tier, player.id)}
                      className={`min-h-[44px] ${
                        selectedId === player.id
                          ? "bg-accent text-accent-foreground"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {player.name}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Decision buttons for the selected player */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  Action for <span className="font-display text-foreground">{d?.playerName}</span>:
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={d?.decision === "sit_out" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDecision(ot.tier, "sit_out")}
                    className={`min-h-[40px] ${d?.decision === "sit_out" ? "bg-accent text-accent-foreground" : "border-border text-muted-foreground"}`}
                  >
                    <UserMinus className="w-4 h-4 mr-1.5" /> Sit Out
                  </Button>
                  {adj && (
                    <Button
                      variant={d?.decision === "cross_pair" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setDecision(ot.tier, "cross_pair", adj)}
                      className={`min-h-[40px] ${d?.decision === "cross_pair" ? "bg-accent text-accent-foreground" : "border-border text-muted-foreground"}`}
                    >
                      <ArrowRightLeft className="w-4 h-4 mr-1.5" /> Cross-pair with Tier {TIER_LABELS[adj]}
                    </Button>
                  )}
                  <Button
                    variant={d?.decision === "waiting" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDecision(ot.tier, "waiting")}
                    className={`min-h-[40px] ${d?.decision === "waiting" ? "bg-accent text-accent-foreground" : "border-border text-muted-foreground"}`}
                  >
                    <Clock className="w-4 h-4 mr-1.5" /> Wait for Late Arrival
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Button onClick={handleConfirm} className="bg-accent text-accent-foreground hover:bg-accent/80 min-h-[44px] px-6">
        Confirm Decisions
      </Button>
    </div>
  );
};

export default OddPlayerAlert;
