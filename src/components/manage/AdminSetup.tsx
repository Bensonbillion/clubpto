import { useState, useEffect, useCallback, useRef } from "react";
import { useGameState } from "@/hooks/useGameState";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, Play, RotateCcw, Sparkles, ChevronDown, ChevronUp, Loader2, Zap, Search, Users, ClipboardPaste } from "lucide-react";
import { toast } from "sonner";
import { SkillTier } from "@/types/courtManager";
import PlayerManager from "./PlayerManager";

interface AdminSetupProps {
  gameState: ReturnType<typeof useGameState>;
}

interface AiResult {
  fixedPairs: { player1Name: string; player2Name: string }[];
  skillOverrides: { playerName: string; newSkill: SkillTier }[];
  explanation: string;
}

interface PlayerProfile {
  id: string;
  name: string;
  preferred_name: string | null;
  email: string | null;
  tier: string;
  is_vip: boolean;
}

const TIER_STYLES: Record<SkillTier, { border: string; bg: string; text: string; label: string }> = {
  A: { border: "border-yellow-500/60", bg: "bg-yellow-500/15", text: "text-yellow-400", label: "Tier A" },
  B: { border: "border-gray-300/60", bg: "bg-gray-300/15", text: "text-gray-300", label: "Tier B" },
  C: { border: "border-amber-700/60", bg: "bg-amber-700/15", text: "text-amber-600", label: "Tier C" },
};

