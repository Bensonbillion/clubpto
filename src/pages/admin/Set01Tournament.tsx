import { useEffect, useMemo, useState } from "react";
import { query } from "@/lib/turso";
import { awardPoints } from "@/lib/leaderboard";
import { useSet01Tournament } from "@/hooks/useSet01Tournament";
import { Lock, Search, Trophy, Check, AlertTriangle, RotateCcw, ChevronRight } from "lucide-react";
import type { Set01State, MensTeamSlot, WomensTeamSlot, KnockoutMatch } from "@/types/set01";

const PASSCODE = "9999";

interface DbPlayer {
  id: string;
  first_name: string;
  preferred_name: string | null;
  display: string;
}

type ViewKey = "setup" | "stage1" | "seeds" | "mens" | "womens" | "live";

const Set01Tournament = () => {
  // ── Passcode gate ─────────────────────────────────────────
  const [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState(false);

  const handleDigit = (d: string) => {
    const next = code + d;
    setCodeError(false);
    if (next.length === 4) {
      if (next === PASSCODE) setUnlocked(true);
      else {
        setCodeError(true);
        setCode("");
      }
    } else setCode(next);
  };

  // ── Player roster (from existing players table via Turso) ─
  const [allPlayers, setAllPlayers] = useState<DbPlayer[]>([]);
  const [playersLoading, setPlayersLoading] = useState(true);

  useEffect(() => {
    if (!unlocked) return;
    (async () => {
      try {
        const result = await query(
          "SELECT id, first_name, preferred_name FROM players WHERE is_deleted = 0 ORDER BY COALESCE(preferred_name, first_name)",
        );
        setAllPlayers(
          (result.rows as Array<{ id: string; first_name: string; preferred_name: string | null }>).map((r) => ({
            id: r.id,
            first_name: r.first_name,
            preferred_name: r.preferred_name,
            display: r.preferred_name || r.first_name,
          })),
        );
      } catch (err) {
        console.error("Failed to load players:", err);
      } finally {
        setPlayersLoading(false);
      }
    })();
  }, [unlocked]);

  // ── Tournament state ──────────────────────────────────────
  const api = useSet01Tournament();

  // ── View routing ──────────────────────────────────────────
  const [view, setView] = useState<ViewKey>("setup");

  // ── Player picker modal state ─────────────────────────────
  const [pickingFor, setPickingFor] = useState<
    | { kind: "men"; seed: number; slot: "player1" | "player2" }
    | { kind: "women"; label: string; slot: "player1" | "player2" }
    | null
  >(null);
  const [searchQuery, setSearchQuery] = useState("");

  const usedPlayerIds = useMemo(() => {
    const ids = new Set<string>();
    api.state.mensTeams.forEach((t) => {
      if (t.player1) ids.add(t.player1.id);
      if (t.player2) ids.add(t.player2.id);
    });
    api.state.womensTeams.forEach((t) => {
      if (t.player1) ids.add(t.player1.id);
      if (t.player2) ids.add(t.player2.id);
    });
    return ids;
  }, [api.state.mensTeams, api.state.womensTeams]);

  const filteredPlayers = useMemo(() => {
    return allPlayers.filter((p) => {
      if (usedPlayerIds.has(p.id)) return false;
      if (!searchQuery) return true;
      return p.display.toLowerCase().includes(searchQuery.toLowerCase());
    });
  }, [allPlayers, usedPlayerIds, searchQuery]);

  const selectPlayer = (p: DbPlayer) => {
    if (!pickingFor) return;
    if (pickingFor.kind === "men") {
      api.setMensTeam(pickingFor.seed, pickingFor.slot, { id: p.id, display: p.display });
    } else {
      api.setWomensTeam(pickingFor.label, pickingFor.slot, { id: p.id, display: p.display });
    }
    setPickingFor(null);
    setSearchQuery("");
  };

  // ── Award points after final ──────────────────────────────
  const [statusMsg, setStatusMsg] = useState("");

  const handleSetWinner = async (
    matchPath: "r16" | "qf" | "sf" | "f",
    matchId: string,
    winnerSide: "A" | "B",
  ) => {
    // Set the score automatically by reading the current scores. If only the
    // winner side is filled, default to a placeholder 1–0. The bracket editor
    // primarily uses score entry; this helper is for tap-to-pick fallback.
    const match = matchPath === "f" ? api.state.f
      : matchPath === "r16" ? api.state.r16.find((m) => m.id === matchId)
      : matchPath === "qf" ? api.state.qf.find((m) => m.id === matchId)
      : api.state.sf.find((m) => m.id === matchId);
    if (!match) return;
    const sA = match.scoreA ?? (winnerSide === "A" ? 2 : 0);
    const sB = match.scoreB ?? (winnerSide === "B" ? 2 : 0);
    api.setKnockoutScore(matchPath, matchId, "A", sA);
    api.setKnockoutScore(matchPath, matchId, "B", sB);
  };

  const flashStatus = (text: string) => {
    setStatusMsg(text);
    setTimeout(() => setStatusMsg(""), 4000);
  };

  // Award points helper — runs once per match completion
  const awardForMatch = async (
    match: KnockoutMatch,
    pathKey: "r16" | "qf" | "sf" | "f",
  ) => {
    if (match.pointsAwarded) return;
    const winner = api.matchWinner(match);
    if (!winner) return;
    const seeds = api.getKnockoutSeeds(match);
    const winningSeed = winner === "A" ? seeds.a : seeds.b;
    if (!winningSeed) return;
    const team = api.teamBySeed(winningSeed);
    if (!team || !team.player1 || !team.player2) return;

    const pts: 5 | 10 = match.round === "F" ? 10 : 5;
    const reason: "tournament_win" | "playoff_win" = match.round === "F" ? "tournament_win" : "playoff_win";
    let awarded = 0;
    for (const p of [team.player1, team.player2]) {
      const r = await awardPoints(p.id, pts, reason, `set01-${match.id}`);
      if (r.success) awarded++;
    }
    flashStatus(`${match.id}: ${team.player1.display} & ${team.player2.display} — ${pts} pts × ${awarded}`);
    api.markKnockoutAwarded(pathKey, match.id);
  };

  // After every render we check if any match has just been completed and award points
  useEffect(() => {
    if (!unlocked) return;
    const allKnockouts: Array<[KnockoutMatch, "r16" | "qf" | "sf" | "f"]> = [
      ...api.state.r16.map((m) => [m, "r16"] as [KnockoutMatch, "r16"]),
      ...api.state.qf.map((m) => [m, "qf"] as [KnockoutMatch, "qf"]),
      ...api.state.sf.map((m) => [m, "sf"] as [KnockoutMatch, "sf"]),
      [api.state.f, "f"],
    ];
    for (const [m, key] of allKnockouts) {
      if (!m.pointsAwarded && api.matchWinner(m)) {
        awardForMatch(m, key);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api.state.r16, api.state.qf, api.state.sf, api.state.f, unlocked]);

  // ── Passcode screen ───────────────────────────────────────
  if (!unlocked) {
    return (
      <div className="min-h-screen bg-[#1A1A1A] flex flex-col items-center justify-center">
        <Lock className="w-10 h-10 text-[#C9A84C] mb-4" />
        <h2 className="font-serif text-2xl text-[#C9A84C] mb-2">Set 01 Tournament</h2>
        <p className="text-[#A8A29E] text-sm mb-6">Enter passcode</p>
        <div className="flex gap-3 mb-4">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all ${
                i < code.length ? "bg-[#C9A84C] border-[#C9A84C]" : "border-[#A8A29E]/40"
              } ${codeError ? "border-red-500 bg-red-500/30" : ""}`}
            />
          ))}
        </div>
        {codeError && <p className="text-red-400 text-sm mb-3">Incorrect</p>}
        <div className="grid grid-cols-3 gap-3 max-w-[240px]">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", ""].map((d, i) =>
            d === "" ? (
              <div key={i} />
            ) : (
              <button
                key={d}
                onClick={() => handleDigit(d)}
                className="w-16 h-16 rounded-lg border border-[#2D2D2D] bg-[#2D2D2D] text-[#F5F0EB] text-xl hover:border-[#C9A84C]/40 transition-all active:scale-95"
              >
                {d}
              </button>
            ),
          )}
        </div>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────────
  if (api.loading || playersLoading) {
    return (
      <div className="min-h-screen bg-[#1A1A1A] flex items-center justify-center">
        <p className="text-[#A8A29E] animate-pulse">Loading tournament…</p>
      </div>
    );
  }

  // ── Sync status pill ──────────────────────────────────────
  const syncPill = (() => {
    const map: Record<string, { label: string; cls: string }> = {
      connecting: { label: "Connecting…", cls: "bg-[#A8A29E]/15 text-[#A8A29E] border-[#A8A29E]/30" },
      synced: { label: "Live · synced", cls: "bg-[#C9A84C]/10 text-[#C9A84C] border-[#C9A84C]/30" },
      saving: { label: "Saving…", cls: "bg-[#C9A84C]/20 text-[#C9A84C] border-[#C9A84C]/40" },
      error: { label: "Sync error", cls: "bg-red-500/10 text-red-400 border-red-500/30" },
      local: { label: "Local only", cls: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" },
    };
    return map[api.syncStatus];
  })();

  // ── Main UI ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#1A1A1A] text-[#F5F0EB]">
      {/* Header */}
      <header className="border-b border-[#2D2D2D] px-4 md:px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-serif text-2xl text-[#C9A84C]">Courtside Social — Set 01</h1>
          <p className="text-xs text-[#A8A29E] mt-1">Saturday, May 16 · Toronto · Tournament Live</p>
        </div>
        <div className={`text-xs px-3 py-1 rounded-full border ${syncPill.cls}`}>{syncPill.label}</div>
      </header>

      {/* Status banner */}
      {statusMsg && (
        <div className="mx-4 md:mx-6 mt-4 p-3 rounded-lg bg-[#C9A84C]/10 border border-[#C9A84C]/30 text-sm text-[#C9A84C] flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          {statusMsg}
        </div>
      )}

      {/* Tab nav */}
      <nav className="border-b border-[#2D2D2D] px-4 md:px-6 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {(
            [
              ["setup", "Setup"],
              ["stage1", "Stage 1"],
              ["seeds", "Final Seeds"],
              ["mens", "Men's Bracket"],
              ["womens", "Women's"],
              ["live", "Live View"],
            ] as Array<[ViewKey, string]>
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`px-4 py-3 text-sm transition-colors border-b-2 -mb-px ${
                view === key
                  ? "text-[#C9A84C] border-[#C9A84C]"
                  : "text-[#A8A29E] border-transparent hover:text-[#F5F0EB]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </nav>

      {/* View body */}
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6">
        {view === "setup" && <SetupView api={api} onPick={setPickingFor} />}
        {view === "stage1" && <Stage1View api={api} />}
        {view === "seeds" && <SeedsView api={api} />}
        {view === "mens" && <MensBracketView api={api} />}
        {view === "womens" && <WomensView api={api} onPick={setPickingFor} />}
        {view === "live" && <LiveView api={api} />}
      </main>

      {/* Player picker modal */}
      {pickingFor && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-end md:items-center justify-center">
          <div className="bg-[#2D2D2D] w-full max-w-md max-h-[70vh] rounded-t-xl md:rounded-xl overflow-hidden">
            <div className="p-4 border-b border-[#1A1A1A] flex items-center gap-3">
              <Search className="w-4 h-4 text-[#A8A29E]" />
              <input
                type="text"
                placeholder="Search players…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                className="flex-1 bg-transparent text-[#F5F0EB] outline-none placeholder-[#A8A29E]/50"
              />
              <button
                onClick={() => {
                  setPickingFor(null);
                  setSearchQuery("");
                }}
                className="text-xs text-[#A8A29E] hover:text-[#F5F0EB]"
              >
                Cancel
              </button>
            </div>
            <div className="overflow-y-auto max-h-[50vh] p-2">
              {filteredPlayers.length === 0 ? (
                <p className="text-center text-[#A8A29E] text-sm py-6">No players found</p>
              ) : (
                filteredPlayers.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => selectPlayer(p)}
                    className="w-full text-left px-3 py-2.5 rounded hover:bg-[#1A1A1A] text-sm text-[#F5F0EB] transition-colors"
                  >
                    {p.display}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// SUB-VIEWS
// ============================================================

type Api = ReturnType<typeof useSet01Tournament>;
type PickHandler = React.Dispatch<
  React.SetStateAction<
    | { kind: "men"; seed: number; slot: "player1" | "player2" }
    | { kind: "women"; label: string; slot: "player1" | "player2" }
    | null
  >
>;

// ── Setup ─────────────────────────────────────────────────
const SetupView = ({ api, onPick }: { api: Api; onPick: PickHandler }) => {
  const tierClass = (seed: number) =>
    seed <= 4
      ? "border-l-[#C9A84C]"
      : seed <= 8
      ? "border-l-[#7A8A4F]"
      : seed <= 12
      ? "border-l-[#A8825F]"
      : "border-l-[#7A4F4F]";

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-xl text-[#F5F0EB] mb-1">Men's Teams · 16 seeds</h2>
        <p className="text-xs text-[#A8A29E]">Top 4 = anchor seeds (locked). Seeds 5–16 may shift after Stage 1.</p>
      </div>
      <div className="space-y-2">
        {api.state.mensTeams.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-3 p-3 rounded-lg border-l-4 border border-[#2D2D2D] bg-[#2D2D2D]/50 ${tierClass(
              t.initialSeed,
            )}`}
          >
            <span className="font-mono text-[#C9A84C] font-bold w-8 text-center">#{t.initialSeed}</span>
            <PlayerSlot
              player={t.player1}
              onPick={() => onPick({ kind: "men", seed: t.initialSeed, slot: "player1" })}
              onClear={() => api.setMensTeam(t.initialSeed, "player1", null)}
            />
            <span className="text-[#A8A29E] text-xs">&</span>
            <PlayerSlot
              player={t.player2}
              onPick={() => onPick({ kind: "men", seed: t.initialSeed, slot: "player2" })}
              onClear={() => api.setMensTeam(t.initialSeed, "player2", null)}
            />
          </div>
        ))}
      </div>

      <div>
        <h2 className="font-serif text-xl text-[#F5F0EB] mb-1">Women's Teams · 5 seeds</h2>
        <p className="text-xs text-[#A8A29E]">Group stage: each team plays 2 matches. Top 4 advance to SF.</p>
      </div>
      <div className="space-y-2">
        {api.state.womensTeams.map((t) => (
          <div
            key={t.id}
            className="flex items-center gap-3 p-3 rounded-lg border-l-4 border border-[#2D2D2D] bg-[#2D2D2D]/50 border-l-[#C9A84C]"
          >
            <span className="font-mono text-[#C9A84C] font-bold w-8 text-center">{t.label}</span>
            <PlayerSlot
              player={t.player1}
              onPick={() => onPick({ kind: "women", label: t.label, slot: "player1" })}
              onClear={() => api.setWomensTeam(t.label, "player1", null)}
            />
            <span className="text-[#A8A29E] text-xs">&</span>
            <PlayerSlot
              player={t.player2}
              onPick={() => onPick({ kind: "women", label: t.label, slot: "player2" })}
              onClear={() => api.setWomensTeam(t.label, "player2", null)}
            />
          </div>
        ))}
      </div>

      <div className="flex justify-end pt-6 border-t border-[#2D2D2D]">
        <button
          onClick={() => {
            if (confirm("Reset the entire tournament? All scores, seeds, and team assignments will be cleared.")) {
              api.resetTournament();
            }
          }}
          className="text-xs text-red-400 hover:text-red-300 flex items-center gap-2"
        >
          <RotateCcw className="w-3 h-3" />
          Reset entire tournament
        </button>
      </div>
    </div>
  );
};

const PlayerSlot = ({
  player,
  onPick,
  onClear,
}: {
  player: { id: string; display: string } | null;
  onPick: () => void;
  onClear: () => void;
}) => {
  if (player) {
    return (
      <button
        onClick={onClear}
        className="flex-1 text-left px-3 py-2 rounded border border-[#C9A84C]/30 bg-[#C9A84C]/5 text-sm text-[#F5F0EB] hover:border-red-400/50 hover:bg-red-400/5 transition-colors group"
      >
        <span className="group-hover:line-through">{player.display}</span>
        <span className="text-[10px] text-[#A8A29E] ml-2 group-hover:text-red-400">tap to change</span>
      </button>
    );
  }
  return (
    <button
      onClick={onPick}
      className="flex-1 px-3 py-2 rounded border border-dashed border-[#A8A29E]/30 text-sm text-[#A8A29E] hover:border-[#C9A84C]/50 hover:text-[#C9A84C] transition-colors"
    >
      Select player…
    </button>
  );
};

// ── Stage 1 ───────────────────────────────────────────────
const Stage1View = ({ api }: { api: Api }) => {
  const summary = useMemo(() => {
    const bandA_upsets = api.state.stage1
      .slice(0, 4)
      .filter((m) => m.scoreA != null && m.scoreB != null && m.scoreB! > m.scoreA!);
    const bandB_upsets = api.state.stage1
      .slice(4, 8)
      .filter((m) => m.scoreA != null && m.scoreB != null && m.scoreB! > m.scoreA!);
    const bandA_openSpots = api.state.stage1
      .slice(4, 8)
      .filter((m) => m.scoreA != null && m.scoreB != null && m.scoreB! > m.scoreA!);
    return { bandA_upsets, bandB_upsets, bandA_openSpots };
  }, [api.state.stage1]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-xl text-[#F5F0EB] mb-1">Stage 1 · Warm-up Round</h2>
        <p className="text-xs text-[#A8A29E]">
          Best of 3 games (first to 2). All teams play one match. Upsets auto-flag.
        </p>
      </div>

      <div className="space-y-4">
        <p className="text-xs uppercase tracking-wide text-[#A8A29E]">Band A · Seeds 1–4 vs 9–12</p>
        {api.state.stage1.slice(0, 4).map((m, i) => (
          <Stage1MatchRow key={m.match} api={api} matchIdx={i} />
        ))}
      </div>

      <div className="space-y-4">
        <p className="text-xs uppercase tracking-wide text-[#A8A29E]">Band B · Seeds 5–8 vs 13–16</p>
        {api.state.stage1.slice(4, 8).map((m, i) => (
          <Stage1MatchRow key={m.match} api={api} matchIdx={i + 4} />
        ))}
      </div>

      <div className="rounded-lg border border-[#2D2D2D] bg-[#2D2D2D]/50 p-5 space-y-3">
        <h3 className="font-serif text-lg text-[#C9A84C]">Stage 1 Summary</h3>
        <SummaryRow label="Band A upsets (9–12 won)" value={summary.bandA_upsets.length} />
        <SummaryRow label="Band B upsets (13–16 won)" value={summary.bandB_upsets.length} />
        <SummaryRow label="Open spots in 5–8 (band A losses)" value={summary.bandA_openSpots.length} />
        <SummaryRow
          label="Recommended Band A swaps"
          value={Math.min(summary.bandA_upsets.length, summary.bandA_openSpots.length)}
        />
        <SummaryRow label="Recommended Band B swaps" value={summary.bandB_upsets.length} />
      </div>

      <div className="flex justify-end gap-2">
        <button
          onClick={api.resetSeeds}
          className="text-xs text-[#A8A29E] hover:text-[#F5F0EB] flex items-center gap-2 px-4 py-2"
        >
          <RotateCcw className="w-3 h-3" />
          Reset seeds
        </button>
        <button
          onClick={api.applyStage1Swaps}
          className="px-5 py-2 border border-[#C9A84C] text-[#C9A84C] font-serif hover:bg-[#C9A84C] hover:text-[#1A1A1A] transition-colors text-sm flex items-center gap-2"
        >
          Apply swaps & advance
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const SummaryRow = ({ label, value }: { label: string; value: number }) => (
  <div className="flex justify-between text-sm">
    <span className="text-[#A8A29E]">{label}</span>
    <span className="font-bold text-[#C9A84C]">{value}</span>
  </div>
);

const Stage1MatchRow = ({ api, matchIdx }: { api: Api; matchIdx: number }) => {
  const m = api.state.stage1[matchIdx];
  const teamA = api.state.mensTeams[m.seedA - 1];
  const teamB = api.state.mensTeams[m.seedB - 1];
  const isComplete = m.scoreA != null && m.scoreB != null;
  const isUpset = isComplete && m.scoreB! > m.scoreA!;

  return (
    <div
      className={`rounded-lg p-4 border transition-colors ${
        isUpset
          ? "border-red-500/40 bg-red-500/5"
          : isComplete
          ? "border-[#C9A84C]/40 bg-[#C9A84C]/5"
          : "border-[#2D2D2D] bg-[#2D2D2D]/50"
      }`}
    >
      {isUpset && (
        <div className="text-[10px] font-bold text-red-400 uppercase tracking-wide mb-2 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          Upset
        </div>
      )}
      <div className="flex items-center gap-3 flex-wrap md:flex-nowrap">
        <span className="font-mono text-xs text-[#A8A29E] w-10">M{m.match}</span>
        <TeamPill seed={m.seedA} team={teamA} />
        <ScoreInput value={m.scoreA} onChange={(v) => api.setStage1Score(matchIdx, "A", v)} />
        <span className="text-xs text-[#A8A29E]">vs</span>
        <ScoreInput value={m.scoreB} onChange={(v) => api.setStage1Score(matchIdx, "B", v)} />
        <TeamPill seed={m.seedB} team={teamB} />
      </div>
    </div>
  );
};

const TeamPill = ({ seed, team }: { seed: number; team: MensTeamSlot | undefined }) => {
  const display =
    team?.player1 && team?.player2
      ? `${team.player1.display} & ${team.player2.display}`
      : team?.player1
      ? team.player1.display
      : `Seed ${seed}`;
  return (
    <div className="flex-1 min-w-0 flex items-center gap-2">
      <span className="bg-[#1A1A1A] text-[#C9A84C] text-xs font-mono px-2 py-1 rounded shrink-0">#{seed}</span>
      <span className="text-sm text-[#F5F0EB] truncate">{display}</span>
    </div>
  );
};

const WomensTeamPill = ({
  label,
  team,
}: {
  label: string | null;
  team: WomensTeamSlot | null | undefined;
}) => {
  const display =
    team?.player1 && team?.player2
      ? `${team.player1.display} & ${team.player2.display}`
      : team?.player1
      ? team.player1.display
      : label
      ? `Team ${label}`
      : "TBA";
  return (
    <div className="flex-1 min-w-0 flex items-center gap-2">
      <span className="bg-[#1A1A1A] text-[#C9A84C] text-xs font-mono px-2 py-1 rounded shrink-0">{label ?? "?"}</span>
      <span className="text-sm text-[#F5F0EB] truncate">{display}</span>
    </div>
  );
};

const ScoreInput = ({
  value,
  onChange,
  disabled,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  disabled?: boolean;
}) => (
  <input
    type="number"
    min={0}
    max={9}
    value={value ?? ""}
    disabled={disabled}
    onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
    className="w-14 px-2 py-1.5 rounded border border-[#2D2D2D] bg-[#1A1A1A] text-center font-bold text-[#F5F0EB] text-base focus:border-[#C9A84C] focus:outline-none disabled:opacity-30"
    placeholder="–"
  />
);

// ── Final Seeds ───────────────────────────────────────────
const SeedsView = ({ api }: { api: Api }) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-xl text-[#F5F0EB] mb-1">Final Seeds</h2>
        <p className="text-xs text-[#A8A29E]">Top 4 locked. Seeds 5–16 reflect Stage 1 swaps.</p>
      </div>
      <div className="space-y-2">
        {api.state.finalSeeds.map((fs) => {
          const team = api.state.mensTeams[fs.originalSeed - 1];
          const moved = fs.seed !== fs.originalSeed;
          const display =
            team?.player1 && team?.player2
              ? `${team.player1.display} & ${team.player2.display}`
              : `Seed ${fs.originalSeed} (unnamed)`;
          const tierClass =
            fs.seed <= 4
              ? "border-l-[#C9A84C]"
              : fs.seed <= 8
              ? "border-l-[#7A8A4F]"
              : fs.seed <= 12
              ? "border-l-[#A8825F]"
              : "border-l-[#7A4F4F]";
          return (
            <div
              key={fs.seed}
              className={`flex items-center gap-3 p-3 rounded-lg border-l-4 border border-[#2D2D2D] bg-[#2D2D2D]/50 ${tierClass}`}
            >
              <span className="font-mono text-[#C9A84C] font-bold w-8 text-center">#{fs.seed}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-[#F5F0EB] truncate">{display}</div>
                {moved && (
                  <div className="text-[10px] text-[#A8A29E]">moved from initial seed {fs.originalSeed}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Men's Bracket ─────────────────────────────────────────
const MensBracketView = ({ api }: { api: Api }) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-xl text-[#F5F0EB] mb-1">Men's Bracket</h2>
        <p className="text-xs text-[#A8A29E]">
          Best of 3 games (first to 2) through SF. Final = best of 5 (first to 3). Winners auto-advance.
        </p>
      </div>
      <BracketColumn title="Round of 16" matches={api.state.r16} round="r16" api={api} />
      <BracketColumn title="Quarterfinals" matches={api.state.qf} round="qf" api={api} />
      <BracketColumn title="Semifinals" matches={api.state.sf} round="sf" api={api} />
      <BracketColumn title="Final · Best of 5" matches={[api.state.f]} round="f" api={api} />

      <ChampionBanner api={api} />
    </div>
  );
};

const BracketColumn = ({
  title,
  matches,
  round,
  api,
}: {
  title: string;
  matches: KnockoutMatch[];
  round: "r16" | "qf" | "sf" | "f";
  api: Api;
}) => (
  <div className="space-y-3">
    <h3 className="font-serif text-lg text-[#F5F0EB]">{title}</h3>
    <div className="grid gap-3 md:grid-cols-2">
      {matches.map((m) => (
        <BracketMatchCard key={m.id} api={api} match={m} round={round} />
      ))}
    </div>
  </div>
);

const BracketMatchCard = ({
  api,
  match,
  round,
}: {
  api: Api;
  match: KnockoutMatch;
  round: "r16" | "qf" | "sf" | "f";
}) => {
  const seeds = api.getKnockoutSeeds(match);
  const teamA = seeds.a ? api.teamBySeed(seeds.a) : null;
  const teamB = seeds.b ? api.teamBySeed(seeds.b) : null;
  const winner = api.matchWinner(match);
  const complete = winner != null;

  const displayName = (t: MensTeamSlot | null, fallbackSeed: number | null) => {
    if (!t || !t.player1 || !t.player2) return fallbackSeed ? `Seed ${fallbackSeed}` : "TBA";
    return `${t.player1.display} & ${t.player2.display}`;
  };

  return (
    <div
      className={`rounded-lg p-4 border space-y-2 ${
        complete ? "border-[#C9A84C]/40 bg-[#C9A84C]/5" : "border-[#2D2D2D] bg-[#2D2D2D]/50"
      }`}
    >
      <div className="text-[10px] uppercase tracking-wider text-[#A8A29E]">{match.id}</div>
      <BracketRow
        seed={seeds.a}
        name={displayName(teamA, seeds.a)}
        isWinner={winner === "A"}
        score={match.scoreA}
        onScore={(v) => api.setKnockoutScore(round, match.id, "A", v)}
        disabled={!seeds.a}
      />
      <div className="border-t border-[#2D2D2D]" />
      <BracketRow
        seed={seeds.b}
        name={displayName(teamB, seeds.b)}
        isWinner={winner === "B"}
        score={match.scoreB}
        onScore={(v) => api.setKnockoutScore(round, match.id, "B", v)}
        disabled={!seeds.b}
      />
    </div>
  );
};

const BracketRow = ({
  seed,
  name,
  isWinner,
  score,
  onScore,
  disabled,
}: {
  seed: number | null;
  name: string;
  isWinner: boolean;
  score: number | null;
  onScore: (v: number | null) => void;
  disabled?: boolean;
}) => (
  <div className="flex items-center gap-2">
    <span
      className={`font-mono text-xs w-8 text-center px-1.5 py-0.5 rounded ${
        seed ? "bg-[#1A1A1A] text-[#C9A84C]" : "bg-[#1A1A1A]/50 text-[#A8A29E]"
      }`}
    >
      {seed ?? "–"}
    </span>
    <span className={`flex-1 text-sm truncate ${isWinner ? "text-[#C9A84C] font-semibold" : "text-[#F5F0EB]"}`}>
      {name}
      {isWinner && <Trophy className="w-3.5 h-3.5 text-[#C9A84C] inline ml-2" />}
    </span>
    <ScoreInput value={score} onChange={onScore} disabled={disabled} />
  </div>
);

const ChampionBanner = ({ api }: { api: Api }) => {
  const winner = api.matchWinner(api.state.f);
  if (!winner) return null;
  const seeds = api.getKnockoutSeeds(api.state.f);
  const winningSeed = winner === "A" ? seeds.a : seeds.b;
  if (!winningSeed) return null;
  const team = api.teamBySeed(winningSeed);
  if (!team || !team.player1 || !team.player2) return null;
  return (
    <div className="text-center py-8 space-y-3 border border-[#C9A84C]/30 rounded-lg bg-[#C9A84C]/5">
      <Trophy className="w-12 h-12 text-[#C9A84C] mx-auto" />
      <h3 className="font-serif text-3xl text-[#C9A84C]">Men's Champions</h3>
      <p className="text-xl text-[#F5F0EB]">
        {team.player1.display} & {team.player2.display}
      </p>
    </div>
  );
};

// ── Women's Tournament ────────────────────────────────────
const WomensView = ({ api, onPick: _onPick }: { api: Api; onPick: PickHandler }) => {
  const standings = api.womensStandings();

  const autoFillSF = () => {
    if (standings.filter((t) => t.w + t.l > 0).length < 4) {
      alert("Not enough group matches complete to auto-fill SF.");
      return;
    }
    api.assignWomensSF(0, "teamA", standings[0].label);
    api.assignWomensSF(0, "teamB", standings[3].label);
    api.assignWomensSF(1, "teamA", standings[1].label);
    api.assignWomensSF(1, "teamB", standings[2].label);
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-xl text-[#F5F0EB] mb-1">Women's Tournament</h2>
        <p className="text-xs text-[#A8A29E]">Group → Standings → SF → Final. Best of 3 games throughout.</p>
      </div>

      <div className="space-y-3">
        <h3 className="font-serif text-lg text-[#F5F0EB]">Group Stage</h3>
        {api.state.womensGroup.map((g, i) => {
          const teamA = api.womensTeamByLabel(g.teamA);
          const teamB = api.womensTeamByLabel(g.teamB);
          const isComplete = g.scoreA != null && g.scoreB != null;
          return (
            <div
              key={g.id}
              className={`rounded-lg p-4 border ${
                isComplete ? "border-[#C9A84C]/40 bg-[#C9A84C]/5" : "border-[#2D2D2D] bg-[#2D2D2D]/50"
              }`}
            >
              <div className="flex items-center gap-3 flex-wrap md:flex-nowrap">
                <span className="font-mono text-xs text-[#A8A29E] w-10">{g.id}</span>
                <WomensTeamPill label={g.teamA} team={teamA} />
                <ScoreInput value={g.scoreA} onChange={(v) => api.setWomensGroupScore(i, "A", v)} />
                <span className="text-xs text-[#A8A29E]">vs</span>
                <ScoreInput value={g.scoreB} onChange={(v) => api.setWomensGroupScore(i, "B", v)} />
                <WomensTeamPill label={g.teamB} team={teamB} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-3">
        <h3 className="font-serif text-lg text-[#F5F0EB]">Standings</h3>
        <p className="text-[10px] text-[#A8A29E] uppercase tracking-wider">
          Sort: Wins → +/- → Points scored. Tiebreakers: head-to-head, coin toss.
        </p>
        <div className="rounded-lg overflow-hidden border border-[#2D2D2D]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#2D2D2D] text-[#A8A29E] uppercase text-[10px] tracking-wide">
                <th className="text-center p-2 w-12">Rank</th>
                <th className="text-left p-2">Team</th>
                <th className="text-center p-2 w-10">W</th>
                <th className="text-center p-2 w-10">L</th>
                <th className="text-center p-2 w-12">PF</th>
                <th className="text-center p-2 w-12">PA</th>
                <th className="text-center p-2 w-12">+/-</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((s, i) => (
                <tr key={s.label} className="border-t border-[#2D2D2D] bg-[#1A1A1A]">
                  <td className="text-center p-2 font-bold">{i + 1}</td>
                  <td className="p-2 text-[#F5F0EB]">
                    <span className="font-mono text-[#C9A84C] mr-2">{s.label}</span>
                    {s.name}
                  </td>
                  <td className="text-center p-2">{s.w}</td>
                  <td className="text-center p-2">{s.l}</td>
                  <td className="text-center p-2">{s.pf}</td>
                  <td className="text-center p-2">{s.pa}</td>
                  <td
                    className={`text-center p-2 font-bold ${
                      s.diff > 0 ? "text-[#C9A84C]" : s.diff < 0 ? "text-red-400" : ""
                    }`}
                  >
                    {s.diff > 0 ? "+" : ""}
                    {s.diff}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-serif text-lg text-[#F5F0EB]">Knockouts</h3>
          <button
            onClick={autoFillSF}
            className="text-xs px-3 py-1.5 rounded border border-[#C9A84C]/40 text-[#C9A84C] hover:bg-[#C9A84C]/10"
          >
            Auto-fill SF from standings
          </button>
        </div>
        {api.state.womensSF.map((m, idx) => {
          const teamA = api.womensTeamByLabel(m.teamA);
          const teamB = api.womensTeamByLabel(m.teamB);
          const isComplete = m.scoreA != null && m.scoreB != null;
          return (
            <div
              key={m.id}
              className={`rounded-lg p-4 border ${
                isComplete ? "border-[#C9A84C]/40 bg-[#C9A84C]/5" : "border-[#2D2D2D] bg-[#2D2D2D]/50"
              }`}
            >
              <div className="flex items-center gap-3 flex-wrap md:flex-nowrap">
                <span className="font-mono text-xs text-[#A8A29E] w-10">{m.id}</span>
                <WomensTeamPill label={m.teamA} team={teamA} />
                <ScoreInput value={m.scoreA} onChange={(v) => api.setWomensSFScore(idx, "A", v)} />
                <span className="text-xs text-[#A8A29E]">vs</span>
                <ScoreInput value={m.scoreB} onChange={(v) => api.setWomensSFScore(idx, "B", v)} />
                <WomensTeamPill label={m.teamB} team={teamB} />
              </div>
            </div>
          );
        })}

        {/* Final */}
        <WomensFinalCard api={api} />
      </div>
    </div>
  );
};

const WomensFinalCard = ({ api }: { api: Api }) => {
  const sf1 = api.state.womensSF[0];
  const sf2 = api.state.womensSF[1];
  const aLabel = api.womensSFWinner(sf1);
  const bLabel = api.womensSFWinner(sf2);
  const teamA = api.womensTeamByLabel(aLabel);
  const teamB = api.womensTeamByLabel(bLabel);
  const isComplete = api.state.womensF.scoreA != null && api.state.womensF.scoreB != null;
  const winner = api.matchWinner(api.state.womensF);
  const winnerLabel = winner === "A" ? aLabel : winner === "B" ? bLabel : null;
  const winnerTeam = api.womensTeamByLabel(winnerLabel);

  return (
    <div
      className={`rounded-lg p-4 border-2 ${
        isComplete ? "border-[#C9A84C] bg-[#C9A84C]/5" : "border-[#C9A84C]/30 bg-[#2D2D2D]/50"
      }`}
    >
      <div className="text-[10px] uppercase tracking-wider text-[#C9A84C] mb-3 font-bold">Final</div>
      <div className="flex items-center gap-3 flex-wrap md:flex-nowrap">
        <WomensTeamPill label={aLabel} team={teamA} />
        <ScoreInput
          value={api.state.womensF.scoreA}
          onChange={(v) => api.setWomensFinalScore("A", v)}
          disabled={!aLabel}
        />
        <span className="text-xs text-[#A8A29E]">vs</span>
        <ScoreInput
          value={api.state.womensF.scoreB}
          onChange={(v) => api.setWomensFinalScore("B", v)}
          disabled={!bLabel}
        />
        <WomensTeamPill label={bLabel} team={teamB} />
      </div>
      {winnerTeam && winnerTeam.player1 && winnerTeam.player2 && (
        <div className="mt-4 text-center py-4 space-y-2 border-t border-[#C9A84C]/30">
          <Trophy className="w-8 h-8 text-[#C9A84C] mx-auto" />
          <p className="font-serif text-xl text-[#C9A84C]">Women's Champions</p>
          <p className="text-base text-[#F5F0EB]">
            {winnerTeam.player1.display} & {winnerTeam.player2.display}
          </p>
        </div>
      )}
    </div>
  );
};

// ── Live View ─────────────────────────────────────────────
const LiveView = ({ api }: { api: Api }) => {
  const stage1Done = api.state.stage1.filter((m) => api.matchWinner(m) != null).length;
  const r16Done = api.state.r16.filter((m) => api.matchWinner(m) != null).length;
  const qfDone = api.state.qf.filter((m) => api.matchWinner(m) != null).length;
  const sfDone = api.state.sf.filter((m) => api.matchWinner(m) != null).length;
  const fDone = api.matchWinner(api.state.f) != null ? 1 : 0;
  const womensGroupDone = api.state.womensGroup.filter((m) => api.matchWinner(m) != null).length;

  // Champions
  const mensWinner = api.matchWinner(api.state.f);
  const mensSeeds = api.getKnockoutSeeds(api.state.f);
  const mensChampSeed = mensWinner === "A" ? mensSeeds.a : mensWinner === "B" ? mensSeeds.b : null;
  const mensChamp = mensChampSeed ? api.teamBySeed(mensChampSeed) : null;

  const wWinner = api.matchWinner(api.state.womensF);
  const wA = api.womensSFWinner(api.state.womensSF[0]);
  const wB = api.womensSFWinner(api.state.womensSF[1]);
  const wChampLabel = wWinner === "A" ? wA : wWinner === "B" ? wB : null;
  const wChamp = api.womensTeamByLabel(wChampLabel);

  const standings = api.womensStandings();
  const top = standings[0];

  return (
    <div className="space-y-8 py-4">
      <h2 className="font-serif text-3xl text-[#C9A84C] text-center">Set 01 · Live</h2>

      <div className="grid md:grid-cols-2 gap-4">
        <StatCard title="Men's Tournament">
          <StatRow label="Stage 1" done={stage1Done} total={8} />
          <StatRow label="Round of 16" done={r16Done} total={8} />
          <StatRow label="Quarterfinals" done={qfDone} total={4} />
          <StatRow label="Semifinals" done={sfDone} total={2} />
          <StatRow label="Final" done={fDone} total={1} />
        </StatCard>
        <StatCard title="Women's Tournament">
          <StatRow label="Group stage" done={womensGroupDone} total={5} />
          <StatRow
            label="Standings leader"
            valueText={top ? `${top.label} · ${top.name} (${top.w}W ${top.l}L)` : "—"}
          />
        </StatCard>
      </div>

      {(mensChamp || wChamp) && (
        <div className="grid md:grid-cols-2 gap-4">
          {mensChamp && mensChamp.player1 && mensChamp.player2 && (
            <ChampionCard label="Men's Champion" name={`${mensChamp.player1.display} & ${mensChamp.player2.display}`} />
          )}
          {wChamp && wChamp.player1 && wChamp.player2 && (
            <ChampionCard label="Women's Champion" name={`${wChamp.player1.display} & ${wChamp.player2.display}`} />
          )}
        </div>
      )}

      <p className="text-center text-[#A8A29E] italic font-serif">Three sets. One summer.</p>
    </div>
  );
};

const StatCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-lg border border-[#2D2D2D] bg-[#2D2D2D]/40 p-5 space-y-3">
    <h3 className="text-xs uppercase tracking-widest text-[#C9A84C]">{title}</h3>
    <div className="space-y-2">{children}</div>
  </div>
);

const StatRow = ({
  label,
  done,
  total,
  valueText,
}: {
  label: string;
  done?: number;
  total?: number;
  valueText?: string;
}) => (
  <div className="flex items-center justify-between text-sm">
    <span className="text-[#A8A29E]">{label}</span>
    {valueText !== undefined ? (
      <span className="text-[#F5F0EB]">{valueText}</span>
    ) : (
      <span className={done === total ? "text-[#C9A84C] font-bold" : "text-[#F5F0EB]"}>
        {done}/{total}
      </span>
    )}
  </div>
);

const ChampionCard = ({ label, name }: { label: string; name: string }) => (
  <div className="rounded-lg border-2 border-[#C9A84C] bg-[#C9A84C]/5 p-6 text-center space-y-2">
    <Trophy className="w-10 h-10 text-[#C9A84C] mx-auto" />
    <p className="text-xs uppercase tracking-widest text-[#C9A84C]">{label}</p>
    <p className="font-serif text-xl text-[#F5F0EB]">{name}</p>
  </div>
);

export default Set01Tournament;
