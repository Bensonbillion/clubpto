import { useState, useEffect, useCallback, useRef } from "react";
import { useGameState } from "@/hooks/useGameState";
import { query } from "@/lib/turso";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, Play, RotateCcw, Sparkles, ChevronDown, ChevronUp, Loader2, Zap, Search, Users } from "lucide-react";
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
  first_name: string;
  last_name: string;
  preferred_name: string | null;
  email: string | null;
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

  // AI assistant state
  const [showAi, setShowAi] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AiResult | null>(null);

  const fetchProfiles = useCallback(async () => {
    try {
      const result = await query(
        'SELECT id, first_name, last_name, preferred_name, email FROM players WHERE is_deleted = 0 ORDER BY first_name ASC'
      );
      setProfiles(result.rows as any[]);
    } catch (err) {
      console.error("Failed to load profiles:", err);
    }
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
    p.preferred_name || p.first_name;

  const rosterProfileIds = new Set(
    state.roster.map((r) => r.profileId).filter(Boolean)
  );

  const filteredProfiles = profiles.filter((p) => {
    if (rosterProfileIds.has(p.id)) return false;
    if (!profileSearch) return true;
    const q = profileSearch.toLowerCase();
    return (
      p.first_name.toLowerCase().includes(q) ||
      p.last_name.toLowerCase().includes(q) ||
      (p.preferred_name && p.preferred_name.toLowerCase().includes(q)) ||
      (p.email && p.email.toLowerCase().includes(q))
    );
  });

  const handleSelectProfile = (profile: PlayerProfile) => {
    const displayName = getDisplayName(profile);
    addPlayer(displayName, newSkill, profile.id);
    setProfileSearch("");
    setShowDropdown(false);
  };

  const handleReset = (keepRoster = false) => {
    if (confirmReset) {
      resetSession(keepRoster);
      setConfirmReset(false);
      setResetKeepRoster(false);
      if (keepRoster) toast.success("Session reset — roster preserved");
    } else {
      setConfirmReset(true);
      setResetKeepRoster(keepRoster);
      setTimeout(() => { setConfirmReset(false); setResetKeepRoster(false); }, 3000);
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
    aiResult.skillOverrides.forEach(({ playerName, newSkill }) => {
      const player = state.roster.find((p) => p.name.toLowerCase() === playerName.toLowerCase());
      if (player && player.skillLevel !== newSkill) {
        setPlayerSkillLevel(player.id, newSkill);
      }
    });
    setFixedPairs(aiResult.fixedPairs);
    const pairCount = aiResult.fixedPairs.length;
    const overrideCount = aiResult.skillOverrides.length;
    const parts: string[] = [];
    if (pairCount > 0) parts.push(`${pairCount} fixed pair${pairCount > 1 ? "s" : ""} saved`);
    if (overrideCount > 0) parts.push(`${overrideCount} tier${overrideCount > 1 ? "s" : ""} updated`);
    toast.success(parts.length > 0 ? parts.join(" · ") : "AI config applied!");
    setAiResult(null);
    setAiPrompt("");
    setShowAi(false);
  };

  const tierSelect = (value: SkillTier, onChange: (v: SkillTier) => void, className?: string) => (
    <Select value={value} onValueChange={(v) => onChange(v as SkillTier)}>
      <SelectTrigger className={`bg-muted border-border min-h-[48px] text-base ${className || "w-full sm:w-44"}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="A">
          <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-400" /> Tier A — Advanced</span>
        </SelectItem>
        <SelectItem value="B">
          <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-gray-300" /> Tier B — Intermediate</span>
        </SelectItem>
        <SelectItem value="C">
          <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-600" /> Tier C — Beginner</span>
        </SelectItem>
      </SelectContent>
    </Select>
  );

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
        <div>
          <label className="text-sm uppercase tracking-widest text-muted-foreground mb-2 block">Courts</label>
          <div className="flex gap-2">
            {([2, 3] as const).map((count) => (
              <button
                key={count}
                onClick={() => setSessionConfig({ courtCount: count })}
                className={`px-5 py-2.5 rounded-lg border-2 font-display text-base min-h-[48px] transition-all ${
                  (state.sessionConfig.courtCount || 2) === count
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-muted text-muted-foreground hover:border-accent/40"
                }`}
              >
                {count} Courts
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between rounded-md border border-border bg-muted p-4">
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-accent" />
            <div>
              <span className="text-base text-foreground font-display">Dynamic Start</span>
              <p className="text-sm text-muted-foreground">Auto-generate games when 4+ players check in</p>
            </div>
          </div>
          <Switch
            checked={!!state.sessionConfig.dynamicMode}
            onCheckedChange={(v) => setSessionConfig({ dynamicMode: v })}
          />
        </div>
        <p className="text-sm text-muted-foreground sm:col-span-2">
          Games are doubles (2v2) played to 7 points (~7 min each). {Math.floor((state.sessionConfig.durationMinutes || 85) / 7)} game slots per court, {Math.floor((state.sessionConfig.durationMinutes || 85) / 7) * (state.sessionConfig.courtCount || 2)} total across {state.sessionConfig.courtCount || 2} courts.
          {(state.sessionConfig.courtCount || 2) === 3 && (
            <span className="block mt-1 text-accent">3-court mode: Court 1 = Tier C only · Courts 2 & 3 = Tiers A & B · B never plays C.</span>
          )}
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

      {/* Player Roster — search from profiles */}
      <div className="rounded-lg border border-border bg-card p-8 space-y-5">
        <h3 className="font-display text-2xl text-accent">Player Roster</h3>
        <p className="text-sm text-muted-foreground -mt-2">Search and add players from registered profiles.</p>

        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1" ref={dropdownRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              value={profileSearch}
              onChange={(e) => {
                setProfileSearch(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search player profiles..."
              className="w-full rounded-lg border border-border bg-muted pl-10 pr-4 py-3 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/30 min-h-[48px]"
            />
            {showDropdown && (
              <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-card shadow-xl max-h-[240px] overflow-y-auto">
                {filteredProfiles.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-muted-foreground">
                    {profiles.length === 0 ? "No profiles yet — create one below" : "No matching profiles"}
                  </div>
                ) : (
                  filteredProfiles.map((profile) => (
                    <button
                      key={profile.id}
                      onClick={() => handleSelectProfile(profile)}
                      className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors flex items-center justify-between border-b border-border/30 last:border-b-0"
                    >
                      <div>
                        <span className="font-medium text-foreground">
                          {getDisplayName(profile)}
                        </span>
                        {profile.email && <p className="text-xs text-muted-foreground">{profile.email}</p>}
                      </div>
                      <Plus className="w-4 h-4 text-muted-foreground shrink-0" />
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          {tierSelect(newSkill, setNewSkill)}
        </div>

        {/* Roster Grid */}
        {state.roster.length > 0 ? (
          <>
            <div className="flex items-center gap-3 mt-3">
              <span className="text-sm text-muted-foreground">Set all to:</span>
              {(["A", "B", "C"] as SkillTier[]).map((tier) => {
                const style = TIER_STYLES[tier];
                return (
                  <button
                    key={tier}
                    onClick={() => setAllSkillLevels(tier)}
                    className={`text-sm uppercase tracking-widest px-4 py-2 rounded-full border ${style.border} ${style.text} hover:${style.bg} transition-colors min-h-[40px]`}
                  >
                    {style.label}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {state.roster.map((player) => {
                const style = TIER_STYLES[player.skillLevel] || TIER_STYLES.C;
                return (
                  <div
                    key={player.id}
                    className="flex items-center justify-between rounded-md border border-border bg-muted p-4 card-hover min-h-[56px]"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <p className="font-display text-xl text-foreground truncate">{player.name}</p>
                      <Select value={player.skillLevel} onValueChange={(v) => setPlayerSkillLevel(player.id, v as SkillTier)}>
                        <SelectTrigger className={`shrink-0 w-auto min-w-[80px] h-8 text-xs uppercase tracking-widest px-3 rounded-full border ${style.border} ${style.bg} ${style.text} hover:opacity-80`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-400" /> A</span></SelectItem>
                          <SelectItem value="B"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-gray-300" /> B</span></SelectItem>
                          <SelectItem value="C"><span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-amber-600" /> C</span></SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <button onClick={() => removePlayer(player.id)} className="ml-3 text-muted-foreground hover:text-destructive transition-colors p-2 min-h-[44px] min-w-[44px] flex items-center justify-center">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-muted-foreground text-base text-center py-8">No players added yet — search profiles above to add to roster.</p>
        )}
      </div>

      {/* Manage Player Profiles */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <button
          onClick={() => {
            setShowPlayerManager(!showPlayerManager);
            if (!showPlayerManager) fetchProfiles(); // Refresh profiles when opening
          }}
          className="w-full flex items-center justify-between px-8 py-5 text-left hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-accent" />
            <span className="font-display text-xl text-accent">Manage Player Profiles</span>
          </div>
          {showPlayerManager ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
        </button>

        {showPlayerManager && (
          <div className="px-8 pb-8 border-t border-border pt-6">
            <PlayerManager onProfilesChanged={fetchProfiles} />
          </div>
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
              Describe how you want this week's games structured. The AI will suggest tier changes and fixed pairings based on your roster.
            </p>
            <div className="space-y-2">
              <label className="text-sm uppercase tracking-widest text-muted-foreground block">Your instruction</label>
              <Textarea
                placeholder={`Examples:\n• "Pair boys with girls for mixed doubles"\n• "Put all beginners into Tier C and advanced players into Tier A"\n• "Keep Alex and Sam together as a pair"`}
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
                    <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Tier Changes</p>
                    <ul className="space-y-1">
                      {aiResult.skillOverrides.map((o, i) => {
                        const style = TIER_STYLES[o.newSkill] || TIER_STYLES.C;
                        return (
                          <li key={i} className="text-sm text-foreground">
                            <span className="font-semibold">{o.playerName}</span> → <span className={style.text}>{style.label}</span>
                          </li>
                        );
                      })}
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
        {confirmReset ? (
          <Button onClick={() => handleReset(resetKeepRoster)} variant="outline" className="min-h-[52px] px-8 text-base border-destructive text-destructive animate-pulse-soft">
            <RotateCcw className="w-5 h-5 mr-2" /> Confirm Reset?
          </Button>
        ) : (
          <>
            <Button onClick={() => handleReset(true)} variant="outline" className="min-h-[52px] px-8 text-base border-muted-foreground text-muted-foreground hover:border-accent hover:text-accent">
              <RotateCcw className="w-5 h-5 mr-2" /> Reset (Keep Roster)
            </Button>
            <Button onClick={() => handleReset(false)} variant="outline" className="min-h-[52px] px-8 text-base border-muted-foreground text-muted-foreground hover:border-destructive hover:text-destructive">
              <RotateCcw className="w-5 h-5 mr-2" /> Full Reset
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminSetup;