const AdminSetup = ({ gameState }: AdminSetupProps) => {
  const { state, setSessionConfig, addPlayer, removePlayer, setPlayerSkillLevel, setAllSkillLevels, setFixedPairs, startSession, resetSession } = gameState;
  const [newSkill, setNewSkill] = useState<SkillTier>("C");
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetKeepRoster, setResetKeepRoster] = useState(false);

  // Profile search state
  const [profiles, setProfiles] = useState<PlayerProfile[]>([]);
  const [profileSearch, setProfileSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Player manager state
  const [showPlayerManager, setShowPlayerManager] = useState(false);

  // Bulk paste state
  const [showBulk, setShowBulk] = useState(false);
  const [bulkNames, setBulkNames] = useState("");
  const [bulkSkill, setBulkSkill] = useState<SkillTier>("C");

  // AI assistant state
  const [showAi, setShowAi] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AiResult | null>(null);

  const fetchProfiles = useCallback(async () => {
    const { data } = await supabase
      .from("players")
      .select("id, name, preferred_name, email, tier, is_vip")
      .order("name", { ascending: true });
    setProfiles((data as PlayerProfile[]) || []);
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const getDisplayName = (p: PlayerProfile) =>
    p.preferred_name || p.name;

  const rosterProfileIds = new Set(
    state.roster.map((r) => r.profileId).filter(Boolean)
  );

  const filteredProfiles = profiles.filter((p) => {
    if (rosterProfileIds.has(p.id)) return false;
    if (!profileSearch) return true;
    const q = profileSearch.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.preferred_name && p.preferred_name.toLowerCase().includes(q)) ||
      (p.email && p.email.toLowerCase().includes(q))
    );
  });

  const handleBulkAdd = () => {
    const names = bulkNames
      .split(/[\n,]+/)
      .map((n) => n.replace(/^[\s\-\*•]+\[.*?\]\s*/g, "").replace(/^[\s\-\*•]+/, "").trim())
      .filter((n) => n.length > 0 && n !== "[ ]" && n !== "[x]");
    names.forEach((name) => addPlayer(name, bulkSkill));
    setBulkNames("");
    toast.success(`Added ${names.length} player${names.length !== 1 ? "s" : ""}`);
  };

  const handleSelectProfile = (profile: PlayerProfile) => {
    const displayName = getDisplayName(profile);
    const tier = (profile.tier === "A" || profile.tier === "B" || profile.tier === "C") ? profile.tier as SkillTier : newSkill;
    addPlayer(displayName, tier, profile.id);
    setProfileSearch("");
    setShowDropdown(false);
  };

  const handleReset = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    setConfirmReset(false);
    await resetSession(resetKeepRoster);
    toast.success("Session reset");
  };

  const handleAiSubmit = async () => {
    setAiLoading(true);
    setAiResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("ai-court-manager", {
        body: {
          prompt: aiPrompt,
          roster: state.roster.map((r) => ({ name: r.name, skill: r.skillLevel })),
        },
      });
      if (error) {
        toast.error("AI failed: " + error.message);
      } else {
        setAiResult(data as AiResult);
      }
    } catch (err: any) {
      toast.error("AI failed: " + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const applyAiResult = () => {
    if (!aiResult) return;
    if (aiResult.fixedPairs?.length) {
      setFixedPairs(aiResult.fixedPairs);
      toast.success("Applied " + aiResult.fixedPairs.length + " fixed pairs");
    }
    if (aiResult.skillOverrides?.length) {
      aiResult.skillOverrides.forEach((o) => {
        setPlayerSkillLevel(o.playerName, o.newSkill);
      });
      toast.success("Applied " + aiResult.skillOverrides.length + " skill overrides");
    }
  };

  const tierSelect = (name: string, skill: SkillTier) => (
    <Select value={skill} onValueChange={(value) => setPlayerSkillLevel(name, value as SkillTier)}>
      <SelectTrigger className="w-[120px] text-sm">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="A">Tier A</SelectItem>
        <SelectItem value="B">Tier B</SelectItem>
        <SelectItem value="C">Tier C</SelectItem>
      </SelectContent>
    </Select>
  );

  // Derive config values with defaults
  const courtCount = state.sessionConfig.courtCount || 2;

  return (
    <div className="space-y-6">
      {/* Session Config */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="font-display text-2xl text-accent">Session Configuration</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-muted-foreground">Courts</label>
            <div className="flex gap-2 mt-1">
              {([2, 3] as const).map((count) => (
                <button
                  key={count}
                  onClick={() => setSessionConfig({ courtCount: count })}
                  className={`px-5 py-2.5 rounded-lg border-2 font-display text-base min-h-[48px] transition-all ${
                    courtCount === count
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border bg-muted text-muted-foreground hover:border-accent/40"
                  }`}
                >
                  {count} Courts
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground">Duration (min)</label>
            <Input
              type="number"
              value={state.sessionConfig.durationMinutes}
              onChange={(e) => setSessionConfig({ durationMinutes: Number(e.target.value) })}
              className="mt-1"
            />
          </div>
        </div>
      </div>

      {/* Roster Management */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-accent">Roster</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowBulk(!showBulk)}
              className="text-sm text-muted-foreground hover:text-accent transition-colors flex items-center gap-1.5 min-h-[36px] px-3"
            >
              <ClipboardPaste className="w-4 h-4" />
              {showBulk ? "Search" : "Paste list"}
            </button>
            <Button size="sm" onClick={() => setShowPlayerManager(true)}>
              <Users className="w-4 h-4 mr-2" />
              Manage Players
            </Button>
          </div>
        </div>

        {/* Add Player */}
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
              <Select value={bulkSkill} onValueChange={(v) => setBulkSkill(v as SkillTier)}>
                <SelectTrigger className="w-44 min-h-[48px] text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">Tier A</SelectItem>
                  <SelectItem value="B">Tier B</SelectItem>
                  <SelectItem value="C">Tier C</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleBulkAdd} disabled={!bulkNames.trim()} className="min-h-[48px] px-6 text-base">
                <Plus className="w-5 h-5 mr-1.5" /> Add All
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">Tip: Copy a list from your group chat and paste it directly.</p>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="relative w-full">
              <Input
                placeholder="Search player name or email..."
                value={profileSearch}
                onChange={(e) => {
                  setProfileSearch(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
              />
              {showDropdown && (
                <div ref={dropdownRef} className="absolute top-full left-0 mt-1 w-full rounded-md border border-border bg-popover shadow-md z-10 max-h-60 overflow-y-auto">
                  {filteredProfiles.length === 0 ? (
                    <div className="px-4 py-2 text-sm text-muted-foreground">No profiles found</div>
                  ) : (
                    filteredProfiles.map((profile) => (
                      <button
                        key={profile.id}
                        className="block w-full px-4 py-2 text-left text-sm text-foreground hover:bg-accent/10 transition-colors"
                        onClick={() => handleSelectProfile(profile)}
                      >
                        {getDisplayName(profile)}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            <Select value={newSkill} onValueChange={(value) => setNewSkill(value as SkillTier)}>
              <SelectTrigger className="w-[120px] text-sm">
                <SelectValue placeholder="Skill Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A">Tier A</SelectItem>
                <SelectItem value="B">Tier B</SelectItem>
                <SelectItem value="C">Tier C</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Current Roster */}
        <div className="divide-y divide-border rounded-md border border-border overflow-hidden">
          {state.roster.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No players in roster</div>
          ) : (
            state.roster.map((player) => (
              <div key={player.name} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <button onClick={() => removePlayer(player.name)} className="text-red-500 hover:text-red-700 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <span className="text-foreground">{player.name}</span>
                </div>
                {tierSelect(player.name, player.skillLevel)}
              </div>
            ))
          )}
        </div>
      </div>

      {/* AI Assistant */}
      <div className="rounded-lg border border-border bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-accent">AI Assistant</h2>
          <Button size="sm" onClick={() => setShowAi(!showAi)}>
            {showAi ? <ChevronUp className="w-4 h-4 mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
            {showAi ? "Hide AI" : "Show AI"}
          </Button>
        </div>
        {showAi && (
          <div className="space-y-4">
            <Textarea
              placeholder="Suggest balanced teams, or fixed pairs, or skill overrides..."
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
            />
            <div className="flex items-center gap-3">
              <Button onClick={handleAiSubmit} disabled={aiLoading}>
                {aiLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
                {aiLoading ? "Loading..." : "Run AI"}
              </Button>
              {aiResult && (
                <Button variant="secondary" onClick={applyAiResult}>
                  Apply Results
                </Button>
              )}
            </div>
            {aiResult && aiResult.explanation && (
              <div className="rounded-md border border-border bg-muted/10 p-4 text-sm text-muted-foreground">
                <p>{aiResult.explanation}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Session Controls */}
      <div className="rounded-lg border border-border bg-card p-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button onClick={() => startSession()} disabled={state.roster.length < 2}>
            <Play className="w-4 h-4 mr-2" />
            Start Session
          </Button>
          <Button variant="destructive" onClick={handleReset} disabled={state.roster.length === 0}>
            <RotateCcw className="w-4 h-4 mr-2" />
            {confirmReset ? "Confirm Reset?" : "Reset Session"}
          </Button>
          {confirmReset && (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" checked={resetKeepRoster} onChange={() => setResetKeepRoster(!resetKeepRoster)} />
              Keep Roster?
            </label>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {state.roster.length} players in roster
        </div>
      </div>

      {/* Player Manager Modal */}
      {showPlayerManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-4xl rounded-xl border border-border bg-card p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl text-foreground">Manage Player Profiles</h3>
              <Button onClick={() => setShowPlayerManager(false)} variant="ghost">
                Close
              </Button>
            </div>
            <PlayerManager onProfilesChanged={() => fetchProfiles()} />
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSetup;
