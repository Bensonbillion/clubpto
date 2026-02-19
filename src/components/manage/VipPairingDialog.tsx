import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Users, Shuffle } from "lucide-react";
import { FixedPair } from "@/types/courtManager";

/** The 3 VIP names (case-insensitive matching) */
const VIP_NAMES = ["david", "benson", "albright"];

interface VipPairingDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (fixedPair: FixedPair | null) => void;
  vipNames: string[]; // actual cased names from roster
}

const VipPairingDialog = ({ open, onClose, onConfirm, vipNames }: VipPairingDialogProps) => {
  const [selected, setSelected] = useState<[string, string] | null>(null);

  // Generate all possible pair combos from the 3 VIP names
  const combos: [string, string][] = [];
  for (let i = 0; i < vipNames.length; i++) {
    for (let j = i + 1; j < vipNames.length; j++) {
      combos.push([vipNames[i], vipNames[j]]);
    }
  }

  const handleConfirm = () => {
    if (selected) {
      onConfirm({ player1Name: selected[0], player2Name: selected[1] });
    } else {
      onConfirm(null); // randomize
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl text-accent">Choose Teammates</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            David, Benson & Albright are all checked in. Pick a locked pair or let the randomizer decide.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {combos.map(([a, b]) => {
            const isSelected = selected?.[0] === a && selected?.[1] === b;
            const third = vipNames.find((n) => n !== a && n !== b);
            return (
              <button
                key={`${a}-${b}`}
                onClick={() => setSelected(isSelected ? null : [a, b])}
                className={`w-full rounded-lg border-2 p-4 text-left transition-all ${
                  isSelected
                    ? "border-accent bg-accent/10 shadow-md"
                    : "border-border bg-card hover:border-accent/40"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-accent shrink-0" />
                  <div>
                    <p className="font-display text-lg text-foreground">
                      {a} & {b}
                    </p>
                    <p className="text-sm text-muted-foreground">{third} goes into the randomizer</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1 border-accent text-accent hover:bg-accent/10"
            onClick={() => onConfirm(null)}
          >
            <Shuffle className="w-4 h-4 mr-2" /> Randomize All
          </Button>
          <Button
            className="flex-1 bg-accent text-accent-foreground hover:bg-accent/80"
            onClick={handleConfirm}
            disabled={!selected}
          >
            Lock Pair & Generate
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

/** Check if all 3 VIPs are checked in, return their actual roster names */
export function getCheckedInVips(roster: { name: string; checkedIn: boolean }[]): string[] | null {
  const matched = VIP_NAMES.map((vip) =>
    roster.find((p) => p.name.toLowerCase() === vip && p.checkedIn)
  );
  if (matched.every(Boolean)) {
    return matched.map((p) => p!.name);
  }
  return null;
}

export default VipPairingDialog;
