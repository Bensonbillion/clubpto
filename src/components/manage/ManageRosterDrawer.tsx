import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, ArrowRightLeft, UserPlus, UserMinus, CheckCircle2, AlertTriangle } from "lucide-react";
import { Player, SkillTier, Pair } from "@/types/courtManager";

interface ManageRosterDrawerProps {
  activePlayers: Player[];
  pairs: Pair[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSwapPlayer: (oldPlayerId: string, newPlayerName: string, tier: SkillTier) => { success: boolean; affected: number };
  onAddPlayer: (name: string, tier: SkillTier) => { success: boolean; affected: number };
  onRemovePlayer: (playerId: string) => { success: boolean; affected: number };
}

type ResultMessage = { type: "success" | "error"; text: string } | null;

const ManageRosterDrawer = ({
  activePlayers,
  pairs,
  isOpen,
  onOpenChange,
  onSwapPlayer,
  onAddPlayer,
  onRemovePlayer,
}: ManageRosterDrawerProps) => {
  const [result, setResult] = useState<ResultMessage>(null);

  // Swap state
  const [swapOldId, setSwapOldId] = useState("");
  const [swapNewName, setSwapNewName] = useState("");
  const [swapTier, setSwapTier] = useState<SkillTier | "">("");

  // Add state
  const [addName, setAddName] = useState("");
  const [addTier, setAddTier] = useState<SkillTier>("B");

  // Remove state
  const [removeId, setRemoveId] = useState("");

  const clearResult = () => setResult(null);

  const handleSwap = () => {
    if (!swapOldId || !swapNewName.trim()) return;
    const oldPlayer = activePlayers.find((p) => p.id === swapOldId);
    const tier = (swapTier || oldPlayer?.skillLevel || "B") as SkillTier;
    const res = onSwapPlayer(swapOldId, swapNewName.trim(), tier);
    if (res.success) {
      setResult({ type: "success", text: `Player swapped. Schedule regenerated — ${res.affected} game${res.affected !== 1 ? "s" : ""} affected.` });
      setSwapOldId("");
      setSwapNewName("");
      setSwapTier("");
    } else {
      setResult({ type: "error", text: "Cannot swap — player may be currently on court." });
    }
  };

  const handleAdd = () => {
    if (!addName.trim()) return;
    const res = onAddPlayer(addName.trim(), addTier);
    if (res.success) {
      setResult({ type: "success", text: `${addName.trim()} added. Schedule regenerated — ${res.affected} new game${res.affected !== 1 ? "s" : ""} added.` });
      setAddName("");
    } else {
      setResult({ type: "error", text: "Could not add player — name may already exist or no partner available." });
    }
  };

  const handleRemove = () => {
    if (!removeId) return;
    const player = activePlayers.find((p) => p.id === removeId);
    const res = onRemovePlayer(removeId);
    if (res.success) {
      setResult({ type: "success", text: `${player?.name || "Player"} removed. Schedule regenerated — ${res.affected} game${res.affected !== 1 ? "s" : ""} voided.` });
      setRemoveId("");
    } else {
      setResult({ type: "error", text: "Cannot remove — player may be currently on court." });
    }
  };

  // Get the pair partner for display
  const getPartner = (playerId: string): string | null => {
    for (const pair of pairs) {
      if (pair.player1.id === playerId) return pair.player2.name;
      if (pair.player2.id === playerId) return pair.player1.name;
    }
    return null;
  };

  // Players currently playing (on a court)
  const playingPlayerIds = new Set<string>();
  // We don't have match data here, so we just show all active players

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[420px] bg-card border-border overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="font-display text-2xl text-accent flex items-center gap-2">
            <Users className="w-6 h-6" />
            Manage Roster
          </SheetTitle>
        </SheetHeader>

        {/* Result banner */}
        {result && (
          <div
            className={`mb-4 rounded-lg border p-3 flex items-start gap-2 text-sm animate-fade-in ${
              result.type === "success"
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-destructive/40 bg-destructive/10 text-destructive"
            }`}
          >
            {result.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            )}
            <span>{result.text}</span>
            <button onClick={clearResult} className="ml-auto text-xs opacity-60 hover:opacity-100">✕</button>
          </div>
        )}

        <Tabs defaultValue="swap" className="space-y-4" onValueChange={clearResult}>
          <TabsList className="w-full grid grid-cols-3 bg-muted">
            <TabsTrigger value="swap" className="text-sm min-h-[44px]">
              <ArrowRightLeft className="w-4 h-4 mr-1.5" /> Swap
            </TabsTrigger>
            <TabsTrigger value="add" className="text-sm min-h-[44px]">
              <UserPlus className="w-4 h-4 mr-1.5" /> Add
            </TabsTrigger>
            <TabsTrigger value="remove" className="text-sm min-h-[44px]">
              <UserMinus className="w-4 h-4 mr-1.5" /> Remove
            </TabsTrigger>
          </TabsList>

