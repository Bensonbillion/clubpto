import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Users, Shuffle } from "lucide-react";
import { FixedPair } from "@/types/courtManager";


/** VIP profile IDs from Turso player database */
const VIP_PROFILE_IDS = new Set([
  "08813d60dccf0067907caf3727077d20", // David
  "040263dd01d6128b0df59406d4f9d9e0", // Benson
  "79acebd959da20272f79bfd96f8af281", // Albright
]);

export function isVipPlayer(name: string, profileId?: string): boolean {
  if (profileId) return VIP_PROFILE_IDS.has(profileId);
  return false;
}

interface VipPairingDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called with the chosen teammate name, or null for randomize */
  onConfirm: (teammateName: string | null) => void;
  /** The VIP player who just checked in */
  vipName: string;
  /** All other currently checked-in players (excluding the VIP) */
  availablePlayers: string[];
}

const VipPairingDialog = ({ open, onClose, onConfirm, vipName, availablePlayers }: VipPairingDialogProps) => {
  const [selected, setSelected] = useState<string | null>(null);

  const handleConfirm = () => {
    onConfirm(selected);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-accent">
            {vipName}'s Teammate
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Pick a same-tier teammate for {vipName} or let the randomizer decide.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4 overflow-y-auto flex-1">
          {availablePlayers.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No other players checked in yet. You can randomize or check in more players first.
            </p>
          ) : (
            availablePlayers.map((name) => {
              const isSelected = selected === name;
              return (
                <button
                  key={name}
                  onClick={() => setSelected(isSelected ? null : name)}
                  className={`w-full rounded-lg border-2 p-3 text-left transition-all ${
                    isSelected
                      ? "border-accent bg-accent/10 shadow-md"
                      : "border-border bg-card hover:border-accent/40"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Users className="w-4 h-4 text-accent shrink-0" />
                    <p className="font-display text-lg text-foreground">{name}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            className="flex-1 border-accent text-accent hover:bg-accent/10"
            onClick={() => onConfirm(null)}
          >
            <Shuffle className="w-4 h-4 mr-2" /> Randomize
          </Button>
          <Button
            className="flex-1 bg-accent text-accent-foreground hover:bg-accent/80"
            onClick={handleConfirm}
            disabled={!selected}
          >
            Lock {selected ? `with ${selected}` : "Pair"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VipPairingDialog;
