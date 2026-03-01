import { useState } from "react";
import { AlertTriangle, UserMinus, ArrowRightLeft, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SkillTier, OddPlayerDecision, Player } from "@/types/courtManager";

interface OddTier {
  tier: SkillTier;
  players: Player[];
  oddPlayer: Player;
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
  const [decisions, setDecisions] = useState<Record<string, OddPlayerDecision>>(() => {
    const init: Record<string, OddPlayerDecision> = {};
    oddTiers.forEach((ot) => {
      init[ot.oddPlayer.id] = {
        playerId: ot.oddPlayer.id,
        playerName: ot.oddPlayer.name,
        tier: ot.tier,
        decision: "waiting",
      };
    });
    return init;
  });

  const setDecision = (playerId: string, decision: OddPlayerDecision["decision"], crossPairTier?: SkillTier) => {
    setDecisions((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], decision, crossPairTier },
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
        Some tiers have an odd number of players. Choose how to handle each extra player:
      </p>

      <div className="space-y-4">
        {oddTiers.map((ot) => {
          const d = decisions[ot.oddPlayer.id];
          const adj = adjacentTiers[ot.tier];
          return (
            <div key={ot.oddPlayer.id} className="rounded-md border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-display text-foreground text-base">{ot.oddPlayer.name}</span>
                  <span className={`ml-2 text-xs uppercase tracking-widest ${TIER_COLORS[ot.tier].split(" ")[0]}`}>
                    Tier {TIER_LABELS[ot.tier]}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {ot.players.length} players in tier (odd)
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={d?.decision === "sit_out" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDecision(ot.oddPlayer.id, "sit_out")}
                  className={`min-h-[40px] ${d?.decision === "sit_out" ? "bg-accent text-accent-foreground" : "border-border text-muted-foreground"}`}
                >
                  <UserMinus className="w-4 h-4 mr-1.5" /> Sit Out
                </Button>
                {adj && (
                  <Button
                    variant={d?.decision === "cross_pair" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDecision(ot.oddPlayer.id, "cross_pair", adj)}
                    className={`min-h-[40px] ${d?.decision === "cross_pair" ? "bg-accent text-accent-foreground" : "border-border text-muted-foreground"}`}
                  >
                    <ArrowRightLeft className="w-4 h-4 mr-1.5" /> Cross-pair with Tier {TIER_LABELS[adj]}
                  </Button>
                )}
                <Button
                  variant={d?.decision === "waiting" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDecision(ot.oddPlayer.id, "waiting")}
                  className={`min-h-[40px] ${d?.decision === "waiting" ? "bg-accent text-accent-foreground" : "border-border text-muted-foreground"}`}
                >
                  <Clock className="w-4 h-4 mr-1.5" /> Wait for Late Arrival
                </Button>
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
