import { useState } from "react";
import { useGameState } from "@/hooks/useGameState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Play, RotateCcw, ClipboardPaste, Sparkles, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AdminSetupProps {
  gameState: ReturnType<typeof useGameState>;
}

interface AiResult {
  fixedPairs: { player1Name: string; player2Name: string }[];
  skillOverrides: { playerName: string; newSkill: "beginner" | "good" }[];
  explanation: string;
}

const AdminSetup = ({ gameState }: AdminSetupProps) => {
  const { state, setSessionConfig, addPlayer, removePlayer, toggleSkillLevel, setAllSkillLevels, setFixedPairs, startSession, resetSession } = gameState;
  const [newName, setNewName] = useState("");
  const [newSkill, setNewSkill] = useState<"beginner" | "good">("beginner");
  const [confirmReset, setConfirmReset] = useState(false);
  const [bulkNames, setBulkNames] = useState("");
  const [bulkSkill, setBulkSkill] = useState<"beginner" | "good">("beginner");
  const [showBulk, setShowBulk] = useState(false);

  // AI assistant state
  const [showAi, setShowAi] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AiResult | null>(null);

  const handleAddPlayer = () => {
    if (!newName.trim()) return;
    const added = addPlayer(newName.trim(), newSkill);
    if (!added) return;
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

  const handleAiSubmit = async () => {
    if (!aiPrompt.trim() || state.roster.length === 0) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-setup-assistant`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ prompt: aiPrompt, roster: state.roster }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "AI request failed");
        return;
      }
      setAiResult(data as AiResult);
    } catch (e) {
      toast.error("Failed to reach AI assistant");
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiResult = () => {
    if (!aiResult) return;
    // Apply skill overrides
    aiResult.skillOverrides.forEach(({ playerName, newSkill }) => {
      const player = state.roster.find((p) => p.name.toLowerCase() === playerName.toLowerCase());
      if (player && player.skillLevel !== newSkill) {
        toggleSkillLevel(player.id);
      }
    });
    // Persist fixed pairs into game state so they're enforced on Start Session
    setFixedPairs(aiResult.fixedPairs);
    const pairCount = aiResult.fixedPairs.length;
    const overrideCount = aiResult.skillOverrides.length;
    const parts: string[] = [];
    if (pairCount > 0) parts.push(`${pairCount} fixed pair${pairCount > 1 ? "s" : ""} saved`);
    if (overrideCount > 0) parts.push(`${overrideCount} skill group${overrideCount > 1 ? "s" : ""} updated`);
    toast.success(parts.length > 0 ? parts.join(" · ") : "AI config applied!");
    setAiResult(null);
    setAiPrompt("");
    setShowAi(false);
  };

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Session Configuration */}
      <div className="rounded-lg border border-border bg-card p-8 space-y-5">
        <h3 className="font-display text-2xl text-accent">Session Configuration</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="text-sm uppercase tracking-widest text-muted-foreground mb-2 block">Start Time</label>
            <Input
              type="time"
              value={state.sessionConfig.startTime}
              onChange={(e) => setSessionConfig({ startTime: e.target.value })}
              className="bg-muted border-border min-h-[48px] text-base"
            />
          </div>
          <div>
            <label className="text-sm uppercase tracking-widest text-muted-foreground mb-2 block">Duration (min)</label>
            <Input
              type="number"
              value={state.sessionConfig.durationMinutes}
              onChange={(e) => setSessionConfig({ durationMinutes: Number(e.target.value) })}
              className="bg-muted border-border min-h-[48px] text-base"
            />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          Games are doubles (2v2) played to 7 points (~7 min each). {Math.floor((state.sessionConfig.durationMinutes || 85) / 7)} game slots per court, {Math.floor((state.sessionConfig.durationMinutes || 85) / 7) * 2} total across 2 courts.
        </p>
      </div>

      {/* Active Fixed Pairs Banner */}
      {(state.fixedPairs ?? []).length > 0 && (
        <div className="rounded-lg border border-accent/40 bg-accent/5 px-6 py-4 flex flex-wrap items-start gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-widest text-accent mb-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> AI Fixed Pairs · Active
            </p>
            <div className="flex flex-wrap gap-2">
              {(state.fixedPairs ?? []).map((fp, i) => (
                <span key={i} className="text-sm bg-accent/15 border border-accent/30 rounded-full px-3 py-1 text-foreground">
                  {fp.player1Name} &amp; {fp.player2Name}
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">These pairs will be locked in when you start the session.</p>
          </div>
          <button
            onClick={() => setFixedPairs([])}
            className="shrink-0 text-xs uppercase tracking-widest text-muted-foreground hover:text-destructive transition-colors px-3 py-1.5 min-h-[36px]"
          >
            Clear
          </button>
        </div>
      )}

      {/* Add Player */}
      <div className="rounded-lg border border-border bg-card p-8 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-2xl text-accent">Player Roster</h3>
          <button
            onClick={() => setShowBulk(!showBulk)}
            className="text-sm text-muted-foreground hover:text-accent transition-colors flex items-center gap-1.5 min-h-[44px] px-3"
          >
            <ClipboardPaste className="w-4 h-4" />
            {showBulk ? "Single add" : "Paste list"}
          </button>
        </div>

        {showBulk ? (
          <div className="space-y-4">
            <textarea
              placeholder={"Paste names here — one per line or comma-separated\n\nExample:\nAlex\nBen\nClara, Dana"}
              value={bulkNames}
              onChange={(e) => setBulkNames(e.target.value)}
              rows={6}
              className="w-full rounded-md border border-border bg-muted px-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none font-body"
            />
            <div className="flex gap-4">
              <Select value={bulkSkill} onValueChange={(v) => setBulkSkill(v as "beginner" | "good")}>
                <SelectTrigger className="w-44 bg-muted border-border min-h-[48px] text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="good">Good</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleBulkAdd} disabled={!bulkNames.trim()} className="bg-primary text-primary-foreground hover:bg-primary/80 min-h-[48px] px-6 text-base">
                <Plus className="w-5 h-5 mr-1.5" /> Add All
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">Tip: Copy a list from your group chat and paste it directly.</p>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row gap-4">
            <Input
              placeholder="Player name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddPlayer()}
              className="bg-muted border-border flex-1 min-h-[48px] text-base"
            />
            <Select value={newSkill} onValueChange={(v) => setNewSkill(v as "beginner" | "good")}>
              <SelectTrigger className="w-full sm:w-44 bg-muted border-border min-h-[48px] text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="good">Good</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleAddPlayer} className="bg-primary text-primary-foreground hover:bg-primary/80 min-h-[48px] px-6 text-base">
              <Plus className="w-5 h-5 mr-1.5" /> Add
            </Button>
          </div>
        )}

        {/* Roster Grid */}
        {state.roster.length > 0 ? (
          <>
            <div className="flex items-center gap-3 mt-3">
              <span className="text-sm text-muted-foreground">Set all to:</span>
              <button
                onClick={() => setAllSkillLevels("beginner")}
                className="text-sm uppercase tracking-widest px-4 py-2 rounded-full border border-primary/40 text-primary hover:bg-primary/10 transition-colors min-h-[40px]"
              >
                Beginner
              </button>
              <button
                onClick={() => setAllSkillLevels("good")}
                className="text-sm uppercase tracking-widest px-4 py-2 rounded-full border border-accent/40 text-accent hover:bg-accent/10 transition-colors min-h-[40px]"
              >
                Good
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {state.roster.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between rounded-md border border-border bg-muted p-4 card-hover min-h-[56px]"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <p className="font-display text-xl text-foreground truncate">{player.name}</p>
                    <button
                      onClick={() => toggleSkillLevel(player.id)}
                      className={`shrink-0 text-xs uppercase tracking-widest px-3 py-1 rounded-full border transition-all cursor-pointer min-h-[32px] ${
                        player.skillLevel === "good"
                          ? "border-accent/60 bg-accent/15 text-accent hover:bg-accent/25"
                          : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/20"
                      }`}
                    >
                      {player.skillLevel}
                    </button>
                  </div>
                  <button onClick={() => removePlayer(player.id)} className="ml-3 text-muted-foreground hover:text-destructive transition-colors p-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-muted-foreground text-base text-center py-8">No players added yet.</p>
        )}
      </div>

      {/* AI Setup Assistant */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <button
          onClick={() => setShowAi(!showAi)}
          className="w-full flex items-center justify-between px-8 py-5 text-left hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-accent" />
            <span className="font-display text-xl text-accent">AI Game Setup Assistant</span>
          </div>
          {showAi ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
        </button>

        {showAi && (
          <div className="px-8 pb-8 space-y-5 border-t border-border pt-6">
            <p className="text-sm text-muted-foreground">
              Describe how you want this week's games structured. The AI will suggest skill group changes and fixed pairings based on your roster.
            </p>
            <div className="space-y-2">
              <label className="text-sm uppercase tracking-widest text-muted-foreground block">Your instruction</label>
              <Textarea
                placeholder={`Examples:\n• "Pair boys with girls for mixed doubles"\n• "Put all beginners into one group and advanced players in another"\n• "Keep Alex and Sam together as a pair"`}
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                rows={4}
                className="bg-muted border-border resize-none text-base"
              />
            </div>
            <Button
              onClick={handleAiSubmit}
              disabled={aiLoading || !aiPrompt.trim() || state.roster.length === 0}
              className="bg-accent text-accent-foreground hover:bg-accent/80 min-h-[48px] px-6 text-base"
            >
              {aiLoading ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Thinking…</>
              ) : (
                <><Sparkles className="w-4 h-4 mr-2" /> Ask AI</>
              )}
            </Button>

            {state.roster.length === 0 && (
              <p className="text-xs text-muted-foreground">Add players to the roster first before using the AI assistant.</p>
            )}

            {/* AI Result */}
            {aiResult && (
              <div className="rounded-md border border-accent/30 bg-accent/5 p-5 space-y-4">
                <p className="text-sm text-foreground leading-relaxed">{aiResult.explanation}</p>

                {aiResult.skillOverrides.length > 0 && (
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Skill Group Changes</p>
                    <ul className="space-y-1">
                      {aiResult.skillOverrides.map((o, i) => (
                        <li key={i} className="text-sm text-foreground">
                          <span className="font-semibold">{o.playerName}</span> → <span className={o.newSkill === "good" ? "text-accent" : "text-primary"}>{o.newSkill}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiResult.fixedPairs.length > 0 && (
                  <div>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Fixed Pairs</p>
                    <ul className="space-y-1">
                      {aiResult.fixedPairs.map((fp, i) => (
                        <li key={i} className="text-sm text-foreground">
                          <span className="font-semibold">{fp.player1Name}</span> & <span className="font-semibold">{fp.player2Name}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <Button onClick={applyAiResult} className="bg-primary text-primary-foreground hover:bg-primary/80 min-h-[44px] px-5 text-sm">
                    Apply Changes
                  </Button>
                  <Button onClick={() => setAiResult(null)} variant="outline" className="border-border text-muted-foreground hover:text-foreground min-h-[44px] px-5 text-sm">
                    Dismiss
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Session Controls */}
      <div className="flex flex-wrap gap-4">
        <Button onClick={startSession} disabled={state.sessionStarted || state.roster.length < 4} className="bg-primary text-primary-foreground hover:bg-primary/80 min-h-[52px] px-8 text-base">
          <Play className="w-5 h-5 mr-2" /> {state.sessionStarted ? "Session Active" : "Start Session"}
        </Button>
        <Button onClick={handleReset} variant="outline" className={`min-h-[52px] px-8 text-base ${confirmReset ? "border-destructive text-destructive animate-pulse-soft" : "border-muted-foreground text-muted-foreground hover:border-destructive hover:text-destructive"}`}>
          <RotateCcw className="w-5 h-5 mr-2" /> {confirmReset ? "Confirm Reset?" : "Reset Session"}
        </Button>
      </div>
    </div>
  );
};

export default AdminSetup;