          {/* ── SWAP TAB ────────────────────────────────── */}
          <TabsContent value="swap" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Replace an existing player with someone new. Future games update; past results stay.
            </p>

            <div className="space-y-3">
              <label className="text-xs uppercase tracking-widest text-muted-foreground">Player to replace</label>
              <Select value={swapOldId} onValueChange={(v) => { setSwapOldId(v); setSwapTier(""); clearResult(); }}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="Select player…" />
                </SelectTrigger>
                <SelectContent>
                  {activePlayers.map((p) => {
                    const partner = getPartner(p.id);
                    return (
                      <SelectItem key={p.id} value={p.id} className="min-h-[44px]">
                        {p.name} {partner ? `(paired w/ ${partner})` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              <label className="text-xs uppercase tracking-widest text-muted-foreground">Replacement name</label>
              <Input
                value={swapNewName}
                onChange={(e) => setSwapNewName(e.target.value)}
                placeholder="New player name"
                className="min-h-[44px]"
              />

              <label className="text-xs uppercase tracking-widest text-muted-foreground">Tier (inherits original by default)</label>
              <Select value={swapTier || (swapOldId ? activePlayers.find((p) => p.id === swapOldId)?.skillLevel || "" : "")} onValueChange={(v) => setSwapTier(v as SkillTier)}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="Same as original" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">Tier A (Advanced)</SelectItem>
                  <SelectItem value="B">Tier B (Intermediate)</SelectItem>
                  <SelectItem value="C">Tier C (Beginner)</SelectItem>
                </SelectContent>
              </Select>

              <Button
                onClick={handleSwap}
                disabled={!swapOldId || !swapNewName.trim()}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/80 min-h-[48px] text-base"
              >
                <ArrowRightLeft className="w-4 h-4 mr-2" /> Swap Player
              </Button>
            </div>
          </TabsContent>

          {/* ── ADD TAB ─────────────────────────────────── */}
          <TabsContent value="add" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Add a late-arriving player. They'll be paired and scheduled into remaining games, prioritized to catch up.
            </p>

            <div className="space-y-3">
              <label className="text-xs uppercase tracking-widest text-muted-foreground">Player name</label>
              <Input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Player name"
                className="min-h-[44px]"
              />

              <label className="text-xs uppercase tracking-widest text-muted-foreground">Tier</label>
              <Select value={addTier} onValueChange={(v) => { setAddTier(v as SkillTier); clearResult(); }}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">Tier A (Advanced)</SelectItem>
                  <SelectItem value="B">Tier B (Intermediate)</SelectItem>
                  <SelectItem value="C">Tier C (Beginner)</SelectItem>
                </SelectContent>
              </Select>

              <Button
                onClick={handleAdd}
                disabled={!addName.trim()}
                className="w-full bg-accent text-accent-foreground hover:bg-accent/80 min-h-[48px] text-base"
              >
                <UserPlus className="w-4 h-4 mr-2" /> Add Player
              </Button>
            </div>
          </TabsContent>

          {/* ── REMOVE TAB ──────────────────────────────── */}
          <TabsContent value="remove" className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Remove a player who left early or is injured. Their completed game results stay in the record.
            </p>

            <div className="space-y-3">
              <label className="text-xs uppercase tracking-widest text-muted-foreground">Player to remove</label>
              <Select value={removeId} onValueChange={(v) => { setRemoveId(v); clearResult(); }}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue placeholder="Select player…" />
                </SelectTrigger>
                <SelectContent>
                  {activePlayers.map((p) => {
                    const partner = getPartner(p.id);
                    return (
                      <SelectItem key={p.id} value={p.id} className="min-h-[44px]">
                        {p.name} {partner ? `(paired w/ ${partner})` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              {removeId && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <p className="font-medium">⚠ This will:</p>
                  <ul className="list-disc list-inside mt-1 space-y-0.5 text-xs">
                    <li>Void all their future scheduled games</li>
                    <li>Remove their partner's remaining games too</li>
                    <li>Keep all completed game results</li>
                  </ul>
                </div>
              )}

              <Button
                onClick={handleRemove}
                disabled={!removeId}
                variant="destructive"
                className="w-full min-h-[48px] text-base"
              >
                <UserMinus className="w-4 h-4 mr-2" /> Remove Player
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* Active roster summary */}
        <div className="mt-6 pt-4 border-t border-border space-y-3">
          <h4 className="text-xs uppercase tracking-widest text-muted-foreground">Active Roster ({activePlayers.length} players)</h4>
          <div className="grid grid-cols-2 gap-2">
            {activePlayers.map((p) => (
              <div key={p.id} className="rounded-md border border-border/50 bg-muted/20 px-3 py-2 text-sm">
                <span className="text-foreground">{p.name}</span>
                <span className="text-muted-foreground text-xs ml-1.5">
                  {p.wins}W-{p.losses}L
                </span>
              </div>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ManageRosterDrawer;
