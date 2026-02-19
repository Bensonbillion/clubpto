import { useState } from "react";
import { useGameState } from "@/hooks/useGameState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Play, RotateCcw, Users, ClipboardPaste } from "lucide-react";

interface AdminSetupProps {
  gameState: ReturnType<typeof useGameState>;
}

const AdminSetup = ({ gameState }: AdminSetupProps) => {
  const { state, setSessionConfig, addPlayer, removePlayer, toggleSkillLevel, generatePairs, startSession, resetSession, generateMatches } = gameState;
  const [newName, setNewName] = useState("");
  const [newSkill, setNewSkill] = useState<"beginner" | "good">("beginner");
  const [confirmReset, setConfirmReset] = useState(false);
  const [bulkNames, setBulkNames] = useState("");
  const [bulkSkill, setBulkSkill] = useState<"beginner" | "good">("beginner");
  const [showBulk, setShowBulk] = useState(false);

  const handleAddPlayer = () => {
    if (!newName.trim()) return;
    addPlayer(newName.trim(), newSkill);
    setNewName("");
  };

  const handleBulkAdd = () => {
    const names = bulkNames
      .split(/[\n,]+/)
      .map((n) => n.replace(/^[\s\-\*•]+\[.*?\]\s*/g, "").replace(/^[\s\-\*•]+/, "").trim())
      .filter((n) => n.length > 0 && n !== "[ ]" && n !== "[x]");
    names.forEach((name) => addPlayer(name, bulkSkill));
    setBulkNames("");
  };

  const handleReset = () => {
    if (confirmReset) {
      resetSession();
      setConfirmReset(false);
    } else {
      setConfirmReset(true);
      setTimeout(() => setConfirmReset(false), 3000);
    }
  };

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Session Configuration */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h3 className="font-display text-xl text-accent">Session Configuration</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground mb-1 block">Start Time</label>
            <Input
              type="time"
              value={state.sessionConfig.startTime}
              onChange={(e) => setSessionConfig({ startTime: e.target.value })}
              className="bg-muted border-border"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-muted-foreground mb-1 block">Duration (min)</label>
            <Input
              type="number"
              value={state.sessionConfig.durationMinutes}
              onChange={(e) => setSessionConfig({ durationMinutes: Number(e.target.value) })}
              className="bg-muted border-border"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Games are played to 7 points to determine a winner.</p>
      </div>

      {/* Add Player */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl text-accent">Player Roster</h3>
          <button
            onClick={() => setShowBulk(!showBulk)}
            className="text-xs text-muted-foreground hover:text-accent transition-colors flex items-center gap-1"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            {showBulk ? "Single add" : "Paste list"}
          </button>
        </div>

        {showBulk ? (
          <div className="space-y-3">
            <textarea
              placeholder={"Paste names here — one per line or comma-separated\n\nExample:\nAlex\nBen\nClara, Dana"}
              value={bulkNames}
              onChange={(e) => setBulkNames(e.target.value)}
              rows={6}
              className="w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none font-body"
            />
            <div className="flex gap-3">
              <Select value={bulkSkill} onValueChange={(v) => setBulkSkill(v as "beginner" | "good")}>
                <SelectTrigger className="w-40 bg-muted border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="good">Good</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleBulkAdd} disabled={!bulkNames.trim()} className="bg-primary text-primary-foreground hover:bg-primary/80">
                <Plus className="w-4 h-4 mr-1" /> Add All
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Tip: Copy a list from your group chat and paste it directly.</p>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Player name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddPlayer()}
              className="bg-muted border-border flex-1"
            />
            <Select value={newSkill} onValueChange={(v) => setNewSkill(v as "beginner" | "good")}>
              <SelectTrigger className="w-full sm:w-40 bg-muted border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="good">Good</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleAddPlayer} className="bg-primary text-primary-foreground hover:bg-primary/80">
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
        )}

        {/* Roster Grid */}
        {state.roster.length > 0 ? (
          <>
            {/* Bulk skill actions */}
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-muted-foreground">Set all to:</span>
              <button
                onClick={() => state.roster.forEach((p) => p.skillLevel !== "beginner" && toggleSkillLevel(p.id))}
                className="text-xs uppercase tracking-widest px-3 py-1 rounded-full border border-primary/40 text-primary hover:bg-primary/10 transition-colors"
              >
                Beginner
              </button>
              <button
                onClick={() => state.roster.forEach((p) => p.skillLevel !== "good" && toggleSkillLevel(p.id))}
                className="text-xs uppercase tracking-widest px-3 py-1 rounded-full border border-accent/40 text-accent hover:bg-accent/10 transition-colors"
              >
                Good
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {state.roster.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between rounded-md border border-border bg-muted p-3 card-hover"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <p className="font-display text-lg text-foreground truncate">{player.name}</p>
                    <button
                      onClick={() => toggleSkillLevel(player.id)}
                      className={`shrink-0 text-[10px] uppercase tracking-widest px-2.5 py-0.5 rounded-full border transition-all cursor-pointer ${
                        player.skillLevel === "good"
                          ? "border-accent/60 bg-accent/15 text-accent hover:bg-accent/25"
                          : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                      }`}
                    >
                      {player.skillLevel}
                    </button>
                  </div>
                  <button onClick={() => removePlayer(player.id)} className="ml-2 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-muted-foreground text-sm text-center py-8">No players added yet.</p>
        )}
      </div>

      {/* Session Controls */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={startSession} disabled={state.sessionStarted || state.roster.length < 4} className="bg-primary text-primary-foreground hover:bg-primary/80">
          <Play className="w-4 h-4 mr-1" /> Start Session
        </Button>
        <Button onClick={generatePairs} disabled={!state.sessionStarted} variant="outline" className="border-accent text-accent hover:bg-accent/10">
          <Users className="w-4 h-4 mr-1" /> Generate Pairs
        </Button>
        <Button onClick={generateMatches} disabled={state.pairs.length < 2} variant="outline" className="border-primary text-primary hover:bg-primary/10">
          <Play className="w-4 h-4 mr-1" /> Generate Matches
        </Button>
        <Button onClick={handleReset} variant="outline" className={confirmReset ? "border-destructive text-destructive animate-pulse-soft" : "border-muted-foreground text-muted-foreground hover:border-destructive hover:text-destructive"}>
          <RotateCcw className="w-4 h-4 mr-1" /> {confirmReset ? "Confirm Reset?" : "Reset Session"}
        </Button>
      </div>
    </div>
  );
};

export default AdminSetup;
